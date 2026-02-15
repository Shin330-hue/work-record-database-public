// src/app/page.tsx - 会社選択画面と検索機能のみ
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadCompanies, loadSearchIndex, Company, SearchIndex, DrawingSearchItem } from '@/lib/dataLoader'
import SearchBar from '@/components/SearchBar'
import RecentContributions from '@/components/RecentContributions'
import Header from '@/components/Header'

export default function Home() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [searchIndex, setSearchIndex] = useState<SearchIndex | null>(null)
  const [searchResults, setSearchResults] = useState<DrawingSearchItem[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // 会社データと検索インデックスを並行して読み込み
    Promise.all([
      loadCompanies(),
      loadSearchIndex()
    ])
      .then(([companiesData, searchIndexData]) => {
        setCompanies(companiesData)
        setSearchIndex(searchIndexData)
        setLoading(false)
      })
      .catch(() => {
        setError('データの読み込みに失敗しました')
        setLoading(false)
      })
  }, [])

  // 検索結果の処理
  const handleSearch = (results: DrawingSearchItem[]) => {
    setSearchResults(results)
    setShowSearchResults(results.length > 0)
  }

  // 検索結果から図番選択
  const handleSearchDrawingSelect = (drawingNumber: string) => {
    router.push(`/instruction/${encodeURIComponent(drawingNumber)}`)
  }

  // 会社選択時の処理
  const handleCompanySelect = (company: Company) => {
    router.push(`/category/${company.id}`)
  }

  // 追記から図番へ遷移
  const handleContributionDrawingClick = (drawingNumber: string) => {
    router.push(`/instruction/${encodeURIComponent(drawingNumber)}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Header />
      <div className="container mx-auto px-4">
        <div className="custom-top-spacing space-y-8">

          {/* 検索結果表示 */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="w-full max-w-[800px] mx-auto">
              <h2 className="text-xl font-semibold mb-6 text-emerald-100">検索結果</h2>
              <div className="selection-grid">
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    className="selection-card !items-start !text-left"
                    onClick={() => handleSearchDrawingSelect(result.drawingNumber)}
                  >
                    <div className="icon" style={{fontSize:'1.6rem',marginBottom:8}}>🔍</div>
                    <div className="title" style={{fontSize:'1.1rem'}}>{result.displayDrawingNumber || result.drawingNumber}</div>
                    <div className="desc" style={{marginBottom:4}}>{result.title}</div>
                    <div className="desc" style={{fontSize:'0.95rem',color:'#8ff'}}>{result.companyName} - {result.productName}</div>
                    <div className="desc" style={{fontSize:'0.92rem',color:'#bff'}}>{result.estimatedTime}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 町工場GPTボタン */}
          <div className="w-full max-w-[800px] mx-auto mb-8">
            <button
              onClick={() => router.push('/chat')}
              className="custom-rect-button purple w-full flex items-center justify-center gap-3"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}
            >
              <span style={{ fontSize: '1.5rem' }}>🤖</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>町工場GPT</span>
              <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>- ちょっと一息つきませんか？</span>
            </button>
          </div>

          {/* 会社選択セクション */}
          <div className="w-full max-w-[800px] mx-auto">
            {/* タイトルと検索バーの並び */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-6 mb-8">
              <h2 className="text-2xl font-bold text-emerald-100 lg:flex-shrink-0">会社を選択してください</h2>
              
              {/* 検索バー */}
              {searchIndex && (
                <div className="search-bar-container custom-search-width">
                  <SearchBar
                    searchIndex={searchIndex}
                    onSearch={handleSearch}
                    onDrawingSelect={handleSearchDrawingSelect}
                    placeholder="図番を入力してください（例: ABC-001）"
                  />
                </div>
              )}
            </div>
            
            {loading && (
              <div className="text-center text-lg text-emerald-200 py-20">読み込み中...</div>
            )}
            
            {error && (
              <div className="text-center text-red-400 py-20">{error}</div>
            )}
            
            {!loading && !error && (
              <div className="selection-grid w-full">
                {companies.map((company) => (
                  <button
                    key={company.id}
                    className="selection-card"
                    onClick={() => handleCompanySelect(company)}
                  >
                    <div className="icon">🏢</div>
                    <div className="title">{company.name}</div>
                    <div className="desc">{company.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 最新追記セクション */}
          {!showSearchResults && (
            <div className="w-full max-w-[800px] mx-auto mt-8">
              <RecentContributions onDrawingClick={handleContributionDrawingClick} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}