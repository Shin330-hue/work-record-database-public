'use client'

import React from 'react'

interface FormButtonProps {
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  variant?: 'blue' | 'gray' | 'emerald' | 'purple'
  size?: 'normal' | 'small'
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  className?: string
}

export const FormButton: React.FC<FormButtonProps> = ({
  children,
  onClick,
  type = 'button',
  variant = 'blue',
  size = 'normal',
  disabled = false,
  loading = false,
  fullWidth = false,
  className = ''
}) => {
  const baseClasses = `custom-rect-button ${variant} ${size === 'small' ? 'small' : ''}`
  const widthClass = fullWidth ? 'w-full' : ''
  const disabledClass = disabled || loading ? 'disabled:opacity-50 disabled:cursor-not-allowed' : ''
  
  // デフォルトのスタイルクラス（custom-add-buttonのような具体的なスタイルを追加）
  const defaultStyles = 'inline-flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all'
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${defaultStyles} ${widthClass} ${disabledClass} ${className}`}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {children}
        </>
      ) : (
        children
      )}
    </button>
  )
}