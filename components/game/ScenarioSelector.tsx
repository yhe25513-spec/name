'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { GameSave, GameScenario } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Sword, Clock, PlayCircle, PlusCircle, Settings, LogOut, User, Trash2, Search, Sparkles, Edit3, ScrollText, Gamepad2, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

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
  if (/奇幻|魔法|精灵|矮人|龙|剑与魔法|冒险者/.test(text)) return '奇幻冒险'
  return '其他'
}

const GENRE_COLORS: Record<string, { bg: string; border: string; text: string; gradient: string; icon: string }> = {
  '修仙修真': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', gradient: 'from-emerald-600/20 to-teal-600/10', icon: '☯' },
  '末日生存': { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', gradient: 'from-orange-600/20 to-red-600/10', icon: '⚠' },
  '悬疑解谜': { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', gradient: 'from-purple-600/20 to-indigo-600/10', icon: '🔍' },
  '科幻未来': { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', gradient: 'from-cyan-600/20 to-blue-600/10', icon: '🚀' },
  '武侠江湖': { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', gradient: 'from-red-600/20 to-rose-600/10', icon: '⚔' },
  '都市异能': { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', gradient: 'from-blue-600/20 to-violet-600/10', icon: '🌆' },
  '奇幻冒险': { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', gradient: 'from-amber-600/20 to-yellow-600/10', icon: '🗡' },
  '其他': { bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', text: 'text-zinc-400', gradient: 'from-zinc-600/20 to-zinc-600/10', icon: '🎲' },
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

  // 同步 props 变化
  useEffect(() => { setLocalSaves(saves) }, [saves])

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
    setCreating(scenario.id!)
    try {
      const res = await fetch('/api/game/save', {
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
      const res = await fetch(`/api/game/save?id=${saveId}`, { method: 'DELETE' })
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
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* 顶部导航 */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <Sword className="w-4 h-4 text-amber-400" />
            </div>
            <span className="font-bold text-white hidden sm:inline">文字冒险</span>
          </div>

          {/* 搜索 */}
          <div className="flex-1 max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索场景..."
                className="w-full pl-9 h-9 bg-zinc-800 border-zinc-700 text-white text-sm placeholder:text-zinc-500 rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={() => router.push('/admin')}
              variant="outline"
              size="sm"
              className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 hidden sm:inline-flex"
            >
              <Edit3 className="w-4 h-4 mr-1.5" />
              {isAdmin ? '管理' : '创作'}
            </Button>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-zinc-500 hover:text-zinc-300"
            >
              <LogOut className="w-4 h-4" />
            </Button>
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-zinc-500 ml-1 pl-3 border-l border-zinc-800">
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
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold shadow-lg shadow-amber-500/20"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            创建新场景
          </Button>
          <Button
            onClick={() => router.push('/admin')}
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-400 hover:text-white sm:hidden"
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
              <h2 className="text-lg font-semibold text-zinc-200">继续游戏</h2>
              <span className="text-xs text-zinc-600 ml-auto">{localSaves.length} 个存档</span>
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
                    className="relative bg-zinc-900 border-zinc-700/50 hover:border-zinc-600 cursor-pointer transition-all duration-200 group overflow-hidden"
                  >
                    {/* 顶部分隔色条 */}
                    <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${gc.gradient}`} />
                    <button
                      onClick={(e) => deleteSave(save.id, e)}
                      disabled={deleting === save.id}
                      className="absolute top-3 right-3 p-1.5 rounded text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors z-10 opacity-0 group-hover:opacity-100"
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
                      <CardTitle className="text-sm text-white group-hover:text-amber-300 transition-colors truncate pr-2">
                        {scenarioTitle}
                      </CardTitle>
                      <CardDescription className="text-zinc-500 text-xs">
                        {formatTime(save.updated_at)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                          第 {save.turn_count} 回合
                        </Badge>
                      </div>
                      {/* HP 条 */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 w-6">HP</span>
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${hpColor} rounded-full transition-all duration-300`}
                            style={{ width: `${hpPercent}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-500 w-10 text-right">{hp.hp || 0}/{hp.maxHp || 100}</span>
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
            <h2 className="text-lg font-semibold text-zinc-200">
              {localSaves.length > 0 ? '探索新世界' : '开始冒险'}
            </h2>
          </div>

          {/* 流派筛选 */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {allGenres.map((genre) => (
              <button
                key={genre}
                onClick={() => setGenreFilter(genre)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  genreFilter === genre
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-zinc-800/50 text-zinc-400 border border-transparent hover:bg-zinc-800 hover:text-zinc-300'
                }`}
              >
                {genre}
                <span className="ml-1.5 text-[10px] opacity-60">{genreCounts[genre] || 0}</span>
              </button>
            ))}
          </div>

          {/* 场景卡片网格 */}
          {categorized.length === 0 ? (
            <div className="text-center py-16 text-zinc-600">
              <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg">暂无场景</p>
              <p className="text-sm mt-1 mb-4">
                {searchQuery ? '换个关键词试试？' : '还没有人创建场景'}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => router.push('/admin')}
                  className="bg-amber-500 hover:bg-amber-400 text-black"
                >
                  <PlusCircle className="w-4 h-4 mr-1.5" />
                  创建第一个场景
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categorized.map((scenario) => {
                const genre = (scenario as any)._genre || '其他'
                const gc = getGenre(genre)
                const state = scenario.initial_state as { hp?: number; maxHp?: number } | undefined

                return (
                  <Card
                    key={scenario.id}
                    className="group relative bg-zinc-900 border-zinc-700/50 hover:border-zinc-600 transition-all duration-200 flex flex-col overflow-hidden"
                  >
                    {/* 顶部分隔色条 */}
                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gc.gradient}`} />

                    <CardHeader className="pb-2 pt-5 px-4">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className={`text-[10px] uppercase tracking-wider font-medium ${gc.text}`}>
                          {genre}
                        </span>
                      </div>
                      <CardTitle className="text-base text-white leading-snug line-clamp-1">
                        {scenario.title}
                      </CardTitle>
                      <CardDescription className="text-zinc-400 text-sm leading-relaxed line-clamp-2 mt-1">
                        {scenario.description || '暂无描述'}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="mt-auto pt-0 px-4 pb-4">
                      <div className="flex items-center justify-between mb-3">
                        {state && (
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <span>HP {state.hp || 100}/{state.maxHp || 100}</span>
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={() => startNewGame(scenario)}
                        disabled={creating === scenario.id}
                        className={`w-full ${gc.text.replace('text-', 'bg-').replace('400', '600')} hover:${gc.text.replace('text-', 'bg-').replace('400', '500')} text-white border-0`}
                        style={{
                          backgroundColor: `color-mix(in srgb, ${genre === '修仙修真' ? '#10b981' : genre === '末日生存' ? '#f97316' : genre === '悬疑解谜' ? '#a855f7' : genre === '科幻未来' ? '#06b6d4' : genre === '武侠江湖' ? '#ef4444' : genre === '都市异能' ? '#3b82f6' : genre === '奇幻冒险' ? '#f59e0b' : '#71717a'} 80%, black 20%)`
                        }}
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
                            <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-50" />
                          </span>
                        )}
                      </Button>
                    </CardContent>
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
              <h2 className="text-lg font-semibold text-zinc-200">我的创作</h2>
              <span className="text-xs text-zinc-600 ml-auto">{myScenarios.length} 个场景</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {myScenarios.map((scenario) => {
                const genre = detectGenre(scenario.title, scenario.description)
                const gc = getGenre(genre)
                return (
                  <Card
                    key={scenario.id}
                    onClick={() => router.push('/admin')}
                    className="bg-zinc-900/50 border-zinc-700/30 hover:border-blue-500/30 cursor-pointer transition-all duration-200 group overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600/20 to-blue-400/20" />
                    <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${gc.bg} ${gc.text} ${gc.border} border`}>
                          {genre}
                        </span>
                        <Badge variant="outline" className={`text-xs ${(scenario as any).is_published ? 'border-emerald-600 text-emerald-400' : 'border-zinc-600 text-zinc-500'}`}>
                          {(scenario as any).is_published ? '已发布' : '草稿'}
                        </Badge>
                      </div>
                      <CardTitle className="text-sm text-white mt-1 group-hover:text-blue-300 transition-colors truncate">
                        {scenario.title}
                      </CardTitle>
                      <CardDescription className="text-zinc-500 text-xs line-clamp-1">
                        {scenario.description || '点击编辑'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="flex items-center gap-2 text-xs text-zinc-600">
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
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              创建新场景
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-sm">
              选择一种方式开始创作你的文字冒险世界
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <button
              onClick={() => {
                setShowCreateDialog(false)
                router.push('/admin')
              }}
              className="w-full p-4 rounded-lg bg-zinc-800/50 border border-zinc-700 hover:border-amber-500/40 hover:bg-zinc-800 transition-all text-left group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Edit3 className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white group-hover:text-amber-300 transition-colors">从零开始创作</div>
                  <div className="text-xs text-zinc-500 mt-0.5">使用表单编辑器，逐步填写世界观、剧情和规则</div>
                </div>
              </div>
            </button>

            <button
              className="w-full p-4 rounded-lg bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600 transition-all text-left group opacity-60 cursor-not-allowed"
              disabled
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-400">AI 智能生成</div>
                  <div className="text-xs text-zinc-600 mt-0.5">输入一个关键词，AI 自动生成完整场景（即将推出）</div>
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
