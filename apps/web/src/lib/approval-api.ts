import type {
  ApprovalDetail,
  ApprovalHistoryResult,
  ApprovalInboxResult,
  ApprovalWorkflowDetail,
  ApprovalWorkflowListResult,
  ApprovalWorkflowPreview,
  ApprovalWorkflowWriteRequest,
  ApproveApprovalRequest,
  ListApprovalWorkflowsQuery,
  ListApprovalsQuery,
  RejectApprovalRequest,
  RequestApprovalChangesRequest,
} from '@procureflow/shared';
import { apiRequest } from './api';

function toQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

function workspacePath(workspaceId: string): string {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}`;
}

function approvalPath(workspaceId: string, approvalId: string): string {
  return `${workspacePath(workspaceId)}/approvals/${encodeURIComponent(approvalId)}`;
}

function workflowPath(workspaceId: string, workflowId: string): string {
  return `${workspacePath(workspaceId)}/approval-workflows/${encodeURIComponent(workflowId)}`;
}

export function fetchApprovals(
  workspaceId: string,
  query: ListApprovalsQuery,
  signal?: AbortSignal,
): Promise<ApprovalInboxResult> {
  return apiRequest(
    `${workspacePath(workspaceId)}/approvals${toQueryString({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      status: query.status,
      priority: query.priority,
      requester: query.requester,
      requesterId: query.requesterId,
      minAmount: query.minAmount,
      maxAmount: query.maxAmount,
      from: query.from,
      to: query.to,
    })}`,
    { signal },
  );
}

export function fetchApproval(
  workspaceId: string,
  approvalId: string,
  signal?: AbortSignal,
): Promise<ApprovalDetail> {
  return apiRequest(approvalPath(workspaceId, approvalId), { signal });
}

export function approveApprovalRequest(
  workspaceId: string,
  approvalId: string,
  input: ApproveApprovalRequest,
): Promise<ApprovalDetail> {
  return apiRequest(`${approvalPath(workspaceId, approvalId)}/approve`, {
    method: 'POST',
    body: input,
  });
}

export function rejectApprovalRequest(
  workspaceId: string,
  approvalId: string,
  input: RejectApprovalRequest,
): Promise<ApprovalDetail> {
  return apiRequest(`${approvalPath(workspaceId, approvalId)}/reject`, {
    method: 'POST',
    body: input,
  });
}

export function requestApprovalChanges(
  workspaceId: string,
  approvalId: string,
  input: RequestApprovalChangesRequest,
): Promise<ApprovalDetail> {
  return apiRequest(`${approvalPath(workspaceId, approvalId)}/request-changes`, {
    method: 'POST',
    body: input,
  });
}

export function fetchRequestApprovalHistory(
  workspaceId: string,
  requestId: string,
  signal?: AbortSignal,
): Promise<ApprovalHistoryResult> {
  return apiRequest(
    `${workspacePath(workspaceId)}/purchase-requests/${encodeURIComponent(requestId)}/approvals`,
    { signal },
  );
}

export function fetchApprovalWorkflows(
  workspaceId: string,
  query: ListApprovalWorkflowsQuery,
  signal?: AbortSignal,
): Promise<ApprovalWorkflowListResult> {
  return apiRequest(
    `${workspacePath(workspaceId)}/approval-workflows${toQueryString({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      status: query.status,
    })}`,
    { signal },
  );
}

export function fetchApprovalWorkflow(
  workspaceId: string,
  workflowId: string,
  signal?: AbortSignal,
): Promise<ApprovalWorkflowDetail> {
  return apiRequest(workflowPath(workspaceId, workflowId), { signal });
}

export function createApprovalWorkflow(
  workspaceId: string,
  input: ApprovalWorkflowWriteRequest,
): Promise<ApprovalWorkflowDetail> {
  return apiRequest(`${workspacePath(workspaceId)}/approval-workflows`, {
    method: 'POST',
    body: input,
  });
}

export function updateApprovalWorkflow(
  workspaceId: string,
  workflowId: string,
  input: ApprovalWorkflowWriteRequest,
): Promise<ApprovalWorkflowDetail> {
  return apiRequest(workflowPath(workspaceId, workflowId), {
    method: 'PUT',
    body: input,
  });
}

export function previewApprovalWorkflow(
  workspaceId: string,
  input: ApprovalWorkflowWriteRequest,
): Promise<ApprovalWorkflowPreview> {
  return apiRequest(`${workspacePath(workspaceId)}/approval-workflows/preview`, {
    method: 'POST',
    body: input,
  });
}

export function activateApprovalWorkflow(
  workspaceId: string,
  workflowId: string,
): Promise<ApprovalWorkflowDetail> {
  return apiRequest(`${workflowPath(workspaceId, workflowId)}/activate`, {
    method: 'POST',
  });
}

export function deactivateApprovalWorkflow(
  workspaceId: string,
  workflowId: string,
): Promise<ApprovalWorkflowDetail> {
  return apiRequest(`${workflowPath(workspaceId, workflowId)}/deactivate`, {
    method: 'POST',
  });
}

export function deleteApprovalWorkflow(workspaceId: string, workflowId: string): Promise<void> {
  return apiRequest(workflowPath(workspaceId, workflowId), {
    method: 'DELETE',
  });
}
