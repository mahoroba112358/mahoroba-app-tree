# Changelog

本プロジェクトの全ての変更を記録します。形式は [Keep a Changelog](https://keepachangelog.com/) 準拠。

## [Unreleased]

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
