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
  { key: "report", label: "Delta TFT Report", path: "artifacts/deep_ml/models/delta_tft/phase8_delta_tft_report.json", kind: "json" },
  { key: "runSummary", label: "Run Summary", path: "artifacts/deep_ml/models/delta_tft/run_summary.json", kind: "json" },
  { key: "forecast", label: "Latest Forecast", path: "artifacts/deep_ml/models/delta_tft/forecast_latest.json", kind: "json" },
  { key: "evaluation", label: "Evaluation by Horizon", path: "artifacts/deep_ml/models/delta_tft/evaluation_by_horizon.json", kind: "json" },
  { key: "evaluationRollforward", label: "Evaluation Rollforward", path: "artifacts/deep_ml/models/delta_tft/evaluation_rollforward.csv", kind: "csv" },
  { key: "evaluationRollforwardSummary", label: "Evaluation Rollforward Summary", path: "artifacts/deep_ml/models/delta_tft/evaluation_rollforward_summary.json", kind: "json" },
  { key: "nativeEvaluationRollforward", label: "Native Evaluation Rollforward", path: "artifacts/deep_ml/models/delta_tft/native_evaluation_rollforward.csv", kind: "csv" },
  { key: "rollingOriginPredictions", label: "Rolling-Origin Predictions", path: "artifacts/deep_ml/models/delta_tft/rolling_origin_predictions.csv", kind: "csv" },
  { key: "coverage", label: "Quantile Coverage Summary", path: "artifacts/deep_ml/models/delta_tft/quantile_coverage_summary.json", kind: "json" },
  { key: "calibration", label: "Interval Calibration Summary", path: "artifacts/deep_ml/models/delta_tft/interval_calibration_summary.json", kind: "json" },
  { key: "pinball", label: "Pinball Loss Summary", path: "artifacts/deep_ml/models/delta_tft/pinball_loss_summary.json", kind: "json" },
  { key: "variableSelection", label: "Variable Selection Summary", path: "artifacts/deep_ml/models/delta_tft/variable_selection_summary.json", kind: "json" },
  { key: "temporalAttention", label: "Temporal Attention Summary", path: "artifacts/deep_ml/models/delta_tft/temporal_attention_summary.json", kind: "json" },
  { key: "horizonAttention", label: "Horizon Attention Summary", path: "artifacts/deep_ml/models/delta_tft/horizon_attention_summary.json", kind: "json" },
  { key: "trainingHistory", label: "Training History", path: "artifacts/deep_ml/models/delta_tft/training_history.csv", kind: "csv" },
  { key: "qualityReview", label: "Quality Review", path: "artifacts/deep_ml/models/delta_tft/quality_review.json", kind: "json" },
  { key: "datasetManifest", label: "TFT Dataset Manifest", path: "artifacts/deep_ml/models/delta_tft/tft_dataset_manifest.json", kind: "json" },
  { key: "bestConfig", label: "Best Config", path: "artifacts/deep_ml/models/delta_tft/best_config.json", kind: "json" },
  { key: "modeStatus", label: "Deep ML Mode Status", path: "artifacts/deep_ml/governance/deep_ml_mode_status.json", kind: "json" },
  { key: "matrixManifest", label: "Numeric Feature Store Manifest", path: "artifacts/deep_ml/features/deep_ml_numeric_feature_store_manifest.json", kind: "json" },
  { key: "gammaDateContext", label: "Gamma Date Context for News Tooltips", path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_date_context.csv", kind: "csv" },
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
  return (
    <div className="grid grid-cols-[185px_1fr] gap-3 border-b border-slate-100 pb-3 last:border-b-0">
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

function DeltaHero() {
  const particles = Array.from({ length: 34 }, (_, index) => {
    const left = 5 + ((index * 27) % 90);
    const top = 9 + ((index * 37) % 78);

    return (
      <span
        key={index}
        className="delta-particle"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          animationDelay: `${index * 0.11}s`,
        }}
      />
    );
  });

  return (
    <div className="relative min-h-[430px] overflow-hidden rounded-[3rem] border border-slate-200 bg-slate-950 p-8 shadow-2xl shadow-cyan-950/20">
      <style>{`
        .delta-grid {
          background-image:
            linear-gradient(rgba(34, 211, 238, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 211, 238, 0.15) 1px, transparent 1px);
          background-size: 34px 34px;
          animation: delta-grid-move 18s linear infinite;
        }

        .delta-symbol {
          position: absolute;
          right: 10%;
          top: 12%;
          width: 250px;
          height: 250px;
          display: grid;
          place-items: center;
          color: rgba(103, 232, 249, 0.98);
          font-size: 128px;
          font-weight: 1000;
          clip-path: polygon(50% 0%, 100% 90%, 0% 90%);
          background:
            radial-gradient(circle at 50% 42%, rgba(34, 211, 238, 0.42), transparent 36%),
            linear-gradient(135deg, rgba(250, 204, 21, 0.16), rgba(34, 211, 238, 0.28));
          border: 1px solid rgba(103, 232, 249, 0.35);
          box-shadow:
            0 0 90px rgba(34, 211, 238, 0.24),
            inset 0 0 80px rgba(103, 232, 249, 0.16);
          animation: delta-float 5.7s ease-in-out infinite;
        }

        .delta-band {
          position: absolute;
          right: 4%;
          bottom: 13%;
          width: 620px;
          height: 180px;
          opacity: .95;
        }

        .delta-quantile {
          position: absolute;
          left: 20px;
          width: 560px;
          height: 3px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(34,211,238,.15), rgba(250,204,21,.85), rgba(34,211,238,.15));
          box-shadow: 0 0 26px rgba(34, 211, 238, .33);
          animation: delta-line 3s ease-in-out infinite;
        }

        .delta-quantile.q1 { top: 50px; transform: rotate(-8deg); }
        .delta-quantile.q2 { top: 92px; transform: rotate(0deg); animation-delay: .25s; }
        .delta-quantile.q3 { top: 134px; transform: rotate(8deg); animation-delay: .5s; }

        .delta-particle {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: rgba(250, 204, 21, .96);
          box-shadow: 0 0 18px rgba(250, 204, 21, .82), 0 0 36px rgba(34, 211, 238, .3);
          animation: delta-pulse 2.35s ease-in-out infinite;
        }

        @keyframes delta-grid-move {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(34px, 34px, 0); }
        }

        @keyframes delta-float {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-3deg); }
          50% { transform: translate3d(0, -17px, 0) rotate(3deg); }
        }

        @keyframes delta-pulse {
          0%, 100% { opacity: .38; transform: scale(.65); }
          50% { opacity: 1; transform: scale(1.35); }
        }

        @keyframes delta-line {
          0%, 100% { opacity: .42; }
          50% { opacity: 1; }
        }
      `}</style>

      <div className="delta-grid absolute inset-0 opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(250,204,21,0.13),transparent_29%),radial-gradient(circle_at_66%_46%,rgba(34,211,238,0.32),transparent_38%),radial-gradient(circle_at_90%_90%,rgba(59,130,246,0.16),transparent_35%)]" />

      <div className="delta-symbol">Δ</div>
      <div className="delta-band">
        <span className="delta-quantile q1" />
        <span className="delta-quantile q2" />
        <span className="delta-quantile q3" />
      </div>
      {particles}

      <div className="relative z-10 flex min-h-[360px] max-w-4xl flex-col justify-between">
        <div>
          <div className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-100">
            Delta TFT Quantile Expert
          </div>
          <h1 className="mt-8 text-5xl font-black tracking-tight text-white md:text-7xl">
            Delta TFT
          </h1>
          <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-cyan-50/80">
            Calibrated temporal-fusion quantile expert. This page now uses the full
            train, validation, and test rollforward artifact for the main p50 graph.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Symbol
            </div>
            <div className="mt-2 text-sm font-black text-white">Δ / uncertainty</div>
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
            <div className="mt-2 text-sm font-black text-white">Intervals are estimates</div>
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
        deltaError: asNumber(row.error),
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
      deltaError: asNumber(row.error),
    }))
    .filter((row) => row.actual !== null && row.forecast !== null);
}

function buildTrainingRows(rows: any[]): ForecastChartRow[] {
  return rows
    .map((row, index) => ({
      date: String(firstValue(row.epoch, row.Epoch, index + 1)),
      split: "training",
      actual: asNumber(firstValue(row.train_quantile_loss, row.train_loss, row.training_loss, row.loss)),
      forecast: asNumber(firstValue(row.validation_quantile_loss, row.val_loss, row.validation_loss, row.valid_loss)),
    }))
    .filter((row) => row.actual !== null || row.forecast !== null);
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
      DeltaMAPE: modelRow.mape_pct,
      NaiveMAPE: naiveRow.mape_pct,
      DeltaMAE: modelRow.mae,
      NaiveMAE: naiveRow.mae,
      DeltaRMSE: modelRow.rmse,
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
    P10: row.calibrated_forecast_price_p10,
    P50: row.calibrated_forecast_price_p50,
    P90: row.calibrated_forecast_price_p90,
    NativeP10: row.native_forecast_price_p10,
    NativeP90: row.native_forecast_price_p90,
  }));
}

function buildCoverageRows(coverage: any, splitKey: string, splitLabel: string): MetricChartRow[] {
  const byHorizon = coverage?.[splitKey] || {};

  return Object.keys(byHorizon)
    .sort((a, b) => Number(a) - Number(b))
    .map((horizon) => {
      const row = byHorizon[horizon];

      return {
        split: splitLabel,
        horizon: `${horizon}D`,
        label: `${horizon}D`,
        Coverage: row.coverage_p10_p90_pct,
        Target: coverage?.coverage_target_pct ?? 80,
        Width: row.mean_interval_width_price,
        CalibrationError: row.calibration_error_vs_80pct_abs,
      };
    })
    .filter((row) => Number.isFinite(Number(row.Coverage)));
}

function buildCalibrationRows(calibration: any): MetricChartRow[] {
  const byHorizon = calibration?.by_horizon || {};

  return Object.keys(byHorizon)
    .sort((a, b) => Number(a) - Number(b))
    .map((horizon) => {
      const row = byHorizon[horizon];

      return {
        split: "calibration",
        horizon: `${horizon}D`,
        label: `${horizon}D`,
        ScaleFactor: row.scale_factor,
        NativeValidationCoverage: row.native_validation_coverage_pct,
        TargetCoverage: row.target_coverage_pct,
      };
    })
    .filter((row) => Number.isFinite(Number(row.ScaleFactor)));
}

function buildPinballRows(pinball: any, splitKey: string, splitLabel: string): MetricChartRow[] {
  const byHorizon = pinball?.[splitKey] || {};

  return Object.keys(byHorizon)
    .sort((a, b) => Number(a) - Number(b))
    .map((horizon) => {
      const row = byHorizon[horizon];
      const q = row.pinball_loss_by_quantile || {};

      return {
        split: splitLabel,
        horizon: `${horizon}D`,
        label: `${horizon}D`,
        P10: q.p10,
        P50: q.p50,
        P90: q.p90,
        Mean: row.pinball_loss_mean,
      };
    })
    .filter((row) => Number.isFinite(Number(row.Mean)));
}

function splitMetricAverage(metricRows: MetricChartRow[], split: string, key: string) {
  return average(
    metricRows
      .filter((row) => String(row.split).toLowerCase() === split.toLowerCase())
      .map((row) => row[key])
  );
}

function getVariableRows(variableSelection: any) {
  const rows = variableSelection?.top_features || [];
  return Array.isArray(rows) ? rows : [];
}

function getAttentionRows(attention: any) {
  const byHorizon = attention?.by_horizon || [];
  if (!Array.isArray(byHorizon)) return [];

  return byHorizon.flatMap((row: any) => {
    const horizon = row.horizon_trading_days;
    const lags = row.top_lags_ago_approx || [];
    const weights = row.top_attention_weights || [];

    return lags.slice(0, 8).map((lag: any, index: number) => ({
      feature: `${horizon}D / ${lag} lag`,
      value: weights[index],
    }));
  });
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

function LatestForecastTable({ forecast }: { forecast: any }) {
  const rows = forecast?.path || [];

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
        <span>Calibration</span>
        <span>Factor</span>
      </div>

      {rows.map((row: any) => (
        <div
          key={`${row.horizon_trading_days}-${row.forecast_date_business_day_approx}`}
          className="grid grid-cols-8 border-t border-slate-100 px-5 py-4 text-xs font-bold text-slate-700"
        >
          <span>{row.horizon_trading_days}D</span>
          <span>{row.forecast_date_business_day_approx}</span>
          <span>{formatUsd(row.raw_gold_price_anchor)}</span>
          <span>{formatUsd(row.calibrated_forecast_price_p10)}</span>
          <span>{formatUsd(row.calibrated_forecast_price_p50)}</span>
          <span>{formatUsd(row.calibrated_forecast_price_p90)}</span>
          <span>{String(row.interval_calibration_applied)}</span>
          <span>{formatNumber(row.interval_calibration_factor, 3)}</span>
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

export default async function DeltaTftPage() {
  const results = await loadArtifacts();

  const report = getArtifact(results, "report");
  const runSummary = getArtifact(results, "runSummary");
  const forecast = getArtifact(results, "forecast");
  const evaluation = getArtifact(results, "evaluation");
  const evaluationRollforward = getArtifact(results, "evaluationRollforward") || [];
  const evaluationRollforwardSummary = getArtifact(results, "evaluationRollforwardSummary");
  const rollingOriginPredictions = getArtifact(results, "rollingOriginPredictions") || [];
  const coverage = getArtifact(results, "coverage");
  const calibration = getArtifact(results, "calibration");
  const pinball = getArtifact(results, "pinball");
  const variableSelection = getArtifact(results, "variableSelection");
  const temporalAttention = getArtifact(results, "temporalAttention");
  const trainingHistory = getArtifact(results, "trainingHistory") || [];
  const qualityReview = getArtifact(results, "qualityReview");
  const datasetManifest = getArtifact(results, "datasetManifest");
  const bestConfig = getArtifact(results, "bestConfig");
  const modeStatus = getArtifact(results, "modeStatus");
  const matrixManifest = getArtifact(results, "matrixManifest");

  const loadedCount = results.filter((item) => item.ok).length;
  const gammaDateContext = getArtifact(results, "gammaDateContext") || [];
  const gammaLookup = buildGammaDateContextLookup(gammaDateContext);

  const selectedHorizon = 10;
  const splitRows = buildSplitRows(evaluationRollforward, selectedHorizon, gammaLookup);
  const recentTestRows = splitRows.filter((row) => row.split === "test").slice(-180);
  const rollingRows = buildRollingRows(rollingOriginPredictions, selectedHorizon, gammaLookup).slice(-180);
  const trainingRows = buildTrainingRows(trainingHistory);

  const metricRows = buildMetricRows(evaluation);
  const naiveRows = buildNaiveRows(evaluation);
  const latestQuantileRows = buildLatestQuantileRows(forecast);
  const validationCoverageRows = buildCoverageRows(coverage, "calibrated_validation_coverage_by_horizon", "validation_coverage");
  const testCoverageRows = buildCoverageRows(coverage, "calibrated_test_coverage_by_horizon", "test_coverage");
  const calibrationRows = buildCalibrationRows(calibration);
  const calibratedPinballRows = buildPinballRows(pinball, "calibrated_test_pinball_by_horizon", "calibrated_pinball");
  const nativePinballRows = buildPinballRows(pinball, "native_test_pinball_by_horizon", "native_pinball");
  const variableRows = getVariableRows(variableSelection);
  const attentionRows = getAttentionRows(temporalAttention);

  const trainAvgMape = splitMetricAverage(metricRows, "train", "MAPE");
  const validationAvgMape = splitMetricAverage(metricRows, "validation", "MAPE");
  const testAvgMape = splitMetricAverage(metricRows, "test", "MAPE");
  const testAvgDirection = splitMetricAverage(metricRows, "test", "DirectionalAccuracy");

  const avgTestCoverage = average(testCoverageRows.map((row) => row.Coverage));
  const avgTestWidth = average(testCoverageRows.map((row) => row.Width));
  const avgScaleFactor = average(calibrationRows.map((row) => row.ScaleFactor));

  const pathRows = forecast?.path || [];
  const latestOneDay = pathRows[0];

  const modelName = firstValue(report?.model_name, runSummary?.model_name, "Delta TFT Multi-Horizon Expert");
  const modelVersion = firstValue(report?.delta_version, runSummary?.delta_version, "v2_calibrated");
  const status = firstValue(report?.status, qualityReview?.status, runSummary?.status);
  const generatedAt = firstValue(
    report?.run_summary?.run?.completed_at_utc,
    runSummary?.run?.completed_at_utc,
    forecast?.generated_at_utc
  );

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-[1800px]">
        <DeltaHero />

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Artifact Status"
            value={<StatusPill status={status || "loaded"} />}
            note={`${loadedCount}/${ARTIFACTS.length} page artifacts loaded.`}
          />
          <MetricCard
            label="Generated"
            value={<span className="text-2xl">{formatDateTime(generatedAt)}</span>}
            note="Delta report / forecast timestamp."
          />
          <MetricCard
            label="Latest 1D p50"
            value={formatUsd(latestOneDay?.calibrated_forecast_price_p50)}
            note="Latest calibrated p50 from forecast_latest.json."
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
              title="Delta TFT artifact summary"
              description="Delta is displayed as a calibrated quantile expert. The main page graph now uses evaluation_rollforward.csv for train, validation, and test split behavior."
            />

            <div className="grid gap-3">
              <InfoLine label="Model name" value={modelName} />
              <InfoLine label="Model key" value={firstValue(report?.model_key, runSummary?.model_key)} />
              <InfoLine label="Version" value={modelVersion} />
              <InfoLine label="Family" value={firstValue(report?.run_summary?.family, runSummary?.family)} />
              <InfoLine label="Backend" value={firstValue(report?.run_summary?.model?.backend, runSummary?.model?.backend)} />
              <InfoLine label="Target" value={firstValue(report?.run_summary?.model?.target, runSummary?.model?.target)} />
              <InfoLine label="Study ID" value={firstValue(report?.run_summary?.run?.study_id, runSummary?.run?.study_id)} />
              <InfoLine label="Run ID" value={firstValue(report?.run_summary?.run?.run_id, runSummary?.run?.run_id)} />
              <InfoLine label="Device" value={firstValue(report?.run_summary?.run?.device, runSummary?.run?.device)} />
              <InfoLine label="CUDA device" value={firstValue(report?.run_summary?.run?.cuda_device_name, runSummary?.run?.cuda_device_name)} />
            </div>
          </div>

          <div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader eyebrow="Quantile Contract" title="Run configuration" />

            <div className="grid gap-4">
              <MetricCard
                label="Sequence Length"
                value={formatNumber(firstValue(report?.run_summary?.model?.selected_config?.sequence_length, bestConfig?.sequence_length))}
                note="From report / best_config."
              />
              <MetricCard
                label="Used Features"
                value={formatNumber(firstValue(report?.run_summary?.features?.used_count, datasetManifest?.feature_count))}
                note="Feature count from artifacts."
              />
              <MetricCard
                label="Avg Scale Factor"
                value={avgScaleFactor === null ? "Not in artifact" : formatNumber(avgScaleFactor, 3)}
                note="Validation-residual interval calibration."
              />
            </div>
          </div>
        </section>

        <ConditionalSection show={splitRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Main Split Forecast Graph"
              title={`Actual vs Delta p50 — train, validation, and test (${selectedHorizon}-day horizon)`}
              description="This is the main professor-style graph. It uses evaluation_rollforward.csv and displays the calibrated p50 forecast path."
            />

            <ActualVsForecastChart
              rows={splitRows}
              forecastKey="forecast"
              forecastLabel="Delta calibrated p50"
              actualKey="actual"
              actualLabel="Actual Target Gold"
              title={`Actual vs Delta p50 — Train / Validation / Test (${selectedHorizon}D Horizon)`}
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
              title={`Delta p50 residuals across train, validation, and test (${selectedHorizon}-day horizon)`}
              description="Residual equals actual target gold price minus calibrated p50."
            />

            <ResidualChart
              rows={splitRows}
              forecastKey="forecast"
              forecastLabel="Delta calibrated p50"
              actualKey="actual"
              title={`Delta Residuals — Train / Validation / Test (${selectedHorizon}D Horizon)`}
              subtitle="Residual = actual target price minus calibrated p50."
              yAxisLabel="Actual - Delta p50"
              showSplitMarkers={true}
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={recentTestRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Recent Test Zoom"
              title={`Recent test window — Delta calibrated p50 (${selectedHorizon}-day horizon)`}
              description="This zoomed chart focuses only on recent test rows from evaluation_rollforward.csv."
            />

            <ActualVsForecastChart
              rows={recentTestRows}
              forecastKey="forecast"
              forecastLabel="Delta calibrated p50"
              actualKey="actual"
              actualLabel="Actual Target Gold"
              title={`Recent Test Actual vs Delta p50 (${selectedHorizon}D Horizon)`}
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
              title={`Rolling-origin Delta p50 — recent test origins (${selectedHorizon}-day horizon)`}
              description="This uses rolling_origin_predictions.csv and is intentionally separated from the full train/validation/test graph."
            />

            <ActualVsForecastChart
              rows={rollingRows}
              forecastKey="forecast"
              forecastLabel="Delta rolling p50"
              actualKey="actual"
              actualLabel="Actual Target Gold"
              title={`Rolling-Origin Actual vs Delta p50 (${selectedHorizon}D Horizon)`}
              subtitle="Source: rolling_origin_predictions.csv."
              yAxisLabel="Gold Price (USD/oz)"
              showSplitMarkers={false}
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={trainingRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Training History"
              title="Delta TFT training curve"
              description="Training loss and validation loss from training_history.csv."
            />

            <ActualVsForecastChart
              rows={trainingRows}
              forecastKey="forecast"
              forecastLabel="Validation Quantile Loss"
              actualKey="actual"
              actualLabel="Train Quantile Loss"
              title="Delta Training vs Validation Quantile Loss"
              subtitle="Loss values from training_history.csv."
              yAxisLabel="Quantile Loss"
              showSplitMarkers={false}
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={metricRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Train / Validation / Test Metrics"
              title="Split-based p50 error metrics"
              description="These charts use evaluation_by_horizon.json. Point metrics are based on p50."
            />

            <div className="grid gap-6">
              <MetricComparisonChart
                rows={metricRows}
                split="train"
                xKey="horizon"
                xLabel="Forecast Horizon"
                yLabel="Gold Price Error"
                title="Delta Train Error by Horizon"
                subtitle="Train split p50 error metrics from evaluation_by_horizon.json."
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
                title="Delta Validation Error by Horizon"
                subtitle="Validation split p50 error metrics from evaluation_by_horizon.json."
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
                title="Delta Test Error by Horizon"
                subtitle="Test split p50 error metrics from evaluation_by_horizon.json."
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
              eyebrow="Delta vs Naive"
              title="Naive benchmark comparison"
              description="Benchmark comparison is displayed where naive baseline rows exist. This is not a final model ranking."
            />

            <div className="grid gap-6">
              <MetricComparisonChart
                rows={naiveRows}
                split="test"
                xKey="horizon"
                xLabel="Forecast Horizon"
                yLabel="MAPE (%)"
                title="Delta vs Naive Test MAPE"
                subtitle="Lower MAPE is generally better."
                bars={[
                  { key: "DeltaMAPE", label: "Delta MAPE", color: "#2563eb" },
                  { key: "NaiveMAPE", label: "Naive MAPE", color: "#ca8a04" },
                ]}
              />

              <MetricComparisonChart
                rows={naiveRows}
                split="test"
                xKey="horizon"
                xLabel="Forecast Horizon"
                yLabel="Gold Price Error"
                title="Delta vs Naive Test MAE/RMSE"
                subtitle="Gold-price error comparison across horizons."
                bars={[
                  { key: "DeltaMAE", label: "Delta MAE", color: "#2563eb" },
                  { key: "NaiveMAE", label: "Naive MAE", color: "#ca8a04" },
                  { key: "DeltaRMSE", label: "Delta RMSE", color: "#16a34a" },
                  { key: "NaiveRMSE", label: "Naive RMSE", color: "#dc2626" },
                ]}
              />
            </div>
          </section>
        </ConditionalSection>

        <ConditionalSection show={latestQuantileRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Latest Quantile Forecast"
              title="Delta p10 / p50 / p90 by horizon"
              description="Latest calibrated quantiles from forecast_latest.json. These are uncertainty estimates, not guaranteed ranges."
            />

            <MetricComparisonChart
              rows={latestQuantileRows}
              split="latest"
              xKey="horizon"
              xLabel="Forecast Horizon"
              yLabel="Gold Price (USD/oz)"
              title="Delta Latest Calibrated Forecast Quantiles"
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
              eyebrow="Coverage"
              title="Calibrated p10-p90 interval coverage"
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
                  title="Delta Validation Coverage"
                  subtitle="Calibrated validation coverage by horizon."
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
                  title="Delta Test Coverage"
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

        <ConditionalSection show={calibrationRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Interval Calibration"
              title="Validation-residual interval calibration"
              description="Calibration uses validation residual behavior to widen p10/p90 intervals while preserving p50."
            />

            <MetricComparisonChart
              rows={calibrationRows}
              split="calibration"
              xKey="horizon"
              xLabel="Forecast Horizon"
              yLabel="Scale / Coverage"
              title="Delta Calibration Factors"
              subtitle="Scale factor, native validation coverage, and target coverage."
              bars={[
                { key: "ScaleFactor", label: "Scale Factor", color: "#2563eb" },
                { key: "NativeValidationCoverage", label: "Native Validation Coverage", color: "#ca8a04" },
                { key: "TargetCoverage", label: "Target Coverage", color: "#16a34a" },
              ]}
            />
          </section>
        </ConditionalSection>

        <section className="mt-14 grid gap-5 md:grid-cols-3">
          <MetricCard
            label="Avg Test Coverage"
            value={avgTestCoverage === null ? "Not in artifact" : formatPercent(avgTestCoverage)}
            note="Average calibrated test p10-p90 coverage."
          />
          <MetricCard
            label="Avg Test Width"
            value={avgTestWidth === null ? "Not in artifact" : formatUsd(avgTestWidth)}
            note="Average calibrated test interval width."
          />
          <MetricCard
            label="p50 Preserved"
            value={<span className="text-2xl">{String(calibration?.p50_preserved ?? forecast?.interval_calibration_summary?.p50_preserved ?? "Not in artifact")}</span>}
            note="Calibration should preserve p50."
          />
        </section>

        <ConditionalSection show={calibratedPinballRows.length > 0 || nativePinballRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Pinball Loss"
              title="Quantile loss by horizon"
              description="Pinball loss evaluates quantile forecast behavior. Lower values are generally better, but this page does not make final model-ranking claims."
            />

            <div className="grid gap-6">
              {calibratedPinballRows.length > 0 && (
                <MetricComparisonChart
                  rows={calibratedPinballRows}
                  split="calibrated_pinball"
                  xKey="horizon"
                  xLabel="Forecast Horizon"
                  yLabel="Pinball Loss"
                  title="Delta Calibrated Test Pinball Loss"
                  subtitle="Calibrated pinball loss by quantile."
                  bars={[
                    { key: "P10", label: "p10 Loss", color: "#2563eb" },
                    { key: "P50", label: "p50 Loss", color: "#ca8a04" },
                    { key: "P90", label: "p90 Loss", color: "#16a34a" },
                    { key: "Mean", label: "Mean Loss", color: "#dc2626" },
                  ]}
                />
              )}

              {nativePinballRows.length > 0 && (
                <MetricComparisonChart
                  rows={nativePinballRows}
                  split="native_pinball"
                  xKey="horizon"
                  xLabel="Forecast Horizon"
                  yLabel="Pinball Loss"
                  title="Delta Native Test Pinball Loss"
                  subtitle="Native pinball loss retained for audit comparison."
                  bars={[
                    { key: "P10", label: "p10 Loss", color: "#2563eb" },
                    { key: "P50", label: "p50 Loss", color: "#ca8a04" },
                    { key: "P90", label: "p90 Loss", color: "#16a34a" },
                    { key: "Mean", label: "Mean Loss", color: "#dc2626" },
                  ]}
                />
              )}
            </div>
          </section>
        </ConditionalSection>

        <ConditionalSection show={pathRows.length > 0}>
          <section className="mt-14 rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader
              eyebrow="Latest Forecast"
              title="Multi-horizon calibrated Delta forecast points"
              description="This table displays forecast_latest.json directly. p10/p50/p90 are model outputs, not guaranteed future ranges."
            />

            <LatestForecastTable forecast={forecast} />
          </section>
        </ConditionalSection>

        <ConditionalSection show={variableRows.length > 0 || attentionRows.length > 0}>
          <section className="mt-14 grid gap-6 xl:grid-cols-2">
            {variableRows.length > 0 && (
              <div>
                <SectionHeader
                  eyebrow="Variable Selection"
                  title="TFT variable-selection behavior"
                  description="Variable-selection weights summarize model behavior only. They do not prove causal effects."
                />

                <FeatureBars
                  rows={variableRows}
                  featureKey="feature"
                  valueKey="mean_variable_selection_weight"
                  title="Top Variable Selection Weights"
                  valueFormatter={(value) => formatNumber(value, 6)}
                  limit={18}
                />
              </div>
            )}

            {attentionRows.length > 0 && (
              <div>
                <SectionHeader
                  eyebrow="Temporal Attention"
                  title="Sequence attention behavior"
                  description="Attention summarizes sequence emphasis. It is interpretability, not causality."
                />

                <FeatureBars
                  rows={attentionRows}
                  featureKey="feature"
                  valueKey="value"
                  title="Top Attention Weights"
                  valueFormatter={(value) => formatNumber(value, 6)}
                  limit={18}
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
                Add p10-p90 shaded chart bands if we later create a Deep ML-only custom chart component.
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                Keep calibrated intervals as Delta uncertainty estimates, not guaranteed ranges.
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
            description="The Delta page uses only sections supported by real artifact rows and drops unsupported graph sections."
          />

          <ArtifactDownloads results={results} />
        </section>
      </div>
    </main>
  );
}