import { Permission } from '@procureflow/shared';
import type {
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  CreateInvitationResponse,
  InvitationListResponse,
  InvitationLinkResponse,
  InvitationResponse,
  InviteMemberRequest,
} from '@procureflow/shared';
import type { Request, RequestHandler } from 'express';
import { requireAuthenticatedUser } from '../lib/auth-context.js';
import { auditContextFromRequest } from '../lib/audit.js';
import { requireWorkspaceContext } from '../middleware/authorize.js';
import { toWorkspaceRole } from '../lib/roles.js';
import {
  acceptInvitation,
  createInvitation,
  listInvitations,
  reissueInvitationLink,
  revokeInvitation,
} from '../services/invitation.service.js';
import type { WorkspaceActor } from '../services/member.service.js';
import type { ListInvitationsQueryInput } from '../validators/workspace.schemas.js';

function actorFrom(request: Request): WorkspaceActor {
  const user = requireAuthenticatedUser(request);
  const workspace = requireWorkspaceContext(request);

  return {
    userId: user.id,
    membershipId: workspace.membership.id,
    role: toWorkspaceRole(workspace.membership.role),
  };
}

export const listWorkspaceInvitations: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const query = request.validatedQuery as ListInvitationsQueryInput;

  const invitations = await listInvitations(workspace.id, query);

  const body: InvitationListResponse = { data: invitations };
  response.status(200).json(body);
};

export const createWorkspaceInvitation: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const input = request.body as InviteMemberRequest;

  const result = await createInvitation(
    workspace.id,
    input,
    actorFrom(request),
    auditContextFromRequest(request),
  );

  const body: CreateInvitationResponse = { data: result };
  response.status(201).json(body);
};

export const revokeWorkspaceInvitation: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);

  const { invitationId } = request.params as { invitationId: string };
  const invitation = await revokeInvitation(
    workspace.id,
    invitationId,
    auditContextFromRequest(request),
  );

  const body: InvitationResponse = { data: invitation };
  response.status(200).json(body);
};

export const regenerateWorkspaceInvitationLink: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);

  const { invitationId } = request.params as { invitationId: string };
  const result = await reissueInvitationLink(
    workspace.id,
    invitationId,
    auditContextFromRequest(request),
  );

  const body: InvitationLinkResponse = { data: result };
  response.status(200).json(body);
};

export const acceptWorkspaceInvitation: RequestHandler = async (request, response) => {
  const user = requireAuthenticatedUser(request);
  const input = request.body as AcceptInvitationRequest;

  const result = await acceptInvitation(input.token, user, auditContextFromRequest(request));

  const body: AcceptInvitationResponse = { data: result };
  response.status(200).json(body);
};

export const invitationPermissions = {
  read: Permission.MembersRead,
  invite: Permission.MembersInvite,
} as const;
