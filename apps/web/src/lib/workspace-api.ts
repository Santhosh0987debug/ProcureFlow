import type {
  ChangeMemberRoleRequest,
  CreateInvitationResult,
  InvitationLinkResult,
  ListInvitationsQuery,
  ListMembersQuery,
  PaginatedResult,
  WorkspaceInvitationSummary,
  WorkspaceMemberSummary,
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

export function fetchMembers(
  workspaceId: string,
  query: ListMembersQuery,
  signal?: AbortSignal,
): Promise<PaginatedResult<WorkspaceMemberSummary>> {
  return apiRequest(
    `${workspacePath(workspaceId)}/members${toQueryString({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      role: query.role,
      status: query.status,
    })}`,
    { signal },
  );
}

export function fetchMember(
  workspaceId: string,
  memberId: string,
  signal?: AbortSignal,
): Promise<WorkspaceMemberSummary> {
  return apiRequest(`${workspacePath(workspaceId)}/members/${encodeURIComponent(memberId)}`, {
    signal,
  });
}

export function inviteMember(
  workspaceId: string,
  input: { email: string; role: WorkspaceMemberSummary['role'] },
): Promise<CreateInvitationResult> {
  return apiRequest(`${workspacePath(workspaceId)}/invitations`, {
    method: 'POST',
    body: input,
  });
}

export function changeMemberRole(
  workspaceId: string,
  memberId: string,
  input: ChangeMemberRoleRequest,
): Promise<WorkspaceMemberSummary> {
  return apiRequest(`${workspacePath(workspaceId)}/members/${encodeURIComponent(memberId)}/role`, {
    method: 'PATCH',
    body: input,
  });
}

export function suspendMember(
  workspaceId: string,
  memberId: string,
): Promise<WorkspaceMemberSummary> {
  return apiRequest(
    `${workspacePath(workspaceId)}/members/${encodeURIComponent(memberId)}/suspend`,
    { method: 'POST' },
  );
}

export function reactivateMember(
  workspaceId: string,
  memberId: string,
): Promise<WorkspaceMemberSummary> {
  return apiRequest(
    `${workspacePath(workspaceId)}/members/${encodeURIComponent(memberId)}/reactivate`,
    { method: 'POST' },
  );
}

export function removeMember(workspaceId: string, memberId: string): Promise<void> {
  return apiRequest(`${workspacePath(workspaceId)}/members/${encodeURIComponent(memberId)}`, {
    method: 'DELETE',
  });
}

export function fetchInvitations(
  workspaceId: string,
  query: ListInvitationsQuery,
  signal?: AbortSignal,
): Promise<PaginatedResult<WorkspaceInvitationSummary>> {
  return apiRequest(
    `${workspacePath(workspaceId)}/invitations${toQueryString({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    })}`,
    { signal },
  );
}

export function revokeInvitation(
  workspaceId: string,
  invitationId: string,
): Promise<WorkspaceInvitationSummary> {
  return apiRequest(
    `${workspacePath(workspaceId)}/invitations/${encodeURIComponent(invitationId)}/revoke`,
    { method: 'POST' },
  );
}

export function regenerateInvitationLink(
  workspaceId: string,
  invitationId: string,
): Promise<InvitationLinkResult> {
  return apiRequest(
    `${workspacePath(workspaceId)}/invitations/${encodeURIComponent(invitationId)}/link`,
    { method: 'POST' },
  );
}
