# Aviso a inquilinos (franja superior) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Novedades Kaory vea, en la versión que usa hoy, una franja superior con dos avisos —actualización necesaria y adeudo de licencia— que el superadministrador puede publicar, editar y retirar desde el panel sin volver a desplegar.

**Architecture:** El backend ya tiene el modelo `PlatformAnnouncement`, el CRUD del panel y el endpoint `GET /api/platform/announcements/active` con segmentación por `org_ids`. Falta el consumidor, que el propio código marca como diferido. Este plan asegura ese endpoint (hoy es anónimo y acepta cualquier `org_id`), agrega el cliente y un componente `AnnouncementBanner` montado junto al `ImpersonationBanner` existente, se despliega **una sola vez** a la producción de Railway y a partir de ahí el contenido es dato, no código.

**Tech Stack:** FastAPI · SQLAlchemy · pytest · React 18 + TypeScript · Vite · Zustand · axios

**Spec:** `docs/superpowers/specs/2026-09-01-atlas-one-migracion-ionos-design.md`

## Global Constraints

- **Rama base: `origin/main`** (`8be98ab`), que es lo que corre Kaory en Railway. **No** partir de `staging`: desplegar staging a producción le metería a Kaory seis commits de cambios de interfaz antes de tiempo.
- El trabajo va en la rama `feat/aviso-inquilinos`, sacada de `origin/main`.
- **Prohibido bloquear la operación.** La franja informa; nunca impide cobrar, ni cubre controles, ni intercepta rutas.
- La franja debe poder descartarse y reaparecer al día siguiente.
- Copy en español de México, sin signos de exclamación y sin lenguaje amenazante.
- **No inventar datos de la licencia.** Monto, fecha y referencia los proporciona el usuario al publicar; el código no los incrusta.
- El frontend **no tiene infraestructura de pruebas** (sin vitest, sin `test` en `package.json`). Montarla queda fuera de alcance: las pruebas automatizadas de este plan son de backend, y el frontend se verifica con `npm run build` y revisión manual. No agregar dependencias de prueba al `package.json`.
- `LOG_LEVEL` va en mayúsculas en cualquier `.env` que se toque.

---

### Task 1: Asegurar el endpoint de avisos activos

Hoy `GET /api/platform/announcements/active` no tiene ninguna dependencia de autenticación y recibe `org_id` como parámetro de consulta libre: cualquier persona en internet puede leer los avisos dirigidos a cualquier organización. Antes de que el frontend lo consuma, la organización tiene que salir del usuario autenticado.

**Files:**
- Modify: `app/routers/platform/announcements.py` (función `active_announcements`, alrededor de la línea 190)
- Test: `tests/test_announcements_active.py` (crear)

**Interfaces:**
- Consumes: `get_current_user` desde `app.core.security`; `User.organization_id`.
- Produces: `GET /api/platform/announcements/active` autenticado, sin parámetros, que responde la lista de avisos publicados y vigentes que apuntan a la organización del usuario. Cada elemento conserva la forma de `_serialize_announcement`: `{id, title, body_md, severity, targets, published_at, expires_at, created_by, created_at, updated_at, status}`.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/test_announcements_active.py`:

```python
"""Tests: consumo de avisos activos por parte del inquilino."""
from datetime import datetime, timedelta, timezone

import pytest

from app.models.platform import PlatformAnnouncement


def _publish(db, org_ids=None, title="Aviso", severity="info", expires_in_days=7):
    import json
    ann = PlatformAnnouncement(
        title=title,
        body_md="Cuerpo del aviso.",
        severity=severity,
        targets_json=json.dumps({"org_ids": org_ids}) if org_ids else None,
        published_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        expires_at=datetime.now(timezone.utc) + timedelta(days=expires_in_days),
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return ann


class TestAnnouncementsActive:
    def test_requiere_autenticacion(self, client, db, org):
        _publish(db, org_ids=[org.id])
        resp = client.get("/api/platform/announcements/active")
        assert resp.status_code == 401, (
            f"El endpoint debe exigir sesion, respondio {resp.status_code}"
        )

    def test_devuelve_los_avisos_de_mi_organizacion(self, client, db, org, auth_cajero_a):
        _publish(db, org_ids=[org.id], title="Actualizacion necesaria")
        resp = client.get("/api/platform/announcements/active", headers=auth_cajero_a)
        assert resp.status_code == 200, resp.text
        titulos = [a["title"] for a in resp.json()]
        assert "Actualizacion necesaria" in titulos

    def test_no_filtra_avisos_de_otra_organizacion(self, client, db, org, auth_cajero_a):
        _publish(db, org_ids=[org.id + 999], title="Aviso ajeno")
        resp = client.get("/api/platform/announcements/active", headers=auth_cajero_a)
        assert resp.status_code == 200, resp.text
        titulos = [a["title"] for a in resp.json()]
        assert "Aviso ajeno" not in titulos

    def test_ignora_org_id_del_parametro(self, client, db, org, auth_cajero_a):
        """El org_id ya no se acepta: la organizacion sale del token."""
        _publish(db, org_ids=[org.id + 999], title="Aviso ajeno")
        resp = client.get(
            "/api/platform/announcements/active?org_id=%d" % (org.id + 999),
            headers=auth_cajero_a,
        )
        assert resp.status_code == 200, resp.text
        titulos = [a["title"] for a in resp.json()]
        assert "Aviso ajeno" not in titulos

    def test_incluye_los_universales(self, client, db, org, auth_cajero_a):
        _publish(db, org_ids=None, title="Aviso universal")
        resp = client.get("/api/platform/announcements/active", headers=auth_cajero_a)
        titulos = [a["title"] for a in resp.json()]
        assert "Aviso universal" in titulos

    def test_excluye_borradores_y_vencidos(self, client, db, org, auth_cajero_a):
        import json
        borrador = PlatformAnnouncement(
            title="Borrador", body_md="x", severity="info",
            targets_json=json.dumps({"org_ids": [org.id]}), published_at=None,
        )
        vencido = PlatformAnnouncement(
            title="Vencido", body_md="x", severity="info",
            targets_json=json.dumps({"org_ids": [org.id]}),
            published_at=datetime.now(timezone.utc) - timedelta(days=10),
            expires_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
        db.add_all([borrador, vencido])
        db.commit()
        resp = client.get("/api/platform/announcements/active", headers=auth_cajero_a)
        titulos = [a["title"] for a in resp.json()]
        assert "Borrador" not in titulos
        assert "Vencido" not in titulos
```

- [ ] **Step 2: Correrla y confirmar que falla**

```bash
python -m pytest tests/test_announcements_active.py -v
```

Esperado: FALLA. `test_requiere_autenticacion` devuelve 200 en lugar de 401, porque hoy el endpoint es anónimo.

- [ ] **Step 3: Implementar el cambio mínimo**

En `app/routers/platform/announcements.py`, agregar al bloque de importaciones de la cabecera:

```python
from app.core.security import get_current_user
```

y reemplazar la firma y el arranque de `active_announcements` por:

```python
@router.get("/announcements/active")
def active_announcements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Avisos publicados y vigentes que aplican a la organizacion del usuario.

    La organizacion sale del token, nunca de un parametro: antes este
    endpoint era anonimo y aceptaba cualquier `org_id`, lo que dejaba leer
    los avisos de cualquier negocio.
    """
    from app.models.platform import PlatformAnnouncement
    now = datetime.now(timezone.utc)
    q = db.query(PlatformAnnouncement).filter(
        PlatformAnnouncement.published_at.isnot(None),
        PlatformAnnouncement.published_at <= now,
    ).filter(
        (PlatformAnnouncement.expires_at.is_(None))
        | (PlatformAnnouncement.expires_at > now)
    ).order_by(PlatformAnnouncement.published_at.desc())

    rows = q.all()
    org = db.query(Organization).filter(
        Organization.id == current_user.organization_id
    ).first()
```

El resto de la función —la closure `_matches` y el `return`— se queda tal cual: ya recibe `org` de esta variable.

- [ ] **Step 4: Correr las pruebas y confirmar que pasan**

```bash
python -m pytest tests/test_announcements_active.py -v
```

Esperado: 6 pruebas en PASS.

- [ ] **Step 5: Confirmar que no se rompió nada del panel**

```bash
python -m pytest tests/test_platform_security.py tests/test_consolidated_routers.py -v
```

Esperado: PASS. Si `test_consolidated_routers.py` verifica la firma del endpoint, actualizar ahí la expectativa; el cambio de contrato es intencional.

- [ ] **Step 6: Commit**

```bash
git add app/routers/platform/announcements.py tests/test_announcements_active.py
git commit -m "fix(platform): /announcements/active exige sesion y deriva la org del token

Era anonimo y aceptaba cualquier org_id por query, de modo que cualquiera
podia leer los avisos dirigidos a cualquier negocio."
```

---

### Task 2: Cliente de API en el frontend

**Files:**
- Modify: `frontend/src/api/platform.ts` (bloque `announcementsApi`, tras el método `list`)

**Interfaces:**
- Consumes: `client` de axios y el tipo `PlatformAnnouncement` ya definidos en el mismo archivo.
- Produces: `announcementsApi.active(): Promise<PlatformAnnouncement[]>`, consumido por la Task 3.

- [ ] **Step 1: Agregar el método**

Dentro del objeto `announcementsApi`, junto a `list`:

```ts
  /** Avisos vigentes para la organizacion del usuario en sesion.
   *  La organizacion sale del token; no se envia org_id. */
  active: () =>
    client.get<PlatformAnnouncement[]>('/platform/announcements/active').then((r) =>
      Array.isArray(r.data) ? r.data : [],
    ),
```

- [ ] **Step 2: Verificar que compila**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/platform.ts
git commit -m "feat(platform): cliente de avisos activos para el inquilino"
```

---

### Task 3: Componente de franja y montaje en el shell

La franja se monta donde ya vive `ImpersonationBanner`, que es el patrón de la casa para avisos de ancho completo.

**Files:**
- Create: `frontend/src/components/layout/AnnouncementBanner.tsx`
- Modify: `frontend/src/components/layout/Layout.tsx:5` (importación) y `:89` (montaje)

**Interfaces:**
- Consumes: `announcementsApi.active()` de la Task 2; `PlatformAnnouncement` y `AnnouncementSeverity` de `../../api/platform`.
- Produces: `export function AnnouncementBanner(): JSX.Element | null`, sin props.

Comportamiento:
- Consulta al montarse y luego cada 15 minutos.
- Muestra un aviso a la vez, el más severo primero (`critical` > `warning` > `info` > `success`); si hay más de uno, una flecha alterna entre ellos.
- El botón de cerrar guarda `atlas_ann_dismissed` en `localStorage` con el `id` y la fecha; **el descarte dura hasta el fin del día**, así que reaparece al día siguiente.
- Si la consulta falla, no pinta nada ni muestra error: un aviso caído no debe estorbar la venta.

- [ ] **Step 1: Crear el componente**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { announcementsApi, type AnnouncementSeverity, type PlatformAnnouncement } from '../../api/platform'

const ORDEN: Record<AnnouncementSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  success: 3,
}

const COLOR: Record<AnnouncementSeverity, { fondo: string; borde: string; icono: string }> = {
  critical: { fondo: 'linear-gradient(90deg, rgba(190,18,60,0.95) 0%, rgba(225,29,72,0.95) 100%)', borde: 'rgba(251,113,133,0.5)', icono: 'fa-circle-exclamation' },
  warning:  { fondo: 'linear-gradient(90deg, rgba(180,83,9,0.95) 0%, rgba(217,119,6,0.95) 100%)',  borde: 'rgba(251,191,36,0.5)', icono: 'fa-triangle-exclamation' },
  info:     { fondo: 'linear-gradient(90deg, rgba(30,64,175,0.95) 0%, rgba(37,99,235,0.95) 100%)', borde: 'rgba(96,165,250,0.5)', icono: 'fa-circle-info' },
  success:  { fondo: 'linear-gradient(90deg, rgba(6,95,70,0.95) 0%, rgba(16,185,129,0.95) 100%)',  borde: 'rgba(52,211,153,0.5)', icono: 'fa-circle-check' },
}

const CLAVE = 'atlas_ann_dismissed'

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

function leerDescartados(): Record<string, string> {
  try {
    const crudo = localStorage.getItem(CLAVE)
    return crudo ? JSON.parse(crudo) : {}
  } catch {
    return {}
  }
}

function descartar(id: number) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ ...leerDescartados(), [String(id)]: hoy() }))
  } catch {
    /* modo privado o almacenamiento lleno: el aviso simplemente reaparece */
  }
}

export function AnnouncementBanner() {
  const [avisos, setAvisos] = useState<PlatformAnnouncement[]>([])
  const [indice, setIndice] = useState(0)
  const [version, setVersion] = useState(0)

  const cargar = useCallback(async () => {
    try {
      const datos = await announcementsApi.active()
      const descartados = leerDescartados()
      const visibles = datos
        .filter((a) => descartados[String(a.id)] !== hoy())
        .sort((a, b) => (ORDEN[a.severity] ?? 9) - (ORDEN[b.severity] ?? 9))
      setAvisos(visibles)
      setIndice(0)
    } catch {
      setAvisos([])
    }
  }, [version])

  useEffect(() => {
    cargar()
    const id = setInterval(cargar, 15 * 60 * 1000)
    return () => clearInterval(id)
  }, [cargar])

  if (avisos.length === 0) return null

  const aviso = avisos[Math.min(indice, avisos.length - 1)]
  const tono = COLOR[aviso.severity] ?? COLOR.info

  const cerrar = () => {
    descartar(aviso.id)
    setVersion((v) => v + 1)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: tono.fondo,
        borderBottom: `1px solid ${tono.borde}`,
        color: 'white',
        padding: '0.5rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        fontSize: '0.8125rem',
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}
    >
      <i className={`fa-solid ${tono.icono}`} aria-hidden="true" />
      <span style={{ fontWeight: 700 }}>{aviso.title}</span>
      <span style={{ opacity: 0.9 }}>{aviso.body_md}</span>
      {avisos.length > 1 && (
        <button
          type="button"
          onClick={() => setIndice((i) => (i + 1) % avisos.length)}
          aria-label="Ver el siguiente aviso"
          style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.85 }}
        >
          <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          <span style={{ marginLeft: '0.25rem' }}>{indice + 1}/{avisos.length}</span>
        </button>
      )}
      <button
        type="button"
        onClick={cerrar}
        aria-label="Cerrar el aviso por hoy"
        style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.85, marginLeft: '0.25rem' }}
      >
        <i className="fa-solid fa-xmark" aria-hidden="true" />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Montar en el shell**

En `frontend/src/components/layout/Layout.tsx`, junto a la importación de la línea 5:

```tsx
import { AnnouncementBanner } from './AnnouncementBanner'
```

y debajo de `<ImpersonationBanner />` en la línea 89:

```tsx
        <AnnouncementBanner />
```

- [ ] **Step 3: Verificar que compila y construye**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

Esperado: sin errores de tipos y build exitoso.

- [ ] **Step 4: Verificación manual con datos reales**

Levantar la aplicación en local contra una base de desarrollo, publicar un aviso de prueba desde el panel de plataforma dirigido a la organización con la que inicias sesión, y comprobar en el navegador:

1. La franja aparece arriba, debajo de la barra de impersonación.
2. El botón de cerrar la oculta y **no** reaparece al recargar.
3. Borrando la clave `atlas_ann_dismissed` de `localStorage` y recargando, vuelve a aparecer.
4. Con dos avisos publicados, la flecha alterna y el contador dice `1/2` y `2/2`.
5. Se puede cobrar una venta con la franja visible, sin que tape ningún control.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/AnnouncementBanner.tsx frontend/src/components/layout/Layout.tsx
git commit -m "feat(ui): franja de avisos de plataforma para el inquilino

Consume /platform/announcements/active y se monta junto a la barra de
impersonacion. Se descarta por el resto del dia y nunca bloquea la venta."
```

---

### Task 4: Desplegar a la producción de Railway y publicar los avisos

Este es el único despliegue a producción del plan. Kaory está cobrando, así que se hace en horario cerrado.

**Files:**
- Ninguno de código. Se opera sobre la rama `main` y sobre Railway.

**Interfaces:**
- Consumes: la rama `feat/aviso-inquilinos` con las tareas 1 a 3 terminadas.
- Produces: producción de Railway sirviendo la franja; dos filas en `platform_announcement` dirigidas a `org_ids: [14]`.

- [ ] **Step 1: Confirmar el estado de la tienda**

La tienda de Novedades Kaory opera hasta las 19:00–20:00 hora de México. Ejecutar este paso con la tienda cerrada.

- [ ] **Step 2: Fusionar a `main` y desplegar**

```bash
git checkout main
git pull --ff-only origin main
git merge --no-ff feat/aviso-inquilinos -m "feat: franja de avisos de plataforma para el inquilino"
git push origin main
```

Railway despliega solo al detectar el push (el servicio no tiene `watchPatterns`).

- [ ] **Step 3: Confirmar que el despliegue terminó bien**

```bash
railway deployment list \
  --project bf878c92-b8d3-4b47-bba7-e7d314aecf68 \
  --environment production --service atlas-bos --json
```

Esperado: el despliegue más reciente en `status: "SUCCESS"`. **No dar por buena la publicación hasta ver ese estado**: que el push haya salido sólo confirma que la construcción arrancó. Si queda en `FAILED` o `CRASHED`, revisar los registros de construcción y no continuar.

- [ ] **Step 4: Verificar que la aplicación sigue viva**

Abrir `https://atlas-one.up.railway.app`, iniciar sesión y cobrar una venta de prueba con su ticket. Sin avisos publicados todavía, la franja no debe aparecer y nada debe verse distinto.

- [ ] **Step 5: Publicar el aviso de actualización**

Desde el panel de plataforma, con la cuenta de superadministrador, crear un aviso:

- **Título:** `Actualización necesaria`
- **Severidad:** `warning`
- **Segmentación:** `org_ids: [14]`
- **Vigencia:** hasta el día del corte
- **Cuerpo:** describir que el sistema se moverá a una dirección nueva y a quién contactar. Redáctalo con el usuario; no inventar fechas.

- [ ] **Step 6: Publicar el aviso de licencia**

Segundo aviso, independiente del anterior:

- **Título:** `Licencia pendiente de pago`
- **Severidad:** `critical`
- **Segmentación:** `org_ids: [14]`
- **Cuerpo:** monto, fecha límite y referencia de pago **que proporcione el usuario**. Si todavía no los tiene, dejar este aviso en borrador y publicarlo después: no requiere despliegue.

- [ ] **Step 7: Verificar en la terminal de la tienda**

Con acceso remoto a la PC de Kaory, confirmar que la franja aparece, que se puede cerrar y que la venta y la impresión siguen funcionando con ella visible.

- [ ] **Step 8: Registrar el despliegue**

Anotar fecha, hora y el identificador del despliegue en `docs/infra/deployment-map.md`, en la bitácora de despliegues a producción.

---

### Task 5: Propagar la función a `staging`

Sin este paso, el fast-forward de `staging` a `main` previsto después del corte **borraría la franja**: `staging` no la tiene.

**Files:**
- Ninguno de código. Operación de ramas.

**Interfaces:**
- Consumes: `main` con la Task 4 terminada.
- Produces: `origin/staging` conteniendo la franja, de modo que `origin/main` siga siendo ancestro de `origin/staging` y el fast-forward posterior siga siendo posible.

- [ ] **Step 1: Fusionar `main` dentro de `staging`**

```bash
git checkout staging
git pull --ff-only origin staging
git merge main -m "merge: franja de avisos de plataforma desde main"
```

- [ ] **Step 2: Resolver conflictos si los hay**

El único archivo que ambas ramas tocan con probabilidad es `Layout.tsx`, que en `staging` cambió por el sistema de diseño. Conservar **las dos** cosas: el shell de `staging` y el `<AnnouncementBanner />` justo debajo de `<ImpersonationBanner />`.

- [ ] **Step 3: Verificar que compila**

```bash
cd frontend && npx tsc --noEmit && npm run build
cd .. && python -m pytest tests/test_announcements_active.py -v
```

Esperado: build limpio y 6 pruebas en PASS.

- [ ] **Step 4: Confirmar que el fast-forward posterior sigue siendo posible**

```bash
git push origin staging
git fetch origin
git merge-base --is-ancestor origin/main origin/staging && echo "FF sigue siendo posible"
```

Esperado: imprime `FF sigue siendo posible`. Si no, `staging` divergió y hay que resolverlo antes del corte.

- [ ] **Step 5: Commit**

Ya commiteado por el merge. Verificar con `git log --oneline -3 staging`.

---

## Qué queda fuera y por qué

- **Ventana emergente modal.** El usuario eligió franja superior. El mecanismo de datos es el mismo, así que convertirlo en modal más adelante es sólo un componente nuevo, sin tocar backend.
- **Bloqueo del punto de venta por adeudo.** Descartado explícitamente: detenerle la venta a una tienda que opera a diario es un riesgo de negocio mayor que el adeudo.
- **Modelo de licencias y facturación.** No existe en el repositorio (`organization` tiene `plan`, pero no adeudos ni fechas). El aviso de licencia es texto publicado por el superadministrador, no un estado calculado. Construir cobranza de verdad es otro proyecto.
- **Infraestructura de pruebas del frontend.** No existe hoy; montarla es un trabajo propio y no debe colarse en un despliegue urgente a producción.
