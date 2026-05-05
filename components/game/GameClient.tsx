'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { GameSave, ConversationMessage, AIResponse, GameState, GameScenario } from '@/lib/types'
import { parseAIResponse, applyStateChanges } from '@/lib/deepseek'
import { StatusBar } from './StatusBar'
import { ChatArea } from './ChatArea'
import { InputArea } from './InputArea'
import { SidePanel } from './SidePanel'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Save, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface GameClientProps {
  initialSave: GameSave
  isSandbox?: boolean
}

export function GameClient({ initialSave, isSandbox = false }: GameClientProps) {
  const router = useRouter()
  const scenario = initialSave.scenario! as GameScenario

  const [messages, setMessages] = useState<ConversationMessage[]>(
    initialSave.conversation_history || []
  )
  const [state, setState] = useState<GameState>(initialSave.current_state)
  const [turnCount, setTurnCount] = useState(initialSave.turn_count)
  const [saveId, setSaveId] = useState(initialSave.id)

  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [quickOptions, setQuickOptions] = useState<string[]>([])
  const [atmosphereHint, setAtmosphereHint] = useState<AIResponse['atmosphereHint']>('normal')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const hasStartedRef = useRef(false)

  // 开场剧情发送函数（独立出来避免循环依赖）
  const sendOpeningScene = useCallback(async () => {
    if (isStreaming || hasStartedRef.current) return
    hasStartedRef.current = true

    // 检查是否有预设的第一回合剧情（玩家编辑的）
    const customOpening = scenario.initial_state?.gamePhase === '开场' ||
      scenario.system_prompt?.includes('第一回合剧情')

    // 如果场景有预设开场剧情，直接从system_prompt解析并显示
    if (customOpening && scenario.system_prompt) {
      // 尝试提取玩家编辑的"第一回合剧情"内容
      const openingMatch = scenario.system_prompt.match(/第一回合剧情[:：]([\s\S]*?)(?=初始行动选项|$)/)
      const optionsMatch = scenario.system_prompt.match(/初始行动选项[:：]([\s\S]*?)(?=\n\n|$)/)

      if (openingMatch) {
        const openingText = openingMatch[1].trim()
        const optionsText = optionsMatch ? optionsMatch[1].trim() : ''

        // 解析选项（按行分割，支持 1. 2. 3. 或 - 或 * 格式）
        const options = optionsText
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && (line.match(/^\d+\./) || line.match(/^[-*]\s/) || line.length > 5))
          .map(line => line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, ''))
          .filter(line => line)

        // 构建AI消息，显示玩家预设的剧情
        const aiMsg: ConversationMessage = {
          role: 'assistant',
          content: openingText,
          timestamp: new Date().toISOString(),
        }

        const finalHistory: ConversationMessage[] = [aiMsg]
        const newTurnCount = 1
        const newState = { ...state, turn: 1, gamePhase: '进行中' }

        setMessages(finalHistory)
        setState(newState)
        setTurnCount(newTurnCount)
        setQuickOptions(options.length > 0 ? options : ['探索周围', '原地休息', '整理物品', '查看状态'])
        setAtmosphereHint('normal')

        // 自动保存
        if (!isSandbox) {
          await autoSave(finalHistory, newState, newTurnCount, saveId)
        }
        return
      }
    }

    // 如果没有预设开场，调用AI生成
    const openingMsg: ConversationMessage = {
      role: 'user',
      content: '【开场剧情】请根据当前场景的系统提示，输出完整的开场剧情，包括：环境描写、主角状态、当前处境、行动选项。',
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, openingMsg])
    setIsStreaming(true)
    setStreamingText('')

    try {
      const openingHistory = [...messages, openingMsg]
      const res = await fetch('/api/game/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: openingMsg.content,
          scenario,
          state,
          history: openingHistory,
          saveId: isSandbox ? undefined : saveId,
          isSandbox,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'API error')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter((l) => l.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                fullText += parsed.content
                setStreamingText(fullText)
              }
            } catch {
              // ignore
            }
          }
        }
      }

      const aiResponse = parseAIResponse(fullText)
      const newState = applyStateChanges(state, aiResponse.stateChanges)

      const aiMsg: ConversationMessage = {
        role: 'assistant',
        content: aiResponse.narration || fullText,
        timestamp: new Date().toISOString(),
      }

      const finalHistory = [...messages, openingMsg, aiMsg]
      const newTurnCount = turnCount + 1

      setMessages(finalHistory)
      setState(newState)
      setTurnCount(newTurnCount)
      setQuickOptions(aiResponse.options || [])
      setAtmosphereHint(aiResponse.atmosphereHint || 'normal')
      setStreamingText('')

      // 自动保存
      if (!isSandbox) {
        await autoSave(finalHistory, newState, newTurnCount, saveId)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      toast.error('开场剧情加载失败', { description: msg })
      hasStartedRef.current = false // 重置以便重试
    } finally {
      setIsStreaming(false)
    }
  }, [isStreaming, messages, state, turnCount, saveId, scenario, isSandbox])

  // 第一回合自动触发开场
  useEffect(() => {
    if (turnCount === 0 && messages.length === 0) {
      const timer = setTimeout(() => {
        sendOpeningScene()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [turnCount, messages.length, sendOpeningScene])

  const sendMessage = useCallback(async (userInput: string) => {
    if (isStreaming) return

    const userMsg: ConversationMessage = {
      role: 'user',
      content: userInput,
      timestamp: new Date().toISOString(),
    }

    const updatedHistory = [...messages, userMsg]
    setMessages(updatedHistory)
    setIsStreaming(true)
    setStreamingText('')

    try {
      const res = await fetch('/api/game/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput,
          scenario,
          state,
          history: updatedHistory,
          saveId: isSandbox ? undefined : saveId,
          isSandbox,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'API error')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter((l) => l.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                fullText += parsed.content
                setStreamingText(fullText)
              }
            } catch {
              // ignore
            }
          }
        }
      }

      // 解析 AI 响应
      const aiResponse = parseAIResponse(fullText)
      const newState = applyStateChanges(state, aiResponse.stateChanges)

      const aiMsg: ConversationMessage = {
        role: 'assistant',
        content: aiResponse.narration || fullText,
        timestamp: new Date().toISOString(),
      }

      const finalHistory = [...updatedHistory, aiMsg]
      const newTurnCount = turnCount + 1

      setMessages(finalHistory)
      setState(newState)
      setTurnCount(newTurnCount)
      setQuickOptions(aiResponse.options || [])
      setAtmosphereHint(aiResponse.atmosphereHint || 'normal')
      setStreamingText('')

      // 自动保存
      if (!isSandbox) {
        await autoSave(finalHistory, newState, newTurnCount, saveId)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      toast.error('AI 响应失败', { description: msg })
      setMessages(messages) // 回滚
    } finally {
      setIsStreaming(false)
    }
  }, [isStreaming, messages, state, turnCount, saveId, scenario, isSandbox])

  async function autoSave(
    history: ConversationMessage[],
    newState: GameState,
    newTurnCount: number,
    currentSaveId: string
  ) {
    try {
      const res = await fetch('/api/game/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveId: currentSaveId,
          state: newState,
          history,
          turnCount: newTurnCount,
        }),
      })
      const data = await res.json()
      if (data.save?.id && data.save.id !== saveId) {
        setSaveId(data.save.id)
      }
    } catch {
      // 静默失败，不打扰玩家
    }
  }

  async function handleManualSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/game/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveId,
          state,
          history: messages,
          turnCount,
        }),
      })
      if (res.ok) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2000)
      } else {
        toast.error('保存失败')
      }
    } catch {
      toast.error('保存失败')
    }
    setSaving(false)
  }

  return (
    <div className={cn(
      'h-screen flex flex-col bg-zinc-950 text-white',
      atmosphereHint === 'danger' && 'bg-red-950/5',
      atmosphereHint === 'mystery' && 'bg-purple-950/5',
      atmosphereHint === 'triumph' && 'bg-amber-950/5',
    )}>
      {/* 顶栏 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/game')}
          className="text-zinc-400 hover:text-white h-8 px-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回
        </Button>
        <div className="flex-1" />
        {!isSandbox && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualSave}
            disabled={saving}
            className={cn(
              'h-8 px-3 text-xs transition-colors',
              saveSuccess ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
            )}
          >
            {saveSuccess
              ? <><CheckCircle className="w-3.5 h-3.5 mr-1" />已保存</>
              : <><Save className="w-3.5 h-3.5 mr-1" />保存</>
            }
          </Button>
        )}
        {isSandbox && (
          <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
            沙盒模式
          </span>
        )}
      </div>

      {/* 移动端状态栏 */}
      <div className="lg:hidden flex-shrink-0">
        <StatusBar state={state} scenarioTitle={scenario.title} />
      </div>

      {/* 主区域 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 对话区 */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <ChatArea
            messages={messages}
            streamingText={streamingText}
            isStreaming={isStreaming}
            atmosphereHint={atmosphereHint}
          />
          <InputArea
            onSubmit={sendMessage}
            isLoading={isStreaming}
            quickOptions={quickOptions}
          />
        </div>

        {/* PC 端侧边栏 */}
        <div className="hidden lg:block">
          <SidePanel state={state} turnCount={turnCount} />
        </div>
      </div>
    </div>
  )
}
