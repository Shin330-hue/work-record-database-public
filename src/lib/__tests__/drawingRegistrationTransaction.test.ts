// src/lib/__tests__/drawingRegistrationTransaction.test.ts
// DrawingRegistrationTransactionクラスのテスト

import { promises as fs } from 'fs'
import path from 'path'
import { DrawingRegistrationTransaction, processDrawingsWithTransaction } from '../drawingRegistrationTransaction'
import { NewDrawingData } from '../dataTransaction'

// テスト用のデータパス
const TEST_DATA_PATH = path.join(process.cwd(), 'test-data')

// テスト前後の処理
beforeAll(async () => {
  // テスト用ディレクトリ作成
  await fs.mkdir(TEST_DATA_PATH, { recursive: true })
  
  // 環境変数設定
  process.env.DEV_DATA_ROOT_PATH = TEST_DATA_PATH
  process.env.USE_NAS = 'false'
})

afterAll(async () => {
  // テスト用ディレクトリ削除
  try {
    await fs.rm(TEST_DATA_PATH, { recursive: true, force: true })
  } catch {
    // エラーは無視
  }
})

// 各テスト前の処理
beforeEach(async () => {
  // companies.jsonとsearch-index.jsonを初期化
  const companies = {
    companies: [],
    metadata: {
      lastUpdated: new Date().toISOString(),
      version: '1.0.0'
    }
  }
  const searchIndex = {
    drawings: [],
    metadata: {
      totalDrawings: 0,
      lastIndexed: new Date().toISOString(),
      version: '1.0'
    }
  }
  
  await fs.writeFile(
    path.join(TEST_DATA_PATH, 'companies.json'),
    JSON.stringify(companies, null, 2)
  )
  await fs.writeFile(
    path.join(TEST_DATA_PATH, 'search-index.json'),
    JSON.stringify(searchIndex, null, 2)
  )
})

describe('DrawingRegistrationTransaction', () => {
  // テストデータ
  const testDrawingData: NewDrawingData = {
    drawingNumber: 'TEST-001',
    title: 'テスト部品',
    company: {
      type: 'new',
      id: 'test-company',
      name: 'テスト会社'
    },
    product: {
      type: 'new',
      id: 'test-product',
      name: 'テスト製品',
      category: 'テストカテゴリ'
    },
    difficulty: '中級',
    estimatedTime: '60',
    machineType: ['turning'],
    description: 'テスト説明',
    warnings: ['テスト警告1', 'テスト警告2']
  }

  describe('正常系', () => {
    test('単一図番の登録が成功する', async () => {
      const transaction = new DrawingRegistrationTransaction()
      
      // 図番処理
      const processedData = await transaction.processSingleDrawing(testDrawingData)
      
      // フォルダが作成されているか確認
      const drawingPath = path.join(TEST_DATA_PATH, 'work-instructions', `drawing-${testDrawingData.drawingNumber}`)
      expect(await fs.access(drawingPath).then(() => true).catch(() => false)).toBe(true)
      
      // instruction.jsonが作成されているか確認
      const instructionPath = path.join(drawingPath, 'instruction.json')
      expect(await fs.access(instructionPath).then(() => true).catch(() => false)).toBe(true)
      
      // JSONファイル更新
      await transaction.updateJsonFiles([processedData])
      
      // コミット
      await transaction.commit()
      
      // companies.jsonが更新されているか確認
      const companiesContent = await fs.readFile(path.join(TEST_DATA_PATH, 'companies.json'), 'utf-8')
      const companies = JSON.parse(companiesContent)
      expect(companies.companies).toHaveLength(1)
      expect(companies.companies[0].id).toBe('test-company')
    })

    test('複数図番の一括登録が成功する', async () => {
      const multipleDrawings: NewDrawingData[] = [
        { ...testDrawingData, drawingNumber: 'TEST-001' },
        { ...testDrawingData, drawingNumber: 'TEST-002' },
        { ...testDrawingData, drawingNumber: 'TEST-003' }
      ]
      
      const result = await processDrawingsWithTransaction(multipleDrawings)
      
      expect(result.success).toBe(true)
      expect(result.processed).toHaveLength(3)
      expect(result.errors).toHaveLength(0)
      
      // 全ての図番のフォルダが作成されているか確認
      for (const drawing of multipleDrawings) {
        const drawingPath = path.join(TEST_DATA_PATH, 'work-instructions', `drawing-${drawing.drawingNumber}`)
        expect(await fs.access(drawingPath).then(() => true).catch(() => false)).toBe(true)
      }
    })
  })

  describe('異常系とロールバック', () => {
    test('フォルダ作成失敗時にロールバックされる', async () => {
      // 読み取り専用ディレクトリを作成してエラーを発生させる
      const readOnlyPath = path.join(TEST_DATA_PATH, 'work-instructions')
      await fs.mkdir(readOnlyPath, { recursive: true })
      
      // Windows環境では読み取り専用属性の設定が難しいため、
      // 既存ファイルでディレクトリ作成を妨げる
      const blockingFilePath = path.join(readOnlyPath, 'drawing-TEST-001')
      await fs.writeFile(blockingFilePath, 'blocking file')
      
      const transaction = new DrawingRegistrationTransaction()
      
      try {
        await transaction.processSingleDrawing(testDrawingData)
        fail('エラーが発生するはずです')
      } catch (error) {
        // エラーが発生することを確認
        expect(error).toBeDefined()
      }
      
      // ロールバック
      await transaction.rollback()
      
      // companies.jsonが変更されていないことを確認
      const companiesContent = await fs.readFile(path.join(TEST_DATA_PATH, 'companies.json'), 'utf-8')
      const companies = JSON.parse(companiesContent)
      expect(companies.companies).toHaveLength(0)
    })

    test('JSONファイル更新失敗時に全てロールバックされる', async () => {
      const transaction = new DrawingRegistrationTransaction()
      
      // 正常に図番処理
      const processedData = await transaction.processSingleDrawing(testDrawingData)
      
      // companies.jsonを削除してエラーを発生させる
      await fs.unlink(path.join(TEST_DATA_PATH, 'companies.json'))
      
      try {
        await transaction.updateJsonFiles([processedData])
        fail('エラーが発生するはずです')
      } catch (error) {
        // エラーが発生することを確認
        expect(error).toBeDefined()
      }
      
      // ロールバック
      await transaction.rollback()
      
      // フォルダが削除されているか確認
      const drawingPath = path.join(TEST_DATA_PATH, 'work-instructions', `drawing-${testDrawingData.drawingNumber}`)
      expect(await fs.access(drawingPath).then(() => true).catch(() => false)).toBe(false)
    })

    test('複数図番登録で1つ失敗した場合、全てロールバックされる', async () => {
      const multipleDrawings: NewDrawingData[] = [
        { ...testDrawingData, drawingNumber: 'TEST-001' },
        { ...testDrawingData, drawingNumber: 'TEST-002' },
        { ...testDrawingData, drawingNumber: '' } // 無効な図番でエラーを発生させる
      ]
      
      const result = await processDrawingsWithTransaction(multipleDrawings)
      
      expect(result.success).toBe(false)
      expect(result.processed).toHaveLength(0)
      expect(result.errors.length).toBeGreaterThan(0)
      
      // 全ての図番のフォルダが作成されていないことを確認
      for (let i = 0; i < 2; i++) {
        const drawingPath = path.join(TEST_DATA_PATH, 'work-instructions', `drawing-TEST-00${i + 1}`)
        expect(await fs.access(drawingPath).then(() => true).catch(() => false)).toBe(false)
      }
      
      // JSONファイルが更新されていないことを確認
      const companiesContent = await fs.readFile(path.join(TEST_DATA_PATH, 'companies.json'), 'utf-8')
      const companies = JSON.parse(companiesContent)
      expect(companies.companies).toHaveLength(0)
    })
  })

  describe('トランザクションログ', () => {
    test('操作履歴が正しく記録される', async () => {
      const transaction = new DrawingRegistrationTransaction()
      
      await transaction.processSingleDrawing(testDrawingData)
      await transaction.updateJsonFiles([await transaction.processSingleDrawing(testDrawingData)])
      await transaction.commit()
      
      const logs = transaction.getTransactionLogs()
      
      // ログが記録されているか確認
      expect(logs.length).toBeGreaterThan(0)
      
      // 主要な操作が含まれているか確認
      const operations = logs.map(log => log.operation)
      expect(operations).toContain('create_dir')
      expect(operations).toContain('create_file')
      expect(operations).toContain('update_file')
    })
  })
})

// テスト実行用のスクリプト
if (require.main === module) {
  console.log('テストを実行するには、以下のコマンドを使用してください:')
  console.log('npm test -- src/lib/__tests__/drawingRegistrationTransaction.test.ts')
}
