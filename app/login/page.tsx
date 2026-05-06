'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sword, Eye, EyeOff, Loader2, Mail, X } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loginForm, setLoginForm] = useState({ emailOrUsername: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ email: '', password: '', username: '' })
  const [registerMode, setRegisterMode] = useState<'username' | 'email'>('username')
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const isEmail = loginForm.emailOrUsername.includes('@')
    const loginEmail = isEmail
      ? loginForm.emailOrUsername
      : `${loginForm.emailOrUsername.trim()}@play-xiuxian.top`
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginForm.password,
    })
    if (error) {
      toast.error('登录失败', { description: error.message })
    } else {
      toast.success('登录成功')
      router.push('/game')
      router.refresh()
    }
    setLoading(false)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (registerForm.password.length < 6) {
      toast.error('密码至少6位')
      return
    }
    setLoading(true)
    try {
      const finalEmail = registerMode === 'username'
        ? `${registerForm.username.trim()}@play-xiuxian.top`
        : registerForm.email
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: finalEmail,
          password: registerForm.password,
          username: registerForm.username,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error('注册失败', { description: result.error })
      } else {
        await supabase.auth.signInWithPassword({
          email: finalEmail,
          password: registerForm.password,
        })
        toast.success('注册成功！正在进入游戏...')
        router.push('/game')
        router.refresh()
      }
    } catch (error) {
      toast.error('注册失败', { description: '网络错误' })
    }
    setLoading(false)
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!forgotPasswordEmail) {
      toast.error('请输入邮箱')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
      redirectTo: `${window.location.origin}/login`,
    })
    if (error) {
      toast.error('发送失败', { description: error.message })
    } else {
      setResetSent(true)
      toast.success('密码重置邮件已发送！请检查邮箱')
    }
    setLoading(false)
  }

  function resetForgotPassword() {
    setResetSent(false)
    setForgotPasswordEmail('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/30 via-zinc-950 to-zinc-950" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMjIiIGZpbGwtb3BhY2l0eT0iMC4xNSI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptNiA2djZoNnYtNmgtNnptLTEyIDBoNnY2aC02di02em0xMiAwaDZ2NmgtNnYtNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20" />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 mb-4">
            <Sword className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">文字冒险</h1>
          <p className="text-zinc-400 mt-1 text-sm">AI 驱动的沉浸式文字游戏</p>
        </div>

        <Card className="bg-zinc-900/90 border-zinc-700/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-lg">进入游戏</CardTitle>
            <CardDescription className="text-zinc-400">
              登录或注册账号开始你的冒险
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="w-full bg-zinc-800 mb-6">
                <TabsTrigger value="login" className="flex-1 data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-400">
                  登录
                </TabsTrigger>
                <TabsTrigger value="register" className="flex-1 data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-400">
                  注册
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Input
                      type="text"
                      placeholder="用户名 或 邮箱"
                      value={loginForm.emailOrUsername}
                      onChange={(e) => setLoginForm({ ...loginForm, emailOrUsername: e.target.value })}
                      required
                      className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500 focus:border-amber-500/50"
                    />
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="密码"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      required
                      className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500 focus:border-amber-500/50 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    登录
                  </Button>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => { setResetSent(false); setForgotPasswordEmail(''); setForgotOpen(true); }}
                      className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      忘记密码？
                    </button>
                    <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
                      <DialogContent className="bg-zinc-900 border-zinc-700 text-white">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Mail className="w-5 h-5 text-blue-400" />
                            忘记密码
                          </DialogTitle>
                        </DialogHeader>
                        {resetSent ? (
                          <div className="py-4 text-center">
                            <p className="text-green-400 mb-2">✓ 密码重置邮件已发送！</p>
                            <p className="text-zinc-400 text-sm">请检查您的邮箱获取重置链接</p>
                            <div className="mt-4 flex justify-center">
                              <Button
                                variant="outline"
                                onClick={resetForgotPassword}
                                className="border-zinc-700"
                              >
                                <X className="w-4 h-4 mr-1" />
                                关闭
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <form onSubmit={handleForgotPassword} className="space-y-4 mt-4">
                            <Input
                              type="email"
                              placeholder="请输入注册时的邮箱"
                              value={forgotPasswordEmail}
                              onChange={(e) => setForgotPasswordEmail(e.target.value)}
                              required
                              className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500"
                            />
                            <div className="flex gap-2">
                              <Button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black"
                              >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                发送重置链接
                              </Button>
                              <Button variant="outline" className="border-zinc-700" onClick={() => setForgotOpen(false)}>
                                取消
                              </Button>
                            </div>
                          </form>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="flex rounded-md overflow-hidden border border-zinc-700 text-sm">
                    <button type="button"
                      onClick={() => setRegisterMode('username')}
                      className={`flex-1 py-1.5 transition-colors ${registerMode === 'username' ? 'bg-amber-500 text-black font-semibold' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                    >用户名注册</button>
                    <button type="button"
                      onClick={() => setRegisterMode('email')}
                      className={`flex-1 py-1.5 transition-colors ${registerMode === 'email' ? 'bg-amber-500 text-black font-semibold' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                    >邮箱注册</button>
                  </div>
                  <Input
                    type="text"
                    placeholder="用户名（登录时使用）"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                    required
                    className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500 focus:border-amber-500/50"
                  />
                  {registerMode === 'email' && (
                    <Input
                      type="email"
                      placeholder="邮箱（可用于找回密码）"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      required
                      className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500 focus:border-amber-500/50"
                    />
                  )}
                  {registerMode === 'username' && (
                    <p className="text-xs text-zinc-500">无需邮箱，用户名即账号，请牢记用户名和密码</p>
                  )}
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="密码（至少6位）"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      required
                      className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500 focus:border-amber-500/50 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    注册并开始冒险
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-zinc-600 text-xs mt-4">
          AI 生成内容，仅供娱乐
        </p>
      </div>
    </div>
  )
}
