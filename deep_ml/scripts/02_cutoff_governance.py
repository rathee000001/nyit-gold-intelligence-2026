from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


# ---------------------------------------------------------
# Basic utilities
# ---------------------------------------------------------

def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def utc_now_iso() -> str:
    return utc_now().isoformat().replace("+00:00", "Z")


def find_repo_root(start: Path | None = None) -> Path:
    current = (start or Path.cwd()).resolve()
    for parent in [current, *current.parents]:
        if (parent / ".git").exists() or (parent / "package.json").exists():
            return parent
    return current


REPO_ROOT = find_repo_root()
ARTIFACT_ROOT = REPO_ROOT / "artifacts" / "deep_ml"
PUBLIC_ARTIFACT_ROOT = REPO_ROOT / "public" / "artifacts" / "deep_ml"

BASELINE_GOVERNANCE_ROOT = REPO_ROOT / "artifacts" / "governance"
BASELINE_VALIDATION_ROOT = REPO_ROOT / "artifacts" / "validation"


def read_json_if_exists(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return {
            "_read_error": str(exc),
            "_path": str(path),
        }


def write_json(path: Path, obj: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"WROTE: {path}")


def mirror_to_public(relative_path: str, obj: dict[str, Any]) -> None:
    write_json(ARTIFACT_ROOT / relative_path, obj)
    write_json(PUBLIC_ARTIFACT_ROOT / relative_path, obj)


def parse_date(value: Any) -> str | None:
    if value is None:
        return None

    if isinstance(value, str):
        # Accept YYYY-MM-DD anywhere in the string.
        match = re.search(r"\d{4}-\d{2}-\d{2}", value)
        if match:
            return match.group(0)

    return None


def recursive_find_dates(obj: Any, key_contains: list[str]) -> list[dict[str, str]]:
    found: list[dict[str, str]] = []

    def walk(value: Any, path: str = "") -> None:
        if isinstance(value, dict):
            for k, v in value.items():
                new_path = f"{path}.{k}" if path else k
                key_lower = str(k).lower()
                if any(token in key_lower for token in key_contains):
                    parsed = parse_date(v)
                    if parsed:
                        found.append({
                            "path": new_path,
                            "date": parsed,
                        })
                walk(v, new_path)

        elif isinstance(value, list):
            for i, item in enumerate(value):
                walk(item, f"{path}[{i}]")

    walk(obj)
    return found


def next_weekday(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d").date()
    next_day = dt + timedelta(days=1)

    # Weekday only for now, not official holiday calendar.
    while next_day.weekday() >= 5:
        next_day += timedelta(days=1)

    return next_day.isoformat()


def build_id(prefix: str, mode: str, effective_date: str) -> str:
    stamp = utc_now().strftime("%Y%m%d_%H%M%S")
    safe_mode = mode.replace("_mode", "").replace("_", "")
    safe_date = effective_date.replace("-", "")
    return f"{prefix}_{stamp}_{safe_mode}_{safe_date}"


def default_training_windows(effective_data_through_date: str) -> dict[str, Any]:
    return {
        "long_univariate": {
            "description": "Gold-price-only long history for univariate/reference models.",
            "train_start": "1968-01-04",
            "train_end": "2018-12-31",
            "validation_start": "2019-01-01",
            "validation_end": "2022-12-30",
            "test_start": "2023-01-02",
            "test_end": effective_data_through_date,
        },
        "core_multivariate": {
            "description": "Core multivariate window for structural/deep models. High_yield excluded from main model.",
            "train_start": "2006-01-02",
            "train_end": "2018-12-31",
            "validation_start": "2019-01-01",
            "validation_end": "2022-12-30",
            "test_start": "2023-01-02",
            "test_end": effective_data_through_date,
        },
        "live_mode_note": "If live mode uses post-cutoff spot API data, final effective_data_through_date must not exceed the latest valid required manual factor date.",
    }


# ---------------------------------------------------------
# Baseline governance inspection
# ---------------------------------------------------------

def inspect_baseline_governance() -> dict[str, Any]:
    forecast_status_path = BASELINE_GOVERNANCE_ROOT / "forecast_status.json"
    model_window_plan_path = BASELINE_GOVERNANCE_ROOT / "model_window_plan.json"
    cutoff_decision_log_path = BASELINE_GOVERNANCE_ROOT / "cutoff_decision_log.json"
    selected_model_path = BASELINE_VALIDATION_ROOT / "selected_model_summary.json"

    forecast_status = read_json_if_exists(forecast_status_path)
    model_window_plan = read_json_if_exists(model_window_plan_path)
    cutoff_decision_log = read_json_if_exists(cutoff_decision_log_path)
    selected_model = read_json_if_exists(selected_model_path)

    source_artifacts = {
        "forecast_status": {
            "path": str(forecast_status_path),
            "exists": forecast_status_path.exists(),
            "readable": forecast_status is not None and "_read_error" not in forecast_status,
        },
        "model_window_plan": {
            "path": str(model_window_plan_path),
            "exists": model_window_plan_path.exists(),
            "readable": model_window_plan is not None and "_read_error" not in model_window_plan,
        },
        "cutoff_decision_log": {
            "path": str(cutoff_decision_log_path),
            "exists": cutoff_decision_log_path.exists(),
            "readable": cutoff_decision_log is not None and "_read_error" not in cutoff_decision_log,
        },
        "selected_model_summary": {
            "path": str(selected_model_path),
            "exists": selected_model_path.exists(),
            "readable": selected_model is not None and "_read_error" not in selected_model,
        },
    }

    possible_cutoffs: list[dict[str, str]] = []

    for label, artifact in [
        ("forecast_status", forecast_status),
        ("model_window_plan", model_window_plan),
        ("cutoff_decision_log", cutoff_decision_log),
        ("selected_model_summary", selected_model),
    ]:
        if artifact and "_read_error" not in artifact:
            matches = recursive_find_dates(
                artifact,
                key_contains=[
                    "cutoff",
                    "official",
                    "valid_through",
                    "data_through",
                    "end",
                ],
            )
            for m in matches:
                possible_cutoffs.append({
                    "artifact": label,
                    "path": m["path"],
                    "date": m["date"],
                })

    return {
        "source_artifacts": source_artifacts,
        "possible_cutoff_dates": possible_cutoffs,
        "forecast_status_loaded": forecast_status is not None and "_read_error" not in forecast_status,
        "model_window_plan_loaded": model_window_plan is not None and "_read_error" not in model_window_plan,
        "selected_model_loaded": selected_model is not None and "_read_error" not in selected_model,
        "raw_selected_model_summary": selected_model if selected_model and "_read_error" not in selected_model else None,
    }


def choose_official_cutoff(baseline_inspection: dict[str, Any]) -> tuple[str, list[str]]:
    notes: list[str] = []

    # Strong default locked by the current professor-safe baseline.
    default_cutoff = "2026-03-31"

    candidates = baseline_inspection.get("possible_cutoff_dates", [])

    # Prefer exact current known cutoff if detected anywhere.
    for item in candidates:
        if item.get("date") == default_cutoff:
            notes.append(
                f"Detected official baseline cutoff {default_cutoff} from {item.get('artifact')} at {item.get('path')}."
            )
            return default_cutoff, notes

    # Prefer dates in paths that explicitly mention cutoff.
    cutoff_path_candidates = [
        item for item in candidates
        if "cutoff" in str(item.get("path", "")).lower()
    ]

    if cutoff_path_candidates:
        chosen = sorted(cutoff_path_candidates, key=lambda x: x["date"])[-1]["date"]
        notes.append(f"Chose cutoff candidate from explicit cutoff field: {chosen}.")
        return chosen, notes

    notes.append(
        f"No stronger cutoff field detected. Using locked baseline default official cutoff: {default_cutoff}."
    )
    return default_cutoff, notes


# ---------------------------------------------------------
# Main governance build
# ---------------------------------------------------------

def main() -> int:
    mode = os.environ.get("DEEPML_MODE", "official_research_mode").strip()

    if mode not in {"official_research_mode", "live_market_update_mode"}:
        raise ValueError(
            f"Invalid DEEPML_MODE={mode}. Use official_research_mode or live_market_update_mode."
        )

    generated_at_utc = utc_now_iso()

    baseline_inspection = inspect_baseline_governance()
    official_cutoff, cutoff_notes = choose_official_cutoff(baseline_inspection)

    # For Phase 2 foundation, live mode is not enabled yet.
    # Official mode effective date equals the official cutoff.
    live_gold_price_through_date = None
    manual_csv_valid_through_date = None

    if mode == "official_research_mode":
        effective_model_data_through_date = official_cutoff
        mode_warning = "Official research mode uses the validated baseline cutoff and does not depend on live API data."
    else:
        # Later Phase will compute this from actual API/manual CSV states.
        effective_model_data_through_date = official_cutoff
        mode_warning = (
            "Live mode requested, but Phase 2 foundation has not pulled API/manual data yet. "
            "Using official cutoff until source-update scripts are implemented."
        )

    forecast_start_date = next_weekday(effective_model_data_through_date)

    study_id = build_id(
        prefix="deepml_study",
        mode=mode,
        effective_date=effective_model_data_through_date,
    )
    run_batch_id = build_id(
        prefix="deepml_batch",
        mode=mode,
        effective_date=effective_model_data_through_date,
    )

    training_windows = default_training_windows(effective_model_data_through_date)

    cutoff_governance = {
        "artifact_type": "deep_ml_cutoff_governance",
        "schema_version": "1.0.0",
        "generated_at_utc": generated_at_utc,
        "phase": "phase_2_cutoff_governance",
        "mode": mode,
        "study_id": study_id,
        "run_batch_id": run_batch_id,
        "official_research_cutoff_date": official_cutoff,
        "live_gold_price_through_date": live_gold_price_through_date,
        "manual_csv_valid_through_date": manual_csv_valid_through_date,
        "effective_model_data_through_date": effective_model_data_through_date,
        "forecast_start_date": forecast_start_date,
        "cutoff_policy": {
            "official_research_mode": "Use validated baseline cutoff. Do not use provisional post-cutoff rows for academic claims.",
            "live_market_update_mode": "Use daily API gold plus manual CSV factors only after source states are explicitly computed. Effective model date cannot exceed required factor validity.",
            "weekday_policy": "Forecast start is next weekday after effective data-through date. Full market-holiday calendar is not yet applied."
        },
        "baseline_inspection": baseline_inspection,
        "cutoff_selection_notes": cutoff_notes,
        "warnings": [
            mode_warning,
            "This phase does not pull Yahoo/yfinance data yet.",
            "This phase does not read manual CSV factor updates yet.",
            "This phase does not train any model."
        ],
        "professor_safe_summary": (
            "Deep ML Phase 2 inherits the baseline cutoff discipline and separates official research mode from future live market update mode."
        ),
        "next_step": "Build factor-state/data-intelligence table from baseline factor registry and future source-update logs."
    }

    mode_status = {
        "artifact_type": "deep_ml_mode_status",
        "schema_version": "1.0.0",
        "generated_at_utc": generated_at_utc,
        "generated_at_local": None,
        "timezone_local": "America/New_York",
        "mode": mode,
        "official_research_cutoff_date": official_cutoff,
        "live_gold_price_through_date": live_gold_price_through_date,
        "manual_csv_valid_through_date": manual_csv_valid_through_date,
        "effective_model_data_through_date": effective_model_data_through_date,
        "forecast_start_date": forecast_start_date,
        "status_summary": (
            "Official research mode is active. Deep ML can proceed using the baseline effective cutoff."
            if mode == "official_research_mode"
            else
            "Live mode is requested but still uses official cutoff until live source-update scripts are implemented."
        ),
        "warnings": cutoff_governance["warnings"],
    }

    effective_data_window = {
        "artifact_type": "deep_ml_effective_data_window",
        "schema_version": "1.0.0",
        "generated_at_utc": generated_at_utc,
        "study_id": study_id,
        "run_batch_id": run_batch_id,
        "mode": mode,
        "effective_data_through_date": effective_model_data_through_date,
        "forecast_start_date": forecast_start_date,
        "training_windows": training_windows,
        "horizons_trading_days": [1, 5, 10, 20, 30],
        "target": "gold_price",
        "notes": [
            "Training windows are governance defaults for Phase 2.",
            "Later scripts may create model-specific windows, but must preserve this artifact as the source of cutoff truth."
        ]
    }

    forecast_start_decision = {
        "artifact_type": "deep_ml_forecast_start_decision",
        "schema_version": "1.0.0",
        "generated_at_utc": generated_at_utc,
        "mode": mode,
        "effective_model_data_through_date": effective_model_data_through_date,
        "forecast_start_date": forecast_start_date,
        "decision_rule": "next_weekday_after_effective_model_data_through_date",
        "holiday_calendar_applied": False,
        "notes": [
            "Weekend-only logic is used for now.",
            "Official market-holiday filtering can be added later if required."
        ]
    }

    study_context = {
        "artifact_type": "deep_ml_study_context",
        "schema_version": "1.0.0",
        "generated_at_utc": generated_at_utc,
        "study_id": study_id,
        "run_batch_id": run_batch_id,
        "mode": mode,
        "effective_data_through_date": effective_model_data_through_date,
        "forecast_start_date": forecast_start_date,
        "study_status": "initialized",
        "created_by_script": "deep_ml/scripts/02_cutoff_governance.py",
        "models_planned": [
            "alpha_structural",
            "beta_temporal",
            "delta_tft",
            "epsilon_fast_expert",
            "gamma_news_sensitivity",
            "omega_fusion"
        ],
        "frontend_safe": True,
        "notes": [
            "This is the initial study context. No model has been trained yet.",
            "Old studies will be added to study memory in later phases."
        ]
    }

    mirror_to_public("governance/deep_ml_cutoff_governance.json", cutoff_governance)
    mirror_to_public("governance/deep_ml_mode_status.json", mode_status)
    mirror_to_public("governance/effective_data_window.json", effective_data_window)
    mirror_to_public("governance/forecast_start_decision.json", forecast_start_decision)
    mirror_to_public("governance/study_context.json", study_context)

    phase2_report = {
        "artifact_type": "deep_ml_phase2_cutoff_governance_report",
        "schema_version": "1.0.0",
        "generated_at_utc": generated_at_utc,
        "status": "ready",
        "mode": mode,
        "study_id": study_id,
        "run_batch_id": run_batch_id,
        "official_research_cutoff_date": official_cutoff,
        "effective_model_data_through_date": effective_model_data_through_date,
        "forecast_start_date": forecast_start_date,
        "outputs": [
            "artifacts/deep_ml/governance/deep_ml_cutoff_governance.json",
            "artifacts/deep_ml/governance/deep_ml_mode_status.json",
            "artifacts/deep_ml/governance/effective_data_window.json",
            "artifacts/deep_ml/governance/forecast_start_decision.json",
            "artifacts/deep_ml/governance/study_context.json"
        ],
        "next_step": "Phase 3: Build factor-state/data-intelligence table."
    }

    mirror_to_public("governance/phase2_cutoff_governance_report.json", phase2_report)

    print(json.dumps(phase2_report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())