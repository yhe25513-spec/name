'use client'

import { useState, useEffect } from 'react'
import { Settings, Check, AlertCircle, Eye, EyeOff, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface AISettings {
  provider: string
  apiKey: string
  baseUrl: string
  model: string
}

const PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'], defaultUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat' },
  { id: 'openai', name: 'OpenAI', models: ['gpt-5', 'gpt-5-mini', 'gpt-4o', 'gpt-4o-mini', 'o4-mini', 'o3'], defaultUrl: 'https://api.openai.com', defaultModel: 'gpt-4o-mini' },
  { id: 'anthropic', name: 'Anthropic (Claude)', models: ['claude-opus-4', 'claude-sonnet-4', 'claude-haiku-3-5'], defaultUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4' },
  { id: 'google', name: 'Google Gemini', models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'], defaultUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-2.5-flash' },
  { id: 'moonshot', name: '月之暗面 (Kimi)', models: ['kimi-latest', 'kimi-k2-0711-preview', 'moonshot-v1-8k', 'moonshot-v1-128k'], defaultUrl: 'https://api.moonshot.cn/v1', defaultModel: 'kimi-latest' },
  { id: 'zhipu', name: '智谱 AI (GLM)', models: ['glm-4-plus', 'glm-z1', 'glm-4-flash'], defaultUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-plus' },
  { id: 'qwen', name: '通义千问 (Qwen)', models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'Qwen3-32B'], defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-turbo' },
  { id: 'siliconflow', name: '硅基流动', models: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct'], defaultUrl: 'https://api.siliconflow.cn/v1', defaultModel: 'deepseek-ai/DeepSeek-V3' },
  { id: 'xiaomi', name: '小米 MiMo', models: ['xiaomi/MiMo-7B'], defaultUrl: 'https://api.siliconflow.cn/v1', defaultModel: 'xiaomi/MiMo-7B' },
  { id: 'ollama', name: 'Ollama (本地)', models: ['qwen2', 'llama3', 'mistral'], defaultUrl: 'http://localhost:11434/v1', defaultModel: 'qwen2' },
]

const STORAGE_KEY = 'novel-studio-ai-settings'

function loadSettings(): AISettings {
  if (typeof window === 'undefined') return { provider: 'deepseek', apiKey: '', baseUrl: '', model: '' }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return { provider: 'deepseek', apiKey: '', baseUrl: '', model: '' }
}

function saveSettings(settings: AISettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function getAISettings(): AISettings {
  return loadSettings()
}

export default function APISettings({ onClose }: { onClose?: () => void }) {
  const [settings, setSettings] = useState<AISettings>(loadSettings)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  const currentProvider = PROVIDERS.find(p => p.id === settings.provider) || PROVIDERS[0]

  const updateProvider = (providerId: string) => {
    const p = PROVIDERS.find(pr => pr.id === providerId) || PROVIDERS[0]
    setSettings({
      provider: providerId,
      apiKey: settings.apiKey,
      baseUrl: p.defaultUrl,
      model: p.defaultModel,
    })
  }

  const testConnection = async () => {
    if (!settings.apiKey && settings.provider !== 'ollama') {
      toast.error('请先填写 API Key')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/novel/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (data.ok) {
        setTestResult('success')
        toast.success('连接成功！')
      } else {
        setTestResult('error')
        toast.error(`连接失败: ${data.error}`)
      }
    } catch (e: any) {
      setTestResult('error')
      toast.error(`测试失败: ${e.message}`)
    }
    setTesting(false)
  }

  const handleSave = () => {
    saveSettings(settings)
    toast.success('API 配置已保存')
    onClose?.()
  }

  return (
    <div className="space-y-5">
      {/* 提供商选择 */}
      <div>
        <label className="text-xs font-semibold mb-2 block" style={{ color: '#f7f8f8' }}>AI 提供商</label>
        <div className="grid grid-cols-2 gap-2">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => updateProvider(p.id)}
              className="px-3 py-2 rounded-lg text-xs border text-left transition-all"
              style={settings.provider === p.id
                ? { backgroundColor: '#5e6ad2', borderColor: '#5e6ad2', color: 'white' }
                : { borderColor: '#23252a', color: '#d0d6e0' }
              }
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* API Key */}
      {settings.provider !== 'ollama' && (
        <div>
          <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#f7f8f8' }}>API Key</label>
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              value={settings.apiKey}
              onChange={e => setSettings({ ...settings, apiKey: e.target.value })}
              placeholder="sk-..."
              style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8', paddingRight: '2.5rem' }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
              style={{ color: '#8a8f98' }}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] mt-1" style={{ color: '#8a8f98' }}>
            Key 保存在浏览器本地，不会上传到任何服务器
          </p>
        </div>
      )}

      {/* Base URL */}
      <div>
        <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#f7f8f8' }}>API 地址</label>
        <Input
          value={settings.baseUrl}
          onChange={e => setSettings({ ...settings, baseUrl: e.target.value })}
          placeholder="https://api.deepseek.com"
          style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }}
        />
      </div>

      {/* 模型选择 */}
      <div>
        <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#f7f8f8' }}>模型</label>
        <div className="flex flex-wrap gap-1.5">
          {currentProvider.models.map(m => (
            <button
              key={m}
              onClick={() => setSettings({ ...settings, model: m })}
              className="px-2.5 py-1 rounded-lg text-[11px] border transition-all"
              style={settings.model === m
                ? { backgroundColor: '#5e6ad2', borderColor: '#5e6ad2', color: 'white' }
                : { borderColor: '#23252a', color: '#d0d6e0' }
              }
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* 测试按钮 */}
      <div className="flex items-center gap-2">
        <Button
          onClick={testConnection}
          disabled={testing}
          variant="outline"
          size="sm"
          style={{ borderColor: '#23252a', color: '#d0d6e0' }}
        >
          {testing ? '测试中...' : '测试连接'}
        </Button>
        {testResult === 'success' && <Check className="w-4 h-4" style={{ color: '#4ade80' }} />}
        {testResult === 'error' && <AlertCircle className="w-4 h-4" style={{ color: '#f87171' }} />}
      </div>

      {/* 保存按钮 */}
      <Button onClick={handleSave} className="w-full" style={{ backgroundColor: '#5e6ad2', color: 'white' }}>
        保存配置
      </Button>

      {/* 提示 */}
      <div className="p-3 rounded-lg text-[11px] space-y-1" style={{ backgroundColor: '#0a0b0c', border: '1px solid #23252a', color: '#8a8f98' }}>
        <p>💡 <strong style={{ color: '#d0d6e0' }}>推荐 DeepSeek</strong>：中文写作性价比最高，约 ¥1/百万token</p>
        <p>💡 配置保存在浏览器 localStorage，清除浏览器数据会丢失</p>
        <p>💡 也可以在 <code style={{ color: '#5e6ad2' }}>.env.local</code> 中配置（优先级更高）</p>
      </div>
    </div>
  )
}
