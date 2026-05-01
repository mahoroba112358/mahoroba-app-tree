# セキュリティ実装リスト（IPA 準拠）

参照: 「安全なウェブサイトの作り方」「安全なウェブサイト運用の手引き」（IPA）/ `D:\GitHub\ipa_deploy.pdf`

mahoroba-hub / mahoroba-app と同じ水準で実装。各項目に**実装状態**列を持ち、進捗管理に使用。

凡例: **DONE** = 実装完了 / **WIP** = 実装中 / **TODO** = 未実装 / **N/A** = 該当しない / **本番のみ** = 本番デプロイ時に有効

## A. 認証・セッション

| # | 項目 | 実装 | 状態 | 実装箇所 |
|---|---|---|---|---|
| A-1 | パスワードのハッシュ化 | bcrypt（cost=12）。共通ログインも `.env` にハッシュ保存 | **DONE** | `src/routes/auth.js` `bcrypt.compare` / `.env` `COMMON_LOGIN_PASS_HASH` |
| A-2 | セッション管理 | `express-session` + `cookie: { httpOnly, sameSite: 'strict', secure: 本番true }` | **DONE** | `src/server.js` session 設定 |
| A-3 | セッション有効期限 | 1 時間で自動失効、操作ごとに延長（rolling） | **DONE** | `src/server.js` `rolling: true`, `maxAge: 3600000` |
| A-4 | セッション ID 再生成 | ログイン成功時 / 権限昇格時（一般→管理者）に regenerate | **DONE** | `src/routes/auth.js` `req.session.regenerate` 各ログイン後 |
| A-5 | ログアウト処理 | サーバ側セッション破棄 + Cookie 削除 | **DONE** | `src/routes/auth.js` `/auth/logout` |
| A-6 | ブルートフォース対策 | 同一 IP / 同一 ID で 5 回失敗 → 15 分ロック | **DONE** | `src/routes/auth.js` `failures` Map + `LOGIN_LOCKOUT_*` |
| A-7 | 認証情報の保管 | `.env`（パーミッション 600）、Git 管理外、コンテナ内のみ読込 | **DONE** | `.gitignore` で `.env` 除外、`docker-compose.yml` `env_file` |

## B. 通信

| # | 項目 | 実装 | 状態 | 実装箇所 |
|---|---|---|---|---|
| B-1 | HTTPS 化 | Tailscale Funnel が自動 TLS 終端（`*.ts.net`） | **本番のみ** | 本番環境の Tailscale 設定 |
| B-2 | HSTS | `helmet({ hsts: { maxAge: 31536000, includeSubDomains: true } })` | **本番のみ** | `src/server.js` `IS_PROD` 条件 |
| B-3 | 内部 API 通信保護 | tree ↔ app は共有秘密ヘッダ + Docker 内部ネットワーク限定 | **DONE** | `src/routes/auth.js` `X-Tree-Token` / `MAHOROBA_APP_SHARED_SECRET` |

## C. 入力検証・エスケープ（OWASP）

| # | 項目 | 実装 | 状態 | 実装箇所 |
|---|---|---|---|---|
| C-1 | XSS 対策 | フロント出力は `textContent` 使用、HTML 直挿入禁止。CSP ヘッダ厳格化 | **DONE** | `public/js/*.js` `textContent` のみ使用 / `src/server.js` CSP |
| C-2 | SQL インジェクション | tree は DB 直アクセスしない（API 経由のみ）。app 側はプリペアド徹底 | **N/A** | tree に DB なし |
| C-3 | OS コマンドインジェクション | `child_process.exec` 不使用 | **DONE** | コードベースで `child_process` 使用なし |
| C-4 | パストラバーサル | PDF 配信時はファイル名ホワイトリスト方式。`path.resolve` で `docs/pdf/` 配下確認 | **DONE** | `src/routes/docs.js` `ALLOWED_FILES` + `path.resolve` 検査 |
| C-5 | CSRF 対策 | `sameSite: 'strict'` Cookie で state 変更リクエスト防御 | **DONE** | `src/server.js` session cookie。csurf は予備として package.json に保持 |
| C-6 | オープンリダイレクト | 外部 URL は `apps.json` のホワイトリスト経由のみ | **DONE** | `src/routes/apps.js` で `apps.json` 参照のみ |
| C-7 | 入力長・型検証 | `express-validator` で全入力検証 | **DONE** | `src/routes/auth.js` / `src/routes/ai.js` `body(...)` 検証 |

## D. HTTP ヘッダ（helmet）

| # | 項目 | 実装 | 状態 | 実装箇所 |
|---|---|---|---|---|
| D-1 | X-Content-Type-Options | `nosniff` | **DONE** | helmet デフォルト |
| D-2 | X-Frame-Options | `DENY`（クリックジャッキング対策） | **DONE** | helmet + CSP `frame-ancestors 'none'` |
| D-3 | Content-Security-Policy | `default-src 'self'`、PDF.js Worker 用 `blob:` のみ許可 | **DONE** | `src/server.js` helmet `contentSecurityPolicy` |
| D-4 | Referrer-Policy | `strict-origin-when-cross-origin` | **DONE** | `src/server.js` helmet `referrerPolicy` |
| D-5 | Permissions-Policy | カメラ・マイク等を全て deny | **TODO** | 別途明示設定が必要 |
| D-6 | サーバ情報秘匿 | `X-Powered-By` 削除、Server ヘッダ最小化 | **DONE** | `src/server.js` `app.disable('x-powered-by')` |

## E. PDF 配信（閲覧のみ）

| # | 項目 | 実装 | 状態 | 実装箇所 |
|---|---|---|---|---|
| E-1 | 認証必須 | 全 PDF エンドポイントは認証ミドルウェア通過必須 | **DONE** | `src/server.js` `requireCommonAuth` を `/api/docs` に適用 |
| E-2 | inline 配信 | `Content-Disposition: inline; filename=...` | **DONE** | `src/routes/docs.js` レスポンスヘッダ |
| E-3 | キャッシュ抑止 | `Cache-Control: no-store, no-cache, must-revalidate` | **DONE** | `src/routes/docs.js` レスポンスヘッダ |
| E-4 | ダウンロード抑止 | フロント側で右クリック保存・印刷ボタン抑止 | **WIP** | iframe `#toolbar=0` 指定済み。Phase 3 で PDF.js 同梱化により強化予定 |
| E-5 | 配信範囲 | `docs/pdf/` 配下のみ。シンボリックリンク禁止 | **DONE** | `src/routes/docs.js` `path.resolve` + ホワイトリスト |
| E-6 | 権限分離 | 一般 → 一般説明書のみ / 管理者 → 管理者仕様書のみ | **DONE** | `src/routes/docs.js` `ALLOWED_FILES.general/admin` |

## F. レート制限・DoS 対策

| # | 項目 | 実装 | 状態 | 実装箇所 |
|---|---|---|---|---|
| F-1 | グローバルレート | `express-rate-limit` 全体 100 req/min/IP | **DONE** | `src/server.js` グローバル `rateLimit` |
| F-2 | ログインレート | 認証エンドポイントは 10 req/min/IP | **DONE** | `src/routes/auth.js` `loginLimiter` |
| F-3 | RAG クエリレート | 検索は 30 req/min/IP（CPU 負荷高のため） | **DONE** | `src/routes/ai.js` `ragLimiter` |
| F-4 | リクエストサイズ | `express.json({ limit: '100kb' })` | **DONE** | `src/server.js` body parser 設定 |
| F-5 | タイムアウト | リクエスト 30 秒で打ち切り | **TODO** | `server.timeout` 設定追加が必要 |

## G. ロギング・監査

| # | 項目 | 実装 | 状態 | 実装箇所 |
|---|---|---|---|---|
| G-1 | 認証成功/失敗ログ | morgan アクセスログで HTTP ステータス記録、失敗は 401 で識別可 | **WIP** | `src/server.js` morgan combined。専用認証ログ出力は今後追加 |
| G-2 | 管理者操作ログ | 管理者ログイン後の操作を全記録 | **TODO** | 管理者操作専用ログ未実装 |
| G-3 | エラーログ分離 | `access.log` / `error.log` を分離保存 | **DONE** | `src/server.js` morgan + エラーハンドラで分離 |
| G-4 | ログローテーション | サイズ・日次でローテート、90 日保管 | **TODO** | logrotate / `winston-daily-rotate-file` 等で対応予定 |
| G-5 | 機微情報マスク | ログ出力時にパスワード・トークンを `***` でマスク | **DONE** | パスワード/トークンは body に含み morgan は URL のみ記録 |

## H. エラー処理

| # | 項目 | 実装 | 状態 | 実装箇所 |
|---|---|---|---|---|
| H-1 | エラー詳細秘匿 | 本番でスタックトレース・SQL 文をユーザに返さない | **DONE** | `src/server.js` エラーハンドラ `IS_PROD` 分岐 |
| H-2 | グローバル捕捉 | `process.on('uncaughtException')` / `unhandledRejection` で記録後安全停止 | **DONE** | `src/server.js` 末尾 |
| H-3 | 4xx/5xx 統一画面 | エラー種別ごとに最小限のメッセージのみ表示 | **DONE** | `src/server.js` 404 ハンドラ + エラーハンドラ |

## I. デプロイ・運用

| # | 項目 | 実装 | 状態 | 実装箇所 |
|---|---|---|---|---|
| I-1 | 依存パッケージ監査 | `npm audit` を CI で定期実行、Critical/High は即対応 | **TODO** | CI 設定 / 月次運用ルール化 |
| I-2 | パッケージ最小化 | 不要な依存を入れない、`npm ci --omit=dev` で本番ビルド | **DONE** | `Dockerfile` で `npm ci --omit=dev` |
| I-3 | コンテナリソース上限 | メモリ 512MB / CPU 1 コア | **DONE** | `docker-compose.yml` `deploy.resources.limits` |
| I-4 | バックアップ | 説明書・設定ファイルを週次自動バックアップ | **TODO** | DS225+ 側のスケジュールタスクで対応予定 |
| I-5 | 既存ファイル非干渉 | DS225+ の他フォルダには一切アクセスしない | **DONE** | `docker-compose.yml` で `volume1/mahoroba-app-tree/` 配下のみマウント |
| I-6 | シークレット管理 | `.env` は Git 管理外、サーバへは scp + パーミッション 600 | **DONE** | `.gitignore` で `.env` 除外 |
| I-7 | 最小権限実行 | コンテナ内は非 root ユーザで起動 | **DONE** | `Dockerfile` `USER app`、`docker-compose.yml` `user: 1000:1000` + `no-new-privileges` |

## J. ローカル RAG 固有

| # | 項目 | 実装 | 状態 | 実装箇所 |
|---|---|---|---|---|
| J-1 | 外部送信ゼロ | 質問文・埋め込み・PDF 内容は一切外部に送信しない | **DONE** | `src/lib/rag.js` `@xenova/transformers` 完全ローカル |
| J-2 | モデルファイル整合性 | 埋め込みモデルは固定バージョン pin | **WIP** | モデル名固定（`Xenova/multilingual-e5-small`）。ハッシュ検証は今後 |
| J-3 | インデックス保護 | `docs-index/*.json` は認証経由のみ読出 | **DONE** | サーバ側のみ読出、外部公開なし |
| J-4 | クエリログ最小化 | 質問文はログに残さない | **DONE** | `src/routes/ai.js` で query をログ出力していない |

## K. 法令・社内規定

| # | 項目 | 実装 | 状態 | 実装箇所 |
|---|---|---|---|---|
| K-1 | 個人情報の取扱 | 社員 ID・氏名は最小限のみ保持。パスワードは bcrypt のみ | **DONE** | `req.session.adminEmployeeId` のみ保持 |
| K-2 | アクセス権分離 | 一般 / 管理者で表示物・API を厳密に分離（IDOR 対策） | **DONE** | `requireCommonAuth` / `requireAdminAuth` ミドルウェア + `ALLOWED_FILES` |
| K-3 | 仕様書の機密扱い | PDF はリポジトリ管理外、サーバ配置のみ、認証必須 | **DONE** | `.gitignore` で `docs/pdf/*.pdf` 除外、`/api/docs` 認証必須 |

## サマリ

| カテゴリ | DONE | WIP | TODO | 本番のみ | N/A |
|---|---|---|---|---|---|
| A. 認証・セッション (7) | 7 | 0 | 0 | 0 | 0 |
| B. 通信 (3) | 1 | 0 | 0 | 2 | 0 |
| C. 入力検証 (7) | 6 | 0 | 0 | 0 | 1 |
| D. HTTP ヘッダ (6) | 5 | 0 | 1 | 0 | 0 |
| E. PDF 配信 (6) | 5 | 1 | 0 | 0 | 0 |
| F. DoS 対策 (5) | 4 | 0 | 1 | 0 | 0 |
| G. ロギング (5) | 2 | 1 | 2 | 0 | 0 |
| H. エラー処理 (3) | 3 | 0 | 0 | 0 | 0 |
| I. デプロイ・運用 (7) | 5 | 0 | 2 | 0 | 0 |
| J. ローカル RAG (4) | 3 | 1 | 0 | 0 | 0 |
| K. 法令・社内規定 (3) | 3 | 0 | 0 | 0 | 0 |
| **合計 (56)** | **44** | **3** | **6** | **2** | **1** |

達成率（DONE + 本番のみ） = 46 / 56 = **82.1%**（v0.1.0 時点）

## 残タスク（優先度順）

| 優先度 | 項目 | 対応フェーズ |
|---|---|---|
| 高 | E-4 ダウンロード抑止強化 | Phase 3（PDF.js 同梱）|
| 中 | D-5 Permissions-Policy 明示設定 | Phase 3 内で同時対応 |
| 中 | F-5 リクエストタイムアウト | Phase 3 内で同時対応 |
| 中 | G-1 認証専用ログ出力 / G-2 管理者操作ログ / G-4 ローテーション | Phase 4（運用整備）|
| 低 | I-1 npm audit CI / I-4 バックアップ | Phase 4 |
| 低 | J-2 モデルハッシュ検証 | 将来 |
