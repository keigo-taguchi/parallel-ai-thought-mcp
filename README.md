# 並行AI思考システム - MCP Server

**複数のAIプロバイダーで並行思考を実現するModel Context Protocol (MCP) サーバーです。**

## 概要

このMCPサーバーは、複数のAI（OpenAI、Anthropic、Google Gemini、DeepSeek、Ollama）に同じ質問を並行で投げて、異なる視点からの回答を得ることができます。複数のAIからの回答を分析し、合意点を見つけたり、総合的な洞察を得ることができます。

## 主な機能

- **並行AI思考**: 複数のAIプロバイダーに同時に質問を投げる
- **応答分析**: 複数の回答を比較分析して要約を生成
- **合意点抽出**: 異なるAIの回答から共通する結論を導出
- **セッション管理**: 思考セッションの履歴管理と追跡
- **柔軟な設定**: プロバイダー、モデル、パラメータの自由な組み合わせ

## 利用可能なツール

### 基本ツール
1. **parallel-ai-think**: 並行AI思考の実行
2. **summarize-thoughts**: 思考結果の要約分析
3. **find-consensus**: 複数回答からの合意点抽出
4. **get-session-info**: セッション詳細情報の取得
5. **list-providers**: 利用可能なプロバイダー一覧
6. **list-sessions**: 全セッション履歴の表示

### トークン節約ツール 💰
7. **delegate-to-cheap-llm**: 簡単なタスクを格安LLM（DeepSeek、Ollama）に委譲
8. **draft-and-refine**: 格安LLMでドラフト作成→高品質LLMで調整の段階的処理
9. **summarize-for-efficiency**: 長文を格安LLMで要約して前処理
10. **batch-process-cheap**: 複数の単純タスクを格安LLMで一括処理

## セットアップ

### 1. 依存関係のインストール

```bash
# Node.js 20以上が必要
node --version

# 依存関係のインストール
npm install
```

### 2. 環境変数の設定

使用したいAIプロバイダーのAPIキーを設定してください：

**方法1: 自動セットアップ（推奨）**

```bash
# .envファイルを自動作成
npm run setup

# .envファイルを編集してAPIキーを設定
# エディタで .env ファイルを開いて、実際のAPIキーに置き換えてください
```

**方法2: 手動セットアップ**

```bash
# サンプルファイルをコピー
cp .env.example .env

# .envファイルを編集してAPIキーを設定
# エディタで .env ファイルを開いて、実際のAPIキーに置き換えてください
```

**設定確認**

```bash
# 設定済みプロバイダーの確認
npm run check-env

# 接続テスト
npm run test-connection
```

**注意**: 最低1つのプロバイダーを設定する必要があります。

### 3. ビルドと実行

```bash
# TypeScriptのビルド
npm run build

# 開発用実行（.envファイルから自動読み込み）
npm run dev

# 本番用実行
npm run start

# 実行ファイルのパス取得
npm run path
```

### 4. Claude Codeへの登録

**.envファイルを使用する場合（推奨）**

```bash
# シンプルな登録（.envファイルから自動読み込み）
claude mcp add parallel-ai -s project $(npm run path --silent)
```

**環境変数を直接指定する場合**

```bash
# MCPサーバーの登録
claude mcp add parallel-ai -s project $(npm run path --silent) \
  -e OPENAI_API_KEY="sk-..." \
  -e ANTHROPIC_API_KEY="sk-ant-..." \
  -e GEMINI_API_KEY="..." \
  -e DEEPSEEK_API_KEY="sk-..." \
  -e OLLAMA_BASE_URL="http://localhost:11434"
```

## 使用例

### 基本的な並行思考

```
複数のAIに「人工知能の未来について」を質問して、異なる視点から回答してもらって
```

### プロバイダーを指定した思考

```
OpenAIとAnthropicに「気候変動対策として最も効果的な方法は何か」を質問して
```

### バリエーションを含む思考

```
「プログラミング学習の最適な方法」について、以下の異なる角度から複数のAIに質問して：
1. 初心者向けのアプローチ
2. 経験者向けの効率的な学習法
3. 実務で使えるスキル習得方法
```

### 結果の分析

```
セッション session-xxx の結果を要約して、各AIの共通点と相違点を教えて
```

```
セッション session-xxx から最も信頼できる合意点を抽出して
```

### トークン節約の活用 💰

**簡単なタスクの委譲**
```
DeepSeekに「Pythonで配列の重複を除去する関数を作って」を委譲して
```

**段階的処理でコスト削減**
```
「プロジェクト提案書」のドラフトをOllamaで作成して、その後Claudeで調整して
```

**長文の効率的要約**
```
以下の長い技術文書を要約して：
（長いテキスト）
```

**バッチ処理で一括節約**
```
以下のタスクをまとめて格安LLMで処理して：
1. JavaScriptでランダム数生成
2. CSSでセンタリング方法
3. SQLでテーブル結合の例
```

## 実践的な活用例

### 1. 意思決定支援
複数のAIから異なる視点での意見を収集し、バランスの取れた判断材料を得る

### 2. 創作・アイデア発想
複数のAIから多様なアイデアを並行で生成し、創造的な発想を促進

### 3. 技術的課題の解決
複数のAIから異なるアプローチの提案を得て、最適解を見つける

### 4. 学習・研究支援
同じトピックに対する複数の説明や分析を並行で取得し、理解を深める

## プロジェクト構成

```
parallel-ai-thought-mcp/
├── src/
│   └── index.ts             # 並行AI思考システムのメインファイル
├── dist/                    # ビルド出力（npm run build で生成）
├── .env.example             # 環境変数設定のサンプル
├── .env                     # 環境変数設定（要作成）
├── package.json
├── tsconfig.json
└── README.md
```

## 技術仕様

### 対応AIプロバイダー

| プロバイダー | 環境変数 | デフォルトモデル |
|-------------|----------|-----------------|
| OpenAI | `OPENAI_API_KEY` | gpt-4 |
| Anthropic | `ANTHROPIC_API_KEY` | claude-3-5-sonnet-20241022 |
| Google Gemini | `GEMINI_API_KEY` | gemini-pro |
| DeepSeek | `DEEPSEEK_API_KEY` | deepseek-chat |
| Ollama | `OLLAMA_BASE_URL` | llama3.2 |

### パフォーマンス

- 並行実行により複数AIからの回答を効率的に取得
- レスポンス時間は最も遅いプロバイダーに依存
- トークン使用量とレスポンス時間を詳細に記録

## トラブルシューティング

### よくあるエラー

| エラー | 原因 | 解決方法 |
|--------|------|----------|
| `利用可能なAIプロバイダーがありません` | APIキー未設定 | 最低1つのプロバイダーのAPIキーを設定 |
| `API error: 401` | APIキー無効 | 正しいAPIキーを再設定 |
| `API error: 429` | レート制限 | 時間をおいて再実行、またはプロバイダーを変更 |
| `timeout` | ネットワーク遅延 | maxTokensを減らすか、プロバイダーを変更 |

### デバッグ方法

```bash
# REPL形式での動作確認
npm run dev

# プロバイダー一覧の確認
{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list-providers", "arguments": {}}}
```

## ライセンス

MIT License

## 作者

このシステムは元のMCPハンズオンプロジェクトをベースに、並行AI思考機能を実装したものです。
