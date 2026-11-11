import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import {
  InvitationStatus,
  MembershipStatus,
  Permission,
  WorkspaceRole,
  permissionsForRole,
} from '@procureflow/shared';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { AppError } from '../errors/app-error.js';
import { hashInvitationToken } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import { signSessionToken } from '../lib/session-token.js';
import { changeMemberRole, removeMember, suspendMember } from '../services/member.service.js';
import { resetDatabase } from '../test/database.js';

const app = createApp();
const passwordHash = bcrypt.hashSync('StrongPass123', 4);

type DbRole = NonNullable<Prisma.WorkspaceMemberCreateInput['role']>;
type DbStatus = NonNullable<Prisma.WorkspaceMemberCreateInput['status']>;
type TestUser = { id: string; email: string };

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

async function addMember(
  workspaceId: string,
  user: TestUser,
  role: DbRole,
  status: DbStatus = 'active',
) {
  return prisma.workspaceMember.create({
    data: {
      workspaceId,
      userId: user.id,
      role,
      status,
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
    post: (path: string, body?: Record<string, unknown>) => {
      const pending = request(app).post(path).set('Cookie', cookie);
      return body === undefined ? pending : pending.send(body);
    },
    patch: (path: string, body?: Record<string, unknown>) => {
      const pending = request(app).patch(path).set('Cookie', cookie);
      return body === undefined ? pending : pending.send(body);
    },
    delete: (path: string) => request(app).delete(path).set('Cookie', cookie),
  };
}

async function auditFor(workspaceId: string, action: string) {
  return prisma.auditLog.findMany({
    where: { workspaceId, action },
    orderBy: { createdAt: 'asc' },
  });
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('workspace role permission matrix', () => {
  it('resolves effective permissions from the membership role for every role', async () => {
    const owner = await createUser('owner', 'Amara', 'Okafor');
    const workspace = await createWorkspace(owner);
    const users = new Map<WorkspaceRole, TestUser>([[WorkspaceRole.Owner, owner]]);

    for (const role of Object.values(WorkspaceRole)) {
      if (role === WorkspaceRole.Owner) {
        continue;
      }

      const user = await createUser(role.replaceAll('_', '-'), role, 'Member');
      await addMember(workspace.id, user, role as DbRole);
      users.set(role, user);
    }

    for (const role of Object.values(WorkspaceRole)) {
      const user = users.get(role);
      expect(user).toBeDefined();

      const client = await clientFor(user!);
      const sessionResponse = await client.get('/api/auth/me').expect(200);
      const workspaceSession = sessionResponse.body.data.workspaces.find(
        (entry: { id: string }) => entry.id === workspace.id,
      );

      expect(workspaceSession).toMatchObject({
        id: workspace.id,
        role,
        permissions: [...permissionsForRole(role)],
      });

      const permissionResponse = await client
        .get(`/api/workspaces/${workspace.id}/permissions`)
        .expect(200);

      expect(permissionResponse.body.data).toEqual({
        workspaceId: workspace.id,
        role,
        permissions: [...permissionsForRole(role)],
      });
    }
  });

  it('enforces permission boundaries on member and invitation operations', async () => {
    const owner = await createUser('owner', 'Amara', 'Okafor');
    const workspace = await createWorkspace(owner);
    const admin = await createUser('admin', 'Daniel', 'Reyes');
    const manager = await createUser('manager', 'Marcus', 'Chen');
    const requester = await createUser('requester', 'Nadia', 'Hassan');
    const approver = await createUser('approver', 'Priya', 'Nair');
    const viewer = await createUser('viewer', 'Sofia', 'Lindberg');

    await addMember(workspace.id, admin, WorkspaceRole.Admin as DbRole);
    await addMember(workspace.id, manager, WorkspaceRole.ProcurementManager as DbRole);
    await addMember(workspace.id, requester, WorkspaceRole.Requester as DbRole);
    await addMember(workspace.id, approver, WorkspaceRole.Approver as DbRole);
    await addMember(workspace.id, viewer, WorkspaceRole.Viewer as DbRole);

    const requesterClient = await clientFor(requester);
    const approverClient = await clientFor(approver);
    const viewerClient = await clientFor(viewer);
    const managerClient = await clientFor(manager);
    const adminClient = await clientFor(admin);

    for (const client of [requesterClient, approverClient, viewerClient]) {
      const response = await client.get(`/api/workspaces/${workspace.id}/members`).expect(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    }

    await managerClient.get(`/api/workspaces/${workspace.id}/members`).expect(200);
    await managerClient
      .post(`/api/workspaces/${workspace.id}/invitations`, {
        email: 'invitee@example.com',
        role: WorkspaceRole.Requester,
      })
      .expect(403);

    await requesterClient
      .patch(`/api/workspaces/${workspace.id}/members/${viewer.id}/role`, {
        role: WorkspaceRole.Admin,
      })
      .expect(403);

    const invitation = await adminClient
      .post(`/api/workspaces/${workspace.id}/invitations`, {
        email: 'invitee@example.com',
        role: WorkspaceRole.Requester,
      })
      .expect(201);

    expect(invitation.body.data.invitation.role).toBe(WorkspaceRole.Requester);
    expect(invitation.body.data.invitation.status).toBe(InvitationStatus.Pending);

    await adminClient
      .post(`/api/workspaces/${workspace.id}/invitations`, {
        email: 'another@example.com',
        role: WorkspaceRole.Owner,
      })
      .expect(403);

    expect(Permission.MembersRead).toBeDefined();
    expect(MembershipStatus.Active).toBe('active');
  });
});

describe('authentication and workspace isolation', () => {
  it('rejects unauthenticated member and invitation requests with 401', async () => {
    const owner = await createUser('owner', 'Amara', 'Okafor');
    const workspace = await createWorkspace(owner);

    const members = await request(app).get(`/api/workspaces/${workspace.id}/members`);
    expect(members.status).toBe(401);
    expect(members.body.error.code).toBe('AUTH_REQUIRED');

    const permissions = await request(app).get(`/api/workspaces/${workspace.id}/permissions`);
    expect(permissions.status).toBe(401);

    const accept = await request(app)
      .post('/api/invitations/accept')
      .send({ token: 'a'.repeat(43) });
    expect(accept.status).toBe(401);
    expect(accept.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('returns 404 instead of leaking another workspace or member', async () => {
    const ownerA = await createUser('owner-a', 'Amara', 'Okafor');
    const ownerB = await createUser('owner-b', 'Benedict', 'Cole');
    const workspaceA = await createWorkspace(ownerA, 'Workspace A');
    const workspaceB = await createWorkspace(ownerB, 'Workspace B');
    const memberB = await addMember(
      workspaceB.id,
      await createUser('member-b', 'Mina', 'Bell'),
      WorkspaceRole.Viewer as DbRole,
    );

    const clientA = await clientFor(ownerA);

    const crossWorkspaceList = await clientA.get(`/api/workspaces/${workspaceB.id}/members`);
    expect(crossWorkspaceList.status).toBe(404);
    expect(crossWorkspaceList.body.error.code).toBe('WORKSPACE_NOT_FOUND');

    const crossWorkspaceMember = await clientA.get(
      `/api/workspaces/${workspaceA.id}/members/${memberB.id}`,
    );
    expect(crossWorkspaceMember.status).toBe(404);
    expect(crossWorkspaceMember.body.error.code).toBe('MEMBER_NOT_FOUND');

    const crossWorkspaceRole = await clientA.patch(
      `/api/workspaces/${workspaceA.id}/members/${memberB.id}/role`,
      { role: WorkspaceRole.Viewer },
    );
    expect(crossWorkspaceRole.status).toBe(404);
    expect(crossWorkspaceRole.body.error.code).toBe('MEMBER_NOT_FOUND');

    const crossWorkspaceInvite = await clientA.post(
      `/api/workspaces/${workspaceB.id}/invitations`,
      { email: 'intruder@example.com', role: WorkspaceRole.Requester },
    );
    expect(crossWorkspaceInvite.status).toBe(404);
    expect(crossWorkspaceInvite.body.error.code).toBe('WORKSPACE_NOT_FOUND');

    const clientB = await clientFor(ownerB);
    const invitationB = await clientB
      .post(`/api/workspaces/${workspaceB.id}/invitations`, {
        email: 'invitee@example.com',
        role: WorkspaceRole.Requester,
      })
      .expect(201);

    const crossWorkspaceRevoke = await clientA.post(
      `/api/workspaces/${workspaceA.id}/invitations/${invitationB.body.data.invitation.id}/revoke`,
    );
    expect(crossWorkspaceRevoke.status).toBe(404);
    expect(crossWorkspaceRevoke.body.error.code).toBe('INVITATION_NOT_FOUND');
  });
});

describe('member directory', () => {
  async function seedDirectory() {
    const owner = await createUser('owner', 'Amara', 'Okafor');
    const workspace = await createWorkspace(owner, 'Directory Workspace');
    const admin = await createUser('admin', 'Daniel', 'Reyes');
    const manager = await createUser('manager', 'Marcus', 'Chen');
    const approver = await createUser('approver', 'Priya', 'Nair');
    const requester = await createUser('requester', 'Nadia', 'Hassan');
    const viewer = await createUser('viewer', 'Sofia', 'Lindberg');

    await addMember(workspace.id, admin, WorkspaceRole.Admin as DbRole);
    await addMember(workspace.id, manager, WorkspaceRole.ProcurementManager as DbRole);
    await addMember(workspace.id, approver, WorkspaceRole.Approver as DbRole);
    const requesterMembership = await addMember(
      workspace.id,
      requester,
      WorkspaceRole.Requester as DbRole,
    );
    const viewerMembership = await addMember(workspace.id, viewer, WorkspaceRole.Viewer as DbRole);

    return {
      owner,
      workspace,
      requester,
      requesterMembership,
      viewerMembership,
      client: await clientFor(owner),
    };
  }

  it('paginates, searches, filters, and returns member details', async () => {
    const { workspace, requesterMembership, client } = await seedDirectory();

    const firstPage = await client
      .get(`/api/workspaces/${workspace.id}/members?page=1&pageSize=2`)
      .expect(200);

    expect(firstPage.body.data).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 6,
      totalPages: 3,
    });
    expect(firstPage.body.data.items).toHaveLength(2);

    const lastPage = await client
      .get(`/api/workspaces/${workspace.id}/members?page=3&pageSize=2`)
      .expect(200);

    expect(lastPage.body.data.items).toHaveLength(2);

    const search = await client
      .get(`/api/workspaces/${workspace.id}/members?search=nadia`)
      .expect(200);

    expect(search.body.data.items).toHaveLength(1);
    expect(search.body.data.items[0]).toMatchObject({
      firstName: 'Nadia',
      role: WorkspaceRole.Requester,
      isCurrentUser: false,
    });

    const roleFilter = await client
      .get(`/api/workspaces/${workspace.id}/members?role=requester`)
      .expect(200);

    expect(roleFilter.body.data.items).toHaveLength(1);
    expect(roleFilter.body.data.items[0].id).toBe(requesterMembership.id);

    const detail = await client
      .get(`/api/workspaces/${workspace.id}/members/${requesterMembership.id}`)
      .expect(200);

    expect(detail.body.data).toMatchObject({
      id: requesterMembership.id,
      email: expect.stringContaining('requester'),
      role: WorkspaceRole.Requester,
      status: MembershipStatus.Active,
    });

    const ownerDetail = await client
      .get(`/api/workspaces/${workspace.id}/members?search=amara`)
      .expect(200);

    expect(ownerDetail.body.data.items[0].isCurrentUser).toBe(true);
  });

  it('filters by membership status and validates query input', async () => {
    const { workspace, viewerMembership, client } = await seedDirectory();

    await client
      .post(`/api/workspaces/${workspace.id}/members/${viewerMembership.id}/suspend`)
      .expect(200);

    const suspended = await client
      .get(`/api/workspaces/${workspace.id}/members?status=suspended`)
      .expect(200);

    expect(suspended.body.data.items).toHaveLength(1);
    expect(suspended.body.data.items[0].id).toBe(viewerMembership.id);

    const invalidPage = await client
      .get(`/api/workspaces/${workspace.id}/members?page=0`)
      .expect(422);
    expect(invalidPage.body.error.code).toBe('VALIDATION_ERROR');

    const invalidRole = await client
      .get(`/api/workspaces/${workspace.id}/members?role=superuser`)
      .expect(422);
    expect(invalidRole.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('member role changes and privilege escalation', () => {
  async function seedRoles() {
    const owner = await createUser('owner', 'Amara', 'Okafor');
    const workspace = await createWorkspace(owner);
    const admin = await createUser('admin', 'Daniel', 'Reyes');
    const manager = await createUser('manager', 'Marcus', 'Chen');
    const requester = await createUser('requester', 'Nadia', 'Hassan');
    const viewer = await createUser('viewer', 'Sofia', 'Lindberg');

    const adminMembership = await addMember(workspace.id, admin, WorkspaceRole.Admin as DbRole);
    const managerMembership = await addMember(
      workspace.id,
      manager,
      WorkspaceRole.ProcurementManager as DbRole,
    );
    const requesterMembership = await addMember(
      workspace.id,
      requester,
      WorkspaceRole.Requester as DbRole,
    );
    const viewerMembership = await addMember(workspace.id, viewer, WorkspaceRole.Viewer as DbRole);

    return {
      owner,
      workspace,
      admin,
      requester,
      adminMembership,
      managerMembership,
      requesterMembership,
      viewerMembership,
      ownerClient: await clientFor(owner),
      adminClient: await clientFor(admin),
      requesterClient: await clientFor(requester),
    };
  }

  it('allows a higher role to change a lower role and records an audit event', async () => {
    const { workspace, admin, requesterMembership, adminClient } = await seedRoles();

    const response = await adminClient
      .patch(`/api/workspaces/${workspace.id}/members/${requesterMembership.id}/role`, {
        role: WorkspaceRole.Approver,
      })
      .expect(200);

    expect(response.body.data.role).toBe(WorkspaceRole.Approver);

    const stored = await prisma.workspaceMember.findUniqueOrThrow({
      where: { id: requesterMembership.id },
    });
    expect(stored.role).toBe(WorkspaceRole.Approver);

    const audits = await auditFor(workspace.id, 'member.role_changed');
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: admin.id,
      entityType: 'workspace_member',
      entityId: requesterMembership.id,
    });
    expect(audits[0]?.metadata).toEqual({
      previousRole: WorkspaceRole.Requester,
      newRole: WorkspaceRole.Approver,
    });
  });

  it('blocks admins from managing owners, peers, or granting ownership', async () => {
    const { workspace, owner, managerMembership, viewerMembership, adminClient } =
      await seedRoles();
    const secondAdmin = await createUser('admin-peer', 'Dana', 'Scully');
    const peerMembership = await addMember(
      workspace.id,
      secondAdmin,
      WorkspaceRole.Admin as DbRole,
    );

    const ownerResponse = await adminClient.patch(
      `/api/workspaces/${workspace.id}/members/${
        (
          await prisma.workspaceMember.findFirstOrThrow({
            where: { workspaceId: workspace.id, userId: owner.id },
          })
        ).id
      }/role`,
      { role: WorkspaceRole.Viewer },
    );
    expect(ownerResponse.status).toBe(403);
    expect(ownerResponse.body.error.code).toBe('ROLE_HIERARCHY');

    const peerResponse = await adminClient.patch(
      `/api/workspaces/${workspace.id}/members/${peerMembership.id}/role`,
      { role: WorkspaceRole.Viewer },
    );
    expect(peerResponse.status).toBe(403);
    expect(peerResponse.body.error.code).toBe('ROLE_HIERARCHY');

    const managerToAdmin = await adminClient.patch(
      `/api/workspaces/${workspace.id}/members/${managerMembership.id}/role`,
      { role: WorkspaceRole.Admin },
    );
    expect(managerToAdmin.status).toBe(403);
    expect(managerToAdmin.body.error.code).toBe('ROLE_ASSIGNMENT_FORBIDDEN');

    const viewerToOwner = await adminClient.patch(
      `/api/workspaces/${workspace.id}/members/${viewerMembership.id}/role`,
      { role: WorkspaceRole.Owner },
    );
    expect(viewerToOwner.status).toBe(403);
    expect(viewerToOwner.body.error.code).toBe('ROLE_ASSIGNMENT_FORBIDDEN');
  });

  it('blocks self-management and requests without member permissions', async () => {
    const { workspace, owner, requesterClient, ownerClient } = await seedRoles();
    const ownerMembership = await prisma.workspaceMember.findFirstOrThrow({
      where: { workspaceId: workspace.id, userId: owner.id },
    });

    const selfChange = await ownerClient.patch(
      `/api/workspaces/${workspace.id}/members/${ownerMembership.id}/role`,
      { role: WorkspaceRole.Admin },
    );
    expect(selfChange.status).toBe(409);
    expect(selfChange.body.error.code).toBe('CANNOT_MODIFY_SELF');

    const forbidden = await requesterClient.patch(
      `/api/workspaces/${workspace.id}/members/${ownerMembership.id}/role`,
      { role: WorkspaceRole.Viewer },
    );
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
  });

  it('lets owners promote and demote other owners while preserving ownership actions', async () => {
    const { workspace, ownerClient, requesterMembership } = await seedRoles();

    const promoted = await ownerClient
      .patch(`/api/workspaces/${workspace.id}/members/${requesterMembership.id}/role`, {
        role: WorkspaceRole.Owner,
      })
      .expect(200);

    expect(promoted.body.data.role).toBe(WorkspaceRole.Owner);
    expect(
      await prisma.workspaceMember.count({
        where: { workspaceId: workspace.id, role: WorkspaceRole.Owner },
      }),
    ).toBe(2);

    const demoted = await ownerClient
      .patch(`/api/workspaces/${workspace.id}/members/${requesterMembership.id}/role`, {
        role: WorkspaceRole.Admin,
      })
      .expect(200);

    expect(demoted.body.data.role).toBe(WorkspaceRole.Admin);
    expect(await auditFor(workspace.id, 'member.role_changed')).toHaveLength(2);
  });

  it('serializes concurrent owner demotions and protects the last active owner', async () => {
    const ownerA = await createUser('owner-a', 'Amara', 'Okafor');
    const workspace = await createWorkspace(ownerA);
    const ownerB = await createUser('owner-b', 'Benedict', 'Cole');
    const memberA = await prisma.workspaceMember.findFirstOrThrow({
      where: { workspaceId: workspace.id, userId: ownerA.id },
    });
    const memberB = await addMember(workspace.id, ownerB, WorkspaceRole.Owner as DbRole);

    const results = await Promise.allSettled([
      changeMemberRole(
        workspace.id,
        memberB.id,
        WorkspaceRole.Viewer,
        { userId: ownerA.id, membershipId: memberA.id, role: WorkspaceRole.Owner },
        { actorId: ownerA.id },
      ),
      changeMemberRole(
        workspace.id,
        memberA.id,
        WorkspaceRole.Viewer,
        { userId: ownerB.id, membershipId: memberB.id, role: WorkspaceRole.Owner },
        { actorId: ownerB.id },
      ),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(AppError);
    expect(rejected[0]?.reason).toMatchObject({
      statusCode: 409,
      code: 'LAST_OWNER_PROTECTED',
    });
    expect(
      await prisma.workspaceMember.count({
        where: {
          workspaceId: workspace.id,
          role: WorkspaceRole.Owner,
          status: MembershipStatus.Active,
        },
      }),
    ).toBe(1);
    expect(await auditFor(workspace.id, 'member.role_changed')).toHaveLength(1);
  });
});

describe('member suspension, reactivation, and removal', () => {
  async function seedMembers() {
    const owner = await createUser('owner', 'Amara', 'Okafor');
    const workspace = await createWorkspace(owner);
    const admin = await createUser('admin', 'Daniel', 'Reyes');
    const requester = await createUser('requester', 'Nadia', 'Hassan');
    const viewer = await createUser('viewer', 'Sofia', 'Lindberg');

    const adminMembership = await addMember(workspace.id, admin, WorkspaceRole.Admin as DbRole);
    const requesterMembership = await addMember(
      workspace.id,
      requester,
      WorkspaceRole.Requester as DbRole,
    );
    const viewerMembership = await addMember(workspace.id, viewer, WorkspaceRole.Viewer as DbRole);

    return {
      owner,
      workspace,
      admin,
      requester,
      viewer,
      adminMembership,
      requesterMembership,
      viewerMembership,
      ownerClient: await clientFor(owner),
      adminClient: await clientFor(admin),
      requesterClient: await clientFor(requester),
      viewerClient: await clientFor(viewer),
    };
  }

  it('suspends a member, removes workspace access, and reactivates them', async () => {
    const { workspace, owner, requester, requesterMembership, ownerClient, requesterClient } =
      await seedMembers();

    const suspended = await ownerClient
      .post(`/api/workspaces/${workspace.id}/members/${requesterMembership.id}/suspend`)
      .expect(200);

    expect(suspended.body.data).toMatchObject({
      status: MembershipStatus.Suspended,
      suspendedAt: expect.any(String),
    });

    const suspendedSession = await requesterClient.get('/api/auth/me').expect(200);
    expect(suspendedSession.body.data.workspaces).toEqual([]);

    const suspendedAccess = await requesterClient.get(`/api/workspaces/${workspace.id}/members`);
    expect(suspendedAccess.status).toBe(403);
    expect(suspendedAccess.body.error.code).toBe('MEMBERSHIP_SUSPENDED');

    const suspensionAudits = await auditFor(workspace.id, 'member.suspended');
    expect(suspensionAudits).toHaveLength(1);
    expect(suspensionAudits[0]).toMatchObject({
      actorId: owner.id,
      entityId: requesterMembership.id,
    });

    const reactivated = await ownerClient
      .post(`/api/workspaces/${workspace.id}/members/${requesterMembership.id}/reactivate`)
      .expect(200);

    expect(reactivated.body.data.status).toBe(MembershipStatus.Active);
    expect(reactivated.body.data.suspendedAt).toBeNull();

    const activeSession = await requesterClient.get('/api/auth/me').expect(200);
    expect(
      activeSession.body.data.workspaces.some((entry: { id: string }) => entry.id === workspace.id),
    ).toBe(true);

    const reactivationAudits = await auditFor(workspace.id, 'member.reactivated');
    expect(reactivationAudits).toHaveLength(1);
    expect(reactivationAudits[0]?.actorId).toBe(owner.id);
    expect(requester.email).toContain('requester');
  });

  it('removes a member and records the removal without deleting the user', async () => {
    const { workspace, owner, viewer, viewerMembership, ownerClient, viewerClient } =
      await seedMembers();
    const ownerMembership = await prisma.workspaceMember.findFirstOrThrow({
      where: { workspaceId: workspace.id, userId: owner.id },
    });

    const selfRemoval = await ownerClient.delete(
      `/api/workspaces/${workspace.id}/members/${ownerMembership.id}`,
    );
    expect(selfRemoval.status).toBe(409);
    expect(selfRemoval.body.error.code).toBe('CANNOT_MODIFY_SELF');

    await ownerClient
      .delete(`/api/workspaces/${workspace.id}/members/${viewerMembership.id}`)
      .expect(204);

    expect(
      await prisma.workspaceMember.findUnique({ where: { id: viewerMembership.id } }),
    ).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: viewer.id } })).not.toBeNull();

    const viewerSession = await viewerClient.get('/api/auth/me').expect(200);
    expect(viewerSession.body.data.workspaces).toEqual([]);

    const removedAccess = await viewerClient.get(`/api/workspaces/${workspace.id}/members`);
    expect(removedAccess.status).toBe(404);
    expect(removedAccess.body.error.code).toBe('WORKSPACE_NOT_FOUND');

    const audits = await auditFor(workspace.id, 'member.removed');
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: owner.id,
      entityId: viewerMembership.id,
    });
  });

  it('prevents admins from suspending owners and blocks self-suspension', async () => {
    const { workspace, owner, adminMembership, ownerClient, adminClient } = await seedMembers();
    const ownerMembership = await prisma.workspaceMember.findFirstOrThrow({
      where: { workspaceId: workspace.id, userId: owner.id },
    });

    const adminSuspendOwner = await adminClient.post(
      `/api/workspaces/${workspace.id}/members/${ownerMembership.id}/suspend`,
    );
    expect(adminSuspendOwner.status).toBe(403);
    expect(adminSuspendOwner.body.error.code).toBe('ROLE_HIERARCHY');

    const selfSuspend = await ownerClient.post(
      `/api/workspaces/${workspace.id}/members/${ownerMembership.id}/suspend`,
    );
    expect(selfSuspend.status).toBe(409);
    expect(selfSuspend.body.error.code).toBe('CANNOT_MODIFY_SELF');

    const adminSuspend = await ownerClient.post(
      `/api/workspaces/${workspace.id}/members/${adminMembership.id}/suspend`,
    );
    expect(adminSuspend.status).toBe(200);
  });

  it('serializes concurrent owner suspensions and protects the last active owner', async () => {
    const ownerA = await createUser('owner-a', 'Amara', 'Okafor');
    const workspace = await createWorkspace(ownerA);
    const ownerB = await createUser('owner-b', 'Benedict', 'Cole');
    const memberA = await prisma.workspaceMember.findFirstOrThrow({
      where: { workspaceId: workspace.id, userId: ownerA.id },
    });
    const memberB = await addMember(workspace.id, ownerB, WorkspaceRole.Owner as DbRole);

    const results = await Promise.allSettled([
      suspendMember(
        workspace.id,
        memberB.id,
        { userId: ownerA.id, membershipId: memberA.id, role: WorkspaceRole.Owner },
        { actorId: ownerA.id },
      ),
      suspendMember(
        workspace.id,
        memberA.id,
        { userId: ownerB.id, membershipId: memberB.id, role: WorkspaceRole.Owner },
        { actorId: ownerB.id },
      ),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({
      statusCode: 409,
      code: 'LAST_OWNER_PROTECTED',
    });
    expect(
      await prisma.workspaceMember.count({
        where: {
          workspaceId: workspace.id,
          role: WorkspaceRole.Owner,
          status: MembershipStatus.Active,
        },
      }),
    ).toBe(1);
  });

  it('serializes concurrent owner removals and protects the last active owner', async () => {
    const ownerA = await createUser('owner-a', 'Amara', 'Okafor');
    const workspace = await createWorkspace(ownerA);
    const ownerB = await createUser('owner-b', 'Benedict', 'Cole');
    const memberA = await prisma.workspaceMember.findFirstOrThrow({
      where: { workspaceId: workspace.id, userId: ownerA.id },
    });
    const memberB = await addMember(workspace.id, ownerB, WorkspaceRole.Owner as DbRole);

    const results = await Promise.allSettled([
      removeMember(
        workspace.id,
        memberB.id,
        { userId: ownerA.id, membershipId: memberA.id, role: WorkspaceRole.Owner },
        { actorId: ownerA.id },
      ),
      removeMember(
        workspace.id,
        memberA.id,
        { userId: ownerB.id, membershipId: memberB.id, role: WorkspaceRole.Owner },
        { actorId: ownerB.id },
      ),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({
      statusCode: 409,
      code: 'LAST_OWNER_PROTECTED',
    });
    expect(
      await prisma.workspaceMember.count({
        where: {
          workspaceId: workspace.id,
          role: WorkspaceRole.Owner,
          status: MembershipStatus.Active,
        },
      }),
    ).toBe(1);
    expect(await auditFor(workspace.id, 'member.removed')).toHaveLength(1);
  });
});

describe('workspace invitations', () => {
  async function seedWorkspace() {
    const owner = await createUser('owner', 'Amara', 'Okafor');
    const workspace = await createWorkspace(owner);
    return { owner, workspace, ownerClient: await clientFor(owner) };
  }

  it('creates a hashed one-time invitation and never exposes the token in listings or audits', async () => {
    const { owner, workspace, ownerClient } = await seedWorkspace();

    const response = await ownerClient
      .post(`/api/workspaces/${workspace.id}/invitations`, {
        email: 'invitee@example.com',
        role: WorkspaceRole.Requester,
      })
      .expect(201);

    const result = response.body.data;
    expect(result).toMatchObject({
      delivery: 'development_link',
      invitation: {
        email: 'invitee@example.com',
        role: WorkspaceRole.Requester,
        status: InvitationStatus.Pending,
        invitedBy: {
          id: expect.any(String),
          firstName: 'Amara',
          lastName: 'Okafor',
        },
      },
    });
    expect(result.invitationUrl).toContain('/invitations/accept?token=');
    expect(result.invitationToken).toHaveLength(43);
    expect(JSON.stringify(response.body)).not.toContain('tokenHash');

    const stored = await prisma.workspaceInvitation.findUniqueOrThrow({
      where: { id: result.invitation.id },
    });

    expect(stored.tokenHash).toBe(hashInvitationToken(result.invitationToken));
    expect(stored.tokenHash).not.toBe(result.invitationToken);
    expect(stored.activeKey).toBe(`${workspace.id}:invitee@example.com`);
    expect(stored.invitedById).toBe(owner.id);

    const list = await ownerClient
      .get(`/api/workspaces/${workspace.id}/invitations?status=pending`)
      .expect(200);

    expect(list.body.data.items).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain(result.invitationToken);
    expect(JSON.stringify(list.body)).not.toContain(stored.tokenHash);

    const audits = await auditFor(workspace.id, 'invitation.created');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.actorId).toBe(owner.id);
    expect(JSON.stringify(audits)).not.toContain(result.invitationToken);
    expect(JSON.stringify(audits)).not.toContain(stored.tokenHash);
  });

  it('prevents duplicate active invitations and invitations for existing members', async () => {
    const { owner, workspace, ownerClient } = await seedWorkspace();

    await ownerClient
      .post(`/api/workspaces/${workspace.id}/invitations`, {
        email: 'invitee@example.com',
        role: WorkspaceRole.Requester,
      })
      .expect(201);

    const duplicate = await ownerClient.post(`/api/workspaces/${workspace.id}/invitations`, {
      email: 'INVITEE@example.com',
      role: WorkspaceRole.Viewer,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('INVITATION_EXISTS');

    const existingMember = await ownerClient.post(`/api/workspaces/${workspace.id}/invitations`, {
      email: owner.email,
      role: WorkspaceRole.Viewer,
    });
    expect(existingMember.status).toBe(409);
    expect(existingMember.body.error.code).toBe('ALREADY_MEMBER');

    const invalid = await ownerClient.post(`/api/workspaces/${workspace.id}/invitations`, {
      email: 'not-an-email',
      role: WorkspaceRole.Requester,
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates only one invitation under concurrent duplicate requests', async () => {
    const { workspace, ownerClient } = await seedWorkspace();

    const [first, second] = await Promise.all([
      ownerClient.post(`/api/workspaces/${workspace.id}/invitations`, {
        email: 'race@example.com',
        role: WorkspaceRole.Requester,
      }),
      ownerClient.post(`/api/workspaces/${workspace.id}/invitations`, {
        email: 'race@example.com',
        role: WorkspaceRole.Requester,
      }),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(
      await prisma.workspaceInvitation.count({
        where: { workspaceId: workspace.id, email: 'race@example.com' },
      }),
    ).toBe(1);
  });

  it('accepts an invitation only for the matching authenticated email and only once', async () => {
    const { workspace, ownerClient } = await seedWorkspace();
    const invitee = await createUser('invitee', 'Grace', 'Lee');
    const otherUser = await createUser('other', 'Owen', 'Park');

    const created = await ownerClient
      .post(`/api/workspaces/${workspace.id}/invitations`, {
        email: invitee.email,
        role: WorkspaceRole.Requester,
      })
      .expect(201);

    const token = created.body.data.invitationToken as string;
    const otherClient = await clientFor(otherUser);

    const mismatch = await otherClient.post('/api/invitations/accept', { token }).expect(403);
    expect(mismatch.body.error.code).toBe('INVITATION_EMAIL_MISMATCH');

    expect(
      await prisma.workspaceInvitation.findUniqueOrThrow({
        where: { id: created.body.data.invitation.id },
      }),
    ).toMatchObject({ status: InvitationStatus.Pending, activeKey: expect.any(String) });

    const inviteeClient = await clientFor(invitee);
    const accepted = await inviteeClient.post('/api/invitations/accept', { token }).expect(200);

    expect(accepted.body.data).toMatchObject({
      workspace: {
        id: workspace.id,
        role: WorkspaceRole.Requester,
        permissions: [...permissionsForRole(WorkspaceRole.Requester)],
      },
      membership: {
        role: WorkspaceRole.Requester,
        status: MembershipStatus.Active,
        isCurrentUser: true,
      },
    });
    expect(
      accepted.body.data.session.workspaces.some(
        (entry: { id: string }) => entry.id === workspace.id,
      ),
    ).toBe(true);

    const stored = await prisma.workspaceInvitation.findUniqueOrThrow({
      where: { id: created.body.data.invitation.id },
    });
    expect(stored).toMatchObject({
      status: InvitationStatus.Accepted,
      activeKey: null,
      acceptedById: invitee.id,
    });
    expect(stored.acceptedAt).not.toBeNull();

    const membership = await prisma.workspaceMember.findUniqueOrThrow({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: invitee.id,
        },
      },
    });
    expect(membership.role).toBe(WorkspaceRole.Requester);
    expect(membership.status).toBe(MembershipStatus.Active);

    const audits = await auditFor(workspace.id, 'invitation.accepted');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.actorId).toBe(invitee.id);

    const reuse = await inviteeClient.post('/api/invitations/accept', { token });
    expect(reuse.status).toBe(409);
    expect(reuse.body.error.code).toBe('INVITATION_ALREADY_USED');
  });

  it('rejects unknown, expired, revoked, and rotated invitation tokens', async () => {
    const { workspace, ownerClient } = await seedWorkspace();
    const invitee = await createUser('invitee', 'Grace', 'Lee');
    const inviteeClient = await clientFor(invitee);

    const unknown = await inviteeClient
      .post('/api/invitations/accept', { token: 'unknown-token-value-that-is-long-enough' })
      .expect(404);
    expect(unknown.body.error.code).toBe('INVITATION_NOT_FOUND');

    const created = await ownerClient
      .post(`/api/workspaces/${workspace.id}/invitations`, {
        email: invitee.email,
        role: WorkspaceRole.Requester,
      })
      .expect(201);

    const invitationId = created.body.data.invitation.id as string;
    const token = created.body.data.invitationToken as string;

    await prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const expired = await inviteeClient.post('/api/invitations/accept', { token });
    expect(expired.status).toBe(410);
    expect(expired.body.error.code).toBe('INVITATION_EXPIRED');

    const stored = await prisma.workspaceInvitation.findUniqueOrThrow({
      where: { id: invitationId },
    });
    expect(stored.status).toBe(InvitationStatus.Expired);
    expect(stored.activeKey).toBeNull();

    const expirationAudits = await auditFor(workspace.id, 'invitation.expired');
    expect(expirationAudits).toHaveLength(1);
    expect(expirationAudits[0]?.actorId).toBeNull();

    const replacement = await ownerClient
      .post(`/api/workspaces/${workspace.id}/invitations`, {
        email: invitee.email,
        role: WorkspaceRole.Requester,
      })
      .expect(201);

    const replacementId = replacement.body.data.invitation.id as string;
    const replacementToken = replacement.body.data.invitationToken as string;

    const revoked = await ownerClient
      .post(`/api/workspaces/${workspace.id}/invitations/${replacementId}/revoke`)
      .expect(200);
    expect(revoked.body.data.status).toBe(InvitationStatus.Revoked);

    const revokedAccept = await inviteeClient.post('/api/invitations/accept', {
      token: replacementToken,
    });
    expect(revokedAccept.status).toBe(410);
    expect(revokedAccept.body.error.code).toBe('INVITATION_REVOKED');

    const revokeAudits = await auditFor(workspace.id, 'invitation.revoked');
    expect(revokeAudits).toHaveLength(1);

    const third = await ownerClient
      .post(`/api/workspaces/${workspace.id}/invitations`, {
        email: invitee.email,
        role: WorkspaceRole.Requester,
      })
      .expect(201);

    const rotated = await ownerClient
      .post(`/api/workspaces/${workspace.id}/invitations/${third.body.data.invitation.id}/link`)
      .expect(200);

    expect(rotated.body.data.invitationToken).not.toBe(third.body.data.invitationToken);

    const oldLink = await inviteeClient.post('/api/invitations/accept', {
      token: third.body.data.invitationToken,
    });
    expect(oldLink.status).toBe(404);
    expect(oldLink.body.error.code).toBe('INVITATION_NOT_FOUND');

    const newLink = await inviteeClient
      .post('/api/invitations/accept', { token: rotated.body.data.invitationToken })
      .expect(200);
    expect(newLink.body.data.membership.role).toBe(WorkspaceRole.Requester);

    const linkAudits = await auditFor(workspace.id, 'invitation.link_regenerated');
    expect(linkAudits).toHaveLength(1);
  });
});
