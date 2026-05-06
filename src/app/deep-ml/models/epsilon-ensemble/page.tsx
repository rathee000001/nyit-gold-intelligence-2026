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
    label: "Epsilon Expert Report",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/phase9_epsilon_expert_report.json",
    kind: "json",
  },
  {
    key: "runSummary",
    label: "Run Summary",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/run_summary.json",
    kind: "json",
  },
  {
    key: "forecast",
    label: "Latest Forecast",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/forecast_latest.json",
    kind: "json",
  },
  {
    key: "evaluation",
    label: "Evaluation by Horizon",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/evaluation_by_horizon.json",
    kind: "json",
  },
  {
    key: "evaluationRollforward",
    label: "Evaluation Rollforward",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/evaluation_rollforward.csv",
    kind: "csv",
  },
  {
    key: "evaluationRollforwardSummary",
    label: "Evaluation Rollforward Summary",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/evaluation_rollforward_summary.json",
    kind: "json",
  },
  {
    key: "rollingOriginPredictions",
    label: "Rolling-Origin Predictions",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/rolling_origin_predictions.csv",
    kind: "csv",
  },
  {
    key: "rollingOriginMetrics",
    label: "Rolling-Origin Metrics",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/rolling_origin_metrics.json",
    kind: "json",
  },
  {
    key: "componentRanking",
    label: "Component Ranking",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/component_ranking.json",
    kind: "json",
  },
  {
    key: "componentWeights",
    label: "Component Weights",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/component_weights.json",
    kind: "json",
  },
  {
    key: "expertDisagreement",
    label: "Expert Disagreement",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/expert_disagreement.json",
    kind: "json",
  },
  {
    key: "uncertainty",
    label: "Uncertainty Latest",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/uncertainty_latest.json",
    kind: "json",
  },
  {
    key: "residualCalibration",
    label: "Residual Interval Calibration",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/residual_interval_calibration.json",
    kind: "json",
  },
  {
    key: "componentModels",
    label: "Component Models",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/component_models.json",
    kind: "json",
  },
  {
    key: "componentEvaluation",
    label: "Component Evaluation by Horizon",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/component_evaluation_by_horizon.json",
    kind: "json",
  },
  {
    key: "qualityReview",
    label: "Quality Review",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/quality_review.json",
    kind: "json",
  },
  {
    key: "datasetManifest",
    label: "Epsilon Dataset Manifest",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/epsilon_dataset_manifest.json",
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

const DOWNLOAD_ONLY_ARTIFACTS: ArtifactRequest[] = [
  {
    key: "componentForecasts",
    label: "Component Forecasts",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/component_forecasts.csv",
    kind: "csv",
  },
  {
    key: "ensembleForecast",
    label: "Ensemble Forecast",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/ensemble_forecast.json",
    kind: "json",
  },
  {
    key: "componentDiagnostics",
    label: "Component Diagnostics",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/component_diagnostics.json",
    kind: "json",
  },
  {
    key: "diagnosticsLatest",
    label: "Diagnostics Latest",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/diagnostics_latest.json",
    kind: "json",
  },
  {
    key: "timeline",
    label: "Timeline",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/timeline.json",
    kind: "json",
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

  return lines.slice(1).filter(Boolean).map((line) => {
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

function formatWeight(value: any) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";
  return `${(numeric * 100).toFixed(2)}%`;
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

function average(values: any[]) {
  const nums = values.map(Number).filter((value) => Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
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
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(status)}`}
    >
      {status || "Not in artifact"}
    </span>
  );
}

function ConditionalSection({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show) return null;
  return <>{children}</>;
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
  const empty = value === null || value === undefined || value === "";

  return (
    <div className="grid grid-cols-[190px_1fr] gap-3 border-b border-slate-100 pb-3 last:border-b-0">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <span className="break-words text-sm font-bold text-slate-700">
        {empty ? "Not in artifact" : value}
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

function EpsilonHero() {
  const particles = Array.from({ length: 36 }, (_, index) => {
    const left = 5 + ((index * 29) % 90);
    const top = 9 + ((index * 41) % 78);

    return (
      <span
        key={index}
        className="epsilon-particle"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          animationDelay: `${index * 0.1}s`,
        }}
      />
    );
  });

  return (
    <div className="relative min-h-[430px] overflow-hidden rounded-[3rem] border border-slate-200 bg-slate-950 p-8 shadow-2xl shadow-violet-950/20">
      <style>{`
        .epsilon-grid {
          background-image:
            linear-gradient(rgba(168, 85, 247, 0.14) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168, 85, 247, 0.14) 1px, transparent 1px);
          background-size: 34px 34px;
          animation: epsilon-grid-move 19s linear infinite;
        }

        .epsilon-symbol {
          position: absolute;
          right: 10%;
          top: 13%;
          width: 250px;
          height: 250px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          color: rgba(216, 180, 254, 0.98);
          font-size: 132px;
          font-weight: 1000;
          background:
            radial-gradient(circle at 35% 30%, rgba(168, 85, 247, 0.42), transparent 35%),
            radial-gradient(circle at 74% 74%, rgba(250, 204, 21, 0.18), transparent 38%),
            rgba(15, 23, 42, 0.62);
          border: 1px solid rgba(216, 180, 254, 0.35);
          box-shadow:
            0 0 85px rgba(168, 85, 247, 0.26),
            inset 0 0 80px rgba(216, 180, 254, 0.15);
          animation: epsilon-float 5.6s ease-in-out infinite;
        }

        .epsilon-orbit {
          position: absolute;
          right: 5%;
          bottom: 10%;
          width: 610px;
          height: 190px;
          opacity: .95;
        }

        .epsilon-ring {
          position: absolute;
          border: 2px solid rgba(216, 180, 254, .22);
          border-radius: 999px;
          box-shadow: 0 0 28px rgba(168, 85, 247, .24);
          animation: epsilon-ring 3.4s ease-in-out infinite;
        }

        .epsilon-ring.r1 { left: 35px; top: 40px; width: 500px; height: 120px; transform: rotate(-10deg); }
        .epsilon-ring.r2 { left: 75px; top: 55px; width: 420px; height: 90px; transform: rotate(10deg); animation-delay: .3s; }
        .epsilon-ring.r3 { left: 150px; top: 72px; width: 260px; height: 56px; transform: rotate(0deg); animation-delay: .6s; }

        .epsilon-particle {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: rgba(250, 204, 21, .96);
          box-shadow: 0 0 18px rgba(250, 204, 21, .82), 0 0 36px rgba(168, 85, 247, .35);
          animation: epsilon-pulse 2.35s ease-in-out infinite;
        }

        @keyframes epsilon-grid-move {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(34px, 34px, 0); }
        }

        @keyframes epsilon-float {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-4deg); }
          50% { transform: translate3d(0, -17px, 0) rotate(4deg); }
        }

        @keyframes epsilon-pulse {
          0%, 100% { opacity: .38; transform: scale(.65); }
          50% { opacity: 1; transform: scale(1.35); }
        }

        @keyframes epsilon-ring {
          0%, 100% { opacity: .35; }
          50% { opacity: 1; }
        }
      `}</style>

      <div className="epsilon-grid absolute inset-0 opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(250,204,21,0.13),transparent_29%),radial-gradient(circle_at_66%_46%,rgba(168,85,247,0.32),transparent_38%),radial-gradient(circle_at_90%_90%,rgba(59,130,246,0.16),transparent_35%)]" />

      <div className="epsilon-symbol">ε</div>
      <div className="epsilon-orbit">
        <span className="epsilon-ring r1" />
        <span className="epsilon-ring r2" />
        <span className="epsilon-ring r3" />
      </div>
      {particles}

      <div className="relative z-10 flex min-h-[360px] max-w-4xl flex-col justify-between">
        <div>
          <div className="inline-flex rounded-full border border-violet-300/30 bg-violet-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-violet-100">
            Epsilon Expert Ensemble
          </div>
          <h1 className="mt-8 text-5xl font-black tracking-tight text-white md:text-7xl">
            Epsilon Ensemble
          </h1>
          <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-violet-50/80">
            Statistical, benchmark, and machine-learning guardrail layer. This page uses the
            full train, validation, and test rollforward artifact for the main Epsilon graph.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Symbol
            </div>
            <div className="mt-2 text-sm font-black text-white">ε / expert ensemble</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Main Graph Source
            </div>
            <div className="mt-2 text-sm font-black text-white">evaluation_rollforward.csv</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Guardrail
            </div>
            <div className="mt-2 text-sm font-black text-white">Benchmark layer, not final winner</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function rowHorizon(row: any) {
  return Number(firstValue(row.horizon, row.horizon_trading_days));
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
    .filter((row) => rowHorizon(row) === horizon)
    .map((row) => {
      const p10 = asNumber(firstValue(row.forecast_price_p10, row.p10));
      const p50 = asNumber(firstValue(row.prediction, row.forecast_price_p50, row.p50));
      const p90 = asNumber(firstValue(row.forecast_price_p90, row.p90));

      return {
        date: String(firstValue(row.date, row.origin_date)),
        ...getGammaContextForDate(gammaLookup, firstValue(row.date, row.origin_date)),
        split: String(firstValue(row.split, "test")),
        actual: asNumber(firstValue(row.actual_target, row.actual_gold_price)),
        forecast: p50,
        naiveForecast: asNumber(row.naive_prediction),
        p10,
        p50,
        p90,
        currentGold: asNumber(firstValue(row.gold_price, row.raw_gold_price_anchor)),
        predictedLogReturn: asNumber(firstValue(row.predicted_log_return, row.predicted_log_return_p50)),
        intervalWidth: asNumber(row.interval_width_price),
        epsilonError: asNumber(row.error),
      };
    })
    .filter((row) => row.actual !== null && row.forecast !== null);
}

function buildRollingRows(rows: any[], horizon = 10, gammaLookup: GammaDateContextLookup = {}): ForecastChartRow[] {
  return rows
    .filter((row) => rowHorizon(row) === horizon)
    .map((row) => ({
      date: String(firstValue(row.date, row.origin_date)),
      ...getGammaContextForDate(gammaLookup, firstValue(row.date, row.origin_date)),
      split: "rolling_test",
      actual: asNumber(firstValue(row.actual_target, row.actual_gold_price)),
      forecast: asNumber(firstValue(row.prediction, row.forecast_price_p50, row.p50)),
      naiveForecast: asNumber(row.naive_prediction),
      currentGold: asNumber(firstValue(row.gold_price, row.raw_gold_price_anchor)),
      predictedLogReturn: asNumber(firstValue(row.predicted_log_return, row.predicted_log_return_p50)),
      intervalWidth: asNumber(row.interval_width_price),
      epsilonError: asNumber(row.error),
    }))
    .filter((row) => row.actual !== null && row.forecast !== null);
}

function buildMetricRows(evaluation: any): MetricChartRow[] {
  const rows: MetricChartRow[] = [];

  for (const split of ["train", "validation", "test"]) {
    const splitMetrics = evaluation?.[split];
    if (!splitMetrics) continue;

    for (const horizon of Object.keys(splitMetrics).sort((a, b) => Number(a) - Number(b))) {
      const item = splitMetrics[horizon];

      rows.push({
        split,
        horizon: `${horizon}D`,
        label: `${horizon}D`,
        MAE: item.mae,
        RMSE: item.rmse,
        MAPE: item.mape_pct,
        SMAPE: item.smape_pct,
        DirectionalAccuracy: item.directional_accuracy_pct,
        Bias: item.bias_mean_error,
      });
    }
  }

  return rows;
}

function buildNaiveRows(evaluation: any): MetricChartRow[] {
  const rows: MetricChartRow[] = [];
  const test = evaluation?.test || {};
  const naive = evaluation?.naive_baseline_test || {};

  for (const horizon of Object.keys(test).sort((a, b) => Number(a) - Number(b))) {
    const modelRow = test[horizon];
    const naiveRow = naive[horizon];

    if (!modelRow || !naiveRow) continue;

    rows.push({
      split: "test",
      horizon: `${horizon}D`,
      label: `${horizon}D`,
      EpsilonMAPE: modelRow.mape_pct,
      NaiveMAPE: naiveRow.mape_pct,
      EpsilonMAE: modelRow.mae,
      NaiveMAE: naiveRow.mae,
      EpsilonRMSE: modelRow.rmse,
      NaiveRMSE: naiveRow.rmse,
    });
  }

  return rows;
}

function buildLatestQuantileRows(forecast: any): MetricChartRow[] {
  const rows = forecast?.path || [];

  return rows.map((row: any) => ({
    split: "latest",
    horizon: `${row.horizon_trading_days}D`,
    label: `${row.horizon_trading_days}D`,
    P10: row.forecast_price_p10,
    P50: row.forecast_price_p50,
    P90: row.forecast_price_p90,
  }));
}

function buildCoverageRows(uncertainty: any, splitKey: string, splitLabel: string): MetricChartRow[] {
  const byHorizon = uncertainty?.[splitKey] || {};

  return Object.keys(byHorizon)
    .sort((a, b) => Number(a) - Number(b))
    .map((horizon) => {
      const row = byHorizon[horizon];

      return {
        split: splitLabel,
        horizon: `${horizon}D`,
        label: `${horizon}D`,
        Coverage: row.coverage_p10_p90_pct,
        Target: uncertainty?.coverage_target_pct ?? 80,
        Width: row.mean_interval_width_price,
        CalibrationError: row.calibration_error_vs_80pct_abs,
      };
    })
    .filter((row) => Number.isFinite(Number(row.Coverage)));
}

function buildResidualCalibrationRows(calibration: any): MetricChartRow[] {
  const byHorizon = calibration?.by_horizon || {};

  return Object.keys(byHorizon)
    .sort((a, b) => Number(a) - Number(b))
    .map((horizon) => {
      const row = byHorizon[horizon];

      return {
        split: "residual_calibration",
        horizon: `${horizon}D`,
        label: `${horizon}D`,
        LowerP10: row.lower_residual_p10,
        UpperP90: row.upper_residual_p90,
        MedianAbsResidual: row.median_abs_residual,
        TargetCoverage: row.target_coverage_pct,
      };
    })
    .filter((row) => Number.isFinite(Number(row.MedianAbsResidual)));
}

function buildDisagreementRows(disagreement: any, splitKey: string, splitLabel: string): MetricChartRow[] {
  const byHorizon = disagreement?.[splitKey] || {};

  return Object.keys(byHorizon)
    .sort((a, b) => Number(a) - Number(b))
    .map((horizon) => {
      const row = byHorizon[horizon];

      return {
        split: splitLabel,
        horizon: `${horizon}D`,
        label: `${horizon}D`,
        PriceDisagreementStd: row.mean_price_disagreement_std,
        MedianDisagreementStd: row.median_price_disagreement_std,
        DisagreementPct: row.mean_disagreement_pct_of_forecast,
      };
    })
    .filter((row) => Number.isFinite(Number(row.PriceDisagreementStd)));
}

function buildRankingRows(componentRanking: any) {
  const ranking = componentRanking?.ranking || [];
  return Array.isArray(ranking) ? ranking : [];
}

function buildWeightRows(componentWeights: any, horizon = 10) {
  const weights = componentWeights?.weights_by_horizon?.[String(horizon)] || {};

  return Object.keys(weights)
    .map((key) => ({
      feature: key,
      value: weights[key],
    }))
    .filter((row) => Number.isFinite(Number(row.value)))
    .sort((a, b) => Number(b.value) - Number(a.value));
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
  featureKey,
  valueKey,
  title,
  valueFormatter,
  limit = 18,
}: {
  rows: any[];
  featureKey: string;
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
            <div key={`${row[featureKey]}-${index}`}>
              <div className="mb-2 flex items-center justify-between gap-4">
                <div className="truncate text-xs font-black text-slate-700">{row[featureKey]}</div>
                <div className="text-xs font-black text-slate-500">
                  {valueFormatter ? valueFormatter(value) : formatNumber(value, 6)}
                </div>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-950"
                  style={{ width: `${width}%` }}
                  title={`${row[featureKey]}: ${formatNumber(value, 8)}. This explains model behavior, not causality.`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RankingTable({ rows }: { rows: any[] }) {
  if (!rows.length) return null;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-4 bg-slate-50 px-5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">
        <span>Rank</span>
        <span>Component</span>
        <span>Validation MAPE</span>
        <span>Test MAPE</span>
      </div>

      {rows.slice(0, 15).map((row: any) => (
        <div
          key={`${row.rank}-${row.component_key}`}
          className="grid grid-cols-4 border-t border-slate-100 px-5 py-4 text-xs font-bold text-slate-700"
        >
          <span>{row.rank}</span>
          <span>{row.component_key}</span>
          <span>{formatPercent(row.validation_average_mape_pct)}</span>
          <span>{formatPercent(row.test_average_mape_pct)}</span>
        </div>
      ))}
    </div>
  );
}

function LatestForecastTable({ forecast }: { forecast: any }) {
  const rows = forecast?.path || [];

  if (!rows.length) return null;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-7 bg-slate-50 px-5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">
        <span>Horizon</span>
        <span>Forecast Date</span>
        <span>Origin Gold</span>
        <span>p10</span>
        <span>p50</span>
        <span>p90</span>
        <span>Origin</span>
      </div>

      {rows.map((row: any) => (
        <div
          key={`${row.horizon_trading_days}-${row.forecast_date_business_day_approx}`}
          className="grid grid-cols-7 border-t border-slate-100 px-5 py-4 text-xs font-bold text-slate-700"
        >
          <span>{row.horizon_trading_days}D</span>
          <span>{row.forecast_date_business_day_approx}</span>
          <span>{formatUsd(row.raw_gold_price_anchor)}</span>
          <span>{formatUsd(row.forecast_price_p10)}</span>
          <span>{formatUsd(row.forecast_price_p50)}</span>
          <span>{formatUsd(row.forecast_price_p90)}</span>
          <span>{row.origin_date}</span>
        </div>
      ))}
    </div>
  );
}

function ArtifactDownloads({ results }: { results: ArtifactResult[] }) {
  const allArtifacts = [...ARTIFACTS, ...DOWNLOAD_ONLY_ARTIFACTS];

  return (
    <div className="grid gap-3">
      {allArtifacts.map((artifact) => {
        const result = results.find((item) => item.key === artifact.key);
        const isDownloadOnly = DOWNLOAD_ONLY_ARTIFACTS.some((item) => item.key === artifact.key);

        return (
          <div
            key={artifact.key}
            className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black text-slate-900">{artifact.label}</span>
                <StatusPill status={isDownloadOnly ? "download only" : result?.ok ? "loaded" : "missing"} />
              </div>
              <div className="mt-2 break-all text-xs font-semibold text-slate-500">
                {artifact.path}
              </div>
              {!isDownloadOnly && !result?.ok && result?.error && (
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

export default async function EpsilonEnsemblePage() {
  const results = await loadArtifacts();

  const report = getArtifact(results, "report");
  const runSummary = getArtifact(results, "runSummary");
  const forecast = getArtifact(results, "forecast");
  const evaluation = getArtifact(results, "evaluation");
  const evaluationRollforward = getArtifact(results, "evaluationRollforward") || [];
  const evaluationRollforwardSummary = getArtifact(results, "evaluationRollforwardSummary");
  const rollingOriginPredictions = getArtifact(results, "rollingOriginPredictions") || [];
  const componentRanking = getArtifact(results, "componentRanking");
  const componentWeights = getArtifact(results, "componentWeights");
  const expertDisagreement = getArtifact(results, "expertDisagreement");
  const uncertainty = getArtifact(results, "uncertainty");
  const residualCalibration = getArtifact(results, "residualCalibration");
  const componentModels = getArtifact(results, "componentModels");
  const qualityReview = getArtifact(results, "qualityReview");
  const datasetManifest = getArtifact(results, "datasetManifest");
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
  const latestQuantileRows = buildLatestQuantileRows(forecast);
  const validationCoverageRows = buildCoverageRows(uncertainty, "validation_coverage_by_horizon", "validation_coverage");
  const testCoverageRows = buildCoverageRows(uncertainty, "coverage_by_horizon", "test_coverage");
  const residualCalibrationRows = buildResidualCalibrationRows(residualCalibration);
  const validationDisagreementRows = buildDisagreementRows(expertDisagreement, "validation_disagreement_by_horizon", "validation_disagreement");
  const testDisagreementRows = buildDisagreementRows(expertDisagreement, "test_disagreement_by_horizon", "test_disagreement");
  const rankingRows = buildRankingRows(componentRanking);
  const weightRows = buildWeightRows(componentWeights, selectedHorizon);

  const trainAvgMape = splitMetricAverage(metricRows, "train", "MAPE");
  const validationAvgMape = splitMetricAverage(metricRows, "validation", "MAPE");
  const testAvgMape = splitMetricAverage(metricRows, "test", "MAPE");
  const testAvgDirection = splitMetricAverage(metricRows, "test", "DirectionalAccuracy");

  const avgTestCoverage = average(testCoverageRows.map((row) => row.Coverage));
  const avgTestWidth = average(testCoverageRows.map((row) => row.Width));
  const avgTestDisagreement = average(testDisagreementRows.map((row) => row.PriceDisagreementStd));

  const pathRows = forecast?.path || [];
  const latestOneDay = pathRows[0];

  const modelName = firstValue(report?.model_name, runSummary?.model_name, forecast?.model_name, "Epsilon Expert Ensemble");
  const status = firstValue(report?.status, qualityReview?.status, runSummary?.status);
  const generatedAt = firstValue(
    report?.run_summary?.run?.completed_at_utc,
    runSummary?.run?.completed_at_utc,
    forecast?.generated_at_utc
  );

  const selectedStrategy = firstValue(
    evaluationRollforwardSummary?.selected_ensemble_strategy,
    report?.run_summary?.model?.selected_ensemble_strategy,
    forecast?.selected_ensemble_strategy
  );

  const selectedComponent = firstValue(
    evaluationRollforwardSummary?.selected_component_key,
    report?.component_summary?.selected_component_key,
    "rolling_mean_20_gap"
  );

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-[1800px]">
        <EpsilonHero />

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Artifact Status"
            value={<StatusPill status={status || "loaded"} />}
            note={`${loadedCount}/${ARTIFACTS.length} page artifacts loaded.`}
          />
          <MetricCard
            label="Generated"
            value={<span className="text-2xl">{formatDateTime(generatedAt)}</span>}
            note="Epsilon report / forecast timestamp."
          />
          <MetricCard
            label="Latest 1D p50"
            value={formatUsd(latestOneDay?.forecast_price_p50)}
            note="Latest p50 from forecast_latest.json."
          />
          <MetricCard
            label="Rollforward Rows"
            value={formatNumber(evaluationRollforwardSummary?.rows)}
            note={`Train ${formatNumber(evaluationRollforwardSummary?.splits?.train)} / Validation ${formatNumber(evaluationRollforwardSummary?.splits?.validation)} / Test ${formatNumber(evaluationRollforwardSummary?.splits?.test)}`}
          />
        </section>

        <section className="mt-10 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader
              eyebrow="Model Identity"
              title="Epsilon Expert Ensemble artifact summary"
              description="Epsilon is displayed as a benchmark and expert-ensemble guardrail layer. It compares classical, statistical, and lag-feature machine-learning components under the shared Deep ML contract."
            />

            <div className="grid gap-3">
              <InfoLine label="Model name" value={modelName} />
              <InfoLine label="Model key" value={firstValue(report?.model_key, runSummary?.model_key, forecast?.model_key)} />
              <InfoLine label="Family" value={firstValue(report?.run_summary?.family, runSummary?.family)} />
              <InfoLine label="Target" value={firstValue(report?.run_summary?.model?.target, runSummary?.model?.target, forecast?.target)} />
              <InfoLine label="Reconstruction" value={firstValue(report?.run_summary?.model?.forecast_reconstruction, runSummary?.model?.forecast_reconstruction, forecast?.forecast_reconstruction)} />
              <InfoLine label="Selected strategy" value={selectedStrategy} />
              <InfoLine label="Selected component" value={selectedComponent} />
              <InfoLine label="Run ID" value={firstValue(report?.run_summary?.run?.run_id, runSummary?.run?.run_id)} />
              <InfoLine label="Study ID" value={firstValue(report?.run_summary?.run?.study_id, runSummary?.run?.study_id)} />
              <InfoLine label="Git commit" value={firstValue(report?.run_summary?.run?.git_commit_sha, runSummary?.run?.git_commit_sha)} />
            </div>
          </div>

          <div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader eyebrow="Benchmark Contract" title="Run configuration" />

            <div className="grid gap-4">
              <MetricCard
                label="Component Count"
                value={formatNumber(firstValue(report?.run_summary?.model?.component_count, report?.component_summary?.component_count, componentModels?.component_count))}
                note="Benchmark, statistical, and lag-feature components."
              />
              <MetricCard
                label="Used Features"
                value={formatNumber(firstValue(report?.run_summary?.features?.used_count, datasetManifest?.feature_count))}
                note="Feature count from report / dataset manifest."
              />
              <MetricCard
                label="Uncertainty Method"
                value={<span className="text-xl">{firstValue(report?.run_summary?.model?.uncertainty_method, uncertainty?.method)}</span>}
                note="Intervals estimate uncertainty; they are not guarantees."
              />
            </div>
          </div>
        </section>

        <ConditionalSection show={splitRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Main Split Forecast Graph"
              title={`Actual vs Epsilon forecast — train, validation, and test (${selectedHorizon}-day horizon)`}
              description="This is the main professor-style graph. It uses evaluation_rollforward.csv and displays the selected Epsilon p50 forecast path."
            />

            <ActualVsForecastChart
              rows={splitRows}
              forecastKey="forecast"
              forecastLabel="Epsilon Forecast"
              actualKey="actual"
              actualLabel="Actual Target Gold"
              title={`Actual vs Epsilon Forecast — Train / Validation / Test (${selectedHorizon}D Horizon)`}
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
              title={`Epsilon residuals across train, validation, and test (${selectedHorizon}-day horizon)`}
              description="Residual equals actual target gold price minus Epsilon predicted price."
            />

            <ResidualChart
              rows={splitRows}
              forecastKey="forecast"
              forecastLabel="Epsilon Forecast"
              actualKey="actual"
              title={`Epsilon Residuals — Train / Validation / Test (${selectedHorizon}D Horizon)`}
              subtitle="Residual = actual target price minus Epsilon forecast."
              yAxisLabel="Actual - Epsilon Forecast"
              showSplitMarkers={true}
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={recentTestRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Recent Test Zoom"
              title={`Recent test window — Epsilon forecast (${selectedHorizon}-day horizon)`}
              description="This zoomed chart focuses only on recent test rows from evaluation_rollforward.csv."
            />

            <ActualVsForecastChart
              rows={recentTestRows}
              forecastKey="forecast"
              forecastLabel="Epsilon Forecast"
              actualKey="actual"
              actualLabel="Actual Target Gold"
              title={`Recent Test Actual vs Epsilon Forecast (${selectedHorizon}D Horizon)`}
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
              title={`Rolling-origin Epsilon forecast — recent test origins (${selectedHorizon}-day horizon)`}
              description="This uses rolling_origin_predictions.csv and is intentionally separated from the full train/validation/test graph."
            />

            <ActualVsForecastChart
              rows={rollingRows}
              forecastKey="forecast"
              forecastLabel="Epsilon Rolling Forecast"
              actualKey="actual"
              actualLabel="Actual Target Gold"
              title={`Rolling-Origin Actual vs Epsilon Forecast (${selectedHorizon}D Horizon)`}
              subtitle="Source: rolling_origin_predictions.csv."
              yAxisLabel="Gold Price (USD/oz)"
              showSplitMarkers={false}
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={metricRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Train / Validation / Test Metrics"
              title="Split-based Epsilon point metrics"
              description="These charts use evaluation_by_horizon.json and display the selected Epsilon p50 forecast metrics."
            />

            <div className="grid gap-6">
              <MetricComparisonChart
                rows={metricRows}
                split="train"
                xKey="horizon"
                xLabel="Forecast Horizon"
                yLabel="Gold Price Error"
                title="Epsilon Train Error by Horizon"
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
                title="Epsilon Validation Error by Horizon"
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
                title="Epsilon Test Error by Horizon"
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
              note="Average across horizons."
            />
            <MetricCard
              label="Avg Validation MAPE"
              value={validationAvgMape === null ? "Not in artifact" : formatPercent(validationAvgMape)}
              note="Average across horizons."
            />
            <MetricCard
              label="Avg Test MAPE"
              value={testAvgMape === null ? "Not in artifact" : formatPercent(testAvgMape)}
              note="Average across horizons."
            />
            <MetricCard
              label="Avg Test Direction"
              value={testAvgDirection === null ? "Not in artifact" : formatPercent(testAvgDirection)}
              note="Average directional accuracy."
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={naiveRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Epsilon vs Naive"
              title="Naive benchmark comparison"
              description="This section compares Epsilon against the naive current-price benchmark. It is a benchmark view, not a final Deep ML ranking."
            />

            <div className="grid gap-6">
              <MetricComparisonChart
                rows={naiveRows}
                split="test"
                xKey="horizon"
                xLabel="Forecast Horizon"
                yLabel="MAPE (%)"
                title="Epsilon vs Naive Test MAPE"
                subtitle="Lower MAPE is generally better."
                bars={[
                  { key: "EpsilonMAPE", label: "Epsilon MAPE", color: "#2563eb" },
                  { key: "NaiveMAPE", label: "Naive MAPE", color: "#ca8a04" },
                ]}
              />

              <MetricComparisonChart
                rows={naiveRows}
                split="test"
                xKey="horizon"
                xLabel="Forecast Horizon"
                yLabel="Gold Price Error"
                title="Epsilon vs Naive Test MAE/RMSE"
                subtitle="Gold-price error comparison across horizons."
                bars={[
                  { key: "EpsilonMAE", label: "Epsilon MAE", color: "#2563eb" },
                  { key: "NaiveMAE", label: "Naive MAE", color: "#ca8a04" },
                  { key: "EpsilonRMSE", label: "Epsilon RMSE", color: "#16a34a" },
                  { key: "NaiveRMSE", label: "Naive RMSE", color: "#dc2626" },
                ]}
              />
            </div>
          </section>
        </ConditionalSection>

        <ConditionalSection show={latestQuantileRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Latest Forecast"
              title="Epsilon p10 / p50 / p90 by horizon"
              description="Latest Epsilon forecast path from forecast_latest.json. Intervals are residual-based uncertainty estimates, not guaranteed ranges."
            />

            <MetricComparisonChart
              rows={latestQuantileRows}
              split="latest"
              xKey="horizon"
              xLabel="Forecast Horizon"
              yLabel="Gold Price (USD/oz)"
              title="Epsilon Latest Forecast Quantiles"
              subtitle="p10, p50, and p90 by forecast horizon."
              bars={[
                { key: "P10", label: "p10", color: "#2563eb" },
                { key: "P50", label: "p50", color: "#ca8a04" },
                { key: "P90", label: "p90", color: "#16a34a" },
              ]}
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={validationCoverageRows.length > 0 || testCoverageRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Residual Interval Coverage"
              title="Epsilon p10-p90 interval coverage"
              description="Coverage compares empirical p10-p90 containment against the target. It is a diagnostic, not a guarantee."
            />

            <div className="grid gap-6">
              {validationCoverageRows.length > 0 && (
                <MetricComparisonChart
                  rows={validationCoverageRows}
                  split="validation_coverage"
                  xKey="horizon"
                  xLabel="Forecast Horizon"
                  yLabel="Coverage (%)"
                  title="Epsilon Validation Coverage"
                  subtitle="Validation residual interval coverage by horizon."
                  bars={[
                    { key: "Coverage", label: "Observed Coverage", color: "#2563eb" },
                    { key: "Target", label: "Target Coverage", color: "#ca8a04" },
                  ]}
                />
              )}

              {testCoverageRows.length > 0 && (
                <MetricComparisonChart
                  rows={testCoverageRows}
                  split="test_coverage"
                  xKey="horizon"
                  xLabel="Forecast Horizon"
                  yLabel="Coverage / Error"
                  title="Epsilon Test Coverage"
                  subtitle="Observed coverage, target coverage, and coverage error."
                  bars={[
                    { key: "Coverage", label: "Coverage %", color: "#2563eb" },
                    { key: "Target", label: "Target %", color: "#ca8a04" },
                    { key: "CalibrationError", label: "Coverage Error", color: "#dc2626" },
                  ]}
                />
              )}
            </div>
          </section>
        </ConditionalSection>

        <ConditionalSection show={residualCalibrationRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Residual Calibration"
              title="Validation-residual interval calibration"
              description="The residual interval layer uses validation residual behavior. It estimates uncertainty but does not guarantee future prices."
            />

            <MetricComparisonChart
              rows={residualCalibrationRows}
              split="residual_calibration"
              xKey="horizon"
              xLabel="Forecast Horizon"
              yLabel="Residual / Coverage"
              title="Epsilon Residual Calibration Summary"
              subtitle="Residual p10, residual p90, median absolute residual, and target coverage."
              bars={[
                { key: "LowerP10", label: "Lower Residual p10", color: "#2563eb" },
                { key: "UpperP90", label: "Upper Residual p90", color: "#ca8a04" },
                { key: "MedianAbsResidual", label: "Median Abs Residual", color: "#16a34a" },
                { key: "TargetCoverage", label: "Target Coverage", color: "#dc2626" },
              ]}
            />
          </section>
        </ConditionalSection>

        <section className="mt-14 grid gap-5 md:grid-cols-3">
          <MetricCard
            label="Avg Test Coverage"
            value={avgTestCoverage === null ? "Not in artifact" : formatPercent(avgTestCoverage)}
            note="Average test p10-p90 coverage."
          />
          <MetricCard
            label="Avg Test Width"
            value={avgTestWidth === null ? "Not in artifact" : formatUsd(avgTestWidth)}
            note="Average residual interval width."
          />
          <MetricCard
            label="Avg Expert Disagreement"
            value={avgTestDisagreement === null ? "Not in artifact" : formatUsd(avgTestDisagreement)}
            note="Average test price disagreement standard deviation."
          />
        </section>

        <ConditionalSection show={validationDisagreementRows.length > 0 || testDisagreementRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Expert Disagreement"
              title="Component disagreement by horizon"
              description="Disagreement shows spread across Epsilon components. It explains model behavior and uncertainty context, not causality."
            />

            <div className="grid gap-6">
              {validationDisagreementRows.length > 0 && (
                <MetricComparisonChart
                  rows={validationDisagreementRows}
                  split="validation_disagreement"
                  xKey="horizon"
                  xLabel="Forecast Horizon"
                  yLabel="Disagreement"
                  title="Validation Expert Disagreement"
                  subtitle="Validation component disagreement by horizon."
                  bars={[
                    { key: "PriceDisagreementStd", label: "Mean Price Std", color: "#2563eb" },
                    { key: "MedianDisagreementStd", label: "Median Price Std", color: "#ca8a04" },
                    { key: "DisagreementPct", label: "Disagreement %", color: "#16a34a" },
                  ]}
                />
              )}

              {testDisagreementRows.length > 0 && (
                <MetricComparisonChart
                  rows={testDisagreementRows}
                  split="test_disagreement"
                  xKey="horizon"
                  xLabel="Forecast Horizon"
                  yLabel="Disagreement"
                  title="Test Expert Disagreement"
                  subtitle="Test component disagreement by horizon."
                  bars={[
                    { key: "PriceDisagreementStd", label: "Mean Price Std", color: "#2563eb" },
                    { key: "MedianDisagreementStd", label: "Median Price Std", color: "#ca8a04" },
                    { key: "DisagreementPct", label: "Disagreement %", color: "#16a34a" },
                  ]}
                />
              )}
            </div>
          </section>
        </ConditionalSection>

        <ConditionalSection show={pathRows.length > 0}>
          <section className="mt-14 rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader
              eyebrow="Latest Forecast Table"
              title="Multi-horizon Epsilon forecast points"
              description="This table displays forecast_latest.json directly. p10/p50/p90 are model outputs, not guaranteed future ranges."
            />

            <LatestForecastTable forecast={forecast} />
          </section>
        </ConditionalSection>

        <ConditionalSection show={rankingRows.length > 0 || weightRows.length > 0}>
          <section className="mt-14 grid gap-6 xl:grid-cols-2">
            {rankingRows.length > 0 && (
              <div>
                <SectionHeader
                  eyebrow="Component Ranking"
                  title="Validation-ranked Epsilon components"
                  description="Ranking is based on exported validation average MAPE. It is model behavior and benchmark ranking, not causal explanation."
                />

                <RankingTable rows={rankingRows} />
              </div>
            )}

            {weightRows.length > 0 && (
              <div>
                <SectionHeader
                  eyebrow="Component Weights"
                  title={`${selectedHorizon}-day horizon component weights`}
                  description="Weights are horizon-specific and read from component_weights.json."
                />

                <FeatureBars
                  rows={weightRows}
                  featureKey="feature"
                  valueKey="value"
                  title={`Epsilon Component Weights (${selectedHorizon}D)`}
                  valueFormatter={formatWeight}
                  limit={15}
                />
              </div>
            )}
          </section>
        </ConditionalSection>

        <section className="mt-14 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader
              eyebrow="Quality and Data Context"
              title="Governance summary"
              description="These values are read from quality, dataset, and matrix artifacts."
            />

            <div className="grid gap-3">
              <InfoLine label="Quality status" value={<StatusPill status={qualityReview?.status || status} />} />
              <InfoLine label="Blocking flags" value={Array.isArray(qualityReview?.blocking_flags) ? qualityReview.blocking_flags.length : "Not in artifact"} />
              <InfoLine label="Warnings" value={Array.isArray(qualityReview?.warnings) ? qualityReview.warnings.length : "Not in artifact"} />
              <InfoLine label="Dataset rows" value={formatNumber(datasetManifest?.row_count)} />
              <InfoLine label="Feature count" value={formatNumber(firstValue(datasetManifest?.feature_count, report?.run_summary?.features?.used_count))} />
              <InfoLine label="Matrix rows" value={formatNumber(matrixManifest?.row_count)} />
              <InfoLine label="Matrix columns" value={formatNumber(matrixManifest?.column_count)} />
              <InfoLine label="Effective through" value={formatDate(firstValue(modeStatus?.effective_data_through_date, report?.run_summary?.data_signature?.effective_data_through_date))} />
              <InfoLine label="Forecast start" value={formatDate(firstValue(modeStatus?.forecast_start_date, report?.run_summary?.data_signature?.forecast_start_date))} />
              <InfoLine label="Official cutoff" value={formatDate(matrixManifest?.official_cutoff)} />
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
                Keep Epsilon described as a benchmark / expert-ensemble guardrail, not the final Deep ML winner.
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                Keep residual intervals as uncertainty estimates, not guaranteed future ranges.
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
          <SectionHeader
            eyebrow="Artifact Downloads"
            title="Source files used on this page"
            description="The Epsilon page uses only sections supported by real artifact rows. Large component forecast files are provided as downloads without being parsed into page charts."
          />

          <ArtifactDownloads results={results} />
        </section>
      </div>
    </main>
  );
}