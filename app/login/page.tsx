'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sword, Eye, EyeOff, Loader2, Mail, X, User, Lock } from 'lucide-react'
import { toast } from 'sonner'

function getPasswordStrength(password: string) {
  if (!password) return null
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 10) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  if (score <= 1) return { label: '弱', color: 'bg-red-500', width: '20%', textColor: 'text-red-400' }
  if (score <= 2) return { label: '较弱', color: 'bg-orange-500', width: '40%', textColor: 'text-orange-400' }
  if (score <= 3) return { label: '中等', color: 'bg-yellow-500', width: '60%', textColor: 'text-yellow-400' }
  if (score <= 4) return { label: '强', color: 'bg-green-500', width: '80%', textColor: 'text-green-400' }
  return { label: '非常强', color: 'bg-emerald-400', width: '100%', textColor: 'text-emerald-400' }
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [loginForm, setLoginForm] = useState({ emailOrUsername: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ email: '', password: '', username: '' })
  const [registerMode, setRegisterMode] = useState<'username' | 'email'>('username')
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('login')
  const [shaking, setShaking] = useState(false)

  const loginInputRef = useRef<HTMLInputElement>(null)
  const registerInputRef = useRef<HTMLInputElement>(null)
  const forgotInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus first input on tab switch
  useEffect(() => {
    const id = setTimeout(() => {
      if (activeTab === 'login') {
        loginInputRef.current?.focus()
      } else {
        registerInputRef.current?.focus()
      }
    }, 150)
    return () => clearTimeout(id)
  }, [activeTab])

  // Focus email input when forgot dialog opens
  useEffect(() => {
    if (forgotOpen) {
      const id = setTimeout(() => forgotInputRef.current?.focus(), 200)
      return () => clearTimeout(id)
    }
  }, [forgotOpen])

  const triggerShake = useCallback(() => {
    setShaking(true)
    setTimeout(() => setShaking(false), 500)
  }, [])

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
      triggerShake()
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
      triggerShake()
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
        triggerShake()
      } else {
        await supabase.auth.signInWithPassword({
          email: finalEmail,
          password: registerForm.password,
        })
        toast.success('注册成功！正在进入游戏...')
        router.push('/game')
        router.refresh()
      }
    } catch {
      toast.error('注册失败', { description: '网络错误' })
      triggerShake()
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

  const passwordStrength = getPasswordStrength(registerForm.password)

  return (
    <>
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) translateX(0px) scale(1); }
          33% { transform: translateY(-15px) translateX(8px) scale(1.05); }
          66% { transform: translateY(-25px) translateX(-8px) scale(0.95); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 50%, 90% { transform: translateX(-4px); }
          30%, 70% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>

      <div className="relative min-h-screen flex items-center justify-center bg-zinc-950 overflow-hidden isolate">
        {/* 背景径向渐变 */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/20 via-zinc-950 to-zinc-950" />

        {/* 浮动灵气粒子 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-amber-500/3 blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute top-3/4 left-2/3 w-96 h-96 rounded-full bg-yellow-500/3 blur-3xl animate-pulse" style={{ animationDuration: '12s', animationDelay: '-4s' }} />
          <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-orange-500/2 blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '-2s' }} />
          {[
            { s: 80, l: '10%', t: '20%', d: 18, del: '0s' },
            { s: 120, l: '75%', t: '60%', d: 28, del: '-2s' },
            { s: 60, l: '50%', t: '10%', d: 15, del: '-4s' },
            { s: 100, l: '85%', t: '80%', d: 24, del: '-1s' },
            { s: 70, l: '20%', t: '70%', d: 20, del: '-3s' },
            { s: 90, l: '40%', t: '40%', d: 30, del: '-5s' },
            { s: 50, l: '65%', t: '85%', d: 16, del: '-6s' },
            { s: 110, l: '30%', t: '30%', d: 26, del: '-7s' },
          ].map((p, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-gradient-to-br from-amber-400/5 to-yellow-500/5 blur-xl"
              style={{
                width: p.s,
                height: p.s,
                left: p.l,
                top: p.t,
                animation: `float-slow ${p.d}s ease-in-out infinite`,
                animationDelay: p.del,
              }}
            />
          ))}
        </div>

        {/* 主内容 */}
        <div className="relative z-10 w-full max-w-md px-4 animate-in fade-in duration-700 fill-mode-both">
          {/* Logo 区域 */}
          <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/15 to-amber-500/5 border border-amber-500/25 mb-4 shadow-[0_0_20px_rgba(251,191,36,0.08)]">
              <Sword className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">文字冒险</h1>
            <p className="text-zinc-500 mt-1.5 text-sm">AI 驱动的沉浸式文字游戏</p>
          </div>

          {/* 登录卡片 */}
          <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both">
            <div className="relative">
              {/* 顶部渐变光晕边框（Card overflow-hidden 会裁剪伪元素，故用外层 wrapper） */}
              <div className="pointer-events-none absolute -inset-[1px] rounded-xl bg-gradient-to-b from-amber-500/20 to-transparent" />
              <div className="pointer-events-none absolute inset-0 rounded-xl shadow-[inset_0_1px_0_rgba(251,191,36,0.06)]" />
              <Card className="relative bg-zinc-900/80 border-zinc-700/40 backdrop-blur-xl shadow-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-lg">进入游戏</CardTitle>
                <CardDescription className="text-zinc-500">
                  登录或注册账号开始你的冒险
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full bg-zinc-800/80 mb-5 p-0.5">
                    <TabsTrigger
                      value="login"
                      className="flex-1 data-[state=active]:bg-zinc-700 data-[state=active]:text-white data-[state=active]:shadow-sm text-zinc-400 transition-all duration-200"
                    >
                      登录
                    </TabsTrigger>
                    <TabsTrigger
                      value="register"
                      className="flex-1 data-[state=active]:bg-zinc-700 data-[state=active]:text-white data-[state=active]:shadow-sm text-zinc-400 transition-all duration-200"
                    >
                      注册
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="mt-0">
                    <form onSubmit={handleLogin} className={`space-y-4${shaking ? ' animate-shake' : ''}`} key="login-form">
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                        <Input
                          ref={loginInputRef}
                          type="text"
                          placeholder="用户名 或 邮箱"
                          value={loginForm.emailOrUsername}
                          onChange={(e) => setLoginForm({ ...loginForm, emailOrUsername: e.target.value })}
                          required
                          className="bg-zinc-800/80 border-zinc-600/60 text-white placeholder:text-zinc-500 pl-9 focus-visible:border-amber-500/50 focus-visible:shadow-[0_0_12px_rgba(251,191,36,0.1)] transition-shadow duration-200"
                        />
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                        <Input
                          type={showLoginPassword ? 'text' : 'password'}
                          placeholder="密码"
                          value={loginForm.password}
                          onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                          required
                          className="bg-zinc-800/80 border-zinc-600/60 text-white placeholder:text-zinc-500 pl-9 pr-10 focus-visible:border-amber-500/50 focus-visible:shadow-[0_0_12px_rgba(251,191,36,0.1)] transition-shadow duration-200"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                          tabIndex={-1}
                        >
                          {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => { setResetSent(false); setForgotPasswordEmail(''); setForgotOpen(true); }}
                          className="text-xs text-zinc-500 hover:text-amber-400 transition-colors"
                        >
                          忘记密码？
                        </button>
                      </div>
                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-amber-500 hover:bg-amber-400 hover:shadow-[0_0_20px_rgba(251,191,36,0.25)] text-black font-semibold transition-all duration-200 active:scale-[0.98]"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        登录
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="register" className="mt-0">
                    {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
                    <form onSubmit={handleRegister} className={`space-y-4${shaking ? ' animate-shake' : ''}`} key="register-form">
                      <div className="flex rounded-md overflow-hidden border border-zinc-700/60 text-sm">
                        <button
                          type="button"
                          onClick={() => setRegisterMode('username')}
                          className={`flex-1 py-1.5 transition-all duration-200 ${
                            registerMode === 'username'
                              ? 'bg-amber-500 text-black font-semibold shadow-sm'
                              : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
                          }`}
                        >
                          用户名注册
                        </button>
                        <button
                          type="button"
                          onClick={() => setRegisterMode('email')}
                          className={`flex-1 py-1.5 transition-all duration-200 ${
                            registerMode === 'email'
                              ? 'bg-amber-500 text-black font-semibold shadow-sm'
                              : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
                          }`}
                        >
                          邮箱注册
                        </button>
                      </div>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                        <Input
                          ref={registerInputRef}
                          type="text"
                          placeholder="用户名（登录时使用）"
                          value={registerForm.username}
                          onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                          required
                          className="bg-zinc-800/80 border-zinc-600/60 text-white placeholder:text-zinc-500 pl-9 focus-visible:border-amber-500/50 focus-visible:shadow-[0_0_12px_rgba(251,191,36,0.1)] transition-shadow duration-200"
                        />
                      </div>
                      {registerMode === 'email' && (
                        <div className="relative animate-in fade-in slide-in-from-top-1 duration-200 fill-mode-both">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                          <Input
                            type="email"
                            placeholder="邮箱（可用于找回密码）"
                            value={registerForm.email}
                            onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                            required
                            className="bg-zinc-800/80 border-zinc-600/60 text-white placeholder:text-zinc-500 pl-9 focus-visible:border-amber-500/50 focus-visible:shadow-[0_0_12px_rgba(251,191,36,0.1)] transition-shadow duration-200"
                          />
                        </div>
                      )}
                      {registerMode === 'username' && (
                        <p className="text-xs text-zinc-500 animate-in fade-in duration-200 fill-mode-both">
                          无需邮箱，用户名即账号，请牢记用户名和密码
                        </p>
                      )}
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                        <Input
                          type={showRegisterPassword ? 'text' : 'password'}
                          placeholder="密码（至少6位）"
                          value={registerForm.password}
                          onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                          required
                          className="bg-zinc-800/80 border-zinc-600/60 text-white placeholder:text-zinc-500 pl-9 pr-10 focus-visible:border-amber-500/50 focus-visible:shadow-[0_0_12px_rgba(251,191,36,0.1)] transition-shadow duration-200"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                          tabIndex={-1}
                        >
                          {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* 密码强度指示器 */}
                      {passwordStrength && (
                        <div className="animate-in fade-in slide-in-from-top-1 duration-200 fill-mode-both">
                          <div className="flex gap-1 h-1">
                            <div className={`flex-1 rounded-full transition-all duration-300 ${passwordStrength.width !== '20%' ? passwordStrength.color : 'bg-zinc-700'}`} />
                            <div className={`flex-1 rounded-full transition-all duration-300 ${passwordStrength.width === '40%' || passwordStrength.width === '60%' || passwordStrength.width === '80%' || passwordStrength.width === '100%' ? passwordStrength.color : 'bg-zinc-700'}`} />
                            <div className={`flex-1 rounded-full transition-all duration-300 ${passwordStrength.width === '60%' || passwordStrength.width === '80%' || passwordStrength.width === '100%' ? passwordStrength.color : 'bg-zinc-700'}`} />
                            <div className={`flex-1 rounded-full transition-all duration-300 ${passwordStrength.width === '80%' || passwordStrength.width === '100%' ? passwordStrength.color : 'bg-zinc-700'}`} />
                            <div className={`flex-1 rounded-full transition-all duration-300 ${passwordStrength.width === '100%' ? passwordStrength.color : 'bg-zinc-700'}`} />
                          </div>
                          <p className={`text-xs mt-1.5 ${passwordStrength.textColor}`}>
                            密码强度：{passwordStrength.label}
                          </p>
                        </div>
                      )}

                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-amber-500 hover:bg-amber-400 hover:shadow-[0_0_20px_rgba(251,191,36,0.25)] text-black font-semibold transition-all duration-200 active:scale-[0.98]"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        注册并开始冒险
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            </div>
          </div>

          <p className="text-center text-zinc-700 text-xs mt-5">
            AI 生成内容，仅供娱乐
          </p>
        </div>

        {/* 忘记密码弹窗 */}
        <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
          <DialogContent className="bg-zinc-900/95 border-zinc-700/50 text-white backdrop-blur-xl shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Mail className="w-5 h-5 text-amber-400" />
                忘记密码
              </DialogTitle>
            </DialogHeader>
            {resetSent ? (
              <div className="py-6 text-center animate-in fade-in zoom-in-95 duration-200 fill-mode-both">
                <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-green-400 font-medium mb-1">密码重置邮件已发送！</p>
                <p className="text-zinc-400 text-sm">请检查您的邮箱获取重置链接</p>
                <Button
                  variant="outline"
                  onClick={resetForgotPassword}
                  className="mt-6 border-zinc-700 text-zinc-300 hover:text-white"
                >
                  <X className="w-4 h-4 mr-1" />
                  关闭
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4 mt-2">
                <p className="text-sm text-zinc-400">输入注册时使用的邮箱，我们将发送密码重置链接。</p>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  <Input
                    ref={forgotInputRef}
                    type="email"
                    placeholder="请输入注册时的邮箱"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    required
                    className="bg-zinc-800/80 border-zinc-600/60 text-white placeholder:text-zinc-500 pl-9 focus-visible:border-amber-500/50"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 hover:shadow-[0_0_16px_rgba(251,191,36,0.2)] text-black transition-all duration-200"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    发送重置链接
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-zinc-700 text-zinc-300 hover:text-white"
                    onClick={() => setForgotOpen(false)}
                  >
                    取消
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
