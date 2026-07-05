---
name: moonrepo-workflow
description: Use moonrepo for task orchestration, caching, and project management in the monorepo. Use when running builds, tests, linting, or understanding project dependencies. Covers common commands, caching behavior, and debugging workflows.
---

# moonrepo Workflow

moonrepo is our task runner and orchestrator for the monorepo. It provides intelligent caching, dependency-aware task execution, and consistent tooling across all projects.

## Architecture Overview

```
.moon/
├── workspace.yml    # Project registration and workspace settings
├── toolchain.yml    # Node.js/pnpm/TypeScript versions
└── tasks.yml        # Shared task definitions (inherited by projects)

apps/
├── server/moon.yml  # Server-specific tasks and overrides
└── web/moon.yml     # Web-specific tasks and overrides

packages/
└── shared/moon.yml  # Shared library tasks

configs/
├── eslint-config/moon.yml
└── prettier-config/moon.yml
```

## Quick Reference

| Command | Purpose |
|---------|---------|
| `pnpm run dev` | Start all dev servers (Docker + moon) |
| `pnpm run build` | Build all projects |
| `pnpm run test` | Run all tests |
| `pnpm run check-types` | Type check all projects |
| `pnpm run lint` | Lint all projects |
| `moon run <project>:<task>` | Run specific task |

## Core Commands

### Running Tasks

```powershell
# Run a task across ALL projects
pnpm exec moon run :build          # Build everything
pnpm exec moon run :test           # Test everything
pnpm exec moon run :check-types    # Type check everything
pnpm exec moon run :lint           # Lint everything

# Run a task for a SPECIFIC project
pnpm exec moon run server:dev      # Start server in dev mode
pnpm exec moon run web:dev         # Start web app in dev mode
pnpm exec moon run shared:build    # Build shared package

# Run multiple tasks
pnpm exec moon run server:build web:build

# Pass arguments through to the underlying command
pnpm exec moon run server:lint -- --fix
```

### Shorthand via root package.json

The root `package.json` provides shortcuts:

```powershell
pnpm run dev           # docker compose up + moon run :dev
pnpm run build         # moon run :build
pnpm run test          # moon run :test
pnpm run dev:server    # moon run server:dev
pnpm run dev:web       # moon run web:dev
```

## Project Discovery

### List All Projects

```powershell
pnpm exec moon query projects
```

Output:
```
╭────────────────────────────────────────────────────────────────────╮
│Project          Source                   Toolchains               │
│────────────────────────────────────────────────────────────────────│
│eslint-config    configs/eslint-config    node                     │
│prettier-config  configs/prettier-config  node                     │
│server           apps/server              node, typescript         │
│shared           packages/shared          node, typescript         │
│web              apps/web                 node, typescript         │
╰────────────────────────────────────────────────────────────────────╯
```

### List Available Tasks for a Project

```powershell
pnpm exec moon query tasks --project server
```

### View Project Dependencies

```powershell
pnpm exec moon project server
```

## Caching

Moon caches task outputs based on:
- Input files (defined in task's `inputs`)
- Environment variables
- Command arguments
- Dependency task outputs

### Cache Behavior

```powershell
# First run - executes task
pnpm exec moon run shared:build
# Time: ~3s

# Second run (no changes) - instant cache hit
pnpm exec moon run shared:build
# Time: ~300ms ❯❯❯❯ to the moon
```

### Force Re-run (Skip Cache)

```powershell
pnpm exec moon run shared:build --force
```

### Clear Cache

```powershell
# Clear all moon cache
Remove-Item -Recurse -Force .moon/cache

# Or use moon's built-in clean
pnpm exec moon clean
```

## Task Configuration

### Inheritance Model

1. **Global tasks** (`.moon/tasks.yml`) - Default for all projects
2. **Project tasks** (`<project>/moon.yml`) - Override or extend globals

### Task Definition Example

```yaml
# .moon/tasks.yml - Global task
tasks:
  build:
    command: "tsgo"
    inputs:
      - "@group(sources)"      # File group reference
      - "tsconfig.json"
    outputs:
      - "dist/**/*"            # Enable caching
    deps:
      - "~:check-types"        # Run check-types first
    options:
      cache: true
      runInCI: true
```

### Project Override Example

```yaml
# apps/server/moon.yml
tasks:
  dev:
    command: 'tsx watch ./src/index.ts'
    env:
      NODE_ENV: 'development'
    options:
      persistent: true         # Keep running (for servers)
      cache: false             # Don't cache dev tasks
```

### Key Task Options

| Option | Purpose |
|--------|---------|
| `persistent: true` | Task keeps running (servers, watch mode) |
| `cache: true/false` | Enable/disable caching |
| `runInCI: true` | Include in CI runs |
| `envFile: ".env"` | Load environment file |
| `deps: ["~:task"]` | Run dependency tasks first |

### Dependency Notation

| Syntax | Meaning |
|--------|---------|
| `~:task` | Same project's task |
| `^:task` | All upstream dependencies' task |
| `project:task` | Specific project's task |

## File Groups

Define reusable file patterns in `.moon/tasks.yml`:

```yaml
fileGroups:
  sources:
    - "src/**/*.ts"
    - "src/**/*.tsx"
  configs:
    - "tsconfig.json"
    - "eslint.config.{mjs,js}"
  tests:
    - "src/**/*.test.ts"
    - "tests/**/*.ts"
```

Reference in tasks:
```yaml
tasks:
  build:
    inputs:
      - "@group(sources)"
      - "@group(configs)"
```

## Common Workflows

### Adding a New Package

1. Create the package directory with `package.json`
2. Add a `moon.yml` file:

```yaml
# packages/new-pkg/moon.yml
$schema: 'https://moonrepo.dev/schemas/project.json'

language: 'typescript'
type: 'library'
platform: 'node'

tags:
  - 'library'

tasks:
  build:
    command: "tsdown"
    outputs:
      - "dist/**/*"
```

3. Register in `.moon/workspace.yml`:

```yaml
projects:
  new-pkg: "packages/new-pkg"
```

### Declaring Dependencies Between Projects

In the dependent project's `moon.yml`:

```yaml
# apps/server/moon.yml
dependsOn:
  - 'shared'   # server depends on shared
```

Moon will ensure `shared:build` runs before `server:build`.

### Running Tasks Affected by Changes

```powershell
# Run only changed projects (great for CI)
pnpm exec moon ci

# Check what would run
pnpm exec moon ci --status
```

## Debugging

### View Task Details

```powershell
pnpm exec moon query tasks --project server --json
```

### Check Why a Task Ran/Was Cached

```powershell
pnpm exec moon run shared:build --log debug
```

### View Dependency Graph

```powershell
# Generate DOT graph
pnpm exec moon project-graph --dot > graph.dot

# Or use the visual tool
pnpm exec moon graph
```

## CI Integration

Our unified CI workflow (`.github/workflows/pull-request.yml`) leverages moon for:

1. **Affected detection** - Only runs tasks for changed projects
2. **Dependency ordering** - Builds `shared` before `server`/`web` automatically
3. **Task caching** - Restores previous build outputs
4. **Parallelization** - Runs independent tasks concurrently

### Full Workflow

```yaml
name: Pull Request | CI

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for moon change detection

      - uses: pnpm/action-setup@v4
        with:
          version: 10.11.0

      - uses: actions/setup-node@v4
        with:
          node-version: 24.11.1
          cache: 'pnpm'

      # Cache moon task outputs between runs
      - uses: actions/cache@v4
        with:
          path: .moon/cache
          key: moon-${{ runner.os }}-${{ github.sha }}
          restore-keys: moon-${{ runner.os }}-

      - run: pnpm install --frozen-lockfile

      # Runs check-types, lint, build for affected projects only
      - run: pnpm exec moon ci
        env:
          VITE_SERVER_URL: http://localhost:3000
```

### Key Points

| Feature | How moon helps |
|---------|----------------|
| Changed file detection | `moon ci` uses git diff vs base branch |
| No manual path filtering | Remove `on.paths` - moon handles it |
| Dependency builds | `dependsOn` in moon.yml auto-orders tasks |
| Cache across PRs | `.moon/cache` persists task outputs |

### Running Specific Tasks in CI

```yaml
# Run all tasks tagged runInCI: true for affected projects
- run: pnpm exec moon ci

# Or run specific tasks for ALL projects
- run: pnpm exec moon run :check-types :lint :build

# Or run specific tasks for affected only
- run: pnpm exec moon run :test --affected
```

### `moon ci` vs `moon run`

| Command | Behavior |
|---------|----------|
| `moon ci` | Runs tasks with `runInCI: true` for affected projects only |
| `moon run :task` | Runs task for ALL projects |
| `moon run :task --affected` | Runs task for affected projects only |

### Task Configuration for CI

In `.moon/tasks.yml`, set `runInCI: true` for tasks that should run in CI:

```yaml
tasks:
  check-types:
    command: "tsgo --noEmit"
    options:
      runInCI: true   # Included in moon ci
      cache: true

  build:
    command: "tsgo"
    options:
      runInCI: true
      cache: true

  test:
    command: "vitest run"
    options:
      runInCI: true   # Set to true to include tests in moon ci
      cache: true
```

## Tips & Tricks

### 1. Use `--affected` for Faster Local Development

```powershell
pnpm exec moon run :test --affected
```

Only runs tests for projects with changes since last commit.

### 2. Parallel Execution

Moon runs independent tasks in parallel automatically. For explicit control:

```yaml
tasks:
  dev:
    options:
      runDepsInParallel: false  # Force sequential
```

### 3. Environment-Specific Tasks

```yaml
tasks:
  dev:
    env:
      NODE_ENV: 'development'
      DEBUG: 'app:*'
    options:
      envFile: '.env.local'
```

### 4. Exclude Inherited Tasks

```yaml
# Don't inherit certain tasks from global config
workspace:
  inheritedTasks:
    exclude:
      - 'build'
      - 'test'
```

### 5. Task Tags for Filtering

```yaml
# In project moon.yml
tags:
  - 'frontend'
  - 'web'

# Run all frontend tasks
pnpm exec moon run :build --query "tag=frontend"
```

## vs pnpm Scripts

| Feature | pnpm scripts | moon |
|---------|--------------|------|
| Caching | ❌ | ✅ |
| Dependency graph | ❌ | ✅ |
| Parallel execution | Manual | ✅ Automatic |
| Affected detection | ❌ | ✅ |
| Consistent tooling | Manual | ✅ Via toolchain |

**Rule of thumb**: Use moon for all multi-project orchestration. Keep `package.json` scripts minimal (only interactive tasks like `test:watch`, `test:ui`).

## Configuration Files Reference

| File | Purpose |
|------|---------|
| `.moon/workspace.yml` | Project registration, VCS, caching settings |
| `.moon/toolchain.yml` | Node.js, pnpm, TypeScript versions |
| `.moon/tasks.yml` | Global task definitions, file groups |
| `<project>/moon.yml` | Project-specific config and task overrides |
