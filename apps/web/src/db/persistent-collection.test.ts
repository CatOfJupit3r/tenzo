import Dexie from 'dexie';
import type { EntityTable } from 'dexie';
import { expect, it, vi } from 'vitest';
import z from 'zod';

import { PersistentCollection } from './persistent-collection';

interface iTestItem {
  id: string;
  value: string;
}

class TestDatabase extends Dexie {
  items!: EntityTable<iTestItem, 'id'>;

  constructor() {
    super(`persistent-collection-test-${crypto.randomUUID()}`);
    this.version(1).stores({ items: 'id' });
  }
}

it('debounces repeated persistence while publishing updates immediately', async () => {
  const database = new TestDatabase();
  const putItem = vi.spyOn(database.items, 'put');
  const collection = new PersistentCollection({
    table: database.items,
    getKey: (item) => item.id,
    persistenceWait: 300,
    schema: z.object({ id: z.string(), value: z.string() }),
  });
  await collection.insert({ id: 'character', value: '' }).isPersisted.promise;

  const firstUpdate = collection.update('character', (draft) => {
    draft.value = 'First';
  });
  const secondUpdate = collection.update('character', (draft) => {
    draft.value = 'Second';
  });

  expect(collection.get('character')?.value).toBe('Second');
  expect(putItem).not.toHaveBeenCalled();
  expect(firstUpdate.isPersisted.promise).toBe(secondUpdate.isPersisted.promise);

  await collection.flushPendingUpdates();
  await secondUpdate.isPersisted.promise;

  expect(putItem).toHaveBeenCalledOnce();
  await expect(database.items.get('character')).resolves.toEqual({ id: 'character', value: 'Second' });
  database.close();
});
