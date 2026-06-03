async function callApi(path, method='GET', token=null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  const res = await fetch(path, { method, headers });
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { return { status: res.status, body: text }; }
}

const out = document.getElementById('output');
const tokenInput = document.getElementById('token');

document.getElementById('btn-audit').addEventListener('click', async () => {
  out.value = 'Running audit...';
  const t = tokenInput.value.trim();
  const result = await callApi('/api/admin/audit-indexes', 'GET', t || null);
  out.value = JSON.stringify(result, null, 2);
});

document.getElementById('btn-recompute').addEventListener('click', async () => {
  out.value = 'Fetching dry-run diff...';
  const t = tokenInput.value.trim();
  // fetch dry-run diff first
  const dry = await callApi('/api/admin/recompute-like-counts/dry', 'GET', t || null);
  out.value = JSON.stringify(dry, null, 2);

  // present a concise summary and ask for confirmation
  const summaryLines = [];
  if (dry && dry.success && dry.diff) {
    for (const [col, info] of Object.entries(dry.diff)) {
      summaryLines.push(`${col}: matched=${info.matched}, anomalies=${info.anomalies}`);
    }
  }
  const confirmMsg = 'Dry-run summary:\n' + summaryLines.join('\n') + '\n\nProceed to apply recompute to the DB?';
  // Prefer site's custom modal if available
  let proceed = false;
  if (typeof showConfirmModal === 'function') {
    proceed = await showConfirmModal(confirmMsg);
  } else {
    proceed = confirm(confirmMsg);
  }
  if (!proceed) {
    out.value = 'Recompute cancelled by user.';
    return;
  }

  out.value = 'Running recompute...';
  const result = await callApi('/api/admin/recompute-like-counts', 'POST', t || null);
  out.value = JSON.stringify(result, null, 2);
});

document.getElementById('btn-history').addEventListener('click', async () => {
  out.value = 'Loading history...';
  const t = tokenInput.value.trim();
  const result = await callApi('/api/admin/audits', 'GET', t || null);
  out.value = JSON.stringify(result, null, 2);
});
