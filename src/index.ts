import 'dotenv/config';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// AI提供者の種類
type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'ollama';

// AI思考タスクの定義
interface AIThoughtTask {
  id: string;
  prompt: string;
  provider: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, any>;
}

// AI応答の定義
interface AIThoughtResponse {
  taskId: string;
  provider: AIProvider;
  model: string;
  response: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  timestamp: number;
  duration: number;
}

// 並行思考結果
interface ParallelThoughtResult {
  sessionId: string;
  tasks: AIThoughtTask[];
  responses: AIThoughtResponse[];
  summary?: string;
  consensus?: string;
  totalDuration: number;
  timestamp: number;
}

// AI提供者の設定
interface AIProviderConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
}

class AIInterface {
  private configs: Map<AIProvider, AIProviderConfig> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // 環境変数からAPI設定を読み込み
    if (process.env.OPENAI_API_KEY) {
      this.configs.set('openai', {
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        defaultModel: 'gpt-4'
      });
    }

    if (process.env.ANTHROPIC_API_KEY) {
      this.configs.set('anthropic', {
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
        defaultModel: 'claude-3-5-sonnet-20241022'
      });
    }

    if (process.env.GEMINI_API_KEY) {
      this.configs.set('gemini', {
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com',
        defaultModel: 'gemini-pro'
      });
    }

    if (process.env.DEEPSEEK_API_KEY) {
      this.configs.set('deepseek', {
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        defaultModel: 'deepseek-chat'
      });
    }

    if (process.env.OLLAMA_BASE_URL) {
      this.configs.set('ollama', {
        apiKey: 'not-needed',
        baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        defaultModel: 'llama3.2'
      });
    }
  }

  async executeTask(task: AIThoughtTask): Promise<AIThoughtResponse> {
    const startTime = Date.now();
    const config = this.configs.get(task.provider);
    
    if (!config) {
      throw new Error(`Provider ${task.provider} is not configured`);
    }

    try {
      const response = await this.callAI(task, config);
      const endTime = Date.now();

      return {
        taskId: task.id,
        provider: task.provider,
        model: task.model || config.defaultModel || 'unknown',
        response: response.content,
        usage: response.usage,
        timestamp: endTime,
        duration: endTime - startTime
      };
    } catch (error) {
      console.error(`Error executing task ${task.id} with ${task.provider}:`, error);
      const endTime = Date.now();
      
      return {
        taskId: task.id,
        provider: task.provider,
        model: task.model || config.defaultModel || 'unknown',
        response: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: endTime,
        duration: endTime - startTime
      };
    }
  }

  private async callAI(task: AIThoughtTask, config: AIProviderConfig): Promise<{
    content: string;
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  }> {
    const model = task.model || config.defaultModel;

    switch (task.provider) {
      case 'openai':
        return this.callOpenAI(task, config, model!);
      case 'anthropic':
        return this.callAnthropic(task, config, model!);
      case 'gemini':
        return this.callGemini(task, config, model!);
      case 'deepseek':
        return this.callDeepSeek(task, config, model!);
      case 'ollama':
        return this.callOllama(task, config, model!);
      default:
        throw new Error(`Unsupported provider: ${task.provider}`);
    }
  }

  private async callOpenAI(task: AIThoughtTask, config: AIProviderConfig, model: string) {
    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: task.prompt }],
        temperature: task.temperature || 0.7,
        max_tokens: task.maxTokens || 2000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    };
  }

  private async callAnthropic(task: AIThoughtTask, config: AIProviderConfig, model: string) {
    const response = await fetch(`${config.baseURL}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: task.prompt }],
        temperature: task.temperature || 0.7,
        max_tokens: task.maxTokens || 2000
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.content[0]?.text || '',
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
      } : undefined
    };
  }

  private async callGemini(task: AIThoughtTask, config: AIProviderConfig, model: string) {
    const response = await fetch(`${config.baseURL}/v1/models/${model}:generateContent?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: task.prompt }] }],
        generationConfig: {
          temperature: task.temperature || 0.7,
          maxOutputTokens: task.maxTokens || 2000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      usage: data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount,
        completionTokens: data.usageMetadata.candidatesTokenCount,
        totalTokens: data.usageMetadata.totalTokenCount
      } : undefined
    };
  }

  private async callDeepSeek(task: AIThoughtTask, config: AIProviderConfig, model: string) {
    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: task.prompt }],
        temperature: task.temperature || 0.7,
        max_tokens: task.maxTokens || 2000
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    };
  }

  private async callOllama(task: AIThoughtTask, config: AIProviderConfig, model: string) {
    const response = await fetch(`${config.baseURL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        prompt: task.prompt,
        stream: false,
        options: {
          temperature: task.temperature || 0.7,
          num_predict: task.maxTokens || 2000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.response || '',
      usage: undefined // Ollamaは詳細な使用量を返さない
    };
  }

  getAvailableProviders(): AIProvider[] {
    return Array.from(this.configs.keys());
  }
}

export { AIInterface, AIThoughtTask, AIThoughtResponse, ParallelThoughtResult, AIProvider };

// 並行タスクマネージャー
class ParallelThoughtManager {
  public aiInterface: AIInterface;
  private sessions: Map<string, ParallelThoughtResult> = new Map();

  constructor() {
    this.aiInterface = new AIInterface();
  }

  async executeParallelThoughts(
    sessionId: string,
    basePrompt: string,
    providers: AIProvider[],
    options?: {
      variants?: string[];
      temperature?: number;
      maxTokens?: number;
      customModels?: Partial<Record<AIProvider, string>>;
    }
  ): Promise<ParallelThoughtResult> {
    const startTime = Date.now();
    
    // タスクを生成
    const tasks: AIThoughtTask[] = [];
    const variants = options?.variants || [''];
    
    for (const provider of providers) {
      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        const prompt = variant ? `${basePrompt}\n\n${variant}` : basePrompt;
        
        tasks.push({
          id: `${provider}-${i}`,
          prompt,
          provider,
          model: options?.customModels?.[provider],
          temperature: options?.temperature,
          maxTokens: options?.maxTokens
        });
      }
    }

    // 並行実行
    const responses = await Promise.all(
      tasks.map(task => this.aiInterface.executeTask(task))
    );

    const endTime = Date.now();
    const result: ParallelThoughtResult = {
      sessionId,
      tasks,
      responses,
      totalDuration: endTime - startTime,
      timestamp: endTime
    };

    // 結果を保存
    this.sessions.set(sessionId, result);

    return result;
  }

  async summarizeResponses(sessionId: string, summaryProvider: AIProvider = 'anthropic'): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const responsesText = session.responses
      .map(r => `**${r.provider} (${r.model})**:\n${r.response}`)
      .join('\n\n---\n\n');

    const summaryPrompt = `以下は同じ質問に対する複数のAIの回答です。これらの回答を分析し、共通点、相違点、そして総合的な洞察をまとめてください。

${responsesText}

以下の形式で回答してください：
1. 共通する見解
2. 異なる観点
3. 総合的な結論`;

    const summaryTask: AIThoughtTask = {
      id: `summary-${sessionId}`,
      prompt: summaryPrompt,
      provider: summaryProvider,
      temperature: 0.3
    };

    const summaryResponse = await this.aiInterface.executeTask(summaryTask);
    session.summary = summaryResponse.response;

    return summaryResponse.response;
  }

  async findConsensus(sessionId: string, consensusProvider: AIProvider = 'anthropic'): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const responsesText = session.responses
      .map(r => `**${r.provider}**: ${r.response}`)
      .join('\n\n');

    const consensusPrompt = `以下は同じ質問に対する複数のAIの回答です。これらの回答から最も合理的で信頼性の高い結論を導き出してください。

${responsesText}

合意できる結論を簡潔に述べてください：`;

    const consensusTask: AIThoughtTask = {
      id: `consensus-${sessionId}`,
      prompt: consensusPrompt,
      provider: consensusProvider,
      temperature: 0.1
    };

    const consensusResponse = await this.aiInterface.executeTask(consensusTask);
    session.consensus = consensusResponse.response;

    return consensusResponse.response;
  }

  getSession(sessionId: string): ParallelThoughtResult | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): ParallelThoughtResult[] {
    return Array.from(this.sessions.values());
  }

  getAvailableProviders(): AIProvider[] {
    return this.aiInterface.getAvailableProviders();
  }

  // 外部から個別のタスクを実行するためのメソッド
  async executeTask(task: AIThoughtTask): Promise<AIThoughtResponse> {
    return this.aiInterface.executeTask(task);
  }
}

// MCPサーバーの初期化
const thoughtManager = new ParallelThoughtManager();

const server = new McpServer({
  name: "parallel-ai-thought",
  version: "1.0.0",
});

// ツール1: 並行AI思考実行
server.registerTool(
  "parallel-ai-think",
  {
    title: "並行AI思考",
    description: "複数のAIプロバイダーに同じ質問を並行で投げて、異なる視点からの回答を得る",
    inputSchema: {
      prompt: z.string().describe("AIに投げる質問やプロンプト"),
      providers: z.array(z.enum(['openai', 'anthropic', 'gemini', 'deepseek', 'ollama'])).optional().describe("使用するAIプロバイダー（未指定の場合は利用可能な全プロバイダー）"),
      sessionId: z.string().optional().describe("セッションID（未指定の場合は自動生成）"),
      variants: z.array(z.string()).optional().describe("プロンプトのバリエーション（異なる角度からの質問）"),
      temperature: z.number().min(0).max(2).optional().describe("回答の創造性（0-2、デフォルト0.7）"),
      maxTokens: z.number().min(1).max(4000).optional().describe("最大トークン数（デフォルト2000）"),
      customModels: z.record(z.string()).optional().describe("プロバイダー毎のカスタムモデル指定")
    },
  },
  async ({ prompt, providers, sessionId, variants, temperature, maxTokens, customModels }) => {
    const availableProviders = thoughtManager.getAvailableProviders();
    
    if (availableProviders.length === 0) {
      throw new Error("利用可能なAIプロバイダーがありません。環境変数でAPIキーを設定してください。");
    }

    const targetProviders = providers && providers.length > 0 
      ? providers.filter(p => availableProviders.includes(p))
      : availableProviders;

    if (targetProviders.length === 0) {
      throw new Error("指定されたプロバイダーは利用できません。");
    }

    const finalSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const result = await thoughtManager.executeParallelThoughts(
        finalSessionId,
        prompt,
        targetProviders,
        {
          variants,
          temperature,
          maxTokens,
          customModels: customModels as Partial<Record<AIProvider, string>>
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              sessionId: result.sessionId,
              prompt,
              providers: targetProviders,
              responses: result.responses.map(r => ({
                provider: r.provider,
                model: r.model,
                response: r.response,
                duration: r.duration,
                usage: r.usage
              })),
              totalDuration: result.totalDuration,
              timestamp: result.timestamp
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`並行思考の実行に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

// ツール2: 思考結果の要約
server.registerTool(
  "summarize-thoughts",
  {
    title: "思考結果要約",
    description: "並行AI思考の結果を分析して要約する",
    inputSchema: {
      sessionId: z.string().describe("要約したいセッションのID"),
      summaryProvider: z.enum(['openai', 'anthropic', 'gemini', 'deepseek', 'ollama']).optional().describe("要約に使用するAIプロバイダー（デフォルト: anthropic）")
    },
  },
  async ({ sessionId, summaryProvider }) => {
    try {
      const summary = await thoughtManager.summarizeResponses(sessionId, summaryProvider);
      const session = thoughtManager.getSession(sessionId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              sessionId,
              summary,
              originalResponses: session?.responses.length || 0,
              timestamp: Date.now()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`要約の生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

// ツール3: 合意点抽出
server.registerTool(
  "find-consensus",
  {
    title: "合意点抽出",
    description: "複数のAI回答から合意できる結論を導出する",
    inputSchema: {
      sessionId: z.string().describe("分析したいセッションのID"),
      consensusProvider: z.enum(['openai', 'anthropic', 'gemini', 'deepseek', 'ollama']).optional().describe("合意分析に使用するAIプロバイダー（デフォルト: anthropic）")
    },
  },
  async ({ sessionId, consensusProvider }) => {
    try {
      const consensus = await thoughtManager.findConsensus(sessionId, consensusProvider);
      const session = thoughtManager.getSession(sessionId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              sessionId,
              consensus,
              originalResponses: session?.responses.length || 0,
              timestamp: Date.now()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`合意点の抽出に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

// ツール4: セッション情報取得
server.registerTool(
  "get-session-info",
  {
    title: "セッション情報取得",
    description: "特定のセッションの詳細情報を取得する",
    inputSchema: {
      sessionId: z.string().describe("情報を取得したいセッションのID")
    },
  },
  async ({ sessionId }) => {
    const session = thoughtManager.getSession(sessionId);
    
    if (!session) {
      throw new Error(`セッション ${sessionId} が見つかりません`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(session, null, 2)
        }
      ]
    };
  }
);

// ツール5: 利用可能なプロバイダー一覧
server.registerTool(
  "list-providers",
  {
    title: "プロバイダー一覧",
    description: "現在利用可能なAIプロバイダーの一覧を取得する",
    inputSchema: {},
  },
  async () => {
    const providers = thoughtManager.getAvailableProviders();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            availableProviders: providers,
            totalCount: providers.length,
            timestamp: Date.now()
          }, null, 2)
        }
      ]
    };
  }
);

// ツール6: 全セッション一覧
server.registerTool(
  "list-sessions",
  {
    title: "セッション一覧",
    description: "これまでに実行された全セッションの一覧を取得する",
    inputSchema: {},
  },
  async () => {
    const sessions = thoughtManager.getAllSessions();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            sessions: sessions.map(s => ({
              sessionId: s.sessionId,
              responsesCount: s.responses.length,
              totalDuration: s.totalDuration,
              timestamp: s.timestamp,
              hasSummary: !!s.summary,
              hasConsensus: !!s.consensus
            })),
            totalSessions: sessions.length,
            timestamp: Date.now()
          }, null, 2)
        }
      ]
    };
  }
);

// ツール7: 格安LLMへの委譲（トークン節約）
server.registerTool(
  "delegate-to-cheap-llm",
  {
    title: "格安LLM委譲",
    description: "トークン消費を抑えるため、簡単なタスクを格安LLM（DeepSeek、Ollama等）に委譲する",
    inputSchema: {
      task: z.string().describe("委譲したいタスクの説明"),
      provider: z.enum(['deepseek', 'ollama']).optional().describe("使用する格安プロバイダー（未指定の場合は利用可能な最も安いものを自動選択）"),
      model: z.string().optional().describe("カスタムモデル指定"),
      temperature: z.number().min(0).max(2).optional().default(0.3).describe("創造性レベル（節約重視で低めに設定）"),
      maxTokens: z.number().min(1).max(2000).optional().default(1000).describe("最大トークン数（節約重視で低めに設定）")
    },
  },
  async ({ task, provider, model, temperature, maxTokens }) => {
    const availableProviders = thoughtManager.getAvailableProviders();
    const cheapProviders = ['deepseek', 'ollama'].filter(p => availableProviders.includes(p as AIProvider));
    
    if (cheapProviders.length === 0) {
      throw new Error("格安プロバイダー（DeepSeek、Ollama）が利用できません。環境変数を設定してください。");
    }

    const targetProvider = provider && cheapProviders.includes(provider) 
      ? provider 
      : cheapProviders[0]; // 最初に利用可能な格安プロバイダーを使用

    const delegationTask: AIThoughtTask = {
      id: `delegate-${Date.now()}`,
      prompt: `以下のタスクを効率的に実行してください。簡潔で実用的な回答を心がけてください：

${task}`,
      provider: targetProvider as AIProvider,
      model,
      temperature,
      maxTokens
    };

    try {
      const response = await thoughtManager.executeTask(delegationTask);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              task,
              delegatedTo: targetProvider,
              model: response.model,
              result: response.response,
              tokenUsage: response.usage,
              duration: response.duration,
              costSaving: "高額プロバイダーの使用を回避してコストを節約しました",
              timestamp: response.timestamp
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`格安LLM委譲に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

// ツール8: ドラフト作成→調整（段階的処理）
server.registerTool(
  "draft-and-refine",
  {
    title: "ドラフト作成→調整",
    description: "格安LLMでドラフトを作成後、高品質LLMで調整する段階的処理でトークンを節約",
    inputSchema: {
      task: z.string().describe("作成したい内容の説明"),
      cheapProvider: z.enum(['deepseek', 'ollama']).optional().describe("ドラフト作成用の格安プロバイダー"),
      refineProvider: z.enum(['openai', 'anthropic', 'gemini']).optional().describe("調整用の高品質プロバイダー"),
      draftMaxTokens: z.number().min(1).max(2000).optional().default(1000).describe("ドラフト作成時の最大トークン数"),
      refineMaxTokens: z.number().min(1).max(1500).optional().default(800).describe("調整時の最大トークン数")
    },
  },
  async ({ task, cheapProvider, refineProvider, draftMaxTokens, refineMaxTokens }) => {
    const availableProviders = thoughtManager.getAvailableProviders();
    const cheapProviders = ['deepseek', 'ollama'].filter(p => availableProviders.includes(p as AIProvider));
    const premiumProviders = ['openai', 'anthropic', 'gemini'].filter(p => availableProviders.includes(p as AIProvider));
    
    if (cheapProviders.length === 0) {
      throw new Error("格安プロバイダーが利用できません。");
    }
    if (premiumProviders.length === 0) {
      throw new Error("高品質プロバイダーが利用できません。");
    }

    const selectedCheap = cheapProvider && cheapProviders.includes(cheapProvider) 
      ? cheapProvider : cheapProviders[0];
    const selectedPremium = refineProvider && premiumProviders.includes(refineProvider) 
      ? refineProvider : premiumProviders[0];

    // Step 1: 格安LLMでドラフト作成
    const draftTask: AIThoughtTask = {
      id: `draft-${Date.now()}`,
      prompt: `以下の要求に対してドラフトを作成してください。完璧である必要はありません。まずは基本的な構造と内容を提供してください：

${task}`,
      provider: selectedCheap as AIProvider,
      temperature: 0.7,
      maxTokens: draftMaxTokens
    };

    const draftResponse = await thoughtManager.executeTask(draftTask);

    // Step 2: 高品質LLMで調整
    const refineTask: AIThoughtTask = {
      id: `refine-${Date.now()}`,
      prompt: `以下のドラフトを改善・調整してください。内容の精度向上、表現の改善、構造の最適化を行ってください：

【元の要求】
${task}

【ドラフト】
${draftResponse.response}

改善された最終版を提供してください：`,
      provider: selectedPremium as AIProvider,
      temperature: 0.3,
      maxTokens: refineMaxTokens
    };

    const refinedResponse = await thoughtManager.executeTask(refineTask);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            task,
            process: "段階的処理",
            draftPhase: {
              provider: selectedCheap,
              model: draftResponse.model,
              tokens: draftResponse.usage,
              duration: draftResponse.duration
            },
            refinePhase: {
              provider: selectedPremium,
              model: refinedResponse.model,
              tokens: refinedResponse.usage,
              duration: refinedResponse.duration
            },
            draft: draftResponse.response,
            finalResult: refinedResponse.response,
            totalDuration: draftResponse.duration + refinedResponse.duration,
            costOptimization: "格安LLMでドラフト作成→高品質LLMで調整の段階的処理により、トークン消費を最適化しました"
          }, null, 2)
        }
      ]
    };
  }
);

// ツール9: 長文要約（前処理）
server.registerTool(
  "summarize-for-efficiency",
  {
    title: "効率的要約",
    description: "長いテキストを格安LLMで要約して、メインLLMのトークン消費を削減する前処理",
    inputSchema: {
      text: z.string().describe("要約したい長いテキスト"),
      summaryLength: z.enum(['short', 'medium', 'detailed']).optional().default('medium').describe("要約の長さ"),
      provider: z.enum(['deepseek', 'ollama']).optional().describe("要約用の格安プロバイダー"),
      focus: z.string().optional().describe("要約時に重点を置く観点やテーマ")
    },
  },
  async ({ text, summaryLength, provider, focus }) => {
    const availableProviders = thoughtManager.getAvailableProviders();
    const cheapProviders = ['deepseek', 'ollama'].filter(p => availableProviders.includes(p as AIProvider));
    
    if (cheapProviders.length === 0) {
      throw new Error("格安プロバイダーが利用できません。");
    }

    const targetProvider = provider && cheapProviders.includes(provider) 
      ? provider : cheapProviders[0];

    const lengthInstructions = {
      short: "3-5文で簡潔に",
      medium: "1-2段落で適度に詳しく",
      detailed: "3-4段落で詳細に"
    };

    const summaryPrompt = `以下のテキストを${lengthInstructions[summaryLength]}要約してください。${
      focus ? `特に「${focus}」の観点を重視してください。` : ""
    }

【要約対象テキスト】
${text}

要約：`;

    const summaryTask: AIThoughtTask = {
      id: `summary-${Date.now()}`,
      prompt: summaryPrompt,
      provider: targetProvider as AIProvider,
      temperature: 0.1,
      maxTokens: summaryLength === 'short' ? 200 : summaryLength === 'medium' ? 400 : 600
    };

    const response = await thoughtManager.executeTask(summaryTask);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            originalLength: text.length,
          summaryLength: response.response.length,
          compressionRatio: `${Math.round((1 - response.response.length / text.length) * 100)}%削減`,
          summary: response.response,
          provider: targetProvider,
          tokenUsage: response.usage,
          duration: response.duration,
          efficiency: "長文を格安LLMで要約することで、後続処理のトークン消費を大幅に削減しました"
        }, null, 2)
        }
      ]
    };
  }
);

// ツール10: バッチ処理（複数タスクの一括処理）
server.registerTool(
  "batch-process-cheap",
  {
    title: "バッチ処理",
    description: "複数の単純なタスクを格安LLMで一括処理してトークンを節約",
    inputSchema: {
      tasks: z.array(z.string()).describe("処理したいタスクのリスト"),
      provider: z.enum(['deepseek', 'ollama']).optional().describe("使用する格安プロバイダー"),
      maxTokensPerTask: z.number().min(50).max(500).optional().default(200).describe("タスクあたりの最大トークン数")
    },
  },
  async ({ tasks, provider, maxTokensPerTask }) => {
    const availableProviders = thoughtManager.getAvailableProviders();
    const cheapProviders = ['deepseek', 'ollama'].filter(p => availableProviders.includes(p as AIProvider));
    
    if (cheapProviders.length === 0) {
      throw new Error("格安プロバイダーが利用できません。");
    }

    const targetProvider = provider && cheapProviders.includes(provider) 
      ? provider : cheapProviders[0];

    const batchPrompt = `以下の${tasks.length}個のタスクを順番に処理してください。各タスクの回答は簡潔で実用的にしてください：

${tasks.map((task, index) => `${index + 1}. ${task}`).join('\n')}

各タスクの回答を以下の形式で提供してください：
【タスク1の回答】
（回答内容）

【タスク2の回答】
（回答内容）

...`;

    const batchTask: AIThoughtTask = {
      id: `batch-${Date.now()}`,
      prompt: batchPrompt,
      provider: targetProvider as AIProvider,
      temperature: 0.3,
      maxTokens: Math.min(tasks.length * maxTokensPerTask, 2000)
    };

    const response = await thoughtManager.executeTask(batchTask);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            tasksCount: tasks.length,
            batchResult: response.response,
            provider: targetProvider,
            model: response.model,
            tokenUsage: response.usage,
            duration: response.duration,
            efficiency: `${tasks.length}個のタスクを1回のAPI呼び出しで処理し、大幅なトークン節約を実現しました`
          }, null, 2)
        }
      ]
    };
  }
);

// サーバー起動処理
async function main() {
  const availableProviders = thoughtManager.getAvailableProviders();
  
  if (availableProviders.length === 0) {
    console.error("警告: 利用可能なAIプロバイダーがありません。");
    console.error("以下の環境変数のいずれかを設定してください:");
    console.error("- OPENAI_API_KEY");
    console.error("- ANTHROPIC_API_KEY");
    console.error("- GEMINI_API_KEY");
    console.error("- DEEPSEEK_API_KEY");
    console.error("- OLLAMA_BASE_URL");
  } else {
    console.error(`🧠 利用可能なAIプロバイダー: ${availableProviders.join(', ')}`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🤖 並行AI思考サーバーが起動しました");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
