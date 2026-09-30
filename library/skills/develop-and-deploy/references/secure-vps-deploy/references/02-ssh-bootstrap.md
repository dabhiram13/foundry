# SSH Bootstrap

SSH is the first hard gate.
Do not harden anything until you have a verified non-root path in.

## Preferred Path

1. Create or identify a non-root deploy user.
2. Set up SSH key auth.
3. Confirm a fresh login works in a second terminal.
4. Only then move to SSH hardening.

## Local Commands

Generate a key if needed:

```bash
ssh-keygen -t ed25519 -C "deploy"
```

Copy the key:

```bash
ssh-copy-id deployer@your-server-ip
```

Test:

```bash
ssh deployer@your-server-ip
```

## Rules

- Never disable password login before a key-based login is proven.
- Keep the original SSH session open while testing the new path.
- Prefer a stable SSH config alias if the project will use the server repeatedly.

## When To Break Out

If the user needs deeper SSH-specific help, use the imported `ssh` or `ssh-hardening` skill as a narrower fallback.
