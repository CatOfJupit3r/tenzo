---
title: "Anti-Slop Code and Test Cleanup"
slug: "anti-slop-cleanup"
status: "Active backlog"
roadmap_type: "cleanup"
priority: "P1"
created: "2026-08-18"
updated: "2026-08-18"
last_repo_audit: "2026-08-18"
source_of_truth: true
related_docs:
  - "AGENTS.md"
  - "standard.md"
  - "docs/roadmaps/active/local-observability.roadmap.md"
  - "https://github.com/dmmulroy/anti-slop"
  - "https://github.com/kucherenko/jscpd"
supersedes: []
superseded_by: null
archive_when:
  - "Low-value tests and module mocks are removed, and retained tests exercise meaningful behavior through stable seams."
  - "External and persisted unknown data is parsed at boundaries with Zod instead of ad hoc read helpers and reflective access."
  - "The selected anti-slop rules are enforced by Oxlint with repository-specific false positives resolved deliberately."
  - "Type checking, ESLint, Oxlint, the complete test suite, and the production build pass on the pinned Node version."
---

# Anti-Slop Code and Test Cleanup

> Status: Active backlog
> Last repo audit: 2026-08-18
> Current summary: The web app has 62 test files and substantial meaningful domain coverage, but it also has a placeholder test, tautological or historical assertions, 33 module mocks across 14 files, repeated hand-written unknown-value readers, and reflective parsing at I/O boundaries. The complete suite currently cannot collect tests in 22 files because application logging is eagerly initialized through a TanStack runtime boundary that is undefined in the audited Vitest environment.

## 1. Executive Summary

Remove low-evidence tests and replace brittle module-mocked tests with tests against real dependency seams, pure domain operations, or faithful in-memory implementations. Consolidate unknown-data handling at JSON, storage, provider, and framework boundaries using Zod schemas and use Lodash only for established collection/object operations where it is clearer than local helpers. Do not create a generic `readString` utility or another abstraction layer that merely centralizes the same weak parsing.

Add copy/paste detection for duplicated blocks across files and retain Oxlint for precise AST-level architectural rules. Duplicate-block detection and lint rules solve different problems: a token-based clone detector can find arbitrary repeated implementations across the repository, while a custom Oxlint rule can require one approved source for a known concern such as browser/runtime detection.

Vendor a repository-owned subset of [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) into Oxlint and enforce the rules that express this repository's standards. The upstream project explicitly intends its rules to be copied and changed rather than consumed as a fixed package. Adopt it selectively: rules such as `no-module-mocking`, `no-reflect-get`, and evidence-preserving assertion rules map directly to observed problems, while syntactic rules such as `no-runtime-typeof` and `no-shape-in-symbol-names` need repository-specific scoping or modification to avoid rejecting legitimate code.

This is a behavior-preserving cleanup except where obsolete compatibility behavior and its tests are deliberately removed. It is not a coverage-maximization exercise.

## 2. Problem / Opportunity

- **Low-signal tests:** `apps/web/test/some.test.ts` only asserts `true === true`. Other tests restate registry mappings, compare two runs produced by the same fixture and code path, or preserve historical absences and pre-feature storage shapes.
- **Mock-heavy architecture:** 33 `vi.mock(...)` calls occur across 14 files. The worst test replaces seven modules to exercise one hook. These tests are coupled to import topology and can pass while real composition is broken.
- **Broken baseline:** On the audited machine, a full Vitest run passed 40 files and 184 tests but failed to collect any tests in 22 files. A focused run fails identically. `loggerFactory` is undefined when modules eagerly call `loggerFactory.getLogger(...)` under Vitest. The machine used Node 26.5.0 while the repository requires Node 26.5.0 and CI currently installs 24.11.1, so runtime alignment must be fixed before classifying any remaining intermittent failures.
- **Repeated boundary parsing:** `readString` exists independently in generation settings, character-library hydration, and provider health. Those files also define local number, boolean, timestamp, record, and range readers.
- **Fabricated type evidence:** The source currently contains approximately 44 `Reflect.get` calls, two `Reflect.apply` calls, nine chained `as unknown as` assertions, 32 `Record<string, unknown>` occurrences, 22 `Promise<unknown>` occurrences, and 374 `typeof` tokens. These counts are search indicators, not automatic defect counts; several uses are legitimate callbacks, environment detection, or third-party component integration.
- **Sparse object boilerplate:** About 23 conditional object-spread sites build optional properties. Some can become direct typed properties or Zod transformations; others encode meaningful omission semantics and should not be replaced with a generic helper merely to satisfy a lint rule.
- **Unmeasured copy/paste duplication:** There is no repository-wide duplicate-block check comparable to JetBrains/PyCharm's duplicated-code inspection. Repeated helper names are visible, but structurally duplicated blocks with different names are not currently measured.
- **Duplicated runtime detection:** Six `typeof window` checks occur across five files. The repository already exports `isOnClient` from `utils/ssr-helpers.ts`, but storage, cropper, workspace layout, and portrait-cache code independently reimplement the same environment decision.
- **Enforcement gap:** ESLint is configured, but CI does not run tests and has no rule preventing new module mocks, reflective parsing, unsafe dictionaries, or undocumented type assertions.

If this work is not done, each new feature can add another custom sanitizer or import-level mock, and the test count will increasingly overstate confidence.

## 3. Goals

1. Make the complete test suite collect and run reliably on the repository's single pinned Node version.
2. Delete tests that provide no regression signal and rewrite tests whose only purpose is to preserve historical implementation details.
3. Eliminate all `vi.mock`, `vi.doMock`, and Jest module mocks from application tests.
4. Keep test doubles at explicit runtime interfaces: injected functions, service objects, in-memory storage, fake fetchers, and callback spies.
5. Parse untrusted JSON, storage, provider payloads, stream data, and framework callback payloads once at their boundary with Zod.
6. Remove duplicate `readString`, `readPositiveInteger`, `readTimestamp`, and `isRecord` helpers rather than consolidating them into a shared junk drawer.
7. Use `lodash-es` for standard merge, equality, intersection, deduplication, and object-selection operations when it materially simplifies the code; use native language operations when they are already clearer.
8. Add repository-wide duplicate-block detection with a zero-clone target above an agreed minimum block size, excluding only generated and genuinely vendored sources.
9. Replace direct `typeof window` checks with one application-owned runtime/environment source and enforce that ownership with a custom Oxlint rule.
10. Add repository-owned Oxlint anti-slop enforcement side by side with ESLint without weakening existing Prettier, Tailwind, React, or accessibility checks.
11. Leave retained tests focused on user-visible behavior, data integrity, security boundaries, concurrency, or non-trivial domain rules.

## 4. Non-Goals

- Raising coverage percentages or adding tests solely to replace deleted test counts.
- Snapshot testing broad component output, prompts, generated schemas, constants, enums, or third-party behavior.
- Replacing all test doubles with network, browser, or production database calls.
- Replacing ESLint in this roadmap. Oxlint runs side by side with ESLint and owns different rules.
- Replacing every small local helper with Lodash. Domain-named transformations remain appropriate when they encode real behavior.
- Enabling every upstream anti-slop rule unchanged. The upstream repository expects local tailoring.
- Rewriting the vendored cropper or select implementation merely to satisfy stylistic rules.
- Preserving obsolete storage formats without evidence that currently shipped user data still requires them.
- Creating compatibility shims or dual implementations during the cleanup.

## 5. Current Repository State

### Test inventory and baseline

- Vitest discovers 62 files under `apps/web/src` and `apps/web/test`.
- `apps/web/test/some.test.ts` is a placeholder with one tautological assertion.
- Fourteen test files contain module mocks, totalling 33 `vi.mock(...)` calls.
- `apps/web/src/features/character-creator/hooks/use-character-session.test.tsx` mocks seven modules and tests several character-book mutations as one hook scenario.
- `apps/web/src/features/character-creator/lib/assistant/character-assistant-message-parity.test.ts` creates both compared values through the same fixture builder and the same `StreamProcessor` path, then normalizes the distinguishing IDs. It does not establish parity between two production implementations.
- `apps/web/src/features/character-creator/lib/assistant/tool-part-renderers.test.ts` largely restates a static registry.
- `apps/web/src/features/character-creator/lib/generation/generation-config.test.ts` contains several cases named after settings that "predate" later features and an assertion enumerating which default constant entries are true.
- `apps/web/src/features/character-creator/components/character-assistant-conversation.test.tsx` includes a test that historical concept tool calls are absent from the UI. That is a historical non-feature, not a durable user contract.
- Negative assertions in backup, export, prompt-example selection, conflict handling, and credential redaction protect current security or data-integrity contracts and are not deletion candidates merely because they assert absence.
- The editor tests patch DOM geometry globals and rely on repeated `waitFor` calls. They currently pass, but they are higher-maintenance jsdom tests and should be reduced to interactions that cannot be covered by serialization/domain tests.
- `apps/web/test/setup.ts` installs fake IndexedDB globally for every suite and manually calls React Testing Library cleanup even though the library registers cleanup through the available global `afterEach`.
- CI runs type checking, lint, and build, but not `pnpm run test`.

### Current execution failure

- The complete run on 2026-08-18 reported 40 passing files, 22 failed files, and 184 executed passing tests.
- The dominant failure occurs during module import before test collection: `loggerFactory.getLogger(...)` is called while `loggerFactory` is undefined.
- A focused run of `provider-health.test.ts` fails the same way, so this is not demonstrated cross-file mock leakage.
- `package.json` requires Node 26.5.0; the audit ran on Node 26.5.0; GitHub Actions installs Node 24.11.1. The repository has three different effective versions and must select one exact supported version before repeatability measurements are meaningful.

### Parsing and helper duplication

- `generation-config.ts` hand-builds partial settings with `readString`, `readBoolean`, numeric clamp readers, record filters, schema `safeParse` checks followed by assertions, and object spreading.
- `character-library.ts` defines another `readString` and `readTimestamp`, casts an unknown record, and manually reconstructs a value for an existing Zod schema.
- `provider-health.ts` defines a third `readString`, another positive-integer reader, and most of the repository's `Reflect.get` calls while decoding a small number of known provider response families.
- `character-library-storage.ts` and `card-format.ts` each define `isRecord`; assistant session and storage files repeat record checks and timestamp readers.
- `generation-error.ts`, `response-parser.ts`, `character-vision.server.ts`, `character-assistant-safety.ts`, and `character-assistant-tool-observability.ts` inspect unknown values with `typeof`, casts, and `Reflect.get` instead of normalizing them at the callback or I/O boundary.
- `lodash-es` is already a production dependency but is directly imported in only `query-helpers.ts` and the select component.

### Duplication and runtime detection

- There is no clone detector, duplication budget, or CI duplication report.
- `utils/ssr-helpers.ts` defines `isOnClient = typeof window !== 'undefined'` and is already consumed by theme, select, and isomorphic-layout-effect code.
- `db/storage.ts` and `portrait-asset-cache.ts` each define their own `isBrowser` constant with the same expression.
- `components/ui/cropper.tsx` repeats the expression while computing device-pixel ratio.
- `use-workspace-panel-layout.ts` repeats the inverse expression twice before reading browser storage.
- General clone detection does not belong in a single-file Oxlint AST rule. Use a purpose-built token-based detector for cross-file blocks, then use custom Oxlint rules for exact architectural constraints such as forbidding direct runtime detection outside its owner.

### Anti-slop rule fit

The upstream generic rules are:

| Rule                                              | Repository decision                                  | Evidence / rationale                                                                                                                                                                       |
| ------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `no-module-mocking`                               | Adopt unchanged as an error after Phase 2            | Directly covers 33 calls across 14 files.                                                                                                                                                  |
| `no-reflect-get`, `no-reflect-apply`              | Adopt as errors after boundary refactors             | Reflective access is concentrated in provider/error/stream normalization and proxy adapters.                                                                                               |
| `no-chained-type-assertions`                      | Adopt as an error                                    | Nine search hits include tests, select generics, cropper events, and editor integration. Each needs real evidence or one documented narrow adapter.                                        |
| `require-safety-comment-for-type-assertion`       | Adopt after removing avoidable assertions            | Useful only after generated files and clearly safe `as const` assertions are excluded by the rule itself.                                                                                  |
| `no-known-value-widening`, `no-widen-then-assert` | Adopt as errors                                      | Aligns with existing `satisfies` conventions and removes assertion round trips.                                                                                                            |
| `no-unsafe-dictionary-type`                       | Adopt in application-owned source after schema work  | Logging contexts and genuinely heterogeneous JSON need explicit reviewed contracts rather than blanket suppression.                                                                        |
| `no-unknown-returns`, `no-unknown-type-aliases`   | Adopt as errors                                      | Boundary functions should return parsed domain values or `JsonValue`, not anonymous unknowns.                                                                                              |
| `no-unknown-parameters`                           | Customize or scope                                   | Catch errors and framework/library callbacks legitimately begin unknown; parse them at the first application boundary. The upstream `cause`-only exception is too narrow for current APIs. |
| `no-runtime-typeof`                               | Customize and enable only for unparsed boundary code | Upstream rejects every `typeof`, including `typeof window`, already typed values, and legitimate callback discrimination. `allowInTypeGuards` alone is insufficient.                       |
| `no-conditional-empty-object-spread`              | Adopt only after semantic review                     | Some current sites can use typed optional properties or `pickBy`; others intentionally distinguish absent from `undefined`.                                                                |
| `no-object-parameters`                            | Adopt as an error                                    | Use a schema, a concrete interface, or `JsonObject` at boundaries.                                                                                                                         |
| `no-shape-in-symbol-names`                        | Do not adopt unchanged                               | `shape` is a legitimate cropper domain term and Zod exposes `.shape`; banning the word would reduce clarity.                                                                               |

Add repository-specific rules rather than forcing every local invariant into an upstream rule:

| Proposed local rule                 | Behavior                                                                                                                                                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenzo/no-direct-runtime-detection` | Reject `typeof window`, `typeof document`, and equivalent browser-global presence checks outside the single runtime-environment owner.                                                                           |
| `tenzo/no-trivial-test-assertion`   | Reject literal tautologies such as `expect(true).toBe(true)` and identical literal equality. It must not attempt to decide whether a domain constant assertion is useful.                                        |
| `tenzo/no-ad-hoc-unknown-reader`    | If a stable signal can be defined without false positives, reject local `readString`/`readNumber`/`isRecord`-style functions that accept `unknown` and manually narrow it instead of invoking a boundary schema. |

Do not build a custom Oxlint rule for arbitrary duplicate blocks. Oxlint JavaScript rules are appropriate for AST patterns and architectural ownership; cross-file clone detection needs a repository-level token index.

The optional Effect rule does not apply because this repository does not use Effect.

## 6. System Scenarios

### SC1: A test replaces an external dependency

**Actor:** Developer or coding agent
**Goal:** Exercise error and success paths deterministically.
**Current behavior:** The test mocks an imported module, often including unrelated exports or import-time state.
**Target behavior:** Production composition supplies an explicit dependency interface; the test passes a focused fake or spy through that seam.
**Acceptance criteria:**

- [ ] The test contains no module mock.
- [ ] The production default still composes the real dependency.
- [ ] The fake implements the same narrow interface used in production.
- [ ] Assertions concern returned state, emitted domain events, persisted values, or visible behavior rather than import calls.

### SC2: Persisted or provider data enters the application

**Actor:** Storage or remote provider
**Goal:** Convert untrusted data into a meaningful domain value.
**Current behavior:** Multiple helpers and `Reflect.get` calls progressively narrow anonymous values.
**Target behavior:** A Zod schema for the accepted wire shape parses once; downstream code receives a named inferred type and uses normal property access.
**Acceptance criteria:**

- [ ] Invalid records fail or are deliberately filtered at the boundary.
- [ ] Default and fallback semantics are visible in the schema or one domain transformation.
- [ ] No shared `readString`/`isRecord` utility is introduced.
- [ ] Retained tests cover the boundary's business fallback or rejection behavior, not Zod itself.

### SC3: A test protects an absence

**Actor:** Reviewer
**Goal:** Decide whether a negative assertion is durable or historical.
**Current behavior:** Historical non-features and meaningful safety exclusions look similar in test syntax.
**Target behavior:** The test is kept only when the absence is part of a current security, privacy, data-integrity, state-machine, or accessibility contract.
**Acceptance criteria:**

- [ ] Historical UI absences and removed behavior are deleted.
- [ ] Security exclusions such as credentials not appearing in backups remain tested.
- [ ] State-machine exclusions are preferably asserted through the active state or domain result, with DOM non-existence used only when it is the user-visible contract.

### SC4: New low-evidence code is introduced

**Actor:** CI
**Goal:** Reject the known slop patterns before merge.
**Current behavior:** ESLint does not ban module mocking, reflective parsing, or evidence-free assertions, and CI omits tests.
**Target behavior:** Oxlint runs alongside ESLint and the complete test suite runs on the exact supported Node version.
**Acceptance criteria:**

- [ ] Anti-slop violations fail `pnpm run lint` or a root validation command.
- [ ] ESLint still supplies rules Oxlint does not replace.
- [ ] CI runs the complete test suite after type checking and linting.

## 7. Design Principles And Constraints

- Test behavior with the smallest faithful subject. Prefer pure domain functions over rendering a hook whose collaborators all have to be mocked.
- Dependency injection means a real production composition boundary, not optional test-only props scattered through UI components.
- Do not replace module mocks with global spies, dynamic imports, service locators, or mutable singleton registries.
- `vi.fn` is acceptable for a callback or injected interface. The smell is replacement of module resolution and tests whose setup overwhelms the behavior.
- Parse once at the edge. Do not carry `unknown` through application layers and repeatedly narrow it.
- Use Zod `default`, `prefault`, `catch`, `transform`, discriminated unions, `record`, and `partialRecord` according to semantics. A parse failure must not silently become a default unless the product intentionally accepts corrupt input.
- Use `lodash-es/merge`, `pickBy`, `isEqual`, `uniqBy`, or related focused imports only when their semantics match the problem. Avoid deep merge for arrays or security-sensitive objects unless replacement behavior is explicit.
- Treat duplication reports as review input, not an instruction to create a generic abstraction. Extract only when the repeated code has one concept, ownership boundary, and change reason.
- Keep one source of truth for runtime detection. Callers import the shared boolean or, where behavior differs by runtime, call a named environment adapter instead of repeating global-presence checks.
- Do not test migrations, schema definitions, generated code, constant values, enum values, or components that only render props.
- Keep meaningful compatibility only for user data known to exist in a supported shipped version. Historical wording in a test is not sufficient evidence.
- Do not add `index.ts` files. The vendored anti-slop entry point must be renamed (for example, `plugin.ts`) and all imports must remain explicit.
- Run pnpm commands outside the sandbox and validate on the chosen exact Node version.

## 8. Target Architecture

```text
external JSON / storage / provider / framework callback
                         |
                         v
               boundary Zod schema
                         |
                 parsed domain type
                         |
          domain service / pure transformation
                         |
          UI or persistence composition layer

tests -> real domain service + injected fake dependency
      -> focused component with real domain props
      -> no import/module replacement

clone detector (cross-file blocks)
              +
ESLint (framework/style/accessibility) + Oxlint (correctness/anti-slop)
                         |
                         v
                 CI validation gate
```

### Testing layers

- **Pure unit tests:** parsing transformations, editor serialization, proposal state transitions, prompt assembly, archive formats, and deterministic algorithms.
- **Service tests:** pass fake fetch/storage/generation/logging interfaces directly to a service constructor or function.
- **Component tests:** use real child components unless the child is outside the component's responsibility; where composition is too broad, split container and presentational ownership rather than mocking the import.
- **Runtime smoke tests:** logging isomorphic composition and browser-only editor behavior where jsdom cannot faithfully model the platform.

### Lint ownership

- Existing ESLint remains authoritative for current framework, accessibility, Tailwind, Prettier, and repository style rules.
- Root `oxlint.config.ts` owns native Oxlint configuration and loads the local anti-slop plugin.
- `tools/oxlint/anti-slop/` owns the reviewed vendored rules. It is ignored as a lint target but loaded as a plugin.
- A pinned copy/paste detector owns cross-file token duplication. Its configuration excludes generated code, vendored anti-slop source, dependencies, build output, and no application-owned feature/test directory merely to lower the score.
- Generated files, agent assets, and vendored rule source are ignored explicitly; application files are not broadly excluded to make the baseline pass.

## 9. Implementation Plan

### Phase 0: Establish a truthful green baseline

**Purpose:** Separate environment/configuration failures from flaky or low-value test behavior.

**Scope:**

- [x] Choose Node 26.5.0 and align `.node-version`, `.nvmrc`, root/package engine declarations, config package engines, and both GitHub Actions workflows.
- [x] Refactor `apps/web/src/lib/logging/logger.ts` so importing application code under Vitest produces a valid logger without executing a client/server RPC path incorrectly. Keep one real isomorphic production composition and avoid a test-only global fallback.
- [x] Move eager `getLogger` calls in `generation-error.ts`, `provider-health.ts`, and other import-time modules behind a valid factory or inject a narrow logger into their service composition.
- [x] Run the full suite on the pinned Node version. Three consecutive runs passed with 62 files and 266 tests on 2026-08-18.
- [x] Add `pnpm run test` to `.github/workflows/pull-request.yml` once the baseline is green.

**Exit criteria:**

- [x] Every test file collects when run alone and in the complete suite.
- [x] Three consecutive complete runs pass on the exact pinned Node version.
- [x] CI and local engines agree.

**Can run in parallel:**

- Node/CI version alignment and read-only classification of existing tests are independent after the target version is selected.

**Must not start until:**

- No test is deleted merely because it is hidden behind the logger import failure.

### Phase 1: Delete or rewrite low-evidence tests

**Purpose:** Make the suite describe current product risk instead of history or implementation inventory.

**File plan:**

| File                                                                                                                             | Action                                                                                                                                                                                                                                                                   | Required retained signal                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `apps/web/test/some.test.ts`                                                                                                     | Delete the file.                                                                                                                                                                                                                                                         | None; it is a tautology.                                                                      |
| `apps/web/test/setup.ts`                                                                                                         | Remove manual cleanup if the installed Testing Library auto-cleanup is confirmed; remove global fake IndexedDB and import it only in database/storage suites that need it.                                                                                               | Isolation remains automatic and database tests still use a faithful IndexedDB implementation. |
| `generation/generation-config.test.ts`                                                                                           | Delete exact default-map enumeration and cases whose only rationale is a pre-feature stored shape. Replace them with table-driven boundary cases for current invalid/partial settings only if the product still accepts partial persisted data.                          | Valid explicit settings survive; invalid current settings receive deliberate defaults/clamps. |
| `assistant/tool-part-renderers.test.ts`                                                                                          | Delete unless the registry becomes a real exhaustive dispatch function with behavior not guaranteed by its definition and types.                                                                                                                                         | Component-level tool rendering covers supported categories.                                   |
| `assistant/character-assistant-message-parity.test.ts`                                                                           | Delete the same-fixture/same-processor comparison. Replace it only with a test that invokes the two actual production native and synthetic event producers.                                                                                                              | Real producer parity, if both producers still exist.                                          |
| `components/character-assistant-conversation.test.tsx`                                                                           | Delete the historical concept-tool non-rendering test. Recast empty/settled proposal cases around active proposal state and available current actions; retain protection against duplicated final output and meaningful state transitions.                               | Current proposal lifecycle and message grouping remain covered.                               |
| `prompt/seeded-random.test.ts`                                                                                                   | Keep deterministic sequence and non-mutating permutation properties. Remove probabilistic loops, different-seed trivia, and range checks that restate `Uint32Array`/arithmetic unless a past defect justifies them. Add empty-input behavior only if callers rely on it. | Reproducibility and non-mutating shuffle.                                                     |
| `generation/token-stats.test.ts`                                                                                                 | Collapse repetitive field cases into a table grouped by permanent, temporary, and excluded business categories; do not assert enum/constant identity.                                                                                                                    | The product's token-category rules remain explicit.                                           |
| `vision/character-vision-contracts.test.ts`                                                                                      | Retain because MIME and maximum payload size are application security boundaries; name assertions after the accepted/rejected request behavior rather than schema mechanics.                                                                                             | Unsupported media and oversized payloads are rejected.                                        |
| `cards/backup.test.ts`, `cards/example-characters.test.ts`, `cards/card-format.test.ts`, `generation/generation-presets.test.ts` | Retain the negative assertions that protect credentials, prompt data minimization, and export format boundaries. Prefer `not.toHaveProperty` where omission is the contract.                                                                                             | Security and interoperability exclusions remain covered.                                      |
| All remaining pure domain suites                                                                                                 | Review each assertion for a distinct branch/invariant; consolidate table-friendly cases but retain archive, proposal conflict, strict template, parser, prompt budget, and round-trip coverage.                                                                          | No reduction in meaningful branch and invariant coverage.                                     |

**Exit criteria:**

- [ ] No placeholder, tautological, same-path parity, enum-value, constant-value, schema-definition, or historical non-feature test remains.
- [ ] Every retained negative assertion has a documented current security, privacy, interoperability, accessibility, or state-machine reason visible in the test name.
- [ ] Deleted tests are not replaced solely to maintain count or coverage.

**Can run in parallel:**

- Pure-domain test review can proceed independently by feature directory after Phase 0 is green.

**Must not start until:**

- Phase 0 distinguishes baseline failures from test value.

### Phase 2: Remove module mocking through real seams

**Purpose:** Ensure tests exercise production-owned contracts and composition.

**File plan:**

| Current test file(s)                                                                                       | Production refactor                                                                                                                                                             | Test replacement                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `db/migration-gate.test.tsx`                                                                               | Extract a migration-gate service/controller accepting migration repository, backup, and collection initialization interfaces; keep the component as UI composition.             | Use an in-memory service fake and render the real gate; remove three module mocks.                                                          |
| `hooks/use-proposal-actions.test.tsx`                                                                      | Move proposal persistence/apply operations into a service with session repository and notification ports.                                                                       | Test the service directly; retain at most one hook wiring test with real provider composition.                                              |
| `hooks/use-character-session.test.tsx`                                                                     | Extract character-book create/update/reorder/remove operations into a pure domain module used by the hook. Keep persistence orchestration behind a narrow collection interface. | Replace seven module mocks with pure domain tests plus a small service test using an in-memory collection.                                  |
| `components/character-switcher.test.tsx`                                                                   | Separate the context-connected container from a presentational switcher that receives characters, active ID, and actions.                                                       | Render the presentational component with callback spies; no Jotai/context mocks.                                                            |
| `components/character-book-editor.test.tsx`                                                                | Separate book mutation intent from the rich editor implementation.                                                                                                              | Test accessible book actions with real props and test markdown editing in the editor's own behavioral suite; remove the editor module mock. |
| `components/assistant/discovery-card-grid.test.tsx`                                                        | Pass selected-card state and handoff behavior as domain props; keep markdown display outside the selection contract if possible.                                                | Test selection/handoff without replacing the editor module.                                                                                 |
| `components/enhance-field-template-dialog.test.tsx`                                                        | Move request construction into a pure function/service and inject notification through the existing application boundary, not a test-only prop.                                 | Test request selection and draft lifecycle directly; keep one dialog workflow with real controls and no select/editor/toast module mocks.   |
| `vision/character-vision.server.test.ts`                                                                   | Make structured generation an argument of a server service factory.                                                                                                             | Supply a fake generator function and assert validated/clamped domain output.                                                                |
| `generation/structured-output.server.test.ts`                                                              | Make TanStack `chat` a dependency of a generator factory; use a typed minimal adapter contract rather than `as unknown as AnyTextAdapter`.                                      | Invoke the factory with a fake chat function.                                                                                               |
| `generation/tanstack-ai-text-generation.test.ts`                                                           | Create an adapter factory whose OpenAI-compatible, OpenRouter, and chat constructors are injected at composition.                                                               | Use typed constructor spies; retain wire-option and stream behavior without three module mocks.                                             |
| `assistant/character-assistant-runtime.server.test.ts`                                                     | Inject chat/tool-loop execution into a runtime factory.                                                                                                                         | Test prompt/tool orchestration through the factory fake.                                                                                    |
| `assistant/character-assistant-structured.server.test.ts`, `assistant/discovery-directions.server.test.ts` | Inject validated-object generation and adapter/model-option creation behind one generation interface.                                                                           | Use one faithful fake interface; remove duplicated hoisted mock bundles.                                                                    |
| `assistant/character-assistant-discovery-route.test.ts`                                                    | Export a route-handler factory accepting the discovery service, or test the service separately and keep one real handler validation test.                                       | Assert HTTP validation/cache behavior without replacing feature modules.                                                                    |

**Exit criteria:**

- [ ] `rg "vi\.(mock|doMock)|jest\.(mock|doMock)" apps/web` returns no application-test matches.
- [ ] Production defaults compose real implementations at one visible composition boundary.
- [ ] No test-only global registry, service locator, or mutable singleton replaces module mocking.
- [ ] Mock setup is smaller than the behavior under test and uses typed interfaces.

**Can run in parallel:**

- UI container/view splits and server generation factories are independent workstreams once interface names and ownership are agreed.

**Must not start until:**

- Phase 1 has decided which test cases are worth preserving; do not build seams for tests that should be deleted.

### Phase 3: Replace ad hoc unknown readers with boundary schemas

**Purpose:** Establish type evidence once and delete duplicate readers and reflective access.

**File plan:**

| File(s)                                                                                                                                                | Refactor                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generation/generation-config.ts`                                                                                                                      | Define Zod schemas for stored connection and prompt settings using prefault/default/catch only where corruption fallback is intentional; clamp numeric inputs with schema transforms; parse enum values once; merge partial assistant-field editing over defaults with a direct typed spread or `merge` after verifying array semantics. Delete all local read helpers and assertion-after-`safeParse` patterns. |
| `cards/character-library.ts`                                                                                                                           | Create an accepted stored-library-item input schema with transformations for portrait, timestamps, and defaults. Inject or pass the current timestamp where fallback time must be deterministic. Delete `readString` and `readTimestamp`.                                                                                                                                                                        |
| `provider/provider-health.ts`                                                                                                                          | Define schemas for OpenAI-compatible model lists, Kobold responses, OpenRouter endpoint metadata, service info, and context responses. Parse each fetch result at the endpoint boundary and use normal property access. Use `uniqBy`/maps only for genuine provider deduplication. Delete `readString`, `readPositiveInteger`, and provider `Reflect.get` calls.                                                 |
| `cards/character-library-storage.ts`, `assistant/character-assistant-session-storage.ts`                                                               | Parse the collection envelope with `z.record` and a stored-entry schema, then transform/filter valid data. Delete duplicate `isRecord` checks, assertions, and repeated JSON traversal.                                                                                                                                                                                                                          |
| `assistant/character-assistant-session.ts`                                                                                                             | Replace `z.custom` plus internal `typeof` checks with a concrete minimal UI-message schema compatible with the TanStack value actually persisted. Apply timestamp/id fallbacks through one schema transform.                                                                                                                                                                                                     |
| `cards/card-format.ts`                                                                                                                                 | Replace the local `isRecord` path with explicit schemas for accepted V1/V2 import envelopes while preserving unknown extension data through a named JSON-value contract.                                                                                                                                                                                                                                         |
| `generation/response-parser.ts`, `generation/json-repair.ts`                                                                                           | Return a parsed schema/domain result from repaired JSON functions or accept a schema as an argument; do not return anonymous `unknown`.                                                                                                                                                                                                                                                                          |
| `vision/character-vision.server.ts`                                                                                                                    | Parse structured analysis once and clamp arrays in a schema transform instead of recursively editing an unknown record.                                                                                                                                                                                                                                                                                          |
| `assistant/character-assistant-safety.ts`, `assistant/character-assistant-tool-observability.ts`, `assistant/character-assistant-structured.server.ts` | Define minimal schemas for callback info/results/errors at the library boundary. Branch on parsed discriminants and remove `Reflect.get`. Do not parse already typed internal domain objects again.                                                                                                                                                                                                              |
| `generation/generation-error.ts`, `lib/logging/log-sanitizer.ts`                                                                                       | Keep a single bounded error/JSON normalization boundary because native `Error`, `cause`, and cyclic values are not ordinary JSON. Replace reflective key walking with a reviewed normalized error schema/direct access where possible; document any unavoidable assertion. Do not create a general-purpose unknown reader.                                                                                       |
| `components/character-assistant-conversation.tsx`, `hooks/use-character-assistant-workspace.ts`                                                        | Parse tool outputs when they enter app-owned message/session state; consume typed tool-result unions in rendering and workspace code.                                                                                                                                                                                                                                                                            |
| `components/ui/cropper.tsx`, `components/ui/select/select.tsx`, `editor/chat-template-mention.ts`                                                      | Isolate unavoidable third-party typing mismatches in one narrow adapter per library. Prefer library generic parameters and typed event construction. Any remaining assertion must state the runtime invariant; no chained assertion remains.                                                                                                                                                                     |
| `utils/ssr-helpers.ts`, `db/storage.ts`, `components/ui/cropper.tsx`, `hooks/use-workspace-panel-layout.ts`, `portrait/portrait-asset-cache.ts`        | Establish one runtime-environment owner. Keep a single low-level browser-presence check or framework environment adapter, then import it everywhere else. Storage access remains behind `iStorageApi`; browser-only APIs such as device-pixel ratio and object URLs are accessed through named runtime helpers instead of copied checks.                                                                         |

**Exit criteria:**

- [ ] No duplicate `readString`, `readPositiveInteger`, `readTimestamp`, or `isRecord` helper remains in application feature code.
- [ ] Application-owned I/O boundaries return named parsed types, not `unknown`.
- [ ] `Reflect.get` and `Reflect.apply` have no application-source matches.
- [ ] Chained assertions have no matches.
- [ ] Direct `typeof window`/`document` runtime detection exists only in the approved environment owner, or has no matches if TanStack environment functions can be made test-safe.
- [ ] Defaults on corrupt input are deliberate and covered by one meaningful boundary test.

**Can run in parallel:**

- Settings/library storage schemas and provider/generation boundary schemas are independent after shared JSON-value ownership is decided.

**Must not start until:**

- Phase 2 dependency interfaces are stable so schemas do not get hidden behind another compatibility layer.

### Phase 4: Reduce brittle test infrastructure

**Purpose:** Remove global state and timing/DOM emulation that can make otherwise useful tests unreliable.

**Scope:**

- [ ] Scope `fake-indexeddb/auto` to `persistent-collection.test.ts` and any storage suite that truly needs IndexedDB.
- [ ] Ensure every Dexie test closes and deletes its randomly named database in `afterEach`/`finally`, including failure paths.
- [ ] Keep `flushPendingUpdates()` as the deterministic debounce seam; do not wait for real 300 ms timers.
- [ ] In `chat-input-editor.test.tsx`, move serialization, mention hydration, macro tokenization, and click metadata into existing pure editor modules where possible. Keep only interaction behavior requiring DOM composition.
- [ ] If Tiptap geometry remains necessary, expose one production adapter for platform geometry rather than duplicating `Object.defineProperty` patches in tests. Do not add a broad test-utils helper solely to conceal jsdom limitations.
- [ ] Replace unnecessary `waitFor` with direct `findByRole` or awaited user interactions; retain waits only for actual asynchronous state transitions.
- [ ] Use `afterEach(vi.restoreAllMocks)` only in suites that create spies; do not add a global mock reset that masks leaked state.

**Exit criteria:**

- [ ] No suite relies on real debounce delays, current wall-clock ordering, network access, or shared persistent database names.
- [ ] No global browser/IndexedDB patch is installed for unrelated pure tests.
- [ ] Repeated complete runs from Phase 0 remain green.

**Can run in parallel:**

- Database cleanup and editor test reduction are independent.

**Must not start until:**

- Module-mock removal has established the intended test boundaries.

### Phase 5: Add duplicate detection and tailored Oxlint enforcement

**Purpose:** Detect both arbitrary cross-file clones and precise low-evidence AST patterns before they spread.

**Scope:**

- [ ] Add pinned [`jscpd`](https://github.com/kucherenko/jscpd) as a root dev dependency and create `.jscpd.json` targeting application and test TypeScript/TSX.
- [ ] Start with a diagnostic scan using `mild` mode and a meaningful floor such as eight lines and 70 tokens. Review the actual report before freezing these values; smaller fragments usually create extraction pressure without demonstrating copy/paste design debt.
- [ ] Exclude `node_modules`, build output, generated route code, agent assets, and `tools/oxlint/anti-slop`. Do not exclude `apps/web/src`, tests, UI components, or a feature directory because it reports clones.
- [ ] Classify every reported clone as: extract one owned abstraction, replace with Zod/Lodash/existing utility, delete low-value duplicated test setup, or intentional generated/vendor content that deserves a narrow configuration exclusion.
- [ ] After remediation, set the duplication threshold to zero for blocks above the configured size. If a reviewed intentional application clone remains, document the exact pair and rationale rather than raising a broad percentage budget.
- [ ] Add `check:duplicates` to root scripts and CI. Keep it separate from file-scoped lint-staged because clone detection needs the repository corpus.
- [ ] Add pinned `oxlint` and `@oxlint/plugins` root dev dependencies and update `pnpm-lock.yaml`.
- [ ] Vendor the reviewed anti-slop rules under `tools/oxlint/anti-slop/`. Rename the upstream `index.ts` entry point to `plugin.ts` to comply with repository rules and use explicit imports rather than re-exports.
- [ ] Add root `oxlint.config.ts` with explicit ignores for generated code, agent assets, and the vendored plugin source.
- [ ] Enable native correctness/suspicious rules and the high-signal anti-slop rules listed in Section 5.
- [ ] Modify or scope `no-unknown-parameters` and `no-runtime-typeof` to application boundary code. Permit genuine `cause`/catch inputs and environment detection while requiring immediate parsing of external values.
- [ ] Add `tenzo/no-direct-runtime-detection` and allow the chosen environment owner only. Include accepted tests for imports/adapter calls and rejected tests for direct browser-global presence checks.
- [ ] Add `tenzo/no-trivial-test-assertion`. Add `tenzo/no-ad-hoc-unknown-reader` only if its focused fixtures demonstrate a low-false-positive signal; otherwise rely on the more precise upstream type-evidence rules and duplicate detector.
- [ ] Reject `no-shape-in-symbol-names` for this repository or modify it to target misleading type-container suffixes without rejecting cropper shape or Zod `.shape`.
- [ ] Evaluate every conditional empty-object spread. Replace it with a typed direct property, Zod transform, or `pickBy` only when omission semantics remain correct; otherwise tune the rule rather than adding a disable comment at each valid site.
- [ ] Add `lint:eslint` and `lint:oxlint` scripts, with root `lint` running both side by side. Do not configure Oxlint merely as an ESLint pre-pass or use one tool's success to skip the other.
- [ ] Add Oxlint to lint-staged only if the full configured run remains fast and file-scoped execution loads the local plugin reliably.
- [ ] Configure unused-disable reporting so suppressions cannot silently outlive their justification.

**Files added or changed:**

- `package.json`
- `pnpm-lock.yaml`
- `.jscpd.json`
- `oxlint.config.ts`
- `tools/oxlint/anti-slop/plugin.ts`
- selected `tools/oxlint/anti-slop/rules/*.ts` and their focused rule tests
- `lint-staged.shared.cjs` if the measured pre-commit path is acceptable
- `.github/workflows/ci.yml`

**Exit criteria:**

- [ ] Oxlint rejects a temporary fixture containing a module mock, reflective access, chained assertion, unsafe dictionary, and undocumented non-const assertion.
- [ ] Oxlint rejects direct runtime detection outside its owner while accepting imports of the shared source and reviewed catch/error boundaries.
- [ ] Legitimate cropper `shape` and Zod `.shape` are not reported.
- [ ] The duplicate scan reports zero unreviewed blocks above the configured line/token floor and fails when a temporary cross-file clone is introduced.
- [ ] ESLint and Oxlint both pass without broad application-directory ignores.
- [ ] There are no unexplained inline disables.

**Can run in parallel:**

- Duplicate-report remediation and vendored-rule adaptation can be developed independently, but one integration owner must approve abstractions, final severities, and exclusions.

**Must not start until:**

- Phases 2 and 3 remove the known violations; do not establish a giant warning baseline that new code can hide inside.

### Phase 6: Final integration and documentation closure

**Purpose:** Prove the smaller suite and stricter source produce more reliable evidence.

**Scope:**

- [ ] Run type checking, ESLint, Oxlint, duplicate detection, the complete test suite, and production build on the exact pinned Node version.
- [ ] Run the complete test suite three consecutive times after all fixes; use deterministic shuffle/seed support if Vitest provides it and record the seed.
- [ ] Search for banned patterns and classify any intentional exceptions in this roadmap.
- [ ] Record before/after counts for test files, tests, module mocks, duplicate blocks, duplicate readers, direct runtime checks, Reflect calls, chained assertions, and lint suppressions.
- [ ] Update this roadmap's checkboxes, evidence, status, audit index, and archive location when complete.

**Exit criteria:**

- [ ] All acceptance criteria pass with recorded command evidence.
- [ ] The roadmap describes shipped truth and can be archived.

**Can run in parallel:**

- Final commands that mutate caches or generated outputs remain sequential; read-only pattern counts may run alongside document preparation.

**Must not start until:**

- All implementation phases are integrated and no worker/process is still writing.

## 10. Acceptance Criteria

### Product behavior

- [ ] Current character creation, editing, assistant, import/export, backup, provider, and persistence behavior remains intact except explicitly removed obsolete compatibility.
- [ ] Meaningful privacy, credential, format, conflict, and migration safeguards remain covered.

### API and contracts

- [ ] External and persisted values are parsed at their first application-owned boundary.
- [ ] Boundary functions return named schema-derived or domain types.
- [ ] Dependencies used by tests are explicit real interfaces composed with production defaults.
- [ ] There is no generic shared unknown-value reader module.
- [ ] Browser/runtime detection has one source of truth and direct checks elsewhere are lint errors.

### Persistence

- [ ] Supported stored settings, cards, sessions, and collections parse through explicit schemas.
- [ ] Unsupported obsolete formats are removed together with their compatibility branches and historical tests.
- [ ] Database tests clean up their own isolated state.

### UI/UX

- [ ] Retained component tests cover interactions, accessibility, and state transitions rather than static rendering or historical absence.
- [ ] Rich-editor behavior is tested at the lowest faithful layer.

### Testing

- [ ] No module mocks remain.
- [ ] No placeholder, enum-value, constant-value, generated-code, migration-definition, or same-path parity tests remain.
- [ ] The full suite passes three consecutive times on the pinned runtime.
- [ ] CI runs the complete suite.

### Duplication

- [ ] Repository-wide duplicate detection scans production and test TypeScript/TSX.
- [ ] No unreviewed duplicate block remains above the configured minimum lines/tokens.
- [ ] Generated/vendor exclusions are narrow and listed in `.jscpd.json`.
- [ ] Duplication cleanup does not introduce generic abstractions shared only by coincidentally similar code.

### Observability

- [ ] Importing application logging from Vitest yields a valid logger composition.
- [ ] Tests do not assert `tslog` formatting or third-party transport behavior; feature tests may assert application-owned redaction and event shape through an injected logger contract.

### Documentation and rollout

- [ ] Oxlint and the tailored anti-slop rules are documented in this roadmap and executable through root scripts.
- [ ] ESLint and Oxlint both run side by side through root scripts and CI.
- [ ] No compatibility or dual-lint suppression layer remains after verification.

## 11. Verification Plan

Run all pnpm commands outside the sandbox on the exact Node version selected in Phase 0.

### Static validation

- `pnpm run check-types`
- `pnpm run lint` (runs ESLint and Oxlint side by side)
- `pnpm run check:duplicates`
- `pnpm run build`
- `rg -n "vi\.(mock|doMock)|jest\.(mock|doMock)" apps/web`
- `rg -n "Reflect\.(get|apply)" apps/web/src`
- `rg -n "as unknown as|as object as|as never as" apps/web/src`
- `rg -n "function (readString|readPositiveInteger|readTimestamp|isRecord)" apps/web/src`
- `rg -n "typeof (window|document)|typeof globalThis\.(window|document)" apps/web/src`

### Duplicate validation

- Review the initial `jscpd` console/JSON report before setting the final minimum size and threshold.
- Introduce a temporary duplicate block in two fixture files and prove `pnpm run check:duplicates` fails, then remove the fixtures.
- Verify the final report contains no application clone hidden by a broad directory or glob exclusion.

### Test validation

- Run each formerly uncollectable representative suite alone: provider health, generation error, structured output, assistant runtime, and migration gate.
- Run `pnpm run test` once after each coherent phase, not after every small edit.
- At final handoff, run the complete suite three consecutive times without changing repository state.
- Do not use retries to turn intermittent failures green. A retry may be used diagnostically, but the root cause must be fixed.

### Lint-rule validation

Use focused rule fixtures for the vendored anti-slop plugin. These tests validate repository-owned lint behavior and are not tests of third-party Oxlint itself. Include accepted and rejected examples for every locally modified rule.

### Manual review

- Inspect every retained negative assertion and record its current contract category.
- Inspect each remaining type assertion and verify that its safety comment names a checked invariant rather than restating the cast.
- Inspect every Lodash merge/default operation for array and prototype semantics.

## 12. Rollout And Migration

Perform direct replacements by feature slice. When a Zod boundary or dependency-injected service is verified, remove the manual reader or import-mocked path in the same change. Do not retain old and new sanitizers, adapter factories, or test compositions in parallel.

Introduce Oxlint side by side with ESLint after the initial violations are removed. Enable selected rules as errors immediately; do not keep a permanent warning baseline. ESLint and Oxlint own distinct rule families and both remain required. Add duplicate detection as a separate corpus-wide check because it cannot be replaced by per-file linting.

## 13. Risks And Mitigations

| Risk                                                 | Impact                                                 | Mitigation                                                                                                                                            | Owner                 |
| ---------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Tests are deleted too aggressively                   | Real regressions lose coverage                         | Require a current risk/invariant classification and preserve security, persistence, concurrency, and interoperability tests.                          | Implementation owner  |
| Dependency injection becomes ceremony                | Production code grows test-only abstractions           | Extract seams only at actual external boundaries; prefer pure domain functions and one composition root.                                              | Architecture reviewer |
| Zod defaults hide corrupted data                     | Bad storage/provider data silently changes meaning     | Use fallback only where current product behavior requires it; otherwise reject/filter and log at the boundary.                                        | Feature owner         |
| Lodash deep merge changes arrays or prototypes       | Settings or card data is corrupted                     | Use merge only for plain, schema-parsed objects and add a behavior test for the merged domain result.                                                 | Feature owner         |
| Clone detection reports structural coincidence       | Premature abstractions make unrelated features coupled | Use a meaningful block-size floor and require one concept/change reason before extraction; narrowly exclude only generated or vendored sources.       | Architecture reviewer |
| A global duplication percentage hides a new clone    | Small regressions fit under the existing budget        | Remediate to a zero threshold above the configured block floor rather than preserving a percentage baseline.                                          | Lint owner            |
| Upstream anti-slop rules create noise                | Developers add blanket disables or avoid clearer code  | Vendor and tailor the rules, add accepted fixtures, and reject rules that do not express a repository invariant.                                      | Lint owner            |
| Oxlint JS plugin alpha changes                       | CI breaks on upgrade                                   | Pin compatible Oxlint/plugin versions and upgrade deliberately with rule-fixture validation.                                                          | Lint owner            |
| Runtime mismatch is mistaken for flakiness           | Work targets the wrong root cause                      | Align Node locally and in CI before repeated-run analysis.                                                                                            | Integration owner     |
| Editor tests move too far from real browser behavior | jsdom-green tests miss UI failures                     | Retain focused real component interactions and add a minimal Playwright path only if a concrete browser-only regression cannot be covered faithfully. | UI owner              |

## 14. Decisions, Deferrals, And Superseded Work

### Decision: Oxlint is additive, not an ESLint replacement

**Status:** accepted
**Date:** 2026-08-18
**Rationale:** The current ESLint stack includes framework, accessibility, Tailwind, import, and formatting integrations. Oxlint provides fast correctness rules and the custom anti-slop plugin, but replacing all existing behavior is outside this cleanup.
**Effect on roadmap:** Root validation runs both tools and avoids duplicated rules where practical.

### Decision: Use a clone detector for cross-file duplication

**Status:** accepted
**Date:** 2026-08-18
**Rationale:** Oxlint rules are well suited to precise AST patterns, but arbitrary duplicate-block detection requires comparing token sequences across the repository. `jscpd` provides configurable minimum lines/tokens, exclusions, reports, and a failing threshold for TypeScript/TSX.
**Effect on roadmap:** Add a pinned `jscpd` check beside ESLint and Oxlint, remediate clones above the agreed floor, and target a zero threshold rather than implementing an unreliable stateful Oxlint rule.

### Decision: One runtime-environment owner

**Status:** accepted
**Date:** 2026-08-18
**Rationale:** The same `typeof window` decision currently appears six times even though `isOnClient` already exists. Environment detection is an architectural boundary, not local feature logic.
**Effect on roadmap:** Consolidate detection into one owner and add `tenzo/no-direct-runtime-detection` to reject new copies.

### Decision: Vendor and tailor anti-slop

**Status:** accepted
**Date:** 2026-08-18
**Rationale:** The upstream project explicitly says it is meant to be vendored and changed. Unmodified syntactic rules reject legitimate repository concepts such as cropper `shape`, Zod `.shape`, and environment `typeof` checks.
**Effect on roadmap:** Only reviewed rules become errors; locally changed rules receive focused fixtures.

### Decision: No shared `readUnknown` helper layer

**Status:** accepted
**Date:** 2026-08-18
**Rationale:** Centralizing `readString` would reduce duplicate names without adding type evidence. Schemas at the I/O boundary produce domain values and make accepted fallback semantics explicit.
**Effect on roadmap:** Duplicate readers are deleted, not moved.

### Decision: Negative assertions require a current contract

**Status:** accepted
**Date:** 2026-08-18
**Rationale:** Absence is meaningful for secrets, unselected prompt fields, stale proposals, and unsupported exports, but not for historical UI that is no longer part of the product direction.
**Effect on roadmap:** Negative syntax is not banned; historical rationale is.

### Deferral: Full ESLint-to-Oxlint migration

**Status:** deferred
**Date:** 2026-08-18
**Rationale:** It is unrelated to the observed slop patterns and would mix a tooling migration with behavioral test and boundary refactors.
**Effect on roadmap:** ESLint remains required.

## 15. Archive Checklist

- [ ] Status is `Completed and aligned`, `Historical`, `Superseded on purpose`, or `Rejected`.
- [ ] Current repository state is accurate.
- [ ] Shipped work is linked.
- [ ] Remaining work is moved to another roadmap or explicitly deferred.
- [ ] Acceptance criteria are complete or intentionally narrowed.
- [ ] Static, test, and repeated-run verification evidence is recorded.
- [ ] The roadmap reads as shipped history rather than active implementation guidance.

## 16. Changelog

| Date       | Change                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-18 | Created after auditing the anti-slop rules, all discovered test files, module-mock usage, boundary helpers, current lint/CI configuration, and the failing full-suite baseline. |
| 2026-08-18 | Added repository-wide clone detection, one runtime-environment source of truth, local Oxlint architectural rules, and an explicit side-by-side ESLint/Oxlint rollout.           |
| 2026-08-18 | Completed Phase 0 on Node 26.5.0: restored import-safe logging, aligned local and CI runtimes, added CI tests, and passed three complete 62-file/266-test runs.                 |
