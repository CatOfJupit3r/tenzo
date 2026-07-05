---
applyTo: '**/*.ts'
---

## Guidelines, Structure, and Purpose
- This file outlines the overall workspace structure, development guidelines, and key conventions for contributors to the monorepo
- The repo is a pnpm workspace (packageManager pinned at 10.0.0); `pnpm run dev` boots the TanStack Start web app in `apps/web`.
- Product code lives in `apps/web` and targets a standalone character card creator built with React 19, TanStack Start, TanStack Router/Query/Form, Tailwind, Jotai, and Zod.
- Quality gates run locally via `pnpm run check-types`, `pnpm run lint`, and `pnpm run prettify`; Husky hooks (installed by `pnpm run prepare`) enforce these before commits.
- Follow the workspace workflow: open an issue, branch as `<issue>-<slug>`, commit with `git cz` (or `pnpm commit`), and avoid rebases on main.
- Make sure to see `.github/skills/` for detailed guides on frontend patterns and workflow tasks that still apply to the web app.
- Avoid creating summarizatiion `.md` docs of your changes if not asked directly.

### Monorepo Layout Highlights
- `apps/web`: TanStack Start app bootstrapped in `src/main.tsx`, with routes, shared UI components, and feature folders.
- `docs`: Product requirements, risks, roadmap, and other high-level references.
- `inspo`: reference specs, example cards, and prior implementation material used by the roadmap.

### Code Style and Conventions
- Follow standard TypeScript conventions with strict typing, `async/await`, and modular design. Avoid using `enum`, prefer `as const` objects.
- Always name files with kebab-case, interfaces with `i` prefix.
- In 90% of cases use `z.enum` instead of plain `as const` objects to create enums. Example:
  ```typescript
  import z from "zod";

  export const userRolesSchema = z.enum(["ADMIN", "USER", "GUEST"]);
  export const USER_ROLES = userRolesSchema.enum;
  export type UserRole = z.infer<typeof userRolesSchema>;
  ```
- If a variable is reused across multiple web features, define it in `apps/web/src/constants` and import it from there instead of duplicating literals.
- When resolving warnings or errors, prefer addressing the root cause instead of using `// @ts-ignore` or `as unknown as <Type>`. Use these only as a last resort with a comment explaining why.
- If you encounter eslint warnings, run `pnpm run lint` to fix them in the file.
- When referencing values, that have enum, ALWAYS use the enum itself instead of hardcoding strings. Example:
  ```typescript
  // GOOD
  if (user.role === USER_ROLES.ADMIN) { ... }
  const SOME_OTHER_ENUM = {
    [VALUES.VALUE_ONE]: USER_ROLES.ADMIN,
    [VALUES.VALUE_TWO]: USER_ROLES.USER,
  }

  // BAD
  if (user.role === "ADMIN") { ... } // prone to typos and harder refactors
  const SOME_OTHER_ENUM = {
    VALUE_ONE: "ADMIN",
    VALUE_TWO: "USER",
  }
  ```
- Use `satisfies` clauses to ensure object shapes without losing type inference. Example:
  ```typescript
  const EXAMPLE_MAP = {
    keyOne: { label: "One", value: 1 },
    keyTwo: { label: "Two", value: 2 },
  } satisfies Record<string, { label: string; value: number }>;
  ```
- use conventional commit messages.

### Environment and Configuration
- Aliases: `@~/` resolves to `apps/web/src` inside the web package.
- Node.js v24 is required; use nvm or similar to manage Node versions.
- pnpm ≥10.0.0 is the package manager; use `corepack enable` to activate it.

### Structure and Patterns

The repository is organized around a feature-based frontend structure so character-creator code can stay local and easy to reason about.

#### Feature Layout

Primary product work lives under:
```
apps/web/src/features/character-creator/
```

Supporting shared UI and route shells live under:

```
apps/web/src/components/
apps/web/src/routes/
```

#### Tests

Mirror the feature structure:

```
apps/<workspace>/test/
  ├── features/<feature>/
  ├── integration/
  └── utils/
```

### Product Context

See `docs/roadmaps/active/character-card-creator.roadmap.md` for the current source of truth.
