'use client'

import { useState, useEffect } from 'react'
import { GameScenario, GameState } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, ChevronDown, ChevronUp, Sparkles, Server } from 'lucide-react'
import { toast } from 'sonner'

interface AIConfig {
  id: string
  name: string
  provider: string
  model: string
}

// 预设模板
const TEMPLATES = {
  fantasy: {
    name: '奇幻冒险',
    worldDesc: '魔法与剑的世界，有精灵、矮人、龙等种族',
    rules: '- 玩家是冒险者\n- 通过战斗和任务获得经验\n- 可学习魔法或武技',
    protagonist: '主角：一名初出茅庐的冒险者',
    plot: '从新手村出发，逐渐成长为传奇英雄',
    style: '史诗感，英雄主义，传统奇幻风格',
  },
  survival: {
    name: '末日生存',
    worldDesc: '末日后的废土世界，资源稀缺，危机四伏',
    rules: '- 需要管理饥饿、口渴、健康\n- 搜刮物资维持生存\n- 小心丧尸和其他幸存者',
    protagonist: '主角：末日幸存者',
    plot: '在废墟中寻找资源，建立避难所，活下去',
    style: '紧张压抑，生存压力，人性考验',
  },
  mystery: {
    name: '悬疑解谜',
    worldDesc: '充满谜团的世界，隐藏着不为人知的真相',
    rules: '- 收集线索推进剧情\n- 对话选择影响信任度\n- 推理找出真相',
    protagonist: '主角：调查员/侦探',
    plot: '调查离奇事件，揭开背后的阴谋',
    style: '悬疑紧张，层层反转，烧脑推理',
  },
  cultivation: {
    name: '修仙修真',
    worldDesc: '东方修仙世界，灵气充沛，宗门林立',
    rules: '- 修炼境界：炼气→筑基→金丹→元婴\n- 可炼丹、炼器、画符\n- 争夺天材地宝',
    protagonist: '主角：有灵根的修士',
    plot: '从一介凡人修炼成仙，或开宗立派',
    style: '东方古风，境界突破，爽文节奏',
  },
}

// 默认初始状态
const DEFAULT_STATE: GameState = {
  hp: 100,
  maxHp: 100,
  attributes: { '力量': 10, '敏捷': 10, '智慧': 10 },
  inventory: [],
  flags: {},
  location: '起点',
}

interface SimpleEditorProps {
  scenario?: Partial<GameScenario>
  onSave: (scenario: Partial<GameScenario>) => Promise<void>
  onCancel: () => void
  open: boolean
  saving: boolean
  isAdmin?: boolean
}

// 简单的表单字段
interface SimpleForm {
  title: string
  description: string
  worldSetting: string
  gameRules: string
  protagonist: string
  storyPlot: string
  atmosphere: string
  firstScene: string
  playerOptions: string
  ai_config_id: string | null
}

export function SimpleScenarioEditor({ scenario, onSave, onCancel, open, saving, isAdmin = false }: SimpleEditorProps) {
  const [expanded, setExpanded] = useState<string[]>(['basic', 'world'])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  const [form, setForm] = useState<SimpleForm>({
    title: scenario?.title || '',
    description: scenario?.description || '',
    worldSetting: '',
    gameRules: '',
    protagonist: '',
    storyPlot: '',
    atmosphere: '',
    firstScene: '',
    playerOptions: '1. 探索周围\n2. 检查物品\n3. 寻找线索',
    ai_config_id: scenario?.ai_config_id || null,
  })

  // AI 配置列表
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([])
  const [aiConfigsLoading, setAiConfigsLoading] = useState(false)

  // 加载 AI 配置
  useEffect(() => {
    if (open) {
      fetchAIConfigs()
    }
  }, [open])

  async function fetchAIConfigs() {
    setAiConfigsLoading(true)
    try {
      const res = await fetch('/api/admin/ai-configs')
      const data = await res.json()
      if (res.ok) {
        setAiConfigs(data.configs || [])
        // 如果没有选择配置，默认选择第一个
        if (!form.ai_config_id && data.configs?.length > 0) {
          setForm(prev => ({ ...prev, ai_config_id: data.configs[0].id }))
        }
      }
    } catch {
      // 静默失败
    }
    setAiConfigsLoading(false)
  }

  // 应用模板
  const applyTemplate = (key: string) => {
    const t = TEMPLATES[key as keyof typeof TEMPLATES]
    if (!t) return
    setSelectedTemplate(key)
    setForm(prev => ({
      ...prev,
      worldSetting: t.worldDesc,
      gameRules: t.rules,
      protagonist: t.protagonist,
      storyPlot: t.plot,
      atmosphere: t.style,
    }))
    toast.success(`已应用「${t.name}」模板`)
  }

  // 自动生成 System Prompt
  const generateSystemPrompt = (): string => {
    return `你是文字冒险游戏《${form.title || '未命名场景'}》的GM。

【世界观】
${form.worldSetting || '（待补充世界观）'}

【核心规则】
${form.gameRules || '（待补充规则）'}

【主角设定】
${form.protagonist || '（待补充主角设定）'}

【剧情走向】
${form.storyPlot || '（待补充剧情）'}

【叙事风格】
${form.atmosphere || '（待补充风格）'}

第一回合剧情：
${form.firstScene || '描写主角醒来/出现时的场景、状态、环境'}

初始行动选项：
${form.playerOptions || '1. 探索周围\n2. 检查物品\n3. 寻找线索'}

【回合推进】
每回合结束时显示：【第X回合 | 当前位置：XXX】
根据玩家输入推进剧情，保持风格一致。`
  }

  // 保存
  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('请填写场景名称')
      return
    }

    const systemPrompt = generateSystemPrompt()

    // 构建带开场标记的初始状态
    const initialState = {
      ...DEFAULT_STATE,
      gamePhase: '开场',
      turn: 0,
      location: form.firstScene?.split('。')[0]?.slice(0, 10) || '起点',
    }

    await onSave({
      ...scenario,
      title: form.title,
      description: form.description,
      system_prompt: systemPrompt,
      initial_state: initialState,
      ai_config_id: form.ai_config_id || undefined,
    })
  }

  const Section = ({
    id,
    title,
    icon,
    children
  }: {
    id: string
    title: string
    icon?: string
    children: React.ReactNode
  }) => {
    const isOpen = expanded.includes(id)
    return (
      <div className="border border-zinc-700 rounded-lg overflow-hidden mb-3">
        <button
          onClick={() => setExpanded(prev =>
            isOpen ? prev.filter(x => x !== id) : [...prev, id]
          )}
          className="w-full flex items-center justify-between p-3 bg-zinc-800/50 hover:bg-zinc-800 text-left"
        >
          <span className="font-medium text-zinc-200">{icon} {title}</span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>
        {isOpen && (
          <div className="p-3 space-y-3 bg-zinc-900">
            {children}
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-lg">
            {scenario?.id ? '编辑场景' : '创建新场景'}
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-4 space-y-4">
          {/* 模板选择 - 仅在新建时显示 */}
          {!scenario?.id && (
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <label className="text-sm text-zinc-400 mb-2 block flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                快速开始：选择模板
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(TEMPLATES).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => applyTemplate(key)}
                    className={`p-2 rounded text-sm transition-colors ${selectedTemplate === key
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700'
                      }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 基础信息 */}
          <Section id="basic" title="基础信息" icon="📋">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">场景名称 *</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="例如：末日废土生存"
                className="bg-zinc-800 border-zinc-700 text-white h-10"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">一句话简介</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="玩家将在选择界面看到的描述"
                className="bg-zinc-800 border-zinc-700 text-white h-10"
              />
            </div>
            {/* AI 配置选择 - 仅管理员可见 */}
            {isAdmin && (
              <div>
                <label className="text-xs text-zinc-400 mb-1 block flex items-center gap-1">
                  <Server className="w-3 h-3" />
                  AI 服务配置
                </label>
                <select
                  value={form.ai_config_id || ''}
                  onChange={(e) => setForm({ ...form, ai_config_id: e.target.value || null })}
                  disabled={aiConfigsLoading || aiConfigs.length === 0}
                  className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-white text-sm disabled:opacity-50"
                >
                  <option value="">使用默认配置</option>
                  {aiConfigs.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.name} ({config.model})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500 mt-1">
                  {aiConfigs.length === 0 && '请先在「AI 服务」标签页创建配置'}
                </p>
              </div>
            )}
          </Section>

          {/* 世界观 */}
          <Section id="world" title="世界观设定" icon="🌍">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">世界背景</label>
              <Textarea
                value={form.worldSetting}
                onChange={(e) => setForm({ ...form, worldSetting: e.target.value })}
                placeholder="描述这是一个什么样的世界？有哪些种族、势力、特殊规则？"
                className="bg-zinc-800 border-zinc-700 text-white min-h-[80px]"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">风格氛围</label>
              <Input
                value={form.atmosphere}
                onChange={(e) => setForm({ ...form, atmosphere: e.target.value })}
                placeholder="例如：黑暗压抑、轻松搞笑、史诗感、悬疑紧张"
                className="bg-zinc-800 border-zinc-700 text-white h-10"
              />
            </div>
          </Section>

          {/* 游戏机制 */}
          <Section id="rules" title="游戏机制" icon="⚔️">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">核心规则</label>
              <Textarea
                value={form.gameRules}
                onChange={(e) => setForm({ ...form, gameRules: e.target.value })}
                placeholder="玩家需要做什么？如何成长/获胜？有什么特殊机制？"
                className="bg-zinc-800 border-zinc-700 text-white min-h-[80px]"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">主角设定</label>
              <Input
                value={form.protagonist}
                onChange={(e) => setForm({ ...form, protagonist: e.target.value })}
                placeholder="例如：一名失忆的冒险者 / 穿越到异界的修仙者"
                className="bg-zinc-800 border-zinc-700 text-white h-10"
              />
            </div>
          </Section>

          {/* 剧情设定 */}
          <Section id="story" title="剧情设定" icon="📖">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">故事主线</label>
              <Textarea
                value={form.storyPlot}
                onChange={(e) => setForm({ ...form, storyPlot: e.target.value })}
                placeholder="玩家将要经历什么样的故事？有什么目标和挑战？"
                className="bg-zinc-800 border-zinc-700 text-white min-h-[80px]"
              />
            </div>
          </Section>

          {/* 开场设定 */}
          <Section id="opening" title="开场设定（重要！）" icon="🎬">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">第一回合剧情</label>
              <Textarea
                value={form.firstScene}
                onChange={(e) => setForm({ ...form, firstScene: e.target.value })}
                placeholder="描写游戏开场：主角在哪里？什么状态？周围环境？"
                className="bg-zinc-800 border-zinc-700 text-white min-h-[100px]"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">初始行动选项</label>
              <Textarea
                value={form.playerOptions}
                onChange={(e) => setForm({ ...form, playerOptions: e.target.value })}
                placeholder="1. 探索周围&#10;2. 检查物品&#10;3. 寻找线索"
                className="bg-zinc-800 border-zinc-700 text-white min-h-[80px]"
              />
            </div>
          </Section>

          {/* 底部按钮 */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1 border-zinc-700 text-zinc-300"
            >
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.title.trim()}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-black"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '创建场景'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
