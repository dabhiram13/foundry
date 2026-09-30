# Legal Pages Workflow

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Static /terms and /privacy pages + signup consent text. Frontend-only — no backend, no API, no database.

## Dispatch Overrides

Coordinator MUST dispatch with: `SKIP BACKEND, SKIP CODE-REVIEW`

Effective pipeline: `setup → frontend → quality → complete`

## Inputs

1. `docs/project/product-overview.md` — product name, description, business model
2. `docs/project/product-overview.md` — pricing section: plan names, limits (if billing exists)
3. `docs/project/brand-guidelines.md` — voice, tone
4. `docs/project/technical-requirements.md` — data collected, security, locations
5. `docs/project/users-and-journeys.md` — signup flow (for consent text placement)
6. `webapp/app/globals.css` — design tokens

## Outputs

| Output | Location |
|--------|----------|
| Terms of Service page | `webapp/app/(marketing)/terms/page.tsx` |
| Privacy Policy page | `webapp/app/(marketing)/privacy/page.tsx` |
| Signup consent text | Edit existing signup form component |

## What to Generate

### Terms of Service
- Service description (from product-overview)
- Account terms (signup, suspension, termination)
- Acceptable use
- Payment terms (from product-overview pricing section, if billing exists — skip if no billing)
- Intellectual property
- Limitation of liability
- Governing law (from technical-requirements locations)
- Contact information

### Privacy Policy
- Data collected (from technical-requirements data model + security)
- How data is used
- Third-party services (Supabase, Vercel, Stripe if billing, Resend, any from external-tools)
- Cookies and tracking
- Data retention
- User rights (access, deletion, export)
- Children's privacy (standard COPPA clause)
- Contact information

### Signup Consent
Add below the signup button:
```
By signing up, you agree to our [Terms of Service](/terms) and [Privacy Policy](/privacy).
```

## Page Design

- Use `(marketing)` route group (same as landing page)
- Simple, readable layout — prose typography
- Tailwind `prose` classes for the legal text
- Last updated date at the top
- Table of contents with anchor links
- Back to home link
- Use semantic tokens from globals.css (bg-background, text-foreground, text-muted-foreground)
- Mobile responsive

## Notes

- These are standard SaaS legal pages, not legal advice
- Feature-spec should adapt the content to the specific product
- Tone should match brand-guidelines but remain professional for legal text
- If the product has no billing, omit payment terms entirely
