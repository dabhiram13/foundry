# AssemblyAI

Transcription, speaker diarization, summarization, sentiment analysis. Best accuracy for speech-to-text.

## Install
```bash
npm install assemblyai
```

## Auth
- Env: `ASSEMBLYAI_API_KEY`
- Get it: https://www.assemblyai.com/dashboard/signup

## Key APIs
- **Transcribe**: Upload audio/video → get text with timestamps
- **Speaker diarization**: Identify who said what
- **Summarization**: AI summary of transcript
- **Sentiment**: Per-sentence sentiment analysis
- **Real-time**: WebSocket streaming transcription

## Usage pattern
```typescript
import { AssemblyAI } from 'assemblyai';
const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });
const transcript = await client.transcripts.transcribe({ audio_url: 'https://...' });
```


## Gotchas
- Async processing — transcription takes ~15-30% of audio duration
- Audio must be accessible via URL (upload to Supabase Storage first)
- Speaker diarization adds processing time
