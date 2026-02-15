// src/lib/drawingUtils.ts - 図番管理ユーティリティ

import { mkdir, writeFile, readFile, access } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { sanitizeDrawingNumber } from './dataLoader'
import { Company, Product, SearchIndex, WorkInstruction } from './dataLoader'
import { MachineTypeKey } from './machineTypeUtils'

// 環境に応じたデータパス取得
function getDataPath(): string {
  if (process.env.NODE_ENV === 'production') {
    return process.env.DATA_ROOT_PATH || './public/data_demo'
  }
  
  if (process.env.USE_NAS === 'true') {
    return process.env.DATA_ROOT_PATH || './public/data_demo'
  }
  
  return process.env.DEV_DATA_ROOT_PATH || './public/data'
}

// ID生成ユーティリティ
export function generateCompanyId(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30)
}

export function generateProductId(productName: string): string {
  // 製品名ベースのユニークID
  const sanitized = productName.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '').substring(0, 10)
  const timestamp = Date.now().toString()
  const random = Math.random().toString(36).substr(2, 4)
  return `product-${sanitized}-${timestamp}-${random}`
}

// フォルダ階層作成
export async function createDrawingDirectoryStructure(drawingNumber: string): Promise<void> {
  const safeDrawingNumber = sanitizeDrawingNumber(drawingNumber)
  const basePath = path.join(getDataPath(), 'work-instructions', `drawing-${safeDrawingNumber}`)
  
  // 必須フォルダ一覧（ステップフォルダは編集画面で必要時に作成）
  const requiredDirectories = [
    'images/overview',
    'videos/overview',
    'pdfs/overview',      // PDFファイルはここに配置
    'programs/overview',   // プログラムファイルはここに配置
    'contributions/files/images',  // 追記用
    'contributions/files/videos'   // 追記用
  ]
  
  // 並列でフォルダ作成（高速化）
  await Promise.all(
    requiredDirectories.map(async (dir) => {
      const fullPath = path.join(basePath, dir)
      try {
        await mkdir(fullPath, { recursive: true })
      } catch (error) {
        // フォルダが既に存在する場合は無視
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw error
        }
      }
    })
  )
  
  console.log(`✅ フォルダ階層作成完了: drawing-${safeDrawingNumber}`)
}

// PDFファイル保存（pdfs/overview/に配置）
export async function savePdfFile(drawingNumber: string, pdfFile: File): Promise<string> {
  const safeDrawingNumber = sanitizeDrawingNumber(drawingNumber)
  const fileName = `${safeDrawingNumber}.pdf`
  const basePath = path.join(getDataPath(), 'work-instructions', `drawing-${safeDrawingNumber}`)
  const filePath = path.join(basePath, 'pdfs', 'overview', fileName)
  
  // ファイル検証
  if (!pdfFile.type.includes('pdf')) {
    throw new Error('PDFファイルのみアップロード可能です')
  }
  
  if (pdfFile.size > 10 * 1024 * 1024) { // 10MB制限
    throw new Error('ファイルサイズが大きすぎます（10MB以下にしてください）')
  }
  
  // バッファに変換して保存
  const buffer = await pdfFile.arrayBuffer()
  await writeFile(filePath, Buffer.from(buffer))
  
  console.log(`✅ PDFファイル保存完了: ${fileName}`)
  return fileName
}

// 図番重複チェック
export async function checkDrawingNumberExists(drawingNumber: string): Promise<boolean> {
  const safeDrawingNumber = sanitizeDrawingNumber(drawingNumber)
  const basePath = path.join(getDataPath(), 'work-instructions', `drawing-${safeDrawingNumber}`)
  
  try {
    await access(basePath)
    return true
  } catch {
    return false
  }
}

// 複数図番の一括重複チェック
export async function checkMultipleDrawingNumbers(drawingNumbers: string[]): Promise<string[]> {
  const duplicates: string[] = []
  
  await Promise.all(
    drawingNumbers.map(async (drawingNumber) => {
      const exists = await checkDrawingNumberExists(drawingNumber)
      if (exists) {
        duplicates.push(drawingNumber)
      }
    })
  )
  
  return duplicates
}

// 基本的なinstruction.json生成
export function generateBasicInstruction(data: {
  drawingNumber: string
  title: string
  companyId: string
  productId: string
  difficulty: string
  estimatedTime: string
  machineType: MachineTypeKey[]
  description?: string
  warnings?: string[]
}): WorkInstruction {
  const totalTime = parseInt(data.estimatedTime) || 180
  const prepTime = Math.min(30, Math.floor(totalTime * 0.2))
  const processTime = totalTime - prepTime
  
  return {
    metadata: {
      drawingNumber: data.drawingNumber,
      title: data.title,
      companyId: data.companyId,
      productId: data.productId,
      createdDate: new Date().toISOString().split('T')[0],
      updatedDate: new Date().toISOString().split('T')[0],
      author: "管理画面",
      estimatedTime: `${data.estimatedTime}分`,
      machineType: [...data.machineType],
      difficulty: data.difficulty,
      toolsRequired: []
    },
    overview: {
      description: data.description || `${data.title}の加工を行います`,
      warnings: data.warnings || [],
      preparationTime: `${prepTime}分`,
      processingTime: `${processTime}分`
    },
    workSteps: [],
    relatedDrawings: [],
    troubleshooting: [],
    revisionHistory: [
      {
        date: new Date().toISOString().split('T')[0],
        author: "管理画面",
        changes: "新規作成"
      }
    ]
  }
}

// instruction.json保存
export async function saveInstructionFile(drawingNumber: string, instruction: WorkInstruction): Promise<void> {
  try {
    const safeDrawingNumber = sanitizeDrawingNumber(drawingNumber)
    const basePath = path.join(getDataPath(), 'work-instructions', `drawing-${safeDrawingNumber}`)
    const filePath = path.join(basePath, 'instruction.json')
    
    console.log(`📝 instruction.json保存開始: ${filePath}`)
    
    // フォルダが存在するか確認
    try {
      await access(basePath)
    } catch {
      console.error(`❌ フォルダが存在しません: ${basePath}`)
      throw new Error(`フォルダが存在しません: drawing-${safeDrawingNumber}`)
    }
    
    await writeFile(filePath, JSON.stringify(instruction, null, 2))
    console.log(`✅ instruction.json保存完了: drawing-${safeDrawingNumber}`)
  } catch (error) {
    console.error(`❌ instruction.json保存エラー:`, error)
    throw error
  }
}

// データ整合性チェック
export async function validateDataIntegrity(drawingNumber: string): Promise<{
  valid: boolean
  errors: string[]
}> {
  const errors: string[] = []
  const safeDrawingNumber = sanitizeDrawingNumber(drawingNumber)
  
  try {
    // 1. フォルダ存在チェック
    const basePath = path.join(getDataPath(), 'work-instructions', `drawing-${safeDrawingNumber}`)
    if (!existsSync(basePath)) {
      errors.push(`フォルダが存在しません: drawing-${safeDrawingNumber}`)
    }
    
    // 2. instruction.json存在チェック
    const instructionPath = path.join(basePath, 'instruction.json')
    if (!existsSync(instructionPath)) {
      errors.push(`instruction.jsonが存在しません: drawing-${safeDrawingNumber}`)
    }
    
    // 3. 必須フォルダ存在チェック
    const requiredDirs = ['images', 'videos', 'pdfs', 'programs']
    for (const dir of requiredDirs) {
      const dirPath = path.join(basePath, dir)
      if (!existsSync(dirPath)) {
        errors.push(`必須フォルダが存在しません: ${dir}`)
      }
    }
    
    // 4. companies.jsonとsearch-index.jsonの整合性チェック
    const companiesPath = path.join(getDataPath(), 'companies.json')
    const searchIndexPath = path.join(getDataPath(), 'search-index.json')
    
    if (existsSync(companiesPath)) {
      const companies = JSON.parse(await readFile(companiesPath, 'utf-8'))
      const foundInCompanies = companies.companies.some((company: Company) =>
        company.products.some((product: Product) =>
          product.drawings.includes(drawingNumber)
        )
      )
      if (!foundInCompanies) {
        errors.push(`companies.jsonに図番が見つかりません: ${drawingNumber}`)
      }
    }
    
    if (existsSync(searchIndexPath)) {
      const searchIndex: SearchIndex = JSON.parse(await readFile(searchIndexPath, 'utf-8'))
      const foundInSearch = searchIndex.drawings.some(d => d.drawingNumber === drawingNumber)
      if (!foundInSearch) {
        errors.push(`search-index.jsonに図番が見つかりません: ${drawingNumber}`)
      }
    }
    
  } catch (error) {
    errors.push(`整合性チェック中にエラーが発生しました: ${error}`)
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

// 複数図番の一括整合性チェック
export async function validateMultipleDrawings(drawingNumbers: string[]): Promise<{
  valid: boolean
  results: Record<string, { valid: boolean; errors: string[] }>
}> {
  const results: Record<string, { valid: boolean; errors: string[] }> = {}
  
  await Promise.all(
    drawingNumbers.map(async (drawingNumber) => {
      const result = await validateDataIntegrity(drawingNumber)
      results[drawingNumber] = result
    })
  )
  
  const allValid = Object.values(results).every(r => r.valid)
  
  return {
    valid: allValid,
    results
  }
}




