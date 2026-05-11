export interface Theme {
  id: string
  name: string
  icon: string
  description: string
  css: Record<string, string>
}

/**
 * 每个主题的 CSS 变量说明：
 *
 * 基础色：
 *   --bg-primary      主背景色（最底层）
 *   --bg-secondary    次级背景（面板、侧栏）
 *   --bg-card         卡片背景
 *   --text-primary    主文字色
 *   --text-secondary  次要文字
 *   --text-muted      弱化文字
 *   --accent          强调色（按钮、链接、高亮）
 *   --accent-soft     强调色半透明（悬停态、轻背景）
 *   --border          边框色
 *
 * 纹理与氛围：
 *   --texture         CSS background 值，作为主内容区纹理叠加层
 *   --texture-opacity 纹理不透明度 (0~1)
 *   --glow-color      氛围辉光颜色（HP条、选中态等）
 *
 * 聊天气泡（用户消息）：
 *   --bubble-radius   圆角
 *   --bubble-shadow   阴影
 *
 * AI 叙事装饰：
 *   --ai-bar-color    左侧装饰条颜色
 *
 * 界面元素：
 *   --bar-default     默认进度条底色
 *   --hp-bar-fill     HP 条填充色
 */

export const THEMES: Theme[] = [
  // ─── 暗夜（经典暗色，琥珀点缀） ───
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
      // 纹理：細微噪点
      '--texture': 'repeating-conic-gradient(rgba(255,255,255,0.008) 0% 25%, transparent 0% 50%) 0px 0px / 4px 4px',
      '--texture-opacity': '0.5',
      '--glow-color': 'rgba(245,158,11,0.15)',
      // 气泡
      '--bubble-radius': '16px 16px 4px 16px',
      '--bubble-shadow': '0 2px 8px rgba(0,0,0,0.2)',
      '--ai-bar-color': 'var(--accent)',
      '--hp-bar-fill': 'linear-gradient(90deg, #f59e0b, #fbbf24)',
    },
  },

  // ─── 羊皮古卷（暖棕底、米白字） ───
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
      // 纹理：羊皮纸横纹 + 顶部暖光
      '--texture': `
        repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(217,119,6,0.015) 3px, rgba(217,119,6,0.015) 4px) 0px 0px / 100% 4px,
        radial-gradient(ellipse at 50% 0%, rgba(217,119,6,0.08) 0%, transparent 60%) 0px 0px / 100% 100%
      `,
      '--texture-opacity': '0.6',
      '--glow-color': 'rgba(217,119,6,0.12)',
      // 气泡：不规则圆角，仿纸张质感
      '--bubble-radius': '4px 16px 16px 16px',
      '--bubble-shadow': '2px 2px 6px rgba(0,0,0,0.25)',
      '--ai-bar-color': '#d97706',
      '--hp-bar-fill': 'linear-gradient(90deg, #d97706, #f59e0b)',
    },
  },

  // ─── 赛博霓虹 ───
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
      // 纹理：网格 + 扫描线 + 霓虹辉光
      '--texture': `
        linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px) 0px 0px / 28px 28px,
        linear-gradient(0deg, rgba(34,211,238,0.04) 1px, transparent 1px) 0px 0px / 28px 28px,
        repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(139,92,246,0.025) 3px, rgba(139,92,246,0.025) 4px) 0px 0px / 100% 4px,
        radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.10) 0%, transparent 50%) 0px 0px / 100% 100%
      `,
      '--texture-opacity': '0.7',
      '--glow-color': 'rgba(34,211,238,0.12)',
      // 气泡：直角 + 发光边缘
      '--bubble-radius': '4px',
      '--bubble-shadow': '0 0 12px rgba(34,211,238,0.15)',
      '--ai-bar-color': '#22d3ee',
      '--hp-bar-fill': 'linear-gradient(90deg, #22d3ee, #818cf8)',
    },
  },

  // ─── 深林幽光 ───
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
      // 纹理：有机光斑 + 细微噪点
      '--texture': `
        radial-gradient(circle at 20% 30%, rgba(52,211,153,0.05) 0%, transparent 40%) 0px 0px / 100% 100%,
        radial-gradient(circle at 80% 70%, rgba(52,211,153,0.025) 0%, transparent 30%) 0px 0px / 100% 100%,
        repeating-conic-gradient(rgba(255,255,255,0.008) 0% 25%, transparent 0% 50%) 0px 0px / 6px 6px
      `,
      '--texture-opacity': '0.6',
      '--glow-color': 'rgba(52,211,153,0.12)',
      // 气泡：超圆角 + 毛玻璃
      '--bubble-radius': '20px',
      '--bubble-shadow': '0 4px 12px rgba(0,0,0,0.2), 0 0 0 1px rgba(52,211,153,0.08)',
      '--ai-bar-color': '#34d399',
      '--hp-bar-fill': 'linear-gradient(90deg, #34d399, #10b981)',
    },
  },

  // ─── 暗血史诗 ───
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
      // 纹理：暗红晕染 + 裂纹感
      '--texture': `
        radial-gradient(ellipse at 30% 20%, rgba(220,38,38,0.06) 0%, transparent 50%) 0px 0px / 100% 100%,
        radial-gradient(ellipse at 70% 80%, rgba(251,191,36,0.025) 0%, transparent 40%) 0px 0px / 100% 100%,
        repeating-conic-gradient(rgba(220,38,38,0.015) 0% 25%, transparent 0% 50%) 8px 8px / 16px 16px
      `,
      '--texture-opacity': '0.6',
      '--glow-color': 'rgba(220,38,38,0.15)',
      // 气泡：尖角 + 金属质感阴影
      '--bubble-radius': '12px 4px 12px 4px',
      '--bubble-shadow': '0 0 8px rgba(220,38,38,0.2)',
      '--ai-bar-color': '#fbbf24',
      '--hp-bar-fill': 'linear-gradient(90deg, #dc2626, #fbbf24)',
    },
  },

  // ─── 雪境 ───
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
      // 纹理：霜晶菱形纹 + 冷光
      '--texture': `
        radial-gradient(circle at 30% 40%, rgba(255,255,255,0.03) 0%, transparent 30%) 0px 0px / 100% 100%,
        radial-gradient(circle at 70% 60%, rgba(255,255,255,0.02) 0%, transparent 25%) 0px 0px / 100% 100%,
        repeating-linear-gradient(45deg, transparent 0px, transparent 8px, rgba(255,255,255,0.015) 8px, rgba(255,255,255,0.015) 9px) 0px 0px / 100% 100%
      `,
      '--texture-opacity': '0.5',
      '--glow-color': 'rgba(96,165,250,0.1)',
      // 气泡：清爽直角
      '--bubble-radius': '8px',
      '--bubble-shadow': '0 2px 4px rgba(0,0,0,0.15)',
      '--ai-bar-color': '#60a5fa',
      '--hp-bar-fill': 'linear-gradient(90deg, #60a5fa, #818cf8)',
    },
  },

  // ─── Linear（深黑画布，薰衣草紫点缀） ───
  {
    id: 'linear',
    name: 'Linear',
    icon: '💠',
    description: '深黑画布，薰衣草紫点缀，精准极简',
    css: {
      '--bg-primary': '#010102',
      '--bg-secondary': '#0f1011',
      '--bg-card': '#141516',
      '--text-primary': '#f7f8f8',
      '--text-secondary': '#d0d6e0',
      '--text-muted': '#8a8f98',
      '--accent': '#5e6ad2',
      '--accent-soft': 'rgba(94,106,210,0.12)',
      '--border': '#23252a',
      '--bar-default': '#34343a',
      // 纹理：细微点阵网格
      '--texture': 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.025) 1px, transparent 0) 0px 0px / 24px 24px',
      '--texture-opacity': '0.4',
      '--glow-color': 'rgba(94,106,210,0.12)',
      '--bubble-radius': '12px',
      '--bubble-shadow': '0 2px 8px rgba(0,0,0,0.25)',
      '--ai-bar-color': '#5e6ad2',
      '--hp-bar-fill': 'linear-gradient(90deg, #5e6ad2, #818cf8)',
    },
  },

  // ─── 晨光（暖白明亮） ───
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
      // 纹理：柔光放射
      '--texture': `
        radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.05) 0%, transparent 60%) 0px 0px / 100% 100%,
        radial-gradient(ellipse at 80% 80%, rgba(251,146,60,0.025) 0%, transparent 40%) 0px 0px / 100% 100%
      `,
      '--texture-opacity': '0.5',
      '--glow-color': 'rgba(217,119,6,0.1)',
      '--bubble-radius': '16px',
      '--bubble-shadow': '0 2px 8px rgba(0,0,0,0.06)',
      '--ai-bar-color': '#d97706',
      '--hp-bar-fill': 'linear-gradient(90deg, #d97706, #f59e0b)',
    },
  },

  // ─── 石板（中性灰蓝） ───
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
      // 纹理：岩石颗粒感
      '--texture': `
        repeating-conic-gradient(rgba(255,255,255,0.015) 0% 25%, transparent 0% 50%) 0px 0px / 8px 8px,
        radial-gradient(ellipse at 50% 20%, rgba(129,140,248,0.04) 0%, transparent 50%) 0px 0px / 100% 100%
      `,
      '--texture-opacity': '0.5',
      '--glow-color': 'rgba(129,140,248,0.12)',
      '--bubble-radius': '10px',
      '--bubble-shadow': '0 2px 6px rgba(0,0,0,0.2)',
      '--ai-bar-color': '#818cf8',
      '--hp-bar-fill': 'linear-gradient(90deg, #818cf8, #a78bfa)',
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
    '--texture': 'repeating-conic-gradient(rgba(255,255,255,0.008) 0% 25%, transparent 0% 50%) 0px 0px / 4px 4px',
    '--texture-opacity': '0.5',
    '--glow-color': 'rgba(255,255,255,0.06)',
    '--bubble-radius': '16px 16px 4px 16px',
    '--bubble-shadow': '0 2px 8px rgba(0,0,0,0.2)',
    '--ai-bar-color': ac.accent,
    '--hp-bar-fill': `linear-gradient(90deg, ${ac.accent}, ${ac.accent})`,
  }
}

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) || THEMES[0]
}
