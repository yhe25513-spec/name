'use client'

import { useEffect, useRef, useMemo } from 'react'
import { ConversationMessage } from '@/lib/types'
import { User, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** 智能过滤 "undefined" 及其中间态（如 "undefi"、"undefin" 等）避免打字中显示 */
function sanitizeUndefined(text: string): string {
  let result = text.replace(/undefined/g, '')
  // 删除末尾的 "undefined" 部分前缀，防止跨 chunk 拼合时逐字显示
  const prefixes = ['u', 'un', 'und', 'unde', 'undef', 'undefi', 'undefin', 'undefine']
  for (const p of prefixes) {
    if (result.endsWith(p)) {
      return result.slice(0, -p.length)
    }
  }
  return result
}

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

// ─── NPC Avatar Colors ───
const AVATAR_COLORS = [
  { bg: '#ef4444', text: '#fff' },
  { bg: '#f59e0b', text: '#fff' },
  { bg: '#10b981', text: '#fff' },
  { bg: '#3b82f6', text: '#fff' },
  { bg: '#8b5cf6', text: '#fff' },
  { bg: '#ec4899', text: '#fff' },
  { bg: '#14b8a6', text: '#fff' },
  { bg: '#f97316', text: '#fff' },
  { bg: '#6366f1', text: '#fff' },
  { bg: '#a855f7', text: '#fff' },
]

function getAvatarColor(name: string): { bg: string; text: string } {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ─── NPC Dialogue Detection ───

interface DialogueSegment {
  type: 'narration' | 'npc_dialogue' | 'npc_name'
  text: string
  npcName?: string
}

/** 从文本中检测 NPC 对话并分段 */
function parseDialogueSegments(text: string): DialogueSegment[] {
  // 匹配模式："NPC名说/NPC名道/NPC名：" 后的对话内容
  const npcSpeechPattern = /(['"「『]?)([一-鿿㐀-䶿\w]{2,8}?)(?:说(?:道|：|:)|道(?:：|:)|：(?!\s)|：\s?|[：:])\s*(['"」』]?)(.+?)(['"」』]?(?=\s*[。！？\n]|$))/g

  const segments: DialogueSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = npcSpeechPattern.exec(text)) !== null) {
    // 匹配之前的叙述文本
    if (match.index > lastIndex) {
      segments.push({ type: 'narration', text: text.slice(lastIndex, match.index) })
    }

    const npcName = match[2]
    const dialogueContent = match[4] || match[0]

    segments.push({ type: 'npc_name', text: npcName, npcName })
    segments.push({ type: 'npc_dialogue', text: dialogueContent, npcName })

    lastIndex = match.index + match[0].length
  }

  // 剩余文本
  if (lastIndex < text.length) {
    segments.push({ type: 'narration', text: text.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ type: 'narration', text }]
}

function NPCAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'xs' }) {
  const color = getAvatarColor(name)
  const sizeClasses = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-5 h-5 text-[9px]'

  return (
    <div
      className={cn('rounded-full flex-shrink-0 flex items-center justify-center font-bold', sizeClasses)}
      style={{
        backgroundColor: color.bg,
        color: color.text,
        boxShadow: `0 0 12px ${color.bg}40`,
      }}
      title={name}
    >
      {name.charAt(0)}
    </div>
  )
}

// ─── AI Message Renderer ───

function AIRender({ content, hasBgImage }: { content: string; hasBgImage: boolean }) {
  const segments = useMemo(() => parseDialogueSegments(content), [content])

  if (segments.length === 1 && segments[0].type === 'narration') {
    // 没有NPC对话，常规渲染
    return <span>{content}</span>
  }

  return (
    <div className="space-y-2">
      {segments.map((seg, i) => {
        if (seg.type === 'narration') {
          return <span key={i}>{seg.text}</span>
        }
        if (seg.type === 'npc_name') {
          return (
            <div key={i} className="flex items-center gap-2 mt-3 mb-1">
              <NPCAvatar name={seg.npcName || seg.text} size="sm" />
              <span
                className="text-xs font-semibold tracking-wide"
                style={{ color: 'var(--accent)' }}
              >
                {seg.text}
              </span>
            </div>
          )
        }
        if (seg.type === 'npc_dialogue') {
          return (
            <div key={i} className="relative pl-3 ml-10 mb-2" style={{
              borderLeft: '2px solid var(--accent2, #5eead4)',
              backgroundColor: 'rgba(255,255,255,0.02)',
              borderRadius: '0 8px 8px 0',
              padding: '4px 12px',
            }}>
              <span
                className="italic"
                style={{ color: 'var(--text-secondary)' }}
              >
                「{seg.text}」
              </span>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

export function ChatArea({ messages, streamingText, isStreaming, atmosphereHint = 'normal', hasBgImage = false }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)
  const as = ATMOSPHERE_STYLES[atmosphereHint]
  const hasContent = messages.length > 0 || isStreaming

  // 检测用户手动滚动：如果距离底部超过 120px，认为用户在手动查看历史内容
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      userScrolledRef.current = distFromBottom > 120
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // 新消息（完整回合）到达时，无条件滚动到底部
  useEffect(() => {
    userScrolledRef.current = false
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 流式输出中，仅当用户没有手动上滚时才自动跟随
  useEffect(() => {
    if (userScrolledRef.current) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamingText])

  return (
    <div ref={containerRef} className={cn(
      'flex-1 overflow-y-auto relative',
      'scrollbar-thin',
        '[&::-webkit-scrollbar-track]:bg-[var(--bg-primary)]',
        '[&::-webkit-scrollbar-thumb]:bg-[var(--border)]'
    )}>
      {/* 玻璃拟态背景 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundColor: 'var(--glass-bg)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          borderRight: '1px solid var(--glass-border)',
          maskImage: 'linear-gradient(to bottom, black 0%, transparent 15%, black 50%, transparent 85%, black 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 15%, black 50%, transparent 85%, black 100%)',
        }}
      />
      {/* 故事纹理覆盖 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,.008) 2px, rgba(255,255,255,.008) 4px)',
          opacity: 0.5,
        }}
      />

      <div className="relative max-w-5xl mx-auto px-4 md:px-8 lg:px-10 py-6 space-y-1">
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
                  {/* 叙事文本 - 使用 NPC 感知渲染 */}
                  <div
                    className={cn(
                      'text-sm sm:text-base leading-[1.9] whitespace-pre-wrap',
                      'first-letter:text-2xl first-letter:font-bold first-letter:mr-0.5 first-letter:text-[var(--accent)]',
                      'selection:bg-[var(--accent-soft)] selection:text-[var(--text-primary)]',
                      hasBgImage && 'drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]',
                    )}
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {msg.content ? (
                      <AIRender content={msg.content} hasBgImage={hasBgImage} />
                    ) : (
                      <span className="italic opacity-50">——</span>
                    )}
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
                      'text-sm sm:text-base leading-[1.9] whitespace-pre-wrap',
                      'selection:bg-[var(--accent-soft)] selection:text-[var(--text-primary)]',
                      hasBgImage && 'drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]',
                    )}
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {sanitizeUndefined(streamingText)}
                    <span
                      className="inline-block w-0.5 h-[1em] ml-0.5 animate-pulse align-text-bottom"
                      style={{ backgroundColor: 'var(--accent)' }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-2" style={{ color: 'var(--text-muted)' }}>
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full animate-[typing-bounce_0.7s_infinite_ease-in-out]" style={{ backgroundColor: 'var(--accent)' }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-[typing-bounce_0.7s_0.15s_infinite_ease-in-out]" style={{ backgroundColor: 'var(--accent)' }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-[typing-bounce_0.7s_0.3s_infinite_ease-in-out]" style={{ backgroundColor: 'var(--accent)' }} />
                    </span>
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
