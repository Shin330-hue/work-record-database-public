// scripts/test-transaction.js - DrawingRegistrationTransactionの簡易テスト

const { promises: fs } = require('fs')
const path = require('path')

// テスト用のデータパス
const TEST_DATA_PATH = path.join(process.cwd(), 'test-data-manual')

// 色付きコンソール出力
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`
}

// テスト結果
let passedTests = 0
let failedTests = 0

// テスト関数
async function test(name, fn) {
  try {
    console.log(`\nテスト: ${name}`)
    await fn()
    console.log(colors.green('✓ 成功'))
    passedTests++
  } catch (error) {
    console.log(colors.red('✗ 失敗'))
    console.error(colors.red(`  エラー: ${error.message}`))
    failedTests++
  }
}

// アサーション関数
function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`期待値: ${expected}, 実際: ${actual}`)
      }
    },
    toBeTrue() {
      if (actual !== true) {
        throw new Error(`期待値: true, 実際: ${actual}`)
      }
    },
    toBeFalse() {
      if (actual !== false) {
        throw new Error(`期待値: false, 実際: ${actual}`)
      }
    },
    toBeGreaterThan(expected) {
      if (!(actual > expected)) {
        throw new Error(`${actual} が ${expected} より大きいことを期待`)
      }
    }
  }
}

// メインテスト実行
async function runTests() {
  console.log(colors.blue('=== DrawingRegistrationTransaction テスト開始 ===\n'))
  
  // 環境変数設定
  process.env.DEV_DATA_ROOT_PATH = TEST_DATA_PATH
  process.env.USE_NAS = 'false'
  
  try {
    // テスト用ディレクトリ作成
    await fs.mkdir(TEST_DATA_PATH, { recursive: true })
    
    // 初期JSONファイル作成
    const companies = {
      companies: [],
      metadata: { lastUpdated: new Date().toISOString(), version: '1.0.0' }
    }
    const searchIndex = {
      drawings: [],
      metadata: { totalDrawings: 0, lastIndexed: new Date().toISOString(), version: '1.0' }
    }
    
    await fs.writeFile(
      path.join(TEST_DATA_PATH, 'companies.json'),
      JSON.stringify(companies, null, 2)
    )
    await fs.writeFile(
      path.join(TEST_DATA_PATH, 'search-index.json'),
      JSON.stringify(searchIndex, null, 2)
    )
    
    // モジュールをrequire（ビルド後のJSファイルを使用）
    const { DrawingRegistrationTransaction, processDrawingsWithTransaction } = require('../src/lib/drawingRegistrationTransaction')
    
    // テストデータ
    const testDrawingData = {
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
    
    // テスト1: 基本的なフォルダ作成
    await test('フォルダ構造が作成される', async () => {
      const transaction = new DrawingRegistrationTransaction()
      await transaction.createDrawingStructure('TEST-001')
      
      const drawingPath = path.join(TEST_DATA_PATH, 'work-instructions', 'drawing-TEST-001')
      const exists = await fs.access(drawingPath).then(() => true).catch(() => false)
      expect(exists).toBeTrue()
      
      // サブフォルダも確認
      const imagePath = path.join(drawingPath, 'images')
      const imageExists = await fs.access(imagePath).then(() => true).catch(() => false)
      expect(imageExists).toBeTrue()
    })
    
    // テスト2: instruction.json作成
    await test('instruction.jsonが作成される', async () => {
      const transaction = new DrawingRegistrationTransaction()
      const processedData = await transaction.processSingleDrawing(testDrawingData)
      
      const instructionPath = path.join(
        TEST_DATA_PATH,
        'work-instructions',
        'drawing-TEST-001',
        'instruction.json'
      )
      const exists = await fs.access(instructionPath).then(() => true).catch(() => false)
      expect(exists).toBeTrue()
      
      // 内容も確認
      const content = JSON.parse(await fs.readFile(instructionPath, 'utf-8'))
      expect(content.metadata.drawingNumber).toBe('TEST-001')
      expect(content.metadata.title).toBe('テスト部品')
    })
    
    // テスト3: ロールバックテスト
    await test('エラー時にロールバックされる', async () => {
      // クリーンアップ
      await fs.rm(path.join(TEST_DATA_PATH, 'work-instructions'), { recursive: true, force: true }).catch(() => {})
      
      const transaction = new DrawingRegistrationTransaction()
      
      // 図番処理（成功する）
      const processedData = await transaction.processSingleDrawing({
        ...testDrawingData,
        drawingNumber: 'TEST-ROLLBACK'
      })
      
      // フォルダが作成されたことを確認
      const drawingPath = path.join(TEST_DATA_PATH, 'work-instructions', 'drawing-TEST-ROLLBACK')
      const existsBefore = await fs.access(drawingPath).then(() => true).catch(() => false)
      expect(existsBefore).toBeTrue()
      
      // ロールバック実行
      await transaction.rollback()
      
      // フォルダが削除されたことを確認
      const existsAfter = await fs.access(drawingPath).then(() => true).catch(() => false)
      expect(existsAfter).toBeFalse()
    })
    
    // テスト4: 複数図番の処理
    await test('複数図番が正しく処理される', async () => {
      const multipleDrawings = [
        { ...testDrawingData, drawingNumber: 'MULTI-001' },
        { ...testDrawingData, drawingNumber: 'MULTI-002' }
      ]
      
      const result = await processDrawingsWithTransaction(multipleDrawings)
      
      expect(result.success).toBeTrue()
      expect(result.processed.length).toBe(2)
      expect(result.errors.length).toBe(0)
      
      // 両方のフォルダが作成されているか確認
      for (const drawing of multipleDrawings) {
        const drawingPath = path.join(TEST_DATA_PATH, 'work-instructions', `drawing-${drawing.drawingNumber}`)
        const exists = await fs.access(drawingPath).then(() => true).catch(() => false)
        expect(exists).toBeTrue()
      }
      
      // JSONファイルも更新されているか確認
      const companiesContent = await fs.readFile(path.join(TEST_DATA_PATH, 'companies.json'), 'utf-8')
      const companies = JSON.parse(companiesContent)
      expect(companies.companies.length).toBeGreaterThan(0)
    })
    
    // テスト5: トランザクションログ
    await test('操作ログが記録される', async () => {
      const transaction = new DrawingRegistrationTransaction()
      await transaction.createDrawingStructure('LOG-TEST')
      
      const logs = transaction.getTransactionLogs()
      expect(logs.length).toBeGreaterThan(0)
      
      const hasCreateDir = logs.some(log => log.operation === 'create_dir')
      expect(hasCreateDir).toBeTrue()
    })
    
  } catch (error) {
    console.error(colors.red('\nテスト実行中にエラーが発生しました:'))
    console.error(error)
  } finally {
    // クリーンアップ
    try {
      await fs.rm(TEST_DATA_PATH, { recursive: true, force: true })
    } catch {
      // エラーは無視
    }
  }
  
  // 結果表示
  console.log(colors.blue('\n=== テスト結果 ==='))
  console.log(colors.green(`成功: ${passedTests}`))
  console.log(colors.red(`失敗: ${failedTests}`))
  console.log(colors.blue('==================\n'))
  
  // 終了コード
  process.exit(failedTests > 0 ? 1 : 0)
}

// 実行
runTests()
