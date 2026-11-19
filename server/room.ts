import { createDeck, shuffle, sortHand } from '../shared/cards.js'
import {
  canBeat,
  cardsInHand,
  instantWinKind,
  parseCombo,
  removeCards,
} from '../shared/combos.js'
import {
  applyScoreLines,
  buildSummaries,
  scoreInstantWin,
  scoreNormalWin,
  scoreSamBroken,
  scoreSamSuccess,
} from '../shared/scoring.js'
import type {
  Card,
  ChatMessage,
  ClientState,
  Combo,
  PlayRecord,
  PlayerPublic,
  RoomPhase,
  RoomPublicState,
  RoundResult,
  ScoreFlash,
} from '../shared/types.js'
import { HAND_SIZE, MAX_PLAYERS, MIN_PLAYERS } from '../shared/types.js'

type PlayOk = { ok: true; scoreFlash?: ScoreFlash }
type PlayFail = { ok: false; error: string }

interface InternalPlayer {
  id: string
  name: string
  seat: number
  socketId: string | null
  hand: Card[]
  score: number
  /** Mid-round point changes (e.g. chặt heo) before end-of-round settlement */
  roundDelta: number
  isHost: boolean
  connected: boolean
  disconnectedAt?: number
  hasDeclared: boolean
  declaredSam: boolean
  passed: boolean
  playedThisRound: boolean
  isReady: boolean
}

interface Spectator {
  id: string
  name: string
  socketId: string
}

export class Room {
  readonly code: string
  private players: InternalPlayer[] = []
  private spectators: Spectator[] = []
  private chat: ChatMessage[] = []
  private lastChatAt = new Map<string, number>()
  private phase: RoomPhase = 'lobby'
  private currentTurnId: string | null = null
  private leadPlayerId: string | null = null
  private lastCombo: Combo | null = null
  private lastComboPlayerId: string | null = null
  private samDeclarerId: string | null = null
  /** Winner of the previous hand — leads next hand if nobody báo Sâm */
  private lastWinnerId: string | null = null
  private playHistory: PlayRecord[] = []
  private roundResult: RoundResult | null = null
  private declaringSeat: number | null = null
  private message = 'Chờ người chơi…'

  constructor(code: string) {
    this.code = code
  }

  get playerCount(): number {
    return this.players.length
  }

  /** A hand is in progress (or just finished) — new arrivals watch instead of sitting down. */
  get isLive(): boolean {
    return this.phase !== 'lobby'
  }

  listSpectators(): Spectator[] {
    return this.spectators
  }

  get isEmpty(): boolean {
    return this.players.every((p) => !p.connected) && this.players.length === 0
  }

  findBySocket(socketId: string): InternalPlayer | undefined {
    return this.players.find((p) => p.socketId === socketId)
  }

  findById(id: string): InternalPlayer | undefined {
    return this.players.find((p) => p.id === id)
  }

  addPlayer(
    id: string,
    name: string,
    socketId: string,
  ): { ok: true; playerId: string } | { ok: false; error: string } {
    const trimmed = name.trim().slice(0, 16) || 'Người chơi'

    // Reclaim seat if same name left disconnected (refresh / new tab)
    const existing = this.players.find(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (existing) {
      if (existing.connected && existing.socketId && existing.socketId !== socketId) {
        return { ok: false, error: 'Tên đã được dùng trong phòng.' }
      }
      existing.socketId = socketId
      existing.connected = true
      existing.disconnectedAt = undefined
      this.message = `${trimmed} đã vào lại.`
      return { ok: true, playerId: existing.id }
    }

    if (this.phase !== 'lobby') {
      return { ok: false, error: 'Ván đang chơi, không thể vào phòng mới.' }
    }
    if (this.players.length >= MAX_PLAYERS) {
      return { ok: false, error: `Phòng đã đủ ${MAX_PLAYERS} người.` }
    }

    const seat = this.nextSeat()
    const isHost = this.players.length === 0
    this.players.push({
      id,
      name: trimmed,
      seat,
      socketId,
      hand: [],
      score: 0,
      roundDelta: 0,
      isHost,
      connected: true,
      hasDeclared: false,
      declaredSam: false,
      passed: false,
      playedThisRound: false,
      isReady: false,
    })
    this.message = `${trimmed} đã vào phòng.`
    return { ok: true, playerId: id }
  }

  reconnect(playerId: string, socketId: string): boolean {
    const p = this.findById(playerId)
    if (!p) return false
    p.socketId = socketId
    p.connected = true
    p.disconnectedAt = undefined
    this.message = `${p.name} đã kết nối lại.`
    return true
  }

  disconnect(socketId: string): void {
    const p = this.findBySocket(socketId)
    if (!p) return
    p.connected = false
    p.socketId = null
    p.disconnectedAt = Date.now()
    this.message = `${p.name} mất kết nối.`
  }

  /** Drop players who stayed disconnected in lobby (called by server sweeper). */
  pruneDisconnectedLobby(maxMs = 45_000): boolean {
    if (this.phase !== 'lobby') return false
    const now = Date.now()
    let changed = false
    for (const p of [...this.players]) {
      if (p.connected) continue
      if (p.disconnectedAt && now - p.disconnectedAt > maxMs) {
        this.removePlayer(p.id)
        changed = true
      }
    }
    return changed
  }

  removePlayer(playerId: string): void {
    const idx = this.players.findIndex((p) => p.id === playerId)
    if (idx < 0) return
    const [removed] = this.players.splice(idx, 1)
    if (removed.isHost && this.players.length > 0) {
      this.players[0].isHost = true
    }
    this.message = `${removed.name} đã rời phòng.`
  }

  setReady(playerId: string, ready: boolean): { ok: true } | { ok: false; error: string } {
    if (this.phase !== 'lobby') return { ok: false, error: 'Không thể sẵn sàng lúc này.' }
    const p = this.findById(playerId)
    if (!p) return { ok: false, error: 'Không tìm thấy người chơi.' }
    p.isReady = ready
    return { ok: true }
  }

  startRound(hostId: string): { ok: true } | { ok: false; error: string } {
    if (this.phase !== 'lobby' && this.phase !== 'roundEnd') {
      return { ok: false, error: 'Không thể bắt đầu lúc này.' }
    }
    const host = this.findById(hostId)
    if (!host?.isHost) return { ok: false, error: 'Chỉ chủ phòng mới bắt đầu được.' }
    const connected = this.players.filter((p) => p.connected)
    if (connected.length < MIN_PLAYERS) {
      return { ok: false, error: `Cần ít nhất ${MIN_PLAYERS} người.` }
    }
    if (connected.length > MAX_PLAYERS) {
      return { ok: false, error: `Tối đa ${MAX_PLAYERS} người.` }
    }

    // Drop disconnected players between rounds
    this.players = this.players.filter((p) => p.connected)
    if (!this.players.some((p) => p.isHost) && this.players.length > 0) {
      this.players[0].isHost = true
    }

    const deck = shuffle(createDeck())
    let offset = 0
    for (const p of this.players) {
      p.hand = sortHand(deck.slice(offset, offset + HAND_SIZE))
      offset += HAND_SIZE
      p.hasDeclared = false
      p.declaredSam = false
      p.passed = false
      p.playedThisRound = false
      p.isReady = false
      p.roundDelta = 0
    }

    this.lastCombo = null
    this.lastComboPlayerId = null
    this.samDeclarerId = null
    this.playHistory = []
    this.roundResult = null
    this.currentTurnId = null
    this.leadPlayerId = null

    // Instant wins
    let best: { player: InternalPlayer; kind: string; strength: number } | null = null
    for (const p of this.players) {
      const iw = instantWinKind(p.hand)
      if (iw && (!best || iw.strength > best.strength)) {
        best = { player: p, kind: iw.kind, strength: iw.strength }
      }
    }
    if (best) {
      const others = this.players
        .filter((p) => p.id !== best!.player.id)
        .map((p) => ({ id: p.id, name: p.name }))
      this.settleRound(
        scoreInstantWin(best.player.id, best.player.name, best.kind, others),
      )
      return { ok: true }
    }

    this.phase = 'declaring'
    this.players.sort((a, b) => a.seat - b.seat)
    this.declaringSeat = this.players[0].seat
    this.message = `${this.players[0].name} quyết định báo Sâm…`
    return { ok: true }
  }

  declareSam(
    playerId: string,
    declare: boolean,
  ): { ok: true } | { ok: false; error: string } {
    if (this.phase !== 'declaring') {
      return { ok: false, error: 'Không phải lúc báo Sâm.' }
    }
    const p = this.findById(playerId)
    if (!p) return { ok: false, error: 'Không tìm thấy người chơi.' }
    if (p.seat !== this.declaringSeat) {
      return { ok: false, error: 'Chưa đến lượt bạn báo.' }
    }
    if (p.hasDeclared) return { ok: false, error: 'Bạn đã quyết định rồi.' }

    p.hasDeclared = true
    p.declaredSam = declare

    if (declare) {
      this.samDeclarerId = p.id
      this.beginPlay(p.id)
      this.message = `${p.name} báo Sâm!`
      return { ok: true }
    }

    const next = this.nextDeclaringPlayer(p.seat)
    if (!next) {
      // Nobody declared — previous winner leads; first hand uses lowest card
      const starter = this.findNextHandStarter()
      this.beginPlay(starter.id)
      this.message = `Không ai báo Sâm. ${starter.name} đánh trước.`
      return { ok: true }
    }

    this.declaringSeat = next.seat
    this.message = `${next.name} quyết định báo Sâm…`
    return { ok: true }
  }

  playCards(playerId: string, cardIds: string[]): PlayOk | PlayFail {
    if (this.phase !== 'playing') {
      return { ok: false, error: 'Không phải lúc đánh bài.' }
    }
    const p = this.findById(playerId)
    if (!p) return { ok: false, error: 'Không tìm thấy người chơi.' }
    if (this.currentTurnId !== playerId) {
      return { ok: false, error: 'Chưa đến lượt bạn.' }
    }
    if (p.passed) return { ok: false, error: 'Bạn đã bỏ lượt vòng này.' }

    const cards = cardIds
      .map((id) => p.hand.find((c) => c.id === id))
      .filter((c): c is Card => !!c)
    if (cards.length !== cardIds.length) {
      return { ok: false, error: 'Bài không hợp lệ.' }
    }
    if (!cardsInHand(p.hand, cards)) {
      return { ok: false, error: 'Bạn không có những lá này.' }
    }

    const combo = parseCombo(cards)
    if (!combo) return { ok: false, error: 'Không phải bộ bài hợp lệ.' }

    if (this.lastCombo) {
      if (!canBeat(this.lastCombo, combo)) {
        return { ok: false, error: 'Bộ bài không chặt được.' }
      }
    }

    const previousComboPlayerId = this.lastComboPlayerId
    let scoreFlash: ScoreFlash | undefined

    // Chop payment: quad on single 2
    if (
      this.lastCombo?.type === 'single' &&
      this.lastCombo.value === 15 &&
      combo.type === 'quad' &&
      previousComboPlayerId
    ) {
      const victim = this.findById(previousComboPlayerId)
      if (victim) {
        victim.score -= 15
        victim.roundDelta -= 15
        p.score += 15
        p.roundDelta += 15
        this.message = `${p.name} chặt heo — ${victim.name} đền 15.`
        scoreFlash = {
          id: `${Date.now()}-${p.id}`,
          reason: 'Chặt heo',
          changes: [
            { playerId: p.id, name: p.name, delta: 15 },
            { playerId: victim.id, name: victim.name, delta: -15 },
          ],
        }
      }
    }

    p.hand = removeCards(p.hand, cards)
    p.playedThisRound = true
    this.lastCombo = combo
    this.lastComboPlayerId = p.id
    this.playHistory.push({
      playerId: p.id,
      playerName: p.name,
      combo,
      kind: 'play',
    })

    // Sâm broken if anyone beats the declarer's combination
    if (
      this.samDeclarerId &&
      this.samDeclarerId !== p.id &&
      previousComboPlayerId === this.samDeclarerId
    ) {
      const declarer = this.findById(this.samDeclarerId)!
      const others = this.players
        .filter((x) => x.id !== declarer.id)
        .map((x) => ({ id: x.id, name: x.name }))
      this.settleRound(scoreSamBroken(declarer.id, declarer.name, others))
      return { ok: true, scoreFlash }
    }

    if (p.hand.length === 0) {
      this.finishRound(p)
      return { ok: true, scoreFlash }
    }

    this.clearPassesExcept(p.id)
    this.advanceTurn(p.id)
    if (!scoreFlash) {
      this.message = `${p.name} đánh ${combo.type}.`
    }
    return { ok: true, scoreFlash }
  }

  pass(playerId: string): { ok: true } | { ok: false; error: string } {
    if (this.phase !== 'playing') {
      return { ok: false, error: 'Không phải lúc bỏ lượt.' }
    }
    const p = this.findById(playerId)
    if (!p) return { ok: false, error: 'Không tìm thấy người chơi.' }
    if (this.currentTurnId !== playerId) {
      return { ok: false, error: 'Chưa đến lượt bạn.' }
    }
    if (!this.lastCombo) {
      return { ok: false, error: 'Bạn đang giữ quyền đánh — phải đánh bài.' }
    }
    if (this.samDeclarerId === playerId) {
      // Sam declarer can pass? Usually they keep leading — but if someone hasn't beaten yet and they... 
      // Actually in Sâm mode, others try to beat; declarer leads each new trick. Declarer shouldn't need to pass on their own lead.
      // If somehow last combo is theirs and others passed, trick resets. If last combo is opponent's, declarer lost already.
    }

    p.passed = true
    this.playHistory.push({
      playerId: p.id,
      playerName: p.name,
      combo: null,
      kind: 'pass',
    })

    const active = this.players.filter((x) => x.hand.length > 0)
    const notPassed = active.filter((x) => !x.passed)
    if (notPassed.length === 1 && this.lastComboPlayerId === notPassed[0].id) {
      // Trick won — new lead
      const leader = notPassed[0]
      this.lastCombo = null
      this.lastComboPlayerId = null
      this.clearAllPasses()
      this.currentTurnId = leader.id
      this.leadPlayerId = leader.id
      this.message = `${leader.name} được quyền đánh mới.`
      return { ok: true }
    }

    this.advanceTurn(p.id)
    this.message = `${p.name} bỏ lượt.`
    return { ok: true }
  }

  returnToLobby(hostId: string): { ok: true } | { ok: false; error: string } {
    const host = this.findById(hostId)
    if (!host?.isHost) return { ok: false, error: 'Chỉ chủ phòng.' }
    if (this.phase !== 'roundEnd') return { ok: false, error: 'Ván chưa kết thúc.' }
    this.phase = 'lobby'
    this.roundResult = null
    this.currentTurnId = null
    this.lastCombo = null
    this.playHistory = []
    this.samDeclarerId = null
    this.declaringSeat = null
    for (const p of this.players) {
      p.hand = []
      p.isReady = false
      p.hasDeclared = false
      p.declaredSam = false
      p.passed = false
      p.playedThisRound = false
    }
    this.message = 'Chờ ván mới…'
    return { ok: true }
  }

  addSpectator(
    id: string,
    name: string,
    socketId: string,
  ): { ok: true; playerId: string } | { ok: false; error: string } {
    if (!this.isLive) {
      return { ok: false, error: 'Ván chưa bắt đầu — hãy vào bàn.' }
    }
    const trimmed = name.trim().slice(0, 16) || 'Khán giả'
    this.spectators = this.spectators.filter((s) => s.socketId !== socketId)
    this.spectators.push({ id, name: trimmed, socketId })
    return { ok: true, playerId: id }
  }

  removeSpectator(socketId: string): boolean {
    const before = this.spectators.length
    this.spectators = this.spectators.filter((s) => s.socketId !== socketId)
    return this.spectators.length !== before
  }

  getClientState(playerId: string): ClientState | null {
    const you = this.findById(playerId)
    if (!you) return null
    return {
      room: this.getPublicState(),
      you: {
        playerId,
        hand: sortHand(you.hand),
      },
    }
  }

  addChat(authorId: string, text: string, spectating: boolean): ChatMessage | { error: string } | null {
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, 200)
    if (!clean) return null
    const now = Date.now()
    const prev = this.lastChatAt.get(authorId) ?? 0
    if (now - prev < 400) return { error: 'Chậm lại một chút.' }
    const player = this.findById(authorId)
    const spec = this.spectators.find((s) => s.id === authorId)
    const name = player?.name ?? spec?.name
    if (!name) return null
    this.lastChatAt.set(authorId, now)
    const msg: ChatMessage = {
      id: `${now}-${authorId}-${this.chat.length}`,
      playerId: authorId,
      name,
      text: clean,
      spectating: spectating || !player,
      at: now,
    }
    this.chat.push(msg)
    if (this.chat.length > 80) this.chat.splice(0, this.chat.length - 80)
    return msg
  }

  recentChat(): ChatMessage[] {
    return this.chat.slice(-50)
  }

  getSpectatorState(spectatorId: string): ClientState | null {
    const spec = this.spectators.find((s) => s.id === spectatorId)
    if (!spec) return null
    return {
      room: this.getPublicState(),
      you: { playerId: spec.id, hand: [] },
      spectating: true,
    }
  }

  getPublicState(): RoomPublicState {
    return {
      code: this.code,
      phase: this.phase,
      players: this.players
        .slice()
        .sort((a, b) => a.seat - b.seat)
        .map((p) => this.toPublic(p)),
      maxPlayers: MAX_PLAYERS,
      currentTurnId: this.currentTurnId,
      leadPlayerId: this.leadPlayerId,
      lastCombo: this.lastCombo,
      lastComboPlayerId: this.lastComboPlayerId,
      samDeclarerId: this.samDeclarerId,
      playHistory: this.playHistory.slice(-12),
      roundResult: this.roundResult,
      declaringSeat: this.declaringSeat,
      message: this.message,
    }
  }

  private toPublic(p: InternalPlayer): PlayerPublic {
    return {
      id: p.id,
      name: p.name,
      seat: p.seat,
      cardCount: p.hand.length,
      score: p.score,
      isHost: p.isHost,
      connected: p.connected,
      hasDeclared: p.hasDeclared,
      declaredSam: p.declaredSam,
      passed: p.passed,
      playedThisRound: p.playedThisRound,
      isReady: p.isReady,
    }
  }

  private nextSeat(): number {
    const used = new Set(this.players.map((p) => p.seat))
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (!used.has(i)) return i
    }
    return this.players.length
  }

  private nextDeclaringPlayer(afterSeat: number): InternalPlayer | null {
    const ordered = [...this.players].sort((a, b) => a.seat - b.seat)
    const idx = ordered.findIndex((p) => p.seat === afterSeat)
    for (let i = 1; i < ordered.length; i++) {
      const cand = ordered[(idx + i) % ordered.length]
      if (!cand.hasDeclared) return cand
    }
    return null
  }

  private findLowestCardHolder(): InternalPlayer {
    let best: InternalPlayer = this.players[0]
    let bestRank = 99
    for (const p of this.players) {
      for (const c of p.hand) {
        if (c.rank < bestRank) {
          bestRank = c.rank
          best = p
        }
      }
    }
    return best
  }

  private findNextHandStarter(): InternalPlayer {
    if (this.lastWinnerId) {
      const prev = this.findById(this.lastWinnerId)
      if (prev && prev.hand.length > 0) return prev
    }
    return this.findLowestCardHolder()
  }

  private beginPlay(starterId: string): void {
    this.phase = 'playing'
    this.declaringSeat = null
    this.currentTurnId = starterId
    this.leadPlayerId = starterId
    this.lastCombo = null
    this.lastComboPlayerId = null
    this.clearAllPasses()
  }

  private playersWithCards(): InternalPlayer[] {
    return [...this.players]
      .filter((p) => p.hand.length > 0)
      .sort((a, b) => a.seat - b.seat)
  }

  private advanceTurn(fromId: string): void {
    const ordered = this.playersWithCards()
    if (ordered.length === 0) return
    const idx = ordered.findIndex((p) => p.id === fromId)
    for (let i = 1; i <= ordered.length; i++) {
      const cand = ordered[(idx + i) % ordered.length]
      if (!cand.passed) {
        this.currentTurnId = cand.id
        return
      }
    }
  }

  private clearPassesExcept(_exceptId: string): void {
    for (const p of this.players) p.passed = false
  }

  private clearAllPasses(): void {
    for (const p of this.players) p.passed = false
  }

  private finishRound(winner: InternalPlayer): void {
    let result
    if (this.samDeclarerId === winner.id) {
      const others = this.players
        .filter((p) => p.id !== winner.id)
        .map((p) => ({ id: p.id, name: p.name }))
      result = scoreSamSuccess(winner.id, winner.name, others)
    } else if (this.samDeclarerId) {
      const declarer = this.findById(this.samDeclarerId)!
      const others = this.players
        .filter((p) => p.id !== declarer.id)
        .map((p) => ({ id: p.id, name: p.name }))
      result = scoreSamBroken(declarer.id, declarer.name, others)
    } else {
      const losers = this.players
        .filter((p) => p.id !== winner.id)
        .map((p) => ({
          id: p.id,
          name: p.name,
          hand: p.hand,
          playedThisRound: p.playedThisRound,
        }))
      result = scoreNormalWin(winner.id, winner.name, losers)
    }
    this.settleRound(result)
  }

  private settleRound(result: RoundResult): void {
    const map = new Map(this.players.map((p) => [p.id, p.score]))
    applyScoreLines(map, result.scoreLines)
    for (const p of this.players) {
      p.score = map.get(p.id) ?? p.score
    }
    result.summaries = buildSummaries(
      this.players.map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        roundDelta: p.roundDelta,
        playedThisRound: p.playedThisRound,
      })),
      result,
    )
    this.roundResult = result
    if (result.winnerId) this.lastWinnerId = result.winnerId
    this.phase = 'roundEnd'
    this.currentTurnId = null
    this.message = result.message
  }
}
