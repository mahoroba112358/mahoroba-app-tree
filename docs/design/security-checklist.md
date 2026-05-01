# セキュリティ実装リスト（IPA 準拠）

参照: 「安全なウェブサイトの作り方」「安全なウェブサイト運用の手引き」（IPA）/ `D:\GitHub\ipa_deploy.pdf`

凡例:
- **DONE** = 実装され、動作検証済（または静的にコードレビューで確認可能）
- **WIP** = コードはあるが動作未検証 / エンドツーエンド未確認 / 一部のみ実装
- **TODO** = 未実装
- **本番のみ** = 本番デプロイ時に有効、現状ローカルでは無効
- **N/A** = 該当しない

最終更新: 2026-05-01（v0.1.0、ローカル起動検証完了時点）

## A. 認証・セッション

| # | 項目 | 状態 | 検証方法・備考 |
|---|---|---|---|
| A-1 | パスワードのハッシュ化（bcrypt cost=12） | **DONE** | `auth.js bcrypt.compare`。ログイン成功/失敗をテスト済 |
| A-2 | セッション cookie（httpOnly / sameSite=strict / secure 本番） | **DONE** | `server.js` session 設定。本番で secure=true、ローカル動作確認済 |
| A-3 | セッション 1 時間 + rolling 延長 | **DONE** | `maxAge: 3600000`, `rolling: true` |
| A-4 | セッション ID 再生成（ログイン成功時） | **DONE** | `req.session.regenerate` 各ログイン後 |
| A-5 | ログアウト処理 | **WIP** | コードあり、動作未検証 |
| A-6 | ブルートフォース対策（5 回失敗 → 15 分ロック） | **WIP** | コードあり、動作未検証 |
| A-7 | 認証情報の保管（`.env` を Git 管理外） | **DONE** | `.gitignore` 確認済 |

## B. 通信

| # | 項目 | 状態 | 備考 |
|---|---|---|---|
| B-1 | HTTPS 化（Tailscale Funnel） | **本番のみ** | Phase 4 で設定 |
| B-2 | HSTS | **本番のみ** | `IS_PROD` 条件分岐済 |
| B-3 | 内部 API（tree → app）共有秘密ヘッダ | **WIP** | tree 側コードあり、mahoroba-app 側 API 未実装 |

## C. 入力検証・エスケープ

| # | 項目 | 状態 | 備考 |
|---|---|---|---|
| C-1 | XSS 対策（textContent + CSP） | **DONE** | フロント JS `textContent` のみ、CSP コードレビュー済 |
| C-2 | SQL インジェクション | **N/A** | tree に DB なし |
| C-3 | OS コマンドインジェクション | **DONE** | `child_process` 不使用、grep 確認済 |
| C-4 | パストラバーサル | **WIP** | コードあり、PDF 未配置のため動作未検証 |
| C-5 | CSRF 対策（sameSite=strict） | **DONE** | cookie 設定確認済 |
| C-6 | オープンリダイレクト | **DONE** | apps.js は apps.json のみ参照、外部 URL 入力経路なし |
| C-7 | 入力長・型検証（express-validator） | **DONE** | login/admin-login で動作検証済 |

## D. HTTP ヘッダ

| # | 項目 | 状態 | 備考 |
|---|---|---|---|
| D-1 | X-Content-Type-Options nosniff | **DONE** | helmet デフォルト |
| D-2 | X-Frame-Options DENY / frame-ancestors none | **DONE** | helmet + CSP |
| D-3 | Content-Security-Policy | **DONE** | `server.js` 明示設定 |
| D-4 | Referrer-Policy | **DONE** | `strict-origin-when-cross-origin` |
| D-5 | Permissions-Policy | **TODO** | 明示設定なし |
| D-6 | X-Powered-By 削除 | **DONE** | `app.disable('x-powered-by')` |

## E. PDF 配信

| # | 項目 | 状態 | 備考 |
|---|---|---|---|
| E-1 | 認証必須 | **WIP** | ミドルウェア配置済、PDF 未配置のため動作未検証 |
| E-2 | inline 配信ヘッダ | **WIP** | コードあり、未検証 |
| E-3 | キャッシュ抑止ヘッダ | **WIP** | コードあり、未検証 |
| E-4 | ダウンロード抑止 | **WIP** | iframe `#toolbar=0` のみ。Phase 3 で PDF.js 同梱化により強化 |
| E-5 | 配信範囲制限（path.resolve） | **WIP** | コードあり、未検証 |
| E-6 | 権限分離（一般 / 管理者） | **WIP** | コードあり、未検証 |

## F. レート制限・DoS 対策

| # | 項目 | 状態 | 備考 |
|---|---|---|---|
| F-1 | グローバルレート 100 req/min/IP | **DONE** | 動作中（ヘッダ確認済） |
| F-2 | ログインレート 10 req/min/IP | **DONE** | コード設定確認済 |
| F-3 | RAG レート 30 req/min/IP | **DONE** | コード設定確認済 |
| F-4 | リクエストサイズ 100KB | **DONE** | body parser 設定確認 |
| F-5 | リクエストタイムアウト | **TODO** | `server.timeout` 未設定 |

## G. ロギング・監査

| # | 項目 | 状態 | 備考 |
|---|---|---|---|
| G-1 | 認証成功/失敗ログ | **WIP** | morgan アクセスログのみ。専用認証ログは未実装 |
| G-2 | 管理者操作ログ | **TODO** | 専用ログ未実装 |
| G-3 | アクセス/エラーログ分離 | **DONE** | `access.log` と `error.log` に分離出力、確認済 |
| G-4 | ログローテーション | **TODO** | 未実装 |
| G-5 | 機微情報マスク | **DONE** | morgan は URL のみ、body 中のパスワードは記録されない |

## H. エラー処理

| # | 項目 | 状態 | 備考 |
|---|---|---|---|
| H-1 | エラー詳細秘匿（本番） | **DONE** | `IS_PROD` 分岐 |
| H-2 | グローバル例外捕捉 | **DONE** | `process.on` ハンドラ設定済 |
| H-3 | 4xx/5xx 統一返却 | **DONE** | 401/404 を実機テスト済 |

## I. デプロイ・運用

| # | 項目 | 状態 | 備考 |
|---|---|---|---|
| I-1 | npm audit | **TODO** | CI 未整備 |
| I-2 | npm ci --omit=dev | **WIP** | Dockerfile に記載、未ビルド |
| I-3 | コンテナリソース上限 | **WIP** | docker-compose に記載、未デプロイ |
| I-4 | バックアップ | **TODO** | 本番運用時に設定 |
| I-5 | 既存ファイル非干渉（volume scope） | **DONE** | docker-compose.yml で `mahoroba-app-tree/` 配下のみ |
| I-6 | `.env` Git 管理外 | **DONE** | gitignore 確認済 |
| I-7 | 非 root 実行 | **WIP** | Dockerfile / compose に設定、未ビルド |

## J. ローカル RAG

| # | 項目 | 状態 | 備考 |
|---|---|---|---|
| J-1 | 外部送信ゼロ | **WIP** | `@xenova/transformers` 採用、PDF/index 未生成のため未稼働 |
| J-2 | モデルバージョン pin | **DONE** | `Xenova/multilingual-e5-small` 固定 |
| J-3 | インデックス保護 | **DONE** | サーバ側読出のみ、外部公開エンドポイントなし |
| J-4 | クエリログ非保存 | **DONE** | `ai.js` で query をログ出力していない |

## K. 法令・社内規定

| # | 項目 | 状態 | 備考 |
|---|---|---|---|
| K-1 | 個人情報の最小化 | **DONE** | session に employeeId のみ |
| K-2 | アクセス権分離 | **DONE** | `requireCommonAuth` / `requireAdminAuth` ミドルウェア |
| K-3 | 仕様書の機密扱い | **DONE** | gitignore + 認証必須エンドポイント |

## サマリ（v0.1.0 ローカル起動完了時点）

| カテゴリ | DONE | WIP | TODO | 本番のみ | N/A |
|---|---|---|---|---|---|
| A. 認証・セッション (7) | 5 | 2 | 0 | 0 | 0 |
| B. 通信 (3) | 0 | 1 | 0 | 2 | 0 |
| C. 入力検証 (7) | 5 | 1 | 0 | 0 | 1 |
| D. HTTP ヘッダ (6) | 5 | 0 | 1 | 0 | 0 |
| E. PDF 配信 (6) | 0 | 6 | 0 | 0 | 0 |
| F. DoS 対策 (5) | 4 | 0 | 1 | 0 | 0 |
| G. ロギング (5) | 2 | 1 | 2 | 0 | 0 |
| H. エラー処理 (3) | 3 | 0 | 0 | 0 | 0 |
| I. デプロイ・運用 (7) | 2 | 3 | 2 | 0 | 0 |
| J. ローカル RAG (4) | 3 | 1 | 0 | 0 | 0 |
| K. 法令・社内規定 (3) | 3 | 0 | 0 | 0 | 0 |
| **合計 (56)** | **32** | **15** | **6** | **2** | **1** |

達成率（DONE） = 32 / 56 = **57.1%**
完了見込（DONE + WIP の見込確定 + 本番のみ） = 49 / 56 = **87.5%**

## DONE 化に必要なアクション（フェーズ別）

| Phase | 該当項目 |
|---|---|
| Phase 1（PDF 変換 + RAG）| E-1〜E-6（PDF 配置後の動作検証）、J-1（RAG 検索動作） |
| Phase 2（mahoroba-app 連携）| B-3（管理者認証 API e2e）|
| Phase 3（PDF.js 同梱・追加実装）| E-4 強化、D-5、F-5、G-1、G-2 |
| Phase 4（本番デプロイ）| B-1、B-2、I-2、I-3、I-7 |
| 別途運用整備 | A-5、A-6（実機テスト）、G-4、I-1、I-4 |
