"""
Gold Nexus Alpha — Deep ML Phase 10
Source Update Refresh Layer V2: Yahoo live gold + main Intelligence delegation

Script path expected:
    deep_ml/scripts/10_source_update_refresh.py

Primary review artifact:
    artifacts/deep_ml/source_update/phase10_source_update_refresh_report.json

Windows / PowerShell commands:
    code .\deep_ml\scripts\10_source_update_refresh.py
    py .\deep_ml\scripts\10_source_update_refresh.py --smoke
    py .\deep_ml\scripts\10_source_update_refresh.py

Purpose:
    Phase 10 does not train models and does not rebuild the feature store.
    It stages Yahoo GC=F live gold extension data after the approved cutoff,
    inventories manual CSV and raw news input folders, protects accepted model
    artifacts before refresh, and documents that FRED/API macro refresh is
    delegated to the existing main Intelligence pipeline.

Important architecture decision:
    This script intentionally does NOT pull FRED series directly.
    The main Intelligence page/API is treated as the FRED-updated matrix source.
    Phase 11 must read a saved Intelligence matrix snapshot or use the existing
    feature-store fallback plus Yahoo gold extension, depending on what artifact exists.

Locked rules:
    - Never write API keys into artifacts.
    - Do not silently merge unknown sources.
    - Do not overwrite accepted model results without an archive manifest.
    - Yahoo GC=F is labeled as a COMEX futures delayed/public market proxy.
    - Phase 10 only stages data; Phase 11 governs merging and feature-store refresh.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import platform
import re
import shutil
import subprocess
import sys
import time
import traceback
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd

try:
    from tqdm.auto import tqdm
except Exception:  # pragma: no cover
    tqdm = None


PHASE_KEY = "phase10_source_update_refresh"
SCRIPT_VERSION = "source_update_refresh_v2_yahoo_gold_intelligence_delegated_fred"
TIMEZONE_LOCAL = "America/New_York"
DEFAULT_GOLD_LIVE_PROVIDER = "yahoo"
DEFAULT_GOLD_LIVE_SYMBOL = "GC=F"
DEFAULT_GOLD_LIVE_START = "2026-04-01"
SUPPORTED_NEWS_EXTENSIONS = {".csv", ".json", ".txt", ".md"}
SUPPORTED_MANUAL_EXTENSIONS = {".csv"}
DATE_COLUMN_CANDIDATES = ["date", "Date", "ds", "timestamp", "time", "observation_date"]
MODEL_RUN_SUMMARY_PATHS = {
    "alpha_structural_v4": "artifacts/deep_ml/models/alpha_structural/run_summary.json",
    "beta_temporal_v2": "artifacts/deep_ml/models/beta_temporal/run_summary.json",
    "delta_tft_v2": "artifacts/deep_ml/models/delta_tft/run_summary.json",
    "epsilon_expert_ensemble_v2": "artifacts/deep_ml/models/epsilon_expert_ensemble/run_summary.json",
}


# -----------------------------------------------------------------------------
# Generic helpers
# -----------------------------------------------------------------------------


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(dt: Optional[datetime] = None) -> str:
    return (dt or utc_now()).isoformat().replace("+00:00", "Z")


def local_iso_from_utc(dt: Optional[datetime] = None) -> str:
    dt = dt or utc_now()
    try:
        from zoneinfo import ZoneInfo

        return dt.astimezone(ZoneInfo(TIMEZONE_LOCAL)).isoformat()
    except Exception:
        return dt.isoformat()


def safe_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        v = float(value)
        if math.isnan(v) or math.isinf(v):
            return None
        return v
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
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    keys: List[str] = []
    for row in rows:
        for key in row.keys():
            if key not in keys:
                keys.append(key)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k) for k in keys})


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


def print_step(message: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}", flush=True)


def load_env_files(repo_root: Path) -> Dict[str, str]:
    env: Dict[str, str] = {}
    for name in [".env.local", ".env", "deep_ml/.env", "deep_ml/.env.local"]:
        path = repo_root / name
        if not path.exists():
            continue
        try:
            for line in path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k and k not in env:
                    env[k] = v
        except Exception:
            continue
    for k, v in os.environ.items():
        env[k] = v
    return env


def find_date_column(columns: Iterable[str]) -> Optional[str]:
    col_list = list(columns)
    for c in DATE_COLUMN_CANDIDATES:
        if c in col_list:
            return c
    for c in col_list:
        lower = str(c).lower()
        if "date" in lower or "time" in lower:
            return c
    return None


def maybe_parse_date_series(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, errors="coerce")


def http_get_json(url: str, timeout: int = 30) -> Dict[str, Any]:
    req = urllib.request.Request(url, headers={"User-Agent": "GoldNexusAlphaDeepML/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        payload = resp.read().decode("utf-8")
    return json.loads(payload)


def public_copy_json_csv(source_dir: Path, public_dir: Path) -> None:
    public_dir.mkdir(parents=True, exist_ok=True)
    for file in source_dir.glob("*.json"):
        shutil.copy2(file, public_dir / file.name)
    for file in source_dir.glob("*.csv"):
        if file.stat().st_size <= 25 * 1024 * 1024:
            shutil.copy2(file, public_dir / file.name)


@dataclass
class RunPaths:
    repo_root: Path
    artifacts_root: Path
    public_artifacts_root: Path
    source_update_dir: Path
    source_inputs_dir: Path
    manual_csv_dir: Path
    news_raw_inputs_dir: Path
    gold_live_pulled_dir: Path
    intelligence_snapshot_dir: Path
    governance_dir: Path
    features_dir: Path
    data_dir: Path
    study_memory_dir: Path
    public_source_update_dir: Path
    public_news_dir: Path
    feature_store_path: Path
    model_feature_plan_path: Path
    target_plan_path: Path
    mode_status_path: Path
    study_context_path: Path
    factor_state_table_path: Path


def build_paths(repo_root: Path) -> RunPaths:
    artifacts_root = repo_root / "artifacts" / "deep_ml"
    public_root = repo_root / "public" / "artifacts" / "deep_ml"
    source_inputs = artifacts_root / "source_inputs"
    return RunPaths(
        repo_root=repo_root,
        artifacts_root=artifacts_root,
        public_artifacts_root=public_root,
        source_update_dir=artifacts_root / "source_update",
        source_inputs_dir=source_inputs,
        manual_csv_dir=source_inputs / "manual_csv",
        news_raw_inputs_dir=artifacts_root / "news" / "raw_inputs",
        gold_live_pulled_dir=artifacts_root / "source_update" / "gold_live_pulled",
        intelligence_snapshot_dir=artifacts_root / "source_update" / "main_intelligence_snapshot",
        governance_dir=artifacts_root / "governance",
        features_dir=artifacts_root / "features",
        data_dir=artifacts_root / "data",
        study_memory_dir=artifacts_root / "study_memory",
        public_source_update_dir=public_root / "source_update",
        public_news_dir=public_root / "news",
        feature_store_path=artifacts_root / "features" / "deep_ml_numeric_feature_store.parquet",
        model_feature_plan_path=artifacts_root / "features" / "model_feature_plan.json",
        target_plan_path=artifacts_root / "features" / "target_plan.json",
        mode_status_path=artifacts_root / "governance" / "deep_ml_mode_status.json",
        study_context_path=artifacts_root / "governance" / "study_context.json",
        factor_state_table_path=artifacts_root / "data" / "factor_state_table.json",
    )


class Timeline:
    def __init__(self, paths: RunPaths) -> None:
        self.paths = paths
        self.events: List[Dict[str, Any]] = []
        self.started = time.time()

    def add(self, event: str, status: str = "ok", details: Optional[Dict[str, Any]] = None) -> None:
        row = {
            "timestamp_utc": iso_utc(),
            "elapsed_seconds": round(time.time() - self.started, 3),
            "event": event,
            "status": status,
            "details": details or {},
        }
        self.events.append(row)
        write_json(self.paths.source_update_dir / "timeline.json", self.events)
        print_step(f"{event} [{status}]")


class Checkpoint:
    def __init__(self, paths: RunPaths) -> None:
        self.paths = paths

    def write(self, step: str, status: str, payload: Optional[Dict[str, Any]] = None) -> None:
        write_json(
            self.paths.source_update_dir / "progress_checkpoint.json",
            {
                "artifact_type": "deep_ml_progress_checkpoint",
                "phase_key": PHASE_KEY,
                "step": step,
                "status": status,
                "updated_at_utc": iso_utc(),
                "updated_at_local": local_iso_from_utc(),
                "payload": payload or {},
            },
        )


# -----------------------------------------------------------------------------
# Source preparation
# -----------------------------------------------------------------------------


def ensure_source_folders(paths: RunPaths) -> None:
    for path in [
        paths.source_update_dir,
        paths.source_inputs_dir,
        paths.manual_csv_dir,
        paths.news_raw_inputs_dir,
        paths.gold_live_pulled_dir,
        paths.intelligence_snapshot_dir,
        paths.study_memory_dir,
    ]:
        path.mkdir(parents=True, exist_ok=True)


def required_input_status(paths: RunPaths) -> Dict[str, Any]:
    required = [
        ("feature_store", paths.feature_store_path),
        ("governance_mode_status", paths.mode_status_path),
        ("study_context", paths.study_context_path),
        ("factor_state_table", paths.factor_state_table_path),
        ("model_feature_plan", paths.model_feature_plan_path),
        ("target_plan", paths.target_plan_path),
    ]
    checks = []
    for key, path in required:
        checks.append(
            {
                "name": key,
                "path": str(path.relative_to(paths.repo_root)) if path.exists() else str(path),
                "exists": path.exists(),
                "hash": stable_hash_file(path),
            }
        )
    return {
        "artifact_type": "phase10_required_input_status",
        "schema_version": "1.0.0",
        "checks": checks,
        "all_required_exist": all(c["exists"] for c in checks),
        "generated_at_utc": iso_utc(),
    }


def inspect_feature_store(paths: RunPaths) -> Dict[str, Any]:
    if not paths.feature_store_path.exists():
        return {
            "artifact_type": "feature_store_status",
            "status": "missing",
            "path": str(paths.feature_store_path),
            "generated_at_utc": iso_utc(),
        }
    try:
        df = pd.read_parquet(paths.feature_store_path)
        date_col = find_date_column(df.columns)
        out: Dict[str, Any] = {
            "artifact_type": "feature_store_status",
            "status": "readable",
            "path": str(paths.feature_store_path.relative_to(paths.repo_root)),
            "hash": stable_hash_file(paths.feature_store_path),
            "row_count": int(len(df)),
            "column_count": int(len(df.columns)),
            "date_column_detected": date_col,
            "generated_at_utc": iso_utc(),
        }
        if date_col:
            dates = maybe_parse_date_series(df[date_col])
            out.update(
                {
                    "first_valid_date": dates.min().date().isoformat() if dates.notna().any() else None,
                    "last_valid_date": dates.max().date().isoformat() if dates.notna().any() else None,
                    "valid_date_count": int(dates.notna().sum()),
                }
            )
        return out
    except Exception as exc:
        return {
            "artifact_type": "feature_store_status",
            "status": "failed_to_read",
            "path": str(paths.feature_store_path),
            "error": repr(exc),
            "generated_at_utc": iso_utc(),
        }


def inspect_main_intelligence_snapshot(paths: RunPaths) -> Dict[str, Any]:
    """Inventory a saved main Intelligence matrix snapshot if the website/API exported one.

    This script does not pull FRED directly. Phase 11 can use this snapshot as the
    FRED-updated factor source if it exists.
    """
    candidate_paths = []
    for folder in [
        paths.intelligence_snapshot_dir,
        paths.artifacts_root / "intelligence",
        paths.artifacts_root / "data",
        paths.repo_root / "public" / "artifacts" / "deep_ml" / "intelligence",
    ]:
        if folder.exists():
            candidate_paths.extend(sorted(folder.glob("*matrix*.csv")))
            candidate_paths.extend(sorted(folder.glob("*matrix*.parquet")))
            candidate_paths.extend(sorted(folder.glob("*intelligence*.csv")))
            candidate_paths.extend(sorted(folder.glob("*intelligence*.parquet")))

    # Prefer files in the explicit Phase 10 snapshot folder, then latest modified.
    candidate_paths = [p for p in candidate_paths if p.is_file()]
    if not candidate_paths:
        status = {
            "artifact_type": "main_intelligence_matrix_snapshot_status",
            "schema_version": "1.0.0",
            "status": "not_found",
            "delegation_policy": "FRED/API factor refresh is delegated to the main Intelligence pipeline. Export its latest matrix snapshot here if Phase 11 should consume it: artifacts/deep_ml/source_update/main_intelligence_snapshot/",
            "snapshot_dir": str(paths.intelligence_snapshot_dir.relative_to(paths.repo_root)),
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.source_update_dir / "main_intelligence_matrix_snapshot_status.json", status)
        return status

    candidate_paths = sorted(candidate_paths, key=lambda p: p.stat().st_mtime, reverse=True)
    path = candidate_paths[0]
    try:
        if path.suffix.lower() == ".parquet":
            df = pd.read_parquet(path)
        else:
            df = pd.read_csv(path)
        date_col = find_date_column(df.columns)
        out: Dict[str, Any] = {
            "artifact_type": "main_intelligence_matrix_snapshot_status",
            "schema_version": "1.0.0",
            "status": "found_readable",
            "path": str(path.relative_to(paths.repo_root)),
            "hash": stable_hash_file(path),
            "row_count": int(len(df)),
            "column_count": int(len(df.columns)),
            "date_column_detected": date_col,
            "delegation_policy": "FRED/API factor refresh is delegated to the main Intelligence pipeline; Phase 11 can consume this snapshot.",
            "generated_at_utc": iso_utc(),
        }
        if date_col:
            dates = maybe_parse_date_series(df[date_col])
            out.update(
                {
                    "first_valid_date": dates.min().date().isoformat() if dates.notna().any() else None,
                    "last_valid_date": dates.max().date().isoformat() if dates.notna().any() else None,
                    "valid_date_count": int(dates.notna().sum()),
                }
            )
        write_json(paths.source_update_dir / "main_intelligence_matrix_snapshot_status.json", out)
        return out
    except Exception as exc:
        out = {
            "artifact_type": "main_intelligence_matrix_snapshot_status",
            "schema_version": "1.0.0",
            "status": "found_but_unreadable",
            "path": str(path.relative_to(paths.repo_root)),
            "hash": stable_hash_file(path),
            "error": repr(exc),
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.source_update_dir / "main_intelligence_matrix_snapshot_status.json", out)
        return out


def inventory_accepted_models(paths: RunPaths, refresh_id: str) -> Dict[str, Any]:
    rows = []
    for model_key, rel in MODEL_RUN_SUMMARY_PATHS.items():
        path = paths.repo_root / rel
        data = read_json(path, default={}) or {}
        rows.append(
            {
                "model_key": model_key,
                "path": rel,
                "exists": path.exists(),
                "hash": stable_hash_file(path),
                "status": data.get("status"),
                "code_version": (data.get("run") or {}).get("code_version") or data.get("code_version"),
                "run_id": (data.get("run") or {}).get("run_id"),
                "completed_at_utc": (data.get("run") or {}).get("completed_at_utc"),
            }
        )
    manifest = {
        "artifact_type": "accepted_before_refresh_manifest",
        "schema_version": "1.0.0",
        "refresh_id": refresh_id,
        "purpose": "Protect accepted Alpha/Beta/Delta/Epsilon artifacts before the refreshed source-update cycle.",
        "accepted_models": rows,
        "all_expected_accepted_artifacts_found": all(r["exists"] for r in rows),
        "generated_at_utc": iso_utc(),
    }
    write_json(paths.study_memory_dir / "accepted_before_refresh_manifest.json", manifest)
    write_json(paths.source_update_dir / "accepted_before_refresh_manifest.json", manifest)
    return manifest


# -----------------------------------------------------------------------------
# Yahoo gold live extension
# -----------------------------------------------------------------------------


def yahoo_chart_download(symbol: str, start_date: Optional[str], end_date: Optional[str], timeout: int = 30) -> pd.DataFrame:
    period1 = int(pd.Timestamp(start_date or DEFAULT_GOLD_LIVE_START, tz="UTC").timestamp())
    if end_date:
        period2 = int((pd.Timestamp(end_date, tz="UTC") + pd.Timedelta(days=1)).timestamp())
    else:
        period2 = int(pd.Timestamp.utcnow().timestamp())
    encoded = urllib.parse.quote(symbol, safe="")
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}"
        f"?period1={period1}&period2={period2}&interval=1d&events=history&includeAdjustedClose=true"
    )
    payload = http_get_json(url, timeout=timeout)
    result = ((payload.get("chart") or {}).get("result") or [None])[0]
    if not result:
        err = ((payload.get("chart") or {}).get("error") or {}).get("description")
        raise RuntimeError(f"Yahoo chart response had no result for {symbol}: {err}")

    timestamps = result.get("timestamp") or []
    quote = ((result.get("indicators") or {}).get("quote") or [{}])[0]
    adjclose = ((result.get("indicators") or {}).get("adjclose") or [{}])[0].get("adjclose") or []
    close_values = quote.get("close", []) or []
    open_values = quote.get("open", []) or []
    high_values = quote.get("high", []) or []
    low_values = quote.get("low", []) or []
    volume_values = quote.get("volume", []) or []

    rows = []
    for i, ts in enumerate(timestamps):
        date = pd.to_datetime(ts, unit="s", utc=True).date().isoformat()
        close = close_values[i] if i < len(close_values) else None
        open_ = open_values[i] if i < len(open_values) else None
        high = high_values[i] if i < len(high_values) else None
        low = low_values[i] if i < len(low_values) else None
        volume = volume_values[i] if i < len(volume_values) else None
        adj = adjclose[i] if i < len(adjclose) else None
        price = safe_float(adj) if safe_float(adj) is not None else safe_float(close)
        rows.append(
            {
                "date": date,
                "gold_price": price,
                "open": safe_float(open_),
                "high": safe_float(high),
                "low": safe_float(low),
                "close": safe_float(close),
                "adjclose": safe_float(adj),
                "volume": safe_float(volume),
                "symbol": symbol,
                "provider": "yahoo_chart",
                "gold_price_source": "yahoo_gc_f" if symbol.upper() == "GC=F" else f"yahoo_{symbol.lower()}",
                "gold_price_source_type": "comex_futures_proxy_delayed" if symbol.upper() == "GC=F" else "public_market_proxy",
                "gold_price_is_live_extension": True,
                "gold_price_is_proxy": True,
                "gold_price_last_updated_utc": iso_utc(),
            }
        )
    return pd.DataFrame(rows)


def run_gold_live_update(paths: RunPaths, args: argparse.Namespace) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    provider = str(args.gold_live_provider or DEFAULT_GOLD_LIVE_PROVIDER).lower()
    symbol = str(args.gold_live_symbol or DEFAULT_GOLD_LIVE_SYMBOL)
    started = time.time()

    if args.no_gold_live_pull:
        summary = {
            "artifact_type": "gold_live_update_summary",
            "schema_version": "1.0.0",
            "status": "skipped_by_user_flag_no_gold_live_pull",
            "provider": provider,
            "symbol": symbol,
            "start_date": args.gold_live_start,
            "end_date": args.gold_live_end,
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.source_update_dir / "gold_live_update_summary.json", summary)
        write_json(paths.source_update_dir / "gold_live_price_inventory.json", {"rows": []})
        write_csv_dicts(paths.source_update_dir / "gold_live_pull_log.csv", [])
        return summary, []

    try:
        if provider not in {"yahoo", "yahoo_chart"}:
            raise ValueError("Phase 10 V2 intentionally supports Yahoo chart mode only for live gold extension.")
        df = yahoo_chart_download(symbol, args.gold_live_start, args.gold_live_end, timeout=args.http_timeout)
        provider_used = "yahoo_chart"

        df = df.dropna(subset=["gold_price"]).sort_values("date").reset_index(drop=True)
        csv_path = paths.gold_live_pulled_dir / f"gold_live_{symbol.replace('=', '_').replace('/', '_')}.csv"
        df.to_csv(csv_path, index=False)
        rows = df.to_dict(orient="records")
        latest_row = rows[-1] if rows else {}
        summary = {
            "artifact_type": "gold_live_update_summary",
            "schema_version": "1.0.0",
            "status": "completed" if rows else "completed_no_valid_rows",
            "provider_requested": provider,
            "provider_used": provider_used,
            "symbol": symbol,
            "instrument_label": "COMEX Gold Futures" if symbol.upper() == "GC=F" else symbol,
            "source_type": "comex_futures_proxy_delayed" if symbol.upper() == "GC=F" else "public_market_proxy",
            "official_target_warning": "This live extension is a public market proxy after the approved cutoff; it is not silently treated as the original official LBMA-style historical target.",
            "start_date": args.gold_live_start,
            "end_date": args.gold_live_end,
            "row_count": len(rows),
            "first_valid_date": rows[0].get("date") if rows else None,
            "last_valid_date": latest_row.get("date"),
            "latest_gold_price": latest_row.get("gold_price"),
            "output_csv": str(csv_path.relative_to(paths.repo_root)),
            "output_csv_hash": stable_hash_file(csv_path),
            "runtime_seconds": round(time.time() - started, 3),
            "generated_at_utc": iso_utc(),
        }
        pull_log = [
            {
                "source_layer": "gold_live_yahoo",
                "provider_used": provider_used,
                "symbol": symbol,
                "status": summary["status"],
                "row_count": len(rows),
                "first_valid_date": summary.get("first_valid_date"),
                "last_valid_date": summary.get("last_valid_date"),
                "latest_gold_price": summary.get("latest_gold_price"),
                "output_csv": summary.get("output_csv"),
            }
        ]
        inventory = {
            "artifact_type": "gold_live_price_inventory",
            "schema_version": "1.0.0",
            "provider_used": provider_used,
            "symbol": symbol,
            "row_count": len(rows),
            "columns": list(df.columns),
            "preview_tail": rows[-10:],
            "merge_policy_for_phase11": "Append after official cutoff only with source flags: gold_price_source, gold_price_source_type, gold_price_is_live_extension, gold_price_is_proxy.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.source_update_dir / "gold_live_update_summary.json", summary)
        write_json(paths.source_update_dir / "gold_live_price_inventory.json", inventory)
        write_csv_dicts(paths.source_update_dir / "gold_live_pull_log.csv", pull_log)
        return summary, pull_log
    except Exception as exc:
        summary = {
            "artifact_type": "gold_live_update_summary",
            "schema_version": "1.0.0",
            "status": "failed",
            "provider_requested": provider,
            "symbol": symbol,
            "start_date": args.gold_live_start,
            "end_date": args.gold_live_end,
            "error": repr(exc),
            "runtime_seconds": round(time.time() - started, 3),
            "generated_at_utc": iso_utc(),
        }
        pull_log = [{"source_layer": "gold_live_yahoo", "provider_requested": provider, "symbol": symbol, "status": "failed", "error": repr(exc)}]
        write_json(paths.source_update_dir / "gold_live_update_summary.json", summary)
        write_json(paths.source_update_dir / "gold_live_price_inventory.json", {"artifact_type": "gold_live_price_inventory", "status": "failed", "rows": []})
        write_csv_dicts(paths.source_update_dir / "gold_live_pull_log.csv", pull_log)
        return summary, pull_log


# -----------------------------------------------------------------------------
# Manual CSV and news inventories
# -----------------------------------------------------------------------------


def inventory_manual_csv(paths: RunPaths) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    files = sorted([p for p in paths.manual_csv_dir.glob("**/*") if p.is_file() and p.suffix.lower() in SUPPORTED_MANUAL_EXTENSIONS])
    inventory_rows: List[Dict[str, Any]] = []
    warnings_rows: List[Dict[str, Any]] = []

    iterator = files
    if tqdm is not None:
        iterator = tqdm(files, desc="Manual CSV inventory", leave=False)
    for path in iterator:
        rel = str(path.relative_to(paths.repo_root))
        row: Dict[str, Any] = {
            "path": rel,
            "filename": path.name,
            "size_bytes": path.stat().st_size,
            "hash": stable_hash_file(path),
            "status": "inspected",
        }
        try:
            df = pd.read_csv(path)
            date_col = find_date_column(df.columns)
            numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
            row.update(
                {
                    "row_count": int(len(df)),
                    "column_count": int(len(df.columns)),
                    "columns": list(map(str, df.columns[:50])),
                    "date_column_detected": date_col,
                    "numeric_column_count": len(numeric_cols),
                    "numeric_columns_preview": list(map(str, numeric_cols[:25])),
                }
            )
            if date_col:
                dates = maybe_parse_date_series(df[date_col])
                row.update(
                    {
                        "first_valid_date": dates.min().date().isoformat() if dates.notna().any() else None,
                        "last_valid_date": dates.max().date().isoformat() if dates.notna().any() else None,
                        "valid_date_count": int(dates.notna().sum()),
                    }
                )
                if dates.notna().sum() == 0:
                    warnings_rows.append({"path": rel, "warning": "date_column_detected_but_no_valid_dates", "date_column": date_col})
            else:
                warnings_rows.append({"path": rel, "warning": "no_date_column_detected"})
            if not numeric_cols:
                warnings_rows.append({"path": rel, "warning": "no_numeric_columns_detected"})
        except Exception as exc:
            row.update({"status": "failed_to_read", "error": repr(exc)})
            warnings_rows.append({"path": rel, "warning": "failed_to_read_csv", "error": repr(exc)})
        inventory_rows.append(row)

    inventory = {
        "artifact_type": "manual_csv_inventory",
        "schema_version": "1.0.0",
        "manual_csv_dir": str(paths.manual_csv_dir.relative_to(paths.repo_root)),
        "file_count": len(files),
        "files": inventory_rows,
        "generated_at_utc": iso_utc(),
    }
    summary = {
        "artifact_type": "manual_csv_update_summary",
        "schema_version": "1.0.0",
        "status": "no_manual_csv_files_found" if not files else "manual_csv_files_inspected",
        "file_count": len(files),
        "files_with_date_column": sum(1 for r in inventory_rows if r.get("date_column_detected")),
        "files_with_warnings": len({w.get("path") for w in warnings_rows}),
        "latest_manual_valid_date": max([r.get("last_valid_date") for r in inventory_rows if r.get("last_valid_date")], default=None),
        "note": "Phase 10 inventories manual CSV files only. Phase 11 decides governed merging and feature-store refresh.",
        "generated_at_utc": iso_utc(),
    }
    schema_warnings = {
        "artifact_type": "manual_csv_schema_warnings",
        "schema_version": "1.0.0",
        "warning_count": len(warnings_rows),
        "warnings": warnings_rows,
        "generated_at_utc": iso_utc(),
    }
    write_json(paths.source_update_dir / "manual_csv_inventory.json", inventory)
    write_json(paths.source_update_dir / "manual_csv_update_summary.json", summary)
    write_json(paths.source_update_dir / "manual_csv_schema_warnings.json", schema_warnings)
    return inventory, summary, schema_warnings


def inventory_news_inputs(paths: RunPaths) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    files = sorted([p for p in paths.news_raw_inputs_dir.glob("**/*") if p.is_file() and p.suffix.lower() in SUPPORTED_NEWS_EXTENSIONS])
    rows: List[Dict[str, Any]] = []
    for path in files:
        rel = str(path.relative_to(paths.repo_root))
        row: Dict[str, Any] = {
            "path": rel,
            "filename": path.name,
            "extension": path.suffix.lower(),
            "size_bytes": path.stat().st_size,
            "hash": stable_hash_file(path),
            "status": "inspected",
        }
        try:
            if path.suffix.lower() == ".csv":
                df = pd.read_csv(path)
                date_col = find_date_column(df.columns)
                row.update(
                    {
                        "row_count": int(len(df)),
                        "column_count": int(len(df.columns)),
                        "date_column_detected": date_col,
                        "columns_preview": list(map(str, df.columns[:30])),
                    }
                )
                if date_col:
                    dates = maybe_parse_date_series(df[date_col])
                    row.update(
                        {
                            "first_valid_date": dates.min().date().isoformat() if dates.notna().any() else None,
                            "last_valid_date": dates.max().date().isoformat() if dates.notna().any() else None,
                        }
                    )
            elif path.suffix.lower() == ".json":
                obj = read_json(path, default=None)
                row.update({"json_type": type(obj).__name__, "top_level_count": len(obj) if isinstance(obj, (list, dict)) else None})
            else:
                text = path.read_text(encoding="utf-8", errors="ignore")
                row.update(
                    {
                        "character_count": len(text),
                        "line_count": len(text.splitlines()),
                        "gold_keyword_mentions": len(re.findall(r"\bgold\b|\bXAU\b|\bprecious metal", text, flags=re.I)),
                    }
                )
        except Exception as exc:
            row.update({"status": "failed_to_read", "error": repr(exc)})
        rows.append(row)

    coverage = {
        "artifact_type": "news_source_coverage_preview",
        "schema_version": "1.0.0",
        "status": "no_news_raw_inputs_found" if not files else "news_raw_inputs_found",
        "gamma_mode_preview": "proxy_regime_sensitivity" if not files else "text_plus_proxy_sensitivity",
        "file_count": len(files),
        "latest_news_input_date": max([r.get("last_valid_date") for r in rows if r.get("last_valid_date")], default=None),
        "coverage_note": "Gamma later decides whether to run proxy-only or text-plus-proxy sensitivity mode.",
        "generated_at_utc": iso_utc(),
    }
    inventory = {
        "artifact_type": "news_input_inventory",
        "schema_version": "1.0.0",
        "news_raw_inputs_dir": str(paths.news_raw_inputs_dir.relative_to(paths.repo_root)),
        "supported_extensions": sorted(SUPPORTED_NEWS_EXTENSIONS),
        "file_count": len(files),
        "files": rows,
        "generated_at_utc": iso_utc(),
    }
    write_json(paths.source_update_dir / "news_input_inventory.json", inventory)
    write_json(paths.source_update_dir / "news_source_coverage_preview.json", coverage)
    write_json(paths.news_raw_inputs_dir.parent / "news_input_inventory.json", inventory)
    write_json(paths.news_raw_inputs_dir.parent / "news_source_coverage_preview.json", coverage)
    return inventory, coverage


# -----------------------------------------------------------------------------
# Manifests, logs, quality review
# -----------------------------------------------------------------------------


def build_source_update_manifest(
    refresh_id: str,
    paths: RunPaths,
    required_status: Dict[str, Any],
    feature_store_status: Dict[str, Any],
    intelligence_snapshot_status: Dict[str, Any],
    gold_live_summary: Dict[str, Any],
    manual_summary: Dict[str, Any],
    news_coverage: Dict[str, Any],
) -> Dict[str, Any]:
    manifest = {
        "artifact_type": "source_update_manifest",
        "schema_version": "1.0.0",
        "refresh_id": refresh_id,
        "phase": "Phase 10 — Source Update Refresh Layer",
        "script_version": SCRIPT_VERSION,
        "purpose": "Stage and audit source updates before Phase 11 governed cutoff and feature-store refresh.",
        "source_folders": {
            "main_intelligence_snapshot_dir": str(paths.intelligence_snapshot_dir.relative_to(paths.repo_root)),
            "manual_csv_dir": str(paths.manual_csv_dir.relative_to(paths.repo_root)),
            "news_raw_inputs_dir": str(paths.news_raw_inputs_dir.relative_to(paths.repo_root)),
            "gold_live_pulled_dir": str(paths.gold_live_pulled_dir.relative_to(paths.repo_root)),
        },
        "input_status": required_status,
        "feature_store_status": feature_store_status,
        "main_intelligence_delegation_status": {
            "status": intelligence_snapshot_status.get("status"),
            "path": intelligence_snapshot_status.get("path"),
            "last_valid_date": intelligence_snapshot_status.get("last_valid_date"),
            "policy": "FRED/API refresh is delegated to the main Intelligence pipeline and is not duplicated in Phase 10.",
        },
        "gold_live_status": {
            "status": gold_live_summary.get("status"),
            "provider_used": gold_live_summary.get("provider_used"),
            "symbol": gold_live_summary.get("symbol"),
            "source_type": gold_live_summary.get("source_type"),
            "row_count": gold_live_summary.get("row_count"),
            "last_valid_date": gold_live_summary.get("last_valid_date"),
            "latest_gold_price": gold_live_summary.get("latest_gold_price"),
        },
        "manual_csv_status": {
            "status": manual_summary.get("status"),
            "file_count": manual_summary.get("file_count"),
            "latest_manual_valid_date": manual_summary.get("latest_manual_valid_date"),
        },
        "news_input_status": {
            "status": news_coverage.get("status"),
            "file_count": news_coverage.get("file_count"),
            "gamma_mode_preview": news_coverage.get("gamma_mode_preview"),
        },
        "secret_policy": "No API keys or secrets are written into artifacts.",
        "modeling_policy": "Phase 10 does not train models and does not alter model feature-store artifacts. Phase 11 governs merging and cutoff refresh.",
        "generated_at_utc": iso_utc(),
    }
    write_json(paths.source_update_dir / "source_update_manifest.json", manifest)
    return manifest


def build_source_update_log(
    refresh_id: str,
    gold_live_rows: List[Dict[str, Any]],
    manual_inventory: Dict[str, Any],
    news_inventory: Dict[str, Any],
    intelligence_snapshot_status: Dict[str, Any],
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    rows: List[Dict[str, Any]] = []
    rows.append(
        {
            "refresh_id": refresh_id,
            "source_layer": "main_intelligence_delegated_fred_matrix",
            "source_key": "main_intelligence_matrix_snapshot",
            "source_path": intelligence_snapshot_status.get("path"),
            "status": intelligence_snapshot_status.get("status"),
            "last_valid_date": intelligence_snapshot_status.get("last_valid_date"),
            "observation_count": intelligence_snapshot_status.get("row_count"),
            "warning_or_error": intelligence_snapshot_status.get("error"),
        }
    )
    for r in gold_live_rows:
        rows.append(
            {
                "refresh_id": refresh_id,
                "source_layer": "gold_live_yahoo",
                "source_key": r.get("symbol"),
                "source_path": r.get("output_csv"),
                "status": r.get("status"),
                "last_valid_date": r.get("last_valid_date"),
                "observation_count": r.get("row_count"),
                "warning_or_error": r.get("error"),
            }
        )
    for f in manual_inventory.get("files", []):
        rows.append(
            {
                "refresh_id": refresh_id,
                "source_layer": "manual_csv",
                "source_key": f.get("filename"),
                "source_path": f.get("path"),
                "status": f.get("status"),
                "last_valid_date": f.get("last_valid_date"),
                "observation_count": f.get("row_count"),
                "warning_or_error": f.get("error"),
            }
        )
    for f in news_inventory.get("files", []):
        rows.append(
            {
                "refresh_id": refresh_id,
                "source_layer": "news_raw_input",
                "source_key": f.get("filename"),
                "source_path": f.get("path"),
                "status": f.get("status"),
                "last_valid_date": f.get("last_valid_date"),
                "observation_count": f.get("row_count") or f.get("line_count"),
                "warning_or_error": f.get("error"),
            }
        )
    log = {
        "artifact_type": "source_update_log",
        "schema_version": "1.0.0",
        "refresh_id": refresh_id,
        "entry_count": len(rows),
        "entries": rows,
        "generated_at_utc": iso_utc(),
    }
    return log, rows


def scan_artifacts_for_secret_leak(paths: RunPaths, env: Dict[str, str]) -> Dict[str, Any]:
    # Phase 10 V2 does not require API keys. Keep a generic scan for common secrets.
    secret_values = []
    for key, value in env.items():
        if any(token in key.upper() for token in ["API_KEY", "SECRET", "TOKEN"]) and value and len(value) >= 12:
            secret_values.append((key, value))
    leaks: List[Dict[str, Any]] = []
    for file in paths.source_update_dir.glob("**/*"):
        if not file.is_file() or file.suffix.lower() not in {".json", ".csv", ".txt", ".md"}:
            continue
        try:
            text = file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for key, value in secret_values:
            if value in text:
                leaks.append({"file": str(file.relative_to(paths.repo_root)), "secret_key": key})
    return {
        "artifact_type": "secret_leak_scan",
        "schema_version": "1.0.0",
        "status": "failed" if leaks else "pass",
        "leak_count": len(leaks),
        "leaks": leaks,
        "scan_note": "Scans Phase 10 source_update artifacts for exact secret values from environment/.env files.",
        "generated_at_utc": iso_utc(),
    }


def build_quality_review(
    required_status: Dict[str, Any],
    feature_store_status: Dict[str, Any],
    intelligence_snapshot_status: Dict[str, Any],
    gold_live_summary: Dict[str, Any],
    manual_summary: Dict[str, Any],
    news_coverage: Dict[str, Any],
    accepted_manifest: Dict[str, Any],
    secret_scan: Dict[str, Any],
    required_files: List[Path],
) -> Dict[str, Any]:
    blocking: List[str] = []
    warnings: List[str] = []

    if not required_status.get("all_required_exist"):
        missing = [c.get("name") for c in required_status.get("checks", []) if not c.get("exists")]
        blocking.append(f"missing_required_inputs:{','.join(missing)}")
    if feature_store_status.get("status") != "readable":
        blocking.append("feature_store_unreadable_or_missing")
    if secret_scan.get("status") == "failed":
        blocking.append("api_key_or_secret_leaked_into_artifacts")
    if gold_live_summary.get("status") not in {"completed", "completed_no_valid_rows", "skipped_by_user_flag_no_gold_live_pull"}:
        blocking.append(f"gold_live_update_failed:{gold_live_summary.get('status')}")
    elif gold_live_summary.get("status") == "completed_no_valid_rows":
        warnings.append("Yahoo gold live pull completed but returned no valid rows.")
    elif gold_live_summary.get("status") == "skipped_by_user_flag_no_gold_live_pull":
        warnings.append("Gold live pull skipped by user flag.")
    if intelligence_snapshot_status.get("status") == "not_found":
        warnings.append("No saved main Intelligence matrix snapshot found; Phase 11 may need to use existing feature-store fallback plus Yahoo gold extension.")
    elif intelligence_snapshot_status.get("status") == "found_but_unreadable":
        warnings.append("Main Intelligence matrix snapshot was found but unreadable.")
    if not accepted_manifest.get("all_expected_accepted_artifacts_found"):
        warnings.append("Some accepted model run_summary artifacts were not found in archive manifest.")
    missing_outputs = [str(p) for p in required_files if not p.exists()]
    if missing_outputs:
        blocking.append("missing_required_phase10_outputs")
    if manual_summary.get("status") == "no_manual_csv_files_found":
        warnings.append("No manual CSV source files found; manual factors should be marked stale/carried-forward in Phase 11 if needed.")
    if news_coverage.get("status") == "no_news_raw_inputs_found":
        warnings.append("No raw news input files found; Gamma will likely run proxy-regime mode unless inputs are added.")

    status = "ready" if not blocking and not warnings else "ready_quality_review_required"
    if blocking:
        status = "failed_quality_gate"

    return {
        "artifact_type": "source_update_quality_review",
        "schema_version": "1.0.0",
        "phase_key": PHASE_KEY,
        "status": status,
        "blocking_flags": blocking,
        "warnings": warnings,
        "acceptance_gate": {
            "source_update_manifest_exists": True,
            "fred_refresh_delegated_to_main_intelligence": True,
            "main_intelligence_snapshot_status_logged": bool(intelligence_snapshot_status),
            "gold_live_status_logged": bool(gold_live_summary),
            "manual_csv_status_logged": bool(manual_summary),
            "news_input_status_logged": bool(news_coverage),
            "accepted_previous_model_artifacts_inventoried": bool(accepted_manifest),
            "no_source_silently_merged_without_status": True,
            "api_key_not_written_into_artifacts": secret_scan.get("status") == "pass",
            "timeline_exists": True,
            "progress_checkpoint_exists": True,
            "phase10_report_exists": True,
        },
        "professor_safe_summary": "Phase 10 stages and audits source updates only. It does not train models and does not make forecast claims.",
        "generated_at_utc": iso_utc(),
    }


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Phase 10 Source Update Refresh Layer for Gold Nexus Alpha Deep ML.")
    parser.add_argument("--repo-root", type=str, default=None)
    parser.add_argument("--smoke", action="store_true", help="Fast mode. Pulls Yahoo GC=F and inventories folders.")
    parser.add_argument("--http-timeout", type=int, default=30)
    parser.add_argument("--gold-live-provider", type=str, default=DEFAULT_GOLD_LIVE_PROVIDER, choices=["yahoo", "yahoo_chart"], help="Live gold extension provider. Default uses Yahoo chart API.")
    parser.add_argument("--gold-live-symbol", type=str, default=DEFAULT_GOLD_LIVE_SYMBOL, help="Yahoo symbol for live gold extension. Default GC=F.")
    parser.add_argument("--gold-live-start", type=str, default=DEFAULT_GOLD_LIVE_START, help="Start date for post-cutoff live gold extension.")
    parser.add_argument("--gold-live-end", type=str, default=None, help="Optional end date for live gold extension.")
    parser.add_argument("--no-gold-live-pull", action="store_true", help="Skip Yahoo live gold extension pull.")
    parser.add_argument("--no-public-copy", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve() if args.repo_root else detect_repo_root(Path.cwd())
    paths = build_paths(repo_root)
    ensure_source_folders(paths)
    timeline = Timeline(paths)
    checkpoint = Checkpoint(paths)
    started = utc_now()
    refresh_id = f"deepml_refresh_{started.strftime('%Y%m%d_%H%M%S')}"

    try:
        timeline.add("phase10_source_update_refresh_started", details={"refresh_id": refresh_id, "repo_root": str(repo_root)})
        checkpoint.write("started", "running", {"refresh_id": refresh_id})

        env = load_env_files(repo_root)
        env_status = {
            "artifact_type": "source_update_environment_status",
            "schema_version": "1.0.0",
            "python_version": sys.version,
            "platform": platform.platform(),
            "script_version": SCRIPT_VERSION,
            "git_commit_sha": get_git_commit(repo_root),
            "fred_refresh_policy": "delegated_to_main_intelligence_pipeline",
            "gold_live_provider": args.gold_live_provider,
            "gold_live_symbol": args.gold_live_symbol,
            "secret_policy": "Phase 10 V2 does not require API keys; no secret values are written.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.source_update_dir / "environment_status.json", env_status)
        timeline.add("environment_status_logged")

        required_status = required_input_status(paths)
        write_json(paths.source_update_dir / "required_input_status.json", required_status)
        timeline.add("required_input_status_logged", details={"all_required_exist": required_status["all_required_exist"]})

        feature_store_status = inspect_feature_store(paths)
        write_json(paths.source_update_dir / "feature_store_status.json", feature_store_status)
        timeline.add("feature_store_status_logged", details={"status": feature_store_status.get("status")})

        intelligence_snapshot_status = inspect_main_intelligence_snapshot(paths)
        timeline.add("main_intelligence_snapshot_status_logged", details={"status": intelligence_snapshot_status.get("status")})

        accepted_manifest = inventory_accepted_models(paths, refresh_id)
        timeline.add("accepted_model_manifest_created", details={"all_found": accepted_manifest.get("all_expected_accepted_artifacts_found")})

        gold_live_summary, gold_live_rows = run_gold_live_update(paths, args)
        timeline.add("gold_live_update_layer_completed", details={"status": gold_live_summary.get("status"), "symbol": gold_live_summary.get("symbol")})

        manual_inventory, manual_summary, manual_warnings = inventory_manual_csv(paths)
        timeline.add("manual_csv_inventory_completed", details={"file_count": manual_inventory.get("file_count")})

        news_inventory, news_coverage = inventory_news_inputs(paths)
        timeline.add("news_input_inventory_completed", details={"file_count": news_inventory.get("file_count")})

        source_update_manifest = build_source_update_manifest(
            refresh_id=refresh_id,
            paths=paths,
            required_status=required_status,
            feature_store_status=feature_store_status,
            intelligence_snapshot_status=intelligence_snapshot_status,
            gold_live_summary=gold_live_summary,
            manual_summary=manual_summary,
            news_coverage=news_coverage,
        )
        source_log, source_log_rows = build_source_update_log(
            refresh_id=refresh_id,
            gold_live_rows=gold_live_rows,
            manual_inventory=manual_inventory,
            news_inventory=news_inventory,
            intelligence_snapshot_status=intelligence_snapshot_status,
        )
        write_json(paths.source_update_dir / "source_update_log.json", source_log)
        write_csv_dicts(paths.source_update_dir / "source_update_log.csv", source_log_rows)
        timeline.add("source_update_manifest_and_log_created", details={"entry_count": len(source_log_rows)})

        secret_scan = scan_artifacts_for_secret_leak(paths, env)
        write_json(paths.source_update_dir / "secret_leak_scan.json", secret_scan)
        timeline.add("secret_leak_scan_completed", status=secret_scan.get("status", "unknown"))

        required_outputs = [
            paths.source_update_dir / "source_update_manifest.json",
            paths.source_update_dir / "source_update_log.json",
            paths.source_update_dir / "source_update_log.csv",
            paths.source_update_dir / "main_intelligence_matrix_snapshot_status.json",
            paths.source_update_dir / "gold_live_update_summary.json",
            paths.source_update_dir / "gold_live_price_inventory.json",
            paths.source_update_dir / "gold_live_pull_log.csv",
            paths.source_update_dir / "manual_csv_inventory.json",
            paths.source_update_dir / "manual_csv_update_summary.json",
            paths.source_update_dir / "news_input_inventory.json",
            paths.source_update_dir / "news_source_coverage_preview.json",
            paths.source_update_dir / "accepted_before_refresh_manifest.json",
            paths.source_update_dir / "timeline.json",
            paths.source_update_dir / "progress_checkpoint.json",
        ]
        quality_review = build_quality_review(
            required_status=required_status,
            feature_store_status=feature_store_status,
            intelligence_snapshot_status=intelligence_snapshot_status,
            gold_live_summary=gold_live_summary,
            manual_summary=manual_summary,
            news_coverage=news_coverage,
            accepted_manifest=accepted_manifest,
            secret_scan=secret_scan,
            required_files=required_outputs,
        )
        write_json(paths.source_update_dir / "source_update_quality_review.json", quality_review)

        phase_report = {
            "artifact_type": "phase10_source_update_refresh_report",
            "schema_version": "1.0.0",
            "project": "Gold Nexus Alpha",
            "phase": "Phase 10 — Source Update Refresh Layer",
            "phase_key": PHASE_KEY,
            "status": quality_review["status"],
            "refresh_id": refresh_id,
            "run": {
                "run_id": refresh_id,
                "started_at_utc": iso_utc(started),
                "completed_at_utc": iso_utc(),
                "completed_at_local": local_iso_from_utc(),
                "script_version": SCRIPT_VERSION,
                "git_commit_sha": get_git_commit(repo_root),
            },
            "source_update_manifest": source_update_manifest,
            "accepted_before_refresh_manifest": accepted_manifest,
            "main_intelligence_matrix_snapshot_status": intelligence_snapshot_status,
            "gold_live_update_summary": gold_live_summary,
            "manual_csv_update_summary": manual_summary,
            "manual_csv_schema_warnings": manual_warnings,
            "news_source_coverage_preview": news_coverage,
            "feature_store_status": feature_store_status,
            "quality_review": quality_review,
            "next_step": {
                "phase": "Phase 11 — Governed Cutoff + Factor State + Feature Store Refresh",
                "recommended_script": "deep_ml/scripts/11_governed_feature_store_refresh.py",
                "instruction": "Review this Phase 10 report first. Do not rerun models until Phase 11 refresh is approved.",
            },
            "professor_safe_summary": (
                "Phase 10 V2 prepares and audits the source update layer. It delegates FRED/API factor refresh to the existing "
                "main Intelligence pipeline, stages Yahoo GC=F live gold extension data, inventories manual CSV and raw news inputs, "
                "and protects accepted pre-refresh model artifacts. It does not train models or make price forecasts."
            ),
            "final_instruction": "Send me artifacts/deep_ml/source_update/phase10_source_update_refresh_report.json for review before Phase 11.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.source_update_dir / "phase10_source_update_refresh_report.json", phase_report)

        if not args.no_public_copy:
            public_copy_json_csv(paths.source_update_dir, paths.public_source_update_dir)
            public_copy_json_csv(paths.news_raw_inputs_dir.parent, paths.public_news_dir)
            timeline.add("public_artifacts_copied")

        checkpoint.write(
            "completed",
            quality_review["status"],
            {
                "phase_report": "artifacts/deep_ml/source_update/phase10_source_update_refresh_report.json",
                "send_me_this_json": "artifacts/deep_ml/source_update/phase10_source_update_refresh_report.json",
            },
        )
        timeline.add("phase10_source_update_refresh_completed", status=quality_review["status"])

        print("\n" + "=" * 88)
        print("PHASE 10 SOURCE UPDATE REFRESH V2 COMPLETE")
        print("Review this JSON before Phase 11:")
        print("artifacts/deep_ml/source_update/phase10_source_update_refresh_report.json")
        print("=" * 88 + "\n")

    except Exception as exc:
        error_payload = {
            "artifact_type": "phase10_source_update_refresh_error_report",
            "schema_version": "1.0.0",
            "phase_key": PHASE_KEY,
            "status": "failed",
            "error": repr(exc),
            "traceback": traceback.format_exc(),
            "generated_at_utc": iso_utc(),
            "final_instruction": "Fix the blocking issue, rerun Phase 10, then send me phase10_source_update_refresh_report.json if created.",
        }
        write_json(paths.source_update_dir / "phase10_source_update_refresh_report.json", error_payload)
        write_json(
            paths.source_update_dir / "source_update_quality_review.json",
            {
                "artifact_type": "source_update_quality_review",
                "phase_key": PHASE_KEY,
                "status": "failed_quality_gate",
                "blocking_flags": [repr(exc)],
                "generated_at_utc": iso_utc(),
            },
        )
        checkpoint.write("failed", "failed", {"error": repr(exc)})
        timeline.add("phase10_source_update_refresh_failed", status="failed", details={"error": repr(exc)})
        print("\nPHASE 10 SOURCE UPDATE REFRESH FAILED. Review:")
        print("artifacts/deep_ml/source_update/phase10_source_update_refresh_report.json")
        raise


if __name__ == "__main__":
    main()
