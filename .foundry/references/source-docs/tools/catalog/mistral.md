# Mistral

Fast inference, OCR (Pixtral), code generation, embeddings. European AI, good for GDPR.

## Install
```bash
npm install @mistralai/mistralai
```

## Auth
- Env: `MISTRAL_API_KEY`
- Get it: https://console.mistral.ai/api-keys

## Key APIs
- **Chat**: `client.chat.complete()` — mistral-large, mistral-small, codestral
- **OCR (Pixtral)**: `client.chat.complete()` with image + "extract text" — best OCR via AI
- **Structured output**: `response_format: { type: "json_object" }` — native JSON mode
- **Embeddings**: `client.embeddings.create()` — mistral-embed
- **Code**: Codestral model — specialized for code generation

## Pricing
- Mistral Small: $0.10/1M input, $0.30/1M output (very cheap)
- Mistral Large: $2/1M input, $6/1M output
- Pixtral Large: $2/1M input, $6/1M output (vision + OCR)

## When to use over OpenAI
- OCR: Pixtral is best-in-class for document extraction
- Cost: Mistral Small is 1.5x cheaper than GPT-4o-mini
- GDPR: EU-based, data stays in Europe
- Code: Codestral is competitive with GPT-4o for code tasks

## Gotchas
- Smaller model ecosystem than OpenAI
- No image generation
- No audio/transcription
- Rate limits: varies by plan
