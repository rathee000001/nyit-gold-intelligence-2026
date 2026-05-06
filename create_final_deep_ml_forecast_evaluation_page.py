from pathlib import Path

PAGE = Path("src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx")
PAGE.parent.mkdir(parents=True, exist_ok=True)

PAGE.write_text(r'''
"use client";

import Link from "next/link";
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

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  mode?: string;
  sources?: string[];
};

type DeepForecastRow = {
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

const ARTIFACTS: ArtifactSpec[] = [
  {
    key: "omegaReport",
    label: "Omega Fusion Report",
    path: "artifacts/deep_ml/models/omega_fusion/phase14_omega_fusion_report.json",
    kind: "json",
    group: "Omega Fusion",
    required: true,
  },
  {
    key: "omegaForecastLatest",
    label: "Omega Forecast Latest",
    path: "artifacts/deep_ml/models/omega_fusion/omega_forecast_latest.json",
    kind: "json",
    group: "Omega Forecast",
    required: true,
  },
  {
    key: "omegaForecastPoints",
    label: "Omega Forecast Points",
    path: "artifacts/deep_ml/models/omega_fusion/omega_forecast_points.csv",
    kind: "csv",
    group: "Omega Forecast",
    required: true,
  },
  {
    key: "omegaRollforward",
    label: "Omega Rollforward",
    path: "artifacts/deep_ml/models/omega_fusion/omega_rollforward.csv",
    kind: "csv",
    group: "Omega Evaluation",
    required: true,
  },
  {
    key: "omegaEvaluation",
    label: "Omega Evaluation by Horizon",
    path: "artifacts/deep_ml/models/omega_fusion/omega_evaluation_by_horizon.json",
    kind: "json",
    group: "Omega Evaluation",
    required: true,
  },
  {
    key: "omegaRanking",
    label: "Omega Model Ranking",
    path: "artifacts/deep_ml/models/omega_fusion/omega_model_ranking.json",
    kind: "json",
    group: "Omega Evaluation",
  },
  {
    key: "omegaWeights",
    label: "Omega Weights by Horizon",
    path: "artifacts/deep_ml/models/omega_fusion/omega_weights_by_horizon.json",
    kind: "json",
    group: "Omega Evaluation",
  },
  {
    key: "omegaQuality",
    label: "Omega Quality Review",
    path: "artifacts/deep_ml/models/omega_fusion/quality_review.json",
    kind: "json",
    group: "Omega Governance",
  },
  {
    key: "gammaReport",
    label: "Gamma News Sensitivity Report",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/phase13_gamma_news_sensitivity_report.json",
    kind: "json",
    group: "Gamma Context",
  },
  {
    key: "gammaLatest",
    label: "Gamma Latest Context",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_latest_context.json",
    kind: "json",
    group: "Gamma Context",
  },
  {
    key: "gammaSensitivity",
    label: "Gamma Sensitivity by Horizon",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_sensitivity_by_horizon.json",
    kind: "json",
    group: "Gamma Context",
  },
  {
    key: "gammaDateContext",
    label: "Gamma Date Context",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_date_context.csv",
    kind: "csv",
    group: "Gamma Context",
  },
  {
    key: "modeStatus",
    label: "Deep ML Mode Status",
    path: "artifacts/deep_ml/governance/deep_ml_mode_status.json",
    kind: "json",
    group: "Deep ML Governance",
  },
  {
    key: "studyContext",
    label: "Study Context",
    path: "artifacts/deep_ml/governance/study_context.json",
    kind: "json",
    group: "Deep ML Governance",
  },
  {
    key: "effectiveWindow",
    label: "Effective Data Window",
    path: "artifacts/deep_ml/governance/effective_data_window.json",
    kind: "json",
    group: "Deep ML Governance",
  },
  {
    key: "forecastStart",
    label: "Forecast Start Decision",
    path: "artifacts/deep_ml/governance/forecast_start_decision.json",
    kind: "json",
    group: "Deep ML Governance",
  },
  {
    key: "phase10",
    label: "Step 10 Source Update",
    path: "artifacts/deep_ml/source_update/phase10_source_update_refresh_report.json",
    kind: "json",
    group: "Source Refresh",
  },
  {
    key: "goldLiveSummary",
    label: "Step 10A Gold Live Update",
    path: "artifacts/deep_ml/source_update/gold_live_update_summary.json",
    kind: "json",
    group: "Source Refresh",
  },
  {
    key: "phase11",
    label: "Step 11 Feature Refresh",
    path: "artifacts/deep_ml/feature_refresh/phase11_governed_feature_store_refresh_report.json",
    kind: "json",
    group: "Feature Refresh",
  },
  {
    key: "matrix",
    label: "Deep ML Refreshed Matrix",
    path: "artifacts/deep_ml/features/deep_ml_refreshed_matrix.csv",
    kind: "csv",
    group: "Feature Refresh",
  },
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

function parseCsv(text: string, maxRows = 50000) {
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
      return {
        ...spec,
        ok: false,
        data: spec.kind === "csv" ? [] : null,
        error: `HTTP ${response.status}`,
      };
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

function rowsFromJson(value: any): any[] {
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
  ];

  for (const key of keys) {
    const child = value[key];

    if (Array.isArray(child)) {
      return child.filter((item) => isRecord(item));
    }

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
      const nested = rowsFromJson(child);
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
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }

  return "Not in artifact";
}

function formatNumber(value: any, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";

  return numeric.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatMoney(value: any) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";

  return `$${numeric.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function formatPct(value: any) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";

  return `${numeric.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}%`;
}

function formatDate(value: any) {
  if (!value) return "Not in artifact";

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
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
  return firstNumber(
    row.actual_gold_price,
    row.actual_target,
    row.actual,
    row.gold_price,
    row.observed,
    row.y
  );
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
    row.yhat
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

function getIntervalSource(row: any) {
  const keys = Object.keys(row || {}).map((key) => key.toLowerCase());

  if (keys.some((key) => key.includes("95") || key.includes("975") || key.includes("025"))) {
    return "95% interval artifact";
  }

  if (keys.some((key) => key.includes("p05") || key.includes("q05") || key.includes("p95") || key.includes("q95"))) {
    return "90%/available quantile artifact";
  }

  if (keys.some((key) => key.includes("lower") || key.includes("upper"))) {
    return "available lower/upper artifact";
  }

  return "interval not in artifact";
}

function normalizeDeepForecastRows(rows: any[], source: string): DeepForecastRow[] {
  return rows
    .map((row) => {
      const actual = getActual(row);
      const forecast = getForecast(row);
      const lower = getLower(row);
      const upper = getUpper(row);
      const date = firstText(row.date, row.forecast_date, row.origin_date, row.ds, row.timestamp);
      const residual =
        firstNumber(row.residual, row.error) ??
        (actual !== null && forecast !== null ? actual - forecast : null);
      const absolute_error =
        firstNumber(row.absolute_error, row.abs_error, row.mae_row) ??
        (residual !== null ? Math.abs(residual) : null);
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
        interval_source: getIntervalSource(row),
      };
    })
    .filter((row) => row.date !== "Not in artifact" && (row.forecast !== null || row.actual !== null));
}

function dedupeForecastRows(rows: DeepForecastRow[]) {
  const map = new Map<string, DeepForecastRow>();

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
      interval_source: row.interval_source !== "interval not in artifact" ? row.interval_source : existing.interval_source,
    });
  }

  return Array.from(map.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function downsampleRows<T>(rows: T[], max = 900) {
  if (rows.length <= max) return rows;
  const step = Math.ceil(rows.length / max);
  return rows.filter((_, index) => index % step === 0);
}

function getRowsWithActual(rows: DeepForecastRow[]) {
  return rows.filter((row) => row.actual !== null && row.forecast !== null);
}

function getFutureRows(rows: DeepForecastRow[]) {
  return rows.filter((row) => row.forecast !== null);
}

function average(values: any[]) {
  const nums = values.map(Number).filter((value) => Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function computeMetrics(rows: DeepForecastRow[]) {
  const withActual = getRowsWithActual(rows);

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
      <div className="text-[11px] font-black uppercase tracking-[0.34em] text-blue-600">
        {eyebrow}
      </div>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 max-w-5xl text-sm font-medium leading-7 text-slate-500">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
        {label}
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">
        {value}
      </div>
      {note ? <div className="mt-2 text-xs font-semibold leading-5 text-slate-500">{note}</div> : null}
    </div>
  );
}

function ForecastTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload || {};

  return (
    <div className="min-w-[320px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
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
          <span className="font-bold text-blue-700">Omega Forecast</span>
          <span className="font-black">{formatMoney(row.forecast)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="font-bold text-amber-700">Lower Band</span>
          <span className="font-black">{formatMoney(row.lower)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="font-bold text-orange-700">Upper Band</span>
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
        Interval source: {row.interval_source || "not available in artifact"}. Forecasts are model outputs, not guarantees.
      </div>
    </div>
  );
}

export default function FinalDeepMLEvaluationPage() {
  const [loaded, setLoaded] = useState<Record<string, LoadedArtifact>>({});
  const [loading, setLoading] = useState(true);
  const [aiQuestion, setAiQuestion] = useState("Explain this Deep ML final forecast in business language.");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      mode: "deep_ml_forecast_ai",
      content:
        "I can explain this Deep ML final forecast page using Omega, Gamma, Step 10, Step 10A, Step 11, and Deep ML governance artifacts only.",
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

  const omegaForecastRows = useMemo(() => {
    const points = Array.isArray(data("omegaForecastPoints")) ? data("omegaForecastPoints") : [];
    const roll = Array.isArray(data("omegaRollforward")) ? data("omegaRollforward") : [];
    const latestRows = rowsFromJson(data("omegaForecastLatest"));

    return dedupeForecastRows([
      ...normalizeDeepForecastRows(roll, "Omega rollforward"),
      ...normalizeDeepForecastRows(points, "Omega forecast points"),
      ...normalizeDeepForecastRows(latestRows, "Omega latest forecast"),
    ]);
  }, [loaded]);

  const chartRows = useMemo(() => downsampleRows(omegaForecastRows, 900), [omegaForecastRows]);
  const metrics = useMemo(() => computeMetrics(omegaForecastRows), [omegaForecastRows]);

  const loadedCount = useMemo(() => Object.values(loaded).filter((item) => item.ok).length, [loaded]);
  const requiredMissing = useMemo(() => ARTIFACTS.filter((item) => item.required && !loaded[item.key]?.ok), [loaded]);

  const matrixRows = Array.isArray(data("matrix")) ? data("matrix") : [];
  const latestMatrixRow = matrixRows.length ? matrixRows[matrixRows.length - 1] : {};
  const latestGold = firstNumber(latestMatrixRow.gold_price, latestMatrixRow.actual_gold_price, latestMatrixRow.actual_target);

  const finalForecastDate = firstText(
    findValueDeep(data("omegaForecastLatest"), ["forecast_date", "latest_forecast_date", "as_of_date", "date"]),
    omegaForecastRows[omegaForecastRows.length - 1]?.date
  );

  const omegaStatus = firstText(
    findValueDeep(data("omegaReport"), ["status", "run_status", "phase_status", "result"]),
    findValueDeep(data("omegaQuality"), ["status", "review_status", "quality_status"]),
    "Loaded"
  );

  const intervalRows = omegaForecastRows.filter((row) => row.lower !== null && row.upper !== null);
  const intervalLabel = intervalRows.some((row) => row.interval_source.includes("95"))
    ? "95% band"
    : intervalRows.length
      ? "Available interval band"
      : "No interval artifact";

  const gammaRows = rowsFromJson(data("gammaSensitivity"));
  const omegaWeightRows = rowsFromJson(data("omegaWeights"));
  const omegaEvalRows = rowsFromJson(data("omegaEvaluation"));

  async function askAI(promptOverride?: string) {
    const prompt = (promptOverride || aiQuestion).trim();
    if (!prompt || aiBusy) return;

    const nextMessages: ChatMessage[] = [...aiMessages, { role: "user", content: prompt }];
    setAiMessages(nextMessages);
    setAiQuestion("");
    setAiBusy(true);

    try {
      const response = await fetch("/api/gold-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: prompt,
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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(250,204,21,0.18),transparent_32%),radial-gradient(circle_at_80%_30%,rgba(59,130,246,0.24),transparent_36%),linear-gradient(135deg,#020617,#081426_58%,#000)]" />
          <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(148,163,184,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.12)_1px,transparent_1px)] [background-size:38px_38px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="inline-flex rounded-full border border-yellow-300/30 bg-yellow-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-yellow-200">
                Deep ML Final Forecast · Omega Fusion
              </div>

              <h1 className="mt-7 text-5xl font-black tracking-tight text-white md:text-7xl">
                Final Deep ML Forecast
              </h1>

              <p className="mt-5 max-w-4xl text-sm font-semibold leading-7 text-blue-50/80">
                This page is only for the Deep ML system. It uses Omega fusion as the final Deep ML
                candidate forecast layer, with Gamma shown only as context/sensitivity. Academic model
                artifacts are not used on this page.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <StatusPill value={omegaStatus} />
                <span className="rounded-full border border-blue-300/30 bg-blue-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-100">
                  {loadedCount} / {ARTIFACTS.length} Deep ML artifacts loaded
                </span>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-200">
                  Latest matrix gold: {formatMoney(latestGold)}
                </span>
                <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-100">
                  {intervalLabel}
                </span>
              </div>
            </div>

            <div className="rounded-[2.4rem] border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-yellow-200">
                Forecast Status
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/50">Final forecast date</div>
                  <div className="mt-2 text-2xl font-black text-white">{formatDate(finalForecastDate)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/50">Forecast rows</div>
                  <div className="mt-2 text-2xl font-black text-white">{omegaForecastRows.length.toLocaleString()}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/50">Rows with actuals</div>
                  <div className="mt-2 text-2xl font-black text-white">{metrics.actualRows.toLocaleString()}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/50">Average APE where actual exists</div>
                  <div className="mt-2 text-2xl font-black text-white">{formatPct(metrics.mape)}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {requiredMissing.length ? (
          <section className="mt-6 rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-900">
            Required Deep ML artifact warning: {requiredMissing.map((item) => item.label).join(", ")} did not load. The forecast page will show available artifacts, but the final Deep ML forecast should not be treated as complete until required files are available.
          </section>
        ) : null}

        <section className="mt-8 grid gap-5 md:grid-cols-4">
          <StatCard label="Forecast Rows" value={metrics.forecastRows.toLocaleString()} note="Rows assembled from Omega forecast points, Omega rollforward, and Omega latest forecast artifacts." />
          <StatCard label="Actual Rows" value={metrics.actualRows.toLocaleString()} note="Rows where actual post-cutoff or rollforward gold prices are available." />
          <StatCard label="Average MAE" value={formatMoney(metrics.mae)} note="Computed only where actual and forecast values both exist." />
          <StatCard label="Interval Status" value={intervalLabel} note="Band appears only if lower/upper interval values exist in the Deep ML artifacts." />
        </section>

        <section className="mt-8 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            eyebrow="Future forecast chart"
            title="Future Deep ML Omega Forecast with 95% Confidence Band"
            description="This chart is the Deep ML equivalent of the Academic final forecast chart. It uses Omega forecast artifacts only. If the artifact contains explicit 95% lower/upper fields, the band is treated as a 95% confidence band; otherwise the page labels the interval as the available artifact band."
          />

          <div className="mb-5 flex flex-wrap gap-3">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
              Actual rows: {metrics.actualRows}
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-700">
              Omega forecast
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-amber-700">
              {intervalLabel}
            </span>
            <a
              href={cleanHref("artifacts/deep_ml/models/omega_fusion/omega_forecast_points.csv")}
              download
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-blue-50"
            >
              Download Omega forecast points
            </a>
          </div>

          <div className="h-[620px] rounded-[2rem] border border-slate-100 bg-slate-50 p-4">
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

                <Area
                  type="monotone"
                  dataKey="upper"
                  name="Upper Band"
                  stroke="#d97706"
                  fill="#fde68a"
                  fillOpacity={0.28}
                  dot={false}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="lower"
                  name="Lower Band"
                  stroke="#d97706"
                  fill="#ffffff"
                  fillOpacity={1}
                  dot={false}
                  connectNulls
                />
                <Line type="monotone" dataKey="actual" name="Actual Gold Price" stroke="#16a34a" strokeWidth={2.4} dot={false} connectNulls />
                <Line type="monotone" dataKey="forecast" name="Omega Deep ML Forecast" stroke="#2563eb" strokeWidth={2.4} dot={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Omega evaluation"
              title="Deep ML final evaluation rows"
              description="This table displays Omega evaluation evidence only. Academic model rows are intentionally excluded."
            />

            <div className="max-h-[520px] overflow-auto rounded-[2rem] border border-slate-200 bg-white">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <tr>
                    {columnsFromRows(omegaEvalRows).slice(0, 9).map((column) => (
                      <th key={column} className="border-b border-slate-200 px-3 py-3">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {omegaEvalRows.slice(0, 90).map((row, index) => (
                    <tr key={index} className="border-b border-slate-100 hover:bg-blue-50/40">
                      {columnsFromRows(omegaEvalRows).slice(0, 9).map((column) => (
                        <td key={column} className="max-w-[240px] truncate px-3 py-2 font-semibold text-slate-700">
                          {String(row?.[column] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {omegaEvalRows.length === 0 ? (
                <div className="p-5 text-sm font-semibold text-slate-500">Omega evaluation rows were not found in the artifact.</div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Forecast AI"
              title="Ask about the Deep ML forecast"
              description="This small AI box is focused only on Deep ML forecast, Omega, Gamma context, refresh steps, and final forecast interpretation."
            />

            <div className="mb-4 flex flex-wrap gap-2">
              {[
                "Explain the Deep ML forecast in business language.",
                "What does the 95% band mean?",
                "Why is Gamma context-only?",
                "Which Omega artifacts support this forecast?",
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

            <div className="h-[380px] overflow-y-auto rounded-[2rem] border border-slate-100 bg-slate-50 p-4">
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
                    Searching Deep ML forecast artifacts...
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
                placeholder="Ask about Omega forecast, confidence band, Gamma context, or Deep ML artifacts..."
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
              eyebrow="Omega weights"
              title="Fusion weights by horizon"
              description="Shows how Omega combines accepted Deep ML expert outputs by horizon when the weights artifact exposes row data."
            />

            <div className="max-h-[500px] overflow-auto rounded-[2rem] border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <tr>
                    {columnsFromRows(omegaWeightRows).slice(0, 9).map((column) => (
                      <th key={column} className="border-b border-slate-200 px-3 py-3">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {omegaWeightRows.slice(0, 90).map((row, index) => (
                    <tr key={index} className="border-b border-slate-100">
                      {columnsFromRows(omegaWeightRows).slice(0, 9).map((column) => (
                        <td key={column} className="max-w-[240px] truncate px-3 py-2 font-semibold text-slate-700">
                          {String(row?.[column] ?? "")}
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

          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Gamma context"
              title="News sensitivity note"
              description="Gamma is included only to interpret the market context around forecast periods. It does not override the Omega forecast."
            />

            <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-950">
              Gamma/context is not causality. This final Deep ML page uses Gamma to explain news sensitivity and tooltip context only.
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
                          {String(row?.[column] ?? "")}
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
            description="Only Deep ML, Omega, Gamma, source refresh, feature refresh, governance, and matrix artifacts are listed here."
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

print("Created Deep-ML-only final forecast/evaluation page with Omega forecast band chart.")