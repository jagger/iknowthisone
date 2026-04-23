import { useEffect } from 'react'
import { ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database'
import { db } from '../firebase'

export function usePresence(roomCode: string, uid: string | null) {
  useEffect(() => {
    if (!roomCode || !uid) return

    const connectedRef = ref(db, '.info/connected')
    const playerConnectedRef = ref(db, `rooms/${roomCode}/players/${uid}/connected`)
    const playerDisconnectedAtRef = ref(db, `rooms/${roomCode}/players/${uid}/disconnectedAt`)

    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(playerConnectedRef).set(false)
        onDisconnect(playerDisconnectedAtRef).set(serverTimestamp())
        set(playerConnectedRef, true)
      }
    })

    return () => {
      unsubscribe()
      set(playerConnectedRef, false)
      set(playerDisconnectedAtRef, serverTimestamp())
    }
  }, [roomCode, uid])
}
