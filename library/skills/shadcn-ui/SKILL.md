---
name: shadcn-ui
description: >
  shadcn/ui component patterns — installation, configuration, accessible React components,
  forms with React Hook Form and Zod, Tailwind v4 theming. Use for "shadcn", "shadcn/ui",
  "add a component", "build a form", "dialog", "data table", "theme the components".
  Never install with `--overwrite`.
allowed-tools: Read, Write, Bash, Edit, Glob
---

# shadcn/ui in this repo

A router: the house contract and a map. The catalogue, the long examples and the vendored upstream
docs are in `references/` — read the one you need.

## House rules — these win over anything in `references/`

1. **Never `--overwrite`.** `npx shadcn@latest add <name> --overwrite` is denied in
   `.foundry/settings.json`. Answer `N` to any overwrite prompt. The 63 files in
   `webapp/components/ui/` are owned and customised; a component that depends on an existing one
   gets only its own new files installed.
2. **Tailwind v4, CSS-first.** There is no `tailwind.config.js`; `webapp/components.json` sets
   `"tailwind": { "config": "", "css": "app/globals.css" }`. Tokens are oklch custom properties in
   `webapp/app/globals.css`, exposed as utilities by `@theme inline`. Use the semantic class
   (`bg-background`, `text-muted-foreground`, `border-border`, `ring-ring`) — never a raw palette
   class such as `bg-slate-900`, and never an `hsl(var(--x))` wrapper. `globals.css` is marked
   **PROTECTED — APPEND ONLY**: add tokens, do not edit existing ones.
3. **Server components by default.** `"use client"` goes on the lowest leaf that needs state, an
   event handler or a Radix primitive — not on the page.
4. **No `useEffect` data fetching.** Reads are TanStack Query over oRPC
   (`useQuery(orpc.<router>.<procedure>.queryOptions({ input }))`); writes are `.actionable()`
   server actions followed by `router.refresh()`. Never `queryClient.invalidateQueries()` for a
   mutation — the cache is busted server-side by `updateTag()`. See `library/skills/orpc-fullstack/`
   and `docs/orpc/client.md`.
5. **Forms are react-hook-form + `zodResolver` + Zod v4** (`zod` ^4.3.6, import from `"zod"`, never
   `"zod/v4"`). Field errors render through `<FormMessage />`, not a toast.
6. **Toasts come from `@/components/ui/sonner`** (`import { Toaster } from "@/components/ui/sonner"`,
   already mounted in `webapp/app/layout.tsx`). There is no `components/ui/toaster.tsx` here.
7. **Loading, empty and error states follow `.foundry/philosophy/async-state.md`**; layout, hierarchy
   and both-mode design follow `.foundry/philosophy/visual.md`. A skeleton belongs to first paint
   only; after that dim the content in place.

## Where things are

| Path | What |
|------|------|
| `webapp/components.json` | style `new-york`, `rsc: true`, aliases, and five extra registries |
| `webapp/components/ui/` | the 63 installed components — read one before inventing a pattern |
| `webapp/app/globals.css` | tokens (`:root`, `.dark`), `@theme inline` mapping, `@custom-variant dark` |
| `webapp/lib/utils.ts` | `cn()` — `clsx` + `tailwind-merge` |
| `webapp/app/layout.tsx` | `<Toaster richColors closeButton />` mount point |

## Installing

```bash
cd webapp
npx shadcn@latest add dialog          # answer N to any overwrite prompt
npx shadcn@latest add @magicui/marquee # extra registries are configured in components.json
```

Registries in `components.json`: `@magicui`, `@aceternity`, `@react-bits`, `@shadcn-space`, `@diceui`.

## The one pattern to copy — a validated form

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const formSchema = z.object({
  email: z.string().trim().max(254).email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

type FormValues = z.infer<typeof formSchema>

export function LoginForm({ action }: { action: (input: FormValues) => Promise<void> }) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(action)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input type="email" autoComplete="email" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </Form>
  )
}
```

`action` is the `.actionable()` server action. The button blocks a second submit while pending and
returns to its label so a failure can be retried (`.foundry/philosophy/async-state.md`).

## References

| File | Holds | Load when |
|------|-------|-----------|
| `references/setup.md` | init, install, `components.json`, tsconfig alias, Tailwind v4 config, tokens, theming | setting up, re-theming, changing a variant |
| `references/components.md` | Button, Input, Form, Card, Dialog, Sheet, Menubar, Select, Toast, Table — props + examples | using a component you have not used here before |
| `references/charts.md` | `ChartContainer`, `ChartConfig`, line / area / pie examples, tooltip props, a11y | building a chart |
| `references/nextjs.md` | App Router wiring, layout, client boundary, server actions, metadata, fonts, longer forms | wiring a component into a route |
| `references/chart.md` | upstream ui.shadcn.com chart docs, scraped | you need the exact upstream chart API |
| `references/ui-reference.md` | upstream component docs, scraped | you need the exact upstream component API |
| `references/official-ui-reference.md` | upstream installation and CLI docs, scraped | resolving a CLI or registry question |
| `references/reference.md` | shadcn.io extras — hooks, animation components | you are evaluating a third-party shadcn-style component |
| `references/learn.md` | a learning path through the above, plus the upstream links | onboarding someone |
