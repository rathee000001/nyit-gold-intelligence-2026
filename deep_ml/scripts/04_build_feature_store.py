from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


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


def safe_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


# ---------------------------------------------------------
# Load required prior phase artifacts
# ---------------------------------------------------------

def load_phase_inputs() -> dict[str, Any]:
    mode_status = read_json(ARTIFACT_ROOT / "governance" / "deep_ml_mode_status.json")
    effective_window = read_json(ARTIFACT_ROOT / "governance" / "effective_data_window.json")
    study_context = read_json(ARTIFACT_ROOT / "governance" / "study_context.json")
    factor_state_table = read_json(ARTIFACT_ROOT / "data" / "factor_state_table.json")
    data_quality_flags = read_json(ARTIFACT_ROOT / "data" / "data_quality_flags.json")

    return {
        "mode_status": mode_status,
        "effective_window": effective_window,
        "study_context": study_context,
        "factor_state_table": factor_state_table,
        "data_quality_flags": data_quality_flags,
    }


# ---------------------------------------------------------
# Existing baseline data detection
# ---------------------------------------------------------

def detect_possible_input_datasets() -> dict[str, Any]:
    """
    Phase 4 foundation only detects possible existing dataset files.
    It does not require them yet and does not build numeric tensors.
    """

    candidate_patterns = [
        "data/aligned/model_ready_multivariate.csv",
        "data/aligned/model_ready_univariate.csv",
        "data/aligned/weekday_clean_matrix.csv",
        "artifacts/data/model_ready_dataset_preview.json",
        "artifacts/data/weekday_matrix_preview.json",
        "public/artifacts/data/model_ready_dataset_preview.json",
        "public/artifacts/data/weekday_matrix_preview.json",
    ]

    candidates = []
    for rel in candidate_patterns:
        path = REPO_ROOT / rel
        candidates.append({
            "relative_path": rel,
            "exists": path.exists(),
            "kind": path.suffix.replace(".", "") if path.suffix else "unknown",
        })

    found = [c for c in candidates if c["exists"]]

    return {
        "candidate_count": len(candidates),
        "found_count": len(found),
        "candidates": candidates,
        "found": found,
        "note": (
            "Phase 4 does not require raw/model-ready data yet. "
            "Actual matrix loading happens in the next data-loader phase before model training."
        )
    }


# ---------------------------------------------------------
# Feature contract logic
# ---------------------------------------------------------

def build_base_feature_rows(factor_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    feature_rows: list[dict[str, Any]] = []

    for row in factor_rows:
        factor_key = row["factor_key"]

        if factor_key == "gold_price":
            role = "target"
            include_in_alpha = False
            include_in_beta = False
            include_in_delta = False
            include_in_epsilon = True
            include_in_omega = True
        elif factor_key == "high_yield":
            role = "sensitivity_only"
            include_in_alpha = False
            include_in_beta = False
            include_in_delta = False
            include_in_epsilon = False
            include_in_omega = False
        else:
            role = "exogenous_factor"
            include_in_alpha = bool(row.get("alpha_eligible"))
            include_in_beta = bool(row.get("beta_eligible"))
            include_in_delta = bool(row.get("delta_eligible"))
            include_in_epsilon = bool(row.get("epsilon_eligible"))
            include_in_omega = bool(row.get("omega_eligible"))

        feature_rows.append({
            "feature_key": factor_key,
            "source_factor": factor_key,
            "display_name": row.get("display_name", factor_key),
            "category": row.get("category"),
            "role": role,
            "source_type": row.get("source_type"),
            "current_state": row.get("current_state"),
            "valid_through_date": row.get("valid_through_date"),
            "expected_frequency": row.get("expected_frequency"),
            "include_in_alpha_structural": include_in_alpha,
            "include_in_beta_temporal": include_in_beta,
            "include_in_delta_tft": include_in_delta,
            "include_in_epsilon_fast_expert": include_in_epsilon,
            "include_in_gamma_news_sensitivity": bool(row.get("gamma_eligible")),
            "include_in_omega_fusion": include_in_omega,
            "leakage_risk": "low_if_lagged_or_observed_before_forecast_date",
            "notes": row.get("notes", "")
        })

    return feature_rows


def build_engineered_feature_plan() -> list[dict[str, Any]]:
    return [
        {
            "feature_key": "gold_lag_1",
            "source_factor": "gold_price",
            "feature_type": "lag",
            "parameters": {"lag_trading_days": 1},
            "eligible_models": ["alpha_structural", "beta_temporal", "delta_tft", "epsilon_fast_expert"],
            "leakage_rule": "Use only gold_price observed at t-1 or earlier."
        },
        {
            "feature_key": "gold_lag_5",
            "source_factor": "gold_price",
            "feature_type": "lag",
            "parameters": {"lag_trading_days": 5},
            "eligible_models": ["alpha_structural", "beta_temporal", "delta_tft", "epsilon_fast_expert"],
            "leakage_rule": "Use only gold_price observed at t-5 or earlier."
        },
        {
            "feature_key": "gold_lag_20",
            "source_factor": "gold_price",
            "feature_type": "lag",
            "parameters": {"lag_trading_days": 20},
            "eligible_models": ["alpha_structural", "beta_temporal", "delta_tft", "epsilon_fast_expert"],
            "leakage_rule": "Use only gold_price observed at t-20 or earlier."
        },
        {
            "feature_key": "gold_return_1",
            "source_factor": "gold_price",
            "feature_type": "return",
            "parameters": {"period_trading_days": 1},
            "eligible_models": ["alpha_structural", "beta_temporal", "delta_tft", "epsilon_fast_expert"],
            "leakage_rule": "Return must be calculated using past and current observed values only inside each split."
        },
        {
            "feature_key": "gold_return_5",
            "source_factor": "gold_price",
            "feature_type": "return",
            "parameters": {"period_trading_days": 5},
            "eligible_models": ["alpha_structural", "beta_temporal", "delta_tft", "epsilon_fast_expert"],
            "leakage_rule": "Return must be calculated using past and current observed values only inside each split."
        },
        {
            "feature_key": "gold_ma_5",
            "source_factor": "gold_price",
            "feature_type": "rolling_mean",
            "parameters": {"window_trading_days": 5},
            "eligible_models": ["alpha_structural", "beta_temporal", "delta_tft", "epsilon_fast_expert"],
            "leakage_rule": "Rolling mean must use historical window only."
        },
        {
            "feature_key": "gold_ma_20",
            "source_factor": "gold_price",
            "feature_type": "rolling_mean",
            "parameters": {"window_trading_days": 20},
            "eligible_models": ["alpha_structural", "beta_temporal", "delta_tft", "epsilon_fast_expert"],
            "leakage_rule": "Rolling mean must use historical window only."
        },
        {
            "feature_key": "gold_ma_60",
            "source_factor": "gold_price",
            "feature_type": "rolling_mean",
            "parameters": {"window_trading_days": 60},
            "eligible_models": ["alpha_structural", "beta_temporal", "delta_tft"],
            "leakage_rule": "Rolling mean must use historical window only."
        },
        {
            "feature_key": "gold_volatility_20",
            "source_factor": "gold_price",
            "feature_type": "rolling_volatility",
            "parameters": {"window_trading_days": 20},
            "eligible_models": ["alpha_structural", "beta_temporal", "delta_tft"],
            "leakage_rule": "Rolling volatility must use historical returns only."
        },
        {
            "feature_key": "days_since_factor_start",
            "source_factor": "all_factors",
            "feature_type": "inception_metadata",
            "parameters": {},
            "eligible_models": ["beta_temporal", "delta_tft"],
            "leakage_rule": "Inception metadata is allowed because it is calendar/source metadata, not future target information."
        },
        {
            "feature_key": "observed_mask",
            "source_factor": "all_factors",
            "feature_type": "mask",
            "parameters": {},
            "eligible_models": ["beta_temporal", "delta_tft"],
            "leakage_rule": "Mask must indicate whether value was observed or carried as of that date."
        },
        {
            "feature_key": "availability_mask",
            "source_factor": "all_factors",
            "feature_type": "mask",
            "parameters": {},
            "eligible_models": ["beta_temporal", "delta_tft"],
            "leakage_rule": "Mask must indicate whether factor was available as of that date."
        },
    ]


def build_model_feature_sets(base_features: list[dict[str, Any]], engineered: list[dict[str, Any]]) -> dict[str, Any]:
    model_keys = [
        "alpha_structural",
        "beta_temporal",
        "delta_tft",
        "epsilon_fast_expert",
        "gamma_news_sensitivity",
        "omega_fusion",
    ]

    feature_sets: dict[str, Any] = {}

    for model_key in model_keys:
        include_field = f"include_in_{model_key}"

        base = [
            row["feature_key"]
            for row in base_features
            if bool(row.get(include_field))
        ]

        eng = [
            row["feature_key"]
            for row in engineered
            if model_key in row.get("eligible_models", [])
        ]

        if model_key == "gamma_news_sensitivity":
            eng = [
                "news_war_escalation_score",
                "news_sanctions_score",
                "news_oil_supply_disruption_score",
                "news_safe_haven_demand_score",
                "news_fed_rates_pressure_score",
                "news_inflation_pressure_score",
                "news_central_bank_buying_score",
                "news_reserve_movement_score",
                "news_supply_chain_disruption_score",
                "gold_news_sensitivity_index"
            ]

        if model_key == "omega_fusion":
            base = [
                "alpha_structural_forecast",
                "beta_temporal_forecast",
                "delta_tft_forecast",
                "epsilon_fast_expert_forecast",
                "gamma_news_sensitivity_index"
            ]
            eng = [
                "model_disagreement",
                "prior_study_weight",
                "interval_width",
                "recent_error_signal"
            ]

        feature_sets[model_key] = {
            "base_features": base,
            "engineered_features": eng,
            "all_features": base + eng,
            "feature_count": len(base + eng)
        }

    return feature_sets


def build_sequence_window_plan() -> dict[str, Any]:
    return {
        "artifact_type": "deep_ml_sequence_window_plan",
        "schema_version": "1.0.0",
        "sequence_windows_trading_days": [20, 60, 120],
        "default_sequence_window_trading_days": 60,
        "forecast_horizons_trading_days": [1, 5, 10, 20, 30],
        "default_forecast_horizon_trading_days": 30,
        "models_using_sequences": ["beta_temporal", "delta_tft"],
        "window_rules": [
            "Sequence windows must be built after sorting by date.",
            "No row may use target values later than its forecast origin.",
            "Scaling must be fit on training windows only.",
            "Validation/test transformations must use training-fitted scalers."
        ]
    }


def build_target_plan(effective_data_through: str, forecast_start_date: str) -> dict[str, Any]:
    return {
        "artifact_type": "deep_ml_target_plan",
        "schema_version": "1.0.0",
        "target": "gold_price",
        "target_type": "price_level",
        "frequency": "trading_day",
        "effective_data_through_date": effective_data_through,
        "forecast_start_date": forecast_start_date,
        "horizons_trading_days": [1, 5, 10, 20, 30],
        "primary_public_horizon_trading_days": 30,
        "evaluation_targets": [
            "level_forecast",
            "directional_accuracy",
            "interval_coverage",
            "bias"
        ],
        "notes": [
            "Future versions may add return target as a secondary target.",
            "Phase 4 defines target contract only; it does not train a model."
        ]
    }


def build_leakage_safety_plan() -> dict[str, Any]:
    return {
        "artifact_type": "deep_ml_leakage_safety_plan",
        "schema_version": "1.0.0",
        "rules": [
            {
                "rule_id": "time_split_only",
                "severity": "blocking",
                "rule": "Never use random train/test split for Phase 2 forecasting models."
            },
            {
                "rule_id": "fit_scalers_on_train_only",
                "severity": "blocking",
                "rule": "Any scaler/transformer must be fitted on the training segment only inside each walk-forward window."
            },
            {
                "rule_id": "rolling_features_past_only",
                "severity": "blocking",
                "rule": "Lag, rolling mean, rolling volatility, and returns must use only historical observations available at the forecast origin."
            },
            {
                "rule_id": "no_future_exogenous_values_without_policy",
                "severity": "blocking",
                "rule": "Future exogenous values must be either known, scenario-defined, or explicitly held/forecasted with disclosure."
            },
            {
                "rule_id": "mode_separation",
                "severity": "blocking",
                "rule": "Do not compare official research mode and live market update mode as if they are the same experiment."
            },
            {
                "rule_id": "manual_factor_disclosure",
                "severity": "blocking",
                "rule": "Manual CSV factor validity dates must be visible in factor_state_table.json."
            }
        ],
        "professor_safe_summary": "These rules prevent leakage and protect Deep ML claims from being stronger than the data supports."
    }


# ---------------------------------------------------------
# Main
# ---------------------------------------------------------

def main() -> int:
    inputs = load_phase_inputs()

    mode_status = inputs["mode_status"]
    effective_window = inputs["effective_window"]
    study_context = inputs["study_context"]
    factor_state_table = inputs["factor_state_table"]
    data_quality_flags = inputs["data_quality_flags"]

    generated_at_utc = utc_now_iso()

    mode = mode_status["mode"]
    study_id = study_context["study_id"]
    run_batch_id = study_context["run_batch_id"]
    effective_data_through = mode_status["effective_model_data_through_date"]
    forecast_start_date = mode_status["forecast_start_date"]

    factor_rows = safe_list(factor_state_table.get("rows"))

    base_feature_rows = build_base_feature_rows(factor_rows)
    engineered_feature_plan = build_engineered_feature_plan()
    model_feature_sets = build_model_feature_sets(base_feature_rows, engineered_feature_plan)
    sequence_window_plan = build_sequence_window_plan()
    target_plan = build_target_plan(effective_data_through, forecast_start_date)
    leakage_safety_plan = build_leakage_safety_plan()
    input_dataset_detection = detect_possible_input_datasets()

    feature_manifest = {
        "artifact_type": "deep_ml_feature_manifest",
        "schema_version": "1.0.0",
        "generated_at_utc": generated_at_utc,
        "mode": mode,
        "study_id": study_id,
        "run_batch_id": run_batch_id,
        "effective_data_through_date": effective_data_through,
        "forecast_start_date": forecast_start_date,
        "target": "gold_price",
        "base_features": base_feature_rows,
        "engineered_feature_plan": engineered_feature_plan,
        "model_feature_sets": model_feature_sets,
        "input_dataset_detection": input_dataset_detection,
        "source_artifacts": [
            "artifacts/deep_ml/governance/deep_ml_mode_status.json",
            "artifacts/deep_ml/governance/effective_data_window.json",
            "artifacts/deep_ml/data/factor_state_table.json",
            "artifacts/deep_ml/data/data_quality_flags.json"
        ],
        "professor_safe_summary": (
            "The Deep ML feature manifest defines allowed feature groups before model training. "
            "It prevents each model from inventing its own undocumented feature universe."
        )
    }

    model_feature_plan = {
        "artifact_type": "deep_ml_model_feature_plan",
        "schema_version": "1.0.0",
        "generated_at_utc": generated_at_utc,
        "mode": mode,
        "study_id": study_id,
        "run_batch_id": run_batch_id,
        "model_feature_sets": model_feature_sets,
        "notes": [
            "Alpha uses structural/tabular factors and engineered gold features.",
            "Beta uses sequence features, masks, and engineered gold features.",
            "Delta uses sequence/multi-horizon features with quantile output later.",
            "Epsilon starts as a fast gold/lag expert.",
            "Gamma is a news sensitivity overlay, not a causal point-forecast engine.",
            "Omega uses model forecasts and study memory, not raw factor inputs directly."
        ]
    }

    feature_store_status = {
        "artifact_type": "deep_ml_feature_store_status",
        "schema_version": "1.0.0",
        "generated_at_utc": generated_at_utc,
        "mode": mode,
        "study_id": study_id,
        "run_batch_id": run_batch_id,
        "status": "foundation_ready",
        "actual_numeric_feature_store_built": False,
        "reason": "Phase 4 defines the feature-store contract. Numeric feature building starts after input matrix/data loader is confirmed.",
        "input_dataset_detection": input_dataset_detection,
        "next_required_input": (
            "Confirm the model-ready matrix or baseline aligned matrix path before building numeric features."
            if input_dataset_detection["found_count"] == 0
            else "Use detected dataset candidate in the next feature-building phase."
        )
    }

    page_feature_foundation = {
        "artifact_type": "deep_ml_page_bundle",
        "schema_version": "1.0.0",
        "page_id": "deep_ml_feature_foundation",
        "page_title": "Deep ML Feature Foundation",
        "page_subtitle": "Feature groups, sequence-window plan, target plan, and leakage-safety rules.",
        "generated_at_utc": generated_at_utc,
        "mode": mode,
        "study_id": study_id,
        "run_batch_id": run_batch_id,
        "effective_data_through_date": effective_data_through,
        "forecast_start_date": forecast_start_date,
        "kpi_cards": [
            {
                "label": "Base Features",
                "value": len(base_feature_rows),
                "note": "Derived from factor-state table."
            },
            {
                "label": "Engineered Features Planned",
                "value": len(engineered_feature_plan),
                "note": "Lag, return, rolling, volatility, and mask features."
            },
            {
                "label": "Default Sequence Window",
                "value": sequence_window_plan["default_sequence_window_trading_days"],
                "note": "Trading days."
            },
            {
                "label": "Forecast Horizons",
                "value": ", ".join(str(x) for x in target_plan["horizons_trading_days"]),
                "note": "Trading-day horizons."
            }
        ],
        "sections": [
            {
                "section_id": "model_feature_sets",
                "title": "Model Feature Sets",
                "source_artifact": "artifacts/deep_ml/features/model_feature_plan.json"
            },
            {
                "section_id": "sequence_windows",
                "title": "Sequence Window Plan",
                "source_artifact": "artifacts/deep_ml/features/sequence_window_plan.json"
            },
            {
                "section_id": "leakage_safety",
                "title": "Leakage Safety Rules",
                "source_artifact": "artifacts/deep_ml/features/leakage_safety_plan.json"
            }
        ],
        "allowed_frontend_claims": [
            "Feature groups are defined before training.",
            "Scaling and rolling features must avoid leakage.",
            "Numeric feature-store creation is separate from this foundation contract."
        ],
        "forbidden_frontend_claims": [
            "Do not claim models have been trained.",
            "Do not claim numeric feature tensors exist unless feature_store_status says they were built.",
            "Do not claim live-mode features are all current."
        ]
    }

    mirror_to_public("features/feature_manifest.json", feature_manifest)
    mirror_to_public("features/model_feature_plan.json", model_feature_plan)
    mirror_to_public("features/sequence_window_plan.json", sequence_window_plan)
    mirror_to_public("features/target_plan.json", target_plan)
    mirror_to_public("features/leakage_safety_plan.json", leakage_safety_plan)
    mirror_to_public("features/feature_store_status.json", feature_store_status)
    mirror_to_public("pages/page_deep_ml_feature_foundation.json", page_feature_foundation)

    phase4_report = {
        "artifact_type": "deep_ml_phase4_feature_store_report",
        "schema_version": "1.0.0",
        "generated_at_utc": generated_at_utc,
        "status": "ready",
        "mode": mode,
        "study_id": study_id,
        "run_batch_id": run_batch_id,
        "effective_data_through_date": effective_data_through,
        "forecast_start_date": forecast_start_date,
        "base_feature_count": len(base_feature_rows),
        "engineered_feature_count": len(engineered_feature_plan),
        "detected_input_dataset_count": input_dataset_detection["found_count"],
        "outputs": [
            "artifacts/deep_ml/features/feature_manifest.json",
            "artifacts/deep_ml/features/model_feature_plan.json",
            "artifacts/deep_ml/features/sequence_window_plan.json",
            "artifacts/deep_ml/features/target_plan.json",
            "artifacts/deep_ml/features/leakage_safety_plan.json",
            "artifacts/deep_ml/features/feature_store_status.json",
            "artifacts/deep_ml/pages/page_deep_ml_feature_foundation.json"
        ],
        "next_step": "Phase 5: Build input matrix loader and numeric feature store."
    }

    mirror_to_public("features/phase4_feature_store_report.json", phase4_report)

    print(json.dumps(phase4_report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())