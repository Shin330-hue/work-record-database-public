import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { searchKnowledgeBase, formatSearchResults } from '@/lib/knowledge-search-v2'

// Ollama設定
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'

// RAG機能フラグ
const ENABLE_RAG = process.env.ENABLE_RAG === 'true'

// 利用可能なモデル一覧
const AVAILABLE_MODELS = [
  // 実用的な4モデル（Ollamaで確認済み）
  { id: 'gemma3:12b', name: '🧠 賢い - Gemma3 12B', provider: 'ollama' },
  { id: 'qwen2.5:7b-instruct', name: '⚖️ バランス型 - Qwen2.5 7B Instruct', provider: 'ollama' },
  { id: 'gemma3:12b-it-q4_K_M', name: '⚡ 軽量・高速 - Gemma3 Q4', provider: 'ollama' },
  { id: 'qwen2.5:7b-instruct-q4_k_m', name: '💾 省メモリ - Qwen2.5 Q4', provider: 'ollama' }
]

// Gemini APIキーを環境変数から取得
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// システムプロンプト（RAG OFF時：システムプロンプトなし）
const counselorPrompt = ``

// システムプロンプト（RAG ON時：専門家モード）
const expertPrompt = `あなたは「町工場GPT」という名前の、機械加工と製造業に特化した技術アシスタントです。
    
以下の特徴を持って回答してください：
- 機械加工（旋盤、マシニング、横中、ラジアル）の専門知識を持つ
- 切削条件、工具選定、加工手順について詳しい
- 現場の作業者に分かりやすく説明する
- 具体的で実践的なアドバイスを提供
- 安全性を常に重視
- 日本の製造業の慣習に詳しい
- 技術的な内容に集中し、正確な情報を提供
- 回答は500文字以内で簡潔にまとめる

ユーザーの質問に対して、専門的で正確な日本語で回答してください。`

// モデル一覧を取得するGETエンドポイント
export async function GET() {
  return NextResponse.json({ models: AVAILABLE_MODELS })
}

export async function POST(request: NextRequest) {
  try {
    const { messages, model, enableRAG } = await request.json()
    
    // 選択されたモデル情報を取得
    const selectedModel = AVAILABLE_MODELS.find(m => m.id === model) || AVAILABLE_MODELS[0]
    const useOllamaForThisRequest = selectedModel.provider === 'ollama'
    const modelId = selectedModel.id
    
    // RAG機能：社内データ検索（環境変数またはリクエストで有効化）
    let ragContext = ''
    const shouldUseRAG = ENABLE_RAG || enableRAG
    
    if (shouldUseRAG && messages.length > 0) {
      try {
        const lastMessage = messages[messages.length - 1]
        const conversationHistory = messages.slice(0, -1).map((m: { content: string }) => m.content)
        
        console.log('🔍 RAG検索開始:', lastMessage.content)
        const searchResults = await searchKnowledgeBase(lastMessage.content, conversationHistory)
        ragContext = formatSearchResults(searchResults)
        console.log('📊 RAG検索結果:', searchResults.statistics)
      } catch (ragError) {
        console.error('RAG検索エラー:', ragError)
        // RAG失敗時も通常のチャットは継続
      }
    }
    
    // RAG有効時は専門家モード、無効時はカウンセラーモード
    const basePrompt = shouldUseRAG ? expertPrompt : counselorPrompt
    
    // プロンプトにRAGコンテキストを追加
    const enhancedSystemPrompt = ragContext 
      ? `${basePrompt}\n\n${ragContext}\n\n【社内データ活用の回答ルール】
■ 社内データ優先原則
- 上記の検索結果に該当情報がある場合は、必ずその内容を最優先で回答する
- 図番、材質、加工条件等の具体的データは検索結果の情報のみ使用する
- 社内データと矛盾する一般論は避ける

■ 一般知識との組み合わせ
- 社内データで足りない部分は、機械加工の一般的な知識で補完してOK
- 「社内データによると〜」「一般的には〜」と情報源を明確に分ける
- 安全性・品質に関わる重要事項は推測せず「確認が必要です」と案内

■ 具体的な回答例
✅ 良い例：「社内データでは図番○○でSUS304の切削条件があります。一般的にSUS304は〜の特性があるため、回転数は〜rpm程度が適切です」
❌ 悪い例：「データにありません」「わかりません」だけの回答`
      : basePrompt

    // Ollamaモデルを使用する場合
    if (useOllamaForThisRequest) {
      try {
        // Ollama用のメッセージ形式に変換
        const ollamaMessages = [
          { role: 'system', content: enhancedSystemPrompt },
          ...messages
        ]

        // Ollama APIにリクエスト
        const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelId,
            messages: ollamaMessages,
            stream: false
          })
        })

        if (!ollamaResponse.ok) {
          throw new Error(`Ollama API error: ${ollamaResponse.status}`)
        }

        const ollamaData = await ollamaResponse.json()
        return NextResponse.json({ response: ollamaData.message.content })
        
      } catch (ollamaError) {
        console.error('Ollama error:', ollamaError)
        // Ollamaエラー時はエラーを返す（フォールバックなし）
        return NextResponse.json({ 
          response: `${selectedModel.name} でエラーが発生しました。別のモデルをお試しください。\n\nエラー: ${ollamaError instanceof Error ? ollamaError.message : 'Unknown error'}` 
        }, { status: 500 })
      }
    }

    // Geminiを使用する場合
    const geminiModel = genAI.getGenerativeModel({ model: modelId })

    // 会話履歴を構築
    const conversationHistory = messages.map((msg: { role: string; content: string }) => 
      `${msg.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${msg.content}`
    ).join('\n\n')

    // Geminiに送信するプロンプト
    const prompt = `${enhancedSystemPrompt}\n\n会話履歴:\n${conversationHistory}\n\nアシスタント:`

    // Geminiからの応答を取得
    const result = await geminiModel.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    return NextResponse.json({ response: text })
  } catch (error) {
    console.error('Chat API error:', error)
    
    // APIキーが設定されていない場合のメッセージ
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ 
        response: '申し訳ございません。現在、AIアシスタント機能は準備中です。\n\nGemini APIキーを環境変数に設定してください：\n1. .env.localファイルを作成\n2. GEMINI_API_KEY=your-api-key を追加\n3. サーバーを再起動\n\n詳しくは管理者にお問い合わせください。' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      response: 'エラーが発生しました。しばらく経ってからもう一度お試しください。' 
    }, { status: 500 })
  }
}