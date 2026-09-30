# Apify

Scraper marketplace with ready-made "actors" for any website. Best for social media scraping without official API access. No "apply for business API" needed.

## Install
```bash
npm install apify-client
```

## Auth
- Env: `APIFY_API_TOKEN`
- Get it: https://console.apify.com/account/integrations

## How it works
- Browse actors at https://apify.com/store
- Each actor = a pre-built scraper for a specific site/task
- Call actor via API, get structured JSON results
- Pay per compute unit (CU), not per request

## HOW TO SEARCH ANY TOOL ON APIFY: 
Select the first scraper when you search: using
https://apify.com/store/categories?search=

Like https://apify.com/store/categories?search=tiktok%20transcript

THEN VERIFY AND DOUBLE CHECK THE TOOL ACTUALLY DOES EXACTLY WHAT WE WANT!

## Key Actors (social media)

| Actor | ID | What |
|-------|----|------|
| TikTok Scraper | 
| Instagram Scraper | 
| Twitter/X Scraper | 
| LinkedIn Scraper | `
| Google Maps | 
| Website Scraper |

## Usage pattern
```typescript
import { ApifyClient } from 'apify-client';
const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
const run = await client.actor('clockworks/tiktok-scraper').call({ hashtags: ['viral'] });
const { items } = await client.dataset(run.defaultDatasetId).listItems();
```

## Pricing
- Free: 5 USD/month credits (enough for testing)
- Pay-as-you-go: ~$0.25-2.00 per 1000 results depending on actor
- Most actors cost 0.001-0.01 CU per result

## Gotchas
- Actor quality varies — check reviews and recent runs
- Some actors break when platforms update (check "last modified" date)
- Results are async — poll for completion or use webhooks
- Rate limit yourself to avoid IP blocks (actors handle this internally)
