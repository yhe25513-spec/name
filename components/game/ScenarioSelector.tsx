'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { GameSave, GameScenario } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiFetch } from '@/lib/api-client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Sword, Clock, PlusCircle, Settings, LogOut, Trash2, Search, Sparkles, Edit3, ScrollText, Gamepad2, ChevronRight, Loader2, Wand2, ArrowLeft, BookOpen } from 'lucide-react'
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

// 类型检测（从标题/描述/系统提示中提取关键词）
function detectGenre(title = '', description = '', systemPrompt = ''): string {
  const text = title + description + systemPrompt
  if (/修仙|修真|仙侠|筑基|金丹|元婴|炼气|化神|大乘|修士|灵根|功法|渡劫|灵气|丹药|法宝|剑修|宗门|秘境|飞升|凡人/.test(text)) return '修仙修真'
  if (/末[日世]|废土|丧尸|辐射|生存|避难所/.test(text)) return '末日生存'
  if (/悬疑|解谜|侦探|推理|调查|线索|真相|阴谋/.test(text)) return '悬疑解谜'
  if (/科幻|星[际球]|飞船|机甲|未来|机械|赛博|AI|人工智能/.test(text)) return '科幻未来'
  if (/武侠|江湖|武林|门派|宗师|内功|剑法/.test(text)) return '武侠江湖'
  if (/都市|异能|现代|校园|超能/.test(text)) return '都市异能'
  if (/言情|恋爱|甜宠|虐恋|爱情/.test(text)) return '言情恋爱'
  if (/奇幻|魔法|精灵|矮人|龙|剑与魔法|冒险者/.test(text)) return '奇幻冒险'
  return '其他'
}

const GENRE_COLORS: Record<string, { bg: string; border: string; text: string; gradient: string; icon: string; glow: string; thumbGradient: string }> = {
  '修仙修真': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', gradient: 'from-emerald-600/20 to-teal-600/10', icon: '☯', glow: 'shadow-emerald-500/10 group-hover:shadow-emerald-500/25', thumbGradient: 'linear-gradient(135deg, #064e3b, #065f46)' },
  '末日生存': { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', gradient: 'from-orange-600/20 to-red-600/10', icon: '⚠', glow: 'shadow-orange-500/10 group-hover:shadow-orange-500/25', thumbGradient: 'linear-gradient(135deg, #7c2d12, #92400e)' },
  '悬疑解谜': { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', gradient: 'from-purple-600/20 to-indigo-600/10', icon: '🔍', glow: 'shadow-purple-500/10 group-hover:shadow-purple-500/25', thumbGradient: 'linear-gradient(135deg, #3b0764, #4c1d95)' },
  '科幻未来': { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', gradient: 'from-cyan-600/20 to-blue-600/10', icon: '🚀', glow: 'shadow-cyan-500/10 group-hover:shadow-cyan-500/25', thumbGradient: 'linear-gradient(135deg, #164e63, #155e75)' },
  '武侠江湖': { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', gradient: 'from-red-600/20 to-rose-600/10', icon: '⚔', glow: 'shadow-red-500/10 group-hover:shadow-red-500/25', thumbGradient: 'linear-gradient(135deg, #7f1d1d, #991b1b)' },
  '都市异能': { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', gradient: 'from-blue-600/20 to-violet-600/10', icon: '🌆', glow: 'shadow-blue-500/10 group-hover:shadow-blue-500/25', thumbGradient: 'linear-gradient(135deg, #1e3a5f, #1e40af)' },
  '言情恋爱': { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400', gradient: 'from-pink-600/20 to-rose-600/10', icon: '💕', glow: 'shadow-pink-500/10 group-hover:shadow-pink-500/25', thumbGradient: 'linear-gradient(135deg, #831843, #9d174d)' },
  '奇幻冒险': { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', gradient: 'from-amber-600/20 to-yellow-600/10', icon: '🗡', glow: 'shadow-amber-500/10 group-hover:shadow-amber-500/25', thumbGradient: 'linear-gradient(135deg, #78350f, #92400e)' },
  '其他': { bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', text: 'text-zinc-400', gradient: 'from-zinc-600/20 to-zinc-600/10', icon: '🎲', glow: 'shadow-zinc-500/10 group-hover:shadow-zinc-500/25', thumbGradient: 'linear-gradient(135deg, #27272a, #3f3f46)' },
}

export function ScenarioSelector({ saves, scenarios, username, isAdmin, userId }: ScenarioSelectorProps) {
  const router = useRouter()
  const supabase = createClient()
  const [creating, setCreating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [localSaves, setLocalSaves] = useState<GameSave[]>(saves)
  const [searchQuery, setSearchQuery] = useState('')
  const [genreFilter, setGenreFilter] = useState('全部')

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [aiStep, setAiStep] = useState<'choose' | 'prompt' | 'generating'>('choose')
  const [aiPrompt, setAiPrompt] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [themeId, setThemeId] = useState('linear')
  const [fontId, setFontId] = useState('serif')
  const [customThemeColors, setCustomThemeColors] = useState<CustomThemeColors>({
    bgShade: 'dark', accentColor: 'amber',
  })
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

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
      _genre: detectGenre(s.title, s.description, (s as any).system_prompt),
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
    // 跳转到角色创建页面
    router.push(`/game/create?scenarioId=${scenario.id}`)
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

  // 动态主题
  const currentPageTheme = getTheme(themeId)

  // 将主题 CSS 变量写入 document.documentElement，确保全局可用
  useEffect(() => {
    const root = document.documentElement
    Object.entries(currentPageTheme.css).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })
    // 清理：组件卸载时不移除，因为切换到其他主题时会被覆盖
  }, [themeId, customThemeColors])

  return (
    <div className="game-shell game-shell--hall">
      {/* ======================== TOPBAR ======================== */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 px-3 sm:px-4"
        style={{
          gridColumn: '1 / -1',
          gridRow: 1,
          backgroundColor: 'var(--bg-secondary)',
          backdropFilter: 'blur(var(--glass-blur, 20px))',
          WebkitBackdropFilter: 'blur(var(--glass-blur, 20px))',
          borderBottom: '1px solid var(--glass-border)',
        }}
      >
        {/* 返回按钮 */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-all flex-shrink-0"
          style={{ color: 'var(--text-muted)' }}
          title="返回首页"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent2, #06b6d4))',
              color: '#fff',
              boxShadow: '0 0 20px var(--glow-accent)',
            }}
          >
            万
          </div>
          <span className="font-semibold text-sm hidden sm:inline" style={{ color: 'var(--text-primary)' }}>
            万界录
          </span>
        </div>

        {/* 搜索 */}
        <div className="flex-1 max-w-md mx-auto hidden sm:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索场景..."
              className="w-full pl-9 h-9 text-sm rounded-xl"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* 右侧操作 */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 ml-auto">
          {/* 移动端搜索 */}
          <button
            className="sm:hidden w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ color: 'var(--text-muted)' }}
            onClick={() => document.getElementById('mobileSearchInput')?.focus()}
            title="搜索"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ color: 'var(--text-muted)' }}
            title="外观设置"
          >
            <Settings className="w-4 h-4" />
          </button>

          <Button
            onClick={() => router.push('/admin')}
            variant="outline"
            size="sm"
            className="h-9 text-xs hidden sm:inline-flex rounded-xl"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            <Edit3 className="w-3.5 h-3.5 mr-1.5" />
            {isAdmin ? '管理' : '创作'}
          </Button>

          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ color: 'var(--text-muted)' }}
            title="退出登录"
          >
            <LogOut className="w-4 h-4" />
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs ml-1 pl-3" style={{ color: 'var(--text-muted)', borderLeft: '1px solid var(--glass-border)' }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs relative"
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent2, #06b6d4))',
                color: '#fff',
                boxShadow: '0 0 15px var(--glow-accent)',
              }}
            >
              {username.charAt(0).toUpperCase()}
            </div>
            <span className="truncate max-w-[80px]">{username}</span>
            <div
              className="ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px]"
              style={{
                backgroundColor: 'var(--accent-soft)',
                border: '1px solid var(--border)',
              }}
            >
              <span style={{ color: 'var(--accent)' }}>{localSaves.length}</span>
              <span style={{ color: 'var(--text-muted)' }}>存档</span>
            </div>
          </div>
        </div>
      </header>

      {/* ======================== SIDEBAR ======================== */}
      <nav className="game-sidebar p-2 sm:p-3" style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--glass-border)',
      }}>
        {/* 可滚动区域 */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
          {/* 万界录品牌 */}
          <div className="text-center py-4 px-2">
            <div className="relative">
              {/* 装饰光晕 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full opacity-30" style={{
                  background: 'radial-gradient(circle, var(--accent-soft), transparent 70%)',
                  filter: 'blur(20px)',
                }} />
              </div>
              <div
                className="relative text-xl font-bold tracking-wider"
                style={{
                  background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2, #06b6d4) 50%, var(--accent) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                万界录
              </div>
            </div>
            <div className="text-[8px] tracking-[0.3em] mt-2 font-medium" style={{ color: 'var(--text-muted)' }}>
              文 字 冒 险 · 无 限 世 界
            </div>
          </div>

          {/* 分类导航 */}
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase px-2 mb-3 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              <div className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
              分类
            </div>
            <div className="space-y-1">
              {allGenres.map((genre) => {
                const gc = genre !== '全部' ? getGenre(genre) : null
                return (
                  <button
                    key={genre}
                    onClick={() => setGenreFilter(genre)}
                    className="sidebar-item w-full text-left px-3 py-2 rounded-lg text-[11px] transition-all flex items-center gap-2.5 group"
                    style={{
                      color: genreFilter === genre ? 'var(--accent)' : 'var(--text-secondary)',
                      backgroundColor: genreFilter === genre ? 'var(--accent-soft)' : 'transparent',
                      border: genreFilter === genre ? '1px solid var(--border)' : '1px solid transparent',
                    }}
                  >
                    {gc && <span className="text-base w-5 text-center flex-shrink-0 transition-transform group-hover:scale-110">{gc.icon}</span>}
                    {!gc && <span className="text-base w-5 text-center flex-shrink-0">📋</span>}
                    <span className="flex-1">{genre}</span>
                    <span
                      className="text-[9px] px-2 py-0.5 rounded-full font-medium transition-all"
                      style={{
                        backgroundColor: genreFilter === genre ? 'var(--accent-soft)' : 'rgba(255,255,255,0.06)',
                        color: genreFilter === genre ? 'var(--accent)' : 'var(--text-muted)',
                      }}
                    >
                      {genreCounts[genre] || 0}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* ======================== MAIN CONTENT ======================== */}
      <main className="game-main game-main--scroll px-3 sm:px-6 py-4 sm:py-6">
        {/* 移动端搜索栏 */}
        <div className="sm:hidden mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <Input
              id="mobileSearchInput"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索场景..."
              className="w-full pl-9 h-10 text-sm rounded-xl"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* 快捷操作 */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wide" style={{ color: 'var(--text-primary, #f3f6ff)' }}>
              探索万界
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary, #94a3b8)' }}>
              选择一段故事，开启你的冒险之旅
            </p>
          </div>
          <button
            onClick={() => setShowCreateDialog(true)}
            className={cn(
              'group relative overflow-hidden px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-300 hover:shadow-lg flex items-center gap-2 flex-shrink-0',
              localSaves.length === 0 && 'animate-pulse'
            )}
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent2, #06b6d4))',
              boxShadow: '0 4px 20px var(--glow-accent)',
            }}
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">创建新场景</span>
          </button>
          <button
            onClick={() => router.push('/admin')}
            className="px-4 py-2.5 rounded-xl text-xs transition-all sm:hidden flex items-center gap-1.5"
            style={{
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <Edit3 className="w-3.5 h-3.5" />
            {isAdmin ? '管理' : '创作'}
          </button>
        </div>

        {/* 继续游戏 */}
        {localSaves.length > 0 && (
          <section className="mb-8 md:mb-10">
            <div className="flex items-center gap-3 mb-4 md:mb-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
                backgroundColor: 'var(--accent-soft)',
                border: '1px solid var(--border)',
              }}>
                <Clock className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              </div>
              <h2 className="text-base font-semibold tracking-tight" style={{ color: 'var(--text-primary, #f3f6ff)' }}>继续游戏</h2>
              <span className="text-xs ml-auto px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
                {localSaves.length} 个存档
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {localSaves.map((save, index) => {
                const scenarioTitle = (save.scenario as unknown as { title: string })?.title || '未知场景'
                const genre = detectGenre(scenarioTitle, '')
                const gc = getGenre(genre)
                const hp = save.current_state
                const hpPercent = hp?.maxHp ? Math.round(((hp.hp || 0) / hp.maxHp) * 100) : 0
                const isLowHp = hpPercent <= 30
                const scenarioData = scenarios.find(s => s.id === save.scenario_id)
                const bgImg = scenarioData?.background_image_url
                const bri = bgImg && scenarioData?.id ? imageBrightness[scenarioData.id] : undefined
                const isLight = bri !== undefined && bri > 0.55
                const hasImg = !!bgImg && bri !== undefined

                return (
                  <div
                    key={save.id}
                    onClick={() => router.push(`/game/${save.id}`)}
                    className="relative text-left cursor-pointer transition-all duration-300 group overflow-hidden rounded-xl hover:-translate-y-1"
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--glass-border)',
                      boxShadow: 'var(--panel-shadow)',
                      animation: `fadeSlideIn 0.4s ease-out ${index * 0.1}s both`,
                      ...(hasImg ? {
                        backgroundImage: `url(${bgImg})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      } : {}),
                    }}
                  >
                    {hasImg && (
                      <div className={cn(
                        'absolute inset-0',
                        isLight ? 'bg-white/50' : 'bg-gradient-to-b from-black/60 via-black/40 to-black/80'
                      )} />
                    )}
                    {!hasImg && (
                      <>
                        <div className={cn('absolute inset-0 bg-gradient-to-br opacity-20', gc.gradient)} />
                        <div className="absolute -bottom-4 -right-4 text-6xl opacity-[0.06] pointer-events-none select-none">
                          {gc.icon}
                        </div>
                      </>
                    )}
                    <div className="relative z-10 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className="text-[10px] md:text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{
                            backgroundColor: 'var(--accent-soft)',
                            color: 'var(--accent)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {genre}
                        </span>
                        <button
                          onClick={(e) => deleteSave(save.id, e)}
                          disabled={deleting === save.id}
                          className="p-1.5 rounded-lg transition-all"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* 存档标题（自动生成的可读标题） */}
                      <div className="mb-1">
                        {(save as any).title ? (
                          <div className="text-xs font-medium truncate" style={{ color: hasImg ? (isLight ? '#1a1a1a' : 'rgba(255,255,255,0.8)') : 'var(--text-secondary)' }}>
                            {(save as any).title}
                          </div>
                        ) : (
                          <h3
                            className="text-sm md:text-base font-semibold truncate pr-2"
                            style={{ color: hasImg ? (isLight ? '#1a1a1a' : '#ffffff') : 'var(--text-primary)' }}
                          >
                            {scenarioTitle}
                          </h3>
                        )}
                      </div>

                      {/* 位置 + 境界 */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {save.current_state?.location && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1"
                            style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                            📍 {save.current_state.location}
                          </span>
                        )}
                        {save.current_state?.realm && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1"
                            style={{ backgroundColor: 'rgba(20,241,198,0.08)', color: '#14f1c6' }}>
                            ✦ {save.current_state.realm}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] md:text-xs" style={{ color: 'var(--text-muted)' }}>
                          第 {save.turn_count} 回合
                        </span>
                        <span className="text-[10px] md:text-xs" style={{ color: 'var(--text-muted)' }}>
                          {formatTime(save.updated_at)}
                        </span>
                      </div>
                      {/* HP 条 */}
                      <div className="flex items-center gap-3">
                        <span
                          className="text-[10px] w-6 font-medium"
                          style={{ color: isLowHp ? '#ef4444' : 'var(--text-muted)' }}
                        >
                          {isLowHp ? '⚠' : 'HP'}
                        </span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              hpPercent > 60 ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' :
                              hpPercent > 30 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                              'bg-gradient-to-r from-red-500 to-pink-500',
                              isLowHp && 'animate-pulse'
                            )}
                            style={{
                              width: `${hpPercent}%`,
                              ...(isLowHp ? { boxShadow: '0 0 8px rgba(239,68,68,0.6)' } : {}),
                            }}
                          />
                        </div>
                        <span
                          className="text-[10px] w-14 text-right font-medium"
                          style={{ color: isLowHp ? '#ef4444' : 'var(--text-muted)' }}
                        >
                          {hp.hp || 0}/{hp.maxHp || 100}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* 探索新世界 */}
        <section>
          <div className="flex items-center gap-3 mb-4 md:mb-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
              backgroundColor: 'var(--accent-soft)',
              border: '1px solid var(--border)',
              boxShadow: '0 4px 15px var(--glow-accent)',
            }}>
              <Gamepad2 className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            </div>
            <h2 className="text-base md:text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary, #f3f6ff)' }}>
              {localSaves.length > 0 ? '探索新世界' : '开始冒险'}
            </h2>
            <span className="text-xs ml-auto px-3 py-1 rounded-full" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
              {categorized.length} 个场景
            </span>
          </div>

          {/* 流派筛选 */}
          <div className="flex gap-2 sm:gap-3 mb-5 md:mb-6 overflow-x-auto pb-2 -mx-3 sm:mx-0 px-3 sm:px-0 scrollbar-thin">
            {allGenres.map((genre) => {
              const gc = genre !== '全部' ? getGenre(genre) : null
              return (
                <button
                  key={genre}
                  onClick={() => setGenreFilter(genre)}
                  className="flex-shrink-0 px-4 md:px-5 py-2 md:py-2.5 rounded-xl text-[11px] md:text-sm font-medium transition-all duration-300"
                  style={{
                    color: genreFilter === genre ? 'var(--text-primary)' : 'var(--text-muted)',
                    backgroundColor: genreFilter === genre ? 'var(--accent-soft)' : 'rgba(255,255,255,0.04)',
                    border: genreFilter === genre ? '1px solid var(--border)' : '1px solid transparent',
                    boxShadow: genreFilter === genre ? '0 4px 15px var(--glow-accent)' : 'none',
                  }}
                >
                  {gc && <span className="mr-1.5">{gc.icon}</span>}
                  {genre}
                  <span className="ml-2 text-[9px] md:text-[10px] opacity-70">{genreCounts[genre] || 0}</span>
                </button>
              )
            })}
          </div>

          {/* 场景卡片网格 */}
          {categorized.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{
                backgroundColor: 'var(--accent-soft)',
                border: '1px solid var(--border)',
                boxShadow: '0 8px 30px var(--glow-accent)',
              }}>
                <ScrollText className="w-10 h-10" style={{ color: 'var(--accent)' }} />
              </div>
              {searchQuery ? (
                <>
                  <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>没有找到匹配的场景</p>
                  <p className="text-sm mt-2 mb-6" style={{ color: 'var(--text-muted)' }}>换个关键词试试？</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>还没有场景</p>
                  <p className="text-sm mt-2 mb-8" style={{ color: 'var(--text-muted)' }}>创建你的第一个冒险世界吧</p>
                  <div className="flex flex-col items-center gap-3 mb-8">
                    <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--border)' }}>1</span>
                      点击上方「创建新场景」
                    </div>
                    <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--border)' }}>2</span>
                      填写世界观和剧情设定
                    </div>
                    <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--border)' }}>3</span>
                      发布后即可开始冒险
                    </div>
                  </div>
                  <Button
                    onClick={() => router.push('/admin')}
                    className="text-white border-0 px-6 py-2.5 rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, var(--accent), var(--accent2, #06b6d4))',
                      boxShadow: '0 4px 20px var(--glow-accent)',
                    }}
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    从零开始创作
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {categorized.map((scenario, index) => {
                const genre = (scenario as any)._genre || '其他'
                const gc = getGenre(genre)
                const state = scenario.initial_state as { hp?: number; maxHp?: number } | undefined
                const bri = scenario.id && scenario.background_image_url ? imageBrightness[scenario.id] : undefined
                const hasImg = !!scenario.background_image_url && bri !== undefined

                return (
                  <div
                    key={scenario.id}
                    className="relative overflow-hidden cursor-pointer transition-all duration-500 group rounded-xl"
                    style={{
                      animation: `fadeSlideIn 0.5s ease-out ${index * 0.08}s both`,
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--glass-border)',
                      boxShadow: 'var(--panel-shadow)',
                    }}
                    onClick={() => startNewGame(scenario)}
                  >
                    {/* 缩略图区 — 有图用图，无图用渐变 */}
                    <div
                      className="relative h-28 md:h-40 flex items-center justify-center overflow-hidden"
                      style={{ background: hasImg ? undefined : gc.thumbGradient }}
                    >
                      {hasImg ? (
                        <>
                          <div
                            className="absolute inset-0 bg-cover bg-center"
                            style={{ backgroundImage: `url(${scenario.background_image_url})` }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] to-transparent" />
                        </>
                      ) : (
                        <>
                          <div
                            className="absolute w-32 h-32 md:w-40 md:h-40 rounded-full opacity-40"
                            style={{
                              background: 'radial-gradient(circle, var(--accent-soft), transparent 70%)',
                              animation: 'portal-pulse 4s ease-in-out infinite',
                            }}
                          />
                          <span className="text-5xl md:text-7xl opacity-90 select-none drop-shadow-[0_4px_24px_rgba(0,0,0,.5)] relative z-10">
                            {gc.icon}
                          </span>
                          <div
                            className="absolute inset-0"
                            style={{
                              background: 'linear-gradient(to top, var(--bg-primary) 0%, transparent 60%)',
                            }}
                          />
                        </>
                      )}
                      {/* 流派标签 */}
                      <span
                        className="absolute top-3 left-3 text-[10px] md:text-xs px-3 py-1 rounded-lg font-semibold z-10 backdrop-blur-md"
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.4)',
                          border: '1px solid var(--border)',
                          color: 'var(--accent)',
                        }}
                      >
                        {genre}
                      </span>
                      {/* 难度指示 */}
                      <div className="absolute bottom-3 right-3 flex gap-1.5 z-10">
                        {[1, 2, 3, 4, 5].map((dot) => {
                          const hash = scenario.id ? String(scenario.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0) : 0
                          const fillIdx = (hash % 3) + 2
                          return (
                            <div
                              key={dot}
                              className="w-2 h-2 rounded-full transition-all"
                              style={{
                                backgroundColor: dot <= fillIdx ? 'var(--accent)' : 'rgba(255,255,255,0.2)',
                                boxShadow: dot <= fillIdx ? '0 0 8px var(--glow-accent)' : 'none',
                              }}
                            />
                          )
                        })}
                      </div>
                    </div>

                    {/* 文字内容 */}
                    <div className="relative z-10 p-3 md:p-5">
                      <h3
                        className="text-sm md:text-xl font-bold leading-snug md:leading-tight line-clamp-2 transition-colors tracking-wide"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {scenario.title}
                      </h3>
                      {scenario.description && (
                        <p className="text-xs md:text-sm leading-relaxed line-clamp-2 mt-1 md:mt-2" style={{ color: 'var(--text-secondary)' }}>
                          {scenario.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-2 md:pt-4 mt-2 md:mt-4" style={{ borderTop: '1px solid var(--glass-border)' }}>
                        <div className="flex items-center gap-3">
                          {state && (
                            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                              <span style={{ color: '#ef4444' }}>❤</span> {state.hp || 100}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                          {creating === scenario.id ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              创建中
                            </span>
                          ) : (
                            <>
                              开始冒险
                              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 悬停发光效果 */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{
                      background: 'radial-gradient(circle at center, var(--glow-accent), transparent 70%)',
                    }} />
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* 我的创作 */}
        {myScenarios.length > 0 && (
          <section className="mt-10 md:mt-12">
            <div className="flex items-center gap-3 mb-6 md:mb-8">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
                backgroundColor: 'var(--accent-soft)',
                border: '1px solid var(--border)',
                boxShadow: '0 4px 15px var(--glow-accent)',
              }}>
                <Edit3 className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              </div>
              <h2 className="text-base md:text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary, #f3f6ff)' }}>我的创作</h2>
              <span className="text-xs ml-auto px-3 py-1 rounded-full" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
                {myScenarios.length} 个场景
              </span>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {myScenarios.map((scenario, index) => {
                const genre = detectGenre(scenario.title, scenario.description, (scenario as any).system_prompt)
                const gc = getGenre(genre)
                return (
                  <button
                    key={scenario.id}
                    onClick={() => router.push('/admin')}
                    className="text-left cursor-pointer transition-all duration-300 group overflow-hidden rounded-xl hover:-translate-y-1"
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--glass-border)',
                      boxShadow: 'var(--panel-shadow)',
                      animation: `fadeSlideIn 0.4s ease-out ${index * 0.1}s both`,
                    }}
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{
                          backgroundColor: 'var(--accent-soft)',
                          border: '1px solid var(--border)',
                        }}>
                          {gc.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: 'var(--accent-soft)',
                                color: 'var(--accent)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              {genre}
                            </span>
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: (scenario as any).is_published ? 'var(--accent-soft)' : 'transparent',
                                color: (scenario as any).is_published ? 'var(--accent)' : 'var(--text-muted)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              {(scenario as any).is_published ? '已发布' : '草稿'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <h3
                        className="text-sm font-semibold truncate transition-colors"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {scenario.title}
                      </h3>
                      <p className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--text-muted)' }}>
                        {scenario.description || '点击编辑'}
                      </p>
                      <div className="flex items-center gap-2 text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                        <Edit3 className="w-3.5 h-3.5" />
                        点击进入管理后台编辑
                      </div>
                    </div>

                    {/* 悬停发光效果 */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{
                      background: 'radial-gradient(circle at center, var(--glow-accent), transparent 70%)',
                    }} />
                  </button>
                )
              })}
            </div>
          </section>
        )}
      </main>

      {/* ======================== STATUS PANEL ======================== */}
      <aside className="game-status space-y-4" style={{
        backgroundColor: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--glass-border)',
      }}>
        {/* 玩家信息 */}
        <div className="p-4 rounded-xl" style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--glass-border)',
        }}>
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0 relative"
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent2, #06b6d4))',
                color: '#fff',
                boxShadow: '0 0 25px var(--glow-accent)',
              }}
            >
              {username.charAt(0).toUpperCase()}
              {/* 在线状态 */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2" style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--bg-secondary)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{username}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>冒险者</p>
            </div>
          </div>
        </div>

        {/* 统计 */}
        <div className="p-4 rounded-xl" style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--glass-border)',
        }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent)', boxShadow: '0 0 8px var(--glow-accent)' }} />
            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
              统计
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>总冒险</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{localSaves.length}</span>
            </div>
            <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>总场景</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{scenarios.length}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>创作</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>{myScenarios.length}</span>
            </div>
          </div>
        </div>

        {/* 成就预览 */}
        <div className="p-4 rounded-xl" style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--glass-border)',
        }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent)', boxShadow: '0 0 8px var(--glow-accent)' }} />
            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
              成就
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 rounded-xl" style={{ backgroundColor: 'var(--accent-soft)' }}>
              <div className="text-xl font-bold" style={{ color: 'var(--accent)', textShadow: '0 0 20px var(--glow-accent)' }}>
                {localSaves.filter(s => s.turn_count >= 10).length}
              </div>
              <div className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>深入冒险</div>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ backgroundColor: 'var(--accent-soft)' }}>
              <div className="text-xl font-bold" style={{ color: 'var(--accent)', textShadow: '0 0 20px var(--glow-accent)' }}>
                {localSaves.reduce((sum, s) => sum + s.turn_count, 0)}
              </div>
              <div className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>总回合数</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ======================== MOBILE BOTTOM TAB ======================== */}
      <div
        className="game-bottom-tab items-center justify-around px-3 py-2 z-30"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          backdropFilter: 'blur(var(--glass-blur, 20px))',
          WebkitBackdropFilter: 'blur(var(--glass-blur, 20px))',
          borderTop: '1px solid var(--glass-border)',
        }}
      >
        <button
          className="flex flex-col items-center gap-1 py-1.5 px-4 rounded-xl"
          style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <Gamepad2 className="w-5 h-5" />
          <span className="text-[10px] font-medium">场景</span>
        </button>
        <button
          onClick={() => setMobileDrawerOpen(true)}
          className="flex flex-col items-center gap-1 py-1.5 px-4 rounded-xl transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] font-medium">分类</span>
        </button>
        <button
          onClick={() => router.push('/admin')}
          className="flex flex-col items-center gap-1 py-1.5 px-4 rounded-xl transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <Edit3 className="w-5 h-5" />
          <span className="text-[10px] font-medium">{isAdmin ? '管理' : '创作'}</span>
        </button>
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 py-1.5 px-4 rounded-xl transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px] font-medium">退出</span>
        </button>
      </div>

      {/* ======================== MOBILE DRAWER OVERLAY ======================== */}
      {mobileDrawerOpen && (
        <div
          className="game-drawer-overlay fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* ======================== MOBILE DRAWER ======================== */}
      <div
        className={cn(
          'game-drawer fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl p-5 transition-transform duration-300 max-h-[70vh] overflow-y-auto',
          mobileDrawerOpen ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderBottom: 'none',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>
        <div className="space-y-1.5">
          {allGenres.map((genre) => {
            const gc = genre !== '全部' ? getGenre(genre) : null
            return (
              <button
                key={genre}
                onClick={() => { setGenreFilter(genre); setMobileDrawerOpen(false) }}
                className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all flex items-center gap-3"
                style={{
                  color: genreFilter === genre ? 'var(--accent)' : 'var(--text-muted)',
                  backgroundColor: genreFilter === genre ? 'var(--accent-soft)' : 'transparent',
                  border: genreFilter === genre ? '1px solid var(--border)' : '1px solid transparent',
                }}
              >
                {gc && <span className="text-lg">{gc.icon}</span>}
                {!gc && <span className="text-lg">📋</span>}
                <span className="flex-1">{genre}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>{genreCounts[genre] || 0}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--glass-border)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent2, #06b6d4))',
                color: '#fff',
                boxShadow: '0 0 20px var(--glow-accent)',
              }}
            >
              {username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{username}</p>
              <p className="text-xs" style={{ color: 'var(--accent)' }}>赛博修士</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-xl" style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid var(--border)' }}>
              <div className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{localSaves.length}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>冒险</div>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid var(--border)' }}>
              <div className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{scenarios.length}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>场景</div>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid var(--border)' }}>
              <div className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{myScenarios.length}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>创作</div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================== 创建场景弹窗 ======================== */}
      <Dialog open={showCreateDialog} onOpenChange={(o) => {
        setShowCreateDialog(o)
        if (o) { setAiStep('choose'); setAiPrompt('') }
      }}>
        <DialogContent style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid var(--border)' }}>
                <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              </div>
              创建新场景
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--text-muted)' }} className="text-sm">
              {aiStep === 'prompt' ? '输入你的场景创意，AI 将自动生成完整场景' : '选择一种方式开始创作你的冒险世界'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {aiStep === 'choose' && (
              <>
                <button
                  onClick={() => { setShowCreateDialog(false); router.push('/admin') }}
                  className="w-full p-4 rounded-xl transition-all text-left group"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--glass-border)' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid var(--border)' }}>
                      <Edit3 className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium transition-colors" style={{ color: 'var(--text-primary)' }}>从零开始创作</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>使用表单编辑器，逐步填写世界观、剧情和规则</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setAiStep('prompt')}
                  className="w-full p-4 rounded-xl transition-all text-left group"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--glass-border)' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid var(--border)' }}>
                      <Wand2 className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium transition-colors" style={{ color: 'var(--text-primary)' }}>AI 智能生成</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>输入关键词，AI 自动生成完整的游戏场景</div>
                    </div>
                  </div>
                </button>
              </>
            )}

            {aiStep === 'prompt' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-1 duration-200 fill-mode-both">
                <div>
                  <label className="text-xs mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                    描述你想要的场景（题材、风格、创意方向）
                  </label>
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="例如：修仙题材，程序员穿越到修真世界用代码破解功法"
                    className="min-h-[110px] text-sm rounded-xl"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAiStep('choose')}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    返回
                  </button>
                  <Button
                    onClick={handleAIGenerate}
                    disabled={!aiPrompt.trim()}
                    className="flex-1 text-white font-semibold border-0 rounded-xl"
                    style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent2, #06b6d4))', boxShadow: '0 4px 20px var(--glow-accent)' }}
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    AI 智能生成
                  </Button>
                </div>
              </div>
            )}

            {aiStep === 'generating' && (
              <div className="py-10 text-center animate-in fade-in duration-200 fill-mode-both">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid var(--border)', boxShadow: '0 0 30px var(--glow-accent)' }}>
                  <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--accent)' }} />
                </div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>AI 正在生成场景...</p>
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>正在根据你的创意构思世界观、剧情和规则</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ======================== 外观设置弹窗 ======================== */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} className="sm:max-w-sm max-w-[96vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid var(--border)' }}>
                <Settings className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
              </div>
              外观设置
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2 max-h-[75vh] overflow-y-auto px-1">
            {/* —— 主题风格 —— */}
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-3 font-semibold flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                <div className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
                主题风格
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {THEMES.map((t) => {
                  const isSelected = themeId === t.id
                  const previewCss = t.css
                  return (
                    <button
                      key={t.id}
                      onClick={() => setThemeId(t.id)}
                      className="flex flex-col items-center gap-2 p-2.5 rounded-xl border transition-all duration-300 text-center"
                      style={{
                        borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                        backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--bg-card)',
                        boxShadow: isSelected ? '0 4px 15px var(--glow-accent)' : 'none',
                      }}
                    >
                      {/* 主题色预览小方块 */}
                      <div className="w-full h-9 rounded-lg overflow-hidden flex items-end justify-end p-1.5"
                        style={{ backgroundColor: previewCss['--bg-primary'] }}
                      >
                        <div className="w-3.5 h-3.5 rounded-md"
                          style={{ backgroundColor: previewCss['--accent'] }}
                        />
                      </div>
                      <span className="text-xs font-medium" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
                        {t.icon} {t.name}
                      </span>
                      <span className="text-[9px] leading-tight line-clamp-1" style={{ color: 'var(--text-muted)' }}>
                        {t.description}
                      </span>
                    </button>
                  )
                })}
                {/* 自定义 */}
                <button
                  onClick={() => setThemeId('custom')}
                  className="flex flex-col items-center gap-2 p-2.5 rounded-xl border transition-all duration-300 text-center"
                  style={{
                    borderColor: themeId === 'custom' ? 'var(--accent)' : 'var(--border)',
                    backgroundColor: themeId === 'custom' ? 'var(--accent-soft)' : 'var(--bg-card)',
                    boxShadow: themeId === 'custom' ? '0 4px 15px var(--glow-accent)' : 'none',
                  }}
                >
                  <div className="w-full h-9 rounded-lg overflow-hidden flex items-center justify-center gap-1"
                    style={{ backgroundColor: 'var(--bg-primary)' }}
                  >
                    <span className="text-[11px] opacity-70">🎨</span>
                  </div>
                  <span className="text-xs font-medium" style={{ color: themeId === 'custom' ? 'var(--accent)' : 'var(--text-primary)' }}>
                    自定义
                  </span>
                  <span className="text-[9px] leading-tight line-clamp-1" style={{ color: 'var(--text-muted)' }}>
                    选择色阶和强调色
                  </span>
                </button>
              </div>
            </div>

            {/* —— 自定义主题 —— */}
            {themeId === 'custom' && (
              <div className="space-y-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--glass-border)' }}>
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-2.5 font-semibold" style={{ color: 'var(--text-muted)' }}>背景色阶</p>
                  <div className="flex gap-2">
                    {(['dark', 'medium', 'light'] as const).map((shade) => (
                      <button
                        key={shade}
                        onClick={() => setCustomThemeColors(prev => ({ ...prev, bgShade: shade }))}
                        className="flex-1 text-[11px] py-2 rounded-lg border transition-all"
                        style={{
                          borderColor: customThemeColors.bgShade === shade ? 'var(--accent)' : 'var(--border)',
                          backgroundColor: customThemeColors.bgShade === shade ? 'var(--accent-soft)' : 'transparent',
                          color: customThemeColors.bgShade === shade ? 'var(--accent)' : 'var(--text-muted)',
                        }}
                      >
                        {shade === 'dark' ? '暗色' : shade === 'medium' ? '中调' : '亮色'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-2.5 font-semibold" style={{ color: 'var(--text-muted)' }}>强调色</p>
                  <div className="flex gap-2">
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
                        className="flex-1 text-[11px] py-2 rounded-lg border transition-all"
                        style={{
                          borderColor: customThemeColors.accentColor === ac.id ? 'var(--accent)' : 'var(--border)',
                          backgroundColor: customThemeColors.accentColor === ac.id ? 'var(--accent-soft)' : 'transparent',
                          color: customThemeColors.accentColor === ac.id ? 'var(--accent)' : 'var(--text-muted)',
                        }}
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
              <p className="text-[10px] uppercase tracking-wider mb-3 font-semibold flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                <div className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
                字体样式
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {FONTS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFontId(f.id)}
                    className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all duration-300"
                    style={{
                      borderColor: fontId === f.id ? 'var(--accent)' : 'var(--border)',
                      backgroundColor: fontId === f.id ? 'var(--accent-soft)' : 'var(--bg-card)',
                      boxShadow: fontId === f.id ? '0 4px 15px var(--glow-accent)' : 'none',
                    }}
                  >
                    <span className="text-xs font-medium" style={{ color: fontId === f.id ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {f.name}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Aa 天地玄黄</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 动画样式 */}
      <style>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
          }
          25% {
            transform: translateY(-20px) translateX(10px);
          }
          50% {
            transform: translateY(-10px) translateX(-5px);
          }
          75% {
            transform: translateY(-25px) translateX(15px);
          }
        }

        @keyframes portal-pulse {
          0%, 100% {
            box-shadow: 0 0 8px rgba(16,185,129,0.2);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 24px rgba(16,185,129,0.4);
            transform: scale(1.05);
          }
        }

        /* 自定义滚动条 */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(16,185,129,0.2);
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(16,185,129,0.3);
        }
      `}</style>
    </div>
  )
}
