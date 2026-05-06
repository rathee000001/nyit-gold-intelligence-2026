from pathlib import Path
import json
import re
import textwrap
import pandas as pd

ROOT = Path.cwd()

UNIVERSAL = ROOT / "src/components/models/UniversalModelCharts.tsx"

ARTIFACT_GAMMA = ROOT / "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_date_context.csv"
PUBLIC_GAMMA = ROOT / "public/artifacts/deep_ml/models/gamma_news_sensitivity/gamma_date_context.csv"

ARTIFACT_ENRICHED = ROOT / "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_date_context_enriched.csv"
PUBLIC_ENRICHED = ROOT / "public/artifacts/deep_ml/models/gamma_news_sensitivity/gamma_date_context_enriched.csv"

ENRICH_REPORT_ARTIFACT = ROOT / "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_real_news_tooltip_enrichment_report.json"
ENRICH_REPORT_PUBLIC = ROOT / "public/artifacts/deep_ml/models/gamma_news_sensitivity/gamma_real_news_tooltip_enrichment_report.json"

NEWS_FILES = [
    ROOT / "artifacts/deep_ml/news/historical/historical_news_daily_index.csv",
    ROOT / "public/artifacts/deep_ml/news/historical/historical_news_daily_index.csv",
    ROOT / "artifacts/deep_ml/news/news_items_unified_raw.csv",
    ROOT / "public/artifacts/deep_ml/news/news_items_unified_raw.csv",
    ROOT / "artifacts/deep_ml/news/structured/news_context_daily_combined.csv",
    ROOT / "public/artifacts/deep_ml/news/structured/news_context_daily_combined.csv",
]


def clean_text(value):
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except Exception:
        pass
    return " ".join(str(value).replace("\n", " ").replace("\r", " ").split())


def first_value(row, names):
    for name in names:
        if name in row:
            value = clean_text(row.get(name))
            if value:
                return value
    return ""


def normalize_date(value):
    if value is None:
        return ""
    try:
        parsed = pd.to_datetime(value, errors="coerce")
        if pd.isna(parsed):
            return ""
        return parsed.date().isoformat()
    except Exception:
        text = str(value).strip()
        return text[:10] if len(text) >= 10 else text


def load_csv(path):
    if not path.exists():
        return pd.DataFrame()
    try:
        return pd.read_csv(path, low_memory=False)
    except Exception:
        return pd.DataFrame()


def collect_news_items():
    by_date = {}
    files_used = []

    for path in NEWS_FILES:
        df = load_csv(path)
        if df.empty:
            continue

        files_used.append(str(path.relative_to(ROOT)).replace("\\", "/"))
        columns = set(df.columns)

        date_candidates = [
            "date",
            "published_date",
            "published_at",
            "timestamp",
            "datetime",
            "news_date",
        ]

        title_candidates = [
            "title",
            "headline",
            "top_headline_1",
            "top_headline",
            "summary_title",
        ]

        source_candidates = [
            "source",
            "publisher",
            "source_name",
            "top_headline_1_source",
            "raw_source",
        ]

        url_candidates = [
            "url",
            "link",
            "article_url",
            "top_headline_1_url",
        ]

        summary_candidates = [
            "summary",
            "description",
            "snippet",
            "source_coverage_note",
            "coverage_note",
        ]

        for _, row in df.iterrows():
            row_dict = row.to_dict()

            date_value = ""
            for col in date_candidates:
                if col in columns:
                    date_value = normalize_date(row_dict.get(col))
                    if date_value:
                        break

            if not date_value:
                continue

            title = first_value(row_dict, title_candidates)
            source = first_value(row_dict, source_candidates)
            url = first_value(row_dict, url_candidates)
            summary = first_value(row_dict, summary_candidates)

            # Skip pure continuity rows that have no real headline/source.
            if not title and not source and not url:
                continue

            # Skip rows that are only the Phase 12 historical coverage warning.
            lowered = f"{title} {summary}".lower()
            if (
                "public doc/rss headline backfill was not available" in lowered
                and not title
                and not url
            ):
                continue

            item = {
                "date": date_value,
                "title": title,
                "source": source,
                "url": url,
                "summary": summary,
                "source_file": str(path.relative_to(ROOT)).replace("\\", "/"),
            }

            by_date.setdefault(date_value, [])

            # Deduplicate by title/source/url.
            key = (title.lower(), source.lower(), url.lower())
            existing_keys = {
                (
                    clean_text(x.get("title")).lower(),
                    clean_text(x.get("source")).lower(),
                    clean_text(x.get("url")).lower(),
                )
                for x in by_date[date_value]
            }

            if key not in existing_keys:
                by_date[date_value].append(item)

    # keep small and deterministic
    for date, items in by_date.items():
        by_date[date] = items[:8]

    return by_date, files_used


def enrich_gamma_context():
    gamma_path = PUBLIC_GAMMA if PUBLIC_GAMMA.exists() else ARTIFACT_GAMMA
    if not gamma_path.exists():
        raise FileNotFoundError("gamma_date_context.csv not found in artifacts or public artifacts.")

    gamma = pd.read_csv(gamma_path, low_memory=False)
    gamma["date"] = gamma["date"].map(normalize_date)

    news_by_date, files_used = collect_news_items()

    enriched_rows = []
    enriched_count = 0
    continuity_only_count = 0

    for _, row in gamma.iterrows():
        row_dict = row.to_dict()
        date = normalize_date(row_dict.get("date"))
        items = news_by_date.get(date, [])

        if items:
            enriched_count += 1
            primary = items[0]

            row_dict["article_count"] = max(
                int(float(row_dict.get("article_count", 0) or 0)),
                len(items),
            )
            row_dict["gold_news_count"] = max(
                int(float(row_dict.get("gold_news_count", 0) or 0)),
                len(items),
            )

            row_dict["top_headline_1"] = primary.get("title", "")
            row_dict["top_headline_1_source"] = primary.get("source", "")
            row_dict["top_headline_1_url"] = primary.get("url", "")

            if len(items) > 1:
                row_dict["top_headline_2"] = items[1].get("title", "")
                row_dict["top_headline_2_source"] = items[1].get("source", "")
                row_dict["top_headline_2_url"] = items[1].get("url", "")

            row_dict["gamma_tooltip_primary_headline"] = primary.get("title", "")
            row_dict["gamma_tooltip_primary_source"] = primary.get("source", "")
            row_dict["gamma_recent_headlines_json"] = json.dumps(items, ensure_ascii=False)

            existing_intensity = pd.to_numeric(row_dict.get("gamma_context_intensity", 0), errors="coerce")
            if pd.isna(existing_intensity):
                existing_intensity = 0

            # Keep model scores intact, but make tooltip intensity non-zero when real inventory exists.
            row_dict["gamma_context_intensity"] = max(float(existing_intensity), float(len(items)))

            existing_bucket = clean_text(row_dict.get("gamma_context_bucket"))
            if existing_bucket == "no_loaded_news_score" or not existing_bucket:
                row_dict["gamma_context_bucket"] = "loaded_news_inventory"

            row_dict["gamma_tooltip_recent_headline_count"] = len(items)
            row_dict["gamma_tooltip_note"] = (
                f"{len(items)} collected news item(s) are available for this date. "
                "Context only; not a causality claim."
            )
            row_dict["source_type"] = clean_text(row_dict.get("source_type")) or "real_news_inventory"
            row_dict["source_coverage_note"] = (
                "Real collected headline inventory available for this date. "
                "Use for chart context only, not causality."
            )
        else:
            bucket = clean_text(row_dict.get("gamma_context_bucket"))
            article_count = pd.to_numeric(row_dict.get("article_count", 0), errors="coerce")
            intensity = pd.to_numeric(row_dict.get("gamma_context_intensity", 0), errors="coerce")

            if pd.isna(article_count):
                article_count = 0
            if pd.isna(intensity):
                intensity = 0

            if bucket == "no_loaded_news_score" and float(article_count) == 0 and float(intensity) == 0:
                continuity_only_count += 1

        enriched_rows.append(row_dict)

    enriched = pd.DataFrame(enriched_rows)

    for target in [ARTIFACT_ENRICHED, PUBLIC_ENRICHED, ARTIFACT_GAMMA, PUBLIC_GAMMA]:
        target.parent.mkdir(parents=True, exist_ok=True)
        enriched.to_csv(target, index=False)

    report = {
        "artifact_type": "gamma_real_news_tooltip_enrichment_report",
        "schema_version": "1.0.0",
        "status": "ready",
        "gamma_rows": int(len(enriched)),
        "dates_with_real_collected_news": int(enriched_count),
        "continuity_only_dates_remaining": int(continuity_only_count),
        "news_files_used": files_used,
        "outputs": {
            "artifact_gamma_date_context": "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_date_context.csv",
            "public_gamma_date_context": "public/artifacts/deep_ml/models/gamma_news_sensitivity/gamma_date_context.csv",
            "artifact_enriched_copy": "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_date_context_enriched.csv",
            "public_enriched_copy": "public/artifacts/deep_ml/models/gamma_news_sensitivity/gamma_date_context_enriched.csv",
        },
        "professor_safe_note": "Tooltip headlines are context only. They do not claim that news caused gold price movement.",
    }

    for target in [ENRICH_REPORT_ARTIFACT, ENRICH_REPORT_PUBLIC]:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(report, indent=2))


def patch_universal_chart():
    if not UNIVERSAL.exists():
        raise FileNotFoundError(UNIVERSAL)

    text = UNIVERSAL.read_text(encoding="utf-8")

    # Add ReferenceArea import.
    if "ReferenceArea" not in text:
        text = text.replace(
            "Legend,\n  Line,\n  LineChart,",
            "Legend,\n  Line,\n  LineChart,\n  ReferenceArea,"
        )

    # Replace getNewsContext function.
    new_get_news = r'''function getNewsContext(row: any) {
  const headline = firstText(
    row?.gamma_tooltip_primary_headline,
    row?.top_headline_1,
    row?.newsHeadline
  );

  const source = firstText(
    row?.gamma_tooltip_primary_source,
    row?.top_headline_1_source,
    row?.newsSource,
    row?.source
  );

  const note = firstText(
    row?.gamma_tooltip_note,
    row?.newsTooltipNote,
    row?.source_coverage_note
  );

  const recentHeadlines = safeJsonArray(row?.gamma_recent_headlines_json)
    .slice(0, 5)
    .filter((item: any) => firstText(item?.title, item?.headline));

  const rawIntensity = row?.gamma_context_intensity;
  const intensity =
    !isBlankText(rawIntensity) && Number.isFinite(Number(rawIntensity))
      ? Number(rawIntensity)
      : undefined;

  const articleCount =
    !isBlankText(row?.article_count) && Number.isFinite(Number(row?.article_count))
      ? Number(row.article_count)
      : 0;

  const goldNewsCount =
    !isBlankText(row?.gold_news_count) && Number.isFinite(Number(row?.gold_news_count))
      ? Number(row.gold_news_count)
      : 0;

  const bucket = firstText(row?.gamma_context_bucket);
  const bucketLower = bucket.toLowerCase();

  const hasRealNewsInventory =
    recentHeadlines.length > 0 ||
    !!headline ||
    !!source ||
    articleCount > 0 ||
    goldNewsCount > 0 ||
    (intensity !== undefined && intensity > 0 && bucketLower !== "no_loaded_news_score");

  const isContinuityOnlyRow =
    bucketLower === "no_loaded_news_score" &&
    articleCount === 0 &&
    goldNewsCount === 0 &&
    (!Number.isFinite(Number(intensity)) || Number(intensity) === 0) &&
    !headline &&
    !source &&
    recentHeadlines.length === 0;

  if (isContinuityOnlyRow || !hasRealNewsInventory) {
    return null;
  }

  return {
    headline,
    source,
    note,
    recentHeadlines,
    intensity,
    bucket,
  };
}'''

    text = re.sub(
        r"function getNewsContext\(row: any\) \{.*?\n\}",
        new_get_news,
        text,
        count=1,
        flags=re.S,
    )

    shock_block = r'''
const MARKET_SHOCK_PERIODS = [
  {
    label: "Global Financial Crisis",
    start: "2008-09-15",
    end: "2009-06-30",
    fill: "#f97316",
  },
  {
    label: "COVID Shock",
    start: "2020-02-20",
    end: "2020-06-30",
    fill: "#ef4444",
  },
  {
    label: "Russia-Ukraine / Inflation Shock",
    start: "2022-02-24",
    end: "2022-12-30",
    fill: "#a855f7",
  },
  {
    label: "Banking Stress",
    start: "2023-03-08",
    end: "2023-05-31",
    fill: "#0ea5e9",
  },
];

function getVisibleMarketShockPeriods(rows: ForecastChartRow[]) {
  if (!rows.length) return [];

  const dates = rows.map((row) => String(row.date || "").slice(0, 10)).filter(Boolean);
  if (!dates.length) return [];

  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  return MARKET_SHOCK_PERIODS.filter((period) => {
    return period.end >= minDate && period.start <= maxDate;
  });
}
'''

    if "const MARKET_SHOCK_PERIODS" not in text:
        marker = "function rowsWithResidual("
        text = text.replace(marker, shock_block + "\n" + marker, 1)

    # Add optional prop in ActualVsForecastChart signature if not there.
    text = text.replace(
        "showSplitMarkers = true,\n}: {",
        "showSplitMarkers = true,\n  showMarketShockPeriods = true,\n}: {",
        1,
    )

    text = text.replace(
        "showSplitMarkers?: boolean;\n}) {",
        "showSplitMarkers?: boolean;\n  showMarketShockPeriods?: boolean;\n}) {",
        1,
    )

    if "const shockPeriods = getVisibleMarketShockPeriods(data);" not in text:
        text = text.replace(
            "const splitDates = getSplitDates(data);",
            "const splitDates = getSplitDates(data);\n  const shockPeriods = getVisibleMarketShockPeriods(data);",
            1,
        )

    shock_render = r'''
          {showMarketShockPeriods
            ? shockPeriods.map((period) => (
                <ReferenceArea
                  key={period.label}
                  x1={period.start}
                  x2={period.end}
                  fill={period.fill}
                  fillOpacity={0.08}
                  strokeOpacity={0}
                  label={{
                    value: period.label,
                    position: "top",
                    fill: period.fill,
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                />
              ))
            : null}
'''

    if "key={period.label}" not in text:
        text = text.replace(
            '          <Tooltip content={<CustomTooltip />} />\n          <Legend verticalAlign="top" height={34} />',
            '          <Tooltip content={<CustomTooltip />} />\n          <Legend verticalAlign="top" height={34} />\n' + shock_render,
            1,
        )

    # Residual chart props.
    text = text.replace(
        "showSplitMarkers = true,\n}: {",
        "showSplitMarkers = true,\n  showMarketShockPeriods = true,\n}: {",
        1,
    )

    text = text.replace(
        "showSplitMarkers?: boolean;\n}) {",
        "showSplitMarkers?: boolean;\n  showMarketShockPeriods?: boolean;\n}) {",
        1,
    )

    # Add shockPeriods to ResidualChart only if not already second occurrence.
    residual_marker = "const data = rowsWithResidual(normalizedRows, forecastKey);\n  const splitDates = getSplitDates(data);"
    if residual_marker in text and text.count("const shockPeriods = getVisibleMarketShockPeriods(data);") < 2:
        text = text.replace(
            residual_marker,
            "const data = rowsWithResidual(normalizedRows, forecastKey);\n  const splitDates = getSplitDates(data);\n  const shockPeriods = getVisibleMarketShockPeriods(data);",
            1,
        )

    # Add ReferenceArea to second LineChart after Residual Legend if only one insertion exists.
    if text.count("key={period.label}") < 2:
        text = text.replace(
            '          <Tooltip content={<CustomTooltip />} />\n          <Legend verticalAlign="top" height={34} />\n\n          <ReferenceLine\n            y={0}',
            '          <Tooltip content={<CustomTooltip />} />\n          <Legend verticalAlign="top" height={34} />\n' + shock_render + '\n          <ReferenceLine\n            y={0}',
            1,
        )

    UNIVERSAL.write_text(text, encoding="utf-8")
    print(f"patched chart component: {UNIVERSAL}")


def remove_backup_file():
    backup = ROOT / "src/components/models/UniversalModelCharts.tsx.bak_news_patch"
    if backup.exists():
        backup.unlink()
        print(f"removed backup: {backup}")


def main():
    remove_backup_file()
    enrich_gamma_context()
    patch_universal_chart()
    print("\nDONE: real news tooltip enrichment + market shock chart bands applied.")


if __name__ == "__main__":
    main()