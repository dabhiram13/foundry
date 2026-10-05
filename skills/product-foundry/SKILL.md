---
name: product-foundry
description: Compatibility entry for Foundry when the owner asks for Product Foundry; preserves existing product setup and workflow names.
---

# Product Foundry compatibility entry

This retained skill name is an instruction alias, not a separate runtime. Use the
single Node 24 `foundry` executable described in
[`skills/foundry/SKILL.md`](../foundry/SKILL.md). Interactive terminal commands
and explicit CLI commands share the same project service.

Do not invoke removed Python, browser-panel, HTTP-workspace or MCP framework
interfaces. New product work defaults to `~/.foundry/products`; use
`--products-dir PATH` for an explicit owner-selected directory. Do not move
legacy `../products` automatically. Existing unmarked `.foundry` data requires
an explicit `foundry migrate --project PATH --dry-run` review before `--apply`.
