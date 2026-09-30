# Mux

Video infrastructure: upload, encode, stream, playback, analytics. The "Stripe of video."

## Install
```bash
npm install @mux/mux-node @mux/mux-player-react
```

## Auth
- Env: `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`
- Get it: https://dashboard.mux.com/settings/access-tokens

## Key APIs
- **Upload**: Direct upload from browser (signed URL) or server-side ingest
- **Assets**: `mux.video.assets.create()` — encode + store
- **Playback**: Mux Player React component with adaptive streaming
- **Thumbnails**: Auto-generated at any timestamp
- **Subtitles**: Auto-generated captions

## Usage pattern
```typescript
import Mux from '@mux/mux-node';
const mux = new Mux({ tokenId: process.env.MUX_TOKEN_ID, tokenSecret: process.env.MUX_TOKEN_SECRET });
const upload = await mux.video.uploads.create({ new_asset_settings: { playback_policy: ['public'] } });
// Give upload.url to the browser for direct upload
```

## Pricing
- Encoding: $0.015/min
- Streaming: $0.00012/min viewed
- Storage: $0.007/min/mo
- Free tier: enough for testing

## Gotchas
- Encoding is async — use webhooks (`video.asset.ready`) to know when done
- Direct upload requires signed URL workflow (don't stream through your server)
- Playback IDs are public — use signed URLs for private content
