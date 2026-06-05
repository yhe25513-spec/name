/**
 * 测试三个AI对战
 */

import { createDeck, shuffleDeck, dealCards, classifyHand, canBeat, findAllValidPlays } from './lib/cardgame/logic'
import { AIPlayer, resetPlayedCards, recordPlayedCards } from './lib/cardgame/ai'

interface Card {
  suit: string
  rank: string
}

interface GameState {
  phase: 'bidding' | 'playing' | 'finished'
  hands: Card[][]
  landlordCards: Card[]
  landlord: number | null
  currentPlayer: number
  currentBidder: number
  lastPlay: { cards: Card[], type: string, player: number, mainPower: number } | null
  lastPlayer: number | null
  passCount: number
  bidScores: (number | null)[]
  winner: number | null
  playHistory: { player: number, cards: Card[] | null, playerName: string }[]
}

const RANK_NAMES: Record<string, string> = {
  '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10', 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A', '2': '2', 'small_joker': '小王', 'big_joker': '大王',
}

const SUIT_NAMES: Record<string, string> = { spade: '♠', heart: '♥', club: '♣', diamond: '♦', joker: '' }

function formatHand(hand: Card[]): string {
  return hand.map(c => `${SUIT_NAMES[c.suit]}${RANK_NAMES[c.rank]}`).join(' ')
}

function sortHand(hand: Card[]): Card[] {
  const rankOrder: Record<string, number> = {
    '3': 0, '4': 1, '5': 2, '6': 3, '7': 4, '8': 5, '9': 6, '10': 7, 'J': 8, 'Q': 9, 'K': 10, 'A': 11, '2': 12, 'small_joker': 13, 'big_joker': 14
  }
  return [...hand].sort((a, b) => (rankOrder[a.rank] || 0) - (rankOrder[b.rank] || 0))
}

async function runTestGame() {
  console.log('=== 三个AI对战测试 ===\n')

  // 创建玩家
  const players = [
    new AIPlayer(0),
    new AIPlayer(1),
    new AIPlayer(2),
  ]

  // 发牌
  const deck = shuffleDeck(createDeck())
  const [h1, h2, h3, landlordCards] = dealCards(deck)

  const state: GameState = {
    phase: 'bidding',
    hands: [h1, h2, h3],
    landlordCards,
    landlord: null,
    currentPlayer: 0,
    currentBidder: 0,
    lastPlay: null,
    lastPlayer: null,
    passCount: 0,
    bidScores: [null, null, null],
    winner: null,
    playHistory: [],
  }

  console.log('=== 发牌 ===')
  for (let i = 0; i < 3; i++) {
    console.log(`玩家${i}: ${formatHand(sortHand(state.hands[i]))}`)
  }
  console.log(`地主牌: ${formatHand(landlordCards)}\n`)

  // 叫分阶段
  console.log('=== 叫分阶段 ===')
  for (let round = 0; round < 3; round++) {
    const bidder = state.currentBidder
    const hand = state.hands[bidder]
    const handCount = state.hands.map(h => h.length)

    console.log(`\n玩家${bidder}叫分 (手牌${hand.length}张):`)
    console.log(`手牌: ${formatHand(sortHand(hand))}`)

    const bid = await players[bidder].decideBid(hand, handCount)
    state.bidScores[bidder] = bid
    console.log(`叫分: ${bid}分`)

    if (bid === 3) {
      state.landlord = bidder
      state.hands[bidder] = [...state.hands[bidder], ...landlordCards]
      console.log(`\n玩家${bidder}叫3分成为地主！`)
      break
    }

    state.currentBidder = (bidder + 1) % 3
  }

  // 如果没人叫3分，找最高分
  if (state.landlord === null) {
    const maxBid = Math.max(...state.bidScores.filter(b => b !== null) as number[])
    if (maxBid > 0) {
      const landlordIdx = state.bidScores.findIndex(b => b === maxBid)
      state.landlord = landlordIdx
      state.hands[landlordIdx] = [...state.hands[landlordIdx], ...landlordCards]
      console.log(`\n玩家${landlordIdx}叫${maxBid}分成为地主！`)
    } else {
      console.log('\n没人叫分，重新发牌')
      return
    }
  }

  console.log(`\n地主: 玩家${state.landlord}`)
  console.log(`地主手牌: ${formatHand(sortHand(state.hands[state.landlord]))}\n`)

  // 出牌阶段
  console.log('=== 出牌阶段 ===')
  state.phase = 'playing'
  state.currentPlayer = state.landlord
  let turnCount = 0
  const maxTurns = 100

  while (state.phase === 'playing' && turnCount < maxTurns) {
    turnCount++
    const player = state.currentPlayer
    const hand = state.hands[player]
    const isLandlord = player === state.landlord
    const handCount = state.hands.map(h => h.length)

    // 分析当前局势
    const mustFollow = state.passCount >= 2 ? null : state.lastPlay

    console.log(`\n--- 第${turnCount}手 ---`)
    console.log(`轮到: 玩家${player} (${isLandlord ? '地主' : '农民'})`)
    console.log(`手牌(${hand.length}张): ${formatHand(sortHand(hand))}`)
    console.log(`对手手牌: ${handCount.map((c, i) => `P${i}:${c}张`).join(', ')}`)
    if (mustFollow) {
      console.log(`需要跟: ${mustFollow.cards.map(c => `${SUIT_NAMES[c.suit]}${RANK_NAMES[c.rank]}`).join(' ')} (${mustFollow.type})`)
    }

    // AI决策
    const followPlay = mustFollow ? { cards: mustFollow.cards, type: mustFollow.type as any, mainPower: mustFollow.mainPower } : null
    const cards = await players[player].decidePlay(hand, followPlay, handCount, isLandlord)

    if (cards === null) {
      console.log(`玩家${player}: 不出`)
      state.playHistory.push({ player, cards: null, playerName: `玩家${player}` })
      state.passCount++
      if (state.passCount >= 2) {
        state.lastPlay = null
        state.passCount = 0
      }
    } else {
      const play = classifyHand(cards)
      console.log(`玩家${player}: ${cards.map(c => `${SUIT_NAMES[c.suit]}${RANK_NAMES[c.rank]}`).join(' ')} (${play?.type})`)
      state.playHistory.push({ player, cards, playerName: `玩家${player}` })
      state.lastPlay = { cards, type: play?.type || '', player, mainPower: play?.mainPower || 0 }
      state.lastPlayer = player
      state.passCount = 0

      // 从手牌移除
      state.hands[player] = hand.filter(c => !cards.some(sc => sc.suit === c.suit && sc.rank === c.rank))

      // 检查胜利
      if (state.hands[player].length === 0) {
        state.winner = player
        state.phase = 'finished'
        console.log(`\n=== 玩家${player} (${isLandlord ? '地主' : '农民'}) 获胜！ ===`)
        break
      }
    }

    state.currentPlayer = (player + 1) % 3
  }

  if (turnCount >= maxTurns) {
    console.log('\n超过最大回合数，游戏结束')
  }

  // 统计
  console.log('\n=== 最终手牌 ===')
  for (let i = 0; i < 3; i++) {
    console.log(`玩家${i} (${i === state.landlord ? '地主' : '农民'}): ${state.hands[i].length}张 - ${formatHand(sortHand(state.hands[i]))}`)
  }
}

runTestGame().catch(console.error)
