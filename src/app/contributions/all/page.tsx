// src/app/contributions/all/page.tsx - 全追記一覧ページ（閲覧用）

'use client'

import { useState, useEffect } from 'react'
import { loadRecentContributions } from '@/lib/dataLoader'
import { ContributionData } from '@/types/contribution'
import { ImageLightbox } from '@/components/ImageLightbox'
import Link from 'next/link'

interface ContributionWithDrawing {
  drawingNumber: string
  displayDrawingNumber?: string
  drawingTitle?: string
  contribution: ContributionData
}

export default function AllContributionsPage() {
  const [contributions, setContributions] = useState<ContributionWithDrawing[]>([])
  const [loading, setLoading] = useState(true)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentImages, setCurrentImages] = useState<string[]>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useEffect(() => {
    const loadData = async () => {
      try {
        // 全追記情報を読み込み（limit=1000で実質全件取得）
        const allContributions = await loadRecentContributions(1000)
        
        // activeな追記のみをフィルタリング（loadRecentContributionsは既に新しい順にソートされている）
        const activeContributions = allContributions.filter(
          item => item.contribution.status === 'active'
        )

        setContributions(activeContributions)
      } catch (error) {
        console.error('データ読み込みエラー:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const openLightbox = (images: string[], index: number) => {
    setCurrentImages(images)
    setCurrentImageIndex(index)
    setLightboxOpen(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ページタイトル */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white text-center mb-2">全ての追記</h1>
          <p className="text-center text-gray-400">
            すべての図番に投稿された追記情報を時系列で表示しています
          </p>
          <div className="text-center mt-4">
            <Link href="/" className="custom-rect-button gray">
              <span>トップページに戻る</span>
            </Link>
          </div>
        </div>

        {/* 追記一覧 */}
        {contributions.length > 0 ? (
          <div className="space-y-6">
            {contributions.map((item, index) => (
              <div key={index} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                {/* ヘッダー部分 */}
                <div className="flex flex-wrap items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <Link
                      href={`/instruction/${item.drawingNumber}`}
                      className="text-lg font-semibold text-blue-400 hover:text-blue-300"
                    >
                      図番: {item.displayDrawingNumber || item.drawingNumber}
                    </Link>
                    {item.drawingTitle && (
                      <span className="text-gray-400">- {item.drawingTitle}</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-3 text-sm">
                    <span className="text-gray-400">
                      {new Date(item.contribution.timestamp).toLocaleString('ja-JP')}
                    </span>
                    <span className="text-gray-300">
                      by {item.contribution.userName}
                    </span>
                  </div>
                </div>

                {/* 対象セクション */}
                <div className="mb-3">
                  <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-gray-700 text-gray-300">
                    対象: {item.contribution.targetSection === 'overview' ? '概要' : 
                           item.contribution.targetSection === 'step' ? `ステップ ${item.contribution.stepNumber}` : 
                           '全般'}
                  </span>
                </div>

                {/* テキスト内容 */}
                {item.contribution.content.text && (
                  <div className="text-gray-300 mb-4 whitespace-pre-wrap">
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
                              className="bg-black/30 rounded overflow-hidden border border-emerald-500/20 shadow aspect-square flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
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
                              <img
                                src={`/api/files?drawingNumber=${item.drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`}
                                alt={`追記画像 ${fileIndex + 1}`}
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
                          <div key={`vid-${fileIndex}`} className="bg-black/30 rounded-lg p-3 border border-emerald-500/20">
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
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">追記情報はありません</p>
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