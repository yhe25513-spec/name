'use client'

import { useState, useEffect } from 'react'
import { Gamepad2, Key, Save, Check } from 'lucide-react'

export function CardGameTab() {
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showKey, setShowKey] = useState(false)

  // 从服务器读取 API Key
  useEffect(() => {
    fetch('/api/admin/cardgame-config')
      .then(r => r.json())
      .then(data => {
        setApiKey(data.apiKey || '')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    const res = await fetch('/api/admin/cardgame-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    })
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Gamepad2 className="w-5 h-5 text-amber-400" />
        <h2 className="text-lg font-bold">斗地主 AI 配置</h2>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Key className="w-4 h-4 text-green-400" />
          <h3 className="font-medium">DeepSeek API Key</h3>
        </div>
        <p className="text-sm text-zinc-400 mb-3">
          配置后所有玩家的 AI 对局都将使用此 API，AI 会变得更聪明
        </p>
        <div className="flex gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm focus:ring-2 focus:ring-amber-400 outline-none"
          />
          <button onClick={() => setShowKey(!showKey)}
            className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm">
            {showKey ? '隐藏' : '显示'}
          </button>
          <button onClick={handleSave}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-sm font-medium flex items-center gap-1">
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? '已保存' : '保存'}
          </button>
        </div>
        {apiKey ? (
          <p className="text-xs text-green-400 mt-2">✅ API 已配置，AI 使用 DeepSeek 模型</p>
        ) : (
          <p className="text-xs text-yellow-400 mt-2">⚠️ 未配置，AI 使用本地规则引擎</p>
        )}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <h3 className="font-medium mb-2">说明</h3>
        <div className="text-sm text-zinc-400 space-y-1">
          <p>• 配置一次，所有玩家的 AI 对局都会使用</p>
          <p>• 有 API：AI 分析手牌、算牌、计算胜率</p>
          <p>• 无 API：AI 使用本地规则，出牌较简单</p>
        </div>
      </div>
    </div>
  )
}
