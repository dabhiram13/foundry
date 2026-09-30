# Google Gemini

Multimodal (text + image + video + audio), structured output, function calling, generous free tier.

## Install
```bash
npm install @google/genai
```

## Auth
- Env: `GEMINI_API_KEY`
- Get it: https://aistudio.google.com/apikey*

GO TO https://ai.google.dev/gemini-api/docs/models

## Key APIs
- **Chat**: `ai.models.generateContent()` — gemini-2.5-flash (fast+cheap), gemini-2.5-pro (best)
- **Structured output**: `responseMimeType: "application/json"` + `responseSchema` — native JSON
- **Vision**: Pass images/video/audio inline or as file URIs
- **Function calling**: Define functions, Gemini calls them (similar to OpenAI tools)
- **Streaming**: `ai.models.generateContentStream()`
- **File upload**: `ai.files.upload()` — for large media (video, long audio)


## Gotchas
- Free tier has lower rate limits (15 RPM for Pro, 30 RPM for Flash)
- Video analysis: upload file first, then reference in prompt
- Structured output works natively (no tool hack needed like Claude)
- Context window: 1M tokens (Flash), 1M tokens (Pro)
