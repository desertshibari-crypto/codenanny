import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { renderViewer } from './_viewer.js';

function parseScpUrl(url) {
  const m = url.match(/^scp:\/\/(?:([^@]+)@)?([^:/]+)(?::(\d+))?(\/.*)?$/);
  if (!m) throw new Error('codenanny scp: invalid URL, expected scp://[user@]host[:port]/path');
  return {
    user: m[1] || 'root',
    host: m[2],
    port: m[3] ? parseInt(m[3]) : 22,
    path: m[4] || '/',
  };
}

export async function deliver(bundle, opts) {
  const target = opts.path?.startsWith('scp://')
    ? parseScpUrl(opts.path)
    : { user: opts.user || 'root', host: opts.host, port: opts.port || 22, path: opts.path || '/' };

  if (!target.host) {
    throw new Error('codenanny scp: host is required (either via scp:// URL or via the host option)');
  }
  const auth = opts.auth;
  if (!auth) {
    throw new Error('codenanny scp: auth is required (password or PEM private key in the auth option)');
  }

  let SftpClient;
  try {
    ({ default: SftpClient } = await import('ssh2-sftp-client'));
  } catch (e) {
    throw new Error(
      'codenanny scp: ssh2-sftp-client is not installed. ' +
      'Run `npm install ssh2-sftp-client` (or it should auto-install with @codenanny/adapters).'
    );
  }

  const tmp = mkdtempSync(join(tmpdir(), 'codenanny-scp-'));
  const localJson = join(tmp, 'index.json');
  const localHtml = join(tmp, 'index.html');
  writeFileSync(localJson, JSON.stringify(bundle, null, 2));
  writeFileSync(localHtml, renderViewer(bundle));

  const sftp = new SftpClient();
  const isKey = auth.includes('-----BEGIN');
  try {
    await sftp.connect({
      host: target.host,
      port: target.port,
      username: target.user,
      ...(isKey ? { privateKey: auth } : { password: auth }),
    });

    const exists = await sftp.exists(target.path);
    if (!exists) await sftp.mkdir(target.path, true);

    await sftp.put(localJson, posix.join(target.path, 'index.json'));
    await sftp.put(localHtml, posix.join(target.path, 'index.html'));
  } finally {
    try { await sftp.end(); } catch {}
    rmSync(tmp, { recursive: true, force: true });
  }

  return {
    type: 'scp',
    location: `${target.user}@${target.host}:${target.path}`,
    sessions_written: bundle.sessions.length,
  };
}
