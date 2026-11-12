# ProcureFlow

ProcureFlow is a premium procurement workspace for modern teams. Phase 4 adds complete purchase
request intake: draft creation with multiple line items, a paginated and filterable request list, a
detail workspace with activity history, draft editing and soft deletion, and explicit submission for
approval. All of it builds on the Phase 3 workspace-scoped RBAC and append-only audit trail.

The Phase 1 visual identity and every Phase 2 and Phase 3 authentication, RBAC, and team management
flow are preserved. Roles always come from the signed-in user's `WorkspaceMember` record, never from
a global user role.

## Phase 4 scope

- Purchase request creation with validated header fields and up to 50 line items. The API calculates
  every line total and the request total with Prisma `Decimal`; client-supplied totals are rejected.
- Paginated, searchable request listing with status, requester, category, priority, department, and
  date filters, plus workspace summary metrics.
- Request detail with requester identity, line items, fixed-point totals, timestamps, notes, and
  authorized activity history.
- Draft editing with transactional line-item replacement and total recalculation.
- Soft deletion of eligible drafts using `deletedAt` and `deletedById`; deleted requests disappear
  from normal reads while the append-only audit trail remains.
- Explicit submission that validates completeness, recomputes canonical totals, locks the request,
  and moves it to `pending_approval` for Phase 5. Submitted requests cannot be edited, deleted, or
  resubmitted.
- Workspace-scoped, human-readable request numbers (`PR-<year>-<sequence>`) generated under a
  workspace row lock so concurrent creations cannot collide.
- Ownership-aware authorization: requesters manage their own drafts, procurement managers and admins
  manage workspace requests according to permissions, approvers do not submit, and viewers remain
  read-only.
- Append-only audit events for request creation, updates, deletion, and submission with sanitized
  metadata and actor attribution.
- Complete web experience: request list, create/edit form with dynamic line items and live totals,
  detail page with actions and timeline, pagination, and loading, empty, and error states.
- Integration and UI tests covering validation, Decimal precision, numbering and concurrency,
  lifecycle rules, ownership, role permissions, cross-workspace isolation, audit, rollback, and
  duplicate submission.

Phase 3 foundation retained:

- Six workspace roles: `owner`, `admin`, `procurement_manager`, `requester`, `approver`, and
  `viewer`, with a centralized permission registry shared by the API and web app.
- Permission enforcement on every member, invitation, request, and workspace-permission endpoint,
  including workspace membership checks, resource scoping, and consistent `401`, `403`, and `404`
  responses.
- Member directory with pagination, search, role and status filters, member details, role changes,
  suspension, reactivation, and removal.
- One-time workspace invitations with cryptographically random tokens, SHA-256 token hashes at
  rest, expiration, revocation, acceptance, duplicate-invitation protection, and a development-only
  copy-link flow.
- Membership integrity: the last active owner is protected, admins cannot manage owners or peers,
  ownership changes are owner-only, self-management is rejected, and sensitive mutations serialize
  through a workspace row lock.
- Append-only audit events for invitation creation, acceptance, revocation, expiration, role
  changes, suspension, reactivation, removal, and invitation-link rotation.
- Settings → team management UI with a role/permission summary, member table, invite flow, pending
  invitations, confirmations, loading and error states, and permission-aware navigation.
- Integration and UI tests covering every role mapping, cross-workspace isolation, invitation
  lifecycle, escalation attempts, last-owner concurrency, suspension/removal, and audit creation.

Phase 2 foundation retained in this phase:

- PostgreSQL 17 schema managed with Prisma 6, including users, workspaces, memberships, vendors,
  purchase requests and items, approvals and steps, quotations and items, purchase orders and
  items, deliveries, and append-only audit logs.
- Cookie-based authentication: register, login, logout, and `GET /api/auth/me`, with bcrypt
  password hashing, HS256 JWTs, and an `HttpOnly`, `SameSite=Lax` session cookie.
- Zod request validation, consistent error envelopes, credentialed CORS, and rate limiting.
- React authentication state, protected and public-only routes, session restore, validation
  feedback, and sign-out.
- A realistic seed workspace covering the request-to-delivery lifecycle.

Not included in Phase 4: approval decisions, approver assignment and routing, vendor management,
sourcing, purchase-order operations, and delivery receiving. Those remain Phase 5 work; the module
pages continue to present polished placeholders. Submitted requests are ready for the Phase 5
approval workflow.

## Stack

| Layer      | Technology                                   |
| ---------- | -------------------------------------------- |
| Web        | React 19, Vite 7, TypeScript, Tailwind CSS 4 |
| Routing    | React Router 7                               |
| Icons      | Lucide                                       |
| API        | Node.js, Express 5, TypeScript               |
| Database   | PostgreSQL 17, Prisma 6                      |
| Auth       | bcryptjs, jose (HS256 JWT), cookie-parser    |
| Validation | Zod 4, express-rate-limit 8                  |
| Contracts  | TypeScript package (`packages/shared`)       |
| Testing    | Vitest, Testing Library, Supertest           |
| Tooling    | npm workspaces, ESLint, Prettier             |

## Design system

The ProcureFlow identity is deliberately warm, restrained, and editorial:

| Token      | Value     | Usage                                    |
| ---------- | --------- | ---------------------------------------- |
| Warm Ivory | `#F7F5F0` | Workspace background                     |
| Espresso   | `#382C27` | Sidebar, primary text, primary actions   |
| Taupe      | `#A99B8D` | Secondary labels, borders, chart accents |
| Soft Beige | `#E6E0D8` | Surfaces, dividers, quiet chart bars     |
| White      | `#FFFFFF` | Content cards                            |

Inter is bundled locally through Fontsource, so the interface does not depend on a font CDN. No
blue or green theme, gradients, or ornamental dashboard patterns are used.

## Project structure

```text
ProcureFlow/
├── apps/
│   ├── server/                 # Express API + Prisma
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Phase 4 data model
│   │   │   ├── migrations/     # Versioned SQL migrations
│   │   │   └── seed.ts         # Development dataset
│   │   ├── prisma.config.ts    # Prisma CLI configuration
│   │   └── src/
│   │       ├── config/         # Typed environment configuration
│   │       ├── controllers/    # HTTP layer, including request/member APIs
│   │       ├── errors/         # Operational error type
│   │       ├── lib/            # Prisma, password, JWT, audit, role helpers
│   │       ├── middleware/     # Auth, workspace authorization, validation
│   │       ├── routes/         # Auth, workspace, request, invitation, health routers
│   │       ├── services/       # Request, auth, member, and invitation transactions
│   │       ├── test/           # Test DB setup and factories
│   │       ├── validators/     # Zod auth, workspace, and request schemas
│   │       ├── app.ts          # Express app factory
│   │       └── index.ts        # Server bootstrap
│   └── web/                    # React workspace
│       └── src/
│           ├── auth/           # AuthProvider, route guards, permission gate
│           ├── components/
│           │   ├── auth/       # Auth layout, fields, banners
│           │   ├── dashboard/  # KPIs, analytics, timeline, tables
│           │   ├── layout/     # Shell, sidebar, header, search
│           │   ├── requests/   # Request form, badges, loading/error states
│           │   ├── settings/   # Team management dialogs and role summary
│           │   └── ui/         # Design-system primitives
│           ├── data/           # Typed demo data, options, permission-aware navigation
│           ├── hooks/
│           ├── lib/            # API clients, formatting, error mapping
│           ├── pages/          # Dashboard, purchase requests, auth, settings, modules
│           └── test/
├── packages/
│   └── shared/                 # API, auth, permission, member, procurement contracts
├── .env.example
├── eslint.config.js
├── tsconfig.base.json
└── package.json
```

## Getting started

### Prerequisites

- Node.js 22.12 or newer (Node 24 recommended)
- npm 10 or newer
- PostgreSQL 17 running locally (or any PostgreSQL 14+ instance)

### Install

```bash
npm install
```

The root `postinstall` script generates the Prisma client.

### Create the databases

Run these statements as a PostgreSQL superuser. The development role is intentionally separate
from the test role's target database, and `CREATEDB` is only needed for convenience.

```sql
CREATE ROLE procureflow WITH LOGIN PASSWORD 'procureflow_dev' CREATEDB;
CREATE DATABASE procureflow OWNER procureflow;
CREATE DATABASE procureflow_test OWNER procureflow;
```

On Windows, `psql` is typically at
`C:\Program Files\PostgreSQL\17\bin\psql.exe`. On macOS/Linux it is usually on `PATH`.

### Environment

```bash
cp .env.example .env
```

Then set a real password in both connection strings and generate a JWT secret:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

The server reads the root `.env` from source and compiled execution. Real process environment
variables always take precedence. The web app proxies `/api` to the API server.

| Variable                         | Default                 | Purpose                               |
| -------------------------------- | ----------------------- | ------------------------------------- |
| `NODE_ENV`                       | `development`           | Runtime environment                   |
| `PORT`                           | `4000`                  | API port                              |
| `CORS_ORIGIN`                    | `http://localhost:5173` | Comma-separated allowed origins       |
| `APP_VERSION`                    | `0.3.0`                 | Version returned by the health check  |
| `DATABASE_URL`                   | —                       | Development PostgreSQL connection     |
| `TEST_DATABASE_URL`              | —                       | Dedicated integration-test database   |
| `JWT_SECRET`                     | —                       | HS256 signing secret (32+ characters) |
| `JWT_ISSUER`                     | `procureflow-api`       | JWT issuer claim                      |
| `JWT_AUDIENCE`                   | `procureflow-web`       | JWT audience claim                    |
| `SESSION_TTL_HOURS`              | `168`                   | Session lifetime (7 days)             |
| `COOKIE_NAME`                    | `procureflow_session`   | Session cookie name                   |
| `COOKIE_SAME_SITE`               | `lax`                   | `lax`, `strict`, or `none`            |
| `COOKIE_SECURE`                  | production only         | Force the `Secure` cookie attribute   |
| `COOKIE_DOMAIN`                  | —                       | Optional cookie domain                |
| `BCRYPT_ROUNDS`                  | `12`                    | Password hashing cost (10–15)         |
| `AUTH_RATE_LIMIT_WINDOW_MINUTES` | `15`                    | Login/register rate-limit window      |
| `AUTH_RATE_LIMIT_MAX`            | `20`                    | Attempts per window per IP            |
| `TRUST_PROXY`                    | `0`                     | Express trust-proxy hops              |
| `INVITATION_DELIVERY`            | `link`                  | `link` (development) or `email`       |
| `INVITATION_TTL_HOURS`           | `72`                    | Invitation lifetime                   |
| `WEB_APP_URL`                    | `http://localhost:5173` | Base URL used to build invite links   |
| `VITE_API_PROXY_TARGET`          | `http://localhost:4000` | Optional Vite proxy target            |

`COOKIE_SAME_SITE=none` requires `COOKIE_SECURE=true`.

`INVITATION_DELIVERY=link` is a development-only flow: invitation creation and copy-link responses
include the raw one-time token so it can be shared manually. With `email`, raw tokens are omitted
from API responses; production email delivery must be implemented separately before using that mode.
Only token hashes are stored in either mode.

### Migrate and seed

```bash
npm run db:migrate
npm run db:seed
```

For an existing environment, apply committed migrations without creating new ones:

```bash
npm run db:deploy
```

The seed resets the `Northwind Industrial` workspace and upserts six development users. Every
seeded account uses the development-only password `ProcureFlow!2026`.

| User                               | Role                |
| ---------------------------------- | ------------------- |
| `amara.okafor@northwind.example`   | Owner               |
| `daniel.reyes@northwind.example`   | Admin               |
| `marcus.chen@northwind.example`    | Procurement manager |
| `priya.nair@northwind.example`     | Approver            |
| `nadia.hassan@northwind.example`   | Requester           |
| `sofia.lindberg@northwind.example` | Viewer              |

The seeded workspace contains 7 vendors, 7 purchase requests, 8 quotations, 3 purchase orders,
4 deliveries, and 20 audit entries. Use these accounts to exercise each role: the owner can manage
everyone, the admin cannot manage owners or peers, the requester can create requests but cannot
open approvals, and the viewer has read-only access.

### Develop

```bash
npm run dev
```

This builds the shared contracts package once, then starts:

- API: <http://localhost:4000>
- Web: <http://localhost:5173>

Open the web app, sign in with a seeded account, and the dashboard restores the session on refresh.

### Verify the API

```bash
curl http://localhost:4000/api/health
```

```json
{
  "status": "ok",
  "service": "procureflow-api",
  "version": "0.3.0",
  "environment": "development",
  "uptimeSeconds": 12,
  "timestamp": "2026-11-09T09:00:00.000Z"
}
```

## Authentication API

| Method | Endpoint             | Description                                         |
| ------ | -------------------- | --------------------------------------------------- |
| `POST` | `/api/auth/register` | Create a user, personal workspace, and session      |
| `POST` | `/api/auth/login`    | Verify credentials and set the session cookie       |
| `POST` | `/api/auth/logout`   | Clear the session cookie                            |
| `GET`  | `/api/auth/me`       | Return the signed-in user and workspace memberships |
| `GET`  | `/api/health`        | Service, environment, version, uptime               |

Successful auth responses use `{ "data": { "user": …, "workspaces": […] } }`. Registration also
creates an owner membership and an audit entry in a single transaction.

Errors use a consistent JSON envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "details": {
      "fieldErrors": {
        "email": ["Enter a valid email address."]
      }
    }
  }
}
```

The session cookie is `HttpOnly`, `SameSite=Lax`, scoped to `/`, and `Secure` in production. JWTs
are verified for signature, issuer, audience, and expiry on every protected request. Invalid or
expired tokens return `401` without exposing internal details.

## Roles and permissions

The canonical permission registry lives in `packages/shared/src/permissions.ts` and is consumed by
both the API policy layer and the web interface. A role is always read from the active
`WorkspaceMember`; it is never derived from a global user attribute.

| Role                  | Scope                                                                          |
| --------------------- | ------------------------------------------------------------------------------ |
| `owner`               | Full workspace control, including ownership and member administration          |
| `admin`               | Workspace settings and member administration, excluding ownership changes      |
| `procurement_manager` | Vendors, requests, quotations, purchase orders, deliveries, and reports        |
| `approver`            | Assigned approvals, approval decisions, and read access to procurement records |
| `requester`           | Creates and manages their own purchase requests                                |
| `viewer`              | Read-only access to permitted workspace information                            |

Management rules are conservative:

- Owners can manage every other member and are the only role that can assign ownership.
- Admins cannot manage owners or other admins, and cannot grant the owner or admin role.
- Self role changes, self suspension, and self removal return `409 CANNOT_MODIFY_SELF`.
- A workspace must always retain at least one active owner. Sensitive membership mutations take a
  PostgreSQL `FOR UPDATE` lock on the workspace row so concurrent owner changes cannot race past the
  last-owner check.

## Workspace and invitation API

| Method   | Endpoint                                                    | Permission            |
| -------- | ----------------------------------------------------------- | --------------------- |
| `GET`    | `/api/workspaces/:workspaceId/members`                      | `members:read`        |
| `GET`    | `/api/workspaces/:workspaceId/members/:memberId`            | `members:read`        |
| `PATCH`  | `/api/workspaces/:workspaceId/members/:memberId/role`       | `members:role_change` |
| `POST`   | `/api/workspaces/:workspaceId/members/:memberId/suspend`    | `members:suspend`     |
| `POST`   | `/api/workspaces/:workspaceId/members/:memberId/reactivate` | `members:suspend`     |
| `DELETE` | `/api/workspaces/:workspaceId/members/:memberId`            | `members:remove`      |
| `GET`    | `/api/workspaces/:workspaceId/permissions`                  | `workspace:read`      |
| `GET`    | `/api/workspaces/:workspaceId/invitations`                  | `members:read`        |
| `POST`   | `/api/workspaces/:workspaceId/invitations`                  | `members:invite`      |
| `POST`   | `/api/workspaces/:workspaceId/invitations/:id/revoke`       | `members:invite`      |
| `POST`   | `/api/workspaces/:workspaceId/invitations/:id/link`         | `members:invite`      |
| `POST`   | `/api/invitations/accept`                                   | Authenticated user    |

Member listing supports `page`, `pageSize`, `search`, `role`, and `status`. Invitation listing
supports `page`, `pageSize`, and `status`.

Authorization behaviour:

- Missing or invalid sessions return `401`.
- A valid session without the required workspace permission returns `403`.
- A workspace the user does not belong to returns `404 WORKSPACE_NOT_FOUND`; member and invitation
  IDs from another workspace return `404` without revealing that the record exists.
- Suspended memberships remain authenticated but receive `403 MEMBERSHIP_SUSPENDED` on workspace
  routes and are omitted from the `/api/auth/me` workspace list.

Invitation tokens are 32 random bytes encoded as base64url. Only the SHA-256 hash is stored. A
partial unique `activeKey` prevents more than one pending invitation per workspace and email.
Acceptance requires an authenticated account whose email matches the invitation. The API returns
`410` for expired or revoked invitations and `409` for invitations that were already accepted.
`INVITATION_DELIVERY=link` returns the one-time link once for development copy-link flows; copying
a pending invitation again rotates its token and invalidates the previous link.

Audit events are written in the same transaction as the change and cover `invitation.created`,
`invitation.accepted`, `invitation.revoked`, `invitation.expired`, `invitation.link_regenerated`,
`member.role_changed`, `member.suspended`, `member.reactivated`, and `member.removed`. Audit metadata
is redacted by key and never contains tokens, hashes, passwords, JWTs, or cookies.

## Purchase request API

| Method   | Endpoint                                                           | Permission                    |
| -------- | ------------------------------------------------------------------ | ----------------------------- |
| `GET`    | `/api/workspaces/:workspaceId/purchase-requests`                   | `requests:read` or `read_own` |
| `POST`   | `/api/workspaces/:workspaceId/purchase-requests`                   | `requests:create`             |
| `GET`    | `/api/workspaces/:workspaceId/purchase-requests/:requestId`        | `requests:read` or `read_own` |
| `PATCH`  | `/api/workspaces/:workspaceId/purchase-requests/:requestId`        | `requests:update`             |
| `DELETE` | `/api/workspaces/:workspaceId/purchase-requests/:requestId`        | `requests:delete`             |
| `POST`   | `/api/workspaces/:workspaceId/purchase-requests/:requestId/submit` | `requests:submit`             |

Request listing supports `page`, `pageSize`, `search`, `status`, `requesterId`, `category`,
`priority`, `department`, `from`, and `to`. The response includes the page plus workspace summary
metrics for total, draft, pending-approval, and approved requests.

Write payloads contain header fields and an `items` array. Monetary and quantity values cross the
API boundary as fixed-point strings; strict Zod schemas reject unknown fields, non-positive values,
more than two decimal places, and any client-supplied `totalAmount` or `lineTotal`. The server
recalculates every line total and the request total with Prisma `Decimal` inside the same transaction
that writes the request and its items.

Request numbers follow `PR-<UTC year>-<sequence>` and are unique within a workspace. Generation runs
inside a workspace row lock, so concurrent creations receive distinct sequential numbers. Draft
updates replace all line items atomically; a failed write rolls the whole change back.

Submission is explicit and draft-only. It validates required fields, at least one item, positive
quantities and prices, and a non-past required-by date; recomputes canonical totals; records
`submittedAt`; and moves the request to `pending_approval` for Phase 5. Repeat submission returns
`409 REQUEST_ALREADY_SUBMITTED`, while edits or deletes of a submitted request return
`409 REQUEST_NOT_DRAFT`. Deletion is a soft delete (`deletedAt`, `deletedById`), after which normal
reads return `404 REQUEST_NOT_FOUND`.

Requesters only see and manage their own records unless they also hold workspace-wide
`requests:read`. Procurement managers and admins manage workspace requests according to their
permissions; approvers have read access but cannot submit; viewers remain read-only. Every operation
is scoped by `workspaceId`, and requests from another workspace return `404` without revealing their
existence. Creation, updates, deletion, and submission write append-only audit events under the
`purchase_request.*` actions with actor, workspace, request reference, timestamp, and sanitized
metadata.

## Database model

| Model                 | Purpose                                                                          |
| --------------------- | -------------------------------------------------------------------------------- |
| `User`                | Account identity and bcrypt password hash                                        |
| `Workspace`           | Tenant boundary and base currency                                                |
| `WorkspaceMember`     | User-to-workspace role and active/suspended status                               |
| `WorkspaceInvitation` | One-time hashed invitation with expiry and lifecycle status                      |
| `Vendor`              | Supplier master data scoped to a workspace                                       |
| `PurchaseRequest`     | Request header with status, priority, category, notes, totals, and soft deletion |
| `PurchaseRequestItem` | Request line items with quantity, unit, money, category, and notes               |
| `Approval`            | Workflow container linked one-to-one with a request                              |
| `ApprovalStep`        | Ordered approver steps with decision notes                                       |
| `Quotation`           | Vendor quote for a request                                                       |
| `QuotationItem`       | Quote lines linked to request items                                              |
| `PurchaseOrder`       | Issued order with vendor, optional quote, and totals                             |
| `PurchaseOrderItem`   | Order lines with received quantity                                               |
| `Delivery`            | Shipment against a purchase order                                                |
| `AuditLog`            | Append-only workspace activity record                                            |

Money uses `Decimal(14,2)`; quantities use `Decimal(12,2)`. Tables and columns use snake_case
mappings, and all business records carry `workspaceId` indexes for tenant-scoped queries.

## Scripts

| Command                | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `npm run dev`          | Build shared contracts and start API + web in watch mode |
| `npm run build`        | Build shared, API, and web production artifacts          |
| `npm run test`         | Run API and web test suites                              |
| `npm run lint`         | Lint the monorepo with zero warnings allowed             |
| `npm run typecheck`    | Typecheck shared contracts, API, and web                 |
| `npm run format`       | Format the repository with Prettier                      |
| `npm run format:check` | Check formatting without writing                         |
| `npm run db:generate`  | Generate the Prisma client                               |
| `npm run db:validate`  | Validate the Prisma schema                               |
| `npm run db:migrate`   | Create and apply a development migration                 |
| `npm run db:deploy`    | Apply committed migrations                               |
| `npm run db:seed`      | Reset and seed the development workspace                 |
| `npm run db:studio`    | Open Prisma Studio                                       |
| `npm start`            | Start the compiled API                                   |

## Testing

Server integration tests use `TEST_DATABASE_URL` and apply every committed migration with
`prisma migrate deploy` before the suite runs. Each test truncates the domain tables, so the test
database must be separate from `DATABASE_URL`; the configuration refuses to start otherwise.

Coverage includes:

- Registration success, duplicate email handling, password hashing, workspace ownership, and audit
  creation.
- Login success, invalid credentials, last-login updates, logout, and session restoration.
- Protected access with missing, malformed, expired, and wrong-issuer JWTs.
- Field-level Zod validation.
- Request-to-delivery relationships, fixed-precision money, workspace-scoped uniqueness, cascade
  deletion, restrict deletion, and tenant isolation.
- Every role-to-permission mapping through `/api/auth/me` and `/api/workspaces/:id/permissions`.
- Unauthenticated `401`, unauthorized `403`, and cross-workspace `404` behaviour.
- Invitation creation, hashed storage, duplicate prevention, acceptance, email matching, expiry,
  revocation, reuse rejection, and link rotation.
- Role changes, self-management rejection, admin hierarchy limits, ownership assignment, and
  concurrent last-owner demotion/suspension.
- Suspension, reactivation, removal, suspended-session behaviour, and audit event contents.
- Member pagination, search, role/status filters, and validation errors.
- Purchase request creation, strict validation, Decimal totals, request-number sequencing under
  concurrency, list filters, detail and activity history, draft edits, soft deletion, submission,
  duplicate submission, submitted-request locks, rollback, ownership, role permissions,
  cross-workspace isolation, and audit metadata.
- Frontend request list, search/filter/pagination, create form with dynamic line items and live
  totals, edit, detail, submit/delete confirmations, viewer read-only mode, and error states.
- Frontend role-aware navigation, restricted routes, Settings team management, invitation
  acceptance, suspended access, API errors, and existing authentication flows.

## Security notes

- `.env` is ignored; only placeholder values live in `.env.example`.
- Passwords are never returned by the API and are stored only as bcrypt hashes.
- Unknown-email logins still perform a bcrypt comparison to reduce timing differences.
- CORS allows only configured origins and sends credentials.
- Login and registration are rate limited per IP.
- Workspace permissions are enforced by the API on every protected operation; hiding UI controls
  is only a usability layer.
- Invitation tokens are stored as SHA-256 hashes, omitted from listings, and never written to audit
  metadata. Copying a pending invitation rotates its token.
- Membership and invitation mutations run in transactions, and workspace row locks serialize
  last-owner checks under concurrent requests.
- Purchase request totals are always recomputed server-side with Prisma `Decimal`; strict schemas
  reject client-supplied totals, unknown fields, and imprecise values.
- Request reads and writes are scoped by workspace and ownership, and request-row locks guard
  edit, delete, and submit races. Request deletion is soft; its audit record remains append-only.
- Unexpected errors return a generic `500` envelope without stacks or internal messages.
- Audit logs have no update or delete API and remain append-only.

## Phase boundaries

Phase 4 delivers purchase request intake: creation, listing, detail, editing, soft deletion, and
submission with workspace-scoped authorization and audit logging. Approval decisions, approver
assignment and routing, vendor management, sourcing, purchase orders, and delivery receiving remain
Phase 5 work. Submitted requests are ready for the Phase 5 approval workflow; the other module pages
continue to present polished placeholders so navigation stays complete without pretending those
workflows are implemented.

## License

Private project. All rights reserved.
