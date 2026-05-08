# Alembic — Atlas BOS

This directory holds Alembic migrations for the Atlas BOS backend. The current
database schema is created at boot via `Base.metadata.create_all(...)`; Alembic
sits alongside that path until we cut over to migration-driven schema management
(Phase 2 / S0.0 of `context/PHASE_2_BACKEND_MODULARIZATION.md`).

`env.py` reads the SQLAlchemy URL from `app.core.database` (which loads
`DATABASE_URL` from the environment / `.env`), so migrations always target the
same DB the app talks to. Models are auto-discovered by importing `app.models`,
which registers every mapper against `Base.metadata`.

## Layout

```
alembic.ini             # config (script_location, file_template, logging)
alembic/
  env.py                # bootstraps sys.path + imports app models
  script.py.mako        # template used by `alembic revision`
  versions/             # one .py file per migration (empty for now)
  README.md             # this file
```

## How to finalize the baseline migration

These steps must be run interactively with the user's venv against the target
database. The orchestrator does NOT run them.

### 1. Activate venv and install dependencies

```bash
# from repo root
python -m venv .venv          # if you don't have one
source .venv/bin/activate     # Linux/macOS
# .venv\Scripts\activate      # Windows
pip install -r requirements.txt
```

### 2. Generate the baseline migration

This compares the current DB schema (whatever your `DATABASE_URL` points at)
against `Base.metadata` and emits a `.py` file in `alembic/versions/`:

```bash
alembic revision --autogenerate -m "baseline schema"
```

**Run this against the existing production-shaped DB** (or a recent dump
restored locally), so the captured schema matches what's in production.

### 3. REVIEW the generated file before applying

Open the new `alembic/versions/<timestamp>_<rev>_baseline_schema.py` and read
it end to end. Autogenerate is *not* perfect — it will sometimes propose to
DROP and recreate tables it doesn't recognize (e.g. tables that exist in the
DB but not in `Base.metadata`, or vice-versa). For a true baseline you usually
want the migration to be a no-op against the live DB: it should describe the
schema that already exists. If autogenerate proposes destructive changes,
either:

- delete those `op.drop_table(...)` / `op.drop_column(...)` calls if the
  table/column should stay, or
- mark the migration as already applied without running it (see step 4b).

### 4a. Apply the migration to a fresh DB

For a brand-new environment with no schema yet:

```bash
alembic upgrade head
```

### 4b. Stamp the baseline on an existing DB (no-op apply)

If your production DB already has the schema captured by the baseline (the
common case), you do NOT want Alembic to run `CREATE TABLE` again. Instead,
mark the revision as already applied:

```bash
alembic stamp head
```

This writes the current revision into the `alembic_version` table without
executing any DDL.

### 5. Day-to-day commands

```bash
alembic current              # which revision is the DB at
alembic history              # full revision history
alembic upgrade head         # apply all pending migrations
alembic downgrade -1         # roll back the most recent migration
alembic revision -m "msg"    # new empty migration (manual edits)
alembic revision --autogenerate -m "msg"   # diff Base.metadata vs DB
```

Migration files live in `alembic/versions/`. Commit them like any other code.
