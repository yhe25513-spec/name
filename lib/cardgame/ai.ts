/**
 * 智能斗地主AI - 使用 DeepSeek API + 本地规则引擎
 */

import { Card, CardType, classifyHand, findAllValidPlays, getRankPower, PlayHand } from './logic'

// API 配置
const API_URL = 'https://api.deepseek.com/chat/completions'

// 从服务器获取 API Key（缓存）
let cachedApiKey = ''
let cacheTime = 0

async function getApiKey(): Promise<string> {
  // 缓存5分钟
  if (cachedApiKey && Date.now() - cacheTime < 300000) {
    return cachedApiKey
  }

  try {
    const res = await fetch('/api/admin/cardgame-config')
    const data = await res.json()
    cachedApiKey = data.apiKey || ''
    cacheTime = Date.now()
    return cachedApiKey
  } catch {
    return ''
  }
}

// 牌力权重
const CARD_WEIGHTS: Record<string, number> = {
  '3': 1, '4': 1, '5': 1, '6': 1, '7': 1,
  '8': 2, '9': 2, '10': 2, 'J': 3, 'Q': 3,
  'K': 4, 'A': 5, '2': 8, 'small_joker': 10, 'big_joker': 12,
}

// 牌名映射
const RANK_NAMES: Record<string, string> = {
  '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
  '8': '8', '9': '9', '10': '10', 'J': 'J', 'Q': 'Q',
  'K': 'K', 'A': 'A', '2': '2', 'small_joker': '小王', 'big_joker': '大王',
}

const SUIT_NAMES: Record<string, string> = {
  spade: '♠', heart: '♥', club: '♣', diamond: '♦', joker: '',
}

const CARD_TYPE_NAMES: Record<string, string> = {
  SINGLE: '单张', PAIR: '对子', TRIPLE: '三条',
  TRIPLE_ONE: '三带一', TRIPLE_TWO: '三带二', STRAIGHT: '顺子',
  STRAIGHT_PAIR: '连对', AIRPLANE: '飞机', BOMB: '炸弹', ROCKET: '火箭',
}

// 记录所有出过的牌
let playedCards: Card[] = []

export function resetPlayedCards() {
  playedCards = []
}

export function recordPlayedCards(cards: Card[]) {
  playedCards.push(...cards)
}

// 获取剩余牌分析
function getRemainingAnalysis(): string {
  // 所有牌
  const allCards: Card[] = []
  const suits: Array<'spade' | 'heart' | 'club' | 'diamond'> = ['spade', 'heart', 'club', 'diamond']
  const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']
  for (const suit of suits) {
    for (const rank of ranks) {
      allCards.push({ suit, rank })
    }
  }
  allCards.push({ suit: 'joker', rank: 'small_joker' })
  allCards.push({ suit: 'joker', rank: 'big_joker' })

  // 计算剩余
  const remaining = allCards.filter(c =>
    !playedCards.some(p => p.suit === c.suit && p.rank === c.rank)
  )

  // 统计大牌
  const bigCards = remaining.filter(c => ['2', 'small_joker', 'big_joker', 'A', 'K'].includes(c.rank))
  const bigCardCounts: Record<string, number> = {}
  for (const c of bigCards) {
    bigCardCounts[c.rank] = (bigCardCounts[c.rank] || 0) + 1
  }

  return `剩余大牌: ${Object.entries(bigCardCounts).map(([k, v]) => `${RANK_NAMES[k]}×${v}`).join(', ') || '无'}`
}

// 格式化手牌
function formatHand(hand: Card[]): string {
  return hand.map(c => `${SUIT_NAMES[c.suit]}${RANK_NAMES[c.rank]}`).join(' ')
}

// 格式化出牌记录
function formatHistory(history: { player: number, cards: Card[] | null, playerName: string }[]): string {
  if (!history || history.length === 0) return '无'
  return history.slice(-8).map(h => {
    if (h.cards) {
      return `${h.playerName}: ${h.cards.map(c => `${SUIT_NAMES[c.suit]}${RANK_NAMES[c.rank]}`).join(' ')}`
    }
    return `${h.playerName}: 不出`
  }).join('\n')
}

export class AIPlayer {
  private useAPI: boolean = false
  private apiReady: Promise<boolean>

  constructor() {
    // 异步检查 API，返回 Promise
    this.apiReady = getApiKey().then(key => {
      this.useAPI = !!key
      console.log('AI初始化:', key ? '✅ 使用DeepSeek API' : '⚠️ 使用本地规则')
      return !!key
    })
  }

  // 等待 API 就绪
  async ensureAPIReady(): Promise<boolean> {
    return this.apiReady
  }

  // 评估手牌强度
  private evaluateHand(hand: Card[]): number {
    let score = 0
    for (const card of hand) {
      score += CARD_WEIGHTS[card.rank] || 0
    }
    return Math.min(score, 30)
  }

  // 本地规则AI叫分
  private localBid(hand: Card[]): number {
    const score = this.evaluateHand(hand)
    if (score >= 20) return 3
    if (score >= 15) return 2
    if (score >= 10) return 1
    return 0
  }

  // 本地规则AI出牌
  private localPlay(hand: Card[], mustFollow: PlayHand | null): Card[] | null {
    const validPlays = findAllValidPlays(hand, mustFollow)
    if (validPlays.length === 0) return null

    // 手牌很少时，尝试一次出完
    if (hand.length <= 5) {
      for (const play of validPlays) {
        if (play.cards.length === hand.length) return play.cards
      }
    }

    // 首出策略
    if (!mustFollow) {
      // 优先出顺子（容易出完）
      const straights = validPlays.filter(p => p.type === CardType.STRAIGHT)
      if (straights.length > 0) {
        straights.sort((a, b) => (a.chainLength || 0) - (b.chainLength || 0))
        return straights[0].cards
      }

      // 出三带
      const triples = validPlays.filter(p => p.type === CardType.TRIPLE_ONE || p.type === CardType.TRIPLE_TWO)
      if (triples.length > 0) {
        triples.sort((a, b) => a.mainPower - b.mainPower)
        return triples[0].cards
      }

      // 出小对子
      const pairs = validPlays.filter(p => p.type === CardType.PAIR).sort((a, b) => a.mainPower - b.mainPower)
      if (pairs.length > 0) {
        const smallPair = pairs.find(p => p.mainPower <= 5)
        if (smallPair) return smallPair.cards
        return pairs[0].cards
      }

      // 出小单张
      const singles = validPlays.filter(p => p.type === CardType.SINGLE).sort((a, b) => a.mainPower - b.mainPower)
      if (singles.length > 0) {
        const smallSingle = singles.find(p => p.mainPower <= 3)
        if (smallSingle) return smallSingle.cards
        return singles[0].cards
      }

      validPlays.sort((a, b) => a.mainPower - b.mainPower)
      return validPlays[0].cards
    }

    // 跟牌策略
    const nonBombs = validPlays.filter(p => p.type !== CardType.BOMB && p.type !== CardType.ROCKET)

    if (nonBombs.length > 0) {
      nonBombs.sort((a, b) => a.mainPower - b.mainPower)

      // 手牌多时出小牌，手牌少时出大牌控牌
      if (hand.length > 8) {
        // 出最小能打过的牌
        return nonBombs[0].cards
      } else {
        // 出中等大小的牌
        const midPlay = nonBombs.find(p => p.mainPower >= 5 && p.mainPower <= 10)
        if (midPlay) return midPlay.cards
        return nonBombs[0].cards
      }
    }

    // 只剩炸弹/火箭
    if (hand.length <= 5) {
      const bombs = validPlays.filter(p => p.type === CardType.BOMB)
      if (bombs.length > 0) {
        bombs.sort((a, b) => a.mainPower - b.mainPower)
        return bombs[0].cards
      }
      const rockets = validPlays.filter(p => p.type === CardType.ROCKET)
      if (rockets.length > 0) return rockets[0].cards
    }

    return null // 过牌
  }

  // 调用 DeepSeek API
  private async callAPI(prompt: string): Promise<string | null> {
    const apiKey = await getApiKey()
    if (!apiKey) {
      console.log('AI: 无API Key，使用本地规则')
      return null
    }

    console.log('AI: 调用DeepSeek API...')
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000) // 15秒超时

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `你是世界顶级斗地主AI玩家，拥有职业选手水平。你精通以下技能：

【核心能力】
1. 精确算牌：记住所有出过的牌，精确推断每个对手的手牌组成
2. 概率计算：计算各种出牌组合的胜率，选择期望值最高的打法
3. 对手建模：分析对手的出牌风格，预测其后续行为
4. 博弈论思维：在不完全信息下做出最优决策

【斗地主规则】
- 牌力排序: 3<4<5<6<7<8<9<10<J<Q<K<A<2<小王<大王
- 牌型: 单张/对子/三带/顺子(5+连续)/连对(3+连续对)/飞机/炸弹(4同)/火箭(双王)
- 炸弹>普通牌型，火箭>一切

【策略原则】
地主:
- 开局出小牌试探，保留大牌控制
- 对手手牌少于5张时必须压制
- 炸弹用在关键时刻（对手快赢时）
- 顺子/三带优先出，减少手牌数量

农民:
- 配合队友，帮队友出完牌
- 不要抢队友的牌
- 地主手牌少时用炸弹压制
- 用小牌消耗地主的大牌

【思维链推理】
请按以下步骤思考:
1. 分析当前局势（谁领先、剩余牌数）
2. 评估各种出牌选择的后果
3. 预测对手的反应
4. 选择最优策略

只返回JSON格式，不要其他内容。`
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 500, // 增加token让AI充分思考
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        console.log('AI: API响应错误:', response.status)
        return null
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content
      console.log('AI: API返回:', content)
      return content || null
    } catch (e) {
      console.log('AI: API调用失败，使用本地规则')
      return null
    }
  }

  // API叫分
  private async apiBid(hand: Card[], handCount: number[]): Promise<number> {
    // 分析手牌
    const rankCount: Record<string, number> = {}
    for (const c of hand) {
      rankCount[RANK_NAMES[c.rank]] = (rankCount[RANK_NAMES[c.rank]] || 0) + 1
    }

    // 计算牌力
    let strength = 0
    const bombs: string[] = []
    const jokers: string[] = []
    for (const c of hand) {
      strength += CARD_WEIGHTS[c.rank] || 0
      if (c.rank === 'big_joker') jokers.push('大王')
      if (c.rank === 'small_joker') jokers.push('小王')
    }
    for (const [rank, count] of Object.entries(rankCount)) {
      if (count === 4) bombs.push(rank)
    }

    const prompt = `【斗地主叫分决策】

═══ 手牌分析 ═══
手牌(${hand.length}张): ${formatHand(hand)}
手牌结构: ${Object.entries(rankCount).map(([r, c]) => `${r}×${c}`).join(', ')}
牌力评分: ${strength}分

关键牌: ${jokers.length > 0 ? jokers.join('+') : '无王'} ${bombs.length > 0 ? '炸弹:' + bombs.join(',') : ''}
剩余大牌: ${getRemainingAnalysis()}

═══ 叫分规则 ═══
0分 = 不叫（手牌太弱）
1分 = 一般（有潜力）
2分 = 较强（有大牌/炸弹）
3分 = 很强（有火箭/多个炸弹/绝对优势）

═══ 策略思考 ═══
1. 评估手牌: 大牌数量？炸弹/火箭？
2. 预估胜率: 这手牌能打赢吗？
3. 风险评估: 叫高分输的代价大

请分析后返回JSON:
{"bid": 0-3, "reason": "简短理由"}`

    console.log('[AI] apiBid 开始调用API')
    const result = await this.callAPI(prompt)
    console.log('[AI] apiBid API返回:', result)

    if (result) {
      try {
        const match = result.match(/\{[^}]*"bid"\s*:\s*(\d)[^}]*\}/)
        if (match) {
          const bid = parseInt(match[1])
          console.log('[AI] apiBid 解析结果:', bid)
          if (bid >= 0 && bid <= 3) return bid
        }
      } catch (e) {
        console.log('[AI] apiBid 解析失败:', e)
      }
    }
    console.log('[AI] apiBid 使用本地规则')
    return this.localBid(hand)
  }

  // API出牌
  private async apiPlay(
    hand: Card[],
    mustFollow: PlayHand | null,
    handCount: number[],
    isLandlord: boolean,
    playerName: string,
    history: { player: number, cards: Card[] | null, playerName: string }[]
  ): Promise<Card[] | null> {
    const validPlays = findAllValidPlays(hand, mustFollow)
    if (validPlays.length === 0) return null

    const validStr = validPlays.map((p, i) =>
      `[${i}] ${p.cards.map(c => `${SUIT_NAMES[c.suit]}${RANK_NAMES[c.rank]}`).join(' ')} (${CARD_TYPE_NAMES[p.type]}, 权重${p.mainPower})`
    ).join('\n')

    // 分析手牌结构
    const rankCount: Record<string, number> = {}
    for (const c of hand) {
      rankCount[RANK_NAMES[c.rank]] = (rankCount[RANK_NAMES[c.rank]] || 0) + 1
    }
    const handAnalysis = Object.entries(rankCount)
      .map(([rank, count]) => `${rank}×${count}`)
      .join(', ')

    // 计算手牌强度
    let handStrength = 0
    for (const c of hand) {
      handStrength += CARD_WEIGHTS[c.rank] || 0
    }

    const prompt = `【斗地主高手决策】

═══ 局势分析 ═══
身份: ${isLandlord ? '🔴 地主（1v2）' : '🔵 农民（队友配合）'}
手牌: ${hand.length}张 | 强度: ${handStrength}分
手牌结构: ${handAnalysis}

对手剩余: ${handCount.map((c, i) => `P${i}:${c}张`).join(' | ')}
剩余大牌: ${getRemainingAnalysis()}

${mustFollow ? `═══ 上家出牌 ═══
${mustFollow.cards.map(c => `${SUIT_NAMES[c.suit]}${RANK_NAMES[c.rank]}`).join(' ')} (${CARD_TYPE_NAMES[mustFollow.type]})

你必须出同类型更大的牌，或用炸弹/火箭压制` : '═══ 首出 ═══你可以出任意合法牌型，选择最优开牌'}

═══ 可选出牌 ═══
${validStr}

═══ 策略思考 ═══
1. 分析当前局势: 谁领先？谁手牌少？
2. 评估每个选择: 出完后手牌变化？对手反应？
3. 预测对手: 对手可能出什么？如何应对？
4. 选择最优: 哪个选择胜率最高？

请分析后返回JSON:
{"action": "play", "index": 序号, "reason": "简短理由"}
或 {"action": "pass", "reason": "简短理由"}`

    const result = await this.callAPI(prompt)
    if (result) {
      try {
        const actionMatch = result.match(/"action"\s*:\s*"(play|pass)"/)
        const indexMatch = result.match(/"index"\s*:\s*(\d+)/)
        if (actionMatch && indexMatch) {
          const action = actionMatch[1]
          const index = parseInt(indexMatch[1])
          if (action === 'pass') return null
          if (action === 'play' && index >= 0 && index < validPlays.length) {
            return validPlays[index].cards
          }
        }
      } catch {}
    }
    return this.localPlay(hand, mustFollow)
  }

  // 叫分
  async decideBid(hand: Card[], handCount: number[] = [17, 17, 17]): Promise<number> {
    // 等待 API 就绪
    await this.apiReady
    console.log('[AI] decideBid - useAPI:', this.useAPI, '手牌数:', hand.length)

    if (this.useAPI) {
      try {
        console.log('[AI] 调用 apiBid...')
        const result = await this.apiBid(hand, handCount)
        console.log('[AI] apiBid 结果:', result)
        return result
      } catch (e) {
        console.error('[AI] API叫分失败:', e)
        return this.localBid(hand)
      }
    }
    console.log('[AI] 使用本地规则叫分')
    return this.localBid(hand)
  }

  // 出牌
  async decidePlay(
    hand: Card[],
    mustFollow: PlayHand | null,
    handCount: number[] = [17, 17, 17],
    isLandlord: boolean = false,
    playerName: string = 'AI',
    history: { player: number, cards: Card[] | null, playerName: string }[] = []
  ): Promise<Card[] | null> {
    // 等待 API 就绪
    await this.apiReady

    if (this.useAPI) {
      try {
        return await this.apiPlay(hand, mustFollow, handCount, isLandlord, playerName, history)
      } catch (e) {
        console.error('API出牌失败:', e)
        return this.localPlay(hand, mustFollow)
      }
    }
    return this.localPlay(hand, mustFollow)
  }
}
