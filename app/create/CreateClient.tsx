'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ImageIcon, Video, Sparkles, ArrowLeft, Download, RotateCcw, Loader2, Clock, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

type Mode = 'image' | 'video'
type Style = '写实' | '奇幻' | '水墨' | '赛博' | '原画'
type Ratio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
type Duration = '3' | '5' | '10' | '18'

interface HistoryItem {
  id: string
  mode: Mode
  prompt: string
  style: Style
  url: string
  timestamp: number
}

const STYLE_MODIFIERS: Record<Style, string> = {
  '写实': '，摄影写实风格，超高清，真实光影，细腻纹理',
  '奇幻': '，奇幻艺术风格，魔法氛围，梦幻光影，史诗感',
  '水墨': '，中国传统水墨画风格，墨色晕染，留白意境，雅致',
  '赛博': '，赛博朋克风格，霓虹灯光，暗调氛围，未来都市',
  '原画': '，游戏原画风格，精致构图，概念艺术，细节丰富',
}

const STYLE_INFO: Record<Style, { active: string }> = {
  '写实': { active: 'bg-blue-500/20 border-blue-500/50 text-blue-300' },
  '奇幻': { active: 'bg-purple-500/20 border-purple-500/50 text-purple-300' },
  '水墨': { active: 'bg-zinc-500/20 border-zinc-500/50 text-zinc-300' },
  '赛博': { active: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' },
  '原画': { active: 'bg-orange-500/20 border-orange-500/50 text-orange-300' },
}

const RATIO_LABELS: Record<Ratio, string> = {
  '1:1': '方形',
  '16:9': '横版',
  '9:16': '竖版',
  '4:3': '横屏',
  '3:4': '竖屏',
}

const RATIO_SIZE: Record<Ratio, string> = {
  '1:1': '1024x1024',
  '16:9': '1024x576',
  '9:16': '576x1024',
  '4:3': '1024x768',
  '3:4': '768x1024',
}

const DURATION_FRAMES: Record<Duration, number> = {
  '3': 81,
  '5': 121,
  '10': 241,
  '18': 441,
}

const DURATION_LABELS: Record<Duration, string> = {
  '3': '3 秒',
  '5': '5 秒',
  '10': '10 秒',
  '18': '18 秒',
}

const HISTORY_KEY = 'create-history'
const POLL_INTERVAL = 2000
const MAX_POLL_TIME = 1800000 // 30 分钟超时

export function CreateClient({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>(() => {
    const param = searchParams.get('mode') as Mode
    return (param as Mode) || 'image'
  })
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState<Style>('奇幻')
  const [ratio, setRatio] = useState<Ratio>('1:1')
  const [generating, setGenerating] = useState(false)
  const [generatingMode, setGeneratingMode] = useState<Mode>('image')
  const [pollingStatus, setPollingStatus] = useState('')
  const [resultUrl, setResultUrl] = useState('')
  const [resultMode, setResultMode] = useState<Mode>('image')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showLimitDialog, setShowLimitDialog] = useState(false)
  const [videoImageFiles, setVideoImageFiles] = useState<File[]>([])
  const [videoImagePreviews, setVideoImagePreviews] = useState<string[]>([])
  const [videoDuration, setVideoDuration] = useState<Duration>('5')
  const [imageRefFiles, setImageRefFiles] = useState<File[]>([])
  const [imageRefPreviews, setImageRefPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  // 加载历史记录
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY)
      if (saved) setHistory(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  // 清理轮询
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // 保存历史
  const saveToHistory = useCallback((item: HistoryItem) => {
    setHistory(prev => {
      const updated = [item, ...prev].slice(0, 20)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // 清空历史
  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY)
    setHistory([])
    toast.success('历史已清空')
  }

  // 删除单条历史
  const deleteHistoryItem = (id: string) => {
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id)
      if (updated.length === 0) {
        localStorage.removeItem(HISTORY_KEY)
      } else {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
      }
      return updated
    })
    toast.success('已删除')
  }

  // 下载文件（通过服务端代理绕过 CORS，兼容手机浏览器）
  async function handleDownload(url: string) {
    try {
      toast.success('正在准备下载...')
      const res = await fetch('/api/generate-video/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '下载失败' }))
        throw new Error(err.error)
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const filenameMatch = disposition?.match(/filename="?(.+?)"?$/)
      const filename = filenameMatch?.[1] || `ai-创作-${Date.now()}.mp4`

      // 检测是否为移动设备
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

      if (isMobile) {
        // 手机：打开 blob URL 让浏览器原生处理（用户可长按保存）
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.target = '_blank'
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        // 延迟释放，给浏览器时间处理
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
        toast.success('已打开文件，请长按保存到相册')
      } else {
        // 桌面：用传统 a.download 方式
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = filename
        a.click()
        URL.revokeObjectURL(a.href)
        toast.success('下载完成')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '下载失败'
      toast.error('下载失败', { description: msg })
    }
  }

  // 处理视频图片上传（支持多张）
  function handleVideoImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const validFiles: File[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) {
        toast.error(`"${file.name}" 不是图片文件，已跳过`)
        continue
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`"${file.name}" 超过 20MB，已跳过`)
        continue
      }
      validFiles.push(file)
    }

    if (validFiles.length === 0) return

    // 限制最多 4 张
    const total = videoImageFiles.length + validFiles.length
    if (total > 4) {
      toast.error(`最多上传 4 张图片，已截取前 ${4 - videoImageFiles.length} 张`)
      validFiles.splice(4 - videoImageFiles.length)
    }

    const newPreviews = validFiles.map(f => URL.createObjectURL(f))
    setVideoImageFiles(prev => [...prev, ...validFiles])
    setVideoImagePreviews(prev => [...prev, ...newPreviews])

    // 重置 input 以允许再次选择相同文件
    e.target.value = ''
  }

  // 清除单张图片
  function removeVideoImage(index: number) {
    URL.revokeObjectURL(videoImagePreviews[index])
    setVideoImageFiles(prev => prev.filter((_, i) => i !== index))
    setVideoImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  // 清除所有图片
  function clearVideoImages() {
    videoImagePreviews.forEach(url => URL.revokeObjectURL(url))
    setVideoImageFiles([])
    setVideoImagePreviews([])
  }

  // ===== 图片模式参考图片 =====
  function handleImageRefSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const validFiles: File[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) {
        toast.error(`"${file.name}" 不是图片文件，已跳过`)
        continue
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`"${file.name}" 超过 20MB，已跳过`)
        continue
      }
      validFiles.push(file)
    }

    if (validFiles.length === 0) return

    const total = imageRefFiles.length + validFiles.length
    if (total > 4) {
      toast.error(`最多上传 4 张图片，已截取前 ${4 - imageRefFiles.length} 张`)
      validFiles.splice(4 - imageRefFiles.length)
    }

    const newPreviews = validFiles.map(f => URL.createObjectURL(f))
    setImageRefFiles(prev => [...prev, ...validFiles])
    setImageRefPreviews(prev => [...prev, ...newPreviews])
    e.target.value = ''
  }

  function removeImageRef(index: number) {
    URL.revokeObjectURL(imageRefPreviews[index])
    setImageRefFiles(prev => prev.filter((_, i) => i !== index))
    setImageRefPreviews(prev => prev.filter((_, i) => i !== index))
  }

  function clearImageRefs() {
    imageRefPreviews.forEach(url => URL.revokeObjectURL(url))
    setImageRefFiles([])
    setImageRefPreviews([])
  }

  async function uploadImageRefs(): Promise<string[]> {
    if (imageRefFiles.length === 0) return []
    setUploading(true)
    const urls: string[] = []
    try {
      for (const file of imageRefFiles) {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (res.ok && data.url) {
          urls.push(data.url)
        } else {
          throw new Error(data.error || `"${file.name}" 上传失败`)
        }
      }
      return urls
    } catch (err) {
      const msg = err instanceof Error ? err.message : '上传失败'
      toast.error('图片上传失败', { description: msg })
      return []
    } finally {
      setUploading(false)
    }
  }

  // 上传多张图片到 Supabase Storage 并获取 URL 列表
  async function uploadVideoImages(): Promise<string[]> {
    if (videoImageFiles.length === 0) return []

    setUploading(true)
    const urls: string[] = []
    try {
      for (const file of videoImageFiles) {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        const data = await res.json()
        if (res.ok && data.url) {
          urls.push(data.url)
        } else {
          throw new Error(data.error || `"${file.name}" 上传失败`)
        }
      }
      return urls
    } catch (err) {
      const msg = err instanceof Error ? err.message : '上传失败'
      toast.error('图片上传失败', { description: msg })
      return []
    } finally {
      setUploading(false)
    }
  }

  // 轮询视频状态
  const pollVideoStatus = useCallback((requestId: string, originalPrompt: string, currentStyle: Style) => {
    const startTime = Date.now()
    let errorCount = 0
    setPollingStatus('已提交，等待处理...')

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/generate-video/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId }),
        })
        const data = await res.json()
        // 有视频 URL 就视为成功，不依赖特定状态值
        if (data.video_url) {
          clearInterval(pollRef.current)
          const videoUrl = data.video_url
          setResultUrl(videoUrl)
          setResultMode('video')
          setGenerating(false)
          setPollingStatus('')
          saveToHistory({
            id: requestId,
            mode: 'video',
            prompt: originalPrompt,
            style: currentStyle,
            url: videoUrl,
            timestamp: Date.now(),
          })
          toast.success('视频生成成功，正在下载到本地...')

          // 自动下载到用户设备
          try {
            const downloadRes = await fetch('/api/generate-video/download', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: videoUrl }),
            })
            if (downloadRes.ok) {
              const blob = await downloadRes.blob()
              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
              if (isMobile) {
                const blobUrl = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = blobUrl
                a.target = '_blank'
                a.rel = 'noopener'
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
                toast.success('已打开文件，请长按保存到相册')
              } else {
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                const disposition = downloadRes.headers.get('Content-Disposition')
                const filenameMatch = disposition?.match(/filename="?(.+?)"?$/)
                a.download = filenameMatch?.[1] || `ai-视频-${Date.now()}.mp4`
                a.click()
                URL.revokeObjectURL(a.href)
                toast.success('视频已保存到本地')
            } else {
              toast.error('自动下载失败，请手动点击下载按钮', {
                description: '链接 10 分钟后过期',
              })
            }
          } catch {
            toast.error('自动下载失败，请手动点击下载按钮', {
              description: '链接 10 分钟后过期',
            })
          }
        } else if (data.status === 'failed' || data.status === 'error') {
          clearInterval(pollRef.current)
          setGenerating(false)
          setPollingStatus('')
          toast.error('视频生成失败', { description: data.error || data.message || '请重试' })
        } else {
          // 还在处理中
          const elapsed = Math.round((Date.now() - startTime) / 1000)
          if (elapsed > MAX_POLL_TIME / 1000) {
            clearInterval(pollRef.current)
            setGenerating(false)
            setPollingStatus('')
            toast.error('生成超时', { description: '视频生成时间过长，请稍后重试' })
          } else {
            setPollingStatus(`处理中... (${Math.floor(elapsed / 60)}分${elapsed % 60}秒)`)
          }
        }
        errorCount = 0 // 请求成功，重置错误计数
      } catch (err) {
        errorCount++
        if (errorCount >= 5) {
          clearInterval(pollRef.current)
          setGenerating(false)
          setPollingStatus('')
          toast.error('网络异常', { description: '连续多次查询失败，请检查网络后重试' })
        }
      }
    }, POLL_INTERVAL)
  }, [saveToHistory])

  // 生成图片/视频
  async function handleGenerate() {
    if (generating) return
    if (!prompt.trim()) {
      toast.error('请输入提示词')
      promptRef.current?.focus()
      return
    }

    setGenerating(true)
    setGeneratingMode(mode)
    setResultUrl('')
    if (pollRef.current) clearInterval(pollRef.current)

    try {
      if (mode === 'image') {
        const fullPrompt = prompt.trim() + STYLE_MODIFIERS[style]

        // 如果有参考图片，先上传
        let refImageUrls: string[] = []
        if (imageRefFiles.length > 0) {
          setPollingStatus('正在上传参考图片...')
          refImageUrls = await uploadImageRefs()
          if (imageRefFiles.length > 0 && refImageUrls.length === 0) {
            setGenerating(false)
            return
          }
        }

        const imageBody: Record<string, unknown> = { prompt: fullPrompt, size: RATIO_SIZE[ratio] }
        if (refImageUrls.length > 0) {
          imageBody.image_urls = refImageUrls
        }

        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(imageBody),
        })
        const data = await res.json()
        if (res.ok && data.url) {
          setResultUrl(data.url)
          setResultMode('image')
          setGenerating(false)
          saveToHistory({
            id: Date.now().toString(),
            mode: 'image',
            prompt: prompt.trim(),
            style,
            url: data.url,
            timestamp: Date.now(),
          })
          toast.success('图片生成成功')
        } else if (res.status === 429) {
          // 每日上限 — 弹窗提示
          setShowLimitDialog(true)
          setGenerating(false)
        } else {
          const detail = data.detail ? ` (${data.detail})` : ''
          toast.error('生成失败', { description: `${data.error}${detail}` })
          setGenerating(false)
        }
      } else {
        // 视频生成（异步提交 + 轮询）
        let imageUrls: string[] = []

        // 如果有参考图片，先上传到服务器
        if (videoImageFiles.length > 0) {
          setPollingStatus('正在上传图片...')
          imageUrls = await uploadVideoImages()
          if (videoImageFiles.length > 0 && imageUrls.length === 0) {
            // 上传失败，停止生成
            setGenerating(false)
            return
          }
        }

        const requestBody: Record<string, unknown> = {
          prompt: prompt.trim(),
          size: RATIO_SIZE[ratio],
          duration: parseInt(videoDuration),
        }
        if (imageUrls.length > 0) {
          requestBody.image_urls = imageUrls
        }

        const res = await fetch('/api/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })
        const data = await res.json()
        if (res.ok && data.request_id) {
          // Agnes 使用 video_id 进行状态轮询
          const pollingId = data.video_id || data.request_id
          pollVideoStatus(pollingId, prompt.trim(), style)
        } else {
          toast.error('提交失败', { description: data.error || '请检查 API 配置' })
          setGenerating(false)
        }
      }
    } catch {
      toast.error('网络错误', { description: '生成请求失败，请检查网络连接' })
      setGenerating(false)
    }
  }

  // 从历史记录恢复
  function restoreFromHistory(item: HistoryItem) {
    setPrompt(item.prompt)
    setStyle(item.style)
    setResultUrl(item.url)
    setResultMode(item.mode)
    setMode(item.mode)
    setShowHistory(false)
    toast.success('已恢复')
  }

  // 自动调整 textarea 高度
  useEffect(() => {
    if (promptRef.current) {
      promptRef.current.style.height = 'auto'
      promptRef.current.style.height = promptRef.current.scrollHeight + 'px'
    }
  }, [prompt])

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* 背景光效 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-purple-500/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-cyan-500/[0.02] rounded-full blur-[120px]" />
      </div>

      {/* 顶栏 */}
      <header className="relative border-b border-[var(--border)] bg-[var(--bg-secondary)]/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">返回首页</span>
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="font-semibold text-[var(--text-primary)] text-sm">AI 创意工坊</span>
          </div>
          <div className="w-20" />
        </div>
      </header>

      {/* 主内容 */}
      <main className="relative flex-1 max-w-3xl mx-auto w-full px-4 py-6 sm:py-8 space-y-6">
        {/* 模式切换 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
            <button
              onClick={() => { if (mode !== 'image') { setMode('image'); setResultUrl('') } }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                mode === 'image'
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              图片生成
            </button>
            <button
              onClick={() => { if (mode !== 'video') { setMode('video'); setResultUrl('') } }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                mode === 'video'
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <Video className="w-4 h-4" />
              视频生成
            </button>
          </div>
        </div>

        {/* 提示词输入区 */}
        <div className="relative">
          <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-purple-500/20 via-transparent to-cyan-500/20 opacity-60 transition-opacity pointer-events-none" />
          <div className="relative bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] overflow-hidden">
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={mode === 'image'
                ? '描述你想要的画面，例如：夕阳下的古城废墟，金色余晖洒在断壁残垣上，远处有飞鸟掠过...'
                : '描述你想要的视频画面，例如：一只白色的狐狸在雪地中奔跑，雪花飘落，慢动作...'
              }
              className="w-full bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none px-5 py-4 text-sm leading-relaxed min-h-[100px] focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleGenerate()
                }
              }}
            />
            <div className="px-5 pb-3 flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-muted)]">
                {mode === 'image' ? '支持中英文，描述越详细效果越好' : '视频生成约需 1-5 分钟，提交后可离开'}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {prompt.length} 字
              </span>
            </div>
          </div>
        </div>

        {/* 视频专属设置 - 仅视频模式 */}
        {mode === 'video' && (
          <>
            {/* 时长选择 */}
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-2.5 block font-medium">视频时长</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(DURATION_LABELS) as Duration[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setVideoDuration(d)}
                    className={`px-3.5 py-1.5 rounded-lg border text-sm transition-all duration-200 ${
                      videoDuration === d
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                        : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/30 hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {DURATION_LABELS[d]}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                时长越长生成时间越久，最长 18 秒
              </p>
            </div>

            {/* 参考图片上传 */}
            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--text-secondary)]">
                  参考图片（可选，用于图生视频）
                  {videoImageFiles.length > 0 && (
                    <span className="text-[11px] text-[var(--text-muted)] ml-1.5">
                      已选 {videoImageFiles.length}/4 张
                    </span>
                  )}
                </span>
                {videoImageFiles.length > 0 && (
                  <button
                    onClick={clearVideoImages}
                    className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    清除全部
                  </button>
                )}
              </div>

              {/* 已选图片预览网格 */}
              {videoImagePreviews.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {videoImagePreviews.map((preview, index) => (
                    <div key={index} className="relative w-20 h-20">
                      <img
                        src={preview}
                        alt={`参考图片 ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg border border-[var(--border)]"
                      />
                      {uploading && (
                        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                          <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                        </div>
                      )}
                      <button
                        onClick={() => removeVideoImage(index)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-[10px] leading-none transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 上传按钮 */}
              {videoImageFiles.length < 4 && (
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-[var(--border)] rounded-lg cursor-pointer hover:border-purple-500/50 transition-colors">
                  <ImageIcon className="w-6 h-6 text-[var(--text-muted)] mb-1" />
                  <span className="text-xs text-[var(--text-muted)]">点击上传图片（最多 4 张）</span>
                  <span className="text-[11px] text-zinc-600 mt-0.5">支持 JPG、PNG，单张最大 20MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleVideoImageSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </>
        )}

        {/* 风格选择 - 仅图片模式 */}
        {mode === 'image' && (
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-2.5 block font-medium">选择风格</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STYLE_MODIFIERS) as Style[]).map((s) => {
                const active = style === s
                return (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className={`px-3.5 py-1.5 rounded-lg border text-sm transition-all duration-200 ${
                      active
                        ? STYLE_INFO[s].active
                        : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/30 hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 参考图片上传 - 仅图片模式 */}
        {mode === 'image' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--text-secondary)] font-medium">
                参考图片（可选，用于图生图）
                {imageRefFiles.length > 0 && (
                  <span className="text-[11px] text-[var(--text-muted)] ml-1.5">
                    已选 {imageRefFiles.length}/4 张
                  </span>
                )}
              </span>
              {imageRefFiles.length > 0 && (
                <button
                  onClick={clearImageRefs}
                  className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                >
                  清除全部
                </button>
              )}
            </div>

            {imageRefPreviews.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {imageRefPreviews.map((preview, index) => (
                  <div key={index} className="relative w-20 h-20">
                    <img
                      src={preview}
                      alt={`参考图片 ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg border border-[var(--border)]"
                    />
                    {uploading && (
                      <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                        <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                      </div>
                    )}
                    <button
                      onClick={() => removeImageRef(index)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-[10px] leading-none transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {imageRefFiles.length < 4 && (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-[var(--border)] rounded-lg cursor-pointer hover:border-purple-500/50 transition-colors">
                <ImageIcon className="w-6 h-6 text-[var(--text-muted)] mb-1" />
                <span className="text-xs text-[var(--text-muted)]">点击上传参考图片（最多 4 张）</span>
                <span className="text-[11px] text-zinc-600 mt-0.5">支持 JPG、PNG，单张最大 5MB</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageRefSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>
        )}

        {/* 比例选择 */}
        {mode === 'image' && (
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-2.5 block font-medium">画面比例</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(RATIO_SIZE) as Ratio[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRatio(r)}
                  className={`px-3.5 py-1.5 rounded-lg border text-sm transition-all duration-200 ${
                    ratio === r
                      ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/30 hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="font-medium">{r}</span>
                  <span className="text-[10px] ml-1 opacity-60">{RATIO_LABELS[r]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 生成按钮 */}
        <button
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-500 text-white font-medium text-sm transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {generatingMode === 'image' ? '生成中，约需 10-30 秒...' : pollingStatus || '提交中...'}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {mode === 'image' ? '生成图片' : '生成视频'}
            </>
          )}
        </button>

        {/* 提示：快捷键 */}
        {!generating && (
          <p className="text-center text-[11px] text-[var(--text-muted)] -mt-4">
            Ctrl + Enter 快速生成
          </p>
        )}

        {/* 生成结果（只在当前模式匹配时显示） */}
        {((resultUrl && mode === resultMode) || (generating && mode === generatingMode)) && (
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                生成结果
              </h3>
              <div className="flex items-center gap-2">
                {resultUrl && (
                  <>
                    <button
                      onClick={handleGenerate}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      重新生成
                    </button>
                    <button
                      onClick={() => handleDownload(resultUrl)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      下载
                    </button>
                  </>
                )}
              </div>
            </div>

            {generating ? (
              <div className="aspect-video rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex flex-col items-center justify-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 bg-purple-500/30 rounded-full animate-pulse" />
                  </div>
                </div>
                <p className="text-sm text-[var(--text-muted)]">
                  {generatingMode === 'image' ? 'AI 正在创作中...' : pollingStatus || 'AI 正在生成视频...'}
                </p>
              </div>
            ) : resultMode === 'image' ? (
              <div className="relative group rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--bg-secondary)]">
                <img
                  src={resultUrl}
                  alt={prompt}
                  className="w-full h-auto object-contain max-h-[500px]"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-end justify-end p-3 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => handleDownload(resultUrl)}
                    className="p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors"
                    title="下载"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative group rounded-2xl overflow-hidden border border-[var(--border)] bg-black">
                <video
                  src={resultUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full h-auto max-h-[500px]"
                >
                  您的浏览器不支持视频播放
                </video>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-end justify-end p-3 opacity-0 group-hover:opacity-100 pointer-events-none">
                  <button
                    onClick={() => handleDownload(resultUrl)}
                    className="p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors pointer-events-auto"
                    title="下载"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            {resultUrl && resultMode === 'video' && (
              <p className="mt-2 text-xs text-emerald-400/80 flex items-center gap-1">
                <Download className="w-3 h-3" />
                视频已自动下载到本地，也可点击上方按钮重新下载
              </p>
            )}
          </div>
        )}

        {/* 空状态 - 未生成时 */}
        {!resultUrl && !generating && (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-purple-400/60" />
            </div>
            <p className="text-sm text-[var(--text-muted)] max-w-xs">
              输入提示词，点击生成
              <br />
              让 AI 将你的想象变为现实
            </p>
          </div>
        )}

        {/* 历史记录 */}
        {history.length > 0 && (
          <div className="pt-4 border-t border-[var(--border)]">
            <div
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center justify-between w-full mb-3 cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                <Clock className="w-4 h-4" />
                历史记录
                <span className="text-[11px] text-[var(--text-muted)]">
                  ({history.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {showHistory && (
                  <button
                    onClick={(e) => { e.stopPropagation(); clearHistory() }}
                    className="flex items-center gap-1 text-xs text-red-400/60 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    清空
                  </button>
                )}
              </div>
            </div>

            {showHistory && (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => restoreFromHistory(item)}
                    className="relative aspect-square rounded-xl overflow-hidden border border-[var(--border)] hover:border-purple-500/50 transition-all duration-200 group/hover"
                  >
                    {/* 单条删除按钮 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id) }}
                      className="absolute top-1 right-1 z-10 w-5 h-5 rounded-full bg-black/60 hover:bg-red-500/80 flex items-center justify-center opacity-0 group-hover/hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-2.5 h-2.5 text-white" />
                    </button>
                    {item.mode === 'video' ? (
                      <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                        <Video className="w-6 h-6 text-zinc-500" />
                      </div>
                    ) : (
                      <img
                        src={item.url}
                        alt={item.prompt}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover/hover:bg-black/40 transition-colors flex items-center justify-center">
                      <span className="text-white text-[10px] opacity-0 group-hover/hover:opacity-100 transition-opacity">
                        点击恢复
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 每日限额弹窗 */}
      {showLimitDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                <AlertTriangle className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                今日次数已用完
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
                今日图片生成次数已达到上限，明天再来吧
              </p>
              <button
                onClick={() => setShowLimitDialog(false)}
                className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white font-medium text-sm hover:opacity-90 transition-opacity"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
