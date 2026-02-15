import { NextRequest, NextResponse } from 'next/server'
import { readdir } from 'fs/promises'
import { join, extname } from 'path'
import { existsSync } from 'fs'
import { createErrorResponse, createSuccessResponse, logError, createValidationError } from '@/lib/apiUtils'

const getDataRootPath = (): string => {
  // USE_NASの設定を最優先
  if (process.env.USE_NAS === 'true') {
    return process.env.DATA_ROOT_PATH || './public/data_demo'
  }
  
  // 開発用データパスを優先
  if (process.env.DEV_DATA_ROOT_PATH) {
    return process.env.DEV_DATA_ROOT_PATH
  }
  
  // 本番環境のデフォルト
  if (process.env.NODE_ENV === 'production') {
    return process.env.DATA_ROOT_PATH || './public/data_demo'
  }
  
  // 開発環境のデフォルト - 修正: data_test → data
  return join(process.cwd(), 'public', 'data')
}

const encodeRFC5987ValueChars = (str: string): string => {
  return encodeURIComponent(str)
    .replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%(7C|60|5E)/g, (match, hex) => `%${hex}`)
}

const buildContentDispositionHeader = (fileName: string): string => {
  const normalizedName = fileName.replace(/[/\\]/g, '')
  const asciiFallback = normalizedName.replace(/[^\x20-\x7E]/g, '_') || 'file'
  const encoded = encodeRFC5987ValueChars(normalizedName)
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const drawingNumber = searchParams.get('drawingNumber')
  const folderType = searchParams.get('folderType') // 'images', 'videos', 'pdfs'
  const subFolder = searchParams.get('subFolder') || ''
  
  // 加工アイデア用のパラメータ
  const ideaCategory = searchParams.get('ideaCategory')
  const ideaId = searchParams.get('ideaId')
  
  // 追加投稿ファイル用のパラメータ
  const contributionFile = searchParams.get('contributionFile')
  
  // 単一ファイル配信用のパラメータ
  const fileName = searchParams.get('fileName')

  try {
    console.log('API /api/files called with params:', {
      drawingNumber,
      folderType,
      subFolder,
      fileName
    })
    
    // 単一ファイル配信（優先処理）
    if (fileName && drawingNumber && folderType) {
      const dataRoot = getDataRootPath()
      const basePath = join(dataRoot, 'work-instructions', `drawing-${drawingNumber}`, folderType)
      const safePath = fileName.replace(/\.\./g, '').replace(/[<>"|*?]/g, '')
      const fullFilePath = subFolder 
        ? join(basePath, subFolder, safePath)
        : join(basePath, safePath)
      
      if (!existsSync(fullFilePath)) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }

      const { readFile } = await import('fs/promises')
      const fileBuffer = await readFile(fullFilePath)
      
      // ファイル拡張子からMIMEタイプを判定
      const ext = extname(fullFilePath).toLowerCase()
      let mimeType = 'application/octet-stream'
      
      if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg'
      else if (ext === '.png') mimeType = 'image/png'
      else if (ext === '.gif') mimeType = 'image/gif'
      else if (ext === '.webp') mimeType = 'image/webp'
      else if (['.tif', '.tiff'].includes(ext)) mimeType = 'image/tiff'
      else if (ext === '.jfif') mimeType = 'image/jpeg'
      else if (ext === '.mp4') mimeType = 'video/mp4'
      else if (ext === '.webm') mimeType = 'video/webm'
      else if (ext === '.avi') mimeType = 'video/avi'
      else if (ext === '.mov') mimeType = 'video/mov'
      else if (ext === '.wmv') mimeType = 'video/wmv'
      else if (ext === '.pdf') mimeType = 'application/pdf'

      const downloadName = safePath.split(/[\\/]/).pop() || safePath

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=3600',
          'Content-Disposition': buildContentDispositionHeader(downloadName)
        }
      })
    }

    // 追加投稿ファイルの単一配信（優先処理）
    if (contributionFile) {
      if (!drawingNumber) {
        return createValidationError('drawingNumber', '追加投稿ファイル配信には必須パラメータです', request.url)
      }
      
      // 追加投稿ファイルの直接配信
      const dataRoot = getDataRootPath()
      const contributionPath = join(dataRoot, 'work-instructions', `drawing-${drawingNumber}`, 'contributions')
      const safePath = contributionFile.replace(/\.\./g, '').replace(/[<>"|*?]/g, '')
      const fullFilePath = join(contributionPath, safePath)

      if (!existsSync(fullFilePath)) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }

      const { readFile } = await import('fs/promises')
      const fileBuffer = await readFile(fullFilePath)
      
      // ファイル拡張子からMIMEタイプを判定
      const ext = extname(fullFilePath).toLowerCase()
      let mimeType = 'application/octet-stream'
      
      if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg'
      else if (ext === '.png') mimeType = 'image/png'
      else if (ext === '.gif') mimeType = 'image/gif'
      else if (ext === '.webp') mimeType = 'image/webp'
      else if (['.tif', '.tiff'].includes(ext)) mimeType = 'image/tiff'
      else if (ext === '.jfif') mimeType = 'image/jpeg'
      else if (ext === '.mp4') mimeType = 'video/mp4'
      else if (ext === '.webm') mimeType = 'video/webm'
      else if (ext === '.avi') mimeType = 'video/avi'
      else if (ext === '.mov') mimeType = 'video/mov'
      else if (ext === '.pdf') mimeType = 'application/pdf'

      const downloadName = safePath.split(/[\\/]/).pop() || safePath

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=3600',
          'Content-Disposition': buildContentDispositionHeader(downloadName)
        }
      })
    }

    // パラメータの検証（通常のファイル一覧取得）
    if (!folderType) {
      return createValidationError('folderType', '必須パラメータです', request.url)
    }

    // 作業手順用と加工アイデア用でパラメータを分岐
    if (ideaCategory && ideaId) {
      // 加工アイデア用のパラメータ検証
      if (!ideaCategory || !ideaId) {
        return createValidationError('ideaCategory/ideaId', '両方とも必須パラメータです', request.url)
      }
    } else {
      // 作業手順用のパラメータ検証
      if (!drawingNumber) {
        return createValidationError('drawingNumber', '必須パラメータです', request.url)
      }
    }

    // データルートパスを取得
    const dataRoot = getDataRootPath()
    
    // パス構築を分岐
    let basePath: string
    let folderPath: string
    
    if (ideaCategory && ideaId) {
      // 加工アイデア用のパス構築
      basePath = join(dataRoot, 'ideas-library', ideaCategory, ideaId, folderType)
      folderPath = subFolder ? join(basePath, subFolder) : basePath
    } else {
      // 作業手順用のパス構築（既存）
      basePath = join(dataRoot, 'work-instructions', `drawing-${drawingNumber}`, folderType)
      folderPath = subFolder ? join(basePath, subFolder) : basePath
    }


    // フォルダが存在するかチェック
    if (!existsSync(folderPath)) {
      return NextResponse.json({ files: [] })
    }

    // フォルダ内のファイル一覧を取得
    const files = await readdir(folderPath)
    
    // ファイルのみをフィルタリング（ディレクトリは除外）
    const fileList = []
    for (const file of files) {
      const filePath = join(folderPath, file)
      const stats = await import('fs').then(fs => fs.promises.stat(filePath))
      if (stats.isFile()) {
        fileList.push(file)
      }
    }

    // ファイルタイプに応じてフィルタリング
    const filteredFiles = fileList.filter(file => {
      const extension = file.toLowerCase().split('.').pop()
      switch (folderType) {
        case 'images':
          return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tif', 'tiff', 'jfif'].includes(extension || '')
        case 'videos':
          return ['mp4', 'webm', 'avi', 'mov'].includes(extension || '')
        case 'pdfs':
          return extension === 'pdf'
        case 'programs':
          return ['nc', 'min', 'cam', 'dxf', 'dwg', 'stp', 'step', 'zip'].includes(extension || '')
        default:
          return true
      }
    })


    return createSuccessResponse({
      files: filteredFiles,
      folderPath: folderPath.replace(process.cwd(), ''),
      count: filteredFiles.length
    })

  } catch (error) {
    logError('ファイル一覧取得エラー', error, { 
      drawingNumber, 
      folderType, 
      ideaCategory, 
      ideaId
    })
    return createErrorResponse(
      'ファイル一覧の取得に失敗しました',
      500,
      error instanceof Error ? error.message : '不明なエラー',
      request.url
    )
  }
} 
