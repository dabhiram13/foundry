---
name: blog-writer
description: >
  Research-driven blog writer for a SaaS product. Researches the industry via Tavily, reads the
  best sources via Jina, writes an SEO + AEO optimized MDX draft, saves it to Supabase as a draft,
  and emails the admin. Use for "write a blog post", "blog draft", "content for the blog",
  "weekly blog cron", "research a blog topic". Writes content only — it never touches code.
---

# Blog Writer Skill

Autonomous blog writer that researches your industry and writes SEO + AEO optimized drafts. Designed to run unattended via `/monitor` cron.

**This skill does NOT modify code.** It reads product context, researches the industry, writes content, saves to the database, and emails the admin.

## Prerequisites

- Blog infrastructure set up (`/blog` command completed)
- `TAVILY_API_KEY` in env (free at tavily.com — 1,000 searches/month)
- `ADMIN_EMAIL` in `webapp/.env`
- `RESEND_API_KEY` in `webapp/.env`
- `SUPABASE_SECRET_KEY` in `webapp/.env`
- Jina MCP Reader available (for full content extraction)

## Scripts

All scripts read `webapp/.env` automatically. Run from project root.

| Script | What it does | Usage |
|--------|-------------|-------|
| `library/skills/search/scripts/search.sh` | Tavily web search | `search.sh '{"query": "...", "max_results": 10}'` |
| `library/skills/blog-writer/scripts/get-recent-posts.sh` | Fetch last N posts from DB | `get-recent-posts.sh 20` → JSON array |
| `library/skills/blog-writer/scripts/save-post.sh` | Insert draft into blog_posts | `save-post.sh '{"slug":...,"title":...}'` |
| `library/skills/blog-writer/scripts/notify-admin.sh` | Email admin about new draft | `notify-admin.sh '{"title":...,"slug":...}'` |

---

## Phase 1: Load Product Context

Read these files to understand the product, personas, and niche:

```
docs/project/product-overview.md    → product name, category, pricing, value prop
docs/project/users-and-journeys.md  → target personas, their struggles, goals
docs/project/feature-map.md         → what the product does (for CTA relevance)
docs/project/brand-guidelines.md    → voice, tone, author info
```

Extract and hold in memory:
- **Product name** + category + value prop
- **Personas** — who they are, their pain points, what they search for
- **Industry/niche** — the space this product operates in
- **Brand voice** — how to write (tone, formality, personality)
- **Author info** — name, role, avatar URL for byline

---

## Phase 2: Check Existing Posts (Dedup)

Query the last 20 blog posts to avoid duplicating topics.

```bash
library/skills/blog-writer/scripts/get-recent-posts.sh 20
```

Returns JSON array: `[{title, description, slug, category, created_at}]`

The script reads `webapp/.env` automatically for Supabase credentials. Uses service role key to see drafts too.

Store the list of existing titles + descriptions. You MUST NOT write about a topic already covered.

---

## Phase 3: Research — Find the Perfect Topic

This is the most critical phase. You're finding what's **valuable to the personas**, not what's easy to write.

### Step 3a: Industry Research via Tavily

Run 3-5 Tavily searches targeting different angles:

```bash
# 1. Persona struggles + solutions
library/skills/search/scripts/search.sh '{"query": "[persona] struggles with [pain point] [current year]", "max_results": 10, "search_depth": "advanced", "time_range": "month"}'

# 2. Industry trends + news
library/skills/search/scripts/search.sh '{"query": "[industry/niche] trends [current year]", "max_results": 10, "search_depth": "advanced", "time_range": "month"}'

# 3. High-converting content in the niche
library/skills/search/scripts/search.sh '{"query": "best [product category] guide [current year]", "max_results": 10, "search_depth": "advanced"}'

# 4. Questions people are asking
library/skills/search/scripts/search.sh '{"query": "[niche] frequently asked questions how to", "max_results": 10, "search_depth": "advanced"}'

# 5. Competitor content gaps
library/skills/search/scripts/search.sh '{"query": "[product category] vs alternatives comparison", "max_results": 10, "search_depth": "advanced"}'
```

Replace bracketed terms with actual product context from Phase 1.

### Step 3b: Analyze Results & Pick Topic

From the search results, identify:
1. **Topics with high search intent** — questions people actually ask
2. **Gaps** — topics NOT covered by existing posts (Phase 2 dedup)
3. **Conversion potential** — topics where the product is a natural solution
4. **AEO opportunity** — topics where a well-structured answer could get cited by AI

**Topic selection criteria (ranked):**
1. Directly addresses a persona pain point
2. Has clear search volume (appears in multiple results)
3. Product is a natural, non-forced solution
4. Not already covered in existing posts
5. Can include data/stats (GEO boost)
6. Suitable for FAQ or How-To schema (AEO boost)

### Step 3c: Deep Research via Jina

For the chosen topic, extract full content from the 2-3 best sources:

Use Jina MCP Reader to get markdown content from URLs found in Tavily results. This gives you:
- Current statistics and data points to cite
- Expert quotes to reference
- Detailed information for comprehensive coverage

**Cost efficiency:** Only use Jina for 2-3 URLs max per post. Tavily snippets are enough for topic selection; Jina is for depth.

---

## Phase 4: Write the Post

### Content Structure

Every post MUST follow this structure for maximum SEO + AEO performance:

```markdown
# [Title — matches target query naturally]

<Callout>
[40-60 word extractable summary answering the core question. This is the featured snippet candidate.]
</Callout>

<LastUpdated date="[today's date]" />

## [Section matching "What is X?" or core definition]

[Definition block — concise, self-contained, citable]

## [Problem/Pain section — why this matters]

[Evidence sandwich: claim → data points with sources → actionable insight]

<Stat value="[number]" source="[org/study]" date="[year]">
[Context for the statistic]
</Stat>

## [Solution/How-to section]

<Steps>
1. **[Step name]**: [Clear action in 1-2 sentences]
2. **[Step name]**: [Clear action in 1-2 sentences]
3. **[Step name]**: [Clear action in 1-2 sentences]
</Steps>

## [Comparison or evaluation section — if applicable]

<ComparisonTable>
| Feature | Option A | Option B |
|---------|----------|----------|
| ... | ... | ... |

**Bottom line**: [1-2 sentence recommendation]
</ComparisonTable>

<ExpertQuote author="[Name]" role="[Title]" org="[Company]">
[Relevant quote from industry expert found in research]
</ExpertQuote>

## [Practical tips / Best practices]

[Listicle or numbered list with actionable advice]

<CTA>
[Natural product mention — how {product name} helps with this specific problem. NOT salesy. Helpful.]
</CTA>

## Frequently Asked Questions

<FAQ>
### [Question phrased as users search]?
[Direct answer first sentence. Supporting context 2-3 sentences.]

### [Question phrased as users search]?
[Direct answer first sentence. Supporting context 2-3 sentences.]

### [Question phrased as users search]?
[Direct answer first sentence. Supporting context 2-3 sentences.]
</FAQ>
```

### Writing Rules

1. **Voice**: Match brand guidelines exactly. No generic AI tone.
2. **Length**: 1,500-2,500 words. Comprehensive but not padded.
3. **Stats**: Every claim backed by data with source + date. Use stats from Jina research.
4. **AEO blocks**: Every post needs at least: 1 Callout, 1 FAQ (3+ questions), 1 Stat. Add Steps/ComparisonTable/ExpertQuote where natural.
5. **Target query**: Pick ONE primary query the post targets. This becomes `target_query` in DB.
6. **FAQ data**: Extract FAQ questions + answers as structured data for FAQPage schema.
7. **Schema types**: Default `['Article']`. Add `'FAQPage'` if FAQ exists. Add `'HowTo'` if Steps exists.
8. **CTA**: ONE natural product mention per post. Must solve the reader's problem, not pitch features.
9. **No fluff**: Every paragraph earns its place. Cut anything that doesn't inform, convince, or convert.
10. **Humanize**: Write like a knowledgeable human, not a content mill. Include opinions, specific recommendations, and real examples.

---

## Phase 5: Generate Metadata

For each post, generate:

| Field | How to generate |
|-------|----------------|
| `slug` | Kebab-case from title, max 60 chars |
| `title` | Post title (60-70 chars for SERP) |
| `description` | Meta description (150-160 chars, includes target query) |
| `content` | Full MDX content from Phase 4 |
| `category` | Infer from topic (e.g., "Industry Trends", "How-To", "Guide", "Comparison") |
| `tags` | 3-5 relevant tags |
| `status` | `'draft'` (always — admin publishes) |
| `author_name` | From brand guidelines |
| `author_role` | From brand guidelines |
| `author_avatar` | From brand guidelines |
| `seo_title` | Optimized `<title>` override if different from title |
| `seo_description` | Override meta description if needed |
| `target_query` | Primary AEO target query |
| `schema_types` | `['Article', 'FAQPage']` minimum (add `'HowTo'` if Steps used) |
| `faq_data` | `[{question, answer}]` extracted from FAQ section |

---

## Phase 6: Save to Database

Save the post using the provided script. Build the JSON payload from Phase 5 metadata:

```bash
library/skills/blog-writer/scripts/save-post.sh '{
  "slug": "your-generated-slug",
  "title": "Your Post Title",
  "description": "Meta description 150-160 chars",
  "content": "Full MDX content here...",
  "category": "Guide",
  "tags": ["tag1", "tag2", "tag3"],
  "author_name": "Author Name",
  "author_role": "Author Role",
  "author_avatar": "https://...",
  "target_query": "how to solve X",
  "schema_types": ["Article", "FAQPage"],
  "faq_data": [{"question": "What is X?", "answer": "X is..."}]
}'
```

The script:
- Reads `webapp/.env` for Supabase credentials automatically
- Requires `SUPABASE_SECRET_KEY` (bypasses RLS to insert)
- Forces `status: "draft"` (safety — never publishes directly)
- Returns the created post as JSON

---

## Phase 7: Email Notification

Notify the admin that a new draft is ready:

```bash
library/skills/blog-writer/scripts/notify-admin.sh '{
  "title": "Your Post Title",
  "slug": "your-generated-slug",
  "category": "Guide",
  "target_query": "how to solve X",
  "word_count": 1800,
  "description": "Meta description"
}'
```

The script:
- Reads `webapp/.env` for `RESEND_API_KEY`, `ADMIN_EMAIL`, `NEXT_PUBLIC_SITE_URL`
- Sends a styled HTML email with post details, preview link, and dashboard link
- Gracefully skips if `RESEND_API_KEY` or `ADMIN_EMAIL` not set (no crash)

---

## Topic Ideas by Category

When selecting topics, rotate between these high-performing categories:

| Category | Example Format | AEO Potential |
|----------|---------------|---------------|
| **How-To Guide** | "How to [solve persona pain point]" | HowTo schema, Steps component |
| **Industry Trends** | "[Year] [Industry] Trends: What's Changing" | Stats, ExpertQuotes |
| **Comparison** | "[Solution A] vs [Solution B]: Which is Right for You?" | ComparisonTable, FAQ |
| **Best Practices** | "[Number] [Industry] Best Practices for [Goal]" | Listicle, Steps |
| **Problem-Solution** | "Why [Persona] Struggle with [X] (And How to Fix It)" | FAQ, Callout, CTA |
| **Data/Research** | "[Industry] Statistics: [Number] Facts You Need to Know" | Stats, Evidence Sandwich |
| **Beginner Guide** | "Complete Guide to [Topic] for [Persona]" | Definition, Steps, FAQ |
| **Tools/Resources** | "Top [Number] [Tools/Resources] for [Goal] in [Year]" | ComparisonTable, listicle |

---

## Scheduled drafting

Create a recurring task only when the user explicitly asks. Prefer a Codex app automation whose prompt invokes the enabled blog-writing skill and saves a draft. In a CLI-only environment, `codex exec -C /absolute/project/path "Use the enabled blog-writer skill to create one draft"` inherits the user's configured model and sandbox. Sending email or publishing remains a separate explicit action.

---

## What This Skill Does NOT Do

- Modify any code files
- Publish posts (always saves as draft)
- Manage existing posts (that's the admin UI)
- Set up blog infrastructure (that's the `/blog` command)
- Handle images or media (cover images are OG-generated)
