// Cloud Functions — all server-side game authority.
// Requires Firebase Blaze plan. Local dev: firebase emulators:start
// Cloud Tasks queue: gcloud tasks queues create game-timers --location=us-central1

import * as admin from 'firebase-admin'
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import { onValueCreated, onValueWritten } from 'firebase-functions/v2/database'
import { CloudTasksClient } from '@google-cloud/tasks'
import * as wordsData from './words.json'

admin.initializeApp()
const db = admin.database()

// Cloud Tasks client — only available in deployed environment
let tasksClient: CloudTasksClient | null = null
const getTasksClient = () => {
  if (!tasksClient) tasksClient = new CloudTasksClient()
  return tasksClient
}

const PROJECT = process.env.GCLOUD_PROJECT ?? 'iknowthisone-8da5a'
const LOCATION = 'us-central1'
const QUEUE = 'game-timers'
const FUNCTIONS_URL = `https://${LOCATION}-${PROJECT}.cloudfunctions.net`

// ─── Helpers ─────────────────────────────────────────────────────────────────

function candidateCode(): string {
  const categories = Object.keys(WORDS)
  const words = WORDS[categories[Math.floor(Math.random() * categories.length)]]
  const word = words[Math.floor(Math.random() * words.length)]
  const digits = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `${word}-${digits}`.toUpperCase()
}

function randomToken(len = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjklmnpqrstuvwxyz0123456789'
  let t = ''
  for (let i = 0; i < len; i++) t += chars[Math.floor(Math.random() * chars.length)]
  return t
}

async function enqueueTask(
  endpoint: string,
  payload: object,
  delaySeconds: number,
): Promise<string> {
  const client = getTasksClient()
  const queue = client.queuePath(PROJECT, LOCATION, QUEUE)
  const deliverAt = Date.now() / 1000 + delaySeconds
  const [response] = await client.createTask({
    parent: queue,
    task: {
      httpRequest: {
        httpMethod: 'POST',
        url: `${FUNCTIONS_URL}/${endpoint}`,
        headers: { 'Content-Type': 'application/json' },
        body: Buffer.from(JSON.stringify(payload)).toString('base64'),
      },
      scheduleTime: { seconds: Math.floor(deliverAt) },
    },
  })
  return response.name ?? ''
}

async function cancelTask(taskName: string | undefined): Promise<void> {
  if (!taskName) return
  try {
    await getTasksClient().deleteTask({ name: taskName })
  } catch {
    // Task may have already fired — ignore
  }
}

const WORDS = wordsData as Record<string, string[]>

function drawWord(category: string, usedWords: string[]): string {
  const categories = Object.keys(WORDS)
  const pool = WORDS[category] ?? WORDS[categories[0]]
  const available = pool.filter((w) => !usedWords.includes(w))
  if (available.length === 0) return pool[Math.floor(Math.random() * pool.length)]
  return available[Math.floor(Math.random() * available.length)]
}

function randomCategories(count: number, exclude?: string): string[] {
  const all = Object.keys(WORDS).filter((c) => c !== exclude)
  return all.sort(() => Math.random() - 0.5).slice(0, count)
}

// ─── createRoom ───────────────────────────────────────────────────────────────

export const createRoom = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in')

  let roomCode = ''
  let attempts = 0
  const hostToken = randomToken()

  while (attempts < 10) {
    const candidate = candidateCode()
    const result = await db.ref().transaction((root) => {
      if (!root) root = {}
      if (!root.rooms) root.rooms = {}
      if (root.rooms[candidate]) return // abort — code taken
      root.rooms[candidate] = {
        meta: {
          state: 'LOBBY',
          hostId: null,
          hostToken,
          pointsToWin: 10,
          createdAt: admin.database.ServerValue.TIMESTAMP,
          currentWord: '',
          currentCategory: 'General',
          activeSinger: null,
          wordDrawnAt: null,
          singingStartedAt: null,
          voteCloseTriggeredAt: null,
          wordMuteCount: 0,
          wordPointValue: 1,
          timerDurationMs: 120000,
          timerRemainingMs: null,
          consecutiveNoBuzzCount: 0,
          usedWords: {},
        },
      }
      return root
    })

    if (result.committed) {
      roomCode = candidate
      break
    }
    attempts++
  }

  if (!roomCode) throw new HttpsError('resource-exhausted', 'Could not generate room code')
  return { roomCode, hostToken }
})

// ─── claimHost ────────────────────────────────────────────────────────────────

export const claimHost = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in')
  const { roomCode, hostToken } = request.data as { roomCode: string; hostToken: string }
  if (!roomCode || !hostToken) throw new HttpsError('invalid-argument', 'roomCode and hostToken required')

  const metaSnap = await db.ref(`rooms/${roomCode}/meta`).once('value')
  const meta = metaSnap.val()
  if (!meta) throw new HttpsError('not-found', 'Room not found')
  if (meta.hostToken !== hostToken) throw new HttpsError('permission-denied', 'Invalid host token')

  await db.ref(`rooms/${roomCode}/meta/hostId`).set(request.auth.uid)
  return { ok: true }
})

// ─── startGame ────────────────────────────────────────────────────────────────

export const startGame = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in')
  const { roomCode } = request.data as { roomCode: string }
  if (!roomCode) throw new HttpsError('invalid-argument', 'roomCode required')

  const metaRef = db.ref(`rooms/${roomCode}/meta`)
  const snap = await metaRef.once('value')
  const meta = snap.val()

  if (!meta) throw new HttpsError('not-found', 'Room not found')
  if (meta.hostId !== request.auth.uid) throw new HttpsError('permission-denied', 'Only host can start')
  if (meta.state !== 'LOBBY') throw new HttpsError('failed-precondition', 'Game already started')

  const playersSnap = await db.ref(`rooms/${roomCode}/players`).once('value')
  const players = playersSnap.val() ?? {}
  const connected = Object.values(players).filter((p: unknown) => (p as { connected: boolean }).connected !== false)
  if (connected.length < 2) throw new HttpsError('failed-precondition', 'Need at least 2 players')

  const word = drawWord('General', [])
  const now = Date.now()

  await metaRef.update({
    state: 'WORD_REVEAL',
    currentWord: word,
    currentCategory: 'General',
    wordDrawnAt: now,
    wordMuteCount: 0,
    wordPointValue: 1,
    timerDurationMs: 120000,
    timerRemainingMs: null,
    activeSinger: null,
  })

  // Brief WORD_REVEAL display, then transition to BUZZER_OPEN
  await metaRef.update({ state: 'BUZZER_OPEN' })

  const taskName = await enqueueTask('wordTimerTask', { roomCode, wordDrawnAt: now }, 120)
  await metaRef.update({ wordTimerTaskName: taskName })

  return { ok: true }
})

// ─── onPlayerJoin ─────────────────────────────────────────────────────────────

export const onPlayerJoin = onValueCreated(
  { ref: '/rooms/{roomCode}/players/{uid}', region: LOCATION },
  async (event) => {
    const { roomCode, uid } = event.params
    const playersSnap = await db.ref(`rooms/${roomCode}/players`).once('value')
    const players = playersSnap.val() ?? {}
    const existingCount = Object.keys(players).length - 1 // exclude the new player
    const identityIndex = existingCount % 12

    const updates: Record<string, unknown> = {
      [`rooms/${roomCode}/players/${uid}/identityIndex`]: identityIndex,
    }

    // First player to join becomes host if none set yet
    const metaSnap = await db.ref(`rooms/${roomCode}/meta`).once('value')
    const meta = metaSnap.val()
    if (meta && meta.hostId == null) {
      updates[`rooms/${roomCode}/meta/hostId`] = uid
    }

    await db.ref().update(updates)
  },
)

// ─── onBuzzIn ─────────────────────────────────────────────────────────────────

export const onBuzzIn = onValueCreated(
  { ref: '/rooms/{roomCode}/buzzIn/{uid}', region: LOCATION },
  async (event) => {
    const { roomCode, uid } = event.params

    const metaSnap = await db.ref(`rooms/${roomCode}/meta`).once('value')
    const meta = metaSnap.val()
    if (!meta || meta.state !== 'BUZZER_OPEN') return

    // Compute remaining time before cancelling the task
    const elapsed = Date.now() - (meta.wordDrawnAt ?? Date.now())
    const timerDurationMs = meta.timerDurationMs ?? 120000
    const timerRemainingMs = Math.max(timerDurationMs - elapsed, 15000)

    await cancelTask(meta.wordTimerTaskName)

    // Clear buzzIn and skip votes
    await db.ref(`rooms/${roomCode}/buzzIn`).remove()
    await db.ref(`rooms/${roomCode}/skipVotes`).remove()

    // Reset all hasVoted flags and clear previous votes
    await db.ref(`rooms/${roomCode}/votes`).remove()
    const playersSnap = await db.ref(`rooms/${roomCode}/players`).once('value')
    const players = playersSnap.val() ?? {}
    const updates: Record<string, unknown> = {}
    for (const pid of Object.keys(players)) {
      updates[`rooms/${roomCode}/players/${pid}/hasVoted`] = false
    }
    await db.ref().update(updates)

    await db.ref(`rooms/${roomCode}/meta`).update({
      activeSinger: uid,
      singingStartedAt: admin.database.ServerValue.TIMESTAMP,
      state: 'SINGING',
      wordTimerTaskName: null,
      timerRemainingMs,
      consecutiveNoBuzzCount: 0,
    })
  },
)

// ─── onVoteWritten ────────────────────────────────────────────────────────────

export const onVoteWritten = onValueWritten(
  { ref: '/rooms/{roomCode}/votes/{uid}', region: LOCATION },
  async (event) => {
    if (!event.data.after.exists()) return // vote cleared, not cast
    const { roomCode, uid } = event.params

    const metaSnap = await db.ref(`rooms/${roomCode}/meta`).once('value')
    const meta = metaSnap.val()
    if (!meta || (meta.state !== 'SINGING' && meta.state !== 'VOTE_CLOSING')) return

    // Mark voter (only matters for display)
    if (meta.state === 'SINGING') {
      await db.ref(`rooms/${roomCode}/players/${uid}/hasVoted`).set(true)
    }

    // Count eligible voters
    const playersSnap = await db.ref(`rooms/${roomCode}/players`).once('value')
    const players = playersSnap.val() ?? {}
    const eligible = Object.entries(players).filter(
      ([pid, p]: [string, unknown]) => pid !== meta.activeSinger && (p as { connected: boolean }).connected !== false,
    )
    if (eligible.length === 0) return

    // Count actual votes directly
    const votesSnap = await db.ref(`rooms/${roomCode}/votes`).once('value')
    const votes = votesSnap.val() ?? {}
    const votedCount = Object.keys(votes).filter((vid) => vid !== meta.activeSinger).length

    if (votedCount >= eligible.length) {
      // All eligible players voted — close immediately, cancel any pending delay
      await cancelTask(meta.voteCloseTaskName)
      const taskName = await enqueueTask('voteCloseTask', { roomCode }, 2)
      await db.ref(`rooms/${roomCode}/meta`).update({
        state: 'VOTE_CLOSING',
        voteCloseTriggeredAt: admin.database.ServerValue.TIMESTAMP,
        voteCloseTaskName: taskName,
      })
    } else if (meta.state === 'SINGING' && votedCount / eligible.length >= 0.5) {
      // Majority voted — 30s window
      const taskName = await enqueueTask('voteCloseTask', { roomCode }, 30)
      await db.ref(`rooms/${roomCode}/meta`).update({
        state: 'VOTE_CLOSING',
        voteCloseTriggeredAt: admin.database.ServerValue.TIMESTAMP,
        voteCloseTaskName: taskName,
      })
    }
  },
)

// ─── voteCloseTask (Cloud Task target) ────────────────────────────────────────

export const voteCloseTask = onRequest({ region: LOCATION }, async (req, res) => {
  const { roomCode } = req.body as { roomCode: string }
  if (!roomCode) { res.status(400).send('missing roomCode'); return }

  const metaSnap = await db.ref(`rooms/${roomCode}/meta`).once('value')
  const meta = metaSnap.val()
  if (!meta || (meta.state !== 'VOTE_CLOSING' && meta.state !== 'SINGING')) {
    res.status(200).send('stale')
    return
  }

  const votesSnap = await db.ref(`rooms/${roomCode}/votes`).once('value')
  const votes = votesSnap.val() ?? {}
  let pointCount = 0
  let muteCount = 0
  for (const v of Object.values(votes)) {
    if ((v as { value: string }).value === 'point') pointCount++
    else muteCount++
  }

  if (pointCount >= muteCount) {
    // POINT_AWARDED
    const newScore = (meta.activeSinger
      ? ((await db.ref(`rooms/${roomCode}/players/${meta.activeSinger}/score`).once('value')).val() ?? 0)
      : 0) + meta.wordPointValue

    const updates: Record<string, unknown> = {
      [`rooms/${roomCode}/meta/state`]: 'POINT_AWARDED',
      [`rooms/${roomCode}/players/${meta.activeSinger}/score`]: newScore,
    }
    await db.ref().update(updates)

    // Check win condition after 2s, then transition
    const pointTaskName = await enqueueTask(
      'pointAwardedTask',
      { roomCode, winnerId: meta.activeSinger, newScore },
      2,
    )
    await db.ref(`rooms/${roomCode}/meta/pointAwardedTaskName`).set(pointTaskName)
  } else {
    // MUTED — singer failed the vote
    const newMuteCount = (meta.wordMuteCount ?? 0) + 1
    const newPointValue = (meta.wordPointValue ?? 1) + 1
    const playersSnap = await db.ref(`rooms/${roomCode}/players`).once('value')
    const players = playersSnap.val() ?? {}

    // Check if all connected players will be muted after this (including the singer being muted now)
    const connectedPlayers = Object.entries(players).filter(
      ([, p]) => (p as { connected: boolean }).connected !== false,
    )
    const allNowMuted = connectedPlayers.length > 0 && connectedPlayers.every(
      ([pid, p]) => (p as { muted: boolean }).muted || pid === meta.activeSinger,
    )

    const playerUpdates: Record<string, unknown> = {}
    for (const pid of Object.keys(players)) {
      playerUpdates[`rooms/${roomCode}/players/${pid}/hasVoted`] = false
    }

    if (allNowMuted) {
      // All players muted — apply penalty, show for 3s, then auto-pick new word
      const penalty = 1 + Math.floor(connectedPlayers.length / 4)
      for (const [pid] of connectedPlayers) {
        const currentScore = (players[pid] as { score: number }).score ?? 0
        playerUpdates[`rooms/${roomCode}/players/${pid}/score`] = currentScore - penalty
        playerUpdates[`rooms/${roomCode}/players/${pid}/muted`] = false
      }

      await db.ref().update({
        ...playerUpdates,
        [`rooms/${roomCode}/meta/state`]: 'MUTED',
        [`rooms/${roomCode}/meta/activeSinger`]: null,
        [`rooms/${roomCode}/meta/wordMuteCount`]: 0,
        [`rooms/${roomCode}/meta/wordPointValue`]: 1,
        [`rooms/${roomCode}/meta/voteCloseTaskName`]: null,
        [`rooms/${roomCode}/meta/timerRemainingMs`]: null,
        [`rooms/${roomCode}/meta/allMutedPenalty`]: penalty,
      })
      await db.ref(`rooms/${roomCode}/votes`).remove()

      const allMutedTaskName = await enqueueTask('allMutedTask', { roomCode }, 10)
      await db.ref(`rooms/${roomCode}/meta/allMutedTaskName`).set(allMutedTaskName)
    } else {
      // Normal mute — mute the singer, resume timer
      if (meta.activeSinger) {
        playerUpdates[`rooms/${roomCode}/players/${meta.activeSinger}/muted`] = true
      }

      const now = Date.now()
      await db.ref().update({
        ...playerUpdates,
        [`rooms/${roomCode}/meta/state`]: 'MUTED',
        [`rooms/${roomCode}/meta/wordMuteCount`]: newMuteCount,
        [`rooms/${roomCode}/meta/wordPointValue`]: newPointValue,
        [`rooms/${roomCode}/meta/activeSinger`]: null,
        [`rooms/${roomCode}/meta/voteCloseTaskName`]: null,
      })
      await db.ref(`rooms/${roomCode}/votes`).remove()

      // Brief MUTED display, then back to BUZZER_OPEN with remaining timer
      const muteTaskName = await enqueueTask('mutedTransitionTask', { roomCode, now }, 2)
      await db.ref(`rooms/${roomCode}/meta/mutedTaskName`).set(muteTaskName)
    }
  }

  res.status(200).send('ok')
})

// ─── pointAwardedTask ─────────────────────────────────────────────────────────

export const pointAwardedTask = onRequest({ region: LOCATION }, async (req, res) => {
  const { roomCode, winnerId, newScore } = req.body as { roomCode: string; winnerId: string; newScore: number }

  const metaSnap = await db.ref(`rooms/${roomCode}/meta`).once('value')
  const meta = metaSnap.val()
  if (!meta || meta.state !== 'POINT_AWARDED') { res.status(200).send('stale'); return }

  if (newScore >= meta.pointsToWin) {
    await db.ref(`rooms/${roomCode}/meta/state`).set('GAME_OVER')
    res.status(200).send('game_over')
    return
  }

  const categories = randomCategories(4, meta.currentCategory)
  await db.ref().update({
    [`rooms/${roomCode}/meta/state`]: 'CATEGORY_PICK',
    [`rooms/${roomCode}/categoryChoice`]: {
      chooserId: winnerId,
      options: categories,
      chosen: null,
      chosenAt: null,
    },
  })

  res.status(200).send('ok')
})

// ─── mutedTransitionTask ──────────────────────────────────────────────────────

export const mutedTransitionTask = onRequest({ region: LOCATION }, async (req, res) => {
  const { roomCode, now } = req.body as { roomCode: string; now: number }

  const metaSnap = await db.ref(`rooms/${roomCode}/meta`).once('value')
  const meta = metaSnap.val()
  if (!meta || meta.state !== 'MUTED') { res.status(200).send('stale'); return }

  // Resume remaining timer (not a full reset)
  const remaining = meta.timerRemainingMs ?? 120000
  const delaySec = Math.ceil(Math.max(remaining, 15000) / 1000)
  const timerDurationMs = delaySec * 1000

  const wordTimerTaskName = await enqueueTask('wordTimerTask', { roomCode, wordDrawnAt: now }, delaySec)
  await db.ref(`rooms/${roomCode}/meta`).update({
    state: 'BUZZER_OPEN',
    wordDrawnAt: now,
    wordTimerTaskName,
    mutedTaskName: null,
    timerDurationMs,
    timerRemainingMs: null,
  })

  res.status(200).send('ok')
})

// ─── allMutedTask ─────────────────────────────────────────────────────────────

export const allMutedTask = onRequest({ region: LOCATION }, async (req, res) => {
  const { roomCode } = req.body as { roomCode: string }

  const metaSnap = await db.ref(`rooms/${roomCode}/meta`).once('value')
  const meta = metaSnap.val()
  if (!meta || meta.state !== 'MUTED' || !meta.allMutedPenalty) { res.status(200).send('stale'); return }

  // Pick a fresh category and word — no player choice needed
  const category = randomCategories(1, meta.currentCategory)[0]
  const usedWords: string[] = meta.usedWords?.[category] ?? []
  const newWord = drawWord(category, usedWords)
  const now = Date.now()

  const playersSnap = await db.ref(`rooms/${roomCode}/players`).once('value')
  const players = playersSnap.val() ?? {}
  const playerUpdates: Record<string, unknown> = {}
  for (const pid of Object.keys(players)) {
    playerUpdates[`rooms/${roomCode}/players/${pid}/hasVoted`] = false
  }

  await db.ref().update({
    ...playerUpdates,
    [`rooms/${roomCode}/meta/state`]: 'BUZZER_OPEN',
    [`rooms/${roomCode}/meta/currentCategory`]: category,
    [`rooms/${roomCode}/meta/currentWord`]: newWord,
    [`rooms/${roomCode}/meta/wordDrawnAt`]: now,
    [`rooms/${roomCode}/meta/timerDurationMs`]: 120000,
    [`rooms/${roomCode}/meta/timerRemainingMs`]: null,
    [`rooms/${roomCode}/meta/consecutiveNoBuzzCount`]: 0,
    [`rooms/${roomCode}/meta/allMutedPenalty`]: null,
    [`rooms/${roomCode}/meta/allMutedTaskName`]: null,
  })
  await db.ref(`rooms/${roomCode}/skipVotes`).remove()

  const taskName = await enqueueTask('wordTimerTask', { roomCode, wordDrawnAt: now }, 120)
  await db.ref(`rooms/${roomCode}/meta/wordTimerTaskName`).set(taskName)

  res.status(200).send('ok')
})

// ─── wordTimerTask ────────────────────────────────────────────────────────────

export const wordTimerTask = onRequest({ region: LOCATION }, async (req, res) => {
  const { roomCode, wordDrawnAt } = req.body as { roomCode: string; wordDrawnAt: number }

  const metaSnap = await db.ref(`rooms/${roomCode}/meta`).once('value')
  const meta = metaSnap.val()

  // Only fire if state is still BUZZER_OPEN with no singer, and timer matches
  if (!meta || meta.state !== 'BUZZER_OPEN' || meta.activeSinger || meta.wordDrawnAt !== wordDrawnAt) {
    res.status(200).send('stale')
    return
  }

  const newNoBuzzCount = (meta.consecutiveNoBuzzCount ?? 0) + 1

  // 5 songs in a row with no buzz → end the game
  if (newNoBuzzCount >= 5) {
    await db.ref(`rooms/${roomCode}/meta`).update({
      state: 'GAME_OVER',
      gameOverReason: 'no_buzz',
      wordTimerTaskName: null,
    })
    res.status(200).send('game_over_no_buzz')
    return
  }

  const usedWords: string[] = (meta.usedWords?.[meta.currentCategory] ?? []).concat(meta.currentWord)
  const newWord = drawWord(meta.currentCategory, usedWords)
  const now = Date.now()

  // Reset all muted flags and timers for new word
  const playersSnap = await db.ref(`rooms/${roomCode}/players`).once('value')
  const players = playersSnap.val() ?? {}
  const updates: Record<string, unknown> = {}
  for (const pid of Object.keys(players)) {
    updates[`rooms/${roomCode}/players/${pid}/muted`] = false
  }

  await db.ref().update({
    ...updates,
    [`rooms/${roomCode}/meta/currentWord`]: newWord,
    [`rooms/${roomCode}/meta/wordDrawnAt`]: now,
    [`rooms/${roomCode}/meta/wordMuteCount`]: 0,
    [`rooms/${roomCode}/meta/wordPointValue`]: 1,
    [`rooms/${roomCode}/meta/timerDurationMs`]: 120000,
    [`rooms/${roomCode}/meta/timerRemainingMs`]: null,
    [`rooms/${roomCode}/meta/consecutiveNoBuzzCount`]: newNoBuzzCount,
    [`rooms/${roomCode}/meta/usedWords/${meta.currentCategory}`]: usedWords,
  })
  await db.ref(`rooms/${roomCode}/skipVotes`).remove()

  const taskName = await enqueueTask('wordTimerTask', { roomCode, wordDrawnAt: now }, 120)
  await db.ref(`rooms/${roomCode}/meta/wordTimerTaskName`).set(taskName)

  res.status(200).send('ok')
})

// ─── onCategoryChosen ─────────────────────────────────────────────────────────

export const onCategoryChosen = onValueWritten(
  { ref: '/rooms/{roomCode}/categoryChoice/chosen', region: LOCATION },
  async (event) => {
    const chosen = event.data.after.val()
    if (!chosen) return
    const { roomCode } = event.params

    const metaSnap = await db.ref(`rooms/${roomCode}/meta`).once('value')
    const meta = metaSnap.val()
    if (!meta || meta.state !== 'CATEGORY_PICK') return

    // Enqueue 5s countdown then start WORD_REVEAL → BUZZER_OPEN
    await enqueueTask('categoryRevealTask', { roomCode, category: chosen }, 5)
  },
)

// ─── categoryRevealTask ───────────────────────────────────────────────────────

export const categoryRevealTask = onRequest({ region: LOCATION }, async (req, res) => {
  const { roomCode, category } = req.body as { roomCode: string; category: string }

  const metaSnap = await db.ref(`rooms/${roomCode}/meta`).once('value')
  const meta = metaSnap.val()
  if (!meta || meta.state !== 'CATEGORY_PICK') { res.status(200).send('stale'); return }

  const usedWords: string[] = meta.usedWords?.[category] ?? []
  const newWord = drawWord(category, usedWords)
  const now = Date.now()

  // Reset all muted flags for new word
  const playersSnap = await db.ref(`rooms/${roomCode}/players`).once('value')
  const players = playersSnap.val() ?? {}
  const playerUpdates: Record<string, unknown> = {}
  for (const pid of Object.keys(players)) {
    playerUpdates[`rooms/${roomCode}/players/${pid}/muted`] = false
    playerUpdates[`rooms/${roomCode}/players/${pid}/hasVoted`] = false
  }

  await db.ref().update({
    ...playerUpdates,
    [`rooms/${roomCode}/meta/state`]: 'BUZZER_OPEN',
    [`rooms/${roomCode}/meta/currentCategory`]: category,
    [`rooms/${roomCode}/meta/currentWord`]: newWord,
    [`rooms/${roomCode}/meta/wordDrawnAt`]: now,
    [`rooms/${roomCode}/meta/wordMuteCount`]: 0,
    [`rooms/${roomCode}/meta/wordPointValue`]: 1,
    [`rooms/${roomCode}/meta/timerDurationMs`]: 120000,
    [`rooms/${roomCode}/meta/timerRemainingMs`]: null,
    [`rooms/${roomCode}/meta/consecutiveNoBuzzCount`]: 0,
    [`rooms/${roomCode}/meta/activeSinger`]: null,
  })
  await db.ref(`rooms/${roomCode}/skipVotes`).remove()

  const wordTimerTaskName = await enqueueTask('wordTimerTask', { roomCode, wordDrawnAt: now }, 120)
  await db.ref(`rooms/${roomCode}/meta/wordTimerTaskName`).set(wordTimerTaskName)

  res.status(200).send('ok')
})

// ─── onSingerDisconnect ───────────────────────────────────────────────────────

export const onSingerDisconnect = onValueWritten(
  { ref: '/rooms/{roomCode}/players/{uid}/connected', region: LOCATION },
  async (event) => {
    if (event.data.after.val() !== false) return // only care about disconnects
    const { roomCode, uid } = event.params

    const metaSnap = await db.ref(`rooms/${roomCode}/meta`).once('value')
    const meta = metaSnap.val()
    if (!meta || meta.activeSinger !== uid) return
    if (meta.state !== 'SINGING' && meta.state !== 'VOTE_CLOSING') return

    // Singer disconnected — apply mute immediately
    await cancelTask(meta.voteCloseTaskName)
    const newMuteCount = (meta.wordMuteCount ?? 0) + 1
    const newPointValue = (meta.wordPointValue ?? 1) + 1
    const now = Date.now()

    await db.ref(`rooms/${roomCode}/players/${uid}/muted`).set(true)
    await db.ref(`rooms/${roomCode}/votes`).remove()

    const playersSnap = await db.ref(`rooms/${roomCode}/players`).once('value')
    const players = playersSnap.val() ?? {}
    const updates: Record<string, unknown> = {}
    for (const pid of Object.keys(players)) {
      updates[`rooms/${roomCode}/players/${pid}/hasVoted`] = false
    }

    await db.ref().update({
      ...updates,
      [`rooms/${roomCode}/meta/state`]: 'MUTED',
      [`rooms/${roomCode}/meta/wordMuteCount`]: newMuteCount,
      [`rooms/${roomCode}/meta/wordPointValue`]: newPointValue,
      [`rooms/${roomCode}/meta/activeSinger`]: null,
      [`rooms/${roomCode}/meta/voteCloseTaskName`]: null,
    })

    const muteTaskName = await enqueueTask('mutedTransitionTask', { roomCode, now }, 2)
    await db.ref(`rooms/${roomCode}/meta/mutedTaskName`).set(muteTaskName)
  },
)

// ─── onGameStateChange ────────────────────────────────────────────────────────
// Schedules session cleanup on every state change (except GAME_OVER).
// Uses a token so stale tasks no-op if activity resumes.

export const onGameStateChange = onValueWritten(
  { ref: '/rooms/{roomCode}/meta/state', region: LOCATION },
  async (event) => {
    const newState = event.data.after.val()
    if (!newState || newState === 'GAME_OVER') return

    const { roomCode } = event.params
    const token = randomToken()
    await db.ref(`rooms/${roomCode}/meta/inactivityToken`).set(token)
    await enqueueTask('inactivityTask', { roomCode, token }, 30 * 60)
  },
)

// ─── inactivityTask ───────────────────────────────────────────────────────────

export const inactivityTask = onRequest({ region: LOCATION }, async (req, res) => {
  const { roomCode, token } = req.body as { roomCode: string; token: string }

  const metaSnap = await db.ref(`rooms/${roomCode}/meta`).once('value')
  const meta = metaSnap.val()
  if (!meta || meta.inactivityToken !== token) { res.status(200).send('stale'); return }

  await db.ref(`rooms/${roomCode}/meta/state`).set('GAME_OVER')
  await enqueueTask('cleanupTask', { roomCode, token }, 30 * 60)

  res.status(200).send('ok')
})

// ─── cleanupTask ──────────────────────────────────────────────────────────────

export const cleanupTask = onRequest({ region: LOCATION }, async (req, res) => {
  const { roomCode, token } = req.body as { roomCode: string; token: string }

  const metaSnap = await db.ref(`rooms/${roomCode}/meta`).once('value')
  const meta = metaSnap.val()
  if (!meta || meta.inactivityToken !== token) { res.status(200).send('stale'); return }

  await db.ref(`rooms/${roomCode}`).remove()
  res.status(200).send('ok')
})

// ─── restartGame ──────────────────────────────────────────────────────────────

export const restartGame = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in')
  const { roomCode } = request.data as { roomCode: string }

  const metaSnap = await db.ref(`rooms/${roomCode}/meta`).once('value')
  const meta = metaSnap.val()
  if (!meta) throw new HttpsError('not-found', 'Room not found')
  if (meta.hostId !== request.auth.uid) throw new HttpsError('permission-denied', 'Only host can restart')

  // Cancel any pending tasks
  await cancelTask(meta.wordTimerTaskName)
  await cancelTask(meta.voteCloseTaskName)

  const playersSnap = await db.ref(`rooms/${roomCode}/players`).once('value')
  const players = playersSnap.val() ?? {}
  const playerUpdates: Record<string, unknown> = {}
  for (const pid of Object.keys(players)) {
    playerUpdates[`rooms/${roomCode}/players/${pid}/score`] = 0
    playerUpdates[`rooms/${roomCode}/players/${pid}/muted`] = false
    playerUpdates[`rooms/${roomCode}/players/${pid}/hasVoted`] = false
  }

  await db.ref().update({
    ...playerUpdates,
    [`rooms/${roomCode}/meta/state`]: 'LOBBY',
    [`rooms/${roomCode}/meta/currentWord`]: '',
    [`rooms/${roomCode}/meta/activeSinger`]: null,
    [`rooms/${roomCode}/meta/wordDrawnAt`]: null,
    [`rooms/${roomCode}/meta/singingStartedAt`]: null,
    [`rooms/${roomCode}/meta/voteCloseTriggeredAt`]: null,
    [`rooms/${roomCode}/meta/wordMuteCount`]: 0,
    [`rooms/${roomCode}/meta/wordPointValue`]: 1,
    [`rooms/${roomCode}/meta/timerDurationMs`]: 120000,
    [`rooms/${roomCode}/meta/timerRemainingMs`]: null,
    [`rooms/${roomCode}/meta/consecutiveNoBuzzCount`]: 0,
    [`rooms/${roomCode}/meta/gameOverReason`]: null,
    [`rooms/${roomCode}/meta/wordTimerTaskName`]: null,
    [`rooms/${roomCode}/meta/voteCloseTaskName`]: null,
    [`rooms/${roomCode}/meta/usedWords`]: {},
    [`rooms/${roomCode}/votes`]: null,
    [`rooms/${roomCode}/buzzIn`]: null,
    [`rooms/${roomCode}/categoryChoice`]: null,
    [`rooms/${roomCode}/rematchVotes`]: null,
    [`rooms/${roomCode}/skipVotes`]: null,
  })

  return { ok: true }
})

// ─── onSkipVote ───────────────────────────────────────────────────────────────
// All connected players must agree to skip; drops timer to 15s.

export const onSkipVote = onValueCreated(
  { ref: '/rooms/{roomCode}/skipVotes/{uid}', region: LOCATION },
  async (event) => {
    const { roomCode } = event.params

    const metaSnap = await db.ref(`rooms/${roomCode}/meta`).once('value')
    const meta = metaSnap.val()
    if (!meta || meta.state !== 'BUZZER_OPEN') return

    const skipSnap = await db.ref(`rooms/${roomCode}/skipVotes`).once('value')
    const skipCount = Object.keys(skipSnap.val() ?? {}).length

    const playersSnap = await db.ref(`rooms/${roomCode}/players`).once('value')
    const players = playersSnap.val() ?? {}
    const connected = Object.keys(players).filter(
      (pid) => (players[pid] as { connected: boolean }).connected !== false,
    )

    if (connected.length === 0 || skipCount < connected.length) return

    // Consensus — jump timer to 15s
    await cancelTask(meta.wordTimerTaskName)
    await db.ref(`rooms/${roomCode}/skipVotes`).remove()

    const now = Date.now()
    const taskName = await enqueueTask('wordTimerTask', { roomCode, wordDrawnAt: now }, 15)
    await db.ref(`rooms/${roomCode}/meta`).update({
      wordDrawnAt: now,
      wordTimerTaskName: taskName,
      timerDurationMs: 15000,
      timerRemainingMs: null,
    })
  },
)

// ─── endGame ──────────────────────────────────────────────────────────────────

export const endGame = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in')
  const { roomCode } = request.data as { roomCode: string }
  if (!roomCode) throw new HttpsError('invalid-argument', 'roomCode required')

  const metaSnap = await db.ref(`rooms/${roomCode}/meta`).once('value')
  const meta = metaSnap.val()
  if (!meta) throw new HttpsError('not-found', 'Room not found')
  if (meta.hostId !== request.auth.uid) throw new HttpsError('permission-denied', 'Only host can end')

  await cancelTask(meta.wordTimerTaskName)
  await cancelTask(meta.voteCloseTaskName)

  await db.ref(`rooms/${roomCode}/meta/state`).set('GAME_OVER')
  return { ok: true }
})

// ─── onRematchVote ────────────────────────────────────────────────────────────

export const onRematchVote = onValueCreated(
  { ref: '/rooms/{roomCode}/rematchVotes/{uid}', region: LOCATION },
  async (event) => {
    const { roomCode } = event.params

    const metaSnap = await db.ref(`rooms/${roomCode}/meta`).once('value')
    const meta = metaSnap.val()
    if (!meta || meta.state !== 'GAME_OVER') return

    const playersSnap = await db.ref(`rooms/${roomCode}/players`).once('value')
    const players = playersSnap.val() ?? {}
    const rematchSnap = await db.ref(`rooms/${roomCode}/rematchVotes`).once('value')
    const rematchVotes = rematchSnap.val() ?? {}

    const connected = Object.keys(players).filter(
      (pid) => players[pid].connected !== false,
    )
    const voted = Object.keys(rematchVotes).length

    if (voted >= connected.length) {
      // All players voted — restart via restartGame logic inline
      const playerUpdates: Record<string, unknown> = {}
      for (const pid of Object.keys(players)) {
        playerUpdates[`rooms/${roomCode}/players/${pid}/score`] = 0
        playerUpdates[`rooms/${roomCode}/players/${pid}/muted`] = false
        playerUpdates[`rooms/${roomCode}/players/${pid}/hasVoted`] = false
      }
      await db.ref().update({
        ...playerUpdates,
        [`rooms/${roomCode}/meta/state`]: 'LOBBY',
        [`rooms/${roomCode}/meta/currentWord`]: '',
        [`rooms/${roomCode}/meta/activeSinger`]: null,
        [`rooms/${roomCode}/meta/wordDrawnAt`]: null,
        [`rooms/${roomCode}/meta/wordMuteCount`]: 0,
        [`rooms/${roomCode}/meta/wordPointValue`]: 1,
        [`rooms/${roomCode}/meta/timerDurationMs`]: 120000,
        [`rooms/${roomCode}/meta/timerRemainingMs`]: null,
        [`rooms/${roomCode}/meta/consecutiveNoBuzzCount`]: 0,
        [`rooms/${roomCode}/meta/gameOverReason`]: null,
        [`rooms/${roomCode}/meta/usedWords`]: {},
        [`rooms/${roomCode}/votes`]: null,
        [`rooms/${roomCode}/buzzIn`]: null,
        [`rooms/${roomCode}/categoryChoice`]: null,
        [`rooms/${roomCode}/rematchVotes`]: null,
        [`rooms/${roomCode}/skipVotes`]: null,
      })
    }
  },
)
