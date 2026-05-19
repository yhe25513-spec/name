'use client'

import { useState } from 'react'
import { GameState } from '@/lib/types'
import { cn } from '@/lib/utils'
import { GameMap } from './GameMap'

interface SidePanelProps {
  state: GameState
  turnCount: number
  hasBgImage?: boolean
  scenarioBgUrl?: string
  scenarioTitle?: string
  onUseItem?: (itemName: string) => void
}

// 物品品质定义
interface ItemQuality {
  label: string
  color: string
  borderColor: string
  glow: string
  bg: string
}

const ITEM_QUALITIES: Record<string, ItemQuality> = {
  普通: { label: '普通', color: '#94a3b8', borderColor: 'rgba(148,163,184,0.2)', glow: 'none', bg: 'rgba(148,163,184,0.05)' },
  稀有: { label: '稀有', color: '#3b82f6', borderColor: 'rgba(59,130,246,0.3)', glow: '0 0 8px rgba(59,130,246,0.1)', bg: 'rgba(59,130,246,0.08)' },
  史诗: { label: '史诗', color: '#8b5cf6', borderColor: 'rgba(139,92,246,0.35)', glow: '0 0 10px rgba(139,92,246,0.15)', bg: 'rgba(139,92,246,0.1)' },
  传说: { label: '传说', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)', glow: '0 0 12px rgba(245,158,11,0.2)', bg: 'rgba(245,158,11,0.12)' },
}

function getItemQuality(name: string): ItemQuality {
  if (name.includes('神器') || name.includes('至宝') || name.includes('上古')) return ITEM_QUALITIES['传说']
  if (name.includes('破境') || name.includes('护身') || name.includes('极品')) return ITEM_QUALITIES['史诗']
  if (name.includes('丹') || name.includes('符') || name.includes('灵') || name.includes('宝')) return ITEM_QUALITIES['稀有']
  return ITEM_QUALITIES['普通']
}

const EMOJI_MAP: Record<string, string> = {
  '丹': '💊', '符': '📜', '剑': '⚔️', '石': '💎', '草': '🌿',
  '甲': '🛡️', '盘': '🧭', '图': '🗺️', '卷': '📖', '毒': '🧪',
  '佩': '💠', '戒': '💍', '鼎': '🏺', '琴': '🎵', '镜': '🪞',
}

function getItemEmoji(name: string): string {
  const match = Object.entries(EMOJI_MAP).find(([k]) => name.includes(k))
  return match?.[1] || '📦'
}

/** 物品详情弹出卡片 */
function ItemDetail({ item, onClose, onUse }: { item: string; onClose: () => void; onUse: (item: string) => void }) {
  const quality = getItemQuality(item)
  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <div
        className="absolute z-50 p-4 rounded-xl shadow-2xl min-w-[180px]"
        style={{
          backgroundColor: '#1a1b2e',
          border: `1px solid ${quality.borderColor}`,
          boxShadow: `${quality.glow}, 0 10px 40px rgba(0,0,0,0.5)`,
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{getItemEmoji(item)}</span>
          <div>
            <div className="text-sm font-semibold" style={{ color: quality.color }}>{item}</div>
            <div className="text-[10px] px-1.5 py-0.5 rounded-full inline-block mt-1"
              style={{ backgroundColor: quality.bg, color: quality.color, border: `1px solid ${quality.borderColor}` }}>
              {quality.label}
            </div>
          </div>
        </div>
        <button
          onClick={() => { onUse(item); onClose() }}
          className="w-full py-2 rounded-lg text-xs font-semibold transition-all mt-1"
          style={{
            backgroundColor: quality.color + '20',
            color: quality.color,
            border: `1px solid ${quality.borderColor}`,
          }}
        >
          使用
        </button>
      </div>
    </>
  )
}

export function SidePanel({ state, turnCount, scenarioBgUrl, scenarioTitle, onUseItem }: SidePanelProps) {
  const hpPercent = Math.round((state.hp / state.maxHp) * 100)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)

  function handleUseItem(item: string) {
    if (onUseItem) {
      onUseItem(item)
    }
  }

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

      {/* 场景背景卡 */}
      <div className="game-hud-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          position: 'relative',
          height: 130,
          borderRadius: 'var(--game-radius-lg, 18px)',
          overflow: 'hidden',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        }}>
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
          {scenarioBgUrl && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.05) 100%)',
            }} />
          )}
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
          <div style={{ position: 'absolute', bottom: 10, left: 14, right: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f3f6ff', textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>
              {scenarioTitle || '未知场景'}
            </div>
            {state.location && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 3, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                📍 {state.location}
              </div>
            )}
          </div>
        </div>
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

      {/* 地图 */}
      <div className="game-hud-panel">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-1 h-1 rounded-full" style={{ background: 'var(--accent, #14f1c6)', boxShadow: '0 0 6px var(--accent, #14f1c6)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text-sub, #94a3b8)' }}>
            地图
          </span>
        </div>
        <GameMap state={state} />
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

      {/* Inventory with Interaction */}
      <div className="game-hud-panel" style={{ position: 'relative' }}>
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
              const quality = getItemQuality(item)
              return (
                <div
                  key={i}
                  title={item}
                  onClick={() => setSelectedItem(item)}
                  style={{
                    aspectRatio: 1,
                    borderRadius: 'var(--game-radius-sm, 10px)',
                    background: quality.bg,
                    border: `1px solid ${quality.borderColor}`,
                    boxShadow: quality.glow,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, cursor: 'pointer', position: 'relative',
                    transition: 'all .2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = quality.color
                    e.currentTarget.style.background = quality.color + '15'
                    e.currentTarget.style.transform = 'scale(1.1)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = quality.borderColor
                    e.currentTarget.style.background = quality.bg
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >
                  {getItemEmoji(item)}
                  <span style={{ position: 'absolute', bottom: 1, right: 3, fontSize: 9, color: quality.color, fontWeight: 600 }}>
                    {item.match(/\d+/)?.[0] || ''}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* 物品详情弹窗 */}
        {selectedItem && (
          <ItemDetail
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onUse={handleUseItem}
          />
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
