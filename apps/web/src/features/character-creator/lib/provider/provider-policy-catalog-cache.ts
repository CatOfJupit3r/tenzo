import { PROVIDER_POLICY_CATALOG_SCHEMA, PROVIDER_POLICY_CATALOG_TTL_MS } from './provider-policy-resolver';
import type { iProviderPolicyCatalog } from './provider-policy-resolver';

export interface iProviderPolicyCatalogCache {
  get: (key: string, now: Date) => iProviderPolicyCatalog | null;
  set: (key: string, catalog: iProviderPolicyCatalog) => void;
  clear: () => void;
}

export function createProviderPolicyCatalogCache(maximumEntries = 8): iProviderPolicyCatalogCache {
  const entries = new Map<string, iProviderPolicyCatalog>();
  const boundedMaximumEntries = Math.max(1, Math.floor(maximumEntries));

  return {
    get(key, now) {
      const catalog = entries.get(key);
      if (!catalog) return null;
      if (now.getTime() - new Date(catalog.fetchedAt).getTime() > PROVIDER_POLICY_CATALOG_TTL_MS) {
        entries.delete(key);
        return null;
      }
      entries.delete(key);
      entries.set(key, catalog);
      return catalog;
    },
    set(key, catalog) {
      const parsedCatalog = PROVIDER_POLICY_CATALOG_SCHEMA.parse(catalog);
      entries.delete(key);
      entries.set(key, parsedCatalog);
      while (entries.size > boundedMaximumEntries) {
        const oldestKey = entries.keys().next().value;
        if (oldestKey === undefined) break;
        entries.delete(oldestKey);
      }
    },
    clear() {
      entries.clear();
    },
  };
}
