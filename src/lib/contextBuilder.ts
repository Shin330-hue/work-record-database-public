// src/lib/contextBuilder.ts（既存を最小限修正）
export interface DiagnosisContext {
  problemCategory: string
  selectionPath: string[]
  confidence: number
  machineType?: string
  material?: string
  timestamp?: Date  // 🔥 追加のみ
}

export interface Advice {
  title: string
  text: string
  image?: string
  video?: string
  items?: Array<{
    title: string
    description: string
  }>
}

// 🔥 関数の引数を修正（dataは使わないので削除）
export function buildDiagnosisContext(selectionPath: string[]): DiagnosisContext {
  return {
    problemCategory: selectionPath[0] || '',
    selectionPath,
    confidence: 0.95
  }
}

// 🔥 簡潔性重視のプロンプト
export function generateConcisePrompt(context: DiagnosisContext): string {
  return `
金属加工エキスパートとして、以下の問題に対する解決策を提供してください。

【問題】${context.selectionPath.join(' → ')}

【回答形式】（必須）
## 🎯 結論（3行以内）
[最も重要なポイントを簡潔に]

## ⚙️ 即実践項目
- 項目1: [具体的数値]
- 項目2: [具体的数値]

## 📋 詳細説明
[上記の理由と補足情報を3-4行で]

**注意**: 回答は必ず上記の形式に従い、簡潔性を最優先してください。
`
}