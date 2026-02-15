// src/app/admin/drawings/list/page.tsx - 図番一覧管理画面

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  loadSearchIndex,
  loadContributions,
  loadWorkInstruction,
} from '@/lib/dataLoader'
import { FormInput } from '@/components/admin/forms/FormInput'
import { FormButton } from '@/components/admin/forms/FormButton'
import { FormSelect } from '@/components/admin/forms/FormSelect'
import { LoadingSpinner } from '@/components/admin/feedback/LoadingSpinner'

interface DrawingWithContributions {
  drawingNumber: string
  title: string
  companyName: string
  productName: string
  category: string
  createdAt?: string
  contributionsCount: number
  latestContributionDate?: string
  mergedContributionsCount: number
  pendingContributionsCount: number
}

export default function DrawingsList() {
  const [allDrawings, setAllDrawings] = useState<DrawingWithContributions[]>([])
  const [filteredDrawings, setFilteredDrawings] = useState<DrawingWithContributions[]>([])
  const [loading, setLoading] = useState(false) // 初期状態はロード中ではない
  const [searching, setSearching] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [hasSearched, setHasSearched] = useState(false) // 検索実行済みフラグ
  const itemsPerPage = 50

  // 初回のデータ読み込み（会社リスト用のみ）
  useEffect(() => {
    const loadBasicData = async () => {
      try {
        setLoading(true)
        const searchIndex = await loadSearchIndex()
        const hasCreatedAt = searchIndex.drawings.some(d => d.createdAt)
        const sortedDrawings = hasCreatedAt
          ? [...searchIndex.drawings].sort((a, b) => {
              const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0
              const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0
              return bDate - aDate
            })
          : [...searchIndex.drawings].reverse()

        setAllDrawings(
          sortedDrawings.map(drawing => ({
            drawingNumber: drawing.drawingNumber,
            title: drawing.title,
            companyName: drawing.companyName,
            productName: drawing.productName,
            category: drawing.category,
            createdAt: drawing.createdAt,
            contributionsCount: 0,
            latestContributionDate: undefined,
            mergedContributionsCount: 0,
            pendingContributionsCount: 0,
          })),
        )
      } catch (error) {
        console.error('基本データ読み込みエラー:', error)
      } finally {
        setLoading(false)
      }
    }

    loadBasicData()
  }, [])

  // 検索実行関数
  const executeSearch = async () => {
    // 図番・製品名が空の場合でも、「全ての会社」での検索は許可
    if (!searchTerm.trim() && !companyFilter) {
      // 両方とも未指定の場合は全件検索として扱う
      // または条件を指定するよう促す
      const shouldProceed = confirm('検索条件が未指定です。全ての図番を表示しますか？')
      if (!shouldProceed) return
    }

    setSearching(true)
    try {
      // 検索条件に基づいてフィルタリング
      let filtered = allDrawings

      if (searchTerm) {
        filtered = filtered.filter(drawing =>
          drawing.drawingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          drawing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          drawing.productName.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      if (companyFilter) {
        filtered = filtered.filter(drawing => drawing.companyName === companyFilter)
      }

      // フィルタされた図番の追記情報を並列取得
      const drawingsWithContributions = await Promise.all(
        filtered.map(async (drawing) => {
          let contributionsCount = 0
          let latestContributionDate: string | undefined
          let mergedCount = 0
          let pendingCount = 0
          let createdAt = drawing.createdAt

          try {
            const contributionData = await loadContributions(drawing.drawingNumber)
            contributionsCount = contributionData.contributions.length

            const activeContributions = contributionData.contributions.filter(
              contribution => contribution.status === 'active',
            )

            if (activeContributions.length > 0) {
              const sortedContributions = activeContributions
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              
              latestContributionDate = sortedContributions[0].timestamp
              pendingCount = activeContributions.length
              mergedCount = 0
            }
          } catch (error) {
            console.warn(`追記データ取得エラー (${drawing.drawingNumber}):`, error)
          }

          if (!createdAt) {
            try {
              const instruction = await loadWorkInstruction(drawing.drawingNumber)
              createdAt = instruction?.metadata?.createdDate ?? createdAt
            } catch (error) {
              console.warn(`作業手順メタデータ取得エラー (${drawing.drawingNumber}):`, error)
            }
          }

          return {
            ...drawing,
            createdAt,
            contributionsCount,
            latestContributionDate,
            mergedContributionsCount: mergedCount,
            pendingContributionsCount: pendingCount
          }
        })
      )

      const hasCreatedAtKey = drawingsWithContributions.some(d => d.createdAt)

      const sortedResults = hasCreatedAtKey
        ? [...drawingsWithContributions].sort((a, b) => {
            const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : undefined
            const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : undefined

            const aDate = aCreated ?? 0
            const bDate = bCreated ?? 0

            if (aDate === bDate) {
              return b.drawingNumber.localeCompare(a.drawingNumber)
            }

            return bDate - aDate
          })
        : drawingsWithContributions

      setFilteredDrawings(sortedResults)
      setHasSearched(true)
      setCurrentPage(1)
    } catch (error) {
      console.error('検索エラー:', error)
      alert('検索中にエラーが発生しました')
    } finally {
      setSearching(false)
    }
  }

  // Enterキーで検索実行
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeSearch()
    }
  }

  // ページネーション
  const totalPages = Math.ceil(filteredDrawings.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentDrawings = filteredDrawings.slice(startIndex, startIndex + itemsPerPage)

  // ユニークな会社一覧
  const companies = Array.from(new Set(allDrawings.map(d => d.companyName)))

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('ja-JP')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="large" message="図番データを読み込んでいます..." />
      </div>
    )
  }

  // メインコンテンツのレンダリング
  const renderContent = () => {
    if (!hasSearched) {
      // 検索前の状態
      return (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="text-gray-500">
            <h3 className="text-lg font-medium text-gray-900 mb-3">検索条件を指定してください</h3>
            <p className="text-base text-gray-600">図番・製品名または会社を選択して検索ボタンを押してください。<br />Enterキーでも検索できます。</p>
          </div>
        </div>
      )
    }

    if (filteredDrawings.length === 0) {
      // 検索結果が0件の場合
      return (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="text-gray-500">
            <h3 className="text-lg font-medium text-gray-900 mb-3">検索結果が見つかりませんでした</h3>
            <p className="text-base text-gray-600">別の検索条件で再度お試しください。</p>
          </div>
        </div>
      )
    }

    // 検索結果がある場合のテーブル表示
    return (
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-white">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-white">
            <thead className="bg-gray-50 border-b-2 border-white">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700 uppercase tracking-wider border-r border-white">
                  図番
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700 uppercase tracking-wider border-r border-white">
                  会社・製品
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700 uppercase tracking-wider border-r border-white">
                  追記状況
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-white">
              {currentDrawings.map((drawing) => (
                <tr key={drawing.drawingNumber} className="hover:bg-gray-50 border-b border-white">
                  <td className="px-6 py-4 whitespace-nowrap border-r border-white">
                    <div className="text-sm font-medium text-gray-900">
                      {drawing.drawingNumber}
                    </div>
                    <div className="text-sm text-gray-500">
                      {drawing.title}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap border-r border-white">
                    <div className="text-sm text-gray-900">
                      {drawing.companyName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {drawing.category} - {drawing.productName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap border-r border-white">
                    <div className="text-sm text-gray-900">
                      {drawing.contributionsCount > 0 ? (
                        <div>
                          <span className="font-medium">{drawing.contributionsCount}件</span>
                          <div className="text-xs text-gray-500">
                            {drawing.pendingContributionsCount > 0 && (
                              <span className="text-orange-600">未処理{drawing.pendingContributionsCount}</span>
                            )}
                            {drawing.mergedContributionsCount > 0 && (
                              <span className="text-green-600 ml-1">併合済{drawing.mergedContributionsCount}</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">
                            最新: {formatDate(drawing.latestContributionDate)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">なし</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <Link
                      href={`/instruction/${drawing.drawingNumber}`}
                      className="custom-rect-button blue small"
                    >
                      <span>表示</span>
                    </Link>
                    <Link
                      href={`/admin/drawings/${drawing.drawingNumber}/edit`}
                      className="custom-rect-button purple small"
                    >
                      <span>編集</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <FormButton
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                variant="gray"
                size="small"
              >
                前へ
              </FormButton>
              <FormButton
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                variant="gray"
                size="small"
              >
                次へ
              </FormButton>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{startIndex + 1}</span>
                  {' - '}
                  <span className="font-medium">{Math.min(startIndex + itemsPerPage, filteredDrawings.length)}</span>
                  {' / '}
                  <span className="font-medium">{filteredDrawings.length}</span>
                  件を表示
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <FormButton
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    variant="gray"
                    size="small"
                  >
                    前へ
                  </FormButton>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        page === currentPage
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <FormButton
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    variant="gray"
                    size="small"
                  >
                    次へ
                  </FormButton>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ページタイトル */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">図番一覧管理</h1>
      </div>
      
      {/* 検索・フィルタエリア */}
      <div className="bg-white p-6 rounded-2xl shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <FormInput
                label="図番・製品名検索"
                name="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="図番または製品名を入力..."
                disabled={searching}
              />
            </div>
            <div>
              <FormSelect
                label="会社フィルタ"
                name="company"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                disabled={searching}
                options={[
                  { value: '', label: 'すべての会社' },
                  ...companies.map(company => ({
                    value: company,
                    label: company
                  }))
                ]}
              />
            </div>
            <div className="flex items-end">
              <FormButton
                onClick={executeSearch}
                disabled={searching}
                loading={searching}
                variant="blue"
                fullWidth
              >
                {searching ? '検索中...' : '🔍 検索実行'}
              </FormButton>
            </div>
            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                {hasSearched ? (
                  <>
                    {filteredDrawings.length}件 / 全{allDrawings.length}件
                  </>
                ) : (
                  <>
                    全{allDrawings.length}件（検索してください）
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

      {/* 図番一覧テーブル */}
      {renderContent()}
    </div>
  )
}
