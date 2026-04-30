import { useEffect, useState, useMemo } from 'react'
import { ref, get, set } from 'firebase/database'
import { db, auth } from '../../firebase'
import staticWords from '../../data/words.json'
import staticHints from '../../data/word-examples.json'

type WordMap = Record<string, string[]>
type SongExample = { title: string; artist: string; year: number }
type HintsMap = Record<string, SongExample[]>

export default function WordEditor() {
  const [words, setWords] = useState<WordMap>({})
  const [hints, setHints] = useState<HintsMap>({})
  const [selectedWord, setSelectedWord] = useState('')
  const [search, setSearch] = useState('')
  const [newWord, setNewWord] = useState('')
  const [newCat, setNewCat] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    if (!auth.currentUser) return
    Promise.all([
      get(ref(db, 'adminConfig/words')),
      get(ref(db, 'adminConfig/hints')),
    ]).then(([wordsSnap, hintsSnap]) => {
      const loadedWords: WordMap = wordsSnap.exists() ? wordsSnap.val() : (staticWords as WordMap)
      const loadedHints: HintsMap = hintsSnap.exists() ? hintsSnap.val() : (staticHints as HintsMap)
      setWords(loadedWords)
      setHints(loadedHints)
      const firstWord = Object.values(loadedWords).flat().sort()[0] ?? ''
      setSelectedWord(firstWord)
    })
  }, [])

  // ── derived ─────────────────────────────────────────────────────────────────

  const categories = Object.keys(words)

  const allWords = useMemo(() => {
    const set = new Set<string>()
    Object.values(words).forEach(list => list.forEach(w => set.add(w.toLowerCase())))
    return [...set].sort()
  }, [words])

  const filteredWords = useMemo(() =>
    search.trim() ? allWords.filter(w => w.includes(search.trim().toLowerCase())) : allWords,
    [allWords, search]
  )

  // Categories that contain the selected word
  const wordCategories = useMemo(() =>
    categories.filter(cat => (words[cat] ?? []).map(w => w.toLowerCase()).includes(selectedWord)),
    [words, categories, selectedWord]
  )

  // ── word mutations ───────────────────────────────────────────────────────────

  const addWord = () => {
    const w = newWord.trim().toLowerCase()
    if (!w || allWords.includes(w)) return
    setSelectedWord(w)
    setNewWord('')
    // word exists with no categories until user checks some
  }

  const removeWord = (word: string) => {
    setWords(prev => {
      const next: WordMap = {}
      for (const [cat, list] of Object.entries(prev)) {
        next[cat] = list.filter(w => w.toLowerCase() !== word)
      }
      return next
    })
    setHints(prev => { const n = { ...prev } as HintsMap; delete n[word]; return n })
    if (selectedWord === word) {
      const remaining = allWords.filter(w => w !== word)
      setSelectedWord(remaining[0] ?? '')
    }
  }

  // ── category assignment ──────────────────────────────────────────────────────

  const toggleCategory = (cat: string, checked: boolean) => {
    if (!selectedWord) return
    setWords(prev => {
      const list = prev[cat] ?? []
      if (checked) {
        return list.map(w => w.toLowerCase()).includes(selectedWord)
          ? prev
          : { ...prev, [cat]: [...list, selectedWord] }
      } else {
        return { ...prev, [cat]: list.filter(w => w.toLowerCase() !== selectedWord) }
      }
    })
  }

  const addCategory = () => {
    const cat = newCat.trim()
    if (!cat || words[cat] != null) return
    setWords(prev => ({ ...prev, [cat]: [] }))
    setNewCat('')
  }

  const removeCategory = (cat: string) => {
    if (!confirm(`Delete category "${cat}" and remove it from all words?`)) return
    setWords(prev => { const n = { ...prev }; delete n[cat]; return n })
  }

  // ── hint mutations ───────────────────────────────────────────────────────────

  const wordHints = (): SongExample[] => hints[selectedWord] ?? []

  const setWordHints = (songs: SongExample[]) =>
    setHints(prev => ({ ...prev, [selectedWord]: songs }))

  const updateSong = (i: number, field: keyof SongExample, value: string) => {
    const updated = wordHints().map((s, idx) =>
      idx === i ? { ...s, [field]: field === 'year' ? parseInt(value) || 0 : value } : s
    )
    setWordHints(updated)
  }

  const addSong = () => setWordHints([...wordHints(), { title: '', artist: '', year: new Date().getFullYear() }])
  const removeSong = (i: number) => setWordHints(wordHints().filter((_, idx) => idx !== i))

  // ── persist ──────────────────────────────────────────────────────────────────

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all([
        set(ref(db, 'adminConfig/words'), words),
        set(ref(db, 'adminConfig/hints'), hints),
      ])
      setSavedMsg('Saved!')
      setTimeout(() => setSavedMsg(''), 2500)
    } catch {
      setSavedMsg('Save failed')
      setTimeout(() => setSavedMsg(''), 2500)
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = async () => {
    if (!confirm('Reset words and hints to static defaults? This will overwrite all edits in the database.')) return
    setSaving(true)
    const defWords = staticWords as WordMap
    const defHints = staticHints as unknown as HintsMap
    await Promise.all([
      set(ref(db, 'adminConfig/words'), defWords),
      set(ref(db, 'adminConfig/hints'), defHints),
    ])
    setWords(defWords)
    setHints(defHints)
    setSelectedWord(Object.values(defWords).flat().sort()[0] ?? '')
    setSaving(false)
    setSavedMsg('Reset to defaults!')
    setTimeout(() => setSavedMsg(''), 2500)
  }

  const songs = wordHints()

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 220px)', minHeight: 400 }}>

        {/* Panel 1: word list */}
        <div style={leftPanelStyle}>
          <div style={panelTitleStyle}>Words ({allWords.length})</div>
          <div style={{ padding: '6px 8px', borderBottom: '2px solid var(--ink)' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', borderRadius: 3, border: '1px solid #ccc' }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredWords.map(w => {
              const catCount = categories.filter(c => (words[c] ?? []).map(x => x.toLowerCase()).includes(w)).length
              return (
                <div
                  key={w}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 10px 7px 12px',
                    background: w === selectedWord ? 'var(--gold)' : 'transparent',
                    borderBottom: '1px solid #e0d8cc',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedWord(w)}
                >
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14 }}>{w}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {catCount > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#888', fontFamily: 'var(--font-body)', letterSpacing: '0.5px' }}>
                        {catCount}
                      </span>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); removeWord(w) }}
                      style={iconBtnStyle}
                      title="Remove word from all categories"
                    >✕</button>
                  </span>
                </div>
              )
            })}
          </div>
          <div style={inputRowStyle}>
            <input
              value={newWord}
              onChange={e => setNewWord(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addWord()}
              placeholder="Add word"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={addWord} style={addBtnStyle}>+</button>
          </div>
        </div>

        {/* Panel 2: category tags */}
        <div style={midPanelStyle}>
          <div style={panelTitleStyle}>
            {selectedWord ? `"${selectedWord}" in…` : 'Select a word'}
          </div>
          {selectedWord ? (
            <>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {categories.map(cat => {
                  const checked = wordCategories.includes(cat)
                  return (
                    <label
                      key={cat}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 12px', borderBottom: '1px solid #e0d8cc',
                        cursor: 'pointer', background: checked ? 'rgba(255,215,0,0.18)' : 'transparent',
                        fontFamily: 'var(--font-body)', fontWeight: checked ? 800 : 600, fontSize: 14,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => toggleCategory(cat, e.target.checked)}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--gold)' }}
                      />
                      <span style={{ flex: 1 }}>{cat}</span>
                      <span style={{ fontSize: 11, color: '#aaa', fontWeight: 400 }}>
                        {(words[cat] ?? []).length}
                      </span>
                      <button
                        onClick={e => { e.preventDefault(); removeCategory(cat) }}
                        style={iconBtnStyle}
                        title="Delete category"
                      >✕</button>
                    </label>
                  )
                })}
              </div>
              <div style={inputRowStyle}>
                <input
                  value={newCat}
                  onChange={e => setNewCat(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCategory()}
                  placeholder="New category"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={addCategory} style={addBtnStyle}>+</button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontFamily: 'var(--font-body)', fontSize: 13 }}>
              Click a word to assign categories
            </div>
          )}
        </div>

        {/* Panel 3: hints */}
        <div style={rightPanelStyle}>
          <div style={panelTitleStyle}>
            {selectedWord ? `Hints: ${selectedWord} (${songs.length})` : 'Select a word'}
          </div>
          {selectedWord ? (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {songs.length === 0 && (
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#aaa', fontStyle: 'italic' }}>
                    No hints — add a song example below.
                  </div>
                )}
                {songs.map((song, i) => (
                  <div key={i} style={songRowStyle}>
                    <input
                      value={song.title}
                      onChange={e => updateSong(i, 'title', e.target.value)}
                      placeholder="Song title"
                      style={{ ...inputStyle, flex: 3, borderRight: '1px solid #ddd' }}
                    />
                    <input
                      value={song.artist}
                      onChange={e => updateSong(i, 'artist', e.target.value)}
                      placeholder="Artist"
                      style={{ ...inputStyle, flex: 2, borderRight: '1px solid #ddd' }}
                    />
                    <input
                      value={song.year || ''}
                      onChange={e => updateSong(i, 'year', e.target.value)}
                      placeholder="Year"
                      type="number"
                      min={1900} max={2099}
                      style={{ ...inputStyle, width: 72, flexShrink: 0, borderRight: '1px solid #ddd' }}
                    />
                    <button onClick={() => removeSong(i)} style={{ ...iconBtnStyle, padding: '0 12px', fontSize: 13 }}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ ...inputRowStyle, borderTop: '2px solid var(--ink)' }}>
                <button
                  onClick={addSong}
                  style={{ flex: 1, padding: '9px', background: 'var(--bg)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13 }}
                >
                  + Add song
                </button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontFamily: 'var(--font-body)', fontSize: 13 }}>
              Click a word to edit its hints
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
        <button onClick={save} disabled={saving} style={saveBtnStyle}>
          {saving ? 'Saving…' : 'Save to Database'}
        </button>
        <button onClick={resetToDefaults} disabled={saving} style={resetBtnStyle}>
          Reset to Defaults
        </button>
        {savedMsg && (
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, color: savedMsg.includes('fail') ? 'var(--danger)' : '#00AA44' }}>
            {savedMsg}
          </span>
        )}
      </div>
    </div>
  )
}

const leftPanelStyle: React.CSSProperties = {
  width: 200, minWidth: 160, display: 'flex', flexDirection: 'column',
  border: '3px solid var(--ink)', borderRight: '2px solid var(--ink)',
  background: 'var(--white)',
}
const midPanelStyle: React.CSSProperties = {
  width: 240, minWidth: 180, display: 'flex', flexDirection: 'column',
  border: '3px solid var(--ink)', borderLeft: 'none', borderRight: '2px solid var(--ink)',
  background: 'var(--white)',
}
const rightPanelStyle: React.CSSProperties = {
  flex: 1, display: 'flex', flexDirection: 'column',
  border: '3px solid var(--ink)', borderLeft: 'none',
  background: 'var(--white)',
}
const panelTitleStyle: React.CSSProperties = {
  padding: '8px 12px', fontFamily: 'var(--font-display)', fontWeight: 900,
  fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase',
  borderBottom: '3px solid var(--ink)', background: 'var(--bg)',
}
const inputRowStyle: React.CSSProperties = {
  display: 'flex', gap: 0, borderTop: '2px solid var(--ink)',
}
const inputStyle: React.CSSProperties = {
  padding: '8px 10px', border: 'none',
  fontFamily: 'var(--font-body)', fontSize: 13, background: 'var(--bg)', outline: 'none',
}
const addBtnStyle: React.CSSProperties = {
  width: 40, background: 'var(--gold)', border: 'none', cursor: 'pointer',
  fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20,
}
const iconBtnStyle: React.CSSProperties = {
  padding: '0 10px', background: 'transparent', border: 'none', cursor: 'pointer',
  color: '#aaa', fontSize: 12, fontWeight: 700,
}
const saveBtnStyle: React.CSSProperties = {
  padding: '12px 28px', background: 'var(--gold)', border: 'var(--border)',
  boxShadow: 'var(--shadow)', fontFamily: 'var(--font-body)', fontWeight: 800,
  fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 6,
}
const resetBtnStyle: React.CSSProperties = {
  padding: '12px 20px', background: 'transparent', border: 'var(--border)',
  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, cursor: 'pointer', borderRadius: 6,
}
const songRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'stretch',
  border: '2px solid var(--ink)', borderRadius: 4, overflow: 'hidden',
  background: 'var(--bg)',
}
