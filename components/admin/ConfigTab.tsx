'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Settings, Key, Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

type AIProvider = 'deepseek' | 'openai' | 'anthropic' | 'openrouter' | 'ollama' | 'custom'

interface Config {
  provider: AIProvider
  model: string
  temperature: number
  max_tokens: number
  api_key_display: string
  api_base_url?: string
}

export function ConfigTab() {
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newApiKey, setNewApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [newBaseUrl, setNewBaseUrl] = useState('')

  useEffect(() => { fetchConfig() }, [])

  async function fetchConfig() {
    setLoading(true)
    const res = await fetch('/api/admin/config')
    const data = await res.json()
    setConfig(data.config)
    setLoading(false)
  }

  async function saveConfig() {
    setSaving(true)
    const updates: Record<string, unknown> = {
      provider: config?.provider,
      model: config?.model,
      temperature: config?.temperature,
      max_tokens: config?.max_tokens,
    }
    if (newApiKey.trim()) updates.api_key = newApiKey.trim()
    if (newBaseUrl.trim()) updates.api_base_url = newBaseUrl.trim()

    const res = await fetch('/api/admin/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      toast.success('配置已保存')
      setNewApiKey('')
      setNewBaseUrl('')
      fetchConfig()
    } else {
      const err = await res.json().catch(() => ({ error: '未知错误' }))
      toast.error('保存失败', { description: err.error || `HTTP ${res.status}` })
    }
    setSaving(false)
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>

  return (
    <div className="space-y-6 max-w-xl">
      <h2 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">
        <Settings className="w-5 h-5 text-purple-400" />
        AI 配置
      </h2>

      <Card className="bg-zinc-900 border-zinc-700/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" />
            AI 提供商配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AI提供商选择 */}
          <div>
            <label className="text-sm text-zinc-400 mb-1.5 block">选择 AI 提供商</label>
            <select
              value={config?.provider || 'deepseek'}
              onChange={(e) => {
                const provider = e.target.value as AIProvider
                const defaultModels: Record<AIProvider, string> = {
                  deepseek: 'deepseek-chat',
                  openai: 'gpt-3.5-turbo',
                  anthropic: 'claude-3-haiku-20240307',
                  openrouter: 'meta-llama/llama-3.1-70b-instruct',
                  ollama: 'dolphin-mistral',
                  custom: 'custom-model',
                }
                setConfig(prev => prev ? {
                  ...prev,
                  provider,
                  model: defaultModels[provider]
                } : null)
              }}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-white text-sm"
            >
              <option value="deepseek">DeepSeek（国产，性价比高）</option>
              <option value="openai">OpenAI（GPT系列）</option>
              <option value="anthropic">Anthropic（Claude系列）</option>
              <option value="openrouter">OpenRouter（多模型聚合）</option>
              <option value="ollama">Ollama（本地大模型）</option>
              <option value="custom">自定义（OpenAI兼容格式）</option>
            </select>
          </div>

          {/* 当前API Key显示 */}
          <div>
            <label className="text-sm text-zinc-400 mb-1.5 block">
              当前 API Key
              <span className="text-zinc-500 text-xs ml-2">
                ({config?.provider === 'deepseek' ? 'DeepSeek' :
                  config?.provider === 'openai' ? 'OpenAI' :
                    config?.provider === 'anthropic' ? 'Anthropic' :
                      config?.provider === 'openrouter' ? 'OpenRouter' :
                        config?.provider === 'ollama' ? 'Ollama' : '自定义'})
              </span>
            </label>
            <div className="px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 font-mono">
              {config?.api_key_display || '未配置'}
            </div>
          </div>

          {/* 更新API Key */}
          <div>
            <label className="text-sm text-zinc-400 mb-1.5 block">
              更新 API Key（留空则不修改）
              {config?.provider === 'deepseek' && <span className="text-zinc-500 text-xs ml-1">格式: sk-...</span>}
              {config?.provider === 'openai' && <span className="text-zinc-500 text-xs ml-1">格式: sk-...</span>}
              {config?.provider === 'anthropic' && <span className="text-zinc-500 text-xs ml-1">格式: sk-ant-...</span>}
              {config?.provider === 'openrouter' && <span className="text-zinc-500 text-xs ml-1">格式: sk-or-...</span>}
              {config?.provider === 'ollama' && <span className="text-zinc-500 text-xs ml-1">（本地运行，无需Key）</span>}
            </label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder={
                  config?.provider === 'deepseek' ? 'sk-...' :
                    config?.provider === 'openai' ? 'sk-...' :
                      config?.provider === 'anthropic' ? 'sk-ant-...' :
                        config?.provider === 'openrouter' ? 'sk-or-...' :
                          config?.provider === 'ollama' ? 'ollama（无需填写）' :
                            'your-api-key'
                }
                className="bg-zinc-800 border-zinc-700 text-white font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 自定义API基地址 */}
          {(config?.provider === 'custom' || config?.provider === 'openrouter' || config?.provider === 'ollama') && (
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">
                API 基地址
                {config?.provider === 'ollama' ? (
                  <span className="text-zinc-500 text-xs ml-1">（默认: http://localhost:11434）</span>
                ) : (
                  <span className="text-zinc-500 text-xs ml-1">（OpenAI兼容格式）</span>
                )}
              </label>
              <Input
                value={newBaseUrl}
                onChange={(e) => setNewBaseUrl(e.target.value)}
                placeholder={config?.provider === 'ollama' ? 'http://localhost:11434 或 http://192.168.x.x:11434' : 'https://api.example.com/v1'}
                className="bg-zinc-800 border-zinc-700 text-white font-mono"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-700/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white">模型参数</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-zinc-400 mb-1.5 block">模型</label>
            {config?.provider === 'custom' || config?.provider === 'ollama' ? (
              <Input
                value={config?.model || ''}
                onChange={(e) => config && setConfig({ ...config, model: e.target.value })}
                placeholder={config?.provider === 'ollama' ? '例如：dolphin-mistral、llama3.2、qwen2.5 等' : '例如：gpt-4o-mini、llama-3.1-8b 等'}
                className="bg-zinc-800 border-zinc-700 text-white font-mono"
              />
            ) : (
              <select
                value={config?.model || 'deepseek-chat'}
                onChange={(e) => config && setConfig({ ...config, model: e.target.value })}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-white text-sm"
              >
                {config?.provider === 'deepseek' && (
                  <>
                    <option value="deepseek-chat">deepseek-chat（推荐）</option>
                    <option value="deepseek-reasoner">deepseek-reasoner（推理）</option>
                  </>
                )}
                {config?.provider === 'openai' && (
                  <>
                    <option value="gpt-3.5-turbo">gpt-3.5-turbo（快）</option>
                    <option value="gpt-4">gpt-4（强）</option>
                    <option value="gpt-4-turbo">gpt-4-turbo（均衡）</option>
                    <option value="gpt-4o">gpt-4o（最新）</option>
                  </>
                )}
                {config?.provider === 'anthropic' && (
                  <>
                    <option value="claude-3-haiku-20240307">claude-3-haiku（快）</option>
                    <option value="claude-3-sonnet-20240229">claude-3-sonnet（均衡）</option>
                    <option value="claude-3-opus-20240229">claude-3-opus（强）</option>
                  </>
                )}
                {config?.provider === 'openrouter' && (
                  <>
                    <option value="meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B（推荐）</option>
                    <option value="meta-llama/llama-3.1-8b-instruct">Llama 3.1 8B（快）</option>
                    <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                    <option value="openai/gpt-4o">GPT-4o</option>
                    <option value="google/gemini-pro-1.5">Gemini Pro 1.5</option>
                    <option value="nousresearch/hermes-3-llama-3.1-405b">Hermes 3 405B</option>
                  </>
                )}
              </select>
            )}
          </div>
          <div>
            <label className="text-sm text-zinc-400 mb-1.5 block">
              Temperature：<span className="text-white">{config?.temperature}</span>
              <span className="text-zinc-600 ml-2">（越高越随机，建议 0.7-1.0）</span>
            </label>
            <input
              type="range"
              min="0" max="2" step="0.1"
              value={config?.temperature || 0.8}
              onChange={(e) => config && setConfig({ ...config, temperature: parseFloat(e.target.value) })}
              className="w-full accent-amber-500"
            />
          </div>
          <div>
            <label className="text-sm text-zinc-400 mb-1.5 block">Max Tokens</label>
            <Input
              type="number"
              value={config?.max_tokens || 1024}
              onChange={(e) => config && setConfig({ ...config, max_tokens: parseInt(e.target.value) })}
              className="bg-zinc-800 border-zinc-700 text-white"
              min={256}
              max={4096}
            />
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={saveConfig}
        disabled={saving}
        className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        保存配置
      </Button>
    </div>
  )
}
