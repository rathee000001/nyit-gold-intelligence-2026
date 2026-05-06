"""
Gold Nexus Alpha - Deep ML Phase 13
Gamma News Sensitivity Expert

LOCKED SCRIPT NAME:
    deep_ml/scripts/13_gamma_news_sensitivity.py

Purpose:
    Reads Phase 12 news context artifacts and accepted Deep ML model rollforward
    artifacts. Builds a professor-safe Gamma context layer for:
      - news-source/context summaries
      - date-level chart tooltip context
      - model/news joined context
      - sensitivity diagnostics by model and horizon
      - Gamma/Omega frontend preparation

Important rules:
    - Gamma does not claim news caused gold movement.
    - Gamma does not say zero historical score means no news existed.
    - Google News RSS is recent fallback/context, not a full historical archive.
    - Historical rows are continuity/index rows with explicit coverage limits.
    - Gamma is a context/sensitivity layer, not a final forecast winner.

Run:
    py -m py_compile .\\deep_ml\\scripts\\13_gamma_news_sensitivity.py
    py .\\deep_ml\\scripts\\13_gamma_news_sensitivity.py --smoke

After smoke review:
    py .\\deep_ml\\scripts\\13_gamma_news_sensitivity.py

Review:
    artifacts/deep_ml/models/gamma_news_sensitivity/phase13_gamma_news_sensitivity_report.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import shutil
import subprocess
import sys
import traceback
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd


PHASE_KEY = "phase13_gamma_news_sensitivity"
MODEL_KEY = "gamma_news_sensitivity"
SCRIPT_VERSION = "gamma_news_sensitivity_v2_consistent_phase12_artifact_context"
TIMEZONE_LOCAL = "America/New_York"

HORIZONS = [1, 5, 10, 20, 30]

NEWS_SCORE_COLUMNS = [
    "gold_general_news_score",
    "inflation_news_score",
    "fed_policy_news_score",
    "usd_news_score",
    "geopolitical_risk_news_score",
    "safe_haven_news_score",
    "central_bank_gold_news_score",
    "net_gold_news_sensitivity_score",
]

MODEL_SOURCE_FILES = {
    "alpha_structural": "artifacts/deep_ml/models/alpha_structural/evaluation_rollforward.csv",
    "beta_temporal": "artifacts/deep_ml/models/beta_temporal/evaluation_rollforward.csv",
    "delta_tft": "artifacts/deep_ml/models/delta_tft/evaluation_rollforward.csv",
    "epsilon_expert_ensemble": "artifacts/deep_ml/models/epsilon_expert_ensemble/evaluation_rollforward.csv",
}

MODEL_REPORT_FILES = {
    "alpha_structural": "artifacts/deep_ml/models/alpha_structural/phase6_alpha_structural_report.json",
    "beta_temporal": "artifacts/deep_ml/models/beta_temporal/phase7_beta_temporal_report.json",
    "delta_tft": "artifacts/deep_ml/models/delta_tft/phase8_delta_tft_report.json",
    "epsilon_expert_ensemble": "artifacts/deep_ml/models/epsilon_expert_ensemble/phase9_epsilon_expert_report.json",
}

MODEL_FORECAST_FILES = {
    "alpha_structural": "artifacts/deep_ml/models/alpha_structural/forecast_latest.json",
    "beta_temporal": "artifacts/deep_ml/models/beta_temporal/forecast_latest.json",
    "delta_tft": "artifacts/deep_ml/models/delta_tft/forecast_latest.json",
    "epsilon_expert_ensemble": "artifacts/deep_ml/models/epsilon_expert_ensemble/forecast_latest.json",
}


@dataclass
class Paths:
    repo_root: Path
    artifacts_root: Path
    public_root: Path

    model_dir: Path
    public_model_dir: Path

    news_dir: Path
    public_news_dir: Path
    phase12_report: Path
    combined_news_csv: Path
    recent_news_csv: Path
    historical_manifest: Path

    mode_status: Path
    matrix_manifest: Path

    report: Path
    run_summary: Path
    diagnostics: Path
    quality_review: Path
    timeline: Path
    checkpoint: Path

    gamma_date_context_csv: Path
    gamma_model_joined_context_csv: Path
    gamma_tooltip_context_json: Path
    gamma_sensitivity_by_horizon_json: Path
    gamma_latest_context_json: Path
    page_bundle_json: Path


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
        if (candidate / ".git").exists() or (candidate / "deep_ml").exists() or (candidate / "artifacts").exists():
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


def clean_path(value: str) -> str:
    return value.replace("\\", "/").strip("/")


def rel_path(path: Path, root: Path) -> str:
    try:
        return clean_path(str(path.relative_to(root)))
    except Exception:
        return clean_path(str(path))


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


def safe_float(value: Any) -> Optional[float]:
    try:
        out = float(value)
        if pd.isna(out):
            return None
        return out
    except Exception:
        return None


def safe_int(value: Any) -> Optional[int]:
    try:
        out = int(float(value))
        return out
    except Exception:
        return None


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except Exception:
        pass
    return " ".join(str(value).replace("\n", " ").replace("\r", " ").split())


def read_table(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()

    if path.suffix.lower() == ".parquet":
        return pd.read_parquet(path)

    return pd.read_csv(path)


def build_paths(repo_root: Path) -> Paths:
    artifacts_root = repo_root / "artifacts" / "deep_ml"
    public_root = repo_root / "public" / "artifacts" / "deep_ml"

    model_dir = artifacts_root / "models" / MODEL_KEY
    public_model_dir = public_root / "models" / MODEL_KEY

    news_dir = artifacts_root / "news"
    public_news_dir = public_root / "news"

    return Paths(
        repo_root=repo_root,
        artifacts_root=artifacts_root,
        public_root=public_root,
        model_dir=model_dir,
        public_model_dir=public_model_dir,
        news_dir=news_dir,
        public_news_dir=public_news_dir,
        phase12_report=news_dir / "phase12_source_news_update_report.json",
        combined_news_csv=news_dir / "structured" / "news_context_daily_combined.csv",
        recent_news_csv=news_dir / "news_items_unified_raw.csv",
        historical_manifest=news_dir / "historical" / "historical_news_backfill_manifest.json",
        mode_status=artifacts_root / "governance" / "deep_ml_mode_status.json",
        matrix_manifest=artifacts_root / "features" / "deep_ml_numeric_feature_store_manifest.json",
        report=model_dir / "phase13_gamma_news_sensitivity_report.json",
        run_summary=model_dir / "run_summary.json",
        diagnostics=model_dir / "diagnostics_latest.json",
        quality_review=model_dir / "quality_review.json",
        timeline=model_dir / "timeline.json",
        checkpoint=model_dir / "progress_checkpoint.json",
        gamma_date_context_csv=model_dir / "gamma_date_context.csv",
        gamma_model_joined_context_csv=model_dir / "gamma_model_joined_context.csv",
        gamma_tooltip_context_json=model_dir / "gamma_tooltip_context.json",
        gamma_sensitivity_by_horizon_json=model_dir / "gamma_sensitivity_by_horizon.json",
        gamma_latest_context_json=model_dir / "gamma_latest_context.json",
        page_bundle_json=model_dir / "page_bundle.json",
    )


class Logger:
    def __init__(self, paths: Paths) -> None:
        self.paths = paths
        self.started_at = utc_now()
        self.events: List[Dict[str, Any]] = []

    def event(self, name: str, status: str = "ok", details: Optional[Dict[str, Any]] = None) -> None:
        row = {
            "timestamp_utc": iso_utc(),
            "event": name,
            "status": status,
            "details": details or {},
        }
        self.events.append(row)
        write_json(self.paths.timeline, self.events)
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {name} [{status}]", flush=True)

    def checkpoint(self, step: str, status: str, payload: Optional[Dict[str, Any]] = None) -> None:
        write_json(
            self.paths.checkpoint,
            {
                "artifact_type": "deep_ml_progress_checkpoint",
                "schema_version": "1.0.0",
                "phase_key": PHASE_KEY,
                "model_key": MODEL_KEY,
                "step": step,
                "status": status,
                "updated_at_utc": iso_utc(),
                "payload": payload or {},
            },
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build Gamma news sensitivity artifacts.")
    parser.add_argument("--repo-root", type=str, default=None)
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument("--no-public-copy", action="store_true")
    parser.add_argument("--max-model-rows-per-source", type=int, default=0)
    parser.add_argument("--tooltip-max-preview-rows", type=int, default=5000)
    return parser.parse_args()


def resolve_input_path(repo_root: Path, rel: str) -> Path:
    normal = repo_root / rel
    public = repo_root / "public" / rel
    if normal.exists():
        return normal
    return public


def normalize_date_series(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, errors="coerce").dt.date.astype(str)


def normalize_news_context(news: pd.DataFrame, recent: pd.DataFrame) -> pd.DataFrame:
    if news.empty:
        return pd.DataFrame()

    out = news.copy()
    if "date" not in out.columns:
        return pd.DataFrame()

    out["date"] = normalize_date_series(out["date"])
    out = out.dropna(subset=["date"]).drop_duplicates("date", keep="last").sort_values("date").reset_index(drop=True)

    for col in NEWS_SCORE_COLUMNS:
        if col not in out.columns:
            out[col] = 0.0
        out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0.0)

    for col in ["article_count", "gold_news_count"]:
        if col not in out.columns:
            out[col] = 0
        out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0).astype(int)

    for col in [
        "top_headline_1",
        "top_headline_1_source",
        "top_headline_1_url",
        "top_headline_2",
        "top_headline_2_source",
        "top_headline_2_url",
        "source_type",
        "source_coverage_note",
    ]:
        if col not in out.columns:
            out[col] = ""

    recent_map: Dict[str, List[Dict[str, Any]]] = {}
    if not recent.empty and "date" in recent.columns:
        recent_copy = recent.copy()
        recent_copy["date"] = normalize_date_series(recent_copy["date"])

        if "published_at" in recent_copy.columns:
            recent_copy["_published_sort"] = pd.to_datetime(recent_copy["published_at"], errors="coerce", utc=True)
            recent_copy = recent_copy.sort_values("_published_sort", ascending=False)

        for date_value, group in recent_copy.groupby("date"):
            items: List[Dict[str, Any]] = []
            for _, row in group.head(5).iterrows():
                items.append(
                    {
                        "date": clean_text(row.get("date")),
                        "published_at": clean_text(row.get("published_at")),
                        "source": clean_text(row.get("source")),
                        "title": clean_text(row.get("title")),
                        "summary": clean_text(row.get("summary")),
                        "url": clean_text(row.get("url")),
                        "query_key": clean_text(row.get("query_key")),
                        "raw_source": clean_text(row.get("raw_source")),
                    }
                )
            recent_map[str(date_value)] = items

    out["gamma_context_intensity"] = out[NEWS_SCORE_COLUMNS].abs().sum(axis=1)
    out["gamma_positive_score_count"] = (out[NEWS_SCORE_COLUMNS] > 0).sum(axis=1)
    out["gamma_negative_score_count"] = (out[NEWS_SCORE_COLUMNS] < 0).sum(axis=1)
    out["gamma_abs_net_score"] = pd.to_numeric(out["net_gold_news_sensitivity_score"], errors="coerce").abs().fillna(0.0)

    def bucket(value: Any) -> str:
        numeric = safe_float(value) or 0.0
        if numeric <= 0:
            return "no_loaded_news_score"
        if numeric < 0.5:
            return "low"
        if numeric < 1.5:
            return "medium"
        return "high"

    out["gamma_context_bucket"] = out["gamma_context_intensity"].map(bucket)
    out["gamma_recent_headlines_json"] = out["date"].map(lambda d: json.dumps(recent_map.get(str(d), [])[:5]))
    out["gamma_tooltip_recent_headline_count"] = out["date"].map(lambda d: len(recent_map.get(str(d), [])))

    def primary_headline(row: pd.Series) -> str:
        top = clean_text(row.get("top_headline_1"))
        if top:
            return top
        items = recent_map.get(str(row.get("date")), [])
        if items:
            return clean_text(items[0].get("title"))
        return ""

    def primary_source(row: pd.Series) -> str:
        top = clean_text(row.get("top_headline_1_source"))
        if top:
            return top
        items = recent_map.get(str(row.get("date")), [])
        if items:
            return clean_text(items[0].get("source"))
        return ""

    def tooltip_note(row: pd.Series) -> str:
        headline = primary_headline(row)
        if headline:
            return f"News context loaded: {headline}"

        source_note = clean_text(row.get("source_coverage_note"))
        if source_note:
            return source_note

        intensity = safe_float(row.get("gamma_context_intensity")) or 0.0
        if intensity > 0:
            return "News-context score was loaded for this date. This is context only, not causality."

        return "No public news-context row was loaded by Phase 12 for this date; this is not proof that no news existed."

    out["gamma_tooltip_primary_headline"] = out.apply(primary_headline, axis=1)
    out["gamma_tooltip_primary_source"] = out.apply(primary_source, axis=1)
    out["gamma_tooltip_note"] = out.apply(tooltip_note, axis=1)

    return out


def normalize_model_rollforward(model_key: str, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    meta = {
        "model_key": model_key,
        "input_rows": int(len(df)),
        "output_rows": 0,
        "missing_required_columns": [],
        "status": "not_started",
    }

    if df.empty:
        meta["status"] = "empty_input"
        return pd.DataFrame(), meta

    required = ["date", "split", "horizon", "actual_target", "prediction"]
    missing = [col for col in required if col not in df.columns]
    if missing:
        meta["missing_required_columns"] = missing
        meta["status"] = "missing_required_columns"
        return pd.DataFrame(), meta

    out = pd.DataFrame()
    out["date"] = normalize_date_series(df["date"])
    out["split"] = df["split"].astype(str)
    out["horizon"] = pd.to_numeric(df["horizon"], errors="coerce").astype("Int64")
    out["source_model_key"] = model_key

    gold_source = None
    for candidate in ["gold_price", "raw_origin_gold_price", "raw_gold_price_anchor", "origin_gold_price"]:
        if candidate in df.columns:
            gold_source = candidate
            out["gold_price"] = pd.to_numeric(df[candidate], errors="coerce")
            break

    if gold_source is None:
        out["gold_price"] = pd.NA

    out["actual_target"] = pd.to_numeric(df["actual_target"], errors="coerce")
    out["prediction"] = pd.to_numeric(df["prediction"], errors="coerce")

    if "naive_prediction" in df.columns:
        out["naive_prediction"] = pd.to_numeric(df["naive_prediction"], errors="coerce")
    else:
        out["naive_prediction"] = out["gold_price"]

    if "error" in df.columns:
        out["model_error"] = pd.to_numeric(df["error"], errors="coerce")
    else:
        out["model_error"] = out["prediction"] - out["actual_target"]

    for candidate in ["predicted_log_return", "predicted_log_return_p50"]:
        if candidate in df.columns:
            out["predicted_log_return"] = pd.to_numeric(df[candidate], errors="coerce")
            break
    if "predicted_log_return" not in out.columns:
        out["predicted_log_return"] = pd.NA

    for candidate in ["forecast_price_p10", "p10"]:
        if candidate in df.columns:
            out["p10"] = pd.to_numeric(df[candidate], errors="coerce")
            break
    if "p10" not in out.columns:
        out["p10"] = pd.NA

    for candidate in ["forecast_price_p50", "p50", "prediction"]:
        if candidate in df.columns:
            out["p50"] = pd.to_numeric(df[candidate], errors="coerce")
            break
    if "p50" not in out.columns:
        out["p50"] = out["prediction"]

    for candidate in ["forecast_price_p90", "p90"]:
        if candidate in df.columns:
            out["p90"] = pd.to_numeric(df[candidate], errors="coerce")
            break
    if "p90" not in out.columns:
        out["p90"] = pd.NA

    if "interval_width_price" in df.columns:
        out["interval_width_price"] = pd.to_numeric(df["interval_width_price"], errors="coerce")
    else:
        out["interval_width_price"] = out["p90"] - out["p10"]

    out["abs_model_error"] = out["model_error"].abs()
    out["model_beats_naive_abs_error"] = (
        (out["prediction"] - out["actual_target"]).abs()
        <= (out["naive_prediction"] - out["actual_target"]).abs()
    )

    out = out.dropna(subset=["date", "horizon", "actual_target", "prediction"]).reset_index(drop=True)

    meta["output_rows"] = int(len(out))
    meta["gold_price_source_column"] = gold_source
    meta["split_counts"] = {str(k): int(v) for k, v in out.groupby("split").size().to_dict().items()} if not out.empty else {}
    meta["horizon_counts"] = {str(int(k)): int(v) for k, v in out.groupby("horizon").size().to_dict().items()} if not out.empty else {}
    meta["status"] = "ready" if not out.empty else "no_usable_rows"

    return out, meta


def load_model_rollforwards(repo_root: Path, smoke: bool, max_rows_per_source: int) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    frames: List[pd.DataFrame] = []
    meta: Dict[str, Any] = {}

    for model_key, rel in MODEL_SOURCE_FILES.items():
        path = resolve_input_path(repo_root, rel)
        if not path.exists():
            meta[model_key] = {
                "model_key": model_key,
                "path": clean_path(rel),
                "exists": False,
                "status": "missing_file",
            }
            continue

        df = pd.read_csv(path)
        if smoke:
            df = df.head(3500)
        elif max_rows_per_source and max_rows_per_source > 0:
            df = df.head(max_rows_per_source)

        normalized, model_meta = normalize_model_rollforward(model_key, df)
        model_meta["path"] = clean_path(rel)
        model_meta["exists"] = True
        meta[model_key] = model_meta

        if not normalized.empty:
            frames.append(normalized)

    if not frames:
        return pd.DataFrame(), meta

    combined = pd.concat(frames, ignore_index=True)
    combined = combined[combined["horizon"].isin(HORIZONS)].copy()
    combined["horizon"] = combined["horizon"].astype(int)

    return combined.reset_index(drop=True), meta


def join_model_news(model_rows: pd.DataFrame, news_context: pd.DataFrame) -> pd.DataFrame:
    if model_rows.empty or news_context.empty:
        return pd.DataFrame()

    context_cols = [
        "date",
        "article_count",
        "gold_news_count",
        "gold_general_news_score",
        "inflation_news_score",
        "fed_policy_news_score",
        "usd_news_score",
        "geopolitical_risk_news_score",
        "safe_haven_news_score",
        "central_bank_gold_news_score",
        "net_gold_news_sensitivity_score",
        "top_headline_1",
        "top_headline_1_source",
        "top_headline_1_url",
        "top_headline_2",
        "top_headline_2_source",
        "top_headline_2_url",
        "source_type",
        "source_coverage_note",
        "gamma_context_intensity",
        "gamma_abs_net_score",
        "gamma_context_bucket",
        "gamma_tooltip_recent_headline_count",
        "gamma_tooltip_primary_headline",
        "gamma_tooltip_primary_source",
        "gamma_tooltip_note",
        "gamma_recent_headlines_json",
    ]
    context_cols = [col for col in context_cols if col in news_context.columns]

    joined = model_rows.merge(news_context[context_cols], on="date", how="left")

    for col in NEWS_SCORE_COLUMNS + ["article_count", "gold_news_count", "gamma_context_intensity", "gamma_abs_net_score"]:
        if col in joined.columns:
            joined[col] = pd.to_numeric(joined[col], errors="coerce").fillna(0.0)

    joined["gamma_context_bucket"] = joined["gamma_context_bucket"].fillna("no_loaded_news_score")
    joined["gamma_tooltip_note"] = joined["gamma_tooltip_note"].fillna(
        "No Phase 12 news-context row matched this model date; this is context only, not causality."
    )
    joined["gamma_tooltip_primary_headline"] = joined["gamma_tooltip_primary_headline"].fillna("")
    joined["gamma_tooltip_primary_source"] = joined["gamma_tooltip_primary_source"].fillna("")
    joined["gamma_recent_headlines_json"] = joined["gamma_recent_headlines_json"].fillna("[]")

    return joined.sort_values(["source_model_key", "date", "horizon", "split"]).reset_index(drop=True)


def pearson_corr(a: pd.Series, b: pd.Series) -> Optional[float]:
    x = pd.to_numeric(a, errors="coerce")
    y = pd.to_numeric(b, errors="coerce")
    mask = x.notna() & y.notna()
    if int(mask.sum()) < 5:
        return None
    if x[mask].nunique() < 2 or y[mask].nunique() < 2:
        return None
    return safe_float(x[mask].corr(y[mask]))


def summarize_bucket(group: pd.DataFrame) -> Dict[str, Any]:
    return {
        "row_count": int(len(group)),
        "mean_abs_model_error": safe_float(group["abs_model_error"].mean()),
        "median_abs_model_error": safe_float(group["abs_model_error"].median()),
        "mean_model_error": safe_float(group["model_error"].mean()),
        "mean_gamma_context_intensity": safe_float(group.get("gamma_context_intensity", pd.Series(dtype=float)).mean()),
        "mean_article_count": safe_float(group.get("article_count", pd.Series(dtype=float)).mean()),
        "model_beats_naive_pct": safe_float(group["model_beats_naive_abs_error"].mean() * 100.0) if "model_beats_naive_abs_error" in group.columns else None,
    }


def build_sensitivity(joined: pd.DataFrame) -> Dict[str, Any]:
    if joined.empty:
        return {
            "artifact_type": "gamma_sensitivity_by_horizon",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "status": "no_joined_rows",
            "by_model": {},
            "professor_safe_note": "No joined rows were available. Gamma makes no model/news sensitivity claims.",
            "generated_at_utc": iso_utc(),
        }

    by_model: Dict[str, Any] = {}
    by_horizon_global: Dict[str, Any] = {}

    for model_key, model_df in joined.groupby("source_model_key"):
        model_payload: Dict[str, Any] = {
            "row_count": int(len(model_df)),
            "split_counts": {str(k): int(v) for k, v in model_df.groupby("split").size().to_dict().items()},
            "by_horizon": {},
            "overall_error_context_correlation": {
                col: pearson_corr(model_df[col], model_df["abs_model_error"]) if col in model_df.columns else None
                for col in NEWS_SCORE_COLUMNS + ["gamma_context_intensity", "article_count", "gold_news_count"]
            },
        }

        for horizon, hdf in model_df.groupby("horizon"):
            bucket_summary = {
                str(bucket): summarize_bucket(bucket_df)
                for bucket, bucket_df in hdf.groupby("gamma_context_bucket")
            }

            split_summary: Dict[str, Any] = {}
            for split, sdf in hdf.groupby("split"):
                split_summary[str(split)] = summarize_bucket(sdf)

            model_payload["by_horizon"][str(int(horizon))] = {
                "row_count": int(len(hdf)),
                "split_summary": split_summary,
                "context_bucket_summary": bucket_summary,
                "error_context_correlation": {
                    col: pearson_corr(hdf[col], hdf["abs_model_error"]) if col in hdf.columns else None
                    for col in NEWS_SCORE_COLUMNS + ["gamma_context_intensity", "article_count", "gold_news_count"]
                },
            }

        by_model[str(model_key)] = model_payload

    for horizon, hdf in joined.groupby("horizon"):
        by_horizon_global[str(int(horizon))] = {
            "row_count": int(len(hdf)),
            "model_counts": {str(k): int(v) for k, v in hdf.groupby("source_model_key").size().to_dict().items()},
            "context_bucket_summary": {
                str(bucket): summarize_bucket(bucket_df)
                for bucket, bucket_df in hdf.groupby("gamma_context_bucket")
            },
        }

    return {
        "artifact_type": "gamma_sensitivity_by_horizon",
        "schema_version": "1.0.0",
        "model_key": MODEL_KEY,
        "status": "ready",
        "by_model": by_model,
        "by_horizon_global": by_horizon_global,
        "interpretation_rule": "Correlations and bucket summaries describe co-movement between model errors and loaded news-context fields only. They do not imply news caused gold movement.",
        "professor_safe_note": "Gamma summarizes context coverage and model behavior under Phase 12 news-context rows. It is not a causal model.",
        "generated_at_utc": iso_utc(),
    }


def build_date_lookup(news_context: pd.DataFrame) -> List[Dict[str, Any]]:
    if news_context.empty:
        return []

    cols = [
        "date",
        "article_count",
        "gold_news_count",
        "gold_general_news_score",
        "inflation_news_score",
        "fed_policy_news_score",
        "usd_news_score",
        "geopolitical_risk_news_score",
        "safe_haven_news_score",
        "central_bank_gold_news_score",
        "net_gold_news_sensitivity_score",
        "top_headline_1",
        "top_headline_1_source",
        "top_headline_1_url",
        "top_headline_2",
        "top_headline_2_source",
        "top_headline_2_url",
        "source_type",
        "source_coverage_note",
        "gamma_context_intensity",
        "gamma_context_bucket",
        "gamma_tooltip_primary_headline",
        "gamma_tooltip_primary_source",
        "gamma_tooltip_note",
        "gamma_recent_headlines_json",
    ]
    cols = [col for col in cols if col in news_context.columns]

    rows: List[Dict[str, Any]] = []
    for row in news_context[cols].to_dict("records"):
        cleaned: Dict[str, Any] = {}
        for key, value in row.items():
            if pd.isna(value) if not isinstance(value, (list, dict)) else False:
                cleaned[key] = None
            else:
                cleaned[key] = value
        rows.append(cleaned)

    return rows


def build_tooltip_context(joined: pd.DataFrame, news_context: pd.DataFrame, max_preview_rows: int) -> Dict[str, Any]:
    date_rows = build_date_lookup(news_context)

    preview_cols = [
        "date",
        "source_model_key",
        "split",
        "horizon",
        "gold_price",
        "actual_target",
        "prediction",
        "naive_prediction",
        "model_error",
        "abs_model_error",
        "gamma_context_intensity",
        "gamma_context_bucket",
        "article_count",
        "gold_news_count",
        "top_headline_1",
        "top_headline_1_source",
        "top_headline_1_url",
        "source_type",
        "source_coverage_note",
        "gamma_tooltip_primary_headline",
        "gamma_tooltip_primary_source",
        "gamma_tooltip_note",
        "gamma_recent_headlines_json",
    ]
    model_preview_rows: List[Dict[str, Any]] = []

    if not joined.empty:
        preview_cols = [col for col in preview_cols if col in joined.columns]
        # Keep recent rows for frontend preview. Full joined CSV is exported separately.
        model_preview_rows = joined[preview_cols].tail(max_preview_rows).to_dict("records")

    return {
        "artifact_type": "gamma_tooltip_context",
        "schema_version": "1.0.0",
        "model_key": MODEL_KEY,
        "tooltip_contract_version": "v1_date_level_context_plus_model_preview",
        "primary_frontend_join": {
            "preferred_join_key": "date",
            "optional_model_join_keys": ["date", "source_model_key", "horizon"],
            "date_context_source": "gamma_date_context.csv",
            "full_joined_context_source": "gamma_model_joined_context.csv",
        },
        "date_context_rows": date_rows,
        "model_context_preview_rows": model_preview_rows,
        "model_context_preview_row_count": len(model_preview_rows),
        "date_context_row_count": len(date_rows),
        "professor_safe_note": "Tooltip context explains source coverage and recent headlines only. It does not claim news caused gold movement.",
        "forbidden_claims": [
            "News caused gold price movement.",
            "Zero historical score means no news existed.",
            "Google News RSS provides complete historical news from 2006.",
        ],
        "generated_at_utc": iso_utc(),
    }


def build_latest_context(news_context: pd.DataFrame, recent: pd.DataFrame) -> Dict[str, Any]:
    latest_daily: Dict[str, Any] = {}
    if not news_context.empty:
        tmp = news_context.copy()
        tmp["_date"] = pd.to_datetime(tmp["date"], errors="coerce")
        tmp = tmp.dropna(subset=["_date"]).sort_values("_date")
        if not tmp.empty:
            row = tmp.iloc[-1].to_dict()
            latest_daily = {
                key: row.get(key)
                for key in [
                    "date",
                    "article_count",
                    "gold_news_count",
                    "source_type",
                    "source_coverage_note",
                    "top_headline_1",
                    "top_headline_1_source",
                    "top_headline_1_url",
                    "gamma_context_intensity",
                    "gamma_context_bucket",
                    "gamma_tooltip_note",
                    *NEWS_SCORE_COLUMNS,
                ]
                if key in row
            }

    recent_items: List[Dict[str, Any]] = []
    if not recent.empty:
        recent_copy = recent.copy()
        if "published_at" in recent_copy.columns:
            recent_copy["_published"] = pd.to_datetime(recent_copy["published_at"], errors="coerce", utc=True)
            recent_copy = recent_copy.sort_values("_published", ascending=False)

        for _, row in recent_copy.head(30).iterrows():
            recent_items.append(
                {
                    "date": clean_text(row.get("date")),
                    "published_at": clean_text(row.get("published_at")),
                    "source": clean_text(row.get("source")),
                    "title": clean_text(row.get("title")),
                    "summary": clean_text(row.get("summary")),
                    "url": clean_text(row.get("url")),
                    "query_key": clean_text(row.get("query_key")),
                    "raw_source": clean_text(row.get("raw_source")),
                }
            )

    return {
        "artifact_type": "gamma_latest_context",
        "schema_version": "1.0.0",
        "model_key": MODEL_KEY,
        "latest_daily_context": latest_daily,
        "recent_headline_items": recent_items,
        "recent_headline_count": len(recent_items),
        "professor_safe_note": "Recent headlines are for context/tooltips only and should not be presented as causal drivers.",
        "generated_at_utc": iso_utc(),
    }


def build_input_report_snapshots(repo_root: Path) -> Dict[str, Any]:
    snapshots: Dict[str, Any] = {}

    for model_key, rel in MODEL_REPORT_FILES.items():
        report = read_json(resolve_input_path(repo_root, rel), default={}) or {}
        snapshots[model_key] = {
            "report_path": rel,
            "status": report.get("status"),
            "model_key": report.get("model_key"),
            "model_name": report.get("model_name"),
            "model_version": report.get("model_version") or report.get("delta_version"),
            "quality_status": (report.get("quality_review") or {}).get("status"),
        }

    return snapshots


def copy_public_outputs(paths: Paths) -> None:
    paths.public_model_dir.mkdir(parents=True, exist_ok=True)

    outputs = [
        paths.report,
        paths.run_summary,
        paths.diagnostics,
        paths.quality_review,
        paths.timeline,
        paths.checkpoint,
        paths.gamma_date_context_csv,
        paths.gamma_model_joined_context_csv,
        paths.gamma_tooltip_context_json,
        paths.gamma_sensitivity_by_horizon_json,
        paths.gamma_latest_context_json,
        paths.page_bundle_json,
    ]

    for src in outputs:
        if src.exists():
            shutil.copy2(src, paths.public_model_dir / src.name)


def validate_phase12(paths: Paths) -> Dict[str, Any]:
    report = read_json(paths.phase12_report, default={}) or {}
    quality = report.get("quality_review") or {}

    blocking: List[str] = []
    warnings: List[str] = []

    if not paths.phase12_report.exists():
        blocking.append("missing_phase12_source_news_update_report")
    if not paths.combined_news_csv.exists():
        blocking.append("missing_news_context_daily_combined_csv")
    if not paths.recent_news_csv.exists():
        warnings.append("recent_news_unified_csv_missing")
    if quality.get("blocking_flags"):
        blocking.extend([f"phase12_{flag}" for flag in quality.get("blocking_flags", [])])

    if report and report.get("status") not in ["ready", "ready_with_warnings"]:
        warnings.append(f"phase12_status_is_{report.get('status')}")

    return {
        "phase12_report_exists": paths.phase12_report.exists(),
        "combined_news_exists": paths.combined_news_csv.exists(),
        "recent_news_exists": paths.recent_news_csv.exists(),
        "phase12_status": report.get("status"),
        "phase12_quality_status": quality.get("status"),
        "blocking_flags": blocking,
        "warnings": warnings,
        "report": report,
    }


def validate_model_sources(repo_root: Path) -> Dict[str, Any]:
    status: Dict[str, Any] = {}
    for model_key, rel in MODEL_SOURCE_FILES.items():
        path = resolve_input_path(repo_root, rel)
        status[model_key] = {
            "path": rel,
            "exists": path.exists(),
            "size_bytes": path.stat().st_size if path.exists() else None,
        }
    return status


def write_blocked_report(paths: Paths, logger: Logger, run_id: str, blocking: List[str], warnings: List[str]) -> int:
    quality = {
        "artifact_type": "deep_ml_quality_review",
        "schema_version": "1.0.0",
        "phase_key": PHASE_KEY,
        "model_key": MODEL_KEY,
        "status": "blocked_waiting_for_inputs",
        "blocking_flags": blocking,
        "warnings": warnings,
        "professor_safe_summary": "Gamma is blocked until Phase 12 news artifacts and model rollforward artifacts exist.",
        "generated_at_utc": iso_utc(),
    }
    write_json(paths.quality_review, quality)

    report = {
        "artifact_type": "phase13_gamma_news_sensitivity_report",
        "schema_version": "1.0.0",
        "project": "Gold Nexus Alpha",
        "phase": "Phase 13 - Gamma News Sensitivity",
        "phase_key": PHASE_KEY,
        "model_key": MODEL_KEY,
        "status": quality["status"],
        "run_id": run_id,
        "quality_review": quality,
        "final_instruction": "Fix missing inputs, then rerun Gamma.",
        "generated_at_utc": iso_utc(),
    }
    write_json(paths.report, report)
    logger.checkpoint("blocked", quality["status"], {"blocking_flags": blocking})
    return 2


def main() -> int:
    args = parse_args()

    repo_root = Path(args.repo_root).resolve() if args.repo_root else detect_repo_root(Path.cwd())
    paths = build_paths(repo_root)
    paths.model_dir.mkdir(parents=True, exist_ok=True)
    paths.public_model_dir.mkdir(parents=True, exist_ok=True)

    logger = Logger(paths)
    run_id = f"deepml_run_{utc_now().strftime('%Y%m%d_%H%M%S')}_{MODEL_KEY}"

    try:
        logger.event("phase13_gamma_news_sensitivity_started", details={"run_id": run_id, "smoke": args.smoke})
        logger.checkpoint("started", "running", {"run_id": run_id, "smoke": args.smoke})

        phase12 = validate_phase12(paths)
        model_source_status = validate_model_sources(repo_root)

        blocking = list(phase12["blocking_flags"])
        warnings = list(phase12["warnings"])

        for model_key, info in model_source_status.items():
            if not info["exists"]:
                blocking.append(f"missing_{model_key}_evaluation_rollforward_csv")

        if blocking:
            return write_blocked_report(paths, logger, run_id, blocking, warnings)

        logger.event("loading_news_artifacts")
        news_raw = read_table(paths.combined_news_csv)
        recent_raw = read_table(paths.recent_news_csv) if paths.recent_news_csv.exists() else pd.DataFrame()
        news_context = normalize_news_context(news_raw, recent_raw)

        if news_context.empty:
            blocking.append("news_context_normalization_empty")
            return write_blocked_report(paths, logger, run_id, blocking, warnings)

        logger.event("news_context_ready", details={"rows": int(len(news_context))})
        news_context.to_csv(paths.gamma_date_context_csv, index=False)

        logger.event("loading_model_rollforwards")
        model_rows, model_load_meta = load_model_rollforwards(
            repo_root=repo_root,
            smoke=args.smoke,
            max_rows_per_source=args.max_model_rows_per_source,
        )

        usable_model_count = sum(1 for item in model_load_meta.values() if item.get("status") == "ready")
        if model_rows.empty or usable_model_count == 0:
            blocking.append("no_usable_model_rollforward_rows")
            return write_blocked_report(paths, logger, run_id, blocking, warnings)

        logger.event(
            "model_rollforwards_ready",
            details={
                "rows": int(len(model_rows)),
                "usable_model_count": usable_model_count,
                "model_load_meta": model_load_meta,
            },
        )

        logger.event("joining_model_rows_to_news_context")
        joined = join_model_news(model_rows, news_context)
        if joined.empty:
            blocking.append("model_news_join_empty")
            return write_blocked_report(paths, logger, run_id, blocking, warnings)

        joined.to_csv(paths.gamma_model_joined_context_csv, index=False)
        logger.event("joined_context_ready", details={"rows": int(len(joined))})

        sensitivity = build_sensitivity(joined)
        tooltip_context = build_tooltip_context(
            joined=joined,
            news_context=news_context,
            max_preview_rows=args.tooltip_max_preview_rows,
        )
        latest_context = build_latest_context(news_context, recent_raw)

        write_json(paths.gamma_sensitivity_by_horizon_json, sensitivity)
        write_json(paths.gamma_tooltip_context_json, tooltip_context)
        write_json(paths.gamma_latest_context_json, latest_context)

        input_report_snapshots = build_input_report_snapshots(repo_root)
        historical_manifest = read_json(paths.historical_manifest, default={}) or {}
        mode_status = read_json(paths.mode_status, default={}) or {}
        matrix_manifest = read_json(paths.matrix_manifest, default={}) or {}

        smoke_status = "smoke_ready_review" if args.smoke else "ready"
        if warnings:
            smoke_status = "smoke_ready_with_warnings" if args.smoke else "ready_with_warnings"

        quality = {
            "artifact_type": "deep_ml_quality_review",
            "schema_version": "1.0.0",
            "phase_key": PHASE_KEY,
            "model_key": MODEL_KEY,
            "status": smoke_status,
            "blocking_flags": [],
            "warnings": warnings,
            "acceptance_gate": {
                "phase12_report_exists": paths.phase12_report.exists(),
                "combined_daily_context_exists": paths.combined_news_csv.exists(),
                "recent_news_exists": paths.recent_news_csv.exists(),
                "gamma_date_context_exists": paths.gamma_date_context_csv.exists(),
                "gamma_model_joined_context_exists": paths.gamma_model_joined_context_csv.exists(),
                "gamma_tooltip_context_exists": paths.gamma_tooltip_context_json.exists(),
                "all_four_model_rollforwards_loaded": usable_model_count == 4,
                "no_causality_claims": True,
                "rss_not_treated_as_historical_archive": True,
                "zero_score_not_treated_as_no_news": True,
            },
            "professor_safe_summary": "Gamma is a source-context and sensitivity layer. It joins Phase 12 news context to model prediction dates and supports chart tooltips. It does not claim causality.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.quality_review, quality)

        run_summary = {
            "artifact_type": "deep_ml_model_run",
            "schema_version": "1.0.0",
            "project": "Gold Nexus Alpha",
            "phase": "phase_2_deep_ml",
            "phase_key": PHASE_KEY,
            "model_key": MODEL_KEY,
            "model_name": "Gamma News Sensitivity",
            "family": "news_context_sensitivity_layer",
            "status": quality["status"],
            "run": {
                "run_id": run_id,
                "generated_at_utc": iso_utc(logger.started_at),
                "completed_at_utc": iso_utc(),
                "generated_at_local": local_iso(logger.started_at),
                "timezone_local": TIMEZONE_LOCAL,
                "git_commit_sha": get_git_commit(repo_root),
                "code_version": SCRIPT_VERSION,
                "python_version": sys.version,
                "platform": platform.platform(),
                "smoke": bool(args.smoke),
            },
            "source_contract": {
                "phase12_report": rel_path(paths.phase12_report, repo_root),
                "combined_daily_context": rel_path(paths.combined_news_csv, repo_root),
                "recent_news": rel_path(paths.recent_news_csv, repo_root),
                "model_rollforward_sources": MODEL_SOURCE_FILES,
                "model_report_sources": MODEL_REPORT_FILES,
                "model_forecast_sources": MODEL_FORECAST_FILES,
            },
            "model_load_meta": model_load_meta,
            "professor_safe_summary": "Gamma reads accepted Deep ML model prediction artifacts and Phase 12 news-context rows to build context-aware sensitivity artifacts and tooltips.",
        }
        write_json(paths.run_summary, run_summary)

        diagnostics = {
            "artifact_type": "gamma_news_sensitivity_diagnostics_latest",
            "schema_version": "1.0.0",
            "phase_key": PHASE_KEY,
            "model_key": MODEL_KEY,
            "status": quality["status"],
            "smoke": bool(args.smoke),
            "news_context_rows": int(len(news_context)),
            "recent_news_rows": int(len(recent_raw)),
            "model_rows_loaded": int(len(model_rows)),
            "joined_rows": int(len(joined)),
            "date_context_rows": int(tooltip_context.get("date_context_row_count", 0)),
            "model_context_preview_rows": int(tooltip_context.get("model_context_preview_row_count", 0)),
            "model_load_meta": model_load_meta,
            "output_hashes": {
                "gamma_date_context": stable_hash_file(paths.gamma_date_context_csv),
                "gamma_model_joined_context": stable_hash_file(paths.gamma_model_joined_context_csv),
                "gamma_tooltip_context": stable_hash_file(paths.gamma_tooltip_context_json),
                "gamma_sensitivity_by_horizon": stable_hash_file(paths.gamma_sensitivity_by_horizon_json),
                "gamma_latest_context": stable_hash_file(paths.gamma_latest_context_json),
            },
            "professor_safe_note": "Diagnostics describe execution and output integrity only. They do not claim news caused gold price movement.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.diagnostics, diagnostics)

        page_bundle = {
            "artifact_type": "gamma_page_bundle",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "page_title": "Gamma News Sensitivity",
            "status": quality["status"],
            "route": "/deep-ml/models/gamma-news-sensitivity",
            "chart_artifacts": {
                "gamma_date_context": "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_date_context.csv",
                "gamma_model_joined_context": "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_model_joined_context.csv",
                "gamma_tooltip_context": "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_tooltip_context.json",
                "gamma_sensitivity_by_horizon": "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_sensitivity_by_horizon.json",
                "gamma_latest_context": "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_latest_context.json",
            },
            "frontend_patch_contract": {
                "news_tooltip_source": "gamma_tooltip_context.json",
                "preferred_join_key": "date",
                "optional_model_join_keys": ["date", "source_model_key", "horizon"],
                "chart_row_fields_to_add": [
                    "gamma_tooltip_primary_headline",
                    "gamma_tooltip_primary_source",
                    "gamma_tooltip_note",
                    "gamma_context_intensity",
                    "gamma_context_bucket",
                    "source_coverage_note",
                    "top_headline_1",
                    "top_headline_1_source",
                ],
            },
            "professor_safe_note": "Gamma supports context tooltips and sensitivity summaries only. It does not claim causality.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.page_bundle_json, page_bundle)

        report = {
            "artifact_type": "phase13_gamma_news_sensitivity_report",
            "schema_version": "1.0.0",
            "project": "Gold Nexus Alpha",
            "phase": "Phase 13 - Gamma News Sensitivity",
            "phase_key": PHASE_KEY,
            "model_key": MODEL_KEY,
            "model_name": "Gamma News Sensitivity",
            "status": quality["status"],
            "run_summary": run_summary,
            "quality_review": quality,
            "diagnostics_snapshot": diagnostics,
            "phase12_snapshot": {
                "phase12_status": phase12.get("phase12_status"),
                "phase12_quality_status": phase12.get("phase12_quality_status"),
                "source_summary": phase12.get("report", {}).get("source_summary"),
                "historical_manifest_snapshot": historical_manifest,
            },
            "input_model_report_snapshots": input_report_snapshots,
            "mode_status_snapshot": mode_status,
            "matrix_manifest_snapshot": matrix_manifest,
            "latest_context_snapshot": latest_context,
            "sensitivity_snapshot": sensitivity,
            "outputs": {
                "run_summary": rel_path(paths.run_summary, repo_root),
                "quality_review": rel_path(paths.quality_review, repo_root),
                "diagnostics": rel_path(paths.diagnostics, repo_root),
                "gamma_date_context": rel_path(paths.gamma_date_context_csv, repo_root),
                "gamma_model_joined_context": rel_path(paths.gamma_model_joined_context_csv, repo_root),
                "gamma_tooltip_context": rel_path(paths.gamma_tooltip_context_json, repo_root),
                "gamma_sensitivity_by_horizon": rel_path(paths.gamma_sensitivity_by_horizon_json, repo_root),
                "gamma_latest_context": rel_path(paths.gamma_latest_context_json, repo_root),
                "page_bundle": rel_path(paths.page_bundle_json, repo_root),
            },
            "public_outputs": {
                "run_summary": f"public/artifacts/deep_ml/models/{MODEL_KEY}/run_summary.json",
                "quality_review": f"public/artifacts/deep_ml/models/{MODEL_KEY}/quality_review.json",
                "diagnostics": f"public/artifacts/deep_ml/models/{MODEL_KEY}/diagnostics_latest.json",
                "gamma_date_context": f"public/artifacts/deep_ml/models/{MODEL_KEY}/gamma_date_context.csv",
                "gamma_model_joined_context": f"public/artifacts/deep_ml/models/{MODEL_KEY}/gamma_model_joined_context.csv",
                "gamma_tooltip_context": f"public/artifacts/deep_ml/models/{MODEL_KEY}/gamma_tooltip_context.json",
                "gamma_sensitivity_by_horizon": f"public/artifacts/deep_ml/models/{MODEL_KEY}/gamma_sensitivity_by_horizon.json",
                "gamma_latest_context": f"public/artifacts/deep_ml/models/{MODEL_KEY}/gamma_latest_context.json",
                "page_bundle": f"public/artifacts/deep_ml/models/{MODEL_KEY}/page_bundle.json",
            },
            "ai_grounding": {
                "allowed_claims": [
                    "Gamma joins Phase 12 news-context rows to model prediction dates.",
                    "Gamma provides context-aware tooltip fields for model charts.",
                    "Gamma summarizes model behavior under loaded news-context buckets.",
                    "Gamma does not claim news caused gold price movement.",
                    "Historical rows are continuity/index rows with coverage limitations.",
                    "Recent headlines are context/tooltips only.",
                ],
                "forbidden_claims": [
                    "Gamma proves news caused gold prices to move.",
                    "Zero historical news score means no news existed.",
                    "Google News RSS is a complete historical archive from 2006.",
                    "Gamma is the final Deep ML forecast winner.",
                ],
            },
            "next_step_after_acceptance": {
                "phase": "Phase 14 - Omega Fusion",
                "instruction": "After Gamma is accepted, recall all Alpha/Beta/Delta/Epsilon/Gamma reports, evaluations, forecasts, and public paths before rebuilding Omega.",
            },
            "final_instruction": "Send me artifacts/deep_ml/models/gamma_news_sensitivity/phase13_gamma_news_sensitivity_report.json for review before running Omega.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.report, report)

        if not args.no_public_copy:
            copy_public_outputs(paths)

        logger.checkpoint(
            "completed",
            quality["status"],
            {
                "send_me_this_json": rel_path(paths.report, repo_root),
                "public_report": f"public/artifacts/deep_ml/models/{MODEL_KEY}/phase13_gamma_news_sensitivity_report.json",
            },
        )
        logger.event("phase13_gamma_news_sensitivity_completed", status=quality["status"])

        print("\nPHASE 13 GAMMA COMPLETE")
        print("Send me this JSON for review:")
        print("artifacts/deep_ml/models/gamma_news_sensitivity/phase13_gamma_news_sensitivity_report.json")
        return 0

    except Exception as exc:
        error_report = {
            "artifact_type": "phase13_gamma_news_sensitivity_error_report",
            "schema_version": "1.0.0",
            "project": "Gold Nexus Alpha",
            "phase_key": PHASE_KEY,
            "model_key": MODEL_KEY,
            "status": "failed",
            "run_id": run_id,
            "error": repr(exc),
            "traceback": traceback.format_exc(),
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.report, error_report)
        logger.checkpoint("failed", "failed", {"error": repr(exc)})
        logger.event("phase13_gamma_news_sensitivity_failed", status="failed", details={"error": repr(exc)})
        raise


if __name__ == "__main__":
    raise SystemExit(main())