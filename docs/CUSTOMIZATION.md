# Customization

Keep product decisions, stack, model, reasoning, and authorization under the
owner's control. Choose small/feature/product depth from WORKFLOW.md; use the
record schema and gates in WORKFLOW-CONTRACTS.md and provider capabilities in
PROVIDERS.md. Keep backward-compatible `.foundry` storage and `foundry-*` names.

The terminal command is the supported configuration surface:
`./foundry --products-dir PATH configure PROJECT --provider NAME --model MODEL
--reasoning REASONING`. Omitted preferences preserve saved values; an explicit
empty model or reasoning resets it. The framework registry is copied into a
product only at `new` time. Edit a product's local `.foundry/providers.json`
only after reviewing its adapter contract and billing mode.

## Add a workflow skill

Create `.agents/skills/foundry-NAME/SKILL.md` with supported `name` and `description`
frontmatter, then concise task instructions. Add `agents/openai.yaml` beside it:

```yaml
policy:
  allow_implicit_invocation: false
```

A workflow may ask the coordinator to run lifecycle commands through
`scripts/marketcraft.py`; it must not write active state or receipts itself.
Review-only workflows report findings. They do not silently implement repairs or
create external authority. Do not turn a reusable reference into a mandatory stage.

## Enable a reference skill

Inspect the local library skill's source, license, instructions, dependencies,
overlap, and the demonstrated problem it would solve. Then, when in scope:

```sh
python3 scripts/marketcraft.py enable-skill NAME
```

This copies into `.agents/skills/NAME` only when the destination does not exist.
Edit the enabled copy for the product. External imports need source/revision and
notice records, a diff review, and a relevant evaluation before activation.
Do not install/remove packages because a scout score crosses a threshold.

## Add project checks

Edit `.foundry/project.json`. Checks use argv arrays, not shell command strings:

```json
{
  "checks": [
    {"name": "tests", "command": ["npm", "test"], "cwd": ".", "timeout": 120, "required": true}
  ]
}
```

Use the application's actual commands and preserve existing checks. Required
checks fail on missing tools, timeouts, and nonzero exits. Map them to real
acceptance criteria; a green command with no relevant assertions is insufficient.
Browser, authorization, persistence, retries, and service integrations need
appropriate exercised evidence. No architecture or visual lint is implicit.

## Add or change a role

Use a TOML file under `.codex/agents/` with `name`, `description`, `sandbox_mode`,
and `developer_instructions`. Omit both `model` and `model_reasoning_effort` to
inherit the owner's configuration. Any requested override belongs in explicit
owner configuration, not a hidden role default.

Review roles use `sandbox_mode = "read-only"` and return findings as text.
Tests requiring writes or fixtures can run in a separate, bounded execution
assigned by the coordinator. Reviewers cannot repair code, alter acceptance
criteria, or perform lifecycle transitions. Failed repairs retain the original
FAIL until the reproducing check succeeds. Builder roles receive owned paths and
existing authority. The coordinator integrates all writes before final verify.

Reference repository-relative documents. The adopted product brief overrides
mandatory gradients, glass, shadows, or other generic design recipes. Reuse the
six UX artifact handoffs at the request's depth and re-review affected artifacts
when a shared contract changes. Record reliable usage only when available.
