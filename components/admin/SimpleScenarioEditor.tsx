'use client'

import { useState, useEffect } from 'react'
import { GameScenario, GameState } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, ChevronDown, ChevronUp, Sparkles, Server, Wand2, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface AIConfig {
  id: string
  name: string
  provider: string
  model: string
}

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

interface SimpleEditorProps {
  scenario?: Partial<GameScenario>
  onSave: (scenario: Partial<GameScenario>) => Promise<void>
  onCancel: () => void
  open: boolean
  saving: boolean
  isAdmin?: boolean
}

const DEFAULT_STATE: GameState = {
  hp: 100,
  maxHp: 100,
  attributes: { '力量': 10, '敏捷': 10, '智慧': 10 },
  inventory: [],
  flags: {},
  location: '起点',
}

// ===== 模板系统 =====

interface Template {
  name: string
  icon: string
  color: string
  description: string
  worldDesc: string
  rules: string
  protagonist: string
  plot: string
  style: string
}

const TEMPLATES: Record<string, Template> = {
  fantasy: {
    name: '奇幻冒险',
    icon: '🗡',
    color: 'amber',
    description: '魔法与剑的世界，充满传说与冒险',
    worldDesc: '一个剑与魔法的奇幻世界，人类王国与精灵、矮人、兽人等种族共存。古老的龙在群山之间沉睡，地下城埋藏着失落的宝藏和远古的魔法。',
    rules: '- 玩家是一名冒险者，可加入公会接取任务\n- 通过战斗和探索获得经验与装备\n- 可学习魔法或武技，不同流派有独特技能树\n- 声望系统影响各大势力的态度',
    protagonist: '一名初出茅庐的冒险者，怀揣着成为传奇英雄的梦想，从小镇出发走向广阔世界',
    plot: '从新手村的第一份委托开始，逐步卷入一场威胁整个大陆的古老阴谋，在旅途中结识伙伴、对抗黑暗势力，最终决定世界的命运。',
    style: '史诗感，英雄主义，传统奇幻风格，带有冒险的浪漫与战斗的热血',
  },
  cultivation: {
    name: '修仙修真',
    icon: '☯',
    color: 'emerald',
    description: '东方修仙世界，灵气充沛，宗门林立',
    worldDesc: '一个灵气充沛的东方修仙世界，九天之上有仙宫，九幽之下藏魔渊。各大宗门割据灵脉，散修在夹缝中求生。天材地宝孕育于秘境险地，妖兽盘踞于深山老林。',
    rules: '- 修炼境界：炼气→筑基→金丹→元婴→化神→大乘→渡劫\n- 可炼丹、炼器、画符、布阵，每种辅助技能都有独特用途\n- 灵根资质影响修炼速度，但后天机缘可逆天改命\n- 争夺资源、秘境探宝、宗门大比是核心玩法',
    protagonist: '一名身具罕见灵根的少年/少女，因机缘踏入修仙之路，从凡人起步逐步迈向大道',
    plot: '从入门测试开始，经历宗门修行、秘境探险、正邪之战，在一次次生死危机中突破境界，揭开上古隐秘，最终问鼎大道。',
    style: '东方古风，境界突破的快感，修炼成长的爽文节奏，带有东方哲学的韵味',
  },
  survival: {
    name: '末日生存',
    icon: '⚠',
    color: 'orange',
    description: '废土世界，资源稀缺，人性考验',
    worldDesc: '一场灾难性的生化危机/核战争/天灾毁灭了现代文明。城市变成废墟，荒野充满辐射和变异生物。幸存者们在破碎的世界中挣扎求生，资源极度匮乏，法律与秩序荡然无存。',
    rules: '- 需要管理生命值、饱食度、口渴度、精神状态\n- 搜刮物资维持生存，武器和工具会磨损\n- 小心变异生物和其他幸存者——并非所有人都友好\n- 可选择独自生存或建立/加入营地',
    protagonist: '一名末日幸存者，可能在灾难中失去了亲人，带着活下去的信念在废土上艰难前行',
    plot: '在灾难发生后的世界中寻找安全的栖身之所，搜集资源、结识(或对抗)其他幸存者，逐步揭开灾难的真相，在绝望中寻找重建文明的希望。',
    style: '紧张压抑，生存压力贯穿始终，人性的光辉与黑暗并存，绝望中带着希望',
  },
  mystery: {
    name: '悬疑解谜',
    icon: '🔍',
    color: 'purple',
    description: '线索收集，层层反转，烧脑推理',
    worldDesc: '一个看似平静却暗流涌动的世界。表面上是普通的城市/小镇/庄园，但隐藏着不为人知的秘密。每个角落都可能藏着线索，每个NPC都有不愿提及的过去。',
    rules: '- 通过调查现场、询问证人、分析证据来收集线索\n- 对话选择影响NPC的信任度和合作意愿\n- 逻辑推理拼凑真相，错误结论会导致错误方向\n- 时间管理——有些线索会随着时间消失',
    protagonist: '一名敏锐的调查员/侦探/记者，拥有出色的观察力和推理能力，因为某个案件被卷入漩涡',
    plot: '从一起看似普通的案件开始调查，随着线索的深入，发现案件背后牵连着更大的阴谋，真相层层反转，每一次接近真相都伴随着新的危险。',
    style: '悬疑紧张，层层反转，烧脑推理，氛围营造是关键，让读者/玩家沉浸式体验解谜过程',
  },
  scifi: {
    name: '科幻未来',
    icon: '🚀',
    color: 'cyan',
    description: '星际探索，AI觉醒，高科技低生活',
    worldDesc: '高度发达的科技时代，人类已涉足星际殖民，AI拥有接近人类的智慧。然而高科技带来了新的社会问题—— corporations 控制着殖民地，AI开始质疑自己的地位，星际联邦的统治暗藏危机。',
    rules: '- 科技树系统：生物科技、机械义体、能量武器、黑客技术\n- 声望系统影响各大势力（联邦、企业、反抗军）的态度\n- 道德抉择影响剧情走向和结局\n- 装备和义体改造提升能力',
    protagonist: '一名生活在科技世界的普通人，可能是星际飞行员/黑客/雇佣兵/科学家，因某个事件被卷入超越自身认知的宏大事件',
    plot: '从一次例行任务/意外发现开始，逐步接触到一个关乎人类未来的秘密，在星际政治、AI觉醒和未知外星文明的夹缝中寻找真相和出路。',
    style: '科技感强，赛博朋克美学，探讨人性与科技的关系，宏观与微观视角交替',
  },
  wuxia: {
    name: '武侠江湖',
    icon: '⚔',
    color: 'red',
    description: '快意恩仇，武林争霸，侠之大者',
    worldDesc: '一个充满江湖气息的古代东方世界。各大门派割据一方，武林高手飞檐走壁。朝廷与江湖暗流涌动，正邪之争从未停歇。酒楼茶馆里流传着各路英雄的传说。',
    rules: '- 内功修炼体系：入门→小成→大成→圆满→化境\n- 可学习各门派武学、轻功、内功心法\n- 声望系统：侠义值影响NPC态度和剧情走向\n- 奇遇系统：机缘巧合下获得失传秘籍或高人指点',
    protagonist: '一名初入江湖的年轻人，可能出身武林世家或普通人家，因某种原因踏上江湖之路',
    plot: '从初入江湖的懵懂少年到名震天下的武林高手，经历门派纷争、正邪对决、江湖恩怨，在一次次历练中领悟"侠"的真谛。',
    style: '古典武侠风格，快意恩仇的江湖气息，侠义精神的传承与思考',
  },
  romance: {
    name: '言情恋爱',
    icon: '💕',
    color: 'pink',
    description: '甜宠虐恋…',
    worldDesc: '一个充满浪漫气息的现代都市世界。繁华的都市中，命运的红线将不同身份、背景的人们牵连在一起。校园里的樱花树下、写字楼的落地窗前、咖啡厅的转角处，爱情的故事随时可能上演，每一次相遇都可能是命运的安排。',
    rules: '- 好感度系统：与角色的互动影响好感度，解锁专属剧情和结局\n- 选项影响角色关系走向，多结局分支设计\n- 性格系统：玩家的选择塑造主角性格，影响可攻略角色的反应\n- 日程系统：日常活动与特殊事件的平衡，事业与爱情的抉择',
    protagonist: '一名在城市中生活的普通年轻人/少女，怀揣着对爱情的憧憬，在日常生活的某个转角遇到了命中注定的那个人',
    plot: '从一次偶然的相遇开始，在日常接触中逐渐了解彼此，经历误会与和解、甜蜜与泪水的交织，在友情、事业、爱情的多重选择中，找到属于自己的幸福结局。',
    style: '浪漫温馨，情感细腻，甜中带虐，注重角色心理描写和情感变化，给玩家沉浸式的恋爱体验',
  },
  urban: {
    name: '都市异能',
    icon: '🌆',
    color: 'blue',
    description: '现代都市，隐藏的超能者，暗流涌动',
    worldDesc: '看似普通的现代都市，表面和平繁荣。然而在普通人看不见的阴影处，异能者们隐藏着身份生活。政府有专门处理超自然事件的秘密部门，地下世界有异能者组织在暗中活动。',
    rules: '- 异能系统：每个角色拥有独特的超能力，可通过训练升级\n- 秘密身份系统：在普通人和异能者身份之间切换\n- 势力关系：政府组织、异能者团体、反派组织的态度和立场\n- 日常与异常的双线生活管理',
    protagonist: '一名看似普通的城市居民，在一次意外中觉醒了异能，不得不在两个世界之间周旋',
    plot: '从觉醒异能开始，学习控制能力、隐藏身份，逐渐发现这个世界远比自己想象的复杂——异能者之间的争斗、政府的监控、以及威胁整个城市安全的暗流。',
    style: '现代都市氛围，日常与超自然的碰撞，贴近生活的真实感与奇幻元素的结合',
  },
}

// 默认初始选项
const DEFAULT_OPTIONS = `1. 探索周围
2. 检查物品
3. 寻找线索`

const EXPANDED_DEFAULT = ['basic', 'world']

// 字段完成检查
function checkCompletion(form: SimpleForm): { section: string; complete: boolean }[] {
  return [
    { section: '基础信息', complete: !!form.title.trim() },
    { section: '世界观', complete: !!form.worldSetting.trim() },
    { section: '游戏机制', complete: !!form.gameRules.trim() && !!form.protagonist.trim() },
    { section: '剧情设定', complete: !!form.storyPlot.trim() },
    { section: '开场设定', complete: !!form.firstScene.trim() },
  ]
}

export function SimpleScenarioEditor({ scenario, onSave, onCancel, open, saving, isAdmin = false }: SimpleEditorProps) {
  const [expanded, setExpanded] = useState<string[]>(EXPANDED_DEFAULT)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [aiGenerating, setAiGenerating] = useState<string | null>(null)

  // 从 system_prompt 中提取各字段（用于编辑已有场景时回填）
  function extractFromPrompt(prompt: string | undefined, field: string): string {
    if (!prompt) return ''
    const regex = new RegExp(`【${field}】[\\s\\n]*([^\\n]*(?:\\n(?!【|第一回合|初始行动|\\[回合)[^\\n]*)*)`)
    const match = prompt.match(regex)
    return match ? match[1].trim() : ''
  }

  function extractFirstScene(prompt?: string): string {
    if (!prompt) return ''
    const match = prompt.match(/第一回合剧情[:：][\s\n]*([\s\S]*?)(?=初始行动选项|$)/)
    return match ? match[1].trim() : ''
  }

  function extractOptions(prompt?: string): string {
    if (!prompt) return DEFAULT_OPTIONS
    const match = prompt.match(/初始行动选项[:：][\s\n]*([\s\S]*?)(?=\n\n【|$)/)
    return match ? match[1].trim() : DEFAULT_OPTIONS
  }

  function buildInitialForm(s?: Partial<GameScenario>): SimpleForm {
    const prompt = s?.system_prompt
    return {
      title: s?.title || '',
      description: s?.description || '',
      worldSetting: extractFromPrompt(prompt, '世界观'),
      gameRules: extractFromPrompt(prompt, '核心规则'),
      protagonist: extractFromPrompt(prompt, '主角设定'),
      storyPlot: extractFromPrompt(prompt, '剧情走向'),
      atmosphere: extractFromPrompt(prompt, '叙事风格'),
      firstScene: extractFirstScene(prompt),
      playerOptions: extractOptions(prompt) || DEFAULT_OPTIONS,
      ai_config_id: s?.ai_config_id || null,
    }
  }

  const [form, setForm] = useState<SimpleForm>(buildInitialForm(scenario))

  // 同步表单：当 scenario 或 open 变化时重建表单（用于编辑不同场景时更新）
  useEffect(() => {
    if (open) {
      setForm(buildInitialForm(scenario))
      setSelectedTemplate(null)
      setExpanded(EXPANDED_DEFAULT)
      setShowPreview(false)
      fetchAIConfigs()
    }
  }, [open, scenario?.id])

  // AI 配置列表
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([])
  const [aiConfigsLoading, setAiConfigsLoading] = useState(false)

  async function fetchAIConfigs() {
    setAiConfigsLoading(true)
    try {
      const res = await fetch('/api/admin/ai-configs')
      const data = await res.json()
      if (res.ok) {
        setAiConfigs(data.configs || [])
        if (!form.ai_config_id && data.configs?.length > 0) {
          setForm(prev => ({ ...prev, ai_config_id: data.configs[0].id }))
        }
      }
    } catch { /* silent */ }
    setAiConfigsLoading(false)
  }

  // 完成度
  const completion = checkCompletion(form)
  const totalFields = completion.length
  const completedFields = completion.filter(c => c.complete).length
  const completionPercent = Math.round((completedFields / totalFields) * 100)

  // 应用模板
  const applyTemplate = (key: string) => {
    const t = TEMPLATES[key]
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
    // 自动展开所有需要填写的分区
    setExpanded(prev => [...new Set([...prev, 'world', 'rules', 'story', 'opening'])])
    toast.success(`已应用「${t.name}」模板，可继续自定义修改`)
  }

  // 生成 System Prompt
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
${form.playerOptions || DEFAULT_OPTIONS}

【回合推进】
每回合结束时显示：【第X回合 | 当前位置：XXX】
根据玩家输入推进剧情，保持风格一致。`
  }

  // AI 辅助生成
  const generateWithAI = async (field: string, prompt: string) => {
    setAiGenerating(field)
    try {
      const res = await fetch('/api/admin/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `你正在帮助用户创建一个文字冒险游戏场景。
场景名称：${form.title || '未命名'}
场景描述：${form.description || ''}
当前已有设定：${form.worldSetting ? `世界观：${form.worldSetting.slice(0, 100)}` : '无'}
风格氛围：${form.atmosphere || '未设定'}

请根据以上上下文，生成以下内容：
${prompt}

要求：
- 内容有沉浸感和创意
- 用中文回复
- 简洁但富有细节（100-200字左右）
- 不要添加额外说明，直接输出内容`,
        }),
      })
      const data = await res.json()
      if (res.ok && data.content) {
        setForm(prev => ({ ...prev, [field]: data.content }))
        toast.success('内容已生成')
      } else {
        toast.error('AI 生成失败', { description: data.error || '请先配置 AI 服务' })
      }
    } catch {
      toast.error('网络错误')
    }
    setAiGenerating(null)
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('请填写场景名称')
      return
    }

    const systemPrompt = generateSystemPrompt()
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

  // 折叠分区组件
  const Section = ({ id, title, icon, complete, children }: {
    id: string; title: string; icon: string; complete?: boolean; children: React.ReactNode
  }) => {
    const isOpen = expanded.includes(id)
    return (
      <div className={`border rounded-lg overflow-hidden mb-3 transition-all duration-200 ${isOpen ? 'border-zinc-600' : 'border-zinc-700/50 hover:border-zinc-600'}`}>
        <button
          onClick={() => setExpanded(prev =>
            isOpen ? prev.filter(x => x !== id) : [...prev, id]
          )}
          className="w-full flex items-center justify-between p-3 bg-zinc-800/50 hover:bg-zinc-800 text-left transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">{icon}</span>
            <span className="font-medium text-zinc-200 text-sm">{title}</span>
            {complete !== undefined && (
              complete
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                : <div className="w-3.5 h-3.5 rounded-full border-2 border-zinc-600" />
            )}
          </div>
          {isOpen
            ? <ChevronUp className="w-4 h-4 text-zinc-400" />
            : <ChevronDown className="w-4 h-4 text-zinc-400" />
          }
        </button>
        {isOpen && (
          <div className="p-3 space-y-3 bg-zinc-900">
            {children}
          </div>
        )}
      </div>
    )
  }

  const AIButton = ({ field, prompt, label }: { field: string; prompt: string; label?: string }) => (
    <button
      type="button"
      onClick={() => generateWithAI(field, prompt)}
      disabled={aiGenerating === field || !form.title.trim()}
      className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors"
      title={label || 'AI 辅助生成'}
    >
      {aiGenerating === field
        ? <Loader2 className="w-3 h-3 animate-spin" />
        : <Wand2 className="w-3 h-3" />
      }
      {label || 'AI 生成'}
    </button>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-5 pb-3 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                {scenario?.id ? '编辑场景' : '创建新场景'}
              </DialogTitle>
              <p className="text-xs text-zinc-500 mt-1">
                填写以下信息，打造属于你的文字冒险世界
              </p>
            </div>
            {/* 预览切换 + 完成度 */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-zinc-500">完成度</div>
                <div className="text-sm font-medium text-zinc-300">{completedFields}/{totalFields}</div>
              </div>
              <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    completionPercent === 100 ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                title={showPreview ? '隐藏预览' : '预览 System Prompt'}
              >
                {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="px-5 pb-5">
          {/* System Prompt 预览 */}
          {showPreview && (
            <div className="mb-4 p-3 rounded-lg bg-zinc-800/30 border border-zinc-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500 font-mono">System Prompt 预览</span>
                <span className="text-[10px] text-zinc-600">AI 将使用此提示作为游戏规则</span>
              </div>
              <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                {generateSystemPrompt()}
              </pre>
            </div>
          )}

          {/* 模板选择 - 仅在新建时显示 */}
          {!scenario?.id && (
            <div className="mb-4">
              <label className="text-xs text-zinc-500 mb-2 block flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                快速开始：选择一个模板（可后续修改）
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {Object.entries(TEMPLATES).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => applyTemplate(key)}
                    className={`p-2.5 rounded-lg text-xs transition-all border ${
                      selectedTemplate === key
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10'
                        : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-300'
                    }`}
                  >
                    <div className="text-lg mb-1">{t.icon}</div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 基础信息 */}
          <Section id="basic" title="基础信息" icon="📋" complete={completion[0].complete}>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-400">场景名称 *</label>
                <AIButton field="title" prompt="为这个文字冒险游戏想一个吸引人的标题。标题要简短有力，能体现场景的核心主题。" label="AI 起名" />
              </div>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="例如：末日废土生存记"
                className="bg-zinc-800 border-zinc-700 text-white h-10 placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">一句话简介</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="玩家在选择界面看到的简短介绍，例如：在核爆后的废土上活下去"
                className="bg-zinc-800 border-zinc-700 text-white h-10 placeholder:text-zinc-600"
              />
            </div>
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
                <p className="text-xs text-zinc-600 mt-1">
                  {aiConfigs.length === 0 && '请先在「AI」标签页创建配置'}
                </p>
              </div>
            )}
          </Section>

          {/* 世界观 */}
          <Section id="world" title="世界观设定" icon="🌍" complete={completion[1].complete}>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-400">世界背景</label>
                <AIButton field="worldSetting" prompt={`为这个${form.atmosphere || '奇幻'}世界写一段世界观设定。描述这个世界的地理、种族、势力和特殊规则，让玩家能立刻感受到世界的独特魅力。`} />
              </div>
              <Textarea
                value={form.worldSetting}
                onChange={(e) => setForm({ ...form, worldSetting: e.target.value })}
                placeholder="描述这是一个什么样的世界？有哪些种族、势力、特殊规则？
例如：一个剑与魔法的世界，人类王国与精灵矮人共存，古龙沉睡在群山之间..."
                className="bg-zinc-800 border-zinc-700 text-white min-h-[80px] placeholder:text-zinc-600 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">风格氛围</label>
              <Input
                value={form.atmosphere}
                onChange={(e) => setForm({ ...form, atmosphere: e.target.value })}
                placeholder="例如：黑暗压抑、轻松搞笑、史诗感、悬疑紧张"
                className="bg-zinc-800 border-zinc-700 text-white h-10 placeholder:text-zinc-600"
              />
            </div>
          </Section>

          {/* 游戏机制 */}
          <Section id="rules" title="游戏机制" icon="⚔️" complete={completion[2].complete}>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-400">核心规则</label>
                <AIButton field="gameRules" prompt={`为这个${form.atmosphere || ''}风格的游戏设计核心玩法规则。包括玩家能做什么、如何成长、有什么特殊机制。用简洁的条目列出。`} />
              </div>
              <Textarea
                value={form.gameRules}
                onChange={(e) => setForm({ ...form, gameRules: e.target.value })}
                placeholder="玩家需要做什么？如何成长/获胜？有什么特殊机制？
示例：
- 通过战斗和任务获得经验值
- 可学习魔法或武技
- 声望系统影响势力态度"
                className="bg-zinc-800 border-zinc-700 text-white min-h-[80px] placeholder:text-zinc-600 text-sm"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-400">主角设定</label>
                <AIButton field="protagonist" prompt={`为游戏设计一个主角设定。包括身份、背景、性格特点和目标。要让人印象深刻，有代入感。`} />
              </div>
              <Input
                value={form.protagonist}
                onChange={(e) => setForm({ ...form, protagonist: e.target.value })}
                placeholder="例如：一名失忆的冒险者 / 穿越到异界的修仙者 / 末日幸存者"
                className="bg-zinc-800 border-zinc-700 text-white h-10 placeholder:text-zinc-600"
              />
            </div>
          </Section>

          {/* 剧情设定 */}
          <Section id="story" title="剧情设定" icon="📖" complete={completion[3].complete}>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-400">故事主线</label>
                <AIButton field="storyPlot" prompt={`为游戏设计一条引人入胜的故事主线。包括故事的起点、发展、高潮和可能的结局方向。要有悬念和吸引力。`} />
              </div>
              <Textarea
                value={form.storyPlot}
                onChange={(e) => setForm({ ...form, storyPlot: e.target.value })}
                placeholder="玩家将要经历什么样的故事？有什么目标和挑战？
例如：从新手村出发，逐渐卷入威胁大陆的古老阴谋..."
                className="bg-zinc-800 border-zinc-700 text-white min-h-[80px] placeholder:text-zinc-600 text-sm"
              />
            </div>
          </Section>

          {/* 开场设定 */}
          <Section id="opening" title="开场设定" icon="🎬" complete={completion[4].complete}>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-400">第一回合剧情</label>
                <AIButton field="firstScene" prompt={`为游戏写一个引人入胜的开场剧情。用第二人称「你」来写，描述主角在哪里、什么状态、周围环境如何。要立刻抓住玩家的注意力，200字左右。`} />
              </div>
              <Textarea
                value={form.firstScene}
                onChange={(e) => setForm({ ...form, firstScene: e.target.value })}
                placeholder="描写游戏开场：主角在哪里？什么状态？周围环境？
例如：你从一张简陋的木床上醒来，头痛欲裂。窗外是陌生的街道，空气中弥漫着硝烟的味道。你最后的记忆是那道划破天际的白光..."
                className="bg-zinc-800 border-zinc-700 text-white min-h-[100px] placeholder:text-zinc-600 text-sm"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-400">初始行动选项</label>
                <AIButton field="playerOptions" prompt="为游戏开场设计3-4个初始行动选项，每行一个，用数字编号。选项要符合开场情境，给玩家有意义的初步选择。" />
              </div>
              <Textarea
                value={form.playerOptions}
                onChange={(e) => setForm({ ...form, playerOptions: e.target.value })}
                placeholder="1. 探索周围
2. 检查物品
3. 寻找线索
4. 大声呼救"
                className="bg-zinc-800 border-zinc-700 text-white min-h-[80px] placeholder:text-zinc-600 text-sm"
              />
            </div>
          </Section>

          {/* 底部按钮 */}
          <div className="flex gap-3 pt-2 border-t border-zinc-800 mt-4">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
            >
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.title.trim()}
              className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  保存中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {scenario?.id ? '保存修改' : '创建场景'}
                </span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
