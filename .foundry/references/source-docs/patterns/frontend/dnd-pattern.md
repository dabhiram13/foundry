# Drag & Drop Pattern (dnd-kit)

## When to Use
- Sortable lists (reorderable settings, priority queues, playlist editors)
- Kanban boards -- use the `<Kanban>` wrapper from `@/components/ui/kanban` instead (see `kanban-pattern.md`)
- Drag-to-reorder grids, file upload drop zones, or any custom drag interaction

For kanban, **always use our wrapper**. This file covers raw dnd-kit for everything else.

## Install

Already installed. Do NOT reinstall or change versions.

```
@dnd-kit/core ^6.3.1  |  @dnd-kit/sortable ^10.0.0  |  @dnd-kit/utilities ^3.2.2  |  @dnd-kit/modifiers ^9.0.0
```

## Core: Single Sortable List

All DnD components require `'use client'`.

```tsx
'use client'

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useState } from 'react'

interface Item { id: string; label: string }

export function SortableList({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id)
      const newIndex = prev.findIndex((i) => i.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item) => <SortableItem key={item.id} item={item} />)}
      </SortableContext>
    </DndContext>
  )
}
```

**Key rules:**
- `SortableContext items` must be an array of `UniqueIdentifier` (string | number), NOT the objects
- `arrayMove(array, from, to)` returns a new array -- does NOT mutate
- `DndContext` must wrap `SortableContext`; they cannot be siblings

## Sortable Item Component

```tsx
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'

function SortableItem({ item }: { item: Item }) {
  const {
    attributes,    // aria-* props for the draggable
    listeners,     // onPointerDown, onKeyDown handlers
    setNodeRef,    // attach to the DOM element
    transform,     // { x, y, scaleX, scaleY } during drag
    transition,    // CSS transition string
    isDragging,    // true while being dragged
  } = useSortable({ id: item.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('rounded-md border bg-card p-3', isDragging && 'opacity-50')}
      {...attributes}
      {...listeners}
    >
      {item.label}
    </div>
  )
}
```

### Drag Handle Pattern

When the item has clickable elements (buttons, links), use a separate handle:

```tsx
function SortableItemWithHandle({ item }: { item: Item }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id: item.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <button ref={setActivatorNodeRef} {...attributes} {...listeners} className="cursor-grab">
        <GripVertical className="size-4" />
      </button>
      <span>{item.label}</span>
      <Button onClick={() => {/* clicks work normally */}}>Edit</Button>
    </div>
  )
}
```

`setActivatorNodeRef` goes on the handle. `setNodeRef` stays on the outer container.

## DragOverlay

Without it, the original element moves during drag causing layout shifts and z-index issues. Renders a portal clone.

```tsx
import { DndContext, DragOverlay, type DragStartEvent } from '@dnd-kit/core'
import { createPortal } from 'react-dom'

function SortableListWithOverlay({ items }: { items: Item[] }) {
  const [activeItem, setActiveItem] = useState<Item | null>(null)

  return (
    <DndContext
      onDragStart={(e: DragStartEvent) => setActiveItem(items.find((i) => i.id === e.active.id) ?? null)}
      onDragEnd={(e) => { setActiveItem(null); /* arrayMove logic */ }}
      /* sensors, collisionDetection... */
    >
      <SortableContext items={items.map((i) => i.id)} /* strategy */>
        {items.map((item) => <SortableItem key={item.id} item={item} />)}
      </SortableContext>
      {createPortal(
        <DragOverlay>{activeItem ? <ItemPreview item={activeItem} /> : null}</DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}
```

Style the original with `opacity-50` via `isDragging` so users see a ghost in-place.

## Sensors

```tsx
import { PointerSensor, KeyboardSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },  // CRITICAL: prevents click hijacking
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates, // Space/Enter to grab, arrows to move, Escape to cancel
  }),
  useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 5 }, // distinguish scroll from drag on mobile
  }),
)
```

**Always set `activationConstraint` on PointerSensor.** Without it, every mousedown starts a drag and onClick never fires.

## Collision Detection

| Algorithm | Use When |
|-----------|----------|
| `closestCenter` | **Default for sortable lists.** Compares center points. Best for uniform-size items. |
| `closestCorners` | Varying-size items. Uses corners for better edge detection. |
| `rectIntersection` | Drop zones (file upload areas). Activates when rects overlap. |
| `pointerWithin` | Nested containers (kanban). Uses pointer position, not rect overlap. |

For multi-container, combine strategies. See `kanban.tsx` -- uses `pointerWithin` for items, `closestCenter` for columns.

## Persistence Pattern

Optimistic update local state, persist to server, rollback on error.

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { client } from '@/lib/orpc/client'

function useSortableList(initialItems: Item[]) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)

  const { mutate: reorder } = useMutation({
    mutationFn: (input: { itemId: string; newPosition: number }) =>
      client.protected.{feature}.reorder(input),
    onSuccess: () => router.refresh(),
    onError: () => setItems(initialItems), // rollback
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    setItems(arrayMove(items, oldIndex, newIndex)) // optimistic
    reorder({ itemId: active.id as string, newPosition: newIndex })
  }

  return { items, sensors, handleDragEnd }
}
```

Backend: update moved item's `position` column, shift siblings. Use a transaction.

## Accessibility

1. **Always include KeyboardSensor** -- Space/Enter to grab, arrows to move, Escape to cancel.
2. **Screen reader announcements** via `DndContext accessibility` prop:

```tsx
<DndContext accessibility={{
  announcements: {
    onDragStart: ({ active }) => `Picked up item ${active.id}`,
    onDragOver: ({ active, over }) => over ? `Item ${active.id} over position ${over.id}` : '',
    onDragEnd: ({ active, over }) => over ? `Dropped ${active.id} at ${over.id}` : '',
    onDragCancel: ({ active }) => `Cancelled. ${active.id} returned.`,
  },
  screenReaderInstructions: {
    draggable: 'Press space to pick up. Arrow keys to move. Space to drop, escape to cancel.',
  },
}} />
```

3. **`attributes` from `useSortable`** already include `role="button"`, `tabIndex`, `aria-roledescription`. Always spread them.

## Gotchas

- **`SortableContext items` must be IDs, not objects.** Passing objects causes re-mount on every render.
- **Missing `activationConstraint` on PointerSensor blocks all clicks** on draggable items. Always `distance: 8`.
- **Use `CSS.Transform.toString()` not `CSS.Translate.toString()`** -- Transform preserves scaleX/scaleY for layout shift compensation. Translate drops scale and causes visual jumps.
- **`DragOverlay` must be inside `DndContext`** but outside `SortableContext`. It portals to document.body.
- **ID uniqueness across all SortableContexts** -- shared IDs cause undefined behavior. Prefix if needed.
- **`arrayMove` returns a new array** -- never `items.splice()`. Always `setItems(arrayMove(...))`.
- **SSR hydration** -- `DragOverlay` uses `document.body`. Guard with `useEffect` + mounted state to defer portal. The kanban wrapper handles this internally.
- **Touch scroll conflict** -- without `TouchSensor` delay, dragging prevents scrolling on mobile. Always `delay: 250, tolerance: 5`.
