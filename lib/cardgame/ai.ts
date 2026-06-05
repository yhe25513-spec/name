/**
 * 职业级斗地主AI - 按用户要求格式
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

const RANK_POWER: Record<string, number> = {
  '3': 0, '4': 1, '5': 2, '6': 3, '7': 4, '8': 5, '9': 6, '10': 7, 'J': 8, 'Q': 9, 'K': 10, 'A': 11, '2': 12, 'small_joker': 13, 'big_joker': 14
}

const RANK_NAMES: Record<string, string> = {
  '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10', 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A', '2': '2', 'small_joker': '小王', 'big_joker': '大王'
}

const SUIT_NAMES: Record<string, string> = { spade: '♠', heart: '♥', club: '♣', diamond: '♦', joker: '' }
const CARD_TYPE_NAMES: Record<string, string> = {
  SINGLE: '单张', PAIR: '对子', TRIPLE: '三条', TRIPLE_ONE: '三带一', TRIPLE_TWO: '三带二',
  STRAIGHT: '顺子', STRAIGHT_PAIR: '连对', AIRPLANE: '飞机', BOMB: '炸弹', ROCKET: '王炸',
}

let playedCards: Card[] = []
let playHistory: { player: number, cards: Card[] | null, playerName: string }[] = []

export function resetPlayedCards() { playedCards = []; playHistory = [] }
export function recordPlayedCards(cards: Card[]) { playedCards.push(...cards) }
export function recordPlayHistory(player: number, cards: Card[] | null, playerName: string) {
  playHistory.push({ player, cards, playerName })
}

function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => (RANK_POWER[a.rank] || 0) - (RANK_POWER[b.rank] || 0))
}

function formatHand(hand: Card[]): string {
  return sortHand(hand).map(c => RANK_NAMES[c.rank]).join(',')
}

function analyzeHandStructure(hand: Card[]): string {
  const rankCount: Record<string, number> = {}
  for (const c of hand) rankCount[c.rank] = (rankCount[c.rank] || 0) + 1
  const parts: string[] = []
  for (const [rank, count] of Object.entries(rankCount)) {
    if (count === 4) parts.push(`炸弹${RANK_NAMES[rank]}`)
    else if (count === 3) parts.push(`三条${RANK_NAMES[rank]}`)
    else if (count === 2) parts.push(`对${RANK_NAMES[rank]}`)
  }
  return parts.length > 0 ? parts.join('、') : '无组合'
}

function getRemainingBigCards(): string {
  const maxCounts: Record<string, number> = { '大王': 1, '小王': 1, '2': 4, 'A': 4, 'K': 4 }
  const playedCounts: Record<string, number> = {}
  for (const c of playedCards) {
    const name = RANK_NAMES[c.rank]
    if (maxCounts[name] !== undefined) {
      playedCounts[name] = (playedCounts[name] || 0) + 1
    }
  }
  const result: string[] = []
  for (const rank of ['大王', '小王', '2', 'A', 'K']) {
    const remaining = (maxCounts[rank] || 0) - (playedCounts[rank] || 0)
    result.push(`${rank}${remaining}`)
  }
  return result.join('、')
}

function formatPlayHistory(): string {
  if (playHistory.length === 0) return '暂无'
  const rounds: string[] = []
  let roundNum = 1
  let roundPlays: string[] = []

  for (let i = 0; i < playHistory.length; i++) {
    const h = playHistory[i]
    const role = h.player === 0 ? '我' : (h.player === findLandlordIdx() ? '上家' : '下家')
    if (h.cards) {
      roundPlays.push(`${role}出${formatHand(h.cards)}`)
    } else {
      roundPlays.push(`${role}过`)
    }

    // 每3手一轮
    if (roundPlays.length === 3 || i === playHistory.length - 1) {
      rounds.push(`第${roundNum}轮：${roundPlays.join('→')}`)
      roundPlays = []
      roundNum++
    }
  }
  return rounds.join('\n')
}

function findLandlordIdx(): number {
  // 从历史推断地主
  return 1
}

function getRoleName(playerIdx: number, isLandlord: boolean, myIdx: number): string {
  if (playerIdx === myIdx) return '我'
  if (isLandlord) return '下家' // 地主的对手
  return playerIdx === (myIdx + 1) % 3 ? '下家' : '上家'
}

function getTeammateName(myIdx: number, isLandlord: boolean): string {
  if (isLandlord) return '无（地主1v2）'
  return myIdx === 0 ? '下家' : '上家'
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
    for (const c of hand) {
      const power = RANK_POWER[c.rank] || 0
      if (power >= 12) score += 8 // 2
      else if (power === 14) score += 12 // 大王
      else if (power === 13) score += 10 // 小王
      else if (power >= 10) score += power - 8 // K, A
      else score += 1
    }
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
            { role: 'system', content: '你是斗地主高手。只返回JSON。' },
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
    const prompt = `斗地主求助，请帮我决策叫分。数据如下：

身份：农民
我的手牌：[${formatHand(hand)}]（已排序）
底牌：无

剩余大牌统计：${getRemainingBigCards()}

手牌数量：我${hand.length}张，上家${handCount[1]}张，下家${handCount[2]}张

请给出叫分建议（0-3分），并说明理由。`

    const result = await this.callAPI(prompt)
    if (result) {
      const match = result.match(/(\d)/)
      if (match) { const bid = parseInt(match[1]); if (bid >= 0 && bid <= 3) return bid }
    }
    return this.localBid(hand)
  }

  private async apiPlay(hand: Card[], mustFollow: PlayHand | null, handCount: number[], isLandlord: boolean, myIdx: number): Promise<Card[] | null> {
    const validPlays = findAllValidPlays(hand, mustFollow)
    if (validPlays.length === 0) return null

    const validStr = validPlays.map((p, i) =>
      `[${i}] ${p.cards.map(c => RANK_NAMES[c.rank]).join('')} (${CARD_TYPE_NAMES[p.type]})`
    ).join('\n')

    // 分析当前桌面
    let tableType = '过牌（暂无）'
    let cardValue = ''
    let playerRole = ''

    if (mustFollow) {
      tableType = CARD_TYPE_NAMES[mustFollow.type] || mustFollow.type
      cardValue = mustFollow.cards.map(c => RANK_NAMES[c.rank]).join('')
      const lastPlayer = playHistory.length > 0 ? playHistory[playHistory.length - 1].player : -1
      playerRole = getRoleName(lastPlayer, isLandlord, myIdx)
    }

    // 计算队友名
    const teammate = isLandlord ? '无（地主1v2）' : (myIdx === 0 ? '下家' : '上家')

    // 计算手牌数量
    const myCount = hand.length
    const upperCount = handCount[(myIdx + 2) % 3]
    const lowerCount = handCount[(myIdx + 1) % 3]

    const prompt = `斗地主求助，请帮我决策出牌。数据如下：

身份：${isLandlord ? '地主' : '农民'}
我的手牌：[${formatHand(hand)}]（已排序）
底牌：${isLandlord ? '有' : '无'}
手牌分析：${analyzeHandStructure(hand)}

当前桌面牌型：${tableType}，牌值：${cardValue || '无'}，由${playerRole || '无'}打出
${mustFollow ? '轮到我出牌：是' : '轮到我出牌：是（首出）'}

剩余大牌统计：${getRemainingBigCards()}

手牌数量：我${myCount}张，上家${upperCount}张，下家${lowerCount}张，队友（${teammate}）${isLandlord ? '无' : (myIdx === 0 ? lowerCount : upperCount) + '张'}

出牌历史：
${formatPlayHistory()}

可选方案：
${validStr}

请给出最优出牌方案，并说明理由（提示：我是${isLandlord ? '地主' : '农民'}，${isLandlord ? '要主动控制局面' : '要配合队友走牌'}）。`

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

  async decidePlay(hand: Card[], mustFollow: PlayHand | null, handCount: number[] = [17, 17, 17], isLandlord = false, myIdx = 0): Promise<Card[] | null> {
    await this.apiReady
    if (this.useAPI) {
      try { return await this.apiPlay(hand, mustFollow, handCount, isLandlord, myIdx) } catch { return this.localPlay(hand, mustFollow) }
    }
    return this.localPlay(hand, mustFollow)
  }
}
