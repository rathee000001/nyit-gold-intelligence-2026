"""
Gold Nexus Alpha — Deep ML Phase 14
Omega Fusion

LOCKED SCRIPT NAME:
    deep_ml/scripts/14_omega_fusion.py

Purpose:
    Artifact-first fusion layer for the Deep ML extension.

    Omega reads accepted Alpha/Beta/Delta/Epsilon artifacts plus reviewed Gamma
    context artifacts. It creates a transparent weighted fusion candidate using
    validation-performance-based weights by horizon.

Important honesty rules:
    - Omega does not retrain Alpha/Beta/Delta/Epsilon.
    - Omega does not use Gamma/news as a hidden training input.
    - Omega uses Gamma as interpretive context only.
    - Omega weights are based on validation metrics, with test metrics reported
      for review.
    - Omega does not prove causality.
    - Omega does not replace the original professor-safe baseline Final Forecast
      page unless explicitly approved.

Run:
    py -m py_compile .\\deep_ml\\scripts\\14_omega_fusion.py
    py .\\deep_ml\\scripts\\14_omega_fusion.py --smoke
    py .\\deep_ml\\scripts\\14_omega_fusion.py

Review:
    artifacts/deep_ml/models/omega_fusion/phase14_omega_fusion_report.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
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


PHASE_KEY = "phase14_omega_fusion"
MODEL_KEY = "omega_fusion"
SCRIPT_VERSION = "omega_fusion_v2_validation_weighted_artifact_fusion_no_news_training"
TIMEZONE_LOCAL = "America/New_York"

HORIZONS = [1, 5, 10, 20, 30]

MODEL_SOURCES: Dict[str, Dict[str, str]] = {
    "alpha_structural": {
        "display_name": "Alpha Structural",
        "family": "xgboost_structural_expert",
        "evaluation": "artifacts/deep_ml/models/alpha_structural/evaluation_by_horizon.json",
        "rollforward": "artifacts/deep_ml/models/alpha_structural/evaluation_rollforward.csv",
        "forecast": "artifacts/deep_ml/models/alpha_structural/forecast_latest.json",
        "report": "artifacts/deep_ml/models/alpha_structural/phase6_alpha_structural_report.json",
    },
    "beta_temporal": {
        "display_name": "Beta Temporal",
        "family": "sequence_temporal_expert",
        "evaluation": "artifacts/deep_ml/models/beta_temporal/evaluation_by_horizon.json",
        "rollforward": "artifacts/deep_ml/models/beta_temporal/evaluation_rollforward.csv",
        "forecast": "artifacts/deep_ml/models/beta_temporal/forecast_latest.json",
        "report": "artifacts/deep_ml/models/beta_temporal/phase7_beta_temporal_report.json",
    },
    "delta_tft": {
        "display_name": "Delta TFT",
        "family": "temporal_fusion_quantile_expert",
        "evaluation": "artifacts/deep_ml/models/delta_tft/evaluation_by_horizon.json",
        "rollforward": "artifacts/deep_ml/models/delta_tft/evaluation_rollforward.csv",
        "forecast": "artifacts/deep_ml/models/delta_tft/forecast_latest.json",
        "report": "artifacts/deep_ml/models/delta_tft/phase8_delta_tft_report.json",
    },
    "epsilon_expert_ensemble": {
        "display_name": "Epsilon Ensemble",
        "family": "statistical_ml_benchmark_ensemble",
        "evaluation": "artifacts/deep_ml/models/epsilon_expert_ensemble/evaluation_by_horizon.json",
        "rollforward": "artifacts/deep_ml/models/epsilon_expert_ensemble/evaluation_rollforward.csv",
        "forecast": "artifacts/deep_ml/models/epsilon_expert_ensemble/forecast_latest.json",
        "report": "artifacts/deep_ml/models/epsilon_expert_ensemble/phase9_epsilon_expert_report.json",
    },
}


@dataclass
class Paths:
    repo_root: Path
    artifacts_root: Path
    public_root: Path
    model_dir: Path
    public_model_dir: Path

    gamma_report: Path
    gamma_tooltip_context: Path
    gamma_sensitivity: Path
    gamma_page_bundle: Path

    mode_status: Path
    matrix_manifest: Path

    report: Path
    run_summary: Path
    diagnostics: Path
    quality_review: Path
    model_ranking: Path
    omega_weights: Path
    omega_evaluation_by_horizon: Path
    omega_rollforward: Path
    omega_forecast_latest: Path
    omega_forecast_points_csv: Path
    page_bundle: Path
    timeline: Path
    checkpoint: Path


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


def clean_path(value: str) -> str:
    return str(value).replace("\\", "/").strip("/")


def rel_path(path: Path, root: Path) -> str:
    try:
        return clean_path(str(path.relative_to(root)))
    except Exception:
        return clean_path(str(path))


def resolve_artifact_path(repo_root: Path, rel: str) -> Path:
    rel_clean = clean_path(rel)
    direct = repo_root / rel_clean
    public = repo_root / "public" / rel_clean

    if direct.exists():
        return direct
    if public.exists():
        return public

    return direct


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


def safe_float(value: Any) -> Optional[float]:
    try:
        out = float(value)
        if pd.isna(out) or math.isinf(out):
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


def first_present(*values: Any) -> Any:
    for value in values:
        if value is None:
            continue
        try:
            if pd.isna(value):
                continue
        except Exception:
            pass
        text = str(value).strip()
        if text and text.lower() not in {"none", "nan", "null", "undefined"}:
            return value
    return None


def normalize_date(value: Any) -> Optional[str]:
    if value is None:
        return None
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        text = str(value).strip()
        return text[:10] if len(text) >= 10 else None
    return parsed.date().isoformat()


def build_paths(repo_root: Path) -> Paths:
    artifacts_root = repo_root / "artifacts" / "deep_ml"
    public_root = repo_root / "public" / "artifacts" / "deep_ml"
    model_dir = artifacts_root / "models" / MODEL_KEY

    return Paths(
        repo_root=repo_root,
        artifacts_root=artifacts_root,
        public_root=public_root,
        model_dir=model_dir,
        public_model_dir=public_root / "models" / MODEL_KEY,
        gamma_report=artifacts_root / "models" / "gamma_news_sensitivity" / "phase13_gamma_news_sensitivity_report.json",
        gamma_tooltip_context=artifacts_root / "models" / "gamma_news_sensitivity" / "gamma_tooltip_context.json",
        gamma_sensitivity=artifacts_root / "models" / "gamma_news_sensitivity" / "gamma_sensitivity_by_horizon.json",
        gamma_page_bundle=artifacts_root / "models" / "gamma_news_sensitivity" / "page_bundle.json",
        mode_status=artifacts_root / "governance" / "deep_ml_mode_status.json",
        matrix_manifest=artifacts_root / "features" / "deep_ml_numeric_feature_store_manifest.json",
        report=model_dir / "phase14_omega_fusion_report.json",
        run_summary=model_dir / "run_summary.json",
        diagnostics=model_dir / "diagnostics_latest.json",
        quality_review=model_dir / "quality_review.json",
        model_ranking=model_dir / "omega_model_ranking.json",
        omega_weights=model_dir / "omega_weights_by_horizon.json",
        omega_evaluation_by_horizon=model_dir / "omega_evaluation_by_horizon.json",
        omega_rollforward=model_dir / "omega_rollforward.csv",
        omega_forecast_latest=model_dir / "omega_forecast_latest.json",
        omega_forecast_points_csv=model_dir / "omega_forecast_points.csv",
        page_bundle=model_dir / "page_bundle.json",
        timeline=model_dir / "timeline.json",
        checkpoint=model_dir / "progress_checkpoint.json",
    )


class Logger:
    def __init__(self, paths: Paths) -> None:
        self.paths = paths
        self.events: List[Dict[str, Any]] = []
        self.started = utc_now()

    def event(self, event: str, status: str = "ok", details: Optional[Dict[str, Any]] = None) -> None:
        row = {
            "timestamp_utc": iso_utc(),
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
    parser = argparse.ArgumentParser(description="Build Omega fusion artifacts.")
    parser.add_argument("--repo-root", type=str, default=None)
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument("--no-public-copy", action="store_true")
    parser.add_argument("--weight-power", type=float, default=1.0)
    parser.add_argument("--min-weight", type=float, default=0.03)
    return parser.parse_args()


def extract_split_metric(evaluation: Dict[str, Any], split: str, horizon: int) -> Dict[str, Any]:
    horizon_key = str(horizon)

    if "metrics_by_horizon" in evaluation:
        row = evaluation.get("metrics_by_horizon", {}).get(horizon_key, {}).get(split, {})
        if isinstance(row, dict) and row:
            return row

    row = evaluation.get(split, {}).get(horizon_key, {})
    if isinstance(row, dict) and row:
        return row

    return {}


def metric_value(row: Dict[str, Any], *names: str) -> Optional[float]:
    for name in names:
        value = row.get(name)
        numeric = safe_float(value)
        if numeric is not None:
            return numeric
    return None


def normalize_metric_row(row: Dict[str, Any]) -> Dict[str, Optional[float]]:
    return {
        "count": safe_float(row.get("n", row.get("count"))),
        "mae": metric_value(row, "mae", "MAE"),
        "rmse": metric_value(row, "rmse", "RMSE"),
        "mape_pct": metric_value(row, "mape_pct", "mape", "MAPE"),
        "smape_pct": metric_value(row, "smape_pct", "smape", "SMAPE"),
        "bias_mean_error": metric_value(row, "bias_mean_error", "mean_error_bias"),
        "directional_accuracy_pct": metric_value(row, "directional_accuracy_pct", "directional_accuracy"),
    }


def read_model_report_snapshot(repo_root: Path, model_key: str) -> Dict[str, Any]:
    source = MODEL_SOURCES[model_key]
    report = read_json(resolve_artifact_path(repo_root, source["report"]), default={}) or {}

    run_summary = report.get("run_summary") or {}
    model_payload = run_summary.get("model") or {}
    features = run_summary.get("features") or {}

    return {
        "model_key": model_key,
        "display_name": source["display_name"],
        "family": source["family"],
        "report_path": source["report"],
        "status": report.get("status"),
        "algorithm": report.get("algorithm") or model_payload.get("backend") or source["family"],
        "model_version": report.get("model_version") or report.get("delta_version") or run_summary.get("delta_version"),
        "target_strategy": report.get("target_strategy") or model_payload.get("target"),
        "effective_data_through_date": report.get("effective_data_through_date") or (run_summary.get("data_signature") or {}).get("effective_data_through_date"),
        "forecast_start_date": report.get("forecast_start_date") or (run_summary.get("data_signature") or {}).get("forecast_start_date"),
        "training_window": model_payload.get("training_window"),
        "used_feature_count": features.get("used_count") or report.get("selected_feature_count"),
        "professor_safe_summary": report.get("professor_safe_summary") or run_summary.get("professor_safe_summary"),
    }


def validate_inputs(paths: Paths) -> Tuple[List[str], List[str], Dict[str, Any]]:
    blocking: List[str] = []
    warnings: List[str] = []
    inventory: Dict[str, Any] = {}

    gamma_report_path = paths.gamma_report if paths.gamma_report.exists() else paths.public_root / "models" / "gamma_news_sensitivity" / "phase13_gamma_news_sensitivity_report.json"
    gamma_tooltip_path = paths.gamma_tooltip_context if paths.gamma_tooltip_context.exists() else paths.public_root / "models" / "gamma_news_sensitivity" / "gamma_tooltip_context.json"
    gamma_sensitivity_path = paths.gamma_sensitivity if paths.gamma_sensitivity.exists() else paths.public_root / "models" / "gamma_news_sensitivity" / "gamma_sensitivity_by_horizon.json"

    gamma_report = read_json(gamma_report_path, default={}) or {}
    gamma_quality = gamma_report.get("quality_review") or {}

    if not gamma_report_path.exists():
        blocking.append("missing_gamma_phase13_report")
    if not gamma_tooltip_path.exists():
        blocking.append("missing_gamma_tooltip_context")
    if not gamma_sensitivity_path.exists():
        warnings.append("missing_gamma_sensitivity_by_horizon_context")
    if gamma_report and gamma_report.get("status") not in {"ready", "ready_with_warnings"}:
        warnings.append(f"gamma_status_is_{gamma_report.get('status')}")
    if gamma_quality.get("blocking_flags"):
        blocking.extend([f"gamma_{flag}" for flag in gamma_quality.get("blocking_flags", [])])

    inventory["gamma"] = {
        "report_path": rel_path(gamma_report_path, paths.repo_root),
        "tooltip_path": rel_path(gamma_tooltip_path, paths.repo_root),
        "sensitivity_path": rel_path(gamma_sensitivity_path, paths.repo_root),
        "status": gamma_report.get("status"),
        "quality_status": gamma_quality.get("status"),
        "used_as": "interpretive_context_only_not_training_input",
    }

    for model_key, source in MODEL_SOURCES.items():
        model_inventory: Dict[str, Any] = {
            "display_name": source["display_name"],
            "family": source["family"],
            "files": {},
        }

        for file_key in ["evaluation", "rollforward", "forecast", "report"]:
            p = resolve_artifact_path(paths.repo_root, source[file_key])
            exists = p.exists()
            if not exists:
                blocking.append(f"missing_{model_key}_{file_key}")
            model_inventory["files"][file_key] = {
                "path": source[file_key],
                "exists": exists,
                "size_bytes": p.stat().st_size if exists else None,
                "hash": stable_hash_file(p) if exists else "missing",
            }

        inventory[model_key] = model_inventory

    return blocking, warnings, inventory


def build_model_ranking(
    repo_root: Path,
    horizons: List[int],
    weight_power: float,
    min_weight: float,
) -> Dict[str, Any]:
    ranking_rows: List[Dict[str, Any]] = []
    weights_by_horizon: Dict[str, Dict[str, float]] = {}
    weight_details_by_horizon: Dict[str, Any] = {}

    for horizon in horizons:
        raw_rows: List[Dict[str, Any]] = []

        for model_key, source in MODEL_SOURCES.items():
            evaluation = read_json(resolve_artifact_path(repo_root, source["evaluation"]), default={}) or {}

            validation = normalize_metric_row(extract_split_metric(evaluation, "validation", horizon))
            test = normalize_metric_row(extract_split_metric(evaluation, "test", horizon))
            train = normalize_metric_row(extract_split_metric(evaluation, "train", horizon))

            score_basis = "validation_mape_pct"
            score = validation.get("mape_pct")

            if score is None:
                score_basis = "validation_mae"
                score = validation.get("mae")

            if score is None:
                score_basis = "test_mape_pct_fallback"
                score = test.get("mape_pct")

            if score is None:
                score_basis = "test_mae_fallback"
                score = test.get("mae")

            if score is None:
                continue

            score_float = max(float(score), 0.0001)
            raw_weight = 1.0 / (score_float ** weight_power)

            raw_rows.append(
                {
                    "model_key": model_key,
                    "display_name": source["display_name"],
                    "family": source["family"],
                    "horizon": horizon,
                    "score_basis": score_basis,
                    "weight_basis_score": score_float,
                    "raw_weight": raw_weight,
                    "train": train,
                    "validation": validation,
                    "test": test,
                }
            )

        raw_rows = sorted(raw_rows, key=lambda row: row["weight_basis_score"])
        raw_sum = sum(row["raw_weight"] for row in raw_rows)

        normalized_rows: List[Dict[str, Any]] = []
        if raw_sum <= 0:
            equal = 1.0 / len(raw_rows) if raw_rows else 0.0
            for row in raw_rows:
                row["omega_weight_before_floor"] = equal
        else:
            for row in raw_rows:
                row["omega_weight_before_floor"] = row["raw_weight"] / raw_sum

        if raw_rows and min_weight > 0:
            # Floor avoids making any accepted expert invisible, then renormalizes.
            floored = [max(float(row["omega_weight_before_floor"]), min_weight) for row in raw_rows]
            floored_sum = sum(floored)
            for row, floored_weight in zip(raw_rows, floored):
                row["omega_weight"] = floored_weight / floored_sum
        else:
            for row in raw_rows:
                row["omega_weight"] = row.get("omega_weight_before_floor", 0.0)

        horizon_weights: Dict[str, float] = {}
        for rank, row in enumerate(raw_rows, start=1):
            output_row = {
                "rank": rank,
                "model_key": row["model_key"],
                "display_name": row["display_name"],
                "family": row["family"],
                "horizon": row["horizon"],
                "score_basis": row["score_basis"],
                "weight_basis_score": row["weight_basis_score"],
                "omega_weight_before_floor": row["omega_weight_before_floor"],
                "omega_weight": row["omega_weight"],
                "train_mape_pct": row["train"].get("mape_pct"),
                "validation_mape_pct": row["validation"].get("mape_pct"),
                "test_mape_pct": row["test"].get("mape_pct"),
                "validation_mae": row["validation"].get("mae"),
                "test_mae": row["test"].get("mae"),
                "validation_directional_accuracy_pct": row["validation"].get("directional_accuracy_pct"),
                "test_directional_accuracy_pct": row["test"].get("directional_accuracy_pct"),
            }
            normalized_rows.append(output_row)
            ranking_rows.append(output_row)
            horizon_weights[row["model_key"]] = float(row["omega_weight"])

        weights_by_horizon[str(horizon)] = horizon_weights
        weight_details_by_horizon[str(horizon)] = {
            "horizon": horizon,
            "weight_basis": "inverse_validation_mape_by_horizon_fallback_validation_mae_then_test_metric",
            "weight_power": weight_power,
            "min_weight_floor_before_renormalization": min_weight,
            "weights": horizon_weights,
            "ranked_models": normalized_rows,
        }

    return {
        "artifact_type": "omega_model_ranking",
        "schema_version": "1.0.0",
        "phase_key": PHASE_KEY,
        "model_key": MODEL_KEY,
        "ranking_basis": "validation_metric_weighted_fusion_by_horizon",
        "weight_policy": {
            "primary": "inverse validation MAPE by horizon",
            "fallback_order": [
                "validation MAPE",
                "validation MAE",
                "test MAPE",
                "test MAE",
            ],
            "news_sensitivity_used_for_weights": False,
            "gamma_usage": "interpretive_context_only",
            "min_weight_floor_before_renormalization": min_weight,
            "weight_power": weight_power,
        },
        "ranking": ranking_rows,
        "weights_by_horizon": weights_by_horizon,
        "weight_details_by_horizon": weight_details_by_horizon,
        "professor_safe_note": "Omega weights are validation-performance fusion weights. They are not causal factor importance scores.",
        "generated_at_utc": iso_utc(),
    }


def normalize_rollforward(model_key: str, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    meta: Dict[str, Any] = {
        "model_key": model_key,
        "input_rows": int(len(df)),
        "output_rows": 0,
        "status": "not_started",
        "gold_price_source_column": None,
        "missing_required_columns": [],
    }

    required = ["date", "split", "horizon", "actual_target", "prediction"]
    missing = [col for col in required if col not in df.columns]
    if missing:
        meta["status"] = "missing_required_columns"
        meta["missing_required_columns"] = missing
        return pd.DataFrame(), meta

    out = pd.DataFrame()
    out["date"] = df["date"].map(normalize_date)
    out["split"] = df["split"].astype(str)
    out["horizon"] = pd.to_numeric(df["horizon"], errors="coerce")
    out["source_model_key"] = model_key
    out["source_model_name"] = MODEL_SOURCES[model_key]["display_name"]

    gold_col = None
    for candidate in ["gold_price", "raw_origin_gold_price", "raw_gold_price_anchor", "origin_gold_price"]:
        if candidate in df.columns:
            gold_col = candidate
            out["gold_price"] = pd.to_numeric(df[candidate], errors="coerce")
            break

    if gold_col is None:
        out["gold_price"] = pd.NA

    meta["gold_price_source_column"] = gold_col

    out["actual_target"] = pd.to_numeric(df["actual_target"], errors="coerce")
    out["prediction"] = pd.to_numeric(df["prediction"], errors="coerce")

    if "naive_prediction" in df.columns:
        out["naive_prediction"] = pd.to_numeric(df["naive_prediction"], errors="coerce")
    else:
        out["naive_prediction"] = out["gold_price"]

    if "error" in df.columns:
        out["source_error"] = pd.to_numeric(df["error"], errors="coerce")
    else:
        out["source_error"] = out["prediction"] - out["actual_target"]

    for out_col, candidates in {
        "p10": ["p10", "forecast_price_p10", "calibrated_forecast_price_p10"],
        "p50": ["p50", "forecast_price_p50", "calibrated_forecast_price_p50", "prediction"],
        "p90": ["p90", "forecast_price_p90", "calibrated_forecast_price_p90"],
    }.items():
        selected = None
        for candidate in candidates:
            if candidate in df.columns:
                selected = candidate
                out[out_col] = pd.to_numeric(df[candidate], errors="coerce")
                break
        if selected is None:
            out[out_col] = out["prediction"] if out_col == "p50" else pd.NA
        meta[f"{out_col}_source_column"] = selected

    if "interval_width_price" in df.columns:
        out["interval_width_price"] = pd.to_numeric(df["interval_width_price"], errors="coerce")
    else:
        out["interval_width_price"] = out["p90"] - out["p10"]

    out = out.dropna(subset=["date", "horizon", "prediction"]).copy()
    out["horizon"] = out["horizon"].astype(int)
    out = out[out["horizon"].isin(HORIZONS)].copy()

    meta["output_rows"] = int(len(out))
    meta["status"] = "ready" if len(out) else "no_usable_rows"
    meta["split_counts"] = {str(k): int(v) for k, v in out.groupby("split").size().to_dict().items()} if len(out) else {}
    meta["horizon_counts"] = {str(int(k)): int(v) for k, v in out.groupby("horizon").size().to_dict().items()} if len(out) else {}

    return out.reset_index(drop=True), meta


def load_rollforward(repo_root: Path, model_key: str, smoke: bool) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    rel = MODEL_SOURCES[model_key]["rollforward"]
    path = resolve_artifact_path(repo_root, rel)

    if not path.exists():
        return pd.DataFrame(), {
            "model_key": model_key,
            "path": rel,
            "exists": False,
            "status": "missing_file",
        }

    df = pd.read_csv(path, low_memory=False)

    if smoke:
        # Keep all splits/horizons represented in smoke mode.
        if {"split", "horizon"}.issubset(df.columns):
            df = df.groupby(["split", "horizon"], group_keys=False).head(80).reset_index(drop=True)
        else:
            df = df.head(2000)

    normalized, meta = normalize_rollforward(model_key, df)
    meta["path"] = rel
    meta["exists"] = True
    meta["file_hash"] = stable_hash_file(path)

    return normalized, meta


def normalized_weights_for_group(weights: Dict[str, float], models: List[str]) -> Dict[str, float]:
    present = {model: float(weights.get(model, 0.0)) for model in models}
    total = sum(present.values())

    if total <= 0 and models:
        equal = 1.0 / len(models)
        return {model: equal for model in models}

    if total <= 0:
        return {}

    return {model: value / total for model, value in present.items()}


def first_non_null(series: pd.Series) -> Any:
    valid = series.dropna()
    if valid.empty:
        return None
    return valid.iloc[0]


def weighted_sum(values: pd.Series, weights: pd.Series) -> Optional[float]:
    mask = values.notna() & weights.notna()
    if not mask.any():
        return None

    w = weights[mask].astype(float)
    if w.sum() <= 0:
        w = pd.Series([1.0 / len(w)] * len(w), index=w.index)
    else:
        w = w / w.sum()

    return float((values[mask].astype(float) * w).sum())


def build_omega_rollforward(
    repo_root: Path,
    weights_by_horizon: Dict[str, Dict[str, float]],
    smoke: bool,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    frames: List[pd.DataFrame] = []
    load_meta: Dict[str, Any] = {}

    for model_key in MODEL_SOURCES:
        frame, meta = load_rollforward(repo_root, model_key, smoke=smoke)
        load_meta[model_key] = meta
        if not frame.empty:
            frames.append(frame)

    if not frames:
        return pd.DataFrame(), load_meta

    all_rows = pd.concat(frames, ignore_index=True)
    all_rows["date"] = all_rows["date"].astype(str)
    all_rows["split"] = all_rows["split"].astype(str)
    all_rows["horizon"] = pd.to_numeric(all_rows["horizon"], errors="coerce").astype(int)

    output_rows: List[Dict[str, Any]] = []

    group_cols = ["date", "split", "horizon"]
    for (date, split, horizon), group in all_rows.groupby(group_cols, dropna=True):
        hkey = str(int(horizon))
        source_models = group["source_model_key"].astype(str).tolist()
        unique_models = list(dict.fromkeys(source_models))
        local_weights = normalized_weights_for_group(weights_by_horizon.get(hkey, {}), unique_models)

        group = group.copy()
        group["omega_component_weight"] = group["source_model_key"].map(lambda m: local_weights.get(str(m), 0.0)).astype(float)

        omega_prediction = weighted_sum(group["prediction"], group["omega_component_weight"])
        omega_p10_weighted = weighted_sum(group["p10"], group["omega_component_weight"])
        omega_p50_weighted = weighted_sum(group["p50"], group["omega_component_weight"])
        omega_p90_weighted = weighted_sum(group["p90"], group["omega_component_weight"])

        actual = safe_float(first_non_null(group["actual_target"]))
        naive = safe_float(first_non_null(group["naive_prediction"]))
        gold = safe_float(first_non_null(group["gold_price"]))

        if omega_prediction is None:
            continue

        error = omega_prediction - actual if actual is not None else None
        abs_error = abs(error) if error is not None else None
        ape_pct = abs_error / abs(actual) * 100.0 if abs_error is not None and actual not in {None, 0} else None

        component_audit = []
        for _, row in group.iterrows():
            component_audit.append(
                {
                    "model_key": row["source_model_key"],
                    "weight": safe_float(row["omega_component_weight"]),
                    "prediction": safe_float(row["prediction"]),
                    "p10": safe_float(row["p10"]),
                    "p50": safe_float(row["p50"]),
                    "p90": safe_float(row["p90"]),
                }
            )

        output_rows.append(
            {
                "date": date,
                "split": split,
                "horizon": int(horizon),
                "gold_price": gold,
                "actual_target": actual,
                "prediction": omega_prediction,
                "omega_p10_weighted": omega_p10_weighted,
                "omega_p50_weighted": omega_p50_weighted,
                "omega_p90_weighted": omega_p90_weighted,
                "omega_p10_component_min": safe_float(group["p10"].min(skipna=True)),
                "omega_p90_component_max": safe_float(group["p90"].max(skipna=True)),
                "naive_prediction": naive,
                "error": error,
                "abs_error": abs_error,
                "ape_pct": ape_pct,
                "model_count": int(len(group)),
                "component_models": ",".join(unique_models),
                "component_weights_json": json.dumps(local_weights, sort_keys=True),
                "component_audit_json": json.dumps(component_audit, sort_keys=True),
            }
        )

    omega = pd.DataFrame(output_rows)
    if omega.empty:
        return omega, load_meta

    omega = omega.sort_values(["date", "horizon", "split"]).reset_index(drop=True)
    return omega, load_meta


def metric_summary(df: pd.DataFrame) -> Dict[str, Any]:
    y = pd.to_numeric(df["actual_target"], errors="coerce")
    pred = pd.to_numeric(df["prediction"], errors="coerce")
    mask = y.notna() & pred.notna()

    if not mask.any():
        return {
            "count": 0,
            "mae": None,
            "rmse": None,
            "mape_pct": None,
            "smape_pct": None,
            "bias_mean_error": None,
            "directional_accuracy_pct": None,
        }

    yv = y[mask].astype(float)
    pv = pred[mask].astype(float)
    err = pv - yv

    denom_mape = yv.abs()
    mape_mask = denom_mape > 0
    mape = (err.abs()[mape_mask] / denom_mape[mape_mask] * 100.0) if mape_mask.any() else pd.Series(dtype=float)

    denom_smape = yv.abs() + pv.abs()
    smape_mask = denom_smape > 0
    smape = (2.0 * err.abs()[smape_mask] / denom_smape[smape_mask] * 100.0) if smape_mask.any() else pd.Series(dtype=float)

    directional_accuracy = None
    if "gold_price" in df.columns:
        gold = pd.to_numeric(df.loc[mask, "gold_price"], errors="coerce")
        dmask = gold.notna()
        if dmask.any():
            actual_direction = (yv[dmask] - gold[dmask]).apply(lambda x: 1 if x > 0 else (-1 if x < 0 else 0))
            pred_direction = (pv[dmask] - gold[dmask]).apply(lambda x: 1 if x > 0 else (-1 if x < 0 else 0))
            valid_direction = actual_direction != 0
            if valid_direction.any():
                directional_accuracy = float((actual_direction[valid_direction] == pred_direction[valid_direction]).mean() * 100.0)

    return {
        "count": int(mask.sum()),
        "mae": float(err.abs().mean()),
        "rmse": float(math.sqrt((err ** 2).mean())),
        "mape_pct": float(mape.mean()) if len(mape) else None,
        "smape_pct": float(smape.mean()) if len(smape) else None,
        "bias_mean_error": float(err.mean()),
        "directional_accuracy_pct": directional_accuracy,
    }


def naive_metric_summary(df: pd.DataFrame) -> Dict[str, Any]:
    if "naive_prediction" not in df.columns:
        return {}

    temp = df.copy()
    temp["prediction"] = temp["naive_prediction"]
    return metric_summary(temp)


def improvement_vs_naive(model_metrics: Dict[str, Any], naive_metrics: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}

    for key in ["mae", "rmse", "mape_pct", "smape_pct"]:
        model_value = safe_float(model_metrics.get(key))
        naive_value = safe_float(naive_metrics.get(key))

        if model_value is None or naive_value is None or naive_value == 0:
            out[f"{key}_improvement_pct_vs_naive"] = None
        else:
            out[f"{key}_improvement_pct_vs_naive"] = (naive_value - model_value) / naive_value * 100.0

    return out


def build_omega_evaluation(omega: pd.DataFrame) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "artifact_type": "omega_evaluation_by_horizon",
        "schema_version": "1.0.0",
        "phase_key": PHASE_KEY,
        "model_key": MODEL_KEY,
        "point_forecast": "validation_weighted_component_prediction",
        "status": "ready" if not omega.empty else "no_omega_rows",
        "metrics_by_horizon": {},
        "naive_baseline_by_horizon": {},
        "improvement_vs_naive_by_horizon": {},
        "professor_safe_note": "Omega evaluation is computed from fused artifact predictions. It is not retraining and does not use news as a training input.",
        "generated_at_utc": iso_utc(),
    }

    if omega.empty:
        return payload

    for horizon, hdf in omega.groupby("horizon"):
        hkey = str(int(horizon))
        payload["metrics_by_horizon"][hkey] = {}
        payload["naive_baseline_by_horizon"][hkey] = {}
        payload["improvement_vs_naive_by_horizon"][hkey] = {}

        for split, sdf in hdf.groupby("split"):
            model_metrics = metric_summary(sdf)
            naive_metrics = naive_metric_summary(sdf)
            payload["metrics_by_horizon"][hkey][str(split)] = model_metrics
            payload["naive_baseline_by_horizon"][hkey][str(split)] = naive_metrics
            payload["improvement_vs_naive_by_horizon"][hkey][str(split)] = improvement_vs_naive(model_metrics, naive_metrics)

    return payload


def extract_forecast_points(forecast: Dict[str, Any], model_key: str) -> List[Dict[str, Any]]:
    source_points = forecast.get("forecast_points")
    if not isinstance(source_points, list):
        source_points = forecast.get("path")
    if not isinstance(source_points, list):
        source_points = []

    out: List[Dict[str, Any]] = []

    for point in source_points:
        if not isinstance(point, dict):
            continue

        horizon = safe_int(first_present(point.get("horizon"), point.get("horizon_trading_days")))
        if horizon is None:
            continue

        p10 = safe_float(first_present(point.get("p10"), point.get("forecast_price_p10"), point.get("calibrated_forecast_price_p10")))
        p50 = safe_float(first_present(point.get("p50"), point.get("forecast_price_p50"), point.get("calibrated_forecast_price_p50")))
        p90 = safe_float(first_present(point.get("p90"), point.get("forecast_price_p90"), point.get("calibrated_forecast_price_p90")))

        origin_gold = safe_float(first_present(point.get("origin_gold_price"), point.get("raw_gold_price_anchor")))
        forecast_date = first_present(point.get("forecast_date"), point.get("forecast_date_business_day_approx"))
        origin_date = first_present(point.get("origin_date"), (forecast.get("latest_origin") or {}).get("origin_date"))

        if p50 is None:
            continue

        out.append(
            {
                "model_key": model_key,
                "display_name": MODEL_SOURCES[model_key]["display_name"],
                "horizon": int(horizon),
                "origin_date": origin_date,
                "forecast_date": forecast_date,
                "origin_gold_price": origin_gold,
                "p10": p10,
                "p50": p50,
                "p90": p90,
                "expected_change": p50 - origin_gold if p50 is not None and origin_gold is not None else None,
                "expected_change_pct": (p50 - origin_gold) / origin_gold * 100.0 if p50 is not None and origin_gold not in {None, 0} else None,
            }
        )

    return out


def weighted_forecast_value(points: List[Dict[str, Any]], key: str, weights: Dict[str, float]) -> Optional[float]:
    valid = [p for p in points if safe_float(p.get(key)) is not None]
    if not valid:
        return None

    local_weights = normalized_weights_for_group(weights, [p["model_key"] for p in valid])
    return sum(float(p[key]) * local_weights.get(p["model_key"], 0.0) for p in valid)


def build_omega_forecast_latest(
    repo_root: Path,
    weights_by_horizon: Dict[str, Dict[str, float]],
) -> Tuple[Dict[str, Any], pd.DataFrame]:
    all_points: List[Dict[str, Any]] = []

    for model_key, source in MODEL_SOURCES.items():
        forecast = read_json(resolve_artifact_path(repo_root, source["forecast"]), default={}) or {}
        all_points.extend(extract_forecast_points(forecast, model_key))

    rows: List[Dict[str, Any]] = []

    for horizon in HORIZONS:
        points = [p for p in all_points if int(p["horizon"]) == int(horizon)]
        if not points:
            continue

        hkey = str(int(horizon))
        weights = weights_by_horizon.get(hkey, {})
        valid_p50 = [p for p in points if p.get("p50") is not None]
        local_weights = normalized_weights_for_group(weights, [p["model_key"] for p in valid_p50])

        p10_weighted = weighted_forecast_value(points, "p10", weights)
        p50_weighted = weighted_forecast_value(points, "p50", weights)
        p90_weighted = weighted_forecast_value(points, "p90", weights)

        p10_values = [p["p10"] for p in points if p.get("p10") is not None]
        p90_values = [p["p90"] for p in points if p.get("p90") is not None]

        origin_gold = first_present(*[p.get("origin_gold_price") for p in points])
        forecast_date = first_present(*[p.get("forecast_date") for p in points])
        origin_date = first_present(*[p.get("origin_date") for p in points])

        rows.append(
            {
                "horizon": int(horizon),
                "origin_date": origin_date,
                "forecast_date": forecast_date,
                "origin_gold_price": origin_gold,
                "omega_p10_weighted": p10_weighted,
                "omega_p50_weighted": p50_weighted,
                "omega_p90_weighted": p90_weighted,
                "omega_p10_component_min": min(p10_values) if p10_values else None,
                "omega_p90_component_max": max(p90_values) if p90_values else None,
                "expected_change": p50_weighted - float(origin_gold) if p50_weighted is not None and origin_gold not in {None, 0} else None,
                "expected_change_pct": (p50_weighted - float(origin_gold)) / float(origin_gold) * 100.0 if p50_weighted is not None and origin_gold not in {None, 0} else None,
                "component_count": len(valid_p50),
                "component_models": [p["model_key"] for p in valid_p50],
                "component_weights": local_weights,
                "component_points": valid_p50,
            }
        )

    forecast_latest = {
        "artifact_type": "omega_forecast_latest",
        "schema_version": "1.0.0",
        "phase_key": PHASE_KEY,
        "model_key": MODEL_KEY,
        "model_name": "Omega Fusion",
        "frequency": "trading_day",
        "forecast_method": "validation_weighted_component_p50_with_weighted_interval_context",
        "gamma_usage": "interpretive_context_only_not_training_input",
        "path": rows,
        "professor_safe_note": "Omega is an artifact-level fusion candidate. It is not a guarantee and it does not use news as a hidden training input.",
        "generated_at_utc": iso_utc(),
    }

    csv_rows = []
    for row in rows:
        csv_rows.append(
            {
                "horizon": row.get("horizon"),
                "origin_date": row.get("origin_date"),
                "forecast_date": row.get("forecast_date"),
                "origin_gold_price": row.get("origin_gold_price"),
                "omega_p10_weighted": row.get("omega_p10_weighted"),
                "omega_p50_weighted": row.get("omega_p50_weighted"),
                "omega_p90_weighted": row.get("omega_p90_weighted"),
                "omega_p10_component_min": row.get("omega_p10_component_min"),
                "omega_p90_component_max": row.get("omega_p90_component_max"),
                "expected_change": row.get("expected_change"),
                "expected_change_pct": row.get("expected_change_pct"),
                "component_count": row.get("component_count"),
                "component_models": ",".join(row.get("component_models") or []),
                "component_weights_json": json.dumps(row.get("component_weights") or {}, sort_keys=True),
            }
        )

    return forecast_latest, pd.DataFrame(csv_rows)


def copy_public_outputs(paths: Paths) -> None:
    paths.public_model_dir.mkdir(parents=True, exist_ok=True)

    outputs = [
        paths.report,
        paths.run_summary,
        paths.diagnostics,
        paths.quality_review,
        paths.model_ranking,
        paths.omega_weights,
        paths.omega_evaluation_by_horizon,
        paths.omega_rollforward,
        paths.omega_forecast_latest,
        paths.omega_forecast_points_csv,
        paths.page_bundle,
        paths.timeline,
        paths.checkpoint,
    ]

    for src in outputs:
        if src.exists():
            shutil.copy2(src, paths.public_model_dir / src.name)


def write_blocked_report(paths: Paths, logger: Logger, run_id: str, blocking: List[str], warnings: List[str]) -> int:
    quality = {
        "artifact_type": "deep_ml_quality_review",
        "schema_version": "1.0.0",
        "phase_key": PHASE_KEY,
        "model_key": MODEL_KEY,
        "status": "blocked_waiting_for_inputs",
        "blocking_flags": blocking,
        "warnings": warnings,
        "acceptance_gate": {
            "all_required_model_reports_exist": False,
            "gamma_reviewed": False,
            "news_used_as_training_input": False,
        },
        "professor_safe_summary": "Omega is blocked until required model and Gamma artifacts exist.",
        "generated_at_utc": iso_utc(),
    }

    write_json(paths.quality_review, quality)

    report = {
        "artifact_type": "phase14_omega_fusion_report",
        "schema_version": "1.0.0",
        "project": "Gold Nexus Alpha",
        "phase": "Phase 14 - Omega Fusion",
        "phase_key": PHASE_KEY,
        "model_key": MODEL_KEY,
        "status": quality["status"],
        "run_id": run_id,
        "quality_review": quality,
        "final_instruction": "Fix missing inputs, then rerun Omega.",
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
        logger.event("phase14_omega_fusion_started", details={"run_id": run_id, "smoke": args.smoke})
        logger.checkpoint("started", "running", {"run_id": run_id, "smoke": args.smoke})

        blocking, warnings, input_inventory = validate_inputs(paths)

        if blocking:
            return write_blocked_report(paths, logger, run_id, blocking, warnings)

        logger.event("building_validation_weighted_model_ranking")
        ranking = build_model_ranking(
            repo_root=repo_root,
            horizons=HORIZONS,
            weight_power=args.weight_power,
            min_weight=args.min_weight,
        )
        write_json(paths.model_ranking, ranking)
        write_json(
            paths.omega_weights,
            {
                "artifact_type": "omega_weights_by_horizon",
                "schema_version": "1.0.0",
                "phase_key": PHASE_KEY,
                "model_key": MODEL_KEY,
                "weights_by_horizon": ranking.get("weights_by_horizon", {}),
                "weight_details_by_horizon": ranking.get("weight_details_by_horizon", {}),
                "news_sensitivity_used_for_weights": False,
                "gamma_usage": "interpretive_context_only",
                "generated_at_utc": iso_utc(),
            },
        )

        logger.event("building_omega_rollforward")
        omega_rollforward, rollforward_meta = build_omega_rollforward(
            repo_root=repo_root,
            weights_by_horizon=ranking.get("weights_by_horizon", {}),
            smoke=bool(args.smoke),
        )

        if omega_rollforward.empty:
            blocking = ["omega_rollforward_empty_after_fusion"]
            return write_blocked_report(paths, logger, run_id, blocking, warnings)

        omega_rollforward.to_csv(paths.omega_rollforward, index=False)
        logger.event("omega_rollforward_ready", details={"rows": int(len(omega_rollforward))})

        logger.event("building_omega_evaluation")
        omega_evaluation = build_omega_evaluation(omega_rollforward)
        write_json(paths.omega_evaluation_by_horizon, omega_evaluation)

        logger.event("building_omega_latest_forecast")
        omega_forecast_latest, omega_forecast_points = build_omega_forecast_latest(
            repo_root=repo_root,
            weights_by_horizon=ranking.get("weights_by_horizon", {}),
        )
        write_json(paths.omega_forecast_latest, omega_forecast_latest)
        omega_forecast_points.to_csv(paths.omega_forecast_points_csv, index=False)

        gamma_report = read_json(resolve_artifact_path(repo_root, "artifacts/deep_ml/models/gamma_news_sensitivity/phase13_gamma_news_sensitivity_report.json"), default={}) or {}
        gamma_page_bundle = read_json(resolve_artifact_path(repo_root, "artifacts/deep_ml/models/gamma_news_sensitivity/page_bundle.json"), default={}) or {}
        mode_status = read_json(resolve_artifact_path(repo_root, "artifacts/deep_ml/governance/deep_ml_mode_status.json"), default={}) or {}
        matrix_manifest = read_json(resolve_artifact_path(repo_root, "artifacts/deep_ml/features/deep_ml_numeric_feature_store_manifest.json"), default={}) or {}

        report_snapshots = {
            model_key: read_model_report_snapshot(repo_root, model_key)
            for model_key in MODEL_SOURCES
        }

        status = "smoke_ready_review" if args.smoke else "ready"
        if warnings:
            status = "smoke_ready_with_warnings" if args.smoke else "ready_with_warnings"

        quality = {
            "artifact_type": "deep_ml_quality_review",
            "schema_version": "1.0.0",
            "phase_key": PHASE_KEY,
            "model_key": MODEL_KEY,
            "status": status,
            "blocking_flags": [],
            "warnings": warnings,
            "acceptance_gate": {
                "all_required_model_reports_exist": True,
                "all_required_rollforward_files_exist": True,
                "all_required_forecast_files_exist": True,
                "gamma_report_exists": True,
                "gamma_used_as_context_only": True,
                "news_used_as_training_input": False,
                "weights_use_validation_metrics": True,
                "test_metrics_reported_not_used_as_primary_weight_basis": True,
                "omega_rollforward_exists": paths.omega_rollforward.exists(),
                "omega_forecast_latest_exists": paths.omega_forecast_latest.exists(),
                "omega_evaluation_exists": paths.omega_evaluation_by_horizon.exists(),
            },
            "professor_safe_summary": "Omega fuses Alpha, Beta, Delta, and Epsilon using transparent validation-performance weights. Gamma remains interpretive context only.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.quality_review, quality)

        diagnostics = {
            "artifact_type": "omega_fusion_diagnostics_latest",
            "schema_version": "1.0.0",
            "phase_key": PHASE_KEY,
            "model_key": MODEL_KEY,
            "status": status,
            "smoke": bool(args.smoke),
            "omega_rollforward_rows": int(len(omega_rollforward)),
            "omega_forecast_points": int(len(omega_forecast_points)),
            "rollforward_meta": rollforward_meta,
            "output_hashes": {
                "omega_rollforward": stable_hash_file(paths.omega_rollforward),
                "omega_forecast_latest": stable_hash_file(paths.omega_forecast_latest),
                "omega_evaluation_by_horizon": stable_hash_file(paths.omega_evaluation_by_horizon),
                "omega_model_ranking": stable_hash_file(paths.model_ranking),
                "omega_weights_by_horizon": stable_hash_file(paths.omega_weights),
            },
            "professor_safe_note": "Diagnostics describe artifact creation and integrity. They are not claims of predictive guarantee.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.diagnostics, diagnostics)

        run_summary = {
            "artifact_type": "deep_ml_model_run",
            "schema_version": "1.0.0",
            "project": "Gold Nexus Alpha",
            "phase": "phase_2_deep_ml",
            "phase_key": PHASE_KEY,
            "model_key": MODEL_KEY,
            "model_name": "Omega Fusion",
            "family": "artifact_level_validation_weighted_fusion",
            "status": status,
            "run": {
                "run_id": run_id,
                "generated_at_utc": iso_utc(logger.started),
                "completed_at_utc": iso_utc(),
                "generated_at_local": local_iso(logger.started),
                "timezone_local": TIMEZONE_LOCAL,
                "git_commit_sha": get_git_commit(repo_root),
                "code_version": SCRIPT_VERSION,
                "python_version": sys.version,
                "platform": platform.platform(),
                "smoke": bool(args.smoke),
            },
            "fusion_policy": {
                "component_models": list(MODEL_SOURCES.keys()),
                "weights": "inverse validation metric by horizon with transparent fallback",
                "primary_weight_metric": "validation MAPE",
                "news_sensitivity_used_for_weights": False,
                "gamma_usage": "interpretive_context_only",
                "no_retraining": True,
            },
            "source_contract": {
                "model_sources": MODEL_SOURCES,
                "gamma_report": "artifacts/deep_ml/models/gamma_news_sensitivity/phase13_gamma_news_sensitivity_report.json",
                "gamma_tooltip_context": "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_tooltip_context.json",
            },
            "professor_safe_summary": "Omega is a transparent Deep ML fusion candidate. It combines finished expert outputs and reports its own rollforward evaluation and forecast path.",
        }
        write_json(paths.run_summary, run_summary)

        page_bundle = {
            "artifact_type": "omega_page_bundle",
            "schema_version": "1.0.0",
            "phase_key": PHASE_KEY,
            "model_key": MODEL_KEY,
            "page_title": "Omega Fusion",
            "status": status,
            "route": "/deep-ml/models/omega-fusion",
            "chart_artifacts": {
                "omega_rollforward": "artifacts/deep_ml/models/omega_fusion/omega_rollforward.csv",
                "omega_forecast_latest": "artifacts/deep_ml/models/omega_fusion/omega_forecast_latest.json",
                "omega_forecast_points": "artifacts/deep_ml/models/omega_fusion/omega_forecast_points.csv",
                "omega_evaluation_by_horizon": "artifacts/deep_ml/models/omega_fusion/omega_evaluation_by_horizon.json",
                "omega_model_ranking": "artifacts/deep_ml/models/omega_fusion/omega_model_ranking.json",
                "omega_weights_by_horizon": "artifacts/deep_ml/models/omega_fusion/omega_weights_by_horizon.json",
            },
            "frontend_policy": {
                "use_json_first": True,
                "hardcode_layout_only": True,
                "do_not_claim_winner_until_final_deep_ml_evaluation": True,
                "gamma_news_context": "display_context_only",
                "news_used_as_training_input": False,
            },
            "recommended_sections": [
                "Omega artifact summary",
                "Fusion weight policy",
                "Weights by horizon",
                "Omega actual vs forecast by train/validation/test",
                "Omega residuals",
                "Omega vs naive by horizon",
                "Latest Omega forecast path",
                "Component model contribution table",
                "Professor-safe interpretation rules",
                "Source files used by this page",
            ],
            "professor_safe_note": "Omega is a fusion candidate and should be evaluated before being presented as the final Deep ML answer.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.page_bundle, page_bundle)

        report = {
            "artifact_type": "phase14_omega_fusion_report",
            "schema_version": "1.0.0",
            "project": "Gold Nexus Alpha",
            "phase": "Phase 14 - Omega Fusion",
            "phase_key": PHASE_KEY,
            "model_key": MODEL_KEY,
            "model_name": "Omega Fusion",
            "status": status,
            "run_summary": run_summary,
            "quality_review": quality,
            "diagnostics_snapshot": diagnostics,
            "input_inventory": input_inventory,
            "component_model_report_snapshots": report_snapshots,
            "model_ranking_snapshot": ranking,
            "omega_evaluation_snapshot": omega_evaluation,
            "omega_forecast_latest_snapshot": omega_forecast_latest,
            "gamma_snapshot": {
                "status": gamma_report.get("status"),
                "quality_status": (gamma_report.get("quality_review") or {}).get("status"),
                "page_bundle": gamma_page_bundle,
                "usage_in_omega": "interpretive_context_only_not_weight_or_training_feature",
            },
            "governance_snapshot": {
                "mode_status": mode_status,
                "matrix_manifest": matrix_manifest,
            },
            "outputs": {
                "run_summary": rel_path(paths.run_summary, repo_root),
                "quality_review": rel_path(paths.quality_review, repo_root),
                "diagnostics": rel_path(paths.diagnostics, repo_root),
                "omega_model_ranking": rel_path(paths.model_ranking, repo_root),
                "omega_weights_by_horizon": rel_path(paths.omega_weights, repo_root),
                "omega_evaluation_by_horizon": rel_path(paths.omega_evaluation_by_horizon, repo_root),
                "omega_rollforward": rel_path(paths.omega_rollforward, repo_root),
                "omega_forecast_latest": rel_path(paths.omega_forecast_latest, repo_root),
                "omega_forecast_points": rel_path(paths.omega_forecast_points_csv, repo_root),
                "page_bundle": rel_path(paths.page_bundle, repo_root),
            },
            "public_outputs": {
                "run_summary": f"public/artifacts/deep_ml/models/{MODEL_KEY}/run_summary.json",
                "quality_review": f"public/artifacts/deep_ml/models/{MODEL_KEY}/quality_review.json",
                "diagnostics": f"public/artifacts/deep_ml/models/{MODEL_KEY}/diagnostics_latest.json",
                "omega_model_ranking": f"public/artifacts/deep_ml/models/{MODEL_KEY}/omega_model_ranking.json",
                "omega_weights_by_horizon": f"public/artifacts/deep_ml/models/{MODEL_KEY}/omega_weights_by_horizon.json",
                "omega_evaluation_by_horizon": f"public/artifacts/deep_ml/models/{MODEL_KEY}/omega_evaluation_by_horizon.json",
                "omega_rollforward": f"public/artifacts/deep_ml/models/{MODEL_KEY}/omega_rollforward.csv",
                "omega_forecast_latest": f"public/artifacts/deep_ml/models/{MODEL_KEY}/omega_forecast_latest.json",
                "omega_forecast_points": f"public/artifacts/deep_ml/models/{MODEL_KEY}/omega_forecast_points.csv",
                "page_bundle": f"public/artifacts/deep_ml/models/{MODEL_KEY}/page_bundle.json",
            },
            "ai_grounding": {
                "allowed_claims": [
                    "Omega fuses Alpha, Beta, Delta, and Epsilon using transparent validation-performance weights.",
                    "Omega uses Gamma as interpretive context only.",
                    "Omega does not retrain component models.",
                    "Omega does not use news sensitivity as a hidden training input.",
                    "Omega outputs a candidate Deep ML fusion forecast and evaluation artifacts.",
                ],
                "forbidden_claims": [
                    "Omega proves causal drivers of gold prices.",
                    "Omega guarantees future gold prices.",
                    "Gamma news caused Omega forecast changes.",
                    "Omega replaces the baseline final forecast without explicit approval.",
                    "Test metrics are the primary weighting basis when validation metrics exist.",
                ],
            },
            "next_step_after_acceptance": {
                "phase": "Omega frontend page",
                "route": "/deep-ml/models/omega-fusion",
                "instruction": "After this report is accepted, build the Omega Fusion frontend from Omega artifacts only.",
            },
            "final_instruction": "Send me artifacts/deep_ml/models/omega_fusion/phase14_omega_fusion_report.json for review before building the Omega frontend.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.report, report)

        if not args.no_public_copy:
            copy_public_outputs(paths)

        logger.checkpoint(
            "completed",
            status,
            {
                "send_me_this_json": rel_path(paths.report, repo_root),
                "public_report": f"public/artifacts/deep_ml/models/{MODEL_KEY}/phase14_omega_fusion_report.json",
            },
        )
        logger.event("phase14_omega_fusion_completed", status=status)

        print("\nPHASE 14 OMEGA COMPLETE")
        print("Send me this JSON for review:")
        print("artifacts/deep_ml/models/omega_fusion/phase14_omega_fusion_report.json")
        return 0

    except Exception as exc:
        error_report = {
            "artifact_type": "phase14_omega_fusion_error_report",
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
        logger.event("phase14_omega_fusion_failed", status="failed", details={"error": repr(exc)})
        raise


if __name__ == "__main__":
    raise SystemExit(main())