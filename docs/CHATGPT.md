# Local ChatGPT connection

Foundry can connect a local personal installation to ChatGPT without reading
Codex's credentials or asking for an API key. This is an optional provider
credential route. It does not make the factory coordinator provider-independent.

The implementation follows OpenAI's public-client flow: a browser handles account
selection and consent, a temporary listener accepts the callback on
`127.0.0.1`, and PKCE, OAuth state, and the OpenID nonce are fresh for every
attempt. The returned ID token is verified against OpenAI's published JWKS,
including its signature, issuer, audience, expiry, and nonce.

## Availability and consent

OpenAI currently documents ChatGPT plan usage for open-source tools, personal
projects that run locally, and selected private apps. Eligible Plus and Pro users
choose whether to grant plan usage. Identity and plan usage are separate: a
verified account does not imply the `chatgpt.tokens.use.direct` permission.
This connection does not expose ChatGPT conversations.

Paid or remotely hosted distribution requires OpenAI approval. This repository
does not claim that approval. The official Sign in with ChatGPT DevKit is not a
dependency because its current license is noncommercial; this bridge is an
original standards-based implementation of the published flow.

## Install and connect

The terminal is the normal entry for local product work. ChatGPT consent and
execution are browser-only: use `./foundry ui`, then **Settings → Continue with
ChatGPT**. `./foundry run` refuses the experimental ChatGPT adapter rather than
pretending browser OAuth is available. First launch installs the pinned local
dependencies. For direct command-line inspection, the same bridge is available:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python scripts/chatgpt_auth.py \
  --state-dir .foundry/state/chatgpt sign-in
```

Sign-in opens the system browser and waits up to five minutes for its loopback
callback. The user must select an account and approve the requested permissions.
No automated test or scripted browser can provide that consent.

Inspect public connection state and the current account-specific model catalog:

```sh
.venv/bin/python scripts/chatgpt_auth.py --state-dir .foundry/state/chatgpt status
.venv/bin/python scripts/chatgpt_auth.py --state-dir .foundry/state/chatgpt models
```

Sign out locally and attempt to revoke the renewable session:

```sh
.venv/bin/python scripts/chatgpt_auth.py --state-dir .foundry/state/chatgpt sign-out
```

`revocation_confirmed: false` means local tokens were cleared but the remote
revocation request could not be confirmed. The user can also disconnect the app
in ChatGPT Settings.

## Callable bridge

`scripts.chatgpt_auth` exports:

```python
status(state_dir) -> dict
sign_in(state_dir) -> dict
sign_out(state_dir) -> dict
models(state_dir) -> list
access_token(state_dir) -> str
```

Only `access_token()` returns a credential, for immediate injection into an
authorized child process environment. Do not print, log, serialize, or return it
through an HTTP/UI response. The other functions return public account,
permission, model, and connection data.

The stable opaque host ID and public registration metadata live under the passed
state directory, which should be `.foundry/state/chatgpt` or another ignored,
runtime-owned directory. Access, refresh, and retained ID tokens live only in
the user's macOS Keychain. The bridge fails closed when that secure backend is
unavailable; it never falls back to a plaintext token file and never reads
`~/.codex/auth.json`.

The model list comes from `https://api.openai.com/v1/models` using the same
refreshed OAuth token intended for inference. Foundry keeps entries whose
`visibility` is `list` and exposes only `slug` and `display_name`. Any Responses
API caller using this plan-usage token must follow OpenAI's current constraints,
including `store: false`, `stream: true`, and waiting for
`response.completed` before claiming success.

Local tests verify signed-token rejection, secure/public account association,
refresh and revocation boundaries, and the App Server protocol with doubles.
They do not establish a completed live consent flow or account/model access.

## Factory execution

The built-in `chatgpt` provider adapter runs `codex app-server` as a child
process and configures a custom Responses provider whose only credential source
is the child environment's `ACCESS_TOKEN`. Foundry removes OpenAI API-key credentials,
does not place the OAuth token in its request JSON or evidence, disables native
multi-agent execution for this preview route, and preserves the app-server
thread ID for a later `resume` attempt.

The adapter applies the request's `read-only` or `workspace-write` sandbox and
sets approval policy to `never`. If app-server nevertheless asks for an
interactive command, file, permission, tool, or elicitation approval, the
adapter declines it and fails the attempt visibly. Cancellation of the outer
provider task reaches app-server because it remains in the adapter's owned
process group. A completed factory result requires app-server's
`turn/completed` notification with status `completed` and a final agent message.

## Sources

- [OpenAI cookbook: Integrating Sign in with ChatGPT in your Opensource App](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt)
- [Registration and sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [Accounts, refresh, and logout](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)
- [Models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
- [Official DevKit and its license](https://github.com/openai/sign-in-with-chatgpt-devkit)
