import { Permission } from '@procureflow/shared';
import { Router } from 'express';
import {
  createWorkspacePurchaseRequest,
  deleteWorkspacePurchaseRequest,
  getWorkspacePurchaseRequest,
  listWorkspacePurchaseRequests,
  submitWorkspacePurchaseRequest,
  updateWorkspacePurchaseRequest,
} from '../controllers/purchase-request.controller.js';
import { authorizeWorkspace, authorizeWorkspaceAny } from '../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import {
  createPurchaseRequestSchema,
  listPurchaseRequestsQuerySchema,
  purchaseRequestParamsSchema,
  updatePurchaseRequestSchema,
  workspaceRequestParamsSchema,
} from '../validators/purchase-request.schemas.js';

export const purchaseRequestRouter = Router({ mergeParams: true });

purchaseRequestRouter.get(
  '/',
  validateParams(workspaceRequestParamsSchema),
  authorizeWorkspaceAny([Permission.RequestsRead, Permission.RequestsReadOwn]),
  validateQuery(listPurchaseRequestsQuerySchema),
  listWorkspacePurchaseRequests,
);

purchaseRequestRouter.post(
  '/',
  validateParams(workspaceRequestParamsSchema),
  authorizeWorkspace(Permission.RequestsCreate),
  validateBody(createPurchaseRequestSchema),
  createWorkspacePurchaseRequest,
);

purchaseRequestRouter.get(
  '/:requestId',
  validateParams(purchaseRequestParamsSchema),
  authorizeWorkspaceAny([Permission.RequestsRead, Permission.RequestsReadOwn]),
  getWorkspacePurchaseRequest,
);

purchaseRequestRouter.patch(
  '/:requestId',
  validateParams(purchaseRequestParamsSchema),
  authorizeWorkspace(Permission.RequestsUpdate),
  validateBody(updatePurchaseRequestSchema),
  updateWorkspacePurchaseRequest,
);

purchaseRequestRouter.delete(
  '/:requestId',
  validateParams(purchaseRequestParamsSchema),
  authorizeWorkspace(Permission.RequestsDelete),
  deleteWorkspacePurchaseRequest,
);

purchaseRequestRouter.post(
  '/:requestId/submit',
  validateParams(purchaseRequestParamsSchema),
  authorizeWorkspace(Permission.RequestsSubmit),
  submitWorkspacePurchaseRequest,
);
