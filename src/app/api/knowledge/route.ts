import { NextRequest, NextResponse } from 'next/server'
import { searchKnowledgeBase, formatSearchResults } from '@/lib/knowledge-search'

/**
 * 社内データ検索API
 * 既存システムから完全独立・読み取り専用
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''
  const historyParam = searchParams.get('history') || ''
  
  // 会話履歴を配列に変換
  const conversationHistory = historyParam ? historyParam.split('|') : []
  
  try {
    // 社内データベースを検索
    const results = await searchKnowledgeBase(query, conversationHistory)
    
    return NextResponse.json({
      success: true,
      query,
      results,
      formattedContext: formatSearchResults(results),
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Knowledge API error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      query,
      results: {
        companies: [],
        drawings: [],
        contributions: [],
        statistics: {
          totalCompanies: 0,
          totalDrawings: 0,
          totalContributions: 0,
          searchTerms: [],
          processingTimeMs: 0
        }
      },
      formattedContext: '',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * テスト用のPOSTエンドポイント
 */
export async function POST(request: NextRequest) {
  try {
    const { query, conversationHistory = [] } = await request.json()
    
    if (!query) {
      return NextResponse.json({
        success: false,
        error: 'Query parameter is required'
      }, { status: 400 })
    }
    
    const results = await searchKnowledgeBase(query, conversationHistory)
    
    return NextResponse.json({
      success: true,
      query,
      results,
      formattedContext: formatSearchResults(results),
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Knowledge POST error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}