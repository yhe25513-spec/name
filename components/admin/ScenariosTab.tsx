'use client'

import { useState, useEffect } from 'react'
import { GameScenario, GameState, AIConfig } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, Eye, EyeOff, Loader2, User, Settings, Server } from 'lucide-react'
import { toast } from 'sonner'
import { SimpleScenarioEditor } from './SimpleScenarioEditor'

// 默认初始状态
const DEFAULT_INITIAL_STATE: GameState = {
  hp: 100,
  maxHp: 100,
  attributes: { '力量': 10, '敏捷': 10, '智慧': 10 },
  inventory: [],
  flags: {},
  location: '起点',
}

export function ScenariosTab() {
  const [scenarios, setScenarios] = useState<GameScenario[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<Partial<GameScenario> | null>(null)
  const [saving, setSaving] = useState(false)
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([])

  useEffect(() => {
    fetchScenarios()
    fetchAIConfigs()
  }, [])

  async function fetchScenarios() {
    setLoading(true)
    const res = await fetch('/api/admin/scenarios')
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
      const res = await fetch('/api/admin/ai-configs')
      const data = await res.json()
      if (res.ok) {
        setAiConfigs(data.configs || [])
      }
    } catch {
      // 静默失败
    }
  }

  async function updateScenarioAIConfig(scenarioId: string, aiConfigId: string | null) {
    const res = await fetch('/api/admin/scenarios', {
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

  async function saveScenario() {
    if (!editTarget?.title?.trim()) { toast.error('请填写场景标题'); return }
    setSaving(true)

    const isNew = !editTarget.id
    const method = isNew ? 'POST' : 'PATCH'
    const body = isNew
      ? { ...editTarget, initial_state: editTarget.initial_state || DEFAULT_INITIAL_STATE }
      : editTarget

    const res = await fetch('/api/admin/scenarios', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.scenario) {
      toast.success(isNew ? '场景已创建' : '场景已更新')
      setEditTarget(null)
      fetchScenarios()
    } else {
      toast.error('保存失败', { description: data.error })
    }
    setSaving(false)
  }

  async function togglePublish(scenario: GameScenario) {
    const res = await fetch('/api/admin/scenarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: scenario.id, is_published: !scenario.is_published }),
    })
    if (res.ok) {
      toast.success(scenario.is_published ? '已下线' : '已发布')
      fetchScenarios()
    }
  }

  async function deleteScenario(id: string) {
    if (!confirm('确认删除？此操作不可撤销。')) return
    const res = await fetch(`/api/admin/scenarios?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('已删除')
      fetchScenarios()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-200">游戏场景</h2>
        <Button
          onClick={() => setEditTarget({})}
          className="bg-amber-500 hover:bg-amber-400 text-black"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          新建场景
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
      ) : scenarios.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">暂无场景，点击右上角新建</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {scenarios.map((s) => (
            <Card key={s.id} className="bg-zinc-900 border-zinc-700/50">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base text-white">{s.title}</CardTitle>
                  <div className="flex gap-1">
                    {s.created_by === currentUserId && (
                      <Badge variant="outline" className="border-amber-600 text-amber-400 text-xs">我的</Badge>
                    )}
                    <Badge variant={s.is_published ? 'default' : 'outline'}
                      className={s.is_published ? 'bg-emerald-600 text-white text-xs' : 'border-zinc-600 text-zinc-500 text-xs'}>
                      {s.is_published ? '已发布' : '草稿'}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-zinc-400 line-clamp-2">{s.description}</p>
                {/* AI 配置信息 - 仅管理员可切换 */}
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-xs flex items-center gap-1">
                    <Server className="w-3 h-3" />
                    {s.ai_config?.name || '默认配置'}
                  </Badge>
                  {isAdmin && (
                    <select
                      value={s.ai_config_id || ''}
                      onChange={(e) => updateScenarioAIConfig(s.id, e.target.value || null)}
                      className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-amber-500"
                    >
                      <option value="">使用默认配置</option>
                      {aiConfigs.map((config) => (
                        <option key={config.id} value={config.id}>
                          {config.name} ({config.model})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {canEdit(s) && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setEditTarget(s)}
                        className="border-zinc-700 text-zinc-300 hover:text-white text-xs">
                        <Edit className="w-3 h-3 mr-1" />编辑
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => togglePublish(s)}
                        className="border-zinc-700 text-zinc-300 hover:text-white text-xs">
                        {s.is_published ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                        {s.is_published ? '下线' : '发布'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deleteScenario(s.id)}
                        className="border-zinc-700 text-red-400 hover:text-red-300 text-xs ml-auto">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 简化编辑器 */}
      <SimpleScenarioEditor
        scenario={editTarget || undefined}
        open={!!editTarget}
        onCancel={() => setEditTarget(null)}
        onSave={async (scenario) => {
          setSaving(true)
          try {
            const res = await fetch('/api/admin/scenarios', {
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
          } catch {
            toast.error('网络错误')
          }
          setSaving(false)
        }}
        saving={saving}
        isAdmin={isAdmin}
      />

      {/* 高级编辑按钮 */}
      {editTarget?.id && (
        <div className="fixed bottom-4 right-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // 切换到高级编辑器（保留旧代码路径）
              toast.info('高级编辑功能开发中')
            }}
            className="border-zinc-700 text-zinc-400"
          >
            <Settings className="w-4 h-4 mr-1" />
            高级设置
          </Button>
        </div>
      )}
    </div>
  )
}
