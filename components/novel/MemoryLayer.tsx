'use client'

import { useState, useEffect, useCallback } from 'react'
import { Globe, Users, Clock, Brain, Sparkles, Plus, Trash2, ChevronDown, ChevronRight, Edit3, Save, X, Search, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const API_BASE = '/api/novel/memory'

async function memApi(path: string, options?: RequestInit) {
  // 分离路径和查询参数
  const [basePath, queryString] = path.split('?')
  const params = new URLSearchParams(queryString || '')
  params.set('path', basePath)
  const url = `${API_BASE}?${params.toString()}`

  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '请求失败' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// ========== Types ==========
interface WorldItem {
  id: string; novel_id: string; name: string; category: string; title: string;
  content: string; tags: string[]; importance: number; chapter_introduced: number;
  related_characters: string[]; related_factions: string[]; metadata: any;
}

interface Character {
  id: string; novel_id: string; name: string; alias: string[]; identity: string;
  age: string; gender: string; faction: string; personality: any; beliefs: string;
  weaknesses: string; appearance: string; abilities: string[]; realm: string;
  dialogue_profile: any; growth_trajectory: any[]; relationships: any;
  status: string; first_appearance: number; last_appearance: number;
}

interface TimelineEvent {
  id: number; novel_id: string; chapter_num: number; event_order: number;
  event_type: string; title: string; description: string;
  characters_involved: string[]; locations: string[]; factions_involved: string[];
  consequences: string; importance: number;
}

interface StoryState {
  id: string; novel_id: string; category: string; name: string; description: string;
  progress: number; current_stage: number; max_stages: number; stages: any[];
  constraints: any; last_updated_chapter: number;
}

interface NovelSoul {
  novel_id: string; core_selling_points: string[]; forbidden_directions: string[];
  tone: string; reader_promise: string; target_audience: string; genre_tags: string[];
}

// ========== 主组件 ==========
export default function MemoryLayer({ novelId }: { novelId: string }) {
  const [tab, setTab] = useState<'world' | 'character' | 'timeline' | 'state' | 'soul'>('world')
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    memApi(`stats?novelId=${novelId}`).then(setStats).catch(() => {})
  }, [novelId])

  const tabs = [
    { key: 'world', label: '🌍 世界观', icon: Globe },
    { key: 'character', label: '👤 角色', icon: Users },
    { key: 'timeline', label: '📅 时间线', icon: Clock },
    { key: 'state', label: '🧠 剧情状态', icon: Brain },
    { key: 'soul', label: '✨ 小说灵魂', icon: Sparkles },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#f7f8f8' }}>📦 记忆层</h1>
          <p className="text-xs mt-1" style={{ color: '#8a8f98' }}>世界观 · 角色 · 时间线 · 剧情状态机 · 小说灵魂</p>
        </div>
        {stats && (
          <div className="flex gap-3 text-xs" style={{ color: '#8a8f98' }}>
            <span>🌍 {stats.worlds}</span>
            <span>👤 {stats.characters}</span>
            <span>📅 {stats.events}</span>
            <span>🧠 {stats.states}</span>
          </div>
        )}
      </div>

      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ backgroundColor: '#141516' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={tab === t.key
              ? { backgroundColor: '#5e6ad2', color: 'white' }
              : { color: '#8a8f98' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'world' && <WorldPanel novelId={novelId} />}
      {tab === 'character' && <CharacterPanel novelId={novelId} />}
      {tab === 'timeline' && <TimelinePanel novelId={novelId} />}
      {tab === 'state' && <StoryStatePanel novelId={novelId} />}
      {tab === 'soul' && <SoulPanel novelId={novelId} />}
    </div>
  )
}

// ========== 世界观面板 ==========
function WorldPanel({ novelId }: { novelId: string }) {
  const [items, setItems] = useState<WorldItem[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ name: '', title: '', category: 'rule', content: '', tags: '', importance: 5 })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const load = useCallback(() => {
    memApi(`worlds?novelId=${novelId}`).then(setItems).catch(() => setItems([]))
  }, [novelId])

  useEffect(() => { load() }, [load])

  const categories = [
    { value: 'rule', label: '📐 世界规则' },
    { value: 'history', label: '📜 历史事件' },
    { value: 'race', label: '🐉 种族' },
    { value: 'faction', label: '⚔️ 势力' },
    { value: 'location', label: '🏰 地点' },
    { value: 'item', label: '🗡️ 物品/法宝' },
    { value: 'taboo', label: '⛔ 禁忌' },
  ]

  const filtered = filter === 'all' ? items : items.filter(i => i.category === filter)

  const add = async () => {
    if (!form.title.trim()) { toast.error('请填写标题'); return }
    try {
      await memApi(`worlds?novelId=${novelId}`, {
        method: 'POST', body: JSON.stringify({ ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) })
      })
      toast.success('世界观条目已添加')
      setShowAdd(false)
      setForm({ name: '', title: '', category: 'rule', content: '', tags: '', importance: 5 })
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const saveEdit = async (id: string) => {
    try {
      await memApi(`worlds?novelId=${novelId}&id=${id}`, { method: 'PUT', body: JSON.stringify({ content: editContent }) })
      toast.success('已保存')
      setEditingId(null)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const remove = async (id: string) => {
    if (!confirm('确定删除？')) return
    try {
      await memApi(`worlds?novelId=${novelId}&id=${id}`, { method: 'DELETE' })
      toast.success('已删除')
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilter('all')} className={`px-2.5 py-1 rounded-lg text-xs transition-all ${filter === 'all' ? 'text-white' : ''}`} style={filter === 'all' ? { backgroundColor: '#5e6ad2' } : { color: '#8a8f98' }}>全部 ({items.length})</button>
          {categories.map(c => (
            <button key={c.value} onClick={() => setFilter(c.value)} className={`px-2.5 py-1 rounded-lg text-xs transition-all ${filter === c.value ? 'text-white' : ''}`} style={filter === c.value ? { backgroundColor: '#5e6ad2' } : { color: '#8a8f98' }}>
              {c.label} ({items.filter(i => i.category === c.value).length})
            </button>
          ))}
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm" style={{ backgroundColor: '#5e6ad2', color: 'white' }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> 添加
        </Button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12" style={{ color: '#8a8f98' }}>
            <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无世界观数据</p>
            <p className="text-xs mt-1">点击"添加"开始构建世界观</p>
          </div>
        ) : filtered.map(item => (
          <div key={item.id} className="rounded-xl border p-4" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(94,106,210,0.12)', color: '#5e6ad2' }}>
                    {categories.find(c => c.value === item.category)?.label || item.category}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: '#f7f8f8' }}>{item.title}</span>
                  <span className="text-[10px]" style={{ color: '#8a8f98' }}>重要度: {item.importance}/10</span>
                </div>
                {editingId === item.id ? (
                  <div className="mt-2">
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full p-2 rounded-lg text-xs resize-none h-24 outline-none" style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8', border: '1px solid #23252a' }} />
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => saveEdit(item.id)} className="px-2 py-1 rounded text-[10px]" style={{ backgroundColor: '#5e6ad2', color: 'white' }}>保存</button>
                      <button onClick={() => setEditingId(null)} className="px-2 py-1 rounded text-[10px]" style={{ color: '#8a8f98' }}>取消</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: '#d0d6e0' }}>{item.content || '无描述'}</p>
                )}
                {item.tags?.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {item.tags.map((t: string, i: number) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: '#23252a', color: '#8a8f98' }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1 ml-2 shrink-0">
                <button onClick={() => { setEditingId(item.id); setEditContent(item.content) }} className="p-1 rounded hover:bg-white/5" style={{ color: '#8a8f98' }}>
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(item.id)} className="p-1 rounded hover:bg-white/5" style={{ color: '#f87171' }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-lg" style={{ backgroundColor: '#141516', borderColor: '#23252a' }}>
          <DialogHeader><DialogTitle style={{ color: '#f7f8f8' }}>添加世界观条目</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>分类</label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(c => (
                  <button key={c.value} onClick={() => setForm({ ...form, category: c.value })} className="px-2.5 py-1 rounded-lg text-xs border transition-all"
                    style={form.category === c.value ? { backgroundColor: '#5e6ad2', borderColor: '#5e6ad2', color: 'white' } : { borderColor: '#23252a', color: '#d0d6e0' }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>标题</label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="如：灵气体系、天庭、花果山" style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>详细描述</label>
              <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="w-full p-2 rounded-lg text-xs resize-none h-32 outline-none" style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8', border: '1px solid #23252a' }} placeholder="详细描述这个世界观设定..." />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>标签（逗号分隔）</label>
                <Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="修仙, 灵气, 突破" style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
              </div>
              <div className="w-24">
                <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>重要度 (1-10)</label>
                <Input type="number" min={1} max={10} value={form.importance} onChange={e => setForm({ ...form, importance: parseInt(e.target.value) || 5 })} style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} style={{ borderColor: '#23252a', color: '#d0d6e0' }}>取消</Button>
            <Button onClick={add} style={{ backgroundColor: '#5e6ad2', color: 'white' }}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ========== 角色面板 ==========
function CharacterPanel({ novelId }: { novelId: string }) {
  const [chars, setChars] = useState<Character[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', identity: '', gender: '', faction: '', personality: '', beliefs: '', weaknesses: '', realm: '', appearance: '' })

  const load = useCallback(() => {
    memApi(`characters?novelId=${novelId}`).then(setChars).catch(() => setChars([]))
  }, [novelId])

  useEffect(() => { load() }, [load])

  const add = async () => {
    if (!form.name.trim()) { toast.error('请填写角色名'); return }
    try {
      await memApi(`characters?novelId=${novelId}`, {
        method: 'POST', body: JSON.stringify({
          ...form,
          personality: { traits: form.personality.split(',').map(t => t.trim()).filter(Boolean) }
        })
      })
      toast.success(`角色《${form.name}》已添加`)
      setShowAdd(false)
      setForm({ name: '', identity: '', gender: '', faction: '', personality: '', beliefs: '', weaknesses: '', realm: '', appearance: '' })
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const remove = async (id: string) => {
    if (!confirm('确定删除该角色？')) return
    try { await memApi(`characters?novelId=${novelId}&id=${id}`, { method: 'DELETE' }); toast.success('已删除'); load() } catch (e: any) { toast.error(e.message) }
  }

  const statusColors: Record<string, string> = { active: '#4ade80', dead: '#f87171', missing: '#fbbf24', unknown: '#8a8f98' }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs" style={{ color: '#8a8f98' }}>共 {chars.length} 个角色</span>
        <Button onClick={() => setShowAdd(true)} size="sm" style={{ backgroundColor: '#5e6ad2', color: 'white' }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> 添加角色
        </Button>
      </div>

      <div className="space-y-2">
        {chars.length === 0 ? (
          <div className="text-center py-12" style={{ color: '#8a8f98' }}>
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无角色数据</p>
          </div>
        ) : chars.map(ch => (
          <div key={ch.id} className="rounded-xl border overflow-hidden" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
            <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/[0.02]" onClick={() => setExpandedId(expandedId === ch.id ? null : ch.id)}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: 'rgba(94,106,210,0.15)', color: '#5e6ad2' }}>
                  {ch.name[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: '#f7f8f8' }}>{ch.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${statusColors[ch.status]}20`, color: statusColors[ch.status] }}>{ch.status === 'active' ? '存活' : ch.status === 'dead' ? '死亡' : ch.status === 'missing' ? '失踪' : '未知'}</span>
                  </div>
                  <span className="text-[11px]" style={{ color: '#8a8f98' }}>{ch.identity || '未知身份'} {ch.faction ? `· ${ch.faction}` : ''} {ch.realm ? `· ${ch.realm}` : ''}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); remove(ch.id) }} className="p-1 rounded hover:bg-white/5" style={{ color: '#f87171' }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {expandedId === ch.id ? <ChevronDown className="w-4 h-4" style={{ color: '#8a8f98' }} /> : <ChevronRight className="w-4 h-4" style={{ color: '#8a8f98' }} />}
              </div>
            </div>
            {expandedId === ch.id && (
              <div className="px-4 pb-4 space-y-3 text-xs border-t" style={{ borderColor: '#23252a' }}>
                <div className="grid grid-cols-2 gap-3 pt-3">
                  <div><span style={{ color: '#8a8f98' }}>性别：</span><span style={{ color: '#d0d6e0' }}>{ch.gender || '未知'}</span></div>
                  <div><span style={{ color: '#8a8f98' }}>首次出场：</span><span style={{ color: '#d0d6e0' }}>第{ch.first_appearance}章</span></div>
                  {ch.personality?.traits?.length > 0 && (
                    <div className="col-span-2">
                      <span style={{ color: '#8a8f98' }}>性格：</span>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {ch.personality.traits.map((t: string, i: number) => (
                          <span key={i} className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: 'rgba(94,106,210,0.12)', color: '#5e6ad2' }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {ch.beliefs && <div className="col-span-2"><span style={{ color: '#8a8f98' }}>核心信念：</span><span style={{ color: '#d0d6e0' }}>{ch.beliefs}</span></div>}
                  {ch.weaknesses && <div className="col-span-2"><span style={{ color: '#8a8f98' }}>弱点：</span><span style={{ color: '#d0d6e0' }}>{ch.weaknesses}</span></div>}
                  {ch.appearance && <div className="col-span-2"><span style={{ color: '#8a8f98' }}>外貌：</span><span style={{ color: '#d0d6e0' }}>{ch.appearance}</span></div>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto" style={{ backgroundColor: '#141516', borderColor: '#23252a' }}>
          <DialogHeader><DialogTitle style={{ color: '#f7f8f8' }}>添加角色</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {[
              { key: 'name', label: '角色名', placeholder: '如：孙悟空' },
              { key: 'identity', label: '身份', placeholder: '如：齐天大圣' },
              { key: 'gender', label: '性别', placeholder: '男/女/未知' },
              { key: 'faction', label: '所属势力', placeholder: '如：花果山' },
              { key: 'realm', label: '境界/等级', placeholder: '如：大罗金仙' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>{f.label}</label>
                <Input value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
              </div>
            ))}
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>性格特征（逗号分隔）</label>
              <Input value={form.personality} onChange={e => setForm({ ...form, personality: e.target.value })} placeholder="如：勇敢, 机智, 重情义" style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>核心信念</label>
              <Input value={form.beliefs} onChange={e => setForm({ ...form, beliefs: e.target.value })} placeholder="如：自由至上" style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>弱点</label>
              <Input value={form.weaknesses} onChange={e => setForm({ ...form, weaknesses: e.target.value })} placeholder="如：冲动、不擅防御" style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>外貌描述</label>
              <textarea value={form.appearance} onChange={e => setForm({ ...form, appearance: e.target.value })} className="w-full p-2 rounded-lg text-xs resize-none h-20 outline-none" style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8', border: '1px solid #23252a' }} placeholder="详细描述角色外貌..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} style={{ borderColor: '#23252a', color: '#d0d6e0' }}>取消</Button>
            <Button onClick={add} style={{ backgroundColor: '#5e6ad2', color: 'white' }}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ========== 时间线面板 ==========
function TimelinePanel({ novelId }: { novelId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ chapter_num: 1, event_type: 'plot', title: '', description: '', characters_involved: '', consequences: '', importance: 5 })

  const load = useCallback(() => {
    memApi(`timelines?novelId=${novelId}`).then(setEvents).catch(() => setEvents([]))
  }, [novelId])

  useEffect(() => { load() }, [load])

  const typeColors: Record<string, string> = { plot: '#5e6ad2', character: '#4ade80', world: '#fbbf24', battle: '#f87171', revelation: '#a78bfa' }
  const typeLabels: Record<string, string> = { plot: '剧情', character: '角色', world: '世界', battle: '战斗', revelation: '揭秘' }

  // Group by chapter
  const grouped = events.reduce((acc, e) => {
    if (!acc[e.chapter_num]) acc[e.chapter_num] = []
    acc[e.chapter_num].push(e)
    return acc
  }, {} as Record<number, TimelineEvent[]>)

  const add = async () => {
    if (!form.title.trim()) { toast.error('请填写事件标题'); return }
    try {
      await memApi(`timelines?novelId=${novelId}`, {
        method: 'POST', body: JSON.stringify({
          ...form,
          characters_involved: form.characters_involved.split(',').map(s => s.trim()).filter(Boolean)
        })
      })
      toast.success('事件已添加')
      setShowAdd(false)
      setForm({ chapter_num: 1, event_type: 'plot', title: '', description: '', characters_involved: '', consequences: '', importance: 5 })
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const remove = async (id: number) => {
    if (!confirm('确定删除？')) return
    try { await memApi(`timelines?novelId=${novelId}&id=${id}`, { method: 'DELETE' }); toast.success('已删除'); load() } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs" style={{ color: '#8a8f98' }}>共 {events.length} 个事件，覆盖 {Object.keys(grouped).length} 章</span>
        <Button onClick={() => setShowAdd(true)} size="sm" style={{ backgroundColor: '#5e6ad2', color: 'white' }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> 添加事件
        </Button>
      </div>

      <div className="space-y-4">
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-12" style={{ color: '#8a8f98' }}>
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无时间线数据</p>
          </div>
        ) : Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b)).map(([ch, chEvents]) => (
          <div key={ch}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(94,106,210,0.15)', color: '#5e6ad2' }}>第{ch}章</span>
              <div className="flex-1 h-px" style={{ backgroundColor: '#23252a' }} />
            </div>
            <div className="ml-4 space-y-1.5 border-l-2 pl-4" style={{ borderColor: '#23252a' }}>
              {chEvents.map(ev => (
                <div key={ev.id} className="flex items-start gap-3 group">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: typeColors[ev.event_type] || '#5e6ad2' }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: '#f7f8f8' }}>{ev.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${typeColors[ev.event_type]}20`, color: typeColors[ev.event_type] }}>{typeLabels[ev.event_type] || ev.event_type}</span>
                    </div>
                    {ev.description && <p className="text-[11px] mt-0.5" style={{ color: '#8a8f98' }}>{ev.description}</p>}
                    {ev.characters_involved?.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {ev.characters_involved.map((c, i) => (
                          <span key={i} className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: '#23252a', color: '#d0d6e0' }}>{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => remove(ev.id)} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/5 transition-opacity" style={{ color: '#f87171' }}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-lg" style={{ backgroundColor: '#141516', borderColor: '#23252a' }}>
          <DialogHeader><DialogTitle style={{ color: '#f7f8f8' }}>添加时间线事件</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-3">
              <div className="w-24">
                <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>章节</label>
                <Input type="number" min={1} value={form.chapter_num} onChange={e => setForm({ ...form, chapter_num: parseInt(e.target.value) || 1 })} style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
              </div>
              <div className="flex-1">
                <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>事件类型</label>
                <div className="flex gap-1">
                  {Object.entries(typeLabels).map(([k, v]) => (
                    <button key={k} onClick={() => setForm({ ...form, event_type: k })} className="px-2 py-1 rounded text-[10px] border transition-all"
                      style={form.event_type === k ? { backgroundColor: typeColors[k], borderColor: typeColors[k], color: 'white' } : { borderColor: '#23252a', color: '#d0d6e0' }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>事件标题</label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="如：悟空大闹天宫" style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>详细描述</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full p-2 rounded-lg text-xs resize-none h-20 outline-none" style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8', border: '1px solid #23252a' }} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>参与角色（逗号分隔）</label>
                <Input value={form.characters_involved} onChange={e => setForm({ ...form, characters_involved: e.target.value })} placeholder="悟空, 秦煌" style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
              </div>
              <div className="w-24">
                <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>重要度</label>
                <Input type="number" min={1} max={10} value={form.importance} onChange={e => setForm({ ...form, importance: parseInt(e.target.value) || 5 })} style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
              </div>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>后果/影响</label>
              <Input value={form.consequences} onChange={e => setForm({ ...form, consequences: e.target.value })} placeholder="如：导致天庭围剿" style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} style={{ borderColor: '#23252a', color: '#d0d6e0' }}>取消</Button>
            <Button onClick={add} style={{ backgroundColor: '#5e6ad2', color: 'white' }}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ========== 剧情状态机面板 ==========
function StoryStatePanel({ novelId }: { novelId: string }) {
  const [states, setStates] = useState<StoryState[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ category: 'main_plot', name: '', description: '', progress: 0, max_stages: 6 })

  const load = useCallback(() => {
    memApi(`story-states?novelId=${novelId}`).then(setStates).catch(() => setStates([]))
  }, [novelId])

  useEffect(() => { load() }, [load])

  const categories = [
    { value: 'main_plot', label: '📖 主线剧情', color: '#5e6ad2' },
    { value: 'side_plot', label: '📎 支线剧情', color: '#4ade80' },
    { value: 'character_mystery', label: '👤 角色谜团', color: '#fbbf24' },
    { value: 'world_mystery', label: '🌍 世界谜团', color: '#a78bfa' },
  ]

  const add = async () => {
    if (!form.name.trim()) { toast.error('请填写名称'); return }
    try {
      await memApi(`story-states?novelId=${novelId}`, { method: 'POST', body: JSON.stringify(form) })
      toast.success('剧情状态已添加')
      setShowAdd(false)
      setForm({ category: 'main_plot', name: '', description: '', progress: 0, max_stages: 6 })
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const updateProgress = async (id: string, progress: number) => {
    try {
      await memApi(`story-states?novelId=${novelId}&id=${id}`, { method: 'PUT', body: JSON.stringify({ progress }) })
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const remove = async (id: string) => {
    if (!confirm('确定删除？')) return
    try { await memApi(`story-states?novelId=${novelId}&id=${id}`, { method: 'DELETE' }); toast.success('已删除'); load() } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs" style={{ color: '#8a8f98' }}>共 {states.length} 个剧情状态</span>
        <Button onClick={() => setShowAdd(true)} size="sm" style={{ backgroundColor: '#5e6ad2', color: 'white' }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> 添加状态
        </Button>
      </div>

      <div className="space-y-2">
        {states.length === 0 ? (
          <div className="text-center py-12" style={{ color: '#8a8f98' }}>
            <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无剧情状态</p>
          </div>
        ) : states.map(st => {
          const cat = categories.find(c => c.value === st.category)
          return (
            <div key={st.id} className="rounded-xl border p-4 group" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${cat?.color || '#5e6ad2'}20`, color: cat?.color || '#5e6ad2' }}>{cat?.label || st.category}</span>
                  <span className="text-sm font-semibold" style={{ color: '#f7f8f8' }}>{st.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-bold" style={{ color: cat?.color || '#5e6ad2' }}>{st.progress}%</span>
                  <button onClick={() => remove(st.id)} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/5 transition-opacity" style={{ color: '#f87171' }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {st.description && <p className="text-[11px] mb-2" style={{ color: '#8a8f98' }}>{st.description}</p>}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: '#23252a' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${st.progress}%`, backgroundColor: cat?.color || '#5e6ad2' }} />
                </div>
                <input type="range" min={0} max={100} value={st.progress} onChange={e => updateProgress(st.id, parseInt(e.target.value))}
                  className="w-20 h-1 accent-[#5e6ad2]" style={{ accentColor: cat?.color || '#5e6ad2' }} />
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md" style={{ backgroundColor: '#141516', borderColor: '#23252a' }}>
          <DialogHeader><DialogTitle style={{ color: '#f7f8f8' }}>添加剧情状态</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>分类</label>
              <div className="flex gap-1.5">
                {categories.map(c => (
                  <button key={c.value} onClick={() => setForm({ ...form, category: c.value })} className="px-2.5 py-1 rounded-lg text-xs border transition-all"
                    style={form.category === c.value ? { backgroundColor: c.color, borderColor: c.color, color: 'white' } : { borderColor: '#23252a', color: '#d0d6e0' }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>名称</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="如：飞升真相" style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>描述</label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="关于这个谜团的简要说明" style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} style={{ borderColor: '#23252a', color: '#d0d6e0' }}>取消</Button>
            <Button onClick={add} style={{ backgroundColor: '#5e6ad2', color: 'white' }}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ========== 小说灵魂面板 ==========
function SoulPanel({ novelId }: { novelId: string }) {
  const [soul, setSoul] = useState<NovelSoul>({ novel_id: novelId, core_selling_points: [], forbidden_directions: [], tone: '', reader_promise: '', target_audience: '', genre_tags: [] })
  const [newPoint, setNewPoint] = useState('')
  const [newForbidden, setNewForbidden] = useState('')
  const [newTag, setNewTag] = useState('')

  useEffect(() => {
    memApi(`soul?novelId=${novelId}`).then(setSoul).catch(() => {})
  }, [novelId])

  const save = async () => {
    try {
      await memApi(`soul?novelId=${novelId}`, { method: 'POST', body: JSON.stringify(soul) })
      toast.success('小说灵魂已保存')
    } catch (e: any) { toast.error(e.message) }
  }

  const addPoint = () => {
    if (!newPoint.trim()) return
    setSoul({ ...soul, core_selling_points: [...soul.core_selling_points, newPoint.trim()] })
    setNewPoint('')
  }

  const addForbidden = () => {
    if (!newForbidden.trim()) return
    setSoul({ ...soul, forbidden_directions: [...soul.forbidden_directions, newForbidden.trim()] })
    setNewForbidden('')
  }

  const addTag = () => {
    if (!newTag.trim()) return
    setSoul({ ...soul, genre_tags: [...soul.genre_tags, newTag.trim()] })
    setNewTag('')
  }

  return (
    <div className="space-y-6">
      {/* 核心卖点 */}
      <div className="rounded-xl border p-5" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#5e6ad2' }}>
          <Sparkles className="w-4 h-4" /> 核心卖点（总导演守护）
        </h3>
        <p className="text-[11px] mb-3" style={{ color: '#8a8f98' }}>任何偏离核心卖点的剧情将被总导演否决</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {soul.core_selling_points.map((p, i) => (
            <span key={i} className="px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5" style={{ backgroundColor: 'rgba(94,106,210,0.12)', color: '#5e6ad2' }}>
              {p}
              <button onClick={() => setSoul({ ...soul, core_selling_points: soul.core_selling_points.filter((_, j) => j !== i) })} className="hover:text-white">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={newPoint} onChange={e => setNewPoint(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPoint()} placeholder="添加核心卖点..." style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
          <Button onClick={addPoint} size="sm" style={{ backgroundColor: '#5e6ad2', color: 'white' }}>添加</Button>
        </div>
      </div>

      {/* 禁止方向 */}
      <div className="rounded-xl border p-5" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#f87171' }}>
          🚫 禁止方向
        </h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {soul.forbidden_directions.map((p, i) => (
            <span key={i} className="px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5" style={{ backgroundColor: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
              {p}
              <button onClick={() => setSoul({ ...soul, forbidden_directions: soul.forbidden_directions.filter((_, j) => j !== i) })} className="hover:text-white">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={newForbidden} onChange={e => setNewForbidden(e.target.value)} onKeyDown={e => e.key === 'Enter' && addForbidden()} placeholder="添加禁止方向..." style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
          <Button onClick={addForbidden} size="sm" variant="outline" style={{ borderColor: '#f87171', color: '#f87171' }}>添加</Button>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="rounded-xl border p-5" style={{ borderColor: '#23252a', backgroundColor: '#141516' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: '#f7f8f8' }}>📖 基本信息</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>整体调性</label>
            <Input value={soul.tone} onChange={e => setSoul({ ...soul, tone: e.target.value })} placeholder="如：热血爽文、暗黑悬疑、轻松日常" style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>读者承诺</label>
            <Input value={soul.reader_promise} onChange={e => setSoul({ ...soul, reader_promise: e.target.value })} placeholder="如：每章必有爽点，绝不虐主" style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>目标读者</label>
            <Input value={soul.target_audience} onChange={e => setSoul({ ...soul, target_audience: e.target.value })} placeholder="如：18-35岁男性，喜欢热血玄幻" style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: '#8a8f98' }}>类型标签</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {soul.genre_tags.map((t, i) => (
                <span key={i} className="px-2 py-0.5 rounded text-[10px] flex items-center gap-1" style={{ backgroundColor: '#23252a', color: '#d0d6e0' }}>
                  {t}
                  <button onClick={() => setSoul({ ...soul, genre_tags: soul.genre_tags.filter((_, j) => j !== i) })} className="hover:text-white">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="添加标签..." style={{ backgroundColor: '#0a0b0c', borderColor: '#23252a', color: '#f7f8f8' }} />
              <Button onClick={addTag} size="sm" variant="outline" style={{ borderColor: '#23252a', color: '#d0d6e0' }}>添加</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} style={{ backgroundColor: '#5e6ad2', color: 'white' }}>
          <Save className="w-4 h-4 mr-1.5" /> 保存小说灵魂
        </Button>
      </div>
    </div>
  )
}
