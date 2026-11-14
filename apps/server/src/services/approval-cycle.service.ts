import type { Prisma } from '@prisma/client';
import {
  ApprovalLevelRule,
  ApproverAssignmentType,
  MembershipStatus,
  Permission,
  roleHasPermission,
} from '@procureflow/shared';
import type { WorkspaceRole } from '@procureflow/shared';
import { AppError } from '../errors/app-error.js';
import { AuditAction, writeAuditLog } from '../lib/audit.js';
import type { AuditContext } from '../lib/audit.js';
import { toWorkspaceRole } from '../lib/roles.js';
import { approvalPersonSelect } from './approval-queries.js';
import { resolveWorkflowForRequest } from './approval-workflow.service.js';
import type { PurchaseRequestRow } from './request-state-machine.js';

export interface ApprovalCycleActor {
  userId: string;
  membershipId: string;
  role: WorkspaceRole;
}

interface ResolvedApprover {
  userId: string;
  assignmentType: ApproverAssignmentType;
  assignedRole: WorkspaceRole | null;
  name: string;
}

interface ResolvedLevel {
  levelOrder: number;
  name: string;
  completionRule: ApprovalLevelRule;
  approvers: ResolvedApprover[];
}

export interface CreatedApprovalCycle {
  approvalId: string;
  cycleNumber: number;
  workflowName: string;
  levelCount: number;
}

function approverUnavailableError(levelOrder: number, memberId: string): AppError {
  return new AppError(
    'An approver assigned to this workflow is no longer an active workspace member with approval permission. Update the workflow before submitting.',
    {
      statusCode: 409,
      code: 'APPROVER_UNAVAILABLE',
      details: { levelOrder, memberId },
    },
  );
}

function noEligibleApproversError(levelOrder: number, levelName: string): AppError {
  return new AppError(
    `Approval level “${levelName}” has no eligible approvers for this request. Requesters cannot approve their own requests.`,
    {
      statusCode: 409,
      code: 'NO_ELIGIBLE_APPROVERS',
      details: { levelOrder, levelName },
    },
  );
}

/**
 * Snapshots the selected workflow into approval and step rows. The workflow
 * itself can be edited later without changing this cycle. Role assignments are
 * expanded to concrete active members at submission time, and the requester is
 * always excluded to prevent self-approval.
 */
export async function createApprovalCycle(
  transaction: Prisma.TransactionClient,
  params: {
    workspaceId: string;
    request: PurchaseRequestRow;
    actor: ApprovalCycleActor;
    auditContext: AuditContext;
    auditAction: string;
  },
): Promise<CreatedApprovalCycle> {
  const { workspaceId, request, actor, auditContext, auditAction } = params;

  const activeCycle = await transaction.approval.findFirst({
    where: { purchaseRequestId: request.id, status: 'pending' },
    select: { id: true },
  });

  if (activeCycle) {
    throw new AppError('This purchase request already has an active approval cycle.', {
      statusCode: 409,
      code: 'ACTIVE_APPROVAL_EXISTS',
    });
  }

  const workflow = await resolveWorkflowForRequest(
    transaction,
    workspaceId,
    request.currency,
    request.totalAmount,
  );

  if (workflow.levels.length === 0) {
    throw new AppError('The selected approval workflow has no approval levels.', {
      statusCode: 409,
      code: 'WORKFLOW_NOT_READY',
    });
  }

  const explicitMemberIds = new Set<string>();
  const assignedRoles = new Set<string>();

  for (const level of workflow.levels) {
    for (const approver of level.approvers) {
      if (approver.memberId) {
        explicitMemberIds.add(approver.memberId);
      }

      if (approver.role) {
        assignedRoles.add(approver.role);
      }
    }
  }

  const explicitMembers =
    explicitMemberIds.size > 0
      ? await transaction.workspaceMember.findMany({
          where: { workspaceId, id: { in: [...explicitMemberIds] } },
          include: { user: { select: approvalPersonSelect } },
        })
      : [];
  const explicitMembersById = new Map(explicitMembers.map((member) => [member.id, member]));

  const roleMembers =
    assignedRoles.size > 0
      ? await transaction.workspaceMember.findMany({
          where: {
            workspaceId,
            status: 'active',
            role: {
              in: [...assignedRoles] as NonNullable<Prisma.WorkspaceMemberCreateInput['role']>[],
            },
          },
          include: { user: { select: approvalPersonSelect } },
          orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
        })
      : [];

  const resolvedLevels: ResolvedLevel[] = workflow.levels.map((level) => {
    const resolved = new Map<string, ResolvedApprover>();

    for (const approver of level.approvers) {
      if (approver.assignmentType === ApproverAssignmentType.Member) {
        if (!approver.memberId) {
          throw approverUnavailableError(level.levelOrder, 'unknown');
        }

        const member = explicitMembersById.get(approver.memberId);

        if (
          !member ||
          member.status !== MembershipStatus.Active ||
          !roleHasPermission(toWorkspaceRole(member.role), Permission.ApprovalsDecide)
        ) {
          throw approverUnavailableError(level.levelOrder, approver.memberId);
        }

        if (member.userId === request.requestedById) {
          continue;
        }

        resolved.set(member.userId, {
          userId: member.userId,
          assignmentType: ApproverAssignmentType.Member,
          assignedRole: null,
          name: `${member.user.firstName} ${member.user.lastName}`,
        });
        continue;
      }

      const role = approver.role as WorkspaceRole | null;

      if (!role || !roleHasPermission(role, Permission.ApprovalsDecide)) {
        throw approverUnavailableError(level.levelOrder, 'role');
      }

      const eligible = roleMembers.filter(
        (member) =>
          member.role === role &&
          member.userId !== request.requestedById &&
          roleHasPermission(toWorkspaceRole(member.role), Permission.ApprovalsDecide),
      );

      if (eligible.length === 0) {
        throw noEligibleApproversError(level.levelOrder, level.name);
      }

      for (const member of eligible) {
        if (resolved.has(member.userId)) {
          continue;
        }

        resolved.set(member.userId, {
          userId: member.userId,
          assignmentType: ApproverAssignmentType.Role,
          assignedRole: role,
          name: `${member.user.firstName} ${member.user.lastName}`,
        });
      }
    }

    if (resolved.size === 0) {
      throw noEligibleApproversError(level.levelOrder, level.name);
    }

    return {
      levelOrder: level.levelOrder,
      name: level.name,
      completionRule: level.completionRule as ApprovalLevelRule,
      approvers: [...resolved.values()],
    };
  });

  const maxCycle = await transaction.approval.aggregate({
    where: { purchaseRequestId: request.id },
    _max: { cycleNumber: true },
  });
  const cycleNumber = (maxCycle._max.cycleNumber ?? 0) + 1;

  let stepOrder = 0;
  const steps = resolvedLevels.flatMap((level) =>
    level.approvers.map((approver) => {
      stepOrder += 1;

      return {
        levelOrder: level.levelOrder,
        stepOrder,
        name: level.name,
        levelRule:
          level.completionRule === ApprovalLevelRule.AnyOne
            ? ('any_one' as const)
            : ('all_required' as const),
        assignmentType:
          approver.assignmentType === ApproverAssignmentType.Member
            ? ('member' as const)
            : ('role' as const),
        assignedRole: approver.assignedRole,
        approver: { connect: { id: approver.userId } },
        status: 'pending' as const,
        isActive: level.levelOrder === 1,
        approverName: approver.name,
      };
    }),
  );

  const approval = await transaction.approval.create({
    data: {
      workspace: { connect: { id: workspaceId } },
      purchaseRequest: { connect: { id: request.id } },
      workflow: { connect: { id: workflow.id } },
      workflowName: workflow.name,
      workflowDescription: workflow.description,
      cycleNumber,
      status: 'pending',
      currentLevel: 1,
      levelCount: resolvedLevels.length,
      requestedBy: { connect: { id: actor.userId } },
      steps: {
        create: steps.map(({ approverName: _approverName, ...step }) => step),
      },
    },
    include: { steps: true },
  });

  await writeAuditLog(transaction, auditContext, {
    workspaceId,
    action: AuditAction.ApprovalCycleCreated,
    entityType: 'purchase_request',
    entityId: request.id,
    summary: `Started approval cycle ${cycleNumber} using “${workflow.name}”.`,
    metadata: {
      requestId: request.id,
      requestNumber: request.requestNumber,
      approvalId: approval.id,
      cycleNumber,
      workflowId: workflow.id,
      workflowName: workflow.name,
      levelCount: resolvedLevels.length,
      stepCount: approval.steps.length,
    },
  });

  for (const step of approval.steps) {
    const approver = steps.find((candidate) => candidate.stepOrder === step.stepOrder);

    await writeAuditLog(transaction, auditContext, {
      workspaceId,
      action: AuditAction.ApprovalStepAssigned,
      entityType: 'purchase_request',
      entityId: request.id,
      summary: `Assigned level ${step.levelOrder} approval to ${approver?.approverName ?? 'an approver'}.`,
      metadata: {
        requestId: request.id,
        requestNumber: request.requestNumber,
        approvalId: approval.id,
        cycleNumber,
        stepId: step.id,
        levelOrder: step.levelOrder,
        stepOrder: step.stepOrder,
        approverId: step.approverId,
        assignmentType: step.assignmentType,
        assignedRole: step.assignedRole,
        auditAction,
      },
    });
  }

  return {
    approvalId: approval.id,
    cycleNumber,
    workflowName: workflow.name,
    levelCount: resolvedLevels.length,
  };
}
