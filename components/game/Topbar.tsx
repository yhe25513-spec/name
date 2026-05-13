'use client'

import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

interface TopbarProps {
  scenarioTitle: string
  avatarLetter?: string
  onBack?: () => void
  onOpenDrawer?: (tab: 'stats' | 'inventory') => void
  onSettingsClick?: () => void
}

export function Topbar({ scenarioTitle, avatarLetter = 'Z', onBack, onOpenDrawer, onSettingsClick }: TopbarProps) {
  return (
    <header
      className="game-panel"
      style={{
        gridColumn: '1 / -1',
        gridRow: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--game-space-4, 24px)',
        borderRadius: 'var(--game-radius-md, 14px)',
      }}
    >
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--game-space-2, 12px)' }}>
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center justify-center"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,.04)',
              border: '1px solid var(--glass-border, rgba(255,255,255,.06))',
              color: 'var(--text-sub, #94a3b8)',
              cursor: 'pointer',
              fontSize: 16,
              transition: 'all .25s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.08)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; e.currentTarget.style.color = 'var(--text-sub, #94a3b8)' }}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div
          style={{
            width: 38, height: 38, borderRadius: 'var(--game-radius-sm, 10px)',
            background: 'linear-gradient(135deg, var(--accent, #14f1c6), #0ea5e9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 18, color: '#070b14',
            boxShadow: '0 0 18px rgba(20,241,198,.25)',
          }}
        >
          太
        </div>
        <span
          style={{
            fontSize: 18, fontWeight: 700, letterSpacing: '.5px',
            background: 'linear-gradient(135deg, var(--accent, #14f1c6), var(--accent2, #5eead4))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}
        >
          {scenarioTitle}
        </span>
      </div>

      {/* Center — search */}
      <div className="hidden sm:block">
        <input
          type="text"
          placeholder="搜索冒险…"
          style={{
            width: 220, height: 36, borderRadius: 18,
            border: '1px solid var(--border, #2a3b57)',
            background: 'rgba(23,32,51,.6)',
            color: 'var(--text-primary, #f3f6ff)',
            padding: '0 14px', fontSize: 13, outline: 'none',
            transition: 'border-color .25s, box-shadow .25s',
            fontFamily: 'inherit',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent, #14f1c6)'; e.currentTarget.style.boxShadow = 'var(--glow, 0 0 30px rgba(20,241,198,.12))' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border, #2a3b57)'; e.currentTarget.style.boxShadow = 'none' }}
        />
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--game-space-2, 12px)' }}>
        <IconButton
          icon="🔔"
          title="消息"
          className="hidden lg:flex"
          onClick={() => toast('暂无新消息')}
        />
        <IconButton
          icon="⚙️"
          title="设置"
          className="hidden lg:flex"
          onClick={() => onSettingsClick?.()}
        />
        <IconButton
          icon="🎒"
          title="背包"
          onClick={() => onOpenDrawer?.('inventory')}
        />
        <IconButton
          icon="👤"
          title="状态"
          onClick={() => onOpenDrawer?.('stats')}
        />
        <div
          title="用户"
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: '2px solid rgba(20,241,198,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 14, color: '#fff',
            cursor: 'pointer', transition: 'box-shadow .25s',
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 18px rgba(20,241,198,.25)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
        >
          {avatarLetter}
        </div>
      </div>
    </header>
  )
}

function IconButton({ icon, title, className, onClick }: { icon: string; title: string; className?: string; onClick?: () => void }) {
  return (
    <button
      className={className}
      title={title}
      onClick={onClick}
      style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-border, rgba(255,255,255,.06))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all .25s', color: 'var(--text-sub, #94a3b8)', fontSize: 16,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.08)'; e.currentTarget.style.color = 'var(--text-primary)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; e.currentTarget.style.color = 'var(--text-sub, #94a3b8)' }}
    >
      {icon}
    </button>
  )
}
