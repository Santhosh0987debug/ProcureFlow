import type { ApiSuccessResponse } from './api.js';
import type { Permission } from './permissions.js';
import type { Currency } from './procurement.js';

/**
 * Workspace roles are persisted in lower-case form for stable database values.
 * A member's role always comes from their WorkspaceMember record.
 */
export enum WorkspaceRole {
  Owner = 'owner',
  Admin = 'admin',
  ProcurementManager = 'procurement_manager',
  Requester = 'requester',
  Approver = 'approver',
  Viewer = 'viewer',
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AuthWorkspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  currency: Currency;
  /** Effective permissions for this membership, resolved from the role registry. */
  permissions: Permission[];
}

export interface AuthSession {
  user: AuthUser;
  workspaces: AuthWorkspace[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  workspaceName?: string;
}

export type AuthSessionResponse = ApiSuccessResponse<AuthSession>;

/** Shared password policy used by API validation and the registration form. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
