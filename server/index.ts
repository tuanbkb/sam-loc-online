import cors from 'cors'
import express from 'express'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { customAlphabet } from 'nanoid'
import { Server } from 'socket.io'
import { Room } from './room.js'

const PORT = Number(process.env.PORT) || 3001
const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')

const app = express()
app.use(cors())
app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: true, methods: ['GET', 'POST'] },
})

const rooms = new Map<string, Room>()

function getRoom(code: unknown): Room | undefined {
  if (typeof code !== 'string' || !code) return undefined
  return rooms.get(code.toUpperCase())
}

function broadcastRoom(room: Room): void {
  for (const p of room.getPublicState().players) {
    const full = room.findById(p.id)
    if (!full?.socketId) continue
    const state = room.getClientState(p.id)
    if (state) io.to(full.socketId).emit('state', state)
  }
  for (const spec of room.listSpectators()) {
    const state = room.getSpectatorState(spec.id)
    if (state) io.to(spec.socketId).emit('state', state)
  }
}

function sendChatHistory(socketId: string, room: Room): void {
  io.to(socketId).emit('chatHistory', room.recentChat())
}

type JoinResult =
  | { ok: true; code: string; playerId: string; spectating?: boolean }
  | { ok: false; error: string }

io.on('connection', (socket) => {
  socket.on(
    'createRoom',
    (
      payload: { name: string },
      cb: (res: { ok: true; code: string; playerId: string } | { ok: false; error: string }) => void,
    ) => {
      const code = nanoid()
      const room = new Room(code)
      const playerId = nanoid()
      const result = room.addPlayer(playerId, payload.name, socket.id)
      if (!result.ok) {
        cb(result)
        return
      }
      rooms.set(code, room)
      socket.join(code)
      socket.data.playerId = result.playerId
      socket.data.roomCode = code
      cb({ ok: true, code, playerId: result.playerId })
      broadcastRoom(room)
      sendChatHistory(socket.id, room)
    },
  )

  socket.on(
    'joinRoom',
    (
      payload: { code: string; name: string; playerId?: string },
      cb: (res: JoinResult) => void,
    ) => {
      const code = payload.code.trim().toUpperCase()
      const room = getRoom(code)
      if (!room) {
        cb({ ok: false, error: 'Không tìm thấy phòng.' })
        return
      }

      // Reconnect with existing playerId
      if (payload.playerId && room.reconnect(payload.playerId, socket.id)) {
        room.removeSpectator(socket.id)
        socket.join(code)
        socket.data.playerId = payload.playerId
        socket.data.roomCode = code
        socket.data.spectating = false
        cb({ ok: true, code, playerId: payload.playerId })
        broadcastRoom(room)
        sendChatHistory(socket.id, room)
        return
      }

      // Match already started — watch live, do not take a seat
      if (room.isLive) {
        const spectatorId = nanoid()
        const watched = room.addSpectator(spectatorId, payload.name, socket.id)
        if (!watched.ok) {
          cb(watched)
          return
        }
        socket.join(code)
        socket.data.playerId = watched.playerId
        socket.data.roomCode = code
        socket.data.spectating = true
        cb({ ok: true, code, playerId: watched.playerId, spectating: true })
        broadcastRoom(room)
        sendChatHistory(socket.id, room)
        return
      }

      const playerId = nanoid()
      const result = room.addPlayer(playerId, payload.name, socket.id)
      if (!result.ok) {
        cb(result)
        return
      }
      socket.join(code)
      socket.data.playerId = result.playerId
      socket.data.roomCode = code
      socket.data.spectating = false
      cb({ ok: true, code, playerId: result.playerId })
      broadcastRoom(room)
      sendChatHistory(socket.id, room)
    },
  )

  socket.on(
    'roomInfo',
    (payload: { code: string }, cb: (res: { ok: true; live: boolean; phase: string; players: number } | { ok: false }) => void) => {
      const room = getRoom(payload?.code)
      if (!room) {
        cb({ ok: false })
        return
      }
      cb({
        ok: true,
        live: room.isLive,
        phase: room.getPublicState().phase,
        players: room.playerCount,
      })
    },
  )

  socket.on('setReady', (ready: boolean) => {
    const room = getRoom(socket.data.roomCode)
    const playerId = socket.data.playerId as string | undefined
    if (!room || !playerId) return
    const result = room.setReady(playerId, ready)
    if (result.ok) broadcastRoom(room)
    else socket.emit('errorMsg', result.error)
  })

  socket.on('startRound', () => {
    const room = getRoom(socket.data.roomCode)
    const playerId = socket.data.playerId as string | undefined
    if (!room || !playerId) return
    const result = room.startRound(playerId)
    if (result.ok) broadcastRoom(room)
    else socket.emit('errorMsg', result.error)
  })

  socket.on('declareSam', (declare: boolean) => {
    const room = getRoom(socket.data.roomCode)
    const playerId = socket.data.playerId as string | undefined
    if (!room || !playerId) return
    const result = room.declareSam(playerId, declare)
    if (result.ok) broadcastRoom(room)
    else socket.emit('errorMsg', result.error)
  })

  socket.on('playCards', (cardIds: string[]) => {
    const room = getRoom(socket.data.roomCode)
    const playerId = socket.data.playerId as string | undefined
    if (!room || !playerId) return
    const result = room.playCards(playerId, cardIds)
    if (result.ok) {
      broadcastRoom(room)
      if (result.scoreFlash) {
        io.to(room.code).emit('scoreFlash', result.scoreFlash)
      }
    } else socket.emit('errorMsg', result.error)
  })

  socket.on('pass', () => {
    const room = getRoom(socket.data.roomCode)
    const playerId = socket.data.playerId as string | undefined
    if (!room || !playerId) return
    const result = room.pass(playerId)
    if (result.ok) broadcastRoom(room)
    else socket.emit('errorMsg', result.error)
  })

  socket.on('returnToLobby', () => {
    const room = getRoom(socket.data.roomCode)
    const playerId = socket.data.playerId as string | undefined
    if (!room || !playerId) return
    const result = room.returnToLobby(playerId)
    if (result.ok) broadcastRoom(room)
    else socket.emit('errorMsg', result.error)
  })

  socket.on('chat', (text: string) => {
    const room = getRoom(socket.data.roomCode)
    const playerId = socket.data.playerId as string | undefined
    if (!room || !playerId || typeof text !== 'string') return
    const result = room.addChat(playerId, text, !!socket.data.spectating)
    if (!result) return
    if ('error' in result) {
      socket.emit('errorMsg', result.error)
      return
    }
    io.to(room.code).emit('chat', result)
  })

  socket.on('leaveRoom', () => {
    const room = getRoom(socket.data.roomCode)
    const playerId = socket.data.playerId as string | undefined
    if (!room || !playerId) return
    if (socket.data.spectating) {
      room.removeSpectator(socket.id)
    } else {
      room.removePlayer(playerId)
    }
    socket.leave(room.code)
    socket.data.roomCode = undefined
    socket.data.playerId = undefined
    socket.data.spectating = false
    if (room.playerCount === 0) rooms.delete(room.code)
    else broadcastRoom(room)
  })

  socket.on('disconnect', () => {
    const room = getRoom(socket.data.roomCode)
    if (!room) return
    if (socket.data.spectating) {
      room.removeSpectator(socket.id)
      return
    }
    room.disconnect(socket.id)
    if (room.playerCount === 0) rooms.delete(room.code)
    else broadcastRoom(room)
  })
})

setInterval(() => {
  for (const [code, room] of rooms) {
    const changed = room.pruneDisconnectedLobby()
    if (room.playerCount === 0) rooms.delete(code)
    else if (changed) broadcastRoom(room)
  }
}, 15_000)

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Sâm Lốc server listening on http://0.0.0.0:${PORT}`)
})
