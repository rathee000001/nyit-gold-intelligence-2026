from __future__ import annotations

import json
import math
import os
import platform
import subprocess
import time
import warnings
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error

warnings.filterwarnings("ignore")

try:
    from tqdm import tqdm
except Exception:
    tqdm = None

try:
    import optuna
except Exception as exc:
    optuna = None
    OPTUNA_IMPORT_ERROR = str(exc)
else:
    OPTUNA_IMPORT_ERROR = None

try:
    import xgboost as xgb
    from xgboost import XGBRegressor
except Exception as exc:
    xgb = None
    XGBRegressor = None
    XGBOOST_IMPORT_ERROR = str(exc)
else:
    XGBOOST_IMPORT_ERROR = None

try:
    import shap
except Exception as exc:
    shap = None
    SHAP_IMPORT_ERROR = str(exc)
else:
    SHAP_IMPORT_ERROR = None


# =========================================================
# CONFIG
# =========================================================

MODEL_KEY = "alpha_structural"
MODEL_NAME = "Alpha Structural Expert"
MODEL_VERSION = "alpha_structural_v4_consistent_timed_xgboost_optuna_rolling_shap"
MODEL_FAMILY = "xgboost_optuna_anchored_return_rolling_shap"

RANDOM_SEED = 2026
HORIZONS = [1, 5, 10, 20, 30]

# Heavy but safer than the previous run that froze near trial 149.
# Increase through env later after this stable version passes.
N_TRIALS_PER_HORIZON = int(os.getenv("ALPHA_OPTUNA_TRIALS", "120"))
MAX_ESTIMATORS = int(os.getenv("ALPHA_MAX_ESTIMATORS", "1200"))
EARLY_STOPPING_ROUNDS = int(os.getenv("ALPHA_EARLY_STOPPING_ROUNDS", "75"))

# Progress checkpoint frequency.
TRIAL_CHECKPOINT_EVERY = int(os.getenv("ALPHA_TRIAL_CHECKPOINT_EVERY", "1"))

# Rolling-origin settings.
# Horizon 1 uses refit every origin by default. Other horizons refit every N origins.
ROLLING_MAX_ORIGINS_PER_HORIZON = int(os.getenv("ALPHA_ROLLING_MAX_ORIGINS", "900"))
ROLLING_REFIT_EVERY_N_MULTI_HORIZON = int(os.getenv("ALPHA_ROLLING_REFIT_EVERY_N_MULTI", "20"))

# SHAP settings.
SHAP_SAMPLE_ROWS = int(os.getenv("ALPHA_SHAP_SAMPLE_ROWS", "400"))
SHAP_TOP_N = int(os.getenv("ALPHA_SHAP_TOP_N", "25"))

# Quality thresholds for flags.
MAPE_CAUTION_THRESHOLD = float(os.getenv("ALPHA_MAPE_CAUTION", "20"))
BIAS_CAUTION_DOLLARS = float(os.getenv("ALPHA_BIAS_CAUTION_DOLLARS", "250"))
DIRECTIONAL_ACCURACY_MIN = float(os.getenv("ALPHA_DIRECTIONAL_MIN", "50"))


# =========================================================
# PATHS + GENERAL HELPERS
# =========================================================

def now_utc_dt() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def utc_now_iso() -> str:
    return now_utc_dt().isoformat().replace("+00:00", "Z")


def find_repo_root(start: Path | None = None) -> Path:
    current = (start or Path.cwd()).resolve()
    for parent in [current, *current.parents]:
        if (parent / ".git").exists() or (parent / "package.json").exists():
            return parent
    return current


REPO_ROOT = find_repo_root()
ARTIFACT_ROOT = REPO_ROOT / "artifacts" / "deep_ml"
PUBLIC_ARTIFACT_ROOT = REPO_ROOT / "public" / "artifacts" / "deep_ml"


def to_json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): to_json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [to_json_safe(v) for v in value]
    if isinstance(value, tuple):
        return [to_json_safe(v) for v in value]
    if isinstance(value, np.ndarray):
        return [to_json_safe(v) for v in value.tolist()]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        val = float(value)
        if math.isnan(val) or math.isinf(val):
            return None
        return val
    if isinstance(value, pd.Timestamp):
        return value.strftime("%Y-%m-%d")
    if value is pd.NaT:
        return None
    try:
        if pd.isna(value) and not isinstance(value, (dict, list, tuple)):
            return None
    except Exception:
        pass
    return value


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Missing required artifact: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, obj: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(to_json_safe(obj), indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[WRITE] {path}")


def mirror_json(relative_path: str, obj: dict[str, Any]) -> None:
    write_json(ARTIFACT_ROOT / relative_path, obj)
    write_json(PUBLIC_ARTIFACT_ROOT / relative_path, obj)


def write_csv(relative_path: str, df: pd.DataFrame) -> None:
    out1 = ARTIFACT_ROOT / relative_path
    out2 = PUBLIC_ARTIFACT_ROOT / relative_path
    out1.parent.mkdir(parents=True, exist_ok=True)
    out2.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out1, index=False)
    df.to_csv(out2, index=False)
    print(f"[WRITE] {out1}")
    print(f"[WRITE] {out2}")


def run_git_commit_sha() -> str | None:
    try:
        completed = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if completed.returncode == 0:
            return completed.stdout.strip()
    except Exception:
        pass
    return None


def format_seconds(seconds: float) -> str:
    seconds = int(seconds)
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def next_weekdays(start_date: str, count: int) -> list[str]:
    dt = datetime.strptime(start_date, "%Y-%m-%d").date()
    out: list[str] = []
    while len(out) < count:
        dt = dt + timedelta(days=1)
        if dt.weekday() < 5:
            out.append(dt.isoformat())
    return out


# =========================================================
# RUN LOGGER
# =========================================================

class RunLogger:
    def __init__(self, run_id: str):
        self.run_id = run_id
        self.start_monotonic = time.monotonic()
        self.events: list[dict[str, Any]] = []
        self.stage_start: dict[str, float] = {}

    def elapsed(self) -> float:
        return time.monotonic() - self.start_monotonic

    def log(self, stage: str, message: str, extra: dict[str, Any] | None = None) -> None:
        event = {
            "timestamp_utc": utc_now_iso(),
            "elapsed_seconds": round(self.elapsed(), 3),
            "elapsed_hms": format_seconds(self.elapsed()),
            "stage": stage,
            "message": message,
            "extra": extra or {},
        }
        self.events.append(event)
        print(f"[{event['timestamp_utc']}] [{event['elapsed_hms']}] [{stage}] {message}")
        self.write_timeline()

    def start_stage(self, stage: str, message: str) -> None:
        self.stage_start[stage] = time.monotonic()
        self.log(stage, f"START — {message}")

    def end_stage(self, stage: str, message: str) -> None:
        stage_elapsed = time.monotonic() - self.stage_start.get(stage, time.monotonic())
        self.log(stage, f"END — {message}", {"stage_elapsed_hms": format_seconds(stage_elapsed)})

    def write_timeline(self) -> None:
        payload = {
            "artifact_type": "deep_ml_alpha_timeline",
            "schema_version": "1.0.0",
            "generated_at_utc": utc_now_iso(),
            "run_id": self.run_id,
            "model_key": MODEL_KEY,
            "model_version": MODEL_VERSION,
            "elapsed_seconds": round(self.elapsed(), 3),
            "elapsed_hms": format_seconds(self.elapsed()),
            "events": self.events,
        }
        mirror_json(f"models/{MODEL_KEY}/timeline.json", payload)


def write_progress_checkpoint(
    logger: RunLogger,
    status: str,
    stage: str,
    horizon: int | None,
    completed_trials: int | None,
    total_trials: int | None,
    extra: dict[str, Any] | None = None,
) -> None:
    pct = None
    if completed_trials is not None and total_trials:
        pct = round((completed_trials / total_trials) * 100, 2)

    payload = {
        "artifact_type": "deep_ml_alpha_progress_checkpoint",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "status": status,
        "stage": stage,
        "run_id": logger.run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "horizon": horizon,
        "completed_trials": completed_trials,
        "total_trials": total_trials,
        "percent_complete": pct,
        "elapsed_seconds": round(logger.elapsed(), 3),
        "elapsed_hms": format_seconds(logger.elapsed()),
        "extra": extra or {},
    }
    mirror_json(f"models/{MODEL_KEY}/progress_checkpoint.json", payload)


# =========================================================
# ENVIRONMENT HELPERS
# =========================================================

def detect_torch_cuda() -> dict[str, Any]:
    try:
        import torch
    except Exception as exc:
        return {"torch_installed": False, "cuda_available": False, "error": str(exc)}

    cuda_available = bool(torch.cuda.is_available())
    return {
        "torch_installed": True,
        "torch_version": getattr(torch, "__version__", None),
        "cuda_available": cuda_available,
        "device_name": torch.cuda.get_device_name(0) if cuda_available else None,
        "cuda_version": getattr(torch.version, "cuda", None),
    }


def tiny_gpu_test() -> dict[str, Any]:
    if XGBRegressor is None:
        return {"gpu_requested": False, "gpu_usable": False, "reason": "xgboost not installed"}

    rng = np.random.RandomState(RANDOM_SEED)
    X = rng.normal(size=(200, 8))
    y = rng.normal(size=200)

    params = {
        "objective": "reg:squarederror",
        "eval_metric": "rmse",
        "n_estimators": 20,
        "max_depth": 2,
        "learning_rate": 0.1,
        "tree_method": "hist",
        "device": "cuda",
        "random_state": RANDOM_SEED,
        "verbosity": 0,
        "n_jobs": 4,
    }

    try:
        model = XGBRegressor(**params)
        model.fit(X, y, verbose=False)
        return {"gpu_requested": True, "gpu_usable": True, "reason": "tiny XGBoost CUDA fit succeeded"}
    except Exception as exc:
        return {"gpu_requested": True, "gpu_usable": False, "reason": str(exc)}


# =========================================================
# INPUT LOADING
# =========================================================

def load_inputs(logger: RunLogger) -> dict[str, Any]:
    logger.start_stage("load_inputs", "Loading governance, feature, and numeric feature-store artifacts")

    mode_status = read_json(ARTIFACT_ROOT / "governance" / "deep_ml_mode_status.json")
    study_context = read_json(ARTIFACT_ROOT / "governance" / "study_context.json")
    model_feature_plan = read_json(ARTIFACT_ROOT / "features" / "model_feature_plan.json")
    target_plan = read_json(ARTIFACT_ROOT / "features" / "target_plan.json")
    numeric_manifest = read_json(ARTIFACT_ROOT / "features" / "deep_ml_numeric_feature_store_manifest.json")

    feature_store_path = ARTIFACT_ROOT / "features" / "deep_ml_numeric_feature_store.parquet"
    if not feature_store_path.exists():
        raise FileNotFoundError("Run Phase 5 first. Missing deep_ml_numeric_feature_store.parquet")

    df = pd.read_parquet(feature_store_path)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    logger.end_stage("load_inputs", f"Loaded numeric feature store with {len(df)} rows and {len(df.columns)} columns")

    return {
        "mode_status": mode_status,
        "study_context": study_context,
        "model_feature_plan": model_feature_plan,
        "target_plan": target_plan,
        "numeric_manifest": numeric_manifest,
        "df": df,
    }


# =========================================================
# METRICS
# =========================================================

def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(mean_squared_error(y_true, y_pred)))


def mape(y_true: np.ndarray, y_pred: np.ndarray) -> float | None:
    mask = y_true != 0
    if mask.sum() == 0:
        return None
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)


def smape(y_true: np.ndarray, y_pred: np.ndarray) -> float | None:
    denom = (np.abs(y_true) + np.abs(y_pred)) / 2
    mask = denom != 0
    if mask.sum() == 0:
        return None
    return float(np.mean(np.abs(y_pred[mask] - y_true[mask]) / denom[mask]) * 100)


def directional_accuracy(current_gold: np.ndarray, y_true: np.ndarray, y_pred: np.ndarray) -> float | None:
    true_dir = np.sign(y_true - current_gold)
    pred_dir = np.sign(y_pred - current_gold)
    mask = true_dir != 0
    if mask.sum() == 0:
        return None
    return float(np.mean(true_dir[mask] == pred_dir[mask]) * 100)


def metric_bundle(eval_df: pd.DataFrame, y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, Any]:
    if len(y_true) == 0:
        return {
            "n": 0,
            "mae": None,
            "rmse": None,
            "mape": None,
            "smape": None,
            "bias_mean_error": None,
            "directional_accuracy": None,
        }

    current_gold = eval_df["gold_price"].to_numpy(dtype=float)
    errors = y_pred - y_true

    return {
        "n": int(len(y_true)),
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": rmse(y_true, y_pred),
        "mape": mape(y_true, y_pred),
        "smape": smape(y_true, y_pred),
        "bias_mean_error": float(np.mean(errors)),
        "directional_accuracy": directional_accuracy(current_gold, y_true, y_pred),
    }


def baseline_metrics(eval_df: pd.DataFrame, y_true: np.ndarray, horizon: int) -> dict[str, Any]:
    current_gold = eval_df["gold_price"].to_numpy(dtype=float)
    naive_pred = current_gold.copy()

    momentum_col = "gold_return_5" if horizon <= 5 else "gold_return_20"
    if momentum_col in eval_df.columns:
        past_ret = eval_df[momentum_col].fillna(0).to_numpy(dtype=float)
        momentum_pred = current_gold * (1 + past_ret)
    else:
        momentum_pred = naive_pred.copy()

    return {
        "naive_current_price": metric_bundle(eval_df, y_true, naive_pred),
        "simple_momentum": metric_bundle(eval_df, y_true, momentum_pred),
    }


def improvement_vs_naive(model_metrics: dict[str, Any], naive_metrics: dict[str, Any]) -> dict[str, Any]:
    out = {}
    for metric in ["mae", "rmse", "mape", "smape"]:
        model_val = model_metrics.get(metric)
        naive_val = naive_metrics.get(metric)
        if model_val is None or naive_val is None or naive_val == 0:
            out[f"{metric}_improvement_pct_vs_naive"] = None
        else:
            out[f"{metric}_improvement_pct_vs_naive"] = float(((naive_val - model_val) / naive_val) * 100)
    return out


# =========================================================
# FEATURES + TARGETS
# =========================================================

def enrich_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy().sort_values("date").reset_index(drop=True)

    df["alpha_time_index"] = np.arange(len(df), dtype=float)
    df["alpha_year"] = df["date"].dt.year.astype(float)
    df["alpha_month"] = df["date"].dt.month.astype(float)
    df["alpha_quarter"] = df["date"].dt.quarter.astype(float)
    df["alpha_day_of_year_sin"] = np.sin(2 * np.pi * df["date"].dt.dayofyear / 365.25)
    df["alpha_day_of_year_cos"] = np.cos(2 * np.pi * df["date"].dt.dayofyear / 365.25)

    df["gold_log_price"] = np.log(df["gold_price"].replace(0, np.nan))
    df["gold_return_20"] = df["gold_price"].pct_change(20)
    df["gold_return_60"] = df["gold_price"].pct_change(60)

    if "gold_ma_20" in df.columns:
        df["gold_ma_ratio_20"] = df["gold_price"] / df["gold_ma_20"] - 1.0
    else:
        df["gold_ma_ratio_20"] = np.nan

    if "gold_ma_60" in df.columns:
        df["gold_ma_ratio_60"] = df["gold_price"] / df["gold_ma_60"] - 1.0
    else:
        df["gold_ma_ratio_60"] = np.nan

    rolling_252_max = df["gold_price"].rolling(252, min_periods=60).max()
    df["gold_drawdown_252"] = df["gold_price"] / rolling_252_max - 1.0

    factor_cols = [
        "m2_supply", "fed_bs", "gld_tonnes", "usd_index", "vix_index", "oil_wti",
        "real_yield", "nominal_yield", "fin_stress", "gpr_index", "policy_unc",
        "jpy_usd", "eur_usd", "ppi_index", "unrate", "ind_prod", "cap_util",
    ]

    for col in factor_cols:
        if col in df.columns:
            df[f"{col}_chg_5"] = df[col].diff(5)
            df[f"{col}_chg_20"] = df[col].diff(20)
            roll = df[col].rolling(60, min_periods=20)
            df[f"{col}_z60"] = (df[col] - roll.mean()) / roll.std().replace(0, np.nan)

    return df


def add_targets(df: pd.DataFrame, horizons: list[int]) -> pd.DataFrame:
    df = df.copy()
    for h in horizons:
        price_col = f"target_gold_t_plus_{h}"
        logret_col = f"target_log_return_t_plus_{h}"
        if price_col not in df.columns:
            df[price_col] = df["gold_price"].shift(-h)
        df[logret_col] = np.log(df[price_col] / df["gold_price"])
    return df


def choose_features(df: pd.DataFrame, model_feature_plan: dict[str, Any]) -> list[str]:
    planned = (
        model_feature_plan
        .get("model_feature_sets", {})
        .get(MODEL_KEY, {})
        .get("all_features", [])
    )

    forbidden_exact = {"date", "split", "gold_price", "high_yield"}
    forbidden_prefixes = ["target_"]

    extras_prefixes = [
        "alpha_",
        "gold_log_price",
        "gold_ma_ratio_",
        "gold_return_20",
        "gold_return_60",
        "gold_drawdown_252",
    ]
    extras_suffixes = ["_chg_5", "_chg_20", "_z60"]

    features = []

    for col in planned:
        if col in df.columns and col not in forbidden_exact:
            if not any(str(col).startswith(prefix) for prefix in forbidden_prefixes):
                if pd.api.types.is_numeric_dtype(df[col]):
                    features.append(col)

    for col in df.columns:
        if col in forbidden_exact:
            continue
        if any(str(col).startswith(prefix) for prefix in forbidden_prefixes):
            continue
        if not pd.api.types.is_numeric_dtype(df[col]):
            continue
        if any(str(col).startswith(prefix) for prefix in extras_prefixes) or any(str(col).endswith(suffix) for suffix in extras_suffixes):
            features.append(col)

    clean = []
    seen = set()
    for f in features:
        if f not in seen:
            seen.add(f)
            clean.append(f)

    return clean


# =========================================================
# XGBOOST TRAINING
# =========================================================

def base_params(use_gpu: bool, random_state: int) -> dict[str, Any]:
    params = {
        "objective": "reg:squarederror",
        "eval_metric": "rmse",
        "random_state": random_state,
        "verbosity": 0,
        "n_jobs": 4,
        "tree_method": "hist",
    }
    if use_gpu:
        params["device"] = "cuda"
    return params


def suggest_params(trial: Any, use_gpu: bool, random_state: int) -> dict[str, Any]:
    params = base_params(use_gpu, random_state)
    params.update({
        "n_estimators": trial.suggest_int("n_estimators", 250, MAX_ESTIMATORS),
        "max_depth": trial.suggest_int("max_depth", 2, 8),
        "learning_rate": trial.suggest_float("learning_rate", 0.004, 0.12, log=True),
        "subsample": trial.suggest_float("subsample", 0.60, 1.00),
        "colsample_bytree": trial.suggest_float("colsample_bytree", 0.55, 1.00),
        "min_child_weight": trial.suggest_float("min_child_weight", 1.0, 30.0, log=True),
        "reg_alpha": trial.suggest_float("reg_alpha", 1e-8, 10.0, log=True),
        "reg_lambda": trial.suggest_float("reg_lambda", 1e-4, 50.0, log=True),
        "gamma": trial.suggest_float("gamma", 0.0, 8.0),
        "max_delta_step": trial.suggest_float("max_delta_step", 0.0, 8.0),
        "max_bin": trial.suggest_categorical("max_bin", [128, 256, 512]),
    })
    return params


def fit_xgb(model: Any, X_train: np.ndarray, y_train: np.ndarray, X_val: np.ndarray | None = None, y_val: np.ndarray | None = None) -> Any:
    if X_val is not None and y_val is not None and len(y_val):
        try:
            model.fit(
                X_train,
                y_train,
                eval_set=[(X_val, y_val)],
                verbose=False,
                early_stopping_rounds=EARLY_STOPPING_ROUNDS,
            )
            return model
        except TypeError:
            pass
    model.fit(X_train, y_train, verbose=False)
    return model


def prepare_split(df: pd.DataFrame, features: list[str], horizon: int) -> dict[str, Any]:
    price_col = f"target_gold_t_plus_{horizon}"
    ret_col = f"target_log_return_t_plus_{horizon}"

    usable = df.dropna(subset=[price_col, ret_col]).copy()

    train_df = usable[usable["split"] == "train"].copy()
    val_df = usable[usable["split"] == "validation"].copy()
    test_df = usable[usable["split"] == "test"].copy()

    imputer = SimpleImputer(strategy="median")
    X_train = imputer.fit_transform(train_df[features])
    X_val = imputer.transform(val_df[features]) if len(val_df) else np.empty((0, len(features)))
    X_test = imputer.transform(test_df[features]) if len(test_df) else np.empty((0, len(features)))

    return {
        "price_col": price_col,
        "ret_col": ret_col,
        "imputer": imputer,
        "train_df": train_df,
        "val_df": val_df,
        "test_df": test_df,
        "X_train": X_train,
        "X_val": X_val,
        "X_test": X_test,
        "y_train_return": train_df[ret_col].to_numpy(dtype=float),
        "y_val_return": val_df[ret_col].to_numpy(dtype=float) if len(val_df) else np.array([]),
        "y_test_return": test_df[ret_col].to_numpy(dtype=float) if len(test_df) else np.array([]),
        "y_train_price": train_df[price_col].to_numpy(dtype=float),
        "y_val_price": val_df[price_col].to_numpy(dtype=float) if len(val_df) else np.array([]),
        "y_test_price": test_df[price_col].to_numpy(dtype=float) if len(test_df) else np.array([]),
    }


def pred_return_to_price(eval_df: pd.DataFrame, pred_return: np.ndarray) -> np.ndarray:
    pred_return = np.clip(pred_return, -0.50, 0.50)
    return eval_df["gold_price"].to_numpy(dtype=float) * np.exp(pred_return)


def objective_score(eval_df: pd.DataFrame, y_true_price: np.ndarray, pred_price: np.ndarray) -> float:
    r = rmse(y_true_price, pred_price)
    b = abs(float(np.mean(pred_price - y_true_price)))
    mp = mape(y_true_price, pred_price) or 0.0
    return float(r + 0.35 * b + 0.05 * mp)


def run_optuna(
    logger: RunLogger,
    split: dict[str, Any],
    horizon: int,
    use_gpu: bool,
) -> dict[str, Any]:
    stage = f"optuna_h{horizon}"
    logger.start_stage(stage, f"Optuna study for horizon {horizon}")

    X_train = split["X_train"]
    y_train = split["y_train_return"]
    X_val = split["X_val"]
    y_val = split["y_val_return"]
    val_df = split["val_df"]
    y_val_price = split["y_val_price"]

    if len(y_val) == 0:
        cut = int(len(y_train) * 0.85)
        X_train_fit, y_train_fit = X_train[:cut], y_train[:cut]
        X_val_fit, y_val_fit = X_train[cut:], y_train[cut:]
        val_eval_df = split["train_df"].iloc[cut:].copy()
        y_val_fit_price = val_eval_df[split["price_col"]].to_numpy(dtype=float)
    else:
        X_train_fit, y_train_fit = X_train, y_train
        X_val_fit, y_val_fit = X_val, y_val
        val_eval_df = val_df
        y_val_fit_price = y_val_price

    trial_rows: list[dict[str, Any]] = []

    progress = tqdm(total=N_TRIALS_PER_HORIZON, desc=f"Alpha Optuna h={horizon}", unit="trial") if tqdm else None

    def objective(trial: Any) -> float:
        params = suggest_params(trial, use_gpu, RANDOM_SEED + horizon)
        model = XGBRegressor(**params)
        model = fit_xgb(model, X_train_fit, y_train_fit, X_val_fit, y_val_fit)
        pred_ret = model.predict(X_val_fit)
        pred_price = pred_return_to_price(val_eval_df, pred_ret)
        return objective_score(val_eval_df, y_val_fit_price, pred_price)

    def callback(study: Any, trial: Any) -> None:
        row = {
            "horizon": horizon,
            "trial_number": trial.number,
            "value": trial.value,
            "state": str(trial.state),
            "timestamp_utc": utc_now_iso(),
            "elapsed_hms": format_seconds(logger.elapsed()),
        }
        row.update({f"param_{k}": v for k, v in trial.params.items()})
        trial_rows.append(row)

        if progress:
            progress.update(1)
            if study.best_value is not None:
                progress.set_postfix(best=f"{study.best_value:.4f}")

        if (trial.number + 1) % TRIAL_CHECKPOINT_EVERY == 0:
            write_progress_checkpoint(
                logger=logger,
                status="running",
                stage=stage,
                horizon=horizon,
                completed_trials=trial.number + 1,
                total_trials=N_TRIALS_PER_HORIZON,
                extra={
                    "current_trial_value": trial.value,
                    "best_value": study.best_value,
                    "best_params": study.best_params,
                },
            )
            write_csv(f"models/{MODEL_KEY}/optuna_trials_partial_h{horizon}.csv", pd.DataFrame(trial_rows))

    sampler = optuna.samplers.TPESampler(seed=RANDOM_SEED + horizon)
    study = optuna.create_study(direction="minimize", sampler=sampler)

    study.optimize(
        objective,
        n_trials=N_TRIALS_PER_HORIZON,
        callbacks=[callback],
        show_progress_bar=False,
        gc_after_trial=True,
        catch=(Exception,),
    )

    if progress:
        progress.close()

    logger.end_stage(stage, f"Optuna complete for horizon {horizon}; best={study.best_value:.4f}")

    return {
        "best_params": study.best_params,
        "best_value": float(study.best_value),
        "trial_rows": trial_rows,
    }


def train_final(split: dict[str, Any], horizon: int, params: dict[str, Any], use_gpu: bool, include_validation: bool) -> Any:
    final_params = base_params(use_gpu, RANDOM_SEED + horizon)
    final_params.update(params)

    model = XGBRegressor(**final_params)

    if include_validation and len(split["y_val_return"]):
        X_fit = np.vstack([split["X_train"], split["X_val"]])
        y_fit = np.concatenate([split["y_train_return"], split["y_val_return"]])
        return fit_xgb(model, X_fit, y_fit)

    return fit_xgb(model, split["X_train"], split["y_train_return"], split["X_val"], split["y_val_return"])


def predict_static(model: Any, split: dict[str, Any], horizon: int) -> dict[str, Any]:
    metrics = {}
    baseline = {}
    frames = []

    for name, eval_df, X, y_price in [
        ("train", split["train_df"], split["X_train"], split["y_train_price"]),
        ("validation", split["val_df"], split["X_val"], split["y_val_price"]),
        ("test", split["test_df"], split["X_test"], split["y_test_price"]),
    ]:
        if len(eval_df) == 0:
            metrics[name] = metric_bundle(eval_df, np.array([]), np.array([]))
            baseline[name] = {}
            continue

        pred_ret = model.predict(X)
        pred_price = pred_return_to_price(eval_df, pred_ret)

        metrics[name] = metric_bundle(eval_df, y_price, pred_price)
        baseline[name] = baseline_metrics(eval_df, y_price, horizon)

        frames.append(pd.DataFrame({
            "date": eval_df["date"].dt.strftime("%Y-%m-%d"),
            "split": name,
            "horizon": horizon,
            "gold_price": eval_df["gold_price"].to_numpy(dtype=float),
            "actual_target": y_price,
            "predicted_log_return": pred_ret,
            "prediction": pred_price,
            "naive_prediction": eval_df["gold_price"].to_numpy(dtype=float),
            "error": pred_price - y_price,
        }))

    return {
        "metrics": metrics,
        "baseline": baseline,
        "predictions": pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(),
    }


def residual_interval(model: Any, split: dict[str, Any]) -> dict[str, Any]:
    if len(split["val_df"]) == 0:
        return {"method": "validation_price_residual_quantiles", "q10_residual": None, "q90_residual": None, "residual_std": None}

    pred_ret = model.predict(split["X_val"])
    pred_price = pred_return_to_price(split["val_df"], pred_ret)
    resid = split["y_val_price"] - pred_price

    return {
        "method": "validation_price_residual_quantiles",
        "q10_residual": float(np.quantile(resid, 0.10)),
        "q90_residual": float(np.quantile(resid, 0.90)),
        "residual_std": float(np.std(resid)),
    }


def latest_forecast(df: pd.DataFrame, features: list[str], imputer: SimpleImputer, model: Any, horizon: int, interval: dict[str, Any]) -> dict[str, Any]:
    latest = df.tail(1).copy()
    origin_date = latest["date"].iloc[0].strftime("%Y-%m-%d")
    origin_gold = float(latest["gold_price"].iloc[0])

    X = imputer.transform(latest[features])
    pred_ret = float(np.clip(model.predict(X)[0], -0.50, 0.50))
    p50 = float(origin_gold * np.exp(pred_ret))

    q10 = interval.get("q10_residual")
    q90 = interval.get("q90_residual")

    return {
        "origin_date": origin_date,
        "origin_gold_price": origin_gold,
        "horizon_trading_days": horizon,
        "predicted_log_return": pred_ret,
        "predicted_return_pct": float((np.exp(pred_ret) - 1) * 100),
        "p10": float(p50 + q10) if q10 is not None else None,
        "p50": p50,
        "p90": float(p50 + q90) if q90 is not None else None,
        "expected_change": float(p50 - origin_gold),
        "expected_change_pct": float(((p50 / origin_gold) - 1) * 100),
    }


def gain_importance(model: Any, features: list[str]) -> list[dict[str, Any]]:
    booster = model.get_booster()
    raw = booster.get_score(importance_type="gain")

    rows = []
    for i, feature in enumerate(features):
        score = float(raw.get(feature, raw.get(f"f{i}", 0.0)))
        rows.append({"feature": feature, "importance": score, "importance_type": "gain"})

    rows = sorted(rows, key=lambda x: x["importance"], reverse=True)
    total = sum(r["importance"] for r in rows)

    for row in rows:
        row["importance_pct"] = float((row["importance"] / total) * 100) if total else 0.0

    return rows


def aggregate_importance(all_importance: dict[int, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    bucket: dict[str, list[float]] = {}

    for rows in all_importance.values():
        for row in rows:
            bucket.setdefault(row["feature"], []).append(float(row["importance_pct"]))

    out = []
    for feature, vals in bucket.items():
        out.append({
            "feature": feature,
            "mean_importance_pct": float(np.mean(vals)),
            "max_importance_pct": float(np.max(vals)),
            "horizon_count": len(vals),
        })

    return sorted(out, key=lambda x: x["mean_importance_pct"], reverse=True)


# =========================================================
# ROLLING ORIGIN
# =========================================================

def rolling_origin(
    logger: RunLogger,
    df: pd.DataFrame,
    features: list[str],
    horizon: int,
    best_params: dict[str, Any],
    use_gpu: bool,
) -> dict[str, Any]:
    stage = f"rolling_h{horizon}"
    logger.start_stage(stage, f"Rolling-origin evaluation for horizon {horizon}")

    price_col = f"target_gold_t_plus_{horizon}"
    ret_col = f"target_log_return_t_plus_{horizon}"

    usable = df.dropna(subset=[price_col, ret_col]).copy()
    origins = usable[usable["split"] == "test"].copy().sort_values("date")

    if len(origins) > ROLLING_MAX_ORIGINS_PER_HORIZON:
        origins = origins.tail(ROLLING_MAX_ORIGINS_PER_HORIZON).copy()

    refit_every = 1 if horizon == 1 else ROLLING_REFIT_EVERY_N_MULTI_HORIZON

    rows = []
    cached_model = None
    cached_imputer = None

    iterator = tqdm(list(enumerate(origins.iterrows())), desc=f"Alpha rolling h={horizon}", unit="origin") if tqdm else list(enumerate(origins.iterrows()))

    for count, (_, origin_row) in iterator:
        origin_date = origin_row["date"]
        train_df = usable[usable["date"] < origin_date].copy()

        if len(train_df) < 500:
            continue

        if cached_model is None or count % refit_every == 0:
            imputer = SimpleImputer(strategy="median")
            X_train = imputer.fit_transform(train_df[features])
            y_train = train_df[ret_col].to_numpy(dtype=float)

            params = base_params(use_gpu, RANDOM_SEED + horizon)
            params.update(best_params)

            model = XGBRegressor(**params)
            model = fit_xgb(model, X_train, y_train)

            cached_model = model
            cached_imputer = imputer

        origin_df = pd.DataFrame([origin_row])
        X_origin = cached_imputer.transform(origin_df[features])
        pred_ret = cached_model.predict(X_origin)
        pred_price = pred_return_to_price(origin_df, pred_ret)[0]

        actual_price = float(origin_row[price_col])
        current_gold = float(origin_row["gold_price"])

        rows.append({
            "origin_date": origin_date.strftime("%Y-%m-%d"),
            "horizon": horizon,
            "current_gold_price": current_gold,
            "actual_target_price": actual_price,
            "predicted_log_return": float(pred_ret[0]),
            "predicted_price": float(pred_price),
            "naive_prediction": current_gold,
            "error": float(pred_price - actual_price),
            "naive_error": float(current_gold - actual_price),
            "train_rows_used": int(len(train_df)),
            "refit_every_n_origins": refit_every,
        })

    pred_df = pd.DataFrame(rows)

    if len(pred_df):
        eval_df = pd.DataFrame({"gold_price": pred_df["current_gold_price"].to_numpy(dtype=float)})
        y_true = pred_df["actual_target_price"].to_numpy(dtype=float)
        y_pred = pred_df["predicted_price"].to_numpy(dtype=float)
        y_naive = pred_df["naive_prediction"].to_numpy(dtype=float)

        metrics = metric_bundle(eval_df, y_true, y_pred)
        naive = metric_bundle(eval_df, y_true, y_naive)
        improvement = improvement_vs_naive(metrics, naive)
    else:
        metrics = metric_bundle(pd.DataFrame(), np.array([]), np.array([]))
        naive = {}
        improvement = {}

    logger.end_stage(stage, f"Rolling complete for horizon {horizon}; rows={len(pred_df)}")

    return {
        "prediction_rows": pred_df,
        "metrics": metrics,
        "naive_metrics": naive,
        "improvement_vs_naive": improvement,
        "rolling_config": {
            "max_origins": ROLLING_MAX_ORIGINS_PER_HORIZON,
            "refit_every_n_origins": refit_every,
            "horizon_1_full_refit": True,
        },
    }


# =========================================================
# SHAP
# =========================================================

def compute_shap(
    logger: RunLogger,
    df: pd.DataFrame,
    features: list[str],
    models: dict[int, Any],
    imputers: dict[int, SimpleImputer],
) -> dict[str, Any]:
    logger.start_stage("shap", "Computing SHAP explanations")

    if shap is None:
        payload = {
            "shap_available": False,
            "error": SHAP_IMPORT_ERROR,
            "global_importance_rows": [],
            "latest_explanations": {},
            "top_features_by_horizon": {},
        }
        logger.end_stage("shap", "SHAP unavailable")
        return payload

    sample_df = df[df["split"].isin(["validation", "test"])].tail(SHAP_SAMPLE_ROWS).copy()
    if len(sample_df) == 0:
        sample_df = df.tail(SHAP_SAMPLE_ROWS).copy()

    latest_df = df.tail(1).copy()

    global_rows = []
    latest_explanations = {}
    by_horizon = {}

    for horizon, model in models.items():
        try:
            imputer = imputers[horizon]
            X_sample = imputer.transform(sample_df[features])
            X_latest = imputer.transform(latest_df[features])

            explainer = shap.TreeExplainer(model)
            values = np.array(explainer.shap_values(X_sample))
            latest_values = np.array(explainer.shap_values(X_latest)).reshape(-1)

            mean_abs = np.mean(np.abs(values), axis=0)

            rows = []
            for feature, val in zip(features, mean_abs):
                rows.append({
                    "horizon": horizon,
                    "feature": feature,
                    "mean_abs_shap": float(val),
                })

            rows = sorted(rows, key=lambda x: x["mean_abs_shap"], reverse=True)
            by_horizon[str(horizon)] = rows[:SHAP_TOP_N]
            global_rows.extend(rows)

            latest_rows = []
            for feature, val in zip(features, latest_values):
                latest_rows.append({
                    "feature": feature,
                    "shap_value": float(val),
                    "direction": "pushes_forecast_up" if val > 0 else "pushes_forecast_down" if val < 0 else "neutral",
                })

            latest_rows = sorted(latest_rows, key=lambda x: abs(x["shap_value"]), reverse=True)

            latest_explanations[str(horizon)] = {
                "horizon": horizon,
                "origin_date": latest_df["date"].iloc[0].strftime("%Y-%m-%d"),
                "top_local_drivers": latest_rows[:SHAP_TOP_N],
                "note": "SHAP explains predicted log-return output, not direct causality.",
            }

        except Exception as exc:
            by_horizon[str(horizon)] = []
            latest_explanations[str(horizon)] = {"horizon": horizon, "error": str(exc)}

    if global_rows:
        global_df = pd.DataFrame(global_rows)
        agg = (
            global_df.groupby("feature", as_index=False)["mean_abs_shap"]
            .mean()
            .rename(columns={"mean_abs_shap": "mean_abs_shap_across_horizons"})
            .sort_values("mean_abs_shap_across_horizons", ascending=False)
        )
        global_importance = agg.to_dict(orient="records")
    else:
        global_importance = []

    logger.end_stage("shap", "SHAP computation complete")

    return {
        "shap_available": True,
        "error": None,
        "global_importance_rows": global_importance,
        "latest_explanations": latest_explanations,
        "top_features_by_horizon": by_horizon,
        "summary": {
            "method": "shap_tree_explainer",
            "sample_rows": int(len(sample_df)),
            "note": "SHAP values explain XGBoost log-return predictions."
        }
    }


# =========================================================
# QUALITY
# =========================================================

def build_quality_flags(static_test: dict[str, Any], rolling: dict[str, Any]) -> tuple[str, list[dict[str, Any]]]:
    flags = []

    for h, metrics in static_test.items():
        if metrics.get("mape") is not None and metrics["mape"] > MAPE_CAUTION_THRESHOLD:
            flags.append({"scope": "static_test", "horizon": h, "metric": "mape", "value": metrics["mape"], "severity": "caution"})
        if metrics.get("bias_mean_error") is not None and abs(metrics["bias_mean_error"]) > BIAS_CAUTION_DOLLARS:
            flags.append({"scope": "static_test", "horizon": h, "metric": "bias", "value": metrics["bias_mean_error"], "severity": "caution"})
        if metrics.get("directional_accuracy") is not None and metrics["directional_accuracy"] < DIRECTIONAL_ACCURACY_MIN:
            flags.append({"scope": "static_test", "horizon": h, "metric": "directional_accuracy", "value": metrics["directional_accuracy"], "severity": "caution"})

    for h, payload in rolling.items():
        metrics = payload.get("metrics", {})
        if metrics.get("mape") is not None and metrics["mape"] > MAPE_CAUTION_THRESHOLD:
            flags.append({"scope": "rolling_origin", "horizon": h, "metric": "mape", "value": metrics["mape"], "severity": "caution"})
        if metrics.get("directional_accuracy") is not None and metrics["directional_accuracy"] < DIRECTIONAL_ACCURACY_MIN:
            flags.append({"scope": "rolling_origin", "horizon": h, "metric": "directional_accuracy", "value": metrics["directional_accuracy"], "severity": "caution"})

    return ("ready" if not flags else "ready_quality_review_required"), flags


# =========================================================
# MAIN
# =========================================================

def main() -> int:
    generated_at_utc = utc_now_iso()

    pre_run_id = f"deepml_run_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{MODEL_KEY}_starting"
    logger = RunLogger(pre_run_id)

    logger.log("startup", "Phase 6 Alpha V4 started", {
        "model_version": MODEL_VERSION,
        "n_trials_per_horizon": N_TRIALS_PER_HORIZON,
        "max_estimators": MAX_ESTIMATORS,
        "rolling_max_origins": ROLLING_MAX_ORIGINS_PER_HORIZON,
    })

    if XGBOOST_IMPORT_ERROR or OPTUNA_IMPORT_ERROR:
        report = {
            "artifact_type": "deep_ml_phase6_alpha_structural_report",
            "schema_version": "1.0.0",
            "generated_at_utc": generated_at_utc,
            "status": "blocked",
            "reason": "Missing required packages.",
            "xgboost_import_error": XGBOOST_IMPORT_ERROR,
            "optuna_import_error": OPTUNA_IMPORT_ERROR,
            "shap_import_error": SHAP_IMPORT_ERROR,
            "install_command": "py -m pip install tqdm xgboost optuna shap",
            "next_step": "Install packages and rerun Phase 6."
        }
        mirror_json(f"models/{MODEL_KEY}/phase6_alpha_structural_report.json", report)
        print(json.dumps(report, indent=2))
        return 1

    inputs = load_inputs(logger)

    mode_status = inputs["mode_status"]
    study_context = inputs["study_context"]
    model_feature_plan = inputs["model_feature_plan"]
    target_plan = inputs["target_plan"]
    numeric_manifest = inputs["numeric_manifest"]

    mode = mode_status["mode"]
    study_id = study_context["study_id"]
    run_batch_id = study_context["run_batch_id"]
    effective_date = mode_status["effective_model_data_through_date"]
    forecast_start_date = mode_status["forecast_start_date"]
    horizons = [int(h) for h in target_plan.get("horizons_trading_days", HORIZONS)]

    run_id = f"deepml_run_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{MODEL_KEY}_{mode}_{effective_date.replace('-', '')}"
    logger.run_id = run_id

    torch_cuda = detect_torch_cuda()
    gpu_test = tiny_gpu_test()
    use_gpu = bool(gpu_test.get("gpu_usable"))
    compute_device = "xgboost_cuda" if use_gpu else "xgboost_cpu_fallback"

    logger.log("environment", "Compute environment checked", {
        "compute_device": compute_device,
        "gpu_test": gpu_test,
        "torch_cuda": torch_cuda,
    })

    logger.start_stage("feature_engineering", "Enriching features and targets")
    df = enrich_features(inputs["df"])
    df = add_targets(df, horizons)
    features = choose_features(df, model_feature_plan)
    logger.end_stage("feature_engineering", f"Feature set ready with {len(features)} features")

    if not features:
        report = {
            "artifact_type": "deep_ml_phase6_alpha_structural_report",
            "schema_version": "1.0.0",
            "generated_at_utc": utc_now_iso(),
            "status": "blocked",
            "reason": "No usable Alpha features found.",
            "next_step": "Send feature_manifest.json and model_feature_plan.json."
        }
        mirror_json(f"models/{MODEL_KEY}/phase6_alpha_structural_report.json", report)
        print(json.dumps(report, indent=2))
        return 1

    all_results = []
    all_trials = []
    static_frames = []
    rolling_frames = []
    gain_by_horizon = {}
    best_params_by_horizon = {}
    optuna_summary = {}
    rolling_by_horizon = {}
    models_for_shap = {}
    imputers_for_shap = {}

    horizon_iterator = tqdm(horizons, desc="Alpha horizons", unit="horizon") if tqdm else horizons

    for horizon in horizon_iterator:
        logger.log("horizon", f"Starting horizon {horizon}", {"horizon": horizon})

        split = prepare_split(df, features, horizon)

        optuna_result = run_optuna(logger, split, horizon, use_gpu)
        best_params = optuna_result["best_params"]
        all_trials.extend(optuna_result["trial_rows"])
        best_params_by_horizon[str(horizon)] = best_params

        eval_model = train_final(split, horizon, best_params, use_gpu, include_validation=False)
        forecast_model = train_final(split, horizon, best_params, use_gpu, include_validation=True)

        static = predict_static(eval_model, split, horizon)
        interval = residual_interval(eval_model, split)
        forecast = latest_forecast(df, features, split["imputer"], forecast_model, horizon, interval)
        gain = gain_importance(eval_model, features)

        rolling = rolling_origin(logger, df, features, horizon, best_params, use_gpu)

        if not static["predictions"].empty:
            static_frames.append(static["predictions"])

        if not rolling["prediction_rows"].empty:
            rolling_frames.append(rolling["prediction_rows"])

        gain_by_horizon[horizon] = gain
        rolling_by_horizon[str(horizon)] = {
            "metrics": rolling["metrics"],
            "naive_metrics": rolling["naive_metrics"],
            "improvement_vs_naive": rolling["improvement_vs_naive"],
            "prediction_count": int(len(rolling["prediction_rows"])),
            "rolling_config": rolling["rolling_config"],
        }

        models_for_shap[horizon] = eval_model
        imputers_for_shap[horizon] = split["imputer"]

        test_metrics = static["metrics"].get("test", {})
        naive_test = static["baseline"].get("test", {}).get("naive_current_price", {})
        test_improvement = improvement_vs_naive(test_metrics, naive_test)

        all_results.append({
            "horizon": horizon,
            "metrics": static["metrics"],
            "baseline_metrics": static["baseline"],
            "test_improvement_vs_naive": test_improvement,
            "latest_forecast": forecast,
            "residual_interval": interval,
            "feature_importance": gain,
            "best_value_objective": optuna_result["best_value"],
        })

        optuna_summary[str(horizon)] = {
            "best_value_objective": optuna_result["best_value"],
            "best_params": best_params,
            "trial_count": N_TRIALS_PER_HORIZON,
            "compute_device": compute_device,
            "target_strategy": "anchored_future_log_return",
        }

        write_progress_checkpoint(
            logger=logger,
            status="horizon_complete",
            stage="horizon",
            horizon=horizon,
            completed_trials=N_TRIALS_PER_HORIZON,
            total_trials=N_TRIALS_PER_HORIZON,
            extra={"test_metrics": test_metrics, "rolling_metrics": rolling_by_horizon[str(horizon)]["metrics"]},
        )

    if all_trials:
        write_csv(f"models/{MODEL_KEY}/optuna_trials.csv", pd.DataFrame(all_trials))

    if static_frames:
        static_predictions = pd.concat(static_frames, ignore_index=True)
        write_csv(f"models/{MODEL_KEY}/evaluation_rollforward.csv", static_predictions)
    else:
        static_predictions = pd.DataFrame()

    if rolling_frames:
        rolling_predictions = pd.concat(rolling_frames, ignore_index=True)
        write_csv(f"models/{MODEL_KEY}/rolling_origin_predictions.csv", rolling_predictions)
    else:
        rolling_predictions = pd.DataFrame()

    aggregate_gain = aggregate_importance(gain_by_horizon)

    shap_payload = compute_shap(logger, df, features, models_for_shap, imputers_for_shap)

    if shap_payload.get("global_importance_rows"):
        write_csv(f"models/{MODEL_KEY}/shap_global_importance.csv", pd.DataFrame(shap_payload["global_importance_rows"]))

    max_horizon = max(horizons)
    future_dates = next_weekdays(effective_date, max_horizon)

    forecast_points = []
    p10_path = []
    p50_path = []
    p90_path = []

    for res in all_results:
        h = int(res["horizon"])
        f = res["latest_forecast"]
        forecast_date = future_dates[h - 1] if h - 1 < len(future_dates) else None

        point = {
            "horizon": h,
            "forecast_date": forecast_date,
            "origin_date": f["origin_date"],
            "origin_gold_price": f["origin_gold_price"],
            "predicted_log_return": f["predicted_log_return"],
            "predicted_return_pct": f["predicted_return_pct"],
            "p10": f["p10"],
            "p50": f["p50"],
            "p90": f["p90"],
            "expected_change": f["expected_change"],
            "expected_change_pct": f["expected_change_pct"],
        }
        forecast_points.append(point)
        p10_path.append({"date": forecast_date, "value": f["p10"], "horizon": h})
        p50_path.append({"date": forecast_date, "value": f["p50"], "horizon": h})
        p90_path.append({"date": forecast_date, "value": f["p90"], "horizon": h})

    test_metrics_by_horizon = {str(r["horizon"]): r["metrics"].get("test") for r in all_results}
    quality_status, quality_flags = build_quality_flags(test_metrics_by_horizon, rolling_by_horizon)

    evaluation_by_horizon = {
        "artifact_type": "deep_ml_alpha_evaluation_by_horizon",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_batch_id": run_batch_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "metrics_by_horizon": {str(r["horizon"]): r["metrics"] for r in all_results},
        "baseline_metrics_by_horizon": {str(r["horizon"]): r["baseline_metrics"] for r in all_results},
        "test_improvement_vs_naive_by_horizon": {str(r["horizon"]): r["test_improvement_vs_naive"] for r in all_results},
        "rolling_origin_by_horizon": rolling_by_horizon,
    }

    rolling_origin_metrics = {
        "artifact_type": "deep_ml_alpha_rolling_origin_metrics",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_batch_id": run_batch_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "rolling_by_horizon": rolling_by_horizon,
        "professor_safe_summary": "Rolling-origin metrics evaluate Alpha using expanding information available before each forecast origin."
    }

    rolling_vs_static = {
        "artifact_type": "deep_ml_alpha_rolling_origin_vs_static_split",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_id": run_id,
        "comparison_by_horizon": {
            str(r["horizon"]): {
                "static_test_metrics": r["metrics"].get("test"),
                "rolling_origin_metrics": rolling_by_horizon.get(str(r["horizon"]), {}).get("metrics"),
                "rolling_origin_naive_metrics": rolling_by_horizon.get(str(r["horizon"]), {}).get("naive_metrics"),
                "rolling_origin_improvement_vs_naive": rolling_by_horizon.get(str(r["horizon"]), {}).get("improvement_vs_naive"),
            }
            for r in all_results
        }
    }

    forecast_latest = {
        "artifact_type": "deep_ml_alpha_forecast_latest",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_batch_id": run_batch_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "effective_data_through_date": effective_date,
        "forecast_start_date": forecast_start_date,
        "forecast_points": forecast_points,
        "professor_safe_summary": "Alpha V4 is an anchored-return XGBoost + Optuna structural expert with rolling-origin validation and SHAP."
    }

    uncertainty_latest = {
        "artifact_type": "deep_ml_alpha_uncertainty_latest",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "method": "validation_price_residual_quantiles",
        "p10_path": p10_path,
        "p50_path": p50_path,
        "p90_path": p90_path,
        "coverage_target": 0.8,
    }

    optuna_study_summary = {
        "artifact_type": "deep_ml_alpha_optuna_study_summary",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "n_trials_per_horizon": N_TRIALS_PER_HORIZON,
        "max_estimators": MAX_ESTIMATORS,
        "early_stopping_rounds": EARLY_STOPPING_ROUNDS,
        "compute_device": compute_device,
        "gpu_test": gpu_test,
        "torch_cuda": torch_cuda,
        "summary_by_horizon": optuna_summary,
    }

    best_params_artifact = {
        "artifact_type": "deep_ml_alpha_best_params_by_horizon",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "best_params_by_horizon": {str(h): optuna_summary[str(h)]["best_params"] for h in horizons},
    }

    interpretability_latest = {
        "artifact_type": "deep_ml_alpha_interpretability_latest",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "methods": ["xgboost_gain_importance", "shap_tree_explainer"],
        "xgboost_gain_importance": {
            "feature_importance": aggregate_gain,
            "top_10_features": aggregate_gain[:10],
            "importance_by_horizon": {str(h): rows[:25] for h, rows in gain_by_horizon.items()},
        },
        "shap": {
            "shap_available": shap_payload.get("shap_available"),
            "summary": shap_payload.get("summary", {}),
            "global_importance_top_25": shap_payload.get("global_importance_rows", [])[:25],
            "top_features_by_horizon": shap_payload.get("top_features_by_horizon", {}),
            "latest_explanations": shap_payload.get("latest_explanations", {}),
            "error": shap_payload.get("error"),
        },
    }

    shap_summary = {
        "artifact_type": "deep_ml_alpha_shap_summary",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "shap_available": shap_payload.get("shap_available"),
        "summary": shap_payload.get("summary", {}),
        "top_global_features": shap_payload.get("global_importance_rows", [])[:25],
        "top_features_by_horizon": shap_payload.get("top_features_by_horizon", {}),
        "error": shap_payload.get("error"),
    }

    shap_latest = {
        "artifact_type": "deep_ml_alpha_shap_latest_forecast_explanation",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "latest_explanations_by_horizon": shap_payload.get("latest_explanations", {}),
        "note": "SHAP explains predicted log-return output; it is interpretability, not causality."
    }

    diagnostics_latest = {
        "artifact_type": "deep_ml_alpha_diagnostics_latest",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "selected_feature_count": len(features),
        "selected_features": features,
        "horizons": horizons,
        "n_trials_per_horizon": N_TRIALS_PER_HORIZON,
        "compute_device": compute_device,
        "gpu_test": gpu_test,
        "torch_cuda": torch_cuda,
        "shap_available": shap_payload.get("shap_available"),
        "quality_status": quality_status,
        "quality_flags": quality_flags,
        "has_static_prediction_table": not static_predictions.empty,
        "has_rolling_prediction_table": not rolling_predictions.empty,
        "runtime_elapsed_seconds": round(logger.elapsed(), 3),
        "runtime_elapsed_hms": format_seconds(logger.elapsed()),
        "xgboost_version": getattr(xgb, "__version__", None),
        "optuna_version": getattr(optuna, "__version__", None),
        "shap_version": getattr(shap, "__version__", None) if shap is not None else None,
    }

    run_summary = {
        "artifact_type": "deep_ml_model_run",
        "schema_version": "1.0.0",
        "project": "Gold Nexus Alpha",
        "phase": "phase_2_deep_ml",
        "mode": {
            "name": mode,
            "display_label": "Official Research Mode" if mode == "official_research_mode" else "Live Market Update Mode",
            "official_research_cutoff_date": mode_status["official_research_cutoff_date"],
            "live_mode": mode == "live_market_update_mode"
        },
        "run": {
            "study_id": study_id,
            "run_id": run_id,
            "generated_at_utc": generated_at_utc,
            "generated_at_local": None,
            "timezone_local": "America/New_York",
            "git_commit_sha": run_git_commit_sha(),
            "code_version": MODEL_VERSION,
            "python_version": platform.python_version(),
            "cuda_available": bool(gpu_test.get("gpu_usable")),
            "device": compute_device,
            "runtime_elapsed_seconds": round(logger.elapsed(), 3),
            "runtime_elapsed_hms": format_seconds(logger.elapsed()),
        },
        "data_signature": {
            "matrix_snapshot_id": numeric_manifest.get("selected_input_relative_path", "unknown_matrix"),
            "matrix_name": numeric_manifest.get("selected_input_relative_path"),
            "effective_data_through_date": effective_date,
            "forecast_start_date": forecast_start_date,
            "matrix_row_count": numeric_manifest.get("feature_store", {}).get("row_count"),
            "matrix_hash": "sha256:not_computed_phase6_v4",
            "feature_hash": numeric_manifest.get("feature_hash", "sha256:not_available"),
            "factor_state_table_hash": "sha256:not_computed_phase6_v4",
        },
        "model": {
            "model_key": MODEL_KEY,
            "model_name": MODEL_NAME,
            "family": MODEL_FAMILY,
            "target": "gold_price",
            "horizons": horizons,
            "algorithm": "xgboost_regressor_with_optuna",
            "target_strategy": "anchored_future_log_return",
            "validation_methods": ["static_split", "rolling_origin"],
            "interpretability_methods": ["xgboost_gain_importance", "shap_tree_explainer"],
        },
        "features": {
            "used": features,
            "excluded": ["gold_price", "high_yield", "target_*", "date", "split"],
            "stale_or_carried": [],
            "feature_groups": {"alpha_feature_count": len(features)},
        },
        "forecast": {"frequency": "trading_day", "horizon_trading_days": max(horizons), "path": forecast_points},
        "uncertainty": {
            "method": "validation_price_residual_quantiles",
            "p10_path": p10_path,
            "p50_path": p50_path,
            "p90_path": p90_path,
            "coverage_target": 0.8,
        },
        "evaluation": {
            "by_horizon": evaluation_by_horizon["metrics_by_horizon"],
            "baseline_metrics_by_horizon": evaluation_by_horizon["baseline_metrics_by_horizon"],
            "test_improvement_vs_naive_by_horizon": evaluation_by_horizon["test_improvement_vs_naive_by_horizon"],
            "rolling_origin_by_horizon": rolling_by_horizon,
        },
        "interpretability": {
            "methods": ["xgboost_gain_importance", "shap_tree_explainer"],
            "top_features": aggregate_gain[:25],
            "shap_top_global_features": shap_payload.get("global_importance_rows", [])[:25],
        },
        "diagnostics": diagnostics_latest,
        "limitations": [
            "Alpha V4 is one expert, not the final Deep ML winner.",
            "SHAP explains model output, not causality.",
            "Rolling-origin validation is included, but final acceptance depends on JSON review.",
            "Do not compare to the baseline Final Forecast unless a formal bridge artifact is created."
        ],
        "professor_safe_summary": "Alpha V4 uses anchored-return XGBoost + Optuna with timestamped progress, rolling-origin validation, and SHAP interpretation.",
        "ai_grounding": {
            "allowed_claims": [
                "Alpha V4 uses XGBoost + Optuna.",
                "Alpha V4 includes rolling-origin validation.",
                "Alpha V4 includes SHAP interpretation.",
                "Alpha V4 predicts future log returns and converts them into anchored price forecasts."
            ],
            "forbidden_claims": [
                "Do not claim Alpha is the final Deep ML winner.",
                "Do not claim SHAP proves causality.",
                "Do not claim Deep ML beats baseline from Alpha alone."
            ],
            "source_artifacts": [
                "artifacts/deep_ml/models/alpha_structural/run_summary.json",
                "artifacts/deep_ml/models/alpha_structural/evaluation_by_horizon.json",
                "artifacts/deep_ml/models/alpha_structural/rolling_origin_metrics.json",
                "artifacts/deep_ml/models/alpha_structural/shap_summary.json",
                "artifacts/deep_ml/models/alpha_structural/quality_review.json"
            ]
        }
    }

    page_bundle = {
        "artifact_type": "deep_ml_page_bundle",
        "schema_version": "1.0.0",
        "page_id": "alpha_structural",
        "page_title": "Alpha Structural Expert",
        "page_subtitle": "Anchored-return XGBoost + Optuna with rolling-origin validation, SHAP, and timestamped run lineage.",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_id": run_id,
        "effective_data_through_date": effective_date,
        "forecast_start_date": forecast_start_date,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "quality_status": quality_status,
        "quality_flags": quality_flags,
        "kpi_cards": [
            {"label": "Features Used", "value": len(features), "note": "Feature contract plus Alpha engineered features."},
            {"label": "Optuna Trials / Horizon", "value": N_TRIALS_PER_HORIZON, "note": "Each horizon tuned separately."},
            {"label": "Rolling-Origin", "value": "Included", "note": "Horizon 1 refits every origin; others use periodic refit."},
            {"label": "SHAP", "value": "Included" if shap_payload.get("shap_available") else "Unavailable", "note": "XGBoost log-return interpretation."}
        ],
        "charts": [
            {"chart_id": "alpha_forecast_path", "source_artifact": "artifacts/deep_ml/models/alpha_structural/forecast_latest.json", "type": "forecast_path_with_intervals"},
            {"chart_id": "alpha_static_metrics", "source_artifact": "artifacts/deep_ml/models/alpha_structural/evaluation_by_horizon.json", "type": "metrics_table"},
            {"chart_id": "alpha_rolling_metrics", "source_artifact": "artifacts/deep_ml/models/alpha_structural/rolling_origin_metrics.json", "type": "metrics_table"},
            {"chart_id": "alpha_shap", "source_artifact": "artifacts/deep_ml/models/alpha_structural/shap_summary.json", "type": "bar_chart"}
        ],
        "allowed_frontend_claims": run_summary["ai_grounding"]["allowed_claims"],
        "forbidden_frontend_claims": run_summary["ai_grounding"]["forbidden_claims"]
    }

    quality_review = {
        "artifact_type": "deep_ml_alpha_quality_review",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "status": quality_status,
        "mode": mode,
        "study_id": study_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "quality_flags": quality_flags,
        "static_test_metrics_by_horizon": test_metrics_by_horizon,
        "rolling_origin_by_horizon": rolling_by_horizon,
        "acceptance_rule": "Alpha can move forward only after static and rolling-origin JSON metrics are reviewed.",
        "next_decision": "If weak, build Alpha V5 residual-over-naive or regime-weighted hybrid."
    }

    mirror_json(f"models/{MODEL_KEY}/run_summary.json", run_summary)
    mirror_json(f"models/{MODEL_KEY}/forecast_latest.json", forecast_latest)
    mirror_json(f"models/{MODEL_KEY}/evaluation_by_horizon.json", evaluation_by_horizon)
    mirror_json(f"models/{MODEL_KEY}/rolling_origin_metrics.json", rolling_origin_metrics)
    mirror_json(f"models/{MODEL_KEY}/rolling_origin_by_horizon.json", rolling_origin_metrics)
    mirror_json(f"models/{MODEL_KEY}/rolling_origin_vs_static_split.json", rolling_vs_static)
    mirror_json(f"models/{MODEL_KEY}/uncertainty_latest.json", uncertainty_latest)
    mirror_json(f"models/{MODEL_KEY}/interpretability_latest.json", interpretability_latest)
    mirror_json(f"models/{MODEL_KEY}/diagnostics_latest.json", diagnostics_latest)
    mirror_json(f"models/{MODEL_KEY}/optuna_study_summary.json", optuna_study_summary)
    mirror_json(f"models/{MODEL_KEY}/best_params_by_horizon.json", best_params_artifact)
    mirror_json(f"models/{MODEL_KEY}/shap_summary.json", shap_summary)
    mirror_json(f"models/{MODEL_KEY}/shap_latest_forecast_explanation.json", shap_latest)
    mirror_json(f"models/{MODEL_KEY}/quality_review.json", quality_review)
    mirror_json("pages/page_alpha_structural.json", page_bundle)

    report = {
        "artifact_type": "deep_ml_phase6_alpha_structural_report",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "status": quality_status,
        "mode": mode,
        "study_id": study_id,
        "run_batch_id": run_batch_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "algorithm": "xgboost_optuna",
        "model_version": MODEL_VERSION,
        "target_strategy": "anchored_future_log_return",
        "validation_methods": ["static_split", "rolling_origin"],
        "interpretability_methods": ["xgboost_gain_importance", "shap_tree_explainer"],
        "compute_device": compute_device,
        "gpu_test": gpu_test,
        "effective_data_through_date": effective_date,
        "forecast_start_date": forecast_start_date,
        "selected_feature_count": len(features),
        "n_trials_per_horizon": N_TRIALS_PER_HORIZON,
        "horizons_trained": horizons,
        "runtime_elapsed_seconds": round(logger.elapsed(), 3),
        "runtime_elapsed_hms": format_seconds(logger.elapsed()),
        "test_metrics_by_horizon": test_metrics_by_horizon,
        "rolling_origin_by_horizon": rolling_by_horizon,
        "test_improvement_vs_naive_by_horizon": evaluation_by_horizon["test_improvement_vs_naive_by_horizon"],
        "shap_available": shap_payload.get("shap_available"),
        "quality_flags": quality_flags,
        "top_features": aggregate_gain[:10],
        "top_shap_features": shap_payload.get("global_importance_rows", [])[:10],
        "outputs": [
            f"artifacts/deep_ml/models/{MODEL_KEY}/run_summary.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/forecast_latest.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/evaluation_by_horizon.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/evaluation_rollforward.csv",
            f"artifacts/deep_ml/models/{MODEL_KEY}/rolling_origin_predictions.csv",
            f"artifacts/deep_ml/models/{MODEL_KEY}/rolling_origin_metrics.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/rolling_origin_vs_static_split.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/uncertainty_latest.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/interpretability_latest.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/diagnostics_latest.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/optuna_study_summary.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/best_params_by_horizon.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/optuna_trials.csv",
            f"artifacts/deep_ml/models/{MODEL_KEY}/shap_summary.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/shap_global_importance.csv",
            f"artifacts/deep_ml/models/{MODEL_KEY}/shap_latest_forecast_explanation.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/quality_review.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/timeline.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/progress_checkpoint.json",
            "artifacts/deep_ml/pages/page_alpha_structural.json"
        ],
        "next_step": "Send phase6_alpha_structural_report.json and quality_review.json for review before moving to Beta."
    }

    mirror_json(f"models/{MODEL_KEY}/phase6_alpha_structural_report.json", report)

    logger.log("finish", "Phase 6 Alpha V4 complete", {
        "status": quality_status,
        "runtime_elapsed_hms": format_seconds(logger.elapsed()),
        "send_for_review": [
            f"artifacts/deep_ml/models/{MODEL_KEY}/phase6_alpha_structural_report.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/quality_review.json"
        ]
    })

    print(json.dumps(report, indent=2, ensure_ascii=False))
    print()
    print("SEND ME THIS JSON TO CHECK BEFORE NEXT PHASE:")
    print(f"artifacts/deep_ml/models/{MODEL_KEY}/phase6_alpha_structural_report.json")
    print()
    print("ALSO SEND THIS IF QUALITY FLAGS APPEAR:")
    print(f"artifacts/deep_ml/models/{MODEL_KEY}/quality_review.json")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())