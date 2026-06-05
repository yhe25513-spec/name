/**
 * 职业级斗地主AI - 精简版
 */

import { Card, CardType, classifyHand, findAllValidPlays, getRankPower, PlayHand } from './logic'

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
}

function formatHand(hand: Card[]): string {
  return sortHand(hand).map(c => `${SUIT_NAMES[c.suit]}${RANK_NAMES[c.rank]}`).join(' ')
}

function sortHand(hand: Card[]): Card[] {
  const order: Record<string, number> = { '3': 0, '4': 1, '5': 2, '6': 3, '7': 4, '8': 5, '9': 6, '10': 7, 'J': 8, 'Q': 9, 'K': 10, 'A': 11, '2': 12, 'small_joker': 13, 'big_joker': 14 }
  return [...hand].sort((a, b) => (order[a.rank] || 0) - (order[b.rank] || 0))
}

function analyzeHandStructure(hand: Card[]): string {
  const rankCount: Record<string, number> = {}
  for (const c of hand) rankCount[c.rank] = (rankCount[c.rank] || 0) + 1
  const singles: string[] = [], pairs: string[] = [], triples: string[] = [], quads: string[] = []
  for (const [rank, count] of Object.entries(rankCount)) {
    if (count === 1) singles.push(RANK_NAMES[rank])
    else if (count === 2) pairs.push(RANK_NAMES[rank])
    else if (count === 3) triples.push(RANK_NAMES[rank])
    else if (count === 4) quads.push(RANK_NAMES[rank])
  }
  const parts: string[] = []
  if (singles.length) parts.push(`单:${singles.join(',')}`)
  if (pairs.length) parts.push(`对:${pairs.join(',')}`)
  if (triples.length) parts.push(`三条:${triples.join(',')}`)
  if (quads.length) parts.push(`炸弹:${quads.join(',')}`)
  return parts.join(' | ')
}

function getRemainingBigCards(hand: Card[]): string {
  const suits: Array<'spade' | 'heart' | 'club' | 'diamond'> = ['spade', 'heart', 'club', 'diamond']
  const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']
  const allCards: Card[] = []
  for (const suit of suits) for (const rank of ranks) allCards.push({ suit, rank })
  allCards.push({ suit: 'joker', rank: 'small_joker' })
  allCards.push({ suit: 'joker', rank: 'big_joker' })

  const playedCounts: Record<string, number> = {}
  for (const c of playedCards) playedCounts[c.rank] = (playedCounts[c.rank] || 0) + 1

  const handCounts: Record<string, number> = {}
  for (const c of hand) handCounts[c.rank] = (handCounts[c.rank] || 0) + 1

  const maxCounts: Record<string, number> = { '大王': 1, '小王': 1, '2': 4, 'A': 4, 'K': 4 }
  const result: string[] = []
  for (const rank of ['大王', '小王', '2', 'A', 'K']) {
    const max = maxCounts[rank] || 0
    const played = playedCounts[rank] || 0
    const inHand = handCounts[rank] || 0
    const remaining = max - played - inHand
    if (remaining > 0) result.push(`${rank}×${remaining}`)
  }
  return result.length > 0 ? result.join(' ') : '无'
}

function getRecentHistory(): string {
  return playHistory.slice(-5).map(h => {
    if (h.cards) return `${h.playerName}:${h.cards.map(c => `${SUIT_NAMES[c.suit]}${RANK_NAMES[c.rank]}`).join(' ')}`
    return `${h.playerName}:不出`
  }).join(' | ')
}

function analyzeAllPlayedCards(): string {
  if (playedCards.length === 0) return '暂无'
  const counts: Record<string, number> = {}
  for (const c of playedCards) counts[RANK_NAMES[c.rank]] = (counts[RANK_NAMES[c.rank]] || 0) + 1
  return Object.entries(counts).map(([k, v]) => `${k}×${v}`).join(' ')
}

export class AIPlayer {
  private useAPI = false
  private apiReady: Promise<boolean>

  constructor() {
    this.apiReady = getApiKey().then(key => {
      this.useAPI = !!key
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

    if (hand.length <= 6) {
      for (const play of validPlays) {
        if (play.cards.length === hand.length) return play.cards
      }
    }

    if (!mustFollow) {
      const priorities = [CardType.STRAIGHT, CardType.STRAIGHT_PAIR, CardType.TRIPLE_TWO, CardType.TRIPLE_ONE, CardType.PAIR, CardType.SINGLE]
      for (const type of priorities) {
        const plays = validPlays.filter(p => p.type === type)
        if (plays.length > 0) {
          plays.sort((a, b) => a.mainPower - b.mainPower)
          return plays[0].cards
        }
      }
    } else {
      const nonBombs = validPlays.filter(p => p.type !== CardType.BOMB && p.type !== CardType.ROCKET)
      if (nonBombs.length > 0) {
        nonBombs.sort((a, b) => b.cards.length - a.cards.length || a.mainPower - b.mainPower)
        return nonBombs[0].cards
      }
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

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: '你是斗地主高手。规则: 火箭>炸弹>普通牌型，3<4<...<K<A<2<小王<大王。只返回JSON。' },
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
      return data.choices?.[0]?.message?.content || null
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

    const prompt = `【叫分】
手牌(${hand.length}张): ${formatHand(hand)}
结构: ${analyzeHandStructure(hand)}
牌力: ${strength}分
关键: ${jokers.join('+') || '无王'} ${bombs.length ? '炸弹:' + bombs.join(',') : ''}
已出: ${analyzeAllPlayedCards()}
对手: ${handCount.join(',')}张

叫分0-3，手牌强叫高分。返回: {"bid": 数字}`

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
      `[${i}] ${p.cards.map(c => `${SUIT_NAMES[c.suit]}${RANK_NAMES[c.rank]}`).join(' ')} (${CARD_TYPE_NAMES[p.type]})`
    ).join('\n')

    // 确定上家身份
    let lastPlayerInfo = ''
    if (mustFollow && playHistory.length > 0) {
      const last = playHistory[playHistory.length - 1]
      if (last) {
        const role = last.player === 0 ? '你' : (last.player === findLandlordIndex() ? '地主' : '农民')
        lastPlayerInfo = `上家是${role}`
      }
    }

    const prompt = `【出牌决策】
身份: ${isLandlord ? '地主(1v2)' : '农民(配合队友)'}
手牌(${hand.length}张): ${formatHand(hand)}
结构: ${analyzeHandStructure(hand)}
剩余大牌: ${getRemainingBigCards(hand)}
对手: ${handCount.map((c, i) => `P${i}:${c}张`).join(', ')}
${mustFollow ? `跟牌: ${mustFollow.cards.map(c => `${SUIT_NAMES[c.suit]}${RANK_NAMES[c.rank]}`).join(' ')} (${CARD_TYPE_NAMES[mustFollow.type]})${lastPlayerInfo}` : '首出'}
已出: ${analyzeAllPlayedCards()}
历史: ${getRecentHistory()}
可选: ${validStr}

【关键规则】
1. 队友出的牌不要压，让队友走
2. 大王/小王只在对手≤5张或自己能走完时用
3. 能一波走完就直接出
4. 没把握就不出

返回: {"action":"play","cards":[序号]} 或 {"action":"pass"}`

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

function findLandlordIndex(): number {
  const last3 = playHistory.slice(-20)
  // 简单判断：手牌最多的是地主（不准确，但作为fallback）
  return 1
}
