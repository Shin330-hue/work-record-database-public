#!/usr/bin/env node
/**
 * scripts/migrate-machine-type.js
 *
 * ユーザー作成の instruction.json や search-index.json に含まれる
 * machineType フィールドを英語キー配列へ正規化するユーティリティ。
 *
 * 使用例:
 *   node scripts/migrate-machine-type.js --dry-run
 *   node scripts/migrate-machine-type.js
 *   node scripts/migrate-machine-type.js --no-backup
 */

const fs = require('fs/promises')
const path = require('path')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const noBackup = args.includes('--no-backup')
const targetRootArgIndex = args.findIndex(arg => arg === '--target')
const targetRoot =
  targetRootArgIndex !== -1 && args[targetRootArgIndex + 1]
    ? path.resolve(args[targetRootArgIndex + 1])
    : path.resolve(process.cwd(), 'public', 'data')

const WORK_INSTRUCTIONS_DIR = path.join(targetRoot, 'work-instructions')
const SEARCH_INDEX_PATH = path.join(targetRoot, 'search-index.json')

const MACHINE_TYPE_KEYS = ['machining', 'turning', 'yokonaka', 'radial', 'other']

const MACHINE_TYPE_MAP = {
  'マシニング': 'machining',
  'マシニングセンタ': 'machining',
  'マシニングセンター': 'machining',
  'machining': 'machining',
  'mc': 'machining',

  'ターニング': 'turning',
  'ターニングセンタ': 'turning',
  'cnc旋盤': 'turning',
  '旋盤': 'turning',
  'turning': 'turning',
  'lathe': 'turning',

  '横中': 'yokonaka',
  '横中ぐり': 'yokonaka',
  '横中ぐり盤': 'yokonaka',
  'horizontal': 'yokonaka',
  'yokonaka': 'yokonaka',

  'ラジアル': 'radial',
  'ラジアルボール盤': 'radial',
  'ボール盤': 'radial',
  'drill': 'radial',
  'radial': 'radial',

  'フライス': 'other',
  'フライス盤': 'other',
  'その他': 'other',
  'other': 'other'
}

async function ensureBackup(filePath) {
  if (dryRun || noBackup) return
  try {
    await fs.copyFile(filePath, `${filePath}.bak`)
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.warn(`⚠️ バックアップ作成に失敗しました (${filePath}):`, error.message)
    }
  }
}

function normalizeMachineType(value) {
  if (value == null) return []

  const rawValues = Array.isArray(value)
    ? value
    : String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)

  const result = []
  for (const raw of rawValues) {
    if (!raw) continue
    const lower = raw.toLowerCase()
    const mapped =
      MACHINE_TYPE_MAP[raw] ??
      MACHINE_TYPE_MAP[lower] ??
      MACHINE_TYPE_MAP[raw.replace(/\s+/g, '')] ??
      MACHINE_TYPE_MAP[lower.replace(/\s+/g, '')]

    const key = MACHINE_TYPE_KEYS.includes(mapped) ? mapped : 'other'
    if (!result.includes(key)) {
      result.push(key)
    }
  }

  return result
}

async function migrateInstructionFiles() {
  let updatedCount = 0
  let skippedCount = 0

  try {
    const entries = await fs.readdir(WORK_INSTRUCTIONS_DIR, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('drawing-')) continue

      const instructionPath = path.join(WORK_INSTRUCTIONS_DIR, entry.name, 'instruction.json')
      try {
        const fileContent = await fs.readFile(instructionPath, 'utf-8')
        const json = JSON.parse(fileContent)

        const normalized = normalizeMachineType(json?.metadata?.machineType)
        const current = Array.isArray(json?.metadata?.machineType)
          ? json.metadata.machineType
          : []

        const isDifferent =
          normalized.length !== current.length ||
          normalized.some((val, idx) => current[idx] !== val)

        if (isDifferent) {
          json.metadata = {
            ...json.metadata,
            machineType: normalized
          }

          await ensureBackup(instructionPath)
          if (!dryRun) {
            await fs.writeFile(instructionPath, JSON.stringify(json, null, 2) + '\n')
          }
          updatedCount++
          console.log(`${dryRun ? '📝 (dry-run)' : '✅'} ${instructionPath}: machineType -> [${normalized.join(', ')}]`)
        } else {
          skippedCount++
        }
      } catch (error) {
        console.warn(`⚠️ instruction.json の処理に失敗しました (${instructionPath}):`, error.message)
      }
    }
  } catch (error) {
    console.warn('⚠️ work-instructions ディレクトリの処理に失敗しました:', error.message)
  }

  return { updatedCount, skippedCount }
}

async function migrateSearchIndex() {
  try {
    const fileContent = await fs.readFile(SEARCH_INDEX_PATH, 'utf-8')
    const searchIndex = JSON.parse(fileContent)
    let changed = false

    const normalizedDrawings = (searchIndex.drawings || []).map((drawing) => {
      const normalized = normalizeMachineType(drawing.machineType)
      const current = Array.isArray(drawing.machineType) ? drawing.machineType : []
      const isDifferent =
        normalized.length !== current.length ||
        normalized.some((val, idx) => current[idx] !== val)

      if (isDifferent) {
        changed = true
        return {
          ...drawing,
          machineType: normalized
        }
      }
      return drawing
    })

    if (changed) {
      await ensureBackup(SEARCH_INDEX_PATH)
      if (!dryRun) {
        const updated = {
          ...searchIndex,
          drawings: normalizedDrawings
        }
        await fs.writeFile(SEARCH_INDEX_PATH, JSON.stringify(updated, null, 2) + '\n')
      }
      console.log(`${dryRun ? '📝 (dry-run)' : '✅'} search-index.json: machineType 正規化完了`)
    } else {
      console.log('ℹ️ search-index.json: 変更は必要ありませんでした')
    }
  } catch (error) {
    console.warn(`⚠️ search-index.json の処理に失敗しました (${SEARCH_INDEX_PATH}):`, error.message)
  }
}

;(async function main() {
  console.log('--- machineType 正規化スクリプト ---')
  console.log(`対象ルート: ${targetRoot}`)
  console.log(`モード: ${dryRun ? 'dry-run (書き込みなし)' : '実行モード'}`)
  console.log(`バックアップ: ${noBackup ? '作成しない (--no-backup)' : '作成する'}`)

  const { updatedCount, skippedCount } = await migrateInstructionFiles()
  await migrateSearchIndex()

  console.log('----------------------------------')
  console.log(`instruction.json 更新: ${updatedCount} 件 (${skippedCount} 件は変更なし)`)
  console.log('処理完了')
})()
