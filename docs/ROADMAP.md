# codenanny — Roadmap

The full plan lives in [SPEC.md](../SPEC.md). This is the short version.

## v1 (in progress — building now)

- Ingest Claude Code JSONL transcripts
- Sessions + files + prompts + FTS5 search
- HTML wizard (6 steps)
- 4 delivery targets: local, GDrive, FTP, SCP (local is functional; rest are stubs)
- Per-user nav config

## v1.5 — Files

Point-and-click remote file browser on any connection profile saved in v1. Upload, download, rename, delete, preview. No terminal.

## v2 — Terminal

xterm.js + node-pty (local) or SSH proxy (remote). Will require a **second factor on session open** (webauthn / time-locked confirmation / IP allowlist).

## v2.5 — Editor

Monaco (the editor VSCode uses, MIT) wired to Files. Open, edit, save.

## v3 — Inline Claude

Chat panel powered by the Anthropic SDK / Claude Agent SDK. Sits next to the file you're editing. Replaces Claude Code CLI when you want it embedded.

---

Phases 1.5 → 3 are **non-binding** — documented so today's architecture doesn't paint us into a corner. They are NOT v1 scope.
