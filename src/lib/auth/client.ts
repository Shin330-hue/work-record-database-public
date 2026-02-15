// 認証情報の型定義
export interface AuthInfo {
  id: string
  name: string
  password: string
  loginTime: string
  lastAccessTime?: string // 最終アクセス時刻を追加
}

// セッション有効期限（2時間）
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000 // 2時間

// 認証情報の取得（有効期限チェック付き）
export function getAuthInfo(): AuthInfo | null {
  if (typeof window === 'undefined') {
    return null
  }
  
  const authData = window.localStorage.getItem('authData')
  if (!authData) {
    return null
  }
  
  const parsedData: AuthInfo = JSON.parse(authData)
  
  // 最終アクセス時刻をチェック
  if (parsedData.lastAccessTime) {
    const lastAccess = new Date(parsedData.lastAccessTime).getTime()
    const now = new Date().getTime()
    
    // セッションタイムアウトをチェック
    if (now - lastAccess > SESSION_TIMEOUT_MS) {
      // セッション期限切れ
      clearAuthInfo()
      return null
    }
  }
  
  // アクセス時刻を更新
  updateLastAccessTime(parsedData)
  
  return parsedData
}

// 最終アクセス時刻を更新
function updateLastAccessTime(authInfo: AuthInfo): void {
  if (typeof window !== 'undefined') {
    authInfo.lastAccessTime = new Date().toISOString()
    window.localStorage.setItem('authData', JSON.stringify(authInfo))
  }
}

// 認証情報の保存
export function saveAuthInfo(authInfo: AuthInfo): void {
  if (typeof window !== 'undefined') {
    // 初回ログイン時はlastAccessTimeを設定
    if (!authInfo.lastAccessTime) {
      authInfo.lastAccessTime = new Date().toISOString()
    }
    window.localStorage.setItem('authData', JSON.stringify(authInfo))
  }
}

// 認証情報のクリア
export function clearAuthInfo(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('authData')
  }
}

// 認証ヘッダーを生成する共通関数
export function getAuthHeaders(): HeadersInit {
  const authInfo = getAuthInfo()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${authInfo?.password || ''}`,
    'Content-Type': 'application/json'
  }

  if (authInfo?.id) {
    headers['X-Admin-User-Id'] = encodeURIComponent(authInfo.id)
  }

  if (authInfo?.name) {
    headers['X-Admin-User-Name'] = encodeURIComponent(authInfo.name)
  }

  return headers
}

// FormData用の認証ヘッダー（Content-Typeなし）
export function getAuthHeadersForFormData(): HeadersInit {
  const authInfo = getAuthInfo()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${authInfo?.password || ''}`
  }

  if (authInfo?.id) {
    headers['X-Admin-User-Id'] = encodeURIComponent(authInfo.id)
  }

  if (authInfo?.name) {
    headers['X-Admin-User-Name'] = encodeURIComponent(authInfo.name)
  }

  return headers
}

// 認証状態のチェック
export function isAuthenticated(): boolean {
  const authInfo = getAuthInfo()
  return authInfo !== null && authInfo.password !== ''
}

// 簡易的なパスワード入力（Phase 1用）
export function promptForPassword(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  
  const authInfo = getAuthInfo()
  if (authInfo) {
    return authInfo.password
  }
  
  const password = prompt('管理者パスワードを入力してください')
  if (password) {
    // 簡易版: IDと名前は仮設定
    saveAuthInfo({
      id: 'temp',
      name: 'ユーザー',
      password: password,
      loginTime: new Date().toISOString()
    })
  }
  
  return password
}