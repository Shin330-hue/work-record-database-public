"use strict";
// src/lib/dataTransaction.ts - データ更新トランザクション処理
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataTransaction = void 0;
exports.createSingleDrawing = createSingleDrawing;
exports.createMultipleDrawings = createMultipleDrawings;
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const drawingUtils_1 = require("./drawingUtils");
// 環境に応じたデータパス取得
function getDataPath() {
    if (process.env.NODE_ENV === 'production') {
        return process.env.DATA_ROOT_PATH || './public/data_demo';
    }
    if (process.env.USE_NAS === 'true') {
        return process.env.DATA_ROOT_PATH || './public/data_demo';
    }
    return process.env.DEV_DATA_ROOT_PATH || './public/data';
}
// データトランザクション管理クラス
class DataTransaction {
    constructor() {
        this.backupPaths = [];
        this.createdFiles = [];
    }
    // バックアップファイル作成
    async createBackup(filePath) {
        if ((0, fs_1.existsSync)(filePath)) {
            const backupPath = `${filePath}.backup.${Date.now()}`;
            await (0, promises_1.copyFile)(filePath, backupPath);
            this.backupPaths.push(backupPath);
            console.log(`📁 バックアップ作成: ${path_1.default.basename(backupPath)}`);
        }
    }
    // 会社ID解決（既存選択または新規作成）
    async resolveCompanyId(companyInput) {
        if (companyInput.type === 'existing' && companyInput.id) {
            return companyInput.id;
        }
        // 新規作成時は管理画面で入力されたIDを使用
        if (companyInput.type === 'new' && companyInput.id) {
            return companyInput.id;
        }
        // IDが指定されていない場合のみ自動生成（後方互換性のため残す）
        console.warn(`会社IDが指定されていません。自動生成します: ${companyInput.name}`);
        return (0, drawingUtils_1.generateCompanyId)(companyInput.name);
    }
    // 製品ID解決（既存選択または新規作成）
    async resolveProductId(productInput) {
        if (productInput.type === 'existing' && productInput.id) {
            return productInput.id;
        }
        // 新規作成時のID生成
        return (0, drawingUtils_1.generateProductId)(productInput.name);
    }
    // 入力データの処理
    async processDrawingData(inputData) {
        const companyId = await this.resolveCompanyId(inputData.company);
        const productId = await this.resolveProductId(inputData.product);
        // keywordsを配列に変換（文字列の場合）
        let keywords = [];
        if (inputData.keywords) {
            if (Array.isArray(inputData.keywords)) {
                keywords = inputData.keywords;
            }
            else if (typeof inputData.keywords === 'string') {
                keywords = inputData.keywords.split(',').map(k => k.trim()).filter(k => k);
            }
        }
        return {
            drawingNumber: inputData.drawingNumber,
            title: inputData.title,
            companyId,
            companyName: inputData.company.name,
            productId,
            productName: inputData.product.name,
            category: inputData.product.category,
            difficulty: inputData.difficulty,
            estimatedTime: inputData.estimatedTime,
            machineType: inputData.machineType,
            description: inputData.description,
            warnings: inputData.warnings,
            keywords
        };
    }
    // companies.json更新
    async updateCompaniesFile(data) {
        const companiesPath = path_1.default.join(getDataPath(), 'companies.json');
        // バックアップ作成
        await this.createBackup(companiesPath);
        // 既存データ読み込み
        let companies;
        if ((0, fs_1.existsSync)(companiesPath)) {
            companies = JSON.parse(await (0, promises_1.readFile)(companiesPath, 'utf-8'));
        }
        else {
            companies = { companies: [], metadata: { lastUpdated: new Date().toISOString(), version: '1.0.0' } };
        }
        // 会社の存在確認・追加
        let company = companies.companies.find(c => c.id === data.companyId);
        if (!company) {
            company = {
                id: data.companyId,
                name: data.companyName,
                shortName: data.companyName,
                description: data.companyName,
                priority: companies.companies.length + 1,
                products: []
            };
            companies.companies.push(company);
            console.log(`🏢 新規会社追加: ${data.companyName} (${data.companyId})`);
        }
        // 製品の存在確認・追加
        let product = company.products.find(p => p.id === data.productId);
        if (!product) {
            product = {
                id: data.productId,
                name: data.productName,
                category: data.category,
                description: data.category,
                drawingCount: 0,
                drawings: []
            };
            company.products.push(product);
            console.log(`📦 新規製品追加: ${data.productName} (${data.productId})`);
        }
        // 図番追加（重複チェック）
        if (!product.drawings.includes(data.drawingNumber)) {
            product.drawings.push(data.drawingNumber);
            product.drawingCount = product.drawings.length;
            console.log(`📋 図番追加: ${data.drawingNumber} → ${data.productName}`);
        }
        // メタデータ更新
        companies.metadata = {
            lastUpdated: new Date().toISOString(),
            version: companies.metadata.version || '1.0.0'
        };
        // ファイル保存
        await (0, promises_1.writeFile)(companiesPath, JSON.stringify(companies, null, 2));
        this.createdFiles.push(companiesPath);
        console.log(`✅ companies.json更新完了`);
    }
    // search-index.json更新
    async updateSearchIndex(data) {
        const searchIndexPath = path_1.default.join(getDataPath(), 'search-index.json');
        // バックアップ作成
        await this.createBackup(searchIndexPath);
        // 既存データ読み込み
        let searchIndex;
        if ((0, fs_1.existsSync)(searchIndexPath)) {
            searchIndex = JSON.parse(await (0, promises_1.readFile)(searchIndexPath, 'utf-8'));
        }
        else {
            searchIndex = {
                drawings: [],
                metadata: {
                    totalDrawings: 0,
                    lastIndexed: new Date().toISOString(),
                    version: '1.0'
                }
            };
        }
        // 新しい検索エントリ作成
        const newEntry = {
            drawingNumber: data.drawingNumber,
            productName: data.productName,
            companyName: data.companyName,
            companyId: data.companyId,
            productId: data.productId,
            title: data.title,
            category: data.category,
            keywords: data.keywords || [
                data.category,
                data.productName,
                data.companyName,
                data.machineType,
                data.difficulty
            ],
            folderPath: `drawing-${data.drawingNumber}`,
            hasImages: false,
            hasVideos: false,
            hasDrawing: false, // PDFアップロード時にtrueに更新
            stepCount: 3,
            difficulty: data.difficulty,
            estimatedTime: `${data.estimatedTime}分`,
            machineType: data.machineType
        };
        // 重複チェック・追加
        const existingIndex = searchIndex.drawings.findIndex(d => d.drawingNumber === data.drawingNumber);
        if (existingIndex >= 0) {
            searchIndex.drawings[existingIndex] = newEntry;
            console.log(`🔄 検索エントリ更新: ${data.drawingNumber}`);
        }
        else {
            searchIndex.drawings.push(newEntry);
            console.log(`🔍 検索エントリ追加: ${data.drawingNumber}`);
        }
        // メタデータ更新
        searchIndex.metadata = {
            totalDrawings: searchIndex.drawings.length,
            lastIndexed: new Date().toISOString(),
            version: '1.0'
        };
        // ファイル保存
        await (0, promises_1.writeFile)(searchIndexPath, JSON.stringify(searchIndex, null, 2));
        this.createdFiles.push(searchIndexPath);
        console.log(`✅ search-index.json更新完了`);
    }
    // PDFファイル配置時の検索インデックス更新
    async updateSearchIndexForPdf(drawingNumber) {
        const searchIndexPath = path_1.default.join(getDataPath(), 'search-index.json');
        if ((0, fs_1.existsSync)(searchIndexPath)) {
            const searchIndex = JSON.parse(await (0, promises_1.readFile)(searchIndexPath, 'utf-8'));
            const entry = searchIndex.drawings.find(d => d.drawingNumber === drawingNumber);
            if (entry) {
                entry.hasDrawing = true;
                await (0, promises_1.writeFile)(searchIndexPath, JSON.stringify(searchIndex, null, 2));
                console.log(`✅ PDFファイル配置フラグ更新: ${drawingNumber}`);
            }
        }
    }
    // 複数図番データの一括処理
    async processMultipleDrawings(drawingsData) {
        const processed = [];
        const errors = [];
        try {
            // 1. 全データの前処理
            for (const drawingData of drawingsData) {
                try {
                    const processedData = await this.processDrawingData(drawingData);
                    processed.push(processedData);
                }
                catch (error) {
                    errors.push(`図番 ${drawingData.drawingNumber} の処理中にエラー: ${error}`);
                }
            }
            if (errors.length > 0) {
                return { success: false, processed: [], errors };
            }
            // 2. 一括でcompanies.json更新
            for (const data of processed) {
                await this.updateCompaniesFile(data);
            }
            // 3. 一括でsearch-index.json更新
            for (const data of processed) {
                await this.updateSearchIndex(data);
            }
            return { success: true, processed, errors: [] };
        }
        catch (error) {
            errors.push(`一括処理中にエラーが発生: ${error}`);
            return { success: false, processed: [], errors };
        }
    }
    // トランザクションコミット
    async commit() {
        // バックアップファイル削除
        const { unlink } = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        await Promise.all(this.backupPaths.map(async (backupPath) => {
            try {
                await unlink(backupPath);
            }
            catch {
                // バックアップ削除に失敗しても処理続行
            }
        }));
        this.backupPaths = [];
        console.log(`✅ トランザクションコミット完了`);
    }
    // トランザクションロールバック
    async rollback() {
        const { unlink } = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        // 作成したファイルを削除
        await Promise.all(this.createdFiles.map(async (filePath) => {
            try {
                await unlink(filePath);
            }
            catch {
                // ファイル削除に失敗しても処理続行
            }
        }));
        // バックアップファイルから復元
        await Promise.all(this.backupPaths.map(async (backupPath) => {
            try {
                const originalPath = backupPath.replace(/\.backup\.\d+$/, '');
                await (0, promises_1.copyFile)(backupPath, originalPath);
                await unlink(backupPath);
            }
            catch {
                // 復元に失敗しても処理続行
            }
        }));
        this.backupPaths = [];
        this.createdFiles = [];
        console.log(`⚠️ トランザクションロールバック完了`);
    }
}
exports.DataTransaction = DataTransaction;
// 便利関数：単一図番の処理
async function createSingleDrawing(drawingData) {
    const transaction = new DataTransaction();
    try {
        const processedData = await transaction.processDrawingData(drawingData);
        await transaction.updateCompaniesFile(processedData);
        await transaction.updateSearchIndex(processedData);
        await transaction.commit();
        return { success: true, data: processedData };
    }
    catch (error) {
        await transaction.rollback();
        return { success: false, error: error instanceof Error ? error.message : '不明なエラー' };
    }
}
// 便利関数：複数図番の処理
async function createMultipleDrawings(drawingsData) {
    const transaction = new DataTransaction();
    try {
        const result = await transaction.processMultipleDrawings(drawingsData);
        if (result.success) {
            await transaction.commit();
        }
        else {
            await transaction.rollback();
        }
        return result;
    }
    catch (error) {
        await transaction.rollback();
        return {
            success: false,
            processed: [],
            errors: [error instanceof Error ? error.message : '不明なエラー']
        };
    }
}
