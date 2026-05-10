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

  // 同步 props 变化
  useEffect(() => { setLocalSaves(saves) }, [saves])

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

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* 顶部导航 */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-secondary)]/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <Sword className="w-4 h-4 text-amber-400" />
            </div>
            <span className="font-bold text-[var(--text-primary)] hidden sm:inline">文字冒险</span>
          </div>

          {/* 搜索 */}
          <div className="flex-1 max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索场景..."
                className="w-full pl-9 h-9 bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={() => router.push('/admin')}
              variant="outline"
              size="sm"
              className="border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/30 hidden sm:inline-flex"
            >
              <Edit3 className="w-4 h-4 mr-1.5" />
              {isAdmin ? '管理' : '创作'}
            </Button>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
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

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {/* 快捷操作 */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/30 transition-all duration-200"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            创建新场景
          </Button>
          <Button
            onClick={() => router.push('/admin')}
            variant="outline"
            size="sm"
            className="border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] sm:hidden"
          >
            <Edit3 className="w-4 h-4 mr-1.5" />
            {isAdmin ? '管理后台' : '我的创作'}
          </Button>
        </div>

        {/* 继续游戏 */}
        {localSaves.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-amber-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">继续游戏</h2>
              <span className="text-xs text-[var(--text-muted)] ml-auto">{localSaves.length} 个存档</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {localSaves.map((save) => {
                const scenarioTitle = (save.scenario as unknown as { title: string })?.title || '未知场景'
                const genre = detectGenre(scenarioTitle, '')
                const gc = getGenre(genre)
                const hp = (save.current_state as { hp?: number; maxHp?: number })
                const hpPercent = hp?.maxHp ? Math.round(((hp.hp || 0) / hp.maxHp) * 100) : 0
                const hpColor = hpPercent > 60 ? 'bg-emerald-500' : hpPercent > 30 ? 'bg-amber-500' : 'bg-red-500'

                return (
                  <Card
                    key={save.id}
                    onClick={() => router.push(`/game/${save.id}`)}
                    className={cn(
                      'relative bg-[var(--bg-secondary)] border-[var(--border)] cursor-pointer transition-all duration-200 group overflow-hidden',
                      'hover:border-[var(--accent)]/30 hover:shadow-xl hover:-translate-y-0.5',
                      gc.glow
                    )}
                  >
                    {/* 顶部分隔色条 */}
                    <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${gc.gradient}`} />
                    {/* 流派背景图标 */}
                    <div className="absolute -bottom-4 -right-4 text-6xl opacity-[0.04] pointer-events-none select-none">
                      {gc.icon}
                    </div>
                    <button
                      onClick={(e) => deleteSave(save.id, e)}
                      disabled={deleting === save.id}
                      className="absolute top-3 right-3 p-1.5 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--bg-card)] transition-colors z-10 opacity-0 group-hover:opacity-100"
                      title="删除存档"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <CardHeader className="pb-2 pt-4 px-4 pr-10">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${gc.bg} ${gc.text} ${gc.border} border`}>
                          {genre}
                        </span>
                      </div>
                      <CardTitle className="text-sm text-[var(--text-primary)] group-hover:text-amber-300 transition-colors truncate pr-2">
                        {scenarioTitle}
                      </CardTitle>
                      <CardDescription className="text-[var(--text-muted)] text-xs">
                        {formatTime(save.updated_at)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-xs border-[var(--border)] text-[var(--text-secondary)]">
                          第 {save.turn_count} 回合
                        </Badge>
                      </div>
                      {/* HP 条 */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-muted)] w-6">HP</span>
                        <div className="flex-1 h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                          <div
                            className={`h-full ${hpColor} rounded-full transition-all duration-300`}
                            style={{ width: `${hpPercent}%` }}
                          />
                        </div>
                        <span className="text-xs text-[var(--text-muted)] w-10 text-right">{hp.hp || 0}/{hp.maxHp || 100}</span>
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
            <Gamepad2 className="w-4 h-4 text-emerald-400" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {localSaves.length > 0 ? '探索新世界' : '开始冒险'}
            </h2>
          </div>

          {/* 流派筛选 */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-thin">
            {allGenres.map((genre) => (
              <button
                key={genre}
                onClick={() => setGenreFilter(genre)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  genreFilter === genre
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/40 shadow-sm shadow-[var(--accent)]/10'
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-transparent hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {genre}
                <span className="ml-1.5 text-[10px] opacity-60">{genreCounts[genre] || 0}</span>
              </button>
            ))}
          </div>

          {/* 场景卡片网格 */}
          {categorized.length === 0 ? (
            <div className="text-center py-16 text-[var(--text-muted)]">
              <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg">暂无场景</p>
              <p className="text-sm mt-1 mb-4">
                {searchQuery ? '换个关键词试试？' : '还没有人创建场景'}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => router.push('/admin')}
                  className="bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20"
                >
                  <PlusCircle className="w-4 h-4 mr-1.5" />
                  创建第一个场景
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

                    {/* 顶部分隔色条 — 无背景图时显示 */}
                    {!hasImg && (
                      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gc.gradient}`} />
                    )}

                    {/* 流派背景装饰图标 — 无背景图时显示 */}
                    {!hasImg && (
                      <div className="absolute -bottom-3 -right-3 text-7xl opacity-[0.03] pointer-events-none select-none group-hover:opacity-[0.06] transition-opacity duration-500">
                        {gc.icon}
                      </div>
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
                          hasImg ? '' : 'group-hover:text-amber-300'
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
              <Edit3 className="w-4 h-4 text-blue-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">我的创作</h2>
              <span className="text-xs text-[var(--text-muted)] ml-auto">{myScenarios.length} 个场景</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {myScenarios.map((scenario) => {
                const genre = detectGenre(scenario.title, scenario.description)
                const gc = getGenre(genre)
                return (
                  <Card
                    key={scenario.id}
                    onClick={() => router.push('/admin')}
                    className={cn(
                      'bg-[var(--bg-secondary)] border-[var(--border)] cursor-pointer transition-all duration-200 group overflow-hidden',
                      'hover:border-blue-500/30 hover:shadow-xl hover:-translate-y-0.5',
                      'shadow-blue-500/5 hover:shadow-blue-500/15'
                    )}
                  >
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600/20 to-blue-400/20" />
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
                      <CardTitle className="text-sm text-[var(--text-primary)] mt-1 group-hover:text-blue-300 transition-colors truncate">
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
              <Sparkles className="w-5 h-5 text-amber-400" />
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
                  className="w-full p-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:border-amber-500/40 hover:bg-[var(--bg-secondary)] transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <Edit3 className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)] group-hover:text-amber-300 transition-colors">从零开始创作</div>
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
                    className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-semibold shadow-lg shadow-purple-500/20"
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
