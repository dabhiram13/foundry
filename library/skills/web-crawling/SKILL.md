---
name: web-crawling
description: >
  Extract web content as clean markdown. Use for "crawl", "scrape", "extract this page",
  "get the content of", "read a website", "competitor research", "fetch docs as markdown",
  "site map", "recursive crawl", "scrape a site", "markdown from URL", "read article",
  "save web page", or any task that requires turning a URL into usable text.
---

# Web Crawling

Router. Pick the narrowest tool for the job.

## Route

| Task | Use |
|---|---|
| Single URL → clean markdown (no key needed) | `mcp__jina__jina_reader` (Jina MCP, already wired) |
| Web search + summarized results | `mcp__jina__jina_search` |
| Single URL with ads/nav stripped, **offline**, no key | `trafilatura -u <url>` (Python, `pip install trafilatura`) |
| Quality crawl, LLM-optimized, auth pages, JS-heavy, requires API key | `references/firecrawl/` |
| Recursive site crawl (depth, include-paths, progress) | `references/firecrawl-crawl/` |
| JS-heavy pages, cookies/auth, interactive form-fill + snapshot-based clicks | `agent-browser` skill |
| CAPTCHA bypass, paid zones (fallback if Firecrawl out of credits) | `brightdata/skills@scrape` (not installed — install on demand) |

## Defaults

1. **Start with Jina MCP** — zero config, already installed, handles 90% of "give me this page as markdown."
2. If Jina returns junk (heavy JS, auth, infinite scroll), jump to Firecrawl.
3. If **offline** or must not send URLs to third parties, use `trafilatura` locally.
4. For a whole site section, go straight to `references/firecrawl-crawl/`.
5. For login-walled content, use `agent-browser` — it drives a real browser and reuses the logged-in session.

## Setup notes

- `FIRECRAWL_API_KEY` — collect during `/setup` only if the project actually hits crawl quotas.
- `trafilatura` — `pip install trafilatura`. Zero key. Good quality on docs/articles.

## References

- `references/firecrawl/` — official Firecrawl skill (single-URL + map + interact)
- `references/firecrawl-crawl/` — recursive crawl with depth / include-paths / progress
