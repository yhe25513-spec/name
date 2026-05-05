'use client'

import { useEffect, useRef } from 'react'
import { ConversationMessage } from '@/lib/types'
import { User, Bot, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatAreaProps {
  messages: ConversationMessage[]
  streamingText: string
  isStreaming: boolean
  atmosphereHint?: 'danger' | 'normal' | 'mystery' | 'triumph'
}

const atmosphereColors = {
  danger: 'border-red-900/30 bg-red-950/10',
  normal: 'border-zinc-800/30 bg-zinc-900/20',
  mystery: 'border-purple-900/30 bg-purple-950/10',
  triumph: 'border-amber-900/30 bg-amber-950/10',
}

export function ChatArea({ messages, streamingText, isStreaming, atmosphereHint = 'normal' }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
      {messages.length === 0 && !isStreaming && (
        <div className="text-center text-zinc-600 text-sm py-12">
          <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>游戏开始，输入你的行动...</p>
        </div>
      )}

      {messages.map((msg, i) => (
        <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
          {/* 头像 */}
          <div className={cn(
            'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
            msg.role === 'user'
              ? 'bg-amber-500/20 border border-amber-500/30'
              : 'bg-zinc-700/50 border border-zinc-600/30'
          )}>
            {msg.role === 'user'
              ? <User className="w-3.5 h-3.5 text-amber-400" />
              : <Bot className="w-3.5 h-3.5 text-zinc-400" />
            }
          </div>

          {/* 内容 */}
          <div className={cn(
            'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
            msg.role === 'user'
              ? 'bg-amber-500/10 border border-amber-500/20 text-amber-50 rounded-tr-sm'
              : cn('border text-zinc-200 rounded-tl-sm', atmosphereColors[atmosphereHint])
          )}>
            <p className="whitespace-pre-wrap">{msg.content}</p>
            <span className="text-[10px] text-zinc-600 mt-1 block">
              {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      ))}

      {/* 流式输出中的消息 */}
      {(isStreaming || streamingText) && (
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-zinc-700/50 border border-zinc-600/30">
            <Bot className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className={cn(
            'max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed border text-zinc-200',
            atmosphereColors[atmosphereHint]
          )}>
            {streamingText ? (
              <p className="whitespace-pre-wrap">
                {streamingText}
                <span className="inline-block w-0.5 h-4 bg-amber-400 ml-0.5 animate-pulse" />
              </p>
            ) : (
              <div className="flex items-center gap-2 text-zinc-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs">AI 正在思考...</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
