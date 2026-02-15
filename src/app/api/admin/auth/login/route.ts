import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    
    if (!password) {
      return NextResponse.json(
        { error: 'パスワードが入力されていません' },
        { status: 400 }
      )
    }

    // 管理ページが無効の場合
    if (process.env.ADMIN_ENABLED !== 'true') {
      return NextResponse.json(
        { error: '管理ページが無効です' },
        { status: 403 }
      )
    }

    // 外部ファイル認証を使用する場合
    if (process.env.USE_FILE_AUTH === 'true') {
      try {
        const authFilePath = path.join(process.cwd(), process.env.AUTH_FILE_PATH || '')
        const raw = fs.readFileSync(authFilePath, 'utf-8')
        const sanitized = raw.replace(/^\uFEFF/, '')
        const authData = JSON.parse(sanitized)
        
        const user = authData.passwords.find((u: { password: string; enabled: boolean; id: string; name: string }) => 
          u.password === password && u.enabled
        )
        
        if (user) {
          return NextResponse.json({
            success: true,
            user: {
              id: user.id,
              name: user.name
            }
          })
        }
      } catch (fileError) {
        console.error('認証ファイル読み込みエラー:', fileError)
      }
    }
    
    // 従来の環境変数認証（フォールバック）
    if (password === process.env.ADMIN_PASSWORD) {
      return NextResponse.json({
        success: true,
        user: {
          id: 'admin',
          name: '管理者'
        }
      })
    }
    
    return NextResponse.json(
      { error: 'パスワードが正しくありません' },
      { status: 401 }
    )
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
