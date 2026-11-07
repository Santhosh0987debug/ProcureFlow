# ProcureFlow

ProcureFlow is a premium procurement workspace for modern teams. Phase 1 establishes a
production-shaped TypeScript monorepo, a refined enterprise interface, and the API foundation
for the procurement workflows that follow.

The dashboard is fully interactive with realistic demo data. Business workflows, authentication,
and persistence are intentionally out of scope for this phase.

## Phase 1 scope

- TypeScript monorepo powered by npm workspaces.
- React + Vite + Tailwind CSS web workspace with a custom ProcureFlow design system.
- Express API foundation with typed environment configuration, modular routes, and centralized
  error handling.
- Shared procurement contracts and status enums in `@procureflow/shared`.
- Responsive dashboard, collapsible navigation, workspace search, notifications, profile menu,
  loading skeletons, empty states, status badges, and interactive spend analytics.
- Vitest coverage for the API foundation and the primary web navigation surfaces.
- ESLint, Prettier, strict TypeScript, and production builds.

Not included in Phase 1: authentication, database models, approval or purchasing workflows.

## Stack

| Layer     | Technology                                   |
| --------- | -------------------------------------------- |
| Web       | React 19, Vite 7, TypeScript, Tailwind CSS 4 |
| Routing   | React Router 7                               |
| Icons     | Lucide                                       |
| API       | Node.js, Express 5, TypeScript               |
| Contracts | TypeScript package (`packages/shared`)       |
| Testing   | Vitest, Testing Library, Supertest           |
| Tooling   | npm workspaces, ESLint, Prettier             |

## Design system

The ProcureFlow identity is deliberately warm, restrained, and editorial:

| Token      | Value     | Usage                                    |
| ---------- | --------- | ---------------------------------------- |
| Warm Ivory | `#F7F5F0` | Workspace background                     |
| Espresso   | `#382C27` | Sidebar, primary text, primary actions   |
| Taupe      | `#A99B8D` | Secondary labels, borders, chart accents |
| Soft Beige | `#E6E0D8` | Surfaces, dividers, quiet chart bars     |
| White      | `#FFFFFF` | Content cards                            |

Inter is bundled locally through Fontsource, so the interface does not depend on a font CDN.
No blue or green theme, gradients, or ornamental dashboard patterns are used.

## Project structure

```text
ProcureFlow/
├── apps/
│   ├── server/                 # Express API
│   │   ├── src/
│   │   │   ├── config/         # Typed environment configuration
│   │   │   ├── controllers/    # HTTP layer
│   │   │   ├── errors/         # Operational error type
│   │   │   ├── middleware/     # 404 + centralized error handling
│   │   │   ├── routes/         # Modular API router
│   │   │   ├── services/       # Business/service layer
│   │   │   ├── app.ts          # Express app factory
│   │   │   └── index.ts        # Server bootstrap
│   │   └── src/__tests__/
│   └── web/                    # React workspace
│       └── src/
│           ├── components/
│           │   ├── dashboard/  # KPIs, analytics, timeline, tables
│           │   ├── layout/     # Shell, sidebar, header, search
│           │   └── ui/         # Design-system primitives
│           ├── data/           # Typed mock data and navigation
│           ├── hooks/
│           ├── lib/
│           ├── pages/
│           └── test/
├── packages/
│   └── shared/                 # Shared API + procurement contracts
├── .env.example
├── eslint.config.js
├── tsconfig.base.json
└── package.json
```

## Getting started

### Prerequisites

- Node.js 22.12 or newer (Node 24 recommended)
- npm 10 or newer

### Install

```bash
npm install
```

### Environment

Copy the example file and adjust values if needed:

```bash
cp .env.example .env
```

The server reads the root `.env` file from source and compiled execution. Real process
environment variables always take precedence. The web app proxies `/api` to the API server.

| Variable                | Default                 | Purpose                          |
| ----------------------- | ----------------------- | -------------------------------- |
| `NODE_ENV`              | `development`           | Runtime environment              |
| `PORT`                  | `4000`                  | API port                         |
| `CORS_ORIGIN`           | `http://localhost:5173` | Comma-separated allowed origins  |
| `APP_VERSION`           | `0.1.0`                 | Version returned by health check |
| `VITE_API_PROXY_TARGET` | `http://localhost:4000` | Optional Vite proxy target       |

### Develop

```bash
npm run dev
```

This builds the shared contracts package once, then starts:

- API: <http://localhost:4000>
- Web: <http://localhost:5173>

### Verify the API

```bash
curl http://localhost:4000/api/health
```

```json
{
  "status": "ok",
  "service": "procureflow-api",
  "version": "0.1.0",
  "environment": "development",
  "uptimeSeconds": 12,
  "timestamp": "2026-11-07T09:00:00.000Z"
}
```

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
| `npm start`            | Start the compiled API                                   |

## API foundation

| Method | Endpoint      | Description                           |
| ------ | ------------- | ------------------------------------- |
| `GET`  | `/api/health` | Service, environment, version, uptime |

Errors use a consistent JSON envelope:

```json
{
  "error": {
    "code": "ROUTE_NOT_FOUND",
    "message": "Route GET /api/unknown was not found."
  }
}
```

## Phase boundaries

Phase 1 provides the workspace shell, design system, dashboard presentation, shared contracts,
and API foundation. Sidebar destinations outside the dashboard intentionally present polished
module placeholders that explain what arrives in Phase 2. This keeps navigation complete without
pretending workflows are implemented.

## License

Private project. All rights reserved.
