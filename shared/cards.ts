import type { Card, Rank, Suit } from './types.js'

export const SUITS: Suit[] = ['S', 'H', 'D', 'C']
export const RANKS: Rank[] = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

export const RANK_LABEL: Record<Rank, string> = {
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
  15: '2',
}

export const SUIT_SYMBOL: Record<Suit, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
}

export const SUIT_COLOR: Record<Suit, 'red' | 'black'> = {
  S: 'black',
  H: 'red',
  D: 'red',
  C: 'black',
}

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}${suit}`, rank, suit })
    }
  }
  return deck
}

export function shuffle<T>(items: T[], rng = Math.random): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function sortHand(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => a.rank - b.rank || a.suit.localeCompare(b.suit))
}

export function cardLabel(card: Card): string {
  return `${RANK_LABEL[card.rank]}${SUIT_SYMBOL[card.suit]}`
}
