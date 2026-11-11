import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { MembershipStatus, permissionsForRole } from '@procureflow/shared';
import type { AuthSession, Currency, LoginRequest, RegisterRequest } from '@procureflow/shared';
import { AppError } from '../errors/app-error.js';
import { hashPassword, verifyPasswordWithTimingProtection } from '../lib/password.js';
import { prisma } from '../lib/prisma.js';
import { toWorkspaceRole } from '../lib/roles.js';
import { signSessionToken } from '../lib/session-token.js';
import { toSlug } from '../lib/slug.js';
import type { AuthenticatedUser } from '../types/auth.js';

export const sessionInclude = {
  memberships: {
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.UserInclude;

export interface AuthResult {
  session: AuthSession;
  token: string;
}

function emailInUseError(): AppError {
  return new AppError('An account with this email address already exists.', {
    statusCode: 409,
    code: 'EMAIL_IN_USE',
  });
}

function isUniqueEmailError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }

  const target = error.meta?.target;

  return Array.isArray(target)
    ? target.includes('email')
    : typeof target === 'string' && target.includes('email');
}

function toCurrency(currency: string): Currency {
  return currency as Currency;
}

export function toAuthSession(user: AuthenticatedUser): AuthSession {
  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      jobTitle: user.jobTitle,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    },
    workspaces: user.memberships
      .filter((membership) => membership.status === MembershipStatus.Active)
      .map((membership) => {
        const role = toWorkspaceRole(membership.role);

        return {
          id: membership.workspace.id,
          name: membership.workspace.name,
          slug: membership.workspace.slug,
          role,
          currency: toCurrency(membership.workspace.currency),
          permissions: [...permissionsForRole(role)],
        };
      }),
  };
}

export async function registerUser(input: RegisterRequest): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw emailInUseError();
  }

  const passwordHash = await hashPassword(input.password);
  const workspaceName = input.workspaceName?.trim() || `${firstName}'s Workspace`;
  const workspaceSlug = `${toSlug(workspaceName)}-${randomBytes(3).toString('hex')}`;

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
        },
      });

      const workspace = await transaction.workspace.create({
        data: {
          name: workspaceName,
          slug: workspaceSlug,
          createdById: createdUser.id,
          members: {
            create: {
              userId: createdUser.id,
              role: 'owner',
            },
          },
        },
      });

      await transaction.auditLog.create({
        data: {
          workspaceId: workspace.id,
          actorId: createdUser.id,
          action: 'user.registered',
          entityType: 'user',
          entityId: createdUser.id,
          summary: `${createdUser.firstName} created the workspace.`,
          metadata: { source: 'self-service' },
        },
      });

      return transaction.user.findUniqueOrThrow({
        where: { id: createdUser.id },
        include: sessionInclude,
      });
    });

    const token = await signSessionToken({ userId: user.id, email: user.email });

    return { session: toAuthSession(user), token };
  } catch (error) {
    if (isUniqueEmailError(error)) {
      throw emailInUseError();
    }

    throw error;
  }
}

export async function loginUser(input: LoginRequest): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: sessionInclude,
  });

  const passwordMatches = await verifyPasswordWithTimingProtection(
    input.password,
    user?.passwordHash,
  );

  if (!user || !passwordMatches) {
    throw new AppError('Invalid email or password.', {
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  }

  const authenticatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    include: sessionInclude,
  });

  const token = await signSessionToken({
    userId: authenticatedUser.id,
    email: authenticatedUser.email,
  });

  return { session: toAuthSession(authenticatedUser), token };
}
