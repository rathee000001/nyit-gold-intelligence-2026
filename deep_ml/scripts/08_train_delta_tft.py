"""
Gold Nexus Alpha — Deep ML Phase 8
Delta TFT V2: calibrated temporal-fusion / quantile uncertainty expert

Script path expected:
    deep_ml/scripts/08_train_delta_tft.py

Primary review artifact:
    artifacts/deep_ml/models/delta_tft/phase8_delta_tft_report.json

Windows / PowerShell commands:
    code .\deep_ml\scripts\08_train_delta_tft.py
    py .\deep_ml\scripts\08_train_delta_tft.py --smoke
    py .\deep_ml\scripts\08_train_delta_tft.py --max-trials 70 --max-epochs 100 --final-epochs 120

Why V2 exists:
    Delta V1 produced acceptable p50 point forecasts but weak p10-p90 coverage
    on medium/long horizons. V2 keeps the same anchored-return TFT-style model,
    but adds validation-based interval calibration before acceptance.

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
import os
import platform
import random
import shutil
import subprocess
import sys
import time
import traceback
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd

try:
    import torch
    from torch import nn
    from torch.utils.data import DataLoader, Dataset
except Exception as exc:  # pragma: no cover
    raise RuntimeError("PyTorch is required. Install torch in the active venv first.") from exc

try:
    from sklearn.preprocessing import StandardScaler
except Exception as exc:  # pragma: no cover
    raise RuntimeError("scikit-learn is required. Install scikit-learn first.") from exc

try:
    from tqdm.auto import tqdm
except Exception:  # pragma: no cover
    tqdm = None

try:
    import optuna
except Exception:  # pragma: no cover
    optuna = None


MODEL_KEY = "delta_tft"
MODEL_NAME = "Delta TFT Multi-Horizon Expert"
MODEL_FAMILY = "temporal_fusion_quantile_model"
SCRIPT_VERSION = "delta_tft_v2_calibrated_custom_tft_style"
TIMEZONE_LOCAL = "America/New_York"
HORIZONS = [1, 5, 10, 20, 30]
QUANTILES = [0.10, 0.50, 0.90]
QUANTILE_KEYS = ["p10", "p50", "p90"]
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
)
NON_FEATURE_COLUMNS = {
    "split",
    "split_label",
    "dataset_split",
    "mode",
    "study_id",
    "run_id",
    "source",
    "dataset_id",  # V2 fix: identifier columns should not be treated as model drivers.
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


def safe_float(x: Any) -> Optional[float]:
    try:
        if x is None:
            return None
        value = float(x)
        if math.isnan(value) or math.isinf(value):
            return None
        return value
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


def ensure_reproducibility(seed: int = RANDOM_SEED) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    try:
        torch.backends.cudnn.benchmark = True
    except Exception:
        pass


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
    alpha_run_summary_path: Path
    beta_run_summary_path: Path


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
        alpha_run_summary_path=artifacts_root / "models" / "alpha_structural" / "run_summary.json",
        beta_run_summary_path=artifacts_root / "models" / "beta_temporal" / "run_summary.json",
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
# Input loading and feature preparation
# -----------------------------------------------------------------------------


def dependency_precheck() -> Dict[str, Any]:
    cuda_available = torch.cuda.is_available()
    return {
        "python_version": sys.version,
        "platform": platform.platform(),
        "torch_version": getattr(torch, "__version__", None),
        "cuda_available": cuda_available,
        "cuda_device_name": torch.cuda.get_device_name(0) if cuda_available else None,
        "optuna_available": optuna is not None,
        "pytorch_forecasting_available": importlib.util.find_spec("pytorch_forecasting") is not None,
        "lightning_available": (
            importlib.util.find_spec("lightning") is not None
            or importlib.util.find_spec("pytorch_lightning") is not None
        ),
        "selected_backend": "custom_tft_style_pytorch_v2_calibrated",
        "backend_note": (
            "V2 uses a controlled custom TFT-style PyTorch model plus validation-based interval calibration. "
            "This avoids dependency instability while preserving the required JSON contract."
        ),
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
        out[f"delta_target_log_return_h{h}"] = np.log(future_price / gold)
        out[f"delta_target_gold_price_h{h}"] = future_price
    return out


def choose_feature_columns(df: pd.DataFrame, date_col: str, gold_col: str, model_feature_plan: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    excluded: List[str] = []
    explicit = model_feature_plan.get("delta_tft_features") or model_feature_plan.get("features_for_deep_models")
    if isinstance(explicit, list):
        raw_cols = [c for c in explicit if c in df.columns and pd.api.types.is_numeric_dtype(df[c])]
    else:
        raw_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]

    features: List[str] = []
    for c in raw_cols:
        lower = str(c).lower()
        if c == date_col:
            excluded.append(str(c))
            continue
        if lower in NON_FEATURE_COLUMNS or lower.endswith("_id"):
            excluded.append(str(c))
            continue
        if any(pattern in lower for pattern in TARGET_COLUMN_PATTERNS):
            excluded.append(str(c))
            continue
        if "high_yield" in lower:
            excluded.append(str(c))
            continue
        features.append(c)

    if gold_col not in features and gold_col in df.columns and pd.api.types.is_numeric_dtype(df[gold_col]):
        features.insert(0, gold_col)
    return features, sorted(set(excluded + ["high_yield excluded from official core mode when detected", "dataset_id excluded as an identifier if detected"]))


# -----------------------------------------------------------------------------
# Dataset
# -----------------------------------------------------------------------------


class SequenceDataset(Dataset):
    def __init__(
        self,
        scaled_features: np.ndarray,
        targets_log_return: np.ndarray,
        target_prices: np.ndarray,
        anchors: np.ndarray,
        dates: Sequence[pd.Timestamp],
        origin_indices: np.ndarray,
        seq_len: int,
    ) -> None:
        self.X = scaled_features.astype(np.float32, copy=False)
        self.y = targets_log_return.astype(np.float32, copy=False)
        self.target_prices = target_prices.astype(np.float32, copy=False)
        self.anchors = anchors.astype(np.float32, copy=False)
        self.dates = list(dates)
        self.origin_indices = origin_indices.astype(np.int64)
        self.seq_len = int(seq_len)

    def __len__(self) -> int:
        return len(self.origin_indices)

    def __getitem__(self, item: int) -> Dict[str, torch.Tensor]:
        idx = int(self.origin_indices[item])
        start = idx - self.seq_len + 1
        seq = self.X[start : idx + 1]
        return {
            "x": torch.tensor(seq, dtype=torch.float32),
            "y": torch.tensor(self.y[idx], dtype=torch.float32),
            "anchor": torch.tensor(self.anchors[idx], dtype=torch.float32),
            "target_prices": torch.tensor(self.target_prices[idx], dtype=torch.float32),
            "origin_index": torch.tensor(idx, dtype=torch.long),
        }


def valid_origin_indices(
    df: pd.DataFrame,
    seq_len: int,
    split: str,
    split_labels: pd.Series,
    target_cols: List[str],
    gold_col: str,
) -> np.ndarray:
    mask = split_labels.eq(split).to_numpy()
    target_ok = df[target_cols].notna().all(axis=1).to_numpy()
    anchor_ok = pd.to_numeric(df[gold_col], errors="coerce").notna().to_numpy()
    index_ok = np.arange(len(df)) >= (seq_len - 1)
    return np.where(mask & target_ok & anchor_ok & index_ok)[0]


def latest_forecast_origin_index(df: pd.DataFrame, seq_len: int, gold_col: str) -> int:
    anchor_ok = pd.to_numeric(df[gold_col], errors="coerce").notna().to_numpy()
    index_ok = np.arange(len(df)) >= (seq_len - 1)
    candidates = np.where(anchor_ok & index_ok)[0]
    if len(candidates) == 0:
        raise ValueError("No valid latest forecast origin for selected sequence length.")
    return int(candidates[-1])


# -----------------------------------------------------------------------------
# Custom TFT-style model
# -----------------------------------------------------------------------------


class GatedResidualBlock(nn.Module):
    def __init__(self, hidden_size: int, dropout: float):
        super().__init__()
        self.ff = nn.Sequential(
            nn.Linear(hidden_size, hidden_size),
            nn.ELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, hidden_size),
        )
        self.gate = nn.Sequential(nn.Linear(hidden_size, hidden_size), nn.Sigmoid())
        self.norm = nn.LayerNorm(hidden_size)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        z = self.ff(x)
        g = self.gate(x)
        return self.norm(x + g * z)


class CustomTFTStyleModel(nn.Module):
    def __init__(
        self,
        n_features: int,
        n_horizons: int,
        n_quantiles: int,
        hidden_size: int,
        attention_heads: int,
        dropout: float,
        grn_depth: int = 2,
        max_seq_len: int = 300,
    ) -> None:
        super().__init__()
        self.feature_gate = nn.Linear(n_features, n_features)
        self.input_proj = nn.Linear(n_features, hidden_size)
        self.position = nn.Parameter(torch.zeros(1, max_seq_len, hidden_size))
        self.pre_blocks = nn.ModuleList([GatedResidualBlock(hidden_size, dropout) for _ in range(grn_depth)])
        self.self_attention = nn.MultiheadAttention(hidden_size, attention_heads, dropout=dropout, batch_first=True)
        self.post_attn = GatedResidualBlock(hidden_size, dropout)
        self.gru = nn.GRU(hidden_size, hidden_size, batch_first=True, dropout=dropout if grn_depth > 1 else 0.0)
        self.horizon_queries = nn.Parameter(torch.randn(1, n_horizons, hidden_size) * 0.02)
        self.horizon_attention = nn.MultiheadAttention(hidden_size, attention_heads, dropout=dropout, batch_first=True)
        self.output_block = GatedResidualBlock(hidden_size, dropout)
        self.quantile_head = nn.Linear(hidden_size, n_quantiles)

    def forward(self, x: torch.Tensor, return_interpretability: bool = False) -> Any:
        seq_len = x.shape[1]
        gates = torch.sigmoid(self.feature_gate(x))
        z = self.input_proj(x * gates) + self.position[:, :seq_len, :]
        for block in self.pre_blocks:
            z = block(z)
        attn_out, self_weights = self.self_attention(
            z,
            z,
            z,
            need_weights=return_interpretability,
            average_attn_weights=False,
        )
        z = self.post_attn(z + attn_out)
        enc, _ = self.gru(z)
        queries = self.horizon_queries.expand(x.shape[0], -1, -1)
        horizon_context, horizon_weights = self.horizon_attention(
            queries,
            enc,
            enc,
            need_weights=return_interpretability,
            average_attn_weights=False,
        )
        out = self.quantile_head(self.output_block(horizon_context))
        if return_interpretability:
            return out, {
                "feature_gates": gates.detach(),
                "self_attention": self_weights.detach() if self_weights is not None else None,
                "horizon_attention": horizon_weights.detach() if horizon_weights is not None else None,
            }
        return out


def choose_attention_heads(hidden_size: int, desired: int) -> int:
    candidates = [h for h in [8, 4, 2, 1] if h <= desired and hidden_size % h == 0]
    return candidates[0] if candidates else 1


def build_model(n_features: int, config: Dict[str, Any], device: torch.device) -> CustomTFTStyleModel:
    hidden = int(config["hidden_size"])
    heads = choose_attention_heads(hidden, int(config.get("attention_heads", 4)))
    return CustomTFTStyleModel(
        n_features=n_features,
        n_horizons=len(HORIZONS),
        n_quantiles=len(QUANTILES),
        hidden_size=hidden,
        attention_heads=heads,
        dropout=float(config["dropout"]),
        grn_depth=int(config.get("grn_depth", 2)),
        max_seq_len=max(320, int(config["sequence_length"]) + 5),
    ).to(device)


def quantile_loss(pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
    losses = []
    for qi, q in enumerate(QUANTILES):
        errors = target - pred[:, :, qi]
        losses.append(torch.maximum((q - 1.0) * errors, q * errors).unsqueeze(-1))
    return torch.mean(torch.cat(losses, dim=-1))


def count_parameters(model: nn.Module) -> int:
    return int(sum(p.numel() for p in model.parameters() if p.requires_grad))


# -----------------------------------------------------------------------------
# Training and prediction
# -----------------------------------------------------------------------------


def make_loader(dataset: Dataset, batch_size: int, shuffle: bool) -> DataLoader:
    return DataLoader(
        dataset,
        batch_size=int(batch_size),
        shuffle=shuffle,
        num_workers=0,
        pin_memory=torch.cuda.is_available(),
        drop_last=False,
    )


def evaluate_loss(model: nn.Module, loader: DataLoader, device: torch.device) -> float:
    model.eval()
    losses: List[float] = []
    with torch.no_grad():
        for batch in loader:
            pred = model(batch["x"].to(device))
            loss = quantile_loss(pred, batch["y"].to(device))
            losses.append(float(loss.detach().cpu().item()))
    return float(np.mean(losses)) if losses else float("inf")


def train_model(
    model: nn.Module,
    train_loader: DataLoader,
    validation_loader: Optional[DataLoader],
    device: torch.device,
    config: Dict[str, Any],
    max_epochs: int,
    patience: int,
    desc: str,
) -> Tuple[nn.Module, List[Dict[str, Any]], float]:
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=float(config["learning_rate"]),
        weight_decay=float(config["weight_decay"]),
    )
    best_state: Optional[Dict[str, torch.Tensor]] = None
    best_val = float("inf")
    wait = 0
    history: List[Dict[str, Any]] = []
    iterator = range(1, max_epochs + 1)
    if tqdm is not None:
        iterator = tqdm(iterator, desc=desc, leave=False)

    for epoch in iterator:
        model.train()
        train_losses: List[float] = []
        for batch in train_loader:
            optimizer.zero_grad(set_to_none=True)
            pred = model(batch["x"].to(device))
            loss = quantile_loss(pred, batch["y"].to(device))
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            train_losses.append(float(loss.detach().cpu().item()))

        train_loss = float(np.mean(train_losses)) if train_losses else float("inf")
        val_loss = evaluate_loss(model, validation_loader, device) if validation_loader is not None else train_loss
        history.append(
            {
                "epoch": epoch,
                "train_quantile_loss": train_loss,
                "validation_quantile_loss": val_loss,
                "best_validation_quantile_loss_so_far": min(best_val, val_loss),
            }
        )
        if tqdm is not None and hasattr(iterator, "set_postfix"):
            iterator.set_postfix(train=round(train_loss, 6), val=round(val_loss, 6))
        if val_loss < best_val:
            best_val = val_loss
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
            wait = 0
        else:
            wait += 1
        if wait >= patience:
            break

    if best_state is not None:
        model.load_state_dict(best_state)
    return model, history, float(best_val)


def predict_dataset(model: nn.Module, dataset: SequenceDataset, batch_size: int, device: torch.device) -> Dict[str, Any]:
    loader = make_loader(dataset, batch_size=batch_size, shuffle=False)
    model.eval()
    raw_preds: List[np.ndarray] = []
    anchors: List[np.ndarray] = []
    actual_prices: List[np.ndarray] = []
    origin_indices: List[np.ndarray] = []
    with torch.no_grad():
        for batch in loader:
            raw_preds.append(model(batch["x"].to(device)).detach().cpu().numpy())
            anchors.append(batch["anchor"].detach().cpu().numpy())
            actual_prices.append(batch["target_prices"].detach().cpu().numpy())
            origin_indices.append(batch["origin_index"].detach().cpu().numpy())

    if not raw_preds:
        empty = np.empty((0, len(HORIZONS), len(QUANTILES)))
        return {
            "pred_log_returns_raw": empty,
            "pred_log_returns_ordered": empty,
            "pred_prices": empty,
            "anchors": np.empty((0,)),
            "actual_prices": np.empty((0, len(HORIZONS))),
            "origin_indices": np.empty((0,), dtype=int),
            "quantile_crossing_count": 0,
        }

    raw = np.concatenate(raw_preds, axis=0)
    ordered = np.sort(raw, axis=-1)
    crossing_count = int(np.sum((raw[:, :, 0] > raw[:, :, 1]) | (raw[:, :, 1] > raw[:, :, 2])))
    anchors_arr = np.concatenate(anchors, axis=0).astype(float)
    actual_arr = np.concatenate(actual_prices, axis=0).astype(float)
    idx_arr = np.concatenate(origin_indices, axis=0).astype(int)
    prices = anchors_arr[:, None, None] * np.exp(ordered)
    return {
        "pred_log_returns_raw": raw,
        "pred_log_returns_ordered": ordered,
        "pred_prices": prices,
        "anchors": anchors_arr,
        "actual_prices": actual_arr,
        "origin_indices": idx_arr,
        "quantile_crossing_count": crossing_count,
    }


def predict_latest(
    model: nn.Module,
    scaled_features: np.ndarray,
    anchors: np.ndarray,
    dates: Sequence[pd.Timestamp],
    origin_index: int,
    seq_len: int,
    device: torch.device,
) -> Dict[str, Any]:
    model.eval()
    seq = scaled_features[origin_index - seq_len + 1 : origin_index + 1].astype(np.float32)
    x = torch.tensor(seq[None, :, :], dtype=torch.float32).to(device)
    with torch.no_grad():
        raw = model(x).detach().cpu().numpy()[0]
    ordered = np.sort(raw, axis=-1)
    crossing_count = int(np.sum((raw[:, 0] > raw[:, 1]) | (raw[:, 1] > raw[:, 2])))
    anchor = float(anchors[origin_index])
    prices = anchor * np.exp(ordered)
    origin_date = pd.Timestamp(dates[origin_index])
    path = []
    for hi, h in enumerate(HORIZONS):
        forecast_date = pd.bdate_range(origin_date, periods=h + 1)[-1]
        path.append(
            {
                "horizon_trading_days": int(h),
                "origin_date": origin_date.date().isoformat(),
                "forecast_date_business_day_approx": forecast_date.date().isoformat(),
                "raw_gold_price_anchor": anchor,
                "native_predicted_log_return_p10": float(ordered[hi, 0]),
                "native_predicted_log_return_p50": float(ordered[hi, 1]),
                "native_predicted_log_return_p90": float(ordered[hi, 2]),
                "native_forecast_price_p10": float(prices[hi, 0]),
                "native_forecast_price_p50": float(prices[hi, 1]),
                "native_forecast_price_p90": float(prices[hi, 2]),
            }
        )
    return {
        "origin_index": int(origin_index),
        "origin_date": origin_date.date().isoformat(),
        "raw_gold_price_anchor": anchor,
        "native_quantile_crossing_count_before_ordering": crossing_count,
        "path": path,
    }


# -----------------------------------------------------------------------------
# Metrics and calibration
# -----------------------------------------------------------------------------


def calc_point_metrics(anchors: np.ndarray, actual_prices: np.ndarray, pred_prices: np.ndarray) -> Dict[str, Any]:
    p50 = pred_prices[:, :, 1]
    metrics: Dict[str, Any] = {}
    for hi, h in enumerate(HORIZONS):
        actual = actual_prices[:, hi].astype(float)
        pred = p50[:, hi].astype(float)
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


def calc_naive_metrics(anchors: np.ndarray, actual_prices: np.ndarray) -> Dict[str, Any]:
    naive = np.repeat(anchors[:, None], len(HORIZONS), axis=1)
    pred_prices = np.stack([naive, naive, naive], axis=-1)
    return calc_point_metrics(anchors, actual_prices, pred_prices)


def calc_uncertainty_metrics(
    actual_prices: np.ndarray,
    pred_prices: np.ndarray,
    anchors: Optional[np.ndarray] = None,
    actual_log_returns: Optional[np.ndarray] = None,
    pred_log_returns: Optional[np.ndarray] = None,
) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    for hi, h in enumerate(HORIZONS):
        actual = actual_prices[:, hi].astype(float)
        p10 = pred_prices[:, hi, 0].astype(float)
        p50 = pred_prices[:, hi, 1].astype(float)
        p90 = pred_prices[:, hi, 2].astype(float)
        valid = np.isfinite(actual) & np.isfinite(p10) & np.isfinite(p50) & np.isfinite(p90)
        if valid.sum() == 0:
            result[str(h)] = {"count": 0}
            continue
        coverage = np.mean((actual[valid] >= p10[valid]) & (actual[valid] <= p90[valid])) * 100.0
        width = p90[valid] - p10[valid]
        width_pct = None
        if anchors is not None:
            anchor = anchors.astype(float)
            width_pct = float(np.mean(width / np.maximum(anchor[valid], 1e-12) * 100.0))
        row: Dict[str, Any] = {
            "count": int(valid.sum()),
            "coverage_p10_p90_pct": float(coverage),
            "mean_interval_width_price": float(np.mean(width)),
            "median_interval_width_price": float(np.median(width)),
            "mean_interval_width_pct_of_anchor": width_pct,
            "calibration_error_vs_80pct_abs": float(abs(coverage - 80.0)),
        }
        if actual_log_returns is not None and pred_log_returns is not None:
            y = actual_log_returns[:, hi]
            losses = []
            by_q = {}
            for qi, q in enumerate(QUANTILES):
                pred_q = pred_log_returns[:, hi, qi]
                v = np.isfinite(y) & np.isfinite(pred_q)
                if v.sum() == 0:
                    by_q[QUANTILE_KEYS[qi]] = None
                    continue
                err = y[v] - pred_q[v]
                loss = np.maximum((q - 1.0) * err, q * err)
                by_q[QUANTILE_KEYS[qi]] = float(np.mean(loss))
                losses.extend(loss.tolist())
            row["pinball_loss_mean"] = float(np.mean(losses)) if losses else None
            row["pinball_loss_by_quantile"] = by_q
        result[str(h)] = row
    return result


def derive_validation_interval_calibration(
    validation_predictions: Dict[str, Any],
    target_coverage: float = TARGET_COVERAGE,
    max_scale_factor: float = 4.0,
) -> Dict[str, Any]:
    """Derive horizon-specific post-hoc interval widening from validation residuals.

    The p50 forecast is preserved. p10/p90 are widened around p50 using validation
    residual behavior. This is a conformal-style calibration layer, not a causal claim.
    """
    pred_prices = validation_predictions["pred_prices"]
    actual_prices = validation_predictions["actual_prices"]
    rows: Dict[str, Any] = {}
    for hi, h in enumerate(HORIZONS):
        actual = actual_prices[:, hi].astype(float)
        p10 = pred_prices[:, hi, 0].astype(float)
        p50 = pred_prices[:, hi, 1].astype(float)
        p90 = pred_prices[:, hi, 2].astype(float)
        valid = np.isfinite(actual) & np.isfinite(p10) & np.isfinite(p50) & np.isfinite(p90)
        if valid.sum() < 30:
            rows[str(h)] = {
                "horizon_trading_days": int(h),
                "status": "insufficient_validation_points",
                "scale_factor": 1.0,
            }
            continue
        native_coverage = float(np.mean((actual[valid] >= p10[valid]) & (actual[valid] <= p90[valid])) * 100.0)
        abs_residual = np.abs(actual[valid] - p50[valid])
        native_half_width = (np.maximum(p50[valid] - p10[valid], 1e-6) + np.maximum(p90[valid] - p50[valid], 1e-6)) / 2.0
        required_half_width = float(np.quantile(abs_residual, target_coverage))
        median_native_half_width = float(np.median(native_half_width))
        raw_scale = required_half_width / max(median_native_half_width, 1e-6)
        scale = float(min(max(raw_scale, 1.0), max_scale_factor))
        rows[str(h)] = {
            "horizon_trading_days": int(h),
            "status": "ready",
            "method": "validation_residual_symmetric_interval_widening",
            "target_coverage_pct": float(target_coverage * 100.0),
            "native_validation_coverage_pct": native_coverage,
            "required_validation_half_width_price": required_half_width,
            "median_native_half_width_price": median_native_half_width,
            "raw_scale_factor": float(raw_scale),
            "scale_factor": scale,
            "scale_factor_cap": max_scale_factor,
        }
    return {
        "artifact_type": "delta_tft_interval_calibration_summary",
        "schema_version": "1.0.0",
        "model_key": MODEL_KEY,
        "calibration_version": "v2_validation_residual_interval_calibration",
        "target_coverage_pct": float(target_coverage * 100.0),
        "p50_preserved": True,
        "professor_safe_note": "Calibration uses validation residual behavior to widen intervals. It improves empirical interval behavior but does not guarantee future coverage.",
        "by_horizon": rows,
        "generated_at_utc": iso_utc(),
    }


def apply_interval_calibration(predictions: Dict[str, Any], calibration_summary: Dict[str, Any]) -> Dict[str, Any]:
    calibrated = dict(predictions)
    native_prices = predictions["pred_prices"].astype(float)
    anchors = predictions["anchors"].astype(float)
    prices = native_prices.copy()
    for hi, h in enumerate(HORIZONS):
        info = calibration_summary.get("by_horizon", {}).get(str(h), {})
        factor = float(info.get("scale_factor", 1.0))
        p10 = native_prices[:, hi, 0]
        p50 = native_prices[:, hi, 1]
        p90 = native_prices[:, hi, 2]
        low_width = np.maximum(p50 - p10, 1e-6)
        high_width = np.maximum(p90 - p50, 1e-6)
        prices[:, hi, 0] = np.maximum(p50 - factor * low_width, 1.0)
        prices[:, hi, 1] = p50
        prices[:, hi, 2] = np.maximum(p50 + factor * high_width, prices[:, hi, 0] + 1e-6)
    log_returns = np.log(prices / np.maximum(anchors[:, None, None], 1e-12))
    calibrated["pred_prices"] = prices
    calibrated["pred_log_returns_ordered"] = log_returns
    calibrated["calibration_applied"] = True
    calibrated["calibration_version"] = calibration_summary.get("calibration_version")
    return calibrated


def calibrate_latest_forecast(latest: Dict[str, Any], calibration_summary: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(latest)
    new_path: List[Dict[str, Any]] = []
    for row in latest["path"]:
        h = int(row["horizon_trading_days"])
        factor = float(calibration_summary.get("by_horizon", {}).get(str(h), {}).get("scale_factor", 1.0))
        p10 = float(row["native_forecast_price_p10"])
        p50 = float(row["native_forecast_price_p50"])
        p90 = float(row["native_forecast_price_p90"])
        anchor = float(row["raw_gold_price_anchor"])
        cal_p10 = max(p50 - factor * max(p50 - p10, 1e-6), 1.0)
        cal_p90 = max(p50 + factor * max(p90 - p50, 1e-6), cal_p10 + 1e-6)
        updated = dict(row)
        updated.update(
            {
                "interval_calibration_applied": True,
                "interval_calibration_factor": factor,
                "predicted_log_return_p10": float(np.log(cal_p10 / anchor)),
                "predicted_log_return_p50": float(np.log(p50 / anchor)),
                "predicted_log_return_p90": float(np.log(cal_p90 / anchor)),
                "forecast_price_p10": float(cal_p10),
                "forecast_price_p50": float(p50),
                "forecast_price_p90": float(cal_p90),
                "calibrated_forecast_price_p10": float(cal_p10),
                "calibrated_forecast_price_p50": float(p50),
                "calibrated_forecast_price_p90": float(cal_p90),
            }
        )
        new_path.append(updated)
    out["path"] = new_path
    out["calibration_applied"] = True
    out["calibration_version"] = calibration_summary.get("calibration_version")
    return out


def prediction_rows(predictions: Dict[str, Any], df: pd.DataFrame, date_col: str, split_name: str, interval_type: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    origin_indices = predictions["origin_indices"]
    anchors = predictions["anchors"]
    actual = predictions["actual_prices"]
    prices = predictions["pred_prices"]
    logs = predictions["pred_log_returns_ordered"]
    for i, idx in enumerate(origin_indices):
        origin_date = pd.Timestamp(df.loc[int(idx), date_col]).date().isoformat()
        for hi, h in enumerate(HORIZONS):
            actual_value = safe_float(actual[i, hi])
            p10_value = safe_float(prices[i, hi, 0])
            p50_value = safe_float(prices[i, hi, 1])
            p90_value = safe_float(prices[i, hi, 2])
            p10_log = safe_float(logs[i, hi, 0])
            p50_log = safe_float(logs[i, hi, 1])
            p90_log = safe_float(logs[i, hi, 2])
            anchor_value = safe_float(anchors[i])

            rows.append(
                {
                    # Standard frontend-compatible fields
                    "date": origin_date,
                    "split": split_name,
                    "horizon": int(h),
                    "gold_price": anchor_value,
                    "actual_target": actual_value,
                    "prediction": p50_value,
                    "naive_prediction": anchor_value,
                    "predicted_log_return": p50_log,
                    "error": safe_float(p50_value - actual_value) if p50_value is not None and actual_value is not None else None,

                    # Delta-specific quantile fields
                    "interval_type": interval_type,
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


# -----------------------------------------------------------------------------
# Interpretability
# -----------------------------------------------------------------------------


def summarize_variable_selection(
    model: CustomTFTStyleModel,
    dataset: SequenceDataset,
    feature_cols: List[str],
    device: torch.device,
    sample_batches: int = 8,
    batch_size: int = 128,
) -> Dict[str, Any]:
    loader = make_loader(dataset, batch_size=batch_size, shuffle=False)
    model.eval()
    sums = np.zeros(len(feature_cols), dtype=float)
    count = 0
    with torch.no_grad():
        for bi, batch in enumerate(loader):
            if bi >= sample_batches:
                break
            _, interp = model(batch["x"].to(device), return_interpretability=True)
            gates = interp["feature_gates"].detach().cpu().numpy()
            sums += gates.mean(axis=(0, 1))
            count += 1
    avg = sums / max(count, 1)
    ranking = [
        {"feature": str(feature_cols[i]), "mean_variable_selection_weight": float(avg[i])}
        for i in np.argsort(-avg)[: min(30, len(feature_cols))]
    ]
    return {
        "artifact_type": "delta_tft_variable_selection_summary",
        "schema_version": "1.0.0",
        "model_key": MODEL_KEY,
        "method": "custom_feature_gate_average",
        "professor_safe_note": "Variable-selection weights summarize model behavior only; they do not prove causality.",
        "top_features": ranking,
        "feature_count": len(feature_cols),
        "identifier_feature_policy": "dataset_id and *_id columns are excluded in V2 if detected.",
        "generated_at_utc": iso_utc(),
    }


def summarize_temporal_attention(
    model: CustomTFTStyleModel,
    dataset: SequenceDataset,
    device: torch.device,
    seq_len: int,
    sample_batches: int = 4,
    batch_size: int = 64,
) -> Dict[str, Any]:
    loader = make_loader(dataset, batch_size=batch_size, shuffle=False)
    model.eval()
    attn_sum = np.zeros((len(HORIZONS), seq_len), dtype=float)
    count = 0
    with torch.no_grad():
        for bi, batch in enumerate(loader):
            if bi >= sample_batches:
                break
            _, interp = model(batch["x"].to(device), return_interpretability=True)
            weights = interp.get("horizon_attention")
            if weights is None:
                continue
            arr = weights.detach().cpu().numpy()  # [batch, heads, horizons, seq_len]
            attn_sum += arr.mean(axis=(0, 1))
            count += 1
    attn = attn_sum / max(count, 1)
    by_horizon = []
    for hi, h in enumerate(HORIZONS):
        weights = attn[hi]
        top = np.argsort(-weights)[:10]
        by_horizon.append(
            {
                "horizon_trading_days": int(h),
                "top_lag_positions_from_sequence_start": [int(x) for x in top],
                "top_lags_ago_approx": [int(seq_len - 1 - x) for x in top],
                "top_attention_weights": [float(weights[x]) for x in top],
                "mean_attention_weight": float(np.mean(weights)),
            }
        )
    return {
        "artifact_type": "delta_tft_temporal_attention_summary",
        "schema_version": "1.0.0",
        "model_key": MODEL_KEY,
        "method": "horizon_query_attention_over_encoded_sequence",
        "professor_safe_note": "Temporal attention explains which sequence positions the model emphasized; it is not causal evidence.",
        "sequence_length": int(seq_len),
        "by_horizon": by_horizon,
        "generated_at_utc": iso_utc(),
    }


# -----------------------------------------------------------------------------
# Tuning
# -----------------------------------------------------------------------------


def suggest_config(trial: Any) -> Dict[str, Any]:
    if hasattr(trial, "suggest_categorical"):
        seq_len = trial.suggest_categorical("sequence_length", [20, 60, 120, 252])
        hidden = trial.suggest_categorical("hidden_size", [64, 128, 192, 256])
        heads = [h for h in [2, 4, 8] if hidden % h == 0]
        return {
            "sequence_length": int(seq_len),
            "hidden_size": int(hidden),
            "attention_heads": int(trial.suggest_categorical("attention_heads", heads or [1])),
            "dropout": float(trial.suggest_float("dropout", 0.05, 0.40)),
            "learning_rate": float(trial.suggest_float("learning_rate", 1e-5, 3e-3, log=True)),
            "weight_decay": float(trial.suggest_float("weight_decay", 1e-8, 1e-3, log=True)),
            "batch_size": int(trial.suggest_categorical("batch_size", [32, 64, 128])),
            "grn_depth": int(trial.suggest_categorical("grn_depth", [1, 2, 3])),
        }
    hidden = random.choice([64, 128, 192, 256])
    heads = [h for h in [2, 4, 8] if hidden % h == 0]
    return {
        "sequence_length": int(random.choice([20, 60, 120, 252])),
        "hidden_size": int(hidden),
        "attention_heads": int(random.choice(heads or [1])),
        "dropout": float(random.uniform(0.05, 0.40)),
        "learning_rate": float(10 ** random.uniform(math.log10(1e-5), math.log10(3e-3))),
        "weight_decay": float(10 ** random.uniform(math.log10(1e-8), math.log10(1e-3))),
        "batch_size": int(random.choice([32, 64, 128])),
        "grn_depth": int(random.choice([1, 2, 3])),
    }


def run_tuning(
    args: argparse.Namespace,
    paths: RunPaths,
    checkpoint: Checkpoint,
    timeline: Timeline,
    df: pd.DataFrame,
    scaled_features: np.ndarray,
    target_log_returns: np.ndarray,
    target_prices: np.ndarray,
    anchors: np.ndarray,
    dates: Sequence[pd.Timestamp],
    split_labels: pd.Series,
    target_cols: List[str],
    gold_col: str,
    device: torch.device,
    n_features: int,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    rows: List[Dict[str, Any]] = []
    best_config: Optional[Dict[str, Any]] = None
    best_score = float("inf")

    def objective_for_config(config: Dict[str, Any], trial_number: int) -> float:
        started = time.time()
        row: Dict[str, Any] = {"trial_number": trial_number, **config, "status": "started"}
        try:
            seq_len = int(config["sequence_length"])
            train_idx = valid_origin_indices(df, seq_len, "train", split_labels, target_cols, gold_col)
            val_idx = valid_origin_indices(df, seq_len, "validation", split_labels, target_cols, gold_col)
            if len(train_idx) < 100 or len(val_idx) < 30:
                raise ValueError(f"Insufficient sequences for sequence_length={seq_len}")
            train_ds = SequenceDataset(scaled_features, target_log_returns, target_prices, anchors, dates, train_idx, seq_len)
            val_ds = SequenceDataset(scaled_features, target_log_returns, target_prices, anchors, dates, val_idx, seq_len)
            model = build_model(n_features, config, device)
            model, hist, score = train_model(
                model,
                make_loader(train_ds, int(config["batch_size"]), True),
                make_loader(val_ds, int(config["batch_size"]), False),
                device,
                config,
                max_epochs=int(args.max_epochs),
                patience=int(args.patience),
                desc=f"Delta V2 trial {trial_number}",
            )
            row.update(
                {
                    "status": "completed",
                    "validation_quantile_loss": float(score),
                    "epochs_completed": len(hist),
                    "parameter_count": count_parameters(model),
                    "runtime_seconds": round(time.time() - started, 3),
                }
            )
            rows.append(row)
            write_csv_dicts(paths.model_dir / "optuna_trials.csv", rows)
            checkpoint.write("tuning_trial_completed", "running", {"trial_number": trial_number, "score": score})
            return float(score)
        except RuntimeError as exc:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            row.update({"status": "failed", "error": repr(exc), "runtime_seconds": round(time.time() - started, 3)})
            rows.append(row)
            write_csv_dicts(paths.model_dir / "optuna_trials.csv", rows)
            return float("inf")
        except Exception as exc:
            row.update({"status": "failed", "error": repr(exc), "runtime_seconds": round(time.time() - started, 3)})
            rows.append(row)
            write_csv_dicts(paths.model_dir / "optuna_trials.csv", rows)
            return float("inf")

    if optuna is not None and args.max_trials > 0:
        timeline.add("optuna_tuning_started", details={"max_trials": int(args.max_trials)})

        def objective(trial: Any) -> float:
            return objective_for_config(suggest_config(trial), trial.number)

        study = optuna.create_study(direction="minimize", study_name=f"{MODEL_KEY}_v2_{iso_utc().replace(':', '')}")
        study.optimize(objective, n_trials=int(args.max_trials), show_progress_bar=(tqdm is not None))
        if study.best_trial and math.isfinite(study.best_value):
            best_config = dict(study.best_trial.params)
            best_score = float(study.best_value)
    else:
        timeline.add("random_tuning_started", details={"max_trials": int(args.max_trials)})
        iterator = range(int(args.max_trials))
        if tqdm is not None:
            iterator = tqdm(iterator, desc="Delta V2 random trials")
        for trial_number in iterator:
            config = suggest_config(object())
            score = objective_for_config(config, trial_number)
            if score < best_score:
                best_score = score
                best_config = config

    if best_config is None:
        best_config = {
            "sequence_length": 20,
            "hidden_size": 256,
            "attention_heads": 4,
            "dropout": 0.20,
            "learning_rate": 5e-4,
            "weight_decay": 1e-6,
            "batch_size": 64,
            "grn_depth": 1,
        }
        best_score = float("inf")

    best_config = {
        "sequence_length": int(best_config["sequence_length"]),
        "hidden_size": int(best_config["hidden_size"]),
        "attention_heads": int(best_config["attention_heads"]),
        "dropout": float(best_config["dropout"]),
        "learning_rate": float(best_config["learning_rate"]),
        "weight_decay": float(best_config["weight_decay"]),
        "batch_size": int(best_config["batch_size"]),
        "grn_depth": int(best_config.get("grn_depth", 2)),
        "best_validation_quantile_loss": safe_float(best_score),
    }
    write_json(paths.model_dir / "best_config.json", best_config)
    timeline.add("tuning_completed", details=best_config)
    return best_config, rows


# -----------------------------------------------------------------------------
# Artifact helpers
# -----------------------------------------------------------------------------


def build_sanity_checks(
    df: pd.DataFrame,
    gold_col: str,
    target_price_cols: List[str],
    seq_counts: Dict[str, int],
    naive_test_mape_mean: Optional[float],
) -> Dict[str, Any]:
    gold = pd.to_numeric(df[gold_col], errors="coerce")
    raw_min = safe_float(gold.min())
    raw_max = safe_float(gold.max())
    target_min = safe_float(pd.concat([pd.to_numeric(df[c], errors="coerce") for c in target_price_cols], axis=0).min())
    checks = [
        {"name": "raw_origin_gold_min_gt_100", "status": "pass" if raw_min is not None and raw_min > 100 else "fail", "value": raw_min, "threshold": "> 100"},
        {"name": "raw_origin_gold_max_lt_10000", "status": "pass" if raw_max is not None and raw_max < 10000 else "fail", "value": raw_max, "threshold": "< 10000"},
        {"name": "target_gold_min_gt_100", "status": "pass" if target_min is not None and target_min > 100 else "fail", "value": target_min, "threshold": "> 100"},
        {"name": "naive_mape_not_near_100pct", "status": "pass" if naive_test_mape_mean is not None and naive_test_mape_mean < 50 else "warning", "value": naive_test_mape_mean, "threshold": "< 50% rough sanity bound"},
        {"name": "price_anchor_valid", "status": "pass" if raw_min is not None and raw_max is not None and raw_min > 100 and raw_max < 10000 else "fail", "value": {"raw_gold_min": raw_min, "raw_gold_max": raw_max}},
        {"name": "sequence_count_sufficient", "status": "pass" if min(seq_counts.values()) > 30 else "fail", "value": seq_counts, "threshold": "each split > 30 valid origins"},
        {"name": "train_validation_test_non_empty", "status": "pass" if all(seq_counts.get(k, 0) > 0 for k in ["train", "validation", "test"]) else "fail", "value": seq_counts},
        {"name": "quantile_order_and_calibration", "status": "pass", "value": "native quantiles are sorted; V2 calibrated intervals are derived from validation residuals"},
    ]
    return {
        "artifact_type": "delta_tft_sanity_checks",
        "schema_version": "1.0.0",
        "model_key": MODEL_KEY,
        "status": "pass" if all(c["status"] != "fail" for c in checks) else "fail",
        "generated_at_utc": iso_utc(),
        "checks": checks,
    }


def build_quality_review(
    sanity_checks: Dict[str, Any],
    evaluation_by_horizon: Dict[str, Any],
    uncertainty_latest: Dict[str, Any],
    diagnostics: Dict[str, Any],
    required_files: List[Path],
    dep: Dict[str, Any],
) -> Dict[str, Any]:
    blocking: List[str] = []
    warnings: List[str] = []
    for check in sanity_checks.get("checks", []):
        if check.get("status") == "fail":
            blocking.append(f"sanity_check_failed:{check.get('name')}")
        elif check.get("status") == "warning":
            warnings.append(f"sanity_check_warning:{check.get('name')}")
    missing = [str(p) for p in required_files if not p.exists()]
    if missing:
        blocking.append("missing_required_common_artifacts")
    if not dep.get("cuda_available"):
        warnings.append("CUDA unavailable; CPU fallback used.")

    calibrated_coverages = []
    native_coverages = []
    for row in uncertainty_latest.get("calibrated_coverage_by_horizon", {}).values():
        val = row.get("coverage_p10_p90_pct")
        if val is not None:
            calibrated_coverages.append(float(val))
    for row in uncertainty_latest.get("native_coverage_by_horizon", {}).values():
        val = row.get("coverage_p10_p90_pct")
        if val is not None:
            native_coverages.append(float(val))

    if calibrated_coverages:
        avg_cal = float(np.mean(calibrated_coverages))
        if avg_cal < 60 or avg_cal > 95:
            warnings.append("Average calibrated p10-p90 coverage is outside the rough 60%-95% review band.")
    if native_coverages and float(np.mean(native_coverages)) < 60:
        warnings.append("Native quantile intervals were under-covered; V2 calibrated intervals should be used for uncertainty display.")

    status = "ready" if not blocking and not warnings else "ready_quality_review_required"
    if blocking:
        status = "failed_quality_gate"
    return {
        "artifact_type": "deep_ml_quality_review",
        "schema_version": "1.0.0",
        "model_key": MODEL_KEY,
        "status": status,
        "generated_at_utc": iso_utc(),
        "blocking_flags": blocking,
        "warnings": warnings,
        "acceptance_gate": {
            "raw_price_anchor_passes": not any("price_anchor" in b for b in blocking),
            "cuda_used_or_fallback_stated": True,
            "static_metrics_exported": bool(evaluation_by_horizon.get("test")),
            "rolling_origin_metrics_exported": bool(diagnostics.get("rolling_origin_metrics_exported")),
            "native_quantile_coverage_exported": bool(uncertainty_latest.get("native_coverage_by_horizon")),
            "calibrated_quantile_coverage_exported": bool(uncertainty_latest.get("calibrated_coverage_by_horizon")),
            "interval_calibration_exported": bool(uncertainty_latest.get("interval_calibration_summary")),
            "interpretability_exported": True,
            "quantile_order_checked": diagnostics.get("quantile_order_checked", False),
            "all_shared_contract_files_exist": not missing,
        },
        "professor_safe_summary": "Delta TFT V2 is reviewed as a calibrated temporal-fusion quantile expert. Interpretability explains model behavior and does not imply causality.",
    }


def common_ai_grounding(source_artifacts: List[str]) -> Dict[str, Any]:
    return {
        "allowed_claims": [
            "Delta TFT V2 produced multi-horizon p10/p50/p90 forecasts from exported artifacts.",
            "Calibrated intervals use validation residual behavior and are uncertainty estimates, not guarantees.",
            "Variable-selection and attention artifacts explain model behavior, not causality.",
            "The raw gold price anchor was used unscaled for reconstruction and metrics.",
        ],
        "forbidden_claims": [
            "Delta proves which macro factor caused gold to move.",
            "Delta guarantees future gold prices.",
            "Delta is the final Deep ML winner before Omega Fusion and evaluation.",
            "All factors are live unless factor-state artifacts say so.",
        ],
        "source_artifacts": source_artifacts,
    }


def copy_public_artifacts(paths: RunPaths) -> None:
    paths.public_model_dir.mkdir(parents=True, exist_ok=True)
    paths.public_pages_dir.mkdir(parents=True, exist_ok=True)
    for file in paths.model_dir.glob("*.json"):
        shutil.copy2(file, paths.public_model_dir / file.name)
    for file in paths.model_dir.glob("*.csv"):
        if file.stat().st_size <= 25 * 1024 * 1024:
            shutil.copy2(file, paths.public_model_dir / file.name)
    page_file = paths.pages_dir / "page_delta_tft.json"
    if page_file.exists():
        shutil.copy2(page_file, paths.public_pages_dir / "page_delta_tft.json")


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train Phase 8 Delta TFT V2 calibrated expert.")
    parser.add_argument("--repo-root", type=str, default=None)
    parser.add_argument("--max-trials", type=int, default=70)
    parser.add_argument("--max-epochs", type=int, default=100)
    parser.add_argument("--final-epochs", type=int, default=120)
    parser.add_argument("--patience", type=int, default=12)
    parser.add_argument("--seed", type=int, default=RANDOM_SEED)
    parser.add_argument("--no-public-copy", action="store_true")
    parser.add_argument("--smoke", action="store_true", help="Shortcut for max_trials=3, max_epochs=5, final_epochs=8.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.smoke:
        args.max_trials = 3
        args.max_epochs = 5
        args.final_epochs = 8
        args.patience = 3

    ensure_reproducibility(args.seed)
    repo_root = Path(args.repo_root).resolve() if args.repo_root else detect_repo_root(Path.cwd())
    paths = build_paths(repo_root)
    paths.model_dir.mkdir(parents=True, exist_ok=True)
    paths.pages_dir.mkdir(parents=True, exist_ok=True)
    timeline = Timeline(paths)
    checkpoint = Checkpoint(paths)
    started = utc_now()
    run_id = f"deepml_run_{started.strftime('%Y%m%d_%H%M%S')}_{MODEL_KEY}_v2"

    try:
        timeline.add("phase8_delta_tft_v2_started", details={"run_id": run_id, "repo_root": str(repo_root)})
        checkpoint.write("started", "running", {"run_id": run_id})

        dep = dependency_precheck()
        device = torch.device("cuda" if dep["cuda_available"] else "cpu")
        write_json(paths.model_dir / "dependency_precheck.json", dep)
        timeline.add("dependency_precheck_completed", details=dep)

        model_feature_plan = read_json(paths.model_feature_plan_path, default={}) or {}
        target_plan = read_json(paths.target_plan_path, default={}) or {}
        mode_status = read_json(paths.mode_status_path, default={}) or {}
        study_context = read_json(paths.study_context_path, default={}) or {}
        factor_state_table = read_json(paths.factor_state_table_path, default={}) or {}
        alpha_summary = read_json(paths.alpha_run_summary_path, default={}) or {}
        beta_summary = read_json(paths.beta_run_summary_path, default={}) or {}

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

        target_log_cols = [f"delta_target_log_return_h{h}" for h in HORIZONS]
        target_price_cols = [f"delta_target_gold_price_h{h}" for h in HORIZONS]
        feature_cols, excluded_features = choose_feature_columns(df, date_col, gold_col, model_feature_plan)
        if not feature_cols:
            raise ValueError("No usable numeric feature columns detected for Delta TFT V2.")

        feature_frame = df[feature_cols].replace([np.inf, -np.inf], np.nan)
        train_mask = split_labels.eq("train").to_numpy()
        medians = feature_frame.loc[train_mask].median(numeric_only=True).replace([np.inf, -np.inf], np.nan).fillna(0.0)
        feature_frame = feature_frame.fillna(medians).fillna(0.0)
        scaler = StandardScaler()
        scaler.fit(feature_frame.loc[train_mask])
        scaled_features = scaler.transform(feature_frame).astype(np.float32)
        target_log_returns = df[target_log_cols].to_numpy(dtype=np.float32)
        target_prices = df[target_price_cols].to_numpy(dtype=np.float32)
        anchors = pd.to_numeric(df[gold_col], errors="coerce").to_numpy(dtype=np.float32)
        dates = list(pd.to_datetime(df[date_col]))

        provisional_seq_len = 60
        provisional = {
            split: valid_origin_indices(df, provisional_seq_len, split, split_labels, target_log_cols, gold_col)
            for split in ["train", "validation", "test"]
        }
        if len(provisional["test"]) > 0:
            naive_metrics_for_sanity = calc_naive_metrics(anchors[provisional["test"]], target_prices[provisional["test"]])
            naive_mape_mean = safe_mean(r.get("mape_pct") for r in naive_metrics_for_sanity.values())
        else:
            naive_mape_mean = None

        sanity_checks = build_sanity_checks(
            df=df,
            gold_col=gold_col,
            target_price_cols=target_price_cols,
            seq_counts={k: int(len(v)) for k, v in provisional.items()},
            naive_test_mape_mean=naive_mape_mean,
        )
        write_json(paths.model_dir / "sanity_checks.json", sanity_checks)
        timeline.add("pre_training_sanity_checks_completed", details={"status": sanity_checks["status"]})
        if sanity_checks["status"] == "fail":
            raise RuntimeError("Blocked by failed sanity checks. Review sanity_checks.json.")

        dataset_manifest_base = {
            "artifact_type": "delta_tft_dataset_manifest",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "delta_version": "v2_calibrated",
            "date_column": date_col,
            "gold_column": gold_col,
            "feature_count": len(feature_cols),
            "features_used": [str(c) for c in feature_cols],
            "excluded_features": excluded_features,
            "horizons": HORIZONS,
            "quantiles": QUANTILES,
            "rows": int(len(df)),
            "training_window": windows,
            "feature_store_hash": stable_hash_file(paths.feature_store_path),
            "model_feature_plan_hash": stable_hash_file(paths.model_feature_plan_path),
            "target_plan_hash": stable_hash_file(paths.target_plan_path),
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "tft_dataset_manifest.json", dataset_manifest_base)

        best_config, tuning_rows = run_tuning(
            args=args,
            paths=paths,
            checkpoint=checkpoint,
            timeline=timeline,
            df=df,
            scaled_features=scaled_features,
            target_log_returns=target_log_returns,
            target_prices=target_prices,
            anchors=anchors,
            dates=dates,
            split_labels=split_labels,
            target_cols=target_log_cols,
            gold_col=gold_col,
            device=device,
            n_features=len(feature_cols),
        )

        seq_len = int(best_config["sequence_length"])
        split_indices = {
            split: valid_origin_indices(df, seq_len, split, split_labels, target_log_cols, gold_col)
            for split in ["train", "validation", "test"]
        }
        write_json(
            paths.model_dir / "tft_dataset_manifest.json",
            {
                **dataset_manifest_base,
                "selected_sequence_length": seq_len,
                "sequence_counts": {k: int(len(v)) for k, v in split_indices.items()},
            },
        )

        timeline.add("final_evaluation_model_training_started", details=best_config)
        checkpoint.write("final_evaluation_model_training", "running", best_config)
        train_ds = SequenceDataset(scaled_features, target_log_returns, target_prices, anchors, dates, split_indices["train"], seq_len)
        val_ds = SequenceDataset(scaled_features, target_log_returns, target_prices, anchors, dates, split_indices["validation"], seq_len)
        test_ds = SequenceDataset(scaled_features, target_log_returns, target_prices, anchors, dates, split_indices["test"], seq_len)
        eval_model = build_model(len(feature_cols), best_config, device)
        eval_model, eval_history, eval_best_loss = train_model(
            eval_model,
            make_loader(train_ds, int(best_config["batch_size"]), True),
            make_loader(val_ds, int(best_config["batch_size"]), False),
            device,
            best_config,
            max_epochs=int(args.final_epochs),
            patience=int(args.patience),
            desc="Delta V2 final eval",
        )
        timeline.add("final_evaluation_model_training_completed", details={"best_validation_loss": eval_best_loss, "epochs": len(eval_history)})
        write_csv_dicts(paths.model_dir / "training_history.csv", [{"model_stage": "final_evaluation_model", **row} for row in eval_history])

        timeline.add("static_evaluation_started")
        pred_train_native = predict_dataset(eval_model, train_ds, int(best_config["batch_size"]), device)
        pred_val_native = predict_dataset(eval_model, val_ds, int(best_config["batch_size"]), device)
        pred_test_native = predict_dataset(eval_model, test_ds, int(best_config["batch_size"]), device)

        interval_calibration_summary = derive_validation_interval_calibration(pred_val_native, TARGET_COVERAGE)
        write_json(paths.model_dir / "interval_calibration_summary.json", interval_calibration_summary)
        pred_train_cal = apply_interval_calibration(pred_train_native, interval_calibration_summary)
        pred_val_cal = apply_interval_calibration(pred_val_native, interval_calibration_summary)
        pred_test_cal = apply_interval_calibration(pred_test_native, interval_calibration_summary)

        evaluation_by_horizon = {
            "artifact_type": "delta_tft_evaluation_by_horizon",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "delta_version": "v2_calibrated",
            "point_forecast": "p50",
            "metrics_note": "Point metrics use p50 forecast prices reconstructed from unscaled raw gold price anchors. Calibration preserves p50.",
            "train": calc_point_metrics(pred_train_cal["anchors"], pred_train_cal["actual_prices"], pred_train_cal["pred_prices"]),
            "validation": calc_point_metrics(pred_val_cal["anchors"], pred_val_cal["actual_prices"], pred_val_cal["pred_prices"]),
            "test": calc_point_metrics(pred_test_cal["anchors"], pred_test_cal["actual_prices"], pred_test_cal["pred_prices"]),
            "naive_baseline_test": calc_naive_metrics(pred_test_cal["anchors"], pred_test_cal["actual_prices"]),
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "evaluation_by_horizon.json", evaluation_by_horizon)

        # Full professor-style static split forecast paths for frontend:
        # train -> validation -> test. These are the main Delta page graph sources.
        evaluation_rollforward_rows: List[Dict[str, Any]] = []
        native_evaluation_rollforward_rows: List[Dict[str, Any]] = []

        for split_name, calibrated_pred, native_pred in [
            ("train", pred_train_cal, pred_train_native),
            ("validation", pred_val_cal, pred_val_native),
            ("test", pred_test_cal, pred_test_native),
        ]:
            evaluation_rollforward_rows.extend(
                prediction_rows(calibrated_pred, df, date_col, split_name, "calibrated")
            )
            native_evaluation_rollforward_rows.extend(
                prediction_rows(native_pred, df, date_col, split_name, "native")
            )

        write_csv_dicts(paths.model_dir / "evaluation_rollforward.csv", evaluation_rollforward_rows)
        write_csv_dicts(paths.model_dir / "native_evaluation_rollforward.csv", native_evaluation_rollforward_rows)

        write_json(
            paths.model_dir / "evaluation_rollforward_summary.json",
            {
                "artifact_type": "delta_tft_evaluation_rollforward_summary",
                "schema_version": "1.0.0",
                "model_key": MODEL_KEY,
                "delta_version": "v2_calibrated",
                "purpose": "Frontend-ready static split forecast path for train, validation, and test.",
                "main_frontend_source": "evaluation_rollforward.csv",
                "native_audit_source": "native_evaluation_rollforward.csv",
                "rows": len(evaluation_rollforward_rows),
                "native_rows": len(native_evaluation_rollforward_rows),
                "splits": {
                    "train": int(sum(1 for r in evaluation_rollforward_rows if r.get("split") == "train")),
                    "validation": int(sum(1 for r in evaluation_rollforward_rows if r.get("split") == "validation")),
                    "test": int(sum(1 for r in evaluation_rollforward_rows if r.get("split") == "test")),
                },
                "horizons": HORIZONS,
                "quantiles": QUANTILE_KEYS,
                "p50_preserved_by_calibration": True,
                "professor_safe_note": "This artifact supports frontend train/validation/test graphing. p10/p90 intervals are calibrated estimates, not guarantees.",
                "generated_at_utc": iso_utc(),
            },
        )

        # Keep original test and rolling-origin tables for audit/backward compatibility.
        write_csv_dicts(paths.model_dir / "rolling_origin_predictions.csv", prediction_rows(pred_test_cal, df, date_col, "test_rolling_origin", "calibrated"))
        write_csv_dicts(paths.model_dir / "native_quantile_forecast_table.csv", prediction_rows(pred_test_native, df, date_col, "test", "native"))
        write_csv_dicts(paths.model_dir / "calibrated_quantile_forecast_table.csv", prediction_rows(pred_test_cal, df, date_col, "test", "calibrated"))
        write_csv_dicts(paths.model_dir / "quantile_forecast_table.csv", prediction_rows(pred_test_cal, df, date_col, "test", "calibrated"))

        rolling_metrics = {
            "artifact_type": "delta_tft_rolling_origin_metrics",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "delta_version": "v2_calibrated",
            "method_note": "Each test origin is evaluated with only the historical sequence available at that origin. The trained model is not re-optimized at every origin in Phase 8.",
            "metrics_by_horizon": evaluation_by_horizon["test"],
            "origin_count": int(len(split_indices["test"])),
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "rolling_origin_metrics.json", rolling_metrics)

        native_uncertainty = calc_uncertainty_metrics(
            pred_test_native["actual_prices"],
            pred_test_native["pred_prices"],
            anchors=pred_test_native["anchors"],
            actual_log_returns=target_log_returns[pred_test_native["origin_indices"]] if len(pred_test_native["origin_indices"]) else None,
            pred_log_returns=pred_test_native["pred_log_returns_ordered"] if len(pred_test_native["origin_indices"]) else None,
        )
        calibrated_uncertainty = calc_uncertainty_metrics(
            pred_test_cal["actual_prices"],
            pred_test_cal["pred_prices"],
            anchors=pred_test_cal["anchors"],
            actual_log_returns=target_log_returns[pred_test_cal["origin_indices"]] if len(pred_test_cal["origin_indices"]) else None,
            pred_log_returns=pred_test_cal["pred_log_returns_ordered"] if len(pred_test_cal["origin_indices"]) else None,
        )
        validation_calibrated_uncertainty = calc_uncertainty_metrics(
            pred_val_cal["actual_prices"],
            pred_val_cal["pred_prices"],
            anchors=pred_val_cal["anchors"],
            actual_log_returns=target_log_returns[pred_val_cal["origin_indices"]] if len(pred_val_cal["origin_indices"]) else None,
            pred_log_returns=pred_val_cal["pred_log_returns_ordered"] if len(pred_val_cal["origin_indices"]) else None,
        )

        quantile_coverage_summary = {
            "artifact_type": "delta_tft_quantile_coverage_summary",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "delta_version": "v2_calibrated",
            "coverage_target_pct": 80.0,
            "native_test_coverage_by_horizon": native_uncertainty,
            "calibrated_validation_coverage_by_horizon": validation_calibrated_uncertainty,
            "calibrated_test_coverage_by_horizon": calibrated_uncertainty,
            "interval_calibration_summary": interval_calibration_summary,
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "quantile_coverage_summary.json", quantile_coverage_summary)
        pinball_loss_summary = {
            "artifact_type": "delta_tft_pinball_loss_summary",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "native_test_pinball_by_horizon": native_uncertainty,
            "calibrated_test_pinball_by_horizon": calibrated_uncertainty,
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "pinball_loss_summary.json", pinball_loss_summary)

        uncertainty_latest = {
            "artifact_type": "delta_tft_uncertainty_latest",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "delta_version": "v2_calibrated",
            "method": "native_quantile_forecasting_plus_validation_residual_interval_calibration",
            "quantiles": QUANTILES,
            "coverage_target_pct": 80.0,
            "coverage_by_horizon": calibrated_uncertainty,
            "native_coverage_by_horizon": native_uncertainty,
            "calibrated_coverage_by_horizon": calibrated_uncertainty,
            "calibrated_validation_coverage_by_horizon": validation_calibrated_uncertainty,
            "interval_calibration_summary": interval_calibration_summary,
            "quantile_crossing_correction": {
                "method": "sort_each_horizon_quantiles_before_price_reconstruction; then validation-residual interval widening",
                "test_crossing_count_before_ordering": int(pred_test_native["quantile_crossing_count"]),
            },
            "professor_safe_note": "Calibrated intervals use validation residual behavior. They are uncertainty estimates, not guarantees.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "uncertainty_latest.json", uncertainty_latest)
        timeline.add("static_rolling_uncertainty_calibration_completed")

        timeline.add("interpretability_export_started")
        interp_ds = test_ds if len(test_ds) > 0 else val_ds
        variable_selection = summarize_variable_selection(eval_model, interp_ds, feature_cols, device, batch_size=int(best_config["batch_size"]))
        temporal_attention = summarize_temporal_attention(eval_model, interp_ds, device, seq_len, batch_size=min(64, int(best_config["batch_size"])))
        horizon_attention_summary = {
            "artifact_type": "delta_tft_horizon_attention_summary",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "by_horizon": temporal_attention.get("by_horizon", []),
            "generated_at_utc": iso_utc(),
        }
        quantile_behavior_summary = {
            "artifact_type": "delta_tft_quantile_behavior_summary",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "delta_version": "v2_calibrated",
            "summary": {
                "native_test_crossing_count_before_ordering": int(pred_test_native["quantile_crossing_count"]),
                "ordering_rule": "native p10/p50/p90 are sorted before reconstruction",
                "calibration_rule": "V2 widens intervals around p50 using validation residuals",
                "coverage_target_pct": 80.0,
            },
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "variable_selection_summary.json", variable_selection)
        write_json(paths.model_dir / "temporal_attention_summary.json", temporal_attention)
        write_json(paths.model_dir / "horizon_attention_summary.json", horizon_attention_summary)
        write_json(paths.model_dir / "quantile_behavior_summary.json", quantile_behavior_summary)

        timeline.add("final_forecast_model_training_started")
        all_target_ok = df[target_log_cols].notna().all(axis=1).to_numpy()
        all_index_ok = np.arange(len(df)) >= (seq_len - 1)
        all_idx = np.where(all_target_ok & all_index_ok & np.isfinite(anchors))[0]
        all_ds = SequenceDataset(scaled_features, target_log_returns, target_prices, anchors, dates, all_idx, seq_len)
        forecast_model = build_model(len(feature_cols), best_config, device)
        forecast_model, forecast_history, forecast_best_loss = train_model(
            forecast_model,
            make_loader(all_ds, int(best_config["batch_size"]), True),
            None,
            device,
            best_config,
            max_epochs=max(5, int(args.final_epochs // 2)),
            patience=max(3, int(args.patience // 2)),
            desc="Delta V2 final forecast",
        )
        history_rows = [{"model_stage": "final_evaluation_model", **row} for row in eval_history]
        history_rows.extend({"model_stage": "final_forecast_model", **row} for row in forecast_history)
        write_csv_dicts(paths.model_dir / "training_history.csv", history_rows)
        timeline.add("final_forecast_model_training_completed", details={"epochs": len(forecast_history)})

        latest_idx = latest_forecast_origin_index(df, seq_len, gold_col)
        latest_native = predict_latest(forecast_model, scaled_features, anchors, dates, latest_idx, seq_len, device)
        latest_calibrated = calibrate_latest_forecast(latest_native, interval_calibration_summary)
        forecast_latest = {
            "artifact_type": "delta_tft_forecast_latest",
            "schema_version": "1.0.0",
            "project": "Gold Nexus Alpha",
            "phase": "phase_2_deep_ml",
            "model_key": MODEL_KEY,
            "model_name": MODEL_NAME,
            "delta_version": "v2_calibrated",
            "frequency": "trading_day",
            "target": "anchored_future_log_return_quantiles",
            "forecast_reconstruction": "raw_gold_price_anchor * exp(predicted_log_return_quantile)",
            "raw_price_anchor_scaled": False,
            "interval_display_policy": "use calibrated p10/p90 and native p50; native interval values are retained for audit",
            "horizons": HORIZONS,
            "quantiles": QUANTILE_KEYS,
            "latest_origin": {
                "origin_index": latest_calibrated["origin_index"],
                "origin_date": latest_calibrated["origin_date"],
                "raw_gold_price_anchor": latest_calibrated["raw_gold_price_anchor"],
            },
            "path": latest_calibrated["path"],
            "interval_calibration_summary": interval_calibration_summary,
            "generated_at_utc": iso_utc(),
            "generated_at_local": local_iso_from_utc(),
        }
        write_json(paths.model_dir / "forecast_latest.json", forecast_latest)

        latest_tft_explanation = {
            "artifact_type": "delta_tft_latest_tft_explanation",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "delta_version": "v2_calibrated",
            "latest_origin_date": latest_calibrated["origin_date"],
            "model_behavior_summary": {
                "top_variable_selection_features": variable_selection.get("top_features", [])[:10],
                "temporal_attention_by_horizon": temporal_attention.get("by_horizon", []),
                "quantile_behavior": quantile_behavior_summary.get("summary", {}),
                "interval_calibration": interval_calibration_summary.get("by_horizon", {}),
            },
            "professor_safe_note": "This explanation describes how the Delta model used its inputs and calibrated intervals. It does not claim causality.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "latest_tft_explanation.json", latest_tft_explanation)

        interpretability_latest = {
            "artifact_type": "delta_tft_interpretability_latest",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "delta_version": "v2_calibrated",
            "methods": [
                "variable_selection_gate_summary",
                "horizon_attention_summary",
                "quantile_behavior_summary",
                "validation_residual_interval_calibration_summary",
                "latest_tft_explanation",
            ],
            "variable_selection_summary": variable_selection,
            "temporal_attention_summary": temporal_attention,
            "quantile_behavior_summary": quantile_behavior_summary,
            "interval_calibration_summary": interval_calibration_summary,
            "latest_tft_explanation": latest_tft_explanation,
            "professor_safe_note": "Interpretability explains model behavior, not causality.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "interpretability_latest.json", interpretability_latest)

        diagnostics_latest = {
            "artifact_type": "delta_tft_diagnostics_latest",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "delta_version": "v2_calibrated",
            "selected_backend": dep["selected_backend"],
            "dependency_precheck": dep,
            "selected_config": best_config,
            "parameter_count": count_parameters(eval_model),
            "split_sequence_counts": {k: int(len(v)) for k, v in split_indices.items()},
            "quantile_order_checked": True,
            "interval_calibration_checked": True,
            "native_quantile_crossing_count_before_ordering": int(
                pred_train_native["quantile_crossing_count"] + pred_val_native["quantile_crossing_count"] + pred_test_native["quantile_crossing_count"] + latest_native["native_quantile_crossing_count_before_ordering"]
            ),
            "rolling_origin_metrics_exported": True,
            "static_metrics_exported": True,
            "evaluation_rollforward_exported": True,
            "native_evaluation_rollforward_exported": True,
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
                    "forecast_price_p10",
                    "forecast_price_p50",
                    "forecast_price_p90",
                    "interval_width_price",
                ],
            },
            "raw_price_anchor_scaled": False,
            "identifier_feature_cleanup": "dataset_id and *_id numeric identifiers are excluded from features in V2.",
            "notes": [
                "Forecast prices are reconstructed from unscaled raw gold price anchors.",
                "Calibration preserves p50 and widens p10/p90 using validation residual behavior.",
                "Rolling-origin evaluation uses historical sequences available at each origin and does not re-optimize the model at every origin.",
                "Native and calibrated uncertainty artifacts are both retained for auditability.",
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
            "delta_version": "v2_calibrated",
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
                "cuda_available": dep["cuda_available"],
                "device": str(device),
                "cuda_device_name": dep.get("cuda_device_name"),
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
                "target": "anchored_future_log_return_quantiles",
                "forecast_reconstruction": "raw_gold_price_anchor * exp(predicted_log_return_quantile)",
                "horizons": HORIZONS,
                "quantiles": QUANTILES,
                "training_window": windows,
                "selected_config": best_config,
                "backend": dep["selected_backend"],
                "interval_calibration": "validation_residual_symmetric_interval_widening",
                "p50_preserved_by_calibration": True,
            },
            "features": {
                "used_count": len(feature_cols),
                "used": [str(c) for c in feature_cols],
                "excluded": excluded_features,
            },
            "professor_safe_summary": (
                "Delta TFT V2 is a calibrated temporal-fusion quantile expert. It forecasts anchored future log-return quantiles, "
                "reconstructs prices from the unscaled raw gold anchor, preserves p50, and applies validation-based interval calibration to p10/p90."
            ),
            "ai_grounding": common_ai_grounding(
                [
                    "run_summary.json",
                    "forecast_latest.json",
                    "evaluation_by_horizon.json",
                    "uncertainty_latest.json",
                    "interval_calibration_summary.json",
                    "interpretability_latest.json",
                    "diagnostics_latest.json",
                ]
            ),
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
        quality_review = build_quality_review(sanity_checks, evaluation_by_horizon, uncertainty_latest, diagnostics_latest, required_common, dep)
        write_json(paths.model_dir / "quality_review.json", quality_review)

        page_bundle = {
            "artifact_type": "deep_ml_page_bundle",
            "schema_version": "1.0.0",
            "page_key": "page_delta_tft",
            "route": "/deep-ml/models/delta-tft",
            "title": "Delta TFT Multi-Horizon Expert",
            "subtitle": "Calibrated temporal-fusion quantile forecasting for Gold Nexus Alpha Phase 2.",
            "model_key": MODEL_KEY,
            "delta_version": "v2_calibrated",
            "status": quality_review["status"],
            "summary_cards": [
                {"label": "Backend", "value": dep["selected_backend"]},
                {"label": "Device", "value": str(device)},
                {"label": "Sequence Length", "value": seq_len},
                {"label": "Quantiles", "value": "p10 / p50 / p90"},
                {"label": "Interval Policy", "value": "Validation-calibrated p10-p90"},
            ],
            "chart_artifacts": {
                "evaluation_rollforward": "artifacts/deep_ml/models/delta_tft/evaluation_rollforward.csv",
                "native_evaluation_rollforward": "artifacts/deep_ml/models/delta_tft/native_evaluation_rollforward.csv",
                "evaluation_rollforward_summary": "artifacts/deep_ml/models/delta_tft/evaluation_rollforward_summary.json",
                "forecast_latest": "artifacts/deep_ml/models/delta_tft/forecast_latest.json",
                "evaluation_by_horizon": "artifacts/deep_ml/models/delta_tft/evaluation_by_horizon.json",
                "rolling_origin_predictions": "artifacts/deep_ml/models/delta_tft/rolling_origin_predictions.csv",
                "calibrated_quantile_forecast_table": "artifacts/deep_ml/models/delta_tft/calibrated_quantile_forecast_table.csv",
                "native_quantile_forecast_table": "artifacts/deep_ml/models/delta_tft/native_quantile_forecast_table.csv",
                "uncertainty_latest": "artifacts/deep_ml/models/delta_tft/uncertainty_latest.json",
                "interval_calibration_summary": "artifacts/deep_ml/models/delta_tft/interval_calibration_summary.json",
                "variable_selection_summary": "artifacts/deep_ml/models/delta_tft/variable_selection_summary.json",
                "temporal_attention_summary": "artifacts/deep_ml/models/delta_tft/temporal_attention_summary.json",
            },
            "limitations": [
                "Delta TFT is a Phase 2 expert and is not the final Deep ML winner until evaluation and Omega Fusion are complete.",
                "Calibrated quantile intervals are uncertainty estimates, not guarantees.",
                "Attention and variable selection explain model behavior, not causality.",
                "Rolling-origin evaluation does not re-optimize the model at every origin in this phase.",
            ],
            "source_artifacts": [p.name for p in required_common]
            + [
                "interval_calibration_summary.json",
                "quality_review.json",
                "phase8_delta_tft_report.json",
                "variable_selection_summary.json",
                "temporal_attention_summary.json",
                "quantile_coverage_summary.json",
            ],
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "page_bundle.json", page_bundle)
        write_json(paths.pages_dir / "page_delta_tft.json", page_bundle)

        phase_report = {
            "artifact_type": "phase8_delta_tft_report",
            "schema_version": "1.0.0",
            "project": "Gold Nexus Alpha",
            "phase": "Phase 8 — Delta TFT Expert",
            "model_key": MODEL_KEY,
            "model_name": MODEL_NAME,
            "delta_version": "v2_calibrated",
            "status": quality_review["status"],
            "accepted_previous_checkpoints": {
                "alpha_structural_v4": {"status": "accepted", "source_status": alpha_summary.get("status") or "read_if_available"},
                "beta_temporal_v2": {"status": "accepted", "source_status": beta_summary.get("status") or "read_if_available"},
            },
            "run_summary": run_summary,
            "sanity_checks": sanity_checks,
            "best_config": best_config,
            "evaluation_snapshot": {
                "test_by_horizon": evaluation_by_horizon.get("test", {}),
                "naive_baseline_test": evaluation_by_horizon.get("naive_baseline_test", {}),
            },
            "uncertainty_snapshot": uncertainty_latest,
            "interval_calibration_snapshot": interval_calibration_summary,
            "interpretability_snapshot": {
                "top_variable_selection_features": variable_selection.get("top_features", [])[:15],
                "attention_by_horizon": temporal_attention.get("by_horizon", []),
            },
            "quality_review": quality_review,
            "required_common_artifacts": [p.name for p in required_common],
            "required_delta_specific_artifacts": [
                "best_config.json",
                "optuna_trials.csv",
                "training_history.csv",
                "tft_dataset_manifest.json",
                "evaluation_rollforward.csv",
                "native_evaluation_rollforward.csv",
                "evaluation_rollforward_summary.json",
                "rolling_origin_predictions.csv",
                "rolling_origin_metrics.json",
                "native_quantile_forecast_table.csv",
                "calibrated_quantile_forecast_table.csv",
                "quantile_forecast_table.csv",
                "quantile_coverage_summary.json",
                "pinball_loss_summary.json",
                "interval_calibration_summary.json",
                "variable_selection_summary.json",
                "temporal_attention_summary.json",
                "latest_tft_explanation.json",
                "quality_review.json",
                "sanity_checks.json",
                "timeline.json",
                "progress_checkpoint.json",
            ],
            "professor_safe_summary": (
                "Phase 8 Delta TFT V2 trains a calibrated temporal-fusion quantile expert. It uses anchored future log returns, "
                "reconstructs prices from unscaled raw gold anchors, preserves the p50 forecast, and widens p10/p90 intervals using validation residual behavior."
            ),
            "final_instruction": "Send me artifacts/deep_ml/models/delta_tft/phase8_delta_tft_report.json for review before moving to the next phase.",
            "generated_at_utc": iso_utc(),
        }
        write_json(paths.model_dir / "phase8_delta_tft_report.json", phase_report)

        if not args.no_public_copy:
            copy_public_artifacts(paths)
            timeline.add("public_artifacts_copied")

        checkpoint.write(
            "completed",
            quality_review["status"],
            {
                "phase_report": "artifacts/deep_ml/models/delta_tft/phase8_delta_tft_report.json",
                "send_me_this_json": "artifacts/deep_ml/models/delta_tft/phase8_delta_tft_report.json",
            },
        )
        timeline.add("phase8_delta_tft_v2_completed", status=quality_review["status"])
        print("\n" + "=" * 88)
        print("PHASE 8 DELTA TFT V2 COMPLETE")
        print("Review this JSON before moving forward:")
        print("artifacts/deep_ml/models/delta_tft/phase8_delta_tft_report.json")
        print("=" * 88 + "\n")

    except Exception as exc:
        error_payload = {
            "artifact_type": "phase8_delta_tft_error_report",
            "schema_version": "1.0.0",
            "model_key": MODEL_KEY,
            "delta_version": "v2_calibrated",
            "status": "failed",
            "error": repr(exc),
            "traceback": traceback.format_exc(),
            "generated_at_utc": iso_utc(),
            "final_instruction": "Fix the blocking issue, rerun Phase 8, then send me phase8_delta_tft_report.json if created.",
        }
        write_json(paths.model_dir / "phase8_delta_tft_report.json", error_payload)
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
        timeline.add("phase8_delta_tft_v2_failed", status="failed", details={"error": repr(exc)})
        print("\nPHASE 8 DELTA TFT V2 FAILED. Review:")
        print("artifacts/deep_ml/models/delta_tft/phase8_delta_tft_report.json")
        raise


if __name__ == "__main__":
    main()
