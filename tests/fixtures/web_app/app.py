"""A loopback-only test web app using the Python standard library."""

import argparse
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import sqlite3
from urllib.parse import urlsplit


class APIError(Exception):
    def __init__(self, status, message, allow=None):
        super().__init__(message)
        self.status = status
        self.allow = allow


def idea(row):
    return {"id": row[0], "title": row[1], "done": bool(row[2])}


class Handler(BaseHTTPRequestHandler):
    def respond(self, status, body, content_type="application/json; charset=utf-8", allow=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if allow:
            self.send_header("Allow", allow)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def read_json(self):
        if self.headers.get_content_type() != "application/json":
            raise APIError(415, "Send JSON with Content-Type: application/json.")
        if self.headers.get("Transfer-Encoding"):
            raise APIError(400, "Use Content-Length instead of Transfer-Encoding.")
        lengths = self.headers.get_all("Content-Length", [])
        if not lengths:
            raise APIError(411, "Content-Length is required.")
        if len(lengths) != 1 or not re.fullmatch(r"[0-9]+", lengths[0]):
            raise APIError(400, "Invalid Content-Length.")
        if len(lengths[0]) > 5 or int(lengths[0]) > 8192:
            raise APIError(413, "JSON body must be at most 8192 bytes.")
        self.connection.settimeout(5)
        try:
            payload = json.loads(self.rfile.read(int(lengths[0])).decode("utf-8"))
        except TimeoutError:
            raise APIError(408, "Timed out reading the request.") from None
        except (ValueError, UnicodeError, RecursionError):
            raise APIError(400, "Send a valid JSON object.") from None
        if not isinstance(payload, dict):
            raise APIError(400, "Send a JSON object.")
        return payload

    def api(self, path):
        collection = path == "/api/ideas"
        match = re.fullmatch(r"/api/ideas/([1-9][0-9]{0,18})", path)
        if not collection and not match:
            raise APIError(404, "Resource not found.")
        idea_id = int(match[1]) if match else None
        if idea_id is not None and idea_id > 2**63 - 1:
            raise APIError(404, "Idea not found.")
        allowed = ("GET", "POST") if collection else ("PATCH", "DELETE")
        if self.command not in allowed:
            raise APIError(405, "Method not allowed.", ", ".join(allowed))

        payload = self.read_json() if self.command in ("POST", "PATCH") else None
        if self.command == "POST":
            if set(payload) != {"title"} or not isinstance(payload["title"], str):
                raise APIError(400, "Provide a title as a string.")
            title = payload["title"].strip()
            if not 1 <= len(title) <= 200:
                raise APIError(400, "Title must contain 1 to 200 characters.")
            if "\x00" in title:
                raise APIError(400, "Title cannot contain NUL characters.")
            try:
                title.encode("utf-8")
            except UnicodeError:
                raise APIError(400, "Title must contain valid Unicode.") from None
        if self.command == "PATCH" and (set(payload) != {"done"} or type(payload["done"]) is not bool):
            raise APIError(400, "Provide done as true or false.")

        # Each request closes its connection; the transaction commits before responding.
        with closing(sqlite3.connect(self.server.db_path)) as db, db:
            if self.command == "GET":
                rows = db.execute("SELECT id, title, done FROM ideas ORDER BY id DESC")
                return 200, {"ideas": [idea(row) for row in rows]}
            if self.command == "POST":
                cursor = db.execute("INSERT INTO ideas (title) VALUES (?)", (title,))
                return 201, {"id": cursor.lastrowid, "title": title, "done": False}
            if self.command == "PATCH":
                cursor = db.execute("UPDATE ideas SET done = ? WHERE id = ?", (payload["done"], idea_id))
                if cursor.rowcount == 0:
                    raise APIError(404, "Idea not found.")
                row = db.execute("SELECT id, title, done FROM ideas WHERE id = ?", (idea_id,)).fetchone()
                return 200, idea(row)
            cursor = db.execute("DELETE FROM ideas WHERE id = ?", (idea_id,))
            if cursor.rowcount == 0:
                raise APIError(404, "Idea not found.")
            return 204, None

    def handle_request(self):
        allow = None
        try:
            port = self.server.server_port
            hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
            if self.headers.get("Host") not in hosts:
                raise APIError(403, "Use the local server address.")
            origin = self.headers.get("Origin")
            if origin is not None and origin not in {f"http://{host}" for host in hosts}:
                raise APIError(403, "Cross-origin requests are not allowed.")
            path = urlsplit(self.path).path
            if path == "/":
                if self.command not in ("GET", "HEAD"):
                    raise APIError(405, "Method not allowed.", "GET, HEAD")
                self.respond(200, Path(__file__).with_name("index.html").read_bytes(), "text/html; charset=utf-8")
                return
            status, payload = self.api(path)
        except APIError as exc:
            status, payload, allow = exc.status, {"error": str(exc)}, exc.allow
        except ValueError:
            status, payload = 400, {"error": "Invalid request URL."}
        except (sqlite3.Error, OSError) as exc:
            self.log_error("Storage error: %s", exc)
            status, payload = 500, {"error": "Could not load or save ideas. Please retry."}
        body = b"" if status == 204 else json.dumps(payload).encode("utf-8")
        self.respond(status, body, allow=allow)

    do_GET = do_HEAD = do_POST = do_PATCH = do_DELETE = do_PUT = do_OPTIONS = handle_request


def create_server(db_path, port=0):
    """Initialize a disk database and bind only to IPv4 loopback."""
    db_path = Path(db_path).expanduser().resolve()
    with closing(sqlite3.connect(db_path)) as db, db:
        db.execute("""CREATE TABLE IF NOT EXISTS ideas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
            done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0, 1))
        )""")
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.db_path = db_path
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True, help="SQLite file path (parent directory must exist)")
    parser.add_argument("--port", required=True, type=int, help="Local port; 0 selects a free port")
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error("--port must be between 0 and 65535")
    try:
        server = create_server(args.db, args.port)
    except (OSError, sqlite3.Error) as exc:
        parser.error(f"Cannot start the test web app: {exc}")
    with server:
        print(f"Test web app: http://127.0.0.1:{server.server_port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
