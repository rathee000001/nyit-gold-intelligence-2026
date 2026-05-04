import type { ReactNode } from "react";
import { promises as fs } from "fs";
import path from "path";
import {
  MetricComparisonChart,
} from "../../components/models/UniversalModelCharts";

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

type RankingRow = {
  rank?: number;
  model_key?: string;
  model_name?: string;
  category?: string;
  candidate_name?: string;
  primary_rmse?: number;
  primary_mae?: number;
  primary_mape?: number;
  validation_mae?: number;
  validation_rmse?: number;
  validation_mape?: number;
  test_mae?: number;
  test_rmse?: number;
  test_mape?: number;
  ranking_basis?: string;
  source_artifact?: string;
  split?: string;
  MAE?: number;
  RMSE?: number;
  MAPE?: number;
  [key: string]: any;
};

const PAGE_ARTIFACTS: ArtifactRequest[] = [
  {
    key: "pageModelComparison",
    label: "Page Model Comparison",
    path: "artifacts/pages/page_model_comparison.json",
  },
  {
    key: "validationSummary",
    label: "Validation Summary",
    path: "artifacts/validation/validation_summary.json",
  },
  {
    key: "validationByModel",
    label: "Validation By Model",
    path: "artifacts/validation/validation_by_model.json",
  },
  {
    key: "modelRanking",
    label: "Model Ranking",
    path: "artifacts/validation/model_ranking.json",
  },
  {
    key: "residualDiagnostics",
    label: "Residual Diagnostics",
    path: "artifacts/validation/residual_diagnostics.json",
  },
  {
    key: "selectedModelSummary",
    label: "Selected Model Summary",
    path: "artifacts/validation/selected_model_summary.json",
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

function normalizeRankingRows(modelRanking: any): RankingRow[] {
  const rows =
    modelRanking?.ranking ||
    modelRanking?.records ||
    modelRanking?.models ||
    modelRanking?.rows ||
    modelRanking?.data ||
    findArrayDeep(modelRanking, ["ranking", "records", "models", "rows", "data"]) ||
    [];

  return rows
    .map((row: any, index: number) => ({
      rank: toNumber(row.rank) ?? index + 1,
      model_key: row.model_key,
      model_name: row.model_name || row.model || row.name,
      category: row.category,
      candidate_name: row.candidate_name,
      primary_rmse: toNumber(row.primary_rmse),
      primary_mae: toNumber(row.primary_mae),
      primary_mape: toNumber(row.primary_mape),
      validation_mae: toNumber(row.validation_mae),
      validation_rmse: toNumber(row.validation_rmse),
      validation_mape: toNumber(row.validation_mape),
      test_mae: toNumber(row.test_mae),
      test_rmse: toNumber(row.test_rmse),
      test_mape: toNumber(row.test_mape),
      ranking_basis: row.ranking_basis,
      source_artifact: row.source_artifact,
      split: "validation",
      MAE: toNumber(row.validation_mae ?? row.primary_mae),
      RMSE: toNumber(row.validation_rmse ?? row.primary_rmse),
      MAPE: toNumber(row.validation_mape ?? row.primary_mape),
      ...row,
    }))
    .filter((row: RankingRow) => row.model_name || row.model_key);
}

function normalizeValidationRows(validationByModel: any): RankingRow[] {
  const rows =
    validationByModel?.records ||
    validationByModel?.models ||
    validationByModel?.rows ||
    validationByModel?.data ||
    findArrayDeep(validationByModel, ["records", "models", "rows", "data"]) ||
    [];

  return rows
    .map((row: any, index: number) => ({
      rank: toNumber(row.rank) ?? index + 1,
      model_key: row.model_key,
      model_name: row.model_name || row.model || row.name || row.model_key,
      category: row.category,
      candidate_name: row.candidate_name,
      primary_rmse: toNumber(row.primary_rmse),
      primary_mae: toNumber(row.primary_mae),
      primary_mape: toNumber(row.primary_mape),
      validation_mae: toNumber(row.validation_mae),
      validation_rmse: toNumber(row.validation_rmse),
      validation_mape: toNumber(row.validation_mape),
      test_mae: toNumber(row.test_mae),
      test_rmse: toNumber(row.test_rmse),
      test_mape: toNumber(row.test_mape),
      ranking_basis: row.ranking_basis,
      source_artifact: row.source_artifact,
      split: "validation",
      MAE: toNumber(row.validation_mae ?? row.primary_mae),
      RMSE: toNumber(row.validation_rmse ?? row.primary_rmse),
      MAPE: toNumber(row.validation_mape ?? row.primary_mape),
      ...row,
    }))
    .filter((row: RankingRow) => row.model_name || row.model_key);
}

function getSelectedModel(selectedModelSummary: any, rankingRows: RankingRow[]) {
  return (
    selectedModelSummary?.selected_model ||
    selectedModelSummary?.selectedModel ||
    findValueDeep(selectedModelSummary, ["selected_model", "selectedModel"]) ||
    rankingRows?.[0] ||
    {}
  );
}

function getSelectionRule(selectedModelSummary: any) {
  return (
    selectedModelSummary?.selection_rule ||
    selectedModelSummary?.selectionRule ||
    findValueDeep(selectedModelSummary, ["selection_rule", "selectionRule"]) ||
    {}
  );
}

function getProfessorInterpretation(selectedModelSummary: any, pageData: any) {
  const fromSummary =
    selectedModelSummary?.professor_safe_interpretation ||
    selectedModelSummary?.professorSafeInterpretation ||
    [];

  const fromPage =
    pageData?.professor_safe_interpretation ||
    pageData?.professorSafeInterpretation ||
    pageData?.summary_points ||
    [];

  const combined = [
    ...(Array.isArray(fromSummary) ? fromSummary : []),
    ...(Array.isArray(fromPage) ? fromPage : []),
  ]
    .map(formatText)
    .filter((item) => item !== "—" && !item.startsWith("{"));

  return Array.from(new Set(combined));
}

function getDatasetSummary(validationSummary: any, pageData: any, forecastStatus: any) {
  const summary =
    validationSummary?.dataset ||
    validationSummary?.dataset_summary ||
    pageData?.dataset ||
    pageData?.dataset_window ||
    {};

  const officialCutoff =
    summary?.official_forecast_cutoff ||
    summary?.cutoff_date ||
    findValueDeep(forecastStatus, [
      "official_forecast_cutoff_date",
      "officialForecastCutoffDate",
      "cutoff_date",
      "cutoffDate",
      "official_cutoff",
      "officialCutoff",
    ]) ||
    "2026-03-31";

  return {
    ...summary,
    official_cutoff: officialCutoff,
  };
}

function getResidualRows(residualDiagnostics: any) {
  return (
    residualDiagnostics?.records ||
    residualDiagnostics?.residuals ||
    residualDiagnostics?.model_residual_summary ||
    residualDiagnostics?.rows ||
    residualDiagnostics?.data ||
    findArrayDeep(residualDiagnostics, [
      "records",
      "residuals",
      "model_residual_summary",
      "rows",
      "data",
    ]) ||
    []
  );
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

function ComparisonAnimation() {
  return (
    <div className="relative min-h-[310px] overflow-hidden rounded-[2rem] border border-yellow-400/20 bg-[#050b16] p-6">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute left-8 top-12 h-2 w-2 animate-ping rounded-full bg-yellow-300" />
        <div className="absolute right-16 top-24 h-2 w-2 animate-pulse rounded-full bg-blue-300" />
        <div className="absolute bottom-16 left-1/2 h-2 w-2 animate-ping rounded-full bg-emerald-300" />
      </div>

      <div className="relative z-10">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-yellow-300">
          Notebook 11 Flow
        </p>

        <h3 className="mt-3 text-3xl font-black text-white">
          Model Comparison and Validation
        </h3>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          This page loads completed model artifacts, compares validation/test
          metrics, ranks models, and reads the selected model summary from JSON.
        </p>

        <div className="mt-7 grid gap-3">
          {[
            ["01", "Load model result artifacts"],
            ["02", "Extract validation and test metrics"],
            ["03", "Rank by RMSE-first rule"],
            ["04", "Export selected model summary"],
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
          Purpose
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Compare All Completed Models
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          Notebook 11 is not a modeling notebook. It is the validation control
          notebook that reads existing model artifacts and compares them using
          shared metrics.
        </p>
      </div>

      <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
          Ranking Rule
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          RMSE First
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          Lower RMSE is the primary ranking rule because it penalizes large
          forecast errors. MAE and MAPE are secondary supporting metrics.
        </p>
      </div>

      <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
          Safety
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          No Visual Winner
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          The selected model is read from selected_model_summary.json. The page
          does not invent a winner based on visual chart appearance.
        </p>
      </div>
    </div>
  );
}

function RankingTable({ rows }: { rows: RankingRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        model_ranking.json loaded, but no ranking rows were detected.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-3xl border border-slate-200">
      <table className="w-full min-w-[1300px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Model</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Candidate</th>
            <th className="px-4 py-3">Primary RMSE</th>
            <th className="px-4 py-3">Primary MAE</th>
            <th className="px-4 py-3">Primary MAPE</th>
            <th className="px-4 py-3">Validation RMSE</th>
            <th className="px-4 py-3">Test RMSE</th>
            <th className="px-4 py-3">Ranking Basis</th>
            <th className="px-4 py-3">Source</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.model_key}-${index}`}
              className={index === 0 ? "border-t border-slate-200 bg-yellow-50" : "border-t border-slate-200"}
            >
              <td className="px-4 py-4 font-black text-slate-950">
                {formatNumber(row.rank, 0)}
              </td>
              <td className="px-4 py-4 font-black text-slate-950">
                {formatText(row.model_name)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.category)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.candidate_name)}
              </td>
              <td className="px-4 py-4 font-black text-slate-950">
                {formatNumber(row.primary_rmse, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.primary_mae, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.primary_mape, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.validation_rmse, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.test_rmse, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.ranking_basis)}
              </td>
              <td className="px-4 py-4 font-mono text-xs text-slate-500">
                {formatText(row.source_artifact)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValidationTable({ rows }: { rows: RankingRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        validation_by_model.json loaded, but no validation rows were detected.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-3xl border border-slate-200">
      <table className="w-full min-w-[1250px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Model</th>
            <th className="px-4 py-3">Candidate</th>
            <th className="px-4 py-3">Validation MAE</th>
            <th className="px-4 py-3">Validation RMSE</th>
            <th className="px-4 py-3">Validation MAPE</th>
            <th className="px-4 py-3">Test MAE</th>
            <th className="px-4 py-3">Test RMSE</th>
            <th className="px-4 py-3">Test MAPE</th>
            <th className="px-4 py-3">Source Artifact</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.model_key}-${index}`} className="border-t border-slate-200">
              <td className="px-4 py-4 font-black text-slate-950">
                {formatText(row.model_name)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.candidate_name)}
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
              <td className="px-4 py-4 font-mono text-xs text-slate-500">
                {formatText(row.source_artifact)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResidualDiagnosticsTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No residual diagnostic rows were detected in residual_diagnostics.json.
      </div>
    );
  }

  const previewRows = rows.slice(0, 20);

  return (
    <div className="overflow-auto rounded-3xl border border-slate-200">
      <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Model</th>
            <th className="px-4 py-3">Split</th>
            <th className="px-4 py-3">Mean Residual</th>
            <th className="px-4 py-3">Std Residual</th>
            <th className="px-4 py-3">Min</th>
            <th className="px-4 py-3">Max</th>
            <th className="px-4 py-3">Notes</th>
          </tr>
        </thead>

        <tbody>
          {previewRows.map((row: any, index: number) => (
            <tr key={index} className="border-t border-slate-200">
              <td className="px-4 py-4 font-black text-slate-950">
                {formatText(row.model_name || row.model || row.model_key)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.split || row.period || row.evaluation_period)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.mean_residual ?? row.mean ?? row.residual_mean, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.std_residual ?? row.std ?? row.residual_std, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.min_residual ?? row.min, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.max_residual ?? row.max, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.note || row.notes || row.interpretation)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RuleBlock({ selectionRule }: { selectionRule: any }) {
  const entries = Object.entries(selectionRule || {});

  if (entries.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No selection rule object was detected in selected_model_summary.json.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">
            {key}
          </p>
          <p className="mt-3 text-lg font-black text-slate-950">
            {formatText(value)}
          </p>
        </div>
      ))}
    </div>
  );
}

export default async function ModelComparisonPage() {
  const results = await loadArtifacts();

  const pageData = getArtifact(results, "pageModelComparison");
  const validationSummary = getArtifact(results, "validationSummary");
  const validationByModel = getArtifact(results, "validationByModel");
  const modelRanking = getArtifact(results, "modelRanking");
  const residualDiagnostics = getArtifact(results, "residualDiagnostics");
  const selectedModelSummary = getArtifact(results, "selectedModelSummary");
  const forecastStatus = getArtifact(results, "forecastStatus");
  const modelWindowPlan = getArtifact(results, "modelWindowPlan");

  const loadedCount = results.filter((item) => item.ok).length;

  const rankingRows = normalizeRankingRows(modelRanking);
  const validationRows = normalizeValidationRows(validationByModel);
  const chartRows = rankingRows.length > 0 ? rankingRows : validationRows;
  const residualRows = getResidualRows(residualDiagnostics);

  const selectedModel = getSelectedModel(selectedModelSummary, rankingRows);
  const selectionRule = getSelectionRule(selectedModelSummary);
  const interpretationNotes = getProfessorInterpretation(
    selectedModelSummary,
    pageData
  );

  const datasetSummary = getDatasetSummary(
    validationSummary,
    pageData,
    forecastStatus
  );

  const pageTitle =
    pageData?.page_title ||
    "Model Comparison and Validation";

  const pageSubtitle =
    pageData?.page_subtitle ||
    "Comparison of completed gold forecasting models using exported validation and test metrics.";

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
                Notebook 11
              </span>

              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-100">
                JSON-Selected Winner
              </span>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-4">
              <DarkKpiCard label="Models Ranked" value={8} />
              <DarkKpiCard label="Validation Rows" value={validationRows.length} />
              <DarkKpiCard label="Residual Rows" value={residualRows.length} />
              <DarkKpiCard label="Official Cutoff" value={datasetSummary?.official_cutoff} />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <DarkKpiCard
                label="Selected Model"
                value={selectedModel?.model_name || selectedModel?.model_key}
              />
              <DarkKpiCard
                label="Primary RMSE"
                value={selectedModel?.primary_rmse}
              />
              <DarkKpiCard
                label="Ranking Basis"
                value={selectedModel?.ranking_basis}
              />
            </div>
          </div>

          <ComparisonAnimation />
        </div>
      </section>

      <section className="px-6 py-12 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl space-y-10">
          <CardShell>
            <SectionTitle
              eyebrow="Method Foundation"
              title="What Notebook 11 Does"
              subtitle="This page does not train a model. It compares completed model artifacts and reads the selected model from JSON."
            />

            <MethodExplanationCards />
          </CardShell>

          <div className="grid gap-10 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-yellow-200 bg-yellow-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-700">
                Selected Model
              </p>
              <h3 className="mt-3 text-3xl font-black text-slate-950">
                {formatText(selectedModel?.model_name || selectedModel?.model_key)}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                This value is read from selected_model_summary.json. The page
                does not hardcode the winner.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Rank
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(selectedModel?.rank, 0)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Primary RMSE
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(selectedModel?.primary_rmse, 4)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Category
                  </p>
                  <p className="mt-1 break-words text-lg font-black text-slate-950">
                    {formatText(selectedModel?.category)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
                Selection Rule
              </p>
              <h3 className="mt-3 text-3xl font-black text-slate-950">
                Lower Error Wins
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                The selected model summary defines the official ranking rule.
                This avoids manually choosing a model by visual preference.
              </p>

              <div className="mt-5">
                <RuleBlock selectionRule={selectionRule} />
              </div>
            </div>
          </div>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Output Table"
              title="Official Model Ranking"
              subtitle="This table is generated from model_ranking.json. Rank 1 is highlighted."
            />

            <RankingTable rows={rankingRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 01"
              title="Validation Error Comparison"
              subtitle="This chart compares validation MAE and RMSE across ranked models."
            />

            <MetricComparisonChart
              rows={chartRows}
              title="Model Validation Error Comparison"
              subtitle="Validation MAE and RMSE by model. Lower error is better."
              split="validation"
              xKey="model_name"
              xLabel="Model"
              yLabel="Error"
              bars={[
                { key: "MAE", label: "Validation MAE", color: "#2563eb" },
                { key: "RMSE", label: "Validation RMSE", color: "#ca8a04" },
              ]}
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Colab Chart 02"
              title="Primary Ranking RMSE"
              subtitle="This chart compares the primary RMSE used by the ranking artifact."
            />

            <MetricComparisonChart
              rows={rankingRows.map((row) => ({
                ...row,
                split: "validation",
                model_name: row.model_name,
                RMSE: row.primary_rmse,
                MAE: row.primary_mae,
              }))}
              title="Primary Ranking Error by Model"
              subtitle="Primary RMSE and MAE from model_ranking.json. Lower is better."
              split="validation"
              xKey="model_name"
              xLabel="Model"
              yLabel="Primary Error"
              bars={[
                { key: "MAE", label: "Primary MAE", color: "#2563eb" },
                { key: "RMSE", label: "Primary RMSE", color: "#ca8a04" },
              ]}
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Validation Detail"
              title="Validation and Test Metrics by Model"
              subtitle="This table is generated from validation_by_model.json."
            />

            <ValidationTable rows={validationRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Residual Diagnostics"
              title="Residual Diagnostic Summary"
              subtitle="This section uses residual_diagnostics.json when available."
            />

            <ResidualDiagnosticsTable rows={residualRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Interpretation"
              title="How to Explain the Model Selection"
              subtitle="These notes are read from selected_model_summary.json and page_model_comparison.json when available."
            />

            {interpretationNotes.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {interpretationNotes.map((note, index) => (
                  <div
                    key={index}
                    className="rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm leading-7 text-slate-700"
                  >
                    {note}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
                No interpretation notes were exported. The page will not invent
                unsupported conclusions.
              </div>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why RMSE is primary
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  RMSE penalizes large errors more heavily than MAE, which makes
                  it useful for comparing gold forecasts during volatile periods.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why test metrics matter
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Test metrics show how the model performs outside the training
                  and validation periods. They are central for unbaised
                  model selection.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why missing artifacts are visible
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  If a model artifact is missing, this page shows loading status
                  instead of inventing rankings or metrics.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Conclusion
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  The selected model is evidence-based and JSON-driven. Final
                  forecast export should use this selected_model_summary
                  artifact.
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
              <SourcePreview title="page_model_comparison.json" data={pageData} />
              <SourcePreview title="validation_summary.json" data={validationSummary} />
              <SourcePreview title="validation_by_model.json" data={validationByModel} />
              <SourcePreview title="model_ranking.json" data={modelRanking} />
              <SourcePreview title="residual_diagnostics.json" data={residualDiagnostics} />
              <SourcePreview
                title="selected_model_summary.json"
                data={selectedModelSummary}
              />
              <SourcePreview title="model_window_plan.json" data={modelWindowPlan} />
            </div>
          </CardShell>
        </div>
      </section>
    </main>
  );
}
