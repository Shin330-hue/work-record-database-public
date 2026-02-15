// src/types/admin-api.ts - 管理画面API共通型定義

/**
 * API共通レスポンス型
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any
  timestamp?: string
}

/**
 * エラーレスポンス型
 */
export interface ApiError {
  code: string
  message: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any
  statusCode?: number
}

/**
 * ページネーション情報
 */
export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

/**
 * ファイルアップロードレスポンス
 */
export interface FileUploadResponse {
  fileName: string
  originalName: string
  size: number
  fileType: 'images' | 'videos' | 'pdfs' | 'programs'
  message?: string
}

/**
 * バッチ処理レスポンス
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface BatchResponse<T = any> {
  success: boolean
  summary: {
    total: number
    successful: number
    failed: number
  }
  results: Array<{
    id: string
    success: boolean
    data?: T
    error?: string
  }>
}

/**
 * 検証結果
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}