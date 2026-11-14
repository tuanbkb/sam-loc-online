import { RANK_LABEL, SUIT_COLOR, SUIT_SYMBOL } from '../../shared/cards'
import type { Card } from '../../shared/types'

interface Props {
  card: Card
  selected?: boolean
  dimmed?: boolean
  /** @deprecated prefer size="small" */
  small?: boolean
  size?: 'small' | 'pile'
  onClick?: () => void
}

export function PlayingCard({ card, selected, dimmed, small, size, onClick }: Props) {
  const resolvedSize = size ?? (small ? 'small' : undefined)
  const color = SUIT_COLOR[card.suit]
  const className = [
    'playing-card',
    color,
    selected ? 'selected' : '',
    dimmed ? 'dimmed' : '',
    resolvedSize ?? '',
    onClick ? 'clickable' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={!onClick}
      aria-label={`${RANK_LABEL[card.rank]} ${SUIT_SYMBOL[card.suit]}`}
    >
      <span className="corner top">
        <span className="rank">{RANK_LABEL[card.rank]}</span>
        <span className="suit">{SUIT_SYMBOL[card.suit]}</span>
      </span>
      <span className="center-suit">{SUIT_SYMBOL[card.suit]}</span>
      <span className="corner bottom">
        <span className="rank">{RANK_LABEL[card.rank]}</span>
        <span className="suit">{SUIT_SYMBOL[card.suit]}</span>
      </span>
    </button>
  )
}

export function CardBack({ small }: { small?: boolean }) {
  return <div className={`playing-card back ${small ? 'small' : ''}`} aria-hidden />
}
