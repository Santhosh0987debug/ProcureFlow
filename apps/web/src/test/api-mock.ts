import {
  ApprovalCycleStatus,
  ApprovalLevelRule,
  ApprovalStepStatus,
  ApproverAssignmentType,
  Currency,
  InvitationStatus,
  MembershipStatus,
  Permission,
  Priority,
  ProcurementCategory,
  RequestStatus,
  WorkspaceRole,
  permissionsForRole,
  roleHasPermission,
} from '@procureflow/shared';
import type {
  AcceptInvitationResult,
  ApprovalCycleSummary,
  ApprovalDetail,
  ApprovalInboxItem,
  ApprovalInboxResult,
  ApprovalLevelRecord,
  ApprovalPersonSummary,
  ApprovalStepRecord,
  ApprovalWorkflowDetail,
  ApprovalWorkflowLevelRecord,
  ApprovalWorkflowListResult,
  ApprovalWorkflowMemberRecord,
  ApprovalWorkflowPreview,
  ApprovalWorkflowSummary,
  ApprovalWorkflowWriteRequest,
  AuthSession,
  AuthWorkspace,
  CreateInvitationResult,
  CreatePurchaseRequestRequest,
  InvitationLinkResult,
  PaginatedResult,
  PurchaseRequestDetail,
  PurchaseRequestItemRecord,
  PurchaseRequestListResult,
  WorkspaceInvitationSummary,
  WorkspaceMemberSummary,
} from '@procureflow/shared';
import { vi } from 'vitest';

export const TEST_WORKSPACE_ID = '22222222-2222-4222-8222-222222222222';
export const TEST_USER_ID = '11111111-1111-4111-8111-111111111111';
export const TEST_INVITATION_TOKEN = 'test-invitation-token';

export function createTestSession(role: WorkspaceRole = WorkspaceRole.Owner): AuthSession {
  return {
    user: {
      id: TEST_USER_ID,
      email: 'amara.okafor@northwind.example',
      firstName: 'Amara',
      lastName: 'Okafor',
      jobTitle: 'Head of Procurement',
      avatarUrl: null,
      createdAt: '2025-09-15T09:00:00.000Z',
    },
    workspaces: [
      {
        id: TEST_WORKSPACE_ID,
        name: 'Northwind Industrial',
        slug: 'northwind-industrial',
        role,
        currency: Currency.USD,
        permissions: [...permissionsForRole(role)],
      },
    ],
  };
}

export const testSession: AuthSession = createTestSession();

export function createTestMembers(): WorkspaceMemberSummary[] {
  return [
    {
      id: 'member-owner',
      userId: TEST_USER_ID,
      firstName: 'Amara',
      lastName: 'Okafor',
      email: 'amara.okafor@northwind.example',
      jobTitle: 'Head of Procurement',
      role: WorkspaceRole.Owner,
      status: MembershipStatus.Active,
      joinedAt: '2025-09-15T09:00:00.000Z',
      suspendedAt: null,
      isCurrentUser: true,
    },
    {
      id: 'member-admin',
      userId: 'user-admin',
      firstName: 'Daniel',
      lastName: 'Reyes',
      email: 'daniel.reyes@northwind.example',
      jobTitle: 'Operations Director',
      role: WorkspaceRole.Admin,
      status: MembershipStatus.Active,
      joinedAt: '2025-10-02T10:00:00.000Z',
      suspendedAt: null,
      isCurrentUser: false,
    },
    {
      id: 'member-manager',
      userId: 'user-manager',
      firstName: 'Marcus',
      lastName: 'Chen',
      email: 'marcus.chen@northwind.example',
      jobTitle: 'Senior Category Manager',
      role: WorkspaceRole.ProcurementManager,
      status: MembershipStatus.Active,
      joinedAt: '2025-10-12T11:00:00.000Z',
      suspendedAt: null,
      isCurrentUser: false,
    },
    {
      id: 'member-approver',
      userId: 'user-approver',
      firstName: 'Priya',
      lastName: 'Nair',
      email: 'priya.nair@northwind.example',
      jobTitle: 'Finance Business Partner',
      role: WorkspaceRole.Approver,
      status: MembershipStatus.Active,
      joinedAt: '2025-11-01T09:30:00.000Z',
      suspendedAt: null,
      isCurrentUser: false,
    },
    {
      id: 'member-requester',
      userId: 'user-requester',
      firstName: 'Nadia',
      lastName: 'Hassan',
      email: 'nadia.hassan@northwind.example',
      jobTitle: 'Facilities Coordinator',
      role: WorkspaceRole.Requester,
      status: MembershipStatus.Active,
      joinedAt: '2025-11-05T08:15:00.000Z',
      suspendedAt: null,
      isCurrentUser: false,
    },
    {
      id: 'member-viewer',
      userId: 'user-viewer',
      firstName: 'Sofia',
      lastName: 'Lindberg',
      email: 'sofia.lindberg@northwind.example',
      jobTitle: 'Compliance Analyst',
      role: WorkspaceRole.Viewer,
      status: MembershipStatus.Active,
      joinedAt: '2025-11-08T14:20:00.000Z',
      suspendedAt: null,
      isCurrentUser: false,
    },
  ];
}

export function createTestInvitations(): WorkspaceInvitationSummary[] {
  return [
    {
      id: 'invitation-pending',
      email: 'grace.lee@northwind.example',
      role: WorkspaceRole.Viewer,
      status: InvitationStatus.Pending,
      invitedBy: {
        id: 'member-owner',
        firstName: 'Amara',
        lastName: 'Okafor',
      },
      expiresAt: '2026-11-16T12:00:00.000Z',
      acceptedAt: null,
      revokedAt: null,
      createdAt: '2026-11-09T12:00:00.000Z',
    },
  ];
}

export function createInvitationLink(
  invitation: WorkspaceInvitationSummary,
): CreateInvitationResult {
  return {
    invitation,
    delivery: 'development_link',
    invitationUrl: `http://localhost:5173/invitations/accept?token=${TEST_INVITATION_TOKEN}`,
    invitationToken: TEST_INVITATION_TOKEN,
  };
}

const testRequester = {
  id: 'user-requester',
  firstName: 'Nadia',
  lastName: 'Hassan',
  email: 'nadia.hassan@northwind.example',
  jobTitle: 'Facilities Coordinator',
};

const testOwner: ApprovalPersonSummary = {
  id: TEST_USER_ID,
  firstName: 'Amara',
  lastName: 'Okafor',
  email: 'amara.okafor@northwind.example',
  jobTitle: 'Head of Procurement',
};

const testApprover: ApprovalPersonSummary = {
  id: 'user-approver',
  firstName: 'Priya',
  lastName: 'Nair',
  email: 'priya.nair@northwind.example',
  jobTitle: 'Finance Business Partner',
};

function approvalStep(
  id: string,
  levelOrder: number,
  stepOrder: number,
  name: string,
  approver: ApprovalPersonSummary,
  isActive: boolean,
): ApprovalStepRecord {
  return {
    id,
    levelOrder,
    stepOrder,
    name,
    assignmentType: ApproverAssignmentType.Member,
    assignedRole: null,
    approver,
    status: ApprovalStepStatus.Pending,
    decisionNote: null,
    decidedAt: null,
    decidedBy: null,
    isActive,
    createdAt: '2026-11-09T12:00:00.000Z',
  };
}

function pendingApprovalLevels(): ApprovalLevelRecord[] {
  return [
    {
      levelOrder: 1,
      name: 'Manager review',
      completionRule: ApprovalLevelRule.AllRequired,
      status: ApprovalStepStatus.Pending,
      steps: [approvalStep('step-pending-manager', 1, 1, 'Manager review', testOwner, true)],
    },
    {
      levelOrder: 2,
      name: 'Finance review',
      completionRule: ApprovalLevelRule.AllRequired,
      status: ApprovalStepStatus.Pending,
      steps: [approvalStep('step-pending-finance', 2, 1, 'Finance review', testApprover, false)],
    },
  ];
}

function pendingApprovalSummary(): ApprovalCycleSummary {
  return {
    id: 'approval-pending-1',
    cycleNumber: 1,
    status: ApprovalCycleStatus.Pending,
    workflowName: 'Standard procurement approval',
    workflowDescription: 'Sequential manager and finance review for standard purchases.',
    currentLevel: 1,
    levelCount: 2,
    requestedAt: '2026-11-09T12:00:00.000Z',
    completedAt: null,
    requestedBy: testRequester,
    levels: pendingApprovalLevels(),
  };
}

export function createTestApprovals(): ApprovalDetail[] {
  const request = createTestPurchaseRequests().find(
    (candidate) => candidate.id === 'request-pending-1',
  );

  if (!request) {
    return [];
  }

  const summary = pendingApprovalSummary();
  const approvalRequest: PurchaseRequestDetail = {
    ...request,
    approval: summary,
    approvalHistory: [summary],
  };

  return [
    {
      ...summary,
      request: approvalRequest,
      actions: {
        canApprove: true,
        canReject: true,
        canRequestChanges: true,
        assignedStepId: 'step-pending-manager',
        blockedReason: null,
      },
      history: [summary],
    },
  ];
}

function workflowMember(member: WorkspaceMemberSummary): ApprovalWorkflowMemberRecord {
  return {
    id: member.id,
    userId: member.userId,
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email,
    jobTitle: member.jobTitle,
    role: member.role,
    status: member.status === MembershipStatus.Suspended ? 'suspended' : 'active',
  };
}

function workflowPerson(member: WorkspaceMemberSummary): ApprovalPersonSummary {
  return {
    id: member.userId,
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email,
    jobTitle: member.jobTitle,
  };
}

function memberWorkflowApprover(
  id: string,
  member: WorkspaceMemberSummary,
): ApprovalWorkflowLevelRecord['approvers'][number] {
  return {
    id,
    assignmentType: ApproverAssignmentType.Member,
    role: null,
    member: workflowMember(member),
  };
}

function roleWorkflowApprover(
  id: string,
  role: WorkspaceRole,
): ApprovalWorkflowLevelRecord['approvers'][number] {
  return {
    id,
    assignmentType: ApproverAssignmentType.Role,
    role,
    member: null,
  };
}

function workflowLevel(
  id: string,
  levelOrder: number,
  name: string,
  completionRule: ApprovalLevelRule,
  approvers: ApprovalWorkflowLevelRecord['approvers'],
): ApprovalWorkflowLevelRecord {
  return { id, levelOrder, name, completionRule, approvers };
}

function workflowSummary(workflow: ApprovalWorkflowDetail): ApprovalWorkflowSummary {
  const { levels: _levels, ...summary } = workflow;
  return summary;
}

export function createTestApprovalWorkflows(): ApprovalWorkflowDetail[] {
  const members = createTestMembers();
  const owner = members[0] as WorkspaceMemberSummary;
  const admin = members[1] as WorkspaceMemberSummary;
  const manager = members[2] as WorkspaceMemberSummary;
  const approver = members[3] as WorkspaceMemberSummary;
  const createdBy = workflowPerson(owner);

  return [
    {
      id: 'workflow-standard',
      name: 'Standard procurement approval',
      description: 'Sequential manager and finance review for standard purchases.',
      isActive: true,
      isDefault: true,
      currency: Currency.USD,
      minAmount: null,
      maxAmount: '25000.00',
      levelCount: 2,
      approverCount: 2,
      createdBy,
      createdAt: '2026-10-01T09:00:00.000Z',
      updatedAt: '2026-11-01T09:00:00.000Z',
      levels: [
        workflowLevel(
          'workflow-standard-level-1',
          1,
          'Manager review',
          ApprovalLevelRule.AllRequired,
          [memberWorkflowApprover('workflow-standard-approver-1', manager)],
        ),
        workflowLevel(
          'workflow-standard-level-2',
          2,
          'Finance review',
          ApprovalLevelRule.AllRequired,
          [memberWorkflowApprover('workflow-standard-approver-2', approver)],
        ),
      ],
    },
    {
      id: 'workflow-capital',
      name: 'Capital expenditure approval',
      description: 'Finance and executive review for capital purchases above $25,000.',
      isActive: true,
      isDefault: false,
      currency: Currency.USD,
      minAmount: '25000.01',
      maxAmount: null,
      levelCount: 2,
      approverCount: 2,
      createdBy,
      createdAt: '2026-10-05T09:00:00.000Z',
      updatedAt: '2026-11-02T09:00:00.000Z',
      levels: [
        workflowLevel(
          'workflow-capital-level-1',
          1,
          'Finance review',
          ApprovalLevelRule.AllRequired,
          [roleWorkflowApprover('workflow-capital-approver-1', WorkspaceRole.Approver)],
        ),
        workflowLevel(
          'workflow-capital-level-2',
          2,
          'Executive approval',
          ApprovalLevelRule.AnyOne,
          [memberWorkflowApprover('workflow-capital-approver-2', admin)],
        ),
      ],
    },
    {
      id: 'workflow-fast-track',
      name: 'Low-value fast track',
      description: 'Single-step approval for low-value purchases. Currently inactive.',
      isActive: false,
      isDefault: false,
      currency: Currency.USD,
      minAmount: null,
      maxAmount: '1000.00',
      levelCount: 1,
      approverCount: 1,
      createdBy,
      createdAt: '2026-10-10T09:00:00.000Z',
      updatedAt: '2026-10-10T09:00:00.000Z',
      levels: [
        workflowLevel(
          'workflow-fast-track-level-1',
          1,
          'Manager review',
          ApprovalLevelRule.AnyOne,
          [memberWorkflowApprover('workflow-fast-track-approver-1', manager)],
        ),
      ],
    },
  ];
}

function item(
  id: string,
  description: string,
  quantity: string,
  unitPrice: string,
  lineTotal: string,
  category: ProcurementCategory | null = null,
  notes: string | null = null,
): PurchaseRequestItemRecord {
  return {
    id,
    description,
    quantity,
    unit: 'unit',
    unitPrice,
    lineTotal,
    category,
    notes,
  };
}

export function createTestPurchaseRequests(): PurchaseRequestDetail[] {
  return [
    {
      id: 'request-draft-1',
      requestNumber: 'PR-2026-0001',
      title: 'Office equipment refresh',
      status: RequestStatus.Draft,
      priority: Priority.Medium,
      category: ProcurementCategory.Facilities,
      currency: Currency.USD,
      totalAmount: '70.17',
      department: 'Facilities',
      neededBy: '2026-12-01T00:00:00.000Z',
      requester: testRequester,
      itemCount: 2,
      createdAt: '2026-11-10T09:00:00.000Z',
      updatedAt: '2026-11-10T09:00:00.000Z',
      submittedAt: null,
      description: 'Replace end-of-life equipment for the operations floor.',
      notes: 'Deliver to the loading dock.',
      decidedAt: null,
      items: [
        item(
          'item-chair',
          'Ergonomic task chair',
          '3.50',
          '19.99',
          '69.97',
          ProcurementCategory.Facilities,
          'Black frame',
        ),
        item('item-desk', 'Height-adjustable desk', '2.00', '0.10', '0.20'),
      ],
      activity: [
        {
          id: 'activity-created-1',
          action: 'purchase_request.created',
          summary: 'Created draft PR-2026-0001.',
          actor: {
            id: testRequester.id,
            firstName: testRequester.firstName,
            lastName: testRequester.lastName,
          },
          occurredAt: '2026-11-10T09:00:00.000Z',
        },
      ],
      approval: null,
      approvalHistory: [],
      actions: { canEdit: true, canDelete: true, canSubmit: true },
    },
    {
      id: 'request-pending-1',
      requestNumber: 'PR-2026-0002',
      title: 'Annual safety supplies',
      status: RequestStatus.PendingApproval,
      priority: Priority.High,
      category: ProcurementCategory.Operations,
      currency: Currency.USD,
      totalAmount: '1234.50',
      department: 'Operations',
      neededBy: '2026-12-15T00:00:00.000Z',
      requester: testRequester,
      itemCount: 1,
      createdAt: '2026-11-09T11:00:00.000Z',
      updatedAt: '2026-11-09T12:00:00.000Z',
      submittedAt: '2026-11-09T12:00:00.000Z',
      description: 'Restock mandatory safety equipment for the warehouse team.',
      notes: null,
      decidedAt: null,
      items: [
        item(
          'item-gloves',
          'Safety gloves',
          '50.00',
          '24.69',
          '1234.50',
          ProcurementCategory.Operations,
        ),
      ],
      activity: [
        {
          id: 'activity-created-2',
          action: 'purchase_request.created',
          summary: 'Created draft PR-2026-0002.',
          actor: {
            id: testRequester.id,
            firstName: testRequester.firstName,
            lastName: testRequester.lastName,
          },
          occurredAt: '2026-11-09T11:00:00.000Z',
        },
        {
          id: 'activity-submitted-2',
          action: 'purchase_request.submitted',
          summary: 'Submitted PR-2026-0002 for approval.',
          actor: {
            id: testRequester.id,
            firstName: testRequester.firstName,
            lastName: testRequester.lastName,
          },
          occurredAt: '2026-11-09T12:00:00.000Z',
        },
      ],
      approval: pendingApprovalSummary(),
      approvalHistory: [pendingApprovalSummary()],
      actions: { canEdit: false, canDelete: false, canSubmit: false },
    },
  ];
}

function summaryFor(requests: PurchaseRequestDetail[]): PurchaseRequestListResult['summary'] {
  const totalValue = requests.reduce((sum, request) => sum + Number(request.totalAmount), 0);

  return {
    total: requests.length,
    draft: requests.filter((request) => request.status === RequestStatus.Draft).length,
    pendingApproval: requests.filter((request) => request.status === RequestStatus.PendingApproval)
      .length,
    approved: requests.filter((request) => request.status === RequestStatus.Approved).length,
    changesRequested: requests.filter(
      (request) => request.status === RequestStatus.ChangesRequested,
    ).length,
    totalValue: totalValue.toFixed(2),
  };
}

function toListSummary(request: PurchaseRequestDetail) {
  const {
    description: _description,
    notes: _notes,
    decidedAt: _decidedAt,
    items: _items,
    activity: _activity,
    actions: _actions,
    approval: _approval,
    approvalHistory: _approvalHistory,
    ...summary
  } = request;

  return summary;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function actionsFor(status: RequestStatus, permissions: readonly Permission[]) {
  const isEditable = status === RequestStatus.Draft || status === RequestStatus.ChangesRequested;

  return {
    canEdit: isEditable && permissions.includes(Permission.RequestsUpdate),
    canDelete: status === RequestStatus.Draft && permissions.includes(Permission.RequestsDelete),
    canSubmit: isEditable && permissions.includes(Permission.RequestsSubmit),
  };
}

const healthResponse = {
  status: 'ok',
  service: 'procureflow-api',
  version: '0.3.0',
  environment: 'test',
  uptimeSeconds: 12,
  timestamp: new Date().toISOString(),
};

export function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  };
}

export function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return jsonResponse(
    {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    status,
  );
}

interface FetchMockOptions {
  authenticated?: boolean;
  session?: AuthSession;
  loginResponse?: { status: number; body: unknown };
  registerResponse?: { status: number; body: unknown };
  members?: WorkspaceMemberSummary[];
  invitations?: WorkspaceInvitationSummary[];
  membersResponse?: { status: number; body: unknown };
  invitationsResponse?: { status: number; body: unknown };
  invitationAcceptResponse?: { status: number; body: unknown };
  roleChangeResponse?: { status: number; body: unknown };
  purchaseRequests?: PurchaseRequestDetail[];
  purchaseRequestsResponse?: { status: number; body: unknown };
  purchaseRequestDetailResponse?: { status: number; body: unknown };
  approvals?: ApprovalDetail[];
  workflows?: ApprovalWorkflowDetail[];
}

function parseUrl(input: RequestInfo | URL): URL {
  const raw =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  return new URL(raw, 'http://localhost');
}

function paginate<T>(items: T[], page: number, pageSize: number): PaginatedResult<T> {
  const total = items.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages,
  };
}

function updatedMember(
  member: WorkspaceMemberSummary,
  changes: Partial<WorkspaceMemberSummary>,
): WorkspaceMemberSummary {
  return { ...member, ...changes };
}

function inboxItemsFor(approvals: readonly ApprovalDetail[], userId: string): ApprovalInboxItem[] {
  return approvals.flatMap((approval) =>
    approval.levels.flatMap((level) =>
      level.steps
        .filter((step) => step.approver?.id === userId)
        .map((step) => ({
          approvalId: approval.id,
          cycleNumber: approval.cycleNumber,
          approvalStatus: approval.status,
          requestId: approval.request.id,
          requestNumber: approval.request.requestNumber,
          title: approval.request.title,
          requester: approval.request.requester,
          department: approval.request.department,
          amount: approval.request.totalAmount,
          currency: approval.request.currency,
          priority: approval.request.priority,
          submittedAt: approval.request.submittedAt ?? approval.requestedAt,
          levelOrder: level.levelOrder,
          levelName: level.name,
          levelCount: approval.levelCount,
          completionRule: level.completionRule,
          stepStatus: step.status,
          assignedAt: step.createdAt,
          isActive: step.isActive,
        })),
    ),
  );
}

function inboxSummaryFor(items: readonly ApprovalInboxItem[]): ApprovalInboxResult['summary'] {
  const count = (status: ApprovalStepStatus): number =>
    items.filter((item) => item.stepStatus === status).length;

  return {
    pending: count(ApprovalStepStatus.Pending),
    approved: count(ApprovalStepStatus.Approved),
    rejected: count(ApprovalStepStatus.Rejected),
    changesRequested: count(ApprovalStepStatus.ChangesRequested),
  };
}

function previewWorkflow(
  input: ApprovalWorkflowWriteRequest,
  members: readonly WorkspaceMemberSummary[],
): ApprovalWorkflowPreview {
  const warnings: string[] = [];
  const levels = input.levels.map((level, index) => {
    const resolved = new Map<string, ApprovalPersonSummary>();
    const levelWarnings: string[] = [];

    for (const approver of level.approvers) {
      if (approver.assignmentType === ApproverAssignmentType.Member) {
        const member = members.find((candidate) => candidate.id === approver.memberId);

        if (!member) {
          levelWarnings.push('An assigned member is no longer part of the workspace.');
          continue;
        }

        if (member.status !== MembershipStatus.Active) {
          levelWarnings.push(
            `${member.firstName} ${member.lastName} is suspended and cannot approve.`,
          );
          continue;
        }

        if (!roleHasPermission(member.role, Permission.ApprovalsDecide)) {
          levelWarnings.push(
            `${member.firstName} ${member.lastName} does not hold approval permission.`,
          );
          continue;
        }

        const person = workflowPerson(member);

        if (resolved.has(person.id)) {
          levelWarnings.push(`${person.firstName} ${person.lastName} appears twice in this level.`);
          continue;
        }

        resolved.set(person.id, person);
        continue;
      }

      const eligible = members.filter(
        (member) =>
          member.status === MembershipStatus.Active &&
          member.role === approver.role &&
          roleHasPermission(member.role, Permission.ApprovalsDecide),
      );

      if (eligible.length === 0) {
        levelWarnings.push(
          `No active members currently hold the ${approver.role.replaceAll('_', ' ')} role.`,
        );
      }

      for (const member of eligible) {
        const person = workflowPerson(member);

        if (resolved.has(person.id)) {
          levelWarnings.push(`${person.firstName} ${person.lastName} appears twice in this level.`);
          continue;
        }

        resolved.set(person.id, person);
      }
    }

    if (resolved.size === 0) {
      levelWarnings.push('This level needs at least one eligible active approver.');
    }

    warnings.push(...levelWarnings);

    return {
      levelOrder: index + 1,
      name: level.name,
      completionRule: level.completionRule,
      approvers: [...resolved.values()],
      warnings: levelWarnings,
    };
  });

  return {
    name: input.name,
    currency: input.currency,
    minAmount: input.minAmount ?? null,
    maxAmount: input.maxAmount ?? null,
    isActive: false,
    isDefault: input.isDefault,
    levels,
    warnings,
    canActivate: levels.length > 0 && levels.every((level) => level.approvers.length > 0),
  };
}

function levelsFromWrite(
  workflowId: string,
  input: ApprovalWorkflowWriteRequest,
  members: readonly WorkspaceMemberSummary[],
): ApprovalWorkflowLevelRecord[] {
  return input.levels.map((level, index) => ({
    id: `${workflowId}-level-${index + 1}`,
    levelOrder: index + 1,
    name: level.name,
    completionRule: level.completionRule,
    approvers: level.approvers.map((approver, approverIndex) => {
      const id = `${workflowId}-approver-${index + 1}-${approverIndex + 1}`;

      if (approver.assignmentType === ApproverAssignmentType.Member) {
        const member = members.find((candidate) => candidate.id === approver.memberId);

        return {
          id,
          assignmentType: ApproverAssignmentType.Member,
          role: null,
          member: member ? workflowMember(member) : null,
        };
      }

      return {
        id,
        assignmentType: ApproverAssignmentType.Role,
        role: approver.role,
        member: null,
      };
    }),
  }));
}

function workflowFromWrite(
  workflowId: string,
  input: ApprovalWorkflowWriteRequest,
  members: readonly WorkspaceMemberSummary[],
  createdBy: ApprovalPersonSummary,
  createdAt: string,
  isActive: boolean,
): ApprovalWorkflowDetail {
  const levels = levelsFromWrite(workflowId, input, members);

  return {
    id: workflowId,
    name: input.name,
    description: input.description ?? null,
    isActive,
    isDefault: input.isDefault,
    currency: input.currency,
    minAmount: input.minAmount ?? null,
    maxAmount: input.maxAmount ?? null,
    levelCount: levels.length,
    approverCount: levels.reduce((count, level) => count + level.approvers.length, 0),
    createdBy,
    createdAt,
    updatedAt: new Date().toISOString(),
    levels,
  };
}

function cycleSummaryOf(approval: ApprovalDetail): ApprovalCycleSummary {
  const { request: _request, actions: _actions, history: _history, ...summary } = approval;
  return summary;
}

function levelSatisfied(level: ApprovalLevelRecord): boolean {
  const actionable = level.steps.filter(
    (step) =>
      step.status !== ApprovalStepStatus.Skipped && step.status !== ApprovalStepStatus.Cancelled,
  );

  if (level.completionRule === ApprovalLevelRule.AnyOne) {
    return actionable.some((step) => step.status === ApprovalStepStatus.Approved);
  }

  return (
    actionable.length > 0 && actionable.every((step) => step.status === ApprovalStepStatus.Approved)
  );
}

function requestWithCycle(
  request: PurchaseRequestDetail,
  summary: ApprovalCycleSummary,
  status: RequestStatus,
  decidedAt: string | null,
  permissions: readonly Permission[],
): PurchaseRequestDetail {
  return {
    ...request,
    status,
    decidedAt,
    approval: summary,
    approvalHistory: [summary],
    actions: actionsFor(status, permissions),
  };
}

function applyDecision(
  approval: ApprovalDetail,
  kind: 'approve' | 'reject' | 'request-changes',
  note: string | null,
  actor: ApprovalPersonSummary,
  permissions: readonly Permission[],
): ApprovalDetail {
  const levels = approval.levels.map((level) => ({
    ...level,
    steps: level.steps.map((step) => ({ ...step })),
  }));
  const activeStep = levels
    .flatMap((level) => level.steps)
    .find((step) => step.isActive && step.status === ApprovalStepStatus.Pending);

  if (!activeStep) {
    return approval;
  }

  const now = new Date().toISOString();
  const currentLevel = levels.find((level) => level.levelOrder === activeStep.levelOrder);
  activeStep.isActive = false;
  activeStep.decidedAt = now;
  activeStep.decidedBy = actor;
  activeStep.decisionNote = note;

  if (kind === 'reject' || kind === 'request-changes') {
    const stepStatus =
      kind === 'reject' ? ApprovalStepStatus.Rejected : ApprovalStepStatus.ChangesRequested;
    const cycleStatus =
      kind === 'reject' ? ApprovalCycleStatus.Rejected : ApprovalCycleStatus.ChangesRequested;
    const requestStatus =
      kind === 'reject' ? RequestStatus.Rejected : RequestStatus.ChangesRequested;

    activeStep.status = stepStatus;

    for (const level of levels) {
      for (const step of level.steps) {
        if (step.status === ApprovalStepStatus.Pending) {
          step.status = ApprovalStepStatus.Cancelled;
          step.isActive = false;
        }
      }
    }

    if (currentLevel) {
      currentLevel.status = stepStatus;
    }

    const summary: ApprovalCycleSummary = {
      ...cycleSummaryOf(approval),
      status: cycleStatus,
      completedAt: now,
      levels,
    };

    return {
      ...approval,
      ...summary,
      request: requestWithCycle(approval.request, summary, requestStatus, now, permissions),
      actions: {
        canApprove: false,
        canReject: false,
        canRequestChanges: false,
        assignedStepId: null,
        blockedReason: 'This approval cycle is no longer pending.',
      },
      history: [summary],
    };
  }

  activeStep.status = ApprovalStepStatus.Approved;

  if (currentLevel && levelSatisfied(currentLevel)) {
    currentLevel.status = ApprovalStepStatus.Approved;

    if (currentLevel.completionRule === ApprovalLevelRule.AnyOne) {
      for (const step of currentLevel.steps) {
        if (step.status === ApprovalStepStatus.Pending) {
          step.status = ApprovalStepStatus.Skipped;
          step.isActive = false;
        }
      }
    }
  }

  const nextLevel = levels.find((level) => level.levelOrder === activeStep.levelOrder + 1);

  if (currentLevel && levelSatisfied(currentLevel) && nextLevel) {
    for (const step of nextLevel.steps) {
      if (step.status === ApprovalStepStatus.Pending) {
        step.isActive = true;
      }
    }

    const summary: ApprovalCycleSummary = {
      ...cycleSummaryOf(approval),
      currentLevel: nextLevel.levelOrder,
      levels,
    };

    return {
      ...approval,
      ...summary,
      request: {
        ...approval.request,
        approval: summary,
        approvalHistory: [summary],
      },
      actions: {
        canApprove: false,
        canReject: false,
        canRequestChanges: false,
        assignedStepId: null,
        blockedReason: 'Your decision was recorded. This approval is now with another approver.',
      },
      history: [summary],
    };
  }

  const summary: ApprovalCycleSummary = {
    ...cycleSummaryOf(approval),
    status: ApprovalCycleStatus.Approved,
    currentLevel: approval.levelCount,
    completedAt: now,
    levels,
  };

  return {
    ...approval,
    ...summary,
    request: requestWithCycle(approval.request, summary, RequestStatus.Approved, now, permissions),
    actions: {
      canApprove: false,
      canReject: false,
      canRequestChanges: false,
      assignedStepId: null,
      blockedReason: 'This approval cycle is complete.',
    },
    history: [summary],
  };
}

export function createFetchMock(options: FetchMockOptions = {}) {
  const { authenticated = true, session = testSession } = options;
  const members = [...(options.members ?? createTestMembers())];
  const invitations = [...(options.invitations ?? createTestInvitations())];
  const permissions = permissionsForRole(session.workspaces[0]?.role ?? WorkspaceRole.Viewer);
  const purchaseRequests = (options.purchaseRequests ?? createTestPurchaseRequests()).map(
    (request) => ({
      ...request,
      actions: actionsFor(request.status, permissions),
    }),
  );
  const approvals = [...(options.approvals ?? createTestApprovals())];
  const workflows = [...(options.workflows ?? createTestApprovalWorkflows())];
  let workflowSequence = workflows.length;

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = parseUrl(input);
    const path = url.pathname;
    const method = (init?.method ?? 'GET').toUpperCase();

    if (path.endsWith('/api/health')) {
      return jsonResponse(healthResponse);
    }

    if (path.endsWith('/api/auth/me')) {
      return authenticated
        ? jsonResponse({ data: session })
        : errorResponse(
            401,
            'AUTH_REQUIRED',
            'Authentication is required to access this resource.',
          );
    }

    if (path.endsWith('/api/auth/login') && method === 'POST') {
      return options.loginResponse
        ? jsonResponse(options.loginResponse.body, options.loginResponse.status)
        : jsonResponse({ data: session });
    }

    if (path.endsWith('/api/auth/register') && method === 'POST') {
      return options.registerResponse
        ? jsonResponse(options.registerResponse.body, options.registerResponse.status)
        : jsonResponse({ data: session }, 201);
    }

    if (path.endsWith('/api/auth/logout') && method === 'POST') {
      return {
        ok: true,
        status: 204,
        headers: new Headers(),
        json: async () => null,
      };
    }

    if (path.endsWith('/api/invitations/accept') && method === 'POST') {
      if (options.invitationAcceptResponse) {
        return jsonResponse(
          options.invitationAcceptResponse.body,
          options.invitationAcceptResponse.status,
        );
      }

      const workspace = session.workspaces[0] as AuthWorkspace;
      const acceptedMembership = updatedMember(members[0] as WorkspaceMemberSummary, {
        role: WorkspaceRole.Requester,
      });
      const result: AcceptInvitationResult = {
        session,
        workspace,
        membership: acceptedMembership,
      };

      return jsonResponse({ data: result });
    }

    const purchaseRequestMatch = path.match(
      /^\/api\/workspaces\/([^/]+)\/purchase-requests(?:\/([^/]+))?(?:\/(submit))?$/,
    );

    if (purchaseRequestMatch) {
      const requestId = purchaseRequestMatch[2]
        ? decodeURIComponent(purchaseRequestMatch[2])
        : null;
      const isSubmit = purchaseRequestMatch[3] === 'submit';

      if (!requestId && method === 'GET') {
        if (options.purchaseRequestsResponse) {
          return jsonResponse(
            options.purchaseRequestsResponse.body,
            options.purchaseRequestsResponse.status,
          );
        }

        const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
        const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') ?? 20));
        const search = (url.searchParams.get('search') ?? '').toLowerCase();
        const status = url.searchParams.get('status');
        const category = url.searchParams.get('category');
        const priority = url.searchParams.get('priority');

        const filtered = purchaseRequests.filter((request) => {
          const haystack =
            `${request.requestNumber} ${request.title} ${request.department ?? ''}`.toLowerCase();

          return (
            (search === '' || haystack.includes(search)) &&
            (!status || request.status === status) &&
            (!category || request.category === category) &&
            (!priority || request.priority === priority)
          );
        });

        const result: PurchaseRequestListResult = {
          ...paginate(filtered.map(toListSummary), page, pageSize),
          summary: summaryFor(filtered),
        };

        return jsonResponse({ data: result });
      }

      if (!requestId && method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}')) as CreatePurchaseRequestRequest;
        const now = new Date().toISOString();
        const year = new Date().getUTCFullYear();
        const prefix = `PR-${year}-`;
        const highest = purchaseRequests.reduce((max, request) => {
          if (!request.requestNumber.startsWith(prefix)) {
            return max;
          }

          const value = Number.parseInt(request.requestNumber.slice(prefix.length), 10);
          return Number.isFinite(value) ? Math.max(max, value) : max;
        }, 0);
        const requestNumber = `${prefix}${String(highest + 1).padStart(4, '0')}`;
        const items: PurchaseRequestItemRecord[] = body.items.map((entry, index) => {
          const lineTotal = roundMoney(Number(entry.quantity) * Number(entry.unitPrice));

          return {
            id: `item-created-${index + 1}`,
            description: entry.description,
            quantity: Number(entry.quantity).toFixed(2),
            unit: entry.unit,
            unitPrice: Number(entry.unitPrice).toFixed(2),
            lineTotal: lineTotal.toFixed(2),
            category: entry.category ?? null,
            notes: entry.notes ?? null,
          };
        });
        const totalAmount = roundMoney(
          items.reduce((sum, entry) => sum + Number(entry.lineTotal), 0),
        ).toFixed(2);
        const created: PurchaseRequestDetail = {
          id: `request-created-${purchaseRequests.length + 1}`,
          requestNumber,
          title: body.title,
          status: RequestStatus.Draft,
          priority: body.priority,
          category: body.category,
          currency: body.currency,
          totalAmount,
          department: body.department ?? null,
          neededBy: body.neededBy ? `${body.neededBy.slice(0, 10)}T00:00:00.000Z` : null,
          requester: testRequester,
          itemCount: items.length,
          createdAt: now,
          updatedAt: now,
          submittedAt: null,
          description: body.description,
          notes: body.notes ?? null,
          decidedAt: null,
          items,
          activity: [
            {
              id: `activity-created-${purchaseRequests.length + 1}`,
              action: 'purchase_request.created',
              summary: `Created draft ${requestNumber}.`,
              actor: {
                id: testRequester.id,
                firstName: testRequester.firstName,
                lastName: testRequester.lastName,
              },
              occurredAt: now,
            },
          ],
          approval: null,
          approvalHistory: [],
          actions: actionsFor(RequestStatus.Draft, permissions),
        };

        purchaseRequests.unshift(created);
        return jsonResponse({ data: created }, 201);
      }

      if (requestId) {
        const index = purchaseRequests.findIndex((request) => request.id === requestId);

        if (index === -1) {
          return errorResponse(
            404,
            'REQUEST_NOT_FOUND',
            'Purchase request not found in this workspace.',
          );
        }

        const current = purchaseRequests[index] as PurchaseRequestDetail;

        if (isSubmit && method === 'POST') {
          if (current.status !== RequestStatus.Draft) {
            return errorResponse(
              409,
              'REQUEST_ALREADY_SUBMITTED',
              'This purchase request has already been submitted for approval.',
            );
          }

          const now = new Date().toISOString();
          const updated: PurchaseRequestDetail = {
            ...current,
            status: RequestStatus.PendingApproval,
            submittedAt: now,
            updatedAt: now,
            actions: actionsFor(RequestStatus.PendingApproval, permissions),
            activity: [
              ...current.activity,
              {
                id: `activity-submitted-${current.id}`,
                action: 'purchase_request.submitted',
                summary: `Submitted ${current.requestNumber} for approval.`,
                actor: {
                  id: testRequester.id,
                  firstName: testRequester.firstName,
                  lastName: testRequester.lastName,
                },
                occurredAt: now,
              },
            ],
          };

          purchaseRequests[index] = updated;
          return jsonResponse({ data: updated });
        }

        if (method === 'GET') {
          if (options.purchaseRequestDetailResponse) {
            return jsonResponse(
              options.purchaseRequestDetailResponse.body,
              options.purchaseRequestDetailResponse.status,
            );
          }

          return jsonResponse({ data: current });
        }

        if (method === 'PATCH') {
          if (current.status !== RequestStatus.Draft) {
            return errorResponse(
              409,
              'REQUEST_NOT_DRAFT',
              'Only draft purchase requests can be changed or submitted.',
            );
          }

          const body = JSON.parse(String(init?.body ?? '{}')) as CreatePurchaseRequestRequest;
          const now = new Date().toISOString();
          const items: PurchaseRequestItemRecord[] = body.items.map((entry, itemIndex) => {
            const lineTotal = roundMoney(Number(entry.quantity) * Number(entry.unitPrice));

            return {
              id: `item-updated-${itemIndex + 1}`,
              description: entry.description,
              quantity: Number(entry.quantity).toFixed(2),
              unit: entry.unit,
              unitPrice: Number(entry.unitPrice).toFixed(2),
              lineTotal: lineTotal.toFixed(2),
              category: entry.category ?? null,
              notes: entry.notes ?? null,
            };
          });
          const totalAmount = roundMoney(
            items.reduce((sum, entry) => sum + Number(entry.lineTotal), 0),
          ).toFixed(2);
          const updated: PurchaseRequestDetail = {
            ...current,
            title: body.title,
            description: body.description,
            department: body.department ?? null,
            category: body.category,
            priority: body.priority,
            currency: body.currency,
            neededBy: body.neededBy ? `${body.neededBy.slice(0, 10)}T00:00:00.000Z` : null,
            notes: body.notes ?? null,
            totalAmount,
            itemCount: items.length,
            items,
            updatedAt: now,
            actions: actionsFor(RequestStatus.Draft, permissions),
            activity: [
              ...current.activity,
              {
                id: `activity-updated-${current.id}`,
                action: 'purchase_request.updated',
                summary: `Updated draft ${current.requestNumber}.`,
                actor: {
                  id: testRequester.id,
                  firstName: testRequester.firstName,
                  lastName: testRequester.lastName,
                },
                occurredAt: now,
              },
            ],
          };

          purchaseRequests[index] = updated;
          return jsonResponse({ data: updated });
        }

        if (method === 'DELETE') {
          if (current.status !== RequestStatus.Draft) {
            return errorResponse(
              409,
              'REQUEST_NOT_DRAFT',
              'Only draft purchase requests can be changed or submitted.',
            );
          }

          purchaseRequests.splice(index, 1);
          return {
            ok: true,
            status: 204,
            headers: new Headers(),
            json: async () => null,
          };
        }
      }
    }

    const requestApprovalMatch = path.match(
      /^\/api\/workspaces\/([^/]+)\/purchase-requests\/([^/]+)\/approvals$/,
    );

    if (requestApprovalMatch && method === 'GET') {
      const requestId = decodeURIComponent(requestApprovalMatch[2] as string);
      const items = approvals
        .filter((approval) => approval.request.id === requestId)
        .map(cycleSummaryOf);

      return jsonResponse({ data: { items } });
    }

    const approvalMatch = path.match(
      /^\/api\/workspaces\/([^/]+)\/approvals(?:\/([^/]+))?(?:\/(approve|reject|request-changes))?$/,
    );

    if (approvalMatch) {
      const approvalId = approvalMatch[2] ? decodeURIComponent(approvalMatch[2]) : null;
      const action = approvalMatch[3] ?? null;

      if (!approvalId && method === 'GET') {
        const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
        const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') ?? 10));
        const status = url.searchParams.get('status');
        const priority = url.searchParams.get('priority');
        const requester = (url.searchParams.get('requester') ?? '').toLowerCase();
        const search = (url.searchParams.get('search') ?? '').toLowerCase();
        const minAmount = url.searchParams.get('minAmount');
        const maxAmount = url.searchParams.get('maxAmount');
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');
        const allItems = inboxItemsFor(approvals, session.user.id);

        const filtered = allItems.filter((item) => {
          if (!status) {
            if (
              item.stepStatus !== ApprovalStepStatus.Pending ||
              !item.isActive ||
              item.approvalStatus !== ApprovalCycleStatus.Pending
            ) {
              return false;
            }
          } else if (item.stepStatus !== status) {
            return false;
          }

          if (priority && item.priority !== priority) {
            return false;
          }

          if (
            requester &&
            !`${item.requester.firstName} ${item.requester.lastName} ${item.requester.email}`
              .toLowerCase()
              .includes(requester)
          ) {
            return false;
          }

          const haystack =
            `${item.requestNumber} ${item.title} ${item.department ?? ''} ${item.requester.firstName} ${item.requester.lastName}`.toLowerCase();

          if (search && !haystack.includes(search)) {
            return false;
          }

          const amount = Number(item.amount);

          if (minAmount && amount < Number(minAmount)) {
            return false;
          }

          if (maxAmount && amount > Number(maxAmount)) {
            return false;
          }

          const submittedDate = item.submittedAt.slice(0, 10);

          if (from && submittedDate < from.slice(0, 10)) {
            return false;
          }

          if (to && submittedDate > to.slice(0, 10)) {
            return false;
          }

          return true;
        });

        const result: ApprovalInboxResult = {
          ...paginate(filtered, page, pageSize),
          summary: inboxSummaryFor(allItems),
        };

        return jsonResponse({ data: result });
      }

      const index = approvals.findIndex((approval) => approval.id === approvalId);

      if (index === -1) {
        return errorResponse(404, 'APPROVAL_NOT_FOUND', 'Approval not found in this workspace.');
      }

      const approval = approvals[index] as ApprovalDetail;

      if (!action && method === 'GET') {
        return jsonResponse({ data: approval });
      }

      if (action && method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          comment?: string | null;
          reason?: string;
          explanation?: string;
        };

        if (action === 'reject') {
          const reason = (body.reason ?? '').trim();

          if (!reason) {
            return errorResponse(
              422,
              'VALIDATION_ERROR',
              'Please correct the highlighted fields.',
              { fieldErrors: { reason: ['Enter a reason for rejecting this request.'] } },
            );
          }
        }

        if (action === 'request-changes') {
          const explanation = (body.explanation ?? '').trim();

          if (!explanation) {
            return errorResponse(
              422,
              'VALIDATION_ERROR',
              'Please correct the highlighted fields.',
              {
                fieldErrors: {
                  explanation: ['Explain the changes the requester needs to make.'],
                },
              },
            );
          }
        }

        const kind =
          action === 'approve'
            ? ('approve' as const)
            : action === 'reject'
              ? ('reject' as const)
              : ('request-changes' as const);
        const note =
          kind === 'approve'
            ? (body.comment ?? '').trim() || null
            : kind === 'reject'
              ? (body.reason ?? '').trim()
              : (body.explanation ?? '').trim();
        const updated = applyDecision(approval, kind, note, session.user, permissions);

        if (updated === approval) {
          return errorResponse(
            409,
            'APPROVAL_NOT_PENDING',
            'This approval cycle is no longer pending.',
          );
        }

        approvals[index] = updated;
        const requestIndex = purchaseRequests.findIndex(
          (request) => request.id === updated.request.id,
        );

        if (requestIndex !== -1) {
          purchaseRequests[requestIndex] = updated.request;
        }

        return jsonResponse({ data: updated });
      }
    }

    const workflowMatch = path.match(
      /^\/api\/workspaces\/([^/]+)\/approval-workflows(?:\/([^/]+))?(?:\/(activate|deactivate))?$/,
    );

    if (workflowMatch) {
      const workflowId = workflowMatch[2] ? decodeURIComponent(workflowMatch[2]) : null;
      const action = workflowMatch[3] ?? null;

      if (!workflowId && method === 'GET') {
        const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
        const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') ?? 20));
        const search = (url.searchParams.get('search') ?? '').toLowerCase();
        const status = url.searchParams.get('status');

        const filtered = workflows.filter((workflow) => {
          const haystack = `${workflow.name} ${workflow.description ?? ''}`.toLowerCase();

          return (
            (search === '' || haystack.includes(search)) &&
            (status !== 'active' || workflow.isActive) &&
            (status !== 'inactive' || !workflow.isActive) &&
            (status !== 'default' || workflow.isDefault)
          );
        });

        const result: ApprovalWorkflowListResult = {
          ...paginate(filtered.map(workflowSummary), page, pageSize),
        };

        return jsonResponse({ data: result });
      }

      if (!workflowId && method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}')) as ApprovalWorkflowWriteRequest;
        workflowSequence += 1;

        if (body.isDefault) {
          for (const workflow of workflows) {
            workflow.isDefault = false;
          }
        }

        const created = workflowFromWrite(
          `workflow-created-${workflowSequence}`,
          body,
          members,
          session.user,
          new Date().toISOString(),
          body.isDefault,
        );
        workflows.unshift(created);
        return jsonResponse({ data: created }, 201);
      }

      if (workflowId === 'preview' && method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}')) as ApprovalWorkflowWriteRequest;
        return jsonResponse({ data: previewWorkflow(body, members) });
      }

      const index = workflows.findIndex((workflow) => workflow.id === workflowId);

      if (index === -1) {
        return errorResponse(
          404,
          'WORKFLOW_NOT_FOUND',
          'Approval workflow not found in this workspace.',
        );
      }

      const workflow = workflows[index] as ApprovalWorkflowDetail;

      if (!action && method === 'GET') {
        return jsonResponse({ data: workflow });
      }

      if (!action && method === 'PUT') {
        const body = JSON.parse(String(init?.body ?? '{}')) as ApprovalWorkflowWriteRequest;

        if (body.isDefault) {
          workflows.forEach((candidate, candidateIndex) => {
            if (candidateIndex !== index) {
              candidate.isDefault = false;
            }
          });
        }

        const updated = workflowFromWrite(
          workflow.id,
          body,
          members,
          workflow.createdBy,
          workflow.createdAt,
          body.isDefault ? true : workflow.isActive,
        );
        workflows[index] = updated;
        return jsonResponse({ data: updated });
      }

      if (!action && method === 'DELETE') {
        workflows.splice(index, 1);
        return {
          ok: true,
          status: 204,
          headers: new Headers(),
          json: async () => null,
        };
      }

      if (action === 'activate' && method === 'POST') {
        const updated: ApprovalWorkflowDetail = {
          ...workflow,
          isActive: true,
          updatedAt: new Date().toISOString(),
        };
        workflows[index] = updated;
        return jsonResponse({ data: updated });
      }

      if (action === 'deactivate' && method === 'POST') {
        const updated: ApprovalWorkflowDetail = {
          ...workflow,
          isActive: false,
          isDefault: false,
          updatedAt: new Date().toISOString(),
        };
        workflows[index] = updated;
        return jsonResponse({ data: updated });
      }
    }

    const workspaceMatch = path.match(/^\/api\/workspaces\/([^/]+)\/(members|invitations)(\/.*)?$/);

    if (workspaceMatch) {
      const resource = workspaceMatch[2];
      const rest = workspaceMatch[3] ?? '';

      if (resource === 'members') {
        if (rest === '' && method === 'GET') {
          if (options.membersResponse) {
            return jsonResponse(options.membersResponse.body, options.membersResponse.status);
          }

          const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
          const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') ?? 10));
          const search = (url.searchParams.get('search') ?? '').toLowerCase();
          const role = url.searchParams.get('role');
          const status = url.searchParams.get('status');

          const filtered = members.filter((member) => {
            const haystack = `${member.firstName} ${member.lastName} ${member.email} ${
              member.jobTitle ?? ''
            }`.toLowerCase();

            return (
              (search === '' || haystack.includes(search)) &&
              (!role || member.role === role) &&
              (!status || member.status === status)
            );
          });

          return jsonResponse({ data: paginate(filtered, page, pageSize) });
        }

        const memberMatch = rest.match(/^\/([^/]+)(?:\/(role|suspend|reactivate))?$/);

        if (memberMatch) {
          const memberId = decodeURIComponent(memberMatch[1] as string);
          const action = memberMatch[2];
          const index = members.findIndex((member) => member.id === memberId);

          if (index === -1) {
            return errorResponse(404, 'MEMBER_NOT_FOUND', 'The member could not be found.');
          }

          const member = members[index] as WorkspaceMemberSummary;

          if (action === 'role' && method === 'PATCH') {
            if (options.roleChangeResponse) {
              return jsonResponse(
                options.roleChangeResponse.body,
                options.roleChangeResponse.status,
              );
            }

            const body = JSON.parse(String(init?.body ?? '{}')) as { role?: WorkspaceRole };
            const next = updatedMember(member, {
              role: body.role ?? member.role,
            });
            members[index] = next;
            return jsonResponse({ data: next });
          }

          if (action === 'suspend' && method === 'POST') {
            const next = updatedMember(member, {
              status: MembershipStatus.Suspended,
              suspendedAt: new Date().toISOString(),
            });
            members[index] = next;
            return jsonResponse({ data: next });
          }

          if (action === 'reactivate' && method === 'POST') {
            const next = updatedMember(member, {
              status: MembershipStatus.Active,
              suspendedAt: null,
            });
            members[index] = next;
            return jsonResponse({ data: next });
          }

          if (!action && method === 'DELETE') {
            members.splice(index, 1);
            return {
              ok: true,
              status: 204,
              headers: new Headers(),
              json: async () => null,
            };
          }
        }
      }

      if (resource === 'invitations') {
        if (rest === '' && method === 'GET') {
          if (options.invitationsResponse) {
            return jsonResponse(
              options.invitationsResponse.body,
              options.invitationsResponse.status,
            );
          }

          const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
          const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') ?? 10));
          const status = url.searchParams.get('status');
          const filtered = invitations.filter(
            (invitation) => !status || invitation.status === status,
          );

          return jsonResponse({ data: paginate(filtered, page, pageSize) });
        }

        if (rest === '' && method === 'POST') {
          const body = JSON.parse(String(init?.body ?? '{}')) as {
            email?: string;
            role?: WorkspaceRole;
          };
          const invitation: WorkspaceInvitationSummary = {
            id: `invitation-${invitations.length + 1}`,
            email: body.email ?? 'new.member@example.com',
            role: body.role ?? WorkspaceRole.Requester,
            status: InvitationStatus.Pending,
            invitedBy: {
              id: 'member-owner',
              firstName: 'Amara',
              lastName: 'Okafor',
            },
            expiresAt: '2026-11-16T12:00:00.000Z',
            acceptedAt: null,
            revokedAt: null,
            createdAt: new Date().toISOString(),
          };
          invitations.unshift(invitation);
          return jsonResponse({ data: createInvitationLink(invitation) }, 201);
        }

        const invitationMatch = rest.match(/^\/([^/]+)\/(revoke|link)$/);

        if (invitationMatch) {
          const invitationId = decodeURIComponent(invitationMatch[1] as string);
          const action = invitationMatch[2];
          const index = invitations.findIndex((invitation) => invitation.id === invitationId);

          if (index === -1) {
            return errorResponse(404, 'INVITATION_NOT_FOUND', 'The invitation could not be found.');
          }

          const invitation = invitations[index] as WorkspaceInvitationSummary;

          if (action === 'revoke' && method === 'POST') {
            const next: WorkspaceInvitationSummary = {
              ...invitation,
              status: InvitationStatus.Revoked,
              revokedAt: new Date().toISOString(),
            };
            invitations[index] = next;
            return jsonResponse({ data: next });
          }

          if (action === 'link' && method === 'POST') {
            const result: InvitationLinkResult = {
              invitation,
              invitationUrl: `http://localhost:5173/invitations/accept?token=${TEST_INVITATION_TOKEN}`,
              invitationToken: TEST_INVITATION_TOKEN,
              expiresAt: invitation.expiresAt,
            };
            return jsonResponse({ data: result });
          }
        }
      }
    }

    return errorResponse(404, 'NOT_FOUND', 'The requested resource was not found.');
  });
}

export const ALL_TEST_PERMISSIONS: readonly Permission[] = permissionsForRole(WorkspaceRole.Owner);
