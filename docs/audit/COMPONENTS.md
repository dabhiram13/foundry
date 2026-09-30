# Component map — installed Code Kit 0.3.0

Read-only inventory. A present recipe or agent configuration is not evidence that it has run successfully. Descriptions below come from local entry-point metadata. Every paired target exists. Full file paths and hashes are in inventory.tsv.

## Commands → native Codex skills

| Claude name | Codex invocation | Declared purpose |
|---|---|---|
| /analytics | $codekit-analytics | Choose the right analytics provider, define the event map, and then implement the first useful instrumentation. Defaults to PostHog for product analytics but can route to other providers. |
| /audit | $codekit-audit | Dependency and code quality audit. Checks for outdated packages, unused dependencies, dead code, and code health metrics. Writes report. |
| /blog | $codekit-blog | Blog infrastructure — DB table, oRPC CRUD, listing/post pages, SEO + AEO ready (schema markup, OG images, AI bot access, RSS, sitemap). No content generation — the blog-writer skill handles that via /monitor cron. |
| /deep-interview | $codekit-deep-interview | Socratic requirements gathering with ambiguity scoring. Asks ONE question at a time targeting the weakest clarity dimension. Produces a crystal-clear spec when ambiguity drops below 20%. |
| /deploy | $codekit-deploy | Ship the app to Vercel end-to-end — readiness audit, missing-credential handoff, deploy, post-deploy verification. Vercel only; Docker and VPS are not part of this kit. |
| /design | $codekit-design | Tune the brand design system — design tokens and branded shadcn components; changes cascade app-wide. |
| /discover | $codekit-discover | Full project discovery for new + complex product work. Agents research your idea autonomously — market, competitors, tools, trends — then come to you already informed. Minimal questions, maximum output. Produces docs/project/ + docs/tools/. |
| /domain | $codekit-domain | Configure the transactional email sender domain and audit the email templates; takes the domain as $ARGUMENTS. |
| /drift | $codekit-drift | Pattern drift detection. Compares recent features against established patterns to catch inconsistencies before they compound. Run after every 3 features or manually. |
| /emails | $codekit-emails | Design and implement lifecycle email sequences for any SaaS. Reads product context, designs drip campaigns (welcome, activation, upgrade, churn, win-back), implements via Inngest + React Email + Resend. Doubles activation rates. |
| /enhance | $codekit-enhance | Enhance an existing feature. Reads built docs, inspects actual code, asks ultra-relevant questions about the improvement, then builds it. |
| /fix-issue | $codekit-fix-issue | Show pending Sentry issues from latest report, pick which to fix, spawn agents to resolve them. Interactive issue fixer. |
| /fumadocs | $codekit-fumadocs | Generate the product documentation site with fumadocs — learns the product from the codebase, writes every page. |
| /heal | $codekit-heal | Closed-loop healing. Reads all monitor reports, creates a branch, fixes critical/high issues with the right agents, runs quality gates + tests, re-verifies, scores confidence, emails verdict. Never touches main. |
| /help | $codekit-help | Show all available slash commands grouped by purpose. Run this anytime you forget what's available or want a quick tour of the framework surface. |
| /landing-design | $codekit-landing-design | Landing page design competition — four designer teammates, four routes, four strategies; you pick the winner live. |
| /logo | $codekit-logo | Generate six brand logo variations in parallel, each by its own logo-designer agent with a visual feedback loop. |
| /monitor | $codekit-monitor | Set up scheduled tasks for recurring security, performance, audit, and sentry checks. Cross-platform (Linux/macOS/Windows). Persists across sessions. |
| /mvp-build | $codekit-mvp-build | Build the next feature from roadmap.json. Reads roadmap, syncs with docs/built/, finds next pending spec, hands it to the orchestrator. Run repeatedly — one feature per session. |
| /mvp-spec | $codekit-mvp-spec | Batch-generate specs for all MVP features from /discover docs. Triages features (absorb/merge/split), generates specs for build phases, presents full build plan for review. Run after /discover. |
| /payments | $codekit-payments | Route payment and billing work across Stripe, Lemon Squeezy, and Polar. Choose the provider, scope the billing model, and verify the purchase flow safely. |
| /pentest | $codekit-pentest | Penetration testing agent team. Reads the latest security report, then actually attacks the running app to VALIDATE findings. Also runs its own exploit discovery. API pentester + Browser pentester + Auth pentester. Writes report with proof-of-concept evidence. |
| /performance | $codekit-performance | Performance audit. Checks pages and API calls against best practice skills (Vercel React, Supabase Postgres, oRPC, Next.js, caching). Analyzes recent git changes. Writes report. |
| /rate-limit | $codekit-rate-limit | Move rate limiting from in-memory to production-grade distributed limits (Upstash/Redis) across the API surface. |
| /schema-sync | $codekit-schema-sync | Regenerate db-schema.md from the live Supabase database — tables, columns, RLS, relationships. |
| /security | $codekit-security | Security audit of recent changes. 5 specialized agents scan for RLS gaps, injection, auth bypass, data leakage, and config issues. Feeds into /pentest. |
| /sentry | $codekit-sentry | Analyze production errors from Sentry. Deep triage, root cause analysis, fix recommendations. Reports saved to dev/reports/sentry/. Loopable via /monitor. |
| /seo | $codekit-seo | Full SEO implementation and audit for the Next.js App Router app — metadata, JSON-LD, OG images, sitemap, robots, Core Web Vitals. |
| /settings | $codekit-settings | Adaptive settings page. Reads project docs + built features to discover what sections THIS SaaS needs, writes spec, runs full pipeline (planning team, build agents, design team, testing team). Execute after auth + onboarding + billing. |
| /setup | $codekit-setup | Guided environment and service setup after discovery. Collect API keys and service credentials at the right time, write env vars safely, and verify the project is ready to build. |
| /skeleton | $codekit-skeleton | Clone an opinionated starter skeleton into the current project. Use when the user wants to build on the buildthisnow reference stack instead of scaffolding from scratch. |
| /spec | $codekit-spec | Interactive spec creation wizard. Detects scope (backend/frontend/full-stack), researches external APIs via Jina if needed, writes a production-grade spec, pauses for review, optionally plans and builds. Works with or without prior discovery docs. |
| /start | $codekit-start | One-time intent-first intake. Understand what the user wants, choose the best path, reflect it back, and ask for a simple yes/no before proceeding. |
| /trace | $codekit-trace | Render a build timeline from trace.jsonl — shows agent durations, phase transitions, quality gate results, retries, persistence blocks, and failures. |

## Shared skills

| Skill | Declared purpose |
|---|---|
| agent-browser | Browser automation CLI for AI agents. Use when the user needs to interact with websites, including navigating pages, filling forms, clicking buttons, taking screenshots, extracting data, testing web apps, or automating any browser task. Triggers include requests to "open a website", "fill out a form", "click a button", "take a screenshot", "scrape data from a page", "test this web app", "login to a site", "automate browser actions", or any task requiring programmatic web interaction. |
| ai-sdk | Vercel AI SDK expert guidance for AI-powered features — chat interfaces, text generation, structured output, tool calling, agents, MCP integration, streaming, embeddings, reranking, image generation, and any LLM provider. Use for "ai sdk", "vercel ai", "streamText", "generateText", "useChat", "tool calling", "structured output", "stream a model response", "add AI chat to my app". |
| ai-seo | When the user wants to optimize content for AI search engines, get cited by LLMs, or appear in AI-generated answers. Also use when the user mentions 'AI SEO,' 'AEO,' 'GEO,' 'LLMO,' 'answer engine optimization,' 'generative engine optimization,' 'LLM optimization,' 'AI Overviews,' 'optimize for ChatGPT,' 'optimize for Perplexity,' 'AI citations,' 'AI visibility,' 'zero-click search,' 'how do I show up in AI answers,' 'LLM mentions,' or 'optimize for Claude/Gemini.' Use this whenever someone wants their content to be cited or surfaced by AI assistants and AI search engines. For traditional technical and on-page SEO audits, see seo-audit. For structured data implementation, see schema-markup. |
| analytics-integration | Route analytics work to the right provider and event plan. Use for "analytics", "event tracking", "product analytics", "tracking plan", "funnel tracking", "posthog", "datafast", "umami", "plausible", or "mixpanel". Good for choosing a provider, defining events, and deciding what should be configured now vs later in setup. |
| blog-writer | Research-driven blog writer for a SaaS product. Researches the industry via Tavily, reads the best sources via Jina, writes an SEO + AEO optimized MDX draft, saves it to Supabase as a draft, and emails the admin. Use for "write a blog post", "blog draft", "content for the blog", "weekly blog cron", "research a blog topic". Writes content only — it never touches code. |
| browser-debugging | Reproduce and diagnose browser-visible problems fast. Use for "browser debugging", "console error", "network issue", "UI bug", "reproduce in browser", "take a screenshot", "playwright debug", or when web behavior must be verified visually instead of guessed. |
| canary-watch | Monitor a deployed URL for regressions after deploys, merges, or dependency upgrades. Use for "canary", "watch the deploy", "monitor this url", "regression watch", "uptime monitor", "did the deploy break anything". |
| claude-api | Build, debug, and optimize Claude API / Anthropic SDK apps; every app built with this skill includes prompt caching. Use for "claude api", "anthropic sdk", "prompt caching", "@anthropic-ai/sdk", "messages api", "managed agents". Do not use when the code imports openai or another AI SDK, or for general programming and ML/data-science tasks. |
| codebase-navigation | Map an unfamiliar repo quickly: find entrypoints, trace data flow, locate ownership, identify existing patterns, and narrow the likely files for a change. Use for "understand this codebase", "where does this live", "find the entrypoint", "trace this flow", "map the repo", or before changing an unfamiliar area. |
| codebase-onboarding | Analyze an unfamiliar codebase and generate a structured onboarding guide — architecture map, key entry points, conventions, and a starter CLAUDE.md. Use for "onboard me to this repo", "new to this codebase", "write a CLAUDE.md", "document the architecture", "first time in this project". |
| copywriting | When the user wants to write, rewrite, or improve marketing copy for any page — including homepage, landing pages, pricing pages, feature pages, about pages, or product pages. Also use when the user says "write copy for," "improve this copy," "rewrite this page," "marketing copy," "headline help," "CTA copy," "value proposition," "tagline," "subheadline," "hero section copy," "above the fold," "this copy is weak," "make this more compelling," or "help me describe my product." Use this whenever someone is working on website text that needs to persuade or convert. For email copy, see email-sequence. For popup copy, see popup-cro. For editing existing copy, see copy-editing. |
| create-skill | Build Claude Skills from scratch. Use when user asks to "create a skill", "build a skill", "make a skill", "skill for X", "write a skill", or describes a repeatable workflow they want Claude to learn. |
| customer-billing-ops | Operate customer billing workflows — subscriptions, refunds, churn triage, billing-portal recovery, plan analysis — through connected billing tools like Stripe. Use for "refund a customer", "cancel a subscription", "customer can't access billing portal", "churn triage", "check subscription state", "duplicate charge". |
| debugger-detective | Source-agnostic bug investigation. Use for "debug this", "find the root cause", "why is X broken", "trace this bug", "investigate this error", "bisect this regression", or whenever a bug is reported without a clear fix path. Captures evidence, ranks hypotheses, reproduces, isolates, proposes the minimal fix, and leaves a postmortem artifact. Complements sentry (prod errors), fix-test (failing tests), and browser-debugging (UI repros) — this is the general methodology. |
| deploy-verify | Source-agnostic post-deploy verification. Use for "verify this deploy", "deploy check", "post-deploy smoke test", "is production healthy", "verify the rollout", "visual regression", "screenshot test", after any push to Vercel / Docker / VPS. Runs health / SSL / env / perf / content / API checks plus browser interaction, responsive-layout and accessibility passes on the touched routes, compares staging vs prod, proves the rollback path exists, and emits a PASS / FAIL / INCOMPLETE verdict with evidence. Feeds failures to /heal. |
| develop-and-deploy | Route deployment and infrastructure work across Vercel, Docker, and VPS paths. Use for "deploy", "deployment", "vercel deploy", "docker", "vps", "ssh", "nginx", "ssl", or "firewall". Good for deciding how to ship, what infra is needed, and which credentials should be collected later in setup. |
| discover | Full project discovery. Archetype-aware — runs the right flow for SaaS, internal tools, or client projects. Produces docs/project/ + docs/tools/. Everything /mvp-spec needs. Use for "discover", "new project", "research idea", "scope project", "scope tool". |
| documentation-lookup | Pull up-to-date library and framework docs through Context7 MCP instead of training data. Use for "look up the docs", "check the documentation", "how do I set up", "latest api for", "current syntax for", or whenever the user names a library and the answer must be current. |
| email-sequence | When the user wants to create or optimize an email sequence, drip campaign, automated email flow, or lifecycle email program. Also use when the user mentions "email sequence," "drip campaign," "nurture sequence," "onboarding emails," "welcome sequence," "re-engagement emails," "email automation," "lifecycle emails," "trigger-based emails," "email funnel," "email workflow," "what emails should I send," "welcome series," or "email cadence." Use this for any multi-email automated flow. For cold outreach emails, see cold-email. For in-app onboarding, see onboarding-cro. |
| feature-code-review | AI code review using CodeRabbit CLI + surgical fixer agent. Reviews uncommitted feature code for bugs, security issues, and logic errors. Fixer resolves critical findings without breaking anything. Produces code-review.md. Use for "code review", "review feature", "coderabbit review", "feature code review". |
| feature-quality | Quality gates for a feature. Runs code gates (tsc, lint, build), API tests, architecture compliance, visual smoke test, and performance audit. Produces quality-report.md. Use for "quality check", "run quality gates", "feature quality", "check feature". |
| find-skills | Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill. |
| fix-test | Fix a failing browser test. Reads a structured test report, identifies the root cause, makes a minimal fix following project patterns, and verifies the fix. Use for "fix test", "fix failing test", "fix test failure", "fix-test". |
| frontend-design | Create distinctive, production-grade frontend interfaces with high design quality, avoiding generic AI aesthetics. Use for "build a landing page", "design this page", "make this look good", "build a dashboard", "style this component", "it looks generic", "make it more polished". |
| git-workflow | Run safe day-to-day git workflows: inspect status, review diffs, create atomic commits, prepare clean pull requests, and avoid destructive history mistakes. Use for "commit this", "help with git", "prepare a PR", "what changed", "clean up my branch", or when working in a repo with active changes. |
| humanizer | Remove signs of AI-generated writing from text. Use when editing or reviewing text to make it sound more natural and human-written. Based on Wikipedia's comprehensive "Signs of AI writing" guide. Detects and fixes patterns including: inflated symbolism, promotional language, superficial -ing analyses, vague attributions, em dash overuse, rule of three, AI vocabulary words, negative parallelisms, and excessive conjunctive phrases. |
| inngest | Inngest durable functions for TypeScript — setup, events, steps, durable functions, flow control, and middleware. Use for "inngest", "durable function", "background job", "event-driven workflow", "step.run", "step.sleep", "step.waitForEvent", "inngest cron", "concurrency limits", "throttling", "retry backoff", "inngest setup". All depth lives under references/. |
| landing-page-copywriter | Write high-converting landing page copy with PAS (Problem-Agitate-Solution), AIDA and StoryBrand — headlines, value propositions, CTAs, full page sections. Use for "landing page copy", "sales page", "write a headline", "value proposition", "hero copy", "cta copy", "marketing website text". |
| marketing-psychology | Apply psychological principles, mental models and behavioral science to marketing — 70+ mental models organized for marketing use. Use for "psychology", "mental models", "cognitive bias", "persuasion", "behavioral science", "why people buy", "consumer behavior". |
| next-best-practices | Next.js 16 App Router best practices — file conventions, RSC vs client boundaries, async request APIs (cookies, headers, params), data fetching and caching, metadata, error handling, route handlers, image and font optimization, bundling. Use for "next.js", "app router", "server component", "client component", "route handler", "use cache", "cacheTag", "generateStaticParams", "async params", "proxy.ts", or when asked how Next.js 16 does something. |
| nextjs-seo | SEO for a Next.js 16 App Router app — the Metadata API, generateMetadata, sitemap.ts, robots.ts, JSON-LD structured data, canonical URLs and indexing fixes. Use for "next.js seo", "metadata api", "sitemap.ts", "json-ld", "robots.txt", "page not indexed", "open graph image". For an audit framework see seo-audit; for AI answer engines see ai-seo. |
| orpc-fullstack | The house oRPC API layer — procedure tiers, secure Zod input, typed errors, the OpenAPI route handler, server actions and cache tags, the typed client. Use for "orpc", "add an endpoint", "new procedure", "api route", "protectedProcedure", "zod schema", "actionable", "server action", "cache tag", "cursor pagination", "rate limit an endpoint", "call this from the client". Depth lives under references/. |
| payment-processing | Choose and implement the right payment provider and billing model. Use for "payments", "billing", "checkout", "subscriptions", "lemon squeezy", "polar", "stripe", "one-time purchase", or "customer portal". |
| payments-reference | Unified payment integration reference covering Stripe, Polar, and Lemon Squeezy — decision criteria, provider-specific patterns, and the non-obvious gotchas of each. Use for "which payment provider", "implement checkout", "subscription billing", "payment webhook", "license keys", "customer portal", "polar", "lemon squeezy". This is a depth reference; the /payments slash command and the payment-processing router skill remain the entry points. |
| payments-verification | Verify payment flows safely: checkout, customer portal, webhook handling, post-purchase state, upgrades, and ownership checks. Use for "verify payments", "checkout flow", "webhook test", "billing smoke test", or after any payment implementation. |
| posthog-analytics | PostHog analytics — event tracking, feature flags, funnels, dashboards, session replay. Use for "posthog", "track an event", "feature flag", "product analytics", "analytics dashboard", "funnel report". |
| project-setup | Environment setup after project discovery. Collects API keys, guides external service configuration, writes .env, verifies connections, creates test users. Transitions project status from Pending to Ready. Use for "setup project", "configure env", "setup environment", "project setup", "get ready to build". |
| project-tool-docs | Creates production-ready documentation for external tools/libraries. Spawns up to 3 tool-scout agents in parallel using Context7 + Jina MCP. Produces multi-file docs per tool: get-started.md + one doc per feature. Use for "document tools", "create tool docs", "tool documentation", "document external tools", "research tool". |
| react-email | Build HTML email templates with React Email components. Use for "email template", "transactional email", "welcome email", "password reset email", "order confirmation email", "newsletter template", "react email". |
| repo-scan | Cross-stack source code asset audit — classifies every file, detects embedded third-party libraries, and delivers four-level verdicts per module with interactive HTML reports. Use for "audit this repo", "how much code is actually ours", "find vendored code", "dead code report", "third-party inventory". |
| search | Search the web through the Tavily LLM-optimized search API — results with content snippets, scores and metadata, no code to write. Use for "search the web", "look this up online", "find articles about", "latest news on", "web search". |
| sentry-cli | Drive Sentry from the command line — issues, events, projects, organizations, API calls, auth. Use for "sentry cli", "list sentry issues", "sentry event details", "sentry login", "query sentry from the terminal". |
| seo-audit | When the user wants to audit, review, or diagnose SEO issues on their site. Also use when the user mentions "SEO audit," "technical SEO," "why am I not ranking," "SEO issues," "on-page SEO," "meta tags review," "SEO health check," "my traffic dropped," "lost rankings," "not showing up in Google," "site isn't ranking," "Google update hit me," "page speed," "core web vitals," "crawl errors," or "indexing issues." Use this even if the user just says something vague like "my SEO is bad" or "help with SEO" — start with an audit. For building pages at scale to target keywords, see programmatic-seo. For adding structured data, see schema-markup. For AI search optimization, see ai-seo. |
| session-management | Inspect Claude session history and transcript files when the user wants to resume work, recover context, find an old conversation, search prior decisions, inspect transcript paths, or grep Claude's saved .jsonl history. Use for "resume session", "find my old chat", "search transcript", "where are Claude sessions stored", "recover previous context", "session history", or "look in the jsonl files". |
| shadcn-ui | shadcn/ui component patterns — installation, configuration, accessible React components, forms with React Hook Form and Zod, Tailwind v4 theming. Use for "shadcn", "shadcn/ui", "add a component", "build a form", "dialog", "data table", "theme the components". Never install with --overwrite. |
| stripe-best-practices | Best practices for building Stripe integrations — payment processing, checkout, subscriptions, webhooks, Connect. Use for "stripe integration", "stripe checkout", "stripe webhook", "subscription billing", "stripe connect", "idempotency key". |
| stripe-cli | Stripe CLI for products, prices, webhooks and payment testing. Use for "stripe cli", "stripe listen", "forward webhooks", "create a stripe product", "test card", "trigger a stripe event". |
| supabase-extract-jwt | Extract and decode Supabase JWTs from client-side code, cookies and local storage. Use for "decode this jwt", "supabase token", "what claims are in this token", "inspect the access token", "jwt claims". |
| supabase-postgres-best-practices | Postgres performance and schema best practices from Supabase. Use for "slow query", "add an index", "explain analyze", "schema design", "postgres performance", "optimize this query", "rls performance". |
| svg-logo-designer | Create professional SVG logos from a description or design spec — multiple variations across layouts, styles and concepts, exportable to PNG. Use for "design a logo", "make a logo", "brand mark", "wordmark", "app icon", "logo variations". |
| tailwind-design-system | Build scalable design systems on Tailwind CSS v4 — semantic tokens, component libraries, responsive patterns. Use for "design system", "design tokens", "component library", "standardize the UI", "theme tokens", "tailwind v4 theme". |
| tailwindcss-animations | Tailwind CSS animations and transitions — built-in utilities and custom keyframe patterns. Use for "animate this", "add a transition", "hover animation", "keyframes", "fade in", "tailwind animation". |
| testing | Write and run tests: API tests (Playwright request against running server), E2E (Playwright with real browser). No mocks. No vitest procedure tests. Use for "write tests", "test this", "e2e test", "playwright", "add coverage", "fix flaky test", "run tests". |
| trace-to-skill | Evolve agent skills via trajectory analysis. Use for "trace to skill", "stress test", "evolve agents", "improve pipeline", "skill evolution", "analyze traces", "evolve phase". |
| typescript-pro | Advanced TypeScript — type systems, generics, and end-to-end type safety across the stack. Use for "type error", "generic type", "conditional type", "type guard", "utility types", "discriminated union", "end-to-end type safety", "tsconfig". |
| ui-ux-pro-max | Design-system lookup for this stack — palettes, font pairings, spacing, chart types, UX guidelines, searched from local CSV tables by a Python CLI. Use for "color palette", "font pairing", "design system", "typography scale", "chart design", "spacing rules", "dark mode palette", "landing page structure". Judgment lives in .claude/philosophy/visual.md; this is the lookup table. |
| upgrade-stripe | Upgrade Stripe API versions and SDKs, including the breaking changes between them. Use for "upgrade stripe", "stripe api version", "stripe sdk upgrade", "stripe breaking changes", "bump the stripe version". |
| vercel-react-best-practices | React and Next.js performance guidelines from Vercel Engineering — component patterns, data fetching, bundle size. Use for "react performance", "slow render", "re-render", "bundle size", "memo or not", "waterfall", "optimize this component". |
| web-crawling | Extract web content as clean markdown. Use for "crawl", "scrape", "extract this page", "get the content of", "read a website", "competitor research", "fetch docs as markdown", "site map", "recursive crawl", "scrape a site", "markdown from URL", "read article", "save web page", or any task that requires turning a URL into usable text. |
| webapp-testing | Drive and test a local web app with Playwright — verify frontend behavior, capture screenshots, read browser logs. Use for "test the local app", "screenshot the app", "browser logs", "check the page renders", "verify the UI locally". |

## Agents

| Role | Declared purpose | Claude declared skills | Claude declared philosophy |
|---|---|---|---|
| api-tester | Backend API testing specialist. Tests oRPC procedures and Inngest side effects via Playwright request context. Brief-driven. No mocks, no stubs, real database. |  - testing - orpc-fullstack - inngest - supabase-postgres-best-practices | [evidence] |
| architect | Strategic Architecture & Debugging Advisor (Opus, READ-ONLY) |  - codebase-navigation - debugger-detective | [evidence, scope] |
| backend-evaluator | Reviews backend code against the brief as contract. Grades contract fidelity, pattern compliance, security, robustness. Fixes violations. Skeptical by default. |  - orpc-fullstack - supabase-postgres-best-practices - inngest - typescript-pro | [async-state, trust-boundaries, entitlement, data-flow, scope, evidence, visual] |
| backend | Creates oRPC procedures and Inngest functions. Expert in server-side API design (oRPC + Zod) and background jobs (Inngest + direct Supabase). |  - orpc-fullstack - inngest - supabase-postgres-best-practices - typescript-pro | [trust-boundaries, entitlement, data-flow, scope, evidence] |
| build-fixer | Fixes npm run build errors. Surgical fixes only — no refactoring, no logic changes. |  - typescript-pro | [scope] |
| complete | Final wrap-up — writes the feature reference doc, updates schema doc, archives workspace. Runs after quality-gate passes. |  | [evidence] |
| connector | Wires backend to frontend - types, hooks, RSC data fetching, caching strategy, server/client boundaries. Expert in Next.js data patterns and oRPC client integration. |  - next-best-practices - vercel-react-best-practices - orpc-fullstack | [data-flow, async-state, scope, evidence] |
| critic | Work plan and code review expert — thorough, structured, multi-perspective (Opus) |  - codebase-navigation - documentation-lookup | [evidence, scope] |
| db-architect | Creates Supabase migrations, RLS policies, indexes, and triggers. Expert in PostgreSQL schema design and row-level security. |  - supabase-postgres-best-practices - supabase-extract-jwt | [trust-boundaries, entitlement, data-flow, scope, evidence] |
| design-evaluator | Reviews frontend code + navigates the app. Grades architecture, pattern compliance, visual quality, accessibility against the brief as contract. Fixes violations. Absorbs perf-tester. |  - webapp-testing - browser-debugging - shadcn-ui - frontend-design | [async-state, trust-boundaries, entitlement, data-flow, scope, evidence, visual] |
| designer | Creates beautiful, polished visual components with Tailwind v4 semantic tokens and shadcn/ui. Design-first — reads the full spec for creative context, not just task checkboxes. |  - ui-ux-pro-max | [async-state, visual, entitlement, scope, evidence] |
| discovery-critic | Adversarial reviewer of discovery docs. Attacks completeness, consistency, and feasibility. One-shot, read-only. |  | [evidence] |
| flow-tester | Frontend flow testing specialist. Tests user journeys via next-browser CLI. Brief-driven. Real clicks, real snapshots, surface bug fixes. |  - agent-browser - browser-debugging - testing | [evidence] |
| logo-designer | SVG logo designer with tight visual feedback loop. Writes SVG, reads it back, critiques, iterates 3+ times until professional quality. |  - svg-logo-designer |  |
| market-researcher | Deep market research agent. Analyzes competitors, pricing, features, market size, and gaps. Uses Jina to search the web and read competitor sites. |  - marketing-psychology |  |
| perf-tester | Performance testing and pattern enforcement agent. Measures CWV, audits PPR shells, and FIXES cache strategy, data fetching patterns, skeletons, and client boundaries using frontend patterns as source of truth. |  - next-best-practices - vercel-react-best-practices - browser-debugging | [evidence] |
| planner | The one planner. Spawned by the orchestrator for M/L work only — a new feature, or a big change to an existing one, as decided by the two mechanical checks in playbook §4. Reads the spec and the codebase, then writes the in-scope briefs (backend / frontend / ux) plus plan.md in one pass. S work never comes here; the orchestrator codes it directly. |  - orpc-fullstack - supabase-postgres-best-practices - inngest - next-best-practices - frontend-design | [async-state, trust-boundaries, entitlement, data-flow, scope, evidence, visual] |
| quality-gate | Full quality audit — code checks, architecture compliance, banned patterns, performance budgets. Produces quality-report.md. |  - feature-quality - testing - next-best-practices | [evidence, scope] |
| security-auditor | Deep security analysis with live database access. Understands business logic, RLS policies, auth flows, and API attack surfaces. Zero tolerance for false positives. |  - supabase-postgres-best-practices - supabase-extract-jwt - browser-debugging | [trust-boundaries, evidence] |
| sentry-analyst | Analyzes Sentry errors, triages by severity/frequency/impact, produces deep error reports with actionable fix recommendations. |  - sentry-cli | [evidence] |
| skill-scout | Searches the open agent skills ecosystem for skills matching the project's external tools. Reads SKILL.md via Jina (no install needed for grading), auto-installs high-scoring ones (>= 0.7). |  - find-skills - create-skill |  |
| slop-cleaner | Regression-safe AI slop cleanup — removes duplication, dead code, needless abstraction, boundary violations. Writes regression tests BEFORE cleaning. |  - testing - typescript-pro | [scope, evidence] |
| social-signal | Deep social media and community research. Finds real user conversations on Reddit, ProductHunt, IndieHackers, Hacker News, and Twitter/X about the idea's category. |  - search |  |
| spec-critic | Adversarial reviewer of feature specs. Attacks buildability, testability, coverage, and scale coherence. One-shot, read-only. |  | [evidence] |
| tool-scout | Finds and evaluates external APIs/services an idea needs. Uses Context7 for library docs and Jina for API discovery, pricing, and comparisons. |  - search - documentation-lookup |  |
| trend-validator | Validates market demand and assesses risk for an idea. Searches for trend data, traction signals, growth indicators, and competitive landscape density. |  - search |  |
| ts-expert | Fixes TypeScript errors without breaking runtime behavior. Surgical type fixes only. |  - typescript-pro | [scope] |
| ux-critic | Adversarial UX strategist. Deep-dives critical flows (signup→onboard→value), monetization UX (gating, upgrade CTAs, post-purchase), cross-feature transitions, and micro-interactions. One-shot, read-only. |  - frontend-design - ui-ux-pro-max | [evidence] |

## Additional Codex skills

- codex-heal
- codex-monitor
- codex-security-review
- ralph-tui-create-beads
- ralph-tui-create-beads-rust
- ralph-tui-create-json
- ralph-tui-prd

## Six application workflows

| Workflow | Present Markdown files | Boundary |
|---|---|---|
| auth | 10 | Adapt/build recipe; requires project choices and, for most, an application skeleton. |
| billing | 13 | Adapt/build recipe; requires project choices and, for most, an application skeleton. |
| design-system | 9 | Adapt/build recipe; requires project choices and, for most, an application skeleton. |
| landing-page | 6 | Adapt/build recipe; requires project choices and, for most, an application skeleton. |
| legal | 1 | Adapt/build recipe; requires project choices and, for most, an application skeleton. |
| onboarding | 5 | Adapt/build recipe; requires project choices and, for most, an application skeleton. |

## CLI source found separately

/Users/sridurga/.npm/_npx/76ffa31cfa7c7196/node_modules/buildthisnow

31 files. This cache is not a durable preservation location and is not part of the installed project payload.

| Path | Bytes |
|---|---|
| AGENTS.md | 4105 |
| LICENSE.md | 1068 |
| README.md | 18741 |
| bin/buildthisnow.js | 3614 |
| lib/constants.js | 6394 |
| lib/diff.js | 2647 |
| lib/doctor.js | 4306 |
| lib/init.js | 15888 |
| lib/license-cmd.js | 1257 |
| lib/license.js | 9841 |
| lib/login-cmd.js | 2435 |
| lib/manifest.js | 2223 |
| lib/payload.js | 7267 |
| lib/plugin.js | 8379 |
| lib/settings.js | 3702 |
| lib/templates/claude/_shared.md | 1558 |
| lib/templates/claude/desktop.md | 1029 |
| lib/templates/claude/mobile.md | 987 |
| lib/templates/claude/web.md | 907 |
| lib/update.js | 22628 |
| lib/utils.js | 6452 |
| package.json | 918 |
| scripts/agent.sh | 5384 |
| scripts/build-manifest.js | 4351 |
| scripts/eval-cross-harness.sh | 3636 |
| scripts/gen-agents.sh | 28090 |
| scripts/lint-patterns.sh | 22756 |
| scripts/release-payload.sh | 10166 |
| scripts/security-scan-staged.sh | 10737 |
| scripts/send-report-email.sh | 2911 |
| scripts/verify.sh | 11945 |
