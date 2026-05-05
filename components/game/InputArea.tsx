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
    <div className="border-t border-zinc-800 bg-zinc-950 p-3 space-y-2">
      {/* 快捷选项 */}
      {quickOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {quickOptions.map((option, i) => (
            <button
              key={i}
              onClick={() => handleOptionClick(option)}
              disabled={isLoading}
              className="text-xs px-3 py-1.5 rounded-full border border-zinc-700 bg-zinc-800/50 text-zinc-300
                hover:border-amber-500/50 hover:text-amber-300 hover:bg-amber-500/10
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-150"
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
          className="flex-1 min-h-[44px] max-h-32 resize-none
            bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500
            focus:border-amber-500/50 focus:ring-0
            text-sm leading-relaxed
            disabled:opacity-50"
        />
        <Button
          onClick={handleSubmit}
          disabled={isLoading || !input.trim()}
          size="icon"
          className="h-11 w-11 flex-shrink-0 bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-40"
        >
          {isLoading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" />
          }
        </Button>
      </div>
    </div>
  )
}
