import { useEffect, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from '../firebase'

export interface GameLogIndexEntry {
  key: string
  roomCode: string
  createdAt: number
}

export function useGameLogIndex(): { entries: GameLogIndexEntry[]; loading: boolean; error: string | null } {
  const [entries, setEntries] = useState<GameLogIndexEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return onValue(
      ref(db, 'gameLogIndex'),
      (snap) => {
        if (!snap.exists()) {
          setEntries([])
          setLoading(false)
          return
        }
        const val = snap.val() as Record<string, { roomCode: string; createdAt: number }>
        const list: GameLogIndexEntry[] = Object.entries(val).map(([key, data]) => ({
          key,
          roomCode: data.roomCode,
          createdAt: data.createdAt,
        }))
        list.sort((a, b) => b.createdAt - a.createdAt)
        setEntries(list)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
  }, [])

  return { entries, loading, error }
}
