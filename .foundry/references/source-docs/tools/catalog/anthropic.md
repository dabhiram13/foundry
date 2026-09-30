# Anthropic Claude

Chat, analysis, long context (200K tokens), tool use, structured output.

## Install
```bash
npm install @anthropic-ai/sdk
```

## Auth
- Env: `ANTHROPIC_API_KEY`
- Get it: https://console.anthropic.com/settings/keys

## SEARCH INSIDE :
https://platform.claude.com/docs/en/about-claude/models/overview


## Key APIs
- **Chat**: `anthropic.messages.create()` — Claude Sonnet 4, Claude Haiku
- **Tool use**: Define tools in request, Claude calls them, you return results
- **Structured output**: Use tool_choice + single tool with JSON schema (guarantees format)
- **Vision**: Pass images as base64 in content blocks
- **Streaming**: `anthropic.messages.stream()` — server-sent events
- **Batch**: `anthropic.messages.batches.create()` — 50% cheaper, async (24h)


## Gotchas
- No native JSON mode — use tool_choice with a single tool for structured output
- 200K context but pricing is per-token, long inputs get expensive
- Max output: 8192 tokens (default), set `max_tokens` explicitly
- Rate limits: 50 req/min on free tier
