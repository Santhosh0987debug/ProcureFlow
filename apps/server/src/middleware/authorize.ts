import type { Permission } from '@procureflow/shared';
import { MembershipStatus, roleHasPermission } from '@procureflow/shared';
import type { Request, RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';
import { requireAuthenticatedUser } from '../lib/auth-context.js';
import { toWorkspaceRole } from '../lib/roles.js';
import type { WorkspaceAuthorizationContext } from '../types/auth.js';

function workspaceNotFoundError(): AppError {
  return new AppError('Workspace not found or you no longer have access to it.', {
    statusCode: 404,
    code: 'WORKSPACE_NOT_FOUND',
  });
}

/**
 * Resolve the current user's membership from the authenticated session and
 * enforce the workspace-scoped permission. A missing membership and a
 * non-existent workspace intentionally share the same 404 response to avoid
 * leaking workspace existence across tenants.
 */
export function requireWorkspaceAuthorization(
  request: Request,
  permission?: Permission | readonly Permission[],
): WorkspaceAuthorizationContext {
  const user = requireAuthenticatedUser(request);
  const workspaceId = request.params.workspaceId;

  if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
    throw workspaceNotFoundError();
  }

  const membership = user.memberships.find((entry) => entry.workspaceId === workspaceId);

  if (!membership) {
    throw workspaceNotFoundError();
  }

  if (membership.status !== MembershipStatus.Active) {
    throw new AppError('Your workspace access has been suspended. Contact a workspace owner.', {
      statusCode: 403,
      code: 'MEMBERSHIP_SUSPENDED',
    });
  }

  if (permission) {
    const requiredPermissions = Array.isArray(permission) ? permission : [permission];
    const role = toWorkspaceRole(membership.role);

    if (!requiredPermissions.some((entry) => roleHasPermission(role, entry))) {
      throw new AppError('You do not have permission to perform this action.', {
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    }
  }

  return { id: workspaceId, membership };
}

export function authorizeWorkspace(permission: Permission): RequestHandler {
  return (request, _response, next) => {
    try {
      request.workspace = requireWorkspaceAuthorization(request, permission);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Accept any one of the supplied permissions. Used where a workspace-wide read
 * permission and an ownership-scoped read permission both unlock the route.
 */
export function authorizeWorkspaceAny(permissions: readonly Permission[]): RequestHandler {
  return (request, _response, next) => {
    try {
      request.workspace = requireWorkspaceAuthorization(request, permissions);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireWorkspaceContext(request: Request): WorkspaceAuthorizationContext {
  return request.workspace ?? requireWorkspaceAuthorization(request);
}
