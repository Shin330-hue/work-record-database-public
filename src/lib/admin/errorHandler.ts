// src/lib/admin/errorHandler.ts - エラーハンドリング共通処理

import { NextResponse } from 'next/server'
import { ApiResponse, ApiError } from '@/types/admin-api'

/**
 * 成功レスポンスを生成
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function successResponse<T = any>(
  data: T, 
  status: number = 200
): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  }
  
  return NextResponse.json(response, { status })
}

/**
 * エラーレスポンスを生成
 */
export function errorResponse(
  error: string | Error | ApiError,
  status: number = 500,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any
): NextResponse {
  let errorMessage: string
  let errorCode: string = 'UNKNOWN_ERROR'
  
  if (typeof error === 'string') {
    errorMessage = error
  } else if (error instanceof Error) {
    errorMessage = error.message
    errorCode = error.name
  } else {
    errorMessage = error.message
    errorCode = error.code
    details = error.details || details
  }
  
  const response: ApiResponse = {
    success: false,
    error: errorMessage,
    details: process.env.NODE_ENV === 'development' ? details : undefined,
    timestamp: new Date().toISOString()
  }
  
  // エラーログ出力
  console.error(`[API Error] ${errorCode}: ${errorMessage}`, details)
  
  return NextResponse.json(response, { status })
}

/**
 * 非同期ハンドラーのエラーハンドリングラッパー
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withErrorHandling<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
): (...args: T) => Promise<NextResponse> {
  return async (...args: T) => {
    try {
      return await handler(...args)
    } catch (error) {
      console.error('Unhandled error in API route:', error)
      return errorResponse(
        error instanceof Error ? error : new Error('内部サーバーエラー'),
        500,
        error
      )
    }
  }
}

/**
 * 検証エラーレスポンス
 */
export function validationErrorResponse(
  errors: string[],
  status: number = 400
): NextResponse {
  return errorResponse(
    '入力データが不正です',
    status,
    { validationErrors: errors }
  )
}

/**
 * 認証エラーレスポンス
 */
export function unauthorizedResponse(
  message: string = '認証が必要です'
): NextResponse {
  return errorResponse(message, 401)
}

/**
 * 権限エラーレスポンス
 */
export function forbiddenResponse(
  message: string = 'アクセス権限がありません'
): NextResponse {
  return errorResponse(message, 403)
}

/**
 * リソース未検出エラーレスポンス
 */
export function notFoundResponse(
  resource: string = 'リソース'
): NextResponse {
  return errorResponse(`${resource}が見つかりません`, 404)
}