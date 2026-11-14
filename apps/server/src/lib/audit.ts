import type { Prisma } from '@prisma/client';
import { randomBytes, createHash } from 'node:crypto';
import { env } from '../config/env.js';

export const AuditAction = {
  InvitationCreated: 'invitation.created',
  InvitationAccepted: 'invitation.accepted',
  InvitationRevoked: 'invitation.revoked',
  InvitationExpired: 'invitation.expired',
  InvitationLinkRegenerated: 'invitation.link_regenerated',
  MemberRoleChanged: 'member.role_changed',
  MemberSuspended: 'member.suspended',
  MemberReactivated: 'member.reactivated',
  MemberRemoved: 'member.removed',
  PurchaseRequestCreated: 'purchase_request.created',
  PurchaseRequestUpdated: 'purchase_request.updated',
  PurchaseRequestDeleted: 'purchase_request.deleted',
  PurchaseRequestSubmitted: 'purchase_request.submitted',
  PurchaseRequestResubmitted: 'purchase_request.resubmitted',
  ApprovalWorkflowCreated: 'approval_workflow.created',
  ApprovalWorkflowUpdated: 'approval_workflow.updated',
  ApprovalWorkflowActivated: 'approval_workflow.activated',
  ApprovalWorkflowDeactivated: 'approval_workflow.deactivated',
  ApprovalWorkflowDeleted: 'approval_workflow.deleted',
  ApprovalCycleCreated: 'approval_cycle.created',
  ApprovalStepAssigned: 'approval_step.assigned',
  ApprovalApproved: 'approval.approved',
  ApprovalRejected: 'approval.rejected',
  ApprovalChangesRequested: 'approval.changes_requested',
  ApprovalCycleCompleted: 'approval_cycle.completed',
} as const;

const SENSITIVE_KEY_PATTERN = /token|password|secret|hash|jwt|cookie|authorization/i;
const MAX_METADATA_DEPTH = 3;

type SafeJsonValue =
  string | number | boolean | null | SafeJsonValue[] | { [key: string]: SafeJsonValue };

function sanitizeValue(value: unknown, depth: number): SafeJsonValue | undefined {
  if (depth > MAX_METADATA_DEPTH) {
    return undefined;
  }

  if (value === null || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    return value.slice(0, 500);
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeValue(entry, depth + 1))
      .filter((entry): entry is SafeJsonValue => entry !== undefined);
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, SafeJsonValue> = {};

    for (const [key, entry] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        continue;
      }

      const nextValue = sanitizeValue(entry, depth + 1);

      if (nextValue !== undefined) {
        sanitized[key] = nextValue;
      }
    }

    return sanitized;
  }

  return undefined;
}

/**
 * Audit metadata is deliberately allow-listed by shape and redacted by key.
 * This is a final guard: callers must still never pass invitation tokens,
 * hashes, passwords, JWTs, or cookies into audit events.
 */
export function safeAuditMetadata(
  metadata: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined {
  if (!metadata) {
    return undefined;
  }

  const sanitized = sanitizeValue(metadata, 0);

  return sanitized === undefined ? undefined : (sanitized as Prisma.InputJsonValue);
}

export interface AuditContext {
  actorId: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditEvent {
  workspaceId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

export function auditContextFromRequest(request: {
  auth?: { user: { id: string } };
  ip?: string;
  get: (name: string) => string | undefined;
}): AuditContext {
  return {
    actorId: request.auth?.user.id ?? null,
    ipAddress: request.ip?.slice(0, 64) ?? null,
    userAgent: request.get('user-agent')?.slice(0, 500) ?? null,
  };
}

export async function writeAuditLog(
  transaction: Prisma.TransactionClient,
  context: AuditContext,
  event: AuditEvent,
): Promise<void> {
  await transaction.auditLog.create({
    data: {
      workspaceId: event.workspaceId,
      actorId: context.actorId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      summary: event.summary ?? null,
      metadata: safeAuditMetadata(event.metadata),
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
      ...(event.createdAt ? { createdAt: event.createdAt } : {}),
    },
  });
}

export async function writeAuditLogs(
  transaction: Prisma.TransactionClient,
  context: AuditContext,
  events: AuditEvent[],
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  await transaction.auditLog.createMany({
    data: events.map((event) => ({
      workspaceId: event.workspaceId,
      actorId: context.actorId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      summary: event.summary ?? null,
      metadata: safeAuditMetadata(event.metadata),
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
      ...(event.createdAt ? { createdAt: event.createdAt } : {}),
    })),
  });
}

export function generateInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function invitationExpiryDate(now = new Date()): Date {
  return new Date(now.getTime() + env.invitationTtlHours * 60 * 60 * 1000);
}

export function buildInvitationUrl(token: string): string {
  return `${env.webAppUrl}/invitations/accept?token=${encodeURIComponent(token)}`;
}
