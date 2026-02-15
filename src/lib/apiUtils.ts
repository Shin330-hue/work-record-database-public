// src/lib/apiUtils.ts - API共通ユーティリティ
import { NextResponse } from 'next/server'

// 標準エラーレスポンス形式
export interface ApiErrorResponse {
  error: string
  details?: string
  timestamp: string
  path?: string
}

// 標準成功レスポンス形式
export interface ApiSuccessResponse<T = unknown> {
  success: true
  data: T
  timestamp: string
}

// エラーレスポンス生成
export function createErrorResponse(
  message: string,
  status: number = 500,
  details?: string,
  path?: string
): NextResponse {
  const errorResponse: ApiErrorResponse = {
    error: message,
    details,
    timestamp: new Date().toISOString(),
    path
  }

  // 本番環境では詳細なエラー情報を非表示
  if (process.env.NODE_ENV === 'production' && status === 500) {
    delete errorResponse.details
  }

  return NextResponse.json(errorResponse, { status })
}

// 成功レスポンス生成
export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): NextResponse {
  const successResponse: ApiSuccessResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  }

  return NextResponse.json(successResponse, { status })
}

// エラーログ出力（環境に応じた制御）
export function logError(
  message: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : '不明なエラー'
  const errorStack = error instanceof Error ? error.stack : undefined

  if (process.env.NODE_ENV === 'development') {
    console.error('❌', message, {
      error: errorMessage,
      stack: errorStack,
      context
    })
  } else {
    // 本番環境では簡潔なログ
    console.error('API Error:', message, errorMessage)
  }
}

// バリデーションエラー
export function createValidationError(
  field: string,
  message: string,
  path?: string
): NextResponse {
  return createErrorResponse(
    `${field}: ${message}`,
    400,
    'バリデーションエラー',
    path
  )
}