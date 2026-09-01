# Atlas ONE: migración a IONOS y host multi-servicio

- **Fecha:** 2026-09-01
- **Estado:** diseño aprobado, pendiente de plan de implementación
- **Servidor:** `atlas-prod-01` — IONOS VPS 12-24-720, `74.208.190.44`, Ubuntu 24.04.4 LTS
- **Repositorio:** `Ecamposg95/atlas-one`

## Problema

Atlas ONE atiende hoy a un cliente real —Novedades Kaory— desde Railway
(`https://atlas-one.up.railway.app`). Hay clientes nuevos por entrar y no existe
un lugar donde darlos de alta: el VPS tiene una copia congelada sin dominio y una
instancia beta con datos demo. Al mismo tiempo el servidor ya aloja cinco
servicios sin vigilancia, sin respaldo fuera del disco y con todas las
aplicaciones conectándose a Postgres como superusuario.

El objetivo es que el VPS sea la casa de producción de Atlas ONE, con Kaory
migrada y con espacio ordenado para clientes y servicios nuevos.

## Alcance

**Dentro**

- Instancia de producción de Atlas ONE en el VPS, multi-organización.
- Migración completa de los datos de Kaory desde Railway.
- Separación de la instancia demo/QA en su propio subdominio.
- Stack de observabilidad (métricas, logs, alertas).
- Endurecimiento del host y plantilla para servicios nuevos.

**Fuera**

- `rmazh` no se toca. Su base sigue en Railway
  (`roundhouse.proxy.rlwy.net:33790`), de modo que **Railway no se apaga**:
  únicamente deja de servir a Kaory. El ahorro es parcial hasta que esa base se
  resuelva, en un trabajo aparte.
- HRFlow no se modifica, salvo investigar sus procesos zombie.

## Decisiones

| Decisión | Elección | Razón |
|---|---|---|
| Tenencia | Una instancia multi-organización | Es como está construida la aplicación; cada cliente es una `organization`. |
| Dominios | `app.` = producción, `demo.` = demo/QA | El subdominio bueno debe servir al negocio, no a la demo. |
| Ramas | Fast-forward `staging` → `main` **después** del corte | `main` es ancestro estricto de `staging`; el FF es limpio. Hacerlo antes redesplegaría Railway con Kaory vendiendo, porque el servicio no tiene `watchPatterns`. |
| Datos de Kaory | Todo: catálogo, existencias e historial | Conserva reportes y continuidad de folios. |
| Técnica de migración | Restaurar el dump completo y purgar las organizaciones demo | Una extracción selectiva de 60 tablas con llaves foráneas es donde se rompen estas migraciones; el dump completo preserva la integridad por construcción. |
| Observabilidad | Prometheus + Grafana + Loki | Producción propia sin la red de seguridad de Railway. |

### Estado real de las ramas (verificado 2026-09-01)

```
origin/main    = 8be98ab  2026-08-09   ← lo que corre Kaory en Railway
origin/staging = e3960ff  2026-08-20   ← 6 commits adelante, fast-forward limpio
```

Los seis commits: rediseño de login (×2), cirugía P0 de la auditoría de UI,
sistema de diseño, gastro fase 3 (mesa→comanda→cocina→cobro) y shell móvil.
**No hay scripts `migrate_*` nuevos**, así que la subida de versión del esquema
se reduce a `create_all` creando tablas nuevas.

> Nota: una estimación previa de "116 commits de diferencia" venía de refs de git
> con cinco semanas de atraso. La brecha real es de seis commits.

### Manejo del esquema

El proyecto no usa Alembic (0 revisiones). El esquema se construye con
`Base.metadata.create_all` —que crea tablas faltantes pero nunca altera las
existentes— más 21 scripts `scripts/migrate_*.py` idempotentes, registrados en la
tabla `schema_migrations` y aplicados en orden alfabético por
`scripts/migrate.py`.

## Estado objetivo

```
                    ┌──────────── Caddy (TLS automático) ────────────┐
atlasone.com.mx          → /srv/landing                     estático
app.atlasone.com.mx      → atlas-one-prod:8000    base atlas_one_prod   PRODUCCIÓN
demo.atlasone.com.mx     → atlas-one-demo:8000    base atlas_one_demo   demo / QA
rmazh.atlasone.com.mx    → rmazh:8000             base en Railway       sin cambios
hrflow.atlasone.com.mx   → hrflow-web:3000                              sin cambios
status.atlasone.com.mx   → grafana:3000           con autenticación     nuevo
                    └───────────────────────────────────────────────┘
              postgres:18-alpine · red docker `edge` · un rol por aplicación
```

El contenedor `atlas-one` congelado y su base `atlas_one` se conservan intactos
hasta que producción esté estable; después se archivan y se borran.

## Datos de Kaory (organización 14, medidos 2026-09-01)

| Tabla | Filas |
|---|---|
| `branches` / `brands` / `departments` / `employees` | 2 / 1 / 1 / 2 |
| `user_organizations` | 2 |
| `organization_modules` | 9 |
| `products` / `product_variants` / `product_branch_status` | 305 / 305 / 305 |
| `product_prices` | 113 |
| `stock_on_hand` | 305 |
| `sales_documents` / `sales_lines` / `payments` | 12,545 / 20,863 / 12,545 |
| `inventory_movements` | 21,277 |
| `cash_sessions` / `cash_audit_log` | 93 / 92 |
| `parked_tickets` / `print_jobs` | 173 / 13,027 |
| `customers` / `expenses` | 0 / 0 |

La columna de tenencia es `organization_id` (presente en 60 tablas), no `org_id`.

## Prerequisito de DNS

Los subdominios nuevos no existen todavía. Hay que crearlos en Cloudflare
(zona `atlasone.com.mx`, cuenta `ecamposg95@gmail.com`) como registros `A` hacia
`74.208.190.44`:

| Registro | Para | Fase |
|---|---|---|
| `prod-test` | pruebas con datos reales antes del corte | A |
| `demo` | instancia demo/QA tras liberar `app.` | B |
| `status` | Grafana | D |

**Los tres deben quedar en modo DNS only (nube gris).** Con el proxy naranja,
Cloudflare termina el TLS y Caddy nunca completa el desafío de Let's Encrypt.
`prod-test` se borra una vez terminado el corte.

## Fase A — Nace producción, sin tocar a nadie

1. Crear `/srv/apps/atlas-one-prod/` siguiendo el patrón existente: build local
   desde `./src`, `restart: unless-stopped`, red externa `edge`, `expose: 8000`,
   healthcheck contra `/docs`, y tres volúmenes para
   `product_images`, `branch_logos` y `uploads`.
2. Código: export de `origin/staging` más el `Dockerfile` de la raíz (la rama no
   lo trae).
3. `pg_dump --format=custom` completo de Railway (`DATABASE_PUBLIC_URL` del
   servicio `Postgres`, proyecto `bf878c92-b8d3-4b47-bba7-e7d314aecf68`) y
   restauración en la base nueva `atlas_one_prod`.
4. Purgar las organizaciones demo (`id` 1–13), verificando la cascada tabla por
   tabla antes de confirmar. Debe quedar únicamente la organización 14.
5. Subir el esquema: arrancar la aplicación (que ejecuta `create_all`) y correr
   `python scripts/migrate.py`.
6. **Verificación por conteos** contra Railway, tabla por tabla, con las cifras
   de arriba. Cualquier diferencia obliga a rehacer la restauración; no se
   corrige a mano.
7. Crear el rol `atlas_prod`, no superusuario, dueño de `atlas_one_prod`, y
   apuntar el `.env` a él. Hoy las tres aplicaciones de Atlas se conectan como
   `postgres` superusuario, lo que significa que un fallo en el punto de venta
   alcanza también las bases de HRFlow.
8. Publicar en `prod-test.atlasone.com.mx` para pruebas con datos reales, sin
   que nadie capture ventas ahí.

**Criterio de salida:** los conteos coinciden, se puede iniciar sesión, cobrar
una venta de prueba, imprimir su ticket y cerrar un corte de caja.

## Fase B — El corte

**Prerequisito bloqueante.** En la terminal de la tienda, definir
`ATLAS_AGENT_ORIGINS="https://app.atlasone.com.mx"`, reiniciar el agente de
impresión y **verificar una impresión real**. El agente sólo acepta orígenes
`*.up.railway.app` y `localhost`
(`tools/print_agent/core/main.py:133`); sin este cambio, al mover el punto de
venta al dominio propio el navegador bloquea al agente y dejan de salir tickets.

Con la tienda cerrada:

1. Avisar que no se captura y tomar un `pg_dump` fresco de Railway.
2. Restaurar sobre `atlas_one_prod` desde cero —no incremental—, purgar demos y
   correr las migraciones.
3. Repetir la verificación por conteos contra Railway.
4. Caddy: `app.atlasone.com.mx` pasa a `atlas-one-prod`; la instancia beta se
   muda a `demo.atlasone.com.mx`.
5. Prueba de humo con la operadora: una venta real, su ticket impreso y un corte
   de caja.
6. Dejar Railway encendido varios días como rollback. Volver atrás es una línea
   del Caddyfile.

Los folios continúan su numeración: al traer el historial no se reinician ni se
duplican.

## Fase C — Clientes nuevos

Consolidar el alta de organizaciones en un único `scripts/onboard_org.py`
idempotente —organización, sucursal, usuario administrador y preset de giro—,
hoy repartida entre `init_presets_v2.py`, `init_users.py` y `railway_init.py`.

Antes de que entre el **segundo** cliente a la base compartida hay que correr
`scripts/audit_tenant_isolation.py` y cerrar sus hallazgos. Mientras Kaory era la
única organización con datos reales, una fuga entre organizaciones no tenía
consecuencias; en cuanto haya dos clientes, sí las tiene.

## Fase D — Observabilidad

`/srv/apps/monitoring/`, todo en la red `edge`:

| Componente | Función |
|---|---|
| Prometheus | métricas y reglas de alerta |
| Grafana | paneles, en `status.atlasone.com.mx` con autenticación de Caddy |
| Loki + Promtail | logs centralizados de todos los contenedores |
| cAdvisor | CPU, memoria y red por contenedor |
| node-exporter | recursos del host |
| postgres-exporter | conexiones, tamaño de bases, consultas lentas |
| Alertmanager | avisos por correo |

Alertas mínimas: contenedor caído o reiniciándose en bucle; `/` por encima del
80 %; Postgres sin responder; certificado a menos de 15 días de vencer; **backup
que no corrió o cuyo tamaño cayó respecto al día anterior**; latencia alta en
`app.atlasone.com.mx`.

## Fase E — Endurecimiento del host

Hallazgos de la inspección del 2026-09-01:

- **Reboot pendiente desde hace 34 días.** `unattended-upgrades` está activo,
  pero los parches de kernel no surten efecto sin reiniciar. Adoptar una ventana
  mensual.
- **Los respaldos sólo viven en el mismo disco** (`/srv/backups`, cron diario
  03:30, retención 14 días). Falta copia fuera del servidor y una restauración
  de prueba automatizada: un respaldo que nunca se restauró no es un respaldo.
- **Sin límite de logs de Docker** — no existe `/etc/docker/daemon.json`. Hoy
  ocupan 51 MB; con Loki y más servicios crecerá sin techo. Fijar `json-file`
  con `max-size` y `max-file`.
- **Sin swap.** Con 23 GB no es urgente, pero 4 GB de swapfile evitan que el OOM
  killer elija a Postgres durante un pico.
- Volúmenes `pgdata` y `pgdata18` huérfanos: verificar que nada los usa y
  borrarlos. El vivo es `pgdata_v18`.
- Límites de CPU y memoria por contenedor.
- Dos procesos `node` zombie bajo HRFlow: indican un supervisor que no cosecha
  hijos.

## Fase F — Plantilla para servicios nuevos

`/srv/apps/_template/` con `docker-compose.yml` y `.env.example` en el patrón de
la casa, más un `scripts/new-service.sh` que crea la carpeta, la base, el rol, el
bloque de Caddy y el registro en Prometheus. Documentado en
`docs/infra/ionos-vps.md`.

## Orden de ejecución

```
A (instancia + ensayo)  →  D básica  →  B (corte)  →  C (clientes nuevos)  →  E, F
```

La observabilidad básica va antes del corte: no conviene mover un negocio a un
servidor que no avisa cuando algo se cae.

## Riesgos

1. **Un solo host, sin réplica.** Si el VPS muere, se caen los cinco servicios.
   Los respaldos fuera del sitio acotan la pérdida a horas; no la eliminan.
2. **Kaory verá un producto distinto**: login nuevo, sistema de diseño y flujo
   gastronómico. Enseñárselo en `prod-test.` antes del corte, no la mañana
   siguiente.
3. **Se invalidan las sesiones activas.** Railway firma los JWT con el valor por
   omisión del repositorio (`app/core/security/config.py`); con una `SECRET_KEY`
   propia habrá que volver a iniciar sesión en la terminal.
4. **Railway sigue encendido** por la base de `rmazh`, fuera de este alcance.
5. **Aislamiento entre organizaciones**: con Kaory y clientes nuevos en la misma
   base, un error de filtrado por `organization_id` expone datos entre negocios.
   Mitigado por la auditoría de la fase C, que es prerequisito del segundo
   cliente.

## Trampas conocidas del stack

- `LOG_LEVEL` debe ir en mayúsculas: `app/main.py:27` lo pasa directo a
  `logging` y con `info` uvicorn muere con `ValueError: Unknown level`.
- `/api/auth/login` es `form-encoded` (OAuth2PasswordRequestForm); con JSON
  responde 422.
- El frontend usa `baseURL: '/api'` relativo: no necesita variables `VITE_*` en
  tiempo de compilación.
- Postgres 18 monta el volumen en `/var/lib/postgresql`, no en
  `/var/lib/postgresql/data`; con la ruta antigua el contenedor entra en bucle.
- La tabla de organizaciones se llama `organization`, en singular.
- Sin `CLOUDINARY_URL`, las imágenes se guardan en
  `app/static/{product_images,branch_logos,uploads}`; por eso los tres volúmenes.
