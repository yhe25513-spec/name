'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GameSave, GameScenario } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sword, Clock, PlayCircle, PlusCircle, Settings, LogOut, User, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface ScenarioSelectorProps {
  saves: GameSave[]
  scenarios: Partial<GameScenario>[]
  username: string
  isAdmin: boolean
}

export function ScenarioSelector({ saves, scenarios, username, isAdmin }: ScenarioSelectorProps) {
  const router = useRouter()
  const supabase = createClient()
  const [creating, setCreating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [localSaves, setLocalSaves] = useState<GameSave[]>(saves)

  // 同步 props 变化
  useEffect(() => { setLocalSaves(saves) }, [saves])

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
    e.stopPropagation() // 阻止卡片点击事件
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
    return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* 顶部导航 */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sword className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-white">文字冒险</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-zinc-400">
              <User className="w-4 h-4" />
              <span>{username}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { window.location.href = '/admin' }}
              className="border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
            >
              <Settings className="w-4 h-4 mr-1" />
              {isAdmin ? '管理' : '创作'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-zinc-500 hover:text-zinc-300"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* 继续游戏 */}
        {localSaves.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              继续游戏
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {localSaves.map((save) => (
                <Card
                  key={save.id}
                  onClick={() => router.push(`/game/${save.id}`)}
                  className="bg-zinc-900 border-zinc-700/50 hover:border-amber-500/30 hover:bg-zinc-800/80 cursor-pointer transition-all group relative"
                >
                  <button
                    onClick={(e) => deleteSave(save.id, e)}
                    disabled={deleting === save.id}
                    className="absolute top-2 right-2 p-1.5 rounded text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors z-10"
                    title="删除存档"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <CardHeader className="pb-2 pt-4 px-4 pr-10">
                    <CardTitle className="text-sm text-white group-hover:text-amber-300 transition-colors">
                      {(save.scenario as unknown as { title: string })?.title || '未知场景'}
                    </CardTitle>
                    <CardDescription className="text-zinc-500 text-xs">
                      {formatTime(save.updated_at)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                        第 {save.turn_count} 回合
                      </Badge>
                      <span className="text-xs text-zinc-500">
                        HP: {(save.current_state as { hp: number })?.hp || 0}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* 新游戏 */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-200 mb-4 flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-emerald-400" />
            开始新游戏
          </h2>
          {scenarios.length === 0 ? (
            <div className="text-center py-12 text-zinc-600">
              <p>暂无可用场景</p>
              {isAdmin && <p className="text-sm mt-1">请在管理页面创建并发布场景</p>}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {scenarios.map((scenario) => (
                <Card
                  key={scenario.id}
                  className="bg-zinc-900 border-zinc-700/50 hover:border-emerald-500/30 transition-all flex flex-col"
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-white">{scenario.title}</CardTitle>
                    <CardDescription className="text-zinc-400 text-sm leading-relaxed">
                      {scenario.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto pt-0">
                    <Button
                      onClick={() => startNewGame(scenario)}
                      disabled={creating === scenario.id}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      <PlusCircle className="w-4 h-4 mr-1.5" />
                      {creating === scenario.id ? '创建中...' : '开始冒险'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
