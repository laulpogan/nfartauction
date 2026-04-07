import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, key, {
  realtime: { params: { eventsPerSecond: 10 } },
})

// ─── DB helpers ──────────────────────────────────────────────────────────────

export async function getGame(gameId: string) {
  const { data, error } = await supabase
    .from('ma_games')
    .select('*')
    .eq('id', gameId)
    .single()
  if (error) throw error
  return data
}

export async function getGameByCode(code: string) {
  const { data, error } = await supabase
    .from('ma_games')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()
  if (error) throw error
  return data
}

export async function getPlayers(gameId: string) {
  const { data, error } = await supabase
    .from('ma_players')
    .select('*')
    .eq('game_id', gameId)
    .order('position')
  if (error) throw error
  return data
}

export async function getMyPlayer(gameId: string, sessionId: string) {
  const { data, error } = await supabase
    .from('ma_players')
    .select('*')
    .eq('game_id', gameId)
    .eq('session_id', sessionId)
    .single()
  if (error) throw error
  return data
}

export async function updateGame(gameId: string, patch: object) {
  const { error } = await supabase
    .from('ma_games')
    .update(patch)
    .eq('id', gameId)
  if (error) throw error
}

export async function updatePlayer(playerId: string, patch: object) {
  const { error } = await supabase
    .from('ma_players')
    .update(patch)
    .eq('id', playerId)
  if (error) throw error
}

export async function updateAllPlayers(players: { id: string; [k: string]: unknown }[]) {
  // Batch update — upsert works well here
  const { error } = await supabase
    .from('ma_players')
    .upsert(players, { onConflict: 'id' })
  if (error) throw error
}
