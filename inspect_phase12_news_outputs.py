from pathlib import Path
import json
import pandas as pd

OUT = Path("phase12_news_output_schema_check.txt")
BASE = Path("public/artifacts/deep_ml/news")

FILES = {
    "phase12_report": BASE / "phase12_source_news_update_report.json",
    "historical_csv": BASE / "historical/historical_news_daily_index.csv",
    "historical_parquet": BASE / "historical/historical_news_daily_index.parquet",
    "historical_manifest": BASE / "historical/historical_news_backfill_manifest.json",
    "recent_json": BASE / "news_items_unified_raw.json",
    "recent_csv": BASE / "news_items_unified_raw.csv",
    "combined_csv": BASE / "structured/news_context_daily_combined.csv",
    "combined_parquet": BASE / "structured/news_context_daily_combined.parquet",
}

def write(line=""):
    with OUT.open("a", encoding="utf-8") as f:
        f.write(str(line) + "\n")

def section(title):
    write()
    write("=" * 90)
    write(title)
    write("=" * 90)

def read_json(path):
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        return {"__error__": str(e)}

def read_table(path):
    if not path.exists():
        return None
    try:
        if path.suffix.lower() == ".parquet":
            return pd.read_parquet(path)
        return pd.read_csv(path)
    except Exception as e:
        write(f"READ ERROR: {path}")
        write(str(e))
        return None

OUT.write_text("", encoding="utf-8")

section("PHASE 12 NEWS OUTPUT FILE EXISTENCE")
for name, path in FILES.items():
    write(f"{name}: {path}")
    write(f"  exists: {path.exists()}")
    if path.exists():
        write(f"  size_bytes: {path.stat().st_size}")

section("PHASE 12 REPORT SUMMARY")
report = read_json(FILES["phase12_report"])
if report:
    for key in [
        "artifact_type",
        "schema_version",
        "project",
        "phase",
        "status",
        "generated_at_utc",
        "generated_at_local",
        "run_id",
        "study_id",
    ]:
        write(f"{key}: {report.get(key)}")

    write()
    write("Top-level keys:")
    write(list(report.keys()))

    for key in [
        "professor_safe_summary",
        "source_coverage_note",
        "ai_grounding",
        "outputs",
        "artifact_outputs",
        "quality_review",
        "coverage_summary",
        "news_summary",
    ]:
        if key in report:
            write()
            write(f"{key}:")
            value = report.get(key)
            if isinstance(value, (dict, list)):
                write(json.dumps(value, indent=2)[:6000])
            else:
                write(value)
else:
    write("No Phase 12 report found.")

for label, path in [
    ("HISTORICAL DAILY INDEX CSV", FILES["historical_csv"]),
    ("HISTORICAL DAILY INDEX PARQUET", FILES["historical_parquet"]),
    ("RECENT NEWS CSV", FILES["recent_csv"]),
    ("COMBINED DAILY CONTEXT CSV", FILES["combined_csv"]),
    ("COMBINED DAILY CONTEXT PARQUET", FILES["combined_parquet"]),
]:
    section(label)
    df = read_table(path)
    if df is None:
        write("Not available or failed to read.")
        continue

    write(f"path: {path}")
    write(f"shape: {df.shape}")
    write()
    write("columns:")
    for col in df.columns:
        write(f"  - {col}")

    date_candidates = [c for c in df.columns if c.lower() in ["date", "day", "published_date", "origin_date"] or "date" in c.lower()]
    write()
    write(f"date-like columns: {date_candidates}")

    for col in date_candidates[:3]:
        try:
            d = pd.to_datetime(df[col], errors="coerce")
            write(f"{col} min: {d.min()}")
            write(f"{col} max: {d.max()}")
            write(f"{col} non-null: {int(d.notna().sum())}")
        except Exception as e:
            write(f"{col} date parse error: {e}")

    write()
    write("missing values by column:")
    miss = df.isna().sum().sort_values(ascending=False)
    write(miss.head(30).to_string())

    write()
    write("first 5 rows:")
    write(df.head(5).to_string())

    write()
    write("last 5 rows:")
    write(df.tail(5).to_string())

    text_cols = [c for c in df.columns if any(x in c.lower() for x in ["title", "headline", "summary", "description", "source", "coverage", "note", "url"])]
    if text_cols:
        write()
        write("text/context sample columns:")
        write(text_cols)
        write(df[text_cols].head(10).to_string())

section("HISTORICAL MANIFEST")
manifest = read_json(FILES["historical_manifest"])
if manifest:
    write(json.dumps(manifest, indent=2)[:10000])
else:
    write("No historical manifest found.")

section("RECENT NEWS JSON SAMPLE")
recent = read_json(FILES["recent_json"])
if recent is None:
    write("No recent news JSON found.")
elif isinstance(recent, list):
    write(f"items: {len(recent)}")
    write(json.dumps(recent[:5], indent=2)[:10000])
elif isinstance(recent, dict):
    write("top-level keys:")
    write(list(recent.keys()))
    write(json.dumps(recent, indent=2)[:10000])
else:
    write(type(recent))

section("GAMMA FRONTEND / MODEL DESIGN NOTES TO REVIEW")
write("Use this file to decide Gamma inputs only after seeing actual columns.")
write("Do not claim Google News RSS has complete history.")
write("Do not treat zero historical score as no news existed.")
write("Do not claim news caused gold movement.")
write("Historical rows should be described as continuity/index rows with coverage limitations.")
write("Recent news rows can support context/tooltips if title/headline/source/date fields exist.")
write("Gamma should be locked until a Phase 13 Gamma artifact is generated and reviewed.")

print(f"Created {OUT.resolve()}")
