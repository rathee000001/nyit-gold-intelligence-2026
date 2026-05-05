"""
Gold Nexus Alpha — Deep ML Phase 9
Epsilon Expert Ensemble: statistical + machine-learning benchmark ensemble

Script path expected:
    deep_ml/scripts/09_train_epsilon_expert_ensemble.py

Primary review artifact:
    artifacts/deep_ml/models/epsilon_expert_ensemble/phase9_epsilon_expert_report.json

Windows / PowerShell commands:
    code .\deep_ml\scripts\09_train_epsilon_expert_ensemble.py
    py .\deep_ml\scripts\09_train_epsilon_expert_ensemble.py --smoke
    py .\deep_ml\scripts\09_train_epsilon_expert_ensemble.py

Purpose:
    Build a rigorous benchmark and expert-ensemble layer using classical,
    statistical, and lag-feature ML components. Epsilon protects the Deep ML
    system from overconfidence and gives Omega Fusion a strong benchmark layer.

Locked rule:
    Raw gold price anchor is never scaled for forecast reconstruction or metrics.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.util
import json
import math
import platform
import random
import shutil
import subprocess
import sys
import time
import traceback
import warnings
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd

from sklearn.ensemble import ExtraTreesRegressor, GradientBoostingRegressor, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import ElasticNet, Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")

try:
    from tqdm.auto import tqdm
except Exception:  # pragma: no cover
    tqdm = None

try:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing, SimpleExpSmoothing
except Exception:  # pragma: no cover
    ExponentialSmoothing = None
    SimpleExpSmoothing = None

try:
    from statsmodels.tsa.arima.model import ARIMA
except Exception:  # pragma: no cover
    ARIMA = None

try:
    import xgboost as xgb
except Exception:  # pragma: no cover
    xgb = None


MODEL_KEY = "epsilon_expert_ensemble"
MODEL_NAME = "Epsilon Expert Ensemble"
MODEL_FAMILY = "statistical_ml_benchmark_ensemble"
SCRIPT_VERSION = "epsilon_expert_ensemble_v2_best_validation_component"
TIMEZONE_LOCAL = "America/New_York"
HORIZONS = [1, 5, 10, 20, 30]
TARGET_COVERAGE = 0.80
RANDOM_SEED = 2026
DEFAULT_TRAIN_END = "2018-12-31"
DEFAULT_VALIDATION_END = "2022-12-30"

DATE_COLUMN_CANDIDATES = ["date", "Date", "ds", "timestamp", "time"]
GOLD_COLUMN_CANDIDATES = [
    "gold_price",
    "gold",
    "gold_close",
    "gold_spot",
    "lbma_gold_price_usd",
    "xau_usd",
    "xauusd",
    "price_gold",
    "Gold Price",
    "Gold_Price",
]
TARGET_COLUMN_PATTERNS = (
    "target",
    "future",
    "lead",
    "horizon",
    "return_h",
    "log_return_h",
    "y_h",
    "direction_t_plus",
    "gold_t_plus",
)
NON_FEATURE_COLUMNS = {
    "split",
    "split_label",
    "dataset_split",
    "mode",
    "study_id",
    "run_id",
    "source",
    "dataset_id",
}


# -----------------------------------------------------------------------------
# Utility helpers
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


def safe_float(x: Any) -> Optional[float]:
    try:
        if x is None:
            return None
        val = float(x)
        if math.isnan(val) or math.isinf(val):
            return None
        return val
    except Exception:
        return None


def safe_mean(values: Iterable[Any]) -> Optional[float]:
    vals = [safe_float(v) for v in values]
    vals = [v for v in vals if v is not None]
    return float(np.mean(vals)) if vals else None


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


def set_seed(seed: int = RANDOM_SEED) -> None:
    random.seed(seed)
    np.random.seed(seed)


@dataclass
class RunPaths:
    repo_root: Path
    artifacts_root: Path
    public_artifacts_root: Path
    model_dir: Path
    pages_dir: Path
    public_model_dir: Path
    public_pages_dir: Path
    feature_store_path: Path
    model_feature_plan_path: Path
    target_plan_path: Path
    mode_status_path: Path
    study_context_path: Path
    factor_state_table_path: Path
    alpha_summary_path: Path
    beta_summary_path: Path
    delta_summary_path: Path


def build_paths(repo_root: Path) -> RunPaths:
    artifacts_root = repo_root / "artifacts" / "deep_ml"
    public_root = repo_root / "public" / "artifacts" / "deep_ml"
    return RunPaths(
        repo_root=repo_root,
        artifacts_root=artifacts_root,
        public_artifacts_root=public_root,
        model_dir=artifacts_root / "models" / MODEL_KEY,
        pages_dir=artifacts_root / "pages",
        public_model_dir=public_root / "models" / MODEL_KEY,
        public_pages_dir=public_root / "pages",
        feature_store_path=artifacts_root / "features" / "deep_ml_numeric_feature_store.parquet",
        model_feature_plan_path=artifacts_root / "features" / "model_feature_plan.json",
        target_plan_path=artifacts_root / "features" / "target_plan.json",
        mode_status_path=artifacts_root / "governance" / "deep_ml_mode_status.json",
        study_context_path=artifacts_root / "governance" / "study_context.json",
        factor_state_table_path=artifacts_root / "data" / "factor_state_table.json",
        alpha_summary_path=artifacts_root / "models" / "alpha_structural" / "run_summary.json",
        beta_summary_path=artifacts_root / "models" / "beta_temporal" / "run_summary.json",
        delta_summary_path=artifacts_root / "models" / "delta_tft" / "run_summary.json",
    )


class Timeline:
    def __init__(self, paths: RunPaths) -> None:
        self.paths = paths
        self.events: List[Dict[str, Any]] = []
        self.start_time = time.time()

    def add(self, event: str, status: str = "ok", details: Optional[Dict[str, Any]] = None) -> None:
        row = {
            "timestamp_utc": iso_utc(),
            "elapsed_seconds": round(time.time() - self.start_time, 3),
            "event": event,
            "status": status,
            "details": details or {},
        }
        self.events.append(row)
        write_json(self.paths.model_dir / "timeline.json", self.events)
        print_step(f"{event} [{status}]")


class Checkpoint:
    def __init__(self, paths: RunPaths) -> None:
        self.paths = paths

    def write(self, step: str, status: str, payload: Optional[Dict[str, Any]] = None) -> None:
        write_json(
            self.paths.model_dir / "progress_checkpoint.json",
            {
                "artifact_type": "deep_ml_progress_checkpoint",
                "model_key": MODEL_KEY,
                "step": step,
                "status": status,
                "updated_at_utc": iso_utc(),
                "updated_at_local": local_iso_from_utc(),
                "payload": payload or {},
            },
        )


# -----------------------------------------------------------------------------
# Data preparation
# -----------------------------------------------------------------------------


def dependency_precheck() -> Dict[str, Any]:
    return {
        "python_version": sys.version,
        "platform": platform.platform(),
        "statsmodels_available": ExponentialSmoothing is not None and ARIMA is not None,
        "xgboost_available": xgb is not None,
        "selected_backend": "sklearn_statsmodels_optional_xgboost",
        "professor_safe_note": "Epsilon is a benchmark and expert-ensemble layer, not a causal model.",
    }


def load_feature_store(paths: RunPaths) -> pd.DataFrame:
    if not paths.feature_store_path.exists():
        raise FileNotFoundError(f"Missing feature store: {paths.feature_store_path}")
    df = pd.read_parquet(paths.feature_store_path)
    if df.empty:
        raise ValueError("Feature store parquet has zero rows.")
    return df


def detect_date_column(df: pd.DataFrame) -> str:
    for col in DATE_COLUMN_CANDIDATES:
        if col in df.columns:
            return col
    for col in df.columns:
        lower = str(col).lower()
        if "date" in lower or "time" in lower:
            return col
    raise ValueError("Could not detect date column.")


def detect_gold_column(df: pd.DataFrame, target_plan: Dict[str, Any]) -> str:
    for key in ["gold_column", "target_column", "price_column", "raw_gold_price_column"]:
        col = target_plan.get(key)
        if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
            return str(col)
    for col in GOLD_COLUMN_CANDIDATES:
        if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
            return col
    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    gold_like = [c for c in numeric_cols if "gold" in str(c).lower() and not any(p in str(c).lower() for p in TARGET_COLUMN_PATTERNS)]
    if gold_like:
        return gold_like[0]
    raise ValueError("Could not detect raw gold price column. Add gold_column to target_plan.json.")


def normalize_dates(df: pd.DataFrame, date_col: str) -> pd.DataFrame:
    out = df.copy()
    out[date_col] = pd.to_datetime(out[date_col], errors="coerce")
    out = out.dropna(subset=[date_col]).sort_values(date_col).reset_index(drop=True)
    return out


def extract_training_windows(target_plan: Dict[str, Any], mode_status: Dict[str, Any]) -> Dict[str, str]:
    windows = {
        "train_start": "2006-01-02",
        "train_end": DEFAULT_TRAIN_END,
        "validation_start": "2019-01-01",
        "validation_end": DEFAULT_VALIDATION_END,
        "test_start": "2023-01-02",
        "test_end": mode_status.get("effective_data_through_date")
        or mode_status.get("effective_model_data_through_date")
        or mode_status.get("official_research_cutoff_date")
        or "2026-03-31",
    }
    for key in ["training_window", "model_windows", "splits", "windows"]:
        container = target_plan.get(key)
        if isinstance(container, dict):
            for w in windows:
                if container.get(w):
                    windows[w] = str(container[w])
    return windows


def build_split_labels(df: pd.DataFrame, date_col: str, windows: Dict[str, str]) -> pd.Series:
    dates = pd.to_datetime(df[date_col])
    train_end = pd.Timestamp(windows["train_end"])
    val_end = pd.Timestamp(windows["validation_end"])
    split = pd.Series("test", index=df.index, dtype="object")
    split[dates <= train_end] = "train"
    split[(dates > train_end) & (dates <= val_end)] = "validation"
    split[dates > val_end] = "test"
    return split


def build_targets(df: pd.DataFrame, gold_col: str) -> pd.DataFrame:
    out = df.copy()
    gold = pd.to_numeric(out[gold_col], errors="coerce").astype(float)
    for h in HORIZONS:
        future_price = gold.shift(-h)
        out[f"epsilon_target_log_return_h{h}"] = np.log(future_price / gold)
        out[f"epsilon_target_gold_price_h{h}"] = future_price
    return out


def choose_feature_columns(df: pd.DataFrame, date_col: str, gold_col: str, model_feature_plan: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    explicit = model_feature_plan.get("epsilon_features") or model_feature_plan.get("features_for_ml_models")
    raw_cols = explicit if isinstance(explicit, list) else list(df.columns)
    features: List[str] = []
    excluded: List[str] = []
    for c in raw_cols:
        if c not in df.columns or not pd.api.types.is_numeric_dtype(df[c]):
            continue
        lower = str(c).lower()
        if c == date_col or lower in NON_FEATURE_COLUMNS or lower.endswith("_id"):
            excluded.append(str(c))
            continue
        if "high_yield" in lower:
            excluded.append(str(c))
            continue
        if any(pattern in lower for pattern in TARGET_COLUMN_PATTERNS):
            excluded.append(str(c))
            continue
        features.append(c)
    if gold_col not in features and gold_col in df.columns and pd.api.types.is_numeric_dtype(df[gold_col]):
        features.insert(0, gold_col)
    excluded.extend(["high_yield excluded from official core mode when detected", "dataset_id and *_id columns excluded as identifiers"])
    return features, sorted(set(excluded))


def valid_origin_mask(df: pd.DataFrame, target_cols: List[str], gold_col: str) -> np.ndarray:
    target_ok = df[target_cols].notna().all(axis=1).to_numpy()
    anchor_ok = pd.to_numeric(df[gold_col], errors="coerce").notna().to_numpy()
    return target_ok & anchor_ok


# -----------------------------------------------------------------------------
# Component forecasting
# -----------------------------------------------------------------------------


def reconstruct_prices(anchors: np.ndarray, pred_log_returns: np.ndarray) -> np.ndarray:
    return anchors[:, None] * np.exp(pred_log_returns)


def component_naive(gold: np.ndarray, origin_indices: np.ndarray) -> np.ndarray:
    return np.zeros((len(origin_indices), len(HORIZONS)), dtype=float)


def component_drift(gold: np.ndarray, origin_indices: np.ndarray, lookback: int = 252) -> np.ndarray:
    out = np.zeros((len(origin_indices), len(HORIZONS)), dtype=float)
    for i, idx in enumerate(origin_indices):
        start = max(0, idx - lookback)
        if idx - start < 5 or gold[start] <= 0 or gold[idx] <= 0:
            continue
        daily_log_drift = np.log(gold[idx] / gold[start]) / max(idx - start, 1)
        out[i, :] = np.array(HORIZONS) * daily_log_drift
    return out


def component_rolling_anchor_gap(gold: np.ndarray, origin_indices: np.ndarray, window: int, mode: str) -> np.ndarray:
    out = np.zeros((len(origin_indices), len(HORIZONS)), dtype=float)
    for i, idx in enumerate(origin_indices):
        start = max(0, idx - window + 1)
        hist = gold[start : idx + 1]
        hist = hist[np.isfinite(hist) & (hist > 0)]
        if len(hist) == 0 or gold[idx] <= 0:
            continue
        center = float(np.mean(hist)) if mode == "mean" else float(np.median(hist))
        # Forecast is conservative: partially mean-revert toward rolling center as horizon grows.
        gap_log = np.log(center / gold[idx])
        for hi, h in enumerate(HORIZONS):
            out[i, hi] = gap_log * min(h / 30.0, 1.0) * 0.35
    return out


def component_momentum(gold: np.ndarray, origin_indices: np.ndarray, lookback: int = 20) -> np.ndarray:
    out = np.zeros((len(origin_indices), len(HORIZONS)), dtype=float)
    for i, idx in enumerate(origin_indices):
        if idx - lookback < 0 or gold[idx - lookback] <= 0 or gold[idx] <= 0:
            continue
        daily_momentum = np.log(gold[idx] / gold[idx - lookback]) / lookback
        out[i, :] = np.array(HORIZONS) * daily_momentum * 0.55
    return out


def component_ets_like(
    gold: np.ndarray,
    origin_indices: np.ndarray,
    max_fit_points: int = 1000,
    max_origins: Optional[int] = None,
) -> np.ndarray:
    """ETS-like component with sparse fitting and interpolation.

    Fitting statsmodels exponential smoothing at every rolling origin can be very slow
    and can emit harmless convergence warnings. Epsilon uses this as one component
    inside a larger ensemble, so sparse origin fitting is enough for benchmark value.
    """
    out = np.zeros((len(origin_indices), len(HORIZONS)), dtype=float)
    if SimpleExpSmoothing is None or len(origin_indices) == 0:
        return out

    selected_positions = list(range(len(origin_indices)))
    if max_origins is not None and len(selected_positions) > max_origins:
        selected_positions = sorted(set(np.linspace(0, len(origin_indices) - 1, max_origins).astype(int).tolist()))

    fitted_map: Dict[int, np.ndarray] = {}
    iterator = selected_positions
    if tqdm is not None:
        iterator = tqdm(iterator, desc="ETS-like component", leave=False)

    for pos in iterator:
        idx = int(origin_indices[pos])
        hist = gold[max(0, idx - max_fit_points + 1) : idx + 1]
        hist = hist[np.isfinite(hist) & (hist > 0)]
        if len(hist) < 60 or gold[idx] <= 0:
            continue
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                model = SimpleExpSmoothing(hist, initialization_method="estimated").fit(optimized=True)
            fc = np.asarray(model.forecast(max(HORIZONS)), dtype=float)
            fitted_map[pos] = np.log(np.maximum(fc[np.array(HORIZONS) - 1], 1e-9) / gold[idx])
        except Exception:
            continue

    if fitted_map:
        known_positions = np.array(sorted(fitted_map.keys()), dtype=int)
        known_values = np.vstack([fitted_map[p] for p in known_positions])
        for hi in range(len(HORIZONS)):
            out[:, hi] = np.interp(np.arange(len(origin_indices)), known_positions, known_values[:, hi])
    return out


def component_theta_like(gold: np.ndarray, origin_indices: np.ndarray, lookback: int = 252) -> np.ndarray:
    # Lightweight Theta-style approximation: average naive and drift projection.
    return 0.5 * component_drift(gold, origin_indices, lookback=lookback)


def component_arima_like(gold: np.ndarray, origin_indices: np.ndarray, max_fit_points: int = 750, max_origins: Optional[int] = None) -> np.ndarray:
    out = np.zeros((len(origin_indices), len(HORIZONS)), dtype=float)
    if ARIMA is None:
        return out
    # ARIMA at every origin can be expensive. Fit at all origins in full mode if manageable, otherwise fallback persists.
    selected_positions = list(range(len(origin_indices)))
    if max_origins is not None and len(selected_positions) > max_origins:
        selected_positions = sorted(set(np.linspace(0, len(origin_indices) - 1, max_origins).astype(int).tolist()))
    iterator = selected_positions
    if tqdm is not None:
        iterator = tqdm(iterator, desc="ARIMA-like component", leave=False)
    fitted_map: Dict[int, np.ndarray] = {}
    for pos in iterator:
        idx = int(origin_indices[pos])
        hist = gold[max(0, idx - max_fit_points + 1) : idx + 1]
        hist = hist[np.isfinite(hist) & (hist > 0)]
        if len(hist) < 80 or gold[idx] <= 0:
            continue
        try:
            log_hist = np.log(hist)
            model = ARIMA(log_hist, order=(1, 1, 1)).fit()
            fc_log = np.asarray(model.forecast(steps=max(HORIZONS)), dtype=float)
            fitted_map[pos] = fc_log[np.array(HORIZONS) - 1] - np.log(gold[idx])
        except Exception:
            continue
    # Interpolate sparse ARIMA origins if smoke/large fallback used.
    if fitted_map:
        known_positions = np.array(sorted(fitted_map.keys()), dtype=int)
        known_values = np.vstack([fitted_map[p] for p in known_positions])
        for hi in range(len(HORIZONS)):
            out[:, hi] = np.interp(np.arange(len(origin_indices)), known_positions, known_values[:, hi])
    return out


def make_ml_pipeline(model_name: str, seed: int, smoke: bool = False) -> Any:
    if model_name == "ridge_lag_expert":
        return Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler()), ("model", Ridge(alpha=1.0))])
    if model_name == "elasticnet_lag_expert":
        return Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
                ("model", ElasticNet(alpha=0.0005, l1_ratio=0.15, max_iter=8000, random_state=seed)),
            ]
        )
    if model_name == "random_forest_lag_expert":
        return Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "model",
                    RandomForestRegressor(
                        n_estimators=60 if smoke else 180,
                        max_depth=6 if smoke else 10,
                        min_samples_leaf=5,
                        random_state=seed,
                        n_jobs=-1,
                    ),
                ),
            ]
        )
    if model_name == "extratrees_lag_expert":
        return Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "model",
                    ExtraTreesRegressor(
                        n_estimators=60 if smoke else 180,
                        max_depth=6 if smoke else 10,
                        min_samples_leaf=5,
                        random_state=seed,
                        n_jobs=-1,
                    ),
                ),
            ]
        )
    if model_name == "gradient_boosting_lag_expert":
        return Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "model",
                    GradientBoostingRegressor(
                        n_estimators=60 if smoke else 160,
                        learning_rate=0.035,
                        max_depth=2,
                        random_state=seed,
                    ),
                ),
            ]
        )
    if model_name == "xgboost_lag_expert" and xgb is not None:
        return Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "model",
                    xgb.XGBRegressor(
                        n_estimators=80 if smoke else 220,
                        max_depth=3,
                        learning_rate=0.035,
                        subsample=0.90,
                        colsample_bytree=0.85,
                        objective="reg:squarederror",
                        random_state=seed,
                        n_jobs=0,
                        tree_method="hist",
                    ),
                ),
            ]
        )
    raise ValueError(f"Unknown or unavailable ML model: {model_name}")


def fit_predict_ml_components(
    df: pd.DataFrame,
    feature_cols: List[str],
    target_log_cols: List[str],
    split_labels: pd.Series,
    origin_indices: Dict[str, np.ndarray],
    seed: int,
    smoke: bool,
    paths: RunPaths,
    checkpoint: Checkpoint,
) -> Tuple[Dict[str, Dict[str, np.ndarray]], List[Dict[str, Any]]]:
    ml_names = [
        "ridge_lag_expert",
        "elasticnet_lag_expert",
        "random_forest_lag_expert",
        "extratrees_lag_expert",
        "gradient_boosting_lag_expert",
    ]
    if xgb is not None:
        ml_names.append("xgboost_lag_expert")

    X = df[feature_cols].replace([np.inf, -np.inf], np.nan)
    preds: Dict[str, Dict[str, np.ndarray]] = {
        name: {split: np.zeros((len(idx), len(HORIZONS)), dtype=float) for split, idx in origin_indices.items()} for name in ml_names
    }
    rows: List[Dict[str, Any]] = []
    train_idx = origin_indices["train"]
    train_target_ok = train_idx

    iterator = ml_names
    if tqdm is not None:
        iterator = tqdm(ml_names, desc="ML components", leave=False)
    for model_name in iterator:
        started = time.time()
        row = {"component_key": model_name, "component_family": "lag_feature_ml", "status": "started"}
        try:
            for hi, h in enumerate(HORIZONS):
                y = df.loc[train_target_ok, f"epsilon_target_log_return_h{h}"].astype(float).to_numpy()
                valid = np.isfinite(y)
                if valid.sum() < 100:
                    raise ValueError(f"Insufficient target rows for horizon {h}")
                model = make_ml_pipeline(model_name, seed + h, smoke=smoke)
                model.fit(X.iloc[train_target_ok[valid]], y[valid])
                for split, idx in origin_indices.items():
                    if len(idx) == 0:
                        continue
                    preds[model_name][split][:, hi] = model.predict(X.iloc[idx])
            row.update({"status": "completed", "runtime_seconds": round(time.time() - started, 3), "horizons": HORIZONS})
        except Exception as exc:
            row.update({"status": "failed", "error": repr(exc), "runtime_seconds": round(time.time() - started, 3)})
            preds.pop(model_name, None)
        rows.append(row)
        write_csv_dicts(paths.model_dir / "component_training_log.csv", rows)
        checkpoint.write("ml_component_completed", "running", row)
    return preds, rows


# -----------------------------------------------------------------------------
# Evaluation, ranking, weights, uncertainty
# -----------------------------------------------------------------------------


def assemble_component_predictions(
    component_log_preds: Dict[str, Dict[str, np.ndarray]],
    anchors_by_split: Dict[str, np.ndarray],
    actual_prices_by_split: Dict[str, np.ndarray],
) -> Dict[str, Dict[str, Dict[str, np.ndarray]]]:
    result: Dict[str, Dict[str, Dict[str, np.ndarray]]] = {}
    for comp, by_split in component_log_preds.items():
        result[comp] = {}
        for split, logs in by_split.items():
            anchors = anchors_by_split[split]
            prices = reconstruct_prices(anchors, logs)
            result[comp][split] = {
                "pred_log_returns": logs,
                "pred_prices": prices,
                "anchors": anchors,
                "actual_prices": actual_prices_by_split[split],
            }
    return result


def calc_point_metrics(anchors: np.ndarray, actual_prices: np.ndarray, pred_prices: np.ndarray) -> Dict[str, Any]:
    metrics: Dict[str, Any] = {}
    for hi, h in enumerate(HORIZONS):
        actual = actual_prices[:, hi].astype(float)
        pred = pred_prices[:, hi].astype(float)
        anchor = anchors.astype(float)
        valid = np.isfinite(actual) & np.isfinite(pred) & (actual != 0)
        if valid.sum() == 0:
            metrics[str(h)] = {"count": 0}
            continue
        err = pred[valid] - actual[valid]
        abs_pct = np.abs(err / actual[valid]) * 100.0
        smape = 200.0 * np.abs(err) / (np.abs(actual[valid]) + np.abs(pred[valid]) + 1e-12)
        actual_direction = np.sign(actual[valid] - anchor[valid])
        pred_direction = np.sign(pred[valid] - anchor[valid])
        direction_valid = actual_direction != 0
        metrics[str(h)] = {
            "count": int(valid.sum()),
            "mae": float(np.mean(np.abs(err))),
            "rmse": float(np.sqrt(np.mean(err**2))),
            "mape_pct": float(np.mean(abs_pct)),
            "smape_pct": float(np.mean(smape)),
            "bias_mean_error": float(np.mean(err)),
            "directional_accuracy_pct": (
                float(np.mean(actual_direction[direction_valid] == pred_direction[direction_valid]) * 100.0)
                if direction_valid.sum() > 0
                else None
            ),
        }
    return metrics


def evaluate_components(preds: Dict[str, Dict[str, Dict[str, np.ndarray]]]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for comp, by_split in preds.items():
        out[comp] = {}
        for split, payload in by_split.items():
            out[comp][split] = calc_point_metrics(payload["anchors"], payload["actual_prices"], payload["pred_prices"])
    return out


def component_average_mape(component_eval: Dict[str, Any], split: str = "validation") -> Dict[str, float]:
    scores = {}
    for comp, by_split in component_eval.items():
        rows = by_split.get(split, {})
        avg = safe_mean(row.get("mape_pct") for row in rows.values() if isinstance(row, dict))
        if avg is not None:
            scores[comp] = float(avg)
    return scores


def compute_horizon_weights(component_eval: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
    weights: Dict[str, Dict[str, float]] = {}
    for h in HORIZONS:
        raw: Dict[str, float] = {}
        for comp, by_split in component_eval.items():
            row = by_split.get("validation", {}).get(str(h), {})
            mape = row.get("mape_pct")
            if mape is None or not np.isfinite(mape):
                continue
            raw[comp] = 1.0 / max(float(mape), 1e-6)
        total = sum(raw.values())
        if total <= 0:
            comps = list(component_eval.keys())
            weights[str(h)] = {c: 1.0 / len(comps) for c in comps} if comps else {}
        else:
            weights[str(h)] = {c: v / total for c, v in raw.items()}
    return weights


def weighted_ensemble_predictions(
    component_preds: Dict[str, Dict[str, Dict[str, np.ndarray]]],
    weights: Dict[str, Dict[str, float]],
    split: str,
) -> Dict[str, np.ndarray]:
    components = list(component_preds.keys())
    if not components:
        raise RuntimeError("No component predictions available for ensemble.")
    sample = component_preds[components[0]][split]
    n = len(sample["anchors"])
    log_pred = np.zeros((n, len(HORIZONS)), dtype=float)
    for hi, h in enumerate(HORIZONS):
        w_by_comp = weights.get(str(h), {})
        for comp in components:
            w = float(w_by_comp.get(comp, 0.0))
            log_pred[:, hi] += w * component_preds[comp][split]["pred_log_returns"][:, hi]
    return {
        "pred_log_returns": log_pred,
        "pred_prices": reconstruct_prices(sample["anchors"], log_pred),
        "anchors": sample["anchors"],
        "actual_prices": sample["actual_prices"],
    }


def equal_weight_ensemble_predictions(component_preds: Dict[str, Dict[str, Dict[str, np.ndarray]]], split: str) -> Dict[str, np.ndarray]:
    components = list(component_preds.keys())
    sample = component_preds[components[0]][split]
    stack = np.stack([component_preds[c][split]["pred_log_returns"] for c in components], axis=0)
    log_pred = np.mean(stack, axis=0)
    return {
        "pred_log_returns": log_pred,
        "pred_prices": reconstruct_prices(sample["anchors"], log_pred),
        "anchors": sample["anchors"],
        "actual_prices": sample["actual_prices"],
    }


def median_ensemble_predictions(component_preds: Dict[str, Dict[str, Dict[str, np.ndarray]]], split: str) -> Dict[str, np.ndarray]:
    components = list(component_preds.keys())
    sample = component_preds[components[0]][split]
    stack = np.stack([component_preds[c][split]["pred_log_returns"] for c in components], axis=0)
    log_pred = np.median(stack, axis=0)
    return {
        "pred_log_returns": log_pred,
        "pred_prices": reconstruct_prices(sample["anchors"], log_pred),
        "anchors": sample["anchors"],
        "actual_prices": sample["actual_prices"],
    }


def choose_ensemble_strategy(component_preds: Dict[str, Dict[str, Dict[str, np.ndarray]]], weights: Dict[str, Dict[str, float]]) -> Tuple[str, Dict[str, Dict[str, np.ndarray]], Dict[str, Any]]:
    """Choose the final Epsilon strategy using validation MAPE.

    V2 correction:
        Epsilon V1 compared only ensemble combinations. V2 also includes the
        best individual validation component as a candidate, because Epsilon is
        a benchmark guardrail and should not ignore a component that beats the
        ensemble on validation.
    """
    candidates: Dict[str, Dict[str, Dict[str, np.ndarray]]] = {
        "equal_weight": {split: equal_weight_ensemble_predictions(component_preds, split) for split in ["train", "validation", "test"]},
        "inverse_validation_mape_weighted": {split: weighted_ensemble_predictions(component_preds, weights, split) for split in ["train", "validation", "test"]},
        "median_log_return": {split: median_ensemble_predictions(component_preds, split) for split in ["train", "validation", "test"]},
    }

    # Add every individual component as a selectable benchmark candidate.
    # The selected one is the best_validation_component if it wins on validation.
    for component_key, by_split in component_preds.items():
        candidates[f"best_validation_component::{component_key}"] = {
            split: by_split[split] for split in ["train", "validation", "test"] if split in by_split
        }

    evaluations: Dict[str, Any] = {}
    for name, by_split in candidates.items():
        evaluations[name] = {}
        for split, payload in by_split.items():
            evaluations[name][split] = calc_point_metrics(payload["anchors"], payload["actual_prices"], payload["pred_prices"])

    val_scores = {
        name: safe_mean(row.get("mape_pct") for row in ev["validation"].values())
        for name, ev in evaluations.items()
    }
    valid_names = [k for k, v in val_scores.items() if v is not None]
    if not valid_names:
        raise RuntimeError("No valid Epsilon candidate strategy could be scored on validation.")

    best = min(valid_names, key=lambda k: val_scores[k])
    selected_component_key = best.split("::", 1)[1] if best.startswith("best_validation_component::") else None
    return best, candidates[best], {
        "candidate_evaluations": evaluations,
        "validation_average_mape": val_scores,
        "v2_selection_correction": "Includes best validation component candidates in addition to ensemble candidates.",
        "selected_component_key": selected_component_key,
    }


def derive_residual_interval_calibration(ensemble_by_split: Dict[str, Dict[str, np.ndarray]]) -> Dict[str, Any]:
    val = ensemble_by_split["validation"]
    residuals = val["actual_prices"] - val["pred_prices"]
    by_horizon: Dict[str, Any] = {}
    for hi, h in enumerate(HORIZONS):
        res = residuals[:, hi].astype(float)
        valid = np.isfinite(res)
        if valid.sum() < 30:
            by_horizon[str(h)] = {"status": "insufficient_validation_points", "lower_residual": None, "upper_residual": None}
            continue
        lower = float(np.quantile(res[valid], 0.10))
        upper = float(np.quantile(res[valid], 0.90))
        by_horizon[str(h)] = {
            "status": "ready",
            "method": "validation_residual_empirical_quantiles",
            "target_coverage_pct": 80.0,
            "lower_residual_p10": lower,
            "upper_residual_p90": upper,
            "median_abs_residual": float(np.median(np.abs(res[valid]))),
        }
    return {
        "artifact_type": "epsilon_residual_interval_calibration",
        "schema_version": "1.0.0",
        "model_key": MODEL_KEY,
        "target_coverage_pct": 80.0,
        "p50_preserved": True,
        "professor_safe_note": "Intervals use validation residual behavior. They estimate uncertainty but do not guarantee future ranges.",
        "by_horizon": by_horizon,
        "generated_at_utc": iso_utc(),
    }


def apply_residual_intervals(ensemble_payload: Dict[str, np.ndarray], calibration: Dict[str, Any]) -> Dict[str, np.ndarray]:
    p50 = ensemble_payload["pred_prices"]
    prices = np.zeros((p50.shape[0], len(HORIZONS), 3), dtype=float)
    for hi, h in enumerate(HORIZONS):
        info = calibration.get("by_horizon", {}).get(str(h), {})
        lo = float(info.get("lower_residual_p10") or 0.0)
        up = float(info.get("upper_residual_p90") or 0.0)
        prices[:, hi, 0] = np.maximum(p50[:, hi] + lo, 1.0)
        prices[:, hi, 1] = p50[:, hi]
        prices[:, hi, 2] = np.maximum(p50[:, hi] + up, prices[:, hi, 0] + 1e-6)
    logs = np.log(prices / np.maximum(ensemble_payload["anchors"][:, None, None], 1e-12))
    return {
        "pred_prices_quantiles": prices,
        "pred_log_returns_quantiles": logs,
        "anchors": ensemble_payload["anchors"],
        "actual_prices": ensemble_payload["actual_prices"],
    }


def calc_uncertainty_metrics(actual_prices: np.ndarray, pred_quantile_prices: np.ndarray, anchors: np.ndarray) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for hi, h in enumerate(HORIZONS):
        actual = actual_prices[:, hi].astype(float)
        p10 = pred_quantile_prices[:, hi, 0].astype(float)
        p50 = pred_quantile_prices[:, hi, 1].astype(float)
        p90 = pred_quantile_prices[:, hi, 2].astype(float)
        valid = np.isfinite(actual) & np.isfinite(p10) & np.isfinite(p50) & np.isfinite(p90)
        if valid.sum() == 0:
            out[str(h)] = {"count": 0}
            continue
        coverage = np.mean((actual[valid] >= p10[valid]) & (actual[valid] <= p90[valid])) * 100.0
        width = p90[valid] - p10[valid]
        out[str(h)] = {
            "count": int(valid.sum()),
            "coverage_p10_p90_pct": float(coverage),
            "mean_interval_width_price": float(np.mean(width)),
            "median_interval_width_price": float(np.median(width)),
            "mean_interval_width_pct_of_anchor": float(np.mean(width / np.maximum(anchors[valid], 1e-12) * 100.0)),
            "calibration_error_vs_80pct_abs": float(abs(coverage - 80.0)),
        }
    return out


def component_disagreement(component_preds: Dict[str, Dict[str, Dict[str, np.ndarray]]], split: str) -> Dict[str, Any]:
    comps = list(component_preds.keys())
    stack = np.stack([component_preds[c][split]["pred_prices"] for c in comps], axis=0)
    out: Dict[str, Any] = {}
    for hi, h in enumerate(HORIZONS):
        std = np.std(stack[:, :, hi], axis=0)
        mean = np.mean(stack[:, :, hi], axis=0)
        out[str(h)] = {
            "component_count": len(comps),
            "mean_price_disagreement_std": float(np.mean(std)),
            "median_price_disagreement_std": float(np.median(std)),
            "mean_disagreement_pct_of_forecast": float(np.mean(std / np.maximum(mean, 1e-12) * 100.0)),
        }
    return out


# -----------------------------------------------------------------------------
# Row exports and latest forecast
# -----------------------------------------------------------------------------


def component_forecast_rows(
    component_preds: Dict[str, Dict[str, Dict[str, np.ndarray]]],
    split: str,
    df: pd.DataFrame,
    date_col: str,
    origin_idx: np.ndarray,
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for comp, by_split in component_preds.items():
        payload = by_split[split]
        for i, idx in enumerate(origin_idx):
            origin_date = pd.Timestamp(df.loc[int(idx), date_col]).date().isoformat()
            for hi, h in enumerate(HORIZONS):
                rows.append(
                    {
                        "component_key": comp,
                        "split": split,
                        "origin_index": int(idx),
                        "origin_date": origin_date,
                        "horizon_trading_days": int(h),
                        "raw_gold_price_anchor": safe_float(payload["anchors"][i]),
                        "actual_gold_price": safe_float(payload["actual_prices"][i, hi]),
                        "predicted_log_return": safe_float(payload["pred_log_returns"][i, hi]),
                        "forecast_price": safe_float(payload["pred_prices"][i, hi]),
                    }
                )
    return rows


def ensemble_prediction_rows(
    ensemble_payload: Dict[str, np.ndarray],
    quantile_payload: Dict[str, np.ndarray],
    split: str,
    df: pd.DataFrame,
    date_col: str,
    origin_idx: np.ndarray,
    selected_strategy: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Return frontend-ready Epsilon prediction rows.

    The first fields intentionally mirror Alpha/Beta's rollforward contract:
    date, split, horizon, gold_price, actual_target, prediction,
    naive_prediction, predicted_log_return, and error.

    Epsilon-specific residual interval fields are preserved in the same row so
    the frontend can display p10/p50/p90 and uncertainty diagnostics without
    guessing or hardcoding claims.
    """

    rows: List[Dict[str, Any]] = []
    prices_q = quantile_payload["pred_prices_quantiles"]
    logs_q = quantile_payload["pred_log_returns_quantiles"]
    for i, idx in enumerate(origin_idx):
        origin_date = pd.Timestamp(df.loc[int(idx), date_col]).date().isoformat()
        anchor_value = safe_float(ensemble_payload["anchors"][i])
        for hi, h in enumerate(HORIZONS):
            actual_value = safe_float(ensemble_payload["actual_prices"][i, hi])
            p10_value = safe_float(prices_q[i, hi, 0])
            p50_value = safe_float(prices_q[i, hi, 1])
            p90_value = safe_float(prices_q[i, hi, 2])
            p10_log = safe_float(logs_q[i, hi, 0])
            p50_log = safe_float(logs_q[i, hi, 1])
            p90_log = safe_float(logs_q[i, hi, 2])

            rows.append(
                {
                    # Standard frontend-compatible rollforward fields
                    "date": origin_date,
                    "split": split,
                    "horizon": int(h),
                    "gold_price": anchor_value,
                    "actual_target": actual_value,
                    "prediction": p50_value,
                    "naive_prediction": anchor_value,
                    "predicted_log_return": p50_log,
                    "error": safe_float(p50_value - actual_value) if p50_value is not None and actual_value is not None else None,

                    # Epsilon-specific audit and uncertainty fields
                    "selected_ensemble_strategy": selected_strategy,
                    "origin_index": int(idx),
                    "origin_date": origin_date,
                    "horizon_trading_days": int(h),
                    "raw_gold_price_anchor": anchor_value,
                    "actual_gold_price": actual_value,
                    "predicted_log_return_p10": p10_log,
                    "predicted_log_return_p50": p50_log,
                    "predicted_log_return_p90": p90_log,
                    "forecast_price_p10": p10_value,
                    "forecast_price_p50": p50_value,
                    "forecast_price_p90": p90_value,
                    "p10": p10_value,
                    "p50": p50_value,
                    "p90": p90_value,
                    "interval_width_price": safe_float(p90_value - p10_value) if p90_value is not None and p10_value is not None else None,
                }
            )
    return rows


def latest_forecast_from_components(
    df: pd.DataFrame,
    gold_col: str,
    date_col: str,
    feature_cols: List[str],
    split_labels: pd.Series,
    target_log_cols: List[str],
    component_preds: Dict[str, Dict[str, Dict[str, np.ndarray]]],
    weights: Dict[str, Dict[str, float]],
    selected_strategy: str,
    residual_calibration: Dict[str, Any],
) -> Dict[str, Any]:
    latest_idx = int(np.where(pd.to_numeric(df[gold_col], errors="coerce").notna().to_numpy())[0][-1])
    anchor = float(df.loc[latest_idx, gold_col])
    origin_date = pd.Timestamp(df.loc[latest_idx, date_col])

    # For latest forecast, reuse component formulas for deterministic components.
    gold = pd.to_numeric(df[gold_col], errors="coerce").to_numpy(dtype=float)
    origin_arr = np.array([latest_idx], dtype=int)
    latest_component_logs: Dict[str, np.ndarray] = {}
    for comp in component_preds.keys():
        if comp == "naive_last_value":
            latest_component_logs[comp] = component_naive(gold, origin_arr)[0]
        elif comp == "drift_252":
            latest_component_logs[comp] = component_drift(gold, origin_arr, 252)[0]
        elif comp == "rolling_mean_20_gap":
            latest_component_logs[comp] = component_rolling_anchor_gap(gold, origin_arr, 20, "mean")[0]
        elif comp == "rolling_mean_60_gap":
            latest_component_logs[comp] = component_rolling_anchor_gap(gold, origin_arr, 60, "mean")[0]
        elif comp == "rolling_median_60_gap":
            latest_component_logs[comp] = component_rolling_anchor_gap(gold, origin_arr, 60, "median")[0]
        elif comp == "momentum_20":
            latest_component_logs[comp] = component_momentum(gold, origin_arr, 20)[0]
        elif comp == "theta_like_252":
            latest_component_logs[comp] = component_theta_like(gold, origin_arr, 252)[0]
        elif comp == "ets_like":
            latest_component_logs[comp] = component_ets_like(gold, origin_arr, max_origins=1)[0]
        elif comp == "arima_like":
            latest_component_logs[comp] = component_arima_like(gold, origin_arr, max_origins=1)[0]
        else:
            # ML latest forecasts are not directly reusable here because fitted models are not persisted.
            # Use component's most recent test-origin behavior as a conservative proxy for latest component contribution.
            test_payload = component_preds[comp].get("test")
            if test_payload is not None and len(test_payload["pred_log_returns"]) > 0:
                latest_component_logs[comp] = test_payload["pred_log_returns"][-1]
            else:
                latest_component_logs[comp] = np.zeros(len(HORIZONS), dtype=float)

    if selected_strategy == "equal_weight":
        ensemble_log = np.mean(np.stack(list(latest_component_logs.values()), axis=0), axis=0)
    elif selected_strategy == "median_log_return":
        ensemble_log = np.median(np.stack(list(latest_component_logs.values()), axis=0), axis=0)
    elif selected_strategy.startswith("best_validation_component::"):
        selected_component = selected_strategy.split("::", 1)[1]
        ensemble_log = latest_component_logs.get(selected_component, np.zeros(len(HORIZONS), dtype=float))
    else:
        ensemble_log = np.zeros(len(HORIZONS), dtype=float)
        for hi, h in enumerate(HORIZONS):
            for comp, logs in latest_component_logs.items():
                ensemble_log[hi] += float(weights.get(str(h), {}).get(comp, 0.0)) * logs[hi]

    p50_prices = anchor * np.exp(ensemble_log)
    path: List[Dict[str, Any]] = []
    for hi, h in enumerate(HORIZONS):
        info = residual_calibration.get("by_horizon", {}).get(str(h), {})
        lo = float(info.get("lower_residual_p10") or 0.0)
        up = float(info.get("upper_residual_p90") or 0.0)
        p10 = max(p50_prices[hi] + lo, 1.0)
        p50 = p50_prices[hi]
        p90 = max(p50_prices[hi] + up, p10 + 1e-6)
        forecast_date = pd.bdate_range(origin_date, periods=h + 1)[-1]
        path.append(
            {
                "horizon_trading_days": int(h),
                "origin_date": origin_date.date().isoformat(),
                "forecast_date_business_day_approx": forecast_date.date().isoformat(),
                "raw_gold_price_anchor": anchor,
                "predicted_log_return_p10": float(np.log(p10 / anchor)),
                "predicted_log_return_p50": float(np.log(p50 / anchor)),
                "predicted_log_return_p90": float(np.log(p90 / anchor)),
                "forecast_price_p10": float(p10),
                "forecast_price_p50": float(p50),
                "forecast_price_p90": float(p90),
            }
        )
    return {
        "origin_index": latest_idx,
        "origin_date": origin_date.date().isoformat(),
        "raw_gold_price_anchor": anchor,
        "selected_ensemble_strategy": selected_strategy,
        "path": path,
    }


# -----------------------------------------------------------------------------
# Quality and public copy
# -----------------------------------------------------------------------------


def build_quality_review(
    sanity_checks: Dict[str, Any],
    evaluation_by_horizon: Dict[str, Any],
    component_eval: Dict[str, Any],
    uncertainty_latest: Dict[str, Any],
    required_files: List[Path],
) -> Dict[str, Any]:
    blocking: List[str] = []
    warnings_list: List[str] = []
    for check in sanity_checks.get("checks", []):
        if check.get("status") == "fail":
            blocking.append(f"sanity_check_failed:{check.get('name')}")
        elif check.get("status") == "warning":
            warnings_list.append(f"sanity_check_warning:{check.get('name')}")
    missing = [str(p) for p in required_files if not p.exists()]
    if missing:
        blocking.append("missing_required_common_artifacts")
    if not component_eval:
        blocking.append("no_component_evaluation")

    test_mape = safe_mean(row.get("mape_pct") for row in evaluation_by_horizon.get("test", {}).values())
    naive_mape = safe_mean(row.get("mape_pct") for row in evaluation_by_horizon.get("naive_baseline_test", {}).values())
    if test_mape is not None and naive_mape is not None and test_mape > naive_mape:
        warnings_list.append("Epsilon ensemble did not beat naive average MAPE overall; keep as benchmark evidence but review before Omega weighting.")

    coverages = [row.get("coverage_p10_p90_pct") for row in uncertainty_latest.get("coverage_by_horizon", {}).values()]
    coverage_avg = safe_mean(coverages)
    if coverage_avg is not None and (coverage_avg < 55 or coverage_avg > 95):
        warnings_list.append("Average residual-calibrated coverage is outside the rough 55%-95% review band.")

    status = "ready" if not blocking and not warnings_list else "ready_quality_review_required"
    if blocking:
        status = "failed_quality_gate"
    return {
        "artifact_type": "deep_ml_quality_review",
        "schema_version": "1.0.0",
        "model_key": MODEL_KEY,
        "status": status,
        "generated_at_utc": iso_utc(),
        "blocking_flags": blocking,
        "warnings": warnings_list,
        "acceptance_gate": {
            "raw_price_anchor_passes": not any("anchor" in b for b in blocking),
            "component_forecasts_exported": True,
            "evaluation_rollforward_exported": True,
            "component_metrics_exported": bool(component_eval),
            "ensemble_weights_exported": True,
            "static_metrics_exported": bool(evaluation_by_horizon.get("test")),
            "rolling_origin_metrics_exported": True,
            "uncertainty_intervals_exported": bool(uncertainty_latest.get("coverage_by_horizon")),
            "coverage_metrics_exported": bool(uncertainty_latest.get("coverage_by_horizon")),
            "all_shared_contract_files_exist": not missing,
        },
        "professor_safe_summary": "Epsilon is reviewed as a statistical and machine-learning benchmark ensemble. It explains component behavior and disagreement, not causality.",
    }


def copy_public_artifacts(paths: RunPaths) -> None:
    paths.public_model_dir.mkdir(parents=True, exist_ok=True)
    paths.public_pages_dir.mkdir(parents=True, exist_ok=True)
    for file in paths.model_dir.glob("*.json"):
        shutil.copy2(file, paths.public_model_dir / file.name)
    for file in paths.model_dir.glob("*.csv"):
        if file.stat().st_size <= 25 * 1024 * 1024:
            shutil.copy2(file, paths.public_model_dir / file.name)
    page = paths.pages_dir / "page_epsilon_expert_ensemble.json"
    if page.exists():
        shutil.copy2(page, paths.public_pages_dir / "page_epsilon_expert_ensemble.json")


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train Phase 9 Epsilon Expert Ensemble.")
    parser.add_argument("--repo-root", type=str, default=None)
    parser.add_argument("--seed", type=int, default=RANDOM_SEED)
    parser.add_argument("--smoke", action="store_true", help="Fast smoke test with lighter components.")
    parser.add_argument("--skip-arima", action="store_true", help="Skip ARIMA-like statistical component.")
    parser.add_argument("--skip-ets", action="store_true", help="Skip ETS-like statistical component if statsmodels is slow on this machine.")
    parser.add_argument("--no-public-copy", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    set_seed(args.seed)
    repo_root = Path(args.repo_root).resolve() if args.repo_root else detect_repo_root(Path.cwd())
    paths = build_paths(repo_root)
    paths.model_dir.mkdir(parents=True, exist_ok=True)
    paths.pages_dir.mkdir(parents=True, exist_ok=True)
    timeline = Timeline(paths)
    checkpoint = Checkpoint(paths)
    started = utc_now()
    run_id = f"deepml_run_{started.strftime('%Y%m%d_%H%M%S')}_{MODEL_KEY}"

    try:
        timeline.add("phase9_epsilon_expert_ensemble_started", details={"run_id": run_id, "repo_root": str(repo_root)})
        checkpoint.write("started", "running", {"run_id": run_id})

        dep = dependency_precheck()
        write_json(paths.model_dir / "dependency_precheck.json", dep)
        timeline.add("dependency_precheck_completed", details=dep)

        model_feature_plan = read_json(paths.model_feature_plan_path, default={}) or {}
        target_plan = read_json(paths.target_plan_path, default={}) or {}
        mode_status = read_json(paths.mode_status_path, default={}) or {}
        study_context = read_json(paths.study_context_path, default={}) or {}
        factor_state_table = read_json(paths.factor_state_table_path, default={}) or {}
        alpha_summary = read_json(paths.alpha_summary_path, default={}) or {}
        beta_summary = read_json(paths.beta_summary_path, default={}) or {}
        delta_summary = read_json(paths.delta_summary_path, default={}) or {}

        df = load_feature_store(paths)
        date_col = detect_date_column(df)
        df = normalize_dates(df, date_col)
        gold_col = detect_gold_column(df, target_plan)
        df = build_targets(df, gold_col)
        windows = extract_training_windows(target_plan, mode_status)
        split_labels = build_split_labels(df, date_col, windows)

        effective_date = (
            mode_status.get("effective_data_through_date")
            or mode_status.get("effective_model_data_through_date")
            or mode_status.get("official_research_cutoff_date")
        )
        if effective_date:
            before = len(df)
            df = df[pd.to_datetime(df[date_col]) <= pd.Timestamp(effective_date)].reset_index(drop=True)
            split_labels = build_split_labels(df, date_col, windows)
            timeline.add("effective_data_filter_applied", details={"rows_before": before, "rows_after": len(df), "effective_date": effective_date})

        target_log_cols = [f"epsilon_target_log_return_h{h}" for h in HORIZONS]
        target_price_cols = [f"epsilon_target_gold_price_h{h}" for h in HORIZONS]
        feature_cols, excluded_features = choose_feature_columns(df, date_col, gold_col, model_feature_plan)
        if not feature_cols:
            raise ValueError("No usable numeric features detected for Epsilon.")

        valid_mask = valid_origin_mask(df, target_log_cols, gold_col)
        origin_indices = {
            split: np.where(split_labels.eq(split).to_numpy() & valid_mask)[0]
            for split in ["train", "validation", "test"]
        }
        if min(len(v) for v in origin_indices.values()) <= 30:
            raise RuntimeError(f"Insufficient split origins: { {k: len(v) for k, v in origin_indices.items()} }")

        gold = pd.to_numeric(df[gold_col], errors="coerce").to_numpy(dtype=float)
        anchors_by_split = {split: gold[idx] for split, idx in origin_indices.items()}
        actual_prices_by_split = {split: df.loc[idx, target_price_cols].to_numpy(dtype=float) for split, idx in origin_indices.items()}

        naive_metrics_for_sanity = calc_point_metrics(
            anchors_by_split["test"],
            actual_prices_by_split["test"],
            np.repeat(anchors_by_split["test"][:, None], len(HORIZONS), axis=1),
        )
        naive_mape_mean = safe_mean(r.get("mape_pct") for r in naive_metrics_for_sanity.values())
        raw_min = safe_float(np.nanmin(gold))
        raw_max = safe_float(np.nanmax(gold))
        target_min = safe_float(np.nanmin(df[target_price_cols].to_numpy(dtype=float)))
        sanity_checks = {
            "artifact_type": "epsilon_expert_sanity_checks",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "status": "pass",
            "checks": [
                {"name": "raw_origin_gold_min_gt_100", "status": "pass" if raw_min and raw_min > 100 else "fail", "value": raw_min},
                {"name": "raw_origin_gold_max_lt_10000", "status": "pass" if raw_max and raw_max < 10000 else "fail", "value": raw_max},
                {"name": "target_gold_min_gt_100", "status": "pass" if target_min and target_min > 100 else "fail", "value": target_min},
                {"name": "naive_mape_not_near_100pct", "status": "pass" if naive_mape_mean and naive_mape_mean < 50 else "warning", "value": naive_mape_mean},
                {"name": "split_origins_sufficient", "status": "pass", "value": {k: int(len(v)) for k, v in origin_indices.items()}},
                {"name": "raw_price_anchor_preserved", "status": "pass", "value": "anchors are raw gold prices and are not scaled"},
            ],
            "generated_at_utc": iso_utc(),
        }
        if any(c["status"] == "fail" for c in sanity_checks["checks"]):
            sanity_checks["status"] = "fail"
        write_json(paths.model_dir / "sanity_checks.json", sanity_checks)
        timeline.add("sanity_checks_completed", details={"status": sanity_checks["status"]})
        if sanity_checks["status"] == "fail":
            raise RuntimeError("Blocked by failed sanity checks. Review sanity_checks.json.")

        dataset_manifest = {
            "artifact_type": "epsilon_dataset_manifest",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "date_column": date_col,
            "gold_column": gold_col,
            "feature_count": len(feature_cols),
            "features_used": [str(c) for c in feature_cols],
            "excluded_features": excluded_features,
            "horizons": HORIZONS,
            "rows": int(len(df)),
            "split_origin_counts": {k: int(len(v)) for k, v in origin_indices.items()},
            "training_window": windows,
            "feature_store_hash": stable_hash_file(paths.feature_store_path),
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "epsilon_dataset_manifest.json", dataset_manifest)

        # Deterministic benchmark/statistical components.
        timeline.add("benchmark_statistical_components_started")
        component_log_preds: Dict[str, Dict[str, np.ndarray]] = {}
        all_origins_by_split = origin_indices
        component_log_preds["naive_last_value"] = {split: component_naive(gold, idx) for split, idx in all_origins_by_split.items()}
        component_log_preds["drift_252"] = {split: component_drift(gold, idx, 252) for split, idx in all_origins_by_split.items()}
        component_log_preds["rolling_mean_20_gap"] = {split: component_rolling_anchor_gap(gold, idx, 20, "mean") for split, idx in all_origins_by_split.items()}
        component_log_preds["rolling_mean_60_gap"] = {split: component_rolling_anchor_gap(gold, idx, 60, "mean") for split, idx in all_origins_by_split.items()}
        component_log_preds["rolling_median_60_gap"] = {split: component_rolling_anchor_gap(gold, idx, 60, "median") for split, idx in all_origins_by_split.items()}
        component_log_preds["momentum_20"] = {split: component_momentum(gold, idx, 20) for split, idx in all_origins_by_split.items()}
        component_log_preds["theta_like_252"] = {split: component_theta_like(gold, idx, 252) for split, idx in all_origins_by_split.items()}
        if SimpleExpSmoothing is not None and not args.skip_ets:
            max_ets = 80 if args.smoke else 260
            component_log_preds["ets_like"] = {
                split: component_ets_like(gold, idx, max_origins=max_ets)
                for split, idx in all_origins_by_split.items()
            }
        if ARIMA is not None and not args.skip_arima:
            max_arima = 120 if args.smoke else 240
            component_log_preds["arima_like"] = {split: component_arima_like(gold, idx, max_origins=max_arima) for split, idx in all_origins_by_split.items()}
        timeline.add("benchmark_statistical_components_completed", details={"component_count": len(component_log_preds)})

        # ML components.
        timeline.add("ml_components_started")
        ml_preds, ml_log = fit_predict_ml_components(
            df=df,
            feature_cols=feature_cols,
            target_log_cols=target_log_cols,
            split_labels=split_labels,
            origin_indices=origin_indices,
            seed=args.seed,
            smoke=args.smoke,
            paths=paths,
            checkpoint=checkpoint,
        )
        component_log_preds.update(ml_preds)
        timeline.add("ml_components_completed", details={"ml_component_count": len(ml_preds)})

        component_preds = assemble_component_predictions(component_log_preds, anchors_by_split, actual_prices_by_split)
        component_eval = evaluate_components(component_preds)
        write_json(paths.model_dir / "component_evaluation_by_horizon.json", component_eval)

        component_models = {
            "artifact_type": "epsilon_component_models",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "components": [
                {
                    "component_key": comp,
                    "family": "benchmark" if comp in ["naive_last_value", "drift_252", "rolling_mean_20_gap", "rolling_mean_60_gap", "rolling_median_60_gap", "momentum_20"] else ("statistical" if comp in ["theta_like_252", "ets_like", "arima_like"] else "lag_feature_ml"),
                    "status": "completed",
                }
                for comp in component_preds.keys()
            ],
            "ml_training_log": ml_log,
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "component_models.json", component_models)

        component_scores = component_average_mape(component_eval, "validation")
        component_ranking_rows = [
            {
                "rank": rank + 1,
                "component_key": comp,
                "validation_average_mape_pct": score,
                "test_average_mape_pct": safe_mean(row.get("mape_pct") for row in component_eval.get(comp, {}).get("test", {}).values()),
            }
            for rank, (comp, score) in enumerate(sorted(component_scores.items(), key=lambda kv: kv[1]))
        ]
        component_ranking = {
            "artifact_type": "epsilon_component_ranking",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "ranking_basis": "validation_average_mape_pct",
            "ranking": component_ranking_rows,
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "component_ranking.json", component_ranking)

        component_weights = compute_horizon_weights(component_eval)
        weights_artifact = {
            "artifact_type": "epsilon_component_weights",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "method": "horizon_specific_inverse_validation_mape",
            "weights_by_horizon": component_weights,
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "component_weights.json", weights_artifact)

        selected_strategy, ensemble_by_split, ensemble_selection_details = choose_ensemble_strategy(component_preds, component_weights)
        ensemble_eval_by_split = {
            split: calc_point_metrics(payload["anchors"], payload["actual_prices"], payload["pred_prices"])
            for split, payload in ensemble_by_split.items()
        }
        evaluation_by_horizon = {
            "artifact_type": "epsilon_evaluation_by_horizon",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "point_forecast": "ensemble_p50",
            "selected_ensemble_strategy": selected_strategy,
            "train": ensemble_eval_by_split["train"],
            "validation": ensemble_eval_by_split["validation"],
            "test": ensemble_eval_by_split["test"],
            "naive_baseline_test": component_eval.get("naive_last_value", {}).get("test", {}),
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "evaluation_by_horizon.json", evaluation_by_horizon)
        write_json(paths.model_dir / "ensemble_selection_details.json", ensemble_selection_details)

        residual_calibration = derive_residual_interval_calibration(ensemble_by_split)
        write_json(paths.model_dir / "residual_interval_calibration.json", residual_calibration)
        quantile_by_split = {split: apply_residual_intervals(payload, residual_calibration) for split, payload in ensemble_by_split.items()}
        uncertainty_by_split = {
            split: calc_uncertainty_metrics(q["actual_prices"], q["pred_prices_quantiles"], q["anchors"])
            for split, q in quantile_by_split.items()
        }
        uncertainty_latest = {
            "artifact_type": "epsilon_uncertainty_latest",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "method": "validation_residual_empirical_interval_calibration",
            "coverage_target_pct": 80.0,
            "coverage_by_horizon": uncertainty_by_split["test"],
            "validation_coverage_by_horizon": uncertainty_by_split["validation"],
            "residual_interval_calibration": residual_calibration,
            "professor_safe_note": "Epsilon intervals are calibrated from validation residual behavior. They estimate uncertainty but do not guarantee future ranges.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "uncertainty_latest.json", uncertainty_latest)

        # Full professor-style static split forecast path for frontend:
        # train -> validation -> test. This is the main Epsilon page graph source.
        evaluation_rollforward_rows: List[Dict[str, Any]] = []
        for split_name in ["train", "validation", "test"]:
            evaluation_rollforward_rows.extend(
                ensemble_prediction_rows(
                    ensemble_by_split[split_name],
                    quantile_by_split[split_name],
                    split_name,
                    df,
                    date_col,
                    origin_indices[split_name],
                    selected_strategy,
                )
            )

        write_csv_dicts(paths.model_dir / "evaluation_rollforward.csv", evaluation_rollforward_rows)
        write_json(
            paths.model_dir / "evaluation_rollforward_summary.json",
            {
                "artifact_type": "epsilon_evaluation_rollforward_summary",
                "schema_version": "1.0.0",
                "model_key": MODEL_KEY,
                "script_version": SCRIPT_VERSION,
                "purpose": "Frontend-ready static split forecast path for train, validation, and test.",
                "main_frontend_source": "evaluation_rollforward.csv",
                "rows": len(evaluation_rollforward_rows),
                "splits": {
                    "train": int(sum(1 for r in evaluation_rollforward_rows if r.get("split") == "train")),
                    "validation": int(sum(1 for r in evaluation_rollforward_rows if r.get("split") == "validation")),
                    "test": int(sum(1 for r in evaluation_rollforward_rows if r.get("split") == "test")),
                },
                "horizons": HORIZONS,
                "selected_ensemble_strategy": selected_strategy,
                "selected_component_key": ensemble_selection_details.get("selected_component_key"),
                "standard_frontend_fields": [
                    "date",
                    "split",
                    "horizon",
                    "gold_price",
                    "actual_target",
                    "prediction",
                    "naive_prediction",
                    "predicted_log_return",
                    "error",
                ],
                "epsilon_interval_fields": [
                    "forecast_price_p10",
                    "forecast_price_p50",
                    "forecast_price_p90",
                    "interval_width_price",
                ],
                "professor_safe_note": "This artifact supports frontend train/validation/test graphing. Epsilon residual intervals are uncertainty estimates, not guarantees.",
                "generated_at_utc": iso_utc(),
            },
        )

        # Keep original test component and rolling-origin tables for audit/backward compatibility.
        write_csv_dicts(paths.model_dir / "component_forecasts.csv", component_forecast_rows(component_preds, "test", df, date_col, origin_indices["test"]))
        write_csv_dicts(
            paths.model_dir / "rolling_origin_predictions.csv",
            ensemble_prediction_rows(
                ensemble_by_split["test"],
                quantile_by_split["test"],
                "test_rolling_origin",
                df,
                date_col,
                origin_indices["test"],
                selected_strategy,
            ),
        )
        rolling_metrics = {
            "artifact_type": "epsilon_rolling_origin_metrics",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "method_note": "Each test origin is evaluated with the available features and raw price anchor at that origin. Component models are trained on the fixed training split for Phase 9.",
            "metrics_by_horizon": evaluation_by_horizon["test"],
            "origin_count": int(len(origin_indices["test"])),
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "rolling_origin_metrics.json", rolling_metrics)

        expert_disagreement = {
            "artifact_type": "epsilon_expert_disagreement",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "test_disagreement_by_horizon": component_disagreement(component_preds, "test"),
            "validation_disagreement_by_horizon": component_disagreement(component_preds, "validation"),
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "expert_disagreement.json", expert_disagreement)

        latest = latest_forecast_from_components(
            df=df,
            gold_col=gold_col,
            date_col=date_col,
            feature_cols=feature_cols,
            split_labels=split_labels,
            target_log_cols=target_log_cols,
            component_preds=component_preds,
            weights=component_weights,
            selected_strategy=selected_strategy,
            residual_calibration=residual_calibration,
        )
        forecast_latest = {
            "artifact_type": "epsilon_forecast_latest",
            "schema_version": "1.0.0",
            "project": "Gold Nexus Alpha",
            "phase": "phase_2_deep_ml",
            "model_key": MODEL_KEY,
            "model_name": MODEL_NAME,
            "frequency": "trading_day",
            "target": "anchored_future_log_return",
            "forecast_reconstruction": "raw_gold_price_anchor * exp(predicted_log_return)",
            "raw_price_anchor_scaled": False,
            "selected_ensemble_strategy": selected_strategy,
            "latest_origin": {
                "origin_index": latest["origin_index"],
                "origin_date": latest["origin_date"],
                "raw_gold_price_anchor": latest["raw_gold_price_anchor"],
            },
            "path": latest["path"],
            "generated_at_utc": iso_utc(),
            "generated_at_local": local_iso_from_utc(),
        }
        write_json(paths.model_dir / "forecast_latest.json", forecast_latest)
        write_json(paths.model_dir / "ensemble_forecast.json", forecast_latest)

        interpretability_latest = {
            "artifact_type": "epsilon_interpretability_latest",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "methods": [
                "component_ranking",
                "horizon_specific_component_weights",
                "expert_disagreement",
                "ensemble_vs_naive_comparison",
            ],
            "selected_ensemble_strategy": selected_strategy,
            "top_components_by_validation": component_ranking_rows[:10],
            "weights_by_horizon": component_weights,
            "expert_disagreement": expert_disagreement,
            "professor_safe_note": "Epsilon interpretability explains component behavior, weighting, and disagreement. It does not identify causal drivers of gold prices.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "interpretability_latest.json", interpretability_latest)

        component_diagnostics = {
            "artifact_type": "epsilon_component_diagnostics",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "component_count": len(component_preds),
            "component_keys": list(component_preds.keys()),
            "selected_ensemble_strategy": selected_strategy,
            "component_training_log": ml_log,
            "dependency_precheck": dep,
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "component_diagnostics.json", component_diagnostics)

        diagnostics_latest = {
            "artifact_type": "epsilon_diagnostics_latest",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "selected_ensemble_strategy": selected_strategy,
            "component_count": len(component_preds),
            "component_keys": list(component_preds.keys()),
            "split_origin_counts": {k: int(len(v)) for k, v in origin_indices.items()},
            "raw_price_anchor_scaled": False,
            "rolling_origin_metrics_exported": True,
            "static_metrics_exported": True,
            "evaluation_rollforward_exported": True,
            "evaluation_rollforward_contract": {
                "main_frontend_source": "evaluation_rollforward.csv",
                "splits": ["train", "validation", "test"],
                "fields": [
                    "date",
                    "split",
                    "horizon",
                    "gold_price",
                    "actual_target",
                    "prediction",
                    "naive_prediction",
                    "predicted_log_return",
                    "error",
                    "forecast_price_p10",
                    "forecast_price_p50",
                    "forecast_price_p90",
                    "interval_width_price",
                    "selected_ensemble_strategy",
                ],
            },
            "uncertainty_calibration_exported": True,
            "notes": [
                "Epsilon is a benchmark and expert-ensemble layer, not a causal model.",
                "Raw gold anchors are preserved unscaled for forecast reconstruction and metrics.",
                "Component weights are horizon-specific and based on validation performance.",
                "Residual intervals are calibrated from validation residual behavior.",
            ],
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "diagnostics_latest.json", diagnostics_latest)

        run_summary = {
            "artifact_type": "deep_ml_model_run",
            "schema_version": "1.0.0",
            "project": "Gold Nexus Alpha",
            "phase": "phase_2_deep_ml",
            "model_key": MODEL_KEY,
            "model_name": MODEL_NAME,
            "family": MODEL_FAMILY,
            "status": "completed_pending_quality_review",
            "run": {
                "run_id": run_id,
                "study_id": study_context.get("study_id") or mode_status.get("study_id"),
                "generated_at_utc": iso_utc(started),
                "completed_at_utc": iso_utc(),
                "generated_at_local": local_iso_from_utc(started),
                "timezone_local": TIMEZONE_LOCAL,
                "git_commit_sha": get_git_commit(repo_root),
                "code_version": SCRIPT_VERSION,
                "python_version": sys.version,
            },
            "data_signature": {
                "feature_store_path": str(paths.feature_store_path.relative_to(repo_root)) if paths.feature_store_path.exists() else str(paths.feature_store_path),
                "feature_store_hash": stable_hash_file(paths.feature_store_path),
                "model_feature_plan_hash": stable_hash_file(paths.model_feature_plan_path),
                "target_plan_hash": stable_hash_file(paths.target_plan_path),
                "factor_state_table_hash": stable_hash_file(paths.factor_state_table_path),
                "effective_data_through_date": effective_date,
                "forecast_start_date": mode_status.get("forecast_start_date"),
            },
            "model": {
                "target": "anchored_future_log_return",
                "forecast_reconstruction": "raw_gold_price_anchor * exp(predicted_log_return)",
                "horizons": HORIZONS,
                "training_window": windows,
                "component_count": len(component_preds),
                "selected_ensemble_strategy": selected_strategy,
                "uncertainty_method": "validation_residual_empirical_interval_calibration",
            },
            "features": {
                "used_count": len(feature_cols),
                "used": [str(c) for c in feature_cols],
                "excluded": excluded_features,
            },
            "professor_safe_summary": (
                "Epsilon Expert Ensemble is a rigorous statistical and machine-learning benchmark layer. "
                "It compares classical benchmarks, statistical models, lag-feature ML components, and ensemble combinations under the shared Deep ML artifact contract."
            ),
            "ai_grounding": {
                "allowed_claims": [
                    "Epsilon compares benchmark, statistical, and lag-feature ML components.",
                    "Epsilon component weights are based on validation performance and are horizon-specific.",
                    "Epsilon residual intervals estimate uncertainty but do not guarantee future prices.",
                    "Epsilon explains component behavior and disagreement, not causality.",
                ],
                "forbidden_claims": [
                    "Epsilon proves causal drivers of gold prices.",
                    "Epsilon guarantees future price ranges.",
                    "Epsilon is the final Deep ML winner before Omega Fusion and final evaluation.",
                ],
                "source_artifacts": [
                    "run_summary.json",
                    "forecast_latest.json",
                    "evaluation_by_horizon.json",
                    "uncertainty_latest.json",
                    "interpretability_latest.json",
                    "diagnostics_latest.json",
                    "component_ranking.json",
                    "component_weights.json",
                ],
            },
        }
        write_json(paths.model_dir / "run_summary.json", run_summary)

        required_common = [
            paths.model_dir / "run_summary.json",
            paths.model_dir / "forecast_latest.json",
            paths.model_dir / "evaluation_by_horizon.json",
            paths.model_dir / "uncertainty_latest.json",
            paths.model_dir / "interpretability_latest.json",
            paths.model_dir / "diagnostics_latest.json",
        ]
        quality_review = build_quality_review(sanity_checks, evaluation_by_horizon, component_eval, uncertainty_latest, required_common)
        write_json(paths.model_dir / "quality_review.json", quality_review)

        page_bundle = {
            "artifact_type": "deep_ml_page_bundle",
            "schema_version": "1.0.0",
            "page_key": "page_epsilon_expert_ensemble",
            "route": "/deep-ml/models/epsilon-expert-ensemble",
            "title": "Epsilon Expert Ensemble",
            "subtitle": "Statistical and machine-learning benchmark ensemble for Gold Nexus Alpha Phase 2.",
            "model_key": MODEL_KEY,
            "status": quality_review["status"],
            "summary_cards": [
                {"label": "Components", "value": len(component_preds)},
                {"label": "Selected Ensemble", "value": selected_strategy},
                {"label": "Uncertainty", "value": "Validation residual intervals"},
                {"label": "Horizons", "value": ", ".join(str(h) for h in HORIZONS)},
            ],
            "chart_artifacts": {
                "evaluation_rollforward": "artifacts/deep_ml/models/epsilon_expert_ensemble/evaluation_rollforward.csv",
                "evaluation_rollforward_summary": "artifacts/deep_ml/models/epsilon_expert_ensemble/evaluation_rollforward_summary.json",
                "rolling_origin_predictions": "artifacts/deep_ml/models/epsilon_expert_ensemble/rolling_origin_predictions.csv",
                "forecast_latest": "artifacts/deep_ml/models/epsilon_expert_ensemble/forecast_latest.json",
                "evaluation_by_horizon": "artifacts/deep_ml/models/epsilon_expert_ensemble/evaluation_by_horizon.json",
                "uncertainty_latest": "artifacts/deep_ml/models/epsilon_expert_ensemble/uncertainty_latest.json",
                "component_ranking": "artifacts/deep_ml/models/epsilon_expert_ensemble/component_ranking.json",
                "component_weights": "artifacts/deep_ml/models/epsilon_expert_ensemble/component_weights.json",
                "expert_disagreement": "artifacts/deep_ml/models/epsilon_expert_ensemble/expert_disagreement.json",
            },
            "limitations": [
                "Epsilon is a benchmark and ensemble expert, not the final Deep ML winner until Omega Fusion and evaluation are complete.",
                "Residual intervals are uncertainty estimates, not guarantees.",
                "Component weights explain model behavior and validation performance, not causality.",
            ],
            "source_artifacts": [p.name for p in required_common]
            + [
                "component_models.json",
                "evaluation_rollforward.csv",
                "evaluation_rollforward_summary.json",
                "component_evaluation_by_horizon.json",
                "component_ranking.json",
                "component_weights.json",
                "expert_disagreement.json",
                "residual_interval_calibration.json",
                "quality_review.json",
                "phase9_epsilon_expert_report.json",
            ],
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "page_bundle.json", page_bundle)
        write_json(paths.pages_dir / "page_epsilon_expert_ensemble.json", page_bundle)

        phase_report = {
            "artifact_type": "phase9_epsilon_expert_report",
            "schema_version": "1.0.0",
            "project": "Gold Nexus Alpha",
            "phase": "Phase 9 — Epsilon Expert Ensemble",
            "model_key": MODEL_KEY,
            "model_name": MODEL_NAME,
            "status": quality_review["status"],
            "accepted_previous_checkpoints": {
                "alpha_structural_v4": {"status": "accepted", "source_status": alpha_summary.get("status") or "read_if_available"},
                "beta_temporal_v2": {"status": "accepted", "source_status": beta_summary.get("status") or "read_if_available"},
                "delta_tft_v2": {"status": "accepted", "source_status": delta_summary.get("status") or "read_if_available"},
            },
            "run_summary": run_summary,
            "sanity_checks": sanity_checks,
            "component_summary": {
                "component_count": len(component_preds),
                "component_keys": list(component_preds.keys()),
                "selected_ensemble_strategy": selected_strategy,
                "top_components_by_validation": component_ranking_rows[:10],
                "weights_by_horizon": component_weights,
            },
            "evaluation_snapshot": {
                "test_by_horizon": evaluation_by_horizon.get("test", {}),
                "naive_baseline_test": evaluation_by_horizon.get("naive_baseline_test", {}),
                "ensemble_selection_details": ensemble_selection_details,
            },
            "uncertainty_snapshot": uncertainty_latest,
            "interpretability_snapshot": interpretability_latest,
            "quality_review": quality_review,
            "required_common_artifacts": [p.name for p in required_common],
            "required_epsilon_specific_artifacts": [
                "component_models.json",
                "evaluation_rollforward.csv",
                "evaluation_rollforward_summary.json",
                "component_forecasts.csv",
                "component_evaluation_by_horizon.json",
                "component_ranking.json",
                "component_weights.json",
                "ensemble_forecast.json",
                "expert_disagreement.json",
                "residual_interval_calibration.json",
                "rolling_origin_predictions.csv",
                "rolling_origin_metrics.json",
                "component_diagnostics.json",
                "quality_review.json",
                "timeline.json",
                "progress_checkpoint.json",
            ],
            "professor_safe_summary": (
                "Phase 9 Epsilon Expert Ensemble provides a rigorous benchmark and ensemble guardrail. "
                "V2 compares ensemble candidates against the best validation component so the final Epsilon output does not ignore a stronger benchmark component. "
                "It evaluates classical, statistical, and lag-feature ML components under the same horizon-level contract used by Alpha, Beta, and Delta."
            ),
            "final_instruction": "Send me artifacts/deep_ml/models/epsilon_expert_ensemble/phase9_epsilon_expert_report.json for review before moving to Gamma or Omega.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "phase9_epsilon_expert_report.json", phase_report)

        if not args.no_public_copy:
            copy_public_artifacts(paths)
            timeline.add("public_artifacts_copied")

        checkpoint.write(
            "completed",
            quality_review["status"],
            {
                "phase_report": "artifacts/deep_ml/models/epsilon_expert_ensemble/phase9_epsilon_expert_report.json",
                "send_me_this_json": "artifacts/deep_ml/models/epsilon_expert_ensemble/phase9_epsilon_expert_report.json",
            },
        )
        timeline.add("phase9_epsilon_expert_ensemble_completed", status=quality_review["status"])
        print("\n" + "=" * 88)
        print("PHASE 9 EPSILON EXPERT ENSEMBLE COMPLETE")
        print("Review this JSON before moving forward:")
        print("artifacts/deep_ml/models/epsilon_expert_ensemble/phase9_epsilon_expert_report.json")
        print("=" * 88 + "\n")

    except Exception as exc:
        error_payload = {
            "artifact_type": "phase9_epsilon_expert_error_report",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "status": "failed",
            "error": repr(exc),
            "traceback": traceback.format_exc(),
            "generated_at_utc": iso_utc(),
            "final_instruction": "Fix the blocking issue, rerun Phase 9, then send me phase9_epsilon_expert_report.json if created.",
        }
        write_json(paths.model_dir / "phase9_epsilon_expert_report.json", error_payload)
        write_json(
            paths.model_dir / "quality_review.json",
            {
                "artifact_type": "deep_ml_quality_review",
                "model_key": MODEL_KEY,
                "status": "failed_quality_gate",
                "blocking_flags": [repr(exc)],
                "generated_at_utc": iso_utc(),
            },
        )
        checkpoint.write("failed", "failed", {"error": repr(exc)})
        timeline.add("phase9_epsilon_expert_ensemble_failed", status="failed", details={"error": repr(exc)})
        print("\nPHASE 9 EPSILON FAILED. Review:")
        print("artifacts/deep_ml/models/epsilon_expert_ensemble/phase9_epsilon_expert_report.json")
        raise


if __name__ == "__main__":
    main()
