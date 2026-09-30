# Form Pattern — Skeleton

React Hook Form + Zod + useMutation. Schema shared with oRPC procedure. Server handles cache invalidation.

## Standard Form Component
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { client } from '@/lib/orpc/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

// formSchema: z.object({...}) — mirror oRPC procedure input
// type FormValues = z.infer<typeof formSchema>

export function {Feature}Form({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter()
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: {...} })
  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormValues) => client.protected.{feature}.create(data),
    onSuccess: () => { form.reset(); router.refresh(); onSuccess?.() },
    onError: (err: Error) => { form.setError('root', { message: err.message ?? 'Something went wrong' }) },
  })
  // form.handleSubmit → mutate
  // Root error display: rounded-md border border-destructive/50 bg-destructive/10
  // FormField per input → Button type="submit" disabled={isPending}
}
```

## Rules
1. React Hook Form + `zodResolver` for ALL forms — never manual `useState` for form data
2. Share Zod schema between form and oRPC procedure input when possible
3. `useMutation` for mutations — provides `isPending`, error handling. Never manual `useState` for loading.
4. On success: `form.reset()` + `router.refresh()` + `onSuccess` callback
5. On error: `form.setError('root', ...)` — displays inline
6. **No `invalidateQueries`** — server-side `updateTag()` in oRPC procedure + `router.refresh()` handles cache
7. Use shadcn Form components: `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`
8. Server-side validation always runs via Zod in oRPC — client validation is convenience only
