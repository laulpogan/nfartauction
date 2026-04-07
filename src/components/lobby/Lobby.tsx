import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { NeighborhoodProvider } from '../../contexts/NeighborhoodContext'
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
    <NeighborhoodProvider neighborhood="gallery">
      <div className="min-h-screen bg-paper text-ink font-label flex flex-col items-center justify-center p-4">
        <div className="relative z-10 w-full max-w-md">
          <motion.div className="text-center mb-10" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-6xl font-black text-ink tracking-[0.18em] uppercase">
              NF<span className="text-[var(--color-accent)]">Art</span>
            </h1>
            <p className="text-ink-soft text-sm mt-2 tracking-[0.18em] uppercase">Modern Art Auction — Multiplayer</p>
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
                  className="w-full bg-paper border border-ink rounded-xl px-4 py-3 text-ink text-lg placeholder-ink-soft focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                  maxLength={20}
                />
                <Button variant="gold" size="lg" className="w-full" onClick={() => setMode('create')} disabled={!displayName.trim()}>
                  Create Game
                </Button>
                <Button variant="secondary" size="lg" className="w-full" onClick={() => setMode('join')} disabled={!displayName.trim()}>
                  Join Game
                </Button>
                {!displayName.trim() && <p className="text-ink-soft text-xs text-center uppercase tracking-[0.18em]">Enter your name to continue</p>}
              </motion.div>
            )}

            {mode === 'create' && (
              <motion.div key="create" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-paper border-2 border-ink rounded-2xl p-6 space-y-4">
                <h2 className="text-xl font-bold text-ink uppercase tracking-[0.18em]">Create a Game</h2>
                <p className="text-ink-soft text-sm">You'll be the host. Share the room code with 1–4 friends.</p>
                <div className="bg-paper border border-rule rounded-xl p-3 flex items-center gap-3">
                  <span className="text-ink-soft text-sm uppercase tracking-[0.18em]">Playing as:</span>
                  <span className="text-[var(--color-accent)] font-bold">{displayName}</span>
                </div>
                {error && <p className="text-[var(--color-stamp)] text-sm uppercase tracking-[0.18em]">{error}</p>}
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => { setMode('home'); setError(null) }}>Back</Button>
                  <Button variant="gold" className="flex-1" onClick={handleCreate}>Create Room</Button>
                </div>
              </motion.div>
            )}

            {mode === 'join' && (
              <motion.div key="join" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-paper border-2 border-ink rounded-2xl p-6 space-y-4">
                <h2 className="text-xl font-bold text-ink uppercase tracking-[0.18em]">Join a Game</h2>
                <p className="text-ink-soft text-sm">Enter the 4-letter room code from your host.</p>
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && joinCode.length === 4 && handleJoin()}
                  placeholder="ROOM CODE"
                  className="w-full bg-paper border border-ink rounded-xl px-4 py-3 text-ink text-2xl font-bold text-center tracking-[0.18em] uppercase placeholder-ink-soft focus:outline-none focus:border-[var(--color-accent)]"
                  maxLength={4}
                />
                {error && <p className="text-[var(--color-stamp)] text-sm uppercase tracking-[0.18em]">{error}</p>}
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => { setMode('home'); setError(null) }}>Back</Button>
                  <Button variant="primary" className="flex-1" onClick={handleJoin} disabled={joinCode.length !== 4}>
                    Join Room
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div className="mt-8 bg-paper border border-rule rounded-2xl p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <h3 className="text-ink-soft text-xs font-semibold uppercase tracking-[0.18em] mb-2">Quick Rules</h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-ink-soft uppercase tracking-[0.18em]">
              <div><span className="text-ink">Open</span> — Free bidding</div>
              <div><span className="text-ink">Once Around</span> — One bid each</div>
              <div><span className="text-ink">Sealed Bid</span> — Hidden bids</div>
              <div><span className="text-ink">Fixed Price</span> — Take it or leave it</div>
              <div><span className="text-ink">Double</span> — Play two cards</div>
              <div><span className="text-ink">Top 3</span> — $30k/$20k/$10k</div>
            </div>
          </motion.div>
        </div>
      </div>
    </NeighborhoodProvider>
  )
}
