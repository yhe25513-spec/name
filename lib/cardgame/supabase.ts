/**
 * Supabase 客户端 - 用于多人联机
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Supabase 客户端
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export class SupabaseClient {
  // 创建房间
  async createRoom(hostName: string) {
    // 生成6位数字房间号
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
    // 先获取房间
    const room = await this.getRoom(roomCode)
    if (!room) return null

    const players = room.players || []
    if (players.length >= 3) return null

    // 检查是否已存在
    const existing = players.find((p: any) => p.name === playerName)
    if (existing) return room // 重连

    // 添加玩家
    players.push({
      name: playerName,
      ready: false,
      index: players.length,
    })

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

  // 离开房间
  async leaveRoom(roomCode: string, playerName: string) {
    const room = await this.getRoom(roomCode)
    if (!room) return

    const players = (room.players || []).filter((p: any) => p.name !== playerName)

    if (players.length === 0) {
      // 房间空了，删除
      await supabase
        .from('doudizhu_rooms')
        .delete()
        .eq('room_code', roomCode)
    } else {
      await supabase
        .from('doudizhu_rooms')
        .update({ players })
        .eq('room_code', roomCode)
    }
  }

  // 更新游戏状态
  async updateGameState(roomCode: string, gameState: any) {
    const { error } = await supabase
      .from('doudizhu_rooms')
      .update({
        game_state: gameState,
        status: gameState.phase === 'finished' ? 'finished' : 'playing',
      })
      .eq('room_code', roomCode)

    if (error) {
      console.error('更新游戏状态失败:', error)
      return false
    }

    return true
  }

  // 开始游戏
  async startGame(roomCode: string, gameState: any) {
    const { error } = await supabase
      .from('doudizhu_rooms')
      .update({
        status: 'playing',
        game_state: gameState,
      })
      .eq('room_code', roomCode)

    if (error) {
      console.error('开始游戏失败:', error)
      return false
    }

    return true
  }

  // 订阅房间变化
  subscribeRoom(roomCode: string, callback: (room: any) => void) {
    const channel = supabase
      .channel(`room:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'doudizhu_rooms',
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          callback(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }
}
