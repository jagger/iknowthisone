import type { CSSProperties, ReactNode } from 'react'
import { PLAYER_IDENTITIES } from '../../types/game'
import type { PatternType } from '../../types/game'

interface Props {
  identityIndex: number
  children?: ReactNode
  style?: CSSProperties
  className?: string
}

interface PatternProps {
  shade: string
  id: string
}

const PATTERNS: Record<PatternType, (p: PatternProps) => JSX.Element> = {
  triangles: ({ shade, id }) => (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
          <polygon points="10,2 18,18 2,18" fill={shade} />
        </pattern>
      </defs>
      <rect width="200%" height="200%" fill={`url(#${id})`}
        style={{ animation: 'spin 8s linear infinite', transformOrigin: '25% 25%' }} />
    </svg>
  ),
  dots: ({ shade, id }) => (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="8" r="4" fill={shade} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`}
        style={{ animation: 'pulseBig 1.5s ease-in-out infinite alternate', transformOrigin: 'center' }} />
    </svg>
  ),
  zigzag: ({ shade, id }) => (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <pattern id={id} width="20" height="10" patternUnits="userSpaceOnUse">
          <polyline points="0,10 5,0 10,10 15,0 20,10" fill="none" stroke={shade} strokeWidth="2.5" />
        </pattern>
      </defs>
      <rect width="150%" height="100%" fill={`url(#${id})`}
        style={{ animation: 'slideRight 2s ease-in-out infinite alternate' }} />
    </svg>
  ),
  diamonds: ({ shade, id }) => (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
          <polygon points="10,2 18,10 10,18 2,10" fill={shade} />
        </pattern>
      </defs>
      <rect width="100%" height="150%" fill={`url(#${id})`}
        style={{ animation: 'bobUp 2s ease-in-out infinite alternate' }} />
    </svg>
  ),
  stars: ({ shade, id }) => (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse">
          <polygon points="12,2 14.5,9 22,9 16,14 18.5,21 12,17 5.5,21 8,14 2,9 9.5,9" fill={shade} />
        </pattern>
      </defs>
      <rect width="200%" height="200%" fill={`url(#${id})`}
        style={{ animation: 'spinR 6s linear infinite', transformOrigin: '25% 25%' }} />
    </svg>
  ),
  checks: ({ shade, id }) => (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="8" height="8" fill={shade} />
          <rect x="8" y="8" width="8" height="8" fill={shade} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`}
        style={{ animation: 'fadeCheck 2s ease-in-out infinite alternate' }} />
    </svg>
  ),
  squiggles: ({ shade, id }) => (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <pattern id={id} width="30" height="12" patternUnits="userSpaceOnUse">
          <path d="M0,6 C5,0 10,12 15,6 C20,0 25,12 30,6" fill="none" stroke={shade} strokeWidth="2.5" />
        </pattern>
      </defs>
      <rect width="150%" height="100%" fill={`url(#${id})`}
        style={{ animation: 'slideLeft 2.5s ease-in-out infinite alternate' }} />
    </svg>
  ),
  crosses: ({ shade, id }) => (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
          <line x1="10" y1="3" x2="10" y2="17" stroke={shade} strokeWidth="3" strokeLinecap="round" />
          <line x1="3" y1="10" x2="17" y2="10" stroke={shade} strokeWidth="3" strokeLinecap="round" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`}
        style={{ animation: 'pulseBig 2s ease-in-out infinite alternate', transformOrigin: 'center' }} />
    </svg>
  ),
  stripes: ({ shade, id }) => (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="12" stroke={shade} strokeWidth="5" />
        </pattern>
      </defs>
      <rect width="150%" height="100%" fill={`url(#${id})`}
        style={{ animation: 'slideRight 1.5s linear infinite' }} />
    </svg>
  ),
  hexagons: ({ shade, id }) => (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <pattern id={id} width="24" height="28" patternUnits="userSpaceOnUse">
          <polygon points="12,2 22,7 22,21 12,26 2,21 2,7" fill="none" stroke={shade} strokeWidth="2.5" />
        </pattern>
      </defs>
      <rect width="100%" height="150%" fill={`url(#${id})`}
        style={{ animation: 'bobDown 2.5s ease-in-out infinite alternate' }} />
    </svg>
  ),
  waves: ({ shade, id }) => (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <pattern id={id} width="32" height="14" patternUnits="userSpaceOnUse">
          <path d="M0,7 C4,0 8,14 16,7 C24,0 28,14 32,7" fill="none" stroke={shade} strokeWidth="2.5" />
        </pattern>
      </defs>
      <rect width="100%" height="150%" fill={`url(#${id})`}
        style={{ animation: 'bobUp 2s ease-in-out infinite alternate' }} />
    </svg>
  ),
  rings: ({ shade, id }) => (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="8" fill="none" stroke={shade} strokeWidth="3" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`}
        style={{ animation: 'pulseBig 3s ease-in-out infinite alternate', transformOrigin: 'center' }} />
    </svg>
  ),
}

export default function PlayerBg({ identityIndex, children, style, className }: Props) {
  const identity = PLAYER_IDENTITIES[identityIndex % PLAYER_IDENTITIES.length]
  const patternId = `pbg-${identity.pattern}-${identityIndex}`
  const PatternEl = PATTERNS[identity.pattern]

  return (
    <div
      className={className}
      style={{ background: identity.color, position: 'relative', overflow: 'hidden', ...style }}
    >
      <div style={{ position: 'absolute', inset: 0, opacity: 0.28 }}>
        <PatternEl shade={identity.shade} id={patternId} />
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}
