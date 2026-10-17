import { crc32, inflateSync } from 'node:zlib';
import { z } from 'zod';
import { atomicWrite, digest, FoundryError } from './fs.js';
import { readBoundedBytes, readBoundedText } from './factory-contract.js';

const text = z.string().trim().min(1).max(2000);
const id = z.string().regex(/^[A-Z][A-Z0-9_-]{1,63}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const file = z.string().min(1).max(1024).refine(value => !value.startsWith('/')
  && !/[\\\x00-\x1f<>:"|?*]/.test(value)
  && !value.split('/').some(part => !part || ['.', '..', '.git'].includes(part)), 'Use a portable project-relative file');
const states = z.array(z.string().trim().min(1).max(80)).min(1).max(12)
  .refine(value => new Set(value).size === value.length, 'State names must be unique');
const imageSchema = z.object({
  screen: id, state: z.string().trim().min(1).max(80),
  width: z.number().int().min(240).max(3840), height: z.number().int().min(240).max(2160),
  path: file, sha256: hash,
}).strict();
export const previewSchema = z.object({
  url: z.string().url().max(2048).refine(value => {
    try {
      const url = new URL(value);
      return !url.username && !url.password && (url.protocol === 'https:' || url.protocol === 'http:'
        && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
    } catch { return false; }
  }, 'Use HTTPS or a loopback HTTP preview without credentials'),
  instructions: text, design_system: text,
  components: z.array(z.object({ name: z.string().trim().min(1).max(100), source: file, screen: id, states }).strict()).min(1).max(32),
  screens: z.array(z.object({ id, route: z.string().trim().min(1).max(500),
    criteria: z.array(id).min(1).max(200), states }).strict()).min(1).max(12),
  screenshots: z.array(imageSchema).min(2).max(24),
}).strict().superRefine((preview, context) => {
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (!unique(preview.screens.map(screen => screen.id)) || !unique(preview.components.map(component => component.name))
    || !unique(preview.screenshots.map(viewKey)) || !unique(preview.screenshots.map(image => image.path))) {
    context.addIssue({ code: 'custom', message: 'Use unique screens, components, screenshot views and screenshot paths' });
  }
  for (const screen of preview.screens) {
    const images = preview.screenshots.filter(image => image.screen === screen.id);
    if (!unique(screen.criteria) || !images.some(image => image.width <= 480)
      || !images.some(image => image.width >= 1024) || screen.states.some(state => !images.some(image => image.state === state))) {
      context.addIssue({ code: 'custom', message: `Screen ${screen.id} needs unique criteria, mobile/desktop images and every declared state` });
    }
  }
  if (preview.components.some(component => !preview.screens.some(screen => screen.id === component.screen
    && component.states.every(state => screen.states.includes(state))))) {
    context.addIssue({ code: 'custom', message: 'Component states must map to a declared screen and its captured states' });
  }
  if (preview.screenshots.some(image => !preview.screens.some(screen => screen.id === image.screen && screen.states.includes(image.state)))) {
    context.addIssue({ code: 'custom', message: 'Screenshots must name a declared screen and state' });
  }
});
export type Preview = z.infer<typeof previewSchema>;
export const previewSourceSchema = z.object({ path: file, snapshot: file, sha256: hash }).strict();
export type PreviewSource = z.infer<typeof previewSourceSchema>;
export const visualReviewSchema = z.object({
  design_sha256: hash, summary: text,
  comparisons: z.array(imageSchema.extend({
    assessment: z.enum(['met', 'gap', 'unverified']), observation: text,
  }).strict()).min(2).max(24),
}).strict();
export type VisualReview = z.infer<typeof visualReviewSchema>;

export function viewKey(image: Pick<Preview['screenshots'][number], 'screen' | 'state' | 'width' | 'height'>): string {
  return JSON.stringify([image.screen, image.state, image.width, image.height]);
}

function localInput(relative: string): void {
  if (relative.split('/').some(part => part.startsWith('.'))) {
    throw new FoundryError('Preview inputs must be ordinary project files, not hidden files or saved state');
  }
}

function png(bytes: Buffer, image: Preview['screenshots'][number]): void {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 45 || !bytes.subarray(0, 8).equals(signature)
    || bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR'
    || bytes.readUInt32BE(16) !== image.width || bytes.readUInt32BE(20) !== image.height) {
    throw new FoundryError(`Screenshot must be a PNG matching its viewport at scale 1: ${image.path}`);
  }
  const color = bytes[25];
  if (bytes[24] !== 8 || ![2, 6].includes(color!) || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] !== 0) {
    throw new FoundryError('Use a non-interlaced 8-bit RGB or RGBA PNG screenshot');
  }
  let offset = 8;
  const data: Buffer[] = [];
  let dataEnded = false;
  while (offset + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(offset);
    const end = offset + 8 + size;
    if (end + 4 > bytes.length || crc32(bytes.subarray(offset + 4, end)) !== bytes.readUInt32BE(end)) break;
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (!/^[A-Za-z]{4}$/.test(type) || type === 'IHDR' && offset !== 8
      || /^[A-Z]/.test(type) && !['IHDR', 'PLTE', 'IDAT', 'IEND'].includes(type)) break;
    if (type === 'IDAT') {
      if (dataEnded) break;
      if (size > 0) data.push(bytes.subarray(offset + 8, end));
    } else if (data.length) dataEnded = true;
    if (type === 'IEND' && size === 0 && data.length && end + 4 === bytes.length) {
      const stride = image.width * (color === 2 ? 3 : 4) + 1;
      try {
        const decoded = inflateSync(Buffer.concat(data), { maxOutputLength: stride * image.height });
        if (decoded.length === stride * image.height
          && Array.from({ length: image.height }, (_, row) => decoded[row * stride]!).every(filter => filter <= 4)) return;
      } catch { /* Invalid or oversized pixel data is not rendered evidence. */ }
      break;
    }
    offset = end + 4;
  }
  throw new FoundryError(`Screenshot has invalid PNG chunks: ${image.path}`);
}

async function imageBytes(root: string, image: Preview['screenshots'][number]): Promise<Buffer> {
  const bytes = await readBoundedBytes(root, image.path, 8 * 1024 * 1024);
  if (digest(bytes) !== image.sha256) throw new FoundryError(`Screenshot changed: ${image.path}`);
  png(bytes, image);
  return bytes;
}

async function freezeImages<T extends Preview['screenshots'][number]>(root: string, directory: string, images: T[]): Promise<T[]> {
  const saved: T[] = [];
  let total = 0;
  for (const [index, image] of images.entries()) {
    localInput(image.path);
    const bytes = await imageBytes(root, image);
    total += bytes.length;
    if (total > 32 * 1024 * 1024) throw new FoundryError('Screenshot collection exceeds 32 MiB');
    const path = `${directory}/images/${index}.png`;
    await atomicWrite(root, path, bytes);
    saved.push({ ...image, path });
  }
  return saved;
}

async function inspectImages(root: string, directory: string, images: Preview['screenshots']): Promise<void> {
  let total = 0;
  for (const [index, image] of images.entries()) {
    if (image.path !== `${directory}/images/${index}.png`) throw new FoundryError('Screenshot belongs to another record');
    total += (await imageBytes(root, image)).length;
    if (total > 32 * 1024 * 1024) throw new FoundryError('Screenshot collection exceeds 32 MiB');
  }
}

export async function capturePreview(root: string, directory: string, preview: Preview) {
  const sources: PreviewSource[] = [];
  for (const [index, source] of [...new Set(preview.components.map(component => component.source))].entries()) {
    localInput(source);
    const document = await readBoundedText(root, source, 256 * 1024);
    const snapshot = `${directory}/sources/${index}.txt`;
    await atomicWrite(root, snapshot, document.bytes);
    sources.push({ path: source, sha256: digest(document.bytes), snapshot });
  }
  return { preview: { ...preview, screenshots: await freezeImages(root, directory, preview.screenshots) }, sources };
}

export async function inspectPreview(root: string, directory: string, preview: Preview, sources: PreviewSource[]): Promise<void> {
  const expected = [...new Set(preview.components.map(component => component.source))];
  if (expected.length !== sources.length) throw new FoundryError('Preview component snapshots are missing');
  for (const [index, source] of sources.entries()) {
    if (source.path !== expected[index] || source.snapshot !== `${directory}/sources/${index}.txt`) {
      throw new FoundryError('Preview source belongs to another record');
    }
    const document = await readBoundedText(root, source.snapshot, 256 * 1024);
    if (digest(document.bytes) !== source.sha256) throw new FoundryError('Preview component snapshot changed');
  }
  await inspectImages(root, directory, preview.screenshots);
}

export function validateVisualReview(visual: VisualReview | undefined, preview: Preview | undefined, designSha256: string | undefined): void {
  if (!preview) {
    if (visual) throw new FoundryError('Visual review needs an approved interface Design');
    return;
  }
  if (!visual || visual.design_sha256 !== designSha256) throw new FoundryError('Compare the running interface with the exact approved Design');
  const expected = new Set(preview.screenshots.map(viewKey));
  const actual = visual.comparisons.map(viewKey);
  if (actual.length !== expected.size || new Set(actual).size !== actual.length || actual.some(key => !expected.has(key))) {
    throw new FoundryError('Compare every approved screen, state and viewport exactly once');
  }
  if (new Set(visual.comparisons.map(image => image.path)).size !== actual.length) {
    throw new FoundryError('Use a separate current screenshot file for each comparison');
  }
}

export async function captureVisualReview(root: string, directory: string, visual: VisualReview): Promise<VisualReview> {
  return { ...visual, comparisons: await freezeImages(root, directory, visual.comparisons) };
}

export async function inspectVisualReview(root: string, directory: string, visual: VisualReview): Promise<void> {
  await inspectImages(root, directory, visual.comparisons);
}
