# Changelog

本プロジェクトの全ての変更を記録します。形式は [Keep a Changelog](https://keepachangelog.com/) 準拠。

## [Unreleased]

### Added
- `package-lock.json` 生成（`npm install` 完了、238 packages）
- ローカル起動検証完了（共通ログイン → /tree → /api/apps/ までエンドツーエンド動作確認）
- ログイン画面の入力欄・ボタンを大型化（ユーザ要望、640px / 20px / 18px パディング）
- `scripts/convert-docx.ps1` ASCII 化と ExportAsFixedFormat 採用で動作化
- `docs/pdf/宿舎食事_仕様書.pdf` および `docs/pdf/宿舎食事_管理者_仕様書.pdf` を Word COM で生成
- セキュリティチェックリストを 3 リポジトリ統一フォーマットで作成・厳密化
  - mahoroba-app-tree: `docs/design/security-checklist.md`（DONE 32/56 = 57.1%）
  - mahoroba-app: `docs/security-checklist.md`（DONE 41/54 = 75.9%）
  - mahoroba-hub: `docs/security-checklist.md`（DONE 34/51 = 66.7%）
- `docs/HANDOFF.md` 引き継ぎメモ追加

### Pending
- Phase 1 残: `npm run build-index` で RAG インデックス生成
- Phase 2: mahoroba-app に管理者認証 API 追加
- Phase 3: PDF.js 同梱化と保存抑止強化
- Phase 4: 本番デプロイ（DS225+ + Tailscale Funnel）

## [0.1.0] - 2026-05-01

### Added
- リポジトリ初期化、ディレクトリ構成
- 設計書 `docs/design/architecture.md`
- セキュリティ実装リスト `docs/design/security-checklist.md`（IPA 準拠 11 カテゴリ・60+ 項目）
- `.gitignore` / `README.md` / `CHANGELOG.md`
- `package.json` 雛形
- `config/apps.json` 接続先アプリ定義
- `scripts/convert-docx.ps1` Word→PDF 変換スクリプト（Word COM 利用）
- `src/server.js` Express サーバー雛形
- `src/routes/auth.js` 3 層認証スケルトン
- `src/routes/apps.js` apps.json 配信 + ヘルス監視プロキシ
- `src/routes/docs.js` PDF 閲覧専用配信
- `src/routes/ai.js` ローカル RAG 検索エンドポイント
- `public/login.html` 共通ログイン画面
- `public/tree.html` 一般 tree 画面
- `public/admin-login.html` 管理者ログイン画面
- `public/admin-tree.html` 管理者 tree 画面
- `.env.example` 環境変数テンプレート
- `docker-compose.yml` 本番デプロイ定義
