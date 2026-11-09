import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

/**
 * A real bcrypt hash used to keep login timing similar when an email is unknown.
 * It is deliberately not a credential for any account.
 */
const DUMMY_PASSWORD_HASH = '$2b$12$zQpPNyS.s3bW3Lj/ZihsXOzJCRtPmlmwsDAv/zfa7/8ypL0jY1ga.';

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.bcryptRounds);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function verifyPasswordWithTimingProtection(
  password: string,
  passwordHash: string | undefined,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash ?? DUMMY_PASSWORD_HASH);
}
