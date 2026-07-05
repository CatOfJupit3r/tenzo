# Character Card Creator

A standalone, client-only web app for authoring [SillyTavern-compatible V2 character cards](inspo/spec_v2.md) — no SillyTavern install required.

## What it does

- Edit all V2 card fields (description, personality, scenario, first message, example dialogue, alternate greetings, custom fields).
- Generate or continue any field with an AI model, using your own OpenAI-compatible API key/endpoint (streamed responses).
- Feed in example character cards as reference material for generation.
- Import existing cards from PNG (embedded `chara` tEXt chunk) or JSON, and re-export the same way.
- Upload a portrait and export a spec-compliant PNG with the JSON embedded, or export JSON alone.
- Everything lives in the browser — session state in localStorage, images/examples in IndexedDB. No server, no accounts, no database.

See [docs/roadmaps/active/character-card-creator.roadmap.md](docs/roadmaps/active/character-card-creator.roadmap.md) for the full spec, phase status, and design decisions.

## Tech stack

React 19, TanStack Start/Router/Query/Form, Tailwind CSS 4, Jotai, Zod, Vitest — all in `apps/web`. TanStack Start server functions are used only as a CORS proxy for AI generation calls; nothing is persisted server-side.

## Getting started

Prerequisites: Node.js 24 (see `.nvmrc`), pnpm ≥ 10.

```bash
git clone https://github.com/CatOfJupit3r/tenzo.git
cd tenzo
pnpm install
pnpm run dev
```

Open `http://localhost:3030`.

## Commands

- `pnpm run dev` – start the web app
- `pnpm run build` – build the web app
- `pnpm run test` – run the test suite
- `pnpm run check-types` – TypeScript checks
- `pnpm run lint` – ESLint
- `pnpm run prettify` – formatting check
