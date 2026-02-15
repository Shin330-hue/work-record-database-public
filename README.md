# 町工場向け図面管理システム（公開デモ版）

このリポジトリは、町工場向け図面管理システムの公開デモです。
開発経験がない方でも、ローカルで起動して基本機能を体験できるようにしています。

## このアプリの位置づけ

- 閲覧ページ: 取引先会社名や図番ごとに、図面・プログラム・作業内容を確認するページ
- 管理ページ: 上記情報を登録・編集するページ
- 追記情報: 現場作業者が対象図番へ最新情報を追加する機能（テキスト・画像・動画）

## このアプリでできること

- 会社 -> カテゴリ -> 図番の順で作業手順を閲覧
- 図番やキーワードで検索
- 管理画面で図番データを登録・編集
- 追記情報（現場メモや追加情報）を閲覧・管理
- 町工場GPTでチャット問い合わせ（任意設定）

## 前提ソフト（依存関係）

このアプリを動かすために、以下が必要です。

- Node.js `20` 以上
- npm `10` 以上（Node.js に同梱）
- Git（クローン時に使用）

## セットアップ（正常系）

```bash
git clone <repository-url>
cd work-record-database-public
npm install
cp .env.example .env.local
npm run dev
```

起動後、ブラウザで以下を開いてください。

- `http://localhost:3000`

## 5分で体験するルート（閲覧ユーザー）

1. トップページで検索バーに `DEMO-001` と入力
2. 検索候補をクリック
3. 作業手順詳細ページで内容を確認
4. トップへ戻って `全ての追記を見る` を開く
5. 必要なら `町工場GPT` ボタンからチャット画面を確認

## 管理画面を体験するルート（管理ユーザー）

1. `http://localhost:3000/admin/login` を開く
2. サンプルパスワードでログイン
3. ダッシュボードから以下を試す
- `新規図番登録`
- `図番一覧・編集`
- `追記管理`

サンプルログイン情報:

- パスワード: `demo-admin-2026`

## LocalLLM機能を試す（任意）

初期状態では、LocalLLM環境を用意しない限りチャット機能は利用できません。
使いたい場合のみ、以下を実施してください。

1. Ollama をインストールして起動
2. モデルを取得（最低1つ）

```bash
ollama pull qwen2.5:7b-instruct-q4_k_m
```

3. `.env.local` に必要な設定を追加（必要時のみ）

```bash
OLLAMA_BASE_URL=http://localhost:11434
ENABLE_RAG=true
```

4. 開発サーバーを再起動し、`/chat` を開く

## 公開版データの配置

デモデータは `public/data_demo` に入っています。

- `public/data_demo/companies.json`
- `public/data_demo/search-index.json`
- `public/data_demo/auth/passwords.json`
- `public/data_demo/work-instructions/drawing-DEMO-001/instruction.json`
- `public/data_demo/work-instructions/drawing-DEMO-002/instruction.json`
- `public/data_demo/work-instructions/drawing-DEMO-003/instruction.json`
- `public/data_demo` 配下の PDF / 画像 / 動画サンプルは、すべて生成AIで作成したデータです。

## 補足ドキュメント

画面ごとの詳しい使い方は以下を参照してください。

- `doc/user-guide.md`
- `doc/public-specification.md`

## 注意（開発中の制約）

- 本アプリは開発中です。
- 本公開版では多言語切り替えは未実装です。
- 管理画面に「図番データの完全削除」は未実装です。
- 運用時は必要に応じて、ファイル単位での手動整理やデータ修正で対応してください。

## ライセンス

MIT License
