from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


# ---------------------------------------------------------
# Basic utilities
# ---------------------------------------------------------

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def find_repo_root(start: Path | None = None) -> Path:
    current = (start or Path.cwd()).resolve()
    for parent in [current, *current.parents]:
        if (parent / ".git").exists() or (parent / "package.json").exists():
            return parent
    return current


REPO_ROOT = find_repo_root()
ARTIFACT_ROOT = REPO_ROOT / "artifacts" / "deep_ml"
PUBLIC_ARTIFACT_ROOT = REPO_ROOT / "public" / "artifacts" / "deep_ml"


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Missing required artifact: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, obj: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"WROTE: {path}")


def mirror_to_public(relative_path: str, obj: dict[str, Any]) -> None:
    write_json(ARTIFACT_ROOT / relative_path, obj)
    write_json(PUBLIC_ARTIFACT_ROOT / relative_path, obj)


def write_parquet_and_public(relative_path: str, df: pd.DataFrame) -> None:
    out1 = ARTIFACT_ROOT / relative_path
    out2 = PUBLIC_ARTIFACT_ROOT / relative_path

    out1.parent.mkdir(parents=True, exist_ok=True)
    out2.parent.mkdir(parents=True, exist_ok=True)

    df.to_parquet(out1, index=False)
    df.to_parquet(out2, index=False)

    print(f"WROTE: {out1}")
    print(f"WROTE: {out2}")


def write_csv_and_public(relative_path: str, df: pd.DataFrame) -> None:
    out1 = ARTIFACT_ROOT / relative_path
    out2 = PUBLIC_ARTIFACT_ROOT / relative_path

    out1.parent.mkdir(parents=True, exist_ok=True)
    out2.parent.mkdir(parents=True, exist_ok=True)

    df.to_csv(out1, index=False)
    df.to_csv(out2, index=False)

    print(f"WROTE: {out1}")
    print(f"WROTE: {out2}")


def sha256_text(value: str) -> str:
    import hashlib
    return "sha256:" + hashlib.sha256(value.encode("utf-8")).hexdigest()


# ---------------------------------------------------------
# Load prior artifacts
# ---------------------------------------------------------

def load_phase_inputs() -> dict[str, Any]:
    mode_status = read_json(ARTIFACT_ROOT / "governance" / "deep_ml_mode_status.json")
    effective_window = read_json(ARTIFACT_ROOT / "governance" / "effective_data_window.json")
    study_context = read_json(ARTIFACT_ROOT / "governance" / "study_context.json")
    factor_state_table = read_json(ARTIFACT_ROOT / "data" / "factor_state_table.json")
    feature_manifest = read_json(ARTIFACT_ROOT / "features" / "feature_manifest.json")
    model_feature_plan = read_json(ARTIFACT_ROOT / "features" / "model_feature_plan.json")
    target_plan = read_json(ARTIFACT_ROOT / "features" / "target_plan.json")

    return {
        "mode_status": mode_status,
        "effective_window": effective_window,
        "study_context": study_context,
        "factor_state_table": factor_state_table,
        "feature_manifest": feature_manifest,
        "model_feature_plan": model_feature_plan,
        "target_plan": target_plan,
    }


# ---------------------------------------------------------
# Matrix discovery
# ---------------------------------------------------------

def candidate_matrix_paths() -> list[Path]:
    candidates: list[Path] = []

    env_path = os.environ.get("DEEPML_INPUT_MATRIX")
    if env_path:
        candidates.append((REPO_ROOT / env_path).resolve() if not Path(env_path).is_absolute() else Path(env_path))

    preferred = [
        "data/aligned/model_ready_multivariate.csv",
        "data/aligned/model_ready_univariate.csv",
        "data/aligned/weekday_clean_matrix.csv",
        "data/aligned/weekday_clean_matrix.parquet",
        "data/weekday_clean_matrix.csv",
        "data/Gold_Matrix_M3_Daily_2026-04-30.csv",
        "public/data/Gold_Matrix_M3_Daily_2026-04-30.csv",
        "Gold_Matrix_M3_Daily_2026-04-30.csv",
    ]

    for rel in preferred:
        candidates.append(REPO_ROOT / rel)

    # Repo scan fallback.
    skip_parts = {
        "node_modules",
        ".git",
        ".next",
        ".venv",
        "runs_local",
        "__pycache__",
    }

    patterns = [
        "*model_ready*.csv",
        "*weekday*matrix*.csv",
        "*Gold_Matrix*.csv",
        "*gold*matrix*.csv",
        "*matrix*.csv",
    ]

    for pattern in patterns:
        for path in REPO_ROOT.rglob(pattern):
            if any(part in skip_parts for part in path.parts):
                continue
            candidates.append(path)

    # Deduplicate while preserving order.
    seen = set()
    unique: list[Path] = []
    for p in candidates:
        key = str(p.resolve())
        if key not in seen:
            seen.add(key)
            unique.append(p)

    return unique


def score_candidate(path: Path) -> int:
    name = path.name.lower()
    full = str(path).lower()

    score = 0

    if not path.exists():
        return -999

    if "model_ready_multivariate" in full:
        score += 100
    if "weekday_clean_matrix" in full:
        score += 90
    if "gold_matrix" in name:
        score += 80
    if "aligned" in full:
        score += 20
    if "public" in full:
        score -= 5
    if "deep_ml" in full:
        score -= 20
    if path.suffix.lower() == ".csv":
        score += 10
    if path.suffix.lower() == ".parquet":
        score += 8

    return score


def detect_matrix() -> dict[str, Any]:
    candidates = candidate_matrix_paths()
    inspected = []

    for path in candidates:
        inspected.append({
            "path": str(path),
            "exists": path.exists(),
            "score": score_candidate(path),
            "suffix": path.suffix.lower(),
        })

    existing = [item for item in inspected if item["exists"]]
    ranked = sorted(existing, key=lambda x: x["score"], reverse=True)

    if not ranked:
        return {
            "status": "blocked",
            "selected_path": None,
            "inspected": inspected,
            "message": "No candidate matrix/model-ready CSV was found."
        }

    return {
        "status": "ready",
        "selected_path": ranked[0]["path"],
        "selected_score": ranked[0]["score"],
        "ranked_candidates": ranked[:10],
        "inspected_count": len(inspected),
    }


def load_matrix(path: Path) -> pd.DataFrame:
    if path.suffix.lower() == ".parquet":
        return pd.read_parquet(path)

    return pd.read_csv(path)


# ---------------------------------------------------------
# Column detection and cleaning
# ---------------------------------------------------------

def detect_date_column(df: pd.DataFrame) -> str | None:
    candidates = ["date", "Date", "DATE", "datetime", "timestamp"]

    for col in candidates:
        if col in df.columns:
            return col

    for col in df.columns:
        lower = str(col).lower()
        if "date" in lower:
            return col

    return None


def standardize_matrix(df: pd.DataFrame, effective_data_through: str) -> tuple[pd.DataFrame, dict[str, Any]]:
    audit: dict[str, Any] = {}

    original_rows = len(df)
    original_columns = list(df.columns)

    date_col = detect_date_column(df)
    if not date_col:
        raise ValueError("Could not detect date column in selected matrix.")

    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df = df.dropna(subset=[date_col])
    df = df.rename(columns={date_col: "date"})

    if "gold_price" not in df.columns:
        # Try common alternatives but do not guess too aggressively.
        possible_gold = [c for c in df.columns if str(c).lower() in {"gold", "gold_close", "price", "close"}]
        if possible_gold:
            df = df.rename(columns={possible_gold[0]: "gold_price"})
        else:
            raise ValueError("gold_price column not found. Send me the matrix file or column list before proceeding.")

    df = df.sort_values("date").drop_duplicates(subset=["date"], keep="last")

    weekend_rows_before = int((df["date"].dt.weekday >= 5).sum())
    df = df[df["date"].dt.weekday < 5].copy()

    cutoff_dt = pd.to_datetime(effective_data_through)
    rows_after_effective_date = int((df["date"] > cutoff_dt).sum())
    df = df[df["date"] <= cutoff_dt].copy()

    # Convert numeric columns where possible.
    for col in df.columns:
        if col == "date":
            continue
        df[col] = pd.to_numeric(df[col], errors="coerce")

    audit.update({
        "original_rows": original_rows,
        "original_column_count": len(original_columns),
        "original_columns": original_columns,
        "date_column_detected": date_col,
        "gold_price_detected": True,
        "rows_after_date_parse": int(len(df) + rows_after_effective_date),
        "weekend_rows_removed": weekend_rows_before,
        "rows_after_effective_date_removed": rows_after_effective_date,
        "final_rows": int(len(df)),
        "final_column_count": int(len(df.columns)),
        "date_min": df["date"].min().date().isoformat() if len(df) else None,
        "date_max": df["date"].max().date().isoformat() if len(df) else None,
    })

    return df, audit


# ---------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------

def add_gold_engineered_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df = df.sort_values("date")

    df["gold_lag_1"] = df["gold_price"].shift(1)
    df["gold_lag_5"] = df["gold_price"].shift(5)
    df["gold_lag_20"] = df["gold_price"].shift(20)

    df["gold_return_1"] = df["gold_price"].pct_change(1)
    df["gold_return_5"] = df["gold_price"].pct_change(5)

    df["gold_ma_5"] = df["gold_price"].rolling(5, min_periods=5).mean()
    df["gold_ma_20"] = df["gold_price"].rolling(20, min_periods=20).mean()
    df["gold_ma_60"] = df["gold_price"].rolling(60, min_periods=60).mean()

    df["gold_volatility_20"] = df["gold_return_1"].rolling(20, min_periods=20).std()

    return df


def add_future_targets(df: pd.DataFrame, horizons: list[int]) -> pd.DataFrame:
    df = df.copy()
    df = df.sort_values("date")

    for h in horizons:
        df[f"target_gold_t_plus_{h}"] = df["gold_price"].shift(-h)
        df[f"target_return_t_plus_{h}"] = (df[f"target_gold_t_plus_{h}"] / df["gold_price"]) - 1
        df[f"target_direction_t_plus_{h}"] = np.sign(df[f"target_return_t_plus_{h}"])

    return df


def build_splits(df: pd.DataFrame, effective_data_through: str) -> pd.DataFrame:
    df = df.copy()

    train_end = pd.to_datetime("2018-12-31")
    val_start = pd.to_datetime("2019-01-01")
    val_end = pd.to_datetime("2022-12-30")
    test_start = pd.to_datetime("2023-01-02")
    test_end = pd.to_datetime(effective_data_through)

    split = np.where(
        df["date"] <= train_end,
        "train",
        np.where(
            (df["date"] >= val_start) & (df["date"] <= val_end),
            "validation",
            np.where(
                (df["date"] >= test_start) & (df["date"] <= test_end),
                "test",
                "outside_split"
            )
        )
    )

    df["split"] = split
    return df


def build_feature_store(
    df: pd.DataFrame,
    model_feature_plan: dict[str, Any],
    target_plan: dict[str, Any],
    effective_data_through: str,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    horizons = target_plan.get("horizons_trading_days", [1, 5, 10, 20, 30])

    df = add_gold_engineered_features(df)
    df = add_future_targets(df, horizons=horizons)
    df = build_splits(df, effective_data_through=effective_data_through)

    # Keep all numeric source columns plus engineered features and targets.
    # We are not dropping rows yet because Beta/Delta may use masking later.
    missing_summary = []
    for col in df.columns:
        if col == "date":
            continue
        missing_summary.append({
            "column": col,
            "missing_count": int(df[col].isna().sum()),
            "missing_pct": float(round(df[col].isna().mean() * 100, 4)),
        })

    split_counts = df["split"].value_counts(dropna=False).to_dict()

    target_cols = [c for c in df.columns if c.startswith("target_")]
    engineered_cols = [
        "gold_lag_1",
        "gold_lag_5",
        "gold_lag_20",
        "gold_return_1",
        "gold_return_5",
        "gold_ma_5",
        "gold_ma_20",
        "gold_ma_60",
        "gold_volatility_20",
    ]

    manifest = {
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "date_min": df["date"].min().date().isoformat() if len(df) else None,
        "date_max": df["date"].max().date().isoformat() if len(df) else None,
        "split_counts": {str(k): int(v) for k, v in split_counts.items()},
        "engineered_columns": engineered_cols,
        "target_columns": target_cols,
        "missing_summary": missing_summary,
    }

    return df, manifest


# ---------------------------------------------------------
# Main
# ---------------------------------------------------------

def main() -> int:
    generated_at_utc = utc_now_iso()
    inputs = load_phase_inputs()

    mode_status = inputs["mode_status"]
    study_context = inputs["study_context"]
    model_feature_plan = inputs["model_feature_plan"]
    target_plan = inputs["target_plan"]

    mode = mode_status["mode"]
    study_id = study_context["study_id"]
    run_batch_id = study_context["run_batch_id"]
    effective_data_through = mode_status["effective_model_data_through_date"]
    forecast_start_date = mode_status["forecast_start_date"]

    detection = detect_matrix()

    if detection["status"] != "ready":
        blocked_report = {
            "artifact_type": "deep_ml_phase5_numeric_feature_store_report",
            "schema_version": "1.0.0",
            "generated_at_utc": generated_at_utc,
            "status": "blocked",
            "reason": "No model-ready or matrix CSV/parquet file was detected.",
            "mode": mode,
            "study_id": study_id,
            "run_batch_id": run_batch_id,
            "outputs": [],
            "inspected": detection.get("inspected", []),
            "next_step": "Send the exact path to your matrix/model-ready CSV, or set DEEPML_INPUT_MATRIX before rerunning."
        }
        mirror_to_public("features/phase5_numeric_feature_store_report.json", blocked_report)
        print(json.dumps(blocked_report, indent=2, ensure_ascii=False))
        return 1

    selected_path = Path(detection["selected_path"])

    try:
        raw_df = load_matrix(selected_path)
        clean_df, load_audit = standardize_matrix(raw_df, effective_data_through=effective_data_through)
        feature_df, feature_store_manifest_core = build_feature_store(
            clean_df,
            model_feature_plan=model_feature_plan,
            target_plan=target_plan,
            effective_data_through=effective_data_through,
        )

        feature_hash = sha256_text("|".join(feature_df.columns) + str(feature_df.shape) + str(feature_df["date"].max()))

        # Write full feature store.
        write_parquet_and_public("features/deep_ml_numeric_feature_store.parquet", feature_df)

        # CSV preview for easier inspection.
        preview = feature_df.tail(250).copy()
        preview["date"] = preview["date"].dt.strftime("%Y-%m-%d")
        write_csv_and_public("features/deep_ml_numeric_feature_store_preview.csv", preview)

        # JSON preview for frontend/AI later.
        json_preview = feature_df.tail(50).copy()
        json_preview["date"] = json_preview["date"].dt.strftime("%Y-%m-%d")
        preview_json = {
            "artifact_type": "deep_ml_numeric_feature_store_preview",
            "schema_version": "1.0.0",
            "generated_at_utc": generated_at_utc,
            "mode": mode,
            "study_id": study_id,
            "run_batch_id": run_batch_id,
            "rows": json.loads(json_preview.replace({np.nan: None}).to_json(orient="records")),
        }
        mirror_to_public("features/deep_ml_numeric_feature_store_preview.json", preview_json)

        feature_store_manifest = {
            "artifact_type": "deep_ml_numeric_feature_store_manifest",
            "schema_version": "1.0.0",
            "generated_at_utc": generated_at_utc,
            "mode": mode,
            "study_id": study_id,
            "run_batch_id": run_batch_id,
            "selected_input_path": str(selected_path),
            "selected_input_relative_path": str(selected_path.relative_to(REPO_ROOT)) if selected_path.is_relative_to(REPO_ROOT) else str(selected_path),
            "effective_data_through_date": effective_data_through,
            "forecast_start_date": forecast_start_date,
            "feature_hash": feature_hash,
            "load_audit": load_audit,
            "feature_store": feature_store_manifest_core,
            "model_feature_sets": model_feature_plan.get("model_feature_sets", {}),
            "outputs": [
                "artifacts/deep_ml/features/deep_ml_numeric_feature_store.parquet",
                "artifacts/deep_ml/features/deep_ml_numeric_feature_store_preview.csv",
                "artifacts/deep_ml/features/deep_ml_numeric_feature_store_preview.json"
            ],
            "professor_safe_summary": (
                "The numeric Deep ML feature store was built using the effective data-through date and leakage-safe engineered feature definitions."
            )
        }

        mirror_to_public("features/deep_ml_numeric_feature_store_manifest.json", feature_store_manifest)

        feature_store_status = {
            "artifact_type": "deep_ml_feature_store_status",
            "schema_version": "1.0.0",
            "generated_at_utc": generated_at_utc,
            "mode": mode,
            "study_id": study_id,
            "run_batch_id": run_batch_id,
            "status": "numeric_feature_store_ready",
            "actual_numeric_feature_store_built": True,
            "selected_input_path": str(selected_path),
            "row_count": feature_store_manifest_core["row_count"],
            "column_count": feature_store_manifest_core["column_count"],
            "date_min": feature_store_manifest_core["date_min"],
            "date_max": feature_store_manifest_core["date_max"],
            "feature_hash": feature_hash,
            "next_required_input": "Proceed to Phase 6 Alpha Structural foundation."
        }

        mirror_to_public("features/feature_store_status.json", feature_store_status)

        report = {
            "artifact_type": "deep_ml_phase5_numeric_feature_store_report",
            "schema_version": "1.0.0",
            "generated_at_utc": generated_at_utc,
            "status": "ready",
            "mode": mode,
            "study_id": study_id,
            "run_batch_id": run_batch_id,
            "selected_input_path": str(selected_path),
            "effective_data_through_date": effective_data_through,
            "forecast_start_date": forecast_start_date,
            "row_count": feature_store_manifest_core["row_count"],
            "column_count": feature_store_manifest_core["column_count"],
            "date_min": feature_store_manifest_core["date_min"],
            "date_max": feature_store_manifest_core["date_max"],
            "split_counts": feature_store_manifest_core["split_counts"],
            "engineered_column_count": len(feature_store_manifest_core["engineered_columns"]),
            "target_column_count": len(feature_store_manifest_core["target_columns"]),
            "outputs": [
                "artifacts/deep_ml/features/deep_ml_numeric_feature_store.parquet",
                "artifacts/deep_ml/features/deep_ml_numeric_feature_store_preview.csv",
                "artifacts/deep_ml/features/deep_ml_numeric_feature_store_preview.json",
                "artifacts/deep_ml/features/deep_ml_numeric_feature_store_manifest.json",
                "artifacts/deep_ml/features/feature_store_status.json"
            ],
            "next_step": "Phase 6: Alpha Structural foundation."
        }

        mirror_to_public("features/phase5_numeric_feature_store_report.json", report)
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 0

    except Exception as exc:
        error_report = {
            "artifact_type": "deep_ml_phase5_numeric_feature_store_report",
            "schema_version": "1.0.0",
            "generated_at_utc": generated_at_utc,
            "status": "blocked",
            "reason": str(exc),
            "mode": mode,
            "study_id": study_id,
            "run_batch_id": run_batch_id,
            "selected_input_path": str(selected_path),
            "matrix_detection": detection,
            "next_step": "Send this report and the selected matrix column list so we can correct the loader."
        }
        mirror_to_public("features/phase5_numeric_feature_store_report.json", error_report)
        print(json.dumps(error_report, indent=2, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())