'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { loadCompanies, Company, loadSearchIndex } from '@/lib/dataLoader'

interface DrawingsPageProps {
  params: Promise<{
    companyId: string
    category: string
  }>
}

export default function DrawingsPage({ params }: DrawingsPageProps) {
  const { companyId, category } = use(params)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [displayDrawingMap, setDisplayDrawingMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // 会社データと検索インデックスを並行読み込み
    Promise.all([loadCompanies(), loadSearchIndex()])
      .then(([companiesData, searchIndex]) => {
        // displayDrawingNumber マッピングを作成
        const drawingMap: Record<string, string> = {}
        for (const drawing of searchIndex.drawings) {
          if (drawing.displayDrawingNumber) {
            drawingMap[drawing.drawingNumber] = drawing.displayDrawingNumber
          }
        }
        setDisplayDrawingMap(drawingMap)

        // URLパラメータから会社とカテゴリを特定
        const company = companiesData.find(c => c.id === companyId)
        if (company) {
          setSelectedCompany(company)
          // カテゴリの存在確認
          const categories = company.products.reduce((acc, product) => {
            if (!acc.includes(product.category)) {
              acc.push(product.category)
            }
            return acc
          }, [] as string[])

          const decodedCategory = decodeURIComponent(category)
          if (categories.includes(decodedCategory)) {
            setSelectedCategory(decodedCategory)
          } else {
            setError('指定されたカテゴリが見つかりません')
          }
        } else {
          setError('指定された会社が見つかりません')
        }
        setLoading(false)
      })
      .catch(() => {
        setError('データの読み込みに失敗しました')
        setLoading(false)
      })
  }, [companyId, category])

  // カテゴリ一覧に戻る
  const handleBackToCategories = () => {
    router.push(`/category/${companyId}`)
  }

  // 会社一覧に戻る
  const handleBackToCompanies = () => {
    router.push('/')
  }

  // 図番選択時の処理
  const handleDrawingSelect = (drawingNumber: string) => {
    router.push(`/instruction/${encodeURIComponent(drawingNumber)}`)
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
            <div className="flex gap-4">
              <button
                onClick={handleBackToCategories}
                className="custom-rect-button gray"
              >
                <span>←</span>
                <span>カテゴリ一覧に戻る</span>
              </button>
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
      </div>
    )
  }

  if (!selectedCompany || !selectedCategory) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-screen">
            <div className="text-center text-red-400 py-20">データが見つかりません</div>
            <div className="flex gap-4">
              <button
                onClick={handleBackToCategories}
                className="custom-rect-button gray"
              >
                <span>←</span>
                <span>カテゴリ一覧に戻る</span>
              </button>
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
      </div>
    )
  }

  // 選択されたカテゴリの製品をフィルタリング
  const categoryProducts = selectedCompany.products.filter(
    product => product.category === selectedCategory
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-screen">
          {/* 戻るボタン */}
          <button
            onClick={handleBackToCategories}
            className="custom-rect-button gray mb-6"
          >
            <span>←</span>
            <span>{selectedCompany.name} のカテゴリ一覧に戻る</span>
          </button>

          {/* タイトル */}
          <h2 className="text-2xl font-bold mb-8 text-center text-emerald-100">
            {selectedCategory} の図番を選択
          </h2>

          {/* 図番一覧 */}
          <div className="selection-grid w-full">
            {categoryProducts.map((product) =>
              product.drawings.map((drawingNumber) => (
                <button
                  key={drawingNumber}
                  className="selection-card"
                  onClick={() => handleDrawingSelect(drawingNumber)}
                >
                  <div className="icon">📄</div>
                  <div className="title">{displayDrawingMap[drawingNumber] || drawingNumber}</div>
                  <div className="desc">{product.name}</div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 