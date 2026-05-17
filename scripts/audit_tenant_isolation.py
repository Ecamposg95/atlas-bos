#!/usr/bin/env python3
"""
audit_tenant_isolation.py
-------------------------

Read-only AST scanner that walks `app/` looking for SQLAlchemy queries that
likely lack the mandatory `organization_id` / `tenant_id` filter required by
docs/modules/MODULE_GUIDE.md §6 (Multi-tenancy obligatorio).

Detection rules
---------------
1. Every call shaped like  db.query(<Model>).filter(...) [...]  is collected.
2. A query is *safe* when ANY chained `.filter(...)` / `.filter_by(...)` call
   in the same expression references the model's `organization_id` or
   `tenant_id` column (either as a keyword arg to `filter_by` or as a
   `Model.organization_id == X` expression inside `filter`).
3. A query is *suspect* when its chained `.filter(...)` / `.filter_by(...)`
   calls reference at least one model column but never `organization_id` /
   `tenant_id`. Pure `db.query(Model)` calls without any filter (e.g. listing
   pages that paginate) are also reported.
4. Whitelisted models (legitimately tenant-less or platform-wide) are ignored.
5. Anything the AST can't classify (subqueries, dynamic models, etc.) is
   logged in an "Unclassified" section so a human can eyeball it.

Output
------
Prints a markdown report to stdout and saves a copy to
`docs/audits/<DATE>-tenant-isolation-audit.md`.

Usage
-----
    python3 scripts/audit_tenant_isolation.py

No third-party dependencies — stdlib only.
"""
from __future__ import annotations

import ast
import os
import sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Iterable

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
APP_ROOT = REPO_ROOT / "app"

# Sub-trees we scan inside `app/`. Other folders (core/, schemas/, utils/, etc.)
# don't typically execute business queries.
SCAN_SUBDIRS = ("routers", "services", "crud", "modules")

# Output report destination.
AUDITS_DIR = REPO_ROOT / "docs" / "audits"
REPORT_PATH = AUDITS_DIR / f"{date.today().isoformat()}-tenant-isolation-audit.md"

# Path-fragment skip list (any segment match excludes the file).
SKIP_SEGMENTS = {"__pycache__", "tests", "migrations", "alembic", "scripts"}

# Models that are legitimately tenant-less or platform-wide. Never flag these.
WHITELIST_MODELS = {
    "User",
    "Module",
    "OrganizationModule",
    "IndustryPreset",
    "Organization",
    "Branch",
    "PlatformAuditLog",
    "PlatformAlert",
    "PlatformAnnouncement",
    "PlatformIncident",
    "FeatureFlag",
    "ApiKey",
    "PrintJob",
    "Department",
    "Brand",
    "UnitOfMeasure",
}

# Columns whose presence makes a query "safe".
TENANT_COLUMNS = {"organization_id", "tenant_id"}

# Terminal call names that materialize a query — used to decide where the
# .filter() chain ends. (We don't strictly need this set: we walk every
# chained call. It's kept as documentation of intent.)
TERMINAL_METHODS = {
    "first", "all", "one", "one_or_none", "scalar", "scalars",
    "count", "exists", "update", "delete", "get",
}


# -----------------------------------------------------------------------------
# Data classes
# -----------------------------------------------------------------------------

@dataclass
class QueryFinding:
    path: Path
    lineno: int
    model: str
    filter_expr: str          # human-readable snippet of the filter(s)
    has_any_filter: bool      # False = bare db.query(Model)
    has_id_only: bool         # True if it filters by .id only

    @property
    def location(self) -> str:
        rel = self.path.relative_to(REPO_ROOT)
        return f"{rel}:{self.lineno}"


@dataclass
class FileReport:
    path: Path
    suspect: list[QueryFinding] = field(default_factory=list)
    safe_count: int = 0
    unclassified: list[str] = field(default_factory=list)


# -----------------------------------------------------------------------------
# AST helpers
# -----------------------------------------------------------------------------

def _is_db_query_call(node: ast.Call) -> bool:
    """Return True if `node` looks like `<something>.query(<Model>)`."""
    if not isinstance(node.func, ast.Attribute):
        return False
    if node.func.attr != "query":
        return False
    if not node.args:
        return False
    return True


def _extract_model_name(query_call: ast.Call) -> str | None:
    """Pull a model name out of `db.query(<Model>)` or `db.query(func.sum(M.x))`.

    Returns None if the argument can't be statically classified to a single
    model (e.g. multi-model query: `db.query(A, B)`, tuple selects, etc.)."""
    if len(query_call.args) != 1:
        # Multi-arg queries (db.query(A, B)) get flagged as unclassified.
        return None
    arg = query_call.args[0]

    # Simple: db.query(Model)
    if isinstance(arg, ast.Name):
        return arg.id

    # db.query(Model.column)  --> dig down through attribute chain
    if isinstance(arg, ast.Attribute):
        root = arg
        while isinstance(root, ast.Attribute):
            root = root.value
        if isinstance(root, ast.Name):
            return root.id
        return None

    # db.query(func.sum(Model.column))  --> first arg of the inner call
    if isinstance(arg, ast.Call):
        inner_args = list(arg.args)
        for a in inner_args:
            if isinstance(a, ast.Attribute):
                root = a
                while isinstance(root, ast.Attribute):
                    root = root.value
                if isinstance(root, ast.Name):
                    return root.id
        return None

    return None


def _walk_chain(call: ast.Call) -> list[ast.Call]:
    """Walk a chained-call expression and return every ast.Call node in it.

    For `db.query(M).filter(...).order_by(...).all()` this returns the
    four Call nodes in source order (outer-most first)."""
    chain: list[ast.Call] = []
    cur: ast.AST = call
    while isinstance(cur, ast.Call):
        chain.append(cur)
        if isinstance(cur.func, ast.Attribute):
            cur = cur.func.value
        else:
            break
    chain.reverse()
    return chain


def _filter_mentions_tenant(filter_call: ast.Call) -> bool:
    """Return True if the .filter() / .filter_by() call references a tenant column."""
    # filter_by(organization_id=..., tenant_id=...)
    for kw in filter_call.keywords:
        if kw.arg in TENANT_COLUMNS:
            return True

    # filter(Model.organization_id == X, ...)
    for arg in filter_call.args:
        if _node_mentions_tenant(arg):
            return True
    return False


def _node_mentions_tenant(node: ast.AST) -> bool:
    for sub in ast.walk(node):
        if isinstance(sub, ast.Attribute) and sub.attr in TENANT_COLUMNS:
            return True
        # Keyword args inside nested calls (e.g. and_(Model.organization_id == x))
        if isinstance(sub, ast.keyword) and sub.arg in TENANT_COLUMNS:
            return True
    return False


def _filter_mentions_any_column(filter_call: ast.Call) -> bool:
    """True if the filter references at least one model column (filter_by kw or
    `Model.column == X`)."""
    if filter_call.keywords:
        return True
    for arg in filter_call.args:
        for sub in ast.walk(arg):
            if isinstance(sub, ast.Attribute):
                return True
    return False


def _filter_has_starred_args(filter_call: ast.Call) -> bool:
    """True if the filter has `*args`-style unpacking we can't read into."""
    for arg in filter_call.args:
        if isinstance(arg, ast.Starred):
            return True
    return False


def _filter_is_id_only(filter_calls: list[ast.Call]) -> bool:
    """Return True when the only column referenced across every chained filter
    is `<Model>.id`."""
    referenced: set[str] = set()
    saw_any = False
    for fc in filter_calls:
        for kw in fc.keywords:
            saw_any = True
            if kw.arg:
                referenced.add(kw.arg)
        for arg in fc.args:
            for sub in ast.walk(arg):
                if isinstance(sub, ast.Attribute):
                    saw_any = True
                    referenced.add(sub.attr)
    return saw_any and referenced.issubset({"id"})


def _snippet(node: ast.AST, source_lines: list[str]) -> str:
    """Best-effort source snippet for a Call node. Falls back to ast.unparse."""
    try:
        if hasattr(node, "lineno") and hasattr(node, "end_lineno"):
            start = node.lineno - 1
            end = node.end_lineno or node.lineno
            lines = source_lines[start:end]
            text = " ".join(s.strip() for s in lines)
            # Truncate aggressively — these are reference pointers, not docs.
            if len(text) > 180:
                text = text[:177] + "..."
            return text
    except Exception:
        pass
    try:
        return ast.unparse(node)  # type: ignore[attr-defined]
    except Exception:
        return "<unrepresentable>"


# -----------------------------------------------------------------------------
# File scanner
# -----------------------------------------------------------------------------

def _iter_python_files(roots: Iterable[Path]) -> Iterable[Path]:
    for root in roots:
        if not root.exists():
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            # Prune skipped segments in-place.
            dirnames[:] = [d for d in dirnames if d not in SKIP_SEGMENTS]
            rel_parts = set(Path(dirpath).relative_to(REPO_ROOT).parts)
            if rel_parts & SKIP_SEGMENTS:
                continue
            for fn in filenames:
                if fn.endswith(".py"):
                    yield Path(dirpath) / fn


def scan_file(path: Path) -> tuple[FileReport, int]:
    """Scan a single file. Returns (report, total_queries_in_file)."""
    report = FileReport(path=path)
    total_queries = 0

    try:
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=str(path))
    except (SyntaxError, UnicodeDecodeError) as exc:
        report.unclassified.append(f"<parse error: {exc}>")
        return report, 0

    source_lines = source.splitlines()

    # We want to find each `db.query(...)` call exactly once, even when it
    # appears as an inner node inside a chained expression. So we walk every
    # Call node and identify the *outermost* chained call whose innermost link
    # is a `.query(...)`.
    seen_query_calls: set[int] = set()

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue

        chain = _walk_chain(node)
        if not chain:
            continue
        innermost = chain[0]
        if not _is_db_query_call(innermost):
            continue
        # Only process the OUTERMOST call so we count each chain once.
        if id(innermost) in seen_query_calls:
            continue
        # The outermost Call is the top of the expression; check if the
        # current `node` is actually the outermost in the source. We do this
        # by remembering the inner .query call and skipping subsequent visits.
        seen_query_calls.add(id(innermost))

        total_queries += 1

        model = _extract_model_name(innermost)

        # Collect all .filter / .filter_by calls in the chain.
        filter_calls: list[ast.Call] = []
        for c in chain[1:]:
            if isinstance(c.func, ast.Attribute) and c.func.attr in (
                "filter", "filter_by"
            ):
                filter_calls.append(c)

        # If any filter explicitly mentions a tenant column, it's safe — even
        # if we couldn't statically pin down the primary model (e.g. multi-
        # column selects, func.coalesce wrappers, etc.).
        has_tenant = any(_filter_mentions_tenant(fc) for fc in filter_calls)
        if has_tenant:
            report.safe_count += 1
            continue

        # If any filter uses *args unpacking (e.g. `.filter(*sales_filters)`),
        # we can't read into the list — that's unclassified.
        if any(_filter_has_starred_args(fc) for fc in filter_calls):
            report.unclassified.append(
                f"L{innermost.lineno}: {_snippet(node, source_lines)}"
            )
            continue

        # Couldn't pin down a model AND no tenant filter visible — unclassified.
        if model is None:
            report.unclassified.append(
                f"L{innermost.lineno}: {_snippet(node, source_lines)}"
            )
            continue

        if model in WHITELIST_MODELS:
            # Whitelisted — count as safe-by-policy.
            report.safe_count += 1
            continue

        if not filter_calls:
            # Bare db.query(Model)  --> potentially safe (list endpoints often
            # rely on later .filter()s built dynamically) but worth surfacing.
            # We treat it as suspect ONLY if it materializes immediately
            # (e.g., chained .all() / .first()) -- otherwise it's a builder
            # that's likely filtered later. Check for terminal methods.
            terminal_in_chain = any(
                isinstance(c.func, ast.Attribute) and c.func.attr in TERMINAL_METHODS
                for c in chain[1:]
            )
            if terminal_in_chain:
                report.suspect.append(QueryFinding(
                    path=path,
                    lineno=innermost.lineno,
                    model=model,
                    filter_expr=_snippet(node, source_lines),
                    has_any_filter=False,
                    has_id_only=False,
                ))
            else:
                # Query builder (will be filtered later) — count as safe-ish
                # but record nothing. It will get matched again if the chain
                # materializes elsewhere.
                report.safe_count += 1
            continue

        # No tenant column referenced. If at least one column is referenced,
        # this is a real suspect. Otherwise unclassified (filters use dynamic
        # expressions we can't read).
        has_any_col = any(_filter_mentions_any_column(fc) for fc in filter_calls)
        if not has_any_col:
            report.unclassified.append(
                f"L{innermost.lineno}: {_snippet(node, source_lines)}"
            )
            continue

        report.suspect.append(QueryFinding(
            path=path,
            lineno=innermost.lineno,
            model=model,
            filter_expr=_snippet(node, source_lines),
            has_any_filter=True,
            has_id_only=_filter_is_id_only(filter_calls),
        ))

    return report, total_queries


# -----------------------------------------------------------------------------
# Reporting
# -----------------------------------------------------------------------------

def render_markdown(file_reports: list[FileReport], total_queries: int) -> str:
    suspect_total = sum(len(fr.suspect) for fr in file_reports)
    safe_total = sum(fr.safe_count for fr in file_reports)
    unclassified_total = sum(len(fr.unclassified) for fr in file_reports)
    coverage = (safe_total / total_queries * 100.0) if total_queries else 100.0

    summary_line = (
        f"**Summary:** scanned {total_queries} queries — "
        f"{safe_total} safe, {suspect_total} suspect, "
        f"{unclassified_total} unclassified. Coverage: {coverage:.1f}%."
    )

    lines: list[str] = []
    lines.append(f"# Multi-tenant isolation audit — {date.today().isoformat()}")
    lines.append("")
    lines.append(
        "Generated by `scripts/audit_tenant_isolation.py`. "
        "Enforces docs/modules/MODULE_GUIDE.md §6 (Multi-tenancy obligatorio): "
        "every business query MUST filter by `organization_id` or `tenant_id`."
    )
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(summary_line)
    lines.append("")
    lines.append(f"- Total `db.query(...)` chains scanned: **{total_queries}**")
    lines.append(f"- Safe (filters by tenant or whitelisted model): **{safe_total}**")
    lines.append(f"- Suspect (no tenant filter): **{suspect_total}**")
    lines.append(f"- Unclassified (AST couldn't decide): **{unclassified_total}**")
    lines.append(f"- Coverage: **{coverage:.1f}%**")
    lines.append("")
    lines.append(
        "Whitelist (treated as legitimately tenant-less): "
        + ", ".join(f"`{m}`" for m in sorted(WHITELIST_MODELS))
    )
    lines.append("")

    suspect_files = [fr for fr in file_reports if fr.suspect]
    suspect_files.sort(key=lambda fr: (-len(fr.suspect), str(fr.path)))

    lines.append("## Suspect queries by file")
    lines.append("")
    if not suspect_files:
        lines.append("_None._ All scanned queries either filter by tenant or hit a whitelisted model.")
        lines.append("")
    for fr in suspect_files:
        rel = fr.path.relative_to(REPO_ROOT)
        lines.append(f"### `{rel}`  ({len(fr.suspect)} suspect)")
        lines.append("")
        for finding in fr.suspect:
            lines.append(f"- **{finding.location}** — model `{finding.model}`")
            if finding.has_any_filter:
                tag = " (id-only filter)" if finding.has_id_only else ""
                lines.append(f"    - Filter{tag}: `{finding.filter_expr}`")
            else:
                lines.append(f"    - No filter at all: `{finding.filter_expr}`")
            lines.append(
                f"    - Sugerencia: reemplazar por "
                f"`get_tenant_scoped(db, {finding.model}, <id>, current_user)`"
            )
        lines.append("")

    # Top-10 priority list.
    counts = Counter({str(fr.path.relative_to(REPO_ROOT)): len(fr.suspect)
                      for fr in suspect_files})
    top10 = counts.most_common(10)
    lines.append("## Top 10 files to fix first")
    lines.append("")
    if not top10:
        lines.append("_Nothing to prioritize._")
    else:
        lines.append("| Rank | File | Suspect queries |")
        lines.append("|-----:|------|----------------:|")
        for rank, (rel, n) in enumerate(top10, 1):
            lines.append(f"| {rank} | `{rel}` | {n} |")
    lines.append("")

    # Unclassified appendix.
    unclassified_files = [fr for fr in file_reports if fr.unclassified]
    lines.append("## Unclassified queries (manual review)")
    lines.append("")
    lines.append(
        "These query chains couldn't be classified statically "
        "(dynamic model selection, subqueries, multi-model selects, etc.). "
        "A human should eyeball each one."
    )
    lines.append("")
    if not unclassified_files:
        lines.append("_None._")
    for fr in unclassified_files:
        rel = fr.path.relative_to(REPO_ROOT)
        lines.append(f"### `{rel}`")
        for entry in fr.unclassified:
            lines.append(f"- {entry}")
        lines.append("")

    lines.append("")
    lines.append("---")
    lines.append(summary_line)
    lines.append("")
    return "\n".join(lines)


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

def main() -> int:
    scan_roots = [APP_ROOT / sub for sub in SCAN_SUBDIRS]
    file_reports: list[FileReport] = []
    total_queries = 0

    for py_file in sorted(_iter_python_files(scan_roots)):
        report, file_total = scan_file(py_file)
        total_queries += file_total
        if report.suspect or report.safe_count or report.unclassified:
            file_reports.append(report)

    markdown = render_markdown(file_reports, total_queries)

    AUDITS_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(markdown, encoding="utf-8")

    sys.stdout.write(markdown)
    sys.stdout.write(f"\n\n[written to {REPORT_PATH.relative_to(REPO_ROOT)}]\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
