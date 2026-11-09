import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { env } from '../config/env.js';
import {
  hashPassword,
  verifyPassword,
  verifyPasswordWithTimingProtection,
} from '../lib/password.js';

describe('password hashing', () => {
  it('hashes passwords with bcrypt and verifies them without storing plaintext', async () => {
    const password = 'StrongPass123';
    const passwordHash = await hashPassword(password);

    expect(passwordHash).not.toBe(password);
    expect(passwordHash).not.toContain(password);
    expect(bcrypt.getRounds(passwordHash)).toBe(env.bcryptRounds);
    expect(await verifyPassword(password, passwordHash)).toBe(true);
    expect(await verifyPassword('WrongPass123', passwordHash)).toBe(false);
  });

  it('uses a dummy hash when no account exists to reduce timing differences', async () => {
    expect(await verifyPasswordWithTimingProtection('StrongPass123', undefined)).toBe(false);
  });
});
