'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2 } from 'lucide-react'

interface InputAreaProps {
  onSubmit: (input: string) => void
  isLoading: boolean
  quickOptions: string[]
}

export function InputArea({ onSubmit, isLoading, quickOptions }: InputAreaProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSubmit() {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    onSubmit(trimmed)
    setInput('')
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleOptionClick(option: string) {
    if (isLoading) return
    onSubmit(option)
  }

  return (
    <div
      className="border-t px-3 py-3 space-y-2"
      style={{
        backgroundColor: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur, 20px))',
        WebkitBackdropFilter: 'blur(var(--glass-blur, 20px))',
        borderTop: '1px solid var(--glass-border)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.2)',
      }}
    >
      {/* 快捷选项 */}
      {quickOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {quickOptions.map((option, i) => (
            <button
              key={i}
              onClick={() => handleOptionClick(option)}
              disabled={isLoading}
              className="text-xs px-4 py-2 sm:py-1.5 rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              style={{
                background: 'linear-gradient(180deg, var(--accent-soft), rgba(20,241,198,0.04))',
                border: '1px solid var(--accent2)',
                borderColor: 'color-mix(in srgb, var(--accent2) 28%, transparent)',
                color: 'var(--text-primary)',
                boxShadow: 'inset 0 1px rgba(255,255,255,0.08), var(--glow)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = 'var(--btn-glow), inset 0 1px rgba(255,255,255,0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0px)'
                e.currentTarget.style.boxShadow = 'inset 0 1px rgba(255,255,255,0.08), var(--glow)'
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {/* 输入框 */}
      <div className="flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入你的行动（Enter 发送，Shift+Enter 换行）"
          disabled={isLoading}
          rows={1}
          className="flex-1 min-h-[44px] max-h-32 resize-none text-sm leading-relaxed disabled:opacity-50 placeholder:text-[var(--text-muted)] transition-all duration-200"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.15)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.boxShadow = 'inset 0 2px 8px rgba(0,0,0,0.15), 0 0 0 1px var(--accent)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.boxShadow = 'inset 0 2px 8px rgba(0,0,0,0.15)'
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading || !input.trim()}
          className="h-11 w-11 flex-shrink-0 rounded-lg flex items-center justify-center transition-all duration-200 disabled:opacity-40 active:scale-90 hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            color: '#070b14',
            boxShadow: 'var(--glow)',
          }}
        >
          {isLoading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" />
          }
        </button>
      </div>
    </div>
  )
}
