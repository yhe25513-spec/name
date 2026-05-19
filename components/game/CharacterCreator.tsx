'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ArrowLeft, ArrowRight, Check, Shuffle, Loader2, Sparkles } from 'lucide-react'
import type { GameState } from '@/lib/types'

// ─── 流派检测 ───

function detectGenre(title: string, description: string, systemPrompt: string): string {
  const text = title + description + systemPrompt
  if (/修仙|修真|仙侠|筑基|金丹|元婴|炼气|化神|大乘|修士|灵根|功法|渡劫|灵气|丹药|法宝|剑修|宗门|秘境|飞升/.test(text)) return '修仙修真'
  if (/末[日世]|废土|丧尸|辐射|生存|避难所|感染/.test(text)) return '末日生存'
  if (/悬疑|解谜|侦探|推理|调查|线索|真相|阴谋|凶手/.test(text)) return '悬疑解谜'
  if (/科幻|星[际球]|飞船|机甲|未来|机械|赛博|AI|人工智能|纳米/.test(text)) return '科幻未来'
  if (/武侠|江湖|武林|门派|宗师|内功|剑法|掌法/.test(text)) return '武侠江湖'
  if (/都市|异能|现代|校园|超能/.test(text)) return '都市异能'
  if (/言情|恋爱|甜宠|虐恋|爱情/.test(text)) return '言情恋爱'
  if (/奇幻|魔法|精灵|矮人|龙|剑与魔法|冒险者/.test(text)) return '奇幻冒险'
  if (/历史|三国|古代|王朝|帝王|将军|谋士/.test(text)) return '历史架空'
  return '其他'
}

// ─── 各流派角色定义 ───

interface GenreConfig {
  label: string
  icon: string
  title: string
  subtitle: string
  attributes: { id: string; description: string; icon: string }[]
  specialChoices: SpecialChoice[]
  defaultHp: number
  defaultAttrs: Record<string, number>
  presetNames: string[]
  realmLabel: string
  realmValue: string
}

interface SpecialChoice {
  type: string        // e.g. "灵根", "职业", "种族", "异能", "兵器"
  label: string
  maxSelections: number
  options: {
    id: string
    name: string
    emoji: string
    description: string
    bonuses: Record<string, number>
    isRare?: boolean
  }[]
}

// ─── 通用属性基座 ───
const COMMON_ATTRS = [
  { id: '力量', description: '影响攻击和物理强度', icon: '⚔️' },
  { id: '敏捷', description: '影响速度和反应', icon: '💨' },
  { id: '智慧', description: '影响悟性和知识', icon: '🧠' },
  { id: '体质', description: '影响生命和耐力', icon: '🛡️' },
]

const GENRE_CONFIGS: Record<string, GenreConfig> = {

  '修仙修真': {
    label: '修仙修真', icon: '☯', title: '踏入仙途', subtitle: '选择你的修仙天赋',
    attributes: [
      ...COMMON_ATTRS,
      { id: '灵力', description: '影响法术威力和灵气感知', icon: '✨' },
    ],
    defaultHp: 100, realmLabel: '境界', realmValue: '练气期·一层',
    defaultAttrs: { 力量: 5, 敏捷: 5, 智慧: 5, 体质: 5, 灵力: 5 },
    presetNames: ['云逸', '清玄', '紫霄', '墨尘', '太虚', '明心', '道玄', '灵虚', '苍穹', '玄机', '忘忧', '归鸿', '逍遥', '问天', '长风', '听雪'],
    specialChoices: [{
      type: '灵根', label: '灵根选择', maxSelections: 3,
      options: [
        { id: 'metal', name: '金灵根', emoji: '🪙', description: '锋锐刚猛，擅长攻击', bonuses: { 力量: 3, 体质: 1 } },
        { id: 'wood', name: '木灵根', emoji: '🌿', description: '生生不息，擅长疗愈', bonuses: { 智慧: 3, 灵力: 1 } },
        { id: 'water', name: '水灵根', emoji: '💧', description: '变幻莫测，擅长法术', bonuses: { 灵力: 3, 智慧: 1 } },
        { id: 'fire', name: '火灵根', emoji: '🔥', description: '暴烈狂放，擅长爆发', bonuses: { 力量: 2, 敏捷: 2 } },
        { id: 'earth', name: '土灵根', emoji: '⛰️', description: '厚重沉稳，擅长防御', bonuses: { 体质: 3, 力量: 1 } },
        { id: 'thunder', name: '雷灵根', emoji: '⚡', description: '至阳至刚，变异灵根', bonuses: { 力量: 4, 敏捷: 1 }, isRare: true },
        { id: 'ice', name: '冰灵根', emoji: '❄️', description: '寒冰彻骨，变异灵根', bonuses: { 灵力: 4, 智慧: 1 }, isRare: true },
        { id: 'wind', name: '风灵根', emoji: '🌪️', description: '来去无踪，变异灵根', bonuses: { 敏捷: 4, 力量: 1 }, isRare: true },
      ],
    }],
  },

  '末日生存': {
    label: '末日生存', icon: '⚠', title: '废土求生', subtitle: '在末日世界中挣扎求存',
    attributes: [
      ...COMMON_ATTRS,
      { id: '感知', description: '影响侦查和警觉', icon: '👁️' },
    ],
    defaultHp: 120, realmLabel: '称号', realmValue: '幸存者',
    defaultAttrs: { 力量: 5, 敏捷: 5, 智慧: 5, 体质: 5, 感知: 5 },
    presetNames: ['铁手', '孤狼', '灰烬', '夜鹰', '硬汉', '幽灵', '狂徒', '余烬', '回声', '幸存者42号'],
    specialChoices: [{
      type: '职业', label: '幸存者职业', maxSelections: 1,
      options: [
        { id: 'warrior', name: '战士', emoji: '🔫', description: '擅长战斗和武器使用', bonuses: { 力量: 4, 体质: 2 } },
        { id: 'scout', name: '猎手', emoji: '🏹', description: '擅长潜行和远程攻击', bonuses: { 敏捷: 4, 感知: 2 } },
        { id: 'medic', name: '医生', emoji: '💊', description: '擅长治疗和化学知识', bonuses: { 智慧: 4, 体质: 2 } },
        { id: 'engineer', name: '工程师', emoji: '🔧', description: '擅长建造和维修', bonuses: { 智慧: 3, 力量: 3 } },
      ],
    }],
  },

  '悬疑解谜': {
    label: '悬疑解谜', icon: '🔍', title: '迷雾追踪', subtitle: '用智慧揭开真相',
    attributes: [
      ...COMMON_ATTRS.slice(0, 3), // 力量/敏捷/智慧
      { id: '感知', description: '影响观察和洞察', icon: '👁️' },
      { id: '意志', description: '影响心理承受力', icon: '🧠' },
    ],
    defaultHp: 80, realmLabel: '身份', realmValue: '调查员',
    defaultAttrs: { 力量: 4, 敏捷: 5, 智慧: 6, 感知: 6, 意志: 5 },
    presetNames: ['陈默', '林凡', '苏雨', '江辰', '沈清', '陆风', '白羽', '夜行者'],
    specialChoices: [{
      type: '背景', label: '调查员背景', maxSelections: 1,
      options: [
        { id: 'detective', name: '侦探', emoji: '🕵️', description: '有丰富的案件调查经验', bonuses: { 智慧: 3, 感知: 3 } },
        { id: 'journalist', name: '记者', emoji: '📰', description: '擅长信息收集和人脉', bonuses: { 感知: 3, 意志: 2 } },
        { id: 'professor', name: '教授', emoji: '🎓', description: '知识渊博，逻辑严谨', bonuses: { 智慧: 4, 力量: 1 } },
        { id: 'police', name: '警探', emoji: '👮', description: '受过专业训练', bonuses: { 力量: 2, 敏捷: 2, 感知: 2 } },
      ],
    }],
  },

  '科幻未来': {
    label: '科幻未来', icon: '🚀', title: '星际启航', subtitle: '在星辰大海中书写传奇',
    attributes: [
      ...COMMON_ATTRS.slice(1), // 去掉力量，增加科技
      { id: '力量', description: '影响体能和战斗', icon: '⚡' },
      { id: '科技', description: '影响技术能力', icon: '🔬' },
    ],
    defaultHp: 100, realmLabel: '阶级', realmValue: '星际公民',
    defaultAttrs: { 力量: 4, 敏捷: 5, 智慧: 6, 体质: 4, 科技: 6 },
    presetNames: ['星尘', '猎户', '天狼', '伏羲', '诺瓦', '赛博', '脉冲', '量子'],
    specialChoices: [{
      type: '职业', label: '星际职业', maxSelections: 1,
      options: [
        { id: 'engineer', name: '工程师', emoji: '🔧', description: '精通机械和系统', bonuses: { 科技: 4, 智慧: 2 } },
        { id: 'pilot', name: '飞行员', emoji: '🚀', description: '顶尖驾驶技术', bonuses: { 敏捷: 4, 力量: 2 } },
        { id: 'scientist', name: '科学家', emoji: '🔬', description: '科研能力卓越', bonuses: { 智慧: 4, 科技: 2 } },
        { id: 'soldier', name: '星际战士', emoji: '⚔️', description: '战斗技巧精湛', bonuses: { 力量: 4, 体质: 2 } },
      ],
    }],
  },

  '武侠江湖': {
    label: '武侠江湖', icon: '⚔', title: '仗剑天涯', subtitle: '快意恩仇，侠之大者',
    attributes: [
      ...COMMON_ATTRS,
      { id: '内力', description: '影响内功和真气', icon: '🌀' },
    ],
    defaultHp: 120, realmLabel: '称号', realmValue: '江湖散人',
    defaultAttrs: { 力量: 5, 敏捷: 5, 智慧: 5, 体质: 5, 内力: 5 },
    presetNames: ['萧逸', '林平', '楚寒', '江枫', '叶开', '沈浪', '李寻欢', '西门', '独孤', '令狐'],
    specialChoices: [{
      type: '兵器', label: '兵器精通', maxSelections: 1,
      options: [
        { id: 'sword', name: '剑法', emoji: '🗡️', description: '轻灵飘逸，以快制胜', bonuses: { 敏捷: 4, 力量: 2 } },
        { id: 'blade', name: '刀法', emoji: '🔪', description: '刚猛霸道，一力降十会', bonuses: { 力量: 4, 体质: 2 } },
        { id: 'fist', name: '拳掌', emoji: '👊', description: '近身格斗，内力深厚', bonuses: { 内力: 4, 体质: 2 } },
        { id: 'staff', name: '棍法', emoji: '🏏', description: '攻守兼备，以静制动', bonuses: { 体质: 3, 敏捷: 3 } },
      ],
    }],
  },

  '都市异能': {
    label: '都市异能', icon: '🌆', title: '觉醒时刻', subtitle: '在繁华都市中掌控超凡之力',
    attributes: [
      ...COMMON_ATTRS.slice(1, 4),
      { id: '力量', description: '影响体魄和爆发', icon: '💪' },
      { id: '异能', description: '影响异能强度和操控', icon: '🔮' },
    ],
    defaultHp: 90, realmLabel: '评级', realmValue: 'D级觉醒者',
    defaultAttrs: { 力量: 4, 敏捷: 5, 智慧: 5, 体质: 4, 异能: 7 },
    presetNames: ['林墨', '苏尘', '叶凡', '楚天', '陆晨', '白夜', '玄一', '王也'],
    specialChoices: [{
      type: '异能', label: '异能类型', maxSelections: 1,
      options: [
        { id: 'fire', name: '火系', emoji: '🔥', description: '操控火焰，攻击性强', bonuses: { 异能: 4, 力量: 2 } },
        { id: 'ice', name: '冰系', emoji: '❄️', description: '操控寒冰，攻防一体', bonuses: { 异能: 3, 体质: 3 } },
        { id: 'telekinetic', name: '念力', emoji: '🧠', description: '意念控物，灵活多变', bonuses: { 异能: 4, 敏捷: 2 } },
        { id: 'healing', name: '治愈', emoji: '💚', description: '快速愈合，辅助能力', bonuses: { 异能: 3, 智慧: 3 } },
      ],
    }],
  },

  '奇幻冒险': {
    label: '奇幻冒险', icon: '🗡', title: '剑与魔法', subtitle: '踏上史诗般的奇幻之旅',
    attributes: [
      ...COMMON_ATTRS,
      { id: '魔力', description: '影响魔法力量', icon: '✨' },
    ],
    defaultHp: 110, realmLabel: '等级', realmValue: '初心冒险者',
    defaultAttrs: { 力量: 5, 敏捷: 5, 智慧: 5, 体质: 5, 魔力: 5 },
    presetNames: ['亚瑟', '莱昂', '艾琳', '格里芬', '奥莉薇', '塞拉', '罗格', '艾尔文'],
    specialChoices: [{
      type: '种族', label: '种族选择', maxSelections: 1,
      options: [
        { id: 'human', name: '人类', emoji: '🧑', description: '均衡发展，适应力强', bonuses: { 力量: 2, 智慧: 2, 体质: 2 } },
        { id: 'elf', name: '精灵', emoji: '🧝', description: '敏捷聪慧，擅长弓箭和魔法', bonuses: { 敏捷: 3, 魔力: 3 } },
        { id: 'dwarf', name: '矮人', emoji: '⛏️', description: '强壮坚韧，擅长锻造和战斗', bonuses: { 力量: 3, 体质: 3 } },
        { id: 'beastman', name: '兽人', emoji: '🐺', description: '野性力量，直觉敏锐', bonuses: { 力量: 4, 感知: 2 } },
      ],
    }, {
      type: '职业', label: '职业选择', maxSelections: 1,
      options: [
        { id: 'warrior', name: '战士', emoji: '⚔️', description: '近战王者，钢铁意志', bonuses: { 力量: 2, 体质: 2 } },
        { id: 'mage', name: '法师', emoji: '🔮', description: '元素掌控，毁天灭地', bonuses: { 魔力: 3, 智慧: 1 } },
        { id: 'rogue', name: '游侠', emoji: '🏹', description: '灵活致命，百步穿杨', bonuses: { 敏捷: 2, 感知: 2 } },
        { id: 'cleric', name: '牧师', emoji: '✨', description: '神圣之力，治愈守护', bonuses: { 智慧: 2, 体质: 2 } },
      ],
    }],
  },

  '言情恋爱': {
    label: '言情恋爱', icon: '💕', title: '心动邂逅', subtitle: '在命运的交织中寻找真爱',
    attributes: [
      { id: '魅力', description: '影响第一印象和吸引力', icon: '💫' },
      { id: '情商', description: '影响沟通和察言观色', icon: '💬' },
      { id: '才华', description: '影响才艺和内涵', icon: '🎭' },
      { id: '意志', description: '影响决心和抗压', icon: '💪' },
      { id: '运气', description: '影响偶然相遇和机遇', icon: '🍀' },
    ],
    defaultHp: 60, realmLabel: '定位', realmValue: '故事主角',
    defaultAttrs: { 魅力: 6, 情商: 6, 才华: 5, 意志: 4, 运气: 5 },
    presetNames: ['苏晚', '沈清', '顾安', '林诗', '江瑶', '叶辰', '洛晴', '温言', '安歌', '许诺'],
    specialChoices: [{
      type: '身份', label: '初始身份', maxSelections: 1,
      options: [
        { id: 'student', name: '学生', emoji: '📚', description: '校园时光，青春正好', bonuses: { 情商: 2, 运气: 2 } },
        { id: 'artist', name: '艺术家', emoji: '🎨', description: '才情横溢，浪漫不羁', bonuses: { 才华: 4, 魅力: 2 } },
        { id: 'professional', name: '职场精英', emoji: '💼', description: '干练自信，成熟稳重', bonuses: { 魅力: 2, 意志: 2 } },
        { id: 'traveler', name: '旅行者', emoji: '🧳', description: '随性自在，邂逅风景', bonuses: { 运气: 3, 情商: 1 } },
      ],
    }],
  },

  '历史架空': {
    label: '历史架空', icon: '🏯', title: '纵横古今', subtitle: '在历史长河中掀起波澜',
    attributes: [
      ...COMMON_ATTRS,
      { id: '谋略', description: '影响计策和治国', icon: '🧠' },
    ],
    defaultHp: 100, realmLabel: '身份', realmValue: '布衣',
    defaultAttrs: { 力量: 5, 敏捷: 5, 智慧: 5, 体质: 5, 谋略: 5 },
    presetNames: ['子墨', '长卿', '玄德', '仲谋', '文远', '公瑾', '孔明', '奉先', '孟德', '子龙'],
    specialChoices: [{
      type: '出身', label: '出身背景', maxSelections: 1,
      options: [
        { id: 'scholar', name: '文人', emoji: '📜', description: '满腹经纶，谋略过人', bonuses: { 智慧: 3, 谋略: 3 } },
        { id: 'general', name: '武将', emoji: '⚔️', description: '勇冠三军，万夫莫敌', bonuses: { 力量: 4, 体质: 2 } },
        { id: 'noble', name: '贵族', emoji: '👑', description: '家世显赫，人脉广泛', bonuses: { 魅力: 3, 谋略: 2 } },
        { id: 'strategist', name: '谋士', emoji: '🧮', description: '运筹帷幄，决胜千里', bonuses: { 谋略: 4, 智慧: 2 } },
      ],
    }],
  },

  '其他': {
    label: '其他', icon: '🎲', title: '冒险启程', subtitle: '书写属于你的传奇',
    attributes: [...COMMON_ATTRS],
    defaultHp: 100, realmLabel: '称号', realmValue: '冒险者',
    defaultAttrs: { 力量: 5, 敏捷: 5, 智慧: 5, 体质: 5 },
    presetNames: ['云逸', '星野', '墨羽', '凛冬', '孤鸿', '长风', '听雪', '逍遥'],
    specialChoices: [],
  },
}

interface CharacterCreatorProps {
  scenarioId: string
  scenarioTitle: string
  scenarioDescription?: string
  scenarioSystemPrompt?: string
  initialAttributes: Record<string, number>
  initialHp?: number
  initialMaxHp?: number
}

export function CharacterCreator({
  scenarioId, scenarioTitle, scenarioDescription = '', scenarioSystemPrompt = '',
  initialAttributes,
  initialHp = 100, initialMaxHp = 100,
}: CharacterCreatorProps) {
  const router = useRouter()

  // 检测流派
  const genre = useMemo(() =>
    detectGenre(scenarioTitle, scenarioDescription, scenarioSystemPrompt),
    [scenarioTitle, scenarioDescription, scenarioSystemPrompt]
  )
  const config = GENRE_CONFIGS[genre] || GENRE_CONFIGS['其他']

  // 如果场景已有预设属性，用场景的；否则用流派默认
  const baseAttributes = useMemo(() => {
    const keys = Object.keys(initialAttributes)
    if (keys.length > 0) {
      return config.attributes.filter(a => keys.includes(a.id))
    }
    return config.attributes
  }, [initialAttributes, config.attributes])

  const [step, setStep] = useState(0)
  const [playerName, setPlayerName] = useState('')
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string[]>>({})
  const [allocatedPoints, setAllocatedPoints] = useState<Record<string, number>>(
    Object.fromEntries(baseAttributes.map(a => [a.id, 0]))
  )
  const [remainingPoints, setRemainingPoints] = useState(20)
  const [creating, setCreating] = useState(false)

  const totalSteps = 3 + (config.specialChoices.length > 0 ? 1 : 0) // 命名 + (特殊) + 属性 + 确认
  const stepTitles = ['命名', ...config.specialChoices.map(s => s.label), '属性', '确认']

  // ─── 特殊选择 ───
  function toggleChoice(type: string, optionId: string) {
    setSelectedChoices(prev => {
      const current = prev[type] || []
      const choiceDef = config.specialChoices.find(s => s.type === type)
      if (!choiceDef) return prev

      if (current.includes(optionId)) {
        return { ...prev, [type]: current.filter(id => id !== optionId) }
      }
      if (current.length >= choiceDef.maxSelections) return prev
      return { ...prev, [type]: [...current, optionId] }
    })
  }

  function getChoiceBonuses(): Record<string, number> {
    const bonus: Record<string, number> = {}
    for (const [type, ids] of Object.entries(selectedChoices)) {
      const choiceDef = config.specialChoices.find(s => s.type === type)
      if (!choiceDef) continue
      for (const id of ids) {
        const opt = choiceDef.options.find(o => o.id === id)
        if (!opt) continue
        for (const [attr, val] of Object.entries(opt.bonuses)) {
          bonus[attr] = (bonus[attr] || 0) + val
        }
      }
    }
    return bonus
  }

  const choiceBonuses = getChoiceBonuses()
  const choiceLabel = config.specialChoices.map(s => {
    const selected = selectedChoices[s.type] || []
    return selected.map(id => s.options.find(o => o.id === id)?.name).filter(Boolean).join('、')
  }).filter(Boolean).join(' · ')

  // ─── 属性分配 ───
  function adjustAttribute(attr: string, delta: number) {
    const current = allocatedPoints[attr] || 0
    if (delta > 0 && remainingPoints < delta) return
    if (current + delta < 0) return
    setAllocatedPoints(prev => ({ ...prev, [attr]: current + delta }))
    setRemainingPoints(prev => prev - delta)
  }

  // ─── 最终状态 ───
  function buildFinalState(): GameState {
    // 从 0 开始加点 + 特殊选择加成
    const finalAttrs: Record<string, number> = { ...initialAttributes }

    for (const [attr, val] of Object.entries(allocatedPoints)) {
      finalAttrs[attr] = (finalAttrs[attr] || 0) + (val || 0)
    }
    for (const [attr, val] of Object.entries(choiceBonuses)) {
      finalAttrs[attr] = (finalAttrs[attr] || 0) + val
    }

    const hp = initialHp || config.defaultHp
    const maxHp = initialMaxHp || config.defaultHp

    return {
      hp, maxHp,
      playerName: playerName.trim() || config.presetNames[0],
      spiritRoot: choiceLabel || config.label,
      realm: config.realmValue,
      exp: 0, maxExp: 100,
      attributes: finalAttrs,
      inventory: [], flags: {}, location: '起点',
      gamePhase: '开场', turn: 0,
    }
  }

  async function handleCreate() {
    setCreating(true)
    try {
      const finalState = buildFinalState()
      const res = await apiFetch('/api/game/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId, state: finalState, history: [], turnCount: 0 }),
      })
      const data = await res.json()
      if (data.save?.id) {
        toast.success('角色创建成功，开始冒险！')
        router.push(`/game/${data.save.id}`)
      } else {
        toast.error('创建游戏失败', { description: data.error || '未知服务器错误' })
      }
    } catch { toast.error('保存失败', { description: '请检查 Supabase 数据库表结构是否完整' }) }
    setCreating(false)
  }

  function randomName() {
    const names = config.presetNames
    setPlayerName(names[Math.floor(Math.random() * names.length)])
  }

  function canProceed(): boolean {
    switch (step) {
      case 0: return playerName.trim().length >= 1
      case 1: return config.specialChoices.length === 0 || Object.values(selectedChoices).some(v => v.length > 0)
      case 2: return true
      case 3: return true
      default: return false
    }
  }

  // 当前步骤属于哪个阶段
  const currentStepIndex = step
  const stepIdx = step

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#070b14', color: '#f3f6ff' }}>
      {/* Header */}
      <header className="border-b px-4 h-14 flex items-center gap-3" style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.06)' }}>
        <button onClick={() => stepIdx === 0 ? router.push('/game') : setStep(stepIdx - 1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: '#94a3b8' }}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="text-xs" style={{ color: '#64748b' }}>{config.icon} {config.label} · {scenarioTitle}</div>
          <div className="text-sm font-medium">{stepTitles[stepIdx]}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={cn('w-2 h-2 rounded-full transition-all', i <= stepIdx ? 'w-6' : '')}
              style={{ backgroundColor: i <= stepIdx ? '#14f1c6' : '#2a3b57', boxShadow: i <= stepIdx ? '0 0 8px rgba(20,241,198,0.4)' : 'none' }}
            />
          ))}
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {/* Step 0: 命名 */}
          {stepIdx === 0 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center">
                <div className="text-5xl mb-4">{config.icon}</div>
                <h2 className="text-2xl font-bold">{config.title}</h2>
                <p className="text-sm mt-2" style={{ color: '#94a3b8' }}>{config.subtitle}</p>
              </div>
              <div className="relative">
                <input value={playerName} onChange={e => setPlayerName(e.target.value)}
                  placeholder="输入你的名字..." maxLength={12}
                  className="w-full text-center text-2xl py-4 rounded-xl outline-none border transition-all"
                  style={{ backgroundColor: '#172033', borderColor: playerName ? '#14f1c6' : '#2a3b57', color: '#f3f6ff', boxShadow: playerName ? '0 0 20px rgba(20,241,198,0.1)' : 'none' }}
                  autoFocus
                />
                <button onClick={randomName}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                  style={{ color: '#94a3b8' }}>
                  <Shuffle className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {config.presetNames.slice(0, 8).map(n => (
                  <button key={n} onClick={() => setPlayerName(n)}
                    className="px-3 py-1.5 rounded-lg text-sm transition-all"
                    style={{
                      backgroundColor: playerName === n ? 'rgba(20,241,198,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${playerName === n ? 'rgba(20,241,198,0.3)' : 'rgba(255,255,255,0.06)'}`,
                      color: playerName === n ? '#14f1c6' : '#94a3b8',
                    }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1-n: 特殊选择（灵根/职业/种族等） */}
          {stepIdx >= 1 && stepIdx <= config.specialChoices.length && (
            <div className="space-y-5 animate-in fade-in duration-300">
              {(() => {
                const choiceIdx = stepIdx - 1
                const choiceDef = config.specialChoices[choiceIdx]
                if (!choiceDef) return null
                const selected = selectedChoices[choiceDef.type] || []
                return (
                  <>
                    <div className="text-center">
                      <h2 className="text-2xl font-bold">{choiceDef.label}</h2>
                      <p className="text-sm mt-2" style={{ color: '#94a3b8' }}>
                        选择 {choiceDef.maxSelections > 1 ? `1~${choiceDef.maxSelections}` : '1'} 项
                      </p>
                    </div>
                    <div className={cn('text-center text-sm py-2 px-4 rounded-full mx-auto w-fit transition-all', selected.length === 0 ? 'opacity-0' : '')}
                      style={{ backgroundColor: 'rgba(20,241,198,0.1)', border: '1px solid rgba(20,241,198,0.2)', color: '#14f1c6' }}>
                      已选 {selected.length}/{choiceDef.maxSelections}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {choiceDef.options.map(opt => {
                        const sel = selected.includes(opt.id)
                        return (
                          <button key={opt.id} onClick={() => toggleChoice(choiceDef.type, opt.id)}
                            disabled={!sel && selected.length >= choiceDef.maxSelections}
                            className={cn('relative text-left p-4 rounded-xl border transition-all duration-200', sel && 'scale-[1.02]', !sel && selected.length >= choiceDef.maxSelections && 'opacity-30 cursor-not-allowed')}
                            style={{
                              backgroundColor: sel ? 'rgba(20,241,198,0.1)' : 'rgba(255,255,255,0.03)',
                              borderColor: sel ? '#14f1c6' : 'rgba(255,255,255,0.06)',
                              boxShadow: sel ? '0 0 25px rgba(20,241,198,0.2)' : 'none',
                            }}>
                            {sel && (
                              <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#14f1c6' }}>
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg">{opt.emoji}</span>
                              <span className="font-semibold text-sm">{opt.name}</span>
                              {opt.isRare && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(167,139,250,0.2)', color: '#a78bfa' }}>稀有</span>
                              )}
                            </div>
                            <p className="text-xs mb-2" style={{ color: '#94a3b8' }}>{opt.description}</p>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(opt.bonuses).map(([attr, val]) => (
                                <span key={attr} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                                  {attr}+{val}
                                </span>
                              ))}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    {Object.keys(choiceBonuses).length > 0 && (
                      <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(20,241,198,0.05)', border: '1px solid rgba(20,241,198,0.1)' }}>
                        <div className="text-xs mb-2" style={{ color: '#94a3b8' }}>属性加成预览：</div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(choiceBonuses).map(([attr, val]) => (
                            <span key={attr} className="text-sm px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(20,241,198,0.1)', color: '#14f1c6' }}>
                              {attr} +{val}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* Step 属性分配 */}
          {stepIdx === (config.specialChoices.length > 0 ? 1 + config.specialChoices.length : 1) && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="text-center">
                <div className="text-5xl mb-4">📊</div>
                <h2 className="text-2xl font-bold">分配属性</h2>
                <p className="text-sm mt-2" style={{ color: '#94a3b8' }}>自由分配 20 点属性</p>
              </div>
              <div className="text-center">
                <span className="text-3xl font-bold" style={{ color: remainingPoints > 0 ? '#14f1c6' : '#64748b' }}>{remainingPoints}</span>
                <span className="text-sm ml-2" style={{ color: '#64748b' }}>剩余点数</span>
              </div>
              <div className="space-y-3">
                {baseAttributes.map(attr => {
                  const pts = allocatedPoints[attr.id] || 0
                  const bonus = choiceBonuses[attr.id] || 0
                  const total = pts + bonus
                  return (
                    <div key={attr.id} className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span>{attr.icon}</span>
                          <span className="text-sm font-medium">{attr.id}</span>
                          {bonus > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(20,241,198,0.1)', color: '#14f1c6' }}>
                              加成+{bonus}
                            </span>
                          )}
                        </div>
                        <span className="text-lg font-bold" style={{ color: pts > 0 ? '#14f1c6' : '#64748b' }}>
                          {total}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => adjustAttribute(attr.id, -1)} disabled={pts <= 0}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold transition-all disabled:opacity-20"
                          style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>–
                        </button>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                          <div className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (total / 25) * 100)}%`, background: 'linear-gradient(90deg, #14f1c6, #5eead4)', boxShadow: '0 0 8px rgba(20,241,198,0.3)' }}
                          />
                        </div>
                        <button onClick={() => adjustAttribute(attr.id, 1)} disabled={remainingPoints <= 0}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold transition-all disabled:opacity-20"
                          style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>+
                        </button>
                      </div>
                      <div className="text-[10px] mt-1" style={{ color: '#64748b' }}>{attr.description}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 确认 */}
          {stepIdx === totalSteps - 1 && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="text-center">
                <div className="text-5xl mb-4">✨</div>
                <h2 className="text-2xl font-bold">确认角色</h2>
                <p className="text-sm mt-2" style={{ color: '#94a3b8' }}>检查你的角色信息，准备踏入 {scenarioTitle}</p>
              </div>
              <div className="p-5 rounded-xl" style={{ backgroundColor: 'rgba(20,241,198,0.05)', border: '1px solid rgba(20,241,198,0.15)' }}>
                <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: '#94a3b8' }}>姓名</span>
                  <span className="font-bold">{playerName}</span>
                </div>
                {choiceLabel && (
                  <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ color: '#94a3b8' }}>{config.specialChoices.map(s => s.type).join('/')}</span>
                    <span style={{ color: '#14f1c6' }}>{choiceLabel}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: '#94a3b8' }}>{config.realmLabel}</span>
                  <span style={{ color: '#14f1c6' }}>{config.realmValue}</span>
                </div>
                <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: '#94a3b8' }}>流派</span>
                  <span style={{ color: '#94a3b8' }}>{config.icon} {config.label}</span>
                </div>
                <div className="py-2">
                  <div style={{ color: '#94a3b8' }} className="mb-2">属性</div>
                  <div className="grid grid-cols-5 gap-2">
                    {baseAttributes.map(attr => {
                      const total = (allocatedPoints[attr.id] || 0) + (choiceBonuses[attr.id] || 0)
                      return (
                        <div key={attr.id} className="text-center p-2 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                          <div className="text-lg">{attr.icon}</div>
                          <div className="text-[10px]" style={{ color: '#64748b' }}>{attr.id}</div>
                          <div className="text-sm font-bold" style={{ color: '#14f1c6' }}>{total}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t px-4 py-4" style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-lg mx-auto flex gap-3">
          {stepIdx > 0 && (
            <button onClick={() => setStep(stepIdx - 1)}
              className="flex-1 py-3 rounded-xl text-sm font-medium transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
              上一步
            </button>
          )}
          {stepIdx < totalSteps - 1 ? (
            <button onClick={() => setStep(stepIdx + 1)} disabled={!canProceed()}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-30 flex items-center justify-center gap-2"
              style={{ background: canProceed() ? 'linear-gradient(135deg, #14f1c6, #0d9488)' : 'rgba(255,255,255,0.06)', boxShadow: canProceed() ? '0 4px 20px rgba(20,241,198,0.2)' : 'none' }}>
              下一步 <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleCreate} disabled={creating}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-30 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #14f1c6, #0d9488)', boxShadow: '0 4px 20px rgba(20,241,198,0.3)' }}>
              {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> 创建中...</> : <><Sparkles className="w-4 h-4" /> 开始冒险</>}
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
