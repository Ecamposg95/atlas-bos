import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { platformApi, type IndustryPreset } from '../../api/platform'
import { useAuthStore } from '../../store/authStore'
import './startup.css'

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// Presets cuyo display_name de BD esté marcado legacy se ocultan del wizard.
const isLegacy = (p: IndustryPreset) => /legacy/i.test(p.display_name)

// Fallback mínimo si /platform/presets no responde: el onboarding nunca debe
// quedar sin opciones.
const FALLBACK_PRESETS: IndustryPreset[] = [
  { id: -1, industry_type: 'ATLAS_POS', display_name: 'Atlas POS', description: 'Punto de venta de entrada.', modules: [], is_system: true },
  { id: -2, industry_type: 'CUSTOM', display_name: 'Personalizado', description: 'Configuración manual desde cero.', modules: [], is_system: true },
]

// Iconos por industry_type (lucide-style). Default genérico para los que falten.
const PRESET_ICONS: Record<string, React.ReactNode> = {
  ATLAS_POS: (
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </>
  ),
  ATLAS_ONE_RETAIL: (
    <>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </>
  ),
  ATLAS_ONE_RESTAURANT: (
    <>
      <path d="M3 2v7c0 1.1.9 2 2 2a2 2 0 0 0 2-2V2" />
      <path d="M5 2v20" />
      <path d="M21 15V2a5 5 0 0 0-3 4.5v6.5z" />
      <path d="M18 15v7" />
    </>
  ),
  ATLAS_ONE_CAFE: (
    <>
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </>
  ),
  ATLAS_ONE_BAR: (
    <>
      <path d="M8 22h8" />
      <path d="M12 15v7" />
      <path d="M5 3h14l-1 9a6 6 0 0 1-12 0z" />
    </>
  ),
  ATLAS_ONE_BARBER: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </>
  ),
  ATLAS_ONE_BEAUTY_WELLNESS: (
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  ),
  ATLAS_ONE_HEALTH: (
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  ),
  ATLAS_ONE_SERVICES: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  ),
  ATLAS_ONE_ENTERPRISE: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V11l-6-4" />
    </>
  ),
  CUSTOM: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
}

const DEFAULT_ICON = (
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
  </>
)

// Orden de despliegue: Atlas POS primero, Personalizado al final, resto alfabético.
function orderPresets(list: IndustryPreset[]): IndustryPreset[] {
  const rank = (p: IndustryPreset) =>
    p.industry_type === 'ATLAS_POS' ? 0 : p.industry_type === 'CUSTOM' ? 2 : 1
  return [...list].sort((a, b) =>
    rank(a) - rank(b) || a.display_name.localeCompare(b.display_name)
  )
}

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
  const [presets, setPresets] = useState<IndustryPreset[]>([])
  const initialized = useRef(false)

  // Cargar presets reales desde la BD (fuente única de verdad).
  useEffect(() => {
    let cancelled = false
    platformApi.getPresets()
      .then(data => {
        if (cancelled) return
        const usable = orderPresets((data || []).filter((p: IndustryPreset) => !isLegacy(p)))
        setPresets(usable.length ? usable : FALLBACK_PRESETS)
      })
      .catch(() => { if (!cancelled) setPresets(FALLBACK_PRESETS) })
    return () => { cancelled = true }
  }, [])

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

  const startSetup = async (industryType: string) => {
    if (busy) return
    setBusy(true)
    setSubMsg(`Iniciando despliegue de ${industryType}...`)
    setPhase('launching')
    try {
      const { data } = await client.post('/setup/initialize', { industry_type: industryType })
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
        {presets.map(preset => (
          <PresetCard
            key={preset.industry_type}
            industryType={preset.industry_type}
            title={preset.display_name}
            description={preset.description || ''}
            highlighted={preset.industry_type === 'ATLAS_POS'}
            onPick={startSetup}
            onHover={preset.industry_type === 'ATLAS_POS' ? () => setPurpleMode(true) : undefined}
            onLeave={preset.industry_type === 'ATLAS_POS' ? () => setPurpleMode(false) : undefined}
            busy={busy}
          >
            <PresetIcon paths={PRESET_ICONS[preset.industry_type] || DEFAULT_ICON} />
          </PresetCard>
        ))}
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
  industryType: string
  title: string
  description: string
  highlighted?: boolean
  busy: boolean
  onPick: (industryType: string) => void
  onHover?: () => void
  onLeave?: () => void
  children: React.ReactNode
}

function PresetCard({ industryType, title, description, highlighted, busy, onPick, onHover, onLeave, children }: PresetCardProps) {
  return (
    <button
      type="button"
      className={`setup-card${highlighted ? ' card-atlas-pos' : ''}${busy ? ' is-dimmed' : ''}`}
      onClick={() => onPick(industryType)}
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
