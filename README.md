# mahoroba-app-tree

社員共通ポータル。`mahoroba-hub` / `mahoroba-app` および将来追加される各種社内アプリへの入り口。

## 概要

- 全社員がまず開く 1 ページ
- 各アプリへのカード型リンクと稼働状況を集約
- 認証 3 層（共通ログイン → 一般 → 管理者）
- 説明書/仕様書をブラウザ内で閲覧（DL 不可）
- 完全ローカル RAG による説明書検索（外部送信ゼロ）

## 関連リポジトリ

| リポジトリ | 役割 |
|---|---|
| [mahoroba-hub](https://github.com/mahoroba112358/mahoroba-hub) | 帰省旅費計算 |
| [mahoroba-app](https://github.com/mahoroba112358/mahoroba-app) | 食事・宿舎管理 |
| **mahoroba-app-tree**（本リポジトリ） | 社員共通ポータル |

## 認証

| 層 | ID | パスワード | 用途 |
|---|---|---|---|
| 共通ログイン（tree 入口） | `mahoroba-construction` | `1123` | 全社員がツリーに入る |
| 一般ログイン | mahoroba-app の社員 ID/パス | （API 経由で検証） | 一般メニュー |
| 管理者ログイン | mahoroba-app の管理者 ID/パス | （API 経由で検証） | 管理者メニュー |

## ローカル起動

```sh
npm install
npm run convert-docs   # D:\仕様書-説明書\*.docx → docs/pdf/*.pdf
npm run build-index    # PDF → ローカル RAG インデックス
npm start              # http://localhost:3002
```

## ポート割当

| アプリ | ローカル URL | 本番 URL |
|---|---|---|
| mahoroba-hub | http://localhost:3000 | https://mahoroba-hub.\<tailnet\>.ts.net |
| mahoroba-app | http://localhost:3001 | https://mahoroba-app.\<tailnet\>.ts.net |
| mahoroba-app-tree | http://localhost:3002 | https://mahoroba-app-tree.\<tailnet\>.ts.net |

## ドキュメント

- [設計書](docs/design/architecture.md)
- [セキュリティ実装リスト（IPA 準拠）](docs/design/security-checklist.md)
- [変更履歴](CHANGELOG.md)

## デプロイ

DS225+（Synology）+ Docker + Tailscale Funnel。詳細は `docs/design/architecture.md` 参照。
