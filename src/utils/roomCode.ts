const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // excludes I and O (ambiguous)

export function generateCandidateCode(): string {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return code
}
