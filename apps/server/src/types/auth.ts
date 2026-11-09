import type { Prisma } from '@prisma/client';

export type AuthenticatedUser = Prisma.UserGetPayload<{
  include: {
    memberships: {
      include: { workspace: true };
    };
  };
}>;

declare module 'express-serve-static-core' {
  interface Request {
    auth?: {
      user: AuthenticatedUser;
    };
  }
}
