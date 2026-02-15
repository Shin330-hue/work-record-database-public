import path from 'path'
import { promises as fs } from 'fs'

export interface AuditActor {
  id?: string
  name?: string
}

export interface AuditEvent {
  timestamp: string
  action: string
  target?: string
  actor?: AuditActor
  metadata?: Record<string, unknown>
}

const DEFAULT_AUDIT_DIR = path.join(process.cwd(), 'public', 'data_demo', 'audit')

export function getAuditLogDir(): string {
  return process.env.AUDIT_LOG_DIR && process.env.AUDIT_LOG_DIR.trim().length > 0
    ? process.env.AUDIT_LOG_DIR
    : DEFAULT_AUDIT_DIR
}

function buildAuditFilePath(baseDir: string): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return path.join(baseDir, `audit-${year}-${month}.jsonl`)
}

async function ensureDirectory(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true })
}

export async function logAuditEvent(event: Omit<AuditEvent, 'timestamp'> & { timestamp?: string }): Promise<void> {
  if (process.env.DISABLE_AUDIT_LOG === 'true') {
    return
  }

  const auditDir = getAuditLogDir()
  const filePath = buildAuditFilePath(auditDir)

  const entry: AuditEvent = {
    timestamp: event.timestamp ?? new Date().toISOString(),
    action: event.action,
    target: event.target,
    actor: event.actor,
    metadata: event.metadata,
  }

  try {
    await ensureDirectory(auditDir)
    const line = JSON.stringify(entry)
    await fs.appendFile(filePath, line + '\n', 'utf-8')
  } catch (error) {
    console.error('[audit] Failed to write audit log:', error)
  }
}

export function extractAuditActorFromHeaders(headers: Headers): AuditActor | undefined {
  const rawId = headers.get('x-admin-user-id')?.trim()
  const rawName = headers.get('x-admin-user-name')?.trim()

  let id = rawId
  let name = rawName

  try {
    id = rawId ? decodeURIComponent(rawId) : rawId
  } catch {
    // ignore decode errors
  }

  try {
    name = rawName ? decodeURIComponent(rawName) : rawName
  } catch {
    // ignore decode errors
  }

  if (!id && !name) {
    return undefined
  }

  return {
    id: id || undefined,
    name: name || undefined,
  }
}
