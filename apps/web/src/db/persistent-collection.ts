import { Debouncer } from '@tanstack/pacer';
import { liveQuery } from 'dexie';
import type { EntityTable } from 'dexie';
import { useSyncExternalStore } from 'react';
import type { z } from 'zod';

import { loggerFactory } from '../lib/logging/logger';

interface iPersistenceResult {
  isPersisted: {
    promise: Promise<undefined>;
  };
}

interface iPersistentCollectionOptions<T, TPrimaryKey extends keyof T> {
  getKey: (item: T) => T[TPrimaryKey] & string;
  persistenceWait?: number;
  schema: z.ZodType<T>;
  table: EntityTable<T, TPrimaryKey>;
}

interface iPendingUpdate<T> {
  debouncer: Debouncer<() => void>;
  latestRevision: number;
  latestValue: T;
  previousValue: T;
  promise: Promise<undefined>;
  reject: (reason?: unknown) => unknown;
  resolve: (value: undefined) => unknown;
}

interface iInitializableCollection {
  initialize: () => Promise<unknown>;
}

const persistentCollections = new Set<iInitializableCollection>();
const PERSISTENT_COLLECTION_LOGGER = loggerFactory.getLogger('database.persistence');

export class PersistentCollection<T, TPrimaryKey extends keyof T> {
  readonly #getKey: (item: T) => T[TPrimaryKey] & string;

  readonly #schema: z.ZodType<T>;

  readonly #table: EntityTable<T, TPrimaryKey>;

  readonly #collectionName: string;

  readonly #listeners = new Set<() => unknown>();

  readonly #persistenceWait: number | undefined;

  #items = new Map<T[TPrimaryKey] & string, T>();

  #pendingMutationCounts = new Map<T[TPrimaryKey] & string, number>();

  #pendingUpdates = new Map<T[TPrimaryKey] & string, iPendingUpdate<T>>();

  #updatePersistenceChains = new Map<T[TPrimaryKey] & string, Promise<unknown>>();

  #revisions = new Map<T[TPrimaryKey] & string, number>();

  #snapshot: readonly T[] = [];

  #isInitialized = false;

  constructor({ getKey, persistenceWait, schema, table }: iPersistentCollectionOptions<T, TPrimaryKey>) {
    this.#getKey = getKey;
    this.#persistenceWait = persistenceWait;
    this.#schema = schema;
    this.#table = table;
    this.#collectionName = table.name;
    persistentCollections.add(this);
  }

  get size() {
    return this.#items.size;
  }

  async initialize() {
    if (this.#isInitialized) {
      return;
    }

    PERSISTENT_COLLECTION_LOGGER.debug('Persistent collection initialization started', {
      operation: 'initialize',
      collection: this.#collectionName,
    });

    try {
      const storedItems = await this.#table.toArray();
      this.#replaceItems(storedItems);
      this.#isInitialized = true;

      liveQuery(async () => this.#table.toArray()).subscribe({
        next: (items) => this.#replaceItems(items),
        error: (error: unknown) =>
          PERSISTENT_COLLECTION_LOGGER.error('Persistent collection live query failed', error, {
            operation: 'live-query',
            collection: this.#collectionName,
          }),
      });
      PERSISTENT_COLLECTION_LOGGER.debug('Persistent collection initialized', {
        operation: 'initialize',
        collection: this.#collectionName,
        recordCount: storedItems.length,
      });
    } catch (error) {
      PERSISTENT_COLLECTION_LOGGER.error('Persistent collection initialization failed', error, {
        operation: 'initialize',
        collection: this.#collectionName,
      });
      throw error;
    }
  }

  async preload() {
    await this.initialize();
  }

  has(key: T[TPrimaryKey] & string) {
    return this.#items.has(key);
  }

  get(key: T[TPrimaryKey] & string) {
    return this.#items.get(key);
  }

  values() {
    return this.#items.values();
  }

  insert(value: T): iPersistenceResult {
    const parsedValue = structuredClone(this.#schema.parse(value));
    const key = this.#getKey(parsedValue);

    if (this.#items.has(key)) {
      throw new Error(`A record with key "${String(key)}" already exists.`);
    }

    this.#items.set(key, parsedValue);
    const revision = this.#beginMutation(key);
    this.#emit();

    const promise = this.#table.add(structuredClone(parsedValue)).then(
      () => {
        this.#endMutation(key);
        return undefined;
      },
      (error: unknown) => {
        PERSISTENT_COLLECTION_LOGGER.error('Persistence mutation failed', error, {
          operation: 'persist',
          collection: this.#collectionName,
          mutationType: 'insert',
        });
        if (this.#revisions.get(key) === revision) {
          this.#items.delete(key);
          this.#emit();
        }
        this.#endMutation(key);
        throw error;
      },
    );

    return { isPersisted: { promise } };
  }

  update(key: T[TPrimaryKey] & string, recipe: (draft: T) => unknown): iPersistenceResult {
    const currentValue = this.#items.get(key);
    if (!currentValue) {
      throw new Error(`A record with key "${String(key)}" does not exist.`);
    }

    const previousValue = structuredClone(currentValue);
    const nextValue = structuredClone(currentValue);
    recipe(nextValue);
    const parsedValue = structuredClone(this.#schema.parse(nextValue));
    this.#items.set(key, parsedValue);
    const revision = this.#beginMutation(key);
    this.#emit();

    if (this.#persistenceWait !== undefined) {
      return this.#scheduleUpdate(key, previousValue, parsedValue, revision);
    }

    const promise = this.#table.put(structuredClone(parsedValue)).then(
      () => {
        this.#endMutation(key);
        return undefined;
      },
      (error: unknown) => {
        PERSISTENT_COLLECTION_LOGGER.error('Persistence mutation failed', error, {
          operation: 'persist',
          collection: this.#collectionName,
          mutationType: 'update',
        });
        if (this.#revisions.get(key) === revision) {
          this.#items.set(key, previousValue);
          this.#emit();
        }
        this.#endMutation(key);
        throw error;
      },
    );

    return { isPersisted: { promise } };
  }

  async flushPendingUpdates() {
    PERSISTENT_COLLECTION_LOGGER.debug('Pending persistence flush started', {
      operation: 'flush',
      collection: this.#collectionName,
      pendingUpdateCount: this.#pendingUpdates.size,
    });
    this.#pendingUpdates.forEach((pendingUpdate) => pendingUpdate.debouncer.flush());
    try {
      await Promise.all(this.#updatePersistenceChains.values());
      PERSISTENT_COLLECTION_LOGGER.debug('Pending persistence flush completed', {
        operation: 'flush',
        collection: this.#collectionName,
      });
    } catch (error) {
      PERSISTENT_COLLECTION_LOGGER.error('Pending persistence flush failed', error, {
        operation: 'flush',
        collection: this.#collectionName,
      });
      throw error;
    }
  }

  delete(key: T[TPrimaryKey] & string): iPersistenceResult {
    const previousValue = this.#items.get(key);
    if (!previousValue) {
      return { isPersisted: { promise: Promise.resolve(undefined) } };
    }

    this.#pendingUpdates.get(key)?.debouncer.flush();
    this.#items.delete(key);
    const revision = this.#beginMutation(key);
    this.#emit();

    const previousPersistence = this.#updatePersistenceChains.get(key) ?? Promise.resolve();
    const promise = previousPersistence
      .catch(() => undefined)
      .then(async () => this.#table.where(':id').equals(key).delete())
      .then(
        () => {
          this.#endMutation(key);
          return undefined;
        },
        (error: unknown) => {
          PERSISTENT_COLLECTION_LOGGER.error('Persistence mutation failed', error, {
            operation: 'persist',
            collection: this.#collectionName,
            mutationType: 'delete',
          });
          if (this.#revisions.get(key) === revision) {
            this.#items.set(key, previousValue);
            this.#emit();
          }
          this.#endMutation(key);
          throw error;
        },
      );

    return { isPersisted: { promise } };
  }

  subscribe = (listener: () => unknown) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  getSnapshot = () => this.#snapshot;

  #replaceItems(items: T[]) {
    const nextItems = new Map(
      items.flatMap((item) => {
        const result = this.#schema.safeParse(item);
        return result.success ? [[this.#getKey(result.data), structuredClone(result.data)] as const] : [];
      }),
    );

    this.#pendingMutationCounts.forEach((count, key) => {
      if (count === 0) {
        return;
      }

      const pendingValue = this.#items.get(key);
      if (pendingValue) {
        nextItems.set(key, pendingValue);
      } else {
        nextItems.delete(key);
      }
    });

    this.#items = nextItems;
    this.#emit();
  }

  #beginMutation(key: T[TPrimaryKey] & string) {
    const revision = (this.#revisions.get(key) ?? 0) + 1;
    this.#revisions.set(key, revision);
    this.#pendingMutationCounts.set(key, (this.#pendingMutationCounts.get(key) ?? 0) + 1);
    return revision;
  }

  #scheduleUpdate(key: T[TPrimaryKey] & string, previousValue: T, latestValue: T, revision: number) {
    const existingUpdate = this.#pendingUpdates.get(key);

    if (existingUpdate) {
      existingUpdate.latestRevision = revision;
      existingUpdate.latestValue = latestValue;
      existingUpdate.debouncer.maybeExecute();
      this.#endMutation(key);
      return { isPersisted: { promise: existingUpdate.promise } };
    }

    let resolve: iPendingUpdate<T>['resolve'] = () => undefined;
    let reject: iPendingUpdate<T>['reject'] = () => undefined;
    const promise = new Promise<undefined>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    void promise.catch(() => undefined);

    const pendingUpdate = {
      latestRevision: revision,
      latestValue,
      previousValue,
      promise,
      reject,
      resolve,
      debouncer: new Debouncer(
        () => {
          this.#pendingUpdates.delete(key);
          this.#persistUpdate(key, pendingUpdate);
        },
        { wait: this.#persistenceWait ?? 0 },
      ),
    } satisfies iPendingUpdate<T>;

    this.#pendingUpdates.set(key, pendingUpdate);
    pendingUpdate.debouncer.maybeExecute();
    return { isPersisted: { promise } };
  }

  #persistUpdate(key: T[TPrimaryKey] & string, pendingUpdate: iPendingUpdate<T>) {
    const previousPersistence = this.#updatePersistenceChains.get(key) ?? Promise.resolve();
    const persistence = previousPersistence
      .catch(() => undefined)
      .then(async () => this.#table.put(structuredClone(pendingUpdate.latestValue)))
      .then(
        () => {
          pendingUpdate.resolve(undefined);
        },
        (error: unknown) => {
          PERSISTENT_COLLECTION_LOGGER.error('Persistence mutation failed', error, {
            operation: 'persist',
            collection: this.#collectionName,
            mutationType: 'update',
          });
          if (this.#revisions.get(key) === pendingUpdate.latestRevision) {
            this.#items.set(key, pendingUpdate.previousValue);
            this.#emit();
          }
          pendingUpdate.reject(error);
        },
      )
      .finally(() => {
        this.#endMutation(key);
        if (this.#updatePersistenceChains.get(key) === persistence) {
          this.#updatePersistenceChains.delete(key);
        }
      });

    this.#updatePersistenceChains.set(key, persistence);
  }

  #endMutation(key: T[TPrimaryKey] & string) {
    const nextCount = (this.#pendingMutationCounts.get(key) ?? 1) - 1;
    if (nextCount === 0) {
      this.#pendingMutationCounts.delete(key);
      return;
    }

    this.#pendingMutationCounts.set(key, nextCount);
  }

  #emit() {
    this.#snapshot = [...this.#items.values()];
    this.#listeners.forEach((listener) => listener());
  }
}

export function usePersistentCollection<T, TPrimaryKey extends keyof T>(
  collection: PersistentCollection<T, TPrimaryKey>,
) {
  return useSyncExternalStore(collection.subscribe, collection.getSnapshot, collection.getSnapshot);
}

export async function initializePersistentCollections() {
  await Promise.all([...persistentCollections].map(async (collection) => collection.initialize()));
}
