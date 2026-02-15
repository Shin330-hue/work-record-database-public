// src/app/api/files/[...path]/route.ts - ファイル配信エンドポイント

import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join, extname } from 'path'
import { existsSync } from 'fs'

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
  
  // 開発環境のデフォルト
  return join(process.cwd(), 'public', 'data')
}

// MIMEタイプ判定
const getMimeType = (filename: string): string => {
  const ext = extname(filename).toLowerCase()
  
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.jfif': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.avi': 'video/avi',
    '.mov': 'video/quicktime',
    '.pdf': 'application/pdf',
    '.nc': 'text/plain',
    '.min': 'text/plain',
    '.cam': 'text/plain',
    '.dxf': 'application/dxf',
    '.dwg': 'application/dwg',
    '.stp': 'application/stp',
    '.step': 'application/stp'
  }
  
  return mimeTypes[ext] || 'application/octet-stream'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params
    
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }
    
    // パスを結合
    const relativePath = pathSegments.join('/')
    
    // セキュリティ: パストラバーサル攻撃を防ぐ
    if (relativePath.includes('..') || relativePath.includes('~')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }
    
    // フルパスを構築
    const dataRoot = getDataRootPath()
    const fullPath = join(dataRoot, relativePath)
    
    // ファイルの存在確認
    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    // ファイル読み込み
    const fileBuffer = await readFile(fullPath)
    
    // MIMEタイプを判定
    const mimeType = getMimeType(relativePath)
    
    // レスポンスヘッダー設定
    const headers = new Headers({
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=3600',
      'Content-Length': fileBuffer.length.toString()
    })
    
    // 画像・動画の場合は範囲リクエストに対応
    if (mimeType.startsWith('video/')) {
      headers.set('Accept-Ranges', 'bytes')
      
      const range = request.headers.get('range')
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileBuffer.length - 1
        const chunksize = (end - start) + 1
        const chunk = fileBuffer.slice(start, end + 1)
        
        headers.set('Content-Range', `bytes ${start}-${end}/${fileBuffer.length}`)
        headers.set('Content-Length', chunksize.toString())
        
        return new NextResponse(chunk, { 
          status: 206,
          headers 
        })
      }
    }
    
    return new NextResponse(fileBuffer, { headers })
    
  } catch (error) {
    console.error('ファイル配信エラー:', error)
    return NextResponse.json(
      { 
        error: 'Failed to serve file',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}