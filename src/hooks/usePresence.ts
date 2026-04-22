import { useEffect } from 'react'
import { ref, onValue, onDisconnect, set } from 'firebase/database'
import { db } from '../firebase'

export function usePresence(roomCode: string, uid: string | null) {
  useEffect(() => {
    if (!roomCode || !uid) return

    const connectedRef = ref(db, '.info/connected')
    const playerConnectedRef = ref(db, `rooms/${roomCode}/players/${uid}/connected`)

    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(playerConnectedRef).set(false)
        set(playerConnectedRef, true)
      }
    })

    return () => {
      unsubscribe()
      set(playerConnectedRef, false)
    }
  }, [roomCode, uid])
}
