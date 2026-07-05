# Ultimate Starter

This starter is designed for me by me with all the shiny new things! (as of now)

To finish setup, run `Replace All` to replace `startername` with name of your project.
Also, make sure to customize `.github/instructions/copilot-instructions.md` with description of you project
so that agentic tools work efficiently.

## Project Overview

- **Contract-first development.** API endpoints start as shared `zod` schemas in `packages/shared`, ensuring server and client stay type-safe.
- **Real-time challenge lifecycle.** Hono-based routes expose public and authenticated procedures, backed by MongoDB via Typegoose models.
- **Typed React client.** The web app consumes the generated oRPC client, TanStack Router, and Query utilities for fully typed data interactions.
- **Developer-focused tooling.** Node.js 24, pnpm, moonrepo, and Husky hooks enable quick local feedback loops and consistent commits.

## Tech Stack

- **Runtime & Tooling:** Node.js 24, pnpm, moonrepo, Commitizen, Husky
- **Backend:** TypeScript, Hono, oRPC, Typegoose/Mongoose, Better Auth, Zod, Vitest
- **Frontend:** React 19, Vite, TanStack Stack/Query/Form, Tailwind CSS, Vitest
- **Shared Contracts:** `@startername/shared` with oRPC + OpenAPI generation

## Repository Structure

- `apps/server` – Node.js + Hono API, oRPC routers, Typegoose models, Better Auth setup
- `apps/web` – React 19 client, TanStack Router tree, authentication flows, Tailwind config
- `packages/shared` – Contract definitions, shared types, and schema exports
- `docs` – Product requirements, roadmap, risk registers, and supporting documentation
- `mongo` – Docker-managed MongoDB volume (keep uncommitted)
- `.moon/` – moonrepo configuration files
- `tsconfig*.json` – TypeScript project references

## Prerequisites

- Git ≥ 2.40
- Docker Desktop (required for the MongoDB container)
- Node.js **exactly** v24 (use nvm or similar)
- pnpm ≥ 10.0.0

### Install Node.js v24

Using nvm:
```bash
nvm install 24
nvm use 24
```

Or using the `.nvmrc` file in the repo:
```bash
nvm use
```

### Install pnpm

```bash
corepack enable
corepack prepare pnpm@10.0.0 --activate
```

Or via npm:
```bash
npm install -g pnpm@10
```

## Getting Started

```bash
git clone https://github.com/CatOfJupit3r/startername.git
cd startername
pnpm install
```

1. Copy environment templates: duplicate `.env.example` to `.env` in both `apps/server` and `apps/web`.
2. Start Docker Desktop so MongoDB can launch.
3. Boot everything with `pnpm run dev`:
    - Web client: `http://localhost:3030`
    - API + Better Auth: `http://localhost:5050`
    - MongoDB starts via `docker compose -f docker-compose.dev.yml up -d`

## Workspace Commands

- `pnpm run dev` – start API, web app, and MongoDB
- `pnpm run check-types` – TypeScript project references (server + shared)
- `pnpm run lint` – ESLint across the monorepo
- `pnpm run prettier` – formatting audit (no write)
- `pnpm run prepare` – reinstall Husky hooks if they go missing
- `pnpm test` – run all tests with Vitest

## Development Workflow

1. Create a GitHub issue describing the work.
2. Branch off `main` as `<issue-number>-<short-slug>` (e.g., `42-improve-login-flow`).
3. Stage changes and run `git cz` (or `pnpm commit`) for conventional commits.
4. Push the branch and open a PR targeting `main`; request review from `@CatOfJupit3r`.

## Pre-commit Hooks & Troubleshooting

- Husky runs `pnpm exec lint-staged` on commit to format, lint, and type-check staged files.
- Re-run failed checks locally with:
   ```bash
   pnpm exec lint-staged --no-stash
   ```
- Typical fixes:
   - Missing deps: `pnpm install`
   - Formatting issues: `pnpm run prettier` then re-stage
   - Lint errors: `pnpm run lint`
   - Type errors: `pnpm run check-types`

## Tips & Conventions

- Keep `pnpm run dev` active regularly to refresh seeded Mongo data.
- Avoid rebasing on `main`; prefer merging.
- Use the shared contract utilities (`tanstackRPC` helpers, shared schemas) instead of duplicating types or query keys.
- When extending the API, register new routes in `apps/server/src/routers/index.ts` and add error codes to `apps/server/src/enums/errors.ts`.
