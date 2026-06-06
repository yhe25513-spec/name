'use client'

import { useState, useRef, useEffect } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Settings, List, Moon, Sun, Maximize, Minimize, ArrowLeft, Loader2 } from 'lucide-react'

interface Chapter {
  title: string
  content?: string
  chapter: number
  chapter_num?: number
  word_count: number
}

interface ReaderSettings {
  fontSize: number
  lineHeight: number
  theme: 'light' | 'dark' | 'sepia'
  fontFamily: string
}

const THEMES = {
  light: { bg: '#ffffff', text: '#1a1a1a', accent: '#3b82f6', card: '#f5f5f5' },
  dark: { bg: '#0a0b0c', text: '#e0e0e0', accent: '#5e6ad2', card: '#141516' },
  sepia: { bg: '#f5e6c8', text: '#5b4636', accent: '#b8860b', card: '#ede0c8' },
}

const FONT_FAMILIES = [
  { label: '默认', value: 'system-ui, -apple-system, sans-serif' },
  { label: '宋体', value: '"SimSun", "Songti SC", serif' },
  { label: '楷体', value: '"KaiTi", "Kaiti SC", serif' },
  { label: '思源宋体', value: '"Noto Serif SC", serif' },
  { label: '思源黑体', value: '"Noto Sans SC", sans-serif' },
]

export default function NovelReader({
  title,
  chapters,
  novelId,
  initialChapter = 0,
  onClose,
}: {
  title: string
  chapters: Chapter[]
  novelId?: string
  initialChapter?: number
  onClose?: () => void
}) {
  const [chapterIdx, setChapterIdx] = useState(initialChapter)
  const [chapterContent, setChapterContent] = useState('')
  const [loadingContent, setLoadingContent] = useState(false)
  const [settings, setSettings] = useState<ReaderSettings>({
    fontSize: 18,
    lineHeight: 2.0,
    theme: 'dark',
    fontFamily: FONT_FAMILIES[0].value,
  })
  const [showToc, setShowToc] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [progress, setProgress] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)

  const theme = THEMES[settings.theme]
  const chapter = chapters[chapterIdx]

  // 加载章节内容
  useEffect(() => {
    if (!novelId || !chapter) return
    setLoadingContent(true)
    const chNum = chapter.chapter || chapter.chapter_num || chapterIdx + 1
    fetch(`/api/novel?path=${encodeURIComponent(`novels/${novelId}/chapters/${chNum}`)}`)
      .then(r => r.json())
      .then(data => {
        setChapterContent(data.content || '')
        setLoadingContent(false)
      })
      .catch(() => {
        setChapterContent('加载失败')
        setLoadingContent(false)
      })
  }, [novelId, chapter, chapterIdx])

  // 阅读进度追踪
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const handler = () => {
      const pct = el.scrollTop / (el.scrollHeight - el.clientHeight) * 100
      setProgress(Math.min(100, Math.max(0, pct || 0)))
    }
    el.addEventListener('scroll', handler)
    return () => el.removeEventListener('scroll', handler)
  }, [chapterIdx])

  // 切换章节时滚动到顶部
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0)
    setProgress(0)
  }, [chapterIdx])

  // 键盘导航
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        if (chapterIdx < chapters.length - 1) setChapterIdx(chapterIdx + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (chapterIdx > 0) setChapterIdx(chapterIdx - 1)
      } else if (e.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [chapterIdx, chapters.length])

  // 全屏切换
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: theme.bg, color: theme.text }}>
      {/* 顶部栏 */}
      <header className="flex items-center justify-between px-4 py-2 border-b shrink-0" style={{ borderColor: `${theme.text}15` }}>
        <div className="flex items-center gap-3">
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: theme.text }}>
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <span className="text-xs truncate max-w-[200px]" style={{ color: `${theme.text}80` }}>{title}</span>
        </div>

        <span className="text-sm font-medium truncate max-w-[300px]">{chapter?.title || `第${chapterIdx + 1}章`}</span>

        <div className="flex items-center gap-1">
          <button onClick={() => setShowToc(!showToc)} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: theme.text }}>
            <List className="w-4 h-4" />
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: theme.text }}>
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={toggleFullscreen} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: theme.text }}>
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 目录侧边栏 */}
        {showToc && (
          <aside className="w-64 shrink-0 overflow-y-auto border-r p-4" style={{ borderColor: `${theme.text}15`, backgroundColor: theme.card }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: theme.text }}>目录</h3>
            <div className="space-y-0.5">
              {chapters.map((ch, i) => (
                <button
                  key={i}
                  onClick={() => { setChapterIdx(i); setShowToc(false) }}
                  className="w-full text-left py-2 px-3 rounded-lg text-xs transition-all"
                  style={i === chapterIdx
                    ? { backgroundColor: `${theme.accent}20`, color: theme.accent, fontWeight: 600 }
                    : { color: `${theme.text}99` }
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{ch.title}</span>
                    <span className="text-[10px] shrink-0 ml-2" style={{ color: `${theme.text}50` }}>
                      {(ch.word_count || 0).toLocaleString()}字
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* 主阅读区 */}
        <main
          ref={contentRef}
          className="flex-1 overflow-y-auto scroll-smooth"
          style={{ scrollBehavior: 'smooth' }}
        >
          <div
            className="mx-auto px-6 py-12"
            style={{
              maxWidth: '42rem',
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
              fontFamily: settings.fontFamily,
            }}
          >
            {/* 章节标题 */}
            <h1 className="text-center text-2xl font-bold mb-12" style={{ color: theme.text }}>
              {chapter?.title || `第${chapterIdx + 1}章`}
            </h1>

            {/* 章节正文 */}
            {loadingContent ? (
              <div className="text-center py-12">
                <Loader2 className="w-6 h-6 mx-auto mb-3 animate-spin" style={{ color: theme.accent }} />
                <p className="text-sm" style={{ color: `${theme.text}80` }}>加载中...</p>
              </div>
            ) : (
              (chapterContent || chapter?.content || '').split('\n').map((para, i) => (
                <p key={i} className="mb-4 text-justify" style={{ color: theme.text, textIndent: '2em' }}>
                  {para.trim() || ' '}
                </p>
              ))
            )}

            {/* 章节导航 */}
            <div className="flex justify-between items-center mt-16 pt-8 border-t" style={{ borderColor: `${theme.text}15` }}>
              <button
                disabled={chapterIdx === 0}
                onClick={() => setChapterIdx(chapterIdx - 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm disabled:opacity-30 transition-all"
                style={{ backgroundColor: `${theme.accent}15`, color: theme.accent }}
              >
                <ChevronLeft className="w-4 h-4" /> 上一章
              </button>

              <span className="text-xs" style={{ color: `${theme.text}50` }}>
                {chapterIdx + 1} / {chapters.length}
              </span>

              <button
                disabled={chapterIdx === chapters.length - 1}
                onClick={() => setChapterIdx(chapterIdx + 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm disabled:opacity-30 transition-all"
                style={{ backgroundColor: `${theme.accent}15`, color: theme.accent }}
              >
                下一章 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* 底部进度条 */}
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: `${theme.text}10` }}>
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${((chapterIdx + progress / 100) / chapters.length) * 100}%`,
            backgroundColor: theme.accent,
          }}
        />
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div
          className="absolute bottom-8 right-4 p-4 rounded-xl shadow-2xl border w-56 space-y-4"
          style={{ backgroundColor: theme.card, borderColor: `${theme.text}15` }}
        >
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: `${theme.text}80` }}>字号: {settings.fontSize}px</label>
            <input type="range" min="14" max="28" value={settings.fontSize}
              onChange={e => setSettings(s => ({ ...s, fontSize: +e.target.value }))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: theme.accent }}
            />
          </div>

          <div>
            <label className="text-xs mb-1.5 block" style={{ color: `${theme.text}80` }}>行距: {settings.lineHeight}</label>
            <input type="range" min="1.5" max="3.0" step="0.1" value={settings.lineHeight}
              onChange={e => setSettings(s => ({ ...s, lineHeight: +e.target.value }))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: theme.accent }}
            />
          </div>

          <div>
            <label className="text-xs mb-1.5 block" style={{ color: `${theme.text}80` }}>主题</label>
            <div className="flex gap-2">
              {(['light', 'dark', 'sepia'] as const).map(t => (
                <button key={t} onClick={() => setSettings(s => ({ ...s, theme: t }))}
                  className="w-8 h-8 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: THEMES[t].bg,
                    borderColor: t === settings.theme ? theme.accent : 'transparent',
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs mb-1.5 block" style={{ color: `${theme.text}80` }}>字体</label>
            <select value={settings.fontFamily}
              onChange={e => setSettings(s => ({ ...s, fontFamily: e.target.value }))}
              className="w-full p-1.5 rounded-lg border text-xs"
              style={{ backgroundColor: theme.bg, borderColor: `${theme.text}15`, color: theme.text }}
            >
              {FONT_FAMILIES.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
