'use client'

import { GameState } from '@/lib/types'

interface SidePanelProps {
  state: GameState
  turnCount: number
  hasBgImage?: boolean
  scenarioBgUrl?: string
  scenarioTitle?: string
}

export function SidePanel({ state, turnCount, scenarioBgUrl, scenarioTitle }: SidePanelProps) {
  const hpPercent = Math.round((state.hp / state.maxHp) * 100)

  return (
    <aside className="game-status game-scrollbar">
      {/* Character */}
      <div className="game-hud-panel">
        <div className="flex items-center gap-1.5 mb-3">
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent, #14f1c6)', boxShadow: '0 0 6px var(--accent, #14f1c6)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text-sub, #94a3b8)' }}>
            角色状态
          </span>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.03)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-sub, #94a3b8)' }}>姓名</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #f3f6ff)' }}>{state.playerName || '云逸'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.03)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-sub, #94a3b8)' }}>境界</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent, #14f1c6)' }}>{state.realm || '练气期 · 七层'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
            <span style={{ fontSize: 12, color: 'var(--text-sub, #94a3b8)' }}>灵根</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #f3f6ff)' }}>{state.spiritRoot || '火木双灵根'}</span>
          </div>
          <div style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-sub, #94a3b8)', marginBottom: 3 }}>
              <span>HP</span><span>{state.hp} / {state.maxHp}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, width: `${hpPercent}%`, background: 'linear-gradient(90deg, var(--accent, #14f1c6), var(--accent2, #5eead4))', boxShadow: '0 0 8px rgba(20,241,198,.3)', transition: 'width .5s ease-out' }} />
            </div>
          </div>
        </div>
      </div>

      {/* 场景背景卡 — 显示场景预设背景图片 */}
      <div className="game-hud-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          position: 'relative',
          height: 130,
          borderRadius: 'var(--game-radius-lg, 18px)',
          overflow: 'hidden',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        }}>
          {/* 背景图片 / 默认渐变 */}
          <div style={{
            position: 'absolute', inset: 0,
            ...(scenarioBgUrl
              ? { backgroundImage: `url(${scenarioBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : {
                  background: [
                    'linear-gradient(135deg, rgba(20,241,198,0.08), rgba(139,92,246,0.06), rgba(59,130,246,0.08))',
                    'repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(255,255,255,0.015) 30px, rgba(255,255,255,0.015) 31px)',
                    'repeating-linear-gradient(90deg, transparent, transparent 30px, rgba(255,255,255,0.015) 30px, rgba(255,255,255,0.015) 31px)',
                  ].join(','),
                }
            ),
          }} />
          {/* 遮罩 — 仅图片时显示 */}
          {scenarioBgUrl && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.05) 100%)',
            }} />
          )}
          {/* 非图片时中间装饰图标 */}
          {!scenarioBgUrl && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(20,241,198,0.08)',
              border: '1px solid rgba(20,241,198,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>
              🌌
            </div>
          )}
          {/* 底部信息 */}
          <div style={{ position: 'absolute', bottom: 10, left: 14, right: 14 }}>
            <div style={{
              fontSize: 13, fontWeight: 600,
              color: '#f3f6ff',
              textShadow: '0 1px 8px rgba(0,0,0,0.6)',
            }}>
              {scenarioTitle || '未知场景'}
            </div>
            {state.location && (
              <div style={{
                fontSize: 10, color: 'rgba(255,255,255,0.6)',
                marginTop: 3, textShadow: '0 1px 4px rgba(0,0,0,0.5)',
              }}>
                📍 {state.location}
              </div>
            )}
          </div>
        </div>
        {/* 标签栏 */}
        <div style={{
          padding: '6px 12px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent, #14f1c6)' }} />
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-sub, #94a3b8)' }}>
            {scenarioBgUrl ? '场景预览' : '太虚之境'}
          </span>
        </div>
      </div>

      {/* Attributes */}
      {Object.keys(state.attributes).length > 0 && (
        <div className="game-hud-panel">
          <div className="flex items-center gap-1.5 mb-2">
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent, #14f1c6)', boxShadow: '0 0 6px var(--accent, #14f1c6)' }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text-sub, #94a3b8)' }}>
              属性
            </span>
          </div>
          {Object.entries(state.attributes).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.03)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-sub, #94a3b8)' }}>{key}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: key === 'spirit' || key === '灵力' ? 'var(--accent, #14f1c6)' : key === 'luck' || key === '气运' ? 'var(--warning, #ffb86b)' : 'var(--text-primary, #f3f6ff)' }}>
                {val as number}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Inventory */}
      <div className="game-hud-panel">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent, #14f1c6)', boxShadow: '0 0 6px var(--accent, #14f1c6)' }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text-sub, #94a3b8)' }}>
              背包
            </span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-sub, #94a3b8)' }}>{state.inventory.length} 件</span>
        </div>
        {state.inventory.length === 0 ? (
          <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted, #64748b)' }}>空无一物</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {state.inventory.map((item, i) => {
              const isRare = item.includes('丹') || item.includes('符')
              const isEpic = item.includes('破境') || item.includes('护身')
              const emojiMap: Record<string, string> = {
                '丹': '💊', '符': '📜', '剑': '⚔️', '石': '💎', '草': '🌿',
                '甲': '🛡️', '盘': '🧭', '图': '🗺️', '卷': '📖', '毒': '🧪',
                '佩': '💠',
              }
              const emoji = Object.entries(emojiMap).find(([k]) => item.includes(k))?.[1] || '📦'
              return (
                <div
                  key={i}
                  title={item}
                  style={{
                    aspectRatio: 1,
                    borderRadius: 'var(--game-radius-sm, 10px)',
                    background: 'rgba(23,32,51,.5)',
                    border: isEpic ? '1px solid rgba(139,92,246,.4)' : isRare ? '1px solid rgba(59,130,246,.3)' : '1px solid var(--glass-border, rgba(255,255,255,.06))',
                    boxShadow: isEpic ? '0 0 10px rgba(139,92,246,.15)' : isRare ? '0 0 8px rgba(59,130,246,.1)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, cursor: 'pointer', position: 'relative',
                    transition: 'all .2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)'; e.currentTarget.style.background = 'rgba(23,32,51,.8)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = isEpic ? 'rgba(139,92,246,.4)' : isRare ? 'rgba(59,130,246,.3)' : 'var(--glass-border, rgba(255,255,255,.06))'; e.currentTarget.style.background = 'rgba(23,32,51,.5)' }}
                >
                  {emoji}
                  <span style={{ position: 'absolute', bottom: 1, right: 3, fontSize: 9, color: 'var(--text-sub, #94a3b8)', fontWeight: 600 }}>
                    {item.match(/\d+/)?.[0] || '1'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Turn Counter */}
      <div
        style={{
          textAlign: 'center',
          background: 'var(--glass-bg, rgba(17,24,39,.72))',
          backdropFilter: 'blur(var(--glass-blur, 20px))',
          WebkitBackdropFilter: 'blur(var(--glass-blur, 20px))',
          border: '1px solid var(--glass-border, rgba(255,255,255,.06))',
          borderRadius: 'var(--game-radius-lg, 18px)',
          boxShadow: 'var(--card-shadow, 0 10px 40px rgba(0,0,0,.45))',
          padding: 'var(--game-space-3, 16px)',
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text-sub, #94a3b8)', marginBottom: 4 }}>
          回合数
        </div>
        <div style={{
          fontSize: 36, fontWeight: 700,
          color: 'var(--accent, #14f1c6)',
          textShadow: '0 0 20px rgba(20,241,198,.2), 0 0 40px rgba(20,241,198,.1)',
        }}>
          {String(turnCount).padStart(2, '0')}
        </div>
      </div>
    </aside>
  )
}
