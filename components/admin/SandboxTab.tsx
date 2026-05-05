'use client'

import { useState, useEffect } from 'react'
import { GameScenario, GameState } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FlaskConical, Play, Loader2, Send, Terminal } from 'lucide-react'
import { GameClient } from '@/components/game/GameClient'
import { GameSave } from '@/lib/types'
import { toast } from 'sonner'

export function SandboxTab() {
  const [scenarios, setScenarios] = useState<GameScenario[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [customState, setCustomState] = useState('')
  const [sandboxSave, setSandboxSave] = useState<GameSave | null>(null)
  const [loading, setLoading] = useState(true)

  // 直接 API 测试
  const [activeTab, setActiveTab] = useState<'game' | 'api'>('game')
  const [systemPrompt, setSystemPrompt] = useState('你是一个 helpful 助手。')
  const [userMessage, setUserMessage] = useState('你好，请介绍一下自己。')
  const [apiResponse, setApiResponse] = useState('')
  const [apiLoading, setApiLoading] = useState(false)

  useEffect(() => { fetchScenarios() }, [])

  async function fetchScenarios() {
    setLoading(true)
    const res = await fetch('/api/admin/scenarios')
    const data = await res.json()
    const list = data.scenarios || []
    setScenarios(list)
    if (list.length > 0) {
      setSelectedId(list[0].id)
      setCustomState(JSON.stringify(list[0].initial_state, null, 2))
    }
    setLoading(false)
  }

  function handleScenarioChange(id: string) {
    setSelectedId(id)
    const s = scenarios.find((s) => s.id === id)
    if (s) setCustomState(JSON.stringify(s.initial_state, null, 2))
    setSandboxSave(null)
  }

  function startSandbox() {
    const scenario = scenarios.find((s) => s.id === selectedId)
    if (!scenario) return

    let state: GameState
    try {
      state = JSON.parse(customState)
    } catch {
      state = scenario.initial_state
    }

    // 构造沙盒用的临时 Save 对象
    const fakeSave: GameSave = {
      id: 'sandbox-' + Date.now(),
      user_id: 'admin',
      scenario_id: scenario.id,
      current_state: state,
      conversation_history: [],
      turn_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      scenario,
    }
    setSandboxSave(fakeSave)
  }

  // 直接测试 API
  async function testAPI() {
    setApiLoading(true)
    setApiResponse('')
    try {
      const res = await fetch('/api/admin/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          userMessage,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'API 请求失败')
      }
      const data = await res.json()
      setApiResponse(data.response || '无响应')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      toast.error('API 测试失败', { description: msg })
      setApiResponse(`错误: ${msg}`)
    } finally {
      setApiLoading(false)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>

  if (sandboxSave && activeTab === 'game') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSandboxSave(null)}
            className="border-zinc-700 text-zinc-300"
          >
            ← 返回配置
          </Button>
          <span className="text-amber-400 text-sm flex items-center gap-1.5">
            <FlaskConical className="w-4 h-4" />
            沙盒模式 · 不计入统计
          </span>
        </div>
        <div className="h-[70vh] rounded-xl overflow-hidden border border-zinc-700">
          <GameClient initialSave={sandboxSave} isSandbox={true} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-emerald-400" />
          测试沙盒
        </h2>
        {/* 标签切换 */}
        <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('game')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeTab === 'game' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
              }`}
          >
            游戏测试
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeTab === 'api' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
              }`}
          >
            <Terminal className="w-3.5 h-3.5 inline mr-1" />
            API 直连
          </button>
        </div>
      </div>

      {activeTab === 'game' ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">选择场景和初始状态，以沙盒模式测试游戏。沙盒内容不计入统计，存档不保存。</p>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">选择场景</label>
              <select
                value={selectedId}
                onChange={(e) => handleScenarioChange(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-white text-sm"
              >
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} {s.is_published ? '' : '（草稿）'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">初始状态 JSON（可修改来注入测试状态）</label>
              <Textarea
                value={customState}
                onChange={(e) => setCustomState(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white font-mono text-xs"
                rows={10}
              />
            </div>

            <Button
              onClick={startSandbox}
              disabled={!selectedId || scenarios.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Play className="w-4 h-4 mr-1.5" />
              启动沙盒测试
            </Button>
          </div>
        </div>
      ) : (
        /* API 直连测试 */
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">直接发送请求到配置的 AI API，绕过游戏场景的 system prompt 包装。用于测试 API 本身的行为。</p>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">System Prompt（系统提示）</label>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white text-xs"
                rows={4}
                placeholder="输入 system prompt..."
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">User Message（用户消息）</label>
              <Textarea
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white text-xs"
                rows={4}
                placeholder="输入要发送的消息..."
              />
            </div>

            <Button
              onClick={testAPI}
              disabled={apiLoading || !systemPrompt.trim() || !userMessage.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              {apiLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              发送测试
            </Button>

            {/* 响应结果 */}
            {apiResponse && (
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">API 响应</label>
                <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 max-h-80 overflow-y-auto">
                  <pre className="text-sm text-zinc-300 whitespace-pre-wrap break-all font-mono">
                    {apiResponse}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
