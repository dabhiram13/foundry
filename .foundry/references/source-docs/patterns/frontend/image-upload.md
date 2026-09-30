# Image Upload Pattern (Frontend)

Use the built-in `useUploadImage` hook. Don't reinvent compression, progress, or error handling.

## Hook

```ts
import { useUploadImage } from '@/features/_shared/hooks/use-upload-image'

const { upload, isUploading, error, progress } = useUploadImage({
  preset: 'content',
  path: (userId) => `posts/${userId}/${Date.now()}.webp`,
})
```

Returns:
- `upload(file: File) → Promise<{ url, storedKey }>` — compresses, then uploads
- `isUploading: boolean`
- `error: Error | null`
- `progress: number` (0–100)

## Presets

| Preset | Max dim | Max size | Use for |
|---|---|---|---|
| avatar | 512px | 500KB | Profile pictures |
| cover | 1920px | 2MB | Banner / header images |
| content | 800px | 1MB | Post images, inline content |
| thumbnail | 200px | 100KB | Card thumbnails, list previews |

## UI states (required)

Every upload UI must render these five states distinctly. Missing any = design-evaluator failure.

| State | What the user sees |
|---|---|
| Idle | Drop zone: icon + "Drop image or click to browse" |
| Compressing | Spinner + "Optimizing…" (even if <1s, still show) |
| Uploading | Progress bar 0–100% + filename + cancel button |
| Success | Thumbnail preview + "Replace" + "Remove" |
| Error | Red banner + message + "Try again" button |

## Template

```tsx
'use client'
import { useUploadImage } from '@/features/_shared/hooks/use-upload-image'
import { useRef, useState } from 'react'

export function ImageDropzone({ onUploaded }: { onUploaded: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const { upload, isUploading, error, progress } = useUploadImage({
    preset: 'content',
    path: (userId) => `posts/${userId}/${Date.now()}.webp`,
  })

  async function handleFile(file: File) {
    if (file.size > 4.5 * 1024 * 1024) {
      // surface to user — never let the API reject after upload starts
      return
    }
    const { url } = await upload(file)
    setPreview(url)
    onUploaded(url)
  }

  // render Idle / Compressing / Uploading / Success / Error based on
  // { preview, isUploading, progress, error }
}
```

## Rules

1. Use the hook — never call `/api/upload` directly from components.
2. Validate the 4.5MB limit client-side BEFORE upload. Vercel function bodies reject larger, and the error state is ugly.
3. Show progress visibly on any upload > 500ms (which is every upload).
4. After upload success, show a preview immediately — users need confirmation.
5. Error state must be dismissible AND retryable without remounting the component.
6. Accessibility: drop zone needs keyboard activation (`Enter` / `Space`), `aria-label`, and a visually-hidden but focusable file input.
7. Never auto-submit a form on upload completion. Let the user confirm.

## Gotchas

- `progress` reaches 100% before the URL is ready. Don't react on `progress === 100` — await the `upload()` promise.
- `error` persists after retry. Reset it on user action (retry click) or component unmount.
- Drag-and-drop and click-to-browse share the same `handleFile` function. Keep validation in one place.
- Mobile Safari reorients images via EXIF. The compression pipeline normalizes orientation — verify on iOS if rotation shows up.
- `useUploadImage` hook uses `usePlan()` internally for plan-gated buckets. Free users hitting paid upload limits get a structured error — surface it with `<UpgradeDialog />`, not a generic error toast.
