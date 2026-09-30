# React PDF

Generate PDFs from React components. Invoices, resumes, reports, certificates.

## Install
```bash
npm install @react-pdf/renderer
```

## Auth
None — runs locally, no API key.

## How it works
```typescript
import { Document, Page, Text, View, renderToBuffer } from '@react-pdf/renderer';

const MyPDF = () => (
  <Document>
    <Page size="A4">
      <View><Text>Hello World</Text></View>
    </Page>
  </Document>
);

// Server-side: generate buffer, return as response
const buffer = await renderToBuffer(<MyPDF />);
```

## Key features
- React components → PDF (familiar DX)
- Flexbox layout (like React Native)
- Custom fonts, images, SVGs
- Server-side rendering (no browser needed)

## Pricing
Free, open source.

## Gotchas
- NOT the same as regular React components — uses its own primitives (View, Text, not div, span)
- No CSS — uses StyleSheet API (similar to React Native)
- Heavy package (~2MB) — only import server-side
- Complex layouts can be tricky (no CSS Grid)
- Use `renderToBuffer` on server, `PDFDownloadLink` on client
