// src/lib/dataTransaction.ts - データ更新トランザクション処理

import { writeFile, readFile, copyFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { Company, SearchIndex, DrawingSearchItem } from './dataLoader'
import { generateCompanyId, generateProductId } from './drawingUtils'
import { MachineTypeKey, normalizeMachineTypeInput, getMachineTypeJapanese } from './machineTypeUtils'

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

// 新規図番データ型
export interface NewDrawingData {
  drawingNumber: string
  title: string
  company: {
    type: 'existing' | 'new'
    id?: string
    name: string
  }
  product: {
    type: 'existing' | 'new'
    id?: string
    name: string
    category: string
  }
  difficulty: string
  estimatedTime: string
  machineType: MachineTypeKey[] | string | string[]
  description?: string
  warnings?: string[]
  keywords?: string[]
}

// 処理済みデータ型
export interface ProcessedDrawingData {
  drawingNumber: string
  title: string
  companyId: string
  companyName: string
  productId: string
  productName: string
  category: string
  difficulty: string
  estimatedTime: string
  machineType: MachineTypeKey[]
  description?: string
  warnings?: string[]
  keywords?: string[]
}

// データトランザクション管理クラス
export class DataTransaction {
  private backupPaths: string[] = []
  private createdFiles: string[] = []
  
  // バックアップファイル作成
  private async createBackup(filePath: string): Promise<void> {
    if (existsSync(filePath)) {
      const backupPath = `${filePath}.backup.${Date.now()}`
      await copyFile(filePath, backupPath)
      this.backupPaths.push(backupPath)
      console.log(`📁 バックアップ作成: ${path.basename(backupPath)}`)
    }
  }
  
  // 会社ID解決（既存選択または新規作成）
  async resolveCompanyId(companyInput: NewDrawingData['company']): Promise<string> {
    if (companyInput.type === 'existing' && companyInput.id) {
      return companyInput.id
    }
    
    // 新規作成時は管理画面で入力されたIDを使用
    if (companyInput.type === 'new' && companyInput.id) {
      return companyInput.id
    }
    
    // IDが指定されていない場合のみ自動生成（後方互換性のため残す）
    console.warn(`会社IDが指定されていません。自動生成します: ${companyInput.name}`)
    return generateCompanyId(companyInput.name)
  }
  
  // 製品ID解決（既存選択または新規作成）
  async resolveProductId(productInput: NewDrawingData['product']): Promise<string> {
    if (productInput.type === 'existing' && productInput.id) {
      return productInput.id
    }
    
    // 新規作成時のID生成
    return generateProductId(productInput.name)
  }
  
  // 入力データの処理
  async processDrawingData(inputData: NewDrawingData): Promise<ProcessedDrawingData> {
    const companyId = await this.resolveCompanyId(inputData.company)
    const productId = await this.resolveProductId(inputData.product)
    const machineTypes = normalizeMachineTypeInput(inputData.machineType as string | string[] | MachineTypeKey[])

    if (machineTypes.length === 0) {
      throw new Error('機械種別が選択されていません')
    }
    
    // keywordsを配列に変換（文字列の場合）
    let keywords: string[] = []
    if (inputData.keywords) {
      if (Array.isArray(inputData.keywords)) {
        keywords = inputData.keywords
      } else if (typeof inputData.keywords === 'string') {
        keywords = (inputData.keywords as string).split(',').map(k => k.trim()).filter(k => k)
      }
    }

    const keywordSet = new Set(keywords)
    machineTypes
      .map(getMachineTypeJapanese)
      .filter(Boolean)
      .forEach(label => keywordSet.add(label))
    
    return {
      drawingNumber: inputData.drawingNumber,
      title: inputData.title,
      companyId,
      companyName: inputData.company.name,
      productId,
      productName: inputData.product.name,
      category: inputData.product.category,
      difficulty: inputData.difficulty,
      estimatedTime: inputData.estimatedTime,
      machineType: machineTypes,
      description: inputData.description,
      warnings: inputData.warnings,
      keywords: Array.from(keywordSet)
    }
  }
  
  // companies.json更新
  async updateCompaniesFile(data: ProcessedDrawingData): Promise<void> {
    const companiesPath = path.join(getDataPath(), 'companies.json')
    
    // バックアップ作成
    await this.createBackup(companiesPath)
    
    // 既存データ読み込み
    let companies: { companies: Company[]; metadata: { lastUpdated: string; version: string } }
    if (existsSync(companiesPath)) {
      companies = JSON.parse(await readFile(companiesPath, 'utf-8'))
    } else {
      companies = { companies: [], metadata: { lastUpdated: new Date().toISOString(), version: '1.0.0' } }
    }
    
    // 会社の存在確認・追加
    let company = companies.companies.find(c => c.id === data.companyId)
    if (!company) {
      company = {
        id: data.companyId,
        name: data.companyName,
        shortName: data.companyName,
        description: data.companyName,
        priority: companies.companies.length + 1,
        products: []
      }
      companies.companies.push(company)
      console.log(`🏢 新規会社追加: ${data.companyName} (${data.companyId})`)
    }
    
    // 製品の存在確認・追加
    let product = company.products.find(p => p.id === data.productId)
    if (!product) {
      product = {
        id: data.productId,
        name: data.productName,
        category: data.category,
        description: data.category,
        drawingCount: 0,
        drawings: []
      }
      company.products.push(product)
      console.log(`📦 新規製品追加: ${data.productName} (${data.productId})`)
    }
    
    // 図番追加（重複チェック）
    if (!product.drawings.includes(data.drawingNumber)) {
      product.drawings.push(data.drawingNumber)
      product.drawingCount = product.drawings.length
      console.log(`📋 図番追加: ${data.drawingNumber} → ${data.productName}`)
    }
    
    // メタデータ更新
    companies.metadata = {
      lastUpdated: new Date().toISOString(),
      version: companies.metadata.version || '1.0.0'
    }
    
    // ファイル保存
    await writeFile(companiesPath, JSON.stringify(companies, null, 2))
    this.createdFiles.push(companiesPath)
    console.log(`✅ companies.json更新完了`)
  }
  
  // search-index.json更新
  async updateSearchIndex(data: ProcessedDrawingData): Promise<void> {
    const searchIndexPath = path.join(getDataPath(), 'search-index.json')
    
    // バックアップ作成
    await this.createBackup(searchIndexPath)
    
    // 既存データ読み込み
    let searchIndex: SearchIndex
    if (existsSync(searchIndexPath)) {
      searchIndex = JSON.parse(await readFile(searchIndexPath, 'utf-8'))
    } else {
      searchIndex = {
        drawings: [],
        metadata: {
          totalDrawings: 0,
          lastIndexed: new Date().toISOString(),
          version: '1.0'
        }
      }
    }
    
    const machineTypeLabels = data.machineType.map(getMachineTypeJapanese)
    const keywords = data.keywords && data.keywords.length > 0
      ? Array.from(new Set([...data.keywords, ...machineTypeLabels]))
      : [
          data.category,
          data.productName,
          data.companyName,
          ...machineTypeLabels,
          data.difficulty
        ]

    // 新しい検索エントリ作成
    const newEntry: DrawingSearchItem = {
      drawingNumber: data.drawingNumber,
      productName: data.productName,
      companyName: data.companyName,
      companyId: data.companyId,
      productId: data.productId,
      title: data.title,
      category: data.category,
      keywords,
      folderPath: `drawing-${data.drawingNumber}`,
      hasImages: false,
      hasVideos: false,
      hasDrawing: false, // PDFアップロード時にtrueに更新
      stepCount: 3,
      difficulty: data.difficulty,
      estimatedTime: `${data.estimatedTime}分`,
      machineType: data.machineType
    }
    
    // 重複チェック・追加
    const existingIndex = searchIndex.drawings.findIndex(d => d.drawingNumber === data.drawingNumber)
    if (existingIndex >= 0) {
      searchIndex.drawings[existingIndex] = newEntry
      console.log(`🔄 検索エントリ更新: ${data.drawingNumber}`)
    } else {
      searchIndex.drawings.push(newEntry)
      console.log(`🔍 検索エントリ追加: ${data.drawingNumber}`)
    }
    
    // メタデータ更新
    searchIndex.metadata = {
      totalDrawings: searchIndex.drawings.length,
      lastIndexed: new Date().toISOString(),
      version: '1.0'
    }
    
    // ファイル保存
    await writeFile(searchIndexPath, JSON.stringify(searchIndex, null, 2))
    this.createdFiles.push(searchIndexPath)
    console.log(`✅ search-index.json更新完了`)
  }
  
  // PDFファイル配置時の検索インデックス更新
  async updateSearchIndexForPdf(drawingNumber: string): Promise<void> {
    const searchIndexPath = path.join(getDataPath(), 'search-index.json')
    
    if (existsSync(searchIndexPath)) {
      const searchIndex: SearchIndex = JSON.parse(await readFile(searchIndexPath, 'utf-8'))
      const entry = searchIndex.drawings.find(d => d.drawingNumber === drawingNumber)
      
      if (entry) {
        entry.hasDrawing = true
        await writeFile(searchIndexPath, JSON.stringify(searchIndex, null, 2))
        console.log(`✅ PDFファイル配置フラグ更新: ${drawingNumber}`)
      }
    }
  }
  
  // 複数図番データの一括処理
  async processMultipleDrawings(drawingsData: NewDrawingData[]): Promise<{
    success: boolean
    processed: ProcessedDrawingData[]
    errors: string[]
  }> {
    const processed: ProcessedDrawingData[] = []
    const errors: string[] = []
    
    try {
      // 1. 全データの前処理
      for (const drawingData of drawingsData) {
        try {
          const processedData = await this.processDrawingData(drawingData)
          processed.push(processedData)
        } catch (error) {
          errors.push(`図番 ${drawingData.drawingNumber} の処理中にエラー: ${error}`)
        }
      }
      
      if (errors.length > 0) {
        return { success: false, processed: [], errors }
      }
      
      // 2. 一括でcompanies.json更新
      for (const data of processed) {
        await this.updateCompaniesFile(data)
      }
      
      // 3. 一括でsearch-index.json更新
      for (const data of processed) {
        await this.updateSearchIndex(data)
      }
      
      return { success: true, processed, errors: [] }
      
    } catch (error) {
      errors.push(`一括処理中にエラーが発生: ${error}`)
      return { success: false, processed: [], errors }
    }
  }
  
  // トランザクションコミット
  async commit(): Promise<void> {
    // バックアップファイル削除
    const { unlink } = await import('fs/promises')
    await Promise.all(
      this.backupPaths.map(async (backupPath) => {
        try {
          await unlink(backupPath)
        } catch {
          // バックアップ削除に失敗しても処理続行
        }
      })
    )
    
    this.backupPaths = []
    console.log(`✅ トランザクションコミット完了`)
  }
  
  // トランザクションロールバック
  async rollback(): Promise<void> {
    const { unlink } = await import('fs/promises')
    
    // 作成したファイルを削除
    await Promise.all(
      this.createdFiles.map(async (filePath) => {
        try {
          await unlink(filePath)
        } catch {
          // ファイル削除に失敗しても処理続行
        }
      })
    )
    
    // バックアップファイルから復元
    await Promise.all(
      this.backupPaths.map(async (backupPath) => {
        try {
          const originalPath = backupPath.replace(/\.backup\.\d+$/, '')
          await copyFile(backupPath, originalPath)
          await unlink(backupPath)
        } catch {
          // 復元に失敗しても処理続行
        }
      })
    )
    
    this.backupPaths = []
    this.createdFiles = []
    console.log(`⚠️ トランザクションロールバック完了`)
  }
}

// 便利関数：単一図番の処理
export async function createSingleDrawing(drawingData: NewDrawingData): Promise<{
  success: boolean
  data?: ProcessedDrawingData
  error?: string
}> {
  const transaction = new DataTransaction()
  
  try {
    const processedData = await transaction.processDrawingData(drawingData)
    await transaction.updateCompaniesFile(processedData)
    await transaction.updateSearchIndex(processedData)
    await transaction.commit()
    
    return { success: true, data: processedData }
  } catch (error) {
    await transaction.rollback()
    return { success: false, error: error instanceof Error ? error.message : '不明なエラー' }
  }
}

// 便利関数：複数図番の処理
export async function createMultipleDrawings(drawingsData: NewDrawingData[]): Promise<{
  success: boolean
  processed: ProcessedDrawingData[]
  errors: string[]
}> {
  const transaction = new DataTransaction()
  
  try {
    const result = await transaction.processMultipleDrawings(drawingsData)
    
    if (result.success) {
      await transaction.commit()
    } else {
      await transaction.rollback()
    }
    
    return result
  } catch (error) {
    await transaction.rollback()
    return {
      success: false,
      processed: [],
      errors: [error instanceof Error ? error.message : '不明なエラー']
    }
  }
}
