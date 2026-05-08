# Branching Strategy

> Effective: 2026-04-20
> Default branch: `release/beta`

## Ramas activas

```
┌─────────────────────────────────────────────────────────────┐
│  release/beta          [DEFAULT]                            │
│  · Dev activo, target de todos los PRs nuevos               │
│  · Deploya a Railway beta service (DB beta separada)        │
│                                                             │
│          │ promoción manual tras QA en beta                 │
│          ▼                                                  │
│                                                             │
│  release/qa                                                 │
│  · Rama de staging/QA                                       │
│  · Deploya a Railway qa service (DB qa separada)            │
│  · Sync desde release/beta por PR explícito                 │
│                                                             │
│          │ promoción manual tras QA aprobada                │
│          ▼                                                  │
│                                                             │
│  release/production                                         │
│  · Producción — clientes reales                             │
│  · Deploya a Railway prod service (DB prod)                 │
│  · NUNCA se tocan commits directos; sólo merges desde qa    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Ramas congeladas / a deprecar

| Rama | Estado | Acción futura |
|------|--------|---------------|
| `main` | Congelada (snapshot histórico, 169 commits detrás de release/beta) | Archivar o deprecar |
| `refactor/frontend-v2` | Congelada (ex-default; mismo SHA que release/beta al momento del swap) | Renombrar a `archive/refactor-frontend-v2` o borrar tras confirmación |
| `Beta-Stabilization-DM` | Obsoleta (según usuario) | Borrar |
| `docs/admin-catalog-audit`, `security/tenant-isolation` | Mergeadas | Borrar (local + remoto) |
| `fix/cajero-visibility-c1..c7`, `feat/sprint-1-quick-wins` | Mergeadas | Borrar |

## Reglas

1. **Todos los PRs nuevos apuntan a `release/beta`.**
2. **Ninguna rama de feature directa a `release/qa` o `release/production`.** Promoción es un PR `release/beta → release/qa → release/production`.
3. **`release/production` es intocable** — sólo merges de `release/qa` post-QA firmado.
4. **DBs son independientes** por entorno. No hay sync automático. Dumps manuales sólo para debugging.
5. **Force-push prohibido** en `release/*`.

## Convenciones de naming de ramas

- `feat/<scope>-<descripcion>` — nueva funcionalidad (ej. `feat/cajero-write-mvp`)
- `fix/<scope>-<descripcion>` — bug fix (ej. `fix/cajero-visibility-c1`)
- `chore/<descripcion>` — mantenimiento (docs, deps, config)
- `security/<scope>` — hardening (ej. `security/tenant-isolation`)
- `docs/<scope>` — sólo documentación
- `archive/<nombre-original>` — snapshot congelado

## Despliegue

| Rama | Railway service | DB | Variables críticas |
|------|-----------------|-----|---------------------|
| `release/beta` | beta | beta-db | `SECRET_KEY`, `CORS_ALLOWED_ORIGINS`, `COOKIE_SECURE=true`, `DATABASE_URL` |
| `release/qa` | qa | qa-db | ídem con valores propios de qa |
| `release/production` | prod | prod-db | ídem con valores propios de prod |

Cada entorno debe tener su propio `SECRET_KEY` (tokens JWT no deben ser válidos cross-env).

## Pendientes de esta transición

- [ ] Railway beta service: configurar deploy branch = `release/beta` + env vars (ver Phase 2 §5 del plan)
- [ ] Sincronizar `release/qa` con `release/beta` (estrategia TBD por usuario)
- [ ] Archivar o borrar `refactor/frontend-v2`
- [ ] Borrar `Beta-Stabilization-DM` remoto
- [ ] Limpieza de ramas mergeadas locales (`docs/admin-catalog-audit`, `security/tenant-isolation`, `fix/cajero-visibility-*`)
