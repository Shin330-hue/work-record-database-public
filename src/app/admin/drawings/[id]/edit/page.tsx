// src/app/admin/drawings/[id]/edit/page.tsx - 図番編集画面

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getAuthHeaders, getAuthHeadersForFormData } from '@/lib/auth/client'
import { loadWorkInstruction, loadSearchIndex, loadCompanies, loadContributions, WorkStep, NearMissItem, CuttingConditions } from '@/lib/dataLoader'
import { ContributionFile } from '@/types/contribution'
import { ImageLightbox } from '@/components/ImageLightbox'
import { 
  getMachineTypeKey, 
  getStepFolderName,
  MACHINE_TYPE_OPTIONS,
  MachineTypeKey,
  normalizeMachineTypeInput,
  getMachineTypeJapanese
} from '@/lib/machineTypeUtils'

interface EditFormData {
  drawingNumber: string
  title: string
  company: {
    id: string
    name: string
  }
  product: {
    id: string
    name: string
    category: string
  }
  difficulty: '初級' | '中級' | '上級'
  estimatedTime: string
  machineType: MachineTypeKey[]
  description: string
  keywords: string[]
  toolsRequired: string[]
  overview: {
    warnings: string[]
    preparationTime: string
    processingTime: string
    images: string[]
  }
  workSteps: WorkStep[]
  workStepsByMachine?: {
    machining?: WorkStep[]
    turning?: WorkStep[]
    yokonaka?: WorkStep[]
    radial?: WorkStep[]
    other?: WorkStep[]
  }
  nearMiss: NearMissItem[]
  relatedDrawings: Array<{
    drawingNumber: string
    relation: string
    description: string
  }>
}

type TabType = 'basic' | 'workSteps' | 'quality' | 'related' | 'contributions' | 'workStepsWithContributions' | 'machining' | 'turning' | 'yokonaka' | 'radial' | 'other'

export default function DrawingEdit() {
  const params = useParams()
  const drawingNumber = params.id as string

  const [formData, setFormData] = useState<EditFormData | null>(null)
  const [contributions, setContributions] = useState<ContributionFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('basic')
  const [uploadingFiles, setUploadingFiles] = useState<{[key: string]: boolean}>({})
  const [actualFiles, setActualFiles] = useState<{
    overview: { images: string[], videos: string[], pdfs: string[], programs: string[] },
    steps: { [key: string]: { images: string[], videos: string[] } }, // 後方互換性のため残す
    stepsByMachine?: {  // 機械種別ごとのステップファイル
      machining?: { images: string[], videos: string[] }[],
      turning?: { images: string[], videos: string[] }[],
      yokonaka?: { images: string[], videos: string[] }[],
      radial?: { images: string[], videos: string[] }[],
      other?: { images: string[], videos: string[] }[]
    }
  }>({
    overview: { images: [], videos: [], pdfs: [], programs: [] },
    steps: {},
    stepsByMachine: {}
  })
  // 削除予定ファイルの管理
  const [deletedFiles, setDeletedFiles] = useState<{
    fileName: string
    stepNumber: string
    fileType: string
    machineType?: MachineTypeKey  // 機械種別を追加
  }[]>([])
  // アップロード予定ファイルの管理
  const [pendingUploads, setPendingUploads] = useState<{
    file: File
    stepNumber: string
    fileType: string
    machineType?: MachineTypeKey  // 機械種別を追加
    previewUrl?: string
  }[]>([])
  // ライトボックス用の状態
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentImages, setCurrentImages] = useState<string[]>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // 機械種別の選択肢（新規登録画面と統一）
  const machineTypeOptions = MACHINE_TYPE_OPTIONS

  // 機械種別ごとの工程数と追記数を計算
  // 機械種別ごとの工程数を計算（将来的な使用のため保持）
  // const getStepCountByMachine = (machine: 'machining' | 'turning' | 'radial' | 'other'): number => {
  //   if (formData?.workStepsByMachine && formData.workStepsByMachine[machine]) {
  //     return formData.workStepsByMachine[machine]!.length
  //   }
  //   // 後方互換性: workStepsByMachineがない場合は、既存のworkStepsをマシニングとして扱う
  //   return machine === 'machining' ? (formData?.workSteps?.length || 0) : 0
  // }

  // タブ定義
  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'basic', label: '基本情報', icon: '📋' },
    { id: 'quality', label: 'ヒヤリハット', icon: '⚠️' },
    { id: 'machining', label: 'マシニング', icon: '🔧' },
    { id: 'turning', label: 'ターニング', icon: '🔧' },
    { id: 'yokonaka', label: '横中', icon: '🔧' },
    { id: 'radial', label: 'ラジアル', icon: '🔧' },
    { id: 'other', label: 'その他', icon: '🔧' },
    { id: 'related', label: '関連情報', icon: '🔗' }
  ]

  // データ読み込み関数を外部に定義
  const loadEditData = useCallback(async () => {
    try {
      if (!drawingNumber) {
        setError('図番が指定されていません')
        return
      }

      setLoading(true)
      setError('')

      // 並列でデータ読み込み
      const [workInstruction, searchIndex, companiesData, contributionsData] = await Promise.all([
        loadWorkInstruction(drawingNumber),
        loadSearchIndex(),
        loadCompanies(),
        loadContributions(drawingNumber)
      ])

      if (!workInstruction) {
        setError('図番データが見つかりません')
        return
      }

      // 検索インデックスから基本情報取得
      const searchItem = searchIndex.drawings.find(d => d.drawingNumber === drawingNumber)
      if (!searchItem) {
        setError('検索インデックスにデータが見つかりません')
        return
      }

      // 会社・製品情報の解決
      let companyInfo = { id: '', name: '' }
      let productInfo = { id: '', name: '', category: '' }

        for (const company of companiesData) {
          for (const product of company.products) {
            if (product.drawings.includes(drawingNumber)) {
              companyInfo = { id: company.id, name: company.name }
              productInfo = { 
                id: product.id, 
                name: product.name, 
                category: product.category 
              }
              break
            }
          }
          if (companyInfo.id) break
        }

        // デバッグ用ログ
        console.log('📋 読み込まれたメタデータ:', {
          difficulty: workInstruction.metadata.difficulty,
          estimatedTime: workInstruction.metadata.estimatedTime,
          machineType: workInstruction.metadata.machineType,
          title: workInstruction.metadata.title
        })

        const normalizedMachineTypes = normalizeMachineTypeInput(workInstruction.metadata.machineType)

        // フォームデータ構築
        const editData: EditFormData = {
          drawingNumber: workInstruction.metadata.drawingNumber,
          title: workInstruction.metadata.title,
          company: companyInfo,
          product: productInfo,
          difficulty: (workInstruction.metadata.difficulty || '中級') as '初級' | '中級' | '上級',
          estimatedTime: workInstruction.metadata.estimatedTime?.replace('分', '') || '180',
          machineType: normalizedMachineTypes,
          description: workInstruction.overview.description || '',
          keywords: searchItem.keywords || [],
          toolsRequired: workInstruction.metadata.toolsRequired || [],
          overview: {
            warnings: workInstruction.overview.warnings || [],
            preparationTime: workInstruction.overview.preparationTime?.replace('分', '') || '30',
            processingTime: workInstruction.overview.processingTime?.replace('分', '') || '60',
            images: []  // 実際のファイルはactualFilesで管理
          },
          workSteps: workInstruction.workSteps?.map(step => ({
            ...step,
            images: step.images || [],
            videos: step.videos || []
          })) || [],
          workStepsByMachine: workInstruction.workStepsByMachine || {
            machining: workInstruction.workSteps || [],  // 後方互換性
            turning: [],
            yokonaka: [],
            radial: [],
            other: []
          },
          nearMiss: workInstruction.nearMiss || [],
          relatedDrawings: workInstruction.relatedDrawings || []
        }

        console.log('🎯 構築されたフォームデータ:', editData)
        // 注: 画像・動画ファイルは別途actualFilesで管理されます

        setFormData(editData)
        setContributions(contributionsData)
    } catch (error) {
      console.error('編集データ読み込みエラー:', error)
      setError('データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [drawingNumber])

  // 初回読み込み用のuseEffect
  useEffect(() => {
    loadEditData()
  }, [loadEditData])

  // formDataが設定されたらファイル一覧を取得
  useEffect(() => {
    if (formData && drawingNumber) {
      loadActualFiles(drawingNumber)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, drawingNumber])

  // フォルダから実際のファイル一覧を取得する関数
  const loadActualFiles = async (drawingNumber: string) => {
    try {
      // Overview画像を取得
      const overviewImagesRes = await fetch(`/api/files?drawingNumber=${drawingNumber}&folderType=images&subFolder=overview`)
      const overviewImagesData = await overviewImagesRes.json()
      
      // Overview動画を取得
      const overviewVideosRes = await fetch(`/api/files?drawingNumber=${drawingNumber}&folderType=videos&subFolder=overview`)
      const overviewVideosData = await overviewVideosRes.json()

      // Overview PDFを取得
      const overviewPdfsRes = await fetch(`/api/files?drawingNumber=${drawingNumber}&folderType=pdfs&subFolder=overview`)
      const overviewPdfsData = await overviewPdfsRes.json()
      
      // Overview プログラムファイルを取得
      const overviewProgramsRes = await fetch(`/api/files?drawingNumber=${drawingNumber}&folderType=programs&subFolder=overview`)
      const overviewProgramsData = await overviewProgramsRes.json()

      const newActualFiles: typeof actualFiles = {
        overview: {
          images: overviewImagesData.data?.files || overviewImagesData.files || [],
          videos: overviewVideosData.data?.files || overviewVideosData.files || [],
          pdfs: overviewPdfsData.data?.files || overviewPdfsData.files || [],
          programs: overviewProgramsData.data?.files || overviewProgramsData.files || []
        },
        steps: {},
        stepsByMachine: {}  // 機械種別ごとのファイル
      }

      // 各ステップのファイルを取得（機械種別ごとに）
      if (formData) {
        // 機械種別ごとにファイルを取得
        for (const { key: machineKey } of machineTypeOptions) {
          const steps = formData.workStepsByMachine?.[machineKey] || []
          
          if (steps.length > 0) {
            const stepFiles: { images: string[], videos: string[] }[] = []
            
            for (let i = 0; i < steps.length; i++) {
              const folderName = getStepFolderName(i + 1, machineKey)
              
              // ステップ画像を取得
              const stepImagesRes = await fetch(`/api/files?drawingNumber=${drawingNumber}&folderType=images&subFolder=${folderName}`)
              const stepImagesData = await stepImagesRes.json()
              
              // ステップ動画を取得
              const stepVideosRes = await fetch(`/api/files?drawingNumber=${drawingNumber}&folderType=videos&subFolder=${folderName}`)
              const stepVideosData = await stepVideosRes.json()

              // 機械種別ごとの配列に追加
              stepFiles.push({
                images: stepImagesData.data?.files || stepImagesData.files || [],
                videos: stepVideosData.data?.files || stepVideosData.files || []
              })
            }
            
            // 機械種別ごとの配列を設定
            if (newActualFiles.stepsByMachine) {
              newActualFiles.stepsByMachine[machineKey] = stepFiles
            }
          }
        }
        
        // 旧形式のworkSteps（後方互換性）
        if (formData.workSteps && formData.workSteps.length > 0) {
          for (let i = 0; i < formData.workSteps.length; i++) {
            const stepNum = String(i + 1).padStart(2, '0')
            
            // ステップ画像を取得
            const stepImagesRes = await fetch(`/api/files?drawingNumber=${drawingNumber}&folderType=images&subFolder=step_${stepNum}`)
            const stepImagesData = await stepImagesRes.json()
            
            // ステップ動画を取得
            const stepVideosRes = await fetch(`/api/files?drawingNumber=${drawingNumber}&folderType=videos&subFolder=step_${stepNum}`)
            const stepVideosData = await stepVideosRes.json()

            newActualFiles.steps[`step_${(i + 1).toString().padStart(2, '0')}`] = {
              images: stepImagesData.data?.files || stepImagesData.files || [],
              videos: stepVideosData.data?.files || stepVideosData.files || []
            }
          }
        }
      }

      setActualFiles(newActualFiles)
      console.log('📁 実際のファイル一覧:', newActualFiles)
    } catch (error) {
      console.error('ファイル一覧取得エラー:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData) return

    setSaving(true)
    setError('')

    try {
      const updateData = {
        ...formData,
        machineType: formData.machineType,
        keywords: formData.keywords.join(','),
        toolsRequired: formData.toolsRequired.join(','),
        overview: {
          ...formData.overview,
          warnings: formData.overview.warnings.filter(w => w.trim())
        },
        workSteps: formData.workSteps,
        workStepsByMachine: formData.workStepsByMachine,
        nearMiss: formData.nearMiss,
        relatedDrawings: formData.relatedDrawings
      }

      // デバッグ用ログ
      console.log('🚀 送信データ:', updateData)

      const response = await fetch(`/api/admin/drawings/${drawingNumber}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `更新エラー: ${response.status}`)
      }
      
      if (result.success) {
        // 削除予定ファイルを実際に削除
        if (deletedFiles.length > 0) {
          console.log(`📁 削除予定ファイル: ${deletedFiles.length}件`)
          
          for (const file of deletedFiles) {
            try {
              const deleteResponse = await fetch(`/api/admin/drawings/${drawingNumber}/files`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                  fileName: file.fileName,
                  stepNumber: file.stepNumber,
                  fileType: file.fileType,
                  machineType: file.machineType  // 機械種別を追加
                })
              })
              
              if (!deleteResponse.ok) {
                const errorData = await deleteResponse.json()
                console.error(`ファイル削除エラー: ${file.fileName}`, errorData)
              } else {
                console.log(`✅ ファイル削除成功: ${file.fileName}`)
              }
            } catch (error) {
              console.error(`ファイル削除失敗: ${file.fileName}`, error)
            }
          }
          
          // 削除予定リストをクリア
          setDeletedFiles([])
        }
        
        // アップロード予定ファイルを実際にアップロード
        if (pendingUploads.length > 0) {
          console.log(`📁 アップロード予定ファイル: ${pendingUploads.length}件`)
          
          for (const upload of pendingUploads) {
            const formDataUpload = new FormData()
            formDataUpload.append('file', upload.file)
            formDataUpload.append('stepNumber', upload.stepNumber)
            formDataUpload.append('fileType', upload.fileType)
            if (upload.machineType) {
              formDataUpload.append('machineType', upload.machineType)
            }
            
            try {
              const uploadResponse = await fetch(`/api/admin/drawings/${drawingNumber}/files`, {
                method: 'POST',
                headers: getAuthHeadersForFormData(),
                body: formDataUpload
              })
              
              if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json()
                console.error(`ファイルアップロードエラー: ${upload.file.name}`, errorData)
              } else {
                console.log(`✅ ファイルアップロード成功: ${upload.file.name}`)
              }
            } catch (error) {
              console.error(`ファイルアップロード失敗: ${upload.file.name}`, error)
            }
            
            // プレビューURLのクリーンアップ
            if (upload.previewUrl) {
              URL.revokeObjectURL(upload.previewUrl)
            }
          }
          
          // アップロード予定リストをクリア
          setPendingUploads([])
        }
        
        alert('図番情報が正常に更新されました')
        // データを再読み込みして編集画面に留まる
        await loadEditData()
      } else {
        throw new Error(result.error || '更新に失敗しました')
      }
    } catch (error) {
      console.error('更新エラー:', error)
      setError(error instanceof Error ? error.message : '更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleMachineTypeChange = (machine: MachineTypeKey, checked: boolean) => {
    if (!formData) return

    setFormData(prev => {
      if (!prev) return prev

      const newMachineTypes = checked
        ? (prev.machineType.includes(machine) ? prev.machineType : [...prev.machineType, machine])
        : prev.machineType.filter(m => m !== machine)

      return {
        ...prev,
        machineType: newMachineTypes
      }
    })
  }

  const handleKeywordsChange = (keywordsString: string) => {
    if (!formData) return

    setFormData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        keywords: keywordsString.split(',').map(k => k.trim()).filter(k => k)
      }
    })
  }

  const handleToolsRequiredChange = (toolsString: string) => {
    if (!formData) return

    setFormData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        toolsRequired: toolsString.split(',').map(t => t.trim()).filter(t => t)
      }
    })
  }

  // 警告事項の配列操作ハンドラー
  const handleWarningChange = (index: number, value: string) => {
    if (!formData) return

    setFormData(prev => {
      if (!prev) return prev
      const newWarnings = [...prev.overview.warnings]
      newWarnings[index] = value
      return {
        ...prev,
        overview: { ...prev.overview, warnings: newWarnings }
      }
    })
  }

  const addWarning = () => {
    if (!formData) return

    setFormData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        overview: { ...prev.overview, warnings: [...prev.overview.warnings, ''] }
      }
    })
  }

  const removeWarning = (index: number) => {
    if (!formData) return

    setFormData(prev => {
      if (!prev) return prev
      const newWarnings = prev.overview.warnings.filter((_, i) => i !== index)
      return {
        ...prev,
        overview: { ...prev.overview, warnings: newWarnings }
      }
    })
  }

  // 作業ステップ操作ハンドラー（workStepsByMachine対応）
  const addWorkStep = (machineType?: MachineTypeKey) => {
    if (!formData) return

    // 後方互換性: machineTypeが指定されていない場合は従来のworkStepsを使用
    if (!machineType) {
      const newStep: WorkStep = {
        stepNumber: formData.workSteps.length + 1,
        title: `ステップ ${formData.workSteps.length + 1}`,
        description: '',
        detailedInstructions: [],
        images: [],
        videos: [],
        timeRequired: '30分',
        warningLevel: 'normal',
        qualityCheck: {
          items: []
        }
      }

      setFormData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          workSteps: [...prev.workSteps, newStep]
        }
      })
      return
    }

    // workStepsByMachine対応
    const currentSteps = formData.workStepsByMachine?.[machineType] || []
    const newStep: WorkStep = {
      stepNumber: currentSteps.length + 1,
      title: `ステップ ${currentSteps.length + 1}`,
      description: '',
      detailedInstructions: [],
      images: [],
      videos: [],
      timeRequired: '30分',
      warningLevel: 'normal',
      qualityCheck: {
        items: []
      }
    }

    setFormData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        workStepsByMachine: {
          ...prev.workStepsByMachine,
          [machineType]: [...currentSteps, newStep]
        }
      }
    })
  }

  const updateWorkStep = (index: number, updatedStep: WorkStep, machineType?: MachineTypeKey) => {
    if (!formData) return

    // 後方互換性: machineTypeが指定されていない場合は従来のworkStepsを使用
    if (!machineType) {
      setFormData(prev => {
        if (!prev) return prev
        const newWorkSteps = [...prev.workSteps]
        newWorkSteps[index] = updatedStep
        return {
          ...prev,
          workSteps: newWorkSteps
        }
      })
      return
    }

    // workStepsByMachine対応
    setFormData(prev => {
      if (!prev) return prev
      const currentSteps = prev.workStepsByMachine?.[machineType] || []
      const newSteps = [...currentSteps]
      newSteps[index] = updatedStep
      return {
        ...prev,
        workStepsByMachine: {
          ...prev.workStepsByMachine,
          [machineType]: newSteps
        }
      }
    })
  }

  const deleteWorkStep = (index: number, machineType?: MachineTypeKey) => {
    if (!formData) return
    
    if (!confirm('このステップを削除しますか？')) return

    // 後方互換性: machineTypeが指定されていない場合は従来のworkStepsを使用
    if (!machineType) {
      setFormData(prev => {
        if (!prev) return prev
        const newWorkSteps = prev.workSteps.filter((_, i) => i !== index)
        // ステップ番号を再調整
        return {
          ...prev,
          workSteps: newWorkSteps.map((step, i) => ({ ...step, stepNumber: i + 1 }))
        }
      })
      return
    }

    // workStepsByMachine対応
    setFormData(prev => {
      if (!prev) return prev
      const currentSteps = prev.workStepsByMachine?.[machineType] || []
      const newSteps = currentSteps.filter((_, i) => i !== index)
      // ステップ番号を再調整
      return {
        ...prev,
        workStepsByMachine: {
          ...prev.workStepsByMachine,
          [machineType]: newSteps.map((step, i) => ({ ...step, stepNumber: i + 1 }))
        }
      }
    })
  }

  const moveWorkStep = (fromIndex: number, toIndex: number, machineType?: MachineTypeKey) => {
    if (!formData) return

    // 後方互換性: machineTypeが指定されていない場合は従来のworkStepsを使用
    if (!machineType) {
      setFormData(prev => {
        if (!prev) return prev
        const newWorkSteps = [...prev.workSteps]
        const [movedStep] = newWorkSteps.splice(fromIndex, 1)
        newWorkSteps.splice(toIndex, 0, movedStep)
        // ステップ番号を再調整
        return {
          ...prev,
          workSteps: newWorkSteps.map((step, i) => ({ ...step, stepNumber: i + 1 }))
        }
      })
      return
    }

    // workStepsByMachine対応
    setFormData(prev => {
      if (!prev) return prev
      const currentSteps = [...(prev.workStepsByMachine?.[machineType] || [])]
      const [movedStep] = currentSteps.splice(fromIndex, 1)
      currentSteps.splice(toIndex, 0, movedStep)
      // ステップ番号を再調整
      return {
        ...prev,
        workStepsByMachine: {
          ...prev.workStepsByMachine,
          [machineType]: currentSteps.map((step, i) => ({ ...step, stepNumber: i + 1 }))
        }
      }
    })
  }

  // ヒヤリハット事例操作ハンドラー
  const handleNearMissChange = (index: number, field: keyof NearMissItem, value: string) => {
    if (!formData) return

    setFormData(prev => {
      if (!prev) return prev
      const newNearMiss = [...prev.nearMiss]
      newNearMiss[index] = { ...newNearMiss[index], [field]: value }
      return {
        ...prev,
        nearMiss: newNearMiss
      }
    })
  }

  const addNearMiss = () => {
    if (!formData) return

    const newNearMissItem: NearMissItem = {
      title: '',
      description: '',
      cause: '',
      prevention: '',
      severity: 'medium'
    }

    setFormData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        nearMiss: [...prev.nearMiss, newNearMissItem]
      }
    })
  }

  const removeNearMiss = (index: number) => {
    if (!formData) return

    setFormData(prev => {
      if (!prev) return prev
      const newNearMiss = prev.nearMiss.filter((_, i) => i !== index)
      return {
        ...prev,
        nearMiss: newNearMiss
      }
    })
  }

  // ファイル操作ハンドラー
  const handleFileUpload = async (stepIndex: number, fileType: 'images' | 'videos', files: FileList | null, machineType?: MachineTypeKey) => {
    if (!files || !formData) return

    // アップロード予定に追加（実際のアップロードは更新時）
    const newPendingUploads: typeof pendingUploads = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const previewUrl = fileType === 'images' ? URL.createObjectURL(file) : undefined
      
      newPendingUploads.push({
        file,
        stepNumber: (stepIndex + 1).toString(),
        fileType,
        machineType,  // 機械種別を保存
        previewUrl
      })
    }

    setPendingUploads(prev => [...prev, ...newPendingUploads])

    // プレビュー用にactualFilesに仮追加（ファイル名の代わりにpreviewUrlを使用）
    const previewFileNames = newPendingUploads
      .filter(upload => upload.fileType === fileType)
      .map(upload => upload.previewUrl || `[保留] ${upload.file.name}`)

    // 機械種別に応じてactualFilesを更新
    if (machineType) {
      const machineKey = getMachineTypeKey(machineType)
      setActualFiles(prev => {
        // stepsByMachineが存在しない場合は初期化
        const newStepsByMachine = { ...(prev.stepsByMachine || {}) } as typeof prev.stepsByMachine
        
        // 対象の機械種別の配列を確実に初期化
        if (!newStepsByMachine?.[machineKey]) {
          newStepsByMachine![machineKey] = []
        }
        
        // 現在の機械種別のステップ配列をコピー
        const machineSteps = [...(newStepsByMachine?.[machineKey] || [])]
        
        // ステップが存在しない場合は初期化
        while (machineSteps.length <= stepIndex) {
          machineSteps.push({ images: [], videos: [] })
        }
        
        // 現在のステップを明確に取得して更新
        const currentStep = machineSteps[stepIndex] || { images: [], videos: [] }
        machineSteps[stepIndex] = {
          images: fileType === 'images' 
            ? [...(currentStep.images || []), ...previewFileNames]
            : currentStep.images || [],
          videos: fileType === 'videos'
            ? [...(currentStep.videos || []), ...previewFileNames]
            : currentStep.videos || []
        }
        
        // 更新した配列を設定
        newStepsByMachine![machineKey] = machineSteps
        
        return {
          ...prev,
          stepsByMachine: newStepsByMachine
        }
      })
    } else {
      // 後方互換性のための旧形式更新
      setActualFiles(prev => ({
        ...prev,
        steps: {
          ...prev.steps,
          [stepIndex]: {
            ...prev.steps[stepIndex] || { images: [], videos: [] },
            [fileType]: [...(prev.steps[stepIndex]?.[fileType] || []), ...previewFileNames]
          }
        }
      }))
    }
  }

  const removeStepFile = async (
    stepIndex: number,
    fileType: 'images' | 'videos',
    fileIndex: number,
    machineType?: MachineTypeKey
  ) => {
    const hasMachineSteps = machineType && actualFiles.stepsByMachine
    const machineKey = hasMachineSteps ? getMachineTypeKey(machineType!) : null
    const machineSteps = machineKey ? actualFiles.stepsByMachine?.[machineKey] || [] : undefined
    const targetStep = machineKey ? machineSteps?.[stepIndex] : actualFiles.steps[stepIndex]

    if (!targetStep || !targetStep[fileType][fileIndex]) {
      return
    }

    const fileName = targetStep[fileType][fileIndex]

    const updateActualFilesView = () => {
      if (machineKey) {
        setActualFiles(prev => {
          const stepsByMachine = { ...(prev.stepsByMachine || {}) }
          const machineStepsPrev = [...(stepsByMachine[machineKey] || [])]
          if (machineStepsPrev[stepIndex]) {
            machineStepsPrev[stepIndex] = {
              ...machineStepsPrev[stepIndex],
              [fileType]: machineStepsPrev[stepIndex][fileType].filter((_, i) => i !== fileIndex)
            }
            stepsByMachine[machineKey] = machineStepsPrev
          }
          return {
            ...prev,
            stepsByMachine
          }
        })
      } else {
        setActualFiles(prev => {
          const stepsPrev = { ...prev.steps }
          const step = stepsPrev[stepIndex]
          if (step) {
            stepsPrev[stepIndex] = {
              ...step,
              [fileType]: step[fileType].filter((_, i) => i !== fileIndex)
            }
          }
          return {
            ...prev,
            steps: stepsPrev
          }
        })
      }
    }

    if (fileName.startsWith('blob:')) {
      if (!confirm('新規アップロード予定ファイルを削除しますか？')) {
        return
      }

      setPendingUploads(prev =>
        prev.filter(upload => {
          if (
            upload.stepNumber === (stepIndex + 1).toString() &&
            upload.fileType === fileType &&
            upload.previewUrl === fileName
          ) {
            URL.revokeObjectURL(fileName)
            return false
          }
          return true
        })
      )

      updateActualFilesView()
      return
    }

    if (!confirm(`${fileName} を削除しますか？（更新ボタンを押すまで実際には削除されません）`)) {
      return
    }

    setDeletedFiles(prev => [
      ...prev,
      {
        fileName,
        stepNumber: (stepIndex + 1).toString(),
        fileType,
        machineType
      }
    ])

    updateActualFilesView()
  }

  // PDF・プログラムファイルの削除処理
  const removePdfOrProgramFile = async (fileName: string, fileType: 'pdfs' | 'programs') => {
    if (!confirm(`${fileName} を削除しますか？（更新ボタンを押すまで実際には削除されません）`)) return

    // 削除予定リストに追加
    setDeletedFiles(prev => [...prev, {
      fileName,
      stepNumber: '0',
      fileType
    }])

    // UIから削除（実際の削除は更新時）
    setActualFiles(prev => ({
      ...prev,
      overview: {
        ...prev.overview,
        [fileType]: prev.overview[fileType].filter(f => f !== fileName)
      }
    }))
  }

  // PDF・プログラムファイルの一括アップロード処理
  const handleBatchFileUpload = async (files: FileList | null, fileType: 'pdf' | 'program') => {
    if (!files || !formData || files.length === 0) return

    const uploadKey = `overview-${fileType}s`
    setUploadingFiles(prev => ({ ...prev, [uploadKey]: true }))

    try {
      const formDataUpload = new FormData()
      formDataUpload.append('stepNumber', '0') // overview用

      // 複数ファイルを追加
      for (let i = 0; i < files.length; i++) {
        formDataUpload.append('files', files[i])
      }

      const response = await fetch(`/api/admin/drawings/${drawingNumber}/files/batch`, {
        method: 'POST',
        headers: getAuthHeadersForFormData(),
        body: formDataUpload
      })

      if (response.ok) {
        const result = await response.json()
        
        // ファイル一覧を再読み込み
        await loadActualFiles(drawingNumber)
        
        if (result.errors && result.errors.length > 0) {
          // 部分的なエラーがある場合
          const errorMessages = result.errors.map((e: { file: string; error: string }) => `${e.file}: ${e.error}`).join('\n')
          alert(`一部のファイルでエラーが発生しました:\n${errorMessages}`)
        }
      } else {
        const errorData = await response.json()
        alert(`アップロードに失敗しました: ${errorData.error || 'エラーが発生しました'}`)
      }
    } catch (error) {
      console.error('ファイルアップロードエラー:', error)
      alert('ファイルのアップロードに失敗しました')
    } finally {
      setUploadingFiles(prev => ({ ...prev, [uploadKey]: false }))
    }
  }

  // 概要画像操作ハンドラー
  const handleOverviewImageUpload = async (files: FileList | null) => {
    if (!files || !formData) return

    // アップロード予定に追加（実際のアップロードは更新時）
    const newPendingUploads: typeof pendingUploads = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const previewUrl = URL.createObjectURL(file)
      
      newPendingUploads.push({
        file,
        stepNumber: '0',  // overview用
        fileType: 'images',
        previewUrl
      })
    }

    setPendingUploads(prev => [...prev, ...newPendingUploads])

    // プレビュー用にactualFilesに仮追加
    const previewFileNames = newPendingUploads
      .filter(upload => upload.previewUrl)
      .map(upload => upload.previewUrl!)

    setActualFiles(prev => ({
      ...prev,
      overview: {
        ...prev.overview,
        images: [...prev.overview.images, ...previewFileNames]
      }
    }))
  }

  const removeOverviewImage = async (imageIndex: number) => {
    if (!actualFiles.overview.images[imageIndex]) return

    const fileName = actualFiles.overview.images[imageIndex]
    
    if (!confirm(`${fileName} を削除しますか？（更新ボタンを押すまで実際には削除されません）`)) return

    // 削除予定リストに追加
    setDeletedFiles(prev => [...prev, {
      fileName,
      stepNumber: '0',
      fileType: 'images'
    }])

    // UIから削除（実際の削除は更新時）
    setActualFiles(prev => ({
      ...prev,
      overview: {
        ...prev.overview,
        images: prev.overview.images.filter((_, i) => i !== imageIndex)
      }
    }))
  }

  // テキストをクリップボードにコピー
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('コピーに失敗しました:', err)
    }
  }

  // 追記管理ハンドラー
  const handleMergeContribution = async (contributionIndex: number) => {
    if (!contributions) return

    const targetContribution = contributions.contributions[contributionIndex]
    if (!targetContribution) return

    try {
      const response = await fetch(`/api/admin/contributions/${drawingNumber}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'updateStatus',
          contributionId: targetContribution.id,
          status: 'merged'
        }),
      })

      if (response.ok) {
        // ローカル状態更新
        setContributions(prev => {
          if (!prev) return prev
          const updatedContributions = [...prev.contributions]
          updatedContributions[contributionIndex] = {
            ...updatedContributions[contributionIndex],
            status: 'merged'
          }
          return {
            ...prev,
            contributions: updatedContributions,
            metadata: {
              ...prev.metadata,
              mergedCount: updatedContributions.filter(c => c.status === 'merged').length
            }
          }
        })
        alert('追記情報から消しました')
      } else {
        throw new Error('ステータス更新に失敗しました')
      }
    } catch (error) {
      console.error('ステータス更新エラー:', error)
      alert('ステータス更新処理に失敗しました')
    }
  }



  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">編集データを読み込んでいます...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ エラー</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link 
            href="/admin/drawings/list"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← 図番一覧に戻る
          </Link>
        </div>
      </div>
    )
  }

  if (!formData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">データがありません</p>
        </div>
      </div>
    )
  }

  return (
    <div className={activeTab === 'workStepsWithContributions' ? "bg-gray-50" : "min-h-screen bg-gray-50"}>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white text-center flex-1">
            【図番編集】 {formData.drawingNumber}
          </h1>
          <div className="flex space-x-4">
            <Link
              href="/admin/drawings/list"
              className="custom-rect-button gray small"
            >
              <span>図番一覧検索</span>
            </Link>
            <Link
              href="/admin/contributions"
              className="custom-rect-button emerald small"
            >
              <span>追記管理</span>
            </Link>
          </div>
        </div>
        
        {/* タブナビゲーション */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`custom-rect-button small ${
                    activeTab === tab.id ? 'emerald' : 'gray'
                  }`}
                >
                  <span>
                    {tab.icon} {tab.label}
                    {tab.id === 'workStepsWithContributions' && contributions && contributions.contributions.filter(c => c.status === 'active').length > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                        【{contributions.contributions.filter(c => c.status === 'active').length}件】
                      </span>
                    )}
                  </span>
                </button>
              ))}
              </nav>
            </div>
          </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 基本情報タブ */}
          {activeTab === 'basic' && (
            <>
              {/* 基本情報 */}
              <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-6">基本情報</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="custom-form-label">
                  図番 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.drawingNumber}
                  disabled
                  className="custom-form-input cursor-not-allowed"
                  style={{ backgroundColor: '#1f2937', color: '#e5e7eb' }}
                />
                <p className="text-xs text-gray-500 mt-1">図番は変更できません</p>
              </div>
              
              <div>
                <label className="custom-form-label">
                  作業手順タイトル <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => prev ? { ...prev, title: e.target.value } : prev)}
                  className="custom-form-input"
                  required
                />
              </div>
            </div>
          </div>

          {/* 会社・製品情報 */}
          <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-6">会社・製品情報</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="custom-form-label">
                  会社名
                </label>
                <input
                  type="text"
                  value={formData.company.name}
                  disabled
                  className="custom-form-input cursor-not-allowed"
                  style={{ backgroundColor: '#1f2937', color: '#e5e7eb' }}
                />
                <p className="text-xs text-gray-500 mt-1">会社情報は変更できません</p>
              </div>
              
              <div>
                <label className="custom-form-label">
                  製品名
                </label>
                <input
                  type="text"
                  value={formData.product.name}
                  onChange={(e) => setFormData(prev => prev ? { 
                    ...prev, 
                    product: { ...prev.product, name: e.target.value }
                  } : prev)}
                  className="custom-form-input"
                />
                <p className="text-xs text-gray-500 mt-1">製品IDは変更されません</p>
              </div>
            </div>
          </div>

          {/* 作業詳細 */}
          <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-6">作業詳細</h2>

            <div>
              <label className="custom-form-label mb-3">
                機械種別 <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-4">
                {machineTypeOptions.map(({ key, label }) => (
                  <label key={key} className="flex items-center cursor-pointer hover:opacity-80">
                    <input
                      type="checkbox"
                      checked={formData.machineType.includes(key)}
                      onChange={(e) => handleMachineTypeChange(key, e.target.checked)}
                      className="custom-checkbox mr-3"
                    />
                    <span className="text-white font-medium" style={{ fontSize: '1.125rem' }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                必要工具
              </label>
              <input
                type="text"
                value={formData.toolsRequired.join(', ')}
                onChange={(e) => handleToolsRequiredChange(e.target.value)}
                className="custom-form-input"
                placeholder="必要工具をカンマ区切りで入力..."
              />
              <p className="text-xs text-gray-500 mt-1">
                作業に必要な工具をカンマ区切りで入力してください
              </p>
            </div>

            <div className="mt-6">
              <label className="custom-form-label">
                注意事項
              </label>
              <div className="space-y-2">
                {formData.overview.warnings.map((warning, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={warning}
                      onChange={(e) => handleWarningChange(index, e.target.value)}
                      className="custom-form-input"
                      placeholder="注意事項を入力..."
                    />
                    <button
                      type="button"
                      onClick={() => removeWarning(index)}
                      className="custom-rect-button red tiny"
                    >
                      削除
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addWarning}
                  className="custom-rect-button emerald small"
                >
                  <span>+ 注意事項を追加</span>
                </button>
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                説明・備考
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => prev ? { ...prev, description: e.target.value } : prev)}
                rows={4}
                className="custom-form-textarea"
                placeholder="作業の概要や注意点を入力してください..."
              />
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                検索キーワード
              </label>
              <input
                type="text"
                value={formData.keywords.join(', ')}
                onChange={(e) => handleKeywordsChange(e.target.value)}
                className="custom-form-input"
                placeholder="キーワードをカンマ区切りで入力..."
              />
              <p className="text-xs text-gray-500 mt-1">
                検索で見つけやすくするためのキーワードです
              </p>
            </div>
          </div>

          {/* 図面PDFセクション */}
          <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-6">図面PDF</h2>
            <div className="space-y-2">
              {actualFiles.overview.pdfs.length > 0 ? actualFiles.overview.pdfs.map((pdf, pdfIndex) => (
                <div key={pdfIndex} className="border border-gray-200 rounded-md bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <a
                      href={`/api/files?drawingNumber=${drawingNumber}&folderType=pdfs&subFolder=overview&fileName=${encodeURIComponent(pdf)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
                    >
                      📄 {pdf}
                    </a>
                    <button
                      type="button"
                      onClick={() => removePdfOrProgramFile(pdf, 'pdfs')}
                      className="custom-rect-button red tiny"
                    >
                      削除
                    </button>
                  </div>
                </div>
              )) : (
                <div className="text-center py-4 text-gray-500">
                  図面PDFはありません
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={(e) => handleBatchFileUpload(e.target.files, 'pdf')}
                  disabled={uploadingFiles['overview-pdfs']}
                  className="hidden"
                  id="pdf-upload"
                />
                <label
                  htmlFor="pdf-upload"
                  className={`custom-file-input ${
                    uploadingFiles['overview-pdfs'] ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <span>{uploadingFiles['overview-pdfs'] ? 'アップロード中...' : '+ PDFファイルを追加'}</span>
                </label>
              </div>
            </div>
          </div>

          {/* プログラムファイルセクション */}
          <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-6">プログラムファイル</h2>
            <div className="space-y-2">
              {actualFiles.overview.programs.length > 0 ? actualFiles.overview.programs.map((program, programIndex) => (
                <div key={programIndex} className="border border-gray-200 rounded-md bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <a
                      href={`/api/files?drawingNumber=${drawingNumber}&folderType=programs&subFolder=overview&fileName=${encodeURIComponent(program)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
                    >
                      📝 {program}
                    </a>
                    <button
                      type="button"
                      onClick={() => removePdfOrProgramFile(program, 'programs')}
                      className="custom-rect-button red tiny"
                    >
                      削除
                    </button>
                  </div>
                </div>
              )) : (
                <div className="text-center py-4 text-gray-500">
                  プログラムファイルはありません
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  accept=".nc,.txt,.tap,.pgm,.mpf,.ptp,.gcode,.cnc,.min,.eia,.dxf,.dwg,.mcam,.zip,.stp,.step"
                  multiple
                  onChange={(e) => handleBatchFileUpload(e.target.files, 'program')}
                  disabled={uploadingFiles['overview-programs']}
                  className="hidden"
                  id="program-upload"
                />
                <label
                  htmlFor="program-upload"
                  className={`custom-file-input ${
                    uploadingFiles['overview-programs'] ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <span>{uploadingFiles['overview-programs'] ? 'アップロード中...' : '+ プログラムファイルを追加'}</span>
                </label>
                <p className="text-xs text-gray-500">
                  NCプログラム、Gコード等の加工プログラムファイル
                </p>
              </div>
            </div>
          </div>

          {/* 概要画像セクション */}
          <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-6">概要画像</h2>
            <div>
              {actualFiles.overview.images.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
                  {actualFiles.overview.images.map((image, imgIndex) => (
                    <div key={imgIndex} className="relative group">
                      <div className="aspect-square bg-gray-100 rounded-md overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border border-gray-200"
                        onClick={() => {
                          const imageUrls = actualFiles.overview.images.map(img => 
                            img.startsWith('blob:') ? img : `/api/files?drawingNumber=${drawingNumber}&folderType=images&subFolder=overview&fileName=${encodeURIComponent(img)}`
                          );
                          const currentIdx = actualFiles.overview.images.indexOf(image);
                          setCurrentImages(imageUrls);
                          setCurrentImageIndex(currentIdx);
                          setLightboxOpen(true);
                        }}>
                        <img
                          src={image.startsWith('blob:') ? image : `/api/files?drawingNumber=${drawingNumber}&folderType=images&subFolder=overview&fileName=${encodeURIComponent(image)}`}
                          alt={`概要画像 - ${image}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            const parent = e.currentTarget.parentElement
                            if (parent && !parent.querySelector('.error-message')) {
                              const errorDiv = document.createElement('div')
                              errorDiv.className = 'error-message flex items-center justify-center h-full text-gray-400'
                              errorDiv.innerHTML = '<span>画像を読み込めません</span>'
                              parent.appendChild(errorDiv)
                            }
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOverviewImage(imgIndex)}
                        className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded px-1.5 py-0.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                      >
                        削除
                      </button>
                      <div className="mt-0.5 text-xs text-gray-500 truncate" title={image}>
                        {image}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  概要画像はありません
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleOverviewImageUpload(e.target.files)}
                  className="hidden"
                  id="overview-image-upload"
                />
                <label
                  htmlFor="overview-image-upload"
                  className={`custom-file-input ${
                    uploadingFiles['overview-images'] ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <span>{uploadingFiles['overview-images'] ? 'アップロード中...' : '+ 概要画像を追加'}</span>
                </label>
              </div>
            </div>
          </div>
          
          {/* アップロード予定ファイル表示（基本情報タブの概要画像のみ） */}
          {activeTab === 'basic' && pendingUploads.filter(u => u.stepNumber === '0').length > 0 && (
            <div className="bg-blue-900 p-4 rounded-lg shadow border border-blue-700 mt-4">
              <h3 className="text-lg font-semibold text-blue-300 mb-2">
                📤 概要画像アップロード予定 ({pendingUploads.filter(u => u.stepNumber === '0').length}件)
              </h3>
              <p className="text-sm text-blue-200 mb-3">
                以下のファイルは更新ボタンを押すとアップロードされます。
              </p>
              <div className="space-y-2">
                {pendingUploads.filter(u => u.stepNumber === '0').map((upload) => {
                  // 元の配列でのインデックスを取得
                  const actualIndex = pendingUploads.findIndex(u => u === upload)
                  return (
                    <div key={actualIndex} className="flex items-center justify-between bg-gray-800 p-2 rounded">
                      <div className="flex items-center space-x-2">
                        {upload.previewUrl && (
                          <img 
                            src={upload.previewUrl} 
                            alt={upload.file.name}
                            className="w-10 h-10 object-cover rounded"
                          />
                        )}
                        <span className="text-sm text-gray-300">
                          {upload.file.name} ({upload.fileType})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          // アップロード予定から削除
                          setPendingUploads(prev => prev.filter((_, i) => i !== actualIndex))
                        
                          // プレビューURLのクリーンアップ
                          if (upload.previewUrl) {
                            URL.revokeObjectURL(upload.previewUrl)
                          
                            // actualFilesからも削除
                            if (upload.stepNumber === '0') {
                              // 概要画像の場合
                              setActualFiles(prev => ({
                                ...prev,
                                overview: {
                                  ...prev.overview,
                                  images: prev.overview.images.filter(
                                    f => f !== upload.previewUrl
                                  )
                              }
                            }))
                            } else {
                              // ステップ画像の場合
                              const stepIndex = parseInt(upload.stepNumber) - 1
                              setActualFiles(prev => ({
                                ...prev,
                                steps: {
                                  ...prev.steps,
                                  [stepIndex]: {
                                    ...prev.steps[stepIndex],
                                    [upload.fileType]: prev.steps[stepIndex]?.[upload.fileType as 'images' | 'videos']?.filter(
                                      f => f !== upload.previewUrl && f !== `[保留] ${upload.file.name}`
                                    ) || []
                                  }
                                }
                              }))
                            }
                          }
                        }}
                        className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                      >
                        取り消し
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          
          {/* 削除予定ファイル表示 */}
          {deletedFiles.length > 0 && (
            <div className="bg-yellow-900 p-4 rounded-lg shadow border border-yellow-700 mt-4">
              <h3 className="text-lg font-semibold text-yellow-300 mb-2">
                ⚠️ 削除予定ファイル ({deletedFiles.length}件)
              </h3>
              <p className="text-sm text-yellow-200 mb-3">
                以下のファイルは更新ボタンを押すと削除されます。
              </p>
              <div className="space-y-2">
                {deletedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-800 p-2 rounded">
                    <span className="text-sm text-gray-300">
                      {file.fileName} ({file.fileType})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        // 削除予定から取り消し
                        setDeletedFiles(prev => prev.filter((_, i) => i !== index))
                        // UIに復元
                        if (file.stepNumber === '0') {
                          if (file.fileType === 'images') {
                            setActualFiles(prev => ({
                              ...prev,
                              overview: {
                                ...prev.overview,
                                images: [...prev.overview.images, file.fileName]
                              }
                            }))
                          } else if (file.fileType === 'pdfs' || file.fileType === 'programs') {
                            setActualFiles(prev => ({
                              ...prev,
                              overview: {
                                ...prev.overview,
                                [file.fileType]: [...prev.overview[file.fileType as 'pdfs' | 'programs'], file.fileName]
                              }
                            }))
                          }
                        } else {
                          const stepIndex = parseInt(file.stepNumber) - 1
                          setActualFiles(prev => ({
                            ...prev,
                            steps: {
                              ...prev.steps,
                              [stepIndex]: {
                                ...prev.steps[stepIndex] || { images: [], videos: [] },
                                [file.fileType]: [...(prev.steps[stepIndex]?.[file.fileType as 'images' | 'videos'] || []), file.fileName]
                              }
                            }
                          }))
                        }
                      }}
                      className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                    >
                      取り消し
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
            </>
          )}

          {/* ヒヤリハットタブ */}
          {activeTab === 'quality' && (
            <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
              <h2 className="text-xl font-semibold text-white mb-6">⚠️ ヒヤリハット</h2>
              
              {/* ヒヤリハット事例セクション */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    ヒヤリハット事例 ({formData.nearMiss.length}件)
                  </h3>
                  <button
                    type="button"
                    onClick={addNearMiss}
                    className="custom-rect-button emerald small"
                  >
                    <span>+ 事例追加</span>
                  </button>
                </div>
                
                {formData.nearMiss.length > 0 ? (
                  <div className="space-y-4">
                    {formData.nearMiss.map((item, index) => (
                      <NearMissEditor
                        key={index}
                        item={item}
                        index={index}
                        onChange={handleNearMissChange}
                        onRemove={() => removeNearMiss(index)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    ヒヤリハット事例がありません。「+ 事例追加」ボタンで追加してください。
                  </div>
                )}
              </div>
            </div>
          )}


          {/* マシニングタブ */}
          {activeTab === 'machining' && (
            <div className="grid grid-cols-2 gap-4">
              {/* 左側: 作業手順 */}
              <div className="space-y-6 overflow-y-auto pr-4" style={{ maxHeight: 'calc(100vh - 150px)' }}>
                {/* 作業ステップセクション */}
                <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-semibold text-white">
                      作業ステップ ({(formData.workStepsByMachine?.machining || formData.workSteps || []).length}件)
                    </h3>
                    <button
                      type="button"
                      onClick={() => addWorkStep('machining')}
                      className="custom-rect-button emerald small"
                    >
                      <span>+ ステップ追加</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {(formData.workStepsByMachine?.machining || formData.workSteps || []).map((step, index) => (
                      <WorkStepEditor
                        key={index}
                        step={step}
                        index={index}
                        onUpdate={(updatedStep) => updateWorkStep(index, updatedStep, 'machining')}
                        onDelete={() => deleteWorkStep(index, 'machining')}
                        onMoveUp={index > 0 ? () => moveWorkStep(index, index - 1, 'machining') : undefined}
                        onMoveDown={index < (formData.workStepsByMachine?.machining || formData.workSteps || []).length - 1 ? () => moveWorkStep(index, index + 1, 'machining') : undefined}
                        uploadingFiles={uploadingFiles}
                        onFileUpload={(stepIndex, fileType, files) => handleFileUpload(stepIndex, fileType, files, 'machining')}
                        onFileRemove={removeStepFile}
                        actualFiles={actualFiles}
                        machineType="machining"
                        onImageClick={(images, currentIndex) => {
                          setCurrentImages(images);
                          setCurrentImageIndex(currentIndex);
                          setLightboxOpen(true);
                        }}
                      />
                    ))}
                    
                    {(formData.workStepsByMachine?.machining || formData.workSteps || []).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        作業ステップがありません。「+ ステップ追加」ボタンで追加してください。
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 右側: 追記情報（既存の追記情報タブの内容をそのまま） */}
              <div className="space-y-6 overflow-y-auto pl-4" style={{ maxHeight: 'calc(100vh - 150px)' }}>
                <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
                  <h2 className="text-lg font-semibold text-white mb-4">💬 追記情報管理</h2>
                  
                  <div className="mb-8">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-white">
                        追記一覧 【{contributions?.contributions.filter(c => c.status === 'active').length || 0}件】
                      </h3>
                      <button
                        type="button"
                        onClick={() => window.open(`/instruction/${drawingNumber}`, '_blank')}
                        className="custom-rect-button blue small"
                      >
                        <span>作業手順を確認</span>
                      </button>
                    </div>
              
                    {contributions && contributions.contributions.filter(c => c.status === 'active').length > 0 ? (
                      <div className="space-y-4">
                        {contributions.contributions
                          .filter(c => c.status === 'active')
                          .map((contribution) => {
                            // 元の配列でのインデックスを取得
                            const originalIndex = contributions.contributions.findIndex(c => c.id === contribution.id)
                            return (
                          <div key={contribution.id} className="border border-gray-600 rounded-lg p-4 bg-gray-700/50">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center space-x-3">
                                <span className="text-sm font-medium text-white">
                                  {contribution.userName}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {new Date(contribution.timestamp).toLocaleString('ja-JP')}
                                </span>
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  contribution.status === 'merged' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-orange-100 text-orange-800'
                                }`}>
                                  {contribution.status === 'merged' ? 'マージ済み' : '未処理'}
                                </span>
                                <span className="text-xs text-gray-400">
                                  対象: {contribution.targetSection === 'overview' ? '概要' : 
                                         contribution.targetSection === 'step' ? `ステップ ${contribution.stepNumber}` : 
                                         '全般'}
                                </span>
                              </div>
                            </div>
                            
                            <div 
                              className="text-sm text-gray-300 mb-3 rounded-lg"
                              style={{ 
                                padding: '16px',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                border: '2px solid rgba(16, 185, 129, 0.3)'
                              }}
                            >
                              {contribution.content.text && (
                                <>
                                  <div className="whitespace-pre-wrap mb-2">
                                    {contribution.content.text}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(contribution.content.text || '')}
                                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                                    title="テキストをコピー"
                                  >
                                    📋 コピー
                                  </button>
                                </>
                              )}
                              {!contribution.content.text && (
                                <div className="text-gray-500">（テキストなし）</div>
                              )}
                            </div>
                            
                            {contribution.content.files && contribution.content.files.length > 0 && (
                              <div className="mt-3">
                                {/* 画像ファイル */}
                                {contribution.content.files.filter(f => f.fileType === 'image').length > 0 && (
                                  <div className="mb-3">
                                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                      {contribution.content.files.filter(f => f.fileType === 'image').map((file, fileIndex) => (
                                        <div
                                          key={`img-${fileIndex}`}
                                          className="bg-black/30 rounded-lg overflow-hidden border border-emerald-500/20 shadow-lg aspect-square flex items-center justify-center hover:opacity-80 transition-opacity cursor-move"
                                          draggable="true"
                                          onDragStart={(e) => {
                                            // ドラッグデータを設定
                                            const imageUrl = `/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`;
                                            e.dataTransfer.setData('imageUrl', imageUrl);
                                            e.dataTransfer.setData('fileName', file.originalFileName);
                                            e.dataTransfer.effectAllowed = 'copy';
                                            
                                            // ドラッグ中の視覚効果（小さいサイズで表示）
                                            const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
                                            dragImage.style.opacity = '0.8';
                                            dragImage.style.width = '80px';
                                            dragImage.style.height = '80px';
                                            dragImage.style.position = 'absolute';
                                            dragImage.style.top = '-9999px';
                                            document.body.appendChild(dragImage);
                                            e.dataTransfer.setDragImage(dragImage, 40, 40);
                                            setTimeout(() => document.body.removeChild(dragImage), 0);
                                          }}
                                          onClick={() => {
                                            // この追記の全画像URLを収集
                                            const imageUrls = (contribution.content.files || [])
                                              .filter(f => f.fileType === 'image')
                                              .map(f => `/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(f.filePath)}`);
                                            const currentIndex = (contribution.content.files || [])
                                              .filter(f => f.fileType === 'image')
                                              .findIndex(f => f.filePath === file.filePath);
                                            setCurrentImages(imageUrls);
                                            setCurrentImageIndex(currentIndex);
                                            setLightboxOpen(true);
                                          }}
                                          title="ドラッグして作業ステップに追加できます"
                                        >
                                          <img
                                            src={`/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`}
                                            alt={file.originalFileName}
                                            className="w-full h-full object-cover pointer-events-none"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* 動画ファイル */}
                                {contribution.content.files.filter(f => f.fileType === 'video').length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {contribution.content.files.filter(f => f.fileType === 'video').map((file, fileIndex) => (
                                      <a
                                        key={`vid-${fileIndex}`}
                                        href={`/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center px-3 py-1 text-xs rounded bg-purple-600 text-white hover:opacity-80"
                                      >
                                        🎥 {file.originalFileName}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div className="flex space-x-2 mt-3">
                              {contribution.status !== 'merged' && (
                                <button
                                  type="button"
                                  className="custom-rect-button red small"
                                  onClick={() => handleMergeContribution(originalIndex)}
                                >
                                  <span>追記情報から消す</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )})}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        追記はありません
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ターニングタブ */}
          {activeTab === 'turning' && (
            <div className="grid grid-cols-2 gap-4">
              {/* 左側: 作業手順 */}
              <div className="space-y-6 overflow-y-auto pr-4" style={{ maxHeight: 'calc(100vh - 150px)' }}>
                {/* 作業ステップセクション */}
                <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-semibold text-white">
                      🔧 ターニング作業ステップ ({(formData.workStepsByMachine?.turning || []).length}件)
                    </h3>
                    <button
                      type="button"
                      onClick={() => addWorkStep('turning')}
                      className="custom-rect-button emerald small"
                    >
                      <span>+ ステップ追加</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {(formData.workStepsByMachine?.turning || []).map((step, index) => (
                      <WorkStepEditor
                        key={index}
                        step={step}
                        index={index}
                        onUpdate={(updatedStep) => updateWorkStep(index, updatedStep, 'turning')}
                        onDelete={() => deleteWorkStep(index, 'turning')}
                        onMoveUp={index > 0 ? () => moveWorkStep(index, index - 1, 'turning') : undefined}
                        onMoveDown={index < (formData.workStepsByMachine?.turning || []).length - 1 ? () => moveWorkStep(index, index + 1, 'turning') : undefined}
                        uploadingFiles={uploadingFiles}
                        onFileUpload={(stepIndex, fileType, files) => handleFileUpload(stepIndex, fileType, files, 'turning')}
                        onFileRemove={removeStepFile}
                        actualFiles={actualFiles}
                        machineType="turning"
                        onImageClick={(images, currentIndex) => {
                          setCurrentImages(images);
                          setCurrentImageIndex(currentIndex);
                          setLightboxOpen(true);
                        }}
                      />
                    ))}
                    
                    {(formData.workStepsByMachine?.turning || []).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        作業ステップがありません。「+ ステップ追加」ボタンで追加してください。
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* 右側: 追記 */}
              <div className="space-y-4 overflow-y-auto pl-4" style={{ maxHeight: 'calc(100vh - 150px)' }}>
                <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
                  <h2 className="text-lg font-semibold text-white mb-4">💬 追記情報管理</h2>
                  
                  <div className="mb-8">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-white">
                        追記一覧 【{contributions?.contributions.filter(c => c.status === 'active').length || 0}件】
                      </h3>
                      <button
                        type="button"
                        onClick={() => window.open(`/instruction/${drawingNumber}`, '_blank')}
                        className="custom-rect-button blue small"
                      >
                        <span>作業手順を確認</span>
                      </button>
                    </div>
              
                    {contributions && contributions.contributions.filter(c => c.status === 'active').length > 0 ? (
                      <div className="space-y-4">
                        {contributions.contributions
                          .filter(c => c.status === 'active')
                          .map((contribution) => {
                            // 元の配列でのインデックスを取得
                            const originalIndex = contributions.contributions.findIndex(c => c.id === contribution.id)
                            return (
                          <div key={contribution.id} className="border border-gray-600 rounded-lg p-4 bg-gray-700/50">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center space-x-3">
                                <span className="text-sm font-medium text-white">
                                  {contribution.userName}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {new Date(contribution.timestamp).toLocaleString('ja-JP')}
                                </span>
                                <span className="text-xs text-gray-400">
                                  対象: {contribution.targetSection === 'overview' ? '概要' : 
                                         contribution.targetSection === 'step' ? `ステップ ${contribution.stepNumber}` : 
                                         '全般'}
                                </span>
                              </div>
                            </div>
                            
                            <div 
                              className="text-sm text-gray-300 mb-3 rounded-lg"
                              style={{ 
                                padding: '16px',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                border: '2px solid rgba(16, 185, 129, 0.3)'
                              }}
                            >
                              {contribution.content.text && (
                                <>
                                  <div className="whitespace-pre-wrap mb-2">
                                    {contribution.content.text}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(contribution.content.text || '')}
                                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                                    title="テキストをコピー"
                                  >
                                    📋 コピー
                                  </button>
                                </>
                              )}
                              {!contribution.content.text && (
                                <div className="text-gray-500">（テキストなし）</div>
                              )}
                            </div>
                            
                            {contribution.content.files && contribution.content.files.length > 0 && (
                              <div className="mt-3">
                                {/* 画像ファイル */}
                                {contribution.content.files.filter(f => f.fileType === 'image').length > 0 && (
                                  <div className="mb-3">
                                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                      {contribution.content.files.filter(f => f.fileType === 'image').map((file, fileIndex) => (
                                        <div
                                          key={`img-${fileIndex}`}
                                          className="bg-black/30 rounded-lg overflow-hidden border border-emerald-500/20 shadow-lg aspect-square flex items-center justify-center hover:opacity-80 transition-opacity cursor-move"
                                          draggable="true"
                                          onDragStart={(e) => {
                                            // ドラッグデータを設定
                                            const imageUrl = `/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`;
                                            e.dataTransfer.setData('imageUrl', imageUrl);
                                            e.dataTransfer.setData('fileName', file.originalFileName);
                                            e.dataTransfer.effectAllowed = 'copy';
                                            
                                            // ドラッグ中の視覚効果（小さいサイズで表示）
                                            const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
                                            dragImage.style.opacity = '0.8';
                                            dragImage.style.width = '80px';
                                            dragImage.style.height = '80px';
                                            dragImage.style.position = 'absolute';
                                            dragImage.style.top = '-9999px';
                                            document.body.appendChild(dragImage);
                                            e.dataTransfer.setDragImage(dragImage, 40, 40);
                                            setTimeout(() => document.body.removeChild(dragImage), 0);
                                          }}
                                          onClick={() => {
                                            // この追記の全画像URLを収集
                                            const imageUrls = (contribution.content.files || [])
                                              .filter(f => f.fileType === 'image')
                                              .map(f => `/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(f.filePath)}`);
                                            const currentIndex = (contribution.content.files || [])
                                              .filter(f => f.fileType === 'image')
                                              .findIndex(f => f.filePath === file.filePath);
                                            setCurrentImages(imageUrls);
                                            setCurrentImageIndex(currentIndex);
                                            setLightboxOpen(true);
                                          }}
                                          title="ドラッグして作業ステップに追加できます"
                                        >
                                          <img
                                            src={`/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`}
                                            alt={file.originalFileName}
                                            className="w-full h-full object-cover pointer-events-none"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* 動画ファイル */}
                                {contribution.content.files.filter(f => f.fileType === 'video').length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {contribution.content.files.filter(f => f.fileType === 'video').map((file, fileIndex) => (
                                      <a
                                        key={`vid-${fileIndex}`}
                                        href={`/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center px-3 py-1 text-xs rounded bg-purple-600 text-white hover:opacity-80"
                                      >
                                        🎥 {file.originalFileName}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div className="flex space-x-2 mt-3">
                              {contribution.status !== 'merged' && (
                                <button
                                  type="button"
                                  className="custom-rect-button red small"
                                  onClick={() => handleMergeContribution(originalIndex)}
                                >
                                  <span>追記情報から消す</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )})}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        追記はありません
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 横中タブ */}
          {activeTab === 'yokonaka' && (
            <div className="grid grid-cols-2 gap-4">
              {/* 左側: 作業手順 */}
              <div className="space-y-6 overflow-y-auto pr-4" style={{ maxHeight: 'calc(100vh - 150px)' }}>
                {/* 作業ステップセクション */}
                <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-semibold text-white">
                      🔧 横中作業ステップ ({(formData.workStepsByMachine?.yokonaka || []).length}件)
                    </h3>
                    <button
                      type="button"
                      onClick={() => addWorkStep('yokonaka')}
                      className="custom-rect-button emerald small"
                    >
                      <span>+ ステップ追加</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {(formData.workStepsByMachine?.yokonaka || []).map((step, index) => (
                      <WorkStepEditor
                        key={index}
                        step={step}
                        index={index}
                        onUpdate={(updatedStep) => updateWorkStep(index, updatedStep, 'yokonaka')}
                        onDelete={() => deleteWorkStep(index, 'yokonaka')}
                        onMoveUp={index > 0 ? () => moveWorkStep(index, index - 1, 'yokonaka') : undefined}
                        onMoveDown={index < (formData.workStepsByMachine?.yokonaka || []).length - 1 ? () => moveWorkStep(index, index + 1, 'yokonaka') : undefined}
                        uploadingFiles={uploadingFiles}
                        onFileUpload={(stepIndex, fileType, files) => handleFileUpload(stepIndex, fileType, files, 'yokonaka')}
                        onFileRemove={removeStepFile}
                        actualFiles={actualFiles}
                        machineType="yokonaka"
                        onImageClick={(images, currentIndex) => {
                          setCurrentImages(images);
                          setCurrentImageIndex(currentIndex);
                          setLightboxOpen(true);
                        }}
                      />
                    ))}
                    
                    {(formData.workStepsByMachine?.yokonaka || []).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        作業ステップがありません。「+ ステップ追加」ボタンで追加してください。
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* 右側: 追記 */}
              <div className="space-y-4 overflow-y-auto pl-4" style={{ maxHeight: 'calc(100vh - 150px)' }}>
                <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
                  <h2 className="text-lg font-semibold text-white mb-4">💬 追記情報管理</h2>
                  
                  <div className="mb-8">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-white">
                        追記一覧 【{contributions?.contributions.filter(c => c.status === 'active').length || 0}件】
                      </h3>
                      <button
                        type="button"
                        onClick={() => window.open(`/instruction/${drawingNumber}`, '_blank')}
                        className="custom-rect-button blue small"
                      >
                        <span>作業手順を確認</span>
                      </button>
                    </div>
              
                    {contributions && contributions.contributions.filter(c => c.status === 'active').length > 0 ? (
                      <div className="space-y-4">
                        {contributions.contributions
                          .filter(c => c.status === 'active')
                          .map((contribution) => {
                            // 元の配列でのインデックスを取得
                            const originalIndex = contributions.contributions.findIndex(c => c.id === contribution.id)
                            return (
                          <div key={contribution.id} className="border border-gray-600 rounded-lg p-4 bg-gray-700/50">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center space-x-3">
                                <span className="text-sm font-medium text-white">
                                  {contribution.userName}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {new Date(contribution.timestamp).toLocaleString('ja-JP')}
                                </span>
                                <span className="text-xs text-gray-400">
                                  対象: {contribution.targetSection === 'overview' ? '概要' : 
                                         contribution.targetSection === 'step' ? `ステップ ${contribution.stepNumber}` : 
                                         '全般'}
                                </span>
                              </div>
                            </div>
                            
                            <div 
                              className="text-sm text-gray-300 mb-3 rounded-lg"
                              style={{ 
                                padding: '16px',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                border: '2px solid rgba(16, 185, 129, 0.3)'
                              }}
                            >
                              {contribution.content.text && (
                                <>
                                  <div className="whitespace-pre-wrap mb-2">
                                    {contribution.content.text}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(contribution.content.text || '')}
                                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                                    title="テキストをコピー"
                                  >
                                    📋 コピー
                                  </button>
                                </>
                              )}
                              {!contribution.content.text && (
                                <div className="text-gray-500">（テキストなし）</div>
                              )}
                            </div>
                            
                            {contribution.content.files && contribution.content.files.length > 0 && (
                              <div className="mt-3">
                                {/* 画像ファイル */}
                                {contribution.content.files.filter(f => f.fileType === 'image').length > 0 && (
                                  <div className="mb-3">
                                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                      {contribution.content.files.filter(f => f.fileType === 'image').map((file, fileIndex) => (
                                        <div
                                          key={`img-${fileIndex}`}
                                          className="bg-black/30 rounded-lg overflow-hidden border border-emerald-500/20 shadow-lg aspect-square flex items-center justify-center hover:opacity-80 transition-opacity cursor-move"
                                          draggable="true"
                                          onDragStart={(e) => {
                                            // ドラッグデータを設定
                                            const imageUrl = `/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`;
                                            e.dataTransfer.setData('imageUrl', imageUrl);
                                            e.dataTransfer.setData('fileName', file.originalFileName);
                                            e.dataTransfer.effectAllowed = 'copy';
                                            
                                            // ドラッグ中の視覚効果（小さいサイズで表示）
                                            const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
                                            dragImage.style.opacity = '0.8';
                                            dragImage.style.width = '80px';
                                            dragImage.style.height = '80px';
                                            dragImage.style.position = 'absolute';
                                            dragImage.style.top = '-9999px';
                                            document.body.appendChild(dragImage);
                                            e.dataTransfer.setDragImage(dragImage, 40, 40);
                                            setTimeout(() => document.body.removeChild(dragImage), 0);
                                          }}
                                          onClick={() => {
                                            // この追記の全画像URLを収集
                                            const imageUrls = (contribution.content.files || [])
                                              .filter(f => f.fileType === 'image')
                                              .map(f => `/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(f.filePath)}`);
                                            const currentIndex = (contribution.content.files || [])
                                              .filter(f => f.fileType === 'image')
                                              .findIndex(f => f.filePath === file.filePath);
                                            setCurrentImages(imageUrls);
                                            setCurrentImageIndex(currentIndex);
                                            setLightboxOpen(true);
                                          }}
                                          title="ドラッグして作業ステップに追加できます"
                                        >
                                          <img
                                            src={`/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`}
                                            alt={file.originalFileName}
                                            className="w-full h-full object-cover pointer-events-none"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* 動画ファイル */}
                                {contribution.content.files.filter(f => f.fileType === 'video').length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {contribution.content.files.filter(f => f.fileType === 'video').map((file, fileIndex) => (
                                      <a
                                        key={`vid-${fileIndex}`}
                                        href={`/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center px-3 py-1 text-xs rounded bg-purple-600 text-white hover:opacity-80"
                                      >
                                        🎥 {file.originalFileName}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div className="flex space-x-2 mt-3">
                              {contribution.status !== 'merged' && (
                                <button
                                  type="button"
                                  className="custom-rect-button red small"
                                  onClick={() => handleMergeContribution(originalIndex)}
                                >
                                  <span>追記情報から消す</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )})}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        追記はありません
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ラジアルタブ */}
          {activeTab === 'radial' && (
            <div className="grid grid-cols-2 gap-4">
              {/* 左側: 作業手順 */}
              <div className="space-y-6 overflow-y-auto pr-4" style={{ maxHeight: 'calc(100vh - 150px)' }}>
                {/* 作業ステップセクション */}
                <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-semibold text-white">
                      🔧 ラジアル作業ステップ ({(formData.workStepsByMachine?.radial || []).length}件)
                    </h3>
                    <button
                      type="button"
                      onClick={() => addWorkStep('radial')}
                      className="custom-rect-button emerald small"
                    >
                      <span>+ ステップ追加</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {(formData.workStepsByMachine?.radial || []).map((step, index) => (
                      <WorkStepEditor
                        key={index}
                        step={step}
                        index={index}
                        onUpdate={(updatedStep) => updateWorkStep(index, updatedStep, 'radial')}
                        onDelete={() => deleteWorkStep(index, 'radial')}
                        onMoveUp={index > 0 ? () => moveWorkStep(index, index - 1, 'radial') : undefined}
                        onMoveDown={index < (formData.workStepsByMachine?.radial || []).length - 1 ? () => moveWorkStep(index, index + 1, 'radial') : undefined}
                        uploadingFiles={uploadingFiles}
                        onFileUpload={(stepIndex, fileType, files) => handleFileUpload(stepIndex, fileType, files, 'radial')}
                        onFileRemove={removeStepFile}
                        actualFiles={actualFiles}
                        machineType="radial"
                        onImageClick={(images, currentIndex) => {
                          setCurrentImages(images);
                          setCurrentImageIndex(currentIndex);
                          setLightboxOpen(true);
                        }}
                      />
                    ))}
                    
                    {(formData.workStepsByMachine?.radial || []).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        作業ステップがありません。「+ ステップ追加」ボタンで追加してください。
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* 右側: 追記 */}
              <div className="space-y-4 overflow-y-auto pl-4" style={{ maxHeight: 'calc(100vh - 150px)' }}>
                <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
                  <h2 className="text-lg font-semibold text-white mb-4">💬 追記情報管理</h2>
                  
                  <div className="mb-8">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-white">
                        追記一覧 【{contributions?.contributions.filter(c => c.status === 'active').length || 0}件】
                      </h3>
                      <button
                        type="button"
                        onClick={() => window.open(`/instruction/${drawingNumber}`, '_blank')}
                        className="custom-rect-button blue small"
                      >
                        <span>作業手順を確認</span>
                      </button>
                    </div>
              
                    {contributions && contributions.contributions.filter(c => c.status === 'active').length > 0 ? (
                      <div className="space-y-4">
                        {contributions.contributions
                          .filter(c => c.status === 'active')
                          .map((contribution) => {
                            // 元の配列でのインデックスを取得
                            const originalIndex = contributions.contributions.findIndex(c => c.id === contribution.id)
                            return (
                          <div key={contribution.id} className="border border-gray-600 rounded-lg p-4 bg-gray-700/50">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center space-x-3">
                                <span className="text-sm font-medium text-white">
                                  {contribution.userName}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {new Date(contribution.timestamp).toLocaleString('ja-JP')}
                                </span>
                                <span className="text-xs text-gray-400">
                                  対象: {contribution.targetSection === 'overview' ? '概要' : 
                                         contribution.targetSection === 'step' ? `ステップ ${contribution.stepNumber}` : 
                                         '全般'}
                                </span>
                              </div>
                            </div>
                            
                            <div 
                              className="text-sm text-gray-300 mb-3 rounded-lg"
                              style={{ 
                                padding: '16px',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                border: '2px solid rgba(16, 185, 129, 0.3)'
                              }}
                            >
                              {contribution.content.text && (
                                <>
                                  <div className="whitespace-pre-wrap mb-2">
                                    {contribution.content.text}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(contribution.content.text || '')}
                                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                                    title="テキストをコピー"
                                  >
                                    📋 コピー
                                  </button>
                                </>
                              )}
                              {!contribution.content.text && (
                                <div className="text-gray-500">（テキストなし）</div>
                              )}
                            </div>
                            
                            {contribution.content.files && contribution.content.files.length > 0 && (
                              <div className="mt-3">
                                {/* 画像ファイル */}
                                {contribution.content.files.filter(f => f.fileType === 'image').length > 0 && (
                                  <div className="mb-3">
                                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                      {contribution.content.files.filter(f => f.fileType === 'image').map((file, fileIndex) => (
                                        <div
                                          key={`img-${fileIndex}`}
                                          className="bg-black/30 rounded-lg overflow-hidden border border-emerald-500/20 shadow-lg aspect-square flex items-center justify-center hover:opacity-80 transition-opacity cursor-move"
                                          draggable="true"
                                          onDragStart={(e) => {
                                            // ドラッグデータを設定
                                            const imageUrl = `/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`;
                                            e.dataTransfer.setData('imageUrl', imageUrl);
                                            e.dataTransfer.setData('fileName', file.originalFileName);
                                            e.dataTransfer.effectAllowed = 'copy';
                                            
                                            // ドラッグ中の視覚効果（小さいサイズで表示）
                                            const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
                                            dragImage.style.opacity = '0.8';
                                            dragImage.style.width = '80px';
                                            dragImage.style.height = '80px';
                                            dragImage.style.position = 'absolute';
                                            dragImage.style.top = '-9999px';
                                            document.body.appendChild(dragImage);
                                            e.dataTransfer.setDragImage(dragImage, 40, 40);
                                            setTimeout(() => document.body.removeChild(dragImage), 0);
                                          }}
                                          onClick={() => {
                                            // この追記の全画像URLを収集
                                            const imageUrls = (contribution.content.files || [])
                                              .filter(f => f.fileType === 'image')
                                              .map(f => `/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(f.filePath)}`);
                                            const currentIndex = (contribution.content.files || [])
                                              .filter(f => f.fileType === 'image')
                                              .findIndex(f => f.filePath === file.filePath);
                                            setCurrentImages(imageUrls);
                                            setCurrentImageIndex(currentIndex);
                                            setLightboxOpen(true);
                                          }}
                                          title="ドラッグして作業ステップに追加できます"
                                        >
                                          <img
                                            src={`/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`}
                                            alt={file.originalFileName}
                                            className="w-full h-full object-cover pointer-events-none"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* 動画ファイル */}
                                {contribution.content.files.filter(f => f.fileType === 'video').length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {contribution.content.files.filter(f => f.fileType === 'video').map((file, fileIndex) => (
                                      <a
                                        key={`vid-${fileIndex}`}
                                        href={`/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center px-3 py-1 text-xs rounded bg-purple-600 text-white hover:opacity-80"
                                      >
                                        🎥 {file.originalFileName}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div className="flex space-x-2 mt-3">
                              {contribution.status !== 'merged' && (
                                <button
                                  type="button"
                                  className="custom-rect-button red small"
                                  onClick={() => handleMergeContribution(originalIndex)}
                                >
                                  <span>追記情報から消す</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )})}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        追記はありません
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* その他タブ */}
          {activeTab === 'other' && (
            <div className="grid grid-cols-2 gap-4">
              {/* 左側: 作業手順 */}
              <div className="space-y-6 overflow-y-auto pr-4" style={{ maxHeight: 'calc(100vh - 150px)' }}>
                {/* 作業ステップセクション */}
                <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-semibold text-white">
                      🔧 その他作業ステップ ({(formData.workStepsByMachine?.other || []).length}件)
                    </h3>
                    <button
                      type="button"
                      onClick={() => addWorkStep('other')}
                      className="custom-rect-button emerald small"
                    >
                      <span>+ ステップ追加</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {(formData.workStepsByMachine?.other || []).map((step, index) => (
                      <WorkStepEditor
                        key={index}
                        step={step}
                        index={index}
                        onUpdate={(updatedStep) => updateWorkStep(index, updatedStep, 'other')}
                        onDelete={() => deleteWorkStep(index, 'other')}
                        onMoveUp={index > 0 ? () => moveWorkStep(index, index - 1, 'other') : undefined}
                        onMoveDown={index < (formData.workStepsByMachine?.other || []).length - 1 ? () => moveWorkStep(index, index + 1, 'other') : undefined}
                        uploadingFiles={uploadingFiles}
                        onFileUpload={(stepIndex, fileType, files) => handleFileUpload(stepIndex, fileType, files, 'other')}
                        onFileRemove={removeStepFile}
                        actualFiles={actualFiles}
                        machineType="other"
                        onImageClick={(images, currentIndex) => {
                          setCurrentImages(images);
                          setCurrentImageIndex(currentIndex);
                          setLightboxOpen(true);
                        }}
                      />
                    ))}
                    
                    {(formData.workStepsByMachine?.other || []).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        作業ステップがありません。「+ ステップ追加」ボタンで追加してください。
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* 右側: 追記 */}
              <div className="space-y-4 overflow-y-auto pl-4" style={{ maxHeight: 'calc(100vh - 150px)' }}>
                <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
                  <h2 className="text-lg font-semibold text-white mb-4">💬 追記情報管理</h2>
                  
                  <div className="mb-8">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-white">
                        追記一覧 【{contributions?.contributions.filter(c => c.status === 'active').length || 0}件】
                      </h3>
                      <button
                        type="button"
                        onClick={() => window.open(`/instruction/${drawingNumber}`, '_blank')}
                        className="custom-rect-button blue small"
                      >
                        <span>作業手順を確認</span>
                      </button>
                    </div>
              
                    {contributions && contributions.contributions.filter(c => c.status === 'active').length > 0 ? (
                      <div className="space-y-4">
                        {contributions.contributions
                          .filter(c => c.status === 'active')
                          .map((contribution) => {
                            // 元の配列でのインデックスを取得
                            const originalIndex = contributions.contributions.findIndex(c => c.id === contribution.id)
                            return (
                          <div key={contribution.id} className="border border-gray-600 rounded-lg p-4 bg-gray-700/50">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center space-x-3">
                                <span className="text-sm font-medium text-white">
                                  {contribution.userName}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {new Date(contribution.timestamp).toLocaleString('ja-JP')}
                                </span>
                                <span className="text-xs text-gray-400">
                                  対象: {contribution.targetSection === 'overview' ? '概要' : 
                                         contribution.targetSection === 'step' ? `ステップ ${contribution.stepNumber}` : 
                                         '全般'}
                                </span>
                              </div>
                            </div>
                            
                            <div 
                              className="text-sm text-gray-300 mb-3 rounded-lg"
                              style={{ 
                                padding: '16px',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                border: '2px solid rgba(16, 185, 129, 0.3)'
                              }}
                            >
                              {contribution.content.text && (
                                <>
                                  <div className="whitespace-pre-wrap mb-2">
                                    {contribution.content.text}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(contribution.content.text || '')}
                                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                                    title="テキストをコピー"
                                  >
                                    📋 コピー
                                  </button>
                                </>
                              )}
                              {!contribution.content.text && (
                                <div className="text-gray-500">（テキストなし）</div>
                              )}
                            </div>
                            
                            {contribution.content.files && contribution.content.files.length > 0 && (
                              <div className="mt-3">
                                {/* 画像ファイル */}
                                {contribution.content.files.filter(f => f.fileType === 'image').length > 0 && (
                                  <div className="mb-3">
                                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                      {contribution.content.files.filter(f => f.fileType === 'image').map((file, fileIndex) => (
                                        <div
                                          key={`img-${fileIndex}`}
                                          className="bg-black/30 rounded-lg overflow-hidden border border-emerald-500/20 shadow-lg aspect-square flex items-center justify-center hover:opacity-80 transition-opacity cursor-move"
                                          draggable="true"
                                          onDragStart={(e) => {
                                            // ドラッグデータを設定
                                            const imageUrl = `/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`;
                                            e.dataTransfer.setData('imageUrl', imageUrl);
                                            e.dataTransfer.setData('fileName', file.originalFileName);
                                            e.dataTransfer.effectAllowed = 'copy';
                                            
                                            // ドラッグ中の視覚効果（小さいサイズで表示）
                                            const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
                                            dragImage.style.opacity = '0.8';
                                            dragImage.style.width = '80px';
                                            dragImage.style.height = '80px';
                                            dragImage.style.position = 'absolute';
                                            dragImage.style.top = '-9999px';
                                            document.body.appendChild(dragImage);
                                            e.dataTransfer.setDragImage(dragImage, 40, 40);
                                            setTimeout(() => document.body.removeChild(dragImage), 0);
                                          }}
                                          onClick={() => {
                                            // この追記の全画像URLを収集
                                            const imageUrls = (contribution.content.files || [])
                                              .filter(f => f.fileType === 'image')
                                              .map(f => `/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(f.filePath)}`);
                                            const currentIndex = (contribution.content.files || [])
                                              .filter(f => f.fileType === 'image')
                                              .findIndex(f => f.filePath === file.filePath);
                                            setCurrentImages(imageUrls);
                                            setCurrentImageIndex(currentIndex);
                                            setLightboxOpen(true);
                                          }}
                                          title="ドラッグして作業ステップに追加できます"
                                        >
                                          <img
                                            src={`/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`}
                                            alt={file.originalFileName}
                                            className="w-full h-full object-cover pointer-events-none"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* 動画ファイル */}
                                {contribution.content.files.filter(f => f.fileType === 'video').length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {contribution.content.files.filter(f => f.fileType === 'video').map((file, fileIndex) => (
                                      <a
                                        key={`vid-${fileIndex}`}
                                        href={`/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center px-3 py-1 text-xs rounded bg-purple-600 text-white hover:opacity-80"
                                      >
                                        🎥 {file.originalFileName}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div className="flex space-x-2 mt-3">
                              {contribution.status !== 'merged' && (
                                <button
                                  type="button"
                                  className="custom-rect-button red small"
                                  onClick={() => handleMergeContribution(originalIndex)}
                                >
                                  <span>追記情報から消す</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )})}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        追記はありません
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 関連情報タブ */}
          {activeTab === 'related' && (
            <div className="space-y-6">
              {/* 関連図番セクション */}
              <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
                <h2 className="text-xl font-semibold text-white mb-6">📋 関連図番</h2>
                
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-white">
                      関連図番一覧 ({formData.relatedDrawings.length}件)
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => {
                          if (!prev) return prev
                          return {
                            ...prev,
                            relatedDrawings: [...prev.relatedDrawings, {
                              drawingNumber: '',
                              relation: '関連図番',
                              description: ''
                            }]
                          }
                        })
                      }}
                      className="custom-rect-button emerald small"
                    >
                      <span>+ 関連図番を追加</span>
                    </button>
                  </div>
                  
                  {formData.relatedDrawings.length > 0 ? (
                    <div className="space-y-4">
                      {formData.relatedDrawings.map((related, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="text-sm font-medium text-gray-900">関連図番 {index + 1}</h4>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData(prev => {
                                  if (!prev) return prev
                                  return {
                                    ...prev,
                                    relatedDrawings: prev.relatedDrawings.filter((_, i) => i !== index)
                                  }
                                })
                              }}
                              className="custom-rect-button red tiny"
                            >
                              削除
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="custom-form-label">
                                図番 <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={related.drawingNumber}
                                onChange={(e) => {
                                  const newRelatedDrawings = [...formData.relatedDrawings]
                                  newRelatedDrawings[index] = {
                                    ...newRelatedDrawings[index],
                                    drawingNumber: e.target.value
                                  }
                                  setFormData(prev => prev ? {
                                    ...prev,
                                    relatedDrawings: newRelatedDrawings
                                  } : prev)
                                }}
                                className="custom-form-input"
                                placeholder="例: DRAW-2024-001"
                                required
                              />
                            </div>
                            
                            <div className="md:col-span-1">
                              <label className="custom-form-label">
                                説明
                              </label>
                              <input
                                type="text"
                                value={related.description}
                                onChange={(e) => {
                                  const newRelatedDrawings = [...formData.relatedDrawings]
                                  newRelatedDrawings[index] = {
                                    ...newRelatedDrawings[index],
                                    description: e.target.value
                                  }
                                  setFormData(prev => prev ? {
                                    ...prev,
                                    relatedDrawings: newRelatedDrawings
                                  } : prev)
                                }}
                                className="custom-form-input"
                                placeholder="この図番との関係性を説明..."
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      関連図番がありません。「+ 関連図番を追加」ボタンで追加してください。
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 追記情報タブ */}
          {activeTab === 'contributions' && (
            <div className="space-y-6">
              <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
                <h2 className="text-lg font-semibold text-white mb-4">💬 追記情報管理</h2>
                
                <div className="mb-8">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-white">
                      追記一覧 【{contributions?.contributions.length || 0}件】
                    </h3>
                    <button
                      type="button"
                      onClick={() => window.open(`/instruction/${drawingNumber}`, '_blank')}
                      className="custom-rect-button blue small"
                    >
                      <span>作業手順を確認</span>
                    </button>
                  </div>
            
                  {contributions && contributions.contributions.filter(c => c.status === 'active').length > 0 ? (
                    <div className="space-y-4">
                      {contributions.contributions
                        .filter(c => c.status === 'active')
                        .map((contribution) => {
                          // 元の配列でのインデックスを取得
                          const originalIndex = contributions.contributions.findIndex(c => c.id === contribution.id)
                          return (
                        <div key={contribution.id} className="border border-gray-600 rounded-lg p-4 bg-gray-700/50">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center space-x-3">
                              <span className="text-sm font-medium text-white">
                                {contribution.userName}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(contribution.timestamp).toLocaleString('ja-JP')}
                              </span>
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                contribution.status === 'merged' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {contribution.status === 'merged' ? 'マージ済み' : '未処理'}
                              </span>
                              <span className="text-xs text-gray-400">
                                対象: {contribution.targetSection === 'overview' ? '概要' : 
                                       contribution.targetSection === 'step' ? `ステップ ${contribution.stepNumber}` : 
                                       '全般'}
                              </span>
                            </div>
                          </div>
                          
                          <div 
                            className="text-sm text-gray-300 mb-3 rounded-lg"
                            style={{ 
                              padding: '16px',
                              backgroundColor: 'rgba(16, 185, 129, 0.1)',
                              border: '2px solid rgba(16, 185, 129, 0.3)'
                            }}
                          >
                            {contribution.content.text && (
                              <>
                                <div className="whitespace-pre-wrap mb-2">
                                  {contribution.content.text}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(contribution.content.text || '')}
                                  className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                                  title="テキストをコピー"
                                >
                                  📋 コピー
                                </button>
                              </>
                            )}
                            {!contribution.content.text && (
                              <div className="text-gray-500">（テキストなし）</div>
                            )}
                          </div>
                          
                          {contribution.content.files && contribution.content.files.length > 0 && (
                            <div className="mt-3">
                              {/* 画像ファイル */}
                              {contribution.content.files.filter(f => f.fileType === 'image').length > 0 && (
                                <div className="mb-3">
                                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {contribution.content.files.filter(f => f.fileType === 'image').map((file, fileIndex) => (
                                      <div
                                        key={`img-${fileIndex}`}
                                        className="bg-black/30 rounded-lg overflow-hidden border border-emerald-500/20 shadow-lg aspect-square flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
                                        onClick={() => {
                                          // この追記の全画像URLを収集
                                          const imageUrls = (contribution.content.files || [])
                                            .filter(f => f.fileType === 'image')
                                            .map(f => `/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(f.filePath)}`);
                                          const currentIndex = (contribution.content.files || [])
                                            .filter(f => f.fileType === 'image')
                                            .findIndex(f => f.filePath === file.filePath);
                                          setCurrentImages(imageUrls);
                                          setCurrentImageIndex(currentIndex);
                                          setLightboxOpen(true);
                                        }}
                                      >
                                        <img
                                          src={`/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`}
                                          alt={file.originalFileName}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* 動画ファイル */}
                              {contribution.content.files.filter(f => f.fileType === 'video').length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {contribution.content.files.filter(f => f.fileType === 'video').map((file, fileIndex) => (
                                    <a
                                      key={`vid-${fileIndex}`}
                                      href={`/api/files?drawingNumber=${drawingNumber}&contributionFile=${encodeURIComponent(file.filePath)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-3 py-1 text-xs rounded bg-purple-600 text-white hover:opacity-80"
                                    >
                                      🎥 {file.originalFileName}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div className="flex space-x-2 mt-3">
                            {contribution.status !== 'merged' && (
                              <button
                                type="button"
                                className="custom-rect-button emerald small"
                                onClick={() => handleMergeContribution(originalIndex)}
                              >
                                <span>作業手順に転記済み</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )})}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      追記はありません
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* エラー表示（統合タブ以外で表示） */}
          {error && activeTab !== 'workStepsWithContributions' && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-red-800">{error}</div>
            </div>
          )}

          {/* 操作ボタン（統合タブ以外で表示） */}
          {activeTab !== 'workStepsWithContributions' && (
            <div className="flex justify-end space-x-4">
              <Link
                href="/admin/drawings/list"
                className="custom-rect-button gray"
              >
                <span>キャンセル</span>
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="custom-rect-button blue"
              >
                <span>{saving ? '更新中...' : '更新する'}</span>
              </button>
            </div>
          )}
        </form>
      </main>

      {/* 画像ライトボックス */}
      <ImageLightbox
        images={currentImages}
        isOpen={lightboxOpen}
        currentIndex={currentImageIndex}
        onClose={() => setLightboxOpen(false)}
        altText="管理画面画像"
      />
    </div>
  )
}

// 作業ステップエディタコンポーネント
interface WorkStepEditorProps {
  step: WorkStep
  index: number
  onUpdate: (step: WorkStep) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  uploadingFiles: {[key: string]: boolean}
  onFileUpload: (stepIndex: number, fileType: 'images' | 'videos', files: FileList | null, machineType?: MachineTypeKey) => void
  onFileRemove: (stepIndex: number, fileType: 'images' | 'videos', fileIndex: number, machineType?: MachineTypeKey) => void
  actualFiles: {
    overview: { images: string[], videos: string[] },
    steps: { [key: number]: { images: string[], videos: string[] } },
    stepsByMachine?: {
      machining?: { images: string[], videos: string[] }[],
      turning?: { images: string[], videos: string[] }[],
      yokonaka?: { images: string[], videos: string[] }[],
      radial?: { images: string[], videos: string[] }[],
      other?: { images: string[], videos: string[] }[]
    }
  }
  onImageClick: (images: string[], currentIndex: number) => void
  machineType?: MachineTypeKey  // 機械種別を追加
}

function WorkStepEditor({ step, index, onUpdate, onDelete, onMoveUp, onMoveDown, uploadingFiles, onFileUpload, onFileRemove, actualFiles, onImageClick, machineType }: WorkStepEditorProps) {
  // 親コンポーネントから渡される図番を取得
  const params = useParams()
  const drawingNumber = params.id as string
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // 機械種別に応じたフォルダ名を生成
  const stepFolderName = machineType 
    ? getStepFolderName(index + 1, machineType)
    : `step_${String(index + 1).padStart(2, '0')}`
  
  // 機械種別に応じたファイルを取得
  const getStepFiles = () => {
    if (machineType && actualFiles.stepsByMachine) {
      const machineSteps = actualFiles.stepsByMachine[machineType]
      return machineSteps?.[index] || { images: [], videos: [] }
    }
    // 後方互換性のためのフォールバック
    return actualFiles.steps[index] || { images: [], videos: [] }
  }
  
  const stepFiles = getStepFiles()
  const machineTypeLabel = machineType ? getMachineTypeJapanese(machineType) : ''


  const handleDetailedInstructionChange = (instIndex: number, value: string) => {
    const newInstructions = [...step.detailedInstructions]
    newInstructions[instIndex] = value
    onUpdate({ ...step, detailedInstructions: newInstructions })
  }

  const addDetailedInstruction = () => {
    onUpdate({
      ...step,
      detailedInstructions: [...step.detailedInstructions, '']
    })
  }

  const removeDetailedInstruction = (instIndex: number) => {
    const newInstructions = step.detailedInstructions.filter((_, i) => i !== instIndex)
    onUpdate({ ...step, detailedInstructions: newInstructions })
  }

  return (
    <div className="border border-gray-600 rounded-lg bg-gray-800">
      {/* ヘッダー */}
      <div className="px-4 py-3 flex justify-between items-center rounded-t-lg border-b-2 border-emerald-500 shadow-lg" style={{ background: 'linear-gradient(to right, #1f2937, #111827)' }}>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-3 text-left flex-1"
        >
          <div className="w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300" 
               style={{ 
                 backgroundColor: isExpanded ? '#10b981' : 'transparent',
                 transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                 boxShadow: isExpanded ? '0 0 10px rgba(16, 185, 129, 0.5)' : 'none'
               }}>
            <span className="text-white font-bold" style={{ fontSize: '1.125rem' }}>▶</span>
          </div>
          <span className="font-bold text-white flex items-center gap-2" style={{ fontSize: '1.25rem' }}>
            <span>ステップ {step.stepNumber}: {step.title}</span>
            {machineTypeLabel && (
              <span className="text-emerald-300 text-sm font-semibold">[{machineTypeLabel}]</span>
            )}
          </span>
        </button>
        
        <div className="flex items-center space-x-2">
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              className="custom-rect-button blue small"
              title="上に移動"
            >
              <span>↑</span>
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              className="custom-rect-button blue small"
              title="下に移動"
            >
              <span>↓</span>
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="custom-rect-button red tiny"
            title="削除"
          >
            削除
          </button>
        </div>
      </div>

      {/* 詳細内容 */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* 基本情報 */}
          <div>
            <label className="custom-form-label text-sm">
              ステップタイトル
            </label>
            <input
              type="text"
              value={step.title}
              onChange={(e) => onUpdate({ ...step, title: e.target.value })}
              className="custom-form-input"
              style={{ padding: '10px 14px', fontSize: '1rem' }}
            />
          </div>

          <div>
            <label className="custom-form-label text-sm">
              ステップ説明
            </label>
            <textarea
              value={step.description}
              onChange={(e) => onUpdate({ ...step, description: e.target.value })}
              rows={2}
              className="custom-form-textarea"
              style={{ padding: '12px 16px', fontSize: '1rem', minHeight: '80px' }}
              placeholder="このステップの概要を入力..."
            />
          </div>


          {/* 詳細手順 */}
          <div>
            <label className="custom-form-label text-sm">
              詳細手順
            </label>
            <div className="space-y-2">
              {step.detailedInstructions.map((instruction, instIndex) => (
                <div key={instIndex} className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500 w-6">{instIndex + 1}.</span>
                  <input
                    type="text"
                    value={instruction}
                    onChange={(e) => handleDetailedInstructionChange(instIndex, e.target.value)}
                    className="custom-form-input"
                    style={{ padding: '10px 14px', fontSize: '1rem' }}
                    placeholder="手順を入力..."
                  />
                  <button
                    type="button"
                    onClick={() => removeDetailedInstruction(instIndex)}
                    className="custom-rect-button red tiny"
                  >
                    削除
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addDetailedInstruction}
                className="custom-rect-button emerald small"
              >
                <span>+ 手順を追加</span>
              </button>
            </div>
          </div>

          {/* 切削条件セクション */}
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
            <h4 className="text-base font-semibold text-white mb-2">切削条件</h4>
            <div className="space-y-4">
              {(() => {
                // 切削条件が単一のCuttingConditionsオブジェクトか、複数のオブジェクトかを判別
                const conditions = step.cuttingConditions || {};
                const isMultipleConditions = !('tool' in conditions) && typeof conditions === 'object';
                
                if (!isMultipleConditions) {
                  // 単一の切削条件の場合（後方互換性のため）
                  if (!conditions.tool && !conditions.spindleSpeed && !conditions.feedRate) {
                    return (
                      <div className="text-sm text-gray-500">
                        切削条件が設定されていません
                      </div>
                    );
                  }
                  // 単一から複数への変換
                  const newConditions = { 'condition_1': conditions as CuttingConditions };
                  onUpdate({ ...step, cuttingConditions: newConditions });
                  return null;
                }
                
                const conditionEntries = Object.entries(conditions);
                
                if (conditionEntries.length === 0) {
                  return (
                    <div className="text-sm text-gray-500">
                      切削条件が設定されていません
                    </div>
                  );
                }
                
                return conditionEntries.map(([key, condition], index) => (
                  <div key={`${index}-${key}`} className="border border-gray-300 rounded-md p-3 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <input
                        type="text"
                        defaultValue={key}
                        onBlur={(e) => {
                          const newKey = e.target.value;
                          if (newKey !== key && newKey) {
                            const newConditions: { [key: string]: CuttingConditions } = {};
                            Object.entries(conditions).forEach(([k, v]) => {
                              if (k === key) {
                                newConditions[newKey] = v;
                              } else {
                                newConditions[k] = v;
                              }
                            });
                            onUpdate({ ...step, cuttingConditions: newConditions });
                          }
                        }}
                        className="text-base font-medium px-2 py-1 border border-gray-300 rounded"
                        style={{ padding: '8px 12px', fontSize: '1rem' }}
                        placeholder="工程名（例: roughing_fullback）"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newConditions = { ...conditions };
                          delete newConditions[key];
                          onUpdate({ ...step, cuttingConditions: newConditions });
                        }}
                        className="custom-rect-button red tiny"
                      >
                        削除
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">工具</label>
                        <input
                          type="text"
                          value={(condition && typeof condition === 'object' && 'tool' in condition) ? (condition.tool || '') : ''}
                          onChange={(e) => {
                            const newConditions = { ...conditions };
                            newConditions[key] = { ...(condition || {}), tool: e.target.value };
                            onUpdate({ ...step, cuttingConditions: newConditions });
                          }}
                          className="w-full px-2 py-1 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{ padding: '10px 14px', fontSize: '1rem' }}
                          placeholder="例: φ10エンドミル"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">主軸回転数</label>
                        <input
                          type="text"
                          value={(condition && typeof condition === 'object' && 'spindleSpeed' in condition) ? (condition.spindleSpeed || '') : ''}
                          onChange={(e) => {
                            const newConditions = { ...conditions };
                            newConditions[key] = { ...(condition || {}), spindleSpeed: e.target.value };
                            onUpdate({ ...step, cuttingConditions: newConditions });
                          }}
                          className="w-full px-2 py-1 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{ padding: '10px 14px', fontSize: '1rem' }}
                          placeholder="例: S3000"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">送り速度</label>
                        <input
                          type="text"
                          value={(condition && typeof condition === 'object' && 'feedRate' in condition) ? (condition.feedRate || '') : ''}
                          onChange={(e) => {
                            const newConditions = { ...conditions };
                            newConditions[key] = { ...(condition || {}), feedRate: e.target.value };
                            onUpdate({ ...step, cuttingConditions: newConditions });
                          }}
                          className="w-full px-2 py-1 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{ padding: '10px 14px', fontSize: '1rem' }}
                          placeholder="例: F500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">切込み深さ</label>
                        <input
                          type="text"
                          value={(condition && typeof condition === 'object' && 'depthOfCut' in condition) ? (condition.depthOfCut || '') : ''}
                          onChange={(e) => {
                            const newConditions = { ...conditions };
                            newConditions[key] = { ...(condition || {}), depthOfCut: e.target.value };
                            onUpdate({ ...step, cuttingConditions: newConditions });
                          }}
                          className="w-full px-2 py-1 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{ padding: '10px 14px', fontSize: '1rem' }}
                          placeholder="例: 2mm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">ステップオーバー</label>
                        <input
                          type="text"
                          value={(condition && typeof condition === 'object' && 'stepOver' in condition) ? (condition.stepOver || '') : ''}
                          onChange={(e) => {
                            const newConditions = { ...conditions };
                            newConditions[key] = { ...(condition || {}), stepOver: e.target.value };
                            onUpdate({ ...step, cuttingConditions: newConditions });
                          }}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                          placeholder="例: 5mm"
                        />
                      </div>
                    </div>
                  </div>
                ));
              })()}
              
              <button
                type="button"
                onClick={() => {
                  // 既存の切削条件を取得（型安全に）
                  let currentConditions: { [key: string]: CuttingConditions } = {};
                  if (step.cuttingConditions) {
                    // 単一形式か複数形式かを判定
                    if ('tool' in step.cuttingConditions) {
                      // 単一形式の場合は変換
                      currentConditions = { 'condition_1': step.cuttingConditions as CuttingConditions };
                    } else {
                      // 複数形式の場合はそのまま使用
                      currentConditions = step.cuttingConditions as { [key: string]: CuttingConditions };
                    }
                  }
                  
                  const newConditions = { ...currentConditions };
                  const newKey = `condition_${Object.keys(newConditions).length + 1}`;
                  newConditions[newKey] = {
                    tool: '',
                    spindleSpeed: '',
                    feedRate: '',
                    depthOfCut: '',
                    stepOver: ''
                  };
                  onUpdate({ ...step, cuttingConditions: newConditions });
                }}
                className="custom-rect-button emerald small"
              >
                <span>+ 切削条件を追加</span>
              </button>
            </div>
          </div>

          {/* 品質確認セクション */}
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
            <h4 className="text-base font-semibold text-white mb-2">品質確認</h4>
            <div className="space-y-4">
              {/* 確認項目リスト */}
              {(step.qualityCheck?.items || []).map((item, itemIndex) => (
                <div key={itemIndex} className="border border-gray-300 rounded-md p-4 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-lg font-semibold text-gray-900">＜確認項目 {itemIndex + 1}＞</h5>
                    <button
                      type="button"
                      onClick={() => {
                        const newItems = [...(step.qualityCheck?.items || [])];
                        newItems.splice(itemIndex, 1);
                        onUpdate({
                          ...step,
                          qualityCheck: {
                            items: newItems
                          }
                        });
                      }}
                      className="custom-rect-button red tiny"
                    >
                      削除
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        確認項目
                      </label>
                      <input
                        type="text"
                        value={item.checkPoint || ''}
                        onChange={(e) => {
                          const newItems = [...(step.qualityCheck?.items || [])];
                          newItems[itemIndex] = { ...item, checkPoint: e.target.value };
                          onUpdate({
                            ...step,
                            qualityCheck: {
                              items: newItems
                            }
                          });
                        }}
                        className="custom-form-input"
                        style={{ padding: '10px 14px', fontSize: '1rem' }}
                        placeholder="例: 寸法確認"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        公差
                      </label>
                      <input
                        type="text"
                        value={item.tolerance || ''}
                        onChange={(e) => {
                          const newItems = [...(step.qualityCheck?.items || [])];
                          newItems[itemIndex] = { ...item, tolerance: e.target.value };
                          onUpdate({
                            ...step,
                            qualityCheck: {
                              items: newItems
                            }
                          });
                        }}
                        className="custom-form-input"
                        style={{ padding: '10px 14px', fontSize: '1rem' }}
                        placeholder="例: ±0.05"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        表面粗さ
                      </label>
                      <input
                        type="text"
                        value={item.surfaceRoughness || ''}
                        onChange={(e) => {
                          const newItems = [...(step.qualityCheck?.items || [])];
                          newItems[itemIndex] = { ...item, surfaceRoughness: e.target.value };
                          onUpdate({
                            ...step,
                            qualityCheck: {
                              items: newItems
                            }
                          });
                        }}
                        className="custom-form-input"
                        style={{ padding: '10px 14px', fontSize: '1rem' }}
                        placeholder="例: Ra3.2"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-700 mb-1">
                        検査工具
                      </label>
                      <input
                        type="text"
                        value={item.inspectionTool || ''}
                        onChange={(e) => {
                          const newItems = [...(step.qualityCheck?.items || [])];
                          newItems[itemIndex] = { ...item, inspectionTool: e.target.value };
                          onUpdate({
                            ...step,
                            qualityCheck: {
                              items: newItems
                            }
                          });
                        }}
                        className="custom-form-input"
                        style={{ padding: '10px 14px', fontSize: '1rem' }}
                        placeholder="例: ノギス"
                      />
                    </div>
                  </div>
                </div>
              ))}
              
              <button
                type="button"
                onClick={() => {
                  const newItems = [...(step.qualityCheck?.items || []), {
                    checkPoint: '',
                    tolerance: '',
                    surfaceRoughness: '',
                    inspectionTool: ''
                  }];
                  onUpdate({
                    ...step,
                    qualityCheck: {
                      items: newItems
                    }
                  });
                }}
                className="custom-rect-button emerald small"
              >
                <span>+ 確認項目を追加</span>
              </button>
            </div>
          </div>

          {/* 画像・動画セクション */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 画像セクション */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'copy'
                setIsDragOver(true)
              }}
              onDragLeave={(e) => {
                // 子要素へのドラッグでも発火するため、実際に離れた時のみ処理
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setIsDragOver(false)
                }
              }}
              onDrop={async (e) => {
                e.preventDefault()
                setIsDragOver(false)
                
                const imageUrl = e.dataTransfer.getData('imageUrl')
                const fileName = e.dataTransfer.getData('fileName')
                
                if (imageUrl && fileName) {
                  try {
                    // 画像をダウンロードしてBlob化
                    const response = await fetch(imageUrl)
                    const blob = await response.blob()
                    
                    // File オブジェクトを作成
                    const file = new File([blob], fileName, { type: blob.type })
                    
                    // FileListを模擬（単一ファイル）
                    const dataTransfer = new DataTransfer()
                    dataTransfer.items.add(file)
                    
                    // 既存のアップロード処理を呼び出し
                    onFileUpload(index, 'images', dataTransfer.files, machineType)
                  } catch (error) {
                    console.error('画像の転送に失敗しました:', error)
                    alert('画像の転送に失敗しました')
                  }
                }
              }}
              className={`transition-all duration-200 rounded-xl ${
                isDragOver 
                  ? 'bg-blue-50 p-4 shadow-lg shadow-blue-200/50' 
                  : 'p-2'
              }`}
              style={{ 
                border: isDragOver ? '3px dashed #3b82f6' : '3px solid transparent',
                backgroundColor: isDragOver ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
              }}
            >
              <label className="custom-form-label">
                画像 ({stepFiles.images.length}件)
              </label>
              <div>
                {stepFiles.images.length > 0 && (
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 mb-4">
                    {stepFiles.images.map((image, imgIndex) => (
                      <div key={imgIndex} className="relative group">
                        <div className="aspect-square bg-gray-100 rounded-md overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border border-gray-200"
                          onClick={() => {
                            const imageUrls = stepFiles.images.map(img => 
                              img.startsWith('blob:') ? img : `/api/files?drawingNumber=${drawingNumber}&folderType=images&subFolder=${stepFolderName}&fileName=${encodeURIComponent(img)}`
                            );
                            const currentIdx = stepFiles.images.indexOf(image);
                            onImageClick(imageUrls, currentIdx);
                          }}>
                          <img
                            src={image.startsWith('blob:') ? image : `/api/files?drawingNumber=${drawingNumber}&folderType=images&subFolder=${stepFolderName}&fileName=${encodeURIComponent(image)}`}
                            alt={`ステップ画像 - ${image}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              const parent = e.currentTarget.parentElement
                              if (parent && !parent.querySelector('.error-message')) {
                                const errorDiv = document.createElement('div')
                                errorDiv.className = 'error-message flex items-center justify-center h-full text-gray-400'
                                errorDiv.innerHTML = '<span>画像を読み込めません</span>'
                                parent.appendChild(errorDiv)
                              }
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => onFileRemove(index, 'images', imgIndex, machineType)}
                          className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded px-1.5 py-0.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                        >
                          削除
                        </button>
                        <div className="mt-0.5 text-xs text-gray-500 truncate" title={image}>
                          {image}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* 常にドロップゾーンを表示 */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => onFileUpload(index, 'images', e.target.files, machineType)}
                  className="hidden"
                />
                <div 
                  className={`custom-dropzone ${isDragOver ? 'dragover' : ''} ${
                    stepFiles.images.length > 0 ? 'custom-dropzone-compact' : ''
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="pointer-events-none">
                    <div className="custom-dropzone-icon">
                      {isDragOver ? '📥' : '📷'}
                    </div>
                    <p className="custom-dropzone-text">
                      {stepFiles.images.length > 0 
                        ? '画像を追加' 
                        : 'ここに画像をドロップ'}
                    </p>
                    <p className="custom-dropzone-subtext">
                      または、クリックしてファイルを選択
                    </p>
                    {stepFiles.images.length === 0 && (
                      <p className="custom-dropzone-subtext">
                        追記情報からドラッグ&ドロップも可能です
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 動画セクション */}
            <div>
              <label className="custom-form-label">
                動画 ({stepFiles.videos.length}件)
              </label>
              <div>
                {stepFiles.videos.length > 0 ? (
                  <div className="space-y-2">
                    {stepFiles.videos.map((video, vidIndex) => (
                      <div key={vidIndex} className="border border-gray-200 rounded-md bg-gray-50 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-700 font-medium">{video}</span>
                          <button
                            type="button"
                            onClick={() => onFileRemove(index, 'videos', vidIndex, machineType)}
                            className="custom-rect-button red tiny"
                          >
                            削除
                          </button>
                        </div>
                        <div className="aspect-video bg-gray-100 rounded overflow-hidden">
                          <video
                            controls
                            className="w-full h-full object-cover"
                            key={video}
                          >
                            <source
                              src={`/api/files?drawingNumber=${drawingNumber}&folderType=videos&subFolder=${stepFolderName}&fileName=${encodeURIComponent(video)}`}
                              type="video/mp4"
                            />
                            お使いのブラウザは動画をサポートしていません。
                          </video>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    動画はありません
                  </div>
                )}
                
                <div className="flex items-center space-x-2 mt-4">
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    onChange={(e) => onFileUpload(index, 'videos', e.target.files, machineType)}
                    className="hidden"
                    id={`video-upload-${index}`}
                  />
                  <label
                    htmlFor={`video-upload-${index}`}
                    className={`custom-rect-button small ${
                      uploadingFiles[`${index}-videos`]
                        ? 'gray cursor-not-allowed'
                        : 'purple cursor-pointer'
                    }`}
                  >
                    <span>{uploadingFiles[`${index}-videos`] ? 'アップロード中...' : '+ 動画を追加'}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
    </div>
  )
}

// ヒヤリハット事例エディタコンポーネント
interface NearMissEditorProps {
  item: NearMissItem
  index: number
  onChange: (index: number, field: keyof NearMissItem, value: string) => void
  onRemove: () => void
}

function NearMissEditor({ item, index, onChange, onRemove }: NearMissEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const severityOptions = ['low', 'medium', 'high', 'critical'] as const
  const severityLabels = {
    low: '低',
    medium: '中',
    high: '高',
    critical: '危険'
  }

  return (
    <div className="border border-gray-600 rounded-lg bg-gray-800">
      {/* ヘッダー */}
      <div className="px-4 py-3 flex justify-between items-center rounded-t-lg border-b-2 border-emerald-500 shadow-lg" style={{ background: 'linear-gradient(to right, #1f2937, #111827)' }}>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-3 text-left flex-1"
        >
          <div className="w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300" 
               style={{ 
                 backgroundColor: isExpanded ? '#10b981' : 'transparent',
                 transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                 boxShadow: isExpanded ? '0 0 10px rgba(16, 185, 129, 0.5)' : 'none'
               }}>
            <span className="text-white font-bold" style={{ fontSize: '1.125rem' }}>▶</span>
          </div>
          <span className="font-bold text-white" style={{ fontSize: '1.75rem' }}>
            事例 {index + 1}: {item.title || '(未設定)'}
          </span>
        </button>
        
        <div className="flex items-center space-x-2">
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
            item.severity === 'critical' 
              ? 'bg-red-100 text-red-800' 
              : item.severity === 'high'
              ? 'bg-orange-100 text-orange-800'
              : item.severity === 'medium'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-green-100 text-green-800'
          }`}>
            {severityLabels[item.severity]}
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="custom-rect-button red tiny"
            title="削除"
          >
            削除
          </button>
        </div>
      </div>

      {/* 詳細内容 */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* タイトルと重要度 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                タイトル <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={item.title}
                onChange={(e) => onChange(index, 'title', e.target.value)}
                className="custom-form-input"
                placeholder="事例のタイトルを入力..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                重要度 <span className="text-red-500">*</span>
              </label>
              <select
                value={item.severity}
                onChange={(e) => onChange(index, 'severity', e.target.value)}
                className="custom-form-input"
              >
                {severityOptions.map(severity => (
                  <option key={severity} value={severity}>
                    {severityLabels[severity]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 内容 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={item.description}
              onChange={(e) => onChange(index, 'description', e.target.value)}
              rows={3}
              className="custom-form-textarea"
              placeholder="どのような事例が発生したかを詳しく説明..."
            />
          </div>

          {/* 原因 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={item.cause}
              onChange={(e) => onChange(index, 'cause', e.target.value)}
              rows={2}
              className="custom-form-textarea"
              placeholder="事例が発生した原因を記入..."
            />
          </div>

          {/* 予防策 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              予防策 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={item.prevention}
              onChange={(e) => onChange(index, 'prevention', e.target.value)}
              rows={2}
              className="custom-form-textarea"
              placeholder="再発防止のための対策を記入..."
            />
          </div>
        </div>
      )}
    </div>
  )
}
