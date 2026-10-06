# The Foundry workflow

Foundry has two work sizes backed by the same TypeScript core. A new product
uses Research → Plan → Design → Build → Test → Ship. A bounded existing-repo
change uses scoped `work` commands and does not pretend to have completed the
six-stage product process.

## New product

Research captures context and risks. Plan records the product direction and
criteria. Design defines an implementation approach. The owner reviews and
approves the exact Plan and Design revisions before implementation proceeds.
Build works in bounded tasks, runs configured checks, and allows limited repair.
Test verifies current evidence. Ship writes a local validated summary only; it
does not publish or deploy.

Each explicit `foundry run PROJECT` performs one stage. Interactive `/run`
continues until an approval, completion or failure boundary. Status reflects
saved stage, tasks, provider work, checks and review findings rather than
invented token progress.

## Research

Research has two AI turns, with a source-reading step between them:

1. The research role chooses one to five public HTTPS sources or local project
   documents using the tools available from your provider.
2. Foundry reads those sources, saves text snapshots with timestamps and hashes,
   and passes bounded excerpts back to the role. It does not run page scripts.
3. The role returns findings, supporting quotes and open questions. Foundry
   checks that every quote occurs in the supplied source excerpt, that snapshots
   have not changed, and writes the research report itself.

A URL alone, invented quotation or an entirely unavailable source set cannot
complete Research. A local-only report is allowed but explicitly marked as local
input, not independent market evidence. Unreadable sources and shortened excerpts
are recorded as limitations. Review the findings before approving the Plan:
matching a quotation does not prove the source is true or the interpretation valid.

Source reads are limited to public HTTPS on port 443, three redirects, 15 seconds
and 512 KiB per page. Private, loopback and reserved addresses are refused, including
after DNS lookup and redirects; connections use the validated address. Requests
carry no account cookies or authorization. HTML is converted to text without a
browser; PDFs, login-only pages and JavaScript-only content are not supported.
Only the first 6,000 characters of each readable source go to the synthesis turn.
Local sources are Markdown/text documents under `docs/`, or `README.md`; state,
hidden credential files, symlinks and the generated research report are excluded.

The report is `docs/product/research.md`. Source snapshots and structured results
are private records under `.foundry/state/factory/research/`. Cancellation keeps
available partial records and does not advance the stage; recovery and retry are
explicit. Retry selects and reads sources again rather than trusting partial work.

This is a bounded tool-and-observation loop, not an autonomous web crawler. Search
still depends on the provider's tools. No extra AI account or research API key is
required by Foundry; [provider access](PROVIDERS.md) and live qualification remain
separate.

## Scoped repository work

Start a scoped run with an existing local spec:

```sh
foundry work start SLUG --spec docs/specs/change.md --project /path/to/repository
foundry work status --project /path/to/repository
foundry work verify --project /path/to/repository
foundry work complete --project /path/to/repository
```

`verify` runs configured checks and reports nested active, check, review and
task state. `complete` records local completion only when evidence permits it.
Pause, resume, stop and recover are explicit. An interrupted or failed command
does not become a pass because a later command returned successfully.

## Roles and review

The neutral role catalog supplies instructions and permission requests to
providers. Roles are policies, not a running agent swarm. A model response does
not grant approval or change the project's billing and check rules. Read-only
review reports findings; owners or authorized implementers decide and repair.

See [saved workflow contracts](WORKFLOW-CONTRACTS.md),
[project customization](CUSTOMIZATION.md), and [provider capabilities](PROVIDERS.md).
