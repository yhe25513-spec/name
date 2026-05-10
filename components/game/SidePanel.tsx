'use client'

import { GameState } from '@/lib/types'
import { Heart, Package, MapPin, Swords, Star, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface SidePanelProps {
  state: GameState
  turnCount: number
  hasBgImage?: boolean
}

export function SidePanel({ state, turnCount, hasBgImage = false }: SidePanelProps) {
  const hpPercent = Math.round((state.hp / state.maxHp) * 100)
  const hpColor = hpPercent > 60 ? 'bg-emerald-500' : hpPercent > 30 ? 'bg-amber-500' : 'bg-red-500'
  const hpGlow = hpPercent > 60 ? 'shadow-emerald-500/20' : hpPercent > 30 ? 'shadow-amber-500/20' : 'shadow-red-500/20'

  return (
    <div
      className={cn(
        'w-64 flex-shrink-0 border-l flex flex-col',
        hasBgImage ? 'backdrop-blur-md' : 'backdrop-blur-sm',
      )}
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border)',
      }}
    >
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* 生命值 */}
          <div
            className={cn('rounded-xl p-3.5 border shadow-sm', hpGlow)}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border)',
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
                className={cn('h-full rounded-full transition-all duration-700 ease-out', hpColor)}
                style={{ width: `${hpPercent}%` }}
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
              <div className="flex flex-wrap gap-1.5">
                {state.inventory.map((item, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className={cn(
                      'text-[10px] transition-all duration-150 cursor-default',
                      'hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]',
                    )}
                    style={{
                      borderColor: 'var(--border)',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--bg-card)',
                    }}
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* 底部回合标记 */}
          <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center justify-center gap-2">
              <Shield className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
              <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>第 {turnCount} 回合</span>
              <Shield className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
