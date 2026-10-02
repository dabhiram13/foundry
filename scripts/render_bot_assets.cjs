#!/usr/bin/env node
/**
 * Export Foundry's static specialist portraits using bot-avatars' public renderer.
 * Source: bot-avatars 0.2.2, MIT © 2026 Jakub Antalik.
 * No image generation service, external requests, or hand-drawn replacement art.
 *
 * node scripts/render_bot_assets.cjs [--evidence /absolute/output/directory]
 * FOUNDRY_AVATAR_CHROME may point to an installed Chromium-family browser.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}
const root = path.resolve(argument('--root', path.join(__dirname, '..')));
const evidence = path.resolve(argument('--evidence', path.join(root, 'output/playwright/bot-assets')));
const requireLocal = createRequire(path.join(root, 'package.json'));
const esbuild = requireLocal('esbuild');
const { chromium } = requireLocal('playwright');
const assetDir = path.join(root, 'app/assets/bots');

const renderer = `
import { roleCatalog } from ${JSON.stringify(path.join(root, 'app/src/components/specialists.tsx'))};
import { drawBotAvatarFrame, restPose, botAvatarShapes, botAvatarPresets, botAvatarParts, autoInk, BOT_AVATAR_OVERSCAN } from 'bot-avatars';
window.roles = roleCatalog;
window.renderOne = (index) => {
  const role = roleCatalog[index];
  const a = role.avatar;
  const box = 160, dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = box * BOT_AVATAR_OVERSCAN * dpr;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  const preset = botAvatarPresets[a.type];
  const pose = {...restPose('default'), yaw: 0.065, pitch: 0.015, roll: 0, lookX: 0, lookY: 0};
  drawBotAvatarFrame(context, box, pose, {
    ...preset,
    path: new Path2D(botAvatarShapes[a.type]),
    parts: botAvatarParts[a.type]?.split(/(?=M)/).filter(p => p.trim()).map(p => new Path2D(p)),
    color: a.color,
    ink: autoInk(a.color),
    shading: 'fabric',
    typeKey: a.type,
    still: true,
    furOnIdle: false,
    dpr,
    theme: 'light',
    shadow: 0.92,
    highlight: 1.36,
    light: 295,
    lightFront: 42,
    depth: 0.72,
    roundness: 1,
    rim: 0.55,
    spread: 1.6,
    fur: {length: 0.9, density: 1.8, fuzz: 0.8, clumps: 0.35, curl: 0.6, gravity: 0.85},
    wear: {hat: a.hat || 'none', glasses: a.glasses || 'none', headphones: !!a.headphones, bowTie: !!a.bowTie, color: '#353535', fabric: true},
  });
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let x0 = canvas.width, y0 = canvas.height, x1 = 0, y1 = 0, opaque = 0;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    if (pixels[(y * canvas.width + x) * 4 + 3] > 8) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y);
      x1 = Math.max(x1, x); y1 = Math.max(y1, y); opaque++;
    }
  }
  if (!opaque || x0 <= 1 || y0 <= 1 || x1 >= canvas.width - 2 || y1 >= canvas.height - 2) {
    throw new Error('Blank or clipped rendered portrait: ' + role.id);
  }
  // Trim only transparent overscan, then fit the untouched library pixels.
  const padding = 12;
  x0 = Math.max(0, x0 - padding); y0 = Math.max(0, y0 - padding);
  x1 = Math.min(canvas.width, x1 + padding); y1 = Math.min(canvas.height, y1 + padding);
  const out = document.createElement('canvas'); out.width = out.height = 160;
  const draw = out.getContext('2d'); draw.imageSmoothingQuality = 'high';
  const scale = Math.min(152 / (x1 - x0), 152 / (y1 - y0));
  const width = (x1 - x0) * scale, height = (y1 - y0) * scale;
  draw.drawImage(canvas, x0, y0, x1 - x0, y1 - y0, (160 - width) / 2, (160 - height) / 2, width, height);
  return {id: role.id, data: out.toDataURL('image/png'), sourceBounds: [x0,y0,x1,y1], opaquePixels: opaque};
};
window.showSheet = (portraits) => {
  const main = document.querySelector('main');
  for (const role of roleCatalog) {
    const item = portraits.find(p => p.id === role.id);
    const figure = document.createElement('figure');
    const img = new Image(); img.src = item.data; img.alt = ''; img.width = img.height = 112;
    const label = document.createElement('figcaption'); label.textContent = role.label;
    const signature = document.createElement('p');
    const a = role.avatar;
    signature.textContent = [a.type, a.hat, a.glasses && a.glasses + ' glasses', a.headphones && 'headphones', a.bowTie && 'bow tie'].filter(Boolean).join(' · ');
    const row = document.createElement('div'); row.className='sizes';
    for (const size of [28, 36, 64]) { const small = new Image(); small.src=item.data; small.alt=''; small.width=small.height=size; row.append(small); }
    figure.append(img,label,signature,row); main.append(figure);
  }
};
`;

async function run() {
  const pkg = JSON.parse(fs.readFileSync(requireLocal.resolve('bot-avatars/package.json'), 'utf8'));
  if (pkg.version !== '0.2.2') throw new Error('Review artwork before changing renderer version: ' + pkg.version);
  const compiled = await esbuild.build({
    stdin: { contents: renderer, resolveDir: root, sourcefile: 'avatar-export.tsx', loader: 'tsx' },
    bundle: true, write: false, format: 'iife', platform: 'browser', minify: false,
  });
  const javascript = compiled.outputFiles[0].text;
  const font = fs.readFileSync(path.join(root, 'node_modules/@fontsource/figtree/files/figtree-latin-400-normal.woff2'));
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Foundry specialist portraits</title><style>
    @font-face{font-family:Figtree;src:url('/figtree.woff2')}*{box-sizing:border-box}body{margin:0;padding:36px;background:#f1f1f1;color:#202020;font-family:Figtree,Arial,sans-serif}h1{font-size:28px;margin:0 0 8px;font-weight:500}header p{font-size:15px;margin:0;color:#484848;line-height:1.5}main{display:grid;grid-template-columns:repeat(7,1fr);gap:12px;margin-top:24px}figure{margin:0;background:white;padding:16px 8px 10px;display:flex;align-items:center;flex-direction:column;min-height:258px;border:1px solid #dedede;border-radius:10px}figcaption{font-size:15px;margin-top:8px}figure p{font-size:11px;color:#484848;text-align:center;margin:5px 0 0;min-height:28px;max-width:165px;line-height:1.3}.sizes{display:flex;align-items:center;justify-content:center;gap:8px;height:64px;margin-top:8px}footer{font-size:12px;margin-top:20px;color:#484848}
    </style></head><body><header><h1>Foundry · 28 specialist identities</h1><p>18 plush silhouettes; 28 distinct shape and accessory combinations. Idle portraits use no canvas or animation at runtime.<br>Detail at 112px; production-size examples at 28, 36 and 64px. Labels remain the primary identity.</p></header><main></main><footer>Source: bot-avatars 0.2.2 · MIT © 2026 Jakub Antalik. Foundry role mappings, palette and fixed portrait framing are adaptations.</footer><script src="/renderer.js"></script></body></html>`;
  const server = http.createServer((request, response) => {
    const responses = {'/': ['text/html', html], '/renderer.js': ['text/javascript', javascript], '/figtree.woff2': ['font/woff2', font]};
    const found = responses[request.url];
    if (!found) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, {'Content-Type': found[0]}); response.end(found[1]);
  });
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
  let browser;
  try {
    const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const executablePath = process.env.FOUNDRY_AVATAR_CHROME || (fs.existsSync(macChrome) ? macChrome : undefined);
    browser = await chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
    const page = await browser.newPage({viewport: {width: 1512, height: 1320}, deviceScaleFactor: 1});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}`, {waitUntil:'load'});
    const roles = await page.evaluate(() => window.roles);
    const actualIds = fs.readdirSync(path.join(root, '.codex/agents')).filter(file => file.endsWith('.toml')).map(file => file.slice(0, -5)).sort();
    if (roles.length !== 28 || JSON.stringify(roles.map(role => role.id).sort()) !== JSON.stringify(actualIds)) throw new Error('Role catalog no longer matches the 28 configured agents.');
    const signature = role => JSON.stringify([role.avatar.type, role.avatar.hat || 'none', role.avatar.glasses || 'none', !!role.avatar.headphones, !!role.avatar.bowTie]);
    if (new Set(roles.map(signature)).size !== 28) throw new Error('Duplicate silhouette/accessory combination.');
    fs.mkdirSync(assetDir, {recursive:true}); fs.mkdirSync(evidence, {recursive:true});
    const portraits = [], manifest = [];
    for (let index = 0; index < roles.length; index++) {
      const portrait = await page.evaluate(index => window.renderOne(index), index);
      const bytes = Buffer.from(portrait.data.split(',')[1], 'base64');
      fs.writeFileSync(path.join(assetDir, portrait.id + '.png'), bytes);
      portraits.push(portrait);
      manifest.push({id:portrait.id, file:roles[index].image, bytes:bytes.length, sha256:crypto.createHash('sha256').update(bytes).digest('hex'), signature:signature(roles[index]), sourceBounds:portrait.sourceBounds});
      console.log('Rendered ' + portrait.id + ' (' + bytes.length + ' bytes)');
    }
    fs.copyFileSync(path.join(path.dirname(requireLocal.resolve('bot-avatars/package.json')), 'LICENSE'), path.join(assetDir, 'LICENSE.txt'));
    await page.evaluate(portraits => window.showSheet(portraits), portraits);
    await page.evaluate(async () => {await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode()));});
    await page.screenshot({path:path.join(evidence, 'specialist-contact-sheet.png'), fullPage:true});
    const summary = {source:{name:pkg.name,version:pkg.version,author:pkg.author,license:pkg.license,repository:pkg.repository}, width:160,height:160,roles:roles.length,shapes:new Set(roles.map(role => role.avatar.type)).size,distinctNonColorCombinations:new Set(roles.map(signature)).size,totalBytes:manifest.reduce((sum,item)=>sum+item.bytes,0),browserErrors:errors,portraits:manifest};
    fs.writeFileSync(path.join(evidence, 'specialist-assets.json'), JSON.stringify(summary,null,2)+'\n');
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(JSON.stringify({roles:summary.roles,shapes:summary.shapes,distinctNonColorCombinations:summary.distinctNonColorCombinations,totalBytes:summary.totalBytes,evidence},null,2));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => {console.error(error);process.exitCode=1;});
