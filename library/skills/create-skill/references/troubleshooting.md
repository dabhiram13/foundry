# Troubleshooting

## Upload Issues

| Symptom | Fix |
|---------|-----|
| Won't upload | Create SKILL.md (exact case). Verify: `ls -la` |
| Invalid YAML | Check `---` delimiters, quote escaping |
| Bad folder name | Rename to kebab-case: `my-skill-name` |

## Trigger Issues

| Symptom | Fix |
|---------|-----|
| Never triggers | Add trigger phrases. Test: "When use [skill]?" |
| Triggers too often | Add "Do NOT use for X"; narrow scope |

**Trigger test:** Obvious/paraphrased → YES. Unrelated → NO.

## MCP Issues

| Symptom | Fix |
|---------|-----|
| Call fails | Settings > Extensions > Reconnect |
| Auth expired | Re-authenticate MCP server |
| Permission denied | Check user permissions |
| Wrong tool name | Case-sensitive. Check spelling |

**Debug:** Test MCP alone → check status → verify tool names

## Execution Issues

| Symptom | Fix |
|---------|-----|
| Ignores instructions | Concise bullets; CRITICAL at top |
| Wrong output | Add validation script |
| Incomplete | Number all steps explicitly |

## Performance Issues

| Symptom | Fix |
|---------|-----|
| Slow | Move to references/; keep under 5k words |
| Too many skills | Disable unused; keep under 20-50 |

## Script Issues

| Symptom | Fix |
|---------|-----|
| Fails | Check dependencies in SKILL.md |
| Not executable | `chmod +x scripts/name.sh` |
| Wrong path | Use relative paths from skill folder |

## Checklist

- [ ] Kebab folder name
- [ ] SKILL.md (exact case)
- [ ] YAML: `---` + name + description
- [ ] Description has triggers
- [ ] No README.md inside
- [ ] Under 5,000 words
- [ ] Scripts executable
- [ ] MCP connected

## Iteration

| Issue | Action |
|-------|--------|
| Under-trigger | Add 3-5 trigger phrases |
| Over-trigger | Add "Do NOT use for X" |
| Wrong actions | Add specific commands |
| Missing validation | Add script step |
| Slow | Move to references/ |
