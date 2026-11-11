import { Permission } from '@procureflow/shared';
import type {
  ChangeMemberRoleRequest,
  EffectivePermissionsResponse,
  MemberListResponse,
  MemberResponse,
} from '@procureflow/shared';
import type { Request, RequestHandler } from 'express';
import { requireAuthenticatedUser } from '../lib/auth-context.js';
import { auditContextFromRequest } from '../lib/audit.js';
import { requireWorkspaceContext } from '../middleware/authorize.js';
import { toWorkspaceRole } from '../lib/roles.js';
import {
  changeMemberRole,
  effectivePermissions,
  getMember,
  listMembers,
  reactivateMember,
  removeMember,
  suspendMember,
} from '../services/member.service.js';
import type { WorkspaceActor } from '../services/member.service.js';
import type { ListMembersQueryInput } from '../validators/workspace.schemas.js';

function actorFrom(request: Request): WorkspaceActor {
  const user = requireAuthenticatedUser(request);
  const workspace = requireWorkspaceContext(request);

  return {
    userId: user.id,
    membershipId: workspace.membership.id,
    role: toWorkspaceRole(workspace.membership.role),
  };
}

export const listWorkspaceMembers: RequestHandler = async (request, response) => {
  const user = requireAuthenticatedUser(request);
  const workspace = requireWorkspaceContext(request);
  const query = request.validatedQuery as ListMembersQueryInput;

  const members = await listMembers(workspace.id, query, user.id);

  const body: MemberListResponse = { data: members };
  response.status(200).json(body);
};

export const getWorkspaceMember: RequestHandler = async (request, response) => {
  const user = requireAuthenticatedUser(request);
  const workspace = requireWorkspaceContext(request);

  const { memberId } = request.params as { memberId: string };
  const member = await getMember(workspace.id, memberId, user.id);

  const body: MemberResponse = { data: member };
  response.status(200).json(body);
};

export const updateWorkspaceMemberRole: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const input = request.body as ChangeMemberRoleRequest;

  const { memberId } = request.params as { memberId: string };
  const member = await changeMemberRole(
    workspace.id,
    memberId,
    input.role,
    actorFrom(request),
    auditContextFromRequest(request),
  );

  const body: MemberResponse = { data: member };
  response.status(200).json(body);
};

export const suspendWorkspaceMember: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);

  const { memberId } = request.params as { memberId: string };
  const member = await suspendMember(
    workspace.id,
    memberId,
    actorFrom(request),
    auditContextFromRequest(request),
  );

  const body: MemberResponse = { data: member };
  response.status(200).json(body);
};

export const reactivateWorkspaceMember: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);

  const { memberId } = request.params as { memberId: string };
  const member = await reactivateMember(
    workspace.id,
    memberId,
    actorFrom(request),
    auditContextFromRequest(request),
  );

  const body: MemberResponse = { data: member };
  response.status(200).json(body);
};

export const removeWorkspaceMember: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);

  const { memberId } = request.params as { memberId: string };
  await removeMember(workspace.id, memberId, actorFrom(request), auditContextFromRequest(request));

  response.status(204).end();
};

export const getEffectivePermissions: RequestHandler = (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const role = toWorkspaceRole(workspace.membership.role);

  const body: EffectivePermissionsResponse = {
    data: {
      workspaceId: workspace.id,
      role,
      permissions: effectivePermissions(role),
    },
  };

  response.status(200).json(body);
};

export const memberPermissions = {
  read: Permission.MembersRead,
  invite: Permission.MembersInvite,
  roleChange: Permission.MembersRoleChange,
  suspend: Permission.MembersSuspend,
  remove: Permission.MembersRemove,
} as const;
