# Character Card Creator

## Project Overview

- **Single-product repo.** The repository now centers on a standalone character card creator in `apps/web`.
- **Client-first architecture.** Character editing, persistence, import, and export live in the browser.
- **TanStack Start foundation.** React 19, TanStack Router/Query/Form, Tailwind CSS 4, and Jotai power the app shell.
- **Developer-focused tooling.** Node.js 24, pnpm workspaces, and Husky hooks keep local feedback loops fast.

## Tech Stack

- **Runtime & Tooling:** Node.js 24, pnpm, Commitizen, Husky
- **App:** React 19, Vite, TanStack Start, TanStack Router/Query/Form, Tailwind CSS, Jotai, Zod, Vitest

## Repository Structure

- `apps/web` – character card creator application
- `configs` – shared ESLint and Prettier config packages
- `docs` – Product requirements, roadmap, risk registers, and supporting documentation
- `inspo` – reference implementations, example cards, and spec material
- `tsconfig*.json` – TypeScript configuration

## Prerequisites

- Git ≥ 2.40
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
git clone https://github.com/CatOfJupit3r/tenzo.git
cd tenzo
pnpm install
```

1. Start the app with `pnpm run dev`.
2. Open `http://localhost:3030`.

## Workspace Commands

- `pnpm run dev` – start the web app
- `pnpm run build` – build the web app
- `pnpm run check-types` – run TypeScript checks
- `pnpm run lint` – ESLint across the monorepo
- `pnpm run prettify` – formatting audit (no write)
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
   - Formatting issues: `pnpm run prettify` then re-stage
   - Lint errors: `pnpm run lint`
   - Type errors: `pnpm run check-types`

## Tips & Conventions

- Avoid rebasing on `main`; prefer merging.
- Keep implementation work aligned with [docs/roadmaps/active/character-card-creator.roadmap.md](d:\Coding\tenzo\docs\roadmaps\active\character-card-creator.roadmap.md).
- Prefer feature-local types and utilities inside `apps/web/src/features/character-creator` as the roadmap phases land.
