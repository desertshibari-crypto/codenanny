import { renderViewer } from './_viewer.js';

async function refreshAccessToken({ client_id, client_secret, refresh_token }) {
  const params = new URLSearchParams({
    client_id,
    client_secret,
    refresh_token,
    grant_type: 'refresh_token',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!r.ok) {
    throw new Error(`codenanny gdrive: token refresh failed (${r.status}): ${await r.text()}`);
  }
  const data = await r.json();
  return data.access_token;
}

async function uploadMultipart({ accessToken, name, mimeType, body, parentFolderId }) {
  const metadata = {
    name,
    mimeType,
    ...(parentFolderId ? { parents: [parentFolderId] } : {}),
  };
  const boundary = '----codenanny-' + Math.random().toString(36).slice(2);
  const multipart =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n` +
    body +
    `\r\n--${boundary}--`;

  const r = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': `multipart/related; boundary=${boundary}`,
      },
      body: multipart,
    }
  );
  if (!r.ok) {
    throw new Error(`codenanny gdrive: upload "${name}" failed (${r.status}): ${await r.text()}`);
  }
  return r.json();
}

function extractCreds(opts) {
  if (opts.auth && typeof opts.auth === 'string' && opts.auth.trim().startsWith('{')) {
    try {
      const j = JSON.parse(opts.auth);
      if (j.client_id && j.client_secret && j.refresh_token) return j;
    } catch {}
  }
  if (opts.host && opts.user && opts.auth) {
    return { client_id: opts.host, client_secret: opts.user, refresh_token: opts.auth };
  }
  if (opts.client_id && opts.client_secret && opts.refresh_token) {
    return { client_id: opts.client_id, client_secret: opts.client_secret, refresh_token: opts.refresh_token };
  }
  return null;
}

export async function deliver(bundle, opts) {
  const creds = extractCreds(opts);
  if (!creds) {
    throw new Error(
      'codenanny gdrive: requires client_id, client_secret, refresh_token. ' +
      'Pass them as {host: client_id, user: client_secret, auth: refresh_token} or as JSON in `auth`. ' +
      'See @codenanny/adapters README for how to obtain these (one-time setup via Google Cloud Console + OAuth Playground).'
    );
  }

  const folderId =
    opts.path && opts.path !== '/' && opts.path !== ''
      ? opts.path.replace(/^\//, '').trim() || null
      : null;

  const accessToken = await refreshAccessToken(creds);
  const jsonBody = JSON.stringify(bundle, null, 2);
  const htmlBody = renderViewer(bundle);

  const jsonFile = await uploadMultipart({
    accessToken,
    name: 'index.json',
    mimeType: 'application/json',
    body: jsonBody,
    parentFolderId: folderId,
  });
  const htmlFile = await uploadMultipart({
    accessToken,
    name: 'index.html',
    mimeType: 'text/html',
    body: htmlBody,
    parentFolderId: folderId,
  });

  return {
    type: 'gdrive',
    location: `https://drive.google.com/file/d/${htmlFile.id}/view`,
    sessions_written: bundle.sessions.length,
    files: { json_id: jsonFile.id, html_id: htmlFile.id },
  };
}
