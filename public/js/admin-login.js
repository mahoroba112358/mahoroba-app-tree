'use strict';

document.getElementById('adminLoginForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const employeeId = document.getElementById('employeeId').value.trim();
  const password = document.getElementById('adminPass').value;
  const errorEl = document.getElementById('errorMsg');
  errorEl.hidden = true;

  try {
    const r = await fetch('/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, password }),
    });
    const data = await r.json();
    if (r.ok && data.ok) {
      location.href = '/admin/tree';
      return;
    }
    if (r.status === 429) {
      errorEl.textContent = 'ログイン試行回数が上限を超えました。しばらくしてから再試行してください。';
    } else if (r.status === 401 && data.error === 'common_login_required') {
      errorEl.textContent = '共通ログインが必要です。トップページへ戻ります。';
      setTimeout(() => (location.href = '/'), 1500);
    } else {
      errorEl.textContent = '認証に失敗しました。';
    }
    errorEl.hidden = false;
  } catch (e) {
    errorEl.textContent = 'mahoroba-app との通信に失敗しました。';
    errorEl.hidden = false;
  }
});
