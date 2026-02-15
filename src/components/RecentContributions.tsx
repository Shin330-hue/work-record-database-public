'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { loadRecentContributions } from '@/lib/dataLoader'
import { ContributionData } from '@/types/contribution'

interface RecentContributionItem {
  drawingNumber: string
  displayDrawingNumber?: string
  contribution: ContributionData
  drawingTitle?: string
}

interface RecentContributionsProps {
  onDrawingClick: (drawingNumber: string) => void
}

export default function RecentContributions({ onDrawingClick }: RecentContributionsProps) {
  const [recentContributions, setRecentContributions] = useState<RecentContributionItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRecentContributions(5)
      .then(data => {
        setRecentContributions(data)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  const formatDate = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) {
      return 'たった今'
    } else if (diffInHours < 24) {
      return `${diffInHours}時間前`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
      return `${diffInDays}日前`
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'comment': return '💬'
      case 'image': return '📷'
      case 'video': return '🎥'
      case 'nearmiss': return '⚠️'
      case 'troubleshoot': return '🔧'
      default: return '📝'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'comment': return 'コメント'
      case 'image': return '画像追加'
      case 'video': return '動画追加'
      case 'nearmiss': return 'ヒヤリハット'
      case 'troubleshoot': return 'トラブル対策'
      default: return '追記'
    }
  }

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-emerald-500/20">
        <h2 className="text-xl font-bold text-emerald-100 mb-4">📋 最新の追記</h2>
        <p className="text-emerald-200/70">読み込み中...</p>
      </div>
    )
  }

  if (recentContributions.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-emerald-500/20">
        <h2 className="text-xl font-bold text-emerald-100 mb-4">📋 最新の追記</h2>
        <p className="text-emerald-200/70">まだ追記がありません</p>
      </div>
    )
  }

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-emerald-500/20">
      <h2 className="text-xl font-bold text-emerald-100 mb-4 flex items-center gap-2">
        📋 最新の追記 
        <span className="text-sm font-normal text-emerald-200/70">({recentContributions.length}件)</span>
      </h2>
      
      <div className="space-y-3">
        {recentContributions.map((item) => (
          <div 
            key={`${item.drawingNumber}-${item.contribution.id}`}
            className="bg-black/40 rounded-xl p-4 border border-emerald-500/30 hover:bg-black/50 transition-colors cursor-pointer"
            onClick={() => onDrawingClick(item.drawingNumber)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getTypeIcon(item.contribution.type)}</span>
                <div>
                  <div className="text-emerald-300 font-mono text-sm">
                    {item.displayDrawingNumber || item.drawingNumber}
                  </div>
                  {item.drawingTitle && (
                    <div className="text-emerald-200/80 text-xs">
                      {item.drawingTitle}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-emerald-400 font-medium">
                  {getTypeLabel(item.contribution.type)}
                </div>
                <div className="text-xs text-emerald-200/60">
                  {formatDate(item.contribution.timestamp)}
                </div>
              </div>
            </div>

            <div className="text-emerald-100 text-sm mb-1">
              by {item.contribution.userName}
            </div>

            {item.contribution.content.text && (
              <div className="text-emerald-200/80 text-sm line-clamp-2">
                {item.contribution.content.text}
              </div>
            )}

            {item.contribution.targetSection === 'step' && item.contribution.stepNumber && (
              <div className="text-emerald-300/60 text-xs mt-1">
                ステップ {item.contribution.stepNumber} への追記
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 text-center">
        <Link href="/contributions/all" className="custom-rect-button blue">
          <span>全ての追記を見る</span>
          <span>→</span>
        </Link>
      </div>
    </div>
  )
}