from __future__ import annotations

import json
import math
import os
import platform
import subprocess
import time
import warnings
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np
import optuna
import pandas as pd
import torch
import torch.nn as nn
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, TensorDataset
from tqdm import tqdm

warnings.filterwarnings("ignore")


# =========================================================
# CONFIG
# =========================================================

MODEL_KEY = "beta_temporal"
MODEL_NAME = "Beta Temporal Expert"
MODEL_VERSION = "beta_temporal_v2_raw_anchor_pytorch_optuna_mc_dropout_attention_occlusion"
MODEL_FAMILY = "pytorch_sequence_model_raw_price_anchor"

RANDOM_SEED = 2026
HORIZONS = [1, 5, 10, 20, 30]

N_TRIALS = int(os.getenv("BETA_OPTUNA_TRIALS", "70"))
MAX_EPOCHS_PER_TRIAL = int(os.getenv("BETA_MAX_EPOCHS", "90"))
EARLY_STOPPING_PATIENCE = int(os.getenv("BETA_EARLY_STOPPING_PATIENCE", "12"))

FINAL_EPOCHS = int(os.getenv("BETA_FINAL_EPOCHS", "120"))
FINAL_EARLY_STOPPING_PATIENCE = int(os.getenv("BETA_FINAL_EARLY_STOPPING_PATIENCE", "15"))

MC_SAMPLES_LATEST = int(os.getenv("BETA_MC_SAMPLES_LATEST", "120"))
MC_SAMPLES_EVAL = int(os.getenv("BETA_MC_SAMPLES_EVAL", "40"))

ROLLING_MAX_ORIGINS = int(os.getenv("BETA_ROLLING_MAX_ORIGINS", "900"))

OCCLUSION_SAMPLE_ROWS = int(os.getenv("BETA_OCCLUSION_SAMPLE_ROWS", "400"))
ATTENTION_SAMPLE_ROWS = int(os.getenv("BETA_ATTENTION_SAMPLE_ROWS", "400"))

MAPE_CAUTION_THRESHOLD = float(os.getenv("BETA_MAPE_CAUTION", "20"))
BIAS_CAUTION_DOLLARS = float(os.getenv("BETA_BIAS_CAUTION_DOLLARS", "250"))
DIRECTIONAL_ACCURACY_MIN = float(os.getenv("BETA_DIRECTIONAL_MIN", "50"))

CORE_START_DATE = os.getenv("BETA_CORE_START_DATE", "2006-01-02")
PRED_LOG_RETURN_CLIP = float(os.getenv("BETA_PRED_LOG_RETURN_CLIP", "0.50"))


# =========================================================
# PATHS + BASIC HELPERS
# =========================================================

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


def set_seeds(seed: int = RANDOM_SEED) -> None:
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


# =========================================================
# LOGGER
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
            "artifact_type": "deep_ml_beta_timeline",
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
    trial_number: int | None = None,
    total_trials: int | None = None,
    epoch: int | None = None,
    total_epochs: int | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    payload = {
        "artifact_type": "deep_ml_beta_progress_checkpoint",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "status": status,
        "stage": stage,
        "run_id": logger.run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "trial_number": trial_number,
        "total_trials": total_trials,
        "trial_percent_complete": round((trial_number / total_trials) * 100, 2) if trial_number and total_trials else None,
        "epoch": epoch,
        "total_epochs": total_epochs,
        "epoch_percent_complete": round((epoch / total_epochs) * 100, 2) if epoch and total_epochs else None,
        "elapsed_seconds": round(logger.elapsed(), 3),
        "elapsed_hms": format_seconds(logger.elapsed()),
        "extra": extra or {},
    }
    mirror_json(f"models/{MODEL_KEY}/progress_checkpoint.json", payload)


# =========================================================
# INPUTS
# =========================================================

def detect_device() -> dict[str, Any]:
    cuda_available = bool(torch.cuda.is_available())
    device = "cuda" if cuda_available else "cpu"
    return {
        "torch_available": True,
        "torch_version": getattr(torch, "__version__", None),
        "device": device,
        "cuda_available": cuda_available,
        "cuda_device_name": torch.cuda.get_device_name(0) if cuda_available else None,
        "cuda_device_count": torch.cuda.device_count() if cuda_available else 0,
    }


def load_inputs(logger: RunLogger) -> dict[str, Any]:
    logger.start_stage("load_inputs", "Loading governance, feature, and numeric feature-store artifacts")

    mode_status = read_json(ARTIFACT_ROOT / "governance" / "deep_ml_mode_status.json")
    study_context = read_json(ARTIFACT_ROOT / "governance" / "study_context.json")
    model_feature_plan = read_json(ARTIFACT_ROOT / "features" / "model_feature_plan.json")
    target_plan = read_json(ARTIFACT_ROOT / "features" / "target_plan.json")
    numeric_manifest = read_json(ARTIFACT_ROOT / "features" / "deep_ml_numeric_feature_store_manifest.json")
    factor_state_table = read_json(ARTIFACT_ROOT / "data" / "factor_state_table.json")

    alpha_path = ARTIFACT_ROOT / "models" / "alpha_structural" / "run_summary.json"
    alpha_run_summary = read_json(alpha_path) if alpha_path.exists() else None

    feature_store_path = ARTIFACT_ROOT / "features" / "deep_ml_numeric_feature_store.parquet"
    if not feature_store_path.exists():
        raise FileNotFoundError("Run Phase 5 first. Missing deep_ml_numeric_feature_store.parquet")

    df = pd.read_parquet(feature_store_path)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    logger.end_stage("load_inputs", f"Loaded feature store with {len(df)} rows and {len(df.columns)} columns")

    return {
        "mode_status": mode_status,
        "study_context": study_context,
        "model_feature_plan": model_feature_plan,
        "target_plan": target_plan,
        "numeric_manifest": numeric_manifest,
        "factor_state_table": factor_state_table,
        "alpha_run_summary": alpha_run_summary,
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


def metric_bundle(origin_gold: np.ndarray, y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, Any]:
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

    errors = y_pred - y_true

    return {
        "n": int(len(y_true)),
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": rmse(y_true, y_pred),
        "mape": mape(y_true, y_pred),
        "smape": smape(y_true, y_pred),
        "bias_mean_error": float(np.mean(errors)),
        "directional_accuracy": directional_accuracy(origin_gold, y_true, y_pred),
    }


def baseline_metrics(origin_gold: np.ndarray, y_true: np.ndarray) -> dict[str, Any]:
    naive_pred = origin_gold.copy()
    return {
        "naive_current_price": metric_bundle(origin_gold, y_true, naive_pred),
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
# RAW DATA + FEATURES
# =========================================================

def prepare_raw_beta_dataframe(df: pd.DataFrame, horizons: list[int]) -> pd.DataFrame:
    df = df.copy().sort_values("date").reset_index(drop=True)
    df = df[df["date"] >= pd.to_datetime(CORE_START_DATE)].copy().reset_index(drop=True)

    df["raw_gold_price_anchor"] = df["gold_price"].astype(float)

    df["beta_time_index"] = np.arange(len(df), dtype=float)
    df["beta_year"] = df["date"].dt.year.astype(float)
    df["beta_month"] = df["date"].dt.month.astype(float)
    df["beta_quarter"] = df["date"].dt.quarter.astype(float)
    df["beta_day_of_year_sin"] = np.sin(2 * np.pi * df["date"].dt.dayofyear / 365.25)
    df["beta_day_of_year_cos"] = np.cos(2 * np.pi * df["date"].dt.dayofyear / 365.25)

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

    for h in horizons:
        price_col = f"target_gold_t_plus_{h}"
        ret_col = f"target_log_return_t_plus_{h}"

        if price_col not in df.columns:
            df[price_col] = df["gold_price"].shift(-h)

        df[ret_col] = np.log(df[price_col] / df["raw_gold_price_anchor"])

    return df


def choose_beta_features(raw_df: pd.DataFrame, model_feature_plan: dict[str, Any]) -> list[str]:
    planned = (
        model_feature_plan
        .get("model_feature_sets", {})
        .get(MODEL_KEY, {})
        .get("all_features", [])
    )

    forbidden_exact = {
        "date",
        "split",
        "high_yield",
        "raw_gold_price_anchor",
    }
    forbidden_prefixes = ["target_"]

    extras_prefixes = [
        "beta_",
        "gold_log_price",
        "gold_ma_ratio_",
        "gold_return_20",
        "gold_return_60",
        "gold_drawdown_252",
    ]

    features: list[str] = []

    for col in planned:
        if col in raw_df.columns and col not in forbidden_exact:
            if not any(str(col).startswith(prefix) for prefix in forbidden_prefixes):
                if pd.api.types.is_numeric_dtype(raw_df[col]):
                    features.append(col)

    for col in raw_df.columns:
        if col in forbidden_exact:
            continue
        if any(str(col).startswith(prefix) for prefix in forbidden_prefixes):
            continue
        if not pd.api.types.is_numeric_dtype(raw_df[col]):
            continue
        if any(str(col).startswith(prefix) for prefix in extras_prefixes):
            features.append(col)

    if "gold_price" in raw_df.columns and "gold_price" not in features:
        features.insert(0, "gold_price")

    clean = []
    seen = set()
    for f in features:
        if f not in seen:
            seen.add(f)
            clean.append(f)

    return clean


def filter_features_by_train_availability(raw_df: pd.DataFrame, features: list[str]) -> list[str]:
    train_df = raw_df[raw_df["split"] == "train"].copy()
    keep = []
    for f in features:
        if f not in train_df.columns:
            continue
        if int(train_df[f].notna().sum()) >= 50:
            keep.append(f)
    return keep


def build_scaled_feature_matrix(raw_df: pd.DataFrame, features: list[str]) -> tuple[SimpleImputer, StandardScaler, np.ndarray]:
    train_mask = raw_df["split"] == "train"

    imputer = SimpleImputer(strategy="median")
    scaler = StandardScaler()

    X_train_imp = imputer.fit_transform(raw_df.loc[train_mask, features])
    scaler.fit(X_train_imp)

    X_all_imp = imputer.transform(raw_df[features])
    X_all_scaled = scaler.transform(X_all_imp).astype(np.float32)

    return imputer, scaler, X_all_scaled


@dataclass
class SequenceBundle:
    X: np.ndarray
    y_log_return: np.ndarray
    y_price: np.ndarray
    origin_gold: np.ndarray
    dates: list[str]
    meta: pd.DataFrame


def build_sequence_bundle(
    raw_df: pd.DataFrame,
    scaled_feature_matrix: np.ndarray,
    horizons: list[int],
    sequence_length: int,
    split_names: list[str],
) -> SequenceBundle:
    target_return_cols = [f"target_log_return_t_plus_{h}" for h in horizons]
    target_price_cols = [f"target_gold_t_plus_{h}" for h in horizons]

    X_list = []
    y_ret_list = []
    y_price_list = []
    origin_gold_list = []
    date_list = []
    meta_rows = []

    for idx in range(sequence_length - 1, len(raw_df)):
        row = raw_df.iloc[idx]

        if row["split"] not in split_names:
            continue

        if row[target_return_cols].isna().any() or row[target_price_cols].isna().any():
            continue

        seq = scaled_feature_matrix[idx - sequence_length + 1: idx + 1]

        raw_origin_gold = float(row["raw_gold_price_anchor"])

        X_list.append(seq.astype(np.float32))
        y_ret_list.append(row[target_return_cols].to_numpy(dtype=np.float32))
        y_price_list.append(row[target_price_cols].to_numpy(dtype=np.float32))
        origin_gold_list.append(raw_origin_gold)
        date_list.append(row["date"].strftime("%Y-%m-%d"))

        meta_rows.append({
            "date": row["date"],
            "split": row["split"],
            "raw_origin_gold_price": raw_origin_gold,
            **{col: float(row[col]) for col in target_price_cols},
        })

    if not X_list:
        return SequenceBundle(
            X=np.empty((0, sequence_length, scaled_feature_matrix.shape[1]), dtype=np.float32),
            y_log_return=np.empty((0, len(horizons)), dtype=np.float32),
            y_price=np.empty((0, len(horizons)), dtype=np.float32),
            origin_gold=np.empty((0,), dtype=np.float32),
            dates=[],
            meta=pd.DataFrame(),
        )

    return SequenceBundle(
        X=np.stack(X_list).astype(np.float32),
        y_log_return=np.stack(y_ret_list).astype(np.float32),
        y_price=np.stack(y_price_list).astype(np.float32),
        origin_gold=np.array(origin_gold_list, dtype=np.float32),
        dates=date_list,
        meta=pd.DataFrame(meta_rows),
    )


def make_loader(bundle: SequenceBundle, batch_size: int, shuffle: bool) -> DataLoader:
    dataset = TensorDataset(
        torch.tensor(bundle.X, dtype=torch.float32),
        torch.tensor(bundle.y_log_return, dtype=torch.float32),
    )
    return DataLoader(dataset, batch_size=batch_size, shuffle=shuffle, drop_last=False)


def run_price_anchor_sanity_checks(raw_df: pd.DataFrame, test_bundle: SequenceBundle, horizons: list[int]) -> dict[str, Any]:
    naive_mape_by_horizon = {}

    for h_idx, h in enumerate(horizons):
        if len(test_bundle.y_price):
            y_true = test_bundle.y_price[:, h_idx].astype(float)
            naive = test_bundle.origin_gold.astype(float)
            naive_mape_by_horizon[str(h)] = mape(y_true, naive)
        else:
            naive_mape_by_horizon[str(h)] = None

    origin_min = float(np.nanmin(test_bundle.origin_gold)) if len(test_bundle.origin_gold) else None
    origin_max = float(np.nanmax(test_bundle.origin_gold)) if len(test_bundle.origin_gold) else None

    target_min = float(np.nanmin(test_bundle.y_price)) if len(test_bundle.y_price) else None
    target_max = float(np.nanmax(test_bundle.y_price)) if len(test_bundle.y_price) else None

    naive_values = [v for v in naive_mape_by_horizon.values() if v is not None]

    price_anchor_valid = (
        origin_min is not None
        and origin_max is not None
        and origin_min > 100
        and origin_max < 10000
        and target_min is not None
        and target_min > 100
        and len(naive_values) > 0
        and max(naive_values) < 30
    )

    return {
        "artifact_type": "deep_ml_beta_price_anchor_sanity_checks",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "raw_origin_gold_min": origin_min,
        "raw_origin_gold_max": origin_max,
        "target_gold_min": target_min,
        "target_gold_max": target_max,
        "naive_mape_by_horizon": naive_mape_by_horizon,
        "price_anchor_valid": price_anchor_valid,
        "blocking_reason": None if price_anchor_valid else "Raw price anchor failed sanity checks. Do not accept Beta metrics.",
    }


# =========================================================
# MODEL
# =========================================================

class TemporalSequenceModel(nn.Module):
    def __init__(
        self,
        input_size: int,
        output_size: int,
        model_type: str,
        hidden_size: int,
        num_layers: int,
        dropout: float,
        bidirectional: bool,
        use_attention: bool,
        dense_size: int,
    ):
        super().__init__()

        self.model_type = model_type
        self.use_attention = use_attention
        self.bidirectional = bidirectional
        self.num_directions = 2 if bidirectional else 1

        rnn_cls = nn.LSTM if model_type == "lstm" else nn.GRU
        rnn_dropout = dropout if num_layers > 1 else 0.0

        self.rnn = rnn_cls(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=rnn_dropout,
            bidirectional=bidirectional,
        )

        rnn_out_size = hidden_size * self.num_directions

        self.attention = None
        if use_attention:
            self.attention = nn.Sequential(
                nn.Linear(rnn_out_size, dense_size),
                nn.Tanh(),
                nn.Linear(dense_size, 1),
            )

        self.head = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(rnn_out_size, dense_size),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(dense_size, output_size),
        )

    def forward(self, x: torch.Tensor, return_attention: bool = False):
        outputs, _ = self.rnn(x)

        attention_weights = None

        if self.use_attention and self.attention is not None:
            scores = self.attention(outputs).squeeze(-1)
            attention_weights = torch.softmax(scores, dim=1)
            context = torch.sum(outputs * attention_weights.unsqueeze(-1), dim=1)
        else:
            context = outputs[:, -1, :]

        pred = self.head(context)

        if return_attention:
            return pred, attention_weights

        return pred


def make_model(config: dict[str, Any], input_size: int, output_size: int) -> TemporalSequenceModel:
    return TemporalSequenceModel(
        input_size=input_size,
        output_size=output_size,
        model_type=config["model_type"],
        hidden_size=config["hidden_size"],
        num_layers=config["num_layers"],
        dropout=config["dropout"],
        bidirectional=config["bidirectional"],
        use_attention=config["use_attention"],
        dense_size=config["dense_size"],
    )


def loss_fn_from_name(name: str):
    if name == "huber":
        return nn.HuberLoss(delta=1.0)
    return nn.MSELoss()


# =========================================================
# TRAIN + PREDICT
# =========================================================

def train_model(
    model: TemporalSequenceModel,
    train_bundle: SequenceBundle,
    val_bundle: SequenceBundle | None,
    config: dict[str, Any],
    device: torch.device,
    logger: RunLogger,
    stage: str,
    max_epochs: int,
    patience: int,
    show_epoch_progress: bool,
) -> tuple[TemporalSequenceModel, list[dict[str, Any]], dict[str, Any]]:
    model = model.to(device)

    batch_size = int(config["batch_size"])
    lr = float(config["learning_rate"])
    weight_decay = float(config["weight_decay"])
    loss_name = config["loss"]

    train_loader = make_loader(train_bundle, batch_size=batch_size, shuffle=True)
    val_loader = make_loader(val_bundle, batch_size=batch_size, shuffle=False) if val_bundle and len(val_bundle.X) else None

    criterion = loss_fn_from_name(loss_name)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)

    best_state = None
    best_val_loss = float("inf")
    best_epoch = 0
    epochs_without_improvement = 0
    history = []

    iterator = range(1, max_epochs + 1)
    if show_epoch_progress:
        iterator = tqdm(iterator, desc=stage, unit="epoch")

    for epoch in iterator:
        model.train()
        train_losses = []

        for xb, yb in train_loader:
            xb = xb.to(device)
            yb = yb.to(device)

            optimizer.zero_grad(set_to_none=True)
            pred = model(xb)
            loss = criterion(pred, yb)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

            train_losses.append(float(loss.detach().cpu().item()))

        train_loss = float(np.mean(train_losses)) if train_losses else None

        if val_loader is not None:
            model.eval()
            val_losses = []
            with torch.no_grad():
                for xb, yb in val_loader:
                    xb = xb.to(device)
                    yb = yb.to(device)
                    pred = model(xb)
                    loss = criterion(pred, yb)
                    val_losses.append(float(loss.detach().cpu().item()))
            val_loss = float(np.mean(val_losses)) if val_losses else None
        else:
            val_loss = train_loss

        history.append({
            "epoch": epoch,
            "train_loss": train_loss,
            "val_loss": val_loss,
            "best_val_loss": best_val_loss if best_val_loss < float("inf") else None,
        })

        if val_loss is not None and val_loss < best_val_loss:
            best_val_loss = val_loss
            best_epoch = epoch
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1

        if show_epoch_progress and epoch % 5 == 0:
            write_progress_checkpoint(
                logger=logger,
                status="training",
                stage=stage,
                epoch=epoch,
                total_epochs=max_epochs,
                extra={
                    "train_loss": train_loss,
                    "val_loss": val_loss,
                    "best_epoch": best_epoch,
                    "best_val_loss": best_val_loss,
                },
            )

        if epochs_without_improvement >= patience:
            break

    if best_state is not None:
        model.load_state_dict(best_state)

    summary = {
        "best_epoch": best_epoch,
        "best_val_loss": best_val_loss if best_val_loss < float("inf") else None,
        "epochs_ran": len(history),
    }

    return model, history, summary


def predict_log_returns(
    model: TemporalSequenceModel,
    bundle: SequenceBundle,
    device: torch.device,
    batch_size: int = 512,
    mc_dropout: bool = False,
) -> np.ndarray:
    if len(bundle.X) == 0:
        return np.empty((0, len(HORIZONS)), dtype=np.float32)

    if mc_dropout:
        model.train()
    else:
        model.eval()

    loader = DataLoader(
        TensorDataset(torch.tensor(bundle.X, dtype=torch.float32)),
        batch_size=batch_size,
        shuffle=False,
    )

    preds = []

    with torch.no_grad():
        for (xb,) in loader:
            xb = xb.to(device)
            pred = model(xb)
            preds.append(pred.detach().cpu().numpy())

    return np.vstack(preds).astype(np.float32)


def log_returns_to_prices(origin_gold: np.ndarray, pred_log_returns: np.ndarray) -> np.ndarray:
    clipped = np.clip(pred_log_returns, -PRED_LOG_RETURN_CLIP, PRED_LOG_RETURN_CLIP)
    return origin_gold.reshape(-1, 1) * np.exp(clipped)


def evaluate_bundle(
    model: TemporalSequenceModel,
    bundle: SequenceBundle,
    horizons: list[int],
    device: torch.device,
    batch_size: int = 512,
) -> dict[str, Any]:
    pred_returns = predict_log_returns(model, bundle, device=device, batch_size=batch_size, mc_dropout=False)
    pred_prices = log_returns_to_prices(bundle.origin_gold, pred_returns)

    metrics_by_horizon = {}
    baseline_by_horizon = {}
    improvement_by_horizon = {}
    rows = []

    for h_idx, horizon in enumerate(horizons):
        y_true = bundle.y_price[:, h_idx].astype(float)
        y_pred = pred_prices[:, h_idx].astype(float)
        origin = bundle.origin_gold.astype(float)

        metrics = metric_bundle(origin, y_true, y_pred)
        base = baseline_metrics(origin, y_true)
        naive = base.get("naive_current_price", {})
        improvement = improvement_vs_naive(metrics, naive)

        metrics_by_horizon[str(horizon)] = metrics
        baseline_by_horizon[str(horizon)] = base
        improvement_by_horizon[str(horizon)] = improvement

        for i in range(len(bundle.dates)):
            rows.append({
                "date": bundle.dates[i],
                "horizon": horizon,
                "raw_origin_gold_price": float(origin[i]),
                "actual_target": float(y_true[i]),
                "predicted_log_return": float(pred_returns[i, h_idx]),
                "prediction": float(y_pred[i]),
                "naive_prediction": float(origin[i]),
                "error": float(y_pred[i] - y_true[i]),
            })

    return {
        "metrics_by_horizon": metrics_by_horizon,
        "baseline_by_horizon": baseline_by_horizon,
        "improvement_by_horizon": improvement_by_horizon,
        "prediction_rows": pd.DataFrame(rows),
        "pred_log_returns": pred_returns,
        "pred_prices": pred_prices,
    }


def objective_price_score(val_bundle: SequenceBundle, pred_prices: np.ndarray, horizons: list[int]) -> float:
    scores = []
    for h_idx, horizon in enumerate(horizons):
        y_true = val_bundle.y_price[:, h_idx].astype(float)
        y_pred = pred_prices[:, h_idx].astype(float)
        r = rmse(y_true, y_pred)
        b = abs(float(np.mean(y_pred - y_true)))
        mp = mape(y_true, y_pred) or 0.0
        scores.append(r + 0.30 * b + 0.05 * mp)
    return float(np.mean(scores))


# =========================================================
# OPTUNA
# =========================================================

def suggest_config(trial: Any) -> dict[str, Any]:
    arch = trial.suggest_categorical(
        "architecture",
        ["gru", "lstm", "gru_attention", "lstm_attention"],
    )

    model_type = "lstm" if "lstm" in arch else "gru"
    use_attention = "attention" in arch

    return {
        "architecture": arch,
        "model_type": model_type,
        "use_attention": use_attention,
        "sequence_length": trial.suggest_categorical("sequence_length", [20, 60, 120]),
        "hidden_size": trial.suggest_categorical("hidden_size", [64, 128, 192, 256]),
        "num_layers": trial.suggest_int("num_layers", 1, 3),
        "dropout": trial.suggest_float("dropout", 0.05, 0.40),
        "bidirectional": trial.suggest_categorical("bidirectional", [False, True]),
        "dense_size": trial.suggest_categorical("dense_size", [64, 128, 256]),
        "learning_rate": trial.suggest_float("learning_rate", 1e-5, 5e-3, log=True),
        "weight_decay": trial.suggest_float("weight_decay", 1e-8, 1e-3, log=True),
        "batch_size": trial.suggest_categorical("batch_size", [32, 64, 128]),
        "loss": trial.suggest_categorical("loss", ["mse", "huber"]),
    }


def config_from_params(params: dict[str, Any]) -> dict[str, Any]:
    arch = params["architecture"]
    return {
        "architecture": arch,
        "model_type": "lstm" if "lstm" in arch else "gru",
        "use_attention": "attention" in arch,
        "sequence_length": int(params["sequence_length"]),
        "hidden_size": int(params["hidden_size"]),
        "num_layers": int(params["num_layers"]),
        "dropout": float(params["dropout"]),
        "bidirectional": bool(params["bidirectional"]),
        "dense_size": int(params["dense_size"]),
        "learning_rate": float(params["learning_rate"]),
        "weight_decay": float(params["weight_decay"]),
        "batch_size": int(params["batch_size"]),
        "loss": params["loss"],
    }


def run_optuna(
    logger: RunLogger,
    raw_df: pd.DataFrame,
    scaled_features: np.ndarray,
    feature_count: int,
    horizons: list[int],
    device: torch.device,
) -> dict[str, Any]:
    logger.start_stage("optuna", f"Starting Beta V2 Optuna study with {N_TRIALS} trials")

    dataset_cache: dict[int, dict[str, SequenceBundle]] = {}
    trial_rows: list[dict[str, Any]] = []
    progress = tqdm(total=N_TRIALS, desc="Beta V2 Optuna", unit="trial")

    def get_bundles(sequence_length: int) -> dict[str, SequenceBundle]:
        if sequence_length not in dataset_cache:
            train = build_sequence_bundle(raw_df, scaled_features, horizons, sequence_length, ["train"])
            val = build_sequence_bundle(raw_df, scaled_features, horizons, sequence_length, ["validation"])
            test = build_sequence_bundle(raw_df, scaled_features, horizons, sequence_length, ["test"])
            trainval = build_sequence_bundle(raw_df, scaled_features, horizons, sequence_length, ["train", "validation"])
            dataset_cache[sequence_length] = {
                "train": train,
                "validation": val,
                "test": test,
                "trainval": trainval,
            }
        return dataset_cache[sequence_length]

    def objective(trial: Any) -> float:
        set_seeds(RANDOM_SEED + trial.number)
        config = suggest_config(trial)
        bundles = get_bundles(config["sequence_length"])

        train_bundle = bundles["train"]
        val_bundle = bundles["validation"]

        if len(train_bundle.X) < 100 or len(val_bundle.X) < 50:
            return float("inf")

        model = make_model(config, input_size=feature_count, output_size=len(horizons))

        model, history, summary = train_model(
            model=model,
            train_bundle=train_bundle,
            val_bundle=val_bundle,
            config=config,
            device=device,
            logger=logger,
            stage=f"trial_{trial.number}",
            max_epochs=MAX_EPOCHS_PER_TRIAL,
            patience=EARLY_STOPPING_PATIENCE,
            show_epoch_progress=False,
        )

        pred_returns = predict_log_returns(model, val_bundle, device=device, batch_size=512)
        pred_prices = log_returns_to_prices(val_bundle.origin_gold, pred_returns)
        score = objective_price_score(val_bundle, pred_prices, horizons)

        trial.set_user_attr("best_epoch", summary.get("best_epoch"))
        trial.set_user_attr("epochs_ran", summary.get("epochs_ran"))
        trial.set_user_attr("sequence_length", config["sequence_length"])
        trial.set_user_attr("architecture", config["architecture"])

        return score

    def callback(study: Any, trial: Any) -> None:
        row = {
            "trial_number": trial.number,
            "value": trial.value,
            "state": str(trial.state),
            "timestamp_utc": utc_now_iso(),
            "elapsed_hms": format_seconds(logger.elapsed()),
        }
        row.update({f"param_{k}": v for k, v in trial.params.items()})
        row.update({f"user_{k}": v for k, v in trial.user_attrs.items()})
        trial_rows.append(row)

        progress.update(1)
        if study.best_value is not None:
            progress.set_postfix(best=f"{study.best_value:.4f}")

        write_progress_checkpoint(
            logger=logger,
            status="running",
            stage="optuna",
            trial_number=trial.number + 1,
            total_trials=N_TRIALS,
            extra={
                "current_trial_value": trial.value,
                "best_value": study.best_value,
                "best_params": study.best_params,
            },
        )

        write_csv(f"models/{MODEL_KEY}/optuna_trials_partial.csv", pd.DataFrame(trial_rows))

    sampler = optuna.samplers.TPESampler(seed=RANDOM_SEED)
    study = optuna.create_study(direction="minimize", sampler=sampler)
    study.optimize(
        objective,
        n_trials=N_TRIALS,
        callbacks=[callback],
        show_progress_bar=False,
        gc_after_trial=True,
        catch=(Exception,),
    )

    progress.close()
    logger.end_stage("optuna", f"Optuna complete; best={study.best_value:.4f}")

    return {
        "study": study,
        "best_config": config_from_params(study.best_params),
        "best_value": float(study.best_value),
        "trial_rows": trial_rows,
        "dataset_cache": dataset_cache,
    }


# =========================================================
# UNCERTAINTY + INTERPRETABILITY
# =========================================================

def mc_dropout_predictions(
    model: TemporalSequenceModel,
    bundle: SequenceBundle,
    device: torch.device,
    samples: int,
    batch_size: int = 512,
) -> np.ndarray:
    all_preds = []
    for _ in tqdm(range(samples), desc="MC dropout", unit="sample"):
        pred = predict_log_returns(model, bundle, device=device, batch_size=batch_size, mc_dropout=True)
        all_preds.append(pred)
    return np.stack(all_preds, axis=0)


def validation_residual_quantiles(
    model: TemporalSequenceModel,
    val_bundle: SequenceBundle,
    horizons: list[int],
    device: torch.device,
) -> dict[str, Any]:
    val_pred_returns = predict_log_returns(model, val_bundle, device=device, batch_size=512, mc_dropout=False)
    val_pred_prices = log_returns_to_prices(val_bundle.origin_gold, val_pred_returns)

    out = {}
    for h_idx, h in enumerate(horizons):
        residual = val_bundle.y_price[:, h_idx].astype(float) - val_pred_prices[:, h_idx].astype(float)
        out[str(h)] = {
            "q10_residual": float(np.quantile(residual, 0.10)),
            "q90_residual": float(np.quantile(residual, 0.90)),
            "residual_std": float(np.std(residual)),
        }
    return out


def mc_interval_summary(
    model: TemporalSequenceModel,
    bundle: SequenceBundle,
    horizons: list[int],
    device: torch.device,
    samples: int,
    residual_quantiles: dict[str, Any],
) -> dict[str, Any]:
    if len(bundle.X) == 0:
        return {
            "samples": samples,
            "coverage_by_horizon": {},
            "mean_interval_width_by_horizon": {},
        }

    sample_returns = mc_dropout_predictions(model, bundle, device=device, samples=samples)
    sample_prices = bundle.origin_gold.reshape(1, -1, 1) * np.exp(np.clip(sample_returns, -PRED_LOG_RETURN_CLIP, PRED_LOG_RETURN_CLIP))

    p10 = np.quantile(sample_prices, 0.10, axis=0)
    p50 = np.quantile(sample_prices, 0.50, axis=0)
    p90 = np.quantile(sample_prices, 0.90, axis=0)

    coverage = {}
    width = {}

    for h_idx, h in enumerate(horizons):
        rq = residual_quantiles.get(str(h), {})
        q10 = rq.get("q10_residual", 0.0) or 0.0
        q90 = rq.get("q90_residual", 0.0) or 0.0

        calibrated_p10 = p10[:, h_idx] + q10
        calibrated_p90 = p90[:, h_idx] + q90

        y_true = bundle.y_price[:, h_idx]
        inside = (y_true >= calibrated_p10) & (y_true <= calibrated_p90)

        coverage[str(h)] = float(np.mean(inside) * 100)
        width[str(h)] = float(np.mean(calibrated_p90 - calibrated_p10))

    return {
        "samples": samples,
        "coverage_by_horizon": coverage,
        "mean_interval_width_by_horizon": width,
        "calibration_method": "mc_dropout_plus_validation_residual_quantiles",
    }


def latest_sequence_bundle(
    raw_df: pd.DataFrame,
    scaled_features: np.ndarray,
    horizons: list[int],
    sequence_length: int,
) -> SequenceBundle:
    seq_raw = raw_df.tail(sequence_length).copy()
    seq_scaled = scaled_features[-sequence_length:]

    latest_row = seq_raw.tail(1).iloc[0]

    return SequenceBundle(
        X=seq_scaled.reshape(1, sequence_length, scaled_features.shape[1]).astype(np.float32),
        y_log_return=np.zeros((1, len(horizons)), dtype=np.float32),
        y_price=np.zeros((1, len(horizons)), dtype=np.float32),
        origin_gold=np.array([float(latest_row["raw_gold_price_anchor"])], dtype=np.float32),
        dates=[latest_row["date"].strftime("%Y-%m-%d")],
        meta=pd.DataFrame([{
            "date": latest_row["date"],
            "split": "latest",
            "raw_origin_gold_price": float(latest_row["raw_gold_price_anchor"]),
        }]),
    )


def latest_forecast_from_mc(
    model: TemporalSequenceModel,
    latest_bundle: SequenceBundle,
    horizons: list[int],
    effective_date: str,
    device: torch.device,
    residual_quantiles: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    sample_returns = mc_dropout_predictions(
        model,
        latest_bundle,
        device=device,
        samples=MC_SAMPLES_LATEST,
        batch_size=1,
    )

    origin_gold = float(latest_bundle.origin_gold[0])
    origin_date = latest_bundle.dates[0]

    sample_prices = origin_gold * np.exp(np.clip(sample_returns[:, 0, :], -PRED_LOG_RETURN_CLIP, PRED_LOG_RETURN_CLIP))
    future_dates = next_weekdays(effective_date, max(horizons))

    points = []

    for h_idx, h in enumerate(horizons):
        forecast_date = future_dates[h - 1] if h - 1 < len(future_dates) else None

        rq = residual_quantiles.get(str(h), {})
        q10_res = rq.get("q10_residual", 0.0) or 0.0
        q90_res = rq.get("q90_residual", 0.0) or 0.0

        p10 = float(np.quantile(sample_prices[:, h_idx], 0.10) + q10_res)
        p50 = float(np.quantile(sample_prices[:, h_idx], 0.50))
        p90 = float(np.quantile(sample_prices[:, h_idx], 0.90) + q90_res)

        points.append({
            "horizon": h,
            "forecast_date": forecast_date,
            "origin_date": origin_date,
            "origin_gold_price": origin_gold,
            "p10": p10,
            "p50": p50,
            "p90": p90,
            "expected_change": float(p50 - origin_gold),
            "expected_change_pct": float(((p50 / origin_gold) - 1) * 100),
        })

    preview_rows = []
    for sample_idx in range(min(25, sample_prices.shape[0])):
        for h_idx, h in enumerate(horizons):
            preview_rows.append({
                "sample": sample_idx,
                "horizon": h,
                "forecast_price": float(sample_prices[sample_idx, h_idx]),
            })

    return points, {
        "mc_samples": MC_SAMPLES_LATEST,
        "sample_preview_rows": preview_rows,
    }


def attention_summary(
    model: TemporalSequenceModel,
    bundle: SequenceBundle,
    device: torch.device,
    sequence_length: int,
) -> dict[str, Any]:
    if not getattr(model, "use_attention", False):
        return {
            "attention_available": False,
            "reason": "Best Beta architecture did not use attention.",
            "temporal_attention": [],
        }

    sample_count = min(ATTENTION_SAMPLE_ROWS, len(bundle.X))
    if sample_count == 0:
        return {
            "attention_available": False,
            "reason": "No rows available for attention summary.",
            "temporal_attention": [],
        }

    X = torch.tensor(bundle.X[-sample_count:], dtype=torch.float32).to(device)

    model.eval()
    with torch.no_grad():
        _, weights = model(X, return_attention=True)

    if weights is None:
        return {
            "attention_available": False,
            "reason": "Model returned no attention weights.",
            "temporal_attention": [],
        }

    avg_weights = weights.detach().cpu().numpy().mean(axis=0)

    rows = []
    for i, val in enumerate(avg_weights):
        lag = i - sequence_length + 1
        rows.append({
            "sequence_position": i,
            "lag_from_origin": lag,
            "mean_attention_weight": float(val),
        })

    return {
        "attention_available": True,
        "sample_rows": sample_count,
        "temporal_attention": rows,
        "professor_safe_note": "Attention indicates model focus over the sequence; it does not prove economic causality.",
    }


def feature_occlusion_importance(
    model: TemporalSequenceModel,
    bundle: SequenceBundle,
    features: list[str],
    horizons: list[int],
    device: torch.device,
) -> pd.DataFrame:
    sample_count = min(OCCLUSION_SAMPLE_ROWS, len(bundle.X))
    if sample_count == 0:
        return pd.DataFrame()

    X_base = bundle.X[-sample_count:].copy()
    origin_gold = bundle.origin_gold[-sample_count:].copy()

    base_bundle = SequenceBundle(
        X=X_base,
        y_log_return=bundle.y_log_return[-sample_count:].copy(),
        y_price=bundle.y_price[-sample_count:].copy(),
        origin_gold=origin_gold,
        dates=bundle.dates[-sample_count:],
        meta=bundle.meta.tail(sample_count).copy(),
    )

    base_ret = predict_log_returns(model, base_bundle, device=device, batch_size=512, mc_dropout=False)
    base_price = log_returns_to_prices(origin_gold, base_ret)

    rows = []

    for feature_idx in tqdm(range(len(features)), desc="Beta V2 occlusion", unit="feature"):
        X_occ = X_base.copy()
        X_occ[:, :, feature_idx] = 0.0

        occ_bundle = SequenceBundle(
            X=X_occ,
            y_log_return=base_bundle.y_log_return,
            y_price=base_bundle.y_price,
            origin_gold=origin_gold,
            dates=base_bundle.dates,
            meta=base_bundle.meta,
        )

        occ_ret = predict_log_returns(model, occ_bundle, device=device, batch_size=512, mc_dropout=False)
        occ_price = log_returns_to_prices(origin_gold, occ_ret)
        diff = np.abs(occ_price - base_price)

        for h_idx, h in enumerate(horizons):
            rows.append({
                "feature": features[feature_idx],
                "horizon": h,
                "mean_abs_price_change_when_occluded": float(np.mean(diff[:, h_idx])),
                "sample_rows": sample_count,
            })

    out = pd.DataFrame(rows)
    return out.sort_values("mean_abs_price_change_when_occluded", ascending=False)


# =========================================================
# QUALITY
# =========================================================

def build_quality_flags(
    static_test: dict[str, Any],
    rolling: dict[str, Any],
    mc_summary: dict[str, Any],
    sanity_checks: dict[str, Any],
) -> tuple[str, list[dict[str, Any]]]:
    flags = []

    if not sanity_checks.get("price_anchor_valid"):
        flags.append({
            "scope": "sanity_check",
            "horizon": "all",
            "metric": "price_anchor_valid",
            "value": False,
            "severity": "blocking",
            "message": sanity_checks.get("blocking_reason"),
        })

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

    coverage = mc_summary.get("coverage_by_horizon", {})
    for h, val in coverage.items():
        if val is not None and (val < 55 or val > 98):
            flags.append({"scope": "uncertainty", "horizon": h, "metric": "mc_dropout_calibrated_coverage", "value": val, "severity": "info"})

    blocking = any(flag.get("severity") == "blocking" for flag in flags)

    if blocking:
        return "blocked_quality_sanity_failed", flags

    return ("ready" if not flags else "ready_quality_review_required"), flags


# =========================================================
# MAIN
# =========================================================

def main() -> int:
    generated_at_utc = utc_now_iso()

    pre_run_id = f"deepml_run_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{MODEL_KEY}_starting"
    logger = RunLogger(pre_run_id)

    logger.log("startup", "Phase 7 Beta Temporal V2 started", {
        "model_version": MODEL_VERSION,
        "n_trials": N_TRIALS,
        "max_epochs_per_trial": MAX_EPOCHS_PER_TRIAL,
        "mc_samples_latest": MC_SAMPLES_LATEST,
        "mc_samples_eval": MC_SAMPLES_EVAL,
    })

    set_seeds(RANDOM_SEED)

    device_info = detect_device()
    device = torch.device(device_info["device"])

    logger.log("environment", "Compute environment checked", device_info)

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

    logger.start_stage("data_prep", "Preparing raw-anchor dataframe, targets, scaled features, and sanity checks")

    raw_df = prepare_raw_beta_dataframe(inputs["df"], horizons)
    features = choose_beta_features(raw_df, model_feature_plan)
    features = filter_features_by_train_availability(raw_df, features)

    imputer, scaler, scaled_features = build_scaled_feature_matrix(raw_df, features)

    provisional_test_bundle = build_sequence_bundle(raw_df, scaled_features, horizons, 60, ["test"])
    sanity_checks = run_price_anchor_sanity_checks(raw_df, provisional_test_bundle, horizons)
    mirror_json(f"models/{MODEL_KEY}/sanity_checks.json", sanity_checks)

    if not sanity_checks.get("price_anchor_valid"):
        report = {
            "artifact_type": "deep_ml_phase7_beta_temporal_report",
            "schema_version": "1.0.0",
            "generated_at_utc": utc_now_iso(),
            "status": "blocked_quality_sanity_failed",
            "mode": mode,
            "study_id": study_id,
            "run_id": run_id,
            "model_key": MODEL_KEY,
            "model_version": MODEL_VERSION,
            "sanity_checks": sanity_checks,
            "next_step": "Fix raw-price-anchor data construction before training Beta."
        }
        mirror_json(f"models/{MODEL_KEY}/phase7_beta_temporal_report.json", report)
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 1

    logger.end_stage("data_prep", f"Prepared {len(features)} features and passed raw-price-anchor sanity checks")

    sequence_dataset_manifest = {
        "artifact_type": "deep_ml_beta_sequence_dataset_manifest",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "core_start_date": CORE_START_DATE,
        "row_count": int(len(raw_df)),
        "feature_count": int(len(features)),
        "features": features,
        "horizons": horizons,
        "target_strategy": "anchored_future_log_return",
        "raw_anchor_policy": "Raw gold_price is preserved as raw_gold_price_anchor and never standardized for forecast reconstruction or metrics.",
        "scaling_policy": "SimpleImputer median + StandardScaler fit on training rows only; applied only to model input matrix.",
        "source_feature_store": "artifacts/deep_ml/features/deep_ml_numeric_feature_store.parquet",
        "sanity_checks": sanity_checks,
    }
    mirror_json(f"models/{MODEL_KEY}/sequence_dataset_manifest.json", sequence_dataset_manifest)

    optuna_result = run_optuna(
        logger=logger,
        raw_df=raw_df,
        scaled_features=scaled_features,
        feature_count=len(features),
        horizons=horizons,
        device=device,
    )

    best_config = optuna_result["best_config"]
    write_csv(f"models/{MODEL_KEY}/optuna_trials.csv", pd.DataFrame(optuna_result["trial_rows"]))

    logger.start_stage("final_training", "Training final Beta V2 temporal models")

    best_seq_len = int(best_config["sequence_length"])

    train_bundle = build_sequence_bundle(raw_df, scaled_features, horizons, best_seq_len, ["train"])
    val_bundle = build_sequence_bundle(raw_df, scaled_features, horizons, best_seq_len, ["validation"])
    test_bundle = build_sequence_bundle(raw_df, scaled_features, horizons, best_seq_len, ["test"])
    trainval_bundle = build_sequence_bundle(raw_df, scaled_features, horizons, best_seq_len, ["train", "validation"])

    sanity_checks_final = run_price_anchor_sanity_checks(raw_df, test_bundle, horizons)
    mirror_json(f"models/{MODEL_KEY}/sanity_checks.json", sanity_checks_final)

    eval_model = make_model(best_config, input_size=len(features), output_size=len(horizons))
    eval_model, eval_history, eval_summary = train_model(
        model=eval_model,
        train_bundle=train_bundle,
        val_bundle=val_bundle,
        config=best_config,
        device=device,
        logger=logger,
        stage="final_eval_model",
        max_epochs=FINAL_EPOCHS,
        patience=FINAL_EARLY_STOPPING_PATIENCE,
        show_epoch_progress=True,
    )

    forecast_model = make_model(best_config, input_size=len(features), output_size=len(horizons))
    forecast_model, forecast_history, forecast_summary = train_model(
        model=forecast_model,
        train_bundle=trainval_bundle,
        val_bundle=val_bundle,
        config=best_config,
        device=device,
        logger=logger,
        stage="final_forecast_model",
        max_epochs=FINAL_EPOCHS,
        patience=FINAL_EARLY_STOPPING_PATIENCE,
        show_epoch_progress=True,
    )

    logger.end_stage("final_training", "Final Beta V2 models trained")

    training_history_df = pd.DataFrame(
        [{"model_stage": "evaluation_model", **row} for row in eval_history]
        + [{"model_stage": "forecast_model", **row} for row in forecast_history]
    )
    write_csv(f"models/{MODEL_KEY}/training_history.csv", training_history_df)

    logger.start_stage("evaluation", "Evaluating static split and sequence-origin metrics")

    train_eval = evaluate_bundle(eval_model, train_bundle, horizons, device=device)
    val_eval = evaluate_bundle(eval_model, val_bundle, horizons, device=device)
    test_eval = evaluate_bundle(eval_model, test_bundle, horizons, device=device)

    static_prediction_frames = []
    for split_name, payload in [("train", train_eval), ("validation", val_eval), ("test", test_eval)]:
        df_pred = payload["prediction_rows"].copy()
        if len(df_pred):
            df_pred["split"] = split_name
            static_prediction_frames.append(df_pred)

    static_prediction_table = pd.concat(static_prediction_frames, ignore_index=True) if static_prediction_frames else pd.DataFrame()
    if len(static_prediction_table):
        write_csv(f"models/{MODEL_KEY}/evaluation_rollforward.csv", static_prediction_table)

    rolling_predictions = test_eval["prediction_rows"].copy()
    if len(rolling_predictions) > ROLLING_MAX_ORIGINS * len(horizons):
        rolling_predictions = rolling_predictions.groupby("horizon", group_keys=False).tail(ROLLING_MAX_ORIGINS)

    write_csv(f"models/{MODEL_KEY}/rolling_origin_predictions.csv", rolling_predictions)

    rolling_by_horizon = {}
    for h in horizons:
        metrics = test_eval["metrics_by_horizon"].get(str(h), {})
        naive_metrics = test_eval["baseline_by_horizon"].get(str(h), {}).get("naive_current_price", {})
        improvement = test_eval["improvement_by_horizon"].get(str(h), {})

        rolling_by_horizon[str(h)] = {
            "metrics": metrics,
            "naive_metrics": naive_metrics,
            "improvement_vs_naive": improvement,
            "prediction_count": int(len(rolling_predictions[rolling_predictions["horizon"] == h])) if len(rolling_predictions) else 0,
            "rolling_config": {
                "method": "sequence_origin_evaluation",
                "refit_policy": "fixed_evaluation_model_after_train_validation_selection",
                "max_origins": ROLLING_MAX_ORIGINS,
                "sequence_length": best_seq_len,
                "raw_anchor_safe": True,
            }
        }

    residual_quantiles = validation_residual_quantiles(eval_model, val_bundle, horizons, device=device)

    mc_eval_summary = mc_interval_summary(
        model=eval_model,
        bundle=test_bundle,
        horizons=horizons,
        device=device,
        samples=MC_SAMPLES_EVAL,
        residual_quantiles=residual_quantiles,
    )

    logger.end_stage("evaluation", "Evaluation complete")

    logger.start_stage("forecast_uncertainty", "Creating latest calibrated MC-dropout forecast")

    latest_bundle = latest_sequence_bundle(raw_df, scaled_features, horizons, best_seq_len)

    forecast_points, mc_latest_preview = latest_forecast_from_mc(
        model=forecast_model,
        latest_bundle=latest_bundle,
        horizons=horizons,
        effective_date=effective_date,
        device=device,
        residual_quantiles=residual_quantiles,
    )

    p10_path = [{"date": p["forecast_date"], "value": p["p10"], "horizon": p["horizon"]} for p in forecast_points]
    p50_path = [{"date": p["forecast_date"], "value": p["p50"], "horizon": p["horizon"]} for p in forecast_points]
    p90_path = [{"date": p["forecast_date"], "value": p["p90"], "horizon": p["horizon"]} for p in forecast_points]

    logger.end_stage("forecast_uncertainty", "Latest forecast and calibrated MC dropout intervals created")

    logger.start_stage("interpretability", "Creating attention and occlusion interpretability artifacts")

    attention_payload = attention_summary(
        model=eval_model,
        bundle=test_bundle,
        device=device,
        sequence_length=best_seq_len,
    )

    occlusion_df = feature_occlusion_importance(
        model=eval_model,
        bundle=test_bundle,
        features=features,
        horizons=horizons,
        device=device,
    )

    if len(occlusion_df):
        write_csv(f"models/{MODEL_KEY}/feature_occlusion_importance.csv", occlusion_df)

    latest_sequence_explanation = {
        "artifact_type": "deep_ml_beta_latest_sequence_explanation",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "latest_origin_date": latest_bundle.dates[0],
        "latest_raw_origin_gold_price": float(latest_bundle.origin_gold[0]),
        "attention": attention_payload,
        "top_occlusion_features": occlusion_df.head(25).to_dict(orient="records") if len(occlusion_df) else [],
        "professor_safe_note": "Attention and occlusion explain model usage of sequence information; they do not prove economic causality.",
    }

    logger.end_stage("interpretability", "Interpretability artifacts created")

    test_metrics_by_horizon = test_eval["metrics_by_horizon"]

    quality_status, quality_flags = build_quality_flags(
        static_test=test_metrics_by_horizon,
        rolling=rolling_by_horizon,
        mc_summary=mc_eval_summary,
        sanity_checks=sanity_checks_final,
    )

    evaluation_by_horizon = {
        "artifact_type": "deep_ml_beta_evaluation_by_horizon",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_batch_id": run_batch_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "metrics_by_horizon": {
            str(h): {
                "train": train_eval["metrics_by_horizon"].get(str(h), {}),
                "validation": val_eval["metrics_by_horizon"].get(str(h), {}),
                "test": test_eval["metrics_by_horizon"].get(str(h), {}),
            }
            for h in horizons
        },
        "baseline_metrics_by_horizon": {
            str(h): {
                "test": test_eval["baseline_by_horizon"].get(str(h), {}),
            }
            for h in horizons
        },
        "test_improvement_vs_naive_by_horizon": test_eval["improvement_by_horizon"],
        "rolling_origin_by_horizon": rolling_by_horizon,
        "sanity_checks": sanity_checks_final,
    }

    rolling_origin_metrics = {
        "artifact_type": "deep_ml_beta_rolling_origin_metrics",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_batch_id": run_batch_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "rolling_by_horizon": rolling_by_horizon,
        "professor_safe_summary": "Sequence-origin evaluation uses raw gold price anchors for price reconstruction and metrics.",
    }

    optuna_study_summary = {
        "artifact_type": "deep_ml_beta_optuna_study_summary",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "n_trials": N_TRIALS,
        "max_epochs_per_trial": MAX_EPOCHS_PER_TRIAL,
        "best_value_objective": optuna_result["best_value"],
        "best_config": best_config,
        "device_info": device_info,
    }

    best_config_artifact = {
        "artifact_type": "deep_ml_beta_best_config",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "best_config": best_config,
        "eval_training_summary": eval_summary,
        "forecast_training_summary": forecast_summary,
    }

    forecast_latest = {
        "artifact_type": "deep_ml_beta_forecast_latest",
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
        "professor_safe_summary": "Beta V2 forecast uses PyTorch sequence modeling with raw-price anchoring and calibrated MC-dropout uncertainty.",
    }

    uncertainty_latest = {
        "artifact_type": "deep_ml_beta_uncertainty_latest",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "method": "mc_dropout_plus_validation_residual_quantile_calibration",
        "mc_samples_latest": MC_SAMPLES_LATEST,
        "mc_samples_eval": MC_SAMPLES_EVAL,
        "residual_quantiles_by_horizon": residual_quantiles,
        "p10_path": p10_path,
        "p50_path": p50_path,
        "p90_path": p90_path,
        "coverage_by_horizon": mc_eval_summary.get("coverage_by_horizon", {}),
        "mean_interval_width_by_horizon": mc_eval_summary.get("mean_interval_width_by_horizon", {}),
    }

    mc_dropout_summary = {
        "artifact_type": "deep_ml_beta_mc_dropout_summary",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "latest_forecast_mc_samples": MC_SAMPLES_LATEST,
        "evaluation_mc_samples": MC_SAMPLES_EVAL,
        "evaluation_interval_summary": mc_eval_summary,
        "latest_sample_preview": mc_latest_preview,
        "residual_quantiles_by_horizon": residual_quantiles,
    }

    mc_preview_df = pd.DataFrame(mc_latest_preview.get("sample_preview_rows", []))
    if len(mc_preview_df):
        write_csv(f"models/{MODEL_KEY}/mc_dropout_samples_preview.csv", mc_preview_df)

    attention_summary_artifact = {
        "artifact_type": "deep_ml_beta_attention_summary",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        **attention_payload,
    }

    interpretability_latest = {
        "artifact_type": "deep_ml_beta_interpretability_latest",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "mode": mode,
        "study_id": study_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "methods": ["attention_summary", "feature_occlusion_importance"],
        "attention_summary": attention_payload,
        "top_occlusion_features": occlusion_df.head(25).to_dict(orient="records") if len(occlusion_df) else [],
        "professor_safe_note": "Interpretability artifacts describe model behavior, not causality.",
    }

    diagnostics_latest = {
        "artifact_type": "deep_ml_beta_diagnostics_latest",
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
        "device_info": device_info,
        "best_config": best_config,
        "quality_status": quality_status,
        "quality_flags": quality_flags,
        "sanity_checks": sanity_checks_final,
        "runtime_elapsed_seconds": round(logger.elapsed(), 3),
        "runtime_elapsed_hms": format_seconds(logger.elapsed()),
        "has_static_prediction_table": len(static_prediction_table) > 0,
        "has_rolling_prediction_table": len(rolling_predictions) > 0,
        "attention_available": attention_payload.get("attention_available"),
        "occlusion_available": len(occlusion_df) > 0,
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
            "live_mode": mode == "live_market_update_mode",
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
            "cuda_available": bool(device_info.get("cuda_available")),
            "device": device_info.get("device"),
            "runtime_elapsed_seconds": round(logger.elapsed(), 3),
            "runtime_elapsed_hms": format_seconds(logger.elapsed()),
        },
        "data_signature": {
            "matrix_snapshot_id": numeric_manifest.get("selected_input_relative_path", "unknown_matrix"),
            "matrix_name": numeric_manifest.get("selected_input_relative_path"),
            "effective_data_through_date": effective_date,
            "forecast_start_date": forecast_start_date,
            "matrix_row_count": numeric_manifest.get("feature_store", {}).get("row_count"),
            "matrix_hash": "sha256:not_computed_phase7_beta_v2",
            "feature_hash": numeric_manifest.get("feature_hash", "sha256:not_available"),
            "factor_state_table_hash": "sha256:not_computed_phase7_beta_v2",
        },
        "model": {
            "model_key": MODEL_KEY,
            "model_name": MODEL_NAME,
            "family": MODEL_FAMILY,
            "target": "gold_price",
            "horizons": horizons,
            "algorithm": "pytorch_recurrent_sequence_model_with_optuna",
            "target_strategy": "anchored_future_log_return",
            "price_anchor_policy": "raw_gold_price_anchor is used for all price reconstruction and metrics",
            "validation_methods": ["static_split", "rolling_origin_sequence"],
            "uncertainty_methods": ["mc_dropout_plus_validation_residual_calibration"],
            "interpretability_methods": ["attention_summary", "feature_occlusion"],
        },
        "features": {
            "used": features,
            "excluded": ["high_yield", "target_*", "date", "split"],
            "stale_or_carried": [],
            "feature_groups": {"beta_feature_count": len(features)},
        },
        "forecast": {
            "frequency": "trading_day",
            "horizon_trading_days": max(horizons),
            "path": forecast_points,
        },
        "uncertainty": {
            "method": "mc_dropout_plus_validation_residual_quantile_calibration",
            "p10_path": p10_path,
            "p50_path": p50_path,
            "p90_path": p90_path,
            "coverage_by_horizon": mc_eval_summary.get("coverage_by_horizon", {}),
        },
        "evaluation": {
            "by_horizon": evaluation_by_horizon["metrics_by_horizon"],
            "baseline_metrics_by_horizon": evaluation_by_horizon["baseline_metrics_by_horizon"],
            "test_improvement_vs_naive_by_horizon": evaluation_by_horizon["test_improvement_vs_naive_by_horizon"],
            "rolling_origin_by_horizon": rolling_by_horizon,
        },
        "interpretability": {
            "methods": ["attention_summary", "feature_occlusion_importance"],
            "attention_available": attention_payload.get("attention_available"),
            "top_occlusion_features": occlusion_df.head(25).to_dict(orient="records") if len(occlusion_df) else [],
        },
        "diagnostics": diagnostics_latest,
        "limitations": [
            "Beta Temporal is one expert, not the final Deep ML winner.",
            "MC dropout intervals are approximate and are calibrated with validation residual quantiles.",
            "Attention and occlusion explain model behavior, not economic causality.",
            "Rolling-origin sequence evaluation uses the trained evaluation model over test origins and does not retrain at every test origin.",
            "Final winner status requires comparison with Alpha, Delta, Epsilon, Gamma, and Omega.",
        ],
        "professor_safe_summary": "Beta Temporal V2 uses PyTorch CUDA sequence modeling with Optuna tuning, raw-price anchoring, calibrated MC-dropout uncertainty, rolling-origin sequence evaluation, and temporal interpretability.",
        "ai_grounding": {
            "allowed_claims": [
                "Beta V2 uses a PyTorch recurrent sequence model.",
                "Beta V2 includes Optuna tuning.",
                "Beta V2 preserves raw gold price for forecast reconstruction.",
                "Beta V2 includes calibrated MC-dropout uncertainty.",
                "Beta V2 includes rolling-origin sequence evaluation.",
                "Beta V2 includes attention/occlusion interpretability.",
            ],
            "forbidden_claims": [
                "Do not claim Beta is the final Deep ML winner.",
                "Do not claim attention proves causality.",
                "Do not claim Beta beats Alpha until model comparison is performed.",
                "Do not claim this is the official Final Forecast.",
            ],
            "source_artifacts": [
                "artifacts/deep_ml/models/beta_temporal/run_summary.json",
                "artifacts/deep_ml/models/beta_temporal/evaluation_by_horizon.json",
                "artifacts/deep_ml/models/beta_temporal/rolling_origin_metrics.json",
                "artifacts/deep_ml/models/beta_temporal/mc_dropout_summary.json",
                "artifacts/deep_ml/models/beta_temporal/sanity_checks.json",
                "artifacts/deep_ml/models/beta_temporal/quality_review.json",
            ],
        },
    }

    page_bundle = {
        "artifact_type": "deep_ml_page_bundle",
        "schema_version": "1.0.0",
        "page_id": "beta_temporal",
        "page_title": "Beta Temporal Expert",
        "page_subtitle": "PyTorch sequence forecasting with raw-price anchoring, Optuna, calibrated MC dropout, rolling-origin validation, and temporal interpretability.",
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
            {"label": "Features Used", "value": len(features), "note": "Sequence feature set."},
            {"label": "Best Architecture", "value": best_config["architecture"], "note": "Selected by Optuna."},
            {"label": "Sequence Length", "value": best_config["sequence_length"], "note": "Trading days."},
            {"label": "Price Anchor", "value": "Raw Gold", "note": "Forecasts reconstructed from raw gold price."},
        ],
        "charts": [
            {"chart_id": "beta_forecast_path", "source_artifact": "artifacts/deep_ml/models/beta_temporal/forecast_latest.json", "type": "forecast_path_with_intervals"},
            {"chart_id": "beta_static_metrics", "source_artifact": "artifacts/deep_ml/models/beta_temporal/evaluation_by_horizon.json", "type": "metrics_table"},
            {"chart_id": "beta_rolling_metrics", "source_artifact": "artifacts/deep_ml/models/beta_temporal/rolling_origin_metrics.json", "type": "metrics_table"},
            {"chart_id": "beta_occlusion", "source_artifact": "artifacts/deep_ml/models/beta_temporal/feature_occlusion_importance.csv", "type": "bar_chart"},
        ],
        "allowed_frontend_claims": run_summary["ai_grounding"]["allowed_claims"],
        "forbidden_frontend_claims": run_summary["ai_grounding"]["forbidden_claims"],
    }

    quality_review = {
        "artifact_type": "deep_ml_beta_quality_review",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "status": quality_status,
        "mode": mode,
        "study_id": study_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "model_version": MODEL_VERSION,
        "quality_flags": quality_flags,
        "sanity_checks": sanity_checks_final,
        "static_test_metrics_by_horizon": test_metrics_by_horizon,
        "rolling_origin_by_horizon": rolling_by_horizon,
        "mc_dropout_coverage_by_horizon": mc_eval_summary.get("coverage_by_horizon", {}),
        "acceptance_rule": "Beta can move forward only after JSON metrics, sanity checks, uncertainty, and interpretability artifacts are reviewed.",
        "next_decision": "Accept as temporal expert, keep as non-champion sequence benchmark, or rebuild Beta V3.",
    }

    mirror_json(f"models/{MODEL_KEY}/run_summary.json", run_summary)
    mirror_json(f"models/{MODEL_KEY}/forecast_latest.json", forecast_latest)
    mirror_json(f"models/{MODEL_KEY}/evaluation_by_horizon.json", evaluation_by_horizon)
    mirror_json(f"models/{MODEL_KEY}/rolling_origin_metrics.json", rolling_origin_metrics)
    mirror_json(f"models/{MODEL_KEY}/uncertainty_latest.json", uncertainty_latest)
    mirror_json(f"models/{MODEL_KEY}/mc_dropout_summary.json", mc_dropout_summary)
    mirror_json(f"models/{MODEL_KEY}/attention_summary.json", attention_summary_artifact)
    mirror_json(f"models/{MODEL_KEY}/latest_sequence_explanation.json", latest_sequence_explanation)
    mirror_json(f"models/{MODEL_KEY}/interpretability_latest.json", interpretability_latest)
    mirror_json(f"models/{MODEL_KEY}/diagnostics_latest.json", diagnostics_latest)
    mirror_json(f"models/{MODEL_KEY}/optuna_study_summary.json", optuna_study_summary)
    mirror_json(f"models/{MODEL_KEY}/best_config.json", best_config_artifact)
    mirror_json(f"models/{MODEL_KEY}/quality_review.json", quality_review)
    mirror_json("pages/page_beta_temporal.json", page_bundle)

    report = {
        "artifact_type": "deep_ml_phase7_beta_temporal_report",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "status": quality_status,
        "mode": mode,
        "study_id": study_id,
        "run_batch_id": run_batch_id,
        "run_id": run_id,
        "model_key": MODEL_KEY,
        "algorithm": "pytorch_recurrent_sequence_model_with_optuna",
        "model_version": MODEL_VERSION,
        "target_strategy": "anchored_future_log_return",
        "price_anchor_policy": "raw_gold_price_anchor_used_for_reconstruction_and_metrics",
        "validation_methods": ["static_split", "rolling_origin_sequence"],
        "uncertainty_methods": ["mc_dropout_plus_validation_residual_quantile_calibration"],
        "interpretability_methods": ["attention_summary", "feature_occlusion"],
        "device_info": device_info,
        "effective_data_through_date": effective_date,
        "forecast_start_date": forecast_start_date,
        "selected_feature_count": len(features),
        "best_config": best_config,
        "n_trials": N_TRIALS,
        "horizons_trained": horizons,
        "runtime_elapsed_seconds": round(logger.elapsed(), 3),
        "runtime_elapsed_hms": format_seconds(logger.elapsed()),
        "sanity_checks": sanity_checks_final,
        "test_metrics_by_horizon": test_metrics_by_horizon,
        "rolling_origin_by_horizon": rolling_by_horizon,
        "test_improvement_vs_naive_by_horizon": test_eval["improvement_by_horizon"],
        "mc_dropout_coverage_by_horizon": mc_eval_summary.get("coverage_by_horizon", {}),
        "attention_available": attention_payload.get("attention_available"),
        "occlusion_available": len(occlusion_df) > 0,
        "quality_flags": quality_flags,
        "outputs": [
            f"artifacts/deep_ml/models/{MODEL_KEY}/run_summary.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/forecast_latest.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/evaluation_by_horizon.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/evaluation_rollforward.csv",
            f"artifacts/deep_ml/models/{MODEL_KEY}/rolling_origin_predictions.csv",
            f"artifacts/deep_ml/models/{MODEL_KEY}/rolling_origin_metrics.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/uncertainty_latest.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/mc_dropout_summary.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/mc_dropout_samples_preview.csv",
            f"artifacts/deep_ml/models/{MODEL_KEY}/attention_summary.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/feature_occlusion_importance.csv",
            f"artifacts/deep_ml/models/{MODEL_KEY}/latest_sequence_explanation.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/interpretability_latest.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/diagnostics_latest.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/optuna_study_summary.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/best_config.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/optuna_trials.csv",
            f"artifacts/deep_ml/models/{MODEL_KEY}/training_history.csv",
            f"artifacts/deep_ml/models/{MODEL_KEY}/sequence_dataset_manifest.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/sanity_checks.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/quality_review.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/timeline.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/progress_checkpoint.json",
            "artifacts/deep_ml/pages/page_beta_temporal.json",
        ],
        "next_step": "Send phase7_beta_temporal_report.json and quality_review.json for review before moving to Delta TFT.",
    }

    mirror_json(f"models/{MODEL_KEY}/phase7_beta_temporal_report.json", report)

    logger.log("finish", "Phase 7 Beta Temporal V2 complete", {
        "status": quality_status,
        "runtime_elapsed_hms": format_seconds(logger.elapsed()),
        "send_for_review": [
            f"artifacts/deep_ml/models/{MODEL_KEY}/phase7_beta_temporal_report.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/quality_review.json",
            f"artifacts/deep_ml/models/{MODEL_KEY}/sanity_checks.json",
        ]
    })

    print(json.dumps(report, indent=2, ensure_ascii=False))
    print()
    print("SEND ME THIS JSON TO CHECK BEFORE NEXT PHASE:")
    print(f"artifacts/deep_ml/models/{MODEL_KEY}/phase7_beta_temporal_report.json")
    print()
    print("ALSO SEND THIS IF QUALITY FLAGS APPEAR:")
    print(f"artifacts/deep_ml/models/{MODEL_KEY}/quality_review.json")
    print()
    print("ALSO SEND THIS IF SANITY CHECK FAILS:")
    print(f"artifacts/deep_ml/models/{MODEL_KEY}/sanity_checks.json")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())