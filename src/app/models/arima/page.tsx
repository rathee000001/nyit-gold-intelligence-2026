import type { ReactNode } from "react";
import { promises as fs } from "fs";
import path from "path";
import {
  ActualVsForecastChart,
  MetricComparisonChart,
  ResidualChart,
  type ForecastChartRow,
} from "../../../components/models/UniversalModelCharts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ArtifactRequest = {
  key: string;
  label: string;
  path: string;
};

type ArtifactResult = ArtifactRequest & {
  url: string;
  ok: boolean;
  data: any | null;
  error?: string;
};

type MetricRow = {
  model_name: string;
  model_family?: string;
  candidate_type?: string;
  forecast_mode?: string;
  split: string;
  order?: string;
  n?: number;
  MAE?: number;
  MSE?: number;
  RMSE?: number;
  MAPE?: number;
  SMAPE?: number;
  mean_error?: number;
  max_abs_error?: number;
  AIC?: number;
  BIC?: number;
  source_group?: string;
  [key: string]: any;
};

const PAGE_ARTIFACTS: ArtifactRequest[] = [
  {
    key: "pageArima",
    label: "Page ARIMA",
    path: "artifacts/pages/page_arima.json",
  },
  {
    key: "arimaResults",
    label: "ARIMA Results",
    path: "artifacts/models/arima_results.json",
  },
  {
    key: "arimaDiagnostics",
    label: "ARIMA Diagnostics",
    path: "artifacts/models/arima_diagnostics.json",
  },
  {
    key: "arimaForecastPath",
    label: "ARIMA Forecast Path",
    path: "artifacts/models/arima_forecast_path.json",
  },
  {
    key: "forecastStatus",
    label: "Forecast Status",
    path: "artifacts/governance/forecast_status.json",
  },
  {
    key: "modelWindowPlan",
    label: "Model Window Plan",
    path: "artifacts/governance/model_window_plan.json",
  },
];

function cleanPath(value: string) {
  return value.trim().replace(/^\/+/, "");
}

function getBaseUrl() {
  const base = process.env.NEXT_PUBLIC_ARTIFACT_BASE_URL;
  if (!base || base.trim() === "") return "";
  return base.trim().replace(/\/+$/, "");
}

async function loadArtifact(request: ArtifactRequest): Promise<ArtifactResult> {
  const baseUrl = getBaseUrl();
  const normalizedPath = cleanPath(request.path);

  if (!baseUrl) {
    const filePath = path.join(process.cwd(), "public", normalizedPath);

    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(raw);

      return {
        ...request,
        url: `file://${filePath}`,
        ok: true,
        data,
      };
    } catch (error) {
      return {
        ...request,
        url: `file://${filePath}`,
        ok: false,
        data: null,
        error:
          error instanceof Error
            ? `Local read failed: ${error.message}`
            : "Local read failed.",
      };
    }
  }

  const url = `${baseUrl}/${normalizedPath}`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return {
        ...request,
        url,
        ok: false,
        data: null,
        error: `HTTP ${response.status} while loading ${url}`,
      };
    }

    const data = await response.json();

    return {
      ...request,
      url,
      ok: true,
      data,
    };
  } catch (error) {
    return {
      ...request,
      url,
      ok: false,
      data: null,
      error:
        error instanceof Error
          ? `Remote fetch failed: ${error.message}`
          : "Remote fetch failed.",
    };
  }
}

async function loadArtifacts() {
  return Promise.all(PAGE_ARTIFACTS.map(loadArtifact));
}

function getArtifact(results: ArtifactResult[], key: string) {
  return results.find((item) => item.key === key)?.data || null;
}

function isRecord(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function findValueDeep(obj: any, keys: string[], depth = 0): any {
  if (!obj || depth > 8) return null;

  if (isRecord(obj)) {
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
        return obj[key];
      }
    }

    for (const value of Object.values(obj)) {
      const found = findValueDeep(value, keys, depth + 1);
      if (found !== null && found !== undefined && found !== "") return found;
    }
  }

  if (Array.isArray(obj)) {
    for (const value of obj) {
      const found = findValueDeep(value, keys, depth + 1);
      if (found !== null && found !== undefined && found !== "") return found;
    }
  }

  return null;
}

function safeArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function formatText(value: any) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatNumber(value: any, digits = 2) {
  if (value === null || value === undefined || value === "") return "—";

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) return String(value);

  return numericValue.toLocaleString("en-US", {
    maximumFractionDigits: digits,
  });
}

function toNumber(value: any): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function metricValue(obj: any, key: string) {
  if (!obj) return undefined;

  return (
    obj[key] ??
    obj[key.toUpperCase()] ??
    obj[key.toLowerCase()] ??
    obj[key.replaceAll("_", "")] ??
    undefined
  );
}

function orderToText(order: any) {
  if (!order) return "—";
  if (Array.isArray(order)) return `ARIMA(${order.join(", ")})`;
  return String(order);
}

function hasUsefulMetric(row: MetricRow) {
  return [
    row.MAE,
    row.MSE,
    row.RMSE,
    row.MAPE,
    row.SMAPE,
    row.mean_error,
    row.max_abs_error,
    row.AIC,
    row.BIC,
  ].some((value) => value !== undefined && value !== null && Number.isFinite(Number(value)));
}

function hasUsefulLabel(row: MetricRow) {
  const label = row.model_name || row.candidate_type || row.model_family || row.forecast_mode;
  return Boolean(label && String(label).trim() !== "" && String(label).trim() !== "—");
}

function keepUsefulMetricRows(rows: MetricRow[]) {
  const unique = new Map<string, MetricRow>();

  rows.forEach((row) => {
    if (!hasUsefulLabel(row)) return;
    if (!hasUsefulMetric(row)) return;

    const key = [
      row.source_group || "",
      row.model_name || "",
      row.model_family || "",
      row.forecast_mode || "",
      row.split || "",
      row.order || "",
      row.MAE ?? "",
      row.RMSE ?? "",
      row.MAPE ?? "",
    ].join("|");

    unique.set(key, row);
  });

  return Array.from(unique.values());
}

function getDataset(arimaResults: any, pageData: any) {
  return (
    arimaResults?.dataset ||
    pageData?.dataset_window ||
    pageData?.dataset ||
    findValueDeep(arimaResults, ["dataset"]) ||
    findValueDeep(pageData, ["dataset_window", "dataset"]) ||
    {}
  );
}

function getSplits(arimaResults: any, pageData: any) {
  return (
    arimaResults?.splits ||
    pageData?.split_summary ||
    pageData?.splits ||
    findValueDeep(arimaResults, ["splits"]) ||
    findValueDeep(pageData, ["split_summary", "splits"]) ||
    {}
  );
}

function normalizeMetricRow(row: any, split = "validation", sourceGroup = "metric"): MetricRow {
  const metrics = row?.metrics || row || {};

  return {
    model_name:
      row?.display_name ||
      row?.model_name ||
      row?.model_key ||
      row?.model ||
      row?.candidate ||
      row?.candidate_name ||
      row?.candidate_id ||
      "ARIMA Candidate",
    model_family: row?.model_family,
    candidate_type: row?.candidate_type,
    forecast_mode: row?.forecast_mode,
    split: row?.split || row?.evaluation_period || split,
    order: orderToText(row?.order),
    n: toNumber(metrics?.n ?? row?.n),
    MAE: toNumber(metrics?.mae ?? metrics?.MAE ?? row?.mae ?? row?.MAE),
    MSE: toNumber(metrics?.mse ?? metrics?.MSE ?? row?.mse ?? row?.MSE),
    RMSE: toNumber(metrics?.rmse ?? metrics?.RMSE ?? row?.rmse ?? row?.RMSE),
    MAPE: toNumber(metrics?.mape ?? metrics?.MAPE ?? row?.mape ?? row?.MAPE),
    SMAPE: toNumber(metrics?.smape ?? metrics?.SMAPE ?? row?.smape ?? row?.SMAPE),
    mean_error: toNumber(
      metrics?.mean_error ?? metrics?.meanError ?? row?.mean_error ?? row?.meanError
    ),
    max_abs_error: toNumber(
      metrics?.max_abs_error ?? metrics?.maxAbsError ?? row?.max_abs_error ?? row?.maxAbsError
    ),
    AIC: toNumber(row?.aic ?? row?.AIC ?? metrics?.aic ?? metrics?.AIC),
    BIC: toNumber(row?.bic ?? row?.BIC ?? metrics?.bic ?? metrics?.BIC),
    source_group: sourceGroup,
    ...row,
  };
}

function getArimaFamilyCandidateRows(arimaResults: any): any[] {
  return safeArray(arimaResults?.leaderboards?.arima_family_candidates);
}

function getDeterministicBenchmarkRows(arimaResults: any): any[] {
  return safeArray(arimaResults?.leaderboards?.deterministic_trend_benchmarks);
}

function normalizeSelectedMetricRows(arimaResults: any): MetricRow[] {
  const rows: MetricRow[] = [];
  const selected = arimaResults?.selected_model || {};
  const metrics = arimaResults?.metrics || {};

  if (metrics?.selected_validation) {
    rows.push(
      normalizeMetricRow(
        {
          ...selected,
          display_name: selected?.display_name || selected?.model_name || "Selected ARIMA",
          forecast_mode: selected?.forecast_mode || "selected_rolling",
          metrics: metrics.selected_validation,
        },
        "validation",
        "Selected Model"
      )
    );
  }

  if (metrics?.selected_test) {
    rows.push(
      normalizeMetricRow(
        {
          ...selected,
          display_name: selected?.display_name || selected?.model_name || "Selected ARIMA",
          forecast_mode: selected?.forecast_mode || "selected_rolling",
          metrics: metrics.selected_test,
        },
        "test",
        "Selected Model"
      )
    );
  }

  if (metrics?.static_diagnostic_validation) {
    rows.push(
      normalizeMetricRow(
        {
          ...selected,
          display_name: `${selected?.display_name || selected?.model_name || "Selected ARIMA"} Static Diagnostic`,
          forecast_mode: "static_multi_step_diagnostic",
          metrics: metrics.static_diagnostic_validation,
        },
        "validation",
        "Static Diagnostic"
      )
    );
  }

  if (metrics?.static_diagnostic_test) {
    rows.push(
      normalizeMetricRow(
        {
          ...selected,
          display_name: `${selected?.display_name || selected?.model_name || "Selected ARIMA"} Static Diagnostic`,
          forecast_mode: "static_multi_step_diagnostic",
          metrics: metrics.static_diagnostic_test,
        },
        "test",
        "Static Diagnostic"
      )
    );
  }

  return keepUsefulMetricRows(rows);
}

function normalizeArimaCandidateRows(arimaResults: any): MetricRow[] {
  const candidateRows = getArimaFamilyCandidateRows(arimaResults);

  return keepUsefulMetricRows(
    candidateRows.map((row) =>
      normalizeMetricRow(
        {
          ...row,
          display_name:
            row?.display_name ||
            row?.model_name ||
            row?.candidate ||
            row?.candidate_type ||
            "ARIMA Candidate",
          forecast_mode: row?.forecast_mode || "candidate_validation",
        },
        row?.split || "validation",
        "ARIMA-Family Candidate"
      )
    )
  );
}

function normalizeBenchmarkRows(arimaResults: any): MetricRow[] {
  const benchmarkRows = getDeterministicBenchmarkRows(arimaResults);

  return keepUsefulMetricRows(
    benchmarkRows.map((row) =>
      normalizeMetricRow(
        {
          ...row,
          display_name:
            row?.display_name ||
            row?.model_name ||
            row?.candidate ||
            row?.candidate_type ||
            "Deterministic Benchmark",
          model_family: row?.model_family || "deterministic_benchmark",
          forecast_mode: row?.forecast_mode || "diagnostic_benchmark",
        },
        row?.split || "validation",
        "Deterministic Diagnostic Benchmark"
      )
    )
  );
}

function normalizeAllMetricRows(arimaResults: any) {
  return keepUsefulMetricRows([
    ...normalizeSelectedMetricRows(arimaResults),
    ...normalizeArimaCandidateRows(arimaResults),
    ...normalizeBenchmarkRows(arimaResults),
  ]);
}

function normalizeValidationChartRows(rows: MetricRow[]) {
  return rows
    .filter((row) => String(row.split).toLowerCase() === "validation")
    .filter((row) => row.MAE !== undefined || row.RMSE !== undefined)
    .map((row) => ({
      ...row,
      model_name: `${row.model_name}${row.source_group ? ` — ${row.source_group}` : ""}`,
    }));
}

function getPathRows(arimaForecastPath: any, pathKey: string) {
  const rows = arimaForecastPath?.paths?.[pathKey] || arimaForecastPath?.[pathKey] || [];
  return Array.isArray(rows) ? rows : [];
}

function buildForecastRowsFromPath(rows: any[], fallbackSplit: string): ForecastChartRow[] {
  return rows
    .map((row: any) => {
      const actual =
        row.actual ??
        row.gold_price ??
        row.y ??
        row.actual_gold_price ??
        row.actual_price;

      const prediction =
        row.prediction ??
        row.forecast ??
        row.predicted ??
        row.yhat ??
        row.arima_forecast;

      const residual =
        row.residual ??
        (actual !== undefined && prediction !== undefined
          ? Number(actual) - Number(prediction)
          : null);

      return {
        date: formatText(row.date || row.ds || row.timestamp),
        split: row.evaluation_period || row.split || fallbackSplit,
        actual: toNumber(actual) ?? null,
        forecast: toNumber(prediction) ?? null,
        residual: toNumber(residual) ?? null,
        abs_error: toNumber(row.abs_error ?? row.absolute_error) ?? null,
        model_name: row.model_name,
        forecast_mode: row.forecast_mode,
      };
    })
    .filter((row) => row.date !== "—" && row.actual !== null && row.forecast !== null);
}

function buildSelectedForecastRows(arimaForecastPath: any): ForecastChartRow[] {
  const combined = getPathRows(arimaForecastPath, "selected_validation_and_test");

  const records =
    combined.length > 0
      ? combined
      : [
          ...getPathRows(arimaForecastPath, "selected_validation"),
          ...getPathRows(arimaForecastPath, "selected_test"),
        ];

  return buildForecastRowsFromPath(records, "validation/test");
}

function buildStaticForecastRows(arimaForecastPath: any): ForecastChartRow[] {
  const combined = getPathRows(arimaForecastPath, "static_diagnostic_validation_and_test");

  const records =
    combined.length > 0
      ? combined
      : [
          ...getPathRows(arimaForecastPath, "static_diagnostic_validation"),
          ...getPathRows(arimaForecastPath, "static_diagnostic_test"),
        ];

  return buildForecastRowsFromPath(records, "static diagnostic");
}

function normalizeAdfRows(arimaDiagnostics: any) {
  const rows = safeArray(arimaDiagnostics?.adf_tests);

  return rows.map((row: any) => ({
    test_name: row.test_name || row.series || row.name || row.variable || "ADF Test",
    adf_statistic: toNumber(row.adf_statistic ?? row.statistic ?? row.adf_stat),
    p_value: toNumber(row.p_value ?? row.pvalue),
    used_lag: toNumber(row.used_lag ?? row.usedlag),
    nobs: toNumber(row.nobs),
    conclusion:
      row.conclusion ||
      (toNumber(row.p_value ?? row.pvalue) !== undefined &&
      Number(row.p_value ?? row.pvalue) < 0.05
        ? "Reject unit root at 5%"
        : "Do not reject unit root at 5%"),
    ...row,
  }));
}

function normalizeLjungBoxRows(arimaDiagnostics: any) {
  const rows = safeArray(arimaDiagnostics?.ljung_box_selected_test_residuals);

  return rows.map((row: any) => ({
    lag: row.lag ?? row.index ?? row.Lag,
    lb_stat: toNumber(row.lb_stat ?? row["lb_stat"] ?? row.statistic),
    lb_pvalue: toNumber(row.lb_pvalue ?? row["lb_pvalue"] ?? row.p_value),
    ...row,
  }));
}

function normalizeWorstErrors(arimaDiagnostics: any) {
  return safeArray(arimaDiagnostics?.selected_test_worst_absolute_errors);
}

function CardShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_18px_60px_rgba(15,23,42,0.08)] ${className}`}
    >
      {children}
    </section>
  );
}

function Eyebrow({
  children,
  dark = false,
}: {
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <p
      className={
        dark
          ? "text-xs font-black uppercase tracking-[0.32em] text-yellow-300"
          : "text-xs font-black uppercase tracking-[0.32em] text-blue-600"
      }
    >
      {children}
    </p>
  );
}

function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-7">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-600 md:text-base">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function DarkKpiCard({
  label,
  value,
  note,
}: {
  label: string;
  value: any;
  note?: string;
}) {
  return (
    <div className="rounded-3xl border border-yellow-500/25 bg-white/[0.07] p-5 shadow-2xl backdrop-blur">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-200/80">
        {label}
      </p>
      <p className="mt-3 break-words text-3xl font-black text-white">
        {formatNumber(value)}
      </p>
      {note ? <p className="mt-2 text-sm leading-6 text-slate-300">{note}</p> : null}
    </div>
  );
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={
        ok
          ? "rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700"
          : "rounded-full border border-red-300 bg-red-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-red-700"
      }
    >
      {ok ? "Loaded" : "Missing"}
    </span>
  );
}

function ArimaAnimation() {
  return (
    <div className="relative min-h-[310px] overflow-hidden rounded-[2rem] border border-yellow-400/20 bg-[#050b16] p-6">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute left-8 top-12 h-2 w-2 animate-ping rounded-full bg-yellow-300" />
        <div className="absolute right-16 top-24 h-2 w-2 animate-pulse rounded-full bg-blue-300" />
        <div className="absolute bottom-16 left-1/2 h-2 w-2 animate-ping rounded-full bg-emerald-300" />
      </div>

      <div className="relative z-10">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-yellow-300">
          Notebook 07 Flow
        </p>

        <h3 className="mt-3 text-3xl font-black text-white">
          ARIMA Forecasting
        </h3>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          This notebook separates ARIMA-family candidates from deterministic
          diagnostic benchmarks. The page now filters out non-metric JSON arrays,
          so empty rows no longer pollute the tables.
        </p>

        <div className="mt-7 grid gap-3">
          {[
            ["01", "Plot gold time series"],
            ["02", "Check stationarity"],
            ["03", "Compare ARIMA-family candidates"],
            ["04", "Export selected forecast path"],
          ].map((item) => (
            <div
              key={item[0]}
              className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition duration-300 hover:translate-x-2 hover:border-yellow-300/40"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-yellow-300/40 bg-yellow-300/10 text-sm font-black text-yellow-200">
                {item[0]}
              </div>
              <p className="text-sm font-black uppercase tracking-[0.13em] text-white">
                {item[1]}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SourcePreview({ title, data }: { title: string; data: any }) {
  return (
    <details className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <summary className="cursor-pointer text-sm font-black uppercase tracking-[0.18em] text-slate-700">
        View source preview: {title}
      </summary>
      <pre className="mt-4 max-h-[320px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

function ArtifactStatusTable({ results }: { results: ArtifactResult[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Artifact</th>
            <th className="px-4 py-3">Path</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>

        <tbody>
          {results.map((result) => (
            <tr key={result.key} className="border-t border-slate-200">
              <td className="px-4 py-4 font-bold text-slate-950">
                {result.label}
              </td>
              <td className="px-4 py-4 font-mono text-xs text-slate-500">
                {result.path}
              </td>
              <td className="px-4 py-4">
                <StatusBadge ok={result.ok} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SplitWindowCard({
  label,
  split,
}: {
  label: string;
  split: any;
}) {
  return (
    <div className="rounded-3xl border border-slate-200/20 bg-white/10 p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-yellow-200/80">
        {label}
      </p>
      <p className="mt-3 text-lg font-black text-white">
        {formatText(split?.start)} → {formatText(split?.end)}
      </p>
      <p className="mt-2 text-sm text-slate-300">
        Rows: {formatNumber(split?.rows, 0)}
      </p>
    </div>
  );
}

function MethodExplanationCards() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-[2rem] border border-yellow-200 bg-yellow-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-700">
          ARIMA Meaning
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Auto-Regressive Integrated Moving Average
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          ARIMA forecasts gold using its own historical behavior. The AR part
          uses past values, the I part handles differencing, and the MA part
          models past forecast errors.
        </p>

        <div className="mt-5 rounded-3xl border border-yellow-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Formula
          </p>
          <p className="mt-3 text-2xl font-black text-slate-950">
            ARIMA(p, d, q)
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
          Selection Rule
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          ARIMA-Family Only
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          Deterministic trend benchmarks are shown only as diagnostic context.
          The selected ARIMA model must come from ARIMA-family candidates.
        </p>

        <div className="mt-5 rounded-3xl border border-blue-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Why this matters
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            This avoids accidentally treating a trend benchmark as the ARIMA
            model.
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
          Evaluation Mode
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Rolling + Static
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          Rolling one-step forecasts are fair for comparison with naive
          roll-forward models. Static multi-step forecasts remain diagnostic.
        </p>

        <div className="mt-5 rounded-3xl border border-emerald-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
           Point
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Static flattening is a diagnostic behavior, not the primary model
            comparison if rolling mode is exported.
          </p>
        </div>
      </div>
    </div>
  );
}

function NotebookWorkflow() {
  const steps = [
    {
      title: "Plot Series First",
      detail:
        "Notebook 07 begins with the gold price series before fitting models.",
    },
    {
      title: "Run Stationarity Checks",
      detail:
        "ADF diagnostics support discussion of differencing and stationarity.",
    },
    {
      title: "Fit Diagnostic Benchmarks",
      detail:
        "Deterministic trend and month-seasonality benchmarks are used as context only.",
    },
    {
      title: "Fit ARIMA Candidates",
      detail:
        "Direct ARIMA, log ARIMA, and residual-style ARIMA candidates are compared.",
    },
    {
      title: "Select ARIMA-Family Model",
      detail:
        "The selected model is chosen from ARIMA-family candidates, not broad diagnostic arrays.",
    },
    {
      title: "Export Forecast Paths",
      detail:
        "Selected rolling and static diagnostic paths are exported for charts.",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {steps.map((step, index) => (
        <div
          key={step.title}
          className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
            {index + 1}
          </div>
          <h3 className="mt-4 text-lg font-black text-slate-950">
            {step.title}
          </h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">{step.detail}</p>
        </div>
      ))}
    </div>
  );
}

function MetricsTable({
  rows,
  emptyMessage,
}: {
  rows: MetricRow[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-3xl border border-slate-200">
      <table className="w-full min-w-[1250px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Model</th>
            <th className="px-4 py-3">Family</th>
            <th className="px-4 py-3">Mode</th>
            <th className="px-4 py-3">Split</th>
            <th className="px-4 py-3">Order</th>
            <th className="px-4 py-3">n</th>
            <th className="px-4 py-3">MAE</th>
            <th className="px-4 py-3">RMSE</th>
            <th className="px-4 py-3">MAPE</th>
            <th className="px-4 py-3">SMAPE</th>
            <th className="px-4 py-3">Mean Error</th>
            <th className="px-4 py-3">AIC</th>
            <th className="px-4 py-3">BIC</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-200">
              <td className="px-4 py-4 font-bold text-slate-700">
                {formatText(row.source_group)}
              </td>
              <td className="px-4 py-4 font-black text-slate-950">
                {formatText(row.model_name)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.model_family)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.forecast_mode)}
              </td>
              <td className="px-4 py-4 font-bold capitalize text-slate-700">
                {formatText(row.split)}
              </td>
              <td className="px-4 py-4 text-slate-700">{formatText(row.order)}</td>
              <td className="px-4 py-4 text-slate-700">{formatNumber(row.n, 0)}</td>
              <td className="px-4 py-4 text-slate-700">{formatNumber(row.MAE, 4)}</td>
              <td className="px-4 py-4 font-black text-slate-950">
                {formatNumber(row.RMSE, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.MAPE, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.SMAPE, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.mean_error, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">{formatNumber(row.AIC, 4)}</td>
              <td className="px-4 py-4 text-slate-700">{formatNumber(row.BIC, 4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CandidateDetails({ rows }: { rows: MetricRow[] }) {
  const usefulRows = keepUsefulMetricRows(rows);

  if (usefulRows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No useful candidate metric rows were detected. Empty non-metric JSON
        arrays are intentionally hidden.
      </div>
    );
  }

  const candidates = Array.from(
    new Set(
      usefulRows.map(
        (row) =>
          `${row.model_name} — ${row.forecast_mode || "mode not exported"} — ${
            row.split || "split not exported"
          }`
      )
    )
  );

  return (
    <div className="space-y-4">
      {candidates.map((candidate) => {
        const candidateRows = usefulRows.filter(
          (row) =>
            `${row.model_name} — ${row.forecast_mode || "mode not exported"} — ${
              row.split || "split not exported"
            }` === candidate
        );

        return (
          <details
            key={candidate}
            className="rounded-3xl border border-slate-200 bg-slate-50 p-5 open:bg-white open:shadow-lg"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between">
              <div>
                <p className="text-xl font-black text-slate-950">{candidate}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  This expandable section appears only when real metric values
                  are present.
                </p>
              </div>

              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-black text-blue-700">
                Expand
              </span>
            </summary>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">MAE</th>
                    <th className="px-4 py-3">RMSE</th>
                    <th className="px-4 py-3">MAPE</th>
                    <th className="px-4 py-3">SMAPE</th>
                    <th className="px-4 py-3">AIC</th>
                    <th className="px-4 py-3">BIC</th>
                  </tr>
                </thead>

                <tbody>
                  {candidateRows.map((row, index) => (
                    <tr key={index} className="border-t border-slate-200">
                      <td className="px-4 py-4 font-bold text-slate-700">
                        {formatText(row.source_group)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatText(row.order)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatNumber(row.MAE, 4)}
                      </td>
                      <td className="px-4 py-4 font-black text-slate-950">
                        {formatNumber(row.RMSE, 4)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatNumber(row.MAPE, 4)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatNumber(row.SMAPE, 4)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatNumber(row.AIC, 4)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatNumber(row.BIC, 4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
    </div>
  );
}

function AdfTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No ADF diagnostic table was exported in the current ARIMA diagnostics
        artifact.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Test</th>
            <th className="px-4 py-3">ADF Statistic</th>
            <th className="px-4 py-3">p-value</th>
            <th className="px-4 py-3">Used Lag</th>
            <th className="px-4 py-3">nobs</th>
            <th className="px-4 py-3">Conclusion</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-200">
              <td className="px-4 py-4 font-black text-slate-950">
                {formatText(row.test_name)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.adf_statistic, 6)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.p_value, 6)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.used_lag, 0)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.nobs, 0)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.conclusion)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LjungBoxTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No Ljung-Box table was exported in the current ARIMA diagnostics
        artifact.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Lag</th>
            <th className="px-4 py-3">LB Statistic</th>
            <th className="px-4 py-3">LB p-value</th>
            <th className="px-4 py-3">Reading</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => {
            const p = Number(row.lb_pvalue);
            const reading =
              Number.isFinite(p) && p < 0.05
                ? "Residual autocorrelation may remain"
                : "No strong autocorrelation evidence at 5%";

            return (
              <tr key={index} className="border-t border-slate-200">
                <td className="px-4 py-4 font-black text-slate-950">
                  {formatText(row.lag)}
                </td>
                <td className="px-4 py-4 text-slate-700">
                  {formatNumber(row.lb_stat, 6)}
                </td>
                <td className="px-4 py-4 text-slate-700">
                  {formatNumber(row.lb_pvalue, 6)}
                </td>
                <td className="px-4 py-4 text-slate-700">{reading}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ResidualSummaryBlock({ summary }: { summary: any }) {
  const entries = Object.entries(summary || {});

  if (entries.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No residual summary was exported.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
            {key}
          </p>
          <p className="mt-3 text-2xl font-black text-slate-950">
            {formatNumber(value, 4)}
          </p>
        </div>
      ))}
    </div>
  );
}

function WorstErrorsTable({ rows }: { rows: any[] }) {
  const previewRows = rows.slice(0, 10);

  if (previewRows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No worst-error table was exported.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Actual</th>
            <th className="px-4 py-3">Prediction</th>
            <th className="px-4 py-3">Residual</th>
            <th className="px-4 py-3">Abs Error</th>
          </tr>
        </thead>

        <tbody>
          {previewRows.map((row: any, index) => (
            <tr key={index} className="border-t border-slate-200">
              <td className="px-4 py-4 font-bold text-slate-950">
                {formatText(row.date)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.actual, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.prediction, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.residual, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.abs_error, 4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ForecastPreviewTable({ rows }: { rows: ForecastChartRow[] }) {
  const previewRows = rows.slice(0, 10);

  if (previewRows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        The forecast path artifact loaded, but no usable chart rows were
        detected.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Period</th>
            <th className="px-4 py-3">Actual</th>
            <th className="px-4 py-3">Forecast</th>
            <th className="px-4 py-3">Residual</th>
          </tr>
        </thead>

        <tbody>
          {previewRows.map((row: any, index) => (
            <tr key={index} className="border-t border-slate-200">
              <td className="px-4 py-4 font-bold text-slate-950">
                {formatText(row.date)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.split)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.actual, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.forecast, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.residual, 4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotesBlock({ pageData }: { pageData: any }) {
  const notes = Array.isArray(pageData?.sections)
    ? pageData.sections
        .flatMap((section: any) => section?.body || [])
        .map(formatText)
        .filter((item: string) => item !== "—" && !item.startsWith("{"))
    : [];

  const uniqueNotes = Array.from(new Set(notes));

  if (uniqueNotes.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No page interpretation notes were exported. The page will not invent
        unsupported conclusions.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {uniqueNotes.map((note, index) => (
        <div
          key={index}
          className="rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm leading-7 text-slate-700"
        >
          {note as string}
        </div>
      ))}
    </div>
  );
}

function LimitationsBlock({ pageData }: { pageData: any }) {
  const sections = Array.isArray(pageData?.sections) ? pageData.sections : [];
  const limitationSection = sections.find((section: any) =>
    String(section?.title || "").toLowerCase().includes("limitation")
  );

  const limitations = Array.isArray(limitationSection?.body)
    ? limitationSection.body.map((item: any) => formatText(item))
    : [];

  if (limitations.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No separate limitations list was exported in the page artifact.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {limitations.map((item: string, index: number) => (
        <div
          key={index}
          className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700"
        >
          {item}
        </div>
      ))}
    </div>
  );
}

export default async function ArimaPage() {
  const results = await loadArtifacts();

  const pageData = getArtifact(results, "pageArima");
  const arimaResults = getArtifact(results, "arimaResults");
  const arimaDiagnostics = getArtifact(results, "arimaDiagnostics");
  const arimaForecastPath = getArtifact(results, "arimaForecastPath");
  const forecastStatus = getArtifact(results, "forecastStatus");
  const modelWindowPlan = getArtifact(results, "modelWindowPlan");

  const loadedCount = results.filter((item) => item.ok).length;

  const dataset = getDataset(arimaResults, pageData);
  const splits = getSplits(arimaResults, pageData);

  const selectedModel = arimaResults?.selected_model || pageData?.selected_model || {};

  const selectedModelLabel =
    selectedModel?.display_name ||
    selectedModel?.model_key ||
    selectedModel?.model_name ||
    "Selected ARIMA Model";

  const selectedOrder = orderToText(selectedModel?.order);
  const selectedMode = selectedModel?.forecast_mode || "rolling one-step";

  const selectedMetrics = arimaResults?.metrics || {};
  const validationMetrics = selectedMetrics?.selected_validation || {};
  const testMetrics = selectedMetrics?.selected_test || {};

  const selectedRows = normalizeSelectedMetricRows(arimaResults);
  const arimaCandidateRows = normalizeArimaCandidateRows(arimaResults);
  const benchmarkRows = normalizeBenchmarkRows(arimaResults);
  const allMetricRows = normalizeAllMetricRows(arimaResults);
  const validationChartRows = normalizeValidationChartRows([
    ...arimaCandidateRows,
    ...benchmarkRows,
  ]);

  const selectedChartRows = buildSelectedForecastRows(arimaForecastPath);
  const staticChartRows = buildStaticForecastRows(arimaForecastPath);
  const recentRows = selectedChartRows.slice(-90);

  const adfRows = normalizeAdfRows(arimaDiagnostics);
  const ljungBoxRows = normalizeLjungBoxRows(arimaDiagnostics);
  const worstErrorRows = normalizeWorstErrors(arimaDiagnostics);
  const residualSummary = arimaDiagnostics?.residual_summary || {};

  const officialCutoff =
    dataset?.official_forecast_cutoff ||
    pageData?.dataset_window?.official_cutoff ||
    findValueDeep(forecastStatus, [
      "official_forecast_cutoff_date",
      "officialForecastCutoffDate",
      "cutoff_date",
      "cutoffDate",
      "official_cutoff",
      "officialCutoff",
    ]) ||
    "2026-03-31";

  const pageTitle = pageData?.page_title || "ARIMA Forecasting";

  const pageSubtitle =
    pageData?.page_subtitle ||
    "Classical univariate forecasting with ARIMA-family selection and one-step roll-forward evaluation.";

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.2),_transparent_32%),linear-gradient(135deg,_#05070d_0%,_#0b1728_55%,_#000_100%)] px-6 py-14 text-white md:px-10 lg:px-16">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2.2rem] border border-yellow-500/20 bg-white/[0.06] p-8 shadow-2xl backdrop-blur md:p-10">
            <Eyebrow dark>Gold Nexus Alpha</Eyebrow>

            <h1 className="mt-5 text-5xl font-black tracking-tight text-white md:text-7xl">
              {formatText(pageTitle)}
            </h1>

            <p className="mt-5 max-w-4xl text-base leading-8 text-slate-300 md:text-lg">
              {formatText(pageSubtitle)}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-yellow-100">
                Artifact Status: {loadedCount}/{results.length} Loaded
              </span>

              <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-blue-100">
                Dataset A — Long Univariate
              </span>

              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-100">
                Clean Metric Rows Only
              </span>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-4">
              
              <DarkKpiCard label="Target" value={dataset?.target || "gold_price"} />
              
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <SplitWindowCard label="Train Window" split={splits?.train} />
              <SplitWindowCard label="Validation Window" split={splits?.validation} />
              <SplitWindowCard label="Test Window" split={splits?.test} />
            </div>
          </div>

          <ArimaAnimation />
        </div>
      </section>

      <section className="px-6 py-12 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl space-y-10">
          <CardShell>
            <SectionTitle
              eyebrow="Method Foundation"
              title="What ARIMA Forecasting Does"
              subtitle="This section follows Notebook 07: series plot first, stationarity checks, ARIMA candidate comparison, and selected forecast path export."
            />

            <MethodExplanationCards />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Notebook Workflow"
              title="Colab Logic Converted to Website Sections"
              subtitle="This page no longer treats every JSON array as a metric table. It only displays known metric exports."
            />

            <NotebookWorkflow />
          </CardShell>

          <div className="grid gap-10 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-yellow-200 bg-yellow-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-700">
                Selected ARIMA Model
              </p>
              <h3 className="mt-3 text-3xl font-black text-slate-950">
                {formatText(selectedModelLabel)}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                Selection rule: {formatText(selectedModel?.selection_rule)}
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Order
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatText(selectedOrder)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Validation RMSE
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(metricValue(validationMetrics, "rmse"), 4)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Test RMSE
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(metricValue(testMetrics, "rmse"), 4)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
                Forecast Mode
              </p>
              <h3 className="mt-3 text-3xl font-black text-slate-950">
                {formatText(selectedMode)}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                Rolling one-step forecasts update after each actual observation
                and are directly comparable to naive roll-forward forecasts.
                Static multi-step forecasts are retained as diagnostics.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Selected Rows
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(selectedRows.length, 0)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    ARIMA Candidates
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(arimaCandidateRows.length, 0)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Diagnostic Benchmarks
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(benchmarkRows.length, 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 01"
              title="Actual vs Selected ARIMA Forecast"
              subtitle="This is the primary rolling/selected ARIMA forecast path exported by Notebook 07."
            />

            <ActualVsForecastChart
              title="Actual Gold Price vs Selected ARIMA Forecast"
              rows={selectedChartRows}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="forecast"
              forecastLabel="Selected ARIMA Forecast"
              yAxisLabel="Gold Price (USD/oz)"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 02"
              title="Selected ARIMA Residuals"
              subtitle="Residual = actual gold price minus selected ARIMA forecast."
            />

            <ResidualChart
              title="Selected ARIMA Forecast Residuals"
              rows={selectedChartRows}
              actualKey="actual"
              forecastKey="forecast"
              forecastLabel="Selected ARIMA Forecast"
              yAxisLabel="Actual - Forecast"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 03"
              title="Static Multi-Step Diagnostic"
              subtitle="This chart is diagnostic. It shows long-horizon ARIMA behavior when daily actual observations are not fed back into the model."
            />

            <ActualVsForecastChart
              title="Actual Gold Price vs Static ARIMA Diagnostic"
              rows={staticChartRows}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="forecast"
              forecastLabel="Static ARIMA Diagnostic"
              yAxisLabel="Gold Price (USD/oz)"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 04"
              title="Recent Test Zoom"
              subtitle="This zoomed view shows the most recent 90 selected ARIMA forecast-path rows."
            />

            <ActualVsForecastChart
              title="Recent Test Window: Actual vs Selected ARIMA"
              rows={recentRows}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="forecast"
              forecastLabel="Selected ARIMA Forecast"
              yAxisLabel="Gold Price (USD/oz)"
              showSplitMarkers={false}
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Selected Metrics"
              title="Selected ARIMA Validation and Test Metrics"
              subtitle="Only selected-model rows with real metric values are displayed."
            />

            <MetricsTable
              rows={selectedRows}
              emptyMessage="No useful selected-model ARIMA metric rows were detected."
            />
          </CardShell>

 
          <CardShell>
            <SectionTitle
              eyebrow="Stationarity Diagnostic"
              title="ADF Tests"
              subtitle="ADF tests support discussion of differencing and stationarity before ARIMA modeling."
            />

            <AdfTable rows={adfRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Residual Autocorrelation Diagnostic"
              title="Ljung-Box Test"
              subtitle="Ljung-Box p-values are residual autocorrelation diagnostics, not the final model-selection rule by themselves."
            />

            <LjungBoxTable rows={ljungBoxRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Residual Diagnostic"
              title="Selected ARIMA Residual Summary"
              subtitle="This summarizes validation/test residual behavior for the selected ARIMA path."
            />

            <ResidualSummaryBlock summary={residualSummary} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Error Inspection"
              title="Worst Absolute Test Errors"
              subtitle="This table shows the largest exported absolute errors from the selected ARIMA test residuals."
            />

            <WorstErrorsTable rows={worstErrorRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Forecast Path Preview"
              title="Chart Data Preview"
              subtitle="This preview uses the same selected forecast-path rows that feed the visual charts."
            />

            <ForecastPreviewTable rows={selectedChartRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Interpretation"
              title="How to Explain These Results"
              subtitle="This page keeps the ARIMA explanation clean: ARIMA candidates, diagnostic benchmarks, forecast path, and residual diagnostics."
            />

            <NotesBlock pageData={pageData} />

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  What changed in this page
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  The metric tables now read only known leaderboard objects and
                  selected metric objects. They no longer scan the entire JSON
                  for any array.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why blank rows disappeared
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Rows without real MAE, RMSE, MAPE, SMAPE, AIC, or BIC are
                  filtered out before rendering.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why ARIMA-family rows matter
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  The selected ARIMA model should be explained from ARIMA-family
                  candidates, while deterministic benchmark rows remain
                  diagnostic context only.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Conclusion
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  ARIMA is evaluated as a classical univariate candidate, but
                  final project ranking still belongs to Notebook 11.
                </p>
              </div>
            </div>
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Limitations"
              title="ARIMA Model Limitations"
              subtitle="Limitations are read from the page artifact where available."
            />

            <LimitationsBlock pageData={pageData} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Artifact Status"
              title="JSON Sources Used by This Page"
              subtitle="Every model page must show artifact loading status so missing notebook outputs are visible."
            />

            <ArtifactStatusTable results={results} />
          </CardShell>

          <CardShell className="mb-10">
            <SectionTitle
              eyebrow="Source Preview"
              title="Optional Raw Artifact Preview"
              subtitle="Raw JSON is hidden by default. The visual sections above are generated from these artifacts."
            />

            <div className="grid gap-4">
              <SourcePreview title="page_arima.json" data={pageData} />
              <SourcePreview title="arima_results.json" data={arimaResults} />
              <SourcePreview title="arima_diagnostics.json" data={arimaDiagnostics} />
              <SourcePreview title="arima_forecast_path.json" data={arimaForecastPath} />
              <SourcePreview title="model_window_plan.json" data={modelWindowPlan} />
            </div>
          </CardShell>
        </div>
      </section>
    </main>
  );
}
