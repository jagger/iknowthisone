import { useEffect, useState } from 'react'
import { ref, get, set } from 'firebase/database'
import { db, auth } from '../../firebase'
import staticWords from '../../data/words.json'

type WordMap = Record<string, string[]>

export default function WordEditor() {
  const [words, setWords] = useState<WordMap>({})
  const [selectedCat, setSelectedCat] = useState('')
  const [newCat, setNewCat] = useState('')
  const [newWord, setNewWord] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    if (!auth.currentUser) return
    get(ref(db, 'adminConfig/words')).then((snap) => {
      const loaded: WordMap = snap.exists() ? snap.val() : (staticWords as WordMap)
      setWords(loaded)
      setSelectedCat(Object.keys(loaded)[0] ?? '')
    })
  }, [])

  const addCategory = () => {
    const cat = newCat.trim()
    if (!cat || words[cat] != null) return
    setWords((w) => ({ ...w, [cat]: [] }))
    setSelectedCat(cat)
    setNewCat('')
  }

  const removeCategory = (cat: string) => {
    setWords((w) => {
      const next = { ...w }
      delete next[cat]
      return next
    })
    if (selectedCat === cat) {
      const cats = Object.keys(words).filter((c) => c !== cat)
      setSelectedCat(cats[0] ?? '')
    }
  }

  const addWord = () => {
    const w = newWord.trim().toLowerCase()
    if (!w || !selectedCat || (words[selectedCat] ?? []).includes(w)) return
    setWords((prev) => ({ ...prev, [selectedCat]: [...(prev[selectedCat] ?? []), w] }))
    setNewWord('')
  }

  const removeWord = (word: string) => {
    setWords((prev) => ({
      ...prev,
      [selectedCat]: prev[selectedCat].filter((w) => w !== word),
    }))
  }

  const save = async () => {
    setSaving(true)
    try {
      await set(ref(db, 'adminConfig/words'), words)
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
    if (!confirm('Reset to static defaults? This will overwrite all edits in RTDB.')) return
    setSaving(true)
    const defaults = staticWords as WordMap
    await set(ref(db, 'adminConfig/words'), defaults)
    setWords(defaults)
    setSelectedCat(Object.keys(defaults)[0] ?? '')
    setSaving(false)
    setSavedMsg('Reset to defaults!')
    setTimeout(() => setSavedMsg(''), 2500)
  }

  const categories = Object.keys(words)
  const currentWords = words[selectedCat] ?? []

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 220px)', minHeight: 400 }}>
        {/* Left panel: categories */}
        <div style={leftPanelStyle}>
          <div style={panelTitleStyle}>Categories ({categories.length})</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {categories.map((cat) => (
              <div
                key={cat}
                style={{
                  display: 'flex', alignItems: 'center',
                  background: cat === selectedCat ? 'var(--gold)' : 'transparent',
                  borderBottom: '1px solid #e0d8cc',
                }}
              >
                <button
                  onClick={() => setSelectedCat(cat)}
                  style={{
                    flex: 1, textAlign: 'left', padding: '9px 12px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14,
                  }}
                >
                  {cat}
                  <span style={{ marginLeft: 6, color: '#999', fontWeight: 400, fontSize: 12 }}>
                    ({(words[cat] ?? []).length})
                  </span>
                </button>
                <button
                  onClick={() => removeCategory(cat)}
                  style={iconBtnStyle}
                  title="Delete category"
                >✕</button>
              </div>
            ))}
          </div>
          <div style={inputRowStyle}>
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              placeholder="New category"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={addCategory} style={addBtnStyle}>+</button>
          </div>
        </div>

        {/* Right panel: words */}
        <div style={rightPanelStyle}>
          <div style={panelTitleStyle}>
            {selectedCat || 'Select a category'} {selectedCat && `(${currentWords.length} words)`}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8, alignContent: 'flex-start', padding: '12px 16px' }}>
            {[...currentWords].sort().map((w) => (
              <span key={w} style={chipStyle}>
                {w}
                <button onClick={() => removeWord(w)} style={chipXStyle}>✕</button>
              </span>
            ))}
          </div>
          <div style={{ ...inputRowStyle, borderTop: '2px solid var(--ink)' }}>
            <input
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addWord()}
              placeholder="Add word"
              disabled={!selectedCat}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={addWord} disabled={!selectedCat} style={addBtnStyle}>+</button>
          </div>
        </div>
      </div>

      {/* Footer actions */}
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
  width: 220, minWidth: 180, display: 'flex', flexDirection: 'column',
  border: '3px solid var(--ink)', borderRight: '2px solid var(--ink)',
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
  padding: '8px 10px', border: 'none', borderRight: '2px solid var(--ink)',
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
const chipStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  background: 'var(--bg)', border: '2px solid var(--ink)',
  borderRadius: 4, padding: '3px 6px 3px 8px',
  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13,
}
const chipXStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#999', fontSize: 11, fontWeight: 900, padding: '0 2px', lineHeight: 1,
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
