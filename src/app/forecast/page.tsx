import type { ReactNode } from "react";
import { promises as fs } from "fs";
import path from "path";
import {
  ActualVsForecastChart,
  ResidualChart,
  type ForecastChartRow,
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

const PAGE_ARTIFACTS: ArtifactRequest[] = [
  {
    key: "pageOfficialForecast",
    label: "Page Official Forecast",
    path: "artifacts/pages/page_official_forecast.json",
  },
  {
    key: "officialForecast",
    label: "Official Forecast",
    path: "artifacts/forecast/official_forecast.json",
  },
  {
    key: "selectedModelSummary",
    label: "Selected Model Summary",
    path: "artifacts/validation/selected_model_summary.json",
  },
  {
    key: "modelRanking",
    label: "Model Ranking",
    path: "artifacts/validation/model_ranking.json",
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

function getOfficialRecords(officialForecast: any) {
  return (
    officialForecast?.records ||
    officialForecast?.forecast_records ||
    officialForecast?.data ||
    findArrayDeep(officialForecast, ["records", "forecast_records", "data", "rows"]) ||
    []
  );
}

function getFutureRecords(officialForecast: any) {
  return (
    officialForecast?.future_records_after_cutoff ||
    officialForecast?.future_records ||
    findArrayDeep(officialForecast, [
      "future_records_after_cutoff",
      "future_records",
    ]) ||
    []
  );
}

function buildForecastRows(officialForecast: any): ForecastChartRow[] {
  const records = getOfficialRecords(officialForecast);

  return records
    .map((row: any) => {
      const actual =
        row.actual_gold_price ??
        row.actual ??
        row.gold_price ??
        row.y ??
        row.observed;

      const forecast =
        row.official_forecast ??
        row.forecast ??
        row.prediction ??
        row.predicted ??
        row.yhat;

      const lower =
        row.forecast_lower ??
        row.lower ??
        row.lower_bound ??
        row.yhat_lower;

      const upper =
        row.forecast_upper ??
        row.upper ??
        row.upper_bound ??
        row.yhat_upper;

      const residual =
        actual !== null &&
        actual !== undefined &&
        forecast !== null &&
        forecast !== undefined
          ? Number(actual) - Number(forecast)
          : null;

      return {
        date: formatText(row.date || row.ds || row.timestamp),
        split: row.split || row.period || "official_forecast_path",
        actual: toNumber(actual),
        forecast: toNumber(forecast),
        lower: toNumber(lower),
        upper: toNumber(upper),
        residual: toNumber(residual),
        source_model_label: row.source_model_label,
        selected_model_key: row.selected_model_key,
        selected_model_name: row.selected_model_name,
      };
    })
    .filter((row: any) => row.date !== "—" && row.forecast !== null);
}

function getChartRowsWithActual(rows: ForecastChartRow[]) {
  return rows.filter((row) => row.actual !== null && row.forecast !== null);
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

function ForecastAnimation() {
  return (
    <div className="relative min-h-[310px] overflow-hidden rounded-[2rem] border border-yellow-400/20 bg-[#050b16] p-6">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute left-8 top-12 h-2 w-2 animate-ping rounded-full bg-yellow-300" />
        <div className="absolute right-16 top-24 h-2 w-2 animate-pulse rounded-full bg-blue-300" />
        <div className="absolute bottom-16 left-1/2 h-2 w-2 animate-ping rounded-full bg-emerald-300" />
      </div>

      <div className="relative z-10">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-yellow-300">
          Notebook 12 Flow
        </p>

        <h3 className="mt-3 text-3xl font-black text-white">
          Official Forecast Export
        </h3>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          Notebook 12 reads Notebook 11’s selected model, detects its forecast
          source artifact, standardizes the forecast table, and exports the
          official JSON for this page.
        </p>

        <div className="mt-7 grid gap-3">
          {[
            ["01", "Read selected_model_summary.json"],
            ["02", "Detect selected model forecast path"],
            ["03", "Standardize date / actual / forecast fields"],
            ["04", "Export official_forecast.json"],
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
          Export the Official Forecast
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          This page is not choosing the winner. It displays the forecast
          exported by Notebook 12 using the model selected by Notebook 11.
        </p>
      </div>

      <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
          JSON-First Rule
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          No Hardcoded Winner
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          Selected model, record counts, forecast source, warnings, and
          interpretation notes are all read from official_forecast.json and
          page_official_forecast.json.
        </p>
      </div>

      <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
          Professor Safety
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Show Export Status
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          If no future records exist after the cutoff, the page says so instead
          of inventing a post-cutoff forecast.
        </p>
      </div>
    </div>
  );
}

function FutureForecastTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No records after the official cutoff date were detected in
        official_forecast.json. The forecast path may still exist for historical
        or test-period display.
      </div>
    );
  }

  const previewRows = rows.slice(0, 30);

  return (
    <div className="overflow-auto rounded-3xl border border-slate-200">
      <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Official Forecast</th>
            <th className="px-4 py-3">Lower Bound</th>
            <th className="px-4 py-3">Upper Bound</th>
            <th className="px-4 py-3">Split</th>
            <th className="px-4 py-3">Selected Model</th>
          </tr>
        </thead>

        <tbody>
          {previewRows.map((row: any, index: number) => (
            <tr key={index} className="border-t border-slate-200">
              <td className="px-4 py-4 font-black text-slate-950">
                {formatText(row.date)}
              </td>
              <td className="px-4 py-4 font-black text-slate-950">
                {formatNumber(row.official_forecast ?? row.forecast, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.forecast_lower ?? row.lower, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.forecast_upper ?? row.upper, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.split)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.selected_model_name || row.source_model_label)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ForecastPathTable({ rows }: { rows: ForecastChartRow[] }) {
  const previewRows = rows.slice(-30);

  if (previewRows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        official_forecast.json loaded, but no standardized records were
        detected.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-3xl border border-slate-200">
      <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Split</th>
            <th className="px-4 py-3">Actual Gold Price</th>
            <th className="px-4 py-3">Official Forecast</th>
            <th className="px-4 py-3">Lower</th>
            <th className="px-4 py-3">Upper</th>
            <th className="px-4 py-3">Selected Model</th>
          </tr>
        </thead>

        <tbody>
          {previewRows.map((row: any, index: number) => (
            <tr key={index} className="border-t border-slate-200">
              <td className="px-4 py-4 font-black text-slate-950">
                {formatText(row.date)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.split)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.actual, 4)}
              </td>
              <td className="px-4 py-4 font-black text-slate-950">
                {formatNumber(row.forecast, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.lower, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatNumber(row.upper, 4)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatText(row.selected_model_name || row.source_model_label)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WarningsBlock({ warnings }: { warnings: any[] }) {
  if (!warnings || warnings.length === 0) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-7 text-slate-700">
        No warnings were exported by Notebook 12.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {warnings.map((warning, index) => (
        <div
          key={index}
          className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700"
        >
          {formatText(warning)}
        </div>
      ))}
    </div>
  );
}

function InterpretationBlock({
  officialForecast,
  pageData,
}: {
  officialForecast: any;
  pageData: any;
}) {
  const notes = [
    ...(Array.isArray(officialForecast?.professor_safe_interpretation)
      ? officialForecast.professor_safe_interpretation
      : []),
    ...(Array.isArray(pageData?.professor_safe_interpretation)
      ? pageData.professor_safe_interpretation
      : []),
    ...(Array.isArray(pageData?.summary_points) ? pageData.summary_points : []),
  ]
    .map(formatText)
    .filter((item) => item !== "—" && !item.startsWith("{"));

  const uniqueNotes = Array.from(new Set(notes));

  if (uniqueNotes.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No professor-safe interpretation notes were exported. The page will not
        invent unsupported conclusions.
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
          {note}
        </div>
      ))}
    </div>
  );
}

export default async function FinalForecastPage() {
  const results = await loadArtifacts();

  const pageData = getArtifact(results, "pageOfficialForecast");
  const officialForecast = getArtifact(results, "officialForecast");
  const selectedModelSummary = getArtifact(results, "selectedModelSummary");
  const modelRanking = getArtifact(results, "modelRanking");
  const forecastStatus = getArtifact(results, "forecastStatus");
  const modelWindowPlan = getArtifact(results, "modelWindowPlan");

  const loadedCount = results.filter((item) => item.ok).length;

  const selectedModel =
    officialForecast?.selected_model ||
    pageData?.selected_model ||
    selectedModelSummary?.selected_model ||
    {};

  const recordCounts = officialForecast?.record_counts || {};
  const latestRecord = officialForecast?.latest_record || {};
  const nextForecastAfterCutoff =
    officialForecast?.next_forecast_after_cutoff || null;

  const chartRows = buildForecastRows(officialForecast);
  const chartRowsWithActual = getChartRowsWithActual(chartRows);
  const futureRecords = getFutureRecords(officialForecast);

  const exportStatus =
    officialForecast?.export_status ||
    pageData?.export_status ||
    "missing_or_not_exported";

  const officialCutoff =
    officialForecast?.official_forecast_cutoff_date ||
    pageData?.official_forecast_cutoff_date ||
    findValueDeep(forecastStatus, [
      "official_forecast_cutoff_date",
      "officialForecastCutoffDate",
      "cutoff_date",
      "cutoffDate",
      "official_cutoff",
      "officialCutoff",
    ]) ||
    "2026-03-31";

  const pageTitle = pageData?.page_title || "Official Gold Forecast";

  const pageSubtitle =
    pageData?.page_subtitle ||
    "Selected-model forecast exported from the validation pipeline.";

  const forecastSource = officialForecast?.forecast_source || {};
  const standardizationNotes = forecastSource?.standardization_notes || {};

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
                Export Status: {formatText(exportStatus)}
              </span>

              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-100">
                JSON-Selected Forecast
              </span>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-4">
              <DarkKpiCard
                label="Selected Model"
                value={selectedModel?.model_name || selectedModel?.model_key}
              />
              <DarkKpiCard
                label="Primary RMSE"
                value={selectedModel?.primary_rmse}
              />
              <DarkKpiCard
                label="Official Cutoff"
                value={officialCutoff}
              />
              <DarkKpiCard
                label="Forecast Records"
                value={recordCounts?.total_records}
              />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <DarkKpiCard
                label="Historical/Test Records"
                value={recordCounts?.records_on_or_before_cutoff}
              />
              <DarkKpiCard
                label="Future Records"
                value={recordCounts?.records_after_cutoff}
              />
              <DarkKpiCard
                label="Latest Forecast"
                value={latestRecord?.official_forecast}
                note={latestRecord?.date ? `Date: ${latestRecord.date}` : undefined}
              />
            </div>
          </div>

          <ForecastAnimation />
        </div>
      </section>

      <section className="px-6 py-12 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl space-y-10">
          <CardShell>
            <SectionTitle
              eyebrow="Method Foundation"
              title="What Notebook 12 Does"
              subtitle="Notebook 12 reads the selected model from Notebook 11 and exports the official forecast artifact for the frontend."
            />

            <MethodExplanationCards />
          </CardShell>

          <div className="grid gap-10 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-yellow-200 bg-yellow-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-700">
                Official Selected Model
              </p>
              <h3 className="mt-3 text-3xl font-black text-slate-950">
                {formatText(selectedModel?.model_name || selectedModel?.model_key)}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                This selected model is read from Notebook 11 artifacts and
                carried into official_forecast.json by Notebook 12.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Model Key
                  </p>
                  <p className="mt-1 break-words text-lg font-black text-slate-950">
                    {formatText(selectedModel?.model_key)}
                  </p>
                </div>

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
                Next Forecast After Cutoff
              </p>
              <h3 className="mt-3 text-3xl font-black text-slate-950">
                {nextForecastAfterCutoff
                  ? formatText(nextForecastAfterCutoff?.date)
                  : "No Post-Cutoff Record"}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                If no post-cutoff record is exported, the frontend must show
                that honestly instead of inventing future values.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Forecast
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(
                      nextForecastAfterCutoff?.official_forecast ??
                        nextForecastAfterCutoff?.forecast,
                      4
                    )}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Lower
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(
                      nextForecastAfterCutoff?.forecast_lower ??
                        nextForecastAfterCutoff?.lower,
                      4
                    )}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Upper
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatNumber(
                      nextForecastAfterCutoff?.forecast_upper ??
                        nextForecastAfterCutoff?.upper,
                      4
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <CardShell>
            <SectionTitle
              eyebrow="Official Forecast Chart"
              title="Actual Gold Price vs Official Forecast"
              subtitle="This chart uses official_forecast.json. Rows without actual values are shown in tables, while actual-vs-forecast diagnostics require actual values."
            />

            <ActualVsForecastChart
              title="Actual Gold Price vs Official Forecast"
              rows={chartRowsWithActual}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="forecast"
              forecastLabel="Official Forecast"
              yAxisLabel="Gold Price (USD/oz)"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Residual Diagnostic"
              title="Official Forecast Residuals"
              subtitle="Residual = actual gold price minus official forecast. Future records without actual values are not included in this diagnostic."
            />

            <ResidualChart
              title="Official Forecast Residuals"
              rows={chartRowsWithActual}
              actualKey="actual"
              forecastKey="forecast"
              forecastLabel="Official Forecast"
              yAxisLabel="Actual - Forecast"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Future Forecast Table"
              title="Records After the Official Cutoff"
              subtitle="This table displays only future_records_after_cutoff from official_forecast.json."
            />

            <FutureForecastTable rows={futureRecords} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Forecast Path Table"
              title="Recent Official Forecast Path Records"
              subtitle="This table shows the most recent standardized records from official_forecast.json."
            />

            <ForecastPathTable rows={chartRows} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Export Diagnostics"
              title="Forecast Source and Standardization"
              subtitle="Notebook 12 detects the source forecast artifact and standardizes its columns."
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Source Path
                </p>
                <p className="mt-3 break-words text-lg font-black text-slate-950">
                  {formatText(forecastSource?.path)}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Standardization Status
                </p>
                <p className="mt-3 break-words text-lg font-black text-slate-950">
                  {formatText(standardizationNotes?.status)}
                </p>
              </div>

              {Object.entries(standardizationNotes || {}).map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                >
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                    {key}
                  </p>
                  <p className="mt-3 break-words text-lg font-black text-slate-950">
                    {formatText(value)}
                  </p>
                </div>
              ))}
            </div>
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Warnings"
              title="Notebook 12 Export Warnings"
              subtitle="Warnings are displayed directly from official_forecast.json."
            />

            <WarningsBlock warnings={officialForecast?.warnings || []} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Professor Interpretation"
              title="How to Explain the Official Forecast"
              subtitle="These notes are read from the official forecast artifacts."
            />

            <InterpretationBlock
              officialForecast={officialForecast}
              pageData={pageData}
            />

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why this page is final
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  This page uses the selected model from Notebook 11 and the
                  official export from Notebook 12. It is the presentation-ready
                  forecast page.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why no hardcoding matters
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  If Notebook 11 selects a different model later, Notebook 12 can
                  regenerate the official forecast and the frontend will update
                  from JSON.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why missing future rows are allowed
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Some model forecast-path artifacts may contain only validation
                  or test rows. In that case, this page shows the export warning
                  instead of inventing future forecasts.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Professor-safe conclusion
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  The official forecast is evidence-based, artifact-driven, and
                  traceable back to the model comparison notebook.
                </p>
              </div>
            </div>
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Artifact Status"
              title="JSON Sources Used by This Page"
              subtitle="Every final forecast value must come from JSON artifacts."
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
                title="page_official_forecast.json"
                data={pageData}
              />
              <SourcePreview
                title="official_forecast.json"
                data={officialForecast}
              />
              <SourcePreview
                title="selected_model_summary.json"
                data={selectedModelSummary}
              />
              <SourcePreview title="model_ranking.json" data={modelRanking} />
              <SourcePreview title="model_window_plan.json" data={modelWindowPlan} />
            </div>
          </CardShell>
        </div>
      </section>
    </main>
  );
}