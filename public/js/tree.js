'use strict';

async function loadApps() {
  const grid = document.getElementById('appsGrid');
  grid.textContent = '';

  let appsData;
  let healthData;
  try {
    const [a, h] = await Promise.all([
      fetch('/api/apps/').then((r) => r.json()),
      fetch('/api/apps/health').then((r) => r.json()),
    ]);
    appsData = a;
    healthData = h;
  } catch {
    grid.textContent = 'アプリ一覧の取得に失敗しました。';
    return;
  }

  if (!appsData.ok) {
    grid.textContent = '設定読み込みエラー';
    return;
  }

  const healthMap = {};
  if (healthData && healthData.ok) for (const r of healthData.results) healthMap[r.id] = r;

  for (const app of appsData.apps) {
    const card = document.createElement('a');
    card.className = 'app-card';
    card.href = app.url || '#';
    card.target = '_blank';
    card.rel = 'noopener noreferrer';

    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.textContent = app.icon || '🔗';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = app.name;

    const desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = app.description || '';

    const health = document.createElement('span');
    health.className = 'health checking';
    health.textContent = '確認中…';
    const h = healthMap[app.id];
    if (h) {
      if (h.ok) {
        health.className = 'health up';
        health.textContent = '稼働中';
      } else {
        health.className = 'health down';
        health.textContent = '応答なし';
      }
    }

    card.append(icon, name, desc, health);
    grid.append(card);
  }
}

async function loadDocs() {
  const list = document.getElementById('docsList');
  list.textContent = '';

  let data;
  try {
    data = await fetch('/api/docs/list').then((r) => r.json());
  } catch {
    list.textContent = '説明書一覧の取得に失敗しました。';
    return;
  }
  if (!data.ok) return;

  if (data.files.length === 0) {
    list.textContent = '説明書 PDF が見つかりません。サーバ側で `npm run convert-docs` を実行してください。';
    return;
  }

  for (const f of data.files) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'doc-chip' + (f.isAdminOnly ? ' admin' : '');
    chip.textContent = f.name;
    chip.addEventListener('click', () => openPdf(f.name, f.url));
    list.append(chip);
  }
}

function openPdf(name, url) {
  const viewer = document.getElementById('pdfViewer');
  const frame = document.getElementById('pdfFrame');
  const title = document.getElementById('pdfTitle');
  title.textContent = name;
  frame.src = url + '#toolbar=0&navpanes=0&view=FitH';
  viewer.hidden = false;
  viewer.scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('pdfClose').addEventListener('click', () => {
  document.getElementById('pdfViewer').hidden = true;
  document.getElementById('pdfFrame').src = 'about:blank';
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/auth/logout', { method: 'POST' });
  location.href = '/';
});

document.getElementById('ragSearchBtn').addEventListener('click', runSearch);
document.getElementById('ragQuery').addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') runSearch();
});

async function runSearch() {
  const q = document.getElementById('ragQuery').value.trim();
  const out = document.getElementById('ragResults');
  out.textContent = '';
  if (!q) return;

  let data;
  try {
    data = await fetch('/api/ai/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, topK: 3 }),
    }).then((r) => r.json());
  } catch {
    out.textContent = '検索エラー';
    return;
  }
  if (!data.ok || data.results.length === 0) {
    out.textContent = '一致する箇所が見つかりませんでした。';
    return;
  }

  for (const r of data.results) {
    const card = document.createElement('div');
    card.className = 'rag-result';
    const src = document.createElement('div');
    src.className = 'source';
    src.textContent = `${r.source}（スコア: ${r.score.toFixed(3)}）`;
    const ex = document.createElement('div');
    ex.className = 'excerpt';
    ex.textContent = r.excerpt;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'open-btn';
    btn.textContent = '該当 PDF を開く';
    btn.addEventListener('click', () =>
      openPdf(r.source, '/api/docs/file/' + encodeURIComponent(r.source))
    );
    card.append(src, ex, btn);
    out.append(card);
  }
}

loadApps();
loadDocs();
