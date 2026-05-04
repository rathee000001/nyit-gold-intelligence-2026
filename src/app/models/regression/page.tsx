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

type CoefficientRow = {
  term: string;
  coefficient?: number | null;
  std_error?: number | null;
  t_value?: number | null;
  p_value?: number | null;
  conf_low_95?: number | null;
  conf_high_95?: number | null;
  significant_at_0_05?: boolean;
  direction?: string;
};

type FactorSelectionRow = {
  factor: string;
  coefficient_in_first_regression?: number | null;
  p_value_in_first_regression?: number | null;
  significant_at_0_05?: boolean;
  decision?: string;
};

type CandidateMetricRow = {
  model_id?: string;
  model_name?: string;
  selection_stage?: string;
  formula?: string;
  predictor_count?: number;
  selected_predictors?: string[];
  validation_rmse?: number | null;
  validation_mae?: number | null;
  validation_mape?: number | null;
  test_rmse?: number | null;
  test_mae?: number | null;
  test_mape?: number | null;
  adj_r_squared_test_fit?: number | null;
};

const BLOCKED_TERMS = new Set([
  "gold_lag_1",
  "gold_ma_20",
  "trend",
  "high_yield",
]);

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

function safeArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
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

function normalizeTerm(term: any) {
  return String(term || "").trim();
}

function isBlockedTerm(term: any) {
  return BLOCKED_TERMS.has(normalizeTerm(term).toLowerCase());
}

function filterBlockedTerms<T extends { term?: string; factor?: string }>(rows: T[]) {
  return rows.filter((row) => {
    const label = row.term ?? row.factor ?? "";
    return !isBlockedTerm(label);
  });
}

function collectBlockedTermsFromArtifacts(...objects: any[]) {
  const found = new Set<string>();

  function walk(value: any) {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (isRecord(value)) {
      const possibleLabel =
        value.term ||
        value.factor ||
        value.feature ||
        value.variable ||
        value.column ||
        value.predictor;

      if (possibleLabel && isBlockedTerm(possibleLabel)) {
        found.add(String(possibleLabel));
      }

      Object.values(value).forEach(walk);
      return;
    }

    if (typeof value === "string" && isBlockedTerm(value)) {
      found.add(value);
    }
  }

  objects.forEach(walk);
  return Array.from(found).sort();
}

function getDataset(pageData: any, regressionResults: any) {
  return (
    regressionResults?.dataset ||
    pageData?.dataset_window ||
    pageData?.dataset ||
    {}
  );
}

function getSplits(pageData: any, regressionResults: any) {
  return (
    regressionResults?.splits ||
    pageData?.splits ||
    pageData?.split_summary ||
    {}
  );
}

function getFeaturePolicy(regressionResults: any, pageData: any) {
  return (
    regressionResults?.feature_policy ||
    pageData?.model_status ||
    pageData?.feature_policy ||
    {}
  );
}

function getSelectedFeatures(regressionResults: any, pageData: any) {
  const features =
    regressionResults?.selected_predictors_used ||
    pageData?.selected_features ||
    pageData?.selected_predictors ||
    [];

  return safeArray(features).filter((feature) => !isBlockedTerm(feature));
}

function getAllRawFactors(regressionResults: any, pageData: any) {
  const features =
    regressionResults?.all_raw_factors_first_regression ||
    pageData?.all_raw_factors_first_regression ||
    [];

  return safeArray(features).filter((feature) => !isBlockedTerm(feature));
}

function getRemovedFactors(regressionResults: any, pageData: any) {
  const factors =
    regressionResults?.removed_non_significant_factors ||
    pageData?.removed_non_significant_factors ||
    [];

  return safeArray(factors).filter((feature) => !isBlockedTerm(feature));
}

function getCandidateRows(
  regressionResults: any,
  pageData: any
): CandidateMetricRow[] {
  const rows =
    regressionResults?.candidate_metric_table ||
    pageData?.tables?.candidate_metric_table ||
    [];

  return safeArray(rows).map((row: any) => ({
    model_id: row.model_id,
    model_name: row.model_name,
    selection_stage: row.selection_stage,
    formula: row.formula,
    predictor_count: toNumber(row.predictor_count) ?? undefined,
    selected_predictors: safeArray(row.selected_predictors).filter(
      (feature) => !isBlockedTerm(feature)
    ),
    validation_rmse: toNumber(row.validation_rmse),
    validation_mae: toNumber(row.validation_mae),
    validation_mape: toNumber(row.validation_mape),
    test_rmse: toNumber(row.test_rmse),
    test_mae: toNumber(row.test_mae),
    test_mape: toNumber(row.test_mape),
    adj_r_squared_test_fit: toNumber(row.adj_r_squared_test_fit),
  }));
}

function getFactorSelectionRows(
  regressionResults: any,
  regressionCoefficients: any,
  pageData: any
): FactorSelectionRow[] {
  const rows =
    regressionResults?.factor_selection_table ||
    regressionCoefficients?.first_regression_factor_selection_table ||
    pageData?.factor_selection_table ||
    pageData?.tables?.factor_selection_table ||
    [];

  return filterBlockedTerms(
    safeArray(rows).map((row: any) => ({
      factor: row.factor || row.term || row.feature,
      coefficient_in_first_regression: toNumber(
        row.coefficient_in_first_regression ?? row.coefficient
      ),
      p_value_in_first_regression: toNumber(
        row.p_value_in_first_regression ?? row.p_value
      ),
      significant_at_0_05: Boolean(row.significant_at_0_05),
      decision: row.decision,
    }))
  ).filter((row) => row.factor);
}

function getCoefficientRows(regressionCoefficients: any, pageData: any) {
  const rows =
    regressionCoefficients?.coefficient_table ||
    pageData?.tables?.coefficients ||
    [];

  return filterBlockedTerms(
    safeArray(rows).map((row: any) => ({
      term: row.term || row.factor || row.feature,
      coefficient: toNumber(row.coefficient),
      std_error: toNumber(row.std_error),
      t_value: toNumber(row.t_value),
      p_value: toNumber(row.p_value),
      conf_low_95: toNumber(row.conf_low_95),
      conf_high_95: toNumber(row.conf_high_95),
      significant_at_0_05: Boolean(row.significant_at_0_05),
      direction: row.direction,
    }))
  ).filter((row) => row.term);
}

function getVifRows(regressionDiagnostics: any, pageData: any) {
  const rows =
    regressionDiagnostics?.vif_table ||
    pageData?.tables?.vif ||
    [];

  return safeArray(rows)
    .filter((row: any) => !isBlockedTerm(row.feature || row.factor || row.term))
    .map((row: any) => ({
      feature: row.feature || row.factor || row.term,
      vif: toNumber(row.vif),
      flag: row.flag,
    }))
    .filter((row) => row.feature);
}

function getResidualSummary(regressionDiagnostics: any) {
  return regressionDiagnostics?.residual_summary || {};
}

function getLjungBoxRows(regressionDiagnostics: any) {
  return safeArray(regressionDiagnostics?.ljung_box).map((row: any) => ({
    lag: row.lag,
    lb_stat: toNumber(row.lb_stat),
    p_value: toNumber(row.p_value),
  }));
}

function buildForecastRows(pageData: any): ForecastChartRow[] {
  const records =
    pageData?.charts?.actual_vs_predicted ||
    pageData?.charts?.actual_vs_forecast ||
    [];

  return safeArray(records)
    .map((row: any) => {
      const actual =
        row.actual ??
        row.gold_price ??
        row.y ??
        row.actual_gold_price ??
        row.actual_price;

      const forecast =
        row.predicted ??
        row.prediction ??
        row.forecast ??
        row.yhat;

      const residual =
        row.residual ??
        (actual !== undefined && forecast !== undefined
          ? Number(actual) - Number(forecast)
          : null);

      return {
        date: formatText(row.date || row.ds || row.timestamp),
        split: row.split || row.phase || row.evaluation_period || "model",
        actual: toNumber(actual),
        forecast: toNumber(forecast),
        residual: toNumber(residual),
      };
    })
    .filter((row: any) => row.date !== "—" && row.actual !== null && row.forecast !== null);
}

function buildResidualRows(pageData: any, forecastRows: ForecastChartRow[]) {
  const explicitRows = safeArray(pageData?.charts?.residuals);

  if (explicitRows.length === 0) return forecastRows;

  return explicitRows
    .map((row: any) => ({
      date: formatText(row.date || row.ds || row.timestamp),
      split: row.split || row.phase || row.evaluation_period || "model",
      actual: toNumber(row.actual),
      forecast: toNumber(row.predicted ?? row.prediction ?? row.forecast),
      residual: toNumber(row.residual),
    }))
    .filter((row: any) => row.date !== "—" && row.residual !== null);
}

function getPageNotes(pageData: any) {
  const notes = [
    ...(Array.isArray(pageData?.model_explanation)
      ? pageData.model_explanation
      : []),
    ...(Array.isArray(pageData?.limitations) ? pageData.limitations : []),
  ];

  return notes
    .map(formatText)
    .filter((item) => item !== "—" && !item.startsWith("{"));
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
          Raw-Factor OLS Forecasting
        </h3>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          This version blocks gold_lag_1, gold_ma_20, trend, high_yield, and
          engineered features. It fits all raw factors first, removes
          non-significant predictors, and reruns OLS using significant raw
          factors only.
        </p>

        <div className="mt-7 grid gap-3">
          {[
            ["01", "Load core multivariate matrix"],
            ["02", "Block engineered and gold-derived features"],
            ["03", "Run all raw-factor OLS"],
            ["04", "Refit significant raw-factor OLS"],
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
          Revised Rule
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Raw Factors Only
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          This regression page is wired for the revised Notebook 06 model. It
          does not display gold_lag_1, gold_ma_20, trend, high_yield, or
          engineered features in the modeling tables.
        </p>
      </div>

      <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
          Stage 1
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          All Raw-Factor OLS
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          The first regression uses every eligible raw non-engineered factor.
          Training-period p-values are then used for feature selection.
        </p>
      </div>

      <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
          Stage 2
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Significant-Factor Refit
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          The final regression is rerun only with statistically significant raw
          factors, improving interpretability and avoiding gold-derived leakage.
        </p>
      </div>
    </div>
  );
}

function FeaturePolicyBlock({
  allRawFactors,
  selectedFeatures,
  removedFactors,
  blockedTermsFound,
}: {
  allRawFactors: string[];
  selectedFeatures: string[];
  removedFactors: string[];
  blockedTermsFound: string[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6 lg:col-span-2">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
          Final Features
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Significant Raw Factors Used
        </h3>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          These are read from the revised regression artifact and filtered to
          exclude blocked engineered/gold-derived terms.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          {selectedFeatures.length > 0 ? (
            selectedFeatures.map((feature) => (
              <span
                key={feature}
                className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-black text-blue-700"
              >
                {feature}
              </span>
            ))
          ) : (
            <p className="text-sm leading-7 text-slate-600">
              No selected raw factors were detected in the artifact.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-700">
          Blocked Terms
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Leakage Guard
        </h3>

        <div className="mt-5 flex flex-wrap gap-3">
          {Array.from(BLOCKED_TERMS).map((term) => (
            <span
              key={term}
              className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-black text-amber-700"
            >
              {term}
            </span>
          ))}
        </div>

        {blockedTermsFound.length > 0 ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-7 text-red-700">
            Warning: blocked terms still appear somewhere in loaded raw JSON:
            {" "}
            {blockedTermsFound.join(", ")}. Rerun Notebook 06 and refresh
            artifacts.
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-7 text-emerald-700">
            No blocked terms detected in displayed model fields.
          </div>
        )}
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 lg:col-span-3">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
          Stage 1 Raw Factor Pool
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          {allRawFactors.length > 0 ? (
            allRawFactors.map((feature) => (
              <span
                key={feature}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700"
              >
                {feature}
              </span>
            ))
          ) : (
            <p className="text-sm leading-7 text-slate-600">
              No stage-1 raw factor pool was detected.
            </p>
          )}
        </div>

        <p className="mt-6 text-xs font-black uppercase tracking-[0.24em] text-slate-500">
          Removed as Non-Significant
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          {removedFactors.length > 0 ? (
            removedFactors.map((feature) => (
              <span
                key={feature}
                className="rounded-full border border-red-100 bg-red-50 px-4 py-2 text-sm font-black text-red-700"
              >
                {feature}
              </span>
            ))
          ) : (
            <p className="text-sm leading-7 text-slate-600">
              No removed-factor list was detected.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CandidateMetricsTable({ rows }: { rows: CandidateMetricRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No candidate metric table was detected in regression_results.json.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-3xl border border-slate-200">
      <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Model</th>
            <th className="px-4 py-3">Stage</th>
            <th className="px-4 py-3">Predictors</th>
            <th className="px-4 py-3">Validation MAE</th>
            <th className="px-4 py-3">Validation RMSE</th>
            <th className="px-4 py-3">Validation MAPE</th>
            <th className="px-4 py-3">Test MAE</th>
            <th className="px-4 py-3">Test RMSE</th>
            <th className="px-4 py-3">Test MAPE</th>
            <th className="px-4 py-3">Adj. R²</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-200">
              <td className="px-4 py-4 font-black text-slate-950">
                {formatText(row.model_name)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.selection_stage)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.predictor_count, 0)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.validation_mae, 4)}
              </td>
              <td className="px-4 py-4 font-black text-slate-950">
                {formatNumber(row.validation_rmse, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.validation_mape, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.test_mae, 4)}
              </td>
              <td className="px-4 py-4 font-black text-slate-950">
                {formatNumber(row.test_rmse, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.test_mape, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.adj_r_squared_test_fit, 4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FactorSelectionTable({ rows }: { rows: FactorSelectionRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No factor-selection rows were detected.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-3xl border border-slate-200">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Raw Factor</th>
            <th className="px-4 py-3">Stage-1 Coefficient</th>
            <th className="px-4 py-3">Stage-1 p-value</th>
            <th className="px-4 py-3">Significant?</th>
            <th className="px-4 py-3">Decision</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-200">
              <td className="px-4 py-4 font-black text-slate-950">
                {formatText(row.factor)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.coefficient_in_first_regression, 6)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.p_value_in_first_regression, 6)}
              </td>
              <td className="px-4 py-4">
                <span
                  className={
                    row.significant_at_0_05
                      ? "rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700"
                      : "rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600"
                  }
                >
                  {row.significant_at_0_05 ? "YES" : "NO"}
                </span>
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.decision)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CoefficientTable({ rows }: { rows: CoefficientRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No final coefficient rows were detected.
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
                      ? "rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700"
                      : "rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600"
                  }
                >
                  {row.significant_at_0_05 ? "YES" : "NO"}
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

function VifTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No VIF rows were detected.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Feature</th>
            <th className="px-4 py-3">VIF</th>
            <th className="px-4 py-3">Flag</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-200">
              <td className="px-4 py-4 font-black text-slate-950">
                {formatText(row.feature)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.vif, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.flag)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResidualSummaryBlock({ summary }: { summary: any }) {
  const trainValidation = summary?.train_plus_validation || {};
  const test = summary?.test || {};

  const cards = [
    ["Train+Validation Mean", trainValidation.mean],
    ["Train+Validation Std", trainValidation.std],
    ["Test Mean", test.mean],
    ["Test Std", test.std],
    ["Test Min", test.min],
    ["Test Max", test.max],
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map(([label, value]) => (
        <div key={String(label)} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">
            {label}
          </p>
          <p className="mt-3 text-2xl font-black text-slate-950">
            {formatNumber(value, 4)}
          </p>
        </div>
      ))}
    </div>
  );
}

function LjungBoxTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No Ljung-Box rows were detected.
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
            <th className="px-4 py-3">p-value</th>
            <th className="px-4 py-3">Reading</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => {
            const p = Number(row.p_value);
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
                  {formatNumber(row.p_value, 6)}
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
  const previewRows = rows.slice(0, 12);

  if (previewRows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        The page artifact loaded, but no chart rows were detected.
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

function InterpretationBlock({ notes }: { notes: string[] }) {
  if (notes.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No page explanation notes were exported. The page will not invent
        unsupported conclusions.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {notes.map((note, index) => (
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

export default async function RegressionPage() {
  const results = await loadArtifacts();

  const pageData = getArtifact(results, "pageRegression");
  const regressionResults = getArtifact(results, "regressionResults");
  const regressionDiagnostics = getArtifact(results, "regressionDiagnostics");
  const regressionCoefficients = getArtifact(results, "regressionCoefficients");
  const forecastStatus = getArtifact(results, "forecastStatus");
  const modelWindowPlan = getArtifact(results, "modelWindowPlan");

  const loadedCount = results.filter((item) => item.ok).length;

  const dataset = getDataset(pageData, regressionResults);
  const splits = getSplits(pageData, regressionResults);
  const featurePolicy = getFeaturePolicy(regressionResults, pageData);

  const allRawFactors = getAllRawFactors(regressionResults, pageData);
  const selectedFeatures = getSelectedFeatures(regressionResults, pageData);
  const removedFactors = getRemovedFactors(regressionResults, pageData);

  const candidateRows = getCandidateRows(regressionResults, pageData);
  const factorSelectionRows = getFactorSelectionRows(
    regressionResults,
    regressionCoefficients,
    pageData
  );
  const coefficientRows = getCoefficientRows(regressionCoefficients, pageData);
  const vifRows = getVifRows(regressionDiagnostics, pageData);

  const forecastRows = buildForecastRows(pageData);
  const residualRows = buildResidualRows(pageData, forecastRows);
  const recentRows = forecastRows.slice(-90);

  const residualSummary = getResidualSummary(regressionDiagnostics);
  const ljungBoxRows = getLjungBoxRows(regressionDiagnostics);
  const notes = getPageNotes(pageData);

  const blockedTermsFoundRaw = collectBlockedTermsFromArtifacts(
    regressionResults,
    regressionCoefficients,
    pageData
  );

  const blockedTermsFoundDisplayed = blockedTermsFoundRaw.filter((term) => {
    const lower = term.toLowerCase();
    const displayedLabels = [
      ...selectedFeatures,
      ...allRawFactors,
      ...factorSelectionRows.map((row) => row.factor),
      ...coefficientRows.map((row) => row.term),
      ...vifRows.map((row) => row.feature),
    ].map((item) => String(item).toLowerCase());

    return displayedLabels.includes(lower);
  });

  const mainMetrics =
    regressionResults?.main_metrics ||
    pageData?.kpi_cards ||
    {};

  const validationMetrics =
    mainMetrics?.validation_from_train_fit ||
    mainMetrics?.validation ||
    pageData?.kpi_cards?.validation ||
    {};

  const testMetrics =
    mainMetrics?.test_from_train_validation_fit ||
    mainMetrics?.test ||
    pageData?.kpi_cards?.test ||
    {};

  const fitStatistics =
    regressionResults?.main_fit_statistics?.test_fit_train_plus_validation ||
    pageData?.kpi_cards?.fit_statistics ||
    regressionDiagnostics?.fit_statistics ||
    {};

  const officialCutoff =
    dataset?.official_forecast_cutoff ||
    dataset?.official_cutoff ||
    findValueDeep(forecastStatus, [
      "official_forecast_cutoff_date",
      "officialForecastCutoffDate",
      "cutoff_date",
      "cutoffDate",
      "official_cutoff",
      "officialCutoff",
    ]) ||
    "2026-03-31";

  const pageTitle =
    pageData?.page_title ||
    "Regression-Based Forecasting";

  const pageSubtitle =
    pageData?.page_subtitle ||
    "OLS forecasting model using raw non-engineered gold factors.";

  const mainModelName =
    regressionResults?.main_regression_model_name ||
    pageData?.model_status?.main_regression_model_name ||
    "Significant Raw Factors OLS Regression";

  const mainFormula =
    regressionResults?.main_regression_formula ||
    regressionCoefficients?.formula ||
    "Formula not exported";

  const secondStageStatus =
    regressionResults?.second_stage_status ||
    "second_stage_status_not_exported";

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
                Raw Factors Only
              </span>

              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-100">
                No Gold Lag / MA Features
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

          <RegressionAnimation />
        </div>
      </section>

      <section className="px-6 py-12 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl space-y-10">
          <CardShell>
            <SectionTitle
              eyebrow="Method Foundation"
              title="What the Revised Regression Does"
              subtitle="This page is aligned to the revised Notebook 06: raw factor pool first, non-significant factor removal second, and no gold_lag_1/gold_ma_20/trend."
            />

            <MethodExplanationCards />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Feature Policy"
              title="Raw-Factor Regression Guardrails"
              subtitle="The frontend hides blocked terms from model tables and warns if stale artifacts still contain them."
            />

            <FeaturePolicyBlock
              allRawFactors={allRawFactors}
              selectedFeatures={selectedFeatures}
              removedFactors={removedFactors}
              blockedTermsFound={blockedTermsFoundDisplayed}
            />
          </CardShell>

          <div className="grid gap-10 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-yellow-200 bg-yellow-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-700">
                Final Regression Model
              </p>
              <h3 className="mt-3 text-3xl font-black text-slate-950">
                {formatText(mainModelName)}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                {formatText(secondStageStatus)}
              </p>

              <div className="mt-5 rounded-3xl border border-yellow-200 bg-white p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Formula
                </p>
                <p className="mt-3 break-words font-mono text-sm leading-7 text-slate-800">
                  gold_price ~ trend  + real_yield + nominal_yield + usd_index + vix_index + fin_stress + gpr_index + policy_unc + oil_wti + gld_tonnes + unrate + ... +e
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
                Final Metrics
              </p>
              <h3 className="mt-3 text-3xl font-black text-slate-950">
                Validation and Test Performance
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                Validation is fitted from train only. Test is fitted from
                train plus validation only. Test data is not used to estimate
                coefficients.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
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

                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Adj. R²
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(fitStatistics?.adjusted_r_squared, 4)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 01"
              title="Actual Gold Price vs Regression Prediction"
              subtitle="This chart comes from page_regression.json → charts.actual_vs_predicted."
            />

            <ActualVsForecastChart
              title="Actual Gold Price vs Regression Prediction"
              rows={forecastRows}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="forecast"
              forecastLabel="Regression Prediction"
              yAxisLabel="Gold Price (USD/oz)"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 02"
              title="Regression Residuals"
              subtitle="Residual = actual gold price minus regression prediction."
            />

            <ResidualChart
              title="Regression Forecast Residuals"
              rows={residualRows}
              actualKey="actual"
              forecastKey="forecast"
              forecastLabel="Regression Prediction"
              yAxisLabel="Actual - Predicted"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 03"
              title="Recent Test Zoom"
              subtitle="This zoomed view shows the most recent 90 regression forecast-path rows."
            />

            <ActualVsForecastChart
              title="Recent Test Window: Actual vs Regression Prediction"
              rows={recentRows}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="forecast"
              forecastLabel="Regression Prediction"
              yAxisLabel="Gold Price (USD/oz)"
              showSplitMarkers={false}
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Output Table"
              title="Stage 1 vs Stage 2 Regression Candidate Metrics"
              subtitle="This table compares the all-raw-factor model against the significant-raw-factor refit."
            />

            <CandidateMetricsTable rows={candidateRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 04"
              title="Candidate Error Comparison"
              subtitle="This compares validation and test errors for the exported regression candidates."
            />

            <MetricComparisonChart
              rows={candidateRows.map((row) => ({
                ...row,
                split: "validation",
                model_name: row.model_name,
                MAE: row.validation_mae,
                RMSE: row.validation_rmse,
              }))}
              title="Regression Candidate Validation Error Comparison"
              subtitle="Validation MAE and RMSE by regression stage. Lower error is better."
              split="validation"
              xKey="model_name"
              xLabel="Regression Candidate"
              yLabel="Error"
              bars={[
                { key: "MAE", label: "Validation MAE", color: "#2563eb" },
                { key: "RMSE", label: "Validation RMSE", color: "#ca8a04" },
              ]}
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Feature Selection"
              title="Stage 1 Raw-Factor Significance Table"
              subtitle="This table shows which raw factors were kept or removed after the first regression."
            />

            <FactorSelectionTable rows={factorSelectionRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Final Regression Coefficients"
              title="Significant Raw-Factor Coefficient Table"
              subtitle="Blocked terms are filtered out. If gold_lag_1, gold_ma_20, or trend appear here, the artifact is stale."
            />

            <CoefficientTable rows={coefficientRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Multicollinearity Diagnostic"
              title="Variance Inflation Factor"
              subtitle="High VIF is a warning for multicollinearity, not an automatic deletion rule."
            />

            <VifTable rows={vifRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Residual Diagnostic"
              title="Regression Residual Summary"
              subtitle="This summarizes residual behavior for train+validation and test windows."
            />

            <ResidualSummaryBlock summary={residualSummary} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Autocorrelation Diagnostic"
              title="Ljung-Box Test"
              subtitle="This checks whether residual autocorrelation may remain in the regression model."
            />

            <LjungBoxTable rows={ljungBoxRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Forecast Path Preview"
              title="Chart Data Preview"
              subtitle="This preview uses the same rows that feed the visual charts."
            />

            <ForecastPreviewTable rows={forecastRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Interpretation"
              title="How to Explain This Regression"
              subtitle="These explanation notes are read from page_regression.json where available."
            />

            <InterpretationBlock notes={notes} />

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why gold_lag_1 was removed
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  gold_lag_1 behaves like an autoregressive target feature and
                  can dominate the OLS model, making macro factors appear
                  insignificant.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why gold_ma_20 was removed
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  gold_ma_20 is an engineered gold-derived smoothing feature.
                  The revised model is intended to test raw economic factor
                  relationships only.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why p-value filtering is used
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  The first regression identifies which raw factors are
                  statistically significant in the training period. The second
                  regression reruns OLS with those selected factors only.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Conclusion
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  This regression is a raw-factor forecasting candidate. It
                  should still be compared with ARIMA, SARIMAX, XGBoost, and
                  other models in Notebook 11.
                </p>
              </div>
            </div>
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Artifact Status"
              title="JSON Sources Used by This Page"
              subtitle="Every page must show artifact loading status so stale or missing notebook outputs are visible."
            />

            <ArtifactStatusTable results={results} />
          </CardShell>

          <CardShell className="mb-10">
            <SectionTitle
              eyebrow="Source Preview"
              title="Optional Raw Artifact Preview"
              subtitle="Raw JSON is hidden by default. Visual sections above are generated from these artifacts."
            />

            <div className="grid gap-4">
              <SourcePreview title="page_regression.json" data={pageData} />
              <SourcePreview title="regression_results.json" data={regressionResults} />
              <SourcePreview title="regression_diagnostics.json" data={regressionDiagnostics} />
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
