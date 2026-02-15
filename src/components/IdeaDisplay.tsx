import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Idea } from '@/types/idea';

interface IdeaDisplayProps {
  idea: Idea;
}

export default function IdeaDisplay({ idea }: IdeaDisplayProps) {
  const [ideaFiles, setIdeaFiles] = useState<{ images: string[], videos: string[] }>({ images: [], videos: [] })
  const [isLoading, setIsLoading] = useState(true)

  // アイデアのファイル一覧を取得する関数
  const getIdeaFiles = async (category: string, ideaId: string, folderType: 'images' | 'videos') => {
    try {
      const params = new URLSearchParams({
        ideaCategory: category,
        ideaId: ideaId,
        folderType: folderType
      })
      const response = await fetch(`/api/files?${params}`)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const data = await response.json()
      return data.files || []
    } catch (error) {
      console.error(`Error loading ${folderType} files for idea ${ideaId}:`, error)
      return []
    }
  }

  // アイデアファイルの初期化
  useEffect(() => {
    const loadIdeaFiles = async () => {
      try {
        setIsLoading(true)
        const [images, videos] = await Promise.all([
          getIdeaFiles(idea.category, idea.id, 'images'),
          getIdeaFiles(idea.category, idea.id, 'videos')
        ])
        setIdeaFiles({ images, videos })
      } catch (error) {
        console.error('Error loading idea files:', error)
        setIdeaFiles({ images: [], videos: [] })
      } finally {
        setIsLoading(false)
      }
    }
    loadIdeaFiles()
  }, [idea.category, idea.id])

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '初級';
      case 'intermediate': return '中級';
      case 'advanced': return '上級';
      default: return difficulty;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'intermediate': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'advanced': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-emerald-500/20 mb-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-emerald-100 mb-2">{idea.title}</h3>
          <p className="text-emerald-200/80 text-sm mb-2">{idea.description}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getDifficultyColor(idea.difficulty)}`}>
          {getDifficultyText(idea.difficulty)}
        </div>
      </div>

      {/* カテゴリとタグ */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded text-xs">
          {idea.category}
        </span>
        {idea.tags.map((tag, index) => (
          <span key={index} className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
            {tag}
          </span>
        ))}
      </div>

      {/* 適用材料 */}
      {idea.applicableMaterials.length > 0 && (
        <div className="mb-4">
          <span className="text-emerald-200/80 text-sm">適用材料: </span>
          <span className="text-white text-sm">{idea.applicableMaterials.join(', ')}</span>
        </div>
      )}

      {/* 重要なポイント */}
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-emerald-300 mb-2">重要なポイント</h4>
        <ul className="space-y-2">
          {idea.keyPoints.map((point, index) => (
            <li key={index} className="flex gap-3">
              <span className="w-5 h-5 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
                {index + 1}
              </span>
              <span className="text-gray-200 text-sm">{point}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 詳細内容 */}
      <div className="mb-4">
        <p className="text-white text-sm leading-relaxed">{idea.content}</p>
      </div>

      {/* 画像 */}
      {!isLoading && ideaFiles.images.length > 0 && (
        <div className="mb-4">
          <h4 className="text-lg font-semibold text-emerald-300 mb-3">関連画像</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {ideaFiles.images.map((image, index) => (
              <div key={index} className="bg-black/30 rounded-xl overflow-hidden border border-emerald-500/20 shadow-lg aspect-video flex items-center justify-center">
                <Image
                  src={`/api/files?ideaCategory=${idea.category}&ideaId=${idea.id}&folderType=images&fileName=${encodeURIComponent(image)}`}
                  alt={`${idea.title} - ${image}`}
                  width={300}
                  height={200}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 動画 */}
      {!isLoading && ideaFiles.videos.length > 0 && (
        <div className="mb-4">
          <h4 className="text-lg font-semibold text-emerald-300 mb-3">関連動画</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {ideaFiles.videos.map((video, index) => (
              <div key={index} className="bg-black/30 rounded-xl overflow-hidden border border-emerald-500/20 shadow-lg aspect-video flex items-center justify-center">
                <video controls className="w-full h-full object-cover">
                  <source src={`/api/files?ideaCategory=${idea.category}&ideaId=${idea.id}&folderType=videos&fileName=${encodeURIComponent(video)}`} type="video/mp4" />
                </video>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ローディング状態 */}
      {isLoading && (
        <div className="mb-4">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
            <span className="ml-3 text-emerald-200">ファイルを読み込み中...</span>
          </div>
        </div>
      )}
    </div>
  );
} 