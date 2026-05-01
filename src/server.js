// src/server.js
// mahoroba-app-tree エントリポイント
// セキュリティ: helmet / CSRF / rate-limit / セッション / ログ / エラー捕捉

'use strict';

require('dotenv').config();

const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const { router: authRouter, requireCommonAuth, requireAdminAuth } = require('./routes/auth');
const appsRouter = require('./routes/apps');
const docsRouter = require('./routes/docs');
const aiRouter = require('./routes/ai');

const PORT = parseInt(process.env.PORT || '3002', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

const app = express();

// プロキシ配下（Tailscale Funnel 等）で正しい IP を取得
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ----- ロギング -----
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const accessLog = fs.createWriteStream(path.join(LOG_DIR, 'access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLog }));
if (!IS_PROD) app.use(morgan('dev'));

// ----- セキュリティヘッダ（D-1〜D-6） -----
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // PDF.js viewer 用に最小限許可
        imgSrc: ["'self'", 'data:', 'blob:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        connectSrc: ["'self'"],
        workerSrc: ["'self'", 'blob:'], // PDF.js Worker
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: IS_PROD ? { maxAge: 31536000, includeSubDomains: true, preload: false } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// ----- 圧縮・パーサ -----
app.use(compression());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());

// ----- セッション -----
app.use(
  session({
    name: 'tree.sid',
    secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-in-prod',
    resave: false,
    saveUninitialized: false,
    rolling: true, // 操作ごとに延長
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.SESSION_COOKIE_SECURE === 'true' || IS_PROD,
      maxAge: parseInt(process.env.SESSION_MAX_AGE_MS || '3600000', 10),
    },
  })
);

// ----- グローバルレート（F-1） -----
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_GLOBAL_PER_MIN || '100', 10),
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ----- ルート -----
// 共通ログイン画面 / 共通ログイン API
app.use('/auth', authRouter);

// 共通ログイン未通過は /auth/login へ誘導（API は除外）
app.get('/', (req, res) => {
  if (req.session && req.session.commonAuth) {
    return res.redirect('/tree');
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// 一般 tree（共通ログイン必須）
app.get('/tree', requireCommonAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'tree.html'));
});

// 管理者ログイン画面（共通ログイン必須）
app.get('/admin/login', requireCommonAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin-login.html'));
});

// 管理者 tree（管理者ログイン必須）
app.get('/admin/tree', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin-tree.html'));
});

// 接続先アプリ一覧 + ヘルス監視
app.use('/api/apps', requireCommonAuth, appsRouter);

// PDF 配信（権限分離は docsRouter 内）
app.use('/api/docs', requireCommonAuth, docsRouter);

// ローカル RAG 検索
app.use('/api/ai', requireCommonAuth, aiRouter);

// 静的（CSS/JS のみ。HTML は明示ルートで認証ゲート経由）
app.use(
  '/static',
  express.static(path.join(__dirname, '..', 'public'), {
    index: false,
    dotfiles: 'deny',
    fallthrough: true,
    setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=300'),
  })
);

// ヘルスチェック（自身）
app.get('/api/health', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    ok: true,
    uptime: process.uptime(),
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    timestamp: new Date().toISOString(),
  });
});

// 404
app.use((req, res) => res.status(404).json({ ok: false, error: 'not_found' }));

// エラーハンドラ（H-1）
app.use((err, req, res, _next) => {
  console.error('[error]', err);
  fs.appendFile(
    path.join(LOG_DIR, 'error.log'),
    `${new Date().toISOString()}\t${req.method} ${req.url}\t${err.stack || err}\n`,
    () => {}
  );
  if (err.code === 'EBADCSRFTOKEN') return res.status(403).json({ ok: false, error: 'csrf' });
  res.status(err.status || 500).json({ ok: false, error: IS_PROD ? 'server_error' : String(err.message) });
});

// グローバル捕捉（H-2）
process.on('uncaughtException', (e) => {
  console.error('[uncaughtException]', e);
});
process.on('unhandledRejection', (e) => {
  console.error('[unhandledRejection]', e);
});

app.listen(PORT, () => {
  console.log(`mahoroba-app-tree listening on http://localhost:${PORT}  (env=${NODE_ENV})`);
});
