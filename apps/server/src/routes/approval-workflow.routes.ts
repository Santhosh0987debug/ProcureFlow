import { Permission } from '@procureflow/shared';
import { Router } from 'express';
import {
  activateWorkspaceApprovalWorkflow,
  createWorkspaceApprovalWorkflow,
  deactivateWorkspaceApprovalWorkflow,
  deleteWorkspaceApprovalWorkflow,
  getWorkspaceApprovalWorkflow,
  listWorkspaceApprovalWorkflows,
  previewWorkspaceApprovalWorkflow,
  updateWorkspaceApprovalWorkflow,
} from '../controllers/approval-workflow.controller.js';
import { authorizeWorkspace } from '../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import {
  approvalWorkflowParamsSchema,
  approvalWorkflowWriteSchema,
  listApprovalWorkflowsQuerySchema,
  workspaceApprovalParamsSchema,
} from '../validators/approval.schemas.js';

export const approvalWorkflowRouter = Router({ mergeParams: true });

approvalWorkflowRouter.get(
  '/',
  validateParams(workspaceApprovalParamsSchema),
  authorizeWorkspace(Permission.ApprovalWorkflowsRead),
  validateQuery(listApprovalWorkflowsQuerySchema),
  listWorkspaceApprovalWorkflows,
);

approvalWorkflowRouter.post(
  '/preview',
  validateParams(workspaceApprovalParamsSchema),
  authorizeWorkspace(Permission.ApprovalWorkflowsManage),
  validateBody(approvalWorkflowWriteSchema),
  previewWorkspaceApprovalWorkflow,
);

approvalWorkflowRouter.post(
  '/',
  validateParams(workspaceApprovalParamsSchema),
  authorizeWorkspace(Permission.ApprovalWorkflowsManage),
  validateBody(approvalWorkflowWriteSchema),
  createWorkspaceApprovalWorkflow,
);

approvalWorkflowRouter.get(
  '/:workflowId',
  validateParams(approvalWorkflowParamsSchema),
  authorizeWorkspace(Permission.ApprovalWorkflowsRead),
  getWorkspaceApprovalWorkflow,
);

approvalWorkflowRouter.put(
  '/:workflowId',
  validateParams(approvalWorkflowParamsSchema),
  authorizeWorkspace(Permission.ApprovalWorkflowsManage),
  validateBody(approvalWorkflowWriteSchema),
  updateWorkspaceApprovalWorkflow,
);

approvalWorkflowRouter.delete(
  '/:workflowId',
  validateParams(approvalWorkflowParamsSchema),
  authorizeWorkspace(Permission.ApprovalWorkflowsManage),
  deleteWorkspaceApprovalWorkflow,
);

approvalWorkflowRouter.post(
  '/:workflowId/activate',
  validateParams(approvalWorkflowParamsSchema),
  authorizeWorkspace(Permission.ApprovalWorkflowsManage),
  activateWorkspaceApprovalWorkflow,
);

approvalWorkflowRouter.post(
  '/:workflowId/deactivate',
  validateParams(approvalWorkflowParamsSchema),
  authorizeWorkspace(Permission.ApprovalWorkflowsManage),
  deactivateWorkspaceApprovalWorkflow,
);
