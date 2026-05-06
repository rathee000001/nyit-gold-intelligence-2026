"""
Gold Nexus Alpha — Deep ML Phase 12
Unified Source News Update

LOCKED SCRIPT NAME:
    deep_ml/scripts/12_source_news_update.py

BACKBONE DIRECTORY CHANGE NOTE:
    Canonical news artifact folder stays:
        artifacts/deep_ml/news/

    This script does NOT use artifacts/deep_ml/news_ai/.
    This script should not be renamed again.

What this script does in one run:
    1. Builds/updates a fixed historical daily news index.
    2. Pulls recent news for latest tooltips/context.
    3. Merges both into stable canonical news artifacts for Phase 13/Gamma.

Important honesty rule:
    Google News RSS is used only as a recent/no-key fallback. It is not a true
    2006 historical headline archive. Historical rows that cannot be sourced
    from public APIs are clearly marked in the output; the script never fakes
    historical headlines.

Open/edit:
    code .\deep_ml\scripts\12_source_news_update.py

Run:
    py -m py_compile .\deep_ml\scripts\12_source_news_update.py
    py .\deep_ml\scripts\12_source_news_update.py --smoke
    py .\deep_ml\scripts\12_source_news_update.py

Useful options:
    py .\deep_ml\scripts\12_source_news_update.py --recent-only
    py .\deep_ml\scripts\12_source_news_update.py --historical-only
    py .\deep_ml\scripts\12_source_news_update.py --force-historical
    py .\deep_ml\scripts\12_source_news_update.py --smoke --force-historical

Review artifact:
    artifacts/deep_ml/news/phase12_source_news_update_report.json
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
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import pandas as pd

try:
    import requests
except Exception:  # pragma: no cover
    requests = None

PHASE_KEY = "phase12_source_news_update"
SCRIPT_VERSION = "source_news_update_v3_unified_historical_recent_safe_fallbacks"
TIMEZONE_LOCAL = "America/New_York"
DOC_API_MIN_DATE = pd.Timestamp("2017-01-01")
DEFAULT_HISTORICAL_START = "2006-01-02"
DEFAULT_RECENT_DAYS = 7

# GDELT requires OR terms to be wrapped in parentheses.
GDELT_QUERIES = {
    "gold_general": '("gold price" OR "COMEX gold" OR "XAUUSD")',
    "inflation_yields": '("gold inflation" OR "gold yields" OR "gold dollar")',
    "geopolitical_safe_haven": '("gold geopolitical risk" OR "gold safe haven")',
    "fed_usd_rates": '("Federal Reserve rates gold" OR "dollar yields gold")',
    "central_bank_gold": '("central bank gold buying" OR "gold reserves")',
}

RSS_SEARCHES = {
    "gold_general": "gold price",
    "inflation_yields": "gold inflation yields dollar",
    "geopolitical_safe_haven": "gold geopolitical risk safe haven",
    "fed_usd_rates": "Federal Reserve rates gold dollar yields",
    "central_bank_gold": "central bank gold reserves",
}

THEME_COLUMNS = [
    "gold_general_news_score",
    "inflation_news_score",
    "fed_policy_news_score",
    "usd_news_score",
    "geopolitical_risk_news_score",
    "safe_haven_news_score",
    "central_bank_gold_news_score",
    "net_gold_news_sensitivity_score",
]

QUERY_TO_THEME = {
    "gold_general": "gold_general_news_score",
    "inflation_yields": "inflation_news_score",
    "geopolitical_safe_haven": "geopolitical_risk_news_score",
    "fed_usd_rates": "fed_policy_news_score",
    "central_bank_gold": "central_bank_gold_news_score",
}

MANUAL_NEWS_COLUMNS = ["published_at", "source", "title", "summary", "url", "region", "importance_hint"]


# -----------------------------------------------------------------------------
# Generic helpers
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
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=str(repo_root), text=True, stderr=subprocess.DEVNULL).strip()
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
    text = re.sub(r"<[^>]+>", " ", str(x))
    return re.sub(r"\s+", " ", text).strip()


def safe_date_string(x: Any) -> str:
    if x is None:
        return ""
    try:
        ts = pd.to_datetime(x, errors="coerce", utc=True)
        if pd.isna(ts):
            return normalize_text(x)
        return ts.isoformat().replace("+00:00", "Z")
    except Exception:
        try:
            return parsedate_to_datetime(str(x)).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        except Exception:
            return normalize_text(x)


def safe_date_only(x: Any) -> Optional[str]:
    try:
        ts = pd.to_datetime(x, errors="coerce", utc=True)
        if pd.isna(ts):
            return None
        return ts.date().isoformat()
    except Exception:
        return None


def dedupe_news_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    out: List[Dict[str, Any]] = []
    for item in items:
        key = normalize_text(item.get("url")).lower() or normalize_text(item.get("title")).lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def progress_iter(items: List[Any], label: str) -> Iterable[Any]:
    try:
        from tqdm.auto import tqdm  # type: ignore
        return tqdm(items, desc=label, unit="step")
    except Exception:
        total = len(items)

        def _generator() -> Iterable[Any]:
            for i, item in enumerate(items, start=1):
                print(f"[{datetime.now().strftime('%H:%M:%S')}] {label}: {i}/{total}", flush=True)
                yield item

        return _generator()


def default_headers(accept: str = "application/json,text/xml,application/rss+xml,text/plain,*/*") -> Dict[str, str]:
    return {"User-Agent": "Mozilla/5.0 GoldNexusAlphaDeepML/1.0 academic research artifact builder", "Accept": accept}


def requests_get_json(url: str, params: Optional[Dict[str, Any]] = None, timeout: int = 60) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any]]:
    if requests is None:
        return None, {"ok": False, "error": "requests package is not installed"}
    try:
        resp = requests.get(url, params=params, timeout=timeout, headers=default_headers("application/json,*/*"))
        meta = {"ok": 200 <= resp.status_code < 300, "status_code": resp.status_code, "url": resp.url, "elapsed_seconds": getattr(resp.elapsed, "total_seconds", lambda: None)(), "content_type": resp.headers.get("content-type", "")}
        if not meta["ok"]:
            meta["text_preview"] = resp.text[:500]
            return None, meta
        try:
            return resp.json(), meta
        except Exception as exc:
            meta.update({"ok": False, "error": f"JSON decode failed: {repr(exc)}", "text_preview": resp.text[:500]})
            return None, meta
    except Exception as exc:
        return None, {"ok": False, "error": repr(exc), "url": url}


def requests_get_text(url: str, params: Optional[Dict[str, Any]] = None, timeout: int = 60) -> Tuple[Optional[str], Dict[str, Any]]:
    if requests is None:
        return None, {"ok": False, "error": "requests package is not installed"}
    try:
        resp = requests.get(url, params=params, timeout=timeout, headers=default_headers())
        meta = {"ok": 200 <= resp.status_code < 300, "status_code": resp.status_code, "url": resp.url, "elapsed_seconds": getattr(resp.elapsed, "total_seconds", lambda: None)(), "content_type": resp.headers.get("content-type", "")}
        if not meta["ok"]:
            meta["text_preview"] = resp.text[:500]
            return None, meta
        return resp.text, meta
    except Exception as exc:
        return None, {"ok": False, "error": repr(exc), "url": url}


@dataclass
class Paths:
    repo_root: Path
    artifacts_root: Path
    public_root: Path
    news_dir: Path
    public_news_dir: Path
    historical_dir: Path
    raw_inputs_dir: Path
    api_pulls_dir: Path
    structured_dir: Path
    phase_report: Path
    source_inventory: Path
    coverage_preview: Path
    raw_news_pull_log: Path
    gdelt_raw_json: Path
    gdelt_raw_csv: Path
    rss_raw_json: Path
    rss_raw_csv: Path
    newsapi_raw_json: Path
    newsapi_raw_csv: Path
    manual_news_csv: Path
    manual_news_template: Path
    manual_news_loaded: Path
    unified_raw_json: Path
    unified_raw_csv: Path
    historical_index_parquet: Path
    historical_index_csv: Path
    historical_manifest: Path
    combined_daily_context_parquet: Path
    combined_daily_context_csv: Path
    diagnostics: Path
    quality_review: Path
    timeline: Path
    checkpoint: Path
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
        historical_dir=news_dir / "historical",
        raw_inputs_dir=news_dir / "raw_inputs",
        api_pulls_dir=news_dir / "api_pulls",
        structured_dir=news_dir / "structured",
        phase_report=news_dir / "phase12_source_news_update_report.json",
        source_inventory=news_dir / "news_source_inventory.json",
        coverage_preview=news_dir / "news_source_coverage_preview.json",
        raw_news_pull_log=news_dir / "raw_news_pull_log.json",
        gdelt_raw_json=news_dir / "api_pulls" / "gdelt_news_items_raw.json",
        gdelt_raw_csv=news_dir / "api_pulls" / "gdelt_news_items_raw.csv",
        rss_raw_json=news_dir / "api_pulls" / "rss_news_items_raw.json",
        rss_raw_csv=news_dir / "api_pulls" / "rss_news_items_raw.csv",
        newsapi_raw_json=news_dir / "api_pulls" / "newsapi_news_items_raw.json",
        newsapi_raw_csv=news_dir / "api_pulls" / "newsapi_news_items_raw.csv",
        manual_news_csv=news_dir / "raw_inputs" / "manual_news_items.csv",
        manual_news_template=news_dir / "raw_inputs" / "manual_news_items_template.csv",
        manual_news_loaded=news_dir / "raw_inputs" / "manual_news_items_loaded.csv",
        unified_raw_json=news_dir / "news_items_unified_raw.json",
        unified_raw_csv=news_dir / "news_items_unified_raw.csv",
        historical_index_parquet=news_dir / "historical" / "historical_news_daily_index.parquet",
        historical_index_csv=news_dir / "historical" / "historical_news_daily_index.csv",
        historical_manifest=news_dir / "historical" / "historical_news_backfill_manifest.json",
        combined_daily_context_parquet=news_dir / "structured" / "news_context_daily_combined.parquet",
        combined_daily_context_csv=news_dir / "structured" / "news_context_daily_combined.csv",
        diagnostics=news_dir / "diagnostics_latest.json",
        quality_review=news_dir / "quality_review.json",
        timeline=news_dir / "timeline.json",
        checkpoint=news_dir / "progress_checkpoint.json",
        study_context=artifacts_root / "governance" / "study_context.json",
        mode_status=artifacts_root / "governance" / "deep_ml_mode_status.json",
    )


class RunLogger:
    def __init__(self, paths: Paths) -> None:
        self.paths = paths
        self.events: List[Dict[str, Any]] = []
        self.started = time.time()

    def timeline(self, event: str, status: str = "ok", details: Optional[Dict[str, Any]] = None) -> None:
        row = {"timestamp_utc": iso_utc(), "elapsed_seconds": round(time.time() - self.started, 3), "event": event, "status": status, "details": details or {}}
        self.events.append(row)
        write_json(self.paths.timeline, self.events)
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {event} [{status}]", flush=True)

    def checkpoint(self, step: str, status: str, payload: Optional[Dict[str, Any]] = None) -> None:
        write_json(self.paths.checkpoint, {"artifact_type": "deep_ml_progress_checkpoint", "phase_key": PHASE_KEY, "step": step, "status": status, "updated_at_utc": iso_utc(), "payload": payload or {}})


# -----------------------------------------------------------------------------
# News pullers
# -----------------------------------------------------------------------------


def gdelt_doc_pull(query_key: str, query: str, timespan: Optional[str], start: Optional[str], end: Optional[str], max_records: int, timeout: int) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    endpoint = "https://api.gdeltproject.org/api/v2/doc/doc"
    params: Dict[str, Any] = {"query": query, "mode": "artlist", "format": "json", "maxrecords": max_records, "sort": "hybridrel"}
    if timespan:
        params["timespan"] = timespan
    if start and end:
        params["startdatetime"] = start.replace("-", "") + "000000"
        params["enddatetime"] = end.replace("-", "") + "235959"
    payload, meta = requests_get_json(endpoint, params=params, timeout=timeout)
    rows: List[Dict[str, Any]] = []
    if payload and isinstance(payload, dict):
        for i, a in enumerate(payload.get("articles") or []):
            rows.append({
                "raw_source": "gdelt_doc_api",
                "query_key": query_key,
                "source_query": query,
                "source_item_id": f"gdelt_{hashlib.sha1((a.get('url','') or str(i)).encode()).hexdigest()[:12]}",
                "published_at": safe_date_string(a.get("seendate") or a.get("date") or a.get("datetime")),
                "date": safe_date_only(a.get("seendate") or a.get("date") or a.get("datetime")),
                "source": normalize_text(a.get("domain") or "gdelt"),
                "title": normalize_text(a.get("title")),
                "summary": normalize_text(a.get("snippet") or a.get("description") or ""),
                "url": normalize_text(a.get("url")),
                "language": normalize_text(a.get("language")),
                "country": normalize_text(a.get("sourceCountry")),
                "tone": a.get("tone"),
                "image": normalize_text(a.get("socialimage")),
                "pulled_at_utc": iso_utc(),
            })
    meta.update({"query_key": query_key, "query": query, "rows_returned": len(rows), "start": start, "end": end, "timespan": timespan})
    return rows, meta


def run_gdelt_recent(timespan: str, max_records: int, timeout: int, smoke: bool, delay: float, retries: int) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    rows: List[Dict[str, Any]] = []
    logs: List[Dict[str, Any]] = []
    items = list(GDELT_QUERIES.items())[:2] if smoke else list(GDELT_QUERIES.items())
    for query_key, query in progress_iter(items, "GDELT recent pulls"):
        q_rows: List[Dict[str, Any]] = []
        last_meta: Dict[str, Any] = {}
        for attempt in range(1, retries + 1):
            q_rows, last_meta = gdelt_doc_pull(query_key, query, timespan=timespan, start=None, end=None, max_records=max_records, timeout=timeout)
            last_meta["attempt"] = attempt
            if q_rows:
                break
            if attempt < retries:
                time.sleep(delay * attempt)
        rows.extend(q_rows)
        logs.append(last_meta)
        time.sleep(delay)
    return dedupe_news_items(rows), logs


def parse_rss_items(xml_text: str, query_key: str, search: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    root = ET.fromstring(xml_text)
    for i, item in enumerate(root.findall(".//item")):
        title = normalize_text(item.findtext("title"))
        link = normalize_text(item.findtext("link"))
        pub_date = safe_date_string(item.findtext("pubDate"))
        source_el = item.find("source")
        source_name = normalize_text(source_el.text if source_el is not None else "google_news_rss_search")
        rows.append({
            "raw_source": "google_news_rss_search",
            "query_key": query_key,
            "source_query": search,
            "source_item_id": f"rss_{hashlib.sha1((link or title or str(i)).encode()).hexdigest()[:12]}",
            "published_at": pub_date,
            "date": safe_date_only(pub_date),
            "source": source_name,
            "title": title,
            "summary": normalize_text(item.findtext("description")),
            "url": link,
            "language": "en",
            "country": "US/global",
            "pulled_at_utc": iso_utc(),
        })
    return rows


def run_rss_recent(timeout: int, smoke: bool, delay: float) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    rows: List[Dict[str, Any]] = []
    logs: List[Dict[str, Any]] = []
    items = list(RSS_SEARCHES.items())[:2] if smoke else list(RSS_SEARCHES.items())
    for query_key, search in progress_iter(items, "RSS recent fallback pulls"):
        params = {"q": f"{search} when:7d", "hl": "en-US", "gl": "US", "ceid": "US:en"}
        text, meta = requests_get_text("https://news.google.com/rss/search", params=params, timeout=timeout)
        meta.update({"query_key": query_key, "query": search, "source_key": "google_news_rss_search"})
        q_rows: List[Dict[str, Any]] = []
        if text:
            try:
                q_rows = parse_rss_items(text, query_key, search)
            except Exception as exc:
                meta.update({"ok": False, "error": f"RSS parse failed: {repr(exc)}", "text_preview": text[:300]})
        rows.extend(q_rows)
        meta["rows_returned"] = len(q_rows)
        logs.append(meta)
        time.sleep(delay)
    return dedupe_news_items(rows), logs


def newsapi_pull(query_key: str, query: str, api_key: str, from_date: Optional[str], to_date: Optional[str], max_records: int, timeout: int) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    params: Dict[str, Any] = {"q": query, "language": "en", "sortBy": "publishedAt", "pageSize": min(100, max_records), "apiKey": api_key}
    if from_date:
        params["from"] = from_date
    if to_date:
        params["to"] = to_date
    payload, meta = requests_get_json("https://newsapi.org/v2/everything", params=params, timeout=timeout)
    rows: List[Dict[str, Any]] = []
    if payload and isinstance(payload, dict):
        for i, a in enumerate(payload.get("articles") or []):
            src = a.get("source") or {}
            rows.append({
                "raw_source": "newsapi",
                "query_key": query_key,
                "source_query": query,
                "source_item_id": f"newsapi_{hashlib.sha1((a.get('url','') or str(i)).encode()).hexdigest()[:12]}",
                "published_at": safe_date_string(a.get("publishedAt")),
                "date": safe_date_only(a.get("publishedAt")),
                "source": normalize_text(src.get("name") if isinstance(src, dict) else src),
                "title": normalize_text(a.get("title")),
                "summary": normalize_text(a.get("description") or a.get("content") or ""),
                "url": normalize_text(a.get("url")),
                "pulled_at_utc": iso_utc(),
            })
    meta.update({"query_key": query_key, "query": query, "rows_returned": len(rows), "api_key_used": bool(api_key)})
    return rows, meta


def run_newsapi_recent(api_key: Optional[str], from_date: Optional[str], to_date: Optional[str], max_records: int, timeout: int, smoke: bool) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    if not api_key:
        return [], [{"ok": False, "skipped": True, "reason": "NEWS_API_KEY not provided"}]
    rows: List[Dict[str, Any]] = []
    logs: List[Dict[str, Any]] = []
    items = list(RSS_SEARCHES.items())[:1] if smoke else list(RSS_SEARCHES.items())[:3]
    for query_key, query in progress_iter(items, "NewsAPI recent pulls"):
        q_rows, meta = newsapi_pull(query_key, query, api_key, from_date, to_date, max_records, timeout)
        rows.extend(q_rows)
        logs.append(meta)
        time.sleep(1.0)
    return dedupe_news_items(rows), logs


def write_manual_template(path: Path) -> None:
    write_csv_dicts(path, [{"published_at": "2026-05-05T09:00:00Z", "source": "manual_source_name", "title": "Paste real headline here", "summary": "Paste real article summary here.", "url": "https://example.com/article", "region": "global", "importance_hint": "medium"}])


def load_manual_news(paths: Paths) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    write_manual_template(paths.manual_news_template)
    if not paths.manual_news_csv.exists():
        return [], {"manual_news_file_exists": False, "manual_news_rows_loaded": 0, "manual_news_template": str(paths.manual_news_template.relative_to(paths.repo_root))}
    try:
        df = pd.read_csv(paths.manual_news_csv)
    except Exception as exc:
        return [], {"manual_news_file_exists": True, "manual_news_rows_loaded": 0, "manual_news_error": repr(exc)}
    rows: List[Dict[str, Any]] = []
    for i, r in df.iterrows():
        title = normalize_text(r.get("title"))
        summary = normalize_text(r.get("summary"))
        if not title and not summary:
            continue
        pub = safe_date_string(r.get("published_at") or iso_utc())
        rows.append({"raw_source": "manual_csv", "query_key": "manual", "source_query": "manual_news_items_csv", "source_item_id": f"manual_{i+1:04d}", "published_at": pub, "date": safe_date_only(pub), "source": normalize_text(r.get("source") or "manual"), "title": title, "summary": summary, "url": normalize_text(r.get("url")), "region": normalize_text(r.get("region") or "global"), "importance_hint": normalize_text(r.get("importance_hint") or "medium"), "pulled_at_utc": iso_utc()})
    write_csv_dicts(paths.manual_news_loaded, rows)
    return rows, {"manual_news_file_exists": True, "manual_news_file_hash": stable_hash_file(paths.manual_news_csv), "manual_news_rows_loaded": len(rows)}


# -----------------------------------------------------------------------------
# Historical index
# -----------------------------------------------------------------------------


def empty_daily_index(start: str, end: str) -> pd.DataFrame:
    dates = pd.date_range(start=start, end=end, freq="D")
    df = pd.DataFrame({"date": dates.date.astype(str)})
    df["article_count"] = 0
    df["gold_news_count"] = 0
    for col in THEME_COLUMNS:
        df[col] = 0.0
    df["top_headline_1"] = ""
    df["top_headline_1_source"] = ""
    df["top_headline_1_url"] = ""
    df["top_headline_2"] = ""
    df["top_headline_2_source"] = ""
    df["top_headline_2_url"] = ""
    df["source_type"] = "historical_index_row_no_public_headline_loaded"
    df["source_coverage_note"] = "Daily row exists for fixed index continuity. A zero score means no public source row was loaded by this script, not proof that no news existed."
    return df


def month_chunks(start: pd.Timestamp, end: pd.Timestamp, smoke: bool) -> List[Tuple[str, str]]:
    if end < start:
        return []
    chunks = []
    cur = pd.Timestamp(start.year, start.month, 1)
    while cur <= end:
        month_end = min(cur + pd.offsets.MonthEnd(0), end)
        chunks.append((max(cur, start).date().isoformat(), month_end.date().isoformat()))
        cur = month_end + pd.Timedelta(days=1)
    if smoke:
        return chunks[-2:]
    return chunks


def apply_items_to_daily_index(df: pd.DataFrame, items: List[Dict[str, Any]], source_type: str) -> pd.DataFrame:
    if not items:
        return df
    out = df.copy()
    out_idx = {d: i for i, d in enumerate(out["date"].astype(str).tolist())}
    for item in items:
        d = item.get("date") or safe_date_only(item.get("published_at"))
        if not d or d not in out_idx:
            continue
        i = out_idx[d]
        query_key = item.get("query_key", "gold_general")
        theme_col = QUERY_TO_THEME.get(query_key, "gold_general_news_score")
        out.at[i, "article_count"] = int(out.at[i, "article_count"]) + 1
        out.at[i, "gold_news_count"] = int(out.at[i, "gold_news_count"]) + 1
        out.at[i, theme_col] = float(out.at[i, theme_col]) + 1.0
        out.at[i, "net_gold_news_sensitivity_score"] = float(out.at[i, "net_gold_news_sensitivity_score"]) + 1.0
        if not out.at[i, "top_headline_1"]:
            out.at[i, "top_headline_1"] = normalize_text(item.get("title"))[:250]
            out.at[i, "top_headline_1_source"] = normalize_text(item.get("source"))
            out.at[i, "top_headline_1_url"] = normalize_text(item.get("url"))
        elif not out.at[i, "top_headline_2"]:
            out.at[i, "top_headline_2"] = normalize_text(item.get("title"))[:250]
            out.at[i, "top_headline_2_source"] = normalize_text(item.get("source"))
            out.at[i, "top_headline_2_url"] = normalize_text(item.get("url"))
        out.at[i, "source_type"] = source_type
        out.at[i, "source_coverage_note"] = "Historical/recent public source rows were loaded for this date. Scores summarize source coverage, not causality."
    # Normalize simple counts into small scores so Gamma can consume consistently.
    for col in THEME_COLUMNS:
        out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0.0).clip(lower=0, upper=10) / 10.0
    return out


def build_or_load_historical_index(paths: Paths, start_date: str, historical_end: str, force: bool, smoke: bool, timeout: int, delay: float, retries: int, max_records: int) -> Tuple[pd.DataFrame, Dict[str, Any], List[Dict[str, Any]]]:
    logs: List[Dict[str, Any]] = []
    if paths.historical_index_parquet.exists() and not force:
        try:
            cached = pd.read_parquet(paths.historical_index_parquet)
            if "date" in cached.columns and not cached.empty:
                min_d = str(cached["date"].min())
                max_d = str(cached["date"].max())
                if min_d <= start_date and max_d >= historical_end:
                    manifest = read_json(paths.historical_manifest, default={}) or {}
                    manifest["cache_used"] = True
                    manifest["cache_reason"] = "Existing historical index covers requested window. Use --force-historical to rebuild."
                    return cached, manifest, logs
        except Exception:
            pass

    base = empty_daily_index(start_date, historical_end)
    historical_items: List[Dict[str, Any]] = []
    hist_start = max(pd.Timestamp(start_date), DOC_API_MIN_DATE)
    hist_end = pd.Timestamp(historical_end)
    chunks = month_chunks(hist_start, hist_end, smoke=smoke)

    # Historical DOC API best-effort from 2017 onward. It is intentionally sampled
    # and logged. We do not pretend it is every article ever published.
    query_items = list(GDELT_QUERIES.items())[:2] if smoke else list(GDELT_QUERIES.items())
    tasks = [(query_key, query, start, end) for start, end in chunks for query_key, query in query_items]
    for query_key, query, start, end in progress_iter(tasks, "Historical GDELT sampled index"):
        q_rows: List[Dict[str, Any]] = []
        last_meta: Dict[str, Any] = {}
        for attempt in range(1, retries + 1):
            q_rows, last_meta = gdelt_doc_pull(query_key, query, timespan=None, start=start, end=end, max_records=max_records, timeout=timeout)
            last_meta["attempt"] = attempt
            last_meta["historical_sampled_index"] = True
            if q_rows:
                break
            if attempt < retries:
                time.sleep(delay * attempt)
        historical_items.extend(q_rows)
        logs.append(last_meta)
        time.sleep(delay)

    base = apply_items_to_daily_index(base, historical_items, "historical_gdelt_doc_sampled_index")
    if pd.Timestamp(start_date) < DOC_API_MIN_DATE:
        pre_mask = pd.to_datetime(base["date"]) < DOC_API_MIN_DATE
        base.loc[pre_mask, "source_type"] = "historical_fixed_row_pre_doc_api_window"
        base.loc[pre_mask, "source_coverage_note"] = "Public DOC/RSS headline backfill was not available for this pre-2017 period in this script. Row retained for 2006-to-current continuity."

    paths.historical_dir.mkdir(parents=True, exist_ok=True)
    base.to_parquet(paths.historical_index_parquet, index=False)
    base.to_csv(paths.historical_index_csv, index=False)
    manifest = {
        "artifact_type": "historical_news_backfill_manifest",
        "schema_version": "1.0.0",
        "phase_key": PHASE_KEY,
        "script_version": SCRIPT_VERSION,
        "historical_start_date": start_date,
        "historical_end_date": historical_end,
        "row_count": int(len(base)),
        "rows_with_loaded_public_source": int((base["article_count"] > 0).sum()),
        "source_policy": "Fixed daily index. 2017 onward uses sampled GDELT DOC API where available. Pre-2017 rows are retained with explicit coverage notes unless a future bulk historical GDELT/GKG loader is added.",
        "google_news_rss_policy": "Google News RSS is a recent fallback only, not a 2006 historical archive.",
        "cache_used": False,
        "generated_at_utc": iso_utc(),
        "outputs": {"historical_index_parquet": str(paths.historical_index_parquet.relative_to(paths.repo_root)), "historical_index_csv": str(paths.historical_index_csv.relative_to(paths.repo_root))},
    }
    write_json(paths.historical_manifest, manifest)
    return base, manifest, logs


# -----------------------------------------------------------------------------
# Artifact assembly
# -----------------------------------------------------------------------------


def build_coverage_preview(unified_rows: List[Dict[str, Any]], historical_df: pd.DataFrame) -> Dict[str, Any]:
    source_counts = {}
    top_sources = {}
    sample_titles: List[str] = []
    if unified_rows:
        df = pd.DataFrame(unified_rows)
        source_counts = {str(k): int(v) for k, v in df.groupby("raw_source").size().to_dict().items()} if "raw_source" in df.columns else {}
        top_sources = {str(k): int(v) for k, v in df.groupby("source").size().sort_values(ascending=False).head(15).to_dict().items()} if "source" in df.columns else {}
        sample_titles = [normalize_text(x) for x in df.get("title", pd.Series([], dtype=str)).head(10).tolist()]
    return {
        "artifact_type": "news_source_coverage_preview",
        "schema_version": "1.0.0",
        "phase_key": PHASE_KEY,
        "status": "ready" if (unified_rows or not historical_df.empty) else "no_news_rows_loaded",
        "recent_row_count": len(unified_rows),
        "historical_daily_row_count": int(len(historical_df)),
        "historical_rows_with_loaded_public_source": int((historical_df["article_count"] > 0).sum()) if not historical_df.empty and "article_count" in historical_df.columns else 0,
        "source_type_counts": source_counts,
        "top_sources": top_sources,
        "sample_titles": sample_titles,
        "professor_safe_note": "Coverage preview describes source inventory only. It does not evaluate causal price impact.",
        "generated_at_utc": iso_utc(),
    }


def combine_daily_context(historical_df: pd.DataFrame, recent_items: List[Dict[str, Any]], paths: Paths) -> pd.DataFrame:
    if historical_df.empty:
        combined = pd.DataFrame()
    else:
        combined = historical_df.copy()
    if recent_items and not combined.empty:
        max_hist = pd.to_datetime(combined["date"]).max()
        recent_start = max_hist + pd.Timedelta(days=1)
        recent_end = max(pd.to_datetime([r.get("date") or safe_date_only(r.get("published_at")) for r in recent_items if r.get("date") or r.get("published_at")], errors="coerce").dropna(), default=recent_start)
        if pd.Timestamp(recent_end) >= recent_start:
            recent_df = empty_daily_index(recent_start.date().isoformat(), pd.Timestamp(recent_end).date().isoformat())
            recent_df = apply_items_to_daily_index(recent_df, recent_items, "recent_api_rss_manual_news")
            combined = pd.concat([combined, recent_df], ignore_index=True).drop_duplicates("date", keep="last").sort_values("date")
    paths.structured_dir.mkdir(parents=True, exist_ok=True)
    combined.to_parquet(paths.combined_daily_context_parquet, index=False)
    combined.to_csv(paths.combined_daily_context_csv, index=False)
    return combined


def build_quality(recent_rows: List[Dict[str, Any]], historical_df: pd.DataFrame, paths: Paths) -> Dict[str, Any]:
    blocking: List[str] = []
    warnings: List[str] = []
    if historical_df.empty:
        blocking.append("historical_daily_index_missing")
    if not recent_rows:
        warnings.append("No recent headline rows loaded from GDELT/RSS/NewsAPI/manual. Historical fixed index may still be available.")
    if not paths.historical_manifest.exists():
        blocking.append("historical_manifest_missing")
    required = [paths.source_inventory, paths.coverage_preview, paths.raw_news_pull_log, paths.unified_raw_json, paths.unified_raw_csv, paths.historical_index_parquet, paths.historical_index_csv, paths.combined_daily_context_parquet, paths.diagnostics, paths.timeline, paths.checkpoint]
    missing = [str(p.relative_to(paths.repo_root)) for p in required if not p.exists()]
    if missing:
        blocking.append("missing_required_outputs")
    status = "ready"
    if warnings:
        status = "ready_with_warnings"
    if blocking:
        status = "blocked_waiting_for_news_source"
    return {
        "artifact_type": "deep_ml_quality_review",
        "schema_version": "1.0.0",
        "phase_key": PHASE_KEY,
        "model_key": "source_news_update",
        "status": status,
        "blocking_flags": blocking,
        "warnings": warnings,
        "acceptance_gate": {
            "historical_daily_index_exists": paths.historical_index_parquet.exists(),
            "combined_daily_context_exists": paths.combined_daily_context_parquet.exists(),
            "recent_or_manual_news_loaded": bool(recent_rows),
            "canonical_news_directory_used": True,
            "no_news_ai_folder_used": True,
            "script_name_preserved": True,
            "professor_safe_no_causality_claims": True,
            "required_outputs_exist": not missing,
        },
        "professor_safe_summary": "Unified Source News Update builds a fixed historical daily index and recent news inventory. It does not forecast gold and does not claim causality.",
        "generated_at_utc": iso_utc(),
    }


def copy_public(paths: Paths) -> None:
    paths.public_news_dir.mkdir(parents=True, exist_ok=True)
    for src in [paths.source_inventory, paths.coverage_preview, paths.raw_news_pull_log, paths.gdelt_raw_json, paths.gdelt_raw_csv, paths.rss_raw_json, paths.rss_raw_csv, paths.newsapi_raw_json, paths.newsapi_raw_csv, paths.unified_raw_json, paths.unified_raw_csv, paths.historical_manifest, paths.historical_index_csv, paths.combined_daily_context_csv, paths.diagnostics, paths.quality_review, paths.timeline, paths.checkpoint, paths.phase_report]:
        if src.exists():
            rel = src.relative_to(paths.news_dir)
            dest = paths.public_news_dir / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Unified Phase 12 source news update.")
    p.add_argument("--repo-root", type=str, default=None)
    p.add_argument("--smoke", action="store_true")
    p.add_argument("--recent-only", action="store_true")
    p.add_argument("--historical-only", action="store_true")
    p.add_argument("--force-historical", action="store_true")
    p.add_argument("--historical-start", type=str, default=DEFAULT_HISTORICAL_START)
    p.add_argument("--recent-days", type=int, default=DEFAULT_RECENT_DAYS)
    p.add_argument("--gdelt-timespan", type=str, default="7d")
    p.add_argument("--max-records", type=int, default=30)
    p.add_argument("--historical-max-records", type=int, default=10)
    p.add_argument("--timeout", type=int, default=60)
    p.add_argument("--gdelt-delay-seconds", type=float, default=8.0)
    p.add_argument("--gdelt-retries", type=int, default=2)
    p.add_argument("--rss-delay-seconds", type=float, default=1.5)
    p.add_argument("--newsapi-key", type=str, default=None)
    p.add_argument("--newsapi-from", type=str, default=None)
    p.add_argument("--newsapi-to", type=str, default=None)
    p.add_argument("--no-gdelt", action="store_true")
    p.add_argument("--no-rss", action="store_true")
    p.add_argument("--no-newsapi", action="store_true")
    p.add_argument("--no-manual", action="store_true")
    p.add_argument("--no-public-copy", action="store_true")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve() if args.repo_root else detect_repo_root(Path.cwd())
    paths = build_paths(repo_root)
    for d in [paths.news_dir, paths.historical_dir, paths.raw_inputs_dir, paths.api_pulls_dir, paths.structured_dir, paths.public_news_dir]:
        d.mkdir(parents=True, exist_ok=True)
    logger = RunLogger(paths)
    started = utc_now()
    run_id = f"deepml_run_{started.strftime('%Y%m%d_%H%M%S')}_source_news_update"

    try:
        logger.timeline("phase12_unified_source_news_update_started", details={"run_id": run_id})
        logger.checkpoint("started", "running", {"run_id": run_id})

        study_context = read_json(paths.study_context, default={}) or {}
        mode_status = read_json(paths.mode_status, default={}) or {}
        today = pd.Timestamp.utcnow().date()
        historical_end = (pd.Timestamp(today) - pd.Timedelta(days=args.recent_days)).date().isoformat()

        run_historical = not args.recent_only
        run_recent = not args.historical_only

        historical_df = pd.DataFrame()
        historical_manifest: Dict[str, Any] = {}
        historical_logs: List[Dict[str, Any]] = []
        if run_historical:
            historical_df, historical_manifest, historical_logs = build_or_load_historical_index(
                paths=paths,
                start_date=args.historical_start,
                historical_end=historical_end,
                force=args.force_historical,
                smoke=args.smoke,
                timeout=args.timeout,
                delay=args.gdelt_delay_seconds,
                retries=args.gdelt_retries,
                max_records=args.historical_max_records,
            )
            logger.timeline("historical_daily_index_ready", details={"rows": int(len(historical_df)), "end": historical_end, "cache_used": historical_manifest.get("cache_used")})
        elif paths.historical_index_parquet.exists():
            historical_df = pd.read_parquet(paths.historical_index_parquet)
            historical_manifest = read_json(paths.historical_manifest, default={}) or {}

        gdelt_rows: List[Dict[str, Any]] = []
        gdelt_logs: List[Dict[str, Any]] = []
        rss_rows: List[Dict[str, Any]] = []
        rss_logs: List[Dict[str, Any]] = []
        newsapi_rows: List[Dict[str, Any]] = []
        newsapi_logs: List[Dict[str, Any]] = []
        manual_rows: List[Dict[str, Any]] = []
        manual_meta: Dict[str, Any] = {"manual_news_skipped": True}

        if run_recent:
            if not args.no_gdelt:
                gdelt_rows, gdelt_logs = run_gdelt_recent(args.gdelt_timespan, args.max_records, args.timeout, args.smoke, args.gdelt_delay_seconds, args.gdelt_retries)
            if not args.no_rss:
                rss_rows, rss_logs = run_rss_recent(args.timeout, args.smoke, args.rss_delay_seconds)
            newsapi_key = args.newsapi_key or os.getenv("NEWS_API_KEY") or os.getenv("NEWSAPI_KEY")
            if not args.no_newsapi:
                newsapi_rows, newsapi_logs = run_newsapi_recent(newsapi_key, args.newsapi_from, args.newsapi_to, args.max_records, args.timeout, args.smoke)
            if not args.no_manual:
                manual_rows, manual_meta = load_manual_news(paths)
            logger.timeline("recent_news_sources_pulled", details={"gdelt": len(gdelt_rows), "rss": len(rss_rows), "newsapi": len(newsapi_rows), "manual": len(manual_rows)})

        write_json(paths.gdelt_raw_json, {"source": "gdelt_doc_api", "rows": gdelt_rows, "pull_logs": gdelt_logs, "generated_at_utc": iso_utc()})
        write_csv_dicts(paths.gdelt_raw_csv, gdelt_rows)
        write_json(paths.rss_raw_json, {"source": "google_news_rss_search", "rows": rss_rows, "pull_logs": rss_logs, "generated_at_utc": iso_utc()})
        write_csv_dicts(paths.rss_raw_csv, rss_rows)
        write_json(paths.newsapi_raw_json, {"source": "newsapi", "rows": newsapi_rows, "pull_logs": newsapi_logs, "generated_at_utc": iso_utc()})
        write_csv_dicts(paths.newsapi_raw_csv, newsapi_rows)

        unified_recent = dedupe_news_items(gdelt_rows + rss_rows + newsapi_rows + manual_rows)
        for i, row in enumerate(unified_recent):
            row["unified_news_item_id"] = f"news_{i+1:05d}"
            row["phase_key"] = PHASE_KEY
            row["run_id"] = run_id
        write_json(paths.unified_raw_json, {"artifact_type": "news_items_unified_raw", "schema_version": "1.0.0", "phase_key": PHASE_KEY, "run_id": run_id, "rows": unified_recent, "generated_at_utc": iso_utc()})
        write_csv_dicts(paths.unified_raw_csv, unified_recent)

        combined_df = combine_daily_context(historical_df, unified_recent, paths) if not historical_df.empty else pd.DataFrame()

        inventory = {
            "artifact_type": "news_source_inventory",
            "schema_version": "1.0.0",
            "phase_key": PHASE_KEY,
            "canonical_directory": "artifacts/deep_ml/news",
            "script_path": "deep_ml/scripts/12_source_news_update.py",
            "sources": [
                {"source_key": "historical_daily_index", "source_type": "fixed_daily_index", "enabled": run_historical or paths.historical_index_parquet.exists(), "rows_loaded": int(len(historical_df)), "status": "ready" if not historical_df.empty else "missing"},
                {"source_key": "gdelt_doc_api", "source_type": "public_no_key_api", "enabled": run_recent and not args.no_gdelt, "rows_loaded": len(gdelt_rows), "status": "ready" if gdelt_rows else "no_rows_or_failed", "logs_preview": gdelt_logs[:5]},
                {"source_key": "google_news_rss_search", "source_type": "public_no_key_rss_recent_fallback", "enabled": run_recent and not args.no_rss, "rows_loaded": len(rss_rows), "status": "ready" if rss_rows else "no_rows_or_failed", "logs_preview": rss_logs[:5]},
                {"source_key": "newsapi", "source_type": "optional_key_api", "enabled": run_recent and any(not l.get("skipped") for l in newsapi_logs), "rows_loaded": len(newsapi_rows), "status": "ready" if newsapi_rows else "skipped_or_no_rows", "logs_preview": newsapi_logs[:5]},
                {"source_key": "manual_news_csv", "source_type": "manual_csv_backup", "enabled": manual_meta.get("manual_news_file_exists", False), "rows_loaded": len(manual_rows), "status": "ready" if manual_rows else "not_provided_or_empty", "meta": manual_meta},
            ],
            "generated_at_utc": iso_utc(),
        }
        coverage = build_coverage_preview(unified_recent, historical_df)
        raw_log = {"artifact_type": "raw_news_pull_log", "schema_version": "1.0.0", "phase_key": PHASE_KEY, "run_id": run_id, "historical_manifest": historical_manifest, "historical_logs_preview": historical_logs[:20], "gdelt_logs": gdelt_logs, "rss_logs": rss_logs, "newsapi_logs": newsapi_logs, "manual_meta": manual_meta, "generated_at_utc": iso_utc()}
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
            "historical_start_date": args.historical_start,
            "historical_end_date": historical_end,
            "recent_window_days": args.recent_days,
            "output_hashes": {"historical_index_parquet": stable_hash_file(paths.historical_index_parquet), "historical_index_csv": stable_hash_file(paths.historical_index_csv), "combined_daily_context_csv": stable_hash_file(paths.combined_daily_context_csv), "unified_raw_json": stable_hash_file(paths.unified_raw_json)},
            "professor_safe_note": "Diagnostics describe source update execution only. They do not claim news caused gold movement.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.source_inventory, inventory)
        write_json(paths.coverage_preview, coverage)
        write_json(paths.raw_news_pull_log, raw_log)
        write_json(paths.diagnostics, diagnostics)

        quality = build_quality(unified_recent, historical_df, paths)
        write_json(paths.quality_review, quality)

        report = {
            "artifact_type": "phase12_source_news_update_report",
            "schema_version": "1.0.0",
            "project": "Gold Nexus Alpha",
            "phase": "Phase 12 — Unified Source News Update",
            "phase_key": PHASE_KEY,
            "status": quality.get("status"),
            "run": {"run_id": run_id, "study_id": diagnostics.get("study_id"), "generated_at_utc": iso_utc(started), "completed_at_utc": iso_utc(), "generated_at_local": local_iso(started), "timezone_local": TIMEZONE_LOCAL, "git_commit_sha": get_git_commit(repo_root), "code_version": SCRIPT_VERSION},
            "backbone_directory_change_note": "Canonical news artifacts remain under artifacts/deep_ml/news/. Script name remains deep_ml/scripts/12_source_news_update.py. No news_ai folder is used.",
            "source_summary": {"historical_daily_rows": int(len(historical_df)), "historical_rows_with_loaded_public_source": int((historical_df["article_count"] > 0).sum()) if not historical_df.empty and "article_count" in historical_df.columns else 0, "gdelt_recent_rows": len(gdelt_rows), "rss_recent_rows": len(rss_rows), "newsapi_recent_rows": len(newsapi_rows), "manual_recent_rows": len(manual_rows), "unified_recent_rows_after_dedupe": len(unified_recent), "combined_daily_context_rows": int(len(combined_df)) if not combined_df.empty else 0},
            "historical_manifest_snapshot": historical_manifest,
            "source_inventory_snapshot": inventory,
            "coverage_preview_snapshot": coverage,
            "diagnostics_snapshot": diagnostics,
            "quality_review": quality,
            "outputs": {"historical_index_parquet": str(paths.historical_index_parquet.relative_to(repo_root)), "historical_index_csv": str(paths.historical_index_csv.relative_to(repo_root)), "historical_manifest": str(paths.historical_manifest.relative_to(repo_root)), "combined_daily_context_parquet": str(paths.combined_daily_context_parquet.relative_to(repo_root)), "combined_daily_context_csv": str(paths.combined_daily_context_csv.relative_to(repo_root)), "unified_recent_json": str(paths.unified_raw_json.relative_to(repo_root)), "unified_recent_csv": str(paths.unified_raw_csv.relative_to(repo_root)), "source_inventory": str(paths.source_inventory.relative_to(repo_root)), "quality_review": str(paths.quality_review.relative_to(repo_root)), "timeline": str(paths.timeline.relative_to(repo_root)), "progress_checkpoint": str(paths.checkpoint.relative_to(repo_root))},
            "ai_grounding": {"allowed_claims": ["Phase 12 builds a historical daily news index plus recent news inventory under canonical Deep ML news artifacts.", "Recent headlines may be used later for Gamma tooltips/context.", "Historical rows are continuity/index rows and clearly mark coverage limitations."], "forbidden_claims": ["This source update proves news caused gold prices to move.", "Google News RSS provides complete historical news from 2006.", "Zero historical score means no news existed.", "This source update forecasts gold prices."]},
            "professor_safe_summary": "Phase 12 builds a fixed historical daily news index and recent news inventory for Gamma. It summarizes source coverage and does not make causal claims.",
            "next_step": {"phase": "Phase 13 — Build News Context From Source Update", "script": "deep_ml/scripts/13_build_news_context_from_api.py", "instruction": "Review this report first. If ready, structure/classify historical + recent news context for Gamma."},
            "final_instruction": "Send me artifacts/deep_ml/news/phase12_source_news_update_report.json for review before News Context or Gamma.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.phase_report, report)

        if not args.no_public_copy:
            copy_public(paths)
        logger.checkpoint("completed", quality.get("status", "ready"), {"send_me_this_json": str(paths.phase_report.relative_to(repo_root))})
        logger.timeline("phase12_unified_source_news_update_completed", status=quality.get("status", "ready"))
        print("\n" + "=" * 88)
        print("PHASE 12 UNIFIED SOURCE NEWS UPDATE COMPLETE")
        print("Send me this JSON for review:")
        print("artifacts/deep_ml/news/phase12_source_news_update_report.json")
        print("=" * 88 + "\n")
        return 0

    except Exception as exc:
        err = {"artifact_type": "phase12_source_news_update_error_report", "schema_version": "1.0.0", "project": "Gold Nexus Alpha", "phase_key": PHASE_KEY, "status": "failed", "run_id": run_id, "error": repr(exc), "traceback": traceback.format_exc(), "generated_at_utc": iso_utc(), "final_instruction": "Fix the error and rerun Phase 12 before moving to News Context or Gamma."}
        write_json(paths.phase_report, err)
        logger.checkpoint("failed", "failed", {"error": repr(exc)})
        print("\nPHASE 12 FAILED. Review:")
        print("artifacts/deep_ml/news/phase12_source_news_update_report.json")
        raise


if __name__ == "__main__":
    raise SystemExit(main())
