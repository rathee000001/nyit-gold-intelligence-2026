from pathlib import Path

ROOT = Path.cwd()

PAGES = [
    ROOT / "src/app/deep-ml/models/alpha-structural/page.tsx",
    ROOT / "src/app/deep-ml/models/beta-temporal/page.tsx",
    ROOT / "src/app/deep-ml/models/delta-tft/page.tsx",
    ROOT / "src/app/deep-ml/models/epsilon-ensemble/page.tsx",
]

BACKUP_FILE = ROOT / "src/components/models/UniversalModelCharts.tsx.bak_news_patch"

GAMMA_ARTIFACT_BLOCK_MULTILINE = """  {
    key: "gammaDateContext",
    label: "Gamma Date Context for News Tooltips",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_date_context.csv",
    kind: "csv",
  },
"""

GAMMA_ARTIFACT_BLOCK_ONELINE = '  { key: "gammaDateContext", label: "Gamma Date Context for News Tooltips", path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_date_context.csv", kind: "csv" },\n'

HELPER_BLOCK = """
type GammaDateContextLookup = Record<string, Record<string, any>>;

function normalizeChartDate(value: any) {
  if (value === null || value === undefined) return "";
  return String(value).slice(0, 10);
}

function buildGammaDateContextLookup(rows: any[]): GammaDateContextLookup {
  const lookup: GammaDateContextLookup = {};

  if (!Array.isArray(rows)) return lookup;

  for (const row of rows) {
    const date = normalizeChartDate(row?.date);
    if (!date) continue;

    lookup[date] = {
      gamma_tooltip_primary_headline: row.gamma_tooltip_primary_headline || row.top_headline_1 || "",
      gamma_tooltip_primary_source: row.gamma_tooltip_primary_source || row.top_headline_1_source || "",
      gamma_tooltip_note: row.gamma_tooltip_note || row.source_coverage_note || "",
      gamma_context_intensity: row.gamma_context_intensity,
      gamma_context_bucket: row.gamma_context_bucket,
      gamma_recent_headlines_json: row.gamma_recent_headlines_json || "[]",
      source_coverage_note: row.source_coverage_note || "",
      top_headline_1: row.top_headline_1 || "",
      top_headline_1_source: row.top_headline_1_source || "",
      top_headline_1_url: row.top_headline_1_url || "",
    };
  }

  return lookup;
}

function getGammaContextForDate(
  gammaLookup: GammaDateContextLookup,
  dateValue: any
): Record<string, any> {
  const date = normalizeChartDate(dateValue);
  if (!date) return {};
  return gammaLookup[date] || {};
}
"""


def remove_backup():
    if BACKUP_FILE.exists():
        BACKUP_FILE.unlink()
        print(f"removed backup: {BACKUP_FILE}")


def add_gamma_artifact(text: str, page: Path) -> str:
    if "gammaDateContext" in text:
        return text

    # Alpha / Beta / Epsilon multi-line matrixManifest ending
    marker = """  {
    key: "matrixManifest",
    label: "Numeric Feature Store Manifest",
    path: "artifacts/deep_ml/features/deep_ml_numeric_feature_store_manifest.json",
    kind: "json",
  },
];"""
    if marker in text:
        return text.replace(marker, marker.replace("];", GAMMA_ARTIFACT_BLOCK_MULTILINE + "];"))

    # Delta compact one-line matrixManifest ending
    marker2 = '  { key: "matrixManifest", label: "Numeric Feature Store Manifest", path: "artifacts/deep_ml/features/deep_ml_numeric_feature_store_manifest.json", kind: "json" },\n];'
    if marker2 in text:
        return text.replace(marker2, marker2.replace("];", GAMMA_ARTIFACT_BLOCK_ONELINE + "];"))

    raise RuntimeError(f"Could not insert gammaDateContext artifact in {page}")


def add_helpers(text: str, page: Path) -> str:
    if "type GammaDateContextLookup" in text:
        return text

    # Insert before first chart-row builder function. This is present in all four pages.
    marker = "function buildSplitRows("
    if marker not in text:
        raise RuntimeError(f"Could not find buildSplitRows in {page}")

    return text.replace(marker, HELPER_BLOCK + "\n" + marker, 1)


def patch_function_signatures(text: str) -> str:
    text = text.replace(
        "function buildSplitRows(rows: any[], horizon = 10): ForecastChartRow[] {",
        "function buildSplitRows(rows: any[], horizon = 10, gammaLookup: GammaDateContextLookup = {}): ForecastChartRow[] {",
    )

    text = text.replace(
        "function buildRollingRows(rows: any[], horizon = 10): ForecastChartRow[] {",
        "function buildRollingRows(rows: any[], horizon = 10, gammaLookup: GammaDateContextLookup = {}): ForecastChartRow[] {",
    )

    return text


def patch_alpha_beta_objects(text: str) -> str:
    # Alpha/Beta split rows: date: String(row.date)
    text = text.replace(
        """      date: String(row.date),
      split: String(row.split || "test"),""",
        """      date: String(row.date),
      ...getGammaContextForDate(gammaLookup, row.date),
      split: String(row.split || "test"),""",
    )

    # Alpha rolling rows: date: String(row.origin_date)
    text = text.replace(
        """      date: String(row.origin_date),
      split: "rolling_test",""",
        """      date: String(row.origin_date),
      ...getGammaContextForDate(gammaLookup, row.origin_date),
      split: "rolling_test",""",
    )

    # Beta rolling rows: date: String(row.date)
    text = text.replace(
        """      date: String(row.date),
      split: "rolling_test",""",
        """      date: String(row.date),
      ...getGammaContextForDate(gammaLookup, row.date),
      split: "rolling_test",""",
    )

    return text


def patch_delta_epsilon_objects(text: str) -> str:
    # Delta/Epsilon split rows use return { date: String(firstValue(row.date, row.origin_date))
    text = text.replace(
        """        date: String(firstValue(row.date, row.origin_date)),
        split: String(firstValue(row.split, row.data_split, "test")),""",
        """        date: String(firstValue(row.date, row.origin_date)),
        ...getGammaContextForDate(gammaLookup, firstValue(row.date, row.origin_date)),
        split: String(firstValue(row.split, row.data_split, "test")),""",
    )

    # Some Delta/Epsilon versions use split firstValue without data_split
    text = text.replace(
        """        date: String(firstValue(row.date, row.origin_date)),
        split: String(firstValue(row.split, "test")),""",
        """        date: String(firstValue(row.date, row.origin_date)),
        ...getGammaContextForDate(gammaLookup, firstValue(row.date, row.origin_date)),
        split: String(firstValue(row.split, "test")),""",
    )

    # Delta/Epsilon rolling rows
    text = text.replace(
        """      date: String(firstValue(row.date, row.origin_date)),
      split: "rolling_test",""",
        """      date: String(firstValue(row.date, row.origin_date)),
      ...getGammaContextForDate(gammaLookup, firstValue(row.date, row.origin_date)),
      split: "rolling_test",""",
    )

    return text


def patch_main_component_usage(text: str, page: Path) -> str:
    if "const gammaDateContext = getArtifact(results, \"gammaDateContext\") || [];" not in text:
        # Insert after loadedCount because all four pages have it.
        marker = "  const loadedCount = results.filter((item) => item.ok).length;\n"
        if marker not in text:
            raise RuntimeError(f"Could not find loadedCount marker in {page}")

        replacement = marker + """  const gammaDateContext = getArtifact(results, "gammaDateContext") || [];
  const gammaLookup = buildGammaDateContextLookup(gammaDateContext);
"""
        text = text.replace(marker, replacement, 1)

    text = text.replace(
        "const splitRows = buildSplitRows(evaluationRollforward, selectedHorizon);",
        "const splitRows = buildSplitRows(evaluationRollforward, selectedHorizon, gammaLookup);",
    )

    text = text.replace(
        "const rollingRows = buildRollingRows(rollingOriginPredictions, selectedHorizon).slice(-180);",
        "const rollingRows = buildRollingRows(rollingOriginPredictions, selectedHorizon, gammaLookup).slice(-180);",
    )

    return text


def verify_page(text: str, page: Path):
    required = [
        "gammaDateContext",
        "type GammaDateContextLookup",
        "buildGammaDateContextLookup",
        "getGammaContextForDate",
        "gammaLookup",
        "buildSplitRows(evaluationRollforward, selectedHorizon, gammaLookup)",
        "buildRollingRows(rollingOriginPredictions, selectedHorizon, gammaLookup)",
    ]

    missing = [item for item in required if item not in text]
    if missing:
        raise RuntimeError(f"{page} missing expected patch markers: {missing}")


def patch_page(page: Path):
    if not page.exists():
        raise FileNotFoundError(page)

    text = page.read_text(encoding="utf-8")

    original = text
    text = add_gamma_artifact(text, page)
    text = add_helpers(text, page)
    text = patch_function_signatures(text)
    text = patch_alpha_beta_objects(text)
    text = patch_delta_epsilon_objects(text)
    text = patch_main_component_usage(text, page)

    verify_page(text, page)

    if text != original:
        page.write_text(text, encoding="utf-8")
        print(f"patched: {page}")
    else:
        print(f"already patched: {page}")


def main():
    remove_backup()

    for page in PAGES:
        patch_page(page)

    print("\nGamma tooltip join patch complete.")
    print("Next: run npm run dev and test Alpha/Beta/Delta/Epsilon chart tooltips.")


if __name__ == "__main__":
    main()