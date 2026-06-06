// ========== Novel Types ==========

export interface NovelMeta {
  novel_id: string
  title: string
  genre: string
  created_at: string
  updated_at: string
  progress: { current_chapter: number; total_words: number }
  soul: {
    core_hooks: string[]
    forbidden_directions: string[]
    tone: string
    reader_promise: string
  }
  settings: Record<string, any>
}

export interface Foreshadow {
  id: string
  chapter_planted: number
  content: string
  importance: '主线' | '支线' | '装饰'
  tier: 'core' | 'sub' | 'decor'
  status: '未回收' | '部分回收' | '已回收' | '废弃'
  category: string
  related_entities: string[]
  related_mysteries: string[]
  expected_reveal_range: [number, number]
  actual_reveal_chapter: number | null
  urgency_score: number
  evidence: string
  created_at: string
  updated_at: string
}

export interface ForeshadowStore {
  novel_id: string
  foreshadows: Foreshadow[]
  stats: { total: number; unresolved: number; overdue: number; avg_age_chapters: number }
}

export interface MysteryStage {
  stage: number
  threshold: number
  description: string
}

export interface Mystery {
  id: string
  name: string
  tier: '主线' | '支线' | '装饰'
  revelation_progress: number
  revelation_budget: number
  planted_chapter: number
  key_foreshadows: string[]
  revelation_stages: MysteryStage[]
  current_stage: number
  max_per_chapter: number
  forbidden_chapters: number[]
  last_updated_chapter: number
}

export interface MysteryStore {
  novel_id: string
  mysteries: Mystery[]
}

export interface TrustEntry {
  chapter: number
  value: number
  reason: string
}

export interface Relationship {
  type: string
  trust_level: number
  trust_history: TrustEntry[]
  emotional_distance: number
  power_dynamic: string
  tags: string[]
  last_updated_chapter: number
}

export interface RelationshipStore {
  novel_id: string
  relationships: Record<string, Relationship>
  trust_decay_rate: number
  trust_change_alert_threshold: number
}

export interface Realm {
  name: string
  level: number
  combat_power_range: [number, number]
  max_abilities: number
  lifespan?: number
}

export interface CharacterPower {
  realm: string
  sub_realm: string
  combat_power_est: number
  key_abilities?: string[]
  last_updated_chapter?: number
}

export interface PowerSystemStore {
  novel_id: string
  realms: Realm[]
  characters_current: Record<string, CharacterPower>
  power_consistency_rules: string[]
  violations: any[]
}

export interface StyleFingerprint {
  novel_id: string
  'genre定位': string
  narrative_voice: string
  pacing_profile: {
    type: string
    节奏: string
    信息密度: string
    悬念密度: string
  }
  chapter_stats: {
    avg_word_count: number
    word_count_range: [number, number]
    avg_paragraphs: number
    avg_dialogue_ratio: number
  }
  vocabulary_rules: {
    forbidden_patterns: string[]
    preferred_patterns: string[]
    banned_ai_phrases: string[]
  }
  description_style: {
    action_density: string
    psychology_depth: string
    environment_detail: string
    dialogue_style: string
  }
  deviation_thresholds: {
    word_count_drift: number
    dialogue_ratio_drift: number
    style_score_minimum: number
  }
}

export interface ChapterObjective {
  chapter: number
  objectives: {
    id: string
    type: string
    description: string
    priority: '高' | '中' | '低'
    [key: string]: any
  }[]
  completion: {
    checked: boolean
    results: any[]
    completion_rate: number | null
    score: number | null
  }
}

export interface StoryState {
  progress: { current_chapter: number; total_words: number }
  protagonist_state: Record<string, any>
  entities: Record<string, any>
  alias_index: Record<string, any>
  recent_changes: any[]
  disambiguation: any[]
}
