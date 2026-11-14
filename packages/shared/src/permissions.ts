import { WorkspaceRole } from './auth.js';

/**
 * Granular workspace permissions. These values are the single source of truth
 * for both the API policy layer and the web visibility rules.
 */
export enum Permission {
  WorkspaceRead = 'workspace:read',
  WorkspaceManage = 'workspace:manage',

  MembersRead = 'members:read',
  MembersInvite = 'members:invite',
  MembersRoleChange = 'members:role_change',
  MembersSuspend = 'members:suspend',
  MembersRemove = 'members:remove',

  VendorsRead = 'vendors:read',
  VendorsManage = 'vendors:manage',

  RequestsRead = 'requests:read',
  RequestsReadOwn = 'requests:read_own',
  RequestsCreate = 'requests:create',
  RequestsUpdate = 'requests:update',
  RequestsDelete = 'requests:delete',
  RequestsSubmit = 'requests:submit',

  ApprovalsRead = 'approvals:read',
  ApprovalsDecide = 'approvals:decide',
  ApprovalWorkflowsRead = 'approval_workflows:read',
  ApprovalWorkflowsManage = 'approval_workflows:manage',

  QuotationsRead = 'quotations:read',
  QuotationsManage = 'quotations:manage',

  PurchaseOrdersRead = 'purchase_orders:read',
  PurchaseOrdersManage = 'purchase_orders:manage',

  DeliveriesRead = 'deliveries:read',
  DeliveriesManage = 'deliveries:manage',

  ReportsRead = 'reports:read',
  AuditLogsRead = 'audit_logs:read',
}

export type PermissionGroup =
  | 'Workspace'
  | 'Members'
  | 'Vendors'
  | 'Purchase requests'
  | 'Approvals'
  | 'Quotations'
  | 'Purchase orders'
  | 'Deliveries'
  | 'Insights';

export interface PermissionDefinition {
  permission: Permission;
  label: string;
  description: string;
  group: PermissionGroup;
}

export const PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    permission: Permission.WorkspaceRead,
    label: 'View workspace',
    description: 'Open the workspace and read permitted procurement information.',
    group: 'Workspace',
  },
  {
    permission: Permission.WorkspaceManage,
    label: 'Manage workspace settings',
    description: 'Change workspace-level settings and administrative configuration.',
    group: 'Workspace',
  },
  {
    permission: Permission.MembersRead,
    label: 'View members',
    description: 'See the workspace member directory and membership details.',
    group: 'Members',
  },
  {
    permission: Permission.MembersInvite,
    label: 'Invite members',
    description: 'Create one-time invitations for new workspace members.',
    group: 'Members',
  },
  {
    permission: Permission.MembersRoleChange,
    label: 'Change roles',
    description: 'Assign workspace roles within the permitted role hierarchy.',
    group: 'Members',
  },
  {
    permission: Permission.MembersSuspend,
    label: 'Suspend members',
    description: 'Temporarily remove a member’s workspace access.',
    group: 'Members',
  },
  {
    permission: Permission.MembersRemove,
    label: 'Remove members',
    description: 'Permanently remove a member from the workspace.',
    group: 'Members',
  },
  {
    permission: Permission.VendorsRead,
    label: 'View vendors',
    description: 'Read vendor records in the workspace.',
    group: 'Vendors',
  },
  {
    permission: Permission.VendorsManage,
    label: 'Manage vendors',
    description: 'Create and update vendor records.',
    group: 'Vendors',
  },
  {
    permission: Permission.RequestsRead,
    label: 'View all requests',
    description: 'Read purchase requests across the workspace.',
    group: 'Purchase requests',
  },
  {
    permission: Permission.RequestsReadOwn,
    label: 'View own requests',
    description: 'Read purchase requests created by the signed-in member.',
    group: 'Purchase requests',
  },
  {
    permission: Permission.RequestsCreate,
    label: 'Create requests',
    description: 'Create new purchase requests.',
    group: 'Purchase requests',
  },
  {
    permission: Permission.RequestsUpdate,
    label: 'Edit requests',
    description: 'Edit purchase requests within the member’s permitted scope.',
    group: 'Purchase requests',
  },
  {
    permission: Permission.RequestsDelete,
    label: 'Delete requests',
    description: 'Delete purchase requests within the member’s permitted scope.',
    group: 'Purchase requests',
  },
  {
    permission: Permission.RequestsSubmit,
    label: 'Submit requests',
    description: 'Submit eligible draft purchase requests for approval.',
    group: 'Purchase requests',
  },
  {
    permission: Permission.ApprovalsRead,
    label: 'View approvals',
    description: 'Read assigned approval work and approval history.',
    group: 'Approvals',
  },
  {
    permission: Permission.ApprovalsDecide,
    label: 'Decide approvals',
    description: 'Perform approval actions when approval workflows are enabled.',
    group: 'Approvals',
  },
  {
    permission: Permission.ApprovalWorkflowsRead,
    label: 'View approval workflows',
    description: 'Read approval workflow configuration, levels, and assignees.',
    group: 'Approvals',
  },
  {
    permission: Permission.ApprovalWorkflowsManage,
    label: 'Manage approval workflows',
    description: 'Create, edit, activate, deactivate, and remove approval workflows.',
    group: 'Approvals',
  },
  {
    permission: Permission.QuotationsRead,
    label: 'View quotations',
    description: 'Read quotations and sourcing responses.',
    group: 'Quotations',
  },
  {
    permission: Permission.QuotationsManage,
    label: 'Manage quotations',
    description: 'Create, update, and select quotations.',
    group: 'Quotations',
  },
  {
    permission: Permission.PurchaseOrdersRead,
    label: 'View purchase orders',
    description: 'Read purchase orders and commitments.',
    group: 'Purchase orders',
  },
  {
    permission: Permission.PurchaseOrdersManage,
    label: 'Manage purchase orders',
    description: 'Create and update purchase orders.',
    group: 'Purchase orders',
  },
  {
    permission: Permission.DeliveriesRead,
    label: 'View deliveries',
    description: 'Read delivery schedules and receiving records.',
    group: 'Deliveries',
  },
  {
    permission: Permission.DeliveriesManage,
    label: 'Manage deliveries',
    description: 'Create and update delivery records.',
    group: 'Deliveries',
  },
  {
    permission: Permission.ReportsRead,
    label: 'View reports',
    description: 'Read spend, performance, and procurement reports.',
    group: 'Insights',
  },
  {
    permission: Permission.AuditLogsRead,
    label: 'View audit logs',
    description: 'Read the workspace’s append-only security and activity history.',
    group: 'Insights',
  },
];

export const ALL_PERMISSIONS: readonly Permission[] = PERMISSION_DEFINITIONS.map(
  (definition) => definition.permission,
);

const ownerPermissions = ALL_PERMISSIONS;

const adminPermissions: readonly Permission[] = [
  Permission.WorkspaceRead,
  Permission.WorkspaceManage,
  Permission.MembersRead,
  Permission.MembersInvite,
  Permission.MembersRoleChange,
  Permission.MembersSuspend,
  Permission.MembersRemove,
  Permission.VendorsRead,
  Permission.VendorsManage,
  Permission.RequestsRead,
  Permission.RequestsCreate,
  Permission.RequestsUpdate,
  Permission.RequestsDelete,
  Permission.RequestsSubmit,
  Permission.ApprovalsRead,
  Permission.ApprovalsDecide,
  Permission.ApprovalWorkflowsRead,
  Permission.ApprovalWorkflowsManage,
  Permission.QuotationsRead,
  Permission.QuotationsManage,
  Permission.PurchaseOrdersRead,
  Permission.PurchaseOrdersManage,
  Permission.DeliveriesRead,
  Permission.DeliveriesManage,
  Permission.ReportsRead,
  Permission.AuditLogsRead,
];

const procurementManagerPermissions: readonly Permission[] = [
  Permission.WorkspaceRead,
  Permission.MembersRead,
  Permission.VendorsRead,
  Permission.VendorsManage,
  Permission.RequestsRead,
  Permission.RequestsCreate,
  Permission.RequestsUpdate,
  Permission.RequestsDelete,
  Permission.RequestsSubmit,
  Permission.ApprovalsRead,
  Permission.ApprovalsDecide,
  Permission.ApprovalWorkflowsRead,
  Permission.ApprovalWorkflowsManage,
  Permission.QuotationsRead,
  Permission.QuotationsManage,
  Permission.PurchaseOrdersRead,
  Permission.PurchaseOrdersManage,
  Permission.DeliveriesRead,
  Permission.DeliveriesManage,
  Permission.ReportsRead,
];

const requesterPermissions: readonly Permission[] = [
  Permission.WorkspaceRead,
  Permission.VendorsRead,
  Permission.RequestsReadOwn,
  Permission.RequestsCreate,
  Permission.RequestsUpdate,
  Permission.RequestsDelete,
  Permission.RequestsSubmit,
  Permission.QuotationsRead,
  Permission.PurchaseOrdersRead,
  Permission.DeliveriesRead,
];

const approverPermissions: readonly Permission[] = [
  Permission.WorkspaceRead,
  Permission.VendorsRead,
  Permission.RequestsRead,
  Permission.ApprovalsRead,
  Permission.ApprovalsDecide,
  Permission.QuotationsRead,
  Permission.PurchaseOrdersRead,
  Permission.DeliveriesRead,
];

const viewerPermissions: readonly Permission[] = [
  Permission.WorkspaceRead,
  Permission.VendorsRead,
  Permission.RequestsRead,
  Permission.QuotationsRead,
  Permission.PurchaseOrdersRead,
  Permission.DeliveriesRead,
  Permission.ReportsRead,
];

/** Role-to-permission mapping used by both the API and the web workspace. */
export const ROLE_PERMISSIONS: Readonly<Record<WorkspaceRole, readonly Permission[]>> = {
  [WorkspaceRole.Owner]: ownerPermissions,
  [WorkspaceRole.Admin]: adminPermissions,
  [WorkspaceRole.ProcurementManager]: procurementManagerPermissions,
  [WorkspaceRole.Requester]: requesterPermissions,
  [WorkspaceRole.Approver]: approverPermissions,
  [WorkspaceRole.Viewer]: viewerPermissions,
};

/**
 * Management rank. Higher ranks can administer lower ranks; the API applies
 * additional rules for owners, self-management, and the last active owner.
 */
export const ROLE_RANK: Readonly<Record<WorkspaceRole, number>> = {
  [WorkspaceRole.Owner]: 60,
  [WorkspaceRole.Admin]: 50,
  [WorkspaceRole.ProcurementManager]: 40,
  [WorkspaceRole.Approver]: 30,
  [WorkspaceRole.Requester]: 20,
  [WorkspaceRole.Viewer]: 10,
};

export const ROLE_LABELS: Readonly<Record<WorkspaceRole, string>> = {
  [WorkspaceRole.Owner]: 'Owner',
  [WorkspaceRole.Admin]: 'Admin',
  [WorkspaceRole.ProcurementManager]: 'Procurement manager',
  [WorkspaceRole.Requester]: 'Requester',
  [WorkspaceRole.Approver]: 'Approver',
  [WorkspaceRole.Viewer]: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Readonly<Record<WorkspaceRole, string>> = {
  [WorkspaceRole.Owner]: 'Full workspace control, including ownership and member administration.',
  [WorkspaceRole.Admin]:
    'Workspace settings and member administration, excluding ownership changes.',
  [WorkspaceRole.ProcurementManager]:
    'Manages vendors, purchase requests, sourcing, purchase orders, and deliveries.',
  [WorkspaceRole.Requester]: 'Creates and manages their own purchase requests.',
  [WorkspaceRole.Approver]:
    'Reviews assigned approvals and can perform permitted approval actions.',
  [WorkspaceRole.Viewer]: 'Read-only access to permitted workspace information.',
};

export function permissionsForRole(role: WorkspaceRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(role: WorkspaceRole, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}

export function roleHasAnyPermission(
  role: WorkspaceRole,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => roleHasPermission(role, permission));
}

/**
 * A role can only be assigned by a member whose rank is strictly higher.
 * Owners are the only role able to assign ownership.
 */
export function canAssignRole(actorRole: WorkspaceRole, targetRole: WorkspaceRole): boolean {
  if (actorRole === WorkspaceRole.Owner) {
    return true;
  }

  return ROLE_RANK[targetRole] < ROLE_RANK[actorRole];
}

/**
 * Whether an actor can administer a target member. Admins cannot manage
 * owners or other admins; owners can manage every non-self member.
 */
export function canManageMember(actorRole: WorkspaceRole, targetRole: WorkspaceRole): boolean {
  return canAssignRole(actorRole, targetRole);
}
