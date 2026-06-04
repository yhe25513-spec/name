'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardType, createDeck, shuffleDeck, dealCards, classifyHand, canBeat, findAllValidPlays } from '@/lib/cardgame/logic'
import { SupabaseClient } from '@/lib/cardgame/supabase'
import { AIPlayer } from '@/lib/cardgame/ai'

// 牌型显示名称
const CARD_TYPE_NAMES: Record<string, string> = {
  SINGLE: '单张',
  PAIR: '对子',
  TRIPLE: '三条',
  TRIPLE_ONE: '三带一',
  TRIPLE_TWO: '三带二',
  STRAIGHT: '顺子',
  STRAIGHT_PAIR: '连对',
  AIRPLANE: '飞机',
  AIRPLANE_SINGLE: '飞机带单',
  AIRPLANE_PAIR: '飞机带对',
  BOMB: '炸弹',
  ROCKET: '火箭',
}

// 花色符号
const SUIT_SYMBOLS: Record<string, string> = {
  spade: '♠',
  heart: '♥',
  club: '♣',
  diamond: '♦',
}

// 花色颜色
const SUIT_COLORS: Record<string, string> = {
  spade: '#000',
  heart: '#e94560',
  club: '#000',
  diamond: '#e94560',
}

interface Player {
  id: string
  name: string
  index: number
  isAI: boolean
}

interface GameState {
  phase: 'waiting' | 'bidding' | 'playing' | 'finished'
  hands: Card[][]
  landlordCards: Card[]
  landlord: number | null
  currentPlayer: number
  lastPlay: { cards: Card[], type: string, player: number, mainPower?: number, chainLength?: number } | null
  lastPlayer: number | null
  passCount: number
  bidScores: (number | null)[]
  currentBidder: number
  winner: number | null
  players: Player[]
}

export default function CardGamePage() {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [selectedCards, setSelectedCards] = useState<Card[]>([])
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [waitingTime, setWaitingTime] = useState(0)
  const [message, setMessage] = useState('')
  const [myIndex, setMyIndex] = useState(0)

  const supabaseRef = useRef<SupabaseClient | null>(null)
  const aiRef = useRef<AIPlayer | null>(null)
  const waitingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 初始化 Supabase
  useEffect(() => {
    supabaseRef.current = new SupabaseClient()
    aiRef.current = new AIPlayer()
  }, [])

  // 等待计时器
  useEffect(() => {
    return () => {
      if (waitingTimerRef.current) {
        clearInterval(waitingTimerRef.current)
      }
    }
  }, [])

  // 创建房间
  const createRoom = async () => {
    if (!playerName.trim()) {
      setMessage('请输入你的昵称')
      return
    }

    setIsWaiting(true)
    setMessage('正在创建房间...')

    try {
      const room = await supabaseRef.current?.createRoom(playerName)
      if (room) {
        setRoomCode(room.room_code)
        setIsConnected(true)
        setIsHost(true)
        setMyIndex(0)
        setMessage(`房间已创建: ${room.room_code}，等待玩家加入...`)

        // 订阅房间变化
        subscribeToRoom(room.room_code)
      }
    } catch (error) {
      setMessage('创建房间失败')
      setIsWaiting(false)
    }
  }

  // 开始在线游戏
  const startOnlineGame = async () => {
    if (!isHost || !roomCode) return

    // 获取房间信息
    const room = await supabaseRef.current?.getRoom(roomCode)
    if (!room) {
      setMessage('房间不存在')
      return
    }

    const players = room.players || []
    if (players.length < 1) {
      setMessage('至少需要1名玩家才能开始')
      return
    }

    // 创建游戏
    const deck = shuffleDeck(createDeck())
    const [hand1, hand2, hand3, landlordCards] = dealCards(deck)

    const hands = [hand1, hand2, hand3]

    // 构建玩家列表，不够3人用AI补
    const allPlayers = players.map((p: any, i: number) => ({
      id: p.name,
      name: p.name,
      index: i,
      isAI: false,
    }))

    // 用AI补齐到3人
    while (allPlayers.length < 3) {
      const aiIndex = allPlayers.length
      allPlayers.push({
        id: `ai${aiIndex}`,
        name: `电脑${aiIndex}`,
        index: aiIndex,
        isAI: true,
      })
    }

    const gameState = {
      phase: 'bidding',
      hands: hands.map(hand => hand.map(c => ({ suit: c.suit, rank: c.rank }))),
      landlordCards: landlordCards.map(c => ({ suit: c.suit, rank: c.rank })),
      landlord: null,
      currentPlayer: Math.floor(Math.random() * 3),
      lastPlay: null,
      lastPlayer: null,
      passCount: 0,
      bidScores: [null, null, null],
      currentBidder: Math.floor(Math.random() * 3),
      winner: null,
      players: allPlayers,
    }

    // 更新 Supabase
    await supabaseRef.current?.startGame(roomCode, gameState)

    // 本地进入游戏
    setGameState({
      ...gameState,
      phase: 'bidding' as const,
      hands,
      landlordCards,
    })
    setMessage('游戏开始！')
  }

  // 加入房间
  const joinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) {
      setMessage('请输入昵称和房间号')
      return
    }

    try {
      const room = await supabaseRef.current?.joinRoom(roomCode, playerName)
      if (room) {
        setIsConnected(true)
        setIsHost(false)
        // 找到自己的索引
        const players = room.players || []
        const myIdx = players.findIndex((p: any) => p.name === playerName)
        setMyIndex(myIdx >= 0 ? myIdx : players.length - 1)
        setMessage('已加入房间，等待房主开始游戏...')
        subscribeToRoom(room.room_code)
      } else {
        setMessage('房间不存在或已满')
      }
    } catch (error) {
      setMessage('加入房间失败')
    }
  }

  // 订阅房间
  const subscribeToRoom = (code: string) => {
    supabaseRef.current?.subscribeRoom(code, (room: any) => {
      if (room.status === 'playing' && room.game_state) {
        enterGame(room.game_state)
      }
    })
  }

  // 开始AI对战
  const startAIGame = async () => {
    setIsWaiting(false)
    setMessage('没有真人玩家，开始AI对战...')

    // 创建本地游戏
    const deck = shuffleDeck(createDeck())
    const [hand1, hand2, hand3, landlordCards] = dealCards(deck)

    const ai1 = aiRef.current!
    const ai2 = aiRef.current!

    const players: Player[] = [
      { id: 'player', name: playerName || '你', index: 0, isAI: false },
      { id: 'ai1', name: '电脑1', index: 1, isAI: true },
      { id: 'ai2', name: '电脑2', index: 2, isAI: true },
    ]

    setGameState({
      phase: 'bidding',
      hands: [hand1, hand2, hand3],
      landlordCards,
      landlord: null,
      currentPlayer: Math.floor(Math.random() * 3),
      lastPlay: null,
      lastPlayer: null,
      passCount: 0,
      bidScores: [null, null, null],
      currentBidder: Math.floor(Math.random() * 3),
      winner: null,
      players,
    })

    setMyIndex(0)
    setMessage('游戏开始！请叫分')
  }

  // 进入游戏
  const enterGame = (state: any) => {
    setIsWaiting(false)
    const hands = state.hands.map((hand: any[]) =>
      hand.map((c: any) => ({ suit: c.suit, rank: c.rank }))
    )

    // 找到自己的索引
    const players = state.players || []
    const myIdx = players.findIndex((p: any) => p.name === playerName)
    if (myIdx >= 0) {
      setMyIndex(myIdx)
    }

    setGameState({
      ...state,
      hands,
      landlordCards: state.landlordCards?.map((c: any) => ({ suit: c.suit, rank: c.rank })) || [],
    })
  }

  // 叫分
  const handleBid = async (score: number) => {
    if (!gameState || gameState.currentBidder !== myIndex) return

    const newBidScores = [...gameState.bidScores]
    newBidScores[myIndex] = score

    // 检查是否叫3分
    if (score === 3) {
      setLandlord(myIndex, newBidScores)
      return
    }

    // 下一个叫分
    const nextBidder = (gameState.currentBidder + 1) % 3
    const bidsCompleted = newBidScores.filter(s => s !== null).length

    if (bidsCompleted >= 3) {
      // 找最高分
      const maxScore = Math.max(...newBidScores.filter(s => s !== null) as number[])
      if (maxScore === 0) {
        // 都不叫，重新发牌
        startAIGame()
        return
      }
      const landlordIndex = newBidScores.findIndex(s => s === maxScore)
      setLandlord(landlordIndex, newBidScores)
    } else {
      setGameState({
        ...gameState,
        bidScores: newBidScores,
        currentBidder: nextBidder,
      })

      // AI叫分
      if (gameState.players[nextBidder]?.isAI) {
        setTimeout(() => aiBid(nextBidder, gameState.hands[nextBidder]), 800)
      }
    }
  }

  // AI叫分
  const aiBid = (playerIndex: number, hand: Card[]) => {
    if (!gameState || !aiRef.current) return

    const score = aiRef.current.decideBid(hand)

    const newBidScores = [...gameState.bidScores]
    newBidScores[playerIndex] = score

    if (score === 3) {
      setLandlord(playerIndex, newBidScores)
      return
    }

    const nextBidder = (playerIndex + 1) % 3
    const bidsCompleted = newBidScores.filter(s => s !== null).length

    if (bidsCompleted >= 3) {
      const maxScore = Math.max(...newBidScores.filter(s => s !== null) as number[])
      if (maxScore === 0) {
        startAIGame()
        return
      }
      const landlordIndex = newBidScores.findIndex(s => s === maxScore)
      setLandlord(landlordIndex, newBidScores)
    } else {
      setGameState({
        ...gameState,
        bidScores: newBidScores,
        currentBidder: nextBidder,
      })

      // 下一个AI叫分
      if (gameState.players[nextBidder]?.isAI) {
        setTimeout(() => aiBid(nextBidder, gameState.hands[nextBidder]), 800)
      }
    }
  }

  // 设置地主
  const setLandlord = (playerIndex: number, bidScores: (number | null)[]) => {
    if (!gameState) return

    const newHands = gameState.hands.map(hand => [...hand])
    newHands[playerIndex] = [...newHands[playerIndex], ...gameState.landlordCards]

    setGameState({
      ...gameState,
      phase: 'playing',
      hands: newHands,
      landlord: playerIndex,
      currentPlayer: playerIndex,
      bidScores,
      lastPlay: null,
      lastPlayer: null,
      passCount: 0,
    })

    setMessage(`${gameState.players[playerIndex].name} 成为地主！`)

    // 如果地主是AI，自动出牌
    if (gameState.players[playerIndex]?.isAI) {
      setTimeout(() => aiPlay(playerIndex), 1000)
    }
  }

  // 出牌
  const handlePlay = async () => {
    if (!gameState || gameState.currentPlayer !== myIndex || selectedCards.length === 0) return

    const play = classifyHand(selectedCards)
    if (!play) {
      setMessage('不是合法的牌型')
      return
    }

    if (gameState.lastPlay && gameState.passCount < 2) {
      if (!canBeat(play, gameState.lastPlay)) {
        setMessage('出的牌打不过上家')
        return
      }
    }

    // 更新手牌
    const newHands = gameState.hands.map(hand => [...hand])
    newHands[myIndex] = newHands[myIndex].filter(c =>
      !selectedCards.some(sc => sc.suit === c.suit && sc.rank === c.rank)
    )

    // 检查胜利
    const isWin = newHands[myIndex].length === 0

    setGameState({
      ...gameState,
      hands: newHands,
      lastPlay: { cards: selectedCards, type: play.type, player: myIndex, mainPower: play.mainPower },
      lastPlayer: myIndex,
      passCount: 0,
      currentPlayer: isWin ? myIndex : (myIndex + 1) % 3,
      winner: isWin ? myIndex : null,
      phase: isWin ? 'finished' : 'playing',
    })

    setSelectedCards([])
    setMessage(isWin ? '恭喜你赢了！' : '等待其他玩家...')

    // AI出牌
    if (!isWin) {
      const nextPlayer = (myIndex + 1) % 3
      if (gameState.players[nextPlayer]?.isAI) {
        setTimeout(() => aiPlay(nextPlayer), 1000)
      }
    }
  }

  // 过牌
  const handlePass = () => {
    if (!gameState || gameState.currentPlayer !== myIndex) return
    if (!gameState.lastPlay || gameState.passCount >= 2) return

    const newPassCount = gameState.passCount + 1
    const nextPlayer = (myIndex + 1) % 3

    setGameState({
      ...gameState,
      passCount: newPassCount >= 2 ? 0 : newPassCount,
      lastPlay: newPassCount >= 2 ? null : gameState.lastPlay,
      currentPlayer: nextPlayer,
    })

    setSelectedCards([])
    setMessage('等待其他玩家...')

    // AI出牌
    if (gameState.players[nextPlayer]?.isAI) {
      setTimeout(() => aiPlay(nextPlayer), 1000)
    }
  }

  // AI出牌
  const aiPlay = (playerIndex: number) => {
    if (!gameState || !aiRef.current) return

    const hand = gameState.hands[playerIndex]
    const mustFollow = gameState.passCount >= 2 ? null : gameState.lastPlay

    const cardsToPlay = aiRef.current.decidePlay(hand, mustFollow)

    if (cardsToPlay === null) {
      // AI过牌
      const newPassCount = gameState.passCount + 1
      const nextPlayer = (playerIndex + 1) % 3

      setGameState({
        ...gameState,
        passCount: newPassCount >= 2 ? 0 : newPassCount,
        lastPlay: newPassCount >= 2 ? null : gameState.lastPlay,
        currentPlayer: nextPlayer,
      })

      // 下一个AI
      if (gameState.players[nextPlayer]?.isAI) {
        setTimeout(() => aiPlay(nextPlayer), 1000)
      }
    } else {
      // AI出牌
      const play = classifyHand(cardsToPlay)
      const newHands = gameState.hands.map(hand => [...hand])
      newHands[playerIndex] = newHands[playerIndex].filter(c =>
        !cardsToPlay.some(sc => sc.suit === c.suit && sc.rank === c.rank)
      )

      const isWin = newHands[playerIndex].length === 0
      const nextPlayer = (playerIndex + 1) % 3

      setGameState({
        ...gameState,
        hands: newHands,
        lastPlay: { cards: cardsToPlay, type: play?.type || 'SINGLE', player: playerIndex, mainPower: play?.mainPower || 0 },
        lastPlayer: playerIndex,
        passCount: 0,
        currentPlayer: isWin ? playerIndex : nextPlayer,
        winner: isWin ? playerIndex : null,
        phase: isWin ? 'finished' : 'playing',
      })

      if (isWin) {
        setMessage(`${gameState.players[playerIndex].name} 获胜！`)
      } else if (gameState.players[nextPlayer]?.isAI) {
        setTimeout(() => aiPlay(nextPlayer), 1000)
      }
    }
  }

  // 切换选牌
  const toggleCard = (card: Card) => {
    setSelectedCards(prev => {
      const isSelected = prev.some(c => c.suit === card.suit && c.rank === card.rank)
      if (isSelected) {
        return prev.filter(c => !(c.suit === card.suit && c.rank === card.rank))
      } else {
        return [...prev, card]
      }
    })
  }

  // 渲染单张牌
  const renderCard = (card: Card, isSelected: boolean = false, onClick?: () => void) => {
    const suitSymbol = SUIT_SYMBOLS[card.suit] || ''
    const color = SUIT_COLORS[card.suit] || '#000'
    const isJoker = card.rank === 'small_joker' || card.rank === 'big_joker'

    return (
      <div
        key={`${card.suit}-${card.rank}`}
        onClick={onClick}
        className={`
          relative w-16 h-24 rounded-lg cursor-pointer transition-all duration-200
          ${isSelected ? 'transform -translate-y-2 ring-2 ring-yellow-400' : 'hover:transform hover:-translate-y-1'}
          bg-white shadow-lg border-2 border-gray-200
        `}
        style={{ flexShrink: 0 }}
      >
        {isJoker ? (
          <div className="flex flex-col items-center justify-center h-full">
            <span className="text-lg font-bold" style={{ color: card.rank === 'big_joker' ? '#e94560' : '#000' }}>
              JOKER
            </span>
            <span className="text-2xl" style={{ color: card.rank === 'big_joker' ? '#e94560' : '#000' }}>
              {card.rank === 'big_joker' ? '👑' : '🃏'}
            </span>
          </div>
        ) : (
          <>
            <div className="absolute top-1 left-1 text-xs font-bold" style={{ color }}>
              {card.rank}
            </div>
            <div className="absolute top-4 left-1 text-sm" style={{ color }}>
              {suitSymbol}
            </div>
            <div className="flex items-center justify-center h-full">
              <span className="text-2xl" style={{ color }}>{suitSymbol}</span>
            </div>
            <div className="absolute bottom-1 right-1 text-xs font-bold" style={{ color }}>
              {card.rank}
            </div>
          </>
        )}
      </div>
    )
  }

  // 渲染手牌
  const renderHand = (cards: Card[], isMine: boolean = false) => {
    const cardWidth = 64
    const overlap = cards.length > 15 ? 30 : 40
    const totalWidth = (cards.length - 1) * overlap + cardWidth

    return (
      <div className="relative" style={{ height: 100, minWidth: totalWidth + 20 }}>
        {cards.map((card, index) => (
          <div
            key={`${card.suit}-${card.rank}-${index}`}
            className="absolute"
            style={{ left: index * overlap }}
          >
            {renderCard(
              card,
              isMine && selectedCards.some(c => c.suit === card.suit && c.rank === card.rank),
              isMine ? () => toggleCard(card) : undefined
            )}
          </div>
        ))}
      </div>
    )
  }

  // 游戏界面
  if (gameState) {
    const isMyTurn = gameState.currentPlayer === myIndex
    const isLandlord = gameState.landlord === myIndex
    const canPass = gameState.lastPlay && gameState.passCount < 2

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4">
        {/* 顶部信息 */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setGameState(null)
                setIsConnected(false)
                setIsHost(false)
                setRoomCode('')
                setMessage('')
              }}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              ← 返回
            </button>
            <h1 className="text-2xl font-bold text-yellow-400">🃏 斗地主</h1>
          </div>
          <div className="text-sm text-gray-400">
            {isLandlord ? '👑 地主' : '👨‍🌾 农民'} | 手牌: {gameState.hands[myIndex].length}张
          </div>
        </div>

        {/* 其他玩家 */}
        <div className="flex justify-between mb-4">
          {gameState.players.filter((_, i) => i !== myIndex).map(player => (
            <div key={player.id} className="bg-gray-800 rounded-lg p-3 min-w-[150px]">
              <div className="text-sm font-bold text-yellow-400">
                {player.name} {gameState.landlord === player.index ? '👑' : ''}
              </div>
              <div className="text-xs text-gray-400">
                手牌: {gameState.hands[player.index].length}张
              </div>
              {gameState.currentPlayer === player.index && (
                <div className="text-xs text-green-400 animate-pulse">出牌中...</div>
              )}
            </div>
          ))}
        </div>

        {/* 地主牌 */}
        <div className="bg-gray-800 rounded-lg p-3 mb-4">
          <div className="text-sm text-gray-400 mb-2">地主牌:</div>
          <div className="flex gap-2">
            {gameState.landlordCards.map((card, i) => (
              <div key={i} className="transform scale-75">
                {renderCard(card)}
              </div>
            ))}
          </div>
        </div>

        {/* 出牌区 */}
        <div className="bg-gray-700 rounded-lg p-4 mb-4 min-h-[120px]">
          {gameState.lastPlay ? (
            <div className="text-center">
              <div className="text-sm text-gray-400 mb-2">
                {gameState.players[gameState.lastPlayer || 0].name} 出牌:
              </div>
              <div className="flex justify-center gap-1">
                {gameState.lastPlay.cards.map((card, i) => (
                  <div key={i} className="transform scale-90">
                    {renderCard(card)}
                  </div>
                ))}
              </div>
              <div className="text-sm text-yellow-400 mt-2">
                {CARD_TYPE_NAMES[gameState.lastPlay.type] || gameState.lastPlay.type}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500">等待出牌...</div>
          )}
        </div>

        {/* 我的手牌 */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4 overflow-x-auto">
          <div className="text-sm text-gray-400 mb-2">我的手牌:</div>
          <div className="flex justify-center">
            {renderHand(gameState.hands[myIndex], true)}
          </div>
        </div>

        {/* 按钮区 */}
        <div className="flex justify-center gap-4">
          {gameState.phase === 'bidding' && gameState.currentBidder === myIndex && (
            <>
              {[1, 2, 3].map(score => (
                <button
                  key={score}
                  onClick={() => handleBid(score)}
                  className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-bold"
                >
                  {score}分
                </button>
              ))}
              <button
                onClick={() => handleBid(0)}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg"
              >
                不叫
              </button>
            </>
          )}

          {gameState.phase === 'playing' && isMyTurn && (
            <>
              <button
                onClick={handlePlay}
                disabled={selectedCards.length === 0}
                className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-bold disabled:opacity-50"
              >
                出牌
              </button>
              {canPass && (
                <button
                  onClick={handlePass}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg"
                >
                  不出
                </button>
              )}
            </>
          )}

          {gameState.phase === 'finished' && (
            <button
              onClick={() => setGameState(null)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold"
            >
              再来一局
            </button>
          )}
        </div>

        {/* 状态消息 */}
        {message && (
          <div className="text-center text-sm text-gray-400 mt-4">{message}</div>
        )}
      </div>
    )
  }

  // 大厅界面
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-center text-yellow-400 mb-8">🃏 斗地主</h1>

        {/* 昵称输入 */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">你的昵称</label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="输入昵称"
            className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none"
          />
        </div>

        {/* 操作按钮 */}
        <div className="space-y-4">
          {!isConnected ? (
            <>
              <button
                onClick={createRoom}
                disabled={isWaiting}
                className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-lg disabled:opacity-50"
              >
                {isWaiting ? '等待中...' : '创建房间'}
              </button>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value)}
                  placeholder="房间号"
                  className="flex-1 px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none"
                  maxLength={8}
                />
                <button
                  onClick={joinRoom}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold"
                >
                  加入
                </button>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="text-lg text-yellow-400 mb-2">房间号: {roomCode}</div>
              <div className="text-sm text-gray-400 mb-4">等待玩家加入中...</div>
              {isHost && (
                <button
                  onClick={startOnlineGame}
                  className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-lg"
                >
                  开始游戏
                </button>
              )}
            </div>
          )}

          <button
            onClick={startAIGame}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold"
          >
            🤖 单人模式 (AI对战)
          </button>
        </div>

        {/* 消息 */}
        {message && (
          <div className="mt-6 text-center text-sm text-gray-400">{message}</div>
        )}

        {/* 说明 */}
        <div className="mt-8 text-xs text-gray-500 text-center">
          <p>创建房间后等待30秒</p>
          <p>没有真人玩家将自动开始AI对战</p>
        </div>
      </div>
    </div>
  )
}
