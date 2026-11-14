import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  ApprovalCycleStatus,
  ApprovalLevelRule,
  ApprovalStepStatus,
  ApproverAssignmentType,
  Currency,
  MembershipStatus,
  Priority,
  ProcurementCategory,
  RequestStatus,
  WorkspaceRole,
} from '@procureflow/shared';
import type {
  ApprovalDetail,
  ApprovalInboxResult,
  ApprovalWorkflowDetail,
  ApprovalWorkflowListResult,
  CreatePurchaseRequestRequest,
  PurchaseRequestDetail,
} from '@procureflow/shared';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { signSessionToken } from '../lib/session-token.js';
import {
  approveApproval,
  rejectApproval,
  requestApprovalChanges,
} from '../services/approval.service.js';
import type { ApprovalActor } from '../services/approval.service.js';
import { resetDatabase } from '../test/database.js';

const app = createApp();
const passwordHash = bcrypt.hashSync('StrongPass123', 4);

type DbRole = NonNullable<Prisma.WorkspaceMemberCreateInput['role']>;
type TestUser = { id: string; email: string };
type TestClient = Awaited<ReturnType<typeof clientFor>>;
type ApproverSpec = { memberId: string } | { role: DbRole };

interface WorkflowLevelSpec {
  name: string;
  completionRule?: ApprovalLevelRule;
  approvers: ApproverSpec[];
}

let userSequence = 0;
let workflowSequence = 0;

async function createUser(localPart: string, firstName = 'Test', lastName = 'User') {
  userSequence += 1;
  const email = `${localPart}.${userSequence}@example.com`.toLowerCase();

  return prisma.user.create({
    data: { email, passwordHash, firstName, lastName },
    select: { id: true, email: true },
  });
}

async function createWorkspace(owner: TestUser, name = 'Approval Test Workspace') {
  return prisma.workspace.create({
    data: {
      name,
      slug: `approval-test-${randomUUID()}`,
      createdById: owner.id,
      members: { create: { userId: owner.id, role: 'owner' } },
    },
  });
}

async function addMember(workspaceId: string, user: TestUser, role: DbRole) {
  return prisma.workspaceMember.create({
    data: { workspaceId, userId: user.id, role },
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
    put: (path: string, body?: object) => {
      const pending = request(app).put(path).set('Cookie', cookie);
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
    title: 'Approval workflow request',
    description: 'Request used to exercise the approval workflow state machine.',
    department: 'Operations',
    category: ProcurementCategory.Operations,
    priority: Priority.High,
    currency: Currency.USD,
    neededBy: daysFromNow(14),
    items: [
      {
        description: 'Ergonomic task chair',
        quantity: '3',
        unit: 'unit',
        unitPrice: '19.99',
      },
    ],
    ...overrides,
  };
}

async function createDraft(
  client: TestClient,
  workspaceId: string,
  overrides: Partial<CreatePurchaseRequestRequest> = {},
): Promise<PurchaseRequestDetail> {
  const response = await client
    .post(`/api/workspaces/${workspaceId}/purchase-requests`, requestPayload(overrides))
    .expect(201);

  return response.body.data as PurchaseRequestDetail;
}

async function submitDraft(
  client: TestClient,
  workspaceId: string,
  overrides: Partial<CreatePurchaseRequestRequest> = {},
): Promise<PurchaseRequestDetail> {
  const draft = await createDraft(client, workspaceId, overrides);
  return submitExisting(client, workspaceId, draft.id);
}

async function submitExisting(
  client: TestClient,
  workspaceId: string,
  requestId: string,
): Promise<PurchaseRequestDetail> {
  const response = await client
    .post(`/api/workspaces/${workspaceId}/purchase-requests/${requestId}/submit`)
    .expect(200);

  return response.body.data as PurchaseRequestDetail;
}

async function actorFor(workspaceId: string, user: TestUser): Promise<ApprovalActor> {
  const membership = await prisma.workspaceMember.findFirstOrThrow({
    where: { workspaceId, userId: user.id },
  });

  return {
    userId: user.id,
    membershipId: membership.id,
    role: membership.role as WorkspaceRole,
  };
}

function workflowPayload(approverMemberId: string, overrides: Record<string, unknown> = {}) {
  workflowSequence += 1;

  return {
    name: `Test workflow ${workflowSequence}`,
    description: 'Workflow created by approval integration tests.',
    isDefault: true,
    currency: Currency.USD,
    minAmount: null,
    maxAmount: null,
    levels: [
      {
        name: 'Approver review',
        completionRule: ApprovalLevelRule.AllRequired,
        approvers: [
          {
            assignmentType: ApproverAssignmentType.Member,
            memberId: approverMemberId,
          },
        ],
      },
    ],
    ...overrides,
  };
}

async function createWorkflow(
  workspaceId: string,
  createdById: string,
  options: {
    name?: string;
    isActive?: boolean;
    isDefault?: boolean;
    currency?: 'USD' | 'EUR' | 'GBP' | 'INR';
    minAmount?: string | null;
    maxAmount?: string | null;
    levels?: WorkflowLevelSpec[];
  } = {},
) {
  workflowSequence += 1;
  const levels =
    options.levels ??
    ([
      {
        name: 'Approver review',
        completionRule: ApprovalLevelRule.AllRequired,
        approvers: [],
      },
    ] satisfies WorkflowLevelSpec[]);

  return prisma.approvalWorkflow.create({
    data: {
      workspaceId,
      createdById,
      name: options.name ?? `Direct workflow ${workflowSequence}`,
      description: 'Workflow created directly for approval tests.',
      isActive: options.isActive ?? true,
      isDefault: options.isDefault ?? true,
      currency: options.currency ?? 'USD',
      minAmount:
        options.minAmount === undefined || options.minAmount === null
          ? null
          : new Prisma.Decimal(options.minAmount),
      maxAmount:
        options.maxAmount === undefined || options.maxAmount === null
          ? null
          : new Prisma.Decimal(options.maxAmount),
      levels: {
        create: levels.map((level, index) => ({
          levelOrder: index + 1,
          name: level.name,
          completionRule:
            level.completionRule === ApprovalLevelRule.AnyOne
              ? ('any_one' as const)
              : ('all_required' as const),
          approvers: {
            create: level.approvers.map((approver) =>
              'memberId' in approver
                ? {
                    assignmentType: 'member' as const,
                    memberId: approver.memberId,
                  }
                : {
                    assignmentType: 'role' as const,
                    role: approver.role,
                  },
            ),
          },
        })),
      },
    },
    include: {
      levels: {
        orderBy: { levelOrder: 'asc' },
        include: { approvers: true },
      },
    },
  });
}

async function seedWorkspace() {
  const owner = await createUser('owner', 'Amara', 'Okafor');
  const admin = await createUser('admin', 'Daniel', 'Reyes');
  const manager = await createUser('manager', 'Marcus', 'Chen');
  const approverA = await createUser('approver-a', 'Priya', 'Nair');
  const approverB = await createUser('approver-b', 'Jonas', 'Berg');
  const requester = await createUser('requester', 'Nadia', 'Hassan');
  const viewer = await createUser('viewer', 'Sofia', 'Lindberg');
  const outsider = await createUser('outsider', 'Owen', 'Park');

  const workspace = await createWorkspace(owner);
  const otherWorkspace = await createWorkspace(outsider, 'Other Workspace');

  const ownerMembership = await prisma.workspaceMember.findFirstOrThrow({
    where: { workspaceId: workspace.id, userId: owner.id },
  });
  const adminMembership = await addMember(workspace.id, admin, WorkspaceRole.Admin as DbRole);
  const managerMembership = await addMember(
    workspace.id,
    manager,
    WorkspaceRole.ProcurementManager as DbRole,
  );
  const approverAMembership = await addMember(
    workspace.id,
    approverA,
    WorkspaceRole.Approver as DbRole,
  );
  const approverBMembership = await addMember(
    workspace.id,
    approverB,
    WorkspaceRole.Approver as DbRole,
  );
  const requesterMembership = await addMember(
    workspace.id,
    requester,
    WorkspaceRole.Requester as DbRole,
  );
  await addMember(workspace.id, viewer, WorkspaceRole.Viewer as DbRole);
  const outsiderMembership = await prisma.workspaceMember.findFirstOrThrow({
    where: { workspaceId: otherWorkspace.id, userId: outsider.id },
  });

  return {
    owner,
    admin,
    manager,
    approverA,
    approverB,
    requester,
    viewer,
    outsider,
    workspace,
    otherWorkspace,
    memberships: {
      owner: ownerMembership,
      admin: adminMembership,
      manager: managerMembership,
      approverA: approverAMembership,
      approverB: approverBMembership,
      requester: requesterMembership,
      outsider: outsiderMembership,
    },
    clients: {
      owner: await clientFor(owner),
      admin: await clientFor(admin),
      manager: await clientFor(manager),
      approverA: await clientFor(approverA),
      approverB: await clientFor(approverB),
      requester: await clientFor(requester),
      viewer: await clientFor(viewer),
      outsider: await clientFor(outsider),
    },
  };
}

function approvalIdOf(requestDetail: PurchaseRequestDetail): string {
  if (!requestDetail.approval) {
    throw new Error('Expected the request to have an approval cycle.');
  }

  return requestDetail.approval.id;
}

async function approve(
  client: TestClient,
  workspaceId: string,
  approvalId: string,
  comment?: string,
) {
  return client.post(
    `/api/workspaces/${workspaceId}/approvals/${approvalId}/approve`,
    comment === undefined ? {} : { comment },
  );
}

async function reject(
  client: TestClient,
  workspaceId: string,
  approvalId: string,
  reason?: string,
) {
  return client.post(
    `/api/workspaces/${workspaceId}/approvals/${approvalId}/reject`,
    reason === undefined ? {} : { reason },
  );
}

async function requestChanges(
  client: TestClient,
  workspaceId: string,
  approvalId: string,
  explanation?: string,
) {
  return client.post(
    `/api/workspaces/${workspaceId}/approvals/${approvalId}/request-changes`,
    explanation === undefined ? {} : { explanation },
  );
}

async function getApprovalDetail(
  client: TestClient,
  workspaceId: string,
  approvalId: string,
): Promise<ApprovalDetail> {
  const response = await client
    .get(`/api/workspaces/${workspaceId}/approvals/${approvalId}`)
    .expect(200);

  return response.body.data as ApprovalDetail;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('approval workflow configuration', () => {
  it('creates, lists, previews, activates, deactivates, and deletes a workflow', async () => {
    const { workspace, owner, approverA, approverB, memberships, clients } = await seedWorkspace();

    const payload = workflowPayload(memberships.approverA.id, {
      isDefault: false,
      levels: [
        {
          name: 'Manager review',
          completionRule: ApprovalLevelRule.AllRequired,
          approvers: [
            {
              assignmentType: ApproverAssignmentType.Member,
              memberId: memberships.approverA.id,
            },
          ],
        },
        {
          name: 'Finance review',
          completionRule: ApprovalLevelRule.AllRequired,
          approvers: [
            {
              assignmentType: ApproverAssignmentType.Member,
              memberId: memberships.approverB.id,
            },
          ],
        },
      ],
    });

    const created = await clients.owner
      .post(`/api/workspaces/${workspace.id}/approval-workflows`, payload)
      .expect(201);
    const workflow = created.body.data as ApprovalWorkflowDetail;

    expect(workflow).toMatchObject({
      name: payload.name,
      isActive: false,
      isDefault: false,
      levelCount: 2,
      approverCount: 2,
      createdBy: { id: owner.id },
    });
    expect(workflow.levels.map((level) => level.name)).toEqual([
      'Manager review',
      'Finance review',
    ]);

    const list = await clients.owner
      .get(`/api/workspaces/${workspace.id}/approval-workflows?status=inactive`)
      .expect(200);
    const listed = list.body.data as ApprovalWorkflowListResult;
    expect(listed.total).toBe(1);
    expect(listed.items[0]?.id).toBe(workflow.id);

    const preview = await clients.owner
      .post(`/api/workspaces/${workspace.id}/approval-workflows/preview`, {
        ...payload,
        levels: [
          {
            name: 'Role review',
            completionRule: ApprovalLevelRule.AnyOne,
            approvers: [
              {
                assignmentType: ApproverAssignmentType.Role,
                role: WorkspaceRole.Approver,
              },
            ],
          },
        ],
      })
      .expect(200);
    expect(preview.body.data.canActivate).toBe(true);
    expect(
      (preview.body.data.levels[0].approvers as Array<{ id: string }>)
        .map((person) => person.id)
        .sort(),
    ).toEqual([approverA.id, approverB.id].sort());

    const activated = await clients.owner
      .post(`/api/workspaces/${workspace.id}/approval-workflows/${workflow.id}/activate`)
      .expect(200);
    expect((activated.body.data as ApprovalWorkflowDetail).isActive).toBe(true);

    const deactivated = await clients.owner
      .post(`/api/workspaces/${workspace.id}/approval-workflows/${workflow.id}/deactivate`)
      .expect(200);
    expect((deactivated.body.data as ApprovalWorkflowDetail).isActive).toBe(false);

    await clients.owner
      .delete(`/api/workspaces/${workspace.id}/approval-workflows/${workflow.id}`)
      .expect(204);
    await clients.owner
      .get(`/api/workspaces/${workspace.id}/approval-workflows/${workflow.id}`)
      .expect(404);

    const actions = await prisma.auditLog.findMany({
      where: { workspaceId: workspace.id, entityId: workflow.id },
      select: { action: true },
    });
    expect(actions.map((entry) => entry.action)).toEqual(
      expect.arrayContaining([
        'approval_workflow.created',
        'approval_workflow.activated',
        'approval_workflow.deactivated',
        'approval_workflow.deleted',
      ]),
    );
  });

  it('rejects invalid, ambiguous, and unauthorized workflow configuration', async () => {
    const { workspace, viewer, memberships, clients } = await seedWorkspace();
    const base = workflowPayload(memberships.approverA.id);

    await clients.owner
      .post(`/api/workspaces/${workspace.id}/approval-workflows`, {
        ...base,
        levels: [],
      })
      .expect(422);

    await clients.owner
      .post(`/api/workspaces/${workspace.id}/approval-workflows`, {
        ...base,
        levels: [
          {
            name: 'Duplicate member',
            completionRule: ApprovalLevelRule.AllRequired,
            approvers: [
              {
                assignmentType: ApproverAssignmentType.Member,
                memberId: memberships.approverA.id,
              },
              {
                assignmentType: ApproverAssignmentType.Member,
                memberId: memberships.approverA.id,
              },
            ],
          },
        ],
      })
      .expect(422);

    await clients.owner
      .post(`/api/workspaces/${workspace.id}/approval-workflows`, {
        ...base,
        levels: [
          {
            name: 'Viewer assignment',
            completionRule: ApprovalLevelRule.AllRequired,
            approvers: [
              {
                assignmentType: ApproverAssignmentType.Member,
                memberId: memberships.requester.id,
              },
            ],
          },
        ],
      })
      .expect(422);

    await clients.owner
      .post(`/api/workspaces/${workspace.id}/approval-workflows`, {
        ...base,
        minAmount: '2000.00',
        maxAmount: '1000.00',
      })
      .expect(422);

    await clients.owner
      .post(`/api/workspaces/${workspace.id}/approval-workflows`, base)
      .expect(201);
    await clients.owner
      .post(`/api/workspaces/${workspace.id}/approval-workflows`, {
        ...base,
        name: (base as { name: string }).name.toUpperCase(),
      })
      .expect(422);

    await clients.requester
      .post(`/api/workspaces/${workspace.id}/approval-workflows`, {
        ...base,
        name: 'Requester workflow',
      })
      .expect(403);
    await clients.approverA
      .post(`/api/workspaces/${workspace.id}/approval-workflows`, {
        ...base,
        name: 'Approver workflow',
      })
      .expect(403);

    await prisma.workspaceMember.update({
      where: { id: memberships.approverA.id },
      data: { status: MembershipStatus.Suspended, suspendedAt: new Date() },
    });

    await clients.owner
      .post(`/api/workspaces/${workspace.id}/approval-workflows`, {
        ...base,
        name: 'Suspended approver workflow',
      })
      .expect(422);

    const inactive = await createWorkflow(
      workspace.id,
      (await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })).createdById,
      {
        name: 'Not ready workflow',
        isActive: false,
        isDefault: false,
        levels: [
          {
            name: 'Suspended review',
            approvers: [{ memberId: memberships.approverA.id }],
          },
        ],
      },
    );

    await clients.owner
      .post(`/api/workspaces/${workspace.id}/approval-workflows/${inactive.id}/activate`)
      .expect(409);

    await prisma.workspaceMember.update({
      where: { id: memberships.approverA.id },
      data: { status: MembershipStatus.Active, suspendedAt: null },
    });

    expect(viewer.id).toBeTruthy();
  });

  it('selects workflows by amount and rejects ambiguous active workflows', async () => {
    const { workspace, owner, requester, memberships, clients } = await seedWorkspace();

    await createWorkflow(workspace.id, owner.id, {
      name: 'Standard band',
      isDefault: true,
      maxAmount: '1000.00',
      levels: [
        {
          name: 'Standard review',
          approvers: [{ memberId: memberships.approverA.id }],
        },
      ],
    });
    await createWorkflow(workspace.id, owner.id, {
      name: 'Capital band',
      isDefault: false,
      minAmount: '1000.01',
      levels: [
        {
          name: 'Capital review',
          approvers: [{ memberId: memberships.approverB.id }],
        },
      ],
    });

    const low = await submitDraft(clients.requester, workspace.id);
    expect(low.approval?.workflowName).toBe('Standard band');

    const high = await submitDraft(clients.requester, workspace.id, {
      items: [
        {
          description: 'Server rack',
          quantity: '1',
          unit: 'unit',
          unitPrice: '2000.00',
        },
      ],
    });
    expect(high.approval?.workflowName).toBe('Capital band');

    await prisma.approvalWorkflow.updateMany({
      where: { workspaceId: workspace.id },
      data: { isActive: false, isDefault: false },
    });

    const draft = await createDraft(clients.requester, workspace.id);
    const noWorkflow = await clients.requester
      .post(`/api/workspaces/${workspace.id}/purchase-requests/${draft.id}/submit`)
      .expect(409);
    expect(noWorkflow.body.error.code).toBe('NO_ACTIVE_APPROVAL_WORKFLOW');

    await createWorkflow(workspace.id, owner.id, {
      name: 'Ambiguous A',
      isDefault: false,
      minAmount: '0.00',
      maxAmount: '5000.00',
      levels: [
        {
          name: 'Ambiguous review A',
          approvers: [{ memberId: memberships.approverA.id }],
        },
      ],
    });
    await createWorkflow(workspace.id, owner.id, {
      name: 'Ambiguous B',
      isDefault: false,
      minAmount: '0.00',
      maxAmount: '5000.00',
      levels: [
        {
          name: 'Ambiguous review B',
          approvers: [{ memberId: memberships.approverB.id }],
        },
      ],
    });

    const ambiguous = await clients.requester
      .post(`/api/workspaces/${workspace.id}/purchase-requests/${draft.id}/submit`)
      .expect(409);
    expect(ambiguous.body.error.code).toBe('AMBIGUOUS_APPROVAL_WORKFLOW');
    expect(requester.id).toBeTruthy();
  });

  it('keeps the workflow snapshot used when a cycle was created', async () => {
    const { workspace, owner, memberships, clients } = await seedWorkspace();
    const workflow = await createWorkflow(workspace.id, owner.id, {
      name: 'Snapshot workflow',
      isDefault: true,
      levels: [
        {
          name: 'Original level',
          approvers: [{ memberId: memberships.approverA.id }],
        },
      ],
    });

    const submitted = await submitDraft(clients.requester, workspace.id);
    const approvalId = approvalIdOf(submitted);

    await clients.owner
      .put(`/api/workspaces/${workspace.id}/approval-workflows/${workflow.id}`, {
        name: 'Renamed snapshot workflow',
        description: 'Changed after submission.',
        isDefault: true,
        currency: Currency.USD,
        minAmount: null,
        maxAmount: null,
        levels: [
          {
            name: 'Changed level',
            completionRule: ApprovalLevelRule.AnyOne,
            approvers: [
              {
                assignmentType: ApproverAssignmentType.Member,
                memberId: memberships.approverB.id,
              },
            ],
          },
        ],
      })
      .expect(200);

    const requestDetail = await clients.requester
      .get(`/api/workspaces/${workspace.id}/purchase-requests/${submitted.id}`)
      .expect(200);
    const snapshot = (requestDetail.body.data as PurchaseRequestDetail).approval;
    expect(snapshot?.workflowName).toBe('Snapshot workflow');
    expect(snapshot?.levels[0]?.name).toBe('Original level');
    expect(snapshot?.levels[0]?.steps[0]?.approver?.id).toBe(memberships.approverA.userId);

    const detail = await getApprovalDetail(clients.approverA, workspace.id, approvalId);
    expect(detail.levels[0]?.name).toBe('Original level');
    expect(detail.levels[0]?.steps[0]?.approver?.id).toBe(memberships.approverA.userId);
  });
});

describe('approval cycle creation', () => {
  it('creates a snapshot cycle, assigns steps, and writes audit history', async () => {
    const { workspace, owner, memberships, clients } = await seedWorkspace();
    await createWorkflow(workspace.id, owner.id, {
      name: 'Two-level workflow',
      isDefault: true,
      levels: [
        {
          name: 'Manager review',
          approvers: [{ memberId: memberships.approverA.id }],
        },
        {
          name: 'Finance review',
          approvers: [{ memberId: memberships.approverB.id }],
        },
      ],
    });

    const submitted = await submitDraft(clients.requester, workspace.id);
    const approvalId = approvalIdOf(submitted);

    expect(submitted.status).toBe(RequestStatus.PendingApproval);
    expect(submitted.approval).toMatchObject({
      cycleNumber: 1,
      status: ApprovalCycleStatus.Pending,
      workflowName: 'Two-level workflow',
      currentLevel: 1,
      levelCount: 2,
    });
    expect(submitted.approval?.levels[0]?.steps[0]).toMatchObject({
      status: ApprovalStepStatus.Pending,
      isActive: true,
    });
    expect(submitted.approval?.levels[1]?.steps[0]).toMatchObject({
      status: ApprovalStepStatus.Pending,
      isActive: false,
    });

    const approvals = await prisma.approval.findMany({
      where: { purchaseRequestId: submitted.id },
      include: { steps: true },
    });
    expect(approvals).toHaveLength(1);
    expect(approvals[0]?.steps).toHaveLength(2);

    const cycleAudit = await prisma.auditLog.findFirst({
      where: { workspaceId: workspace.id, action: 'approval_cycle.created' },
    });
    expect(cycleAudit?.metadata).toMatchObject({
      requestId: submitted.id,
      approvalId,
      cycleNumber: 1,
      workflowName: 'Two-level workflow',
    });

    const stepAudits = await prisma.auditLog.findMany({
      where: { workspaceId: workspace.id, action: 'approval_step.assigned' },
    });
    expect(stepAudits).toHaveLength(2);
    expect(stepAudits[0]?.metadata).toMatchObject({
      requestId: submitted.id,
      approvalId,
      cycleNumber: 1,
      levelOrder: 1,
    });
    expect(stepAudits[0]?.metadata).toHaveProperty('stepId');

    const inbox = await clients.approverA
      .get(`/api/workspaces/${workspace.id}/approvals`)
      .expect(200);
    const inboxData = inbox.body.data as ApprovalInboxResult;
    expect(inboxData.items).toHaveLength(1);
    expect(inboxData.items[0]).toMatchObject({
      approvalId,
      requestId: submitted.id,
      requestNumber: submitted.requestNumber,
      levelOrder: 1,
      completionRule: ApprovalLevelRule.AllRequired,
    });
    expect(inboxData.summary.pending).toBe(1);
  });

  it('excludes the requester from role-expanded steps and prevents self approval', async () => {
    const { workspace, owner, manager, memberships, clients } = await seedWorkspace();
    await createWorkflow(workspace.id, owner.id, {
      name: 'Manager-only workflow',
      isDefault: true,
      levels: [
        {
          name: 'Manager review',
          approvers: [{ role: WorkspaceRole.ProcurementManager as DbRole }],
        },
      ],
    });

    const draft = await createDraft(clients.manager, workspace.id);
    const blocked = await clients.manager
      .post(`/api/workspaces/${workspace.id}/purchase-requests/${draft.id}/submit`)
      .expect(409);
    expect(blocked.body.error.code).toBe('NO_ELIGIBLE_APPROVERS');

    await prisma.approvalWorkflow.updateMany({
      where: { workspaceId: workspace.id },
      data: { isActive: false, isDefault: false },
    });
    await createWorkflow(workspace.id, owner.id, {
      name: 'Manager and approver workflow',
      isDefault: true,
      levels: [
        {
          name: 'Joint review',
          approvers: [{ memberId: memberships.manager.id }, { memberId: memberships.approverA.id }],
        },
      ],
    });

    const submitted = await submitDraft(clients.manager, workspace.id);
    const approvalId = approvalIdOf(submitted);
    expect(submitted.approval?.levels[0]?.steps).toHaveLength(1);
    expect(submitted.approval?.levels[0]?.steps[0]?.approver?.id).toBe(
      memberships.approverA.userId,
    );

    const step = await prisma.approvalStep.findFirstOrThrow({
      where: { approvalId },
    });
    await prisma.approvalStep.update({
      where: { id: step.id },
      data: { approverId: manager.id },
    });

    const managerActor = await actorFor(workspace.id, manager);
    await expect(
      approveApproval(workspace.id, approvalId, 'Self approval', managerActor, {
        actorId: manager.id,
      }),
    ).rejects.toMatchObject({ code: 'SELF_APPROVAL_NOT_ALLOWED' });
  });

  it('rejects suspended explicit approvers at submission', async () => {
    const { workspace, owner, memberships, clients } = await seedWorkspace();
    await createWorkflow(workspace.id, owner.id, {
      name: 'Suspended approver workflow',
      isDefault: true,
      levels: [
        {
          name: 'Suspended review',
          approvers: [{ memberId: memberships.approverA.id }],
        },
      ],
    });

    await prisma.workspaceMember.update({
      where: { id: memberships.approverA.id },
      data: { status: MembershipStatus.Suspended, suspendedAt: new Date() },
    });

    const draft = await createDraft(clients.requester, workspace.id);
    const response = await clients.requester
      .post(`/api/workspaces/${workspace.id}/purchase-requests/${draft.id}/submit`)
      .expect(409);
    expect(response.body.error.code).toBe('APPROVER_UNAVAILABLE');
  });

  it('prevents a second active cycle for the same request', async () => {
    const { workspace, owner, requester, memberships, clients } = await seedWorkspace();
    await createWorkflow(workspace.id, owner.id, {
      name: 'Active cycle guard',
      isDefault: true,
      levels: [
        {
          name: 'Guard review',
          approvers: [{ memberId: memberships.approverA.id }],
        },
      ],
    });

    const submitted = await submitDraft(clients.requester, workspace.id);
    const approvalId = approvalIdOf(submitted);

    const duplicateSubmit = await clients.requester
      .post(`/api/workspaces/${workspace.id}/purchase-requests/${submitted.id}/submit`)
      .expect(409);
    expect(duplicateSubmit.body.error.code).toBe('REQUEST_ALREADY_SUBMITTED');

    await expect(
      prisma.approval.create({
        data: {
          workspaceId: workspace.id,
          purchaseRequestId: submitted.id,
          cycleNumber: 2,
          status: 'pending',
          currentLevel: 1,
          levelCount: 1,
          requestedById: requester.id,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    expect(approvalId).toBeTruthy();
  });
});

describe('approval decisions', () => {
  it('advances sequential levels, records comments, and finalizes the request', async () => {
    const { workspace, owner, memberships, clients } = await seedWorkspace();
    await createWorkflow(workspace.id, owner.id, {
      name: 'Sequential workflow',
      isDefault: true,
      levels: [
        {
          name: 'Manager review',
          approvers: [{ memberId: memberships.approverA.id }],
        },
        {
          name: 'Finance review',
          approvers: [{ memberId: memberships.approverB.id }],
        },
      ],
    });

    const submitted = await submitDraft(clients.requester, workspace.id);
    const approvalId = approvalIdOf(submitted);

    const early = await approve(clients.approverB, workspace.id, approvalId);
    expect(early.status).toBe(403);
    expect(early.body.error.code).toBe('NOT_ASSIGNED_APPROVER');

    const first = await approve(clients.approverA, workspace.id, approvalId, 'Looks good');
    expect(first.status).toBe(200);
    const firstDetail = first.body.data as ApprovalDetail;
    expect(firstDetail.currentLevel).toBe(2);
    expect(firstDetail.status).toBe(ApprovalCycleStatus.Pending);
    expect(firstDetail.levels[0]?.steps[0]).toMatchObject({
      status: ApprovalStepStatus.Approved,
      decisionNote: 'Looks good',
      decidedBy: { id: memberships.approverA.userId },
    });
    expect(firstDetail.levels[1]?.steps[0]?.isActive).toBe(true);

    const duplicate = await approve(clients.approverA, workspace.id, approvalId);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('STEP_ALREADY_DECIDED');

    const second = await approve(clients.approverB, workspace.id, approvalId, 'Budget approved');
    expect(second.status).toBe(200);
    const finalDetail = second.body.data as ApprovalDetail;
    expect(finalDetail.status).toBe(ApprovalCycleStatus.Approved);
    expect(finalDetail.request.status).toBe(RequestStatus.Approved);
    expect(finalDetail.request.decidedAt).not.toBeNull();
    expect(finalDetail.completedAt).not.toBeNull();

    const requestDetail = await clients.requester
      .get(`/api/workspaces/${workspace.id}/purchase-requests/${submitted.id}`)
      .expect(200);
    const detail = requestDetail.body.data as PurchaseRequestDetail;
    expect(detail.status).toBe(RequestStatus.Approved);
    expect(detail.approvalHistory).toHaveLength(1);
    expect(detail.approval?.status).toBe(ApprovalCycleStatus.Approved);

    const auditActions = await prisma.auditLog.findMany({
      where: {
        workspaceId: workspace.id,
        action: { in: ['approval.approved', 'approval_cycle.completed'] },
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(auditActions.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['approval.approved', 'approval_cycle.completed']),
    );
    expect(auditActions[0]?.metadata).toMatchObject({
      requestId: submitted.id,
      approvalId,
      cycleNumber: 1,
      levelOrder: 1,
    });
  });

  it('requires a rejection reason and cancels the remaining cycle', async () => {
    const { workspace, owner, memberships, clients } = await seedWorkspace();
    await createWorkflow(workspace.id, owner.id, {
      name: 'Rejection workflow',
      isDefault: true,
      levels: [
        {
          name: 'Manager review',
          approvers: [{ memberId: memberships.approverA.id }],
        },
        {
          name: 'Finance review',
          approvers: [{ memberId: memberships.approverB.id }],
        },
        {
          name: 'Executive review',
          approvers: [{ memberId: memberships.admin.id }],
        },
      ],
    });

    const submitted = await submitDraft(clients.requester, workspace.id);
    const approvalId = approvalIdOf(submitted);

    const firstApproval = await approve(clients.approverA, workspace.id, approvalId);
    expect(firstApproval.status).toBe(200);

    const missingReason = await reject(clients.approverB, workspace.id, approvalId);
    expect(missingReason.status).toBe(422);
    expect(missingReason.body.error.details.fieldErrors.reason).toBeTruthy();

    const rejected = await reject(
      clients.approverB,
      workspace.id,
      approvalId,
      'Budget is frozen this quarter.',
    );
    expect(rejected.status).toBe(200);
    const detail = rejected.body.data as ApprovalDetail;
    expect(detail.status).toBe(ApprovalCycleStatus.Rejected);
    expect(detail.request.status).toBe(RequestStatus.Rejected);
    expect(detail.levels[1]?.steps[0]).toMatchObject({
      status: ApprovalStepStatus.Rejected,
      decisionNote: 'Budget is frozen this quarter.',
    });
    expect(detail.levels[2]?.steps[0]?.status).toBe(ApprovalStepStatus.Cancelled);

    const lateDecision = await approve(clients.admin, workspace.id, approvalId);
    expect(lateDecision.status).toBe(409);
    expect(lateDecision.body.error.code).toBe('APPROVAL_NOT_PENDING');

    const audit = await prisma.auditLog.findFirst({
      where: { workspaceId: workspace.id, action: 'approval.rejected' },
    });
    expect(audit?.metadata).toMatchObject({
      requestId: submitted.id,
      approvalId,
      decision: ApprovalStepStatus.Rejected,
    });
  });

  it('requests changes, allows edits, and resubmits as a new cycle with history', async () => {
    const { workspace, owner, memberships, clients } = await seedWorkspace();
    await createWorkflow(workspace.id, owner.id, {
      name: 'Changes workflow',
      isDefault: true,
      levels: [
        {
          name: 'Manager review',
          approvers: [{ memberId: memberships.approverA.id }],
        },
        {
          name: 'Finance review',
          approvers: [{ memberId: memberships.approverB.id }],
        },
      ],
    });

    const submitted = await submitDraft(clients.requester, workspace.id);
    const firstApprovalId = approvalIdOf(submitted);

    const firstApproval = await approve(clients.approverA, workspace.id, firstApprovalId);
    expect(firstApproval.status).toBe(200);

    const missingExplanation = await requestChanges(
      clients.approverB,
      workspace.id,
      firstApprovalId,
    );
    expect(missingExplanation.status).toBe(422);

    const changed = await requestChanges(
      clients.approverB,
      workspace.id,
      firstApprovalId,
      'Add the maintenance contract reference.',
    );
    expect(changed.status).toBe(200);
    const changedDetail = changed.body.data as ApprovalDetail;
    expect(changedDetail.status).toBe(ApprovalCycleStatus.ChangesRequested);
    expect(changedDetail.request.status).toBe(RequestStatus.ChangesRequested);
    expect(changedDetail.levels[0]?.steps[0]?.status).toBe(ApprovalStepStatus.Approved);
    expect(changedDetail.levels[1]?.steps[0]).toMatchObject({
      status: ApprovalStepStatus.ChangesRequested,
      decisionNote: 'Add the maintenance contract reference.',
    });

    const requestDetail = await clients.requester
      .get(`/api/workspaces/${workspace.id}/purchase-requests/${submitted.id}`)
      .expect(200);
    const editable = requestDetail.body.data as PurchaseRequestDetail;
    expect(editable.actions).toMatchObject({ canEdit: true, canDelete: false, canSubmit: true });

    await clients.requester
      .patch(`/api/workspaces/${workspace.id}/purchase-requests/${submitted.id}`, {
        ...requestPayload({ title: 'Revised approval workflow request' }),
      })
      .expect(200);

    const resubmitted = await submitExisting(clients.requester, workspace.id, submitted.id);
    expect(resubmitted.status).toBe(RequestStatus.PendingApproval);
    expect(resubmitted.approval?.cycleNumber).toBe(2);
    expect(resubmitted.approval?.status).toBe(ApprovalCycleStatus.Pending);
    expect(resubmitted.approvalHistory).toHaveLength(2);
    expect(resubmitted.approvalHistory?.[0]?.status).toBe(ApprovalCycleStatus.ChangesRequested);
    expect(resubmitted.approvalHistory?.[1]?.cycleNumber).toBe(2);
    expect(resubmitted.approvalHistory?.[0]?.levels[0]?.steps[0]?.status).toBe(
      ApprovalStepStatus.Approved,
    );

    const history = await clients.requester
      .get(`/api/workspaces/${workspace.id}/purchase-requests/${submitted.id}/approvals`)
      .expect(200);
    expect((history.body.data.items as unknown[]).length).toBe(2);

    const resubmissionAudit = await prisma.auditLog.findFirst({
      where: { workspaceId: workspace.id, action: 'purchase_request.resubmitted' },
    });
    expect(resubmissionAudit?.metadata).toMatchObject({ requestNumber: submitted.requestNumber });

    const newInbox = await clients.approverA
      .get(`/api/workspaces/${workspace.id}/approvals`)
      .expect(200);
    expect((newInbox.body.data as ApprovalInboxResult).items[0]?.cycleNumber).toBe(2);
  });

  it('applies ALL_REQUIRED and ANY_ONE parallel level rules', async () => {
    const { workspace, owner, memberships, clients } = await seedWorkspace();
    await createWorkflow(workspace.id, owner.id, {
      name: 'Parallel all-required workflow',
      isDefault: true,
      levels: [
        {
          name: 'Joint review',
          completionRule: ApprovalLevelRule.AllRequired,
          approvers: [
            { memberId: memberships.approverA.id },
            { memberId: memberships.approverB.id },
          ],
        },
      ],
    });

    const allRequired = await submitDraft(clients.requester, workspace.id);
    const allRequiredId = approvalIdOf(allRequired);

    const firstAll = await approve(clients.approverA, workspace.id, allRequiredId);
    expect(firstAll.status).toBe(200);
    expect((firstAll.body.data as ApprovalDetail).status).toBe(ApprovalCycleStatus.Pending);

    const secondAll = await approve(clients.approverB, workspace.id, allRequiredId);
    expect(secondAll.status).toBe(200);
    expect((secondAll.body.data as ApprovalDetail).request.status).toBe(RequestStatus.Approved);

    await prisma.approvalWorkflow.updateMany({
      where: { workspaceId: workspace.id },
      data: { isActive: false, isDefault: false },
    });
    await createWorkflow(workspace.id, owner.id, {
      name: 'Parallel any-one workflow',
      isDefault: true,
      levels: [
        {
          name: 'Either reviewer',
          completionRule: ApprovalLevelRule.AnyOne,
          approvers: [
            { memberId: memberships.approverA.id },
            { memberId: memberships.approverB.id },
          ],
        },
      ],
    });

    const anyOne = await submitDraft(clients.requester, workspace.id);
    const anyOneId = approvalIdOf(anyOne);
    const anyDecision = await approve(clients.approverA, workspace.id, anyOneId);
    expect(anyDecision.status).toBe(200);
    const anyDetail = anyDecision.body.data as ApprovalDetail;
    expect(anyDetail.request.status).toBe(RequestStatus.Approved);
    expect(anyDetail.levels[0]?.steps.map((step) => step.status).sort()).toEqual(
      [ApprovalStepStatus.Approved, ApprovalStepStatus.Skipped].sort(),
    );
  });

  it('rejects unauthorized, cross-workspace, suspended, and duplicate decisions', async () => {
    const { workspace, otherWorkspace, owner, requester, memberships, clients } =
      await seedWorkspace();
    await createWorkflow(workspace.id, owner.id, {
      name: 'Authorization workflow',
      isDefault: true,
      levels: [
        {
          name: 'Approver review',
          approvers: [{ memberId: memberships.approverA.id }],
        },
      ],
    });

    const submitted = await submitDraft(clients.requester, workspace.id);
    const approvalId = approvalIdOf(submitted);

    const requesterDenied = await approve(clients.requester, workspace.id, approvalId);
    expect(requesterDenied.status).toBe(403);
    const viewerDenied = await approve(clients.viewer, workspace.id, approvalId);
    expect(viewerDenied.status).toBe(403);
    await clients.outsider
      .get(`/api/workspaces/${workspace.id}/approvals/${approvalId}`)
      .expect(404);

    await prisma.workspaceMember.update({
      where: { id: memberships.approverA.id },
      data: { status: MembershipStatus.Suspended, suspendedAt: new Date() },
    });

    const suspended = await approve(clients.approverA, workspace.id, approvalId);
    expect(suspended.status).toBe(403);
    expect(suspended.body.error.code).toBe('MEMBERSHIP_SUSPENDED');

    await prisma.workspaceMember.update({
      where: { id: memberships.approverA.id },
      data: { status: MembershipStatus.Active, suspendedAt: null },
    });

    const finalApproval = await approve(clients.approverA, workspace.id, approvalId);
    expect(finalApproval.status).toBe(200);
    const duplicate = await approve(clients.approverA, workspace.id, approvalId);
    expect(duplicate.status).toBe(409);
    expect(otherWorkspace.id).toBeTruthy();
    expect(requester.id).toBeTruthy();
  });

  it('handles concurrent decisions and concurrent duplicate submissions safely', async () => {
    const { workspace, owner, memberships, clients } = await seedWorkspace();
    await createWorkflow(workspace.id, owner.id, {
      name: 'Concurrent workflow',
      isDefault: true,
      levels: [
        {
          name: 'Joint review',
          completionRule: ApprovalLevelRule.AllRequired,
          approvers: [
            { memberId: memberships.approverA.id },
            { memberId: memberships.approverB.id },
          ],
        },
      ],
    });

    const submitted = await submitDraft(clients.requester, workspace.id);
    const approvalId = approvalIdOf(submitted);

    const [first, second] = await Promise.all([
      approve(clients.approverA, workspace.id, approvalId),
      approve(clients.approverB, workspace.id, approvalId),
    ]);

    expect([first.status, second.status]).toEqual([200, 200]);

    const detail = await clients.requester
      .get(`/api/workspaces/${workspace.id}/purchase-requests/${submitted.id}`)
      .expect(200);
    expect((detail.body.data as PurchaseRequestDetail).status).toBe(RequestStatus.Approved);

    const approvedSteps = await prisma.approvalStep.count({
      where: { approvalId, status: 'approved' },
    });
    expect(approvedSteps).toBe(2);

    await prisma.approvalWorkflow.updateMany({
      where: { workspaceId: workspace.id },
      data: { isActive: false, isDefault: false },
    });
    await createWorkflow(workspace.id, owner.id, {
      name: 'Duplicate decision workflow',
      isDefault: true,
      levels: [
        {
          name: 'Single review',
          approvers: [{ memberId: memberships.approverA.id }],
        },
      ],
    });

    const single = await submitDraft(clients.requester, workspace.id);
    const singleApprovalId = approvalIdOf(single);
    const results = await Promise.all([
      approve(clients.approverA, workspace.id, singleApprovalId),
      approve(clients.approverA, workspace.id, singleApprovalId),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(
      await prisma.approvalStep.count({
        where: { approvalId: singleApprovalId, status: 'approved' },
      }),
    ).toBe(1);
  });

  it('rolls back the decision when the final status transition fails', async () => {
    const { workspace, owner, memberships, clients } = await seedWorkspace();
    await createWorkflow(workspace.id, owner.id, {
      name: 'Rollback workflow',
      isDefault: true,
      levels: [
        {
          name: 'Approver review',
          approvers: [{ memberId: memberships.approverA.id }],
        },
      ],
    });

    const submitted = await submitDraft(clients.requester, workspace.id);
    const approvalId = approvalIdOf(submitted);
    const actor = await actorFor(
      workspace.id,
      (await prisma.user.findUniqueOrThrow({
        where: { id: memberships.approverA.userId },
      })) as TestUser,
    );

    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION test_fail_request_update() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'simulated transition failure';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER test_fail_request_update
      BEFORE UPDATE ON purchase_requests
      FOR EACH ROW EXECUTE FUNCTION test_fail_request_update();
    `);

    try {
      await expect(
        approveApproval(workspace.id, approvalId, 'Approve', actor, {
          actorId: actor.userId,
        }),
      ).rejects.toBeTruthy();
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS test_fail_request_update ON purchase_requests;',
      );
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS test_fail_request_update();');
    }

    const step = await prisma.approvalStep.findFirstOrThrow({ where: { approvalId } });
    const approval = await prisma.approval.findUniqueOrThrow({ where: { id: approvalId } });
    const request = await prisma.purchaseRequest.findUniqueOrThrow({
      where: { id: submitted.id },
    });

    expect(step.status).toBe('pending');
    expect(step.decisionNote).toBeNull();
    expect(approval.status).toBe('pending');
    expect(request.status).toBe('pending_approval');
  });

  it('serves the assigned inbox with filters, summary, and decision actions', async () => {
    const { workspace, owner, requester, memberships, clients } = await seedWorkspace();
    await createWorkflow(workspace.id, owner.id, {
      name: 'Inbox workflow',
      isDefault: true,
      levels: [
        {
          name: 'Manager review',
          approvers: [{ memberId: memberships.approverA.id }],
        },
        {
          name: 'Finance review',
          approvers: [{ memberId: memberships.approverB.id }],
        },
      ],
    });

    const submitted = await submitDraft(clients.requester, workspace.id, {
      priority: Priority.Urgent,
    });
    const approvalId = approvalIdOf(submitted);

    const inbox = await clients.approverA
      .get(
        `/api/workspaces/${workspace.id}/approvals?search=${encodeURIComponent(
          submitted.requestNumber,
        )}&priority=urgent&requesterId=${requester.id}&minAmount=0.00&maxAmount=10000.00`,
      )
      .expect(200);
    const inboxData = inbox.body.data as ApprovalInboxResult;
    expect(inboxData.items).toHaveLength(1);
    expect(inboxData.items[0]).toMatchObject({
      requestId: submitted.id,
      priority: Priority.Urgent,
      requester: { id: requester.id },
      amount: submitted.totalAmount,
    });
    expect(inboxData.summary.pending).toBe(1);

    const otherInbox = await clients.approverB
      .get(`/api/workspaces/${workspace.id}/approvals`)
      .expect(200);
    const otherInboxData = otherInbox.body.data as ApprovalInboxResult;
    expect(otherInboxData.items).toHaveLength(0);
    expect(otherInboxData.summary.pending).toBe(0);

    const detail = await getApprovalDetail(clients.approverA, workspace.id, approvalId);
    expect(detail.request.items).toHaveLength(1);
    expect(detail.actions.canApprove).toBe(true);
    expect(detail.actions.assignedStepId).toBeTruthy();
    expect(detail.history).toHaveLength(1);

    const laterApproverDetail = await getApprovalDetail(
      clients.approverB,
      workspace.id,
      approvalId,
    );
    expect(laterApproverDetail.actions.canApprove).toBe(false);
    expect(laterApproverDetail.actions.blockedReason).toContain('not the assigned approver');

    const approved = await approve(clients.approverA, workspace.id, approvalId);
    expect(approved.status).toBe(200);

    const approvedInbox = await clients.approverA
      .get(`/api/workspaces/${workspace.id}/approvals?status=approved`)
      .expect(200);
    expect((approvedInbox.body.data as ApprovalInboxResult).items).toHaveLength(1);

    const pendingInbox = await clients.approverA
      .get(`/api/workspaces/${workspace.id}/approvals`)
      .expect(200);
    expect((pendingInbox.body.data as ApprovalInboxResult).items).toHaveLength(0);
  });

  it('supports service-level rejection and change requests for direct callers', async () => {
    const { workspace, owner, requester, approverA, memberships } = await seedWorkspace();
    await createWorkflow(workspace.id, owner.id, {
      name: 'Service workflow',
      isDefault: true,
      levels: [
        {
          name: 'Approver review',
          approvers: [{ memberId: memberships.approverA.id }],
        },
      ],
    });

    const submitted = await submitDraft(await clientFor(requester), workspace.id);
    const approvalId = approvalIdOf(submitted);
    const actor = await actorFor(workspace.id, approverA);

    await expect(
      rejectApproval(workspace.id, approvalId, '', actor, { actorId: approverA.id }),
    ).rejects.toMatchObject({ statusCode: 422 });

    const rejected = await rejectApproval(
      workspace.id,
      approvalId,
      'Direct service rejection.',
      actor,
      { actorId: approverA.id },
    );
    expect(rejected.request.status).toBe(RequestStatus.Rejected);

    const second = await submitDraft(await clientFor(requester), workspace.id);
    const secondId = approvalIdOf(second);
    const changed = await requestApprovalChanges(
      workspace.id,
      secondId,
      'Direct service change request.',
      actor,
      { actorId: approverA.id },
    );
    expect(changed.request.status).toBe(RequestStatus.ChangesRequested);
  });
});
