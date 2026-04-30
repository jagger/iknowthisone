import { useEffect, useState } from 'react'
import { onValue } from 'firebase/database'
import { roomRef } from '../firebase'
import type { RoomData, RoomMeta, Player, CategoryChoice } from '../types/game'

interface UseGameStateResult {
  meta: RoomMeta | null
  players: Record<string, Player>
  categoryChoice: CategoryChoice | null
  skipVotes: Record<string, boolean>
  loading: boolean
  error: string | null
}

export function useGameState(roomCode: string): UseGameStateResult {
  const [result, setResult] = useState<UseGameStateResult>({
    meta: null,
    players: {},
    categoryChoice: null,
    skipVotes: {},
    loading: true,
    error: null,
  })

  useEffect(() => {
    if (!roomCode) return

    // Allow 3s for RTDB write propagation before declaring a room not found.
    // This prevents a blank/error flash when navigating immediately after createRoom.
    let resolved = false
    const notFoundTimer = setTimeout(() => {
      if (!resolved) {
        setResult({ meta: null, players: {}, categoryChoice: null, skipVotes: {}, loading: false, error: 'Room not found' })
      }
    }, 3000)

    const unsubscribe = onValue(
      roomRef(roomCode),
      (snapshot) => {
        if (!snapshot.exists()) return // keep loading until timer fires
        resolved = true
        clearTimeout(notFoundTimer)
        const data = snapshot.val() as Partial<RoomData>
        setResult({
          meta: (data.meta as RoomMeta) ?? null,
          players: (data.players as Record<string, Player>) ?? {},
          categoryChoice: (data.categoryChoice as CategoryChoice) ?? null,
          skipVotes: (data.skipVotes as Record<string, boolean>) ?? {},
          loading: false,
          error: null,
        })
      },
      (err) => {
        resolved = true
        clearTimeout(notFoundTimer)
        setResult((prev) => ({ ...prev, loading: false, error: err.message }))
      },
    )

    return () => {
      clearTimeout(notFoundTimer)
      unsubscribe()
    }
  }, [roomCode])

  return result
}
