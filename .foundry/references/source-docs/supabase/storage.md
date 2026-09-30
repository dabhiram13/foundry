# Supabase Storage — Buckets, Uploads, Access Control & CDN

Supabase Storage wraps S3-compatible object storage with **Postgres RLS policies** on `storage.objects`. Every file operation (upload, download, delete, move) is governed by the same RLS you use for tables.

---

## Core Concepts

```
Bucket (public or private)
  └── Folder path (virtual, just part of the object name)
       └── File (object)
            ├── Metadata (stored in storage.objects)
            ├── RLS policies (on storage.objects)
            └── CDN caching (Smart CDN on Pro+)
```

| Concept | Detail |
|---------|--------|
| Bucket | Top-level container. Defines access model (public/private) + upload restrictions (max size, allowed MIME types) |
| Object | A file stored inside a bucket. Path = `folder/subfolder/file.ext` |
| `storage.objects` | Postgres table tracking every object. RLS policies go here |
| `storage.buckets` | Postgres table tracking bucket configs. Rarely needs direct RLS |
| Owner | `owner_id` column on `storage.objects` — auto-set to `auth.uid()` on upload |

---

## Public vs Private Buckets

**This is the most important decision per bucket.** Get it wrong and you leak files or break access.

### Public Bucket

Downloads bypass RLS entirely. Anyone with the URL can read the file. Upload/delete/move still require RLS.

| Property | Value |
|----------|-------|
| Download auth | **None** — direct URL access |
| Upload/delete auth | RLS enforced |
| CDN caching | Aggressive (cached at edge, best perf) |
| URL pattern | `https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>` |
| Use `getPublicUrl()` | Yes |

**When to use**: Avatars, profile pictures, blog post images, landing page assets, any media shown to unauthenticated visitors.

### Private Bucket (default)

All operations subject to RLS — including downloads. Files cannot be accessed without authorization.

| Property | Value |
|----------|-------|
| Download auth | **Required** — JWT or signed URL |
| Upload/delete auth | RLS enforced |
| CDN caching | Less aggressive (revalidates with auth) |
| Access methods | `download()` with JWT, or `createSignedUrl()` for time-limited links |

**When to use**: User documents, chat attachments, invoices, contracts, anything private.

---

## Our Access Model (3 Tiers)

Always classify every file into one of these three tiers:

### Tier 1 — Fully Public (anyone, no auth)

> Avatars, static images, marketing assets, blog images

- **Bucket**: `public` bucket (e.g., `avatars`, `public-media`)
- **Download**: `getPublicUrl()` — no auth needed
- **Upload RLS**: Authenticated users can upload to their own folder
- **Example path**: `avatars/{user_id}/profile.jpg`

### Tier 2 — Authenticated Users Only (signed URL or RLS)

> Post images, campaign media, shared content visible to all logged-in users (or a subset like `brand` or `creator`)

- **Bucket**: `private` bucket (e.g., `post-media`, `campaign-assets`)
- **Download**: `createSignedUrl()` with short TTL (e.g., 3600s), or `download()` with JWT
- **Upload RLS**: Authenticated + scoped to owner
- **Read RLS**: All `authenticated` users can SELECT, **or** scoped by role via JWT claims

```sql
-- All authenticated users can view
create policy "Authenticated users can view post media"
on storage.objects for select
to authenticated
using ( bucket_id = 'post-media' );

-- Only brands can view campaign assets
create policy "Brands can view campaign assets"
on storage.objects for select
to authenticated
using (
  bucket_id = 'campaign-assets'
  and (select auth.jwt() -> 'app_metadata' ->> 'user_role') = 'brand'
);
```

### Tier 3 — Owner Only (private, signed URL)

> User documents, chat attachments, invoices, contracts, anything **only the uploader** should see

- **Bucket**: `private` bucket (e.g., `user-documents`, `chat-files`)
- **Download**: `createSignedUrl()` generated server-side, or `download()` with JWT
- **Upload RLS**: Only the user can upload to their own folder
- **Read RLS**: Only owner can SELECT

```sql
-- Owner-only access
create policy "Users can view own files"
on storage.objects for select
to authenticated
using ( (select auth.uid()) = owner_id );
```

---

## Bucket Setup

### Creating Buckets (SQL)

```sql
-- Public bucket for avatars
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,                                          -- public
  5242880,                                       -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp'] -- restrict types
);

-- Private bucket for user documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-documents',
  'user-documents',
  false,                                         -- private
  10485760,                                      -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/png']
);
```

### File Size Limits

| Scope | How | Note |
|-------|-----|------|
| Global | Storage Settings in Dashboard | Free: max 50 MB. Pro+: up to 500 GB |
| Per bucket | `file_size_limit` column on `storage.buckets` | Must be <= global limit |
| Best practice | Global = highest any bucket needs. Per-bucket = actual limit | Prevents oversized uploads |

### Upload Method by Size

| File Size | Method | Why |
|-----------|--------|-----|
| < 6 MB | Standard upload (`upload()`) | Simple multipart/form-data |
| > 6 MB | TUS Resumable upload (`uploadToSignedUrl()` or TUS protocol) | Reliable, resumable on failure |

---

## Upload

### Standard Upload (< 6 MB)

```ts
const { data, error } = await supabase.storage
  .from('avatars')
  .upload(`${userId}/profile.jpg`, file, {
    cacheControl: '3600',        // browser cache: 1 hour
    upsert: true,                // overwrite if exists
    contentType: 'image/jpeg',   // explicit MIME (optional, auto-detected from extension)
  })
```

### Upload Options

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `cacheControl` | `string` | `'3600'` | Browser cache TTL in seconds |
| `upsert` | `boolean` | `false` | Overwrite existing file at same path |
| `contentType` | `string` | Auto-detected | Force specific MIME type |
| `duplex` | `string` | — | Set to `'half'` for streaming uploads |

### Path Convention

```
{bucket}/{user_id}/{category}/{filename}
```

Examples:
- `avatars/uuid-123/profile.jpg`
- `user-documents/uuid-123/invoices/invoice-2024-01.pdf`
- `post-media/uuid-123/posts/post-456/cover.webp`

Always namespace by `user_id` — it makes RLS policies simpler and prevents path collisions.

---

## Download & Serving

### Public Bucket — `getPublicUrl()`

```ts
const { data } = supabase.storage
  .from('avatars')
  .getPublicUrl('uuid-123/profile.jpg')

// data.publicUrl → https://<project>.supabase.co/storage/v1/object/public/avatars/uuid-123/profile.jpg
```

No auth required. Cached aggressively at CDN edge.

### Private Bucket — `createSignedUrl()`

```ts
const { data, error } = await supabase.storage
  .from('user-documents')
  .createSignedUrl('uuid-123/invoice.pdf', 3600) // expires in 1 hour (seconds)

// data.signedUrl → https://<project>.supabase.co/storage/v1/object/sign/user-documents/...?token=...
```

| Parameter | Type | Purpose |
|-----------|------|---------|
| `path` | `string` | File path within bucket |
| `expiresIn` | `number` | URL validity in **seconds** |
| `options.download` | `boolean \| string` | Force download (optionally rename file) |
| `options.transform` | `object` | Image transformations (width, height, quality) |

### Private Bucket — `download()`

```ts
const { data, error } = await supabase.storage
  .from('user-documents')
  .download('uuid-123/invoice.pdf')

// data → Blob
```

Requires the user's JWT in the request (handled by supabase-js automatically).

### Batch Signed URLs

```ts
const { data, error } = await supabase.storage
  .from('post-media')
  .createSignedUrls(['path1.jpg', 'path2.jpg', 'path3.jpg'], 3600)

// data → [{ signedUrl, path, error }, ...]
```

---

## RLS Policies — Complete Reference

### The `storage.objects` Table (Key Columns)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `uuid` | Object ID |
| `bucket_id` | `text` | Which bucket |
| `name` | `text` | Full path within bucket |
| `owner_id` | `uuid` | `auth.uid()` of uploader (auto-set) |
| `created_at` | `timestamptz` | Upload time |
| `updated_at` | `timestamptz` | Last modification |
| `metadata` | `jsonb` | File metadata (size, mimetype, etc.) |

### SQL Helper Functions

| Function | Returns | Example |
|----------|---------|---------|
| `storage.filename(name)` | File name only | `'avatar.png'` from `'public/sub/avatar.png'` |
| `storage.foldername(name)` | Array of folders | `['public', 'sub']` from `'public/sub/avatar.png'` |
| `storage.extension(name)` | File extension | `'png'` from `'avatar.png'` |

### Which RLS Operation for Which Action

| Storage Action | Required RLS | Notes |
|----------------|-------------|-------|
| `upload()` | `INSERT` | Add `SELECT` + `UPDATE` if using `upsert: true` |
| `download()` | `SELECT` | Also needed for `createSignedUrl()` to work |
| `update()` (replace file) | `SELECT` + `UPDATE` | |
| `remove()` | `SELECT` + `DELETE` | |
| `move()` | `SELECT` + `UPDATE` | |
| `copy()` | `SELECT` + `INSERT` | |
| `list()` | `SELECT` | |

### Policy Templates by Tier

#### Tier 1 — Public Avatars

```sql
-- Anyone can view (bucket is public, but this is belt-and-suspenders)
create policy "Public avatar read"
on storage.objects for select
to public
using ( bucket_id = 'avatars' );

-- Authenticated users upload to their own folder
create policy "Users upload own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Users can overwrite their own avatar
create policy "Users update own avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (select auth.uid()) = owner_id
);

-- Users can delete their own avatar
create policy "Users delete own avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (select auth.uid()) = owner_id
);
```

#### Tier 2 — Authenticated + Role-Scoped

```sql
-- All authenticated users can view post media
create policy "Auth users view post media"
on storage.objects for select
to authenticated
using ( bucket_id = 'post-media' );

-- Only creators can upload post media
create policy "Creators upload post media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'post-media'
  and (select auth.jwt() -> 'app_metadata' ->> 'user_role') = 'creator'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Only brands can view campaign briefs
create policy "Brands view campaign briefs"
on storage.objects for select
to authenticated
using (
  bucket_id = 'campaign-assets'
  and (select auth.jwt() -> 'app_metadata' ->> 'user_role') = 'brand'
);
```

#### Tier 3 — Owner Only

```sql
-- Owner can read own files
create policy "Owner read own documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'user-documents'
  and (select auth.uid()) = owner_id
);

-- Owner can upload to own folder
create policy "Owner upload own documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'user-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Owner can delete own files
create policy "Owner delete own documents"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'user-documents'
  and (select auth.uid()) = owner_id
);
```

---

## Signed URLs — When & How

| Scenario | Method | TTL Guidance |
|----------|--------|-------------|
| Display image in authenticated UI | `createSignedUrl()` | 3600s (1 hour) |
| One-time download link (invoice, contract) | `createSignedUrl()` with `{ download: true }` | 300s (5 min) |
| Serve image in email | `createSignedUrl()` | 86400s (24 hours) — emails may be opened late |
| Display to current user in real-time | `download()` with JWT | N/A — direct auth |
| Public asset on marketing page | `getPublicUrl()` | N/A — no expiry |

### Signed URL with Image Transform

```ts
const { data } = await supabase.storage
  .from('post-media')
  .createSignedUrl('uuid/cover.jpg', 3600, {
    transform: {
      width: 400,
      height: 300,
      quality: 80,
      resize: 'cover',  // 'cover' | 'contain' | 'fill'
    },
  })
```

Transform options are baked into the signed token — they cannot be altered by the client.

---

## Image Transformations (Pro Plan+)

On-the-fly image optimization via imgproxy under the hood.

### Transform Options

| Option | Type | Range | Default | Purpose |
|--------|------|-------|---------|---------|
| `width` | `number` | 1–2500 | — | Target width |
| `height` | `number` | 1–2500 | — | Target height |
| `quality` | `number` | 20–100 | 80 | Compression quality |
| `resize` | `string` | — | `'cover'` | `'cover'` / `'contain'` / `'fill'` |
| `format` | `string` | — | Auto (WebP) | `'origin'` to disable auto-optimization |

### Limits

- Max image size: **25 MB**
- Max resolution: **50 megapixels**
- Supported input: PNG, JPEG, WebP, AVIF, GIF, ICO, SVG, HEIC, BMP, TIFF
- HEIC cannot be output (converted to other formats)

### Auto WebP Optimization

When using transforms, Storage auto-detects browser support and returns WebP when possible. Reduces egress significantly. Pass `format: 'origin'` to disable.

### Next.js Image Loader

```ts
// lib/supabase-image-loader.ts
const projectId = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID!

export default function supabaseLoader({
  src,
  width,
  quality,
}: {
  src: string
  width: number
  quality?: number
}) {
  return `https://${projectId}.supabase.co/storage/v1/render/image/public/${src}?width=${width}&quality=${quality || 75}`
}
```

```ts
// next.config.ts
const config = {
  images: {
    loader: 'custom',
    loaderFile: './lib/supabase-image-loader.ts',
  },
}
```

```tsx
import Image from 'next/image'

<Image src="avatars/uuid/profile.jpg" alt="Avatar" width={200} height={200} />
```

---

## CDN & Caching

### Smart CDN (Pro Plan+, auto-enabled)

- Asset metadata synced to edge
- Cache auto-invalidated on update/delete (propagation: **up to 60s**)
- Higher cache hit rate than standard CDN

### Cache Control

Set `cacheControl` on upload — controls **browser cache** TTL.

| Asset Type | Recommended `cacheControl` | Why |
|------------|---------------------------|-----|
| Avatars | `'3600'` (1 hour) | May change, need reasonable freshness |
| Static marketing images | `'31536000'` (1 year) | Never change, max cache |
| User documents | `'0'` or `'60'` | Sensitive, minimize caching |
| Post images | `'86400'` (1 day) | Rarely change after publish |

### Cache Busting

Prefer uploading to a **new path** over overwriting. CDN propagation on overwrite takes up to 60s and may serve stale content.

Alternative: version query string.

```
/storage/v1/object/public/avatars/uuid/profile.jpg?v=2
```

---

## Other Operations

### List Files

```ts
const { data, error } = await supabase.storage
  .from('user-documents')
  .list('uuid-123/invoices', {
    limit: 100,
    offset: 0,
    sortBy: { column: 'created_at', order: 'desc' },
  })
```

For large object counts, `list()` can be slow. Use the optimized Postgres function:

```sql
create or replace function list_objects(
  bucketid text, prefix text, limits int default 100, offsets int default 0
) returns table (
  name text, id uuid, updated_at timestamptz, created_at timestamptz,
  last_accessed_at timestamptz, metadata jsonb
) as $$
begin
  return query
    select o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata
    from storage.objects o
    where o.name like prefix || '%' and o.bucket_id = bucketid
    order by o.name asc limit limits offset offsets;
end;
$$ language plpgsql stable;
```

### Move / Copy / Remove

```ts
// Move
await supabase.storage.from('bucket').move('old/path.jpg', 'new/path.jpg')

// Copy
await supabase.storage.from('bucket').copy('source.jpg', 'destination.jpg')

// Remove (batch)
await supabase.storage.from('bucket').remove(['path1.jpg', 'path2.jpg'])
```

---

## Security Checklist

- [ ] Every bucket has explicit RLS policies on `storage.objects`
- [ ] No `USING(true)` on INSERT/UPDATE/DELETE (SELECT only where intentional)
- [ ] Upload paths namespaced by `auth.uid()` to prevent collisions
- [ ] `owner_id` used in SELECT/UPDATE/DELETE policies for owner-only access
- [ ] Role-based access uses `app_metadata` claims (not `user_metadata`)
- [ ] `service_role` key never used in client code
- [ ] File size limits set per bucket (not just global)
- [ ] Allowed MIME types restricted per bucket
- [ ] Signed URL TTLs are minimal for the use case
- [ ] Sensitive files in private buckets, never public
- [ ] `cacheControl` set appropriately per asset type

---

## Decision Matrix — Quick Reference

| Question | Answer | Action |
|----------|--------|--------|
| Can anonymous users see this? | Yes | Public bucket + `getPublicUrl()` |
| Can anonymous users see this? | No | Private bucket |
| Can all logged-in users see this? | Yes | Private bucket + RLS `to authenticated` + `createSignedUrl()` |
| Can only certain roles see this? | Yes | Private bucket + RLS with JWT claim check + `createSignedUrl()` |
| Can only the uploader see this? | Yes | Private bucket + RLS `owner_id = auth.uid()` + `createSignedUrl()` |
| File > 6 MB? | Yes | Use TUS resumable upload |
| Image needs resizing? | Yes | Use `transform` option (Pro Plan+) |
| File changes frequently? | Yes | Upload to new path, don't overwrite |

---

## Recommended Bucket Structure

| Bucket | Public? | Purpose | Max Size | Allowed Types | Access |
|--------|---------|---------|----------|---------------|--------|
| `avatars` | Yes | User profile pictures | 5 MB | `image/*` | Tier 1 — anyone reads, owner writes |
| `public-media` | Yes | Marketing, blog, landing | 10 MB | `image/*`, `video/*` | Tier 1 — anyone reads, admins write |
| `post-media` | No | Creator post images/videos | 50 MB | `image/*`, `video/*` | Tier 2 — all auth read, creator writes |
| `campaign-assets` | No | Brand campaign briefs/media | 25 MB | `image/*`, `application/pdf` | Tier 2 — brands read, brand owner writes |
| `user-documents` | No | Invoices, contracts, IDs | 10 MB | `application/pdf`, `image/*` | Tier 3 — owner only |
| `chat-files` | No | Chat attachments | 10 MB | `image/*`, `application/pdf` | Tier 3 — conversation participants only |

---

## Performance Tips

| Optimization | Why |
|-------------|-----|
| Set high `cacheControl` on static assets | Reduces egress, faster loads |
| Use image transforms instead of storing multiple sizes | Less storage, on-demand resizing |
| Namespace paths by `user_id` | Faster RLS evaluation, simpler policies |
| Use `list_objects()` Postgres function at scale | Avoids slow hierarchy computation |
| Prefer new path over `upsert: true` | Avoids CDN propagation delay (up to 60s stale) |
| Add indexes on columns used in RLS policies | Speeds up policy evaluation |

**Ref**: https://supabase.com/docs/guides/storage
