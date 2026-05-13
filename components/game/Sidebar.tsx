'use client'

import { GameState } from '@/lib/types'

interface SidebarProps {
  saves?: Array<{
    id: string
    scenario?: { id: string; title: string; description?: string }
    current_state: GameState
    turn_count: number
  }>
  currentSaveId?: string
  onSelect?: (saveId: string) => void
  onNew?: () => void
}

export function Sidebar({ saves, currentSaveId, onSelect, onNew }: SidebarProps) {
  return (
    <aside className="game-sidebar game-scrollbar">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--game-space-1, 8px) var(--game-space-2, 12px)',
          flexShrink: 0,
        }}
      >
        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text-sub, #94a3b8)' }}>
          我的冒险
        </h3>
        {onNew && (
          <button
            onClick={onNew}
            style={{ fontSize: 11, color: 'var(--accent, #14f1c6)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}
          >
            + 新冒险
          </button>
        )}
      </div>

      {/* Adventure cards */}
      {saves && saves.length > 0 ? (
        saves.map(save => {
          const hp = save.current_state.hp
          const maxHp = save.current_state.maxHp
          const hpPct = Math.round((hp / maxHp) * 100)
          const isActive = save.id === currentSaveId
          const hpClass = hpPct <= 25 ? 'danger' : hpPct <= 50 ? 'warning' : ''

          return (
            <div
              key={save.id}
              className={`game-adventure-card${isActive ? ' active' : ''}`}
              onClick={() => onSelect?.(save.id)}
            >
              {/* Cover art */}
              <div
                style={{
                  width: 72, height: 72, borderRadius: 'var(--game-radius-sm, 10px)',
                  flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, position: 'relative', overflow: 'hidden',
                  background: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
                }}
              >
                🏯
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary, #f3f6ff)' }}>
                  {save.scenario?.title || '未知冒险'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-sub, #94a3b8)' }}>
                  第 {save.turn_count} 回合
                </div>
                <div style={{ marginTop: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-sub, #94a3b8)', marginBottom: 2 }}>
                    <span>HP</span><span>{hp}/{maxHp}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%', borderRadius: 2,
                        width: `${hpPct}%`,
                        background: !hpClass
                          ? 'linear-gradient(90deg, var(--accent, #14f1c6), var(--accent2, #5eead4))'
                          : hpClass === 'warning'
                            ? 'linear-gradient(90deg, var(--warning, #ffb86b), #f59e0b)'
                            : 'linear-gradient(90deg, var(--danger, #ff6b6b), #ef4444)',
                        transition: 'width .6s ease-out',
                        boxShadow: !hpClass ? '0 0 8px rgba(20,241,198,.25)' : 'none',
                      }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 10, background: 'rgba(20,241,198,.08)', border: '1px solid rgba(20,241,198,.15)', color: 'var(--accent, #14f1c6)' }}>
                    {isActive ? '进行中' : '已保存'}
                  </span>
                  {save.current_state.realm && (
                    <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 10, background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.15)', color: '#818cf8' }}>
                      {save.current_state.realm}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })
      ) : (
        /* Placeholder cards when no saves */
        <>
          {[
            { emoji: '🏯', name: '太虚山脉 · 初入修真', chapter: '第 7 章 · 灵气复苏', hp: 78, maxHp: 100, tags: ['主线', '练气期'] },
            { emoji: '🌊', name: '幽冥海域 · 寻找龙珠', chapter: '第 3 章 · 深海秘境', hp: 45, maxHp: 100, tags: ['支线', '筑基期'], warning: true },
            { emoji: '🔥', name: '魔渊裂隙 · 封印之战', chapter: '第 12 章 · 决战前夕', hp: 23, maxHp: 100, tags: ['主线', '金丹期'], danger: true },
            { emoji: '🌙', name: '月华秘境 · 试炼之路', chapter: '第 1 章 · 入门试炼', hp: 92, maxHp: 100, tags: ['支线', '练气期'] },
          ].map((card, i) => {
            const hpPct = Math.round((card.hp / card.maxHp) * 100)
            const hpClass = card.danger ? 'danger' : card.warning ? 'warning' : ''
            return (
              <div
                key={i}
                className="game-adventure-card"
                onClick={() => {}}
                style={i === 0 ? { borderColor: 'var(--accent, #14f1c6)', boxShadow: '0 0 30px rgba(20,241,198,.15), var(--card-shadow)' } : {}}
              >
                <div style={{ width: 72, height: 72, borderRadius: 'var(--game-radius-sm, 10px)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, background: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)' }}>
                  {card.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary, #f3f6ff)' }}>
                    {card.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-sub, #94a3b8)' }}>{card.chapter}</div>
                  <div style={{ marginTop: 2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-sub, #94a3b8)', marginBottom: 2 }}>
                      <span>HP</span><span>{card.hp}/{card.maxHp}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 2, width: `${hpPct}%`,
                        background: !hpClass ? 'linear-gradient(90deg, var(--accent, #14f1c6), var(--accent2, #5eead4))'
                          : hpClass === 'warning' ? 'linear-gradient(90deg, var(--warning, #ffb86b), #f59e0b)'
                          : 'linear-gradient(90deg, var(--danger, #ff6b6b), #ef4444)',
                        transition: 'width .6s ease-out',
                      }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {card.tags.map(tag => (
                      <span key={tag} style={{ fontSize: 10, padding: '1px 8px', borderRadius: 10, background: 'rgba(20,241,198,.08)', border: '1px solid rgba(20,241,198,.15)', color: 'var(--accent, #14f1c6)' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </>
      )}
    </aside>
  )
}
