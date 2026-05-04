import type { ReactNode } from "react";
import { promises as fs } from "fs";
import path from "path";
import { artifactPaths } from "@/lib/artifactPaths";
import {
  ActualVsForecastChart,
  MetricComparisonChart,
  ResidualChart,
  type ForecastChartRow,
  type MovingAverageMetricRow,
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

const PAGE_ARTIFACTS: ArtifactRequest[] = [
  {
    key: "pageNaiveMovingAverage",
    label: "Page Naive Moving Average",
    path: artifactPaths.pages.naiveMovingAverage,
  },
  {
    key: "naiveResults",
    label: "Naive Results",
    path: artifactPaths.models.naive,
  },
  {
    key: "movingAverageResults",
    label: "Moving Average Results",
    path: artifactPaths.models.movingAverage,
  },
  {
    key: "baselineForecastPaths",
    label: "Baseline Forecast Paths",
    path: artifactPaths.models.baselineForecastPaths,
  },
  {
    key: "forecastStatus",
    label: "Forecast Status",
    path: artifactPaths.governance.forecastStatus,
  },
  {
    key: "modelWindowPlan",
    label: "Model Window Plan",
    path: artifactPaths.governance.modelWindowPlan,
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

function getMetricFromObject(obj: any, key: string) {
  if (!obj) return null;
  return obj[key] ?? obj[key.toUpperCase()] ?? obj[key.toLowerCase()] ?? null;
}

function getSplitMetrics(metrics: any, split: string) {
  if (!metrics) return null;

  return (
    metrics[split] ||
    metrics[split.toLowerCase()] ||
    metrics[split.toUpperCase()] ||
    null
  );
}

function getDatasetSplits(naiveResults: any, pageData: any) {
  return (
    naiveResults?.dataset?.splits ||
    pageData?.splits ||
    findValueDeep(naiveResults, ["splits"]) ||
    findValueDeep(pageData, ["splits"]) ||
    {}
  );
}

function getDatasetWindow(naiveResults: any, pageData: any) {
  return (
    naiveResults?.dataset?.window ||
    pageData?.dataset_window ||
    findValueDeep(naiveResults, ["window"]) ||
    findValueDeep(pageData, ["dataset_window"]) ||
    {}
  );
}

function buildForecastRows(
  forecastPaths: any,
  movingAverageForecastKey: string
): ForecastChartRow[] {
  const rows = findArrayDeep(forecastPaths, [
    "chart_data",
    "chartData",
    "forecast_path",
    "forecastPath",
    "forecast_paths",
    "forecastPaths",
    "paths",
    "records",
    "rows",
    "data",
  ]);

  return rows
    .map((row) => {
      const actual =
        row.gold_price ??
        row.actual ??
        row.y ??
        row.actual_gold_price ??
        row.actual_price;

      const naiveForecast =
        row.naive_pred ??
        row.naive_forecast ??
        row.naiveForecast ??
        row.forecast_naive;

      const movingAverageForecast =
        row[movingAverageForecastKey] ??
        row.ma_forecast ??
        row.moving_average_forecast ??
        row.movingAverageForecast;

      return {
        date: formatText(row.date || row.ds || row.timestamp),
        split: row.split,
        actual: toNumber(actual),
        naiveForecast: toNumber(naiveForecast),
        movingAverageForecast: toNumber(movingAverageForecast),
      };
    })
    .filter((row) => row.date !== "—" && row.actual !== null);
}

function normalizeMovingAverageMetricRows(data: any): MovingAverageMetricRow[] {
  const rows =
    data?.metrics_table ||
    data?.metricsTable ||
    findArrayDeep(data, [
      "metrics_table",
      "metricsTable",
      "moving_average_metrics",
      "movingAverageMetrics",
      "results",
      "records",
      "rows",
      "data",
    ]) ||
    [];

  return rows.map((row: any) => ({
    window: row.window ?? row.ma_window ?? row.moving_average_window,
    split: row.split ?? row.dataset_split ?? row.phase,
    n: toNumber(row.n ?? row.count ?? row.rows) ?? undefined,
    MAE: toNumber(row.MAE ?? row.mae) ?? undefined,
    MSE: toNumber(row.MSE ?? row.mse) ?? undefined,
    RMSE: toNumber(row.RMSE ?? row.rmse) ?? undefined,
    MAPE: toNumber(row.MAPE ?? row.mape) ?? undefined,
    mean_error_bias:
      toNumber(row.mean_error_bias ?? row.bias ?? row.meanErrorBias) ?? undefined,
    directional_accuracy_pct:
      toNumber(
        row.directional_accuracy_pct ??
          row.directionalAccuracyPct ??
          row.directional_accuracy
      ) ?? undefined,
  }));
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

function BaselineAnimation() {
  return (
    <div className="relative min-h-[310px] overflow-hidden rounded-[2rem] border border-yellow-400/20 bg-[#050b16] p-6">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute left-8 top-12 h-2 w-2 animate-ping rounded-full bg-yellow-300" />
        <div className="absolute right-16 top-24 h-2 w-2 animate-pulse rounded-full bg-blue-300" />
        <div className="absolute bottom-16 left-1/2 h-2 w-2 animate-ping rounded-full bg-emerald-300" />
      </div>

      <div className="relative z-10">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-yellow-300">
          Notebook 04 Flow
        </p>

        <h3 className="mt-3 text-3xl font-black text-white">
         Baseline Forecast
        </h3>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          The website mirrors the Colab notebook: load data, split by time,
          forecast one step forward, plot forecast paths, inspect residuals,
          and compare error metrics.
        </p>

        <div className="mt-7 grid gap-3">
          {[
            ["01", "Load long univariate gold series"],
            ["02", "Create train / validation / test splits"],
            ["03", "Run one-step roll-forward forecasts"],
            ["04", "Evaluate metrics and residuals"],
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
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-[2rem] border border-yellow-200 bg-yellow-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-700">
          Baseline Method 01
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Naive Forecast
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          The naive forecast uses the most recent observed gold price as the
          next forecast. It is intentionally simple and acts as the benchmark
          that more complex models should beat.
        </p>

        <div className="mt-5 rounded-3xl border border-yellow-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Formula
          </p>
          <p className="mt-3 text-2xl font-black text-slate-950">
            ŷ<sub>t</sub> = y<sub>t-1</sub>
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            For date t, the forecast equals the last gold price known before t.
            This avoids leakage because it does not use the actual value from t.
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
          Baseline Method 02
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Moving Average Forecast
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          The moving-average forecast smooths recent price movements by
          averaging the previous k observed gold prices. Notebook 04 tests
          multiple weekday windows.
        </p>

        <div className="mt-5 rounded-3xl border border-blue-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Formula
          </p>
          <p className="mt-3 text-2xl font-black text-slate-950">
            ŷ<sub>t</sub> = average(y<sub>t-1</sub>, ..., y<sub>t-k</sub>)
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            The rolling average is shifted one period so the test is one-step
            roll-forward and does not leak the current actual value.
          </p>
        </div>
      </div>
    </div>
  );
}

function NotebookWorkflow() {
  const steps = [
    {
      title: "Load Model-Ready Data",
      detail:
        "Notebook 04 loads the long univariate dataset from Notebook 03 and keeps gold_price as the target series.",
    },
    {
      title: "Create Time Series",
      detail:
        "The date column is parsed and used as the time index in time-series setup.",
    },
    {
      title: "Split Chronologically",
      detail:
        "The model uses time-based train, validation, and test windows instead of random splitting.",
    },
    {
      title: "Forecast One Step Forward",
      detail:
        "For each date t, the forecast only uses information available before date t.",
    },
    {
      title: "Evaluate Accuracy",
      detail:
        "The notebook reports MAE, MSE, RMSE, MAPE, mean error bias, and directional accuracy.",
    },
    {
      title: "Export JSON Artifacts",
      detail:
        "The outputs are exported to JSON so this frontend can render model results without hardcoding claims.",
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

function MetricsBySplitCards({
  title,
  metrics,
}: {
  title: string;
  metrics: any;
}) {
  const splits = ["train", "validation", "test"];

  return (
    <div className="rounded-[2rem] border border-yellow-200 bg-yellow-50 p-6">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-700">
        Metrics by Split
      </p>
      <h3 className="mt-3 text-2xl font-black text-slate-950">{title}</h3>

      <div className="mt-5 grid gap-4">
        {splits.map((split) => {
          const m = getSplitMetrics(metrics, split);

          return (
            <div key={split} className="rounded-3xl bg-white p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                {split}
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    MAE
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(getMetricFromObject(m, "MAE"), 4)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    RMSE
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(getMetricFromObject(m, "RMSE"), 4)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    MAPE
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(getMetricFromObject(m, "MAPE"), 4)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MovingAverageMetricsTable({ rows }: { rows: MovingAverageMetricRow[] }) {
  return (
    <div className="overflow-auto rounded-3xl border border-slate-200">
      <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Window</th>
            <th className="px-4 py-3">Split</th>
            <th className="px-4 py-3">n</th>
            <th className="px-4 py-3">MAE</th>
            <th className="px-4 py-3">MSE</th>
            <th className="px-4 py-3">RMSE</th>
            <th className="px-4 py-3">MAPE</th>
            <th className="px-4 py-3">Mean Error Bias</th>
            <th className="px-4 py-3">Directional Accuracy %</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-200">
              <td className="px-4 py-4 font-black text-slate-950">
                {formatText(row.window)}
              </td>
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
  );
}

function MovingAverageWindowDetails({ rows }: { rows: MovingAverageMetricRow[] }) {
  const windows = Array.from(new Set(rows.map((row) => row.window))).filter(
    (window) => window !== null && window !== undefined
  );

  return (
    <div className="space-y-4">
      {windows.map((window) => {
        const windowRows = rows.filter((row) => String(row.window) === String(window));

        return (
          <details
            key={String(window)}
            className="rounded-3xl border border-slate-200 bg-slate-50 p-5 open:bg-white open:shadow-lg"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between">
              <div>
                <p className="text-xl font-black text-slate-950">
                  {window}-Day Moving Average
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Train, validation, and test metrics for this rolling window.
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
                  {windowRows.map((row, index) => (
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
            <th className="px-4 py-3">Split</th>
            <th className="px-4 py-3">Actual Gold Price</th>
            <th className="px-4 py-3">Naive Forecast</th>
            <th className="px-4 py-3">Moving Average Forecast</th>
          </tr>
        </thead>

        <tbody>
          {previewRows.map((row, index) => (
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
                {formatNumber(row.naiveForecast, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.movingAverageForecast, 4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LimitationsBlock({
  pageData,
  naiveResults,
  movingAverageResults,
}: {
  pageData: any;
  naiveResults: any;
  movingAverageResults: any;
}) {
  const limitations = [
    ...findArrayDeep(pageData, ["limitations", "model_limitations"]),
    ...findArrayDeep(naiveResults, ["limitations"]),
    ...findArrayDeep(movingAverageResults, ["limitations"]),
  ];

  const uniqueLimitations = Array.from(new Set(limitations.map((item) => formatText(item))));

  if (uniqueLimitations.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        The current artifacts do not contain a separate limitations list. The
        page does not invent unsupported limitations.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {uniqueLimitations.map((item, index) => (
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

export default async function NaiveMovingAveragePage() {
  const results = await loadArtifacts();

  const pageData = getArtifact(results, "pageNaiveMovingAverage");
  const naiveResults = getArtifact(results, "naiveResults");
  const movingAverageResults = getArtifact(results, "movingAverageResults");
  const baselineForecastPaths = getArtifact(results, "baselineForecastPaths");
  const modelWindowPlan = getArtifact(results, "modelWindowPlan");
  const forecastStatus = getArtifact(results, "forecastStatus");

  const loadedCount = results.filter((item) => item.ok).length;

  const pageTitle =
    findValueDeep(pageData, ["page_title", "pageTitle", "title"]) ||
    "Naive + Moving Average Forecasts";

  const pageSubtitle =
    findValueDeep(pageData, ["page_subtitle", "pageSubtitle", "subtitle", "summary"]) ||
    "Baseline time-series forecasts for gold price.";

  const datasetWindow = getDatasetWindow(naiveResults, pageData);
  const splits = getDatasetSplits(naiveResults, pageData);

  const naiveMetrics =
    naiveResults?.metrics || findValueDeep(naiveResults, ["metrics"]) || {};

  const maMetricsTable = normalizeMovingAverageMetricRows(movingAverageResults);

  const bestMa =
    movingAverageResults?.best_moving_average_by_validation_rmse ||
    movingAverageResults?.bestMovingAverageByValidationRmse ||
    findValueDeep(movingAverageResults, [
      "best_moving_average_by_validation_rmse",
      "bestMovingAverageByValidationRmse",
    ]) ||
    {};

  const bestMaWindow =
    bestMa?.window ??
    bestMa?.ma_window ??
    bestMa?.moving_average_window ??
    maMetricsTable
      .filter((row) => String(row.split).toLowerCase() === "validation")
      .sort((a, b) => Number(a.RMSE ?? Infinity) - Number(b.RMSE ?? Infinity))[0]
      ?.window;

  const bestMaMetrics =
    bestMa?.metrics ||
    maMetricsTable.find(
      (row) =>
        String(row.window) === String(bestMaWindow) &&
        String(row.split).toLowerCase() === "validation"
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
    ]) || datasetWindow?.cutoff;

  const movingAverageForecastKey = bestMaWindow ? `ma_${bestMaWindow}_pred` : "ma_5_pred";
  const chartRows = buildForecastRows(baselineForecastPaths, movingAverageForecastKey);

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
                Long Univariate Dataset
              </span>

              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-100">
                One-Step Roll Forward
              </span>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-4">
        
              <DarkKpiCard label="Target" value={datasetWindow?.target || "gold_price"} />
             
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <SplitWindowCard label="Train Window" split={splits?.train} />
              <SplitWindowCard label="Validation Window" split={splits?.validation} />
              <SplitWindowCard label="Test Window" split={splits?.test} />
            </div>
          </div>

          <BaselineAnimation />
        </div>
      </section>

      <section className="px-6 py-12 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl space-y-10">
          <CardShell>
            <SectionTitle
              eyebrow="Method Foundation"
              title="What These Forecasting Methods Are"
              subtitle="This section mirrors the professor-style explanation before looking at model results."
            />
            <MethodExplanationCards />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Notebook Workflow"
              title="Colab Logic Converted to Website Sections"
              subtitle="Notebook 04 loads data, builds a time-series object, splits by date, forecasts, plots, evaluates, and exports artifacts."
            />
            <NotebookWorkflow />
          </CardShell>

          <div className="grid gap-10 lg:grid-cols-2">
            <MetricsBySplitCards
              title="Naive Forecast Metrics"
              metrics={naiveMetrics}
            />

            <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
                Best Moving Average Window
              </p>
              <h3 className="mt-3 text-3xl font-black text-slate-950">
                {formatText(bestMaWindow)}-Day Moving Average
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                Selected within the moving-average family using the validation
                RMSE criterion exported by Notebook 04. This is not the final
                project winner; full model selection happens in Notebook 11.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Validation MAE
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(bestMaMetrics?.MAE, 4)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Validation RMSE
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(bestMaMetrics?.RMSE, 4)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Direction %
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(bestMaMetrics?.directional_accuracy_pct, 4)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 01"
              title="Actual vs Naive Forecast"
              subtitle="This is the website version of the notebook actual-vs-naive forecast chart."
            />

            <ActualVsForecastChart
              title="Actual Gold Price vs Naive Forecast"
              rows={chartRows}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="naiveForecast"
              forecastLabel="Naive Forecast"
              yAxisLabel="Gold Price (USD/oz)"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 02"
              title="Naive Forecast Residuals"
              subtitle="This is the website version of the notebook naive residual chart."
            />

            <ResidualChart
              title="Naive Forecast Residuals"
              rows={chartRows}
              actualKey="actual"
              forecastKey="naiveForecast"
              forecastLabel="Naive Forecast"
              yAxisLabel="Actual - Forecast"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Output Table"
              title="Moving Average One-Step Roll-Forward Metrics"
              subtitle="This table mirrors the Colab output: window, split, n, MAE, MSE, RMSE, MAPE, mean error bias, and directional accuracy."
            />

            <MovingAverageMetricsTable rows={maMetricsTable} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 03"
              title="Actual vs Best Moving Average Forecast"
              subtitle="This chart uses the forecast column associated with the best validation-RMSE moving-average window."
            />

            <ActualVsForecastChart
              title={`Actual Gold Price vs ${formatText(bestMaWindow)}-Day Moving Average Forecast`}
              rows={chartRows}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="movingAverageForecast"
              forecastLabel={`${formatText(bestMaWindow)}-Day Moving Average`}
              yAxisLabel="Gold Price (USD/oz)"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 04"
              title="Moving Average Residuals"
              subtitle="This residual chart shows actual minus the selected moving-average forecast."
            />

            <ResidualChart
              title={`${formatText(bestMaWindow)}-Day Moving Average Residuals`}
              rows={chartRows}
              actualKey="actual"
              forecastKey="movingAverageForecast"
              forecastLabel={`${formatText(bestMaWindow)}-Day Moving Average`}
              yAxisLabel="Actual - Forecast"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 05"
              title="Moving Average Validation Error Comparison"
              subtitle="This chart compares validation MAE and RMSE across moving-average windows."
            />

            <MetricComparisonChart
              rows={maMetricsTable}
              title="Moving Average Window Error Comparison"
              subtitle="Validation MAE and RMSE by moving-average window. Lower error is better."
              split="validation"
              xKey="window"
              xLabel="Moving Average Window"
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
              title="Moving Average Window Breakdown"
              subtitle="Open each window to inspect train, validation, and test performance separately."
            />

            <MovingAverageWindowDetails rows={maMetricsTable} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Forecast Path Preview"
              title="Chart Data Preview"
              subtitle="This preview uses the same artifact rows that feed the visual charts."
            />

            <ForecastPreviewTable rows={chartRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Interpretation"
              title="How to Explain These Baseline Results"
              subtitle="This interpretation keeps the page conservative and does not claim a final winner before model comparison."
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why the naive model can look strong
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Gold prices are persistent, so yesterday's price can be a
                  strong short-horizon benchmark. This does not mean the naive
                  model explains gold; it only sets a benchmark.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why moving averages can lag
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Moving averages smooth noise but respond slowly when gold
                  prices move sharply. Longer windows are smoother; shorter
                  windows react faster.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why residuals matter
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Residual spikes identify periods where the baseline missed
                  market moves. Later models should be compared against these
                  weaknesses.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Conclusion
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  These methods establish fair baselines. They should not be
                  called final winners until Notebook 11 compares all models
                  using the same validation and test logic.
                </p>
              </div>
            </div>
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Limitations"
              title="Baseline Model Limitations"
              subtitle="Limitations are read from the page/model artifacts where available."
            />

            <LimitationsBlock
              pageData={pageData}
              naiveResults={naiveResults}
              movingAverageResults={movingAverageResults}
            />
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
              <SourcePreview title="page_naive_moving_average.json" data={pageData} />
              <SourcePreview title="naive_results.json" data={naiveResults} />
              <SourcePreview title="moving_average_results.json" data={movingAverageResults} />
              <SourcePreview title="baseline_forecast_paths.json" data={baselineForecastPaths} />
              <SourcePreview title="model_window_plan.json" data={modelWindowPlan} />
            </div>
          </CardShell>
        </div>
      </section>
    </main>
  );
}
