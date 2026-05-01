# セキュリティ実装リスト（IPA 準拠）

参照: 「安全なウェブサイトの作り方」「安全なウェブサイト運用の手引き」（IPA）/ `D:\GitHub\ipa_deploy.pdf`

mahoroba-hub / mahoroba-app と同じ水準で実装。各項目に**実装状態**列を持ち、進捗管理に使用。

## A. 認証・セッション

| # | 項目 | 実装 | 状態 |
|---|---|---|---|
| A-1 | パスワードのハッシュ化 | bcrypt（cost=12 以上）。共通ログインも `.env` にハッシュ保存 | TODO |
| A-2 | セッション管理 | `express-session` + `cookie: { httpOnly, sameSite: 'strict', secure: 本番true }` | TODO |
| A-3 | セッション有効期限 | 1 時間で自動失効、操作ごとに延長（rolling） | TODO |
| A-4 | セッション ID 再生成 | ログイン成功時 / 権限昇格時（一般→管理者）に regenerate | TODO |
| A-5 | ログアウト処理 | サーバ側セッション破棄 + Cookie 削除 | TODO |
| A-6 | ブルートフォース対策 | 同一 IP / 同一 ID で 5 回失敗 → 15 分ロック | TODO |
| A-7 | 認証情報の保管 | `.env`（パーミッション 600）、Git 管理外、コンテナ内のみ読込 | TODO |

## B. 通信

| # | 項目 | 実装 | 状態 |
|---|---|---|---|
| B-1 | HTTPS 化 | Tailscale Funnel が自動 TLS 終端（`*.ts.net`） | 本番のみ |
| B-2 | HSTS | `helmet({ hsts: { maxAge: 31536000, includeSubDomains: true } })` | TODO |
| B-3 | 内部 API 通信保護 | tree ↔ app は共有秘密ヘッダ + Docker 内部ネットワーク限定 | TODO |

## C. 入力検証・エスケープ（OWASP）

| # | 項目 | 実装 | 状態 |
|---|---|---|---|
| C-1 | XSS 対策 | フロント出力は `textContent` 使用、HTML 直挿入禁止。CSP ヘッダ厳格化 | TODO |
| C-2 | SQL インジェクション | tree は DB 直アクセスしない（API 経由のみ）。app 側はプリペアド徹底 | N/A |
| C-3 | OS コマンドインジェクション | `child_process.exec` 不使用。必要時は `execFile` で配列引数 | TODO |
| C-4 | パストラバーサル | PDF 配信時はファイル名ホワイトリスト方式。`path.resolve` で `docs/pdf/` 配下確認 | TODO |
| C-5 | CSRF 対策 | `csurf` 等で全 POST に CSRF トークン必須 | TODO |
| C-6 | オープンリダイレクト | 外部 URL は `apps.json` のホワイトリスト経由のみ | TODO |
| C-7 | 入力長・型検証 | `express-validator` で全入力検証 | TODO |

## D. HTTP ヘッダ（helmet）

| # | 項目 | 実装 | 状態 |
|---|---|---|---|
| D-1 | X-Content-Type-Options | `nosniff` | TODO |
| D-2 | X-Frame-Options | `DENY`（クリックジャッキング対策） | TODO |
| D-3 | Content-Security-Policy | `default-src 'self'`、PDF.js 動作に必要な範囲のみ許可、`unsafe-inline` 禁止 | TODO |
| D-4 | Referrer-Policy | `strict-origin-when-cross-origin` | TODO |
| D-5 | Permissions-Policy | カメラ・マイク等を全て deny | TODO |
| D-6 | サーバ情報秘匿 | `X-Powered-By` 削除、Server ヘッダ最小化 | TODO |

## E. PDF 配信（閲覧のみ）

| # | 項目 | 実装 | 状態 |
|---|---|---|---|
| E-1 | 認証必須 | 全 PDF エンドポイントは認証ミドルウェア通過必須 | TODO |
| E-2 | inline 配信 | `Content-Disposition: inline; filename=...` | TODO |
| E-3 | キャッシュ抑止 | `Cache-Control: no-store, no-cache, must-revalidate` | TODO |
| E-4 | ダウンロード抑止 | フロント側で右クリック保存・印刷ボタン抑止（完全防止不可は明記） | TODO |
| E-5 | 配信範囲 | `docs/pdf/` ディレクトリ配下のみ。シンボリックリンク禁止 | TODO |
| E-6 | 権限分離 | 一般 → 一般説明書のみ / 管理者 → 管理者仕様書のみ | TODO |

## F. レート制限・DoS 対策

| # | 項目 | 実装 | 状態 |
|---|---|---|---|
| F-1 | グローバルレート | `express-rate-limit` 全体 100 req/min/IP | TODO |
| F-2 | ログインレート | 認証エンドポイントは 10 req/min/IP | TODO |
| F-3 | RAG クエリレート | 検索は 30 req/min/IP（CPU 負荷高のため） | TODO |
| F-4 | リクエストサイズ | `express.json({ limit: '100kb' })` | TODO |
| F-5 | タイムアウト | 30 秒で打ち切り | TODO |

## G. ロギング・監査

| # | 項目 | 実装 | 状態 |
|---|---|---|---|
| G-1 | 認証成功/失敗ログ | タイムスタンプ・IP・ユーザID（パスワードは絶対に記録しない） | TODO |
| G-2 | 管理者操作ログ | 管理者ログイン後の操作を全記録 | TODO |
| G-3 | エラーログ分離 | アプリログ / アクセスログ / 監査ログを分離保存 | TODO |
| G-4 | ログローテーション | サイズ・日次でローテート、90 日保管 | TODO |
| G-5 | 機微情報マスク | ログ出力時にパスワード・トークンを `***` でマスク | TODO |

## H. エラー処理

| # | 項目 | 実装 | 状態 |
|---|---|---|---|
| H-1 | エラー詳細秘匿 | 本番でスタックトレース・SQL 文をユーザに返さない | TODO |
| H-2 | グローバル捕捉 | `process.on('uncaughtException')` / `unhandledRejection` で記録後安全停止 | TODO |
| H-3 | 4xx/5xx 統一画面 | エラー種別ごとに最小限のメッセージのみ表示 | TODO |

## I. デプロイ・運用

| # | 項目 | 実装 | 状態 |
|---|---|---|---|
| I-1 | 依存パッケージ監査 | `npm audit` を定期実行、Critical/High は即対応 | TODO |
| I-2 | パッケージ最小化 | 不要な依存を入れない、`npm ci --omit=dev` で本番ビルド | TODO |
| I-3 | コンテナリソース上限 | メモリ 512MB / CPU 1 コアで OOM 自動再起動 | TODO |
| I-4 | バックアップ | 説明書・設定ファイルを週次自動バックアップ | TODO |
| I-5 | 既存ファイル非干渉 | DS225+ の他フォルダには一切アクセスしない | TODO |
| I-6 | シークレット管理 | `.env` は Git 管理外、サーバへは scp + パーミッション 600 | TODO |
| I-7 | 最小権限実行 | コンテナ内は非 root ユーザで起動 | TODO |

## J. ローカル RAG 固有

| # | 項目 | 実装 | 状態 |
|---|---|---|---|
| J-1 | 外部送信ゼロ | 質問文・埋め込み・PDF 内容は一切外部に送信しない | TODO |
| J-2 | モデルファイル整合性 | 埋め込みモデルは固定バージョン pin | TODO |
| J-3 | インデックス保護 | `docs-index/*.json` は認証経由のみ読出 | TODO |
| J-4 | クエリログ最小化 | 質問文はログに残さない（または管理者のみ・90 日で自動削除） | TODO |

## K. 法令・社内規定

| # | 項目 | 実装 | 状態 |
|---|---|---|---|
| K-1 | 個人情報の取扱 | 社員 ID・氏名は最小限のみ保持。パスワードは bcrypt のみ | TODO |
| K-2 | アクセス権分離 | 一般 / 管理者で表示物・API を厳密に分離（IDOR 対策） | TODO |
| K-3 | 仕様書の機密扱い | PDF はリポジトリ管理外、サーバ配置のみ、認証必須 | TODO |

## 凡例

| 状態 | 意味 |
|---|---|
| TODO | 未実装 |
| WIP | 実装中 |
| DONE | 実装完了 |
| N/A | 該当しない（理由を併記） |
| 本番のみ | ローカルでは無効、本番で有効 |
