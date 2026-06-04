/**
 * 智能斗地主AI - 使用 DeepSeek API + 本地规则引擎
 */

import { Card, CardType, classifyHand, findAllValidPlays, getRankPower, PlayHand } from './logic'

// API 配置
const API_URL = 'https://api.deepseek.com/chat/completions'
const API_KEY = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || ''

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
  private useAPI: boolean

  constructor() {
    this.useAPI = !!API_KEY
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

    if (hand.length <= 3) {
      for (const play of validPlays) {
        if (play.cards.length === hand.length) return play.cards
      }
    }

    if (!mustFollow) {
      // 首出：出小牌
      const singles = validPlays.filter(p => p.type === CardType.SINGLE).sort((a, b) => a.mainPower - b.mainPower)
      if (singles.length > 0) {
        const small = singles.find(p => p.mainPower <= 4)
        return small ? small.cards : singles[0].cards
      }
      const pairs = validPlays.filter(p => p.type === CardType.PAIR).sort((a, b) => a.mainPower - b.mainPower)
      if (pairs.length > 0) return pairs[0].cards
      validPlays.sort((a, b) => a.mainPower - b.mainPower)
      return validPlays[0].cards
    }

    // 跟牌
    const nonBombs = validPlays.filter(p => p.type !== CardType.BOMB && p.type !== CardType.ROCKET)
    if (nonBombs.length > 0) {
      nonBombs.sort((a, b) => a.mainPower - b.mainPower)
      const small = nonBombs.find(p => p.mainPower <= 5)
      return small ? small.cards : nonBombs[0].cards
    }

    if (hand.length <= 4) {
      const bombs = validPlays.filter(p => p.type === CardType.BOMB)
      if (bombs.length > 0) return bombs[0].cards
      const rockets = validPlays.filter(p => p.type === CardType.ROCKET)
      if (rockets.length > 0) return rockets[0].cards
    }

    return null
  }

  // 调用 DeepSeek API
  private async callAPI(prompt: string): Promise<string | null> {
    if (!this.useAPI) return null

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: '你是专业斗地主AI。只返回JSON，不要其他内容。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 200,
        }),
      })

      const data = await response.json()
      return data.choices?.[0]?.message?.content || null
    } catch (error) {
      console.error('API调用失败:', error)
      return null
    }
  }

  // API叫分
  private async apiBid(hand: Card[], handCount: number[]): Promise<number> {
    const prompt = `斗地主叫分决策。
手牌: ${formatHand(hand)}
各玩家手牌数: ${handCount.join(', ')}
${getRemainingAnalysis()}

根据手牌强度叫分(0-3)。有王/炸弹/2多叫高分。
返回JSON: {"bid": 数字}`

    const result = await this.callAPI(prompt)
    if (result) {
      try {
        const match = result.match(/\{[^}]*"bid"\s*:\s*(\d)[^}]*\}/)
        if (match) {
          const bid = parseInt(match[1])
          if (bid >= 0 && bid <= 3) return bid
        }
      } catch {}
    }
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
    const validStr = validPlays.map(p =>
      `[${p.cards.map(c => `${SUIT_NAMES[c.suit]}${RANK_NAMES[c.rank]}`).join(' ')}] ${CARD_TYPE_NAMES[p.type] || p.type}`
    ).join('\n')

    const prompt = `斗地主出牌决策。
身份: ${isLandlord ? '地主' : '农民'}
手牌(${hand.length}张): ${formatHand(hand)}
各玩家手牌数: ${handCount.join(', ')}
${getRemainingAnalysis()}
最近出牌:\n${formatHistory(history)}
${mustFollow ? `需要跟: ${mustFollow.cards.map(c => `${SUIT_NAMES[c.suit]}${RANK_NAMES[c.rank]}`).join(' ')} (${CARD_TYPE_NAMES[mustFollow.type]})` : '首出，任意出'}
可选出牌:\n${validStr || '无'}

选择最佳出牌或不出。返回JSON: {"action": "play"/"pass", "index": 数字(从0开始)}`

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
    if (this.useAPI) {
      try {
        return await this.apiBid(hand, handCount)
      } catch {
        return this.localBid(hand)
      }
    }
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
    if (this.useAPI) {
      try {
        return await this.apiPlay(hand, mustFollow, handCount, isLandlord, playerName, history)
      } catch {
        return this.localPlay(hand, mustFollow)
      }
    }
    return this.localPlay(hand, mustFollow)
  }
}
