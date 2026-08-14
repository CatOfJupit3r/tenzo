import { liveQuery } from 'dexie';
import type { EntityTable } from 'dexie';
import { useSyncExternalStore } from 'react';
import type { z } from 'zod';

interface iPersistenceResult {
  isPersisted: {
    promise: Promise<undefined>;
  };
}

interface iPersistentCollectionOptions<T, TPrimaryKey extends keyof T> {
  getKey: (item: T) => T[TPrimaryKey] & string;
  schema: z.ZodType<T>;
  table: EntityTable<T, TPrimaryKey>;
}

interface iInitializableCollection {
  initialize: () => Promise<unknown>;
}

const persistentCollections = new Set<iInitializableCollection>();

export class PersistentCollection<T, TPrimaryKey extends keyof T> {
  readonly #getKey: (item: T) => T[TPrimaryKey] & string;

  readonly #schema: z.ZodType<T>;

  readonly #table: EntityTable<T, TPrimaryKey>;

  readonly #listeners = new Set<() => unknown>();

  #items = new Map<T[TPrimaryKey] & string, T>();

  #pendingMutationCounts = new Map<T[TPrimaryKey] & string, number>();

  #revisions = new Map<T[TPrimaryKey] & string, number>();

  #snapshot: readonly T[] = [];

  #isInitialized = false;

  constructor({ getKey, schema, table }: iPersistentCollectionOptions<T, TPrimaryKey>) {
    this.#getKey = getKey;
    this.#schema = schema;
    this.#table = table;
    persistentCollections.add(this);
  }

  get size() {
    return this.#items.size;
  }

  async initialize() {
    if (this.#isInitialized) {
      return;
    }

    const storedItems = await this.#table.toArray();
    this.#replaceItems(storedItems);
    this.#isInitialized = true;

    liveQuery(async () => this.#table.toArray()).subscribe({
      next: (items) => this.#replaceItems(items),
    });
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

    const promise = this.#table.put(structuredClone(parsedValue)).then(
      () => {
        this.#endMutation(key);
        return undefined;
      },
      (error: unknown) => {
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

  delete(key: T[TPrimaryKey] & string): iPersistenceResult {
    const previousValue = this.#items.get(key);
    if (!previousValue) {
      return { isPersisted: { promise: Promise.resolve(undefined) } };
    }

    this.#items.delete(key);
    const revision = this.#beginMutation(key);
    this.#emit();

    const promise = this.#table
      .where(':id')
      .equals(key)
      .delete()
      .then(
        () => {
          this.#endMutation(key);
          return undefined;
        },
        (error: unknown) => {
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
