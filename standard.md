# Koneko Roadmap Standard

## Purpose

Koneko roadmaps are planning artifacts for substantial product, architecture, AI, UX, migration, or cleanup work. A roadmap must give both humans and AI agents enough context to understand:

1. why the work exists,
2. what current repository reality is,
3. what must change,
4. what is explicitly out of scope,
5. how to implement safely,
6. how to verify completion,
7. when the roadmap should be archived.

A roadmap is not a loose idea dump. It is a source-of-truth planning document that can be executed, audited, and later archived without becoming misleading.

## Roadmap directories

Use this structure:

```text
docs/roadmaps/
  README.md
  roadmap-audit.md
  active/
    <slug>-roadmap.md
  archive/
    <slug>-roadmap.md
```

Rules:

* `docs/roadmaps/active/` contains only real active backlog, in-progress work, blocked work, or near-archive closure work.
* `docs/roadmaps/archive/` contains completed, historical, superseded, rejected, or stale-but-preserved records.
* `docs/roadmaps/roadmap-audit.md` should index current active roadmaps and explain status values.

## File naming

Use kebab case:

```text
docs/roadmaps/active/<feature-or-epic-slug>.roadmap.md
```

Examples:

```text
docs/roadmaps/active/ai-improvements.roadmap.md
docs/roadmaps/active/storyteller-evals.roadmap.md
docs/roadmaps/archive/vector-database-module.roadmap.md
```

Use `-roadmap.md` unless the file is a cross-roadmap utility such as `roadmap-audit.md`.

## Status values

Use one of these exact statuses:

| Status                       | Meaning                                                      | Folder                                   |
| ---------------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| `Proposed`                   | Worth considering, not committed                             | `active/` or future `proposed/` if added |
| `Active backlog`             | Real backlog, not currently being implemented                | `active/`                                |
| `In progress`                | Work is actively being implemented                           | `active/`                                |
| `Partially active`           | Major parts shipped, but real follow-up work remains         | `active/`                                |
| `Blocked`                    | Valid roadmap, blocked by dependency or decision             | `active/`                                |
| `Shipped - needs validation` | Implementation is live, verification or docs closure remains | `active/`                                |
| `Completed and aligned`      | Shipped and accurately documented                            | `archive/`                               |
| `Historical`                 | Useful history, not current product direction                | `archive/`                               |
| `Superseded on purpose`      | Replaced by another approach; not missing work               | `archive/`                               |
| `Rejected`                   | Deliberately not pursued                                     | `archive/`                               |

Do not leave a roadmap in `active/` with `Completed and aligned`, `Historical`, `Superseded on purpose`, or `Rejected` status.

## Required frontmatter

Every roadmap must start with YAML frontmatter.

```yaml
---
title: "Roadmap Title"
slug: "roadmap-slug"
status: "Active backlog"
roadmap_type: "feature-epic"
priority: "P1"
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
last_repo_audit: "YYYY-MM-DD"
source_of_truth: true
related_docs:
  - "docs/features/example.md"
  - "docs/reference/architecture/current-module-map.md"
supersedes: []
superseded_by: null
archive_when:
  - "All acceptance criteria are implemented or explicitly deferred with rationale."
  - "Verification evidence is recorded."
  - "The document reads as shipped history instead of active implementation guidance."
---
```

Allowed `roadmap_type` values:

* `feature-epic`
* `agentic-epic`
* `ux-polish`
* `architecture`
* `migration`
* `cleanup`
* `testing`
* `observability`
* `research`
* `closure`

Allowed `priority` values:

* `P0`
* `P1`
* `P2`
* `P3`

## Required roadmap sections

Every active roadmap must include these sections in this order.

````md
# Roadmap Title

> Status: <status>
> Last repo audit: <YYYY-MM-DD>
> Current summary: <one or two sentences explaining current truth>

## 1. Executive Summary

Briefly describe the work, why it matters, and what outcome the roadmap should produce.

## 2. Problem / Opportunity

Explain the user, product, engineering, or agentic problem.

Include:

- the pain point,
- who is affected,
- why now,
- what breaks or remains weak if this is not done.

## 3. Goals

List concrete goals.

Good goals are outcome-based and verifiable.

## 4. Non-Goals

List what this roadmap will not do.

Use this section aggressively to prevent scope creep.

## 5. Current Repository State

Describe the current implementation and documentation state.

Include:

- relevant apps/packages/features,
- current data models or contracts,
- current UI surfaces,
- current tests,
- existing docs,
- known stale documentation,
- shipped work that should not be rebuilt.

Every claim in this section should be grounded in repository evidence.

## 6. User Stories / Use Cases

Use this format:

```md
### UC1: <short name>

**Actor:** <user/system/agent>
**Goal:** <goal>
**Current behavior:** <what happens today>
**Target behavior:** <what should happen>
**Acceptance criteria:**
- [ ] <testable condition>
- [ ] <testable condition>
````

For internal architecture roadmaps, replace user stories with system scenarios.

## 7. Design Principles And Constraints

Include Koneko-specific constraints such as:

* contract-first shared schemas,
* feature-based server and web layout,
* PostgreSQL + Drizzle persistence,
* pgvector where semantic retrieval is needed,
* Better Auth ownership boundaries,
* TanStack Router/Query/Form patterns,
* accessibility expectations,
* no unnecessary compatibility layers,
* no broad rewrites unless the roadmap explicitly justifies them.

## 8. Target Architecture

Describe the intended architecture.

For agentic roadmaps, always include:

* agent roles,
* tool boundaries,
* human approval points,
* persisted state,
* transient runtime state,
* stream/event model,
* guardrails or processors,
* observability/tracing,
* failure and recovery behavior.

For full-stack roadmaps, include:

* shared contracts,
* server services/repositories,
* database schema impact,
* client routes/components/state,
* tests,
* rollout strategy.

## 9. Implementation Plan

Use phased work with exit criteria.

```md
### Phase 1: <name>

**Purpose:** <why this phase exists>
**Scope:**
- [ ] <implementation item>
- [ ] <implementation item>

**Exit criteria:**
- [ ] <verifiable condition>
- [ ] <test or validation condition>

**Can run in parallel:**
- <safe parallel task, if any>

**Must not start until:**
- <dependency, if any>
```

Phase rules:

* Each phase must produce a coherent checkpoint.
* Avoid vague phases such as “polish” unless the tasks are specific.
* Do not mix future-epic ideas into the core completion path.
* If something is intentionally deferred, move it to the deferred section.

## 10. Acceptance Criteria

Create a final checklist that defines roadmap completion.

Group by:

* product behavior,
* API/contracts,
* persistence,
* UI/UX,
* testing,
* observability,
* documentation,
* rollout.

Each item must be testable or explicitly reviewable.

## 11. Verification Plan

Include exactly how the work should be validated.

Use applicable categories:

* unit tests,
* integration tests,
* type checks,
* lint,
* accessibility checks,
* performance validation,
* manual QA path,
* AI evals,
* trace/telemetry validation.

For AI and agentic features, include:

* expected traces,
* tool-call auditability,
* usage/cost tracking,
* failure-mode tests,
* approval workflow tests,
* regression prompts or eval scenarios.

If you have ideas for `e2e` tests, then please describe them separately in `docs/testing/e2e` documents. Do not include complex test plans in the roadmap unless they are essential to the implementation or verification of the work.

## 12. Rollout And Migration

We do not want to maintain multiple versions of the same feature or architecture if it can be avoided. If a roadmap involves replacing or refactoring existing work, then this change should be done without backwards compatibility layers, and the old work should be removed as soon as the new work is verified. 

Deprecations are discouraged in favor of COMPLETELY replacing the old way with the new way.

## 13. Risks And Mitigations

Use a table.

| Risk   | Impact   | Mitigation   | Owner   |
| ------ | -------- | ------------ | ------- |
| <risk> | <impact> | <mitigation> | <owner> |

## 14. Decisions, Deferrals, And Superseded Work

Use this section to prevent stale docs.

```md
### Decision: <title>

**Status:** accepted / deferred / rejected / superseded
**Date:** YYYY-MM-DD
**Rationale:** <why>
**Effect on roadmap:** <what changes>
```

Rules:

* Unchecked items that are no longer desired must become `deferred`, `rejected`, or `superseded`.
* Do not leave intentionally replaced work as an open checkbox.
* Link to the replacement roadmap or implementation reference when possible.

## 15. Archive Checklist

A roadmap can move to `archive/` when:

* [ ] Status is `Completed and aligned`, `Historical`, `Superseded on purpose`, or `Rejected`.
* [ ] Current repository state is accurate.
* [ ] Shipped work is linked.
* [ ] Remaining work is either moved to a new roadmap or marked deferred with rationale.
* [ ] Acceptance criteria are complete or intentionally narrowed.
* [ ] Verification evidence is recorded.
* [ ] The roadmap no longer reads like active implementation instructions.

## 16. Changelog

```md
| Date | Change |
| --- | --- |
| YYYY-MM-DD | Created roadmap. |
| YYYY-MM-DD | Updated status after repository audit. |
```

## Roadmap quality rules

* Prefer current repository evidence over old roadmap claims.
* Separate shipped work from active backlog.
* Separate core completion from future expansion.
* Use exact status values.
* Use testable acceptance criteria.
* Use explicit deferral rationale.
* Keep implementation phases small enough for AI agents to execute safely.
* Do not duplicate long code examples unless they are essential to the plan.
* Do not create broad documentation unless the user asked for it.
* Do not treat archived or superseded plans as missing work.
* Update `roadmap-audit.md` when changing roadmap status.
* Update `docs/roadmaps/README.md` when adding, archiving, or renaming roadmaps.
