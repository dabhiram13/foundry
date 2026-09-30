# File Storage Pattern

The template ships with upload infrastructure. USE IT — don't reinvent compression, auth, or path handling.

## What exists

- `lib/storage.ts` → `uploadFile(bytes, path, options)` — server-side. Routes to Vercel Blob (edge CDN) or Supabase Storage. Auto-fallback when `BLOB_READ_WRITE_TOKEN` is unset.
- `app/api/upload/route.ts` — authenticated upload endpoint. Auth check, path traversal protection, 4.5MB body limit.
- `features/_shared/utils/compress-image.ts` → `compressImage(file, preset)` — browser-side.
- `features/_shared/hooks/use-upload-image.ts` → `useUploadImage({ preset, path })` — client hook that compresses and uploads in one call.

## Presets

| Preset | Max dim | Max size | Use for |
|---|---|---|---|
| avatar | 512px | 500KB | User profile pictures |
| cover | 1920px | 2MB | Banner/header images |
| content | 800px | 1MB | Post images, inline content |
| thumbnail | 200px | 100KB | Card thumbnails, list previews |

## Decision tree

| Question | Answer |
|---|---|
| User-facing upload from the browser? | `useUploadImage` hook |
| Server downloading external CDN asset? | `uploadFile()` inside Inngest step |
| Private / infrequent access? | `storage: 'supabase'` |
| Frequent public access (posts, avatars)? | `storage: 'blob'` (default) |
| Blob token missing in env? | Auto-falls back to Supabase — safe |

## Client upload

```ts
const { upload, isUploading, error, progress } = useUploadImage({
  preset: 'content',
  path: (userId) => `posts/${userId}/${Date.now()}.webp`,
})

await upload(file)
```

## Server-side ingestion (Inngest worker)

```ts
const response = await fetch(externalUrl)
const bytes = new Uint8Array(await response.arrayBuffer())
const { url } = await uploadFile(bytes, `ingested/${id}.webp`, {
  contentType: 'image/webp',
  storage: 'blob',
})

await admin.from('assets').update({ permanent_url: url }).eq('id', id)
```

## Rules

1. NEVER store external CDN URLs as permanent references — they expire. Download via `uploadFile()` during ingestion.
2. NEVER upload raw images from the browser — always compress through a preset (EXIF strip, format normalize, bandwidth).
3. 4.5MB is the hard client-upload limit (Vercel function body cap). Larger files need signed direct-to-Storage URLs — flag in plan.
4. Path builders must sanitize user input — never interpolate raw filenames.
5. Default bucket for Supabase storage is `uploads` — override only when separation is required (private docs, etc.).

## Gotchas

- Blob-to-Supabase fallback is silent. Log which backend was used in dev to catch misconfiguration.
- `compressImage` runs in the browser — unavailable in Inngest. Use server-side `sharp` there if transformation is needed.
- `storage: 'supabase'` without creating the bucket = 404 at runtime. Verify bucket exists before first use.
- Path traversal: `../` escapes the bucket root. The route handler strips them, but the path builder should also never accept user-provided path segments.
