import path from 'path'
import { promises as fs } from 'fs'
import { getAuditLogDir, type AuditEvent } from './auditLogger'

export interface AuditLogEntry extends AuditEvent {
  sourceFile: string
  lineNumber: number
}

interface LoadAuditLogOptions {
  limit?: number
  actions?: string[]
}

export async function loadAuditLogs(options: LoadAuditLogOptions = {}): Promise<AuditLogEntry[]> {
  const { limit, actions } = options
  const auditDir = getAuditLogDir()

  let fileNames: string[] = []
  try {
    fileNames = await fs.readdir(auditDir)
  } catch (error) {
    // ディレクトリ未作成などは空配列扱いにする
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('[audit] Failed to read audit directory:', error)
    }
    return []
  }

  const auditFiles = fileNames
    .filter(name => /^audit-\d{4}-\d{2}\.jsonl$/.test(name))
    .sort()
    .reverse()

  const entries: AuditLogEntry[] = []

  for (const fileName of auditFiles) {
    const filePath = path.join(auditDir, fileName)
    let fileContent: string

    try {
      fileContent = await fs.readFile(filePath, 'utf-8')
    } catch (error) {
      console.error('[audit] Failed to read audit log file:', filePath, error)
      continue
    }

    const lines = fileContent.split(/\r?\n/).filter(Boolean)

    for (let index = lines.length - 1; index >= 0; index--) {
      const line = lines[index]

      try {
        const event = JSON.parse(line) as AuditEvent

        if (actions && actions.length > 0 && !actions.includes(event.action)) {
          continue
        }

        entries.push({
          ...event,
          sourceFile: fileName,
          lineNumber: index + 1,
        })
      } catch (error) {
        console.error('[audit] Failed to parse audit log entry:', { filePath, lineNumber: index + 1 }, error)
      }
    }

    if (limit && entries.length >= limit) {
      break
    }
  }

  entries.sort((a, b) => {
    const aTime = Date.parse(a.timestamp)
    const bTime = Date.parse(b.timestamp)
    return bTime - aTime
  })

  if (limit && entries.length > limit) {
    return entries.slice(0, limit)
  }

  return entries
}
