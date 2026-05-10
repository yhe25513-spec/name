export type UserRole = 'player' | 'admin'

export interface Profile {
  id: string
  username: string
  role: UserRole
  created_at: string
}

export interface GameScenario {
  id: string
  title: string
  description: string
  system_prompt: string
  initial_state: GameState
  background_image_url?: string
  is_published: boolean
  created_by?: string
  created_at: string
  ai_config_id?: string
  ai_config?: AIConfig
}

export interface AIConfig {
  id: string
  name: string
  provider: 'deepseek' | 'openai' | 'anthropic' | 'openrouter' | 'siliconflow' | 'custom'
  model: string
  api_key: string
  api_base_url?: string
  temperature: number
  max_tokens: number
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface GameState {
  hp: number
  maxHp: number
  attributes: Record<string, number>
  inventory: string[]
  flags: Record<string, unknown>
  location?: string
  gamePhase?: string
  turn?: number
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface GameSave {
  id: string
  user_id: string
  scenario_id: string
  current_state: GameState
  conversation_history: ConversationMessage[]
  turn_count: number
  created_at: string
  updated_at: string
  scenario?: GameScenario
}

export interface AIResponse {
  narration: string
  options: string[]
  stateChanges: {
    hp?: number
    addItems?: string[]
    removeItems?: string[]
    setFlags?: Record<string, unknown>
  }
  atmosphereHint: 'danger' | 'normal' | 'mystery' | 'triumph'
}

export interface ConversationLog {
  id: string
  save_id: string
  user_id: string
  user_input: string
  ai_response: AIResponse
  tokens_used: number
  created_at: string
}

export interface AdminConfig {
  id: string
  deepseek_api_key_encrypted: string
  model: string
  temperature: number
  max_tokens: number
  updated_at: string
}

export interface PlayerStats {
  id: string
  username: string
  role: UserRole
  created_at: string
  save_count: number
  total_turns: number
  last_active?: string
}
