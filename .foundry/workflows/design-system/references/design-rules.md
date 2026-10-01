# Design decisions and quality

Read AGENTS.md, docs/WORKFLOW.md, the adopted product brief, and the applicable
artifact contracts before acting. Follow the actual stack, assigned write paths,
and existing authority. These steps are options for the current scope, not a
mandatory full redesign. The adopted brief overrides generic visual recipes.

The product's task, content, brand, and adopted UX brief determine visual choices.
No universal gradient, glass, shadow, card, accent-count, typeface, theme, or
border-radius prescription applies. A calm flat UI can be correct. An expressive
UI can be correct when it improves the intended experience.

Use hierarchy to show the primary decision/action. Apply a coherent type and
spacing system. Reuse semantic tokens and existing components, and preserve their
public interfaces unless a migration is in scope. Choose color and motion to
communicate state; never make color or hover the sole information channel.

Define focus, disabled/pending, loading, empty, error, success, and recovery states
where relevant. Make realistic long/short content work on target devices. Preserve
keyboard access, labels, contrast, focus return, and reduced-motion behavior.
Only support additional themes when adopted by the product; verify every supported
theme rather than adding one just to satisfy a reference.

If the brief selects gradients, shadows, or glass, define their tokens and check
contrast/readability across states. Their absence is not a defect. Do not replace
a shared component style without checking its callers and existing screenshots.

Quality evidence comes from rendered interactions and criteria, plus the actual
project checks. A grep for color classes cannot prove usability or accessibility.
Keep subjective suggestions separate from failures against adopted requirements.
