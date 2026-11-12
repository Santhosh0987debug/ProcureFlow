import {
  Currency,
  InvitationStatus,
  MembershipStatus,
  Permission,
  Priority,
  ProcurementCategory,
  RequestStatus,
  WorkspaceRole,
  permissionsForRole,
} from '@procureflow/shared';
import type {
  AcceptInvitationResult,
  AuthSession,
  AuthWorkspace,
  CreateInvitationResult,
  CreatePurchaseRequestRequest,
  InvitationLinkResult,
  PaginatedResult,
  PurchaseRequestDetail,
  PurchaseRequestItemRecord,
  PurchaseRequestListResult,
  WorkspaceInvitationSummary,
  WorkspaceMemberSummary,
} from '@procureflow/shared';
import { vi } from 'vitest';

export const TEST_WORKSPACE_ID = '22222222-2222-4222-8222-222222222222';
export const TEST_USER_ID = '11111111-1111-4111-8111-111111111111';
export const TEST_INVITATION_TOKEN = 'test-invitation-token';

export function createTestSession(role: WorkspaceRole = WorkspaceRole.Owner): AuthSession {
  return {
    user: {
      id: TEST_USER_ID,
      email: 'amara.okafor@northwind.example',
      firstName: 'Amara',
      lastName: 'Okafor',
      jobTitle: 'Head of Procurement',
      avatarUrl: null,
      createdAt: '2025-09-15T09:00:00.000Z',
    },
    workspaces: [
      {
        id: TEST_WORKSPACE_ID,
        name: 'Northwind Industrial',
        slug: 'northwind-industrial',
        role,
        currency: Currency.USD,
        permissions: [...permissionsForRole(role)],
      },
    ],
  };
}

export const testSession: AuthSession = createTestSession();

export function createTestMembers(): WorkspaceMemberSummary[] {
  return [
    {
      id: 'member-owner',
      userId: TEST_USER_ID,
      firstName: 'Amara',
      lastName: 'Okafor',
      email: 'amara.okafor@northwind.example',
      jobTitle: 'Head of Procurement',
      role: WorkspaceRole.Owner,
      status: MembershipStatus.Active,
      joinedAt: '2025-09-15T09:00:00.000Z',
      suspendedAt: null,
      isCurrentUser: true,
    },
    {
      id: 'member-admin',
      userId: 'user-admin',
      firstName: 'Daniel',
      lastName: 'Reyes',
      email: 'daniel.reyes@northwind.example',
      jobTitle: 'Operations Director',
      role: WorkspaceRole.Admin,
      status: MembershipStatus.Active,
      joinedAt: '2025-10-02T10:00:00.000Z',
      suspendedAt: null,
      isCurrentUser: false,
    },
    {
      id: 'member-manager',
      userId: 'user-manager',
      firstName: 'Marcus',
      lastName: 'Chen',
      email: 'marcus.chen@northwind.example',
      jobTitle: 'Senior Category Manager',
      role: WorkspaceRole.ProcurementManager,
      status: MembershipStatus.Active,
      joinedAt: '2025-10-12T11:00:00.000Z',
      suspendedAt: null,
      isCurrentUser: false,
    },
    {
      id: 'member-approver',
      userId: 'user-approver',
      firstName: 'Priya',
      lastName: 'Nair',
      email: 'priya.nair@northwind.example',
      jobTitle: 'Finance Business Partner',
      role: WorkspaceRole.Approver,
      status: MembershipStatus.Active,
      joinedAt: '2025-11-01T09:30:00.000Z',
      suspendedAt: null,
      isCurrentUser: false,
    },
    {
      id: 'member-requester',
      userId: 'user-requester',
      firstName: 'Nadia',
      lastName: 'Hassan',
      email: 'nadia.hassan@northwind.example',
      jobTitle: 'Facilities Coordinator',
      role: WorkspaceRole.Requester,
      status: MembershipStatus.Active,
      joinedAt: '2025-11-05T08:15:00.000Z',
      suspendedAt: null,
      isCurrentUser: false,
    },
    {
      id: 'member-viewer',
      userId: 'user-viewer',
      firstName: 'Sofia',
      lastName: 'Lindberg',
      email: 'sofia.lindberg@northwind.example',
      jobTitle: 'Compliance Analyst',
      role: WorkspaceRole.Viewer,
      status: MembershipStatus.Active,
      joinedAt: '2025-11-08T14:20:00.000Z',
      suspendedAt: null,
      isCurrentUser: false,
    },
  ];
}

export function createTestInvitations(): WorkspaceInvitationSummary[] {
  return [
    {
      id: 'invitation-pending',
      email: 'grace.lee@northwind.example',
      role: WorkspaceRole.Viewer,
      status: InvitationStatus.Pending,
      invitedBy: {
        id: 'member-owner',
        firstName: 'Amara',
        lastName: 'Okafor',
      },
      expiresAt: '2026-11-16T12:00:00.000Z',
      acceptedAt: null,
      revokedAt: null,
      createdAt: '2026-11-09T12:00:00.000Z',
    },
  ];
}

export function createInvitationLink(
  invitation: WorkspaceInvitationSummary,
): CreateInvitationResult {
  return {
    invitation,
    delivery: 'development_link',
    invitationUrl: `http://localhost:5173/invitations/accept?token=${TEST_INVITATION_TOKEN}`,
    invitationToken: TEST_INVITATION_TOKEN,
  };
}

const testRequester = {
  id: 'user-requester',
  firstName: 'Nadia',
  lastName: 'Hassan',
  email: 'nadia.hassan@northwind.example',
  jobTitle: 'Facilities Coordinator',
};

function item(
  id: string,
  description: string,
  quantity: string,
  unitPrice: string,
  lineTotal: string,
  category: ProcurementCategory | null = null,
  notes: string | null = null,
): PurchaseRequestItemRecord {
  return {
    id,
    description,
    quantity,
    unit: 'unit',
    unitPrice,
    lineTotal,
    category,
    notes,
  };
}

export function createTestPurchaseRequests(): PurchaseRequestDetail[] {
  return [
    {
      id: 'request-draft-1',
      requestNumber: 'PR-2026-0001',
      title: 'Office equipment refresh',
      status: RequestStatus.Draft,
      priority: Priority.Medium,
      category: ProcurementCategory.Facilities,
      currency: Currency.USD,
      totalAmount: '70.17',
      department: 'Facilities',
      neededBy: '2026-12-01T00:00:00.000Z',
      requester: testRequester,
      itemCount: 2,
      createdAt: '2026-11-10T09:00:00.000Z',
      updatedAt: '2026-11-10T09:00:00.000Z',
      submittedAt: null,
      description: 'Replace end-of-life equipment for the operations floor.',
      notes: 'Deliver to the loading dock.',
      decidedAt: null,
      items: [
        item(
          'item-chair',
          'Ergonomic task chair',
          '3.50',
          '19.99',
          '69.97',
          ProcurementCategory.Facilities,
          'Black frame',
        ),
        item('item-desk', 'Height-adjustable desk', '2.00', '0.10', '0.20'),
      ],
      activity: [
        {
          id: 'activity-created-1',
          action: 'purchase_request.created',
          summary: 'Created draft PR-2026-0001.',
          actor: {
            id: testRequester.id,
            firstName: testRequester.firstName,
            lastName: testRequester.lastName,
          },
          occurredAt: '2026-11-10T09:00:00.000Z',
        },
      ],
      actions: { canEdit: true, canDelete: true, canSubmit: true },
    },
    {
      id: 'request-pending-1',
      requestNumber: 'PR-2026-0002',
      title: 'Annual safety supplies',
      status: RequestStatus.PendingApproval,
      priority: Priority.High,
      category: ProcurementCategory.Operations,
      currency: Currency.USD,
      totalAmount: '1234.50',
      department: 'Operations',
      neededBy: '2026-12-15T00:00:00.000Z',
      requester: testRequester,
      itemCount: 1,
      createdAt: '2026-11-09T11:00:00.000Z',
      updatedAt: '2026-11-09T12:00:00.000Z',
      submittedAt: '2026-11-09T12:00:00.000Z',
      description: 'Restock mandatory safety equipment for the warehouse team.',
      notes: null,
      decidedAt: null,
      items: [
        item(
          'item-gloves',
          'Safety gloves',
          '50.00',
          '24.69',
          '1234.50',
          ProcurementCategory.Operations,
        ),
      ],
      activity: [
        {
          id: 'activity-created-2',
          action: 'purchase_request.created',
          summary: 'Created draft PR-2026-0002.',
          actor: {
            id: testRequester.id,
            firstName: testRequester.firstName,
            lastName: testRequester.lastName,
          },
          occurredAt: '2026-11-09T11:00:00.000Z',
        },
        {
          id: 'activity-submitted-2',
          action: 'purchase_request.submitted',
          summary: 'Submitted PR-2026-0002 for approval.',
          actor: {
            id: testRequester.id,
            firstName: testRequester.firstName,
            lastName: testRequester.lastName,
          },
          occurredAt: '2026-11-09T12:00:00.000Z',
        },
      ],
      actions: { canEdit: false, canDelete: false, canSubmit: false },
    },
  ];
}

function summaryFor(requests: PurchaseRequestDetail[]): PurchaseRequestListResult['summary'] {
  const totalValue = requests.reduce((sum, request) => sum + Number(request.totalAmount), 0);

  return {
    total: requests.length,
    draft: requests.filter((request) => request.status === RequestStatus.Draft).length,
    pendingApproval: requests.filter((request) => request.status === RequestStatus.PendingApproval)
      .length,
    approved: requests.filter((request) => request.status === RequestStatus.Approved).length,
    totalValue: totalValue.toFixed(2),
  };
}

function toListSummary(request: PurchaseRequestDetail) {
  const {
    description: _description,
    notes: _notes,
    decidedAt: _decidedAt,
    items: _items,
    activity: _activity,
    actions: _actions,
    ...summary
  } = request;

  return summary;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function actionsFor(status: RequestStatus, permissions: readonly Permission[]) {
  const isDraft = status === RequestStatus.Draft;

  return {
    canEdit: isDraft && permissions.includes(Permission.RequestsUpdate),
    canDelete: isDraft && permissions.includes(Permission.RequestsDelete),
    canSubmit: isDraft && permissions.includes(Permission.RequestsSubmit),
  };
}

const healthResponse = {
  status: 'ok',
  service: 'procureflow-api',
  version: '0.3.0',
  environment: 'test',
  uptimeSeconds: 12,
  timestamp: new Date().toISOString(),
};

export function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  };
}

export function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return jsonResponse(
    {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    status,
  );
}

interface FetchMockOptions {
  authenticated?: boolean;
  session?: AuthSession;
  loginResponse?: { status: number; body: unknown };
  registerResponse?: { status: number; body: unknown };
  members?: WorkspaceMemberSummary[];
  invitations?: WorkspaceInvitationSummary[];
  membersResponse?: { status: number; body: unknown };
  invitationsResponse?: { status: number; body: unknown };
  invitationAcceptResponse?: { status: number; body: unknown };
  roleChangeResponse?: { status: number; body: unknown };
  purchaseRequests?: PurchaseRequestDetail[];
  purchaseRequestsResponse?: { status: number; body: unknown };
  purchaseRequestDetailResponse?: { status: number; body: unknown };
}

function parseUrl(input: RequestInfo | URL): URL {
  const raw =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  return new URL(raw, 'http://localhost');
}

function paginate<T>(items: T[], page: number, pageSize: number): PaginatedResult<T> {
  const total = items.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages,
  };
}

function updatedMember(
  member: WorkspaceMemberSummary,
  changes: Partial<WorkspaceMemberSummary>,
): WorkspaceMemberSummary {
  return { ...member, ...changes };
}

export function createFetchMock(options: FetchMockOptions = {}) {
  const { authenticated = true, session = testSession } = options;
  const members = [...(options.members ?? createTestMembers())];
  const invitations = [...(options.invitations ?? createTestInvitations())];
  const permissions = permissionsForRole(session.workspaces[0]?.role ?? WorkspaceRole.Viewer);
  const purchaseRequests = (options.purchaseRequests ?? createTestPurchaseRequests()).map(
    (request) => ({
      ...request,
      actions: actionsFor(request.status, permissions),
    }),
  );

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = parseUrl(input);
    const path = url.pathname;
    const method = (init?.method ?? 'GET').toUpperCase();

    if (path.endsWith('/api/health')) {
      return jsonResponse(healthResponse);
    }

    if (path.endsWith('/api/auth/me')) {
      return authenticated
        ? jsonResponse({ data: session })
        : errorResponse(
            401,
            'AUTH_REQUIRED',
            'Authentication is required to access this resource.',
          );
    }

    if (path.endsWith('/api/auth/login') && method === 'POST') {
      return options.loginResponse
        ? jsonResponse(options.loginResponse.body, options.loginResponse.status)
        : jsonResponse({ data: session });
    }

    if (path.endsWith('/api/auth/register') && method === 'POST') {
      return options.registerResponse
        ? jsonResponse(options.registerResponse.body, options.registerResponse.status)
        : jsonResponse({ data: session }, 201);
    }

    if (path.endsWith('/api/auth/logout') && method === 'POST') {
      return {
        ok: true,
        status: 204,
        headers: new Headers(),
        json: async () => null,
      };
    }

    if (path.endsWith('/api/invitations/accept') && method === 'POST') {
      if (options.invitationAcceptResponse) {
        return jsonResponse(
          options.invitationAcceptResponse.body,
          options.invitationAcceptResponse.status,
        );
      }

      const workspace = session.workspaces[0] as AuthWorkspace;
      const acceptedMembership = updatedMember(members[0] as WorkspaceMemberSummary, {
        role: WorkspaceRole.Requester,
      });
      const result: AcceptInvitationResult = {
        session,
        workspace,
        membership: acceptedMembership,
      };

      return jsonResponse({ data: result });
    }

    const purchaseRequestMatch = path.match(
      /^\/api\/workspaces\/([^/]+)\/purchase-requests(?:\/([^/]+))?(?:\/(submit))?$/,
    );

    if (purchaseRequestMatch) {
      const requestId = purchaseRequestMatch[2]
        ? decodeURIComponent(purchaseRequestMatch[2])
        : null;
      const isSubmit = purchaseRequestMatch[3] === 'submit';

      if (!requestId && method === 'GET') {
        if (options.purchaseRequestsResponse) {
          return jsonResponse(
            options.purchaseRequestsResponse.body,
            options.purchaseRequestsResponse.status,
          );
        }

        const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
        const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') ?? 20));
        const search = (url.searchParams.get('search') ?? '').toLowerCase();
        const status = url.searchParams.get('status');
        const category = url.searchParams.get('category');
        const priority = url.searchParams.get('priority');

        const filtered = purchaseRequests.filter((request) => {
          const haystack =
            `${request.requestNumber} ${request.title} ${request.department ?? ''}`.toLowerCase();

          return (
            (search === '' || haystack.includes(search)) &&
            (!status || request.status === status) &&
            (!category || request.category === category) &&
            (!priority || request.priority === priority)
          );
        });

        const result: PurchaseRequestListResult = {
          ...paginate(filtered.map(toListSummary), page, pageSize),
          summary: summaryFor(filtered),
        };

        return jsonResponse({ data: result });
      }

      if (!requestId && method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}')) as CreatePurchaseRequestRequest;
        const now = new Date().toISOString();
        const year = new Date().getUTCFullYear();
        const prefix = `PR-${year}-`;
        const highest = purchaseRequests.reduce((max, request) => {
          if (!request.requestNumber.startsWith(prefix)) {
            return max;
          }

          const value = Number.parseInt(request.requestNumber.slice(prefix.length), 10);
          return Number.isFinite(value) ? Math.max(max, value) : max;
        }, 0);
        const requestNumber = `${prefix}${String(highest + 1).padStart(4, '0')}`;
        const items: PurchaseRequestItemRecord[] = body.items.map((entry, index) => {
          const lineTotal = roundMoney(Number(entry.quantity) * Number(entry.unitPrice));

          return {
            id: `item-created-${index + 1}`,
            description: entry.description,
            quantity: Number(entry.quantity).toFixed(2),
            unit: entry.unit,
            unitPrice: Number(entry.unitPrice).toFixed(2),
            lineTotal: lineTotal.toFixed(2),
            category: entry.category ?? null,
            notes: entry.notes ?? null,
          };
        });
        const totalAmount = roundMoney(
          items.reduce((sum, entry) => sum + Number(entry.lineTotal), 0),
        ).toFixed(2);
        const created: PurchaseRequestDetail = {
          id: `request-created-${purchaseRequests.length + 1}`,
          requestNumber,
          title: body.title,
          status: RequestStatus.Draft,
          priority: body.priority,
          category: body.category,
          currency: body.currency,
          totalAmount,
          department: body.department ?? null,
          neededBy: body.neededBy ? `${body.neededBy.slice(0, 10)}T00:00:00.000Z` : null,
          requester: testRequester,
          itemCount: items.length,
          createdAt: now,
          updatedAt: now,
          submittedAt: null,
          description: body.description,
          notes: body.notes ?? null,
          decidedAt: null,
          items,
          activity: [
            {
              id: `activity-created-${purchaseRequests.length + 1}`,
              action: 'purchase_request.created',
              summary: `Created draft ${requestNumber}.`,
              actor: {
                id: testRequester.id,
                firstName: testRequester.firstName,
                lastName: testRequester.lastName,
              },
              occurredAt: now,
            },
          ],
          actions: actionsFor(RequestStatus.Draft, permissions),
        };

        purchaseRequests.unshift(created);
        return jsonResponse({ data: created }, 201);
      }

      if (requestId) {
        const index = purchaseRequests.findIndex((request) => request.id === requestId);

        if (index === -1) {
          return errorResponse(
            404,
            'REQUEST_NOT_FOUND',
            'Purchase request not found in this workspace.',
          );
        }

        const current = purchaseRequests[index] as PurchaseRequestDetail;

        if (isSubmit && method === 'POST') {
          if (current.status !== RequestStatus.Draft) {
            return errorResponse(
              409,
              'REQUEST_ALREADY_SUBMITTED',
              'This purchase request has already been submitted for approval.',
            );
          }

          const now = new Date().toISOString();
          const updated: PurchaseRequestDetail = {
            ...current,
            status: RequestStatus.PendingApproval,
            submittedAt: now,
            updatedAt: now,
            actions: actionsFor(RequestStatus.PendingApproval, permissions),
            activity: [
              ...current.activity,
              {
                id: `activity-submitted-${current.id}`,
                action: 'purchase_request.submitted',
                summary: `Submitted ${current.requestNumber} for approval.`,
                actor: {
                  id: testRequester.id,
                  firstName: testRequester.firstName,
                  lastName: testRequester.lastName,
                },
                occurredAt: now,
              },
            ],
          };

          purchaseRequests[index] = updated;
          return jsonResponse({ data: updated });
        }

        if (method === 'GET') {
          if (options.purchaseRequestDetailResponse) {
            return jsonResponse(
              options.purchaseRequestDetailResponse.body,
              options.purchaseRequestDetailResponse.status,
            );
          }

          return jsonResponse({ data: current });
        }

        if (method === 'PATCH') {
          if (current.status !== RequestStatus.Draft) {
            return errorResponse(
              409,
              'REQUEST_NOT_DRAFT',
              'Only draft purchase requests can be changed or submitted.',
            );
          }

          const body = JSON.parse(String(init?.body ?? '{}')) as CreatePurchaseRequestRequest;
          const now = new Date().toISOString();
          const items: PurchaseRequestItemRecord[] = body.items.map((entry, itemIndex) => {
            const lineTotal = roundMoney(Number(entry.quantity) * Number(entry.unitPrice));

            return {
              id: `item-updated-${itemIndex + 1}`,
              description: entry.description,
              quantity: Number(entry.quantity).toFixed(2),
              unit: entry.unit,
              unitPrice: Number(entry.unitPrice).toFixed(2),
              lineTotal: lineTotal.toFixed(2),
              category: entry.category ?? null,
              notes: entry.notes ?? null,
            };
          });
          const totalAmount = roundMoney(
            items.reduce((sum, entry) => sum + Number(entry.lineTotal), 0),
          ).toFixed(2);
          const updated: PurchaseRequestDetail = {
            ...current,
            title: body.title,
            description: body.description,
            department: body.department ?? null,
            category: body.category,
            priority: body.priority,
            currency: body.currency,
            neededBy: body.neededBy ? `${body.neededBy.slice(0, 10)}T00:00:00.000Z` : null,
            notes: body.notes ?? null,
            totalAmount,
            itemCount: items.length,
            items,
            updatedAt: now,
            actions: actionsFor(RequestStatus.Draft, permissions),
            activity: [
              ...current.activity,
              {
                id: `activity-updated-${current.id}`,
                action: 'purchase_request.updated',
                summary: `Updated draft ${current.requestNumber}.`,
                actor: {
                  id: testRequester.id,
                  firstName: testRequester.firstName,
                  lastName: testRequester.lastName,
                },
                occurredAt: now,
              },
            ],
          };

          purchaseRequests[index] = updated;
          return jsonResponse({ data: updated });
        }

        if (method === 'DELETE') {
          if (current.status !== RequestStatus.Draft) {
            return errorResponse(
              409,
              'REQUEST_NOT_DRAFT',
              'Only draft purchase requests can be changed or submitted.',
            );
          }

          purchaseRequests.splice(index, 1);
          return {
            ok: true,
            status: 204,
            headers: new Headers(),
            json: async () => null,
          };
        }
      }
    }

    const workspaceMatch = path.match(/^\/api\/workspaces\/([^/]+)\/(members|invitations)(\/.*)?$/);

    if (workspaceMatch) {
      const resource = workspaceMatch[2];
      const rest = workspaceMatch[3] ?? '';

      if (resource === 'members') {
        if (rest === '' && method === 'GET') {
          if (options.membersResponse) {
            return jsonResponse(options.membersResponse.body, options.membersResponse.status);
          }

          const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
          const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') ?? 10));
          const search = (url.searchParams.get('search') ?? '').toLowerCase();
          const role = url.searchParams.get('role');
          const status = url.searchParams.get('status');

          const filtered = members.filter((member) => {
            const haystack = `${member.firstName} ${member.lastName} ${member.email} ${
              member.jobTitle ?? ''
            }`.toLowerCase();

            return (
              (search === '' || haystack.includes(search)) &&
              (!role || member.role === role) &&
              (!status || member.status === status)
            );
          });

          return jsonResponse({ data: paginate(filtered, page, pageSize) });
        }

        const memberMatch = rest.match(/^\/([^/]+)(?:\/(role|suspend|reactivate))?$/);

        if (memberMatch) {
          const memberId = decodeURIComponent(memberMatch[1] as string);
          const action = memberMatch[2];
          const index = members.findIndex((member) => member.id === memberId);

          if (index === -1) {
            return errorResponse(404, 'MEMBER_NOT_FOUND', 'The member could not be found.');
          }

          const member = members[index] as WorkspaceMemberSummary;

          if (action === 'role' && method === 'PATCH') {
            if (options.roleChangeResponse) {
              return jsonResponse(
                options.roleChangeResponse.body,
                options.roleChangeResponse.status,
              );
            }

            const body = JSON.parse(String(init?.body ?? '{}')) as { role?: WorkspaceRole };
            const next = updatedMember(member, {
              role: body.role ?? member.role,
            });
            members[index] = next;
            return jsonResponse({ data: next });
          }

          if (action === 'suspend' && method === 'POST') {
            const next = updatedMember(member, {
              status: MembershipStatus.Suspended,
              suspendedAt: new Date().toISOString(),
            });
            members[index] = next;
            return jsonResponse({ data: next });
          }

          if (action === 'reactivate' && method === 'POST') {
            const next = updatedMember(member, {
              status: MembershipStatus.Active,
              suspendedAt: null,
            });
            members[index] = next;
            return jsonResponse({ data: next });
          }

          if (!action && method === 'DELETE') {
            members.splice(index, 1);
            return {
              ok: true,
              status: 204,
              headers: new Headers(),
              json: async () => null,
            };
          }
        }
      }

      if (resource === 'invitations') {
        if (rest === '' && method === 'GET') {
          if (options.invitationsResponse) {
            return jsonResponse(
              options.invitationsResponse.body,
              options.invitationsResponse.status,
            );
          }

          const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
          const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') ?? 10));
          const status = url.searchParams.get('status');
          const filtered = invitations.filter(
            (invitation) => !status || invitation.status === status,
          );

          return jsonResponse({ data: paginate(filtered, page, pageSize) });
        }

        if (rest === '' && method === 'POST') {
          const body = JSON.parse(String(init?.body ?? '{}')) as {
            email?: string;
            role?: WorkspaceRole;
          };
          const invitation: WorkspaceInvitationSummary = {
            id: `invitation-${invitations.length + 1}`,
            email: body.email ?? 'new.member@example.com',
            role: body.role ?? WorkspaceRole.Requester,
            status: InvitationStatus.Pending,
            invitedBy: {
              id: 'member-owner',
              firstName: 'Amara',
              lastName: 'Okafor',
            },
            expiresAt: '2026-11-16T12:00:00.000Z',
            acceptedAt: null,
            revokedAt: null,
            createdAt: new Date().toISOString(),
          };
          invitations.unshift(invitation);
          return jsonResponse({ data: createInvitationLink(invitation) }, 201);
        }

        const invitationMatch = rest.match(/^\/([^/]+)\/(revoke|link)$/);

        if (invitationMatch) {
          const invitationId = decodeURIComponent(invitationMatch[1] as string);
          const action = invitationMatch[2];
          const index = invitations.findIndex((invitation) => invitation.id === invitationId);

          if (index === -1) {
            return errorResponse(404, 'INVITATION_NOT_FOUND', 'The invitation could not be found.');
          }

          const invitation = invitations[index] as WorkspaceInvitationSummary;

          if (action === 'revoke' && method === 'POST') {
            const next: WorkspaceInvitationSummary = {
              ...invitation,
              status: InvitationStatus.Revoked,
              revokedAt: new Date().toISOString(),
            };
            invitations[index] = next;
            return jsonResponse({ data: next });
          }

          if (action === 'link' && method === 'POST') {
            const result: InvitationLinkResult = {
              invitation,
              invitationUrl: `http://localhost:5173/invitations/accept?token=${TEST_INVITATION_TOKEN}`,
              invitationToken: TEST_INVITATION_TOKEN,
              expiresAt: invitation.expiresAt,
            };
            return jsonResponse({ data: result });
          }
        }
      }
    }

    return errorResponse(404, 'NOT_FOUND', 'The requested resource was not found.');
  });
}

export const ALL_TEST_PERMISSIONS: readonly Permission[] = permissionsForRole(WorkspaceRole.Owner);
