---
title: "Character Card Creator Web App"
slug: "character-card-creator"
status: "Active backlog"
roadmap_type: "feature-epic"
priority: "P1"
created: "2026-07-05"
updated: "2026-07-05"
last_repo_audit: "2026-07-05"
source_of_truth: true
related_docs:
  - "inspo/spec_v2.md"
  - "inspo/as-extension/src/generate.ts"
  - "inspo/chargen/README.md"
  - "inspo/characters/"
supersedes: []
superseded_by: null
archive_when:
  - "Users can create, edit, and export V2 character cards with AI assistance."
  - "Image embedding with PNG tEXt chunk works in-browser."
  - "All acceptance criteria are implemented or explicitly deferred with rationale."
  - "Verification evidence is recorded."
---

# Character Card Creator Web App

> Status: Active backlog
> Last repo audit: 2026-07-05
> Current summary: A standalone character card creation tool built within `apps/web` using TanStack Start, allowing users to create V2-spec character cards with AI-assisted field generation, custom fields, example-based prompting, and PNG image export with embedded JSON metadata. The repo's existing `achievements`/`badges`/`user`/`auth`/`dev-tools` features and the `apps/server` + `packages/shared` layers were scaffolding placeholders with no product behind them; this roadmap removes them so the repo becomes the character card creator, not a multi-feature app that happens to also have one.

## 1. Executive Summary

Build a web-based character card creator that allows users to author SillyTavern-compatible V2 character cards. The tool provides AI-assisted generation for each field (description, personality, scenario, first message, example dialogue), lets users supply example characters as reference material, supports custom user-defined fields, and exports cards as PNG images with embedded JSON metadata following the `chara_card_v2` spec.

The project lives entirely in `apps/web` leveraging TanStack Start server functions for AI proxy calls. The existing `apps/server` (Hono/oRPC/Mongoose/Better Auth) and `packages/shared` (oRPC contracts) packages, along with the placeholder `achievements`/`badges`/`user`/`auth`/`dev-tools` features in `apps/web` and the Mongo/Valkey docker services, are removed as part of this roadmap rather than left in place unused. There is no back-compat shim and no second app to maintain — the repo becomes a single TanStack Start application.

## 2. Problem / Opportunity

- **Pain point:** Creating high-quality character cards requires expertise in prompt engineering and understanding of the V2 spec format. Existing tools are either SillyTavern extensions (requiring ST installation) or basic HTML editors without AI assistance.
- **Who is affected:** Character card creators who want a standalone web tool with AI generation capabilities.
- **Why now:** The `as-extension` reference implementation proves the concept works; extracting it into a standalone web app makes it accessible without SillyTavern.
- **What breaks without this:** Users must manually author all fields or use the ST extension, limiting accessibility.
- **Secondary problem — repo scope:** The repo currently carries a full backend (`apps/server`) and shared contract package (`packages/shared`) plus five `apps/web` features (`achievements`, `badges`, `user`, `auth`, `dev-tools`) that are unimplemented placeholders with no real product requirement behind them. They add build/lint/typecheck surface, a MongoDB + Valkey docker dependency, and DI/auth scaffolding that every future contributor (human or agent) has to read past to find the one real feature. Carrying dead scaffolding forward makes the repo harder to reason about than deleting it and rebuilding a backend later if a real need for one ever appears.

## 3. Goals

1. Standalone web app for V2 character card creation (no ST dependency).
2. AI-assisted generation for every card field using user-provided API keys (OpenAI-compatible endpoints).
3. Users can provide example characters as context for generation.
4. Users can define custom fields beyond the V2 spec defaults.
5. Export as PNG with embedded JSON (V2 `chara` tEXt chunk) and standalone JSON.
6. Import existing character cards (PNG or JSON) for editing.
7. Client-side state persistence (localStorage/IndexedDB) so work isn't lost.
8. No dependency on `apps/server` or `packages/shared` — uses TanStack Start server functions for any server-side needs (API key proxying).
9. `apps/server`, `packages/shared`, and the placeholder `achievements`/`badges`/`user`/`auth`/`dev-tools` features are removed from the repo, along with their docker services (MongoDB, Valkey), routes, and root-level scripts that reference them.
10. The repo builds, typechecks, and lints clean as a single `apps/web` TanStack Start application with no dangling references to the removed packages/features.

## 4. Non-Goals

- Multi-user accounts or server-side persistence (no database).
- CharacterBook/Lorebook full editor (basic support only, not a lorebook management tool).
- V3 spec support (V2 only for now).
- Image generation (users upload their own images).
- Mobile-first design (desktop-first, responsive as stretch).
- SillyTavern integration or extension compatibility.
- Chat/roleplay testing within the tool.
- Rebuilding any removed feature (achievements, badges, user profiles, auth) in a new form — if a real need for accounts or a backend emerges later, that is a new roadmap with its own justification, not a revival of the deleted scaffolding.
- Preserving `apps/server`/`packages/shared` "just in case" behind a flag or partial removal — the standard's rollout rule is to fully replace, not maintain parallel versions.

## 5. Current Repository State

### `apps/web`
- **Stack:** React 19, TanStack Start (with `@tanstack/react-start`), TanStack Router, TanStack Query, TanStack Form, Tailwind CSS 4, Radix UI, Jotai, zod.
- **Routing:** File-based with `@tanstack/react-router`. Current routes: `(general)/`, `_auth_only/`, `__root.tsx`.
- **Features to remove (Phase 0):** `achievements/`, `auth/`, `badges/`, `dev-tools/`, `user/` and their routes (`(general)/_to_dashboard.*`, `_auth_only/*`, `_auth_only.tsx`) — placeholder scaffolding with no real product behind them, confirmed unrelated to character creation.
- **Server functions:** Already using `createServerFn` from `@tanstack/react-start` (see `themes/helpers.ts`) — this pattern is kept and reused for the LLM proxy.
- **oRPC client (`src/utils/orpc.ts`, `src/utils/tanstack-orpc.ts`):** Configured to talk to `apps/server`. Removed in Phase 0 along with the `@startername/shared` dependency once no route imports the achievements/badges/user features that use it.
- **TanStack DB (`src/db/`):** Already added (see `src/db/README.md`) — used for local-only/localStorage/IndexedDB-style collections, replacing what the oRPC+query-collection layer would have done against a server.
- **Build:** Vite + TanStack Start plugin, Tailwind via `@tailwindcss/vite`.

### `apps/server` and `packages/shared` — removed in Phase 0
- **Stack:** Hono + oRPC + Mongoose + tsyringe DI + Better Auth (`apps/server`); oRPC contracts/zod schemas/shared constants (`packages/shared`).
- **Status:** Existing features (achievements, badges, user, auth) are unimplemented placeholders unrelated to the character creator and are being deleted, not just left unused. Their removal also drops the MongoDB and Valkey docker services (`docker-compose.dev.yml`), `mongo/init-mongo.js`, and the `better-auth` patch (`patches/better-auth.patch`).
- **Do not extend or reuse these for the character creator** — they are being removed, not repurposed.

### Reference: `inspo/as-extension`
- React-based character creator as a SillyTavern extension.
- Key patterns: `CharacterField` component with generate/continue/clear/revise actions, session management, prompt building with Handlebars templates, XML/JSON output parsing, streaming support.
- Settings: connection profile selection, max tokens, output format (xml/json/none), context configuration.
- Uses `sillytavern-utils-lib` for ST integration — we replace this with direct OpenAI-compatible API calls.

### Reference: `inspo/chargen`
- Static HTML character editor at `chargen.kubes-lab.com`.
- UI inspiration for layout and field organization.

### Reference: `inspo/characters`
- Example V2 character cards in JSON format.
- Demonstrates real-world card structure: `data.name`, `data.description`, `data.personality`, `data.scenario`, `data.first_mes`, `data.mes_example`, `data.alternate_greetings`, `data.tags`, `data.character_book`, `data.extensions`.

### Reference: `inspo/spec_v2.md`
- Formal specification for the V2 format.
- TypeScript types for `TavernCardV2` and `CharacterBook`.

### Reference: `inspo/silly-tavern-server/src/character-card-parser.js`
- PNG embedding implementation: extracts `tEXt` chunks, encodes JSON as base64 into `chara` keyword chunk.
- Uses `png-chunks-extract` and `png-chunk-text` for reading; uses a local `png/encode.js` for re-encoding.
- **Important behavior to replicate:** before writing, it strips ALL existing `chara` AND `ccv3` chunks (case-insensitive) to avoid stale/mismatched metadata, then inserts the new `chara` chunk before `IEND`. On read, `ccv3` takes precedence over `chara` when both exist.
- Working binary example: `inspo/characters/main_fire-keeper_spec_v2.png` (import it to validate the extractor).

## 6. User Stories / Use Cases

### UC1: Create a New Character Card

**Actor:** Character creator
**Goal:** Build a complete V2 character card from scratch
**Current behavior:** Must use SillyTavern extension or manual JSON editing
**Target behavior:** Open web app, fill in fields (manually or with AI), export as PNG/JSON
**Acceptance criteria:**
- [ ] All V2 spec fields are editable (name, description, personality, scenario, first_mes, mes_example, alternate_greetings, tags, creator, creator_notes, system_prompt, post_history_instructions)
- [ ] Card can be saved/exported at any time
- [ ] Work persists in browser storage between sessions

### UC2: AI-Assisted Field Generation

**Actor:** Character creator
**Goal:** Use AI to generate or improve field content
**Current behavior:** Only available via ST extension with ST running
**Target behavior:** Enter API key, select model, click generate on any field with optional user instructions
**Acceptance criteria:**
- [ ] User can configure API endpoint and key (stored locally, never sent to our server)
- [ ] Each field has a "Generate" button that calls the LLM
- [ ] User can provide per-field instructions/prompts to guide generation
- [ ] Generation uses other filled fields as context
- [ ] Streaming response display

### UC3: Provide Example Characters for AI Context

**Actor:** Character creator
**Goal:** Use existing character cards as style/quality references for AI generation
**Current behavior:** ST extension allows selecting loaded characters
**Target behavior:** Upload or paste example character JSON/PNG files to include as context in prompts
**Acceptance criteria:**
- [ ] User can import 1+ example characters (JSON or PNG with embedded data)
- [ ] Imported examples are included in the generation prompt as reference material
- [ ] Examples are stored in session and can be removed

### UC4: Custom User Fields

**Actor:** Character creator
**Goal:** Add fields beyond the V2 spec for personal workflow
**Current behavior:** Not supported in most tools
**Target behavior:** User can add named custom fields, optionally include them in AI context, export them in `extensions` object
**Acceptance criteria:**
- [ ] "Add Field" button creates a named custom field
- [ ] Custom fields support AI generation
- [ ] Custom fields are exported under `data.extensions.custom_fields` in the JSON

### UC5: Image Upload and PNG Export

**Actor:** Character creator
**Goal:** Attach a character portrait and export as spec-compliant PNG
**Current behavior:** Requires ST or external tools for PNG embedding
**Target behavior:** Upload image, preview it, export PNG with JSON embedded as tEXt chunk
**Acceptance criteria:**
- [ ] Image upload (PNG/JPG/WebP) with preview
- [ ] Non-PNG images converted to PNG on export
- [ ] JSON data embedded as base64 in `chara` tEXt chunk
- [ ] Exported PNG is importable by SillyTavern and other V2-compatible tools
- [ ] Alternative: export JSON-only without image

### UC6: Import Existing Card for Editing

**Actor:** Character creator
**Goal:** Load an existing character card to edit or improve
**Current behavior:** N/A
**Target behavior:** Import PNG or JSON, populate all fields, edit and re-export
**Acceptance criteria:**
- [ ] Drag-and-drop or file picker for import
- [ ] Supports both V1 and V2 JSON structures
- [ ] Supports PNG with embedded `chara` tEXt chunk
- [ ] All imported fields populate the editor
- [ ] Unknown keys in `data.extensions` (card, character_book, and each book entry) survive import → edit → export untouched (spec MUST: "must never destroy unknown key-value pairs")
- [ ] Importing a PNG keeps the original image as the card portrait

## 7. Design Principles And Constraints

- **Client-first:** All state lives in the browser. No database, no accounts.
- **TanStack Start server functions:** Used ONLY as a stateless streaming proxy for LLM API calls (needed for most first-party providers due to CORS). API keys are stored in browser storage and sent per-request; the server never persists them. All PNG processing stays client-side.
- **No `apps/server` dependency:** This feature is self-contained in `apps/web`.
- **No `packages/shared` dependency:** Types and schemas defined locally within the feature.
- **V2 spec compliance:** Output MUST be valid `chara_card_v2` JSON. `extensions` MUST default to `{}` and unknown keys MUST be preserved on round-trip (card level, character_book level, and per book entry). Our own custom fields are namespaced under `data.extensions` to avoid conflicts.
- **Macro passthrough:** `{{char}}` and `{{user}}` placeholders are content conventions, not variables we render — the editor and prompt builder must pass them through verbatim (field hints should explain them).
- **OpenAI-compatible API:** Generation uses `/v1/chat/completions` endpoint format, supporting OpenAI, Anthropic (via proxy), local models, etc.
- **Accessibility:** Keyboard navigable, proper ARIA labels, screen reader compatible.
- **Feature-based structure:** All code under `apps/web/src/features/character-creator/`.

## 8. Target Architecture

```
apps/web/src/features/character-creator/
├── components/
│   ├── character-field.tsx          # Field editor with generate/clear/continue
│   ├── alternate-greetings.tsx      # Greeting list editor
│   ├── character-book-editor.tsx    # Basic lorebook editing
│   ├── image-upload.tsx             # Image upload + preview
│   ├── example-characters.tsx       # Example character import/manager
│   ├── custom-fields.tsx            # Custom field management
│   ├── api-settings.tsx             # API key/endpoint configuration
│   ├── export-dialog.tsx            # Export options (PNG/JSON)
│   └── import-dialog.tsx            # Import file picker
├── hooks/
│   ├── use-character-session.ts     # Session state (Jotai atoms)
│   ├── use-generation.ts            # AI generation logic + streaming
│   └── use-png-export.ts            # PNG embedding logic
├── lib/
│   ├── png-embed.ts                 # Client-side PNG tEXt chunk writer
│   ├── card-schema.ts               # Zod schema for V2 card validation
│   ├── prompt-builder.ts            # Prompt construction for generation
│   └── api-client.ts                # OpenAI-compatible fetch wrapper
├── constants/
│   ├── default-prompts.ts           # System prompts for field generation
│   └── field-config.ts              # Field metadata (labels, rows, hints)
├── types/
│   └── index.ts                     # Local type definitions
└── pages/
    └── index.tsx                    # Main editor page
```

### Route Structure
```
apps/web/src/routes/
└── index.tsx                         # Character creator IS the root route ("/")
```

With Phase 0 removing the `(general)`/`_auth_only` route groups and the starter landing page, there is no other page competing for `/`. No nested `character-creator` path or route group is needed.

### Data Flow
1. **State:** Jotai atoms for session data (character fields, settings, examples).
2. **Persistence:** Auto-save text/settings state to localStorage (debounced); store the uploaded portrait image and imported example cards in IndexedDB (base64 images in localStorage will blow the ~5MB quota).
3. **AI Generation:** TanStack Start server function proxies the request to the user's endpoint and streams the response back (SSE passthrough). The key travels per-request and is never persisted server-side. Direct browser fetch is offered as an option for CORS-friendly endpoints (OpenRouter, local models) to keep keys fully client-side.
4. **Export:** Client-side PNG manipulation using `png-chunk-text` + `png-chunks-extract` + `png-chunks-encode` (same stack as SillyTavern server).
5. **Import:** Client-side file reader → parse PNG chunks or JSON → populate atoms.

### Key Libraries (New Dependencies)
- `png-chunks-extract` — Extract PNG chunks
- `png-chunk-text` — Encode/decode tEXt chunks
- `png-chunks-encode` — Re-encode PNG from chunks (SillyTavern server vendors its own encoder in `src/png/encode.js`; if the npm package proves stale, vendor that file — it is tiny)

No IDAT decompression is needed: chunks are spliced without touching image data, so no `pako`/zlib dependency.

## 9. Implementation Plan

### Phase 0: Remove Placeholder Backend and Features

**Purpose:** Delete the unused `apps/server` backend, `packages/shared` contract package, and the placeholder `apps/web` features so the repo's real scope matches the character creator, before any character-creator code is added. Doing this first (not last) means Phases 1+ are never written against, or accidentally coupled to, code that is about to be deleted.
**Scope:**
- [ ] Delete `apps/server` entirely (Hono/oRPC/Mongoose/tsyringe/Better Auth backend, its tests, its Dockerfile if any)
- [ ] Delete `packages/shared` entirely (oRPC contracts, shared constants/enums/helpers)
- [ ] Delete `apps/web/src/features/{achievements,badges,user,auth,dev-tools}`
- [ ] Delete their routes: `apps/web/src/routes/_auth_only.tsx`, `apps/web/src/routes/_auth_only/*`, `apps/web/src/routes/(general)/_to_dashboard.*`
- [ ] Replace `apps/web/src/routes/index.tsx` — it is the starter-template landing page (dashboard/profile links, health-check/metrics widgets tied to `apps/server`), not a page to keep. Either delete it in Phase 0 (leaving the route empty until Phase 1 builds the real page) or replace its content directly with the character creator in Phase 1 — see Phase 1 note.
- [ ] Delete `apps/web/src/hooks/queries/use-health-check.ts` and `use-metrics.ts` (call `apps/server` endpoints that no longer exist)
- [ ] Delete `apps/web/src/utils/orpc.ts` and `apps/web/src/utils/tanstack-orpc.ts`, and the `router.tsx` context wiring that passes `tanstackRPC` (replace with just `queryClient` in router context)
- [ ] Remove `@startername/shared`, `@orpc/*`, `axios`, `better-auth` from `apps/web/package.json` (re-check each against actual remaining usage before removing — don't remove a dep still used by a kept file)
- [ ] Remove `mongo`, `valkey` services from `docker-compose.dev.yml`; delete `docker-compose.dev.yml` if nothing else needs it; delete `mongo/init-mongo.js` and the `mongo/` directory
- [ ] Delete `patches/better-auth.patch` and its `pnpm-workspace.yaml` `patchedDependencies` entry
- [ ] Update `.moon/workspace.yml` to remove the `server` and `shared` project entries
- [ ] Update root `package.json` scripts: remove `dev:server`, `build:deps` (or repoint if something else needs `shared:build`), and simplify `dev` if it no longer needs `docker compose up` (re-check once AI proxy needs, if any, are confirmed to need no local service)
- [ ] Update `.github/workflows/pull-request.yml` and `copilot-setup-steps.yml` to drop any MongoDB/server setup steps
- [ ] Update `apps/web/moon.yml` to drop `dependsOn: ['shared']` and the `shared:build` deps on `build`/`check-types`/`lint`
- [ ] Grep the repo for `@startername/shared`, `apps/server`, `orpc`, `tanstackRPC` after deletion to confirm no dangling imports remain

**Exit criteria:**
- [ ] `apps/server` and `packages/shared` directories no longer exist
- [ ] `pnpm install` succeeds with no dangling workspace references
- [ ] `pnpm run check-types`, `pnpm run lint`, and `pnpm run build` succeed for the (now single) `apps/web` project
- [ ] `apps/web` has no imports from `@startername/shared` or any removed feature
- [ ] Root README and `docs/roadmaps/roadmap-audit.md` no longer describe a multi-app / backend architecture
- [ ] `docker-compose.dev.yml` either no longer exists or starts nothing the app needs to run

**Must not start until:**
- Nothing — this is the first phase and blocks all others.

### Phase 1: Foundation and Card Editing

**Purpose:** Establish the feature structure, V2 schema, and manual card editing without AI.
**Scope:**
- [ ] Create feature directory structure under `apps/web/src/features/character-creator/`
- [ ] Define zod schema for V2 card (`card-schema.ts`)
- [ ] Define field configuration (labels, default prompts, metadata)
- [ ] Make the character creator the root route (`apps/web/src/routes/index.tsx`) — with the placeholder landing page and dashboard/profile routes removed in Phase 0, there is no reason for the tool to live at a nested `/character-creator` path instead of `/`
- [ ] Implement character field editor component (textarea + label)
- [ ] Implement all core V2 fields: name, description, personality, scenario, first_mes, mes_example
- [ ] Implement alternate greetings editor (add/remove/reorder)
- [ ] Implement metadata fields: tags, creator, creator_notes, character_version
- [ ] Implement system_prompt and post_history_instructions fields
- [ ] Implement Jotai-based session state with localStorage persistence
- [ ] Implement custom field add/remove/edit

**Exit criteria:**
- [ ] User can manually create a complete V2 character card
- [ ] State persists across page reloads
- [ ] Custom fields can be added and edited
- [ ] All V2 spec fields are represented

**Must not start until:**
- Phase 0 cleanup is complete (repo builds/typechecks/lints clean with `apps/server` and `packages/shared` removed)

### Phase 2: Import and Export

**Purpose:** Enable card import/export in both JSON and PNG-with-embedded-JSON formats.
**Scope:**
- [ ] Install and configure PNG manipulation libraries
- [ ] Implement client-side PNG tEXt chunk writer (`png-embed.ts`)
- [ ] Implement image upload with preview (PNG/JPG/WebP)
- [ ] Implement JSON export (download as `.json` file)
- [ ] Implement PNG export (embed JSON in image, download as `.png`)
- [ ] Implement import from JSON file (V1 and V2 detection)
- [ ] Implement import from PNG file (extract `chara` tEXt chunk)
- [ ] Drag-and-drop support for import
- [ ] Non-PNG image conversion to PNG via canvas before export (note: canvas re-encoding discards any pre-existing chunks — always run conversion BEFORE embedding the `chara` chunk)
- [ ] On export, strip any existing `chara`/`ccv3` chunks (case-insensitive) before inserting the fresh `chara` chunk ahead of `IEND` (mirrors `character-card-parser.js`)
- [ ] Preserve unknown `extensions` keys through the import → export round-trip (card, character_book, and book entries)
- [ ] Store portrait and example images in IndexedDB, not localStorage

**Exit criteria:**
- [ ] Exported PNG is importable by SillyTavern (verified manually; `inspo/silly-tavern-server` can be run locally for this)
- [ ] `inspo/characters/main_fire-keeper_spec_v2.png` imports correctly and re-exports with a single valid `chara` chunk
- [ ] Exported JSON matches V2 spec shape
- [ ] Import correctly populates all fields from V1 and V2 cards
- [ ] Unknown `extensions` data survives a full round-trip byte-for-byte (JSON-equal)
- [ ] Image preview displays uploaded image

**Must not start until:**
- Phase 1 field editing is functional

### Phase 3: AI Generation

**Purpose:** Add AI-assisted content generation for each character field.
**Scope:**
- [ ] Implement API settings panel (endpoint URL, API key, model name, max tokens)
- [ ] Store API settings in localStorage (keys encrypted or at minimum not plaintext — warn user about security)
- [ ] Implement OpenAI-compatible chat completions client (`api-client.ts`)
- [ ] Implement prompt builder that assembles context from filled fields + custom fields + user instructions + examples (port the structure of as-extension's `DEFAULT_TASK_DESCRIPTION` / `DEFAULT_EXISTING_FIELDS_DEFINITION` templates; the "character card writing guide" system prompt in `constants.ts` is a proven default worth reusing)
- [ ] Implement output-format modes (`xml` / `json` / `none`) and a response parser that unwraps `<response>` tags or `{"response": ...}` JSON, strips preamble/code fences (port of as-extension `parsers.ts`) — smaller models fail without a structured format
- [ ] Implement per-field generation with streaming response display
- [ ] Implement "Continue" action (append to existing content)
- [ ] Support generating individual alternate greetings, not just core fields
- [ ] Implement per-field user instructions (small textarea above each field)
- [ ] Handle errors gracefully (network, auth, rate limit) + cancel button for in-flight generation
- [ ] Implement TanStack Start server function as CORS proxy with streaming passthrough (expect this to be the DEFAULT path for major providers — api.openai.com and most first-party APIs do not send CORS headers for browser calls; direct browser fetch works mainly for OpenRouter and local endpoints)

**Exit criteria:**
- [ ] User can generate content for any field using their own API key
- [ ] Streaming text appears progressively in the field
- [ ] Generated content respects context from other filled fields
- [ ] Per-field instructions modify generation output
- [ ] Error states are displayed clearly

**Must not start until:**
- Phase 1 is complete (need fields to generate into)

### Phase 4: Example Characters as Context

**Purpose:** Allow users to upload reference characters that inform AI generation.
**Scope:**
- [ ] Implement example character import (reuse import logic from Phase 2)
- [ ] Implement example character list UI (show name, allow remove)
- [ ] Integrate examples into prompt builder (include relevant fields as context)
- [ ] Allow user to select which example fields to include in context
- [ ] Limit context size (token counting or character counting with warning)

**Exit criteria:**
- [ ] User can load 1-5 example characters
- [ ] Examples appear in generation prompts
- [ ] Generation quality noticeably improves with good examples
- [ ] Context overflow is handled (truncation with warning)

**Can run in parallel:**
- Can start after Phase 3 prompt builder exists

**Must not start until:**
- Phase 3 API client and prompt builder are functional

### Phase 5: Polish and UX

**Purpose:** Improve usability, accessibility, and overall experience.
**Scope:**
- [ ] Keyboard shortcuts (Ctrl+G to generate, Ctrl+S to save/export)
- [ ] Toast notifications for save/export/import success/failure
- [ ] Session management (new card, load previous sessions)
- [ ] Character preview panel (rendered card view)
- [ ] Basic CharacterBook editor (add/remove entries with keys + content)
- [ ] Responsive layout improvements
- [ ] Accessibility audit (ARIA, focus management, contrast)
- [ ] Loading/generating states with proper indicators

**Exit criteria:**
- [ ] Tool is usable end-to-end without confusion
- [ ] Accessibility meets WCAG 2.1 AA
- [ ] Multiple sessions can be managed

**Must not start until:**
- Phases 1-4 core functionality is complete

## 10. Acceptance Criteria

### Product Behavior
- [ ] User can create a V2 character card from scratch
- [ ] User can import and edit existing cards (PNG and JSON)
- [ ] User can export cards as PNG with embedded JSON and as standalone JSON
- [ ] AI generation works with any OpenAI-compatible endpoint
- [ ] Example characters improve generation quality
- [ ] Custom fields are preserved in export

### UI/UX
- [ ] All V2 spec fields are editable
- [ ] Image upload and preview works
- [ ] Generation streaming is visible
- [ ] State persists across page reloads
- [ ] Keyboard navigable

### Testing
- [ ] Zod schema validates correct V2 cards and rejects malformed ones (validate against all cards in `inspo/characters/`)
- [ ] PNG embed/extract roundtrip produces identical JSON
- [ ] Unknown `extensions` keys survive import/export round-trip
- [ ] Response parser handles wrapped (`xml`/`json`) and raw outputs, including malformed model responses
- [ ] Import handles V1, V2, and malformed cards gracefully
- [ ] Export produces SillyTavern-importable files

### Documentation
- [ ] README or in-app help explains API key setup
- [ ] Field tooltips explain V2 spec requirements

## 11. Verification Plan

- **Unit tests:** Zod schema validation, PNG embed/extract, prompt builder output, V1→V2 migration logic.
- **Integration tests:** Full create→export→import roundtrip in jsdom/happy-dom.
- **Manual QA:** Export PNG, import into SillyTavern, verify all fields present.
- **Type checks:** `pnpm run check-types` passes.
- **Lint:** `pnpm run lint` passes.
- **Accessibility:** Manual keyboard navigation test, axe-core audit on main page.

## 12. Rollout And Migration

This roadmap fully removes `apps/server`, `packages/shared`, and the placeholder `achievements`/`badges`/`user`/`auth`/`dev-tools` features (Phase 0) rather than deprecating or hiding them behind a flag. There is no dual-running period: once Phase 0 lands, the backend and those features no longer exist in the repo, and the character creator (Phases 1-5) is the only product surface. This matches the standard's rule against maintaining parallel versions — we replace the placeholder app outright instead of layering the new feature next to unused scaffolding.

No data migration is needed: the removed features have no real user data (MongoDB is a local dev-only container, never deployed with production data). If any collaborator has uncommitted work in the removed directories, Phase 0 should be preceded by a check-in, not a silent delete.

Since Phase 0 removes the docker-based Mongo/Valkey dependency, local dev setup gets strictly simpler afterward (`pnpm install && pnpm run dev:web`, no `docker compose up` required) — this should be reflected in the root README once Phase 0 ships.

## 13. Risks And Mitigations

| Risk | Impact | Mitigation | Owner |
| ---- | ------ | ---------- | ----- |
| Deleting `apps/server`/`packages/shared` removes something still needed (e.g. a dependency another kept file relies on) | Broken build after Phase 0 | Grep for `@startername/shared`, `apps/server`, `orpc` imports after deletion before proceeding to Phase 1; run full `check-types`/`lint`/`build` as Phase 0 exit criteria | Dev |
| CI workflows or scripts reference removed projects (moon `server`/`shared`, docker mongo step) | CI fails after merge | Explicit Phase 0 scope items for `.moon/workspace.yml`, root `package.json`, and `.github/workflows/*` | Dev |
| PNG library doesn't work client-side | Cannot export embedded PNGs | Libraries are small and browser-compatible; fallback to JSON-only export | Dev |
| Streaming through TanStack Start server function proxy is fiddly (SSE passthrough, buffering) | Degraded generation UX | Prototype the streaming proxy early in Phase 3; fall back to non-streaming proxy with spinner if blocked | Dev |
| API keys stored in localStorage are insecure | Key theft via XSS | Warn users; suggest using local/proxy endpoints; consider session-only storage option | Dev |
| localStorage quota (~5MB) exceeded by images/examples | Silent save failures, lost work | Images and example cards in IndexedDB; catch quota errors and surface a warning | Dev |
| Small/local models ignore output-format instructions | Garbage inserted into fields | Response parser with fallback to raw text; user-selectable output format (as-extension's proven mitigation) | Dev |
| Large character books exceed context window | Truncated/poor generation | Implement token counting and context budget, warn user | Dev |
| V2 spec ambiguity on edge cases | Export incompatibility | Test against SillyTavern import; reference existing parsers | Dev |

## 14. Decisions, Deferrals, And Superseded Work

### Decision: Client-only architecture (no apps/server)

**Status:** accepted
**Date:** 2026-07-05
**Rationale:** TanStack Start server functions handle the only server-side need (CORS proxy). No database, no accounts, no shared state. Keeps the tool simple and deployable as a static site with SSR.
**Effect on roadmap:** Eliminates backend work entirely.

### Decision: Remove `apps/server`, `packages/shared`, and placeholder `apps/web` features

**Status:** accepted
**Date:** 2026-07-05
**Rationale:** `achievements`, `badges`, `user`, `auth`, and `dev-tools` were confirmed to be unimplemented placeholders with no real product requirement, and the character creator needs none of the backend they depend on (`apps/server`, `packages/shared`, MongoDB, Valkey). Per the roadmap standard's rollout rule, we replace outright rather than deprecate or maintain both — carrying dead scaffolding forward only adds surface area for humans and agents to read past.
**Effect on roadmap:** Adds Phase 0 (removal) as a hard prerequisite to all other phases. The repo becomes a single `apps/web` TanStack Start application. If a real need for accounts/backend emerges later, it is scoped as a new roadmap, not a revival of the deleted code.

### Decision: OpenAI-compatible API only (no native Anthropic/Google SDK)

**Status:** accepted
**Date:** 2026-07-05
**Rationale:** OpenAI's `/v1/chat/completions` format is the de facto standard. Users can use proxy services (OpenRouter, LiteLLM) for non-OpenAI models. Reduces implementation complexity significantly vs. supporting multiple APIs natively.
**Effect on roadmap:** Single API client implementation in Phase 3.

### Deferral: V3 spec support

**Status:** deferred
**Date:** 2026-07-05
**Rationale:** V2 is the current ecosystem standard. V3 can be added later as a separate export option.
**Effect on roadmap:** No V3 work in any phase.

### Decision: Export hybrid V1+V2 JSON shape

**Status:** accepted
**Date:** 2026-07-05
**Rationale:** SillyTavern and most ecosystem tools write cards with V1 fields at the top level PLUS the V2 `spec`/`spec_version`/`data` structure, maximizing importer compatibility. Pure-V2-only JSON breaks some older importers. Cost is trivial (duplicate six fields at export time).
**Effect on roadmap:** Phase 2 JSON/PNG export writes the hybrid shape; import accepts pure V1, pure V2, and hybrid.

### Deferral: Revise sessions (chat-based iterative editing)

**Status:** deferred
**Date:** 2026-07-05
**Rationale:** as-extension's biggest differentiator beyond per-field generate is its "revise session" — a chat with the LLM that proposes structured edits to a field or the whole card, with compare/diff popups (`ReviseSessionChat.tsx`, `revise-prompt-builder.ts`). It is high-value but a large feature; per-field generate + continue + instructions covers the core workflow first.
**Effect on roadmap:** Not in Phases 1-5. Candidate for a follow-up roadmap once core generation ships.

### Deferral: User-editable prompt templates / presets

**Status:** deferred
**Date:** 2026-07-05
**Rationale:** as-extension exposes every prompt template (task description, context template, format instructions) as editable presets. Power-user feature; ship with good hardcoded defaults (ported from as-extension `constants.ts`) first.
**Effect on roadmap:** Phase 3 uses hardcoded defaults; keep prompts in `constants/default-prompts.ts` so exposing them later is cheap.

### Deferral: CharacterBook full editor

**Status:** deferred
**Date:** 2026-07-05
**Rationale:** Full lorebook editing is a complex feature unto itself. Basic add/remove entries is sufficient for Phase 5.
**Effect on roadmap:** Phase 5 includes only basic entry editing.

## 15. Archive Checklist

- [ ] Status is `Completed and aligned`, `Historical`, `Superseded on purpose`, or `Rejected`.
- [ ] Current repository state is accurate.
- [ ] Shipped work is linked.
- [ ] Remaining work is either moved to a new roadmap or marked deferred with rationale.
- [ ] Acceptance criteria are complete or intentionally narrowed.
- [ ] Verification evidence is recorded.
- [ ] The roadmap no longer reads like active implementation instructions.

## 16. Changelog

| Date | Change |
| --- | --- |
| 2026-07-05 | Created roadmap. |
| 2026-07-05 | Audit pass: added extensions-preservation requirements (spec MUST), chara/ccv3 chunk-replacement behavior, hybrid V1+V2 export decision, output-format parsing, IndexedDB for binary storage, CORS proxy as default path, deferrals for revise sessions and prompt presets. |
| 2026-07-05 | Added Phase 0 (remove `apps/server`, `packages/shared`, and placeholder `apps/web` features — confirmed placeholders with no real product). Character creator becomes the root route. Updated goals, non-goals, current repo state, rollout, risks, and decisions accordingly. |
