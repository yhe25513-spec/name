'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
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
    <div className="border-t px-3 py-3 space-y-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
      {/* 快捷选项 */}
      {quickOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {quickOptions.map((option, i) => (
            <button
              key={i}
              onClick={() => handleOptionClick(option)}
              disabled={isLoading}
              className="text-xs px-3 py-2 sm:py-1.5 rounded-full border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)'
                e.currentTarget.style.color = 'var(--accent)'
                e.currentTarget.style.backgroundColor = 'var(--accent-soft)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text-secondary)'
                e.currentTarget.style.backgroundColor = 'var(--bg-card)'
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
          className="flex-1 min-h-[44px] max-h-32 resize-none text-sm leading-relaxed disabled:opacity-50 placeholder:text-[var(--text-muted)]"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading || !input.trim()}
          className="h-11 w-11 flex-shrink-0 rounded-lg flex items-center justify-center transition-all disabled:opacity-40 active:scale-90"
          style={{
            backgroundColor: 'var(--accent)',
            color: '#000',
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
