# ProcureFlow

ProcureFlow is a premium procurement workspace for modern teams. Phase 2 builds on the Phase 1
interface with a PostgreSQL data architecture, Prisma persistence, and secure cookie-based
authentication.

The dashboard, design system, and navigation are preserved. New in this phase: self-service
registration, sign-in and sign-out, persistent sessions, workspace membership, and the full
procurement database model that Phase 3 workflows will build on.

## Phase 2 scope

- PostgreSQL 17 schema managed with Prisma 6, including users, workspaces, memberships, vendors,
  purchase requests and items, approvals and steps, quotations and items, purchase orders and
  items, deliveries, and append-only audit logs.
- Workspace-scoped records with foreign keys, unique constraints, indexes, and explicit cascade,
  restrict, and set-null deletion behaviour.
- Fixed-precision `Decimal` money and quantity fields; no floating-point currency storage.
- Cookie-based authentication: register, login, logout, and `GET /api/auth/me`.
- bcrypt password hashing (cost 12), HS256 JWTs signed with `jose`, and an `HttpOnly`,
  `SameSite=Lax` session cookie that is `Secure` in production.
- Zod request validation with consistent error envelopes, credentialed CORS, and rate limiting on
  register and login.
- React authentication state, protected and public-only routes, session restore on refresh,
  validation feedback, loading states, and profile-menu sign-out.
- Integration tests against a dedicated PostgreSQL test database with real migrations.
- A realistic seed workspace covering the request-to-delivery lifecycle.

Not included in Phase 2: role-based authorization and procurement workflow execution. The schema
stores workspace roles and workflow-ready approval steps, but Phase 2 does not enforce them.

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
│   │   │   ├── schema.prisma   # Phase 2 data model
│   │   │   ├── migrations/     # Versioned SQL migrations
│   │   │   └── seed.ts         # Development dataset
│   │   ├── prisma.config.ts    # Prisma CLI configuration
│   │   └── src/
│   │       ├── config/         # Typed environment configuration
│   │       ├── controllers/    # HTTP layer
│   │       ├── errors/         # Operational error type
│   │       ├── lib/            # Prisma, password, JWT, cookie helpers
│   │       ├── middleware/     # Auth, validation, rate limit, errors
│   │       ├── routes/         # Auth and health routers
│   │       ├── services/       # Registration and login transactions
│   │       ├── test/           # Test DB setup and factories
│   │       ├── validators/     # Zod auth schemas
│   │       ├── app.ts          # Express app factory
│   │       └── index.ts        # Server bootstrap
│   └── web/                    # React workspace
│       └── src/
│           ├── auth/           # AuthProvider, protected routes, loader
│           ├── components/
│           │   ├── auth/       # Auth layout, fields, banners
│           │   ├── dashboard/  # KPIs, analytics, timeline, tables
│           │   ├── layout/     # Shell, sidebar, header, search
│           │   └── ui/         # Design-system primitives
│           ├── data/           # Typed demo data and navigation
│           ├── hooks/
│           ├── lib/            # API client, validation, formatting
│           ├── pages/          # Dashboard, login, register, modules
│           └── test/
├── packages/
│   └── shared/                 # Shared API, auth, and procurement contracts
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
| `APP_VERSION`                    | `0.2.0`                 | Version returned by the health check  |
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
| `VITE_API_PROXY_TARGET`          | `http://localhost:4000` | Optional Vite proxy target            |

`COOKIE_SAME_SITE=none` requires `COOKIE_SECURE=true`.

### Migrate and seed

```bash
npm run db:migrate
npm run db:seed
```

For an existing environment, apply committed migrations without creating new ones:

```bash
npm run db:deploy
```

The seed resets the `Northwind Industrial` workspace and upserts five development users. Every
seeded account uses the development-only password `ProcureFlow!2026`.

| User                               | Role     |
| ---------------------------------- | -------- |
| `amara.okafor@northwind.example`   | Owner    |
| `daniel.reyes@northwind.example`   | Admin    |
| `priya.nair@northwind.example`     | Approver |
| `marcus.chen@northwind.example`    | Buyer    |
| `sofia.lindberg@northwind.example` | Viewer   |

The seeded workspace contains 7 vendors, 7 purchase requests, 8 quotations, 3 purchase orders,
4 deliveries, and 20 audit entries.

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
  "version": "0.2.0",
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

## Database model

| Model                 | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `User`                | Account identity and bcrypt password hash                      |
| `Workspace`           | Tenant boundary and base currency                              |
| `WorkspaceMember`     | User-to-workspace role (owner, admin, approver, buyer, viewer) |
| `Vendor`              | Supplier master data scoped to a workspace                     |
| `PurchaseRequest`     | Request header with status, priority, category, and totals     |
| `PurchaseRequestItem` | Request line items with quantity, unit, and money              |
| `Approval`            | Workflow container linked one-to-one with a request            |
| `ApprovalStep`        | Ordered approver steps with decision notes                     |
| `Quotation`           | Vendor quote for a request                                     |
| `QuotationItem`       | Quote lines linked to request items                            |
| `PurchaseOrder`       | Issued order with vendor, optional quote, and totals           |
| `PurchaseOrderItem`   | Order lines with received quantity                             |
| `Delivery`            | Shipment against a purchase order                              |
| `AuditLog`            | Append-only workspace activity record                          |

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
- Frontend redirects, login and registration flows, validation feedback, API errors, and sign-out.

## Security notes

- `.env` is ignored; only placeholder values live in `.env.example`.
- Passwords are never returned by the API and are stored only as bcrypt hashes.
- Unknown-email logins still perform a bcrypt comparison to reduce timing differences.
- CORS allows only configured origins and sends credentials.
- Login and registration are rate limited per IP.
- Unexpected errors return a generic `500` envelope without stacks or internal messages.
- Audit logs have no update path and are intended to remain append-only.

## Phase boundaries

Phase 2 delivers persistence and authentication. Role checks, approval decisions, request and
order mutations, vendor management, and the other procurement workflows remain Phase 3 work. The
module pages continue to present polished placeholders so navigation stays complete without
pretending those workflows are implemented.

## License

Private project. All rights reserved.
