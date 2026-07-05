# Workspace Guide

## Answer and Code Changes Guidelines

### No useless historic user-facing strings

When user asks to create or add new feature in code, do not mention "before and after", "this replaces the previous version", "this is the new code", or any other phrasing that implies a change from a previous state when you are adding new code.

In code, do not explain underlying logic, implementation details, or design decisions. However, if the feature is complex, provide a brief overview of what might happen

Examples:

```html
<!-- BAD -->
<div>
  <h1>New Feature</h1>
  <p>This is the new feature that does X, Y, and Z.</p>
  <p>It replaces the old feature that only did A and B.</p>
  <!-- actually useful things -->
</div>

<!-- GOOD -->
<div>
  <h1>New Feature</h1>
  <!-- actually useful things -->
</div>
```


## What To Read First

- `AGENTS.md` for repo-wide conventions, workflow, and codebase standards
- `.agents/skills/*/SKILL.md` for task-specific implementation guidance

## Core Conventions

- Work from the repository root. Prefer root-level `pnpm run ...` commands instead of running package scripts in isolation.
- Keep changes aligned with the existing feature-based layout and reuse established patterns before inventing new ones.
- Use shared contracts and generated helpers instead of duplicating types, keys, or API shapes.
- Prefer ASCII in new or edited text unless a file already uses another encoding or character set.
- Avoid generating large summary docs unless the user explicitly asks for them.
- Before starting implementation, load the most relevant skills from `.agents/skills/`.
- No backwards compatibility debt. Koneko has a full rewrite opportunity. Avoid legacy cruft and old assumptions. If some concept evolves, it should prefer new ways of doing things, not trying to support old workflows.

## Project Standards

- DO NOT create `index.ts` files in ANY folder. Always use explicit file names for exports and imports, even if it means longer import paths. This is to avoid circular dependencies and improve clarity.
- DO NOT use `index.ts` files as barrel re-exports. Importing through an `index.ts` barrel is forbidden — always import directly from the source file.
  ```typescript
  // BAD
  import { someUtil } from './utils'; // resolves to utils/index.ts barrel
  import { SomeClass } from '../features/auth'; // resolves to auth/index.ts barrel

  // GOOD
  import { someUtil } from './utils/some-util';
  import { SomeClass } from '../features/auth/some-class';
  ```
- DO NOT re-export variables, functions, types, or constants from one module through another. If a value is needed in multiple places, import it directly from where it is defined.
  ```typescript
  // BAD — re-exporting from another module
  export { someValue } from './some-other-file';
  export * from './another-module';

  // GOOD — define it here or import it directly at the call site
  export const someValue = ...;
  ```
- Do not generate a reference guide, comprehensive summary document, or new docs markdown files unless the user explicitly asks for them.
- Follow standard TypeScript conventions with strict typing, `async/await`, and modular design.
- Avoid TypeScript `enum`; prefer `z.enum(...)` for shared value sets and derive exported types from the schema.
  ```typescript
  import z from "zod";

  export const userRolesSchema = z.enum(["ADMIN", "USER", "GUEST"]);
  export const USER_ROLES = userRolesSchema.enum;
  export type UserRole = z.infer<typeof userRolesSchema>;
  ```
- Use kebab-case for filenames.
- If a string literal represents a reusable closed set of values, extract it into a shared enum-like schema instead of hardcoding the string in multiple places. IF YOU ENCOUNTER STRING LITERALS WITHOUT ENUM, extract them into a shared enum. ALWAYS consider if a value should be an enum instead of a string literal, especially if it's used in multiple places or has a specific set of valid values.
- When resolving warnings or errors, fix the root cause instead of relying on `// @ts-ignore` or `as unknown as ...` unless there is no better option and the code explains why.
- All boolean values have to have `is`, `should`, `will`, `has`, or `does` prefixes. For example, `isActive`, `shouldShow`, `hasPermission`, or `doesSupportStreaming`. All interfaces must have `i` prefix. For example, `iUser`, `iProduct`, or `iOrder`.
- When referencing values with an existing enum or schema-backed constant, always use that exported value instead of hardcoded strings.
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
- Use `satisfies` clauses to validate object shapes without losing type inference.
  ```typescript
  const EXAMPLE_MAP = {
    keyOne: { label: "One", value: 1 },
    keyTwo: { label: "Two", value: 2 },
  } satisfies Record<string, { label: string; value: number }>;
  ```
- Use conventional commit messages.

## Testing 

Tests should validate meaningful behavior and not just implementation details. Use Vitest for unit and integration tests, and Playwright for end-to-end tests. Tests should be organized by feature and mirror the structure of the codebase.

DO NOT EVER TEST:
1. Migrations or schema definitions. These are validated by Drizzle and the database itself.
2. Generated code. These are validated by the generator and the source schema or contract.
3. Components rendering without meaningful behavior. Example: writing a test that inputs some text into a component and validating that the text is rendered is not meaningful behavior. Instead, test that the component behaves correctly when the text is inputted.
4. Third-party libraries. These are validated by the library itself and should not be tested in your codebase.

Prefer to use Dependency Injection (DI) for services and repositories to facilitate testing. Use mocks or fakes for external dependencies, and avoid testing implementation details of those dependencies.

Do not duplicate code blocks and prefer to extract shared code into utility functions or shared modules. If you are referencing some type or constant from codebase, THEN IMPORT IT, DO NOT DUPLICATE TYPES OR CONSTANTS. If you are referencing some type or constant from codebase, THEN IMPORT IT, DO NOT DUPLICATE TYPES OR CONSTANTS.

## Commands

- `pnpm run dev` boots the local stack.
- `pnpm run build` builds the monorepo.
- `pnpm run check-types` runs TypeScript checks across the workspace.
- `pnpm run lint` runs ESLint across the workspace.
- `pnpm run prettify` formats the workspace.
- `pnpm run test` runs the test suite across the workspace.
- `pnpm install` installs dependencies across the workspace.

## Workflow

- Keep work small and incremental.
- Prefer existing skills and instruction files before introducing new patterns.
- If a task spans backend and frontend, coordinate the contract first and then implement the UI against that contract.
- Run the relevant checks before handing work off. If you are changing code, ALWAYS run `pnpm run check-types` and `pnpm run lint` to catch issues early.
- If you are implementing a roadmap, then always make sure to mark the relevant roadmap items as "completed".
