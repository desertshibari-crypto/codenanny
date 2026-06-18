# Security Policy

## Supported versions

codenanny is pre-1.0. Security fixes go to the latest published version on the `main` branch. Older tags do not receive backports.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

Use one of:

1. **GitHub private vulnerability reporting** — go to the repo → Security tab → "Report a vulnerability".
2. **Email** — send to the address listed on the maintainer's GitHub profile (`nobleglitch`). Use a clear subject line like `[codenanny] security report`.

Please include:

- A description of the vulnerability and the version / commit it affects
- Steps to reproduce
- The impact you expect (information disclosure, RCE, privilege escalation, etc.)
- Any suggested mitigation, if you have one

We will acknowledge receipt within 3 days, share an initial assessment within 7 days, and aim to ship a fix within 30 days for high-severity issues. Lower-severity reports may take longer but will not be ignored.

## Scope

codenanny is intended to be run **locally or on infrastructure controlled by the operator**. Multi-tenant hosting is explicitly out of scope for v1.

In scope:

- Code in this repository (all packages under `packages/`)
- Default configuration produced by the wizard
- The delivery adapters (`local`, `scp`, `gdrive`, `ftp`)

Out of scope:

- Vulnerabilities in third-party services (Google Drive, your SSH server, etc.) — report those upstream
- Issues that require an attacker to already have local access to the machine running codenanny
- Anything in `examples/` (illustrative only, not production-grade)

## What we encrypt at rest

Connection profile secrets (passwords, refresh tokens, SSH keys) stored in the sqlite database are encrypted with AES-256-GCM using a key derived from the `CODENANNY_SECRET` environment variable.

**You are responsible** for:

- Keeping `CODENANNY_SECRET` out of source control
- Restricting filesystem permissions on the sqlite database
- Not exposing the codenanny HTTP port to untrusted networks without an auth layer in front (v1 is single-user; auth lands in v0.2)

## Disclosure policy

We follow coordinated disclosure: reporters and the maintainer agree on a public disclosure date once a fix is available. Credit will be given in the release notes unless the reporter prefers to remain anonymous.
