import { Prisma } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { resetDatabase } from '../test/database.js';
import { createTestUser, createTestWorkspace } from '../test/factories.js';

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createProcurementChain() {
  const owner = await createTestUser('Ada', 'Owner');
  const approver = await createTestUser('Ben', 'Approver');
  const workspace = await createTestWorkspace(owner.id, 'Northwind Test');

  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: approver.id, role: 'approver' },
  });

  const vendor = await prisma.vendor.create({
    data: {
      workspaceId: workspace.id,
      name: 'Acme Technology',
      code: 'VND-001',
      category: 'information_technology',
      status: 'active',
    },
  });

  const request = await prisma.purchaseRequest.create({
    data: {
      workspaceId: workspace.id,
      requestNumber: 'PR-001',
      title: 'Workstation order',
      status: 'pending_approval',
      priority: 'high',
      category: 'information_technology',
      currency: 'USD',
      totalAmount: new Prisma.Decimal('1200.00'),
      department: 'Engineering',
      submittedAt: new Date(),
      requestedById: owner.id,
      items: {
        create: [
          {
            description: 'Laptop',
            quantity: new Prisma.Decimal('2'),
            unit: 'unit',
            unitPrice: new Prisma.Decimal('500.00'),
            lineTotal: new Prisma.Decimal('1000.00'),
          },
          {
            description: 'Docking station',
            quantity: new Prisma.Decimal('1'),
            unit: 'unit',
            unitPrice: new Prisma.Decimal('200.00'),
            lineTotal: new Prisma.Decimal('200.00'),
          },
        ],
      },
    },
    include: { items: true },
  });

  const approval = await prisma.approval.create({
    data: {
      workspaceId: workspace.id,
      purchaseRequestId: request.id,
      status: 'pending',
      currentStep: 2,
      steps: {
        create: [
          {
            stepOrder: 1,
            name: 'Manager review',
            approverId: approver.id,
            status: 'approved',
            decisionNote: 'Within the team plan.',
            decidedAt: new Date(),
          },
          {
            stepOrder: 2,
            name: 'Finance review',
            approverId: approver.id,
            status: 'pending',
          },
        ],
      },
    },
    include: { steps: true },
  });

  const quotation = await prisma.quotation.create({
    data: {
      workspaceId: workspace.id,
      purchaseRequestId: request.id,
      vendorId: vendor.id,
      quotationNumber: 'QT-001',
      status: 'selected',
      currency: 'USD',
      subtotal: new Prisma.Decimal('1200.00'),
      taxAmount: new Prisma.Decimal('96.00'),
      totalAmount: new Prisma.Decimal('1296.00'),
      validUntil: new Date(Date.now() + 86_400_000),
      submittedAt: new Date(),
      items: {
        create: [
          {
            purchaseRequestItemId: request.items[0]!.id,
            description: 'Laptop',
            quantity: new Prisma.Decimal('2'),
            unit: 'unit',
            unitPrice: new Prisma.Decimal('500.00'),
            lineTotal: new Prisma.Decimal('1000.00'),
            leadTimeDays: 5,
          },
          {
            purchaseRequestItemId: request.items[1]!.id,
            description: 'Docking station',
            quantity: new Prisma.Decimal('1'),
            unit: 'unit',
            unitPrice: new Prisma.Decimal('200.00'),
            lineTotal: new Prisma.Decimal('200.00'),
            leadTimeDays: 5,
          },
        ],
      },
    },
    include: { items: true },
  });

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      workspaceId: workspace.id,
      poNumber: 'PO-001',
      purchaseRequestId: request.id,
      vendorId: vendor.id,
      quotationId: quotation.id,
      status: 'issued',
      currency: 'USD',
      subtotal: new Prisma.Decimal('1200.00'),
      taxAmount: new Prisma.Decimal('96.00'),
      totalAmount: new Prisma.Decimal('1296.00'),
      issuedAt: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 7 * 86_400_000),
      createdById: owner.id,
      items: {
        create: {
          description: 'Laptop',
          quantity: new Prisma.Decimal('2'),
          unit: 'unit',
          unitPrice: new Prisma.Decimal('500.00'),
          lineTotal: new Prisma.Decimal('1000.00'),
        },
      },
    },
    include: { items: true },
  });

  const delivery = await prisma.delivery.create({
    data: {
      workspaceId: workspace.id,
      purchaseOrderId: purchaseOrder.id,
      deliveryNumber: 'DEL-001',
      status: 'scheduled',
      scheduledAt: new Date(Date.now() + 7 * 86_400_000),
      receivedById: owner.id,
    },
  });

  const auditLog = await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      actorId: owner.id,
      action: 'purchase_request.submitted',
      entityType: 'purchase_request',
      entityId: request.id,
      summary: 'Submitted PR-001.',
    },
  });

  return {
    owner,
    approver,
    workspace,
    vendor,
    request,
    approval,
    quotation,
    purchaseOrder,
    delivery,
    auditLog,
  };
}

describe('procurement database relationships', () => {
  it('persists the full request-to-delivery chain with fixed-precision money', async () => {
    const chain = await createProcurementChain();

    const loadedRequest = await prisma.purchaseRequest.findUnique({
      where: { id: chain.request.id },
      include: {
        items: true,
        approval: { include: { steps: true } },
        quotations: { include: { items: true } },
        purchaseOrders: {
          include: {
            items: true,
            deliveries: true,
            vendor: true,
          },
        },
      },
    });

    expect(loadedRequest?.items).toHaveLength(2);
    expect(loadedRequest?.approval?.steps).toHaveLength(2);
    expect(loadedRequest?.approval?.status).toBe('pending');
    expect(loadedRequest?.approval?.currentStep).toBe(2);
    expect(loadedRequest?.quotations).toHaveLength(1);
    expect(loadedRequest?.quotations[0]?.items).toHaveLength(2);
    expect(loadedRequest?.purchaseOrders).toHaveLength(1);
    expect(loadedRequest?.purchaseOrders[0]?.items).toHaveLength(1);
    expect(loadedRequest?.purchaseOrders[0]?.deliveries).toHaveLength(1);
    expect(loadedRequest?.purchaseOrders[0]?.vendor.name).toBe('Acme Technology');
    expect(loadedRequest?.totalAmount.toFixed(2)).toBe('1200.00');
    expect(loadedRequest?.items[0]?.lineTotal.toFixed(2)).toBe('1000.00');
    expect(loadedRequest?.purchaseOrders[0]?.totalAmount.toFixed(2)).toBe('1296.00');
    expect(loadedRequest?.totalAmount).toBeInstanceOf(Prisma.Decimal);

    const loadedWorkspace = await prisma.workspace.findUnique({
      where: { id: chain.workspace.id },
      include: {
        members: { include: { user: true } },
        auditLogs: true,
      },
    });

    expect(loadedWorkspace?.members).toHaveLength(2);
    expect(loadedWorkspace?.auditLogs).toHaveLength(1);
    expect(chain.auditLog.entityId).toBe(chain.request.id);
  });

  it('enforces workspace-scoped uniqueness and tenant isolation', async () => {
    const owner = await createTestUser('Casey', 'Owner');
    const firstWorkspace = await createTestWorkspace(owner.id, 'First Workspace');
    const secondWorkspace = await createTestWorkspace(owner.id, 'Second Workspace');

    const firstVendor = await prisma.vendor.create({
      data: {
        workspaceId: firstWorkspace.id,
        name: 'Shared Name Vendor',
        code: 'VND-SHARED',
        category: 'operations',
      },
    });

    await prisma.vendor.create({
      data: {
        workspaceId: secondWorkspace.id,
        name: 'Shared Name Vendor',
        code: 'VND-SHARED',
        category: 'operations',
      },
    });

    await expect(
      prisma.vendor.create({
        data: {
          workspaceId: firstWorkspace.id,
          name: 'Duplicate Code Vendor',
          code: 'VND-SHARED',
          category: 'operations',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await expect(
      prisma.workspaceMember.create({
        data: { workspaceId: firstWorkspace.id, userId: owner.id, role: 'viewer' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await prisma.purchaseRequest.create({
      data: {
        workspaceId: firstWorkspace.id,
        requestNumber: 'PR-SHARED',
        title: 'First workspace request',
        category: 'operations',
        requestedById: owner.id,
      },
    });

    await prisma.purchaseRequest.create({
      data: {
        workspaceId: secondWorkspace.id,
        requestNumber: 'PR-SHARED',
        title: 'Second workspace request',
        category: 'operations',
        requestedById: owner.id,
      },
    });

    await expect(
      prisma.purchaseRequest.create({
        data: {
          workspaceId: firstWorkspace.id,
          requestNumber: 'PR-SHARED',
          title: 'Duplicate request number',
          category: 'operations',
          requestedById: owner.id,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    const firstWorkspaceVendors = await prisma.vendor.findMany({
      where: { workspaceId: firstWorkspace.id },
    });
    const secondWorkspaceVendors = await prisma.vendor.findMany({
      where: { workspaceId: secondWorkspace.id },
    });

    expect(firstWorkspaceVendors).toHaveLength(1);
    expect(firstWorkspaceVendors[0]?.id).toBe(firstVendor.id);
    expect(secondWorkspaceVendors).toHaveLength(1);
    expect(secondWorkspaceVendors[0]?.id).not.toBe(firstVendor.id);
  });

  it('cascades request children while preserving purchase order history', async () => {
    const chain = await createProcurementChain();

    await prisma.purchaseRequest.delete({ where: { id: chain.request.id } });

    expect(
      await prisma.purchaseRequestItem.count({ where: { purchaseRequestId: chain.request.id } }),
    ).toBe(0);
    expect(await prisma.approval.count({ where: { purchaseRequestId: chain.request.id } })).toBe(0);
    expect(await prisma.approvalStep.count({ where: { approvalId: chain.approval.id } })).toBe(0);
    expect(await prisma.quotation.count({ where: { purchaseRequestId: chain.request.id } })).toBe(
      0,
    );
    expect(await prisma.quotationItem.count({ where: { quotationId: chain.quotation.id } })).toBe(
      0,
    );

    const retainedOrder = await prisma.purchaseOrder.findUnique({
      where: { id: chain.purchaseOrder.id },
      include: { items: true, deliveries: true },
    });

    expect(retainedOrder).not.toBeNull();
    expect(retainedOrder?.purchaseRequestId).toBeNull();
    expect(retainedOrder?.quotationId).toBeNull();
    expect(retainedOrder?.items).toHaveLength(1);
    expect(retainedOrder?.deliveries).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { entityId: chain.request.id } })).toBeGreaterThan(
      0,
    );
  });

  it('restricts deleting users and vendors that own procurement history', async () => {
    const chain = await createProcurementChain();

    await expect(prisma.vendor.delete({ where: { id: chain.vendor.id } })).rejects.toMatchObject({
      code: 'P2003',
    });

    await expect(prisma.user.delete({ where: { id: chain.owner.id } })).rejects.toMatchObject({
      code: 'P2003',
    });
  });

  it('cascades workspace-owned records without deleting the user account', async () => {
    const chain = await createProcurementChain();

    await prisma.workspace.delete({ where: { id: chain.workspace.id } });

    expect(await prisma.workspace.count({ where: { id: chain.workspace.id } })).toBe(0);
    expect(await prisma.workspaceMember.count({ where: { workspaceId: chain.workspace.id } })).toBe(
      0,
    );
    expect(await prisma.vendor.count({ where: { workspaceId: chain.workspace.id } })).toBe(0);
    expect(await prisma.purchaseOrder.count({ where: { workspaceId: chain.workspace.id } })).toBe(
      0,
    );
    expect(await prisma.delivery.count({ where: { workspaceId: chain.workspace.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { workspaceId: chain.workspace.id } })).toBe(0);
    expect(await prisma.user.count({ where: { id: chain.owner.id } })).toBe(1);
  });
});
