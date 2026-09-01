# Migración de Atlas ONE a IONOS — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la producción de Atlas ONE viva en el VPS de IONOS con los datos completos de Novedades Kaory, sirviendo `app.atlasone.com.mx`, con la instancia demo separada y con capacidad de recibir clientes nuevos.

**Architecture:** Se levanta una instancia de producción nueva y aislada (`atlas-one-prod`) con su propia base, alimentada por una restauración del dump completo de Railway a la que se le purgan las trece organizaciones demo. Se ensaya en un subdominio temporal hasta que los conteos cuadren y la operación funcione; sólo entonces se mueve el DNS interno de Caddy. Railway queda encendido como retorno.

**Tech Stack:** Docker Compose · Caddy 2 · PostgreSQL 18 · FastAPI · Railway CLI · Cloudflare DNS

**Spec:** `docs/superpowers/specs/2026-09-01-atlas-one-migracion-ionos-design.md`

## Global Constraints

- **Servidor:** `atlas-prod-01`, `74.208.190.44`, alias `ssh ionos`. Ubuntu 24.04.4.
- **Proyecto de Railway origen:** `bf878c92-b8d3-4b47-bba7-e7d314aecf68`, entorno `production`, servicios `atlas-bos` y `Postgres`.
- **Nunca se escribe en la base de Railway.** Todo lo que se haga contra ella es de lectura: `pg_dump` y consultas de conteo. Railway es el retorno.
- **La columna de tenencia es `organization_id`**, presente en 60 tablas. No existe `org_id`.
- **Kaory es la organización 14.** Las organizaciones 1 a 13 son demo y se purgan.
- Postgres 18 monta el volumen en `/var/lib/postgresql`, **no** en `/var/lib/postgresql/data`; con la ruta antigua el contenedor entra en bucle de reinicio.
- `LOG_LEVEL` en MAYÚSCULAS en todo `.env`: `app/main.py:27` lo pasa directo a `logging` y con `info` uvicorn muere.
- Los registros de Cloudflare deben quedar en **DNS only (nube gris)**; con el proxy naranja Caddy nunca completa el desafío de Let's Encrypt.
- No se toca `rmazh` ni HRFlow.
- El código de producción sale de `origin/staging`; la rama no incluye el `Dockerfile`, que se copia de la raíz del repositorio.

## Cifras de referencia de Kaory (medidas 2026-09-01)

Estas son las que deben cuadrar en cada verificación. Cambiarán al alza entre hoy y el corte: **se vuelven a medir contra Railway en el momento**, y estas sirven de piso mínimo.

| Tabla | Filas |
|---|---|
| `products` | 305 |
| `product_variants` | 305 |
| `product_branch_status` | 305 |
| `product_prices` | 113 |
| `stock_on_hand` | 305 |
| `sales_documents` | 12,545 |
| `sales_lines` | 20,863 |
| `payments` | 12,545 |
| `inventory_movements` | 21,277 |
| `cash_sessions` | 93 |
| `branches` | 2 |
| `user_organizations` | 2 |
| `organization_modules` | 9 |

---

### Task 1: Registros de DNS

**Files:**
- Ninguno en el repositorio. Se opera sobre Cloudflare, zona `atlasone.com.mx`.

**Interfaces:**
- Produces: `prod-test.atlasone.com.mx` y `demo.atlasone.com.mx` resolviendo a `74.208.190.44`, disponibles para las tareas 5 y 9.

- [ ] **Step 1: Crear los registros**

En Cloudflare, zona `atlasone.com.mx` (cuenta `ecamposg95@gmail.com`), crear dos registros `A` hacia `74.208.190.44`:

- `prod-test` — **DNS only (nube gris)**
- `demo` — **DNS only (nube gris)**

- [ ] **Step 2: Verificar la resolución**

```bash
dig +short prod-test.atlasone.com.mx
dig +short demo.atlasone.com.mx
```

Esperado: ambos devuelven `74.208.190.44` y nada más. Si aparecen direcciones de Cloudflare (rangos `104.x` o `172.67.x`), el proxy naranja sigue encendido y hay que apagarlo.

---

### Task 2: Base y rol de producción en el VPS

**Files:**
- Ninguno en el repositorio. Se opera sobre el contenedor `postgres` del VPS.

**Interfaces:**
- Produces: base `atlas_one_prod` propiedad del rol `atlas_prod`, y la contraseña de ese rol guardada para el `.env` de la Task 3.

- [ ] **Step 1: Generar la contraseña y crear el rol y la base**

```bash
ssh ionos 'PASS=$(openssl rand -base64 24 | tr -d "/+=" | head -c 28)
echo "$PASS" > /root/.atlas_prod_pass && chmod 600 /root/.atlas_prod_pass
docker exec -i postgres psql -U postgres <<SQL
CREATE ROLE atlas_prod LOGIN PASSWORD '"'"'$PASS'"'"';
CREATE DATABASE atlas_one_prod OWNER atlas_prod;
SQL
echo "rol y base creados; contrasena en /root/.atlas_prod_pass"'
```

- [ ] **Step 2: Verificar**

```bash
ssh ionos 'docker exec postgres psql -U postgres -tAc \
  "SELECT d.datname, r.rolname, r.rolsuper FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE d.datname='"'"'atlas_one_prod'"'"';"'
```

Esperado: `atlas_one_prod|atlas_prod|f`. El `f` importa: el rol **no** debe ser superusuario. Hoy las tres aplicaciones de Atlas se conectan como `postgres` superusuario, lo que significa que un fallo en el punto de venta alcanza también las bases de HRFlow.

---

### Task 3: Contenedor de producción

**Files:**
- Create en el VPS: `/srv/apps/atlas-one-prod/docker-compose.yml`
- Create en el VPS: `/srv/apps/atlas-one-prod/.env`
- Create en el VPS: `/srv/apps/atlas-one-prod/src/` (código exportado)

**Interfaces:**
- Consumes: la base y el rol de la Task 2.
- Produces: el contenedor `atlas-one-prod` en la red `edge`, escuchando en el puerto 8000 interno, listo para que Caddy lo consuma en las tareas 5 y 9.

- [ ] **Step 1: Exportar el código de `staging` al servidor**

```bash
cd /mnt/d/Devs/atlas-one
git fetch origin
git archive --format=tar origin/staging | ssh ionos 'mkdir -p /srv/apps/atlas-one-prod/src && tar -x -C /srv/apps/atlas-one-prod/src'
scp Dockerfile .dockerignore ionos:/srv/apps/atlas-one-prod/src/
ssh ionos 'ls /srv/apps/atlas-one-prod/src/Dockerfile && echo "Dockerfile presente"'
```

El `Dockerfile` va aparte porque la rama `staging` no lo incluye: quedó sin commitear a propósito para que Railway no lo prefiera sobre Railpack.

- [ ] **Step 2: Escribir el `.env`**

```bash
ssh ionos 'PASS=$(cat /root/.atlas_prod_pass)
SECRET=$(openssl rand -hex 32)
cat > /srv/apps/atlas-one-prod/.env <<EOF
DATABASE_URL=postgresql://atlas_prod:${PASS}@postgres:5432/atlas_one_prod
SECRET_KEY=${SECRET}
LOG_LEVEL=INFO
EOF
chmod 600 /srv/apps/atlas-one-prod/.env
echo "env escrito"'
```

`LOG_LEVEL` va en mayúsculas. No se define `SUPERADMIN_USER` ni `SUPERADMIN_PASS`: los usuarios vienen en la restauración y `railway_init.py` no debe sembrar organizaciones demo en esta base.

- [ ] **Step 3: Escribir el `docker-compose.yml`**

```bash
ssh ionos 'cat > /srv/apps/atlas-one-prod/docker-compose.yml <<EOF
services:
  atlas-one-prod:
    build:
      context: ./src
      dockerfile: Dockerfile
    image: atlas-one-prod:latest
    container_name: atlas-one-prod
    restart: unless-stopped
    env_file: .env
    expose: ["8000"]
    networks: [edge]
    volumes:
      - prod_product_images:/app/app/static/product_images
      - prod_branch_logos:/app/app/static/branch_logos
      - prod_uploads:/app/app/static/uploads
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('"'"'http://localhost:8000/docs'"'"')\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 90s

volumes:
  prod_product_images:
  prod_branch_logos:
  prod_uploads:
networks:
  edge:
    external: true
EOF
echo "compose escrito"'
```

- [ ] **Step 4: Construir sin arrancar**

```bash
ssh ionos 'cd /srv/apps/atlas-one-prod && docker compose build 2>&1 | tail -20'
```

Esperado: la construcción termina sin error. Todavía **no** se levanta: la base está vacía y arrancar ahora dispararía `create_all` y `railway_init.py` sobre una base que aún debe recibir la restauración.

---

### Task 4: Restaurar los datos de Kaory y purgar las demos

**Files:**
- Create en el VPS: `/srv/backups/railway_prod_<fecha>.dump`

**Interfaces:**
- Consumes: la base vacía de la Task 2.
- Produces: `atlas_one_prod` conteniendo únicamente la organización 14, con los conteos verificados.

- [ ] **Step 1: Tomar el dump de Railway**

```bash
export RAILWAY_CALLER="skill:use-railway@1.3.7" RAILWAY_AGENT_SESSION="atlas-migracion"
URL=$(railway variable list --project bf878c92-b8d3-4b47-bba7-e7d314aecf68 \
  --environment production --service Postgres --json \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['DATABASE_PUBLIC_URL'])")
STAMP=$(date +%Y%m%d_%H%M%S)
ssh ionos "cat > /root/.railway_url && chmod 600 /root/.railway_url" <<< "$URL"
ssh ionos "docker exec -i -e U=\"\$(cat /root/.railway_url)\" postgres sh -c 'pg_dump \"\$U\" --format=custom --no-owner --no-privileges' > /srv/backups/railway_prod_${STAMP}.dump"
ssh ionos "ls -lh /srv/backups/railway_prod_${STAMP}.dump"
```

Esperado: un archivo de varios megabytes. Si pesa menos de 1 MB, el dump falló y no debe usarse.

- [ ] **Step 2: Medir los conteos en el origen**

```bash
ssh ionos 'docker exec -i -e U="$(cat /root/.railway_url)" postgres psql "$U" -tA <<SQL
SELECT "products", count(*) FROM products WHERE organization_id=14
UNION ALL SELECT "sales_documents", count(*) FROM sales_documents WHERE organization_id=14
UNION ALL SELECT "sales_lines", count(*) FROM sales_lines WHERE organization_id=14
UNION ALL SELECT "payments", count(*) FROM payments WHERE organization_id=14
UNION ALL SELECT "inventory_movements", count(*) FROM inventory_movements WHERE organization_id=14
UNION ALL SELECT "cash_sessions", count(*) FROM cash_sessions WHERE organization_id=14
UNION ALL SELECT "stock_on_hand", count(*) FROM stock_on_hand WHERE organization_id=14;
SQL' | tee /tmp/conteos_origen.txt
```

Guardar esa salida: es la referencia del paso 5.

- [ ] **Step 3: Restaurar**

```bash
ssh ionos 'DUMP=$(ls -t /srv/backups/railway_prod_*.dump | head -1)
docker exec -i postgres pg_restore -U postgres -d atlas_one_prod --no-owner --no-privileges < "$DUMP" 2>&1 | tail -20
echo "restaurado desde $DUMP"'
```

`pg_restore` puede emitir advertencias sobre roles inexistentes; con `--no-owner` son inofensivas. Los **errores** sí importan.

- [ ] **Step 4: Purgar las organizaciones demo**

```bash
ssh ionos 'docker exec -i postgres psql -U postgres -d atlas_one_prod <<SQL
BEGIN;
DO $$
DECLARE r record; n bigint; total bigint := 0;
BEGIN
  FOR r IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema='"'"'public'"'"' AND column_name='"'"'organization_id'"'"'
    ORDER BY table_name
  LOOP
    EXECUTE format('"'"'DELETE FROM public.%I WHERE organization_id BETWEEN 1 AND 13'"'"', r.table_name);
    GET DIAGNOSTICS n = ROW_COUNT;
    total := total + n;
    IF n > 0 THEN RAISE NOTICE '"'"'%: % filas'"'"', r.table_name, n; END IF;
  END LOOP;
  RAISE NOTICE '"'"'TOTAL BORRADO: %'"'"', total;
END $$;
DELETE FROM organization WHERE id BETWEEN 1 AND 13;
COMMIT;
SQL'
```

Si alguna llave foránea impide el borrado, la transacción se revierte entera y no queda nada a medias. En ese caso hay que identificar la tabla dependiente que no tiene `organization_id` y borrarla explícitamente antes del bloque.

- [ ] **Step 5: Verificar los conteos**

```bash
ssh ionos 'docker exec -i postgres psql -U postgres -d atlas_one_prod -tA <<SQL
SELECT "organizaciones", count(*) FROM organization
UNION ALL SELECT "products", count(*) FROM products WHERE organization_id=14
UNION ALL SELECT "sales_documents", count(*) FROM sales_documents WHERE organization_id=14
UNION ALL SELECT "sales_lines", count(*) FROM sales_lines WHERE organization_id=14
UNION ALL SELECT "payments", count(*) FROM payments WHERE organization_id=14
UNION ALL SELECT "inventory_movements", count(*) FROM inventory_movements WHERE organization_id=14
UNION ALL SELECT "cash_sessions", count(*) FROM cash_sessions WHERE organization_id=14
UNION ALL SELECT "stock_on_hand", count(*) FROM stock_on_hand WHERE organization_id=14;
SQL'
```

Esperado: `organizaciones|1` y **cada** cifra idéntica a `/tmp/conteos_origen.txt`. Cualquier diferencia significa rehacer desde el paso 3; no se corrige a mano.

- [ ] **Step 6: Ceder la propiedad al rol de la aplicación**

```bash
ssh ionos 'docker exec -i postgres psql -U postgres -d atlas_one_prod <<SQL
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='"'"'public'"'"' LOOP
    EXECUTE format('"'"'ALTER TABLE public.%I OWNER TO atlas_prod'"'"', r.tablename);
  END LOOP;
  FOR r IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='"'"'public'"'"' LOOP
    EXECUTE format('"'"'ALTER SEQUENCE public.%I OWNER TO atlas_prod'"'"', r.sequence_name);
  END LOOP;
END $$;
SQL
echo "propiedad cedida"'
```

---

### Task 5: Subir la versión y ensayar

**Files:**
- Modify en el VPS: `/srv/caddy/Caddyfile`

**Interfaces:**
- Consumes: el contenedor de la Task 3 y la base de la Task 4.
- Produces: `https://prod-test.atlasone.com.mx` sirviendo la versión nueva con los datos reales de Kaory.

- [ ] **Step 1: Arrancar el contenedor**

```bash
ssh ionos 'cd /srv/apps/atlas-one-prod && docker compose up -d && sleep 60 && docker compose logs --tail 40'
```

Esperado: uvicorn levantado sin trazas de error. Al arrancar corre `create_all`, que crea las tablas nuevas de la Gastro Suite sin tocar las que traen datos.

- [ ] **Step 2: Aplicar las migraciones pendientes**

```bash
ssh ionos 'docker exec atlas-one-prod python scripts/migrate.py --status'
```

Revisar qué reporta como pendiente, y luego:

```bash
ssh ionos 'docker exec atlas-one-prod python scripts/migrate.py'
```

Esperado: los pendientes se aplican y quedan registrados en `schema_migrations`. Los scripts son idempotentes, así que un reintento tras un fallo es seguro.

- [ ] **Step 3: Confirmar que los conteos siguen intactos**

Repetir el paso 5 de la Task 4. La subida de versión no debe haber alterado ninguna cifra.

- [ ] **Step 4: Publicar en el subdominio de ensayo**

Agregar al final de `/srv/caddy/Caddyfile`:

```
# Ensayo de la migracion — se borra despues del corte
prod-test.atlasone.com.mx {
	encode zstd gzip
	reverse_proxy atlas-one-prod:8000
}
```

y recargar:

```bash
ssh ionos 'cd /srv/caddy && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile && echo recargado'
```

- [ ] **Step 5: Verificar que responde con TLS**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://prod-test.atlasone.com.mx/docs
```

Esperado: `200`. Si falla el certificado, revisar que el registro de Cloudflare esté en nube gris.

- [ ] **Step 6: Ensayo funcional completo**

En `https://prod-test.atlasone.com.mx`, con una cuenta de Kaory:

1. Iniciar sesión. **Las sesiones anteriores no sirven**: la `SECRET_KEY` es nueva, así que hay que volver a autenticarse.
2. Verificar que aparecen los 305 productos con sus precios y existencias.
3. Cobrar una venta de prueba.
4. Consultar un reporte histórico y comprobar que trae las ventas de Railway.
5. Abrir y cerrar un corte de caja.
6. Revisar que el folio siguiente continúa la numeración de Railway, sin reiniciarse.

- [ ] **Step 7: Enseñárselo a la clienta**

Mostrarle a Kaory la versión nueva en `prod-test` antes del corte. Va a ver un producto distinto —login nuevo, sistema de diseño, flujo gastronómico— y es mejor que lo conozca antes y no la mañana siguiente al cambio.

- [ ] **Step 8: Registrar el avance**

Actualizar `docs/infra/deployment-map.md` con la existencia de `atlas-one-prod` y su estado de ensayo. Commit en la rama `docs/migracion-ionos`.

---

### Task 6: Vigilancia mínima antes del corte

No conviene mover un negocio a un servidor que no avisa cuando algo se cae. El stack completo de observabilidad tiene su propio plan; esto es el piso imprescindible.

**Files:**
- Create en el VPS: `/srv/backups/check_health.sh`
- Create en el VPS: `/etc/cron.d/atlas-health`

**Interfaces:**
- Produces: un aviso por correo cuando un contenedor deja de estar sano, el disco pasa del 80 % o el respaldo del día no se generó.

- [ ] **Step 1: Escribir el verificador**

```bash
ssh ionos 'cat > /srv/backups/check_health.sh <<'"'"'EOF'"'"'
#!/bin/bash
# Verificacion minima previa al corte. Escribe en stdout solo si hay problema;
# cron envia por correo unicamente cuando hay salida.
set -uo pipefail
FALLAS=""

for C in caddy postgres atlas-one-prod atlas-one-beta rmazh hrflow-web hrflow-api; do
  ESTADO=$(docker inspect -f "{{.State.Status}}" "$C" 2>/dev/null || echo ausente)
  SALUD=$(docker inspect -f "{{if .State.Health}}{{.State.Health.Status}}{{else}}sin-healthcheck{{end}}" "$C" 2>/dev/null || echo ausente)
  if [ "$ESTADO" != "running" ]; then
    FALLAS="${FALLAS}\n$C no esta corriendo (estado: $ESTADO)"
  elif [ "$SALUD" = "unhealthy" ]; then
    FALLAS="${FALLAS}\n$C reporta unhealthy"
  fi
done

USO=$(df --output=pcent / | tail -1 | tr -dc "0-9")
if [ "$USO" -ge 80 ]; then
  FALLAS="${FALLAS}\nDisco raiz al ${USO}%"
fi

HOY=$(date +%Y%m%d)
if ! ls /srv/backups/atlas_one_prod_${HOY}_*.dump >/dev/null 2>&1; then
  FALLAS="${FALLAS}\nNo existe respaldo de atlas_one_prod del dia ${HOY}"
fi

if [ -n "$FALLAS" ]; then
  echo -e "atlas-prod-01 reporta problemas:${FALLAS}"
fi
EOF
chmod +x /srv/backups/check_health.sh
echo "escrito"'
```

- [ ] **Step 2: Probarlo con todo sano**

```bash
ssh ionos '/srv/backups/check_health.sh; echo "codigo: $?"'
```

Esperado: una sola línea, la del respaldo del día que todavía no existe. Esa
desaparece en cuanto corra la Task 8. Cualquier otra línea señala un problema
real que hay que resolver antes de seguir.

- [ ] **Step 3: Probarlo con una falla provocada**

```bash
ssh ionos 'docker stop atlas-one-beta && /srv/backups/check_health.sh; docker start atlas-one-beta'
```

Esperado: imprime `atlas-one-beta no esta corriendo`. Se usa la instancia demo a propósito: **nunca** detener un contenedor de producción para probar el monitoreo.

- [ ] **Step 4: Programarlo**

```bash
ssh ionos 'cat > /etc/cron.d/atlas-health <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
MAILTO=ecamposg95@gmail.com
*/15 * * * * root /srv/backups/check_health.sh
EOF
echo "programado"'
```

- [ ] **Step 5: Verificar que el correo sale**

```bash
ssh ionos 'echo "prueba de correo desde atlas-prod-01" | mail -s "Prueba atlas-prod-01" ecamposg95@gmail.com; echo "enviado"'
```

Si no llega, el servidor no tiene salida de correo configurada. **Resolverlo antes del corte**: un monitoreo que no puede avisar no es monitoreo. La alternativa es un webhook a WhatsApp o Telegram desde el mismo script.

---

### Task 7: Preparar el agente de impresión — prerequisito bloqueante

Sin esto, al mover el punto de venta al dominio propio **dejan de imprimirse los tickets**. El agente sólo acepta orígenes `localhost` y `*.up.railway.app` (`tools/print_agent/core/main.py:133`), y `https://app.atlasone.com.mx` no coincide con ese patrón.

**Files:**
- Modify en la PC de la tienda: la configuración del agente de impresión.

**Interfaces:**
- Produces: el agente aceptando peticiones desde `https://app.atlasone.com.mx`, verificado con una impresión real.

- [ ] **Step 1: Configurar la variable en la terminal de la tienda**

Por acceso remoto a la PC de Novedades Kaory, definir de forma **persistente** (no sólo en la sesión actual):

```
ATLAS_AGENT_ORIGINS=https://app.atlasone.com.mx,https://prod-test.atlasone.com.mx,https://atlas-one.up.railway.app
```

Se dejan los tres: el de Railway para que hoy siga imprimiendo, el de ensayo para las pruebas y el definitivo para después del corte. Así esta tarea no rompe nada por sí sola.

- [ ] **Step 2: Reiniciar el agente**

Detener y volver a levantar el agente de impresión por el mecanismo con el que esté instalado en esa máquina (servicio, tarea programada o acceso directo).

- [ ] **Step 3: Verificar la configuración cargada**

Confirmar en la salida o en el registro del agente que los tres orígenes aparecen en su configuración activa. Que la variable exista en el sistema no garantiza que el proceso la haya leído.

- [ ] **Step 4: Imprimir de verdad desde Railway**

En `https://atlas-one.up.railway.app`, cobrar una venta de prueba y **confirmar que el ticket sale físicamente de la impresora**. Esto verifica que el cambio no rompió lo que hoy funciona.

- [ ] **Step 5: Imprimir de verdad desde el ensayo**

En `https://prod-test.atlasone.com.mx`, cobrar una venta de prueba y **confirmar que el ticket sale físicamente**. Esto es lo que demuestra que el corte no dejará a la tienda sin tickets.

**Criterio de salida:** dos tickets impresos en papel, uno desde cada dirección. Sin ambos, el corte no procede.

---

### Task 8: Respaldo de la nueva base

**Files:**
- Ninguno nuevo: `/srv/backups/pg_backup.sh` ya recorre todas las bases del Postgres compartido.

**Interfaces:**
- Produces: `atlas_one_prod` incluida en el respaldo diario, verificada por restauración.

- [ ] **Step 1: Forzar un respaldo inmediato**

```bash
ssh ionos '/srv/backups/pg_backup.sh && ls -lh /srv/backups/atlas_one_prod_*.dump | tail -3'
```

Esperado: aparece un `.dump` de `atlas_one_prod` de varios megabytes.

- [ ] **Step 2: Probar que el respaldo se puede restaurar**

Un respaldo que nunca se restauró no es un respaldo.

```bash
ssh ionos 'DUMP=$(ls -t /srv/backups/atlas_one_prod_*.dump | head -1)
docker exec postgres psql -U postgres -c "CREATE DATABASE restore_test"
docker exec -i postgres pg_restore -U postgres -d restore_test --no-owner --no-privileges < "$DUMP" 2>&1 | tail -5
docker exec postgres psql -U postgres -d restore_test -tAc "SELECT count(*) FROM sales_documents WHERE organization_id=14"
docker exec postgres psql -U postgres -c "DROP DATABASE restore_test"'
```

Esperado: el conteo coincide con el de producción, y la base de prueba se borra al final.

---

### Task 9: El corte

Se ejecuta con la tienda cerrada, después de las 20:00 hora de México, y sólo si las tareas 1 a 8 están completas y la Task 7 dejó dos tickets impresos.

**Files:**
- Modify en el VPS: `/srv/caddy/Caddyfile`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `app.atlasone.com.mx` sirviendo `atlas-one-prod` y `demo.atlasone.com.mx` sirviendo la instancia demo.

- [ ] **Step 1: Confirmar que nadie está capturando**

Avisar a Kaory que no se registren ventas a partir de ese momento y confirmar que la terminal está cerrada.

- [ ] **Step 2: Dump fresco y restauración desde cero**

Repetir los pasos 1 a 6 de la Task 4 completos: dump nuevo, conteos del origen, **recrear la base** (`DROP DATABASE atlas_one_prod` y volver a crearla con el rol `atlas_prod` como dueño), restaurar, purgar demos, verificar y ceder propiedad. No es una actualización incremental; es un reemplazo.

- [ ] **Step 3: Volver a subir la versión**

Repetir los pasos 1 a 3 de la Task 5: arrancar, `scripts/migrate.py`, verificar conteos.

- [ ] **Step 4: Mover los dominios en Caddy**

En `/srv/caddy/Caddyfile`, cambiar el destino del bloque de `app.atlasone.com.mx` de `atlas-one-beta:8000` a `atlas-one-prod:8000`, y agregar un bloque nuevo:

```
# Instancia demo / QA
demo.atlasone.com.mx {
	encode zstd gzip
	reverse_proxy atlas-one-beta:8000
}
```

Recargar:

```bash
ssh ionos 'cd /srv/caddy && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile && echo recargado'
```

- [ ] **Step 5: Verificar ambos dominios**

```bash
curl -sS -o /dev/null -w "app  %{http_code}\n" https://app.atlasone.com.mx/docs
curl -sS -o /dev/null -w "demo %{http_code}\n" https://demo.atlasone.com.mx/docs
```

Esperado: `200` en ambos.

- [ ] **Step 6: Apuntar la terminal de la tienda**

En la PC de Kaory, cambiar el acceso directo o la página de inicio de `https://atlas-one.up.railway.app` a `https://app.atlasone.com.mx`.

- [ ] **Step 7: Prueba de humo con la operadora**

Con Kaory presente o por acceso remoto:

1. Iniciar sesión en `https://app.atlasone.com.mx` con su usuario.
2. Cobrar **una venta real**.
3. **Confirmar que el ticket sale impreso.**
4. Abrir y cerrar un corte de caja.
5. Consultar un reporte del histórico.

- [ ] **Step 8: Dejar Railway encendido**

**No apagar nada de Railway.** Es el retorno: volver son dos líneas del Caddyfile y cambiar el acceso directo de la terminal. Se mantiene al menos una semana de operación normal antes de considerar apagarlo — y aun entonces sigue vivo por la base de `rmazh`, que está fuera de este alcance.

- [ ] **Step 9: Retirar el subdominio de ensayo**

Una vez estable, borrar el bloque de `prod-test.atlasone.com.mx` del Caddyfile, recargar, y borrar el registro `A` de `prod-test` en Cloudflare.

- [ ] **Step 10: Documentar**

Actualizar `docs/infra/deployment-map.md` y `docs/infra/ionos-vps.md` con el destino nuevo, la fecha del corte y el procedimiento de retorno. Commit.

---

### Task 10: Unificar las ramas

Sólo después de que Kaory lleve varios días operando estable en el VPS.

**Files:**
- Ninguno de código. Operación de ramas.

**Interfaces:**
- Produces: `main` igual a `staging`, como tronco único.

- [ ] **Step 1: Desconectar el despliegue automático de Railway**

En el panel de Railway, servicio `atlas-bos`, entorno `production`: desconectar el despliegue automático desde `main`. Sin esto, el fast-forward reconstruye el Railway de producción.

- [ ] **Step 2: Verificar que el fast-forward sigue siendo limpio**

```bash
git fetch origin
git merge-base --is-ancestor origin/main origin/staging && echo "FF limpio" || echo "DIVERGIERON"
```

Si dice `DIVERGIERON`, detenerse y resolver antes de continuar.

- [ ] **Step 3: Hacer el fast-forward**

```bash
git checkout main
git merge --ff-only origin/staging
git push origin main
```

- [ ] **Step 4: Verificar**

```bash
git log -1 --oneline origin/main
git log -1 --oneline origin/staging
```

Esperado: el mismo identificador en ambas.

- [ ] **Step 5: Actualizar la documentación de ramas**

Reflejar en `docs/branching-strategy.md` que `main` es el tronco de producción y `staging` vuelve a ser la rama de pruebas.

---

## Planes que faltan

Estas fases del spec no están en este plan y necesitan el suyo:

- **Fase C — clientes nuevos:** `scripts/onboard_org.py` y la auditoría de aislamiento entre organizaciones, que es prerequisito del segundo cliente en la base compartida.
- **Fase D — observabilidad completa:** Prometheus, Grafana, Loki, exportadores y Alertmanager. La Task 6 de este plan es sólo el piso mínimo.
- **Fase E — endurecimiento:** reinicio pendiente, respaldos fuera del servidor, límite de registros de Docker, swap, volúmenes huérfanos, límites por contenedor, zombies de HRFlow.
- **Fase F — plantilla de servicios nuevos.**
