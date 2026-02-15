// src/app/admin/drawings/new/page.tsx - 新規図番登録ページ

'use client'

import { useState, useEffect } from 'react'
import { loadCompanies } from '@/lib/dataLoader'
import { Company } from '@/lib/dataLoader'
import { getAuthHeadersForFormData } from '@/lib/auth/client'
import { FormButton } from '@/components/admin/forms'
import { MACHINE_TYPE_OPTIONS, MachineTypeKey, getMachineTypeJapanese } from '@/lib/machineTypeUtils'

// 図番データ型（シンプル化）
interface DrawingFormData {
  drawingNumber: string
  title: string
  company: {
    type: 'existing' | 'new'
    id?: string
    name: string
  }
  product: {
    type: 'existing' | 'new'
    id?: string
    name: string
    category: string
  }
  machineType: MachineTypeKey[]
  pdfFiles: File[]  // 複数ファイル対応に変更
  programFiles: File[]  // プログラムファイル追加
}

// 会社選択コンポーネント
function CompanySelector({ 
  companies, 
  value, 
  onChange 
}: { 
  companies: Company[]
  value: DrawingFormData['company']
  onChange: (company: DrawingFormData['company']) => void
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [isNewMode, setIsNewMode] = useState(value.type === 'new')

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCompanySelect = (company: Company) => {
    onChange({
      type: 'existing',
      id: company.id,
      name: company.name
    })
    setSearchTerm(company.name)
    setShowDropdown(false)
    setIsNewMode(false)
  }

  const handleNewCompany = () => {
    setIsNewMode(true)
    onChange({
      type: 'new',
      name: searchTerm
    })
    setShowDropdown(false)
  }

  return (
    <div className="relative">
      <label className="custom-form-label">
        会社名 <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <input
          type="text"
          value={isNewMode ? value.name : searchTerm}
          onChange={(e) => {
            const newValue = e.target.value
            if (isNewMode) {
              onChange({ ...value, name: newValue })
            } else {
              setSearchTerm(newValue)
              setShowDropdown(true)
            }
          }}
          onFocus={() => !isNewMode && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 100)}
          placeholder="会社名を選択または新規作成"
          className="custom-form-input"
        />
      </div>
      
      <div className="mt-3">
        {!isNewMode && (
          <button
            type="button"
            onClick={() => setIsNewMode(true)}
            className="custom-rect-button emerald small"
          >
            <span>+ 新規会社を作成</span>
          </button>
        )}
        {isNewMode && (
          <button
            type="button"
            onClick={() => {
              setIsNewMode(false)
              setSearchTerm('')
              setShowDropdown(true)
            }}
            className="custom-rect-button gray small"
          >
            <span>既存会社を選択</span>
          </button>
        )}
      </div>

      {showDropdown && !isNewMode && (
        <div className="custom-dropdown">
          {filteredCompanies.map((company) => (
            <button
              key={company.id}
              type="button"
              onClick={() => handleCompanySelect(company)}
              className="custom-dropdown-item"
            >
              {company.name}
            </button>
          ))}
          
          {searchTerm && (
            <button
              type="button"
              onClick={handleNewCompany}
              className="custom-dropdown-item highlight custom-dropdown-divider"
            >
              + 「{searchTerm}」を新規作成
            </button>
          )}
        </div>
      )}
      
      {isNewMode && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="custom-form-label">
              会社ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={value.id || ''}
              onChange={(e) => onChange({ ...value, id: e.target.value })}
              placeholder="例: kouwa-engineering"
              pattern="^[a-z0-9\-]+$"
              className="custom-form-input"
            />
            <p className="mt-1 text-xs text-gray-400">
              英数字とハイフンのみ使用可能（例: kouwa-engineering）
            </p>
          </div>
          <p className="text-sm text-blue-400">
            新規会社として登録されます
          </p>
        </div>
      )}
    </div>
  )
}

// 削除：ProductSelectorコンポーネントは不要になりました

// メインコンポーネント
export default function NewDrawingPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [drawings, setDrawings] = useState<DrawingFormData[]>([
    {
      drawingNumber: '',
      title: '',
      company: { type: 'existing', name: '' },
      product: { type: 'existing', name: '', category: '' },
      machineType: ['machining'],
      pdfFiles: [],
      programFiles: []
    }
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await loadCompanies()
        setCompanies(data)
      } catch (error) {
        console.error('会社データ読み込みエラー:', error)
      }
    }
    loadData()
  }, [])

  // 図番を追加
  // 図番を削除
  const removeDrawing = (index: number) => {
    if (drawings.length > 1) {
      setDrawings(drawings.filter((_, i) => i !== index))
    }
  }

  // 図番データを更新
  const updateDrawing = <K extends keyof DrawingFormData>(
    index: number,
    field: K,
    value: DrawingFormData[K]
  ) => {
    setDrawings((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const updateDrawingCompany = (index: number, company: DrawingFormData['company']) => {
    const newDrawings = [...drawings]
    newDrawings[index] = { ...newDrawings[index], company }
    setDrawings(newDrawings)
  }

  const updateDrawingProduct = (index: number, product: DrawingFormData['product']) => {
    const newDrawings = [...drawings]
    newDrawings[index] = { ...newDrawings[index], product }
    setDrawings(newDrawings)
  }

  // PDFファイルを更新（複数ファイル対応）
  const updatePdfFiles = (index: number, files: FileList | null) => {
    const newDrawings = [...drawings]
    newDrawings[index] = { ...newDrawings[index], pdfFiles: files ? Array.from(files) : [] }
    setDrawings(newDrawings)
  }

  // プログラムファイルを更新
  const updateProgramFiles = (index: number, files: FileList | null) => {
    const newDrawings = [...drawings]
    newDrawings[index] = { ...newDrawings[index], programFiles: files ? Array.from(files) : [] }
    setDrawings(newDrawings)
  }

  // バリデーション
  const validateForm = () => {
    const errors: string[] = []
    const existingIds = companies.map(c => c.id).filter(id => id) // 既存の会社ID一覧
    
    drawings.forEach((drawing, index) => {
      if (!drawing.drawingNumber.trim()) {
        errors.push(`図番 ${index + 1}: 図番は必須です`)
      }
      if (!drawing.title.trim()) {
        errors.push(`図番 ${index + 1}: タイトルは必須です`)
      }
      if (!drawing.company.name.trim()) {
        errors.push(`図番 ${index + 1}: 会社名は必須です`)
      }
      
      // 新規会社の場合はIDも必須
      if (drawing.company.type === 'new') {
        if (!drawing.company.id?.trim()) {
          errors.push(`図番 ${index + 1}: 新規会社の場合、会社IDは必須です`)
        } else {
          // 会社IDの形式チェック
          const idPattern = /^[a-z0-9-]+$/
          if (!idPattern.test(drawing.company.id)) {
            errors.push(`図番 ${index + 1}: 会社IDは英数字とハイフンのみ使用可能です`)
          }
          // 重複チェック
          if (existingIds.includes(drawing.company.id)) {
            errors.push(`図番 ${index + 1}: 会社ID「${drawing.company.id}」は既に使用されています`)
          }
        }
      }
      
      if (!drawing.product.name.trim()) {
        errors.push(`図番 ${index + 1}: 製品名は必須です`)
      }
      if (!drawing.product.category.trim()) {
        errors.push(`図番 ${index + 1}: カテゴリは必須です`)
      }

      if (!drawing.machineType || drawing.machineType.length === 0) {
        errors.push(`図番 ${index + 1}: 機械種別は最低1つ選択してください`)
      }
    })
    
    return errors
  }

  // 登録処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    const errors = validateForm()
    if (errors.length > 0) {
      setError(errors.join('\n'))
      return
    }
    
    setLoading(true)
    
    try {
      const formData = new FormData()
      // JSONデータからpdfFiles, programFilesを除外してシリアライズ
      const drawingsData = drawings.map(d => ({
        ...d,
        pdfFiles: undefined,
        programFiles: undefined
      }))
      
      // デバッグ用：送信データをログ出力
      console.log('送信データ:', drawingsData)
      
      formData.append('drawings', JSON.stringify(drawingsData))
      
      // PDFファイルを追加（複数対応）
      drawings.forEach((drawing) => {
        drawing.pdfFiles.forEach((file, fileIndex) => {
          formData.append(`pdf_${drawing.drawingNumber}_${fileIndex}`, file)
        })
      })
      
      // プログラムファイルを追加
      drawings.forEach((drawing) => {
        drawing.programFiles.forEach((file, fileIndex) => {
          formData.append(`program_${drawing.drawingNumber}_${fileIndex}`, file)
        })
      })
      
      const response = await fetch('/api/admin/drawings', {
        method: 'POST',
        headers: getAuthHeadersForFormData(),
        body: formData
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert(`${result.summary.successful}件の図番が正常に登録されました`)
      } else {
        // API からの詳細エラーメッセージを優先的に表示
        if (result.details && Array.isArray(result.details)) {
          setError(result.details.join('\n'))
        } else if (result.error) {
          setError(result.error)
        } else {
          setError('登録に失敗しました')
        }
      }
    } catch (error) {
      console.error('登録エラー:', error)
      setError('登録中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="flex justify-center px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">【新規図番登録】</h1>
        <form onSubmit={handleSubmit} className="space-y-8">
          {drawings.map((drawing, index) => (
            <div key={index} className="bg-white rounded-lg shadow p-6 border-2 border-gray-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  ＜図番 {index + 1}＞
                </h2>
                {drawings.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDrawing(index)}
                    className="text-red-600 hover:text-red-800 font-medium"
                  >
                    削除
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
                {/* 5. 図面PDF（複数対応） */}
                <div className="space-y-2 pb-6 border-b border-gray-200">
                  <label className="custom-form-label">
                    図面PDF（複数可）
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={(e) => updatePdfFiles(index, e.target.files)}
                    className="custom-file-input"
                  />
                  {drawing.pdfFiles.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      選択済み: {drawing.pdfFiles.map(f => f.name).join(', ')}
                    </div>
                  )}
                </div>

                {/* 6. プログラムファイル */}
                <div className="space-y-2 pb-6 border-b border-gray-200">
                  <label className="custom-form-label">
                    プログラムファイル（複数可）
                  </label>
                  <input
                    type="file"
                    accept=".nc,.min,.dxf,.dwg,.mcam,.txt,.zip,.stp,.step"
                    multiple
                    onChange={(e) => updateProgramFiles(index, e.target.files)}
                    className="custom-file-input"
                  />
                  {drawing.programFiles.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      選択済み: {drawing.programFiles.map(f => f.name).join(', ')}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    NC programs, dxf/STEP, ZIP files and other drawing assets
                  </p>
                </div>
                {/* 1. 会社名 */}
                <div className="space-y-2 pb-6 border-b border-gray-200">
                  <CompanySelector
                    companies={companies}
                    value={drawing.company}
                    onChange={(company) => updateDrawingCompany(index, company)}
                  />
                </div>

                {/* 2. 図番 */}
                <div className="space-y-2 pb-6 border-b border-gray-200">
                  <label className="custom-form-label">
                    図番 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={drawing.drawingNumber}
                    onChange={(e) => updateDrawing(index, 'drawingNumber', e.target.value)}
                    placeholder="ABC123"
                    className="custom-form-input"
                  />
                </div>


                {/* 3. 製品カテゴリ */}
                <div className="space-y-2 pb-6 border-b border-gray-200">
                  <label className="custom-form-label">
                    製品カテゴリ <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={drawing.product.category}
                      onChange={(e) => updateDrawingProduct(index, { ...drawing.product, category: e.target.value })}
                      placeholder="ブラケット、カバー、シャフト等"
                      className="custom-form-input"
                      list="categories-list"
                    />
                    <datalist id="categories-list">
                      {Array.from(new Set(
                        companies.flatMap(company => 
                          company.products.map(product => product.category)
                        )
                      )).sort().map(category => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* 4. 製品名（名称やあだ名） */}
                <div className="space-y-2 pb-6 border-b border-gray-200">
                  <label className="custom-form-label">
                    製品名 <span className="text-red-500">*</span>
                    <span className="text-sm text-gray-500">（名称やあだ名）</span>
                  </label>
                  <input
                    type="text"
                    value={drawing.product.name}
                    onChange={(e) => updateDrawingProduct(index, { ...drawing.product, name: e.target.value })}
                    placeholder="チェーンソー、ステンレスケーシング、スタンド（L or R）等"
                    className="custom-form-input"
                  />
                </div>


                {/* 7. 作業手順タイトル */}
                <div className="md:col-span-2 space-y-2 pb-6 border-b border-gray-200">
                  <label className="custom-form-label">
                    作業手順タイトル <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={drawing.title}
                    onChange={(e) => updateDrawing(index, 'title', e.target.value)}
                    placeholder="例：ブラケット（チェーンソー）加工手順"
                    className="custom-form-input"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    自動生成: {drawing.product.category && drawing.product.name ? 
                      `${drawing.product.category}（${drawing.product.name}）加工手順` : 
                      'カテゴリ（製品名）加工手順'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (drawing.product.category && drawing.product.name) {
                        updateDrawing(index, 'title', `${drawing.product.category}（${drawing.product.name}）加工手順`)
                      }
                    }}
                    className="mt-1 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                    disabled={!drawing.product.category || !drawing.product.name}
                  >
                    {drawing.product.category && drawing.product.name ? '自動生成を適用' : '製品名・カテゴリを入力してください'}
                  </button>
                </div>

                {/* 8. 機械種別 */}
                <div className="md:col-span-2 space-y-2 pb-6 border-b border-gray-200">
                  <label className="custom-form-label">
                    機械種別 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-4">
                    {MACHINE_TYPE_OPTIONS.map(({ key, label }) => {
                      const isChecked = drawing.machineType.includes(key)
                      return (
                        <label key={key} className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const currentTypes = drawing.machineType
                              const newTypes = e.target.checked
                                ? (currentTypes.includes(key) ? currentTypes : [...currentTypes, key])
                                : currentTypes.filter((t) => t !== key)
                              updateDrawing(index, 'machineType', newTypes)
                            }}
                            className="custom-checkbox mr-3"
                          />
                          <span style={{ fontSize: '1.25rem' }} className="font-medium text-gray-900">{label}</span>
                        </label>
                      )
                    })}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    選択中: {drawing.machineType.length ? drawing.machineType.map((key) => getMachineTypeJapanese(key)).join('、') : 'なし'}
                  </p>
                </div>
              </div>

            </div>
          ))}

          {/* エラー表示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-red-800 whitespace-pre-line">{error}</div>
            </div>
          )}

          {/* 登録ボタン */}
          <div className="flex justify-center space-x-4">
            <a
              href="/admin"
              className="custom-rect-button gray"
            >
              <span>キャンセル</span>
            </a>
            <FormButton
              type="submit"
              disabled={loading}
              loading={loading}
              variant="blue"
            >
              {loading ? '登録中...' : '登録'}
            </FormButton>
          </div>
        </form>
        </div>
      </main>
    </div>
  )
}
