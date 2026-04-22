import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ref, get, set, serverTimestamp } from 'firebase/database'
import { db, auth } from '../../firebase'

export default function JoinScreen() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const join = async () => {
      const user = auth.currentUser
      if (!user || !roomCode) return

      try {
        const playerRef = ref(db, `rooms/${roomCode}/players/${user.uid}`)
        const snap = await get(playerRef)

        if (snap.exists()) {
          // Reconnecting — just update connected flag
          await set(ref(db, `rooms/${roomCode}/players/${user.uid}/connected`), true)
        } else {
          // New join — write player record (identityIndex assigned by Cloud Function)
          await set(playerRef, {
            name: user.displayName ?? user.email ?? 'Player',
            score: 0,
            muted: false,
            hasVoted: false,
            connected: true,
            identityIndex: 0, // CF will overwrite this via onPlayerJoin
            joinedAt: serverTimestamp(),
          })
        }

        navigate(`/play/${roomCode}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join room')
      }
    }

    join()
  }, [roomCode, navigate])

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ fontFamily: 'var(--font-body)', color: 'var(--danger)', fontWeight: 700 }}>{error}</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 32, letterSpacing: '0.1em' }}>
        Joining {roomCode}…
      </div>
    </div>
  )
}
