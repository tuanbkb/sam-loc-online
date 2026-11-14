import type { Card, Combo, ComboType } from './types.js'

/**
 * Straight order for Sâm (bs.fyi style):
 * A-2-3 is lowest; then 3-4-5 … Q-K-A highest. No K-A-2 wrap.
 */
function straightValue(ranks: number[]): number | null {
  const sortedUnique = [...new Set(ranks)].sort((a, b) => a - b)
  if (sortedUnique.length !== ranks.length) return null
  if (sortedUnique.length < 3) return null

  // A-2-3 special
  if (
    sortedUnique.length === 3 &&
    sortedUnique.includes(14) &&
    sortedUnique.includes(15) &&
    sortedUnique.includes(3)
  ) {
    return 1 // lowest
  }

  // No other straight may include 2
  if (sortedUnique.includes(15)) return null

  // Must be consecutive in normal order (3..A)
  for (let i = 1; i < sortedUnique.length; i++) {
    if (sortedUnique[i] !== sortedUnique[i - 1] + 1) return null
  }

  // Value by highest card: 3-4-5 = 5, … Q-K-A = 14
  // Offset so A-2-3 (1) is below 3-4-5 (5)
  return sortedUnique[sortedUnique.length - 1]
}

export function parseCombo(cards: Card[]): Combo | null {
  if (cards.length === 0) return null
  const sorted = [...cards].sort((a, b) => a.rank - b.rank)
  const ranks = sorted.map((c) => c.rank)

  if (cards.length === 1) {
    return { type: 'single', cards: sorted, value: ranks[0], length: 1 }
  }

  if (cards.length === 2) {
    if (ranks[0] === ranks[1]) {
      return { type: 'pair', cards: sorted, value: ranks[0], length: 2 }
    }
    return null
  }

  if (cards.length === 3) {
    if (ranks[0] === ranks[1] && ranks[1] === ranks[2]) {
      return { type: 'triple', cards: sorted, value: ranks[0], length: 3 }
    }
    const sv = straightValue(ranks)
    if (sv !== null) {
      return { type: 'straight', cards: sorted, value: sv, length: 3 }
    }
    return null
  }

  if (cards.length === 4) {
    if (ranks.every((r) => r === ranks[0])) {
      return { type: 'quad', cards: sorted, value: ranks[0], length: 4 }
    }
    const sv = straightValue(ranks)
    if (sv !== null) {
      return { type: 'straight', cards: sorted, value: sv, length: 4 }
    }
    return null
  }

  // 5–10: only straights
  if (cards.length >= 5 && cards.length <= 10) {
    const sv = straightValue(ranks)
    if (sv !== null) {
      return { type: 'straight', cards: sorted, value: sv, length: cards.length }
    }
  }

  return null
}

/** Can `next` beat `prev`? Same type/size higher value, or chop rules. */
export function canBeat(prev: Combo, next: Combo): boolean {
  // Chop: four of a kind beats a single 2
  if (prev.type === 'single' && prev.value === 15 && next.type === 'quad') {
    return true
  }
  // Higher quad beats lower quad
  if (prev.type === 'quad' && next.type === 'quad') {
    return next.value > prev.value
  }

  if (prev.type !== next.type) return false
  if (prev.length !== next.length) return false
  return next.value > prev.value
}

export function isLegalLead(combo: Combo): boolean {
  return parseCombo(combo.cards) !== null
}

export function comboTypeLabel(type: ComboType): string {
  const labels: Record<ComboType, string> = {
    single: 'Rác',
    pair: 'Đôi',
    triple: 'Sám',
    quad: 'Tứ quý',
    straight: 'Sảnh',
  }
  return labels[type]
}

export function removeCards(hand: Card[], played: Card[]): Card[] {
  const ids = new Set(played.map((c) => c.id))
  return hand.filter((c) => !ids.has(c.id))
}

export function cardsInHand(hand: Card[], cards: Card[]): boolean {
  const counts = new Map<string, number>()
  for (const c of hand) counts.set(c.id, (counts.get(c.id) ?? 0) + 1)
  for (const c of cards) {
    const n = counts.get(c.id) ?? 0
    if (n <= 0) return false
    counts.set(c.id, n - 1)
  }
  return true
}

/** Detect instant-win hands (tới trắng). Returns strength 1–5 or null. */
export function instantWinKind(hand: Card[]): { kind: string; strength: number } | null {
  if (hand.length !== 10) return null
  const byRank = new Map<number, number>()
  for (const c of hand) byRank.set(c.rank, (byRank.get(c.rank) ?? 0) + 1)

  // Dragon: one straight of 10
  if (parseCombo(hand)?.type === 'straight') {
    return { kind: 'Sảnh rồng', strength: 5 }
  }

  // Four 2s
  if ((byRank.get(15) ?? 0) === 4) {
    return { kind: 'Tứ quý heo', strength: 4 }
  }

  // One colour
  const red = hand.every((c) => c.suit === 'H' || c.suit === 'D')
  const black = hand.every((c) => c.suit === 'S' || c.suit === 'C')
  if (red || black) {
    return { kind: red ? 'Đồng màu đỏ' : 'Đồng màu đen', strength: 3 }
  }

  // Three triples
  let triples = 0
  for (const n of byRank.values()) {
    if (n >= 3) triples += Math.floor(n / 3)
  }
  if (triples >= 3) {
    return { kind: 'Ba sám', strength: 2 }
  }

  // Five pairs (quad counts as two pairs)
  let pairUnits = 0
  for (const n of byRank.values()) {
    pairUnits += Math.floor(n / 2)
  }
  if (pairUnits >= 5) {
    return { kind: 'Năm đôi', strength: 1 }
  }

  // Sâm nghèo: every card is below 10, or A, or 2 (no 10 / J / Q / K)
  if (hand.every((c) => c.rank < 10 || c.rank === 14 || c.rank === 15)) {
    return { kind: 'Sâm nghèo', strength: 1 }
  }

  return null
}
