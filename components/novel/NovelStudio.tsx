'use client'

import { useState, useEffect, useCallback } from 'react'
import { BookOpen, PenTool, Database, Heart, Eye, Clock, AlertTriangle, ChevronLeft, ChevronRight, Plus, Trash2, RefreshCw, Zap, Target, Link2, Download, Sparkles, Brain, Upload, BookMarked, Layers, Settings, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import MemoryLayer from './MemoryLayer'
import WorkflowPanel from './WorkflowPanel'
import ImportNovel from './ImportNovel'
import NovelReader from './NovelReader'
import NineSegmentWorkflow from './NineSegmentWorkflow'
import APISettings from './APISettings'

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
  const [view, setView] = useState<'dashboard' | 'editor' | 'data' | 'memory' | 'import' | 'reader' | 'nine-segment'>('dashboard')
  const [readerChapters, setReaderChapters] = useState<any[]>([])
  const [readerIdx, setReaderIdx] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newNovel, setNewNovel] = useState({ id: '', title: '', genre: '玄幻' })
  const [creating, setCreating] = useState(false)

  const loadNovels = useCallback(async () => {
    try {
      const data = await api('novels')
      setNovels(data)
      const current = data.find((n: Novel) => n.is_current)
      if (current) setCurrentNovel(current.id)
    } catch (e: any) {
      toast.error('无法连接到服务器', { description: '请检查网络连接或刷新页面重试' })
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
    if (!newNovel.id.trim() || !newNovel.title.trim()) {
      toast.error('请填写小说ID和标题')
      return
    }
    setCreating(true)
    try {
      await api('novels', { method: 'POST', body: JSON.stringify({ id: newNovel.id.trim(), title: newNovel.title.trim(), genre: newNovel.genre }) })
      toast.success(`小说《${newNovel.title}》创建成功`)
      setShowCreateDialog(false)
      setNewNovel({ id: '', title: '', genre: '玄幻' })
      loadNovels()
    } catch (e: any) {
      toast.error(e.message)
    }
    setCreating(false)
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
            <div
              key={n.id}
              className={`group flex items-center gap-1 rounded-lg mb-1 transition-all cursor-pointer ${
                n.id === currentNovel ? 'text-white' : 'hover:bg-white/5'
              }`}
              style={n.id === currentNovel ? { backgroundColor: '#5e6ad2' } : { color: '#d0d6e0' }}
              onClick={() => switchNovel(n.id)}
            >
              <span className="flex-1 truncate px-3 py-2 text-sm">{n.title}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: 'rgba(94,106,210,0.15)', color: '#5e6ad2' }}>
                {n.chapter}章
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`确定删除小说《${n.title}》？\n\n所有章节、伏笔、角色等数据将被永久删除！`)) {
                    api(`novels/${n.id}`, { method: 'DELETE' })
                      .then(() => {
                        toast.success(`《${n.title}》已删除`)
                        if (currentNovel === n.id) setCurrentNovel(null)
                        loadNovels()
                      })
                      .catch((err: any) => toast.error(err.message))
                  }
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-all shrink-0 mr-1"
                style={{ color: '#f87171' }}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button onClick={() => setShowCreateDialog(true)} className="w-full text-left px-3 py-2 rounded-lg text-sm mt-2 border border-dashed transition-all hover:border-solid" style={{ borderColor: '#3a3d45', color: '#5e6ad2' }}>
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
              { key: 'memory', icon: Brain, label: '记忆层' },
              { key: 'import', icon: Upload, label: '导入小说' },
              { key: 'nine-segment', icon: Layers, label: '九段式创作' },
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

        {/* Settings button at bottom */}
        <div className="p-3 border-t" style={{ borderColor: '#23252a' }}>
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-white/5 transition-all"
            style={{ color: '#8a8f98' }}
          >
            <Settings className="w-3.5 h-3.5" />
            API 设置
          </button>
        </div>
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
          <DashboardView novelId={currentNovel} onEdit={(ch) => { setView('editor') }} onRead={async () => {
            const data = await api(`novels/${currentNovel}/chapters`)
            setReaderChapters(data)
            setView('reader')
          }} />
        ) : view === 'editor' ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0" style={{ borderColor: '#23252a' }}>
              <button onClick={() => setView('dashboard')} className="p-1.5 rounded-lg hover:bg-white/5 transition-all" style={{ color: '#8a8f98' }}>
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-xs" style={{ color: '#8a8f98' }}>← 返回仪表盘</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <EditorView novelId={currentNovel} />
            </div>
          </div>
        ) : view === 'memory' ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0" style={{ borderColor: '#23252a' }}>
              <button onClick={() => setView('dashboard')} className="p-1.5 rounded-lg hover:bg-white/5 transition-all" style={{ color: '#8a8f98' }}>
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-xs" style={{ color: '#8a8f98' }}>← 返回仪表盘</span>
            </div>
            <div className="flex-1 overflow-auto">
              <MemoryLayer novelId={currentNovel} />
            </div>
          </div>
        ) : view === 'import' ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0" style={{ borderColor: '#23252a' }}>
              <button onClick={() => setView('dashboard')} className="p-1.5 rounded-lg hover:bg-white/5 transition-all" style={{ color: '#8a8f98' }}>
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-xs" style={{ color: '#8a8f98' }}>← 返回仪表盘</span>
            </div>
            <div className="flex-1 overflow-auto p-6 max-w-2xl mx-auto">
              <h1 className="text-xl font-bold mb-2" style={{ color: '#f7f8f8' }}>📥 导入已有小说</h1>
              <p className="text-xs mb-6" style={{ color: '#8a8f98' }}>上传 TXT/MD 文件，AI 自动解析章节、识别角色、提取世界观</p>
              <ImportNovel novelId={currentNovel} onComplete={() => loadNovels()} />
            </div>
          </div>
        ) : view === 'nine-segment' ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0" style={{ borderColor: '#23252a' }}>
              <button onClick={() => setView('dashboard')} className="p-1.5 rounded-lg hover:bg-white/5 transition-all" style={{ color: '#8a8f98' }}>
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-xs" style={{ color: '#8a8f98' }}>← 返回仪表盘</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <NineSegmentWorkflow novelId={currentNovel} />
            </div>
          </div>
        ) : view === 'reader' ? (
          <NovelReader
            title={novels.find(n => n.id === currentNovel)?.title || ''}
            chapters={readerChapters}
            novelId={currentNovel}
            initialChapter={readerIdx}
            onClose={() => setView('editor')}
          />
        ) : (
          <DataView novelId={currentNovel} />
        )}
      </main>

      {/* Create Novel Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md" style={{ backgroundColor: '#141516', borderColor: '#23252a' }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#f7f8f8' }}>新建小说</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: '#8a8f98' }}>小说ID（英文，如 jingubang）</label>
              <Input
                value={newNovel.id}
                onChange={e => setNewNovel({ ...newNovel, id: e.target.value })}
                placeholder="my-novel"
                style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }}
              />
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: '#8a8f98' }}>小说标题</label>
              <Input
                value={newNovel.title}
                onChange={e => setNewNovel({ ...newNovel, title: e.target.value })}
                placeholder="我的小说标题"
                style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }}
              />
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: '#8a8f98' }}>类型</label>
              <div className="flex flex-wrap gap-2">
                {['玄幻', '悬疑', '都市', '言情', '科幻', '仙侠', '历史', '恐怖', '未分类'].map(g => (
                  <button
                    key={g}
                    onClick={() => setNewNovel({ ...newNovel, genre: g })}
                    className="px-3 py-1.5 rounded-lg text-xs border transition-all"
                    style={newNovel.genre === g
                      ? { backgroundColor: '#5e6ad2', borderColor: '#5e6ad2', color: 'white' }
                      : { borderColor: '#23252a', color: '#d0d6e0' }
                    }
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              style={{ borderColor: '#23252a', color: '#d0d6e0' }}
            >
              取消
            </Button>
            <Button
              onClick={createNovel}
              disabled={creating || !newNovel.id.trim() || !newNovel.title.trim()}
              style={{ backgroundColor: '#5e6ad2', color: 'white' }}
            >
              {creating ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto" style={{ backgroundColor: '#141516', borderColor: '#23252a' }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#f7f8f8' }}>⚙️ API 设置</DialogTitle>
          </DialogHeader>
          <APISettings onClose={() => setShowSettings(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ========== Dashboard ==========
function DashboardView({ novelId, onEdit, onRead }: { novelId: string; onEdit: (ch: number) => void; onRead?: () => void }) {
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
            {(status.soul.core_selling_points || status.soul.core_hooks || []).map((h: string, i: number) => (
              <span key={i} className="px-2.5 py-1 rounded-full text-xs" style={{ backgroundColor: 'rgba(94,106,210,0.12)', color: '#5e6ad2' }}>{h}</span>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 rounded-xl border" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
        <h3 className="text-sm font-semibold mb-3">快速开始</h3>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => onEdit(status.chapter + 1)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: '#5e6ad2', color: 'white' }}
          >
            写第{(status.chapter || 0) + 1}章 →
          </button>
          {onRead && status.chapter > 0 && (
            <button
              onClick={onRead}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-white/5 flex items-center gap-1.5"
              style={{ borderColor: '#4ade80', color: '#4ade80' }}
            >
              <BookMarked className="w-3.5 h-3.5" />
              阅读小说
            </button>
          )}
          <button
            onClick={() => window.open(`/api/novel/export?novelId=${novelId}&format=txt`, '_blank')}
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-white/5 flex items-center gap-1.5"
            style={{ borderColor: '#23252a', color: '#d0d6e0' }}
          >
            <Download className="w-3.5 h-3.5" />
            导出 TXT
          </button>
          <button
            onClick={() => window.open(`/api/novel/export?novelId=${novelId}&format=md`, '_blank')}
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-white/5 flex items-center gap-1.5"
            style={{ borderColor: '#23252a', color: '#d0d6e0' }}
          >
            <Download className="w-3.5 h-3.5" />
            导出 MD
          </button>
          <button
            onClick={() => window.open(`/api/novel/export?novelId=${novelId}&format=epub`, '_blank')}
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-white/5 flex items-center gap-1.5"
            style={{ borderColor: '#23252a', color: '#d0d6e0' }}
          >
            <Download className="w-3.5 h-3.5" />
            导出 EPUB
          </button>
        </div>
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
  const [chapterList, setChapterList] = useState<{ chapter: number; title: string; word_count: number }[]>([])
  const [generating, setGenerating] = useState(false)
  const [generatedText, setGeneratedText] = useState('')

  // Load chapter list
  useEffect(() => {
    api(`novels/${novelId}/chapters`).then(setChapterList).catch(() => setChapterList([]))
  }, [novelId])

  // Load chapter content
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

      setMessage(`✅ 已保存 (${content.length}字)`)
      toast.success(`第${chapter}章已保存`)
      // Refresh chapter list
      api(`novels/${novelId}/chapters`).then(setChapterList).catch(() => {})
    } catch (e: any) {
      setMessage(`❌ ${e.message}`)
      toast.error(e.message)
    }
    setSaving(false)
  }

  const generateWithAI = async () => {
    setGenerating(true)
    setGeneratedText('')
    try {
      // First get the prompt
      const promptData = await api(`novels/${novelId}/prompt/${chapter}`)
      const writingPrompt = promptData.prompt

      // Call streaming generation endpoint
      const { getAISettings } = await import('./APISettings')
      const aiSettings = getAISettings()
      const res = await fetch('/api/novel/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ novelId, chapter, prompt: writingPrompt, aiSettings }),
      })

      if (!res.ok) throw new Error('生成失败')

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          // Parse SSE format
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break
              try {
                const parsed = JSON.parse(data)
                const delta = parsed.choices?.[0]?.delta?.content || ''
                fullText += delta
                setGeneratedText(fullText)
              } catch {}
            }
          }
        }
      }

      if (fullText) {
        setContent(fullText)
        toast.success('AI 生成完成，可以编辑后保存')
      }
    } catch (e: any) {
      toast.error(`生成失败: ${e.message}`)
    }
    setGenerating(false)
  }

  // 通用编辑模式生成
  const generateWithMode = async (mode: string, stylePrompt?: string, selectedText?: string) => {
    setGenerating(true)
    setGeneratedText('')
    try {
      const { getAISettings } = await import('./APISettings')
      const aiSettings = getAISettings()
      const res = await fetch('/api/novel/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          novelId, chapter,
          prompt: stylePrompt || '',
          mode,
          selectedText: selectedText || undefined,
          aiSettings,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '生成失败')
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

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
                const delta = parsed.choices?.[0]?.delta?.content || ''
                fullText += delta
                setGeneratedText(fullText)
              } catch {}
            }
          }
        }
      }

      if (fullText) {
        if (mode === 'polish' || mode === 'expand' || mode === 'condense') {
          // 局部编辑：替换选中部分
          const textarea = document.querySelector('textarea') as HTMLTextAreaElement
          if (textarea) {
            const start = textarea.selectionStart
            const end = textarea.selectionEnd
            const newContent = content.substring(0, start) + fullText + content.substring(end)
            setContent(newContent)
            toast.success(`${mode === 'polish' ? '润色' : mode === 'expand' ? '扩写' : '缩写'}完成，已替换选中内容`)
          } else {
            setContent(fullText)
            toast.success('生成完成')
          }
        } else {
          // 整体替换（重写/续写/风格迁移）
          if (mode === 'continue') {
            setContent(content + fullText)
            toast.success('续写完成，已追加到末尾')
          } else {
            setContent(fullText)
            toast.success(`${mode === 'rewrite' ? '重写' : '风格迁移'}完成，可编辑后保存`)
          }
        }
      }
    } catch (e: any) {
      toast.error(`生成失败: ${e.message}`)
    }
    setGenerating(false)
  }

  return (
    <div className="flex h-full">
      {/* Left: Chapter List + Controls */}
      <div className="w-56 border-r flex flex-col" style={{ borderColor: '#23252a', backgroundColor: '#0a0b0c' }}>
        {/* Chapter List */}
        <div className="flex-1 overflow-y-auto p-2">
          <p className="text-[10px] uppercase tracking-widest mb-2 px-2" style={{ color: '#8a8f98' }}>章节列表（{chapterList.length}章）</p>
          {chapterList.length === 0 ? (
            <p className="text-xs px-2 py-4" style={{ color: '#8a8f98' }}>暂无章节，开始写第1章</p>
          ) : (
            chapterList.map(ch => (
              <div
                key={ch.chapter}
                className={`group flex items-center gap-1 rounded text-xs mb-0.5 transition-all cursor-pointer ${
                  ch.chapter === chapter ? 'text-white' : 'hover:bg-white/5'
                }`}
                style={ch.chapter === chapter ? { backgroundColor: '#5e6ad2' } : { color: '#d0d6e0' }}
                onClick={() => setChapter(ch.chapter)}
              >
                <span className="flex-1 truncate px-2 py-1.5">{ch.title || `第${ch.chapter}章`}</span>
                <span className="text-[10px] shrink-0" style={{ color: ch.chapter === chapter ? 'rgba(255,255,255,0.6)' : '#8a8f98' }}>
                  {ch.word_count || 0}字
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`确定删除"${ch.title || `第${ch.chapter}章`}"？`)) {
                      api(`novels/${novelId}/chapters/${ch.chapter}`, { method: 'DELETE' })
                        .then(() => {
                          toast.success('已删除')
                          // 刷新章节列表
                          api(`novels/${novelId}/chapters`).then(setChapterList).catch(() => {})
                          if (chapter === ch.chapter) setChapter(Math.max(1, ch.chapter - 1))
                        })
                        .catch((err: any) => toast.error(err.message))
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all shrink-0"
                  style={{ color: '#f87171' }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
          {/* New chapter button */}
          <button
            onClick={() => {
              const nextCh = chapterList.length > 0 ? Math.max(...chapterList.map(c => c.chapter)) + 1 : 1
              setChapter(nextCh)
              setContent('')
            }}
            className="w-full text-left px-2 py-1.5 rounded text-xs mt-1 border border-dashed transition-all hover:border-solid"
            style={{ borderColor: '#3a3d45', color: '#5e6ad2' }}
          >
            <Plus className="w-3 h-3 inline mr-1" />
            新章节
          </button>
        </div>

        {/* Controls */}
        <div className="p-3 border-t space-y-2" style={{ borderColor: '#23252a' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: '#f7f8f8' }}>第{chapter}章</span>
            <span className="text-[10px]" style={{ color: '#8a8f98' }}>{chapterList.length}章</span>
          </div>
          <button onClick={loadPrep} className="w-full px-3 py-1.5 rounded-lg text-xs border hover:bg-white/5 flex items-center gap-2" style={{ borderColor: '#23252a', color: '#d0d6e0' }}>
            <Zap className="w-3.5 h-3.5" style={{ color: '#5e6ad2' }} />
            查看约束
          </button>
          <button onClick={loadPrompt} className="w-full px-3 py-1.5 rounded-lg text-xs border hover:bg-white/5 flex items-center gap-2" style={{ borderColor: '#23252a', color: '#d0d6e0' }}>
            <BookOpen className="w-3.5 h-3.5" style={{ color: '#5e6ad2' }} />
            生成写作提示
          </button>
          <button
            onClick={generateWithAI}
            disabled={generating}
            className="w-full px-3 py-1.5 rounded-lg text-xs border hover:bg-white/5 flex items-center gap-2 transition-all"
            style={{ borderColor: generating ? '#3a3d45' : '#5e6ad2', color: generating ? '#8a8f98' : '#5e6ad2' }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {generating ? '生成中...' : 'AI 自动生成'}
          </button>

          {/* 编辑工具 */}
          <div className="mt-1">
            <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: '#8a8f98' }}>编辑工具</p>
            <div className="grid grid-cols-2 gap-1">
              {[
                { mode: 'rewrite', icon: '🔄', label: '重写' },
                { mode: 'polish', icon: '✨', label: '润色选中' },
                { mode: 'expand', icon: '📝', label: '扩写选中' },
                { mode: 'condense', icon: '✂️', label: '缩写选中' },
                { mode: 'continue', icon: '➡️', label: '续写' },
                { mode: 'style', icon: '🎨', label: '风格迁移' },
              ].map(btn => (
                <button
                  key={btn.mode}
                  onClick={() => {
                    const textarea = document.querySelector('textarea')
                    const selected = textarea ? textarea.value.substring(textarea.selectionStart, textarea.selectionEnd) : ''
                    if ((btn.mode === 'polish' || btn.mode === 'expand' || btn.mode === 'condense') && !selected) {
                      toast.error('请先在编辑器中选中要操作的文字')
                      return
                    }
                    if (btn.mode === 'style') {
                      const style = window.prompt('请输入目标风格（如：轻松幽默、热血爽文、悬疑紧张、文艺清新）：')
                      if (!style) return
                      generateWithMode('style', style)
                    } else if (btn.mode === 'rewrite') {
                      if (!content.trim()) { toast.error('章节内容为空'); return }
                      generateWithMode('rewrite')
                    } else if (btn.mode === 'continue') {
                      generateWithMode('continue')
                    } else {
                      generateWithMode(btn.mode, undefined, selected)
                    }
                  }}
                  disabled={generating}
                  className="px-2 py-1.5 rounded text-[11px] border hover:bg-white/5 transition-all text-left"
                  style={{ borderColor: '#23252a', color: '#d0d6e0' }}
                >
                  {btn.icon} {btn.label}
                </button>
              ))}
            </div>
          </div>

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

          {/* Agent Workflow */}
          <div className="mt-2">
            <WorkflowPanel novelId={novelId} chapter={chapter} onComplete={() => {
              // 工作流完成后刷新章节列表
              api(`novels/${novelId}/chapters`).then(setChapterList).catch(() => {})
            }} />
          </div>
        </div>
      </div>

      {/* Center: Editor */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: '#23252a' }}>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: '#8a8f98' }}>{content.length}字</span>
            {generating && (
              <span className="text-xs flex items-center gap-1" style={{ color: '#5e6ad2' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#5e6ad2' }} />
                AI 正在生成...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {message && <span className="text-xs" style={{ color: message.startsWith('✅') ? '#4ade80' : '#f87171' }}>{message}</span>}
            <button
              onClick={save}
              disabled={saving || generating}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              style={{ backgroundColor: '#5e6ad2', color: 'white' }}
            >
              {saving ? '保存中...' : '💾 保存'}
            </button>
          </div>
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          className="flex-1 w-full p-6 bg-transparent resize-none outline-none text-base leading-relaxed"
          style={{ color: '#f7f8f8', fontFamily: 'var(--font-noto-serif), serif' }}
          placeholder={generating ? 'AI 正在生成内容...' : `在这里写第${chapter}章...\n\n点击"AI 自动生成"或"生成写作提示"开始`}
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
