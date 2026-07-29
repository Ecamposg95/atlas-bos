# Mapa de despliegues — Atlas ONE

> Última actualización: 2026-07-28

Dónde vive cada cosa y qué rama la alimenta. Léelo antes de tocar `main`.

## Estado actual

| Destino | Rama | Base de datos | Quién lo usa |
|---|---|---|---|
| `atlas-one.up.railway.app` | `main` | Postgres de Railway (producción) | **Novedades Kaory — cliente real, todos los días** |
| `app.atlasone.com.mx` | `staging` | `atlas_one_beta` en el VPS (datos demo) | Demos y pruebas |
| `atlasone.com.mx` | — | — | Landing estática |
| `rmazh.atlasone.com.mx` | — | — | Reservado para otro repositorio |

## ⚠️ `main` despliega producción automáticamente

Railway tiene el servicio `atlas-bos` conectado a `main` con despliegue
automático. **Cada push a `main` reconstruye y reemplaza el punto de venta que
Kaory está usando.** No es una rama de integración: es producción en vivo.

La tienda opera hasta cerca de las 20:00 hora de México. Cualquier cambio que
pueda afectar el arranque debería entrar fuera de ese horario.

### El `Dockerfile` no debe llegar a `main`

Railway **prioriza un `Dockerfile` en la raíz** por encima de Railpack. El
`Dockerfile` de este repositorio se escribió para el VPS y su servidor escucha en
`${PORT:-8000}`; Railway rutea al 8080 e inyecta `PORT`. Aunque la variable ya se
respeta, subirlo a `main` cambiaría la estrategia de compilación de producción
sin necesidad. Vive en `staging`, que es de donde despliega el VPS.

## Ramas

```
main     ──▶ Railway producción (atlas-one.up.railway.app) — Kaory
staging  ──▶ VPS (app.atlasone.com.mx) — 95 commits adelante de main
```

`staging` incluye la Gastro Suite (mesas, comandas, KDS, recetas) y el ledger de
botellas del bar. `main` revirtió el módulo gastro (commits `d66f0dd` y `c099c7d`).

El entorno `staging` de Railway se **eliminó el 2026-07-28**: llevaba encendido
sin uso desde el 13 de julio y concentraba 45 de los 50 despliegues del periodo.
Su contenido corre ahora en el VPS. Respaldo en `/srv/backups/railway_staging.dump`.

## Variables de entorno

| Variable | Notas |
|---|---|
| `DATABASE_URL` | Única que Railway define en producción |
| `SECRET_KEY` | **Railway NO la define** → firma los JWT con el default del repositorio |
| `LOG_LEVEL` | **En MAYÚSCULAS.** `app/main.py:27` lo pasa directo a `logging`; con `info` uvicorn muere con `ValueError: Unknown level` |
| `CLOUDINARY_URL` | Sin ella las imágenes van a `app/static/{product_images,branch_logos,uploads}` |
| `SUPERADMIN_USER` / `SUPERADMIN_PASS` | Solo aplican si el usuario no existe; `railway_init.py` no cambia contraseñas existentes |

### Deuda de seguridad abierta

`app/core/security/config.py` usa
`_DEFAULT_SECRET = "atlas_erp_secret_key_change_me_in_prod"` como respaldo de
`SECRET_KEY`. Railway producción no define la variable, así que **los JWT de un
negocio real se firman con un secreto que está en el repositorio**. Cualquiera
con acceso al código puede falsificar una sesión válida. En el VPS ya se generó
uno real; falta hacerlo en Railway.

## Corte de producción al VPS — pendiente

`app.atlasone.com.mx` nunca fue la puerta de producción: la terminal de Kaory
habla directo con `atlas-one.up.railway.app`. Antes de moverla:

1. **Configurar `ATLAS_AGENT_ORIGINS` en la PC de la tienda y verificar una
   impresión real.** El agente acepta cualquier `*.up.railway.app` por regex
   (`tools/print_agent/core/main.py:133`) pero **no** un dominio propio. Sin este
   paso Kaory sigue vendiendo pero deja de imprimir tickets.
2. Con la tienda cerrada, resincronizar la base desde Railway.
3. Verificar que coincidan `sales_documents`, `payments` e `inventory_movements`.
4. Apuntar la terminal al dominio nuevo.
5. Prueba de humo: una venta real con su ticket impreso.
6. Dejar Railway encendido varios días como rollback antes de apagarlo.

Ver [`ionos-vps.md`](./ionos-vps.md) para el detalle del servidor.
