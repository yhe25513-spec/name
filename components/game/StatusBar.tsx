'use client'

import { GameState } from '@/lib/types'
import { Heart, Package, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'

interface StatusBarProps {
  state: GameState
  scenarioTitle: string
}

export function StatusBar({ state, scenarioTitle }: StatusBarProps) {
  const [expanded, setExpanded] = useState(false)
  const hpPercent = Math.round((state.hp / state.maxHp) * 100)

  return (
    <div style={{
      backgroundColor: 'var(--glass-bg)',
      backdropFilter: 'blur(var(--glass-blur, 20px))',
      WebkitBackdropFilter: 'blur(var(--glass-blur, 20px))',
      borderBottom: '1px solid var(--glass-border)',
    }}>
      {/* 主状态行 */}
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="text-sm font-semibold truncate flex-1" style={{ color: 'var(--accent)' }}>{scenarioTitle}</span>

        {/* HP */}
        <div className="flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <div className="w-20 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${hpPercent}%`,
                background: 'var(--hp-bar-fill, var(--accent))',
              }}
            />
          </div>
          <span className="text-xs tabular-nums font-medium" style={{ color: 'var(--text-secondary)' }}>{state.hp}/{state.maxHp}</span>
        </div>

        {/* 位置 */}
        {state.location && (
          <div className="hidden sm:flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            <MapPin className="w-3 h-3" />
            <span className="truncate max-w-24">{state.location}</span>
          </div>
        )}

        {/* 展开按钮（移动端） */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="transition-colors active:scale-90"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* 展开的详细信息 */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          {/* 位置（移动端） */}
          {state.location && (
            <div className="sm:hidden flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              <MapPin className="w-3 h-3" />
              <span>{state.location}</span>
            </div>
          )}

          {/* 属性 */}
          {Object.keys(state.attributes).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(state.attributes).map(([key, val]) => (
                <Badge key={key} variant="outline" className="text-xs"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-card)',
                  }}>
                  {key}: {val}
                </Badge>
              ))}
            </div>
          )}

          {/* 背包 */}
          {state.inventory.length > 0 && (
            <div className="flex items-start gap-2">
              <Package className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
              <div className="flex flex-wrap gap-1">
                {state.inventory.map((item, i) => (
                  <Badge key={i} variant="secondary" className="text-xs"
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-secondary)',
                      borderColor: 'var(--border)',
                    }}>
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
