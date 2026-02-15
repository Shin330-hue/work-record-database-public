// src/app/api/admin/drawings/[id]/files/batch/route.ts - 図番ファイル一括管理API

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { existsSync } from 'fs'
import { 
  getDataPath, 
  determineFileType,
  createSafeFileName
} from '@/lib/admin/utils'
import { logAuditEvent, extractAuditActorFromHeaders } from '@/lib/auditLogger'


// ファイルタイプ判定（共通ユーティリティのラッパー）
function determineFileTypeForBatch(file: File): 'images' | 'videos' | 'pdfs' | 'programs' {
  const fileType = determineFileType(file.name, file.type)
  if (fileType === 'unknown') {
    throw new Error(`サポートされていないファイル形式: ${file.name}`)
  }
  return fileType
}

// ファイル検証
// File validation
const BYTES_PER_MB = 1024 * 1024

type FileRule = {
  maxSize: number
  allowedMimePrefixes?: string[]
  allowedMimeIncludes?: string[]
  allowedExact?: string[]
}

const FILE_TYPE_RULES: Record<'images' | 'videos' | 'pdfs' | 'programs', FileRule> = {
  images: {
    maxSize: 50 * BYTES_PER_MB,
    allowedMimePrefixes: ['image/'],
  },
  videos: {
    maxSize: 50 * BYTES_PER_MB,
    allowedMimePrefixes: ['video/'],
  },
  pdfs: {
    maxSize: 50 * BYTES_PER_MB,
    allowedMimeIncludes: ['pdf'],
  },
  programs: {
    maxSize: 50 * BYTES_PER_MB,
    allowedExact: [
      'text/plain',
      'text/x-nc',
      'application/octet-stream',
      'application/dxf',
      'application/x-dxf',
      'image/vnd.dxf',
      'application/zip',
      'application/x-zip-compressed',
      'application/x-zip',
      'application/x-compressed',
      'multipart/x-zip',
      'application/step',
      'application/x-step',
      'model/step',
      'model/x-step',
    ],
  },
}

function isMimeAllowed(mimeType: string, rule: FileRule) {
  if (!mimeType) {
    return true
  }

  const normalized = mimeType.toLowerCase()

  if (rule.allowedExact?.some((value) => normalized === value)) {
    return true
  }

  if (rule.allowedMimePrefixes?.some((prefix) => normalized.startsWith(prefix))) {
    return true
  }

  if (rule.allowedMimeIncludes?.some((fragment) => normalized.includes(fragment))) {
    return true
  }

  return false
}

function validateFile(file: File): { valid: boolean; error?: string } {
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.scr', '.js', '.vbs', '.jar']
  const fileName = file.name.toLowerCase()

  if (dangerousExtensions.some((ext) => fileName.endsWith(ext))) {
    return { valid: false, error: `Executable files cannot be uploaded (${file.name})` }
  }

  try {
    const fileType = determineFileTypeForBatch(file)
    const rule = FILE_TYPE_RULES[fileType]
    const mimeType = file.type || ''

    if (file.size > rule.maxSize) {
      const maxMb = Math.floor(rule.maxSize / BYTES_PER_MB)
      return { valid: false, error: `File is too large. Maximum ${maxMb}MB (${file.name})` }
    }

    if (!isMimeAllowed(mimeType, rule)) {
      const displayMime = mimeType || 'unknown'
      return { valid: false, error: `Unexpected MIME type (${file.name}: ${displayMime})` }
    }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Failed to validate file type' }
  }

  return { valid: true }
}

// Multiple file validation
function validateFiles(files: File[]): { valid: boolean; error?: string } {
  const MAX_TOTAL_SIZE = 100 * BYTES_PER_MB // 100MB
  const MAX_FILE_COUNT = 20

  if (files.length > MAX_FILE_COUNT) {
    return { valid: false, error: `Too many files. Up to ${MAX_FILE_COUNT} files are allowed.` }
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  if (totalSize > MAX_TOTAL_SIZE) {
    return { valid: false, error: 'Total upload size must be 100MB or less.' }
  }

  for (const file of files) {
    const validation = validateFile(file)
    if (!validation.valid) {
      return validation
    }
  }

  return { valid: true }
}

function generateFileName(file: File, fileType: string): string {
  switch (fileType) {
    case 'images':
    case 'videos':
      // 画像・動画：タイムスタンプ付加（重複回避）
      return createSafeFileName(file.name, { addTimestamp: true })

    case 'pdfs':
    case 'programs':
      // PDF・プログラム：オリジナルの意図を保ちつつサニタイズ
      return createSafeFileName(file.name)

    default:
      return createSafeFileName(file.name, { addTimestamp: true })
  }
}

// 重複チェック付きファイル保存
async function saveFileWithDuplicateCheck(
  filePath: string, 
  fileName: string, 
  buffer: Buffer
): Promise<string> {
  let finalFileName = fileName
  let counter = 1
  
  // 重複チェック
  while (existsSync(path.join(filePath, finalFileName))) {
    const ext = path.extname(fileName)
    const base = path.basename(fileName, ext)
    finalFileName = `${base}_${counter}${ext}`
    counter++
  }
  
  const fullPath = path.join(filePath, finalFileName)
  await fs.writeFile(fullPath, buffer)
  
  return finalFileName
}

// instruction.jsonの更新
async function updateInstructionFile(
  drawingNumber: string, 
  stepNumber: string, 
  fileType: string, 
  fileNames: string[]
): Promise<void> {
  const dataPath = getDataPath()
  const instructionPath = path.join(
    dataPath,
    'work-instructions',
    `drawing-${drawingNumber}`,
    'instruction.json'
  )
  
  try {
    // 既存のinstruction.jsonを読み込み
    // 動的なプロパティアクセスのため、anyを使用
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let instruction: any = {}
    if (existsSync(instructionPath)) {
      const content = await fs.readFile(instructionPath, 'utf-8')
      instruction = JSON.parse(content)
    }
    
    // ファイルリストの更新
    
    if (stepNumber === '0') {
      // overview の場合
      if (!instruction.overview) instruction.overview = {}
      if (!(instruction.overview as Record<string, unknown>)[fileType]) (instruction.overview as Record<string, unknown>)[fileType] = []
      
      // 既存のファイルリストに追加（重複を除く）
      const existingFiles = new Set(instruction.overview[fileType])
      fileNames.forEach(fileName => existingFiles.add(fileName))
      instruction.overview[fileType] = Array.from(existingFiles)
      
    } else {
      // workSteps の場合
      if (!instruction.workSteps) instruction.workSteps = []
      
      const stepIndex = parseInt(stepNumber) - 1
      if (!instruction.workSteps[stepIndex]) {
        // ステップが存在しない場合はスキップ（エラーにはしない）
        console.warn(`Step ${stepNumber} not found in instruction.json`)
        return
      }
      
      if (!instruction.workSteps[stepIndex][fileType]) {
        instruction.workSteps[stepIndex][fileType] = []
      }
      
      // 既存のファイルリストに追加（重複を除く）
      const existingFiles = new Set(instruction.workSteps[stepIndex][fileType])
      fileNames.forEach(fileName => existingFiles.add(fileName))
      instruction.workSteps[stepIndex][fileType] = Array.from(existingFiles)
    }
    
    // 更新日時を記録
    if (!instruction.metadata) instruction.metadata = {}
    instruction.metadata.lastUpdated = new Date().toISOString()
    
    // ファイルに保存
    await fs.writeFile(instructionPath, JSON.stringify(instruction, null, 2), 'utf-8')
    
  } catch (error) {
    console.error('instruction.json更新エラー:', error)
    // エラーが発生してもアップロード自体は成功とする
  }
}

// ファイル一括アップロード
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: drawingNumber } = await context.params
    const actor = extractAuditActorFromHeaders(request.headers)
    
    if (!drawingNumber) {
      return NextResponse.json(
        { success: false, error: '図番が指定されていません' },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const stepNumber = formData.get('stepNumber') as string
    const files = formData.getAll('files') as File[]

    if (!stepNumber) {
      return NextResponse.json(
        { success: false, error: 'ステップ番号が指定されていません' },
        { status: 400 }
      )
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ファイルが選択されていません' },
        { status: 400 }
      )
    }

    // ファイル検証
    const validation = validateFiles(files)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }

    // アップロード結果
    const results: {
      uploaded: { fileName: string; originalName: string; fileType: string }[]
      errors: { fileName: string; error: string }[]
    } = {
      uploaded: [],
      errors: []
    }

    // ファイルタイプ別にグループ化
    const filesByType: Record<string, { file: File; savedName?: string }[]> = {
      images: [],
      videos: [],
      pdfs: [],
      programs: []
    }

    // ファイルタイプ判定とグループ化
    for (const file of files) {
      try {
        const fileType = determineFileTypeForBatch(file)
        filesByType[fileType].push({ file })
      } catch (error) {
        results.errors.push({
          fileName: file.name,
          error: error instanceof Error ? error.message : 'ファイルタイプの判定に失敗しました'
        })
      }
    }

    // 保存先パス
    const dataPath = getDataPath()
    const basePath = path.join(
      dataPath,
      'work-instructions',
      `drawing-${drawingNumber}`
    )

    // ファイルタイプごとに処理
    for (const [fileType, fileList] of Object.entries(filesByType)) {
      if (fileList.length === 0) continue

      const targetDir = path.join(
        basePath,
        fileType,
        stepNumber === '0' ? 'overview' : `step_${stepNumber.padStart(2, '0')}`
      )

      // ディレクトリ作成
      await fs.mkdir(targetDir, { recursive: true })

      // ファイル保存
      const savedFileNames: string[] = []
      
      for (const fileInfo of fileList) {
        try {
          const fileName = generateFileName(fileInfo.file, fileType)
          const buffer = await fileInfo.file.arrayBuffer()
          const savedFileName = await saveFileWithDuplicateCheck(
            targetDir,
            fileName,
            Buffer.from(buffer)
          )
          
          fileInfo.savedName = savedFileName
          savedFileNames.push(savedFileName)
          
          results.uploaded.push({
            fileName: savedFileName,
            originalName: fileInfo.file.name,
            fileType
          })
        } catch (error) {
          results.errors.push({
            fileName: fileInfo.file.name,
            error: error instanceof Error ? error.message : 'ファイル保存に失敗しました'
          })
        }
      }

      // instruction.json更新（このファイルタイプの分）
      if (savedFileNames.length > 0) {
        await updateInstructionFile(drawingNumber, stepNumber, fileType, savedFileNames)
      }
    }

    // レスポンス
    const success = results.uploaded.length > 0
    const statusCode = success ? 200 : 400

    await logAuditEvent({
      action: 'drawing.files.upload',
      target: `${drawingNumber}:step-${stepNumber}`,
      actor,
      metadata: {
        drawingNumber,
        stepNumber,
        success,
        summary: {
          total: files.length,
          uploaded: results.uploaded.length,
          failed: results.errors.length,
        },
        uploadedFiles: results.uploaded,
        failedFiles: results.errors,
        source: 'admin/drawings/files/batch',
      },
    })

    return NextResponse.json({
      success,
      message: success 
        ? `${results.uploaded.length}個のファイルがアップロードされました` 
        : 'すべてのファイルのアップロードに失敗しました',
      uploaded: results.uploaded,
      errors: results.errors,
      summary: {
        total: files.length,
        uploaded: results.uploaded.length,
        failed: results.errors.length
      }
    }, { status: statusCode })

  } catch (error) {
    console.error('ファイル一括アップロードエラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'アップロードに失敗しました' 
      },
      { status: 500 }
    )
  }
}
