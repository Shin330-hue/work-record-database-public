'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { AdminAuthCheck } from '@/components/AdminAuthCheck'
import { getAuthInfo, clearAuthInfo } from '@/lib/auth/client'
import { FormButton } from '@/components/admin/forms/FormButton'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [userInfo, setUserInfo] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    // ユーザー情報を取得
    const authData = getAuthInfo()
    setUserInfo(authData)
  }, [pathname]) // パス変更時に再取得

  const handleLogout = () => {
    clearAuthInfo()
    router.push('/admin/login')
  }

  // ログイン画面では共通ヘッダーを表示しない
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  return (
    <AdminAuthCheck>
      <div className="admin-theme">
        <header className="admin-header">
          <div className="admin-header__inner">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-6">
                <FormButton
                  onClick={() => router.push('/admin')}
                  variant="gray"
                  className="!text-xl !font-bold !text-gray-900 hover:!text-gray-700"
                >
                  管理画面
                </FormButton>
                
                {/* ナビゲーション */}
                <nav className="hidden md:flex space-x-4">
                  <Link
                    href="/admin/drawings/new"
                    className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                      pathname === '/admin/drawings/new' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    新規登録
                  </Link>
                  <Link
                    href="/admin/drawings/list"
                    className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                      pathname === '/admin/drawings/list' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    図番一覧
                  </Link>
                  <Link
                    href="/admin/audit-log"
                    className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                      pathname === '/admin/audit-log' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    監査ログ
                  </Link>
                </nav>
              </div>

              <div className="flex items-center space-x-4">
                {userInfo && (
                  <div className="text-sm text-gray-600">
                    ログイン中: <span className="font-medium text-gray-900">{userInfo.name}</span>
                  </div>
                )}
                <FormButton
                  onClick={() => router.push('/')}
                  variant="gray"
                  size="small"
                >
                  ← メインサイト
                </FormButton>
                <FormButton
                  onClick={handleLogout}
                  variant="gray"
                  size="small"
                  className="!bg-red-600 hover:!bg-red-700"
                >
                  ログアウト
                </FormButton>
              </div>
            </div>
          </div>
        </header>

        <main className="admin-main">{children}</main>
      </div>
    </AdminAuthCheck>
  )
}
