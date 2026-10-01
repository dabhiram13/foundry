"""Disposable loopback SaaS evaluation app. Not a production starter or provider SDK."""

import argparse
from contextlib import closing
from dataclasses import dataclass
import hashlib
import hmac
from http.cookies import CookieError, SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import secrets
import signal
import socket
import sqlite3
import threading
import time
from urllib.parse import urlsplit


class APIError(Exception):
    def __init__(self, status, message, allow=None):
        super().__init__(message)
        self.status, self.allow = status, allow


class FakeOutlineProvider:
    """Explicit deterministic double: no external AI, billing, credentials or side effect."""

    def __init__(self, fail_first=False):
        self._fail = fail_first
        self._lock = threading.Lock()

    def fail_next(self):
        with self._lock:
            self._fail = True

    def compose(self, title):
        with self._lock:
            if self._fail:
                self._fail = False
                raise APIError(503, "The outline service is temporarily unavailable. No credit was used. Retry this outline.")
        return f"{title}\n1. Define the audience and desired outcome.\n2. Prepare one useful example.\n3. Test the example with a participant."


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def password_hash(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 120_000).hex()


def brief_data(row):
    return {"id": row["id"], "title": row["title"], "outline": row["outline"]}


def account_data(row):
    return {"email": row["email"], "plan": row["plan"], "credits": row["credits"]}


def text_field(payload, name, maximum, minimum=1):
    value = payload.get(name)
    if not isinstance(value, str):
        raise APIError(400, f"Provide {name} as text.")
    value = value.strip()
    if not minimum <= len(value) <= maximum or any(ord(c) < 32 for c in value):
        raise APIError(400, f"{name.capitalize()} must contain {minimum} to {maximum} printable characters.")
    try:
        value.encode("utf-8")
    except UnicodeError:
        raise APIError(400, f"{name.capitalize()} must contain valid Unicode.") from None
    return value


@dataclass
class Result:
    body: dict
    status: int = 200
    cookie: str | None = None
    drop_response: bool = False


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        # No session tokens, passwords or customer text in test logs.
        pass

    def respond(self, status, body, content_type="application/json; charset=utf-8", cookie=None, allow=None):
        self.send_response(status)
        for name, value in {
            "Content-Type": content_type,
            "Content-Length": str(len(body)),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
            "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
        }.items():
            self.send_header(name, value)
        if cookie:
            self.send_header("Set-Cookie", cookie)
        if allow:
            self.send_header("Allow", allow)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def read_json(self):
        if self.headers.get_content_type() != "application/json":
            raise APIError(415, "Send JSON with Content-Type: application/json.")
        lengths = self.headers.get_all("Content-Length", [])
        if self.headers.get("Transfer-Encoding") or len(lengths) != 1 or not re.fullmatch(r"[0-9]{1,5}", lengths[0]):
            raise APIError(400, "Provide one valid Content-Length without Transfer-Encoding.")
        if int(lengths[0]) > 8192:
            raise APIError(413, "Request body must be at most 8192 bytes.")
        self.connection.settimeout(5)
        try:
            data = json.loads(self.rfile.read(int(lengths[0])).decode("utf-8"))
        except TimeoutError:
            raise APIError(408, "Timed out reading the request.") from None
        except (ValueError, UnicodeError, RecursionError):
            raise APIError(400, "Send a valid JSON object.") from None
        if not isinstance(data, dict):
            raise APIError(400, "Send a JSON object.")
        return data

    def authenticated(self, db):
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get("Cookie", ""))
            token = cookies["session"].value
        except (KeyError, ValueError, CookieError):
            raise APIError(401, "Sign in to continue.") from None
        session = db.execute("""SELECT sessions.token_hash, sessions.csrf, accounts.*
            FROM sessions JOIN accounts ON accounts.id = sessions.account_id
            WHERE token_hash = ? AND expires_at > ?""", (digest(token), time.time())).fetchone()
        if session is None:
            raise APIError(401, "Sign in to continue.")
        if self.command not in ("GET", "HEAD"):
            csrf = self.headers.get("X-CSRF-Token", "")
            if not hmac.compare_digest(csrf.encode(), session["csrf"].encode()):
                raise APIError(403, "Refresh this page before trying again.")
        return session

    def establish_session(self, db, account, status=200):
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        db.execute("INSERT INTO sessions VALUES (?, ?, ?, ?)",
                   (digest(token), account["id"], csrf, time.time() + 86400))
        return Result({"account": account_data(account), "csrf": csrf}, status,
                      f"session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400")

    def api(self, path):
        routes = {
            "/api/register": ("POST",), "/api/login": ("POST",),
            "/api/logout": ("POST",), "/api/session": ("GET",),
            "/api/briefs": ("GET", "POST"), "/api/fixture/plan": ("POST",),
        }
        item = re.fullmatch(r"/api/briefs/([1-9][0-9]{0,17})(/outline)?", path)
        allowed = routes.get(path) or (("POST",) if item and item[2] else ("GET",) if item else None)
        if not allowed:
            raise APIError(404, "Resource not found.")
        if self.command not in allowed:
            raise APIError(405, "Method not allowed.", ", ".join(allowed))
        with closing(sqlite3.connect(self.server.db_path, timeout=5)) as db, db:
            db.row_factory = sqlite3.Row
            # This deterministic local fixture serializes writes. A real slow provider
            # needs a durable operation protocol, not a database lock around network I/O.
            if self.command == "POST":
                db.execute("BEGIN IMMEDIATE")
            payload = self.read_json() if self.command == "POST" else {}
            if path in ("/api/register", "/api/login"):
                if set(payload) != {"email", "password"}:
                    raise APIError(400, "Provide email and password only.")
                email = text_field(payload, "email", 254).lower()
                password = text_field(payload, "password", 128, 12)
                if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
                    raise APIError(400, "Provide a valid email address.")
                account = db.execute("SELECT * FROM accounts WHERE email = ?", (email,)).fetchone()
                if path == "/api/register":
                    if account:
                        raise APIError(409, "That account exists. Sign in instead.")
                    salt = secrets.token_hex(16)
                    db.execute("INSERT INTO accounts(email, salt, password_hash) VALUES (?, ?, ?)",
                               (email, salt, password_hash(password, salt)))
                    account = db.execute("SELECT * FROM accounts WHERE email = ?", (email,)).fetchone()
                    return self.establish_session(db, account, 201)
                # Hash even for a nonexistent account; errors disclose no account match.
                candidate = password_hash(password, account["salt"] if account else "00" * 16)
                if not account or not hmac.compare_digest(account["password_hash"], candidate):
                    raise APIError(401, "Email or password did not match.")
                return self.establish_session(db, account)

            session = self.authenticated(db)
            account_id = session["id"]
            if path == "/api/session":
                return Result({"account": account_data(session), "csrf": session["csrf"]})
            if path == "/api/logout":
                if payload:
                    raise APIError(400, "Logout takes no fields.")
                db.execute("DELETE FROM sessions WHERE token_hash = ?", (session["token_hash"],))
                return Result({"signed_out": True}, cookie="session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0")
            if path == "/api/fixture/plan":
                if payload != {"plan": "demo"}:
                    raise APIError(400, "Only the local demo plan is available.")
                db.execute("UPDATE accounts SET plan = 'demo', credits = 3 WHERE id = ? AND plan = 'free'", (account_id,))
                account = db.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
                return Result({"account": account_data(account), "provider": "deterministic-fixture; no payment"})
            if path == "/api/briefs":
                if self.command == "GET":
                    rows = db.execute("SELECT * FROM briefs WHERE account_id = ? ORDER BY id DESC", (account_id,))
                    return Result({"briefs": [brief_data(row) for row in rows]})
                if set(payload) != {"title"}:
                    raise APIError(400, "Provide a title only.")
                title = text_field(payload, "title", 200)
                cursor = db.execute("INSERT INTO briefs(account_id, title) VALUES (?, ?)", (account_id, title))
                return Result({"brief": {"id": cursor.lastrowid, "title": title, "outline": None}}, 201)

            brief = db.execute("SELECT * FROM briefs WHERE id = ? AND account_id = ?",
                               (int(item[1]), account_id)).fetchone()
            if brief is None:
                raise APIError(404, "Brief not found.")
            if self.command == "GET":
                return Result({"brief": brief_data(brief)})
            if payload:
                raise APIError(400, "Outline creation takes no fields.")
            key = self.headers.get("Idempotency-Key", "")
            if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", key):
                raise APIError(400, "Provide an Idempotency-Key of 1 to 80 letters, digits, underscores or hyphens.")
            operation = db.execute("SELECT * FROM operations WHERE account_id = ? AND request_id = ?", (account_id, key)).fetchone()
            if operation:
                if operation["brief_id"] != brief["id"]:
                    raise APIError(409, "This request key belongs to another brief. Use a new key.")
                return Result(json.loads(operation["response"]))
            if session["plan"] != "demo" or session["credits"] < 1:
                raise APIError(402, "Creating an outline needs the demo plan and an available credit.")
            outline = self.server.provider.compose(brief["title"])
            db.execute("UPDATE briefs SET outline = ? WHERE id = ? AND account_id = ?", (outline, brief["id"], account_id))
            db.execute("UPDATE accounts SET credits = credits - 1 WHERE id = ?", (account_id,))
            response = {"brief": {**brief_data(brief), "outline": outline},
                        "credits": session["credits"] - 1, "request_id": key}
            db.execute("INSERT INTO operations VALUES (?, ?, ?, ?)",
                       (account_id, key, brief["id"], json.dumps(response)))
            # Commit on context exit BEFORE the response. This explicit fixture switch
            # tests ambiguous network failure without replaying a committed debit.
            return Result(response, drop_response=self.headers.get("X-Fixture-Drop-Response") == "once")

    def handle_request(self):
        try:
            hosts = {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
            if self.headers.get("Host") not in hosts:
                raise APIError(403, "Use the local server address.")
            origin = self.headers.get("Origin")
            if origin is not None and origin not in {f"http://{host}" for host in hosts}:
                raise APIError(403, "Cross-origin requests are not allowed.")
            path = urlsplit(self.path).path
            assets = {"/": ("index.html", "text/html; charset=utf-8"),
                      "/app.js": ("app.js", "text/javascript; charset=utf-8"),
                      "/style.css": ("style.css", "text/css; charset=utf-8")}
            if path in assets:
                if self.command not in ("GET", "HEAD"):
                    raise APIError(405, "Method not allowed.", "GET, HEAD")
                filename, mime = assets[path]
                return self.respond(200, Path(__file__).with_name(filename).read_bytes(), mime)
            result = self.api(path)
            if result.drop_response:
                self.close_connection = True
                self.connection.shutdown(socket.SHUT_RDWR)
                self.connection.close()
                return
            self.respond(result.status, json.dumps(result.body).encode(), cookie=result.cookie)
        except APIError as exc:
            self.respond(exc.status, json.dumps({"error": str(exc)}).encode(), allow=exc.allow)
        except (ValueError, UnicodeError):
            self.respond(400, b'{"error":"Invalid request."}')
        except (sqlite3.Error, OSError):
            self.respond(500, b'{"error":"Storage is unavailable. Please retry."}')

    do_GET = do_HEAD = do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = handle_request


def create_server(db_path, port=0, provider=None):
    db_path = Path(db_path).expanduser().resolve()
    with closing(sqlite3.connect(db_path)) as db:
        db.executescript("""
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL,
                salt TEXT NOT NULL, password_hash TEXT NOT NULL,
                plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free', 'demo')),
                credits INTEGER NOT NULL DEFAULT 0 CHECK(credits >= 0));
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY, account_id INTEGER NOT NULL,
                csrf TEXT NOT NULL, expires_at REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS briefs (
                id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL,
                title TEXT NOT NULL, outline TEXT);
            CREATE TABLE IF NOT EXISTS operations (
                account_id INTEGER NOT NULL, request_id TEXT NOT NULL,
                brief_id INTEGER NOT NULL, response TEXT NOT NULL,
                PRIMARY KEY(account_id, request_id));
        """)
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.daemon_threads = True
    server.db_path, server.provider = db_path, provider or FakeOutlineProvider()
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True)
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--fail-first-action", action="store_true", help="Inject one temporary fake-provider failure")
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error("--port must be 0 through 65535")
    def stop(_signum, _frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, stop)
    try:
        with create_server(args.db, args.port, FakeOutlineProvider(args.fail_first_action)) as server:
            print(json.dumps({"url": f"http://127.0.0.1:{server.server_port}"}), flush=True)
            server.serve_forever(poll_interval=0.05)
    except KeyboardInterrupt:
        pass
    except (OSError, sqlite3.Error) as exc:
        parser.exit(2, f"Fixture server unavailable: {exc}\n")


if __name__ == "__main__":
    main()
