import { NextRequest, NextResponse } from 'next/server'
import { 
  checkMultipleDrawingNumbers
} from '@/lib/drawingUtils'
import { 
  NewDrawingData
} from '@/lib/dataTransaction'
import { 
  processDrawingsWithTransaction 
} from '@/lib/drawingRegistrationTransaction'
import { logAuditEvent, extractAuditActorFromHeaders } from '@/lib/auditLogger'
import { normalizeMachineTypeInput, MachineTypeKey } from '@/lib/machineTypeUtils'

function resolveCurrentOrigin(request: NextRequest): string {
  try {
    return new URL(request.url).origin
  } catch {
    return (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
  }
}


// 入力データバリデーション
function validateDrawingData(data: NewDrawingData): { valid: boolean; errors: string[]; machineType: MachineTypeKey[] } {
  const errors: string[] = []
  
  // 必須フィールドチェック
  if (!data.drawingNumber?.trim()) {
    errors.push('図番は必須です')
  }
  
  if (!data.title?.trim()) {
    errors.push('タイトルは必須です')
  }
  
  if (!data.company?.name?.trim()) {
    errors.push('会社名は必須です')
  }
  
  if (!data.product?.name?.trim()) {
    errors.push('製品名は必須です')
  }
  
  if (!data.product?.category?.trim()) {
    errors.push('製品カテゴリは必須です')
  }
  
  const machineType = normalizeMachineTypeInput(data.machineType as string | string[] | MachineTypeKey[])
  if (machineType.length === 0) {
    errors.push('機械種別は必須です')
  }
  
  // 図番形式チェック
  if (data.drawingNumber && !/^[a-zA-Z0-9\-_]+$/.test(data.drawingNumber)) {
    errors.push('図番は英数字、ハイフン、アンダースコアのみ使用可能です')
  }
  
  // 推定時間の数値チェック
  if (data.estimatedTime && (isNaN(parseInt(data.estimatedTime)) || parseInt(data.estimatedTime) <= 0)) {
    errors.push('推定時間は正の数値で入力してください')
  }
  
  // 難易度の値チェック
  if (data.difficulty && !['初級', '中級', '上級'].includes(data.difficulty)) {
    errors.push('難易度は「初級」「中級」「上級」のいずれかを選択してください')
  }
  
  return {
    valid: errors.length === 0,
    errors,
    machineType
  }
}

// 複数件データのバリデーション
function validateMultipleDrawingInputs(drawings: NewDrawingData[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const drawingNumbers = new Set<string>()
  
  drawings.forEach((drawing, index) => {
    const validation = validateDrawingData(drawing)
    if (!validation.valid) {
      errors.push(`図番 ${index + 1}: ${validation.errors.join(', ')}`)
    }
    
    drawing.machineType = validation.machineType
    
    // 図番重複チェック（同一リクエスト内）
    if (drawing.drawingNumber) {
      if (drawingNumbers.has(drawing.drawingNumber)) {
        errors.push(`図番 ${drawing.drawingNumber} が重複しています`)
      }
      drawingNumbers.add(drawing.drawingNumber)
    }
  })
  
  return {
    valid: errors.length === 0,
    errors
  }
}

// POST: 新規図番登録
export async function POST(request: NextRequest) {
  try {
    // 認証チェックは画面側で実施済みのため、API側では不要
    const currentOrigin = resolveCurrentOrigin(request)
    
    const formData = await request.formData()
    const drawingsDataStr = formData.get('drawings') as string
    
    if (!drawingsDataStr) {
      return NextResponse.json(
        { error: '図番データが必要です' },
        { status: 400 }
      )
    }
    
    let drawingsData: NewDrawingData[]
    try {
      drawingsData = JSON.parse(drawingsDataStr)
    } catch {
      return NextResponse.json(
        { error: '図番データの形式が不正です' },
        { status: 400 }
      )
    }
    
    // 配列でない場合は配列に変換
    if (!Array.isArray(drawingsData)) {
      drawingsData = [drawingsData]
    }
    
    // 入力データバリデーション
    const validation = validateMultipleDrawingInputs(drawingsData)
    if (!validation.valid) {
      return NextResponse.json(
        { error: '入力データが不正です', details: validation.errors },
        { status: 400 }
      )
    }
    
    // 既存図番の重複チェック
    const drawingNumbers = drawingsData.map(d => d.drawingNumber)
    const duplicates = await checkMultipleDrawingNumbers(drawingNumbers)
    if (duplicates.length > 0) {
      return NextResponse.json(
        { error: '図番が既に存在します', duplicates },
        { status: 409 }
      )
    }
    
    // 新しいトランザクション処理を使用
    const transactionResult = await processDrawingsWithTransaction(drawingsData)
    
    if (!transactionResult.success) {
      // エラー時は全てロールバック済み
      return NextResponse.json(
        { 
          error: 'データ処理中にエラーが発生しました', 
          details: transactionResult.errors,
          logs: process.env.NODE_ENV === 'development' ? transactionResult.logs : undefined
        },
        { status: 500 }
      )
    }
    
    // 成功した図番のPDF/プログラムファイル処理（オプショナル）
    const actor = extractAuditActorFromHeaders(request.headers)

    const auditPromises = transactionResult.processed.map(processedData =>
      logAuditEvent({
        action: 'drawing.create',
        target: processedData.drawingNumber,
        actor,
        metadata: {
          title: processedData.title,
          companyId: processedData.companyId,
          companyName: processedData.companyName,
          productId: processedData.productId,
          productName: processedData.productName,
          source: 'admin/drawings/new'
        }
      })
    )
    await Promise.all(auditPromises)

    const processResults: Array<{
      drawingNumber: string
      success: boolean
      error?: string
      fileUploads?: {
        pdf?: { success: boolean; count: number }
        program?: { success: boolean; count: number }
      }
    }> = []
    
    for (const processedData of transactionResult.processed) {
      const result: typeof processResults[0] = {
        drawingNumber: processedData.drawingNumber,
        success: true,
        fileUploads: {}
      }
      
      try {
        // PDFファイル処理（複数対応）
        const pdfFiles: File[] = []
        let pdfIndex = 0
        while (formData.has(`pdf_${processedData.drawingNumber}_${pdfIndex}`)) {
          const pdfFile = formData.get(`pdf_${processedData.drawingNumber}_${pdfIndex}`) as File
          if (pdfFile && pdfFile.size > 0) {
            pdfFiles.push(pdfFile)
          }
          pdfIndex++
        }
        
        // PDFファイルがある場合は新しい一括アップロードAPIを使用
        if (pdfFiles.length > 0) {
          const uploadFormData = new FormData()
          uploadFormData.append('stepNumber', '0') // overview
          pdfFiles.forEach(file => {
            uploadFormData.append('files', file)
          })
          
          // 内部的に一括アップロードAPIを呼び出し
          const uploadResponse = await fetch(
            `${currentOrigin}/api/admin/drawings/${processedData.drawingNumber}/files/batch`,
            {
              method: 'POST',
              body: uploadFormData
            }
          )
          
          if (uploadResponse.ok) {
            result.fileUploads!.pdf = { success: true, count: pdfFiles.length }
          } else {
            // エラーの詳細をログ出力
            const errorText = await uploadResponse.text()
            console.error(`PDFアップロードエラー: ${processedData.drawingNumber}`, {
              status: uploadResponse.status,
              statusText: uploadResponse.statusText,
              error: errorText
            })
            result.fileUploads!.pdf = { success: false, count: 0 }
          }
        }
        
        // プログラムファイル処理（複数対応）
        const programFiles: File[] = []
        let programIndex = 0
        while (formData.has(`program_${processedData.drawingNumber}_${programIndex}`)) {
          const programFile = formData.get(`program_${processedData.drawingNumber}_${programIndex}`) as File
          if (programFile && programFile.size > 0) {
            programFiles.push(programFile)
          }
          programIndex++
        }
        
        // プログラムファイルがある場合も一括アップロードAPIを使用
        if (programFiles.length > 0) {
          const uploadFormData = new FormData()
          uploadFormData.append('stepNumber', '0') // overview
          programFiles.forEach(file => {
            uploadFormData.append('files', file)
          })
          
          const uploadResponse = await fetch(
            `${currentOrigin}/api/admin/drawings/${processedData.drawingNumber}/files/batch`,
            {
              method: 'POST',
              body: uploadFormData
            }
          )
          
          if (uploadResponse.ok) {
            result.fileUploads!.program = { success: true, count: programFiles.length }
          } else {
            const errorText = await uploadResponse.text()
            console.error(`プログラムファイルアップロードエラー: ${processedData.drawingNumber}`, {
              status: uploadResponse.status,
              statusText: uploadResponse.statusText,
              error: errorText
            })
            result.fileUploads!.program = { success: false, count: 0 }
          }
        }
        
      } catch (error) {
        console.error(`ファイルアップロード処理エラー (${processedData.drawingNumber}):`, error)
      }
      
      processResults.push(result)
    }
    
    // 3. 整合性チェック
    const { validateMultipleDrawings } = await import('@/lib/drawingUtils')
    const validationResult = await validateMultipleDrawings(
      transactionResult.processed.map(p => p.drawingNumber)
    )
    
    // 4. 成功・失敗のサマリー
    const response = {
      success: true, // 図番登録自体は成功
      summary: {
        total: drawingsData.length,
        successful: transactionResult.processed.length,
        failed: 0
      },
      results: processResults,
      validation: validationResult,
      transactionLogs: process.env.NODE_ENV === 'development' ? transactionResult.logs : undefined
    }
    
    return NextResponse.json(response, { status: 201 })
    
  } catch (error) {
    console.error('図番登録API エラー:', error)
    return NextResponse.json(
      { error: '内部サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

// GET: 図番一覧取得（管理画面用）
export async function GET(request: NextRequest) {
  try {
    // 認証チェックは画面側で実施済みのため、API側では不要
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    
    // 検索インデックスから図番一覧を取得
    const { loadSearchIndex, loadCompanies } = await import('@/lib/dataLoader')
    const searchIndex = await loadSearchIndex()
    const companies = await loadCompanies()
    
    let drawings = searchIndex.drawings
    
    // 検索フィルタ
    if (search) {
      drawings = drawings.filter(drawing => 
        drawing.drawingNumber.toLowerCase().includes(search.toLowerCase()) ||
        drawing.title.toLowerCase().includes(search.toLowerCase()) ||
        drawing.productName.toLowerCase().includes(search.toLowerCase()) ||
        drawing.companyName.toLowerCase().includes(search.toLowerCase())
      )
    }
    
    // ページネーション
    const offset = (page - 1) * limit
    const paginatedDrawings = drawings.slice(offset, offset + limit)
    
    return NextResponse.json({
      drawings: paginatedDrawings,
      pagination: {
        page,
        limit,
        total: drawings.length,
        totalPages: Math.ceil(drawings.length / limit)
      },
      companies: companies.map(c => ({ id: c.id, name: c.name }))
    })
    
  } catch (error) {
    console.error('図番一覧取得API エラー:', error)
    return NextResponse.json(
      { error: '内部サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
