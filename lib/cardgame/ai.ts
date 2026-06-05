/**
 * 职业级斗地主AI - DeepSeek API + 高级策略引擎
 */

import { Card, CardType, classifyHand, findAllValidPlays, getRankPower, PlayHand } from './logic'

// API 配置
const API_URL = 'https://api.deepseek.com/chat/completions'

let cachedApiKey = ''
let cacheTime = 0

async function getApiKey(): Promise<string> {
  if (cachedApiKey && Date.now() - cacheTime < 300000) return cachedApiKey
  try {
    const res = await fetch('/api/admin/cardgame-config')
    const data = await res.json()
    cachedApiKey = data.apiKey || ''
    cacheTime = Date.now()
    return cachedApiKey
  } catch { return '' }
}

const CARD_WEIGHTS: Record<string, number> = {
  '3': 1, '4': 1, '5': 1, '6': 1, '7': 1, '8': 2, '9': 2, '10': 2, 'J': 3, 'Q': 3, 'K': 4, 'A': 5, '2': 8, 'small_joker': 10, 'big_joker': 12,
}

const RANK_NAMES: Record<string, string> = {
  '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10', 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A', '2': '2', 'small_joker': '小王', 'big_joker': '大王',
}

const SUIT_NAMES: Record<string, string> = { spade: '♠', heart: '♥', club: '♣', diamond: '♦', joker: '' }
const CARD_TYPE_NAMES: Record<string, string> = {
  SINGLE: '单张', PAIR: '对子', TRIPLE: '三条', TRIPLE_ONE: '三带一', TRIPLE_TWO: '三带二',
  STRAIGHT: '顺子', STRAIGHT_PAIR: '连对', AIRPLANE: '飞机', BOMB: '炸弹', ROCKET: '火箭',
}

let playedCards: Card[] = []
let playHistory: { player: number, cards: Card[] | null, playerName: string }[] = []

export function resetPlayedCards() { playedCards = []; playHistory = [] }
export function recordPlayedCards(cards: Card[]) { playedCards.push(...cards) }
export function recordPlayHistory(player: number, cards: Card[] | null, playerName: string) {
  playHistory.push({ player, cards, playerName })
  console.log('[出牌历史] 记录:', playerName, cards ? cards.map(c => `${SUIT_NAMES[c.suit]}${RANK_NAMES[c.rank]}`).join(' ') : '不出')
}
export function getPlayHistory() { return playHistory }

function getAllPlayedCards(): string {
  if (playedCards.length === 0) return '暂无出牌记录'
  // 按点数统计
  const counts: Record<string, number> = {}
  for (const c of playedCards) {
    const name = RANK_NAMES[c.rank]
    counts[name] = (counts[name] || 0) + 1
  }
  // 按大小排序显示
  const sorted = Object.entries(counts).sort((a, b) => {
    const order = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','小王','大王']
    return order.indexOf(a[0]) - order.indexOf(b[0])
  })
  return sorted.map(([k, v]) => `${k}×${v}`).join(', ')
}

function getPlayHistoryStr(): string {
  if (playHistory.length === 0) return '暂无出牌记录'
  // 显示所有出牌历史（最多20条）
  return playHistory.slice(-20).map((h, i) => {
    const num = playHistory.length - 20 + i + 1
    if (h.cards) return `${num}. ${h.playerName}: ${h.cards.map(c => `${SUIT_NAMES[c.suit]}${RANK_NAMES[c.rank]}`).join(' ')}`
    return `${num}. ${h.playerName}: 不出`
  }).join('\n')
}

function formatHand(hand: Card[]): string {
  return hand.map(c => `${SUIT_NAMES[c.suit]}${RANK_NAMES[c.rank]}`).join(' ')
}

function analyzeHandStructure(hand: Card[]): string {
  const rankCount: Record<string, number> = {}
  for (const c of hand) rankCount[c.rank] = (rankCount[c.rank] || 0) + 1

  const singles: string[] = [], pairs: string[] = [], triples: string[] = [], quads: string[] = []
  for (const [rank, count] of Object.entries(rankCount)) {
    if (count === 1) singles.push(rank)
    else if (count === 2) pairs.push(rank)
    else if (count === 3) triples.push(rank)
    else if (count === 4) quads.push(rank)
  }

  const parts: string[] = []
  if (singles.length) parts.push(`单张:${singles.join(',')}`)
  if (pairs.length) parts.push(`对子:${pairs.join(',')}`)
  if (triples.length) parts.push(`三条:${triples.join(',')}`)
  if (quads.length) parts.push(`炸弹:${quads.join(',')}`)
  return parts.join(' | ') || '空'
}

export class AIPlayer {
  private useAPI = false
  private apiReady: Promise<boolean>

  constructor() {
    this.apiReady = getApiKey().then(key => {
      this.useAPI = !!key
      console.log('AI初始化:', key ? '✅ 使用DeepSeek API' : '⚠️ 使用本地规则')
      return !!key
    })
  }

  private evaluateHand(hand: Card[]): number {
    let score = 0
    for (const c of hand) score += CARD_WEIGHTS[c.rank] || 0
    const rankCount: Record<string, number> = {}
    for (const c of hand) rankCount[c.rank] = (rankCount[c.rank] || 0) + 1
    for (const count of Object.values(rankCount)) if (count === 4) score += 8
    if (hand.some(c => c.rank === 'big_joker') && hand.some(c => c.rank === 'small_joker')) score += 10
    return Math.min(score, 30)
  }

  private localBid(hand: Card[]): number {
    const score = this.evaluateHand(hand)
    if (score >= 20) return 3
    if (score >= 15) return 2
    if (score >= 10) return 1
    return 0
  }

  private localPlay(hand: Card[], mustFollow: PlayHand | null): Card[] | null {
    const validPlays = findAllValidPlays(hand, mustFollow)
    if (validPlays.length === 0) return null

    // 尝试一次出完
    if (hand.length <= 6) {
      for (const play of validPlays) {
        if (play.cards.length === hand.length) return play.cards
      }
    }

    if (!mustFollow) {
      // 首出：优先出组合牌
      const priorities = [CardType.STRAIGHT, CardType.STRAIGHT_PAIR, CardType.TRIPLE_TWO, CardType.TRIPLE_ONE, CardType.PAIR, CardType.SINGLE]
      for (const type of priorities) {
        const plays = validPlays.filter(p => p.type === type)
        if (plays.length > 0) {
          plays.sort((a, b) => a.mainPower - b.mainPower)
          return plays[0].cards
        }
      }
    } else {
      // 跟牌：出能出最多的组合牌
      const nonBombs = validPlays.filter(p => p.type !== CardType.BOMB && p.type !== CardType.ROCKET)
      if (nonBombs.length > 0) {
        // 按出牌张数排序，优先出多张牌
        nonBombs.sort((a, b) => b.cards.length - a.cards.length || a.mainPower - b.mainPower)
        return nonBombs[0].cards
      }
      // 手牌少时用炸弹
      if (hand.length <= 6) {
        const bombs = validPlays.filter(p => p.type === CardType.BOMB || p.type === CardType.ROCKET)
        if (bombs.length > 0) return bombs[0].cards
      }
    }
    return null
  }

  private async callAPI(prompt: string): Promise<string | null> {
    const apiKey = await getApiKey()
    if (!apiKey) return null

    console.log('AI: 调用DeepSeek API...')
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: `你是世界顶级斗地主AI，拥有职业选手水平。

【核心能力】
1. 精确算牌：记住所有出过的牌，推断对手手牌
2. 概率计算：分析各种出牌的胜率
3. 对手建模：预测对手行为
4. 博弈论思维：不完全信息下最优决策

【牌力排序】3<4<5<6<7<8<9<10<J<Q<K<A<2<小王<大王
【牌型】单张/对子/三带/顺子(5+连续)/连对(3+连续对)/飞机/炸弹(4同)/火箭(双王)
【大小】火箭>炸弹>普通牌型

【策略】
地主: 主动控制，先出小牌试探，对手少牌时压制
农民: 配合队友，不抢队友牌，地主少牌时炸弹压制

只返回JSON。` },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 10000,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!response.ok) return null
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content
      console.log('AI: API返回:', content)
      return content || null
    } catch { return null }
  }

  private async apiBid(hand: Card[], handCount: number[]): Promise<number> {
    let strength = 0
    const jokers: string[] = [], bombs: string[] = []
    const rankCount: Record<string, number> = {}
    for (const c of hand) {
      strength += CARD_WEIGHTS[c.rank] || 0
      rankCount[c.rank] = (rankCount[c.rank] || 0) + 1
      if (c.rank === 'big_joker') jokers.push('大王')
      if (c.rank === 'small_joker') jokers.push('小王')
    }
    for (const [rank, count] of Object.entries(rankCount)) if (count === 4) bombs.push(rank)

    const prompt = `【斗地主叫分决策 - 深度分析】

═══ 你的手牌 ═══
${hand.length}张: ${formatHand(hand)}
结构: ${analyzeHandStructure(hand)}
牌力评分: ${strength}分
关键牌: ${jokers.join('+') || '无王'} ${bombs.length ? '炸弹:' + bombs.join(',') : ''}

═══ 已出牌记录 ═══
${getAllPlayedCards()}

═══ 最近出牌历史 ═══
${getPlayHistoryStr()}

═══ 叫分规则 ═══
0分 = 不叫（手牌太弱，无法赢）
1分 = 一般（有潜力但不确定）
2分 = 较强（有大牌/炸弹，胜率较高）
3分 = 很强（有火箭/多个炸弹，几乎必胜）

═══ 策略思考 ═══
1. 手牌有多强？大牌多吗？有王/炸弹吗？
2. 已经出了哪些大牌？对手可能还剩什么？
3. 如果叫了地主，能打过两个农民吗？

返回: {"bid": 0-3}`

    const result = await this.callAPI(prompt)
    if (result) {
      const match = result.match(/"bid"\s*:\s*(\d)/)
      if (match) { const bid = parseInt(match[1]); if (bid >= 0 && bid <= 3) return bid }
    }
    return this.localBid(hand)
  }

  private async apiPlay(hand: Card[], mustFollow: PlayHand | null, handCount: number[], isLandlord: boolean): Promise<Card[] | null> {
    const validPlays = findAllValidPlays(hand, mustFollow)
    if (validPlays.length === 0) return null

    const validStr = validPlays.map((p, i) =>
      `[${i}] ${p.cards.map(c => `${SUIT_NAMES[c.suit]}${RANK_NAMES[c.rank]}`).join(' ')} (${CARD_TYPE_NAMES[p.type]}, ${p.cards.length}张)`
    ).join('\n')

    const handStr = formatHand(hand)
    const handStructure = analyzeHandStructure(hand)

    const prompt = `【斗地主出牌决策 - 职业级分析】

═══ 你的身份 ═══
${isLandlord ? '🔴 地主（1打2，必须赢）' : '🔵 农民（和队友配合打赢地主）'}

═══ 你的手牌 ═══
${hand.length}张: ${handStr}
结构: ${handStructure}

═══ 各玩家手牌数 ═══
${handCount.map((c, i) => `玩家${i}: ${c}张${i === 0 ? ' ← 你' : ''}`).join('\n')}

═══ 已出牌统计 ═══
${getAllPlayedCards()}

═══ 出牌历史 ═══
${getPlayHistoryStr()}

${mustFollow ? `═══ 需要跟牌 ═══
上家出了: ${mustFollow.cards.map(c => `${SUIT_NAMES[c.suit]}${RANK_NAMES[c.rank]}`).join(' ')}
牌型: ${CARD_TYPE_NAMES[mustFollow.type]}` : '═══ 轮到你首出 ═══'}

═══ 可选方案 ═══
${validStr}

═══ 核心策略（必须遵守）═══
【地主策略】
1. 大王/小王/2 是王牌，只在关键时刻使用（对手快赢时或自己能走完时）
2. 先出小牌/对子/顺子试探，保留大牌控制
3. 不要浪费 A、K 压小牌
4. 炸弹留到对手手牌≤3张时使用

【农民策略】
1. 配合队友！如果队友出牌，不要压制队友的牌
2. 地主出小牌时，让队友去顶，你保留实力
3. 地主手牌少时才用炸弹压制
4. 不要抢队友的牌权

【通用规则】
- 大王/小王是最后杀招，绝不要轻易使用
- 顺子/三带优先出，减少手牌数量
- 分析对手剩余牌，预测其手牌结构

返回: {"action": "play", "cards": [序号]} 或 {"action": "pass"}`

    const result = await this.callAPI(prompt)
    if (result) {
      const actionMatch = result.match(/"action"\s*:\s*"(play|pass)"/)
      const indexMatch = result.match(/"index"\s*:\s*(\d+)/)
      const cardsMatch = result.match(/"cards"\s*:\s*\[(\d+)\]/)
      if (actionMatch) {
        if (actionMatch[1] === 'pass') return null
        const idx = indexMatch ? parseInt(indexMatch[1]) : (cardsMatch ? parseInt(cardsMatch[1]) : -1)
        if (idx >= 0 && idx < validPlays.length) return validPlays[idx].cards
      }
    }
    return this.localPlay(hand, mustFollow)
  }

  async decideBid(hand: Card[], handCount: number[] = [17, 17, 17]): Promise<number> {
    await this.apiReady
    if (this.useAPI) {
      try { return await this.apiBid(hand, handCount) } catch { return this.localBid(hand) }
    }
    return this.localBid(hand)
  }

  async decidePlay(hand: Card[], mustFollow: PlayHand | null, handCount: number[] = [17, 17, 17], isLandlord = false): Promise<Card[] | null> {
    await this.apiReady
    if (this.useAPI) {
      try { return await this.apiPlay(hand, mustFollow, handCount, isLandlord) } catch { return this.localPlay(hand, mustFollow) }
    }
    return this.localPlay(hand, mustFollow)
  }
}
