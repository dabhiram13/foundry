import { crc32, deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import type { Preview, VisualReview } from '../../src/core/work-visual.js';

// Synthetic images exercise the protocol, not browser rendering or design quality.
export function pngFixture(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const name = Buffer.from(type);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
    return Buffer.concat([length, name, data, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc((width * 3 + 1) * height))), chunk('IEND', Buffer.alloc(0))]);
}
export const imageHash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
export const previewFixture: Preview = {
  url: 'http://127.0.0.1:5173/booking', instructions: 'Run the product dev script, then open /booking. Fixture only.',
  design_system: 'Use the product type scale, neutral surfaces and existing booking controls.',
  components: [{ name: 'BookingForm', source: 'source.ts', screen: 'BOOKING', states: ['default'] }],
  screens: [{ id: 'BOOKING', route: '/booking', criteria: ['CS-02'], states: ['default'] }],
  screenshots: [{ screen: 'BOOKING', state: 'default', width: 390, height: 844, path: 'mobile.png', sha256: imageHash(pngFixture(390, 844)) },
    { screen: 'BOOKING', state: 'default', width: 1280, height: 800, path: 'desktop.png', sha256: imageHash(pngFixture(1280, 800)) }],
};
export function visualFixture(designSha256: string): VisualReview {
  return { design_sha256: designSha256, summary: 'Synthetic local protocol comparison, not actual UI qualification.',
    comparisons: previewFixture.screenshots.map(image => ({ ...image, assessment: 'met', observation: 'Fixture bytes and view mapping checked.' })) };
}
