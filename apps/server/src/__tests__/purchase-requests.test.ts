import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import {
  Currency,
  Priority,
  ProcurementCategory,
  RequestStatus,
  WorkspaceRole,
} from '@procureflow/shared';
import type { CreatePurchaseRequestRequest } from '@procureflow/shared';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { signSessionToken } from '../lib/session-token.js';
import { updatePurchaseRequest } from '../services/purchase-request.service.js';
import type { PurchaseRequestActor } from '../services/purchase-request.service.js';
import { resetDatabase } from '../test/database.js';
import type { UpdatePurchaseRequestInput } from '../validators/purchase-request.schemas.js';

const app = createApp();
const passwordHash = bcrypt.hashSync('StrongPass123', 4);

type DbRole = NonNullable<Prisma.WorkspaceMemberCreateInput['role']>;
type TestUser = { id: string; email: string };
type TestClient = Awaited<ReturnType<typeof clientFor>>;

let userSequence = 0;

async function createUser(localPart: string, firstName = 'Test', lastName = 'User') {
  userSequence += 1;
  const email = `${localPart}.${userSequence}@example.com`.toLowerCase();

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
    },
    select: { id: true, email: true },
  });
}

async function createWorkspace(owner: TestUser, name = 'Test Workspace') {
  return prisma.workspace.create({
    data: {
      name,
      slug: `test-${randomUUID()}`,
      createdById: owner.id,
      members: {
        create: {
          userId: owner.id,
          role: 'owner',
        },
      },
    },
  });
}

async function addMember(workspaceId: string, user: TestUser, role: DbRole) {
  return prisma.workspaceMember.create({
    data: {
      workspaceId,
      userId: user.id,
      role,
    },
  });
}

async function cookieFor(user: TestUser): Promise<string> {
  const token = await signSessionToken({ userId: user.id, email: user.email });
  return `procureflow_session=${token}`;
}

async function clientFor(user: TestUser) {
  const cookie = await cookieFor(user);

  return {
    get: (path: string) => request(app).get(path).set('Cookie', cookie),
    post: (path: string, body?: object) => {
      const pending = request(app).post(path).set('Cookie', cookie);
      return body === undefined ? pending : pending.send(body);
    },
    patch: (path: string, body?: object) => {
      const pending = request(app).patch(path).set('Cookie', cookie);
      return body === undefined ? pending : pending.send(body);
    },
    delete: (path: string) => request(app).delete(path).set('Cookie', cookie),
  };
}

function daysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function requestPayload(
  overrides: Partial<CreatePurchaseRequestRequest> = {},
): CreatePurchaseRequestRequest {
  return {
    title: 'Office equipment refresh',
    description: 'Replace end-of-life equipment for the operations floor.',
    department: 'Facilities',
    category: ProcurementCategory.Facilities,
    priority: Priority.Medium,
    currency: Currency.USD,
    neededBy: daysFromNow(14),
    notes: 'Deliver to the loading dock.',
    items: [
      {
        description: 'Ergonomic task chair',
        quantity: '3.5',
        unit: 'unit',
        unitPrice: '19.99',
        category: ProcurementCategory.Facilities,
        notes: 'Black frame',
      },
      {
        description: 'Height-adjustable desk',
        quantity: '2',
        unit: 'unit',
        unitPrice: '0.10',
      },
    ],
    ...overrides,
  };
}

async function createDraft(
  client: TestClient,
  workspaceId: string,
  overrides: Partial<CreatePurchaseRequestRequest> = {},
) {
  const response = await client
    .post(`/api/workspaces/${workspaceId}/purchase-requests`, requestPayload(overrides))
    .expect(201);

  return response.body.data as {
    id: string;
    requestNumber: string;
    totalAmount: string;
    status: string;
    items: Array<{ id: string; description: string; lineTotal: string }>;
    actions: { canEdit: boolean; canDelete: boolean; canSubmit: boolean };
  };
}

async function auditFor(workspaceId: string, action: string) {
  return prisma.auditLog.findMany({
    where: { workspaceId, action },
    orderBy: { createdAt: 'asc' },
  });
}

async function actorFor(workspaceId: string, user: TestUser): Promise<PurchaseRequestActor> {
  const membership = await prisma.workspaceMember.findFirstOrThrow({
    where: { workspaceId, userId: user.id },
  });

  return {
    userId: user.id,
    membershipId: membership.id,
    role: membership.role as WorkspaceRole,
  };
}

async function seedWorkspace() {
  const owner = await createUser('owner', 'Amara', 'Okafor');
  const workspace = await createWorkspace(owner);
  const admin = await createUser('admin', 'Daniel', 'Reyes');
  const manager = await createUser('manager', 'Marcus', 'Chen');
  const approver = await createUser('approver', 'Priya', 'Nair');
  const requester = await createUser('requester', 'Nadia', 'Hassan');
  const otherRequester = await createUser('requester-b', 'Owen', 'Park');
  const viewer = await createUser('viewer', 'Sofia', 'Lindberg');

  await addMember(workspace.id, admin, WorkspaceRole.Admin as DbRole);
  await addMember(workspace.id, manager, WorkspaceRole.ProcurementManager as DbRole);
  await addMember(workspace.id, approver, WorkspaceRole.Approver as DbRole);
  await addMember(workspace.id, requester, WorkspaceRole.Requester as DbRole);
  await addMember(workspace.id, otherRequester, WorkspaceRole.Requester as DbRole);
  await addMember(workspace.id, viewer, WorkspaceRole.Viewer as DbRole);

  return {
    owner,
    workspace,
    admin,
    manager,
    approver,
    requester,
    otherRequester,
    viewer,
    ownerClient: await clientFor(owner),
    adminClient: await clientFor(admin),
    managerClient: await clientFor(manager),
    approverClient: await clientFor(approver),
    requesterClient: await clientFor(requester),
    otherRequesterClient: await clientFor(otherRequester),
    viewerClient: await clientFor(viewer),
  };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('purchase request creation', () => {
  it('creates a draft with multiple items and calculates totals with Decimal precision', async () => {
    const { workspace, requester, requesterClient } = await seedWorkspace();

    const created = await createDraft(requesterClient, workspace.id);

    expect(created).toMatchObject({
      requestNumber: expect.stringMatching(/^PR-\d{4}-0001$/),
      status: RequestStatus.Draft,
      totalAmount: '70.17',
      actions: { canEdit: true, canDelete: true, canSubmit: true },
    });
    expect(created.items).toHaveLength(2);
    expect(created.items[0]?.lineTotal).toBe('69.97');
    expect(created.items[1]?.lineTotal).toBe('0.20');

    const stored = await prisma.purchaseRequest.findUniqueOrThrow({
      where: { id: created.id },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });

    expect(stored.requestNumber).toBe(created.requestNumber);
    expect(stored.totalAmount.toFixed(2)).toBe('70.17');
    expect(stored.requestedById).toBe(requester.id);
    expect(stored.status).toBe(RequestStatus.Draft);
    expect(stored.items).toHaveLength(2);

    const audits = await auditFor(workspace.id, 'purchase_request.created');
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: requester.id,
      entityType: 'purchase_request',
      entityId: created.id,
    });
    expect(audits[0]?.metadata).toMatchObject({
      requestNumber: created.requestNumber,
      status: RequestStatus.Draft,
      itemCount: 2,
      totalAmount: '70.17',
    });
  });

  it('generates unique sequential request numbers scoped to the workspace', async () => {
    const { workspace, requesterClient } = await seedWorkspace();

    const first = await createDraft(requesterClient, workspace.id, { title: 'First request' });
    const second = await createDraft(requesterClient, workspace.id, { title: 'Second request' });

    expect(first.requestNumber).toMatch(/-0001$/);
    expect(second.requestNumber).toMatch(/-0002$/);
    expect(first.requestNumber).not.toBe(second.requestNumber);
  });

  it('serializes concurrent creations so request numbers remain unique', async () => {
    const { workspace, requesterClient } = await seedWorkspace();

    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        requesterClient.post(
          `/api/workspaces/${workspace.id}/purchase-requests`,
          requestPayload({ title: `Concurrent request ${index + 1}` }),
        ),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([201, 201, 201, 201, 201]);

    const numbers = responses.map((response) => response.body.data.requestNumber as string);
    expect(new Set(numbers).size).toBe(5);
    expect(await prisma.purchaseRequest.count({ where: { workspaceId: workspace.id } })).toBe(5);
  });

  it('rejects missing, invalid, imprecise, and client-supplied totals', async () => {
    const { workspace, requesterClient } = await seedWorkspace();
    const url = `/api/workspaces/${workspace.id}/purchase-requests`;

    const invalidPayloads: Array<{ body: object; field: string }> = [
      {
        body: requestPayload({ title: '   ' }),
        field: 'title',
      },
      {
        body: requestPayload({ description: '' }),
        field: 'description',
      },
      {
        body: requestPayload({ neededBy: '2020-01-01' }),
        field: 'neededBy',
      },
      {
        body: requestPayload({ items: [] }),
        field: 'items',
      },
      {
        body: requestPayload({
          items: [
            {
              description: 'Chair',
              quantity: '0',
              unit: 'unit',
              unitPrice: '10.00',
            },
          ],
        }),
        field: 'items.0.quantity',
      },
      {
        body: requestPayload({
          items: [
            {
              description: 'Chair',
              quantity: '1',
              unit: 'unit',
              unitPrice: '-5.00',
            },
          ],
        }),
        field: 'items.0.unitPrice',
      },
      {
        body: requestPayload({
          items: [
            {
              description: 'Chair',
              quantity: '1',
              unit: 'unit',
              unitPrice: '10.123',
            },
          ],
        }),
        field: 'items.0.unitPrice',
      },
      {
        body: { ...requestPayload(), totalAmount: '1.00' },
        field: 'form',
      },
    ];

    for (const { body, field } of invalidPayloads) {
      const response = await requesterClient.post(url, body).expect(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.fieldErrors[field]).toBeDefined();
    }

    expect(await prisma.purchaseRequest.count({ where: { workspaceId: workspace.id } })).toBe(0);
    expect(await auditFor(workspace.id, 'purchase_request.created')).toHaveLength(0);
  });
});

describe('purchase request reads', () => {
  it('paginates, searches, filters, and returns summary metrics', async () => {
    const { workspace, ownerClient, requester, requesterClient } = await seedWorkspace();

    const first = await createDraft(requesterClient, workspace.id, {
      title: 'Facilities seating',
      department: 'Facilities',
      priority: Priority.High,
      category: ProcurementCategory.Facilities,
    });
    const second = await createDraft(requesterClient, workspace.id, {
      title: 'IT monitors',
      department: 'Information Technology',
      priority: Priority.Low,
      category: ProcurementCategory.InformationTechnology,
    });
    const third = await createDraft(requesterClient, workspace.id, {
      title: 'Marketing collateral',
      department: 'Marketing',
      priority: Priority.Medium,
      category: ProcurementCategory.Marketing,
    });

    await requesterClient
      .post(`/api/workspaces/${workspace.id}/purchase-requests/${third.id}/submit`)
      .expect(200);

    const pageOne = await ownerClient
      .get(`/api/workspaces/${workspace.id}/purchase-requests?page=1&pageSize=2`)
      .expect(200);

    expect(pageOne.body.data).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
    expect(pageOne.body.data.items).toHaveLength(2);
    expect(pageOne.body.data.summary).toMatchObject({
      total: 3,
      draft: 2,
      pendingApproval: 1,
      approved: 0,
      totalValue: '210.51',
    });

    const pageTwo = await ownerClient
      .get(`/api/workspaces/${workspace.id}/purchase-requests?page=2&pageSize=2`)
      .expect(200);
    expect(pageTwo.body.data.items).toHaveLength(1);

    const search = await ownerClient
      .get(
        `/api/workspaces/${workspace.id}/purchase-requests?search=${encodeURIComponent('monitors')}`,
      )
      .expect(200);
    expect(search.body.data.items).toHaveLength(1);
    expect(search.body.data.items[0].title).toBe('IT monitors');

    const numberSearch = await ownerClient
      .get(
        `/api/workspaces/${workspace.id}/purchase-requests?search=${encodeURIComponent(
          first.requestNumber,
        )}`,
      )
      .expect(200);
    expect(numberSearch.body.data.items).toHaveLength(1);
    expect(numberSearch.body.data.items[0].id).toBe(first.id);

    const statusFilter = await ownerClient
      .get(`/api/workspaces/${workspace.id}/purchase-requests?status=draft`)
      .expect(200);
    expect(statusFilter.body.data.items).toHaveLength(2);

    const priorityFilter = await ownerClient
      .get(`/api/workspaces/${workspace.id}/purchase-requests?priority=high`)
      .expect(200);
    expect(priorityFilter.body.data.items).toHaveLength(1);
    expect(priorityFilter.body.data.items[0].id).toBe(first.id);

    const categoryFilter = await ownerClient
      .get(`/api/workspaces/${workspace.id}/purchase-requests?category=marketing`)
      .expect(200);
    expect(categoryFilter.body.data.items).toHaveLength(1);
    expect(categoryFilter.body.data.items[0].id).toBe(third.id);

    const requesterFilter = await ownerClient
      .get(
        `/api/workspaces/${workspace.id}/purchase-requests?requesterId=${encodeURIComponent(
          requester.id,
        )}`,
      )
      .expect(200);
    expect(requesterFilter.body.data.items).toHaveLength(3);

    const departmentFilter = await ownerClient
      .get(`/api/workspaces/${workspace.id}/purchase-requests?department=marketing`)
      .expect(200);
    expect(departmentFilter.body.data.items).toHaveLength(1);
    expect(departmentFilter.body.data.items[0].id).toBe(third.id);

    const today = new Date().toISOString().slice(0, 10);
    const dateFilter = await ownerClient
      .get(`/api/workspaces/${workspace.id}/purchase-requests?from=${today}&to=${today}`)
      .expect(200);
    expect(dateFilter.body.data.items).toHaveLength(3);

    const invalidDateRange = await ownerClient
      .get(`/api/workspaces/${workspace.id}/purchase-requests?from=2026-12-10&to=2026-12-01`)
      .expect(422);
    expect(invalidDateRange.body.error.code).toBe('VALIDATION_ERROR');

    const ownOnly = await requesterClient
      .get(`/api/workspaces/${workspace.id}/purchase-requests`)
      .expect(200);
    expect(ownOnly.body.data.total).toBe(3);
    expect(second.id).toBeDefined();
  });

  it('returns detail with requester, items, totals, and activity', async () => {
    const { workspace, requesterClient } = await seedWorkspace();
    const created = await createDraft(requesterClient, workspace.id);

    const detail = await requesterClient
      .get(`/api/workspaces/${workspace.id}/purchase-requests/${created.id}`)
      .expect(200);

    expect(detail.body.data).toMatchObject({
      id: created.id,
      requestNumber: created.requestNumber,
      status: RequestStatus.Draft,
      totalAmount: '70.17',
      requester: {
        id: expect.any(String),
        firstName: 'Nadia',
        lastName: 'Hassan',
      },
      actions: { canEdit: true, canDelete: true, canSubmit: true },
    });
    expect(detail.body.data.items).toHaveLength(2);
    expect(detail.body.data.items[0]).toMatchObject({
      description: 'Ergonomic task chair',
      quantity: '3.50',
      unitPrice: '19.99',
      lineTotal: '69.97',
      category: ProcurementCategory.Facilities,
    });
    expect(detail.body.data.activity.map((entry: { action: string }) => entry.action)).toContain(
      'purchase_request.created',
    );
  });
});

describe('purchase request lifecycle', () => {
  it('edits a draft, replaces items, recomputes totals, and records an audit event', async () => {
    const { workspace, requesterClient } = await seedWorkspace();
    const created = await createDraft(requesterClient, workspace.id);

    const updated = await requesterClient
      .patch(`/api/workspaces/${workspace.id}/purchase-requests/${created.id}`, {
        ...requestPayload({
          title: 'Revised office equipment refresh',
          items: [
            {
              description: 'Standing desk',
              quantity: '4',
              unit: 'unit',
              unitPrice: '250.50',
              category: ProcurementCategory.Facilities,
            },
          ],
        }),
      })
      .expect(200);

    expect(updated.body.data).toMatchObject({
      title: 'Revised office equipment refresh',
      totalAmount: '1002.00',
    });
    expect(updated.body.data.items).toHaveLength(1);
    expect(updated.body.data.items[0].description).toBe('Standing desk');

    const storedItems = await prisma.purchaseRequestItem.findMany({
      where: { purchaseRequestId: created.id },
    });
    expect(storedItems).toHaveLength(1);

    const audits = await auditFor(workspace.id, 'purchase_request.updated');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.metadata).toMatchObject({
      requestNumber: created.requestNumber,
      itemCount: 1,
      totalAmount: '1002.00',
    });
  });

  it('submits a valid draft, prevents duplicate submission, and locks further edits', async () => {
    const { workspace, requesterClient } = await seedWorkspace();
    const created = await createDraft(requesterClient, workspace.id);

    const submitted = await requesterClient
      .post(`/api/workspaces/${workspace.id}/purchase-requests/${created.id}/submit`)
      .expect(200);

    expect(submitted.body.data).toMatchObject({
      status: RequestStatus.PendingApproval,
      submittedAt: expect.any(String),
      actions: { canEdit: false, canDelete: false, canSubmit: false },
    });

    const duplicate = await requesterClient.post(
      `/api/workspaces/${workspace.id}/purchase-requests/${created.id}/submit`,
    );
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('REQUEST_ALREADY_SUBMITTED');

    const edit = await requesterClient.patch(
      `/api/workspaces/${workspace.id}/purchase-requests/${created.id}`,
      requestPayload(),
    );
    expect(edit.status).toBe(409);
    expect(edit.body.error.code).toBe('REQUEST_NOT_DRAFT');

    const remove = await requesterClient.delete(
      `/api/workspaces/${workspace.id}/purchase-requests/${created.id}`,
    );
    expect(remove.status).toBe(409);
    expect(remove.body.error.code).toBe('REQUEST_NOT_DRAFT');

    const audits = await auditFor(workspace.id, 'purchase_request.submitted');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.metadata).toMatchObject({
      requestNumber: created.requestNumber,
      status: RequestStatus.PendingApproval,
      itemCount: 2,
    });
  });

  it('soft deletes eligible drafts and preserves audit history', async () => {
    const { workspace, requester, requesterClient } = await seedWorkspace();
    const created = await createDraft(requesterClient, workspace.id);

    await requesterClient
      .delete(`/api/workspaces/${workspace.id}/purchase-requests/${created.id}`)
      .expect(204);

    const stored = await prisma.purchaseRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.deletedAt).not.toBeNull();
    expect(stored.deletedById).toBe(requester.id);

    const detail = await requesterClient.get(
      `/api/workspaces/${workspace.id}/purchase-requests/${created.id}`,
    );
    expect(detail.status).toBe(404);
    expect(detail.body.error.code).toBe('REQUEST_NOT_FOUND');

    const list = await requesterClient
      .get(`/api/workspaces/${workspace.id}/purchase-requests`)
      .expect(200);
    expect(list.body.data.total).toBe(0);

    const audits = await auditFor(workspace.id, 'purchase_request.deleted');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.metadata).toMatchObject({
      requestNumber: created.requestNumber,
      status: RequestStatus.Draft,
      itemCount: 2,
    });

    const repeat = await requesterClient.delete(
      `/api/workspaces/${workspace.id}/purchase-requests/${created.id}`,
    );
    expect(repeat.status).toBe(404);
  });

  it('rejects submission of incomplete legacy drafts without changing status', async () => {
    const { workspace, ownerClient, requester } = await seedWorkspace();

    const noItems = await prisma.purchaseRequest.create({
      data: {
        workspaceId: workspace.id,
        requestNumber: 'PR-2026-9001',
        title: 'Legacy request without items',
        description: 'Created before item validation was introduced.',
        category: ProcurementCategory.Operations,
        currency: Currency.USD,
        neededBy: new Date(Date.now() + 86_400_000),
        requestedById: requester.id,
      },
    });

    const missingNeededBy = await prisma.purchaseRequest.create({
      data: {
        workspaceId: workspace.id,
        requestNumber: 'PR-2026-9002',
        title: 'Legacy request without a date',
        description: 'Created before required-by validation was introduced.',
        category: ProcurementCategory.Operations,
        currency: Currency.USD,
        requestedById: requester.id,
        items: {
          create: {
            description: 'Legacy item',
            quantity: 1,
            unit: 'unit',
            unitPrice: 10,
            lineTotal: 10,
          },
        },
      },
    });

    for (const legacy of [noItems, missingNeededBy]) {
      const response = await ownerClient.post(
        `/api/workspaces/${workspace.id}/purchase-requests/${legacy.id}/submit`,
      );
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('REQUEST_INCOMPLETE');
    }

    expect(
      await prisma.purchaseRequest.findUniqueOrThrow({ where: { id: noItems.id } }),
    ).toMatchObject({ status: RequestStatus.Draft, submittedAt: null });
    expect(
      await prisma.purchaseRequest.findUniqueOrThrow({ where: { id: missingNeededBy.id } }),
    ).toMatchObject({ status: RequestStatus.Draft, submittedAt: null });
    expect(await auditFor(workspace.id, 'purchase_request.submitted')).toHaveLength(0);
  });

  it('handles concurrent submissions safely', async () => {
    const { workspace, requesterClient } = await seedWorkspace();
    const created = await createDraft(requesterClient, workspace.id);

    const [first, second] = await Promise.all([
      requesterClient.post(
        `/api/workspaces/${workspace.id}/purchase-requests/${created.id}/submit`,
      ),
      requesterClient.post(
        `/api/workspaces/${workspace.id}/purchase-requests/${created.id}/submit`,
      ),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const rejected = [first, second].find((response) => response.status === 409);
    expect(rejected?.body.error.code).toBe('REQUEST_ALREADY_SUBMITTED');
    expect(await auditFor(workspace.id, 'purchase_request.submitted')).toHaveLength(1);
  });

  it('rolls back item replacement when a database write fails', async () => {
    const { workspace, owner, requesterClient } = await seedWorkspace();
    const created = await createDraft(requesterClient, workspace.id);
    const before = await prisma.purchaseRequest.findUniqueOrThrow({
      where: { id: created.id },
      include: { items: true },
    });

    const actor = await actorFor(workspace.id, owner);
    const invalidInput = {
      ...requestPayload(),
      items: [
        {
          description: 'x'.repeat(301),
          quantity: '1',
          unit: 'unit',
          unitPrice: '10.00',
        },
      ],
    } as unknown as UpdatePurchaseRequestInput;

    await expect(
      updatePurchaseRequest(workspace.id, created.id, invalidInput, actor, { actorId: owner.id }),
    ).rejects.toThrow();

    const after = await prisma.purchaseRequest.findUniqueOrThrow({
      where: { id: created.id },
      include: { items: true },
    });

    expect(after.totalAmount.toFixed(2)).toBe(before.totalAmount.toFixed(2));
    expect(after.items).toHaveLength(2);
    expect(after.items.map((item) => item.description).sort()).toEqual(
      before.items.map((item) => item.description).sort(),
    );
    expect(await auditFor(workspace.id, 'purchase_request.updated')).toHaveLength(0);
  });
});

describe('purchase request authorization and isolation', () => {
  it('restricts requesters to their own requests', async () => {
    const { workspace, requesterClient, otherRequesterClient } = await seedWorkspace();
    const created = await createDraft(requesterClient, workspace.id);

    const detail = await otherRequesterClient.get(
      `/api/workspaces/${workspace.id}/purchase-requests/${created.id}`,
    );
    expect(detail.status).toBe(404);
    expect(detail.body.error.code).toBe('REQUEST_NOT_FOUND');

    const edit = await otherRequesterClient.patch(
      `/api/workspaces/${workspace.id}/purchase-requests/${created.id}`,
      requestPayload(),
    );
    expect(edit.status).toBe(404);

    const remove = await otherRequesterClient.delete(
      `/api/workspaces/${workspace.id}/purchase-requests/${created.id}`,
    );
    expect(remove.status).toBe(404);

    const submit = await otherRequesterClient.post(
      `/api/workspaces/${workspace.id}/purchase-requests/${created.id}/submit`,
    );
    expect(submit.status).toBe(404);

    const list = await otherRequesterClient
      .get(`/api/workspaces/${workspace.id}/purchase-requests`)
      .expect(200);
    expect(list.body.data.total).toBe(0);
  });

  it('lets procurement managers and admins manage workspace requests', async () => {
    const { workspace, managerClient, adminClient, requesterClient } = await seedWorkspace();
    const managedByManager = await createDraft(requesterClient, workspace.id, {
      title: 'Manager-managed request',
    });
    const managedByAdmin = await createDraft(requesterClient, workspace.id, {
      title: 'Admin-managed request',
    });

    const managerEdit = await managerClient
      .patch(
        `/api/workspaces/${workspace.id}/purchase-requests/${managedByManager.id}`,
        requestPayload({ title: 'Manager edited request' }),
      )
      .expect(200);
    expect(managerEdit.body.data.title).toBe('Manager edited request');

    const managerSubmit = await managerClient
      .post(`/api/workspaces/${workspace.id}/purchase-requests/${managedByManager.id}/submit`)
      .expect(200);
    expect(managerSubmit.body.data.status).toBe(RequestStatus.PendingApproval);

    const adminEdit = await adminClient
      .patch(
        `/api/workspaces/${workspace.id}/purchase-requests/${managedByAdmin.id}`,
        requestPayload({ title: 'Admin edited request' }),
      )
      .expect(200);
    expect(adminEdit.body.data.title).toBe('Admin edited request');

    const adminDelete = await adminClient.delete(
      `/api/workspaces/${workspace.id}/purchase-requests/${managedByAdmin.id}`,
    );
    expect(adminDelete.status).toBe(204);
  });

  it('keeps viewers read-only and approvers without submission rights', async () => {
    const { workspace, viewerClient, approverClient, requesterClient } = await seedWorkspace();
    const created = await createDraft(requesterClient, workspace.id);

    await viewerClient.get(`/api/workspaces/${workspace.id}/purchase-requests`).expect(200);
    await viewerClient
      .get(`/api/workspaces/${workspace.id}/purchase-requests/${created.id}`)
      .expect(200);

    const viewerCreate = await viewerClient.post(
      `/api/workspaces/${workspace.id}/purchase-requests`,
      requestPayload(),
    );
    expect(viewerCreate.status).toBe(403);
    expect(viewerCreate.body.error.code).toBe('FORBIDDEN');

    const viewerEdit = await viewerClient.patch(
      `/api/workspaces/${workspace.id}/purchase-requests/${created.id}`,
      requestPayload(),
    );
    expect(viewerEdit.status).toBe(403);

    const viewerDelete = await viewerClient.delete(
      `/api/workspaces/${workspace.id}/purchase-requests/${created.id}`,
    );
    expect(viewerDelete.status).toBe(403);

    const viewerSubmit = await viewerClient.post(
      `/api/workspaces/${workspace.id}/purchase-requests/${created.id}/submit`,
    );
    expect(viewerSubmit.status).toBe(403);

    await approverClient.get(`/api/workspaces/${workspace.id}/purchase-requests`).expect(200);
    const approverSubmit = await approverClient.post(
      `/api/workspaces/${workspace.id}/purchase-requests/${created.id}/submit`,
    );
    expect(approverSubmit.status).toBe(403);
    expect(approverSubmit.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects cross-workspace access without leaking request existence', async () => {
    const ownerA = await createUser('owner-a', 'Amara', 'Okafor');
    const ownerB = await createUser('owner-b', 'Benedict', 'Cole');
    const workspaceA = await createWorkspace(ownerA, 'Workspace A');
    const workspaceB = await createWorkspace(ownerB, 'Workspace B');
    const clientA = await clientFor(ownerA);
    const clientB = await clientFor(ownerB);

    const createdB = await createDraft(clientB, workspaceB.id);

    const list = await clientA.get(`/api/workspaces/${workspaceB.id}/purchase-requests`);
    expect(list.status).toBe(404);
    expect(list.body.error.code).toBe('WORKSPACE_NOT_FOUND');

    const detail = await clientA.get(
      `/api/workspaces/${workspaceA.id}/purchase-requests/${createdB.id}`,
    );
    expect(detail.status).toBe(404);
    expect(detail.body.error.code).toBe('REQUEST_NOT_FOUND');

    const edit = await clientA.patch(
      `/api/workspaces/${workspaceA.id}/purchase-requests/${createdB.id}`,
      requestPayload(),
    );
    expect(edit.status).toBe(404);
    expect(edit.body.error.code).toBe('REQUEST_NOT_FOUND');

    const remove = await clientA.delete(
      `/api/workspaces/${workspaceA.id}/purchase-requests/${createdB.id}`,
    );
    expect(remove.status).toBe(404);
    expect(remove.body.error.code).toBe('REQUEST_NOT_FOUND');

    const submit = await clientA.post(
      `/api/workspaces/${workspaceA.id}/purchase-requests/${createdB.id}/submit`,
    );
    expect(submit.status).toBe(404);
    expect(submit.body.error.code).toBe('REQUEST_NOT_FOUND');
  });

  it('requires authentication', async () => {
    const response = await request(app).get(
      '/api/workspaces/00000000-0000-4000-8000-000000000000/purchase-requests',
    );
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });
});
