'use client'
import React, { useState, useEffect, useRef } from 'react'
import { SearchIndex, DrawingSearchItem } from '@/lib/dataLoader'

interface SearchBarProps {
  searchIndex: SearchIndex
  onSearch: (results: DrawingSearchItem[]) => void
  onDrawingSelect: (drawingNumber: string) => void
  placeholder?: string
}

export default function SearchBar({ searchIndex, onSearch, onDrawingSelect, placeholder }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<DrawingSearchItem[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // 検索履歴をローカルストレージから読み込み
  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedHistory = window.localStorage.getItem('searchHistory')
    if (savedHistory) {
      setSearchHistory(JSON.parse(savedHistory))
    }
  }, [])

  // 検索履歴をローカルストレージに保存
  const saveSearchHistory = (newHistory: string[]) => {
    setSearchHistory(newHistory)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('searchHistory', JSON.stringify(newHistory))
    }
  }

  // 検索履歴に追加
  const addToHistory = (searchTerm: string) => {
    if (!searchTerm.trim()) return
    
    const newHistory = [
      searchTerm,
      ...searchHistory.filter(item => item !== searchTerm)
    ].slice(0, 10) // 最新10件まで保持
    
    saveSearchHistory(newHistory)
  }

  // 検索履歴をクリア
  const clearHistory = () => {
    setSearchHistory([])
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('searchHistory')
    }
  }

  // 検索実行
  const performSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSuggestions([])
      onSearch([])
      return
    }

    const normalizedQuery = searchQuery.toLowerCase()
    const results = searchIndex.drawings
      .map(drawing => ({
        ...drawing,
        matchScore: calculateMatchScore(drawing, normalizedQuery)
      }))
      .filter(drawing => drawing.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10) // 上位10件を表示

    setSuggestions(results)
    onSearch(results)
  }

  // マッチスコア計算
  const calculateMatchScore = (drawing: DrawingSearchItem, query: string): number => {
    let score = 0

    // 図番完全一致（最高優先度）
    if (drawing.drawingNumber.toLowerCase() === query) {
      score += 100
    }
    // 図番部分一致
    else if (drawing.drawingNumber.toLowerCase().includes(query)) {
      score += 50
    }

    // タイトル検索
    if (drawing.title.toLowerCase().includes(query)) {
      score += 30
    }

    // キーワード検索
    const keywordMatches = drawing.keywords.filter(keyword => 
      keyword.toLowerCase().includes(query)
    ).length
    score += keywordMatches * 20

    // 会社名検索
    if (drawing.companyName.toLowerCase().includes(query)) {
      score += 10
    }

    // 部品名検索
    if (drawing.productName.toLowerCase().includes(query)) {
      score += 10
    }

    return score
  }

  // 入力変更時の処理
  const handleInputChange = (value: string) => {
    setQuery(value)
    setShowHistory(false)
    
    if (value.length > 0) {
      performSearch(value)
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
      onSearch([])
    }
  }

  // 図番選択時の処理
  const handleDrawingSelect = (drawingNumber: string) => {
    addToHistory(drawingNumber)
    onDrawingSelect(drawingNumber)
    setQuery('')
    setShowSuggestions(false)
    setShowHistory(false)
  }

  // 検索履歴から選択
  const handleHistorySelect = (historyItem: string) => {
    setQuery(historyItem)
    performSearch(historyItem)
    setShowHistory(false)
    setShowSuggestions(true)
  }

  // フォーカス時の処理
  const handleFocus = () => {
    if (query.length === 0 && searchHistory.length > 0) {
      setShowHistory(true)
    }
  }

  // 外部クリック時の処理
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
        setShowHistory(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="search-bar-container" ref={searchRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder || '図番を入力してください（例: ABC-001）'}
          className="search-input w-full px-4 py-4 text-lg border-2 border-emerald-500/30 rounded-2xl bg-white/10 backdrop-blur-md text-white placeholder-emerald-200/60 focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 transition-all duration-300 shadow-lg"
        />
        
        {/* 検索アイコン */}
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-emerald-300">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* 検索候補 */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="search-suggestions absolute top-full left-0 right-0 mt-3 bg-white/10 backdrop-blur-md border border-emerald-500/30 rounded-2xl shadow-2xl z-50 max-h-96 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              className="w-full px-6 py-4 text-left hover:bg-emerald-500/20 border-b border-emerald-500/20 last:border-b-0 transition-all duration-200 group"
              onClick={() => handleDrawingSelect(suggestion.drawingNumber)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-emerald-300 text-lg group-hover:text-emerald-200 transition-colors">
                    {suggestion.displayDrawingNumber || suggestion.drawingNumber}
                  </div>
                  <div className="text-white text-sm font-medium">
                    {suggestion.title}
                  </div>
                  <div className="text-emerald-200/70 text-xs">
                    {suggestion.companyName} - {suggestion.productName}
                  </div>
                  <div className="text-emerald-200/60 text-xs mt-1">
                    {suggestion.estimatedTime}
                  </div>
                </div>
                <div className="text-emerald-300/50 group-hover:text-emerald-200 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 検索履歴 */}
      {showHistory && searchHistory.length > 0 && (
        <div className="search-history absolute top-full left-0 right-0 mt-3 bg-white/10 backdrop-blur-md border border-emerald-500/30 rounded-2xl shadow-2xl z-50">
          <div className="flex items-center justify-between px-6 py-3 border-b border-emerald-500/20">
            <span className="text-emerald-200 text-sm font-medium">検索履歴</span>
            <button
              onClick={clearHistory}
              className="text-emerald-300/70 hover:text-emerald-200 text-sm transition-colors"
            >
              クリア
            </button>
          </div>
          {searchHistory.map((historyItem, index) => (
            <button
              key={index}
              className="w-full px-6 py-3 text-left hover:bg-emerald-500/20 border-b border-emerald-500/20 last:border-b-0 transition-all duration-200 text-emerald-100 hover:text-emerald-50"
              onClick={() => handleHistorySelect(historyItem)}
            >
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-emerald-300/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {historyItem}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 検索結果なし */}
      {showSuggestions && query.length > 0 && suggestions.length === 0 && (
        <div className="search-no-results absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 p-4">
          <div className="text-gray-400 text-center">
            該当する図番が見つかりません
          </div>
        </div>
      )}
    </div>
  )
} 