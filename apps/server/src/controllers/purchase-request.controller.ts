import type { PurchaseRequestDetail, PurchaseRequestListResult } from '@procureflow/shared';
import type { Request, RequestHandler } from 'express';
import { auditContextFromRequest } from '../lib/audit.js';
import { requireAuthenticatedUser } from '../lib/auth-context.js';
import { toWorkspaceRole } from '../lib/roles.js';
import { requireWorkspaceContext } from '../middleware/authorize.js';
import {
  createPurchaseRequest,
  deletePurchaseRequest,
  getPurchaseRequestDetail,
  listPurchaseRequests,
  submitPurchaseRequest,
  updatePurchaseRequest,
} from '../services/purchase-request.service.js';
import type { PurchaseRequestActor } from '../services/purchase-request.service.js';
import type {
  CreatePurchaseRequestInput,
  ListPurchaseRequestsQueryInput,
  UpdatePurchaseRequestInput,
} from '../validators/purchase-request.schemas.js';

function actorFrom(request: Request): PurchaseRequestActor {
  const user = requireAuthenticatedUser(request);
  const workspace = requireWorkspaceContext(request);

  return {
    userId: user.id,
    membershipId: workspace.membership.id,
    role: toWorkspaceRole(workspace.membership.role),
  };
}

export const listWorkspacePurchaseRequests: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const query = request.validatedQuery as ListPurchaseRequestsQueryInput;
  const result = await listPurchaseRequests(workspace.id, query, actorFrom(request));

  const body: { data: PurchaseRequestListResult } = { data: result };
  response.status(200).json(body);
};

export const getWorkspacePurchaseRequest: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const { requestId } = request.params as { requestId: string };
  const result = await getPurchaseRequestDetail(workspace.id, requestId, actorFrom(request));

  const body: { data: PurchaseRequestDetail } = { data: result };
  response.status(200).json(body);
};

export const createWorkspacePurchaseRequest: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const input = request.body as CreatePurchaseRequestInput;
  const result = await createPurchaseRequest(
    workspace.id,
    input,
    actorFrom(request),
    auditContextFromRequest(request),
  );

  const body: { data: PurchaseRequestDetail } = { data: result };
  response.status(201).json(body);
};

export const updateWorkspacePurchaseRequest: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const { requestId } = request.params as { requestId: string };
  const input = request.body as UpdatePurchaseRequestInput;
  const result = await updatePurchaseRequest(
    workspace.id,
    requestId,
    input,
    actorFrom(request),
    auditContextFromRequest(request),
  );

  const body: { data: PurchaseRequestDetail } = { data: result };
  response.status(200).json(body);
};

export const deleteWorkspacePurchaseRequest: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const { requestId } = request.params as { requestId: string };

  await deletePurchaseRequest(
    workspace.id,
    requestId,
    actorFrom(request),
    auditContextFromRequest(request),
  );

  response.status(204).send();
};

export const submitWorkspacePurchaseRequest: RequestHandler = async (request, response) => {
  const workspace = requireWorkspaceContext(request);
  const { requestId } = request.params as { requestId: string };
  const result = await submitPurchaseRequest(
    workspace.id,
    requestId,
    actorFrom(request),
    auditContextFromRequest(request),
  );

  const body: { data: PurchaseRequestDetail } = { data: result };
  response.status(200).json(body);
};
