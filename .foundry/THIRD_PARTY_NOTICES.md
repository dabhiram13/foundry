# Source and license notices

Product Foundry includes adapted Code Kit 0.3.0 framework material by Speedy Devv.
The delivered framework's `docs/LICENSING.md` declares MIT; the matching npm CLI
contains the MIT license preserved in `upstream/LICENSE-codekit.md` and its archive.
The original framework and CLI are retained as compressed reference archives with
SHA-256 hashes in `upstream/provenance.json`. They are not required at runtime.

The separate BuildThisNow SaaS skeleton is **not included**. Its observed license
was proprietary and had restrictions different from the delivered framework.
Our local acceptance example is independently authored.

`library/skills/` contains adapted bundled third-party material. Keep every
`LICENSE`, `LICENSE.txt`, `LICENSE.md`, `NOTICE`, source link and author notice
shipped inside those bundles. Apache-2.0 bundles (including `claude-api`,
`frontend-design` and `webapp-testing`) retain their Apache license files.
The original `skills-lock.json` is included in the preservation archive; its
source attributions are recorded in `library/provenance.json`. Entries without
a resolvable upstream origin are marked as incomplete attribution rather than
claimed as newly authored code.

The original lock contains references to Everything Claude Code, blader/humanizer,
Resend, hai-bin/dev and repository scanning material, Stripe, Supabase, Jeff Allan's
Claude skills, and Vercel Engineering. Original links and local integrity hashes
are evidence of supplied origin metadata; they are not independent source pins.

Keep the repository private as requested. Private visibility is not a license
change; retain these notices when copying the framework to a product.
