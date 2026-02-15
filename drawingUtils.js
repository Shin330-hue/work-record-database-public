"use strict";
// src/lib/drawingUtils.ts - 図番管理ユーティリティ
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCompanyId = generateCompanyId;
exports.generateProductId = generateProductId;
exports.createDrawingDirectoryStructure = createDrawingDirectoryStructure;
exports.savePdfFile = savePdfFile;
exports.checkDrawingNumberExists = checkDrawingNumberExists;
exports.checkMultipleDrawingNumbers = checkMultipleDrawingNumbers;
exports.generateBasicInstruction = generateBasicInstruction;
exports.saveInstructionFile = saveInstructionFile;
exports.validateDataIntegrity = validateDataIntegrity;
exports.validateMultipleDrawings = validateMultipleDrawings;
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const dataLoader_1 = require("./dataLoader");
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
// ID生成ユーティリティ
function generateCompanyId(companyName) {
    return companyName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 30);
}
function generateProductId(productName) {
    // 製品名ベースのユニークID
    const sanitized = productName.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '').substring(0, 10);
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 4);
    return `product-${sanitized}-${timestamp}-${random}`;
}
// フォルダ階層作成
async function createDrawingDirectoryStructure(drawingNumber) {
    const safeDrawingNumber = (0, dataLoader_1.sanitizeDrawingNumber)(drawingNumber);
    const basePath = path_1.default.join(getDataPath(), 'work-instructions', `drawing-${safeDrawingNumber}`);
    // 運用手順書準拠の必須フォルダ一覧
    const requiredDirectories = [
        'images/overview',
        'images/step_01',
        'images/step_02',
        'images/step_03',
        'videos/overview',
        'videos/step_01',
        'videos/step_02',
        'videos/step_03',
        'pdfs/overview', // PDFファイルはここに配置
        'pdfs/step_01',
        'pdfs/step_02',
        'pdfs/step_03',
        'programs/overview', // dxfファイルはここに配置
        'programs/step_01',
        'programs/step_02',
        'programs/step_03',
        'contributions/files/images', // 追記用
        'contributions/files/videos' // 追記用
    ];
    // 並列でフォルダ作成（高速化）
    await Promise.all(requiredDirectories.map(async (dir) => {
        const fullPath = path_1.default.join(basePath, dir);
        try {
            await (0, promises_1.mkdir)(fullPath, { recursive: true });
        }
        catch (error) {
            // フォルダが既に存在する場合は無視
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }));
    console.log(`✅ フォルダ階層作成完了: drawing-${safeDrawingNumber}`);
}
// PDFファイル保存（pdfs/overview/に配置）
async function savePdfFile(drawingNumber, pdfFile) {
    const safeDrawingNumber = (0, dataLoader_1.sanitizeDrawingNumber)(drawingNumber);
    const fileName = `${safeDrawingNumber}.pdf`;
    const basePath = path_1.default.join(getDataPath(), 'work-instructions', `drawing-${safeDrawingNumber}`);
    const filePath = path_1.default.join(basePath, 'pdfs', 'overview', fileName);
    // ファイル検証
    if (!pdfFile.type.includes('pdf')) {
        throw new Error('PDFファイルのみアップロード可能です');
    }
    if (pdfFile.size > 10 * 1024 * 1024) { // 10MB制限
        throw new Error('ファイルサイズが大きすぎます（10MB以下にしてください）');
    }
    // バッファに変換して保存
    const buffer = await pdfFile.arrayBuffer();
    await (0, promises_1.writeFile)(filePath, Buffer.from(buffer));
    console.log(`✅ PDFファイル保存完了: ${fileName}`);
    return fileName;
}
// 図番重複チェック
async function checkDrawingNumberExists(drawingNumber) {
    const safeDrawingNumber = (0, dataLoader_1.sanitizeDrawingNumber)(drawingNumber);
    const basePath = path_1.default.join(getDataPath(), 'work-instructions', `drawing-${safeDrawingNumber}`);
    try {
        await (0, promises_1.access)(basePath);
        return true;
    }
    catch {
        return false;
    }
}
// 複数図番の一括重複チェック
async function checkMultipleDrawingNumbers(drawingNumbers) {
    const duplicates = [];
    await Promise.all(drawingNumbers.map(async (drawingNumber) => {
        const exists = await checkDrawingNumberExists(drawingNumber);
        if (exists) {
            duplicates.push(drawingNumber);
        }
    }));
    return duplicates;
}
// 基本的なinstruction.json生成
function generateBasicInstruction(data) {
    const totalTime = parseInt(data.estimatedTime) || 180;
    const prepTime = Math.min(30, Math.floor(totalTime * 0.2));
    const processTime = totalTime - prepTime;
    return {
        metadata: {
            drawingNumber: data.drawingNumber,
            title: data.title,
            companyId: data.companyId,
            productId: data.productId,
            createdDate: new Date().toISOString().split('T')[0],
            updatedDate: new Date().toISOString().split('T')[0],
            author: "管理画面",
            estimatedTime: `${data.estimatedTime}分`,
            machineType: data.machineType,
            difficulty: data.difficulty,
            toolsRequired: []
        },
        overview: {
            description: data.description || `${data.title}の加工を行います`,
            warnings: data.warnings || [],
            preparationTime: `${prepTime}分`,
            processingTime: `${processTime}分`
        },
        workSteps: [],
        relatedDrawings: [],
        troubleshooting: [],
        revisionHistory: [
            {
                date: new Date().toISOString().split('T')[0],
                author: "管理画面",
                changes: "新規作成"
            }
        ]
    };
}
// instruction.json保存
async function saveInstructionFile(drawingNumber, instruction) {
    try {
        const safeDrawingNumber = (0, dataLoader_1.sanitizeDrawingNumber)(drawingNumber);
        const basePath = path_1.default.join(getDataPath(), 'work-instructions', `drawing-${safeDrawingNumber}`);
        const filePath = path_1.default.join(basePath, 'instruction.json');
        console.log(`📝 instruction.json保存開始: ${filePath}`);
        // フォルダが存在するか確認
        try {
            await (0, promises_1.access)(basePath);
        }
        catch {
            console.error(`❌ フォルダが存在しません: ${basePath}`);
            throw new Error(`フォルダが存在しません: drawing-${safeDrawingNumber}`);
        }
        await (0, promises_1.writeFile)(filePath, JSON.stringify(instruction, null, 2));
        console.log(`✅ instruction.json保存完了: drawing-${safeDrawingNumber}`);
    }
    catch (error) {
        console.error(`❌ instruction.json保存エラー:`, error);
        throw error;
    }
}
// データ整合性チェック
async function validateDataIntegrity(drawingNumber) {
    const errors = [];
    const safeDrawingNumber = (0, dataLoader_1.sanitizeDrawingNumber)(drawingNumber);
    try {
        // 1. フォルダ存在チェック
        const basePath = path_1.default.join(getDataPath(), 'work-instructions', `drawing-${safeDrawingNumber}`);
        if (!(0, fs_1.existsSync)(basePath)) {
            errors.push(`フォルダが存在しません: drawing-${safeDrawingNumber}`);
        }
        // 2. instruction.json存在チェック
        const instructionPath = path_1.default.join(basePath, 'instruction.json');
        if (!(0, fs_1.existsSync)(instructionPath)) {
            errors.push(`instruction.jsonが存在しません: drawing-${safeDrawingNumber}`);
        }
        // 3. 必須フォルダ存在チェック
        const requiredDirs = ['images', 'videos', 'pdfs', 'programs'];
        for (const dir of requiredDirs) {
            const dirPath = path_1.default.join(basePath, dir);
            if (!(0, fs_1.existsSync)(dirPath)) {
                errors.push(`必須フォルダが存在しません: ${dir}`);
            }
        }
        // 4. companies.jsonとsearch-index.jsonの整合性チェック
        const companiesPath = path_1.default.join(getDataPath(), 'companies.json');
        const searchIndexPath = path_1.default.join(getDataPath(), 'search-index.json');
        if ((0, fs_1.existsSync)(companiesPath)) {
            const companies = JSON.parse(await (0, promises_1.readFile)(companiesPath, 'utf-8'));
            const foundInCompanies = companies.companies.some((company) => company.products.some((product) => product.drawings.includes(drawingNumber)));
            if (!foundInCompanies) {
                errors.push(`companies.jsonに図番が見つかりません: ${drawingNumber}`);
            }
        }
        if ((0, fs_1.existsSync)(searchIndexPath)) {
            const searchIndex = JSON.parse(await (0, promises_1.readFile)(searchIndexPath, 'utf-8'));
            const foundInSearch = searchIndex.drawings.some(d => d.drawingNumber === drawingNumber);
            if (!foundInSearch) {
                errors.push(`search-index.jsonに図番が見つかりません: ${drawingNumber}`);
            }
        }
    }
    catch (error) {
        errors.push(`整合性チェック中にエラーが発生しました: ${error}`);
    }
    return {
        valid: errors.length === 0,
        errors
    };
}
// 複数図番の一括整合性チェック
async function validateMultipleDrawings(drawingNumbers) {
    const results = {};
    await Promise.all(drawingNumbers.map(async (drawingNumber) => {
        const result = await validateDataIntegrity(drawingNumber);
        results[drawingNumber] = result;
    }));
    const allValid = Object.values(results).every(r => r.valid);
    return {
        valid: allValid,
        results
    };
}
