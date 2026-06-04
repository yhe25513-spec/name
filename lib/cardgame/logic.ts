/**
 * 斗地主游戏逻辑 - 纯 TypeScript 实现
 */

// 牌型枚举
export enum CardType {
  SINGLE = 'SINGLE',
  PAIR = 'PAIR',
  TRIPLE = 'TRIPLE',
  TRIPLE_ONE = 'TRIPLE_ONE',
  TRIPLE_TWO = 'TRIPLE_TWO',
  STRAIGHT = 'STRAIGHT',
  STRAIGHT_PAIR = 'STRAIGHT_PAIR',
  AIRPLANE = 'AIRPLANE',
  AIRPLANE_SINGLE = 'AIRPLANE_SINGLE',
  AIRPLANE_PAIR = 'AIRPLANE_PAIR',
  BOMB = 'BOMB',
  ROCKET = 'ROCKET',
}

// 牌
export interface Card {
  suit: 'spade' | 'heart' | 'club' | 'diamond' | 'joker'
  rank: string
}

// 出牌组合
export interface PlayHand {
  cards: Card[]
  type: CardType
  mainPower: number
  chainLength?: number
}

// 点数权重
const RANK_POWER: Record<string, number> = {
  '3': 0, '4': 1, '5': 2, '6': 3, '7': 4,
  '8': 5, '9': 6, '10': 7, 'J': 8, 'Q': 9,
  'K': 10, 'A': 11, '2': 12, 'small_joker': 13, 'big_joker': 14,
}

// 获取点数权重
export function getRankPower(rank: string): number {
  return RANK_POWER[rank] ?? -1
}

// 创建一副牌
export function createDeck(): Card[] {
  const deck: Card[] = []
  const suits: Array<'spade' | 'heart' | 'club' | 'diamond'> = ['spade', 'heart', 'club', 'diamond']
  const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank })
    }
  }

  deck.push({ suit: 'joker', rank: 'small_joker' })
  deck.push({ suit: 'joker', rank: 'big_joker' })

  return deck
}

// 洗牌
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// 发牌
export function dealCards(deck: Card[]): [Card[], Card[], Card[], Card[]] {
  const sorted = [...deck].sort((a, b) => getRankPower(a.rank) - getRankPower(b.rank))
  return [
    sorted.slice(0, 17),
    sorted.slice(17, 34),
    sorted.slice(34, 51),
    sorted.slice(51, 54),
  ]
}

// 统计点数
function countRanks(cards: Card[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const card of cards) {
    const power = getRankPower(card.rank)
    counts.set(power, (counts.get(power) || 0) + 1)
  }
  return counts
}

// 找连续序列
function findConsecutive(powers: number[]): number[] | null {
  if (powers.length < 2) return powers.length ? powers : null

  const valid = powers.filter(p => p <= 11) // 不超过A
  if (valid.length < 2) return null

  for (let i = 0; i < valid.length; i++) {
    const seq = [valid[i]]
    for (let j = i + 1; j < valid.length; j++) {
      if (valid[j] === seq[seq.length - 1] + 1) {
        seq.push(valid[j])
      } else {
        break
      }
    }
    if (seq.length >= 2) return seq
  }
  return null
}

// 判断牌型
export function classifyHand(cards: Card[]): PlayHand | null {
  if (cards.length === 0) return null

  const n = cards.length
  const rankCount = countRanks(cards)
  const powers = Array.from(rankCount.keys()).sort((a, b) => a - b)

  // 火箭
  if (n === 2) {
    const powerSet = new Set(cards.map(c => getRankPower(c.rank)))
    if (powerSet.has(13) && powerSet.has(14)) {
      return { cards, type: CardType.ROCKET, mainPower: 14 }
    }
  }

  // 炸弹
  if (n === 4) {
    for (const [power, count] of rankCount) {
      if (count === 4) {
        return { cards, type: CardType.BOMB, mainPower: power }
      }
    }
  }

  // 单张
  if (n === 1) {
    return { cards, type: CardType.SINGLE, mainPower: getRankPower(cards[0].rank) }
  }

  // 对子
  if (n === 2 && rankCount.size === 1) {
    const power = powers[0]
    if (rankCount.get(power) === 2) {
      return { cards, type: CardType.PAIR, mainPower: power }
    }
  }

  // 三条
  if (n === 3 && rankCount.size === 1) {
    const power = powers[0]
    if (rankCount.get(power) === 3) {
      return { cards, type: CardType.TRIPLE, mainPower: power }
    }
  }

  // 三带一
  if (n === 4 && rankCount.size === 2) {
    for (const [power, count] of rankCount) {
      if (count === 3) {
        return { cards, type: CardType.TRIPLE_ONE, mainPower: power }
      }
    }
  }

  // 三带二
  if (n === 5 && rankCount.size === 2) {
    let triplePower = -1
    let pairPower = -1
    for (const [power, count] of rankCount) {
      if (count === 3) triplePower = power
      else if (count === 2) pairPower = power
    }
    if (triplePower >= 0 && pairPower >= 0) {
      return { cards, type: CardType.TRIPLE_TWO, mainPower: triplePower }
    }
  }

  // 顺子
  if (n >= 5 && Array.from(rankCount.values()).every(c => c === 1)) {
    if (powers[powers.length - 1] <= 11) {
      const expected = Array.from({ length: n }, (_, i) => powers[0] + i)
      if (JSON.stringify(powers) === JSON.stringify(expected)) {
        return { cards, type: CardType.STRAIGHT, mainPower: powers[0], chainLength: n }
      }
    }
  }

  // 连对
  if (n >= 6 && n % 2 === 0 && Array.from(rankCount.values()).every(c => c === 2)) {
    const pairCount = n / 2
    if (powers[powers.length - 1] <= 11) {
      const expected = Array.from({ length: pairCount }, (_, i) => powers[0] + i)
      if (JSON.stringify(powers) === JSON.stringify(expected)) {
        return { cards, type: CardType.STRAIGHT_PAIR, mainPower: powers[0], chainLength: pairCount }
      }
    }
  }

  // 飞机
  const tripleRanks = Array.from(rankCount.entries())
    .filter(([_, count]) => count >= 3)
    .map(([power]) => power)
    .sort((a, b) => a - b)

  if (tripleRanks.length >= 2) {
    const consecutive = findConsecutive(tripleRanks)
    if (consecutive && consecutive.length >= 2) {
      const tripleCount = consecutive.length
      const remaining = n - tripleCount * 3

      if (remaining === 0) {
        return { cards, type: CardType.AIRPLANE, mainPower: consecutive[0], chainLength: tripleCount }
      }
      if (remaining === tripleCount) {
        return { cards, type: CardType.AIRPLANE_SINGLE, mainPower: consecutive[0], chainLength: tripleCount }
      }
      if (remaining === tripleCount * 2) {
        return { cards, type: CardType.AIRPLANE_PAIR, mainPower: consecutive[0], chainLength: tripleCount }
      }
    }
  }

  return null
}

// 判断能否打过
export function canBeat(current: PlayHand, previous: { cards: Card[], type: string, mainPower?: number, chainLength?: number } | null): boolean {
  if (!previous) return true

  // 火箭最大
  if (current.type === CardType.ROCKET) return true
  if (previous.type === CardType.ROCKET) return false

  // 炸弹 vs 非炸弹
  if (current.type === CardType.BOMB && previous.type !== CardType.BOMB) return true
  if (current.type !== CardType.BOMB && previous.type === CardType.BOMB) return false

  // 同类型比较
  if (current.type !== previous.type) return false

  // 顺子/连对/飞机需要长度相同
  if ([CardType.STRAIGHT, CardType.STRAIGHT_PAIR, CardType.AIRPLANE,
       CardType.AIRPLANE_SINGLE, CardType.AIRPLANE_PAIR].includes(current.type as CardType)) {
    if (current.chainLength !== previous.chainLength) return false
  }

  return current.mainPower > (previous.mainPower || 0)
}

// 找所有合法出牌
export function findAllValidPlays(hand: Card[], previous: PlayHand | null): PlayHand[] {
  const validPlays: PlayHand[] = []
  const rankCount = countRanks(hand)

  if (!previous) {
    // 首出：所有合法牌型
    // 单张
    const seen = new Set<number>()
    for (const card of hand) {
      const power = getRankPower(card.rank)
      if (!seen.has(power)) {
        seen.add(power)
        validPlays.push({ cards: [card], type: CardType.SINGLE, mainPower: power })
      }
    }

    // 对子
    for (const [power, count] of rankCount) {
      if (count >= 2) {
        const cards = hand.filter(c => getRankPower(c.rank) === power).slice(0, 2)
        validPlays.push({ cards, type: CardType.PAIR, mainPower: power })
      }
    }

    // 三条
    for (const [power, count] of rankCount) {
      if (count >= 3) {
        const cards = hand.filter(c => getRankPower(c.rank) === power).slice(0, 3)
        validPlays.push({ cards, type: CardType.TRIPLE, mainPower: power })
      }
    }

    // 炸弹
    for (const [power, count] of rankCount) {
      if (count === 4) {
        const cards = hand.filter(c => getRankPower(c.rank) === power)
        validPlays.push({ cards, type: CardType.BOMB, mainPower: power })
      }
    }

    // 火箭
    const jokers = hand.filter(c => c.rank === 'small_joker' || c.rank === 'big_joker')
    if (jokers.length === 2) {
      validPlays.push({ cards: jokers, type: CardType.ROCKET, mainPower: 14 })
    }
  } else {
    // 跟牌：同类型 + 炸弹/火箭
    if (previous.type === CardType.SINGLE) {
      const seen = new Set<number>()
      for (const card of hand) {
        const power = getRankPower(card.rank)
        if (!seen.has(power) && power > previous.mainPower) {
          seen.add(power)
          validPlays.push({ cards: [card], type: CardType.SINGLE, mainPower: power })
        }
      }
    } else if (previous.type === CardType.PAIR) {
      for (const [power, count] of rankCount) {
        if (count >= 2 && power > previous.mainPower) {
          const cards = hand.filter(c => getRankPower(c.rank) === power).slice(0, 2)
          validPlays.push({ cards, type: CardType.PAIR, mainPower: power })
        }
      }
    } else if (previous.type === CardType.TRIPLE) {
      for (const [power, count] of rankCount) {
        if (count >= 3 && power > previous.mainPower) {
          const cards = hand.filter(c => getRankPower(c.rank) === power).slice(0, 3)
          validPlays.push({ cards, type: CardType.TRIPLE, mainPower: power })
        }
      }
    }

    // 所有情况都可以出炸弹和火箭
    if (previous.type !== CardType.ROCKET) {
      if (previous.type !== CardType.BOMB) {
        for (const [power, count] of rankCount) {
          if (count === 4) {
            const cards = hand.filter(c => getRankPower(c.rank) === power)
            validPlays.push({ cards, type: CardType.BOMB, mainPower: power })
          }
        }
      }
      const jokers = hand.filter(c => c.rank === 'small_joker' || c.rank === 'big_joker')
      if (jokers.length === 2) {
        validPlays.push({ cards: jokers, type: CardType.ROCKET, mainPower: 14 })
      }
    }
  }

  return validPlays
}
