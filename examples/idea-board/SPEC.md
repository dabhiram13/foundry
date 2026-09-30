# Local idea board acceptance slice

Authorized implementation: build a tiny self-contained local web application using Python standard library, SQLite, and ordinary HTML/CSS/JS. No external accounts, frameworks or downloads.

Users can add a named product idea, list saved ideas after reload, mark an idea done, and delete an idea. A real local HTTP API must validate titles, return sensible 4xx for malformed/missing resources, and persist in SQLite. Use an explicit --db path and --port (accept 0 for test ephemeral port), bind loopback only. The browser should expose visible error, loading and empty states with labeled accessible form controls.

Create app.py, index.html, test_app.py and README.md. Required test command: python3 -m unittest test_app -v. Meaningful tests exercise a real HTTP server against isolated temp SQLite: create/list, persist across server restart, update/delete, malformed JSON/title validation and missing IDs. No production auth/payment claims.

Use Foundry native runtime start/resume/verify/complete. Do not handcraft runtime JSON. Configure checks in .foundry/project.json and leave evidence.
