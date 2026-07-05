---
name: feature-implementation-workflow
description: Complete workflow for implementing a full-stack feature from contracts to UI. Divided into 5 focused phases that can be used independently or together. Use when adding a new feature spanning backend and frontend, following contract-first development, or ensuring consistency across the stack.
---

# Feature Implementation Workflow

A modular, phase-based guide for implementing full-stack features. Each phase is self-contained but follows a natural progression.

## Quick Navigation

| Phase | Skill | When to Use |
|-------|-------|------------|
| 1️⃣ **Foundation** | `feature-foundation-models-contracts` | Starting a new feature, defining data structures |
| 2️⃣ **Backend** | `feature-backend-implementation` | Building server handlers and business logic |
| 3️⃣ **Queries** | `feature-frontend-queries-mutations` | Creating data fetching layer |
| 4️⃣ **Components** | `feature-frontend-components` | Building UI components and routes |
| 5️⃣ **Testing** | `feature-testing-polish` | Finalizing and testing the feature |

## Full Workflow

```
Start with Requirements
         ↓
Phase 1: Foundation (Data Models & Contracts)
         ↓
Phase 2: Backend Implementation (Services & Routers)
         ↓
Phase 3: Frontend Queries & Mutations (Data Layer)
         ↓
Phase 4: Frontend Components & Integration (UI)
         ↓
Phase 5: Testing & Polish (Quality Checks)
         ↓
Feature Ready for Review/Deployment
```

## Prerequisites

- Read `.github/copilot-instructions.md` for workspace context
- Understand feature requirements

## Key Principles

1. **Contract-First**: Start with contracts (Phase 1) before implementation
2. **Type-Safe**: Every phase must pass `pnpm run check-types`
3. **Progressive**: Each phase can start independently but benefits from sequence
4. **Error-Driven**: Use defined error codes, not hardcoded strings
5. **Tested**: Include tests to verify behavior and access control

## How Phases Connect

```typescript
// Phase 1: Define the contract
export const featureContract = oc.router({
  getFeature: oc.route(...).input(...).output(...),
});

// Phase 2: Implement the handler
export const featureRouter = base.feature.router({
  getFeature: protectedProcedure.handler(async ({ input, context }) => {
    // implementation
  }),
});

// Phase 3: Create hooks to fetch data
export function useFeature(id: string) {
  return useQuery(featureQueryOptions(id));
}

// Phase 4: Build components using hooks
export function FeatureCard({ id }: { id: string }) {
  const { data, isPending, error } = useFeature(id);
  // render
}

// Phase 5: Verify with tests
it('should fetch and display feature', async () => {
  render(<FeatureCard id="123" />);
  expect(screen.getByText('Feature Name')).toBeInTheDocument();
});
```

## When to Use Each Phase

### Phase 1: Foundation (Models & Contracts)
✓ Starting a brand new feature  
✓ Defining data structures  
✓ Planning API contracts  
✓ Establishing error codes  

→ **Uses Skills**: typegoose-modeling, orpc-contract-creation

### Phase 2: Backend Implementation
✓ After contracts are defined  
✓ Implementing business logic  
✓ Building API endpoints  
✓ Creating services (optional)  

→ **Uses Skills**: dependency-injection-setup, server-router-implementation, server-error-handling

### Phase 3: Frontend Queries & Mutations
✓ After backend is ready  
✓ Building data fetching layer  
✓ Creating query/mutation hooks  
✓ Setting up cache invalidation  

→ **Uses Skills**: tanstack-query-integration

### Phase 4: Frontend Components & Integration
✓ After hooks are ready  
✓ Building UI components  
✓ Creating routes and pages  
✓ Integrating with navigation  

→ **Uses Skills**: react-component-patterns

### Phase 5: Testing & Polish
✓ Before code review  
✓ Writing integration tests  
✓ Verifying access control  
✓ Running quality checks  

→ **Uses Skills**: None specific (but apply testing best practices)

## Quality Gates

Every phase must pass:

```bash
pnpm run check-types  # Type safety
pnpm run lint         # Code style
pnpm run prettier     # Formatting
pnpm run test         # Tests (phases 2, 5)
```

## Tips & Patterns

**Start phases in parallel:**
- Phase 1 (Foundation) → establish contracts
- While backend dev completes Phase 2, frontend can prepare Phase 3

**Reference other phases:**
- Phase 4 (Components) references Phase 3 (hooks)
- Phase 3 (Hooks) references Phase 2 (backend routes)

**Access each phase independently:**
- Jump to Phase 3 if you already have contracts and backend
- Jump to Phase 4 if hooks are pre-built

**Use examples:**
- Each phase directory includes `examples/` with complete code samples
- Full end-to-end example in `examples/complete-feature-example.md`

## Related Skills

- **typegoose-modeling** - Data modeling with Typegoose
- **orpc-contract-creation** - Defining oRPC contracts
- **dependency-injection-setup** - Service patterns and DI
- **server-router-implementation** - Backend routing
- **server-error-handling** - Error patterns
- **tanstack-query-integration** - TanStack Query patterns
- **react-component-patterns** - React component best practices

## See Also

- `examples/complete-feature-example.md` - Full working example
- `phases/*/SKILL.md` - Individual phase guides
- Each phase includes `references/` with detailed guides

---

**Ready to start?** Choose a phase above and see `phases/` for detailed instructions and examples.
