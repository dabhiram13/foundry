<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: seo
description: Full SEO implementation and audit for the Next.js App Router app — metadata, JSON-LD, OG images, sitemap, robots, Core Web Vitals.
---

# /seo — Full SEO Implementation & Audit

Implements production-grade SEO for a Next.js App Router SaaS: metadata, JSON-LD structured data, OG images, sitemap, robots, AI SEO, Core Web Vitals, and crawlability. Reads the product context, audits what exists, fills every gap.

---

## Skills to Load

- `nextjs-seo` — Next.js 16 metadata API, sitemap, robots, JSON-LD patterns
- `ai-seo` — AI answer engine optimization, platform ranking factors, content patterns
- `seo-audit` — Technical + on-page audit framework

---

## Phase 1: Load Product Context

Read the product to know what we're optimizing for:

```
docs/project/product-overview.md          — what the app does, pricing, positioning
docs/project/users-and-journeys.md        — who the audience is, pain points
docs/project/brand-guidelines.md          — brand name, voice, tagline
docs/project/feature-map.md              — key features (for structured data)
```

Synthesize into an **SEO brief** — a dense summary covering: product name, tagline, category, target audience, primary keywords (5-10), pricing model, top 3 value propositions, and the primary URL. This informs every metadata field.

---

## Phase 2: Audit Current State

Read ALL existing SEO-related files:

```
webapp/app/layout.tsx                     — root metadata, viewport, fonts
webapp/app/sitemap.ts                     — current sitemap
webapp/app/robots.ts                      — current robots config
webapp/app/opengraph-image.tsx            — root OG image
webapp/app/(marketing)/page.tsx           — landing page (most important for SEO)
webapp/app/not-found.tsx                  — 404 page
```

Also scan for:
```bash
# Find all generateMetadata or metadata exports
cd webapp && grep -rn "generateMetadata\|export const metadata\|export const viewport" app/ --include="*.tsx" --include="*.ts"

# Find existing JSON-LD
cd webapp && grep -rn "application/ld+json\|JsonLd" app/ components/ --include="*.tsx" --include="*.ts"

# Find existing canonical/alternates
cd webapp && grep -rn "alternates\|canonical" app/ --include="*.tsx" --include="*.ts"

# Check for llms.txt
ls webapp/public/llms.txt 2>/dev/null || ls webapp/app/llms.txt 2>/dev/null

# Check for favicon
ls webapp/app/favicon.ico webapp/public/favicon* webapp/app/icon* webapp/app/apple-icon* 2>/dev/null

# List all public marketing routes
find webapp/app -name "page.tsx" | grep -v "protected\|dashboard\|admin\|auth" | sort
```

### Produce Audit Report

Present findings before making changes:

```
## SEO Audit

### What Exists
- [ ] metadataBase: {YES/NO — value}
- [ ] Title template: {YES/NO — pattern}
- [ ] Default description: {YES/NO — length}
- [ ] Open Graph: {YES/NO — which fields}
- [ ] Twitter Card: {YES/NO — card type}
- [ ] Viewport: {YES/NO — separate export?}
- [ ] robots.ts: {YES/NO — what's blocked}
- [ ] sitemap.ts: {YES/NO — how many URLs}
- [ ] OG image: {YES/NO — dimensions}
- [ ] JSON-LD: {YES/NO — which schemas}
- [ ] Canonical URLs: {YES/NO}
- [ ] Per-page metadata: {YES/NO — which pages}
- [ ] favicon: {YES/NO}
- [ ] llms.txt: {YES/NO}
- [ ] AI bot access: {YES/NO — which bots allowed}
- [ ] 404 page: {YES/NO}

### Gaps to Fill
{numbered list of everything missing, in priority order}

### Proposed Changes
{what files will be created/modified}

Approve? Or adjust scope?
```

**DO NOT modify any file until the user approves.**

---

## Phase 3: Implement Core SEO

### 3A. Root Layout Metadata

Edit `webapp/app/layout.tsx` — enhance the existing `metadata` export:

```typescript
import type { Metadata, Viewport } from "next";

// Viewport MUST be a separate export (Next.js 14+)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: '{Product Name} — {Tagline}',
    template: '%s | {Product Name}',
  },
  description: '{Compelling 150-160 char description with primary keyword}',
  keywords: ['{keyword1}', '{keyword2}', ...],
  authors: [{ name: '{Product Name}' }],
  creator: '{Product Name}',
  publisher: '{Product Name}',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: defaultUrl,
    siteName: '{Product Name}',
    title: '{Product Name} — {Tagline}',
    description: '{OG description — can be longer, more compelling}',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: '{Product Name}' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@{handle}',
    creator: '@{handle}',
    title: '{Product Name} — {Tagline}',
    description: '{Twitter description — max 200 chars}',
    // Next.js auto-detects app/twitter-image.tsx if it exists (created by /logo)
    // Only set this manually if no twitter-image.tsx file exists
    images: ['/twitter-image'],
  },
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // Add verification codes if provided
  // verification: {
  //   google: 'your-code',
  // },
};
```

**Rules:**
- Title: 50-60 chars, primary keyword near beginning
- Description: 150-160 chars, compelling + keyword-rich
- `viewport` MUST be a separate export (Next.js 14+ requirement)
- `metadataBase` required for relative URLs
- `formatDetection` prevents auto-linking on mobile
- Every field must reflect THIS product, not generic placeholders

### 3B. Robots.ts — Full Configuration

```typescript
// webapp/app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  // Block indexing on non-production
  if (process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview') {
    return {
      rules: { userAgent: '*', disallow: '/' },
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/protected/',
          '/dashboard/',
          '/admin/',
          '/auth/',
          '/onboarding/',
          '/_next/',
        ],
      },
      // Allow AI search bots (for AI SEO citations)
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'anthropic-ai', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      // Block AI training crawlers (not search)
      { userAgent: 'CCBot', disallow: '/' },
      { userAgent: 'GPTBot', disallow: '/' },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
```

**Key decisions:**
- Block preview/dev environments from indexing
- Allow AI search bots (ChatGPT-User, PerplexityBot, ClaudeBot) for citations
- Block AI training bots (CCBot, GPTBot) to protect content
- Block all private routes (/protected/, /dashboard/, /admin/, /auth/)

### 3C. Sitemap.ts — Dynamic + Static

```typescript
// webapp/app/sitemap.ts
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  // Static marketing pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
      images: [`${baseUrl}/opengraph-image`],
    },
    // Add all public marketing routes discovered in audit
  ];

  // Dynamic pages (blog, docs, etc.) — fetch from DB if they exist
  // const posts = await getPosts();
  // const dynamicPages = posts.map(post => ({
  //   url: `${baseUrl}/blog/${post.slug}`,
  //   lastModified: new Date(post.updated_at),
  //   changeFrequency: 'monthly' as const,
  //   priority: 0.7,
  // }));

  return [...staticPages];
}
```

**Rules:**
- Include ALL public marketing routes (landing, pricing, features, about, blog, docs)
- Exclude auth, dashboard, admin, API routes
- Include OG images in sitemap (Next.js 16 feature)
- Set priority: homepage=1, landing=0.9, features/pricing=0.8, blog=0.7
- Use `changeFrequency` that matches actual update patterns
- Auth/login pages should NOT be in sitemap

### 3D. JSON-LD Structured Data

Create a reusable JsonLd component at `webapp/components/seo/json-ld.tsx`.

Use the standard Next.js pattern: a `<script type="application/ld+json">` tag with `JSON.stringify(data)` and XSS protection (escape `<` as `\u003c` in the serialized output).

This is safe because JSON-LD schemas contain only our own product data (not user input), and the escaping prevents script injection.

**Required schemas (inject in root layout or marketing layout):**

1. **Organization** — company name, logo, social links, contact
2. **WebSite** — site name, URL, search action (if search exists)
3. **WebApplication / SoftwareApplication** — for SaaS: category, pricing, features

**Page-specific schemas:**

4. **FAQPage** — on landing page FAQ section (must match visible content)
5. **BreadcrumbList** — on docs, blog, nested pages
6. **Article / BlogPosting** — on blog posts (datePublished, author, publisher)

**Implementation rules:**
- JSON-LD goes in `<body>`, not `<head>` (Next.js App Router pattern)
- XSS protection: always escape `<` characters in serialized output
- Schema content MUST match visible page content (Google rejects mismatches)
- Test with Google Rich Results Test after implementation

### 3E. Per-Page Metadata

Add `generateMetadata` or static `metadata` to key pages:

**Pages that MUST have unique metadata:**
- Landing page (`/(marketing)/page.tsx`) — primary keywords, main CTA
- Pricing page — pricing keywords, comparison terms
- Features page — feature-specific keywords
- Blog posts — dynamic via `generateMetadata`
- Docs pages — dynamic via `generateMetadata`

**Pages that MUST have noindex:**
- Auth pages (`/auth/*`) — login, signup, password reset
- Dashboard (`/protected/*`, `/dashboard/*`)
- Admin (`/admin/*`)
- Onboarding (`/onboarding/*`)
- API routes (handled by robots.txt)

```typescript
// Example: auth layout noindex
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
```

### 3F. OG Image

Audit and enhance the existing `opengraph-image.tsx`:
- Must be 1200x630px
- Must include product name and tagline
- Must be readable at thumbnail size (48px+ font)
- Must use brand colors
- Keep text in safe zone (avoid edges)

If blog/dynamic content exists, create per-page OG images:
```
webapp/app/blog/[slug]/opengraph-image.tsx
```

### 3G. Canonical URLs

Add `alternates.canonical` to every public page:

```typescript
alternates: {
  canonical: '/pricing', // Relative to metadataBase
},
```

This prevents duplicate content from:
- www vs non-www
- trailing slash variations
- UTM parameter URLs
- HTTP vs HTTPS

---

## Phase 4: AI SEO

### 4A. llms.txt

Create `webapp/app/llms.txt/route.ts` — machine-readable product info for AI crawlers:

```typescript
export async function GET() {
  const content = `
# {Product Name}

> {One-line description}

## What it does
{2-3 sentence product description}

## Key Features
- {Feature 1}: {brief description}
- {Feature 2}: {brief description}
- {Feature 3}: {brief description}

## Pricing
- {Plan 1}: $price/month — {what's included}
- {Plan 2}: $price/month — {what's included}

## Documentation
- Homepage: {url}
- Docs: {url}/docs
- API: {url}/docs/api

## Contact
- Support: {email}
`.trim();

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate',
    },
  });
}
```

### 4B. AI-Friendly Content Structure

Audit landing page content for AI extractability:
- Does H1 answer "What is {Product Name}?"
- Are features in structured lists (not just prose)?
- Is pricing transparent and extractable?
- Is there a FAQ section with natural-language questions?
- Does the FAQ have FAQPage JSON-LD schema?

If gaps exist, flag them for the user (don't rewrite marketing copy without approval).

---

## Phase 5: Performance SEO

Verify Core Web Vitals foundations:

```bash
# Check next/image usage
cd webapp && grep -rn "next/image\|<img " app/ features/ components/ --include="*.tsx" | head -20

# Check next/font usage
cd webapp && grep -rn "next/font" app/layout.tsx

# Check script loading
cd webapp && grep -rn "next/script\|<script" app/ --include="*.tsx" | head -10

# Check for priority on hero images
cd webapp && grep -rn "priority" app/ features/ --include="*.tsx" | head -10
```

**Verify:**
- [ ] Fonts use `next/font` with `display: 'swap'`
- [ ] Hero/LCP image has `priority` prop
- [ ] All images use `next/image` (not raw `<img>`)
- [ ] Analytics scripts use `strategy="afterInteractive"` or `strategy="lazyOnload"`
- [ ] No render-blocking scripts in `<head>`

Flag issues but don't refactor components — performance fixes are surgical and context-dependent.

---

## Phase 6: Verify

### Type Check
```bash
cd webapp && npx tsc --noEmit
```
Must pass. Fix up to 3 cycles.

### Validate Structured Data
```bash
# Check JSON-LD renders in build output
cd webapp && npm run build 2>&1 | tail -20
```

### Validate robots.txt and sitemap
```bash
# Start dev server and check
cd webapp && npm run dev &
sleep 5
curl -s http://localhost:3000/robots.txt
curl -s http://localhost:3000/sitemap.xml
curl -s http://localhost:3000/llms.txt
kill %1
```

### Scan for Issues
```bash
# Check no auth pages in sitemap
cd webapp && grep -n "auth\|login\|sign-up\|dashboard\|admin" app/sitemap.ts || echo "CLEAN"

# Check noindex on private routes
cd webapp && grep -rn "index: false" app/auth/ app/protected/ app/admin/ --include="*.tsx" --include="*.ts" || echo "WARNING: private routes may be indexed"
```

---

## Phase 7: Report

```
## SEO Implementation Complete

### Files Created
- {list of new files}

### Files Modified
- {list of modified files with what changed}

### Metadata Coverage
| Page | Title | Description | OG | Canonical | JSON-LD |
|------|-------|-------------|-----|-----------|---------|
| / (landing) | {title} | {length}ch | Yes | Yes | Organization, WebSite, FAQ |
| /pricing | ... | ... | ... | ... | ... |
| ... | ... | ... | ... | ... | ... |

### Structured Data
- Organization: {implemented/skipped}
- WebSite + SearchAction: {implemented/skipped}
- SoftwareApplication: {implemented/skipped}
- FAQPage: {implemented/skipped — on which pages}
- BreadcrumbList: {implemented/skipped}

### AI SEO
- llms.txt: {created/skipped}
- AI bot access: {which bots allowed}
- Content extractability: {assessment}

### Robots & Sitemap
- Blocked routes: {list}
- Sitemap URLs: {count}
- Preview/dev blocking: {yes/no}

### Performance Flags
- {any issues found}

### Remaining Manual Steps
1. Submit sitemap to Google Search Console: {url}/sitemap.xml
2. Verify site ownership in GSC
3. Add Google verification code to metadata (if provided)
4. Test OG images: https://developers.facebook.com/tools/debug/
5. Test Twitter cards: https://cards-dev.twitter.com/validator
6. Test structured data: https://search.google.com/test/rich-results
7. Run Lighthouse audit on deployed site

tsc: PASS
```

---

## Key Constraints

- DO NOT modify existing marketing copy (headlines, descriptions, CTAs) — SEO metadata uses product context but doesn't touch visible content
- DO NOT add noindex to pages that should be indexed
- DO NOT include private routes in sitemap
- DO NOT block AI search bots unless user explicitly requests it
- DO NOT change the `PROTECTED` comment sections in layout.tsx — append only
- DO NOT implement schemas that don't match visible page content (Google penalizes this)
- DO NOT apply changes without user approval of the audit report
- JSON-LD `<` characters MUST be escaped (XSS protection)
- Viewport MUST be a separate export from metadata (Next.js 14+ requirement)
- All keywords and descriptions must reflect THIS product's actual positioning

## Error Recovery

- tsc fails -> fix type errors, re-run
- Sitemap URL mismatch -> check `NEXT_PUBLIC_APP_URL` / `VERCEL_URL` env vars
- JSON-LD validation fails -> check schema against https://validator.schema.org/
- OG image not rendering -> verify `opengraph-image.tsx` exports `size`, `contentType`, `alt`
- robots.txt blocking too much -> verify disallow paths don't catch marketing routes
