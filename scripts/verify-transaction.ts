// scripts/verify-transaction.ts - トランザクション動作確認

import { promises as fs } from 'fs'
import path from 'path'

// 動作確認用の簡易実装（実際のクラスと同じロジック）
class SimpleTransaction {
  private createdDirs: string[] = []
  private createdFiles: string[] = []
  
  async createDir(dirPath: string) {
    console.log(`📁 ディレクトリ作成: ${dirPath}`)
    await fs.mkdir(dirPath, { recursive: true })
    this.createdDirs.push(dirPath)
  }
  
  async createFile(filePath: string, content: string) {
    console.log(`📄 ファイル作成: ${filePath}`)
    await fs.writeFile(filePath, content)
    this.createdFiles.push(filePath)
  }
  
  async rollback() {
    console.log('\n🔄 ロールバック開始...')
    
    // ファイル削除
    for (const file of this.createdFiles.reverse()) {
      try {
        await fs.unlink(file)
        console.log(`  ✅ ファイル削除: ${file}`)
      } catch (e) {
        console.log(`  ❌ ファイル削除失敗: ${file}`)
      }
    }
    
    // ディレクトリ削除
    for (const dir of this.createdDirs.reverse()) {
      try {
        await fs.rm(dir, { recursive: true, force: true })
        console.log(`  ✅ ディレクトリ削除: ${dir}`)
      } catch (e) {
        console.log(`  ❌ ディレクトリ削除失敗: ${dir}`)
      }
    }
  }
}

async function verifyTransactionBehavior() {
  const testPath = path.join(process.cwd(), 'test-verify')
  
  console.log('=== トランザクション動作確認 ===\n')
  
  try {
    // 1. 正常系：フォルダとファイル作成
    console.log('1️⃣ 正常系テスト')
    const transaction1 = new SimpleTransaction()
    
    const drawingPath = path.join(testPath, 'drawing-TEST-001')
    await transaction1.createDir(drawingPath)
    await transaction1.createDir(path.join(drawingPath, 'images'))
    await transaction1.createDir(path.join(drawingPath, 'videos'))
    
    const instructionPath = path.join(drawingPath, 'instruction.json')
    await transaction1.createFile(instructionPath, JSON.stringify({ test: true }, null, 2))
    
    // 確認
    console.log('\n✨ 作成されたファイル構造:')
    const exists = await fs.access(drawingPath).then(() => true).catch(() => false)
    console.log(`  - ${drawingPath}: ${exists ? '✅' : '❌'}`)
    
    // 2. ロールバックテスト
    console.log('\n2️⃣ ロールバックテスト')
    await transaction1.rollback()
    
    // 確認
    const existsAfter = await fs.access(drawingPath).then(() => true).catch(() => false)
    console.log(`\n🎯 ロールバック後の確認:`)
    console.log(`  - ${drawingPath}: ${existsAfter ? '❌ まだ存在' : '✅ 削除済み'}`)
    
    // 3. エラー時の動作確認
    console.log('\n3️⃣ エラー時の動作確認')
    const transaction2 = new SimpleTransaction()
    
    try {
      await transaction2.createDir(path.join(testPath, 'drawing-ERROR'))
      await transaction2.createFile(path.join(testPath, 'drawing-ERROR', 'test.json'), '{}')
      
      // エラーを発生させる
      throw new Error('意図的なエラー')
    } catch (e) {
      console.log(`\n⚠️ エラー発生: ${e instanceof Error ? e.message : String(e)}`)
      await transaction2.rollback()
    }
    
    // 最終確認
    const errorDirExists = await fs.access(path.join(testPath, 'drawing-ERROR')).then(() => true).catch(() => false)
    console.log(`\n🎯 エラー後の確認:`)
    console.log(`  - drawing-ERROR: ${errorDirExists ? '❌ まだ存在' : '✅ 削除済み'}`)
    
  } finally {
    // クリーンアップ
    try {
      await fs.rm(testPath, { recursive: true, force: true })
    } catch {}
  }
  
  console.log('\n=== 動作確認完了 ===')
}

// 実行
verifyTransactionBehavior().catch(console.error)