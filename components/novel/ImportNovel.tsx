'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, FileText, CheckCircle, Loader2, Users, Globe, Clock, Eye, Link2, Brain, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getAISettings } from './APISettings'

interface ImportResult {
  stats: { chapterCount: number; totalWords: number; avgWordsPerChapter: number }
  savedCount: number
  savedSettings: number
  totalChapters: number
  filesCount: number
  analysis?: {
    savedChars: number; savedWorlds: number; savedEvents: number
    savedForeshadows: number; savedMysteries: number; savedRelationships: number
    hasSoul: boolean; hasStyle: boolean
  } | null
  message: string
}

export default function ImportNovel({ novelId, onComplete }: { novelId: string; onComplete?: () => void }) {
  const [files, setFiles] = useState<File[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [analyzeWithAI, setAnalyzeWithAI] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [apiConfigured, setApiConfigured] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const settings = getAISettings()
    setApiConfigured(!!settings.apiKey || settings.provider === 'ollama')
  }, [])

  const handleFiles = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).filter(f => f.name.endsWith('.txt') || f.name.endsWith('.md'))
    if (arr.length === 0) { toast.error('请上传 TXT 或 MD 格式的文件'); return }
    const oversized = arr.find(f => f.size > 20 * 1024 * 1024)
    if (oversized) { toast.error(`${oversized.name} 超过 20MB 限制`); return }
    setFiles(prev => [...prev, ...arr])
    setResult(null)
  }

  const removeFile = (idx: number) => setFiles(files.filter((_, i) => i !== idx))

  const startImport = async () => {
    if (files.length === 0) return
    setImporting(true)
    try {
      // 获取 AI 设置
      const { getAISettings } = await import('./APISettings')
      const aiSettings = getAISettings()

      const formData = new FormData()
      files.forEach(f => formData.append('files', f))
      formData.append('novelId', novelId)
      formData.append('analyze', String(analyzeWithAI))
      if (aiSettings.provider) formData.append('aiProvider', aiSettings.provider)
      if (aiSettings.apiKey) formData.append('aiApiKey', aiSettings.apiKey)
      if (aiSettings.baseUrl) formData.append('aiBaseUrl', aiSettings.baseUrl)
      if (aiSettings.model) formData.append('aiModel', aiSettings.model)

      const res = await fetch('/api/novel/import', { method: 'POST', body: formData })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }

      const data = await res.json()
      setResult(data)
      if (data.hasApiKey === false && !data.analysis) {
        toast.warning('AI分析未执行', { description: '请在「API设置」中配置API Key，然后点击「AI分析填充记忆层」' })
      } else {
        toast.success(data.message)
      }
      onComplete?.()
    } catch (e: any) { toast.error(`导入失败: ${e.message}`) }
    setImporting(false)
  }

  if (result) {
    return (
      <div className="rounded-xl border p-6 space-y-4" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5" style={{ color: '#4ade80' }} />
          <h3 className="text-sm font-semibold" style={{ color: '#f7f8f8' }}>导入完成</h3>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg text-center" style={{ backgroundColor: '#0a0b0c', border: '1px solid #23252a' }}>
            <FileText className="w-4 h-4 mx-auto mb-1" style={{ color: '#5e6ad2' }} />
            <div className="text-lg font-bold" style={{ color: '#f7f8f8' }}>{result.savedCount}</div>
            <div className="text-[10px]" style={{ color: '#8a8f98' }}>章已保存</div>
          </div>
          <div className="p-3 rounded-lg text-center" style={{ backgroundColor: '#0a0b0c', border: '1px solid #23252a' }}>
            <FileText className="w-4 h-4 mx-auto mb-1" style={{ color: '#fbbf24' }} />
            <div className="text-lg font-bold" style={{ color: '#f7f8f8' }}>{result.stats.totalWords.toLocaleString()}</div>
            <div className="text-[10px]" style={{ color: '#8a8f98' }}>总字数</div>
          </div>
          <div className="p-3 rounded-lg text-center" style={{ backgroundColor: '#0a0b0c', border: '1px solid #23252a' }}>
            <FileText className="w-4 h-4 mx-auto mb-1" style={{ color: '#4ade80' }} />
            <div className="text-lg font-bold" style={{ color: '#f7f8f8' }}>{result.filesCount}</div>
            <div className="text-[10px]" style={{ color: '#8a8f98' }}>个文件</div>
          </div>
        </div>

        {result.savedSettings > 0 && (
          <div className="p-3 rounded-lg flex items-center gap-2" style={{ backgroundColor: 'rgba(94,106,210,0.08)', border: '1px solid rgba(94,106,210,0.2)' }}>
            <Brain className="w-4 h-4" style={{ color: '#5e6ad2' }} />
            <span className="text-xs" style={{ color: '#5e6ad2' }}>{result.savedSettings} 个设定文件已写入记忆层（世界观/角色/势力/地点等）</span>
          </div>
        )}

        {result.analysis && (
          <div className="p-3 rounded-lg" style={{ backgroundColor: '#0a0b0c', border: '1px solid #23252a' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Brain className="w-3.5 h-3.5" style={{ color: '#5e6ad2' }} />
              <span className="text-xs font-semibold" style={{ color: '#f7f8f8' }}>AI 分析结果已写入记忆层</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { icon: Users, label: '角色', value: result.analysis.savedChars, color: '#a78bfa' },
                { icon: Globe, label: '世界观', value: result.analysis.savedWorlds, color: '#fbbf24' },
                { icon: Clock, label: '事件', value: result.analysis.savedEvents, color: '#5e6ad2' },
                { icon: Eye, label: '伏笔', value: result.analysis.savedForeshadows, color: '#4ade80' },
                { icon: AlertTriangle, label: '悬念', value: result.analysis.savedMysteries, color: '#f87171' },
                { icon: Link2, label: '关系', value: result.analysis.savedRelationships, color: '#06b6d4' },
              ].map((item, i) => (
                <div key={i} className="p-2 rounded" style={{ backgroundColor: '#141516' }}>
                  <item.icon className="w-3 h-3 mx-auto mb-0.5" style={{ color: item.color }} />
                  <div className="text-xs font-bold" style={{ color: item.color }}>{item.value}</div>
                  <div className="text-[9px]" style={{ color: '#8a8f98' }}>{item.label}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2 justify-center">
              {result.analysis.hasSoul && (
                <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>🎯 灵魂设定已提取</span>
              )}
              {result.analysis.hasStyle && (
                <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(94,106,210,0.12)', color: '#5e6ad2' }}>✍️ 写作风格已提取</span>
              )}
            </div>
          </div>
        )}

        <Button onClick={() => { setResult(null); setFiles([]) }} variant="outline" size="sm" style={{ borderColor: '#23252a', color: '#d0d6e0' }}>
          继续导入
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* API 未配置警告 */}
      {!apiConfigured && (
        <div className="rounded-xl border p-4 flex items-start gap-3" style={{ borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.08)' }}>
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#fbbf24' }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: '#fbbf24' }}>未配置 AI API</p>
            <p className="text-[11px] mt-1" style={{ color: '#8a8f98' }}>
              请先点击左下角「API 设置」配置 DeepSeek 或其他 AI 提供商的 API Key，否则 AI 分析功能无法使用。
            </p>
          </div>
        </div>
      )}

      {/* 拖拽上传区 */}
      <div
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${dragOver ? 'scale-[1.02]' : ''}`}
        style={{ borderColor: dragOver ? '#5e6ad2' : '#23252a', backgroundColor: dragOver ? 'rgba(94,106,210,0.05)' : '#141516' }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".txt,.md" multiple className="hidden"
          onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }} />
        <Upload className="w-10 h-10 mx-auto mb-2" style={{ color: '#8a8f98' }} />
        <p className="text-sm" style={{ color: '#d0d6e0' }}>拖拽 TXT/MD 文件到这里</p>
        <p className="text-xs" style={{ color: '#8a8f98' }}>支持批量上传，每个文件最大 20MB</p>
      </div>

      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: '#f7f8f8' }}>已选择 {files.length} 个文件</span>
            <button onClick={() => setFiles([])} className="text-[10px]" style={{ color: '#f87171' }}>清空</button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded" style={{ backgroundColor: '#0a0b0c' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: '#5e6ad2' }} />
                  <span className="text-xs truncate" style={{ color: '#d0d6e0' }}>{f.name}</span>
                  <span className="text-[10px] shrink-0" style={{ color: '#8a8f98' }}>{(f.size / 1024).toFixed(0)}KB</span>
                </div>
                <button onClick={() => removeFile(i)} className="text-[10px] shrink-0 ml-2" style={{ color: '#f87171' }}>删除</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI 分析选项 */}
      <div className="rounded-xl border p-4" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={analyzeWithAI} onChange={e => setAnalyzeWithAI(e.target.checked)}
            className="w-4 h-4 rounded" style={{ accentColor: '#5e6ad2' }} />
          <div>
            <span className="text-xs font-semibold" style={{ color: '#f7f8f8' }}>AI 智能分析</span>
            <p className="text-[10px]" style={{ color: '#8a8f98' }}>自动识别角色、世界观、事件，写入记忆层</p>
          </div>
        </label>
      </div>

      {/* 已有章节修复工具 */}
      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
        <p className="text-xs font-semibold" style={{ color: '#f7f8f8' }}>🔧 修复工具（针对已导入的章节）</p>
        <div className="flex gap-2">
          <button onClick={async () => {
            toast.info('正在修复章节标题...')
            const res = await fetch(`/api/novel/import?novelId=${novelId}&action=fix-titles`)
            const data = await res.json()
            if (data.ok) toast.success(`已修复 ${data.fixedCount} 个章节标题`)
            else toast.error(data.error || '修复失败')
          }} className="px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: '#23252a', color: '#d0d6e0' }}>
            修复章节标题
          </button>
          <button onClick={async () => {
            const { getAISettings } = await import('./APISettings')
            const aiSettings = getAISettings()
            if (!aiSettings.apiKey && aiSettings.provider !== 'ollama') {
              toast.error('请先在「API 设置」中配置 API Key')
              return
            }
            toast.info('正在 AI 分析记忆层...')
            const params = new URLSearchParams({ novelId, action: 'analyze' })
            if (aiSettings.provider) params.set('aiProvider', aiSettings.provider)
            if (aiSettings.apiKey) params.set('aiApiKey', aiSettings.apiKey)
            if (aiSettings.baseUrl) params.set('aiBaseUrl', aiSettings.baseUrl)
            if (aiSettings.model) params.set('aiModel', aiSettings.model)
            const res = await fetch(`/api/novel/import?${params.toString()}`)
            const data = await res.json()
            if (data.ok) {
              toast.success(`AI 分析完成：${data.analysis.savedChars}角色，${data.analysis.savedWorlds}世界观，${data.analysis.savedEvents}事件`)
              onComplete?.()
            } else toast.error(data.error || '分析失败')
          }} className="px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: '#5e6ad2', color: '#5e6ad2' }}>
            AI 分析填充记忆层
          </button>
        </div>
      </div>

      {/* 导入按钮 */}
      {files.length > 0 && (
        <Button onClick={startImport} disabled={importing} className="w-full" style={{ backgroundColor: '#5e6ad2', color: 'white' }}>
          {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          {importing ? '导入中...' : `导入 ${files.length} 个文件`}
        </Button>
      )}
    </div>
  )
}

// 需要导入 Zap 图标
import { Zap } from 'lucide-react'

