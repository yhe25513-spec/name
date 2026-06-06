'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle, XCircle, Eye, PenTool, Search, Users, Zap, ArrowRight, Film } from 'lucide-react'

interface ReviewResultsProps {
  scores: any
  onApplyFix?: (fix: string) => void
}

export default function ReviewResults({ scores, onApplyFix }: ReviewResultsProps) {
  if (!scores) return null

  return (
    <div className="space-y-3">
      {/* 评分总览 */}
      <ScoreOverview scores={scores} />

      {/* 读者反馈 */}
      {scores.reader && <ReaderReview review={scores.reader} />}

      {/* 编辑审查 */}
      {scores.editor && <EditorReview review={scores.editor} onApplyFix={onApplyFix} />}

      {/* 逻辑问题 */}
      {scores.logic && <LogicReview review={scores.logic} onApplyFix={onApplyFix} />}

      {/* 角色 OOC */}
      {scores.character && <CharacterReview review={scores.character} onApplyFix={onApplyFix} />}

      {/* 总导演审查 */}
      {scores.director && <DirectorReview review={scores.director} />}
    </div>
  )
}

// ========== 评分总览 ==========
function ScoreOverview({ scores }: { scores: any }) {
  const readerScore = scores.readerScore || scores.reader?.overall_score || 0
  const editorAvg = scores.editorAvg || 0
  const logicIssues = scores.logicIssueCount || 0
  const criticalLogic = scores.criticalLogicIssues || 0
  const oocCount = scores.characterOocCount || 0
  const criticalOoc = scores.criticalOocIssues || 0

  const metrics = [
    { label: '读者评分', value: readerScore, max: 100, color: readerScore >= 70 ? '#4ade80' : '#f87171', icon: Eye },
    { label: '编辑均分', value: editorAvg, max: 100, color: editorAvg >= 65 ? '#4ade80' : '#f87171', icon: PenTool },
    { label: '逻辑问题', value: logicIssues, max: 10, color: criticalLogic > 0 ? '#f87171' : logicIssues > 0 ? '#fbbf24' : '#4ade80', icon: Search, isCount: true },
    { label: '角色OOC', value: oocCount, max: 10, color: criticalOoc > 0 ? '#f87171' : oocCount > 0 ? '#fbbf24' : '#4ade80', icon: Users, isCount: true },
  ]

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
      <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: '#f7f8f8' }}>
        📊 评分总览
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m, i) => (
          <div key={i} className="p-2.5 rounded-lg" style={{ backgroundColor: '#0a0b0c', border: '1px solid #23252a' }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <m.icon className="w-3 h-3" style={{ color: m.color }} />
                <span className="text-[10px]" style={{ color: '#8a8f98' }}>{m.label}</span>
              </div>
              <span className="text-sm font-bold" style={{ color: m.color }}>
                {m.value}{m.isCount ? '个' : '分'}
              </span>
            </div>
            {!m.isCount && (
              <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: '#23252a' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, m.value)}%`, backgroundColor: m.color }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ========== 读者审查 ==========
function ReaderReview({ review }: { review: any }) {
  const [expanded, setExpanded] = useState(true)

  const scoreItems = [
    { label: '爽感', key: 'satisfaction', color: '#5e6ad2' },
    { label: '燃点', key: 'hype', color: '#f87171' },
    { label: '情绪', key: 'emotional_value', color: '#a78bfa' },
    { label: '钩子', key: 'anticipation', color: '#fbbf24' },
    { label: '收获', key: 'micro_payoff', color: '#4ade80' },
  ]

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
      <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/[0.02]" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5" style={{ color: '#4ade80' }} />
          <span className="text-xs font-semibold" style={{ color: '#f7f8f8' }}>📖 读者审查</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
            backgroundColor: (review.overall_score || 0) >= 70 ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
            color: (review.overall_score || 0) >= 70 ? '#4ade80' : '#f87171'
          }}>
            {review.overall_score || 0}分
          </span>
        </div>
        {expanded ? <ChevronDown className="w-3.5 h-3.5" style={{ color: '#8a8f98' }} /> : <ChevronRight className="w-3.5 h-3.5" style={{ color: '#8a8f98' }} />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* 五维评分 */}
          <div className="space-y-2">
            {scoreItems.map(item => {
              const score = review.scores?.[item.key] || 0
              return (
                <div key={item.key} className="flex items-center gap-2">
                  <span className="text-[10px] w-8 text-right" style={{ color: '#8a8f98' }}>{item.label}</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: '#23252a' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: item.color }} />
                  </div>
                  <span className="text-[10px] w-6 text-right font-mono" style={{ color: item.color }}>{score}</span>
                </div>
              )
            })}
          </div>

          {/* 总评 */}
          {review.summary && (
            <p className="text-xs leading-relaxed" style={{ color: '#d0d6e0' }}>{review.summary}</p>
          )}

          {/* 亮点 */}
          {review.highlights?.length > 0 && (
            <div>
              <p className="text-[10px] mb-1" style={{ color: '#4ade80' }}>✨ 亮点</p>
              {review.highlights.map((h: string, i: number) => (
                <p key={i} className="text-[11px] leading-relaxed" style={{ color: '#d0d6e0' }}>• {h}</p>
              ))}
            </div>
          )}

          {/* 问题 */}
          {review.problems?.length > 0 && (
            <div>
              <p className="text-[10px] mb-1" style={{ color: '#f87171' }}>⚠️ 问题</p>
              {review.problems.map((p: string, i: number) => (
                <p key={i} className="text-[11px] leading-relaxed" style={{ color: '#d0d6e0' }}>• {p}</p>
              ))}
            </div>
          )}

          {/* 钩子分析 */}
          {review.hook_analysis && (
            <div className="p-2.5 rounded-lg" style={{ backgroundColor: '#0a0b0c', border: '1px solid #23252a' }}>
              <p className="text-[10px] mb-1" style={{ color: '#fbbf24' }}>🪝 钩子分析</p>
              <div className="flex items-center gap-2 text-[11px]">
                <span style={{ color: '#8a8f98' }}>类型:</span>
                <span style={{ color: '#d0d6e0' }}>{review.hook_analysis.hook_type}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px]" style={{
                  backgroundColor: review.hook_analysis.hook_strength === 'strong' ? 'rgba(74,222,128,0.12)' : review.hook_analysis.hook_strength === 'medium' ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.12)',
                  color: review.hook_analysis.hook_strength === 'strong' ? '#4ade80' : review.hook_analysis.hook_strength === 'medium' ? '#fbbf24' : '#f87171'
                }}>
                  {review.hook_analysis.hook_strength}
                </span>
              </div>
              {review.hook_analysis.hook_quote && (
                <p className="text-[11px] mt-1 italic" style={{ color: '#8a8f98' }}>"{review.hook_analysis.hook_quote}"</p>
              )}
            </div>
          )}

          {/* 读者反馈 */}
          {review.reader_feedback && (
            <div className="p-2.5 rounded-lg" style={{ backgroundColor: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)' }}>
              <p className="text-[10px] mb-1" style={{ color: '#4ade80' }}>💬 读者心声</p>
              <p className="text-[11px] leading-relaxed" style={{ color: '#d0d6e0' }}>{review.reader_feedback}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ========== 编辑审查 ==========
function EditorReview({ review, onApplyFix }: { review: any; onApplyFix?: (fix: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  const scores = review.editorial_scores || {}
  const issues = review.issues || []
  const blockingCount = issues.filter((i: any) => i.blocking).length

  const severityColors: Record<string, string> = { critical: '#f87171', high: '#fbbf24', medium: '#a78bfa', low: '#8a8f98' }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
      <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/[0.02]" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <PenTool className="w-3.5 h-3.5" style={{ color: '#fbbf24' }} />
          <span className="text-xs font-semibold" style={{ color: '#f7f8f8' }}>📝 编辑审查</span>
          {issues.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
              backgroundColor: blockingCount > 0 ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)',
              color: blockingCount > 0 ? '#f87171' : '#fbbf24'
            }}>
              {issues.length}个问题{blockingCount > 0 ? `(${blockingCount}阻断)` : ''}
            </span>
          )}
        </div>
        {expanded ? <ChevronDown className="w-3.5 h-3.5" style={{ color: '#8a8f98' }} /> : <ChevronRight className="w-3.5 h-3.5" style={{ color: '#8a8f98' }} />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* 四维评分 */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '节奏', key: 'pacing', color: '#5e6ad2' },
              { label: '商业', key: 'commercial_value', color: '#fbbf24' },
              { label: '人物', key: 'character_development', color: '#4ade80' },
              { label: '结构', key: 'chapter_structure', color: '#a78bfa' },
            ].map(item => (
              <div key={item.key} className="p-2 rounded-lg" style={{ backgroundColor: '#0a0b0c', border: '1px solid #23252a' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: '#8a8f98' }}>{item.label}</span>
                  <span className="text-xs font-bold" style={{ color: (scores[item.key] || 0) >= 70 ? '#4ade80' : '#fbbf24' }}>
                    {scores[item.key] || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* 毒点检测 */}
          {review.toxic_risk?.detected && (
            <div className="p-2.5 rounded-lg" style={{ backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <p className="text-[10px] mb-1" style={{ color: '#f87171' }}>🚨 毒点检测</p>
              <p className="text-[11px]" style={{ color: '#d0d6e0' }}>{review.toxic_risk.type}</p>
            </div>
          )}

          {/* 问题清单 */}
          {issues.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px]" style={{ color: '#8a8f98' }}>问题清单</p>
              {issues.map((issue: any, i: number) => (
                <IssueCard key={i} issue={issue} onApplyFix={onApplyFix} />
              ))}
            </div>
          )}

          {/* 总评 */}
          {review.overall_editorial_assessment && (
            <p className="text-xs leading-relaxed" style={{ color: '#d0d6e0' }}>{review.overall_editorial_assessment}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ========== 逻辑审查 ==========
function LogicReview({ review, onApplyFix }: { review: any; onApplyFix?: (fix: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  const issues = review.issues || []
  const criticalCount = issues.filter((i: any) => i.severity === 'critical').length

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
      <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/[0.02]" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5" style={{ color: '#f87171' }} />
          <span className="text-xs font-semibold" style={{ color: '#f7f8f8' }}>🔍 逻辑审查</span>
          {issues.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
              backgroundColor: criticalCount > 0 ? 'rgba(248,113,113,0.12)' : 'rgba(74,222,128,0.12)',
              color: criticalCount > 0 ? '#f87171' : '#4ade80'
            }}>
              {issues.length}个问题{criticalCount > 0 ? `(${criticalCount}阻断)` : '✓'}
            </span>
          )}
        </div>
        {expanded ? <ChevronDown className="w-3.5 h-3.5" style={{ color: '#8a8f98' }} /> : <ChevronRight className="w-3.5 h-3.5" style={{ color: '#8a8f98' }} />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {issues.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: '#4ade80' }}>✅ 未发现逻辑问题</p>
          ) : (
            <div className="space-y-1.5">
              {issues.map((issue: any, i: number) => (
                <IssueCard key={i} issue={issue} onApplyFix={onApplyFix} />
              ))}
            </div>
          )}

          {review.summary && (
            <p className="text-xs" style={{ color: '#8a8f98' }}>{review.summary}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ========== 角色审查 ==========
function CharacterReview({ review, onApplyFix }: { review: any; onApplyFix?: (fix: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  const issues = review.ooc_issues || []
  const criticalCount = issues.filter((i: any) => i.severity === 'critical').length
  const scores = review.character_consistency_scores || {}

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
      <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/[0.02]" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
          <span className="text-xs font-semibold" style={{ color: '#f7f8f8' }}>🎭 角色审查</span>
          {issues.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
              backgroundColor: criticalCount > 0 ? 'rgba(248,113,113,0.12)' : 'rgba(167,139,250,0.12)',
              color: criticalCount > 0 ? '#f87171' : '#a78bfa'
            }}>
              {issues.length}个OOC{criticalCount > 0 ? `(${criticalCount}阻断)` : ''}
            </span>
          )}
        </div>
        {expanded ? <ChevronDown className="w-3.5 h-3.5" style={{ color: '#8a8f98' }} /> : <ChevronRight className="w-3.5 h-3.5" style={{ color: '#8a8f98' }} />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* 角色一致性评分 */}
          {Object.keys(scores).length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(scores).map(([name, score]) => {
                const numScore = Number(score) || 0
                return (
                  <div key={name} className="flex items-center justify-between p-1.5 rounded text-[11px]" style={{ backgroundColor: '#0a0b0c' }}>
                    <span style={{ color: '#d0d6e0' }}>{name}</span>
                    <span className="font-bold" style={{ color: numScore >= 80 ? '#4ade80' : numScore >= 60 ? '#fbbf24' : '#f87171' }}>
                      {numScore}分
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* OOC 问题 */}
          {issues.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: '#4ade80' }}>✅ 角色表现一致</p>
          ) : (
            <div className="space-y-1.5">
              {issues.map((issue: any, i: number) => (
                <IssueCard key={i} issue={{ ...issue, category: issue.type }} onApplyFix={onApplyFix} />
              ))}
            </div>
          )}

          {review.summary && (
            <p className="text-xs" style={{ color: '#8a8f98' }}>{review.summary}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ========== 问题卡片 ==========
function IssueCard({ issue, onApplyFix }: { issue: any; onApplyFix?: (fix: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  const severityColors: Record<string, string> = { critical: '#f87171', high: '#fbbf24', medium: '#a78bfa', low: '#8a8f98' }
  const severityLabels: Record<string, string> = { critical: '阻断', high: '高优', medium: '中优', low: '低优' }
  const color = severityColors[issue.severity] || '#8a8f98'

  return (
    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#0a0b0c', border: `1px solid ${issue.blocking ? 'rgba(248,113,113,0.3)' : '#23252a'}` }}>
      <div className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/[0.02]" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2 min-w-0">
          {issue.blocking ? <XCircle className="w-3 h-3 shrink-0" style={{ color: '#f87171' }} /> : <AlertTriangle className="w-3 h-3 shrink-0" style={{ color }} />}
          <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: `${color}20`, color }}>
            {severityLabels[issue.severity] || issue.severity}
          </span>
          <span className="text-[11px] truncate" style={{ color: '#d0d6e0' }}>{issue.description}</span>
        </div>
        {expanded ? <ChevronDown className="w-3 h-3 shrink-0" style={{ color: '#8a8f98' }} /> : <ChevronRight className="w-3 h-3 shrink-0" style={{ color: '#8a8f98' }} />}
      </div>

      {expanded && (
        <div className="px-3 pb-2.5 space-y-2 text-[11px]">
          {issue.location && (
            <p><span style={{ color: '#8a8f98' }}>位置：</span><span style={{ color: '#d0d6e0' }}>{issue.location}</span></p>
          )}
          {issue.evidence && (
            <div className="p-2 rounded" style={{ backgroundColor: '#141516', border: '1px solid #23252a' }}>
              <p className="text-[10px] mb-0.5" style={{ color: '#8a8f98' }}>证据</p>
              <p className="italic" style={{ color: '#d0d6e0' }}>{issue.evidence}</p>
            </div>
          )}
          {issue.fix_hint && (
            <div className="flex items-start gap-2">
              <span style={{ color: '#4ade80' }}>💡</span>
              <p style={{ color: '#4ade80' }}>{issue.fix_hint}</p>
            </div>
          )}
          {issue.fix_hint && onApplyFix && (
            <button
              onClick={(e) => { e.stopPropagation(); onApplyFix(issue.fix_hint) }}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-all hover:bg-white/5"
              style={{ color: '#5e6ad2', border: '1px solid rgba(94,106,210,0.3)' }}
            >
              <Zap className="w-3 h-3" /> 应用修复
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ========== 总导演审查 ==========
function DirectorReview({ review }: { review: any }) {
  const [expanded, setExpanded] = useState(true)

  const verdictColors: Record<string, string> = { approved: '#4ade80', rejected: '#f87171', conditional: '#fbbf24' }
  const verdictLabels: Record<string, string> = { approved: '通过', rejected: '否决', conditional: '有条件通过' }
  const verdict = review.verdict || 'conditional'
  const color = verdictColors[verdict] || '#fbbf24'

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: `${color}30`, backgroundColor: '#141516' }}>
      <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/[0.02]" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <Film className="w-3.5 h-3.5" style={{ color }} />
          <span className="text-xs font-semibold" style={{ color: '#f7f8f8' }}>🎬 总导演审查</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${color}20`, color }}>
            {verdictLabels[verdict] || verdict}
          </span>
          <span className="text-[10px] font-mono" style={{ color }}>{review.score || 0}分</span>
        </div>
        {expanded ? <ChevronDown className="w-3.5 h-3.5" style={{ color: '#8a8f98' }} /> : <ChevronRight className="w-3.5 h-3.5" style={{ color: '#8a8f98' }} />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* 核心卖点对齐 */}
          {review.alignment && Object.keys(review.alignment).length > 0 && (
            <div>
              <p className="text-[10px] mb-2" style={{ color: '#8a8f98' }}>核心卖点对齐</p>
              <div className="space-y-1.5">
                {Object.entries(review.alignment).map(([key, item]: [string, any]) => (
                  <div key={key} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: '#0a0b0c', border: '1px solid #23252a' }}>
                    {item.aligned ? <CheckCircle className="w-3 h-3 shrink-0" style={{ color: '#4ade80' }} /> : <XCircle className="w-3 h-3 shrink-0" style={{ color: '#f87171' }} />}
                    <span className="text-[11px] flex-1" style={{ color: '#d0d6e0' }}>{key}</span>
                    <span className="text-[10px] font-mono" style={{ color: item.score >= 70 ? '#4ade80' : '#fbbf24' }}>{item.score || 0}分</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 总导演评语 */}
          {review.notes && (
            <div className="p-2.5 rounded-lg" style={{ backgroundColor: 'rgba(244,114,182,0.05)', border: '1px solid rgba(244,114,182,0.15)' }}>
              <p className="text-[10px] mb-1" style={{ color: '#f472b6' }}>💬 总导演评语</p>
              <p className="text-[11px] leading-relaxed" style={{ color: '#d0d6e0' }}>{review.notes}</p>
            </div>
          )}

          {/* 修改指令 */}
          {review.revisionDirective && (
            <div className="p-2.5 rounded-lg" style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <p className="text-[10px] mb-1" style={{ color: '#fbbf24' }}>📋 修改指令</p>
              <p className="text-[11px] leading-relaxed" style={{ color: '#d0d6e0' }}>{review.revisionDirective}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
