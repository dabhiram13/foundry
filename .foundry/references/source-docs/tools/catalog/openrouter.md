# OpenRouter

Unified API for 100+ AI models. One key, automatic fallback, cheapest routing. Good for multi-model apps.

## Install
Uses OpenAI SDK with custom base URL — no separate package needed.

## Auth
- Env: `OPENROUTER_API_KEY`
- Get it: https://openrouter.ai/keys

## How it works
```typescript
import OpenAI from 'openai';
const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY
});
const response = await client.chat.completions.create({
  model: 'anthropic/claude-sonnet-4',
  messages: [{ role: 'user', content: 'Hello' }]
});
```

## Key benefit
- Same OpenAI SDK, just change baseURL and model name
- Access Claude, Gemini, Llama, Mistral, etc. with one key
- Auto-routing: `openrouter/auto` picks the cheapest model for the task

## Pricing
- Pay per token (same as provider pricing + small markup)
- Free models available (Llama, some Mistral)
- No minimum, no subscription

## When to use
- App uses multiple AI models
- Want provider fallback (if OpenAI is down, route to Anthropic)
- Cost optimization across models

## Gotchas
- Slight latency overhead vs direct API calls
- Not all model features supported (e.g., some structured output modes)
- Model availability can change
