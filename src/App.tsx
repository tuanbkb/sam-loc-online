import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { ChatMessage, ClientState, ScoreFlash } from '../shared/types'
import { ChatPanel } from './components/ChatPanel'
import { GameTable } from './components/GameTable'
import { Home } from './components/Home'
import { Lobby } from './components/Lobby'
import { socket } from './socket'
import './App.css'

function parseRoomFromPath(): string | undefined {
  const m = window.location.pathname.match(/^\/r\/([A-Za-z0-9]+)/i)
  return m?.[1]?.toUpperCase()
}

function sessionKey(code: string) {
  return `samloc-session-${code}`
}

export default function App() {
  const [state, setState] = useState<ClientState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [scoreFlash, setScoreFlash] = useState<ScoreFlash | null>(null)
  const [chat, setChat] = useState<ChatMessage[]>([])
  const clearScoreFlash = useCallback(() => setScoreFlash(null), [])
  const initialCode = parseRoomFromPath()

  useEffect(() => {
    function onState(s: ClientState) {
      setState(s)
      setBusy(false)
      setError(null)
      if (s.room.code) {
        window.history.replaceState(null, '', `/r/${s.room.code}`)
        if (!s.spectating) {
          localStorage.setItem(
            sessionKey(s.room.code),
            JSON.stringify({ playerId: s.you.playerId }),
          )
        }
      }
    }

    function onErrorMsg(msg: string) {
      setToast(msg)
      setTimeout(() => setToast(null), 3200)
    }

    function onScoreFlash(flash: ScoreFlash) {
      setScoreFlash(flash)
    }

    function onChatHistory(list: ChatMessage[]) {
      setChat(list)
    }

    function onChat(message: ChatMessage) {
      setChat((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message].slice(-80),
      )
    }

    socket.on('state', onState)
    socket.on('errorMsg', onErrorMsg)
    socket.on('scoreFlash', onScoreFlash)
    socket.on('chatHistory', onChatHistory)
    socket.on('chat', onChat)
    if (!socket.connected) socket.connect()

    // Link: rejoin as player, or watch live if the hand already started
    const code = parseRoomFromPath()
    if (code) {
      const raw = localStorage.getItem(sessionKey(code))
      const name = localStorage.getItem('samloc-name') || 'Khán giả'
      let playerId: string | undefined
      if (raw) {
        try {
          playerId = (JSON.parse(raw) as { playerId: string }).playerId
        } catch {
          /* ignore */
        }
      }
      const enter = () => {
        socket.emit('roomInfo', { code }, (info) => {
          if (!info.ok) return
          if (!info.live && !playerId) return
          setBusy(true)
          socket.emit('joinRoom', { code, name, playerId }, (res) => {
            setBusy(false)
            if (!res.ok) {
              if (playerId) localStorage.removeItem(sessionKey(code))
              setError(res.error)
              return
            }
            if (!res.spectating) {
              localStorage.setItem(
                sessionKey(res.code),
                JSON.stringify({ playerId: res.playerId }),
              )
            }
          })
        })
      }
      if (socket.connected) enter()
      else socket.once('connect', enter)
    }

    return () => {
      socket.off('state', onState)
      socket.off('errorMsg', onErrorMsg)
      socket.off('scoreFlash', onScoreFlash)
      socket.off('chatHistory', onChatHistory)
      socket.off('chat', onChat)
    }
  }, [])

  function whenConnected(run: () => void) {
    if (socket.connected) run()
    else {
      if (!socket.active) socket.connect()
      socket.once('connect', run)
    }
  }

  function createRoom(name: string) {
    setBusy(true)
    setError(null)
    whenConnected(() => {
      socket.emit('createRoom', { name }, (res) => {
        setBusy(false)
        if (!res.ok) {
          setError(res.error)
          return
        }
        localStorage.setItem(
          sessionKey(res.code),
          JSON.stringify({ playerId: res.playerId }),
        )
      })
    })
  }

  function joinRoom(name: string, code: string) {
    setBusy(true)
    setError(null)
    const raw = localStorage.getItem(sessionKey(code))
    let playerId: string | undefined
    if (raw) {
      try {
        playerId = (JSON.parse(raw) as { playerId: string }).playerId
      } catch {
        /* ignore */
      }
    }
    whenConnected(() => {
      socket.emit('joinRoom', { code, name, playerId }, (res) => {
        setBusy(false)
        if (!res.ok) {
          setError(res.error)
          return
        }
        if (!res.spectating) {
          localStorage.setItem(
            sessionKey(res.code),
            JSON.stringify({ playerId: res.playerId }),
          )
        }
      })
    })
  }

  function leave() {
    const code = state?.room.code
    socket.emit('leaveRoom')
    if (code && !state?.spectating) localStorage.removeItem(sessionKey(code))
    setChat([])
    setState(null)
    window.history.replaceState(null, '', '/')
  }

  let body: ReactNode
  if (!state) {
    body = (
      <Home
        initialCode={initialCode}
        onCreate={createRoom}
        onJoin={joinRoom}
        busy={busy}
        error={error}
      />
    )
  } else if (!state.spectating && state.room.phase === 'lobby') {
    body = (
      <Lobby
        state={state}
        onReady={(ready) => socket.emit('setReady', ready)}
        onStart={() => socket.emit('startRound')}
        onLeave={leave}
      />
    )
  } else {
    body = (
      <GameTable
        state={state}
        scoreFlash={scoreFlash}
        onScoreFlashDone={clearScoreFlash}
        onDeclare={(d) => socket.emit('declareSam', d)}
        onPlay={(ids) => socket.emit('playCards', ids)}
        onPass={() => socket.emit('pass')}
        onNextRound={() => socket.emit('startRound')}
        onLeave={leave}
      />
    )
  }

  return (
    <div className="app-shell">
      {body}
      {state && (
        <ChatPanel
          messages={chat}
          youId={state.you.playerId}
          onSend={(text) => socket.emit('chat', text)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
