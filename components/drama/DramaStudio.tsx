'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Film, Plus, Trash2, Loader2, Play, Download, Wand2, ArrowLeft, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

interface Scene {
  id: string
  scene_number: number
  description: string
  dialogue: string
  character_name: string
  emotion: string
  image_url: string
  video_url: string
  audio_url: string
  subtitle: string
  duration: number
  status: string
}

interface Project {
  id: string
  title: string
  synopsis: string
  genre: string
  style: string
  status: string
}

interface DramaStudioProps {
  userId: string
}

export function DramaStudio({ userId }: DramaStudioProps) {
  const router = useRouter()
  const [step, setStep] = useState<'input' | 'script' | 'scenes' | 'generating' | 'compose'>('input')
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [generating, setGenerating] = useState(false)
  const [composeProgress, setComposeProgress] = useState(0)

  // 输入表单
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('修仙')
  const [style, setStyle] = useState('写实')
  const [synopsis, setSynopsis] = useState('')

  // 加载项目列表
  useEffect(() => {
    fetchProjects()
  }, [])

  // 自动轮询：只要在分镜页面就持续检查
  useEffect(() => {
    if (!currentProject) return
    if (step !== 'scenes') return

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/drama/check-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: currentProject.id }),
        })
        const data = await res.json()
        if (data.updated > 0) {
          window.location.reload()
        }
      } catch (err) {
        console.error('[drama-poll] Error:', err)
      }
    }, 20000) // 每 20 秒检查一次

    return () => clearInterval(interval)
  }, [currentProject, step])

  async function fetchProjects() {
    try {
      const res = await fetch('/api/drama/project')
      const data = await res.json()
      if (data.projects) setProjects(data.projects)
    } catch {}
  }

  // Step 1: 生成剧本
  async function handleGenerateScript() {
    if (!title.trim()) return toast.error('请输入短剧主题')

    setGenerating(true)
    try {
      // 创建项目
      const projRes = await fetch('/api/drama/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, genre, style, synopsis }),
      })
      const { project } = await projRes.json()

      // 生成剧本
      const scriptRes = await fetch('/api/drama/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, title, genre, style, synopsis }),
      })
      const { script } = await scriptRes.json()

      if (!script) throw new Error('剧本生成失败')

      // 保存分镜
      const scenesRes = await fetch('/api/drama/generate-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, script }),
      })
      const { scenes: savedScenes } = await scenesRes.json()

      setCurrentProject(project)
      setScenes(savedScenes)
      setStep('scenes')
      toast.success(`剧本生成完成，共 ${savedScenes.length} 个分镜`)
    } catch (err: any) {
      toast.error(err.message || '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  // Step 2: 批量生成图片
  async function handleGenerateImages() {
    if (!currentProject) return
    setGenerating(true)
    setStep('generating')

    try {
      const res = await fetch('/api/drama/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: currentProject.id }),
      })
      const { results } = await res.json()
      toast.success(`图片生成完成`)

      // 刷新分镜列表
      await refreshScenes()
      setStep('scenes')
    } catch (err: any) {
      toast.error(err.message || '图片生成失败')
      setStep('scenes')
    } finally {
      setGenerating(false)
    }
  }

  // Step 3: 批量生成视频
  async function handleGenerateVideos() {
    if (!currentProject) return
    setGenerating(true)
    setStep('generating')

    try {
      const res = await fetch('/api/drama/generate-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: currentProject.id }),
      })
      const { results } = await res.json()
      toast.success(`视频生成请求已提交`)

      await refreshScenes()
      setStep('scenes')
    } catch (err: any) {
      toast.error(err.message || '视频生成失败')
      setStep('scenes')
    } finally {
      setGenerating(false)
    }
  }

  // Step 4: 批量生成配音
  async function handleGenerateAudio() {
    if (!currentProject) return
    setGenerating(true)

    try {
      const res = await fetch('/api/drama/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: currentProject.id }),
      })
      const { results } = await res.json()
      toast.success(`配音生成完成`)

      await refreshScenes()
    } catch (err: any) {
      toast.error(err.message || '配音生成失败')
    } finally {
      setGenerating(false)
    }
  }

  async function refreshScenes() {
    if (!currentProject) return
    try {
      const res = await fetch(`/api/drama/project?projectId=${currentProject.id}`)
      const data = await res.json()
      if (data.scenes) setScenes(data.scenes)
    } catch {}
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* 顶栏 */}
      <header className="border-b border-white/10 px-6 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/')} className="text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Film className="w-5 h-5 text-purple-400" />
        <h1 className="text-white font-medium">AI 短剧创作工作室</h1>
        {currentProject && (
          <span className="text-zinc-500 text-sm ml-2">— {currentProject.title}</span>
        )}
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {step === 'input' && (
          <InputStep
            title={title} setTitle={setTitle}
            genre={genre} setGenre={setGenre}
            style={style} setStyle={setStyle}
            synopsis={synopsis} setSynopsis={setSynopsis}
            onGenerate={handleGenerateScript}
            generating={generating}
            projects={projects}
            onSelectProject={async (p: Project) => {
              setCurrentProject(p)
              // 加载该项目的分镜
              try {
                const res = await fetch(`/api/drama/project?projectId=${p.id}`)
                const data = await res.json()
                setScenes(data.scenes || [])
              } catch {
                setScenes([])
              }
              setStep('scenes')
            }}
          />
        )}

        {step === 'scenes' && (
          <ScenesStep
            scenes={scenes}
            onGenerateImages={handleGenerateImages}
            onGenerateVideos={handleGenerateVideos}
            onGenerateAudio={handleGenerateAudio}
            generating={generating}
            onBack={() => setStep('input')}
            projectId={currentProject?.id}
          />
        )}

        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-purple-400 animate-spin mb-4" />
            <p className="text-white text-lg">正在生成中...</p>
            <p className="text-zinc-500 text-sm mt-2">请耐心等待，这可能需要几分钟</p>
          </div>
        )}
      </div>
    </div>
  )
}

// 输入步骤
function InputStep({ title, setTitle, genre, setGenre, style, setStyle, synopsis, setSynopsis, onGenerate, generating, projects, onSelectProject }: any) {
  const genres = ['修仙', '都市', '悬疑', '喜剧', '爱情', '恐怖', '科幻']
  const styles = ['写实', '动漫', '水墨', '赛博朋克', '古风']

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <Sparkles className="w-10 h-10 text-purple-400 mx-auto mb-3" />
        <h2 className="text-2xl font-bold text-white mb-2">创建新短剧</h2>
        <p className="text-zinc-400">输入主题，AI 自动完成剧本→分镜→生图→视频→配音</p>
      </div>

      <div className="bg-white/5 rounded-2xl p-6 border border-white/10 space-y-5">
        <div>
          <label className="text-sm text-zinc-400 mb-2 block">短剧主题 *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="例如：古代江湖剑客复仇、末日废土生存..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm text-zinc-400 mb-2 block">类型</label>
            <div className="flex flex-wrap gap-2">
              {genres.map(g => (
                <button
                  key={g}
                  onClick={() => setGenre(g)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    genre === g
                      ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 border'
                      : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm text-zinc-400 mb-2 block">风格</label>
          <div className="flex flex-wrap gap-2">
            {styles.map(s => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  style === s
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 border'
                    : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-zinc-400 mb-2 block">剧情简介（可选）</label>
          <textarea
            value={synopsis}
            onChange={e => setSynopsis(e.target.value)}
            placeholder="简要描述你想要的剧情..."
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 resize-none"
          />
        </div>

        <button
          onClick={onGenerate}
          disabled={generating || !title.trim()}
          className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {generating ? '生成中...' : '✨ 生成剧本'}
        </button>
      </div>

      {/* 历史项目 */}
      {projects.length > 0 && (
        <div className="mt-10">
          <h3 className="text-zinc-400 text-sm mb-3">历史项目</h3>
          <div className="space-y-2">
            {projects.map((p: Project) => (
              <div
                key={p.id}
                className="flex items-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/30 transition-colors group"
              >
                <button
                  onClick={() => onSelectProject(p)}
                  className="flex-1 text-left"
                >
                  <div className="text-white font-medium">{p.title}</div>
                  <div className="text-zinc-500 text-xs mt-1">{p.genre} · {p.style} · {p.status}</div>
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (!confirm('确定删除这个项目？')) return
                    try {
                      await fetch('/api/drama/project', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ projectId: p.id }),
                      })
                      toast.success('已删除')
                      window.location.reload()
                    } catch {
                      toast.error('删除失败')
                    }
                  }}
                  className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// 分镜步骤
function ScenesStep({ scenes, onGenerateImages, onGenerateVideos, onGenerateAudio, generating, onBack, projectId }: any) {
  const statusEmoji: Record<string, string> = {
    pending: '⏳',
    generating_image: '🎨',
    generating_video: '🎬',
    generating_audio: '🎵',
    done: '✅',
    error: '❌',
  }

  const doneCount = scenes.filter((s: Scene) => s.status === 'done').length
  const totalImages = scenes.filter((s: Scene) => s.image_url).length
  const totalVideos = scenes.filter((s: Scene) => s.video_url).length
  const totalAudio = scenes.filter((s: Scene) => s.audio_url).length

  async function handleGenerateSingleVideo(sceneId: string) {
    try {
      const res = await fetch('/api/drama/generate-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, sceneIds: [sceneId] }),
      })
      const data = await res.json()
      if (data.results?.[0]?.status === 'submitted') {
        toast.success('视频生成已提交，等待完成...')
        window.location.reload()
      } else {
        toast.error(data.results?.[0]?.error || '提交失败')
      }
    } catch {
      toast.error('请求失败')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="text-zinc-400 hover:text-white flex items-center gap-1 text-sm">
          <ArrowLeft className="w-4 h-4" /> 返回
        </button>
        <h2 className="text-lg font-medium text-white">分镜列表 ({scenes.length} 场)</h2>
        <div className="flex gap-2">
          <span className="text-xs text-zinc-500">🖼️ {totalImages}/{scenes.length}</span>
          <span className="text-xs text-zinc-500">🎬 {totalVideos}/{scenes.length}</span>
          <span className="text-xs text-zinc-500">🎵 {totalAudio}/{scenes.length}</span>
        </div>
      </div>

      {/* 批量操作 */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={onGenerateImages}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 disabled:opacity-50 text-sm"
        >
          <Wand2 className="w-4 h-4" />
          {generating ? '生成中...' : '批量生图'}
        </button>
        <button
          onClick={onGenerateVideos}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 disabled:opacity-50 text-sm"
        >
          <Play className="w-4 h-4" />
          {generating ? '生成中...' : '批量生视频'}
        </button>
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-600/10 border border-zinc-500/20 text-zinc-500 cursor-not-allowed text-sm"
          title="配音功能需要 TTS 服务，暂不可用"
        >
          🎙️
          配音（即将上线）
        </button>
      </div>

      {/* 分镜卡片 */}
      <div className="space-y-4">
        {scenes.map((scene: Scene) => (
          <div key={scene.id} className="bg-white/5 rounded-xl border border-white/10 p-4">
            <div className="flex items-start gap-4">
              {/* 缩略图 - 点击可播放/下载 */}
              <button
                onClick={() => {
                  if (scene.video_url) {
                    window.open(scene.video_url, '_blank')
                  } else if (scene.image_url) {
                    window.open(scene.image_url, '_blank')
                  }
                }}
                className="w-32 h-20 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0 relative group cursor-pointer hover:ring-2 hover:ring-purple-500/50 transition-all"
              >
                {scene.video_url ? (
                  <>
                    <video src={scene.video_url} className="w-full h-full object-cover" muted />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-6 h-6 text-white" />
                    </div>
                  </>
                ) : scene.image_url ? (
                  <img src={scene.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                    {statusEmoji[scene.status] || '⏳'}
                  </div>
                )}
              </button>

              {/* 信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-purple-400 font-medium text-sm">#{scene.scene_number}</span>
                  <span className="text-zinc-500 text-xs">{scene.duration}秒</span>
                  <span className="text-xs">{statusEmoji[scene.status]}</span>
                  {scene.video_url && (
                    <a
                      href={scene.video_url}
                      download={`scene-${scene.scene_number}.mp4`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-zinc-500 hover:text-blue-400 transition-colors flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> 下载
                    </a>
                  )}
                  {scene.image_url && !scene.video_url && (
                    <a
                      href={scene.image_url}
                      download={`scene-${scene.scene_number}.png`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-zinc-500 hover:text-blue-400 transition-colors flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> 下载图片
                    </a>
                  )}
                </div>
                <p className="text-zinc-300 text-sm mb-1 line-clamp-2">{scene.description}</p>
                {scene.dialogue && (
                  <p className="text-zinc-500 text-xs italic">"{scene.dialogue}"</p>
                )}
                <div className="flex gap-3 mt-2 text-xs text-zinc-600">
                  <span>{scene.character_name}</span>
                  <span>{scene.emotion}</span>
                  {!scene.video_url && scene.image_url && scene.status !== 'generating_video' && (
                    <button
                      onClick={() => handleGenerateSingleVideo(scene.id)}
                      className="text-purple-400 hover:text-purple-300 transition-colors ml-auto"
                    >
                      ▶ 生成视频
                    </button>
                  )}
                  {scene.status === 'generating_video' && (
                    <span className="text-yellow-400 ml-auto flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> 生成中...
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
