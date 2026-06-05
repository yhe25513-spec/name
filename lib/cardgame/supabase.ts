/**
 * Supabase 客户端 - 使用 Realtime Broadcast 实现实时同步
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export class SupabaseClient {
  private channel: any = null

  // 创建房间
  async createRoom(hostName: string) {
    const roomCode = Math.floor(100000 + Math.random() * 900000).toString()

    const { data, error } = await supabase
      .from('doudizhu_rooms')
      .insert({
        room_code: roomCode,
        host_name: hostName,
        status: 'waiting',
        players: [{ name: hostName, ready: false, index: 0 }],
      })
      .select()
      .single()

    if (error) {
      console.error('创建房间失败:', error)
      return null
    }
    return data
  }

  // 获取房间
  async getRoom(roomCode: string) {
    const { data, error } = await supabase
      .from('doudizhu_rooms')
      .select('*')
      .eq('room_code', roomCode)
      .single()

    if (error) {
      console.error('获取房间失败:', error)
      return null
    }
    return data
  }

  // 加入房间
  async joinRoom(roomCode: string, playerName: string) {
    const room = await this.getRoom(roomCode)
    if (!room) return null

    const players = room.players || []
    if (players.length >= 3) return null

    const existing = players.find((p: any) => p.name === playerName)
    if (existing) return room

    players.push({ name: playerName, ready: false, index: players.length })

    const { error } = await supabase
      .from('doudizhu_rooms')
      .update({ players })
      .eq('room_code', roomCode)

    if (error) {
      console.error('加入房间失败:', error)
      return null
    }
    return await this.getRoom(roomCode)
  }

  // 更新游戏状态
  async updateGameState(roomCode: string, gameState: any) {
    // 先更新数据库
    const { error } = await supabase
      .from('doudizhu_rooms')
      .update({
        game_state: gameState,
        status: gameState.phase === 'finished' ? 'finished' : 'playing',
      })
      .eq('room_code', roomCode)

    if (error) {
      console.error('更新失败:', error)
      return false
    }

    // 同时通过 Broadcast 发送实时更新
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'game-update',
        payload: { state: gameState, roomCode },
      })
      console.log('[Supabase] 已广播游戏更新')
    }

    return true
  }

  // 开始游戏
  async startGame(roomCode: string, gameState: any) {
    const { error } = await supabase
      .from('doudizhu_rooms')
      .update({ status: 'playing', game_state: gameState })
      .eq('room_code', roomCode)

    if (error) return false

    // 广播游戏开始
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'game-start',
        payload: { state: gameState, roomCode },
      })
    }

    return true
  }

  // 订阅房间（使用 Broadcast）
  subscribeRoom(roomCode: string, callbacks: {
    onGameUpdate?: (state: any) => void
    onGameStart?: (state: any) => void
    onPlayerJoin?: (players: any[]) => void
  }) {
    // 先清理旧的
    if (this.channel) {
      supabase.removeChannel(this.channel)
    }

    console.log('[Supabase] 订阅房间:', roomCode)

    this.channel = supabase
      .channel(`room:${roomCode}`)
      .on('broadcast', { event: 'game-update' }, (payload) => {
        console.log('[Supabase] 收到游戏更新:', payload.payload.roomCode)
        if (payload.payload.roomCode === roomCode && callbacks.onGameUpdate) {
          callbacks.onGameUpdate(payload.payload.state)
        }
      })
      .on('broadcast', { event: 'game-start' }, (payload) => {
        console.log('[Supabase] 收到游戏开始:', payload.payload.roomCode)
        if (payload.payload.roomCode === roomCode && callbacks.onGameStart) {
          callbacks.onGameStart(payload.payload.state)
        }
      })
      .on('broadcast', { event: 'player-join' }, (payload) => {
        console.log('[Supabase] 收到玩家加入:', payload.payload.roomCode)
        if (payload.payload.roomCode === roomCode && callbacks.onPlayerJoin) {
          callbacks.onPlayerJoin(payload.payload.players)
        }
      })
      .subscribe((status) => {
        console.log('[Supabase] 订阅状态:', status)
      })

    // 也订阅数据库变化（用于玩家加入通知）
    const dbChannel = supabase
      .channel(`db:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'doudizhu_rooms',
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          console.log('[Supabase] 数据库更新:', payload)
          const newRoom = payload.new as any
          if (newRoom.status === 'playing' && newRoom.game_state && callbacks.onGameStart) {
            callbacks.onGameStart(newRoom.game_state)
          }
          if (newRoom.players && callbacks.onPlayerJoin) {
            callbacks.onPlayerJoin(newRoom.players)
          }
        }
      )
      .subscribe()

    return () => {
      if (this.channel) {
        supabase.removeChannel(this.channel)
        this.channel = null
      }
      supabase.removeChannel(dbChannel)
    }
  }

  // 广播玩家加入
  broadcastPlayerJoin(roomCode: string, players: any[]) {
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'player-join',
        payload: { players, roomCode },
      })
    }
  }

  // 离开房间
  async leaveRoom(roomCode: string, playerName: string) {
    const room = await this.getRoom(roomCode)
    if (!room) return

    const players = (room.players || []).filter((p: any) => p.name !== playerName)

    if (players.length === 0) {
      await supabase.from('doudizhu_rooms').delete().eq('room_code', roomCode)
    } else {
      await supabase.from('doudizhu_rooms').update({ players }).eq('room_code', roomCode)
    }

    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'player-join',
        payload: { players, roomCode },
      })
    }
  }
}
