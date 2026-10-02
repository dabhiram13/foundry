"""SaaS acceptance tests through real HTTP and persistent, isolated SQLite."""

from concurrent.futures import ThreadPoolExecutor
from http.client import HTTPConnection, RemoteDisconnected
import json
import sqlite3
from pathlib import Path
import tempfile
import threading
import unittest

from app import FakeOutlineProvider, create_server


class JourneyTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.db_path = Path(temporary.name) / "journey.sqlite3"
        self.server = None
        self.provider = FakeOutlineProvider()
        self.addCleanup(self.stop_server)
        self.start_server()

    def start_server(self):
        self.server = create_server(self.db_path, 0, self.provider)
        self.thread = threading.Thread(target=self.server.serve_forever,
                                       kwargs={"poll_interval": 0.01}, daemon=True)
        self.thread.start()

    def stop_server(self):
        if self.server is not None:
            self.server.shutdown()
            self.thread.join(timeout=5)
            self.server.server_close()
            self.server = None

    def request(self, method="GET", path="/api/session", body=None, session=None,
                headers=None, raw=None):
        headers = dict(headers or {})
        if session:
            headers.setdefault("Cookie", session["cookie"])
            headers.setdefault("X-CSRF-Token", session["csrf"])
        if body is not None:
            raw = json.dumps(body).encode()
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

    def register(self, email="alice@example.test"):
        status, headers, body = self.request("POST", "/api/register",
                                            {"email": email, "password": "local-fixture-passphrase"})
        self.assertEqual(status, 201, body)
        self.assertIn("HttpOnly", headers["Set-Cookie"])
        self.assertIn("SameSite=Strict", headers["Set-Cookie"])
        return {"cookie": headers["Set-Cookie"].split(";", 1)[0], "csrf": body["csrf"]}

    def save(self, session, title="Launch a workshop"):
        status, _, body = self.request("POST", "/api/briefs", {"title": title}, session)
        self.assertEqual(status, 201, body)
        return body["brief"]

    def upgrade(self, session):
        status, _, body = self.request("POST", "/api/fixture/plan", {"plan": "demo"}, session)
        self.assertEqual(status, 200, body)
        return body

    def outline(self, session, brief, key="outline-1", **kwargs):
        headers = {"Idempotency-Key": key, **kwargs.pop("headers", {})}
        return self.request("POST", f"/api/briefs/{brief['id']}/outline", {}, session,
                            headers=headers, **kwargs)

    def test_session_is_required_and_logout_revokes_it(self):
        for method, path, payload in (("GET", "/api/briefs", None),
                                      ("POST", "/api/briefs", {"title": "Hidden"}),
                                      ("GET", "/api/session", None)):
            self.assertEqual(self.request(method, path, payload)[0], 401)
        session = self.register()
        self.assertEqual(self.request(session=session)[2]["account"]["email"], "alice@example.test")
        self.assertEqual(self.request("POST", "/api/logout", {}, session)[0], 200)
        self.assertEqual(self.request(session=session)[0], 401)

    def test_save_first_value_and_return_after_server_restart(self):
        session = self.register()
        self.assertEqual(self.request(path="/api/briefs", session=session)[2], {"briefs": []})
        brief = self.save(session, "  Café workshop 🌿  ")
        self.assertEqual(brief["title"], "Café workshop 🌿")
        self.upgrade(session)
        status, _, result = self.outline(session, brief)
        self.assertEqual(status, 200, result)
        self.assertIn("Café workshop 🌿", result["brief"]["outline"])
        self.assertEqual(result["credits"], 2)
        self.stop_server()
        self.start_server()
        self.assertEqual(self.request(path="/api/briefs", session=session)[2]["briefs"], [result["brief"]])
        self.assertEqual(self.request(session=session)[2]["account"]["credits"], 2)

    def test_login_rejects_wrong_password_and_duplicate_registration(self):
        self.register()
        for email, password in (("alice@example.test", "wrong-password"),
                                ("nobody@example.test", "local-fixture-passphrase")):
            status, _, body = self.request("POST", "/api/login", {"email": email, "password": password})
            self.assertEqual((status, body["error"]), (401, "Email or password did not match."))
        self.assertEqual(self.request("POST", "/api/register", {
            "email": "ALICE@example.test", "password": "local-fixture-passphrase"})[0], 409)
        status, headers, body = self.request("POST", "/api/login", {
            "email": "ALICE@example.test", "password": "local-fixture-passphrase"})
        self.assertEqual(status, 200)
        self.assertIn("Set-Cookie", headers)
        self.assertTrue(body["csrf"])

    def test_cross_tenant_read_and_mutation_never_reveal_a_brief(self):
        alice, bob = self.register(), self.register("bob@example.test")
        secret = self.save(alice, "Private customer plan")
        self.upgrade(bob)
        self.assertEqual(self.request(path="/api/briefs", session=bob)[2], {"briefs": []})
        for method, suffix, payload in (("GET", "", None), ("POST", "/outline", {})):
            status, _, body = self.request(method, f"/api/briefs/{secret['id']}{suffix}",
                                           payload, bob, {"Idempotency-Key": "steal-attempt"})
            self.assertEqual(status, 404, body)
            self.assertNotIn("Private", json.dumps(body))
        self.assertEqual(self.request(session=bob)[2]["account"]["credits"], 3)
        self.assertIsNone(self.request(path=f"/api/briefs/{secret['id']}", session=alice)[2]["brief"]["outline"])

    def test_free_plan_is_gated_and_repeated_upgrade_does_not_refill(self):
        session = self.register()
        brief = self.save(session)
        self.assertEqual(self.outline(session, brief)[0], 402)
        self.assertEqual(self.request(session=session)[2]["account"]["credits"], 0)
        self.upgrade(session)
        self.assertEqual(self.outline(session, brief)[0], 200)
        self.assertEqual(self.upgrade(session)["account"]["credits"], 2)
        for key in ("outline-2", "outline-3"):
            self.assertEqual(self.outline(session, brief, key)[0], 200)
        self.assertEqual(self.outline(session, brief, "outline-4")[0], 402)
        self.assertEqual(self.request(session=session)[2]["account"]["credits"], 0)

    def test_provider_failure_keeps_balance_and_same_request_can_retry(self):
        session = self.register()
        brief = self.save(session)
        self.upgrade(session)
        self.provider.fail_next()
        status, _, body = self.outline(session, brief)
        self.assertEqual(status, 503, body)
        self.assertEqual(self.request(session=session)[2]["account"]["credits"], 3)
        self.assertIsNone(self.request(path=f"/api/briefs/{brief['id']}", session=session)[2]["brief"]["outline"])
        self.assertEqual(self.outline(session, brief)[0], 200)
        self.assertEqual(self.request(session=session)[2]["account"]["credits"], 2)

    def test_lost_committed_response_can_retry_once_after_restart(self):
        session = self.register()
        brief = self.save(session)
        self.upgrade(session)
        with self.assertRaises(RemoteDisconnected):
            self.outline(session, brief, headers={"X-Fixture-Drop-Response": "once"})
        self.stop_server()
        self.start_server()
        status, _, body = self.outline(session, brief, headers={"X-Fixture-Drop-Response": "once"})
        self.assertEqual(status, 200, body)
        self.assertEqual(body["credits"], 2)
        self.assertEqual(self.request(session=session)[2]["account"]["credits"], 2)

    def test_concurrent_duplicates_debit_once_and_reused_key_conflicts(self):
        session = self.register()
        brief = self.save(session)
        other = self.save(session, "Another workshop")
        self.upgrade(session)
        with ThreadPoolExecutor(max_workers=4) as pool:
            responses = list(pool.map(lambda _: self.outline(session, brief), range(4)))
        self.assertEqual([response[0] for response in responses], [200] * 4)
        self.assertTrue(all(response[2] == responses[0][2] for response in responses))
        self.assertEqual(self.request(session=session)[2]["account"]["credits"], 2)
        self.assertEqual(self.outline(session, other)[0], 409)
        bob = self.register("bob@example.test")
        self.upgrade(bob)
        self.assertEqual(self.outline(bob, self.save(bob))[0], 200)

    def test_csrf_host_and_origin_guards_reject_mutation(self):
        session = self.register()
        for headers in ({"X-CSRF-Token": "wrong"}, {"X-CSRF-Token": "é"}, {"Host": "attacker.example"},
                        {"Origin": "https://attacker.example"}):
            self.assertEqual(self.request("POST", "/api/briefs", {"title": "No"}, session, headers)[0], 403)
        self.assertEqual(self.request(path="/api/briefs", session=session)[2], {"briefs": []})
        origin = f"http://127.0.0.1:{self.server.server_port}"
        self.assertEqual(self.request("POST", "/api/briefs", {"title": "Yes"}, session,
                                      {"Origin": origin})[0], 201)

    def test_malformed_input_has_no_saved_side_effect(self):
        session = self.register()
        for payload in ({}, {"title": ""}, {"title": 1}, {"title": "x" * 201},
                        {"title": "\x00"}, {"title": "\ud800"},
                        {"title": "No", "user_id": 2}, [], None):
            status, _, body = self.request("POST", "/api/briefs", session=session,
                                           raw=json.dumps(payload).encode(),
                                           headers={"Content-Type": "application/json"})
            self.assertEqual(status, 400, body)
        for raw, headers, expected in ((b"{", {"Content-Type": "application/json"}, 400),
                                       (b"\xff", {"Content-Type": "application/json"}, 400),
                                       (b"{}", {"Content-Type": "text/plain"}, 415),
                                       (b"x" * 8193, {"Content-Type": "application/json"}, 413),
                                       (b"{}", {"Content-Type": "application/json", "Content-Length": "-1"}, 400),
                                       (b"0\r\n\r\n", {"Content-Type": "application/json", "Transfer-Encoding": "chunked"}, 400)):
            self.assertEqual(self.request("POST", "/api/briefs", session=session,
                                          raw=raw, headers=headers)[0], expected)
        self.assertEqual(self.request(path="/api/briefs", session=session)[2], {"briefs": []})

    def test_invalid_idempotency_keys_and_wrong_routes(self):
        session = self.register()
        brief = self.save(session)
        self.upgrade(session)
        for key in ("", "has spaces", "x" * 81):
            self.assertEqual(self.outline(session, brief, key)[0], 400)
        self.assertEqual(self.request("PUT", "/api/briefs", {}, session)[0], 405)
        for path in ("/app.py", "/../app.py", "/api/briefs/nope", "/api/briefs/99999999999999999999999999"):
            self.assertEqual(self.request(path=path, session=session)[0], 404)
        self.assertEqual(self.request(session=session)[2]["account"]["credits"], 3)

    def test_activation_rolls_back_when_operation_commit_fails(self):
        session = self.register()
        brief = self.save(session)
        self.upgrade(session)
        with sqlite3.connect(self.db_path) as db:
            db.execute("CREATE TRIGGER reject_operation BEFORE INSERT ON operations "
                       "BEGIN SELECT RAISE(ABORT, 'fixture storage failure'); END")
        self.assertEqual(self.outline(session, brief)[0], 500)
        self.assertEqual(self.request(path="/api/activation", session=session)[2]["count"], 0)
        self.assertEqual(self.request(session=session)[2]["account"]["credits"], 3)
        self.assertIsNone(self.request(path=f"/api/briefs/{brief['id']}", session=session)[2]["brief"]["outline"])
        with sqlite3.connect(self.db_path) as db:
            db.execute("DROP TRIGGER reject_operation")
        self.assertEqual(self.outline(session, brief)[0], 200)
        self.assertEqual(self.request(path="/api/activation", session=session)[2]["count"], 1)

    def test_activation_commits_once_across_failure_retry_restart_and_tenants(self):
        def activation(session):
            status, _, body = self.request(path="/api/activation", session=session)
            self.assertEqual(status, 200)
            self.assertEqual(set(body), {"event", "count"})
            self.assertEqual(body["event"], "first_outline_saved")
            return body["count"]
        self.assertEqual(self.request(path="/api/activation")[0], 401)
        alice, bob = self.register(), self.register("bob@example.test")
        brief = self.save(alice)
        self.assertEqual(activation(alice), 0)
        self.assertEqual(self.outline(alice, brief)[0], 402)
        self.upgrade(alice)
        self.provider.fail_next()
        self.assertEqual(self.outline(alice, brief)[0], 503)
        self.assertEqual(activation(alice), 0)
        with self.assertRaises(RemoteDisconnected):
            self.outline(alice, brief, headers={"X-Fixture-Drop-Response": "once"})
        self.stop_server()
        self.start_server()
        with ThreadPoolExecutor(max_workers=4) as pool:
            responses = list(pool.map(lambda _: self.outline(alice, brief), range(4)))
        self.assertEqual([response[0] for response in responses], [200] * 4)
        self.assertEqual(activation(alice), 1)
        self.assertEqual(activation(bob), 0)
        self.assertEqual(self.outline(alice, brief, "another-outline")[0], 200)
        self.assertEqual(activation(alice), 1)
        self.upgrade(bob)
        self.assertEqual(self.outline(bob, self.save(bob))[0], 200)
        self.assertEqual(activation(bob), 1)

    def test_html_has_basic_semantics_and_security_headers(self):
        status, headers, html = self.request(path="/")
        self.assertEqual(status, 200)
        self.assertIn(b'<html lang="en">', html)
        self.assertIn(b'<main id="main"', html)
        self.assertIn(b'role="alert"', html)
        self.assertIn("default-src 'self'", headers["Content-Security-Policy"])
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertEqual(self.server.server_address[0], "127.0.0.1")


if __name__ == "__main__":
    unittest.main()
