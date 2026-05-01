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
  feature_set?: string;
  split: string;
  n?: number;
  MAE?: number;
  MSE?: number;
  RMSE?: number;
  MAPE?: number;
  R2?: number;
  mean_error_bias?: number;
  directional_accuracy_pct?: number;
  [key: string]: any;
};

type ImportanceRow = {
  feature: string;
  importance?: number;
  gain?: number;
  weight?: number;
  cover?: number;
  rank?: number;
  [key: string]: any;
};

const PAGE_ARTIFACTS: ArtifactRequest[] = [
  {
    key: "pageXgboost",
    label: "Page XGBoost",
    path: "artifacts/pages/page_xgboost.json",
  },
  {
    key: "xgboostResults",
    label: "XGBoost Results",
    path: "artifacts/models/xgboost_results.json",
  },
  {
    key: "xgboostForecastPath",
    label: "XGBoost Forecast Path",
    path: "artifacts/models/xgboost_forecast_path.json",
  },
  {
    key: "xgboostFeatureImportance",
    label: "XGBoost Feature Importance",
    path: "artifacts/interpretability/xgboost_feature_importance.json",
  },
  {
    key: "xgboostShapSummary",
    label: "XGBoost SHAP Summary",
    path: "artifacts/interpretability/xgboost_shap_summary.json",
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

function getDataset(xgboostResults: any, pageData: any) {
  return (
    xgboostResults?.dataset ||
    pageData?.dataset_window ||
    pageData?.dataset ||
    findValueDeep(xgboostResults, ["dataset"]) ||
    findValueDeep(pageData, ["dataset_window", "dataset"]) ||
    {}
  );
}

function getSplits(xgboostResults: any, pageData: any) {
  const dataset = getDataset(xgboostResults, pageData);

  return {
    train:
      dataset?.train ||
      xgboostResults?.splits?.train ||
      pageData?.split_summary?.train ||
      {},
    validation:
      dataset?.validation ||
      xgboostResults?.splits?.validation ||
      pageData?.split_summary?.validation ||
      {},
    test:
      dataset?.test ||
      xgboostResults?.splits?.test ||
      pageData?.split_summary?.test ||
      {},
  };
}

function normalizeMetricRow(row: any, split = "validation"): MetricRow {
  const metrics = row?.metrics || row;

  return {
    model_name:
      row?.model_name ||
      row?.model ||
      row?.candidate_name ||
      row?.candidate_id ||
      "XGBoost Candidate",
    candidate_id: row?.candidate_id || row?.id,
    model_type: row?.model_type || row?.type || "xgboost",
    feature_set: row?.feature_set || row?.features_name || row?.dataset_name,
    split: row?.split || row?.evaluation_period || row?.phase || split,
    n: toNumber(metrics?.n ?? row?.n ?? row?.rows) ?? undefined,
    MAE: toNumber(metrics?.mae ?? metrics?.MAE ?? row?.mae ?? row?.MAE) ?? undefined,
    MSE: toNumber(metrics?.mse ?? metrics?.MSE ?? row?.mse ?? row?.MSE) ?? undefined,
    RMSE: toNumber(metrics?.rmse ?? metrics?.RMSE ?? row?.rmse ?? row?.RMSE) ?? undefined,
    MAPE: toNumber(metrics?.mape ?? metrics?.MAPE ?? row?.mape ?? row?.MAPE) ?? undefined,
    R2: toNumber(metrics?.r2 ?? metrics?.R2 ?? row?.r2 ?? row?.R2) ?? undefined,
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

function normalizeMetricRows(xgboostResults: any, pageData: any): MetricRow[] {
  const rows: MetricRow[] = [];

  const selected =
    xgboostResults?.selected_model ||
    xgboostResults?.best_model ||
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
        },
        "test"
      )
    );
  }

  const candidateRows =
    xgboostResults?.validation_leaderboard ||
    xgboostResults?.candidate_leaderboard ||
    xgboostResults?.leaderboard ||
    pageData?.tables?.candidate_leaderboard ||
    findArrayDeep(xgboostResults, [
      "validation_leaderboard",
      "candidate_leaderboard",
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
    xgboostResults?.metrics_table ||
    xgboostResults?.metricsTable ||
    [];

  if (Array.isArray(genericMetricRows)) {
    genericMetricRows.forEach((row: any) => {
      rows.push(normalizeMetricRow(row, row?.split || "validation"));
    });
  }

  const unique = new Map<string, MetricRow>();

  rows.forEach((row) => {
    const key = `${row.candidate_id}|${row.model_name}|${row.feature_set}|${row.split}|${row.RMSE}|${row.MAE}`;
    unique.set(key, row);
  });

  return Array.from(unique.values());
}

function normalizeValidationRows(metricRows: MetricRow[]) {
  return metricRows
    .filter((row) => String(row.split).toLowerCase() === "validation")
    .map((row) => ({
      ...row,
      model_name: `${row.model_name}${row.feature_set ? ` — ${row.feature_set}` : ""}`,
    }));
}

function buildForecastRows(xgboostForecastPath: any, xgboostResults: any): ForecastChartRow[] {
  const records =
    xgboostForecastPath?.records ||
    xgboostForecastPath?.data ||
    xgboostForecastPath?.rows ||
    xgboostForecastPath?.forecast_path ||
    xgboostResults?.forecast_path ||
    findArrayDeep(xgboostForecastPath, [
      "records",
      "forecast_path",
      "forecastPath",
      "predictions",
      "data",
      "rows",
    ]) ||
    findArrayDeep(xgboostResults, [
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
        row.forecast ??
        row.prediction ??
        row.predicted ??
        row.yhat ??
        row.xgboost_forecast ??
        row.xgb_forecast;

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
        residual: toNumber(residual),
        absolute_error: toNumber(row.absolute_error ?? row.abs_error),
        absolute_percentage_error: toNumber(
          row.absolute_percentage_error ?? row.ape
        ),
        selected_candidate_id: row.selected_candidate_id || row.candidate_id,
      };
    })
    .filter((row: any) => row.date !== "—" && row.actual !== null);
}

function normalizeImportanceRows(
  featureImportance: any,
  shapSummary: any
): ImportanceRow[] {
  const rows =
    featureImportance?.feature_importance ||
    featureImportance?.importance_table ||
    featureImportance?.records ||
    findArrayDeep(featureImportance, [
      "feature_importance",
      "importance_table",
      "features",
      "records",
      "rows",
      "data",
    ]) ||
    [];

  const shapRows =
    shapSummary?.shap_summary ||
    shapSummary?.records ||
    findArrayDeep(shapSummary, [
      "shap_summary",
      "mean_abs_shap",
      "records",
      "rows",
      "data",
    ]) ||
    [];

  const shapByFeature = new Map<string, any>();

  shapRows.forEach((row: any) => {
    const feature = formatText(row.feature ?? row.variable ?? row.name);
    shapByFeature.set(feature, row);
  });

  const normalized = rows.map((row: any, index: number) => {
    const feature = formatText(row.feature ?? row.variable ?? row.name);
    const shap = shapByFeature.get(feature) || {};

    return {
      feature,
      rank: toNumber(row.rank ?? index + 1) ?? index + 1,
      importance:
        toNumber(
          row.importance ??
            row.feature_importance ??
            row.normalized_importance ??
            row.gain ??
            shap.mean_abs_shap
        ) ?? undefined,
      gain: toNumber(row.gain) ?? undefined,
      weight: toNumber(row.weight) ?? undefined,
      cover: toNumber(row.cover) ?? undefined,
      mean_abs_shap:
        toNumber(shap.mean_abs_shap ?? row.mean_abs_shap ?? row.shap_value) ??
        undefined,
      ...row,
      ...shap,
    };
  });

  if (normalized.length > 0) {
    return normalized.sort(
      (a: ImportanceRow, b: ImportanceRow) =>
        Number(a.rank ?? 9999) - Number(b.rank ?? 9999)
    );
  }

  return shapRows.map((row: any, index: number) => ({
    feature: formatText(row.feature ?? row.variable ?? row.name),
    rank: index + 1,
    importance: toNumber(row.mean_abs_shap ?? row.importance) ?? undefined,
    mean_abs_shap: toNumber(row.mean_abs_shap) ?? undefined,
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

function XgboostAnimation() {
  return (
    <div className="relative min-h-[310px] overflow-hidden rounded-[2rem] border border-yellow-400/20 bg-[#050b16] p-6">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute left-8 top-12 h-2 w-2 animate-ping rounded-full bg-yellow-300" />
        <div className="absolute right-16 top-24 h-2 w-2 animate-pulse rounded-full bg-blue-300" />
        <div className="absolute bottom-16 left-1/2 h-2 w-2 animate-ping rounded-full bg-emerald-300" />
      </div>

      <div className="relative z-10">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-yellow-300">
          Notebook 09 Flow
        </p>

        <h3 className="mt-3 text-3xl font-black text-white">
          XGBoost Candidate
        </h3>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          This notebook tests a tree-based candidate using lagged and engineered
          features. It is powerful, but must be explained carefully and compared
          fairly in Notebook 11.
        </p>

        <div className="mt-7 grid gap-3">
          {[
            ["01", "Load model-ready feature matrix"],
            ["02", "Exclude high_yield from main model"],
            ["03", "Train tree-based candidates"],
            ["04", "Export forecast path and interpretability"],
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
          Gradient-Boosted Trees
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          XGBoost combines many small decision trees. Each new tree tries to
          correct errors left by earlier trees, which can capture nonlinear
          relationships between gold and its features.
        </p>

        <div className="mt-5 rounded-3xl border border-yellow-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Model Family
          </p>
          <p className="mt-3 text-2xl font-black text-slate-950">
            Boosted Regression Trees
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
          Forecast Safety
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Time-Based Splits
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          XGBoost must not use random train/test splits for this project. The
          notebook uses chronological train, validation, and test windows.
        </p>

        <div className="mt-5 rounded-3xl border border-blue-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Professor-Safe Rule
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Performance is only meaningful if compared with the same validation
            and test windows used by the other models.
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
          Interpretability
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Feature Importance + SHAP
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          Tree models are less transparent than OLS. This page therefore shows
          feature importance and SHAP-style summaries where exported.
        </p>

        <div className="mt-5 rounded-3xl border border-emerald-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Caveat
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Importance is not the same as causality.
          </p>
        </div>
      </div>
    </div>
  );
}

function NotebookWorkflow() {
  const steps = [
    {
      title: "Load Feature Matrix",
      detail:
        "Notebook 09 uses the feature-engineered model-ready data from the earlier pipeline.",
    },
    {
      title: "Respect Cutoff",
      detail:
        "Official training and testing are limited to the locked forecast cutoff logic.",
    },
    {
      title: "Exclude high_yield",
      detail:
        "high_yield is not part of the main XGBoost model because its usable history starts too late.",
    },
    {
      title: "Train Candidate Models",
      detail:
        "The notebook tests tree-based configurations and selects from validation performance.",
    },
    {
      title: "Export Forecast Path",
      detail:
        "The page uses forecast-path JSON to render actual-vs-forecast and residual charts.",
    },
    {
      title: "Export Interpretability",
      detail:
        "Feature importance and SHAP summaries are exported separately so the page can explain drivers without hardcoding.",
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
}: {
  features: string[];
  excluded: string[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6 lg:col-span-2">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
          Model Features
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Feature Set Used by XGBoost
        </h3>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          Features are read from the model artifact. If this list is empty, the
          current artifact did not export a feature list.
        </p>

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
              No feature list was exported.
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
      <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Candidate</th>
            <th className="px-4 py-3">Model Type</th>
            <th className="px-4 py-3">Feature Set</th>
            <th className="px-4 py-3">Split</th>
            <th className="px-4 py-3">n</th>
            <th className="px-4 py-3">MAE</th>
            <th className="px-4 py-3">MSE</th>
            <th className="px-4 py-3">RMSE</th>
            <th className="px-4 py-3">MAPE</th>
            <th className="px-4 py-3">R²</th>
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
                {formatText(row.model_type)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.feature_set)}
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
                {formatNumber(row.R2, 4)}
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
                  Exported XGBoost metrics for this candidate and split.
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
                    <th className="px-4 py-3">Feature Set</th>
                    <th className="px-4 py-3">n</th>
                    <th className="px-4 py-3">MAE</th>
                    <th className="px-4 py-3">RMSE</th>
                    <th className="px-4 py-3">MAPE</th>
                    <th className="px-4 py-3">R²</th>
                    <th className="px-4 py-3">Direction %</th>
                  </tr>
                </thead>

                <tbody>
                  {candidateRows.map((row, index) => (
                    <tr key={index} className="border-t border-slate-200">
                      <td className="px-4 py-4 text-slate-700">
                        {formatText(row.feature_set)}
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
                        {formatNumber(row.R2, 4)}
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

function FeatureImportanceTable({ rows }: { rows: ImportanceRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No feature-importance or SHAP summary rows were exported in the current
        XGBoost artifacts.
      </div>
    );
  }

  const previewRows = rows.slice(0, 20);

  return (
    <div className="overflow-auto rounded-3xl border border-slate-200">
      <table className="w-full min-w-[950px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Feature</th>
            <th className="px-4 py-3">Importance</th>
            <th className="px-4 py-3">Mean Abs SHAP</th>
            <th className="px-4 py-3">Gain</th>
            <th className="px-4 py-3">Weight</th>
            <th className="px-4 py-3">Cover</th>
          </tr>
        </thead>

        <tbody>
          {previewRows.map((row, index) => (
            <tr key={`${row.feature}-${index}`} className="border-t border-slate-200">
              <td className="px-4 py-4 font-black text-slate-950">
                {formatNumber(row.rank ?? index + 1, 0)}
              </td>
              <td className="px-4 py-4 font-black text-slate-950">
                {formatText(row.feature)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.importance, 6)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber((row as any).mean_abs_shap, 6)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.gain, 6)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.weight, 6)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.cover, 6)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeatureImportanceCards({ rows }: { rows: ImportanceRow[] }) {
  const topRows = rows.slice(0, 6);

  if (topRows.length === 0) return null;

  const maxValue = Math.max(
    ...topRows.map((row) => Number(row.importance ?? (row as any).mean_abs_shap ?? 0)),
    1
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {topRows.map((row, index) => {
        const value = Number(row.importance ?? (row as any).mean_abs_shap ?? 0);
        const width = Math.max(8, (value / maxValue) * 100);

        return (
          <div
            key={`${row.feature}-${index}`}
            className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">
                  Rank {index + 1}
                </p>
                <h3 className="mt-2 text-xl font-black text-slate-950">
                  {formatText(row.feature)}
                </h3>
              </div>
              <p className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-700">
                {formatNumber(value, 4)}
              </p>
            </div>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${width}%` }}
              />
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Importance/SHAP value from exported interpretability artifact.
              This is model influence, not causality.
            </p>
          </div>
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
            <th className="px-4 py-3">Actual</th>
            <th className="px-4 py-3">Forecast</th>
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

function NotesBlock({ xgboostResults, pageData }: any) {
  const notes = [
    ...findArrayDeep(xgboostResults, ["interpretation_notes", "methodology_notes"]),
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

export default async function XgboostPage() {
  const results = await loadArtifacts();

  const pageData = getArtifact(results, "pageXgboost");
  const xgboostResults = getArtifact(results, "xgboostResults");
  const xgboostForecastPath = getArtifact(results, "xgboostForecastPath");
  const xgboostFeatureImportance = getArtifact(results, "xgboostFeatureImportance");
  const xgboostShapSummary = getArtifact(results, "xgboostShapSummary");
  const forecastStatus = getArtifact(results, "forecastStatus");
  const modelWindowPlan = getArtifact(results, "modelWindowPlan");

  const loadedCount = results.filter((item) => item.ok).length;

  const dataset = getDataset(xgboostResults, pageData);
  const splits = getSplits(xgboostResults, pageData);

  const selectedModel =
    xgboostResults?.selected_model ||
    xgboostResults?.best_model ||
    pageData?.selected_model ||
    {};

  const selectedCandidateId =
    selectedModel?.candidate_id ||
    selectedModel?.model_name ||
    selectedModel?.model ||
    "Selected XGBoost Candidate";

  const selectedModelType =
    selectedModel?.model_type || selectedModel?.type || "XGBoost Regressor";

  const selectedFeatureSet =
    selectedModel?.feature_set ||
    selectedModel?.features_name ||
    dataset?.feature_set ||
    "—";

  const selectedFeatures = Array.isArray(selectedModel?.features)
    ? selectedModel.features
    : Array.isArray(xgboostResults?.selected_features)
      ? xgboostResults.selected_features
      : Array.isArray(pageData?.selected_features)
        ? pageData.selected_features
        : [];

  const excludedVariables = Array.isArray(xgboostResults?.excluded_variables)
    ? xgboostResults.excluded_variables
    : Array.isArray(pageData?.excluded_features)
      ? pageData.excluded_features
      : ["high_yield"];

  const validationMetrics =
    selectedModel?.validation_metrics ||
    xgboostResults?.validation_metrics ||
    {};

  const testMetrics =
    selectedModel?.test_metrics ||
    selectedModel?.test_metrics_rolling ||
    xgboostResults?.test_metrics ||
    {};

  const metricRows = normalizeMetricRows(xgboostResults, pageData);
  const validationRows = normalizeValidationRows(metricRows);
  const chartRows = buildForecastRows(xgboostForecastPath, xgboostResults);
  const recentRows = chartRows.slice(-90);
  const importanceRows = normalizeImportanceRows(
    xgboostFeatureImportance,
    xgboostShapSummary
  );

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

  const pageTitle = pageData?.page_title || "XGBoost Forecasting Candidate";

  const pageSubtitle =
    pageData?.page_subtitle ||
    "Tree-based gold forecasting candidate with validation/test metrics and interpretability artifacts.";

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
                Tree-Based Candidate
              </span>

              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-100">
                Feature Importance + SHAP
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

          <XgboostAnimation />
        </div>
      </section>

      <section className="px-6 py-12 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl space-y-10">
          <CardShell>
            <SectionTitle
              eyebrow="Method Foundation"
              title="What XGBoost Forecasting Does"
              subtitle="Notebook 09 adds a nonlinear tree-based candidate while preserving the JSON-first and professor-safe workflow."
            />

            <MethodExplanationCards />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Notebook Workflow"
              title="Colab Logic Converted to Website Sections"
              subtitle="The page shows the same order as the notebook: data, model setup, metrics, charts, residuals, and interpretability."
            />

            <NotebookWorkflow />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Feature Policy"
              title="Model Features and Excluded Variables"
              subtitle="Features are read from the XGBoost artifacts. high_yield remains excluded from the main model unless treated later as short-window sensitivity."
            />

            <FeaturePolicyBlock
              features={selectedFeatures}
              excluded={excludedVariables}
            />
          </CardShell>

          <div className="grid gap-10 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-yellow-200 bg-yellow-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-700">
                Selected XGBoost Candidate
              </p>
              <h3 className="mt-3 text-3xl font-black text-slate-950">
                {formatText(selectedCandidateId)}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                This is the selected XGBoost candidate from Notebook 09. It is
                not the final project winner until Notebook 11 compares all
                models using the same validation and test framework.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Model Type
                  </p>
                  <p className="mt-1 break-words text-lg font-black text-slate-950">
                    {formatText(selectedModelType)}
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
                {formatText(selectedFeatureSet)}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                Hyperparameters and feature-set details are read from the
                selected model object when exported.
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
                    XGBoost candidate.
                  </div>
                )}
              </div>
            </div>
          </div>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 01"
              title="Actual vs XGBoost Forecast"
              subtitle="This chart is generated from xgboost_forecast_path.json."
            />

            <ActualVsForecastChart
              title="Actual Gold Price vs XGBoost Forecast"
              rows={chartRows}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="forecast"
              forecastLabel="XGBoost Forecast"
              yAxisLabel="Gold Price (USD/oz)"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 02"
              title="XGBoost Forecast Residuals"
              subtitle="Residual = actual gold price minus XGBoost forecast."
            />

            <ResidualChart
              title="XGBoost Forecast Residuals"
              rows={chartRows}
              actualKey="actual"
              forecastKey="forecast"
              forecastLabel="XGBoost Forecast"
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
              title="Recent Test Window: Actual vs XGBoost"
              rows={recentRows}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="forecast"
              forecastLabel="XGBoost Forecast"
              yAxisLabel="Gold Price (USD/oz)"
              showSplitMarkers={false}
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Output Table"
              title="XGBoost Forecast Metrics and Candidate Leaderboard"
              subtitle="This table is built from selected metrics and candidate leaderboard rows when exported."
            />

            <MetricsTable rows={metricRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 04"
              title="Validation Error Comparison"
              subtitle="This compares validation MAE and RMSE across XGBoost candidates when exported."
            />

            <MetricComparisonChart
              rows={validationRows}
              title="XGBoost Candidate Validation Error Comparison"
              subtitle="Validation MAE and RMSE by candidate. Lower error is better."
              split="validation"
              xKey="model_name"
              xLabel="XGBoost Candidate"
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
              eyebrow="Interpretability"
              title="Top Feature Importance / SHAP Drivers"
              subtitle="These cards are generated from xgboost_feature_importance.json and xgboost_shap_summary.json when available."
            />

            <FeatureImportanceCards rows={importanceRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Interpretability Table"
              title="Feature Importance and SHAP Summary"
              subtitle="Importance fields explain model influence, not causal relationships."
            />

            <FeatureImportanceTable rows={importanceRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Forecast Path Preview"
              title="Chart Data Preview"
              subtitle="This preview uses the same XGBoost forecast-path rows that feed the visual charts."
            />

            <ForecastPreviewTable rows={chartRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Professor Interpretation"
              title="How to Explain These Results"
              subtitle="This page keeps XGBoost interpretation conservative and does not claim final model superiority before Notebook 11."
            />

            <NotesBlock xgboostResults={xgboostResults} pageData={pageData} />

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why XGBoost is useful
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  XGBoost can capture nonlinear relationships and interactions
                  that linear regression and classical ARIMA-style models may
                  miss.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why overfitting risk matters
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Tree-based models can fit historical patterns strongly. The
                  validation/test split and final Notebook 11 comparison are
                  necessary to judge whether the model generalizes.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why feature importance needs caution
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Feature importance and SHAP values show model influence, not
                  causal proof. They should be used as interpretability aids,
                  not as standalone economic conclusions.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Professor-safe conclusion
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  XGBoost is a candidate model. Final ranking still belongs to
                  Notebook 11 after all models are compared under the same
                  validation and test framework.
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
              <SourcePreview title="page_xgboost.json" data={pageData} />
              <SourcePreview title="xgboost_results.json" data={xgboostResults} />
              <SourcePreview title="xgboost_forecast_path.json" data={xgboostForecastPath} />
              <SourcePreview
                title="xgboost_feature_importance.json"
                data={xgboostFeatureImportance}
              />
              <SourcePreview title="xgboost_shap_summary.json" data={xgboostShapSummary} />
              <SourcePreview title="model_window_plan.json" data={modelWindowPlan} />
            </div>
          </CardShell>
        </div>
      </section>
    </main>
  );
}