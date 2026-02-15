'use client'
import { useEffect, useState } from 'react'

interface ContributionFormProps {
  drawingNumber: string
  targetSection: 'overview' | 'step' | 'general'
  stepNumber?: number
  onSubmit: () => void
  onCancel: () => void
}

type EmployeeOption = {
  id: string
  name: string
  displayName: string
}

type EmployeesApiResponse = {
  employees?: Array<{
    id?: string
    name?: string
    displayName?: string
  }>
}


export default function ContributionForm({ 
  drawingNumber, 
  targetSection, 
  stepNumber, 
  onSubmit, 
  onCancel 
}: ContributionFormProps) {
  const [userName, setUserName] = useState('')
  const [type, setType] = useState<'comment' | 'image' | 'video' | 'nearmiss' | 'troubleshoot'>('comment')
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(true)
  const [employeeLoadError, setEmployeeLoadError] = useState<string | null>(null)

  const showEmployeeSelect = employees.length > 0 && !employeeLoadError

  useEffect(() => {
    let cancelled = false

    const fetchEmployees = async () => {
      setIsEmployeesLoading(true)
      setEmployeeLoadError(null)
      try {
        const response = await fetch('/api/employees', { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`Failed to load employees (status: ${response.status})`)
        }

        const data = (await response.json()) as EmployeesApiResponse
        if (cancelled) {
          return
        }

        const employeesRaw = Array.isArray(data?.employees) ? data.employees : []
        const normalized = employeesRaw
          .filter((employee): employee is { id: string; name: string; displayName?: string } => {
            return typeof employee?.id === 'string' && typeof employee?.name === 'string'
          })
          .map((employee) => ({
            id: employee.id,
            name: employee.name,
            displayName: employee.displayName ?? employee.name,
          }))

        setEmployees(normalized)
      } catch (error) {
        console.error('従業員リストの読み込みに失敗しました:', error)
        if (!cancelled) {
          setEmployees([])
          setEmployeeLoadError('従業員リストの読み込みに失敗しました')
        }
      } finally {
        if (!cancelled) {
          setIsEmployeesLoading(false)
        }
      }
    }

    fetchEmployees()

    return () => {
      cancelled = true
    }
  }, [])


  const validateClientFiles = (files: File[]): { valid: boolean; error?: string } => {
    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
    const MAX_TOTAL_SIZE = 100 * 1024 * 1024 // 100MB
    const MAX_FILE_COUNT = 10
    
    // ファイル数チェック
    if (files.length > MAX_FILE_COUNT) {
      return { valid: false, error: `ファイル数が上限を超えています。最大${MAX_FILE_COUNT}ファイルまでです。` }
    }
    
    // 総容量チェック
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    if (totalSize > MAX_TOTAL_SIZE) {
      return { valid: false, error: `総ファイルサイズが大きすぎます。最大100MBまでです。` }
    }
    
    // 個別ファイルチェック
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: `ファイルサイズが大きすぎます。最大50MBまでです。(${file.name})` }
      }
      
      const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/webm', 'video/avi', 'video/mov'
      ]
      if (!allowedTypes.includes(file.type)) {
        return { valid: false, error: `サポートされていないファイル形式です。(${file.name})` }
      }
    }
    
    return { valid: true }
  }

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    
    // クライアントサイド検証
    const validation = validateClientFiles(selectedFiles)
    if (!validation.valid) {
      alert(`⚠️ ファイル選択エラー\n\n${validation.error}\n\n適切なファイルを選択してください。`)
      e.target.value = '' // ファイル選択をリセット
      return
    }
    
    setFiles(selectedFiles)
    
    if (selectedFiles.length > 0) {
      // 最初のファイルのタイプに基づいて追記タイプを設定
      const firstFile = selectedFiles[0]
      if (firstFile.type.startsWith('image/')) {
        setType('image')
      } else if (firstFile.type.startsWith('video/')) {
        setType('video')
      }
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedText = text.trim()
    const hasFiles = files.length > 0
    const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId)
    const effectiveUserId = showEmployeeSelect ? (selectedEmployee?.id ?? '') : userName.trim()
    const effectiveUserName = showEmployeeSelect ? (selectedEmployee?.name ?? '') : userName.trim()

    if (!effectiveUserId || !effectiveUserName) {
      alert('👤 従業員を選択してください。')
      return
    }

    if (!trimmedText && !hasFiles) {
      alert('👤 従業員と内容（またはファイル）を入力してください。\n\nあなたの貴重な経験をみんなで共有しましょう！')
      return
    }

    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('drawingNumber', drawingNumber)
      formData.append('userId', effectiveUserId)
      formData.append('userName', effectiveUserName)
      formData.append('type', type)
      formData.append('targetSection', targetSection)
      if (stepNumber) {
        formData.append('stepNumber', stepNumber.toString())
      }
      if (trimmedText) {
        formData.append('text', trimmedText)
      }
      
      // 複数ファイルを追加
      files.forEach(file => {
        formData.append('files', file)
      })

      const response = await fetch('/api/contribution', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        alert('🎉 ナレッジ共有ありがとうございます！\n\nあなたの知見が現場の品質向上に貢献します💪\nまた気づいたことがあれば、どんどん投稿してください！')
        onSubmit()
      } else {
        alert('投稿に失敗しました。もう一度お試しください。')
      }
    } catch (error) {
      console.error('投稿エラー:', error)
      alert('投稿中にエラーが発生しました。\n\n貴重な知見を失わないよう、もう一度投稿をお試しください！')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center" 
      style={{ 
        zIndex: 999999,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={onCancel}
    >
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4 text-gray-900">
          {targetSection === 'overview' ? '概要' : 
           targetSection === 'step' ? `ステップ ${stepNumber}` : '全般'}への追記
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              投稿者 <span className="text-red-500">*</span>
            </label>
            {showEmployeeSelect ? (
              <>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="custom-form-select"
                  required
                  disabled={isEmployeesLoading || isSubmitting}
                >
                  <option value="" disabled>
                    {isEmployeesLoading ? '従業員リストを読み込み中...' : '名前を選択してください'}
                  </option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.displayName}
                    </option>
                  ))}
                </select>
                {isEmployeesLoading && (
                  <p className="text-xs text-gray-500 mt-1">従業員リストを読み込み中です...</p>
                )}
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="custom-form-input"
                  placeholder="例: 田中太郎"
                  required
                  disabled={isSubmitting}
                />
                {employeeLoadError && (
                  <p className="text-xs text-amber-600 mt-1">
                    従業員リストを読み込めなかったため、手入力に切り替えています。
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              追記タイプ
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="custom-form-select"
              disabled={isSubmitting}
            >
              <option value="comment">コメント・注意点</option>
              <option value="image">画像追加</option>
              <option value="video">動画追加</option>
              <option value="nearmiss">ヒヤリハット事例</option>
              <option value="troubleshoot">トラブル対策</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              内容 {files.length === 0 && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="custom-form-textarea"
              placeholder="気づいた点、改善提案、注意事項など..."
              required={files.length === 0}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ファイル添付（画像・動画）
            </label>
            <input
              type="file"
              multiple
              onChange={handleFilesChange}
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,video/mp4,video/webm,video/avi,video/mov"
              className="custom-file-input"
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500 mt-1">
              📋 制限: 最大10ファイル、各ファイル50MB以下、総容量100MB以下<br/>
              🎯 対応形式: JPEG, PNG, GIF, WebP, MP4, WebM, AVI, MOV
            </p>
            
            {files.length > 0 && (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-gray-600">
                  選択済みファイル ({files.length}件):
                </p>
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                    <span className="text-gray-700">
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700 ml-2 px-4 py-2 rounded-lg text-base touch-manipulation hover:bg-red-50"
                      disabled={isSubmitting}
                    >
                      削除
                    </button>
                  </div>
                ))}
                <p className="text-xs text-gray-500">
                  総容量: {(files.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="custom-rect-button gray"
              disabled={isSubmitting}
            >
              <span>キャンセル</span>
            </button>
            <button
              type="submit"
              className="custom-rect-button blue"
              disabled={isSubmitting || (showEmployeeSelect && !selectedEmployeeId)}
            >
              <span>{isSubmitting ? '投稿中...' : '投稿'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

