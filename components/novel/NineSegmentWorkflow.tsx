'use client'

import { useState } from 'react'
import { Sprout, Globe, Users, GitBranch, BookOpen, Clapperboard, PenTool, Heart, Sparkles, ChevronRight, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const NINE_SEGMENTS = [
  { id: 1, icon: Sprout, label: '故事种子', desc: '核心创意提炼', color: '#4ade80' },
  { id: 2, icon: Globe, label: '世界搭建', desc: '世界观构建', color: '#5e6ad2' },
  { id: 3, icon: Users, label: '角色塑造', desc: '人物设计', color: '#a78bfa' },
  { id: 4, icon: GitBranch, label: '主线设计', desc: '剧情骨架', color: '#f87171' },
  { id: 5, icon: BookOpen, label: '章节大纲', desc: '逐章规划', color: '#fbbf24' },
  { id: 6, icon: Clapperboard, label: '场景设计', desc: '具体场景', color: '#f472b6' },
  { id: 7, icon: PenTool, label: '细节填充', desc: '伏笔氛围', color: '#06b6d4' },
  { id: 8, icon: Heart, label: '情感渲染', desc: '读者共鸣', color: '#ef4444' },
  { id: 9, icon: Sparkles, label: '整体优化', desc: '质检润色', color: '#8b5cf6' },
]

const STAGE_PROMPTS: Record<number, { system: string; placeholder: string; fields?: string[] }> = {
  1: {
    system: '你是一个创意提炼专家。从用户的灵感输入中提炼出完整的故事种子。',
    placeholder: '描述你的小说灵感，例如：一个修仙者重生到现代都市，用修仙知识在现代社会崛起...',
    fields: ['corePremise', 'genre', 'targetReader', 'hook', 'theme', 'tone'],
  },
  2: {
    system: '你是一个世界构建专家。根据创意前提构建完整的世界观。',
    placeholder: '基于故事种子，构建世界观（规则、势力、地点、冲突等）',
    fields: ['worldName', 'era', 'rules', 'factions', 'locations', 'conflicts'],
  },
  3: {
    system: '你是一个角色设计专家。设计主要角色的完整人设。',
    placeholder: '设计主要角色（主角、反派、配角）',
    fields: ['characters'],
  },
  4: {
    system: '你是一个剧情架构师。设计完整的故事主线和三幕结构。',
    placeholder: '设计故事主线（开端→冲突→高潮→结局）',
    fields: ['actStructure', 'turningPoints', 'subplots', 'climax'],
  },
  5: {
    system: '你是一个章节规划师。为每一章设计详细大纲。',
    placeholder: '为前10-30章设计详细大纲',
    fields: ['chapters'],
  },
  6: {
    system: '你是一个场景设计专家。为每个章节设计具体场景。',
    placeholder: '为当前章节设计具体场景（地点、时间、人物、动作、对话要点）',
    fields: ['scenes'],
  },
  7: {
    system: '你是一个细节打磨专家。添加伏笔、感官细节、环境氛围。',
    placeholder: '在草稿基础上添加细节（伏笔、感官描写、氛围）',
    fields: ['enhancedText', 'foreshadowingPlanted'],
  },
  8: {
    system: '你是一个情感渲染专家。增强文本的情感共鸣。',
    placeholder: '增强文本的情感表达和读者代入感',
    fields: ['emotionallyEnhancedText', 'emotionalBeats'],
  },
  9: {
    system: '你是一个小说质检专家。检查逻辑、节奏、AI痕迹。',
    placeholder: '对章节进行全面质检',
    fields: ['qualityScore', 'logicIssues', 'aiPatternDetected', 'finalApprovedText'],
  },
}

export default function NineSegmentWorkflow({ novelId, onComplete }: { novelId: string; onComplete?: () => void }) {
  const [currentStage, setCurrentStage] = useState(1)
  const [inputs, setInputs] = useState<Record<number, string>>({})
  const [results, setResults] = useState<Record<number, any>>({})
  const [running, setRunning] = useState(false)
  const [completedStages, setCompletedStages] = useState<Set<number>>(new Set())

  const stage = NINE_SEGMENTS[currentStage - 1]
  const prompt = STAGE_PROMPTS[currentStage]

  const runStage = async () => {
    const input = inputs[currentStage]
    if (!input?.trim()) {
      toast.error('请输入内容')
      return
    }

    setRunning(true)
    try {
      const res = await fetch('/api/novel/workflow/nine-segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          novelId,
          stage: currentStage,
          input,
          previousResults: results,
        }),
      })

      if (!res.ok) throw new Error('执行失败')
      const data = await res.json()

      setResults({ ...results, [currentStage]: data })
      setCompletedStages(new Set([...completedStages, currentStage]))
      toast.success(`第${currentStage}段完成！`)

      // 自动进入下一段
      if (currentStage < 9) {
        setCurrentStage(currentStage + 1)
      }
    } catch (e: any) {
      toast.error(`执行失败: ${e.message}`)
    }
    setRunning(false)
  }

  const formatResult = (data: any): string => {
    if (!data) return ''
    if (typeof data === 'string') return data
    return JSON.stringify(data, null, 2)
  }

  return (
    <div className="flex h-full">
      {/* 左侧：9段进度 */}
      <div className="w-56 shrink-0 border-r p-4 space-y-1" style={{ borderColor: '#23252a', backgroundColor: '#0a0b0c' }}>
        <h3 className="text-xs font-semibold mb-3" style={{ color: '#f7f8f8' }}>九段式创作工作流</h3>
        {NINE_SEGMENTS.map(seg => {
          const Icon = seg.icon
          const isCompleted = completedStages.has(seg.id)
          const isCurrent = seg.id === currentStage
          return (
            <button
              key={seg.id}
              onClick={() => setCurrentStage(seg.id)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
              style={isCurrent
                ? { backgroundColor: `${seg.color}15`, border: `1px solid ${seg.color}30` }
                : { border: '1px solid transparent' }
              }
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{
                backgroundColor: isCompleted ? seg.color : isCurrent ? `${seg.color}20` : '#23252a',
                color: isCompleted ? 'white' : isCurrent ? seg.color : '#8a8f98',
              }}>
                {isCompleted ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium truncate" style={{ color: isCurrent ? seg.color : isCompleted ? '#4ade80' : '#d0d6e0' }}>
                  {seg.id}. {seg.label}
                </div>
                <div className="text-[9px] truncate" style={{ color: '#8a8f98' }}>{seg.desc}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* 右侧：当前段内容 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: '#23252a' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stage.color}20` }}>
            <stage.icon className="w-4 h-4" style={{ color: stage.color }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: '#f7f8f8' }}>第{currentStage}段：{stage.label}</h2>
            <p className="text-[10px]" style={{ color: '#8a8f98' }}>{stage.desc}</p>
          </div>
        </div>

        {/* 输入区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="rounded-xl border p-4" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
            <label className="text-xs mb-2 block" style={{ color: '#8a8f98' }}>
              {currentStage === 1 ? '描述你的小说创意' : `第${currentStage}段输入`}
            </label>
            <textarea
              value={inputs[currentStage] || ''}
              onChange={e => setInputs({ ...inputs, [currentStage]: e.target.value })}
              className="w-full h-40 p-3 rounded-lg text-sm resize-none outline-none"
              style={{ backgroundColor: '#0a0b0c', border: '1px solid #23252a', color: '#f7f8f8' }}
              placeholder={prompt.placeholder}
            />
          </div>

          {/* 上一段结果（如果有） */}
          {currentStage > 1 && results[currentStage - 1] && (
            <div className="rounded-xl border p-4" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
              <p className="text-xs mb-2" style={{ color: '#8a8f98' }}>上一段结果参考</p>
              <pre className="text-[11px] whitespace-pre-wrap max-h-40 overflow-y-auto" style={{ color: '#d0d6e0' }}>
                {formatResult(results[currentStage - 1])}
              </pre>
            </div>
          )}

          {/* 当前段结果 */}
          {results[currentStage] && (
            <div className="rounded-xl border p-4" style={{ borderColor: `${stage.color}30`, backgroundColor: '#141516' }}>
              <p className="text-xs mb-2" style={{ color: stage.color }}>✅ 第{currentStage}段结果</p>
              <pre className="text-[11px] whitespace-pre-wrap max-h-60 overflow-y-auto" style={{ color: '#d0d6e0' }}>
                {formatResult(results[currentStage])}
              </pre>
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="px-6 py-3 border-t flex items-center justify-between" style={{ borderColor: '#23252a' }}>
          <span className="text-[10px]" style={{ color: '#8a8f98' }}>
            {completedStages.size}/9 段已完成
          </span>
          <div className="flex gap-2">
            {currentStage > 1 && (
              <Button variant="outline" size="sm" onClick={() => setCurrentStage(currentStage - 1)} style={{ borderColor: '#23252a', color: '#d0d6e0' }}>
                上一段
              </Button>
            )}
            <Button onClick={runStage} disabled={running} size="sm" style={{ backgroundColor: stage.color, color: 'white' }}>
              {running ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5 mr-1.5" />}
              {running ? 'AI 生成中...' : completedStages.has(currentStage) ? '重新生成' : '执行'}
            </Button>
            {currentStage < 9 && completedStages.has(currentStage) && (
              <Button variant="outline" size="sm" onClick={() => setCurrentStage(currentStage + 1)} style={{ borderColor: '#23252a', color: '#d0d6e0' }}>
                下一段
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
