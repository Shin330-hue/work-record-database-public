'use client'

import { useMemo, useState } from 'react'
import type { AuditLogEntry } from '@/lib/auditLogReader'

const ACTION_LABELS: Record<string, string> = {
  'drawing.create': '図番新規登録',
  'drawing.update': '図番更新',
  'drawing.files.upload': 'ファイルアップロード',
  'drawing.files.delete': 'ファイル削除',
  'contribution.updateStatus': '追記ステータス更新',
  'contribution.delete': '追記削除',
}

interface AuditLogViewerProps {
  logs: AuditLogEntry[]
}

export function AuditLogViewer({ logs }: AuditLogViewerProps) {
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const invalidRange = startDate && endDate && startDate > endDate

  const availableActions = useMemo(() => {
    const unique = new Set(logs.map(entry => entry.action))
    return Array.from(unique).sort()
  }, [logs])

  const filteredLogs = useMemo(() => {
    if (invalidRange) {
      return []
    }

    const lowerSearch = searchQuery.trim().toLowerCase()
    const startMs = startDate ? Date.parse(`${startDate}T00:00:00Z`) : undefined
    const endMs = endDate ? Date.parse(`${endDate}T23:59:59.999Z`) : undefined

    return logs.filter(entry => {
      const entryMs = Date.parse(entry.timestamp)

      if (startMs !== undefined && entryMs < startMs) {
        return false
      }

      if (endMs !== undefined && entryMs > endMs) {
        return false
      }

      if (actionFilter !== 'all' && entry.action !== actionFilter) {
        return false
      }

      if (!lowerSearch) {
        return true
      }

      const actorParts = [
        entry.actor?.id ?? '',
        entry.actor?.name ?? '',
      ]
      const metadataString = entry.metadata ? JSON.stringify(entry.metadata) : ''
      const haystack = [
        entry.action,
        entry.target ?? '',
        ...actorParts,
        metadataString,
        entry.sourceFile,
      ].join(' ').toLowerCase()

      return haystack.includes(lowerSearch)
    })
  }, [logs, actionFilter, searchQuery, startDate, endDate, invalidRange])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">監査ログ</h1>
          <p className="text-sm text-gray-600 mt-1">
            運用上重要な操作が記録されます。ステータス更新や図番変更の経緯確認に利用してください。
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex flex-col">
            <label htmlFor="action-filter" className="text-sm font-medium text-gray-700">
              アクションで絞り込み
            </label>
            <select
              id="action-filter"
              value={actionFilter}
              onChange={event => setActionFilter(event.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">すべて</option>
              {availableActions.map(action => (
                <option key={action} value={action}>
                  {ACTION_LABELS[action] ?? action}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label htmlFor="search-query" className="text-sm font-medium text-gray-700">
              キーワード検索
            </label>
            <input
              id="search-query"
              type="search"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="対象図番 / 操作者 / メタデータなど"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex flex-col">
            <label htmlFor="start-date" className="text-sm font-medium text-gray-700">
              開始日
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={event => setStartDate(event.target.value)}
              max={endDate || undefined}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="end-date" className="text-sm font-medium text-gray-700">
              終了日
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={event => setEndDate(event.target.value)}
              min={startDate || undefined}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        {invalidRange && (
          <div className="text-xs font-medium text-red-600">
            開始日は終了日より前の日付を選択してください。
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  時刻
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  アクション
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  対象
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  操作者
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  詳細
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    該当するログはありません。
                  </td>
                </tr>
              )}

              {filteredLogs.map((entry, index) => {
                const actionLabel = ACTION_LABELS[entry.action] ?? entry.action
                const actorLabel = entry.actor
                  ? [entry.actor.name, entry.actor.id].filter(Boolean).join(' / ')
                  : '（未取得）'
                const changedFields = Array.isArray(entry.metadata?.changedFields)
                  ? entry.metadata?.changedFields.filter(field => typeof field === 'string')
                  : []

                return (
                  <tr key={`${entry.timestamp}-${entry.action}-${index}`}>
                    <td className="px-4 py-3 text-sm text-gray-700 align-top whitespace-nowrap">
                      <div>{new Date(entry.timestamp).toLocaleString('ja-JP')}</div>
                      <div className="text-xs text-gray-400">
                        {entry.sourceFile}:{entry.lineNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 align-top">
                      <span className="font-medium text-gray-900">{actionLabel}</span>
                      {changedFields.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {changedFields.map(field => (
                            <span
                              key={field}
                              className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                            >
                              {field}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 align-top whitespace-nowrap">
                      {entry.target ?? '―'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 align-top whitespace-nowrap">
                      {actorLabel}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 align-top">
                      <MetadataCell metadata={entry.metadata} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MetadataCell({ metadata }: { metadata?: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false)

  if (!metadata || Object.keys(metadata).length === 0) {
    return <span className="text-gray-400">（メタデータなし）</span>
  }

  const entries = Object.entries(metadata).filter(([key]) => key !== 'changedFields')

  if (entries.length === 0) {
    return <span className="text-gray-400">（メタデータなし）</span>
  }

  const previewCount = expanded ? entries.length : 2
  const visibleEntries = entries.slice(0, previewCount)
  const hiddenCount = entries.length - visibleEntries.length

  return (
    <div className="space-y-2">
      <dl className="space-y-1">
        {visibleEntries.map(([key, value]) => (
          <div key={key}>
            <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {key}
            </dt>
            <dd className="text-sm text-gray-700 break-words whitespace-pre-wrap">
              {formatMetadataValue(value, expanded)}
            </dd>
          </div>
        ))}
      </dl>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          className="text-xs font-medium text-blue-600 hover:text-blue-800"
        >
          {expanded ? '詳細を閉じる' : `＋ ほか ${hiddenCount} 項目を表示`}
        </button>
      )}
    </div>
  )
}

function formatMetadataValue(value: unknown, expanded: boolean): string {
  if (value === null || value === undefined) {
    return '―'
  }

  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value, null, expanded ? 2 : 0)
      return expanded ? json : truncate(json, 120)
    } catch {
      return expanded ? String(value) : truncate(String(value), 120)
    }
  }

  const stringValue = String(value)
  return expanded ? stringValue : truncate(stringValue, 120)
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, maxLength)}…`
}
