'use client'

import { useState, useEffect } from 'react'
import { PlayerStats } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Shield, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-client'

export function PlayersTab() {
  const [players, setPlayers] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchPlayers() }, [])

  async function fetchPlayers() {
    setLoading(true)
    const res = await apiFetch('/api/admin/players')
    const data = await res.json()
    setPlayers(data.players || [])
    setLoading(false)
  }

  async function toggleRole(player: PlayerStats) {
    const newRole = player.role === 'admin' ? 'player' : 'admin'
    if (!confirm(`确认将 ${player.username} 的角色改为 ${newRole}？`)) return

    const res = await apiFetch('/api/admin/players', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: player.id, role: newRole }),
    })
    if (res.ok) {
      toast.success('角色已更新')
      fetchPlayers()
    } else {
      toast.error('更新失败')
    }
  }

  async function deleteUnverifiedUsers() {
    if (!confirm('确认删除所有未验证邮箱的用户？此操作不可撤销！')) return
    
    setDeleting(true)
    const res = await apiFetch('/api/admin/players', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteUnverified: true }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success(data.message)
      fetchPlayers()
    } else {
      toast.error(data.error || '删除失败')
    }
    setDeleting(false)
  }

  function formatDate(ts: string | null) {
    if (!ts) return '从未'
    return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" />
          玩家管理
          {!loading && <span className="text-sm text-zinc-500 font-normal">({players.length} 人)</span>}
        </h2>
        <Button
          variant="destructive"
          size="sm"
          onClick={deleteUnverifiedUsers}
          disabled={deleting}
          className="h-8 text-xs"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          {deleting ? '删除中...' : '删除未验证用户'}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
      ) : (
        <div className="space-y-2">
          {/* 表头 */}
          <div className="hidden md:grid grid-cols-[1fr_80px_80px_120px_120px_100px] gap-4 px-4 py-2 text-xs text-zinc-500 uppercase tracking-wide">
            <span>用户名</span>
            <span>角色</span>
            <span>存档数</span>
            <span>总回合</span>
            <span>最后活跃</span>
            <span>操作</span>
          </div>

          {players.map((player) => (
            <Card key={player.id} className="bg-zinc-900 border-zinc-800">
              <div className="grid md:grid-cols-[1fr_80px_80px_120px_120px_100px] gap-4 items-center px-4 py-3">
                <div>
                  <div className="font-medium text-white text-sm">{player.username}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    注册：{formatDate(player.created_at)}
                  </div>
                </div>
                <div>
                  <Badge variant={player.role === 'admin' ? 'default' : 'outline'}
                    className={player.role === 'admin'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs'
                      : 'border-zinc-700 text-zinc-500 text-xs'}>
                    {player.role === 'admin' ? '管理员' : '玩家'}
                  </Badge>
                </div>
                <div className="text-sm text-zinc-300">{player.save_count}</div>
                <div className="text-sm text-zinc-300">{player.total_turns}</div>
                <div className="text-xs text-zinc-500">{formatDate(player.last_active || null)}</div>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleRole(player)}
                    className="border-zinc-700 text-zinc-400 hover:text-white text-xs h-7"
                  >
                    <Shield className="w-3 h-3 mr-1" />
                    {player.role === 'admin' ? '降级' : '提权'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
