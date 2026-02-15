// src/app/admin/page.tsx - 管理ダッシュボード

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  loadSearchIndex,
  loadCompanies,
  loadAllContributions,
} from '@/lib/dataLoader'
import type { ContributionData } from '@/types/contribution'
import { LoadingSpinner } from '@/components/admin/feedback'

const numberFormatter = new Intl.NumberFormat('ja-JP')

type ContributionWithDrawing = {
  drawingNumber: string
  contribution: ContributionData
  drawingTitle?: string
}

type QuickLinkAction = {
  label: string
  href: string
  variant: 'primary' | 'secondary'
}

type QuickLink = {
  title: string
  description: string
  icon: string
  actions: QuickLinkAction[]
}

const contributionTypeMeta: Record<
  ContributionData['type'],
  { label: string; icon: string }
> = {
  comment: { label: 'コメント', icon: '💬' },
  image: { label: '画像追加', icon: '🖼️' },
  video: { label: '動画追加', icon: '📹' },
  nearmiss: { label: 'ヒヤリハット', icon: '⚠️' },
  troubleshoot: { label: 'トラブル対応', icon: '🛠️' },
}

function getActionClasses(variant: QuickLinkAction['variant']) {
  if (variant === 'primary') {
    return 'custom-rect-button blue small w-full sm:w-auto'
  }
  return 'custom-rect-button gray small w-full sm:w-auto'
}

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState({
    totalDrawings: 0,
    totalCompanies: 0,
    activeContributions: 0,
  })
  const [recentContributions, setRecentContributions] = useState<
    ContributionWithDrawing[]
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [searchIndex, companies, contributions] = await Promise.all([
          loadSearchIndex(),
          loadCompanies(),
          loadAllContributions(Number.MAX_SAFE_INTEGER),
        ])

        const activeContributions = contributions.filter(
          item => item.contribution.status === 'active',
        )

        setStats({
          totalDrawings: searchIndex.drawings.length,
          totalCompanies: companies.length,
          activeContributions: activeContributions.length,
        })

        setRecentContributions(contributions.slice(0, 5))
      } catch (error) {
        console.error('ダッシュボードデータの取得に失敗しました:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const statCards = useMemo(
    () => [
      { label: '登録図番', value: stats.totalDrawings, icon: '📘', theme: 'blue' },
      { label: '登録企業', value: stats.totalCompanies, icon: '🏭', theme: 'emerald' },
      {
        label: '未処理追記',
        value: stats.activeContributions,
        icon: '🕒',
        theme: 'purple',
      },
    ],
    [stats],
  )

  const quickLinks = useMemo<QuickLink[]>(
    () => [
      {
        title: '図番管理',
        description: '新規登録や一覧・編集など、図番に関する操作はこちらから。',
        icon: '🗂️',
        actions: [
          { label: '新規図番登録', href: '/admin/drawings/new', variant: 'primary' },
          { label: '図番一覧・編集', href: '/admin/drawings/list', variant: 'secondary' },
        ],
      },
      {
        title: '追記管理',
        description: '現場からの改善提案やコメントを確認し、ステータスを更新します。',
        icon: '📝',
        actions: [{ label: '追記管理ページへ', href: '/admin/contributions', variant: 'primary' }],
      },
      {
        title: '監査ログ',
        description: '図番更新やファイル操作など、重要操作の履歴を確認できます。',
        icon: '🔍',
        actions: [{ label: '監査ログを見る', href: '/admin/audit-log', variant: 'primary' }],
      },
    ],
    [],
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <LoadingSpinner size="large" message="データを読み込み中です…" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="dashboard-hero">
        <p className="dashboard-hero-eyebrow">Work Record Database</p>
        <h1 className="dashboard-hero-title">管理ダッシュボード</h1>
        <p className="dashboard-hero-subtitle">
          図番・追記・ファイルなどの登録状況をひと目で把握できます。
        </p>
      </header>

      <section aria-label="統計" className="mb-12 flex flex-wrap gap-4">
        {statCards.map(card => (
          <div key={card.label} className={`dashboard-stat-card ${card.theme}`}>
            <span className="dashboard-stat-icon" aria-hidden>
              {card.icon}
            </span>
            <div>
              <p className="dashboard-stat-label">{card.label}</p>
              <p className="dashboard-stat-value">
                {numberFormatter.format(card.value)}
              </p>
            </div>
          </div>
        ))}
      </section>

      <section aria-labelledby="quick-links-heading" className="space-y-4">
        <div className="dashboard-section-header" id="quick-links-heading">
          <h2 className="dashboard-section-title">管理メニュー</h2>
          <p className="dashboard-section-subtitle">
            よく利用するメニューへ素早くアクセスできます。
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {quickLinks.map(link => (
            <article key={link.title} className="dashboard-link-card">
              <div className="flex flex-col gap-4">
                <span className="dashboard-link-icon" aria-hidden>
                  {link.icon}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{link.title}</h3>
                  <p className="mt-2 text-sm text-gray-600">{link.description}</p>
                </div>
              </div>

              <div className="dashboard-button-row">
                {link.actions.map(action => (
                  <a key={action.href} href={action.href} className={getActionClasses(action.variant)}>
                    {action.label}
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="recent-contributions-heading" className="mt-12 space-y-4">
        <div className="dashboard-section-header" id="recent-contributions-heading">
          <h2 className="dashboard-section-title">最新の追記</h2>
          <p className="dashboard-section-subtitle">
            現場から届いたナレッジの一部をピックアップしています。
          </p>
        </div>

        {recentContributions.length === 0 ? (
          <div className="dashboard-no-data">現在表示できる追記はありません。</div>
        ) : (
          <div className="dashboard-recent-list">
            {recentContributions.map(item => {
              const meta = contributionTypeMeta[item.contribution.type] ?? {
                label: '投稿',
                icon: '📝',
              }

              return (
                <button
                  key={item.contribution.id}
                  type="button"
                  className="dashboard-recent-card"
                  onClick={() => router.push(`/admin/drawings/${item.drawingNumber}/edit`)}
                >
                  <div className="dashboard-recent-header">
                    <div className="flex items-start gap-3">
                      <span className="dashboard-tag">
                        <span aria-hidden>{meta.icon}</span>
                        {meta.label}
                      </span>
                      <div>
                        <div className="dashboard-recent-drawing">{item.drawingNumber}</div>
                        {item.drawingTitle && (
                          <div className="dashboard-recent-title">{item.drawingTitle}</div>
                        )}
                      </div>
                    </div>
                    <div className="dashboard-recent-meta">
                      <span>{new Date(item.contribution.timestamp).toLocaleString('ja-JP')}</span>
                      <span>by {item.contribution.userName}</span>
                    </div>
                  </div>

                  {item.contribution.content?.text && (
                    <p className="dashboard-recent-text line-clamp-2">
                      {item.contribution.content.text}
                    </p>
                  )}

                  {item.contribution.targetSection === 'step' &&
                    item.contribution.stepNumber !== undefined && (
                      <div className="text-xs text-gray-500">
                        対象ステップ: {item.contribution.stepNumber}
                      </div>
                    )}
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
