import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { cardLabel } from '../../shared/cards'
import { canBeat, comboTypeLabel, parseCombo } from '../../shared/combos'
import type { ClientState, ScoreFlash } from '../../shared/types'
import { PlayingCard } from './PlayingCard'
import { ScoreFlashPopup } from './ScoreFlashPopup'

interface Props {
  state: ClientState
  scoreFlash: ScoreFlash | null
  onScoreFlashDone: () => void
  onDeclare: (declare: boolean) => void
  onPlay: (cardIds: string[]) => void
  onPass: () => void
  onNextRound: () => void
  onLeave: () => void
}

export function GameTable({
  state,
  scoreFlash,
  onScoreFlashDone,
  onDeclare,
  onPlay,
  onPass,
  onNextRound,
  onLeave,
}: Props) {
  const { room, you } = state
  const spectating = !!state.spectating
  const me = room.players.find((p) => p.id === you.playerId)
  const [selected, setSelected] = useState<string[]>([])

  const others = useMemo(() => {
    if (!me) return room.players.filter((p) => p.id !== you.playerId)
    const sorted = [...room.players].sort((a, b) => a.seat - b.seat)
    const myIdx = sorted.findIndex((p) => p.id === me.id)
    const rotated = [...sorted.slice(myIdx + 1), ...sorted.slice(0, myIdx)]
    return rotated
  }, [room.players, me, you.playerId])

  const isMyTurn =
    !spectating && room.phase === 'playing' && room.currentTurnId === you.playerId
  const turnPlayer = room.players.find((p) => p.id === room.currentTurnId)
  const isMyDeclare =
    !spectating &&
    room.phase === 'declaring' &&
    me &&
    room.declaringSeat === me.seat &&
    !me.hasDeclared
  const turnBanner = spectating
    ? room.phase === 'playing' && turnPlayer
      ? `Đang xem · lượt ${turnPlayer.name}`
      : `Đang xem · ${room.message}`
    : room.phase === 'playing'
      ? isMyTurn
        ? 'Đến lượt bạn'
        : turnPlayer
          ? `Lượt của ${turnPlayer.name}`
          : room.message
      : room.message

  useEffect(() => {
    if (!isMyTurn) setSelected([])
  }, [isMyTurn])

  const selectedCards = you.hand.filter((c) => selected.includes(c.id))
  const preview = parseCombo(selectedCards)
  const canPlaySelected = (() => {
    if (!isMyTurn || room.phase !== 'playing' || !preview) return false
    if (me?.passed) return false
    if (!room.lastCombo) return true
    return canBeat(room.lastCombo, preview)
  })()

  function toggleCard(id: string) {
    if (room.phase !== 'playing' || !isMyTurn) return
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function handlePlay() {
    if (!canPlaySelected) return
    onPlay(selected)
    setSelected([])
  }

  function handlePass() {
    onPass()
    setSelected([])
  }

  const myFlashDelta = scoreFlash?.changes.find((c) => c.playerId === you.playerId)?.delta

  return (
    <div className={`table-screen ${isMyTurn ? 'my-turn' : ''}`}>
      <ScoreFlashPopup
        flash={scoreFlash}
        youId={you.playerId}
        onDone={onScoreFlashDone}
      />
      <header className="table-topbar">
        <div>
          <p className="brand-mark sm">Sâm Lốc</p>
          <p className="room-code">Phòng {room.code}</p>
        </div>
        <p className={`status-msg ${isMyTurn ? 'status-my-turn' : room.phase === 'playing' ? 'status-wait' : ''}`}>
          {turnBanner}
        </p>
        <button type="button" className="ghost-btn" onClick={onLeave}>
          Rời
        </button>
      </header>

      <div className="felt">
        <div className="opponents">
          {(spectating ? room.players : others).map((p) => {
            const theirTurn = room.phase === 'playing' && room.currentTurnId === p.id
            const flashDelta = scoreFlash?.changes.find((c) => c.playerId === p.id)?.delta
            return (
            <div
              key={p.id}
              className={[
                'opponent',
                theirTurn ? 'turn' : '',
                p.passed ? 'passed' : '',
                room.samDeclarerId === p.id ? 'sam' : '',
                flashDelta ? (flashDelta > 0 ? 'score-gain' : 'score-loss') : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {theirTurn && <span className="turn-chip">Đang đánh</span>}
              {flashDelta != null && (
                <span className={`float-score ${flashDelta > 0 ? 'pos' : 'neg'}`}>
                  {flashDelta > 0 ? `+${flashDelta}` : flashDelta}
                </span>
              )}
              <div className="opp-name">
                {p.name}
                {room.samDeclarerId === p.id ? ' ★Sâm' : ''}
              </div>
              <div className="opp-meta">
                <span>{p.cardCount} lá</span>
                <span>{p.score} điểm</span>
              </div>
              <div
                className="opp-backs"
                style={{ '--n': Math.min(p.cardCount, 10) } as CSSProperties}
                aria-label={`${p.cardCount} lá`}
              >
                {Array.from({ length: Math.min(p.cardCount, 10) }).map((_, i) => (
                  <span
                    key={i}
                    className="mini-back"
                    style={{ '--i': i } as CSSProperties}
                  />
                ))}
              </div>
              {!p.connected && <span className="disc">Mất kết nối</span>}
            </div>
            )
          })}
        </div>

        <div className="center-pile">
          {room.lastCombo ? (
            <>
              <p className="pile-label">
                {comboTypeLabel(room.lastCombo.type)}
                {room.lastComboPlayerId &&
                  ` · ${room.players.find((p) => p.id === room.lastComboPlayerId)?.name ?? ''}`}
              </p>
              <div className="pile-cards">
                {room.lastCombo.cards.map((c) => (
                  <PlayingCard key={c.id} card={c} size="pile" />
                ))}
              </div>
            </>
          ) : (
            <p className="pile-empty">
              {room.phase === 'declaring'
                ? 'Đang báo Sâm…'
                : room.phase === 'roundEnd'
                  ? 'Ván kết thúc'
                  : 'Chưa có bài trên bàn'}
            </p>
          )}
        </div>

        {room.phase === 'declaring' && (
          <div className="declare-panel">
            {isMyDeclare ? (
              <>
                <p>Bạn có muốn báo Sâm?</p>
                <div className="action-row">
                  <button type="button" className="primary-btn danger" onClick={() => onDeclare(true)}>
                    Báo Sâm
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => onDeclare(false)}>
                    Bỏ qua
                  </button>
                </div>
              </>
            ) : (
              <p>
                Đang chờ{' '}
                {room.players.find((p) => p.seat === room.declaringSeat)?.name ?? '…'}{' '}
                quyết định…
              </p>
            )}
          </div>
        )}

        {room.phase === 'roundEnd' && room.roundResult && (
          <div className="result-panel">
            <h3>{room.roundResult.message}</h3>
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Người chơi</th>
                    <th>Kết quả</th>
                    <th>Điểm ván</th>
                    <th>Tổng điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {(room.roundResult.summaries.length
                    ? room.roundResult.summaries
                    : room.players
                        .slice()
                        .sort((a, b) => b.score - a.score)
                        .map((p) => ({
                          playerId: p.id,
                          name: p.name,
                          result: '—',
                          delta: 0,
                          total: p.score,
                        }))
                  ).map((row, index) => (
                    <tr
                      key={row.playerId}
                      className={row.playerId === you.playerId ? 'is-you' : ''}
                    >
                      <td>{index + 1}</td>
                      <td className="name-cell">
                        {row.name}
                        {row.playerId === you.playerId ? ' (bạn)' : ''}
                      </td>
                      <td>{row.result}</td>
                      <td className={row.delta > 0 ? 'delta-pos' : row.delta < 0 ? 'delta-neg' : 'delta-zero'}>
                        {row.delta > 0 ? `+${row.delta}` : row.delta}
                      </td>
                      <td className="total-cell">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {room.roundResult.scoreLines.length > 0 && (
              <details className="score-details">
                <summary>Chi tiết thanh toán</summary>
                <ul className="score-lines">
                  {room.roundResult.scoreLines.map((line, i) => (
                    <li key={i}>
                      {line.fromName} → {line.toName}: <strong>{line.amount}</strong>{' '}
                      <span className="muted">({line.reason})</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {me?.isHost ? (
              <button type="button" className="primary-btn" onClick={onNextRound}>
                Ván mới
              </button>
            ) : (
              <p className="muted">Chờ chủ phòng bắt đầu ván mới…</p>
            )}
          </div>
        )}
      </div>

      {spectating ? (
        <footer className="hand-dock watching">
          <div className="watch-banner" role="status">
            Đang xem trực tiếp — bạn không ngồi vào bàn và không thể đánh bài
          </div>
          {room.phase === 'playing' && turnPlayer && (
            <p className="selection-hint">Lượt của {turnPlayer.name}</p>
          )}
        </footer>
      ) : (
      <footer className={`hand-dock ${isMyTurn ? 'active-turn' : room.phase === 'playing' ? 'waiting-turn' : ''}`}>
        {isMyTurn && (
          <div className="your-turn-banner" role="status">
            Đến lượt bạn — chọn bài rồi nhấn Đánh
          </div>
        )}
        {room.phase === 'playing' && !isMyTurn && turnPlayer && (
          <div className="wait-turn-banner" role="status">
            Đang chờ {turnPlayer.name}…
          </div>
        )}

        <div className="me-meta">
          <span className={isMyTurn ? 'turn-badge' : ''}>
            {me?.name}
            {room.samDeclarerId === me?.id ? ' ★Sâm' : ''}
          </span>
          <span className="me-score-wrap">
            {me?.score ?? 0} điểm
            {myFlashDelta != null && (
              <span className={`float-score me ${myFlashDelta > 0 ? 'pos' : 'neg'}`}>
                {myFlashDelta > 0 ? `+${myFlashDelta}` : myFlashDelta}
              </span>
            )}
          </span>
        </div>

        <div className={`hand ${isMyTurn ? 'hand-active' : ''}`}>
          {you.hand.map((card) => (
            <PlayingCard
              key={card.id}
              card={card}
              selected={selected.includes(card.id)}
              dimmed={room.phase === 'playing' && !isMyTurn}
              onClick={
                isMyTurn
                  ? () => toggleCard(card.id)
                  : undefined
              }
            />
          ))}
        </div>

        {room.phase === 'playing' && (
          <div className="action-row">
            <p className="selection-hint">
              {!isMyTurn
                ? `Chờ ${turnPlayer?.name ?? 'đối thủ'} đánh`
                : selected.length === 0
                  ? 'Chọn bài để đánh'
                  : preview
                    ? `${comboTypeLabel(preview.type)} · ${selectedCards.map(cardLabel).join(' ')}`
                    : 'Bộ không hợp lệ'}
            </p>
            <button
              type="button"
              className="primary-btn"
              disabled={!canPlaySelected}
              onClick={handlePlay}
            >
              Đánh
            </button>
            <button
              type="button"
              className="secondary-btn"
              disabled={!isMyTurn || !room.lastCombo || !!me?.passed}
              onClick={handlePass}
            >
              Bỏ lượt
            </button>
          </div>
        )}
      </footer>
      )}
    </div>
  )
}
