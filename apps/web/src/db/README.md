# Client data with TanStack DB

[TanStack DB](https://tanstack.com/db) gives us reactive **collections** and live
queries on the client. It sits on top of the TanStack Query / oRPC stack we
already use and also handles browser-local persistence. Read reactively with
`useLiveQuery`; mutate with `collection.insert/update/delete`.

There are three collection strategies, one per data source.

## 1. Server data — query collections

Wrap an existing oRPC + TanStack Query source in `queryCollectionOptions`. The
collection stays in sync with the query cache and gains optimistic
insert/update/delete via mutation handlers.

```ts
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection } from '@tanstack/react-db';

// queryClient comes from the router context (see src/router.tsx). Query
// collections are client-side; instantiate them where a QueryClient is
// available rather than at module top-level, since SSR builds a fresh
// QueryClient per request.
export const makeAchievementsCollection = (queryClient: QueryClient) =>
  createCollection(
    queryCollectionOptions({
      queryClient,
      queryKey: ['achievements', 'list'],
      queryFn: () => client.achievements.listAchievements(),
      getKey: (item) => item.id,
      // onInsert / onUpdate / onDelete -> call the oRPC mutation, then the
      // query cache refetch reconciles the collection.
    }),
  );
```

## 2. localStorage / sessionStorage — built in

`localStorageCollectionOptions` persists rows to Web Storage automatically and
syncs across tabs via the `storage` event. This is first-class and needs no
extra package. See [`collections/ui-preferences.collection.ts`](./collections/ui-preferences.collection.ts)
for a working template.

Because we server-render, pass the SSR-safe adapters from
[`storage.ts`](./storage.ts) instead of touching `window` directly:

```ts
import { createCollection, localStorageCollectionOptions } from '@tanstack/react-db';

import { localStorageApi } from '../storage';

export const draftsCollection = createCollection(
  localStorageCollectionOptions({
    storageKey: 'tenzo:drafts',
    storage: localStorageApi, // memory no-op on the server, real store in the browser
    getKey: (item) => item.id,
    schema: DRAFT_SCHEMA,
  }),
);
```

**Caveat:** Web Storage holds ~5 MB of strings. Fine for text/settings; use
IndexedDB (below) for images or large blobs.

## 3. IndexedDB — via `localOnlyCollectionOptions` + an adapter

TanStack DB (v0.6) has **no built-in IndexedDB collection** — its storage
adapter type is the synchronous `Storage` API and IndexedDB is async. The
supported pattern is a `localOnlyCollectionOptions` collection (an in-memory,
reactive store) whose mutation handlers persist to IndexedDB, hydrated from
IndexedDB on startup. Use a tiny wrapper like [`idb-keyval`](https://www.npmjs.com/package/idb-keyval)
for the async layer.

```ts
import { createCollection, localOnlyCollectionOptions } from '@tanstack/react-db';
import { get, set, del } from 'idb-keyval';

const initialData = (await get<CardImage[]>('tenzo:card-images')) ?? [];

export const cardImagesCollection = createCollection(
  localOnlyCollectionOptions({
    getKey: (item) => item.id,
    initialData,
    onInsert: async ({ transaction }) => {
      for (const m of transaction.mutations) await set(`tenzo:card-images:${m.key}`, m.modified);
    },
    onUpdate: async ({ transaction }) => {
      for (const m of transaction.mutations) await set(`tenzo:card-images:${m.key}`, m.modified);
    },
    onDelete: async ({ transaction }) => {
      for (const m of transaction.mutations) await del(`tenzo:card-images:${m.key}`);
    },
  }),
);
```

This is the path the character card creator roadmap should use for portrait
images and imported example cards (see
`docs/roadmaps/active/character-card-creator.roadmap.md`, persistence section).
