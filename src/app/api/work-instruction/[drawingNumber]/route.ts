import { normalizeMachineTypeInput } from '@/lib/machineTypeUtils'
// src/app/api/work-instruction/[drawingNumber]/route.ts - 作業手順データAPI

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { getDataPath } from '@/lib/admin/utils'
import { sanitizeDrawingNumber } from '@/lib/dataLoader'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ drawingNumber: string }> }
) {
  try {
    const { drawingNumber } = await context.params
    
    if (!drawingNumber) {
      return NextResponse.json(
        { error: '図番が指定されていません' },
        { status: 400 }
      )
    }

    // 図番のサニタイズ
    const safeDrawingNumber = sanitizeDrawingNumber(drawingNumber)
    
    // ファイルパスの構築
    const dataPath = getDataPath()
    const filePath = path.join(
      dataPath,
      'work-instructions',
      `drawing-${safeDrawingNumber}`,
      'instruction.json'
    )

    // ファイルの存在確認と読み込み
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const workInstruction = JSON.parse(fileContent)
      workInstruction.metadata = {
        ...workInstruction.metadata,
        machineType: normalizeMachineTypeInput(workInstruction.metadata?.machineType)
      }

      // キャッシュ制御ヘッダーを設定（キャッシュを無効化）
      return NextResponse.json(workInstruction, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    } catch {
      return NextResponse.json(
        { error: `図番 ${drawingNumber} の作業手順が見つかりません` },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('作業手順データ取得エラー:', error)
    return NextResponse.json(
      { error: '作業手順データの取得に失敗しました' },
      { status: 500 }
    )
  }
}



