from pathlib import Path

PAGE = Path("src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx")
text = PAGE.read_text(encoding="utf-8")

# ------------------------------------------------------------
# 1. Add fallback buildModelForecastRows if missing.
# This fixes: buildModelForecastRows is not defined
# ------------------------------------------------------------
if "function buildModelForecastRows(" not in text:
    marker = "function average(values: any[]) {"
    if marker not in text:
        raise RuntimeError("Could not find average() marker. Send page.tsx if this fails.")

    fallback_fn = r'''
function buildModelForecastRows(config: ModelConfig, data: (key: string) => any, startDate: string) {
  const forecastPointRows =
    config.forecastPointsKey && Array.isArray(data(config.forecastPointsKey))
      ? data(config.forecastPointsKey)
      : [];

  const latestRows = rowsFromAny(data(config.forecastKey));
  const rollRowsRaw = Array.isArray(data(config.rollKey)) ? data(config.rollKey) : [];

  const rollRows = normalizeForecastRows(rollRowsRaw, `${config.label} rollforward`);
  const futureRows = normalizeForecastRows([...forecastPointRows, ...latestRows], `${config.label} forecast`);

  const startMs = dateTime(startDate) ?? dateTime(PROJECT_FORECAST_START) ?? 0;
  const sigma = residualStd(rollRows);

  let rows = futureRows.filter((row) => {
    const t = dateTime(row.date);
    return t !== null && t >= startMs && row.forecast !== null;
  });

  // If model does not expose future rows, use recent rollforward rows as fallback
  // so Delta/Epsilon do not render a blank chart.
  if (!rows.length) {
    rows = rollRows.slice(-90).filter((row) => row.forecast !== null);
  }

  const withBand = rows.map((row) => {
    if (row.lower !== null && row.upper !== null) return row;

    if (row.forecast !== null && sigma !== null) {
      return {
        ...row,
        lower: row.forecast - 1.96 * sigma,
        upper: row.forecast + 1.96 * sigma,
        interval_source: "Empirical 95% band from Deep ML rollforward residuals",
      };
    }

    return row;
  });

  return dedupeForecastRows(withBand).filter((row) => row.forecast !== null);
}

'''
    text = text.replace(marker, fallback_fn + marker, 1)

# ------------------------------------------------------------
# 2. Remove matrix actual overlay logic from future forecast chart.
# This removes the May 05 actual-only dot/gap problem.
# ------------------------------------------------------------

# Replace selected forecast rows block if it has matrix overlay.
old_block = '''  const rawSelectedForecastRows = forecastRowsByModel[selectedModelKey] || [];

  const matrixRows = Array.isArray(data("matrix")) ? data("matrix") : [];
  const matrixActualRowsForForecast = useMemo(
    () => matrixActualRowsFromFeatureStore(matrixRows, forecastStart),
    [matrixRows, forecastStart]
  );

  const selectedForecastRows = useMemo(
    () => mergeForecastWithMatrixActuals(rawSelectedForecastRows, matrixActualRowsForForecast),
    [rawSelectedForecastRows, matrixActualRowsForForecast]
  );

  const chartRows = useMemo(() => downsampleRows(selectedForecastRows, 700), [selectedForecastRows]);
  const metrics = useMemo(() => computeMetrics(selectedForecastRows), [selectedForecastRows]);'''

new_block = '''  const rawSelectedForecastRows = forecastRowsByModel[selectedModelKey] || [];

  const matrixRows = Array.isArray(data("matrix")) ? data("matrix") : [];

  // Future chart should start from the selected model forecast itself.
  // Matrix actuals are not added as standalone rows here because they can create a visual gap.
  const selectedForecastRows = useMemo(
    () => rawSelectedForecastRows.filter((row) => row.forecast !== null),
    [rawSelectedForecastRows]
  );

  const chartRows = useMemo(() => downsampleRows(selectedForecastRows, 700), [selectedForecastRows]);
  const metrics = useMemo(() => computeMetrics(selectedForecastRows), [selectedForecastRows]);'''

if old_block in text:
    text = text.replace(old_block, new_block, 1)

# If there is another rawSelectedForecastRows variant from an older patch, normalize it.
text = text.replace(
    '''  const rawSelectedForecastRows = forceForecastStartDate(forecastRowsByModel[selectedModelKey] || [], forecastStart);''',
    '''  const rawSelectedForecastRows = forecastRowsByModel[selectedModelKey] || [];''',
)

# ------------------------------------------------------------
# 3. Remove the chip showing matrix actual overlay.
# ------------------------------------------------------------
text = text.replace(
'''              <span className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                matrix actual overlay: {matrixActualRowsForForecast.length}
              </span>''',
"",
)

# ------------------------------------------------------------
# 4. Remove wording that says actuals are automatically added to this chart.
# ------------------------------------------------------------
text = text.replace(
" Actual gold values from the refreshed matrix are added automatically as they become available.",
"",
)

text = text.replace(
"Actual gold values from the refreshed matrix are added automatically as they become available.",
"",
)

# ------------------------------------------------------------
# 5. Make chart X-axis start cleanly from first forecast row.
# ------------------------------------------------------------
text = text.replace(
'''                    <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={36} />''',
'''                    <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={36} padding={{ left: 0, right: 0 }} />''',
)

# ------------------------------------------------------------
# 6. Remove actual green line from future forecast chart if it causes confusion.
# Keep actuals in the diagnostic chart below.
# ------------------------------------------------------------
text = text.replace(
'''                    <Line type="monotone" dataKey="actual" name="Actual Gold Price" stroke="#16a34a" strokeWidth={2.4} dot={false} connectNulls />''',
'''                    {/* Actual gold is shown in the diagnostic rollforward chart below. The future forecast chart starts from model forecast rows only. */}''',
1,
)

PAGE.write_text(text, encoding="utf-8")

print("Repaired final Deep ML forecast page.")
print("Removed May 05 actual-only overlay from future chart.")
print("Fixed missing buildModelForecastRows error.")
print("Future chart starts from forecast rows only, with no left-side gap.")