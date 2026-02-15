'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FormInput } from '@/components/admin/forms'

export default function AdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // ユーザー情報をlocalStorageに保存
        const now = new Date().toISOString()
        window.localStorage.setItem('authData', JSON.stringify({
          id: data.user.id,
          name: data.user.name,
          password: password,
          loginTime: now,
          lastAccessTime: now
        }))
        
        // 管理画面へリダイレクト
        router.push('/admin')
      } else {
        setError('パスワードが正しくありません')
      }
    } catch {
      setError('ログインエラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">管理画面ログイン</h1>
          <p className="text-gray-600 mt-2">作業記録データベース</p>
        </div>
        
        <form onSubmit={handleLogin} className="flex flex-col items-center">
          <FormInput
            label="パスワード"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワードを入力"
            required
            disabled={isLoading}
            autoFocus
            className="!w-80"
          />
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 w-full max-w-xs">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            className="custom-rect-button blue"
            disabled={isLoading}
          >
            <span>{isLoading ? 'ログイン中...' : 'ログイン'}</span>
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-800">
            ← トップページに戻る
          </Link>
        </div>
      </div>
    </div>
  )
}