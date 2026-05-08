# Creating Additional SUPERADMINs

The `POST /api/platform/admins` endpoint creates platform admins directly—no email invitation is sent. The caller receives the temp password, which they must communicate to the new admin via secure channel.

## Who Can Create SUPERADMINs

Only existing SUPERADMINs (enforced by the `require_platform_admin` guard and explicit `platform_role == SUPERADMIN` check).

## How to Create One

### Via UI (`/platform/admins`)

1. Navigate to **Platform / Admins** in the sidebar (SUPERADMIN only).
2. Click **Invitar admin** (top right).
3. Fill in the invite drawer:
   - **Email**: Required. Will become the admin's username (stripped of domain).
   - **Nombre completo**: Optional. Defaults to email if not provided.
   - **Rol de plataforma**: `SUPERADMIN` or `SUPPORT`. See the role descriptions in the UI.
4. Click **Invitar**.
5. A modal appears showing the generated **temp_password**. Copy it and deliver it to the new admin via secure channel (Slack, WhatsApp, in-person, etc.).
   - The password is **not stored in plain text**. If you close the modal without copying, you must generate a new one.
6. The admin now appears in the table with status **Active**.

### Via API

```bash
curl -X POST http://localhost:8000/api/platform/admins \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-superadmin-token>" \
  -d '{
    "email": "newadmin@example.com",
    "full_name": "Nuevo Admin",
    "platform_role": "SUPERADMIN"
  }'
```

**Response:**
```json
{
  "id": 42,
  "email": "newadmin@example.com",
  "temp_password": "generated-base64-string",
  "platform_role": "SUPERADMIN"
}
```

You must relay the `temp_password` to the new admin out-of-band.

### Optional: Provide Your Own Temp Password

To bypass random generation and set a custom temp password:

```bash
curl -X POST http://localhost:8000/api/platform/admins \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-superadmin-token>" \
  -d '{
    "email": "newadmin@example.com",
    "full_name": "Nuevo Admin",
    "platform_role": "SUPERADMIN",
    "temp_password": "MyCustomPassword123!"
  }'
```

The password is hashed immediately; it is not stored in plain text.

## After Creation

- The new SUPERADMIN logs in with their email and the temp password.
- On first login, they may be prompted to change the password (depending on your change-password flow).
- They immediately have access to all SUPERADMIN routes under `/platform/*`.
- Their actions are audited. Visit their row in the admins table and click to view their audit trail.

## Role Definitions

- **SUPERADMIN**: Full access to all SUPERADMIN pages (`/platform/*`). Can create, change roles, and revoke other admins.
- **SUPPORT**: Cross-tenant read-only access. Can view org/user/incident/alert data. Cannot modify anything.
- **NONE**: Revokes platform access entirely. The user account remains in their organization (if any).

## Troubleshooting

- **"Email ya registrado"**: The email already exists in the system. Use a different email or change the existing user's email first.
- **"Solo SUPERADMIN puede invitar admins"**: You must be logged in as a SUPERADMIN. SUPPORT users cannot create new admins.
- **Lost the temp password?**: Click the admin's row → change their password from the Users section, or revoke + recreate them.
