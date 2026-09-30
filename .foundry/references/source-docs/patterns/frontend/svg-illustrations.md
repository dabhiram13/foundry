# SVG Illustration Patterns (All Agents)

Build inline SVG illustrations instead of relying on Lucide icons. 20-50 lines of JSX, theme-aware via `currentColor` and `var(--primary)`. These look 10x better than icons in circles and work in both light and dark mode.

## Core Principles

1. **Use `currentColor`** for strokes/fills that should match the parent text color
2. **Use `var(--primary)`** for accent elements (highlighted lines, key shapes, data points)
3. **Use opacity layers** (0.05 → 0.15 → 0.4 → 1.0) to create depth without extra colors
4. **Keep viewBox consistent** — `viewBox="0 0 200 160"` for illustrations, `viewBox="0 0 32 32"` for logos
5. **Every SVG is a React component** — extract as `function MySVG({ className }: { className?: string })`
6. **Fill the available space** — use `w-full h-full` on the SVG, never constrain with `max-h-*`
7. **Wrap in a flex container** — `<div className="flex items-center justify-center p-4 h-full">`
8. **Use `.map()` for repeated elements** — nodes, bars, steps
9. **Real labels** — use domain-appropriate words ("DB", "API", "Plan", "Test"), not placeholders

## Opacity Layering System

| Layer | Opacity | Purpose |
|-------|---------|---------|
| Ghost | 0.03-0.06 | Background fills, area shading |
| Subtle | 0.1-0.15 | Borders, grid lines, secondary shapes |
| Medium | 0.25-0.4 | Active elements, labels |
| Strong | 0.5-0.8 | Primary accents, key data points |

---

## Pattern 1: Chat/Prompt Interface

Shows a conversation window with user message and AI response.

```tsx
function ChatSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Window frame */}
      <rect x="20" y="10" width="160" height="120" rx="12" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <rect x="20" y="10" width="160" height="24" rx="12" fill="currentColor" opacity="0.06" />
      {/* Window dots */}
      <circle cx="34" cy="22" r="4" fill="currentColor" opacity="0.2" />
      <circle cx="46" cy="22" r="4" fill="currentColor" opacity="0.2" />
      <circle cx="58" cy="22" r="4" fill="currentColor" opacity="0.2" />
      {/* User message bubble */}
      <rect x="70" y="46" width="100" height="22" rx="8" fill="currentColor" opacity="0.08" />
      <rect x="78" y="53" width="60" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
      <rect x="78" y="59" width="40" height="3" rx="1.5" fill="currentColor" opacity="0.15" />
      {/* AI response bubble */}
      <rect x="30" y="78" width="110" height="22" rx="8" fill="currentColor" opacity="0.12" />
      <rect x="38" y="85" width="70" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
      <rect x="38" y="91" width="50" height="3" rx="1.5" fill="currentColor" opacity="0.15" />
      {/* Input bar with cursor */}
      <rect x="30" y="112" width="140" height="12" rx="6" stroke="currentColor" strokeWidth="1" opacity="0.15" />
      <rect x="36" y="116" width="50" height="3" rx="1.5" fill="currentColor" opacity="0.12" />
      <rect x="88" y="114" width="2" height="8" rx="1" fill="var(--primary)" opacity="0.7" />
    </svg>
  );
}
```

---

## Pattern 2: Agent Network / Hub-and-Spoke

Central node connected to specialist nodes via dashed lines.

```tsx
function AgentNetworkSVG({ className }: { className?: string }) {
  const nodes = [
    { x: 40, y: 35, label: "DB" },
    { x: 160, y: 35, label: "API" },
    { x: 30, y: 110, label: "UI" },
    { x: 170, y: 110, label: "QA" },
    { x: 100, y: 20, label: "Plan" },
    { x: 100, y: 145, label: "Sec" },
  ];

  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Connection lines + outer nodes */}
      {nodes.map((node, i) => (
        <g key={i}>
          <line x1="100" y1="80" x2={node.x} y2={node.y}
            stroke="currentColor" strokeWidth="1" opacity="0.12" strokeDasharray="4 3" />
          <circle cx={node.x} cy={node.y} r="14"
            stroke="currentColor" strokeWidth="1.5" opacity="0.25" fill="currentColor" fillOpacity="0.04" />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="8"
            fill="currentColor" fontWeight="500" opacity="0.5">{node.label}</text>
        </g>
      ))}
      {/* Center hub */}
      <circle cx="100" cy="80" r="18" stroke="var(--primary)" strokeWidth="2"
        fill="var(--primary)" fillOpacity="0.1" />
      <text x="100" y="84" textAnchor="middle" fontSize="10"
        fill="currentColor" fontWeight="600" opacity="0.7">AI</text>
      {/* Pulse rings */}
      <circle cx="100" cy="80" r="24" stroke="var(--primary)" strokeWidth="0.5" opacity="0.2" />
      <circle cx="100" cy="80" r="32" stroke="var(--primary)" strokeWidth="0.5" opacity="0.1" />
    </svg>
  );
}
```

---

## Pattern 3: Growth Chart with Data Points

Area chart showing upward trend — great for "results" or "launch" sections.

```tsx
function GrowthChartSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Grid lines */}
      <line x1="30" y1="130" x2="180" y2="130" stroke="currentColor" strokeWidth="1" opacity="0.1" />
      <line x1="30" y1="100" x2="180" y2="100" stroke="currentColor" strokeWidth="0.5" opacity="0.05" strokeDasharray="4 4" />
      <line x1="30" y1="70" x2="180" y2="70" stroke="currentColor" strokeWidth="0.5" opacity="0.05" strokeDasharray="4 4" />
      <line x1="30" y1="40" x2="180" y2="40" stroke="currentColor" strokeWidth="0.5" opacity="0.05" strokeDasharray="4 4" />
      {/* Growth curve */}
      <path d="M30 120 Q60 115, 80 100 Q100 85, 120 60 Q140 35, 170 20"
        stroke="var(--primary)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Area fill */}
      <path d="M30 120 Q60 115, 80 100 Q100 85, 120 60 Q140 35, 170 20 L170 130 L30 130 Z"
        fill="var(--primary)" opacity="0.08" />
      {/* Data points */}
      <circle cx="80" cy="100" r="3" fill="var(--primary)" />
      <circle cx="120" cy="60" r="3" fill="var(--primary)" />
      <circle cx="170" cy="20" r="3.5" fill="var(--primary)" />
      {/* Rocket at tip */}
      <path d="M165 15 L170 8 L175 15" stroke="currentColor" strokeWidth="1.5" opacity="0.4"
        fill="currentColor" fillOpacity="0.08" />
      {/* X-axis labels */}
      <text x="50" y="150" fontSize="8" fill="currentColor" opacity="0.3" textAnchor="middle">Week 1</text>
      <text x="100" y="150" fontSize="8" fill="currentColor" opacity="0.3" textAnchor="middle">Week 2</text>
      <text x="155" y="150" fontSize="8" fill="currentColor" opacity="0.3" textAnchor="middle">Week 4</text>
    </svg>
  );
}
```

---

## Pattern 4: Abstract Dashboard

Mini data visualization — bars, sparkline, and a metric number.

```tsx
function DashboardSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={`w-full h-auto ${className}`}>
      {/* Frame */}
      <rect x="10" y="10" width="180" height="100" rx="8"
        fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      {/* Bar chart */}
      <rect x="20" y="50" width="30" height="50" rx="4" fill="currentColor" opacity="0.2" />
      <rect x="55" y="35" width="30" height="65" rx="4" fill="currentColor" opacity="0.4" />
      <rect x="90" y="20" width="30" height="80" rx="4" fill="var(--primary)" opacity="0.6" />
      <rect x="125" y="40" width="30" height="60" rx="4" fill="currentColor" opacity="0.3" />
      {/* Sparkline */}
      <path d="M20 45 Q60 25 100 35 T180 20"
        fill="none" stroke="var(--primary)" strokeWidth="2" opacity="0.5" />
      {/* Corner metric */}
      <circle cx="170" cy="30" r="12" fill="currentColor" opacity="0.15" />
    </svg>
  );
}
```

---

## Pattern 5: Shield / Security

Security-themed illustration for trust sections.

```tsx
function ShieldSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Shield shape */}
      <path d="M100 20L40 50V95C40 120 65 145 100 155C135 145 160 120 160 95V50L100 20Z"
        stroke="currentColor" strokeWidth="1.5" opacity="0.25" fill="currentColor" fillOpacity="0.04" />
      <path d="M100 35L55 58V92C55 112 75 132 100 140C125 132 145 112 145 92V58L100 35Z"
        fill="var(--primary)" opacity="0.08" />
      {/* Checkmark */}
      <path d="M78 85L92 100L122 65" stroke="var(--primary)" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round" />
      {/* Lock at top */}
      <rect x="90" y="42" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <path d="M95 42V36C95 32 97 28 100 28C103 28 105 32 105 36V42"
        stroke="currentColor" strokeWidth="1.5" opacity="0.3" fill="none" />
    </svg>
  );
}
```

---

## Pattern 6: Workflow Steps (Horizontal)

Connected numbered circles for "how it works" sections.

```tsx
function WorkflowSVG({ className }: { className?: string }) {
  const steps = [
    { x: 40, label: "1" },
    { x: 100, label: "2" },
    { x: 160, label: "3" },
  ];

  return (
    <svg viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Connecting line */}
      <line x1="55" y1="30" x2="85" y2="30" stroke="currentColor" strokeWidth="1.5" opacity="0.15" strokeDasharray="4 3" />
      <line x1="115" y1="30" x2="145" y2="30" stroke="currentColor" strokeWidth="1.5" opacity="0.15" strokeDasharray="4 3" />
      {/* Step circles */}
      {steps.map((step) => (
        <g key={step.label}>
          <circle cx={step.x} cy="30" r="16" stroke="var(--primary)" strokeWidth="1.5"
            fill="var(--primary)" fillOpacity="0.1" />
          <text x={step.x} y="35" textAnchor="middle" fontSize="12"
            fill="var(--primary)" fontWeight="700">{step.label}</text>
        </g>
      ))}
    </svg>
  );
}
```

---

## Usage Rules

1. **Always extract as a named component** — `function MySVG({ className })`, not inline JSX
2. **Use `w-full h-full` or `w-full h-auto`** in the className for responsive sizing
3. **Parent div controls size** — wrap in `<div className="w-full aspect-[5/4]"><MySVG /></div>`
4. **Hover interaction** — add `group-hover:scale-[1.02] transition-transform` on the parent
5. **Never use raw hex colors** in SVGs — only `currentColor` and `var(--primary)` (or `var(--destructive)`, `var(--success)`)
6. **Opacity layers create depth** without additional colors: 0.04 (barely visible) → 0.12 (subtle) → 0.4 (medium) → 1.0 (full)
7. **Text in SVGs** — use `<text>` with `textAnchor="middle"`, `fontSize="8-10"`, `fontWeight="500-600"`
8. **Realistic labels** — use real words ("DB", "API", "Plan"), not generic placeholders

## When to Use SVG Illustrations

| Situation | Use SVG | Don't Use SVG |
|-----------|---------|---------------|
| **BentoCard backgrounds** | **Always — replaces HTML mockup fragments** | **Never use HTML mockups in bento** |
| How-it-works steps | Each step gets a unique illustration | Simple numbered list |
| Feature card hero visual | Replace "Lucide icon in circle" | Icon is secondary/small |
| Empty states | Illustrate what the feature does | Loading spinners |
| Hero accent | Abstract shape behind headline | Background that AnimatedGridPattern handles better |
| Process/flow diagrams | Hub-and-spoke, timeline | Use AnimatedBeam for interactive flows |

## SVGs in BentoCards (Mandatory)

BentoCards MUST use SVG illustration components as their `background` slot. HTML mockup fragments (terminal divs, form divs, code blocks) are BANNED inside bento cards.

Each SVG is a standalone React component passed as `background={<MyIllustrationSVG />}`. See `features-v3.tsx` for 6 real examples: `AgentNetworkSVG`, `BuildPipelineSVG`, `StackLayersSVG`, `AuthFlowSVG`, `SecurityShieldSVG`, `DeployChartSVG`.

**Card styling inside dark sections:**
```tsx
<BentoCard
  className="bg-background/[0.06] border-background/[0.12] text-background
    [&_a]:text-primary [&_h3]:text-background [&_p]:text-background/60 [&_svg]:text-background"
  background={<MyIllustrationSVG />}
/>
```

**Rules:**
- Every card gets a unique SVG illustration component
- SVG wrapper: `<div className="flex items-center justify-center p-4 h-full">` — fills the card
- SVG element: `<svg viewBox="0 0 200 160" fill="none" className="w-full h-full">`
- No `max-h-*` constraints — let the SVG fill available space
- Cards inside dark sections: `bg-background/[0.06] border-background/[0.12]` — NOT white, NOT `bg-card`
- All text and CTAs always visible — no hover-to-reveal, no text shifting, no overlays

## SVGs in How-It-Works Sections

Each step gets a unique SVG in an aspect-ratio container. See `how-it-works-v3.tsx` for 3 real examples: `DescribeIdeaSVG`, `AgentBuildSVG`, `LaunchGrowSVG`.

```tsx
<div className="w-full aspect-[5/4] mb-6 text-foreground">
  <step.Illustration />
</div>
```

SVGs here use `className="w-full h-full"` directly (no wrapper div needed since the aspect container handles sizing).
