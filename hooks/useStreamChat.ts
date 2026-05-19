'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { ConversationMessage, GameState, GameScenario, AIResponse } from '@/lib/types'
import { parseAIResponse, applyStateChanges } from '@/lib/deepseek'
import { apiFetch } from '@/lib/api-client'
import { toast } from 'sonner'

export interface UseStreamChatOptions {
  scenario: GameScenario
  saveId?: string
  isSandbox?: boolean
}

export interface GameStateUpdate {
  messages: ConversationMessage[]
  gameState: GameState
  turnCount: number
}

export function useStreamChat({ scenario, saveId, isSandbox = false }: UseStreamChatOptions) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [quickOptions, setQuickOptions] = useState<string[]>([])
  const [atmosphereHint, setAtmosphereHint] = useState<AIResponse['atmosphereHint']>('normal')
  const pendingCharsRef = useRef('')

  // 打字机效果：用 requestAnimationFrame 批量刷新，减少 setState 次数
  useEffect(() => {
    if (!isStreaming) return
    let rafId: number

    function flush() {
      if (pendingCharsRef.current.length > 0) {
        // 每帧批量提交 4 个字符，减少渲染次数
        const batch = pendingCharsRef.current.slice(0, 4)
        pendingCharsRef.current = pendingCharsRef.current.slice(batch.length)
        setStreamingText(prev => {
          // 过滤 "undefined" 及其中间态，防止跨 chunk 拼合时逐字显示
          const next = prev + batch
          const cleaned = next.replace(/undefined/g, '')
          const partials = ['u', 'un', 'und', 'unde', 'undef', 'undefi', 'undefin', 'undefine']
          for (const p of partials) {
            if (cleaned.endsWith(p)) return cleaned.slice(0, -p.length)
          }
          return cleaned
        })
      }
      rafId = requestAnimationFrame(flush)
    }

    rafId = requestAnimationFrame(flush)
    return () => cancelAnimationFrame(rafId)
  }, [isStreaming])

  /** 调用流式 API 并返回完整响应文本 */
  const streamChat = useCallback(async (
    userInput: string,
    state: GameState,
    history: ConversationMessage[],
  ): Promise<{ fullText: string }> => {
    const res = await apiFetch('/api/game/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userInput,
        scenario,
        state,
        history,
        saveId: isSandbox ? undefined : saveId,
        isSandbox,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'API error')
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder('utf-8')
    let fullText = ''
    let lineBuf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const parts = (lineBuf + chunk).split('\n')
      lineBuf = parts.pop() || ''

      for (const raw of parts) {
        const line = raw.trim()
        if (!line) continue
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') break
        try {
          const parsed = JSON.parse(data)
          if (parsed.content) {
            fullText += parsed.content
            pendingCharsRef.current += parsed.content
          }
        } catch {
          // 忽略解析错误
        }
      }
    }

    return { fullText }
  }, [scenario, saveId, isSandbox])

  /** 发送玩家消息，返回更新后的游戏状态 */
  const sendMessage = useCallback(async (
    userInput: string,
    current: GameStateUpdate,
    autoSave?: (history: ConversationMessage[], state: GameState, turnCount: number) => Promise<void>,
  ): Promise<GameStateUpdate | null> => {
    if (isStreaming) return null

    const userMsg: ConversationMessage = {
      role: 'user',
      content: userInput,
      timestamp: new Date().toISOString(),
    }

    const updatedHistory = [...current.messages, userMsg]
    setIsStreaming(true)
    setStreamingText('')
    pendingCharsRef.current = ''

    try {
      const { fullText } = await streamChat(userInput, current.gameState, updatedHistory)

      // 刷新打字缓冲区剩余字符
      if (pendingCharsRef.current) {
        setStreamingText(prev => prev + pendingCharsRef.current)
        pendingCharsRef.current = ''
      }

      const aiResponse = parseAIResponse(fullText)
      const newGameState = applyStateChanges(current.gameState, aiResponse.stateChanges)

      const aiMsg: ConversationMessage = {
        role: 'assistant',
        content: aiResponse.narration || fullText,
        timestamp: new Date().toISOString(),
      }

      const finalHistory = [...updatedHistory, aiMsg]
      const newTurnCount = current.turnCount + 1

      setQuickOptions(aiResponse.options || [])
      setAtmosphereHint(aiResponse.atmosphereHint || 'normal')
      setStreamingText('')

      const update: GameStateUpdate = {
        messages: finalHistory,
        gameState: newGameState,
        turnCount: newTurnCount,
      }

      if (!isSandbox && autoSave) {
        autoSave(finalHistory, newGameState, newTurnCount).catch(() => {
          toast.error('自动保存失败')
        })
      }

      return update
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      toast.error('AI 响应失败', { description: msg })
      return null
    } finally {
      setIsStreaming(false)
    }
  }, [isStreaming, streamChat, isSandbox])

  /** 发送开场剧情请求 */
  const sendOpeningScene = useCallback(async (
    current: GameStateUpdate,
    autoSave?: (history: ConversationMessage[], state: GameState, turnCount: number) => Promise<void>,
  ): Promise<GameStateUpdate | null> => {
    if (isStreaming) return null

    // 检查是否有预设的第一回合剧情（玩家编辑的）
    const customOpening = scenario.initial_state?.gamePhase === '开场' ||
      scenario.system_prompt?.includes('第一回合剧情')

    if (customOpening && scenario.system_prompt) {
      return handleCustomOpening(scenario, current, autoSave, isSandbox, saveId)
    }

    // 没有预设开场，调用 AI 生成
    const openingMsg: ConversationMessage = {
      role: 'user',
      content: '【开场剧情】请根据当前场景的系统提示，输出完整的开场剧情，包括：环境描写、主角状态、当前处境、行动选项。',
      timestamp: new Date().toISOString(),
    }

    const updatedHistory = [...current.messages, openingMsg]
    setIsStreaming(true)
    setStreamingText('')
    pendingCharsRef.current = ''

    try {
      const { fullText } = await streamChat(openingMsg.content, current.gameState, updatedHistory)

      if (pendingCharsRef.current) {
        setStreamingText(prev => prev + pendingCharsRef.current)
        pendingCharsRef.current = ''
      }

      const aiResponse = parseAIResponse(fullText)
      const newGameState = applyStateChanges(current.gameState, aiResponse.stateChanges)

      const aiMsg: ConversationMessage = {
        role: 'assistant',
        content: aiResponse.narration || fullText,
        timestamp: new Date().toISOString(),
      }

      const finalHistory = [...updatedHistory, aiMsg]
      const newTurnCount = current.turnCount + 1

      setQuickOptions(aiResponse.options || [])
      setAtmosphereHint(aiResponse.atmosphereHint || 'normal')
      setStreamingText('')

      const update: GameStateUpdate = {
        messages: finalHistory,
        gameState: newGameState,
        turnCount: newTurnCount,
      }

      if (!isSandbox && autoSave) {
        autoSave(finalHistory, newGameState, newTurnCount).catch(() => {
          toast.error('自动保存失败')
        })
      }

      return update
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      toast.error('开场剧情加载失败', { description: msg })
      return null
    } finally {
      setIsStreaming(false)
    }
  }, [isStreaming, streamChat, scenario, isSandbox, saveId])

  return {
    sendMessage,
    sendOpeningScene,
    isStreaming,
    streamingText,
    quickOptions,
    setQuickOptions,
    atmosphereHint,
  }
}

/** 处理玩家预设的开场剧情 */
async function handleCustomOpening(
  scenario: GameScenario,
  current: GameStateUpdate,
  autoSave?: (history: ConversationMessage[], state: GameState, turnCount: number) => Promise<void>,
  isSandbox?: boolean,
  saveId?: string,
): Promise<GameStateUpdate | null> {
  const openingMatch = scenario.system_prompt?.match(/第一回合剧情[:：]([\s\S]*?)(?=初始行动选项|$)/)
  const optionsMatch = scenario.system_prompt?.match(/初始行动选项[:：]([\s\S]*?)(?=\n\n|$)/)

  if (!openingMatch) return null

  const openingText = openingMatch[1].trim()
  const optionsText = optionsMatch ? optionsMatch[1].trim() : ''

  const options = optionsText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && (line.match(/^\d+\./) || line.match(/^[-*]\s/) || line.length > 5))
    .map(line => line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, ''))
    .filter(line => line)

  const aiMsg: ConversationMessage = {
    role: 'assistant',
    content: openingText,
    timestamp: new Date().toISOString(),
  }

  const finalHistory = [aiMsg]
  const newGameState = { ...current.gameState, turn: 1, gamePhase: '进行中' }
  const newTurnCount = 1

  const update: GameStateUpdate = {
    messages: finalHistory,
    gameState: newGameState,
    turnCount: newTurnCount,
  }

  if (!isSandbox && autoSave) {
    autoSave(finalHistory, newGameState, newTurnCount).catch(() => {})
  }

  return update
}
