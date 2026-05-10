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
        <div className="max-w-7xl mx-auto px-2 sm:px-4 h-14 flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="text-zinc-400 hover:text-white px-2 sm:px-3"
          >
            <ArrowLeft className="w-4 h-4 mr-0 sm:mr-1" />
            <span className="hidden sm:inline">返回首页</span>
          </Button>
          <div className="flex items-center gap-2">
            <Sword className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-white">管理后台</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 ml-auto">
            <Badge variant={isAdmin ? "default" : "outline"} className={isAdmin ? "bg-amber-500 text-black text-xs px-1.5" : "border-zinc-600 text-zinc-400 text-xs px-1.5"}>
              {isAdmin ? '管理' : '创作'}
            </Badge>
            <span className="text-zinc-500 text-sm hidden sm:inline">{username}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <Tabs defaultValue="scenarios">
          <TabsList className="bg-zinc-900 border border-zinc-800 mb-4 sm:mb-6 w-full overflow-x-auto flex-nowrap">
            <TabsTrigger value="scenarios" className="data-[state=active]:bg-zinc-700 text-zinc-400 data-[state=active]:text-white whitespace-nowrap">
              <BookOpen className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">场景</span>
              <span className="sm:hidden">场景</span>
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="players" className="data-[state=active]:bg-zinc-700 text-zinc-400 data-[state=active]:text-white whitespace-nowrap">
                  <Users className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">玩家</span>
                  <span className="sm:hidden">玩家</span>
                </TabsTrigger>
                <TabsTrigger value="ai-configs" className="data-[state=active]:bg-zinc-700 text-zinc-400 data-[state=active]:text-white whitespace-nowrap">
                  <Server className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">AI</span>
                  <span className="sm:hidden">AI</span>
                </TabsTrigger>
                <TabsTrigger value="config" className="data-[state=active]:bg-zinc-700 text-zinc-400 data-[state=active]:text-white whitespace-nowrap">
                  <Settings className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">配置</span>
                  <span className="sm:hidden">配置</span>
                </TabsTrigger>
                <TabsTrigger value="sandbox" className="data-[state=active]:bg-zinc-700 text-zinc-400 data-[state=active]:text-white whitespace-nowrap">
                  <FlaskConical className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">沙盒</span>
                  <span className="sm:hidden">沙盒</span>
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
