// src/app/admin/contributions/page.tsx - 追記管理ページ

'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAuthHeaders } from '@/lib/auth/client'
import { loadAllContributions } from '@/lib/dataLoader'
import { ContributionData } from '@/types/contribution'
import { ImageLightbox } from '@/components/ImageLightbox'
import Link from 'next/link'
import Image from 'next/image'
import { LoadingSpinner } from '@/components/admin/feedback'

interface ContributionWithDrawing {
  drawingNumber: string
  drawingTitle?: string
  contribution: ContributionData
}

export default function ContributionsManagementPage() {
  const [contributions, setContributions] = useState<ContributionWithDrawing[]>([])
  const [filteredContributions, setFilteredContributions] = useState<ContributionWithDrawing[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'merged'>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentImages, setCurrentImages] = useState<string[]>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

const loadData = useCallback(async () => {
  try {
    // 全追記情報を読み込み（limit=1000で実質全件取得）
    const allContributions = await loadAllContributions(1000)
    setContributions(allContributions)
  } catch (error) {
    console.error('データ読み込みエラー:', error)
  } finally {
    setLoading(false)
  }
}, [])

useEffect(() => {
  loadData()
}, [loadData])

const filterContributions = useCallback(() => {
  let filtered = [...contributions]

  // ステータスフィルタ
  if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.contribution.status === statusFilter)
    }

    // 検索フィルタ
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(item => 
        item.drawingNumber.toLowerCase().includes(query) ||
        (item.drawingTitle && item.drawingTitle.toLowerCase().includes(query)) ||
        item.contribution.userName.toLowerCase().includes(query) ||
        (item.contribution.content.text && item.contribution.content.text.toLowerCase().includes(query))
      )
    }

  setFilteredContributions(filtered)
}, [contributions, statusFilter, searchQuery])

useEffect(() => {
  filterContributions()
}, [filterContributions])

  const handleStatusChange = async (index: number, newStatus: 'active' | 'merged') => {
    const targetContribution = filteredContributions[index]
    
    try {
      const response = await fetch(`/api/admin/contributions/${targetContribution.drawingNumber}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'updateStatus',
          contributionId: targetContribution.contribution.id,
          status: newStatus
        })
      })

      if (response.ok) {
        // ローカル状態を更新
        const updatedContributions = contributions.map(item => {
          if (item.contribution.id === targetContribution.contribution.id) {
            return {
              ...item,
              contribution: {
                ...item.contribution,
                status: newStatus
              }
            }
          }
          return item
        })
        setContributions(updatedContributions)
        alert(`ステータスを${newStatus === 'active' ? 'activeに戻しました' : 'mergedに変更しました'}`)
      } else {
        throw new Error('ステータス更新に失敗しました')
      }
    } catch (error) {
      console.error('ステータス更新エラー:', error)
      alert('ステータス更新に失敗しました')
    }
  }

  const handleDelete = async (index: number) => {
    const targetContribution = filteredContributions[index]
    
    if (!confirm('この追記を完全に削除しますか？この操作は取り消せません。')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/contributions/${targetContribution.drawingNumber}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'delete',
          contributionId: targetContribution.contribution.id
        })
      })

      if (response.ok) {
        // ローカル状態を更新
        const updatedContributions = contributions.filter(
          item => item.contribution.id !== targetContribution.contribution.id
        )
        setContributions(updatedContributions)
        alert('追記を削除しました')
      } else {
        throw new Error('削除に失敗しました')
      }
    } catch (error) {
      console.error('削除エラー:', error)
      alert('削除処理に失敗しました')
    }
  }

  const openLightbox = (images: string[], index: number) => {
    setCurrentImages(images)
    setCurrentImageIndex(index)
    setLightboxOpen(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="large" message="データを読み込んでいます..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ページヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">追記管理</h1>
            <Link href="/admin" className="custom-rect-button gray">
              <span>管理画面に戻る</span>
            </Link>
          </div>
          <p className="text-gray-600">
            すべての追記情報の管理・ステータス変更・削除を行えます
          </p>
        </div>

        {/* フィルタリングコントロール */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ステータスフィルタ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ステータスフィルタ
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'merged')}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">すべて</option>
                <option value="active">Active</option>
                <option value="merged">Merged</option>
              </select>
            </div>

            {/* 検索フィールド */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                検索（図番・タイトル・投稿者・内容）
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="検索キーワードを入力..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* 統計情報 */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600">総件数</p>
                <p className="text-2xl font-bold text-gray-900">{contributions.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {contributions.filter(c => c.contribution.status === 'active').length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Merged</p>
                <p className="text-2xl font-bold text-blue-600">
                  {contributions.filter(c => c.contribution.status === 'merged').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 追記一覧 */}
        {filteredContributions.length > 0 ? (
          <div className="space-y-4">
            {filteredContributions.map((item, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                {/* ヘッダー部分 */}
                <div className="flex flex-wrap items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <Link 
                      href={`/admin/drawings/${item.drawingNumber}/edit`}
                      className="text-lg font-semibold text-blue-600 hover:text-blue-800"
                    >
                      図番: {item.drawingNumber}
                    </Link>
                    {item.drawingTitle && (
                      <span className="text-gray-600">- {item.drawingTitle}</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-3 text-sm">
                    <span className="text-gray-500">
                      {new Date(item.contribution.timestamp).toLocaleString('ja-JP')}
                    </span>
                    <span className="text-gray-700">
                      by {item.contribution.userName}
                    </span>
                  </div>
                </div>

                {/* ステータスと対象セクション */}
                <div className="mb-3 flex items-center space-x-3">
                  <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                    item.contribution.status === 'merged' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {item.contribution.status === 'merged' ? 'Merged' : 'Active'}
                  </span>
                  <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                    対象: {item.contribution.targetSection === 'overview' ? '概要' : 
                           item.contribution.targetSection === 'step' ? `ステップ ${item.contribution.stepNumber}` : 
                           '全般'}
                  </span>
                </div>

                {/* テキスト内容 */}
                {item.contribution.content.text && (
                  <div className="text-gray-700 mb-4 whitespace-pre-wrap">
                    {item.contribution.content.text}
                  </div>
                )}

                {/* 添付ファイル */}
                {item.contribution.content.files && item.contribution.content.files.length > 0 && (
                  <div className="mt-4">
                    {/* 画像ファイル */}
                    {item.contribution.content.files.filter(f => f.fileType === 'image').length > 0 && (
                      <div className="mb-3">
                        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                          {item.contribution.content.files.filter(f => f.fileType === 'image').map((file, fileIndex) => (
                            <div
                              key={`img-${fileIndex}`}
                              className="bg-gray-100 rounded overflow-hidden border border-gray-300 shadow aspect-square flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
                              onClick={() => {
                                const imageUrls = item.contribution.content.files!
                                  .filter(f => f.fileType === 'image')
                                  .map(f => `/api/files?drawingNumber=${item.drawingNumber}&contributionFile=${encodeURIComponent(f.filePath)}`)
                                const clickedIndex = item.contribution.content.files!
                                  .filter(f => f.fileType === 'image')
                                  .findIndex(f => f.filePath === file.filePath)
                                openLightbox(imageUrls, clickedIndex)
                              }}
                            >
                              <Image
                                src={`/api/files?drawingNumber=${item.drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`}
                                alt={`追記画像 ${fileIndex + 1}`}
                                width={200}
                                height={200}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 動画ファイル */}
                    {item.contribution.content.files.filter(f => f.fileType === 'video').length > 0 && (
                      <div className="space-y-3">
                        {item.contribution.content.files.filter(f => f.fileType === 'video').map((file, fileIndex) => (
                          <div key={`vid-${fileIndex}`} className="bg-gray-100 rounded-lg p-3 border border-gray-300">
                            <video
                              controls
                              className="w-full max-w-md rounded"
                              src={`/api/files?drawingNumber=${item.drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`}
                            >
                              お使いのブラウザは動画タグをサポートしていません。
                            </video>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* アクションボタン */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end space-x-3">
                  {item.contribution.status === 'active' ? (
                    <button
                      onClick={() => handleStatusChange(index, 'merged')}
                      className="custom-rect-button blue small"
                    >
                      <span>Mergedにする</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusChange(index, 'active')}
                      className="custom-rect-button emerald small"
                    >
                      <span>Activeに戻す</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(index)}
                    className="custom-rect-button red small"
                  >
                    <span>削除</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg shadow-md">
            <p className="text-gray-500 text-lg">
              {searchQuery || statusFilter !== 'all' 
                ? '条件に一致する追記情報はありません' 
                : '追記情報はありません'}
            </p>
          </div>
        )}
      </div>

      {/* 画像ライトボックス */}
      <ImageLightbox
        images={currentImages}
        isOpen={lightboxOpen}
        currentIndex={currentImageIndex}
        onClose={() => setLightboxOpen(false)}
        altText="追記画像"
      />
    </div>
  )
}
