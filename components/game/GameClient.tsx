'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { GameSave, ConversationMessage, AIResponse, GameState, GameScenario } from '@/lib/types'
import { parseAIResponse, applyStateChanges } from '@/lib/deepseek'
import { StatusBar } from './StatusBar'
import { ChatArea } from './ChatArea'
import { InputArea } from './InputArea'
import { SidePanel } from './SidePanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ArrowLeft, Save, CheckCircle, ImageIcon, X, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api-client'
import { getTheme, FONTS, buildCustomThemeCss } from '@/lib/themes'

interface GameClientProps {
  initialSave: GameSave
  isSandbox?: boolean
}

const ATMOSPHERE_GLOW: Record<string, { glow: string; banner: string; accent: string }> = {
  danger: {
    glow: 'rgba(220,38,38,0.12)',
    banner: 'from-red-900/40 via-red-800/10 to-transparent',
    accent: 'border-red-500/30',
  },
  mystery: {
    glow: 'rgba(147,51,234,0.12)',
    banner: 'from-purple-900/40 via-purple-800/10 to-transparent',
    accent: 'border-purple-500/30',
  },
  triumph: {
    glow: 'rgba(217,119,6,0.15)',
    banner: 'from-amber-900/40 via-amber-800/10 to-transparent',
    accent: 'border-amber-500/30',
  },
  normal: {
    glow: 'rgba(120,113,108,0.05)',
    banner: 'from-zinc-900/30 via-transparent to-transparent',
    accent: 'border-zinc-700/30',
  },
}

export function GameClient({ initialSave, isSandbox = false }: GameClientProps) {
  const router = useRouter()
  const scenario = initialSave.scenario! as GameScenario

  const [messages, setMessages] = useState<ConversationMessage[]>(
    initialSave.conversation_history || []
  )
  const [state, setState] = useState<GameState>(initialSave.current_state)
  const [turnCount, setTurnCount] = useState(initialSave.turn_count)
  const [saveId, setSaveId] = useState(initialSave.id)

  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [quickOptions, setQuickOptions] = useState<string[]>([])
  const [atmosphereHint, setAtmosphereHint] = useState<AIResponse['atmosphereHint']>('normal')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [bgImageUrl, setBgImageUrl] = useState('')
  const [showBgDialog, setShowBgDialog] = useState(false)
  const [bgInputUrl, setBgInputUrl] = useState('')
  const [bgOpacity, setBgOpacity] = useState(0.30)
  const [bgBrightness, setBgBrightness] = useState(0.5) // 0=暗 1=亮
  const [themeId, setThemeId] = useState('linear')
  const [fontId, setFontId] = useState('sans')
  const [customThemeColors, setCustomThemeColors] = useState<{ bgShade: 'dark' | 'medium' | 'light'; accentColor: 'amber' | 'cyan' | 'emerald' | 'purple' | 'gold' | 'blue' }>({
    bgShade: 'dark',
    accentColor: 'amber',
  })
  const hasStartedRef = useRef(false)

  // Canvas 采样分析图片平均亮度（WCAG 相对亮度加权）
  function analyzeImageBrightness(url: string): Promise<number> {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = 100
          canvas.height = 100
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, 100, 100)
          const data = ctx.getImageData(0, 0, 100, 100).data
          let total = 0
          for (let i = 0; i < data.length; i += 4) {
            // WCAG 感知亮度加权：人眼对绿色最敏感
            total += (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
          }
          resolve(Math.round((total / (data.length / 4) / 255) * 100) / 100)
        } catch {
          resolve(0.5)
        }
      }
      img.onerror = () => resolve(0.5)
      img.src = url
    })
  }

  // 从 localStorage 加载背景图片（每个玩家独立）、主题、字体、自定义主题
  useEffect(() => {
    const saved = localStorage.getItem('game-bg-image')
    if (saved) {
      setBgImageUrl(saved)
      analyzeImageBrightness(saved).then(setBgBrightness)
    }
    const savedTheme = localStorage.getItem('game-theme')
    if (savedTheme) setThemeId(savedTheme)
    const savedFont = localStorage.getItem('game-font')
    if (savedFont) setFontId(savedFont)
    const savedCustom = localStorage.getItem('game-custom-theme')
    if (savedCustom) {
      try { setCustomThemeColors(JSON.parse(savedCustom)) } catch { /* ignore */ }
    }
  }, [])

  // 监听外部主题/字体变化（从场景选择器或同页设置）
  useEffect(() => {
    const handler = () => {
      const savedTheme = localStorage.getItem('game-theme')
      if (savedTheme) setThemeId(savedTheme)
      const savedFont = localStorage.getItem('game-font')
      if (savedFont) setFontId(savedFont)
      const savedCustom = localStorage.getItem('game-custom-theme')
      if (savedCustom) {
        try { setCustomThemeColors(JSON.parse(savedCustom)) } catch { /* ignore */ }
      }
    }
    window.addEventListener('theme-change', handler)
    return () => window.removeEventListener('theme-change', handler)
  }, [])

  // 图片 URL 变化时重新分析亮度
  useEffect(() => {
    if (bgImageUrl) {
      analyzeImageBrightness(bgImageUrl).then(setBgBrightness)
    }
  }, [bgImageUrl])

  function handleBgImageSave() {
    const url = bgInputUrl.trim()
    if (!url) {
      localStorage.removeItem('game-bg-image')
      setBgImageUrl('')
    } else {
      localStorage.setItem('game-bg-image', url)
      setBgImageUrl(url)
    }
    setShowBgDialog(false)
  }

  function handleBgImageClear() {
    localStorage.removeItem('game-bg-image')
    setBgImageUrl('')
    setBgInputUrl('')
    setShowBgDialog(false)
  }

  const atmosphere = atmosphereHint || 'normal'
  const glow = ATMOSPHERE_GLOW[atmosphere]
  const currentTheme = themeId === 'custom'
    ? { ...getTheme('dark'), css: buildCustomThemeCss(customThemeColors), id: 'custom', name: '自定义', icon: '🎨' }
    : getTheme(themeId)
  const selectedFont = FONTS.find((f) => f.id === fontId) || FONTS[0]

  // 开场剧情发送函数（独立出来避免循环依赖）
  const sendOpeningScene = useCallback(async () => {
    if (isStreaming || hasStartedRef.current) return
    hasStartedRef.current = true

    // 检查是否有预设的第一回合剧情（玩家编辑的）
    const customOpening = scenario.initial_state?.gamePhase === '开场' ||
      scenario.system_prompt?.includes('第一回合剧情')

    // 如果场景有预设开场剧情，直接从system_prompt解析并显示
    if (customOpening && scenario.system_prompt) {
      // 尝试提取玩家编辑的"第一回合剧情"内容
      const openingMatch = scenario.system_prompt.match(/第一回合剧情[:：]([\s\S]*?)(?=初始行动选项|$)/)
      const optionsMatch = scenario.system_prompt.match(/初始行动选项[:：]([\s\S]*?)(?=\n\n|$)/)

      if (openingMatch) {
        const openingText = openingMatch[1].trim()
        const optionsText = optionsMatch ? optionsMatch[1].trim() : ''

        // 解析选项（按行分割，支持 1. 2. 3. 或 - 或 * 格式）
        const options = optionsText
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && (line.match(/^\d+\./) || line.match(/^[-*]\s/) || line.length > 5))
          .map(line => line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, ''))
          .filter(line => line)

        // 构建AI消息，显示玩家预设的剧情
        const aiMsg: ConversationMessage = {
          role: 'assistant',
          content: openingText,
          timestamp: new Date().toISOString(),
        }

        const finalHistory: ConversationMessage[] = [aiMsg]
        const newTurnCount = 1
        const newState = { ...state, turn: 1, gamePhase: '进行中' }

        setMessages(finalHistory)
        setState(newState)
        setTurnCount(newTurnCount)
        setQuickOptions(options.length > 0 ? options : ['探索周围', '原地休息', '整理物品', '查看状态'])
        setAtmosphereHint('normal')

        // 自动保存
        if (!isSandbox) {
          await autoSave(finalHistory, newState, newTurnCount, saveId)
        }
        return
      }
    }

    // 如果没有预设开场，调用AI生成
    const openingMsg: ConversationMessage = {
      role: 'user',
      content: '【开场剧情】请根据当前场景的系统提示，输出完整的开场剧情，包括：环境描写、主角状态、当前处境、行动选项。',
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, openingMsg])
    setIsStreaming(true)
    setStreamingText('')

    try {
      const openingHistory = [...messages, openingMsg]
      const res = await apiFetch('/api/game/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: openingMsg.content,
          scenario,
          state,
          history: openingHistory,
          saveId: isSandbox ? undefined : saveId,
          isSandbox,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'API error')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter((l) => l.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                fullText += parsed.content
                setStreamingText(fullText)
              }
            } catch {
              // ignore
            }
          }
        }
      }

      const aiResponse = parseAIResponse(fullText)
      const newState = applyStateChanges(state, aiResponse.stateChanges)

      const aiMsg: ConversationMessage = {
        role: 'assistant',
        content: aiResponse.narration || fullText,
        timestamp: new Date().toISOString(),
      }

      const finalHistory = [...messages, openingMsg, aiMsg]
      const newTurnCount = turnCount + 1

      setMessages(finalHistory)
      setState(newState)
      setTurnCount(newTurnCount)
      setQuickOptions(aiResponse.options || [])
      setAtmosphereHint(aiResponse.atmosphereHint || 'normal')
      setStreamingText('')

      // 自动保存
      if (!isSandbox) {
        await autoSave(finalHistory, newState, newTurnCount, saveId)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      toast.error('开场剧情加载失败', { description: msg })
      hasStartedRef.current = false // 重置以便重试
    } finally {
      setIsStreaming(false)
    }
  }, [isStreaming, messages, state, turnCount, saveId, scenario, isSandbox])

  // 第一回合自动触发开场
  useEffect(() => {
    if (turnCount === 0 && messages.length === 0) {
      const timer = setTimeout(() => {
        sendOpeningScene()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [turnCount, messages.length, sendOpeningScene])

  const sendMessage = useCallback(async (userInput: string) => {
    if (isStreaming) return

    const userMsg: ConversationMessage = {
      role: 'user',
      content: userInput,
      timestamp: new Date().toISOString(),
    }

    const updatedHistory = [...messages, userMsg]
    setMessages(updatedHistory)
    setIsStreaming(true)
    setStreamingText('')

    try {
      const res = await apiFetch('/api/game/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput,
          scenario,
          state,
          history: updatedHistory,
          saveId: isSandbox ? undefined : saveId,
          isSandbox,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'API error')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter((l) => l.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                fullText += parsed.content
                setStreamingText(fullText)
              }
            } catch {
              // ignore
            }
          }
        }
      }

      // 解析 AI 响应
      const aiResponse = parseAIResponse(fullText)
      const newState = applyStateChanges(state, aiResponse.stateChanges)

      const aiMsg: ConversationMessage = {
        role: 'assistant',
        content: aiResponse.narration || fullText,
        timestamp: new Date().toISOString(),
      }

      const finalHistory = [...updatedHistory, aiMsg]
      const newTurnCount = turnCount + 1

      setMessages(finalHistory)
      setState(newState)
      setTurnCount(newTurnCount)
      setQuickOptions(aiResponse.options || [])
      setAtmosphereHint(aiResponse.atmosphereHint || 'normal')
      setStreamingText('')

      // 自动保存
      if (!isSandbox) {
        await autoSave(finalHistory, newState, newTurnCount, saveId)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      toast.error('AI 响应失败', { description: msg })
      setMessages(messages) // 回滚
    } finally {
      setIsStreaming(false)
    }
  }, [isStreaming, messages, state, turnCount, saveId, scenario, isSandbox])

  async function autoSave(
    history: ConversationMessage[],
    newState: GameState,
    newTurnCount: number,
    currentSaveId: string
  ) {
    try {
      const res = await apiFetch('/api/game/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveId: currentSaveId,
          state: newState,
          history,
          turnCount: newTurnCount,
        }),
      })
      const data = await res.json()
      if (data.save?.id && data.save.id !== saveId) {
        setSaveId(data.save.id)
      }
    } catch {
      // 静默失败，不打扰玩家
    }
  }

  async function handleManualSave() {
    setSaving(true)
    try {
      const res = await apiFetch('/api/game/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveId,
          state,
          history: messages,
          turnCount,
        }),
      })
      if (res.ok) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2000)
      } else {
        toast.error('保存失败')
      }
    } catch {
      toast.error('保存失败')
    }
    setSaving(false)
  }

  return (
    <div
        className="h-screen flex flex-col relative overflow-hidden"
        style={{ ...currentTheme.css, backgroundColor: 'var(--bg-primary)', fontFamily: selectedFont.cssVar } as React.CSSProperties}>
      {/* 氛围边缘辉光 */}
      <div
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-700"
        style={{
          boxShadow: `inset 0 0 120px 40px ${glow.glow}, inset 0 0 300px 80px ${glow.glow}`,
        }}
      />

      {/* 氛围顶部渐变横幅 */}
      <div
        className={cn(
          'pointer-events-none absolute top-0 left-0 right-0 h-32 z-0 bg-gradient-to-b transition-opacity duration-700',
          glow.banner
        )}
      />

      {/* 自定义背景图片 */}
      {bgImageUrl && (
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            backgroundImage: `url(${bgImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: bgOpacity,
          }}
        />
      )}

      {/* 自适应暗色叠加层 — 根据图片亮度自动调节，图片始终清晰，暗层保护文字可读 */}
      {bgImageUrl && (
        <div
          className="pointer-events-none absolute inset-0 z-[2] transition-opacity duration-500"
          style={{
            background: 'rgb(0,0,0)',
            opacity: 0.05 + bgBrightness * 0.20, // 亮图 → 稍微加深但不压死图片
          }}
        />
      )}

      {/* 主题纹理叠加 */}
      <div
        className="pointer-events-none absolute inset-0 z-[3]"
        style={{
          background: 'var(--texture, none)',
          opacity: 'var(--texture-opacity, 0.5)',
        }}
      />

      {/* 顶栏 */}
      <div className="relative z-10 flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-secondary)]/80 backdrop-blur-sm flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/game')}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] h-8 px-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回
        </Button>

        {/* 氛围指示器 */}
        <div className="hidden sm:flex items-center gap-1.5">
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full transition-colors duration-500',
              atmosphere === 'danger' && 'bg-red-400 shadow-[0_0_6px_rgba(220,38,38,0.6)]',
              atmosphere === 'mystery' && 'bg-purple-400 shadow-[0_0_6px_rgba(147,51,234,0.6)]',
              atmosphere === 'triumph' && 'bg-amber-400 shadow-[0_0_6px_rgba(217,119,6,0.6)]',
              atmosphere === 'normal' && 'bg-zinc-500'
            )}
          />
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            {atmosphere === 'danger' && '危险'}
            {atmosphere === 'mystery' && '神秘'}
            {atmosphere === 'triumph' && '凯旋'}
            {atmosphere === 'normal' && '平静'}
          </span>
        </div>

        <div className="flex-1" />

        {/* 背景图片设置 */}
        <Dialog open={showBgDialog} onOpenChange={setShowBgDialog}>
          <DialogTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 px-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors',
                  bgImageUrl && 'text-[var(--accent)]'
                )}
              >
                <ImageIcon className="w-3.5 h-3.5 mr-1" />
                聊天背景
              </Button>
            }
          />
          <DialogContent className="bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-primary)] max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                聊天背景
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto">

              {/* 本地上传 */}
              <div className="relative">
                <input
                  id="bg-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error('图片太大了', { description: '请选择 5MB 以下的图片' })
                      return
                    }
                    const reader = new FileReader()
                    reader.onload = (ev) => {
                      const dataUrl = ev.target?.result as string
                      setBgInputUrl(dataUrl)
                    }
                    reader.readAsDataURL(file)
                  }}
                />
                <label
                  htmlFor="bg-upload"
                  className="flex items-center justify-center gap-2 w-full py-5 rounded-lg border-2 border-dashed border-[var(--border)]
                    hover:border-[var(--accent)]/40 hover:bg-[var(--accent-soft)] cursor-pointer transition-all duration-200
                    text-[var(--text-muted)] hover:text-[var(--accent)]"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-xs">上传背景图片</span>
                </label>
              </div>

              {/* URL 输入 */}
              <Input
                value={bgInputUrl}
                onChange={(e) => setBgInputUrl(e.target.value)}
                placeholder="或输入图片 URL..."
                className="bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)]"
              />

              {/* 预览 */}
              {(bgImageUrl || bgInputUrl) && (
                <div className="relative rounded-lg overflow-hidden border border-[var(--border)] h-20 group">
                  <img
                    src={bgInputUrl || bgImageUrl}
                    alt="背景预览"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </div>
              )}

              {/* 图片浓度（透明度） */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">图片浓度</span>
                <input
                  type="range"
                  min="5"
                  max="70"
                  value={Math.round(bgOpacity * 100)}
                  onChange={(e) => setBgOpacity(Number(e.target.value) / 100)}
                  className="flex-1 h-1.5 bg-[var(--border)] rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500"
                />
                <span className="text-xs text-[var(--text-muted)] w-8 text-right">{Math.round(bgOpacity * 100)}%</span>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <Button
                  onClick={handleBgImageClear}
                  variant="outline"
                  size="sm"
                  className="border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  清除
                </Button>
                <Button
                  onClick={handleBgImageSave}
                  size="sm"
                  disabled={!bgInputUrl.trim()}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-40"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  应用背景
                </Button>
            </div>
            </div>
          </DialogContent>
        </Dialog>

        {!isSandbox && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualSave}
            disabled={saving}
            className={cn(
              'h-8 px-3 text-xs transition-colors',
              saveSuccess ? 'text-emerald-400' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            )}
          >
            {saveSuccess
              ? <><CheckCircle className="w-3.5 h-3.5 mr-1" />已保存</>
              : <><Save className="w-3.5 h-3.5 mr-1" />保存</>
            }
          </Button>
        )}
        {isSandbox && (
          <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
            沙盒模式
          </span>
        )}
      </div>

      {/* 移动端状态栏 */}
      <div className="lg:hidden flex-shrink-0 relative z-10">
        <StatusBar state={state} scenarioTitle={scenario.title} />
      </div>

      {/* 主区域 */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* 对话区 */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <ChatArea
            messages={messages}
            streamingText={streamingText}
            isStreaming={isStreaming}
            atmosphereHint={atmosphere}
            hasBgImage={!!bgImageUrl}
          />
          <InputArea
            onSubmit={sendMessage}
            isLoading={isStreaming}
            quickOptions={quickOptions}
          />
        </div>

        {/* PC 端侧边栏 */}
        <div className="hidden lg:block">
          <SidePanel state={state} turnCount={turnCount} hasBgImage={!!bgImageUrl} />
        </div>
      </div>
    </div>
  )
}
