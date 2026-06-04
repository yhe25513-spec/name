/**
 * 斗地主 AI - 基于规则的智能出牌
 */

import { Card, CardType, classifyHand, findAllValidPlays, getRankPower, PlayHand } from './logic'

// 牌力权重
const CARD_WEIGHTS: Record<string, number> = {
  '3': 1, '4': 1, '5': 1, '6': 1, '7': 1,
  '8': 2, '9': 2, '10': 2, 'J': 3, 'Q': 3,
  'K': 4, 'A': 5, '2': 8, 'small_joker': 10, 'big_joker': 12,
}

export class AIPlayer {
  // 评估手牌强度
  private evaluateHand(hand: Card[]): number {
    let score = 0
    const rankCount = new Map<string, number>()

    for (const card of hand) {
      score += CARD_WEIGHTS[card.rank] || 0
      rankCount.set(card.rank, (rankCount.get(card.rank) || 0) + 1)
    }

    // 炸弹加分
    for (const count of rankCount.values()) {
      if (count === 4) score += 8
    }

    // 大小王
    const hasBig = hand.some(c => c.rank === 'big_joker')
    const hasSmall = hand.some(c => c.rank === 'small_joker')
    if (hasBig && hasSmall) score += 10
    else if (hasBig) score += 6
    else if (hasSmall) score += 4

    return Math.min(score, 30)
  }

  // 决定叫分
  decideBid(hand: Card[]): number {
    const score = this.evaluateHand(hand)

    if (score >= 20) return 3
    if (score >= 15) return 2
    if (score >= 10) return 1
    return 0
  }

  // 决定出牌
  decidePlay(hand: Card[], mustFollow: { cards: Card[], type: string, mainPower?: number } | null): Card[] | null {
    // 转换为 PlayHand 格式
    const previousPlay: PlayHand | null = mustFollow ? {
      cards: mustFollow.cards,
      type: mustFollow.type as CardType,
      mainPower: mustFollow.mainPower || 0,
    } : null

    const validPlays = findAllValidPlays(hand, previousPlay)

    if (validPlays.length === 0) return null

    // 如果手牌很少，尝试一次出完
    if (hand.length <= 3) {
      for (const play of validPlays) {
        if (play.cards.length === hand.length) {
          return play.cards
        }
      }
    }

    // 首出策略
    if (!previousPlay) {
      return this.leadPlay(validPlays, hand.length)
    }

    // 跟牌策略
    return this.followPlay(validPlays, previousPlay, hand.length)
  }

  // 首出策略
  private leadPlay(validPlays: PlayHand[], handCount: number): Card[] {
    // 优先出小的单张
    const singles = validPlays
      .filter(p => p.type === CardType.SINGLE)
      .sort((a, b) => a.mainPower - b.mainPower)

    if (singles.length > 0) {
      // 出小牌
      const smallSingle = singles.find(p => p.mainPower <= 4)
      if (smallSingle) return smallSingle.cards
      return singles[0].cards
    }

    // 出对子
    const pairs = validPlays
      .filter(p => p.type === CardType.PAIR)
      .sort((a, b) => a.mainPower - b.mainPower)

    if (pairs.length > 0) {
      const smallPair = pairs.find(p => p.mainPower <= 4)
      if (smallPair) return smallPair.cards
      return pairs[0].cards
    }

    // 出顺子
    const straights = validPlays
      .filter(p => p.type === CardType.STRAIGHT)
      .sort((a, b) => (a.chainLength || 0) - (b.chainLength || 0))

    if (straights.length > 0) {
      return straights[0].cards
    }

    // 出最小的牌
    validPlays.sort((a, b) => a.mainPower - b.mainPower)
    return validPlays[0].cards
  }

  // 跟牌策略
  private followPlay(validPlays: PlayHand[], mustFollow: PlayHand, handCount: number): Card[] | null {
    // 分类
    const nonBombs = validPlays.filter(p =>
      p.type !== CardType.BOMB && p.type !== CardType.ROCKET
    )

    // 手牌少时积极出牌
    if (handCount <= 5 && nonBombs.length > 0) {
      nonBombs.sort((a, b) => a.mainPower - b.mainPower)
      return nonBombs[0].cards
    }

    // 优先用小牌跟
    if (nonBombs.length > 0) {
      nonBombs.sort((a, b) => a.mainPower - b.mainPower)
      const smallPlay = nonBombs.find(p => p.mainPower <= 5)
      if (smallPlay) return smallPlay.cards
      return nonBombs[0].cards
    }

    // 只有炸弹时，手牌很少才用
    if (handCount <= 4) {
      const bombs = validPlays.filter(p => p.type === CardType.BOMB)
      if (bombs.length > 0) {
        bombs.sort((a, b) => a.mainPower - b.mainPower)
        return bombs[0].cards
      }

      const rockets = validPlays.filter(p => p.type === CardType.ROCKET)
      if (rockets.length > 0) {
        return rockets[0].cards
      }
    }

    return null // 过牌
  }
}
