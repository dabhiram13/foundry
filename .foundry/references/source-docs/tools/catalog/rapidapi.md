# RapidAPI

API marketplace with 40K+ APIs. One API key, unified billing. Best for finding niche APIs fast.

## Auth
- Env: `RAPIDAPI_KEY`
- Get it: https://rapidapi.com/developer/dashboard (subscribe to any API, key is global)

## How it works
- Browse APIs at https://rapidapi.com/hub
- Subscribe to an API (many have free tiers)
- All APIs use same auth header: `X-RapidAPI-Key`
- Each API has its own host: `X-RapidAPI-Host: {api}.p.rapidapi.com`

## HOW TO SEARCH ANY TOOL ON RAPIDAPI: 
Select the first scraper when you search: using
https://rapidapi.com/search?term=

Like https://rapidapi.com/search?term=tiktok&sortBy=ByRelevance

THEN VERIFY AND DOUBLE CHECK THE TOOL ACTUALLY DOES EXACTLY WHAT WE WANT!
Sort by relevance and take the first ones.

## Key APIs for SaaS builders

| Category | API | What | Free tier |
|----------|-----|------|-----------|
| Twitter/X | 
| Instagram | 
| TikTok |
| YouTube | 
| Sports |
| Weather | 
| Finance | 
| Email verify | 
| URL shorten |
| Translation |

## Battle-tested social media APIs (production-proven)

These specific RapidAPI providers are actively used in production on other projects with robust error handling, rate limit management, and retry logic already built out.

| Platform | RapidAPI Host | Endpoint | Returns |
|----------|--------------|----------|---------|
| TikTok | `tiktok-api23.p.rapidapi.com` | `GET /api/post/detail?videoId={id}` | views, likes, comments, shares, author, video metadata |
| Instagram | `instagram-api-fast-reliable-data-scraper.p.rapidapi.com` | `GET /post?shortcode={code}` | views (reels only), likes, comments, author, caption |
| YouTube | `yt-api.p.rapidapi.com` | `GET /video/info?id={id}` or `GET /shorts/info?id={id}` | views, likes, comments, channel info |

**Key learnings from production:**
- TikTok stats can be strings ("1.2M") or numbers — always parse both
- Instagram: never string-search full response for "429" (CDN URLs contain hex like `oe=697CE429`) — only check `data.error`/`data.message` fields
- YouTube: separate endpoints for regular videos vs Shorts (`/shorts/info`)
- All three hit rate limits often — schedule retries 4-6h apart with random jitter
- TikTok error codes: 10204 (under review), 10231 (geo-restricted), 100004 (songs loader bug)
- Instagram doesn't return share count; YouTube doesn't return share count

## Usage pattern
```typescript
const response = await fetch('https://{api}.p.rapidapi.com/endpoint', {
  headers: {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
    'X-RapidAPI-Host': '{api}.p.rapidapi.com'
  }
});
```

## How to find the right API
1. Go to https://rapidapi.com/hub
2. Search by category or keyword
3. Sort by "Popularity" — most popular = most reliable
4. Check: response time, uptime %, recent reviews
5. Test in browser before coding (RapidAPI has a built-in tester)

## Pricing
- Each API has its own pricing (free tier + paid tiers)
- One RapidAPI key works for all subscribed APIs
- Watch for APIs that charge per request vs per month

## Gotchas
- API quality varies wildly — always test free tier first
- Some APIs are wrappers of wrappers (slow, unreliable)
- Check "last updated" — abandoned APIs break
- Free tiers often have aggressive rate limits (100/month)
- Always have a fallback plan (Apify, Bright Data, or direct API)
