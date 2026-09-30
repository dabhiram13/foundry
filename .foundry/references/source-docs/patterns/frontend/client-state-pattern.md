# Client State Pattern (Zustand)

## When to Use

Zustand is for **ephemeral complex client state shared across distant components** that does NOT belong in the URL.

This is the **rarest** state pattern. Most features use URL state (nuqs) or local state (useState). Only reach for Zustand when both fail.

## Decision Table (read this FIRST)

| Signal | Use | Pattern |
|--------|-----|---------|
| State should survive refresh / be shareable via link | **nuqs** | `url-state-pattern.md` |
| State is local to one component | **useState** | Plain React |
| State is shared across distant components AND ephemeral AND complex | **Zustand** | This file |

### Zustand is correct when ALL THREE are true:

1. **Shared** — 2+ distant components need read/write access (not parent-child)
2. **Ephemeral** — state resets on refresh (NOT filters, tabs, pagination, search)
3. **Complex** — nested objects, arrays, or computed derivations (not a single boolean)

### Concrete examples where Zustand fits:

| Feature | Why Zustand | Why NOT nuqs |
|---------|-------------|--------------|
| Kanban drag state + toolbar actions | Toolbar reads selected items from board | Selection is ephemeral, resets on refresh |
| Multi-select across a list + bulk action bar | Action bar reads selected IDs from list rows | 50 selected IDs don't belong in URL |
| Real-time presence/cursors | Sidebar shows who's online, editor shows cursors | Presence is transient, not URL-worthy |
| Undo/redo stack | Toolbar triggers undo, editor applies it | History stack is complex nested state |
| Builder/composer with preview | Form panel writes, preview panel reads | Draft state is complex object tree |
| Shopping cart across pages | Cart icon reads count, checkout reads items | Cart persists in localStorage, not URL |
| Notification queue | Toast system reads, any component writes | Queue is ephemeral array |

### Examples where Zustand is WRONG (use nuqs instead):

| Feature | Tempting but wrong | Correct |
|---------|--------------------|---------|
| Active tab | "It's just UI state" | nuqs — user expects back button + sharing |
| Search query | "It's client input" | nuqs — must survive refresh |
| Sort order | "It's a dropdown" | nuqs — shareable, bookmarkable |
| Modal open/close | "It's ephemeral" | nuqs or useState — one component, not shared |
| Pagination | "It's just a number" | nuqs — back button must work |
| Filters | "Complex object" | nuqs — `parseAsJson` or `useQueryStates` handles this |
| Dark mode toggle | "Global state" | CSS `prefers-color-scheme` or cookie — not Zustand |

**Rule of thumb:** if a PM would say "why can't I share this link?", it belongs in nuqs.

## Store Setup

### File location

```
webapp/stores/{feature}.ts     -- one store per feature, never a global mega-store
```

### Basic store

```ts
// webapp/stores/kanban-selection.ts
import { create } from "zustand";

interface KanbanSelectionState {
  selectedIds: Set<string>;
  // Actions — colocated, not separate
  select: (id: string) => void;
  deselect: (id: string) => void;
  toggle: (id: string) => void;
  clear: () => void;
}

export const useKanbanSelection = create<KanbanSelectionState>((set) => ({
  selectedIds: new Set(),
  select: (id) =>
    set((state) => ({ selectedIds: new Set(state.selectedIds).add(id) })),
  deselect: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      next.delete(id);
      return { selectedIds: next };
    }),
  toggle: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { selectedIds: next };
    }),
  clear: () => set({ selectedIds: new Set() }),
}));
```

### Consuming in components

```tsx
"use client";

// Kanban item — deep in the tree
function KanbanCard({ id }: { id: string }) {
  // Selector: component only re-renders when THIS item's selection changes
  const isSelected = useKanbanSelection((s) => s.selectedIds.has(id));
  const toggle = useKanbanSelection((s) => s.toggle);
  return (
    <div data-selected={isSelected} onClick={() => toggle(id)}>
      ...
    </div>
  );
}

// Toolbar — distant sibling component
function BulkActionBar() {
  const count = useKanbanSelection((s) => s.selectedIds.size);
  const clear = useKanbanSelection((s) => s.clear);
  if (count === 0) return null;
  return (
    <div>
      {count} selected
      <button onClick={clear}>Clear</button>
      <button>Delete selected</button>
    </div>
  );
}
```

### Store with persistence (localStorage)

Only for state that must survive tab close (e.g., cart, draft).

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) => set((s) => ({ items: [...s.items, item] })),
      removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    { name: "cart-storage" }, // localStorage key
  ),
);
```

## Best Practices

### 1. One store per feature, not one global store

```ts
// GOOD
useKanbanSelection()   // kanban selection state
useCartStore()         // shopping cart state
usePresenceStore()     // real-time presence

// BAD — mega store
useAppStore()          // everything in one blob
```

### 2. Use selectors — never subscribe to the whole store

```tsx
// GOOD — only re-renders when bears changes
const bears = useStore((s) => s.bears);

// BAD — re-renders on ANY state change
const store = useStore();
const { bears } = store;
```

### 3. Actions live inside the store, not outside

```ts
// GOOD — actions are part of the store
create<State>((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
}));

// BAD — actions defined outside
const increment = () => useStore.setState((s) => ({ count: s.count + 1 }));
```

### 4. Keep state flat — avoid deep nesting

```ts
// GOOD
{ userId: "1", userName: "Alice", selectedIds: new Set() }

// BAD
{ user: { profile: { name: "Alice" }, preferences: { selected: { ids: [] } } } }
```

### 5. Immutable updates — always return new references

```ts
// GOOD
set((s) => ({ items: [...s.items, newItem] }));
set((s) => ({ items: s.items.filter((i) => i.id !== id) }));

// BAD — mutating in place
set((s) => { s.items.push(newItem); return s; });
```

## SSR / Next.js App Router Rules

1. **Zustand stores are client-only.** Never import a store in a server component.
2. **No providers needed.** Unlike Context, Zustand works without wrapping your app.
3. **Hydration mismatch with `persist` middleware.** The server renders with initial state, client hydrates from localStorage. Fix:

```tsx
"use client";
import { useEffect, useState } from "react";

function CartCount() {
  const [mounted, setMounted] = useState(false);
  const count = useCartStore((s) => s.items.length);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <span>0</span>; // SSR-safe fallback

  return <span>{count}</span>;
}
```

4. **Server data initializes client stores via props**, not by importing stores in RSC:

```tsx
// Server component fetches, passes to client
async function BoardPage() {
  const items = await getItems(); // oRPC / RSC fetch
  return <BoardClient initialItems={items} />;
}

// Client component initializes store from props
"use client";
function BoardClient({ initialItems }: { initialItems: Item[] }) {
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!initialized) {
      useBoardStore.setState({ items: initialItems });
      setInitialized(true);
    }
  }, [initialItems, initialized]);
  return <Board />;
}
```

## Anti-Patterns (agents MUST avoid)

| Anti-Pattern | Why it's wrong | Fix |
|--------------|---------------|-----|
| Storing server data in Zustand | Duplicates oRPC/TanStack Query cache, goes stale | Use oRPC + `useQuery` for server state |
| Storing URL-worthy state in Zustand | Breaks sharing, back button, bookmarks | Use nuqs |
| One mega store for the whole app | Everything re-renders, impossible to reason about | One store per feature |
| Reading full store without selector | Causes unnecessary re-renders everywhere | Always use `(s) => s.specificField` |
| Using Zustand for parent-child state | Overkill, props or useState suffice | Props or useState |
| Importing store in server component | Will crash — stores are client-only | Pass data via props from RSC |
| `persist` without hydration guard | SSR/client mismatch, flash of wrong content | Use `mounted` state guard |

## Gotchas

- **`set` merges shallowly by default.** `set({ a: 1 })` keeps existing keys. For nested updates, spread manually.
- **Selector equality is `Object.is` by default.** Returning a new object/array from a selector causes re-render. Use `useShallow` for object selectors:
  ```ts
  import { useShallow } from "zustand/shallow";
  const { name, age } = useStore(useShallow((s) => ({ name: s.name, age: s.age })));
  ```
- **Stores are singletons.** In Next.js, one store instance per client session. This is fine for SPAs but be aware during testing (reset between tests).
- **`persist` uses `JSON.stringify`.** `Set`, `Map`, `Date` won't survive. Use a custom serializer or store as arrays.
- **Actions referencing stale state.** Use the callback form: `set((state) => ...)`, not `set({ count: count + 1 })`.

## State Architecture Summary

```
Server state (95% of data)
  --> oRPC procedures + TanStack Query (useQuery/useMutation)
  --> RSC data fetching with cache/cacheLife/cacheTag

URL state (most client interactivity)
  --> nuqs (filters, search, tabs, pagination, sort, modals, wizard steps)
  --> url-state-pattern.md

Local component state (simple toggles)
  --> useState (dropdown open, input focus, animation state)

Shared ephemeral client state (RARE — this pattern)
  --> Zustand (multi-select, drag state, undo stack, cart, presence)
  --> One store per feature, selectors always, client-only
```
