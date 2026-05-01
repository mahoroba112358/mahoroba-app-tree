// src/routes/apps.js
// config/apps.json を読み出し、各アプリのヘルス状況を集約

'use strict';

const express = require('express');
const path = require('node:path');
const fs = require('node:fs');

const router = express.Router();

const APPS_PATH = path.join(__dirname, '..', '..', 'config', 'apps.json');
const NODE_ENV = process.env.NODE_ENV || 'development';
const ENV_KEY = NODE_ENV === 'production' ? 'production' : 'local';

function loadApps() {
  const raw = fs.readFileSync(APPS_PATH, 'utf8');
  const data = JSON.parse(raw);
  const urls = (data.env && data.env[ENV_KEY]) || {};
  return data.apps.map((a) => ({
    ...a,
    url: urls[a.id] || '',
  }));
}

router.get('/', (req, res) => {
  try {
    const apps = loadApps();
    res.json({ ok: true, env: ENV_KEY, apps });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'apps_config_error' });
  }
});

router.get('/health', async (req, res) => {
  let apps;
  try {
    apps = loadApps();
  } catch {
    return res.status(500).json({ ok: false, error: 'apps_config_error' });
  }

  const results = await Promise.all(
    apps.map(async (a) => {
      if (!a.url || !a.healthPath) {
        return { id: a.id, ok: false, status: 'no_url' };
      }
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4_000);
        const r = await fetch(a.url + a.healthPath, { signal: ctrl.signal });
        clearTimeout(timer);
        return { id: a.id, ok: r.ok, status: r.ok ? 'up' : 'error', httpStatus: r.status };
      } catch (e) {
        return { id: a.id, ok: false, status: 'unreachable', error: e.name };
      }
    })
  );

  res.json({ ok: true, env: ENV_KEY, results });
});

module.exports = router;
