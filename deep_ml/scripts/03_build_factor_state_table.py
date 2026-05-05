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


def days_between(start_date: str | None, end_date: str | None) -> int | None:
    if not start_date or not end_date:
        return None
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        return (end - start).days
    except Exception:
        return None


# ---------------------------------------------------------
# Governance load
# ---------------------------------------------------------

def load_governance() -> dict[str, Any]:
    mode_status_path = ARTIFACT_ROOT / "governance" / "deep_ml_mode_status.json"
    effective_window_path = ARTIFACT_ROOT / "governance" / "effective_data_window.json"
    study_context_path = ARTIFACT_ROOT / "governance" / "study_context.json"

    mode_status = read_json_if_exists(mode_status_path)
    effective_window = read_json_if_exists(effective_window_path)
    study_context = read_json_if_exists(study_context_path)

    if not mode_status or "_read_error" in mode_status:
        raise FileNotFoundError(
            "Missing or unreadable artifacts/deep_ml/governance/deep_ml_mode_status.json. "
            "Run Phase 2 first."
        )

    if not effective_window or "_read_error" in effective_window:
        raise FileNotFoundError(
            "Missing or unreadable artifacts/deep_ml/governance/effective_data_window.json. "
            "Run Phase 2 first."
        )

    if not study_context or "_read_error" in study_context:
        raise FileNotFoundError(
            "Missing or unreadable artifacts/deep_ml/governance/study_context.json. "
            "Run Phase 2 first."
        )

    return {
        "mode_status": mode_status,
        "effective_window": effective_window,
        "study_context": study_context,
    }


# ---------------------------------------------------------
# Factor catalog
# ---------------------------------------------------------

def locked_factor_catalog() -> list[dict[str, Any]]:
    """
    Phase 3 uses a locked fallback catalog from the completed Gold Nexus Alpha baseline.
    Later phases can enrich this from actual baseline factor_inventory.json if needed.
    """

    return [
        {
            "factor_key": "gold_price",
            "display_name": "Gold Price",
            "category": "target",
            "first_valid_date": "1968-01-04",
            "source_type": "baseline_target",
            "future_live_source_type": "api_live_gold_spot",
            "expected_frequency": "trading_day",
            "main_model_use": True,
            "notes": "Target variable. In future live mode, this may be updated from a Yahoo-style API source."
        },
        {
            "factor_key": "real_yield",
            "display_name": "Real Yield",
            "category": "rates",
            "first_valid_date": "2003-01-02",
            "source_type": "baseline_factor",
            "future_live_source_type": "api_or_manual_later",
            "expected_frequency": "daily_or_market",
            "main_model_use": True,
            "notes": "Core rate factor."
        },
        {
            "factor_key": "nominal_yield",
            "display_name": "Nominal Yield",
            "category": "rates",
            "first_valid_date": "1968-01-04",
            "source_type": "baseline_factor",
            "future_live_source_type": "api_or_manual_later",
            "expected_frequency": "daily_or_market",
            "main_model_use": True,
            "notes": "Core rate factor."
        },
        {
            "factor_key": "tips_curve",
            "display_name": "TIPS Curve",
            "category": "rates",
            "first_valid_date": "1997-01-02",
            "source_type": "baseline_factor",
            "future_live_source_type": "api_or_manual_later",
            "expected_frequency": "daily_or_market",
            "main_model_use": True,
            "notes": "Yield curve factor."
        },
        {
            "factor_key": "fed_bs",
            "display_name": "Federal Reserve Balance Sheet",
            "category": "liquidity",
            "first_valid_date": "2003-01-01",
            "source_type": "baseline_factor",
            "future_live_source_type": "api_or_manual_later",
            "expected_frequency": "weekly",
            "main_model_use": True,
            "notes": "Liquidity factor."
        },
        {
            "factor_key": "m2_supply",
            "display_name": "M2 Money Supply",
            "category": "liquidity",
            "first_valid_date": "1968-01-04",
            "source_type": "baseline_factor",
            "future_live_source_type": "api_or_manual_later",
            "expected_frequency": "weekly_or_monthly",
            "main_model_use": True,
            "notes": "Money supply factor."
        },
        {
            "factor_key": "inflation",
            "display_name": "Inflation",
            "category": "macro",
            "first_valid_date": "2003-01-02",
            "source_type": "baseline_factor",
            "future_live_source_type": "manual_or_api_later",
            "expected_frequency": "monthly",
            "main_model_use": True,
            "notes": "Inflation proxy."
        },
        {
            "factor_key": "usd_index",
            "display_name": "US Dollar Index",
            "category": "currency",
            "first_valid_date": "2006-01-02",
            "source_type": "baseline_factor",
            "future_live_source_type": "api_or_manual_later",
            "expected_frequency": "daily_or_market",
            "main_model_use": True,
            "notes": "Currency factor."
        },
        {
            "factor_key": "eur_usd",
            "display_name": "EUR/USD",
            "category": "currency",
            "first_valid_date": "1999-01-04",
            "source_type": "baseline_factor",
            "future_live_source_type": "api_or_manual_later",
            "expected_frequency": "daily_or_market",
            "main_model_use": True,
            "notes": "Currency factor."
        },
        {
            "factor_key": "jpy_usd",
            "display_name": "JPY/USD",
            "category": "currency",
            "first_valid_date": "1971-01-04",
            "source_type": "baseline_factor",
            "future_live_source_type": "api_or_manual_later",
            "expected_frequency": "daily_or_market",
            "main_model_use": True,
            "notes": "Currency factor."
        },
        {
            "factor_key": "vix_index",
            "display_name": "VIX Index",
            "category": "risk",
            "first_valid_date": "1990-01-02",
            "source_type": "baseline_factor",
            "future_live_source_type": "api_or_manual_later",
            "expected_frequency": "daily_or_market",
            "main_model_use": True,
            "notes": "Risk and volatility factor."
        },
        {
            "factor_key": "high_yield",
            "display_name": "High Yield",
            "category": "credit",
            "first_valid_date": "2023-05-01",
            "source_type": "baseline_factor",
            "future_live_source_type": "optional_sensitivity_only",
            "expected_frequency": "daily_or_market",
            "main_model_use": False,
            "notes": "Excluded from main models because it starts too late. Sensitivity-only factor."
        },
        {
            "factor_key": "fin_stress",
            "display_name": "Financial Stress",
            "category": "risk",
            "first_valid_date": "1993-12-31",
            "source_type": "baseline_factor",
            "future_live_source_type": "api_or_manual_later",
            "expected_frequency": "weekly",
            "main_model_use": True,
            "notes": "Financial stress factor."
        },
        {
            "factor_key": "gpr_index",
            "display_name": "Geopolitical Risk Index",
            "category": "geopolitical",
            "first_valid_date": "1985-01-01",
            "source_type": "manual_csv",
            "future_live_source_type": "manual_csv",
            "expected_frequency": "monthly",
            "main_model_use": True,
            "notes": "Manual/local factor and cutoff-sensitive geopolitical risk variable."
        },
        {
            "factor_key": "policy_unc",
            "display_name": "Policy Uncertainty",
            "category": "policy",
            "first_valid_date": "1985-01-01",
            "source_type": "manual_csv",
            "future_live_source_type": "manual_csv",
            "expected_frequency": "monthly",
            "main_model_use": True,
            "notes": "Manual/local factor and cutoff-sensitive policy uncertainty variable."
        },
        {
            "factor_key": "oil_wti",
            "display_name": "WTI Oil",
            "category": "commodity",
            "first_valid_date": "1986-01-02",
            "source_type": "baseline_factor",
            "future_live_source_type": "api_or_manual_later",
            "expected_frequency": "daily_or_market",
            "main_model_use": True,
            "notes": "Commodity factor."
        },
        {
            "factor_key": "ppi_index",
            "display_name": "PPI Index",
            "category": "macro",
            "first_valid_date": "1968-01-04",
            "source_type": "baseline_factor",
            "future_live_source_type": "manual_or_api_later",
            "expected_frequency": "monthly",
            "main_model_use": True,
            "notes": "Producer price factor."
        },
        {
            "factor_key": "gld_tonnes",
            "display_name": "GLD Tonnes",
            "category": "gold_etf",
            "first_valid_date": "2004-11-18",
            "source_type": "manual_csv",
            "future_live_source_type": "manual_csv",
            "expected_frequency": "daily_or_irregular",
            "main_model_use": True,
            "notes": "Manual/local ETF holdings factor."
        },
        {
            "factor_key": "unrate",
            "display_name": "Unemployment Rate",
            "category": "macro",
            "first_valid_date": "1968-01-04",
            "source_type": "baseline_factor",
            "future_live_source_type": "manual_or_api_later",
            "expected_frequency": "monthly",
            "main_model_use": True,
            "notes": "Labor macro factor."
        },
        {
            "factor_key": "ind_prod",
            "display_name": "Industrial Production",
            "category": "macro",
            "first_valid_date": "1968-01-04",
            "source_type": "baseline_factor",
            "future_live_source_type": "manual_or_api_later",
            "expected_frequency": "monthly",
            "main_model_use": True,
            "notes": "Industrial activity factor."
        },
        {
            "factor_key": "cap_util",
            "display_name": "Capacity Utilization",
            "category": "macro",
            "first_valid_date": "1968-01-04",
            "source_type": "baseline_factor",
            "future_live_source_type": "manual_or_api_later",
            "expected_frequency": "monthly",
            "main_model_use": True,
            "notes": "Capacity utilization factor."
        },
    ]


# ---------------------------------------------------------
# Factor state logic
# ---------------------------------------------------------

def compute_factor_state(
    factor: dict[str, Any],
    mode: str,
    official_cutoff: str,
    effective_data_through: str,
) -> dict[str, Any]:
    factor_key = factor["factor_key"]
    main_model_use = bool(factor.get("main_model_use", True))
    source_type = factor.get("source_type", "baseline_factor")

    if mode == "official_research_mode":
        current_state = "official_cutoff_locked"
        last_observed_date = official_cutoff
        valid_through_date = effective_data_through
        staleness_days = 0
        warning_level = "none" if factor_key != "high_yield" else "caution"
        action_needed = (
            "No action required for official research mode."
            if factor_key != "high_yield"
            else "Keep excluded from main models; sensitivity-only factor."
        )

    else:
        # Live mode foundation only. Actual API/manual statuses are implemented later.
        if factor_key == "gold_price":
            current_state = "official_cutoff_locked"
            warning_level = "info"
            action_needed = "Future phase will pull gold spot from API and mark this as api_live."
        elif source_type == "manual_csv":
            current_state = "manual_stale"
            warning_level = "caution"
            action_needed = "Update manual CSV before trusting live-mode model outputs."
        elif factor_key == "high_yield":
            current_state = "unavailable"
            warning_level = "caution"
            action_needed = "Keep as sensitivity-only factor."
        else:
            current_state = "carried_forward"
            warning_level = "caution"
            action_needed = "Confirm live source or mark as carried/unavailable in live mode."

        last_observed_date = official_cutoff
        valid_through_date = effective_data_through
        staleness_days = days_between(valid_through_date, datetime.now(timezone.utc).date().isoformat())

    alpha_eligible = main_model_use and factor_key != "high_yield"
    beta_eligible = main_model_use and factor_key != "high_yield"
    delta_eligible = main_model_use and factor_key != "high_yield"

    # Epsilon starts as a fast expert. Initially gold-only / lag driven.
    epsilon_eligible = factor_key == "gold_price"

    # Gamma is regime/news/sensitivity. It does not use all factors equally.
    gamma_eligible = factor_key in {
        "gpr_index",
        "policy_unc",
        "vix_index",
        "fin_stress",
        "oil_wti",
        "usd_index",
        "real_yield",
        "inflation",
        "gld_tonnes",
    }

    omega_eligible = alpha_eligible or beta_eligible or delta_eligible or epsilon_eligible or gamma_eligible

    interpretation = build_interpretation(
        factor=factor,
        mode=mode,
        current_state=current_state,
        effective_data_through=effective_data_through,
    )

    return {
        "factor_key": factor_key,
        "display_name": factor["display_name"],
        "category": factor.get("category"),
        "source_name": factor.get("source_name", factor.get("source_type")),
        "source_type": source_type,
        "future_live_source_type": factor.get("future_live_source_type"),
        "expected_frequency": factor.get("expected_frequency"),
        "first_valid_date": factor.get("first_valid_date"),
        "last_observed_date": last_observed_date,
        "valid_through_date": valid_through_date,
        "current_state": current_state,
        "staleness_days": staleness_days,
        "carry_forward_policy": (
            "not_required_in_official_research_mode"
            if mode == "official_research_mode"
            else "allowed_only_when_explicitly_flagged_in_live_mode"
        ),
        "research_mode_eligible": main_model_use and factor_key != "high_yield",
        "live_mode_eligible": factor_key != "high_yield",
        "alpha_eligible": alpha_eligible,
        "beta_eligible": beta_eligible,
        "delta_eligible": delta_eligible,
        "epsilon_eligible": epsilon_eligible,
        "gamma_eligible": gamma_eligible,
        "omega_eligible": omega_eligible,
        "warning_level": warning_level,
        "interpretation": interpretation,
        "action_needed": action_needed,
        "notes": factor.get("notes", ""),
    }


def build_interpretation(
    factor: dict[str, Any],
    mode: str,
    current_state: str,
    effective_data_through: str,
) -> str:
    factor_key = factor["factor_key"]
    display = factor["display_name"]

    if factor_key == "high_yield":
        return (
            "High Yield starts too late for the main Deep ML study and remains sensitivity-only. "
            "It should not be treated as a core model factor."
        )

    if mode == "official_research_mode":
        return (
            f"{display} is treated as valid through the official Deep ML effective data date "
            f"({effective_data_through}) for research-mode artifacts."
        )

    if current_state == "manual_stale":
        return (
            f"{display} is a manual CSV factor in live mode. It must be updated before the system "
            "can claim the live model has current information for this factor."
        )

    if current_state == "carried_forward":
        return (
            f"{display} is not API-live in the current foundation build. It may only be carried forward "
            "when explicitly marked and disclosed on the website."
        )

    if current_state == "api_live":
        return (
            f"{display} is API-live in live mode. The artifact must record pull time, provider, and symbol."
        )

    return (
        f"{display} has state {current_state}. The frontend should display this state directly and avoid hidden assumptions."
    )


# ---------------------------------------------------------
# Summaries/page bundle
# ---------------------------------------------------------

def summarize_states(rows: list[dict[str, Any]]) -> dict[str, Any]:
    by_state: dict[str, int] = {}
    by_warning: dict[str, int] = {}
    by_category: dict[str, int] = {}

    for row in rows:
        by_state[row["current_state"]] = by_state.get(row["current_state"], 0) + 1
        by_warning[row["warning_level"]] = by_warning.get(row["warning_level"], 0) + 1
        category = row.get("category") or "unknown"
        by_category[category] = by_category.get(category, 0) + 1

    return {
        "factor_count": len(rows),
        "by_state": by_state,
        "by_warning": by_warning,
        "by_category": by_category,
        "main_model_factor_count": sum(1 for row in rows if row["research_mode_eligible"]),
        "manual_csv_factor_count": sum(1 for row in rows if row["source_type"] == "manual_csv"),
        "sensitivity_only_factor_count": sum(1 for row in rows if row["factor_key"] == "high_yield"),
    }


def build_quality_flags(rows: list[dict[str, Any]], mode: str) -> list[dict[str, Any]]:
    flags: list[dict[str, Any]] = []

    high_yield = next((row for row in rows if row["factor_key"] == "high_yield"), None)
    if high_yield:
        flags.append({
            "flag_id": "high_yield_sensitivity_only",
            "severity": "caution",
            "message": "high_yield is excluded from main Deep ML research models because it starts too late.",
            "affected_factors": ["high_yield"],
            "professor_safe_note": "This protects the main study from short-history bias."
        })

    manual_factors = [row["factor_key"] for row in rows if row["source_type"] == "manual_csv"]
    if manual_factors:
        flags.append({
            "flag_id": "manual_csv_factors",
            "severity": "info" if mode == "official_research_mode" else "caution",
            "message": "Some factors are manual CSV factors and must be tracked explicitly in live mode.",
            "affected_factors": manual_factors,
            "professor_safe_note": "Manual factors are allowed only when their valid-through dates are visible."
        })

    if mode == "live_market_update_mode":
        carried = [row["factor_key"] for row in rows if row["current_state"] in {"carried_forward", "manual_stale"}]
        if carried:
            flags.append({
                "flag_id": "live_mode_not_fully_live",
                "severity": "severe",
                "message": "Live mode has factors that are not fully live. Website must disclose this.",
                "affected_factors": carried,
                "professor_safe_note": "Do not claim all macro factors are updated daily."
            })

    return flags


# ---------------------------------------------------------
# Main
# ---------------------------------------------------------

def main() -> int:
    governance = load_governance()

    mode_status = governance["mode_status"]
    effective_window = governance["effective_window"]
    study_context = governance["study_context"]

    mode = mode_status["mode"]
    generated_at_utc = utc_now_iso()

    official_cutoff = mode_status["official_research_cutoff_date"]
    effective_data_through = mode_status["effective_model_data_through_date"]
    forecast_start_date = mode_status["forecast_start_date"]

    study_id = study_context["study_id"]
    run_batch_id = study_context["run_batch_id"]

    catalog = locked_factor_catalog()
    rows = [
        compute_factor_state(
            factor=factor,
            mode=mode,
            official_cutoff=official_cutoff,
            effective_data_through=effective_data_through,
        )
        for factor in catalog
    ]

    summary = summarize_states(rows)
    quality_flags = build_quality_flags(rows, mode)

    factor_state_table = {
        "artifact_type": "deep_ml_factor_state_table",
        "schema_version": "1.0.0",
        "generated_at_utc": generated_at_utc,
        "mode": mode,
        "study_id": study_id,
        "run_batch_id": run_batch_id,
        "official_research_cutoff_date": official_cutoff,
        "effective_data_through_date": effective_data_through,
        "forecast_start_date": forecast_start_date,
        "state_vocabulary": [
            "api_live",
            "manual_current",
            "manual_stale",
            "carried_forward",
            "official_cutoff_locked",
            "unavailable",
            "derived_feature"
        ],
        "summary": summary,
        "rows": rows,
        "professor_safe_summary": (
            "This table makes Deep ML data state explicit so the website does not imply that all factors are live or equally current."
        )
    }

    factor_staleness_report = {
        "artifact_type": "deep_ml_factor_staleness_report",
        "schema_version": "1.0.0",
        "generated_at_utc": generated_at_utc,
        "mode": mode,
        "study_id": study_id,
        "effective_data_through_date": effective_data_through,
        "summary": summary,
        "stale_or_manual_factors": [
            {
                "factor_key": row["factor_key"],
                "current_state": row["current_state"],
                "staleness_days": row["staleness_days"],
                "action_needed": row["action_needed"],
            }
            for row in rows
            if row["current_state"] in {"manual_stale", "carried_forward", "unavailable"}
            or row["source_type"] == "manual_csv"
            or row["factor_key"] == "high_yield"
        ],
    }

    data_quality_flags = {
        "artifact_type": "deep_ml_data_quality_flags",
        "schema_version": "1.0.0",
        "generated_at_utc": generated_at_utc,
        "mode": mode,
        "study_id": study_id,
        "flags": quality_flags,
        "blocking_flags": [flag for flag in quality_flags if flag["severity"] == "severe"],
        "professor_safe_summary": (
            "Data flags are advisory in official research mode and protective in live market update mode."
        )
    }

    page_bundle = {
        "artifact_type": "deep_ml_page_bundle",
        "schema_version": "1.0.0",
        "page_id": "deep_ml_data_intelligence",
        "page_title": "Deep ML Data Intelligence",
        "page_subtitle": "Factor freshness, source state, model eligibility, and live-mode disclosure.",
        "generated_at_utc": generated_at_utc,
        "mode": mode,
        "study_id": study_id,
        "run_batch_id": run_batch_id,
        "official_research_cutoff_date": official_cutoff,
        "effective_data_through_date": effective_data_through,
        "forecast_start_date": forecast_start_date,
        "kpi_cards": [
            {
                "label": "Factors Tracked",
                "value": summary["factor_count"],
                "note": "Includes target and model factors."
            },
            {
                "label": "Main Research Factors",
                "value": summary["main_model_factor_count"],
                "note": "Excludes sensitivity-only high_yield."
            },
            {
                "label": "Manual CSV Factors",
                "value": summary["manual_csv_factor_count"],
                "note": "Must be visible in live mode."
            },
            {
                "label": "Current Mode",
                "value": mode,
                "note": "Official research and live mode are separated."
            }
        ],
        "table": {
            "source_artifact": "artifacts/deep_ml/data/factor_state_table.json",
            "columns": [
                "factor_key",
                "display_name",
                "category",
                "source_type",
                "expected_frequency",
                "current_state",
                "valid_through_date",
                "warning_level",
                "research_mode_eligible",
                "live_mode_eligible",
                "alpha_eligible",
                "beta_eligible",
                "delta_eligible",
                "epsilon_eligible",
                "gamma_eligible",
                "omega_eligible",
                "interpretation",
                "action_needed"
            ],
            "rows": rows
        },
        "quality_flags": quality_flags,
        "allowed_frontend_claims": [
            "The table displays factor state and eligibility from artifacts.",
            "Deep ML live mode must disclose manual, stale, carried, and unavailable factors.",
            "high_yield is sensitivity-only unless a future short-window study is explicitly created."
        ],
        "forbidden_frontend_claims": [
            "Do not claim all factors are live.",
            "Do not claim high_yield is part of main Deep ML research models.",
            "Do not hide manual or stale factor states."
        ]
    }

    mirror_to_public("data/factor_state_table.json", factor_state_table)
    mirror_to_public("data/factor_staleness_report.json", factor_staleness_report)
    mirror_to_public("data/data_quality_flags.json", data_quality_flags)
    mirror_to_public("pages/page_deep_ml_data_intelligence.json", page_bundle)

    phase3_report = {
        "artifact_type": "deep_ml_phase3_factor_state_report",
        "schema_version": "1.0.0",
        "generated_at_utc": generated_at_utc,
        "status": "ready",
        "mode": mode,
        "study_id": study_id,
        "run_batch_id": run_batch_id,
        "effective_data_through_date": effective_data_through,
        "forecast_start_date": forecast_start_date,
        "factor_count": summary["factor_count"],
        "outputs": [
            "artifacts/deep_ml/data/factor_state_table.json",
            "artifacts/deep_ml/data/factor_staleness_report.json",
            "artifacts/deep_ml/data/data_quality_flags.json",
            "artifacts/deep_ml/pages/page_deep_ml_data_intelligence.json"
        ],
        "next_step": "Phase 4: Build Deep ML feature store foundation."
    }

    mirror_to_public("data/phase3_factor_state_report.json", phase3_report)

    print(json.dumps(phase3_report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())