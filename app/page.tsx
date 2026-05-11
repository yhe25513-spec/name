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
    accent: '#c43a31',
    accentSoft: 'rgba(196,58,49,0.12)',
    badge: '经典',
    iconBg: 'rgba(196,58,49,0.15)',
    iconBorder: 'rgba(196,58,49,0.3)',
  },
  {
    id: 'image',
    title: 'AI 图片生成',
    subtitle: '意绘丹青',
    description: '用文字描绘想象，AI 即刻化作画卷',
    icon: Image,
    href: '/create?mode=image',
    accent: '#d4a853',
    accentSoft: 'rgba(212,168,83,0.12)',
    badge: '新功能',
    iconBg: 'rgba(212,168,83,0.15)',
    iconBorder: 'rgba(212,168,83,0.3)',
  },
  {
    id: 'video',
    title: 'AI 视频生成',
    subtitle: '光影流转',
    description: '让创意在时光中绽放，文字化作动态诗篇',
    icon: Sparkles,
    href: '/create?mode=video',
    accent: '#8b5cf6',
    accentSoft: 'rgba(139,92,246,0.12)',
    badge: '新功能',
    iconBg: 'rgba(139,92,246,0.15)',
    iconBorder: 'rgba(139,92,246,0.3)',
  },
]

export default function HomePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#161210] flex flex-col">
      {/* 墨色纹理背景 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* 顶部淡墨 */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-gradient-to-b from-red-950/20 via-transparent to-transparent blur-[120px]" />
        {/* 底部光晕 */}
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-gradient-to-t from-amber-950/15 via-transparent to-transparent blur-[100px]" />
        {/* 中央雾气 */}
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-stone-800/10 rounded-full blur-[150px]" />
        {/* 纸张纹理叠加 */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* 顶栏 */}
      <header className="relative border-b border-stone-800/60 bg-stone-950/40 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-700 to-red-800 flex items-center justify-center shadow-lg shadow-red-900/30">
              <Sparkles className="w-4 h-4 text-stone-200" />
            </div>
            <span className="font-medium text-stone-300 tracking-wider" style={{ fontFamily: 'var(--font-noto-serif), serif' }}>
              墨境
            </span>
          </div>
          <button
            onClick={() => router.push('/game')}
            className="group flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 transition-all duration-200"
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
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-950/30 border border-red-900/30 text-red-400/80 text-xs tracking-wider mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500/60" />
              AI 驱动创意平台
              <span className="w-1.5 h-1.5 rounded-full bg-red-500/60" />
            </div>
            <h1
              className="text-5xl sm:text-7xl font-bold text-stone-100 mb-5 tracking-wide"
              style={{ fontFamily: 'var(--font-masz), cursive', lineHeight: 1.3 }}
            >
              墨境
            </h1>
            <p className="text-base sm:text-lg text-stone-500 max-w-lg mx-auto leading-relaxed tracking-wide">
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
                className="group relative p-6 rounded-xl border border-stone-800 bg-stone-900/60 text-left transition-all duration-300 hover:-translate-y-1 overflow-hidden"
              >
                {/* 悬停光效 */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: `linear-gradient(135deg, ${feature.accentSoft}, transparent 60%)`,
                  }}
                />

                {/* 顶部装饰线 */}
                <div
                  className="absolute top-0 left-4 right-4 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `linear-gradient(90deg, transparent, ${feature.accent}, transparent)` }}
                />

                {/* 图标 */}
                <div className="relative z-10 mb-4">
                  <div
                    className="w-12 h-12 rounded-lg border flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg"
                    style={{
                      backgroundColor: feature.iconBg,
                      borderColor: feature.iconBorder,
                    }}
                  >
                    <feature.icon className="w-6 h-6" style={{ color: feature.accent }} />
                  </div>
                </div>

                {/* 标题 */}
                <div className="relative z-10 mb-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-stone-200 group-hover:text-white transition-colors">
                      {feature.title}
                    </h3>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wider"
                      style={{
                        backgroundColor: feature.accentSoft,
                        color: feature.accent,
                      }}
                    >
                      {feature.badge}
                    </span>
                  </div>
                  <p className="text-xs tracking-widest text-stone-500" style={{ fontFamily: 'var(--font-masz), cursive' }}>
                    {feature.subtitle}
                  </p>
                </div>

                {/* 描述 */}
                <p className="relative z-10 text-sm text-stone-500 leading-relaxed mb-5">
                  {feature.description}
                </p>

                {/* 进入 */}
                <div className="relative z-10 flex items-center gap-1 text-xs font-medium text-stone-500 group-hover:text-stone-300 transition-colors">
                  进入
                  <ArrowRight className="w-3.5 h-3.5 transition-all group-hover:translate-x-1" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* 底部装饰 */}
      <footer className="relative border-t border-stone-800/40 py-4">
        <p className="text-center text-[10px] text-stone-700 tracking-widest">墨境 · AI 文字冒险</p>
      </footer>
    </div>
  )
}
