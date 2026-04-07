import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function Lobby() {
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home')
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('ma_display_name') ?? '')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  function handleCreate() {
    if (!displayName.trim()) { setError('Enter your name'); return }
    const code = generateCode()
    localStorage.setItem('ma_display_name', displayName.trim())
    sessionStorage.setItem(`host_${code}`, 'true')
    navigate(`/game/${code}?name=${encodeURIComponent(displayName.trim())}`)
  }

  function handleJoin() {
    if (!displayName.trim()) { setError('Enter your name'); return }
    if (joinCode.length !== 4) { setError('Enter a 4-letter code'); return }
    localStorage.setItem('ma_display_name', displayName.trim())
    navigate(`/game/${joinCode}?name=${encodeURIComponent(displayName.trim())}`)
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-900/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-900/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <motion.div className="text-center mb-10" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-6xl font-black text-white tracking-tighter">
            NF<span className="text-amber-400">Art</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-2 tracking-wide">Modern Art Auction — Multiplayer</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {mode === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-3">
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && displayName.trim() && setMode('create')}
                placeholder="Your name"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-lg placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                maxLength={20}
              />
              <Button variant="gold" size="lg" className="w-full" onClick={() => setMode('create')} disabled={!displayName.trim()}>
                Create Game
              </Button>
              <Button variant="secondary" size="lg" className="w-full" onClick={() => setMode('join')} disabled={!displayName.trim()}>
                Join Game
              </Button>
              {!displayName.trim() && <p className="text-zinc-600 text-xs text-center">Enter your name to continue</p>}
            </motion.div>
          )}

          {mode === 'create' && (
            <motion.div key="create" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold text-white">Create a Game</h2>
              <p className="text-zinc-400 text-sm">You'll be the host. Share the room code with 1–4 friends.</p>
              <div className="bg-zinc-800 rounded-xl p-3 flex items-center gap-3">
                <span className="text-zinc-400 text-sm">Playing as:</span>
                <span className="text-amber-400 font-bold">{displayName}</span>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => { setMode('home'); setError(null) }}>Back</Button>
                <Button variant="gold" className="flex-1" onClick={handleCreate}>Create Room</Button>
              </div>
            </motion.div>
          )}

          {mode === 'join' && (
            <motion.div key="join" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold text-white">Join a Game</h2>
              <p className="text-zinc-400 text-sm">Enter the 4-letter room code from your host.</p>
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && joinCode.length === 4 && handleJoin()}
                placeholder="ROOM CODE"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-2xl font-bold text-center tracking-widest uppercase placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                maxLength={4}
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => { setMode('home'); setError(null) }}>Back</Button>
                <Button variant="primary" className="flex-1" onClick={handleJoin} disabled={joinCode.length !== 4}>
                  Join Room
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div className="mt-8 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">Quick Rules</h3>
          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
            <div>🔨 <span className="text-zinc-400">Open</span> — Free bidding</div>
            <div>🔄 <span className="text-zinc-400">Once Around</span> — One bid each</div>
            <div>🤫 <span className="text-zinc-400">Sealed Bid</span> — Hidden bids</div>
            <div>🏷️ <span className="text-zinc-400">Fixed Price</span> — Take it or leave it</div>
            <div>✌️ <span className="text-zinc-400">Double</span> — Play two cards</div>
            <div>🥇 <span className="text-zinc-400">Top 3</span> — $30k/$20k/$10k</div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
