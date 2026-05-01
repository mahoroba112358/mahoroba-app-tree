'use strict';

document.getElementById('loginForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const id = document.getElementById('loginId').value.trim();
  const password = document.getElementById('loginPass').value;
  const errorEl = document.getElementById('errorMsg');
  errorEl.hidden = true;

  try {
    const r = await fetch('/auth/common-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password }),
    });
    const data = await r.json();
    if (r.ok && data.ok) {
      location.href = '/tree';
      return;
    }
    if (r.status === 429) {
      errorEl.textContent = 'ログイン試行回数が上限を超えました。しばらくしてから再試行してください。';
    } else {
      errorEl.textContent = 'ID またはパスワードが正しくありません。';
    }
    errorEl.hidden = false;
  } catch (e) {
    errorEl.textContent = '通信エラー。ネットワーク接続を確認してください。';
    errorEl.hidden = false;
  }
});
