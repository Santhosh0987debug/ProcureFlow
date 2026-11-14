import type {
  ApprovalWorkflowDetail,
  ApprovalWorkflowListResult,
  ApprovalWorkflowPreview,
} from '@procureflow/shared';
import type { Request, RequestHandler } from 'express';
import { auditContextFromRequest } from '../lib/audit.js';
import { requireAuthenticatedUser } from '../lib/auth-context.js';
import { toWorkspaceRole } from '../lib/roles.js';
import { requireWorkspaceContext } from '../middleware/authorize.js';
import {
  activateApprovalWorkflow,
  createApprovalWorkflow,
  deactivateApprovalWorkflow,
  deleteApprovalWorkflow,
  getApprovalWorkflowDetail,
  listApprovalWorkflows,
  previewApprovalWorkflow,
  updateApprovalWorkflow,
} from '../services/approval-workflow.service.js';
import type { ApprovalWorkflowActor } from '../services/approval-workflow.service.js';
import type {
  ApprovalWorkflowWriteInput,
  ListApprovalWorkflowsQueryInput,
} from '../validators/approval.schemas.js';

function actorFrom(request: Request): ApprovalWorkflowActor {
  const user = requireAuthenticatedUser(request);
  const workspace = requireWorkspaceContext(request);

  return {
    userId: user.id,
    membershipId: workspace.membership.id,
    role: toWorkspaceRole(workspace.membership.role),
  };
}

export const listWorkspaceApprovalWorkflows: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const query = request.validatedQuery as ListApprovalWorkflowsQueryInput;
  const result = await listApprovalWorkflows(workspace.id, query, actorFrom(request));

  const body: { data: ApprovalWorkflowListResult } = { data: result };
  response.status(200).json(body);
};

export const getWorkspaceApprovalWorkflow: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const { workflowId } = request.params as { workflowId: string };
  const result = await getApprovalWorkflowDetail(workspace.id, workflowId, actorFrom(request));

  const body: { data: ApprovalWorkflowDetail } = { data: result };
  response.status(200).json(body);
};

export const createWorkspaceApprovalWorkflow: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const input = request.body as ApprovalWorkflowWriteInput;
  const result = await createApprovalWorkflow(
    workspace.id,
    input,
    actorFrom(request),
    auditContextFromRequest(request),
  );

  const body: { data: ApprovalWorkflowDetail } = { data: result };
  response.status(201).json(body);
};

export const updateWorkspaceApprovalWorkflow: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const { workflowId } = request.params as { workflowId: string };
  const input = request.body as ApprovalWorkflowWriteInput;
  const result = await updateApprovalWorkflow(
    workspace.id,
    workflowId,
    input,
    actorFrom(request),
    auditContextFromRequest(request),
  );

  const body: { data: ApprovalWorkflowDetail } = { data: result };
  response.status(200).json(body);
};

export const activateWorkspaceApprovalWorkflow: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const { workflowId } = request.params as { workflowId: string };
  const result = await activateApprovalWorkflow(
    workspace.id,
    workflowId,
    actorFrom(request),
    auditContextFromRequest(request),
  );

  const body: { data: ApprovalWorkflowDetail } = { data: result };
  response.status(200).json(body);
};

export const deactivateWorkspaceApprovalWorkflow: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const { workflowId } = request.params as { workflowId: string };
  const result = await deactivateApprovalWorkflow(
    workspace.id,
    workflowId,
    actorFrom(request),
    auditContextFromRequest(request),
  );

  const body: { data: ApprovalWorkflowDetail } = { data: result };
  response.status(200).json(body);
};

export const deleteWorkspaceApprovalWorkflow: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const { workflowId } = request.params as { workflowId: string };

  await deleteApprovalWorkflow(
    workspace.id,
    workflowId,
    actorFrom(request),
    auditContextFromRequest(request),
  );

  response.status(204).send();
};

export const previewWorkspaceApprovalWorkflow: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const input = request.body as ApprovalWorkflowWriteInput;
  const result = await previewApprovalWorkflow(workspace.id, input, actorFrom(request));

  const body: { data: ApprovalWorkflowPreview } = { data: result };
  response.status(200).json(body);
};
