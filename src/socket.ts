import { io, Socket } from 'socket.io-client'
import type { ClientState, ScoreFlash } from '../shared/types'

export type ServerToClient = {
  state: (state: ClientState) => void
  errorMsg: (msg: string) => void
  scoreFlash: (flash: ScoreFlash) => void
}

export type ClientToServer = {
  createRoom: (
    payload: { name: string },
    cb: (res: { ok: true; code: string; playerId: string } | { ok: false; error: string }) => void,
  ) => void
  joinRoom: (
    payload: { code: string; name: string; playerId?: string },
    cb: (res: { ok: true; code: string; playerId: string } | { ok: false; error: string }) => void,
  ) => void
  setReady: (ready: boolean) => void
  startRound: () => void
  declareSam: (declare: boolean) => void
  playCards: (cardIds: string[]) => void
  pass: () => void
  returnToLobby: () => void
  leaveRoom: () => void
}

/** Same host the page was opened on (works for localhost and LAN IP). */
function socketUrl(): string {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return `http://${window.location.hostname}:3001`
  }
  return ''
}

export const socket: Socket<ServerToClient, ClientToServer> = io(socketUrl(), {
  autoConnect: false,
  transports: ['websocket', 'polling'],
})
