import { useState, type FormEvent } from 'react'

interface Props {
  initialCode?: string
  onCreate: (name: string) => void
  onJoin: (name: string, code: string) => void
  busy: boolean
  error: string | null
}

export function Home({ initialCode, onCreate, onJoin, busy, error }: Props) {
  const [name, setName] = useState(() => localStorage.getItem('samloc-name') ?? '')
  const [code, setCode] = useState(initialCode ?? '')
  const [mode, setMode] = useState<'create' | 'join'>(initialCode ? 'join' : 'create')

  function persistName(value: string) {
    setName(value)
    localStorage.setItem('samloc-name', value)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (mode === 'create') onCreate(name.trim())
    else onJoin(name.trim(), code.trim().toUpperCase())
  }

  return (
    <div className="home">
      <div className="home-atmosphere" aria-hidden />
      <header className="home-brand">
        <p className="brand-mark">Sâm Lốc</p>
        <h1 className="brand-title">Online</h1>
        <p className="brand-tagline">
          Chơi sâm lốc với bạn bè qua link chia sẻ — tối đa 5 người một bàn.
        </p>
      </header>

      <form className="home-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Tên của bạn</span>
          <input
            value={name}
            onChange={(e) => persistName(e.target.value)}
            maxLength={16}
            placeholder="VD: Minh"
            autoFocus
            required
          />
        </label>

        <div className="mode-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'create'}
            className={mode === 'create' ? 'active' : ''}
            onClick={() => setMode('create')}
          >
            Tạo bàn
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'join'}
            className={mode === 'join' ? 'active' : ''}
            onClick={() => setMode('join')}
          >
            Vào bàn
          </button>
        </div>

        {mode === 'join' && (
          <label className="field">
            <span>Mã phòng</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="VD: AB12CD"
              required
            />
          </label>
        )}

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="primary-btn" disabled={busy}>
          {busy ? 'Đang kết nối…' : mode === 'create' ? 'Tạo phòng' : 'Vào chơi'}
        </button>
      </form>

      <footer className="home-rules">
        <p>
          Mỗi người 10 lá · 3 nhỏ nhất, heo (2) lớn nhất · Báo Sâm trước khi đánh ·
          Về nhất thắng.
        </p>
      </footer>
    </div>
  )
}
