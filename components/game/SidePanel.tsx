'use client'

import { GameState } from '@/lib/types'
import { Heart, Package, MapPin, Swords, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

interface SidePanelProps {
  state: GameState
  turnCount: number
}

export function SidePanel({ state, turnCount }: SidePanelProps) {
  const hpPercent = Math.round((state.hp / state.maxHp) * 100)
  const hpColor = hpPercent > 60 ? 'bg-emerald-500' : hpPercent > 30 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="w-64 flex-shrink-0 border-l border-zinc-800 bg-zinc-900/50 flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* 生命值 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-red-400" />
              <span className="text-xs font-medium text-zinc-300">生命值</span>
              <span className="text-xs text-zinc-500 ml-auto">{state.hp}/{state.maxHp}</span>
            </div>
            <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${hpColor}`}
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>

          <Separator className="bg-zinc-800" />

          {/* 位置 */}
          {state.location && (
            <>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-medium text-zinc-300">当前位置</span>
                </div>
                <p className="text-sm text-zinc-200 pl-6">{state.location}</p>
              </div>
              <Separator className="bg-zinc-800" />
            </>
          )}

          {/* 属性 */}
          {Object.keys(state.attributes).length > 0 && (
            <>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-medium text-zinc-300">属性</span>
                </div>
                <div className="space-y-1.5 pl-1">
                  {Object.entries(state.attributes).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">{key}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full"
                            style={{ width: `${Math.min(100, (val as number) * 10)}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-300 tabular-nums w-4 text-right">{val as number}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Separator className="bg-zinc-800" />
            </>
          )}

          {/* 背包 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-zinc-300">背包</span>
              <span className="text-xs text-zinc-600 ml-auto">{state.inventory.length} 件</span>
            </div>
            {state.inventory.length === 0 ? (
              <p className="text-xs text-zinc-600 pl-6">空</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 pl-1">
                {state.inventory.map((item, i) => (
                  <Badge key={i} variant="outline" className="text-xs border-zinc-700 text-zinc-300 bg-zinc-800/70">
                    {item}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Separator className="bg-zinc-800" />

          {/* 回合数 */}
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-zinc-500" />
            <span className="text-xs text-zinc-500">第 {turnCount} 回合</span>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
