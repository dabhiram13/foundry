# Data Table Pattern

## When to Use
- Tabular data with sorting, filtering, pagination, column visibility
- Server-side data via oRPC with URL-persisted state (nuqs)

## Prerequisite
`NuqsAdapter` must wrap the app in root layout. See `webapp/app/layout.tsx`.

## File Inventory

| File | Purpose |
|------|---------|
| `components/data-table/data-table.tsx` | `<DataTable table={table}>` — renders table + pagination + action bar |
| `components/data-table/data-table-toolbar.tsx` | `<DataTableToolbar table={table}>` — auto-renders filters from column meta |
| `components/data-table/data-table-column-header.tsx` | `<DataTableColumnHeader column={column} label="Title" />` — sort/hide dropdown |
| `components/data-table/data-table-pagination.tsx` | `<DataTablePagination table={table} />` — page size + nav (auto-included by DataTable) |
| `components/data-table/data-table-skeleton.tsx` | `<DataTableSkeleton columnCount={5} rowCount={10} />` — loading state |
| `components/data-table/data-table-faceted-filter.tsx` | Select/multi-select filter (auto-rendered by toolbar) |
| `components/data-table/data-table-date-filter.tsx` | Date/dateRange filter (auto-rendered by toolbar) |
| `components/data-table/data-table-slider-filter.tsx` | Range slider filter (auto-rendered by toolbar) |
| `components/data-table/data-table-view-options.tsx` | Column visibility toggle (auto-included by toolbar) |
| `hooks/use-data-table.ts` | `useDataTable({ data, columns, pageCount })` — bridges TanStack Table + nuqs URL state |
| `types/data-table.ts` | TanStack Table module augmentation: `ColumnMeta` with `variant`, `options`, `range`, `unit`, `icon` |
| `config/data-table.ts` | Operator configs per filter variant |
| `lib/data-table.ts` | `getColumnPinningStyle()`, `getFilterOperators()`, `getValidFilters()` |
| `lib/parsers.ts` | nuqs parsers: `getSortingStateParser()`, `getFiltersStateParser()` |

## Column Definition Contract

The agent defines columns in the feature's component. Each filterable column needs `meta` and `enableColumnFilter: true`.

```tsx
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import type { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<YourType>[] = [
  {
    id: "title",
    accessorKey: "title",
    header: ({ column }) => <DataTableColumnHeader column={column} label="Title" />,
    cell: ({ row }) => <div className="max-w-[500px] truncate">{row.getValue("title")}</div>,
    meta: {
      label: "Title",
      placeholder: "Search titles...",
      variant: "text",        // ← determines which filter UI renders
      icon: TextIcon,         // ← lucide icon shown in filter
    },
    enableColumnFilter: true, // ← opt-in, default is false
  },
  {
    id: "status",
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} label="Status" />,
    meta: {
      label: "Status",
      variant: "multiSelect",
      options: [
        { label: "Active", value: "active", icon: CheckCircle },
        { label: "Archived", value: "archived", icon: Archive },
      ],
    },
    enableColumnFilter: true,
  },
  {
    id: "amount",
    accessorKey: "amount",
    header: ({ column }) => <DataTableColumnHeader column={column} label="Amount" />,
    meta: { label: "Amount", variant: "range", range: [0, 1000], unit: "$" },
    enableColumnFilter: true,
  },
  {
    id: "createdAt",
    accessorKey: "created_at",
    header: ({ column }) => <DataTableColumnHeader column={column} label="Created" />,
    meta: { label: "Created", variant: "date" },
    enableColumnFilter: true,
  },
];
```

### Filter Variant → UI Mapping (automatic)

| `meta.variant` | UI rendered by toolbar | `meta` extras needed |
|----------------|----------------------|---------------------|
| `text` | Text input | `placeholder` |
| `number` | Number input | `unit` (optional) |
| `range` | Slider | `range: [min, max]` |
| `date` | Date picker | — |
| `dateRange` | Date range picker | — |
| `boolean` | Toggle | — |
| `select` | Faceted filter (single) | `options: { label, value, icon?, count? }[]` |
| `multiSelect` | Faceted filter (multi) | `options: { label, value, icon?, count? }[]` |

## Wiring: oRPC → Page → Table

### 1. oRPC Procedure (Backend Connector decides shape)

The procedure must return `{ data: T[], pageCount: number }`. The URL query params (page, perPage, sort, filters) are parsed by `useDataTable` via nuqs and should be forwarded to the procedure.

### 2. Page Component (Server Component)

```tsx
// app/protected/{feature}/page.tsx
import { Suspense } from "react";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { {Feature}Table } from "@/features/{feature}/components/{feature}-table";

export default function {Feature}Page() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{Feature}</h1>
        <p className="text-muted-foreground">Description here.</p>
      </div>
      <Suspense fallback={<DataTableSkeleton columnCount={5} filterCount={2} />}>
        <{Feature}TableServer />
      </Suspense>
    </div>
  );
}
```

### 3. Server Data Fetcher → Client Table

```tsx
// features/{feature}/components/{feature}-table-server.tsx
import { getORPCCaller } from "@/lib/orpc/server";
import { {Feature}Table } from "./{feature}-table";

export async function {Feature}TableServer() {
  // Fetch initial data server-side. Client takes over with useDataTable.
  const caller = await getORPCCaller();
  const result = await caller.protected.{feature}.list({});
  return <{Feature}Table initialData={result.data} pageCount={result.pageCount} />;
}
```

### 4. Client Table Component

```tsx
// features/{feature}/components/{feature}-table.tsx
"use client";

import { useDataTable } from "@/hooks/use-data-table";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { columns } from "./{feature}-columns"; // column defs

interface {Feature}TableProps {
  initialData: YourType[];
  pageCount: number;
}

export function {Feature}Table({ initialData, pageCount }: {Feature}TableProps) {
  const { table } = useDataTable({
    data: initialData,
    columns,
    pageCount,
    initialState: {
      sorting: [{ id: "createdAt", desc: true }],
      pagination: { pageSize: 10 },
    },
    getRowId: (row) => row.id,
  });

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table} />
    </DataTable>
  );
}
```

## Row Actions

Use `DataTableRowAction` type from `types/data-table.ts`:

```tsx
import type { DataTableRowAction } from "@/types/data-table";

// In column defs, add an actions column:
{
  id: "actions",
  cell: ({ row }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setRowAction({ row, variant: "update" })}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setRowAction({ row, variant: "delete" })}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  enableSorting: false,
  enableHiding: false,
}
```

## Action Bar on Row Selection

```tsx
import { ActionBar } from "@/components/ui/action-bar";

function TableActionBar({ table }: { table: Table<YourType> }) {
  const rows = table.getFilteredSelectedRowModel().rows;
  return (
    <ActionBar
      open={rows.length > 0}
      onOpenChange={(open) => { if (!open) table.toggleAllRowsSelected(false); }}
    >
      {/* Bulk action buttons */}
    </ActionBar>
  );
}

// Pass to DataTable:
<DataTable table={table} actionBar={<TableActionBar table={table} />}>
```

## Gotchas

- `useDataTable` sets `manualPagination`, `manualSorting`, `manualFiltering` to `true` — data is server-driven, table doesn't sort/filter/paginate client-side
- `enableColumnFilter` defaults to `false` — must opt-in per column
- Columns without `meta.variant` won't render a filter even with `enableColumnFilter: true`
- URL state keys: `page`, `perPage`, `sort`, `filters`, `joinOperator` — customizable via `queryKeys` prop on `useDataTable`
- `DataTableColumnHeader` prop is `label` (not `title`) in our codebase
- Skeleton: use `<DataTableSkeleton columnCount={N} filterCount={N} />` as Suspense fallback
