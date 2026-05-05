'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Sword, ArrowLeft, Users, BookOpen, Settings, FlaskConical, Server } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScenariosTab } from '@/components/admin/ScenariosTab'
import { PlayersTab } from '@/components/admin/PlayersTab'
import { ConfigTab } from '@/components/admin/ConfigTab'
import { AIConfigsTab } from '@/components/admin/AIConfigsTab'
import { SandboxTab } from '@/components/admin/SandboxTab'

interface AdminDashboardProps {
  username: string
  isAdmin?: boolean
}

export function AdminDashboard({ username, isAdmin = false }: AdminDashboardProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* 顶部导航 */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/game')}
            className="text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回游戏
          </Button>
          <div className="flex items-center gap-2">
            <Sword className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-white">管理后台</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Badge variant={isAdmin ? "default" : "outline"} className={isAdmin ? "bg-amber-500 text-black" : "border-zinc-600 text-zinc-400"}>
              {isAdmin ? '管理员' : '创作者'}
            </Badge>
            <span className="text-zinc-500 text-sm">{username}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="scenarios">
          <TabsList className="bg-zinc-900 border border-zinc-800 mb-6 w-full sm:w-auto">
            <TabsTrigger value="scenarios" className="data-[state=active]:bg-zinc-700 text-zinc-400 data-[state=active]:text-white">
              <BookOpen className="w-4 h-4 mr-1.5" />
              场景管理
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="players" className="data-[state=active]:bg-zinc-700 text-zinc-400 data-[state=active]:text-white">
                  <Users className="w-4 h-4 mr-1.5" />
                  玩家管理
                </TabsTrigger>
                <TabsTrigger value="ai-configs" className="data-[state=active]:bg-zinc-700 text-zinc-400 data-[state=active]:text-white">
                  <Server className="w-4 h-4 mr-1.5" />
                  AI 服务
                </TabsTrigger>
                <TabsTrigger value="config" className="data-[state=active]:bg-zinc-700 text-zinc-400 data-[state=active]:text-white">
                  <Settings className="w-4 h-4 mr-1.5" />
                  旧版配置
                </TabsTrigger>
                <TabsTrigger value="sandbox" className="data-[state=active]:bg-zinc-700 text-zinc-400 data-[state=active]:text-white">
                  <FlaskConical className="w-4 h-4 mr-1.5" />
                  测试沙盒
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="scenarios"><ScenariosTab /></TabsContent>
          {isAdmin && (
            <>
              <TabsContent value="players"><PlayersTab /></TabsContent>
              <TabsContent value="ai-configs"><AIConfigsTab /></TabsContent>
              <TabsContent value="config"><ConfigTab /></TabsContent>
              <TabsContent value="sandbox"><SandboxTab /></TabsContent>
            </>
          )}
        </Tabs>
      </main>
    </div>
  )
}
