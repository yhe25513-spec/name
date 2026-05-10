'use client'

import { useRouter } from 'next/navigation'
import { Gamepad2, ImageIcon, Video, Sparkles, ArrowRight } from 'lucide-react'

const features = [
  {
    id: 'game',
    title: '文字冒险',
    description: '沉浸式 AI 文字冒险游戏，在幻想世界中书写你的传奇故事',
    icon: Gamepad2,
    href: '/game',
    gradient: 'from-amber-500/15 to-orange-600/8',
    borderGlow: 'hover:border-amber-500/50',
    shadowGlow: 'hover:shadow-amber-500/8',
    iconBg: 'bg-amber-500/15 border-amber-500/30',
    iconColor: 'text-amber-400',
    badge: '经典',
  },
  {
    id: 'image',
    title: 'AI 图片生成',
    description: '用文字描述你的想象，AI 即刻为你生成精美的图片作品',
    icon: ImageIcon,
    href: '/create?mode=image',
    gradient: 'from-purple-500/15 to-cyan-600/8',
    borderGlow: 'hover:border-purple-500/50',
    shadowGlow: 'hover:shadow-purple-500/8',
    iconBg: 'bg-purple-500/15 border-purple-500/30',
    iconColor: 'text-purple-400',
    badge: '新功能',
  },
  {
    id: 'video',
    title: 'AI 视频生成',
    description: '让创意动起来，用 AI 将你的想象转化为动态画面',
    icon: Video,
    href: '/create?mode=video',
    gradient: 'from-rose-500/15 to-pink-600/8',
    borderGlow: 'hover:border-rose-500/50',
    shadowGlow: 'hover:shadow-rose-500/8',
    iconBg: 'bg-rose-500/15 border-rose-500/30',
    iconColor: 'text-rose-400',
    badge: '新功能',
  },
]

export default function HomePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* 背景氛围光 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-amber-500/[0.02] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-purple-500/[0.02] rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-transparent via-zinc-500/[0.02] to-transparent blur-[100px]" />
      </div>

      {/* 顶栏 */}
      <header className="relative border-b border-[var(--border)] bg-[var(--bg-secondary)]/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
            <span className="font-semibold text-[var(--text-primary)]">AI 创意工坊</span>
          </div>
          <button
            onClick={() => router.push('/game')}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1.5 group"
          >
            <span>进入游戏</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </header>

      {/* 主内容 */}
      <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-16 sm:py-24">
        <div className="max-w-5xl w-full">
          {/* 标题区 */}
          <div className="text-center mb-16 sm:mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs mb-6">
              <Sparkles className="w-3 h-3" />
              AI 驱动创意平台
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold text-[var(--text-primary)] mb-4 tracking-tight">
              AI 创意工坊
            </h1>
            <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-md mx-auto">
              选择你想要的创作方式，让 AI 激发无限可能
            </p>
          </div>

          {/* 功能卡片 */}
          <div className="grid gap-5 sm:gap-6 sm:grid-cols-3">
            {features.map((feature) => (
              <button
                key={feature.id}
                onClick={() => router.push(feature.href)}
                className={`group relative p-6 sm:p-8 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]
                  transition-all duration-300 hover:-translate-y-1.5 ${feature.borderGlow} ${feature.shadowGlow}
                  hover:shadow-xl text-left`}
              >
                {/* 悬停渐变 */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                {/* 内容 */}
                <div className="relative z-10">
                  {/* 图标 */}
                  <div className={`w-14 h-14 rounded-xl ${feature.iconBg} border flex items-center justify-center mb-5 ${feature.iconColor} group-hover:scale-105 group-hover:shadow-lg transition-all duration-300`}>
                    <feature.icon className="w-7 h-7" />
                  </div>

                  {/* 标题 + 标签 */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <h3 className="text-xl font-semibold text-[var(--text-primary)]">{feature.title}</h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--accent-soft)] text-[var(--accent)]">
                      {feature.badge}
                    </span>
                  </div>

                  {/* 描述 */}
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-6">{feature.description}</p>

                  {/* 进入按钮 */}
                  <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                    进入
                    <ArrowRight className="w-4 h-4 transition-all group-hover:translate-x-1" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
