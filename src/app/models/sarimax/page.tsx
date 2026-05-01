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
  feature_set?: string;
  forecast_mode?: string;
  split: string;
  order?: string;
  n?: number;
  MAE?: number;
  MSE?: number;
  RMSE?: number;
  MAPE?: number;
  AIC?: number;
  BIC?: number;
  append_failures?: number;
  fit_error?: string | null;
  [key: string]: any;
};

type CoefficientRow = {
  term: string;
  coefficient?: number;
  std_error?: number;
  z_value?: number;
  p_value?: number;
  conf_low_95?: number;
  conf_high_95?: number;
  significant_at_0_05?: boolean;
  [key: string]: any;
};

const PAGE_ARTIFACTS: ArtifactRequest[] = [
  {
    key: "pageSarimax",
    label: "Page SARIMAX",
    path: "artifacts/pages/page_sarimax.json",
  },
  {
    key: "sarimaxResults",
    label: "SARIMAX Results",
    path: "artifacts/models/sarimax_results.json",
  },
  {
    key: "sarimaxDiagnostics",
    label: "SARIMAX Diagnostics",
    path: "artifacts/models/sarimax_diagnostics.json",
  },
  {
    key: "sarimaxForecastPath",
    label: "SARIMAX Forecast Path",
    path: "artifacts/models/sarimax_forecast_path.json",
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

function orderToText(order: any) {
  if (!order) return "—";
  if (Array.isArray(order)) return `SARIMAX(${order.join(", ")})`;
  return String(order).startsWith("(") ? `SARIMAX${order}` : String(order);
}

function getDataset(sarimaxResults: any, pageData: any) {
  return (
    sarimaxResults?.dataset ||
    pageData?.dataset_window ||
    pageData?.dataset ||
    findValueDeep(sarimaxResults, ["dataset"]) ||
    findValueDeep(pageData, ["dataset_window", "dataset"]) ||
    {}
  );
}

function getSplits(sarimaxResults: any, pageData: any) {
  const dataset = getDataset(sarimaxResults, pageData);

  return {
    train:
      dataset?.train ||
      sarimaxResults?.splits?.train ||
      pageData?.split_summary?.train ||
      {},
    validation:
      dataset?.validation ||
      sarimaxResults?.splits?.validation ||
      pageData?.split_summary?.validation ||
      {},
    test:
      dataset?.test ||
      sarimaxResults?.splits?.test ||
      pageData?.split_summary?.test ||
      {},
  };
}

function normalizeMetricRow(row: any, split = "validation"): MetricRow {
  return {
    model_name: row?.model_name || row?.model || "SARIMAX",
    candidate_id: row?.candidate_id,
    feature_set: row?.feature_set,
    forecast_mode: row?.forecast_mode,
    split: row?.split || row?.evaluation_period || split,
    order: orderToText(row?.order_tuple || row?.order),
    n: toNumber(row?.n) ?? undefined,
    MAE: toNumber(row?.mae ?? row?.MAE) ?? undefined,
    MSE: toNumber(row?.mse ?? row?.MSE) ?? undefined,
    RMSE: toNumber(row?.rmse ?? row?.RMSE) ?? undefined,
    MAPE: toNumber(row?.mape ?? row?.MAPE) ?? undefined,
    AIC: toNumber(row?.aic ?? row?.AIC) ?? undefined,
    BIC: toNumber(row?.bic ?? row?.BIC) ?? undefined,
    append_failures: toNumber(row?.append_failures) ?? undefined,
    fit_error: row?.fit_error ?? null,
    ...row,
  };
}

function normalizeMetricRows(sarimaxResults: any, sarimaxDiagnostics: any): MetricRow[] {
  const rows: MetricRow[] = [];

  const selected = sarimaxResults?.selected_model || {};

  if (selected?.validation_metrics) {
    rows.push(
      normalizeMetricRow(
        {
          ...selected.validation_metrics,
          candidate_id: selected?.candidate_id,
          model_name: "SARIMAX",
          feature_set: selected?.feature_set,
          order: selected?.order,
          forecast_mode: "one_step_rolling_validation",
        },
        "validation"
      )
    );
  }

  if (selected?.test_metrics_rolling) {
    rows.push(
      normalizeMetricRow(
        {
          ...selected.test_metrics_rolling,
          candidate_id: selected?.candidate_id,
          model_name: "SARIMAX",
          feature_set: selected?.feature_set,
          order: selected?.order,
          forecast_mode: "one_step_rolling_test",
          append_failures: selected?.append_failures_test,
        },
        "test"
      )
    );
  }

  if (selected?.test_metrics_static_diagnostic) {
    rows.push(
      normalizeMetricRow(
        {
          ...selected.test_metrics_static_diagnostic,
          candidate_id: selected?.candidate_id,
          model_name: "SARIMAX Static Diagnostic",
          feature_set: selected?.feature_set,
          order: selected?.order,
          forecast_mode: "static_multi_step_test_diagnostic",
        },
        "test"
      )
    );
  }

  const rollingRows =
    sarimaxResults?.rolling_validation_leaderboard ||
    sarimaxDiagnostics?.rolling_validation_leaderboard ||
    findArrayDeep(sarimaxResults, ["rolling_validation_leaderboard"]) ||
    [];

  rollingRows.forEach((row: any) => {
    rows.push(normalizeMetricRow(row, "validation"));
  });

  const staticRows =
    sarimaxResults?.static_validation_leaderboard ||
    sarimaxDiagnostics?.static_validation_leaderboard ||
    findArrayDeep(sarimaxResults, ["static_validation_leaderboard"]) ||
    [];

  staticRows.forEach((row: any) => {
    rows.push(normalizeMetricRow(row, "validation"));
  });

  const unique = new Map<string, MetricRow>();

  rows.forEach((row) => {
    const key = `${row.candidate_id}|${row.model_name}|${row.feature_set}|${row.forecast_mode}|${row.split}|${row.RMSE}|${row.MAE}`;
    unique.set(key, row);
  });

  return Array.from(unique.values());
}

function normalizeValidationLeaderboardRows(metricRows: MetricRow[]) {
  return metricRows
    .filter((row) => String(row.split).toLowerCase() === "validation")
    .map((row) => ({
      ...row,
      model_name: `${row.feature_set || row.model_name} — ${row.order} — ${
        row.forecast_mode || "mode"
      }`,
    }));
}

function buildForecastRows(
  sarimaxForecastPath: any,
  forecastKey: "rolling_forecast" | "static_forecast"
): ForecastChartRow[] {
  const records =
    sarimaxForecastPath?.records ||
    sarimaxForecastPath?.data ||
    sarimaxForecastPath?.rows ||
    findArrayDeep(sarimaxForecastPath, ["records", "data", "rows"]) ||
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
        row.yhat;

      const residual =
        forecastKey === "rolling_forecast"
          ? row.residual ??
            (actual !== undefined && forecast !== undefined
              ? Number(actual) - Number(forecast)
              : null)
          : actual !== undefined && forecast !== undefined
            ? Number(actual) - Number(forecast)
            : null;

      return {
        date: formatText(row.date || row.ds || row.timestamp),
        split: row.split || row.evaluation_period || "test",
        actual: toNumber(actual),
        forecast: toNumber(forecast),
        residual: toNumber(residual),
        rollingForecast: toNumber(row.rolling_forecast),
        staticForecast: toNumber(row.static_forecast),
        selected_candidate_id: row.selected_candidate_id,
      };
    })
    .filter((row: any) => row.date !== "—" && row.actual !== null);
}

function normalizeCoefficientRows(sarimaxResults: any, sarimaxDiagnostics: any): CoefficientRow[] {
  const rows =
    sarimaxResults?.coefficient_table ||
    sarimaxDiagnostics?.coefficient_table ||
    findArrayDeep(sarimaxResults, ["coefficient_table", "coefficients", "records", "rows"]) ||
    [];

  return rows.map((row: any) => ({
    term: formatText(row.term ?? row.variable ?? row.param ?? row.name),
    coefficient: toNumber(row.coefficient ?? row.coef) ?? undefined,
    std_error: toNumber(row.std_error ?? row.stderr ?? row.standard_error) ?? undefined,
    z_value: toNumber(row.z_value ?? row.z ?? row.z_stat) ?? undefined,
    p_value: toNumber(row.p_value ?? row.pvalue) ?? undefined,
    conf_low_95: toNumber(row.conf_low_95 ?? row.conf_low ?? row.lower_95) ?? undefined,
    conf_high_95: toNumber(row.conf_high_95 ?? row.conf_high ?? row.upper_95) ?? undefined,
    significant_at_0_05:
      row.significant_at_0_05 ??
      row.significant ??
      (toNumber(row.p_value ?? row.pvalue) !== null
        ? Number(row.p_value ?? row.pvalue) < 0.05
        : undefined),
    ...row,
  }));
}

function normalizeLjungBoxRows(sarimaxResults: any, sarimaxDiagnostics: any) {
  const rows =
    sarimaxResults?.ljung_box ||
    sarimaxDiagnostics?.ljung_box ||
    findArrayDeep(sarimaxDiagnostics, ["ljung_box", "records", "rows", "data"]) ||
    [];

  return rows.map((row: any) => ({
    lag: row.lag ?? row.index ?? row.Lag,
    lb_stat: toNumber(row.lb_stat ?? row.statistic),
    lb_pvalue: toNumber(row.lb_pvalue ?? row.p_value ?? row.pvalue),
    ...row,
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

function SarimaxAnimation() {
  return (
    <div className="relative min-h-[310px] overflow-hidden rounded-[2rem] border border-yellow-400/20 bg-[#050b16] p-6">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute left-8 top-12 h-2 w-2 animate-ping rounded-full bg-yellow-300" />
        <div className="absolute right-16 top-24 h-2 w-2 animate-pulse rounded-full bg-blue-300" />
        <div className="absolute bottom-16 left-1/2 h-2 w-2 animate-ping rounded-full bg-emerald-300" />
      </div>

      <div className="relative z-10">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-yellow-300">
          Notebook 08 Flow
        </p>

        <h3 className="mt-3 text-3xl font-black text-white">
          SARIMAX with Lagged Drivers
        </h3>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          This notebook extends ARIMA with lagged exogenous variables. Static
          forecasts are diagnostic; rolling one-step evaluation is the default
          fair comparison mode.
        </p>

        <div className="mt-7 grid gap-3">
          {[
            ["01", "Load Dataset B"],
            ["02", "Lag exogenous factors"],
            ["03", "Compare SARIMAX candidates"],
            ["04", "Select by rolling validation RMSE"],
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
          SARIMAX = ARIMA + Exogenous Variables
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          SARIMAX extends ARIMA by adding external predictors. In this project,
          those predictors are lagged to reduce same-day information dependency.
        </p>

        <div className="mt-5 rounded-3xl border border-yellow-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Professor Formula
          </p>
          <p className="mt-3 text-2xl font-black text-slate-950">
            SARIMAX(p, d, q) + X<sub>t-1</sub>
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
          Exogenous Policy
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Lagged Factors Only
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          Notebook 08 uses lagged exogenous factors. This keeps the page
          professor-safe because the forecast does not depend on same-day factor
          information.
        </p>

        <div className="mt-5 rounded-3xl border border-blue-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Excluded Variable Rule
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            high_yield is excluded from the main SARIMAX model because its
            usable history starts too late.
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
          Evaluation Mode
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Rolling is Default
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          Static forecasts are kept as diagnostics because long multi-step
          forecasts can flatten or lag. The main comparison should use one-step
          rolling forecasts.
        </p>

        <div className="mt-5 rounded-3xl border border-emerald-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Selection Rule
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Final SARIMAX candidate is selected by rolling validation RMSE.
          </p>
        </div>
      </div>
    </div>
  );
}

function NotebookWorkflow() {
  const steps = [
    {
      title: "Load Dataset B",
      detail:
        "Notebook 08 uses the core multivariate dataset rather than the long univariate baseline dataset.",
    },
    {
      title: "Remove high_yield",
      detail:
        "high_yield is excluded from the main model because its history starts around 2023 and is too short for the main SARIMAX window.",
    },
    {
      title: "Lag Exogenous Factors",
      detail:
        "The exogenous factors are lagged by one row/day to reduce same-day information leakage risk.",
    },
    {
      title: "Fit Static Candidates",
      detail:
        "Static validation candidates are first tested across feature sets and SARIMAX orders.",
    },
    {
      title: "Roll Top Candidates",
      detail:
        "Top static candidates are evaluated with one-step rolling validation.",
    },
    {
      title: "Export JSON Artifacts",
      detail:
        "Results, diagnostics, forecast path, and page metadata are exported for a JSON-first frontend.",
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

function FeaturePolicyBlock({
  features,
  excluded,
  policy,
}: {
  features: string[];
  excluded: string[];
  policy: string;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6 lg:col-span-2">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
          Selected Exogenous Features
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Lagged Driver Set
        </h3>
        <p className="mt-3 text-sm leading-7 text-slate-700">{policy}</p>

        <div className="mt-5 flex flex-wrap gap-3">
          {features.length > 0 ? (
            features.map((item) => (
              <span
                key={item}
                className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-black text-blue-700"
              >
                {item}
              </span>
            ))
          ) : (
            <p className="text-sm leading-7 text-slate-600">
              No feature list was exported for the selected model.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-700">
          Excluded Variables
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Main Model Safety
        </h3>

        <div className="mt-5 flex flex-wrap gap-3">
          {excluded.length > 0 ? (
            excluded.map((item) => (
              <span
                key={item}
                className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-black text-amber-700"
              >
                {item}
              </span>
            ))
          ) : (
            <p className="text-sm leading-7 text-slate-600">
              No excluded-variable list was exported.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricsTable({ rows }: { rows: MetricRow[] }) {
  return (
    <div className="overflow-auto rounded-3xl border border-slate-200">
      <table className="w-full min-w-[1250px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Candidate</th>
            <th className="px-4 py-3">Feature Set</th>
            <th className="px-4 py-3">Mode</th>
            <th className="px-4 py-3">Split</th>
            <th className="px-4 py-3">Order</th>
            <th className="px-4 py-3">n</th>
            <th className="px-4 py-3">MAE</th>
            <th className="px-4 py-3">MSE</th>
            <th className="px-4 py-3">RMSE</th>
            <th className="px-4 py-3">MAPE</th>
            <th className="px-4 py-3">AIC</th>
            <th className="px-4 py-3">BIC</th>
            <th className="px-4 py-3">Append Failures</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-200">
              <td className="px-4 py-4 font-black text-slate-950">
                {formatText(row.candidate_id || row.model_name)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.feature_set)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.forecast_mode)}
              </td>
              <td className="px-4 py-4 font-bold capitalize text-slate-700">
                {formatText(row.split)}
              </td>
              <td className="px-4 py-4 text-slate-700">{formatText(row.order)}</td>
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
                {formatNumber(row.AIC, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.BIC, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.append_failures, 0)}
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
    new Set(
      rows.map(
        (row) =>
          `${row.candidate_id || row.model_name} — ${
            row.forecast_mode || "mode not exported"
          }`
      )
    )
  ).filter(Boolean);

  return (
    <div className="space-y-4">
      {candidates.map((candidate) => {
        const candidateRows = rows.filter(
          (row) =>
            `${row.candidate_id || row.model_name} — ${
              row.forecast_mode || "mode not exported"
            }` === candidate
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
                  Exported SARIMAX metrics for this candidate and forecast mode.
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
                    <th className="px-4 py-3">Feature Set</th>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">MAE</th>
                    <th className="px-4 py-3">RMSE</th>
                    <th className="px-4 py-3">MAPE</th>
                    <th className="px-4 py-3">Fit Error</th>
                  </tr>
                </thead>

                <tbody>
                  {candidateRows.map((row, index) => (
                    <tr key={index} className="border-t border-slate-200">
                      <td className="px-4 py-4 font-bold capitalize text-slate-950">
                        {formatText(row.split)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatText(row.feature_set)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatText(row.order)}
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
                        {formatText(row.fit_error)}
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

function CoefficientTable({ rows }: { rows: CoefficientRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No coefficient table was exported in the current SARIMAX artifacts.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-3xl border border-slate-200">
      <table className="w-full min-w-[1150px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Term</th>
            <th className="px-4 py-3">Coefficient</th>
            <th className="px-4 py-3">Std Error</th>
            <th className="px-4 py-3">z-value</th>
            <th className="px-4 py-3">p-value</th>
            <th className="px-4 py-3">95% Low</th>
            <th className="px-4 py-3">95% High</th>
            <th className="px-4 py-3">Significant?</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-200">
              <td className="px-4 py-4 font-black text-slate-950">
                {formatText(row.term)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.coefficient, 6)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.std_error, 6)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.z_value, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.p_value, 6)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.conf_low_95, 6)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.conf_high_95, 6)}
              </td>
              <td className="px-4 py-4">
                <span
                  className={
                    row.significant_at_0_05
                      ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700"
                      : "rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600"
                  }
                >
                  {row.significant_at_0_05 ? "Yes" : "No"}
                </span>
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
        No Ljung-Box table was exported in the current SARIMAX diagnostics
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
            <th className="px-4 py-3">Forecast</th>
            <th className="px-4 py-3">Residual</th>
            <th className="px-4 py-3">Rolling Forecast</th>
            <th className="px-4 py-3">Static Forecast</th>
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
                {formatNumber(row.forecast, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.residual, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.rollingForecast, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.staticForecast, 4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotesBlock({ sarimaxResults, pageData }: any) {
  const notes = [
    ...findArrayDeep(sarimaxResults, ["interpretation_notes"]),
    ...findArrayDeep(pageData, ["limitations"]),
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

export default async function SarimaxPage() {
  const results = await loadArtifacts();

  const pageData = getArtifact(results, "pageSarimax");
  const sarimaxResults = getArtifact(results, "sarimaxResults");
  const sarimaxDiagnostics = getArtifact(results, "sarimaxDiagnostics");
  const sarimaxForecastPath = getArtifact(results, "sarimaxForecastPath");
  const forecastStatus = getArtifact(results, "forecastStatus");
  const modelWindowPlan = getArtifact(results, "modelWindowPlan");

  const loadedCount = results.filter((item) => item.ok).length;

  const dataset = getDataset(sarimaxResults, pageData);
  const splits = getSplits(sarimaxResults, pageData);
  const selectedModel = sarimaxResults?.selected_model || pageData?.selected_model || {};

  const selectedCandidateId = selectedModel?.candidate_id || "Selected SARIMAX";
  const selectedOrder = orderToText(selectedModel?.order);
  const selectedFeatureSet = selectedModel?.feature_set || "—";
  const selectedFeatures = Array.isArray(selectedModel?.features)
    ? selectedModel.features
    : [];

  const excludedVariables = Array.isArray(sarimaxResults?.excluded_variables)
    ? sarimaxResults.excluded_variables
    : [];

  const exogPolicy =
    sarimaxResults?.exogenous_factor_policy ||
    "Uses lagged exogenous variables to avoid same-day information dependency.";

  const validationMetrics =
    selectedModel?.validation_metrics ||
    {};

  const testMetrics =
    selectedModel?.test_metrics_rolling ||
    {};

  const staticTestMetrics =
    selectedModel?.test_metrics_static_diagnostic ||
    {};

  const metricRows = normalizeMetricRows(sarimaxResults, sarimaxDiagnostics);
  const validationRows = normalizeValidationLeaderboardRows(metricRows);
  const rollingChartRows = buildForecastRows(sarimaxForecastPath, "rolling_forecast");
  const staticChartRows = buildForecastRows(sarimaxForecastPath, "static_forecast");
  const recentRows = rollingChartRows.slice(-90);
  const coefficientRows = normalizeCoefficientRows(sarimaxResults, sarimaxDiagnostics);
  const ljungBoxRows = normalizeLjungBoxRows(sarimaxResults, sarimaxDiagnostics);

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

  const pageTitle = pageData?.page_title || "SARIMAX Forecast";

  const pageSubtitle =
    pageData?.page_subtitle ||
    "Classical ARIMA model with selected lagged exogenous gold drivers and rolling evaluation.";

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
                Dataset B — Core Multivariate
              </span>

              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-100">
                Lagged Exogenous Variables
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

          <SarimaxAnimation />
        </div>
      </section>

      <section className="px-6 py-12 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl space-y-10">
          <CardShell>
            <SectionTitle
              eyebrow="Method Foundation"
              title="What SARIMAX Forecasting Does"
              subtitle="Notebook 08 extends ARIMA with lagged exogenous drivers while preserving professor-safe time-based evaluation."
            />

            <MethodExplanationCards />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Notebook Workflow"
              title="Colab Logic Converted to Website Sections"
              subtitle="Static SARIMAX is diagnostic; rolling one-step SARIMAX is the default fair evaluation mode."
            />

            <NotebookWorkflow />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Feature Policy"
              title="Lagged Exogenous Drivers and Excluded Variables"
              subtitle="This section is read from the SARIMAX selected-model artifact and project policy fields."
            />

            <FeaturePolicyBlock
              features={selectedFeatures}
              excluded={excludedVariables}
              policy={exogPolicy}
            />
          </CardShell>

          <div className="grid gap-10 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-yellow-200 bg-yellow-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-700">
                Selected SARIMAX Candidate
              </p>
              <h3 className="mt-3 text-3xl font-black text-slate-950">
                {formatText(selectedCandidateId)}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                Selection rule:{" "}
                {formatText(sarimaxResults?.selection_rule)}
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
                Diagnostic Comparison
              </p>
              <h3 className="mt-3 text-3xl font-black text-slate-950">
                Rolling vs Static
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                The default frontend chart should use the one-step rolling
                forecast. Static SARIMAX is retained as a diagnostic because it
                can flatten or lag during regime shifts.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Feature Set
                  </p>
                  <p className="mt-1 break-words text-lg font-black text-slate-950">
                    {formatText(selectedFeatureSet)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Static Test RMSE
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(metricValue(staticTestMetrics, "rmse"), 4)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Append Failures
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(selectedModel?.append_failures_test, 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 01"
              title="Actual vs Rolling SARIMAX Forecast"
              subtitle="This is the primary Notebook 08 chart. It uses one-step rolling forecasts."
            />

            <ActualVsForecastChart
              title="Actual Gold Price vs Rolling SARIMAX Forecast"
              rows={rollingChartRows}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="forecast"
              forecastLabel="Rolling SARIMAX Forecast"
              yAxisLabel="Gold Price (USD/oz)"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 02"
              title="Rolling SARIMAX Residuals"
              subtitle="Residual = actual gold price minus rolling SARIMAX forecast."
            />

            <ResidualChart
              title="Rolling SARIMAX Forecast Residuals"
              rows={rollingChartRows}
              actualKey="actual"
              forecastKey="forecast"
              forecastLabel="Rolling SARIMAX Forecast"
              yAxisLabel="Actual - Forecast"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 03"
              title="Static Multi-Step SARIMAX Diagnostic"
              subtitle="This chart is diagnostic and shows how static multi-step SARIMAX behaves without daily updating."
            />

            <ActualVsForecastChart
              title="Actual Gold Price vs Static SARIMAX Diagnostic"
              rows={staticChartRows}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="forecast"
              forecastLabel="Static SARIMAX Diagnostic"
              yAxisLabel="Gold Price (USD/oz)"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 04"
              title="Recent Test Zoom"
              subtitle="This zoomed view shows the most recent 90 rolling forecast-path rows."
            />

            <ActualVsForecastChart
              title="Recent Test Window: Actual vs Rolling SARIMAX"
              rows={recentRows}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="forecast"
              forecastLabel="Rolling SARIMAX Forecast"
              yAxisLabel="Gold Price (USD/oz)"
              showSplitMarkers={false}
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Output Table"
              title="SARIMAX Forecast Metrics and Candidate Leaderboards"
              subtitle="This table combines selected validation/test metrics with static and rolling validation leaderboard rows."
            />

            <MetricsTable rows={metricRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 05"
              title="Validation Error Comparison"
              subtitle="This compares validation MAE and RMSE across SARIMAX candidates and forecast modes."
            />

            <MetricComparisonChart
              rows={validationRows}
              title="SARIMAX Candidate Validation Error Comparison"
              subtitle="Validation MAE and RMSE by candidate. Lower error is better."
              split="validation"
              xKey="model_name"
              xLabel="SARIMAX Candidate"
              yLabel="Error"
              bars={[
                { key: "MAE", label: "MAE", color: "#2563eb" },
                { key: "RMSE", label: "RMSE", color: "#ca8a04" },
              ]}
            />
          </CardShell>

   

          <CardShell>
            <SectionTitle
              eyebrow="Coefficient Interpretation"
              title="Selected SARIMAX Coefficients"
              subtitle="This table is read from the selected SARIMAX result and diagnostics artifacts."
            />

            <CoefficientTable rows={coefficientRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Residual Autocorrelation Diagnostic"
              title="Ljung-Box Test"
              subtitle="Ljung-Box p-values help diagnose remaining residual autocorrelation."
            />

            <LjungBoxTable rows={ljungBoxRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Forecast Path Preview"
              title="Chart Data Preview"
              subtitle="This preview uses the same rolling forecast-path rows that feed the visual charts."
            />

            <ForecastPreviewTable rows={rollingChartRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Professor Interpretation"
              title="How to Explain These Results"
              subtitle="These notes are read from the SARIMAX notebook artifacts and kept professor-safe."
            />

            <NotesBlock sarimaxResults={sarimaxResults} pageData={pageData} />

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why SARIMAX is useful
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  SARIMAX keeps the classical ARIMA time-series structure while
                  allowing lagged macro and market factors to help explain gold
                  price movement.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why lagging matters
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Lagged exogenous factors reduce same-day information
                  dependency and make the forecast design safer for a
                  professor-style time-series project.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why static forecasts are diagnostic
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Static multi-step SARIMAX forecasts can lag during strong
                  breakouts. That behavior is useful to show, but rolling
                  one-step evaluation is the default comparison mode.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Professor-safe conclusion
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  SARIMAX is a strong classical candidate, but final model
                  ranking still belongs to Notebook 11 after all models are
                  compared using the same validation and test framework.
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
              <SourcePreview title="page_sarimax.json" data={pageData} />
              <SourcePreview title="sarimax_results.json" data={sarimaxResults} />
              <SourcePreview title="sarimax_diagnostics.json" data={sarimaxDiagnostics} />
              <SourcePreview title="sarimax_forecast_path.json" data={sarimaxForecastPath} />
              <SourcePreview title="model_window_plan.json" data={modelWindowPlan} />
            </div>
          </CardShell>
        </div>
      </section>
    </main>
  );
}