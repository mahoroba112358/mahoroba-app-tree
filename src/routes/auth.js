// src/routes/auth.js
// 共通ログイン（自前）+ 管理者ログイン（mahoroba-app API 経由）

'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const router = express.Router();

const COMMON_LOGIN_ID = process.env.COMMON_LOGIN_ID || 'mahoroba-construction';
const COMMON_LOGIN_PASS_HASH = process.env.COMMON_LOGIN_PASS_HASH || '';

const LOCKOUT_THRESHOLD = parseInt(process.env.LOGIN_LOCKOUT_THRESHOLD || '5', 10);
const LOCKOUT_DURATION_MS = parseInt(process.env.LOGIN_LOCKOUT_DURATION_MS || '900000', 10);

// メモリ内ロックアウト記録（IP + ID キー）。本番マルチインスタンス時は Redis 等に外出し
const failures = new Map();
function failKey(req, id) {
  return `${req.ip || 'unknown'}|${id || ''}`;
}
function isLocked(key) {
  const f = failures.get(key);
  if (!f) return false;
  if (Date.now() - f.lastAt > LOCKOUT_DURATION_MS) {
    failures.delete(key);
    return false;
  }
  return f.count >= LOCKOUT_THRESHOLD;
}
function recordFail(key) {
  const now = Date.now();
  const f = failures.get(key) || { count: 0, lastAt: now };
  if (now - f.lastAt > LOCKOUT_DURATION_MS) {
    f.count = 0;
  }
  f.count += 1;
  f.lastAt = now;
  failures.set(key, f);
}
function clearFail(key) {
  failures.delete(key);
}

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_LOGIN_PER_MIN || '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
});

// ----- 共通ログイン -----
router.post(
  '/common-login',
  loginLimiter,
  body('id').isString().isLength({ min: 1, max: 64 }),
  body('password').isString().isLength({ min: 1, max: 128 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: 'invalid_input' });

    const { id, password } = req.body;
    const key = failKey(req, id);
    if (isLocked(key)) return res.status(429).json({ ok: false, error: 'locked' });

    if (id !== COMMON_LOGIN_ID || !COMMON_LOGIN_PASS_HASH) {
      recordFail(key);
      return res.status(401).json({ ok: false, error: 'invalid_credentials' });
    }
    let ok = false;
    try {
      ok = await bcrypt.compare(password, COMMON_LOGIN_PASS_HASH);
    } catch {
      ok = false;
    }
    if (!ok) {
      recordFail(key);
      return res.status(401).json({ ok: false, error: 'invalid_credentials' });
    }

    clearFail(key);
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ ok: false, error: 'session' });
      req.session.commonAuth = true;
      req.session.commonAt = Date.now();
      res.json({ ok: true });
    });
  }
);

// ----- 管理者ログイン（mahoroba-app の API 経由） -----
router.post(
  '/admin-login',
  loginLimiter,
  body('employeeId').isString().isLength({ min: 1, max: 32 }),
  body('password').isString().isLength({ min: 1, max: 128 }),
  async (req, res) => {
    if (!req.session || !req.session.commonAuth) {
      return res.status(401).json({ ok: false, error: 'common_login_required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: 'invalid_input' });

    const { employeeId, password } = req.body;
    const key = failKey(req, `admin:${employeeId}`);
    if (isLocked(key)) return res.status(429).json({ ok: false, error: 'locked' });

    const baseUrl = process.env.MAHOROBA_APP_BASE_URL || 'http://localhost:3001';
    const apiPath = process.env.MAHOROBA_APP_AUTH_API || '/api/auth/verify-admin';
    const sharedSecret = process.env.MAHOROBA_APP_SHARED_SECRET || '';

    let verifyOk = false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      const resp = await fetch(baseUrl + apiPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tree-Token': sharedSecret,
        },
        body: JSON.stringify({ employeeId, password }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (resp.ok) {
        const data = await resp.json();
        verifyOk = data && data.ok === true && data.role === 'admin';
      }
    } catch (e) {
      console.error('[admin-login] mahoroba-app への問合せ失敗:', e.message);
    }

    if (!verifyOk) {
      recordFail(key);
      return res.status(401).json({ ok: false, error: 'invalid_credentials' });
    }

    clearFail(key);
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ ok: false, error: 'session' });
      req.session.commonAuth = true;
      req.session.adminAuth = true;
      req.session.adminEmployeeId = employeeId;
      req.session.adminAt = Date.now();
      res.json({ ok: true });
    });
  }
);

// ----- ログアウト -----
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('tree.sid');
    res.json({ ok: true });
  });
});

// ----- 認証状態取得 -----
router.get('/me', (req, res) => {
  res.json({
    commonAuth: !!(req.session && req.session.commonAuth),
    adminAuth: !!(req.session && req.session.adminAuth),
    adminEmployeeId: (req.session && req.session.adminEmployeeId) || null,
  });
});

// ----- ミドルウェア -----
function requireCommonAuth(req, res, next) {
  if (req.session && req.session.commonAuth) return next();
  if (req.accepts('html') && !req.path.startsWith('/api/')) {
    return res.redirect('/');
  }
  res.status(401).json({ ok: false, error: 'common_login_required' });
}

function requireAdminAuth(req, res, next) {
  if (req.session && req.session.commonAuth && req.session.adminAuth) return next();
  if (req.accepts('html') && !req.path.startsWith('/api/')) {
    return res.redirect('/admin/login');
  }
  res.status(401).json({ ok: false, error: 'admin_login_required' });
}

module.exports = { router, requireCommonAuth, requireAdminAuth };
