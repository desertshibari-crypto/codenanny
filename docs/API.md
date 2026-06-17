# API reference

codenanny exposes two APIs:

- **HTTP** — mounted at `/codenanny/api/` when the module is registered with plugkit (default mount path)
- **Library** — the JavaScript surface for embedding codenanny in your own Node app

## HTTP API

All endpoints return JSON. All routes are relative to the module's mount path (`/codenanny` by default).

### Sessions

#### `GET /api/sessions`

List sessions.

| Query | Default | Description |
|---|---|---|
| `limit` | `100` | Max rows (capped at 500) |
| `project_id` | (none) | Filter to a single project |

Returns: `Array<Session>`.

#### `GET /api/sessions/:id`

Get one session with its prompts and files.

Returns: `{ session, prompts, files }` or `404` if not found.

#### `PATCH /api/sessions/:id`

Rename a session or reassign it to a project.

Body:
```json
{ "title": "string?", "project_id": "string|null?" }
```

Returns: the updated session. Emits `codenanny:session:updated`.

### Projects

#### `GET /api/projects`

List all projects.

Returns: `Array<Project>`.

#### `POST /api/projects`

Create a project.

Body:
```json
{
  "id": "string?",
  "name": "string (required)",
  "color": "string?",
  "parent_dir": "string?"
}
```

If `id` is omitted, codenanny derives a slug from `name`. Emits `codenanny:project:created`.

### Files / media

#### `GET /api/files/recent?limit=100`

Most recent file actions across all sessions.

#### `GET /api/media?limit=1000&project_id=<id>`

Every file action across every session, optionally filtered by project. Includes the parent session title.

### Search

#### `GET /api/search?q=<query>&limit=50`

Full-text search across prompts and content. Uses FTS5 when available; falls back to `LIKE`.

Returns: `Array<{ session_id, snippet, ts, role }>`.

#### `GET /api/stats`

Returns: `{ sessions: n, files: n, prompts: n, projects: n }`.

### Root

#### `GET /`

Welcome JSON: stats + a preview of the 10 most recent sessions.

## Library API

```js
import codenanny, { ingestAll, createApi } from 'codenanny';
import { createHost } from 'plugkit';
import Database from 'better-sqlite3';
import express from 'express';

const app = express();
const db  = new Database('./codenanny.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const host = createHost({ app, db });
host.register(codenanny({ mountPath: '/codenanny' }));

await ingestAll(db, process.env.HOME + '/.claude/projects');

app.listen(7700);
```

### `codenanny(opts)`

Returns a plugkit module ready to register.

| Option | Default | Description |
|---|---|---|
| `mountPath` | `/codenanny` | URL prefix to mount the module under |

### `ingestAll(db, rootDir, opts)`

Walks `rootDir` for Claude Code JSONL transcripts, indexes them into the database. Idempotent.

| Option | Description |
|---|---|
| `onProgress` | Callback `({ current, total, file })` for each session |

Returns: `{ ingested, total }`.

### `findTranscripts(rootDir)`

Returns: `Array<{ projectId, filePath }>` for every `.jsonl` transcript under `rootDir`.

### `parseTranscript(filePath)`

Returns: `{ id, started_at, ended_at, title, prompts, files }`.

### `indexSession(db, projectId, parsed)`

Inserts a parsed session into the database. Used internally by `ingestAll`.

### `createApi(db)`

The query layer used by the router. Useful if you want to embed codenanny data in your own UI.

```js
const api = createApi(db);

api.sessions.list({ limit: 50 });
api.sessions.list({ limit: 50, project_id: 'my-project' });
api.sessions.get(id);
api.sessions.prompts(id);
api.sessions.files(id);

api.files.byProject(projectId);
api.files.recent(50);

api.projects.list();

api.search('embeddings', { limit: 25 });

api.stats();
```

### `createRouter({ api, db, events, logger })`

The Express router. Normally created automatically when the plugkit module is registered, but exported for advanced cases (e.g. embedding under a non-standard mount path).

## Events

The codenanny module emits these on the shared plugkit `events` EventEmitter:

| Event | Payload | When |
|---|---|---|
| `codenanny:ready` | `{ stats }` | After the module's router is wired |
| `codenanny:session:updated` | `{ id, changes }` | After `PATCH /api/sessions/:id` |
| `codenanny:project:created` | `{ id }` | After `POST /api/projects` |

Subscribe via `host.events.on('codenanny:ready', handler)` or via a module's `subscribe` field.

## Data model (sqlite)

See `packages/core/src/schema.sql` for the source of truth. Summary:

| Table | Purpose |
|---|---|
| `sessions` | One row per transcript: id, source_path, started_at, ended_at, project_id, title, summary |
| `session_files` | One row per Write/Edit/NotebookEdit/MultiEdit: path, action, content_hash, ts |
| `session_prompts` | One row per user/assistant message; mirrored to FTS5 |
| `projects` | id, name, color, parent_dir |
| `connection_profiles` | Encrypted credentials for delivery destinations |
| `users` | id, email, role, nav_config_json |
