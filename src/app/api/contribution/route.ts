import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { ContributionData, ContributionFile, ContributionFileData } from '@/types/contribution'
import { sanitizeDrawingNumber } from '@/lib/dataLoader'

function generateId(): string {
  return Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9)
}

// セキュリティ対策: ファイル検証
function validateFile(file: File): { valid: boolean; error?: string } {
  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
  
  // ファイルサイズチェック
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `ファイルサイズが大きすぎます。最大50MBまでです。(${file.name})` }
  }
  
  // MIMEタイプチェック
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/tiff',
    'video/mp4', 'video/webm', 'video/avi', 'video/mov'
  ]
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `サポートされていないファイル形式です。(${file.name})` }
  }
  
  // ファイル名チェック（危険な拡張子の除外）
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.scr', '.js', '.vbs', '.jar']
  const fileName = file.name.toLowerCase()
  if (dangerousExtensions.some(ext => fileName.endsWith(ext))) {
    return { valid: false, error: `実行可能ファイルはアップロードできません。(${file.name})` }
  }
  
  return { valid: true }
}

function validateFiles(files: File[]): { valid: boolean; error?: string } {
  const MAX_TOTAL_SIZE = 100 * 1024 * 1024 // 100MB
  const MAX_FILE_COUNT = 10
  
  // ファイル数チェック
  if (files.length > MAX_FILE_COUNT) {
    return { valid: false, error: `ファイル数が上限を超えています。最大${MAX_FILE_COUNT}ファイルまでです。` }
  }
  
  // 総容量チェック
  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  if (totalSize > MAX_TOTAL_SIZE) {
    return { valid: false, error: `総ファイルサイズが大きすぎます。最大100MBまでです。` }
  }
  
  // 個別ファイル検証
  for (const file of files) {
    const validation = validateFile(file)
    if (!validation.valid) {
      return validation
    }
  }
  
  return { valid: true }
}

function getContributionPath(drawingNumber: string): string {
  const safeDrawingNumber = sanitizeDrawingNumber(drawingNumber)
  if (process.env.NODE_ENV === 'production') {
    return path.join(process.env.DATA_ROOT_PATH || './public/data_demo',
                    'work-instructions', `drawing-${safeDrawingNumber}`, 'contributions')
  }
  // 開発環境では環境変数を優先
  const devDataPath = process.env.DEV_DATA_ROOT_PATH || process.env.DATA_ROOT_PATH || './public/data'
  return path.join(process.cwd(), devDataPath.replace(/^\.\//, ''), 'work-instructions',
                  `drawing-${safeDrawingNumber}`, 'contributions')
}

async function ensureContributionDirectory(contributionPath: string): Promise<void> {
  if (!existsSync(contributionPath)) {
    await mkdir(contributionPath, { recursive: true })
    await mkdir(path.join(contributionPath, 'files'), { recursive: true })
    await mkdir(path.join(contributionPath, 'files', 'images'), { recursive: true })
    await mkdir(path.join(contributionPath, 'files', 'videos'), { recursive: true })
  }
}

async function loadContributionFile(contributionPath: string): Promise<ContributionFile> {
  const filePath = path.join(contributionPath, 'contributions.json')
  try {
    if (existsSync(filePath)) {
      const data = await readFile(filePath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Failed to load contribution file:', error)
  }
  
  return {
    drawingNumber: '',
    contributions: [],
    metadata: {
      totalContributions: 0,
      lastUpdated: new Date().toISOString(),
      version: '1.0',
      mergedCount: 0
    }
  }
}

async function saveContributionFile(contributionPath: string, data: ContributionFile): Promise<void> {
  const filePath = path.join(contributionPath, 'contributions.json')
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const drawingNumber = formData.get('drawingNumber') as string
    const userId = formData.get('userId') as string
    const userName = formData.get('userName') as string
    const type = formData.get('type') as string
    const targetSection = formData.get('targetSection') as string
    const stepNumber = formData.get('stepNumber') as string
    const text = formData.get('text') as string
    // 複数ファイル取得（後方互換性維持）
    const singleFile = formData.get('file') as File | null
    const multipleFiles = formData.getAll('files') as File[]
    
    // 実際のファイル配列を決定
    const files: File[] = multipleFiles.length > 0 ? multipleFiles : (singleFile ? [singleFile] : [])

    if (!drawingNumber || !userId || !userName || !type || !targetSection) {
      return NextResponse.json({ error: 'Required fields missing' }, { status: 400 })
    }

    // ファイル検証
    if (files.length > 0) {
      const validation = validateFiles(files)
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }
    }

    const contributionPath = getContributionPath(drawingNumber)
    await ensureContributionDirectory(contributionPath)

    const contributionFile = await loadContributionFile(contributionPath)
    contributionFile.drawingNumber = drawingNumber

    const contributionId = generateId()
    
    // 複数ファイル処理
    const processedFiles: ContributionFileData[] = []
    let legacyImagePath: string | undefined
    let legacyVideoPath: string | undefined
    let legacyFileName: string | undefined
    let legacyFileSize: number | undefined

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file && file.size > 0) {
        const fileExtension = path.extname(file.name)
        // ファイル名を安全な形式に（日本語・特殊文字を除去）
        const safeUserId = userId.replace(/[^\w\-]/g, '_')
        const fileName = `${safeUserId}_${contributionId}_${i}${fileExtension}`
        const fileType = file.type.startsWith('image/') ? 'images' : 'videos'
        const fullFilePath = path.join(contributionPath, 'files', fileType, fileName)
        
        const bytes = await file.arrayBuffer()
        await writeFile(fullFilePath, Buffer.from(bytes))
        
        const relativePath = `files/${fileType}/${fileName}`
        
        processedFiles.push({
          fileName,
          originalFileName: file.name,
          fileType: file.type.startsWith('image/') ? 'image' : 'video',
          mimeType: file.type,
          fileSize: file.size,
          filePath: relativePath
        })

        // 最初のファイルを既存フィールドにも設定（後方互換性）
        if (i === 0) {
          if (file.type.startsWith('image/')) {
            legacyImagePath = relativePath
          } else if (file.type.startsWith('video/')) {
            legacyVideoPath = relativePath
          }
          legacyFileName = file.name
          legacyFileSize = file.size
        }
      }
    }

    const contribution: ContributionData = {
      id: contributionId,
      userId,
      userName,
      timestamp: new Date().toISOString(),
      type: type as ContributionData['type'],
      targetSection: targetSection as ContributionData['targetSection'],
      stepNumber: stepNumber ? parseInt(stepNumber) : undefined,
      content: {
        text: text || undefined,
        // 既存フィールド（後方互換性）
        imagePath: legacyImagePath,
        videoPath: legacyVideoPath,
        originalFileName: legacyFileName,
        fileSize: legacyFileSize,
        // 新規フィールド（複数ファイル）
        files: processedFiles.length > 0 ? processedFiles : undefined
      },
      status: 'active'
    }

    contributionFile.contributions.push(contribution)
    contributionFile.metadata.totalContributions = contributionFile.contributions.length
    contributionFile.metadata.lastUpdated = new Date().toISOString()

    await saveContributionFile(contributionPath, contributionFile)

    return NextResponse.json({ success: true, contributionId })
  } catch (error) {
    console.error('Contribution submission error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const drawingNumber = searchParams.get('drawingNumber')

    if (!drawingNumber) {
      return NextResponse.json({ error: 'Drawing number required' }, { status: 400 })
    }

    const contributionPath = getContributionPath(drawingNumber)
    const contributionFile = await loadContributionFile(contributionPath)

    return NextResponse.json(contributionFile)
  } catch (error) {
    console.error('Contribution fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}