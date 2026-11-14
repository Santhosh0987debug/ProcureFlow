import { Permission } from '@procureflow/shared';
import { Router } from 'express';
import {
  approveWorkspaceApproval,
  getWorkspaceApproval,
  listWorkspaceApprovals,
  rejectWorkspaceApproval,
  requestWorkspaceApprovalChanges,
} from '../controllers/approval.controller.js';
import { authorizeWorkspace, authorizeWorkspaceAny } from '../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import {
  approvalParamsSchema,
  approveApprovalSchema,
  listApprovalsQuerySchema,
  rejectApprovalSchema,
  requestApprovalChangesSchema,
  workspaceApprovalParamsSchema,
} from '../validators/approval.schemas.js';

export const approvalRouter = Router({ mergeParams: true });

approvalRouter.get(
  '/',
  validateParams(workspaceApprovalParamsSchema),
  authorizeWorkspace(Permission.ApprovalsRead),
  validateQuery(listApprovalsQuerySchema),
  listWorkspaceApprovals,
);

approvalRouter.get(
  '/:approvalId',
  validateParams(approvalParamsSchema),
  authorizeWorkspaceAny([Permission.ApprovalsRead, Permission.RequestsReadOwn]),
  getWorkspaceApproval,
);

approvalRouter.post(
  '/:approvalId/approve',
  validateParams(approvalParamsSchema),
  authorizeWorkspace(Permission.ApprovalsDecide),
  validateBody(approveApprovalSchema),
  approveWorkspaceApproval,
);

approvalRouter.post(
  '/:approvalId/reject',
  validateParams(approvalParamsSchema),
  authorizeWorkspace(Permission.ApprovalsDecide),
  validateBody(rejectApprovalSchema),
  rejectWorkspaceApproval,
);

approvalRouter.post(
  '/:approvalId/request-changes',
  validateParams(approvalParamsSchema),
  authorizeWorkspace(Permission.ApprovalsDecide),
  validateBody(requestApprovalChangesSchema),
  requestWorkspaceApprovalChanges,
);
