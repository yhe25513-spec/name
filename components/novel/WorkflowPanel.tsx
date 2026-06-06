'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Square, CheckCircle, XCircle, Clock, Zap, BookOpen, Search, Users, Brain, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import ReviewResults from './ReviewResults'
import { getAISettings } from './APISettings'

interface WorkflowLog {
  time: string
  text: string
}

interface WorkflowResult {
  draft: string
  scores: any
  isApproved: boolean
  status: string
  revisionCount: number
}

const AGENT_ICONS: Record<string, any> = {
  '主笔作家': '✍️',
  '读者Agent': '📖',
  '编辑Agent': '📝',
  '逻辑Agent': '🔍',
  '角色导演Agent': '🎭',
  '风格守卫Agent': '🎨',
  '伏笔Agent': '📌',
  '战力Agent': '⚔️',
  '总导演Agent': '🎬',
  '汇总': '📊',
}

const AGENT_COLORS: Record<string, string> = {
  '主笔作家': '#5e6ad2',
  '读者Agent': '#4ade80',
  '编辑Agent': '#fbbf24',
  '逻辑Agent': '#f87171',
  '角色导演Agent': '#a78bfa',
  '风格守卫Agent': '#06b6d4',
  '伏笔Agent': '#10b981',
  '战力Agent': '#ef4444',
  '总导演Agent': '#f472b6',
  '汇总': '#5e6ad2',
}

export default function WorkflowPanel({ novelId, chapter, onComplete }: { novelId: string; chapter: number; onComplete?: () => void }) {
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<WorkflowLog[]>([])
  const [result, setResult] = useState<WorkflowResult | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [currentAgent, setCurrentAgent] = useState('')
  const logsEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    if (expanded && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, expanded])

  const runWorkflow = async () => {
    setRunning(true)
    setLogs([])
    setResult(null)
    setCurrentAgent('')

    try {
      const aiSettings = getAISettings()
      const res = await fetch('/api/novel/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ novelId, chapter, aiSettings }),
      })

      if (!res.ok) throw new Error('工作流启动失败')

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break

              try {
                const parsed = JSON.parse(data)

                if (parsed.type === 'log') {
                  const logText = parsed.log || parsed.text || ''
                  // 识别当前 Agent
                  const agentMatch = logText.match(/\[(.+?)\]/)
                  if (agentMatch) setCurrentAgent(agentMatch[1])

                  setLogs(prev => [...prev, {
                    time: new Date().toLocaleTimeString(),
                    text: logText,
                  }])
                }

                if (parsed.type === 'progress') {
                  setResult({
                    draft: parsed.draft || '',
                    scores: parsed.scores || {},
                    isApproved: parsed.isApproved,
                    status: parsed.status,
                    revisionCount: parsed.revisionCount,
                  })
                }
              } catch {}
            }
          }
        }
      }

      toast.success('工作流完成')
      onComplete?.()
    } catch (e: any) {
      toast.error(`工作流失败: ${e.message}`)
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: `❌ 错误: ${e.message}` }])
    }

    setRunning(false)
    setCurrentAgent('')
  }

  const stopWorkflow = () => {
    // TODO: 实现 AbortController
    setRunning(false)
    toast.info('已停止工作流')
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.02]"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4" style={{ color: '#5e6ad2' }} />
          <span className="text-sm font-semibold" style={{ color: '#f7f8f8' }}>🤖 Agent 工作流</span>
          {running && currentAgent && (
            <span className="text-[10px] px-2 py-0.5 rounded-full animate-pulse" style={{ backgroundColor: 'rgba(94,106,210,0.15)', color: '#5e6ad2' }}>
              {AGENT_ICONS[currentAgent] || '⚡'} {currentAgent}
            </span>
          )}
        </div>
        {expanded ? <ChevronDown className="w-4 h-4" style={{ color: '#8a8f98' }} /> : <ChevronRight className="w-4 h-4" style={{ color: '#8a8f98' }} />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Pipeline 可视化 */}
          <div className="flex items-center gap-1 text-[10px] overflow-x-auto py-2">
            {['✍️ 写作', '📖 读者', '📝 编辑', '🔍 逻辑', '🎭 角色', '🎨 风格', '📌 伏笔', '⚔️ 战力', '🎬 导演', '📊 汇总'].map((step, i) => {
              const agentName = step.slice(2)
              const isActive = currentAgent === agentName
              const isDone = logs.some(l => l.text.includes(`[${agentName}]`) && l.text.includes('完成'))
              return (
                <div key={i} className="flex items-center gap-1">
                  <div className="px-1.5 py-1 rounded text-center whitespace-nowrap transition-all" style={{
                    backgroundColor: isActive ? AGENT_COLORS[agentName] || '#5e6ad2' : isDone ? 'rgba(74,222,128,0.12)' : '#0a0b0c',
                    color: isActive ? 'white' : isDone ? '#4ade80' : '#8a8f98',
                    border: `1px solid ${isActive ? AGENT_COLORS[agentName] || '#5e6ad2' : isDone ? 'rgba(74,222,128,0.3)' : '#23252a'}`,
                  }}>
                    {isDone && !isActive ? '✅' : isActive ? <Clock className="w-3 h-3 inline animate-spin" /> : ''} {step}
                  </div>
                  {i < 9 && <span style={{ color: '#23252a' }}>→</span>}
                </div>
              )
            })}
          </div>

          {/* 日志输出 */}
          <div className="max-h-60 overflow-y-auto rounded-lg p-3 space-y-1" style={{ backgroundColor: '#0a0b0c', border: '1px solid #23252a' }}>
            {logs.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: '#8a8f98' }}>
                点击"开始创作"启动 Agent 工作流
              </p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="text-xs font-mono leading-relaxed" style={{ color: '#d0d6e0' }}>
                  <span style={{ color: '#8a8f98' }}>{log.time}</span>{' '}
                  {log.text}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>

          {/* 结果展示 */}
          {result && (
            <div className="space-y-3">
              {/* 评分面板 */}
              {result.scores?.reader && (
                <div className="grid grid-cols-2 gap-2">
                  <ScoreCard label="读者评分" score={result.scores.reader?.overall_score || 0} color="#4ade80" />
                  <ScoreCard label="编辑均分" score={result.scores.editorAvg || 0} color="#fbbf24" />
                  <ScoreCard label="逻辑问题" score={result.scores.logicIssueCount || 0} color="#f87171" max={10} />
                  <ScoreCard label="角色OOC" score={result.scores.characterOocCount || 0} color="#a78bfa" max={10} />
                </div>
              )}

              {/* 状态 */}
              <div className="flex items-center gap-2">
                {result.isApproved ? (
                  <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>
                    <CheckCircle className="w-3.5 h-3.5" /> 通过质量门禁
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                    <XCircle className="w-3.5 h-3.5" /> 未完全通过（修改{result.revisionCount}次）
                  </span>
                )}
                <span className="text-[10px]" style={{ color: '#8a8f98' }}>
                  {result.draft?.length || 0}字
                </span>
              </div>

              {/* 详细审查结果 */}
              <ReviewResults scores={result.scores} />
            </div>
          )}

          {/* 控制按钮 */}
          <div className="flex gap-2">
            {running ? (
              <Button onClick={stopWorkflow} variant="outline" size="sm" style={{ borderColor: '#f87171', color: '#f87171' }}>
                <Square className="w-3.5 h-3.5 mr-1.5" /> 停止
              </Button>
            ) : (
              <Button onClick={runWorkflow} size="sm" style={{ backgroundColor: '#5e6ad2', color: 'white' }}>
                <Play className="w-3.5 h-3.5 mr-1.5" /> 开始创作第{chapter}章
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreCard({ label, score, color, max = 100 }: { label: string; score: number; color: string; max?: number }) {
  const pct = max === 10 ? score * 10 : score
  return (
    <div className="p-2.5 rounded-lg" style={{ backgroundColor: '#0a0b0c', border: '1px solid #23252a' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px]" style={{ color: '#8a8f98' }}>{label}</span>
        <span className="text-sm font-bold" style={{ color }}>{score}{max === 10 ? '个' : '分'}</span>
      </div>
      {max === 100 && (
        <div className="w-full h-1 rounded-full" style={{ backgroundColor: '#23252a' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
        </div>
      )}
    </div>
  )
}
