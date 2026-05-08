
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
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

type DiagnosticRow = {
  date: string;
  actual: number | null;
  forecast: number | null;
  residual: number | null;
  absolute_error: number | null;
  absolute_percentage_error: number | null;
  horizon: string;
  split: string;
  source: string;
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
    role: "Alternative Deep ML expert view",
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
    role: "Alternative Deep ML expert view",
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
    role: "Alternative Deep ML expert view",
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
    role: "Alternative Deep ML expert view",
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
  { key: "forecastStartDecision", label: "Forecast Start Decision", path: "artifacts/deep_ml/governance/forecast_start_decision.json", kind: "json", group: "Governance" },

  { key: "phase10", label: "Step 10 Source Update", path: "artifacts/deep_ml/source_update/phase10_source_update_refresh_report.json", kind: "json", group: "Data Refresh" },
  { key: "goldLiveSummary", label: "Step 10A Gold Live Update", path: "artifacts/deep_ml/source_update/gold_live_update_summary.json", kind: "json", group: "Data Refresh" },
  { key: "phase11", label: "Step 11 Feature Refresh", path: "artifacts/deep_ml/feature_refresh/phase11_governed_feature_store_refresh_report.json", kind: "json", group: "Feature Store" },
  { key: "matrix", label: "Deep ML Refreshed Matrix", path: "artifacts/deep_ml/features/deep_ml_refreshed_matrix.csv", kind: "csv", group: "Feature Store" },
];

const MARKET_SHOCKS = [
  { label: "Global Financial Crisis", start: "2008-09-01", end: "2009-03-31", fill: "#f97316", text: "#c2410c" },
  { label: "COVID Shock", start: "2020-02-15", end: "2020-05-15", fill: "#ef4444", text: "#dc2626" },
  { label: "Russia-Ukraine / Inflation Stress", start: "2022-02-24", end: "2022-07-31", fill: "#a855f7", text: "#7c3aed" },
  { label: "High-rate Stress", start: "2023-05-01", end: "2023-10-31", fill: "#06b6d4", text: "#0891b2" },
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

function parseCsv(text: string, maxRows = 65000) {
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

  const candidateKeys = [
    "rows",
    "data",
    "records",
    "forecast_points",
    "forecast_path",
    "future_forecast",
    "future_records",
    "latest_forecast",
    "forecasts",
    "path",
    "metrics",
    "evaluation",
    "horizons",
    "by_horizon",
    "weights",
    "ranking",
    "sensitivity",
  ];

  for (const key of candidateKeys) {
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
    if (Array.isArray(child) && child.some((item) => isRecord(item))) return child.filter((item) => isRecord(item));

    if (isRecord(child)) {
      const nested = rowsFromAny(child);
      if (nested.length) return nested;
    }
  }

  return [];
}

function findValueDeep(obj: any, keys: string[], depth = 0): any {
  if (!obj || depth > 8) return null;

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

function parseDateValue(value: any) {
  if (!value) return null;

  const raw = String(value).trim();
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (ymd) {
    return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0);
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function dateKey(value: any) {
  const raw = String(value ?? "").trim();
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;

  const date = parseDateValue(value);
  if (!date) return raw || "Not in artifact";

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateTime(value: any) {
  const parsed = parseDateValue(value);
  return parsed ? parsed.getTime() : null;
}

function addBusinessDays(startDate: string, days: number) {
  const base = parseDateValue(startDate) || parseDateValue(PROJECT_FORECAST_START) || new Date();
  const d = new Date(base);
  let added = 0;

  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }

  return dateKey(d);
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

function isBlankValue(value: any) {
  return value === null || value === undefined || value === "";
}

function formatNumber(value: any, digits = 2) {
  if (isBlankValue(value)) return "Not in artifact";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";
  return numeric.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function formatMoney(value: any) {
  if (isBlankValue(value)) return "Not in artifact";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";
  return `$${numeric.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function formatPct(value: any) {
  if (isBlankValue(value)) return "Not in artifact";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";
  return `${numeric.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`;
}

function formatDate(value: any) {
  if (!value) return "Not in artifact";
  const date = parseDateValue(value);
  if (!date) return String(value);
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "2-digit" }).format(date);
}

function statusClass(value: any) {
  const text = String(value || "").toLowerCase();

  if (text.includes("ready") || text.includes("completed") || text.includes("loaded") || text.includes("pass")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (text.includes("review") || text.includes("pending") || text.includes("candidate") || text.includes("warning") || text.includes("alternative")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (text.includes("fail") || text.includes("missing") || text.includes("block")) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function StatusPill({ value }: { value: any }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(value)}`}>
      {value || "Not in artifact"}
    </span>
  );
}

function looksLikeForecastKey(key: string) {
  const k = key.toLowerCase();

  return (
    k.includes("forecast") ||
    k.includes("prediction") ||
    k.includes("p50") ||
    k.includes("q50") ||
    k.includes("yhat")
  );
}

function looksLikeNonForecastMetricKey(key: string) {
  const k = key.toLowerCase();

  return (
    k.includes("rmse") ||
    k.includes("mae") ||
    k.includes("mape") ||
    k.includes("error") ||
    k.includes("residual") ||
    k.includes("score") ||
    k.includes("weight") ||
    k.includes("rank") ||
    k.includes("loss")
  );
}

function horizonFromAny(value: any, fallback: number) {
  const text = String(value ?? "");
  const match = text.match(/\d+/);
  const parsed = match ? Number(match[0]) : NaN;

  if (Number.isFinite(parsed) && parsed > 0 && parsed < 400) return parsed;
  return fallback;
}

function collectForecastLikeRowsDeep(value: any, depth = 0): any[] {
  if (!value || depth > 8) return [];

  if (Array.isArray(value)) {
    const directRows = value.filter((item) => isRecord(item));
    const signalRows = directRows.filter((row) => {
      const keys = Object.keys(row || {});
      return (
        keys.some((key) => ["date", "forecast_date", "ds", "timestamp", "horizon"].includes(key.toLowerCase())) ||
        keys.some((key) => looksLikeForecastKey(key))
      );
    });

    if (signalRows.length) return signalRows;
    return value.flatMap((item) => collectForecastLikeRowsDeep(item, depth + 1));
  }

  if (!isRecord(value)) return [];

  const keys = Object.keys(value);
  const hasForecastSignal = keys.some((key) => looksLikeForecastKey(key) && !looksLikeNonForecastMetricKey(key));
  const hasDateSignal = keys.some((key) => ["date", "forecast_date", "ds", "timestamp", "horizon"].includes(key.toLowerCase()));

  if (hasForecastSignal || hasDateSignal) return [value];

  return Object.values(value).flatMap((child) => collectForecastLikeRowsDeep(child, depth + 1));
}

function scalarForecastRowsFromJson(value: any, source: string, forecastStart: string) {
  const rows: any[] = [];

  function walk(obj: any, depth = 0) {
    if (!obj || depth > 8) return;

    if (Array.isArray(obj)) {
      obj.forEach((item) => walk(item, depth + 1));
      return;
    }

    if (!isRecord(obj)) return;

    for (const [key, val] of Object.entries(obj)) {
      const numeric = toNumber(val);

      if (
        numeric !== null &&
        looksLikeForecastKey(key) &&
        !looksLikeNonForecastMetricKey(key) &&
        numeric > 100 &&
        numeric < 10000
      ) {
        const horizon = horizonFromAny(key, rows.length + 1);

        rows.push({
          date: addBusinessDays(forecastStart, Math.max(horizon - 1, 0)),
          forecast: numeric,
          horizon,
          source,
          split: "future_forecast_from_latest_artifact",
        });
      }
    }

    for (const val of Object.values(obj)) {
      if (isRecord(val) || Array.isArray(val)) walk(val, depth + 1);
    }
  }

  walk(value);
  return rows;
}

function getActual(row: any) {
  return firstNumber(row.actual_gold_price, row.actual_target, row.actual, row.gold_price, row.target_gold, row.observed, row.y, row.close, row.price);
}

function getForecast(row: any) {
  return firstNumber(
    row.omega_forecast,
    row.omega_prediction,
    row.omega_p50_weighted,
    row.deep_ml_forecast,
    row.model_forecast,
    row.prediction,
    row.forecast,
    row.forecast_mean,
    row.p50,
    row.q50,
    row.yhat,
    row.value
  );
}

function getLower(row: any) {
  return firstNumber(row.forecast_lower, row.lower_95, row.lower95, row.p025, row.q025, row.p05, row.q05, row.lower, row.lower_bound, row.yhat_lower);
}

function getUpper(row: any) {
  return firstNumber(row.forecast_upper, row.upper_95, row.upper95, row.p975, row.q975, row.p95, row.q95, row.upper, row.upper_bound, row.yhat_upper);
}

function explicitIntervalSource(row: any) {
  const keys = Object.keys(row || {}).map((key) => key.toLowerCase());

  if (keys.some((key) => key.includes("95") || key.includes("975") || key.includes("025"))) {
    return "95% interval from artifact";
  }

  if (keys.some((key) => key.includes("lower") || key.includes("upper"))) {
    return "Lower/upper interval from artifact";
  }

  return "";
}

function normalizeForecastRows(rows: any[], source: string, forecastStart = PROJECT_FORECAST_START): ForecastRow[] {
  return rows
    .map((row, index) => {
      const explicitDate = firstText(row.date, row.forecast_date, row.origin_date, row.ds, row.timestamp, "");
      const horizon = horizonFromAny(firstText(row.horizon, row.forecast_horizon, row.target_horizon, row.h, row.step, ""), index + 1);
      const date = explicitDate && explicitDate !== "Not in artifact" ? dateKey(explicitDate) : addBusinessDays(forecastStart, Math.max(horizon - 1, 0));

      const actual = getActual(row);
      const forecast = getForecast(row);
      const lower = getLower(row);
      const upper = getUpper(row);
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
  const residuals = rows.map((row) => row.residual).filter((value): value is number => Number.isFinite(Number(value)));

  if (residuals.length < 8) return null;

  const mean = residuals.reduce((sum, value) => sum + value, 0) / residuals.length;
  const variance = residuals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(residuals.length - 1, 1);
  return Math.sqrt(variance);
}

function shiftRollforwardToFuture(rows: ForecastRow[], forecastStart: string, source: string) {
  const usable = rows.filter((row) => row.forecast !== null).slice(-40);

  return usable.map((row, index) => ({
    ...row,
    date: addBusinessDays(forecastStart, index),
    actual: null,
    residual: null,
    absolute_error: null,
    absolute_percentage_error: null,
    split: "diagnostic_rollforward_shifted_preview",
    source: `${source} diagnostic fallback`,
  }));
}

function forceForecastStart(rows: ForecastRow[], forecastStart: string) {
  const sorted = [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const idx = sorted.findIndex((row) => row.forecast !== null);

  if (idx >= 0) {
    sorted[idx] = {
      ...sorted[idx],
      date: forecastStart,
      split: `${sorted[idx].split} + aligned_to_forecast_start`,
    };
  }

  return dedupeForecastRows(sorted);
}

function buildModelForecastRows(config: ModelConfig, data: (key: string) => any, startDate: string) {
  const forecastPointRows =
    config.forecastPointsKey && Array.isArray(data(config.forecastPointsKey))
      ? data(config.forecastPointsKey)
      : [];

  const forecastJson = data(config.forecastKey);
  const latestRows = [
    ...collectForecastLikeRowsDeep(forecastJson),
    ...rowsFromAny(forecastJson),
    ...scalarForecastRowsFromJson(forecastJson, `${config.label} latest forecast`, startDate),
  ];

  const rollRowsRaw = Array.isArray(data(config.rollKey)) ? data(config.rollKey) : [];
  const rollRows = normalizeForecastRows(rollRowsRaw, `${config.label} rollforward`, startDate);
  const futureRows = normalizeForecastRows([...forecastPointRows, ...latestRows], `${config.label} forecast`, startDate);

  const sigma = residualStd(rollRows);
  const startMs = dateTime(startDate) ?? dateTime(PROJECT_FORECAST_START) ?? 0;

  let candidates = futureRows.filter((row) => {
    const t = dateTime(row.date);
    return t !== null && t >= startMs && row.forecast !== null;
  });

  if (!candidates.length) {
    candidates = shiftRollforwardToFuture(rollRows, startDate, config.label);
  }

  const withBand = candidates.map((row) => {
    if (row.forecast === null) return row;

    if (row.lower !== null && row.upper !== null) return row;

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

  return forceForecastStart(withBand, startDate);
}

function matrixActualRowsFromFeatureStore(rows: any[], forecastStart: string): ForecastRow[] {
  const startMs = dateTime(forecastStart) ?? dateTime(PROJECT_FORECAST_START) ?? 0;

  return rows
    .map((row) => {
      const date = dateKey(firstText(row.date, row.ds, row.timestamp));
      const t = dateTime(date);
      const actual = firstNumber(row.gold_price, row.actual_gold_price, row.actual_target, row.target_gold, row.close, row.price);

      return {
        date,
        actual,
        forecast: null,
        lower: null,
        upper: null,
        residual: null,
        absolute_error: null,
        absolute_percentage_error: null,
        split: firstText(row.split, row.row_source_type, "matrix_actual"),
        source: "Deep ML refreshed matrix actual gold",
        interval_source: "actual from refreshed matrix",
        t,
      };
    })
    .filter((row) => row.t !== null && row.t >= startMs && row.actual !== null)
    .map(({ t, ...row }) => row);
}

function mergeForecastWithMatrixActuals(forecastRows: ForecastRow[], actualRows: ForecastRow[]) {
  const map = new Map<string, ForecastRow>();

  for (const row of forecastRows) {
    map.set(row.date, { ...row });
  }

  const forecastDates = Array.from(map.keys()).sort((a, b) => String(a).localeCompare(String(b)));

  for (const row of actualRows) {
    if (!forecastDates.length) continue;

    let targetDate = row.date;
    const rowMs = dateTime(row.date);

    if (!map.has(targetDate) && rowMs !== null) {
      let bestDate = "";
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const fDate of forecastDates) {
        const fMs = dateTime(fDate);
        if (fMs === null) continue;

        const distance = Math.abs(fMs - rowMs);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestDate = fDate;
        }
      }

      if (bestDate && bestDistance <= 4 * 24 * 60 * 60 * 1000) {
        targetDate = bestDate;
      }
    }

    const existing = map.get(targetDate);
    if (!existing) continue;

    const residual = row.actual !== null && existing.forecast !== null ? row.actual - existing.forecast : existing.residual;
    const absolute_error = residual !== null && residual !== undefined ? Math.abs(residual) : existing.absolute_error;
    const absolute_percentage_error =
      row.actual !== null && row.actual !== 0 && absolute_error !== null && absolute_error !== undefined
        ? (absolute_error / row.actual) * 100
        : existing.absolute_percentage_error;

    map.set(targetDate, {
      ...existing,
      actual: row.actual,
      residual,
      absolute_error,
      absolute_percentage_error,
      split: `${existing.split} + matrix actual`,
    });
  }

  return Array.from(map.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function normalizeDiagnosticRows(rows: any[], source: string): DiagnosticRow[] {
  return rows
    .map((row) => {
      const actual = getActual(row);
      const forecast = getForecast(row);
      const date = dateKey(firstText(row.date, row.forecast_date, row.origin_date, row.ds, row.timestamp));
      const residual = firstNumber(row.residual, row.error) ?? (actual !== null && forecast !== null ? actual - forecast : null);
      const absolute_error = firstNumber(row.absolute_error, row.abs_error, row.mae_row) ?? (residual !== null ? Math.abs(residual) : null);
      const absolute_percentage_error =
        firstNumber(row.absolute_percentage_error, row.ape, row.mape_row) ??
        (actual !== null && actual !== 0 && absolute_error !== null ? (absolute_error / actual) * 100 : null);

      return {
        date,
        actual,
        forecast,
        residual,
        absolute_error,
        absolute_percentage_error,
        horizon: String(horizonFromAny(firstText(row.horizon, row.forecast_horizon, row.target_horizon, row.h, row.step, "10"), 10)),
        split: firstText(row.split, row.period, row.dataset, row.segment, "rollforward"),
        source,
      };
    })
    .filter((row) => row.date !== "Not in artifact" && (row.actual !== null || row.forecast !== null));
}

function preferredDiagnosticRows(rows: DiagnosticRow[]) {
  const h10 = rows.filter((row) => row.horizon === "10");
  if (h10.length) return h10;

  const firstHorizon = rows.find((row) => row.horizon)?.horizon;
  if (firstHorizon) return rows.filter((row) => row.horizon === firstHorizon);

  return rows;
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

function downsampleRows<T>(rows: T[], max = 900) {
  if (rows.length <= max) return rows;
  const step = Math.ceil(rows.length / max);
  return rows.filter((_, index) => index % step === 0);
}

function shockOverlays() {
  return MARKET_SHOCKS.map((shock) => (
    <ReferenceArea
      key={shock.label}
      x1={shock.start}
      x2={shock.end}
      fill={shock.fill}
      fillOpacity={0.10}
      strokeOpacity={0}
      label={{
        value: shock.label,
        position: "top",
        fill: shock.text,
        fontSize: 11,
        fontWeight: 900,
      }}
    />
  ));
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


function cleanAiModeLabel(mode?: string) {
  if (!mode) return "Gold AI";
  if (mode === "rag_sql_orchestrator_ai") return "RAG + SQL Orchestrator";
  if (mode === "rag_sql_orchestrator_fallback") return "RAG + SQL Fallback";
  if (mode === "artifact_blob_ai") return "RAG + SQL AI";
  if (mode === "artifact_fallback") return "Artifact Fallback";
  if (mode === "general_ai") return "General AI";
  if (mode === "needs_openrouter_key") return "Needs API Key";
  if (mode === "openrouter_api_error") return "AI Provider Error";
  if (mode === "deep_ml_forecast_ai") return "Deep ML Forecast AI";
  if (mode === "error") return "AI Error";
  return String(mode)
    .replaceAll("_", " ")
    .replace(/\bRAG + SQL Orchestrator\b/i, "RAG + SQL Orchestrator")
    .replace(/\brag sql orchestrator fallback\b/i, "RAG + SQL Fallback")
    .replace(/\bartifact blob ai\b/i, "RAG + SQL AI")
    .replace(/\bai\b/i, "AI")
    .trim();
}


function modeLabel(mode?: string) {
  return cleanAiModeLabel(mode);
}


const FINAL_EVAL_SQL_EXAMPLES = [
  {
    label: "Omega artifacts",
    query: "SELECT label, path, group, kind FROM final_artifacts WHERE group = 'Omega' ORDER BY label ASC LIMIT 50",
  },
  {
    label: "Forecast files",
    query: "SELECT label, path, group, kind FROM final_artifacts WHERE tags LIKE '%forecast%' ORDER BY group ASC LIMIT 50",
  },
  {
    label: "CSV artifacts",
    query: "SELECT label, path, group, kind FROM final_artifacts WHERE kind = 'csv' ORDER BY group ASC LIMIT 100",
  },
  {
    label: "Files by group",
    query: "SELECT group, COUNT(*) AS files FROM final_artifacts GROUP BY group ORDER BY files DESC",
  },
];

function finalEvalArtifactSqlRows() {
  return ARTIFACTS.map((artifact) => {
    const lower = `${artifact.key} ${artifact.label} ${artifact.path} ${artifact.group} ${artifact.kind}`.toLowerCase();

    let modelKey = "";
    if (lower.includes("omega")) modelKey = "omega";
    else if (lower.includes("alpha")) modelKey = "alpha";
    else if (lower.includes("beta")) modelKey = "beta";
    else if (lower.includes("delta")) modelKey = "delta";
    else if (lower.includes("epsilon")) modelKey = "epsilon";
    else if (lower.includes("gamma")) modelKey = "gamma";

    const tags = [
      artifact.group,
      artifact.kind,
      artifact.required ? "required" : "optional",
      modelKey,
      lower.includes("forecast") ? "forecast" : "",
      lower.includes("evaluation") ? "evaluation" : "",
      lower.includes("ranking") ? "ranking" : "",
      lower.includes("weight") ? "weights" : "",
      lower.includes("quality") ? "quality" : "",
      lower.includes("governance") ? "governance" : "",
    ].filter(Boolean);

    return {
      key: artifact.key,
      label: artifact.label,
      path: artifact.path,
      kind: artifact.kind,
      group: artifact.group,
      required: Boolean(artifact.required),
      modelKey,
      domain: "deep_ml_final_evaluation",
      tags: tags.join(" "),
    };
  });
}

function finalEvalSqlColumns(rows: any[]) {
  const cols = new Set<string>();
  rows.slice(0, 80).forEach((row) => Object.keys(row || {}).forEach((key) => cols.add(key)));
  return Array.from(cols);
}

function finalEvalSqlCsv(rows: any[], columns: string[]) {
  const escapeCell = (value: any) => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  };

  return [
    columns.map(escapeCell).join(","),
    ...rows.map((row) => columns.map((column) => escapeCell(row?.[column])).join(",")),
  ].join("\n");
}

function finalEvalSqlCompare(rowValue: any, operator: string, expectedValue: string) {
  const leftText = String(rowValue ?? "");
  const rightText = String(expectedValue ?? "");

  if (operator === "LIKE") {
    const needle = rightText.replaceAll("%", "").toLowerCase();
    return leftText.toLowerCase().includes(needle);
  }

  const leftNumber = Number(leftText);
  const rightNumber = Number(rightText);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    if (operator === "=") return leftNumber === rightNumber;
    if (operator === "!=" || operator === "<>") return leftNumber !== rightNumber;
    if (operator === ">") return leftNumber > rightNumber;
    if (operator === ">=") return leftNumber >= rightNumber;
    if (operator === "<") return leftNumber < rightNumber;
    if (operator === "<=") return leftNumber <= rightNumber;
  }

  if (operator === "=") return leftText.toLowerCase() === rightText.toLowerCase();
  if (operator === "!=" || operator === "<>") return leftText.toLowerCase() !== rightText.toLowerCase();

  return false;
}

function runFinalEvalSqlLite(query: string, sourceRows: any[]) {
  const raw = String(query || "").trim();
  const normalized = raw.replace(/\s+/g, " ");
  const lower = normalized.toLowerCase();

  if (!lower.startsWith("select ")) {
    throw new Error("Only SELECT queries are allowed.");
  }

  const forbidden = [
    "insert ",
    "update ",
    "delete ",
    "drop ",
    "alter ",
    "create ",
    "truncate ",
    "replace ",
    "attach ",
    "detach ",
    " into ",
    "load ",
    "require",
    "import ",
    "export ",
    "fetch(",
    "window.",
    "document.",
  ];

  const blocked = forbidden.find((token) => lower.includes(token));
  if (blocked) {
    throw new Error(`Blocked SQL token: ${blocked.trim()}. This explorer is read-only.`);
  }

  const fromMatch = normalized.match(/^select\s+(.+?)\s+from\s+final_artifacts(?:\s+|$)(.*)$/i);
  if (!fromMatch) {
    throw new Error("Use FROM final_artifacts. This explorer exposes the Final Deep ML artifact registry only.");
  }

  const selectText = fromMatch[1].trim();
  let tail = (fromMatch[2] || "").trim();

  let limit = 100;
  const limitMatch = tail.match(/\s+limit\s+(\d+)\s*$/i);
  if (limitMatch) {
    limit = Math.max(1, Math.min(Number(limitMatch[1]) || 100, 500));
    tail = tail.slice(0, limitMatch.index).trim();
  }

  let orderKey = "";
  let orderDirection: "asc" | "desc" = "asc";
  const orderMatch = tail.match(/\s+order\s+by\s+([a-zA-Z0-9_]+)(?:\s+(asc|desc))?\s*$/i);
  if (orderMatch) {
    orderKey = orderMatch[1];
    orderDirection = String(orderMatch[2] || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    tail = tail.slice(0, orderMatch.index).trim();
  }

  let groupKey = "";
  const groupMatch = tail.match(/^group\s+by\s+([a-zA-Z0-9_]+)\s*$/i);
  if (groupMatch) {
    groupKey = groupMatch[1];
    tail = tail.slice(0, groupMatch.index).trim();
  }

  let whereText = "";
  const whereMatch = tail.match(/^where\s+(.+)$/i);
  if (whereMatch) {
    whereText = whereMatch[1].trim();
  } else if (tail.trim()) {
    throw new Error(`Unsupported SQL clause: ${tail}`);
  }

  let rows = [...sourceRows];

  if (whereText) {
    const conditions = whereText.split(/\s+and\s+/i).map((item) => item.trim()).filter(Boolean);

    rows = rows.filter((row) =>
      conditions.every((condition) => {
        const match = condition.match(/^([a-zA-Z0-9_]+)\s*(=|!=|<>|>=|<=|>|<|LIKE)\s*'([^']*)'$/i);
        if (!match) {
          throw new Error(`Unsupported WHERE condition: ${condition}. Use examples like group = 'Omega' or tags LIKE '%forecast%'.`);
        }

        const [, key, operator, expected] = match;
        return finalEvalSqlCompare(row?.[key], operator.toUpperCase(), expected);
      })
    );
  }

  const selectParts = selectText.split(",").map((item) => item.trim()).filter(Boolean);
  const wantsCount = selectParts.some((part) => /^count\(\*\)(?:\s+as\s+[a-zA-Z0-9_]+)?$/i.test(part));

  if (groupKey) {
    const groups = new Map<string, any[]>();

    rows.forEach((row) => {
      const key = String(row?.[groupKey] ?? "");
      groups.set(key, [...(groups.get(key) || []), row]);
    });

    rows = Array.from(groups.entries()).map(([groupValue, groupRows]) => {
      const out: Record<string, any> = { [groupKey]: groupValue };

      selectParts.forEach((part) => {
        const countMatch = part.match(/^count\(\*\)(?:\s+as\s+([a-zA-Z0-9_]+))?$/i);
        if (countMatch) {
          out[countMatch[1] || "count"] = groupRows.length;
          return;
        }

        if (part !== groupKey && part !== "*") {
          out[part] = groupRows[0]?.[part];
        }
      });

      return out;
    });
  } else if (wantsCount) {
    const alias = selectParts
      .map((part) => part.match(/^count\(\*\)(?:\s+as\s+([a-zA-Z0-9_]+))?$/i))
      .find(Boolean)?.[1] || "count";
    rows = [{ [alias]: rows.length }];
  } else if (!(selectParts.length === 1 && selectParts[0] === "*")) {
    rows = rows.map((row) => {
      const out: Record<string, any> = {};
      selectParts.forEach((part) => {
        out[part] = row?.[part];
      });
      return out;
    });
  }

  if (orderKey) {
    rows = [...rows].sort((a, b) => {
      const av = a?.[orderKey];
      const bv = b?.[orderKey];
      const an = Number(av);
      const bn = Number(bv);

      let cmp = 0;
      if (Number.isFinite(an) && Number.isFinite(bn)) {
        cmp = an - bn;
      } else {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      }

      return orderDirection === "desc" ? -cmp : cmp;
    });
  }

  return rows.slice(0, limit);
}

function FinalEvalSqlExplorer({
  query,
  setQuery,
  rows,
  error,
  busy,
  onRun,
  onDownload,
  onAskAi,
}: {
  query: string;
  setQuery: (value: string) => void;
  rows: any[];
  error: string;
  busy: boolean;
  onRun: () => void;
  onDownload: () => void;
  onAskAi: () => void;
}) {
  const columns = finalEvalSqlColumns(rows);

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.32em] text-blue-600">
            SQL-4A Final Eval SQL
          </div>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
            Query final evaluation artifacts
          </h2>
          <p className="mt-3 max-w-5xl text-sm font-semibold leading-7 text-slate-600">
            Read-only SQL explorer for the Final Deep ML Evaluation artifact registry.
            Table name: <span className="font-black text-slate-950">final_artifacts</span>.
            It inspects artifact metadata only and does not alter forecasts, models, or files.
          </p>
        </div>

        <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
          {rows.length ? `${rows.length} rows` : "read-only"}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            rows={7}
            className="min-h-[180px] w-full resize-y rounded-2xl border border-slate-200 bg-white p-4 font-mono text-sm leading-7 text-slate-950 outline-none focus:border-blue-300"
          />

          {error ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onRun}
              disabled={busy}
              className="rounded-full bg-blue-600 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-blue-600/20 disabled:bg-slate-300"
            >
              {busy ? "Running..." : "Run SQL"}
            </button>

            <button
              type="button"
              onClick={onDownload}
              disabled={!rows.length}
              className="rounded-full border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-800 disabled:opacity-40"
            >
              Download Result
            </button>

            <button
              type="button"
              onClick={onAskAi}
              disabled={!rows.length}
              className="rounded-full border border-amber-200 bg-amber-50 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-amber-800 disabled:opacity-40"
            >
              Ask AI About SQL
            </button>
          </div>
        </div>

        <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4">
          <div className="mb-3 text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
            Examples
          </div>

          <div className="grid gap-2">
            {FINAL_EVAL_SQL_EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                onClick={() => setQuery(example.query)}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left text-xs font-bold leading-5 text-slate-700 hover:border-blue-200 hover:bg-blue-50"
              >
                <div className="font-black uppercase tracking-[0.14em] text-blue-700">
                  {example.label}
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-500">
                  {example.query}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
            Professor-safe note: this SQL explorer inspects artifact metadata. It does not prove
            model accuracy, approval, causality, or forecast guarantees.
          </div>
        </div>
      </div>

      {rows.length ? (
        <div className="mt-6 overflow-hidden rounded-[1.4rem] border border-slate-200">
          <div className="max-h-[360px] overflow-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-100 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="whitespace-nowrap px-4 py-3">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.slice(0, 100).map((row, index) => (
                  <tr key={index}>
                    {columns.map((column) => (
                      <td key={column} className="max-w-[360px] truncate px-4 py-3 font-semibold text-slate-700">
                        {String(row?.[column] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}



export default function FinalDeepMLEvaluationPage() {

  const finalArtifactSqlTable = useMemo(() => finalEvalArtifactSqlRows(), []);
  const [finalSqlQuery, setFinalSqlQuery] = useState(FINAL_EVAL_SQL_EXAMPLES[0].query);
  const [finalSqlRows, setFinalSqlRows] = useState<any[]>([]);
  const [finalSqlError, setFinalSqlError] = useState("");
  const [finalSqlBusy, setFinalSqlBusy] = useState(false);

  function runFinalEvalSql() {
    setFinalSqlBusy(true);
    setFinalSqlError("");

    try {
      const result = runFinalEvalSqlLite(finalSqlQuery, finalArtifactSqlTable);
      setFinalSqlRows(result);
    } catch (error) {
      setFinalSqlRows([]);
      setFinalSqlError(error instanceof Error ? error.message : "Final evaluation SQL failed.");
    } finally {
      setFinalSqlBusy(false);
    }
  }

  function downloadFinalEvalSqlResult() {
    if (!finalSqlRows.length) return;

    const columns = finalEvalSqlColumns(finalSqlRows);
    const csv = finalEvalSqlCsv(finalSqlRows, columns);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "final_deep_ml_sql_result.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function buildFinalDeepMlSqlContextForAi() {
    if (!finalSqlRows.length) return buildFinalDeepMlContextForAi();

    return {
      source: "final_deep_ml_sql_explorer",
      title: "Final Deep ML Evaluation SQL result",
      tableName: "final_artifacts",
      query: finalSqlQuery,
      rowCount: finalSqlRows.length,
      columns: finalEvalSqlColumns(finalSqlRows),
      rows: finalSqlRows.slice(0, 50),
      notes: [
        "This is a read-only SQL result from the Final Deep ML Evaluation artifact registry.",
        "Rows are artifact metadata unless a CSV/JSON artifact is opened separately.",
        "Do not infer model quality, approval, causality, validation status, or forecast guarantees from metadata alone.",
      ],
    };
  }

  function askAiAboutFinalEvalSql() {
    if (!finalSqlRows.length) {
      setFinalSqlError("Run a Final Eval SQL query first.");
      return;
    }

    askAI("Explain this Final Deep ML SQL result in professor-safe business language.");
  }


  const [loaded, setLoaded] = useState<Record<string, LoadedArtifact>>({});
  const [loading, setLoading] = useState(true);
  const [selectedModelKey, setSelectedModelKey] = useState<ModelKey>("omega");

  const [aiQuestion, setAiQuestion] = useState("Explain the selected Deep ML forecast in business language.");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      mode: "RAG + SQL Orchestrator",
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

  const forecastStart = PROJECT_FORECAST_START;

  const matrixRows = Array.isArray(data("matrix")) ? data("matrix") : [];
  const latestMatrixRow = matrixRows.length ? matrixRows[matrixRows.length - 1] : {};
  const latestGold = firstNumber(latestMatrixRow.gold_price, latestMatrixRow.actual_gold_price, latestMatrixRow.actual_target);

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
  }, [loaded]);

  const rawSelectedForecastRows = forecastRowsByModel[selectedModelKey] || [];

  const matrixActualRowsForForecast = useMemo(
    () => matrixActualRowsFromFeatureStore(matrixRows, forecastStart),
    [matrixRows, forecastStart]
  );

  const selectedForecastRows = useMemo(
    () => mergeForecastWithMatrixActuals(rawSelectedForecastRows, matrixActualRowsForForecast),
    [rawSelectedForecastRows, matrixActualRowsForForecast]
  );

  const chartRows = useMemo(() => downsampleRows(selectedForecastRows, 900), [selectedForecastRows]);
  const metrics = useMemo(() => computeMetrics(selectedForecastRows), [selectedForecastRows]);

  const loadedCount = useMemo(() => Object.values(loaded).filter((item) => item.ok).length, [loaded]);
  const requiredMissing = useMemo(() => ARTIFACTS.filter((item) => item.required && !loaded[item.key]?.ok), [loaded]);

  const selectedReportStatus = firstText(
    findValueDeep(data(selectedModel.reportKey), ["status", "run_status", "phase_status", "result"]),
    loaded[selectedModel.forecastKey]?.ok ? "Forecast loaded" : "Artifact check"
  );

  const intervalRows = selectedForecastRows.filter((row) => row.lower !== null && row.upper !== null);
  const intervalLabel = intervalRows.some((row) => row.interval_source.toLowerCase().includes("95"))
    ? "95% band"
    : intervalRows.length
      ? "Empirical/available band"
      : "No interval band";

  const firstForecastDate = selectedForecastRows[0]?.date || forecastStart;
  const lastForecastDate = selectedForecastRows[selectedForecastRows.length - 1]?.date || "Not in artifact";

  const omegaWeightRows = rowsFromAny(data("omegaWeights"));
  const gammaRows = rowsFromAny(data("gammaSensitivity"));
  const selectedEvalRows = rowsFromAny(data(selectedModel.evalKey));

  const diagnosticRaw = Array.isArray(data(selectedModel.rollKey)) ? data(selectedModel.rollKey) : [];
  const diagnosticRowsAll = useMemo(
    () => normalizeDiagnosticRows(diagnosticRaw, `${selectedModel.label} rollforward`),
    [loaded, selectedModelKey]
  );
  const diagnosticRows = useMemo(() => preferredDiagnosticRows(diagnosticRowsAll), [diagnosticRowsAll]);
  const diagnosticChartRows = useMemo(() => downsampleRows(diagnosticRows, 900), [diagnosticRows]);
  const diagnosticHorizon = diagnosticRows[0]?.horizon || "10";
  const diagnosticMetrics = computeMetrics(
    diagnosticRows.map((row) => ({
      date: row.date,
      actual: row.actual,
      forecast: row.forecast,
      lower: null,
      upper: null,
      residual: row.residual,
      absolute_error: row.absolute_error,
      absolute_percentage_error: row.absolute_percentage_error,
      split: row.split,
      source: row.source,
      interval_source: "diagnostic",
    }))
  );

  const modelSummaryRows = MODELS.map((model) => {
    const rows = forecastRowsByModel[model.key] || [];
    const m = computeMetrics(mergeForecastWithMatrixActuals(rows, matrixActualRowsForForecast));

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


  function buildFinalDeepMlContextForAi() {
    return {
      source: "final_deep_ml_evaluation_page",
      title: "Final Deep ML Evaluation page artifact context",
      tableName: "final_deep_ml_evaluation_artifacts",
      query: "page_context_artifact_list",
      rowCount: ARTIFACTS.length,
      columns: ["label", "path", "group", "kind", "required"],
      rows: ARTIFACTS.map((artifact) => ({
        label: artifact.label,
        path: artifact.path,
        group: artifact.group,
        kind: artifact.kind,
        required: Boolean(artifact.required),
      })).slice(0, 80),
      notes: [
        "This is page context from the Final Deep ML Evaluation page.",
        "Rows identify approved page artifacts and should not be treated as forecast evidence by themselves.",
        "Claims about selected model, forecast values, intervals, ranking, or quality must come from loaded artifacts.",
        "Do not describe forecasts as guarantees.",
        "Do not claim causality from Gamma, news context, weights, or model outputs.",
        "Omega can be described as the selected final Deep ML forecast layer only when supported by final evaluation artifacts.",
      ],
    };
  }

  async function askAI(promptOverride?: string) {
    const prompt = (promptOverride || aiQuestion).trim();
    if (!prompt || aiBusy) return;

    const pagePrompt =
      `Selected Deep ML model: ${selectedModel.label}. ` +
      `Forecast window shown: ${firstForecastDate} to ${lastForecastDate}. ` +
      prompt;

    const nextMessages: ChatMessage[] = [...aiMessages, { role: "user", content: prompt }];
    setAiMessages(nextMessages);
    setAiQuestion("");
    setAiBusy(true);

    try {
      const response = await fetch("/api/rag-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: pagePrompt,
          pagePath: "/deep-ml/models/final-deep-ml-evaluation",
          history: nextMessages.slice(-8),
          sqlContext: buildFinalDeepMlSqlContextForAi(),
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

          <div className="relative z-10 max-w-5xl">
            <div className="inline-flex rounded-full border border-yellow-300/30 bg-yellow-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-yellow-200">
              Deep ML Final Forecast · Selected Model View
            </div>

            <h1 className="mt-7 text-5xl font-black tracking-tight text-white md:text-7xl">
              Final Deep ML Forecast
            </h1>

            <p className="mt-5 max-w-4xl text-sm font-semibold leading-7 text-blue-50/80">
              This page is only for the Deep ML system. Omega Fusion is the selected final Deep ML forecast layer by default.
              Alpha, Beta, Delta, and Epsilon remain available for inspection as alternative expert views.
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
        </section>

        <section className="mt-8 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            eyebrow="Forecast Control Panel"
            title="Switch the Deep ML forecast view"
            description="Omega Fusion remains the selected final Deep ML layer by default. Alpha, Beta, Delta, and Epsilon are available as alternative expert forecast views."
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {MODELS.map((model) => {
              const active = model.key === selectedModelKey;
              const row = modelSummaryRows.find((item) => item.key === model.key);

              return (
                <button
                  key={model.key}
                  type="button"
                  onClick={() => setSelectedModelKey(model.key)}
                  className={`rounded-[1.6rem] border p-5 text-left transition ${
                    active
                      ? "border-blue-300 bg-blue-50 shadow-lg shadow-blue-100"
                      : "border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-blue-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className={active ? "text-lg font-black text-blue-700" : "text-lg font-black text-slate-950"}>
                        {model.label}
                      </div>
                      <div className="mt-1 text-xs font-bold leading-5 text-slate-500">
                        {model.role}
                      </div>
                    </div>

                    <StatusPill value={model.key === "omega" ? "Selected final" : "Alternative"} />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Rows</div>
                      <div className="mt-1 text-sm font-black text-slate-800">{row?.rows?.toLocaleString?.() || 0}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Actual</div>
                      <div className="mt-1 text-sm font-black text-slate-800">{row?.actualRows?.toLocaleString?.() || 0}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">MAE</div>
                      <div className="mt-1 text-sm font-black text-slate-800">{formatMoney(row?.mae)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">APE</div>
                      <div className="mt-1 text-sm font-black text-slate-800">{formatPct(row?.mape)}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <FinalEvalSqlExplorer
          query={finalSqlQuery}
          setQuery={setFinalSqlQuery}
          rows={finalSqlRows}
          error={finalSqlError}
          busy={finalSqlBusy}
          onRun={runFinalEvalSql}
          onDownload={downloadFinalEvalSqlResult}
          onAskAi={askAiAboutFinalEvalSql}
        />

        {requiredMissing.length ? (
          <section className="mt-6 rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-900">
            Required Deep ML artifact warning: {requiredMissing.map((item) => item.label).join(", ")} did not load.
          </section>
        ) : null}

        <section className="mt-8 grid gap-5 md:grid-cols-4">
          <StatCard label="Selected Model" value={selectedModel.label} note={selectedModel.family} />
          <StatCard label="Forecast Window" value={`${formatDate(firstForecastDate)} → ${formatDate(lastForecastDate)}`} note="Future forecast starts from May 05, 2026." />
          <StatCard label="Forecast Rows" value={metrics.forecastRows.toLocaleString()} note="Future forecast rows loaded for the selected Deep ML model." />
          <StatCard label="Matrix Actual Overlay" value={matrixActualRowsForForecast.length.toLocaleString()} note="Actual gold values from refreshed matrix are merged into matching forecast dates." />
        </section>

        <section className="mt-8 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            eyebrow="Final model selection"
            title="Why Omega is selected as the final Deep ML layer"
            description="Omega is selected because it is the fusion layer created to combine the accepted Deep ML experts rather than relying on one standalone expert."
          />

          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[2rem] border border-yellow-200 bg-yellow-50 p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-yellow-700">
                Selected final Deep ML model
              </div>
              <div className="mt-4 text-4xl font-black tracking-tight text-slate-950">
                Omega Fusion
              </div>
              <p className="mt-4 text-sm font-bold leading-7 text-slate-700">
                Omega is the final Deep ML candidate because it reads the accepted expert outputs,
                ranks them using validation evidence, assigns horizon-specific weights, and fuses the forecast paths.
                This is stronger for the final page than choosing only one expert blindly.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {[
                ["Fusion logic", "Combines Alpha, Beta, Delta, and Epsilon instead of using only one model."],
                ["Validation weighting", "Uses model ranking and validation evidence from Omega artifacts."],
                ["Horizon-specific behavior", "Weights can change by forecast horizon instead of staying fixed."],
                ["Gamma kept separate", "News context explains background but does not override the forecast."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-sm font-black text-slate-950">{title}</div>
                  <div className="mt-2 text-xs font-semibold leading-6 text-slate-500">{body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.42fr)_minmax(380px,0.58fr)]">
            <div className="min-w-0">
              <SectionTitle
                eyebrow="Future forecast chart"
                title={`Future ${selectedModel.label} Forecast with 95% Confidence Band`}
                description="This is the Deep ML final forecast chart. It starts exactly from May 05, 2026. Actual gold values from the refreshed matrix are added automatically as they become available, so the green actual line extends over time."
              />

              <div className="mb-5 flex flex-wrap gap-3">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                  actual rows: {metrics.actualRows}
                </span>
                <span className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                  matrix actual overlay: {matrixActualRowsForForecast.length}
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

              <div className="h-[650px] rounded-[2rem] border border-slate-100 bg-slate-50 p-4">
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
                    <Line type="monotone" dataKey="actual" name="Actual Gold Price" stroke="#16a34a" strokeWidth={2.6} dot={false} connectNulls />
                    <Line type="monotone" dataKey="forecast" name={`${selectedModel.label} Forecast`} stroke="#2563eb" strokeWidth={2.6} dot={false} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <aside className="min-w-0 rounded-[2.2rem] border border-slate-200 bg-slate-50 p-5 shadow-inner xl:sticky xl:top-24 xl:self-start">
              <div className="text-[11px] font-black uppercase tracking-[0.34em] text-blue-600">
                Forecast AI
              </div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                Ask about this forecast
              </h2>
              <p className="mt-3 text-sm font-medium leading-7 text-slate-500">
                Focused on the selected Deep ML model, forecast band, Omega/Gamma logic, and supporting artifacts.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
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
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <div className="mt-5 h-[390px] overflow-y-auto rounded-[1.7rem] border border-slate-200 bg-white p-4">
                <div className="space-y-4">
                  {aiMessages.map((message, index) => (
                    <div
                      key={index}
                      className={
                        message.role === "user"
                          ? "ml-auto max-w-[92%] rounded-[1.3rem] bg-blue-600 p-4 text-white"
                          : "mr-auto max-w-[96%] rounded-[1.3rem] border border-slate-200 bg-white p-4 text-slate-900 shadow-sm"
                      }
                    >
                      {message.mode ? (
                        <div className="mb-2 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
                          {modeLabel(message.mode)}
                        </div>
                      ) : null}
                      <div className="whitespace-pre-wrap text-sm leading-7">{message.content}</div>
                      {message.sources?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {Array.from(new Set(message.sources)).slice(0, 5).map((source) => (
                            <span key={source} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-600">
                              {source}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}

                  {aiBusy ? (
                    <div className="mr-auto rounded-[1.3rem] border border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">
                      Searching selected Deep ML forecast artifacts...
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex gap-2 rounded-3xl border border-slate-200 bg-white p-2">
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
            </aside>
          </div>
        </section>

        <section className="mt-8 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            eyebrow="Actual vs Forecast diagnostic"
            title={`${selectedModel.label} Actual vs Forecast · Horizon ${diagnosticHorizon}`}
            description="This diagnostic chart uses the selected model’s rollforward artifact. It shows historical actual-vs-forecast behavior with major market shock periods and a zoom brush."
          />

          <div className="mb-5 flex flex-wrap gap-3">
            <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-700">
              source: {selectedModel.label} rollforward
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
              actual rows: {diagnosticMetrics.actualRows}
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-amber-700">
              horizon: {diagnosticHorizon}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
              MAE: {formatMoney(diagnosticMetrics.mae)}
            </span>
          </div>

          <div className="h-[610px] rounded-[2rem] border border-slate-100 bg-slate-50 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={diagnosticChartRows} margin={{ top: 30, right: 35, left: 25, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={38} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => formatNumber(value, 0)}
                  width={90}
                  label={{
                    value: "Gold Price (USD/oz)",
                    angle: -90,
                    position: "insideLeft",
                    style: { textAnchor: "middle", fontSize: 12, fontWeight: 700, fill: "#334155" },
                  }}
                />
                <Tooltip content={<ForecastTooltip />} />
                <Legend />
                {shockOverlays()}
                <ReferenceLine
                  x={forecastStart}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{
                    value: "Forecast Start",
                    position: "top",
                    fill: "#92400e",
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                />
                <Line type="monotone" dataKey="actual" name="Actual Target" stroke="#2563eb" strokeWidth={2.2} dot={false} connectNulls />
                <Line type="monotone" dataKey="forecast" name={`${selectedModel.label} Forecast`} stroke="#d97706" strokeWidth={2.2} dot={false} connectNulls />
                <Brush dataKey="date" height={36} stroke="#2563eb" travellerWidth={10} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Forecast error diagnostic"
              title={`${selectedModel.label} residual and percentage error`}
              description="This chart helps explain where the selected Deep ML model was above or below actual gold prices during rollforward evaluation."
            />

            <div className="h-[430px] rounded-[2rem] border border-slate-100 bg-slate-50 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={diagnosticChartRows} margin={{ top: 20, right: 35, left: 25, bottom: 55 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={40} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatNumber(value, 0)} width={85} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                  {shockOverlays()}
                  <Line type="monotone" dataKey="residual" name="Residual Actual - Forecast" stroke="#7c3aed" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="absolute_percentage_error" name="Absolute Percentage Error" stroke="#dc2626" strokeWidth={2} dot={false} connectNulls />
                  <Brush dataKey="date" height={30} stroke="#7c3aed" travellerWidth={10} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Omega fusion evidence"
              title="Weights used by the selected final layer"
              description="Omega remains the default final Deep ML layer because it fuses accepted expert forecasts using horizon-level weights."
            />

            <div className="max-h-[430px] overflow-auto rounded-[2rem] border border-slate-200 bg-white">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <tr>
                    {columnsFromRows(omegaWeightRows).slice(0, 8).map((column) => (
                      <th key={column} className="border-b border-slate-200 px-3 py-3">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {omegaWeightRows.slice(0, 80).map((row, index) => (
                    <tr key={index} className="border-b border-slate-100">
                      {columnsFromRows(omegaWeightRows).slice(0, 8).map((column) => (
                        <td key={column} className="max-w-[240px] truncate px-3 py-2 font-semibold text-slate-700">
                          {isRecord(row?.[column]) ? JSON.stringify(row?.[column]) : String(row?.[column] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {omegaWeightRows.length === 0 ? (
                <div className="p-5 text-sm font-semibold text-slate-500">Omega weights were not found in the artifact.</div>
              ) : null}
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
                          {isRecord(row?.[column]) ? JSON.stringify(row?.[column]) : String(row?.[column] ?? "")}
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
              eyebrow="Gamma context"
              title="News sensitivity note"
              description="Gamma is shown as context only. It does not override Omega or any selected model forecast."
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
                  className="relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 pr-24 transition hover:border-blue-200 hover:bg-blue-50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-950" title={artifact.label}>
                      {artifact.label}
                    </div>
                    <div className="mt-1 max-h-10 overflow-hidden break-all text-[11px] font-semibold leading-5 text-slate-500" title={artifact.path}>
                      {artifact.path}
                    </div>
                    <div className="absolute right-3 top-3 origin-top-right scale-[0.82]">
                      <StatusPill value={result?.ok ? "Loaded" : artifact.required ? "Missing required" : "Optional"} />
                    </div>
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
