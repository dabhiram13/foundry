# Validation

Run the four commands under "Check the framework" in `README.md`.

- Entry-skill checks cover connecting to Codex, reconnection, and preservation of
  existing skill edits.
- Runtime and hook tests check installation and updates, preservation of local edits,
  project boundaries, pause/resume, current verification results, hook inputs, and
  scanning staged files for secrets.
- The internal web-app fixture checks real HTTP requests and SQLite persistence,
  including restart behavior and invalid inputs. It is test support, not a product
  template or a feature of the framework.
- The catalog check validates workflow policies, agent configuration, and referenced
  files. It also accepts additional custom workflow skills.
- The secret scan checks tracked files before publishing changes.

Product tests and real service integration checks belong in each product's
`.foundry/project.json`. These framework checks do not establish that an application's
payments, deployment, email, or other integrations work. Optional Codex hooks still
require native trust review through `/hooks`; explicit verification runs without them.

## Instruction evaluation — 2026-09-30

Two isolated forward exercises reviewed the revised planner and quality-gate
instructions. A planning-only CSV export request for a plain Python CLI produced
a scoped plan with real paths and observable checks, without starting a run or
implementing the feature. A review-only persistence scenario rejected a successful
no-op check after reproducing record loss across store instances; it reported the
failure without repairing code or completing a run.

These are focused instruction exercises. They do not establish native Codex role
auto-discovery, automatic routing, repeatability across models, or complete product
delivery. The broader live journey evaluation suite is proposed in
[Research and next build plan](RESEARCH.md).

The same update passed 22 framework tests and 12 HTTP/SQLite fixture tests. The
HTTP tests required loopback access outside the restrictive execution sandbox.
Changed skill frontmatter was parsed and checked with the installed Ruby YAML
parser because the Skill Creator validator's Python environment lacked PyYAML;
no new package was added. Modified browser examples received Python syntax
checks, not a live browser run against a product.
