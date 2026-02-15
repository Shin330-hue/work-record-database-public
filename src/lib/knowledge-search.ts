import { normalizeMachineTypeInput, getMachineTypeJapanese } from './machineTypeUtils'
/**
 * 社内データ検索・RAG機能モジュール
 * 既存システムから完全独立・読み取り専用
 */

export interface ExtractedKeywords {
  materials: string[]
  machines: string[]
  processes: string[]
  drawings: string[]
  companies: string[]
  showAll?: boolean
}

export interface SearchResult {
  companies: CompanyMatch[]
  drawings: DrawingMatch[]
  contributions: ContributionMatch[]
  statistics: SearchStatistics
}

export interface CompanyMatch {
  companyName: string
  productName: string
  category: string
  drawingNumbers: string[]
  relevanceScore: number
}

export interface DrawingMatch {
  drawingNumber: string
  title: string
  companyId: string
  machineTypes: string[]
  materials: string[]
  difficulty: string
  estimatedTime: string
  relevanceScore: number
}

export interface ContributionMatch {
  drawingNumber: string
  contributor: string
  content: string
  type: string
  timestamp: string
  relevanceScore: number
}

export interface SearchStatistics {
  totalCompanies: number
  totalDrawings: number
  totalContributions: number
  searchTerms: string[]
  processingTimeMs: number
}

/**
 * テキストからキーワードを抽出
 */
export function extractKeywords(text: string): ExtractedKeywords {
  const lowerText = text.toLowerCase()
  
  // 全件表示を要求するクエリパターンの検出
  const showAllPatterns = [
    '全図番', '全ての図番', 'すべての図番', '図番を全て', '図番の数', '何件', '何個',
    '全部', 'すべて', '一覧', 'リスト', 'list all', 'show all', 'total'
  ]
  const isShowAllRequest = showAllPatterns.some(pattern => lowerText.includes(pattern))
  
  // 材質キーワード（大幅拡張）
  const materials = [
    'ss400', 'sus304', 'sus316', 's45c', 'sph', 'sus', 'ss', 'stainless',
    'アルミ', 'アルミニウム', 'al', 'aluminum', 'ステンレス', 'ステン',
    'ドラル', 'dural', '真鍮', '黄銅', 'brass', '銅', 'copper',
    '鉄', 'iron', '鋼', 'steel', '炭素鋼', 'carbon'
  ].filter(material => lowerText.includes(material))
  
  // 機械種別キーワード（拡張＋類似語）
  const machines = [
    'マシニング', 'machining', 'mc', 'マシニングセンタ', 'マシニングセンター',
    'ターニング', 'turning', 'cnc旋盤', '旋盤', 'lathe',
    '横中', 'よこなか', '横中ぐり', 'horizontal',
    'ラジアル', 'radial', 'ラジアル', 'ボール盤', 'drill',
    'その他', 'other', '手仕上げ', '研削', 'grinding'
  ].filter(machine => lowerText.includes(machine))
  
  // 加工プロセスキーワード（大幅拡張）
  const processes = [
    '切削', '加工', '機械加工', 'machining', 'cutting',
    '穴あけ', '穴開け', 'drilling', 'drill', 'ボーリング', 'boring',
    'タップ', 'tap', 'tapping', 'ねじ切り', 'thread',
    'あり溝', '溝', 'slot', 'slotting', 'キー溝', 'keyway',
    'フライス', 'milling', '正面フライス', 'end mill', 'エンドミル',
    '旋盤', 'turning', '外径', '内径', '端面', '溝入れ',
    '研削', 'grinding', '仕上げ', 'finish', 'finishing',
    '面取り', 'chamfer', 'バリ取り', 'deburring', 'バリ除去',
    '測定', '検査', 'measurement', 'inspection'
  ].filter(process => lowerText.includes(process))
  
  // 図番パターン（数字とハイフンを含む）
  const drawingPattern = /[A-Za-z0-9\-_]{5,}/g
  const drawings = (text.match(drawingPattern) || [])
    .filter(drawing => /\d/.test(drawing)) // 数字を含むもののみ
  
  // 会社名キーワード
  const companies = ['中央鉄工所', 'サンエイ工業', 'sanei', 'chuo']
    .filter(company => lowerText.includes(company))
  
  return {
    materials,
    machines, 
    processes,
    drawings,
    companies,
    showAll: isShowAllRequest
  }
}

/**
 * 社内データを検索
 */
export async function searchKnowledgeBase(
  query: string,
  conversationHistory: string[] = []
): Promise<SearchResult> {
  const startTime = Date.now()
  
  // クエリと会話履歴を結合してキーワード抽出
  const fullContext = [query, ...conversationHistory].join(' ')
  const keywords = extractKeywords(fullContext)
  
  try {
    // 各データソースから検索
    const [companyMatches, drawingMatches, contributionMatches] = await Promise.all([
      searchCompanies(keywords),
      searchDrawings(keywords),
      searchContributions()
    ])
    
    const statistics: SearchStatistics = {
      totalCompanies: companyMatches.length,
      totalDrawings: drawingMatches.length,
      totalContributions: contributionMatches.length,
      searchTerms: [
        ...keywords.materials,
        ...keywords.machines,
        ...keywords.processes,
        ...keywords.drawings,
        ...keywords.companies
      ],
      processingTimeMs: Date.now() - startTime
    }
    
    return {
      companies: companyMatches,
      drawings: drawingMatches,
      contributions: contributionMatches,
      statistics
    }
    
  } catch (error) {
    console.error('Knowledge search error:', error)
    
    // エラー時は空の結果を返す
    return {
      companies: [],
      drawings: [],
      contributions: [],
      statistics: {
        totalCompanies: 0,
        totalDrawings: 0,
        totalContributions: 0,
        searchTerms: [],
        processingTimeMs: Date.now() - startTime
      }
    }
  }
}

/**
 * 会社・製品データから検索
 */
async function searchCompanies(keywords: ExtractedKeywords): Promise<CompanyMatch[]> {
  try {
    // サーバーサイドなので直接ファイルを読み込み
    const fs = await import('fs/promises')
    const path = await import('path')
    
    // 環境に応じたデータパス取得（既存のgetDataPath関数を参考）
    const useNAS = process.env.USE_NAS === 'true'
    const dataRootPath = useNAS 
      ? process.env.DATA_ROOT_PATH || './public/data'
      : process.env.DEV_DATA_ROOT_PATH || './public/data'
      
    const companiesPath = path.join(dataRootPath, 'companies.json')
    const companiesData = await fs.readFile(companiesPath, 'utf-8')
    const data = JSON.parse(companiesData)
    
    const matches: CompanyMatch[] = []
    
    for (const company of data.companies) {
      for (const product of company.products) {
        let relevanceScore = 0
        
        // 会社名マッチ
        if (keywords.companies.some(c => 
          company.name.toLowerCase().includes(c) || 
          company.shortName.toLowerCase().includes(c)
        )) {
          relevanceScore += 3
        }
        
        // 製品名・カテゴリマッチ
        if (keywords.processes.some(p => 
          product.name.toLowerCase().includes(p) ||
          product.category.toLowerCase().includes(p)
        )) {
          relevanceScore += 2
        }
        
        // 図番マッチ
        if (keywords.drawings.some(d => 
          product.drawings.includes(d)
        )) {
          relevanceScore += 5
        }
        
        if (relevanceScore > 0) {
          matches.push({
            companyName: company.shortName,
            productName: product.name,
            category: product.category,
            drawingNumbers: product.drawings,
            relevanceScore
          })
        }
      }
    }
    
    const limit = keywords.showAll ? 20 : 10
    return matches.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit)
    
  } catch (error) {
    console.error('Company search error:', error)
    return []
  }
}

/**
 * 作業手順データから検索  
 */
async function searchDrawings(keywords: ExtractedKeywords): Promise<DrawingMatch[]> {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    // データパス取得
    const useNAS = process.env.USE_NAS === 'true'
    const dataRootPath = useNAS 
      ? process.env.DATA_ROOT_PATH || './public/data'
      : process.env.DEV_DATA_ROOT_PATH || './public/data'
      
    const workInstructionsPath = path.join(dataRootPath, 'work-instructions')
    
    // work-instructionsディレクトリの存在確認
    try {
      await fs.access(workInstructionsPath)
    } catch {
      console.log('work-instructionsディレクトリが見つかりません')
      return []
    }
    
    const matches: DrawingMatch[] = []
    
    // ディレクトリ一覧取得
    const drawingDirs = await fs.readdir(workInstructionsPath, { withFileTypes: true })
    
    for (const dir of drawingDirs) {
      if (!dir.isDirectory()) continue
      
      try {
        const instructionPath = path.join(workInstructionsPath, dir.name, 'instruction.json')
        const instructionData = await fs.readFile(instructionPath, 'utf-8')
        const instruction = JSON.parse(instructionData)
        
        let relevanceScore = 0
        
        // メタデータから関連性チェック
        const metadata = instruction.metadata || {}
        const title = metadata.title || ''
        const machineTypeKeys = normalizeMachineTypeInput(metadata.machineType as string | string[] | undefined)
        const machineTypeLabels = machineTypeKeys.map(getMachineTypeJapanese)
        const machineTypePool = [...machineTypeKeys, ...machineTypeLabels].map(mt => mt.toLowerCase())
        
        // 全件表示モードの場合、すべてに基本スコアを付与
        if (keywords.showAll) {
          relevanceScore = 1
        }
        
        // 材質マッチ（タイトルから推定）
        if (keywords.materials.some(m => 
          title.toLowerCase().includes(m.toLowerCase())
        )) {
          relevanceScore += 3
        }
        
        // 機械種別マッチ
        if (keywords.machines.some(m => {
          const lowerM = m.toLowerCase()
          return machineTypePool.some(mt => mt.includes(lowerM))
        })) {
          relevanceScore += 4
        }
        
        // 図番直接マッチ
        if (keywords.drawings.some(d => 
          metadata.drawingNumber === d
        )) {
          relevanceScore += 5
        }
        
        // プロセスマッチ（タイトル内）
        if (keywords.processes.some(p => 
          title.includes(p)
        )) {
          relevanceScore += 2
        }
        
        // 曖昧マッチ - タイトル内のキーワード検索を緩和
        if (relevanceScore === 0 || keywords.showAll) {
          if (keywords.materials.length === 0 && keywords.machines.length === 0 && 
              keywords.processes.length === 0 && keywords.drawings.length === 0) {
            // キーワードが何も抽出されない場合も表示対象に
            relevanceScore = Math.max(relevanceScore, 0.5)
          }
        }
        
        if (relevanceScore > 0) {
          matches.push({
            drawingNumber: metadata.drawingNumber || dir.name,
            title: title,
            companyId: metadata.companyId || 'unknown',
            machineTypes: machineTypeLabels,
            materials: keywords.materials.filter(m => title.toLowerCase().includes(m.toLowerCase())),
            difficulty: metadata.difficulty || 'unknown',
            estimatedTime: metadata.estimatedTime || 'unknown',
            relevanceScore
          })
        }
        
      } catch {
        // 個別ファイル読み込みエラーは無視して続行
        continue
      }
    }
    
    // 全件表示モードの場合は制限を緩和
    const limit = keywords.showAll ? 50 : 10
    return matches.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit)
    
  } catch (error) {
    console.error('Drawing search error:', error)
    return []
  }
}

/**
 * 追記データから検索
 */
async function searchContributions(): Promise<ContributionMatch[]> {
  // TODO: 実装時は既存のcontributionsデータを活用
  return []
}

/**
 * 検索結果をコンテキスト文字列にフォーマット
 */
export function formatSearchResults(results: SearchResult): string {
  let context = `【社内データベース検索結果】\n\n`
  
  // 統計情報
  if (results.statistics.totalDrawings > 0) {
    context += `検索件数: 図番${results.statistics.totalDrawings}件、追記${results.statistics.totalContributions}件\n`
    context += `検索キーワード: ${results.statistics.searchTerms.join(', ')}\n\n`
  }
  
  // 会社・製品情報
  if (results.companies.length > 0) {
    context += `■ 関連会社・製品:\n`
    results.companies.slice(0, 3).forEach(company => {
      context += `- ${company.companyName}: ${company.productName} (${company.category})\n`
      context += `  図番: ${company.drawingNumbers.join(', ')}\n`
    })
    context += `\n`
  }
  
  // 図番情報
  if (results.drawings.length > 0) {
    context += `■ 関連作業手順:\n`
    results.drawings.slice(0, 3).forEach(drawing => {
      context += `- ${drawing.drawingNumber}: ${drawing.title}\n`
      context += `  機械: ${drawing.machineTypes.join('、')}, 難易度: ${drawing.difficulty}\n`
    })
    context += `\n`
  }
  
  // 追記・現場知見
  if (results.contributions.length > 0) {
    context += `■ 現場からの知見:\n`
    results.contributions.slice(0, 3).forEach(contrib => {
      context += `- ${contrib.contributor}: "${contrib.content}"\n`
      context += `  (図番: ${contrib.drawingNumber})\n`
    })
  }
  
  return context
}
