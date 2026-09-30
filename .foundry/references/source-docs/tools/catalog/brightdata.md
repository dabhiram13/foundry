# Bright Data

Enterprise-grade scraping infrastructure: proxies, pre-built scrapers, ready datasets. Handles anti-bot for you.

## Auth
- Env: `BRIGHTDATA_API_TOKEN`
- Get it: https://brightdata.com/cp/api_tokens

## Products (pick one per use case)

| Product | What | Best for |
|---------|------|----------|
| Web Scraper API | Send URL, get structured data | Any website, handles JS rendering |
| SERP API | Google/Bing search results as JSON | SEO tools, search features |
| Social scrapers | Pre-built for TikTok, Instagram, etc. | Social media data |
| Datasets | Ready-made datasets (e-commerce, LinkedIn, etc.) | Bulk data needs |
| Proxies | Residential/datacenter proxies | Custom scrapers |

## Usage pattern (Web Scraper API)
```typescript
const response = await fetch('https://api.brightdata.com/request', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.BRIGHTDATA_API_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ url: 'https://example.com', format: 'json' })
});
```

## Pricing
- Pay-as-you-go: starts at $0.001/request for basic scraping
- Free trial: $5 credit
- More expensive than Apify but more reliable for high-volume

## When to use over Apify
- Need higher reliability / SLA
- Scraping at scale (10K+ pages/day)
- Need residential proxies (anti-bot bypass)
- Pre-built datasets save scraping time entirely

## Gotchas
- More complex setup than Apify
- Pricing can get expensive at scale
- Overkill for small MVP scrapers — try Apify first
