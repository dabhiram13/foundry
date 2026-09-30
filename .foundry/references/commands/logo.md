<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: logo
description: Generate six brand logo variations in parallel, each by its own logo-designer agent with a visual feedback loop.
---

# /logo — Generate 6 Brand Logo Variations

Spawn 6 parallel `logo-designer` agents, each focused on ONE logo with a tight visual feedback loop. Same brand colors, 6 completely different visual approaches. Each agent iterates 3+ times until their logo is professional quality.

## Prerequisites

1. `webapp/app/(marketing)/page.tsx` must exist (run /landing-design first if not)
2. Read `webapp/app/globals.css` — extract the `--primary` oklch value
3. Read `docs/project/product-overview.md` — product name, what it does
4. Read `docs/project/brand-guidelines.md` (if exists) — brand voice

If the landing page doesn't exist, stop: "Run /landing-design first to establish the visual direction."

## Phase 1: Color Extraction (CRITICAL)

Navigate to any app page in Chrome DevTools, then run this script to get exact hex values:

```js
(() => {
  const canvas = document.createElement('canvas');
  canvas.width = 1; canvas.height = 1;
  const ctx = canvas.getContext('2d');
  function toHex(colorStr) {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = colorStr;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  const cs = getComputedStyle(document.documentElement);
  const primary = cs.getPropertyValue('--primary').trim();
  const fg = cs.getPropertyValue('--foreground').trim();
  const [L, C, H] = primary.split(' ').map(Number);
  return {
    foreground: toHex(`oklch(${fg})`),
    primary: toHex(`oklch(${primary})`),
    primary_light: toHex(`oklch(${L + 0.12} ${C * 0.75} ${H})`),
    primary_dark: toHex(`oklch(${L - 0.15} ${C} ${H})`),
  };
})()
```

This gives you 4 hex values. Pass these to EVERY agent. Never hardcode assumed colors.

## Phase 2: Launch 6 Parallel Agents

Spawn 6 `logo-designer` agents simultaneously using the Agent tool with:
- `subagent_type: "logo-designer"`
- `mode: "bypassPermissions"`
- `run_in_background: true`

Each agent gets a unique style brief. The 6 styles MUST cover all visual axes:

### The 6 Style Matrix

| # | Container | Background | Mark Style | Technique | Reference Vibe |
|---|-----------|------------|------------|-----------|----------------|
| 1 | Rounded square | Primary color | White symbol | Solid fill | Stripe, Notion |
| 2 | None | Transparent | 3 color shades | Isometric/3D faces | Figma, Slack |
| 3 | Circle | Foreground-dark | Gradient symbol | Filled gradient | Supabase, Vercel |
| 4 | None | Transparent | Primary color | Negative space cuts | FedEx, NBC |
| 5 | None | Transparent | Light + dark shades | Overlapping shapes | Mastercard, Google Photos |
| 6 | Rounded square | Foreground-dark | Primary strokes | Wireframe/blueprint | Linear, Opus.pro |

### Agent Brief Template

Each agent prompt must include:
1. Product name and what it does (1 sentence)
2. The 4 hex colors (foreground, primary, primary_light, primary_dark)
3. Their specific style assignment from the matrix above
4. 3-5 concept directions (what the symbol could represent — tied to the product)
5. Anti-patterns: NO plain letters, NO arrows, NO generic shapes
6. Output file paths (React TSX + /tmp SVG)
7. The component pattern (viewBox, size prop, etc.)
8. Instruction to iterate 3+ times with visual feedback

### Critical Brief Rules

**Every brief must say:**
> Design a BRAND LOGO, not a feature icon. This should look like it belongs next to Nike, Stripe, Airbnb — not in a sidebar feature list. Think ABSTRACT: shapes that FEEL like the brand without literally depicting what the product does. Maximum 2-3 paths. If it looks like an illustration of the product's function, you failed.

**Every brief must give ABSTRACT concept directions — never literal objects.** Example for a build tool:
- Two asymmetric bars at different heights = growth, momentum, acceleration
- Interlocking angular forms woven through each other = synergy, connection
- A split geometric shape with a precise gap = breakthrough, transformation
- Offset forms creating an implied curve in negative space = flow, exchange
- Two overlapping simple shapes meeting = collaboration, the training loop

**Every brief must forbid:**
- Plain letterforms (just a "B" or "S" rendered as paths)
- Arrows, chevrons, triangles as main mark
- feDropShadow, white highlight overlays
- Generic geometric primitives without concept
- **LITERAL OBJECTS** — no microphones, tools, speech bubbles, devices, equipment, or any recognizable real-world object. These make feature icons, not brand marks.

### Output File Convention (PREDICTABLE — never deviate)

```
webapp/components/logos/logo-{N}.tsx   # React component (logo-1.tsx, logo-2.tsx, ... logo-6.tsx)
/tmp/logo-{N}.svg                      # Raw SVG for visual feedback loop
```

Component names follow the same pattern: `Logo1`, `Logo2`, ... `Logo6`.
This makes relaunching easy — "redo logo 3" always targets `logo-3.tsx`.

## Phase 3: Preview Assembly

After all 6 agents complete:

1. Update `webapp/components/logos/logo-preview.tsx` — import all 6 new components
2. Ensure preview route exists at `webapp/app/(marketing)/logos/page.tsx`
3. Ensure `/logos` is in public paths in `webapp/lib/supabase/proxy.ts`
4. Navigate to `/logos` in Chrome DevTools and take a full-page screenshot
5. Read the screenshot and present results to user

### Preview Component Pattern

```tsx
"use client";
import Logo1 from "./logo-1";
import Logo2 from "./logo-2";
import Logo3 from "./logo-3";
import Logo4 from "./logo-4";
import Logo5 from "./logo-5";
import Logo6 from "./logo-6";

const logos = [
  { name: "1. Display Name", desc: "Brief description.", Component: Logo1 },
  { name: "2. Display Name", desc: "Brief description.", Component: Logo2 },
  { name: "3. Display Name", desc: "Brief description.", Component: Logo3 },
  { name: "4. Display Name", desc: "Brief description.", Component: Logo4 },
  { name: "5. Display Name", desc: "Brief description.", Component: Logo5 },
  { name: "6. Display Name", desc: "Brief description.", Component: Logo6 },
];

export default function LogoPreview() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-3xl font-bold text-foreground mb-2">{Product} — Logo Variations</h1>
      <p className="text-muted-foreground mb-12">All colors from globals.css. 6 different approaches.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {logos.map(({ name, desc, Component }) => (
          <div key={name} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{name}</h2>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-6 flex items-center justify-center gap-6">
              <Component size={20} /><Component size={32} /><Component size={48} /><Component size={72} />
            </div>
            <div className="rounded-xl border border-border bg-[#0a0a0a] p-6 flex items-center justify-center gap-6">
              <Component size={20} /><Component size={32} /><Component size={48} /><Component size={72} />
            </div>
            <div className="rounded-xl border border-border bg-white p-5 flex items-center gap-3">
              <Component size={32} />
              <span className="text-base font-bold text-[#0F1419] tracking-tight">{Product Name}</span>
            </div>
            <div className="rounded-xl border border-border bg-[#0a0a0a] p-5 flex items-center gap-3">
              <Component size={32} />
              <span className="text-base font-bold text-white tracking-tight">{Product Name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Phase 4: User Picks, You Iterate

Present results as:

```
## 6 Logo Concepts Ready

| # | Name | Approach | Concept |
|---|------|----------|---------|
| 1 | {name} | {container + mark style} | {one sentence} |
| ... |

Preview: http://localhost:3000/logos
Pick your favorite(s) and I'll refine or install.
```

If the user wants changes to specific logos:
- Relaunch those specific `logo-designer` agents with updated briefs
- Include the user's feedback verbatim in the new brief
- Re-screenshot and present

## Phase 5: Install Chosen Logo

When the user picks a final logo, execute ALL steps. The goal is to replace EVERY logo instance in the entire codebase — not just the obvious ones.

### Step 1: Canonical components

Create `webapp/components/logo.tsx`:

```tsx
import ChosenLogo from "@/components/logos/{chosen-file}";

export function LogoIcon({ size = 32, className }: { size?: number; className?: string }) {
  return <span className={className}><ChosenLogo size={size} /></span>;
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <ChosenLogo size={32} />
      <span className="text-base font-bold tracking-tight">{productName}</span>
    </span>
  );
}
```

### Step 2: Favicon + Icon files
- Export SVG markup to `webapp/app/icon.svg`. Fixed `width="32" height="32"`.
- If `webapp/app/icon.tsx` exists (Next.js dynamic icon), update it to render the chosen logo's SVG paths via `ImageResponse`, OR delete it in favor of `icon.svg` (static is simpler).
- Delete `favicon.ico` if exists.

### Step 3: OG Image
Create `webapp/app/opengraph-image.tsx` using Next.js `ImageResponse` — inline SVG paths, branded background.
Also create `webapp/app/twitter-image.tsx` (1200x600).

### Step 4: Apple Touch Icon
Create `webapp/app/apple-icon.tsx` — 180x180 via `ImageResponse`.

### Step 5: Web App Manifest
Create `webapp/app/manifest.ts` with product name, theme color, icon reference.

### Step 5.5: Update Legacy Central Logo Files

Before scanning, update the EXISTING central logo files that other components already import:

1. **`webapp/assets/logo/logo-icon.tsx`** — Replace the SVG contents with the chosen logo's SVG. Keep the same export signature (`export default function LogoIcon({ size = 32 }: { size?: number })`). This ensures all existing imports (auth pages, etc.) get the new logo automatically.

2. **`webapp/assets/logo/logo.tsx`** — Replace the SVG contents with the chosen logo's SVG. Update the product name text. Keep the same export signature.

This is CRITICAL — many files import from `@/assets/logo/logo-icon` and `@/assets/logo/logo`. Updating these files in-place means those imports work without any changes.

### Step 6: Deep-Scan — Find and Replace ALL Logo Instances (CRITICAL)

Do NOT rely on the list below — it may be incomplete. Instead, run a comprehensive scan:

```bash
# Find every file that might contain a logo reference
cd webapp

# 1. Search for inline SVG logos (hardcoded SVGs that should use the component)
grep -rn '<svg' --include='*.tsx' --include='*.jsx' -l | grep -v node_modules | grep -v .next | grep -v components/logos/ | head -50

# 2. Search for any component named *logo* or *Logo* or importing logo
grep -rn 'logo\|Logo\|LOGO\|LogoIcon\|logo-icon' --include='*.tsx' --include='*.jsx' -l | grep -v node_modules | grep -v .next | head -50

# 3. Search for icon imports that might be logo stand-ins
grep -rn 'icon\.svg\|icon\.tsx\|favicon' --include='*.tsx' --include='*.ts' -l | grep -v node_modules | head -50

# 4. Search for brand name text rendered alongside icons (wordmark patterns)
grep -rn 'Build This\|ViralPulse\|brand-name\|site-name\|app-name' --include='*.tsx' -l | grep -v node_modules | head -50
```

For EACH file found, read it and determine if it contains a logo. **Pay special attention to:**

**MUST-CHECK files (these almost always have logos):**
- **App sidebar** — `features/_shared/components/app-sidebar.tsx` — OFTEN has hardcoded inline SVG instead of the component. Replace with `<LogoIcon size={32} />`
- **Auth pages** — `features/auth/**/login-form.tsx`, `sign-up-form.tsx`, `cached-*-ui.tsx`, `forgot-password` — these import from `@/assets/logo/logo-icon` (already fixed by Step 5.5)
- **Landing page header/navbar** — usually has logo + product name
- **Landing page footer** — usually has logo
- **Onboarding screens** — `features/onboarding/**`

**Also check:**
- **Email templates** — `webapp/emails/**/*.tsx` or `supabase/functions/**/templates.ts`
- **Loading/splash screens** — `webapp/app/loading.tsx`
- **Error pages** — `webapp/app/not-found.tsx`, `webapp/app/error.tsx`
- **Mobile nav / sheet menus** — any slide-over or mobile menu component
- **Print/PDF views** — any export or print-related components

**Replace rules:**
- **Hardcoded inline `<svg>` logos** → Replace with `import { LogoIcon } from "@/components/logo"` → `<LogoIcon size={N} />`
- **Full logo (icon + product name)** → `import { Logo } from "@/components/logo"` → `<Logo />`
- **Icon only (favicon-style, sidebar compact)** → `import { LogoIcon } from "@/components/logo"` → `<LogoIcon size={24} />`
- **Old imports from `@/assets/logo/`** → These work fine after Step 5.5, but if creating new code, prefer `@/components/logo`

### Step 7: Update layout metadata
Update `webapp/app/layout.tsx` title and description to match the product name.

### Step 8: Write reference doc
Create `docs/built/logo.md` with:
- Chosen design details (which logo # won, visual description)
- Usage guide (`<Logo />` vs `<LogoIcon />`)
- File map (every file that was updated)
- Color values extracted from the logo

### Step 9: Quality check
```bash
cd webapp && npx tsc --noEmit && npm run build
```

Verify no broken imports — the deep scan may have revealed files that imported old logo components or had inline SVGs that are now replaced.

## What NOT to Do

- Do NOT design logos yourself — always use `logo-designer` agents
- Do NOT install npm packages — pure SVG + Next.js ImageResponse
- Do NOT use `--overwrite` for shadcn
- Do NOT put text inside SVG icon files
- Do NOT hardcode hex colors — always extract from globals.css via browser
- Do NOT skip the agent visual feedback loop
- Do NOT accept plain letterforms as logos — send the agent back with feedback
- Do NOT accept literal object depictions (microphones, tools, devices) — these are feature icons, not brand marks. Send the agent back.
- Do NOT give concept directions using real-world objects — always use ABSTRACT shape strategies (bars, splits, interlocks, overlaps, steps)
