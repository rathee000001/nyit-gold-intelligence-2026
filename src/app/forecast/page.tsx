import type { ReactNode } from "react";
import { promises as fs } from "fs";
import path from "path";
import {
  ActualVsForecastChart,
  ResidualChart,
  type ForecastChartRow,
} from "../../components/models/UniversalModelCharts";
import FutureForecastBandChart from "../../components/models/FutureForecastBandChart";

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

type OfficialRecord = {
  date: string;
  split?: string;
  actual_gold_price?: number | null;
  official_forecast?: number | null;
  forecast_lower?: number | null;
  forecast_upper?: number | null;
  residual?: number | null;
  absolute_error?: number | null;
  absolute_percentage_error?: number | null;
  inside_95_interval?: boolean | null;
  selected_model_key?: string;
  selected_model_name?: string;
  source_model_label?: string;
  forecast_generation_mode?: string;
  [key: string]: any;
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

function normalizeOfficialRecord(row: any): OfficialRecord {
  const actual = toNumber(
    row.actual_gold_price ??
      row.actual ??
      row.gold_price ??
      row.y ??
      row.observed
  );

  const forecast = toNumber(
    row.official_forecast ??
      row.forecast ??
      row.prediction ??
      row.predicted ??
      row.yhat
  );

  const lower = toNumber(
    row.forecast_lower ?? row.lower ?? row.lower_bound ?? row.yhat_lower
  );

  const upper = toNumber(
    row.forecast_upper ?? row.upper ?? row.upper_bound ?? row.yhat_upper
  );

  const residual =
    toNumber(row.residual) ??
    (actual !== null && forecast !== null ? actual - forecast : null);

  const absoluteError =
    toNumber(row.absolute_error) ??
    (residual !== null ? Math.abs(residual) : null);

  const ape =
    toNumber(row.absolute_percentage_error) ??
    (actual !== null && actual !== 0 && absoluteError !== null
      ? (absoluteError / actual) * 100
      : null);

  const inside95 =
    row.inside_95_interval === true
      ? true
      : row.inside_95_interval === false
      ? false
      : actual !== null && lower !== null && upper !== null
      ? actual >= lower && actual <= upper
      : null;

  return {
    date: formatText(row.date || row.ds || row.timestamp),
    split: row.split || row.period || row.dataset || row.segment,
    actual_gold_price: actual,
    official_forecast: forecast,
    forecast_lower: lower,
    forecast_upper: upper,
    residual,
    absolute_error: absoluteError,
    absolute_percentage_error: ape,
    inside_95_interval: inside95,
    selected_model_key: row.selected_model_key,
    selected_model_name: row.selected_model_name,
    source_model_label: row.source_model_label,
    forecast_generation_mode: row.forecast_generation_mode,
    ...row,
  };
}

function getOfficialRecords(officialForecast: any): OfficialRecord[] {
  const records =
    officialForecast?.records ||
    officialForecast?.forecast_records ||
    officialForecast?.data ||
    [];

  return safeArray(records)
    .map(normalizeOfficialRecord)
    .filter((row) => row.date !== "—" && row.official_forecast !== null);
}

function getFutureRecords(officialForecast: any): OfficialRecord[] {
  const records =
    officialForecast?.future_records_after_cutoff ||
    officialForecast?.future_records ||
    [];

  return safeArray(records)
    .map(normalizeOfficialRecord)
    .filter((row) => row.date !== "—" && row.official_forecast !== null);
}

function buildChartRows(records: OfficialRecord[]): ForecastChartRow[] {
  return records
    .map((row) => {
      const actual = toNumber(row.actual_gold_price);
      const forecast = toNumber(row.official_forecast);

      return {
        date: row.date,
        split: row.split || "official_forecast_path",
        actual,
        forecast,
        lower: toNumber(row.forecast_lower),
        upper: toNumber(row.forecast_upper),
        residual:
          actual !== null && forecast !== null ? actual - forecast : null,
        source_model_label: row.source_model_label,
        selected_model_key: row.selected_model_key,
        selected_model_name: row.selected_model_name,
      };
    })
    .filter((row: any) => row.date !== "—" && row.forecast !== null);
}

function getRowsWithActual(rows: ForecastChartRow[]) {
  return rows.filter((row) => row.actual !== null && row.forecast !== null);
}

function getSelectedModel(
  officialForecast: any,
  pageData: any,
  selectedModelSummary: any
) {
  return (
    officialForecast?.selected_model ||
    pageData?.selected_model ||
    selectedModelSummary?.selected_model ||
    {}
  );
}

function getOfficialCutoff(
  officialForecast: any,
  pageData: any,
  forecastStatus: any
) {
  return (
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
    "2026-03-31"
  );
}

function getExportStatus(officialForecast: any, pageData: any, forecastStatus: any) {
  return (
    officialForecast?.export_status ||
    pageData?.export_status ||
    forecastStatus?.status ||
    "missing_or_not_exported"
  );
}

function getFutureInfo(officialForecast: any) {
  return (
    officialForecast?.forecast_source?.generated_future_forecast_info ||
    officialForecast?.generated_future_forecast_info ||
    {}
  );
}

function getWarnings(officialForecast: any, pageData: any) {
  const warnings = [
    ...safeArray(officialForecast?.warnings),
    ...safeArray(pageData?.warnings),
  ];

  return Array.from(new Set(warnings.map(formatText))).filter(
    (item) => item !== "—"
  );
}

function getInterpretationNotes(officialForecast: any, pageData: any) {
  const notes = [
    ...safeArray(officialForecast?.professor_safe_interpretation),
    ...safeArray(pageData?.professor_safe_interpretation),
    ...safeArray(pageData?.frontend_guidance),
  ];

  return Array.from(new Set(notes.map(formatText))).filter(
    (item) => item !== "—"
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
      {note ? (
        <p className="mt-2 text-sm leading-6 text-slate-300">{note}</p>
      ) : null}
    </div>
  );
}

function LightMetricCard({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: any;
  suffix?: string;
}) {
  return (
    <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black text-slate-950">
        {formatNumber(value, 4)}{suffix}
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

function ForecastExportAnimation() {
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
          ARIMA Future Forecast Export
        </h3>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          Notebook 12 reads the selected model, takes the official cutoff date,
          refits the selected ARIMA order through that cutoff, and exports true
          post-cutoff business-day forecasts.
        </p>

        <div className="mt-7 grid gap-3">
          {[
            ["01", "Read selected_model_summary.json"],
            ["02", "Read official forecast cutoff"],
            ["03", "Refit selected ARIMA through cutoff"],
            ["04", "Compare with post-cutoff actuals if available"],
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

function MethodCards() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-[2rem] border border-yellow-200 bg-yellow-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-700">
          Cutoff Input
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Forecast Starts After Cutoff
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          The official cutoff date is read from the JSON artifact. Notebook 12
          fits through that date and forecasts the following business days.
        </p>
      </div>

      <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
          Selected Model
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          ARIMA Refit
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          Since Notebook 11 selected ARIMA, Notebook 12 can generate future
          forecasts without needing future macro-factor assumptions.
        </p>
      </div>

      <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
          Post-Cutoff Evaluation
        </p>
        <h3 className="mt-3 text-3xl font-black text-slate-950">
          Actuals Are Comparison Only
        </h3>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          April actual gold prices can be shown against saved forecasts, but
          they are not used to fit the model.
        </p>
      </div>
    </div>
  );
}

function SelectedModelCard({
  selectedModel,
  exportStatus,
}: {
  selectedModel: any;
  exportStatus: string;
}) {
  return (
    <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
        Selected Model From Notebook 11
      </p>

      <h3 className="mt-3 text-3xl font-black text-slate-950">
        {formatText(selectedModel?.model_name || selectedModel?.model_key)}
      </h3>

      <p className="mt-3 text-sm leading-7 text-slate-700">
        This winner is read from selected_model_summary.json and carried into
        official_forecast.json. The frontend does not choose or hardcode the
        model.
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
            Primary RMSE
          </p>
          <p className="mt-1 text-lg font-black text-slate-950">
            {formatNumber(selectedModel?.primary_rmse, 4)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
            Export Status
          </p>
          <p className="mt-1 break-words text-lg font-black text-slate-950">
            {formatText(exportStatus)}
          </p>
        </div>
      </div>
    </div>
  );
}

function FutureGenerationCard({
  futureInfo,
  officialCutoff,
  futureRecords,
  nextFutureRecord,
}: {
  futureInfo: any;
  officialCutoff: string;
  futureRecords: OfficialRecord[];
  nextFutureRecord: OfficialRecord | null;
}) {
  const status = futureInfo?.status || "future_generation_info_not_exported";
  const hasFuture = futureRecords.length > 0;

  return (
    <div
      className={
        hasFuture
          ? "rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6"
          : "rounded-[2rem] border border-amber-200 bg-amber-50 p-6"
      }
    >
      <p
        className={
          hasFuture
            ? "text-xs font-black uppercase tracking-[0.24em] text-emerald-700"
            : "text-xs font-black uppercase tracking-[0.24em] text-amber-700"
        }
      >
        Future Forecast Generated From Cutoff
      </p>

      <h3 className="mt-3 text-3xl font-black text-slate-950">
        {hasFuture ? "Post-Cutoff ARIMA Forecast Ready" : "No Future Rows Exported"}
      </h3>

      <p className="mt-3 text-sm leading-7 text-slate-700">
        Notebook 12 status: <b>{formatText(status)}</b>. The model is refit
        through <b>{formatText(officialCutoff)}</b>, then future business-day
        forecasts are exported.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
            Horizon Days
          </p>
          <p className="mt-1 text-lg font-black text-slate-950">
            {formatNumber(futureInfo?.horizon_business_days, 0)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
            ARIMA Order
          </p>
          <p className="mt-1 text-lg font-black text-slate-950">
            {Array.isArray(futureInfo?.arima_order)
              ? `ARIMA(${futureInfo.arima_order.join(", ")})`
              : formatText(futureInfo?.arima_order)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
            Future Rows
          </p>
          <p className="mt-1 text-lg font-black text-slate-950">
            {formatNumber(futureRecords.length, 0)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
            Fit Start
          </p>
          <p className="mt-1 text-lg font-black text-slate-950">
            {formatText(futureInfo?.fit_start)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
            Fit End
          </p>
          <p className="mt-1 text-lg font-black text-slate-950">
            {formatText(futureInfo?.fit_end || officialCutoff)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
            Fit Rows
          </p>
          <p className="mt-1 text-lg font-black text-slate-950">
            {formatNumber(futureInfo?.fit_rows_through_cutoff, 0)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
            First Future Date
          </p>
          <p className="mt-1 text-lg font-black text-slate-950">
            {formatText(futureInfo?.first_future_date || nextFutureRecord?.date)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
            Last Future Date
          </p>
          <p className="mt-1 text-lg font-black text-slate-950">
            {formatText(futureInfo?.last_future_date)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
            First Forecast
          </p>
          <p className="mt-1 text-lg font-black text-slate-950">
            {formatNumber(nextFutureRecord?.official_forecast, 4)}
          </p>
        </div>
      </div>
    </div>
  );
}

function SourceDiagnostics({
  officialForecast,
  futureInfo,
}: {
  officialForecast: any;
  futureInfo: any;
}) {
  const forecastSource = officialForecast?.forecast_source || {};
  const notes = forecastSource?.standardization_notes || {};
  const sourceInfo = forecastSource?.source_info || {};

  const rows = [
    ["Selected Forecast Path", forecastSource?.path],
    ["Source Type", sourceInfo?.source_type],
    ["Future Generation Status", futureInfo?.status],
    ["Gold History Source", futureInfo?.gold_history_source],
    ["Order Source", futureInfo?.order_source],
    ["Rows With Actuals", futureInfo?.future_rows_with_actuals],
    ["Rows Without Actuals", futureInfo?.future_rows_without_actuals],
    ["Actual Comparison Status", futureInfo?.future_actual_comparison_status],
    ["Date Column", notes?.date_column],
    ["Actual Column", notes?.actual_column],
    ["Forecast Column", notes?.forecast_column],
    ["Lower Column", notes?.lower_column],
    ["Upper Column", notes?.upper_column],
    ["Standardization Status", notes?.status],
    ["Records After Standardization", notes?.records_after_standardization],
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
        >
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
            {label}
          </p>
          <p className="mt-3 break-words text-lg font-black text-slate-950">
            {formatText(value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function WarningBlock({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) {
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
          {warning}
        </div>
      ))}
    </div>
  );
}

function InterpretationBlock({ notes }: { notes: string[] }) {
  if (notes.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        No professor-safe interpretation notes were exported. The page will not
        invent unsupported conclusions.
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

export default async function ForecastPage() {
  const results = await loadArtifacts();

  const pageData = getArtifact(results, "pageOfficialForecast");
  const officialForecast = getArtifact(results, "officialForecast");
  const selectedModelSummary = getArtifact(results, "selectedModelSummary");
  const modelRanking = getArtifact(results, "modelRanking");
  const forecastStatusArtifact = getArtifact(results, "forecastStatus");
  const modelWindowPlan = getArtifact(results, "modelWindowPlan");

  const loadedCount = results.filter((item) => item.ok).length;

  const selectedModel = getSelectedModel(
    officialForecast,
    pageData,
    selectedModelSummary
  );

  const officialCutoff = getOfficialCutoff(
    officialForecast,
    pageData,
    forecastStatusArtifact
  );

  const exportStatus = getExportStatus(
    officialForecast,
    pageData,
    forecastStatusArtifact
  );

  const futureInfo = getFutureInfo(officialForecast);

  const officialRecords = getOfficialRecords(officialForecast);
  const futureRecords = getFutureRecords(officialForecast);

  const futureRowsWithActuals = futureRecords.filter(
    (row) => row.actual_gold_price !== null && row.actual_gold_price !== undefined
  );

  const averageFutureAbsError =
    futureRowsWithActuals.length > 0
      ? futureRowsWithActuals.reduce((sum: number, row: any) => {
          const actual = toNumber(row.actual_gold_price);
          const forecast = toNumber(row.official_forecast);
          if (actual === null || forecast === null) return sum;
          return sum + Math.abs(actual - forecast);
        }, 0) / futureRowsWithActuals.length
      : null;

  const futureIntervalHits = futureRowsWithActuals.filter((row: any) => {
    const actual = toNumber(row.actual_gold_price);
    const lower = toNumber(row.forecast_lower);
    const upper = toNumber(row.forecast_upper);
    if (actual === null || lower === null || upper === null) return false;
    return actual >= lower && actual <= upper;
  }).length;

  const futureIntervalCoverage =
    futureRowsWithActuals.length > 0
      ? (futureIntervalHits / futureRowsWithActuals.length) * 100
      : null;

  const futureChartRows = futureRecords.map((row) => ({
    date: row.date,
    official_forecast: row.official_forecast ?? null,
    forecast_lower: row.forecast_lower ?? null,
    forecast_upper: row.forecast_upper ?? null,
    actual_gold_price: row.actual_gold_price ?? null,
    split: row.split,
    selected_model_name: row.selected_model_name,
    source_model_label: row.source_model_label,
    forecast_generation_mode: row.forecast_generation_mode,
  }));

  const chartRows = buildChartRows(officialRecords);
  const rowsWithActual = getRowsWithActual(chartRows);
  const recentRows = rowsWithActual.slice(-120);

  const latestRecord = officialForecast?.latest_record
    ? normalizeOfficialRecord(officialForecast.latest_record)
    : officialRecords[officialRecords.length - 1] || null;

  const nextFutureRecord = officialForecast?.next_forecast_after_cutoff
    ? normalizeOfficialRecord(officialForecast.next_forecast_after_cutoff)
    : futureRecords[0] || null;

  const warnings = getWarnings(officialForecast, pageData);
  const interpretationNotes = getInterpretationNotes(officialForecast, pageData);

  const pageTitle = pageData?.page_title || "Official Gold Forecast";

  const pageSubtitle =
    pageData?.page_subtitle ||
    "Selected-model forecast exported from the validation pipeline.";

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
                Cutoff Input: {formatText(officialCutoff)}
              </span>

              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-100">
                Future Rows: {formatNumber(futureRecords.length, 0)}
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
              <DarkKpiCard label="Official Cutoff" value={officialCutoff} />
              <DarkKpiCard
                label="Future Horizon"
                value={futureInfo?.horizon_business_days}
              />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <DarkKpiCard
                label="ARIMA Order"
                value={
                  Array.isArray(futureInfo?.arima_order)
                    ? `ARIMA(${futureInfo.arima_order.join(", ")})`
                    : futureInfo?.arima_order
                }
              />
              <DarkKpiCard
                label="Fit End"
                value={futureInfo?.fit_end || officialCutoff}
              />
              <DarkKpiCard
                label="First Future"
                value={futureInfo?.first_future_date || nextFutureRecord?.date}
              />
              <DarkKpiCard
                label="Latest Forecast"
                value={latestRecord?.official_forecast}
                note={
                  latestRecord?.date
                    ? `Latest historical path date: ${latestRecord.date}`
                    : undefined
                }
              />
            </div>
          </div>

          <ForecastExportAnimation />
        </div>
      </section>

      <section className="px-6 py-12 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl space-y-10">
          <CardShell>
            <SectionTitle
              eyebrow="Notebook 12 Purpose"
              title="Forecast Page Uses the Notebook Cutoff Input"
              subtitle="This page reads the official cutoff and generated_future_forecast_info from official_forecast.json. It does not generate forecasts in the browser."
            />

            <MethodCards />
          </CardShell>

          <div className="grid gap-10 lg:grid-cols-2">
            <SelectedModelCard
              selectedModel={selectedModel}
              exportStatus={exportStatus}
            />

            <FutureGenerationCard
              futureInfo={futureInfo}
              officialCutoff={officialCutoff}
              futureRecords={futureRecords}
              nextFutureRecord={nextFutureRecord}
            />
          </div>

          <CardShell>
            <SectionTitle
              eyebrow="Post-Cutoff Actual Comparison"
              title="April Actuals vs Saved ARIMA Forecast"
              subtitle="The model was fit only through the cutoff. Actual April gold prices are used here only to evaluate the saved post-cutoff forecast."
            />

            <div className="grid gap-4 md:grid-cols-4">
              <LightMetricCard
                label="Future Rows With Actuals"
                value={futureRowsWithActuals.length}
              />
              <LightMetricCard
                label="Average Absolute Error"
                value={averageFutureAbsError}
              />
              <LightMetricCard
                label="Interval Hits"
                value={futureIntervalHits}
              />
              <LightMetricCard
                label="95% Coverage So Far"
                value={futureIntervalCoverage}
                suffix="%"
              />
            </div>
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Future Forecast Output"
              title="ARIMA Forecasts After the Official Cutoff"
              subtitle="The graph uses future_records_after_cutoff. The blue line is the saved forecast, the yellow band is the 95% interval, and the green line appears where actual post-cutoff gold prices are available."
            />

            <FutureForecastBandChart
              rows={futureChartRows}
              title="Future ARIMA Forecast with 95% Confidence Band"
              subtitle="Hover over the chart to see actual gold price, official forecast, lower bound, upper bound, residual, error, model, and generation mode."
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Historical/Test Evidence"
              title="Actual Gold Price vs Official Forecast Path"
              subtitle="This chart uses records where actual gold prices exist. It validates the selected model path before future testing."
            />

            <ActualVsForecastChart
              title="Actual Gold Price vs Official Forecast"
              rows={rowsWithActual}
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
              subtitle="Residual = actual gold price minus official forecast. Future rows without actual values are excluded."
            />

            <ResidualChart
              title="Official Forecast Residuals"
              rows={rowsWithActual}
              actualKey="actual"
              forecastKey="forecast"
              forecastLabel="Official Forecast"
              yAxisLabel="Actual - Forecast"
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Recent Forecast Evidence"
              title="Recent Actual vs Forecast Zoom"
              subtitle="This view focuses on the most recent records with actual gold prices."
            />

            <ActualVsForecastChart
              title="Recent Actual vs Official Forecast"
              rows={recentRows}
              actualKey="actual"
              actualLabel="Actual Gold Price"
              forecastKey="forecast"
              forecastLabel="Official Forecast"
              yAxisLabel="Gold Price (USD/oz)"
              showSplitMarkers={false}
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Export Diagnostics"
              title="Cutoff, Source, and ARIMA Future Generation"
              subtitle="This section confirms what Notebook 12 used as input and how it generated the post-cutoff forecast."
            />

            <SourceDiagnostics
              officialForecast={officialForecast}
              futureInfo={futureInfo}
            />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Notebook Warnings"
              title="Official Forecast Export Warnings"
              subtitle="These warnings come from official_forecast.json. They should be shown, not hidden."
            />

            <WarningBlock warnings={warnings} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Future Testing Plan"
              title="How This Forecast Will Be Tested Later"
              subtitle="The saved post-cutoff rows are the forecast. Later, new actual gold prices can be compared against these stored forecasts."
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  What is predicted?
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  The future graph predicts gold price after the official cutoff
                  using the selected ARIMA model refit through the cutoff date.
                </p>
              </div>

              <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Why ARIMA can forecast future rows
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  ARIMA is univariate, so it only needs gold price history. It
                  does not need future macro factor assumptions.
                </p>
              </div>

              <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  How future testing works
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  When actual future gold prices are available, compare them
                  against the saved future_records_after_cutoff rows.
                </p>
              </div>

              <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  Professor-safe wording
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  The platform forecasts future business days after the cutoff,
                  but model accuracy can only be confirmed after actual future
                  prices arrive.
                </p>
              </div>
            </div>
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Professor Interpretation"
              title="How to Explain the Official Forecast"
              subtitle="These notes are read from official_forecast.json and page_official_forecast.json."
            />

            <InterpretationBlock notes={interpretationNotes} />
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Artifact Status"
              title="JSON Sources Used by This Page"
              subtitle="Every forecast value must come from JSON artifacts."
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
              <SourcePreview
                title="model_window_plan.json"
                data={modelWindowPlan}
              />
            </div>
          </CardShell>
        </div>
      </section>
    </main>
  );
}
