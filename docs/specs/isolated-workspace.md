# Isolated workspace and local app

## Outcome and boundary

D2 in [managed product delivery](managed-product-delivery.md) is an owner-visible,
contained workspace for the existing approved Builder session. It is not a new
planner, verifier, or source of task completion. The public website remains
static. A workspace must never inherit the host's home directory, provider
credentials, Docker socket, `.git`, or `.foundry` authority records. Only
existing Foundry verification can record a completed task.

The first increment (W1-W6) provides a real disposable container, a source
snapshot, bounded terminal operations, a textual source diff, and durable
inspection/confirmed stop. This is **not D2 completion**: W7-W11 require the
managed coding turn, checks, browser, preview, and owner interface inside the
same boundary before accepting untrusted repositories. No hidden fallback to
trusted-local execution is permitted.

## First increment: container-backed owner terminal

The owner explicitly selects a local Docker image by immutable digest. Opening
is tied to an existing, approved managed session in a non-running state. The
service snapshots regular project files into a private directory outside the
repository, omitting `.git`, `.foundry`, ignored paths and known credential
filenames. Refuse symlinks and unusual filesystem entries rather than following
them. Record an intent before asking Docker to create a container; after a
crash, inspection must block new work until the old resource is confirmed
stopped. No project file is written back automatically. If the owner changed
the source since the snapshot, an eventual apply operation must conflict
instead of overwriting it.

The image is a deployment choice, not an authenticated claim about the
publisher. Trusting an arbitrary image digest is still trusting that image;
Docker is not a VM or an absolute security boundary. No live provider or
external API is used by this increment. A network-disabled container cannot
reach the host-local fake provider; adding an explicit credential-free broker
is subsequent work, not a reason to silently enable host networking.

Inspection before first open must not reserve a workspace directory. Snapshot
the current working tree, omitting tracked files that were deleted locally.
Override image entrypoints with the selected Node runtime, and keep project
admission available while a terminal command runs so the owner can inspect and
stop it through a second CLI process. Qualify these paths in the installed CLI.

## Acceptance criteria

| ID | Behavior | Observable check |
| --- | --- | --- |
| W1 | Reject an unpinned image, malformed request, unapproved session and concurrent resource. | Unit and CLI negative cases. |
| W2 | Copy only eligible regular files; reject symlinks and oversized files, preserve source bytes, do not mount the project, home, `.foundry` or socket. | Disposable Git project with a secret and negative snapshot tests; inspect Docker mounts. |
| W3 | Run a real terminal command as a non-root user in a digest-pinned, network-free, capability-free, read-only-root container with CPU/memory/pid limits and bounded output/deadline. | Container writes to its copy, cannot reach host socket/network/owner home; timed command stops. |
| W4 | Show changed text and names without changing owner files or reading newly created symlinks or private paths. | Diff, deletion, ignored/secret and owner-edit tests. |
| W5 | Stop proves the container no longer exists. On unknown state or interrupted terminal execution, require explicit recovery instead of claiming success. | Abrupt-exit, restart, orphan and Docker-error tests. |
| W6 | Terminal, diff and stop are explicit owner commands, scoped to the current managed session; they cannot approve, verify or record its task. | End-to-end CLI qualification on a disposable approved session. |
| W7 | Real OpenCode turns and Foundry check commands run inside the selected workspace through a host-owned credential broker, with no direct host/provider exposure and no secret-bearing prompts passed through Docker arguments. | Fake endpoint edit/repair/stop/resume and credential/network denial; full saved verification. |
| W8 | Owner can see live activity and select executor/model explicitly in a local authenticated interface. | Auth, CSRF, stale-revision and owner journey. |
| W9 | Terminal, browser, preview and source diff are usable in that interface; browser and preview processes remain contained. | Screenshot plus cross-origin/URL/port negative checks. |
| W10 | Pause, Stop, Resume and takeover confirm resources shut down and preserve owner edits across crashes. | Process-tree, duplicate request and restart cases. |
| W11 | All declared UI states work at mobile/desktop widths with keyboard and reduced motion. | Rendered browser evidence and accessibility checks. |

## Later work and release

First increment source does not enable production repository execution. W7-W11
and an owner-visible acceptance run are required for D2. No npm publication,
host credentials, paid provider, automatic PR, merge or deployment is part of
this stage. An arbitrary local Docker daemon or owner-supplied image is not
equivalent to a hardened remote sandbox; qualify each execution environment.
