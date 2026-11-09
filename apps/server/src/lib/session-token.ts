import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const secretKey = new TextEncoder().encode(env.jwtSecret);

export interface SessionTokenPayload {
  userId: string;
  email: string;
}

export function signSessionToken(payload: SessionTokenPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.userId)
    .setIssuer(env.jwtIssuer)
    .setAudience(env.jwtAudience)
    .setIssuedAt()
    .setExpirationTime(`${env.sessionTtlHours}h`)
    .sign(secretKey);
}

export async function verifySessionToken(token: string): Promise<SessionTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
      clockTolerance: 5,
    });

    if (!payload.sub || typeof payload.email !== 'string') {
      return null;
    }

    return { userId: payload.sub, email: payload.email };
  } catch {
    // Expired, malformed and incorrectly signed tokens are all treated as unauthenticated.
    return null;
  }
}
