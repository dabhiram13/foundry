# Idea board

A small local product idea board. Add an idea, reload to see saved ideas, mark it
done (or open again), and delete it. Data stays in the SQLite file you choose.
Python's standard library supplies the server and database; the page uses plain
HTML, CSS, and JavaScript. No installation or external services are needed.

## Run

Use Python 3.11 or newer from this directory:

```sh
python3 app.py --db ./ideas.sqlite3 --port 8000
```

Open <http://127.0.0.1:8000>. Both flags are required. The database file is created
if absent; its parent directory must already exist. Use the same `--db` path to
keep your ideas across restarts. `--port 0` chooses a free port and prints its URL.
Stop the server with Ctrl+C. JavaScript must be enabled in the browser.

The app binds only to `127.0.0.1`. It is a local, single-user tool without account
authentication, payments, or a production hosting setup. Deleting an idea is
permanent. Keep a copy of the database if you need a backup.

## HTTP API

All API responses except a successful delete are JSON. Send
`Content-Type: application/json` for POST and PATCH.

| Request | Body | Success |
| --- | --- | --- |
| `GET /api/ideas` | — | `200 {"ideas": [...]}` ordered newest first |
| `POST /api/ideas` | `{"title":"Garden planner"}` | `201 {"id":1,"title":"Garden planner","done":false}` |
| `PATCH /api/ideas/1` | `{"done":true}` | `200` with the updated idea |
| `DELETE /api/ideas/1` | — | `204` with no body |

Titles are trimmed and must contain 1–200 Unicode characters without NUL. Only
the documented fields are accepted, and `done` must be a JSON boolean. Invalid
bodies return `400`, missing resources `404`, unsupported methods `405`, oversized
bodies (over 8192 bytes) `413`, and unsupported content types `415`. Errors contain
an `error` message. Requests with a foreign Host or Origin are rejected with `403`.

The page provides loading, empty, success, and error states, a refresh action,
keyboard-accessible controls, and labeled form inputs. Failed saves retain the
draft title; failed changes leave the last saved state visible.

## Verify

```sh
python3 -m unittest test_app -v
```

Tests use real loopback HTTP servers and isolated temporary SQLite files. They
cover create/list, persistence across a server restart, done/open and deletion,
malformed JSON, title and boolean validation, missing IDs, request boundaries,
loopback binding, the homepage, and explicit command-line arguments.

The framework's release configuration runs this behavior check alongside its
runtime and catalog checks. The live Codex build used `foundry.py verify` and
`complete` in a separate installed product; its recorded evidence is under
`../../docs/evidence/live-codex/`. Hooks were not needed for explicit verification.

To use this as a product starter, install Foundry into a separate folder, copy
`app.py`, `index.html` and `test_app.py` there, and configure the test command above
as a required project check. This example is independently authored.
