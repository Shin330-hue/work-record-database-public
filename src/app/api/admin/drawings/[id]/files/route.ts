// src/app/api/admin/drawings/[id]/files/route.ts - 図番ファイル管理API

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { getDataPath, createSafeFileName } from '@/lib/admin/utils'
import { getStepFolderName } from '@/lib/machineTypeUtils'
import { logAuditEvent, extractAuditActorFromHeaders } from '@/lib/auditLogger'


// ファイルアップロード
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: drawingNumber } = await params
    const actor = extractAuditActorFromHeaders(request.headers)
    
    if (!drawingNumber) {
      return NextResponse.json(
        { success: false, error: '図番が指定されていません' },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const stepNumber = formData.get('stepNumber') as string
    const fileType = formData.get('fileType') as string
    const machineType = formData.get('machineType') as string | null  // 機械種別を取得

    if (!file || !stepNumber || !fileType) {
      return NextResponse.json(
        { success: false, error: '必要なパラメータが不足しています' },
        { status: 400 }
      )
    }

    // ファイル検証
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'ファイルサイズが大きすぎます（50MB以下）' },
        { status: 400 }
      )
    }

    // ファイル名生成
    const fileName = createSafeFileName(file.name, { addTimestamp: true })
    
    // 保存先パス
    const dataPath = getDataPath()
    let subFolder: string
    
    if (stepNumber === '0') {
      subFolder = 'overview'
    } else {
      // 機械種別が指定されている場合は新形式、そうでない場合は旧形式
      subFolder = machineType 
        ? getStepFolderName(stepNumber, machineType)
        : `step_${stepNumber.padStart(2, '0')}`
    }
    
    const targetDir = path.join(
      dataPath,
      'work-instructions',
      `drawing-${drawingNumber}`,
      fileType,
      subFolder
    )
    
    // ディレクトリ作成
    await fs.mkdir(targetDir, { recursive: true })
    
    // ファイル保存
    const filePath = path.join(targetDir, fileName)
    const buffer = await file.arrayBuffer()
    await fs.writeFile(filePath, Buffer.from(buffer))

    // instruction.json更新
    await updateInstructionFile(drawingNumber, stepNumber, fileType, fileName)

    await logAuditEvent({
      action: 'drawing.files.upload',
      target: `${drawingNumber}:${fileName}`,
      actor,
      metadata: {
        drawingNumber,
        stepNumber,
        fileType,
        fileName,
        originalFileName: file.name,
        fileSize: file.size,
        machineType,
        source: 'admin/drawings/files',
      },
    })

    return NextResponse.json({
      success: true,
      fileName,
      message: 'ファイルがアップロードされました'
    })

  } catch (error) {
    console.error('ファイルアップロードエラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'アップロードに失敗しました' 
      },
      { status: 500 }
    )
  }
}

// ファイル削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: drawingNumber } = await params
    const actor = extractAuditActorFromHeaders(request.headers)
    const { fileName, stepNumber, fileType, machineType } = await request.json()

    console.log('削除リクエスト:', { drawingNumber, fileName, stepNumber, fileType })

    if (!drawingNumber || !fileName || stepNumber === undefined || !fileType) {
      return NextResponse.json(
        { success: false, error: '必要なパラメータが不足しています' },
        { status: 400 }
      )
    }

    // ファイル削除
    const dataPath = getDataPath()
    let subFolder: string
    if (stepNumber === '0' || stepNumber === 0) {
      subFolder = 'overview'
    } else if (machineType) {
      // 機械種別が指定されている場合は新形式
      subFolder = getStepFolderName(stepNumber, machineType)
    } else {
      // 後方互換性のための旧形式
      subFolder = `step_${String(stepNumber).padStart(2, '0')}`
    }
    
    const filePath = path.join(
      dataPath,
      'work-instructions',
      `drawing-${drawingNumber}`,
      fileType,
      subFolder,
      fileName
    )

    console.log('削除対象ファイルパス:', filePath)

    try {
      await fs.unlink(filePath)
      console.log('ファイル削除成功')
    } catch (unlinkError) {
      console.warn('ファイル削除エラー:', unlinkError)
      console.warn('ファイルパス:', filePath)
    }

    // instruction.json更新
    await removeFromInstructionFile(drawingNumber, stepNumber, fileType, fileName)

    await logAuditEvent({
      action: 'drawing.files.delete',
      target: `${drawingNumber}:${fileName}`,
      actor,
      metadata: {
        drawingNumber,
        stepNumber,
        fileType,
        fileName,
        machineType,
        source: 'admin/drawings/files',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'ファイルが削除されました'
    })

  } catch (error) {
    console.error('ファイル削除エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '削除に失敗しました' 
      },
      { status: 500 }
    )
  }
}

// instruction.jsonにファイルを追加
async function updateInstructionFile(
  drawingNumber: string, 
  stepNumber: string, 
  fileType: string, 
  fileName: string
) {
  const dataPath = getDataPath()
  const instructionPath = path.join(
    dataPath,
    'work-instructions',
    `drawing-${drawingNumber}`,
    'instruction.json'
  )

  try {
    const data = await fs.readFile(instructionPath, 'utf-8')
    const cleanData = data.replace(/^\uFEFF/, '') // BOM除去
    const instruction = JSON.parse(cleanData)

    if (stepNumber === '0') {
      // overview画像の場合
      if (!instruction.overview[fileType]) {
        instruction.overview[fileType] = []
      }
      instruction.overview[fileType].push(fileName)
    } else {
      // ステップ画像の場合
      const stepIndex = parseInt(stepNumber) - 1
      if (instruction.workSteps && instruction.workSteps[stepIndex]) {
        if (!instruction.workSteps[stepIndex][fileType]) {
          instruction.workSteps[stepIndex][fileType] = []
        }
        instruction.workSteps[stepIndex][fileType].push(fileName)
      }
    }

    await fs.writeFile(instructionPath, JSON.stringify(instruction, null, 2))
  } catch (updateError) {
    console.error('instruction.json更新エラー:', updateError)
  }
}

// instruction.jsonからファイルを削除
async function removeFromInstructionFile(
  drawingNumber: string, 
  stepNumber: string, 
  fileType: string, 
  fileName: string
) {
  const dataPath = getDataPath()
  const instructionPath = path.join(
    dataPath,
    'work-instructions',
    `drawing-${drawingNumber}`,
    'instruction.json'
  )

  try {
    const data = await fs.readFile(instructionPath, 'utf-8')
    const cleanData = data.replace(/^\uFEFF/, '') // BOM除去
    const instruction = JSON.parse(cleanData)

    if (stepNumber === '0') {
      // overview画像の場合
      if (instruction.overview[fileType]) {
        instruction.overview[fileType] = instruction.overview[fileType].filter(
          (f: string) => f !== fileName
        )
      }
    } else {
      // ステップ画像の場合
      const stepIndex = parseInt(stepNumber) - 1
      if (instruction.workSteps && instruction.workSteps[stepIndex] && instruction.workSteps[stepIndex][fileType]) {
        instruction.workSteps[stepIndex][fileType] = instruction.workSteps[stepIndex][fileType].filter(
          (f: string) => f !== fileName
        )
      }
    }

    await fs.writeFile(instructionPath, JSON.stringify(instruction, null, 2))
  } catch (updateError) {
    console.error('instruction.json更新エラー:', updateError)
  }
}
