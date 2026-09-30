# Kanban Pattern

## When to Use
- Board/column view with drag-to-reorder items and cross-column moves
- Workflow states (todo/in-progress/done), pipeline stages, priority lanes

## File Inventory

| File | Purpose |
|------|---------|
| `components/ui/kanban.tsx` | Full kanban component: `Kanban`, `KanbanBoard`, `KanbanColumn`, `KanbanColumnHandle`, `KanbanItem`, `KanbanItemHandle`, `KanbanOverlay` |
| `lib/compose-refs.ts` | Ref composition utility (used internally by kanban) |

Dependencies (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`) are installed. The kanban component wraps all dnd-kit complexity — **agents do NOT use dnd-kit directly**.

## Component API

### `<Kanban>` (root)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `Record<UniqueIdentifier, T[]>` | Yes | Column ID → items map |
| `onValueChange` | `(columns: Record<UniqueIdentifier, T[]>) => void` | No | Called on every drag (reorder + cross-column) |
| `onMove` | `(event: DragEndEvent & { activeIndex, overIndex }) => void` | No | Called on drop — use for server persistence |
| `getItemValue` | `(item: T) => UniqueIdentifier` | Yes (objects) | Extract unique ID from item. Optional for primitives. |
| `orientation` | `"horizontal" \| "vertical"` | No | Column layout direction. Default: `"horizontal"` |
| `strategy` | `SortableContextProps["strategy"]` | No | Sort strategy. Default: `verticalListSortingStrategy` |
| `flatCursor` | `boolean` | No | Use default cursor instead of grab/grabbing |

### Composition

```tsx
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnHandle,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
} from "@/components/ui/kanban";

<Kanban
  value={columns}
  onValueChange={setColumns}       // optimistic local state
  onMove={handleMove}              // persist to server
  getItemValue={(item) => item.id}
>
  <KanbanBoard>
    {Object.entries(columns).map(([columnId, items]) => (
      <KanbanColumn key={columnId} value={columnId}>
        <KanbanColumnHandle />     {/* drag handle for column reorder */}
        {items.map((item) => (
          <KanbanItem key={item.id} value={item.id} asHandle>
            {/* item content — asHandle makes entire item draggable */}
          </KanbanItem>
        ))}
      </KanbanColumn>
    ))}
  </KanbanBoard>
  <KanbanOverlay />
</Kanban>
```

### Drag Handles vs asHandle

- `<KanbanItem asHandle>` — entire item is draggable (simpler, good default)
- `<KanbanItem>` + `<KanbanItemHandle />` inside — only the handle triggers drag (use when item has interactive elements like buttons/links)
- Same pattern for columns: `<KanbanColumn asHandle>` vs `<KanbanColumn>` + `<KanbanColumnHandle />`

### Dynamic Overlay (recommended)

Shows a preview of the dragged item/column. The render function receives `{ value, variant }`.

```tsx
<KanbanOverlay>
  {({ value, variant }) => {
    if (variant === "column") {
      return <KanbanColumn value={value} className="...">{/* column preview */}</KanbanColumn>;
    }
    const item = findItem(value); // look up from your data
    return <KanbanItem value={value} className="...">{/* item preview */}</KanbanItem>;
  }}
</KanbanOverlay>
```

## Wiring: oRPC → Kanban → Persistence

### 1. Data Shape

The oRPC procedure returns items with a `column_id` (or status/stage field) and a `position` (integer for ordering).

```ts
// Procedure returns flat list; client groups into columns
type KanbanItem = { id: string; title: string; status: string; position: number; };
```

### 2. Client Groups into Column Map

```tsx
function groupByColumn(items: KanbanItem[]): Record<string, KanbanItem[]> {
  const grouped: Record<string, KanbanItem[]> = {};
  for (const item of items) {
    (grouped[item.status] ??= []).push(item);
  }
  // Sort each column by position
  for (const col of Object.values(grouped)) {
    col.sort((a, b) => a.position - b.position);
  }
  return grouped;
}
```

### 3. Reorder Mutation

`onValueChange` updates local state optimistically. `onMove` (or a debounced `onValueChange`) calls the server to persist.

```tsx
"use client";

const [columns, setColumns] = useState(() => groupByColumn(initialItems));

const { mutate: reorder } = useMutation({
  mutationFn: (input: { itemId: string; newStatus: string; newPosition: number }) =>
    client.protected.{feature}.reorder(input),
  onSuccess: () => router.refresh(),
  onError: () => {
    // Rollback: re-group from server data
    setColumns(groupByColumn(initialItems));
  },
});

function handleMove(event: DragEndEvent & { activeIndex: number; overIndex: number }) {
  const { active, over } = event;
  if (!over) return;
  // Determine new column and position from current state
  // Call reorder mutation
}
```

### 4. oRPC Reorder Procedure

The backend needs a procedure that updates `status` and `position` for the moved item, and adjusts positions of siblings.

```ts
// In the oRPC procedure:
.reorder
  .input(z.object({
    itemId: SecureId,
    newStatus: z.enum(["todo", "in_progress", "done"]),
    newPosition: z.number().int().nonnegative(),
  }))
  // Update the item's status + position
  // Shift positions of other items in the target column
  // updateTag("{feature}") for cache invalidation
```

## Styling

The kanban component uses minimal default styles. Apply your project's semantic tokens:

```tsx
<KanbanColumn
  value={columnId}
  className="rounded-lg border bg-muted/50 p-3"  // ← semantic tokens
>
  <div className="flex items-center justify-between pb-2">
    <h3 className="text-sm font-semibold text-foreground">{columnTitle}</h3>
    <Badge variant="secondary">{items.length}</Badge>
  </div>
  {items.map((item) => (
    <KanbanItem
      key={item.id}
      value={item.id}
      asHandle
      className="rounded-md border bg-card p-3 shadow-sm"  // ← card styling
    >
      <p className="text-sm">{item.title}</p>
    </KanbanItem>
  ))}
</KanbanColumn>
```

## Data Attributes for Styling

| Attribute | On | When |
|-----------|----|------|
| `data-dragging` | Column, Item, Handles | Element is being dragged |
| `data-disabled` | Column, Item, Handles | Element is disabled |
| `data-orientation` | Board | `"horizontal"` or `"vertical"` |
| `data-slot` | All | `"kanban-board"`, `"kanban-column"`, `"kanban-item"`, etc. |

Use these for conditional styling: `data-dragging:opacity-50`, `data-dragging:cursor-grabbing`.

## Gotchas

- `getItemValue` is **required** when items are objects (not primitives) — will throw at runtime without it
- `value` prop is a `Record<UniqueIdentifier, T[]>` — column order is determined by object key order
- `KanbanItem value=""` throws — values cannot be empty strings
- `onValueChange` fires on every drag move (for optimistic UI); `onMove` fires only on drop (for persistence)
- The component handles cross-column moves internally — items removed from source and added to target in `onValueChange`
- `KanbanOverlay` renders via `createPortal` to `document.body` — always include it for smooth drag previews
- Column reorder: when `active.id in value && over.id in value`, columns themselves are being reordered (not items)
