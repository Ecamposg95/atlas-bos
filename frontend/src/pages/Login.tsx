import { useState, useEffect, useRef, FormEvent, RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { AtlasMark } from '../components/atlas-one'
import './login.css'

const HERO_MESSAGES = [
  { title: 'Ventas más fluidas.',    emphasis: 'Negocio ágil.' },
  { title: 'Control de inventario.', emphasis: 'Todo en orden.' },
  { title: 'Inteligencia en caja.',  emphasis: 'Cierre perfecto.' },
  { title: 'Toda tu operación.',     emphasis: 'En una sola plataforma.' },
]

/* Partículas ambientales — flotan dentro del panel (specks claros sobre el azul) */
function useAmbientParticles(
  canvasRef: RefObject<HTMLCanvasElement>,
  hostRef: RefObject<HTMLElement>,
) {
  useEffect(() => {
    const canvas = canvasRef.current
    const host = hostRef.current
    if (!canvas || !host) return
    const cv = canvas
    const ctx = cv.getContext('2d')
    if (!ctx) return

    const resize = () => {
      cv.width = host.clientWidth
      cv.height = host.clientHeight
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    class Particle {
      px = 0; py = 0; vx = 0; vy = 0; size = 0; opacity = 0
      constructor() { this.reset() }
      reset() {
        this.px = Math.random() * cv.width
        this.py = Math.random() * cv.height
        this.vx = (Math.random() - 0.5) * 0.15
        this.vy = (Math.random() - 0.5) * 0.15
        this.size = Math.random() * 2 + 0.5
        this.opacity = Math.random() * 0.4 + 0.1
      }
      update() {
        this.px += this.vx; this.py += this.vy
        if (this.px < 0 || this.px > cv.width || this.py < 0 || this.py > cv.height) this.reset()
      }
      draw(context: CanvasRenderingContext2D) {
        context.beginPath()
        context.arc(this.px, this.py, this.size, 0, Math.PI * 2)
        context.fillStyle = `rgba(235, 244, 255, ${this.opacity})`
        context.fill()
      }
    }

    const particles = Array.from({ length: 40 }, () => new Particle())
    let rafId: number
    const animate = () => {
      ctx.clearRect(0, 0, cv.width, cv.height)
      particles.forEach(p => { p.update(); p.draw(ctx) })
      rafId = requestAnimationFrame(animate)
    }
    animate()
    return () => { cancelAnimationFrame(rafId); ro.disconnect() }
  }, [canvasRef, hostRef])
}

/* Dial geométrico — anillo de marcas que gira lento, ambiente detrás del copy */
function GeometricDial() {
  const dialRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = dialRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let frame = 0
    let rafId: number

    const animate = () => {
      frame++
      const size = canvas.width = 620
      canvas.height = 620
      const cx = size / 2, cy = size / 2, radius = 250

      ctx.clearRect(0, 0, size, size)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)'
      ctx.lineWidth = 0.8

      for (let i = 0; i < 140; i++) {
        const angle = (i * (Math.PI * 2) / 140) + (frame * 0.0006)
        const length = i % 10 === 0 ? 24 : 11
        const x1 = cx + Math.cos(angle) * radius
        const y1 = cy + Math.sin(angle) * radius
        const x2 = cx + Math.cos(angle) * (radius - length)
        const y2 = cy + Math.sin(angle) * (radius - length)
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
      }

      ctx.beginPath()
      ctx.arc(cx, cy, radius - 46, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.22)'
      ctx.stroke()

      rafId = requestAnimationFrame(animate)
    }

    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return <canvas ref={dialRef} className="visual-dial" />
}

export function LoginPage() {
  const [isRevealed, setIsRevealed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [socialNotice, setSocialNotice] = useState('')

  // Typewriter (panel azul izquierdo)
  const [heroIndex, setHeroIndex] = useState(0)
  const [displayedTitle, setDisplayedTitle] = useState('')
  const [displayedEmphasis, setDisplayedEmphasis] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [typingPhase, setTypingPhase] = useState<'title' | 'emphasis'>('title')

  const visualRef = useRef<HTMLElement>(null)
  const particlesRef = useRef<HTMLCanvasElement>(null)
  const userInputRef = useRef<HTMLInputElement>(null)
  const formPanelRef = useRef<HTMLElement>(null)

  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const setBranch = useAuthStore((s) => s.setBranch)

  useAmbientParticles(particlesRef, visualRef)

  useEffect(() => {
    const currentMsg = HERO_MESSAGES[heroIndex]
    let timer: ReturnType<typeof setTimeout>

    if (!isDeleting) {
      if (typingPhase === 'title') {
        if (displayedTitle.length < currentMsg.title.length) {
          timer = setTimeout(() => setDisplayedTitle(currentMsg.title.slice(0, displayedTitle.length + 1)), 55)
        } else {
          timer = setTimeout(() => setTypingPhase('emphasis'), 350)
        }
      } else {
        if (displayedEmphasis.length < currentMsg.emphasis.length) {
          timer = setTimeout(() => setDisplayedEmphasis(currentMsg.emphasis.slice(0, displayedEmphasis.length + 1)), 40)
        } else {
          timer = setTimeout(() => setIsDeleting(true), 3800)
        }
      }
    } else {
      if (displayedEmphasis.length > 0) {
        timer = setTimeout(() => setDisplayedEmphasis(displayedEmphasis.slice(0, -1)), 22)
      } else if (displayedTitle.length > 0) {
        setTypingPhase('title')
        timer = setTimeout(() => setDisplayedTitle(displayedTitle.slice(0, -1)), 30)
      } else {
        setIsDeleting(false)
        setHeroIndex((prev) => (prev + 1) % HERO_MESSAGES.length)
      }
    }
    return () => clearTimeout(timer)
  }, [displayedTitle, displayedEmphasis, isDeleting, heroIndex, typingPhase])

  const handleReveal = () => {
    setIsRevealed(true)
    setTimeout(() => userInputRef.current?.focus(), 700)
  }

  // Clic fuera del formulario → colapsa la cortina (como el login anterior)
  const handleSceneClick = (e: React.MouseEvent) => {
    if (!isRevealed || isSuccess) return
    if (formPanelRef.current && !formPanelRef.current.contains(e.target as Node)) {
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
      setIsSuccess(true)
      setTimeout(() => {
        if (data.user.platform_role === 'SUPERADMIN') { navigate('/platform/metrics'); return }
        const role = data.user.role
        if (['VENDEDOR', 'SOPORTE_OPERATIVO'].includes(role)) navigate('/mobile/dashboard')
        else if (['CAJERO', 'GERENTE'].includes(role)) navigate('/atlas-pos')
        else if (role === 'CLIENTE') navigate('/portal')
        else navigate('/hq/operations')
      }, 600)
    } catch {
      setError('Credenciales inválidas. Intenta de nuevo.')
      setIsLoading(false)
    }
  }

  // TODO(oauth): cablear proveedores reales cuando el backend exponga OAuth.
  // Hoy el backend solo soporta usuario/contraseña (OAuth2PasswordRequestForm).
  const handleSocial = (provider: string) => {
    setSocialNotice(`El acceso con ${provider} estará disponible pronto.`)
  }

  const cardClass = ['login-card', isRevealed && 'is-revealed', isSuccess && 'is-success']
    .filter(Boolean).join(' ')

  return (
    <div className="login-scene" onClick={handleSceneClick}>
      <div className={cardClass}>
        {/* ── Panel de formulario (se revela) ── */}
        <main className="login-form-panel" ref={formPanelRef}>
          <div className="form-mark"><AtlasMark size={30} color="#0B0B0B" accent="#2563eb" /></div>
          <h1 className="form-title">Bienvenido de nuevo</h1>
          <p className="form-subtitle">
            Accede a tu suite Atlas One: ventas, inventario y operación conectados.
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="login-user">Tu correo o usuario</label>
              <input
                id="login-user"
                ref={userInputRef}
                type="text"
                placeholder="tucorreo@atlasone.com.mx"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="login-pass">Contraseña</label>
              <div className="field-password">
                <input
                  id="login-pass"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Verificando…' : 'Acceder'}
            </button>
          </form>

          <div className="divider"><span>o continúa con</span></div>

          <div className="social-row">
            <button type="button" className="social-btn" onClick={() => handleSocial('Google')} aria-label="Continuar con Google">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
              </svg>
            </button>
            <button type="button" className="social-btn" onClick={() => handleSocial('GitHub')} aria-label="Continuar con GitHub">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#1a0f0a" d="M12 1a11 11 0 0 0-3.48 21.44c.55.1.75-.24.75-.53v-1.87c-3.06.67-3.7-1.47-3.7-1.47-.5-1.27-1.22-1.61-1.22-1.61-1-.68.08-.67.08-.67 1.1.08 1.68 1.14 1.68 1.14.98 1.68 2.57 1.2 3.2.92.1-.71.38-1.2.7-1.47-2.44-.28-5.01-1.22-5.01-5.44 0-1.2.43-2.18 1.13-2.95-.11-.28-.49-1.4.11-2.92 0 0 .92-.3 3.02 1.13a10.4 10.4 0 0 1 5.5 0c2.1-1.43 3.02-1.13 3.02-1.13.6 1.52.22 2.64.11 2.92.7.77 1.13 1.75 1.13 2.95 0 4.23-2.58 5.16-5.03 5.43.4.34.75 1 .75 2.03v3.01c0 .29.2.64.76.53A11 11 0 0 0 12 1Z" />
              </svg>
            </button>
            <button type="button" className="social-btn" onClick={() => handleSocial('Apple')} aria-label="Continuar con Apple">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#1a0f0a" d="M17.05 12.7c-.03-2.5 2.04-3.7 2.13-3.76-1.16-1.7-2.97-1.93-3.61-1.96-1.54-.15-3 .9-3.78.9-.78 0-1.98-.88-3.25-.86-1.67.03-3.21.97-4.07 2.46-1.73 3-.44 7.45 1.24 9.89.82 1.19 1.8 2.53 3.08 2.48 1.24-.05 1.7-.8 3.2-.8 1.49 0 1.91.8 3.21.77 1.33-.02 2.17-1.21 2.98-2.41.94-1.38 1.33-2.72 1.35-2.79-.03-.01-2.59-.99-2.61-3.94ZM14.6 5.1c.68-.83 1.14-1.98 1.02-3.12-.98.04-2.17.65-2.88 1.48-.63.73-1.19 1.9-1.04 3.02 1.1.08 2.21-.55 2.9-1.38Z" />
              </svg>
            </button>
          </div>

          {socialNotice && <p className="social-notice">{socialNotice}</p>}

          <p className="form-footer">
            ¿Problemas para entrar? <a>Contacta a soporte</a>
          </p>
        </main>

        {/* ── Panel visual azul (cortina que se retrae al revelar) ── */}
        <aside className="login-visual" ref={visualRef}>
          <div className="visual-mesh" />
          <GeometricDial />
          <canvas ref={particlesRef} className="visual-particles" />
          <div className="visual-grain" />

          <div className="visual-brand">
            <AtlasMark size={26} color="#ffffff" accent="#93c5fd" />
            <span className="brand-name">Atlas One</span>
          </div>
          <div className="visual-copy">
            <span className="visual-eyebrow">Tu operación, en un solo lugar</span>
            <h2 className="visual-headline">
              <span className="vh-title">{displayedTitle}</span>{' '}
              <span className="vh-emph">{displayedEmphasis}</span>
              <span className="vh-cursor">|</span>
            </h2>
            <button type="button" className="reveal-cta" onClick={handleReveal}>
              Iniciar sesión
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
