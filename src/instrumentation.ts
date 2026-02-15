// Node.js v22+ では localStorage がグローバルに追加されているが、
// --localstorage-file が未設定だと getItem 等が機能しない。
// サーバーサイドでは localStorage を使用しないため、安全なスタブに差し替える。
export async function register() {
  if (typeof window === 'undefined' && typeof globalThis.localStorage !== 'undefined') {
    const noop = () => null
    ;(globalThis as Record<string, unknown>).localStorage = {
      getItem: noop,
      setItem: noop,
      removeItem: noop,
      clear: noop,
      length: 0,
      key: noop,
    }
  }
}
