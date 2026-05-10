import { Loader2 } from 'lucide-react'

export default function GameLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        <p className="text-sm text-zinc-500">加载中...</p>
      </div>
    </div>
  )
}
