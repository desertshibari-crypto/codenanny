# Writing a plugkit module

plugkit is the plugin contract behind codenanny. It's a few hundred lines of code and one job: let you compose an Express app from independently-developed modules that share a sqlite db and an event bus.

This guide walks through writing one.

## The shape

A plugkit module is just an object:

```js
import { defineModule } from 'plugkit';

export default function notesModule(opts = {}) {
  return defineModule({
    name: 'notes',
    mountPath: opts.mountPath || '/notes',

    schema: {
      migrations: [
        `CREATE TABLE IF NOT EXISTS notes (
           id INTEGER PRIMARY KEY,
           created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
           body TEXT NOT NULL
         )`
      ],
    },

    router: ({ db, events, logger }) => {
      const r = express.Router();
      r.use(express.json());

      r.get('/api/list', (req, res) => {
        res.json(db.prepare('SELECT * FROM notes ORDER BY created_at DESC').all());
      });

      r.post('/api/create', (req, res) => {
        const { body } = req.body;
        if (!body) return res.status(400).json({ error: 'body required' });
        const info = db.prepare('INSERT INTO notes (body) VALUES (?)').run(body);
        events.emit('notes:created', { id: info.lastInsertRowid, body });
        res.json({ id: info.lastInsertRowid });
      });

      return r;
    },

    subscribe: {
      'codenanny:session:updated': ({ id }) => {
        console.log(`[notes] saw codenanny session ${id} update`);
      },
    },

    nav: {
      id: 'notes',
      label: 'Notes',
      icon: 'sticky-note',
      route: '/notes',
    },
  });
}
```

## Fields

| Field | Required | What it does |
|---|---|---|
| `name` | yes | Unique identifier. plugkit refuses to register two modules with the same name. |
| `mountPath` | no | URL prefix for the router. Defaults to `/<name>`. |
| `schema.migrations` | no | Array of SQL strings run inside a single transaction at register time. |
| `router` | no | `({ db, events, logger, host }) => express.Router`. Called once at register time. |
| `subscribe` | no | `{ eventName: handler }` map of event subscriptions. |
| `nav` | no | Object (or array of objects) describing nav items the host can render. |

A module that provides only a schema, only a subscriber, or only a router is fine.

## Schema migrations

`schema.migrations` is an array of SQL strings. plugkit runs them all in one transaction when the module is registered. Use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` — there's no version tracking in v1. Add a new string to the array for a new migration.

```js
schema: {
  migrations: [
    `CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_notes_created ON notes (created_at)`,
    `ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`,
  ],
}
```

## Router

Your `router` function gets the shared db, events emitter, logger, and the host object. Return an Express router. plugkit mounts it at `mountPath`.

Keep routes prefixed with `/api/` so a host can serve a static UI under the same mount point if it wants to (codenanny does this — UI at `/`, JSON API at `/api/`).

## Events

Modules communicate through the shared `events` EventEmitter — *not* by calling each other's APIs directly. This keeps modules loosely coupled.

Emit events freely (`events.emit('notes:created', { id })`). Subscribe in the `subscribe` map. Avoid synchronous side effects in subscribers — assume other handlers are also running.

Naming convention: `<module>:<resource>:<verb>` — e.g. `codenanny:session:updated`, `notes:created`.

## Nav contributions

If your module has a UI, contribute a nav item:

```js
nav: {
  id: 'notes',
  label: 'Notes',
  icon: 'sticky-note',
  route: '/notes',
  roles: ['user', 'admin'], // optional — restrict by role
}
```

The host calls `host.getNav(user)` to assemble the per-user nav. plugkit filters by role and applies the user's `nav_config_json` (enabled set + order). You don't need to do anything else.

## Registering your module

```js
import express from 'express';
import Database from 'better-sqlite3';
import { createHost } from 'plugkit';
import codenanny from 'codenanny';
import notes from './notes-module.js';

const app = express();
const db  = new Database('./app.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const host = createHost({ app, db });
host.register(codenanny());
host.register(notes());

app.listen(7700);
```

Modules can be registered in any order. plugkit runs each module's migrations as it registers.

## What plugkit deliberately does NOT do

- **No DI container.** Just function args.
- **No service registry.** Use events to talk between modules.
- **No async migrations.** Schema runs synchronously at register time. If you need async setup, do it in your `router` function (it's called once at register).
- **No hot reload.** Modules register at process boot. Restart to load new code.
- **No version negotiation.** Modules either compose cleanly or they don't.

If you find yourself wanting these, you've outgrown plugkit and that's fine — eject it and roll your own.

## Examples

- The codenanny module itself (`packages/core/index.js`) — full working example.
- The example host (`examples/standalone/`) — the smallest possible host process that boots codenanny.
