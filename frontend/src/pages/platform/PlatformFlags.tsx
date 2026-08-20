import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  flagsApi,
  platformApi,
  FeatureFlag,
  OrgFeatureOverride,
  FlagResolvePreview,
  FlagResolveSource,
  PlatformOrg,
} from '../../api/platform'
import { toast } from '../../store/toastStore'
import { useAuthStore } from '../../store/authStore'
import { DataTable, DataTableColumn } from '../../components/platform/DataTable'
import { SideDrawer } from '../../components/platform/SideDrawer'
import { ConfirmModal } from '../../components/platform/ConfirmModal'
import { KPICardV2 } from '../../components/platform/v2/KPICardV2'

import '../../styles/platform-v2.css'

// ── Tokens / inline styles ──────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--p-surface-2)',
  color: 'var(--p-text)',
  border: '1px solid var(--p-border)',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--p-muted)',
  fontWeight: 600,
  marginBottom: 6,
}

const monoStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--p-text)',
  letterSpacing: '0.01em',
}

// ── Primitives ──────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
  tone = 'accent',
  labelOn = 'On',
  labelOff = 'Off',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  tone?: 'accent' | 'danger' | 'success'
  labelOn?: string
  labelOff?: string
}) {
  const onColor =
    tone === 'danger' ? 'var(--p-danger)' :
    tone === 'success' ? 'var(--p-success)' :
    'var(--p-accent)'
  return (
    <button
      type="button"
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px 4px 6px',
        borderRadius: 999,
        border: '1px solid ' + (checked ? onColor : 'var(--p-border)'),
        background: checked ? 'color-mix(in oklab, ' + onColor + ' 14%, transparent)' : 'var(--p-surface-2)',
        color: checked ? onColor : 'var(--p-muted)',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 20,
          height: 12,
          borderRadius: 999,
          background: checked ? onColor : 'var(--p-border)',
          position: 'relative',
          transition: 'background 0.15s ease',
        }}
      >
        <span
          style={{
            display: 'block',
            width: 8,
            height: 8,
            borderRadius: 999,
            background: 'var(--p-surface)',
            position: 'absolute',
            top: 2,
            left: checked ? 10 : 2,
            transition: 'left 0.15s ease',
          }}
        />
      </span>
      {checked ? labelOn : labelOff}
    </button>
  )
}

function RolloutBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div
      title={`${clamped}%`}
      style={{
        width: 120,
        height: 8,
        borderRadius: 999,
        background: 'var(--p-surface-2)',
        border: '1px solid var(--p-border)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: clamped + '%',
          height: '100%',
          background: 'var(--p-accent)',
          transition: 'width 0.2s ease',
        }}
      />
    </div>
  )
}

function KeyChip({ flagKey }: { flagKey: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: 6,
        border: '1px solid var(--p-border)',
        background: 'var(--p-surface-2)',
        color: 'var(--p-text)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        letterSpacing: '0.01em',
      }}
    >
      {flagKey}
    </span>
  )
}

function StatusPill({ killed }: { killed: boolean }) {
  const color = killed ? 'var(--p-danger)' : 'var(--p-success)'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 999,
        background: 'color-mix(in oklab, ' + color + ' 12%, transparent)',
        color,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        border: '1px solid ' + color + '44',
      }}
    >
      <i className={'fa-solid ' + (killed ? 'fa-ban' : 'fa-circle-check')} style={{ fontSize: 10 }} />
      {killed ? 'Killed' : 'Activo'}
    </span>
  )
}

function SourceBadge({ source }: { source: FlagResolveSource }) {
  const map: Record<FlagResolveSource, { label: string; color: string; icon: string }> = {
    override: { label: 'Override', color: 'var(--p-accent)',  icon: 'fa-pen' },
    killed:   { label: 'Killed',   color: 'var(--p-danger)',  icon: 'fa-ban' },
    rollout:  { label: 'Rollout',  color: 'var(--p-warning)', icon: 'fa-flask' },
    default:  { label: 'Default',  color: 'var(--p-muted)',   icon: 'fa-gear' },
  }
  const m = map[source]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 6,
        border: '1px solid ' + m.color + '44',
        background: 'color-mix(in oklab, ' + m.color + ' 12%, transparent)',
        color: m.color,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      <i className={'fa-solid ' + m.icon} style={{ fontSize: 10 }} />
      {m.label}
    </span>
  )
}

// ── Drawer state ─────────────────────────────────────────────────────────────

interface FlagDraft {
  description: string
  default_enabled: boolean
  rollout_pct: number
  is_killed: boolean
}

function draftFromFlag(f: FeatureFlag): FlagDraft {
  return {
    description: f.description ?? '',
    default_enabled: f.default_enabled,
    rollout_pct: f.rollout_pct,
    is_killed: f.is_killed,
  }
}

interface NewFlagForm {
  key: string
  description: string
  default_enabled: boolean
  rollout_pct: number
}

const EMPTY_NEW: NewFlagForm = {
  key: '',
  description: '',
  default_enabled: false,
  rollout_pct: 0,
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function PlatformFlags() {
  const currentUser = useAuthStore((s) => s.user)
  const isSuper = currentUser?.platform_role === 'SUPERADMIN'

  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [orgs, setOrgs] = useState<PlatformOrg[]>([])
  const [loading, setLoading] = useState(true)

  // Create drawer
  const [createOpen, setCreateOpen] = useState(false)
  const [newForm, setNewForm] = useState<NewFlagForm>(EMPTY_NEW)
  const [creating, setCreating] = useState(false)

  // Edit drawer
  const [editing, setEditing] = useState<FeatureFlag | null>(null)
  const [draft, setDraft] = useState<FlagDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [overrides, setOverrides] = useState<OrgFeatureOverride[]>([])
  const [overridesLoading, setOverridesLoading] = useState(false)

  // Add-override mini-form (inside drawer)
  const [addOrgId, setAddOrgId] = useState<number | ''>('')
  const [addEnabled, setAddEnabled] = useState<boolean>(true)
  const [addReason, setAddReason] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  // Preview controls
  const [previewOrgId, setPreviewOrgId] = useState<number | ''>('')
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<FlagResolvePreview | null>(null)

  // Delete confirm
  const [toDelete, setToDelete] = useState<FeatureFlag | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [fls, os] = await Promise.all([
        flagsApi.list(),
        platformApi.getOrgs().catch(() => [] as PlatformOrg[]),
      ])
      setFlags(Array.isArray(fls) ? fls : [])
      setOrgs(Array.isArray(os) ? os : [])
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'No se pudieron cargar los flags')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const counts = useMemo(() => {
    let withOverrides = 0
    let killed = 0
    let active = 0
    for (const f of flags) {
      if (f.overrides_count > 0) withOverrides += 1
      if (f.is_killed) killed += 1
      else active += 1
    }
    return { active, withOverrides, killed }
  }, [flags])

  const openEdit = async (f: FeatureFlag) => {
    setEditing(f)
    setDraft(draftFromFlag(f))
    setPreview(null)
    setPreviewOrgId('')
    setAddOrgId('')
    setAddEnabled(true)
    setAddReason('')
    setOverridesLoading(true)
    try {
      const rows = await flagsApi.listOverrides(f.key)
      setOverrides(rows)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'No se pudieron cargar overrides')
      setOverrides([])
    } finally {
      setOverridesLoading(false)
    }
  }

  const closeEdit = () => {
    if (saving || addSaving || previewing) return
    setEditing(null)
    setDraft(null)
    setOverrides([])
    setPreview(null)
  }

  const [killConfirmOpen, setKillConfirmOpen] = useState(false)

  const saveFlag = async () => {
    if (!editing || !draft) return
    // Encender el kill-switch apaga el flag para TODAS las orgs ignorando
    // overrides: exige confirmación explícita antes de guardar.
    if (draft.is_killed && !editing.is_killed) {
      setKillConfirmOpen(true)
      return
    }
    await doSaveFlag()
  }

  const doSaveFlag = async () => {
    if (!editing || !draft) return
    setSaving(true)
    try {
      const updated = await flagsApi.update(editing.key, {
        description: draft.description.trim() || null,
        default_enabled: draft.default_enabled,
        rollout_pct: draft.rollout_pct,
        is_killed: draft.is_killed,
      })
      setFlags((prev) => prev.map((f) =>
        f.key === editing.key
          ? { ...f, ...updated }
          : f,
      ))
      setEditing((prev) => prev ? { ...prev, ...updated } : prev)
      toast.success('Flag actualizado')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const createFlag = async () => {
    const key = newForm.key.trim().toLowerCase()
    if (!key) { toast.error('Key requerido'); return }
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      toast.error('Key debe ser snake_case (a-z, 0-9, _)')
      return
    }
    setCreating(true)
    try {
      const created = await flagsApi.create({
        key,
        description: newForm.description.trim() || null,
        default_enabled: newForm.default_enabled,
        rollout_pct: newForm.rollout_pct,
      })
      setFlags((prev) => {
        const next = [...prev, created]
        next.sort((a, b) => a.key.localeCompare(b.key))
        return next
      })
      toast.success('Flag creado')
      setCreateOpen(false)
      setNewForm(EMPTY_NEW)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'No se pudo crear')
    } finally {
      setCreating(false)
    }
  }

  const addOverride = async () => {
    if (!editing) return
    const oid = typeof addOrgId === 'number' ? addOrgId : Number(addOrgId)
    if (!oid || !Number.isFinite(oid)) { toast.error('Elegí una org'); return }
    setAddSaving(true)
    try {
      const row = await flagsApi.upsertOverride(editing.key, oid, {
        enabled: addEnabled,
        reason: addReason.trim() || null,
      })
      setOverrides((prev) => {
        const without = prev.filter((o) => o.organization_id !== row.organization_id)
        return [...without, row].sort((a, b) =>
          (a.organization_name || '').localeCompare(b.organization_name || ''),
        )
      })
      // Refresh counts on the flag row.
      setFlags((prev) => prev.map((f) =>
        f.key === editing.key
          ? { ...f, overrides_count: prev.some((p) => p.key === f.key)
              ? f.overrides_count + (overrides.some((o) => o.organization_id === oid) ? 0 : 1)
              : f.overrides_count }
          : f,
      ))
      setAddOrgId('')
      setAddReason('')
      setAddEnabled(true)
      toast.success('Override aplicado')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'No se pudo aplicar override')
    } finally {
      setAddSaving(false)
    }
  }

  const removeOverride = async (ov: OrgFeatureOverride) => {
    if (!editing) return
    try {
      await flagsApi.removeOverride(editing.key, ov.organization_id)
      setOverrides((prev) => prev.filter((o) => o.organization_id !== ov.organization_id))
      setFlags((prev) => prev.map((f) =>
        f.key === editing.key
          ? { ...f, overrides_count: Math.max(0, f.overrides_count - 1) }
          : f,
      ))
      toast.success('Override removido')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'No se pudo remover override')
    }
  }

  const runPreview = async () => {
    if (!editing) return
    const oid = typeof previewOrgId === 'number' ? previewOrgId : Number(previewOrgId)
    if (!oid || !Number.isFinite(oid)) { toast.error('Elegí una org'); return }
    setPreviewing(true)
    try {
      const res = await flagsApi.preview(editing.key, oid)
      setPreview(res)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'No se pudo resolver')
      setPreview(null)
    } finally {
      setPreviewing(false)
    }
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await flagsApi.remove(toDelete.key)
      setFlags((prev) => prev.filter((f) => f.key !== toDelete.key))
      toast.success('Flag eliminado')
      setToDelete(null)
      if (editing?.key === toDelete.key) closeEdit()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'No se pudo eliminar')
    } finally {
      setDeleting(false)
    }
  }

  const columns: DataTableColumn<FeatureFlag>[] = useMemo(() => [
    {
      key: 'key',
      label: 'Key',
      accessor: (r) => <KeyChip flagKey={r.key} />,
      sortValue: (r) => r.key,
      sortable: true,
      width: '22%',
    },
    {
      key: 'description',
      label: 'Descripción',
      accessor: (r) => (
        <span style={{ color: r.description ? 'var(--p-text)' : 'var(--p-hint)', fontSize: 12 }}>
          {r.description || <em style={{ color: 'var(--p-hint)' }}>—</em>}
        </span>
      ),
      width: '28%',
    },
    {
      key: 'default_enabled',
      label: 'Default',
      accessor: (r) => (
        <span style={{ ...monoStyle, color: r.default_enabled ? 'var(--p-success)' : 'var(--p-muted)' }}>
          {r.default_enabled ? 'on' : 'off'}
        </span>
      ),
      sortValue: (r) => (r.default_enabled ? 1 : 0),
      sortable: true,
      width: '8%',
    },
    {
      key: 'rollout_pct',
      label: 'Rollout',
      accessor: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RolloutBar pct={r.rollout_pct} />
          <span style={{ ...monoStyle, width: 40, textAlign: 'right' }}>{r.rollout_pct}%</span>
        </div>
      ),
      sortValue: (r) => r.rollout_pct,
      sortable: true,
      width: '18%',
    },
    {
      key: 'overrides_count',
      label: 'Overrides',
      accessor: (r) => (
        <span style={{ ...monoStyle, color: r.overrides_count > 0 ? 'var(--p-accent)' : 'var(--p-muted)' }}>
          {r.overrides_count}
        </span>
      ),
      sortValue: (r) => r.overrides_count,
      sortable: true,
      width: '8%',
    },
    {
      key: 'enabled_orgs_count',
      label: 'Orgs on',
      accessor: (r) => (
        <span style={{ ...monoStyle, color: 'var(--p-text)' }}>
          {r.enabled_orgs_count ?? '—'}
        </span>
      ),
      sortValue: (r) => r.enabled_orgs_count ?? -1,
      sortable: true,
      width: '8%',
    },
    {
      key: 'status',
      label: 'Estado',
      accessor: (r) => <StatusPill killed={r.is_killed} />,
      sortValue: (r) => (r.is_killed ? 1 : 0),
      sortable: true,
      width: '8%',
    },
  ], [])

  return (
    <>
      <main className="pv2-main">
        <div className="crumb">
          <span>Platform</span>
          <span className="sep">/</span>
          <span className="now">Feature flags</span>
        </div>
        <div className="page-head">
          <div>
            <h1>Feature flags</h1>
            <div className="sub">Capacidades globales + overrides por org · rollout determinístico</div>
          </div>
          <div className="right">
            <button className="btn primary" type="button" onClick={() => { setNewForm(EMPTY_NEW); setCreateOpen(true) }}>
              <i className="fa-solid fa-plus" />
              Nuevo flag
            </button>
          </div>
        </div>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <KPICardV2 label="Flags activos"  value={counts.active}         icon="fa-toggle-on" />
          <KPICardV2 label="Con overrides"  value={counts.withOverrides}  icon="fa-sliders" />
          <KPICardV2 label="Killed"         value={counts.killed}         icon="fa-ban" />
        </section>

        {loading ? (
          <div style={{ color: 'var(--p-muted)', fontSize: 13 }}>
            <i className="fa-solid fa-circle-notch fa-spin" /> Cargando…
          </div>
        ) : (
          <DataTable<FeatureFlag>
            data={flags}
            columns={columns}
            rowKey={(r) => r.key}
            onRowClick={(r) => openEdit(r)}
            searchable
            searchKeys={(r) => `${r.key} ${r.description ?? ''}`}
            emptyMessage="Sin feature flags — crea uno para empezar."
            pageSize={25}
          />
        )}
      </main>

      {/* ── Create drawer ──────────────────────────────────────────────── */}
      <SideDrawer
        open={createOpen}
        title="Nuevo feature flag"
        subtitle="Se registra en el catálogo global · orgs lo reciben según rollout / default"
        onClose={() => !creating && setCreateOpen(false)}
        width={520}
      >
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Key</label>
          <input
            style={inputStyle}
            value={newForm.key}
            onChange={(e) => setNewForm((p) => ({ ...p, key: e.target.value }))}
            placeholder="ej. new_pos_scanner"
            autoFocus
          />
          <div style={{ fontSize: 11, color: 'var(--p-hint)', marginTop: 4 }}>
            snake_case: a-z, 0-9, _, empieza con letra.
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Descripción</label>
          <textarea
            style={{ ...inputStyle, minHeight: 72, resize: 'vertical', fontFamily: 'var(--font-sans)' }}
            value={newForm.description}
            onChange={(e) => setNewForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Qué hace este flag y por qué lo necesitamos"
          />
        </div>
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={labelStyle}>Default</span>
          <Toggle
            checked={newForm.default_enabled}
            onChange={(v) => setNewForm((p) => ({ ...p, default_enabled: v }))}
            tone="success"
            labelOn="Encendido"
            labelOff="Apagado"
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Rollout % · {newForm.rollout_pct}</label>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={newForm.rollout_pct}
            onChange={(e) => setNewForm((p) => ({ ...p, rollout_pct: Number(e.target.value) }))}
            style={{ width: '100%', accentColor: 'var(--p-accent)' }}
          />
          <RolloutBar pct={newForm.rollout_pct} />
        </div>

        <div
          style={{
            marginTop: 16,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            paddingTop: 14,
            borderTop: '1px solid var(--p-border)',
          }}
        >
          <button
            onClick={() => setCreateOpen(false)}
            disabled={creating}
            style={{
              background: 'var(--p-surface-2)',
              color: 'var(--p-text)',
              border: '1px solid var(--p-border)',
              padding: '8px 16px',
              borderRadius: 8,
              cursor: creating ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 500,
              opacity: creating ? 0.6 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={createFlag}
            disabled={creating}
            style={{
              background: 'var(--p-accent)',
              color: '#fff',
              border: '1px solid var(--p-accent)',
              padding: '8px 18px',
              borderRadius: 8,
              cursor: creating ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              opacity: creating ? 0.6 : 1,
            }}
          >
            {creating && <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 11 }} />}
            <i className="fa-solid fa-plus" style={{ fontSize: 11 }} />
            Crear
          </button>
        </div>
      </SideDrawer>

      {/* ── Edit drawer ────────────────────────────────────────────────── */}
      <SideDrawer
        open={!!editing && !!draft}
        title={editing ? editing.key : ''}
        subtitle={editing?.description || 'Feature flag'}
        onClose={closeEdit}
        width={720}
      >
        {editing && draft && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Flag fields ────────────────────────────────────────── */}
            <div>
              <label style={labelStyle}>Descripción</label>
              <textarea
                style={{ ...inputStyle, minHeight: 72, resize: 'vertical', fontFamily: 'var(--font-sans)' }}
                value={draft.description}
                onChange={(e) => setDraft((d) => d ? { ...d, description: e.target.value } : d)}
                placeholder="Qué hace este flag"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={labelStyle}>Default</span>
              <Toggle
                checked={draft.default_enabled}
                onChange={(v) => setDraft((d) => d ? { ...d, default_enabled: v } : d)}
                tone="success"
                labelOn="Encendido"
                labelOff="Apagado"
              />
              <span style={{ fontSize: 11, color: 'var(--p-hint)' }}>
                Se aplica a orgs fuera del bucket de rollout.
              </span>
            </div>

            <div>
              <label style={labelStyle}>Rollout % · {draft.rollout_pct}</label>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={draft.rollout_pct}
                onChange={(e) => setDraft((d) => d ? { ...d, rollout_pct: Number(e.target.value) } : d)}
                style={{ width: '100%', accentColor: 'var(--p-accent)' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <RolloutBar pct={draft.rollout_pct} />
                <span style={{ fontSize: 11, color: 'var(--p-hint)' }}>
                  Orgs se asignan al bucket por hash(org_id + key), determinístico.
                </span>
              </div>
            </div>

            {/* Kill switch (red) ──────────────────────────────────── */}
            <div
              style={{
                border: '1px solid ' + (draft.is_killed ? 'var(--p-danger)' : 'var(--p-border)'),
                borderRadius: 10,
                padding: '12px 14px',
                background: draft.is_killed
                  ? 'color-mix(in oklab, var(--p-danger) 10%, transparent)'
                  : 'var(--p-surface-2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--p-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="fa-solid fa-ban" style={{ color: 'var(--p-danger)', fontSize: 12 }} />
                    Kill-switch
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--p-muted)', marginTop: 2 }}>
                    Fuerza el flag en off globalmente · ignora overrides de org
                  </div>
                </div>
                <Toggle
                  checked={draft.is_killed}
                  onChange={(v) => setDraft((d) => d ? { ...d, is_killed: v } : d)}
                  tone="danger"
                  labelOn="Killed"
                  labelOff="Activo"
                />
              </div>
            </div>

            {/* Preview ────────────────────────────────────────────── */}
            <div style={{ borderTop: '1px solid var(--p-border)', paddingTop: 14 }}>
              <label style={labelStyle}>Preview · resolver para una org</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <select
                  style={{ ...inputStyle, width: 280 }}
                  value={previewOrgId}
                  onChange={(e) => setPreviewOrgId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Elegí una org…</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name} · #{o.id}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={previewing || !previewOrgId}
                  onClick={runPreview}
                  style={{
                    background: 'var(--p-surface-2)',
                    border: '1px solid var(--p-border)',
                    color: 'var(--p-text)',
                    padding: '8px 14px',
                    borderRadius: 6,
                    cursor: previewing ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    opacity: previewing || !previewOrgId ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {previewing
                    ? <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 11 }} />
                    : <i className="fa-solid fa-flask" style={{ fontSize: 11 }} />}
                  Resolver
                </button>
                {preview && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: preview.resolved
                        ? 'color-mix(in oklab, var(--p-success) 14%, transparent)'
                        : 'var(--p-surface-2)',
                      color: preview.resolved ? 'var(--p-success)' : 'var(--p-muted)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      fontWeight: 600,
                      border: '1px solid ' + (preview.resolved ? 'var(--p-success)44' : 'var(--p-border)'),
                    }}
                  >
                    {preview.resolved ? 'ON' : 'OFF'}
                  </span>
                )}
                {preview && <SourceBadge source={preview.source} />}
              </div>
              {preview && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: 'var(--p-muted)',
                    padding: '8px 10px',
                    background: 'var(--p-surface-2)',
                    border: '1px solid var(--p-border)',
                    borderRadius: 6,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {preview.reason}
                </div>
              )}
            </div>

            {/* Overrides ──────────────────────────────────────────── */}
            <div style={{ borderTop: '1px solid var(--p-border)', paddingTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ ...labelStyle, marginBottom: 0 }}>
                  Overrides ({overrides.length})
                </span>
              </div>
              {overridesLoading ? (
                <div style={{ color: 'var(--p-muted)', fontSize: 12 }}>
                  <i className="fa-solid fa-circle-notch fa-spin" /> Cargando…
                </div>
              ) : overrides.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--p-hint)', fontStyle: 'italic' }}>
                  Sin overrides · todas las orgs resuelven por rollout / default.
                </div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {overrides.map((ov) => (
                    <li
                      key={ov.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        border: '1px solid var(--p-border)',
                        borderRadius: 6,
                        background: 'var(--p-surface-2)',
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--p-text)' }}>
                        <span style={{ fontWeight: 600 }}>
                          {ov.organization_name || `#${ov.organization_id}`}
                        </span>
                        {ov.reason && (
                          <span style={{ color: 'var(--p-muted)', marginLeft: 8, fontSize: 11 }}>
                            · {ov.reason}
                          </span>
                        )}
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          border: '1px solid ' + (ov.enabled ? 'var(--p-success)44' : 'var(--p-muted)44'),
                          background: ov.enabled
                            ? 'color-mix(in oklab, var(--p-success) 14%, transparent)'
                            : 'var(--p-surface)',
                          color: ov.enabled ? 'var(--p-success)' : 'var(--p-muted)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {ov.enabled ? 'on' : 'off'}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeOverride(ov)}
                        aria-label={`Remover override ${ov.organization_name || ov.organization_id}`}
                        title="Remover override"
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--p-border)',
                          color: 'var(--p-muted)',
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <i className="fa-solid fa-xmark" style={{ fontSize: 11 }} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Add override inline form */}
              <div
                style={{
                  marginTop: 10,
                  padding: '10px 12px',
                  border: '1px dashed var(--p-border)',
                  borderRadius: 8,
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <select
                  style={inputStyle}
                  value={addOrgId}
                  onChange={(e) => setAddOrgId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Agregar override · elegí una org…</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name} · #{o.id}</option>
                  ))}
                </select>
                <Toggle
                  checked={addEnabled}
                  onChange={setAddEnabled}
                  tone={addEnabled ? 'success' : 'accent'}
                  labelOn="On"
                  labelOff="Off"
                />
                <button
                  type="button"
                  onClick={addOverride}
                  disabled={addSaving || !addOrgId}
                  style={{
                    background: 'var(--p-accent)',
                    border: '1px solid var(--p-accent)',
                    color: '#fff',
                    padding: '8px 14px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: addSaving || !addOrgId ? 'not-allowed' : 'pointer',
                    opacity: addSaving || !addOrgId ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {addSaving && <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 11 }} />}
                  Aplicar
                </button>
                <input
                  style={{ ...inputStyle, gridColumn: '1 / -1' }}
                  value={addReason}
                  onChange={(e) => setAddReason(e.target.value)}
                  placeholder="Motivo (opcional) · auditable"
                />
              </div>
            </div>

            {/* Footer actions ─────────────────────────────────────── */}
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                gap: 10,
                paddingTop: 14,
                borderTop: '1px solid var(--p-border)',
                alignItems: 'center',
              }}
            >
              {isSuper && (
                <button
                  type="button"
                  onClick={() => editing && setToDelete(editing)}
                  style={{
                    background: 'transparent',
                    color: 'var(--p-danger)',
                    border: '1px solid var(--p-danger)',
                    padding: '8px 14px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <i className="fa-solid fa-trash" style={{ fontSize: 11 }} />
                  Eliminar flag
                </button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                <button
                  onClick={closeEdit}
                  disabled={saving}
                  style={{
                    background: 'var(--p-surface-2)',
                    color: 'var(--p-text)',
                    border: '1px solid var(--p-border)',
                    padding: '8px 16px',
                    borderRadius: 8,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={saveFlag}
                  disabled={saving}
                  style={{
                    background: 'var(--p-accent)',
                    color: '#fff',
                    border: '1px solid var(--p-accent)',
                    padding: '8px 20px',
                    borderRadius: 8,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving && <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 11 }} />}
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </SideDrawer>

      <ConfirmModal
        open={!!toDelete}
        title="Eliminar feature flag"
        message={
          'Vas a eliminar el flag ' +
          (toDelete?.key ?? '') +
          ' y todos sus overrides por org. ' +
          'Esta acción no se puede deshacer y los consumidores resolverán por default.'
        }
        resourceName={toDelete?.key ?? ''}
        destructive
        onClose={() => !deleting && setToDelete(null)}
        onConfirm={confirmDelete}
        busy={deleting}
      />

      <ConfirmModal
        open={killConfirmOpen}
        title="Activar kill-switch global"
        message={
          'Vas a forzar ' + (editing?.key ?? '') +
          ' en OFF para TODAS las organizaciones, ignorando sus overrides. ' +
          'Los clientes que dependan de esta capacidad la perderán al instante.'
        }
        resourceName={editing?.key ?? ''}
        destructive
        onClose={() => !saving && setKillConfirmOpen(false)}
        onConfirm={async () => { setKillConfirmOpen(false); await doSaveFlag() }}
        busy={saving}
      />
    </>
  )
}

export default PlatformFlags
