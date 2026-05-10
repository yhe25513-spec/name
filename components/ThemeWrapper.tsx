'use client'

import { useState, useEffect } from 'react'
import { getTheme, FONTS, buildCustomThemeCss } from '@/lib/themes'

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const [themeVars, setThemeVars] = useState<Record<string, string>>(getTheme('dark').css)
  const [fontFamily, setFontFamily] = useState(FONTS[0].cssVar)

  useEffect(() => {
    function applyTheme() {
      const themeId = localStorage.getItem('game-theme') || 'dark'
      let css: Record<string, string>

      if (themeId === 'custom') {
        const saved = localStorage.getItem('game-custom-theme')
        const colors = saved
          ? (JSON.parse(saved) as { bgShade: 'dark' | 'medium' | 'light'; accentColor: 'amber' | 'cyan' | 'emerald' | 'purple' | 'gold' | 'blue' })
          : { bgShade: 'dark' as const, accentColor: 'amber' as const }
        css = buildCustomThemeCss(colors)
      } else {
        css = getTheme(themeId).css
      }

      const fontId = localStorage.getItem('game-font') || 'sans'
      const font = FONTS.find((f) => f.id === fontId) || FONTS[0]

      setThemeVars(css)
      setFontFamily(font.cssVar)

      // 同步到 document.documentElement 确保 Portal 弹窗也能继承
      const root = document.documentElement
      Object.entries(css).forEach(([key, val]) => root.style.setProperty(key, val))
      root.style.fontFamily = font.cssVar
    }

    applyTheme()
    window.addEventListener('storage', applyTheme)
    window.addEventListener('theme-change', applyTheme)
    return () => {
      window.removeEventListener('storage', applyTheme)
      window.removeEventListener('theme-change', applyTheme)
    }
  }, [])

  return (
    <div style={{ ...themeVars, fontFamily } as React.CSSProperties}>
      {children}
    </div>
  )
}
