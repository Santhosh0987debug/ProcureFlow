import { Prisma } from '@prisma/client';
import {
  ApprovalLevelRule,
  ApproverAssignmentType,
  MembershipStatus,
  Permission,
  roleHasPermission,
} from '@procureflow/shared';
import type {
  ApprovalPersonSummary,
  ApprovalWorkflowDetail,
  ApprovalWorkflowLevelRecord,
  ApprovalWorkflowListResult,
  ApprovalWorkflowMemberRecord,
  ApprovalWorkflowPreview,
  ApprovalWorkflowPreviewLevel,
  ApprovalWorkflowSummary,
  WorkspaceRole,
} from '@procureflow/shared';
import { AppError } from '../errors/app-error.js';
import { AuditAction, writeAuditLog } from '../lib/audit.js';
import type { AuditContext } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import { toWorkspaceRole } from '../lib/roles.js';
import { lockWorkspace } from '../lib/workspace-lock.js';
import { approvalPersonSelect, toApprovalPerson } from './approval-queries.js';
import type {
  ApprovalWorkflowWriteInput,
  ListApprovalWorkflowsQueryInput,
} from '../validators/approval.schemas.js';

export interface ApprovalWorkflowActor {
  userId: string;
  membershipId: string;
  role: WorkspaceRole;
}

const DEFAULT_PAGE_SIZE = 20;

type DbRole = NonNullable<Prisma.WorkspaceMemberCreateInput['role']>;

const workflowApproverInclude = {
  member: {
    include: {
      user: { select: approvalPersonSelect },
    },
  },
} satisfies Prisma.ApprovalWorkflowApproverInclude;

export const workflowInclude = {
  createdBy: { select: approvalPersonSelect },
  levels: {
    orderBy: { levelOrder: 'asc' as const },
    include: {
      approvers: {
        orderBy: { createdAt: 'asc' as const },
        include: workflowApproverInclude,
      },
    },
  },
} satisfies Prisma.ApprovalWorkflowInclude;

export type WorkflowWithLevels = Prisma.ApprovalWorkflowGetPayload<{
  include: typeof workflowInclude;
}>;

type WorkflowLevelWithApprovers = WorkflowWithLevels['levels'][number];
type WorkflowApproverWithMember = WorkflowLevelWithApprovers['approvers'][number];
type WorkflowMemberWithUser = NonNullable<WorkflowApproverWithMember['member']>;

interface WorkflowApproverShape {
  assignmentType: ApproverAssignmentType;
  memberId: string | null;
  role: WorkspaceRole | null;
}

interface WorkflowLevelShape {
  name: string;
  completionRule: ApprovalLevelRule;
  approvers: WorkflowApproverShape[];
}

interface WorkflowAnalysis {
  levels: ApprovalWorkflowPreviewLevel[];
  fieldErrors: Record<string, string[]>;
  warnings: string[];
}

type WorkflowReadClient = Pick<Prisma.TransactionClient, 'workspaceMember'>;

function forbiddenError(): AppError {
  return new AppError('You do not have permission to perform this action.', {
    statusCode: 403,
    code: 'FORBIDDEN',
  });
}

function workflowNotFoundError(): AppError {
  return new AppError('Approval workflow not found in this workspace.', {
    statusCode: 404,
    code: 'WORKFLOW_NOT_FOUND',
  });
}

function validationError(fieldErrors: Record<string, string[]>): AppError {
  return new AppError('Please correct the highlighted workflow configuration.', {
    statusCode: 422,
    code: 'WORKFLOW_VALIDATION_ERROR',
    details: { fieldErrors },
  });
}

function assertPermission(actor: ApprovalWorkflowActor, permission: Permission): void {
  if (!roleHasPermission(actor.role, permission)) {
    throw forbiddenError();
  }
}

export function assertWorkflowRead(actor: ApprovalWorkflowActor): void {
  assertPermission(actor, Permission.ApprovalWorkflowsRead);
}

export function assertWorkflowManage(actor: ApprovalWorkflowActor): void {
  assertPermission(actor, Permission.ApprovalWorkflowsManage);
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

function toWorkflowMember(member: WorkflowMemberWithUser): ApprovalWorkflowMemberRecord {
  return {
    id: member.id,
    userId: member.userId,
    firstName: member.user.firstName,
    lastName: member.user.lastName,
    email: member.user.email,
    jobTitle: member.user.jobTitle,
    role: toWorkspaceRole(member.role),
    status: member.status === MembershipStatus.Suspended ? 'suspended' : 'active',
  };
}

function toWorkflowSummary(workflow: WorkflowWithLevels): ApprovalWorkflowSummary {
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    isActive: workflow.isActive,
    isDefault: workflow.isDefault,
    currency: workflow.currency as ApprovalWorkflowSummary['currency'],
    minAmount: workflow.minAmount?.toFixed(2) ?? null,
    maxAmount: workflow.maxAmount?.toFixed(2) ?? null,
    levelCount: workflow.levels.length,
    approverCount: workflow.levels.reduce((count, level) => count + level.approvers.length, 0),
    createdBy: requiredPerson(workflow.createdBy),
    createdAt: workflow.createdAt.toISOString(),
    updatedAt: workflow.updatedAt.toISOString(),
  };
}

function toWorkflowLevel(level: WorkflowLevelWithApprovers): ApprovalWorkflowLevelRecord {
  return {
    id: level.id,
    levelOrder: level.levelOrder,
    name: level.name,
    completionRule: level.completionRule as ApprovalLevelRule,
    approvers: level.approvers.map((approver) => ({
      id: approver.id,
      assignmentType: approver.assignmentType as ApproverAssignmentType,
      role: approver.role as WorkspaceRole | null,
      member: approver.member ? toWorkflowMember(approver.member) : null,
    })),
  };
}

function toWorkflowDetail(workflow: WorkflowWithLevels): ApprovalWorkflowDetail {
  return {
    ...toWorkflowSummary(workflow),
    levels: workflow.levels.map(toWorkflowLevel),
  };
}

async function loadWorkflow(
  workspaceId: string,
  workflowId: string,
): Promise<WorkflowWithLevels | null> {
  return prisma.approvalWorkflow.findFirst({
    where: { id: workflowId, workspaceId },
    include: workflowInclude,
  });
}

async function requireWorkflow(
  workspaceId: string,
  workflowId: string,
): Promise<WorkflowWithLevels> {
  const workflow = await loadWorkflow(workspaceId, workflowId);

  if (!workflow) {
    throw workflowNotFoundError();
  }

  return workflow;
}

function inputLevelsToShapes(levels: ApprovalWorkflowWriteInput['levels']): WorkflowLevelShape[] {
  return levels.map((level) => ({
    name: level.name,
    completionRule: level.completionRule,
    approvers: level.approvers.map((approver) =>
      approver.assignmentType === ApproverAssignmentType.Member
        ? {
            assignmentType: ApproverAssignmentType.Member,
            memberId: approver.memberId,
            role: null,
          }
        : {
            assignmentType: ApproverAssignmentType.Role,
            memberId: null,
            role: approver.role,
          },
    ),
  }));
}

function persistedLevelsToShapes(levels: WorkflowLevelWithApprovers[]): WorkflowLevelShape[] {
  return levels.map((level) => ({
    name: level.name,
    completionRule: level.completionRule as ApprovalLevelRule,
    approvers: level.approvers.map((approver) => ({
      assignmentType: approver.assignmentType as ApproverAssignmentType,
      memberId: approver.memberId,
      role: approver.role as WorkspaceRole | null,
    })),
  }));
}

function addError(fieldErrors: Record<string, string[]>, key: string, message: string): void {
  const existing = fieldErrors[key] ?? [];
  existing.push(message);
  fieldErrors[key] = existing;
}

/**
 * Resolves configured approvers against the current workspace membership. Used
 * both for editor previews and for blocking activation of empty/ambiguous
 * workflows. Requesters are excluded later, when an approval cycle is created.
 */
async function analyzeWorkflow(
  client: WorkflowReadClient,
  workspaceId: string,
  levels: WorkflowLevelShape[],
): Promise<WorkflowAnalysis> {
  const fieldErrors: Record<string, string[]> = {};
  const warnings: string[] = [];
  const memberIds = new Set<string>();
  const roles = new Set<WorkspaceRole>();

  levels.forEach((level, levelIndex) => {
    if (!level.name.trim()) {
      addError(fieldErrors, `levels.${levelIndex}.name`, 'Enter a name for this level.');
    }

    if (level.approvers.length === 0) {
      addError(
        fieldErrors,
        `levels.${levelIndex}.approvers`,
        'Add at least one approver to this level.',
      );
    }

    level.approvers.forEach((approver) => {
      if (approver.assignmentType === ApproverAssignmentType.Member) {
        if (approver.memberId) {
          memberIds.add(approver.memberId);
        }
      } else if (approver.role) {
        roles.add(approver.role);
      }
    });
  });

  const members =
    memberIds.size > 0
      ? await client.workspaceMember.findMany({
          where: { workspaceId, id: { in: [...memberIds] } },
          include: { user: { select: approvalPersonSelect } },
        })
      : [];
  const membersById = new Map(members.map((member) => [member.id, member]));

  const roleValues = [...roles] as DbRole[];
  const roleMembers =
    roleValues.length > 0
      ? await client.workspaceMember.findMany({
          where: {
            workspaceId,
            status: 'active',
            role: { in: roleValues },
          },
          include: { user: { select: approvalPersonSelect } },
          orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
        })
      : [];

  const previewLevels: ApprovalWorkflowPreviewLevel[] = levels.map((level, levelIndex) => {
    const resolved = new Map<string, ApprovalPersonSummary>();
    const levelWarnings: string[] = [];

    level.approvers.forEach((approver, approverIndex) => {
      const path = `levels.${levelIndex}.approvers.${approverIndex}`;

      if (approver.assignmentType === ApproverAssignmentType.Member) {
        const member = approver.memberId ? membersById.get(approver.memberId) : undefined;

        if (!approver.memberId || !member) {
          addError(fieldErrors, path, 'This member is not part of the workspace.');
          levelWarnings.push('An assigned member is no longer part of the workspace.');
          return;
        }

        if (member.status !== MembershipStatus.Active) {
          addError(fieldErrors, path, 'Suspended members cannot be assigned as approvers.');
          levelWarnings.push(
            `${member.user.firstName} ${member.user.lastName} is suspended and cannot approve.`,
          );
          return;
        }

        if (!roleHasPermission(toWorkspaceRole(member.role), Permission.ApprovalsDecide)) {
          addError(
            fieldErrors,
            path,
            'This member does not hold approval permission in their current role.',
          );
          levelWarnings.push(
            `${member.user.firstName} ${member.user.lastName} does not hold approval permission.`,
          );
          return;
        }

        const person = requiredPerson(member.user);

        if (resolved.has(person.id)) {
          addError(fieldErrors, path, 'This person is already an approver in this level.');
          levelWarnings.push(`${person.firstName} ${person.lastName} appears twice in this level.`);
          return;
        }

        resolved.set(person.id, person);
        return;
      }

      const role = approver.role;

      if (!role || !roleHasPermission(role, Permission.ApprovalsDecide)) {
        addError(fieldErrors, path, 'Select a role that can decide approvals.');
        levelWarnings.push('A configured role cannot decide approvals.');
        return;
      }

      const eligible = roleMembers.filter(
        (member) =>
          member.role === role &&
          roleHasPermission(toWorkspaceRole(member.role), Permission.ApprovalsDecide),
      );

      if (eligible.length === 0) {
        addError(fieldErrors, path, 'No active workspace members currently hold this role.');
        levelWarnings.push(
          `No active members currently hold the ${role.replaceAll('_', ' ')} role.`,
        );
        return;
      }

      for (const member of eligible) {
        const person = requiredPerson(member.user);

        if (resolved.has(person.id)) {
          addError(
            fieldErrors,
            path,
            'This role resolves to a person who is already an approver in this level.',
          );
          levelWarnings.push(`${person.firstName} ${person.lastName} appears twice in this level.`);
          continue;
        }

        resolved.set(person.id, person);
      }
    });

    if (resolved.size === 0) {
      addError(
        fieldErrors,
        `levels.${levelIndex}.approvers`,
        'This level needs at least one eligible active approver.',
      );
    }

    return {
      levelOrder: levelIndex + 1,
      name: level.name,
      completionRule: level.completionRule,
      approvers: [...resolved.values()],
      warnings: levelWarnings,
    };
  });

  for (const level of previewLevels) {
    warnings.push(...level.warnings);
  }

  return { levels: previewLevels, fieldErrors, warnings };
}

async function assertWorkflowNameAvailable(
  transaction: Prisma.TransactionClient,
  workspaceId: string,
  name: string,
  excludeWorkflowId?: string,
): Promise<void> {
  const duplicate = await transaction.approvalWorkflow.findFirst({
    where: {
      workspaceId,
      name: { equals: name, mode: 'insensitive' },
      ...(excludeWorkflowId ? { id: { not: excludeWorkflowId } } : {}),
    },
    select: { id: true },
  });

  if (duplicate) {
    throw validationError({ name: ['A workflow with this name already exists.'] });
  }
}

function assertAmountRange(input: ApprovalWorkflowWriteInput): void {
  if (input.minAmount && input.maxAmount) {
    if (new Prisma.Decimal(input.minAmount).gt(input.maxAmount)) {
      throw validationError({
        maxAmount: ['The maximum amount must be greater than or equal to the minimum amount.'],
      });
    }
  }
}

async function validateWorkflowInput(
  transaction: Prisma.TransactionClient,
  workspaceId: string,
  input: ApprovalWorkflowWriteInput,
  excludeWorkflowId?: string,
): Promise<void> {
  if (!input.name.trim()) {
    throw validationError({ name: ['Enter a workflow name.'] });
  }

  if (input.levels.length === 0) {
    throw validationError({ levels: ['Add at least one approval level.'] });
  }

  assertAmountRange(input);
  await assertWorkflowNameAvailable(transaction, workspaceId, input.name, excludeWorkflowId);

  const analysis = await analyzeWorkflow(
    transaction,
    workspaceId,
    inputLevelsToShapes(input.levels),
  );

  if (Object.keys(analysis.fieldErrors).length > 0) {
    throw validationError(analysis.fieldErrors);
  }
}

function levelsCreateInput(levels: WorkflowLevelShape[]) {
  return levels.map((level, index) => ({
    levelOrder: index + 1,
    name: level.name,
    completionRule:
      level.completionRule === ApprovalLevelRule.AnyOne
        ? ('any_one' as const)
        : ('all_required' as const),
    approvers: {
      create: level.approvers.map((approver) =>
        approver.assignmentType === ApproverAssignmentType.Member
          ? {
              assignmentType: 'member' as const,
              member: { connect: { id: approver.memberId as string } },
            }
          : {
              assignmentType: 'role' as const,
              role: approver.role as WorkspaceRole,
            },
      ),
    },
  }));
}

export async function listApprovalWorkflows(
  workspaceId: string,
  query: ListApprovalWorkflowsQueryInput,
  actor: ApprovalWorkflowActor,
): Promise<ApprovalWorkflowListResult> {
  assertWorkflowRead(actor);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  const search = query.search?.trim();
  const filters: Prisma.ApprovalWorkflowWhereInput[] = [];

  if (query.status === 'active') {
    filters.push({ isActive: true });
  } else if (query.status === 'inactive') {
    filters.push({ isActive: false });
  } else if (query.status === 'default') {
    filters.push({ isDefault: true });
  }

  if (search) {
    filters.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  const where: Prisma.ApprovalWorkflowWhereInput = {
    workspaceId,
    ...(filters.length > 0 ? { AND: filters } : {}),
  };

  const [total, workflows] = await prisma.$transaction([
    prisma.approvalWorkflow.count({ where }),
    prisma.approvalWorkflow.findMany({
      where,
      include: workflowInclude,
      orderBy: [{ isDefault: 'desc' }, { isActive: 'desc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: workflows.map(toWorkflowSummary),
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

export async function getApprovalWorkflowDetail(
  workspaceId: string,
  workflowId: string,
  actor: ApprovalWorkflowActor,
): Promise<ApprovalWorkflowDetail> {
  assertWorkflowRead(actor);
  return toWorkflowDetail(await requireWorkflow(workspaceId, workflowId));
}

export async function createApprovalWorkflow(
  workspaceId: string,
  input: ApprovalWorkflowWriteInput,
  actor: ApprovalWorkflowActor,
  auditContext: AuditContext,
): Promise<ApprovalWorkflowDetail> {
  assertWorkflowManage(actor);

  const workflowId = await prisma.$transaction(async (transaction) => {
    await lockWorkspace(transaction, workspaceId);
    await validateWorkflowInput(transaction, workspaceId, input);

    if (input.isDefault) {
      await transaction.approvalWorkflow.updateMany({
        where: { workspaceId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const workflow = await transaction.approvalWorkflow.create({
      data: {
        workspace: { connect: { id: workspaceId } },
        createdBy: { connect: { id: actor.userId } },
        name: input.name,
        description: input.description,
        isDefault: input.isDefault,
        isActive: input.isDefault,
        currency: input.currency,
        minAmount: input.minAmount ? new Prisma.Decimal(input.minAmount) : null,
        maxAmount: input.maxAmount ? new Prisma.Decimal(input.maxAmount) : null,
        levels: {
          create: levelsCreateInput(inputLevelsToShapes(input.levels)),
        },
      },
      include: workflowInclude,
    });

    await writeAuditLog(transaction, auditContext, {
      workspaceId,
      action: AuditAction.ApprovalWorkflowCreated,
      entityType: 'approval_workflow',
      entityId: workflow.id,
      summary: `Created approval workflow “${workflow.name}”.`,
      metadata: {
        workflowName: workflow.name,
        levelCount: workflow.levels.length,
        approverCount: workflow.levels.reduce((count, level) => count + level.approvers.length, 0),
        isDefault: workflow.isDefault,
        currency: workflow.currency,
      },
    });

    if (workflow.isActive) {
      await writeAuditLog(transaction, auditContext, {
        workspaceId,
        action: AuditAction.ApprovalWorkflowActivated,
        entityType: 'approval_workflow',
        entityId: workflow.id,
        summary: `Activated approval workflow “${workflow.name}”.`,
        metadata: { workflowName: workflow.name, isDefault: workflow.isDefault },
      });
    }

    return workflow.id;
  });

  return getApprovalWorkflowDetail(workspaceId, workflowId, actor);
}

export async function updateApprovalWorkflow(
  workspaceId: string,
  workflowId: string,
  input: ApprovalWorkflowWriteInput,
  actor: ApprovalWorkflowActor,
  auditContext: AuditContext,
): Promise<ApprovalWorkflowDetail> {
  assertWorkflowManage(actor);

  await prisma.$transaction(async (transaction) => {
    await lockWorkspace(transaction, workspaceId);

    const existing = await transaction.approvalWorkflow.findFirst({
      where: { id: workflowId, workspaceId },
      include: workflowInclude,
    });

    if (!existing) {
      throw workflowNotFoundError();
    }

    await validateWorkflowInput(transaction, workspaceId, input, workflowId);

    if (input.isDefault) {
      await transaction.approvalWorkflow.updateMany({
        where: { workspaceId, isDefault: true, id: { not: workflowId } },
        data: { isDefault: false },
      });
    }

    await transaction.approvalWorkflow.update({
      where: { id: workflowId },
      data: {
        name: input.name,
        description: input.description,
        isDefault: input.isDefault,
        isActive: input.isDefault ? true : existing.isActive,
        currency: input.currency,
        minAmount: input.minAmount ? new Prisma.Decimal(input.minAmount) : null,
        maxAmount: input.maxAmount ? new Prisma.Decimal(input.maxAmount) : null,
        updatedBy: { connect: { id: actor.userId } },
        levels: {
          deleteMany: {},
          create: levelsCreateInput(inputLevelsToShapes(input.levels)),
        },
      },
    });

    await writeAuditLog(transaction, auditContext, {
      workspaceId,
      action: AuditAction.ApprovalWorkflowUpdated,
      entityType: 'approval_workflow',
      entityId: workflowId,
      summary: `Updated approval workflow “${input.name}”.`,
      metadata: {
        workflowName: input.name,
        levelCount: input.levels.length,
        approverCount: input.levels.reduce((count, level) => count + level.approvers.length, 0),
        isDefault: input.isDefault,
      },
    });

    if (input.isDefault && !existing.isActive) {
      await writeAuditLog(transaction, auditContext, {
        workspaceId,
        action: AuditAction.ApprovalWorkflowActivated,
        entityType: 'approval_workflow',
        entityId: workflowId,
        summary: `Activated approval workflow “${input.name}” as the workspace default.`,
        metadata: { workflowName: input.name, isDefault: true },
      });
    }
  });

  return getApprovalWorkflowDetail(workspaceId, workflowId, actor);
}

export async function activateApprovalWorkflow(
  workspaceId: string,
  workflowId: string,
  actor: ApprovalWorkflowActor,
  auditContext: AuditContext,
): Promise<ApprovalWorkflowDetail> {
  assertWorkflowManage(actor);

  await prisma.$transaction(async (transaction) => {
    await lockWorkspace(transaction, workspaceId);

    const workflow = await transaction.approvalWorkflow.findFirst({
      where: { id: workflowId, workspaceId },
      include: workflowInclude,
    });

    if (!workflow) {
      throw workflowNotFoundError();
    }

    const analysis = await analyzeWorkflow(
      transaction,
      workspaceId,
      persistedLevelsToShapes(workflow.levels),
    );

    if (workflow.levels.length === 0 || Object.keys(analysis.fieldErrors).length > 0) {
      throw new AppError(
        'This workflow is not ready to activate. Resolve the highlighted approver issues first.',
        {
          statusCode: 409,
          code: 'WORKFLOW_NOT_READY',
          details: {
            fieldErrors: analysis.fieldErrors,
            warnings: analysis.warnings,
          },
        },
      );
    }

    await transaction.approvalWorkflow.update({
      where: { id: workflowId },
      data: {
        isActive: true,
        updatedBy: { connect: { id: actor.userId } },
      },
    });

    await writeAuditLog(transaction, auditContext, {
      workspaceId,
      action: AuditAction.ApprovalWorkflowActivated,
      entityType: 'approval_workflow',
      entityId: workflowId,
      summary: `Activated approval workflow “${workflow.name}”.`,
      metadata: {
        workflowName: workflow.name,
        levelCount: workflow.levels.length,
        isDefault: workflow.isDefault,
      },
    });
  });

  return getApprovalWorkflowDetail(workspaceId, workflowId, actor);
}

export async function deactivateApprovalWorkflow(
  workspaceId: string,
  workflowId: string,
  actor: ApprovalWorkflowActor,
  auditContext: AuditContext,
): Promise<ApprovalWorkflowDetail> {
  assertWorkflowManage(actor);

  await prisma.$transaction(async (transaction) => {
    const workflow = await transaction.approvalWorkflow.findFirst({
      where: { id: workflowId, workspaceId },
      select: { id: true, name: true, isDefault: true },
    });

    if (!workflow) {
      throw workflowNotFoundError();
    }

    await transaction.approvalWorkflow.update({
      where: { id: workflowId },
      data: {
        isActive: false,
        isDefault: false,
        updatedBy: { connect: { id: actor.userId } },
      },
    });

    await writeAuditLog(transaction, auditContext, {
      workspaceId,
      action: AuditAction.ApprovalWorkflowDeactivated,
      entityType: 'approval_workflow',
      entityId: workflowId,
      summary: `Deactivated approval workflow “${workflow.name}”.`,
      metadata: { workflowName: workflow.name, clearedDefault: workflow.isDefault },
    });
  });

  return getApprovalWorkflowDetail(workspaceId, workflowId, actor);
}

export async function deleteApprovalWorkflow(
  workspaceId: string,
  workflowId: string,
  actor: ApprovalWorkflowActor,
  auditContext: AuditContext,
): Promise<void> {
  assertWorkflowManage(actor);

  await prisma.$transaction(async (transaction) => {
    const workflow = await transaction.approvalWorkflow.findFirst({
      where: { id: workflowId, workspaceId },
      include: workflowInclude,
    });

    if (!workflow) {
      throw workflowNotFoundError();
    }

    const approvalCount = await transaction.approval.count({ where: { workflowId } });

    if (approvalCount > 0) {
      throw new AppError(
        'This workflow has been used for approvals and cannot be deleted. Deactivate it instead.',
        {
          statusCode: 409,
          code: 'WORKFLOW_IN_USE',
          details: { approvalCount },
        },
      );
    }

    await transaction.approvalWorkflow.delete({ where: { id: workflowId } });

    await writeAuditLog(transaction, auditContext, {
      workspaceId,
      action: AuditAction.ApprovalWorkflowDeleted,
      entityType: 'approval_workflow',
      entityId: workflowId,
      summary: `Deleted approval workflow “${workflow.name}”.`,
      metadata: {
        workflowName: workflow.name,
        levelCount: workflow.levels.length,
        approverCount: workflow.levels.reduce((count, level) => count + level.approvers.length, 0),
      },
    });
  });
}

export async function previewApprovalWorkflow(
  workspaceId: string,
  input: ApprovalWorkflowWriteInput,
  actor: ApprovalWorkflowActor,
): Promise<ApprovalWorkflowPreview> {
  assertWorkflowManage(actor);

  const analysis = await analyzeWorkflow(prisma, workspaceId, inputLevelsToShapes(input.levels));

  return {
    name: input.name,
    currency: input.currency,
    minAmount: input.minAmount,
    maxAmount: input.maxAmount,
    isActive: false,
    isDefault: input.isDefault,
    levels: analysis.levels,
    warnings: analysis.warnings,
    canActivate:
      input.levels.length > 0 &&
      Object.keys(analysis.fieldErrors).length === 0 &&
      analysis.levels.every((level) => level.approvers.length > 0),
  };
}

/**
 * Chooses the active workflow for a request using its currency and total.
 * A default workflow wins; otherwise the most specific amount band wins.
 * Two equally specific non-default workflows are ambiguous and rejected.
 */
export async function resolveWorkflowForRequest(
  transaction: Prisma.TransactionClient,
  workspaceId: string,
  currency: string,
  total: Prisma.Decimal,
): Promise<WorkflowWithLevels> {
  const candidates = await transaction.approvalWorkflow.findMany({
    where: {
      workspaceId,
      isActive: true,
      currency: currency as WorkflowWithLevels['currency'],
      AND: [
        { OR: [{ minAmount: null }, { minAmount: { lte: total } }] },
        { OR: [{ maxAmount: null }, { maxAmount: { gte: total } }] },
      ],
    },
    include: workflowInclude,
    orderBy: [{ createdAt: 'asc' }],
  });

  if (candidates.length === 0) {
    throw new AppError(
      'No active approval workflow matches this request’s currency and total. Ask a workspace administrator to configure one.',
      {
        statusCode: 409,
        code: 'NO_ACTIVE_APPROVAL_WORKFLOW',
      },
    );
  }

  const defaultWorkflow = candidates.find((workflow) => workflow.isDefault);

  if (defaultWorkflow) {
    return defaultWorkflow;
  }

  const sorted = [...candidates].sort((left, right) => {
    const leftMin = left.minAmount?.toNumber() ?? -1;
    const rightMin = right.minAmount?.toNumber() ?? -1;

    if (leftMin !== rightMin) {
      return rightMin - leftMin;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });

  const [first, second] = sorted;

  if (second) {
    const firstMin = first?.minAmount?.toNumber() ?? -1;
    const secondMin = second.minAmount?.toNumber() ?? -1;

    if (firstMin === secondMin) {
      throw new AppError(
        'Multiple active approval workflows match this request and no default is configured. Mark one workflow as the default.',
        {
          statusCode: 409,
          code: 'AMBIGUOUS_APPROVAL_WORKFLOW',
          details: { candidates: sorted.map((workflow) => workflow.name) },
        },
      );
    }
  }

  if (!first) {
    throw new AppError('No active approval workflow matches this request.', {
      statusCode: 409,
      code: 'NO_ACTIVE_APPROVAL_WORKFLOW',
    });
  }

  return first;
}

export { toApprovalPerson };
