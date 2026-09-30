<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: fumadocs
description: Generate the product documentation site with fumadocs — learns the product from the codebase, writes every page.
---

# /fumadocs — Generate Product Documentation Site

You are building a complete documentation site using fumadocs (already installed). The infrastructure is ready at `/docs`. You write the content, configure navigation, and wire it into the app.

## Step 0: Learn the product (NO questions about the product)

Read these files FIRST — they contain everything you need:

1. `docs/project/` — all 7 project docs (product overview, users & journeys, feature map, brand, tech reqs, external tools, UX patterns)
2. `docs/project/feature-map.md` — every feature, what it does, priorities
3. `docs/built/` — every built feature reference (60-line summaries with key files, DB tables, user flows)

After reading these, you know the product, the users, the features, and the brand. Do NOT ask the user about their product.

## Step 1: Ask only about docs preferences (2-3 questions max)

You already know the product. Ask ONLY:

1. **What kind of docs?** Based on what you read, propose the best fit:
   - **Product docs** (for end users — how to use the app, public at `/docs`)
   - **API docs** (for developers integrating, public at `/docs/api`)
   - **Help center** (FAQ / knowledge base, public at `/help`, link from landing page footer + header)
   - **Marketing docs** (product capabilities for prospects, public, link from landing page nav)
   - **Internal docs** (team/admin only, behind auth, in sidebar for authorized roles only)
   - Or a mix — suggest what makes sense given the product and users
2. **What base URL?** Propose a sensible default. User can override.
3. **Any sections you want that I haven't thought of?** Present your proposed table of contents (based on feature map + built features) and let them tweak it.

That's it. Three questions, then build.

## Step 2: Plan the docs structure

Based on docs/project/ + docs/built/ + user preferences, create:

- A complete table of contents with sections and pages
- Map each built feature to a docs page
- Group logically (don't just dump a flat list)
- Add getting started / quickstart as the first thing

Present the plan to the user for approval before writing.

## Step 3: Configure the infrastructure

### Existing files (already set up — update as needed)

**`source.config.ts`** (root of webapp/):
```ts
import { defineDocs, defineConfig } from 'fumadocs-mdx/config'

export const docs = defineDocs({
  dir: 'content/docs',
})

export default defineConfig()
```

**`lib/source.ts`**:
```ts
import { loader } from 'fumadocs-core/source'
import { docs } from 'fumadocs-mdx:collections/server'

export const source = loader({
  baseUrl: '/{BASE_URL}',
  source: docs.toFumadocsSource(),
})
```

**`app/docs/layout.tsx`**:
```tsx
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { source } from '@/lib/source'
import type { ReactNode } from 'react'

export default function DocsLayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      nav={{
        title: '{BRAND_NAME}',
        url: '/{BASE_URL}',
      }}
      sidebar={{
        defaultOpenLevel: 2,
      }}
    >
      <style>{`
        [data-fumadocs-sidebar] [role="separator"] {
          font-weight: 700;
          color: hsl(var(--foreground));
        }
        [data-fumadocs-sidebar] a {
          color: hsl(var(--foreground));
        }
        [data-fumadocs-sidebar] .flex.flex-col {
          gap: 1px;
        }
      `}</style>
      {children}
    </DocsLayout>
  )
}
```

**`app/docs/[[...slug]]/page.tsx`**:
```tsx
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
} from 'fumadocs-ui/layouts/docs/page'
import { source } from '@/lib/source'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ slug?: string[] }>
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params
  const page = source.getPage(slug)
  if (!page) notFound()

  const MDXContent = page.data.body

  return (
    <DocsPage
      toc={page.data.toc}
      breadcrumb={{ enabled: true }}
      footer={{ enabled: true }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent />
      </DocsBody>
    </DocsPage>
  )
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const page = source.getPage(slug)
  if (!page) return {}

  return {
    title: `${page.data.title} — {BRAND_NAME}`,
    description: page.data.description,
  }
}
```

### If the base URL changes from `/docs`

Move or rename `app/docs/` to match (e.g., `app/help/` for `/help`). Update `lib/source.ts` baseUrl to match.

### Navigation: `content/docs/meta.json`
```json
{
  "title": "{BRAND_NAME} Docs",
  "pages": [
    "index",
    "---Getting Started---",
    "quickstart",
    "---Section Name---",
    "page-slug",
    "...subfolder",
    "---Another Section---",
    "another-page"
  ]
}
```

Section separators use `"---Title---"` syntax. Subfolders use `"...folder"` and need their own `meta.json`:
```json
{
  "title": "Section Title",
  "pages": ["index", "page-1", "page-2"]
}
```

## Step 4: Wire docs into the app (CRITICAL — don't skip)

Based on the docs type, update the relevant parts of the app:

### Public docs (product docs, help center, marketing docs, API docs)

**Landing page** — read `webapp/features/marketing/` and add a docs link:
- Add "Docs" or "Help" to the header nav links in `features/marketing/components/header.tsx`
- If help center: also add to landing page footer
- Use the same scroll/link pattern as existing nav items

**Marketing footer** — if there's a footer component, add docs link there too.

### Internal docs (behind auth)

**Sidebar** — add docs to `features/_shared/components/app-sidebar.tsx`:
- Add a nav item pointing to the docs route
- If role-restricted: check `plan` or user role before showing the nav item
- Example: `{ title: "Docs", url: "/protected/docs", icon: BookOpen }`

**Auth protection** — if docs should be behind auth:
- Move the route under `app/protected/docs/` instead of `app/docs/`
- Update `lib/source.ts` baseUrl to `/protected/docs`
- The existing layout.tsx auth wrapper will protect it automatically

**RBAC** — if only certain roles should see docs:
- Read `docs/built/auth.md` to understand the current auth/claims system
- Read `lib/auth/utils.ts` for `getClaims()` usage
- Add a role check in the sidebar: only show the docs nav item if user has the right role/plan
- Optionally add a role check in the docs layout.tsx to redirect unauthorized users

### Mixed (public + internal sections)

- Put public docs at `/docs` (no auth)
- Put internal docs at `/protected/docs` (behind auth)
- You'll need two source loaders — one for each content directory
- Or use a single `/docs` route with some pages marked as requiring auth in their frontmatter

## Step 5: Write the docs content

### MDX file format
```mdx
---
title: Page Title
description: One sentence describing this page.
---

## First section heading

Content here.
```

- Frontmatter `title` and `description` are required
- First heading must be `##` (fumadocs renders title from frontmatter as h1)
- Use fenced code blocks with language tags
- Use `bash` for terminal commands

### Writing rules — MANDATORY

**USE THE HUMANIZER SKILL ON ALL CONTENT.** Before finalizing any MDX file, run it through the `humanizer` skill. Every page must read like a human wrote it.

**Voice:**
- Write like you're explaining to a colleague at a whiteboard
- Use "you" and "your", never "one" or "the user"
- Short sentences. Short paragraphs. Get to the point
- Show code first, explain after
- No filler ("In this section, we will explore...")
- No em dashes. Use commas or periods
- Ban these words: leveraging, comprehensive, robust, seamless, cutting-edge, utilizing, facilitate, streamline
- No lists of three adjectives. Pick the one that matters
- No "It's worth noting that" or "It's important to understand"

**Structure:**
- Every page has one job. If it's doing two things, split it
- Getting Started pages: action-oriented, copy-paste ready, under 200 words
- Guide pages: why, then how, then edge cases
- Reference pages: every parameter, every return value, with examples
- Config pages: show defaults, explain what each option does

**Content source:**
- Pull actual feature details from `docs/built/{feature}.md`
- Pull user context from `docs/project/users-journeys.md`
- Pull brand voice from `docs/project/brand-guidelines.md`
- Don't invent features. Don't describe things that aren't built

## Step 6: Build and verify

After writing all MDX files, `.source/` auto-regenerates on next dev start.

```bash
npm run build
```

Verify:
- All pages render without errors
- Sidebar navigation shows correct structure
- Search works (fumadocs includes built-in search)
- Links from landing page / sidebar work correctly
- Auth protection works (if internal docs)

## Packages (already installed — DO NOT reinstall)

```
"@fumadocs/cli": "^1.2.5"
"fumadocs-core": "^16.6.12"
"fumadocs-mdx": "^14.2.9"
"fumadocs-ui": "^16.6.12"
```

## File structure

```
webapp/
├── source.config.ts              # MDX collection definition
├── lib/source.ts                 # Loader with baseUrl
├── .source/                      # Auto-generated — DO NOT EDIT
│   ├── source.config.mjs
│   ├── server.ts
│   ├── browser.ts
│   └── dynamic.ts
├── content/docs/                  # MDX content lives here
│   ├── meta.json                  # Root navigation order
│   ├── index.mdx                  # Landing page
│   ├── quickstart.mdx
│   ├── {section}/
│   │   ├── meta.json              # Section navigation
│   │   └── {page}.mdx
│   └── ...
└── app/docs/                      # Route (or app/protected/docs/ if internal)
    ├── layout.tsx                 # DocsLayout wrapper
    └── [[...slug]]/page.tsx       # Page renderer
```
