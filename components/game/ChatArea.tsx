'use client'

import { useEffect, useRef } from 'react'
import { ConversationMessage } from '@/lib/types'
import { User, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatAreaProps {
  messages: ConversationMessage[]
  streamingText: string
  isStreaming: boolean
  atmosphereHint?: 'danger' | 'normal' | 'mystery' | 'triumph'
  hasBgImage?: boolean
}

const ATMOSPHERE_STYLES: Record<string, { bar: string; border: string; glow: string; label: string }> = {
  danger: {
    bar: 'bg-red-500 shadow-[0_0_12px_rgba(220,38,38,0.4)]',
    border: 'border-red-900/40',
    glow: 'shadow-red-900/10',
    label: 'text-red-400 border-red-800/40 bg-red-950/30',
  },
  mystery: {
    bar: 'bg-purple-500 shadow-[0_0_12px_rgba(147,51,234,0.4)]',
    border: 'border-purple-900/40',
    glow: 'shadow-purple-900/10',
    label: 'text-purple-400 border-purple-800/40 bg-purple-950/30',
  },
  triumph: {
    bar: 'bg-amber-500 shadow-[0_0_12px_rgba(217,119,6,0.4)]',
    border: 'border-amber-800/40',
    glow: 'shadow-amber-900/10',
    label: 'text-amber-400 border-amber-800/40 bg-amber-950/30',
  },
  normal: {
    bar: 'bg-zinc-600',
    border: 'border-zinc-800/40',
    glow: '',
    label: 'text-zinc-400 border-zinc-800/40 bg-zinc-900/30',
  },
}

export function ChatArea({ messages, streamingText, isStreaming, atmosphereHint = 'normal', hasBgImage = false }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const as = ATMOSPHERE_STYLES[atmosphereHint]
  const hasContent = messages.length > 0 || isStreaming

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  return (
    <div className={cn(
      'flex-1 overflow-y-auto relative',
      'scrollbar-thin',
        '[&::-webkit-scrollbar-track]:bg-[var(--bg-primary)]',
        '[&::-webkit-scrollbar-thumb]:bg-[var(--border)]'
    )}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, var(--bg-secondary) 0%, transparent 40%, var(--bg-primary) 85%)',
        }}
      />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-1">
        {/* 开场占位 */}
        {!hasContent && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-16 h-16 rounded-2xl border flex items-center justify-center mb-5"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="w-6 h-6 rounded-full border-2 border-zinc-700 animate-spin"
                style={{ borderTopColor: 'var(--accent)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>故事即将开始...</p>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>AI 正在编织你的冒险</p>
          </div>
        )}

        {/* 消息列表 */}
        {messages.map((msg, i) => (
          <div key={i}>
            {/* 回合分隔标识（每段AI叙事之前） */}
            {msg.role === 'assistant' && i > 0 && (
              <div className="flex items-center gap-3 py-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />
                <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>✦</span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />
              </div>
            )}

            {msg.role === 'assistant' ? (
              /* ——— AI 叙事卡片（全宽小说风格） ——— */
              <div
                className={cn(
                  'group relative flex gap-4 px-3 py-3 -mx-3 rounded-xl transition-all duration-300',
                  hasBgImage && 'bg-black/10 backdrop-blur-[2px]',
                )}
              >
                {/* 左侧氛围色条 */}
                <div className={cn(
                  'flex-shrink-0 w-0.5 rounded-full transition-all duration-500',
                  as.bar,
                )} />

                <div className="flex-1 min-w-0">
                  {/* 叙事文本 */}
                  <div
                    className={cn(
                      'text-sm sm:text-base leading-[1.85] whitespace-pre-wrap',
                      'first-letter:text-2xl first-letter:font-bold first-letter:mr-0.5',
                      'selection:bg-[var(--accent-soft)] selection:text-[var(--text-primary)]',
                      hasBgImage && 'drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]',
                    )}
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <span style={{ color: 'var(--accent)' }}>{msg.content[0]}</span>
                    {msg.content.slice(1)}
                  </div>
                  <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* ——— 玩家行动（轻量标签） ——— */
              <div className="flex justify-end px-0 py-1">
                <div className="flex items-center gap-2 max-w-[75%]">
                  <div
                    className={cn(
                      'text-xs sm:text-sm leading-relaxed px-4 py-2 border',
                    )}
                    style={{
                      backgroundColor: 'var(--accent-soft)',
                      color: 'var(--text-primary)',
                      borderColor: 'var(--accent)',
                      borderRadius: 'var(--bubble-radius)',
                      boxShadow: 'var(--bubble-shadow)',
                    }}
                  >
                    {msg.content}
                  </div>
                  <div
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border"
                    style={{
                      backgroundColor: 'var(--accent-soft)',
                      borderColor: 'var(--accent)',
                    }}
                  >
                    <User className="w-3 h-3" style={{ color: 'var(--accent)' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* 流式输出中的消息 */}
        {isStreaming && (
          <div>
            {(messages.length > 0) && (
              <div className="flex items-center gap-3 py-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />
                <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>✦</span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />
              </div>
            )}

            <div className={cn(
              'group relative flex gap-4 px-3 py-3 -mx-3 rounded-xl',
              hasBgImage && 'bg-black/10 backdrop-blur-[2px]',
            )}>
              <div className={cn(
                'flex-shrink-0 w-0.5 rounded-full transition-all duration-500',
                streamingText ? as.bar : 'bg-zinc-700/50',
              )} />
              <div className="flex-1 min-w-0">
                {streamingText ? (
                  <div
                    className={cn(
                      'text-sm sm:text-base leading-[1.85] whitespace-pre-wrap',
                      'selection:bg-[var(--accent-soft)] selection:text-[var(--text-primary)]',
                      hasBgImage && 'drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]',
                    )}
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {streamingText}
                    <span
                      className="inline-block w-0.5 h-[1em] ml-0.5 animate-pulse align-text-bottom"
                      style={{ backgroundColor: 'var(--accent)' }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 py-2" style={{ color: 'var(--text-muted)' }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-xs tracking-wider">编织叙事中</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 底部空间 */}
        <div className="h-2" />
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
