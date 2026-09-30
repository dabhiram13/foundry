# OpenAI

Chat completions, embeddings, vision, image generation, transcription (Whisper).

## Install
```bash
npm install openai
```

## Auth
- Env: `OPENAI_API_KEY`
- Get it: https://platform.openai.com/api-keys

## HOW TO SEARCH ON OPENAI:

Go to: https://developers.openai.com/api/docs/models
You'll have the newest models, the prices.

## Key APIs
- **Chat**: `openai.chat.completions.create()` — GPT-4o, GPT-4o-mini
- **Structured output**: `response_format: { type: "json_schema", json_schema: {...} }` — guaranteed JSON
- **Vision**: Pass image URLs or base64 in message content array
- **Embeddings**: `openai.embeddings.create()` — text-embedding-3-small (cheap) or 3-large (better)
- **Images**: `openai.images.generate()` — DALL-E 3
- **Transcription**: `openai.audio.transcriptions.create()` — Whisper, accepts audio files
- **TTS**: `openai.audio.speech.create()` — text to speech


## Gotchas
- Structured output requires `strict: true` in json_schema
- Vision: max 20MB per image, supports PNG/JPEG/GIF/WebP
- Rate limits vary by tier — new accounts start low
- Whisper accepts max 25MB audio files
