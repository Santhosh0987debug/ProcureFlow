import { Permission } from '@procureflow/shared';
import { Router } from 'express';
import {
  createWorkspaceInvitation,
  listWorkspaceInvitations,
  regenerateWorkspaceInvitationLink,
  revokeWorkspaceInvitation,
} from '../controllers/invitation.controller.js';
import {
  getEffectivePermissions,
  getWorkspaceMember,
  listWorkspaceMembers,
  reactivateWorkspaceMember,
  removeWorkspaceMember,
  suspendWorkspaceMember,
  updateWorkspaceMemberRole,
} from '../controllers/member.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeWorkspace } from '../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { purchaseRequestRouter } from './purchase-request.routes.js';
import {
  changeMemberRoleSchema,
  invitationParamsSchema,
  inviteMemberSchema,
  listInvitationsQuerySchema,
  listMembersQuerySchema,
  memberParamsSchema,
  workspaceParamsSchema,
} from '../validators/workspace.schemas.js';

export const workspaceRouter = Router();

workspaceRouter.use(authenticate);

workspaceRouter.use('/:workspaceId/purchase-requests', purchaseRequestRouter);

workspaceRouter.get(
  '/:workspaceId/members',
  validateParams(workspaceParamsSchema),
  authorizeWorkspace(Permission.MembersRead),
  validateQuery(listMembersQuerySchema),
  listWorkspaceMembers,
);

workspaceRouter.get(
  '/:workspaceId/members/:memberId',
  validateParams(memberParamsSchema),
  authorizeWorkspace(Permission.MembersRead),
  getWorkspaceMember,
);

workspaceRouter.patch(
  '/:workspaceId/members/:memberId/role',
  validateParams(memberParamsSchema),
  authorizeWorkspace(Permission.MembersRoleChange),
  validateBody(changeMemberRoleSchema),
  updateWorkspaceMemberRole,
);

workspaceRouter.post(
  '/:workspaceId/members/:memberId/suspend',
  validateParams(memberParamsSchema),
  authorizeWorkspace(Permission.MembersSuspend),
  suspendWorkspaceMember,
);

workspaceRouter.post(
  '/:workspaceId/members/:memberId/reactivate',
  validateParams(memberParamsSchema),
  authorizeWorkspace(Permission.MembersSuspend),
  reactivateWorkspaceMember,
);

workspaceRouter.delete(
  '/:workspaceId/members/:memberId',
  validateParams(memberParamsSchema),
  authorizeWorkspace(Permission.MembersRemove),
  removeWorkspaceMember,
);

workspaceRouter.get(
  '/:workspaceId/permissions',
  validateParams(workspaceParamsSchema),
  authorizeWorkspace(Permission.WorkspaceRead),
  getEffectivePermissions,
);

workspaceRouter.get(
  '/:workspaceId/invitations',
  validateParams(workspaceParamsSchema),
  authorizeWorkspace(Permission.MembersRead),
  validateQuery(listInvitationsQuerySchema),
  listWorkspaceInvitations,
);

workspaceRouter.post(
  '/:workspaceId/invitations',
  validateParams(workspaceParamsSchema),
  authorizeWorkspace(Permission.MembersInvite),
  validateBody(inviteMemberSchema),
  createWorkspaceInvitation,
);

workspaceRouter.post(
  '/:workspaceId/invitations/:invitationId/revoke',
  validateParams(invitationParamsSchema),
  authorizeWorkspace(Permission.MembersInvite),
  revokeWorkspaceInvitation,
);

workspaceRouter.post(
  '/:workspaceId/invitations/:invitationId/link',
  validateParams(invitationParamsSchema),
  authorizeWorkspace(Permission.MembersInvite),
  regenerateWorkspaceInvitationLink,
);
