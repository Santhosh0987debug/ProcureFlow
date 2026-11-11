import type { ApiSuccessResponse } from './api.js';
import type { AuthSession, AuthWorkspace, WorkspaceRole } from './auth.js';
import type { Permission } from './permissions.js';

export enum MembershipStatus {
  Active = 'active',
  Suspended = 'suspended',
}

export enum InvitationStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Revoked = 'revoked',
  Expired = 'expired',
}

/** How a development invitation link is delivered in the current environment. */
export type InvitationDelivery = 'development_link' | 'email';

export interface WorkspaceMemberSummary {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
  role: WorkspaceRole;
  status: MembershipStatus;
  joinedAt: string;
  suspendedAt: string | null;
  isCurrentUser: boolean;
}

export interface WorkspaceInvitationSummary {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: InvitationStatus;
  invitedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListMembersQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: WorkspaceRole;
  status?: MembershipStatus;
}

export interface ListInvitationsQuery {
  page?: number;
  pageSize?: number;
  status?: InvitationStatus;
}

export interface InviteMemberRequest {
  email: string;
  role: WorkspaceRole;
}

export interface CreateInvitationResult {
  invitation: WorkspaceInvitationSummary;
  delivery: InvitationDelivery;
  /**
   * Development-only one-time link. Production email delivery must not expose
   * invitation tokens in API responses.
   */
  invitationUrl?: string;
  invitationToken?: string;
}

export interface InvitationLinkResult {
  invitation: WorkspaceInvitationSummary;
  invitationUrl: string;
  invitationToken: string;
  expiresAt: string;
}

export interface ChangeMemberRoleRequest {
  role: WorkspaceRole;
}

export interface AcceptInvitationRequest {
  token: string;
}

export interface AcceptInvitationResult {
  session: AuthSession;
  workspace: AuthWorkspace;
  membership: WorkspaceMemberSummary;
}

export interface EffectivePermissions {
  workspaceId: string;
  role: WorkspaceRole;
  permissions: Permission[];
}

export type MemberListResponse = ApiSuccessResponse<PaginatedResult<WorkspaceMemberSummary>>;
export type MemberResponse = ApiSuccessResponse<WorkspaceMemberSummary>;
export type InvitationListResponse = ApiSuccessResponse<
  PaginatedResult<WorkspaceInvitationSummary>
>;
export type InvitationResponse = ApiSuccessResponse<WorkspaceInvitationSummary>;
export type CreateInvitationResponse = ApiSuccessResponse<CreateInvitationResult>;
export type InvitationLinkResponse = ApiSuccessResponse<InvitationLinkResult>;
export type AcceptInvitationResponse = ApiSuccessResponse<AcceptInvitationResult>;
export type EffectivePermissionsResponse = ApiSuccessResponse<EffectivePermissions>;
