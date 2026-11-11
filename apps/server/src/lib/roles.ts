import { MembershipStatus, WorkspaceRole } from '@procureflow/shared';

const workspaceRoles = new Set<string>(Object.values(WorkspaceRole));

/**
 * Resolve a persisted role value to the shared role vocabulary. The `buyer`
 * fallback keeps pre-Phase-3 data and fixtures readable during the migration
 * window; all current writes use the Phase 3 values.
 */
export function toWorkspaceRole(role: string): WorkspaceRole {
  if (workspaceRoles.has(role)) {
    return role as WorkspaceRole;
  }

  if (role === 'buyer') {
    return WorkspaceRole.ProcurementManager;
  }

  return WorkspaceRole.Viewer;
}

export function toMembershipStatus(status: string): MembershipStatus {
  return status === MembershipStatus.Suspended
    ? MembershipStatus.Suspended
    : MembershipStatus.Active;
}
