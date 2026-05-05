'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Edit2, Key, Check, X, Server, Star } from 'lucide-react'
import { toast } from 'sonner'

interface AIConfig {
  id: string
  name: string
  provider: 'deepseek' | 'openai' | 'anthropic' | 'openrouter' | 'custom'
  model: string
  api_key: string
  api_base_url?: string
  temperature: number
  max_tokens: number
  is_default: boolean
}

type AIProvider = AIConfig['provider']

const PROVIDER_LABELS: Record<AIProvider, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
  custom: '自定义',
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  deepseek: 'deepseek-chat',
  openai: 'gpt-3.5-turbo',
  anthropic: 'claude-3-sonnet-20240229',
  openrouter: 'meta-llama/llama-3.1-70b-instruct',
  custom: 'custom-model',
}

export function AIConfigsTab() {
  const [configs, setConfigs] = useState<AIConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})

  // 表单状态
  const [form, setForm] = useState<Partial<AIConfig>>({
    provider: 'custom',
    temperature: 0.8,
    max_tokens: 1024,
  })

  useEffect(() => { fetchConfigs() }, [])

  async function fetchConfigs() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/ai-configs')
      const data = await res.json()
      if (res.ok) {
        setConfigs(data.configs || [])
      } else {
        toast.error('获取配置失败', { description: data.error })
      }
    } catch {
      toast.error('获取配置失败')
    }
    setLoading(false)
  }

  function startCreate() {
    setIsCreating(true)
    setEditingId(null)
    setForm({
      name: '',
      provider: 'custom',
      model: '',
      api_key: '',
      api_base_url: '',
      temperature: 0.8,
      max_tokens: 1024,
      is_default: false,
    })
  }

  function startEdit(config: AIConfig) {
    setEditingId(config.id)
    setIsCreating(false)
    setForm({ ...config })
  }

  function cancelEdit() {
    setEditingId(null)
    setIsCreating(false)
    setForm({ provider: 'custom', temperature: 0.8, max_tokens: 1024 })
  }

  async function saveConfig() {
    if (!form.name?.trim()) {
      toast.error('请输入配置名称')
      return
    }

    const isNew = isCreating
    const url = '/api/admin/ai-configs'
    const method = isNew ? 'POST' : 'PATCH'
    const body = isNew ? form : { ...form, id: editingId }

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(isNew ? '配置已创建' : '配置已更新')
        fetchConfigs()
        cancelEdit()
      } else {
        toast.error('保存失败', { description: data.error })
      }
    } catch {
      toast.error('保存失败')
    }
  }

  async function deleteConfig(id: string) {
    if (!confirm('确定要删除这个配置吗？')) return
    try {
      const res = await fetch(`/api/admin/ai-configs?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('配置已删除')
        fetchConfigs()
      } else {
        const data = await res.json()
        toast.error('删除失败', { description: data.error })
      }
    } catch {
      toast.error('删除失败')
    }
  }

  async function setDefault(id: string) {
    try {
      const res = await fetch('/api/admin/ai-configs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_default: true }),
      })
      if (res.ok) {
        toast.success('已设为默认配置')
        fetchConfigs()
      } else {
        const data = await res.json()
        toast.error('设置失败', { description: data.error })
      }
    } catch {
      toast.error('设置失败')
    }
  }

  function handleProviderChange(provider: AIProvider) {
    setForm(prev => ({
      ...prev,
      provider,
      model: DEFAULT_MODELS[provider],
    }))
  }

  const editForm = (
    <Card className="bg-zinc-900 border-zinc-800 mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-zinc-200">
          {isCreating ? '创建新配置' : '编辑配置'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 名称 */}
        <div>
          <label className="text-sm text-zinc-400 mb-1.5 block">配置名称</label>
          <Input
            value={form.name || ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="例如：OpenRouter-Llama、GPT4Novel等"
            className="bg-zinc-800 border-zinc-700 text-white"
          />
        </div>

        {/* 提供商 */}
        <div>
          <label className="text-sm text-zinc-400 mb-1.5 block">AI 提供商</label>
          <select
            value={form.provider || 'custom'}
            onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
            className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-white text-sm"
          >
            <option value="deepseek">DeepSeek</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="openrouter">OpenRouter</option>
            <option value="custom">自定义（OpenAI兼容）</option>
          </select>
        </div>

        {/* 模型 */}
        <div>
          <label className="text-sm text-zinc-400 mb-1.5 block">模型</label>
          {form.provider === 'custom' ? (
            <Input
              value={form.model || ''}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="输入模型名称"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          ) : (
            <select
              value={form.model || ''}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-white text-sm"
            >
              {form.provider === 'deepseek' && (
                <>
                  <option value="deepseek-chat">deepseek-chat</option>
                  <option value="deepseek-reasoner">deepseek-reasoner</option>
                </>
              )}
              {form.provider === 'openai' && (
                <>
                  <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                  <option value="gpt-4">gpt-4</option>
                  <option value="gpt-4-turbo">gpt-4-turbo</option>
                  <option value="gpt-4o">gpt-4o</option>
                </>
              )}
              {form.provider === 'anthropic' && (
                <>
                  <option value="claude-3-haiku-20240307">claude-3-haiku</option>
                  <option value="claude-3-sonnet-20240229">claude-3-sonnet</option>
                  <option value="claude-3-opus-20240229">claude-3-opus</option>
                </>
              )}
              {form.provider === 'openrouter' && (
                <>
                  <option value="meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B</option>
                  <option value="meta-llama/llama-3.1-8b-instruct">Llama 3.1 8B</option>
                  <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="openai/gpt-4o">GPT-4o</option>
                  <option value="nousresearch/hermes-3-llama-3.1-405b">Hermes 3 405B</option>
                </>
              )}
            </select>
          )}
        </div>

        {/* API Key */}
        <div>
          <label className="text-sm text-zinc-400 mb-1.5 block">API Key</label>
          <Input
            type={showKey[editingId || 'new'] ? 'text' : 'password'}
            value={form.api_key || ''}
            onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            placeholder="sk-..."
            className="bg-zinc-800 border-zinc-700 text-white font-mono"
          />
        </div>

        {/* API 基地址（可选） */}
        <div>
          <label className="text-sm text-zinc-400 mb-1.5 block">
            API 基地址
            <span className="text-zinc-500 text-xs ml-1">（可选，留空使用默认）</span>
          </label>
          <Input
            value={form.api_base_url || ''}
            onChange={(e) => setForm({ ...form, api_base_url: e.target.value })}
            placeholder={form.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.example.com/v1'}
            className="bg-zinc-800 border-zinc-700 text-white font-mono text-xs"
          />
        </div>

        {/* Temperature & Max Tokens */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-zinc-400 mb-1.5 block">
              Temperature: <span className="text-white">{form.temperature}</span>
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={form.temperature ?? 0.8}
              onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })}
              className="w-full accent-amber-500"
            />
          </div>
          <div>
            <label className="text-sm text-zinc-400 mb-1.5 block">Max Tokens</label>
            <Input
              type="number"
              value={form.max_tokens ?? 1024}
              onChange={(e) => setForm({ ...form, max_tokens: parseInt(e.target.value) })}
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
        </div>

        {/* 默认配置 */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_default"
            checked={form.is_default || false}
            onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
            className="accent-amber-500"
          />
          <label htmlFor="is_default" className="text-sm text-zinc-400">设为默认配置</label>
        </div>

        {/* 按钮 */}
        <div className="flex gap-2 pt-2">
          <Button onClick={saveConfig} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            <Check className="w-4 h-4 mr-1.5" />
            保存
          </Button>
          <Button onClick={cancelEdit} variant="outline" className="border-zinc-700 text-zinc-300">
            <X className="w-4 h-4 mr-1.5" />
            取消
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  if (loading) return <div className="text-zinc-500">加载中...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-200">AI 配置管理</h2>
          <p className="text-sm text-zinc-500">管理多个 AI API 配置，为不同场景分配不同 API</p>
        </div>
        <Button onClick={startCreate} disabled={isCreating || !!editingId} className="bg-emerald-600 hover:bg-emerald-500 text-white">
          <Plus className="w-4 h-4 mr-1.5" />
          新建配置
        </Button>
      </div>

      {(isCreating || editingId) && editForm}

      <div className="grid gap-3">
        {configs.map((config) => (
          <Card key={config.id} className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-200">{config.name}</span>
                    {config.is_default && (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                        <Star className="w-3 h-3 mr-1" />
                        默认
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                      {PROVIDER_LABELS[config.provider]}
                    </Badge>
                  </div>
                  <div className="text-sm text-zinc-500 space-y-0.5">
                    <div>模型: {config.model}</div>
                    <div className="flex items-center gap-2">
                      <Key className="w-3 h-3" />
                      <span className="font-mono">{config.api_key ? config.api_key.slice(0, 8) + '...' : '未设置'}</span>
                    </div>
                    {config.api_base_url && (
                      <div className="flex items-center gap-2">
                        <Server className="w-3 h-3" />
                        <span className="font-mono text-xs">{config.api_base_url}</span>
                      </div>
                    )}
                    <div>Temp: {config.temperature} | MaxTokens: {config.max_tokens}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {!config.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDefault(config.id)}
                      className="text-zinc-500 hover:text-amber-400"
                      title="设为默认"
                    >
                      <Star className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(config)}
                    disabled={isCreating || !!editingId}
                    className="text-zinc-500 hover:text-white"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteConfig(config.id)}
                    disabled={isCreating || !!editingId}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {configs.length === 0 && !isCreating && (
          <div className="text-center py-8 text-zinc-500">
            暂无配置，点击"新建配置"创建
          </div>
        )}
      </div>
    </div>
  )
}
