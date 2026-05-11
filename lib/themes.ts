export interface Theme {
  id: string
  name: string
  icon: string
  description: string
  css: Record<string, string>
}

export const THEMES: Theme[] = [
  {
    id: 'dark',
    name: '暗夜',
    icon: '🌙',
    description: '经典暗色，琥珀点缀',
    css: {
      '--bg-primary': '#09090b',
      '--bg-secondary': '#18181b',
      '--bg-card': 'rgba(24,24,27,0.6)',
      '--text-primary': '#e4e4e7',
      '--text-secondary': '#a1a1aa',
      '--text-muted': '#71717a',
      '--accent': '#f59e0b',
      '--accent-soft': 'rgba(245,158,11,0.1)',
      '--border': 'rgba(39,39,42,0.5)',
      '--bar-default': '#52525b',
    },
  },
  {
    id: 'parchment',
    name: '羊皮古卷',
    icon: '📜',
    description: '暖棕底、米白字，古籍韵味',
    css: {
      '--bg-primary': '#1c1917',
      '--bg-secondary': '#292524',
      '--bg-card': 'rgba(41,35,33,0.65)',
      '--text-primary': '#f5f0e8',
      '--text-secondary': '#d6c9b8',
      '--text-muted': '#a3927e',
      '--accent': '#d97706',
      '--accent-soft': 'rgba(217,119,6,0.12)',
      '--border': 'rgba(68,64,60,0.5)',
      '--bar-default': '#78716c',
    },
  },
  {
    id: 'cyber',
    name: '赛博霓虹',
    icon: '💠',
    description: '紫蓝底色、青蓝文字，赛博朋克',
    css: {
      '--bg-primary': '#0b0b1a',
      '--bg-secondary': '#141428',
      '--bg-card': 'rgba(20,20,40,0.65)',
      '--text-primary': '#e0e0ff',
      '--text-secondary': '#8888cc',
      '--text-muted': '#555599',
      '--accent': '#22d3ee',
      '--accent-soft': 'rgba(34,211,238,0.1)',
      '--border': 'rgba(30,30,63,0.5)',
      '--bar-default': '#3730a3',
    },
  },
  {
    id: 'forest',
    name: '深林幽光',
    icon: '🌲',
    description: '墨绿底色、翠绿文字，荧光点缀',
    css: {
      '--bg-primary': '#0e1410',
      '--bg-secondary': '#1a241c',
      '--bg-card': 'rgba(26,36,28,0.65)',
      '--text-primary': '#d1f0d1',
      '--text-secondary': '#8fbc8f',
      '--text-muted': '#5c8a5c',
      '--accent': '#34d399',
      '--accent-soft': 'rgba(52,211,153,0.1)',
      '--border': 'rgba(38,58,42,0.5)',
      '--bar-default': '#365e3a',
    },
  },
  {
    id: 'crimson',
    name: '暗血史诗',
    icon: '⚔',
    description: '暗红底色、金红文字，史诗战场',
    css: {
      '--bg-primary': '#140a0a',
      '--bg-secondary': '#241212',
      '--bg-card': 'rgba(36,18,18,0.65)',
      '--text-primary': '#f0d1d1',
      '--text-secondary': '#cc8888',
      '--text-muted': '#995555',
      '--accent': '#fbbf24',
      '--accent-soft': 'rgba(251,191,36,0.1)',
      '--border': 'rgba(58,26,26,0.5)',
      '--bar-default': '#7f1d1d',
    },
  },
  {
    id: 'snow',
    name: '雪境',
    icon: '❄',
    description: '灰白底色、深灰文字，清冷简约',
    css: {
      '--bg-primary': '#1a1b1e',
      '--bg-secondary': '#25262b',
      '--bg-card': 'rgba(37,38,43,0.65)',
      '--text-primary': '#e4e4e7',
      '--text-secondary': '#a1a1aa',
      '--text-muted': '#71717a',
      '--accent': '#60a5fa',
      '--accent-soft': 'rgba(96,165,250,0.1)',
      '--border': 'rgba(63,63,70,0.5)',
      '--bar-default': '#52525b',
    },
  },
  {
    id: 'dawn',
    name: '晨光',
    icon: '🌤',
    description: '暖白明亮底色，柔和舒适',
    css: {
      '--bg-primary': '#fafaf9',
      '--bg-secondary': '#f5f5f4',
      '--bg-card': 'rgba(245,245,244,0.85)',
      '--text-primary': '#1c1917',
      '--text-secondary': '#57534e',
      '--text-muted': '#a8a29e',
      '--accent': '#d97706',
      '--accent-soft': 'rgba(217,119,6,0.08)',
      '--border': 'rgba(214,211,209,0.6)',
      '--bar-default': '#d6d3d1',
    },
  },
  {
    id: 'slate',
    name: '石板',
    icon: '🪨',
    description: '中性灰蓝，冷静专注',
    css: {
      '--bg-primary': '#0f172a',
      '--bg-secondary': '#1e293b',
      '--bg-card': 'rgba(30,41,59,0.65)',
      '--text-primary': '#e2e8f0',
      '--text-secondary': '#94a3b8',
      '--text-muted': '#64748b',
      '--accent': '#818cf8',
      '--accent-soft': 'rgba(129,140,248,0.1)',
      '--border': 'rgba(51,65,85,0.5)',
      '--bar-default': '#475569',
    },
  },
]

// 字体选项（使用 layout.tsx 中定义的 CSS 变量）
export interface FontOption {
  id: string
  name: string
  cssVar: string
}

export const FONTS: FontOption[] = [
  { id: 'serif', name: '阅读宋体', cssVar: 'var(--font-noto-serif), Georgia, "Noto Serif SC", serif' },
  { id: 'kai', name: '楷体', cssVar: '"STKaiti", "KaiTi", var(--font-noto-serif), serif' },
  { id: 'masz', name: '行草', cssVar: 'var(--font-masz), "STKaiti", cursive' },
  { id: 'sans', name: '屏显黑体', cssVar: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans SC", sans-serif' },
]

// 自定义主题选项
export interface CustomThemeColors {
  bgShade: 'dark' | 'medium' | 'light'
  accentColor: 'amber' | 'cyan' | 'emerald' | 'purple' | 'gold' | 'blue'
}

// 背景色阶预设
const BG_SHADES: Record<string, { bg: string; bgSec: string; bgCard: string; text: string; textSec: string; textMuted: string }> = {
  dark: {
    bg: '#09090b',
    bgSec: '#18181b',
    bgCard: 'rgba(24,24,27,0.6)',
    text: '#e4e4e7',
    textSec: '#a1a1aa',
    textMuted: '#71717a',
  },
  medium: {
    bg: '#27272a',
    bgSec: '#3f3f46',
    bgCard: 'rgba(63,63,70,0.6)',
    text: '#e4e4e7',
    textSec: '#a1a1aa',
    textMuted: '#71717a',
  },
  light: {
    bg: '#fafaf9',
    bgSec: '#f5f5f4',
    bgCard: 'rgba(245,245,244,0.85)',
    text: '#1c1917',
    textSec: '#57534e',
    textMuted: '#a8a29e',
  },
}

// 强调色预设
const ACCENTS: Record<string, { accent: string; soft: string; border: string }> = {
  amber: { accent: '#f59e0b', soft: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
  cyan: { accent: '#22d3ee', soft: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.2)' },
  emerald: { accent: '#34d399', soft: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)' },
  purple: { accent: '#a78bfa', soft: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)' },
  gold: { accent: '#fbbf24', soft: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)' },
  blue: { accent: '#60a5fa', soft: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.2)' },
}

export function buildCustomThemeCss(colors: CustomThemeColors): Record<string, string> {
  const bg = BG_SHADES[colors.bgShade]
  const ac = ACCENTS[colors.accentColor]
  return {
    '--bg-primary': bg.bg,
    '--bg-secondary': bg.bgSec,
    '--bg-card': bg.bgCard,
    '--text-primary': bg.text,
    '--text-secondary': bg.textSec,
    '--text-muted': bg.textMuted,
    '--accent': ac.accent,
    '--accent-soft': ac.soft,
    '--border': ac.border,
    '--bar-default': bg.textMuted,
  }
}

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) || THEMES[0]
}
