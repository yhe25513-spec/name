'use client'

import { useState, useEffect, useCallback } from 'react'
import { BookOpen, PenTool, Database, Heart, Eye, Clock, AlertTriangle, ChevronLeft, ChevronRight, Plus, Trash2, RefreshCw, Zap, Target, Link2 } from 'lucide-react'
import { toast } from 'sonner'

const API_BASE = '/api/novel'

async function api(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}?path=${encodeURIComponent(path)}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '请求失败' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// ========== Types ==========
interface Novel {
  id: string
  title: string
  genre: string
  chapter: number
  words: number
  is_current: boolean
  soul?: { core_hooks: string[]; forbidden_directions: string[]; tone: string; reader_promise: string }
}

interface Foreshadow {
  id: string
  content: string
  chapter_planted: number
  importance: string
  status: string
  expected_reveal_range?: number[]
}

interface Mystery {
  id: string
  name: string
  tier: string
  revelation_progress: number
  current_stage: number
  revelation_stages?: { stage: number; threshold: number; description: string }[]
}

interface Relationship {
  type: string
  trust_level: number
  trust_history: { chapter: number; value: number; reason: string }[]
  last_updated_chapter?: number
}

// ========== Main Component ==========
export default function NovelStudio() {
  const [novels, setNovels] = useState<Novel[]>([])
  const [currentNovel, setCurrentNovel] = useState<string | null>(null)
  const [view, setView] = useState<'dashboard' | 'editor' | 'data'>('dashboard')
  const [loading, setLoading] = useState(true)

  const loadNovels = useCallback(async () => {
    try {
      const data = await api('novels')
      setNovels(data)
      const current = data.find((n: Novel) => n.is_current)
      if (current) setCurrentNovel(current.id)
    } catch (e: any) {
      toast.error('无法连接到Python后端', { description: '请确保已启动: python web/backend/main.py' })
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadNovels() }, [loadNovels])

  const switchNovel = async (id: string) => {
    await api(`novels/${id}/switch`, { method: 'POST' })
    setCurrentNovel(id)
    loadNovels()
    setView('dashboard')
  }

  const createNovel = async () => {
    const id = prompt('小说ID (英文，如 jingubang):')
    if (!id) return
    const title = prompt('小说标题:')
    if (!title) return
    const genre = prompt('类型:', '玄幻') || '未分类'
    try {
      await api('novels', { method: 'POST', body: JSON.stringify({ id, title, genre }) })
      toast.success(`小说《${title}》创建成功`)
      loadNovels()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#010102' }}>
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: 'var(--accent, #5e6ad2)' }} />
          <p className="text-sm" style={{ color: '#8a8f98' }}>连接小说工作室...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#010102', color: '#f7f8f8' }}>
      {/* Sidebar */}
      <aside className="w-56 border-r flex flex-col" style={{ borderColor: '#23252a', backgroundColor: '#0f1011' }}>
        <div className="p-4 border-b" style={{ borderColor: '#23252a' }}>
          <div className="flex items-center gap-2">
            <PenTool className="w-5 h-5" style={{ color: '#5e6ad2' }} />
            <span className="font-semibold text-sm">AI 小说工作室</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#8a8f98' }}>小说项目</p>
          {novels.map(n => (
            <button
              key={n.id}
              onClick={() => switchNovel(n.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-all ${
                n.id === currentNovel ? 'text-white' : 'hover:bg-white/5'
              }`}
              style={n.id === currentNovel ? { backgroundColor: '#5e6ad2' } : { color: '#d0d6e0' }}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{n.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(94,106,210,0.15)', color: '#5e6ad2' }}>
                  {n.chapter}章
                </span>
              </div>
            </button>
          ))}
          <button onClick={createNovel} className="w-full text-left px-3 py-2 rounded-lg text-sm mt-2 border border-dashed transition-all hover:border-solid" style={{ borderColor: '#3a3d45', color: '#5e6ad2' }}>
            <Plus className="w-3.5 h-3.5 inline mr-1.5" />
            新建小说
          </button>
        </div>

        {currentNovel && (
          <div className="p-3 border-t space-y-1" style={{ borderColor: '#23252a' }}>
            {[
              { key: 'dashboard', icon: BookOpen, label: '仪表盘' },
              { key: 'editor', icon: PenTool, label: '写章节' },
              { key: 'data', icon: Database, label: '数据管理' },
            ].map(item => (
              <button
                key={item.key}
                onClick={() => setView(item.key as any)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-all ${
                  view === item.key ? 'text-white' : 'hover:bg-white/5'
                }`}
                style={view === item.key ? { backgroundColor: '#5e6ad2' } : { color: '#d0d6e0' }}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {!currentNovel ? (
          <div className="h-full flex items-center justify-center" style={{ color: '#8a8f98' }}>
            <div className="text-center">
              <PenTool className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg mb-2">选择或创建一本小说</p>
              <p className="text-sm">在左侧选择已有小说，或点击"+ 新建小说"开始创作</p>
            </div>
          </div>
        ) : view === 'dashboard' ? (
          <DashboardView novelId={currentNovel} onEdit={(ch) => { setView('editor') }} />
        ) : view === 'editor' ? (
          <EditorView novelId={currentNovel} />
        ) : (
          <DataView novelId={currentNovel} />
        )}
      </main>
    </div>
  )
}

// ========== Dashboard ==========
function DashboardView({ novelId, onEdit }: { novelId: string; onEdit: (ch: number) => void }) {
  const [status, setStatus] = useState<any>(null)
  const [health, setHealth] = useState<any>(null)

  useEffect(() => {
    api(`novels/${novelId}/status`).then(setStatus)
    api(`novels/${novelId}/health`).then(setHealth)
  }, [novelId])

  if (!status) return <div className="p-8" style={{ color: '#8a8f98' }}>加载中...</div>

  const stats = [
    { label: '当前章节', value: status.chapter, icon: BookOpen },
    { label: '总字数', value: status.words?.toLocaleString() || '0', icon: PenTool },
    { label: '伏笔', value: status.foreshadows?.total || 0, icon: Eye },
    { label: '悬念', value: status.mysteries || 0, icon: AlertTriangle },
    { label: '关系', value: status.relationships || 0, icon: Link2 },
    { label: '健康度', value: `${health?.health_score || 100}`, icon: Heart },
  ]

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">{status.title}</h1>
      <p className="text-sm mb-8" style={{ color: '#8a8f98' }}>{status.genre} · 第{status.chapter}章 · {status.words?.toLocaleString()}字</p>

      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="p-4 rounded-xl border text-center" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
            <s.icon className="w-5 h-5 mx-auto mb-2" style={{ color: '#5e6ad2' }} />
            <div className="text-xl font-bold" style={{ color: '#f7f8f8' }}>{s.value}</div>
            <div className="text-[11px] mt-1" style={{ color: '#8a8f98' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {status.soul?.core_hooks?.length > 0 && (
        <div className="p-4 rounded-xl border mb-6" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" style={{ color: '#5e6ad2' }} />
            核心卖点
          </h3>
          <div className="flex flex-wrap gap-2">
            {status.soul.core_hooks.map((h: string, i: number) => (
              <span key={i} className="px-2.5 py-1 rounded-full text-xs" style={{ backgroundColor: 'rgba(94,106,210,0.12)', color: '#5e6ad2' }}>{h}</span>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 rounded-xl border" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
        <h3 className="text-sm font-semibold mb-3">快速开始</h3>
        <button
          onClick={() => onEdit(status.chapter + 1)}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
          style={{ backgroundColor: '#5e6ad2', color: 'white' }}
        >
          写第{(status.chapter || 0) + 1}章 →
        </button>
      </div>
    </div>
  )
}

// ========== Editor ==========
function EditorView({ novelId }: { novelId: string }) {
  const [chapter, setChapter] = useState(1)
  const [content, setContent] = useState('')
  const [prompt, setPrompt] = useState('')
  const [showPrompt, setShowPrompt] = useState(false)
  const [prep, setPrep] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (chapter > 0) {
      api(`novels/${novelId}/chapters/${chapter}`)
        .then(d => setContent(d.content || ''))
        .catch(() => setContent(''))
    }
  }, [novelId, chapter])

  const loadPrompt = async () => {
    const data = await api(`novels/${novelId}/prompt/${chapter}`)
    setPrompt(data.prompt)
    setShowPrompt(true)
  }

  const loadPrep = async () => {
    const data = await api(`novels/${novelId}/prep/${chapter}`)
    setPrep(data)
  }

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      // Save chapter
      await api(`novels/${novelId}/chapters/${chapter}`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      })

      // Auto-extract & sync
      const extractRes = await api(`novels/${novelId}/chapters/${chapter}`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      })

      await api(`novels/${novelId}/sync/${chapter}`, {
        method: 'POST',
        body: JSON.stringify({ chapter, extraction: extractRes.extraction }),
      })

      setMessage(`✅ 已保存并同步 (${content.length}字)`)
      toast.success(`第${chapter}章已保存`)
    } catch (e: any) {
      setMessage(`❌ ${e.message}`)
      toast.error(e.message)
    }
    setSaving(false)
  }

  return (
    <div className="flex h-full">
      {/* Left: Controls */}
      <div className="w-56 border-r p-4 flex flex-col gap-4" style={{ borderColor: '#23252a', backgroundColor: '#0a0b0c' }}>
        <div className="flex items-center justify-between">
          <button onClick={() => setChapter(Math.max(1, chapter - 1))} className="p-1.5 rounded border hover:bg-white/5" style={{ borderColor: '#23252a', color: '#8a8f98' }}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold">第{chapter}章</span>
          <button onClick={() => setChapter(chapter + 1)} className="p-1.5 rounded border hover:bg-white/5" style={{ borderColor: '#23252a', color: '#8a8f98' }}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <button onClick={loadPrep} className="w-full px-3 py-2 rounded-lg text-sm border hover:bg-white/5 flex items-center gap-2" style={{ borderColor: '#23252a', color: '#d0d6e0' }}>
          <Zap className="w-4 h-4" style={{ color: '#5e6ad2' }} />
          查看约束
        </button>
        <button onClick={loadPrompt} className="w-full px-3 py-2 rounded-lg text-sm border hover:bg-white/5 flex items-center gap-2" style={{ borderColor: '#23252a', color: '#d0d6e0' }}>
          <BookOpen className="w-4 h-4" style={{ color: '#5e6ad2' }} />
          生成写作提示
        </button>

        {prep && (
          <div className="text-xs space-y-2 p-3 rounded-lg border" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
            <p className="font-semibold" style={{ color: '#5e6ad2' }}>本章约束</p>
            <p style={{ color: '#d0d6e0' }}>悬念: {prep.constraints?.mysteries?.length || 0}个可揭露</p>
            <p style={{ color: '#d0d6e0' }}>到期伏笔: {prep.overdue?.length || 0}个</p>
            {prep.overdue?.map((f: any) => (
              <p key={f.id} className="flex items-center gap-1" style={{ color: '#fbbf24' }}>
                <AlertTriangle className="w-3 h-3" /> {f.content}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Center: Editor */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: '#23252a' }}>
          <span className="text-xs" style={{ color: '#8a8f98' }}>{content.length}字</span>
          {message && <span className="text-xs" style={{ color: message.startsWith('✅') ? '#4ade80' : '#f87171' }}>{message}</span>}
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            style={{ backgroundColor: '#5e6ad2', color: 'white' }}
          >
            {saving ? '保存中...' : '💾 保存并同步'}
          </button>
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          className="flex-1 w-full p-6 bg-transparent resize-none outline-none text-base leading-relaxed"
          style={{ color: '#f7f8f8', fontFamily: 'var(--font-noto-serif), serif' }}
          placeholder={`在这里写第${chapter}章...\n\n点击"生成写作提示"获取AI写作指导`}
        />
      </div>

      {/* Right: Prompt Panel */}
      {showPrompt && (
        <div className="w-80 border-l flex flex-col" style={{ borderColor: '#23252a', backgroundColor: '#0a0b0c' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#23252a' }}>
            <span className="text-sm font-semibold">写作提示</span>
            <button onClick={() => setShowPrompt(false)} className="text-sm" style={{ color: '#8a8f98' }}>✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <pre className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: '#d0d6e0', fontFamily: 'var(--font-noto-serif), serif' }}>{prompt}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ========== Data Panel ==========
function DataView({ novelId }: { novelId: string }) {
  const [tab, setTab] = useState<'foreshadow' | 'mystery' | 'relationship'>('foreshadow')
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    if (tab === 'foreshadow') api(`novels/${novelId}/foreshadows`).then(setData)
    else if (tab === 'mystery') api(`novels/${novelId}/mysteries`).then(setData)
    else api(`novels/${novelId}/relationships`).then(setData)
  }, [novelId, tab])

  const tabs = [
    { key: 'foreshadow', label: '📝 伏笔', icon: Eye },
    { key: 'mystery', label: '🔮 悬念', icon: AlertTriangle },
    { key: 'relationship', label: '👥 关系', icon: Link2 },
  ]

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-6">📦 数据管理</h1>

      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className="px-4 py-2 rounded-lg text-sm border transition-all"
            style={tab === t.key
              ? { backgroundColor: '#5e6ad2', borderColor: '#5e6ad2', color: 'white' }
              : { borderColor: '#23252a', color: '#d0d6e0' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
        {tab === 'foreshadow' && data && (
          <div>
            <p className="text-xs mb-4" style={{ color: '#8a8f98' }}>
              总计 {data.stats?.total || 0} · 未回收 {data.stats?.unresolved || 0}
            </p>
            <div className="space-y-2">
              {(data.foreshadows || []).map((f: Foreshadow) => (
                <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#0a0b0c' }}>
                  <span className="text-xs font-mono min-w-[50px]" style={{ color: '#5e6ad2' }}>{f.id}</span>
                  <span className="flex-1 text-sm">{f.content}</span>
                  <span className="text-xs px-2 py-0.5 rounded" style={{
                    backgroundColor: f.status === '已回收' ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)',
                    color: f.status === '已回收' ? '#4ade80' : '#fbbf24'
                  }}>
                    {f.status}
                  </span>
                  <span className="text-xs" style={{ color: '#8a8f98' }}>第{f.chapter_planted}章</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'mystery' && data && (
          <div className="space-y-4">
            {(data.mysteries || []).map((m: Mystery) => {
              const stage = m.revelation_stages?.find(s => s.stage === m.current_stage)
              return (
                <div key={m.id} className="p-4 rounded-lg" style={{ backgroundColor: '#0a0b0c' }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{m.name}</h3>
                    <span className="text-sm font-mono" style={{ color: '#5e6ad2' }}>{m.revelation_progress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full mb-2" style={{ backgroundColor: '#23252a' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${m.revelation_progress}%`, backgroundColor: '#5e6ad2' }} />
                  </div>
                  {stage && <p className="text-xs" style={{ color: '#8a8f98' }}>阶段{m.current_stage}: {stage.description}</p>}
                </div>
              )
            })}
          </div>
        )}

        {tab === 'relationship' && data && (
          <div className="space-y-2">
            {Object.entries(data.relationships || {}).map(([key, rel]: [string, any]) => {
              const [from, to] = key.split('->')
              return (
                <div key={key} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#0a0b0c' }}>
                  <span className="text-sm font-medium min-w-[80px]">{from}</span>
                  <span className="text-xs" style={{ color: '#8a8f98' }}>→</span>
                  <span className="text-sm font-medium min-w-[80px]">{to}</span>
                  <span className="text-lg font-bold min-w-[40px] text-center" style={{ color: rel.trust_level > 0 ? '#4ade80' : rel.trust_level < 0 ? '#f87171' : '#8a8f98' }}>
                    {rel.trust_level > 0 ? '+' : ''}{rel.trust_level}
                  </span>
                  <span className="text-xs" style={{ color: '#8a8f98' }}>{rel.type}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
