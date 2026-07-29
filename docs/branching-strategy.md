# Branching Strategy

> Actualizado: 2026-07-28
> Rama por defecto: `main`

> **Nota histórica:** hasta esta revisión, este archivo describía el esquema
> `release/beta → release/qa → release/production`. Ese flujo pertenece al
> repositorio **Data X POS**, no a este. En `atlas-one` solo existen `main` y
> `staging`, y `main` no está congelada: **es producción en vivo.**

## Ramas activas

```
┌──────────────────────────────────────────────────────────────┐
│  main                                          [DEFAULT]     │
│  · PRODUCCIÓN EN VIVO — Novedades Kaory vende aquí a diario  │
│  · Railway despliega automáticamente en cada push            │
│  · atlas-one.up.railway.app                                  │
│                                                              │
│  staging                                                     │
│  · Desarrollo activo — 95 commits adelante de main           │
│  · Se despliega en el VPS IONOS: app.atlasone.com.mx         │
│  · Incluye Gastro Suite y ledger de barra, que main revirtió │
└──────────────────────────────────────────────────────────────┘
```

## Reglas

1. **`main` es producción.** Un push la reconstruye y reemplaza el punto de venta
   que Kaory usa para cobrar. No es una rama de integración.
2. **Los PRs nuevos apuntan a `staging`.**
3. **El `Dockerfile` de la raíz no debe llegar a `main`.** Railway lo prioriza por
   encima de Railpack; existe para el despliegue del VPS y vive en `staging`.
4. **Cambios a `main` fuera del horario de la tienda** (opera hasta cerca de las
   20:00 hora de México).
5. **Force-push prohibido** en `main` y `staging`.
6. **Las bases son independientes** por destino. Sin sincronización automática.

## Convenciones de nombres

- `feat/<scope>-<descripcion>` — nueva funcionalidad
- `fix/<scope>-<descripcion>` — corrección
- `chore/<descripcion>` — mantenimiento (docs, dependencias, configuración)
- `security/<scope>` — endurecimiento
- `docs/<scope>` — solo documentación

## Despliegue

| Rama | Destino | Base | Builder |
|---|---|---|---|
| `main` | Railway `atlas-bos` producción | Postgres de Railway | RAILPACK |
| `staging` | VPS `atlas-prod-01` | `atlas_one_beta` (demo) | Dockerfile |

El entorno `staging` de Railway se eliminó el 2026-07-28; su contenido corre
ahora en el VPS. Detalle en [`infra/deployment-map.md`](./infra/deployment-map.md).

## Deuda abierta

- [ ] **`SECRET_KEY` en Railway producción** — sin definir, así que los JWT se
      firman con el default público del repositorio (`app/core/security/config.py`)
- [ ] Cada destino debe tener su propio `SECRET_KEY` para que un token no sea
      válido entre entornos
- [ ] Decidir el destino de `main` tras el corte de producción al VPS
- [ ] Llave de despliegue de GitHub en el VPS para sustituir `rsync` por `git pull`
