# はるえもんとおしゃべり

AIキャラクター「はるえもん」と会話・検索ができるチャットアプリです。会話を重ねると好感度が変化し、はるえもんの性格が変わっていきます。

## 概要

```
ユーザー
  ↓ テキスト or 音声入力
Expressサーバー（Fly.io）
  ↓ OpenAI API（gpt-4o-mini）
はるえもんの返答 + 好感度変化
```

外部へのAPI通信はすべてサーバー側で処理し、APIキーはフロントエンドに露出しません。

## 機能

- はるえもんとのテキスト会話
- Web検索（SerpAPI + OpenAIで要約）
- 音声入力（Web Speech API）
- 音声読み上げ（Web Speech API）
- 好感度システム（0〜100）による性格変化
- 好感度・性格のブラウザ保存（localStorage）

### 性格の変化

| 好感度 | 性格 |
|--------|------|
| 0〜49 | ツンデレ |
| 50〜79 | なかよし |
| 80〜100 | デレデレ |

## 技術スタック

| 項目 | 内容 |
|------|------|
| フロントエンド | HTML / CSS / JavaScript（バンドラーなし） |
| バックエンド | Node.js + Express |
| AI | OpenAI API（gpt-4o-mini） |
| 検索 | SerpAPI + OpenAI要約 |
| ホスティング | Fly.io |
| モバイル | Capacitor（iOS） |

## ファイル構成

```
haruemon-app/
├── server.js          # Expressサーバー（/chat・/search エンドポイント）
├── www/
│   ├── index.html     # メイン画面
│   ├── script.js      # フロントエンドロジック
│   ├── style.css      # スタイル
│   └── privacy.html   # プライバシーポリシー
├── fly.toml           # Fly.io設定
├── Dockerfile         # コンテナ設定
└── capacitor.config.json  # iOS設定
```

## セットアップ

### 1. 依存パッケージをインストール

```bash
npm install
```

### 2. APIキーをFly.ioのシークレットに設定

```bash
fly secrets set OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
fly secrets set SERPAPI_KEY=xxxxxxxxxxxxxxxx
```

### 3. ローカルで起動する場合

```bash
export OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
export SERPAPI_KEY=xxxxxxxxxxxxxxxx
npm start
```

ブラウザで `http://localhost:3000` を開きます。

## デプロイ

```bash
fly deploy
```

## セキュリティ対策

| 対策 | 内容 |
|------|------|
| XSS防止 | `innerHTML` を廃止し DOM操作のみ使用 |
| CSP | helmet で `script-src: 'self'` 等を設定 |
| レート制限 | 1IP・1分・20リクエストまで |
| 入力バリデーション | message 500文字・query 200文字の上限 |
| ボディサイズ制限 | `express.json({ limit: "10kb" })` |
| APIキー管理 | サーバー側の環境変数のみ（フロントに非公開） |
| HTTPS強制 | Fly.io の `force_https: true` |

## プライバシー

- 会話ログはサーバーに保存されません
- 好感度・性格はブラウザの localStorage にのみ保存されます
- OpenAI・SerpAPIへのリクエストはサーバー経由で行われます
