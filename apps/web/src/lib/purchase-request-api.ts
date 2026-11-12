import type {
  CreatePurchaseRequestRequest,
  ListPurchaseRequestsQuery,
  PurchaseRequestDetail,
  PurchaseRequestListResult,
  UpdatePurchaseRequestRequest,
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

function requestPath(workspaceId: string, requestId: string): string {
  return `${workspacePath(workspaceId)}/purchase-requests/${encodeURIComponent(requestId)}`;
}

export function fetchPurchaseRequests(
  workspaceId: string,
  query: ListPurchaseRequestsQuery,
  signal?: AbortSignal,
): Promise<PurchaseRequestListResult> {
  return apiRequest(
    `${workspacePath(workspaceId)}/purchase-requests${toQueryString({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      status: query.status,
      requesterId: query.requesterId,
      category: query.category,
      priority: query.priority,
      department: query.department,
      from: query.from,
      to: query.to,
    })}`,
    { signal },
  );
}

export function fetchPurchaseRequest(
  workspaceId: string,
  requestId: string,
  signal?: AbortSignal,
): Promise<PurchaseRequestDetail> {
  return apiRequest(requestPath(workspaceId, requestId), { signal });
}

export function createPurchaseRequest(
  workspaceId: string,
  input: CreatePurchaseRequestRequest,
): Promise<PurchaseRequestDetail> {
  return apiRequest(`${workspacePath(workspaceId)}/purchase-requests`, {
    method: 'POST',
    body: input,
  });
}

export function updatePurchaseRequest(
  workspaceId: string,
  requestId: string,
  input: UpdatePurchaseRequestRequest,
): Promise<PurchaseRequestDetail> {
  return apiRequest(requestPath(workspaceId, requestId), {
    method: 'PATCH',
    body: input,
  });
}

export function deletePurchaseRequest(workspaceId: string, requestId: string): Promise<void> {
  return apiRequest(requestPath(workspaceId, requestId), {
    method: 'DELETE',
  });
}

export function submitPurchaseRequest(
  workspaceId: string,
  requestId: string,
): Promise<PurchaseRequestDetail> {
  return apiRequest(`${requestPath(workspaceId, requestId)}/submit`, {
    method: 'POST',
  });
}
