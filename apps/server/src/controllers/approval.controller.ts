import type {
  ApprovalDetail,
  ApprovalHistoryResult,
  ApprovalInboxResult,
} from '@procureflow/shared';
import type { Request, RequestHandler } from 'express';
import { auditContextFromRequest } from '../lib/audit.js';
import { requireAuthenticatedUser } from '../lib/auth-context.js';
import { toWorkspaceRole } from '../lib/roles.js';
import { requireWorkspaceContext } from '../middleware/authorize.js';
import {
  approveApproval,
  getApprovalDetail,
  getRequestApprovalHistory,
  listAssignedApprovals,
  rejectApproval,
  requestApprovalChanges,
} from '../services/approval.service.js';
import type { ApprovalActor } from '../services/approval.service.js';
import type {
  ApproveApprovalInput,
  ListApprovalsQueryInput,
  RejectApprovalInput,
  RequestApprovalChangesInput,
} from '../validators/approval.schemas.js';

function actorFrom(request: Request): ApprovalActor {
  const user = requireAuthenticatedUser(request);
  const workspace = requireWorkspaceContext(request);

  return {
    userId: user.id,
    membershipId: workspace.membership.id,
    role: toWorkspaceRole(workspace.membership.role),
  };
}

export const listWorkspaceApprovals: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const query = request.validatedQuery as ListApprovalsQueryInput;
  const result = await listAssignedApprovals(workspace.id, query, actorFrom(request));

  const body: { data: ApprovalInboxResult } = { data: result };
  response.status(200).json(body);
};

export const getWorkspaceApproval: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const { approvalId } = request.params as { approvalId: string };
  const result = await getApprovalDetail(workspace.id, approvalId, actorFrom(request));

  const body: { data: ApprovalDetail } = { data: result };
  response.status(200).json(body);
};

export const approveWorkspaceApproval: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const { approvalId } = request.params as { approvalId: string };
  const input = request.body as ApproveApprovalInput;
  const result = await approveApproval(
    workspace.id,
    approvalId,
    input.comment ?? null,
    actorFrom(request),
    auditContextFromRequest(request),
  );

  const body: { data: ApprovalDetail } = { data: result };
  response.status(200).json(body);
};

export const rejectWorkspaceApproval: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const { approvalId } = request.params as { approvalId: string };
  const input = request.body as RejectApprovalInput;
  const result = await rejectApproval(
    workspace.id,
    approvalId,
    input.reason,
    actorFrom(request),
    auditContextFromRequest(request),
  );

  const body: { data: ApprovalDetail } = { data: result };
  response.status(200).json(body);
};

export const requestWorkspaceApprovalChanges: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const { approvalId } = request.params as { approvalId: string };
  const input = request.body as RequestApprovalChangesInput;
  const result = await requestApprovalChanges(
    workspace.id,
    approvalId,
    input.explanation,
    actorFrom(request),
    auditContextFromRequest(request),
  );

  const body: { data: ApprovalDetail } = { data: result };
  response.status(200).json(body);
};

export const getWorkspaceRequestApprovalHistory: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const { requestId } = request.params as { requestId: string };
  const result = await getRequestApprovalHistory(workspace.id, requestId, actorFrom(request));

  const body: { data: ApprovalHistoryResult } = { data: result };
  response.status(200).json(body);
};
