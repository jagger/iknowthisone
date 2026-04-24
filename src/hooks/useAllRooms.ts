import { useEffect, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from '../firebase'
import type { RoomMeta, Player } from '../types/game'

export interface RoomSummary {
  roomCode: string
  meta: RoomMeta
  playerCount: number
}

export function useAllRooms(): { rooms: RoomSummary[]; loading: boolean } {
  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onValue(ref(db, 'rooms'), (snap) => {
      if (!snap.exists()) {
        setRooms([])
        setLoading(false)
        return
      }
      const val = snap.val() as Record<string, {
        meta: RoomMeta
        players?: Record<string, Player>
      }>
      const list: RoomSummary[] = Object.entries(val).map(([roomCode, data]) => ({
        roomCode,
        meta: data.meta,
        playerCount: data.players
          ? Object.values(data.players).filter((p) => p.connected !== false).length
          : 0,
      }))
      list.sort((a, b) => (b.meta.createdAt ?? 0) - (a.meta.createdAt ?? 0))
      setRooms(list)
      setLoading(false)
    })
  }, [])

  return { rooms, loading }
}
