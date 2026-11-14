import type { Prisma } from '@prisma/client';
import { RequestStatus } from '@procureflow/shared';
import { AppError } from '../errors/app-error.js';
import { writeAuditLog } from '../lib/audit.js';
import type { AuditContext } from '../lib/audit.js';

/**
 * The only legal purchase-request status transitions. Every status change in
 * the API flows through `transitionPurchaseRequest`, which locks the request
 * row and re-validates its current database state before writing.
 */
export const REQUEST_STATUS_TRANSITIONS: Readonly<Record<RequestStatus, readonly RequestStatus[]>> =
  {
    [RequestStatus.Draft]: [RequestStatus.Submitted],
    [RequestStatus.Submitted]: [RequestStatus.PendingApproval],
    [RequestStatus.PendingApproval]: [
      RequestStatus.Approved,
      RequestStatus.Rejected,
      RequestStatus.ChangesRequested,
    ],
    [RequestStatus.ChangesRequested]: [RequestStatus.Draft, RequestStatus.Submitted],
    [RequestStatus.Approved]: [],
    [RequestStatus.Rejected]: [],
    [RequestStatus.Cancelled]: [],
  };

export type PurchaseRequestRow = Prisma.PurchaseRequestGetPayload<Record<string, never>>;

export interface TransitionAuditEvent {
  action: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface TransitionRequestStatusParams {
  workspaceId: string;
  requestId: string;
  toStatus: RequestStatus;
  /** When supplied, the stored status must match before the transition applies. */
  expectedStatus?: RequestStatus;
  /** Additional request fields to update atomically with the status. */
  data?: Omit<Prisma.PurchaseRequestUncheckedUpdateInput, 'status'>;
  auditContext: AuditContext;
  audit?: TransitionAuditEvent;
}

export function canTransitionRequestStatus(from: RequestStatus, to: RequestStatus): boolean {
  return REQUEST_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextRequestStatuses(from: RequestStatus): readonly RequestStatus[] {
  return REQUEST_STATUS_TRANSITIONS[from] ?? [];
}

function invalidTransitionError(from: RequestStatus, to: RequestStatus): AppError {
  return new AppError(`A purchase request cannot move from ${from} to ${to}.`, {
    statusCode: 409,
    code: 'INVALID_STATUS_TRANSITION',
    details: { from, to },
  });
}

export function assertRequestStatusTransition(from: RequestStatus, to: RequestStatus): void {
  if (!canTransitionRequestStatus(from, to)) {
    throw invalidTransitionError(from, to);
  }
}

export function assertRequestStatus(
  request: { status: string },
  expected: RequestStatus,
  options: { message?: string; code?: string } = {},
): void {
  if (request.status !== expected) {
    throw new AppError(
      options.message ?? `This action requires the request to be ${expected.replaceAll('_', ' ')}.`,
      {
        statusCode: 409,
        code: options.code ?? 'REQUEST_STATUS_CONFLICT',
        details: { expected, actual: request.status },
      },
    );
  }
}

export async function lockPurchaseRequest(
  transaction: Prisma.TransactionClient,
  workspaceId: string,
  requestId: string,
): Promise<PurchaseRequestRow> {
  const locked = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "purchase_requests"
    WHERE "id" = ${requestId}::uuid
      AND "workspace_id" = ${workspaceId}::uuid
      AND "deleted_at" IS NULL
    FOR UPDATE
  `;

  const request =
    locked.length > 0
      ? await transaction.purchaseRequest.findUnique({ where: { id: requestId } })
      : null;

  if (!request) {
    throw new AppError('Purchase request not found in this workspace.', {
      statusCode: 404,
      code: 'REQUEST_NOT_FOUND',
    });
  }

  return request;
}

/**
 * Atomically validates and applies a purchase-request status transition. The
 * caller must already be inside a transaction; the row lock serializes
 * concurrent submissions, decisions, and resubmissions.
 */
export async function transitionPurchaseRequest(
  transaction: Prisma.TransactionClient,
  params: TransitionRequestStatusParams,
): Promise<PurchaseRequestRow> {
  const request = await lockPurchaseRequest(transaction, params.workspaceId, params.requestId);
  const currentStatus = request.status as RequestStatus;

  if (params.expectedStatus && currentStatus !== params.expectedStatus) {
    throw new AppError(
      'The purchase request changed while this action was in progress. Refresh and try again.',
      {
        statusCode: 409,
        code: 'REQUEST_STATUS_CONFLICT',
        details: { expected: params.expectedStatus, actual: currentStatus },
      },
    );
  }

  assertRequestStatusTransition(currentStatus, params.toStatus);

  if (params.data && 'status' in params.data) {
    throw new Error('Status must only be changed through the request state machine.');
  }

  const updated = await transaction.purchaseRequest.update({
    where: { id: request.id },
    data: {
      ...(params.data ?? {}),
      status: params.toStatus,
    },
  });

  if (params.audit) {
    await writeAuditLog(transaction, params.auditContext, {
      workspaceId: params.workspaceId,
      action: params.audit.action,
      entityType: 'purchase_request',
      entityId: request.id,
      summary: params.audit.summary,
      metadata: {
        requestNumber: request.requestNumber,
        fromStatus: currentStatus,
        toStatus: params.toStatus,
        ...params.audit.metadata,
      },
    });
  }

  return updated;
}
