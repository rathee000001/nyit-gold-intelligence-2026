import type { ReactNode } from "react";
import { promises as fs } from "fs";
import path from "path";
import {
  ActualVsForecastChart,
  MetricComparisonChart,
  ResidualChart,
  type ForecastChartRow,
  type MetricChartRow,
} from "@/components/models/UniversalModelCharts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ArtifactKind = "json" | "csv";

type ArtifactRequest = {
  key: string;
  label: string;
  path: string;
  kind: ArtifactKind;
};

type ArtifactResult = ArtifactRequest & {
  ok: boolean;
  data: any;
  error?: string;
};

const ARTIFACTS: ArtifactRequest[] = [
  {
    key: "report",
    label: "Alpha Structural Report",
    path: "artifacts/deep_ml/models/alpha_structural/phase6_alpha_structural_report.json",
    kind: "json",
  },
  {
    key: "runSummary",
    label: "Run Summary",
    path: "artifacts/deep_ml/models/alpha_structural/run_summary.json",
    kind: "json",
  },
  {
    key: "forecast",
    label: "Latest Forecast",
    path: "artifacts/deep_ml/models/alpha_structural/forecast_latest.json",
    kind: "json",
  },
  {
    key: "evaluation",
    label: "Evaluation by Horizon",
    path: "artifacts/deep_ml/models/alpha_structural/evaluation_by_horizon.json",
    kind: "json",
  },
  {
    key: "evaluationRollforward",
    label: "Static Train/Validation/Test Predictions",
    path: "artifacts/deep_ml/models/alpha_structural/evaluation_rollforward.csv",
    kind: "csv",
  },
  {
    key: "rollingOriginPredictions",
    label: "Rolling-Origin Predictions",
    path: "artifacts/deep_ml/models/alpha_structural/rolling_origin_predictions.csv",
    kind: "csv",
  },
  {
    key: "rollingOriginMetrics",
    label: "Rolling-Origin Metrics",
    path: "artifacts/deep_ml/models/alpha_structural/rolling_origin_metrics.json",
    kind: "json",
  },
  {
    key: "rollingVsStatic",
    label: "Rolling-Origin vs Static Split",
    path: "artifacts/deep_ml/models/alpha_structural/rolling_origin_vs_static_split.json",
    kind: "json",
  },
  {
    key: "shapSummary",
    label: "SHAP Summary",
    path: "artifacts/deep_ml/models/alpha_structural/shap_summary.json",
    kind: "json",
  },
  {
    key: "shapLatest",
    label: "Latest Forecast SHAP Explanation",
    path: "artifacts/deep_ml/models/alpha_structural/shap_latest_forecast_explanation.json",
    kind: "json",
  },
  {
    key: "shapGlobalCsv",
    label: "SHAP Global Importance CSV",
    path: "artifacts/deep_ml/models/alpha_structural/shap_global_importance.csv",
    kind: "csv",
  },
  {
    key: "qualityReview",
    label: "Quality Review",
    path: "artifacts/deep_ml/models/alpha_structural/quality_review.json",
    kind: "json",
  },
  {
    key: "modeStatus",
    label: "Deep ML Mode Status",
    path: "artifacts/deep_ml/governance/deep_ml_mode_status.json",
    kind: "json",
  },
  {
    key: "matrixManifest",
    label: "Numeric Feature Store Manifest",
    path: "artifacts/deep_ml/features/deep_ml_numeric_feature_store_manifest.json",
    kind: "json",
  },
  {
    key: "gammaDateContext",
    label: "Gamma Date Context for News Tooltips",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_date_context.csv",
    kind: "csv",
  },
];

function cleanPath(value: string) {
  return value.trim().replace(/^\/+/, "").replace(/\\/g, "/");
}

function publicHref(value?: string | null) {
  if (!value) return "";
  return `/${cleanPath(value).replace(/^public\//, "")}`;
}

function getBaseUrl() {
  const base = process.env.NEXT_PUBLIC_ARTIFACT_BASE_URL;
  if (!base || base.trim() === "") return "";
  return base.trim().replace(/\/+$/, "");
}

async function readLocalText(relativePath: string) {
  const normalized = cleanPath(relativePath);
  const publicPath = path.join(process.cwd(), "public", normalized);
  const repoPath = path.join(process.cwd(), normalized);

  try {
    return await fs.readFile(publicPath, "utf-8");
  } catch {
    return await fs.readFile(repoPath, "utf-8");
  }
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseCsv(text: string) {
  const cleanText = text.trim();
  if (!cleanText) return [];

  const lines = cleanText.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, any> = {};

    headers.forEach((header, index) => {
      const raw = String(cells[index] ?? "").trim();
      const numeric = Number(raw);
      row[header] = raw !== "" && Number.isFinite(numeric) ? numeric : raw;
    });

    return row;
  });
}

async function loadArtifact(artifact: ArtifactRequest): Promise<ArtifactResult> {
  const baseUrl = getBaseUrl();

  try {
    let text = "";

    if (baseUrl) {
      const url = `${baseUrl}/${cleanPath(artifact.path)}`;
      const response = await fetch(url, { cache: "no-store" });

      if (!response.ok) {
        return {
          ...artifact,
          ok: false,
          data: artifact.kind === "csv" ? [] : null,
          error: `HTTP ${response.status}`,
        };
      }

      text = await response.text();
    } else {
      text = await readLocalText(artifact.path);
    }

    return {
      ...artifact,
      ok: true,
      data: artifact.kind === "json" ? JSON.parse(text) : parseCsv(text),
    };
  } catch (error) {
    return {
      ...artifact,
      ok: false,
      data: artifact.kind === "csv" ? [] : null,
      error: error instanceof Error ? error.message : "Artifact load failed.",
    };
  }
}

async function loadArtifacts() {
  return Promise.all(ARTIFACTS.map(loadArtifact));
}

function getArtifact(results: ArtifactResult[], key: string) {
  return results.find((item) => item.key === key)?.data;
}

function firstValue(...values: any[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return null;
}

function asNumber(value: any) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatNumber(value: any, digits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(numeric);
}

function formatUsd(value: any) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatPercent(value: any, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";
  return `${numeric.toFixed(digits)}%`;
}

function formatDate(value: any) {
  if (!value) return "Not in artifact";

  const text = String(value);
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(Number(y), Number(m) - 1, Number(d)));
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function formatDateTime(value: any) {
  if (!value) return "Not in artifact";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function statusClass(status: any) {
  const text = String(status || "").toLowerCase();

  if (text.includes("ready") || text.includes("pass") || text.includes("completed")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (text.includes("review") || text.includes("warning") || text.includes("pending")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (text.includes("fail") || text.includes("block")) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function StatusPill({ status }: { status: any }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(
        status
      )}`}
    >
      {status || "Not in artifact"}
    </span>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-8">
      <div className="mb-3 text-[11px] font-black uppercase tracking-[0.35em] text-blue-600">
        {eyebrow}
      </div>
      <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-3 max-w-5xl text-sm font-medium leading-7 text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
        {label}
      </div>
      <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">
        {value}
      </div>
      {note && <div className="mt-3 text-xs font-semibold leading-5 text-slate-500">{note}</div>}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[170px_1fr] gap-3 border-b border-slate-100 pb-3 last:border-b-0">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <span className="break-words text-sm font-bold text-slate-700">
        {value || "Not in artifact"}
      </span>
    </div>
  );
}

function DownloadButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      download
      className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
    >
      {children}
    </a>
  );
}

function ConditionalSection({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show) return null;
  return <>{children}</>;
}

function AlphaHero() {
  const nodes = Array.from({ length: 30 }, (_, index) => {
    const left = 6 + ((index * 31) % 88);
    const top = 10 + ((index * 43) % 76);

    return (
      <span
        key={index}
        className="alpha-node"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          animationDelay: `${index * 0.12}s`,
        }}
      />
    );
  });

  return (
    <div className="relative min-h-[430px] overflow-hidden rounded-[3rem] border border-slate-200 bg-slate-950 p-8 shadow-2xl shadow-emerald-950/20">
      <style>{`
        .alpha-grid {
          background-image:
            linear-gradient(rgba(16, 185, 129, 0.14) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16, 185, 129, 0.14) 1px, transparent 1px);
          background-size: 34px 34px;
          animation: alpha-grid-move 20s linear infinite;
        }

        .alpha-symbol {
          position: absolute;
          right: 11%;
          top: 13%;
          width: 240px;
          height: 240px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          color: rgba(250, 204, 21, 0.95);
          font-size: 130px;
          font-weight: 1000;
          background:
            radial-gradient(circle at 35% 30%, rgba(250, 204, 21, 0.36), transparent 36%),
            radial-gradient(circle at 70% 75%, rgba(16, 185, 129, 0.25), transparent 38%),
            rgba(15, 23, 42, 0.62);
          border: 1px solid rgba(250, 204, 21, 0.35);
          box-shadow:
            0 0 80px rgba(250, 204, 21, 0.24),
            inset 0 0 80px rgba(16, 185, 129, 0.18);
          animation: alpha-float 5.5s ease-in-out infinite;
        }

        .alpha-tree {
          position: absolute;
          right: 6%;
          bottom: 9%;
          width: 520px;
          height: 180px;
          opacity: 0.92;
        }

        .alpha-branch {
          position: absolute;
          height: 2px;
          transform-origin: left center;
          background: linear-gradient(90deg, rgba(250,204,21,0.85), rgba(16,185,129,0.25));
          box-shadow: 0 0 22px rgba(250, 204, 21, 0.25);
          animation: alpha-branch 2.8s ease-in-out infinite;
        }

        .alpha-branch.b1 { left: 20px; top: 90px; width: 150px; transform: rotate(-20deg); }
        .alpha-branch.b2 { left: 20px; top: 90px; width: 150px; transform: rotate(20deg); }
        .alpha-branch.b3 { left: 165px; top: 40px; width: 132px; transform: rotate(-18deg); animation-delay: .25s; }
        .alpha-branch.b4 { left: 165px; top: 40px; width: 132px; transform: rotate(18deg); animation-delay: .35s; }
        .alpha-branch.b5 { left: 165px; top: 140px; width: 132px; transform: rotate(-18deg); animation-delay: .45s; }
        .alpha-branch.b6 { left: 165px; top: 140px; width: 132px; transform: rotate(18deg); animation-delay: .55s; }

        .alpha-node {
          position: absolute;
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: rgba(250, 204, 21, 0.95);
          box-shadow:
            0 0 18px rgba(250, 204, 21, 0.85),
            0 0 36px rgba(16, 185, 129, 0.24);
          animation: alpha-pulse 2.4s ease-in-out infinite;
        }

        @keyframes alpha-grid-move {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(34px, 34px, 0); }
        }

        @keyframes alpha-float {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-5deg); }
          50% { transform: translate3d(0, -17px, 0) rotate(5deg); }
        }

        @keyframes alpha-pulse {
          0%, 100% { opacity: .42; transform: scale(.7); }
          50% { opacity: 1; transform: scale(1.35); }
        }

        @keyframes alpha-branch {
          0%, 100% { opacity: .42; }
          50% { opacity: 1; }
        }
      `}</style>

      <div className="alpha-grid absolute inset-0 opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(250,204,21,0.18),transparent_30%),radial-gradient(circle_at_65%_50%,rgba(16,185,129,0.27),transparent_38%),radial-gradient(circle_at_90%_90%,rgba(59,130,246,0.15),transparent_35%)]" />

      <div className="alpha-symbol">α</div>
      <div className="alpha-tree">
        <span className="alpha-branch b1" />
        <span className="alpha-branch b2" />
        <span className="alpha-branch b3" />
        <span className="alpha-branch b4" />
        <span className="alpha-branch b5" />
        <span className="alpha-branch b6" />
      </div>
      {nodes}

      <div className="relative z-10 flex min-h-[360px] max-w-4xl flex-col justify-between">
        <div>
          <div className="inline-flex rounded-full border border-yellow-300/30 bg-yellow-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-yellow-200">
            Alpha Structural Expert
          </div>
          <h1 className="mt-8 text-5xl font-black tracking-tight text-white md:text-7xl">
            Alpha Structural
          </h1>
          <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-emerald-50/80">
            Structural XGBoost expert built from exported Alpha artifacts. The main graph uses the full static split prediction file with train, validation, and test rows.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Symbol
            </div>
            <div className="mt-2 text-sm font-black text-white">α / structural signal</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Main Graph Source
            </div>
            <div className="mt-2 text-sm font-black text-white">evaluation_rollforward.csv</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Interpretability
            </div>
            <div className="mt-2 text-sm font-black text-white">SHAP behavior, not causality</div>
          </div>
        </div>
      </div>
    </div>
  );
}


type GammaDateContextLookup = Record<string, Record<string, any>>;

function normalizeChartDate(value: any) {
  if (value === null || value === undefined) return "";
  return String(value).slice(0, 10);
}

function buildGammaDateContextLookup(rows: any[]): GammaDateContextLookup {
  const lookup: GammaDateContextLookup = {};

  if (!Array.isArray(rows)) return lookup;

  for (const row of rows) {
    const date = normalizeChartDate(row?.date);
    if (!date) continue;

    lookup[date] = {
      gamma_tooltip_primary_headline: row.gamma_tooltip_primary_headline || row.top_headline_1 || "",
      gamma_tooltip_primary_source: row.gamma_tooltip_primary_source || row.top_headline_1_source || "",
      gamma_tooltip_note: row.gamma_tooltip_note || row.source_coverage_note || "",
      gamma_context_intensity: row.gamma_context_intensity,
      gamma_context_bucket: row.gamma_context_bucket,
      gamma_recent_headlines_json: row.gamma_recent_headlines_json || "[]",
      source_coverage_note: row.source_coverage_note || "",
      top_headline_1: row.top_headline_1 || "",
      top_headline_1_source: row.top_headline_1_source || "",
      top_headline_1_url: row.top_headline_1_url || "",
    };
  }

  return lookup;
}

function getGammaContextForDate(
  gammaLookup: GammaDateContextLookup,
  dateValue: any
): Record<string, any> {
  const date = normalizeChartDate(dateValue);
  if (!date) return {};
  return gammaLookup[date] || {};
}

function buildSplitRows(rows: any[], horizon = 10, gammaLookup: GammaDateContextLookup = {}): ForecastChartRow[] {
  return rows
    .filter((row) => Number(row.horizon) === horizon)
    .map((row) => ({
      date: String(row.date),
      ...getGammaContextForDate(gammaLookup, row.date),
      split: String(row.split || "test"),
      actual: asNumber(row.actual_target),
      forecast: asNumber(row.prediction),
      naiveForecast: asNumber(row.naive_prediction),
      currentGold: asNumber(row.gold_price),
      predictedLogReturn: asNumber(row.predicted_log_return),
      alphaError: asNumber(row.error),
    }))
    .filter((row) => row.actual !== null && row.forecast !== null);
}

function buildRollingRows(rows: any[], horizon = 10, gammaLookup: GammaDateContextLookup = {}): ForecastChartRow[] {
  return rows
    .filter((row) => Number(row.horizon) === horizon)
    .map((row) => ({
      date: String(row.origin_date),
      ...getGammaContextForDate(gammaLookup, row.origin_date),
      split: "rolling_test",
      actual: asNumber(row.actual_target_price),
      forecast: asNumber(row.predicted_price),
      naiveForecast: asNumber(row.naive_prediction),
      currentGold: asNumber(row.current_gold_price),
      predictedLogReturn: asNumber(row.predicted_log_return),
      alphaError: asNumber(row.error),
      naiveError: asNumber(row.naive_error),
      trainRowsUsed: asNumber(row.train_rows_used),
    }))
    .filter((row) => row.actual !== null && row.forecast !== null);
}

function buildMetricRows(evaluation: any): MetricChartRow[] {
  const metrics = evaluation?.metrics_by_horizon || {};
  const rows: MetricChartRow[] = [];

  for (const horizon of Object.keys(metrics).sort((a, b) => Number(a) - Number(b))) {
    for (const split of ["train", "validation", "test"]) {
      const item = metrics[horizon]?.[split];
      if (!item) continue;

      rows.push({
        split,
        horizon: `${horizon}D`,
        label: `${horizon}D`,
        MAE: item.mae,
        RMSE: item.rmse,
        MAPE: item.mape,
        SMAPE: item.smape,
        DirectionalAccuracy: item.directional_accuracy,
        Bias: item.bias_mean_error,
      });
    }
  }

  return rows;
}

function buildNaiveRows(evaluation: any): MetricChartRow[] {
  const modelMetrics = evaluation?.metrics_by_horizon || {};
  const baselineMetrics = evaluation?.baseline_metrics_by_horizon || {};
  const rows: MetricChartRow[] = [];

  for (const horizon of Object.keys(modelMetrics).sort((a, b) => Number(a) - Number(b))) {
    const modelTest = modelMetrics[horizon]?.test;
    const naiveTest = baselineMetrics[horizon]?.test?.naive_current_price;

    if (!modelTest || !naiveTest) continue;

    rows.push({
      split: "test",
      horizon: `${horizon}D`,
      label: `${horizon}D`,
      AlphaMAPE: modelTest.mape,
      NaiveMAPE: naiveTest.mape,
      AlphaMAE: modelTest.mae,
      NaiveMAE: naiveTest.mae,
      AlphaRMSE: modelTest.rmse,
      NaiveRMSE: naiveTest.rmse,
    });
  }

  return rows;
}

function buildImprovementRows(report: any, evaluation: any): MetricChartRow[] {
  const improvements =
    evaluation?.test_improvement_vs_naive_by_horizon ||
    report?.test_improvement_vs_naive_by_horizon ||
    {};

  const rows: MetricChartRow[] = [];

  for (const horizon of Object.keys(improvements).sort((a, b) => Number(a) - Number(b))) {
    const item = improvements[horizon];

    rows.push({
      split: "test",
      horizon: `${horizon}D`,
      label: `${horizon}D`,
      MAEImprovement: item.mae_improvement_pct_vs_naive,
      RMSEImprovement: item.rmse_improvement_pct_vs_naive,
      MAPEImprovement: item.mape_improvement_pct_vs_naive,
      SMAPEImprovement: item.smape_improvement_pct_vs_naive,
    });
  }

  return rows;
}

function buildForecastRows(forecast: any): MetricChartRow[] {
  const points = forecast?.forecast_points || [];

  return points.map((row: any) => ({
    split: "latest",
    horizon: `${row.horizon}D`,
    label: `${row.horizon}D`,
    P10: row.p10,
    P50: row.p50,
    P90: row.p90,
    Origin: row.origin_gold_price,
  }));
}

function average(values: any[]) {
  const nums = values.map(Number).filter((value) => Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function splitMetricAverage(metricRows: MetricChartRow[], split: string, key: string) {
  return average(
    metricRows
      .filter((row) => String(row.split).toLowerCase() === split.toLowerCase())
      .map((row) => row[key])
  );
}

function FeatureBars({
  rows,
  valueKey,
  title,
  valueFormatter,
  limit = 18,
}: {
  rows: any[];
  valueKey: string;
  title: string;
  valueFormatter?: (value: any) => string;
  limit?: number;
}) {
  const chartRows = rows
    .filter((row) => Number.isFinite(Number(row[valueKey])))
    .slice(0, limit);

  const maxValue = Math.max(...chartRows.map((row) => Number(row[valueKey])), 0);

  if (!chartRows.length) return null;

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-2xl font-black tracking-tight text-slate-950">{title}</h3>

      <div className="mt-6 space-y-4">
        {chartRows.map((row, index) => {
          const value = Number(row[valueKey]);
          const width = maxValue > 0 ? Math.max(4, (value / maxValue) * 100) : 0;

          return (
            <div key={`${row.feature}-${index}`}>
              <div className="mb-2 flex items-center justify-between gap-4">
                <div className="truncate text-xs font-black text-slate-700">{row.feature}</div>
                <div className="text-xs font-black text-slate-500">
                  {valueFormatter ? valueFormatter(value) : formatNumber(value, 6)}
                </div>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-950"
                  style={{ width: `${width}%` }}
                  title={`${row.feature}: ${formatNumber(value, 8)}. SHAP explains model behavior, not causality.`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LatestForecastTable({ rows }: { rows: any[] }) {
  if (!rows.length) return null;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-8 bg-slate-50 px-5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">
        <span>Horizon</span>
        <span>Forecast Date</span>
        <span>Origin Gold</span>
        <span>p10</span>
        <span>p50</span>
        <span>p90</span>
        <span>Expected $</span>
        <span>Expected %</span>
      </div>

      {rows.map((row) => (
        <div
          key={row.horizon}
          className="grid grid-cols-8 border-t border-slate-100 px-5 py-4 text-xs font-bold text-slate-700"
        >
          <span>{row.horizon}D</span>
          <span>{row.forecast_date}</span>
          <span>{formatUsd(row.origin_gold_price)}</span>
          <span>{formatUsd(row.p10)}</span>
          <span>{formatUsd(row.p50)}</span>
          <span>{formatUsd(row.p90)}</span>
          <span>{formatUsd(row.expected_change)}</span>
          <span>{formatPercent(row.expected_change_pct, 2)}</span>
        </div>
      ))}
    </div>
  );
}

function LocalShapTable({ shapLatest }: { shapLatest: any }) {
  const latest = shapLatest?.latest_explanations_by_horizon || {};

  const rows = Object.keys(latest)
    .sort((a, b) => Number(a) - Number(b))
    .map((horizon) => {
      const drivers = latest[horizon]?.top_local_drivers || [];
      const top = drivers[0];

      return {
        horizon,
        originDate: latest[horizon]?.origin_date,
        feature: top?.feature,
        direction: top?.direction,
        shapValue: top?.shap_value,
        note: latest[horizon]?.note,
      };
    })
    .filter((row) => row.feature);

  if (!rows.length) return null;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-5 bg-slate-50 px-5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">
        <span>Horizon</span>
        <span>Origin</span>
        <span>Top Driver</span>
        <span>Direction</span>
        <span>SHAP</span>
      </div>

      {rows.map((row) => (
        <div
          key={row.horizon}
          className="grid grid-cols-5 border-t border-slate-100 px-5 py-4 text-xs font-bold text-slate-700"
        >
          <span>{row.horizon}D</span>
          <span>{row.originDate || "Not in artifact"}</span>
          <span>{row.feature || "Not in artifact"}</span>
          <span>{row.direction || "Not in artifact"}</span>
          <span>{formatNumber(row.shapValue, 6)}</span>
        </div>
      ))}
    </div>
  );
}

function ArtifactDownloads({ results }: { results: ArtifactResult[] }) {
  return (
    <div className="grid gap-3">
      {ARTIFACTS.map((artifact) => {
        const result = results.find((item) => item.key === artifact.key);

        return (
          <div
            key={artifact.key}
            className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black text-slate-900">{artifact.label}</span>
                <StatusPill status={result?.ok ? "loaded" : "missing"} />
              </div>
              <div className="mt-2 break-all text-xs font-semibold text-slate-500">
                {artifact.path}
              </div>
              {!result?.ok && result?.error && (
                <div className="mt-2 text-xs font-semibold text-rose-600">
                  {result.error}
                </div>
              )}
            </div>

            <DownloadButton href={publicHref(artifact.path)}>Download</DownloadButton>
          </div>
        );
      })}
    </div>
  );
}

export default async function AlphaStructuralPage() {
  const results = await loadArtifacts();

  const report = getArtifact(results, "report");
  const runSummary = getArtifact(results, "runSummary");
  const forecast = getArtifact(results, "forecast");
  const evaluation = getArtifact(results, "evaluation");
  const evaluationRollforward = getArtifact(results, "evaluationRollforward") || [];
  const rollingOriginPredictions = getArtifact(results, "rollingOriginPredictions") || [];
  const shapSummary = getArtifact(results, "shapSummary");
  const shapLatest = getArtifact(results, "shapLatest");
  const shapGlobalCsv = getArtifact(results, "shapGlobalCsv") || [];
  const qualityReview = getArtifact(results, "qualityReview");
  const modeStatus = getArtifact(results, "modeStatus");
  const matrixManifest = getArtifact(results, "matrixManifest");

  const loadedCount = results.filter((item) => item.ok).length;
  const gammaDateContext = getArtifact(results, "gammaDateContext") || [];
  const gammaLookup = buildGammaDateContextLookup(gammaDateContext);

  const selectedHorizon = 10;
  const splitRows = buildSplitRows(evaluationRollforward, selectedHorizon, gammaLookup);
  const recentTestRows = splitRows.filter((row) => row.split === "test").slice(-180);
  const rollingRows = buildRollingRows(rollingOriginPredictions, selectedHorizon, gammaLookup).slice(-180);

  const metricRows = buildMetricRows(evaluation);
  const naiveRows = buildNaiveRows(evaluation);
  const improvementRows = buildImprovementRows(report, evaluation);
  const forecastRows = buildForecastRows(forecast);

  const trainAvgMape = splitMetricAverage(metricRows, "train", "MAPE");
  const validationAvgMape = splitMetricAverage(metricRows, "validation", "MAPE");
  const testAvgMape = splitMetricAverage(metricRows, "test", "MAPE");
  const testAvgDirection = splitMetricAverage(metricRows, "test", "DirectionalAccuracy");

  const forecastPoints = forecast?.forecast_points || [];
  const latestForecastPoint = forecastPoints[0];

  const shapRows =
    shapGlobalCsv.length > 0
      ? shapGlobalCsv
      : shapSummary?.top_global_features || report?.top_shap_features || [];

  const modelName = firstValue(forecast?.model_name, runSummary?.model_name, "Alpha Structural Expert");
  const modelVersion = firstValue(report?.model_version, forecast?.model_version, runSummary?.model_version);
  const status = firstValue(report?.status, qualityReview?.status, "loaded");
  const generatedAt = firstValue(report?.generated_at_utc, forecast?.generated_at_utc);

  const validationMethods = Array.isArray(report?.validation_methods) ? report.validation_methods : [];
  const interpretabilityMethods = Array.isArray(report?.interpretability_methods) ? report.interpretability_methods : [];

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-[1800px]">
        <AlphaHero />

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Artifact Status"
            value={<StatusPill status={status} />}
            note={`${loadedCount}/${ARTIFACTS.length} page artifacts loaded.`}
          />
          <MetricCard
            label="Generated"
            value={<span className="text-2xl">{formatDateTime(generatedAt)}</span>}
            note="Alpha report and forecast timestamp."
          />
          <MetricCard
            label="Data Through"
            value={formatDate(firstValue(report?.effective_data_through_date, forecast?.effective_data_through_date, modeStatus?.effective_data_through_date))}
            note={`Forecast start: ${formatDate(firstValue(report?.forecast_start_date, forecast?.forecast_start_date, modeStatus?.forecast_start_date))}`}
          />
          <MetricCard
            label="Latest 1D p50"
            value={formatUsd(latestForecastPoint?.p50)}
            note={
              latestForecastPoint
                ? `Expected change: ${formatUsd(latestForecastPoint.expected_change)} (${formatPercent(latestForecastPoint.expected_change_pct, 2)})`
                : "No latest forecast point found."
            }
          />
        </section>

        <section className="mt-10 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader
              eyebrow="Model Identity"
              title="Alpha Structural artifact summary"
              description="The page reads model identity, static split predictions, rolling-origin validation, latest forecast points, evaluation metrics, and SHAP behavior from Alpha artifacts only."
            />

            <div className="grid gap-3">
              <InfoLine label="Model name" value={modelName} />
              <InfoLine label="Model key" value={firstValue(report?.model_key, forecast?.model_key, runSummary?.model_key)} />
              <InfoLine label="Algorithm" value={report?.algorithm} />
              <InfoLine label="Model version" value={modelVersion} />
              <InfoLine label="Target strategy" value={report?.target_strategy} />
              <InfoLine label="Mode" value={firstValue(report?.mode, forecast?.mode, modeStatus?.mode)} />
              <InfoLine label="Study ID" value={firstValue(report?.study_id, forecast?.study_id, runSummary?.study_id)} />
              <InfoLine label="Run ID" value={firstValue(report?.run_id, forecast?.run_id, runSummary?.run_id)} />
              <InfoLine label="Compute device" value={report?.compute_device} />
              <InfoLine label="Runtime" value={report?.runtime_elapsed_hms || `${formatNumber(report?.runtime_elapsed_seconds, 1)} sec`} />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[2rem] border border-blue-100 bg-blue-50 p-5">
                <div className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                  Validation Methods
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {validationMethods.map((item: string) => (
                    <span
                      key={item}
                      className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5">
                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                  Interpretability Methods
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {interpretabilityMethods.map((item: string) => (
                    <span
                      key={item}
                      className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader eyebrow="Training Contract" title="Run configuration" />

            <div className="grid gap-4">
              <MetricCard
                label="Selected Features"
                value={formatNumber(report?.selected_feature_count)}
                note="From Alpha report."
              />
              <MetricCard
                label="Optuna Trials / Horizon"
                value={formatNumber(report?.n_trials_per_horizon)}
                note="From Alpha report."
              />
              <MetricCard
                label="Horizons"
                value={
                  <span className="text-2xl">
                    {Array.isArray(report?.horizons_trained)
                      ? report.horizons_trained.join(", ")
                      : "Not in artifact"}
                  </span>
                }
                note="Trading-day horizons trained."
              />
            </div>
          </div>
        </section>

        <ConditionalSection show={splitRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Main Split Forecast Graph"
              title={`Actual vs Alpha forecast — train, validation, and test (${selectedHorizon}-day horizon)`}
              description="This is the main professor-style graph. It uses evaluation_rollforward.csv, which contains train, validation, and test rows."
            />

            <ActualVsForecastChart
              rows={splitRows}
              forecastKey="forecast"
              forecastLabel="Alpha Structural Forecast"
              actualKey="actual"
              actualLabel="Actual Target Gold"
              title={`Actual vs Alpha Forecast — Train / Validation / Test (${selectedHorizon}D Horizon)`}
              subtitle="Static split predictions from evaluation_rollforward.csv. Use the brush to zoom across the full model window."
              yAxisLabel="Gold Price (USD/oz)"
              showSplitMarkers={true}
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={splitRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Split Residual Diagnostic"
              title={`Alpha residuals across train, validation, and test (${selectedHorizon}-day horizon)`}
              description="Residual equals actual target gold price minus Alpha predicted price."
            />

            <ResidualChart
              rows={splitRows}
              forecastKey="forecast"
              forecastLabel="Alpha Structural Forecast"
              actualKey="actual"
              title={`Alpha Residuals — Train / Validation / Test (${selectedHorizon}D Horizon)`}
              subtitle="Residual = actual target price minus Alpha predicted price."
              yAxisLabel="Actual - Alpha Forecast"
              showSplitMarkers={true}
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={recentTestRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Recent Test Zoom"
              title={`Recent test window — Alpha static split predictions (${selectedHorizon}-day horizon)`}
              description="This zoomed chart focuses only on recent test rows from evaluation_rollforward.csv."
            />

            <ActualVsForecastChart
              rows={recentTestRows}
              forecastKey="forecast"
              forecastLabel="Alpha Structural Forecast"
              actualKey="actual"
              actualLabel="Actual Target Gold"
              title={`Recent Test Actual vs Alpha Forecast (${selectedHorizon}D Horizon)`}
              subtitle="Recent test rows from the static split prediction file."
              yAxisLabel="Gold Price (USD/oz)"
              showSplitMarkers={false}
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={rollingRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Rolling-Origin Validation"
              title={`Rolling-origin validation — recent test origins (${selectedHorizon}-day horizon)`}
              description="This uses rolling_origin_predictions.csv and is intentionally separated from the full train/validation/test graph."
            />

            <ActualVsForecastChart
              rows={rollingRows}
              forecastKey="forecast"
              forecastLabel="Alpha Rolling Forecast"
              actualKey="actual"
              actualLabel="Actual Target Gold"
              title={`Rolling-Origin Actual vs Alpha Forecast (${selectedHorizon}D Horizon)`}
              subtitle="Rolling-origin test rows from Alpha artifact."
              yAxisLabel="Gold Price (USD/oz)"
              showSplitMarkers={false}
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={metricRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Train / Validation / Test Metrics"
              title="Split-based horizon metrics"
              description="These charts use evaluation_by_horizon.json and show professor-style train, validation, and test metrics by forecast horizon."
            />

            <div className="grid gap-6">
              <MetricComparisonChart
                rows={metricRows}
                split="train"
                xKey="horizon"
                xLabel="Forecast Horizon"
                yLabel="Gold Price Error"
                title="Alpha Train Error by Horizon"
                subtitle="Train split error metrics from evaluation_by_horizon.json."
                bars={[
                  { key: "MAE", label: "MAE", color: "#2563eb" },
                  { key: "RMSE", label: "RMSE", color: "#ca8a04" },
                ]}
              />

              <MetricComparisonChart
                rows={metricRows}
                split="validation"
                xKey="horizon"
                xLabel="Forecast Horizon"
                yLabel="Gold Price Error"
                title="Alpha Validation Error by Horizon"
                subtitle="Validation split error metrics from evaluation_by_horizon.json."
                bars={[
                  { key: "MAE", label: "MAE", color: "#2563eb" },
                  { key: "RMSE", label: "RMSE", color: "#ca8a04" },
                ]}
              />

              <MetricComparisonChart
                rows={metricRows}
                split="test"
                xKey="horizon"
                xLabel="Forecast Horizon"
                yLabel="Gold Price Error"
                title="Alpha Test Error by Horizon"
                subtitle="Test split error metrics from evaluation_by_horizon.json."
                bars={[
                  { key: "MAE", label: "MAE", color: "#2563eb" },
                  { key: "RMSE", label: "RMSE", color: "#ca8a04" },
                ]}
              />
            </div>
          </section>
        </ConditionalSection>

        <ConditionalSection show={metricRows.length > 0}>
          <section className="mt-14 grid gap-5 md:grid-cols-4">
            <MetricCard
              label="Avg Train MAPE"
              value={trainAvgMape === null ? "Not in artifact" : formatPercent(trainAvgMape)}
              note="Average across Alpha horizons."
            />
            <MetricCard
              label="Avg Validation MAPE"
              value={validationAvgMape === null ? "Not in artifact" : formatPercent(validationAvgMape)}
              note="Average across Alpha horizons."
            />
            <MetricCard
              label="Avg Test MAPE"
              value={testAvgMape === null ? "Not in artifact" : formatPercent(testAvgMape)}
              note="Average across Alpha horizons."
            />
            <MetricCard
              label="Avg Test Direction"
              value={testAvgDirection === null ? "Not in artifact" : formatPercent(testAvgDirection)}
              note="Average directional accuracy across Alpha horizons."
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={naiveRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Alpha vs Naive"
              title="Naive benchmark comparison by horizon"
              description="This section compares Alpha against the naive current-price benchmark using exported evaluation metrics. It is not a final Deep ML ranking."
            />

            <div className="grid gap-6">
              <MetricComparisonChart
                rows={naiveRows}
                split="test"
                xKey="horizon"
                xLabel="Forecast Horizon"
                yLabel="MAPE (%)"
                title="Alpha vs Naive Test MAPE"
                subtitle="Lower MAPE is generally better. Values come from evaluation_by_horizon.json."
                bars={[
                  { key: "AlphaMAPE", label: "Alpha MAPE", color: "#2563eb" },
                  { key: "NaiveMAPE", label: "Naive MAPE", color: "#ca8a04" },
                ]}
              />

              <MetricComparisonChart
                rows={naiveRows}
                split="test"
                xKey="horizon"
                xLabel="Forecast Horizon"
                yLabel="Gold Price Error"
                title="Alpha vs Naive Test MAE/RMSE"
                subtitle="Gold-price error comparison across horizons."
                bars={[
                  { key: "AlphaMAE", label: "Alpha MAE", color: "#2563eb" },
                  { key: "NaiveMAE", label: "Naive MAE", color: "#ca8a04" },
                  { key: "AlphaRMSE", label: "Alpha RMSE", color: "#16a34a" },
                  { key: "NaiveRMSE", label: "Naive RMSE", color: "#dc2626" },
                ]}
              />
            </div>
          </section>
        </ConditionalSection>

        <ConditionalSection show={improvementRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Improvement vs Naive"
              title="Alpha improvement by horizon"
              description="Positive values mean the exported metric improved versus the naive benchmark. This remains a benchmark view, not a final model ranking."
            />

            <MetricComparisonChart
              rows={improvementRows}
              split="test"
              xKey="horizon"
              xLabel="Forecast Horizon"
              yLabel="Improvement vs Naive (%)"
              title="Alpha Improvement vs Naive"
              subtitle="Improvement fields from Alpha report/evaluation artifacts."
              bars={[
                { key: "MAEImprovement", label: "MAE Improvement", color: "#2563eb" },
                { key: "RMSEImprovement", label: "RMSE Improvement", color: "#ca8a04" },
                { key: "MAPEImprovement", label: "MAPE Improvement", color: "#16a34a" },
                { key: "SMAPEImprovement", label: "sMAPE Improvement", color: "#dc2626" },
              ]}
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={forecastRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Latest Forecast Quantiles"
              title="Alpha latest p10 / p50 / p90 by horizon"
              description="This chart displays forecast_latest.json values. These are model output intervals, not guaranteed future ranges."
            />

            <MetricComparisonChart
              rows={forecastRows}
              split="latest"
              xKey="horizon"
              xLabel="Forecast Horizon"
              yLabel="Gold Price (USD/oz)"
              title="Alpha Latest Forecast Quantiles"
              subtitle="p10, p50, and p90 from forecast_latest.json."
              bars={[
                { key: "P10", label: "p10", color: "#2563eb" },
                { key: "P50", label: "p50", color: "#ca8a04" },
                { key: "P90", label: "p90", color: "#16a34a" },
              ]}
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={forecastPoints.length > 0}>
          <section className="mt-14 rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader
              eyebrow="Latest Forecast Table"
              title="Multi-horizon Alpha forecast points"
              description="This table displays forecast_latest.json directly. p10/p50/p90 are model outputs, not guarantees."
            />

            <LatestForecastTable rows={forecastPoints} />
          </section>
        </ConditionalSection>

        <ConditionalSection show={shapRows.length > 0 || Boolean(shapLatest?.latest_explanations_by_horizon)}>
          <section className="mt-14 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            {shapRows.length > 0 && (
              <div>
                <SectionHeader
                  eyebrow="Global SHAP"
                  title="Top structural behavior features"
                  description="SHAP explains how this trained XGBoost artifact used features. It does not prove macroeconomic causality."
                />

                <FeatureBars
                  rows={shapRows}
                  title="Global SHAP Feature Ranking"
                  valueKey="mean_abs_shap_across_horizons"
                  valueFormatter={(value) => formatNumber(value, 6)}
                  limit={18}
                />
              </div>
            )}

            {Boolean(shapLatest?.latest_explanations_by_horizon) && (
              <div>
                <SectionHeader
                  eyebrow="Latest Local SHAP"
                  title="Top local driver by horizon"
                  description="Latest local SHAP rows explain the latest-origin Alpha forecast behavior by horizon."
                />

                <LocalShapTable shapLatest={shapLatest} />
              </div>
            )}
          </section>
        </ConditionalSection>

        <section className="mt-14 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader
              eyebrow="Data Governance"
              title="Matrix context"
              description="These values are read from the feature-store manifest and governance artifacts."
            />

            <div className="grid gap-3">
              <InfoLine label="Matrix rows" value={formatNumber(matrixManifest?.row_count)} />
              <InfoLine label="Matrix columns" value={formatNumber(matrixManifest?.column_count)} />
              <InfoLine label="Start date" value={formatDate(matrixManifest?.date_range?.start)} />
              <InfoLine label="End date" value={formatDate(matrixManifest?.date_range?.end)} />
              <InfoLine label="Official cutoff" value={formatDate(matrixManifest?.official_cutoff)} />
              <InfoLine label="Post-cutoff rows" value={formatNumber(matrixManifest?.post_cutoff_row_count)} />
              <InfoLine label="Gold source" value={matrixManifest?.gold_live_source?.source_type} />
              <InfoLine label="FRED series used" value={formatNumber(matrixManifest?.fred_merge_summary?.fred_series_used_in_merge)} />
            </div>
          </div>

          <div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader
              eyebrow="Future Patch List"
              title="Deferred cross-model enhancements"
              description="These remain deferred until Gamma/Omega/news artifacts are accepted."
            />

            <div className="grid gap-3 text-sm font-semibold leading-6 text-slate-600">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                Add news-aware chart tooltips after Gamma/Omega/news context artifacts are accepted.
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                Add per-date decision-variable values only if future prediction artifacts export feature values by origin date.
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                Patch Overview date-only display together with Gamma/Omega activation.
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
          <SectionHeader
            eyebrow="Artifact Downloads"
            title="Source files used on this page"
            description="The Alpha page uses only sections supported by real artifact rows and drops unsupported graph sections."
          />

          <ArtifactDownloads results={results} />
        </section>
      </div>
    </main>
  );
}