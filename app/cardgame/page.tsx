'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, createDeck, shuffleDeck, dealCards, classifyHand, canBeat } from '@/lib/cardgame/logic'
import { SupabaseClient } from '@/lib/cardgame/supabase'
import { AIPlayer } from '@/lib/cardgame/ai'

const CARD_TYPE_NAMES: Record<string, string> = {
  SINGLE: '单张', PAIR: '对子', TRIPLE: '三条',
  TRIPLE_ONE: '三带一', TRIPLE_TWO: '三带二', STRAIGHT: '顺子',
  STRAIGHT_PAIR: '连对', AIRPLANE: '飞机', BOMB: '炸弹', ROCKET: '火箭',
}

const SUIT_SYMBOLS: Record<string, string> = {
  spade: '♠', heart: '♥', club: '♣', diamond: '♦',
}

const SUIT_COLORS: Record<string, string> = {
  spade: '#000', heart: '#e94560', club: '#000', diamond: '#e94560',
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
  lastPlay: { cards: Card[], type: string, player: number, mainPower?: number } | null
  lastPlayer: number | null
  passCount: number
  bidScores: (number | null)[]
  currentBidder: number
  winner: number | null
  players: Player[]
  message: string
}

export default function CardGamePage() {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [selectedCards, setSelectedCards] = useState<Card[]>([])
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [message, setMessage] = useState('')
  const [myIndex, setMyIndex] = useState(0)

  const supabaseRef = useRef<SupabaseClient | null>(null)
  const aiRef = useRef<AIPlayer | null>(null)

  useEffect(() => {
    supabaseRef.current = new SupabaseClient()
    aiRef.current = new AIPlayer()
  }, [])

  // 处理AI回合
  useEffect(() => {
    if (!gameState || gameState.phase === 'finished') return

    const currentPlayer = gameState.players[gameState.currentPlayer]
    if (!currentPlayer?.isAI) return
    if (gameState.currentPlayer === myIndex) return

    const timeout = setTimeout(() => {
      if (gameState.phase === 'bidding') {
        aiBid(gameState.currentPlayer)
      } else if (gameState.phase === 'playing') {
        aiPlay(gameState.currentPlayer)
      }
    }, 800)

    return () => clearTimeout(timeout)
  }, [gameState?.currentPlayer, gameState?.phase])

  // 创建房间
  const createRoom = async () => {
    if (!playerName.trim()) {
      setMessage('请输入你的昵称')
      return
    }
    setMessage('创建中...')
    try {
      const room = await supabaseRef.current?.createRoom(playerName)
      if (room) {
        setRoomCode(room.room_code)
        setIsConnected(true)
        setIsHost(true)
        setMyIndex(0)
        setMessage(`房间创建成功！房间号: ${room.room_code}`)
        subscribeToRoom(room.room_code)
      }
    } catch (error) {
      setMessage('创建失败')
    }
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
        const players = room.players || []
        const myIdx = players.findIndex((p: any) => p.name === playerName)
        setMyIndex(myIdx >= 0 ? myIdx : players.length - 1)
        setMessage('已加入房间，等待房主开始...')
        subscribeToRoom(room.room_code)
      } else {
        setMessage('房间不存在或已满')
      }
    } catch (error) {
      setMessage('加入失败')
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

  // 开始在线游戏
  const startOnlineGame = async () => {
    if (!isHost || !roomCode) return
    const room = await supabaseRef.current?.getRoom(roomCode)
    if (!room) { setMessage('房间不存在'); return }

    const players = room.players || []
    const deck = shuffleDeck(createDeck())
    const [hand1, hand2, hand3, landlordCards] = dealCards(deck)
    const hands = [hand1, hand2, hand3]

    const allPlayers = players.map((p: any, i: number) => ({
      id: p.name, name: p.name, index: i, isAI: false,
    }))
    while (allPlayers.length < 3) {
      allPlayers.push({
        id: `ai${allPlayers.length}`, name: `电脑${allPlayers.length}`,
        index: allPlayers.length, isAI: true,
      })
    }

    const firstBidder = Math.floor(Math.random() * 3)
    const state: GameState = {
      phase: 'bidding', hands, landlordCards, landlord: null,
      currentPlayer: firstBidder, lastPlay: null, lastPlayer: null,
      passCount: 0, bidScores: [null, null, null], currentBidder: firstBidder,
      winner: null, players: allPlayers,
      message: `${allPlayers[firstBidder].name} 请叫分`,
    }

    await supabaseRef.current?.startGame(roomCode, state)
    setGameState(state)
    setMyIndex(players.findIndex((p: any) => p.name === playerName))
  }

  // 进入游戏
  const enterGame = (state: any) => {
    const hands = state.hands.map((h: any[]) => h.map((c: any) => ({ suit: c.suit, rank: c.rank })))
    const myIdx = state.players?.findIndex((p: any) => p.name === playerName) ?? 0
    setMyIndex(myIdx)
    setGameState({ ...state, hands, landlordCards: state.landlordCards?.map((c: any) => ({ suit: c.suit, rank: c.rank })) || [] })
  }

  // AI叫分
  const aiBid = (playerIndex: number) => {
    if (!gameState || !aiRef.current) return
    const hand = gameState.hands[playerIndex]
    const score = aiRef.current.decideBid(hand)
    handleBid(score, playerIndex)
  }

  // 叫分
  const handleBid = (score: number, playerIndex?: number) => {
    const idx = playerIndex ?? myIndex
    if (!gameState) return
    if (playerIndex === undefined && gameState.currentBidder !== myIndex) return

    const newBidScores = [...gameState.bidScores]
    newBidScores[idx] = score

    if (score === 3) {
      setLandlord(idx, newBidScores)
      return
    }

    const nextBidder = (idx + 1) % 3
    const bidsCompleted = newBidScores.filter(s => s !== null).length

    if (bidsCompleted >= 3) {
      const maxScore = Math.max(...newBidScores.filter(s => s !== null) as number[])
      if (maxScore === 0) {
        startOnlineGame()
        return
      }
      const landlordIndex = newBidScores.findIndex(s => s === maxScore)
      setLandlord(landlordIndex, newBidScores)
    } else {
      setGameState({
        ...gameState, bidScores: newBidScores, currentBidder: nextBidder,
        message: `${gameState.players[nextBidder].name} 请叫分`,
      })
    }
  }

  // 设置地主
  const setLandlord = (playerIndex: number, bidScores: (number | null)[]) => {
    if (!gameState) return
    const newHands = gameState.hands.map(h => [...h])
    newHands[playerIndex] = [...newHands[playerIndex], ...gameState.landlordCards]

    setGameState({
      ...gameState, phase: 'playing', hands: newHands, landlord: playerIndex,
      currentPlayer: playerIndex, bidScores, lastPlay: null, lastPlayer: null, passCount: 0,
      message: `${gameState.players[playerIndex].name} 成为地主！`,
    })
  }

  // AI出牌
  const aiPlay = (playerIndex: number) => {
    if (!gameState || !aiRef.current) return
    const hand = gameState.hands[playerIndex]
    const mustFollow = gameState.passCount >= 2 ? null : gameState.lastPlay
    const cards = aiRef.current.decidePlay(hand, mustFollow)

    if (cards === null) {
      handlePass(playerIndex)
    } else {
      handlePlay(cards, playerIndex)
    }
  }

  // 出牌
  const handlePlay = (cards?: Card[], playerIndex?: number) => {
    const idx = playerIndex ?? myIndex
    const cardsToPlay = cards || selectedCards
    if (!gameState || cardsToPlay.length === 0) return
    if (playerIndex === undefined && gameState.currentPlayer !== myIndex) return

    const play = classifyHand(cardsToPlay)
    if (!play) { if (playerIndex === undefined) setMessage('不是合法牌型'); return }

    if (gameState.lastPlay && gameState.passCount < 2 && playerIndex === undefined) {
      if (!canBeat(play, gameState.lastPlay)) { setMessage('打不过上家'); return }
    }

    const newHands = gameState.hands.map(h => [...h])
    newHands[idx] = newHands[idx].filter(c => !cardsToPlay.some(sc => sc.suit === c.suit && sc.rank === c.rank))
    const isWin = newHands[idx].length === 0
    const nextPlayer = (idx + 1) % 3

    setGameState({
      ...gameState, hands: newHands, lastPlay: { cards: cardsToPlay, type: play.type, player: idx, mainPower: play.mainPower },
      lastPlayer: idx, passCount: 0, currentPlayer: isWin ? idx : nextPlayer,
      winner: isWin ? idx : null, phase: isWin ? 'finished' : 'playing',
      message: isWin ? `${gameState.players[idx].name} 获胜！` : '',
    })

    if (playerIndex === undefined) setSelectedCards([])
  }

  // 过牌
  const handlePass = (playerIndex?: number) => {
    const idx = playerIndex ?? myIndex
    if (!gameState) return
    if (playerIndex === undefined && (!gameState.lastPlay || gameState.passCount >= 2)) return

    const newPassCount = gameState.passCount + 1
    const nextPlayer = (idx + 1) % 3

    setGameState({
      ...gameState, passCount: newPassCount >= 2 ? 0 : newPassCount,
      lastPlay: newPassCount >= 2 ? null : gameState.lastPlay, currentPlayer: nextPlayer,
    })

    if (playerIndex === undefined) setSelectedCards([])
  }

  // 开始AI对战
  const startAIGame = () => {
    const deck = shuffleDeck(createDeck())
    const [h1, h2, h3, lc] = dealCards(deck)
    const firstBidder = Math.floor(Math.random() * 3)
    setGameState({
      phase: 'bidding', hands: [h1, h2, h3], landlordCards: lc, landlord: null,
      currentPlayer: firstBidder, lastPlay: null, lastPlayer: null,
      passCount: 0, bidScores: [null, null, null], currentBidder: firstBidder,
      winner: null, players: [
        { id: 'me', name: playerName || '你', index: 0, isAI: false },
        { id: 'ai1', name: '电脑1', index: 1, isAI: true },
        { id: 'ai2', name: '电脑2', index: 2, isAI: true },
      ],
      message: `${firstBidder === 0 ? '你' : `电脑${firstBidder}`} 请叫分`,
    })
    setMyIndex(0)
  }

  const toggleCard = (card: Card) => {
    setSelectedCards(prev => {
      const exists = prev.some(c => c.suit === card.suit && c.rank === card.rank)
      return exists ? prev.filter(c => !(c.suit === card.suit && c.rank === card.rank)) : [...prev, card]
    })
  }

  // 渲染牌
  const renderCard = (card: Card, selected = false, onClick?: () => void, small = false) => {
    const suit = SUIT_SYMBOLS[card.suit] || ''
    const color = SUIT_COLORS[card.suit] || '#000'
    const isJoker = card.rank === 'small_joker' || card.rank === 'big_joker'
    const size = small ? 'w-10 h-14 text-xs' : 'w-12 h-16 sm:w-14 sm:h-20 text-sm'

    return (
      <div onClick={onClick} className={`${size} rounded-md cursor-pointer transition-all flex-shrink-0
        ${selected ? 'transform -translate-y-2 ring-2 ring-yellow-400' : 'hover:-translate-y-1'}
        bg-white shadow border border-gray-200 relative`}>
        {isJoker ? (
          <div className="flex flex-col items-center justify-center h-full">
            <span className="font-bold" style={{ color: card.rank === 'big_joker' ? '#e94560' : '#000', fontSize: small ? '8px' : '10px' }}>JOKER</span>
            <span style={{ fontSize: small ? '12px' : '16px' }}>{card.rank === 'big_joker' ? '👑' : '🃏'}</span>
          </div>
        ) : (
          <>
            <div className="absolute top-0.5 left-1 font-bold" style={{ color, fontSize: small ? '8px' : '10px' }}>{card.rank}</div>
            <div className="absolute top-3 left-1" style={{ color, fontSize: small ? '10px' : '12px' }}>{suit}</div>
            <div className="flex items-center justify-center h-full" style={{ fontSize: small ? '14px' : '18px', color }}>{suit}</div>
          </>
        )}
      </div>
    )
  }

  // 游戏界面
  if (gameState) {
    const isMyTurn = gameState.currentPlayer === myIndex
    const isBidding = gameState.phase === 'bidding'
    const isPlaying = gameState.phase === 'playing'
    const isLandlord = gameState.landlord === myIndex

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-2 sm:p-4">
        {/* 顶部 */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={() => { setGameState(null); setIsConnected(false); setIsHost(false); setRoomCode(''); setMessage('') }}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs sm:text-sm">← 返回</button>
            <h1 className="text-lg sm:text-2xl font-bold text-yellow-400">🃏 斗地主</h1>
          </div>
          <div className="text-xs sm:text-sm text-gray-400">
            {isLandlord ? '👑 地主' : gameState.landlord !== null ? '👨‍🌾 农民' : '叫分中'} | {gameState.hands[myIndex]?.length || 0}张
          </div>
        </div>

        {/* 其他玩家 */}
        <div className="flex justify-between gap-2 mb-3">
          {gameState.players.filter((_, i) => i !== myIndex).map(p => (
            <div key={p.id} className="bg-gray-800 rounded-lg p-2 flex-1 min-w-0">
              <div className="text-xs sm:text-sm font-bold text-yellow-400 truncate">
                {p.name} {gameState.landlord === p.index ? '👑' : ''} {p.isAI ? '🤖' : ''}
              </div>
              <div className="text-xs text-gray-400">{gameState.hands[p.index]?.length || 0}张</div>
              {gameState.currentPlayer === p.index && <div className="text-xs text-green-400 animate-pulse">思考中...</div>}
            </div>
          ))}
        </div>

        {/* 地主牌 */}
        <div className="bg-gray-800 rounded-lg p-2 mb-3">
          <div className="text-xs text-gray-400 mb-1">地主牌</div>
          <div className="flex gap-1 justify-center">
            {gameState.landlordCards.map((c, i) => <div key={i} className="scale-75">{renderCard(c, false, undefined, true)}</div>)}
          </div>
        </div>

        {/* 出牌区 */}
        <div className="bg-gray-700 rounded-lg p-3 mb-3 min-h-[80px] sm:min-h-[100px]">
          {gameState.lastPlay ? (
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">{gameState.players[gameState.lastPlayer || 0]?.name} 出牌:</div>
              <div className="flex justify-center gap-1 flex-wrap">
                {gameState.lastPlay.cards.map((c, i) => <div key={i} className="scale-90">{renderCard(c, false, undefined, true)}</div>)}
              </div>
              <div className="text-xs text-yellow-400 mt-1">{CARD_TYPE_NAMES[gameState.lastPlay.type]}</div>
            </div>
          ) : (
            <div className="text-center text-gray-500 text-sm">等待出牌...</div>
          )}
        </div>

        {/* 状态消息 */}
        {gameState.message && <div className="text-center text-sm text-yellow-400 mb-2">{gameState.message}</div>}

        {/* 我的手牌 */}
        <div className="bg-gray-800 rounded-lg p-2 mb-3 overflow-x-auto">
          <div className="flex gap-1 justify-center flex-wrap">
            {(gameState.hands[myIndex] || []).map((c, i) => (
              <div key={`${c.suit}-${c.rank}-${i}`}>
                {renderCard(c, selectedCards.some(s => s.suit === c.suit && s.rank === c.rank), () => toggleCard(c))}
              </div>
            ))}
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex justify-center gap-3 flex-wrap">
          {isBidding && gameState.currentBidder === myIndex && (
            <>
              {[1, 2, 3].map(s => (
                <button key={s} onClick={() => handleBid(s)} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded font-bold text-sm sm:text-base">{s}分</button>
              ))}
              <button onClick={() => handleBid(0)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm sm:text-base">不叫</button>
            </>
          )}
          {isPlaying && isMyTurn && (
            <>
              <button onClick={() => handlePlay()} disabled={selectedCards.length === 0}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded font-bold disabled:opacity-50 text-sm sm:text-base">出牌</button>
              {gameState.lastPlay && gameState.passCount < 2 && (
                <button onClick={() => handlePass()} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm sm:text-base">不出</button>
              )}
            </>
          )}
          {gameState.phase === 'finished' && (
            <button onClick={() => { setGameState(null); setIsConnected(false); }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold text-sm sm:text-base">再来一局</button>
          )}
        </div>
      </div>
    )
  }

  // 大厅界面
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full">
        <h1 className="text-2xl font-bold text-center text-yellow-400 mb-6">🃏 斗地主</h1>

        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-1">你的昵称</label>
          <input type="text" value={playerName} onChange={e => setPlayerName(e.target.value)}
            placeholder="输入昵称" className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" />
        </div>

        <div className="space-y-3">
          {!isConnected ? (
            <>
              <button onClick={createRoom} className="w-full py-2 bg-green-600 hover:bg-green-500 rounded-lg font-bold">创建房间</button>
              <div className="flex gap-2">
                <input type="text" value={roomCode} onChange={e => setRoomCode(e.target.value)}
                  placeholder="房间号" className="flex-1 px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" maxLength={6} />
                <button onClick={joinRoom} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold">加入</button>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="text-lg text-yellow-400 mb-2">房间号: {roomCode}</div>
              <div className="text-sm text-gray-400 mb-3">等待玩家加入...</div>
              {isHost && (
                <button onClick={startOnlineGame} className="w-full py-2 bg-green-600 hover:bg-green-500 rounded-lg font-bold">开始游戏</button>
              )}
            </div>
          )}

          <button onClick={startAIGame} className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold">🤖 单人模式</button>
        </div>

        {message && <div className="mt-4 text-center text-sm text-gray-400">{message}</div>}
      </div>
    </div>
  )
}
