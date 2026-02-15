import React from 'react'

export default function Header() {
  return (
    <header className="bg-gray-900/95 backdrop-blur-md border-b border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* ロゴ・タイトル */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">📋</span>
            </div>
            <h1 className="text-white font-bold text-xl tracking-wide">
              図面記録データベース
            </h1>
          </div>
          
          {/* 右側のナビ（将来の拡張用） */}
          <div className="flex items-center gap-4">
            {/* 今後、ユーザーメニューやその他の機能を追加可能 */}
          </div>
        </div>
      </div>
    </header>
  )
}