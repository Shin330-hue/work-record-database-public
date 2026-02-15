"use strict";
// src/lib/drawingRegistrationTransaction.ts - 図面登録用の統合トランザクション処理
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DrawingRegistrationTransaction = void 0;
exports.processDrawingsWithTransaction = processDrawingsWithTransaction;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const dataTransaction_1 = require("./dataTransaction");
const drawingUtils_1 = require("./drawingUtils");
// 図面登録用の統合トランザクションクラス
class DrawingRegistrationTransaction {
    constructor() {
        this.backupFiles = new Map();
        this.createdDirectories = [];
        this.createdFiles = [];
        this.transactionLogs = [];
        this.dataTransaction = null;
        this.logOperation('transaction_start', '', true);
    }
    // トランザクションログ記録
    logOperation(operation, path, success, error) {
        const log = {
            timestamp: new Date().toISOString(),
            operation: operation,
            path,
            success,
            error
        };
        this.transactionLogs.push(log);
        if (process.env.NODE_ENV === 'development') {
            console.log(`[Transaction] ${operation}: ${path} - ${success ? '✓' : '✗'} ${error || ''}`);
        }
    }
    // ディレクトリ作成（ロールバック可能）
    async createDirectory(dirPath) {
        try {
            await fs_1.promises.mkdir(dirPath, { recursive: true });
            this.createdDirectories.push(dirPath);
            this.logOperation('create_dir', dirPath, true);
        }
        catch (error) {
            this.logOperation('create_dir', dirPath, false, error?.toString());
            throw new Error(`ディレクトリ作成失敗: ${dirPath} - ${error}`);
        }
    }
    // ファイル作成（ロールバック可能）
    async createFile(filePath, content) {
        try {
            // ファイルが既に存在する場合はエラー
            try {
                await fs_1.promises.access(filePath);
                throw new Error(`ファイルが既に存在します: ${filePath}`);
            }
            catch {
                // ファイルが存在しない場合は正常
            }
            await fs_1.promises.writeFile(filePath, content, 'utf-8');
            this.createdFiles.push(filePath);
            this.logOperation('create_file', filePath, true);
        }
        catch (error) {
            this.logOperation('create_file', filePath, false, error?.toString());
            throw new Error(`ファイル作成失敗: ${filePath} - ${error}`);
        }
    }
    // ファイル更新（バックアップ付き）
    async updateFile(filePath, content) {
        try {
            // バックアップ作成
            try {
                const originalContent = await fs_1.promises.readFile(filePath, 'utf-8');
                this.backupFiles.set(filePath, originalContent);
                this.logOperation('backup_file', filePath, true);
            }
            catch (error) {
                // ファイルが存在しない場合は新規作成扱い
                this.createdFiles.push(filePath);
            }
            await fs_1.promises.writeFile(filePath, content, 'utf-8');
            this.logOperation('update_file', filePath, true);
        }
        catch (error) {
            this.logOperation('update_file', filePath, false, error?.toString());
            throw new Error(`ファイル更新失敗: ${filePath} - ${error}`);
        }
    }
    // 図面用フォルダ構造作成
    async createDrawingStructure(drawingNumber) {
        const dataPath = this.getDataPath();
        const basePath = path_1.default.join(dataPath, 'work-instructions', `drawing-${drawingNumber}`);
        // メインフォルダ
        await this.createDirectory(basePath);
        // サブフォルダ
        const subFolders = ['images', 'videos', 'pdfs', 'programs', 'contributions/files/images', 'contributions/files/videos'];
        for (const folder of subFolders) {
            await this.createDirectory(path_1.default.join(basePath, folder));
        }
    }
    // instruction.json作成
    async createInstructionFile(drawingData) {
        const dataPath = this.getDataPath();
        const filePath = path_1.default.join(dataPath, 'work-instructions', `drawing-${drawingData.drawingNumber}`, 'instruction.json');
        const instruction = (0, drawingUtils_1.generateBasicInstruction)({
            drawingNumber: drawingData.drawingNumber,
            title: drawingData.title,
            companyId: drawingData.companyId,
            productId: drawingData.productId,
            difficulty: drawingData.difficulty || '中級',
            estimatedTime: drawingData.estimatedTime || '180',
            machineType: drawingData.machineType,
            description: drawingData.description,
            warnings: drawingData.warnings
        });
        await this.createFile(filePath, JSON.stringify(instruction, null, 2));
    }
    // 単一図番の処理
    async processSingleDrawing(drawingData) {
        // 1. DataTransactionを使ってデータ処理（まだコミットしない）
        if (!this.dataTransaction) {
            this.dataTransaction = new dataTransaction_1.DataTransaction();
        }
        const processedData = await this.dataTransaction.processDrawingData(drawingData);
        // 2. フォルダ構造作成
        await this.createDrawingStructure(processedData.drawingNumber);
        // 3. instruction.json作成
        await this.createInstructionFile(processedData);
        // 4. ここではまだJSONファイルは更新しない（後でまとめて更新）
        return processedData;
    }
    // JSONファイルの更新（最後に実行）
    async updateJsonFiles(processedDrawings) {
        if (!this.dataTransaction) {
            throw new Error('データトランザクションが初期化されていません');
        }
        // companies.jsonとsearch-index.jsonを更新
        for (const data of processedDrawings) {
            await this.dataTransaction.updateCompaniesFile(data);
            await this.dataTransaction.updateSearchIndex(data);
        }
    }
    // コミット処理
    async commit() {
        // バックアップファイルを削除
        for (const [filePath, _] of this.backupFiles) {
            const backupPath = `${filePath}.backup.${Date.now()}`;
            try {
                await fs_1.promises.unlink(backupPath).catch(() => { });
            }
            catch {
                // バックアップ削除失敗は無視
            }
        }
        // DataTransactionのコミット
        if (this.dataTransaction) {
            await this.dataTransaction.commit();
        }
        this.logOperation('transaction_commit', '', true);
        this.cleanup();
    }
    // ロールバック処理
    async rollback() {
        const errors = [];
        // 1. 作成したファイルを削除（逆順）
        for (const filePath of this.createdFiles.reverse()) {
            try {
                await fs_1.promises.unlink(filePath);
                this.logOperation('rollback_delete_file', filePath, true);
            }
            catch (error) {
                const errorMsg = `ファイル削除失敗: ${filePath} - ${error}`;
                errors.push(errorMsg);
                this.logOperation('rollback_delete_file', filePath, false, errorMsg);
            }
        }
        // 2. 作成したディレクトリを削除（逆順・リーフから削除）
        for (const dirPath of this.createdDirectories.reverse()) {
            try {
                // ディレクトリが空の場合のみ削除
                await fs_1.promises.rmdir(dirPath);
                this.logOperation('rollback_delete_dir', dirPath, true);
            }
            catch (error) {
                // ディレクトリが空でない場合は、再帰的に削除を試みる
                try {
                    await fs_1.promises.rm(dirPath, { recursive: true, force: true });
                    this.logOperation('rollback_delete_dir', dirPath, true);
                }
                catch (rmError) {
                    const errorMsg = `ディレクトリ削除失敗: ${dirPath} - ${rmError}`;
                    errors.push(errorMsg);
                    this.logOperation('rollback_delete_dir', dirPath, false, errorMsg);
                }
            }
        }
        // 3. バックアップからファイルを復元
        for (const [filePath, originalContent] of this.backupFiles) {
            try {
                await fs_1.promises.writeFile(filePath, originalContent, 'utf-8');
                this.logOperation('rollback_restore_file', filePath, true);
            }
            catch (error) {
                const errorMsg = `ファイル復元失敗: ${filePath} - ${error}`;
                errors.push(errorMsg);
                this.logOperation('rollback_restore_file', filePath, false, errorMsg);
            }
        }
        // 4. DataTransactionのロールバック
        if (this.dataTransaction) {
            try {
                await this.dataTransaction.rollback();
            }
            catch (error) {
                errors.push(`DataTransactionロールバック失敗: ${error}`);
            }
        }
        this.logOperation('transaction_rollback', '', errors.length === 0);
        this.cleanup();
        if (errors.length > 0) {
            console.error('ロールバック中にエラーが発生しました:', errors);
        }
    }
    // クリーンアップ
    cleanup() {
        this.backupFiles.clear();
        this.createdDirectories = [];
        this.createdFiles = [];
        this.dataTransaction = null;
    }
    // データパス取得
    getDataPath() {
        if (process.env.NODE_ENV === 'production') {
            return process.env.DATA_ROOT_PATH || './public/data_demo';
        }
        if (process.env.USE_NAS === 'true') {
            return process.env.DATA_ROOT_PATH || './public/data_demo';
        }
        return process.env.DEV_DATA_ROOT_PATH || './public/data';
    }
    // トランザクションログ取得
    getTransactionLogs() {
        return [...this.transactionLogs];
    }
}
exports.DrawingRegistrationTransaction = DrawingRegistrationTransaction;
// 複数図番の一括処理用ヘルパー関数
async function processDrawingsWithTransaction(drawingsData) {
    const transaction = new DrawingRegistrationTransaction();
    const processed = [];
    const errors = [];
    try {
        // 1. 各図番のフォルダとinstruction.json作成
        for (const drawingData of drawingsData) {
            try {
                const processedData = await transaction.processSingleDrawing(drawingData);
                processed.push(processedData);
            }
            catch (error) {
                errors.push(`図番 ${drawingData.drawingNumber}: ${error}`);
            }
        }
        // エラーがある場合は全てロールバック
        if (errors.length > 0) {
            await transaction.rollback();
            return {
                success: false,
                processed: [],
                errors,
                logs: transaction.getTransactionLogs()
            };
        }
        // 2. 全て成功したらJSONファイルを更新
        await transaction.updateJsonFiles(processed);
        // 3. コミット
        await transaction.commit();
        return {
            success: true,
            processed,
            errors: [],
            logs: transaction.getTransactionLogs()
        };
    }
    catch (error) {
        // エラー時は全てロールバック
        await transaction.rollback();
        return {
            success: false,
            processed: [],
            errors: [error instanceof Error ? error.message : '不明なエラー'],
            logs: transaction.getTransactionLogs()
        };
    }
}
