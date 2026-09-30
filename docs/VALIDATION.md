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
