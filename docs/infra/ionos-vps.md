# Infraestructura — VPS IONOS `atlas-prod-01`

> Última actualización: 2026-07-28

Servidor propio donde vive la landing de Atlas ONE, la versión de la rama
`staging` y el espacio reservado para RMAZH. Complementa a Railway, que sigue
sirviendo la producción de Kaory.

## El servidor

```
host    atlas-prod-01
ip      74.208.190.44
so      Ubuntu 24.04 LTS
specs   12 vCore · 24 GB RAM · 720 GB NVMe
acceso  ssh ionos     (llave ~/.ssh/id_ed25519_ionos, sin passphrase)
```

Acceso solo por llave pública: `PasswordAuthentication no` en
`/etc/ssh/sshd_config.d/01-hardening.conf`. `ufw` abierto únicamente en 22, 80 y
443; `fail2ban` vigilando sshd.

> **El prefijo `01-` del archivo de hardening no es cosmético.** sshd resuelve
> por *primera coincidencia* y el `50-cloud-init.conf` de Ubuntu fuerza
> `PasswordAuthentication yes`. Un archivo `99-` no tendría ningún efecto y
> creerías estar protegido sin estarlo.

## Qué corre ahí

```
                       ┌──────────────────────────┐
      :443 ───────────▶│  caddy  (TLS automático) │
                       └────────────┬─────────────┘
                                    │  red docker "edge"
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
  /srv/landing              atlas-one-beta               /srv/placeholder
  atlasone.com.mx           app.atlasone.com.mx          rmazh.atlasone.com.mx
                                    │
                                    ▼
                            postgres (18-alpine)
                            └ atlas_one_beta   ← rama staging, datos demo
                            └ atlas_one        ← copia de Kaory (congelada)
```

| Ruta | Contenido |
|---|---|
| `/srv/caddy/` | `Caddyfile` + compose del proxy |
| `/srv/apps/postgres/` | Postgres compartido, volumen `pgdata_v18` |
| `/srv/apps/atlas-one-beta/` | App de la rama `staging` + `src/` |
| `/srv/apps/atlas-one/` | Copia de producción, sin dominio apuntando |
| `/srv/landing/` | Landing estática de `atlasone.com.mx` |
| `/srv/backups/` | Dumps + `pg_backup.sh` (cron diario 03:30, retención 14 días) |

El contenedor `atlas-one` sigue encendido pero **ningún dominio lo alcanza**.
Su base `atlas_one` conserva una copia de los datos de Kaory congelada el
2026-07-28 18:33 CST, guardada para el corte de producción futuro. No sirve para
consultar datos actuales: diverge de Railway con cada venta.

## Redesplegar

```bash
git archive --format=tar origin/main | ssh ionos 'tar -x -C /srv/apps/atlas-one-prod/src'
scp Dockerfile .dockerignore ionos:/srv/apps/atlas-one-prod/src/
ssh ionos 'cd /srv/apps/atlas-one-beta && docker compose build && docker compose up -d'
```

El `src/` del VPS es un export de `origin/staging` más el `Dockerfile` de
producción. Mientras la llave de despliegue de GitHub no esté en el servidor,
el código viaja por `git archive` desde `origin/main`, y el `.env` **no** entra
en la imagen: lo aporta `env_file:` del compose en tiempo de ejecución.

## TLS

Caddy pide y renueva los certificados de Let's Encrypt solo. Los registros DNS
viven en Cloudflare y **deben estar en modo "DNS only" (nube gris)**: con el
proxy naranja, Cloudflare termina el TLS y Caddy nunca completa el desafío.

## Base de datos

Postgres **18**, no 17. Railway corre 18.3 y el `docker-compose.yml` de
desarrollo aún dice `postgres:17-alpine`.

> Postgres 18 monta el volumen en `/var/lib/postgresql`, **no** en
> `/var/lib/postgresql/data`. Con la ruta antigua el contenedor entra en bucle de
> reinicio con un mensaje sobre "unused mount/volume".

Respaldos automáticos de todas las bases a `/srv/backups`, diarios a las 03:30,
con 14 días de retención.

## Monitoreo

Los eventos de Docker (`die`, `oom`, `health_status`) son la señal de caída.
En Docker 29 el campo de la plantilla es `{{.Action}}`; `{{.Status}}` fue
eliminado y hace que `docker events` falle al instante — un monitor construido
así queda mudo, y el silencio se ve igual que "todo bien".

```bash
docker events --filter event=die --filter event=oom --filter event=health_status \
  --format "{{.Actor.Attributes.name}} :: {{.Action}} :: exit={{.Actor.Attributes.exitCode}}"
```

## Pendientes

- Llave de despliegue de GitHub en el servidor para hacer `git pull` en el propio VPS
- Reverse DNS (PTR) de la IP hacia `atlas-prod-01.atlasone.com.mx`
- `rmazh.mx` (servidor **74.208.195.59**, distinto a este) tiene el certificado
  vencido desde el 2026-07-19 y ese dominio se imprime en cada ticket
