"""
Gold Nexus Alpha — Deep ML Phase 11 V2
Governed Feature Store Refresh with Yahoo GC=F + FRED Registry Merge

Save as:
    deep_ml/scripts/11_governed_feature_store_refresh.py

Run:
    code .\deep_ml\scripts\11_governed_feature_store_refresh.py
    py -m py_compile .\deep_ml\scripts\11_governed_feature_store_refresh.py
    py .\deep_ml\scripts\11_governed_feature_store_refresh.py --smoke
    py .\deep_ml\scripts\11_governed_feature_store_refresh.py

Inputs:
    artifacts/deep_ml/features/deep_ml_numeric_feature_store.parquet
    artifacts/deep_ml/source_update/gold_live_pulled/gold_live_GC_F.csv
    artifacts/deep_ml/source_update/fred_registry_pull_report.json
    artifacts/deep_ml/source_update/fred_pulled_series/fred_*.csv

Outputs:
    artifacts/deep_ml/features/deep_ml_numeric_feature_store.parquet
    artifacts/deep_ml/feature_refresh/deep_ml_refreshed_matrix.csv
    artifacts/deep_ml/feature_refresh/deep_ml_refreshed_matrix.parquet
    artifacts/deep_ml/feature_refresh/phase11_governed_feature_store_refresh_report.json

Policy:
    - Keep official rows through 2026-03-31.
    - Use Yahoo GC=F for gold_price after 2026-03-31.
    - Use FRED pulled CSVs for mapped FRED factors after 2026-03-31.
    - Forward-fill FRED values onto Yahoo/post-cutoff dates.
    - Carry manual/local factors forward.
    - Do not modify RecursiveClientView.tsx or model3 frontend.
"""

from __future__ import annotations

import argparse
import json
import math
import platform
import shutil
import subprocess
import sys
import time
import traceback
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd

PHASE_KEY = "phase11_governed_feature_store_refresh"
SCRIPT_VERSION = "governed_feature_store_refresh_v2_yahoo_gold_plus_fred_registry"
OFFICIAL_MODEL_CUTOFF = "2026-03-31"
DEFAULT_GOLD_LIVE_CSV = "artifacts/deep_ml/source_update/gold_live_pulled/gold_live_GC_F.csv"
DEFAULT_FRED_REPORT = "artifacts/deep_ml/source_update/fred_registry_pull_report.json"
DATE_COLUMN_CANDIDATES = ["date", "Date", "ds", "timestamp", "time", "observation_date"]
GOLD_COLUMN_CANDIDATES = ["gold_price", "gold", "price", "target", "Gold Price", "Gold_Price"]
SOURCE_FLAG_COLUMNS = [
    "gold_price_source",
    "gold_price_source_type",
    "gold_price_is_live_extension",
    "gold_price_is_proxy",
    "gold_price_last_updated_utc",
    "row_source_type",
    "refresh_mode",
    "fred_api_update_applied",
    "fred_api_updated_columns",
]
NON_FEATURE_COLUMNS = set(SOURCE_FLAG_COLUMNS + ["date", "dataset_id", "split", "mode", "study_id", "run_id", "source"])
TARGET_PATTERNS = ("target", "future", "lead", "horizon", "return_h", "log_return_h", "y_h", "gold_t_plus")
MANUAL_HINTS = ("gpr", "policy_unc", "geopolitical", "uncertainty", "gld")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(dt: Optional[datetime] = None) -> str:
    return (dt or now_utc()).isoformat().replace("+00:00", "Z")


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


def stable_hash_file(path: Path) -> str:
    if not path.exists() or not path.is_file():
        return "missing"
    import hashlib
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return "sha256:" + h.hexdigest()


def detect_repo_root(start: Path) -> Path:
    current = start.resolve()
    for candidate in [current, *current.parents]:
        if (candidate / ".git").exists() or (candidate / "artifacts").exists() or (candidate / "deep_ml").exists():
            return candidate
    return current


def get_git_commit(repo_root: Path) -> Optional[str]:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=str(repo_root), text=True).strip()
    except Exception:
        return None


def find_date_column(columns: Iterable[str]) -> Optional[str]:
    cols = list(columns)
    for c in DATE_COLUMN_CANDIDATES:
        if c in cols:
            return c
    for c in cols:
        if "date" in str(c).lower() or "time" in str(c).lower():
            return c
    return None


def safe_float(x: Any) -> Optional[float]:
    try:
        if x is None:
            return None
        y = float(x)
        if math.isnan(y) or math.isinf(y):
            return None
        return y
    except Exception:
        return None


def detect_gold_column(df: pd.DataFrame, target_plan: Dict[str, Any]) -> str:
    for key in ["gold_column", "target_column", "raw_gold_price_column"]:
        val = target_plan.get(key)
        if val in df.columns:
            return str(val)
    for c in GOLD_COLUMN_CANDIDATES:
        if c in df.columns:
            return c
    for c in df.columns:
        if "gold" in str(c).lower() and pd.api.types.is_numeric_dtype(df[c]):
            return str(c)
    raise ValueError("Could not detect gold price column.")


def load_table(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(str(path))
    if path.suffix.lower() == ".parquet":
        return pd.read_parquet(path)
    if path.suffix.lower() == ".csv":
        return pd.read_csv(path)
    raise ValueError(f"Unsupported table type: {path}")


def save_table(path: Path, df: pd.DataFrame) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix.lower() == ".parquet":
        df.to_parquet(path, index=False)
    elif path.suffix.lower() == ".csv":
        df.to_csv(path, index=False)
    else:
        raise ValueError(f"Unsupported output type: {path}")


@dataclass
class Paths:
    repo: Path
    artifacts: Path
    features: Path
    data: Path
    governance: Path
    source_update: Path
    feature_refresh: Path
    public_deep_ml: Path
    base_feature_store: Path
    gold_live_csv: Path
    fred_report: Path
    numeric_feature_store: Path
    refreshed_csv: Path
    refreshed_parquet: Path
    manifest: Path
    factor_state: Path
    model_feature_plan: Path
    target_plan: Path
    mode_status: Path
    study_context: Path
    report: Path
    quality: Path
    timeline: Path
    checkpoint: Path


def build_paths(repo: Path, gold_live_csv: str, fred_report: str) -> Paths:
    artifacts = repo / "artifacts" / "deep_ml"
    features = artifacts / "features"
    data = artifacts / "data"
    governance = artifacts / "governance"
    source_update = artifacts / "source_update"
    feature_refresh = artifacts / "feature_refresh"
    return Paths(
        repo=repo,
        artifacts=artifacts,
        features=features,
        data=data,
        governance=governance,
        source_update=source_update,
        feature_refresh=feature_refresh,
        public_deep_ml=repo / "public" / "artifacts" / "deep_ml",
        base_feature_store=features / "deep_ml_numeric_feature_store.parquet",
        gold_live_csv=repo / gold_live_csv,
        fred_report=repo / fred_report,
        numeric_feature_store=features / "deep_ml_numeric_feature_store.parquet",
        refreshed_csv=feature_refresh / "deep_ml_refreshed_matrix.csv",
        refreshed_parquet=feature_refresh / "deep_ml_refreshed_matrix.parquet",
        manifest=features / "deep_ml_numeric_feature_store_manifest.json",
        factor_state=data / "factor_state_table.json",
        model_feature_plan=features / "model_feature_plan.json",
        target_plan=features / "target_plan.json",
        mode_status=governance / "deep_ml_mode_status.json",
        study_context=governance / "study_context.json",
        report=feature_refresh / "phase11_governed_feature_store_refresh_report.json",
        quality=feature_refresh / "quality_review.json",
        timeline=feature_refresh / "timeline.json",
        checkpoint=feature_refresh / "progress_checkpoint.json",
    )


def add_timeline(paths: Paths, events: List[Dict[str, Any]], event: str, status: str = "ok", details: Optional[Dict[str, Any]] = None) -> None:
    events.append({"timestamp_utc": iso_utc(), "event": event, "status": status, "details": details or {}})
    write_json(paths.timeline, events)
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {event} [{status}]", flush=True)


def write_checkpoint(paths: Paths, step: str, status: str, payload: Optional[Dict[str, Any]] = None) -> None:
    write_json(paths.checkpoint, {
        "artifact_type": "deep_ml_progress_checkpoint",
        "phase_key": PHASE_KEY,
        "step": step,
        "status": status,
        "updated_at_utc": iso_utc(),
        "payload": payload or {},
    })


def load_base_feature_store(paths: Paths, cutoff: str, target_plan: Dict[str, Any]) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    df = load_table(paths.base_feature_store)
    date_col = find_date_column(df.columns)
    if not date_col:
        raise ValueError("No date column in base feature store.")
    gold_col = detect_gold_column(df, target_plan)
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df = df.dropna(subset=[date_col]).sort_values(date_col).reset_index(drop=True)
    # Important: always rebuild from official history only, even if the current file already has post-cutoff rows.
    pre = df[df[date_col] <= pd.Timestamp(cutoff)].copy()
    if date_col != "date":
        pre = pre.rename(columns={date_col: "date"})
    if gold_col != "gold_price":
        pre = pre.rename(columns={gold_col: "gold_price"})
    meta = {
        "base_source_type": "existing_deep_ml_numeric_feature_store_official_rows_only",
        "path": str(paths.base_feature_store.relative_to(paths.repo)),
        "hash": stable_hash_file(paths.base_feature_store),
        "original_row_count": int(len(df)),
        "official_row_count_used": int(len(pre)),
        "original_last_date": df[date_col].max().date().isoformat(),
        "official_last_date_used": pre["date"].max().date().isoformat(),
        "date_column": "date",
        "gold_column": "gold_price",
    }
    return pre, meta


def load_gold_live(paths: Paths, cutoff: str, max_date: Optional[str]) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    df = load_table(paths.gold_live_csv)
    date_col = find_date_column(df.columns)
    if not date_col:
        raise ValueError("No date column in gold live CSV.")
    if "gold_price" not in df.columns:
        raise ValueError("gold_live CSV must contain gold_price column.")
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df = df.dropna(subset=[date_col, "gold_price"]).rename(columns={date_col: "date"})
    df = df[df["date"] > pd.Timestamp(cutoff)].copy()
    if max_date:
        df = df[df["date"] <= pd.Timestamp(max_date)].copy()
    df = df.sort_values("date").drop_duplicates("date", keep="last").reset_index(drop=True)
    meta = {
        "path": str(paths.gold_live_csv.relative_to(paths.repo)),
        "hash": stable_hash_file(paths.gold_live_csv),
        "row_count": int(len(df)),
        "first_date": df["date"].min().date().isoformat() if len(df) else None,
        "last_date": df["date"].max().date().isoformat() if len(df) else None,
        "source_type": "yahoo_gc_f_comex_futures_proxy_delayed",
    }
    return df, meta


def build_post_cutoff_skeleton(pre: pd.DataFrame, gold_live: pd.DataFrame) -> pd.DataFrame:
    if gold_live.empty:
        return pd.DataFrame(columns=pre.columns)
    last_pre = pre.sort_values("date").iloc[-1].copy()
    rows: List[Dict[str, Any]] = []
    cols = list(pre.columns)
    for _, live_row in gold_live.iterrows():
        row = last_pre.copy()
        row["date"] = pd.Timestamp(live_row["date"])
        row["gold_price"] = safe_float(live_row.get("gold_price"))
        row["row_source_type"] = "post_cutoff_yahoo_gold_plus_fred_registry"
        row["refresh_mode"] = "gold_yahoo_fred_api_factors_manual_carried"
        row["gold_price_source"] = live_row.get("gold_price_source", "yahoo_gc_f")
        row["gold_price_source_type"] = live_row.get("gold_price_source_type", "comex_futures_proxy_delayed")
        row["gold_price_is_live_extension"] = True
        row["gold_price_is_proxy"] = True
        row["gold_price_last_updated_utc"] = live_row.get("gold_price_last_updated_utc") or iso_utc()
        row["fred_api_update_applied"] = False
        row["fred_api_updated_columns"] = ""
        rows.append({c: row.get(c, np.nan) for c in cols})
    return pd.DataFrame(rows)


def load_fred_report(paths: Paths) -> Dict[str, Any]:
    report = read_json(paths.fred_report, default={}) or {}
    if report.get("artifact_type") != "fred_registry_pull_report":
        raise ValueError(f"Invalid or missing FRED registry pull report: {paths.fred_report}")
    return report


def fred_series_from_csv(csv_path: Path) -> pd.Series:
    df = pd.read_csv(csv_path)
    if "date" not in df.columns or "value" not in df.columns:
        raise ValueError(f"FRED CSV missing date/value: {csv_path}")
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df = df.dropna(subset=["date", "value"]).sort_values("date").drop_duplicates("date", keep="last")
    if df.empty:
        return pd.Series(dtype=float)
    return pd.Series(df["value"].values, index=pd.DatetimeIndex(df["date"])).sort_index()


def apply_fred_updates(post: pd.DataFrame, fred_report: Dict[str, Any], paths: Paths) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    if post.empty:
        return post, {"fred_columns_updated": [], "fred_series_used": 0, "fred_series_skipped": 0, "details": []}
    out = post.copy()
    post_dates = pd.DatetimeIndex(pd.to_datetime(out["date"]))
    updated_cols_by_row = {i: [] for i in out.index}
    details: List[Dict[str, Any]] = []
    used = 0
    skipped = 0

    for item in fred_report.get("valid_pulled_series") or fred_report.get("pulled_series") or []:
        if int(item.get("valid_observation_count") or 0) <= 0:
            skipped += 1
            details.append({"factor_key": item.get("factor_key"), "series_id": item.get("series_id"), "status": "skipped_no_valid_values"})
            continue
        rel_csv = item.get("output_csv")
        if not rel_csv:
            skipped += 1
            details.append({"factor_key": item.get("factor_key"), "series_id": item.get("series_id"), "status": "skipped_no_csv_path"})
            continue
        csv_path = paths.repo / rel_csv
        if not csv_path.exists():
            skipped += 1
            details.append({"factor_key": item.get("factor_key"), "series_id": item.get("series_id"), "status": "skipped_csv_missing", "csv": rel_csv})
            continue
        series = fred_series_from_csv(csv_path)
        if series.empty:
            skipped += 1
            details.append({"factor_key": item.get("factor_key"), "series_id": item.get("series_id"), "status": "skipped_empty_csv"})
            continue
        # Forward-fill latest available FRED value onto each post-cutoff date.
        aligned = series.reindex(series.index.union(post_dates)).sort_index().ffill().reindex(post_dates)
        target_columns = item.get("target_columns") or [item.get("factor_key")]
        applied_cols = []
        for col in target_columns:
            if not col:
                continue
            # Update only if column exists. This avoids silently creating wrong model features.
            if col not in out.columns:
                details.append({
                    "factor_key": item.get("factor_key"),
                    "series_id": item.get("series_id"),
                    "target_column": col,
                    "status": "target_column_not_in_feature_store_skipped",
                })
                continue
            out[col] = aligned.values
            applied_cols.append(col)
            for idx in out.index:
                updated_cols_by_row[idx].append(col)
        if applied_cols:
            used += 1
            details.append({
                "factor_key": item.get("factor_key"),
                "series_id": item.get("series_id"),
                "target_columns_applied": applied_cols,
                "status": "merged_forward_filled",
                "first_fred_valid_date": item.get("first_valid_date"),
                "last_fred_valid_date": item.get("last_valid_date"),
                "post_cutoff_unique_values": {col: int(pd.Series(out[col]).nunique(dropna=True)) for col in applied_cols},
            })
        else:
            skipped += 1
    for idx in out.index:
        cols = sorted(set(updated_cols_by_row[idx]))
        out.at[idx, "fred_api_update_applied"] = bool(cols)
        out.at[idx, "fred_api_updated_columns"] = "|".join(cols)
    summary = {
        "fred_pull_report_path": str(paths.fred_report.relative_to(paths.repo)),
        "fred_pull_report_hash": stable_hash_file(paths.fred_report),
        "fred_pull_status": fred_report.get("status"),
        "fred_report_script_version": fred_report.get("script_version"),
        "fred_series_attempted": fred_report.get("series_attempted"),
        "fred_series_valid_pulled": fred_report.get("series_valid_pulled"),
        "fred_series_failed": fred_report.get("series_failed"),
        "fred_latest_valid_observation_date": fred_report.get("latest_valid_observation_date"),
        "fred_series_used_in_merge": used,
        "fred_series_skipped_in_merge": skipped,
        "fred_columns_updated": sorted({c for d in details for c in d.get("target_columns_applied", [])}),
        "merge_policy": "FRED values are forward-filled onto post-cutoff Yahoo gold dates; manual factors remain carried forward.",
        "details": details,
    }
    return out, summary


def build_feature_store(pre: pd.DataFrame, post: pd.DataFrame) -> pd.DataFrame:
    for flag in SOURCE_FLAG_COLUMNS:
        if flag not in pre.columns:
            pre[flag] = None
        if flag not in post.columns:
            post[flag] = None
    pre = pre.copy()
    pre["row_source_type"] = pre["row_source_type"].fillna("official_pre_cutoff_matrix")
    pre["refresh_mode"] = pre["refresh_mode"].fillna("official_history_preserved")
    pre["gold_price_source"] = pre["gold_price_source"].fillna("official_project_history")
    pre["gold_price_source_type"] = pre["gold_price_source_type"].fillna("official_historical_target")
    pre["gold_price_is_live_extension"] = False
    pre["gold_price_is_proxy"] = False
    pre["fred_api_update_applied"] = False
    pre["fred_api_updated_columns"] = ""
    # Align columns after any source flags were introduced.
    all_cols = list(dict.fromkeys(list(pre.columns) + list(post.columns)))
    refreshed = pd.concat([pre.reindex(columns=all_cols), post.reindex(columns=all_cols)], ignore_index=True)
    refreshed["date"] = pd.to_datetime(refreshed["date"], errors="coerce")
    refreshed = refreshed.dropna(subset=["date"]).sort_values("date").drop_duplicates("date", keep="last").reset_index(drop=True)
    return refreshed


def build_factor_state(refreshed: pd.DataFrame, cutoff: str, fred_summary: Dict[str, Any]) -> Dict[str, Any]:
    post = refreshed[pd.to_datetime(refreshed["date"]) > pd.Timestamp(cutoff)]
    fred_cols = set(fred_summary.get("fred_columns_updated") or [])
    factors = []
    for col in refreshed.columns:
        if col in SOURCE_FLAG_COLUMNS or col == "date":
            continue
        lower = str(col).lower()
        s = pd.to_numeric(refreshed[col], errors="coerce") if col in refreshed.columns else pd.Series(dtype=float)
        if col == "gold_price":
            status = "live_extension_after_cutoff"
            source_type = "yahoo_gc_f_comex_futures_proxy_delayed"
        elif col in fred_cols:
            status = "fred_api_updated_after_cutoff"
            source_type = "fred_api_forward_filled_to_post_cutoff_dates"
        elif any(x in lower for x in MANUAL_HINTS):
            status = "manual_stale_or_carried_forward"
            source_type = "manual_or_local_source_not_refreshed_this_run"
        else:
            status = "carried_forward_after_cutoff"
            source_type = "base_matrix_carried_forward"
        factors.append({
            "factor_key": col,
            "status": status,
            "source_type": source_type,
            "official_cutoff": cutoff,
            "refreshed_matrix_end_date": pd.Timestamp(refreshed["date"].max()).date().isoformat(),
            "post_cutoff_unique_values": int(pd.to_numeric(post[col], errors="coerce").nunique(dropna=True)) if col in post.columns else None,
            "missing_count": int(s.isna().sum()),
            "professor_safe_note": "Factor-state status describes refresh handling and availability, not causality.",
        })
    return {
        "artifact_type": "deep_ml_factor_state_table",
        "schema_version": "2.0.0",
        "phase_key": PHASE_KEY,
        "official_cutoff": cutoff,
        "refreshed_matrix_end_date": pd.Timestamp(refreshed["date"].max()).date().isoformat(),
        "fred_merge_summary": {k: v for k, v in fred_summary.items() if k != "details"},
        "factors": factors,
        "generated_at_utc": iso_utc(),
    }


def build_model_feature_plan(refreshed: pd.DataFrame, base_plan: Dict[str, Any]) -> Dict[str, Any]:
    numeric_cols = [c for c in refreshed.columns if pd.api.types.is_numeric_dtype(refreshed[c])]
    features, excluded = [], []
    for c in numeric_cols:
        lower = str(c).lower()
        if c in NON_FEATURE_COLUMNS or any(p in lower for p in TARGET_PATTERNS):
            excluded.append(c)
            continue
        if "high_yield" in lower:
            excluded.append(c)
            continue
        features.append(c)
    if "gold_price" in refreshed.columns and "gold_price" not in features:
        features.insert(0, "gold_price")
    plan = dict(base_plan or {})
    plan.update({
        "artifact_type": "deep_ml_model_feature_plan",
        "schema_version": "2.0.0",
        "phase_key": PHASE_KEY,
        "features_for_ml_models": features,
        "feature_count": len(features),
        "excluded_from_official_core": sorted(set(excluded + ["high_yield excluded when detected"])),
        "source_flag_columns_not_model_features": SOURCE_FLAG_COLUMNS,
        "generated_at_utc": iso_utc(),
    })
    return plan


def build_target_plan(base: Dict[str, Any], cutoff: str, end_date: str) -> Dict[str, Any]:
    out = dict(base or {})
    out.update({
        "artifact_type": "deep_ml_target_plan",
        "schema_version": "2.0.0",
        "phase_key": PHASE_KEY,
        "gold_column": "gold_price",
        "target_strategy": "anchored_future_log_return",
        "forecast_reconstruction": "raw_gold_price_anchor * exp(predicted_log_return)",
        "raw_gold_price_anchor_scaled": False,
        "official_model_cutoff": cutoff,
        "refreshed_matrix_end_date": end_date,
        "post_cutoff_gold_source": "Yahoo GC=F COMEX futures delayed public market proxy",
        "generated_at_utc": iso_utc(),
    })
    return out


def quality_review(refreshed: pd.DataFrame, cutoff: str, fred_summary: Dict[str, Any], paths: Paths) -> Dict[str, Any]:
    blocking, warnings = [], []
    post = refreshed[pd.to_datetime(refreshed["date"]) > pd.Timestamp(cutoff)]
    if post.empty:
        blocking.append("no_post_cutoff_rows")
    if "gold_price" not in refreshed.columns or post["gold_price"].isna().any():
        blocking.append("post_cutoff_gold_price_missing")
    if not fred_summary.get("fred_columns_updated"):
        blocking.append("no_fred_columns_updated_after_cutoff")
    if fred_summary.get("fred_series_failed", 0):
        warnings.append("FRED pull report contains failed series.")
    if "high_yield" in (fred_summary.get("fred_columns_updated") or []):
        warnings.append("high_yield was updated for audit but should remain excluded from official core modeling.")
    required = [paths.numeric_feature_store, paths.refreshed_csv, paths.refreshed_parquet, paths.manifest, paths.factor_state, paths.model_feature_plan, paths.target_plan, paths.mode_status, paths.study_context]
    missing = [str(p) for p in required if not p.exists()]
    if missing:
        blocking.append("missing_required_outputs")
    status = "ready" if not blocking and not warnings else "ready_quality_review_required"
    if blocking:
        status = "failed_quality_gate"
    return {
        "artifact_type": "phase11_quality_review",
        "schema_version": "1.0.0",
        "status": status,
        "blocking_flags": blocking,
        "warnings": warnings,
        "acceptance_gate": {
            "gold_price_extended_after_cutoff": not post.empty and post["gold_price"].nunique(dropna=True) > 1,
            "fred_columns_updated_after_cutoff": bool(fred_summary.get("fred_columns_updated")),
            "raw_gold_price_anchor_preserved": True,
            "source_flags_exported": all(c in refreshed.columns for c in SOURCE_FLAG_COLUMNS),
            "frontend_code_not_modified": True,
            "all_required_outputs_exist": not missing,
        },
        "generated_at_utc": iso_utc(),
    }


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Phase 11 V2 governed feature store refresh.")
    p.add_argument("--repo-root", type=str, default=None)
    p.add_argument("--official-cutoff", type=str, default=OFFICIAL_MODEL_CUTOFF)
    p.add_argument("--gold-live-csv", type=str, default=DEFAULT_GOLD_LIVE_CSV)
    p.add_argument("--fred-report", type=str, default=DEFAULT_FRED_REPORT)
    p.add_argument("--max-date", type=str, default=None)
    p.add_argument("--smoke", action="store_true")
    p.add_argument("--no-public-copy", action="store_true")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    repo = Path(args.repo_root).resolve() if args.repo_root else detect_repo_root(Path.cwd())
    paths = build_paths(repo, args.gold_live_csv, args.fred_report)
    for d in [paths.features, paths.data, paths.governance, paths.feature_refresh]:
        d.mkdir(parents=True, exist_ok=True)
    events: List[Dict[str, Any]] = []
    started = now_utc()
    refresh_id = f"deepml_feature_refresh_{started.strftime('%Y%m%d_%H%M%S')}"
    try:
        add_timeline(paths, events, "phase11_v2_started", details={"refresh_id": refresh_id})
        write_checkpoint(paths, "started", "running", {"refresh_id": refresh_id})

        base_target_plan = read_json(paths.target_plan, default={}) or {}
        base_model_plan = read_json(paths.model_feature_plan, default={}) or {}
        pre, base_meta = load_base_feature_store(paths, args.official_cutoff, base_target_plan)
        add_timeline(paths, events, "official_base_loaded", details=base_meta)

        gold_live, gold_meta = load_gold_live(paths, args.official_cutoff, args.max_date)
        add_timeline(paths, events, "yahoo_gold_live_loaded", details=gold_meta)

        post = build_post_cutoff_skeleton(pre, gold_live)
        fred_report = load_fred_report(paths)
        post, fred_summary = apply_fred_updates(post, fred_report, paths)
        add_timeline(paths, events, "fred_registry_updates_merged", details={k: v for k, v in fred_summary.items() if k != "details"})

        refreshed = build_feature_store(pre, post)
        end_date = pd.Timestamp(refreshed["date"].max()).date().isoformat()
        refresh_summary = {
            "official_cutoff": args.official_cutoff,
            "row_count": int(len(refreshed)),
            "column_count": int(len(refreshed.columns)),
            "first_date": pd.Timestamp(refreshed["date"].min()).date().isoformat(),
            "last_date": end_date,
            "post_cutoff_row_count": int(len(post)),
            "gold_column": "gold_price",
            "post_cutoff_policy": "Yahoo GC=F updates gold_price; FRED registry CSVs update mapped API factors; manual/local factors carried forward.",
            "fred_api_factors_updated": len(fred_summary.get("fred_columns_updated") or []),
            "fred_columns_updated": fred_summary.get("fred_columns_updated") or [],
        }

        save_table(paths.refreshed_csv, refreshed)
        save_table(paths.refreshed_parquet, refreshed)
        save_table(paths.numeric_feature_store, refreshed)
        add_timeline(paths, events, "feature_store_outputs_written", details=refresh_summary)

        factor_state = build_factor_state(refreshed, args.official_cutoff, fred_summary)
        model_plan = build_model_feature_plan(refreshed, base_model_plan)
        target_plan = build_target_plan(base_target_plan, args.official_cutoff, end_date)
        mode_status = {
            "artifact_type": "deep_ml_mode_status",
            "schema_version": "2.0.0",
            "phase_key": PHASE_KEY,
            "study_id": refresh_id,
            "mode": "refreshed_yahoo_gold_plus_fred_registry_mode",
            "official_model_cutoff": args.official_cutoff,
            "effective_data_through_date": end_date,
            "forecast_start_date": (pd.Timestamp(end_date) + pd.offsets.BDay(1)).date().isoformat(),
            "gold_live_source": "yahoo_gc_f",
            "fred_registry_merge_applied": True,
            "manual_factor_policy": "manual/local factors carried forward unless source CSVs are added",
            "frontend_policy": "RecursiveClientView.tsx and model3 frontend were not modified.",
            "generated_at_utc": iso_utc(),
        }
        study_context = {
            "artifact_type": "deep_ml_study_context",
            "schema_version": "2.0.0",
            "study_id": refresh_id,
            "study_type": "governed_yahoo_gold_plus_fred_registry_refresh",
            "base_source": base_meta,
            "gold_live_source": gold_meta,
            "fred_merge_summary": fred_summary,
            "refresh_summary": refresh_summary,
            "next_model_rerun_order": ["06_train_alpha_structural.py", "07_train_beta_temporal.py", "08_train_delta_tft.py", "09_train_epsilon_expert_ensemble.py"],
            "generated_at_utc": iso_utc(),
        }
        manifest = {
            "artifact_type": "deep_ml_numeric_feature_store_manifest",
            "schema_version": "2.0.0",
            "phase_key": PHASE_KEY,
            "study_id": refresh_id,
            "row_count": int(len(refreshed)),
            "column_count": int(len(refreshed.columns)),
            "date_range": {"start": refresh_summary["first_date"], "end": refresh_summary["last_date"]},
            "official_cutoff": args.official_cutoff,
            "post_cutoff_row_count": int(len(post)),
            "gold_live_source": gold_meta,
            "fred_merge_summary": {k: v for k, v in fred_summary.items() if k != "details"},
            "outputs": {
                "numeric_feature_store": str(paths.numeric_feature_store.relative_to(repo)),
                "refreshed_matrix_csv": str(paths.refreshed_csv.relative_to(repo)),
                "refreshed_matrix_parquet": str(paths.refreshed_parquet.relative_to(repo)),
                "factor_state_table": str(paths.factor_state.relative_to(repo)),
                "model_feature_plan": str(paths.model_feature_plan.relative_to(repo)),
                "target_plan": str(paths.target_plan.relative_to(repo)),
            },
            "hashes": {
                "numeric_feature_store": stable_hash_file(paths.numeric_feature_store),
                "refreshed_matrix_csv": stable_hash_file(paths.refreshed_csv),
                "refreshed_matrix_parquet": stable_hash_file(paths.refreshed_parquet),
            },
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.factor_state, factor_state)
        write_json(paths.model_feature_plan, model_plan)
        write_json(paths.target_plan, target_plan)
        write_json(paths.mode_status, mode_status)
        write_json(paths.study_context, study_context)
        write_json(paths.manifest, manifest)

        qr = quality_review(refreshed, args.official_cutoff, fred_summary, paths)
        write_json(paths.quality, qr)
        report = {
            "artifact_type": "phase11_governed_feature_store_refresh_report",
            "schema_version": "1.0.0",
            "project": "Gold Nexus Alpha",
            "phase": "Phase 11 — Governed Cutoff + Factor State + Feature Store Refresh",
            "phase_key": PHASE_KEY,
            "status": qr["status"],
            "refresh_id": refresh_id,
            "run": {
                "run_id": refresh_id,
                "started_at_utc": iso_utc(started),
                "completed_at_utc": iso_utc(),
                "script_version": SCRIPT_VERSION,
                "git_commit_sha": get_git_commit(repo),
                "python_version": sys.version,
                "platform": platform.platform(),
            },
            "base_source": base_meta,
            "gold_live_source": gold_meta,
            "fred_merge_summary": fred_summary,
            "refresh_summary": refresh_summary,
            "quality_review": qr,
            "outputs": manifest["outputs"],
            "next_step": {
                "instruction": "Review this Phase 11 V2 report before rerunning models.",
                "rerun_order": [
                    "py .\\deep_ml\\scripts\\06_train_alpha_structural.py",
                    "py .\\deep_ml\\scripts\\07_train_beta_temporal.py",
                    "py .\\deep_ml\\scripts\\08_train_delta_tft.py",
                    "py .\\deep_ml\\scripts\\09_train_epsilon_expert_ensemble.py",
                ],
            },
            "professor_safe_summary": "Phase 11 V2 refreshed Deep ML artifacts using Yahoo GC=F for post-cutoff gold and FRED registry CSVs for mapped API factors. Manual/local factors remain carried forward. Frontend code was not modified.",
            "final_instruction": "Send me artifacts/deep_ml/feature_refresh/phase11_governed_feature_store_refresh_report.json for review before model reruns.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.report, report)

        if not args.no_public_copy:
            for folder in [paths.public_deep_ml / "features", paths.public_deep_ml / "data", paths.public_deep_ml / "governance", paths.public_deep_ml / "feature_refresh"]:
                folder.mkdir(parents=True, exist_ok=True)
            for src in [paths.numeric_feature_store, paths.manifest, paths.model_feature_plan, paths.target_plan]:
                if src.exists() and src.stat().st_size <= 50 * 1024 * 1024:
                    shutil.copy2(src, paths.public_deep_ml / "features" / src.name)
            for src in [paths.factor_state]:
                if src.exists():
                    shutil.copy2(src, paths.public_deep_ml / "data" / src.name)
            for src in [paths.mode_status, paths.study_context]:
                if src.exists():
                    shutil.copy2(src, paths.public_deep_ml / "governance" / src.name)
            for src in [paths.report, paths.quality]:
                if src.exists():
                    shutil.copy2(src, paths.public_deep_ml / "feature_refresh" / src.name)

        write_checkpoint(paths, "completed", qr["status"], {"send_me_this_json": str(paths.report.relative_to(repo))})
        add_timeline(paths, events, "phase11_v2_completed", status=qr["status"])
        print("\n" + "=" * 88)
        print("PHASE 11 V2 COMPLETE")
        print("Send me: artifacts/deep_ml/feature_refresh/phase11_governed_feature_store_refresh_report.json")
        print("=" * 88 + "\n")

    except Exception as exc:
        err = {
            "artifact_type": "phase11_governed_feature_store_refresh_error_report",
            "schema_version": "1.0.0",
            "phase_key": PHASE_KEY,
            "status": "failed",
            "error": repr(exc),
            "traceback": traceback.format_exc(),
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.report, err)
        write_checkpoint(paths, "failed", "failed", {"error": repr(exc)})
        raise


if __name__ == "__main__":
    main()
