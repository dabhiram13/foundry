# shadcn/ui — setup, configuration and theming

> Reference for `shadcn-ui`. Vendored from the shadcn/ui docs and kept for lookup.
> Where it disagrees with this repo, [`../SKILL.md`](../SKILL.md) wins: Tailwind v4 CSS-first
> (no `tailwind.config.js`, no `hsl(var(--x))` colour mapping), reads through TanStack Query over
> oRPC and writes through `.actionable()` server actions rather than hand-written
> `app/api/*/route.ts` form endpoints, `@/components/ui/sonner` rather than
> `@/components/ui/toaster`, and never `npx shadcn@latest add --overwrite`.

## What is shadcn/ui?

shadcn/ui is **not** a traditional component library or npm package. Instead:

- It's a **collection of reusable components** that you can copy into your project
- Components are **yours to customize** - you own the code
- Built with **Radix UI** primitives for accessibility
- Styled with **Tailwind CSS** utilities
- Includes CLI tool for easy component installation

## Installation & Setup

### Initial Setup

```bash
# Initialize shadcn/ui in your project
npx shadcn@latest init
```

During setup, you'll configure:
- TypeScript or JavaScript
- Style (Default, New York, etc.)
- Base color theme
- CSS variables or Tailwind CSS classes
- Component installation path

### Installing Individual Components

```bash
# Install a single component
npx shadcn@latest add button

# Install multiple components
npx shadcn@latest add button input form

# Install all components — NOT in this repo: it rewrites the 63 files already in
# webapp/components/ui/, several of which are customised. Add components one at a time.
npx shadcn@latest add --all
```

Answer `N` to every overwrite prompt. `--overwrite` is denied outright in `.foundry/settings.json`.

### Manual Installation

If you prefer manual setup:

```bash
# Install dependencies for a specific component
npm install @radix-ui/react-slot

# Copy component code from ui.shadcn.com
# Place in webapp/components/ui/ (this repo has no src/ directory)
```

## Project Configuration

### Required Dependencies

```json
{
  "dependencies": {
    "@radix-ui/react-accordion": "^1.1.2",
    "@radix-ui/react-alert-dialog": "^1.0.5",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-separator": "^1.0.3",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-toast": "^1.1.5",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "lucide-react": "^0.294.0",
    "tailwind-merge": "^2.0.0",
    "tw-animate-css": "^1.4.0"
  }
}
```

### TSConfig Configuration

The only part shadcn/ui needs is the path alias. `webapp/tsconfig.json` as shipped:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "noEmit": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  }
}
```

`@/*` maps to the `webapp/` root, so `@/components/ui/button` is `webapp/components/ui/button.tsx`
and `@/lib/utils` is `webapp/lib/utils.ts` (which exports `cn`).

### Tailwind Configuration

Tailwind v4 has no JavaScript config in this repo. `webapp/components.json` sets
`"tailwind": { "config": "", "css": "app/globals.css", "cssVariables": true }` — configuration is
CSS-first, in `webapp/app/globals.css`:

```css
/* webapp/app/globals.css — PROTECTED, APPEND ONLY */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}
```

`@theme inline` is what turns a custom property into a utility: `--color-primary` gives you
`bg-primary`, `text-primary`, `border-primary`. There is no `content:` array (v4 scans the project),
no `darkMode: ["class"]` (that is the `@custom-variant` line), no `require("tailwindcss-animate")`
(that is the `tw-animate-css` import), and no `hsl(var(--x))` wrapper — the raw values are already
colours.

### CSS Variables (globals.css)

The tokens themselves live in `:root` and `.dark`, in oklch, and are mapped to utilities by
`@theme inline`. Shape as shipped in `webapp/app/globals.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:where(.dark, .dark *));

@layer base {
  :root {
    --background: oklch(1.0000 0 0);
    --foreground: oklch(0.1884 0.0128 248.5103);
    --primary: oklch(0.6723 0.1606 244.9955);
    --primary-foreground: oklch(1.0000 0 0);
    --muted: oklch(0.9222 0.0013 286.3737);
    --muted-foreground: oklch(0.1884 0.0128 248.5103);
    --destructive: oklch(0.6188 0.2376 25.7658);
    --border: oklch(0.9317 0.0118 231.6594);
    --ring: oklch(0.6818 0.1584 243.3540);
    --radius: 1.3rem;
  }

  .dark {
    /* same names, dark values */
  }
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-border: var(--border);
}
```

`webapp/app/globals.css` is marked **PROTECTED — APPEND ONLY** on line 1: add new custom properties,
never edit or remove the ones that are there. The file also carries `--success`, `--warning`, the
five `--chart-*` tokens, the `--sidebar-*` set and a shadow scale; read it before inventing a token.

## Customization

### Theming with CSS Variables

Re-theming means changing the values in `:root` / `.dark` in `webapp/app/globals.css` — the token
names and the `@theme inline` mapping stay put, so every component follows automatically. Values are
oklch, not the `0 0% 100%` HSL triplets the upstream docs show, and there is no `hsl(var(--x))`
wrapper anywhere. In components, use the semantic utility (`bg-background`, `text-muted-foreground`,
`border-border`, `ring-ring`) and never a raw palette class such as `bg-slate-900`.

### Customizing Components

Since you own the code, customize directly:

```tsx
// components/ui/button.tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent",
        // Add custom variant
        custom: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        // Add custom size
        xl: "h-14 rounded-md px-10 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

