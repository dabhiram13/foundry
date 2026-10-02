#!/usr/bin/env python3
"""Local Sign in with ChatGPT bridge.

OAuth credentials stay in the macOS Keychain.  The state directory contains
only the stable host ID and public connection metadata.
"""
from __future__ import annotations

import argparse
import base64
import contextlib
import datetime as dt
import fcntl
import hashlib
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen
import uuid
import webbrowser


AUTHORIZE_URL = "https://auth.openai.com/api/accounts/authorize"
TOKEN_URL = "https://auth.openai.com/api/accounts/oauth/token"
DISCOVERY_URL = "https://auth.openai.com/.well-known/openid-configuration"
RESOURCE = "https://api.openai.com/v1"
MODELS_URL = f"{RESOURCE}/models"
SCOPES = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct"
KEYCHAIN_SERVICE = "com.marketcraft.foundry.chatgpt"
STATE_FILE = "chatgpt-auth.json"
LOCK_FILE = "chatgpt-auth.lock"
CALLBACK_PATH = "/auth/callback"
APP_NAME = "Foundry"
MAX_RESPONSE_BYTES = 2 * 1024 * 1024


class AuthError(RuntimeError):
    """A safe-to-display authentication failure."""


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _iso(value: dt.datetime) -> str:
    return value.astimezone(dt.timezone.utc).isoformat()


def _state_root(state_dir: str | os.PathLike[str], *, create: bool) -> Path:
    root = Path(state_dir).expanduser().resolve()
    if create:
        root.mkdir(parents=True, exist_ok=True, mode=0o700)
        try:
            root.chmod(0o700)
        except OSError as exc:
            raise AuthError("Cannot protect the ChatGPT state directory") from exc
    return root


def _state_path(state_dir: str | os.PathLike[str]) -> Path:
    return _state_root(state_dir, create=False) / STATE_FILE


def _read_state(state_dir: str | os.PathLike[str]) -> dict[str, Any]:
    path = _state_path(state_dir)
    if not path.exists():
        return {"version": 1}
    if path.is_symlink():
        raise AuthError("ChatGPT state must not be a symbolic link")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise AuthError("Cannot read ChatGPT connection metadata") from exc
    if not isinstance(value, dict) or value.get("version") != 1:
        raise AuthError("Unsupported ChatGPT connection metadata")
    return value


def _write_state(state_dir: str | os.PathLike[str], value: dict[str, Any]) -> None:
    root = _state_root(state_dir, create=True)
    path = root / STATE_FILE
    if path.is_symlink():
        raise AuthError("ChatGPT state must not be a symbolic link")
    fd, temporary = tempfile.mkstemp(prefix=".chatgpt-auth-", dir=root)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        with contextlib.suppress(FileNotFoundError):
            os.unlink(temporary)


@contextlib.contextmanager
def _lock(state_dir: str | os.PathLike[str]):
    root = _state_root(state_dir, create=True)
    fd = os.open(root / LOCK_FILE, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        os.close(fd)


def _keychain_account(state_dir: str | os.PathLike[str]) -> str:
    canonical = str(_state_root(state_dir, create=False))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _security() -> str:
    executable = shutil.which("security") if sys.platform == "darwin" else None
    if not executable:
        raise AuthError("Secure ChatGPT credential storage is unavailable on this host")
    return executable


def _credential_read(state_dir: str | os.PathLike[str]) -> dict[str, Any] | None:
    result = subprocess.run(
        [_security(), "find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", _keychain_account(state_dir), "-w"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode == 44:
        return None
    if result.returncode != 0:
        raise AuthError("Cannot read ChatGPT credentials from the macOS Keychain")
    try:
        value = json.loads(result.stdout)
    except ValueError as exc:
        raise AuthError("Stored ChatGPT credentials are invalid") from exc
    if not isinstance(value, dict):
        raise AuthError("Stored ChatGPT credentials are invalid")
    return value


def _credential_write(state_dir: str | os.PathLike[str], value: dict[str, Any]) -> None:
    # Passing -w last makes `security` read the password from stdin, keeping the
    # serialized tokens out of argv and process listings. macOS prompts twice
    # when -w has no value; a single line may still return success while storing
    # an empty password, so supply the same line twice and verify the round trip.
    payload = json.dumps(value, separators=(",", ":")) + "\n"
    result = subprocess.run(
        [_security(), "add-generic-password", "-U", "-s", KEYCHAIN_SERVICE,
         "-a", _keychain_account(state_dir), "-w"],
        input=payload + payload,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise AuthError("Cannot save ChatGPT credentials in the macOS Keychain")
    try:
        saved = _credential_read(state_dir)
    except AuthError:
        with contextlib.suppress(AuthError):
            _credential_delete(state_dir)
        raise
    if saved != value:
        with contextlib.suppress(AuthError):
            _credential_delete(state_dir)
        raise AuthError("macOS Keychain did not preserve ChatGPT credentials")


def _credential_delete(state_dir: str | os.PathLike[str]) -> None:
    result = subprocess.run(
        [_security(), "delete-generic-password", "-s", KEYCHAIN_SERVICE,
         "-a", _keychain_account(state_dir)],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode not in (0, 44):
        raise AuthError("Cannot remove ChatGPT credentials from the macOS Keychain")


def _request_json(url: str, *, form: dict[str, str] | None = None,
                  bearer: str | None = None) -> dict[str, Any]:
    headers = {"Accept": "application/json", "User-Agent": "Foundry/1 ChatGPT-auth"}
    data = None
    if form is not None:
        data = urlencode(form).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"
    try:
        with urlopen(Request(url, data=data, headers=headers), timeout=30) as response:
            raw = response.read(MAX_RESPONSE_BYTES + 1)
    except HTTPError as exc:
        raise AuthError(f"ChatGPT service rejected the request (HTTP {exc.code})") from exc
    except (URLError, TimeoutError, OSError) as exc:
        raise AuthError("Cannot reach the ChatGPT authentication service") from exc
    if len(raw) > MAX_RESPONSE_BYTES:
        raise AuthError("ChatGPT service returned an oversized response")
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except ValueError as exc:
        raise AuthError("ChatGPT service returned an invalid response") from exc
    if not isinstance(value, dict):
        raise AuthError("ChatGPT service returned an invalid response")
    return value


def _trusted_auth_url(value: Any) -> str:
    if not isinstance(value, str):
        raise AuthError("OpenAI identity configuration is invalid")
    parsed = urlparse(value)
    if parsed.scheme != "https" or parsed.hostname != "auth.openai.com" or parsed.username or parsed.password:
        raise AuthError("OpenAI identity endpoint is outside the trusted origin")
    return value


def _pkce() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


def _browser_callback(parameters: dict[str, str], expected_state: str,
                      timeout_seconds: int = 300) -> dict[str, str]:
    result: dict[str, str] = {}

    class CallbackHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
            parsed = urlparse(self.path)
            if parsed.path != CALLBACK_PATH:
                self.send_response(404)
                self.end_headers()
                return
            query = parse_qs(parsed.query, keep_blank_values=True)
            for key, values in query.items():
                if values:
                    result[key] = values[0]
            valid = secrets.compare_digest(result.get("state", ""), expected_state)
            self.send_response(200 if valid else 400)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            message = "Authorization received. Return to Foundry while it verifies sign-in." if valid else "Sign-in could not be verified. Return to Foundry and try again."
            self.wfile.write(message.encode("utf-8"))

        def log_message(self, _format: str, *_args: Any) -> None:
            return

    server = HTTPServer(("127.0.0.1", 0), CallbackHandler)
    server.timeout = 1
    redirect_uri = f"http://127.0.0.1:{server.server_port}{CALLBACK_PATH}"
    parameters["redirect_uri"] = redirect_uri
    url = f"{AUTHORIZE_URL}?{urlencode(parameters)}"
    if not webbrowser.open(url, new=1, autoraise=True):
        server.server_close()
        raise AuthError("Cannot open the browser for ChatGPT sign-in")
    deadline = time.monotonic() + timeout_seconds
    try:
        while not result and time.monotonic() < deadline:
            server.handle_request()
    finally:
        server.server_close()
    if not result:
        raise AuthError("ChatGPT sign-in timed out")
    if not secrets.compare_digest(result.get("state", ""), expected_state):
        raise AuthError("ChatGPT sign-in state did not match")
    if result.get("error"):
        raise AuthError(f"ChatGPT sign-in was not completed ({result['error']})")
    if not result.get("code"):
        raise AuthError("ChatGPT sign-in returned no authorization code")
    result["redirect_uri"] = redirect_uri
    return result


def _verify_id_token(encoded: str, *, client_id: str, nonce: str) -> dict[str, Any]:
    try:
        import jwt
    except ImportError as exc:
        raise AuthError("ChatGPT authentication requires PyJWT[crypto]; install requirements-auth.txt") from exc
    discovery = _request_json(DISCOVERY_URL)
    issuer = discovery.get("issuer")
    if issuer != "https://auth.openai.com":
        raise AuthError("OpenAI identity configuration is invalid")
    jwks_uri = _trusted_auth_url(discovery.get("jwks_uri"))
    jwks = _request_json(jwks_uri)
    try:
        header = jwt.get_unverified_header(encoded)
        key_data = next(key for key in jwks["keys"] if key.get("kid") == header.get("kid"))
        key = jwt.PyJWK.from_dict(key_data)
        algorithm = key.algorithm_name
        if algorithm not in {"RS256", "ES256"}:
            raise AuthError("OpenAI ID token uses an unsupported signing algorithm")
        claims = jwt.decode(
            encoded,
            key.key,
            algorithms=[algorithm],
            audience=client_id,
            issuer=issuer,
            options={"require": ["exp", "iat", "iss", "aud", "sub", "nonce"]},
        )
    except AuthError:
        raise
    except (KeyError, StopIteration, TypeError, ValueError, jwt.PyJWTError) as exc:
        raise AuthError("OpenAI ID token validation failed") from exc
    if not secrets.compare_digest(str(claims.get("nonce", "")), nonce):
        raise AuthError("OpenAI ID token nonce did not match")
    return claims


def _host_id(metadata: dict[str, Any]) -> str:
    value = metadata.get("host_id")
    if isinstance(value, str) and value.startswith("urn:uuid:"):
        try:
            uuid.UUID(value.removeprefix("urn:uuid:"))
            return value
        except ValueError:
            pass
    return f"urn:uuid:{uuid.uuid4()}"


def _token_expiry(token: dict[str, Any]) -> str:
    try:
        seconds = max(0, int(token.get("expires_in", 0)))
    except (TypeError, ValueError) as exc:
        raise AuthError("ChatGPT token response has an invalid expiry") from exc
    return _iso(_utc_now() + dt.timedelta(seconds=seconds))


def _scopes(token: dict[str, Any]) -> list[str]:
    scope = token.get("scope", "")
    return sorted(set(scope.split())) if isinstance(scope, str) else []


def _public_status(metadata: dict[str, Any], *, model_list: list[dict[str, str]] | None = None) -> dict[str, Any]:
    registration = metadata.get("registration")
    connected = isinstance(registration, dict) and registration.get("connected") is True
    scopes = registration.get("scopes", []) if connected else []
    return {
        "connected": connected,
        "account": registration.get("account") if connected else None,
        "sharing": "chatgpt.tokens.use.direct" in scopes,
        "models": model_list or [],
    }


def _credentials_match(metadata: dict[str, Any], credentials: dict[str, Any]) -> bool:
    registration = metadata.get("registration")
    if not isinstance(registration, dict):
        return False
    account = registration.get("account")
    return (
        isinstance(account, dict)
        and isinstance(credentials.get("client_id"), str)
        and isinstance(credentials.get("subject"), str)
        and secrets.compare_digest(str(registration.get("client_id", "")), credentials["client_id"])
        and secrets.compare_digest(str(account.get("subject", "")), credentials["subject"])
    )


def _refresh_locked(state_dir: str | os.PathLike[str], metadata: dict[str, Any],
                    credentials: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    registration = metadata.get("registration") or {}
    refresh_token = credentials.get("refresh_token")
    client_id = credentials.get("client_id")
    if not _credentials_match(metadata, credentials):
        raise AuthError("ChatGPT registration metadata does not match secure credentials; sign in again")
    if not isinstance(refresh_token, str) or not isinstance(client_id, str):
        raise AuthError("ChatGPT sign-in is required")
    token = _request_json(TOKEN_URL, form={
        "grant_type": "refresh_token",
        "client_id": client_id,
        "refresh_token": refresh_token,
        "resource": RESOURCE,
    })
    access = token.get("access_token")
    if not isinstance(access, str) or not access:
        raise AuthError("ChatGPT refresh returned no access token")
    updated = dict(credentials)
    updated["access_token"] = access
    updated["refresh_token"] = token.get("refresh_token") or refresh_token
    updated["expires_at"] = _token_expiry(token)
    if isinstance(token.get("scope"), str):
        updated["scopes"] = _scopes(token)
        registration["scopes"] = updated["scopes"]
    _credential_write(state_dir, updated)
    metadata["registration"] = registration
    _write_state(state_dir, metadata)
    return metadata, updated


def access_token(state_dir: str | os.PathLike[str]) -> str:
    """Return a valid bearer token for a child process without printing or persisting it in state."""
    with _lock(state_dir):
        metadata = _read_state(state_dir)
        registration = metadata.get("registration")
        if not isinstance(registration, dict) or registration.get("connected") is not True:
            raise AuthError("ChatGPT sign-in is required")
        credentials = _credential_read(state_dir)
        if credentials is None:
            raise AuthError("ChatGPT credentials are unavailable; sign in again")
        if not _credentials_match(metadata, credentials):
            raise AuthError("ChatGPT registration metadata does not match secure credentials; sign in again")
        try:
            expiry = dt.datetime.fromisoformat(str(credentials["expires_at"]))
        except (KeyError, TypeError, ValueError) as exc:
            raise AuthError("Stored ChatGPT credentials are invalid") from exc
        if expiry <= _utc_now() + dt.timedelta(seconds=60):
            metadata, credentials = _refresh_locked(state_dir, metadata, credentials)
        scopes = credentials.get("scopes", [])
        if "chatgpt.tokens.use.direct" not in scopes:
            raise AuthError("ChatGPT plan usage was not granted")
        token = credentials.get("access_token")
        if not isinstance(token, str) or not token:
            raise AuthError("Stored ChatGPT credentials are invalid")
        return token


def models(state_dir: str | os.PathLike[str]) -> list[dict[str, str]]:
    """Return models visible to the active ChatGPT account."""
    payload = _request_json(MODELS_URL, bearer=access_token(state_dir))
    values = payload.get("models")
    if not isinstance(values, list):
        raise AuthError("ChatGPT model catalog is invalid")
    result = []
    for value in values:
        if not isinstance(value, dict) or value.get("visibility") != "list":
            continue
        slug, display_name = value.get("slug"), value.get("display_name")
        if isinstance(slug, str) and isinstance(display_name, str):
            result.append({"slug": slug, "display_name": display_name})
    return result


def status(state_dir: str | os.PathLike[str]) -> dict[str, Any]:
    """Return public connection state. Credentials are never included."""
    metadata = _read_state(state_dir)
    public = _public_status(metadata)
    if public["connected"]:
        try:
            credentials = _credential_read(state_dir)
        except AuthError:
            credentials = None
            public["credential_store_available"] = False
        if credentials is None:
            public["connected"] = False
            public["sharing"] = False
            public["models"] = []
            return public
        public["credential_store_available"] = True
        if not _credentials_match(metadata, credentials):
            public["connected"] = False
            public["sharing"] = False
            public["models"] = []
            public["reauthorization_required"] = True
            return public
        public["sharing"] = "chatgpt.tokens.use.direct" in credentials.get("scopes", [])
    return public


def sign_in(state_dir: str | os.PathLike[str]) -> dict[str, Any]:
    """Open the system browser, complete loopback OAuth, and save a connection."""
    with _lock(state_dir):
        metadata = _read_state(state_dir)
        host_id = _host_id(metadata)
        registration = metadata.get("registration") if isinstance(metadata.get("registration"), dict) else {}
        # Persist the installation identity before opening the browser so a
        # cancelled or timed-out attempt does not create a different host.
        metadata["host_id"] = host_id
        _write_state(state_dir, metadata)
        existing_credentials = _credential_read(state_dir)
        secure_client_id = existing_credentials.get("client_id") if isinstance(existing_credentials, dict) else None
        if isinstance(secure_client_id, str) and isinstance(existing_credentials.get("subject"), str):
            existing_client_id = secure_client_id
        elif registration.get("connected") is False and isinstance(registration.get("client_id"), str):
            existing_client_id = registration["client_id"]
        else:
            existing_client_id = None
        state_value = secrets.token_urlsafe(32)
        nonce = secrets.token_urlsafe(32)
        verifier, challenge = _pkce()
        requested_client = existing_client_id if isinstance(existing_client_id, str) else "dynamic_agent_client"
        parameters = {
            "client_id": requested_client,
            "ext_agent_host_id": host_id,
            "response_type": "code",
            "scope": SCOPES,
            "resource": RESOURCE,
            "state": state_value,
            "nonce": nonce,
            "code_challenge_method": "S256",
            "code_challenge": challenge,
        }
        if requested_client == "dynamic_agent_client":
            parameters["agent_name_hint"] = APP_NAME
        elif existing_credentials and isinstance(existing_credentials.get("id_token"), str):
            parameters["id_token_hint"] = existing_credentials["id_token"]
        callback = _browser_callback(parameters, state_value)
        callback_client = callback.get("client_id")
        if requested_client == "dynamic_agent_client":
            if not callback_client or callback_client == "dynamic_agent_client":
                raise AuthError("ChatGPT did not return an issued client ID")
            client_id = callback_client
        else:
            if callback_client and callback_client != requested_client:
                raise AuthError("ChatGPT returned a different client registration")
            client_id = requested_client
        if requested_client == "dynamic_agent_client":
            # Keep the issued registration even if the one-time code expires or
            # exchange fails. A later attempt can reuse this client ID.
            metadata["registration"] = {
                "client_id": client_id,
                "connected": False,
                "scopes": [],
                "account": None,
            }
            _write_state(state_dir, metadata)
        token = _request_json(TOKEN_URL, form={
            "grant_type": "authorization_code",
            "client_id": client_id,
            "code": callback["code"],
            "code_verifier": verifier,
            "redirect_uri": callback["redirect_uri"],
            "resource": RESOURCE,
        })
        for field in ("access_token", "refresh_token", "id_token"):
            if not isinstance(token.get(field), str) or not token[field]:
                raise AuthError(f"ChatGPT token response has no {field.replace('_', ' ')}")
        claims = _verify_id_token(token["id_token"], client_id=client_id, nonce=nonce)
        old_subject = (existing_credentials or {}).get("subject")
        if old_subject is None and existing_client_id:
            old_subject = (registration.get("account") or {}).get("subject")
        if existing_client_id and old_subject and claims.get("sub") != old_subject:
            raise AuthError("ChatGPT account identity changed for this registration")
        scopes = _scopes(token)
        credentials = {
            "client_id": client_id,
            "subject": claims["sub"],
            "access_token": token["access_token"],
            "refresh_token": token["refresh_token"],
            "id_token": token["id_token"],
            "expires_at": _token_expiry(token),
            "scopes": scopes,
        }
        _credential_write(state_dir, credentials)
        metadata = {
            "version": 1,
            "host_id": host_id,
            "registration": {
                "client_id": client_id,
                "connected": True,
                "scopes": scopes,
                "account": {
                    "subject": claims["sub"],
                    "email": claims.get("email"),
                    "name": claims.get("name"),
                    "issuer": claims["iss"],
                },
            },
        }
        _write_state(state_dir, metadata)
    return status(state_dir)


def sign_out(state_dir: str | os.PathLike[str]) -> dict[str, Any]:
    """Revoke the renewable session when possible, then clear local credentials."""
    revocation_confirmed = False
    with _lock(state_dir):
        metadata = _read_state(state_dir)
        registration = metadata.get("registration")
        credentials = _credential_read(state_dir)
        if isinstance(registration, dict) and credentials:
            client_id = credentials.get("client_id")
            refresh_token = credentials.get("refresh_token")
            if isinstance(client_id, str) and isinstance(refresh_token, str):
                try:
                    discovery = _request_json(DISCOVERY_URL)
                    endpoint = _trusted_auth_url(discovery.get("revocation_endpoint"))
                    _request_json(endpoint, form={
                        "token": refresh_token,
                        "token_type_hint": "refresh_token",
                        "client_id": client_id,
                    })
                    revocation_confirmed = True
                except AuthError:
                    revocation_confirmed = False
        _credential_delete(state_dir)
        # A dynamic client registration is associated with the signed-in
        # account.  Keep the stable installation identity, but discard that
        # account/client association so a later sign-in can choose a different
        # ChatGPT account and receive a fresh client registration.
        metadata.pop("registration", None)
        _write_state(state_dir, metadata)
    result = _public_status(metadata)
    result["revocation_confirmed"] = revocation_confirmed
    return result


def _main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Manage Foundry's local ChatGPT connection")
    parser.add_argument("--state-dir", required=True, help="Ignored, runtime-owned local state directory")
    parser.add_argument("action", choices=("status", "sign-in", "sign-out", "models"))
    args = parser.parse_args(argv)
    actions = {"status": status, "sign-in": sign_in, "sign-out": sign_out, "models": models}
    try:
        value = actions[args.action](args.state_dir)
    except AuthError as exc:
        parser.exit(1, f"error: {exc}\n")
    print(json.dumps(value, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
