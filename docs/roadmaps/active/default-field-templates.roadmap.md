---
title: "Default Field Templates & Assistant Template Enforcement"
slug: "default-field-templates"
status: "Active backlog"
roadmap_type: "feature"
priority: "P2"
created: "2026-08-16"
updated: "2026-08-16"
last_repo_audit: "2026-08-16"
source_of_truth: true
related_docs:
  - "apps/web/src/features/character-creator/constants/default-field-templates.ts"
  - "apps/web/src/features/character-creator/lib/cards/field-templates.ts"
  - "apps/web/src/features/character-creator/lib/assistant/character-assistant-runtime.server.ts"
supersedes: []
superseded_by: null
archive_when:
  - "Every core prose field has a built-in default template applied when no user template is configured."
  - "Field generation and the AI Assistant resolve the same effective template for a field."
  - "Strict-mode templates are enforced on assistant field proposals, not just suggested."
  - "Verification evidence is recorded."
---

# Default Field Templates & Assistant Template Enforcement

> Status: Active backlog
> Current summary: The assistant/field-generation parity work made the assistant consume reference characters, field format guidance, and templates bound via `fieldTemplateIds` (auto-attached for focused fields, all bound `field:*` templates on card focus, merged with `/`-mentioned chat templates from the tiptap composer). This roadmap closes the remaining template gaps: fields with no configured template get nothing, built-in templates only cover 3 of 5 core prose fields, and strict-mode skeletons are only *suggested* to the assistant while field generation *enforces* them via `renderStrictTemplate`.

## 1. Problem

- A fresh install produces unstructured output for every field until the user manually assigns templates per field — the built-in templates (`BUILT_IN_FIELD_TEMPLATES`) exist but are opt-in only.
- `scenario` and `mes_example` have no built-in template at all, so even a motivated user cannot get structured defaults there.
- The assistant receives strict templates as prose instructions ("Reproduce this skeleton exactly"), but nothing validates the proposed value. Field generation parses `{{gen:label}}` slots and deterministically rebuilds the skeleton (`parseSlotResponse` + `renderStrictTemplate`); the assistant can silently drift from the skeleton.
- Template resolution logic is duplicated: `use-character-creator-page.resolveFieldTemplate` (field generation) and `character-assistant-context.focusTemplates` (assistant) each read `fieldTemplateIds` independently. Defaults added in only one place would reintroduce output-quality divergence.

## 2. Design Decisions (settle before Phase 1)

1. **Default-on vs default-off.** Proposal: `shouldUseDefaultFieldTemplates: boolean` in `CHARACTER_GENERATION_PROMPT_SETTINGS_SCHEMA`, default `true`. New users get structured output immediately; existing users see a behavior change that is visible and reversible in settings.
2. **Per-field opt-out sentinel.** Today "no template" is the *absence* of a `fieldTemplateIds` entry, which cannot be distinguished from "never chose one". Introduce a schema-backed sentinel (e.g. `FIELD_TEMPLATE_SELECTION_NONE = 'none'` via a `z.enum`-style constant, per project standards) stored in `fieldTemplateIds` so a user can explicitly clear a default for one field.
3. **Enforcement failure mode.** When an assistant proposal violates a strict skeleton: reject the tool call with a descriptive error (model retries within the existing bounded loop) rather than silently re-rendering. Re-rendering hides model failure and can fabricate slot values.

## 3. Phases

### Phase 1 — Complete the built-in template catalog

- [ ] Add `built-in:keyed-scenario` (prompt mode, `scenario`): setting/situation keyed list — location, time, circumstances, stakes, constraint on what has *not* happened yet.
- [ ] Add `built-in:start-block-dialogue` (strict or prompt mode, `mes_example`): `<START>`-delimited exchange skeleton with `{{char}}:`/`{{user}}:` turns, aligned with `MES_EXAMPLE_FORMAT_GUIDANCE`.
- [ ] Export `DEFAULT_FIELD_TEMPLATE_IDS` from `constants/default-field-templates.ts`: target-key map (`field:description` → `built-in:structured-description`, `field:personality` → `built-in:trait-list-personality`, `field:first_mes` / `alternate-greeting` targets → `built-in:scene-opening-greeting`, plus the two new ones), `satisfies Record<string, string>`.

### Phase 2 — Single effective-template resolver

- [ ] New `lib/cards/field-template-resolution.ts`: `resolveEffectiveFieldTemplateId({ fieldTemplateIds, shouldUseDefaultFieldTemplates, targetKey })` — explicit selection wins, sentinel `none` yields `null`, otherwise fall back to `DEFAULT_FIELD_TEMPLATE_IDS` when defaults are enabled.
- [ ] Add `shouldUseDefaultFieldTemplates` to `CHARACTER_GENERATION_PROMPT_SETTINGS_SCHEMA` (+ default in `DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS`).
- [ ] Route `use-character-creator-page.resolveFieldTemplate` through the resolver (field generation path).
- [ ] Route `character-assistant-context.focusTemplates` through the resolver (assistant path) so both paths always agree; keep the `MAX_CHAT_TEMPLATE_REF_COUNT` cap and mention-templates-win merge order.

### Phase 3 — Strict-template enforcement for assistant proposals

- [ ] Server-side, in `propose_character_fields` handling (both tool-call and structured-action paths share `createProposalFromChanges` / action handlers): when a change's `fieldKey` is bound to an attached strict template, validate the proposed value reproduces the skeleton (reuse `TEMPLATE_SLOT_PATTERN`; compare non-slot segments, ignoring slot spans).
- [ ] On violation, throw the existing tool-error shape with the skeleton and the instruction to fill only `{{gen:label}}` slots — the bounded loop already surfaces tool errors back to the model for retry.
- [ ] Pass attached templates into the handler context (`character-assistant-tools.ts` currently has no template awareness); thread from `commonOptions` in `routes/api/character-assistant.ts`.

### Phase 4 — UI affordances

- [ ] Template pickers: show inherited default as "Default — <name>" with a distinct state from an explicit selection; explicit "None" option writes the sentinel.
- [ ] Settings dialog: toggle for `shouldUseDefaultFieldTemplates` next to the field-template section.
- [ ] Assistant panel: chip/indicator listing auto-attached templates for the current focus so users understand why output follows a skeleton;
- [ ] AI Assistant panel: add icons displaying what `/`-mention is (template or something else); format the `/` mentions to look similar to `{{user}}` or `{{char}}` tokens, so users can distinguish them from free-text content. Make sure that clicking on the template in such state opens up the template if it still exists (it may have been deleted; else display a placeholder with minimal information available).

### Phase 5 — Tests & validation

- [ ] Resolver unit tests: explicit > sentinel > default > none; defaults disabled.
- [ ] Runtime prompt test: default template appears in the assistant system prompt when no explicit selection exists.
- [ ] Enforcement tests: conforming strict value accepted; skeleton drift rejected with retryable error; prompt-mode templates never rejected.
- [ ] `pnpm run lint`, `pnpm run check-types`, `pnpm run test` clean; mark roadmap items complete.

## 4. Non-Goals

- Template marketplace/import-export of template packs.
- Auto-generating templates from reference characters.
- Applying default templates to custom fields or the character book.
