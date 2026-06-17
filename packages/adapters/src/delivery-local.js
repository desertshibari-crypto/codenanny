import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderViewer } from './_viewer.js';

export async function deliver(bundle, { path }) {
  const dest = resolve(path);
  mkdirSync(dest, { recursive: true });

  writeFileSync(join(dest, 'index.json'), JSON.stringify(bundle, null, 2));
  writeFileSync(join(dest, 'index.html'), renderViewer(bundle));

  return {
    type: 'local',
    location: dest,
    sessions_written: bundle.sessions.length,
  };
}
