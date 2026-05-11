'use client'

import { GameState } from '@/lib/types'
import { Heart, Package, MapPin, Swords, Star } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface SidePanelProps {
  state: GameState
  turnCount: number
  hasBgImage?: boolean
}

export function SidePanel({ state, turnCount, hasBgImage = false }: SidePanelProps) {
  const hpPercent = Math.round((state.hp / state.maxHp) * 100)

  return (
    <div
      className="w-80 flex-shrink-0 flex flex-col relative"
      style={{
        backgroundColor: 'var(--glass-bg)',
        backdropFilter: `blur(var(--glass-blur, 20px))`,
        WebkitBackdropFilter: `blur(var(--glass-blur, 20px))`,
        borderLeft: '1px solid var(--glass-border)',
        boxShadow: 'var(--panel-shadow)',
      }}
    >
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* 生命值 */}
          <div
            className='rounded-xl p-3.5 border'
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>生命</span>
              </div>
              <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--text-primary)' }} className="font-medium">{state.hp}</span>
                <span style={{ color: 'var(--text-muted)' }}>/{state.maxHp}</span>
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${hpPercent}%`, background: 'var(--hp-bar-fill, var(--accent))' }}
              />
            </div>
          </div>

          {/* 位置 + 回合 */}
          <div className="flex items-center gap-2">
            {state.location && (
              <div
                className="flex-1 flex items-center gap-1.5 rounded-lg px-3 py-2 border min-w-0"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border)',
                  boxShadow: 'var(--card-shadow)',
                }}
              >
                <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{state.location}</span>
              </div>
            )}
            <div
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 border flex-shrink-0"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <Swords className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
              <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{turnCount}</span>
            </div>
          </div>

          {/* 属性 */}
          {Object.keys(state.attributes).length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
                <Star className="w-3 h-3" style={{ color: 'var(--accent)' }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>属性</span>
              </div>
              <div className="space-y-2">
                {Object.entries(state.attributes).map(([key, val]) => {
                  const pct = Math.min(100, (val as number) * 10)
                  return (
                    <div key={key} className="flex items-center gap-2 px-0.5">
                      <span className="text-xs w-10 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{key}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: 'var(--accent)', opacity: 0.7 }}
                        />
                      </div>
                      <span className="text-xs tabular-nums w-6 text-right font-medium" style={{ color: 'var(--text-secondary)' }}>{val as number}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 背包 */}
          <div>
            <div className="flex items-center justify-between mb-2 px-0.5">
              <div className="flex items-center gap-1.5">
                <Package className="w-3 h-3" style={{ color: 'var(--accent)' }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>背包</span>
              </div>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{state.inventory.length} 件</span>
            </div>
            {state.inventory.length === 0 ? (
              <p className="text-[11px] italic px-0.5" style={{ color: 'var(--text-muted)' }}>空无一物</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {state.inventory.map((item, i) => {
                  const isRare = item.includes('丹') || item.includes('符')
                  const isEpic = item.includes('破境') || item.includes('护身')
                  return (
                    <div
                      key={i}
                      className="aspect-square rounded-md flex items-center justify-center text-lg cursor-default transition-all duration-200 hover:scale-105 relative"
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        border: isEpic ? '1px solid rgba(139,92,246,.35)' : isRare ? '1px solid rgba(59,130,246,.25)' : '1px solid var(--border)',
                        boxShadow: isEpic ? '0 0 10px rgba(139,92,246,.15)' : isRare ? '0 0 8px rgba(59,130,246,.1)' : 'none',
                      }}
                      title={item}
                    >
                      <span className="text-xs text-center leading-tight px-0.5" style={{ color: 'var(--text-primary)' }}>
                        {item.length > 3 ? item.slice(0, 3) : item}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 底部回合标记 */}
          <div className="pt-2 text-center" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="text-[10px] tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>回合数</div>
            <div className="text-4xl font-bold tabular-nums" style={{
              color: 'var(--accent)',
              textShadow: '0 0 20px var(--glow-accent), 0 0 40px var(--glow-accent)',
            }}>{String(turnCount).padStart(2, '0')}</div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
