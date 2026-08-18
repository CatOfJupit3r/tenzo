---
title: "Local SSR Error Observability"
slug: "local-observability"
status: "Active implementation"
roadmap_type: "observability"
priority: "P1"
created: "2026-08-18"
updated: "2026-08-18"
last_repo_audit: "2026-08-18"
source_of_truth: true
related_docs:
  - "docs/roadmaps/active/character-card-creator.roadmap.md"
supersedes: []
superseded_by: null
archive_when:
  - "Client and SSR errors are emitted through one application logger and appear in the server process console."
  - "Direct application console logging has been migrated to the logger or intentionally retained with rationale."
  - "Verification evidence is recorded without adding library-behavior tests."
---

# Local SSR Error Observability

> Status: Active implementation
> Last repo audit: 2026-08-18
> Current summary: The TanStack Start application has useful error presentation and a few structured diagnostic events, but logging is split across direct `console` calls. Browser failures remain in browser DevTools and do not reliably appear in the local SSR server process console.

## 1. Executive Summary

Adopt `tslog` v5 as the only logging library for both browser and server execution. Define one application logger factory in one isomorphic module using TanStack Start's `createIsomorphicFn()`: the server implementation writes to the server process console, while the browser implementation writes locally and forwards error records through a typed `createServerFn({ method: "POST" })`. The server function re-emits those client records through the same server logger, so both SSR and browser errors are visible in the terminal running the app.

This roadmap adds no log persistence, hosted monitoring, local observability service, log database, or diagnostic UI. It also adds no automated tests for logger-library behavior. Verification is type checking, linting, building, focused repository searches, and manual runtime checks that observe the real browser-to-server path.

## 2. Problem / Opportunity

- **Pain point:** Failures are difficult to diagnose because browser errors stop at DevTools and server-side logs are inconsistent.
- **Who is affected:** Developers and local users diagnosing rendering, query, assistant-stream, generation, and SSR failures.
- **Why now:** The application has growing client/server streaming behavior and already carries correlation fields such as `runId` and `toolCallId`, but there is no shared logging boundary.
- **What remains weak without this:** Errors can be shown to users without a durable terminal record, structured context is lost, and related client/server failures cannot be followed through one process console.

## 3. Goals

1. Use only `tslog` v5 for application logging in browser and server runtimes.
2. Expose one application-facing logger and child-logger factory from one isomorphic construction module.
3. Emit server and SSR errors directly to the server process console.
4. Forward browser `ERROR` and `FATAL` records to a same-origin TanStack Start server function and re-emit them in the server process console.
5. Preserve structured `Error` data, cause chains, component names, runtime, and existing correlation identifiers.
6. Capture uncaught browser errors, unhandled browser promise rejections, TanStack Router caught errors, React Query errors, and existing explicit feature failures.
7. Centralize redaction and bounds so secrets or arbitrarily large provider payloads cannot reach the terminal.
8. Remove direct application `console.info`, `console.warn`, and `console.error` calls covered by the new logger.

## 4. Non-Goals

- Persisting logs to files, IndexedDB, localStorage, a database, or another durable store.
- Sentry, OpenTelemetry, Loki, Grafana, OpenObserve, HyperDX, or any hosted/self-hosted collector.
- An in-app log viewer, diagnostics drawer, log search, or downloadable diagnostic bundle.
- Metrics, distributed tracing, performance spans, profiling, or analytics.
- A second logging library, adapter abstraction, or compatibility layer for Winston, Pino, LogTape, or LogLayer.
- Replacing user-facing error messages with raw diagnostic errors.
- Logging prompts, character-card content, generated content, API keys, authorization headers, or raw request bodies.
- Automated unit, integration, component, or end-to-end tests for this roadmap. The work primarily wires established `tslog`, React, and TanStack behavior; tests that restate those libraries are explicitly excluded.
- A global Node.js `uncaughtException` or `unhandledRejection` policy. TanStack Start owns the server lifecycle; this roadmap logs application and framework-caught failures without changing process termination semantics.

## 5. Current Repository State

### Runtime and routing

- `apps/web` is a React 19 TanStack Start SSR application. Route loaders and shared modules can execute on either server or client.
- `apps/web/src/router.tsx` creates the TanStack Router and React Query client. It installs `defaultErrorComponent` but no `defaultOnCatch`, `QueryCache.onError`, or `MutationCache.onError` logger callbacks.
- `apps/web/src/routes/__root.tsx` is the shared SSR/client document root and currently has no browser-global error capture component.
- TanStack Start documents `createIsomorphicFn()` for one function with separate server/client implementations, with the non-target implementation removed from the corresponding bundle. It documents `createServerFn()` as a typed, same-origin RPC boundary callable from client code.

### Error handling and logging

- `apps/web/src/components/error-boundary.tsx` renders useful development stacks and production recovery UI but does not record the caught error or TanStack's component-stack information.
- `apps/web/src/features/character-creator/lib/generation/generation-error.ts` redacts a limited set of string patterns and converts provider errors into user-readable descriptions. Its `logGenerationError()` function writes directly to `console.error` and loses structured error/cause information.
- `apps/web/src/features/character-creator/lib/assistant/character-assistant-tool-observability.ts` already produces a useful structured event with `runId`, `toolCallId`, duration, outcome, and error category, but emits it through direct console calls.
- `apps/web/src/features/character-creator/hooks/use-character-assistant-workspace.ts` contains three direct `console.error` calls for stream, send, and retry failures.
- The audited application source contains six direct console logging calls. There is no logger dependency in `apps/web/package.json`.

### Existing tests

- Tests cover generation error descriptions/redaction and feature behavior. They are not a precedent for testing `tslog` formatting, transport dispatch, console method selection, or TanStack server-function serialization.
- Existing tests must continue to compile, but this roadmap creates no new tests and does not modify tests merely to assert logger calls.

## 6. System Scenarios

### SC1: SSR failure reaches the process console

**Actor:** TanStack Start server runtime
**Goal:** Record an SSR or server-side application error where the developer is running the app.
**Current behavior:** Some caught route errors render an error page without an application log; generation errors use isolated console strings.
**Target behavior:** The isomorphic logger resolves to its server implementation and emits a structured error to the server process console.
**Acceptance criteria:**

- [ ] The record identifies `runtime: "server"` and its component/category.
- [ ] Native error name, message, stack, and bounded cause information are retained.
- [ ] Server logging does not invoke the client-forwarding server function.

### SC2: Browser failure reaches the process console

**Actor:** Browser runtime
**Goal:** Make an actionable browser error visible in the SSR server terminal.
**Current behavior:** The error remains in browser DevTools or is only rendered in the UI.
**Target behavior:** The browser logger emits locally and forwards an allowlisted error record through a POST server function; the handler re-emits it using the server logger.
**Acceptance criteria:**

- [ ] Browser `ERROR` and `FATAL` records appear in the server process console with `runtime: "client"`.
- [ ] Forwarding is same-origin, best-effort, and non-blocking to user interactions.
- [ ] A forwarding failure does not recurse through the logger or create an error loop.
- [ ] Client-supplied records are validated, redacted, size-bounded, and marked as client-originated by the server rather than trusted to choose their origin.

### SC3: Related assistant failures retain correlation

**Actor:** Developer diagnosing an assistant run
**Goal:** Follow a failure using existing operation identifiers.
**Current behavior:** Tool events and stream errors use different console shapes.
**Target behavior:** Both use child loggers or structured context containing the relevant `runId`, `toolCallId`, component, operation, and model when safe.
**Acceptance criteria:**

- [ ] Existing safe assistant-tool observability fields remain available.
- [ ] Sensitive inputs and generated/provider content are not logged.

### SC4: Framework-level browser failures are captured once

**Actor:** React/TanStack runtime
**Goal:** Surface errors that feature code did not explicitly log.
**Current behavior:** Router error UI exists, but uncaught browser errors and query failures lack a centralized application logger.
**Target behavior:** Router, Query, `window.error`, and `window.unhandledrejection` capture points use the shared logger without intentional duplicate reporting.
**Acceptance criteria:**

- [ ] TanStack Router's catch hook is the logging side effect; the error UI remains presentation-only.
- [ ] Browser-global listeners are registered and cleaned up once.
- [ ] Query and mutation errors include a bounded operation identifier when available.

## 7. Design Principles And Constraints

- Keep `tslog` behind a small application-owned `iLogger`/`iLoggerFactory` contract so feature code does not configure transports.
- Construct the runtime logger in one module using `createIsomorphicFn().server(...).client(...)` rather than manual `typeof window` branching.
- Use `createServerFn({ method: "POST" })` for internal browser-to-server error forwarding. A public server route is unnecessary because only this TanStack Start application calls it.
- Keep the root logger stateless. Use child loggers for component and operation context; never mutate global context per request or user action.
- Maintain a single server logger instance per server module/runtime and a single client logger instance per browser page.
- Forward only `ERROR` and `FATAL` records to the server. Lower levels may remain visible in their native runtime console but must not create server noise.
- Preserve the current user-facing generation error descriptions and hints. Logging receives the native error separately.
- Redact before crossing the browser/server boundary and sanitize again on the server. Do not trust client-provided runtime, level, timestamp, or reserved metadata blindly.
- Bound message length, stack length, cause depth, metadata depth, collection length, and request payload size.
- Do not make logging failure affect application behavior. The client transport is best-effort and uses a raw, non-logging fallback only when useful during development.
- Do not add `index.ts` files or re-export the logger through unrelated modules.
- Do not add automated tests for the logging integration. Validation must exercise the actual runtime path.

## 8. Target Architecture

```text
Feature / framework capture point
             |
             v
       application logger
       (one public contract)
             |
       createIsomorphicFn
        /            \
       /              \
server implementation  client implementation
tslog -> process        tslog -> browser console
console                       |
                              | ERROR/FATAL only
                              v
                    createServerFn POST
                              |
                    validate + sanitize
                              |
                              v
                    server child logger
                              |
                              v
                    server process console
```

### Proposed ownership

- `apps/web/src/lib/logging/logging-contracts.ts`: logger interfaces, schema-backed levels/runtime/event shape, reserved keys, and safe serialized-error shape.
- `apps/web/src/lib/logging/log-sanitizer.ts`: shared redaction and structural bounds.
- `apps/web/src/lib/logging/logger.ts`: singleton access, `createIsomorphicFn()` construction, environment-specific `tslog` configuration, client transport, and child factory.
- `apps/web/src/lib/logging/report-client-log.ts`: `createServerFn({ method: "POST" })` validator and handler that re-emits accepted client errors through the server logger. If placing the server function beside `logger.ts` avoids a real circular import without weakening import protection, the orchestrator may colocate it; there must still be one logger construction site.
- `apps/web/src/components/client-error-observer.tsx`: lifecycle-safe `window.error` and `window.unhandledrejection` registration.
- Existing router, root, generation, assistant-tool, and workspace files: capture-point integration only.

### Logger contract

The exact API may follow `tslog` naming where it improves type safety, but application code must have:

- level methods needed by the app (`debug`, `info`, `warn`, `error`, `fatal`),
- structured context rather than interpolated secret-bearing strings,
- native `Error` support,
- child logger creation with immutable bindings,
- no transport configuration exposed to features.

### TanStack Start decision

Use environment functions for construction and a server function for forwarding:

- `createIsomorphicFn()` is appropriate because logger creation is a direct runtime-specific utility: server calls must remain local and client calls must attach browser forwarding.
- `createServerFn()` is appropriate because forwarding is an internal same-origin RPC from the browser to server. It must not be confused with `createServerOnlyFn()`, which throws when called from the client instead of issuing an RPC.
- A custom `src/server.ts` entry point is not required for the initial scope. Add one only if implementation evidence shows that framework-level SSR errors bypass Router capture and cannot otherwise be logged; this is a stop-and-reassess condition, not assumed scope.

Primary references:

- [TanStack Start execution model](https://tanstack.com/start/latest/docs/framework/react/guide/execution-model)
- [TanStack Start environment functions](https://tanstack.com/start/latest/docs/framework/react/guide/environment-functions)
- [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [TanStack Start import protection](https://tanstack.com/start/latest/docs/framework/react/guide/import-protection)
- [`tslog` universal logger and transports](https://github.com/fullstack-build/tslog)

## 9. Implementation Plan

### Phase 0: Orchestrator-owned foundation

**Purpose:** Fix the dependency, contracts, environment boundary, and file ownership before parallel implementation.

**Scope:**

- [x] Add one pinned `tslog` v5 dependency to `apps/web/package.json` and update the lockfile.
- [x] Confirm the installed v5 transport and record types from package declarations rather than coding against README assumptions.
- [x] Define the shared logging contracts, schema-backed closed values, reserved metadata, sanitizer, and payload bounds.
- [x] Implement the one isomorphic logger construction site and the typed POST server function.
- [x] Ensure the server function re-emits through the server branch without client-forwarding recursion.
- [x] Decide exact logger call conventions and provide two representative migrated call sites as patterns for workers.

**Exit criteria:**

- [ ] A deliberate client error can be emitted through the logger and appears once in the server process console.
- [ ] A server-side call writes directly to the server process console without network forwarding.
- [x] Client and server bundles respect the intended environment boundary.
- [x] `pnpm run check-types` passes before worker dispatch.

**Can run in parallel:**

- No writer parallelism in this phase. Dependency files, shared contracts, the sanitizer, server function, and logger construction are integration-critical and remain orchestrator-owned.

**Must not start until:**

- The orchestrator has inspected the current worktree and reserved all foundation files from worker edits.

### Phase 1: Parallel capture-point integration

**Purpose:** Migrate independent error sources after the logger contract is stable.

**Scope:**

- [x] Dispatch Worker A for framework/client capture integration.
- [x] Dispatch Worker B for character-assistant and generation call-site migration.
- [x] Keep workers on disjoint writable files and prohibit dependency, lockfile, logger-core, generated-route-tree, and test-file edits.

**Exit criteria:**

- [x] Both workers return changed-file lists, command evidence, acceptance mappings, and explicit incomplete work.
- [x] The orchestrator inspects both diffs and rejects duplicate capture, unsafe metadata, compatibility wrappers, or raw console leftovers.

**Can run in parallel:**

- **Worker A - framework capture:** owns `apps/web/src/router.tsx`, `apps/web/src/routes/__root.tsx`, `apps/web/src/components/error-boundary.tsx`, and the new `apps/web/src/components/client-error-observer.tsx`. It adds Router catch logging, Query/Mutation cache logging, and browser-global observers while keeping error UI presentation-only.
- **Worker B - feature migration:** owns `apps/web/src/features/character-creator/lib/generation/generation-error.ts`, `apps/web/src/features/character-creator/lib/assistant/character-assistant-tool-observability.ts`, and `apps/web/src/features/character-creator/hooks/use-character-assistant-workspace.ts`. It preserves user-facing error descriptions and existing safe tool fields while replacing direct console logging.
- The orchestrator may concurrently inspect untouched server route handlers for additional error call sites, but must not edit worker-owned files until both workers stop.

**Must not start until:**

- Phase 0 contracts and representative patterns pass type checking.

#### Worker dispatch requirements

Use only the active `handy-coder` worker role with fresh context, no child delegation, and one coherent packet per worker. Each packet must include:

- exact owned files and forbidden files,
- `AGENTS.md`, this roadmap, and representative logger call sites as required reading,
- the stable logger contract and accepted metadata shape,
- explicit preservation requirements,
- no test creation/modification and no dependency or formatter commands,
- narrow type/lint validation for owned files where available,
- proof mapped to the assigned acceptance criteria.

The root orchestrator retains architecture, shared contracts, dependency changes, integration decisions, worker diff review, and final validation. If the required named worker profile is unavailable, do not silently substitute a different worker configuration; continue serially or request direction.

### Phase 2: Root integration and runtime audit

**Purpose:** Integrate the parallel work and verify the complete error path without expanding scope.

**Scope:**

- [x] Review the full combined diff and resolve conflicts centrally.
- [x] Search application source for remaining direct console calls and classify each remaining occurrence.
- [x] Check for duplicate reporting between explicit feature logs, Router catch handling, Query callbacks, and browser-global events.
- [ ] Manually exercise one server/SSR error, one Router-render error, one rejected browser promise, and one assistant/generation error where practical.
- [ ] Confirm server output is readable, structured, redacted, and tagged by runtime/component/correlation fields.
- [x] Run final type checking, linting, and production build once after all fixes are complete.
- [x] Record verification evidence and mark completed items. Archive remains pending manual runtime verification.

**Exit criteria:**

- [ ] Browser and server failures appear in the server process console as specified.
- [x] No persistence or second observability system was introduced.
- [x] No automated tests were added or modified for this work.
- [x] Final validation is green.

**Can run in parallel:**

- Read-only architecture review of the combined diff may run while the orchestrator prepares manual runtime scenarios, provided the reviewer does not edit files and receives the exact acceptance contract.

**Must not start until:**

- Both Phase 1 workers have stopped writing and returned proof.

## 10. Acceptance Criteria

### Product behavior

- [ ] Browser errors appear in the terminal running the TanStack Start server.
- [ ] SSR and server application errors appear directly in that terminal.
- [ ] User-facing error and recovery UI continues to behave as before.

### API and contracts

- [ ] `tslog` v5 is the only application logging library.
- [ ] Feature code consumes one application logger contract and cannot configure transports.
- [ ] One `createIsomorphicFn()` construction site selects server and client logger behavior.
- [ ] One validated POST server function accepts internal browser error reports.
- [ ] Closed level/runtime values use shared schema-backed constants rather than repeated literals.

### Persistence

- [ ] No file, browser-storage, database, or external log persistence exists.

### UI/UX

- [ ] No diagnostics UI is added.
- [ ] Error presentation remains separate from the logging side effect.

### Testing

- [ ] No test files are created or modified for the observability integration.
- [ ] No assertions are added for `tslog` formatting, transport behavior, console selection, or TanStack RPC serialization.

### Observability

- [ ] Client records forwarded to the server are identified as `runtime: "client"` by server-owned metadata.
- [ ] Server records are identified as `runtime: "server"`.
- [ ] Native errors retain bounded name, message, stack, and cause details.
- [ ] Existing `runId` and `toolCallId` context is preserved where available.
- [ ] Secrets, request bodies, prompts, card content, and generated/provider content are not logged.
- [ ] Client-forwarding failures do not recurse or affect user workflows.
- [ ] Remaining direct application console calls are absent or explicitly justified.

### Documentation and rollout

- [ ] This roadmap records implementation and verification evidence before archival.
- [ ] There is no dual logger, compatibility shim, or staged legacy logging path.

## 11. Verification Plan

No automated tests are added or modified. Do not run `pnpm run test` solely for this roadmap; the acceptance target is runtime integration, not revalidation of library behavior.

### Static validation

- `pnpm run check-types`
- `pnpm run lint`
- `pnpm run build`
- `rg -n "console\.(debug|info|log|warn|error)" apps/web/src`
- Inspect the production client output or build diagnostics to confirm no server-only implementation or sensitive configuration leaked into the client bundle.

Run pnpm commands outside the sandbox as required by repository policy. Run final broad validation once after all integration fixes are complete.

### Manual runtime validation

1. Start the local stack with `pnpm run dev`.
2. Trigger a controlled error from a server-side handler or SSR execution path; confirm exactly one structured server record appears in the process console.
3. Trigger a controlled Router-render error; confirm the existing error UI renders and exactly one client-originated record appears in the process console with component-stack context when available.
4. Trigger an unhandled browser promise rejection; confirm it is forwarded without breaking the page.
5. Trigger an existing assistant/generation failure using a non-secret failure condition; confirm correlation metadata appears and provider/API-key content does not.
6. Temporarily make the forwarding call unavailable; confirm the client does not recurse, flood the console, or surface a new user-facing failure.
7. Remove any temporary fault injection before final validation and inspect the diff to prove it is gone.

## 12. Rollout And Migration

This is a direct replacement of covered application `console` calls. Once the shared logger is available, migrate all in-scope call sites and do not retain parallel legacy logging. There is no compatibility layer and no persistence migration.

The logger should default to useful local console output. Browser forwarding is limited to errors from the first release; changing that threshold later is configuration, not a second architecture.

## 13. Risks And Mitigations

| Risk | Impact | Mitigation | Owner |
| --- | --- | --- | --- |
| Client error forwarding logs its own failure | Recursive requests and terminal noise | Transport failures use a guarded raw development fallback and never call the application logger | Orchestrator |
| Router/global handlers report the same error | Duplicate terminal entries | Assign Router catch as the React render/loader capture owner and audit global propagation manually | Worker A / Orchestrator |
| Sensitive AI data enters structured metadata | Secrets or private content printed locally | Allowlist fields, redact on both sides, bound traversal, and migrate native errors separately from provider payloads | Orchestrator / Worker B |
| Isomorphic imports retain the wrong implementation | Server code leaks into client bundle or browser forwarding runs during SSR | Keep environment-specific references inside compiler-recognized callbacks and verify the production build | Orchestrator |
| Mutable singleton context crosses SSR requests | Incorrect correlation between requests | Keep the singleton root logger stateless; create immutable child loggers per operation/request | Orchestrator |
| Client log server function becomes noisy | Excess process-console volume | Forward only `ERROR` and `FATAL`; do not forward normal info/debug events | Orchestrator |
| Parallel workers edit shared files | Merge conflicts or inconsistent contract use | Phase 0 freezes contracts; one writer per file; root owns integration-critical files | Orchestrator |
| No automated tests leaves wiring regressions unnoticed | A future refactor may break forwarding | Keep a precise manual smoke path and static import-boundary/build checks; do not add tests that merely exercise dependencies | Orchestrator |

## 14. Decisions, Deferrals, And Superseded Work

### Decision: Use only tslog v5

**Status:** accepted
**Date:** 2026-08-18
**Rationale:** `tslog` supports Node.js and browsers, structured native errors, child bindings, masking, readable console output, and attachable transports without requiring a second pretty-print or browser logger package.
**Effect on roadmap:** Winston, Pino, LogTape, LogLayer, and loglevel are excluded from implementation.

### Decision: Use TanStack environment and server functions

**Status:** accepted
**Date:** 2026-08-18
**Rationale:** `createIsomorphicFn()` expresses the two runtime constructions in one place, and `createServerFn()` is the framework-native typed same-origin RPC for internal client-to-server forwarding.
**Effect on roadmap:** No public ingestion server route or manual environment detection is planned.

### Decision: Process console only

**Status:** accepted
**Date:** 2026-08-18
**Rationale:** This is a local-only application and the operational requirement is immediate debugging in the running SSR process.
**Effect on roadmap:** All persistence, collectors, viewers, and export workflows are excluded.

### Decision: No automated tests for this integration

**Status:** accepted
**Date:** 2026-08-18
**Rationale:** Tests of formatting, transport dispatch, console selection, and server-function serialization would primarily restate established library behavior. The meaningful acceptance evidence is the real browser-to-server runtime path plus type/lint/build checks.
**Effect on roadmap:** Workers must not create or modify test files for this work, and completion uses the manual verification plan.

### Deferral: OpenTelemetry and persistent observability

**Status:** deferred
**Date:** 2026-08-18
**Rationale:** There is no current requirement for traces, metrics, historical search, or multi-process correlation.
**Effect on roadmap:** Correlation fields remain structured so a future roadmap can add these capabilities without changing feature call sites.

## 15. Archive Checklist

- [ ] Status is `Completed and aligned`, `Historical`, `Superseded on purpose`, or `Rejected`.
- [ ] Current repository state is accurate.
- [ ] Shipped work is linked.
- [ ] Remaining work is moved to another roadmap or explicitly deferred.
- [ ] Acceptance criteria are complete or intentionally narrowed.
- [ ] Static and manual runtime verification evidence is recorded.
- [ ] The roadmap reads as shipped history rather than active implementation guidance.

## 16. Changelog

| Date | Change |
| --- | --- |
| 2026-08-18 | Created roadmap after repository audit and TanStack Start execution-boundary review. |
| 2026-08-18 | Implemented the logger foundation and capture-point migrations in commits `041ac8d`, `4aaf964`, `abe3a29`, and `cae2914`. Workspace type checking, linting, and production build passed; manual runtime scenarios remain pending. The only remaining direct console call is the intentional non-recursive development fallback for a failed client-log forwarding request. |
