# Container checkout trust

The pinned checkout action uses temporary Git global configuration for its own
safe.directory entry. Later job steps need explicit trust of the checked-out
workspace when container and mounted checkout owners differ.

- Configure only GITHUB_WORKSPACE as safe in the job's normal global Git config.
- Keep the scanner's inherited environment and ownership safeguards unchanged.
- Prove untrusted ownership fails, workspace-scoped trust enables a clean scan,
  staged secrets still block despite a clean worktree, and another repo stays untrusted.
- Run regression and all six checks; independently review, commit and push within
  the authorized CI repair scope. Hosted results are separate from local checks.

Also authorized: rewrite README to explain the shipped features, end-to-end flow,
skill/command inventory, optional hooks and specialist roles. Distinguish guidance
from executable contracts and disclose unverified delivery/integration claims.
