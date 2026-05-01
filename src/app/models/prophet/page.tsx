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
  candidate_id?: string;
  model_type?: string;
  split: string;
  forecast_mode?: string;
  growth?: string;
  seasonality_mode?: string;
  n?: number;
  MAE?: number;
  MSE?: number;
  RMSE?: number;
  MAPE?: number;
  SMAPE?: number;
  mean_error_bias?: number;
  directional_accuracy_pct?: number;
  [key: string]: any;
};

type ComponentRow = {
  date: string;
  trend?: number | null;
  yearly?: number | null;
  weekly?: number | null;
  monthly?: number | null;
  additive_terms?: number | null;
  multiplicative_terms?: number | null;
  yhat?: number | null;
  [key: string]: any;
};

const PAGE_ARTIFACTS: ArtifactRequest[] = [
  {
    key: "pageProphet",
    label: "Page Prophet Optional",
    path: "artifacts/pages/page_prophet.json",
  },
  {
    key: "prophetResults",
    label: "Prophet Results",
    path: "artifacts/models/prophet_results.json",
  },
  {
    key: "prophetForecastPath",
    label: "Prophet Forecast Path",
    path: "artifacts/models/prophet_forecast_path.json",
  },
  {
    key: "prophetComponents",
    label: "Prophet Components",
    path: "artifacts/interpretability/prophet_components.json",
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

function getDataset(prophetResults: any, pageData: any) {
  return (
    prophetResults?.dataset ||
    pageData?.dataset_window ||
    pageData?.dataset ||
    findValueDeep(prophetResults, ["dataset"]) ||
    findValueDeep(pageData, ["dataset_window", "dataset"]) ||
    {}
  );
}

function getSplits(prophetResults: any, pageData: any) {
  const dataset = getDataset(prophetResults, pageData);

  return {
    train:
      dataset?.train ||
      prophetResults?.splits?.train ||
      pageData?.split_summary?.train ||
      {},
    validation:
      dataset?.validation ||
      prophetResults?.splits?.validation ||
      pageData?.split_summary?.validation ||
      {},
    test:
      dataset?.test ||
      prophetResults?.splits?.test ||
      pageData?.split_summary?.test ||
      {},
  };
}

function normalizeMetricRow(row: any, split = "validation"): MetricRow {
  const metrics = row?.metrics || row;

  return {
    model_name:
      row?.model_name ||
      row?.candidate_name ||
      row?.candidate_id ||
      row?.model ||
      "Prophet Candidate",
    candidate_id: row?.candidate_id || row?.id,
    model_type: row?.model_type || row?.type || "prophet",
    split: row?.split || row?.evaluation_period || row?.phase || split,
    forecast_mode: row?.forecast_mode || row?.mode,
    growth: row?.growth,
    seasonality_mode: row?.seasonality_mode,
    n: toNumber(metrics?.n ?? row?.n ?? row?.rows) ?? undefined,
    MAE: toNumber(metrics?.mae ?? metrics?.MAE ?? row?.mae ?? row?.MAE) ?? undefined,
    MSE: toNumber(metrics?.mse ?? metrics?.MSE ?? row?.mse ?? row?.MSE) ?? undefined,
    RMSE: toNumber(metrics?.rmse ?? metrics?.RMSE ?? row?.rmse ?? row?.RMSE) ?? undefined,
    MAPE: toNumber(metrics?.mape ?? metrics?.MAPE ?? row?.mape ?? row?.MAPE) ?? undefined,
    SMAPE: toNumber(metrics?.smape ?? metrics?.SMAPE ?? row?.smape ?? row?.SMAPE) ?? undefined,
    mean_error_bias:
      toNumber(
        metrics?.mean_error_bias ??
          metrics?.bias ??
          row?.mean_error_bias ??
          row?.bias
      ) ?? undefined,
    directional_accuracy_pct:
      toNumber(
        metrics?.directional_accuracy_pct ??
          metrics?.directionalAccuracyPct ??
          row?.directional_accuracy_pct ??
          row?.directional_accuracy
      ) ?? undefined,
    ...row,
  };
}

function normalizeMetricRows(prophetResults: any, pageData: any): MetricRow[] {
  const rows: MetricRow[] = [];

  const selected =
    prophetResults?.selected_model ||
    prophetResults?.best_model ||
    pageData?.selected_model ||
    {};

  if (selected?.validation_metrics) {
    rows.push(
      normalizeMetricRow(
        {
          ...selected,
          metrics: selected.validation_metrics,
          split: "validation",
        },
        "validation"
      )
    );
  }

  if (selected?.test_metrics) {
    rows.push(
      normalizeMetricRow(
        {
          ...selected,
          metrics: selected.test_metrics,
          split: "test",
        },
        "test"
      )
    );
  }

  if (selected?.test_metrics_rolling) {
    rows.push(
      normalizeMetricRow(
        {
          ...selected,
          metrics: selected.test_metrics_rolling,
          split: "test",
          forecast_mode: selected?.forecast_mode || "rolling",
        },
        "test"
      )
    );
  }

  if (selected?.static_test_metrics || selected?.test_metrics_static_diagnostic) {
    rows.push(
      normalizeMetricRow(
        {
          ...selected,
          metrics: selected.static_test_metrics || selected.test_metrics_static_diagnostic,
          split: "test",
          forecast_mode: "static_multi_step_diagnostic",
          model_name: `${selected?.model_name || selected?.candidate_id || "Selected Prophet"} Static Diagnostic`,
        },
        "test"
      )
    );
  }

  const candidateRows =
    prophetResults?.validation_leaderboard ||
    prophetResults?.candidate_leaderboard ||
    prophetResults?.leaderboard ||
    prophetResults?.rolling_validation_leaderboard ||
    pageData?.tables?.candidate_leaderboard ||
    findArrayDeep(prophetResults, [
      "validation_leaderboard",
      "candidate_leaderboard",
      "rolling_validation_leaderboard",
      "leaderboard",
      "candidate_metrics",
      "metrics_table",
      "records",
      "rows",
      "data",
    ]) ||
    [];

  candidateRows.forEach((row: any) => {
    rows.push(normalizeMetricRow(row, row?.split || "validation"));
  });

  const genericMetricRows =
    prophetResults?.metrics_table ||
    prophetResults?.metricsTable ||
    [];

  if (Array.isArray(genericMetricRows)) {
    genericMetricRows.forEach((row: any) => {
      rows.push(normalizeMetricRow(row, row?.split || "validation"));
    });
  }

  const unique = new Map<string, MetricRow>();

  rows.forEach((row) => {
    const key = `${row.candidate_id}|${row.model_name}|${row.forecast_mode}|${row.split}|${row.RMSE}|${row.MAE}`;
    unique.set(key, row);
  });

  return Array.from(unique.values());
}

function normalizeValidationRows(metricRows: MetricRow[]) {
  return metricRows
    .filter((row) => String(row.split).toLowerCase() === "validation")
    .map((row) => ({
      ...row,
      model_name: `${row.model_name}${row.forecast_mode ? ` — ${row.forecast_mode}` : ""}`,
    }));
}

function buildForecastRows(
  prophetForecastPath: any,
  prophetResults: any,
  forecastKey: "forecast" | "yhat" | "static_forecast" = "forecast"
): ForecastChartRow[] {
  const records =
    prophetForecastPath?.records ||
    prophetForecastPath?.data ||
    prophetForecastPath?.rows ||
    prophetForecastPath?.forecast_path ||
    prophetResults?.forecast_path ||
    findArrayDeep(prophetForecastPath, [
      "records",
      "forecast_path",
      "forecastPath",
      "predictions",
      "data",
      "rows",
    ]) ||
    findArrayDeep(prophetResults, [
      "records",
      "forecast_path",
      "forecastPath",
      "predictions",
      "data",
      "rows",
    ]) ||
    [];

  return records
    .map((row: any) => {
      const actual =
        row.actual ??
        row.gold_price ??
        row.y ??
        row.actual_gold_price ??
        row.actual_price;

      const forecast =
        row[forecastKey] ??
        row.forecast ??
        row.prediction ??
        row.predicted ??
        row.yhat ??
        row.prophet_forecast;

      const lower =
        row.lower ??
        row.yhat_lower ??
        row.forecast_lower ??
        row.lower_bound;

      const upper =
        row.upper ??
        row.yhat_upper ??
        row.forecast_upper ??
        row.upper_bound;

      const residual =
        row.residual ??
        (actual !== undefined && forecast !== undefined
          ? Number(actual) - Number(forecast)
          : null);

      return {
        date: formatText(row.date || row.ds || row.timestamp),
        split: row.split || row.evaluation_period || row.phase || "test",
        actual: toNumber(actual),
        forecast: toNumber(forecast),
        lower: toNumber(lower),
        upper: toNumber(upper),
        residual: toNumber(residual),
        absolute_error: toNumber(row.absolute_error ?? row.abs_error),
        yhat: toNumber(row.yhat),
        yhat_lower: toNumber(row.yhat_lower),
        yhat_upper: toNumber(row.yhat_upper),
      };
    })
    .filter((row: any) => row.date !== "—" && row.actual !== null);
}

function normalizeComponentRows(prophetComponents: any, prophetForecastPath: any): ComponentRow[] {
  const records =
    prophetComponents?.records ||
    prophetComponents?.components ||
    prophetComponents?.data ||
    prophetComponents?.rows ||
    findArrayDeep(prophetComponents, [
      "records",
      "components",
      "component_table",
      "rows",
      "data",
    ]) ||
    [];

  const fallbackRecords =
    records.length > 0
      ? records
      : findArrayDeep(prophetForecastPath, [
          "records",
          "forecast_path",
          "forecastPath",
          "data",
          "rows",
        ]);

  return fallbackRecords
    .map((row: any) => ({
      date: formatText(row.date || row.ds || row.timestamp),
      trend: toNumber(row.trend),
      yearly: toNumber(row.yearly),
      weekly: toNumber(row.weekly),
      monthly: toNumber(row.monthly),
      additive_terms: toNumber(row.additive_terms),
      multiplicative_terms: toNumber(row.multiplicative_terms),
      yhat: toNumber(row.yhat || row.forecast),
      ...row,
    }))
    .filter((row: ComponentRow) => row.date !== "—");
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

function ProphetAnimation() {
  return (
    <div className="relative min-h-[310px] overflow-hidden rounded-[2rem] border border-yellow-400/20 bg-[#050b16] p-6">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute left-8 top-12 h-2 w-2 animate-ping rounded-full bg-yellow-300" />
        <div className="absolute right-16 top-24 h-2 w-2 animate-pulse rounded-full bg-blue-300" />
        <div className="absolute bottom-16 left-1/2 h-2 w-2 animate-ping rounded-full bg-emerald-300" />
      </div>

      <div className="relative z-10">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-yellow-300">
          Notebook 10 Flow
        </p>

        <h3 className="mt-3 text-3xl font-black text-white">
          Prophet Optional Forecast
        </h3>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          Prophet is optional in the project. It adds decomposable trend and
          seasonality views, but final selection still belongs to Notebook 11.
        </p>

        <div className="mt-7 grid gap-3">
          {[
            ["01", "Prepare ds / y Prophet format"],
            ["02", "Fit candidate Prophet settings"],
            ["03", "Evaluate validation and test windows"],
            ["04", "Export forecast path and components"],
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

function MethodExplanationCards() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-[2rem] border border-yellow-200 bg-yellow-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-700">
          Method Logic
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Decomposable Forecasting
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          Prophet models a time series as trend plus seasonal components and
          optional holiday/event effects. For this project, it is an optional
          candidate rather than the core professor baseline.
        </p>

        <div className="mt-5 rounded-3xl border border-yellow-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Prophet Structure
          </p>
          <p className="mt-3 text-2xl font-black text-slate-950">
            y(t) = trend + seasonality + error
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
          Input Format
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          ds and y Columns
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          Prophet expects a date column named ds and a target column named y.
          The notebook converts gold price into that format before fitting.
        </p>

        <div className="mt-5 rounded-3xl border border-blue-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Project Target
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            y = gold_price, while ds = date.
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
          Status
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Optional Model
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          Prophet can be useful for trend and seasonality explanation, but it
          should not be oversold. Final ranking must come from Notebook 11.
        </p>

        <div className="mt-5 rounded-3xl border border-emerald-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Professor-Safe Point
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Treat Prophet as an optional comparison candidate, not as the main
            official model by default.
          </p>
        </div>
      </div>
    </div>
  );
}

function NotebookWorkflow() {
  const steps = [
    {
      title: "Load Long Gold Series",
      detail:
        "Notebook 10 uses the locked gold price time series and the same forecast cutoff discipline as the rest of the project.",
    },
    {
      title: "Convert to Prophet Format",
      detail:
        "The notebook renames the date field to ds and the target gold price to y.",
    },
    {
      title: "Fit Prophet Candidates",
      detail:
        "Candidate settings may test growth, changepoint prior scale, seasonality prior scale, and seasonality mode.",
    },
    {
      title: "Evaluate Chronologically",
      detail:
        "Validation and test windows remain time-based; random splitting is not used.",
    },
    {
      title: "Export Forecast Path",
      detail:
        "Forecast rows include actual, yhat/forecast, and confidence bounds when exported.",
    },
    {
      title: "Export Components",
      detail:
        "Prophet components such as trend and seasonal terms are exported for explanation where available.",
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
            <th className="px-4 py-3">Candidate</th>
            <th className="px-4 py-3">Mode</th>
            <th className="px-4 py-3">Split</th>
            <th className="px-4 py-3">Growth</th>
            <th className="px-4 py-3">Seasonality</th>
            <th className="px-4 py-3">n</th>
            <th className="px-4 py-3">MAE</th>
            <th className="px-4 py-3">MSE</th>
            <th className="px-4 py-3">RMSE</th>
            <th className="px-4 py-3">MAPE</th>
            <th className="px-4 py-3">SMAPE</th>
            <th className="px-4 py-3">Bias</th>
            <th className="px-4 py-3">Direction %</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-200">
              <td className="px-4 py-4 font-black text-slate-950">
                {formatText(row.candidate_id || row.model_name)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.forecast_mode)}
              </td>
              <td className="px-4 py-4 font-bold capitalize text-slate-700">
                {formatText(row.split)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.growth)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.seasonality_mode)}
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
                {formatNumber(row.SMAPE, 4)}
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

function CandidateDetails({ rows }: { rows: MetricRow[] }) {
  const candidates = Array.from(
    new Set(rows.map((row) => `${row.candidate_id || row.model_name} — ${row.split}`))
  ).filter(Boolean);

  return (
    <div className="space-y-4">
      {candidates.map((candidate) => {
        const candidateRows = rows.filter(
          (row) => `${row.candidate_id || row.model_name} — ${row.split}` === candidate
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
                  Exported Prophet metrics for this candidate and split.
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
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Growth</th>
                    <th className="px-4 py-3">Seasonality</th>
                    <th className="px-4 py-3">MAE</th>
                    <th className="px-4 py-3">RMSE</th>
                    <th className="px-4 py-3">MAPE</th>
                  </tr>
                </thead>

                <tbody>
                  {candidateRows.map((row, index) => (
                    <tr key={index} className="border-t border-slate-200">
                      <td className="px-4 py-4 text-slate-700">
                        {formatText(row.forecast_mode)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatText(row.growth)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatText(row.seasonality_mode)}
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

function ComponentSummaryCards({ rows }: { rows: ComponentRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No Prophet component rows were exported in the current artifacts.
      </div>
    );
  }

  const latest = rows[rows.length - 1];

  const cards = [
    ["Latest Trend", latest?.trend],
    ["Latest Yearly", latest?.yearly],
    ["Latest Weekly", latest?.weekly],
    ["Latest Additive Terms", latest?.additive_terms],
    ["Latest Multiplicative Terms", latest?.multiplicative_terms],
    ["Latest yhat", latest?.yhat],
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">
            {label}
          </p>
          <p className="mt-3 text-2xl font-black text-slate-950">
            {formatNumber(value, 4)}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Date: {formatText(latest?.date)}
          </p>
        </div>
      ))}
    </div>
  );
}

function ComponentsTable({ rows }: { rows: ComponentRow[] }) {
  const previewRows = rows.slice(-20);

  if (previewRows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No component table rows were exported.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-3xl border border-slate-200">
      <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Trend</th>
            <th className="px-4 py-3">Yearly</th>
            <th className="px-4 py-3">Weekly</th>
            <th className="px-4 py-3">Monthly</th>
            <th className="px-4 py-3">Additive</th>
            <th className="px-4 py-3">Multiplicative</th>
            <th className="px-4 py-3">yhat</th>
          </tr>
        </thead>

        <tbody>
          {previewRows.map((row, index) => (
            <tr key={`${row.date}-${index}`} className="border-t border-slate-200">
              <td className="px-4 py-4 font-bold text-slate-950">
                {formatText(row.date)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.trend, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.yearly, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.weekly, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.monthly, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.additive_terms, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.multiplicative_terms, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.yhat, 4)}
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
            <th className="px-4 py-3">Actual</th>
            <th className="px-4 py-3">Forecast</th>
            <th className="px-4 py-3">Lower</th>
            <th className="px-4 py-3">Upper</th>
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
                {formatNumber(row.lower, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.upper, 4)}
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

function NotesBlock({ prophetResults, pageData }: any) {
  const notes = [
    ...findArrayDeep(prophetResults, ["interpretation_notes", "methodology_notes"]),
    ...findArrayDeep(pageData, ["limitations", "professor_safe_summary", "summary_points"]),
  ]
    .map((item) => formatText(item))
    .filter((item) => item !== "—" && !item.startsWith("{"));

  const uniqueNotes = Array.from(new Set(notes));

  if (uniqueNotes.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
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

export default async function ProphetPage() {
  const results = await loadArtifacts();

  const pageData = getArtifact(results, "pageProphet");
  const prophetResults = getArtifact(results, "prophetResults");
  const prophetForecastPath = getArtifact(results, "prophetForecastPath");
  const prophetComponents = getArtifact(results, "prophetComponents");
  const forecastStatus = getArtifact(results, "forecastStatus");
  const modelWindowPlan = getArtifact(results, "modelWindowPlan");

  const loadedCount = results.filter((item) => item.ok).length;

  const dataset = getDataset(prophetResults, pageData);
  const splits = getSplits(prophetResults, pageData);

  const selectedModel =
    prophetResults?.selected_model ||
    prophetResults?.best_model ||
    pageData?.selected_model ||
    {};

  const selectedCandidateId =
    selectedModel?.candidate_id ||
    selectedModel?.model_name ||
    selectedModel?.model ||
    "Selected Prophet Candidate";

  const selectedGrowth = selectedModel?.growth || selectedModel?.parameters?.growth;
  const selectedSeasonality =
    selectedModel?.seasonality_mode || selectedModel?.parameters?.seasonality_mode;

  const validationMetrics =
    selectedModel?.validation_metrics ||
    prophetResults?.validation_metrics ||
    {};

  const testMetrics =
    selectedModel?.test_metrics ||
    selectedModel?.test_metrics_rolling ||
    prophetResults?.test_metrics ||
    {};

  const metricRows = normalizeMetricRows(prophetResults, pageData);
  const validationRows = normalizeValidationRows(metricRows);
  const chartRows = buildForecastRows(prophetForecastPath, prophetResults);
  const recentRows = chartRows.slice(-90);
  const componentRows = normalizeComponentRows(prophetComponents, prophetForecastPath);

  const officialCutoff =
    dataset?.end ||
    findValueDeep(forecastStatus, [
      "official_forecast_cutoff_date",
      "officialForecastCutoffDate",
      "cutoff_date",
      "cutoffDate",
      "official_cutoff",
      "officialCutoff",
    ]) ||
    "2026-03-31";

  const pageTitle = pageData?.page_title || "Prophet Optional Forecast";

  const pageSubtitle =
    pageData?.page_subtitle ||
    "Optional decomposable trend and seasonality forecasting candidate for gold price.";

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
                Optional Candidate
              </span>

              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-100">
                Trend + Seasonality
              </span>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-4">
              <DarkKpiCard label="Dataset Start" value={dataset?.start} />
              <DarkKpiCard label="Dataset End" value={dataset?.end} />
              <DarkKpiCard label="Target" value={dataset?.target || "gold_price"} />
              <DarkKpiCard label="Official Cutoff" value={officialCutoff} />
            </div>

          
          </div>

          <ProphetAnimation />
        </div>
      </section>

      <section className="px-6 py-12 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl space-y-10">
          <CardShell>
            <SectionTitle
              eyebrow="Method Foundation"
              title="What Prophet Forecasting Does"
              subtitle="Notebook 10 is optional and adds a decomposable trend/seasonality model to the comparison pool."
            />

            <MethodExplanationCards />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Notebook Workflow"
              title="Colab Logic Converted to Website Sections"
              subtitle="This page follows the same professor-style order: method explanation, splits, selected candidate, charts, metrics, components, and artifact status."
            />

            <NotebookWorkflow />
          </CardShell>

          <div className="grid gap-10 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-yellow-200 bg-yellow-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-700">
                Selected Prophet Candidate
              </p>
              <h3 className="mt-3 text-3xl font-black text-slate-950">
                {formatText(selectedCandidateId)}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                Prophet is optional in this project. This selected candidate
                should only be compared officially inside Notebook 11.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Growth
                  </p>
                  <p className="mt-1 break-words text-lg font-black text-slate-950">
                    {formatText(selectedGrowth)}
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
                Candidate Configuration
              </p>
              <h3 className="mt-3 text-3xl font-black text-slate-950">
                {formatText(selectedSeasonality)} Seasonality
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                Hyperparameters and Prophet settings are read from the selected
                model object when exported.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {Object.entries(selectedModel?.parameters || selectedModel?.hyperparameters || {}).length > 0 ? (
                  Object.entries(selectedModel?.parameters || selectedModel?.hyperparameters || {}).map(
                    ([key, value]) => (
                      <div key={key} className="rounded-2xl bg-white p-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                          {key}
                        </p>
                        <p className="mt-1 break-words text-lg font-black text-slate-950">
                          {formatText(value)}
                        </p>
                      </div>
                    )
                  )
                ) : (
                  <div className="rounded-2xl bg-white p-4 text-sm leading-7 text-slate-600 md:col-span-2">
                    No hyperparameter object was exported for the selected
                    Prophet candidate.
                  </div>
                )}
              </div>
            </div>
          </div>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 01"
              title="Actual vs Prophet Forecast"
              subtitle="This chart is generated from prophet_forecast_path.json."
            />

            <ActualVsForecastChart
              title="Actual Gold Price vs Prophet Forecast"
              rows={chartRows}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="forecast"
              forecastLabel="Prophet Forecast"
              yAxisLabel="Gold Price (USD/oz)"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 02"
              title="Prophet Forecast Residuals"
              subtitle="Residual = actual gold price minus Prophet forecast."
            />

            <ResidualChart
              title="Prophet Forecast Residuals"
              rows={chartRows}
              actualKey="actual"
              forecastKey="forecast"
              forecastLabel="Prophet Forecast"
              yAxisLabel="Actual - Forecast"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 03"
              title="Recent Test Zoom"
              subtitle="This zoomed view shows the most recent 90 forecast-path rows."
            />

            <ActualVsForecastChart
              title="Recent Test Window: Actual vs Prophet"
              rows={recentRows}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="forecast"
              forecastLabel="Prophet Forecast"
              yAxisLabel="Gold Price (USD/oz)"
              showSplitMarkers={false}
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Output Table"
              title="Prophet Forecast Metrics and Candidate Leaderboard"
              subtitle="This table is built from selected metrics and candidate leaderboard rows when exported."
            />

            <MetricsTable rows={metricRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 04"
              title="Validation Error Comparison"
              subtitle="This compares validation MAE and RMSE across Prophet candidates when exported."
            />

            <MetricComparisonChart
              rows={validationRows}
              title="Prophet Candidate Validation Error Comparison"
              subtitle="Validation MAE and RMSE by candidate. Lower error is better."
              split="validation"
              xKey="model_name"
              xLabel="Prophet Candidate"
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
              subtitle="Open each candidate to inspect exported metric rows."
            />

            <CandidateDetails rows={metricRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Prophet Components"
              title="Trend and Seasonality Component Summary"
              subtitle="These values are read from prophet_components.json or from component fields inside the forecast-path artifact."
            />

            <ComponentSummaryCards rows={componentRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Component Table"
              title="Recent Prophet Components"
              subtitle="The table shows the most recent exported component rows."
            />

            <ComponentsTable rows={componentRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Forecast Path Preview"
              title="Chart Data Preview"
              subtitle="This preview uses the same Prophet forecast-path rows that feed the visual charts."
            />

            <ForecastPreviewTable rows={chartRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Professor Interpretation"
              title="How to Explain These Results"
              subtitle="This page keeps Prophet interpretation conservative because it is optional."
            />

            <NotesBlock prophetResults={prophetResults} pageData={pageData} />

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why Prophet is useful
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Prophet provides an interpretable trend and seasonality
                  decomposition, which can help explain forecast structure in a
                  visually clear way.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why it is optional
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Prophet is not one of the core classical professor methods in
                  this project sequence, so it should be presented as an
                  optional comparison candidate.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why components need caution
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Trend and seasonal components are model decomposition outputs,
                  not causal explanations of gold price movement.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Professor-safe conclusion
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Prophet can be included as an optional forecasting candidate,
                  but final ranking still belongs to Notebook 11 after all
                  models are compared under the same validation/test framework.
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
              <SourcePreview title="page_prophet.json" data={pageData} />
              <SourcePreview title="prophet_results.json" data={prophetResults} />
              <SourcePreview title="prophet_forecast_path.json" data={prophetForecastPath} />
              <SourcePreview title="prophet_components.json" data={prophetComponents} />
              <SourcePreview title="model_window_plan.json" data={modelWindowPlan} />
            </div>
          </CardShell>
        </div>
      </section>
    </main>
  );
}