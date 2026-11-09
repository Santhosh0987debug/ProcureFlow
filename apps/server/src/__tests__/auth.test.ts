import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { resetDatabase } from '../test/database.js';
import { SignJWT } from 'jose';

const app = createApp();

const registration = {
  firstName: 'Avery',
  lastName: 'Stone',
  email: 'avery.stone@example.com',
  password: 'StrongPass123',
  workspaceName: 'Stone Procurement',
};

function cookieHeader(response: request.Response): string {
  const setCookie: unknown = response.headers['set-cookie'];

  if (Array.isArray(setCookie)) {
    return setCookie.join('; ');
  }

  return typeof setCookie === 'string' ? setCookie : '';
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('registers a user, hashes the password and creates an owned workspace', async () => {
    const response = await request(app).post('/api/auth/register').send(registration);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      data: {
        user: {
          email: registration.email,
          firstName: registration.firstName,
          lastName: registration.lastName,
        },
        workspaces: [
          {
            name: registration.workspaceName,
            role: 'owner',
            currency: 'USD',
          },
        ],
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain(registration.password);
    expect(cookieHeader(response)).toContain('procureflow_session=');
    expect(cookieHeader(response)).toContain('HttpOnly');
    expect(cookieHeader(response)).toContain('SameSite=Lax');

    const storedUser = await prisma.user.findUnique({
      where: { email: registration.email },
    });

    expect(storedUser).not.toBeNull();
    expect(storedUser?.passwordHash).not.toBe(registration.password);
    expect(storedUser?.passwordHash.startsWith('$2')).toBe(true);
    expect(await bcrypt.compare(registration.password, storedUser!.passwordHash)).toBe(true);

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: storedUser!.id },
      include: { workspace: true },
    });

    expect(membership?.role).toBe('owner');
    expect(membership?.workspace.name).toBe(registration.workspaceName);

    const auditEntry = await prisma.auditLog.findFirst({
      where: { workspaceId: membership!.workspaceId, action: 'user.registered' },
    });

    expect(auditEntry?.actorId).toBe(storedUser!.id);
  });

  it('rejects a duplicate email case-insensitively without creating a second user', async () => {
    await request(app).post('/api/auth/register').send(registration).expect(201);

    const duplicate = await request(app)
      .post('/api/auth/register')
      .send({ ...registration, email: registration.email.toUpperCase() });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({
      error: {
        code: 'EMAIL_IN_USE',
        message: 'An account with this email address already exists.',
      },
    });
    expect(await prisma.user.count()).toBe(1);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(registration).expect(201);
  });

  it('authenticates valid credentials and updates the last login time', async () => {
    const agent = request.agent(app);
    const response = await agent.post('/api/auth/login').send({
      email: registration.email.toUpperCase(),
      password: registration.password,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(registration.email);
    expect(cookieHeader(response)).toContain('procureflow_session=');

    const storedUser = await prisma.user.findUnique({
      where: { email: registration.email },
    });

    expect(storedUser?.lastLoginAt).not.toBeNull();
  });

  it('rejects an incorrect password and an unknown email with the same response', async () => {
    const wrongPassword = await request(app).post('/api/auth/login').send({
      email: registration.email,
      password: 'WrongPass123',
    });
    const unknownEmail = await request(app).post('/api/auth/login').send({
      email: 'unknown@example.com',
      password: registration.password,
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(cookieHeader(wrongPassword)).toBe('');
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the session cookie and revokes access through that session', async () => {
    const agent = request.agent(app);

    await agent.post('/api/auth/register').send(registration).expect(201);
    await agent.get('/api/auth/me').expect(200);

    const logoutResponse = await agent.post('/api/auth/logout');

    expect(logoutResponse.status).toBe(204);
    expect(cookieHeader(logoutResponse)).toContain('Expires=Thu, 01 Jan 1970');

    const meResponse = await agent.get('/api/auth/me');

    expect(meResponse.status).toBe(401);
    expect(meResponse.body.error.code).toBe('AUTH_REQUIRED');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the authenticated user and workspace memberships', async () => {
    const agent = request.agent(app);
    const registerResponse = await agent.post('/api/auth/register').send(registration).expect(201);

    const response = await agent.get('/api/auth/me');

    expect(response.status).toBe(200);
    expect(response.body.data.user.id).toBe(registerResponse.body.data.user.id);
    expect(response.body.data.workspaces).toHaveLength(1);
    expect(response.body.data.workspaces[0].name).toBe(registration.workspaceName);
  });

  it('rejects missing, malformed and expired session tokens', async () => {
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(registration)
      .expect(201);
    const userId = registerResponse.body.data.user.id as string;

    const missing = await request(app).get('/api/auth/me');
    const malformed = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'procureflow_session=not-a-valid-token');

    const expiredToken = await new SignJWT({ email: registration.email })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(userId)
      .setIssuer(env.jwtIssuer)
      .setAudience(env.jwtAudience)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(env.jwtSecret));

    const expired = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `procureflow_session=${expiredToken}`);

    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('AUTH_REQUIRED');
    expect(malformed.status).toBe(401);
    expect(malformed.body.error.code).toBe('SESSION_INVALID');
    expect(expired.status).toBe(401);
    expect(expired.body.error.code).toBe('SESSION_INVALID');
  });

  it('rejects a token signed by an unexpected issuer', async () => {
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(registration)
      .expect(201);

    const token = await new SignJWT({ email: registration.email })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(registerResponse.body.data.user.id)
      .setIssuer('another-service')
      .setAudience(env.jwtAudience)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(env.jwtSecret));

    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `procureflow_session=${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SESSION_INVALID');
  });
});

describe('authentication input validation', () => {
  it('returns field-level validation errors for an invalid registration', async () => {
    const response = await request(app).post('/api/auth/register').send({
      firstName: '',
      lastName: '',
      email: 'not-an-email',
      password: 'short',
      unexpected: true,
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.fieldErrors).toMatchObject({
      firstName: expect.any(Array),
      lastName: expect.any(Array),
      email: expect.any(Array),
      password: expect.any(Array),
      form: expect.any(Array),
    });
    expect(await prisma.user.count()).toBe(0);
  });

  it('rejects login requests without a password', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: registration.email });

    expect(response.status).toBe(422);
    expect(response.body.error.details.fieldErrors.password).toBeDefined();
  });
});

describe('database authentication constraints', () => {
  it('stores unique normalized emails', async () => {
    await request(app).post('/api/auth/register').send(registration).expect(201);

    await expect(
      prisma.user.create({
        data: {
          email: registration.email,
          passwordHash: 'not-a-real-hash',
          firstName: 'Duplicate',
          lastName: 'User',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('uses Prisma decimal values for monetary fields', async () => {
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(registration)
      .expect(201);
    const userId = registerResponse.body.data.user.id as string;
    const workspaceId = registerResponse.body.data.workspaces[0].id as string;

    const purchaseRequest = await prisma.purchaseRequest.create({
      data: {
        workspaceId,
        requestNumber: 'PR-DECIMAL-001',
        title: 'Decimal precision check',
        category: 'operations',
        totalAmount: new Prisma.Decimal('1234.50'),
        requestedById: userId,
      },
    });

    expect(purchaseRequest.totalAmount.toFixed(2)).toBe('1234.50');
    expect(purchaseRequest.totalAmount).toBeInstanceOf(Prisma.Decimal);
  });
});
