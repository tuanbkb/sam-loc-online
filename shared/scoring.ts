import type { Card, PlayerRoundSummary, RoundResult, ScoreLine } from './types.js'

function countFours(hand: Card[]): number {
  const byRank = new Map<number, number>()
  for (const c of hand) byRank.set(c.rank, (byRank.get(c.rank) ?? 0) + 1)
  let n = 0
  for (const count of byRank.values()) {
    if (count === 4) n++
  }
  return n
}

function emptyResult(
  partial: Omit<RoundResult, 'summaries'>,
): RoundResult {
  return { ...partial, summaries: [] }
}

export function scoreNormalWin(
  winnerId: string,
  winnerName: string,
  losers: { id: string; name: string; hand: Card[]; playedThisRound: boolean }[],
): RoundResult {
  const scoreLines: ScoreLine[] = []

  for (const loser of losers) {
    let amount: number
    let reason: string

    if (!loser.playedThisRound) {
      amount = 15
      reason = 'Cóng'
    } else {
      const twos = loser.hand.filter((c) => c.rank === 15).length
      const fours = countFours(loser.hand)
      amount = loser.hand.length + twos * 5 + fours * 10
      const parts = [`${loser.hand.length} lá`]
      if (twos) parts.push(`thối ${twos} heo`)
      if (fours) parts.push(`${fours} tứ quý`)
      reason = parts.join(' + ')
    }

    scoreLines.push({
      fromId: loser.id,
      fromName: loser.name,
      toId: winnerId,
      toName: winnerName,
      amount,
      reason,
    })
  }

  return emptyResult({
    winnerId,
    winnerName,
    kind: 'normal',
    scoreLines,
    message: `${winnerName} về nhất!`,
  })
}

export function scoreSamSuccess(
  declarerId: string,
  declarerName: string,
  others: { id: string; name: string }[],
): RoundResult {
  const scoreLines: ScoreLine[] = others.map((o) => ({
    fromId: o.id,
    fromName: o.name,
    toId: declarerId,
    toName: declarerName,
    amount: 20,
    reason: 'Sâm thành công',
  }))
  return emptyResult({
    winnerId: declarerId,
    winnerName: declarerName,
    kind: 'samSuccess',
    scoreLines,
    message: `${declarerName} báo Sâm thành công!`,
  })
}

export function scoreSamBroken(
  declarerId: string,
  declarerName: string,
  others: { id: string; name: string }[],
): RoundResult {
  const scoreLines: ScoreLine[] = others.map((o) => ({
    fromId: declarerId,
    fromName: declarerName,
    toId: o.id,
    toName: o.name,
    amount: 20,
    reason: 'Đền Sâm',
  }))
  return emptyResult({
    winnerId: null,
    winnerName: null,
    kind: 'samBroken',
    scoreLines,
    message: `Sâm của ${declarerName} bị chặn!`,
  })
}

export function scoreInstantWin(
  winnerId: string,
  winnerName: string,
  kind: string,
  others: { id: string; name: string }[],
): RoundResult {
  const scoreLines: ScoreLine[] = others.map((o) => ({
    fromId: o.id,
    fromName: o.name,
    toId: winnerId,
    toName: winnerName,
    amount: 20,
    reason: `Tới trắng (${kind})`,
  }))
  return emptyResult({
    winnerId,
    winnerName,
    kind: 'instant',
    scoreLines,
    message: `${winnerName} tới trắng — ${kind}!`,
  })
}

export function applyScoreLines(
  scores: Map<string, number>,
  lines: ScoreLine[],
): void {
  for (const line of lines) {
    scores.set(line.fromId, (scores.get(line.fromId) ?? 0) - line.amount)
    scores.set(line.toId, (scores.get(line.toId) ?? 0) + line.amount)
  }
}

export function netDeltaFromLines(
  playerId: string,
  lines: ScoreLine[],
): number {
  let delta = 0
  for (const line of lines) {
    if (line.toId === playerId) delta += line.amount
    if (line.fromId === playerId) delta -= line.amount
  }
  return delta
}

export function resultLabelFor(
  playerId: string,
  result: RoundResult,
  playedThisRound: boolean,
): string {
  switch (result.kind) {
    case 'samSuccess':
      return playerId === result.winnerId ? 'Sâm thành công' : 'Thua Sâm'
    case 'samBroken':
      return result.scoreLines.some((l) => l.fromId === playerId)
        ? 'Đền Sâm'
        : 'Chặn Sâm'
    case 'instant':
      return playerId === result.winnerId ? 'Tới trắng' : 'Thua'
    case 'normal':
    default:
      if (playerId === result.winnerId) return 'Về nhất'
      if (!playedThisRound) return 'Cóng'
      return 'Thua'
  }
}

export function buildSummaries(
  players: { id: string; name: string; score: number; roundDelta: number; playedThisRound: boolean }[],
  result: RoundResult,
): PlayerRoundSummary[] {
  return players
    .map((p) => {
      const lineDelta = netDeltaFromLines(p.id, result.scoreLines)
      return {
        playerId: p.id,
        name: p.name,
        result: resultLabelFor(p.id, result, p.playedThisRound),
        delta: p.roundDelta + lineDelta,
        total: p.score,
      }
    })
    .sort((a, b) => b.total - a.total || b.delta - a.delta)
}
