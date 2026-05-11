'use client'

import { useRouter } from 'next/navigation'
import { BookOpen, Image, Sparkles, ArrowRight } from 'lucide-react'

const features = [
  {
    id: 'game',
    title: '文字冒险',
    subtitle: '墨写山河',
    description: '在幻想世界中书写你的传奇故事',
    icon: BookOpen,
    href: '/game',
    badge: '经典',
  },
  {
    id: 'image',
    title: 'AI 图片生成',
    subtitle: '意绘丹青',
    description: '用文字描绘想象，AI 即刻化作画卷',
    icon: Image,
    href: '/create?mode=image',
    badge: '新功能',
  },
  {
    id: 'video',
    title: 'AI 视频生成',
    subtitle: '光影流转',
    description: '让创意在时光中绽放，文字化作动态诗篇',
    icon: Sparkles,
    href: '/create?mode=video',
    badge: '新功能',
  },
]

export default function HomePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex flex-col" style={{
      backgroundColor: '#010102',
      color: '#f7f8f8',
      '--bg-primary': '#010102',
      '--bg-secondary': '#0f1011',
      '--bg-card': '#141516',
      '--text-primary': '#f7f8f8',
      '--text-secondary': '#d0d6e0',
      '--text-muted': '#8a8f98',
      '--accent': '#5e6ad2',
      '--accent-soft': 'rgba(94,106,210,0.12)',
      '--border': '#23252a',
    } as React.CSSProperties}>
      {/* 纯色背景 — Linear 风格 */}
      <div className="fixed inset-0 pointer-events-none bg-[#010102]" />

      {/* 顶栏 */}
      <header className="relative border-b border-[var(--border)] bg-[var(--bg-secondary)]/80 backdrop-blur-sm z-20">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
              <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </div>
            <span className="font-medium text-[var(--text-primary)] tracking-tight">
              墨境
            </span>
          </div>
          <button
            onClick={() => router.push('/game')}
            className="group flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all duration-200"
          >
            <span>进入游戏</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </header>

      {/* 主内容 */}
      <main className="relative flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-5xl w-full">
          {/* 标题区 */}
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs tracking-wider mb-8" style={{
              backgroundColor: 'var(--accent-soft)',
              borderColor: 'var(--accent)',
              color: 'var(--accent)',
            }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
              AI 驱动创意平台
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
            </div>
            <h1
              className="text-5xl sm:text-7xl font-bold text-[var(--text-primary)] mb-5 tracking-tight"
              style={{ fontFamily: 'var(--font-masz), cursive', lineHeight: 1.3 }}
            >
              墨境
            </h1>
            <p className="text-base sm:text-lg text-[var(--text-muted)] max-w-lg mx-auto leading-relaxed tracking-wide">
              以文字为笔，以想象为墨
              <br />
              在无尽的世界中，书写属于你的传奇
            </p>
          </div>

          {/* 功能卡片 — 横向排列 */}
          <div className="grid gap-5 sm:grid-cols-3 max-w-4xl mx-auto">
            {features.map((feature) => (
              <button
                key={feature.id}
                onClick={() => router.push(feature.href)}
                className="group relative p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-left transition-all duration-300 hover:-translate-y-1 overflow-hidden"
              >
                {/* 悬停光效 */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: `linear-gradient(135deg, var(--accent-soft), transparent 60%)`,
                  }}
                />

                {/* 顶部装饰线 */}
                <div
                  className="absolute top-0 left-4 right-4 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `linear-gradient(90deg, transparent, var(--accent), transparent)` }}
                />

                {/* 图标 */}
                <div className="relative z-10 mb-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg"
                    style={{
                      backgroundColor: 'var(--accent-soft)',
                      border: '1px solid var(--accent)',
                    }}
                  >
                    <feature.icon className="w-6 h-6" style={{ color: 'var(--accent)' }} />
                  </div>
                </div>

                {/* 标题 */}
                <div className="relative z-10 mb-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                      {feature.title}
                    </h3>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wider"
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        color: 'var(--accent)',
                      }}
                    >
                      {feature.badge}
                    </span>
                  </div>
                  <p className="text-xs tracking-widest text-[var(--text-muted)]" style={{ fontFamily: 'var(--font-masz), cursive' }}>
                    {feature.subtitle}
                  </p>
                </div>

                {/* 描述 */}
                <p className="relative z-10 text-sm text-[var(--text-secondary)] leading-relaxed mb-5">
                  {feature.description}
                </p>

                {/* 进入 */}
                <div className="relative z-10 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors">
                  进入
                  <ArrowRight className="w-3.5 h-3.5 transition-all group-hover:translate-x-1" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* 底部装饰 */}
      <footer className="relative border-t border-[var(--border)] py-4">
        <p className="text-center text-[10px] text-[var(--text-muted)] tracking-widest">墨境 · AI 文字冒险</p>
      </footer>
    </div>
  )
}
