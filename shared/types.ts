export type Suit = 'S' | 'H' | 'D' | 'C'
/** 3–10, J=11, Q=12, K=13, A=14, 2=15 */
export type Rank = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15

export interface Card {
  id: string
  rank: Rank
  suit: Suit
}

export type ComboType = 'single' | 'pair' | 'triple' | 'quad' | 'straight'

export interface Combo {
  type: ComboType
  cards: Card[]
  /** Comparison key (higher wins). For straights: ending rank in straight order. */
  value: number
  length: number
}

export type RoomPhase =
  | 'lobby'
  | 'declaring'
  | 'playing'
  | 'roundEnd'

export interface PlayerPublic {
  id: string
  name: string
  seat: number
  cardCount: number
  score: number
  isHost: boolean
  connected: boolean
  hasDeclared: boolean
  declaredSam: boolean
  passed: boolean
  playedThisRound: boolean
  isReady: boolean
}

export interface PlayRecord {
  playerId: string
  playerName: string
  combo: Combo | null
  kind: 'play' | 'pass'
}

export interface ScoreLine {
  fromId: string
  fromName: string
  toId: string
  toName: string
  amount: number
  reason: string
}

export interface PlayerRoundSummary {
  playerId: string
  name: string
  /** Outcome label for this round, e.g. "Về nhất", "Thua", "Đền Sâm" */
  result: string
  /** Net points gained/lost this round (including mid-round chops) */
  delta: number
  /** Running total after this round */
  total: number
}

export interface RoundResult {
  winnerId: string | null
  winnerName: string | null
  kind: 'normal' | 'samSuccess' | 'samBroken' | 'instant'
  scoreLines: ScoreLine[]
  summaries: PlayerRoundSummary[]
  message: string
}

export interface RoomPublicState {
  code: string
  phase: RoomPhase
  players: PlayerPublic[]
  maxPlayers: number
  currentTurnId: string | null
  leadPlayerId: string | null
  lastCombo: Combo | null
  lastComboPlayerId: string | null
  samDeclarerId: string | null
  playHistory: PlayRecord[]
  roundResult: RoundResult | null
  declaringSeat: number | null
  message: string
}

export interface PrivateState {
  hand: Card[]
  playerId: string
}

export interface ClientState {
  room: RoomPublicState
  you: PrivateState
}

/** Mid-round point change popup (e.g. chặt heo) */
export interface ScoreFlash {
  id: string
  reason: string
  changes: { playerId: string; name: string; delta: number }[]
}

export const MAX_PLAYERS = 5
export const MIN_PLAYERS = 2
export const HAND_SIZE = 10
