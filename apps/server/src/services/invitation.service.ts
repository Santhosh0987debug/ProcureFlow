import { Prisma } from '@prisma/client';
import {
  InvitationStatus,
  MembershipStatus,
  ROLE_LABELS,
  canAssignRole,
} from '@procureflow/shared';
import type {
  AcceptInvitationResult,
  CreateInvitationResult,
  InvitationLinkResult,
  ListInvitationsQuery,
  PaginatedResult,
  WorkspaceInvitationSummary,
  WorkspaceRole,
} from '@procureflow/shared';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import {
  AuditAction,
  buildInvitationUrl,
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiryDate,
  writeAuditLog,
  writeAuditLogs,
} from '../lib/audit.js';
import type { AuditContext } from '../lib/audit.js';
import { memberInclude, toMemberSummary } from '../lib/member-mapper.js';
import { prisma } from '../lib/prisma.js';
import { toWorkspaceRole } from '../lib/roles.js';
import { lockWorkspace } from '../lib/workspace-lock.js';
import { sessionInclude, toAuthSession } from './auth.service.js';
import type { WorkspaceActor } from './member.service.js';

const invitationInclude = {
  invitedBy: true,
} satisfies Prisma.WorkspaceInvitationInclude;

type InvitationWithSender = Prisma.WorkspaceInvitationGetPayload<{
  include: typeof invitationInclude;
}>;

function invitationNotFoundError(): AppError {
  return new AppError('Invitation not found.', {
    statusCode: 404,
    code: 'INVITATION_NOT_FOUND',
  });
}

function invitationExistsError(): AppError {
  return new AppError('An active invitation already exists for this email address.', {
    statusCode: 409,
    code: 'INVITATION_EXISTS',
  });
}

function alreadyMemberError(status: string): AppError {
  return new AppError(
    status === MembershipStatus.Suspended
      ? 'This user already has a suspended membership. Reactivate it instead of inviting them again.'
      : 'This user is already a member of the workspace.',
    {
      statusCode: 409,
      code: 'ALREADY_MEMBER',
    },
  );
}

function roleAssignmentError(): AppError {
  return new AppError('You cannot invite a member with this role.', {
    statusCode: 403,
    code: 'ROLE_ASSIGNMENT_FORBIDDEN',
  });
}

function invitationExpiredError(): AppError {
  return new AppError('This invitation has expired. Ask an administrator for a new invitation.', {
    statusCode: 410,
    code: 'INVITATION_EXPIRED',
  });
}

function invitationRevokedError(): AppError {
  return new AppError('This invitation has been revoked.', {
    statusCode: 410,
    code: 'INVITATION_REVOKED',
  });
}

function invitationAlreadyUsedError(): AppError {
  return new AppError('This invitation has already been accepted.', {
    statusCode: 409,
    code: 'INVITATION_ALREADY_USED',
  });
}

function invitationStatusError(status: string): AppError {
  switch (status) {
    case InvitationStatus.Accepted:
      return invitationAlreadyUsedError();
    case InvitationStatus.Revoked:
      return invitationRevokedError();
    case InvitationStatus.Expired:
      return invitationExpiredError();
    default:
      return new AppError('This invitation can no longer be used.', {
        statusCode: 409,
        code: 'INVITATION_NOT_PENDING',
      });
  }
}

function emailMismatchError(): AppError {
  return new AppError('This invitation was issued to a different email address.', {
    statusCode: 403,
    code: 'INVITATION_EMAIL_MISMATCH',
  });
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function toInvitationSummary(invitation: InvitationWithSender): WorkspaceInvitationSummary {
  return {
    id: invitation.id,
    email: invitation.email,
    role: toWorkspaceRole(invitation.role),
    status: invitation.status as InvitationStatus,
    invitedBy: {
      id: invitation.invitedBy.id,
      firstName: invitation.invitedBy.firstName,
      lastName: invitation.invitedBy.lastName,
    },
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    revokedAt: invitation.revokedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString(),
  };
}

/**
 * Mark stale pending invitations as expired and append the corresponding
 * audit entries. The caller must run this inside a transaction.
 */
async function expireStaleInvitations(
  transaction: Prisma.TransactionClient,
  workspaceId: string,
  now = new Date(),
): Promise<void> {
  const stale = await transaction.workspaceInvitation.findMany({
    where: {
      workspaceId,
      status: InvitationStatus.Pending,
      expiresAt: { lte: now },
    },
    select: { id: true, role: true },
  });

  if (stale.length === 0) {
    return;
  }

  await transaction.workspaceInvitation.updateMany({
    where: { id: { in: stale.map((invitation) => invitation.id) } },
    data: { status: InvitationStatus.Expired, activeKey: null },
  });

  await writeAuditLogs(
    transaction,
    { actorId: null },
    stale.map((invitation) => ({
      workspaceId,
      action: AuditAction.InvitationExpired,
      entityType: 'workspace_invitation',
      entityId: invitation.id,
      summary: 'Invitation expired before it was accepted.',
      metadata: { role: invitation.role },
    })),
  );
}

export async function listInvitations(
  workspaceId: string,
  query: ListInvitationsQuery,
): Promise<PaginatedResult<WorkspaceInvitationSummary>> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  return prisma.$transaction(async (transaction) => {
    await lockWorkspace(transaction, workspaceId);
    await expireStaleInvitations(transaction, workspaceId);

    const where: Prisma.WorkspaceInvitationWhereInput = {
      workspaceId,
      ...(query.status ? { status: query.status } : {}),
    };

    const total = await transaction.workspaceInvitation.count({ where });
    const invitations = await transaction.workspaceInvitation.findMany({
      where,
      include: invitationInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: invitations.map(toInvitationSummary),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  });
}

export async function createInvitation(
  workspaceId: string,
  input: { email: string; role: WorkspaceRole },
  actor: WorkspaceActor,
  auditContext: AuditContext,
): Promise<CreateInvitationResult> {
  const email = input.email.trim().toLowerCase();

  try {
    const created = await prisma.$transaction(async (transaction) => {
      await lockWorkspace(transaction, workspaceId);
      await expireStaleInvitations(transaction, workspaceId);

      if (!canAssignRole(actor.role, input.role)) {
        throw roleAssignmentError();
      }

      const existingUser = await transaction.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser) {
        const existingMembership = await transaction.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId,
              userId: existingUser.id,
            },
          },
          select: { status: true },
        });

        if (existingMembership) {
          throw alreadyMemberError(existingMembership.status);
        }
      }

      const activeKey = `${workspaceId}:${email}`;
      const pending = await transaction.workspaceInvitation.findUnique({
        where: { activeKey },
        select: { id: true },
      });

      if (pending) {
        throw invitationExistsError();
      }

      const token = generateInvitationToken();
      const expiresAt = invitationExpiryDate();

      const invitation = await transaction.workspaceInvitation.create({
        data: {
          workspaceId,
          email,
          role: input.role,
          tokenHash: hashInvitationToken(token),
          activeKey,
          invitedById: actor.userId,
          expiresAt,
        },
        include: invitationInclude,
      });

      await writeAuditLog(transaction, auditContext, {
        workspaceId,
        action: AuditAction.InvitationCreated,
        entityType: 'workspace_invitation',
        entityId: invitation.id,
        summary: `Invited ${email} as ${ROLE_LABELS[input.role]}.`,
        metadata: {
          role: input.role,
          expiresAt: expiresAt.toISOString(),
        },
      });

      return { invitation, token };
    });

    const delivery = env.invitationDelivery === 'link' ? 'development_link' : 'email';

    return {
      invitation: toInvitationSummary(created.invitation),
      delivery,
      ...(delivery === 'development_link'
        ? {
            invitationUrl: buildInvitationUrl(created.token),
            invitationToken: created.token,
          }
        : {}),
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw invitationExistsError();
    }

    throw error;
  }
}

export async function revokeInvitation(
  workspaceId: string,
  invitationId: string,
  auditContext: AuditContext,
): Promise<WorkspaceInvitationSummary> {
  const outcome = await prisma.$transaction(async (transaction) => {
    await lockWorkspace(transaction, workspaceId);

    const invitation = await transaction.workspaceInvitation.findFirst({
      where: { id: invitationId, workspaceId },
      include: invitationInclude,
    });

    if (!invitation) {
      throw invitationNotFoundError();
    }

    const now = new Date();

    if (
      invitation.status === InvitationStatus.Pending &&
      invitation.expiresAt.getTime() <= now.getTime()
    ) {
      await transaction.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.Expired, activeKey: null },
      });

      await writeAuditLog(
        transaction,
        { actorId: null },
        {
          workspaceId,
          action: AuditAction.InvitationExpired,
          entityType: 'workspace_invitation',
          entityId: invitation.id,
          summary: 'Invitation expired before it was revoked.',
          metadata: { role: invitation.role },
        },
      );

      return { kind: 'expired' as const };
    }

    if (invitation.status !== InvitationStatus.Pending) {
      return { kind: 'not_pending' as const, status: invitation.status };
    }

    const revoked = await transaction.workspaceInvitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.Revoked,
        revokedAt: now,
        activeKey: null,
      },
      include: invitationInclude,
    });

    await writeAuditLog(transaction, auditContext, {
      workspaceId,
      action: AuditAction.InvitationRevoked,
      entityType: 'workspace_invitation',
      entityId: invitation.id,
      summary: `Revoked the invitation for ${invitation.email}.`,
      metadata: { role: invitation.role },
    });

    return { kind: 'revoked' as const, invitation: revoked };
  });

  if (outcome.kind === 'expired') {
    throw invitationExpiredError();
  }

  if (outcome.kind === 'not_pending') {
    throw invitationStatusError(outcome.status);
  }

  return toInvitationSummary(outcome.invitation);
}

export async function reissueInvitationLink(
  workspaceId: string,
  invitationId: string,
  auditContext: AuditContext,
): Promise<InvitationLinkResult> {
  if (env.invitationDelivery !== 'link') {
    throw new AppError(
      'Invitation links are only available while development link delivery is enabled.',
      {
        statusCode: 409,
        code: 'EMAIL_DELIVERY_NOT_CONFIGURED',
      },
    );
  }

  const outcome = await prisma.$transaction(async (transaction) => {
    await lockWorkspace(transaction, workspaceId);

    const invitation = await transaction.workspaceInvitation.findFirst({
      where: { id: invitationId, workspaceId },
      include: invitationInclude,
    });

    if (!invitation) {
      throw invitationNotFoundError();
    }

    const now = new Date();

    if (
      invitation.status === InvitationStatus.Pending &&
      invitation.expiresAt.getTime() <= now.getTime()
    ) {
      await transaction.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.Expired, activeKey: null },
      });

      await writeAuditLog(
        transaction,
        { actorId: null },
        {
          workspaceId,
          action: AuditAction.InvitationExpired,
          entityType: 'workspace_invitation',
          entityId: invitation.id,
          summary: 'Invitation expired before a new link was issued.',
          metadata: { role: invitation.role },
        },
      );

      return { kind: 'expired' as const };
    }

    if (invitation.status !== InvitationStatus.Pending) {
      return { kind: 'not_pending' as const, status: invitation.status };
    }

    const token = generateInvitationToken();
    const expiresAt = invitationExpiryDate(now);

    const updated = await transaction.workspaceInvitation.update({
      where: { id: invitation.id },
      data: {
        tokenHash: hashInvitationToken(token),
        expiresAt,
        activeKey: `${workspaceId}:${invitation.email}`,
      },
      include: invitationInclude,
    });

    await writeAuditLog(transaction, auditContext, {
      workspaceId,
      action: AuditAction.InvitationLinkRegenerated,
      entityType: 'workspace_invitation',
      entityId: invitation.id,
      summary: `Issued a new invitation link for ${invitation.email}.`,
      metadata: { role: invitation.role, expiresAt: expiresAt.toISOString() },
    });

    return { kind: 'reissued' as const, invitation: updated, token };
  });

  if (outcome.kind === 'expired') {
    throw invitationExpiredError();
  }

  if (outcome.kind === 'not_pending') {
    throw invitationStatusError(outcome.status);
  }

  return {
    invitation: toInvitationSummary(outcome.invitation),
    invitationUrl: buildInvitationUrl(outcome.token),
    invitationToken: outcome.token,
    expiresAt: outcome.invitation.expiresAt.toISOString(),
  };
}

export async function acceptInvitation(
  token: string,
  user: { id: string; email: string; firstName: string; lastName: string },
  auditContext: AuditContext,
): Promise<AcceptInvitationResult> {
  const tokenHash = hashInvitationToken(token);

  const outcome = await prisma.$transaction(async (transaction) => {
    const initial = await transaction.workspaceInvitation.findUnique({
      where: { tokenHash },
      select: { id: true, workspaceId: true },
    });

    if (!initial) {
      throw invitationNotFoundError();
    }

    await lockWorkspace(transaction, initial.workspaceId);

    const invitation = await transaction.workspaceInvitation.findUnique({
      where: { id: initial.id },
      include: invitationInclude,
    });

    if (!invitation) {
      throw invitationNotFoundError();
    }

    const now = new Date();

    if (
      invitation.status === InvitationStatus.Pending &&
      invitation.expiresAt.getTime() <= now.getTime()
    ) {
      await transaction.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.Expired, activeKey: null },
      });

      await writeAuditLog(
        transaction,
        { actorId: null },
        {
          workspaceId: invitation.workspaceId,
          action: AuditAction.InvitationExpired,
          entityType: 'workspace_invitation',
          entityId: invitation.id,
          summary: 'Invitation expired before it was accepted.',
          metadata: { role: invitation.role },
        },
      );

      return { kind: 'expired' as const };
    }

    if (invitation.status !== InvitationStatus.Pending) {
      return { kind: 'not_pending' as const, status: invitation.status };
    }

    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      throw emailMismatchError();
    }

    const existingMembership = await transaction.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invitation.workspaceId,
          userId: user.id,
        },
      },
      select: { status: true },
    });

    if (existingMembership) {
      throw alreadyMemberError(existingMembership.status);
    }

    await transaction.workspaceInvitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.Accepted,
        acceptedAt: now,
        acceptedById: user.id,
        activeKey: null,
      },
    });

    const membership = await transaction.workspaceMember.create({
      data: {
        workspaceId: invitation.workspaceId,
        userId: user.id,
        role: invitation.role,
        status: MembershipStatus.Active,
        joinedAt: now,
      },
      include: memberInclude,
    });

    await writeAuditLog(
      transaction,
      { ...auditContext, actorId: user.id },
      {
        workspaceId: invitation.workspaceId,
        action: AuditAction.InvitationAccepted,
        entityType: 'workspace_invitation',
        entityId: invitation.id,
        summary: `${user.firstName} ${user.lastName} accepted the workspace invitation.`,
        metadata: { role: toWorkspaceRole(invitation.role) },
      },
    );

    const fullUser = await transaction.user.findUniqueOrThrow({
      where: { id: user.id },
      include: sessionInclude,
    });
    const session = toAuthSession(fullUser);
    const workspace = session.workspaces.find((entry) => entry.id === invitation.workspaceId);

    if (!workspace) {
      throw new Error('The accepted workspace was not active for the new member.');
    }

    return {
      kind: 'accepted' as const,
      session,
      workspace,
      membership: toMemberSummary(membership, user.id),
    };
  });

  if (outcome.kind === 'expired') {
    throw invitationExpiredError();
  }

  if (outcome.kind === 'not_pending') {
    throw invitationStatusError(outcome.status);
  }

  return {
    session: outcome.session,
    workspace: outcome.workspace,
    membership: outcome.membership,
  };
}
