'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { loadCompanies, Company } from '@/lib/dataLoader'

interface CategoryPageProps {
  params: Promise<{
    companyId: string
  }>
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const { companyId } = use(params)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // 会社データを読み込み
    loadCompanies()
      .then((companiesData) => {
        // URLパラメータから会社を特定
        const company = companiesData.find(c => c.id === companyId)
        if (company) {
          setSelectedCompany(company)
        } else {
          setError('指定された会社が見つかりません')
        }
        setLoading(false)
      })
      .catch(() => {
        setError('データの読み込みに失敗しました')
        setLoading(false)
      })
  }, [companyId])

  // 会社一覧に戻る
  const handleBackToCompanies = () => {
    router.push('/')
  }

  // カテゴリ選択時の処理
  const handleCategorySelect = (category: string) => {
    router.push(`/drawings/${companyId}/${encodeURIComponent(category)}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-screen">
            <div className="text-center text-lg text-emerald-200 py-20">読み込み中...</div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-screen">
            <div className="text-center text-red-400 py-20">{error}</div>
            <button
              onClick={handleBackToCompanies}
              className="custom-rect-button gray"
            >
              <span>←</span>
              <span>会社一覧に戻る</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!selectedCompany) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-screen">
            <div className="text-center text-red-400 py-20">会社が見つかりません</div>
            <button
              onClick={handleBackToCompanies}
              className="custom-rect-button gray"
            >
              <span>←</span>
              <span>会社一覧に戻る</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 重複チェックしてユニークなカテゴリを抽出
  const categories = selectedCompany.products.reduce((acc, product) => {
    if (!acc.includes(product.category)) {
      acc.push(product.category)
    }
    return acc
  }, [] as string[])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-screen">
          {/* 戻るボタン */}
          <button
            onClick={handleBackToCompanies}
            className="custom-rect-button gray mb-6"
          >
            <span>←</span>
            <span>会社一覧に戻る</span>
          </button>

          {/* タイトル */}
          <h2 className="text-2xl font-bold mb-8 text-center text-emerald-100">
            {selectedCompany.name} のカテゴリを選択
          </h2>

          {/* カテゴリ一覧 */}
          <div className="selection-grid w-full">
            {categories.map((category) => (
              <button
                key={category}
                className="selection-card"
                onClick={() => handleCategorySelect(category)}
              >
                <div className="icon">📂</div>
                <div className="title">{category}</div>
                <div className="desc">カテゴリ</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 