from pathlib import Path

PAGE = Path("src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx")
PAGE.parent.mkdir(parents=True, exist_ok=True)

PAGE.write_text(r'''
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ArtifactKind = "json" | "csv";

type ArtifactSpec = {
  key: string;
  label: string;
  path: string;
  kind: ArtifactKind;
  group: string;
  required?: boolean;
};

type LoadedArtifact = ArtifactSpec & {
  ok: boolean;
  data: any;
  error?: string;
};

type ModelKey = "omega" | "alpha" | "beta" | "delta" | "epsilon";

type ModelConfig = {
  key: ModelKey;
  label: string;
  shortLabel: string;
  family: string;
  role: string;
  reportKey: string;
  forecastKey: string;
  rollKey: string;
  evalKey: string;
  forecastPointsKey?: string;
};

type ForecastRow = {
  date: string;
  actual: number | null;
  forecast: number | null;
  lower: number | null;
  upper: number | null;
  residual: number | null;
  absolute_error: number | null;
  absolute_percentage_error: number | null;
  split: string;
  source: string;
  interval_source: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  mode?: string;
  sources?: string[];
};

const PROJECT_FORECAST_START = "2026-05-05";

const MODELS: ModelConfig[] = [
  {
    key: "omega",
    label: "Omega Fusion",
    shortLabel: "Omega",
    family: "Final Deep ML fusion layer",
    role: "Selected final Deep ML forecast layer",
    reportKey: "omegaReport",
    forecastKey: "omegaForecastLatest",
    forecastPointsKey: "omegaForecastPoints",
    rollKey: "omegaRollforward",
    evalKey: "omegaEvaluation",
  },
  {
    key: "alpha",
    label: "Alpha Structural",
    shortLabel: "Alpha",
    family: "Structural XGBoost expert",
    role: "Alternative expert view",
    reportKey: "alphaReport",
    forecastKey: "alphaForecastLatest",
    rollKey: "alphaRollforward",
    evalKey: "alphaEvaluation",
  },
  {
    key: "beta",
    label: "Beta Temporal",
    shortLabel: "Beta",
    family: "Temporal sequence expert",
    role: "Alternative expert view",
    reportKey: "betaReport",
    forecastKey: "betaForecastLatest",
    rollKey: "betaRollforward",
    evalKey: "betaEvaluation",
  },
  {
    key: "delta",
    label: "Delta TFT",
    shortLabel: "Delta",
    family: "Temporal Fusion Transformer expert",
    role: "Alternative expert view",
    reportKey: "deltaReport",
    forecastKey: "deltaForecastLatest",
    rollKey: "deltaRollforward",
    evalKey: "deltaEvaluation",
  },
  {
    key: "epsilon",
    label: "Epsilon Ensemble",
    shortLabel: "Epsilon",
    family: "Benchmark/statistical ML ensemble",
    role: "Alternative expert view",
    reportKey: "epsilonReport",
    forecastKey: "epsilonForecastLatest",
    rollKey: "epsilonRollforward",
    evalKey: "epsilonEvaluation",
  },
];

const ARTIFACTS: ArtifactSpec[] = [
  { key: "omegaReport", label: "Omega Fusion Report", path: "artifacts/deep_ml/models/omega_fusion/phase14_omega_fusion_report.json", kind: "json", group: "Omega", required: true },
  { key: "omegaForecastLatest", label: "Omega Forecast Latest", path: "artifacts/deep_ml/models/omega_fusion/omega_forecast_latest.json", kind: "json", group: "Omega", required: true },
  { key: "omegaForecastPoints", label: "Omega Forecast Points", path: "artifacts/deep_ml/models/omega_fusion/omega_forecast_points.csv", kind: "csv", group: "Omega", required: true },
  { key: "omegaRollforward", label: "Omega Rollforward", path: "artifacts/deep_ml/models/omega_fusion/omega_rollforward.csv", kind: "csv", group: "Omega", required: true },
  { key: "omegaEvaluation", label: "Omega Evaluation by Horizon", path: "artifacts/deep_ml/models/omega_fusion/omega_evaluation_by_horizon.json", kind: "json", group: "Omega", required: true },
  { key: "omegaRanking", label: "Omega Model Ranking", path: "artifacts/deep_ml/models/omega_fusion/omega_model_ranking.json", kind: "json", group: "Omega" },
  { key: "omegaWeights", label: "Omega Weights by Horizon", path: "artifacts/deep_ml/models/omega_fusion/omega_weights_by_horizon.json", kind: "json", group: "Omega" },
  { key: "omegaQuality", label: "Omega Quality Review", path: "artifacts/deep_ml/models/omega_fusion/quality_review.json", kind: "json", group: "Omega" },

  { key: "alphaReport", label: "Alpha Structural Report", path: "artifacts/deep_ml/models/alpha_structural/phase6_alpha_structural_report.json", kind: "json", group: "Alpha" },
  { key: "alphaForecastLatest", label: "Alpha Forecast Latest", path: "artifacts/deep_ml/models/alpha_structural/forecast_latest.json", kind: "json", group: "Alpha" },
  { key: "alphaRollforward", label: "Alpha Rollforward", path: "artifacts/deep_ml/models/alpha_structural/evaluation_rollforward.csv", kind: "csv", group: "Alpha" },
  { key: "alphaEvaluation", label: "Alpha Evaluation by Horizon", path: "artifacts/deep_ml/models/alpha_structural/evaluation_by_horizon.json", kind: "json", group: "Alpha" },

  { key: "betaReport", label: "Beta Temporal Report", path: "artifacts/deep_ml/models/beta_temporal/phase7_beta_temporal_report.json", kind: "json", group: "Beta" },
  { key: "betaForecastLatest", label: "Beta Forecast Latest", path: "artifacts/deep_ml/models/beta_temporal/forecast_latest.json", kind: "json", group: "Beta" },
  { key: "betaRollforward", label: "Beta Rollforward", path: "artifacts/deep_ml/models/beta_temporal/evaluation_rollforward.csv", kind: "csv", group: "Beta" },
  { key: "betaEvaluation", label: "Beta Evaluation by Horizon", path: "artifacts/deep_ml/models/beta_temporal/evaluation_by_horizon.json", kind: "json", group: "Beta" },

  { key: "deltaReport", label: "Delta TFT Report", path: "artifacts/deep_ml/models/delta_tft/phase8_delta_tft_report.json", kind: "json", group: "Delta" },
  { key: "deltaForecastLatest", label: "Delta Forecast Latest", path: "artifacts/deep_ml/models/delta_tft/forecast_latest.json", kind: "json", group: "Delta" },
  { key: "deltaRollforward", label: "Delta Rollforward", path: "artifacts/deep_ml/models/delta_tft/evaluation_rollforward.csv", kind: "csv", group: "Delta" },
  { key: "deltaEvaluation", label: "Delta Evaluation by Horizon", path: "artifacts/deep_ml/models/delta_tft/evaluation_by_horizon.json", kind: "json", group: "Delta" },

  { key: "epsilonReport", label: "Epsilon Expert Report", path: "artifacts/deep_ml/models/epsilon_expert_ensemble/phase9_epsilon_expert_report.json", kind: "json", group: "Epsilon" },
  { key: "epsilonForecastLatest", label: "Epsilon Forecast Latest", path: "artifacts/deep_ml/models/epsilon_expert_ensemble/forecast_latest.json", kind: "json", group: "Epsilon" },
  { key: "epsilonRollforward", label: "Epsilon Rollforward", path: "artifacts/deep_ml/models/epsilon_expert_ensemble/evaluation_rollforward.csv", kind: "csv", group: "Epsilon" },
  { key: "epsilonEvaluation", label: "Epsilon Evaluation by Horizon", path: "artifacts/deep_ml/models/epsilon_expert_ensemble/evaluation_by_horizon.json", kind: "json", group: "Epsilon" },

  { key: "gammaReport", label: "Gamma News Sensitivity Report", path: "artifacts/deep_ml/models/gamma_news_sensitivity/phase13_gamma_news_sensitivity_report.json", kind: "json", group: "Gamma" },
  { key: "gammaLatest", label: "Gamma Latest Context", path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_latest_context.json", kind: "json", group: "Gamma" },
  { key: "gammaSensitivity", label: "Gamma Sensitivity by Horizon", path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_sensitivity_by_horizon.json", kind: "json", group: "Gamma" },

  { key: "modeStatus", label: "Deep ML Mode Status", path: "artifacts/deep_ml/governance/deep_ml_mode_status.json", kind: "json", group: "Governance" },
  { key: "studyContext", label: "Study Context", path: "artifacts/deep_ml/governance/study_context.json", kind: "json", group: "Governance" },
  { key: "effectiveWindow", label: "Effective Data Window", path: "artifacts/deep_ml/governance/effective_data_window.json", kind: "json", group: "Governance" },
  { key: "forecastStart", label: "Forecast Start Decision", path: "artifacts/deep_ml/governance/forecast_start_decision.json", kind: "json", group: "Governance" },

  { key: "phase10", label: "Step 10 Source Update", path: "artifacts/deep_ml/source_update/phase10_source_update_refresh_report.json", kind: "json", group: "Data Refresh" },
  { key: "goldLiveSummary", label: "Step 10A Gold Live Update", path: "artifacts/deep_ml/source_update/gold_live_update_summary.json", kind: "json", group: "Data Refresh" },
  { key: "phase11", label: "Step 11 Feature Refresh", path: "artifacts/deep_ml/feature_refresh/phase11_governed_feature_store_refresh_report.json", kind: "json", group: "Feature Store" },
  { key: "matrix", label: "Deep ML Refreshed Matrix", path: "artifacts/deep_ml/features/deep_ml_refreshed_matrix.csv", kind: "csv", group: "Feature Store" },
];

function cleanHref(value: string) {
  return `/${String(value || "").replace(/^\/+/, "").replace(/^public\//, "")}`;
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quote = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (quote && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quote = !quote;
      }
      continue;
    }

    if (char === "," && !quote) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseCsv(text: string, maxRows = 60000) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((item) => item.trim());

  return lines.slice(1, maxRows + 1).map((line) => {
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

async function loadArtifact(spec: ArtifactSpec): Promise<LoadedArtifact> {
  try {
    const response = await fetch(cleanHref(spec.path), { cache: "no-store" });

    if (!response.ok) {
      return { ...spec, ok: false, data: spec.kind === "csv" ? [] : null, error: `HTTP ${response.status}` };
    }

    const text = await response.text();

    return {
      ...spec,
      ok: true,
      data: spec.kind === "json" ? JSON.parse(text) : parseCsv(text),
    };
  } catch (error) {
    return {
      ...spec,
      ok: false,
      data: spec.kind === "csv" ? [] : null,
      error: error instanceof Error ? error.message : "Artifact load failed.",
    };
  }
}

function isRecord(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function rowsFromAny(value: any): any[] {
  if (Array.isArray(value)) return value.filter((item) => isRecord(item));
  if (!isRecord(value)) return [];

  const keys = [
    "rows",
    "data",
    "records",
    "forecast_points",
    "future_forecast",
    "future_records",
    "path",
    "forecast_path",
    "metrics",
    "evaluation",
    "horizons",
    "by_horizon",
    "weights",
    "ranking",
    "sensitivity",
    "forecasts",
    "latest_forecast",
  ];

  for (const key of keys) {
    const child = value[key];

    if (Array.isArray(child)) return child.filter((item) => isRecord(item));

    if (isRecord(child)) {
      const rows = Object.entries(child).map(([k, v]) => {
        if (isRecord(v)) return { horizon: k, ...v };
        return { horizon: k, value: v };
      });

      if (rows.length) return rows;
    }
  }

  for (const child of Object.values(value)) {
    if (Array.isArray(child) && child.some((item) => isRecord(item))) {
      return child.filter((item) => isRecord(item));
    }

    if (isRecord(child)) {
      const nested = rowsFromAny(child);
      if (nested.length) return nested;
    }
  }

  return [];
}

function findValueDeep(obj: any, keys: string[], depth = 0): any {
  if (!obj || depth > 9) return null;

  if (isRecord(obj)) {
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
    }

    for (const value of Object.values(obj)) {
      const found = findValueDeep(value, keys, depth + 1);
      if (found !== null && found !== undefined && found !== "") return found;
    }
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findValueDeep(item, keys, depth + 1);
      if (found !== null && found !== undefined && found !== "") return found;
    }
  }

  return null;
}

function toNumber(value: any): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function firstNumber(...values: any[]) {
  for (const value of values) {
    const numeric = toNumber(value);
    if (numeric !== null) return numeric;
  }
  return null;
}

function firstText(...values: any[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
  }
  return "Not in artifact";
}

function dateTime(value: any) {
  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) ? time : null;
}

function formatNumber(value: any, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";
  return numeric.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function formatMoney(value: any) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";
  return `$${numeric.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function formatPct(value: any) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";
  return `${numeric.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`;
}

function formatDate(value: any) {
  if (!value) return "Not in artifact";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "2-digit" }).format(date);
}

function statusClass(value: any) {
  const text = String(value || "").toLowerCase();
  if (text.includes("ready") || text.includes("completed") || text.includes("loaded") || text.includes("pass")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (text.includes("review") || text.includes("pending") || text.includes("candidate") || text.includes("warning")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (text.includes("fail") || text.includes("missing") || text.includes("block")) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function StatusPill({ value }: { value: any }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(value)}`}>
      {value || "Not in artifact"}
    </span>
  );
}

function getActual(row: any) {
  return firstNumber(row.actual_gold_price, row.actual_target, row.actual, row.gold_price, row.observed, row.y);
}

function getForecast(row: any) {
  return firstNumber(
    row.omega_forecast,
    row.omega_prediction,
    row.omega_p50_weighted,
    row.prediction,
    row.forecast,
    row.forecast_mean,
    row.p50,
    row.q50,
    row.yhat,
    row.model_forecast
  );
}

function getLower(row: any) {
  return firstNumber(
    row.forecast_lower,
    row.lower_95,
    row.lower95,
    row.p025,
    row.q025,
    row.p05,
    row.q05,
    row.lower,
    row.lower_bound,
    row.yhat_lower
  );
}

function getUpper(row: any) {
  return firstNumber(
    row.forecast_upper,
    row.upper_95,
    row.upper95,
    row.p975,
    row.q975,
    row.p95,
    row.q95,
    row.upper,
    row.upper_bound,
    row.yhat_upper
  );
}

function explicitIntervalSource(row: any) {
  const keys = Object.keys(row || {}).map((key) => key.toLowerCase());

  if (keys.some((key) => key.includes("95") || key.includes("975") || key.includes("025"))) {
    return "95% interval from artifact";
  }

  if (keys.some((key) => key.includes("lower") || key.includes("upper"))) {
    return "lower/upper interval from artifact";
  }

  return "";
}

function normalizeForecastRows(rows: any[], source: string): ForecastRow[] {
  return rows
    .map((row) => {
      const actual = getActual(row);
      const forecast = getForecast(row);
      const lower = getLower(row);
      const upper = getUpper(row);
      const date = firstText(row.date, row.forecast_date, row.origin_date, row.ds, row.timestamp);
      const residual = firstNumber(row.residual, row.error) ?? (actual !== null && forecast !== null ? actual - forecast : null);
      const absolute_error = firstNumber(row.absolute_error, row.abs_error, row.mae_row) ?? (residual !== null ? Math.abs(residual) : null);
      const absolute_percentage_error =
        firstNumber(row.absolute_percentage_error, row.ape, row.mape_row) ??
        (actual !== null && actual !== 0 && absolute_error !== null ? (absolute_error / actual) * 100 : null);

      return {
        date,
        actual,
        forecast,
        lower,
        upper,
        residual,
        absolute_error,
        absolute_percentage_error,
        split: firstText(row.split, row.period, row.dataset, row.segment, row.row_source_type, "forecast"),
        source,
        interval_source: explicitIntervalSource(row) || "not available in row",
      };
    })
    .filter((row) => row.date !== "Not in artifact" && (row.forecast !== null || row.actual !== null));
}

function dedupeForecastRows(rows: ForecastRow[]) {
  const map = new Map<string, ForecastRow>();

  for (const row of rows) {
    const existing = map.get(row.date);

    if (!existing) {
      map.set(row.date, row);
      continue;
    }

    map.set(row.date, {
      date: row.date,
      actual: existing.actual ?? row.actual,
      forecast: row.forecast ?? existing.forecast,
      lower: row.lower ?? existing.lower,
      upper: row.upper ?? existing.upper,
      residual: row.residual ?? existing.residual,
      absolute_error: row.absolute_error ?? existing.absolute_error,
      absolute_percentage_error: row.absolute_percentage_error ?? existing.absolute_percentage_error,
      split: row.split || existing.split,
      source: row.source || existing.source,
      interval_source: row.interval_source !== "not available in row" ? row.interval_source : existing.interval_source,
    });
  }

  return Array.from(map.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function residualStd(rows: ForecastRow[]) {
  const residuals = rows
    .map((row) => row.residual)
    .filter((value): value is number => Number.isFinite(Number(value)));

  if (residuals.length < 8) return null;

  const mean = residuals.reduce((sum, value) => sum + value, 0) / residuals.length;
  const variance = residuals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(residuals.length - 1, 1);

  return Math.sqrt(variance);
}

function buildModelForecastRows(config: ModelConfig, data: (key: string) => any, startDate: string) {
  const forecastPointRows = config.forecastPointsKey ? (Array.isArray(data(config.forecastPointsKey)) ? data(config.forecastPointsKey) : []) : [];
  const latestRows = rowsFromAny(data(config.forecastKey));
  const rollRowsRaw = Array.isArray(data(config.rollKey)) ? data(config.rollKey) : [];

  const rollRows = normalizeForecastRows(rollRowsRaw, `${config.label} rollforward`);
  const futureRows = normalizeForecastRows([...forecastPointRows, ...latestRows], `${config.label} forecast`);

  const sigma = residualStd(rollRows);
  const startMs = dateTime(startDate) ?? dateTime(PROJECT_FORECAST_START) ?? 0;

  let candidates = futureRows.filter((row) => {
    const t = dateTime(row.date);
    return t !== null && t >= startMs;
  });

  if (candidates.length < 2) {
    candidates = rollRows.filter((row) => {
      const t = dateTime(row.date);
      return t !== null && t >= startMs;
    });
  }

  const withBand = candidates.map((row) => {
    if (row.forecast === null) return row;

    if (row.lower !== null && row.upper !== null) {
      return row;
    }

    if (sigma !== null) {
      return {
        ...row,
        lower: row.forecast - 1.96 * sigma,
        upper: row.forecast + 1.96 * sigma,
        interval_source: "Empirical 95% band from Deep ML rollforward residuals",
      };
    }

    return row;
  });

  return dedupeForecastRows(withBand);
}

function average(values: any[]) {
  const nums = values.map(Number).filter((value) => Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function computeMetrics(rows: ForecastRow[]) {
  const withActual = rows.filter((row) => row.actual !== null && row.forecast !== null);

  return {
    actualRows: withActual.length,
    forecastRows: rows.filter((row) => row.forecast !== null).length,
    mae: average(withActual.map((row) => row.absolute_error)),
    mape: average(withActual.map((row) => row.absolute_percentage_error)),
    residual: average(withActual.map((row) => row.residual)),
  };
}

function columnsFromRows(rows: any[]) {
  const cols = new Set<string>();
  rows.slice(0, 30).forEach((row) => Object.keys(row || {}).forEach((key) => cols.add(key)));
  return Array.from(cols);
}

function downsampleRows<T>(rows: T[], max = 700) {
  if (rows.length <= max) return rows;
  const step = Math.ceil(rows.length / max);
  return rows.filter((_, index) => index % step === 0);
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6">
      <div className="text-[11px] font-black uppercase tracking-[0.34em] text-blue-600">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">{title}</h2>
      {description ? <p className="mt-3 max-w-5xl text-sm font-medium leading-7 text-slate-500">{description}</p> : null}
    </div>
  );
}

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</div>
      {note ? <div className="mt-2 text-xs font-semibold leading-5 text-slate-500">{note}</div> : null}
    </div>
  );
}

function ForecastTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload || {};

  return (
    <div className="min-w-[340px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
      <div className="text-sm font-black text-slate-800">{label}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
        {row.split || "forecast"} · {row.source || "Deep ML"}
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        <div className="flex justify-between gap-4">
          <span className="font-bold text-emerald-700">Actual Gold</span>
          <span className="font-black">{formatMoney(row.actual)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="font-bold text-blue-700">Deep ML Forecast</span>
          <span className="font-black">{formatMoney(row.forecast)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="font-bold text-amber-700">Lower 95%</span>
          <span className="font-black">{formatMoney(row.lower)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="font-bold text-orange-700">Upper 95%</span>
          <span className="font-black">{formatMoney(row.upper)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="font-bold text-slate-500">Residual</span>
          <span className="font-black">{formatNumber(row.residual, 2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="font-bold text-slate-500">APE</span>
          <span className="font-black">{formatPct(row.absolute_percentage_error)}</span>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-bold leading-5 text-amber-900">
        Band source: {row.interval_source || "not available"}. Forecasts are model outputs, not guarantees.
      </div>
    </div>
  );
}

export default function FinalDeepMLEvaluationPage() {
  const [loaded, setLoaded] = useState<Record<string, LoadedArtifact>>({});
  const [loading, setLoading] = useState(true);
  const [selectedModelKey, setSelectedModelKey] = useState<ModelKey>("omega");

  const [aiQuestion, setAiQuestion] = useState("Explain the selected Deep ML forecast in business language.");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      mode: "deep_ml_forecast_ai",
      content:
        "I can explain this Deep ML final forecast page using Omega, Alpha, Beta, Delta, Epsilon, Gamma, Step 10, Step 10A, Step 11, and Deep ML governance artifacts only.",
      sources: [],
    },
  ]);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      const results = await Promise.all(ARTIFACTS.map(loadArtifact));
      const map: Record<string, LoadedArtifact> = {};
      results.forEach((item) => {
        map[item.key] = item;
      });
      setLoaded(map);
      setLoading(false);
    }

    loadAll();
  }, []);

  const data = (key: string) => loaded[key]?.data;

  const selectedModel = MODELS.find((model) => model.key === selectedModelKey) || MODELS[0];

  const forecastStart = firstText(
    findValueDeep(data("forecastStart"), ["forecast_start", "forecast_start_date", "start_date", "next_forecast_date"]),
    PROJECT_FORECAST_START
  );

  const forecastRowsByModel = useMemo(() => {
    const out: Record<ModelKey, ForecastRow[]> = {
      omega: [],
      alpha: [],
      beta: [],
      delta: [],
      epsilon: [],
    };

    for (const model of MODELS) {
      out[model.key] = buildModelForecastRows(model, data, forecastStart);
    }

    return out;
  }, [loaded, forecastStart]);

  const selectedForecastRows = forecastRowsByModel[selectedModelKey] || [];
  const chartRows = useMemo(() => downsampleRows(selectedForecastRows, 700), [selectedForecastRows]);
  const metrics = useMemo(() => computeMetrics(selectedForecastRows), [selectedForecastRows]);

  const loadedCount = useMemo(() => Object.values(loaded).filter((item) => item.ok).length, [loaded]);
  const requiredMissing = useMemo(() => ARTIFACTS.filter((item) => item.required && !loaded[item.key]?.ok), [loaded]);

  const matrixRows = Array.isArray(data("matrix")) ? data("matrix") : [];
  const latestMatrixRow = matrixRows.length ? matrixRows[matrixRows.length - 1] : {};
  const latestGold = firstNumber(latestMatrixRow.gold_price, latestMatrixRow.actual_gold_price, latestMatrixRow.actual_target);

  const selectedReportStatus = firstText(
    findValueDeep(data(selectedModel.reportKey), ["status", "run_status", "phase_status", "result"]),
    loaded[selectedModel.forecastKey]?.ok ? "Forecast loaded" : "Forecast artifact check"
  );

  const intervalRows = selectedForecastRows.filter((row) => row.lower !== null && row.upper !== null);
  const intervalLabel = intervalRows.some((row) => row.interval_source.toLowerCase().includes("95"))
    ? "95% band"
    : intervalRows.length
      ? "Empirical/available band"
      : "No interval band";

  const lastForecastDate = selectedForecastRows[selectedForecastRows.length - 1]?.date || "Not in artifact";
  const firstForecastDate = selectedForecastRows[0]?.date || forecastStart;

  const omegaWeightRows = rowsFromAny(data("omegaWeights"));
  const gammaRows = rowsFromAny(data("gammaSensitivity"));
  const selectedEvalRows = rowsFromAny(data(selectedModel.evalKey));

  const modelSummaryRows = MODELS.map((model) => {
    const rows = forecastRowsByModel[model.key] || [];
    const m = computeMetrics(rows);

    return {
      key: model.key,
      label: model.label,
      role: model.role,
      rows: rows.length,
      actualRows: m.actualRows,
      mae: m.mae,
      mape: m.mape,
      loaded: Boolean(loaded[model.forecastKey]?.ok || loaded[model.rollKey]?.ok),
    };
  });

  async function askAI(promptOverride?: string) {
    const prompt = (promptOverride || aiQuestion).trim();
    if (!prompt || aiBusy) return;

    const fullPrompt =
      `Selected Deep ML model on page: ${selectedModel.label}. ` +
      `Forecast window shown: ${firstForecastDate} to ${lastForecastDate}. ` +
      prompt;

    const nextMessages: ChatMessage[] = [...aiMessages, { role: "user", content: prompt }];
    setAiMessages(nextMessages);
    setAiQuestion("");
    setAiBusy(true);

    try {
      const response = await fetch("/api/gold-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: fullPrompt,
          pagePath: "/deep-ml/models/final-deep-ml-evaluation",
          history: nextMessages.slice(-8),
        }),
      });

      const result = await response.json();

      setAiMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result.answer || "No answer returned from Gold AI.",
          mode: result.mode,
          sources: result.sources,
        },
      ]);
    } catch (error) {
      setAiMessages((current) => [
        ...current,
        {
          role: "assistant",
          mode: "error",
          content: error instanceof Error ? error.message : "Gold AI connection error.",
          sources: [],
        },
      ]);
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950">
      <div className="mx-auto max-w-[1900px]">
        <section className="relative overflow-hidden rounded-[3rem] border border-slate-200 bg-slate-950 p-8 shadow-2xl shadow-blue-950/20">
          <style>{`
            .final-ml-orbit {
              position: absolute;
              right: 9%;
              top: 50%;
              width: 370px;
              height: 370px;
              margin-top: -185px;
              border-radius: 999px;
              border: 1px solid rgba(147,197,253,.24);
              animation: final-ml-spin 17s linear infinite;
            }
            .final-ml-orbit.two {
              width: 250px;
              height: 250px;
              margin-top: -125px;
              right: calc(9% + 60px);
              border-color: rgba(250,204,21,.30);
              animation-duration: 10s;
              animation-direction: reverse;
            }
            .final-ml-core {
              position: absolute;
              right: calc(9% + 110px);
              top: 50%;
              width: 150px;
              height: 150px;
              margin-top: -75px;
              border-radius: 999px;
              display: grid;
              place-items: center;
              background:
                radial-gradient(circle at 30% 25%, rgba(250,204,21,.65), transparent 30%),
                radial-gradient(circle at 70% 75%, rgba(37,99,235,.70), transparent 35%),
                rgba(15,23,42,.92);
              border: 1px solid rgba(255,255,255,.24);
              box-shadow: 0 0 90px rgba(59,130,246,.36), 0 0 120px rgba(250,204,21,.20), inset 0 0 42px rgba(255,255,255,.08);
              animation: final-ml-float 5s ease-in-out infinite;
            }
            .final-ml-node {
              position: absolute;
              width: 10px;
              height: 10px;
              border-radius: 999px;
              background: rgba(250,204,21,.96);
              box-shadow: 0 0 20px rgba(250,204,21,.8), 0 0 35px rgba(59,130,246,.45);
              animation: final-ml-pulse 2.2s ease-in-out infinite;
            }
            .final-ml-node.n1 { right: 7%; top: 22%; animation-delay: .1s; }
            .final-ml-node.n2 { right: 28%; top: 18%; animation-delay: .3s; }
            .final-ml-node.n3 { right: 6%; bottom: 24%; animation-delay: .5s; }
            .final-ml-node.n4 { right: 30%; bottom: 17%; animation-delay: .7s; }
            .final-ml-beam {
              position: absolute;
              right: 4%;
              width: 44%;
              height: 2px;
              border-radius: 999px;
              background: linear-gradient(90deg, transparent, rgba(59,130,246,.55), rgba(250,204,21,.48), transparent);
              animation: final-ml-beam 3s ease-in-out infinite;
            }
            .final-ml-beam.b1 { top: 34%; transform: rotate(7deg); }
            .final-ml-beam.b2 { top: 56%; transform: rotate(-7deg); animation-delay: .4s; }
            .final-ml-beam.b3 { top: 75%; transform: rotate(4deg); animation-delay: .8s; }
            @keyframes final-ml-spin {
              from { transform: rotateZ(0deg) rotateX(64deg); }
              to { transform: rotateZ(360deg) rotateX(64deg); }
            }
            @keyframes final-ml-float {
              0%, 100% { transform: translateY(0) scale(1); }
              50% { transform: translateY(-12px) scale(1.04); }
            }
            @keyframes final-ml-pulse {
              0%, 100% { opacity: .42; transform: scale(.85); }
              50% { opacity: 1; transform: scale(1.45); }
            }
            @keyframes final-ml-beam {
              0%, 100% { opacity: .18; }
              50% { opacity: .9; }
            }
          `}</style>

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(250,204,21,0.18),transparent_32%),radial-gradient(circle_at_80%_30%,rgba(59,130,246,0.24),transparent_36%),linear-gradient(135deg,#020617,#081426_58%,#000)]" />
          <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(148,163,184,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.12)_1px,transparent_1px)] [background-size:38px_38px]" />

          <span className="final-ml-orbit" />
          <span className="final-ml-orbit two" />
          <span className="final-ml-beam b1" />
          <span className="final-ml-beam b2" />
          <span className="final-ml-beam b3" />
          <span className="final-ml-node n1" />
          <span className="final-ml-node n2" />
          <span className="final-ml-node n3" />
          <span className="final-ml-node n4" />
          <span className="final-ml-core">
            <span className="text-center">
              <span className="block text-3xl font-black text-white">Ω</span>
              <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.22em] text-yellow-200">Fusion</span>
            </span>
          </span>

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="inline-flex rounded-full border border-yellow-300/30 bg-yellow-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-yellow-200">
                Deep ML Final Forecast · Selected Model View
              </div>

              <h1 className="mt-7 text-5xl font-black tracking-tight text-white md:text-7xl">
                Final Deep ML Forecast
              </h1>

              <p className="mt-5 max-w-4xl text-sm font-semibold leading-7 text-blue-50/80">
                This page is only for the Deep ML system. Omega Fusion is the selected final Deep ML forecast layer by default.
                You can switch to Alpha, Beta, Delta, or Epsilon to inspect alternative Deep ML expert forecast views.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <StatusPill value={selectedReportStatus} />
                <span className="rounded-full border border-blue-300/30 bg-blue-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-100">
                  selected: {selectedModel.label}
                </span>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-200">
                  latest matrix gold: {formatMoney(latestGold)}
                </span>
                <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-100">
                  {intervalLabel}
                </span>
              </div>
            </div>

            <div className="rounded-[2.4rem] border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-yellow-200">
                Forecast control
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {MODELS.map((model) => {
                  const active = model.key === selectedModelKey;
                  const row = modelSummaryRows.find((item) => item.key === model.key);

                  return (
                    <button
                      key={model.key}
                      type="button"
                      onClick={() => setSelectedModelKey(model.key)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        active
                          ? "border-yellow-300/50 bg-yellow-300/15 shadow-lg shadow-yellow-950/20"
                          : "border-white/10 bg-white/10 hover:bg-white/15"
                      }`}
                    >
                      <div className={active ? "text-sm font-black text-yellow-100" : "text-sm font-black text-white"}>
                        {model.shortLabel}
                      </div>
                      <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-white/45">
                        {row?.rows || 0} forecast rows
                      </div>
                      <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-emerald-200">
                        {row?.loaded ? "loaded" : "check"}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="text-[9px] font-black uppercase tracking-widest text-white/45">Viewing</div>
                <div className="mt-2 text-2xl font-black text-white">{selectedModel.label}</div>
                <div className="mt-2 text-xs font-bold leading-5 text-blue-50/70">{selectedModel.role}</div>
              </div>
            </div>
          </div>
        </section>

        {requiredMissing.length ? (
          <section className="mt-6 rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-900">
            Required Deep ML artifact warning: {requiredMissing.map((item) => item.label).join(", ")} did not load.
          </section>
        ) : null}

        <section className="mt-8 grid gap-5 md:grid-cols-4">
          <StatCard label="Selected Model" value={selectedModel.label} note={selectedModel.family} />
          <StatCard label="Forecast Window" value={`${formatDate(firstForecastDate)} → ${formatDate(lastForecastDate)}`} note="Main chart begins at the Deep ML forecast start date, not the full history." />
          <StatCard label="Forecast Rows" value={metrics.forecastRows.toLocaleString()} note="Future forecast rows loaded for the selected Deep ML model." />
          <StatCard label="Average MAE" value={formatMoney(metrics.mae)} note="Computed only where actual and forecast values both exist." />
        </section>

        <section className="mt-8 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            eyebrow="Future forecast chart"
            title={`Future ${selectedModel.label} Forecast with 95% Confidence Band`}
            description="This is the Deep ML final forecast chart. It begins from the forecast start date and does not use Academic model artifacts. If explicit 95% lower/upper fields are not available, the page computes an empirical 95% band from the selected model’s Deep ML rollforward residuals."
          />

          <div className="mb-5 flex flex-wrap gap-3">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
              actual rows: {metrics.actualRows}
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-700">
              selected: {selectedModel.label}
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-amber-700">
              {intervalLabel}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
              starts {formatDate(forecastStart)}
            </span>
          </div>

          <div className="h-[640px] rounded-[2rem] border border-slate-100 bg-slate-50 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartRows} margin={{ top: 20, right: 35, left: 25, bottom: 55 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={36} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => formatNumber(value, 0)}
                  width={90}
                  label={{
                    value: "Gold Price Forecast (USD/oz)",
                    angle: -90,
                    position: "insideLeft",
                    style: { textAnchor: "middle", fontSize: 12, fontWeight: 700, fill: "#64748b" },
                  }}
                />
                <Tooltip content={<ForecastTooltip />} />
                <Legend />

                <Area type="monotone" dataKey="upper" name="Upper 95%" stroke="#d97706" fill="#fde68a" fillOpacity={0.28} dot={false} connectNulls />
                <Area type="monotone" dataKey="lower" name="Lower 95%" stroke="#d97706" fill="#ffffff" fillOpacity={1} dot={false} connectNulls />
                <Line type="monotone" dataKey="actual" name="Actual Gold Price" stroke="#16a34a" strokeWidth={2.4} dot={false} connectNulls />
                <Line type="monotone" dataKey="forecast" name={`${selectedModel.label} Forecast`} stroke="#2563eb" strokeWidth={2.4} dot={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Model switchboard"
              title="Deep ML model forecast selector"
              description="Omega is the selected final Deep ML fusion layer. Other experts are available for inspection only."
            />

            <div className="grid gap-3">
              {modelSummaryRows.map((row) => (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => setSelectedModelKey(row.key)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    row.key === selectedModelKey
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-blue-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-950">{row.label}</div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">{row.role}</div>
                    </div>
                    <StatusPill value={row.loaded ? "Loaded" : "Check"} />
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Rows</div>
                      <div className="mt-1 text-sm font-black text-slate-800">{row.rows.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Actual</div>
                      <div className="mt-1 text-sm font-black text-slate-800">{row.actualRows.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">MAE</div>
                      <div className="mt-1 text-sm font-black text-slate-800">{formatMoney(row.mae)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">APE</div>
                      <div className="mt-1 text-sm font-black text-slate-800">{formatPct(row.mape)}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Forecast AI"
              title="Ask about this Deep ML forecast"
              description="Small AI box focused on selected model, forecast band, Omega/Gamma logic, and Deep ML artifacts."
            />

            <div className="mb-4 flex flex-wrap gap-2">
              {[
                "Explain the selected forecast in business language.",
                "What does the 95% band mean here?",
                "Why is Omega the final selected layer?",
                "Which artifacts support this selected model forecast?",
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => askAI(prompt)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="h-[420px] overflow-y-auto rounded-[2rem] border border-slate-100 bg-slate-50 p-4">
              <div className="space-y-4">
                {aiMessages.map((message, index) => (
                  <div
                    key={index}
                    className={
                      message.role === "user"
                        ? "ml-auto max-w-[88%] rounded-[1.4rem] bg-blue-600 p-4 text-white"
                        : "mr-auto max-w-[94%] rounded-[1.4rem] border border-slate-200 bg-white p-4 text-slate-900 shadow-sm"
                    }
                  >
                    {message.mode ? (
                      <div className="mb-2 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
                        {message.mode.replaceAll("_", " ")}
                      </div>
                    ) : null}
                    <div className="whitespace-pre-wrap text-sm leading-7">{message.content}</div>
                    {message.sources?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Array.from(new Set(message.sources)).slice(0, 6).map((source) => (
                          <span key={source} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                            {source}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}

                {aiBusy ? (
                  <div className="mr-auto rounded-[1.4rem] border border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">
                    Searching selected Deep ML forecast artifacts...
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-2">
              <textarea
                value={aiQuestion}
                onChange={(event) => setAiQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    askAI();
                  }
                }}
                rows={2}
                className="min-h-[48px] flex-1 resize-none bg-transparent px-4 py-3 text-sm outline-none"
                placeholder="Ask about selected model, forecast band, Omega, Gamma, or artifacts..."
              />
              <button
                type="button"
                onClick={() => askAI()}
                disabled={aiBusy || !aiQuestion.trim()}
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
              >
                Ask
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Selected model evaluation"
              title={`${selectedModel.label} evaluation rows`}
              description="Evaluation rows for the currently selected Deep ML model only."
            />

            <div className="max-h-[520px] overflow-auto rounded-[2rem] border border-slate-200 bg-white">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <tr>
                    {columnsFromRows(selectedEvalRows).slice(0, 9).map((column) => (
                      <th key={column} className="border-b border-slate-200 px-3 py-3">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedEvalRows.slice(0, 90).map((row, index) => (
                    <tr key={index} className="border-b border-slate-100 hover:bg-blue-50/40">
                      {columnsFromRows(selectedEvalRows).slice(0, 9).map((column) => (
                        <td key={column} className="max-w-[240px] truncate px-3 py-2 font-semibold text-slate-700">
                          {String(row?.[column] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedEvalRows.length === 0 ? (
                <div className="p-5 text-sm font-semibold text-slate-500">Selected model evaluation rows were not found in the artifact.</div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Gamma and Omega notes"
              title="Context and fusion evidence"
              description="Gamma is context-only. Omega is the final Deep ML fusion layer used by default."
            />

            <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-950">
              Gamma/news context is not causality. It helps explain market background around forecast dates, but it does not override the selected model forecast.
            </div>

            <div className="mt-5 max-h-[390px] overflow-auto rounded-[2rem] border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <tr>
                    {columnsFromRows(gammaRows).slice(0, 7).map((column) => (
                      <th key={column} className="border-b border-slate-200 px-3 py-3">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gammaRows.slice(0, 70).map((row, index) => (
                    <tr key={index} className="border-b border-slate-100">
                      {columnsFromRows(gammaRows).slice(0, 7).map((column) => (
                        <td key={column} className="max-w-[240px] truncate px-3 py-2 font-semibold text-slate-700">
                          {isRecord(row?.[column]) ? JSON.stringify(row?.[column]) : String(row?.[column] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {gammaRows.length === 0 ? (
                <div className="p-5 text-sm font-semibold text-slate-500">Gamma sensitivity rows were not found in the artifact.</div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            eyebrow="Deep ML artifact evidence"
            title="Files powering this page"
            description="Only Deep ML model, Omega, Gamma, source refresh, feature refresh, governance, and matrix artifacts are used here."
          />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {ARTIFACTS.map((artifact) => {
              const result = loaded[artifact.key];

              return (
                <a
                  key={artifact.key}
                  href={cleanHref(artifact.path)}
                  target="_blank"
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-black text-slate-950">{artifact.label}</div>
                      <div className="mt-1 break-words text-[11px] font-semibold leading-5 text-slate-500">{artifact.path}</div>
                    </div>
                    <StatusPill value={result?.ok ? "Loaded" : artifact.required ? "Missing required" : "Optional"} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                      {artifact.group}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                      {artifact.kind}
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
''', encoding="utf-8")

print("Rebuilt final Deep ML page: animation restored, model switcher added, future forecast starts from forecast start, empirical 95% band supported.")