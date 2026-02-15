"use strict";
// src/lib/dataLoader.ts - 案件記録データベース用に完全書き換え
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadRecentContributions = exports.loadContributions = exports.loadRelatedIdeas = exports.getDrawingSearchItem = exports.getProductById = exports.getCompanyById = exports.loadWorkInstruction = exports.loadSearchIndex = exports.loadCompanies = exports.getFrontendDataPath = void 0;
exports.sanitizeDrawingNumber = sanitizeDrawingNumber;
// ファイルパスサニタイゼーション関数
function sanitizeDrawingNumber(drawingNumber) {
    if (!drawingNumber || typeof drawingNumber !== 'string') {
        throw new Error('図番が無効です');
    }
    // 英数字、ハイフン、アンダースコアのみ許可し、最大100文字に制限
    const sanitized = drawingNumber
        .replace(/[^a-zA-Z0-9\-_]/g, '-')
        .substring(0, 100)
        .trim();
    if (sanitized.length === 0) {
        throw new Error('図番が無効です');
    }
    return sanitized;
}
// 環境に応じたデータパス取得
const getDataPath = () => {
    // デバッグ用ログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_DATA_LOADING === 'true') {
        console.log('🔍 getDataPath 呼び出し:', {
            NODE_ENV: process.env.NODE_ENV,
            USE_NAS: process.env.USE_NAS,
            DATA_ROOT_PATH: process.env.DATA_ROOT_PATH,
            DEV_DATA_ROOT_PATH: process.env.DEV_DATA_ROOT_PATH
        });
    }
    // 本番環境（社内ノートPC）
    if (process.env.NODE_ENV === 'production') {
        const path = process.env.DATA_ROOT_PATH || './public/data_demo';
        // 本番環境ではログ出力しない
        return path;
    }
    // NAS使用開発環境
    if (process.env.USE_NAS === 'true') {
        const path = process.env.DATA_ROOT_PATH || './public/data_demo';
        if (process.env.NODE_ENV === 'development' && process.env.DEBUG_DATA_LOADING === 'true') {
            console.log('💾 NAS使用パス:', path);
        }
        return path;
    }
    // ローカル開発環境（DEV_DATA_ROOT_PATHを使用）
    const path = process.env.DEV_DATA_ROOT_PATH || './public/data_test';
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_DATA_LOADING === 'true') {
        console.log('🖥️ ローカル開発パス:', path);
    }
    return path;
};
// Next.js の静的ファイル配信を活用
const setupStaticFiles = async () => {
    // サーバーサイドのみ実行
    if (typeof window !== 'undefined')
        return;
    // Windows環境では手動でシンボリックリンクを作成してください
    // 以下の自動削除・symlink作成処理はコメントアウトします
    /*
    if (process.env.NODE_ENV === 'production' || process.env.USE_NAS === 'true') {
      try {
        const { promises: fs } = await import('fs');
        const path = (await import('path')).default;
        const dataPath = getDataPath();
        const publicDataPath = path.join(process.cwd(), 'public', 'data');
        
        if (require('fs').existsSync(publicDataPath)) {
          await fs.rm(publicDataPath, { recursive: true, force: true });
        }
        await fs.symlink(dataPath, publicDataPath);
        console.log(`✅ シンボリックリンク作成: ${publicDataPath} → ${dataPath}`);
      } catch (error) {
        console.error('⚠️ シンボリックリンク作成失敗:', error);
        await fs.cp(dataPath, publicDataPath, { recursive: true });
        console.log(`✅ データコピー完了: ${dataPath} → ${publicDataPath}`);
      }
    }
    */
};
// アプリケーション起動時にセットアップ実行
if (typeof window === 'undefined') {
    setupStaticFiles();
}
// フロントエンド用のデータパス取得
const getFrontendDataPath = () => {
    if (typeof window === 'undefined')
        return '';
    // デバッグログ（開発環境のみ、制限付き）
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_DATA_LOADING === 'true') {
        console.log('🔍 getFrontendDataPath 詳細:', {
            NEXT_PUBLIC_USE_NAS: process.env.NEXT_PUBLIC_USE_NAS,
            NEXT_PUBLIC_USE_NAS_type: typeof process.env.NEXT_PUBLIC_USE_NAS,
            NEXT_PUBLIC_USE_NAS_strict: process.env.NEXT_PUBLIC_USE_NAS === 'true',
            NODE_ENV: process.env.NODE_ENV,
            isWindow: typeof window !== 'undefined'
        });
    }
    if (process.env.NEXT_PUBLIC_USE_NAS === 'true') {
        if (process.env.NODE_ENV === 'development' && process.env.DEBUG_DATA_LOADING === 'true') {
            console.log('💾 NAS使用パスを返します: /data');
        }
        return '/data';
    }
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_DATA_LOADING === 'true') {
        console.log('🖥️ ローカルパスを返します: /data');
    }
    return '/data';
};
exports.getFrontendDataPath = getFrontendDataPath;
// データ読み込み関数
const loadCompanies = async () => {
    try {
        if (process.env.NODE_ENV === 'development' && process.env.DEBUG_DATA_LOADING === 'true') {
            console.log('🔍 会社データ読み込み情報:', {
                isServerSide: typeof window === 'undefined',
                nodeEnv: process.env.NODE_ENV
            });
        }
        // APIエンドポイントから取得（キャッシュされない）
        const response = await fetch('/api/companies');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.companies || [];
    }
    catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error('会社データの読み込みに失敗:', error);
        }
        return [];
    }
};
exports.loadCompanies = loadCompanies;
const loadSearchIndex = async () => {
    try {
        if (process.env.DEBUG_DATA_LOADING === 'true') {
            console.log('🔍 検索インデックス読み込み情報:', {
                isServerSide: typeof window === 'undefined',
                nodeEnv: process.env.NODE_ENV
            });
        }
        // APIエンドポイントから取得（キャッシュされない）
        const response = await fetch('/api/search-index');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }
    catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error('検索インデックスの読み込みに失敗:', error);
        }
        return {
            drawings: [],
            metadata: {
                totalDrawings: 0,
                lastIndexed: new Date().toISOString(),
                version: '1.0'
            }
        };
    }
};
exports.loadSearchIndex = loadSearchIndex;
const loadWorkInstruction = async (drawingNumber) => {
    try {
        if (process.env.DEBUG_DATA_LOADING === 'true') {
            console.log('🔍 作業手順読み込み情報:', {
                drawingNumber,
                isServerSide: typeof window === 'undefined',
                nodeEnv: process.env.NODE_ENV
            });
        }
        // APIエンドポイントから取得（キャッシュされない）
        const response = await fetch(`/api/work-instruction/${encodeURIComponent(drawingNumber)}`);
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`図番 ${drawingNumber} の作業手順が見つかりません`);
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const workInstruction = await response.json();
        // 検索インデックスから会社名と製品名を取得
        try {
            const searchIndex = await (0, exports.loadSearchIndex)();
            const drawingSearchItem = searchIndex.drawings.find(d => d.drawingNumber === drawingNumber);
            if (drawingSearchItem) {
                workInstruction.metadata.companyName = drawingSearchItem.companyName;
                workInstruction.metadata.productName = drawingSearchItem.productName;
            }
        }
        catch (error) {
            console.error('会社名・製品名の取得に失敗:', error);
        }
        return workInstruction;
    }
    catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error(`作業手順の読み込みに失敗 (${drawingNumber}):`, error);
        }
        return null;
    }
};
exports.loadWorkInstruction = loadWorkInstruction;
// 会社IDから会社情報を取得
const getCompanyById = (companies, companyId) => {
    return companies.find(company => company.id === companyId) || null;
};
exports.getCompanyById = getCompanyById;
// 部品IDから部品情報を取得
const getProductById = (company, productId) => {
    return company.products.find(product => product.id === productId) || null;
};
exports.getProductById = getProductById;
// 図番から検索アイテムを取得
const getDrawingSearchItem = (searchIndex, drawingNumber) => {
    return searchIndex.drawings.find(drawing => drawing.drawingNumber === drawingNumber) || null;
};
exports.getDrawingSearchItem = getDrawingSearchItem;
// 関連アイデアを読み込む（並列読み込みで高速化）
const loadRelatedIdeas = async (ideaPaths) => {
    try {
        // 並列読み込みで高速化
        const promises = ideaPaths.map(async (path) => {
            const [category, folderName] = path.split('/');
            const dataPath = typeof window === 'undefined' ? getDataPath() : (0, exports.getFrontendDataPath)();
            const response = await fetch(`${dataPath}/ideas-library/${category}/${folderName}/idea.json`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        });
        const results = await Promise.all(promises);
        return results;
    }
    catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error('アイデアの読み込みに失敗:', error);
        }
        return [];
    }
};
exports.loadRelatedIdeas = loadRelatedIdeas;
// 追記データ読み込み関数
const loadContributions = async (drawingNumber) => {
    try {
        if (process.env.DEBUG_DATA_LOADING === 'true') {
            console.log('🔍 追記データ読み込み情報:', {
                drawingNumber,
                isServerSide: typeof window === 'undefined',
                dataPath: getDataPath(),
                useNAS: process.env.USE_NAS,
                nodeEnv: process.env.NODE_ENV
            });
        }
        const response = await fetch(`/api/contribution?drawingNumber=${encodeURIComponent(drawingNumber)}`);
        if (!response.ok) {
            if (response.status === 404) {
                return {
                    drawingNumber,
                    contributions: [],
                    metadata: {
                        totalContributions: 0,
                        lastUpdated: new Date().toISOString(),
                        version: '1.0',
                        mergedCount: 0
                    }
                };
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }
    catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error(`追記データの読み込みに失敗 (${drawingNumber}):`, error);
        }
        return {
            drawingNumber,
            contributions: [],
            metadata: {
                totalContributions: 0,
                lastUpdated: new Date().toISOString(),
                version: '1.0',
                mergedCount: 0
            }
        };
    }
};
exports.loadContributions = loadContributions;
// 全図番の最新追記データを取得
const loadRecentContributions = async (limit = 10) => {
    try {
        // 検索インデックスから全図番を取得
        const searchIndex = await (0, exports.loadSearchIndex)();
        const allContributions = [];
        // 各図番の追記データを並列取得
        const contributionPromises = searchIndex.drawings.map(async (drawing) => {
            try {
                const contributionFile = await (0, exports.loadContributions)(drawing.drawingNumber);
                // activeステータスの追記のみを返す
                return contributionFile.contributions
                    .filter(contribution => contribution.status === 'active')
                    .map(contribution => ({
                    drawingNumber: drawing.drawingNumber,
                    contribution,
                    drawingTitle: drawing.title
                }));
            }
            catch {
                return [];
            }
        });
        const results = await Promise.all(contributionPromises);
        results.forEach(contributions => {
            allContributions.push(...contributions);
        });
        // 投稿日時でソートして最新順に
        allContributions.sort((a, b) => new Date(b.contribution.timestamp).getTime() - new Date(a.contribution.timestamp).getTime());
        return allContributions.slice(0, limit);
    }
    catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error('最新追記データの読み込みに失敗:', error);
        }
        return [];
    }
};
exports.loadRecentContributions = loadRecentContributions;
