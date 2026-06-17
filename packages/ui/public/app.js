const BASE = '/codenanny/api';

let currentView = 'sessions';
let cachedProjects = [];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function formatTs(ts) {
  if (!ts) return '';
  const n = typeof ts === 'number' ? (ts < 1e12 ? ts * 1000 : ts) : ts;
  return new Date(n).toLocaleString();
}

async function loadStats() {
  try {
    const r = await fetch(`${BASE}/stats`);
    const s = await r.json();
    document.getElementById('stats').textContent =
      `${s.sessions} sessions · ${s.files} files · ${s.prompts} prompts`;
  } catch {}
}

async function refreshProjectsCache() {
  try {
    const r = await fetch(`${BASE}/projects`);
    cachedProjects = await r.json();
  } catch {
    cachedProjects = [];
  }
}

// ---------- SESSIONS view ----------

async function loadSessions() {
  const r = await fetch(`${BASE}/sessions?limit=200`);
  const sessions = await r.json();
  const ul = document.getElementById('list');
  ul.innerHTML = '';
  for (const s of sessions) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="title">${esc(s.title)}</div>
      <div class="meta">${esc(s.project_id || 'no project')} · ${formatTs(s.ended_at)}</div>
    `;
    li.onclick = () => openSession(s.id);
    ul.appendChild(li);
  }
}

async function openSession(id) {
  await refreshProjectsCache();
  const r = await fetch(`${BASE}/sessions/${encodeURIComponent(id)}`);
  if (!r.ok) {
    document.getElementById('detail').innerHTML = `<div class="empty">Session not found.</div>`;
    return;
  }
  const { session, prompts, files } = await r.json();
  document.getElementById('detail').innerHTML = `
    <div class="session-header">
      <div class="title-row">
        <h2 id="session-title">${esc(session.title)}</h2>
        <button class="btn-small" id="edit-session">Edit</button>
      </div>
      <div class="meta">${esc(session.project_id || 'no project')} · ${formatTs(session.started_at)} → ${formatTs(session.ended_at)}</div>
    </div>
    <div class="tabs">
      <button class="tab active" data-tab="prompts">Prompts (${prompts.length})</button>
      <button class="tab" data-tab="files">Files (${files.length})</button>
    </div>
    <div class="tab-content" id="prompts-pane">
      ${prompts.map((p) => `
        <div class="prompt ${esc(p.role)}">
          <div class="role">${esc(p.role)} <span class="ts">${formatTs(p.ts)}</span></div>
          <div class="text">${esc(p.text).replace(/\n/g, '<br>')}</div>
        </div>
      `).join('')}
    </div>
    <div class="tab-content hidden" id="files-pane">
      ${files.map((f) => `
        <div class="file">
          <div class="action">${esc(f.action)}</div>
          <div class="path">${esc(f.path)}</div>
          <div class="ts">${formatTs(f.ts)}</div>
        </div>
      `).join('')}
    </div>
  `;
  document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => switchTab(t.dataset.tab)));
  document.getElementById('edit-session').onclick = () => showEditForm(session);
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach((p) => p.classList.toggle('hidden', p.id !== `${name}-pane`));
}

function showEditForm(session) {
  const header = document.querySelector('.session-header');
  header.innerHTML = `
    <div class="edit-form">
      <label>Title<input id="edit-title" value="${esc(session.title)}" placeholder="Session title"></label>
      <label>Project
        <select id="edit-project">
          <option value="">— No project —</option>
          ${cachedProjects.map((p) => `<option value="${esc(p.id)}" ${p.id === session.project_id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
          <option value="__new__">+ Create new project...</option>
        </select>
      </label>
      <div class="edit-actions">
        <button class="btn primary" id="save-edit">Save</button>
        <button class="btn" id="cancel-edit">Cancel</button>
      </div>
    </div>
  `;
  document.getElementById('save-edit').onclick = async () => {
    const title = document.getElementById('edit-title').value.trim();
    let project_id = document.getElementById('edit-project').value;
    if (project_id === '__new__') {
      const name = prompt('New project name?');
      if (!name) return;
      const r = await fetch(`${BASE}/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const p = await r.json();
      project_id = p.id;
    }
    await fetch(`${BASE}/sessions/${encodeURIComponent(session.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, project_id: project_id || null }),
    });
    await refreshProjectsCache();
    if (currentView === 'sessions') await loadSessions();
    openSession(session.id);
  };
  document.getElementById('cancel-edit').onclick = () => openSession(session.id);
}

// ---------- MEDIA view ----------

async function loadMedia() {
  document.getElementById('list').innerHTML = '<li class="hint">Showing all files in the detail pane &rarr;</li>';
  const r = await fetch(`${BASE}/media?limit=2000`);
  const files = await r.json();
  document.getElementById('detail').innerHTML = `
    <h2>Media</h2>
    <p class="meta">${files.length} files across all sessions</p>
    <div class="media-grid">
      ${files.map((f) => `
        <div class="media-item" data-session="${esc(f.session_id)}">
          <div class="media-action">${esc(f.action)}</div>
          <div class="media-path">${esc(f.path)}</div>
          <div class="media-ctx">${esc(f.project_id || 'unassigned')} · ${esc(f.session_title || '')} · ${formatTs(f.ts)}</div>
        </div>
      `).join('')}
    </div>
  `;
  document.querySelectorAll('.media-item').forEach((el) => {
    el.onclick = () => openSession(el.dataset.session);
  });
}

// ---------- PROJECTS view ----------

async function loadProjectsView() {
  await refreshProjectsCache();
  document.getElementById('list').innerHTML = '';
  for (const p of cachedProjects) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="title">${esc(p.name)}</div>
      <div class="meta">${esc(p.id)}</div>
    `;
    li.onclick = () => filterByProject(p.id);
    document.getElementById('list').appendChild(li);
  }
  document.getElementById('detail').innerHTML = `
    <h2>Projects</h2>
    <p class="meta">${cachedProjects.length} projects</p>
    <button class="btn primary" id="new-project">+ New project</button>
  `;
  document.getElementById('new-project').onclick = async () => {
    const name = prompt('Project name?');
    if (!name) return;
    await fetch(`${BASE}/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    loadProjectsView();
  };
}

async function filterByProject(projectId) {
  const r = await fetch(`${BASE}/sessions?project_id=${encodeURIComponent(projectId)}&limit=500`);
  const sessions = await r.json();
  document.getElementById('detail').innerHTML = `
    <h2>${esc(projectId)}</h2>
    <p class="meta">${sessions.length} sessions</p>
    <ul class="filtered-list">
      ${sessions.map((s) => `
        <li data-id="${esc(s.id)}">
          <div class="title">${esc(s.title)}</div>
          <div class="meta">${formatTs(s.ended_at)}</div>
        </li>
      `).join('')}
    </ul>
  `;
  document.querySelectorAll('.filtered-list li').forEach((el) => {
    el.onclick = () => openSession(el.dataset.id);
  });
}

// ---------- SEARCH ----------

async function runSearch(q) {
  if (!q) return loadSessions();
  const r = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}`);
  const hits = await r.json();
  const ul = document.getElementById('list');
  ul.innerHTML = '';
  for (const h of hits) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="title">${h.snippet || esc(h.text || '')}</div>
      <div class="meta">${esc(h.role)} · ${formatTs(h.ts)}</div>
    `;
    li.onclick = () => openSession(h.session_id);
    ul.appendChild(li);
  }
}

// ---------- VIEW SWITCH ----------

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.nav-link').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === view)
  );
  if (view === 'sessions') loadSessions();
  else if (view === 'media') loadMedia();
  else if (view === 'projects') loadProjectsView();
}

document.querySelectorAll('.nav-link').forEach((b) => {
  b.onclick = () => switchView(b.dataset.view);
});

let searchDebounce;
document.getElementById('search').addEventListener('input', (e) => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    if (currentView !== 'sessions') switchView('sessions');
    runSearch(e.target.value.trim());
  }, 250);
});

loadStats();
refreshProjectsCache();
loadSessions().catch((err) => {
  document.getElementById('list').innerHTML =
    `<li class="error">Error loading sessions: ${esc(err.message)}</li>`;
});
