# Stripe Security

## API Key Management

### Never commit keys to source code

Store in a secrets vault (AWS Secrets Manager, HashiCorp Vault, etc.). Environment variables are acceptable if your platform doesn't offer a vault. Key exposures via repos are the leading cause of compromise.

```bash
# Good
export STRIPE_SECRET_KEY="sk_live_..."

# Bad -- never do this
const stripe = new Stripe("sk_live_actualkey...");
```

### Key hygiene

- Never share secret keys with third parties. Generate restricted keys instead.
- Rotate keys when personnel with access depart.
- Never log keys or include in error messages/analytics.
- Never build endpoints that dump environment variables.
- Use separate keys per environment (prod, staging, QA).
- Set up pre-commit hooks to catch `"sk_..."` and `"rk_..."` patterns.

## Restricted API Keys (RAKs)

Use restricted keys (prefix `rk_`) instead of secret keys (prefix `sk_`) wherever possible. A compromised RAK can do far less damage.

### Principle of least privilege

Create a separate RAK for each service/use case with only the permissions it needs.

### Migration from secret key to RAK

1. Review the secret key's request logs in Workbench to catalog API calls it makes.
2. Create a RAK in test mode with matching permissions.
3. Use `stripe logs tail` to monitor.
4. Test integration -- fix any `403` by adding missing permissions.
5. Create live-mode RAK and replace secret key.
6. Rotate/expire the old secret key.

## IP Restrictions

Add an IP allowlist to every API key. Even if a key is stolen, it can only be used from your infrastructure.

```
Dashboard > Developers > API keys > [key] > IP restrictions
```

Use separate allowlists per key (prod vs QA).

## Incident Response (Key Compromise)

1. **Roll the key immediately** -- Dashboard > API keys > Roll. Do this even if unsure about unauthorized use.
2. **Check activity logs** -- Review Workbench request logs for the compromised key.
3. **Contact Stripe support** if you see unrecognized activity.

Preparation: practice rolling keys, audit code for committed keys, use pre-commit hooks.

## Webhook Security

1. **Always verify signatures** -- See [webhooks.md](webhooks.md) for implementation.
2. **Allowlist Stripe IPs** -- Defense in depth. See [Stripe IPs](https://docs.stripe.com/ips.md).
3. **Never process unverified events** -- Spoofed webhooks can trigger unauthorized actions.

## Client-Side Security

- Never use secret keys or RAKs in mobile apps, SPAs, or any client-side code. Keys can be extracted and decompiled.
- Use **ephemeral keys** for cases where a client must interact with Stripe directly (e.g., Issuing Elements).
- Proxy Stripe API calls through your backend.

## PCI Compliance

- Using Checkout or Payment Element: you're SAQ A (simplest PCI scope).
- Handling raw card numbers server-side: requires PCI DSS certification. Use `payment_method_data` only after proving compliance.
- Migrating PAN data from another processor: use [PAN import process](https://docs.stripe.com/get-started/data-migrations/pan-import.md).

## Two-Factor Authentication

Use **passkeys or authenticator apps** for Dashboard access. SMS 2FA is vulnerable to SIM-swapping. Audit team members' 2FA methods in Dashboard.

## Connect Security

- **Liability**: Platform operators bear financial liability for fraud/disputes on Express/Custom connected accounts. Standard accounts minimize this.
- **Onboarding**: Use Stripe-hosted onboarding. Custom onboarding means collecting sensitive PII directly -- adds regulatory complexity.

## SSO and SCIM

For teams:
- **SAML SSO** -- Federate with your identity provider (Okta, Google). Centralizes access control.
- **SCIM provisioning** -- Automates user provisioning/deprovisioning. Ensures departed employees lose Dashboard access.

## Gotchas

- **Don't default to secret keys**: If someone asks for a key, suggest RAK first with minimum permissions.
- **`sk_test_` vs `sk_live_`**: Test keys can still expose your account structure. Treat them as sensitive.
- **Webhook signing secret rotation**: When you roll your webhook signing secret, there's a brief window where you need to accept both old and new signatures. Stripe provides both during rotation.
- **OAuth `state` parameter**: Always use it for Connect OAuth flows. Without it, you're vulnerable to CSRF.
- **Error pages**: Never dump env vars in error responses. This leaks keys along with other secrets.
