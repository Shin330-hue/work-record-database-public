// 機械種別関連のユーティリティ関数

export const MACHINE_TYPE_KEYS = ['machining', 'turning', 'yokonaka', 'radial', 'other'] as const
export type MachineTypeKey = typeof MACHINE_TYPE_KEYS[number]

// 日本語 ⇔ 英語キーのマッピング
export const machineTypeMap: Record<string, MachineTypeKey> = {
  'マシニング': 'machining',
  'マシニングセンタ': 'machining',
  'ターニング': 'turning',
  'ターニングセンタ': 'turning',
  '横中': 'yokonaka',
  '横中ぐり盤': 'yokonaka',
  'ラジアル': 'radial',
  'ラジアルボール盤': 'radial',
  'フライス': 'other',
  'フライス盤': 'other',
  'その他': 'other'
}

export const machineTypeMapReverse: Record<MachineTypeKey, string> = {
  machining: 'マシニング',
  turning: 'ターニング',
  yokonaka: '横中',
  radial: 'ラジアル',
  other: 'その他'
}

export const MACHINE_TYPE_OPTIONS = MACHINE_TYPE_KEYS.map((key) => ({
  key,
  label: machineTypeMapReverse[key]
}))

const MACHINE_TYPE_SET = new Set<string>(MACHINE_TYPE_KEYS)

function isMachineTypeKey(value: string): value is MachineTypeKey {
  return MACHINE_TYPE_SET.has(value)
}

function toMachineTypeKey(raw: string): MachineTypeKey {
  const trimmed = raw.trim()
  if (!trimmed) {
    return 'other'
  }

  if (isMachineTypeKey(trimmed)) {
    return trimmed
  }

  const lower = trimmed.toLowerCase()
  if (isMachineTypeKey(lower)) {
    return lower
  }

  const mapped =
    machineTypeMap[trimmed] ??
    machineTypeMap[lower] ??
    machineTypeMap[trimmed.replace(/\s+/g, '')]

  return mapped ?? 'other'
}

export function normalizeMachineTypeInput(value: string | string[] | null | undefined): MachineTypeKey[] {
  if (!value) {
    return []
  }

  const rawValues = Array.isArray(value)
    ? value
    : value.split(',').map((item) => item.trim()).filter(Boolean)

  const normalized: MachineTypeKey[] = []

  for (const raw of rawValues) {
    if (!raw) continue
    const key = toMachineTypeKey(raw)
    if (!normalized.includes(key)) {
      normalized.push(key)
    }
  }

  return normalized
}

// 機械種別を英語キーに変換（入力が英語キーでも安全に返す）
export function getMachineTypeKey(type: string): MachineTypeKey {
  return toMachineTypeKey(type)
}

// 機械種別を日本語に変換
export function getMachineTypeJapanese(type: string | MachineTypeKey): string {
  const key = typeof type === 'string' ? toMachineTypeKey(type) : type
  return machineTypeMapReverse[key] || 'その他'
}

export function getStepFolderName(stepNumber: number | string, machineType?: string | MachineTypeKey): string {
  const stepNum = typeof stepNumber === 'string' ? stepNumber : stepNumber.toString()
  const paddedStep = stepNum.padStart(2, '0')

  if (machineType) {
    const machineKey = getMachineTypeKey(machineType)
    return `step_${paddedStep}_${machineKey}`
  }

  // 後方互換性: 機械種別なしのフォルダも生成
  return `step_${paddedStep}`
}

export function extractMachineTypeFromFolder(folderName: string): MachineTypeKey | null {
  const match = folderName.match(/step_\d+_(.+)/)
  return match ? getMachineTypeKey(match[1]) : null
}

export function getPossibleFolderNames(stepNumber: number | string, machineType?: string | MachineTypeKey): string[] {
  const stepNum = typeof stepNumber === 'string' ? stepNumber : stepNumber.toString()
  const paddedStep = stepNum.padStart(2, '0')

  const folderNames = []

  if (machineType) {
    const machineKey = getMachineTypeKey(machineType)
    folderNames.push(`step_${paddedStep}_${machineKey}`)
  }

  folderNames.push(`step_${paddedStep}`)

  return folderNames
}
