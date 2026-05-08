# Image-via-URL Audit — 2026-04-30

**Status**: Day-1 operational hotfix shipped 2026-04-30 as commit `adc9e002` on all four branches. Remaining items (Day 2 schema validation, Day 3 SSRF allowlist, Day 4 caching/UX) tracked below.

**Scope**: every code path that accepts a user-pasted image URL (`Product.image_url`, `Brand.logo_url`, `Branch.logo_url`, `Organization.logo_url`) and the printer's URL-fetch (`app/pos_printer.py:_generate_image_bytes`).

**Trigger**: PR #198 (`feat/product-image-url-input`, commit `8721c09`) made URL pasting a first-class alternative to file upload. The same shape was already in use for brand / branch / org logos but never audited as a class.

**Methodology**: 2 Explore agents in parallel (backend SSRF + resource handling, frontend XSS + display). Major claims spot-verified by reading the source. One HIGH-severity claim from Agent A debunked as a false positive.

---

## Summary

| Severity | Count | Closed | Open |
|---|---|---|---|
| **CRIT** | 0 | — | — |
| **HIGH** | 4 | 2 ✅ (H-2, H-3) | 2 (H-1, H-4) |
| **MED** | 4 | 1 ✅ (M-1) | 3 (M-2, M-3, M-4) |
| **LOW** | 3 | 1 ✅ (L-2) | 2 (L-1, L-3) |
| **NIT** | 1 | 0 | 1 |
| **False positive** | 2 | — | — |

**Day-1 hotfix shipped (commit `adc9e002`)**: H-2 + H-3 + M-1 + L-2 — the four findings that affect *operations* (worker OOM / decompression bomb / silent slowdown). Remaining items are security defense-in-depth (Day 2-3) and UX polish (Day 4).

The biggest real risks are: **(1)** `pos_printer._generate_image_bytes` fetches arbitrary URLs with no host/IP allowlist, no size cap, and no Pillow decompression-bomb guard — every print is a potential SSRF + OOM; **(2)** schemas accept any string in `image_url`/`logo_url`, so a `javascript:`/`data:`/`file:` URL can be persisted today.

There is **no remote (unauthenticated) attack vector** — every endpoint that writes a URL requires auth, and the org/branch/brand writes require admin role. CAJERO can write `Product.image_url` though, which makes "stored SSRF via printer" reachable to a branch user.

---

## HIGH

### H-1 — `pos_printer._generate_image_bytes` fetches arbitrary URLs with no SSRF protection
**File**: `app/pos_printer.py:680-682`
**Category**: SSRF (stored, auth-required)
**Verified**: ✅
**Issue**: The printer downloads `requests.get(image_path, timeout=8)` whenever a sale or test ticket prints. There is no host/IP validation, no scheme validation beyond the `http(s)://` prefix check, and `requests.get` follows redirects by default — so a public URL can 302 to `169.254.169.254`, `127.0.0.1`, or any RFC1918 address.
**Repro**: an admin sets `branch.logo_url = "https://attacker.example/redirect-to-metadata"` where the attacker server returns `301 Location: http://169.254.169.254/latest/meta-data/iam/security-credentials/`. Each print now leaks instance credentials in `resp.content` (logged on error).
**Fix**:
1. Reject the URL at write-time if the resolved IP is private (DNS lookup + `ipaddress.ip_address(...).is_private`/`is_loopback`/`is_link_local` check).
2. Re-validate at fetch time (DNS rebinding defense): use a custom `requests.adapters.HTTPAdapter` with `socket.create_connection` overridden to check the resolved IP each connect.
3. Disable redirects: `requests.get(url, allow_redirects=False)` and surface 3xx as an error to the admin.
4. Use a fetch helper shared across the codebase so all image fetches inherit the same guard.
**Effort**: M

### ✅ H-2 — No Pillow decompression-bomb guard  *(fixed `adc9e002`)*
**File**: `app/pos_printer.py:682`
**Category**: resource exhaustion (DoS)
**Verified**: ✅ (grep confirmed no `MAX_IMAGE_PIXELS` and no width/height check)
**Issue**: `Image.open(io.BytesIO(resp.content))` happily allocates RAM for a PNG that declares e.g. `100000 × 100000` pixels (~40 GB at RGBA). One malicious logo URL crashes the worker every time it prints.
**Fix**: At the top of the helper:
```python
from PIL import Image
Image.MAX_IMAGE_PIXELS = 25_000_000  # ~25MP cap, plenty for any logo
```
Pillow then raises `Image.DecompressionBombError` for oversized inputs. Combine with H-3 to also bound the on-disk size before decode.
**Effort**: S

### ✅ H-3 — No size cap on the image fetch — full body read into memory  *(fixed `adc9e002`)*
**File**: `app/pos_printer.py:680`
**Category**: resource exhaustion (OOM)
**Verified**: ✅
**Issue**: `requests.get(image_path, timeout=8)` reads the entire response body into memory as `resp.content`. A 200 MB file = 200 MB of resident memory in the worker, repeated on every print attempt. No `Content-Length` check.
**Fix**: stream + chunk + cap:
```python
MAX = 5 * 1024 * 1024  # 5 MB ceiling for any logo
with requests.get(image_path, stream=True, timeout=8, allow_redirects=False) as r:
    r.raise_for_status()
    cl = int(r.headers.get("Content-Length", 0))
    if cl and cl > MAX:
        raise ValueError("logo too large")
    buf = io.BytesIO()
    total = 0
    for chunk in r.iter_content(chunk_size=8192):
        total += len(chunk)
        if total > MAX:
            raise ValueError("logo too large")
        buf.write(chunk)
    im = Image.open(buf)
```
**Effort**: S

### H-4 — All `image_url`/`logo_url` schemas accept any string
**File**: `app/schemas/products.py:69,100,142`, `app/schemas/brands.py:6`, `app/schemas/branches.py:38,75`, `app/schemas/organization.py:18,52`
**Category**: persistence boundary
**Verified**: ✅ (grep showed every field is `Optional[str]`, no `HttpUrl`)
**Issue**: Pydantic accepts `"javascript:alert(1)"`, `"data:image/svg+xml,…<script>…"`, `"file:///etc/passwd"` into the field — they end up in DB and can later be rendered or fetched.
**Fix**: switch the field type to `Optional[HttpUrl]` (Pydantic v2 has it under `pydantic.HttpUrl`). For migration safety, add a custom validator first that allows existing rows but rejects new writes outside `http://` / `https://`. Reject URLs whose host is in a private IP block (overlaps with H-1's write-time check; share the helper).
**Effort**: S code change, M to migrate any pre-existing bad data (probably none — but check).

---

## MEDIUM

### ✅ M-1 — No `Content-Type` check after fetch  *(fixed `adc9e002`)*
**File**: `app/pos_printer.py:680-682`
**Category**: content-type bypass (defensive)
**Verified**: ✅
**Issue**: After `raise_for_status()` the code passes bytes to Pillow without verifying `resp.headers["Content-Type"]` is an image. Cosmetic on its own (Pillow will raise on non-image), but combined with H-3 (no size cap) it lets an attacker burn worker memory before the decode rejection.
**Fix**: assert `r.headers.get("Content-Type", "").startswith("image/")` right after `raise_for_status()`.
**Effort**: S

### M-2 — No URL caching → every print refetches
**File**: `app/pos_printer.py:680`
**Category**: cost / cross-system
**Verified**: ✅
**Issue**: Every `build_ticket_bytes` call re-downloads the logo. Fast for a sub-100KB image; painful on a slow CDN or on-prem mirror. A malicious-but-slow URL can also slow every ticket by up to 8 s.
**Fix**: cache the rasterized bitmap by URL hash + ETag/Last-Modified header. TTL ~24 h. The `_default_font` already lives on the printer instance — cache there or in a module-level LRU.
**Effort**: M

### M-3 — Synchronous `<img src={typedUrl}>` preview on every keystroke
**File**: `frontend/src/pages/core/Brands.tsx:125-128`, `frontend/src/components/branch/ProductsBranchView.tsx:687,724-730`
**Category**: preview cost
**Verified**: ✅
**Issue**: As the admin types the URL, the `<input>` updates state on every keystroke, which triggers `<img src={form.logo_url}>` to load a new URL each time. A slow URL or large image makes the form feel broken. Also fires repeated network requests against arbitrary servers.
**Fix**: debounce 400 ms before updating the preview src (separate `previewUrl` state), or move the preview behind a "Vista previa" button. Either is fine.
**Effort**: S

### M-4 — `<input type="url">` is not a security boundary
**File**: same admin forms as M-3 + `frontend/src/pages/platform/PlatformOrganizations.tsx:805`
**Category**: validation
**Verified**: ✅
**Issue**: HTML5 `type="url"` accepts `javascript:alert(1)` and `data:` URLs because they're syntactically valid URLs. The frontend has no scheme check before save; every protection has to come from the backend (which today has none — see H-4).
**Fix**: client-side `onChange` runs `try { const u = new URL(v); if (!/^https?:$/.test(u.protocol)) return reject; } catch { ... }`. Defense in depth, not a substitute for H-4.
**Effort**: S

---

## LOW

### L-1 — `<img src=...>` is the only render path today, but not enforced
**File**: code-wide convention
**Category**: display (future-proofing)
**Verified**: ✅ (grep'd all uses; only `<img>` and `style={{backgroundImage: url(${u})}}` patterns appear)
**Issue**: `<img src="javascript:…">` is ignored by every modern browser, so the current usage is safe. But there's no enforcement — a future component could render `<a href={product.image_url}>` and reintroduce XSS.
**Fix**: add a comment in the schemas and a one-line entry in `frontend/src/CONVENTIONS.md` (if it exists, else as a note in the audit) saying "image_url / logo_url MUST only be used as `<img src>` / `srcset` / `background-image: url(...)`. Do not place in `href`, `srcset`, `iframe.src`, `embed.src`, `<script src>`, or any JS-evaluating context."
**Effort**: S (documentation)

### ✅ L-2 — Print-agent timeout cascade  *(fixed `adc9e002` — 8s → 5s)*
**File**: `app/pos_printer.py:680`
**Category**: ops
**Verified**: ✅
**Issue**: `timeout=8` per print. If the URL is unreachable but reachable-then-slow, every ticket waits 8 s. Cashiers will perceive this as "POS roto".
**Fix**: lower the per-print timeout to 3 s once the cache from M-2 lands; the first print absorbs the cost, subsequent prints are instant.
**Effort**: S after M-2.

### L-3 — No size hint at write time
**File**: schemas + admin forms
**Category**: cost
**Verified**: ✅
**Issue**: Admin can paste a URL pointing at a 200 MB image; every page render downloads it. No size hint in the UI ("imágenes recomendadas ≤500 KB").
**Fix**: add the hint text under the URL input + a backend HEAD request at write time to surface large images as a warning (not a hard reject).
**Effort**: M

---

## NIT

### N-1 — No request pooling / keep-alive in the printer fetch
`app/pos_printer.py:680` — uses bare `requests.get` per call. Trivial to switch to a module-level `requests.Session` once H-1's adapter is in place. Negligible perf impact today.

---

## False positives (reported by agents, debunked by re-reading source)

### ⚠️ FP-1 — "Org update RBAC bypass: `require_admin()` is a no-op"
Agent A claimed `app/routers/organization.py:66-80` lets a CAJERO smuggle `logo_url` into the org update because `require_admin()` "logs but does NOT raise". **Verified false**: `require_admin()` at line 32-38 raises `HTTPException(403)` for any non-ADMIN/DUEÑO/SUPERADMIN. The call at line 77 inside the change-detection loop short-circuits the request before reaching the setattr loop on line 79. The code is correct — the `print(f"[AUTH BLOCK] …")` is informational logging that runs immediately before the raise.

### ⚠️ FP-2 — "Unauthenticated SSRF via Product.image_url"
Agent A graded the create-product endpoint as CRIT/unauth. Reality: every Atlas router lives under `Depends(require_module(...))` and `Depends(get_current_user)`. The SSRF is **stored & authenticated**, not remote — graded HIGH (H-1) above.

---

## Recommended sprint shape

**Day 1 hotfix** (S, ~2 h): H-2 + H-3 + M-1 — three small edits on `_generate_image_bytes` (Pillow cap + streaming download with size guard + content-type check). One PR, immediate risk reduction without changing storage semantics.

**Day 2** (S, ~3 h): H-4 — switch all `image_url`/`logo_url` Pydantic fields to `HttpUrl` + add a validator that rejects private-IP hosts. Covers `Product`, `Brand`, `Branch`, `Organization`.

**Day 3** (M, half-day): H-1 + M-4 — host/IP allowlist helper used by both write-time validation and the printer fetch. Custom HTTPAdapter for DNS-rebinding defense. Frontend `URL` constructor scheme guard.

**Day 4** (M, half-day): M-2 + M-3 + L-2 — caching + preview debounce. Quality-of-life, no new attack surface change.

**Deferred**: L-1 (docs), L-3 (size hint), N-1 (pooling).

---

## Out of scope

- Cloudinary signed URL semantics (haven't audited whether tenants share namespaces).
- File-upload paths (`/api/org/logo`, `/api/branches/{id}/logo`) — they validate `file.content_type` and a size derived from `await file.read()`. They can OOM on giant files but that's a different audit.
- The actual contents of an SVG when delivered as `data:image/svg+xml`. Not relevant for this codebase since the printer rejects SVG explicitly (see comment at `app/routers/organization.py:103-106`); HTTP fetch + Pillow decode would also reject SVG.
