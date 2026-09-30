# Customization

## Add a workflow skill

Create `.agents/skills/foundry-NAME/SKILL.md` with only supported `name` and `description` frontmatter, then put the instructions below it. Add `.agents/skills/foundry-NAME/agents/openai.yaml`:

```yaml
policy:
  allow_implicit_invocation: false
```

Keep lifecycle operations in `scripts/foundry.py`. A skill may request runtime commands; it must not write active state or receipts itself.

## Enable a reference skill

List available names under `library/skills/`, inspect its license and instructions, then run:

```sh
python3 scripts/foundry.py enable-skill NAME
```

The command copies it to `.agents/skills/NAME` only when that destination does not exist. Edit the enabled copy for the project; the library remains the reusable baseline.

## Add project checks

Edit `.foundry/project.json`. Each check uses an argv array, so no shell parsing is required:

```json
{
  "checks": [
    {
      "name": "tests",
      "command": ["npm", "test"],
      "cwd": ".",
      "timeout": 120,
      "required": true
    }
  ]
}
```

Make release-critical checks required. Missing tools, timeouts, and nonzero exits fail required checks.

## Add or change a role

Create a TOML file under `.codex/agents/` with `name`, `description`, `sandbox_mode`, and `developer_instructions`. Omit `model` so the user's configured model is inherited. Point to repository-relative philosophy and skill files rather than home-directory configuration.
