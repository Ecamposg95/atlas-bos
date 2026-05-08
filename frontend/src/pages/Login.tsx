import { useState, useEffect, useRef, useCallback, FormEvent, RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import './login.css'

const CAPABILITIES = [
  'Ventas en Tiempo Real', 'Gestión de Inventarios', 'Cierres de Caja',
  'Facturación Electrónica', 'Reportes de Venta', 'Multi-sucursal', 'Analítica POS',
]

const HERO_MESSAGES = [
  { title: 'Ventas más fluidas.', emphasis: 'Negocio ágil.' },
  { title: 'Control de inventario.', emphasis: 'Todo en orden.' },
  { title: 'Inteligencia en caja.', emphasis: 'Cierre perfecto.' },
  { title: 'Tu punto de venta.', emphasis: 'El corazón de Atlas.' },
]

function useLightParticles(canvasRef: RefObject<HTMLCanvasElement>) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    }
    window.addEventListener('resize', resize)
    resize()

    class Particle {
      px = 0; py = 0; vx = 0; vy = 0; size = 0; opacity = 0
      constructor() { this.reset() }
      reset() {
        if (!canvas) return
        this.px = Math.random() * canvas.width
        this.py = Math.random() * canvas.height
        this.vx = (Math.random() - 0.5) * 0.02
        this.vy = (Math.random() - 0.5) * 0.02
        this.size = Math.random() * 2 + 0.5
        this.opacity = Math.random() * 0.12
      }
      update() {
        if (!canvas) return
        this.px += this.vx; this.py += this.vy
        if (this.px < 0 || this.px > canvas.width || this.py < 0 || this.py > canvas.height) this.reset()
      }
      draw(context: CanvasRenderingContext2D) {
        context.beginPath()
        context.arc(this.px, this.py, this.size, 0, Math.PI * 2)
        context.fillStyle = `rgba(122, 122, 245, ${this.opacity})`
        context.fill()
      }
    }

    const particles = Array.from({ length: 45 }, () => new Particle())
    let rafId: number
    const animate = () => {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => { p.update(); p.draw(ctx) })
      rafId = requestAnimationFrame(animate)
    }
    animate()
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', resize) }
  }, [canvasRef])
}

function GeometricDial({ isRevealed }: { isRevealed: boolean }) {
  const dialRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = dialRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let frame = 0

    const animate = () => {
      frame++
      const size = canvas.width = 700
      canvas.height = 700
      const cx = size / 2, cy = size / 2, radius = 260

      ctx.clearRect(0, 0, size, size)
      ctx.strokeStyle = 'rgba(6, 5, 15, 0.12)'
      ctx.lineWidth = 0.8

      for (let i = 0; i < 140; i++) {
        const angle = (i * (Math.PI * 2) / 140) + (frame * 0.0006)
        const length = i % 10 === 0 ? 25 : 12
        const x1 = cx + Math.cos(angle) * radius
        const y1 = cy + Math.sin(angle) * radius
        const x2 = cx + Math.cos(angle) * (radius - length)
        const y2 = cy + Math.sin(angle) * (radius - length)
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
      }

      ctx.beginPath()
      ctx.arc(cx, cy, radius - 50, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(122, 122, 245, 0.08)'
      ctx.stroke()

      requestAnimationFrame(animate)
    }

    const rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <div className={`dial-wrapper${isRevealed ? ' hidden' : ''}`}>
      <canvas ref={dialRef} className="dial-canvas" />
      <div className="dial-center-blur-circle" />
    </div>
  )
}

export function LoginPage() {
  const [isRevealed, setIsRevealed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Typewriter
  const [heroIndex, setHeroIndex] = useState(0)
  const [displayedTitle, setDisplayedTitle] = useState('')
  const [displayedEmphasis, setDisplayedEmphasis] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [typingPhase, setTypingPhase] = useState<'title' | 'emphasis'>('title')

  // Cap ticker
  const [capIndex, setCapIndex] = useState(0)
  const [capActive, setCapActive] = useState(true)

  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const loginCardRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const setBranch = useAuthStore((s) => s.setBranch)

  useLightParticles(bgCanvasRef)

  // Typewriter effect
  useEffect(() => {
    const currentMsg = HERO_MESSAGES[heroIndex]
    let timer: ReturnType<typeof setTimeout>

    if (!isDeleting) {
      if (typingPhase === 'title') {
        if (displayedTitle.length < currentMsg.title.length) {
          timer = setTimeout(() => setDisplayedTitle(currentMsg.title.slice(0, displayedTitle.length + 1)), 60)
        } else {
          timer = setTimeout(() => setTypingPhase('emphasis'), 400)
        }
      } else {
        if (displayedEmphasis.length < currentMsg.emphasis.length) {
          timer = setTimeout(() => setDisplayedEmphasis(currentMsg.emphasis.slice(0, displayedEmphasis.length + 1)), 40)
        } else {
          timer = setTimeout(() => setIsDeleting(true), 4000)
        }
      }
    } else {
      if (displayedEmphasis.length > 0) {
        timer = setTimeout(() => setDisplayedEmphasis(displayedEmphasis.slice(0, -1)), 25)
      } else if (displayedTitle.length > 0) {
        setTypingPhase('title')
        timer = setTimeout(() => setDisplayedTitle(displayedTitle.slice(0, -1)), 35)
      } else {
        setIsDeleting(false)
        setHeroIndex((prev) => (prev + 1) % HERO_MESSAGES.length)
      }
    }
    return () => clearTimeout(timer)
  }, [displayedTitle, displayedEmphasis, isDeleting, heroIndex, typingPhase])

  // Cap ticker rotation
  useEffect(() => {
    const id = setInterval(() => {
      setCapActive(false)
      setTimeout(() => { setCapIndex(i => (i + 1) % CAPABILITIES.length); setCapActive(true) }, 800)
    }, 5000)
    return () => clearInterval(id)
  }, [])

  const handleReveal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsRevealed(true)
  }, [])

  const handleRootClick = (e: React.MouseEvent) => {
    if (isLoggedIn) return
    if (loginCardRef.current && !loginCardRef.current.contains(e.target as Node)) {
      setIsRevealed(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const data = await authApi.login(username, password)
      setAuth(data.user, data.access_token, data.organization)
      if (data.branch) setBranch(data.branch)
      setIsLoggedIn(true)
      setTimeout(() => {
        if (data.user.platform_role === 'SUPERADMIN') { navigate('/platform/metrics'); return }
        const role = data.user.role
        if (['VENDEDOR', 'SOPORTE_OPERATIVO'].includes(role)) navigate('/mobile/dashboard')
        else if (['CAJERO', 'GERENTE'].includes(role)) navigate('/atlas-pos')
        else if (role === 'CLIENTE') navigate('/portal')
        else navigate('/hq/operations')
      }, 800)
    } catch {
      setError('Credenciales inválidas. Intenta de nuevo.')
      setIsLoading(false)
    }
  }

  const rootClass = ['auth-root', isRevealed && 'is-revealed', isLoggedIn && 'is-logged-in']
    .filter(Boolean).join(' ')

  return (
    <div className={rootClass} onClick={handleRootClick}>
      {/* Background */}
      <div className="ethereal-bg">
        <div className="bg-aurora-mesh" />
        <div className="aurora-blob a-1" />
        <div className="aurora-blob a-2" />
        <div className="aurora-blob a-3" />
        <canvas ref={bgCanvasRef} className="bg-particles" />
      </div>

      {/* Brand */}
      <div className="brand-header">
        <div className="brand-logo">atlastech<span>.mx</span></div>
      </div>

      {/* Hero */}
      <div className="hero-content">
        <div className="brand-subtitle">DataxPos</div>
        <div className="beta-tag">SISTEMA ATLAS V2.5 ONLINE</div>

        <div className="headline-container">
          <h1 className="headline">
            <span className="title-text">{displayedTitle}</span><br />
            <span className="emphasis-text italic-serif">{displayedEmphasis}</span>
            <span className="terminal-cursor">|</span>
          </h1>
        </div>

        <p className="hero-description">
          Ventas sin fricción. Nuestra arquitectura DataxPos conecta cada<br />
          nodo de tu negocio en una interfaz diseñada para la velocidad.
        </p>

        <div className="hero-actions">
          <button className="btn-login-main" onClick={handleReveal}>Iniciar Sesión</button>
        </div>
      </div>

      {/* Geometric Dial */}
      <div className="dial-horizon-container">
        <GeometricDial isRevealed={isRevealed} />
      </div>

      {/* Login Panel */}
      <div className="login-panel" ref={loginCardRef} onClick={e => e.stopPropagation()}>
        <div className="panel-inner acrylic-surface">
          <div className="cap-indicator">
            <span className={`cap-name${capActive ? ' active' : ''}`}>{CAPABILITIES[capIndex]}</span>
          </div>
          <h2 className="panel-title">Acceso Seguro</h2>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>ID USUARIO</label>
              <input
                type="text"
                placeholder="usuario@atlastech.mx"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="form-group">
              <label>PIN DE ACCESO</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? 'VERIFICANDO...' : 'AUTENTICAR'}
            </button>
          </form>

          <div className="panel-footer">
            Emerge a la luz con atlastech.mx
          </div>
        </div>
      </div>
    </div>
  )
}
