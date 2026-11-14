import { Prisma } from '@prisma/client';
import {
  ApprovalCycleStatus,
  ApprovalLevelRule,
  ApprovalStepStatus,
  MembershipStatus,
  Permission,
  RequestStatus,
  roleHasPermission,
} from '@procureflow/shared';
import type {
  ApprovalDecisionActions,
  ApprovalDetail,
  ApprovalHistoryResult,
  ApprovalInboxItem,
  ApprovalInboxResult,
  ApprovalInboxSummary,
  ApprovalPersonSummary,
  Currency,
  Priority,
  WorkspaceRole,
} from '@procureflow/shared';
import { AppError } from '../errors/app-error.js';
import { AuditAction, writeAuditLog } from '../lib/audit.js';
import type { AuditContext } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import {
  approvalCycleInclude,
  approvalPersonSelect,
  loadApprovalCycles,
  toApprovalCycleSummary,
  toApprovalPerson,
} from './approval-queries.js';
import { getPurchaseRequestDetail } from './purchase-request.service.js';
import type { ListApprovalsQueryInput } from '../validators/approval.schemas.js';
import { transitionPurchaseRequest } from './request-state-machine.js';

export interface ApprovalActor {
  userId: string;
  membershipId: string;
  role: WorkspaceRole;
}

const DEFAULT_PAGE_SIZE = 20;

const decisionInclude = {
  requestedBy: { select: approvalPersonSelect },
  purchaseRequest: {
    include: {
      requestedBy: { select: approvalPersonSelect },
    },
  },
  steps: {
    orderBy: [{ levelOrder: 'asc' as const }, { stepOrder: 'asc' as const }],
    include: {
      approver: { select: approvalPersonSelect },
      decidedBy: { select: approvalPersonSelect },
    },
  },
} satisfies Prisma.ApprovalInclude;

interface DecisionActionContext {
  status: string;
  currentLevel: number;
  expiresAt: Date | null;
  steps: Array<{
    id: string;
    approverId: string | null;
    levelOrder: number;
    status: string;
    isActive: boolean;
  }>;
  purchaseRequest: { requestedById: string; status: string };
}

const inboxInclude = {
  approval: {
    include: {
      purchaseRequest: {
        include: {
          requestedBy: { select: approvalPersonSelect },
        },
      },
    },
  },
} satisfies Prisma.ApprovalStepInclude;

type InboxStep = Prisma.ApprovalStepGetPayload<{ include: typeof inboxInclude }>;

function forbiddenError(message = 'You do not have permission to perform this action.'): AppError {
  return new AppError(message, { statusCode: 403, code: 'FORBIDDEN' });
}

function approvalNotFoundError(): AppError {
  return new AppError('Approval not found in this workspace.', {
    statusCode: 404,
    code: 'APPROVAL_NOT_FOUND',
  });
}

function requestNotFoundError(): AppError {
  return new AppError('Purchase request not found in this workspace.', {
    statusCode: 404,
    code: 'REQUEST_NOT_FOUND',
  });
}

function assertApprovalsRead(actor: ApprovalActor): void {
  if (!roleHasPermission(actor.role, Permission.ApprovalsRead)) {
    throw forbiddenError();
  }
}

function requiredPerson(person: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
}): ApprovalPersonSummary {
  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    jobTitle: person.jobTitle,
  };
}

function endOfUtcDay(value: Date): Date {
  const date = new Date(value);
  date.setUTCHours(23, 59, 59, 999);
  return date;
}

function toInboxItem(step: InboxStep): ApprovalInboxItem {
  const approval = step.approval;
  const request = approval.purchaseRequest;

  return {
    approvalId: approval.id,
    cycleNumber: approval.cycleNumber,
    approvalStatus: approval.status as ApprovalCycleStatus,
    requestId: request.id,
    requestNumber: request.requestNumber,
    title: request.title,
    requester: requiredPerson(request.requestedBy),
    department: request.department,
    amount: request.totalAmount.toFixed(2),
    currency: request.currency as Currency,
    priority: request.priority as Priority,
    submittedAt: (request.submittedAt ?? approval.requestedAt).toISOString(),
    levelOrder: step.levelOrder,
    levelName: step.name,
    levelCount: approval.levelCount,
    completionRule: step.levelRule as ApprovalLevelRule,
    stepStatus: step.status as ApprovalStepStatus,
    assignedAt: step.createdAt.toISOString(),
    isActive: step.isActive,
  };
}

export async function listAssignedApprovals(
  workspaceId: string,
  query: ListApprovalsQueryInput,
  actor: ApprovalActor,
): Promise<ApprovalInboxResult> {
  assertApprovalsRead(actor);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  const search = query.search?.trim();
  const filters: Prisma.ApprovalStepWhereInput[] = [
    {
      approverId: actor.userId,
      approval: {
        workspaceId,
        purchaseRequest: { deletedAt: null },
      },
    },
  ];

  if (query.status) {
    filters.push({ status: query.status });
  } else {
    filters.push({
      status: 'pending',
      isActive: true,
      approval: {
        status: 'pending',
        purchaseRequest: { status: RequestStatus.PendingApproval },
      },
    });
  }

  if (query.priority) {
    filters.push({ approval: { purchaseRequest: { priority: query.priority } } });
  }

  if (query.requesterId) {
    filters.push({
      approval: { purchaseRequest: { requestedById: query.requesterId } },
    });
  }

  if (query.requester) {
    filters.push({
      approval: {
        purchaseRequest: {
          requestedBy: {
            OR: [
              { firstName: { contains: query.requester, mode: 'insensitive' } },
              { lastName: { contains: query.requester, mode: 'insensitive' } },
              { email: { contains: query.requester, mode: 'insensitive' } },
            ],
          },
        },
      },
    });
  }

  if (query.minAmount || query.maxAmount) {
    filters.push({
      approval: {
        purchaseRequest: {
          totalAmount: {
            ...(query.minAmount ? { gte: new Prisma.Decimal(query.minAmount) } : {}),
            ...(query.maxAmount ? { lte: new Prisma.Decimal(query.maxAmount) } : {}),
          },
        },
      },
    });
  }

  if (query.from || query.to) {
    filters.push({
      approval: {
        purchaseRequest: {
          submittedAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: endOfUtcDay(query.to) } : {}),
          },
        },
      },
    });
  }

  if (search) {
    filters.push({
      approval: {
        purchaseRequest: {
          OR: [
            { requestNumber: { contains: search, mode: 'insensitive' } },
            { title: { contains: search, mode: 'insensitive' } },
            { department: { contains: search, mode: 'insensitive' } },
            { requestedBy: { firstName: { contains: search, mode: 'insensitive' } } },
            { requestedBy: { lastName: { contains: search, mode: 'insensitive' } } },
          ],
        },
      },
    });
  }

  const where: Prisma.ApprovalStepWhereInput = { AND: filters };

  const [total, steps, statusGroups, actionablePending] = await prisma.$transaction([
    prisma.approvalStep.count({ where }),
    prisma.approvalStep.findMany({
      where,
      include: inboxInclude,
      orderBy: [{ approval: { requestedAt: 'desc' } }, { levelOrder: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.approvalStep.groupBy({
      by: ['status'],
      where: {
        approverId: actor.userId,
        approval: { workspaceId, purchaseRequest: { deletedAt: null } },
      },
      _count: { _all: true },
    }),
    prisma.approvalStep.count({
      where: {
        approverId: actor.userId,
        status: ApprovalStepStatus.Pending,
        isActive: true,
        approval: {
          workspaceId,
          status: ApprovalCycleStatus.Pending,
          purchaseRequest: { deletedAt: null, status: RequestStatus.PendingApproval },
        },
      },
    }),
  ]);

  const countFor = (status: ApprovalStepStatus): number =>
    statusGroups.find((group) => group.status === status)?._count._all ?? 0;

  const summary: ApprovalInboxSummary = {
    pending: actionablePending,
    approved: countFor(ApprovalStepStatus.Approved),
    rejected: countFor(ApprovalStepStatus.Rejected),
    changesRequested: countFor(ApprovalStepStatus.ChangesRequested),
  };

  return {
    items: steps.map(toInboxItem),
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    summary,
  };
}

function decisionActionsFor(
  approval: DecisionActionContext,
  actor: ApprovalActor,
): ApprovalDecisionActions {
  const currentLevelSteps = approval.steps.filter(
    (step) => step.levelOrder === approval.currentLevel,
  );
  const ownStep = currentLevelSteps.find((step) => step.approverId === actor.userId);
  let blockedReason: string | null = null;

  if (approval.status !== ApprovalCycleStatus.Pending) {
    blockedReason = 'This approval cycle is complete.';
  } else if (approval.purchaseRequest.status !== RequestStatus.PendingApproval) {
    blockedReason = 'This request is no longer awaiting approval.';
  } else if (approval.purchaseRequest.requestedById === actor.userId) {
    blockedReason = 'You cannot approve your own request.';
  } else if (approval.expiresAt && approval.expiresAt.getTime() <= Date.now()) {
    blockedReason = 'This approval has expired.';
  } else if (!ownStep) {
    const decidedStep = approval.steps.find(
      (step) => step.approverId === actor.userId && step.status !== ApprovalStepStatus.Pending,
    );
    blockedReason = decidedStep
      ? 'You have already decided your part of this approval.'
      : 'You are not the assigned approver for the current level.';
  } else if (ownStep.status !== ApprovalStepStatus.Pending) {
    blockedReason = 'You have already decided this approval.';
  } else if (!ownStep.isActive) {
    blockedReason = 'The current approval level is assigned to another approver.';
  }

  const actionable = blockedReason === null && ownStep !== undefined;

  return {
    canApprove: actionable,
    canReject: actionable,
    canRequestChanges: actionable,
    assignedStepId: actionable ? (ownStep?.id ?? null) : null,
    blockedReason,
  };
}

export async function getApprovalDetail(
  workspaceId: string,
  approvalId: string,
  actor: ApprovalActor,
): Promise<ApprovalDetail> {
  const approval = await prisma.approval.findFirst({
    where: { id: approvalId, workspaceId },
    include: {
      ...approvalCycleInclude,
      purchaseRequest: {
        select: {
          id: true,
          requestedById: true,
          deletedAt: true,
          status: true,
          requestedBy: { select: approvalPersonSelect },
        },
      },
    },
  });

  if (!approval || approval.purchaseRequest.deletedAt) {
    throw approvalNotFoundError();
  }

  const canView =
    roleHasPermission(actor.role, Permission.ApprovalsRead) ||
    approval.purchaseRequest.requestedById === actor.userId;

  if (!canView) {
    throw approvalNotFoundError();
  }

  const request = await getPurchaseRequestDetail(workspaceId, approval.purchaseRequestId, actor);
  const summary = toApprovalCycleSummary(approval);
  const history = await loadApprovalCycles(workspaceId, approval.purchaseRequestId);

  return {
    ...summary,
    request,
    actions: decisionActionsFor(approval, actor),
    history,
  };
}

function notAssignedError(): AppError {
  return new AppError(
    'Only the assigned approver for the current level can decide this approval.',
    {
      statusCode: 403,
      code: 'NOT_ASSIGNED_APPROVER',
    },
  );
}

function stepAlreadyDecidedError(): AppError {
  return new AppError('This approval step has already been decided.', {
    statusCode: 409,
    code: 'STEP_ALREADY_DECIDED',
  });
}

function stepInactiveError(): AppError {
  return new AppError('This approval step is no longer active.', {
    statusCode: 409,
    code: 'APPROVAL_STEP_INACTIVE',
  });
}

function approvalNotPendingError(): AppError {
  return new AppError('This approval cycle is no longer pending.', {
    statusCode: 409,
    code: 'APPROVAL_NOT_PENDING',
  });
}

type DecisionKind = 'approve' | 'reject' | 'request_changes';

async function decideApproval(
  workspaceId: string,
  approvalId: string,
  kind: DecisionKind,
  note: string | null,
  actor: ApprovalActor,
  auditContext: AuditContext,
): Promise<ApprovalDetail> {
  if (!roleHasPermission(actor.role, Permission.ApprovalsDecide)) {
    throw forbiddenError();
  }

  if (kind !== 'approve' && (!note || note.trim().length === 0)) {
    throw new AppError(
      kind === 'reject'
        ? 'Enter a reason for rejecting this request.'
        : 'Explain the changes the requester needs to make.',
      {
        statusCode: 422,
        code: 'VALIDATION_ERROR',
        details: {
          fieldErrors: {
            [kind === 'reject' ? 'reason' : 'explanation']: [
              kind === 'reject'
                ? 'Enter a reason for rejecting this request.'
                : 'Explain the changes the requester needs to make.',
            ],
          },
        },
      },
    );
  }

  const approvalExists = await prisma.$transaction(async (transaction) => {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "approvals"
      WHERE "id" = ${approvalId}::uuid
        AND "workspace_id" = ${workspaceId}::uuid
      FOR UPDATE
    `;

    if (locked.length === 0) {
      throw approvalNotFoundError();
    }

    await transaction.$queryRaw`
      SELECT "id"
      FROM "approval_steps"
      WHERE "approval_id" = ${approvalId}::uuid
      FOR UPDATE
    `;

    const approval = await transaction.approval.findFirst({
      where: { id: approvalId, workspaceId },
      include: decisionInclude,
    });

    if (!approval || approval.purchaseRequest.deletedAt) {
      throw approvalNotFoundError();
    }

    if (approval.status !== ApprovalCycleStatus.Pending) {
      throw approvalNotPendingError();
    }

    if (approval.purchaseRequest.status !== RequestStatus.PendingApproval) {
      throw new AppError('This request is not awaiting approval.', {
        statusCode: 409,
        code: 'REQUEST_NOT_PENDING_APPROVAL',
      });
    }

    if (approval.expiresAt && approval.expiresAt.getTime() <= Date.now()) {
      throw new AppError('This approval has expired.', {
        statusCode: 409,
        code: 'APPROVAL_EXPIRED',
      });
    }

    const membership = await transaction.workspaceMember.findFirst({
      where: { workspaceId, userId: actor.userId },
      select: { status: true },
    });

    if (!membership) {
      throw forbiddenError('You are not a member of this workspace.');
    }

    if (membership.status !== MembershipStatus.Active) {
      throw forbiddenError('Your workspace access has been suspended.');
    }

    if (approval.purchaseRequest.requestedById === actor.userId) {
      throw new AppError('You cannot approve your own purchase request.', {
        statusCode: 403,
        code: 'SELF_APPROVAL_NOT_ALLOWED',
      });
    }

    const currentLevelSteps = approval.steps.filter(
      (step) => step.levelOrder === approval.currentLevel,
    );
    const ownStep = currentLevelSteps.find((step) => step.approverId === actor.userId);

    if (!ownStep) {
      const ownAnyLevel = approval.steps.find((step) => step.approverId === actor.userId);

      if (ownAnyLevel && ownAnyLevel.status !== ApprovalStepStatus.Pending) {
        throw stepAlreadyDecidedError();
      }

      throw notAssignedError();
    }

    if (ownStep.status !== ApprovalStepStatus.Pending) {
      throw stepAlreadyDecidedError();
    }

    if (!ownStep.isActive) {
      throw stepInactiveError();
    }

    const now = new Date();
    const decisionStatus =
      kind === 'approve'
        ? ApprovalStepStatus.Approved
        : kind === 'reject'
          ? ApprovalStepStatus.Rejected
          : ApprovalStepStatus.ChangesRequested;

    await transaction.approvalStep.update({
      where: { id: ownStep.id },
      data: {
        status: decisionStatus,
        decisionNote: note,
        decidedById: actor.userId,
        decidedAt: now,
        ...(kind === 'approve' ? {} : { isActive: false }),
      },
    });

    const requestNumber = approval.purchaseRequest.requestNumber;
    const auditMetadata = {
      requestId: approval.purchaseRequestId,
      requestNumber,
      approvalId: approval.id,
      cycleNumber: approval.cycleNumber,
      stepId: ownStep.id,
      levelOrder: ownStep.levelOrder,
      decision: decisionStatus,
      decisionNote: note,
    };

    if (kind === 'reject' || kind === 'request_changes') {
      await transaction.approvalStep.updateMany({
        where: {
          approvalId: approval.id,
          status: ApprovalStepStatus.Pending,
          id: { not: ownStep.id },
        },
        data: {
          status: ApprovalStepStatus.Cancelled,
          isActive: false,
          cancelledAt: now,
        },
      });

      await transaction.approval.update({
        where: { id: approval.id },
        data: {
          status:
            kind === 'reject' ? ApprovalCycleStatus.Rejected : ApprovalCycleStatus.ChangesRequested,
          completedAt: now,
        },
      });

      await transitionPurchaseRequest(transaction, {
        workspaceId,
        requestId: approval.purchaseRequestId,
        toStatus: kind === 'reject' ? RequestStatus.Rejected : RequestStatus.ChangesRequested,
        expectedStatus: RequestStatus.PendingApproval,
        data: { decidedAt: kind === 'reject' ? now : null },
        auditContext,
        audit: {
          action:
            kind === 'reject' ? AuditAction.ApprovalRejected : AuditAction.ApprovalChangesRequested,
          summary:
            kind === 'reject'
              ? `Rejected ${requestNumber} at level ${ownStep.levelOrder}.`
              : `Requested changes to ${requestNumber} at level ${ownStep.levelOrder}.`,
          metadata: auditMetadata,
        },
      });

      await writeAuditLog(transaction, auditContext, {
        workspaceId,
        action: AuditAction.ApprovalCycleCompleted,
        entityType: 'purchase_request',
        entityId: approval.purchaseRequestId,
        summary:
          kind === 'reject'
            ? `Approval cycle ${approval.cycleNumber} ended with a rejection.`
            : `Approval cycle ${approval.cycleNumber} ended with changes requested.`,
        metadata: {
          ...auditMetadata,
          outcome:
            kind === 'reject' ? ApprovalCycleStatus.Rejected : ApprovalCycleStatus.ChangesRequested,
        },
      });

      return true;
    }

    const updatedLevelSteps = currentLevelSteps.map((step) =>
      step.id === ownStep.id ? { ...step, status: decisionStatus } : step,
    );
    const levelComplete =
      ownStep.levelRule === ApprovalLevelRule.AnyOne
        ? updatedLevelSteps.some((step) => step.status === ApprovalStepStatus.Approved)
        : updatedLevelSteps.every(
            (step) =>
              step.status === ApprovalStepStatus.Approved ||
              step.status === ApprovalStepStatus.Skipped,
          );

    await writeAuditLog(transaction, auditContext, {
      workspaceId,
      action: AuditAction.ApprovalApproved,
      entityType: 'purchase_request',
      entityId: approval.purchaseRequestId,
      summary: `Approved ${requestNumber} at level ${ownStep.levelOrder}.`,
      metadata: auditMetadata,
    });

    if (!levelComplete) {
      return true;
    }

    if (ownStep.levelRule === ApprovalLevelRule.AnyOne) {
      await transaction.approvalStep.updateMany({
        where: {
          approvalId: approval.id,
          levelOrder: ownStep.levelOrder,
          status: ApprovalStepStatus.Pending,
          id: { not: ownStep.id },
        },
        data: {
          status: ApprovalStepStatus.Skipped,
          isActive: false,
        },
      });
    }

    await transaction.approvalStep.updateMany({
      where: { approvalId: approval.id, levelOrder: ownStep.levelOrder },
      data: { isActive: false },
    });

    if (approval.currentLevel < approval.levelCount) {
      const nextLevel = approval.currentLevel + 1;

      await transaction.approvalStep.updateMany({
        where: {
          approvalId: approval.id,
          levelOrder: nextLevel,
          status: ApprovalStepStatus.Pending,
        },
        data: { isActive: true },
      });

      await transaction.approval.update({
        where: { id: approval.id },
        data: { currentLevel: nextLevel },
      });

      return true;
    }

    await transaction.approvalStep.updateMany({
      where: { approvalId: approval.id, status: ApprovalStepStatus.Pending },
      data: {
        status: ApprovalStepStatus.Cancelled,
        isActive: false,
        cancelledAt: now,
      },
    });

    await transaction.approval.update({
      where: { id: approval.id },
      data: {
        status: ApprovalCycleStatus.Approved,
        completedAt: now,
        currentLevel: approval.levelCount,
      },
    });

    await transitionPurchaseRequest(transaction, {
      workspaceId,
      requestId: approval.purchaseRequestId,
      toStatus: RequestStatus.Approved,
      expectedStatus: RequestStatus.PendingApproval,
      data: { decidedAt: now },
      auditContext,
      audit: {
        action: AuditAction.ApprovalCycleCompleted,
        summary: `Completed approval cycle ${approval.cycleNumber}: ${requestNumber} approved.`,
        metadata: {
          ...auditMetadata,
          outcome: ApprovalCycleStatus.Approved,
        },
      },
    });

    return true;
  });

  if (!approvalExists) {
    throw approvalNotFoundError();
  }

  return getApprovalDetail(workspaceId, approvalId, actor);
}

export async function approveApproval(
  workspaceId: string,
  approvalId: string,
  comment: string | null,
  actor: ApprovalActor,
  auditContext: AuditContext,
): Promise<ApprovalDetail> {
  return decideApproval(workspaceId, approvalId, 'approve', comment, actor, auditContext);
}

export async function rejectApproval(
  workspaceId: string,
  approvalId: string,
  reason: string,
  actor: ApprovalActor,
  auditContext: AuditContext,
): Promise<ApprovalDetail> {
  return decideApproval(workspaceId, approvalId, 'reject', reason, actor, auditContext);
}

export async function requestApprovalChanges(
  workspaceId: string,
  approvalId: string,
  explanation: string,
  actor: ApprovalActor,
  auditContext: AuditContext,
): Promise<ApprovalDetail> {
  return decideApproval(
    workspaceId,
    approvalId,
    'request_changes',
    explanation,
    actor,
    auditContext,
  );
}

export async function getRequestApprovalHistory(
  workspaceId: string,
  requestId: string,
  actor: ApprovalActor,
): Promise<ApprovalHistoryResult> {
  const request = await prisma.purchaseRequest.findFirst({
    where: { id: requestId, workspaceId, deletedAt: null },
    select: { id: true, requestedById: true },
  });

  if (!request) {
    throw requestNotFoundError();
  }

  const hasWorkspaceRead = roleHasPermission(actor.role, Permission.RequestsRead);
  const hasOwnRead = roleHasPermission(actor.role, Permission.RequestsReadOwn);
  const hasApprovalsRead = roleHasPermission(actor.role, Permission.ApprovalsRead);

  if (
    !hasWorkspaceRead &&
    !(hasOwnRead && request.requestedById === actor.userId) &&
    !hasApprovalsRead
  ) {
    throw requestNotFoundError();
  }

  return { items: await loadApprovalCycles(workspaceId, requestId) };
}

export { toApprovalPerson };
