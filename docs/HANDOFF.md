# 引き継ぎメモ

最終更新: 2026-05-01（v0.1.0 構築途中）

## 全体ロードマップ（4 フェーズ）

| Phase | 内容 | 状態 |
|---|---|---|
| Phase 1 | PDF 変換 + ローカル RAG インデックス生成 | **進行中（中断）** |
| Phase 2 | mahoroba-app に管理者認証 API 追加 | 未着手 |
| Phase 3 | PDF.js 同梱化と保存抑止強化 | 未着手 |
| Phase 4 | 本番デプロイ準備（DS225+ + Tailscale Funnel） | 未着手 |

## 完了済み

### スカフォールド（v0.1.0）
- ローカル `C:\Users\user\mahoroba-app-tree\` 構築
- GitHub `https://github.com/mahoroba112358/mahoroba-app-tree.git` に push 済（main ブランチ）
- ディレクトリ構成・Express サーバ雛形・3 層認証・PDF 配信ルート・ローカル RAG ライブラリ・apps.json
- `npm install` 完了（238 packages、`package-lock.json` 記録済）
- ローカル起動 e2e 動作確認:
  - `GET /api/health` → 200
  - `POST /auth/common-login` (`mahoroba-construction` / `1123`) → 200
  - `GET /tree`（認証後）→ 200
  - `GET /api/apps/`（認証後）→ アプリ一覧取得
  - 誤パスワード → 401

### ログイン UI 拡大
- カード幅 420 → 640px、入力 16 → 20px、ボタン大型化（ユーザ要望対応）
- フォーカスリング、レスポンシブ対応

### docx → PDF 変換（Phase 1 の前半）
- `D:\仕様書-説明書\宿舎食事_仕様書.docx` → `docs/pdf/宿舎食事_仕様書.pdf`（1.3MB）✅
- `D:\仕様書-説明書\宿舎食事_管理者_仕様書.docx` → `docs/pdf/宿舎食事_管理者_仕様書.pdf`（1.6MB）✅
- 変換は **直接 PowerShell で Word COM 起動** が成功した（npm run convert-docs はバックグラウンド起動で停止していたため、PowerShell コマンドで直接実行した）
- スクリプト `scripts/convert-docx.ps1` は ASCII 化済（PS5.1 ANSI 読込対策）+ ExportAsFixedFormat 使用

### セキュリティ実装リスト（IPA 準拠）
3 リポジトリ全てに作成・push 済：

| リポジトリ | パス | 達成率（DONE） |
|---|---|---|
| mahoroba-app-tree | `docs/design/security-checklist.md` | 32/56 = 57.1%（v0.1.0）|
| mahoroba-app | `docs/security-checklist.md` | 41/54 = 75.9% |
| mahoroba-hub | `docs/security-checklist.md` | 34/51 = 66.7% |

凡例厳密化:
- DONE = 実装され**動作検証済**
- WIP = コードはあるが動作未検証
- TODO = 未実装
- 本番のみ = 本番デプロイ時に有効

## 次に再開すべき作業（優先順）

### 1. RAG インデックス生成（Phase 1 の続き、中断箇所）

```sh
cd C:\Users\user\mahoroba-app-tree
npm run build-index
```

- 入力: `docs/pdf/*.pdf`（既に 2 ファイル配置済）
- 出力: `docs-index/*.json`（gitignore 対象）
- 動作:
  - `pdf-parse` で PDF テキスト抽出
  - 段落単位でチャンク化（CHUNK_SIZE=400 / OVERLAP=80）
  - `@xenova/transformers` の `multilingual-e5-small` で埋め込み生成
  - 各 PDF につき 1 つの JSON を出力
- **注意**: 初回実行時はモデルファイル（数百 MB）を Hugging Face から自動ダウンロード。ネットワーク必須。完了まで数分〜10 分。
- 失敗時のフォールバック: モデルが読み込めない場合、テキストマッチ検索のみのインデックスを生成（`scripts/build-rag-index.js` 内に実装済）。
- 中断時の影響: tree のローカル RAG 検索が動作しない（PDF 表示は可能）。

### 2. Phase 1 完了時の動作確認

- ローカル起動: `npm start` → `http://localhost:3002`
- 共通ログイン後、説明書 PDF をクリックして表示
- RAG 検索ボックスで「宿泊」「食事」等で検索 → 該当箇所がヒット
- 確認したらセキュリティチェックリストの E-1〜E-6, J-1 を WIP → DONE に昇格

### 3. Phase 2: mahoroba-app に管理者認証 API 追加

`C:\Users\user\mahoroba-app\server.js` に以下を追加:

```js
// 内部 API: tree からの管理者認証検証
app.post('/api/auth/verify-admin', express.json(), (req, res) => {
  const treeToken = req.headers['x-tree-token'];
  const expected = process.env.TREE_SHARED_SECRET;
  if (!expected || treeToken !== expected) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }
  const { employeeId, password } = req.body || {};
  if (typeof employeeId !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ ok: false, error: 'invalid_input' });
  }
  const emp = db.prepare('SELECT id, name, password_hash, is_admin, is_active FROM employees WHERE id = ?').get(employeeId);
  if (!emp || !emp.is_active || !emp.is_admin) return res.status(401).json({ ok: false });
  if (!bcrypt.compareSync(password, emp.password_hash)) return res.status(401).json({ ok: false });
  res.json({ ok: true, role: 'admin', employeeId: emp.id });
});
```

- mahoroba-app の `.env` に `TREE_SHARED_SECRET=...`（tree の `.env` の `MAHOROBA_APP_SHARED_SECRET` と同値）を追加
- mahoroba-app は **業務利用中**のため、本番環境への反映は慎重に（テスト → 本番）
- 連携テスト:
  - mahoroba-app を `http://localhost:3001` で起動
  - tree から `POST /auth/admin-login` に `0000` / `1123` で 200 OK
  - tree のセキュリティチェックリスト B-3 を WIP → DONE

### 4. Phase 3: PDF.js 同梱化と保存抑止強化

- `pdfjs-dist` を依存追加
- `public/pdfjs-viewer/` 配下にカスタム viewer
- 印刷ボタン・ダウンロードボタンを CSS で hide
- `Permissions-Policy` ヘッダ追加（D-5）
- `server.timeout` 設定（F-5）
- 認証専用ログ（G-1, G-2）
- 完了したら tree のセキュリティチェックリスト E-4, D-5, F-5, G-1, G-2 を DONE 化

### 5. Phase 4: 本番デプロイ

- DS225+ に `/volume1/mahoroba-app-tree/` 作成
- `docker-compose up -d` でビルド・起動
- Tailscale Funnel 設定で `https://mahoroba-app-tree.<tailnet>.ts.net` 公開
- B-1, B-2, I-2, I-3, I-7 を DONE 化

## 重要メモ

### ローカル `.env` の値（変更時の注意）
- 共通ログイン ID: `mahoroba-construction`
- 共通ログイン パスワード: `1123`（bcrypt ハッシュは `.env` に格納済）
- セッション秘密 / 共有秘密は乱数で生成済（`.env` の値を保持）

### GitHub 記録運用
- 全変更を都度 commit + push
- ブランチ: `main`（mahoroba-app-tree, mahoroba-app）/ `security/p0-hardening`（mahoroba-hub の現在ブランチ）
- メッセージ規約: Conventional Commits（`feat:` / `fix:` / `docs:` / `chore:` / `security:`）

### コミット履歴（mahoroba-app-tree）
```
690cb48  docs(security): 厳密化 - 動作未検証は WIP に変更
edbf6da  docs(security): 実装状態を反映してチェックリスト更新（旧版）
0620ea1  feat: ログイン画面を大型化 + PDF 変換スクリプト修正
b164135  chore: 依存ロック追加と起動検証の記録
a0589ff  chore: 初期スカフォールド (mahoroba-app-tree v0.1.0)
```

### 既知の懸念
- `npm run build-index` 初回はモデルダウンロードに時間/帯域が必要
- `csurf` パッケージは package.json に残存（deprecated 警告）。将来削除候補。現状 `sameSite=strict` で CSRF 防御しているため使用していない
- 環境変数の更新は手作業が必要

### 中断地点で動かしていた / 起動していたプロセス
- 起動済みサーバ: なし（テスト後 kill 済）
- バックグラウンド: なし
- 一時ファイル: `/tmp/cookies.txt`, `/tmp/r1.json`〜`/tmp/r4.json`（不要）
