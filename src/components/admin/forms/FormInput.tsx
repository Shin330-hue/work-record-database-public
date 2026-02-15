'use client'

import React from 'react'

interface FormInputProps {
  label?: string
  name: string
  type?: 'text' | 'email' | 'password' | 'number'
  value: string | number
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  placeholder?: string
  error?: string
  required?: boolean
  disabled?: boolean
  autoFocus?: boolean
  className?: string
  min?: number
  max?: number
  step?: number
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onKeyPress,
  placeholder,
  error,
  required = false,
  disabled = false,
  autoFocus = false,
  className = '',
  min,
  max,
  step
}) => {
  return (
    <div className="mb-6">
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        onKeyPress={onKeyPress}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        min={min}
        max={max}
        step={step}
        className={`custom-form-input text-lg ${error ? 'border-red-500' : ''} ${className}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && (
        <p id={`${name}-error`} className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}