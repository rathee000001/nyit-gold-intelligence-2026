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
    label: "Beta Temporal Report",
    path: "artifacts/deep_ml/models/beta_temporal/phase7_beta_temporal_report.json",
    kind: "json",
  },
  {
    key: "runSummary",
    label: "Run Summary",
    path: "artifacts/deep_ml/models/beta_temporal/run_summary.json",
    kind: "json",
  },
  {
    key: "forecast",
    label: "Latest Forecast",
    path: "artifacts/deep_ml/models/beta_temporal/forecast_latest.json",
    kind: "json",
  },
  {
    key: "evaluation",
    label: "Evaluation by Horizon",
    path: "artifacts/deep_ml/models/beta_temporal/evaluation_by_horizon.json",
    kind: "json",
  },
  {
    key: "evaluationRollforward",
    label: "Static Train/Validation/Test Predictions",
    path: "artifacts/deep_ml/models/beta_temporal/evaluation_rollforward.csv",
    kind: "csv",
  },
  {
    key: "rollingOriginPredictions",
    label: "Rolling-Origin Predictions",
    path: "artifacts/deep_ml/models/beta_temporal/rolling_origin_predictions.csv",
    kind: "csv",
  },
  {
    key: "rollingOriginMetrics",
    label: "Rolling-Origin Metrics",
    path: "artifacts/deep_ml/models/beta_temporal/rolling_origin_metrics.json",
    kind: "json",
  },
  {
    key: "trainingHistory",
    label: "Training History",
    path: "artifacts/deep_ml/models/beta_temporal/training_history.csv",
    kind: "csv",
  },
  {
    key: "mcDropoutSummary",
    label: "MC Dropout Summary",
    path: "artifacts/deep_ml/models/beta_temporal/mc_dropout_summary.json",
    kind: "json",
  },
  {
    key: "mcDropoutPreview",
    label: "MC Dropout Samples Preview",
    path: "artifacts/deep_ml/models/beta_temporal/mc_dropout_samples_preview.csv",
    kind: "csv",
  },
  {
    key: "uncertaintyLatest",
    label: "Uncertainty Latest",
    path: "artifacts/deep_ml/models/beta_temporal/uncertainty_latest.json",
    kind: "json",
  },
  {
    key: "attentionSummary",
    label: "Attention Summary",
    path: "artifacts/deep_ml/models/beta_temporal/attention_summary.json",
    kind: "json",
  },
  {
    key: "occlusion",
    label: "Feature Occlusion Importance",
    path: "artifacts/deep_ml/models/beta_temporal/feature_occlusion_importance.csv",
    kind: "csv",
  },
  {
    key: "interpretability",
    label: "Interpretability Latest",
    path: "artifacts/deep_ml/models/beta_temporal/interpretability_latest.json",
    kind: "json",
  },
  {
    key: "latestSequence",
    label: "Latest Sequence Explanation",
    path: "artifacts/deep_ml/models/beta_temporal/latest_sequence_explanation.json",
    kind: "json",
  },
  {
    key: "bestConfig",
    label: "Best Config",
    path: "artifacts/deep_ml/models/beta_temporal/best_config.json",
    kind: "json",
  },
  {
    key: "optunaSummary",
    label: "Optuna Study Summary",
    path: "artifacts/deep_ml/models/beta_temporal/optuna_study_summary.json",
    kind: "json",
  },
  {
    key: "qualityReview",
    label: "Quality Review",
    path: "artifacts/deep_ml/models/beta_temporal/quality_review.json",
    kind: "json",
  },
  {
    key: "sequenceManifest",
    label: "Sequence Dataset Manifest",
    path: "artifacts/deep_ml/models/beta_temporal/sequence_dataset_manifest.json",
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
    <div className="grid grid-cols-[175px_1fr] gap-3 border-b border-slate-100 pb-3 last:border-b-0">
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

function BetaHero() {
  const pulses = Array.from({ length: 36 }, (_, index) => {
    const left = 5 + ((index * 23) % 90);
    const top = 9 + ((index * 41) % 78);

    return (
      <span
        key={index}
        className="beta-pulse"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          animationDelay: `${index * 0.1}s`,
        }}
      />
    );
  });

  return (
    <div className="relative min-h-[430px] overflow-hidden rounded-[3rem] border border-slate-200 bg-slate-950 p-8 shadow-2xl shadow-blue-950/20">
      <style>{`
        .beta-grid {
          background-image:
            linear-gradient(rgba(59, 130, 246, 0.16) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.16) 1px, transparent 1px);
          background-size: 34px 34px;
          animation: beta-grid-move 18s linear infinite;
        }

        .beta-symbol {
          position: absolute;
          right: 10%;
          top: 13%;
          width: 250px;
          height: 250px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          color: rgba(147, 197, 253, 0.98);
          font-size: 132px;
          font-weight: 1000;
          background:
            radial-gradient(circle at 35% 30%, rgba(59, 130, 246, 0.40), transparent 35%),
            radial-gradient(circle at 74% 74%, rgba(250, 204, 21, 0.18), transparent 38%),
            rgba(15, 23, 42, 0.62);
          border: 1px solid rgba(147, 197, 253, 0.35);
          box-shadow:
            0 0 85px rgba(59, 130, 246, 0.28),
            inset 0 0 80px rgba(147, 197, 253, 0.16);
          animation: beta-float 5.6s ease-in-out infinite;
        }

        .beta-wave {
          position: absolute;
          right: 4%;
          bottom: 13%;
          width: 600px;
          height: 170px;
          opacity: .9;
        }

        .beta-line {
          position: absolute;
          height: 3px;
          border-radius: 999px;
          transform-origin: left center;
          background: linear-gradient(90deg, rgba(147,197,253,.92), rgba(250,204,21,.18));
          box-shadow: 0 0 24px rgba(59, 130, 246, .35);
          animation: beta-line-glow 2.9s ease-in-out infinite;
        }

        .beta-line.l1 { left: 20px; top: 110px; width: 160px; transform: rotate(-18deg); }
        .beta-line.l2 { left: 160px; top: 62px; width: 160px; transform: rotate(18deg); animation-delay: .2s; }
        .beta-line.l3 { left: 300px; top: 112px; width: 170px; transform: rotate(-18deg); animation-delay: .4s; }
        .beta-line.l4 { left: 450px; top: 62px; width: 125px; transform: rotate(18deg); animation-delay: .6s; }

        .beta-pulse {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: rgba(250, 204, 21, .96);
          box-shadow: 0 0 18px rgba(250, 204, 21, .82), 0 0 36px rgba(59, 130, 246, .3);
          animation: beta-pulse 2.3s ease-in-out infinite;
        }

        @keyframes beta-grid-move {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(34px, 34px, 0); }
        }

        @keyframes beta-float {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-4deg); }
          50% { transform: translate3d(0, -17px, 0) rotate(4deg); }
        }

        @keyframes beta-pulse {
          0%, 100% { opacity: .38; transform: scale(.65); }
          50% { opacity: 1; transform: scale(1.35); }
        }

        @keyframes beta-line-glow {
          0%, 100% { opacity: .42; }
          50% { opacity: 1; }
        }
      `}</style>

      <div className="beta-grid absolute inset-0 opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(250,204,21,0.14),transparent_29%),radial-gradient(circle_at_66%_46%,rgba(59,130,246,0.34),transparent_38%),radial-gradient(circle_at_90%_90%,rgba(14,165,233,0.16),transparent_35%)]" />

      <div className="beta-symbol">β</div>
      <div className="beta-wave">
        <span className="beta-line l1" />
        <span className="beta-line l2" />
        <span className="beta-line l3" />
        <span className="beta-line l4" />
      </div>
      {pulses}

      <div className="relative z-10 flex min-h-[360px] max-w-4xl flex-col justify-between">
        <div>
          <div className="inline-flex rounded-full border border-blue-300/30 bg-blue-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-blue-100">
            Beta Temporal Expert
          </div>
          <h1 className="mt-8 text-5xl font-black tracking-tight text-white md:text-7xl">
            Beta Temporal
          </h1>
          <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-blue-50/80">
            PyTorch GRU-attention sequence expert built from exported Beta artifacts.
            This page emphasizes train / validation / test sequence forecasts, MC-dropout uncertainty,
            temporal attention, and feature occlusion.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Symbol
            </div>
            <div className="mt-2 text-sm font-black text-white">β / sequence memory</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Main Graph Source
            </div>
            <div className="mt-2 text-sm font-black text-white">evaluation_rollforward.csv</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Uncertainty
            </div>
            <div className="mt-2 text-sm font-black text-white">MC dropout + residual calibration</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildSplitRows(rows: any[], horizon = 10): ForecastChartRow[] {
  return rows
    .filter((row) => Number(row.horizon) === horizon)
    .map((row) => ({
      date: String(row.date),
      split: String(row.split || "test"),
      actual: asNumber(row.actual_target),
      forecast: asNumber(row.prediction),
      naiveForecast: asNumber(row.naive_prediction),
      currentGold: asNumber(row.raw_origin_gold_price),
      predictedLogReturn: asNumber(row.predicted_log_return),
      betaError: asNumber(row.error),
    }))
    .filter((row) => row.actual !== null && row.forecast !== null);
}

function buildRollingRows(rows: any[], horizon = 10): ForecastChartRow[] {
  return rows
    .filter((row) => Number(row.horizon) === horizon)
    .map((row) => ({
      date: String(row.date),
      split: "rolling_test",
      actual: asNumber(row.actual_target),
      forecast: asNumber(row.prediction),
      naiveForecast: asNumber(row.naive_prediction),
      currentGold: asNumber(row.raw_origin_gold_price),
      predictedLogReturn: asNumber(row.predicted_log_return),
      betaError: asNumber(row.error),
    }))
    .filter((row) => row.actual !== null && row.forecast !== null);
}

function buildTrainingRows(rows: any[]): ForecastChartRow[] {
  return rows
    .map((row, index) => ({
      date: String(firstValue(row.epoch, index + 1)),
      split: String(firstValue(row.model_stage, "training")),
      actual: asNumber(row.train_loss),
      forecast: asNumber(row.val_loss),
      bestValLoss: asNumber(row.best_val_loss),
    }))
    .filter((row) => row.actual !== null || row.forecast !== null);
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
      BetaMAPE: modelTest.mape,
      NaiveMAPE: naiveTest.mape,
      BetaMAE: modelTest.mae,
      NaiveMAE: naiveTest.mae,
      BetaRMSE: modelTest.rmse,
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

function buildCoverageRows(mcSummary: any, uncertainty: any): MetricChartRow[] {
  const coverage =
    mcSummary?.evaluation_interval_summary?.coverage_by_horizon ||
    uncertainty?.coverage_by_horizon ||
    {};

  const widths =
    mcSummary?.evaluation_interval_summary?.mean_interval_width_by_horizon ||
    uncertainty?.mean_interval_width_by_horizon ||
    {};

  return Object.keys(coverage)
    .sort((a, b) => Number(a) - Number(b))
    .map((horizon) => ({
      split: "coverage",
      horizon: `${horizon}D`,
      label: `${horizon}D`,
      Coverage: coverage[horizon],
      Width: widths[horizon],
      Target: 80,
    }))
    .filter((row) => Number.isFinite(Number(row.Coverage)));
}

function buildResidualQuantileRows(uncertainty: any): MetricChartRow[] {
  const residuals = uncertainty?.residual_quantiles_by_horizon || {};

  return Object.keys(residuals)
    .sort((a, b) => Number(a) - Number(b))
    .map((horizon) => {
      const row = residuals[horizon];

      return {
        split: "residual_quantiles",
        horizon: `${horizon}D`,
        label: `${horizon}D`,
        Q10Residual: row.q10_residual,
        Q90Residual: row.q90_residual,
        ResidualStd: row.residual_std,
      };
    })
    .filter((row) => Number.isFinite(Number(row.ResidualStd)));
}

function buildAttentionRows(attentionSummary: any) {
  const rows = attentionSummary?.temporal_attention || [];
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row: any) => ({
      feature: `${row.lag_from_origin} lag`,
      value: row.mean_attention_weight,
      sequence_position: row.sequence_position,
    }))
    .filter((row) => Number.isFinite(Number(row.value)));
}

function buildOcclusionRows(rows: any[]) {
  return rows
    .filter((row) => Number.isFinite(Number(row.mean_abs_price_change_when_occluded)))
    .sort(
      (a, b) =>
        Number(b.mean_abs_price_change_when_occluded) -
        Number(a.mean_abs_price_change_when_occluded)
    )
    .map((row) => ({
      feature: `${row.feature} (${row.horizon}D)`,
      value: row.mean_abs_price_change_when_occluded,
      sample_rows: row.sample_rows,
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
  title,
  valueFormatter,
  limit = 18,
}: {
  rows: any[];
  title: string;
  valueFormatter?: (value: any) => string;
  limit?: number;
}) {
  const chartRows = rows
    .filter((row) => Number.isFinite(Number(row.value)))
    .slice(0, limit);

  const maxValue = Math.max(...chartRows.map((row) => Number(row.value)), 0);

  if (!chartRows.length) return null;

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-2xl font-black tracking-tight text-slate-950">{title}</h3>

      <div className="mt-6 space-y-4">
        {chartRows.map((row, index) => {
          const value = Number(row.value);
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
                  title={`${row.feature}: ${formatNumber(value, 8)}. This explains model behavior, not causality.`}
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

export default async function BetaTemporalPage() {
  const results = await loadArtifacts();

  const report = getArtifact(results, "report");
  const runSummary = getArtifact(results, "runSummary");
  const forecast = getArtifact(results, "forecast");
  const evaluation = getArtifact(results, "evaluation");
  const evaluationRollforward = getArtifact(results, "evaluationRollforward") || [];
  const rollingOriginPredictions = getArtifact(results, "rollingOriginPredictions") || [];
  const trainingHistory = getArtifact(results, "trainingHistory") || [];
  const mcDropoutSummary = getArtifact(results, "mcDropoutSummary");
  const uncertaintyLatest = getArtifact(results, "uncertaintyLatest");
  const attentionSummary = getArtifact(results, "attentionSummary");
  const occlusion = getArtifact(results, "occlusion") || [];
  const bestConfig = getArtifact(results, "bestConfig");
  const optunaSummary = getArtifact(results, "optunaSummary");
  const qualityReview = getArtifact(results, "qualityReview");
  const sequenceManifest = getArtifact(results, "sequenceManifest");
  const modeStatus = getArtifact(results, "modeStatus");
  const matrixManifest = getArtifact(results, "matrixManifest");

  const loadedCount = results.filter((item) => item.ok).length;

  const selectedHorizon = 10;
  const splitRows = buildSplitRows(evaluationRollforward, selectedHorizon);
  const recentTestRows = splitRows.filter((row) => row.split === "test").slice(-180);
  const rollingRows = buildRollingRows(rollingOriginPredictions, selectedHorizon).slice(-180);
  const trainingRows = buildTrainingRows(trainingHistory);

  const metricRows = buildMetricRows(evaluation);
  const naiveRows = buildNaiveRows(evaluation);
  const improvementRows = buildImprovementRows(report, evaluation);
  const forecastRows = buildForecastRows(forecast);
  const coverageRows = buildCoverageRows(mcDropoutSummary, uncertaintyLatest);
  const residualQuantileRows = buildResidualQuantileRows(uncertaintyLatest);
  const attentionRows = buildAttentionRows(attentionSummary);
  const occlusionRows = buildOcclusionRows(occlusion);

  const trainAvgMape = splitMetricAverage(metricRows, "train", "MAPE");
  const validationAvgMape = splitMetricAverage(metricRows, "validation", "MAPE");
  const testAvgMape = splitMetricAverage(metricRows, "test", "MAPE");
  const testAvgDirection = splitMetricAverage(metricRows, "test", "DirectionalAccuracy");

  const avgCoverage = average(coverageRows.map((row) => row.Coverage));
  const avgWidth = average(coverageRows.map((row) => row.Width));

  const forecastPoints = forecast?.forecast_points || [];
  const latestForecastPoint = forecastPoints[0];

  const modelName = firstValue(forecast?.model_name, runSummary?.model_name, "Beta Temporal Expert");
  const modelVersion = firstValue(report?.model_version, forecast?.model_version, runSummary?.model_version);
  const status = firstValue(report?.status, qualityReview?.status, "loaded");
  const generatedAt = firstValue(report?.generated_at_utc, forecast?.generated_at_utc);

  const validationMethods = Array.isArray(report?.validation_methods) ? report.validation_methods : [];
  const uncertaintyMethods = Array.isArray(report?.uncertainty_methods) ? report.uncertainty_methods : [];
  const interpretabilityMethods = Array.isArray(report?.interpretability_methods) ? report.interpretability_methods : [];

  const config = firstValue(bestConfig?.best_config, report?.best_config, optunaSummary?.best_config, {});

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-[1800px]">
        <BetaHero />

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Artifact Status"
            value={<StatusPill status={status} />}
            note={`${loadedCount}/${ARTIFACTS.length} page artifacts loaded.`}
          />
          <MetricCard
            label="Generated"
            value={<span className="text-2xl">{formatDateTime(generatedAt)}</span>}
            note="Beta report and forecast timestamp."
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
              title="Beta Temporal artifact summary"
              description="The page reads sequence model identity, split predictions, rolling-origin validation, MC-dropout uncertainty, attention, feature occlusion, and training history from Beta artifacts only."
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
              <InfoLine label="Device" value={firstValue(report?.device_info?.device, optunaSummary?.device_info?.device)} />
              <InfoLine label="CUDA device" value={firstValue(report?.device_info?.cuda_device_name, optunaSummary?.device_info?.cuda_device_name)} />
              <InfoLine label="Runtime" value={report?.runtime_elapsed_hms || `${formatNumber(report?.runtime_elapsed_seconds, 1)} sec`} />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[2rem] border border-blue-100 bg-blue-50 p-5">
                <div className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                  Validation
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

              <div className="rounded-[2rem] border border-cyan-100 bg-cyan-50 p-5">
                <div className="text-[10px] font-black uppercase tracking-widest text-cyan-600">
                  Uncertainty
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {uncertaintyMethods.map((item: string) => (
                    <span
                      key={item}
                      className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-700"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5">
                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                  Interpretability
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
            <SectionHeader eyebrow="Sequence Contract" title="Run configuration" />

            <div className="grid gap-4">
              <MetricCard
                label="Architecture"
                value={<span className="text-2xl">{config?.architecture || "Not in artifact"}</span>}
                note={`Model type: ${config?.model_type || "Not in artifact"}`}
              />
              <MetricCard
                label="Sequence Length"
                value={formatNumber(config?.sequence_length)}
                note="Input lookback window from best_config."
              />
              <MetricCard
                label="Selected Features"
                value={formatNumber(firstValue(report?.selected_feature_count, sequenceManifest?.feature_count))}
                note="Feature count from report / sequence manifest."
              />
              <MetricCard
                label="Optuna Trials"
                value={formatNumber(firstValue(report?.n_trials, optunaSummary?.n_trials))}
                note={`Best objective: ${formatNumber(optunaSummary?.best_value_objective, 4)}`}
              />
            </div>
          </div>
        </section>

        <ConditionalSection show={splitRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Main Split Forecast Graph"
              title={`Actual vs Beta forecast — train, validation, and test (${selectedHorizon}-day horizon)`}
              description="This is the main professor-style graph. It uses evaluation_rollforward.csv, which contains train, validation, and test rows."
            />

            <ActualVsForecastChart
              rows={splitRows}
              forecastKey="forecast"
              forecastLabel="Beta Temporal Forecast"
              actualKey="actual"
              actualLabel="Actual Target Gold"
              title={`Actual vs Beta Forecast — Train / Validation / Test (${selectedHorizon}D Horizon)`}
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
              title={`Beta residuals across train, validation, and test (${selectedHorizon}-day horizon)`}
              description="Residual equals actual target gold price minus Beta predicted price."
            />

            <ResidualChart
              rows={splitRows}
              forecastKey="forecast"
              forecastLabel="Beta Temporal Forecast"
              actualKey="actual"
              title={`Beta Residuals — Train / Validation / Test (${selectedHorizon}D Horizon)`}
              subtitle="Residual = actual target price minus Beta predicted price."
              yAxisLabel="Actual - Beta Forecast"
              showSplitMarkers={true}
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={recentTestRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Recent Test Zoom"
              title={`Recent test window — Beta static split predictions (${selectedHorizon}-day horizon)`}
              description="This zoomed chart focuses only on recent test rows from evaluation_rollforward.csv."
            />

            <ActualVsForecastChart
              rows={recentTestRows}
              forecastKey="forecast"
              forecastLabel="Beta Temporal Forecast"
              actualKey="actual"
              actualLabel="Actual Target Gold"
              title={`Recent Test Actual vs Beta Forecast (${selectedHorizon}D Horizon)`}
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
              forecastLabel="Beta Rolling Forecast"
              actualKey="actual"
              actualLabel="Actual Target Gold"
              title={`Rolling-Origin Actual vs Beta Forecast (${selectedHorizon}D Horizon)`}
              subtitle="Rolling-origin test rows from Beta artifact."
              yAxisLabel="Gold Price (USD/oz)"
              showSplitMarkers={false}
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={trainingRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Training History"
              title="Beta training and validation loss"
              description="This graph reads training_history.csv and displays train_loss against val_loss."
            />

            <ActualVsForecastChart
              rows={trainingRows}
              forecastKey="forecast"
              forecastLabel="Validation Loss"
              actualKey="actual"
              actualLabel="Train Loss"
              title="Beta Training vs Validation Loss"
              subtitle="Loss values from training_history.csv."
              yAxisLabel="Loss"
              showSplitMarkers={false}
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={metricRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Train / Validation / Test Metrics"
              title="Split-based horizon metrics"
              description="These charts use evaluation_by_horizon.json and show train, validation, and test metrics by forecast horizon."
            />

            <div className="grid gap-6">
              <MetricComparisonChart
                rows={metricRows}
                split="train"
                xKey="horizon"
                xLabel="Forecast Horizon"
                yLabel="Gold Price Error"
                title="Beta Train Error by Horizon"
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
                title="Beta Validation Error by Horizon"
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
                title="Beta Test Error by Horizon"
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
              note="Average across Beta horizons."
            />
            <MetricCard
              label="Avg Validation MAPE"
              value={validationAvgMape === null ? "Not in artifact" : formatPercent(validationAvgMape)}
              note="Average across Beta horizons."
            />
            <MetricCard
              label="Avg Test MAPE"
              value={testAvgMape === null ? "Not in artifact" : formatPercent(testAvgMape)}
              note="Average across Beta horizons."
            />
            <MetricCard
              label="Avg Test Direction"
              value={testAvgDirection === null ? "Not in artifact" : formatPercent(testAvgDirection)}
              note="Average directional accuracy across Beta horizons."
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={naiveRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Beta vs Naive"
              title="Naive benchmark comparison by horizon"
              description="This section compares Beta against the naive current-price benchmark using exported evaluation metrics. It is not a final Deep ML ranking."
            />

            <div className="grid gap-6">
              <MetricComparisonChart
                rows={naiveRows}
                split="test"
                xKey="horizon"
                xLabel="Forecast Horizon"
                yLabel="MAPE (%)"
                title="Beta vs Naive Test MAPE"
                subtitle="Lower MAPE is generally better. Values come from evaluation_by_horizon.json."
                bars={[
                  { key: "BetaMAPE", label: "Beta MAPE", color: "#2563eb" },
                  { key: "NaiveMAPE", label: "Naive MAPE", color: "#ca8a04" },
                ]}
              />

              <MetricComparisonChart
                rows={naiveRows}
                split="test"
                xKey="horizon"
                xLabel="Forecast Horizon"
                yLabel="Gold Price Error"
                title="Beta vs Naive Test MAE/RMSE"
                subtitle="Gold-price error comparison across horizons."
                bars={[
                  { key: "BetaMAE", label: "Beta MAE", color: "#2563eb" },
                  { key: "NaiveMAE", label: "Naive MAE", color: "#ca8a04" },
                  { key: "BetaRMSE", label: "Beta RMSE", color: "#16a34a" },
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
              title="Beta improvement by horizon"
              description="Positive values mean the exported metric improved versus the naive benchmark. This remains a benchmark view, not a final model ranking."
            />

            <MetricComparisonChart
              rows={improvementRows}
              split="test"
              xKey="horizon"
              xLabel="Forecast Horizon"
              yLabel="Improvement vs Naive (%)"
              title="Beta Improvement vs Naive"
              subtitle="Improvement fields from Beta report/evaluation artifacts."
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
              title="Beta latest p10 / p50 / p90 by horizon"
              description="This chart displays forecast_latest.json values. These are MC-dropout/residual-calibrated uncertainty outputs, not guaranteed future ranges."
            />

            <MetricComparisonChart
              rows={forecastRows}
              split="latest"
              xKey="horizon"
              xLabel="Forecast Horizon"
              yLabel="Gold Price (USD/oz)"
              title="Beta Latest Forecast Quantiles"
              subtitle="p10, p50, and p90 from forecast_latest.json."
              bars={[
                { key: "P10", label: "p10", color: "#2563eb" },
                { key: "P50", label: "p50", color: "#ca8a04" },
                { key: "P90", label: "p90", color: "#16a34a" },
              ]}
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={coverageRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="MC Dropout Coverage"
              title="Beta uncertainty coverage and interval width"
              description="Coverage and interval width are diagnostic interval estimates from MC dropout and validation-residual calibration."
            />

            <MetricComparisonChart
              rows={coverageRows}
              split="coverage"
              xKey="horizon"
              xLabel="Forecast Horizon"
              yLabel="Coverage / Width"
              title="Beta MC-Dropout Interval Diagnostics"
              subtitle="Coverage, target coverage, and mean interval width by horizon."
              bars={[
                { key: "Coverage", label: "Coverage %", color: "#2563eb" },
                { key: "Target", label: "Target %", color: "#ca8a04" },
                { key: "Width", label: "Mean Width", color: "#16a34a" },
              ]}
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={residualQuantileRows.length > 0}>
          <section className="mt-14">
            <SectionHeader
              eyebrow="Residual Calibration"
              title="Residual quantiles by horizon"
              description="Residual quantiles explain the calibration layer used for Beta uncertainty. They do not guarantee future ranges."
            />

            <MetricComparisonChart
              rows={residualQuantileRows}
              split="residual_quantiles"
              xKey="horizon"
              xLabel="Forecast Horizon"
              yLabel="Residual / Std"
              title="Beta Residual Calibration Summary"
              subtitle="Residual q10, residual q90, and residual standard deviation."
              bars={[
                { key: "Q10Residual", label: "q10 Residual", color: "#2563eb" },
                { key: "Q90Residual", label: "q90 Residual", color: "#ca8a04" },
                { key: "ResidualStd", label: "Residual Std", color: "#16a34a" },
              ]}
            />
          </section>
        </ConditionalSection>

        <ConditionalSection show={forecastPoints.length > 0}>
          <section className="mt-14 rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader
              eyebrow="Latest Forecast Table"
              title="Multi-horizon Beta forecast points"
              description="This table displays forecast_latest.json directly. p10/p50/p90 are model outputs, not guarantees."
            />

            <LatestForecastTable rows={forecastPoints} />
          </section>
        </ConditionalSection>

        <ConditionalSection show={attentionRows.length > 0 || occlusionRows.length > 0}>
          <section className="mt-14 grid gap-6 xl:grid-cols-2">
            {attentionRows.length > 0 && (
              <div>
                <SectionHeader
                  eyebrow="Temporal Attention"
                  title="Sequence attention behavior"
                  description="Attention indicates where the sequence model focused in the input window. It does not prove economic causality."
                />

                <FeatureBars
                  rows={attentionRows}
                  title="Mean Attention Weight by Sequence Lag"
                  valueFormatter={(value) => formatNumber(value, 6)}
                  limit={20}
                />
              </div>
            )}

            {occlusionRows.length > 0 && (
              <div>
                <SectionHeader
                  eyebrow="Feature Occlusion"
                  title="Occlusion sensitivity behavior"
                  description="Occlusion measures model sensitivity when features are masked. It explains behavior, not causality."
                />

                <FeatureBars
                  rows={occlusionRows}
                  title="Top Occlusion Feature-Horizon Effects"
                  valueFormatter={(value) => formatUsd(value)}
                  limit={20}
                />
              </div>
            )}
          </section>
        </ConditionalSection>

        <section className="mt-14 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader
              eyebrow="Data Governance"
              title="Sequence and matrix context"
              description="These values are read from the sequence dataset manifest and feature-store governance artifacts."
            />

            <div className="grid gap-3">
              <InfoLine label="Sequence rows" value={formatNumber(sequenceManifest?.row_count)} />
              <InfoLine label="Feature count" value={formatNumber(sequenceManifest?.feature_count)} />
              <InfoLine label="Core start date" value={formatDate(sequenceManifest?.core_start_date)} />
              <InfoLine label="Target strategy" value={sequenceManifest?.target_strategy} />
              <InfoLine label="Matrix rows" value={formatNumber(matrixManifest?.row_count)} />
              <InfoLine label="Matrix columns" value={formatNumber(matrixManifest?.column_count)} />
              <InfoLine label="Official cutoff" value={formatDate(matrixManifest?.official_cutoff)} />
              <InfoLine label="Gold source" value={matrixManifest?.gold_live_source?.source_type} />
              <InfoLine label="Quality status" value={<StatusPill status={qualityReview?.status} />} />
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
                Keep Beta uncertainty described as MC-dropout and residual-calibrated interval behavior, not guaranteed future ranges.
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
            description="The Beta page uses only sections supported by real artifact rows and drops unsupported graph sections."
          />

          <ArtifactDownloads results={results} />
        </section>
      </div>
    </main>
  );
}