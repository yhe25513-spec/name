'use client'

import { useMemo } from 'react'
import type { GameState } from '@/lib/types'

interface GameMapProps {
  state: GameState
}

// 预设地点坐标（根据常用修仙地名）
const DEFAULT_COORDS: Record<string, { x: number; y: number }> = {
  '起点': { x: 50, y: 80 },
  '山门': { x: 50, y: 65 },
  '练功房': { x: 20, y: 45 },
  '藏经阁': { x: 50, y: 30 },
  '炼丹房': { x: 30, y: 55 },
  '演武场': { x: 70, y: 50 },
  '后山': { x: 20, y: 70 },
  '秘境': { x: 80, y: 35 },
  '坊市': { x: 70, y: 65 },
  '灵脉': { x: 35, y: 20 },
  '洞府': { x: 50, y: 50 },
  '大殿': { x: 50, y: 40 },
  '药园': { x: 25, y: 60 },
  '禁地': { x: 80, y: 20 },
  '传送阵': { x: 65, y: 45 },
}

// 生成稳定的随机位置
function hashCoord(seed: string, index: number): { x: number; y: number } {
  let hash = 0
  const str = seed + index
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return {
    x: 15 + (Math.abs(hash) % 70),
    y: 15 + (Math.abs(hash >> 1) % 70),
  }
}

export function GameMap({ state }: GameMapProps) {
  const currentLocation = state.location || '起点'
  const visitedRaw = state.flags?.visitedLocations

  // 已访问地点列表
  const visited: string[] = useMemo(() => {
    if (Array.isArray(visitedRaw)) return visitedRaw as string[]
    // 至少包含当前位置
    const locs = [currentLocation]
    // 如果有被记录的 flags 中的地点，加入
    return locs
  }, [visitedRaw, currentLocation])

  // 去重
  const allLocations = useMemo(() => {
    const set = new Set([...visited, currentLocation])
    return Array.from(set)
  }, [visited, currentLocation])

  if (allLocations.length <= 1) {
    return (
      <div className="text-center py-6">
        <div className="text-lg mb-2">🗺️</div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {currentLocation || '未知之地'}
        </p>
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
          继续冒险以探索更多地点
        </p>
      </div>
    )
  }

  return (
    <div className="relative w-full" style={{ aspectRatio: '4/3' }}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* 连线 */}
        {allLocations.map((loc, i) => {
          if (i === 0) return null
          const prev = allLocations[i - 1]
          const from = DEFAULT_COORDS[prev] || hashCoord(prev, i - 1)
          const to = DEFAULT_COORDS[loc] || hashCoord(loc, i)
          return (
            <line
              key={`line-${prev}-${loc}`}
              x1={from.x} y1={from.y}
              x2={to.x} y2={to.y}
              stroke="rgba(20,241,198,0.15)"
              strokeWidth="0.8"
              strokeDasharray="2,2"
            />
          )
        })}

        {/* 节点 */}
        {allLocations.map((loc, i) => {
          const coord = DEFAULT_COORDS[loc] || hashCoord(loc, i)
          const isCurrent = loc === currentLocation
          const r = isCurrent ? 4 : 3
          return (
            <g key={loc}>
              {/* 辉光 */}
              {isCurrent && (
                <circle
                  cx={coord.x} cy={coord.y} r={r + 3}
                  fill="none"
                  stroke="rgba(20,241,198,0.3)"
                  strokeWidth="0.5"
                >
                  <animate
                    attributeName="r"
                    from={r + 2} to={r + 5}
                    dur="2s" repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    from="0.6" to="0"
                    dur="2s" repeatCount="indefinite"
                  />
                </circle>
              )}
              {/* 节点 */}
              <circle
                cx={coord.x} cy={coord.y} r={r}
                fill={isCurrent ? '#14f1c6' : 'rgba(148,163,184,0.3)'}
                stroke={isCurrent ? '#14f1c6' : 'rgba(148,163,184,0.2)'}
                strokeWidth={isCurrent ? 1 : 0.5}
              />
              {/* 标签 */}
              <text
                x={coord.x} y={coord.y + r + 3}
                textAnchor="middle"
                fontSize="2.5"
                fill={isCurrent ? '#14f1c6' : '#94a3b8'}
                fontWeight={isCurrent ? 'bold' : 'normal'}
              >
                {loc}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
