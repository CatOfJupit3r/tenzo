---
name: typegoose-modeling
description: Create MongoDB models using Typegoose following project conventions. Use when defining database schemas, creating new models, working with embedded documents, adding indexes for query optimization, or exporting type-safe model instances.
---

# Typegoose Modeling

Modular guides for creating type-safe MongoDB models with Typegoose and Mongoose, following project conventions.

## Core Concepts

Models live in `apps/server/src/db/models` and use Typegoose to wrap Mongoose. Always use class-based schemas with `@modelOptions` and the standard `@prop` decorator from Typegoose.

**Note**: This project uses SWC for TypeScript compilation with `emitDecoratorMetadata` enabled, so Typegoose can automatically infer types from TypeScript annotations without explicit `type` declarations.

## Quick Reference

| Guide | Use When |
|-------|----------|
| [Property Decorators](references/prop-decorators.md) | Understanding @prop options and patterns |
| [Embedded Documents](references/embedded-documents.md) | Creating nested objects and arrays of documents |
| [Indexes](references/indexes.md) | Optimizing queries with single and compound indexes |
| [Common Patterns](references/common-patterns.md) | Enums, timestamps, references, optional fields, collections |
| [Best Practices](references/best-practices.md) | Architecture patterns, keeping models pure, sharing schemas |

## Learning Path

**Beginner:** Start with Prop Decorators → Common Patterns → Basic model creation  
**Intermediate:** Add Embedded Documents → Indexes for query optimization  
**Advanced:** Best Practices → Architecture patterns

## See Also

- **examples/basic-model.ts** - Simple model structure
- **examples/model-with-indexes.ts** - Single and compound indexes
- **examples/embedded-documents.ts** - Nested documents
