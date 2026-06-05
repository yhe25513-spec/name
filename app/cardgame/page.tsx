'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, createDeck, shuffleDeck, dealCards, classifyHand, canBeat } from '@/lib/cardgame/logic'
import { SupabaseClient } from '@/lib/cardgame/supabase'
import { AIPlayer, resetPlayedCards, recordPlayedCards } from '@/lib/cardgame/ai'

const CARD_TYPE_NAMES: Record<string, string> = {
  SINGLE: '单张', PAIR: '对子', TRIPLE: '三条',
  TRIPLE_ONE: '三带一', TRIPLE_TWO: '三带二', STRAIGHT: '顺子',
  STRAIGHT_PAIR: '连对', AIRPLANE: '飞机', BOMB: '炸弹', ROCKET: '火箭',
}

const SUIT_SYMBOLS: Record<string, string> = { spade: '♠', heart: '♥', club: '♣', diamond: '♦' }
const SUIT_COLORS: Record<string, string> = { spade: '#000', heart: '#e94560', club: '#000', diamond: '#e94560' }

interface Player { id: string; name: string; index: number; isAI: boolean }
interface GameState {
  phase: 'waiting' | 'bidding' | 'playing' | 'finished'
  hands: Card[][]; landlordCards: Card[]; landlord: number | null
  currentPlayer: number; lastPlay: { cards: Card[]; type: string; player: number; mainPower?: number } | null
  lastPlayer: number | null; passCount: number; bidScores: (number | null)[]
  currentBidder: number; winner: number | null; players: Player[]; message: string
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
  const [players, setPlayers] = useState<any[]>([])

  const supabaseRef = useRef<SupabaseClient | null>(null)
  const aiRef = useRef<AIPlayer | null>(null)
  const unsubscribeRef = useRef<(() => void) | undefined>(undefined)
  const gameStateRef = useRef<GameState | null>(null)

  // 保持 ref 同步
  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  useEffect(() => {
    supabaseRef.current = new SupabaseClient()
    aiRef.current = new AIPlayer()
    return () => { if (unsubscribeRef.current) unsubscribeRef.current() }
  }, [])

  // AI回合 - 叫分阶段监听 currentBidder，出牌阶段监听 currentPlayer
  useEffect(() => {
    if (!gameState || gameState.phase === 'finished') return
    console.log('[AI useEffect] 触发, phase:', gameState.phase, 'currentBidder:', gameState.currentBidder, 'currentPlayer:', gameState.currentPlayer)

    // 根据阶段决定监听哪个玩家
    const activePlayer = gameState.phase === 'bidding' ? gameState.currentBidder : gameState.currentPlayer
    const current = gameState.players[activePlayer]
    if (!current?.isAI) {
      console.log('[AI useEffect] 当前玩家不是AI:', activePlayer)
      return
    }
    if (activePlayer === myIndex) {
      console.log('[AI useEffect] 当前是玩家自己:', myIndex)
      return
    }

    console.log('[AI触发] 玩家:', activePlayer, '阶段:', gameState.phase, '当前:', current.name, 'currentBidder:', gameState.currentBidder)

    const timeout = setTimeout(async () => {
      const latest = gameStateRef.current
      if (!latest || latest.phase === 'finished') return
      const latestPlayer = latest.phase === 'bidding' ? latest.currentBidder : latest.currentPlayer
      console.log('[AI执行] 玩家:', latestPlayer, '阶段:', latest.phase)

      try {
        if (latest.phase === 'bidding') {
          await aiBid(latest.currentBidder)
        } else if (latest.phase === 'playing') {
          await aiPlay(latest.currentPlayer)
        }
      } catch (e) {
        console.error('[AI错误]', e)
        // 如果AI出错，跳到下一个玩家
        if (latest.phase === 'bidding') {
          const nextBidder = (latest.currentBidder + 1) % 3
          await syncGameState({ ...latest, currentBidder: nextBidder })
        }
      }
    }, 800)
    return () => clearTimeout(timeout)
  }, [gameState?.currentBidder, gameState?.currentPlayer, gameState?.phase])

  // 同步游戏状态
  const syncGameState = async (newState: GameState) => {
    console.log('[同步] 更新状态, currentBidder:', newState.currentBidder, '阶段:', newState.phase)
    setGameState(newState)
    if (roomCode && supabaseRef.current) {
      await supabaseRef.current.updateGameState(roomCode, newState)
    }
  }

  // 订阅房间
  const subscribeToRoom = (code: string) => {
    if (unsubscribeRef.current) unsubscribeRef.current()
    unsubscribeRef.current = supabaseRef.current?.subscribeRoom(code, {
      onGameUpdate: (state: any) => {
        setGameState({
          ...state,
          hands: state.hands?.map((h: any[]) => h.map((c: any) => ({ suit: c.suit, rank: c.rank }))) || [],
          landlordCards: state.landlordCards?.map((c: any) => ({ suit: c.suit, rank: c.rank })) || [],
        })
      },
      onGameStart: (state: any) => {
        const hands = state.hands?.map((h: any[]) => h.map((c: any) => ({ suit: c.suit, rank: c.rank }))) || []
        const myIdx = state.players?.findIndex((p: any) => p.name === playerName) ?? 0
        setMyIndex(myIdx)
        setGameState({
          ...state, hands,
          landlordCards: state.landlordCards?.map((c: any) => ({ suit: c.suit, rank: c.rank })) || [],
        })
      },
      onPlayerJoin: (newPlayers: any[]) => {
        setPlayers(newPlayers)
      },
    })
  }

  // 创建房间
  const createRoom = async () => {
    if (!playerName.trim()) { setMessage('请输入昵称'); return }
    setMessage('创建中...')
    const room = await supabaseRef.current?.createRoom(playerName)
    if (room) {
      setRoomCode(room.room_code)
      setIsConnected(true)
      setIsHost(true)
      setMyIndex(0)
      setPlayers(room.players || [])
      setMessage(`房间号: ${room.room_code}，等待玩家加入...`)
      subscribeToRoom(room.room_code)
    }
  }

  // 加入房间
  const joinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) { setMessage('请输入昵称和房间号'); return }
    const room = await supabaseRef.current?.joinRoom(roomCode, playerName)
    if (room) {
      setIsConnected(true)
      setIsHost(false)
      setPlayers(room.players || [])
      const myIdx = room.players?.findIndex((p: any) => p.name === playerName) ?? 0
      setMyIndex(myIdx >= 0 ? myIdx : room.players.length - 1)
      setMessage('已加入，等待房主开始...')
      subscribeToRoom(room.room_code)
      supabaseRef.current?.broadcastPlayerJoin(room.room_code, room.players)
    } else {
      setMessage('房间不存在或已满')
    }
  }

  // 开始在线游戏
  const startOnlineGame = async () => {
    if (!isHost || !roomCode) return
    const room = await supabaseRef.current?.getRoom(roomCode)
    if (!room || !room.players) { setMessage('房间不存在'); return }

    resetPlayedCards()
    const deck = shuffleDeck(createDeck())
    const [h1, h2, h3, lc] = dealCards(deck)
    const allPlayers = room.players.map((p: any, i: number) => ({ id: p.name, name: p.name, index: i, isAI: false }))
    while (allPlayers.length < 3) {
      allPlayers.push({ id: `ai${allPlayers.length}`, name: `电脑${allPlayers.length}`, index: allPlayers.length, isAI: true })
    }

    const firstBidder = Math.floor(Math.random() * 3)
    const state: GameState = {
      phase: 'bidding', hands: [h1, h2, h3], landlordCards: lc, landlord: null,
      currentPlayer: firstBidder, lastPlay: null, lastPlayer: null,
      passCount: 0, bidScores: [null, null, null], currentBidder: firstBidder,
      winner: null, players: allPlayers, message: `${allPlayers[firstBidder].name} 请叫分`,
    }
    await supabaseRef.current?.startGame(roomCode, state)
    setGameState(state)
  }

  // 开始AI对战
  const startAIGame = () => {
    resetPlayedCards()
    const deck = shuffleDeck(createDeck())
    const [h1, h2, h3, lc] = dealCards(deck)
    const firstBidder = Math.floor(Math.random() * 3)
    console.log('[开始游戏] 首个叫分:', firstBidder, 'myIndex:', myIndex)
    setGameState({
      phase: 'bidding', hands: [h1, h2, h3], landlordCards: lc, landlord: null,
      currentPlayer: firstBidder, lastPlay: null, lastPlayer: null,
      passCount: 0, bidScores: [null, null, null], currentBidder: firstBidder,
      winner: null, players: [
        { id: 'me', name: playerName || '你', index: 0, isAI: false },
        { id: 'ai1', name: '电脑1', index: 1, isAI: true },
        { id: 'ai2', name: '电脑2', index: 2, isAI: true },
      ], message: `等待叫分...`,
    })
    setMyIndex(0)
  }

  // AI叫分
  const aiBid = async (playerIndex: number) => {
    const latest = gameStateRef.current
    if (!latest || !aiRef.current) {
      console.log('[AI叫分] 状态为空')
      return
    }
    const hand = latest.hands[playerIndex]
    if (!hand) {
      console.log('[AI叫分] 手牌为空, playerIndex:', playerIndex)
      return
    }
    console.log('[AI叫分] 手牌数:', hand.length, '当前叫分:', latest.currentBidder, 'AI玩家:', latest.players[playerIndex].name)
    const handCount = latest.hands.map(h => h.length)
    const score = await aiRef.current.decideBid(hand, handCount)
    console.log('[AI叫分] 结果:', score, '玩家:', latest.players[playerIndex].name)
    await handleBid(score, playerIndex)
  }

  // 叫分
  const handleBid = async (score: number, playerIndex?: number) => {
    const latest = gameStateRef.current
    if (!latest) return
    const idx = playerIndex ?? myIndex
    if (playerIndex === undefined && latest.currentBidder !== myIndex) return

    const newBidScores = [...latest.bidScores]
    newBidScores[idx] = score

    if (score === 3) {
      await setLandlord(idx, newBidScores)
      return
    }

    const nextBidder = (idx + 1) % 3
    const bidsCompleted = newBidScores.filter(s => s !== null).length

    if (bidsCompleted >= 3) {
      const maxScore = Math.max(...newBidScores.filter(s => s !== null) as number[])
      if (maxScore === 0) {
        if (isHost && roomCode) await startOnlineGame()
        else startAIGame()
        return
      }
      const landlordIndex = newBidScores.findIndex(s => s === maxScore)
      await setLandlord(landlordIndex, newBidScores)
    } else {
      // 创建新的状态对象，确保引用不同
      const newState: GameState = {
        ...latest,
        bidScores: newBidScores,
        currentBidder: nextBidder,
        message: `${latest.players[nextBidder].name} 请叫分`,
      }
      console.log('[叫分] 下一个叫分:', nextBidder, '玩家:', latest.players[nextBidder].name)
      await syncGameState(newState)
    }
  }

  // 设置地主
  const setLandlord = async (playerIndex: number, bidScores: (number | null)[]) => {
    const latest = gameStateRef.current
    if (!latest) return
    const newHands = latest.hands.map(h => [...h])
    newHands[playerIndex] = [...newHands[playerIndex], ...latest.landlordCards]

    await syncGameState({
      ...latest, phase: 'playing', hands: newHands, landlord: playerIndex,
      currentPlayer: playerIndex, bidScores, lastPlay: null, lastPlayer: null, passCount: 0,
      message: `${latest.players[playerIndex].name} 成为地主！请出牌`,
    })
  }

  // AI出牌
  const aiPlay = async (playerIndex: number) => {
    const latest = gameStateRef.current
    if (!latest || !aiRef.current) return
    const hand = latest.hands[playerIndex]
    if (!hand) return
    const mustFollow = latest.passCount >= 2 ? null : latest.lastPlay
    const handCount = latest.hands.map(h => h.length)
    const isLandlord = latest.landlord === playerIndex
    const name = latest.players[playerIndex]?.name || 'AI'

    const followPlay = mustFollow ? { cards: mustFollow.cards, type: mustFollow.type as any, mainPower: mustFollow.mainPower || 0 } : null
    const cards = await aiRef.current.decidePlay(hand, followPlay, handCount, isLandlord, name, [])

    if (cards === null) await handlePass(playerIndex)
    else { recordPlayedCards(cards); await handlePlay(cards, playerIndex) }
  }

  // 出牌
  const handlePlay = async (cards?: Card[], playerIndex?: number) => {
    const latest = gameStateRef.current
    if (!latest) return
    const idx = playerIndex ?? myIndex
    const cardsToPlay = cards || selectedCards
    if (cardsToPlay.length === 0) return
    if (playerIndex === undefined && latest.currentPlayer !== myIndex) return

    const play = classifyHand(cardsToPlay)
    if (!play) { if (playerIndex === undefined) setMessage('不是合法牌型'); return }

    if (latest.lastPlay && latest.passCount < 2 && playerIndex === undefined) {
      if (!canBeat(play, latest.lastPlay)) { setMessage('打不过上家'); return }
    }

    recordPlayedCards(cardsToPlay)
    const newHands = latest.hands.map(h => [...h])
    newHands[idx] = newHands[idx].filter(c => !cardsToPlay.some(sc => sc.suit === c.suit && sc.rank === c.rank))
    const isWin = newHands[idx].length === 0
    const nextPlayer = (idx + 1) % 3

    await syncGameState({
      ...latest, hands: newHands, lastPlay: { cards: cardsToPlay, type: play.type, player: idx, mainPower: play.mainPower },
      lastPlayer: idx, passCount: 0, currentPlayer: isWin ? idx : nextPlayer,
      winner: isWin ? idx : null, phase: isWin ? 'finished' : 'playing',
      message: isWin ? `${latest.players[idx].name} 获胜！` : '',
    })
    if (playerIndex === undefined) setSelectedCards([])
  }

  // 过牌
  const handlePass = async (playerIndex?: number) => {
    const latest = gameStateRef.current
    if (!latest) return
    const idx = playerIndex ?? myIndex
    if (playerIndex === undefined && (!latest.lastPlay || latest.passCount >= 2)) return

    const newPassCount = latest.passCount + 1
    const nextPlayer = (idx + 1) % 3

    await syncGameState({
      ...latest, passCount: newPassCount >= 2 ? 0 : newPassCount,
      lastPlay: newPassCount >= 2 ? null : latest.lastPlay, currentPlayer: nextPlayer,
    })
    if (playerIndex === undefined) setSelectedCards([])
  }

  const toggleCard = (card: Card) => {
    setSelectedCards(prev => {
      const exists = prev.some(c => c.suit === card.suit && c.rank === card.rank)
      return exists ? prev.filter(c => !(c.suit === card.suit && c.rank === card.rank)) : [...prev, card]
    })
  }

  const renderCard = (card: Card, selected = false, onClick?: () => void, small = false) => {
    const suit = SUIT_SYMBOLS[card.suit] || ''
    const color = card.rank === 'big_joker' ? '#e94560' : card.rank === 'small_joker' ? '#000' : (SUIT_COLORS[card.suit as keyof typeof SUIT_COLORS] || '#000')
    const isJoker = card.rank === 'small_joker' || card.rank === 'big_joker'
    const sizeClass = small ? 'w-8 h-11 sm:w-10 sm:h-14' : 'w-9 h-12 sm:w-11 sm:h-15 md:w-12 md:h-16'

    return (
      <div onClick={onClick} className={`${sizeClass} rounded cursor-pointer transition-all flex-shrink-0
        ${selected ? 'transform -translate-y-2 ring-2 ring-yellow-400' : ''}
        bg-white shadow border border-gray-200 relative`}>
        {isJoker ? (
          <div className="flex flex-col items-center justify-center h-full">
            <span className="font-bold" style={{ color: card.rank === 'big_joker' ? '#e94560' : '#000', fontSize: small ? '6px' : '8px' }}>JOKER</span>
            <span style={{ fontSize: small ? '10px' : '12px' }}>{card.rank === 'big_joker' ? '👑' : '🃏'}</span>
          </div>
        ) : (
          <>
            <div className="absolute top-0 left-0.5 font-bold leading-none" style={{ color, fontSize: small ? '6px' : '8px' }}>{card.rank}</div>
            <div className="absolute top-2 left-0.5" style={{ color, fontSize: small ? '7px' : '9px' }}>{suit}</div>
            <div className="flex items-center justify-center h-full" style={{ fontSize: small ? '10px' : '14px', color }}>{suit}</div>
          </>
        )}
      </div>
    )
  }

  // 游戏界面
  if (gameState) {
    const isMyTurn = gameState.currentPlayer === myIndex
    const isLandlord = gameState.landlord === myIndex

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-2 sm:p-4">
        <div className="flex justify-between items-center mb-2 sm:mb-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={() => { setGameState(null); setIsConnected(false); setIsHost(false); setRoomCode(''); setMessage(''); setPlayers([]) }}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs sm:text-sm">← 返回</button>
            <h1 className="text-lg sm:text-2xl font-bold text-yellow-400">🃏 斗地主</h1>
          </div>
          <div className="text-xs sm:text-sm text-gray-400">
            {isLandlord ? '👑 地主' : gameState.landlord !== null ? '👨‍🌾 农民' : '叫分阶段'} | {gameState.hands[myIndex]?.length || 0}张
          </div>
        </div>

        <div className="flex justify-between gap-2 mb-2 sm:mb-3">
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

        <div className="bg-gray-800 rounded-lg p-2 mb-2 sm:mb-3">
          <div className="text-xs text-gray-400 mb-1">地主牌</div>
          <div className="flex gap-1 justify-center">
            {gameState.landlordCards.map((c, i) => <div key={i} className="scale-75">{renderCard(c, false, undefined, true)}</div>)}
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-2 sm:p-3 mb-2 sm:mb-3 min-h-[70px] sm:min-h-[90px]">
          {gameState.lastPlay ? (
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">{gameState.players[gameState.lastPlayer || 0]?.name} 出牌:</div>
              <div className="flex justify-center gap-1 flex-wrap">
                {gameState.lastPlay.cards.map((c, i) => <div key={i} className="scale-90">{renderCard(c, false, undefined, true)}</div>)}
              </div>
              <div className="text-xs text-yellow-400 mt-1">{CARD_TYPE_NAMES[gameState.lastPlay.type]}</div>
            </div>
          ) : (
            <div className="text-center text-gray-500 text-sm py-4">等待出牌...</div>
          )}
        </div>

        {gameState.message && <div className="text-center text-sm text-yellow-400 mb-2">{gameState.message}</div>}

        <div className="bg-gray-800 rounded-lg p-2 mb-2 sm:mb-3 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="flex gap-0.5 sm:gap-1 justify-start sm:justify-center flex-nowrap min-w-min">
            {(gameState.hands[myIndex] || []).map((c, i) => (
              <div key={`${c.suit}-${c.rank}-${i}`} className="flex-shrink-0">
                {renderCard(c, selectedCards.some(s => s.suit === c.suit && s.rank === c.rank), () => toggleCard(c))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-2 sm:gap-3 flex-wrap">
          {gameState.phase === 'bidding' && gameState.currentBidder === myIndex && (
            <>
              {[1, 2, 3].map(s => (
                <button key={s} onClick={() => handleBid(s)} className="px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-500 rounded font-bold text-sm">{s}分</button>
              ))}
              <button onClick={() => handleBid(0)} className="px-3 sm:px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm">不叫</button>
            </>
          )}
          {gameState.phase === 'playing' && isMyTurn && (
            <>
              <button onClick={() => handlePlay()} disabled={selectedCards.length === 0}
                className="px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-500 rounded font-bold disabled:opacity-50 text-sm">出牌</button>
              {gameState.lastPlay && gameState.passCount < 2 && (
                <button onClick={() => handlePass()} className="px-3 sm:px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm">不出</button>
              )}
            </>
          )}
          {gameState.phase === 'finished' && (
            <button onClick={() => {
              if (isHost && roomCode) startOnlineGame()
              else if (!isConnected) setGameState(null)
              else startOnlineGame()
            }} className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold text-sm">再来一局</button>
          )}
        </div>
      </div>
    )
  }

  // 大厅
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full">
        <div className="flex items-center justify-between mb-6">
          <a href="/" className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">← 返回首页</a>
          <h1 className="text-2xl font-bold text-yellow-400">🃏 斗地主</h1>
          <div className="w-20"></div>
        </div>
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
                  placeholder="房间号" className="flex-1 px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none" />
                <button onClick={joinRoom} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold">加入</button>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="text-lg text-yellow-400 mb-2">房间号: {roomCode}</div>
              <div className="text-sm text-gray-400 mb-2">玩家: {players.map((p: any) => p.name).join(', ')}</div>
              {isHost && <button onClick={startOnlineGame} className="w-full py-2 bg-green-600 hover:bg-green-500 rounded-lg font-bold">开始游戏</button>}
            </div>
          )}
          <button onClick={startAIGame} className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold">🤖 单人模式</button>
        </div>
        {message && <div className="mt-4 text-center text-sm text-gray-400">{message}</div>}
      </div>
    </div>
  )
}
