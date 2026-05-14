import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import './startup.css'

type PresetType = 'Atlas POS' | 'Retail' | 'Gastronomía' | 'Logística' | 'Servicios' | 'Manual'

const PRESET_KEY: Record<PresetType, string> = {
  'Atlas POS': 'ATLAS_POS',
  Retail: 'CUSTOM',
  'Gastronomía': 'CUSTOM',
  'Logística': 'CUSTOM',
  Servicios: 'CUSTOM',
  Manual: 'CUSTOM',
}

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

export function Startup() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const [mainMsg, setMainMsg] = useState('Bienvenido a Atlas One')
  const [subMsg, setSubMsg] = useState('Sincronizando flujos de inteligencia...')
  const [phase, setPhase] = useState<'booting' | 'idle' | 'launching'>('booting')
  const [purpleMode, setPurpleMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mainVisible, setMainVisible] = useState(false)
  const [subVisible, setSubVisible] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    let cancelled = false
    const run = async () => {
      await wait(1200)
      if (cancelled) return
      const userName = user?.full_name || user?.username || 'Operador'
      setMainMsg(`Hola, ${userName}`)
      setMainVisible(true)
      await wait(1000)
      if (cancelled) return
      setSubVisible(true)
      await wait(2200)
      if (cancelled) return
      setMainMsg('¿Qué impulsaremos hoy?')
      setSubMsg('Selecciona un preset para configurar tu entorno de trabajo.')
      setPhase('idle')
    }
    run()
    return () => { cancelled = true }
  }, [user])

  const startSetup = async (type: PresetType) => {
    if (busy) return
    setBusy(true)
    setSubMsg(`Iniciando despliegue de ${type}...`)
    setPhase('launching')
    try {
      const { data } = await client.post('/setup/initialize', { industry_type: PRESET_KEY[type] })
      await wait(1800)
      navigate(data?.redirect_url || '/atlas-pos')
    } catch {
      setSubMsg('Error al inicializar. Reintentando...')
      setPhase('idle')
      setBusy(false)
    }
  }

  const bodyClass = [
    'startup-page',
    `state-${phase === 'launching' ? 'idle' : phase}`,
    purpleMode ? 'purple-mode' : '',
    phase === 'launching' ? 'is-launching' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={bodyClass}>
      <div className="bg-glow" />

      <div className="welcome-content">
        <div className="orb-container">
          <div className="orb-wrapper">
            <div className="orb-core">
              <svg viewBox="0 0 100 100" className="logo-a" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 15 L85 85 H68 L50 45 L32 85 H15 L50 15 Z" />
                <rect x="42" y="78" width="16" height="5" />
              </svg>
            </div>
            <div className="orb-ring ring-1" />
            <div className="orb-ring ring-2" />
            <div className="orb-ring ring-3" />
          </div>
        </div>

        <h1 className={`main-message${mainVisible ? ' visible' : ''}`}>{mainMsg}</h1>
        <p className={`sub-message${subVisible ? ' visible' : ''}`}>{subMsg}</p>
      </div>

      <div className="setup-grid">
        <PresetCard
          type="Atlas POS"
          title="Atlas POS"
          description="Análisis predictivo, inteligencia de negocio y control de operaciones en tiempo real."
          highlighted
          onPick={startSetup}
          onHover={() => setPurpleMode(true)}
          onLeave={() => setPurpleMode(false)}
          busy={busy}
        >
          <PresetIcon paths={
            <>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </>
          } />
        </PresetCard>

        <PresetCard
          type="Retail"
          title="Retail & Comercio"
          description="Optimizado para ventas rápidas, control estricto de inventarios y múltiples puntos de cobro."
          onPick={startSetup}
          busy={busy}
        >
          <PresetIcon paths={
            <>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </>
          } />
        </PresetCard>

        <PresetCard
          type="Gastronomía"
          title="Gastronomía"
          description="Control de mesas, comandas digitales e integración directa con cocina y barra."
          onPick={startSetup}
          busy={busy}
        >
          <PresetIcon paths={
            <>
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
              <line x1="6" y1="1" x2="6" y2="4" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
            </>
          } />
        </PresetCard>

        <PresetCard
          type="Logística"
          title="Logística"
          description="Gestión multi-almacén, seguimiento de rutas y control de suministros críticos."
          onPick={startSetup}
          busy={busy}
        >
          <PresetIcon paths={
            <>
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </>
          } />
        </PresetCard>

        <PresetCard
          type="Servicios"
          title="Servicios"
          description="Gestión de agenda, facturación por horas y expedientes digitales de clientes."
          onPick={startSetup}
          busy={busy}
        >
          <PresetIcon paths={
            <>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </>
          } />
        </PresetCard>

        <PresetCard
          type="Manual"
          title="Personalizado"
          description="Control total. Selecciona y configura cada módulo del sistema de manera independiente."
          onPick={startSetup}
          busy={busy}
        >
          <PresetIcon paths={
            <>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </>
          } />
        </PresetCard>
      </div>
    </div>
  )
}

function PresetIcon({ paths }: { paths: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths}
    </svg>
  )
}

interface PresetCardProps {
  type: PresetType
  title: string
  description: string
  highlighted?: boolean
  busy: boolean
  onPick: (t: PresetType) => void
  onHover?: () => void
  onLeave?: () => void
  children: React.ReactNode
}

function PresetCard({ type, title, description, highlighted, busy, onPick, onHover, onLeave, children }: PresetCardProps) {
  return (
    <button
      type="button"
      className={`setup-card${highlighted ? ' card-atlas-pos' : ''}${busy ? ' is-dimmed' : ''}`}
      onClick={() => onPick(type)}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      disabled={busy}
    >
      <div className="icon-box">{children}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </button>
  )
}
