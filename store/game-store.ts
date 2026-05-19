'use client'

import { create } from 'zustand'
import { ConversationMessage, GameState } from '@/lib/types'
import type { GameStateUpdate } from '@/hooks/useStreamChat'

export interface GameStore {
  // Game data
  messages: ConversationMessage[]
  gameState: GameState
  turnCount: number
  saveId: string

  // Actions
  setMessages: (messages: ConversationMessage[]) => void
  setGameState: (state: GameState) => void
  setTurnCount: (turnCount: number) => void
  setSaveId: (saveId: string) => void

  /** 从 useStreamChat 的返回结果更新全部游戏状态 */
  updateFromStream: (update: GameStateUpdate) => void
  reset: () => void
}

const initialState = {
  messages: [] as ConversationMessage[],
  gameState: {} as GameState,
  turnCount: 0,
  saveId: '',
}

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setMessages: (messages) => set({ messages }),
  setGameState: (gameState) => set({ gameState }),
  setTurnCount: (turnCount) => set({ turnCount }),
  setSaveId: (saveId) => set({ saveId }),

  updateFromStream: (update) => set({
    messages: update.messages,
    gameState: update.gameState,
    turnCount: update.turnCount,
  }),

  reset: () => set(initialState),
}))
