# Multi-Step Form Pattern

## When to Use
- Form has 3+ logical sections that overwhelm when shown together
- Steps have dependencies (step 2 options depend on step 1 answers)
- Partial progress should survive navigation (URL-based step via nuqs)

## Single Form vs Form-Per-Step

| Approach | Pros | Cons | Use When |
|----------|------|------|----------|
| Single `useForm` | One source of truth, `trigger()` validates subsets, trivial final submit | All fields must stay registered (use `shouldUnregister: false` default) | Most wizards -- **recommended** |
| Form-per-step | Clean mount/unmount per step | Need parent state to collect data, final submit reassembles | Each step saves to server independently (e.g., onboarding flow) |

## Step Schema Setup

```ts
import { z } from 'zod'

const stepAccountSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})
const stepProfileSchema = z.object({
  fullName: z.string().min(1, 'Required'),
  role: z.enum(['developer', 'designer', 'founder', 'other']),
})
const stepPrefsSchema = z.object({ notifications: z.boolean() })

// Full schema = merge all steps (NOT z.union)
export const wizardSchema = stepAccountSchema.merge(stepProfileSchema).merge(stepPrefsSchema)
export type WizardValues = z.infer<typeof wizardSchema>

// Field names per step -- drives trigger() validation
export const STEP_FIELDS = {
  0: ['email', 'password'],
  1: ['fullName', 'role'],
  2: ['notifications'],
} as const satisfies Record<number, (keyof WizardValues)[]>

export const STEP_LABELS = ['Account', 'Profile', 'Preferences'] as const
```

## Step URL State (nuqs)

```tsx
import { useQueryState, parseAsInteger } from 'nuqs'
// NuqsAdapter already wraps root layout -- no setup needed
const [step, setStep] = useQueryState(
  'step',
  parseAsInteger.withDefault(0).withOptions({ shallow: true }) // shallow = no server round-trip
)
```

Named steps alternative (better for deep-linking):
```tsx
import { parseAsStringLiteral } from 'nuqs'
const STEPS = ['account', 'profile', 'preferences'] as const
const [step, setStep] = useQueryState(
  'step', parseAsStringLiteral(STEPS).withDefault('account').withOptions({ shallow: true })
)
const stepIndex = STEPS.indexOf(step)
```

## Wizard Component

```tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryState, parseAsInteger } from 'nuqs'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { client } from '@/lib/orpc/client'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { cn } from '@/lib/utils'
import { wizardSchema, STEP_FIELDS, STEP_LABELS, type WizardValues } from './schemas'
import { StepAccount } from './step-account'
import { StepProfile } from './step-profile'
import { StepPreferences } from './step-preferences'

const STEP_COMPONENTS = [StepAccount, StepProfile, StepPreferences]

export function SetupWizard({ defaults }: { defaults?: Partial<WizardValues> }) {
  const router = useRouter()
  const [step, setStep] = useQueryState('step', parseAsInteger.withDefault(0).withOptions({ shallow: true }))
  const [isTransitioning, setIsTransitioning] = useState(false)

  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: { email: '', password: '', fullName: '', role: undefined, notifications: true, ...defaults },
    mode: 'onTouched',
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (data: WizardValues) => client.protected.setup.complete(data),
    onSuccess: () => { router.refresh(); router.push('/protected/home') },
    onError: (err: Error) => form.setError('root', { message: err.message ?? 'Something went wrong' }),
  })

  const isLastStep = step === STEP_COMPONENTS.length - 1

  const animateToStep = (next: number) => {
    setIsTransitioning(true)
    setTimeout(() => { setStep(next); setIsTransitioning(false) }, 200)
  }

  const handleNext = async () => {
    const fields = STEP_FIELDS[step as keyof typeof STEP_FIELDS]
    const valid = await form.trigger(fields as (keyof WizardValues)[])
    if (!valid) return
    if (isLastStep) {
      form.handleSubmit((data) => mutate(data), (errors) => {
        // On full-schema error, jump to the step with the problem
        const errorStep = Object.entries(STEP_FIELDS).find(([, f]) =>
          f.some((field: string) => field in errors))?.[0]
        if (errorStep) setStep(Number(errorStep))
      })()
    } else {
      animateToStep(step + 1)
    }
  }

  const handleBack = () => { if (step > 0) animateToStep(step - 1) }
  const StepComponent = STEP_COMPONENTS[step]

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        <StepProgress currentStep={step} totalSteps={STEP_COMPONENTS.length} labels={STEP_LABELS} />
        <div className={cn('transition-all duration-200 ease-out',
          isTransitioning ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0')}>
          {StepComponent && <StepComponent />}
        </div>
        {form.formState.errors.root && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {form.formState.errors.root.message}
          </div>
        )}
        <div className="flex justify-between">
          <Button type="button" variant="ghost" onClick={handleBack} disabled={step === 0}>Back</Button>
          <Button type="button" onClick={handleNext} disabled={isPending}>
            {isLastStep ? 'Complete' : 'Continue'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
```

## Step Component (uses parent form context)

```tsx
'use client'
import { useFormContext } from 'react-hook-form'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import type { WizardValues } from './schemas'

export function StepAccount() {
  const { control } = useFormContext<WizardValues>()
  return (
    <div className="space-y-4">
      <FormField control={control} name="email" render={({ field }) => (
        <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={control} name="password" render={({ field }) => (
        <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
      )} />
    </div>
  )
}
```

Step components use `useFormContext<WizardValues>()` -- NOT their own `useForm`. shadcn `<Form>` IS a `FormProvider`.

## Progress Indicator

```tsx
'use client'
import { cn } from '@/lib/utils'

export function StepProgress({ currentStep, totalSteps, labels }: {
  currentStep: number; totalSteps: number; labels?: readonly string[]
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className={cn('h-2 rounded-full transition-all duration-200',
            i === currentStep ? 'w-8 bg-primary' : 'w-2',
            i < currentStep ? 'bg-primary' : i > currentStep ? 'bg-muted' : ''
          )} aria-current={i === currentStep ? 'step' : undefined} />
          {labels?.[i] && <span className={cn('text-xs', i <= currentStep ? 'text-foreground' : 'text-muted-foreground')}>{labels[i]}</span>}
        </div>
      ))}
    </div>
  )
}
```

## Conditional Steps

```tsx
const allSteps = [
  { id: 'account', component: StepAccount, fields: ['email', 'password'] },
  { id: 'company', component: StepCompany, fields: ['companyName'] }, // only for founders
  { id: 'profile', component: StepProfile, fields: ['fullName'] },
]
const role = form.watch('role')
const visibleSteps = allSteps.filter((s) => !(s.id === 'company' && role !== 'founder'))
// Use visibleSteps.length for totalSteps, visibleSteps[step] for current component/fields
```

When steps are conditional, `step` index = position in `visibleSteps`, not `allSteps`. Recalculate `isLastStep` from `visibleSteps.length`.

## Gotchas

- **Always `await form.trigger()`** -- it returns `Promise<boolean>`. Without `await`, validation is skipped and navigation proceeds immediately.
- **Fields must be registered to validate.** If a step unmounts and its fields unregister, `trigger()` returns `true` (no fields = no errors). RHF default `shouldUnregister: false` keeps them registered -- do not change this.
- **`useFormContext` needs `<FormProvider>` ancestor.** shadcn `<Form>` IS a `FormProvider`, but step components must be children of `<Form>`, not siblings.
- **nuqs `shallow: true` is critical.** Without it, every step change triggers a server round-trip. Step navigation must be client-only.
- **`parseAsInteger.withDefault(0)`** -- without `withDefault`, value is `null` when `?step=` param is missing. Always provide a default.
- **Use `trigger(fields)` for steps, `handleSubmit` for final.** `handleSubmit` runs full schema validation. `trigger(fieldNames)` validates only those fields.
- **Conditional steps break indexing.** Skipping step 2 makes step 3 become index 2 in the filtered array. Always derive component/fields from the filtered list.
- **Browser back/forward changes steps.** nuqs URL state means the browser back button navigates steps. Form data persists because `useForm` state lives in React memory (single-form pattern).
