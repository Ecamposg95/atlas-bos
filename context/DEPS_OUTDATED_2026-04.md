# Dependencies outdated — snapshot 2026-04-24

Baseline de Sprint 0 (tech-debt roadmap). Revisar progreso en Sprint 9 (refresh deps).

---

## Frontend (`frontend/`)

Comando: `cd frontend && npm outdated`

| Paquete | Current | Wanted | Latest | Severidad upgrade | Notas |
|---|---|---|---|---|---|
| `@types/react` | 18.3.28 | 18.3.28 | 19.2.14 | Major | Atado a react@18 |
| `@types/react-dom` | 18.3.7 | 18.3.7 | 19.2.3 | Major | Atado a react@18 |
| `@vitejs/plugin-react` | 4.7.0 | 4.7.0 | 6.0.1 | Major | Compat con Vite 7 |
| `axios` | 1.15.0 | 1.15.2 | 1.15.2 | Patch | Seguro |
| `postcss` | 8.5.9 | 8.5.10 | 8.5.10 | Patch | Seguro |
| `react` | 18.3.1 | 18.3.1 | 19.2.5 | Major | **React 19** — breaking. Evaluar en sprint 9. |
| `react-dom` | 18.3.1 | 18.3.1 | 19.2.5 | Major | Ligado a react |
| `react-router-dom` | 6.30.3 | 6.30.3 | 7.14.2 | Major | **v7** — breaking, nuevo data router API |
| `tailwindcss` | 3.4.19 | 3.4.19 | 4.2.4 | Major | **v4** — nuevo CSS engine, requiere migration guide |
| `typescript` | 5.9.3 | 5.9.3 | 6.0.3 | Major | TS 6 — usualmente compatible salvo casos edge |
| `vite` | 5.4.21 | 5.4.21 | 8.0.10 | Major x3 | Saltos de v6→v7→v8 |
| `zustand` | 4.5.7 | 4.5.7 | 5.0.12 | Major | v5 — API cambios menores |

### Patches inmediatos (sin riesgo) — ejecutar en Sprint 0 si hay tiempo

```
axios 1.15.0 → 1.15.2
postcss 8.5.9 → 8.5.10
```

### Majors para evaluar en Sprint 9

- **React 19** — introducirlo tras cerrar refactors grandes (no mezclar con Jinja decomm o split de routers).
- **Tailwind 4** — el motor CSS cambia; requiere validación de los tokens actuales.
- **React Router 7** — data router API nueva; evaluar si vale el refactor.
- **Vite 5 → 8** — saltos grandes; probar con `vite@7` primero.

---

## Backend (`requirements.txt`)

⚠️ **Pendiente**: no se pudo correr `pip list --outdated` en Sprint 0 porque el venv local no tiene pip instalado. Correr desde un entorno con pip:

```bash
source venv/bin/activate
pip list --outdated > /tmp/pip_outdated.txt
```

Luego actualizar esta sección con el resultado.

### Paquetes pineados conocidos en `requirements.txt`

Snapshot manual:

| Paquete | Pin | Notas |
|---|---|---|
| `fastapi` | 0.127.0 | Major actual |
| `starlette` | 0.50.0 | Atado a fastapi |
| `pydantic` | 2.11.3 | v2 estable |
| `sqlalchemy` | 2.0.x | v2 estable |
| `cryptography` | 44.0.3 | Reciente |
| `jinja2` | 3.1.4 | **Transitive tras Sprint 3/4** — mantener versión pineada |
| `uvicorn[standard]` | 0.34.2 | Reciente |

---

## Objetivos para Sprint 9

1. Aplicar todos los patches (axios, postcss, pip equivalentes) — cero riesgo.
2. Evaluar React 19 con branch experimental.
3. Tailwind 4 — POC paralelo.
4. Actualizar backend deps con `pip-compile` si estable.

---

## Cómo verificar progreso

```bash
cd frontend && npm outdated
```

```bash
source venv/bin/activate && pip list --outdated
```

Comparar contra esta tabla cada sprint hasta cerrar Sprint 9.
