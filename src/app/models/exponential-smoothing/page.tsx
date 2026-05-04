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
  mode: string;
  split: string;
  n?: number;
  MAE?: number;
  MSE?: number;
  RMSE?: number;
  MAPE?: number;
  mean_error_bias?: number;
  directional_accuracy_pct?: number;
  [key: string]: any;
};

const PAGE_ARTIFACTS: ArtifactRequest[] = [
  {
    key: "pageExponentialSmoothing",
    label: "Page Exponential Smoothing",
    path: "artifacts/pages/page_exponential_smoothing.json",
  },
  {
    key: "exponentialSmoothingResults",
    label: "Exponential Smoothing Results",
    path: "artifacts/models/exponential_smoothing_results.json",
  },
  {
    key: "exponentialSmoothingForecastPath",
    label: "Exponential Smoothing Forecast Path",
    path: "artifacts/models/exponential_smoothing_forecast_path.json",
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

function findArrayDeep(obj: any, keys: string[], depth = 0): any[] {
  if (!obj || depth > 8) return [];
  if (Array.isArray(obj)) return obj;

  if (isRecord(obj)) {
    for (const key of keys) {
      const value = obj[key];

      if (Array.isArray(value)) return value;

      if (isRecord(value)) {
        const nested = findArrayDeep(value, keys, depth + 1);
        if (nested.length > 0) return nested;
      }
    }

    for (const value of Object.values(obj)) {
      const nested = findArrayDeep(value, keys, depth + 1);
      if (nested.length > 0) return nested;
    }
  }

  return [];
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

function toNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function metricValue(obj: any, key: string) {
  if (!obj) return null;

  return (
    obj[key] ??
    obj[key.toUpperCase()] ??
    obj[key.toLowerCase()] ??
    obj[key.replaceAll("_", "")] ??
    null
  );
}

function getDataset(resultsData: any, pageData: any) {
  return (
    resultsData?.dataset ||
    pageData?.dataset_window ||
    pageData?.dataset ||
    findValueDeep(resultsData, ["dataset"]) ||
    findValueDeep(pageData, ["dataset_window", "dataset"]) ||
    {}
  );
}

function getSplit(dataset: any, split: "train" | "validation" | "test") {
  return dataset?.[split] || {};
}

function normalizeMetricRow(
  row: any,
  mode: string,
  split = "validation"
): MetricRow {
  return {
    model_name:
      row?.model_name ||
      row?.model ||
      row?.method ||
      row?.candidate ||
      row?.name ||
      "Exponential Smoothing",
    mode,
    split: row?.split || row?.phase || split,
    n: toNumber(row?.n ?? row?.count ?? row?.rows) ?? undefined,
    MAE: toNumber(row?.MAE ?? row?.mae) ?? undefined,
    MSE: toNumber(row?.MSE ?? row?.mse) ?? undefined,
    RMSE: toNumber(row?.RMSE ?? row?.rmse) ?? undefined,
    MAPE: toNumber(row?.MAPE ?? row?.mape) ?? undefined,
    mean_error_bias:
      toNumber(row?.mean_error_bias ?? row?.bias ?? row?.meanErrorBias) ??
      undefined,
    directional_accuracy_pct:
      toNumber(
        row?.directional_accuracy_pct ??
          row?.directionalAccuracyPct ??
          row?.directional_accuracy
      ) ?? undefined,
    ...row,
  };
}

function normalizeMetricRows(resultsData: any): MetricRow[] {
  const rollingLeaderboard =
    resultsData?.rolling_validation_leaderboard ||
    findArrayDeep(resultsData, ["rolling_validation_leaderboard"]) ||
    [];

  const staticLeaderboard =
    resultsData?.static_validation_leaderboard ||
    findArrayDeep(resultsData, ["static_validation_leaderboard"]) ||
    [];

  const selected = resultsData?.selected_model || {};
  const selectedName = selected?.model_name || "Selected Smoothing Model";

  const rows: MetricRow[] = [];

  rollingLeaderboard.forEach((row: any) => {
    rows.push(normalizeMetricRow(row, "Rolling One-Step", "validation"));
  });

  staticLeaderboard.forEach((row: any) => {
    rows.push(normalizeMetricRow(row, "Static Multi-Step Diagnostic", "validation"));
  });

  if (selected?.validation_metrics) {
    rows.push(
      normalizeMetricRow(
        {
          model_name: selectedName,
          ...selected.validation_metrics,
        },
        "Selected Rolling One-Step",
        "validation"
      )
    );
  }

  if (selected?.test_metrics_rolling) {
    rows.push(
      normalizeMetricRow(
        {
          model_name: selectedName,
          ...selected.test_metrics_rolling,
        },
        "Selected Rolling One-Step",
        "test"
      )
    );
  }

  if (selected?.test_metrics_static_diagnostic) {
    rows.push(
      normalizeMetricRow(
        {
          model_name: selectedName,
          ...selected.test_metrics_static_diagnostic,
        },
        "Selected Static Diagnostic",
        "test"
      )
    );
  }

  const genericRows =
    resultsData?.metrics_table ||
    resultsData?.metricsTable ||
    resultsData?.model_metrics ||
    resultsData?.candidate_metrics ||
    [];

  if (Array.isArray(genericRows)) {
    genericRows.forEach((row: any) => {
      rows.push(normalizeMetricRow(row, "Artifact Metrics", row?.split || "validation"));
    });
  }

  const unique = new Map<string, MetricRow>();

  rows.forEach((row) => {
    const key = `${row.model_name}|${row.mode}|${row.split}|${row.RMSE}|${row.MAE}`;
    unique.set(key, row);
  });

  return Array.from(unique.values());
}

function selectedValidationMetricRows(metricRows: MetricRow[]) {
  return metricRows
    .filter((row) => String(row.split).toLowerCase() === "validation")
    .map((row) => ({
      ...row,
      model_name: `${row.model_name} — ${row.mode}`,
    }));
}

function findSelectedModel(resultsData: any, metricRows: MetricRow[]) {
  const selected = resultsData?.selected_model || {};

  if (selected?.model_name) return selected;

  const rollingValidationRows = metricRows.filter(
    (row) =>
      String(row.mode).toLowerCase().includes("rolling") &&
      String(row.split).toLowerCase() === "validation"
  );

  const sorted = [...rollingValidationRows].sort(
    (a, b) => Number(a.RMSE ?? Infinity) - Number(b.RMSE ?? Infinity)
  );

  return sorted[0] || {};
}

function buildForecastRows(
  forecastPathData: any,
  resultsData: any
): ForecastChartRow[] {
  const records =
    forecastPathData?.records ||
    forecastPathData?.chart_data ||
    forecastPathData?.data ||
    forecastPathData?.rows ||
    findArrayDeep(forecastPathData, [
      "records",
      "chart_data",
      "chartData",
      "forecast_path",
      "forecastPath",
      "forecast_paths",
      "forecastPaths",
      "paths",
      "rows",
      "data",
    ]);

  const fallbackRecords =
    records && records.length
      ? records
      : findArrayDeep(resultsData, [
          "records",
          "chart_data",
          "chartData",
          "forecast_path",
          "forecastPath",
          "forecast_paths",
          "forecastPaths",
          "predictions",
          "rows",
          "data",
        ]);

  return fallbackRecords
    .map((row: any) => {
      const actual =
        row.actual ??
        row.gold_price ??
        row.y ??
        row.actual_gold_price ??
        row.actual_price;

      const rollingForecast =
        row.rolling_forecast ??
        row.forecast ??
        row.predicted ??
        row.yhat ??
        row.exponential_smoothing_forecast ??
        row.exp_smoothing_pred ??
        row.es_forecast;

      const staticForecast =
        row.static_forecast ??
        row.staticForecast ??
        row.static_diagnostic_forecast ??
        row.multi_step_forecast ??
        row.static_prediction;

      const residual =
        row.residual ??
        (actual !== undefined && rollingForecast !== undefined
          ? Number(actual) - Number(rollingForecast)
          : null);

      return {
        date: formatText(row.date || row.ds || row.timestamp),
        split: row.split || "test",
        actual: toNumber(actual),
        forecast: toNumber(rollingForecast),
        rollingForecast: toNumber(rollingForecast),
        staticForecast: toNumber(staticForecast),
        residual: toNumber(residual),
      };
    })
    .filter((row: any) => row.date !== "—" && row.actual !== null);
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

function SmoothingAnimation() {
  return (
    <div className="relative min-h-[310px] overflow-hidden rounded-[2rem] border border-yellow-400/20 bg-[#050b16] p-6">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute left-8 top-12 h-2 w-2 animate-ping rounded-full bg-yellow-300" />
        <div className="absolute right-16 top-24 h-2 w-2 animate-pulse rounded-full bg-blue-300" />
        <div className="absolute bottom-16 left-1/2 h-2 w-2 animate-ping rounded-full bg-emerald-300" />
      </div>

      <div className="relative z-10">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-yellow-300">
          Notebook 05 Flow
        </p>

        <h3 className="mt-3 text-3xl font-black text-white">
          Exponential Smoothing Forecast
        </h3>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          Static forecasts are kept as diagnostics. The main fair evaluation is
          rolling one-step smoothing because it updates after each observed gold
          price.
        </p>

        <div className="mt-7 grid gap-3">
          {[
            ["01", "Load long univariate gold series"],
            ["02", "Fit smoothing candidates"],
            ["03", "Compare rolling validation RMSE"],
            ["04", "Inspect forecast paths and residuals"],
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
          Method Logic
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Simple Exponential Smoothing
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          Simple exponential smoothing gives more weight to recent observations
          and less weight to older observations. It is useful when the series is
          persistent but should still adapt over time.
        </p>

        <div className="mt-5 rounded-3xl border border-yellow-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
           Formula
          </p>
          <p className="mt-3 text-2xl font-black text-slate-950">
            F<sub>t+1</sub> = αY<sub>t</sub> + (1 − α)F<sub>t</sub>
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
          Trend Extension
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Holt / Damped Holt
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          Holt-style smoothing adds trend behavior. Damped Holt allows trend to
          continue but gradually slows it, which is useful when long-horizon
          trend continuation may be too aggressive.
        </p>

        <div className="mt-5 rounded-3xl border border-blue-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Project Meaning
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            These candidates are compared by validation RMSE, not by visual
            preference.
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
          Fair Evaluation
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Rolling One-Step
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          The uploaded Notebook 05 says rolling one-step forecasts are the
          default fair comparison mode because the model updates after every
          observed gold price.
        </p>

        <div className="mt-5 rounded-3xl border border-emerald-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Important Distinction
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Static multi-step forecasts stay on the page as diagnostics, not as
            the default model-selection chart.
          </p>
        </div>
      </div>
    </div>
  );
}

function NotebookWorkflow() {
  const steps = [
    {
      title: "Load Dataset A",
      detail:
        "Notebook 05 uses the long univariate gold-price dataset and the locked time windows.",
    },
    {
      title: "Show Gold Series",
      detail:
        "The notebook first plots the gold price series before modeling.",
    },
    {
      title: "Fit Smoothing Candidates",
      detail:
        "Simple Exponential Smoothing, Holt Trend, Damped Holt, and optional Holt-Winters diagnostics are tested.",
    },
    {
      title: "Keep Static Diagnostic",
      detail:
        "Static multi-step forecasts are retained because they show how smoothing can lag during large price breakouts.",
    },
    {
      title: "Use Rolling Evaluation",
      detail:
        "Rolling one-step forecasts are the fair daily comparison mode because each step updates after the actual observation.",
    },
    {
      title: "Export JSON Artifacts",
      detail:
        "Results, forecast path, and page metadata are exported so the website stays JSON-first.",
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

function MetricsTable({ rows }: { rows: MetricRow[] }) {
  return (
    <div className="overflow-auto rounded-3xl border border-slate-200">
      <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Model</th>
            <th className="px-4 py-3">Mode</th>
            <th className="px-4 py-3">Split</th>
            <th className="px-4 py-3">n</th>
            <th className="px-4 py-3">MAE</th>
            <th className="px-4 py-3">MSE</th>
            <th className="px-4 py-3">RMSE</th>
            <th className="px-4 py-3">MAPE</th>
            
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-200">
              <td className="px-4 py-4 font-black text-slate-950">
                {formatText(row.model_name)}
              </td>
              <td className="px-4 py-4 text-slate-700">{formatText(row.mode)}</td>
              <td className="px-4 py-4 font-bold capitalize text-slate-700">
                {formatText(row.split)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.n, 0)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.MAE, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.MSE, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.RMSE, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.MAPE, 4)}
              </td>
              
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CandidateDetails({ rows }: { rows: MetricRow[] }) {
  const candidates = Array.from(
    new Set(rows.map((row) => `${row.model_name} — ${row.mode}`))
  ).filter(Boolean);

  return (
    <div className="space-y-4">
      {candidates.map((candidate) => {
        const candidateRows = rows.filter(
          (row) => `${row.model_name} — ${row.mode}` === candidate
        );

        return (
          <details
            key={String(candidate)}
            className="rounded-3xl border border-slate-200 bg-slate-50 p-5 open:bg-white open:shadow-lg"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between">
              <div>
                <p className="text-xl font-black text-slate-950">
                  {formatText(candidate)}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Metrics available for this candidate/mode from the exported
                  Notebook 05 artifacts.
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
                    <th className="px-4 py-3">Split</th>
                    <th className="px-4 py-3">n</th>
                    <th className="px-4 py-3">MAE</th>
                    <th className="px-4 py-3">RMSE</th>
                    <th className="px-4 py-3">MAPE</th>
                    <th className="px-4 py-3">Bias</th>
                    <th className="px-4 py-3">Direction %</th>
                  </tr>
                </thead>

                <tbody>
                  {candidateRows.map((row, index) => (
                    <tr key={index} className="border-t border-slate-200">
                      <td className="px-4 py-4 font-bold capitalize text-slate-950">
                        {formatText(row.split)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatNumber(row.n, 0)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatNumber(row.MAE, 4)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatNumber(row.RMSE, 4)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatNumber(row.MAPE, 4)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatNumber(row.mean_error_bias, 4)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatNumber(row.directional_accuracy_pct, 4)}
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

function ForecastPreviewTable({ rows }: { rows: ForecastChartRow[] }) {
  const previewRows = rows.slice(0, 10);

  if (previewRows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        The forecast path artifact loaded, but the preview table could not
        detect chart rows.
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
            <th className="px-4 py-3">Rolling Forecast</th>
            <th className="px-4 py-3">Static Diagnostic</th>
            <th className="px-4 py-3">Residual</th>
          </tr>
        </thead>

        <tbody>
          {previewRows.map((row, index) => (
            <tr key={index} className="border-t border-slate-200">
              <td className="px-4 py-4 font-bold text-slate-950">
                {formatText(row.date)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.actual, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.forecast, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber((row as any).staticForecast, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber((row as any).residual, 4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotesBlock({ resultsData, pageData }: { resultsData: any; pageData: any }) {
  const notes = [
    ...findArrayDeep(resultsData, ["interpretation_notes"]),
    ...findArrayDeep(pageData, ["professor_safe_summary", "summary_points"]),
  ]
    .map((item) => formatText(item))
    .filter((item) => item !== "—" && !item.startsWith("{"));

  const uniqueNotes = Array.from(new Set(notes));

  if (uniqueNotes.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {uniqueNotes.map((note, index) => (
        <div
          key={index}
          className="rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm leading-7 text-slate-700"
        >
          {note}
        </div>
      ))}
    </div>
  );
}

export default async function ExponentialSmoothingPage() {
  const results = await loadArtifacts();

  const pageData = getArtifact(results, "pageExponentialSmoothing");
  const smoothingResults = getArtifact(results, "exponentialSmoothingResults");
  const smoothingForecastPath = getArtifact(
    results,
    "exponentialSmoothingForecastPath"
  );
  const forecastStatus = getArtifact(results, "forecastStatus");
  const modelWindowPlan = getArtifact(results, "modelWindowPlan");

  const loadedCount = results.filter((item) => item.ok).length;

  const dataset = getDataset(smoothingResults, pageData);
  const trainSplit = getSplit(dataset, "train");
  const validationSplit = getSplit(dataset, "validation");
  const testSplit = getSplit(dataset, "test");

  const metricRows = normalizeMetricRows(smoothingResults);
  const selectedModel = findSelectedModel(smoothingResults, metricRows);

  const selectedModelLabel =
    selectedModel?.model_name ||
    selectedModel?.model ||
    selectedModel?.method ||
    "Selected Smoothing Model";

  const selectedParams =
    selectedModel?.parameters ||
    smoothingResults?.selected_model?.parameters ||
    {};

  const validationMetrics =
    selectedModel?.validation_metrics ||
    metricRows.find(
      (row) =>
        String(row.mode).toLowerCase().includes("rolling") &&
        String(row.split).toLowerCase() === "validation" &&
        String(row.model_name) === String(selectedModelLabel)
    ) ||
    {};

  const testMetrics =
    selectedModel?.test_metrics_rolling ||
    metricRows.find(
      (row) =>
        String(row.mode).toLowerCase().includes("rolling") &&
        String(row.split).toLowerCase() === "test" &&
        String(row.model_name) === String(selectedModelLabel)
    ) ||
    {};

  const officialCutoff =
    findValueDeep(forecastStatus, [
      "official_forecast_cutoff_date",
      "officialForecastCutoffDate",
      "cutoff_date",
      "cutoffDate",
      "official_cutoff",
      "officialCutoff",
    ]) ||
    dataset?.end ||
    "2026-03-31";

  const chartRows = buildForecastRows(smoothingForecastPath, smoothingResults);
  const recentRows = chartRows.slice(-90);
  const validationChartRows = selectedValidationMetricRows(metricRows);

  const pageTitle =
    pageData?.page_title ||
    "Exponential Smoothing Forecast";

  const pageSubtitle =
    pageData?.page_subtitle ||
    "Smoothing model with static diagnostics and one-step rolling evaluation.";

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
                Default: Rolling One-Step
              </span>

              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-100">
                Static Forecast = Diagnostic
              </span>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-4">
            
              <DarkKpiCard label="Target" value={dataset?.target || "gold_price"} />
            
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <SplitWindowCard label="Train Window" split={trainSplit} />
              <SplitWindowCard label="Validation Window" split={validationSplit} />
              <SplitWindowCard label="Test Window" split={testSplit} />
            </div>
          </div>

          <SmoothingAnimation />
        </div>
      </section>

      <section className="px-6 py-12 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl space-y-10">
          <CardShell>
            <SectionTitle
              eyebrow="Method Foundation"
              title="What Exponential Smoothing Does"
              subtitle="This section follows the notebook explanation before showing forecast plots and metrics."
            />

            <MethodExplanationCards />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Notebook Workflow"
              title="Colab Logic Converted to Website Sections"
              subtitle="Notebook 05 explicitly separates static diagnostics from rolling one-step model evaluation."
            />

            <NotebookWorkflow />
          </CardShell>

          <div className="grid gap-10 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-yellow-200 bg-yellow-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-700">
                Selected Model
              </p>
              <h3 className="mt-3 text-3xl font-black text-slate-950">
                {formatText(selectedModelLabel)}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                Notebook 05 selects the final smoothing candidate by rolling
                one-step validation RMSE. This is still not the final overall
                project winner; Notebook 11 performs full model comparison.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Validation MAE
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(metricValue(validationMetrics, "mae"), 4)}
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
                Selected Parameters
              </p>
              <h3 className="mt-3 text-3xl font-black text-slate-950">
                Smoothing Configuration
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                These parameters are read from the selected model artifact. If a
                value is blank, the notebook did not export that parameter.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {Object.entries(selectedParams).length > 0 ? (
                  Object.entries(selectedParams).map(([key, value]) => (
                    <div key={key} className="rounded-2xl bg-white p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                        {key}
                      </p>
                      <p className="mt-1 break-words text-lg font-black text-slate-950">
                        {formatText(value)}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-white p-4 text-sm leading-7 text-slate-600 md:col-span-2">
                    No parameter object was exported for the selected smoothing
                    model.
                  </div>
                )}
              </div>
            </div>
          </div>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 01"
              title="Actual vs Rolling Smoothing Forecast"
              subtitle="This is the main Notebook 05 chart for fair evaluation. It uses rolling one-step forecasts."
            />

            <ActualVsForecastChart
              title="Actual Gold Price vs Rolling Smoothing Forecast"
              rows={chartRows}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="forecast"
              forecastLabel="Rolling One-Step Forecast"
              yAxisLabel="Gold Price (USD/oz)"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 02"
              title="Rolling Smoothing Residuals"
              subtitle="Residual = actual gold price minus rolling one-step forecast."
            />

            <ResidualChart
              title="Rolling One-Step Smoothing Residuals"
              rows={chartRows}
              actualKey="actual"
              forecastKey="forecast"
              forecastLabel="Rolling One-Step Forecast"
              yAxisLabel="Actual - Forecast"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 03"
              title="Static Multi-Step Diagnostic"
              subtitle="Notebook 05 keeps this chart as a diagnostic because static smoothing may lag during the 2024–2026 gold breakout."
            />

            <ActualVsForecastChart
              title="Actual Gold Price vs Static Multi-Step Diagnostic"
              rows={chartRows}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="staticForecast"
              forecastLabel="Static Multi-Step Diagnostic"
              yAxisLabel="Gold Price (USD/oz)"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 04"
              title="Recent Test Zoom"
              subtitle="This mirrors the notebook's recent test zoom by showing the final 90 forecast-path rows."
            />

            <ActualVsForecastChart
              title="Recent Test Window: Actual vs Rolling Forecast"
              rows={recentRows}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="forecast"
              forecastLabel="Rolling One-Step Forecast"
              yAxisLabel="Gold Price (USD/oz)"
              showSplitMarkers={false}
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Output Table"
              title="Exponential Smoothing Metrics"
              subtitle="This table is built from rolling validation, static validation, selected validation, and selected test metrics exported by Notebook 05."
            />

            <MetricsTable rows={metricRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 05"
              title="Validation Error Comparison"
              subtitle="This compares validation MAE and RMSE across smoothing candidates and evaluation modes."
            />

            <MetricComparisonChart
              rows={validationChartRows}
              title="Exponential Smoothing Validation Error Comparison"
              subtitle="Validation MAE and RMSE by smoothing candidate. Lower error is better."
              split="validation"
              xKey="model_name"
              xLabel="Smoothing Candidate"
              yLabel="Error"
              bars={[
                { key: "MAE", label: "MAE", color: "#2563eb" },
                { key: "RMSE", label: "RMSE", color: "#ca8a04" },
              ]}
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Expandable Detail"
              title="Candidate Breakdown"
              subtitle="Open each candidate to inspect the exported metric rows."
            />

            <CandidateDetails rows={metricRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Forecast Path Preview"
              title="Chart Data Preview"
              subtitle="This preview uses the same forecast-path rows that feed the visual charts."
            />

            <ForecastPreviewTable rows={chartRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow=" Interpretation"
              title="How to Explain These Results"
              subtitle="These notes come from the notebook logic and artifact interpretation fields where available."
            />

            <NotesBlock resultsData={smoothingResults} pageData={pageData} />

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why rolling one-step matters
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Rolling one-step evaluation is fairer for daily forecasting
                  because the model updates after each observed gold price
                  rather than forecasting the entire test period from one old
                  origin.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why static forecasts are diagnostic
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Static smoothing forecasts can underforecast during a strong
                  breakout. Keeping the chart helps explain why model evaluation
                  method matters.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why smoothing can lag
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Smoothing models are useful for persistent series, but they do
                  not directly model macroeconomic drivers. This can cause
                  delayed reaction during regime shifts.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Conclusion
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Exponential smoothing is a serious baseline method. It should
                  be compared against all other models only through the shared
                  Notebook 11 validation framework.
                </p>
              </div>
            </div>
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
              <SourcePreview
                title="page_exponential_smoothing.json"
                data={pageData}
              />
              <SourcePreview
                title="exponential_smoothing_results.json"
                data={smoothingResults}
              />
              <SourcePreview
                title="exponential_smoothing_forecast_path.json"
                data={smoothingForecastPath}
              />
              <SourcePreview title="model_window_plan.json" data={modelWindowPlan} />
            </div>
          </CardShell>
        </div>
      </section>
    </main>
  );
}
