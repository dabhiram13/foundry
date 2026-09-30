# Virtual Scroll Pattern (@tanstack/react-virtual)

## Install

```bash
npm install @tanstack/react-virtual
```

## Core: Virtualized List

```tsx
"use client";
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export function VirtualList({ items }: { items: { id: string; label: string }[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 48,
    overscan: 5,
  });

  return (
    <div ref={scrollRef} className="h-[400px] overflow-auto rounded-md border">
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((vRow) => (
          <div
            key={vRow.key}
            className="absolute left-0 top-0 w-full px-4 py-2"
            style={{ height: `${vRow.size}px`, transform: `translateY(${vRow.start}px)` }}
          >
            {items[vRow.index].label}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Three-layer structure**: scroll container (fixed height + `overflow-auto`) > inner div (`height: getTotalSize()`) > absolutely-positioned items (`translateY(start)`).

### API Quick Ref

**Options**: `count` (required), `getScrollElement` (required), `estimateSize` (required), `overscan` (default 1, use 5+), `horizontal`, `getItemKey`, `gap` (v3.11+), `lanes` (masonry), `enabled`.
**Instance**: `getVirtualItems()`, `getTotalSize()`, `scrollToIndex(i, { align, behavior })`, `measure()`.
**VirtualItem**: `key`, `index`, `start` (px offset), `end`, `size`.

## Dynamic Row Heights

```tsx
"use client";
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export function DynamicHeightList({ items }: { items: string[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 60,
  });

  return (
    <div ref={scrollRef} className="h-[500px] overflow-auto">
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((vRow) => (
          <div
            key={vRow.key}
            ref={(node) => virtualizer.measureElement(node)}
            data-index={vRow.index}
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${vRow.start}px)` }}
          >
            <div className="border-b p-4">{items[vRow.index]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Critical**: `data-index={vRow.index}` on the measured element is REQUIRED. The virtualizer reads this attribute to map DOM nodes back to virtual items. Do NOT set explicit `height` -- let content flow naturally.

## Virtualized Table (with TanStack Table)

```tsx
"use client";
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";

export function VirtualTable<T>({ data, columns }: { data: T[]; columns: ColumnDef<T, unknown>[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  const { rows } = table.getRowModel();
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });
  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div ref={scrollRef} className="h-[600px] overflow-auto rounded-md border">
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-background">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className="px-4 py-2 text-left text-sm font-medium">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {virtualRows.length > 0 && (
            <tr><td style={{ height: virtualRows[0].start }} colSpan={columns.length} /></tr>
          )}
          {virtualRows.map((vRow) => {
            const row = rows[vRow.index];
            return (
              <tr key={row.id} ref={(n) => virtualizer.measureElement(n)} data-index={vRow.index}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2 text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
          {virtualRows.length > 0 && (
            <tr><td style={{ height: virtualizer.getTotalSize() - (virtualRows.at(-1)?.end ?? 0) }} colSpan={columns.length} /></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

**Tables use spacer `<tr>` rows** (top + bottom) instead of `translateY` -- absolute positioning breaks `<table>` layout. `<thead>` uses `sticky top-0` for pinned headers.

## Infinite Scroll + Virtual

```tsx
"use client";
import { useRef, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { client } from "@/lib/orpc/client";

export function InfiniteVirtualList() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["items"],
    queryFn: ({ pageParam }) => client.protected.items.list({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];
  const virtualizer = useVirtualizer({
    count: hasNextPage ? allItems.length + 1 : allItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 64,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastItem = virtualItems.at(-1);
  useEffect(() => {
    if (lastItem && lastItem.index >= allItems.length - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [lastItem?.index, allItems.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div ref={scrollRef} className="h-[600px] overflow-auto">
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualItems.map((vRow) => (
          <div
            key={vRow.key}
            className="absolute left-0 top-0 w-full"
            style={{ height: `${vRow.size}px`, transform: `translateY(${vRow.start}px)` }}
          >
            {vRow.index < allItems.length
              ? <div className="border-b px-4 py-3">{allItems[vRow.index].title}</div>
              : <div className="px-4 py-3 text-muted-foreground">Loading...</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

Key trick: `count` is `allItems.length + 1` when `hasNextPage` -- the extra phantom item triggers the fetch effect when it enters the viewport.

## Horizontal Virtualization

Set `horizontal: true`. Swap all axes: container uses `overflow-x-auto` + fixed width, inner div sets `width` (not height) to `getTotalSize()`, items use `translateX` + explicit `width` instead of `translateY` + `height`.

## Gotchas

- **Scroll container MUST have fixed height + `overflow-auto`**. Without both, the virtualizer cannot calculate the viewport. This is the #1 mistake.
- **Inner div MUST use `height: getTotalSize()px`**. Without it, no scrollbar renders and virtualization is invisible.
- **`data-index` is REQUIRED on `measureElement` targets**. The virtualizer reads this DOM attribute to identify items. Missing it = silent measurement failure.
- **Do NOT set `height` on items using `measureElement`**. Let the DOM determine size naturally.
- **Tables: use spacer `<tr>` rows, not `translateY`**. Absolute positioning breaks `<table>` semantics.
- **`estimateSize` should approximate actual size**. Large mismatches cause scroll jumps as items are measured.
- **`overscan` defaults to 1** -- causes visible pop-in on fast scroll. Use 5+ for production.
- **`getItemKey` matters for dynamic lists** where items reorder or are inserted/removed. Without stable keys, stale measurements get reused.
- **`scrollToIndex` only works after mount**. Call it in `useEffect` or event handlers, never during render.
- **Always `"use client"`**. `useVirtualizer` reads DOM measurements and returns zero items on server render.
