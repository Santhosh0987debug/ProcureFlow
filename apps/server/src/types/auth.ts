import type { Prisma } from '@prisma/client';

export type AuthenticatedUser = Prisma.UserGetPayload<{
  include: {
    memberships: {
      include: { workspace: true };
    };
  };
}>;

export type AuthenticatedMembership = AuthenticatedUser['memberships'][number];

export interface WorkspaceAuthorizationContext {
  id: string;
  membership: AuthenticatedMembership;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: {
      user: AuthenticatedUser;
    };
    workspace?: WorkspaceAuthorizationContext;
    validatedQuery?: unknown;
  }
}
