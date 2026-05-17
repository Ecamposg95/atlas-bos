# CI/CD — Setup y operación

Este documento describe el workflow de GitHub Actions (`.github/workflows/ci.yml`) y cómo operarlo en el día a día.

## ¿Qué corre el CI?

Cada push (a cualquier rama) y cada PR contra `main` dispara tres jobs en paralelo:

| Job                  | Qué hace                                  | Falla si…                                  |
| -------------------- | ----------------------------------------- | ------------------------------------------ |
| `backend-tests`      | `pytest tests/ -v --tb=short` (Python 3.12) | Cualquier test del backend falla           |
| `frontend-typecheck` | `npx tsc --noEmit` dentro de `frontend/` | Hay errores de TypeScript                  |
| `frontend-build`     | `npm run build` dentro de `frontend/`    | Build de Vite rompe (imports, loaders, …) |

Concurrency está activado: si pusheás dos veces seguidas a la misma rama, el run anterior se cancela.

## Branch protection (recomendado, manual)

Hoy el deploy a Railway corre aun si el CI está rojo — el gate es solo *visibilidad*. Para que `main` requiera el check verde antes de mergear:

1. GitHub → **Settings** → **Branches** → **Branch protection rules** → **Add rule**.
2. Branch name pattern: `main`.
3. Activar:
   - **Require a pull request before merging**.
   - **Require status checks to pass before merging**.
   - En “Status checks that are required”, agregar:
     - `Backend tests (pytest)`
     - `Frontend typecheck (tsc --noEmit)`
     - `Frontend build (vite)`
   - **Require branches to be up to date before merging** (opcional pero recomendado).
4. Guardar.

A partir de ahí, ningún PR puede mergear a `main` con un check rojo.

## Correr el workflow localmente (act)

Para iterar sin pushear, podés usar [`act`](https://github.com/nektos/act) (Docker required):

```bash
# Instalar (macOS): brew install act
# Linux: curl https://raw.githubusercontent.com/nektos/act/master/install.sh | bash

# Correr todo el workflow
act push

# Correr solo un job
act -j backend-tests
```

`act` usa imágenes Docker que emulan `ubuntu-latest`. Nota: el cache de pip/npm no se reusa entre runs locales.

## Qué hacer cuando el CI rompe en `main`

Dos opciones, según el caso:

- **Fix-forward** (preferido cuando el fix es chico y obvio): abrí un PR con la corrección, dejá que el CI valide, mergeá.
- **Revertir** (cuando el fix no es obvio o urge un main verde): `git revert <sha>` del commit ofensor y pushealo. Después tomate tiempo de investigar y volver a aplicar el cambio bien.

Regla práctica: si el fix toma más de 15 minutos, revertí primero y arreglá en una rama aparte.

## Próximos pasos (no implementados todavía)

- Job de lint (ruff/eslint) cuando definamos la config.
- Coverage report subiendo a Codecov o similar.
- Bloquear el deploy de Railway con un check `SAFE_TO_DEPLOY` que dependa del CI verde.
