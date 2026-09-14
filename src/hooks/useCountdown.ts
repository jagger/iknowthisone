import { useState, useEffect } from 'react'

export function useCountdown(wordDrawnAt: number | null, totalSeconds: number): number {
  const [seconds, setSeconds] = useState(totalSeconds)

  useEffect(() => {
    if (wordDrawnAt === null) {
      setSeconds(totalSeconds)
      return
    }

    const tick = () => {
      const elapsed = (Date.now() - wordDrawnAt) / 1000
      setSeconds(Math.max(0, Math.round(totalSeconds - elapsed)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [wordDrawnAt, totalSeconds])

  return seconds
}
