import type { ApiSuccessResponse } from './api.js';
import type { Currency } from './procurement.js';

export enum WorkspaceRole {
  Owner = 'owner',
  Admin = 'admin',
  Approver = 'approver',
  Buyer = 'buyer',
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
