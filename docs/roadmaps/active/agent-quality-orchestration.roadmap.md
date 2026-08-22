---
title: "Agent Quality Orchestration"
slug: "agent-quality-orchestration"
status: "Active backlog"
roadmap_type: "agentic-epic"
priority: "P1"
created: "2026-08-20"
updated: "2026-08-23"
last_repo_audit: "2026-08-23"
source_of_truth: true
related_docs:
  - "docs/roadmaps/active/character-card-creator.roadmap.md"
  - "docs/roadmaps/archive/assistant-experience-overhaul.roadmap.md"
  - "docs/roadmaps/active/local-observability.roadmap.md"
supersedes: []
superseded_by: null
archive_when:
  - "Sparse character ideas reliably produce complete, coherent, non-repetitive proposals through the orchestrated pipeline."
  - "Every remote model call is fail-closed to an eligible unmoderated Zero Data Retention endpoint."
  - "The eval suite demonstrates a material quality improvement over the single-agent baseline within the accepted cost and latency budgets."
  - "Verification evidence and the selected model-role profiles are recorded."
---

# Agent Quality Orchestration

> Status: Active backlog
> Last repo audit: 2026-08-23
> Current summary: The live assistant route now uses a typed brief, ownership plan, configurable separate or combined tool-free prose jobs, deterministic safeguards, bounded targeted repairs, and the existing user-reviewed proposal actions. Model calls are concurrency-paced and transient failures use bounded retry with backoff, jitter, cancellation, and retry accounting. Every remote role call refreshes or revalidates bounded ZDR/unmoderated policy metadata and fails closed. The frozen baseline capture, paid multi-model tournament, blinded review, evidence-backed defaults, and removal of the now-unused single-agent implementation remain open.

## 1. Executive Summary

Replace the one-model-does-everything generation path with a small, observable orchestration pipeline optimized for sparse user prompts and rich character-card prose:

1. a cheap structured **brief enricher** turns fragments into an explicit character brief while labeling assumptions and unresolved choices;
2. a structured **content planner** creates a field plan, assigns each fact or dramatic beat to a primary field, and decides which prose jobs are needed;
3. one or more **prose workers** write the assigned fields from bounded briefs, either in isolated per-field calls or one combined call selected by the user, without tool responsibilities;
4. a deterministic **safeguard gate** checks objective format, macro, completeness, and duplication rules, then requests targeted repairs only for blocking violations; subjective quality remains the user's decision at proposal review;
5. the orchestrator converts accepted drafts into the existing reviewable proposal actions.

The pipeline must fail closed on privacy and model-policy constraints. Every remote request must require OpenRouter Zero Data Retention (ZDR), deny provider data collection, and use an endpoint reported as unmoderated by the current provider catalog. No content call may silently fall back to a moderated or retaining endpoint. Local KoboldCpp remains eligible because no third-party retention is involved, but it must pass the same role capability and quality evals.

Model names are deployment profiles, not architecture. As of the audit date, the public OpenRouter catalog shows that the explicitly branded `cognitivecomputations/dolphin-mistral-24b-venice-edition` / `venice/uncensored` route is unmoderated and ZDR-capable but lacks native tools and strict structured outputs. Other unmoderated ZDR routes expose structured output and tools. The roadmap therefore separates prose from control and requires a benchmark before assigning models to roles.

## 2. Problem / Opportunity

- **Pain point:** Thin prompts such as one premise and one trait often lead to thin field proposals because the model has no explicit enrichment or planning stage.
- **Pain point:** The assistant repeats the same biography, traits, setting facts, and relationship beats across description, personality, scenario, greetings, and example dialogue.
- **Root cause:** `buildAssistantSystemPrompt()` gives one model the current card, instructions, examples, templates, and tool contract, then asks it to reason, draft, and act within the same context and token budget.
- **Root cause:** The current structured loop validates action shape, not semantic completeness, information allocation, or cross-field novelty.
- **Root cause:** Global frequency and presence penalties operate at token level and cannot decide that a fact belongs in one field while another field should demonstrate rather than restate it.
- **Who is affected:** Character creators starting from incomplete concepts, users generating several fields at once, and users of smaller or inexpensive models.
- **Why now:** The proposal, structured-output, discovery, template, example-context, provider-capability, and observability foundations already exist. Quality can improve without rebuilding the editor or proposal workflow.
- **What remains weak without this:** Prompt tuning will continue to trade one failure for another; increasing token limits may produce longer repetition; changing the single model may improve averages without making failures diagnosable or controllable.

## 3. Goals

1. Turn sparse user input into a complete, reviewable brief without pretending model assumptions came from the user.
2. Separate planning/tool operation from prose writing so each role has a narrow contract and independently selectable model.
3. Allocate facts, traits, sensory details, relationship beats, and narrative reveals across fields before prose generation.
4. Make generated prose satisfy field-specific depth and format expectations without padding.
5. Detect and repair lexical and semantic repetition across proposed fields before presenting proposals.
6. Preserve the user's premise, requested tone, roleplay macros, strict templates, accepted proposals, and established card facts.
7. Keep all remote inference on unmoderated ZDR endpoints with provider data collection denied and non-compliant fallback impossible.
8. Select role models through reproducible quality, refusal, capability, cost, and latency evals.
9. Surface useful progress and recovery states without exposing chain-of-thought or internal prompts.
10. Prove improvement against the current single-agent path using a versioned regression corpus and pairwise evaluation.

## 4. Non-Goals

- Implementing a general-purpose multi-agent framework.
- Allowing users to create arbitrary agents, graphs, prompts, tools, or recursive worker trees.
- Preserving the current one-model assistant as a permanent parallel architecture after rollout.
- Automatically spending without per-run and per-role budgets.
- Using provider marketing labels alone as evidence of privacy, moderation behavior, or quality.
- Sending content to a non-ZDR endpoint when no compliant route is available.
- Treating token count or field length alone as quality.
- Persisting hidden reasoning, provider request bodies, raw prompts, or generated content in server logs.
- Generating unrelated card fields to make a sparse prompt appear complete.
- Replacing the existing proposal review and acceptance workflow.
- Adding embeddings, a vector database, or server-side user accounts for the initial pipeline.
- Fine-tuning a model in the core epic. Eval evidence may justify a separate fine-tuning roadmap later.
- Running workers concurrently when their fields are semantically coupled and shared context has not been planned.

## 5. Current Repository State

### Assistant runtime

- `character-assistant-runtime.server.ts` builds one large system prompt and sends the conversation to one selected model.
- Native-tool mode gives that model the proposal tools and a bounded `maxIterations()` loop.
- Structured-output mode in `character-assistant-structured.server.ts` asks the same model for conversational text plus typed actions across bounded rounds.
- The prompt already tells the model to produce complete, rich field values and keep conversational prose brief. This instruction is necessary but has no measurable semantic quality gate.
- Existing safety middleware bounds tool iterations and tool-call behavior. Existing proposals remain reviewable and do not mutate the live card without user acceptance.

### Context and prompt inputs

- The runtime can receive a general character idea, global character instructions, the current card, focus boundaries, selected discovery directions, attachments, field templates, and example characters.
- Discovery produces selected directions, but ordinary assistant runs can still begin with only a short user message or general idea.
- Field-format guidance and strict templates exist. They constrain shape but do not allocate content between fields.
- Example summaries are bounded and treated as reference material. There is no explicit provenance or novelty ledger preventing copied or repeated concepts.

### Generation and provider routing

- `generation-config.ts` stores one endpoint, one model, one optional OpenRouter provider, samplers, a generation-budget profile, and the field-call strategy. The obsolete live structured-loop/tool-call selector has been removed.
- `tanstack-ai-text-generation.ts` already adds `dataCollection: 'deny'` and `zdr: true` to OpenRouter requests. Tool and structured calls also require parameter support.
- Connection health records model capabilities for structured responses and tool calling, but it does not validate the selected endpoint against an unmoderated-model policy.
- The UI describes OpenRouter routing as ZDR and data-collection-denied. It does not expose distinct orchestrator, enricher, or writer profiles.
- Local KoboldCpp is supported through an OpenAI-compatible endpoint.

### Quality controls and tests

- Sampling settings warn when the configured response budget is unusually small and expose token penalties.
- Tool and structured-loop tests cover valid actions, retries, bounded execution, proposal safety, and error propagation.
- There is no stored eval corpus for sparse prompts, no baseline capture, no pairwise model runner, no cross-field repetition metric, no field-depth rubric, and no cost/latency quality report.
- Observability records safe lifecycle and tool metadata but intentionally does not log prompts, card content, or provider payloads.

### Provider research snapshot

OpenRouter's current documentation says `provider.zdr: true` restricts a request to ZDR endpoints and `data_collection: "deny"` excludes providers that collect user data. OpenRouter also publishes a live ZDR endpoint catalog. These controls must be enforced per request and at the account or guardrail layer where available:

- [OpenRouter Zero Data Retention](https://openrouter.ai/docs/guides/features/zdr)
- [OpenRouter provider routing](https://openrouter.ai/docs/guides/routing/provider-selection)
- [OpenRouter data collection](https://openrouter.ai/docs/guides/privacy/data-collection)
- [OpenRouter guardrails](https://openrouter.ai/docs/guides/features/guardrails/overview)

The public catalog was refreshed without credentials on 2026-08-21 at 02:01 Europe/Kyiv. All six research candidates were still reported unmoderated and had at least one live ZDR endpoint. Prices are endpoint list-price ranges per million tokens at refresh time and must not be treated as stable configuration:

| Candidate                                                                        | Intended eval role                                | Unmoderated catalog flag | ZDR endpoint observed | Tool support | Structured-output support | Input / output $/M |
| -------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------ | --------------------- | ------------ | ------------------------- | ------------------ |
| `cognitivecomputations/dolphin-mistral-24b-venice-edition` (`venice/uncensored`) | Prose worker                                      | Yes                      | Venice                | No           | No; response format only  | 0.20 / 0.90        |
| `sao10k/l3.1-euryale-70b`                                                        | Prose worker or orchestrator challenger           | Yes                      | DeepInfra, Novita     | Yes          | Yes                       | 0.85-1.4504 / 0.85-1.4504 |
| `nousresearch/hermes-3-llama-3.1-70b`                                            | Enricher or prose challenger                      | Yes                      | DeepInfra             | No           | Yes                       | 0.70 / 0.70        |
| `nousresearch/hermes-4-70b`                                                      | Enricher or prose challenger                      | Yes                      | Nebius                | No           | No; response format only  | 0.13 / 0.40        |
| `qwen/qwen3-235b-a22b-2507`                                                      | Cheap structured orchestrator/enricher challenger | Yes                      | Multiple              | Yes          | Yes                       | 0.09-0.25 / 0.55-1.00 |
| `minimax/minimax-m2.5`                                                           | Structured orchestrator challenger                | Yes                      | Multiple              | Yes          | Yes                       | 0.225-0.60 / 0.90-2.40 |

Catalog capability flags establish eligibility, not suitability. The implementation phase must refresh this snapshot, verify the exact chosen endpoint, and run the repository eval suite before setting defaults.

## 6. System Scenarios

### SC1: Sparse premise becomes a useful brief

**Actor:** Character creator
**Goal:** Start with one or two concepts without writing a detailed prompt.
**Current behavior:** The selected assistant model immediately interprets and drafts from the thin input.
**Target behavior:** The enricher returns a typed brief containing confirmed facts, conservative inferences, creative options, missing high-impact decisions, and field coverage goals.
**Acceptance criteria:**

- [x] User-provided facts and model-added assumptions are distinguishable in the contract.
- [x] Low-impact gaps can receive reversible defaults; high-impact identity, relationship, tone, or consent-sensitive gaps become concise user questions.
- [x] A sparse but sufficient premise can proceed without forcing an interview.
- [x] The brief contains enough field-specific material to plan the requested scope.

### SC2: Multi-field generation avoids restatement

**Actor:** Character creator
**Goal:** Generate a coherent card whose fields contribute different value.
**Current behavior:** Each field may restate the same premise, trait list, or backstory.
**Target behavior:** The orchestrator creates a content-ownership map before drafting and prose workers receive both their assigned content and a negative ledger of material owned elsewhere.
**Acceptance criteria:**

- [x] Every major fact or beat has a primary field and optional allowed echoes.
- [x] Description establishes identity and durable facts; personality explains behavioral tendencies; scenario establishes the active situation; greetings and examples demonstrate rather than summarize.
- [x] Repeated phrases and semantically redundant passages above configured thresholds are flagged.
- [x] Repairs target only the offending fields or passages.

### SC3: One-field edit remains proportionate

**Actor:** Character creator
**Goal:** Improve one focused field without paying for a whole-card pipeline.
**Current behavior:** The single assistant receives broad card context even for a focused edit.
**Target behavior:** The orchestrator selects a reduced path: normalize intent, plan the focused field against the current card, draft once, run focused quality checks, and propose that field only.
**Acceptance criteria:**

- [x] No unrelated field is proposed.
- [x] Existing card facts are used as constraints, not copied wholesale into the draft.
- [x] The reduced path stays within its separate cost and latency budget.

### SC4: Model or endpoint is not eligible

**Actor:** Orchestration runtime
**Goal:** Preserve privacy and model-policy constraints during routing failures.
**Current behavior:** OpenRouter calls require ZDR and deny data collection, but eligibility is not modeled per agent role.
**Target behavior:** A centralized policy resolver validates model, endpoint, capabilities, moderation flag, and ZDR status before every role call.
**Acceptance criteria:**

- [x] A remote call cannot start unless an eligible endpoint is resolved.
- [x] Provider fallback stays inside the eligible allowlist.
- [x] Capability or privacy mismatch returns an actionable error; it never relaxes the policy.
- [x] The user can switch to a compliant configured profile or local inference.

### SC5: A draft fails quality review

**Actor:** Quality gate
**Goal:** Correct a weak result without restarting the whole run.
**Current behavior:** Schema-valid proposals are surfaced even when semantically thin or repetitive.
**Target behavior:** Deterministic checks return typed findings tied to fields and objective rules; the orchestrator issues bounded repair jobs for blocking violations while the user judges subjective prose quality in the proposal UI.
**Acceptance criteria:**

- [x] Findings contain field, severity, evidence category, and repair instruction without chain-of-thought.
- [x] A run has a fixed maximum number of repair passes and tokens.
- [x] Unresolved quality failures are disclosed instead of hidden.
- [x] Successful fields are preserved byte-for-byte unless a coherence repair explicitly requires them.

### SC6: A user asks for advice rather than edits

**Actor:** Character creator
**Goal:** Discuss the card without invoking an expensive drafting pipeline.
**Current behavior:** The assistant can already answer without proposing edits.
**Target behavior:** The intent router selects a conversational answer path and does not invoke enrichment, prose workers, or proposal tools unnecessarily.
**Acceptance criteria:**

- [x] Advice-only turns use at most one eligible model call unless a tool read is required.
- [x] No proposal is created.
- [x] The response preserves the existing concise conversational style.

## 7. Design Principles And Constraints

- Use a fixed, application-owned workflow. Agents may select among declared steps and tools but may not spawn arbitrary subagents or recurse.
- Keep contracts first: all control-plane outputs use zod schemas and schema-derived TypeScript types.
- Let prose be prose. Prose workers return raw field text or a minimal field-key envelope and do not receive proposal tools.
- Keep tool authority centralized. Only the orchestrator may read projected state and commit drafts into the existing proposal action handlers.
- Treat current card content, accepted proposals, templates, and user statements as facts with provenance. Treat generated enrichments as assumptions until accepted or used as reversible creative defaults.
- Plan content ownership before drafting. Prompt-level instructions alone are not an anti-duplication system.
- Use deterministic checks for length bounds, empty sections, macro preservation, exact phrase overlap, normalized n-gram overlap, and template conformance without paying for another model call.
- Keep subjective prose judgment with the user. Do not spend a mandatory model call grading every draft.
- Repair locally. Never regenerate the full card because one field is weak unless the content plan itself is invalid.
- Fail closed on provider policy. `zdr: true`, data collection denied, endpoint eligibility, and capability requirements are invariant and cannot be overridden by a role profile.
- Treat `is_moderated: false` as a routing eligibility signal, not a safety guarantee or a quality score. Refresh it from the live catalog; do not freeze it in source as eternal truth.
- Do not rely on the label “uncensored” alone. The chosen endpoint must also be in the live ZDR catalog.
- Do not expose hidden reasoning. Persist compact briefs, plans, findings, decisions, usage, and outcomes only.
- Preserve local-first behavior. Server functions may proxy inference, but API keys are not stored server-side and content artifacts remain in the browser/session unless the user explicitly saves them.
- Use existing logger redaction and structured correlation fields. Never log prompt, brief, card, or draft content.
- No `index.ts` files, barrel re-exports, compatibility layer, or second permanent assistant runtime.

## 8. Target Architecture

```text
User turn + projected card + focus + references
                       |
                       v
                 intent router
              / advice      \ edit/create
             v               v
       concise answer    brief enricher
                              |
                      typed character brief
                              |
                              v
                       orchestrator/planner
                  field plan + ownership ledger
                              |
            +-----------------+-----------------+
            |                 |                 |
            v                 v                 v
       prose job A       prose job B       prose job C
       raw field text    raw field text    raw field text
            |                 |                 |
            +-----------------+-----------------+
                              |
                              v
                 deterministic quality checks
                              |
                      bounded targeted repairs
                              |
                              v
                 existing proposal action handlers
                              |
                              v
                    user review / accept / reject
```

### Agent roles

| Role           | Responsibility                                                                  | Input                                                                      | Output                           | Tools                                                      | Preferred capability                                      |
| -------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| Intent router  | Choose advice, focused edit, multi-field edit, or creation path                 | Latest turn, focus, compact run state                                      | Typed route decision             | None                                                       | Cheap structured output                                   |
| Brief enricher | Expand sparse input and expose assumptions/gaps                                 | User facts, selected references, requested scope                           | `iCharacterBrief`                | None                                                       | Cheap structured output, strong instruction following     |
| Content planner | Plan fields and allocate content                                                 | Brief, projected card, constraints                                          | Typed content plan               | None                                                       | Reliable structured output                               |
| Prose worker   | Write one isolated field or all requested fields, according to the user setting | Field brief, style guide, owned facts, forbidden repeats, relevant context | Raw field text or field envelope | None                                                       | Creative prose, long-form coherence, low refusal behavior |

The default topology uses logical roles, not necessarily different models. One eligible inexpensive model may serve router and enricher profiles. The content planner may share that model or use a stronger structured-output profile. The prose worker remains independently selectable.

### Core contracts

- `iCharacterBrief`: confirmed facts, source-tagged assumptions, optional creative choices, unresolved questions, tone/style, boundaries, required motifs, avoided motifs, and requested field coverage.
- `iCharacterContentPlan`: field jobs, coupled-field groups, per-field purpose, owned facts/beats, allowed echoes, forbidden restatements, required macros, template constraints, depth targets, and ordering dependencies.
- `iProseJob`: one field or coupled group with only relevant context, a run-level style bible, positive requirements, negative ledger, and output budget.
- `iQualityFinding`: deterministic rule identifier, field keys, severity, concise explanation, and targeted repair instruction.
- `iAgentRoleProfile`: model ID, allowed provider slugs, role, generation parameters, context/output budgets, and required capabilities. Privacy invariants are not configurable fields.
- `iAgentRunSummary`: run ID, selected route, role calls, endpoint/provider IDs, token usage, cost, latency, repair count, outcome, and content-free quality metrics.

### Tool boundaries and human approval

- Model roles receive no application tools. The application-owned orchestration service reads projected state and submits proposals after validation.
- High-impact unresolved choices pause before drafting only when proceeding would materially alter the character. The user sees concise options plus an open response path.
- All generated edits continue through existing proposal review. User acceptance remains the only live-card mutation authority.

### Persisted and transient state

- Persist the user-selected generation budget and field-call strategy with saved generation settings. Accepted card changes and explicitly saved creative briefs continue through existing local-first storage patterns.
- Keep active orchestration plans, drafts, deterministic findings, and repair state transient for the run. Conversation messages and resulting proposals continue to follow existing session storage behavior.
- Persist content-free eval results and operational summaries. Do not persist chain-of-thought or raw provider request/response bodies in telemetry.

### Stream and event model

Expose stable, user-readable phases: `understanding`, `planning`, `drafting`, `reviewing`, `repairing`, `proposing`, `completed`, `failed`, and `cancelled`. Internal role calls emit correlated start/end, token usage, provider, model, latency, and outcome events. Draft tokens do not need to stream directly into the conversation because they are not final user-facing chat text; the UI should show progress and stream the final concise response and proposals through the existing event path.

### Failure and recovery

- Schema failure: retry the same role once with a compact correction, then fail that stage.
- Ineligible or unavailable endpoint: retry only another prevalidated endpoint/profile; never loosen ZDR or moderation constraints.
- Prose worker failure: retry the individual job or offer the user the completed subset.
- Critic failure: deterministic hard checks still apply; disclose that semantic review did not complete and do not claim a fully reviewed result.
- Budget exhaustion: stop further repair, preserve successful drafts, and report unresolved findings.
- Cancellation: propagate one abort signal to active role calls and discard unsubmitted transient drafts.

### Model policy resolver

At health-check and run time, resolve the intersection of:

1. model role requirements;
2. live model capabilities;
3. endpoints present in OpenRouter's ZDR catalog;
4. endpoints/models reported as unmoderated under the project's explicit policy;
5. configured provider allowlist;
6. price and availability limits.

The request must still include `zdr: true`, data collection denied, `require_parameters: true` where applicable, and a resolved provider allowlist. Set `allow_fallbacks: false` when the request already pins the complete eligible endpoint set; otherwise prove that router fallback cannot escape the eligible intersection.

## 9. Implementation Plan

### Phase 0: Baseline and eval contract

**Purpose:** Measure the actual failures before changing runtime architecture.

**Scope:**

- [x] Create a versioned, content-safe eval corpus covering sparse premises, partial cards, focused edits, full-card creation, strict templates, examples, long conversations, and mature but policy-compliant creative themes.
- [ ] Capture current single-agent outputs, tokens, latency, tool outcomes, and user-visible proposals as the baseline.
- [x] Define field-specific rubrics for fidelity, completeness, specificity, roleplay usability, voice, format, coherence, and non-repetition.
- [x] Implement deterministic quality metrics for empty/short outputs, macro/template preservation, exact sentence reuse, and normalized n-gram overlap.
- [x] Define blinded pairwise human review and a ZDR/unmoderated model-judge protocol.
- [ ] Set provisional per-route latency and cost ceilings from baseline measurements rather than guesses.

**Exit criteria:**

- [x] At least 30 representative cases cover every requested route and the known brevity/duplication failures.
- [x] Baseline artifacts can be regenerated without storing API keys or logging prompt content.
- [x] The scorecard distinguishes useful depth from padded length.

**Can run in parallel:**

- Corpus authoring and deterministic metric design can proceed in parallel after the rubric is fixed.

**Must not start until:**

- Current prompt and proposal behavior is frozen as a named baseline revision.

### Phase 1: Provider policy and role-profile foundation

**Purpose:** Make the user's ZDR and unmoderated-only constraint enforceable before adding calls.

**Scope:**

- [x] Define schema-backed agent roles, capability requirements, role profiles, endpoint eligibility results, and explicit failure reasons.
- [x] Add a provider-policy resolver backed by the live ZDR endpoint catalog with a bounded cache of policy metadata only.
- [x] Require unmoderated eligibility and ZDR at health check and immediately before every remote role call.
- [x] Preserve per-request `zdr: true`, data collection denied, and parameter support requirements.
- [x] Add role-aware usage, cost, latency, model, provider, retry, and failure observability without content logging.
- [x] Add a settings view that shows why a profile is eligible or blocked and makes the privacy invariants non-disableable.

**Exit criteria:**

- [x] Tests prove no role call can be built for a retaining, data-collecting, moderated, or capability-incompatible endpoint.
- [x] Provider fallback cannot escape the eligible endpoint set.
- [x] Local KoboldCpp profiles are identified separately and do not make claims about third-party ZDR certification.

**Can run in parallel:**

- Role contracts and content-free observability event design may run in parallel.

**Must not start until:**

- Phase 0 defines the roles and metrics the profiles must support.

### Phase 2: Brief enrichment and adaptive clarification

**Purpose:** Give sparse prompts enough explicit substance for planning without silently rewriting user intent.

**Scope:**

- [x] Add the typed character-brief contract with provenance for user facts, card facts, reference-derived inspiration, and model assumptions.
- [x] Implement the cheap enricher profile using structured output only.
- [x] Classify gaps by impact and ask only questions that materially affect correctness or user intent.
- [x] Support a fast path when the prompt and current card already provide a sufficient brief.
- [x] Show a compact assumption summary before proposals and allow the user to revise it.
- [x] Bound enrichment to the requested focus so a one-field edit does not become a full redesign.

**Exit criteria:**

- [ ] Sparse eval prompts produce briefs that meet coverage thresholds without contradicting supplied facts.
- [x] High-impact invented facts are either labeled choices or require clarification.
- [x] Sufficient prompts do not incur an unnecessary enrichment call.

**Can run in parallel:**

- Brief presentation UI can proceed after the contract is stable.

**Must not start until:**

- Phase 1 can resolve an eligible structured-output profile.

### Phase 3: Content planning and prose workers

**Purpose:** Separate information architecture from writing and tool use.

**Scope:**

- [x] Implement the typed content plan and ownership ledger.
- [x] Define field responsibilities, allowed echoes, forbidden restatements, relevant context slices, and depth targets.
- [x] Split prose jobs by semantic coupling: description/personality, scenario, greetings, example dialogue, and other independent field groups as requested.
- [x] Run independent jobs concurrently only when their content ownership is settled and neither consumes the other's output.
- [x] Give prose workers no tools and accept raw text or minimal field-key envelopes.
- [x] Preserve strict template rendering, macros, and existing focused-edit boundaries.
- [x] Submit successful drafts through the existing proposal action handlers only after quality checks.

**Exit criteria:**

- [x] Every proposed passage traces to a field job and content-plan entry.
- [x] Prose workers cannot mutate state or call proposal tools.
- [x] Focused edits take the reduced path.
- [x] Aborted or failed jobs do not create partial live proposals.

**Can run in parallel:**

- Prose prompt/profile experiments can run against the Phase 0 harness while orchestration contracts are implemented.

**Must not start until:**

- Phase 2 produces a stable brief contract and Phase 1 enforces role eligibility.

### Phase 4: Quality gate and bounded repair

**Purpose:** Reject thin or repetitive drafts before they reach the user.

**Scope:**

- [x] Run deterministic field and cross-field checks without mandatory critic inference.
- [x] Keep subjective quality review user-owned through the existing proposal UI.
- [x] Compare drafts against the brief, content plan, current card, templates, and other proposed fields.
- [x] Add a maximum of two targeted repair passes per failing field group.
- [x] Preserve passing fields and measure whether each repair actually improves the failed dimensions.
- [x] Surface unresolved findings with the proposal instead of looping or hiding them.

**Exit criteria:**

- [x] Known duplicated fixtures are caught by deterministic checks.
- [x] Known concise-but-complete fixtures are not rejected solely for length.
- [x] Repair cannot exceed configured call, token, latency, or cost budgets.
- [x] A failed repair has an explicit recoverable user state.

**Can run in parallel:**

- Deterministic detectors and repair behavior can be evaluated independently against the fixed corpus.

**Must not start until:**

- Phase 3 emits stable draft and plan artifacts.

### Phase 5: Model tournament and defaults

**Purpose:** Choose role models using evidence rather than a single global preference.

**Scope:**

- [x] Refresh the live ZDR/unmoderated candidate set and record the catalog timestamp.
- [ ] Evaluate at least three eligible structured candidates for router/enricher/content-planner duties and at least three eligible prose candidates.
- [ ] Include the current user-selected model and local KoboldCpp when they satisfy the role contract.
- [ ] Compare single-model, two-model, and role-specialized configurations.
- [ ] Score quality, refusal rate, schema/tool reliability, duplication, fidelity, latency, and total cost per successful run.
- [ ] Define `Economy`, `Balanced`, and `Quality` profiles only when each has enough evidence; all share the same immutable privacy policy.

**Exit criteria:**

- [ ] Selected defaults beat the baseline on the primary quality score and both reported pain points.
- [ ] No selected profile has a policy violation in the test matrix.
- [ ] The chosen profile's p95 cost and latency are within accepted budgets.
- [x] Model/provider IDs remain replaceable configuration, not branching application logic.

**Can run in parallel:**

- Candidate runs can be parallelized within a declared spend cap and provider rate limits.

**Must not start until:**

- Phases 0 through 4 provide the complete comparable pipeline.

### Phase 6: Product integration and replacement rollout

**Purpose:** Make the improved path understandable, interruptible, and the only maintained assistant architecture.

**Scope:**

- [x] Add phase progress, cancellation, assumption review, quality-warning, and partial-failure presentation to the assistant UI.
- [x] Add a simple generation-budget profile selector without exposing internal graph complexity by default.
- [ ] Run the new pipeline behind a temporary development-only comparison switch.
- [ ] Complete manual QA and eval acceptance gates.
- [ ] Replace the old assistant runtime and remove the temporary comparison switch, obsolete mode branches, prompts, and tests.
- [ ] Update the parent feature roadmap and record final model-role profiles and verification evidence.

**Exit criteria:**

- [x] Users can understand what stage is active and cancel the full run.
- [x] Existing proposal accept/reject behavior is unchanged.
- [ ] The single-agent generation path is removed after verification.
- [ ] Type checks, lint, tests, build, manual QA, and AI eval gates pass.

**Can run in parallel:**

- UI progress states and migration inventory can proceed once event contracts are stable.

**Must not start until:**

- Phase 5 selects passing defaults and rollback criteria.

## 10. Acceptance Criteria

### Product behavior

- [ ] Sparse ideas produce materially richer proposals than the baseline without forced verbosity.
- [ ] Multi-field runs meet the accepted cross-field duplication thresholds.
- [x] Focused edits remain focused and use the reduced pipeline.
- [x] Advice-only turns do not invoke the drafting pipeline.
- [x] High-impact assumptions are reviewable or clarified before drafting.

### API and contracts

- [x] Every control-plane output is schema validated.
- [x] Role profiles declare capabilities and budgets without making privacy invariants configurable.
- [x] Prose workers have no tools or mutation authority.
- [x] Existing proposal actions remain the only route to reviewable edits.

### Persistence

- [x] Saved role/quality preferences use existing local-first storage patterns.
- [x] Transient briefs, plans, drafts, and findings are cleaned up on completion or cancellation unless explicitly saved by the user.
- [x] Server logs and telemetry contain no card or prompt content.

### UI and UX

- [x] The user sees stable progress phases, cancellation, and actionable recovery states.
- [x] Assumptions and unresolved quality warnings are concise and distinguishable from confirmed facts.
- [x] Advanced role/model settings do not overwhelm the default connection workflow.

### Testing

- [x] Unit tests cover contracts, policy resolution, deterministic quality rules, budgets, and repair limits.
- [x] Integration tests cover orchestration state transitions, tool boundaries, partial failures, cancellation, and proposal submission.
- [x] The versioned eval corpus covers at least 30 cases and every known failure class.
- [ ] The selected profiles beat the frozen baseline under blinded review and automated gates.

### Observability

- [x] One run ID correlates every role call, quality check, repair, and proposal action.
- [x] Tokens, cost, latency, model, endpoint provider, retries, and content-free deterministic findings are recorded per role/run.
- [x] Privacy or moderation eligibility failures have distinct safe error categories.

### Documentation

- [x] The parent character-creator roadmap points to this roadmap for agent quality work.
- [ ] Selected model-role profiles record catalog date, eval revision, prices, and rationale.
- [ ] Verification evidence and rollout decision are recorded in this roadmap.

### Rollout

- [ ] Development comparison data is collected before replacement.
- [ ] The legacy single-agent path and temporary comparison flag are removed after acceptance.
- [ ] A rollback reverts the release rather than maintaining two architectures indefinitely.

## 11. Verification Plan

### Unit and integration validation

- Validate every schema with valid, invalid, oversized, and missing-field fixtures.
- Test the provider-policy resolver using frozen catalog fixtures for ZDR, moderation, capability, fallback, and stale-cache cases.
- Test deterministic repetition rules on exact duplicates, paraphrases outside deterministic scope, intentional names/macros, and valid motif echoes.
- Test budgets across role calls and repair passes.
- Test the workflow state machine for success, advice fast path, clarification pause/resume, partial worker failure, repair failure, cancellation, and proposal-handler failure.
- Assert that no model role receives application tools, proposal submission stays application-owned, and proposal acceptance remains user-owned.

### AI evals

The eval runner must record prompt-case ID, pipeline revision, role profiles, provider endpoints, seeds where supported, parameters, usage, cost, latency, findings, and final scores. Content stays in the local eval artifact and is excluded from application logs.

Primary eval slices:

- one-line premise with no name;
- two concepts with conflicting implications;
- partial card with one rich field and several empty fields;
- full-card creation from discovery selections;
- focused personality, scenario, greeting, and example-dialogue edits;
- strict templates and macros;
- example-character references with explicit non-copying requirements;
- long conversations with accepted and rejected prior proposals;
- mature creative requests used to measure refusal behavior on otherwise allowed content;
- adversarial repetition cases where the same fact is tempting in every field.

Primary scorecard:

| Dimension            | Method                                                            | Gate                                                         |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| User-intent fidelity | Human pairwise plus structured judge                              | No regression from baseline; no contradicted confirmed facts |
| Useful depth         | Field rubric, information-unit count, human review                | Material win over baseline on sparse cases                   |
| Cross-field novelty  | Exact sentence and normalized n-gram metrics plus blinded human review | Material reduction in unintentional repetition             |
| Coherence            | Structured judge plus human review                                | No regression while novelty improves                         |
| Roleplay usability   | Human rubric for greetings/examples                               | Material win on relevant fields                              |
| Refusal behavior     | Allowed-content regression set                                    | No unexplained refusals from selected profiles               |
| Control reliability  | Schema success, tool success, bounded retries                     | Meets declared profile threshold                             |
| Efficiency           | Total cost, calls, tokens, wall time per successful run           | Within route-specific budgets                                |

Judge scores cannot be the sole acceptance signal. Use blinded human pairwise review for a statistically useful subset, rotate presentation order, and review disagreements between deterministic metrics, the judge, and humans.

### Repository validation

- Run targeted Vitest suites while implementing each phase.
- Run `pnpm run check-types` and `pnpm run lint` after code changes.
- Run `pnpm run test` and `pnpm run build` once for final handoff.
- Search for direct provider calls that bypass the policy resolver and for obsolete single-agent runtime branches.

### Manual QA

1. Configure an eligible OpenRouter profile and verify the UI explains its role capabilities and enforced policy.
2. Submit a one-line character premise and inspect the assumption summary.
3. Generate a multi-field card; verify progress phases, proposals, field depth, and low repetition.
4. Cancel during drafting and confirm no proposal is submitted from discarded work.
5. Force an ineligible provider route and confirm the run fails without fallback.
6. Force one worker and one repair failure and verify targeted recovery states.
7. Accept and reject proposals and confirm existing card/session behavior remains correct.

### Verification evidence: 2026-08-21 implementation checkpoint

- Atomic implementation commits: `86a3b6c`, `9e09e63`, `e6b28b4`, `b486f65`, `0b1c743`, `6827b30`, `ec31c31`, and `5f387f3`.
- Focused orchestration and proposal validation passed 33 tests, including policy enforcement, cache expiry, budgets, brief and plan invariants, tool-free prose, repair limits, partial failure, cancellation, advice routing, and proposal submission.
- Root `pnpm run check-types` and `pnpm run lint` passed on the finalized implementation tree.
- Root `pnpm run test` passed 73 files and 331 tests, including separate/combined field writing, transient-only retries, retry exhaustion, cancellation, and aggregate retry usage accounting.
- Root `pnpm run build` passed for client and SSR bundles. The existing large-chunk warning remains non-blocking and is not specific to this roadmap.
- Manual rendered-UI QA confirmed the generation-budget selector, immutable privacy copy, assistant cancellation control, and unchanged editor/proposal surfaces. No live inference was triggered because doing so would transmit the locally stored API key and incur provider charges without action-time approval.
- Public OpenRouter model and ZDR catalogs were refreshed without credentials. The candidate set above remained policy-eligible by catalog metadata; catalog flags are not quality evidence.
- `pnpm --filter web run eval:agent -- <profiles.json> <output.json>` now dispatches the frozen single-agent revision or replaceable orchestrated profiles across the versioned corpus, captures user-visible proposals and exact orchestrated cost, derives baseline route budgets, and writes schema-validated artifacts. Credentials are accepted only from `TENZO_AGENT_EVAL_API_KEY` and are excluded from output.
- Schema-validated baseline and 12-case screening configurations pin the refreshed provider slugs and prices. The screening matrix covers the current Euryale model, three structured candidates, three prose candidates, and single-model, two-model, and role-specialized layouts. Local KoboldCpp was probed and omitted because no endpoint was available.
- `pnpm --filter web run eval:agent:review -- prepare ...` creates separately stored randomized public ballots and a private identity key; the `score` mode enforces three distinct reviewers per comparison and aggregates blinded overall and per-dimension decisions.
- Content-free metrics now correlate role calls, deterministic finding counts, targeted repairs, aggregate usage, retry counts, and proposal submission under one run ID.
- Users can persist `Separate call per field` (the default) or `One combined call`. Separate mode prevents larger fields from crowding out smaller ones; combined mode reduces requests and repeated context.
- TanStack Pacer now caps model-call concurrency at two and retries only transient network, timeout, HTTP 408/409/425/429, and 5xx failures up to three attempts with exponential backoff, jitter, `Retry-After` support, cancellation, and aggregate usage accounting.
- The live assistant mode selector and persisted mode setting were removed. Native-tool and structured single-agent execution remain reachable only from the frozen baseline evaluator until comparison evidence is captured, after which those files can be deleted.
- Open gates: baseline capture, paid candidate runs, blinded review, profile selection, live policy/manual failure scenarios, and removal of the unused legacy runtime after acceptance.

### Trace expectations

A successful edit trace contains: route decision, optional enrichment, content plan, one or more prose jobs, deterministic check summary, optional repair, proposal actions, final response, and aggregate usage. A trace contains hashes/counts and safe identifiers where needed, never raw content or hidden reasoning.

## 12. Rollout And Migration

1. Build and evaluate the new workflow without changing the default user path.
2. Use a development-only comparison flag to run baseline and candidate paths on the local eval corpus. Do not double-run ordinary user requests.
3. Promote one evidence-backed profile as the default when all policy and quality gates pass.
4. Replace the single-agent runtime in one release checkpoint while preserving the external message, stream, and proposal behavior required by the UI.
5. Remove the old runtime, obsolete generation-mode UI, temporary flag, duplicate prompt code, and tests that only support the removed path.
6. If a critical regression appears, revert the release checkpoint. Do not keep permanent dual execution or compatibility adapters.

Provider model availability and prices are expected to change. Refresh eligible role profiles through the policy resolver and repeat the focused eval tournament when a selected model or compliant endpoint disappears. Runtime fallback may use only pre-evaluated eligible profiles.

## 13. Risks And Mitigations

| Risk                                             | Impact                                        | Mitigation                                                                                                               | Owner                 |
| ------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| More calls increase latency and cost             | Richer output feels slow or expensive         | Advice/focused fast paths, cheap enricher, parallel independent prose jobs, hard budgets, targeted repair only           | Agent runtime owner   |
| Extra stages amplify invented details            | Polished output drifts from the premise       | Provenance-tagged brief, high-impact clarification, fidelity rubric, user-visible assumptions                            | Prompt/eval owner     |
| “Uncensored” is ambiguous or changes by provider | Policy expectation is violated                | Define an explicit catalog-backed eligibility rule, pin eligible providers per request, refresh at run time, fail closed | Provider-policy owner |
| ZDR endpoint disappears mid-run                  | Partial pipeline failure                      | Resolve before each call, use only prevalidated eligible alternatives, preserve successful transient drafts              | Provider-policy owner |
| Prose workers develop inconsistent voice         | Card fields feel authored by different models | Shared style bible, user-selectable combined writing, and one selected prose profile per run                              | Prose-quality owner   |
| Anti-duplication removes intentional motifs      | Voice and thematic cohesion weaken            | Allow named motifs/echoes in the content plan and exclude names/macros from naive metrics                                | Quality-gate owner    |
| Repair loops consume budget without improvement  | Run becomes costly or never completes         | Two-pass maximum, compare failed metrics after each repair, expose unresolved findings                                   | Orchestration owner   |
| Model judge favors its own style                 | False quality confidence                      | Deterministic metrics, blinded human pairwise review, multiple judge challengers during selection                        | Eval owner            |
| Catalog metadata is stale or incomplete          | Ineligible traffic is routed                  | Combine live catalog eligibility with per-request enforcement and provider allowlists; fail on uncertainty               | Provider-policy owner |
| Parallel workers repeat each other               | Duplication survives despite decomposition    | Finalize ownership ledger first; parallelize only independent jobs; always run cross-field checks after assembly         | Orchestration owner   |
| Observability captures sensitive prose           | Local creative content leaks into logs        | Content-free events, centralized redaction, tests for forbidden fields, no raw provider payload logging                  | Observability owner   |

## 14. Decisions, Deferrals, And Superseded Work

### Implementation conversation record: simplify the runtime

**Status:** accepted product direction
**Date:** 2026-08-23
**Source:** User review of the implemented orchestration flow during this roadmap

The initial design was judged too call-heavy for ordinary use. The user explicitly retained the planning and enrichment value, allowed a narrowly targeted repair worker, and rejected mandatory model-based quality judgment. Reviewers should assess the implementation against the accepted scope below rather than the earlier five-role topology.

| Initial direction | Accepted direction | Product reason |
| --- | --- | --- |
| Always decompose multi-field writing into worker jobs, including coupled groups | Default to one isolated call per field and provide a persisted `One combined call` option | Isolated calls prevent one field from consuming the attention or output budget needed by another; combined mode lets the user trade some isolation for fewer requests and less repeated context |
| Run a structured critic on every assembled draft and again after repairs | Do not run a model critic in the live path; present proposals for user judgment | Subjective grading spends tokens without replacing the user's taste, and repeated critic calls multiply latency and rate-limit exposure |
| Repair deterministic and subjective findings | Invoke the prose repair worker only for objective blocking violations such as missing required macros or strict-template failures | Repair remains useful for concrete correctness failures without creating a self-grading generation loop |
| Present `Economy`, `Balanced`, and `Quality` as quality/cost choices | Present generation-budget choices as `Economy`, `Balanced`, and `Expanded` | The setting controls bounded resources, not a promise that the application can decide prose quality for the user |
| Allow independent prose jobs to fan out without a centralized provider-pressure control | Pace all model calls through a shared concurrency cap and retry only transient failures | Separate-field mode can create bursts; bounded queuing plus retry/backoff handles 429 and temporary provider failures without retrying policy, schema, budget, or cancellation errors |

The resulting live path is: route intent, enrich only when the brief is sparse, create one ownership plan, write using the selected field-call strategy, run deterministic safeguards, repair only blocking violations when necessary, and submit one reviewable proposal. No additional critic, scorer, judge, or autonomous intermediary is part of the runtime.

### Decision: Keep subjective quality user-owned

**Status:** accepted
**Date:** 2026-08-23
**Rationale:** Character prose quality is taste-dependent. A mandatory model critic adds calls, latency, and cost while still requiring user review.
**Effect on roadmap:** The runtime critic and critic-unavailable recovery branch are removed. Deterministic warnings remain visible, and offline blinded evaluation may still use judges as research evidence rather than as a production gate.

### Decision: Keep application tools out of model roles

**Status:** accepted
**Date:** 2026-08-23
**Rationale:** The planner only needs structured output. Requiring native tool calling narrowed eligible models without adding runtime value, while proposal submission is safer and cheaper as deterministic application code.
**Effect on roadmap:** Router, enricher, content-planner, and prose roles have no application tools. The content planner requires structured output but not tool calling; the application service remains the sole proposal submitter.

### Decision: Remove the obsolete live assistant execution-mode setting

**Status:** accepted
**Date:** 2026-08-23
**Rationale:** The production API has one application-owned orchestration path. Offering “structured loop” and “tool calls” implied two live runtimes and could incorrectly block an otherwise eligible structured-output model for lacking tool calling.
**Effect on roadmap:** The setting, preset field, request property, compatibility branch, and UI selector are removed. Tool capability remains in provider metadata only to support the frozen baseline comparison before legacy deletion.

### Decision: Make field-call granularity explicit

**Status:** accepted
**Date:** 2026-08-23
**Rationale:** A combined prompt can under-generate smaller fields because fields compete for context and output attention. Separate calls cost more but give each field an isolated budget.
**Effect on roadmap:** `Separate call per field` is persisted as the default. `One combined call` is an explicit user-selectable efficiency mode, and both paths use the same content plan and proposal boundary.

### Decision: Centralize provider-pressure handling with TanStack Pacer

**Status:** accepted
**Date:** 2026-08-23
**Rationale:** Per-field requests can arrive in bursts and providers can respond with temporary network or rate-limit failures. Unbounded retries would amplify both spend and load.
**Effect on roadmap:** Model calls share a concurrency limit of two. HTTP 408/409/425/429/5xx and recognized transient network failures receive at most three attempts with exponential backoff, jitter, bounded `Retry-After`, cancellation, content-free retry telemetry, and aggregate usage accounting. All other failures are attempted once.

### Decision: Use a fixed role pipeline, not autonomous agent spawning

**Status:** accepted
**Date:** 2026-08-20
**Rationale:** The failure is predictable task interference, not lack of autonomy. A fixed workflow is cheaper, testable, bounded, and easier to secure.
**Effect on roadmap:** Roles and transitions are application-owned; no recursive or user-defined agent graph is added.

### Decision: Separate prose workers from tool authority

**Status:** accepted
**Date:** 2026-08-20
**Rationale:** Tool/schema obligations consume attention and bias models toward terse, easily validated values. Raw prose output lets a specialized writer spend its budget on the field while the orchestrator retains control.
**Effect on roadmap:** Prose workers receive no tools and cannot submit proposals directly.

### Decision: Treat enrichment as explicit brief construction

**Status:** accepted
**Date:** 2026-08-20
**Rationale:** A cheap enricher is useful only if it distinguishes user facts from creative assumptions and does not turn every sparse prompt into an interrogation.
**Effect on roadmap:** The brief has provenance and impact-ranked gaps; clarification is adaptive.

### Decision: Enforce ZDR and unmoderated eligibility as invariants

**Status:** accepted
**Date:** 2026-08-20
**Rationale:** Per-role configuration or fallback must not weaken the user's privacy and model-policy constraints.
**Effect on roadmap:** Eligibility is centralized, refreshed, fail-closed, and applied to every remote role call.

### Decision: Do not hardcode the model shortlist as product defaults

**Status:** accepted
**Date:** 2026-08-20
**Rationale:** Availability, endpoint policy, capability flags, prices, and model quality change. The research snapshot narrows experiments but cannot replace eval evidence.
**Effect on roadmap:** Phase 5 selects profiles; runtime logic depends on capabilities and roles rather than model-name branches.

### Decision: Replace the existing assistant path after validation

**Status:** accepted
**Date:** 2026-08-20
**Rationale:** Permanent dual runtimes would duplicate prompts, tests, bug fixes, and UX.
**Effect on roadmap:** Baseline comparison is development-only and temporary; rollout removes the old path.

### Deferral: Embedding-based semantic similarity

**Status:** deferred
**Date:** 2026-08-20
**Rationale:** Deterministic overlap plus blinded human review can establish whether semantic embeddings add enough value to justify another model, dependency, and policy surface.
**Effect on roadmap:** Add embeddings only in a follow-up if eval misses material paraphrased repetition.

### Deferral: Fine-tuning

**Status:** deferred
**Date:** 2026-08-20
**Rationale:** Decomposition, contracts, and evals should identify whether model behavior remains the limiting factor before training work begins.
**Effect on roadmap:** Fine-tuning is not part of core completion.

## 15. Archive Checklist

- [ ] Status is `Completed and aligned`, `Historical`, `Superseded on purpose`, or `Rejected`.
- [ ] Current repository state is accurate.
- [ ] Shipped implementation and selected role profiles are linked.
- [ ] Remaining work is moved to a new roadmap or explicitly deferred.
- [ ] Acceptance criteria are complete or intentionally narrowed.
- [ ] Baseline and final eval evidence is recorded.
- [ ] Privacy-policy verification is recorded.
- [ ] The roadmap reads as shipped history rather than active implementation guidance.

## 16. Changelog

| Date       | Change                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------- |
| 2026-08-23 | Made field-call granularity user-selectable, removed mandatory model criticism, and added Pacer-based concurrency and transient retry controls. |
| 2026-08-20 | Created the roadmap from a repository audit and current OpenRouter ZDR/model catalog research. |
