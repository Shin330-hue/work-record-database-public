// src/lib/admin/utils.ts - 管理画面共通ユーティリティ

import path from 'path'

/**
 * 環境に応じたデータパスを取得
 * @returns データルートパス
 */
export const getDataPath = (): string => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.DATA_ROOT_PATH || './public/data_demo'
  }
  
  if (process.env.USE_NAS === 'true') {
    return process.env.DATA_ROOT_PATH || './public/data_demo'
  }
  
  return process.env.DEV_DATA_ROOT_PATH || './public/data'
}

/**
 * 図番をサニタイズ（安全な文字のみに変換）
 * @param drawingNumber 図番
 * @returns サニタイズされた図番
 */
export const sanitizeDrawingNumber = (drawingNumber: string): string => {
  return drawingNumber.replace(/[^a-zA-Z0-9\-_]/g, '')
}

/**
 * ファイル名をサニタイズ
 * @param fileName ファイル名
 * @returns サニタイズされたファイル名
 */
export const sanitizeFileName = (fileName: string): string => {
  if (!fileName) return 'unnamed'

  // パスセパレータを除去
  let sanitized = fileName.replace(/[\/\\]/g, '_')

  // 全角スペースを含む空白を半角スペースに統一し、連続スペースを単一アンダースコアへ
  sanitized = sanitized.replace(/[\s\u3000]+/g, ' ')
  sanitized = sanitized.replace(/\s+/g, '_')

  // 特殊文字を除去（日本語は保持）
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1F]/g, '')

  // 先頭・末尾の空白（アンダースコア含む）とドットを除去
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '')

  if (!sanitized) {
    sanitized = 'unnamed'
  }

  // ファイル名長を制限（拡張子込みで255未満に収めるため）
  const MAX_LENGTH = 120
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.slice(0, MAX_LENGTH)
  }

  return sanitized
}


export const createSafeFileName = (
  originalName: string,
  options?: { addTimestamp?: boolean }
): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const ext = path.extname(originalName)
  const base = path.basename(originalName, ext)

  const sanitizedBase = sanitizeFileName(base)
  const sanitizedExt = ext ? sanitizeFileName(ext.replace(/^\./, '')) : ''
  const safeExt = sanitizedExt ? `.${sanitizedExt}` : ext

  const baseLengthLimit = 200 - (safeExt?.length || 0)
  const finalBase = sanitizedBase.slice(0, Math.max(1, baseLengthLimit))

  return options?.addTimestamp
    ? `${timestamp}-${finalBase}${safeExt || ''}`
    : `${finalBase}${safeExt || ''}`
}

/**
 * ファイルサイズを人間が読みやすい形式に変換
 * @param bytes バイト数
 * @returns フォーマットされたサイズ
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * タイムスタンプ付きファイル名を生成
 * @param originalName 元のファイル名
 * @param extension 拡張子（ドット付き）
 * @returns タイムスタンプ付きファイル名
 */
export const generateTimestampedFileName = (originalName: string, extension: string): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const baseName = originalName.replace(extension, '')
  return `${timestamp}-${sanitizeFileName(baseName)}${extension}`
}

/**
 * プログラムファイルの拡張子リスト
 */
export const PROGRAM_EXTENSIONS = [
  '.nc', '.txt', '.tap', '.pgm', '.mpf',
  '.ptp', '.gcode', '.cnc', '.min', '.eia',
  '.dxf', '.dwg', '.mcam', '.zip', '.stp', '.step'
] as const

/**
 * 画像ファイルの拡張子リスト
 */
export const IMAGE_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tif', '.tiff', '.jfif'
] as const

/**
 * 動画ファイルの拡張子リスト
 */
export const VIDEO_EXTENSIONS = [
  '.mp4', '.avi', '.mov', '.wmv', '.webm'
] as const

/**
 * ファイルタイプを判定
 * @param fileName ファイル名
 * @param mimeType MIMEタイプ
 * @returns ファイルタイプ
 */
export const determineFileType = (
  fileName: string, 
  mimeType: string
): 'images' | 'videos' | 'pdfs' | 'programs' | 'unknown' => {
  const lowerName = fileName.toLowerCase()
  
  // PDF判定
  if (mimeType.includes('pdf') || lowerName.endsWith('.pdf')) {
    return 'pdfs'
  }
  
  // プログラムファイル判定
  if (PROGRAM_EXTENSIONS.some(ext => lowerName.endsWith(ext))) {
    return 'programs'
  }
  
  // 画像判定
  if (mimeType.startsWith('image/') || IMAGE_EXTENSIONS.some(ext => lowerName.endsWith(ext))) {
    return 'images'
  }
  
  // 動画判定
  if (mimeType.startsWith('video/') || VIDEO_EXTENSIONS.some(ext => lowerName.endsWith(ext))) {
    return 'videos'
  }
  
  return 'unknown'
}
