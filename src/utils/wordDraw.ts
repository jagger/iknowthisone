import wordsData from '../data/words.json'

const words = wordsData as Record<string, string[]>

export function drawWord(category: string, usedWords: string[]): string {
  const pool = words[category] ?? words['General'] ?? []
  const available = pool.filter((w) => !usedWords.includes(w))

  if (available.length === 0) {
    // Exhausted — reshuffle (caller should clear usedWords for this category)
    const fallback = pool[Math.floor(Math.random() * pool.length)]
    return fallback ?? 'MUSIC'
  }

  return available[Math.floor(Math.random() * available.length)]
}

export function getCategories(): string[] {
  return Object.keys(words)
}

export function getRandomCategories(count: number, exclude?: string): string[] {
  const all = getCategories().filter((c) => c !== exclude)
  const shuffled = all.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}
