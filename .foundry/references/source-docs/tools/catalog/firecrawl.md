# Firecrawl

Web scraping optimized for AI: any URL to clean markdown. Handles JS rendering, anti-bot, pagination.

## Install
```bash
npm install @mendable/firecrawl-js
```

## Auth
- Env: `FIRECRAWL_API_KEY`
- Get it: https://firecrawl.dev/app/api-keys

## Key APIs
- **Scrape**: Single URL to markdown/HTML/JSON
- **Crawl**: Entire site (follows links, respects robots.txt)
- **Extract**: Structured data extraction with schema (AI-powered)

## Usage pattern
```typescript
import FirecrawlApp from '@mendable/firecrawl-js';
const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
const result = await firecrawl.scrapeUrl('https://example.com', { formats: ['markdown'] });
```

## Pricing
- Free: 500 credits/mo (1 credit = 1 page)
- Hobby: $19/mo for 3000 credits
- Standard: $99/mo for 100K credits

## When to use over Apify
- Need clean markdown output (for AI ingestion)
- Scraping arbitrary websites (not social media)
- Need structured extraction with a schema
- Simpler API (one call vs configuring actors)

## Gotchas
- Not great for social media (use Apify for that)
- Crawl is async — poll for completion
- Some sites block even with JS rendering
