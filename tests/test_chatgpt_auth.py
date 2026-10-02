from __future__ import annotations

import datetime as dt
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("chatgpt_auth", ROOT / "scripts/chatgpt_auth.py")
assert SPEC and SPEC.loader
auth = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(auth)


class ChatGPTAuthTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.state_dir = Path(self.temp.name) / "state"
        self.credentials = None

    def credential_patches(self):
        return (
            mock.patch.object(auth, "_credential_read", side_effect=lambda _root: self.credentials),
            mock.patch.object(auth, "_credential_write", side_effect=lambda _root, value: setattr(self, "credentials", value)),
            mock.patch.object(auth, "_credential_delete", side_effect=lambda _root: setattr(self, "credentials", None)),
        )

    def test_sign_in_persists_only_public_metadata_and_lists_visible_models(self):
        captured = {}

        def callback(parameters, expected_state):
            captured.update(parameters)
            return {"state": expected_state, "code": "code", "client_id": "oaiapp_issued",
                    "redirect_uri": "http://127.0.0.1:43210/auth/callback"}

        def request(url, *, form=None, bearer=None):
            if url == auth.TOKEN_URL:
                self.assertEqual(form["client_id"], "oaiapp_issued")
                self.assertNotEqual(form["code_verifier"], captured["code_challenge"])
                return {"access_token": "access-secret", "refresh_token": "refresh-secret",
                        "id_token": "id-secret", "expires_in": 3600,
                        "scope": auth.SCOPES}
            if url == auth.MODELS_URL:
                self.assertEqual(bearer, "access-secret")
                return {"models": [
                    {"slug": "gpt-visible", "display_name": "Visible", "visibility": "list"},
                    {"slug": "hidden", "display_name": "Hidden", "visibility": "hidden"},
                ]}
            self.fail(url)

        read, write, delete = self.credential_patches()
        with read, write, delete, mock.patch.object(auth, "_browser_callback", side_effect=callback), \
             mock.patch.object(auth, "_request_json", side_effect=request), \
             mock.patch.object(auth, "_verify_id_token", return_value={
                 "sub": "account-1", "email": "owner@example.test", "name": "Owner",
                 "iss": "https://auth.openai.com",
             }):
            result = auth.sign_in(self.state_dir)

        self.assertTrue(result["connected"])
        self.assertTrue(result["sharing"])
        self.assertEqual(result["models"], [])
        with read, write, delete, mock.patch.object(auth, "_request_json", side_effect=request):
            self.assertEqual(auth.models(self.state_dir),
                             [{"slug": "gpt-visible", "display_name": "Visible"}])
        self.assertEqual(captured["client_id"], "dynamic_agent_client")
        self.assertTrue(captured["ext_agent_host_id"].startswith("urn:uuid:"))
        disk = (self.state_dir / auth.STATE_FILE).read_text()
        for secret in ("access-secret", "refresh-secret", "id-secret"):
            self.assertNotIn(secret, disk)
        self.assertEqual(json.loads(disk)["registration"]["account"]["subject"], "account-1")

    def test_access_token_refreshes_once_under_lock_and_rotates_refresh_token(self):
        self.state_dir.mkdir()
        auth._write_state(self.state_dir, {
            "version": 1, "host_id": "urn:uuid:00000000-0000-4000-8000-000000000001",
            "registration": {"client_id": "oaiapp_issued", "connected": True,
                             "scopes": ["chatgpt.tokens.use.direct"],
                             "account": {"subject": "account-1"}},
        })
        self.credentials = {
            "client_id": "oaiapp_issued", "subject": "account-1",
            "access_token": "expired", "refresh_token": "refresh-old", "id_token": "id",
            "expires_at": (dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=1)).isoformat(),
            "scopes": ["chatgpt.tokens.use.direct"],
        }
        read, write, delete = self.credential_patches()
        with read, write, delete, mock.patch.object(auth, "_request_json", return_value={
            "access_token": "fresh", "refresh_token": "refresh-new", "expires_in": 3600,
            "scope": "openid chatgpt.tokens.use.direct",
        }) as request:
            self.assertEqual(auth.access_token(self.state_dir), "fresh")
        request.assert_called_once()
        self.assertEqual(self.credentials["refresh_token"], "refresh-new")

    def test_sign_out_clears_local_credentials_when_revocation_fails(self):
        self.state_dir.mkdir()
        auth._write_state(self.state_dir, {
            "version": 1, "host_id": "urn:uuid:00000000-0000-4000-8000-000000000001",
            "registration": {"client_id": "oaiapp_issued", "connected": True,
                             "scopes": ["chatgpt.tokens.use.direct"],
                             "account": {"subject": "account-1"}},
        })
        self.credentials = {"client_id": "oaiapp_issued", "subject": "account-1",
                            "refresh_token": "refresh-secret"}
        read, write, delete = self.credential_patches()
        with read, write, delete, mock.patch.object(auth, "_request_json", side_effect=auth.AuthError("offline")):
            result = auth.sign_out(self.state_dir)
        self.assertFalse(result["connected"])
        self.assertFalse(result["revocation_confirmed"])
        self.assertIsNone(self.credentials)
        state = auth._read_state(self.state_dir)
        self.assertNotIn("registration", state)
        self.assertEqual(state["host_id"], "urn:uuid:00000000-0000-4000-8000-000000000001")

    def test_sign_out_allows_a_different_account_to_sign_in(self):
        host_id = "urn:uuid:00000000-0000-4000-8000-000000000001"
        self.state_dir.mkdir()
        auth._write_state(self.state_dir, {
            "version": 1, "host_id": host_id,
            "registration": {"client_id": "oaiapp_account_a", "connected": True,
                             "scopes": ["chatgpt.tokens.use.direct"],
                             "account": {"subject": "account-a"}},
        })
        self.credentials = {"client_id": "oaiapp_account_a", "subject": "account-a",
                            "refresh_token": "refresh-a"}
        captured = {}

        def callback(parameters, expected_state):
            captured.update(parameters)
            return {"state": expected_state, "code": "code-b", "client_id": "oaiapp_account_b",
                    "redirect_uri": "http://127.0.0.1:43210/auth/callback"}

        def request(url, *, form=None, bearer=None):
            if url == auth.DISCOVERY_URL:
                return {"revocation_endpoint": "https://auth.openai.com/revoke"}
            if url == "https://auth.openai.com/revoke":
                return {}
            if url == auth.TOKEN_URL:
                self.assertEqual(form["client_id"], "oaiapp_account_b")
                return {"access_token": "access-b", "refresh_token": "refresh-b",
                        "id_token": "id-b", "expires_in": 3600, "scope": auth.SCOPES}
            self.fail(url)

        read, write, delete = self.credential_patches()
        with read, write, delete, mock.patch.object(auth, "_request_json", side_effect=request):
            signed_out = auth.sign_out(self.state_dir)
        self.assertFalse(signed_out["connected"])
        self.assertNotIn("registration", auth._read_state(self.state_dir))

        read, write, delete = self.credential_patches()
        with read, write, delete, mock.patch.object(auth, "_browser_callback", side_effect=callback), \
             mock.patch.object(auth, "_request_json", side_effect=request), \
             mock.patch.object(auth, "_verify_id_token", return_value={
                 "sub": "account-b", "email": "b@example.test", "name": "Owner B",
                 "iss": "https://auth.openai.com",
             }):
            signed_in = auth.sign_in(self.state_dir)

        self.assertEqual(captured["client_id"], "dynamic_agent_client")
        self.assertTrue(signed_in["connected"])
        self.assertEqual(signed_in["account"]["subject"], "account-b")
        state = auth._read_state(self.state_dir)
        self.assertEqual(state["host_id"], host_id)
        self.assertEqual(state["registration"]["client_id"], "oaiapp_account_b")

    def test_issued_client_id_survives_failed_code_exchange(self):
        read, write, delete = self.credential_patches()
        callback = {"code": "expired", "client_id": "oaiapp_keep",
                    "redirect_uri": "http://127.0.0.1:43210/auth/callback"}
        with read, write, delete, \
             mock.patch.object(auth, "_browser_callback", return_value=callback), \
             mock.patch.object(auth, "_request_json", side_effect=auth.AuthError("invalid grant")):
            with self.assertRaises(auth.AuthError):
                auth.sign_in(self.state_dir)
        registration = auth._read_state(self.state_dir)["registration"]
        self.assertEqual(registration["client_id"], "oaiapp_keep")
        self.assertFalse(registration["connected"])

    def test_id_token_signature_and_claims_are_verified(self):
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key()))
        jwk.update({"kid": "key-1", "alg": "RS256", "use": "sig"})
        now = int(dt.datetime.now(dt.timezone.utc).timestamp())
        claims = {"sub": "account-1", "iss": "https://auth.openai.com",
                  "aud": "oaiapp_issued", "exp": now + 300, "iat": now,
                  "nonce": "expected", "email": "owner@example.test"}
        encoded = jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "key-1"})
        responses = [
            {"issuer": "https://auth.openai.com", "jwks_uri": "https://auth.openai.com/jwks"},
            {"keys": [jwk]},
        ]
        with mock.patch.object(auth, "_request_json", side_effect=responses):
            verified = auth._verify_id_token(encoded, client_id="oaiapp_issued", nonce="expected")
        self.assertEqual(verified["sub"], "account-1")

        responses = [
            {"issuer": "https://auth.openai.com", "jwks_uri": "https://auth.openai.com/jwks"},
            {"keys": [jwk]},
        ]
        with mock.patch.object(auth, "_request_json", side_effect=responses):
            with self.assertRaisesRegex(auth.AuthError, "nonce"):
                auth._verify_id_token(encoded, client_id="oaiapp_issued", nonce="different")

    def test_secure_backend_unavailable_fails_closed(self):
        with mock.patch.object(auth.sys, "platform", "linux"):
            with self.assertRaisesRegex(auth.AuthError, "Secure"):
                auth._security()

    def test_keychain_write_supplies_confirmation_and_verifies_round_trip(self):
        value = {"access_token": "secret", "refresh_token": "rotate"}
        completed = mock.Mock(returncode=0)
        with mock.patch.object(auth, "_security", return_value="/usr/bin/security"), \
             mock.patch.object(auth.subprocess, "run", return_value=completed) as run, \
             mock.patch.object(auth, "_credential_read", return_value=value):
            auth._credential_write(self.state_dir, value)
        sent = run.call_args.kwargs["input"]
        line = json.dumps(value, separators=(",", ":")) + "\n"
        self.assertEqual(sent, line + line)

    def test_keychain_write_fails_closed_on_bad_round_trip(self):
        completed = mock.Mock(returncode=0)
        with mock.patch.object(auth, "_security", return_value="/usr/bin/security"), \
             mock.patch.object(auth.subprocess, "run", return_value=completed), \
             mock.patch.object(auth, "_credential_read", return_value={}), \
             mock.patch.object(auth, "_credential_delete") as delete:
            with self.assertRaisesRegex(auth.AuthError, "did not preserve"):
                auth._credential_write(self.state_dir, {"access_token": "secret"})
        delete.assert_called_once_with(self.state_dir)

    def test_status_does_not_claim_connected_without_credentials(self):
        self.state_dir.mkdir()
        auth._write_state(self.state_dir, {
            "version": 1,
            "registration": {"client_id": "oaiapp_issued", "connected": True,
                             "scopes": ["chatgpt.tokens.use.direct"],
                             "account": {"subject": "account-1"}},
        })
        with mock.patch.object(auth, "_credential_read", return_value=None):
            result = auth.status(self.state_dir)
        self.assertFalse(result["connected"])
        self.assertFalse(result["sharing"])
        self.assertEqual(result["models"], [])

    def test_tampered_public_identity_or_client_is_disconnected(self):
        self.state_dir.mkdir()
        auth._write_state(self.state_dir, {
            "version": 1,
            "registration": {"client_id": "oaiapp_tampered", "connected": True,
                             "scopes": ["chatgpt.tokens.use.direct"],
                             "account": {"subject": "wrong-account", "email": "wrong@example.test"}},
        })
        secure = {"client_id": "oaiapp_secure", "subject": "account-1",
                  "access_token": "access", "refresh_token": "refresh", "id_token": "id",
                  "expires_at": (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=1)).isoformat(),
                  "scopes": ["chatgpt.tokens.use.direct"]}
        with mock.patch.object(auth, "_credential_read", return_value=secure):
            result = auth.status(self.state_dir)
            with self.assertRaisesRegex(auth.AuthError, "does not match"):
                auth.access_token(self.state_dir)
        self.assertFalse(result["connected"])
        self.assertFalse(result["sharing"])
        self.assertTrue(result["reauthorization_required"])

    def test_status_derives_sharing_from_secure_scopes(self):
        self.state_dir.mkdir()
        auth._write_state(self.state_dir, {
            "version": 1,
            "registration": {"client_id": "oaiapp_issued", "connected": True,
                             "scopes": ["chatgpt.tokens.use.direct"],
                             "account": {"subject": "account-1"}},
        })
        secure = {"client_id": "oaiapp_issued", "subject": "account-1", "scopes": ["openid"]}
        with mock.patch.object(auth, "_credential_read", return_value=secure):
            result = auth.status(self.state_dir)
        self.assertTrue(result["connected"])
        self.assertFalse(result["sharing"])


if __name__ == "__main__":
    unittest.main()
