import type { Prisma } from '@prisma/client';
import { ApprovalLevelRule, ApprovalStepStatus } from '@procureflow/shared';
import type {
  ApprovalCycleStatus,
  ApprovalCycleSummary,
  ApprovalLevelRecord,
  ApprovalPersonSummary,
  ApprovalStepRecord,
  ApproverAssignmentType,
  WorkspaceRole,
} from '@procureflow/shared';
import { prisma } from '../lib/prisma.js';

export const approvalPersonSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  jobTitle: true,
} satisfies Prisma.UserSelect;

export const approvalCycleInclude = {
  requestedBy: { select: approvalPersonSelect },
  steps: {
    orderBy: [{ levelOrder: 'asc' as const }, { stepOrder: 'asc' as const }],
    include: {
      approver: { select: approvalPersonSelect },
      decidedBy: { select: approvalPersonSelect },
    },
  },
} satisfies Prisma.ApprovalInclude;

export type ApprovalCycleWithSteps = Prisma.ApprovalGetPayload<{
  include: typeof approvalCycleInclude;
}>;

export type ApprovalPersonRow = Prisma.UserGetPayload<{ select: typeof approvalPersonSelect }>;

export function toApprovalPerson(person: ApprovalPersonRow | null): ApprovalPersonSummary | null {
  if (!person) {
    return null;
  }

  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    jobTitle: person.jobTitle,
  };
}

function deriveLevelStatus(steps: ApprovalStepRecord[]): ApprovalStepStatus {
  if (steps.some((step) => step.status === ApprovalStepStatus.Rejected)) {
    return ApprovalStepStatus.Rejected;
  }

  if (steps.some((step) => step.status === ApprovalStepStatus.ChangesRequested)) {
    return ApprovalStepStatus.ChangesRequested;
  }

  if (steps.some((step) => step.status === ApprovalStepStatus.Pending)) {
    return ApprovalStepStatus.Pending;
  }

  if (steps.every((step) => step.status === ApprovalStepStatus.Cancelled)) {
    return ApprovalStepStatus.Cancelled;
  }

  if (steps.some((step) => step.status === ApprovalStepStatus.Approved)) {
    return ApprovalStepStatus.Approved;
  }

  if (steps.every((step) => step.status === ApprovalStepStatus.Skipped)) {
    return ApprovalStepStatus.Skipped;
  }

  return ApprovalStepStatus.Cancelled;
}

function toStepRecord(step: ApprovalCycleWithSteps['steps'][number]): ApprovalStepRecord {
  return {
    id: step.id,
    levelOrder: step.levelOrder,
    stepOrder: step.stepOrder,
    name: step.name,
    assignmentType: step.assignmentType as ApproverAssignmentType,
    assignedRole: step.assignedRole as WorkspaceRole | null,
    approver: toApprovalPerson(step.approver),
    status: step.status as ApprovalStepStatus,
    decisionNote: step.decisionNote,
    decidedAt: step.decidedAt?.toISOString() ?? null,
    decidedBy: toApprovalPerson(step.decidedBy),
    isActive: step.isActive,
    createdAt: step.createdAt.toISOString(),
  };
}

export function toApprovalCycleSummary(approval: ApprovalCycleWithSteps): ApprovalCycleSummary {
  const stepRecords = approval.steps.map(toStepRecord);
  const levelsByOrder = new Map<number, ApprovalCycleWithSteps['steps']>();

  for (const step of approval.steps) {
    const levelSteps = levelsByOrder.get(step.levelOrder) ?? [];
    levelSteps.push(step);
    levelsByOrder.set(step.levelOrder, levelSteps);
  }

  const levels: ApprovalLevelRecord[] = [...levelsByOrder.entries()]
    .sort(([left], [right]) => left - right)
    .map(([levelOrder, levelSteps]) => {
      const records = stepRecords.filter((step) => step.levelOrder === levelOrder);

      return {
        levelOrder,
        name: levelSteps[0]?.name ?? `Level ${levelOrder}`,
        completionRule:
          (levelSteps[0]?.levelRule as ApprovalLevelRule | undefined) ??
          ApprovalLevelRule.AllRequired,
        status: deriveLevelStatus(records),
        steps: records,
      };
    });

  return {
    id: approval.id,
    cycleNumber: approval.cycleNumber,
    status: approval.status as ApprovalCycleStatus,
    workflowName: approval.workflowName,
    workflowDescription: approval.workflowDescription,
    currentLevel: approval.currentLevel,
    levelCount: approval.levelCount,
    requestedAt: approval.requestedAt.toISOString(),
    completedAt: approval.completedAt?.toISOString() ?? null,
    requestedBy: toApprovalPerson(approval.requestedBy),
    levels,
  };
}

export async function loadApprovalCycles(
  workspaceId: string,
  requestId: string,
): Promise<ApprovalCycleSummary[]> {
  const approvals = await prisma.approval.findMany({
    where: { workspaceId, purchaseRequestId: requestId },
    include: approvalCycleInclude,
    orderBy: { cycleNumber: 'asc' },
  });

  return approvals.map(toApprovalCycleSummary);
}
