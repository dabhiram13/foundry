# Foundry

Foundry turns ideas into tested products.
Build a small, differentiated product through conversation, from a focused idea
to a tested customer journey. Start with a proven market, then use customer and
competitor evidence to choose an advantage in experience, service, or pricing. You remain the product
driver; Codex coordinates the next useful action and records evidence.

Requires Python 3.11+, Git, and Codex on macOS or Linux (WSL on Windows).

## Start with an idea

> Use Foundry to explore a tutor booking product. Tutors need fewer missed
> appointments; I want a simpler booking experience than their current tools.

You can also ask for a small fix, a feature, a review, or help with an existing
product. Foundry selects small, feature, or product depth. It reuses current
artifacts and asks about consequential decisions; every request does not need
market research, a redesign, or a release. Planning and review requests keep their
scope. A guide recommendation never authorizes an external action.

For new products, the default folder is beside this framework checkout. Describe
another location normally. Codex resolves paths, setup, and actual project checks.
Application code belongs in its product workspace. After setup, open that folder
as a separate Codex workspace for ongoing work.

## What the workflow preserves

- Dated evidence and explicit assumptions feed a switching, pricing, channel, and
  unit-economics thesis, then a bounded product brief and observable criteria.
- UX work moves through framing, flows/states, realistic prototypes, visual
  direction, a working slice, and rendered usability/accessibility evidence at
  the depth the change needs.
- The coordinator owns integration. Independent reviewers return findings;
  builders repair within scope. Failed repairs cannot turn failures into passes.
- Run/check evidence and guided records support resuming work. Local verification,
  deployment, and owner acceptance remain separate facts.

These instructions and local contracts improve continuity; they do not constitute
a fully autonomous business, prove demand, or guarantee native agent delivery.
See [Workflow](docs/WORKFLOW.md), [record and artifact contracts](docs/WORKFLOW-CONTRACTS.md),
[provider boundaries](docs/PROVIDERS.md), and [validation limits](docs/VALIDATION.md).
The [runtime guide](docs/RUNTIME.md) explains freshness, interruption and update recovery.

## Connect Codex

Clone this repository once and run from its root:

```sh
python3 scripts/connect_codex.py
```

The connection records this checkout's location in your user entry skills.
`foundry` is the canonical entry; `marketcraft` and `product-foundry` remain
compatibility entries. Start a new chat if needed for discovery. Reconnect after moving the checkout;
local entry-skill edits are preserved. Model and reasoning settings remain yours.
Provider capability reporting does not silently switch a subscription workflow to
API billing or grant credentials. Consult [Providers](docs/PROVIDERS.md).

## Install, customize, and update

Conversational setup resolves these commands internally. For direct control:

```sh
python3 scripts/marketcraft.py install TARGET
python3 scripts/marketcraft.py status
```

Use an absolute target outside another repository; add `--update` only for an
intended framework update. Installation-only requests preserve application code
and configuration. Updates stop on conflicting local edits.

The `scripts/marketcraft.py` and `scripts/foundry.py` commands, `marketcraft` and
`product-foundry` entries, `foundry-*` workflow names, and `.foundry` data directory
remain supported. Existing `MARKETCRAFT_*` environment variables,
`docs/project/marketcraft.json` records, install markers, and provider protocols
keep their existing names and behavior. The product name change
requires no repository-path, remote, or existing state migration.

[Catalog](docs/CATALOG.md) lists roles and references. [Customization](docs/CUSTOMIZATION.md)
covers real project checks and selective adoption. Optional hooks need native
review through `/hooks`; they are guidance, not a security boundary. No new skill,
account, dependency, recurring job, or release is implied by an idea request.

## Check the framework

```sh
python3 -m unittest discover -s tests -v
python3 -m unittest discover -s tests/fixtures/web_app -v
python3 -m unittest discover -s tests/fixtures/saas_app -p test_evaluator.py -v
python3 scripts/evaluate_journey.py
python3 scripts/check_catalog.py
python3 scripts/security_scan.py --whole-tracked
```

[Journey evaluation](docs/EVALUATION.md) documents existing browser prerequisites,
explicit dependency setup, evidence artifacts and limitations. Missing browser
capabilities make the required journey gate unverified and nonzero. CI uses pinned
Playwright 1.63.0 and its matching browser image; evaluation itself never installs.

[Validation](docs/VALIDATION.md) separates these checks from live product evidence.
[Provenance](docs/PROVENANCE.md) records the supplied framework history and retained
limits; [license notices](THIRD_PARTY_NOTICES.md) identify notices to preserve.
[Research](docs/RESEARCH.md) is a dated design input, not proof of implementation.
