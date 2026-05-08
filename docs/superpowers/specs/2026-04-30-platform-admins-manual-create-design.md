# Platform Admins — Manual Create — Design Spec

**Date:** 2026-04-30
**Owner:** Emmanuel
**Status:** Ready for implementation
**Target branch:** feature branch → release/qa

**Target files:**

| Layer | File |
|---|---|
| Backend router | `app/routers/platform/admins.py` |
| Backend schema | inline `BaseModel` in router (no separate `app/schemas/platform.py` exists) |
| Frontend API | `frontend/src/api/platform.ts` |
| Frontend page | `frontend/src/pages/platform/PlatformAdmins.tsx` |

---

## 1. Motivation

The existing `POST /api/platform/admins` (line 48, `invite_platform_admin`) generates a random `temp_password` and returns it in the response body for manual delivery. This is adequate for async onboarding but breaks in two cases: (a) the SUPERADMIN is creating their own test/staging accounts and does not want to shuttle a random token around, and (b) ops teams want to set a known credential immediately so the new admin can log in from a prepared device without any copy-paste step. The invite flow stays untouched — this spec adds a parallel endpoint and modal that let the SUPERADMIN dictate the password at creation time.

---

## 2. UX — Modal "Crear admin manualmente"

The new button sits in the same `headerActions` fragment in `PlatformAdmins.tsx` (line 442) next to "Invitar admin". It opens an inline modal (not a `SideDrawer`) to visually distinguish it from the invite drawer.

```
┌─────────────────────────────────────────────────────┐
│  Crear admin manualmente                        [X]  │
├─────────────────────────────────────────────────────┤
│  EMAIL *                                            │
│  ┌─────────────────────────────────────────────┐   │
│  │ admin@empresa.com                           │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  NOMBRE COMPLETO                                    │
│  ┌─────────────────────────────────────────────┐   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ROL DE PLATAFORMA                                  │
│  ┌─────────────────────────────────────────────┐   │
│  │ SUPPORT                              ▾      │   │
│  └─────────────────────────────────────────────┘   │
│  SUPPORT: lectura cross-tenant.                     │
│  SUPERADMIN: acceso total a /platform/*.            │
│                                                     │
│  PASSWORD *                                         │
│  ┌─────────────────────────────────────────────┐   │
│  │ ••••••••••                          [ver]   │   │
│  └─────────────────────────────────────────────┘   │
│  Fortaleza: [████████░░] Buena                      │
│  Min 8 chars · al menos 1 letra · al menos 1 número│
│                                                     │
│  CONFIRMAR PASSWORD *                               │
│  ┌─────────────────────────────────────────────┐   │
│  │ ••••••••••                          [ver]   │   │
│  └─────────────────────────────────────────────┘   │
│  ✗ Las contraseñas no coinciden   (inline, red)     │
│                                                     │
│              [Cancelar]  [Crear admin ─ disabled]   │
└─────────────────────────────────────────────────────┘
```

**Validation gates (button enables only when all pass):**
1. `email` matches `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
2. `password.length >= 8` AND `/[a-zA-Z]/.test(password)` AND `/[0-9]/.test(password)`
3. `password === confirm_password`

Strength indicator: 0-2 rules met = Débil (red), 3 rules + length >= 12 = Fuerte (green), otherwise Buena (amber). Pure client-side; no library needed.

On success: toast verde "Admin `<email>` creado", modal closes, `load()` fires to refresh the table. No temp-password display — the admin knows their own password.

---

## 3. API Contract

### `POST /api/platform/admins/manual`

**Auth:** Bearer JWT. Caller must have `platform_role == SUPERADMIN`. Returns 403 otherwise.

**Request body:**
```json
{
  "email": "ops@atlas.mx",
  "full_name": "Ops Atlas",
  "platform_role": "SUPPORT",
  "password": "Atlas2024!"
}
```

**Success — 200:**
```json
{
  "user_id": 42,
  "email": "ops@atlas.mx",
  "platform_role": "SUPPORT",
  "created_at": "2026-04-30T10:00:00"
}
```

**Error responses:**

| Status | Condition |
|---|---|
| 403 | `current_user.platform_role != SUPERADMIN` |
| 422 | `platform_role` not in `("SUPERADMIN", "SUPPORT")` |
| 422 | email already exists in `User` table |
| 400 | password fails policy: `len < 8` OR no letter OR no digit |

---

## 4. Backend Changes

### `app/routers/platform/admins.py`

Add after line 21 (the existing `AdminRoleChange` class):

**New schema class `PlatformAdminManualCreate`** — inline `BaseModel` with fields `email: str`, `full_name: Optional[str]`, `platform_role: str`, `password: str`. No `Optional` on `password`.

**New endpoint `create_platform_admin_manual`** — `@router.post("/admins/manual")`. Implementation mirrors `invite_platform_admin` (lines 48–79) exactly, except:

- No `secrets.token_urlsafe` — use `body.password` directly.
- Password policy check (length, letter, digit) raises `HTTPException(400, ...)` before hashing.
- `get_password_hash(body.password)` (already imported at line 10).
- `write_audit` action string: `"CREATE_ADMIN_MANUAL"`.
- Return shape: `{"user_id": user.id, "email": user.email, "platform_role": body.platform_role, "created_at": user.created_at.isoformat() if user.created_at else None}`.

The `User` constructor call, `db.flush()`, `write_audit`, `db.commit()` sequence is identical to the invite path. No new imports needed beyond what line 10 already provides.

---

## 5. Frontend Changes

### `frontend/src/api/platform.ts`

Add two items to the `platformApi` object after `revokePlatformAdmin`:

**New interface** `PlatformAdminManualCreatePayload` with fields `email`, `full_name` (optional), `platform_role`, `password`.

**New interface** `PlatformAdminManualCreateResponse` with fields `user_id`, `email`, `platform_role`, `created_at`.

**New method** `createPlatformAdminManual(body)` — `client.post('/platform/admins/manual', body).then(r => r.data)`.

### `frontend/src/pages/platform/PlatformAdmins.tsx`

**State additions** (after `revoking` state, ~line 218):
- `manualOpen: boolean`
- `manualForm: { email, full_name, password, confirm_password, platform_role }`
- `manualCreating: boolean`
- `showManualPwd: boolean`, `showManualConfirm: boolean` (toggle password visibility)

**Derived validation** via `useMemo`:
- `manualPwdValid`: `len >= 8 && /[a-zA-Z]/.test(pwd) && /[0-9]/.test(pwd)`
- `manualEmailValid`: regex test
- `manualMatch`: `password === confirm_password`
- `manualCanSubmit`: all three true

**`handleManualCreate` async function** — calls `platformApi.createPlatformAdminManual(...)`, on success: `toast.success(...)`, `setManualOpen(false)`, `load()`. On error: `toast.error(err?.response?.data?.detail || 'Error al crear admin')`.

**`headerActions` fragment** (line 442) becomes two buttons: existing "Invitar admin" + new "Crear admin manualmente" (secondary style, `buttonSecondary` token already defined at line 53).

**Inline modal** — same pattern as the existing `inviteResult` modal (lines 541–627): fixed overlay, centered card, `width: 480`, `border: '1px solid var(--p-border)'`, `borderTop: '2px solid var(--p-teal)'`. Fields render using `inputStyle` and `labelStyle` tokens already defined in the file (lines 17–37). Strength bar is a `div` with `width` set to `${strengthPct}%` in `var(--p-teal)` / amber / red per score.

---

## 6. Affected Files

| File | Change |
|---|---|
| `app/routers/platform/admins.py` | +1 schema class, +1 endpoint (~35 LOC) |
| `frontend/src/api/platform.ts` | +2 interfaces, +1 method (~12 LOC) |
| `frontend/src/pages/platform/PlatformAdmins.tsx` | +state vars, +handler, +modal JSX, update `headerActions` (~120 LOC) |

No migrations. No new tables. No feature flag.

---

## 7. Testing Strategy

**Backend — 1 integration test** in `tests/test_platform_admins_manual.py`:

1. Authenticate as SUPERADMIN, `POST /api/platform/admins/manual` with valid payload → assert 200, `user_id` present.
2. Same request again (duplicate email) → assert 422.
3. Payload with `password = "abc"` (fails policy) → assert 400.
4. Authenticate as SUPPORT user, same POST → assert 403.

**Frontend — 1 smoke test (manual)**:

1. Log in as SUPERADMIN on local dev (`npm run dev`).
2. Navigate to `/platform/admins`.
3. Click "Crear admin manualmente", fill form with `test+manual@atlas.mx` / `TestPass1` / `SUPPORT`.
4. Submit → toast verde, modal closes, new row appears in table.
5. Try login with `test+manual@atlas.mx` / `TestPass1` → succeeds.

---

## 8. Out of Scope

- Tenant user creation (already exists at `POST /api/platform/users`).
- Bulk import of platform admins.
- Password reset for existing admins (separate feature).
- Email notification on manual creation (by design — the SUPERADMIN knows the password).

---

## 9. Rollout

Single PR against `release/qa`. No migrations. No feature flag. No downtime. Promote through normal merge freeze windows per branching policy.
