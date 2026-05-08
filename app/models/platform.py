from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.sql import func
from app.core.database import Base


class PlatformAuditLog(Base):
    __tablename__ = "platform_audit_log"

    id = Column(Integer, primary_key=True, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Superadmin who performed action
    action = Column(String, index=True, nullable=False)  # e.g. "UPDATE_ORG_INDUSTRY", "TOGGLE_MODULE"
    entity_type = Column(String, index=True)  # "ORGANIZATION", "MODULE", "USER"
    entity_id = Column(String)  # ID as string for flexibility
    payload = Column(Text, nullable=True)  # JSON details

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PlatformAlert(Base):
    """Anomaly/alert inbox for the platform superadmin (Sprint 1 · A3).

    Rows are emitted by the alerts scanner (see POST /api/platform/alerts/scan)
    when it detects things like revenue drops or orgs with no sales in 24h.
    """
    __tablename__ = "platform_alert"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), index=True, nullable=False)
    severity = Column(String, index=True, nullable=False)  # 'critical' | 'warning' | 'info'
    kind = Column(String, index=True, nullable=False)      # 'revenue_drop' | 'no_sales_24h' | 'user_churn' | 'custom'
    title = Column(String, nullable=False)
    detail = Column(Text, nullable=True)                   # JSON with z-score, comparison, etc.
    first_seen = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    acked_at = Column(DateTime(timezone=True), nullable=True)
    acked_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint('organization_id', 'kind', 'first_seen', name='uq_alert_org_kind_time'),
    )


class PlatformAnnouncement(Base):
    """Broadcast message from SUPERADMIN to tenants (Sprint 1 · D4).

    Rendered as a banner in tenant pages matching the targeting filters.
    A row with no `published_at` is a draft; if `published_at` is in the
    past and `expires_at` is in the past, it is expired.
    """
    __tablename__ = "platform_announcement"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    body_md = Column(Text, nullable=False)                 # markdown source
    severity = Column(String, default="info", index=True)  # info|warning|critical|success
    targets_json = Column(Text, nullable=True)             # {"industries":[...], "plans":[...], "org_ids":[...]} or null for ALL
    published_at = Column(DateTime(timezone=True), nullable=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class FeatureFlag(Base):
    """Global feature flag catalog (Sprint 2 · F1).

    Each flag is a boolean capability the platform can toggle per-org.
    Resolution priority at query-time:
      1. `OrgFeatureOverride` row for (org_id, flag_key) — explicit value
      2. `is_killed` — forces off globally (kill-switch)
      3. `rollout_pct` — deterministic bucket by hash(org_id + flag_key) % 100
      4. `default_enabled` — fallback when rollout_pct == 0
    """
    __tablename__ = "feature_flag"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False, index=True)   # snake_case
    description = Column(Text, nullable=True)
    default_enabled = Column(Boolean, default=False, nullable=False)
    rollout_pct = Column(Integer, default=0, nullable=False)         # 0..100; used if override not present
    is_killed = Column(Boolean, default=False, nullable=False)       # kill-switch: always off
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class OrgFeatureOverride(Base):
    """Per-org explicit override for a feature flag (Sprint 2 · F1)."""
    __tablename__ = "org_feature_override"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), index=True, nullable=False)
    flag_key = Column(String, ForeignKey("feature_flag.key"), index=True, nullable=False)
    enabled = Column(Boolean, nullable=False)                       # explicit true/false
    reason = Column(Text, nullable=True)                             # why we override
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    __table_args__ = (
        UniqueConstraint('organization_id', 'flag_key', name='uq_org_flag'),
    )


class PlatformIncident(Base):
    """Temporary suspension scoped by industry/plan/orgs (Sprint 2 · D3).

    A global kill-switch the SUPERADMIN flips to suspend a group of tenants
    during an incident (outage, integration failure, vertical-wide issue).
    The list of orgs that were actually toggled is saved in
    `affected_org_snapshot` so resolution can restore each one precisely.
    """
    __tablename__ = "platform_incident"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    reason = Column(Text, nullable=True)
    scope_type = Column(String, nullable=False, index=True)   # 'industry' | 'plan' | 'org_ids' | 'all'
    scope_value = Column(Text, nullable=True)                  # industry_type, plan name, or comma-separated ids; null for 'all'
    banner_html = Column(Text, nullable=True)                  # optional banner copy (future use)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    started_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True, index=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    affected_org_snapshot = Column(Text, nullable=True)        # JSON array of {id, was_active, was_status} — used to restore


class ApiKey(Base):
    """Server-to-server API key per organization (Sprint 2 · H1).

    Secret is NEVER stored in plaintext — we keep a SHA-256 hash and
    a short prefix (first 8 chars) for display purposes. The full key
    is shown to the SUPERADMIN exactly once at creation time.
    """
    __tablename__ = "api_key"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), index=True, nullable=False)
    name = Column(String, nullable=False)                           # human label
    prefix = Column(String, nullable=False, index=True)             # e.g. "atlas_ab12cd34"
    hashed_key = Column(String, nullable=False, unique=True)        # sha256(full key) hex
    scopes = Column(Text, nullable=True)                            # JSON array of scopes
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    last_used_ip = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True, index=True)
    revoked_by = Column(Integer, ForeignKey("users.id"), nullable=True)
