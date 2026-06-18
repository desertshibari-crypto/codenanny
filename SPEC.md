# codenanny — v1 Spec

**Mission:** turn the pile of "stuff I made with AI" into a searchable, contextualized library — every file carries the prompts and reasoning that produced it. Live mode runs as a server; static-export mode produces a self-contained HTML+JSON bundle that ships to wherever (local / Google Drive / FTP / SCP). Codenanny watches your projects so you never leave one behind.

---

## Modes

1. **Live mode** — long-running Express server. Watches a transcript dir (default `~/.claude/projects/`), serves the UI hot. Runs on noble3, on your own VPS, or on a linux VM on a Chromebook.
2. **Static-export mode** — one-shot run. Self-contained HTML + JSON bundle, ships to local / GDrive / FTP / SCP. Bundle opens in any browser, fully offline-searchable via prebuilt JSON index.

HTML wizard is the entry point for both. First question: "run as server, or just export?" — wizard branches.

---

## Architecture

Two OSS packages, plus an internal adapter that is **never published**:

- **`plugkit`** — neutral plugin contract. Defines: mountable Express router shape, event bus interface, sqlite schema declaration, nav contribution shape. ~200 LoC. Useful for any modular Express app — not codenanny-specific.
- **`codenanny`** — the sessions/files/wizard tool. Depends on `plugkit`. Ships standalone (with a thin shell) and as a `plugkit` module.
- **`@noble/codenanny-adapter`** (internal, never published) — wires codenanny's events/APIs into internal Noble modules (Coworkers, Dashboard, Market).

Same code runs standalone or inside Noble. Conditional adapters. OSS users never see anything Noble-branded.

---

## v1 Scope

**IN:**
- Ingest Claude Code JSONL transcripts → derive `sessions`, `files`, `summaries`, `search_index`
- HTML wizard: run-mode select, source-dir picker, destination config
- 4 delivery targets for static export: local folder, Google Drive, FTP, SCP/SSH
- Per-user `nav_config` (JSON column on `users`) — toggle/reorder nav items
- Connection profiles as first-class sqlite objects (used in v1 for delivery; reused in v1.5+ for browsing)
- Single OSS codebase, `MODE=live|export` flag

**OUT for v1:**
- Hosted multi-tenant
- Team sharing / comments
- Anything beyond sqlite (no postgres, no redis)
- Ingesting other AI tools' formats (Cursor / Aider / Codex come later)
- Web terminal (v2), Monaco editor (v2.5), inline Claude chat (v3)

---

## Wizard Question Flow

1. **Mode** — Live server? Or one-shot export?
2. **Source** — where are your Claude Code transcripts? (auto-detects `~/.claude/projects/`)
3. **Destination** (export mode only) — local / GDrive / FTP / SCP
4. **Credentials** (for remote destinations) — OAuth flow for GDrive, host+user+key for SCP/FTP
5. **Bundle options** — include source files? Redact secrets? Schedule recurring exports?
6. **Preview & confirm** — show what will happen, then run

---

## Data Model (sqlite)

- `sessions(id, source_path, started_at, ended_at, project_id, title, summary)`
- `session_files(session_id, path, action, content_hash, ts)` — derived from `Write`/`Edit`/`NotebookEdit` tool uses
- `session_prompts(session_id, ts, role, text)` — for full-text search
- `projects(id, name, color, parent_dir)` — user-defined groupings
- `connection_profiles(id, type, host, port, user, auth_json_encrypted, default_dest_path)`
- `users(id, email, role, nav_config_json)` — `nav_config` enables per-user nav

Index built with sqlite FTS5 for fast search across prompts + file contents + summaries.

---

## Phased Roadmap

| Phase | Scope | Binding? |
|---|---|---|
| **v1** | Sessions, files, wizard, GDrive/SCP delivery, per-user nav | **Binding — building now** |
| v1.5 | **Files** module — point-and-click remote file browser on any connection profile | Non-binding |
| v2 | **Terminal** module — xterm.js + node-pty (local) or SSH proxy (remote) | Non-binding |
| v2.5 | **Editor** module — Monaco wired to Files | Non-binding |
| v3 | **Inline Claude** — chat panel powered by Anthropic SDK / Claude Agent SDK | Non-binding |

Non-binding phases are documented so v1 architecture doesn't paint us into a corner. NOT v1 scope.

---

## Security Notes

- v1 only does *read* of local JSONL + *write* to user-configured destinations. Lowest blast radius.
- Connection profile secrets encrypted at rest (sqlite `auth_json_encrypted` column, AES-256-GCM, key from `CODENANNY_SECRET` env).
- v2 (terminal) will need a **second factor on session open** — webauthn / time-locked confirmation / IP allowlist. Designed for now, enforced when v2 ships.
- OAuth refresh tokens for GDrive stored encrypted, scoped to `drive.file` (only files codenanny creates).

---

## OSS Branding (locked)

- Packages: `plugkit`, `codenanny`. No Noble branding visible.
- Maintainer: `nobleglitch` on GitHub.
- License: MIT.
- README posture: "give-back to the community" — short, clear, no shameless plugs.

---

## Folder Layout

```
codenanny/
├── packages/
│   ├── plugkit/              # the plugin contract
│   ├── core/                 # codenanny ingest + index + API
│   ├── ui/                   # the web UI (vanilla, no framework)
│   ├── wizard/               # the HTML setup wizard
│   ├── adapters/
│   │   ├── delivery-local.js
│   │   ├── delivery-gdrive.js
│   │   ├── delivery-ftp.js
│   │   └── delivery-scp.js
│   └── cli/                  # codenanny CLI entry point
├── examples/
│   └── standalone/           # npm start, go
└── docs/
```
