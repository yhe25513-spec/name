import { NextRequest, NextResponse } from 'next/server'
import { getCurrentConfig, AI_PROVIDERS } from '@/lib/novel/ai-config'

// GET: 获取当前 AI 配置
export async function GET() {
  const config = getCurrentConfig()
  return NextResponse.json({
    ...config,
    providers: Object.values(AI_PROVIDERS).map(p => ({
      id: p.id,
      name: p.name,
      models: p.models,
      defaultModel: p.defaultModel,
    })),
  })
}
