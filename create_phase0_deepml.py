from pathlib import Path
import json
import textwrap
from datetime import datetime, timezone

ROOT = Path.cwd()

def write_text(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(textwrap.dedent(content).strip() + "\n", encoding="utf-8")
    print(f"WROTE {target}")

def write_json(path: str, obj: dict) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"WROTE {target}")

def touch_gitkeep(path: str) -> None:
    target = ROOT / path / ".gitkeep"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("", encoding="utf-8")
    print(f"TOUCHED {target}")

# ----------------------------
# 1. Directory structure
# ----------------------------

dirs = [
    "deep_ml/configs",
    "deep_ml/contracts/schemas",
    "deep_ml/contracts/examples",
    "deep_ml/src/gna_deepml/core",
    "deep_ml/src/gna_deepml/data",
    "deep_ml/src/gna_deepml/features",
    "deep_ml/src/gna_deepml/models",
    "deep_ml/src/gna_deepml/evaluation",
    "deep_ml/src/gna_deepml/memory",
    "deep_ml/src/gna_deepml/news",
    "deep_ml/src/gna_deepml/artifacts",
    "deep_ml/src/gna_deepml/ai",
    "deep_ml/src/gna_deepml/publish",
    "deep_ml/scripts",
    "deep_ml/tests",
    "deep_ml/runs_local/active",
    "deep_ml/runs_local/archived",
    "deep_ml/runs_local/checkpoints",

    "artifacts/deep_ml/governance",
    "artifacts/deep_ml/data",
    "artifacts/deep_ml/features",
    "artifacts/deep_ml/models/alpha_structural",
    "artifacts/deep_ml/models/beta_temporal",
    "artifacts/deep_ml/models/delta_tft",
    "artifacts/deep_ml/models/epsilon_fast_expert",
    "artifacts/deep_ml/models/gamma_news_sensitivity",
    "artifacts/deep_ml/models/omega_fusion",
    "artifacts/deep_ml/evaluation",
    "artifacts/deep_ml/memory",
    "artifacts/deep_ml/news",
    "artifacts/deep_ml/ai",
    "artifacts/deep_ml/pages",
    "artifacts/deep_ml/runs",

    "public/artifacts/deep_ml/governance",
    "public/artifacts/deep_ml/data",
    "public/artifacts/deep_ml/features",
    "public/artifacts/deep_ml/models",
    "public/artifacts/deep_ml/evaluation",
    "public/artifacts/deep_ml/memory",
    "public/artifacts/deep_ml/news",
    "public/artifacts/deep_ml/ai",
    "public/artifacts/deep_ml/pages",
]

for d in dirs:
    touch_gitkeep(d)

# Python package init files
for pkg in [
    "deep_ml/src/gna_deepml",
    "deep_ml/src/gna_deepml/core",
    "deep_ml/src/gna_deepml/data",
    "deep_ml/src/gna_deepml/features",
    "deep_ml/src/gna_deepml/models",
    "deep_ml/src/gna_deepml/evaluation",
    "deep_ml/src/gna_deepml/memory",
    "deep_ml/src/gna_deepml/news",
    "deep_ml/src/gna_deepml/artifacts",
    "deep_ml/src/gna_deepml/ai",
    "deep_ml/src/gna_deepml/publish",
]:
    write_text(f"{pkg}/__init__.py", "")

# ----------------------------
# 2. README + requirements
# ----------------------------

write_text(
    "deep_ml/README.md",
    """
    # Gold Nexus Alpha — Phase 2 Deep ML Models

    This folder contains the local-GPU Deep ML extension for Gold Nexus Alpha.

    Runtime rule:
    - This is not Google Colab runtime.
    - This is not Azure runtime.
    - This runs locally on a Windows CUDA-enabled machine using Python venv.
    - It exports JSON/CSV/Parquet artifacts to `artifacts/deep_ml`.
    - Frontend work happens later and reads only approved artifacts.

    Phase 0 status:
    - Folder structure created.
    - Contract schemas created.
    - Example artifacts created.
    - Contract validation script created.

    Protected baseline rule:
    - Do not modify the existing professor-safe baseline model pages, model comparison, or final forecast flow.
    """
)

write_text(
    "deep_ml/requirements-deep-ml.txt",
    """
    pandas>=2.2.0
    numpy>=1.26.0
    pyarrow>=15.0.0
    pydantic>=2.7.0
    jsonschema>=4.22.0
    pyyaml>=6.0.1
    python-dotenv>=1.0.1
    scikit-learn>=1.4.0
    joblib>=1.3.0
    matplotlib>=3.8.0
    yfinance>=0.2.40
    requests>=2.31.0
    """
)

write_text(
    "deep_ml/.env.deepml.example",
    """
    # Deep ML local environment only.
    # Never commit real keys.

    DEEPML_MODE=official_research_mode

    # Optional future live mode inputs
    GOLD_API_PROVIDER=yfinance
    GOLD_API_SYMBOL=GC=F

    # Optional news inputs
    NEWS_API_KEY=
    GDELT_ENABLED=true

    # Local paths
    DEEPML_ARTIFACT_ROOT=artifacts/deep_ml
    DEEPML_PUBLIC_ARTIFACT_ROOT=public/artifacts/deep_ml
    """
)

# ----------------------------
# 3. Config files
# ----------------------------

write_text(
    "deep_ml/configs/base.yaml",
    """
    project:
      name: Gold Nexus Alpha
      phase: phase_2_deep_ml
      schema_version: "1.0.0"
      timezone_local: America/New_York

    baseline:
      protected: true
      official_cutoff_date: "2026-03-31"
      do_not_refactor_existing_pages: true

    runtime:
      platform: windows_local_cuda
      use_colab_runtime: false
      use_azure: false
      push_frontend_artifacts_to_github: true
      keep_large_checkpoints_local: true

    forecast:
      target: gold_price
      frequency: trading_day
      horizons: [1, 5, 10, 20, 30]
      default_horizon_trading_days: 30

    artifact_rules:
      require_schema_validation: true
      require_generated_at_utc: true
      require_effective_data_through_date: true
      require_forecast_start_date: true
      no_frontend_hardcoded_claims: true
    """
)

write_text(
    "deep_ml/configs/official_research_mode.yaml",
    """
    mode:
      name: official_research_mode
      display_label: Official Research Mode
      live_mode: false
      uses_yahoo_gold_api: false
      description: Frozen, validated research mode. Used for publishable metrics and professor-safe comparison.

    cutoff:
      official_research_cutoff_date: "2026-03-31"
      effective_data_through_date: "2026-03-31"
      forecast_start_policy: next_trading_day_after_effective_data_through_date
    """
)

write_text(
    "deep_ml/configs/live_market_update_mode.yaml",
    """
    mode:
      name: live_market_update_mode
      display_label: Live Market Update Mode
      live_mode: true
      uses_yahoo_gold_api: true
      description: Experimental live mode. Gold spot may update daily, while manual/macro factors may be current, stale, carried, or unavailable.

    gold_api:
      provider: yfinance
      default_symbol: GC=F
      source_state: api_live

    cutoff:
      official_research_cutoff_date: "2026-03-31"
      effective_data_through_policy: min_valid_date_across_required_factors
      forecast_start_policy: next_trading_day_after_effective_data_through_date
    """
)

write_text(
    "deep_ml/configs/factor_state_vocabulary.yaml",
    """
    factor_states:
      - api_live
      - manual_current
      - manual_stale
      - carried_forward
      - official_cutoff_locked
      - unavailable
      - derived_feature

    allowed_modes:
      - official_research_mode
      - live_market_update_mode

    warning_levels:
      - none
      - info
      - caution
      - severe
    """
)

write_text(
    "deep_ml/configs/model_registry.yaml",
    """
    models:
      alpha_structural:
        display_name: Alpha Structural Expert
        family: tabular_structural_model
        public_claim: Interpretable structural benchmark and feature-importance anchor.
        forecast_eligible: true

      beta_temporal:
        display_name: Beta Temporal Deep Expert
        family: deep_sequence_model
        public_claim: Sequence model for temporal dependence and uncertainty using dropout-style sampling.
        forecast_eligible: true

      delta_tft:
        display_name: Delta TFT Multi-Horizon Expert
        family: temporal_fusion_transformer
        public_claim: Multi-horizon deep forecasting candidate with quantile outputs and variable importance.
        forecast_eligible: true

      epsilon_fast_expert:
        display_name: Epsilon Fast Expert Ensemble
        family: fast_baseline_expert
        public_claim: Lightweight benchmark ensemble and live-mode guardrail.
        forecast_eligible: true

      gamma_news_sensitivity:
        display_name: Gamma News Sensitivity Expert
        family: news_regime_overlay
        public_claim: News and geopolitical sensitivity overlay; context, not causality.
        forecast_eligible: false

      omega_fusion:
        display_name: Omega Fusion Ensemble
        family: ensemble_fusion_model
        public_claim: Final Phase 2 ensemble combining eligible numeric experts with transparent weights.
        forecast_eligible: true
    """
)

# ----------------------------
# 4. JSON Schemas
# ----------------------------

deep_ml_model_run_schema = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "deep_ml_model_run.schema.json",
    "title": "Deep ML Model Run Artifact",
    "type": "object",
    "required": [
        "artifact_type",
        "schema_version",
        "project",
        "phase",
        "mode",
        "run",
        "data_signature",
        "model",
        "features",
        "forecast",
        "uncertainty",
        "evaluation",
        "interpretability",
        "diagnostics",
        "limitations",
        "professor_safe_summary",
        "ai_grounding"
    ],
    "properties": {
        "artifact_type": {"const": "deep_ml_model_run"},
        "schema_version": {"type": "string"},
        "project": {"const": "Gold Nexus Alpha"},
        "phase": {"const": "phase_2_deep_ml"},
        "mode": {
            "type": "object",
            "required": ["name", "display_label", "official_research_cutoff_date", "live_mode"],
            "properties": {
                "name": {"enum": ["official_research_mode", "live_market_update_mode"]},
                "display_label": {"type": "string"},
                "official_research_cutoff_date": {"type": "string"},
                "live_mode": {"type": "boolean"}
            },
            "additionalProperties": True
        },
        "run": {
            "type": "object",
            "required": [
                "study_id",
                "run_id",
                "generated_at_utc",
                "generated_at_local",
                "timezone_local",
                "code_version",
                "python_version"
            ],
            "properties": {
                "study_id": {"type": "string"},
                "run_id": {"type": "string"},
                "generated_at_utc": {"type": "string"},
                "generated_at_local": {"type": "string"},
                "timezone_local": {"type": "string"},
                "git_commit_sha": {"type": ["string", "null"]},
                "code_version": {"type": "string"},
                "python_version": {"type": "string"},
                "cuda_available": {"type": ["boolean", "null"]},
                "device": {"type": ["string", "null"]}
            },
            "additionalProperties": True
        },
        "data_signature": {
            "type": "object",
            "required": [
                "matrix_snapshot_id",
                "effective_data_through_date",
                "forecast_start_date",
                "matrix_hash",
                "feature_hash",
                "factor_state_table_hash"
            ],
            "properties": {
                "matrix_snapshot_id": {"type": "string"},
                "matrix_name": {"type": ["string", "null"]},
                "effective_data_through_date": {"type": "string"},
                "forecast_start_date": {"type": "string"},
                "matrix_row_count": {"type": ["integer", "null"]},
                "matrix_hash": {"type": "string"},
                "feature_hash": {"type": "string"},
                "factor_state_table_hash": {"type": "string"}
            },
            "additionalProperties": True
        },
        "model": {
            "type": "object",
            "required": ["model_key", "model_name", "family", "target", "horizons", "training_window"],
            "properties": {
                "model_key": {"type": "string"},
                "model_name": {"type": "string"},
                "family": {"type": "string"},
                "target": {"const": "gold_price"},
                "horizons": {
                    "type": "array",
                    "items": {"type": "integer"}
                },
                "training_window": {"type": "object"}
            },
            "additionalProperties": True
        },
        "features": {"type": "object"},
        "forecast": {"type": "object"},
        "uncertainty": {"type": "object"},
        "evaluation": {"type": "object"},
        "interpretability": {"type": "object"},
        "diagnostics": {"type": "object"},
        "limitations": {"type": "array", "items": {"type": "string"}},
        "professor_safe_summary": {"type": "string"},
        "ai_grounding": {
            "type": "object",
            "required": ["allowed_claims", "forbidden_claims", "source_artifacts"],
            "properties": {
                "allowed_claims": {"type": "array", "items": {"type": "string"}},
                "forbidden_claims": {"type": "array", "items": {"type": "string"}},
                "source_artifacts": {"type": "array", "items": {"type": "string"}}
            },
            "additionalProperties": True
        }
    },
    "additionalProperties": True
}

factor_state_table_schema = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "factor_state_table.schema.json",
    "title": "Deep ML Factor State Table",
    "type": "object",
    "required": ["artifact_type", "schema_version", "generated_at_utc", "mode", "rows"],
    "properties": {
        "artifact_type": {"const": "deep_ml_factor_state_table"},
        "schema_version": {"type": "string"},
        "generated_at_utc": {"type": "string"},
        "mode": {"enum": ["official_research_mode", "live_market_update_mode"]},
        "rows": {
            "type": "array",
            "items": {
                "type": "object",
                "required": [
                    "factor_key",
                    "display_name",
                    "source_type",
                    "current_state",
                    "last_observed_date",
                    "valid_through_date",
                    "research_mode_eligible",
                    "live_mode_eligible",
                    "warning_level",
                    "interpretation",
                    "action_needed"
                ],
                "properties": {
                    "factor_key": {"type": "string"},
                    "display_name": {"type": "string"},
                    "source_name": {"type": ["string", "null"]},
                    "source_type": {"type": "string"},
                    "expected_frequency": {"type": ["string", "null"]},
                    "first_valid_date": {"type": ["string", "null"]},
                    "last_observed_date": {"type": ["string", "null"]},
                    "valid_through_date": {"type": ["string", "null"]},
                    "current_state": {
                        "enum": [
                            "api_live",
                            "manual_current",
                            "manual_stale",
                            "carried_forward",
                            "official_cutoff_locked",
                            "unavailable",
                            "derived_feature"
                        ]
                    },
                    "staleness_days": {"type": ["integer", "null"]},
                    "carry_forward_policy": {"type": ["string", "null"]},
                    "research_mode_eligible": {"type": "boolean"},
                    "live_mode_eligible": {"type": "boolean"},
                    "alpha_eligible": {"type": "boolean"},
                    "beta_eligible": {"type": "boolean"},
                    "delta_eligible": {"type": "boolean"},
                    "epsilon_eligible": {"type": "boolean"},
                    "gamma_eligible": {"type": "boolean"},
                    "omega_eligible": {"type": "boolean"},
                    "warning_level": {"enum": ["none", "info", "caution", "severe"]},
                    "interpretation": {"type": "string"},
                    "action_needed": {"type": "string"}
                },
                "additionalProperties": True
            }
        }
    },
    "additionalProperties": True
}

mode_status_schema = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "deep_ml_mode_status.schema.json",
    "title": "Deep ML Mode Status",
    "type": "object",
    "required": [
        "artifact_type",
        "schema_version",
        "generated_at_utc",
        "mode",
        "official_research_cutoff_date",
        "effective_model_data_through_date",
        "forecast_start_date",
        "status_summary"
    ],
    "properties": {
        "artifact_type": {"const": "deep_ml_mode_status"},
        "schema_version": {"type": "string"},
        "generated_at_utc": {"type": "string"},
        "generated_at_local": {"type": "string"},
        "timezone_local": {"type": "string"},
        "mode": {"enum": ["official_research_mode", "live_market_update_mode"]},
        "official_research_cutoff_date": {"type": "string"},
        "live_gold_price_through_date": {"type": ["string", "null"]},
        "manual_csv_valid_through_date": {"type": ["string", "null"]},
        "effective_model_data_through_date": {"type": "string"},
        "forecast_start_date": {"type": "string"},
        "status_summary": {"type": "string"},
        "warnings": {"type": "array", "items": {"type": "string"}}
    },
    "additionalProperties": True
}

latest_pointer_schema = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "latest_deep_ml_pointer.schema.json",
    "title": "Latest Deep ML Pointer",
    "type": "object",
    "required": [
        "artifact_type",
        "schema_version",
        "updated_at_utc",
        "latest_study_id",
        "latest_run_id",
        "mode",
        "effective_data_through_date",
        "forecast_start_date",
        "artifact_root",
        "page_bundle_root"
    ],
    "properties": {
        "artifact_type": {"const": "latest_deep_ml_pointer"},
        "schema_version": {"type": "string"},
        "updated_at_utc": {"type": "string"},
        "latest_study_id": {"type": "string"},
        "latest_run_id": {"type": "string"},
        "mode": {"enum": ["official_research_mode", "live_market_update_mode"]},
        "effective_data_through_date": {"type": "string"},
        "forecast_start_date": {"type": "string"},
        "artifact_root": {"type": "string"},
        "page_bundle_root": {"type": "string"}
    },
    "additionalProperties": True
}

deep_ml_ai_context_schema = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "deep_ml_ai_context_bundle.schema.json",
    "title": "Deep ML AI Context Bundle",
    "type": "object",
    "required": [
        "artifact_type",
        "schema_version",
        "generated_at_utc",
        "ai_name",
        "scope",
        "latest_study_id",
        "latest_run_id",
        "allowed_artifacts",
        "forbidden_behaviors",
        "context_sections"
    ],
    "properties": {
        "artifact_type": {"const": "deep_ml_ai_context_bundle"},
        "schema_version": {"type": "string"},
        "generated_at_utc": {"type": "string"},
        "ai_name": {"type": "string"},
        "scope": {"const": "deep_ml_phase_2_only"},
        "latest_study_id": {"type": "string"},
        "latest_run_id": {"type": "string"},
        "allowed_artifacts": {"type": "array", "items": {"type": "string"}},
        "forbidden_behaviors": {"type": "array", "items": {"type": "string"}},
        "context_sections": {"type": "array", "items": {"type": "object"}}
    },
    "additionalProperties": True
}

write_json("deep_ml/contracts/schemas/deep_ml_model_run.schema.json", deep_ml_model_run_schema)
write_json("deep_ml/contracts/schemas/factor_state_table.schema.json", factor_state_table_schema)
write_json("deep_ml/contracts/schemas/deep_ml_mode_status.schema.json", mode_status_schema)
write_json("deep_ml/contracts/schemas/latest_deep_ml_pointer.schema.json", latest_pointer_schema)
write_json("deep_ml/contracts/schemas/deep_ml_ai_context_bundle.schema.json", deep_ml_ai_context_schema)

# ----------------------------
# 5. Example artifacts
# ----------------------------

now_utc = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

sample_model_run = {
    "artifact_type": "deep_ml_model_run",
    "schema_version": "1.0.0",
    "project": "Gold Nexus Alpha",
    "phase": "phase_2_deep_ml",
    "mode": {
        "name": "official_research_mode",
        "display_label": "Official Research Mode",
        "official_research_cutoff_date": "2026-03-31",
        "live_mode": False
    },
    "run": {
        "study_id": "deepml_study_20260505_000000_research_20260331",
        "run_id": "deepml_run_20260505_000000_alpha_structural_research_20260331",
        "generated_at_utc": now_utc,
        "generated_at_local": "2026-05-04T20:00:00-04:00",
        "timezone_local": "America/New_York",
        "git_commit_sha": None,
        "code_version": "phase0_contract_v1",
        "python_version": "3.12",
        "cuda_available": None,
        "device": None
    },
    "data_signature": {
        "matrix_snapshot_id": "matrix_phase0_placeholder",
        "matrix_name": None,
        "effective_data_through_date": "2026-03-31",
        "forecast_start_date": "2026-04-01",
        "matrix_row_count": None,
        "matrix_hash": "sha256:placeholder",
        "feature_hash": "sha256:placeholder",
        "factor_state_table_hash": "sha256:placeholder"
    },
    "model": {
        "model_key": "alpha_structural",
        "model_name": "Alpha Structural Expert",
        "family": "tabular_structural_model",
        "target": "gold_price",
        "horizons": [1, 5, 10, 20, 30],
        "training_window": {
            "train_start": "2006-01-02",
            "train_end": "2018-12-31",
            "validation_start": "2019-01-01",
            "validation_end": "2022-12-30",
            "test_start": "2023-01-02",
            "test_end": "2026-03-31"
        }
    },
    "features": {
        "used": [],
        "excluded": [],
        "stale_or_carried": [],
        "feature_groups": {}
    },
    "forecast": {
        "frequency": "trading_day",
        "horizon_trading_days": 30,
        "path": []
    },
    "uncertainty": {
        "method": "not_applicable_phase0",
        "p10_path": [],
        "p50_path": [],
        "p90_path": [],
        "coverage_target": 0.8
    },
    "evaluation": {
        "train": {},
        "validation": {},
        "test": {},
        "by_horizon": {}
    },
    "interpretability": {},
    "diagnostics": {},
    "limitations": [
        "Phase 0 artifact is a schema example only and does not contain model results."
    ],
    "professor_safe_summary": "Phase 0 validates the Deep ML artifact contract before model training begins.",
    "ai_grounding": {
        "allowed_claims": [
            "This is a Phase 0 contract example."
        ],
        "forbidden_claims": [
            "Do not claim this contains trained model results."
        ],
        "source_artifacts": [
            "deep_ml/contracts/examples/sample_model_run.json"
        ]
    }
}

sample_factor_state_table = {
    "artifact_type": "deep_ml_factor_state_table",
    "schema_version": "1.0.0",
    "generated_at_utc": now_utc,
    "mode": "official_research_mode",
    "rows": [
        {
            "factor_key": "gold_price",
            "display_name": "Gold Price",
            "source_name": "Baseline matrix",
            "source_type": "baseline_artifact",
            "expected_frequency": "trading_day",
            "first_valid_date": "1968-01-04",
            "last_observed_date": "2026-03-31",
            "valid_through_date": "2026-03-31",
            "current_state": "official_cutoff_locked",
            "staleness_days": 0,
            "carry_forward_policy": "not_required_in_official_research_mode",
            "research_mode_eligible": True,
            "live_mode_eligible": True,
            "alpha_eligible": True,
            "beta_eligible": True,
            "delta_eligible": True,
            "epsilon_eligible": True,
            "gamma_eligible": False,
            "omega_eligible": True,
            "warning_level": "none",
            "interpretation": "Gold price is the target variable and is valid through the official research cutoff in this placeholder contract.",
            "action_needed": "No action for Phase 0."
        }
    ]
}

sample_mode_status = {
    "artifact_type": "deep_ml_mode_status",
    "schema_version": "1.0.0",
    "generated_at_utc": now_utc,
    "generated_at_local": "2026-05-04T20:00:00-04:00",
    "timezone_local": "America/New_York",
    "mode": "official_research_mode",
    "official_research_cutoff_date": "2026-03-31",
    "live_gold_price_through_date": None,
    "manual_csv_valid_through_date": None,
    "effective_model_data_through_date": "2026-03-31",
    "forecast_start_date": "2026-04-01",
    "status_summary": "Phase 0 contract mode status placeholder.",
    "warnings": [
        "This is not a trained model artifact."
    ]
}

sample_latest_pointer = {
    "artifact_type": "latest_deep_ml_pointer",
    "schema_version": "1.0.0",
    "updated_at_utc": now_utc,
    "latest_study_id": "deepml_study_20260505_000000_research_20260331",
    "latest_run_id": "deepml_run_20260505_000000_alpha_structural_research_20260331",
    "mode": "official_research_mode",
    "effective_data_through_date": "2026-03-31",
    "forecast_start_date": "2026-04-01",
    "artifact_root": "artifacts/deep_ml",
    "page_bundle_root": "artifacts/deep_ml/pages"
}

sample_ai_context = {
    "artifact_type": "deep_ml_ai_context_bundle",
    "schema_version": "1.0.0",
    "generated_at_utc": now_utc,
    "ai_name": "Deep ML Research AI",
    "scope": "deep_ml_phase_2_only",
    "latest_study_id": "deepml_study_20260505_000000_research_20260331",
    "latest_run_id": "deepml_run_20260505_000000_alpha_structural_research_20260331",
    "allowed_artifacts": [
        "deep_ml/contracts/examples/sample_model_run.json",
        "deep_ml/contracts/examples/sample_factor_state_table.json"
    ],
    "forbidden_behaviors": [
        "invent_missing_metrics",
        "claim_deep_ml_beats_baseline_without_artifact",
        "claim_news_causality",
        "claim_all_factors_are_live"
    ],
    "context_sections": [
        {
            "section_id": "phase0",
            "title": "Phase 0 Contract Context",
            "content": "Phase 0 defines schemas and examples only. No trained Deep ML results exist yet."
        }
    ]
}

write_json("deep_ml/contracts/examples/sample_model_run.json", sample_model_run)
write_json("deep_ml/contracts/examples/sample_factor_state_table.json", sample_factor_state_table)
write_json("deep_ml/contracts/examples/sample_mode_status.json", sample_mode_status)
write_json("deep_ml/contracts/examples/sample_latest_pointer.json", sample_latest_pointer)
write_json("deep_ml/contracts/examples/sample_deep_ml_ai_context_bundle.json", sample_ai_context)

# Also put phase0 status in artifact namespace.
phase0_status = {
    "artifact_type": "deep_ml_phase0_status",
    "schema_version": "1.0.0",
    "generated_at_utc": now_utc,
    "status": "created",
    "message": "Deep ML Phase 0 folder structure, configs, schemas, and example contracts were created.",
    "next_step": "Run deep_ml/scripts/00_validate_phase0_contracts.py"
}
write_json("artifacts/deep_ml/governance/deep_ml_phase0_status.json", phase0_status)
write_json("public/artifacts/deep_ml/governance/deep_ml_phase0_status.json", phase0_status)

# ----------------------------
# 6. Core helper modules
# ----------------------------

write_text(
    "deep_ml/src/gna_deepml/core/paths.py",
    '''
    from pathlib import Path

    def find_repo_root(start: Path | None = None) -> Path:
        current = (start or Path.cwd()).resolve()
        for parent in [current, *current.parents]:
            if (parent / "package.json").exists() or (parent / ".git").exists():
                return parent
        return current

    REPO_ROOT = find_repo_root()

    DEEP_ML_ROOT = REPO_ROOT / "deep_ml"
    CONTRACTS_ROOT = DEEP_ML_ROOT / "contracts"
    SCHEMAS_ROOT = CONTRACTS_ROOT / "schemas"
    EXAMPLES_ROOT = CONTRACTS_ROOT / "examples"

    ARTIFACT_ROOT = REPO_ROOT / "artifacts" / "deep_ml"
    PUBLIC_ARTIFACT_ROOT = REPO_ROOT / "public" / "artifacts" / "deep_ml"
    '''
)

write_text(
    "deep_ml/src/gna_deepml/core/timestamps.py",
    '''
    from __future__ import annotations

    from dataclasses import dataclass
    from datetime import datetime, timezone
    from zoneinfo import ZoneInfo

    LOCAL_TZ = ZoneInfo("America/New_York")

    def utc_now_iso() -> str:
        return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    def local_now_iso() -> str:
        return datetime.now(LOCAL_TZ).replace(microsecond=0).isoformat()

    @dataclass(frozen=True)
    class TimestampBundle:
        generated_at_utc: str
        generated_at_local: str
        timezone_local: str = "America/New_York"

    def build_timestamp_bundle() -> TimestampBundle:
        return TimestampBundle(
            generated_at_utc=utc_now_iso(),
            generated_at_local=local_now_iso(),
        )
    '''
)

write_text(
    "deep_ml/src/gna_deepml/core/hashes.py",
    '''
    from __future__ import annotations

    import hashlib
    from pathlib import Path

    def sha256_text(value: str) -> str:
        return "sha256:" + hashlib.sha256(value.encode("utf-8")).hexdigest()

    def sha256_file(path: str | Path) -> str:
        p = Path(path)
        h = hashlib.sha256()
        with p.open("rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                h.update(chunk)
        return "sha256:" + h.hexdigest()
    '''
)

write_text(
    "deep_ml/src/gna_deepml/core/schema_registry.py",
    '''
    from __future__ import annotations

    import json
    from pathlib import Path
    from typing import Any

    from jsonschema import Draft202012Validator

    from gna_deepml.core.paths import SCHEMAS_ROOT

    SCHEMA_FILES = {
        "deep_ml_model_run": "deep_ml_model_run.schema.json",
        "deep_ml_factor_state_table": "factor_state_table.schema.json",
        "deep_ml_mode_status": "deep_ml_mode_status.schema.json",
        "latest_deep_ml_pointer": "latest_deep_ml_pointer.schema.json",
        "deep_ml_ai_context_bundle": "deep_ml_ai_context_bundle.schema.json",
    }

    def load_json(path: str | Path) -> dict[str, Any]:
        return json.loads(Path(path).read_text(encoding="utf-8"))

    def load_schema(artifact_type: str) -> dict[str, Any]:
        if artifact_type not in SCHEMA_FILES:
            raise KeyError(f"Unknown artifact_type: {artifact_type}")
        return load_json(SCHEMAS_ROOT / SCHEMA_FILES[artifact_type])

    def validate_artifact(artifact: dict[str, Any]) -> list[str]:
        artifact_type = artifact.get("artifact_type")
        if not artifact_type:
            return ["Missing artifact_type"]
        schema = load_schema(artifact_type)
        validator = Draft202012Validator(schema)
        errors = sorted(validator.iter_errors(artifact), key=lambda e: list(e.path))
        return [f"{list(e.path)}: {e.message}" for e in errors]

    def validate_artifact_file(path: str | Path) -> list[str]:
        artifact = load_json(path)
        return validate_artifact(artifact)
    '''
)

# ----------------------------
# 7. Phase 0 validation script
# ----------------------------

write_text(
    "deep_ml/scripts/00_validate_phase0_contracts.py",
    '''
    from __future__ import annotations

    import json
    import sys
    from pathlib import Path

    # Make local package importable without installing editable package yet.
    REPO_ROOT = Path(__file__).resolve().parents[2]
    SRC_ROOT = REPO_ROOT / "deep_ml" / "src"
    sys.path.insert(0, str(SRC_ROOT))

    from gna_deepml.core.schema_registry import validate_artifact_file
    from gna_deepml.core.timestamps import utc_now_iso

    EXAMPLES = [
        "deep_ml/contracts/examples/sample_model_run.json",
        "deep_ml/contracts/examples/sample_factor_state_table.json",
        "deep_ml/contracts/examples/sample_mode_status.json",
        "deep_ml/contracts/examples/sample_latest_pointer.json",
        "deep_ml/contracts/examples/sample_deep_ml_ai_context_bundle.json",
    ]

    def main() -> int:
        results = []
        all_ok = True

        for rel in EXAMPLES:
            path = REPO_ROOT / rel
            errors = validate_artifact_file(path)
            ok = len(errors) == 0
            all_ok = all_ok and ok
            results.append({
                "artifact": rel,
                "ok": ok,
                "errors": errors
            })

        report = {
            "artifact_type": "phase0_contract_validation_report",
            "schema_version": "1.0.0",
            "generated_at_utc": utc_now_iso(),
            "status": "passed" if all_ok else "failed",
            "results": results
        }

        out_path = REPO_ROOT / "artifacts" / "deep_ml" / "governance" / "phase0_contract_validation_report.json"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

        public_out_path = REPO_ROOT / "public" / "artifacts" / "deep_ml" / "governance" / "phase0_contract_validation_report.json"
        public_out_path.parent.mkdir(parents=True, exist_ok=True)
        public_out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

        print(json.dumps(report, indent=2))
        return 0 if all_ok else 1

    if __name__ == "__main__":
        raise SystemExit(main())
    '''
)

print("\\nPHASE 0 FILES CREATED.")
print("Next:")
print("  py -m pip install -r deep_ml/requirements-deep-ml.txt")
print("  py deep_ml/scripts/00_validate_phase0_contracts.py")