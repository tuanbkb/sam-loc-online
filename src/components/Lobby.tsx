import { useState } from 'react'
import type { ClientState } from '../../shared/types'
import { MAX_PLAYERS, MIN_PLAYERS } from '../../shared/types'

interface Props {
  state: ClientState
  onReady: (ready: boolean) => void
  onStart: () => void
  onLeave: () => void
}

export function Lobby({ state, onReady, onStart, onLeave }: Props) {
  const { room, you } = state
  const me = room.players.find((p) => p.id === you.playerId)
  const [copied, setCopied] = useState(false)
  const shareUrl = `${window.location.origin}/r/${room.code}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      prompt('Sao chép link phòng:', shareUrl)
    }
  }

  const canStart =
    me?.isHost &&
    room.players.length >= MIN_PLAYERS &&
    room.players.every((p) => p.isReady || p.id === me.id)

  return (
    <div className="lobby">
      <header className="lobby-header">
        <p className="brand-mark sm">Sâm Lốc</p>
        <h2>Phòng {room.code}</h2>
        <p className="muted">
          {room.players.length}/{MAX_PLAYERS} người · cần tối thiểu {MIN_PLAYERS} để bắt đầu
        </p>
      </header>

      <div className="share-box">
        <label>Link mời bạn bè</label>
        <div className="share-row">
          <code>{shareUrl}</code>
          <button type="button" className="secondary-btn" onClick={copyLink}>
            {copied ? 'Đã chép!' : 'Sao chép'}
          </button>
        </div>
      </div>

      <ul className="player-list">
        {room.players.map((p) => (
          <li key={p.id} className={p.id === you.playerId ? 'you' : ''}>
            <span className="seat">{p.seat + 1}</span>
            <span className="pname">
              {p.name}
              {p.isHost ? ' · chủ phòng' : ''}
              {p.id === you.playerId ? ' (bạn)' : ''}
            </span>
            <span className={`ready-pill ${p.isReady ? 'on' : ''}`}>
              {p.isReady ? 'Sẵn sàng' : 'Đang chờ'}
            </span>
          </li>
        ))}
      </ul>

      <div className="lobby-actions">
        {me && (
          <button
            type="button"
            className="secondary-btn"
            onClick={() => onReady(!me.isReady)}
          >
            {me.isReady ? 'Hủy sẵn sàng' : 'Sẵn sàng'}
          </button>
        )}
        {me?.isHost && (
          <button
            type="button"
            className="primary-btn"
            onClick={onStart}
            disabled={room.players.length < MIN_PLAYERS}
            title={
              room.players.length < MIN_PLAYERS
                ? `Cần ít nhất ${MIN_PLAYERS} người`
                : undefined
            }
          >
            Bắt đầu ván
          </button>
        )}
        <button type="button" className="ghost-btn" onClick={onLeave}>
          Rời phòng
        </button>
      </div>

      {!canStart && me?.isHost && room.players.length >= MIN_PLAYERS && (
        <p className="hint">Bạn có thể bắt đầu khi mọi người đã sẵn sàng (hoặc bắt đầu luôn).</p>
      )}
    </div>
  )
}
