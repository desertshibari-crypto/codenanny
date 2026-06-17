/**
 * SSE endpoint tests — uses Node's built-in node:http client + node:test.
 * No new dev-deps required.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import express from 'express';
import { createRouter } from '../../packages/core/src/router.js';
import { createApi } from '../../packages/core/src/api.js';
import { freshDb } from '../helpers/db.js';

/** Boot a temporary Express server and return { server, base, events, close }. */
function startServer() {
  const db = freshDb();
  const events = new EventEmitter();
  const api = createApi(db);
  const app = express();
  app.use('/codenanny', createRouter({ api, db, events }));

  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        base: `http://127.0.0.1:${port}/codenanny`,
        events,
        close: () => server.close(),
      });
    });
  });
}

/**
 * Open a raw HTTP connection to the SSE endpoint and collect events until
 * `stopAfter` events have been received or `timeoutMs` elapses.
 *
 * Returns: Array<{ event, data }>
 */
function collectSseEvents(base, { stopAfter = 1, timeoutMs = 3000 } = {}) {
  return new Promise((resolve, reject) => {
    const collected = [];
    // base is e.g. "http://127.0.0.1:PORT/codenanny" — append without slash replacement
    const url = new URL(base + '/api/events');

    const req = http.get(
      { hostname: url.hostname, port: url.port, path: url.pathname },
      (res) => {
        let buf = '';

        const timer = setTimeout(() => {
          req.destroy();
          resolve(collected);
        }, timeoutMs);

        res.on('data', (chunk) => {
          buf += chunk.toString();
          // SSE messages are separated by blank lines (\n\n)
          const parts = buf.split('\n\n');
          buf = parts.pop(); // keep the incomplete last part in the buffer
          for (const block of parts) {
            if (!block.trim()) continue;
            const evt = {};
            for (const line of block.split('\n')) {
              if (line.startsWith('event:')) evt.event = line.slice(6).trim();
              else if (line.startsWith('data:')) evt.data = line.slice(5).trim();
            }
            if (evt.event) {
              collected.push(evt);
              if (collected.length >= stopAfter) {
                clearTimeout(timer);
                req.destroy();
                resolve(collected);
              }
            }
          }
        });

        res.on('error', reject);
      }
    );

    req.on('error', (err) => {
      // ECONNRESET is expected when we call req.destroy() — treat as done
      if (err.code === 'ECONNRESET') resolve(collected);
      else reject(err);
    });
  });
}

// 1. SSE response sets the required headers
test('SSE: response sets correct headers', async () => {
  const { close, base } = await startServer();
  try {
    await new Promise((resolve, reject) => {
      const url = new URL(base + '/api/events');
      const req = http.get(
        { hostname: url.hostname, port: url.port, path: url.pathname },
        (res) => {
          assert.equal(
            res.headers['content-type'],
            'text/event-stream',
            'Content-Type must be text/event-stream'
          );
          assert.match(
            res.headers['cache-control'] ?? '',
            /no-cache/,
            'Cache-Control must contain no-cache'
          );
          assert.equal(
            res.headers['x-accel-buffering'],
            'no',
            'X-Accel-Buffering must be no (nginx)'
          );
          req.destroy();
          resolve();
        }
      );
      req.on('error', (err) => {
        if (err.code === 'ECONNRESET') resolve();
        else reject(err);
      });
    });
  } finally {
    close();
  }
});

// 2. A welcome event fires immediately on connect
test('SSE: welcome event fires on connect', async () => {
  const { close, base } = await startServer();
  try {
    const events = await collectSseEvents(base, { stopAfter: 1 });
    assert.equal(events.length, 1, 'should receive exactly one event');
    assert.equal(events[0].event, 'welcome', 'first event must be "welcome"');
    const payload = JSON.parse(events[0].data);
    assert.equal(payload.type, 'welcome', 'payload.type must be "welcome"');
    assert.ok(typeof payload.stats === 'object', 'payload.stats must be an object');
    assert.ok(typeof payload.ts === 'number', 'payload.ts must be a number');
  } finally {
    close();
  }
});

// 3. When host.events emits codenanny:session:updated the SSE client receives it
test('SSE: session:updated propagated to SSE stream', async () => {
  const { close, base, events } = await startServer();
  try {
    // Collect 2 events: welcome + session:updated
    const promise = collectSseEvents(base, { stopAfter: 2 });

    // Give the client a moment to connect before emitting
    await new Promise((r) => setTimeout(r, 50));
    events.emit('codenanny:session:updated', { id: 'test-session-id', changes: { title: 'new title' } });

    const received = await promise;
    assert.equal(received.length, 2, 'should receive welcome + session:updated');

    const upd = received.find((e) => e.event === 'session:updated');
    assert.ok(upd, 'session:updated event must be present');
    const payload = JSON.parse(upd.data);
    assert.equal(payload.id, 'test-session-id', 'payload.id must match emitted value');
  } finally {
    close();
  }
});

// 4. On disconnect, event listeners are removed — no leak
test('SSE: disconnect removes listeners (no leak)', async () => {
  const { close, base, events } = await startServer();
  try {
    const before = events.listenerCount('codenanny:session:updated');

    // Connect then immediately disconnect after receiving the welcome event
    await collectSseEvents(base, { stopAfter: 1 });

    // Allow the server-side close handler to run
    await new Promise((r) => setTimeout(r, 50));

    const after = events.listenerCount('codenanny:session:updated');
    assert.equal(after, before, 'listener count must return to baseline after disconnect');
  } finally {
    close();
  }
});
