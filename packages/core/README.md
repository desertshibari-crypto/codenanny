# codenanny

> Watches your projects so you never leave one behind.

Ingests [Claude Code](https://claude.com/claude-code) JSONL transcripts, indexes them with sqlite + FTS5, and serves them as a navigable web UI — or exports a self-contained static bundle.

Every file you generate carries the prompts and reasoning that produced it. Folders of half-finished projects become a searchable knowledge base.

## Install

```bash
npm install codenanny
```

## As a standalone server

```js
import express from 'express';
import Database from 'better-sqlite3';
import { createHost } from 'plugkit';
import codenanny from 'codenanny';

const app = express();
const db = new Database('codenanny.db');
const host = createHost({ app, db });

host.register(codenanny({ mountPath: '/' }));

app.listen(7700, () => console.log('codenanny live at http://localhost:7700'));
```

## As a plugkit module inside a host app

Same API — just mount it on a path:

```js
host.register(codenanny({ mountPath: '/sessions' }));
```

## One-shot ingest from CLI

```bash
# Reads ~/.claude/projects/ by default
npx codenanny ingest --db ./codenanny.db --src ~/.claude/projects
```

## Library API (for hosts and other modules)

```js
import { createApi } from 'codenanny';
const api = createApi(db);

api.sessions.list({ limit: 100 })
api.sessions.get(id)
api.sessions.prompts(id)
api.sessions.files(id)
api.files.byProject(projectId)
api.files.recent(100)
api.projects.list()
api.search('my query', { limit: 50 })
api.stats()
```

## HTTP API

- `GET /api/sessions?limit=&project_id=`
- `GET /api/sessions/:id` — session + prompts + files
- `GET /api/projects`
- `GET /api/files/recent?limit=`
- `GET /api/search?q=&limit=`
- `GET /api/stats`

## License

MIT. Created by [desertshibari-crypto](https://github.com/desertshibari-crypto).
