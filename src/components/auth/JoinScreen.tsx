import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ref, get, set, update } from 'firebase/database'
import { httpsCallable } from 'firebase/functions'
import { db, auth, functions } from '../../firebase'
import PhoneGameView from '../phone/PhoneGameView'

export default function JoinScreen() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const [searchParams] = useSearchParams()
  const hostToken = searchParams.get('hostToken')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const join = async () => {
      const user = auth.currentUser
      if (!user || !roomCode) return

      try {
        const playerRef = ref(db, `rooms/${roomCode}/players/${user.uid}`)
        const snap = await get(playerRef)

        if (snap.exists()) {
          await set(ref(db, `rooms/${roomCode}/players/${user.uid}/connected`), true)
        } else {
          await update(playerRef, {
            name: user.displayName ?? 'Player',
            connected: true,
          })
        }

        if (hostToken) {
          const claimHost = httpsCallable(functions, 'claimHost')
          await claimHost({ roomCode, hostToken })
        }

        setReady(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join room')
      }
    }

    join()
  }, [roomCode, hostToken])

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ fontFamily: 'var(--font-body)', color: 'var(--danger)', fontWeight: 700 }}>{error}</div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 32, letterSpacing: '0.1em' }}>
          Joining {roomCode}…
        </div>
      </div>
    )
  }

  return <PhoneGameView />
}
