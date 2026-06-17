# codenanny-standalone-example

Smallest end-to-end demo: codenanny + plugkit as a single Express server, UI mounted at `/`, JSON API mounted at `/codenanny/api/*`.

## Run

```bash
# from the monorepo root
npm install
node examples/standalone/index.js
```

Then open http://localhost:7700.

## Env vars

| Var | Default | Purpose |
|---|---|---|
| `CODENANNY_DB`  | `./codenanny.db` | SQLite database path |
| `CODENANNY_SRC` | `~/.claude/projects` | Where to read Claude Code transcripts from |
| `PORT`          | `7700` | HTTP port |
