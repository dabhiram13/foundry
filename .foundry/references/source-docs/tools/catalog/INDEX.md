# Tool Catalog

Pre-vetted tools for building SaaS apps. The tool-scout checks this catalog FIRST before searching the web. Each tool has a quick reference doc in this folder (20-30 lines).

**How to use this catalog:**
1. Tool-scout reads this INDEX to find matching tools for the idea
2. If a catalog tool fits, use it (no web search needed)
3. If nothing fits, THEN search the web for alternatives
4. After discovering a new tool, add it to this catalog for future kits

---

## AI / ML

| Tool | Package | What it does | Quick ref |
|------|---------|-------------|-----------|
| OpenAI | `openai` | GPT chat/completion, embeddings, vision, structured output, DALL-E | `openai.md` |
| Anthropic Claude | `@anthropic-ai/sdk` | Chat, analysis, long context, tool use, structured output | `anthropic.md` |
| Google Gemini | `@google/genai` | Multimodal (text+image+video+audio), structured output, function calling | `gemini.md` |
| Mistral | `@mistralai/mistralai` | Fast inference, OCR, code generation, embeddings | `mistral.md` |
| OpenRouter | `openrouter` | Unified API for 100+ models, automatic fallback, cheapest routing | `openrouter.md` |

## Transcription / Speech

| Tool | Package | What it does | Quick ref |
|------|---------|-------------|-----------|
| AssemblyAI | `assemblyai` | Transcription, speaker diarization, summarization, sentiment | `assemblyai.md` |
| Deepgram | `@deepgram/sdk` | Real-time + batch transcription, fast, cheap | `deepgram.md` |
| ElevenLabs | `elevenlabs` | Text-to-speech, voice cloning, sound effects | `elevenlabs.md` |
| OpenAI Whisper | `openai` | Transcription via OpenAI API (part of OpenAI package) | `openai.md` |

## Video / Media

| Tool | Package | What it does | Quick ref |
|------|---------|-------------|-----------|
| Mux | `@mux/mux-node` | Video upload, encoding, streaming, playback, analytics | `mux.md` |
| Cloudinary | `cloudinary` | Image/video upload, transform, optimize, CDN delivery | `cloudinary.md` |
| UploadThing | `uploadthing` | File uploads for Next.js (S3 under the hood, simple DX) | `uploadthing.md` |

## Scraping / Data Extraction (NO "apply for business API" -- use these instead)

| Tool | Package | What it does | Quick ref |
|------|---------|-------------|-----------|
| Apify | `apify-client` | Scraper marketplace: TikTok, Instagram, YouTube, Twitter, any website. Ready-made actors. | `apify.md` |
| RapidAPI | REST | API marketplace: 40K+ APIs. Social media, data, finance, weather, sports. Search by category. | `rapidapi.md` |
| Bright Data | REST | Proxies + scrapers + datasets. Social media, e-commerce, SERP. Enterprise-grade. | `brightdata.md` |
| Firecrawl | `@mendable/firecrawl-js` | Web scraping optimized for AI: URL to clean markdown, crawl entire sites | `firecrawl.md` |
| SerpAPI | `serpapi` | Google search results as JSON. Also Google Maps, Shopping, Scholar, YouTube | `serpapi.md` |

## Social Media Access (via scrapers, NOT official business APIs)

| Platform | Best tool | How | Quick ref |
|----------|-----------|-----|-----------|
| TikTok | RapidAPI under the hood `https://docs.tikfly.io/getting-started` | Trending, user videos, search, hashtags | `rapidapi.md` |
| TikTok metrics | RapidAPI `tiktok-api23` | Video metrics, user data. **Production-proven.** | `rapidapi.md` |
| Instagram | Apify `apify/instagram-scraper` | Posts, reels, stories, profiles, hashtags | `apify.md` |
| Instagram metrics | RapidAPI `instagram-api-fast-reliable-data-scraper` | Post/reel metrics, profiles. **Production-proven.** | `rapidapi.md` |
| YouTube | RapidAPI `yt-api` | Video + Shorts metrics, channels. **Production-proven.** | `rapidapi.md` |
| Twitter/X | RapidAPI `twttrapi` or Apify | Tweets, search, profiles, trends | `rapidapi.md` |
| YouTube | YouTube Data API v3 (free 10K/day) + Apify for transcripts | Videos, channels, search, comments | `youtube.md` |
| Reddit | Official API (free, generous) | Posts, comments, search, subreddits | `reddit.md` |
| LinkedIn | Apify `anchor/linkedin-scraper` | Profiles, companies, jobs (scraper only) | `apify.md` |
| Product Hunt | RapidAPI or Apify | Products, launches, votes | `rapidapi.md` |


## Search

| Tool | Package | What it does | Quick ref |
|------|---------|-------------|-----------|
| Algolia | `algoliasearch` | Full-text search, facets, instant results, analytics | `algolia.md` |
| Typesense | `typesense` | Open-source search, typo-tolerant, fast, self-hostable | `typesense.md` |
| Meilisearch | `meilisearch` | Open-source search, easy setup, typo-tolerant | `meilisearch.md` |

## PDF / Documents

| Tool | Package | What it does | Quick ref |
|------|---------|-------------|-----------|
| Puppeteer | `puppeteer` | HTML to PDF, screenshots, browser automation | `puppeteer.md` |
| React PDF | `@react-pdf/renderer` | Generate PDFs from React components (invoices, resumes, reports) | `react-pdf.md` |
| PDF.co | REST | Parse, extract, convert, merge, split PDFs via API | `pdfco.md` |
| Unstructured | `unstructured-client` | Extract text/tables from PDFs, images, docs for AI pipelines | `unstructured.md` |

## Maps / Location

| Tool | Package | What it does | Quick ref |
|------|---------|-------------|-----------|
| Mapbox | `mapbox-gl` | Maps, geocoding, directions, isochrones | `mapbox.md` |
| Google Maps | `@googlemaps/google-maps-services-js` | Maps, places, geocoding, directions, street view | `google-maps.md` |

## Scheduling / Calendar

| Tool | Package | What it does | Quick ref |
|------|---------|-------------|-----------|
| Cal.com | `@calcom/embed-react` | Scheduling widget, booking API, calendar sync | `calcom.md` |
| Calendly | REST | Scheduling links, event types, webhooks | `calendly.md` |


## Data / Finance / Sports

| Tool | Package | What it does | Quick ref |
|------|---------|-------------|-----------|
| Alpha Vantage | REST | Stock prices, forex, crypto, technical indicators (free tier) | `alphavantage.md` |
| Polygon.io | `@polygon.io/client-js` | Real-time + historical stock/crypto/forex data | `polygon.md` |
| SportRadar | REST (via RapidAPI) | Live scores, stats, odds for all major sports | `rapidapi.md` |
| API-Sports | REST (`api-sports.io`) | 12 sports, 2000+ competitions, livescores, odds, 15yr history. From $10/mo. | `api-sports.md` |
| OpenWeather | REST | Weather data, forecasts, historical, air quality | `openweather.md` |

## E-commerce / Products

| Tool | Package | What it does | Quick ref |
|------|---------|-------------|-----------|
| Shopify Storefront | `@shopify/storefront-api-client` | Product catalog, cart, checkout (headless commerce) | `shopify.md` |
| Printful | REST | Print-on-demand: products, mockups, shipping | `printful.md` |
---

## How the Tool-Scout Uses This

```
1. Read idea description
2. Read this INDEX.md
3. For each feature the idea needs:
   a. Check if a catalog tool covers it → use it
   b. If no catalog match → search the web
4. For each selected tool:
   a. Check if quick ref doc exists → read it for basics
   b. Deep docs will be generated in Phase 3 (doc-researcher)
5. Write tools.md listing selected tools + any new discoveries
```

## Adding New Tools

When a tool-scout discovers a tool NOT in this catalog:
1. Add a row to the relevant table in this INDEX.md
2. Create a quick ref doc: `.foundry/references/source-docs/tools/catalog/{tool}.md`
3. Keep it to 20-30 lines: what, install, auth, key endpoints, gotchas
