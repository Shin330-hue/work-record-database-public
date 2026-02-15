'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AIModel {
  id: string
  name: string
  provider: string
}

export default function ChatPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'こんにちは！町工場GPTです。🔧\n\n作業のこと、加工のこと、何でも気軽に話しかけてください。\n\n例えば：\n・「SUS304の切削条件を教えて」\n・「アルミの薄物加工で困ってる」\n・「今日の調子はどう？」\n・「ちょっと聞いてほしいことがある」',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [models, setModels] = useState<AIModel[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('qwen2.5:7b-instruct-q4_k_m')
  const [enableRAG, setEnableRAG] = useState<boolean>(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 自動スクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // モデル一覧を取得
  useEffect(() => {
    fetch('/api/chat')
      .then(res => res.json())
      .then(data => setModels(data.models))
      .catch(err => console.error('Failed to load models:', err))
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // コンポーネントのアンマウント時やページ離脱時にAPIリクエストをキャンセル
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 無効化：エラーの原因となるため
      // if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      //   abortControllerRef.current.abort()
      // }
    }

    const handleVisibilityChange = () => {
      // 無効化：エラーの原因となるため  
      // if (document.hidden && abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      //   abortControllerRef.current.abort()
      // }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      // クリーンアップ：進行中のリクエストをキャンセル
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        abortControllerRef.current.abort()
      }
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // 新規チャット開始（履歴リセット）
  const handleNewChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'こんにちは！町工場GPTです。🔧\n\n作業のこと、加工のこと、何でも気軽に話しかけてください。\n\n例えば：\n・「SUS304の切削条件を教えて」\n・「アルミの薄物加工で困ってる」\n・「今日の調子はどう？」\n・「ちょっと聞いてほしいことがある」',
        timestamp: new Date()
      }
    ])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    // 前回のリクエストがあればキャンセル
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      abortControllerRef.current.abort()
    }

    // 新しいAbortControllerを作成
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          model: selectedModel,
          enableRAG: enableRAG
        }),
        signal: abortController.signal
      })

      if (!response.ok) throw new Error('API request failed')

      const data = await response.json()
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error:', error)
      
      // リクエストがキャンセルされた場合はエラーメッセージを表示しない
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was cancelled')
      } else {
        const errorMessage: Message = {
          role: 'assistant',
          content: 'すみません、エラーが発生しました。もう一度お試しください。',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } finally {
      setIsLoading(false)
      // リクエスト完了後、AbortControllerをクリア
      abortControllerRef.current = null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-6 h-screen flex flex-col">
        {/* ヘッダー */}
        <div className="bg-black/40 rounded-xl p-4 mb-4 border border-purple-500/30">
          {/* タイトル行 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="text-xl md:text-2xl">🤖</span>
              <h1 className="text-lg md:text-2xl font-bold text-white">町工場GPT</h1>
              <span className="hidden sm:inline-block text-purple-300 text-xs md:text-sm">- 加工技術アシスタント</span>
            </div>
            
            {/* ナビゲーションボタン（スマホでも常に表示） */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewChat}
                className="custom-rect-button purple small text-xs md:text-sm"
                title="新規チャットを開始"
              >
                <span className="hidden sm:inline">🆕 新規</span>
                <span className="sm:hidden">🆕</span>
              </button>
              <button
                onClick={() => router.push('/')}
                className="custom-rect-button gray small text-xs md:text-sm"
              >
                <span className="hidden sm:inline">ホームに戻る</span>
                <span className="sm:hidden">🏠</span>
              </button>
            </div>
          </div>
          
          {/* コントロール行 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* モデル選択 */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-purple-300 text-sm whitespace-nowrap">モデル:</span>
              <div className="relative flex-1 sm:flex-initial min-w-0">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="custom-chat-select w-full pr-10"
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id} className="bg-gray-900 text-white">
                      {model.name}
                    </option>
                  ))}
                </select>
                {/* カスタム矢印アイコン */}
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4"></path>
                  </svg>
                </div>
              </div>
            </div>
            
            {/* RAG機能切り替え */}
            <div className="flex items-center gap-2">
              <span className="text-purple-300 text-sm whitespace-nowrap">社内データ:</span>
              <button
                onClick={() => setEnableRAG(!enableRAG)}
                className={`custom-rect-button ${enableRAG ? 'emerald' : 'gray'} small`}
                title="社内データベース検索を有効/無効"
              >
                <span>{enableRAG ? '🔍 図面記録DB検索 ON' : '🔍 図面記録DB検索 OFF'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* チャットエリア */}
        <div className="flex-1 bg-gradient-to-b from-black/40 to-black/20 rounded-2xl border border-purple-500/20 shadow-2xl backdrop-blur-sm overflow-hidden flex flex-col">
          {/* メッセージ表示エリア */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
              >
                {/* AIメッセージの場合は左寄せ、アバター左側 */}
                {message.role === 'assistant' && (
                  <div className="flex items-start gap-3">
                    {/* AIアバター */}
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-xl">🤖</span>
                    </div>
                    
                    {/* メッセージバブル */}
                    <div className="chat-bubble-ai">
                      <p className="chat-bubble-text">
                        {message.content}
                      </p>
                      <div className="flex items-center gap-2 chat-bubble-timestamp">
                        <p className="text-emerald-300">
                          {message.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {enableRAG && (
                          <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
                            🧠 社内データ活用
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* ユーザーメッセージの場合は右寄せ、アバター右側 */}
                {message.role === 'user' && (
                  <div className="flex items-start gap-3 flex-row-reverse">
                    {/* ユーザーアバター */}
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-xl">👤</span>
                    </div>
                    
                    {/* メッセージバブル */}
                    <div className="chat-bubble-user">
                      <p className="chat-bubble-text">
                        {message.content}
                      </p>
                      <p className="chat-bubble-timestamp text-purple-300 text-right">
                        {message.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {/* ローディング表示 */}
            {isLoading && (
              <div className="flex justify-start animate-fadeIn">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-lg">🤖</span>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 backdrop-blur-sm border border-emerald-500/20 rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-300 text-sm">考え中</span>
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 入力エリア */}
          <form onSubmit={handleSubmit} className="p-6 bg-gradient-to-br from-black/60 via-black/40 to-black/30 backdrop-blur-md border-t border-purple-500/10">
            <div className="flex items-center gap-4">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="今日もお疲れさま。何か手伝える？"
                disabled={isLoading}
                className="custom-chat-input flex-1"
              />
              
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="custom-chat-send-button"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span className="hidden sm:inline font-semibold">送信中...</span>
                  </>
                ) : (
                  <>
                    <span className="text-xl">↵</span>
                    <span className="hidden sm:inline font-semibold">送信</span>
                  </>
                )}
              </button>
            </div>
            
          </form>
        </div>
      </div>
    </div>
  )
}