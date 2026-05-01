#!/usr/bin/env python3
"""
Enrich official_forecast.json with actual post-cutoff gold prices.

Purpose:
- Keep model fitting honest: forecasts are already generated through the official cutoff.
- Use the current matrix only for evaluation after the cutoff.
- Join actual gold_price values from data/Gold_Matrix_M3_Daily_2026-04-30.csv
  into artifacts/forecast/official_forecast.json -> future_records_after_cutoff.
- Add residual, absolute_error, absolute_percentage_error, and inside_95_interval.

Run from project root:
    python scripts/enrich_official_forecast_actuals.py

Then restart Next:
    Remove-Item -Recurse -Force .next
    npm run dev
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd


PROJECT_ROOT = Path.cwd()

OFFICIAL_FORECAST_PATHS = [
    PROJECT_ROOT / "public/artifacts/forecast/official_forecast.json",
    PROJECT_ROOT / "artifacts/forecast/official_forecast.json",
]

MATRIX_PATH_CANDIDATES = [
    PROJECT_ROOT / "data/Gold_Matrix_M3_Daily_2026-04-30.csv",
    PROJECT_ROOT / "public/Gold_Factor_Alignment.csv",
    PROJECT_ROOT / "data/aligned/weekday_clean_matrix.csv",
    PROJECT_ROOT / "data/aligned/model_ready_multivariate.csv",
    PROJECT_ROOT / "data/aligned/model_ready_univariate.csv",
]


def pick_existing(paths: list[Path], label: str) -> Path:
    for path in paths:
        if path.exists():
            return path

    raise FileNotFoundError(
        f"Could not find {label}. Checked:\n"
        + "\n".join(str(path) for path in paths)
    )


def to_float_or_none(value):
    if value is None or value == "":
        return None
    try:
        value = float(value)
        if not np.isfinite(value):
            return None
        return value
    except Exception:
        return None


def main() -> None:
    official_path = pick_existing(OFFICIAL_FORECAST_PATHS, "official_forecast.json")
    matrix_path = pick_existing(MATRIX_PATH_CANDIDATES, "gold matrix CSV")

    print(f"✅ Official forecast artifact: {official_path}")
    print(f"✅ Actual gold source: {matrix_path}")

    artifact = json.loads(official_path.read_text(encoding="utf-8"))

    cutoff = (
        artifact.get("official_forecast_cutoff_date")
        or artifact.get("official_cutoff")
        or artifact.get("cutoff_date")
        or "2026-03-31"
    )

    cutoff_ts = pd.Timestamp(cutoff)

    future_records = artifact.get("future_records_after_cutoff", [])
    if not isinstance(future_records, list) or len(future_records) == 0:
        raise ValueError(
            "official_forecast.json has no future_records_after_cutoff rows. "
            "Run the updated Notebook 12 first."
        )

    actual_df = pd.read_csv(matrix_path)
    actual_df.columns = [str(c).strip() for c in actual_df.columns]

    if "date" not in actual_df.columns:
        raise ValueError(f"{matrix_path} does not contain a date column.")

    if "gold_price" not in actual_df.columns:
        raise ValueError(f"{matrix_path} does not contain a gold_price column.")

    actual_df["date"] = pd.to_datetime(actual_df["date"], errors="coerce")
    actual_df["gold_price"] = pd.to_numeric(actual_df["gold_price"], errors="coerce")

    actual_df = (
        actual_df.dropna(subset=["date", "gold_price"])
        .sort_values("date")
        .drop_duplicates(subset=["date"])
    )

    actual_post_cutoff = actual_df[actual_df["date"] > cutoff_ts][
        ["date", "gold_price"]
    ].copy()

    actual_map = {
        row["date"].strftime("%Y-%m-%d"): float(row["gold_price"])
        for _, row in actual_post_cutoff.iterrows()
    }

    updated_records = []
    matched_count = 0

    for row in future_records:
        out = dict(row)

        date_text = str(out.get("date", ""))[:10]
        actual = actual_map.get(date_text)

        if actual is not None:
            matched_count += 1
            out["actual_gold_price"] = actual

            forecast = to_float_or_none(out.get("official_forecast"))
            lower = to_float_or_none(out.get("forecast_lower"))
            upper = to_float_or_none(out.get("forecast_upper"))

            if forecast is not None:
                residual = actual - forecast
                absolute_error = abs(residual)
                ape = (absolute_error / actual) * 100 if actual != 0 else None

                out["residual"] = residual
                out["absolute_error"] = absolute_error
                out["absolute_percentage_error"] = ape

            if lower is not None and upper is not None:
                out["inside_95_interval"] = bool(lower <= actual <= upper)
            else:
                out["inside_95_interval"] = None
        else:
            # Use None, not 0. Zero creates a fake green actual line on the chart.
            out["actual_gold_price"] = None
            out["residual"] = None
            out["absolute_error"] = None
            out["absolute_percentage_error"] = None
            out["inside_95_interval"] = None

        updated_records.append(out)

    artifact["future_records_after_cutoff"] = updated_records

    # Refresh next forecast after cutoff.
    artifact["next_forecast_after_cutoff"] = updated_records[0] if updated_records else None

    forecast_source = artifact.setdefault("forecast_source", {})
    future_info = forecast_source.setdefault("generated_future_forecast_info", {})

    future_info["future_rows_with_actuals"] = int(matched_count)
    future_info["future_rows_without_actuals"] = int(len(updated_records) - matched_count)
    future_info["future_actual_comparison_status"] = (
        "actuals_available_for_some_future_rows"
        if matched_count > 0
        else "no_actuals_available_yet"
    )
    future_info["actual_gold_source_for_evaluation_only"] = str(
        matrix_path.relative_to(PROJECT_ROOT)
    )
    future_info["actual_join_rule"] = (
        "Actual post-cutoff gold_price values are joined after forecasting for evaluation only. "
        "They are not used to fit the ARIMA model."
    )

    record_counts = artifact.setdefault("record_counts", {})
    record_counts["records_after_cutoff"] = int(len(updated_records))
    record_counts["records_after_cutoff_with_actuals"] = int(matched_count)

    warnings = artifact.setdefault("warnings", [])
    note = (
        "Actual post-cutoff gold prices were joined from the matrix for evaluation only; "
        "the ARIMA model was fit only through the official cutoff date."
    )
    if note not in warnings:
        warnings.append(note)

    official_path.write_text(json.dumps(artifact, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"✅ Updated {official_path}")
    print(f"✅ Future rows: {len(updated_records)}")
    print(f"✅ Rows with actual post-cutoff gold prices: {matched_count}")
    print("✅ Restart Next.js and refresh /forecast.")


if __name__ == "__main__":
    main()
