# Protocol smoke examples

These examples exercise the existing `marketcraft-jsonl-v1` provider protocol
without an AI call, account, network connection, or paid billing.

`echo_adapter.py` is a **bounded-model** adapter. It echoes one prompt and
returns one schema-checked result. It is not a product-building agent, cannot
advertise tools or agent sessions, and does not qualify a real provider.

Run the complete isolated smoke, which creates a temporary product directory,
registers the adapter there only, and invokes the existing provider CLI:

```sh
python3 examples/echo_smoke.py
```

The generated temporary configuration is equivalent to
`echo-providers.json` after replacing its two absolute command paths with the
active Python executable and checkout path. The request is the bounded,
local-billing example in `echo-request.json`. The smoke directory is removed
when the command exits; nothing is written to the user's real
`.foundry/providers.json`.

The Factory terminal's `providers [PROJECT]` command reports registered
metadata only and does not qualify it. A bounded-model route is intentionally
not a Factory product-building route: Factory stages require a locally billed
`agent-runtime` with tools, permissions and cancellation capabilities. A model
endpoint or API key is not an agent runtime.
