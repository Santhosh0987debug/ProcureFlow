import type { Prisma } from '@prisma/client';
import {
  MembershipStatus,
  ROLE_LABELS,
  WorkspaceRole,
  canAssignRole,
  canManageMember,
  permissionsForRole,
} from '@procureflow/shared';
import type {
  ListMembersQuery,
  PaginatedResult,
  WorkspaceMemberSummary,
  Permission,
} from '@procureflow/shared';
import { AppError } from '../errors/app-error.js';
import { AuditAction, writeAuditLog } from '../lib/audit.js';
import type { AuditContext } from '../lib/audit.js';
import { memberInclude, toMemberSummary } from '../lib/member-mapper.js';
import type { MemberWithUser } from '../lib/member-mapper.js';
import { toMembershipStatus, toWorkspaceRole } from '../lib/roles.js';
import { lockWorkspace } from '../lib/workspace-lock.js';
import { prisma } from '../lib/prisma.js';

export interface WorkspaceActor {
  userId: string;
  membershipId: string;
  role: WorkspaceRole;
}

function memberNotFoundError(): AppError {
  return new AppError('Member not found in this workspace.', {
    statusCode: 404,
    code: 'MEMBER_NOT_FOUND',
  });
}

function selfManagementError(): AppError {
  return new AppError('You cannot modify your own membership.', {
    statusCode: 409,
    code: 'CANNOT_MODIFY_SELF',
  });
}

function roleHierarchyError(): AppError {
  return new AppError('You cannot manage a member with this role.', {
    statusCode: 403,
    code: 'ROLE_HIERARCHY',
  });
}

function roleAssignmentError(): AppError {
  return new AppError('You cannot assign this role.', {
    statusCode: 403,
    code: 'ROLE_ASSIGNMENT_FORBIDDEN',
  });
}

function lastOwnerError(): AppError {
  return new AppError(
    'A workspace must always have at least one active owner. Assign another owner first.',
    {
      statusCode: 409,
      code: 'LAST_OWNER_PROTECTED',
    },
  );
}

function memberWhere(
  workspaceId: string,
  query: ListMembersQuery,
): Prisma.WorkspaceMemberWhereInput {
  const search = query.search?.trim();
  const where: Prisma.WorkspaceMemberWhereInput = { workspaceId };

  if (query.role) {
    where.role = query.role;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (search) {
    where.user = {
      is: {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { jobTitle: { contains: search, mode: 'insensitive' } },
        ],
      },
    };
  }

  return where;
}

export async function listMembers(
  workspaceId: string,
  query: ListMembersQuery,
  currentUserId: string,
): Promise<PaginatedResult<WorkspaceMemberSummary>> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = memberWhere(workspaceId, query);

  const [total, members] = await prisma.$transaction([
    prisma.workspaceMember.count({ where }),
    prisma.workspaceMember.findMany({
      where,
      include: memberInclude,
      orderBy: [{ joinedAt: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: members.map((member) => toMemberSummary(member, currentUserId)),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getMember(
  workspaceId: string,
  memberId: string,
  currentUserId: string,
): Promise<WorkspaceMemberSummary> {
  const member = await prisma.workspaceMember.findFirst({
    where: { id: memberId, workspaceId },
    include: memberInclude,
  });

  if (!member) {
    throw memberNotFoundError();
  }

  return toMemberSummary(member, currentUserId);
}

async function loadMemberForUpdate(
  transaction: Prisma.TransactionClient,
  workspaceId: string,
  memberId: string,
): Promise<MemberWithUser> {
  const member = await transaction.workspaceMember.findFirst({
    where: { id: memberId, workspaceId },
    include: memberInclude,
  });

  if (!member) {
    throw memberNotFoundError();
  }

  return member;
}

function assertCanManage(actor: WorkspaceActor, target: MemberWithUser): void {
  if (target.userId === actor.userId) {
    throw selfManagementError();
  }

  if (!canManageMember(actor.role, toWorkspaceRole(target.role))) {
    throw roleHierarchyError();
  }
}

function assertCanAssign(actor: WorkspaceActor, role: WorkspaceRole): void {
  if (!canAssignRole(actor.role, role)) {
    throw roleAssignmentError();
  }
}

async function countActiveOwners(
  transaction: Prisma.TransactionClient,
  workspaceId: string,
): Promise<number> {
  return transaction.workspaceMember.count({
    where: {
      workspaceId,
      role: WorkspaceRole.Owner,
      status: MembershipStatus.Active,
    },
  });
}

function isActiveOwner(member: MemberWithUser): boolean {
  return (
    toWorkspaceRole(member.role) === WorkspaceRole.Owner &&
    toMembershipStatus(member.status) === MembershipStatus.Active
  );
}

export async function changeMemberRole(
  workspaceId: string,
  memberId: string,
  nextRole: WorkspaceRole,
  actor: WorkspaceActor,
  auditContext: AuditContext,
): Promise<WorkspaceMemberSummary> {
  return prisma.$transaction(async (transaction) => {
    await lockWorkspace(transaction, workspaceId);

    const member = await loadMemberForUpdate(transaction, workspaceId, memberId);
    assertCanManage(actor, member);

    const currentRole = toWorkspaceRole(member.role);

    if (currentRole === nextRole) {
      return toMemberSummary(member, actor.userId);
    }

    assertCanAssign(actor, nextRole);

    if (isActiveOwner(member) && nextRole !== WorkspaceRole.Owner) {
      if ((await countActiveOwners(transaction, workspaceId)) <= 1) {
        throw lastOwnerError();
      }
    }

    const updated = await transaction.workspaceMember.update({
      where: { id: member.id },
      data: { role: nextRole },
      include: memberInclude,
    });

    await writeAuditLog(transaction, auditContext, {
      workspaceId,
      action: AuditAction.MemberRoleChanged,
      entityType: 'workspace_member',
      entityId: member.id,
      summary: `Changed ${member.user.firstName} ${member.user.lastName} from ${ROLE_LABELS[currentRole]} to ${ROLE_LABELS[nextRole]}.`,
      metadata: { previousRole: currentRole, newRole: nextRole },
    });

    return toMemberSummary(updated, actor.userId);
  });
}

export async function suspendMember(
  workspaceId: string,
  memberId: string,
  actor: WorkspaceActor,
  auditContext: AuditContext,
): Promise<WorkspaceMemberSummary> {
  return prisma.$transaction(async (transaction) => {
    await lockWorkspace(transaction, workspaceId);

    const member = await loadMemberForUpdate(transaction, workspaceId, memberId);
    assertCanManage(actor, member);

    if (toMembershipStatus(member.status) === MembershipStatus.Suspended) {
      throw new AppError('This member is already suspended.', {
        statusCode: 409,
        code: 'MEMBER_ALREADY_SUSPENDED',
      });
    }

    if (isActiveOwner(member)) {
      if ((await countActiveOwners(transaction, workspaceId)) <= 1) {
        throw lastOwnerError();
      }
    }

    const updated = await transaction.workspaceMember.update({
      where: { id: member.id },
      data: {
        status: MembershipStatus.Suspended,
        suspendedAt: new Date(),
        suspendedById: actor.userId,
      },
      include: memberInclude,
    });

    await writeAuditLog(transaction, auditContext, {
      workspaceId,
      action: AuditAction.MemberSuspended,
      entityType: 'workspace_member',
      entityId: member.id,
      summary: `Suspended ${member.user.firstName} ${member.user.lastName} from the workspace.`,
      metadata: { role: toWorkspaceRole(member.role) },
    });

    return toMemberSummary(updated, actor.userId);
  });
}

export async function reactivateMember(
  workspaceId: string,
  memberId: string,
  actor: WorkspaceActor,
  auditContext: AuditContext,
): Promise<WorkspaceMemberSummary> {
  return prisma.$transaction(async (transaction) => {
    await lockWorkspace(transaction, workspaceId);

    const member = await loadMemberForUpdate(transaction, workspaceId, memberId);
    assertCanManage(actor, member);

    if (toMembershipStatus(member.status) === MembershipStatus.Active) {
      throw new AppError('This member is already active.', {
        statusCode: 409,
        code: 'MEMBER_ALREADY_ACTIVE',
      });
    }

    const updated = await transaction.workspaceMember.update({
      where: { id: member.id },
      data: {
        status: MembershipStatus.Active,
        suspendedAt: null,
        suspendedById: null,
      },
      include: memberInclude,
    });

    await writeAuditLog(transaction, auditContext, {
      workspaceId,
      action: AuditAction.MemberReactivated,
      entityType: 'workspace_member',
      entityId: member.id,
      summary: `Reactivated ${member.user.firstName} ${member.user.lastName} in the workspace.`,
      metadata: { role: toWorkspaceRole(member.role) },
    });

    return toMemberSummary(updated, actor.userId);
  });
}

export async function removeMember(
  workspaceId: string,
  memberId: string,
  actor: WorkspaceActor,
  auditContext: AuditContext,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await lockWorkspace(transaction, workspaceId);

    const member = await loadMemberForUpdate(transaction, workspaceId, memberId);
    assertCanManage(actor, member);

    if (isActiveOwner(member)) {
      if ((await countActiveOwners(transaction, workspaceId)) <= 1) {
        throw lastOwnerError();
      }
    }

    await transaction.workspaceMember.delete({ where: { id: member.id } });

    await writeAuditLog(transaction, auditContext, {
      workspaceId,
      action: AuditAction.MemberRemoved,
      entityType: 'workspace_member',
      entityId: member.id,
      summary: `Removed ${member.user.firstName} ${member.user.lastName} from the workspace.`,
      metadata: {
        role: toWorkspaceRole(member.role),
        status: toMembershipStatus(member.status),
      },
    });
  });
}

export function effectivePermissions(role: WorkspaceRole): Permission[] {
  return [...permissionsForRole(role)];
}
