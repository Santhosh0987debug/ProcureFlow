import { Prisma } from '@prisma/client';
import { Permission, RequestStatus, roleHasPermission } from '@procureflow/shared';
import type {
  Priority,
  ProcurementCategory,
  PurchaseRequestActions,
  PurchaseRequestActivityEntry,
  PurchaseRequestDetail,
  PurchaseRequestItemRecord,
  PurchaseRequestListResult,
  PurchaseRequestListSummary,
  PurchaseRequestMetrics,
  WorkspaceRole,
} from '@procureflow/shared';
import { AppError } from '../errors/app-error.js';
import { AuditAction, writeAuditLog } from '../lib/audit.js';
import type { AuditContext } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import { lockWorkspace } from '../lib/workspace-lock.js';
import type {
  CreatePurchaseRequestInput,
  ListPurchaseRequestsQueryInput,
  UpdatePurchaseRequestInput,
} from '../validators/purchase-request.schemas.js';

const MAX_REQUEST_AMOUNT = new Prisma.Decimal('999999999999.99');
const DEFAULT_PAGE_SIZE = 20;

export interface PurchaseRequestActor {
  userId: string;
  membershipId: string;
  role: WorkspaceRole;
}

interface BuiltItem {
  description: string;
  quantity: Prisma.Decimal;
  unit: string;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  category: ProcurementCategory | null;
  notes: string | null;
}

const requestInclude = {
  requestedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      jobTitle: true,
    },
  },
  items: {
    orderBy: { createdAt: 'asc' as const },
  },
  _count: {
    select: { items: true },
  },
} satisfies Prisma.PurchaseRequestInclude;

type RequestWithRelations = Prisma.PurchaseRequestGetPayload<{ include: typeof requestInclude }>;

function requestNotFoundError(): AppError {
  return new AppError('Purchase request not found in this workspace.', {
    statusCode: 404,
    code: 'REQUEST_NOT_FOUND',
  });
}

function forbiddenError(): AppError {
  return new AppError('You do not have permission to perform this action.', {
    statusCode: 403,
    code: 'FORBIDDEN',
  });
}

function notDraftError(): AppError {
  return new AppError('Only draft purchase requests can be changed or submitted.', {
    statusCode: 409,
    code: 'REQUEST_NOT_DRAFT',
  });
}

function alreadySubmittedError(): AppError {
  return new AppError('This purchase request has already been submitted for approval.', {
    statusCode: 409,
    code: 'REQUEST_ALREADY_SUBMITTED',
  });
}

function validationError(fieldErrors: Record<string, string[]>): AppError {
  return new AppError('Please correct the highlighted fields.', {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
    details: { fieldErrors },
  });
}

function incompleteError(fieldErrors: Record<string, string[]>): AppError {
  return new AppError('This request is not ready to submit. Complete the highlighted fields.', {
    statusCode: 422,
    code: 'REQUEST_INCOMPLETE',
    details: { fieldErrors },
  });
}

function hasWorkspaceRead(actor: PurchaseRequestActor): boolean {
  return roleHasPermission(actor.role, Permission.RequestsRead);
}

function hasOwnRead(actor: PurchaseRequestActor): boolean {
  return roleHasPermission(actor.role, Permission.RequestsReadOwn);
}

function assertReadable(actor: PurchaseRequestActor): void {
  if (!hasWorkspaceRead(actor) && !hasOwnRead(actor)) {
    throw forbiddenError();
  }
}

function assertVisible(actor: PurchaseRequestActor, request: { requestedById: string }): void {
  assertReadable(actor);

  if (!hasWorkspaceRead(actor) && request.requestedById !== actor.userId) {
    throw requestNotFoundError();
  }
}

function assertManagePermission(actor: PurchaseRequestActor, permission: Permission): void {
  if (!roleHasPermission(actor.role, permission)) {
    throw forbiddenError();
  }
}

function scopeWhere(
  workspaceId: string,
  actor: PurchaseRequestActor,
): Prisma.PurchaseRequestWhereInput {
  return {
    workspaceId,
    deletedAt: null,
    ...(hasWorkspaceRead(actor) ? {} : { requestedById: actor.userId }),
  };
}

function actionsFor(
  actor: PurchaseRequestActor,
  request: RequestWithRelations,
): PurchaseRequestActions {
  const isDraft = request.status === RequestStatus.Draft && request.deletedAt === null;
  const inScope = hasWorkspaceRead(actor) || request.requestedById === actor.userId;

  return {
    canEdit: isDraft && inScope && roleHasPermission(actor.role, Permission.RequestsUpdate),
    canDelete: isDraft && inScope && roleHasPermission(actor.role, Permission.RequestsDelete),
    canSubmit: isDraft && inScope && roleHasPermission(actor.role, Permission.RequestsSubmit),
  };
}

function toRequester(request: RequestWithRelations) {
  return {
    id: request.requestedBy.id,
    firstName: request.requestedBy.firstName,
    lastName: request.requestedBy.lastName,
    email: request.requestedBy.email,
    jobTitle: request.requestedBy.jobTitle,
  };
}

function toSummary(request: RequestWithRelations): PurchaseRequestListSummary {
  return {
    id: request.id,
    requestNumber: request.requestNumber,
    title: request.title,
    status: request.status as RequestStatus,
    priority: request.priority as Priority,
    category: request.category as ProcurementCategory,
    currency: request.currency as PurchaseRequestListSummary['currency'],
    totalAmount: request.totalAmount.toFixed(2),
    department: request.department,
    neededBy: request.neededBy?.toISOString() ?? null,
    requester: toRequester(request),
    itemCount: request._count.items,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    submittedAt: request.submittedAt?.toISOString() ?? null,
  };
}

function toItemRecord(item: RequestWithRelations['items'][number]): PurchaseRequestItemRecord {
  return {
    id: item.id,
    description: item.description,
    quantity: item.quantity.toFixed(2),
    unit: item.unit,
    unitPrice: item.unitPrice.toFixed(2),
    lineTotal: item.lineTotal.toFixed(2),
    category: item.category as ProcurementCategory | null,
    notes: item.notes,
  };
}

function toActivity(
  log: Prisma.AuditLogGetPayload<{
    include: {
      actor: { select: { id: true; firstName: true; lastName: true } };
    };
  }>,
): PurchaseRequestActivityEntry {
  return {
    id: log.id,
    action: log.action,
    summary: log.summary,
    actor: log.actor
      ? {
          id: log.actor.id,
          firstName: log.actor.firstName,
          lastName: log.actor.lastName,
        }
      : null,
    occurredAt: log.createdAt.toISOString(),
  };
}

async function loadActivity(
  workspaceId: string,
  requestId: string,
): Promise<PurchaseRequestActivityEntry[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      workspaceId,
      entityType: 'purchase_request',
      entityId: requestId,
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: {
      actor: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  return logs.map(toActivity);
}

function buildItems(input: CreatePurchaseRequestInput['items']): BuiltItem[] {
  return input.map((item, index) => {
    const quantity = new Prisma.Decimal(item.quantity);
    const unitPrice = new Prisma.Decimal(item.unitPrice);
    const lineTotal = quantity.mul(unitPrice).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    if (lineTotal.gt(MAX_REQUEST_AMOUNT)) {
      throw validationError({
        [`items.${index}.unitPrice`]: ['The calculated line total is too large.'],
      });
    }

    return {
      description: item.description,
      quantity,
      unit: item.unit,
      unitPrice,
      lineTotal,
      category: item.category ?? null,
      notes: item.notes ?? null,
    };
  });
}

function totalFor(items: readonly BuiltItem[]): Prisma.Decimal {
  const total = items.reduce((sum, item) => sum.add(item.lineTotal), new Prisma.Decimal(0));

  if (total.gt(MAX_REQUEST_AMOUNT)) {
    throw validationError({
      totalAmount: ['The request total is too large for the supported amount range.'],
    });
  }

  return total.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

async function nextRequestNumber(
  transaction: Prisma.TransactionClient,
  workspaceId: string,
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `PR-${year}-`;
  const existing = await transaction.purchaseRequest.findMany({
    where: {
      workspaceId,
      requestNumber: { startsWith: prefix },
    },
    select: { requestNumber: true },
  });

  let highest = 0;

  for (const { requestNumber } of existing) {
    const suffix = requestNumber.slice(prefix.length);
    const sequence = Number.parseInt(suffix, 10);

    if (Number.isFinite(sequence)) {
      highest = Math.max(highest, sequence);
    }
  }

  return `${prefix}${String(highest + 1).padStart(4, '0')}`;
}

async function loadRequestForUpdate(
  transaction: Prisma.TransactionClient,
  workspaceId: string,
  requestId: string,
): Promise<RequestWithRelations> {
  await transaction.$queryRaw`
    SELECT "id"
    FROM "purchase_requests"
    WHERE "id" = ${requestId}::uuid
      AND "workspace_id" = ${workspaceId}::uuid
    FOR UPDATE
  `;

  const request = await transaction.purchaseRequest.findFirst({
    where: { id: requestId, workspaceId, deletedAt: null },
    include: requestInclude,
  });

  if (!request) {
    throw requestNotFoundError();
  }

  return request;
}

function assertDraft(request: RequestWithRelations, operation: 'change' | 'submit'): void {
  if (request.status === RequestStatus.PendingApproval && operation === 'submit') {
    throw alreadySubmittedError();
  }

  if (request.status !== RequestStatus.Draft) {
    throw notDraftError();
  }
}

function assertSubmittable(request: RequestWithRelations): {
  items: BuiltItem[];
  total: Prisma.Decimal;
} {
  const fieldErrors: Record<string, string[]> = {};

  if (!request.title.trim()) {
    fieldErrors.title = ['Enter a request title.'];
  }

  if (!request.description?.trim()) {
    fieldErrors.description = ['Enter the business justification for this request.'];
  }

  if (!request.neededBy) {
    fieldErrors.neededBy = ['Select the date this request is required by.'];
  } else {
    const today = new Date();
    const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

    if (request.neededBy.getTime() < startOfToday) {
      fieldErrors.neededBy = ['The required-by date cannot be in the past.'];
    }
  }

  if (request.items.length === 0) {
    fieldErrors.items = ['Add at least one line item before submitting.'];
  }

  const items: BuiltItem[] = [];

  request.items.forEach((item, index) => {
    const quantity = item.quantity;
    const unitPrice = item.unitPrice;

    if (!item.description.trim()) {
      fieldErrors[`items.${index}.description`] = ['Enter a description for every line item.'];
    }

    if (!item.unit.trim()) {
      fieldErrors[`items.${index}.unit`] = ['Enter a unit of measure for every line item.'];
    }

    if (!quantity.gt(0)) {
      fieldErrors[`items.${index}.quantity`] = ['Quantity must be greater than zero.'];
    }

    if (!unitPrice.gt(0)) {
      fieldErrors[`items.${index}.unitPrice`] = ['Unit price must be greater than zero.'];
    }

    const lineTotal = quantity.mul(unitPrice).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    if (lineTotal.gt(MAX_REQUEST_AMOUNT)) {
      fieldErrors[`items.${index}.unitPrice`] = ['The calculated line total is too large.'];
    }

    items.push({
      description: item.description,
      quantity,
      unit: item.unit,
      unitPrice,
      lineTotal,
      category: item.category as ProcurementCategory | null,
      notes: item.notes,
    });
  });

  if (Object.keys(fieldErrors).length > 0) {
    throw incompleteError(fieldErrors);
  }

  return { items, total: totalFor(items) };
}

export async function listPurchaseRequests(
  workspaceId: string,
  query: ListPurchaseRequestsQueryInput,
  actor: PurchaseRequestActor,
): Promise<PurchaseRequestListResult> {
  assertReadable(actor);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  const scope = scopeWhere(workspaceId, actor);
  const filters: Prisma.PurchaseRequestWhereInput[] = [];
  const search = query.search?.trim();

  if (query.status) {
    filters.push({ status: query.status });
  }

  if (query.requesterId) {
    filters.push({ requestedById: query.requesterId });
  }

  if (query.category) {
    filters.push({ category: query.category });
  }

  if (query.priority) {
    filters.push({ priority: query.priority });
  }

  if (query.department) {
    filters.push({ department: { contains: query.department, mode: 'insensitive' } });
  }

  if (query.from || query.to) {
    filters.push({
      createdAt: {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: endOfUtcDay(query.to) } : {}),
      },
    });
  }

  if (search) {
    filters.push({
      OR: [
        { requestNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  const where: Prisma.PurchaseRequestWhereInput =
    filters.length > 0 ? { ...scope, AND: filters } : scope;

  const [total, requests, statusGroups, valueAggregate] = await prisma.$transaction([
    prisma.purchaseRequest.count({ where }),
    prisma.purchaseRequest.findMany({
      where,
      include: requestInclude,
      orderBy: [{ createdAt: 'desc' }, { requestNumber: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchaseRequest.groupBy({
      by: ['status'],
      where: scope,
      _count: { _all: true },
    }),
    prisma.purchaseRequest.aggregate({
      where: scope,
      _sum: { totalAmount: true },
    }),
  ]);

  const countFor = (status: RequestStatus): number =>
    statusGroups.find((group) => group.status === status)?._count._all ?? 0;

  const summary: PurchaseRequestMetrics = {
    total: statusGroups.reduce((sum, group) => sum + group._count._all, 0),
    draft: countFor(RequestStatus.Draft),
    pendingApproval: countFor(RequestStatus.PendingApproval),
    approved: countFor(RequestStatus.Approved),
    totalValue: (valueAggregate._sum.totalAmount ?? new Prisma.Decimal(0)).toFixed(2),
  };

  return {
    items: requests.map(toSummary),
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    summary,
  };
}

export async function getPurchaseRequestDetail(
  workspaceId: string,
  requestId: string,
  actor: PurchaseRequestActor,
): Promise<PurchaseRequestDetail> {
  const request = await prisma.purchaseRequest.findFirst({
    where: { id: requestId, workspaceId, deletedAt: null },
    include: requestInclude,
  });

  if (!request) {
    throw requestNotFoundError();
  }

  assertVisible(actor, request);

  const activity = await loadActivity(workspaceId, request.id);

  return {
    ...toSummary(request),
    description: request.description ?? '',
    notes: request.notes,
    decidedAt: request.decidedAt?.toISOString() ?? null,
    items: request.items.map(toItemRecord),
    activity,
    actions: actionsFor(actor, request),
  };
}

export async function createPurchaseRequest(
  workspaceId: string,
  input: CreatePurchaseRequestInput,
  actor: PurchaseRequestActor,
  auditContext: AuditContext,
): Promise<PurchaseRequestDetail> {
  assertManagePermission(actor, Permission.RequestsCreate);

  const requestId = await prisma.$transaction(async (transaction) => {
    await lockWorkspace(transaction, workspaceId);

    const requestNumber = await nextRequestNumber(transaction, workspaceId);
    const items = buildItems(input.items);
    const totalAmount = totalFor(items);

    const request = await transaction.purchaseRequest.create({
      data: {
        workspaceId,
        requestNumber,
        title: input.title,
        description: input.description,
        notes: input.notes,
        status: RequestStatus.Draft,
        priority: input.priority,
        category: input.category,
        currency: input.currency,
        totalAmount,
        department: input.department,
        neededBy: input.neededBy,
        requestedById: actor.userId,
        items: {
          create: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            category: item.category,
            notes: item.notes,
          })),
        },
      },
      select: { id: true, requestNumber: true },
    });

    await writeAuditLog(transaction, auditContext, {
      workspaceId,
      action: AuditAction.PurchaseRequestCreated,
      entityType: 'purchase_request',
      entityId: request.id,
      summary: `Created draft ${request.requestNumber}.`,
      metadata: {
        requestNumber: request.requestNumber,
        status: RequestStatus.Draft,
        itemCount: items.length,
        totalAmount: totalAmount.toFixed(2),
      },
    });

    return request.id;
  });

  return getPurchaseRequestDetail(workspaceId, requestId, actor);
}

export async function updatePurchaseRequest(
  workspaceId: string,
  requestId: string,
  input: UpdatePurchaseRequestInput,
  actor: PurchaseRequestActor,
  auditContext: AuditContext,
): Promise<PurchaseRequestDetail> {
  assertManagePermission(actor, Permission.RequestsUpdate);

  const updatedId = await prisma.$transaction(async (transaction) => {
    const request = await loadRequestForUpdate(transaction, workspaceId, requestId);

    assertVisible(actor, request);
    assertDraft(request, 'change');

    const items = buildItems(input.items);
    const totalAmount = totalFor(items);
    const changedFields: string[] = [];

    if (request.title !== input.title) changedFields.push('title');
    if ((request.description ?? '') !== input.description) changedFields.push('description');
    if ((request.notes ?? '') !== (input.notes ?? '')) changedFields.push('notes');
    if ((request.department ?? '') !== (input.department ?? '')) changedFields.push('department');
    if (request.category !== input.category) changedFields.push('category');
    if (request.priority !== input.priority) changedFields.push('priority');
    if (request.currency !== input.currency) changedFields.push('currency');
    if (request.neededBy?.getTime() !== input.neededBy.getTime()) changedFields.push('neededBy');

    await transaction.purchaseRequestItem.deleteMany({
      where: { purchaseRequestId: request.id },
    });

    await transaction.purchaseRequest.update({
      where: { id: request.id },
      data: {
        title: input.title,
        description: input.description,
        notes: input.notes,
        priority: input.priority,
        category: input.category,
        currency: input.currency,
        totalAmount,
        department: input.department,
        neededBy: input.neededBy,
        items: {
          create: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            category: item.category,
            notes: item.notes,
          })),
        },
      },
    });

    await writeAuditLog(transaction, auditContext, {
      workspaceId,
      action: AuditAction.PurchaseRequestUpdated,
      entityType: 'purchase_request',
      entityId: request.id,
      summary: `Updated draft ${request.requestNumber}.`,
      metadata: {
        requestNumber: request.requestNumber,
        changedFields: changedFields.length > 0 ? changedFields : ['items'],
        itemCount: items.length,
        totalAmount: totalAmount.toFixed(2),
      },
    });

    return request.id;
  });

  return getPurchaseRequestDetail(workspaceId, updatedId, actor);
}

export async function deletePurchaseRequest(
  workspaceId: string,
  requestId: string,
  actor: PurchaseRequestActor,
  auditContext: AuditContext,
): Promise<void> {
  assertManagePermission(actor, Permission.RequestsDelete);

  await prisma.$transaction(async (transaction) => {
    const request = await loadRequestForUpdate(transaction, workspaceId, requestId);

    assertVisible(actor, request);
    assertDraft(request, 'change');

    await transaction.purchaseRequest.update({
      where: { id: request.id },
      data: {
        deletedAt: new Date(),
        deletedById: actor.userId,
      },
    });

    await writeAuditLog(transaction, auditContext, {
      workspaceId,
      action: AuditAction.PurchaseRequestDeleted,
      entityType: 'purchase_request',
      entityId: request.id,
      summary: `Deleted draft ${request.requestNumber}.`,
      metadata: {
        requestNumber: request.requestNumber,
        status: request.status,
        itemCount: request.items.length,
      },
    });
  });
}

export async function submitPurchaseRequest(
  workspaceId: string,
  requestId: string,
  actor: PurchaseRequestActor,
  auditContext: AuditContext,
): Promise<PurchaseRequestDetail> {
  assertManagePermission(actor, Permission.RequestsSubmit);

  const submittedId = await prisma.$transaction(async (transaction) => {
    const request = await loadRequestForUpdate(transaction, workspaceId, requestId);

    assertVisible(actor, request);
    assertDraft(request, 'submit');

    const { items, total } = assertSubmittable(request);

    await Promise.all(
      request.items.map((item, index) => {
        const lineTotal = items[index]?.lineTotal;

        if (!lineTotal || lineTotal.equals(item.lineTotal)) {
          return Promise.resolve();
        }

        return transaction.purchaseRequestItem.update({
          where: { id: item.id },
          data: { lineTotal },
        });
      }),
    );

    const submittedAt = new Date();

    await transaction.purchaseRequest.update({
      where: { id: request.id },
      data: {
        status: RequestStatus.PendingApproval,
        submittedAt,
        totalAmount: total,
      },
    });

    await writeAuditLog(transaction, auditContext, {
      workspaceId,
      action: AuditAction.PurchaseRequestSubmitted,
      entityType: 'purchase_request',
      entityId: request.id,
      summary: `Submitted ${request.requestNumber} for approval.`,
      metadata: {
        requestNumber: request.requestNumber,
        status: RequestStatus.PendingApproval,
        itemCount: items.length,
        totalAmount: total.toFixed(2),
      },
    });

    return request.id;
  });

  return getPurchaseRequestDetail(workspaceId, submittedId, actor);
}

function endOfUtcDay(value: Date): Date {
  const date = new Date(value);
  date.setUTCHours(23, 59, 59, 999);
  return date;
}
