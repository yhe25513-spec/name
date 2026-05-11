'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { GameSave, GameScenario } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiFetch } from '@/lib/api-client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Sword, Clock, PlayCircle, PlusCircle, Settings, LogOut, User, Trash2, Search, Sparkles, Edit3, ScrollText, Gamepad2, ChevronRight, Loader2, Wand2, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { THEMES, getTheme, FONTS, buildCustomThemeCss } from '@/lib/themes'
import type { CustomThemeColors } from '@/lib/themes'

interface ScenarioSelectorProps {
  saves: GameSave[]
  scenarios: Partial<GameScenario>[]
  username: string
  isAdmin: boolean
  userId?: string
}

// 类型检测（从标题/描述中提取关键词）
function detectGenre(title = '', description = ''): string {
  const text = title + description
  if (/修仙|修真|筑基|金丹|元婴|炼气|修士|灵根|功法|渡劫/.test(text)) return '修仙修真'
  if (/末[日世]|废土|丧尸|辐射|生存|避难所/.test(text)) return '末日生存'
  if (/悬疑|解谜|侦探|推理|调查|线索|真相|阴谋/.test(text)) return '悬疑解谜'
  if (/科幻|星[际球]|飞船|机甲|未来|机械|赛博|AI|人工智能/.test(text)) return '科幻未来'
  if (/武侠|江湖|武林|门派|宗师|内功|剑法/.test(text)) return '武侠江湖'
  if (/都市|异能|现代|校园|超能/.test(text)) return '都市异能'
  if (/言情|恋爱|甜宠|虐恋|爱情/.test(text)) return '言情恋爱'
  if (/奇幻|魔法|精灵|矮人|龙|剑与魔法|冒险者/.test(text)) return '奇幻冒险'
  return '其他'
}

const GENRE_COLORS: Record<string, { bg: string; border: string; text: string; gradient: string; icon: string; glow: string }> = {
  '修仙修真': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', gradient: 'from-emerald-600/20 to-teal-600/10', icon: '☯', glow: 'shadow-emerald-500/10 group-hover:shadow-emerald-500/25' },
  '末日生存': { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', gradient: 'from-orange-600/20 to-red-600/10', icon: '⚠', glow: 'shadow-orange-500/10 group-hover:shadow-orange-500/25' },
  '悬疑解谜': { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', gradient: 'from-purple-600/20 to-indigo-600/10', icon: '🔍', glow: 'shadow-purple-500/10 group-hover:shadow-purple-500/25' },
  '科幻未来': { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', gradient: 'from-cyan-600/20 to-blue-600/10', icon: '🚀', glow: 'shadow-cyan-500/10 group-hover:shadow-cyan-500/25' },
  '武侠江湖': { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', gradient: 'from-red-600/20 to-rose-600/10', icon: '⚔', glow: 'shadow-red-500/10 group-hover:shadow-red-500/25' },
  '都市异能': { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', gradient: 'from-blue-600/20 to-violet-600/10', icon: '🌆', glow: 'shadow-blue-500/10 group-hover:shadow-blue-500/25' },
  '言情恋爱': { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400', gradient: 'from-pink-600/20 to-rose-600/10', icon: '💕', glow: 'shadow-pink-500/10 group-hover:shadow-pink-500/25' },
  '奇幻冒险': { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', gradient: 'from-amber-600/20 to-yellow-600/10', icon: '🗡', glow: 'shadow-amber-500/10 group-hover:shadow-amber-500/25' },
  '其他': { bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', text: 'text-zinc-400', gradient: 'from-zinc-600/20 to-zinc-600/10', icon: '🎲', glow: 'shadow-zinc-500/10 group-hover:shadow-zinc-500/25' },
}

export function ScenarioSelector({ saves, scenarios, username, isAdmin, userId }: ScenarioSelectorProps) {
  const router = useRouter()
  const supabase = createClient()
  const [creating, setCreating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [localSaves, setLocalSaves] = useState<GameSave[]>(saves)
  const [searchQuery, setSearchQuery] = useState('')
  const [genreFilter, setGenreFilter] = useState('全部')
  const [previewScenario, setPreviewScenario] = useState<Partial<GameScenario> | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [aiStep, setAiStep] = useState<'choose' | 'prompt' | 'generating'>('choose')
  const [aiPrompt, setAiPrompt] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [themeId, setThemeId] = useState('linear')
  const [fontId, setFontId] = useState('serif')
  const [customThemeColors, setCustomThemeColors] = useState<CustomThemeColors>({
    bgShade: 'dark', accentColor: 'amber',
  })

  // 同步 props 变化
  useEffect(() => { setLocalSaves(saves) }, [saves])

  // 从 localStorage 加载主题/字体
  useEffect(() => {
    const savedTheme = localStorage.getItem('game-theme')
    if (savedTheme) setThemeId(savedTheme)
    const savedFont = localStorage.getItem('game-font')
    if (savedFont) setFontId(savedFont)
    const savedCustom = localStorage.getItem('game-custom-theme')
    if (savedCustom) {
      try { setCustomThemeColors(JSON.parse(savedCustom)) } catch { /* ignore */ }
    }
  }, [])

  // 主题持久化
  useEffect(() => {
    localStorage.setItem('game-theme', themeId)
    window.dispatchEvent(new Event('theme-change'))
  }, [themeId])
  useEffect(() => {
    localStorage.setItem('game-font', fontId)
    window.dispatchEvent(new Event('theme-change'))
  }, [fontId])
  useEffect(() => {
    localStorage.setItem('game-custom-theme', JSON.stringify(customThemeColors))
    window.dispatchEvent(new Event('theme-change'))
  }, [customThemeColors])

  // 分析图片亮度，智能选择文字颜色
  const [imageBrightness, setImageBrightness] = useState<Record<string, number>>({})

  useEffect(() => {
    const brightMap: Record<string, number> = {}
    let pending = 0
    scenarios.forEach(s => {
      if (!s.background_image_url || !s.id) return
      if (brightMap[s.id] !== undefined) return
      pending++
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
            total += (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
          }
          brightMap[s.id!] = Math.round((total / (data.length / 4) / 255) * 100) / 100
        } catch { brightMap[s.id!] = 0.5 }
        if (--pending === 0) setImageBrightness({ ...brightMap })
      }
      img.onerror = () => {
        brightMap[s.id!] = 0.5
        if (--pending === 0) setImageBrightness({ ...brightMap })
      }
      img.src = s.background_image_url
    })
    if (pending === 0 && Object.keys(brightMap).length > 0) {
      setImageBrightness(prev => ({ ...prev, ...brightMap }))
    }
  }, [scenarios])

  // 场景分类
  const { categorized, genreCounts } = useMemo(() => {
    const enriched = scenarios.map(s => ({
      ...s,
      _genre: detectGenre(s.title, s.description),
    }))

    const counts: Record<string, number> = { '全部': enriched.length }
    enriched.forEach(s => {
      counts[s._genre] = (counts[s._genre] || 0) + 1
    })

    const filtered = genreFilter === '全部'
      ? enriched
      : enriched.filter(s => s._genre === genreFilter)

    const searched = searchQuery.trim()
      ? filtered.filter(s =>
          (s.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.description || '').toLowerCase().includes(searchQuery.toLowerCase())
        )
      : filtered

    return { categorized: searched, genreCounts: counts }
  }, [scenarios, genreFilter, searchQuery])

  async function startNewGame(scenario: Partial<GameScenario>) {
    if (!scenario.id) {
      toast.error('场景数据异常，无法开始游戏')
      return
    }
    setCreating(scenario.id)
    try {
      const res = await apiFetch('/api/game/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: scenario.id,
          state: scenario.initial_state,
          history: [],
          turnCount: 0,
        }),
      })
      const data = await res.json()
      if (data.save?.id) {
        router.push(`/game/${data.save.id}`)
      } else {
        toast.error('创建游戏失败', { description: data.error })
      }
    } catch {
      toast.error('网络错误')
    }
    setCreating(null)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function deleteSave(saveId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('确定删除这个存档？此操作不可恢复。')) return

    setDeleting(saveId)
    try {
      const res = await apiFetch(`/api/game/save?id=${saveId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('存档已删除')
        setLocalSaves(prev => prev.filter(s => s.id !== saveId))
      } else {
        toast.error('删除失败')
      }
    } catch {
      toast.error('网络错误')
    }
    setDeleting(null)
  }

  function formatTime(ts: string) {
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins} 分钟前`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} 小时前`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays} 天前`
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  async function handleAIGenerate() {
    if (!aiPrompt.trim()) {
      toast.error('请输入场景创意描述')
      return
    }
    setAiStep('generating')
    try {
      const res = await apiFetch('/api/admin/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `请为一个文字冒险游戏创建完整的场景设定。

用户的创意描述：${aiPrompt.trim()}

请严格按照以下纯 JSON 格式返回（只返回 JSON，不要用任何 markdown 代码块或额外文字包裹）：

{
  "title": "场景标题（简洁吸引人，体现核心主题）",
  "description": "一句话简介（20字以内）",
  "worldSetting": "世界观设定（200字左右）",
  "gameRules": "核心规则（条目式）",
  "protagonist": "主角设定（身份、背景、性格）",
  "storyPlot": "故事主线",
  "atmosphere": "风格氛围描述",
  "firstScene": "第一回合开场剧情（用第二人称"你"，200字左右）",
  "playerOptions": "初始行动选项（每行一个，用数字编号，3-4个选项）"
}`,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.content) {
        toast.error('AI 生成失败', { description: data.error || '请先配置 AI 服务' })
        setAiStep('prompt')
        return
      }

      // 解析 JSON（兼容 AI 用 markdown 包裹的情况）
      let raw = data.content.trim()
      const match = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/)
      if (match) raw = match[1].trim()
      const scenarioData = JSON.parse(raw)

      if (!scenarioData.title) {
        toast.error('AI 生成的内容不完整，请重试')
        setAiStep('prompt')
        return
      }

      // 构造 system prompt（与 SimpleScenarioEditor 中一致）
      const systemPrompt = `你是文字冒险游戏《${scenarioData.title}》的GM。

【世界观】
${scenarioData.worldSetting || '（待补充）'}

【核心规则】
${scenarioData.gameRules || '（待补充）'}

【主角设定】
${scenarioData.protagonist || '（待补充）'}

【剧情走向】
${scenarioData.storyPlot || '（待补充）'}

【叙事风格】
${scenarioData.atmosphere || '（待补充）'}

第一回合剧情：
${scenarioData.firstScene || '描写主角醒来/出现时的场景、状态、环境'}

初始行动选项：
${scenarioData.playerOptions || '1. 探索周围\n2. 检查物品\n3. 寻找线索'}

【回合推进】
每回合结束时显示：【第X回合 | 当前位置：XXX】
根据玩家输入推进剧情，保持风格一致。`

      const createRes = await apiFetch('/api/admin/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: scenarioData.title,
          description: scenarioData.description || '',
          system_prompt: systemPrompt,
          initial_state: {
            hp: 100,
            maxHp: 100,
            attributes: { '力量': 10, '敏捷': 10, '智慧': 10 },
            inventory: [],
            flags: {},
            location: '起点',
          },
        }),
      })

      if (createRes.ok) {
        toast.success('场景已通过 AI 智能生成！')
        setShowCreateDialog(false)
        router.push('/admin')
        router.refresh()
      } else {
        const err = await createRes.json()
        toast.error('创建场景失败', { description: err.error })
        setAiStep('prompt')
      }
    } catch (err) {
      toast.error('AI 生成失败', { description: '请检查 AI 配置是否正确或重试' })
      setAiStep('prompt')
    }
  }

  function getGenre(name: string) {
    return GENRE_COLORS[name] || GENRE_COLORS['其他']
  }

  // 用户自己创建的场景
  const myScenarios = useMemo(() => {
    if (!userId) return []
    return scenarios.filter(s => (s as any).created_by === userId)
  }, [scenarios, userId])

  // 所有可用流派
  const allGenres = ['全部', ...Object.keys(GENRE_COLORS).filter(g => (genreCounts[g] || 0) > 0)]

  // 动态主题（自定义主题不在场景选择器预览，使用 fallback）
  const currentPageTheme = getTheme(themeId)

  return (
    <div className="min-h-screen flex flex-col" style={{
      ...currentPageTheme.css,
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
    } as React.CSSProperties}>
      {/* 纯色背景——Linear 风格无纹理 */}
      <div className="fixed inset-0 pointer-events-none bg-[#010102]" />

      {/* 顶部导航 */}
      <header className="relative border-b border-[var(--border)] bg-[var(--bg-secondary)]/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mr-1"
            title="返回首页"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">首页</span>
          </button>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
              <Sword className="w-4 h-4 m-auto" style={{ color: 'var(--accent)' }} />
            </div>
            <span className="font-medium text-[var(--text-primary)] hidden sm:inline tracking-tight">文字冒险</span>
          </div>

          {/* 搜索 */}
          <div className="flex-1 max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索场景..."
                className="w-full pl-9 h-9 bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] rounded-lg focus:border-[var(--accent)]/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-all"
              title="外观设置"
            >
              <Settings className="w-4 h-4" />
            </button>
            <Button
              onClick={() => router.push('/admin')}
              variant="outline"
              size="sm"
              className="border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/50 hidden sm:inline-flex"
            >
              <Edit3 className="w-4 h-4 mr-1.5" />
              {isAdmin ? '管理' : '创作'}
            </Button>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <LogOut className="w-4 h-4" />
            </Button>
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-[var(--text-muted)] ml-1 pl-3 border-l border-[var(--border)]">
              <User className="w-3.5 h-3.5" />
              <span className="truncate max-w-[100px]">{username}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-16 space-y-6 sm:space-y-8 relative z-10">
        {/* 快捷操作 */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setShowCreateDialog(true)}
            className={cn(
              'group relative overflow-hidden px-5 py-2.5 rounded-md text-sm font-medium text-white transition-all duration-200 hover:shadow-lg',
              localSaves.length === 0 && 'animate-[pulse-glow_2s_ease-in-out_infinite]'
            )}
            style={{
              backgroundColor: 'var(--accent)',
            }}
          >
            <span className="relative z-10 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              创建新场景
            </span>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1), transparent)',
            }} />
          </button>
          <button
            onClick={() => router.push('/admin')}
            className="px-4 py-2.5 rounded-lg text-sm text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/50 transition-all sm:hidden"
          >
            <Edit3 className="w-4 h-4 mr-1.5 inline" />
            {isAdmin ? '管理后台' : '我的创作'}
          </button>
        </div>

        {/* 继续游戏 */}
        {localSaves.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
                <Clock className="w-3 h-3" style={{ color: 'var(--accent)' }} />
              </div>
              <h2 className="text-base font-medium text-[var(--text-primary)] tracking-tight">继续游戏</h2>
              <span className="text-xs text-[var(--text-muted)] ml-auto">{localSaves.length} 个存档</span>
            </div>
            <div className="grid gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {localSaves.map((save) => {
                const scenarioTitle = (save.scenario as unknown as { title: string })?.title || '未知场景'
                const genre = detectGenre(scenarioTitle, '')
                const gc = getGenre(genre)
                const hp = (save.current_state as { hp?: number; maxHp?: number })
                const hpPercent = hp?.maxHp ? Math.round(((hp.hp || 0) / hp.maxHp) * 100) : 0
                const hpColor = hpPercent > 60 ? 'bg-emerald-500' : hpPercent > 30 ? 'bg-amber-500' : 'bg-red-500'
                const isLowHp = hpPercent <= 30

                // 获取场景背景图（复用已有的亮度分析）
                const scenarioData = scenarios.find(s => s.id === save.scenario_id)
                const bgImg = scenarioData?.background_image_url
                const bri = bgImg && scenarioData?.id ? imageBrightness[scenarioData.id] : undefined
                const isLight = bri !== undefined && bri > 0.55
                const hasImg = !!bgImg
                const imgT = isLight ? 'text-zinc-900' : 'text-white'
                const imgTsec = isLight ? 'text-zinc-700' : 'text-zinc-200'
                const imgTmuted = isLight ? 'text-zinc-500' : 'text-zinc-400'

                return (
                  <Card
                    key={save.id}
                    onClick={() => router.push(`/game/${save.id}`)}
                    className={cn(
                      'relative border-[var(--border)] cursor-pointer transition-all duration-200 group overflow-hidden',
                      'hover:border-[var(--accent)]/30 hover:shadow-xl hover:-translate-y-0.5',
                      gc.glow,
                      !hasImg && 'bg-[var(--bg-secondary)]'
                    )}
                    style={hasImg ? {
                      backgroundImage: `url(${bgImg})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    } : {}}
                  >
                    {/* 背景图片叠加层 */}
                    {hasImg && (
                      <div className={cn(
                        'absolute inset-0',
                        isLight ? 'bg-white/50' : 'bg-gradient-to-b from-black/50 via-black/40 to-black/75'
                      )} />
                    )}
                    {/* 无背景图时的渐变占位 */}
                    {!hasImg && (
                      <>
                        <div className={`absolute inset-0 bg-gradient-to-br ${gc.gradient} opacity-[0.07]`} />
                        <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${gc.gradient}`} />
                        <div className="absolute -bottom-3 -right-3 text-6xl opacity-[0.04] pointer-events-none select-none">
                          {gc.icon}
                        </div>
                      </>
                    )}
                    <button
                      onClick={(e) => deleteSave(save.id, e)}
                      disabled={deleting === save.id}
                      className="absolute top-3 right-3 p-2 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors z-10 sm:opacity-0 sm:group-hover:opacity-100 active:scale-90"
                      title="删除存档"
                      style={hasImg ? { color: isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)' } : {}}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <CardHeader className="pb-2 pt-4 px-4 pr-10 relative z-10">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${gc.bg} ${gc.text} ${gc.border} border`}>
                          {genre}
                        </span>
                      </div>
                      <CardTitle className={cn(
                        'text-sm font-semibold group-hover:text-[var(--accent)] transition-colors truncate pr-2',
                        hasImg ? '' : 'text-[var(--text-primary)]'
                      )}
                        style={hasImg ? { color: imgT } : {}}>
                        {scenarioTitle}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1 text-xs mt-1"
                        style={hasImg ? { color: imgTmuted } : { color: 'var(--text-muted)' }}>
                        <Clock className="w-3 h-3 inline" />
                        <span className={cn(
                          save.updated_at && Date.now() - new Date(save.updated_at).getTime() < 3600000
                            ? (hasImg ? '' : 'text-[var(--text-primary)]')
                            : ''
                        )}
                          style={hasImg && save.updated_at && Date.now() - new Date(save.updated_at).getTime() < 3600000
                            ? { color: isLight ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)' }
                            : {}
                          }>
                          {formatTime(save.updated_at)}
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 relative z-10">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-xs"
                          style={hasImg ? {
                            borderColor: isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)',
                            color: imgTsec,
                            backgroundColor: isLight ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)',
                          } : {
                            borderColor: 'var(--border)',
                            color: 'var(--text-secondary)',
                          }}>
                          第 {save.turn_count} 回合
                        </Badge>
                      </div>
                      {/* HP 条 */}
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs w-6 font-medium', isLowHp && 'text-red-400')}
                          style={!isLowHp && hasImg ? { color: imgTmuted } : !isLowHp && !hasImg ? { color: 'var(--text-muted)' } : {}}>
                          {isLowHp ? '⚠' : 'HP'}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                          style={{ backgroundColor: hasImg ? 'rgba(0,0,0,0.3)' : 'var(--bg-primary)' }}>
                          <div
                            className={cn('h-full rounded-full transition-all duration-300', hpColor, isLowHp && 'animate-pulse')}
                            style={{
                              width: `${hpPercent}%`,
                              ...(isLowHp ? { boxShadow: '0 0 6px rgba(239,68,68,0.6)' } : {}),
                            }}
                          />
                        </div>
                        <span className={cn('text-xs w-10 text-right font-medium', isLowHp && 'text-red-400')}
                          style={!isLowHp && hasImg ? { color: imgTsec } : !isLowHp && !hasImg ? { color: 'var(--text-muted)' } : {}}>
                          {hp.hp || 0}/{hp.maxHp || 100}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>
        )}

        {/* 探索新世界 */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
              <Gamepad2 className="w-3 h-3" style={{ color: 'var(--accent)' }} />
            </div>
            <h2 className="text-base font-medium text-[var(--text-primary)] tracking-tight">
              {localSaves.length > 0 ? '探索新世界' : '开始冒险'}
            </h2>
          </div>

          {/* 流派筛选 */}
          <div className="flex gap-1.5 sm:gap-2 mb-4 overflow-x-auto pb-2 scrollbar-thin -mx-3 sm:mx-0 px-3 sm:px-0">
            {allGenres.map((genre) => (
              <button
                key={genre}
                onClick={() => setGenreFilter(genre)}
                className={`flex-shrink-0 px-3 py-2 sm:py-1.5 rounded-full text-xs font-medium transition-all ${
                  genreFilter === genre
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/40'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'
                }`}
              >
                {genre}
                <span className="ml-1.5 text-[10px] opacity-60">{genreCounts[genre] || 0}</span>
              </button>
            ))}
          </div>

          {/* 场景卡片网格 */}
          {categorized.length === 0 ? (
            <div className="text-center py-20 text-[var(--text-muted)]">
              <div className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
                <ScrollText className="w-10 h-10" style={{ color: 'var(--accent)' }} />
              </div>
              {searchQuery ? (
                <>
                  <p className="text-lg font-medium text-[var(--text-primary)]">没有找到匹配的场景</p>
                  <p className="text-sm mt-1.5 mb-4">换个关键词试试？</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium text-[var(--text-primary)]">还没有场景</p>
                  <p className="text-sm mt-1 mb-6">创建你的第一个文字冒险世界吧</p>
                  <div className="flex flex-col items-center gap-2 mb-8">
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>1</span>
                      点击上方「创建新场景」
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>2</span>
                      填写世界观和剧情设定
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>3</span>
                      发布后即可开始冒险
                    </div>
                  </div>
                  <Button
                    onClick={() => router.push('/admin')}
                    className="text-white border-0" style={{ backgroundColor: 'var(--accent)' }}
                  >
                    <PlusCircle className="w-4 h-4 mr-1.5" />
                    从零开始创作
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-2 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categorized.map((scenario, index) => {
                const genre = (scenario as any)._genre || '其他'
                const gc = getGenre(genre)
                const state = scenario.initial_state as { hp?: number; maxHp?: number } | undefined
                // 图片亮度分析 → 智能选色
                const bri = scenario.id && scenario.background_image_url ? imageBrightness[scenario.id] : undefined
                const isLight = bri !== undefined && bri > 0.55
                const hasImg = !!scenario.background_image_url
                const imgT = isLight ? 'text-zinc-900' : 'text-white'
                const imgTsec = isLight ? 'text-zinc-700' : 'text-zinc-200'
                const imgTmuted = isLight ? 'text-zinc-500' : 'text-zinc-400'

                return (
                  <Card
                    key={scenario.id}
                    className={cn(
                      'group relative border-[var(--border)] transition-all duration-300 flex flex-col overflow-hidden',
                      'hover:border-[var(--accent)]/30 hover:shadow-xl hover:-translate-y-1',
                      gc.glow,
                      !hasImg && 'bg-[var(--bg-secondary)]'
                    )}
                    style={{
                      animation: `fadeSlideIn 0.4s ease-out ${index * 0.05}s both`,
                      ...(hasImg ? {
                        backgroundImage: `url(${scenario.background_image_url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      } : {}),
                    }}
                  >
                    {/* 智能叠加层：保证文字可读的同时让图片清晰可见 */}
                    {hasImg && (
                      <div className={cn(
                        'absolute inset-0',
                        isLight ? 'bg-white/50' : 'bg-gradient-to-b from-black/50 via-black/40 to-black/75'
                      )} />
                    )}

                    {/* 无背景图时显示渐变占位 */}
                    {!hasImg && (
                      <>
                        <div className={`absolute inset-0 bg-gradient-to-br ${gc.gradient} opacity-[0.07]`} />
                        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gc.gradient}`} />
                        <div className="absolute -bottom-3 -right-3 text-7xl opacity-[0.03] pointer-events-none select-none group-hover:opacity-[0.06] transition-opacity duration-500">
                          {gc.icon}
                        </div>
                      </>
                    )}

                    <div className="relative z-10 flex flex-col flex-1">
                      <CardHeader className="pb-2 pt-5 px-4">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className={cn(
                            'text-xs font-semibold tracking-wider',
                            hasImg ? (
                              isLight
                                ? 'px-2.5 py-1 rounded-full bg-white/80 text-zinc-700 border border-zinc-300'
                                : 'px-2.5 py-1 rounded-full bg-black/40 text-white/90 border border-white/15 backdrop-blur-sm'
                            ) : gc.text
                          )}>
                            {genre}
                          </span>
                        </div>
                        <CardTitle className={cn(
                          'text-lg font-bold leading-snug line-clamp-2 transition-colors duration-200',
                          hasImg ? imgT : 'text-[var(--text-primary)]',
                          hasImg ? '' : 'group-hover:text-[var(--accent)]'
                        )}>
                          {scenario.title}
                        </CardTitle>
                        {scenario.description && (
                          <p className={cn(
                            'text-sm font-medium leading-relaxed line-clamp-2 mt-1.5',
                            hasImg ? imgTsec : 'text-[var(--text-secondary)]'
                          )}>
                            {scenario.description}
                          </p>
                        )}
                      </CardHeader>

                      <CardContent className="mt-auto pt-0 px-4 pb-4">
                        <div className="flex items-center justify-between mb-3">
                          {state && (
                            <span className={cn(
                              'text-xs font-medium',
                              hasImg ? imgTmuted : 'text-[var(--text-muted)]'
                            )}>
                              HP {state.hp || 100}/{state.maxHp || 100}
                            </span>
                          )}
                        </div>
                        <Button
                          onClick={() => startNewGame(scenario)}
                          disabled={creating === scenario.id}
                          className={cn(
                            'w-full text-white border-0 transition-all duration-200 font-semibold',
                            'hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]',
                            genre === '修仙修真' ? 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-500/25' :
                            genre === '末日生存' ? 'bg-orange-600 hover:bg-orange-500 hover:shadow-orange-500/25' :
                            genre === '悬疑解谜' ? 'bg-purple-600 hover:bg-purple-500 hover:shadow-purple-500/25' :
                            genre === '科幻未来' ? 'bg-cyan-600 hover:bg-cyan-500 hover:shadow-cyan-500/25' :
                            genre === '武侠江湖' ? 'bg-red-600 hover:bg-red-500 hover:shadow-red-500/25' :
                            genre === '都市异能' ? 'bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/25' :
                            genre === '奇幻冒险' ? 'bg-amber-600 hover:bg-amber-500 hover:shadow-amber-500/25' :
                            'bg-zinc-600 hover:bg-zinc-500 hover:shadow-zinc-500/25'
                          )}
                        >
                          {creating === scenario.id ? (
                            <span className="flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                              创建中...
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <PlayCircle className="w-4 h-4" />
                              开始冒险
                              <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-50 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                          )}
                        </Button>
                      </CardContent>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        {/* 我的创作 */}
        {myScenarios.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Edit3 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">我的创作</h2>
              <span className="text-xs text-[var(--text-muted)] ml-auto">{myScenarios.length} 个场景</span>
            </div>
            <div className="grid gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {myScenarios.map((scenario) => {
                const genre = detectGenre(scenario.title, scenario.description)
                const gc = getGenre(genre)
                return (
                  <Card
                    key={scenario.id}
                    onClick={() => router.push('/admin')}
                    className={cn(
                      'bg-[var(--bg-secondary)] border-[var(--border)] cursor-pointer transition-all duration-200 group overflow-hidden',
                      'hover:border-[var(--accent)]/30 hover:shadow-xl hover:-translate-y-0.5'
                    )}
                  >
                    <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, var(--accent), transparent)' }} />
                    <div className="absolute -bottom-4 -right-4 text-6xl opacity-[0.03] pointer-events-none select-none">
                      ✎
                    </div>
                    <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${gc.bg} ${gc.text} ${gc.border} border`}>
                          {genre}
                        </span>
                        <Badge variant="outline" className={`text-xs ${(scenario as any).is_published ? 'border-emerald-600 text-emerald-400' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
                          {(scenario as any).is_published ? '已发布' : '草稿'}
                        </Badge>
                      </div>
                      <CardTitle className="text-sm text-[var(--text-primary)] mt-1 group-hover:text-[var(--accent)] transition-colors truncate">
                        {scenario.title}
                      </CardTitle>
                      <CardDescription className="text-[var(--text-muted)] text-xs line-clamp-1">
                        {scenario.description || '点击编辑'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <Edit3 className="w-3 h-3" />
                        点击进入管理后台编辑
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>
        )}
      </main>

      {/* 创建场景弹窗 */}
      <Dialog open={showCreateDialog} onOpenChange={(o) => {
        setShowCreateDialog(o)
        if (o) { setAiStep('choose'); setAiPrompt('') }
      }}>
        <DialogContent className="bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-primary)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              创建新场景
            </DialogTitle>
            <DialogDescription className="text-[var(--text-secondary)] text-sm">
              {aiStep === 'prompt' ? '输入你的场景创意，AI 将自动生成完整场景' : '选择一种方式开始创作你的文字冒险世界'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {aiStep === 'choose' && (
              <>
                <button
                  onClick={() => { setShowCreateDialog(false); router.push('/admin') }}
                  className="w-full p-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)]/40 hover:bg-[var(--bg-secondary)] transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
                      <Edit3 className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">从零开始创作</div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">使用表单编辑器，逐步填写世界观、剧情和规则</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setAiStep('prompt')}
                  className="w-full p-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:border-purple-500/40 hover:bg-[var(--bg-secondary)] transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <Wand2 className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)] group-hover:text-purple-300 transition-colors">AI 智能生成</div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">输入关键词，AI 自动生成完整的游戏场景</div>
                    </div>
                  </div>
                </button>
              </>
            )}

            {aiStep === 'prompt' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-right-1 duration-200 fill-mode-both">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">
                    描述你想要的场景（题材、风格、创意方向）
                  </label>
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="例如：都市修仙题材，程序员穿越到修真世界用代码破解功法"
                    className="bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] min-h-[100px] text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAiStep('choose')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    返回
                  </button>
                  <Button
                    onClick={handleAIGenerate}
                    disabled={!aiPrompt.trim()}
                    className="flex-1 text-white font-semibold border-0" style={{ backgroundColor: 'var(--accent)' }}
                  >
                    <Wand2 className="w-4 h-4 mr-1.5" />
                    AI 智能生成
                  </Button>
                </div>
              </div>
            )}

            {aiStep === 'generating' && (
              <div className="py-8 text-center animate-in fade-in duration-200 fill-mode-both">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                </div>
                <p className="text-[var(--text-primary)] font-medium">AI 正在生成场景...</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">正在根据你的创意构思世界观、剧情和规则</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 外观设置弹窗 */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-primary)] sm:max-w-sm max-w-[96vw] rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-[var(--accent)]" />
              外观设置
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2 max-h-[75vh] overflow-y-auto px-1">
            {/* —— 主题风格 —— */}
            <div>
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2.5 font-semibold">
                主题风格
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {THEMES.map((t) => {
                  const isSelected = themeId === t.id
                  const previewCss = t.css
                  return (
                    <button
                      key={t.id}
                      onClick={() => setThemeId(t.id)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all duration-200 text-center',
                        isSelected
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-sm ring-1 ring-[var(--accent)]/30'
                          : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--text-muted)]'
                      )}
                    >
                      {/* 主题色预览小方块 */}
                      <div className="w-full h-8 rounded-md overflow-hidden flex items-end justify-end p-1"
                        style={{ backgroundColor: previewCss['--bg-primary'] }}
                      >
                        <div className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: previewCss['--accent'] }}
                        />
                      </div>
                      <span className={cn(
                        'text-xs font-medium',
                        isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                      )}>
                        {t.icon} {t.name}
                      </span>
                      <span className="text-[9px] leading-tight text-[var(--text-muted)] line-clamp-1">
                        {t.description}
                      </span>
                    </button>
                  )
                })}
                {/* 自定义 */}
                <button
                  onClick={() => setThemeId('custom')}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all duration-200 text-center',
                    themeId === 'custom'
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-sm ring-1 ring-[var(--accent)]/30'
                      : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--text-muted)]'
                  )}
                >
                  <div className="w-full h-8 rounded-md overflow-hidden flex items-center justify-center gap-0.5"
                    style={{ backgroundColor: 'var(--bg-primary)' }}
                  >
                    <span className="text-[10px] opacity-70">🎨</span>
                  </div>
                  <span className={cn(
                    'text-xs font-medium',
                    themeId === 'custom' ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                  )}>
                    自定义
                  </span>
                  <span className="text-[9px] leading-tight text-[var(--text-muted)] line-clamp-1">
                    选择色阶和强调色
                  </span>
                </button>
              </div>
            </div>

            {/* —— 自定义主题 —— */}
            {themeId === 'custom' && (
              <div className="space-y-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
                <div>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2 font-semibold">背景色阶</p>
                  <div className="flex gap-1.5">
                    {(['dark', 'medium', 'light'] as const).map((shade) => (
                      <button
                        key={shade}
                        onClick={() => setCustomThemeColors(prev => ({ ...prev, bgShade: shade }))}
                        className={cn(
                          'flex-1 text-[11px] py-1.5 rounded-md border transition-all',
                          customThemeColors.bgShade === shade
                            ? 'border-[var(--accent)]/50 bg-[var(--accent-soft)] text-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--text-muted)] hover:border-stone-600'
                        )}
                      >
                        {shade === 'dark' ? '暗色' : shade === 'medium' ? '中调' : '亮色'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2 font-semibold">强调色</p>
                  <div className="flex gap-1.5">
                    {[
                      { id: 'amber', label: '琥珀' },
                      { id: 'cyan', label: '青蓝' },
                      { id: 'emerald', label: '翠绿' },
                      { id: 'purple', label: '紫韵' },
                      { id: 'gold', label: '赤金' },
                      { id: 'blue', label: '湛蓝' },
                    ].map((ac) => (
                      <button
                        key={ac.id}
                        onClick={() => setCustomThemeColors(prev => ({ ...prev, accentColor: ac.id as 'amber' | 'cyan' | 'emerald' | 'purple' | 'gold' | 'blue' }))}
                        className={cn(
                          'flex-1 text-[11px] py-1.5 rounded-md border transition-all',
                          customThemeColors.accentColor === ac.id
                            ? 'border-[var(--accent)]/50 bg-[var(--accent-soft)] text-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--text-muted)] hover:border-stone-600'
                        )}
                      >
                        {ac.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* —— 字体选择 —— */}
            <div>
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2.5 font-semibold">
                字体样式
              </p>
              <div className="grid grid-cols-2 gap-2">
                {FONTS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFontId(f.id)}
                    className={cn(
                      'flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border transition-all duration-200',
                      fontId === f.id
                        ? 'border-[var(--accent)]/50 bg-[var(--accent-soft)] shadow-sm'
                        : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-stone-600 hover:bg-stone-800/50'
                    )}
                  >
                    <span className="text-xs font-medium" style={fontId === f.id ? { color: 'var(--accent)' } : { color: 'var(--text-secondary)' }}>
                      {f.name}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">Aa 天地玄黄</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 卡片入场动画 */}
      <style>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
