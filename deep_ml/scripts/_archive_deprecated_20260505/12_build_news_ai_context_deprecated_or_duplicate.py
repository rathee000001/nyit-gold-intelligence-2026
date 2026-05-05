"""
Gold Nexus Alpha — Deep ML Phase 12A
API-First News Source Update Layer

BACKBONE DIRECTORY CHANGE NOTE:
    This script restores the canonical backbone news namespace:
        artifacts/deep_ml/news/
    It does NOT use the temporary artifacts/deep_ml/news_ai/ fallback-only folder.
    Gamma should consume artifacts from artifacts/deep_ml/news/.

Save as:
    deep_ml/scripts/12_source_news_update.py

Open/edit:
    code .\deep_ml\scripts\12_source_news_update.py

Run:
    py -m py_compile .\deep_ml\scripts\12_source_news_update.py
    py .\deep_ml\scripts\12_source_news_update.py --smoke
    py .\deep_ml\scripts\12_source_news_update.py

Primary review artifact:
    artifacts/deep_ml/news/phase12_source_news_update_report.json

Purpose:
    Pull real news/context inputs before Gamma News Sensitivity.
    V1 uses GDELT DOC API first because it is free/no-key.
    Optional NewsAPI support is included if NEWS_API_KEY is available.
    Manual CSV support is included as a backup, but fallback-only context is not used here.

Input options:
    1. GDELT DOC API, no key required.
    2. Optional NewsAPI key through NEWS_API_KEY env var or --newsapi-key.
    3. Manual CSV backup:
       artifacts/deep_ml/news/raw_inputs/manual_news_items.csv

Outputs:
    artifacts/deep_ml/news/news_source_inventory.json
    artifacts/deep_ml/news/news_source_coverage_preview.json
    artifacts/deep_ml/news/raw_news_pull_log.json
    artifacts/deep_ml/news/api_pulls/gdelt_news_items_raw.json
    artifacts/deep_ml/news/api_pulls/gdelt_news_items_raw.csv
    artifacts/deep_ml/news/api_pulls/newsapi_news_items_raw.json
    artifacts/deep_ml/news/api_pulls/newsapi_news_items_raw.csv
    artifacts/deep_ml/news/raw_inputs/manual_news_items_template.csv
    artifacts/deep_ml/news/raw_inputs/manual_news_items_loaded.csv
    artifacts/deep_ml/news/news_items_unified_raw.json
    artifacts/deep_ml/news/news_items_unified_raw.csv
    artifacts/deep_ml/news/diagnostics_latest.json
    artifacts/deep_ml/news/quality_review.json
    artifacts/deep_ml/news/timeline.json
    artifacts/deep_ml/news/progress_checkpoint.json
    artifacts/deep_ml/news/phase12_source_news_update_report.json

Professor-safe rule:
    This layer collects and inventories news inputs. It does not claim that news
    caused gold price movement and does not generate forecasts.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import time
import traceback
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import quote_plus

import pandas as pd

try:
    import requests
except Exception:  # pragma: no cover
    requests = None


PHASE_KEY = "phase12_source_news_update"
SCRIPT_VERSION = "source_news_update_v1_gdelt_newsapi_manual_canonical_news_dir"
TIMEZONE_LOCAL = "America/New_York"

DEFAULT_GDELT_QUERIES = [
    'gold price OR "GC=F" OR "COMEX gold" OR "XAUUSD"',
    'gold inflation OR gold yields OR gold dollar',
    'gold geopolitical risk OR gold safe haven',
    'Federal Reserve rates gold OR dollar yields gold',
    'central bank gold buying OR gold reserves',
]

MANUAL_NEWS_COLUMNS = [
    "published_at",
    "source",
    "title",
    "summary",
    "url",
    "region",
    "importance_hint",
]


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(dt: Optional[datetime] = None) -> str:
    return (dt or utc_now()).isoformat().replace("+00:00", "Z")


def local_iso(dt: Optional[datetime] = None) -> str:
    dt = dt or utc_now()
    try:
        from zoneinfo import ZoneInfo
        return dt.astimezone(ZoneInfo(TIMEZONE_LOCAL)).isoformat()
    except Exception:
        return dt.isoformat()


def detect_repo_root(start: Path) -> Path:
    current = start.resolve()
    for candidate in [current, *current.parents]:
        if (candidate / ".git").exists() or (candidate / "artifacts").exists() or (candidate / "deep_ml").exists():
            return candidate
    return current


def get_git_commit(repo_root: Path) -> Optional[str]:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=str(repo_root),
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except Exception:
        return None


def stable_hash_file(path: Path) -> str:
    if not path.exists() or not path.is_file():
        return "missing"
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return "sha256:" + h.hexdigest()


def read_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def write_csv_dicts(path: Path, rows: List[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    keys: List[str] = []
    for row in rows:
        for k in row.keys():
            if k not in keys:
                keys.append(k)
    if not keys:
        keys = ["empty"]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=keys, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k) for k in keys})


def normalize_text(x: Any) -> str:
    if x is None:
        return ""
    return re.sub(r"\s+", " ", str(x)).strip()


def safe_date_string(x: Any) -> str:
    if x is None:
        return ""
    try:
        ts = pd.to_datetime(x, errors="coerce", utc=True)
        if pd.isna(ts):
            return normalize_text(x)
        return ts.isoformat().replace("+00:00", "Z")
    except Exception:
        return normalize_text(x)


def dedupe_news_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    out: List[Dict[str, Any]] = []
    for item in items:
        url = normalize_text(item.get("url")).lower()
        title = normalize_text(item.get("title")).lower()
        key = url or title
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def requests_get_json(url: str, params: Optional[Dict[str, Any]] = None, timeout: int = 30, headers: Optional[Dict[str, str]] = None) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any]]:
    if requests is None:
        return None, {"ok": False, "error": "requests package is not installed"}
    try:
        resp = requests.get(url, params=params, timeout=timeout, headers=headers or {"User-Agent": "GoldNexusAlphaDeepML/1.0"})
        meta = {
            "ok": 200 <= resp.status_code < 300,
            "status_code": resp.status_code,
            "url": resp.url,
            "elapsed_seconds": getattr(resp.elapsed, "total_seconds", lambda: None)(),
        }
        if not meta["ok"]:
            meta["text_preview"] = resp.text[:500]
            return None, meta
        return resp.json(), meta
    except Exception as exc:
        return None, {"ok": False, "error": repr(exc), "url": url}


@dataclass
class Paths:
    repo_root: Path
    artifacts_root: Path
    public_root: Path
    news_dir: Path
    public_news_dir: Path
    raw_inputs_dir: Path
    api_pulls_dir: Path
    structured_dir: Path
    phase_report: Path
    source_inventory: Path
    source_coverage_preview: Path
    raw_news_pull_log: Path
    gdelt_raw_json: Path
    gdelt_raw_csv: Path
    newsapi_raw_json: Path
    newsapi_raw_csv: Path
    manual_news_csv: Path
    manual_news_template: Path
    manual_news_loaded: Path
    unified_raw_json: Path
    unified_raw_csv: Path
    diagnostics: Path
    quality_review: Path
    timeline: Path
    checkpoint: Path
    feature_store: Path
    study_context: Path
    mode_status: Path


def build_paths(repo_root: Path) -> Paths:
    artifacts_root = repo_root / "artifacts" / "deep_ml"
    public_root = repo_root / "public" / "artifacts" / "deep_ml"
    news_dir = artifacts_root / "news"
    return Paths(
        repo_root=repo_root,
        artifacts_root=artifacts_root,
        public_root=public_root,
        news_dir=news_dir,
        public_news_dir=public_root / "news",
        raw_inputs_dir=news_dir / "raw_inputs",
        api_pulls_dir=news_dir / "api_pulls",
        structured_dir=news_dir / "structured",
        phase_report=news_dir / "phase12_source_news_update_report.json",
        source_inventory=news_dir / "news_source_inventory.json",
        source_coverage_preview=news_dir / "news_source_coverage_preview.json",
        raw_news_pull_log=news_dir / "raw_news_pull_log.json",
        gdelt_raw_json=news_dir / "api_pulls" / "gdelt_news_items_raw.json",
        gdelt_raw_csv=news_dir / "api_pulls" / "gdelt_news_items_raw.csv",
        newsapi_raw_json=news_dir / "api_pulls" / "newsapi_news_items_raw.json",
        newsapi_raw_csv=news_dir / "api_pulls" / "newsapi_news_items_raw.csv",
        manual_news_csv=news_dir / "raw_inputs" / "manual_news_items.csv",
        manual_news_template=news_dir / "raw_inputs" / "manual_news_items_template.csv",
        manual_news_loaded=news_dir / "raw_inputs" / "manual_news_items_loaded.csv",
        unified_raw_json=news_dir / "news_items_unified_raw.json",
        unified_raw_csv=news_dir / "news_items_unified_raw.csv",
        diagnostics=news_dir / "diagnostics_latest.json",
        quality_review=news_dir / "quality_review.json",
        timeline=news_dir / "timeline.json",
        checkpoint=news_dir / "progress_checkpoint.json",
        feature_store=artifacts_root / "features" / "deep_ml_numeric_feature_store.parquet",
        study_context=artifacts_root / "governance" / "study_context.json",
        mode_status=artifacts_root / "governance" / "deep_ml_mode_status.json",
    )


class RunLogger:
    def __init__(self, paths: Paths) -> None:
        self.paths = paths
        self.events: List[Dict[str, Any]] = []
        self.started = time.time()

    def timeline(self, event: str, status: str = "ok", details: Optional[Dict[str, Any]] = None) -> None:
        row = {
            "timestamp_utc": iso_utc(),
            "elapsed_seconds": round(time.time() - self.started, 3),
            "event": event,
            "status": status,
            "details": details or {},
        }
        self.events.append(row)
        write_json(self.paths.timeline, self.events)
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {event} [{status}]", flush=True)

    def checkpoint(self, step: str, status: str, payload: Optional[Dict[str, Any]] = None) -> None:
        write_json(
            self.paths.checkpoint,
            {
                "artifact_type": "deep_ml_progress_checkpoint",
                "phase_key": PHASE_KEY,
                "step": step,
                "status": status,
                "updated_at_utc": iso_utc(),
                "payload": payload or {},
            },
        )


# -----------------------------------------------------------------------------
# Source pullers
# -----------------------------------------------------------------------------


def gdelt_doc_pull(query: str, timespan: str, max_records: int, timeout: int) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Pull GDELT DOC API article list.

    Uses the public no-key endpoint:
        https://api.gdeltproject.org/api/v2/doc/doc
    Common parameters:
        query, mode=artlist, format=json, timespan, maxrecords, sort=hybridrel
    """
    endpoint = "https://api.gdeltproject.org/api/v2/doc/doc"
    params = {
        "query": query,
        "mode": "artlist",
        "format": "json",
        "timespan": timespan,
        "maxrecords": max_records,
        "sort": "hybridrel",
    }
    payload, meta = requests_get_json(endpoint, params=params, timeout=timeout)
    rows: List[Dict[str, Any]] = []
    if payload and isinstance(payload, dict):
        articles = payload.get("articles") or []
        for i, a in enumerate(articles):
            rows.append(
                {
                    "raw_source": "gdelt_doc_api",
                    "source_query": query,
                    "source_item_id": f"gdelt_{hashlib.sha1((a.get('url','') or str(i)).encode()).hexdigest()[:12]}",
                    "published_at": safe_date_string(a.get("seendate") or a.get("date") or a.get("datetime")),
                    "source": normalize_text(a.get("domain") or a.get("sourceCountry") or "gdelt"),
                    "title": normalize_text(a.get("title")),
                    "summary": normalize_text(a.get("snippet") or a.get("description") or ""),
                    "url": normalize_text(a.get("url")),
                    "language": normalize_text(a.get("language")),
                    "country": normalize_text(a.get("sourceCountry")),
                    "tone": a.get("tone"),
                    "image": normalize_text(a.get("socialimage")),
                    "api_payload_keys": sorted(list(a.keys())) if isinstance(a, dict) else [],
                    "pulled_at_utc": iso_utc(),
                }
            )
    meta.update({"query": query, "rows_returned": len(rows)})
    return rows, meta


def run_gdelt_pulls(queries: List[str], timespan: str, max_records: int, timeout: int, smoke: bool = False) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    rows: List[Dict[str, Any]] = []
    logs: List[Dict[str, Any]] = []
    effective_queries = queries[:2] if smoke else queries
    per_query_records = min(max_records, 25) if smoke else max_records
    for q in effective_queries:
        q_rows, meta = gdelt_doc_pull(q, timespan=timespan, max_records=per_query_records, timeout=timeout)
        rows.extend(q_rows)
        logs.append(meta)
    return dedupe_news_items(rows), logs


def newsapi_pull(query: str, api_key: str, from_date: Optional[str], to_date: Optional[str], max_records: int, timeout: int) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    endpoint = "https://newsapi.org/v2/everything"
    params: Dict[str, Any] = {
        "q": query,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": min(100, max_records),
        "apiKey": api_key,
    }
    if from_date:
        params["from"] = from_date
    if to_date:
        params["to"] = to_date
    payload, meta = requests_get_json(endpoint, params=params, timeout=timeout)
    rows: List[Dict[str, Any]] = []
    if payload and isinstance(payload, dict):
        for i, a in enumerate(payload.get("articles") or []):
            source = a.get("source") or {}
            rows.append(
                {
                    "raw_source": "newsapi",
                    "source_query": query,
                    "source_item_id": f"newsapi_{hashlib.sha1((a.get('url','') or str(i)).encode()).hexdigest()[:12]}",
                    "published_at": safe_date_string(a.get("publishedAt")),
                    "source": normalize_text(source.get("name") if isinstance(source, dict) else source),
                    "title": normalize_text(a.get("title")),
                    "summary": normalize_text(a.get("description") or a.get("content") or ""),
                    "url": normalize_text(a.get("url")),
                    "author": normalize_text(a.get("author")),
                    "image": normalize_text(a.get("urlToImage")),
                    "pulled_at_utc": iso_utc(),
                }
            )
    meta.update({"query": query, "rows_returned": len(rows), "api_key_used": bool(api_key)})
    return rows, meta


def run_newsapi_pulls(queries: List[str], api_key: Optional[str], from_date: Optional[str], to_date: Optional[str], max_records: int, timeout: int, smoke: bool = False) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    if not api_key:
        return [], [{"ok": False, "skipped": True, "reason": "NEWS_API_KEY not provided"}]
    rows: List[Dict[str, Any]] = []
    logs: List[Dict[str, Any]] = []
    effective_queries = queries[:1] if smoke else queries[:3]
    per_query_records = min(max_records, 20) if smoke else max_records
    for q in effective_queries:
        q_rows, meta = newsapi_pull(q, api_key=api_key, from_date=from_date, to_date=to_date, max_records=per_query_records, timeout=timeout)
        rows.extend(q_rows)
        logs.append(meta)
    return dedupe_news_items(rows), logs


def write_manual_template(path: Path) -> None:
    rows = [
        {
            "published_at": "2026-05-05T09:00:00Z",
            "source": "manual_source_name",
            "title": "Paste real headline here",
            "summary": "Paste real article summary or notes here.",
            "url": "https://example.com/article",
            "region": "global",
            "importance_hint": "medium",
        }
    ]
    write_csv_dicts(path, rows)


def load_manual_news(paths: Paths) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    write_manual_template(paths.manual_news_template)
    if not paths.manual_news_csv.exists():
        return [], {
            "manual_news_file_exists": False,
            "manual_news_rows_loaded": 0,
            "manual_news_template": str(paths.manual_news_template.relative_to(paths.repo_root)),
        }
    try:
        df = pd.read_csv(paths.manual_news_csv)
    except Exception as exc:
        return [], {
            "manual_news_file_exists": True,
            "manual_news_rows_loaded": 0,
            "manual_news_error": repr(exc),
            "manual_news_template": str(paths.manual_news_template.relative_to(paths.repo_root)),
        }
    rows: List[Dict[str, Any]] = []
    for i, r in df.iterrows():
        title = normalize_text(r.get("title"))
        summary = normalize_text(r.get("summary"))
        if not title and not summary:
            continue
        rows.append(
            {
                "raw_source": "manual_csv",
                "source_query": "manual_news_items_csv",
                "source_item_id": f"manual_{i+1:04d}",
                "published_at": safe_date_string(r.get("published_at") or iso_utc()),
                "source": normalize_text(r.get("source") or "manual"),
                "title": title,
                "summary": summary,
                "url": normalize_text(r.get("url")),
                "region": normalize_text(r.get("region") or "global"),
                "importance_hint": normalize_text(r.get("importance_hint") or "medium"),
                "pulled_at_utc": iso_utc(),
            }
        )
    write_csv_dicts(paths.manual_news_loaded, rows)
    return rows, {
        "manual_news_file_exists": True,
        "manual_news_file_hash": stable_hash_file(paths.manual_news_csv),
        "manual_news_rows_loaded": len(rows),
        "manual_news_template": str(paths.manual_news_template.relative_to(paths.repo_root)),
    }


# -----------------------------------------------------------------------------
# Artifact builders
# -----------------------------------------------------------------------------


def build_inventory(gdelt_rows: List[Dict[str, Any]], newsapi_rows: List[Dict[str, Any]], manual_rows: List[Dict[str, Any]], gdelt_logs: List[Dict[str, Any]], newsapi_logs: List[Dict[str, Any]], manual_meta: Dict[str, Any]) -> Dict[str, Any]:
    sources = [
        {
            "source_key": "gdelt_doc_api",
            "display_name": "GDELT DOC API",
            "source_type": "public_no_key_api",
            "enabled": True,
            "rows_loaded": len(gdelt_rows),
            "status": "ready" if len(gdelt_rows) > 0 else "no_rows_or_failed",
            "logs_preview": gdelt_logs[:5],
        },
        {
            "source_key": "newsapi",
            "display_name": "NewsAPI Everything Endpoint",
            "source_type": "optional_key_api",
            "enabled": any(not l.get("skipped") for l in newsapi_logs),
            "rows_loaded": len(newsapi_rows),
            "status": "ready" if len(newsapi_rows) > 0 else "skipped_or_no_rows",
            "logs_preview": newsapi_logs[:5],
        },
        {
            "source_key": "manual_news_csv",
            "display_name": "Manual News CSV",
            "source_type": "manual_csv_backup",
            "enabled": manual_meta.get("manual_news_file_exists", False),
            "rows_loaded": len(manual_rows),
            "status": "ready" if len(manual_rows) > 0 else "not_provided_or_empty",
            "meta": manual_meta,
        },
    ]
    return {
        "artifact_type": "news_source_inventory",
        "schema_version": "1.0.0",
        "phase_key": PHASE_KEY,
        "canonical_directory": "artifacts/deep_ml/news",
        "backbone_directory_change_note": "Using canonical backbone news folder. The temporary artifacts/deep_ml/news_ai fallback folder is not used by this script.",
        "sources": sources,
        "total_rows_loaded_before_dedupe": len(gdelt_rows) + len(newsapi_rows) + len(manual_rows),
        "generated_at_utc": iso_utc(),
    }


def build_coverage_preview(unified_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not unified_rows:
        return {
            "artifact_type": "news_source_coverage_preview",
            "schema_version": "1.0.0",
            "phase_key": PHASE_KEY,
            "status": "no_news_rows_loaded",
            "row_count": 0,
            "generated_at_utc": iso_utc(),
        }
    df = pd.DataFrame(unified_rows)
    published = pd.to_datetime(df.get("published_at"), errors="coerce", utc=True) if "published_at" in df.columns else pd.Series([], dtype="datetime64[ns, UTC]")
    by_source = df.groupby("raw_source").size().to_dict() if "raw_source" in df.columns else {}
    by_domain = df.groupby("source").size().sort_values(ascending=False).head(15).to_dict() if "source" in df.columns else {}
    return {
        "artifact_type": "news_source_coverage_preview",
        "schema_version": "1.0.0",
        "phase_key": PHASE_KEY,
        "status": "ready",
        "row_count": int(len(df)),
        "source_type_counts": {str(k): int(v) for k, v in by_source.items()},
        "top_sources": {str(k): int(v) for k, v in by_domain.items()},
        "date_range": {
            "first_published_at": published.min().isoformat().replace("+00:00", "Z") if len(published.dropna()) else None,
            "last_published_at": published.max().isoformat().replace("+00:00", "Z") if len(published.dropna()) else None,
        },
        "sample_titles": [normalize_text(x) for x in df.get("title", pd.Series([], dtype=str)).head(10).tolist()],
        "professor_safe_note": "Coverage preview describes collected source inventory only. It does not evaluate causal price impact.",
        "generated_at_utc": iso_utc(),
    }


def build_quality(unified_rows: List[Dict[str, Any]], gdelt_rows: List[Dict[str, Any]], newsapi_rows: List[Dict[str, Any]], manual_rows: List[Dict[str, Any]], paths: Paths) -> Dict[str, Any]:
    blocking: List[str] = []
    warnings: List[str] = []
    if not unified_rows:
        blocking.append("no_news_rows_loaded_from_api_or_manual")
    if not gdelt_rows:
        warnings.append("GDELT returned no rows or failed; check internet/API availability if unexpected.")
    if not newsapi_rows:
        warnings.append("NewsAPI rows not loaded; this is okay if NEWS_API_KEY was not provided.")
    if manual_rows:
        warnings.append("Manual news rows were included; verify source reliability before publication.")
    required = [
        paths.source_inventory,
        paths.source_coverage_preview,
        paths.raw_news_pull_log,
        paths.unified_raw_json,
        paths.unified_raw_csv,
        paths.diagnostics,
        paths.timeline,
        paths.checkpoint,
    ]
    missing = [str(p.relative_to(paths.repo_root)) for p in required if not p.exists()]
    if missing:
        blocking.append("missing_required_outputs")
    status = "ready"
    if warnings:
        status = "ready_with_warnings"
    if blocking:
        status = "blocked_waiting_for_news_api_source"
    return {
        "artifact_type": "deep_ml_quality_review",
        "schema_version": "1.0.0",
        "phase_key": PHASE_KEY,
        "model_key": "source_news_update",
        "status": status,
        "blocking_flags": blocking,
        "warnings": warnings,
        "acceptance_gate": {
            "api_or_manual_news_loaded": bool(unified_rows),
            "canonical_news_directory_used": True,
            "raw_api_logs_exported": paths.raw_news_pull_log.exists(),
            "source_inventory_exported": paths.source_inventory.exists(),
            "coverage_preview_exported": paths.source_coverage_preview.exists(),
            "unified_raw_news_exported": paths.unified_raw_json.exists() and paths.unified_raw_csv.exists(),
            "no_fallback_project_context_used": True,
            "professor_safe_no_causality_claims": True,
            "required_outputs_exist": not missing,
        },
        "professor_safe_summary": "Source News Update collects and inventories news inputs. It does not classify causality or forecast gold.",
        "generated_at_utc": iso_utc(),
    }


def copy_public(paths: Paths) -> None:
    paths.public_news_dir.mkdir(parents=True, exist_ok=True)
    for src in [
        paths.source_inventory,
        paths.source_coverage_preview,
        paths.raw_news_pull_log,
        paths.gdelt_raw_json,
        paths.gdelt_raw_csv,
        paths.newsapi_raw_json,
        paths.newsapi_raw_csv,
        paths.unified_raw_json,
        paths.unified_raw_csv,
        paths.diagnostics,
        paths.quality_review,
        paths.timeline,
        paths.checkpoint,
        paths.phase_report,
    ]:
        if src.exists():
            rel = src.relative_to(paths.news_dir)
            dest = paths.public_news_dir / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Phase 12A API-first news source update.")
    p.add_argument("--repo-root", type=str, default=None)
    p.add_argument("--smoke", action="store_true")
    p.add_argument("--gdelt-timespan", type=str, default="7d")
    p.add_argument("--max-records", type=int, default=100)
    p.add_argument("--timeout", type=int, default=30)
    p.add_argument("--newsapi-key", type=str, default=None)
    p.add_argument("--newsapi-from", type=str, default=None)
    p.add_argument("--newsapi-to", type=str, default=None)
    p.add_argument("--query", action="append", default=None, help="Custom query. Can be repeated.")
    p.add_argument("--no-gdelt", action="store_true")
    p.add_argument("--no-newsapi", action="store_true")
    p.add_argument("--no-manual", action="store_true")
    p.add_argument("--no-public-copy", action="store_true")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve() if args.repo_root else detect_repo_root(Path.cwd())
    paths = build_paths(repo_root)
    for d in [paths.news_dir, paths.raw_inputs_dir, paths.api_pulls_dir, paths.structured_dir, paths.public_news_dir]:
        d.mkdir(parents=True, exist_ok=True)
    logger = RunLogger(paths)
    started = utc_now()
    run_id = f"deepml_run_{started.strftime('%Y%m%d_%H%M%S')}_source_news_update"

    try:
        logger.timeline("phase12_source_news_update_started", details={"run_id": run_id})
        logger.checkpoint("started", "running", {"run_id": run_id})

        queries = args.query or DEFAULT_GDELT_QUERIES
        if args.smoke:
            queries = queries[:2]
        study_context = read_json(paths.study_context, default={}) or {}
        mode_status = read_json(paths.mode_status, default={}) or {}

        gdelt_rows: List[Dict[str, Any]] = []
        gdelt_logs: List[Dict[str, Any]] = []
        if not args.no_gdelt:
            gdelt_rows, gdelt_logs = run_gdelt_pulls(
                queries=queries,
                timespan=args.gdelt_timespan,
                max_records=args.max_records,
                timeout=args.timeout,
                smoke=args.smoke,
            )
        write_json(paths.gdelt_raw_json, {"source": "gdelt_doc_api", "rows": gdelt_rows, "pull_logs": gdelt_logs, "generated_at_utc": iso_utc()})
        write_csv_dicts(paths.gdelt_raw_csv, gdelt_rows)
        logger.timeline("gdelt_pull_completed", details={"rows": len(gdelt_rows), "queries": len(gdelt_logs)})

        newsapi_rows: List[Dict[str, Any]] = []
        newsapi_logs: List[Dict[str, Any]] = []
        newsapi_key = args.newsapi_key or os.getenv("NEWS_API_KEY") or os.getenv("NEWSAPI_KEY")
        if not args.no_newsapi:
            newsapi_rows, newsapi_logs = run_newsapi_pulls(
                queries=queries,
                api_key=newsapi_key,
                from_date=args.newsapi_from,
                to_date=args.newsapi_to,
                max_records=args.max_records,
                timeout=args.timeout,
                smoke=args.smoke,
            )
        write_json(paths.newsapi_raw_json, {"source": "newsapi", "rows": newsapi_rows, "pull_logs": newsapi_logs, "generated_at_utc": iso_utc()})
        write_csv_dicts(paths.newsapi_raw_csv, newsapi_rows)
        logger.timeline("newsapi_pull_completed", details={"rows": len(newsapi_rows), "enabled": bool(newsapi_key) and not args.no_newsapi})

        manual_rows: List[Dict[str, Any]] = []
        manual_meta: Dict[str, Any] = {"manual_news_skipped": True}
        if not args.no_manual:
            manual_rows, manual_meta = load_manual_news(paths)
        logger.timeline("manual_news_checked", details={"rows": len(manual_rows), **manual_meta})

        unified_rows = dedupe_news_items(gdelt_rows + newsapi_rows + manual_rows)
        for i, row in enumerate(unified_rows):
            row["unified_news_item_id"] = f"news_{i+1:05d}"
            row["phase_key"] = PHASE_KEY
            row["run_id"] = run_id
        write_json(paths.unified_raw_json, {"artifact_type": "news_items_unified_raw", "schema_version": "1.0.0", "phase_key": PHASE_KEY, "run_id": run_id, "rows": unified_rows, "generated_at_utc": iso_utc()})
        write_csv_dicts(paths.unified_raw_csv, unified_rows)
        logger.timeline("unified_news_items_written", details={"rows": len(unified_rows)})

        inventory = build_inventory(gdelt_rows, newsapi_rows, manual_rows, gdelt_logs, newsapi_logs, manual_meta)
        coverage = build_coverage_preview(unified_rows)
        raw_log = {
            "artifact_type": "raw_news_pull_log",
            "schema_version": "1.0.0",
            "phase_key": PHASE_KEY,
            "run_id": run_id,
            "queries": queries,
            "gdelt_logs": gdelt_logs,
            "newsapi_logs": newsapi_logs,
            "manual_meta": manual_meta,
            "canonical_directory": "artifacts/deep_ml/news",
            "generated_at_utc": iso_utc(),
        }
        diagnostics = {
            "artifact_type": "source_news_update_diagnostics_latest",
            "schema_version": "1.0.0",
            "phase_key": PHASE_KEY,
            "run_id": run_id,
            "script_version": SCRIPT_VERSION,
            "repo_root": str(repo_root),
            "python_version": sys.version,
            "platform": platform.platform(),
            "git_commit_sha": get_git_commit(repo_root),
            "study_id": study_context.get("study_id") or study_context.get("run_batch_id") or mode_status.get("study_id"),
            "mode": mode_status.get("mode"),
            "effective_data_through_date": mode_status.get("effective_model_data_through_date") or mode_status.get("effective_data_through_date"),
            "forecast_start_date": mode_status.get("forecast_start_date"),
            "dependencies": {"requests_available": requests is not None},
            "output_hashes": {
                "gdelt_raw_json": stable_hash_file(paths.gdelt_raw_json),
                "gdelt_raw_csv": stable_hash_file(paths.gdelt_raw_csv),
                "newsapi_raw_json": stable_hash_file(paths.newsapi_raw_json),
                "newsapi_raw_csv": stable_hash_file(paths.newsapi_raw_csv),
                "unified_raw_json": stable_hash_file(paths.unified_raw_json),
                "unified_raw_csv": stable_hash_file(paths.unified_raw_csv),
            },
            "professor_safe_note": "Diagnostics describe source update execution only. They do not claim news caused gold movement.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.source_inventory, inventory)
        write_json(paths.source_coverage_preview, coverage)
        write_json(paths.raw_news_pull_log, raw_log)
        write_json(paths.diagnostics, diagnostics)

        quality = build_quality(unified_rows, gdelt_rows, newsapi_rows, manual_rows, paths)
        write_json(paths.quality_review, quality)

        report = {
            "artifact_type": "phase12_source_news_update_report",
            "schema_version": "1.0.0",
            "project": "Gold Nexus Alpha",
            "phase": "Phase 12A — API-First News Source Update Layer",
            "phase_key": PHASE_KEY,
            "status": quality.get("status"),
            "run": {
                "run_id": run_id,
                "study_id": diagnostics.get("study_id"),
                "generated_at_utc": iso_utc(started),
                "completed_at_utc": iso_utc(),
                "generated_at_local": local_iso(started),
                "timezone_local": TIMEZONE_LOCAL,
                "git_commit_sha": get_git_commit(repo_root),
                "code_version": SCRIPT_VERSION,
            },
            "backbone_directory_change_note": "Canonicalized news artifacts under artifacts/deep_ml/news/ as specified by the uploaded backbone. Temporary artifacts/deep_ml/news_ai/ is not used here.",
            "source_summary": {
                "gdelt_rows": len(gdelt_rows),
                "newsapi_rows": len(newsapi_rows),
                "manual_rows": len(manual_rows),
                "unified_rows_after_dedupe": len(unified_rows),
                "queries_used": queries,
            },
            "source_inventory_snapshot": inventory,
            "coverage_preview_snapshot": coverage,
            "diagnostics_snapshot": diagnostics,
            "quality_review": quality,
            "outputs": {
                "news_source_inventory": str(paths.source_inventory.relative_to(repo_root)),
                "news_source_coverage_preview": str(paths.source_coverage_preview.relative_to(repo_root)),
                "raw_news_pull_log": str(paths.raw_news_pull_log.relative_to(repo_root)),
                "gdelt_raw_json": str(paths.gdelt_raw_json.relative_to(repo_root)),
                "gdelt_raw_csv": str(paths.gdelt_raw_csv.relative_to(repo_root)),
                "newsapi_raw_json": str(paths.newsapi_raw_json.relative_to(repo_root)),
                "newsapi_raw_csv": str(paths.newsapi_raw_csv.relative_to(repo_root)),
                "manual_news_template": str(paths.manual_news_template.relative_to(repo_root)),
                "unified_raw_json": str(paths.unified_raw_json.relative_to(repo_root)),
                "unified_raw_csv": str(paths.unified_raw_csv.relative_to(repo_root)),
                "diagnostics_latest": str(paths.diagnostics.relative_to(repo_root)),
                "quality_review": str(paths.quality_review.relative_to(repo_root)),
                "timeline": str(paths.timeline.relative_to(repo_root)),
                "progress_checkpoint": str(paths.checkpoint.relative_to(repo_root)),
            },
            "ai_grounding": {
                "allowed_claims": [
                    "Phase 12A collected real API/manual news source inputs into canonical Deep ML news artifacts.",
                    "GDELT is used as a no-key public news source when available.",
                    "NewsAPI is optional and only used when a key is provided.",
                    "Manual news CSV can supplement or replace API sources when clearly labeled.",
                ],
                "forbidden_claims": [
                    "This source update proves news caused gold prices to move.",
                    "This source update forecasts gold prices.",
                    "All collected headlines are guaranteed complete or unbiased.",
                    "No further Gamma classification is needed.",
                ],
            },
            "professor_safe_summary": "Phase 12A collected and inventoried news inputs for Gamma under the canonical artifacts/deep_ml/news directory. It does not forecast gold and does not make causal claims.",
            "next_step": {
                "phase": "Phase 12B — Build News Context From API Inputs",
                "script": "deep_ml/scripts/13_build_news_context_from_api.py",
                "instruction": "Review this report first. If ready, build the structured News Context layer from artifacts/deep_ml/news/news_items_unified_raw.json before Gamma.",
            },
            "final_instruction": "Send me artifacts/deep_ml/news/phase12_source_news_update_report.json for review before building News Context or Gamma.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.phase_report, report)

        if not args.no_public_copy:
            copy_public(paths)

        logger.checkpoint("completed", quality.get("status", "ready"), {"send_me_this_json": str(paths.phase_report.relative_to(repo_root))})
        logger.timeline("phase12_source_news_update_completed", status=quality.get("status", "ready"))
        print("\n" + "=" * 88)
        print("PHASE 12A SOURCE NEWS UPDATE COMPLETE")
        print("Send me this JSON for review:")
        print("artifacts/deep_ml/news/phase12_source_news_update_report.json")
        print("=" * 88 + "\n")
        return 0

    except Exception as exc:
        err = {
            "artifact_type": "phase12_source_news_update_error_report",
            "schema_version": "1.0.0",
            "project": "Gold Nexus Alpha",
            "phase_key": PHASE_KEY,
            "status": "failed",
            "run_id": run_id,
            "error": repr(exc),
            "traceback": traceback.format_exc(),
            "generated_at_utc": iso_utc(),
            "final_instruction": "Fix the error and rerun Phase 12A before moving to News Context or Gamma.",
        }
        write_json(paths.phase_report, err)
        logger.checkpoint("failed", "failed", {"error": repr(exc)})
        print("\nPHASE 12A FAILED. Review:")
        print("artifacts/deep_ml/news/phase12_source_news_update_report.json")
        raise


if __name__ == "__main__":
    raise SystemExit(main())
