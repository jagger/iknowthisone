import { useState, useEffect } from 'react'
import type { RoomMeta } from '../types/game'

interface HintReveal {
  showYear: boolean
  showTitle: boolean
  titleText: string | undefined
}

export function useHintReveal(hint: RoomMeta['hint']): HintReveal {
  const [hintElapsed, setHintElapsed] = useState(0)

  useEffect(() => {
    if (!hint?.startedAt) {
      setHintElapsed(0)
      return
    }
    setHintElapsed(Date.now() - hint.startedAt)
    const id = setInterval(() => {
      setHintElapsed(Date.now() - hint.startedAt)
    }, 500)
    return () => clearInterval(id)
  }, [hint?.startedAt])

  const showYear = !!hint && hintElapsed >= 5000
  const showTitle = !!hint && hintElapsed >= 15000
  const titleText = hint && hintElapsed >= 25000 ? hint.fullTitle : hint?.partialTitle

  return { showYear, showTitle, titleText }
}
