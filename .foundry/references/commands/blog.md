<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: blog
description: Blog infrastructure — DB table, oRPC CRUD, listing/post pages, SEO + AEO ready (schema markup, OG images, AI bot access, RSS, sitemap). No content generation — the blog-writer skill handles that via /monitor cron.
---

# /blog — Blog Infrastructure Setup

Sets up everything needed to run an SEO + AEO optimized blog. Database, backend, UI, security, SEO. Does NOT write posts — the `blog-writer` skill does that, triggered by `/monitor` cron.

Arguments: `$ARGUMENTS`
- No args = full infrastructure setup
- `--verify` = check existing blog setup is complete (SEO audit)

---

## Skills to Load

- `ai-seo` — AEO content patterns (for MDX component design)
- `nextjs-seo` — Next.js metadata, sitemaps, structured data
- `seo-audit` — verification after setup

---

## Pre-Flight

1. `docs/project/product-overview.md` exists → product name, category for schema defaults
2. `docs/project/brand-guidelines.md` exists → author info, voice defaults
3. `RESEND_API_KEY` in `.env` → for draft notification emails
4. `ADMIN_EMAIL` in `.env` → draft notification recipient. If missing, ask user.
5. `TAVILY_API_KEY` in `.env` → needed by blog-writer skill for research. If missing:

> The `blog-writer` skill needs Tavily for industry research (free — 1,000 searches/month).
>
> 1. Sign up at https://www.tavily.com (free tier)
> 2. Copy your API key
> 3. Add to `webapp/.env`: `TAVILY_API_KEY=tvly-your-key-here`

If no product docs: "Run /discover first."

---

## Phase 1: Database

### `blog_posts` table

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | uuid | no | gen_random_uuid() | PK |
| `slug` | text | no | — | UNIQUE |
| `title` | text | no | — | — |
| `description` | text | no | — | CHECK: length <= 300 |
| `content` | text | no | — | MDX content body |
| `category` | text | yes | — | — |
| `tags` | text[] | yes | '{}' | — |
| `status` | text | no | 'draft' | CHECK: draft, published, archived |
| `author_name` | text | no | — | — |
| `author_role` | text | yes | — | — |
| `author_avatar` | text | yes | — | — |
| `seo_title` | text | yes | — | Override for `<title>` |
| `seo_description` | text | yes | — | Override for meta description |
| `cover_image_url` | text | yes | — | OG image override |
| `target_query` | text | yes | — | Primary AEO target query |
| `schema_types` | text[] | yes | '{Article}' | JSON-LD schemas to generate |
| `faq_data` | jsonb | yes | — | `[{question, answer}]` for FAQPage schema |
| `published_at` | timestamptz | yes | — | Set when status → published |
| `created_at` | timestamptz | no | now() | — |
| `updated_at` | timestamptz | no | now() | trigger: set_updated_at |

**RLS Policies:**
- `blog_posts_public_read`: SELECT for public WHERE `status = 'published'`
- `blog_posts_admin_all`: ALL for authenticated WHERE `(auth.jwt() ->> 'is_admin')::boolean = true`

**Indexes:**
- UNIQUE on `slug`
- btree on `status, published_at DESC`
- btree on `category`

### Migration

db-architect creates the migration + RLS + indexes + trigger.

---

## Phase 2: Backend

### oRPC Procedures

**Public (authProcedure with rate limit):**

| Procedure | Input | Returns |
|-----------|-------|---------|
| `blog.listPublished` | `{ page?, limit?, category? }` | Paginated published posts (no content body — title, slug, description, category, published_at, author) |
| `blog.getBySlug` | `{ slug }` | Full post with content, FAQ data, schema types |
| `blog.listCategories` | — | Distinct categories with post counts |

**Admin (adminProcedure):**

| Procedure | Input | Returns |
|-----------|-------|---------|
| `blog.admin.listAll` | `{ page?, limit?, status? }` | All posts including drafts |
| `blog.admin.create` | Full post data | Created post |
| `blog.admin.update` | `{ id, ...partial post }` | Updated post |
| `blog.admin.publish` | `{ id }` | Sets status=published, published_at=now() |
| `blog.admin.delete` | `{ id }` | Soft delete (status=archived) |
| `blog.admin.recentTitles` | `{ limit: 20 }` | Last 20 titles + descriptions (for blog-writer dedup) |

**`blog.admin.recentTitles`** is critical — the blog-writer skill calls this to know what's already been written and avoid duplication.

### Draft Notification Helper

Server-side function `sendDraftNotification(post)`:
- Uses Resend API (same pattern as auth emails)
- Sends to `ADMIN_EMAIL`
- Template: post title, category, word count, AEO target query, preview link
- Called by the blog-writer skill after saving a draft

---

## Phase 3: Frontend

### Routes

| Route | Type | Layout | Caching |
|-------|------|--------|---------|
| `/blog` | Public | Marketing | `cacheLife("hours")` |
| `/blog/[slug]` | Public | Marketing | `cacheLife("days")`, `cacheTag("blog-{slug}")` |
| `/blog/rss.xml` | Route handler | — | `cacheLife("hours")` |
| `/protected/blog` | Admin | Protected | No cache |

### `/blog` — Listing Page

- Grid of post cards: title, description, category badge, published date, author avatar
- Category filter tabs (from `blog.listCategories`)
- Pagination
- Clean, magazine-style layout using design tokens

### `/blog/[slug]` — Post Page

Server component that fetches post by slug and renders:

**Content rendering:** Parse MDX content string → render with custom components.

**AEO Components (built into the renderer):**

| Component | What it renders | Schema it generates |
|-----------|----------------|-------------------|
| `Callout` | Highlighted extractable block (40-60 words) | — |
| `Stat` | Statistic with source + date | — |
| `ComparisonTable` | Feature comparison with "Bottom line" | — |
| `FAQ` | Q&A accordion | FAQPage JSON-LD (from `faq_data`) |
| `Steps` | Numbered step-by-step | HowTo JSON-LD |
| `ExpertQuote` | Attributed quote | — |
| `CTA` | Inline product CTA | — |
| `LastUpdated` | "Updated: {date}" badge | — |

These implement patterns from `library/skills/ai-seo/references/content-patterns.md`.

**SEO output (auto-generated per post):**
- `generateMetadata` → title, description, OG tags, Twitter card, canonical, robots
- JSON-LD `Article` schema (always)
- JSON-LD `FAQPage` schema (if `faq_data` exists)
- JSON-LD `HowTo` schema (if content has `<Steps>`)
- "Last updated" date displayed prominently (freshness signal)
- Author bio section at bottom (E-E-A-T signal)

### `/blog/rss.xml` — RSS Feed

Route handler generating valid Atom/RSS feed from published posts.

### `/protected/blog` — Admin Draft Manager

Admin-only page showing all posts (drafts, published, archived). For each:
- Status badge, title, created date, target query
- "Publish" button (calls `blog.admin.publish`)
- "Edit" link (opens post content for editing — simple textarea or link to file)
- "Preview" link (opens `/blog/{slug}` in new tab — works for drafts via admin bypass)

### Sitemap + robots.txt

- Add all published blog posts to `sitemap.ts` with `lastmod`, `changefreq: "weekly"`, `priority: 0.8`
- Ensure `robots.txt` allows all AI bots: GPTBot, ChatGPT-User, PerplexityBot, ClaudeBot, anthropic-ai, Google-Extended, Bingbot

### OG Images

Dynamic `opengraph-image.tsx` using `ImageResponse`:
- Brand colors from `globals.css`
- Post title (large)
- Product name + author
- Category badge

---

## Phase 4: Build Pipeline

**Size: S-M** — DB + backend + frontend, no design team needed (blog layout is content-focused, not variant-worthy).

**Group 1: db-architect**
- `blog_posts` table, RLS, indexes, trigger

**Group 2: backend**
- oRPC procedures (public + admin)
- Draft notification email helper
- RSS route handler

**Group 3: connector + designer (parallel)**
- Connector: RSC data fetching, metadata generation, JSON-LD, sitemap, OG images
- Designer: Blog listing page, post page, admin draft manager, AEO components

**Group 4: Quality**
- `npx tsc --noEmit` + `npm run build`
- SEO audit: schema markup valid, meta tags complete, sitemap has blog entries, robots.txt allows AI bots, RSS valid

**Group 5: Complete**
- `docs/built/blog.md`
- Update `docs/INDEX.md`
- Update `db-schema.md`

---

## Phase 5: Install Blog Writer Cron

After infrastructure is built, auto-install the blog-writer cron job via system crontab.

**Pre-check:**
1. Verify `TAVILY_API_KEY` exists in `webapp/.env`. If missing, prompt the user (free at tavily.com — 1,000 searches/month).
2. Verify `ADMIN_EMAIL` exists in `webapp/.env`. If missing, ask the user.
3. Verify `SUPABASE_SECRET_KEY` exists in `webapp/.env`.

**Install the cron:**

```bash
PROJECT_DIR="$(pwd)"
CLAUDE_BIN="$(which claude)"
EXISTING=$(crontab -l 2>/dev/null | grep -v "# claude-monitor: blog-writer" || true)

mkdir -p dev/reports/blog-writer

crontab - <<CRONTAB
${EXISTING}
0 9 * * 1 cd ${PROJECT_DIR} && ${CLAUDE_BIN} -p "Use the blog-writer skill. Write one new blog post for this project." --output-format json >> ${PROJECT_DIR}/dev/reports/blog-writer/cron.log 2>&1 # claude-monitor: blog-writer
CRONTAB
```

**Verify:**
```bash
crontab -l | grep "# claude-monitor: blog-writer"
```

Present to the user:

> **Blog writer cron installed.**
>
> | Schedule | What it does | Report |
> |----------|-------------|--------|
> | Monday 9am | Researches industry via Tavily, writes SEO+AEO draft, saves to DB, emails ADMIN_EMAIL | `dev/reports/blog-writer/cron.log` |
>
> The cron runs: `claude -p "Use the blog-writer skill. Write one new blog post for this project."`
>
> - View/manage all crons: `/monitor --status`
> - Remove blog cron: `crontab -l | grep -v "blog-writer" | crontab -`
> - Test manually: `claude -p "Use the blog-writer skill. Write one new blog post for this project."`

---

## What This Command Does NOT Include

- Writing blog posts (blog-writer skill does this)
- Topic research (blog-writer skill uses Tavily + Jina)
- Newsletter/email subscription (see /emails)
- Comment system
- CMS UI for writing (admin page manages drafts, content is DB text)
