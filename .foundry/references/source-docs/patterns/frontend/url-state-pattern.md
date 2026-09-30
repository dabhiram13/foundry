# URL State Pattern (nuqs)

## When to Use

- Filter/sort/pagination state that must survive refresh, sharing, and back/forward navigation
- Any UI state that belongs in the URL (tabs, search queries, modal open states, view modes)
- Replacing manual `filtersFromSearchParams()` + `filtersCacheKey()` patterns (see `features/posts/filter-schema.ts`)


## Server-Side (RSC)

### createSearchParamsCache -- for deeply nested RSC access

```tsx
// lib/search-params/posts.ts
import {
  createSearchParamsCache, parseAsString, parseAsInteger, parseAsStringLiteral,
} from "nuqs/server";

export const postsParsers = {
  q: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  sort_by: parseAsStringLiteral(["created_at", "title", "view_count"] as const)
    .withDefault("created_at"),
  sort_order: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
};

export const postsParamsCache = createSearchParamsCache(postsParsers);
```

```tsx
// app/protected/posts/page.tsx -- Next.js 15: searchParams is a Promise
import { postsParamsCache } from "@/lib/search-params/posts";

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // MUST call .parse() at page level -- populates the request-scoped React cache
  const { q, page, sort_by } = await postsParamsCache.parse(searchParams);
  return <NestedServerComponent />;
}

// Any nested RSC -- no prop drilling
function NestedServerComponent() {
  const page = postsParamsCache.get("page");
  const all = postsParamsCache.all(); // { q, page, sort_by, sort_order }
  return <span>Page {page}</span>;
}
```

### createLoader -- one-shot parse, no cache

```tsx
import { createLoader, parseAsString, parseAsInteger } from "nuqs/server";
const loadSearchParams = createLoader({ q: parseAsString, page: parseAsInteger.withDefault(1) });

// Accepts: string, URL, URLSearchParams, Request, Record, or Promise
export default async function Page({ searchParams }) {
  const { q, page } = await loadSearchParams(searchParams);
}
```

## Client-Side

### useQueryState -- single key

```tsx
"use client";
import { useQueryState, parseAsInteger } from "nuqs";

export function PageSizeSelect() {
  const [perPage, setPerPage] = useQueryState("perPage", parseAsInteger.withDefault(10));
  // perPage: number (non-null due to withDefault)
  // setPerPage(null) clears param and returns default
  // setPerPage returns Promise<URLSearchParams>
  return <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} />;
}
```

### useQueryStates -- multiple keys, atomic updates

```tsx
"use client";
import { useQueryStates } from "nuqs";
import { postsParsers } from "@/lib/search-params/posts"; // reuse same parsers

export function PostFilters() {
  const [filters, setFilters] = useQueryStates(postsParsers);

  const resetFilters = () => setFilters(null);                  // clears ALL keys
  const search = (q: string) => setFilters({ q, page: 1 });    // partial update
  const nextPage = () => setFilters((old) => ({ page: old.page + 1 })); // updater fn
}
```

## Parsers

| Parser | Type | URL example |
|--------|------|-------------|
| `parseAsString` | `string` | `?q=hello` |
| `parseAsInteger` | `number` | `?page=3` |
| `parseAsFloat` | `number` | `?lat=45.18` |
| `parseAsBoolean` | `boolean` | `?dark=true` |
| `parseAsIsoDateTime` | `Date` | `?from=2024-01-01T00:00:00.000Z` |
| `parseAsIsoDate` | `Date` | `?date=2024-01-01` (midnight UTC) |
| `parseAsTimestamp` | `Date` | `?ts=1704067200000` |
| `parseAsStringLiteral(values)` | union | `?sort=asc` -- pass `as const` array |
| `parseAsStringEnum(values)` | enum | `?dir=UP` -- pass `Object.values(MyEnum)` |
| `parseAsNumberLiteral(values)` | union | `?side=6` |
| `parseAsArrayOf(parser, sep?)` | `T[]` | `?tags=a,b,c` (comma default) |
| `parseAsJson(validator)` | `T` | `?data=%7B...%7D` -- pass Zod schema or `(v) => T\|null` |
| `parseAsHex` | `number` | `?color=ff0033` |

Custom parser with `createParser`:
```ts
import { createParser } from "nuqs/server";
const parseAsSlug = createParser({
  parse: (v) => /^[a-z0-9-]+$/.test(v) ? v : null,
  serialize: (v) => v,
});
// Gains .withDefault(), .withOptions(), full builder pattern
```

## Options That Matter

| Option | Default | Effect |
|--------|---------|--------|
| `shallow` | `true` | `true`: client-only URL update. `false`: triggers RSC re-render. |
| `history` | `"replace"` | `"replace"`: overwrites history. `"push"`: back button works. |
| `scroll` | `false` | Scroll to top on update. |
| `clearOnDefault` | `true` | Removes param when value === default. `false` for stable URLs. |
| `limitUrlUpdates` | `throttle(50)` | `throttle(ms)` or `debounce(ms)` -- import from `"nuqs"`. |
| `startTransition` | -- | Pass `useTransition()[1]` for loading states with `shallow: false`. |

Set at parser level or per-call:
```ts
// Parser level
const [q, setQ] = useQueryState("q", parseAsString.withOptions({ shallow: false, history: "push" }));
// Per-call override
setQ("test", { shallow: true });
```

Loading state pattern with `startTransition`:
```tsx
"use client";
const [isLoading, startTransition] = useTransition();
const [q, setQ] = useQueryState("q", parseAsString.withOptions({ shallow: false, startTransition }));
// isLoading is true while server streams RSC response
```

## Serialization for Links

```ts
import { createSerializer, parseAsString, parseAsInteger } from "nuqs/server";
const serialize = createSerializer({ q: parseAsString, page: parseAsInteger });

serialize({ q: "hello", page: 2 });                        // "?q=hello&page=2"
serialize("/posts", { q: "hello", page: 2 });              // "/posts?q=hello&page=2"
serialize("/posts?keep=1", { q: "hello", keep: null });    // "/posts?q=hello" (null removes)
```

```tsx
import Link from "next/link";
<Link href={serialize("/posts", { q: "react", page: 1 })}>Search</Link>
```

## Replaces (in our stack)

| Old pattern | nuqs replacement |
|------------|------------------|
| `filtersFromSearchParams(raw)` | `cache.parse(searchParams)` or `createLoader(parsers)(searchParams)` |
| `filtersCacheKey(filters)` | `JSON.stringify(cache.all())` |
| Manual `typeof raw.x === 'string' && SET.has(raw.x)` | `parseAsStringLiteral([...] as const)` |
| Prop-drilling filters to child RSCs | `cache.get("key")` anywhere in RSC tree |
| Manual query string for `<Link>` | `createSerializer(parsers)("/path", values)` |
| `useSearchParams()` + manual parse | `useQueryState` / `useQueryStates` with typed parsers |

## Gotchas

- **`.parse()` must be called at the Page level.** Calling `.get()` in a child RSC without prior `.parse()` in the page throws. The cache uses React `cache()`, scoped per request.
- **Next.js 15 `searchParams` is a Promise.** Always `await cache.parse(searchParams)`. Both `createSearchParamsCache.parse()` and `createLoader()` accept Promises.
- **Import from `nuqs/server` for server code.** The `"nuqs"` entry has `"use client"` -- importing it in RSC files causes build errors. Parsers exist in both; always use `"nuqs/server"` in shared definition files.
- **`withDefault()` does NOT write to the URL.** The default is React-internal only. URL stays clean. If you need the value in the URL, set it explicitly.
- **`clearOnDefault: true` silently removes params.** If your default changes between deploys, bookmarked URLs change meaning. Use `false` for stable/shareable URLs.
- **`shallow: true` (default) skips RSC re-render.** URL updates but server components do NOT re-execute. Need server data to update? Set `shallow: false` + `startTransition`.
- **Share parser definitions.** Define once in `lib/search-params/`, reuse for `createSearchParamsCache`, `useQueryStates`, `createSerializer`. Never duplicate parser objects.
- **Safari rate-limits History API aggressively.** Default 50ms works for Chrome/FF. Use `limitUrlUpdates: throttle(120)` or `debounce(300)` for text inputs targeting Safari.
- **`parseAsJson` accepts any valid JSON without a validator.** Always pass a Zod schema or validation function to prevent garbage data.
- **Batched updates share one URL write.** `setA(1); setB(2)` in the same tick produces one URL update. The returned Promise resolves after flush.
