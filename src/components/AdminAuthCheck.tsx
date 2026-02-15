'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthInfo } from '@/lib/auth/client'

export function AdminAuthCheck({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const checkAuth = () => {
      // 認証情報をチェック（自動的に期限チェックも行われる）
      const authInfo = getAuthInfo()
      
      if (!authInfo || !authInfo.password) {
        // 認証情報がないか期限切れの場合はログイン画面へ
        router.push('/admin/login')
      }
    }

    // 初回チェック
    checkAuth()

    // 定期的にセッション有効期限をチェック（1分ごと）
    const interval = setInterval(checkAuth, 60 * 1000)

    return () => clearInterval(interval)
  }, [router])

  return <>{children}</>
}