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
  model_id?: string;
  split: string;
  fit_scope?: string;
  n?: number;
  MAE?: number;
  MSE?: number;
  RMSE?: number;
  MAPE?: number;
  mean_error_bias?: number;
  directional_accuracy_pct?: number;
  [key: string]: any;
};

type CoefficientRow = {
  term: string;
  coefficient?: number;
  std_error?: number;
  t_value?: number;
  p_value?: number;
  conf_low_95?: number;
  conf_high_95?: number;
  significant_at_0_05?: boolean;
  direction?: string;
  [key: string]: any;
};

const PAGE_ARTIFACTS: ArtifactRequest[] = [
  {
    key: "pageRegression",
    label: "Page Regression",
    path: "artifacts/pages/page_regression.json",
  },
  {
    key: "regressionResults",
    label: "Regression Results",
    path: "artifacts/models/regression_results.json",
  },
  {
    key: "regressionDiagnostics",
    label: "Regression Diagnostics",
    path: "artifacts/models/regression_diagnostics.json",
  },
  {
    key: "regressionCoefficients",
    label: "Regression Coefficients",
    path: "artifacts/interpretability/regression_coefficients.json",
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

function getDataset(regressionResults: any, pageData: any) {
  return (
    regressionResults?.dataset ||
    pageData?.dataset_window ||
    pageData?.dataset ||
    findValueDeep(regressionResults, ["dataset"]) ||
    findValueDeep(pageData, ["dataset_window", "dataset"]) ||
    {}
  );
}

function getSplits(regressionResults: any, pageData: any) {
  return (
    regressionResults?.splits ||
    pageData?.splits ||
    findValueDeep(regressionResults, ["splits"]) ||
    findValueDeep(pageData, ["splits"]) ||
    {}
  );
}

function normalizeMetricRow(row: any, fallbackModel = "Regression Model"): MetricRow {
  return {
    model_name:
      row?.model_name ||
      row?.model ||
      row?.model_id ||
      row?.candidate ||
      fallbackModel,
    model_id: row?.model_id || row?.id,
    split: row?.split || row?.phase || "validation",
    fit_scope: row?.fit_scope || row?.scope || row?.training_scope,
    n: toNumber(row?.n ?? row?.count ?? row?.rows) ?? undefined,
    MAE: toNumber(row?.MAE ?? row?.mae) ?? undefined,
    MSE: toNumber(row?.MSE ?? row?.mse) ?? undefined,
    RMSE: toNumber(row?.RMSE ?? row?.rmse) ?? undefined,
    MAPE: toNumber(row?.MAPE ?? row?.mape) ?? undefined,
    mean_error_bias:
      toNumber(
        row?.mean_error_bias ??
          row?.bias_mean_error ??
          row?.bias ??
          row?.meanErrorBias
      ) ?? undefined,
    directional_accuracy_pct:
      toNumber(
        row?.directional_accuracy_pct ??
          row?.directionalAccuracyPct ??
          row?.directional_accuracy
      ) ?? undefined,
    ...row,
  };
}

function normalizeMetricRows(regressionResults: any, pageData: any): MetricRow[] {
  const rows: MetricRow[] = [];

  const candidateRows =
    regressionResults?.candidate_metric_table ||
    regressionResults?.candidateMetricTable ||
    pageData?.tables?.candidate_metric_table ||
    findArrayDeep(regressionResults, [
      "candidate_metric_table",
      "candidateMetricTable",
      "candidate_models",
      "model_metrics",
      "metrics_table",
      "results",
      "records",
      "rows",
      "data",
    ]) ||
    [];

  if (Array.isArray(candidateRows)) {
    candidateRows.forEach((row: any) => {
      rows.push(normalizeMetricRow(row));
    });
  }

  const mainName =
    regressionResults?.main_regression_model_name ||
    pageData?.model_status?.main_regression_model_name ||
    "Main Regression Model";

  const mainMetrics = regressionResults?.main_metrics || {};
  const validationFromTrainFit =
    mainMetrics?.validation_from_train_fit ||
    pageData?.kpi_cards?.validation ||
    null;

  const testFromTrainValidationFit =
    mainMetrics?.test_from_train_validation_fit ||
    pageData?.kpi_cards?.test ||
    null;

  if (validationFromTrainFit) {
    rows.push(
      normalizeMetricRow(
        {
          model_name: mainName,
          split: "validation",
          fit_scope: "train_only",
          ...validationFromTrainFit,
        },
        mainName
      )
    );
  }

  if (testFromTrainValidationFit) {
    rows.push(
      normalizeMetricRow(
        {
          model_name: mainName,
          split: "test",
          fit_scope: "train_plus_validation",
          ...testFromTrainValidationFit,
        },
        mainName
      )
    );
  }

  const unique = new Map<string, MetricRow>();

  rows.forEach((row) => {
    const key = `${row.model_name}|${row.split}|${row.fit_scope}|${row.RMSE}|${row.MAE}`;
    unique.set(key, row);
  });

  return Array.from(unique.values());
}

function normalizeCoefficientRows(regressionCoefficients: any, pageData: any): CoefficientRow[] {
  const rows =
    regressionCoefficients?.coefficient_table ||
    pageData?.tables?.coefficients ||
    findArrayDeep(regressionCoefficients, [
      "coefficient_table",
      "coefficients",
      "records",
      "rows",
      "data",
    ]) ||
    [];

  return rows.map((row: any) => ({
    term: formatText(row.term ?? row.variable ?? row.feature ?? row.name),
    coefficient: toNumber(row.coefficient ?? row.coef) ?? undefined,
    std_error: toNumber(row.std_error ?? row.stderr ?? row.standard_error) ?? undefined,
    t_value: toNumber(row.t_value ?? row.tvalue ?? row.t_stat) ?? undefined,
    p_value: toNumber(row.p_value ?? row.pvalue) ?? undefined,
    conf_low_95: toNumber(row.conf_low_95 ?? row.conf_low ?? row.lower_95) ?? undefined,
    conf_high_95: toNumber(row.conf_high_95 ?? row.conf_high ?? row.upper_95) ?? undefined,
    significant_at_0_05:
      row.significant_at_0_05 ??
      row.significant ??
      (toNumber(row.p_value ?? row.pvalue) !== null
        ? Number(row.p_value ?? row.pvalue) < 0.05
        : undefined),
    direction: row.direction,
    ...row,
  }));
}

function buildForecastRows(pageData: any, regressionResults: any): ForecastChartRow[] {
  const records =
    pageData?.charts?.actual_vs_predicted ||
    regressionResults?.charts?.actual_vs_predicted ||
    regressionResults?.forecast_path ||
    regressionResults?.forecastPath ||
    findArrayDeep(pageData, [
      "actual_vs_predicted",
      "forecast_path",
      "forecastPath",
      "predictions",
      "records",
      "rows",
      "data",
    ]) ||
    findArrayDeep(regressionResults, [
      "actual_vs_predicted",
      "forecast_path",
      "forecastPath",
      "predictions",
      "records",
      "rows",
      "data",
    ]);

  return records
    .map((row: any) => {
      const actual =
        row.actual ??
        row.gold_price ??
        row.y ??
        row.actual_gold_price ??
        row.actual_price;

      const forecast =
        row.predicted ??
        row.forecast ??
        row.yhat ??
        row.regression_forecast ??
        row.regression_prediction;

      const residual =
        row.residual ??
        (actual !== undefined && forecast !== undefined
          ? Number(actual) - Number(forecast)
          : null);

      return {
        date: formatText(row.date || row.ds || row.timestamp),
        split: row.split,
        actual: toNumber(actual),
        forecast: toNumber(forecast),
        residual: toNumber(residual),
        absolute_error: toNumber(row.absolute_error),
        absolute_percentage_error: toNumber(row.absolute_percentage_error),
      };
    })
    .filter((row: any) => row.date !== "—" && row.actual !== null);
}

function normalizeFitStatistics(regressionResults: any, regressionDiagnostics: any, pageData: any) {
  return (
    pageData?.kpi_cards?.fit_statistics ||
    regressionResults?.main_fit_statistics?.test_fit_train_plus_validation ||
    regressionDiagnostics?.fit_statistics ||
    findValueDeep(regressionResults, ["fit_statistics"]) ||
    findValueDeep(regressionDiagnostics, ["fit_statistics"]) ||
    {}
  );
}

function normalizeVifRows(regressionDiagnostics: any, pageData: any) {
  const rows =
    regressionDiagnostics?.vif_table ||
    pageData?.tables?.vif ||
    findArrayDeep(regressionDiagnostics, ["vif_table", "vif", "records", "rows", "data"]) ||
    [];

  return rows.map((row: any) => ({
    variable: formatText(row.variable ?? row.feature ?? row.term ?? row.name),
    vif: toNumber(row.vif ?? row.VIF),
    ...row,
  }));
}

function normalizeResidualSummary(regressionDiagnostics: any) {
  return regressionDiagnostics?.residual_summary || {};
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

function RegressionAnimation() {
  return (
    <div className="relative min-h-[310px] overflow-hidden rounded-[2rem] border border-yellow-400/20 bg-[#050b16] p-6">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute left-8 top-12 h-2 w-2 animate-ping rounded-full bg-yellow-300" />
        <div className="absolute right-16 top-24 h-2 w-2 animate-pulse rounded-full bg-blue-300" />
        <div className="absolute bottom-16 left-1/2 h-2 w-2 animate-ping rounded-full bg-emerald-300" />
      </div>

      <div className="relative z-10">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-yellow-300">
          Notebook 06 Flow
        </p>

        <h3 className="mt-3 text-3xl font-black text-white">
          Regression-Based Forecasting
        </h3>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          This page follows the professor Chapter 17 flow: build a classical
          OLS forecasting model, report coefficients, inspect t-values and
          p-values, then evaluate validation and test forecasts.
        </p>

        <div className="mt-7 grid gap-3">
          {[
            ["01", "Load core multivariate dataset"],
            ["02", "Exclude high_yield from main regression"],
            ["03", "Fit OLS with selected predictors"],
            ["04", "Review coefficients, diagnostics, and errors"],
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
          Ordinary Least Squares
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          Regression estimates a linear relationship between gold price and
          selected predictors. The notebook mirrors the professor Chapter 17
          workflow using statsmodels formula-based OLS.
        </p>

        <div className="mt-5 rounded-3xl border border-yellow-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Professor Formula
          </p>
          <p className="mt-3 text-2xl font-black text-slate-950">
            ŷ = β<sub>0</sub> + β<sub>1</sub>X<sub>1</sub> + ... + β<sub>k</sub>X<sub>k</sub>
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
          Classical Output
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Coefficients + Tests
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          The page reports coefficient, standard error, t-value, p-value, R²,
          adjusted R², and F-test fields because those are professor-style
          regression interpretation items.
        </p>

        <div className="mt-5 rounded-3xl border border-blue-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Interpretation Rule
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            p-value below 0.05 is marked as statistically significant, but
            coefficients should still be interpreted carefully.
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
          Forecast Safety
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Time-Based Fitting
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          Validation forecasts are fitted using the training period only. Test
          forecasts are fitted using train plus validation. The test period is
          not used to estimate coefficients.
        </p>

        <div className="mt-5 rounded-3xl border border-emerald-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Project Rule
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            high_yield is excluded from the main regression because its usable
            history starts too late.
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
        "Notebook 06 uses the locked core multivariate dataset for regression, not the long univariate baseline dataset.",
    },
    {
      title: "Select Predictors",
      detail:
        "The model uses selected predictors only and excludes high_yield from the main regression due to short history.",
    },
    {
      title: "Fit OLS Formula",
      detail:
        "The notebook follows statsmodels formula-based OLS so coefficient tables and fit statistics are available.",
    },
    {
      title: "Forecast Validation",
      detail:
        "Validation predictions are generated using coefficients fitted only on the training period.",
    },
    {
      title: "Forecast Test",
      detail:
        "Test predictions are generated after fitting on training plus validation, without using test data for fitting.",
    },
    {
      title: "Export Interpretability",
      detail:
        "Regression results, diagnostics, coefficients, VIF, and page data are exported as JSON artifacts.",
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

function SelectedFeatureBlock({
  selected,
  excluded,
}: {
  selected: string[];
  excluded: string[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
          Selected Predictors
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Variables Used in Main OLS
        </h3>

        <div className="mt-5 flex flex-wrap gap-3">
          {selected.length > 0 ? (
            selected.map((item) => (
              <span
                key={item}
                className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-black text-blue-700"
              >
                {item}
              </span>
            ))
          ) : (
            <p className="text-sm leading-7 text-slate-600">
              No selected predictor list was exported.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-700">
          Excluded from Main Model
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Short-History / Safety Rules
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
              No excluded-feature list was exported.
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
      <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Model</th>
            <th className="px-4 py-3">Split</th>
            <th className="px-4 py-3">Fit Scope</th>
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
                {formatText(row.model_name)}
              </td>
              <td className="px-4 py-4 font-bold capitalize text-slate-700">
                {formatText(row.split)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.fit_scope)}
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

function CoefficientTable({ rows }: { rows: CoefficientRow[] }) {
  return (
    <div className="overflow-auto rounded-3xl border border-slate-200">
      <table className="w-full min-w-[1250px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Term</th>
            <th className="px-4 py-3">Coefficient</th>
            <th className="px-4 py-3">Std Error</th>
            <th className="px-4 py-3">t-value</th>
            <th className="px-4 py-3">p-value</th>
            <th className="px-4 py-3">95% Low</th>
            <th className="px-4 py-3">95% High</th>
            <th className="px-4 py-3">Significant?</th>
            <th className="px-4 py-3">Direction</th>
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
                {formatNumber(row.t_value, 4)}
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
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.direction)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FitStatisticsBlock({ stats }: { stats: any }) {
  const items = [
    ["R²", stats?.r_squared],
    ["Adjusted R²", stats?.adjusted_r_squared],
    ["F-statistic", stats?.f_statistic],
    ["F p-value", stats?.f_p_value],
    ["AIC", stats?.aic],
    ["BIC", stats?.bic],
    ["Condition Number", stats?.condition_number],
    ["Observations", stats?.nobs],
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">
            {label}
          </p>
          <p className="mt-3 text-2xl font-black text-slate-950">
            {formatNumber(value, 6)}
          </p>
        </div>
      ))}
    </div>
  );
}

function VifTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No VIF table was exported in the current diagnostics artifact.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Variable</th>
            <th className="px-4 py-3">VIF</th>
            <th className="px-4 py-3">Reading</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => {
            const vif = Number(row.vif);
            const reading =
              Number.isFinite(vif) && vif >= 10
                ? "High multicollinearity risk"
                : Number.isFinite(vif) && vif >= 5
                  ? "Moderate multicollinearity risk"
                  : "Lower VIF";
            return (
              <tr key={index} className="border-t border-slate-200">
                <td className="px-4 py-4 font-black text-slate-950">
                  {formatText(row.variable)}
                </td>
                <td className="px-4 py-4 text-slate-700">
                  {formatNumber(row.vif, 4)}
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

function ResidualSummaryBlock({ residualSummary }: { residualSummary: any }) {
  const entries = Object.entries(residualSummary || {});

  if (entries.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No residual summary was exported in the current diagnostics artifact.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {entries.map(([scope, summary]: [string, any]) => (
        <div key={scope} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
            {scope}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {Object.entries(summary || {}).map(([key, value]) => (
              <div key={key} className="rounded-2xl bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                  {key}
                </p>
                <p className="mt-1 text-lg font-black text-slate-950">
                  {formatNumber(value, 4)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
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
            <th className="px-4 py-3">Predicted</th>
            <th className="px-4 py-3">Residual</th>
            <th className="px-4 py-3">Absolute Error</th>
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
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.absolute_error, 4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotesBlock({ regressionResults, regressionDiagnostics, pageData }: any) {
  const notes = [
    ...findArrayDeep(regressionResults, ["methodology_notes"]),
    ...findArrayDeep(regressionDiagnostics, ["diagnostic_notes"]),
    ...findArrayDeep(pageData, ["model_explanation"]),
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

function LimitationsBlock({ pageData }: { pageData: any }) {
  const limitations = findArrayDeep(pageData, ["limitations"]).map((item) =>
    formatText(item)
  );

  if (limitations.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No separate limitations list was exported in the page artifact.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {limitations.map((item, index) => (
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

export default async function RegressionPage() {
  const results = await loadArtifacts();

  const pageData = getArtifact(results, "pageRegression");
  const regressionResults = getArtifact(results, "regressionResults");
  const regressionDiagnostics = getArtifact(results, "regressionDiagnostics");
  const regressionCoefficients = getArtifact(results, "regressionCoefficients");
  const forecastStatus = getArtifact(results, "forecastStatus");
  const modelWindowPlan = getArtifact(results, "modelWindowPlan");

  const loadedCount = results.filter((item) => item.ok).length;

  const dataset = getDataset(regressionResults, pageData);
  const splits = getSplits(regressionResults, pageData);
  const metricRows = normalizeMetricRows(regressionResults, pageData);
  const coefficientRows = normalizeCoefficientRows(regressionCoefficients, pageData);
  const chartRows = buildForecastRows(pageData, regressionResults);
  const fitStats = normalizeFitStatistics(regressionResults, regressionDiagnostics, pageData);
  const vifRows = normalizeVifRows(regressionDiagnostics, pageData);
  const residualSummary = normalizeResidualSummary(regressionDiagnostics);

  const mainModelName =
    regressionResults?.main_regression_model_name ||
    pageData?.model_status?.main_regression_model_name ||
    regressionCoefficients?.model_name ||
    "Main Regression Model";

  const formula =
    regressionResults?.main_regression_formula ||
    regressionCoefficients?.formula ||
    "Formula not exported";

  const selectedPredictors =
    regressionResults?.selected_predictors_used ||
    pageData?.selected_features ||
    [];

  const excludedFeatures =
    regressionResults?.excluded_from_main_regression ||
    pageData?.excluded_features ||
    [];

  const validationMetrics =
    metricRows.find(
      (row) =>
        String(row.model_name) === String(mainModelName) &&
        String(row.split).toLowerCase() === "validation"
    ) ||
    pageData?.kpi_cards?.validation ||
    {};

  const testMetrics =
    metricRows.find(
      (row) =>
        String(row.model_name) === String(mainModelName) &&
        String(row.split).toLowerCase() === "test"
    ) ||
    pageData?.kpi_cards?.test ||
    {};

  const officialCutoff =
    pageData?.model_status?.official_forecast_cutoff ||
    regressionResults?.dataset?.official_forecast_cutoff ||
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

  const pageTitle =
    pageData?.page_title ||
    "Regression-Based Forecasting";

  const pageSubtitle =
    pageData?.page_subtitle ||
    "Professor-style OLS forecasting model using the core multivariate gold dataset.";

  const validationChartRows = metricRows.filter(
    (row) => String(row.split).toLowerCase() === "validation"
  );

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
                OLS + Interpretability
              </span>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-4">
              <DarkKpiCard label="Dataset Start" value={dataset?.start} />
              <DarkKpiCard label="Dataset End" value={dataset?.end} />
              <DarkKpiCard label="Target" value={dataset?.target || "gold_price"} />
              <DarkKpiCard label="Official Cutoff" value={officialCutoff} />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <SplitWindowCard label="Train Window" split={splits?.train} />
              <SplitWindowCard label="Validation Window" split={splits?.validation} />
              <SplitWindowCard label="Test Window" split={splits?.test} />
            </div>
          </div>

          <RegressionAnimation />
        </div>
      </section>

      <section className="px-6 py-12 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl space-y-10">
          <CardShell>
            <SectionTitle
              eyebrow="Method Foundation"
              title="What Regression-Based Forecasting Does"
              subtitle="This section follows the professor Chapter 17 explanation before moving to metrics, charts, and coefficient interpretation."
            />

            <MethodExplanationCards />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Notebook Workflow"
              title="Colab Logic Converted to Website Sections"
              subtitle="Notebook 06 uses time-based forecasting logic and exports regression interpretability artifacts."
            />

            <NotebookWorkflow />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Feature Policy"
              title="Selected Predictors and Excluded Features"
              subtitle="Regression uses selected predictors only. high_yield is excluded from the main model because its usable history starts too late."
            />

            <SelectedFeatureBlock
              selected={selectedPredictors}
              excluded={excludedFeatures}
            />
          </CardShell>

          <div className="grid gap-10 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-yellow-200 bg-yellow-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-700">
                Main Regression Model
              </p>
              <h3 className="mt-3 text-3xl font-black text-slate-950">
                {formatText(mainModelName)}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                Validation forecasts use coefficients fitted on training only.
                Test forecasts use coefficients fitted on train plus validation.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Validation RMSE
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(metricValue(validationMetrics, "RMSE"), 4)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Test RMSE
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(metricValue(testMetrics, "RMSE"), 4)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Adjusted R²
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(fitStats?.adjusted_r_squared, 6)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
                Regression Formula
              </p>
              <h3 className="mt-3 text-3xl font-black text-slate-950">
                OLS Specification
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                This formula is read directly from the regression artifact.
              </p>

              <pre className="mt-5 max-h-[220px] overflow-auto rounded-3xl bg-white p-5 text-sm leading-7 text-slate-700">
                {formatText(formula)}
              </pre>
            </div>
          </div>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 01"
              title="Actual vs Regression Forecast"
              subtitle="This is the website version of the notebook actual-vs-predicted regression forecast chart."
            />

            <ActualVsForecastChart
              title="Actual Gold Price vs Regression Forecast"
              rows={chartRows}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="forecast"
              forecastLabel="Regression Forecast"
              yAxisLabel="Gold Price (USD/oz)"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 02"
              title="Regression Forecast Residuals"
              subtitle="Residual = actual gold price minus regression forecast."
            />

            <ResidualChart
              title="Regression Forecast Residuals"
              rows={chartRows}
              actualKey="actual"
              forecastKey="forecast"
              forecastLabel="Regression Forecast"
              yAxisLabel="Actual - Forecast"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Output Table"
              title="Regression Forecast Metrics"
              subtitle="This table includes candidate metrics plus the main validation and test metrics exported by Notebook 06."
            />

            <MetricsTable rows={metricRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 03"
              title="Validation Error Comparison"
              subtitle="This compares validation MAE and RMSE across regression candidates where available."
            />

            <MetricComparisonChart
              rows={validationChartRows}
              title="Regression Candidate Validation Error Comparison"
              subtitle="Validation MAE and RMSE by regression candidate. Lower error is better."
              split="validation"
              xKey="model_name"
              xLabel="Regression Candidate"
              yLabel="Error"
              bars={[
                { key: "MAE", label: "MAE", color: "#2563eb" },
                { key: "RMSE", label: "RMSE", color: "#ca8a04" },
              ]}
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Professor Regression Summary"
              title="Fit Statistics"
              subtitle="These are the classical regression fields: R², adjusted R², F-test, AIC/BIC, condition number, and observations."
            />

            <FitStatisticsBlock stats={fitStats} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Coefficient Interpretation"
              title="OLS Coefficients, t-values, and p-values"
              subtitle="This table is read from regression_coefficients.json. It supports professor-style discussion of coefficient direction and statistical significance."
            />

            <CoefficientTable rows={coefficientRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Multicollinearity Diagnostic"
              title="VIF Table"
              subtitle="High VIF values indicate possible multicollinearity and should be discussed, not hidden."
            />

            <VifTable rows={vifRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Residual Diagnostic"
              title="Residual Summary"
              subtitle="This summarizes residual behavior for train-plus-validation and test scopes when exported."
            />

            <ResidualSummaryBlock residualSummary={residualSummary} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Forecast Path Preview"
              title="Chart Data Preview"
              subtitle="This preview uses the same regression path rows that feed the visual charts."
            />

            <ForecastPreviewTable rows={chartRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Professor Interpretation"
              title="How to Explain These Results"
              subtitle="These notes come from the regression notebook logic and diagnostics artifacts where available."
            />

            <NotesBlock
              regressionResults={regressionResults}
              regressionDiagnostics={regressionDiagnostics}
              pageData={pageData}
            />

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why regression is useful
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Regression gives a transparent link between gold price and
                  selected explanatory factors. It is easier to explain than
                  black-box methods because coefficients, t-values, and p-values
                  can be inspected.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why coefficients need caution
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Lagged gold price and correlated macro variables can dominate
                  the regression. A significant coefficient is not automatically
                  a causal explanation.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why diagnostics matter
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  VIF, residual summary, and fit statistics help explain whether
                  the OLS model is stable, interpretable, and appropriate for a
                  time-series forecasting context.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Professor-safe conclusion
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Regression is a classical forecasting candidate. It should not
                  be called the final winner until Notebook 11 compares all
                  models under the same validation and test framework.
                </p>
              </div>
            </div>
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Limitations"
              title="Regression Model Limitations"
              subtitle="Limitations are read from the page/model artifacts where available."
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
              <SourcePreview title="page_regression.json" data={pageData} />
              <SourcePreview title="regression_results.json" data={regressionResults} />
              <SourcePreview
                title="regression_diagnostics.json"
                data={regressionDiagnostics}
              />
              <SourcePreview
                title="regression_coefficients.json"
                data={regressionCoefficients}
              />
              <SourcePreview title="model_window_plan.json" data={modelWindowPlan} />
            </div>
          </CardShell>
        </div>
      </section>
    </main>
  );
}