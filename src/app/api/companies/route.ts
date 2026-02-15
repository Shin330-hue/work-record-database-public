// src/app/api/companies/route.ts - 会社データAPI

import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { getDataPath } from '@/lib/admin/utils'

export async function GET() {
  try {
    // ファイルパスの構築
    const dataPath = getDataPath()
    const filePath = path.join(dataPath, 'companies.json')

    // ファイルの読み込み
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(fileContent)
      
      // キャッシュ制御ヘッダーを設定（キャッシュを無効化）
      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    } catch (error) {
      console.error('会社データ読み込みエラー:', error)
      return NextResponse.json(
        { companies: [] },
        { 
          status: 200,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      )
    }
  } catch (error) {
    console.error('会社データ取得エラー:', error)
    return NextResponse.json(
      { error: '会社データの取得に失敗しました' },
      { status: 500 }
    )
  }
}