import Link from 'next/link'
import { loadAuditLogs } from '@/lib/auditLogReader'
import { AuditLogViewer } from './AuditLogViewer'

export default async function AuditLogPage() {
  const logs = await loadAuditLogs({ limit: 200 })

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <Link
          href="/admin"
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          ← ダッシュボードへ戻る
        </Link>
        <span className="text-xs text-gray-500">
          表示件数: {logs.length}件
        </span>
      </div>

      <AuditLogViewer logs={logs} />
    </div>
  )
}
