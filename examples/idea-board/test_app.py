"""Behavior checks against real HTTP requests and isolated, on-disk SQLite."""

from http.client import HTTPConnection
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest

from app import create_server


class IdeaBoardTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.db_path = Path(temporary.name) / "ideas.sqlite3"
        self.server = None
        self.addCleanup(self.stop_server)
        self.start_server()

    def start_server(self):
        self.server = create_server(self.db_path, 0)
        self.thread = threading.Thread(target=self.server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
        self.thread.start()

    def stop_server(self):
        if self.server is not None:
            self.server.shutdown()
            self.thread.join(timeout=5)
            self.server.server_close()
            self.server = None

    def request(self, method="GET", path="/api/ideas", body=None, raw=None, headers=None):
        headers = dict(headers or {})
        if body is not None:
            raw = json.dumps(body).encode("utf-8")
            headers.setdefault("Content-Type", "application/json")
        connection = HTTPConnection(*self.server.server_address, timeout=5)
        try:
            connection.request(method, path, body=raw, headers=headers)
            response = connection.getresponse()
            data = response.read()
            if data and response.getheader("Content-Type", "").startswith("application/json"):
                data = json.loads(data)
            return response.status, dict(response.getheaders()), data
        finally:
            connection.close()

    def create(self, title="Pocket garden planner"):
        status, _, result = self.request("POST", body={"title": title})
        self.assertEqual(status, 201, result)
        return result

    def test_create_list_and_trim_titles(self):
        self.assertEqual(self.request()[2], {"ideas": []})
        first = self.create("  Pocket garden planner  ")
        second = self.create("Café ideas 🌱")
        self.assertEqual(first, {"id": first["id"], "title": "Pocket garden planner", "done": False})
        self.assertIsInstance(first["id"], int)
        self.assertGreater(second["id"], first["id"])
        status, _, result = self.request()
        self.assertEqual(status, 200)
        self.assertEqual(result, {"ideas": [second, first]})

    def test_persistence_across_server_restart(self):
        saved = self.create()
        status, _, updated = self.request("PATCH", f"/api/ideas/{saved['id']}", {"done": True})
        self.assertEqual(status, 200)
        self.stop_server()
        self.start_server()
        self.assertEqual(self.request()[2], {"ideas": [updated]})
        self.assertTrue(updated["done"])

    def test_update_and_delete(self):
        saved = self.create()
        path = f"/api/ideas/{saved['id']}"
        for done in (True, False):
            status, _, result = self.request("PATCH", path, {"done": done})
            self.assertEqual(status, 200)
            self.assertEqual(result, {**saved, "done": done})
            self.assertEqual(self.request()[2]["ideas"], [result])
        status, _, body = self.request("DELETE", path)
        self.assertEqual((status, body), (204, b""))
        self.stop_server()
        self.start_server()
        self.assertEqual(self.request()[2], {"ideas": []})
        self.assertGreater(self.create()["id"], saved["id"])

    def test_title_validation_has_no_side_effects(self):
        for body in ({}, {"title": None}, {"title": False}, {"title": 42}, {"title": []},
                     {"title": ""}, {"title": " \t\n"}, {"title": "x" * 201},
                     {"title": "\x00"}, {"title": "\ud800"}, {"title": "Valid", "done": True}):
            with self.subTest(body=body):
                status, _, result = self.request("POST", body=body)
                self.assertEqual(status, 400, result)
                self.assertTrue(result["error"])
        self.assertEqual(self.request()[2], {"ideas": []})
        self.assertEqual(self.create("x" * 200)["title"], "x" * 200)

    def test_malformed_json_and_non_object_bodies(self):
        for raw in (b"", b"{", b'{"title":"cut off"', b"null", b"[]", b'"title"', b"true", b"\xff"):
            with self.subTest(raw=raw):
                status, _, result = self.request("POST", raw=raw, headers={"Content-Type": "application/json"})
                self.assertEqual(status, 400, result)
                self.assertIn("error", result)
        self.assertEqual(self.request()[2], {"ideas": []})

    def test_content_type_and_body_limits(self):
        for headers, raw, expected in (
            ({"Content-Type": "text/plain"}, b'{"title":"Nope"}', 415),
            ({"Content-Type": "application/json"}, b"x" * 8193, 413),
            ({"Content-Type": "application/json", "Content-Length": "bad"}, b"{}", 400),
            ({"Content-Type": "application/json", "Content-Length": "-1"}, b"{}", 400),
            ({"Content-Type": "application/json", "Transfer-Encoding": "chunked"}, b"0\r\n\r\n", 400),
        ):
            with self.subTest(headers=headers):
                status, _, result = self.request("POST", raw=raw, headers=headers)
                self.assertEqual(status, expected, result)
                self.assertIn("error", result)
        self.assertEqual(self.request()[2], {"ideas": []})

    def test_update_requires_a_boolean_and_preserves_existing_idea(self):
        saved = self.create()
        path = f"/api/ideas/{saved['id']}"
        for body in ({}, {"done": 1}, {"done": "true"}, {"done": None}, {"done": True, "title": "new"}):
            with self.subTest(body=body):
                self.assertEqual(self.request("PATCH", path, body)[0], 400)
        self.assertEqual(self.request()[2], {"ideas": [saved]})

    def test_missing_and_invalid_ids(self):
        saved = self.create()
        for missing in ("9999", "abc", "0", "-1", str(2**63), "9" * 50):
            for method in ("PATCH", "DELETE"):
                with self.subTest(missing=missing, method=method):
                    status, _, result = self.request(method, f"/api/ideas/{missing}", {"done": True} if method == "PATCH" else None)
                    self.assertEqual(status, 404, result)
                    self.assertIn("error", result)
        self.assertEqual(self.request()[2], {"ideas": [saved]})

    def test_routes_and_methods(self):
        for path in ("/missing", "/app.py", "/../app.py", "/api/nope"):
            self.assertEqual(self.request(path=path)[0], 404)
        status, headers, body = self.request("PUT", body={"title": "No"})
        self.assertEqual(status, 405)
        self.assertEqual(headers["Allow"], "GET, POST")
        self.assertIn("error", body)
        self.assertEqual(self.request()[2], {"ideas": []})

    def test_loopback_and_cross_origin_rejection(self):
        self.assertEqual(self.server.server_address[0], "127.0.0.1")
        self.assertGreater(self.server.server_port, 0)
        for headers in ({"Host": "untrusted.example"}, {"Origin": "https://untrusted.example"}):
            with self.subTest(headers=headers):
                self.assertEqual(self.request("POST", body={"title": "No"}, headers=headers)[0], 403)
        self.assertEqual(self.request()[2], {"ideas": []})
        origin = f"http://127.0.0.1:{self.server.server_port}"
        self.assertEqual(self.request("POST", body={"title": "Local"}, headers={"Origin": origin})[0], 201)

    def test_homepage_and_head(self):
        status, headers, body = self.request(path="/")
        self.assertEqual(status, 200)
        self.assertIn("text/html", headers["Content-Type"])
        self.assertIn(b'<title>Idea board</title>', body)
        status, headers, head_body = self.request("HEAD", "/")
        self.assertEqual((status, head_body), (200, b""))
        self.assertEqual(int(headers["Content-Length"]), len(body))

    def test_cli_requires_explicit_db_and_port(self):
        app = str(Path(__file__).with_name("app.py"))
        for args in ([], ["--db", str(self.db_path)], ["--port", "0"],
                     ["--db", str(self.db_path), "--port", "-1"],
                     ["--db", str(self.db_path), "--port", "65536"]):
            with self.subTest(args=args):
                result = subprocess.run([sys.executable, app, *args], capture_output=True, text=True, timeout=5)
                self.assertEqual(result.returncode, 2)
                self.assertIn("error:", result.stderr)


if __name__ == "__main__":
    unittest.main()
