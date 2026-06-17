export function renderViewer(bundle) {
  const data = JSON.stringify(bundle).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>codenanny export &mdash; ${bundle.generated_at}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; background: #0e1116; color: #e6e6e6; max-width: 900px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: #8b949e; font-size: 13px; margin-bottom: 20px; }
  .session { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
  .session h3 { margin: 0 0 4px; font-size: 16px; cursor: pointer; }
  .session .stat { color: #8b949e; font-size: 12px; }
  .session .details { margin-top: 12px; display: none; }
  .session.open .details { display: block; }
  .prompt { background: #0d1117; padding: 10px; border-radius: 4px; margin: 8px 0; font-size: 13px; white-space: pre-wrap; }
  .prompt .role { font-weight: 600; color: #8b949e; text-transform: uppercase; font-size: 11px; }
  .file { font-family: ui-monospace, monospace; font-size: 12px; padding: 4px 0; border-bottom: 1px solid #21262d; }
  input { width: 100%; padding: 10px; background: #0d1117; border: 1px solid #30363d; color: #e6e6e6; border-radius: 6px; font-size: 14px; margin-bottom: 16px; }
</style>
</head>
<body>
<h1>codenanny export</h1>
<div class="meta">Generated ${bundle.generated_at} &middot; ${bundle.stats.sessions} sessions &middot; ${bundle.stats.files} files &middot; ${bundle.stats.prompts} prompts</div>
<input id="q" placeholder="Filter sessions...">
<div id="list"></div>
<script>
const data = ${data};
const list = document.getElementById('list');
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function render(filter) {
  filter = (filter || '').toLowerCase();
  list.innerHTML = '';
  for (const s of data.sessions) {
    const hay = ((s.title || '') + ' ' + (s.project_id || '')).toLowerCase();
    if (filter && !hay.includes(filter)) continue;
    const div = document.createElement('div');
    div.className = 'session';
    div.innerHTML =
      '<h3>' + esc(s.title) + '</h3>' +
      '<div class="stat">' + esc(s.project_id || '') + ' &middot; ' + (s.prompts ? s.prompts.length : 0) + ' prompts &middot; ' + (s.files ? s.files.length : 0) + ' files</div>' +
      '<div class="details">' +
        (s.prompts || []).slice(0, 50).map(p => '<div class="prompt"><span class="role">' + esc(p.role) + '</span> ' + esc(p.text || '') + '</div>').join('') +
        (s.files || []).map(f => '<div class="file">' + esc(f.action) + ' &mdash; ' + esc(f.path) + '</div>').join('') +
      '</div>';
    div.querySelector('h3').onclick = () => div.classList.toggle('open');
    list.appendChild(div);
  }
}
document.getElementById('q').addEventListener('input', e => render(e.target.value));
render('');
</script>
</body>
</html>`;
}
