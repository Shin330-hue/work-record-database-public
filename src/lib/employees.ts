import fs from 'fs/promises'
import path from 'path'

type AuthRecord = {
  id: string
  name: string
  password?: string
  enabled?: boolean
  displayName?: string
}

type AuthFileShape = {
  passwords?: AuthRecord[]
}

export type EmployeeSummary = {
  id: string
  name: string
  displayName: string
}

const DEFAULT_AUTH_RELATIVE_PATH = 'public/data/auth/passwords.json'

const EXCLUDED_EMPLOYEE_IDS = new Set(['admin'])

function resolveAuthFilePath(): string {
  const configured = process.env.AUTH_FILE_PATH

  if (configured && configured.trim().length > 0) {
    if (path.isAbsolute(configured)) {
      return configured
    }
    return path.join(process.cwd(), configured)
  }

  return path.join(process.cwd(), DEFAULT_AUTH_RELATIVE_PATH)
}

async function readAuthFile(): Promise<AuthFileShape | null> {
  const authFilePath = resolveAuthFilePath()

  try {
    const raw = await fs.readFile(authFilePath, 'utf-8')
    if (!raw) {
      return null
    }

    const sanitized = raw.replace(/^\uFEFF/, '')
    const parsed = JSON.parse(sanitized) as AuthFileShape
    return parsed
  } catch (error) {
    console.error('[employees] Failed to read auth file:', error)
    return null
  }
}

export async function loadEmployees(): Promise<EmployeeSummary[]> {
  const authFile = await readAuthFile()
  if (!authFile?.passwords || !Array.isArray(authFile.passwords)) {
    return []
  }

  return authFile.passwords
    .filter((record) => record.enabled !== false)
    .filter((record) => {
      const normalizedId = (record.id || '').trim()
      return normalizedId.length > 0 && !EXCLUDED_EMPLOYEE_IDS.has(normalizedId)
    })
    .filter((record): record is Required<Pick<AuthRecord, 'id' | 'name'>> & { displayName?: string } => {
      return Boolean(record?.id && record?.name)
    })
    .map((record) => {
      const normalizedId = record.id.trim()

      return {
        id: normalizedId,
        name: record.name,
        displayName: record.displayName ?? deriveDisplayName(record.name)
      }
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ja'))
}

function deriveDisplayName(fullName: string): string {
  const trimmed = fullName.trim()
  if (!trimmed) {
    return fullName
  }

  const separators = [' ', '　']
  for (const separator of separators) {
    if (trimmed.includes(separator)) {
      return trimmed.split(separator)[0] || trimmed
    }
  }

  return trimmed
}
