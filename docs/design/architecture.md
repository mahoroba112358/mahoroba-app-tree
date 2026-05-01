# mahoroba-app-tree 設計書

最終更新: 2026-05-01

## 1. 目的

社員共通ポータル。`mahoroba-hub` / `mahoroba-app` および将来追加される各種社内アプリへの入り口。

- 全社員がまず開く 1 ページ
- 各アプリへのカード型リンクと稼働状況を集約
- 認証 3 層（共通ログイン → 一般 → 管理者）
- 説明書/仕様書をブラウザ内で閲覧（DL 不可）
- 完全ローカル RAG による説明書検索（外部送信ゼロ）

## 2. アーキテクチャ位置

```
                  ┌──────────────────────┐
                  │  mahoroba-app-tree   │  ← 社員はまずここに来る
                  │   （ポータル/ハブ）  │
                  └──────────┬───────────┘
                             │（リンク + ヘルス監視 + API認証）
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  mahoroba-hub        mahoroba-app          (将来) app-XX
  帰省旅費計算        食事・宿舎管理            ...
  :3000               :3001                    :300X
```

## 3. 認証（3 層）

| 層 | ID | パスワード | 検証ソース |
|---|---|---|---|
| 共通ログイン（tree 入口） | `mahoroba-construction` | `1123` | tree 自身（`.env` に bcrypt ハッシュ） |
| 一般ログイン | mahoroba-app の社員 ID | mahoroba-app の社員パス | mahoroba-app の API |
| 管理者ログイン | mahoroba-app の管理者 ID（`0000`） | mahoroba-app の管理者パス（`1123`） | mahoroba-app の API |

### 3.1 認証フロー

```
[共通ログイン画面]  id=mahoroba-construction / pass=1123
        │
        ▼ 通過
[一般 tree 画面]   ← そのまま一般メニュー（社員 ID は問わない）
        │
        ▼ 右上「管理者ログイン」ボタン
[管理者ログイン]  id/pass を mahoroba-app の API で検証
        │
        ▼ 検証成功
[管理者 tree 画面]   ← 仕様書 + 説明書セクション
```

### 3.2 管理者認証 API（mahoroba-app 側）

```
POST /api/auth/verify-admin
Headers:
  X-Tree-Token: <共有秘密>   ← 内部 API 保護
Body:
  { employeeId: string, password: string }

Response 200: { ok: true, role: "admin", employeeId: string }
Response 401: { ok: false }
```

- mahoroba-app 側で bcrypt 検証
- レスポンスに機微情報（パスワード等）を絶対含めない
- 共有秘密は両アプリの `.env` で管理

## 4. 画面構成

| 画面 | パス | アクセス可能 |
|---|---|---|
| 共通ログイン | `/` | 全員 |
| 一般 tree | `/tree` | 共通ログイン通過後 |
| 管理者ログイン | `/admin/login` | 共通ログイン通過後 |
| 管理者 tree | `/admin/tree` | 管理者ログイン通過後 |

## 5. 説明書 PDF 仕様

### 5.1 ソースファイル

| ファイル | 用途 | ログイン種別ごとの可視性 |
|---|---|---|
| `D:\仕様書-説明書\宿舎食事_仕様書.docx` | 一般説明書（mahoroba-app の使い方） | 一般ログイン後 |
| `D:\仕様書-説明書\宿舎食事_管理者_仕様書.docx` | 管理者仕様書 | 管理者ログイン後のみ |

### 5.2 docx → PDF 変換

- **理由**: ブラウザ内ネイティブ表示、保存抑止、ローカル RAG 抽出精度のため PDF 化
- **方法**: PowerShell + Word COM（既に Word ライセンス保有を確認）
- **トリガ**: `npm run convert-docs`
- **出力先**: `docs/pdf/*.pdf`（git 管理外、サーバ内で生成）
- **原本**: D:\ の `.docx` はリポジトリ管理外（社内機密）。tree のリポジトリには変換結果も含めない。

### 5.3 PDF 配信

| 項目 | 実装 |
|---|---|
| 認証必須 | 全 PDF エンドポイントは認証ミドルウェア通過必須 |
| ダウンロード抑止 | `Content-Disposition: inline` + 印刷/右クリック保存抑止 |
| キャッシュ抑止 | `Cache-Control: no-store, no-cache, must-revalidate` |
| 配信範囲 | `docs/pdf/` 配下のみ。パストラバーサル対策 |
| 権限分離 | 一般 → 一般説明書のみ / 管理者 → 管理者仕様書 |

## 6. ローカル RAG（説明書検索）

### 6.1 方針

**完全ローカル**。外部 API（Gemini 等）を使わず、学習リスクゼロを実現。

### 6.2 構成

| 要素 | 実装 |
|---|---|
| PDF テキスト抽出 | `pdf-parse` |
| チャンク化 | 段落/見出し単位、200〜500 トークン |
| 埋め込みモデル | `@xenova/transformers`（多言語小型モデル、完全ローカル） |
| ベクトル検索 | コサイン類似度（ピュア JS） |
| 結果表示 | 該当ページにジャンプ + 抜粋ハイライト |
| 外部送信 | **ゼロ**（質問文も埋め込みもサーバ外に出さない） |

### 6.3 インデックス更新

- `npm run build-index` で `docs/pdf/*.pdf` → `docs-index/*.json` を再生成
- `convert-docs` 後に必ず実行

## 7. ディレクトリ構成

```
mahoroba-app-tree/
├── src/
│   ├── server.js
│   ├── routes/
│   │   ├── auth.js          ← 共通(tree入口) + 管理者(mahoroba-app API)
│   │   ├── apps.js          ← apps.json + ヘルス監視プロキシ
│   │   ├── docs.js          ← PDF 配信（認証必須・inline・no-store）
│   │   └── ai.js            ← ローカル RAG 検索
│   └── lib/
│       ├── rag.js           ← ローカル埋め込み検索
│       └── auth-helpers.js  ← セッション/ロックアウト管理
├── public/
│   ├── login.html           ← 共通ログイン
│   ├── tree.html            ← 一般 tree
│   ├── admin-login.html     ← 管理者ログイン
│   ├── admin-tree.html      ← 管理者 tree
│   ├── css/
│   └── js/
├── docs/
│   ├── design/              ← 本設計書、セキュリティリスト等
│   └── pdf/                 ← 変換生成 PDF（gitignore）
├── docs-index/              ← RAG 埋め込みベクトル（gitignore）
├── config/
│   └── apps.json            ← 接続先アプリ定義
├── scripts/
│   ├── convert-docx.ps1     ← Word→PDF 変換
│   └── build-rag-index.js   ← RAG インデックス生成
├── .env / .env.example
├── docker-compose.yml
├── package.json
├── README.md
└── CHANGELOG.md
```

## 8. ローカル / 本番デプロイ

| 項目 | ローカル | 本番 |
|---|---|---|
| URL | `http://localhost:3002` | `https://mahoroba-app-tree.<tailnet>.ts.net` |
| 認証 Cookie secure | false | true |
| サーバ | Windows 開発機 | DS225+ Synology Container Manager |
| 公開方式 | localhost | Tailscale Funnel |
| メモリ上限 | - | 512MB |

## 9. GitHub 記録運用

- 全変更を https://github.com/mahoroba112358/mahoroba-app-tree.git に記録
- ブランチ: `main`（本番） / `feature/*`（機能追加）
- コミットメッセージ: Conventional Commits（`feat:` / `fix:` / `docs:` / `chore:` / `security:` / `deploy:`）
- 変更ごとに `CHANGELOG.md` 更新
- 設計変更時は本ファイル `docs/design/architecture.md` を更新
