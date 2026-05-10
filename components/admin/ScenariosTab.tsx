'use client'

import { useState, useEffect, useMemo } from 'react'
import { GameScenario, GameState, AIConfig } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Plus, Edit, Trash2, Eye, EyeOff, Loader2, Search, Server, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { SimpleScenarioEditor } from './SimpleScenarioEditor'
import { apiFetch } from '@/lib/api-client'

const DEFAULT_INITIAL_STATE: GameState = {
  hp: 100,
  maxHp: 100,
  attributes: { '力量': 10, '敏捷': 10, '智慧': 10 },
  inventory: [],
  flags: {},
  location: '起点',
}

// 类型检测
function detectGenre(title = '', description = ''): string {
  const text = title + description
  if (/修仙|修真|筑基|金丹|元婴|炼气|修士|灵根|功法|渡劫/.test(text)) return '修仙修真'
  if (/末[日世]|废土|丧尸|辐射|生存|避难所/.test(text)) return '末日生存'
  if (/悬疑|解谜|侦探|推理|调查|线索|真相|阴谋/.test(text)) return '悬疑解谜'
  if (/科幻|星[际球]|飞船|机甲|未来|机械|赛博|AI/.test(text)) return '科幻未来'
  if (/武侠|江湖|武林|门派|宗师|内功|剑法/.test(text)) return '武侠江湖'
  if (/都市|异能|现代|校园|超能/.test(text)) return '都市异能'
  if (/言情|恋爱|甜宠|虐恋|爱情/.test(text)) return '言情恋爱'
  if (/奇幻|魔法|精灵|矮人|龙|剑与魔法|冒险者/.test(text)) return '奇幻冒险'
  return '其他'
}

const GENRE_STYLES: Record<string, { color: string; ring: string }> = {
  '修仙修真': { color: 'text-emerald-400', ring: 'ring-emerald-500/30' },
  '末日生存': { color: 'text-orange-400', ring: 'ring-orange-500/30' },
  '悬疑解谜': { color: 'text-purple-400', ring: 'ring-purple-500/30' },
  '科幻未来': { color: 'text-cyan-400', ring: 'ring-cyan-500/30' },
  '武侠江湖': { color: 'text-red-400', ring: 'ring-red-500/30' },
  '都市异能': { color: 'text-blue-400', ring: 'ring-blue-500/30' },
  '奇幻冒险': { color: 'text-amber-400', ring: 'ring-amber-500/30' },
  '言情恋爱': { color: 'text-pink-400', ring: 'ring-pink-500/30' },
  '其他': { color: 'text-zinc-400', ring: 'ring-zinc-500/30' },
}

export function ScenariosTab() {
  const [scenarios, setScenarios] = useState<GameScenario[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<Partial<GameScenario> | null>(null)
  const [saving, setSaving] = useState(false)
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')

  useEffect(() => {
    fetchScenarios()
    fetchAIConfigs()
  }, [])

  async function fetchScenarios() {
    setLoading(true)
    const res = await apiFetch('/api/admin/scenarios')
    const data = await res.json()
    setScenarios(data.scenarios || [])
    setIsAdmin(data.isAdmin || false)
    setCurrentUserId(data.userId || null)
    setLoading(false)
  }

  function canEdit(scenario: GameScenario) {
    return isAdmin || scenario.created_by === currentUserId
  }

  async function fetchAIConfigs() {
    try {
      const res = await apiFetch('/api/admin/ai-configs')
      const data = await res.json()
      if (res.ok) setAiConfigs(data.configs || [])
    } catch { /* silent */ }
  }

  async function updateScenarioAIConfig(scenarioId: string, aiConfigId: string | null) {
    const res = await apiFetch('/api/admin/scenarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: scenarioId, ai_config_id: aiConfigId || undefined }),
    })
    if (res.ok) {
      toast.success('AI 配置已更新')
      fetchScenarios()
    } else {
      const data = await res.json()
      toast.error('更新失败', { description: data.error })
    }
  }

  // 过滤 & 搜索
  const filteredScenarios = useMemo(() => {
    return scenarios.filter(s => {
      const matchesSearch = !searchQuery.trim() ||
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'published' && s.is_published) ||
        (statusFilter === 'draft' && !s.is_published)
      return matchesSearch && matchesStatus
    })
  }, [scenarios, searchQuery, statusFilter])

  const { draftCount, publishedCount } = useMemo(() => {
    return {
      draftCount: scenarios.filter(s => !s.is_published).length,
      publishedCount: scenarios.filter(s => s.is_published).length,
    }
  }, [scenarios])

  return (
    <div className="space-y-4">
      {/* 顶栏 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            游戏场景
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            共 {scenarios.length} 个场景 · 已发布 {publishedCount} · 草稿 {draftCount}
          </p>
        </div>
        <Button
          onClick={() => setEditTarget({})}
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          新建场景
        </Button>
      </div>

      {/* 搜索 + 状态筛选 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索场景名称或描述..."
            className="w-full pl-9 h-9 bg-zinc-800 border-zinc-700 text-white text-sm placeholder:text-zinc-500"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'published', 'draft'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === status
                  ? 'bg-zinc-700 text-white'
                  : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {status === 'all' ? '全部' : status === 'published' ? '已发布' : '草稿'}
            </button>
          ))}
        </div>
      </div>

      {/* 场景列表 */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
      ) : filteredScenarios.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p>{searchQuery ? '没有匹配的场景' : '暂无场景，点击右上角新建'}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredScenarios.map((s) => {
            const genre = detectGenre(s.title, s.description)
            const gs = GENRE_STYLES[genre] || GENRE_STYLES['其他']
            return (
              <Card key={s.id} className="bg-zinc-900 border-zinc-700/50 hover:border-zinc-600/50 transition-all duration-200 group overflow-hidden">
                {/* 顶部色条 */}
                <div className={`h-0.5 w-full bg-gradient-to-r ${
                  s.is_published ? 'from-emerald-600/50 to-emerald-400/30' : 'from-zinc-600/50 to-zinc-500/30'
                }`} />
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[11px] font-medium ${gs.color}`}>{genre}</span>
                        {s.created_by === currentUserId && (
                          <Badge variant="outline" className="border-amber-600/40 text-amber-400/70 text-[10px] px-1 py-0">我的</Badge>
                        )}
                      </div>
                      <CardTitle className="text-base text-white truncate">{s.title}</CardTitle>
                      <p className="text-sm text-zinc-400 line-clamp-2 mt-0.5">{s.description || '暂无描述'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge variant={s.is_published ? 'default' : 'outline'}
                        className={s.is_published
                          ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 text-[10px]'
                          : 'border-zinc-600 text-zinc-500 text-[10px]'
                        }>
                        {s.is_published ? '已发布' : '草稿'}
                      </Badge>
                    </div>
                  </div>
                  {/* AI 配置（仅管理员可见） */}
                  {isAdmin && (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-[10px] flex items-center gap-1">
                        <Server className="w-3 h-3" />
                        {s.ai_config?.name || '默认配置'}
                      </Badge>
                      <select
                        value={s.ai_config_id || ''}
                        onChange={(e) => updateScenarioAIConfig(s.id, e.target.value || null)}
                        className="text-[10px] bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-400 focus:outline-none focus:border-amber-500"
                      >
                        <option value="">默认</option>
                        {aiConfigs.map((config) => (
                          <option key={config.id} value={config.id}>
                            {config.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex gap-2">
                    {canEdit(s) && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setEditTarget(s)}
                          className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 text-xs h-8">
                          <Edit className="w-3 h-3 mr-1" />编辑
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          const res = apiFetch('/api/admin/scenarios', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: s.id, is_published: !s.is_published }),
                          }).then(r => {
                            if (r.ok) {
                              toast.success(s.is_published ? '已下线' : '已发布')
                              fetchScenarios()
                            }
                          })
                        }} className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 text-xs h-8">
                          {s.is_published
                            ? <><EyeOff className="w-3 h-3 mr-1" />下线</>
                            : <><Eye className="w-3 h-3 mr-1" />发布</>
                          }
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          if (!confirm('确认删除？此操作不可撤销。')) return
                          apiFetch(`/api/admin/scenarios?id=${s.id}`, { method: 'DELETE' }).then(r => {
                            if (r.ok) { toast.success('已删除'); fetchScenarios() }
                          })
                        }} className="border-zinc-700 text-red-400 hover:text-red-300 hover:border-red-500/30 text-xs h-8 ml-auto">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <SimpleScenarioEditor
        scenario={editTarget || undefined}
        open={!!editTarget}
        onCancel={() => setEditTarget(null)}
        onSave={async (scenario) => {
          setSaving(true)
          try {
            const res = await apiFetch('/api/admin/scenarios', {
              method: scenario.id ? 'PATCH' : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(scenario),
            })
            if (res.ok) {
              toast.success(scenario.id ? '保存成功' : '创建成功')
              setEditTarget(null)
              fetchScenarios()
            } else {
              const err = await res.json()
              toast.error('保存失败', { description: err.error })
            }
          } catch { toast.error('网络错误') }
          setSaving(false)
        }}
        saving={saving}
        isAdmin={isAdmin}
      />
    </div>
  )
}
