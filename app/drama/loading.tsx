import { Loader2 } from 'lucide-react'

export default function DramaLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        <p className="text-sm text-zinc-500">加载短剧工作室...</p>
      </div>
    </div>
  )
}
