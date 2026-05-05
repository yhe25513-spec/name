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
  const hpColor = hpPercent > 60 ? 'bg-emerald-500' : hpPercent > 30 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="bg-zinc-900 border-b border-zinc-800">
      {/* 主状态行 */}
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="text-amber-400 font-semibold text-sm truncate flex-1">{scenarioTitle}</span>

        {/* HP */}
        <div className="flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <div className="w-20 h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${hpColor}`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>
          <span className="text-xs text-zinc-300 tabular-nums">{state.hp}/{state.maxHp}</span>
        </div>

        {/* 位置 */}
        {state.location && (
          <div className="hidden sm:flex items-center gap-1 text-xs text-zinc-400">
            <MapPin className="w-3 h-3" />
            <span className="truncate max-w-24">{state.location}</span>
          </div>
        )}

        {/* 展开按钮（移动端） */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* 展开的详细信息 */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-zinc-800/50 pt-2">
          {/* 位置（移动端） */}
          {state.location && (
            <div className="sm:hidden flex items-center gap-1 text-xs text-zinc-400">
              <MapPin className="w-3 h-3" />
              <span>{state.location}</span>
            </div>
          )}

          {/* 属性 */}
          {Object.keys(state.attributes).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(state.attributes).map(([key, val]) => (
                <Badge key={key} variant="outline" className="text-xs border-zinc-600 text-zinc-300 bg-zinc-800/50">
                  {key}: {val}
                </Badge>
              ))}
            </div>
          )}

          {/* 背包 */}
          {state.inventory.length > 0 && (
            <div className="flex items-start gap-2">
              <Package className="w-3.5 h-3.5 text-zinc-500 mt-0.5 flex-shrink-0" />
              <div className="flex flex-wrap gap-1">
                {state.inventory.map((item, i) => (
                  <Badge key={i} variant="secondary" className="text-xs bg-zinc-800 text-zinc-300 border-zinc-700">
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
