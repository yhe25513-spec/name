'use client'

import { useRef, useCallback, useEffect, useState } from 'react'

type Atmosphere = 'normal' | 'danger' | 'mystery' | 'triumph'

interface SoundState {
  isMuted: boolean
  volume: number
}

// ─── Web Audio API 程序化音效 ───

class AudioEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private bgmNodes: OscillatorNode[] = []
  private bgmGain: GainNode | null = null
  private currentAtmosphere: Atmosphere = 'normal'
  private volume = 0.3
  private isMuted = false

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume
      this.masterGain.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return this.ctx
  }

  private getMasterGain(): GainNode {
    this.getContext()
    return this.masterGain!
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v))
    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : this.volume
    }
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted
    this.setMuted(this.isMuted)
    return this.isMuted
  }

  /** 生成一个简单的音效 */
  playBeep(frequency = 440, duration = 0.1, type: OscillatorType = 'sine', volume = 0.15) {
    try {
      const ctx = this.getContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.value = frequency
      gain.gain.value = volume
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(this.getMasterGain())
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch {
      // 静默失败
    }
  }

  playClick() { this.playBeep(800, 0.05, 'square', 0.05) }
  playSaveSuccess() { this.playBeep(523, 0.15, 'sine', 0.1); setTimeout(() => this.playBeep(659, 0.15, 'sine', 0.1), 150) }
  playSendMessage() { this.playBeep(440, 0.03, 'sine', 0.03) }
  playDangerHit() { this.playBeep(150, 0.3, 'sawtooth', 0.1) }
  playTriumph() { this.playBeep(523, 0.1, 'sine', 0.1); setTimeout(() => this.playBeep(659, 0.1, 'sine', 0.1), 100); setTimeout(() => this.playBeep(784, 0.2, 'sine', 0.12), 200) }

  /** BGM 切换 */
  setAtmosphere(atmo: Atmosphere) {
    if (atmo === this.currentAtmosphere) return
    this.currentAtmosphere = atmo
    this.stopBGM()
    this.startBGM(atmo)
  }

  private startBGM(atmo: Atmosphere) {
    try {
      const ctx = this.getContext()
      const masterGain = this.getMasterGain()

      // BGM 总音量控制
      this.bgmGain = ctx.createGain()
      this.bgmGain.gain.value = 0.08
      this.bgmGain.connect(masterGain)

      const bgmGain = this.bgmGain

      switch (atmo) {
        case 'normal': {
          // 平静氛围：柔和的高频垫音
          const osc1 = ctx.createOscillator()
          osc1.type = 'sine'
          osc1.frequency.value = 220
          const gain1 = ctx.createGain()
          gain1.gain.value = 0.06
          osc1.connect(gain1)
          gain1.connect(bgmGain)
          osc1.start()
          this.bgmNodes.push(osc1)

          // 低频脉冲
          const osc2 = ctx.createOscillator()
          osc2.type = 'sine'
          osc2.frequency.value = 110
          const gain2 = ctx.createGain()
          gain2.gain.value = 0.03
          const lfo = ctx.createOscillator()
          lfo.frequency.value = 0.2
          const lfoGain = ctx.createGain()
          lfoGain.gain.value = 0.02
          lfo.connect(lfoGain)
          lfoGain.connect(gain2.gain)
          osc2.connect(gain2)
          gain2.connect(bgmGain)
          osc2.start()
          lfo.start()
          this.bgmNodes.push(osc2, lfo)
          break
        }
        case 'danger': {
          // 紧张：低频嗡鸣 + 不安的颤音
          const osc1 = ctx.createOscillator()
          osc1.type = 'sawtooth'
          osc1.frequency.value = 80
          const gain1 = ctx.createGain()
          gain1.gain.value = 0.05
          osc1.connect(gain1)
          gain1.connect(bgmGain)
          osc1.start()
          this.bgmNodes.push(osc1)

          // 颤音
          const osc2 = ctx.createOscillator()
          osc2.type = 'square'
          osc2.frequency.value = 200
          const gain2 = ctx.createGain()
          gain2.gain.value = 0.02
          const lfo = ctx.createOscillator()
          lfo.frequency.value = 4
          const lfoGain = ctx.createGain()
          lfoGain.gain.value = 0.015
          lfo.connect(lfoGain)
          lfoGain.connect(gain2.gain)
          osc2.connect(gain2)
          gain2.connect(bgmGain)
          osc2.start()
          lfo.start()
          this.bgmNodes.push(osc2, lfo)
          break
        }
        case 'mystery': {
          // 神秘：空灵的高频 + 滑音
          const osc1 = ctx.createOscillator()
          osc1.type = 'sine'
          osc1.frequency.value = 440
          const gain1 = ctx.createGain()
          gain1.gain.value = 0.04
          const lfo = ctx.createOscillator()
          lfo.frequency.value = 0.5
          const lfoGain = ctx.createGain()
          lfoGain.gain.value = 40
          lfo.connect(lfoGain)
          lfoGain.connect(osc1.frequency)
          osc1.connect(gain1)
          gain1.connect(bgmGain)
          osc1.start()
          lfo.start()
          this.bgmNodes.push(osc1, lfo)

          // 粉红噪声模拟风声（用多个振荡器）
          const osc2 = ctx.createOscillator()
          osc2.type = 'triangle'
          osc2.frequency.value = 3000
          const gain2 = ctx.createGain()
          gain2.gain.value = 0.015
          const lfo2 = ctx.createOscillator()
          lfo2.frequency.value = 3
          const lfoGain2 = ctx.createGain()
          lfoGain2.gain.value = 0.01
          lfo2.connect(lfoGain2)
          lfoGain2.connect(gain2.gain)
          osc2.connect(gain2)
          gain2.connect(bgmGain)
          osc2.start()
          lfo2.start()
          this.bgmNodes.push(osc2, lfo2)
          break
        }
        case 'triumph': {
          // 凯旋：明亮的和弦
          const notes = [262, 330, 392, 523] // C E G C
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator()
            osc.type = 'sine'
            osc.frequency.value = freq
            const gain = ctx.createGain()
            gain.gain.value = 0.04 / notes.length
            // 每个音符错开相位
            const lfo = ctx.createOscillator()
            lfo.frequency.value = 0.1 + i * 0.05
            const lfoG = ctx.createGain()
            lfoG.gain.value = 0.02
            lfo.connect(lfoG)
            lfoG.connect(gain.gain)
            osc.connect(gain)
            gain.connect(bgmGain)
            osc.start()
            lfo.start()
            this.bgmNodes.push(osc, lfo)
          })
          break
        }
      }
    } catch {
      // Web Audio API 不可用，静默
    }
  }

  private stopBGM() {
    this.bgmNodes.forEach(n => {
      try { n.stop() } catch { /* 已停止 */ }
    })
    this.bgmNodes = []
    this.bgmGain = null
  }

  dispose() {
    this.stopBGM()
    if (this.ctx) {
      this.ctx.close()
      this.ctx = null
    }
  }
}

// ─── React Hook ───

let globalEngine: AudioEngine | null = null

function getEngine(): AudioEngine {
  if (!globalEngine) {
    globalEngine = new AudioEngine()
  }
  return globalEngine
}

export function useSound() {
  const [soundState, setSoundState] = useState<SoundState>({ isMuted: false, volume: 0.3 })
  const engineRef = useRef<AudioEngine>(getEngine())
  const lastAtmoRef = useRef<Atmosphere>('normal')

  // BGM 随氛围切换
  const setAtmosphere = useCallback((atmo: Atmosphere) => {
    if (atmo === lastAtmoRef.current) return
    lastAtmoRef.current = atmo
    engineRef.current.setAtmosphere(atmo)
  }, [])

  // 音效
  const playClick = useCallback(() => engineRef.current.playClick(), [])
  const playSaveSuccess = useCallback(() => engineRef.current.playSaveSuccess(), [])
  const playSendMessage = useCallback(() => engineRef.current.playSendMessage(), [])
  const playDangerHit = useCallback(() => engineRef.current.playDangerHit(), [])
  const playTriumph = useCallback(() => engineRef.current.playTriumph(), [])

  // 音量控制
  const setVolume = useCallback((v: number) => {
    engineRef.current.setVolume(v)
    setSoundState(prev => ({ ...prev, volume: v }))
  }, [])

  const toggleMute = useCallback(() => {
    const muted = engineRef.current.toggleMute()
    setSoundState(prev => ({ ...prev, isMuted: muted }))
    return muted
  }, [])

  // 清理
  useEffect(() => {
    return () => {
      // 不 dispose global engine（其他组件可能还在用）
    }
  }, [])

  // 首次点击页面时激活 AudioContext
  useEffect(() => {
    const handler = () => {
      try { engineRef.current.setAtmosphere(lastAtmoRef.current) } catch { /* ignore */ }
    }
    document.addEventListener('click', handler, { once: true })
    return () => document.removeEventListener('click', handler)
  }, [])

  return {
    ...soundState,
    setAtmosphere,
    setVolume,
    toggleMute,
    playClick,
    playSaveSuccess,
    playSendMessage,
    playDangerHit,
    playTriumph,
  }
}
