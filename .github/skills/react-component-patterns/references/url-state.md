# URL State Management with nuqs

Guide to managing application state in URL query parameters using the nuqs library.

## Basic URL state

Store simple state values in the URL:

```typescript
import { useQueryState, parseAsString } from 'nuqs';

export function SearchBar() {
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''));

  return (
    <input
      value={search}
      onChange={(e) => void setSearch(e.target.value || null)}
      placeholder="Search..."
    />
  );
}
```

The URL will update to `?search=hello` as the user types.

## Multiple URL parameters

Manage several query parameters together:

```typescript
import z from 'zod';
import { useQueryStates, parseAsString, parseAsStringEnum } from 'nuqs';

const sortValuesSchema = z.enum(['RECENT', 'POPULAR', 'ALPHABETICAL']);
const SORT_VALUES = sortValuesSchema.enum;
const SORT_VALUES_ARRAY = Object.values(SORT_VALUES);
type SortValue = z.infer<typeof sortValuesSchema>;

export function ChallengeFilters() {
  const [{ search, sort }, setQueryStates] = useQueryStates({
    search: parseAsString.withDefault(''),
    sort: parseAsStringEnum(SORT_VALUES_ARRAY).withDefault(SORT_VALUES.RECENT),
  });

  return (
    <div className="flex gap-3">
      <input
        value={search}
        onChange={(e) => void setQueryStates({ search: e.target.value || null })}
        placeholder="Search challenges..."
      />
      <select
        value={sort}
        onChange={(e) => void setQueryStates({ sort: (e.target.value as SortValue) })}
        className="rounded-md border px-3 py-2"
      >
        {SORT_VALUES_ARRAY.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </div>
  );
}
```

URL becomes: `?search=react&sort=POPULAR`

## Pagination in URL

```typescript
import { useQueryStates, parseAsInteger } from 'nuqs';

export function PaginatedList() {
  const [{ page, limit }, setParams] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    limit: parseAsInteger.withDefault(20),
  });

  const handlePrevious = () => setParams({ page: page - 1 });
  const handleNext = () => setParams({ page: page + 1 });

  return (
    <div>
      {/* List content */}
      <div className="flex gap-2 mt-4">
        <button onClick={handlePrevious} disabled={page === 1}>
          Previous
        </button>
        <span>Page {page}</span>
        <button onClick={handleNext}>
          Next
        </button>
      </div>
    </div>
  );
}
```

## Filter with multiple values

```typescript
import { useQueryStates, parseAsStringEnum } from 'nuqs';

export function FilterByStatus() {
  const [{ status }, setParams] = useQueryStates({
    status: parseAsStringEnum(['ACTIVE', 'ARCHIVED', 'PENDING']).withDefault('ACTIVE'),
  });

  return (
    <div className="flex gap-2">
      <button
        className={status === 'ACTIVE' ? 'bg-blue-500' : ''}
        onClick={() => setParams({ status: 'ACTIVE' })}
      >
        Active
      </button>
      <button
        className={status === 'ARCHIVED' ? 'bg-blue-500' : ''}
        onClick={() => setParams({ status: 'ARCHIVED' })}
      >
        Archived
      </button>
      <button
        className={status === 'PENDING' ? 'bg-blue-500' : ''}
        onClick={() => setParams({ status: 'PENDING' })}
      >
        Pending
      </button>
    </div>
  );
}
```

## Clear URL parameters

```typescript
import { useQueryStates, parseAsString } from 'nuqs';

export function ClearableFilters() {
  const [filters, setFilters] = useQueryStates({
    search: parseAsString,
    category: parseAsString,
    status: parseAsString,
  });

  const clearFilters = () => {
    void setFilters({
      search: null,
      category: null,
      status: null,
    });
  };

  const hasFilters = Object.values(filters).some((v) => v !== null);

  return (
    <div>
      {/* Filter inputs */}
      {hasFilters && (
        <button onClick={clearFilters} className="text-blue-500">
          Clear filters
        </button>
      )}
    </div>
  );
}
```

## Date range in URL

```typescript
import { useQueryStates, parseAsString } from 'nuqs';

export function DateRangeFilter() {
  const [{ startDate, endDate }, setParams] = useQueryStates({
    startDate: parseAsString.withDefault(''),
    endDate: parseAsString.withDefault(''),
  });

  const handleDateChange = (key: 'startDate' | 'endDate', value: string) => {
    setParams({ [key]: value || null });
  };

  return (
    <div className="flex gap-4">
      <div>
        <label>Start date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => handleDateChange('startDate', e.target.value)}
        />
      </div>
      <div>
        <label>End date</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => handleDateChange('endDate', e.target.value)}
        />
      </div>
    </div>
  );
}
```

## Preserve state across navigation

URL state is preserved automatically by nuqs, so when users share a link or use the back button, filters and pagination state are maintained:

```typescript
// User visits /challenges?search=react&sort=POPULAR
// Filters are loaded automatically
// User can share this URL with others
// Back button restores the exact state
```

## Benefits of URL state

1. **Shareable links** - Users can copy the URL with filters and share with others
2. **Browser history** - Back/forward buttons work correctly with filters applied
3. **Bookmarkable** - Users can bookmark specific filter combinations
4. **SEO-friendly** - Search engine crawlers see the filtered content
5. **Persistent state** - Page refresh maintains the state

## Best practices

### Use meaningful parameter names

```typescript
// Good - clear intent
const [{ pageNumber, itemsPerPage }, setParams] = useQueryStates({
  pageNumber: parseAsInteger.withDefault(1),
  itemsPerPage: parseAsInteger.withDefault(20),
});

// Avoid - unclear
const [{ p, n }, setParams] = useQueryStates({
  p: parseAsInteger.withDefault(1),
  n: parseAsInteger.withDefault(20),
});
```

### Clear parameters explicitly

When clearing, set to `null` rather than empty string:

```typescript
// Good
void setParams({ search: null });

// Less clear
void setParams({ search: '' });
```

### Validate parameter values

Use `parseAsStringEnum` for restricted choices:

```typescript
const [{ view }, setParams] = useQueryStates({
  view: parseAsStringEnum(['GRID', 'LIST']).withDefault('GRID'),
});
```

This prevents invalid URL parameters like `?view=INVALID`.
