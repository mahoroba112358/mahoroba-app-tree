// src/routes/docs.js
// PDF 閲覧専用配信。一般 → 一般説明書 / 管理者 → 管理者仕様書

'use strict';

const express = require('express');
const path = require('node:path');
const fs = require('node:fs');

const router = express.Router();

const PDF_DIR = path.join(__dirname, '..', '..', 'docs', 'pdf');

// ホワイトリスト: 役割ごとに閲覧可能な PDF ファイル名
const ALLOWED_FILES = {
  general: ['宿舎食事_仕様書.pdf'],
  admin: ['宿舎食事_管理者_仕様書.pdf'],
};

router.get('/list', (req, res) => {
  const isAdmin = !!(req.session && req.session.adminAuth);
  const allowed = isAdmin
    ? [...ALLOWED_FILES.general, ...ALLOWED_FILES.admin]
    : [...ALLOWED_FILES.general];

  const files = allowed
    .filter((name) => fs.existsSync(path.join(PDF_DIR, name)))
    .map((name) => ({
      name,
      url: `/api/docs/file/${encodeURIComponent(name)}`,
      isAdminOnly: ALLOWED_FILES.admin.includes(name),
    }));

  res.json({ ok: true, isAdmin, files });
});

router.get('/file/:name', (req, res) => {
  const requested = req.params.name;
  const isAdmin = !!(req.session && req.session.adminAuth);

  const allowed = isAdmin
    ? [...ALLOWED_FILES.general, ...ALLOWED_FILES.admin]
    : [...ALLOWED_FILES.general];

  if (!allowed.includes(requested)) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  const safeName = path.basename(requested);
  const fullPath = path.resolve(PDF_DIR, safeName);
  if (!fullPath.startsWith(PDF_DIR + path.sep)) {
    return res.status(400).json({ ok: false, error: 'invalid_path' });
  }
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(safeName)}"`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  const stream = fs.createReadStream(fullPath);
  stream.on('error', () => res.status(500).end());
  stream.pipe(res);
});

module.exports = router;
