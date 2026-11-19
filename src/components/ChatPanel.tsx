import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ChatMessage } from '../../shared/types'

interface Props {
  messages: ChatMessage[]
  youId: string
  onSend: (text: string) => void
}

export function ChatPanel({ messages, youId, onSend }: Props) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, open])

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    onSend(value)
    setText('')
  }

  return (
    <aside className={`chat-panel ${open ? 'open' : 'closed'}`}>
      <button type="button" className="chat-toggle" onClick={() => setOpen((v) => !v)}>
        Chat
        {!open && messages.length > 0 ? ` · ${messages.length}` : ''}
      </button>
      {open && (
        <>
          <div className="chat-list" ref={listRef}>
            {messages.length === 0 && <p className="chat-empty">Chưa có tin nhắn.</p>}
            {messages.map((m) => (
              <div key={m.id} className={`chat-msg ${m.playerId === youId ? 'mine' : ''}`}>
                <span className="chat-name">
                  {m.name}
                  {m.spectating ? ' · xem' : ''}
                </span>
                <span className="chat-text">{m.text}</span>
              </div>
            ))}
          </div>
          <form className="chat-form" onSubmit={submit}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={200}
              placeholder="Nhắn tin…"
              aria-label="Tin nhắn"
            />
            <button type="submit" className="primary-btn" disabled={!text.trim()}>
              Gửi
            </button>
          </form>
        </>
      )}
    </aside>
  )
}
