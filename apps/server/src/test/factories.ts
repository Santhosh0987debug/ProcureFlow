import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

const passwordHash = bcrypt.hashSync('StrongPass123', 4);

export function createTestUser(firstName = 'Test', lastName = 'User') {
  return prisma.user.create({
    data: {
      email: `user-${randomUUID()}@example.com`,
      passwordHash,
      firstName,
      lastName,
    },
  });
}

export function createTestWorkspace(createdById: string, name = 'Test Workspace') {
  return prisma.workspace.create({
    data: {
      name,
      slug: `test-${randomUUID()}`,
      createdById,
      members: {
        create: {
          userId: createdById,
          role: 'owner',
        },
      },
    },
  });
}
