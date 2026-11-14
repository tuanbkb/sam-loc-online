import { useEffect, useState } from 'react'
import type { ScoreFlash } from '../../shared/types'

interface Props {
  flash: ScoreFlash | null
  youId: string
  onDone: () => void
}

export function ScoreFlashPopup({ flash, youId, onDone }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!flash) {
      setVisible(false)
      return
    }
    setVisible(true)
    const t = setTimeout(() => {
      setVisible(false)
      onDone()
    }, 2800)
    return () => clearTimeout(t)
  }, [flash, onDone])

  if (!flash || !visible) return null

  const yours = flash.changes.find((c) => c.playerId === youId)

  return (
    <div className="score-flash-overlay" role="status" aria-live="polite">
      <div className={`score-flash-card ${yours && yours.delta < 0 ? 'loss' : yours && yours.delta > 0 ? 'gain' : ''}`}>
        <p className="score-flash-reason">{flash.reason}</p>
        {yours && (
          <p className={`score-flash-you ${yours.delta > 0 ? 'pos' : 'neg'}`}>
            {yours.delta > 0 ? `+${yours.delta}` : yours.delta}
          </p>
        )}
        <ul className="score-flash-list">
          {flash.changes.map((c) => (
            <li key={c.playerId} className={c.playerId === youId ? 'you' : ''}>
              <span>{c.name}{c.playerId === youId ? ' (bạn)' : ''}</span>
              <strong className={c.delta > 0 ? 'pos' : 'neg'}>
                {c.delta > 0 ? `+${c.delta}` : c.delta}
              </strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
