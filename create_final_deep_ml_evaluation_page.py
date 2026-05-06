from pathlib import Path

PAGE = Path("src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx")
PAGE.parent.mkdir(parents=True, exist_ok=True)

PAGE.write_text(r'''
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

type ArtifactBlob = {
  id: string;
  label: string;
  path: string;
  publicPath: string;
  ext: string;
  sizeBytes: number;
  group: string;
  domain: string;
  modelKey?: string;
  tags: string[];
  updatedAt?: string;
  score?: number;
};

type LiveGoldQuote = {
  status: string;
  source: string;
  symbol: string;
  price: number | null;
  currency?: string;
  exchangeName?: string;
  instrumentType?: string;
  marketState?: string;
  asOf?: string | null;
  note?: string;
  error?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  mode?: string;
  sources?: string[];
};

const ARTIFACTS: ArtifactSpec[] = [
  {
    key: "finalEval",
    label: "Final Deep ML Evaluation",
    path: "artifacts/deep_ml/evaluation/final_deep_ml_evaluation.json",
    kind: "json",
    group: "Final Decision",
  },
  {
    key: "finalSummary",
    label: "Final Deep ML Summary",
    path: "artifacts/deep_ml/evaluation/final_deep_ml_summary.json",
    kind: "json",
    group: "Final Decision",
  },

  {
    key: "academicRanking",
    label: "Academic Model Ranking",
    path: "artifacts/validation/model_ranking.csv",
    kind: "csv",
    group: "Academic Baseline",
    required: true,
  },
  {
    key: "academicRankingJson",
    label: "Academic Model Ranking JSON",
    path: "artifacts/validation/model_ranking.json",
    kind: "json",
    group: "Academic Baseline",
  },
  {
    key: "selectedAcademic",
    label: "Selected Academic Model",
    path: "artifacts/validation/selected_model_summary.json",
    kind: "json",
    group: "Academic Baseline",
  },
  {
    key: "officialForecast",
    label: "Official Academic Forecast",
    path: "artifacts/forecast/official_forecast.json",
    kind: "json",
    group: "Academic Baseline",
  },
  {
    key: "officialForecastPath",
    label: "Official Forecast Path CSV",
    path: "artifacts/forecast/official_forecast_path.csv",
    kind: "csv",
    group: "Academic Baseline",
    required: true,
  },
  {
    key: "forecastStatus",
    label: "Academic Forecast Status",
    path: "artifacts/governance/forecast_status.json",
    kind: "json",
    group: "Academic Baseline",
  },
  {
    key: "forecastGovernance",
    label: "Academic Forecast Governance",
    path: "artifacts/governance/forecast_governance.json",
    kind: "json",
    group: "Academic Baseline",
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
    label: "Deep ML Study Context",
    path: "artifacts/deep_ml/governance/study_context.json",
    kind: "json",
    group: "Deep ML Governance",
  },
  {
    key: "cutoffGovernance",
    label: "Deep ML Cutoff Governance",
    path: "artifacts/deep_ml/governance/deep_ml_cutoff_governance.json",
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
    group: "Data Refresh",
  },
  {
    key: "goldLiveSummary",
    label: "Step 10A Gold Live Update Summary",
    path: "artifacts/deep_ml/source_update/gold_live_update_summary.json",
    kind: "json",
    group: "Data Refresh",
  },
  {
    key: "goldLiveInventory",
    label: "Step 10A Gold Live Inventory",
    path: "artifacts/deep_ml/source_update/gold_live_price_inventory.json",
    kind: "json",
    group: "Data Refresh",
  },
  {
    key: "phase11",
    label: "Step 11 Feature Store Refresh",
    path: "artifacts/deep_ml/feature_refresh/phase11_governed_feature_store_refresh_report.json",
    kind: "json",
    group: "Data Refresh",
  },
  {
    key: "featureManifest",
    label: "Feature Manifest",
    path: "artifacts/deep_ml/features/feature_manifest.json",
    kind: "json",
    group: "Data Refresh",
  },
  {
    key: "matrix",
    label: "Deep ML Refreshed Matrix",
    path: "artifacts/deep_ml/features/deep_ml_refreshed_matrix.csv",
    kind: "csv",
    group: "Data Refresh",
  },

  {
    key: "alphaReport",
    label: "Alpha Structural Report",
    path: "artifacts/deep_ml/models/alpha_structural/phase6_alpha_structural_report.json",
    kind: "json",
    group: "Deep ML Experts",
  },
  {
    key: "alphaEval",
    label: "Alpha Evaluation by Horizon",
    path: "artifacts/deep_ml/models/alpha_structural/evaluation_by_horizon.json",
    kind: "json",
    group: "Deep ML Experts",
  },
  {
    key: "alphaForecast",
    label: "Alpha Latest Forecast",
    path: "artifacts/deep_ml/models/alpha_structural/forecast_latest.json",
    kind: "json",
    group: "Deep ML Experts",
  },
  {
    key: "alphaRoll",
    label: "Alpha Rollforward CSV",
    path: "artifacts/deep_ml/models/alpha_structural/evaluation_rollforward.csv",
    kind: "csv",
    group: "Deep ML Experts",
  },

  {
    key: "betaReport",
    label: "Beta Temporal Report",
    path: "artifacts/deep_ml/models/beta_temporal/phase7_beta_temporal_report.json",
    kind: "json",
    group: "Deep ML Experts",
  },
  {
    key: "betaEval",
    label: "Beta Evaluation by Horizon",
    path: "artifacts/deep_ml/models/beta_temporal/evaluation_by_horizon.json",
    kind: "json",
    group: "Deep ML Experts",
  },
  {
    key: "betaForecast",
    label: "Beta Latest Forecast",
    path: "artifacts/deep_ml/models/beta_temporal/forecast_latest.json",
    kind: "json",
    group: "Deep ML Experts",
  },
  {
    key: "betaRoll",
    label: "Beta Rollforward CSV",
    path: "artifacts/deep_ml/models/beta_temporal/evaluation_rollforward.csv",
    kind: "csv",
    group: "Deep ML Experts",
  },

  {
    key: "deltaReport",
    label: "Delta TFT Report",
    path: "artifacts/deep_ml/models/delta_tft/phase8_delta_tft_report.json",
    kind: "json",
    group: "Deep ML Experts",
  },
  {
    key: "deltaEval",
    label: "Delta Evaluation by Horizon",
    path: "artifacts/deep_ml/models/delta_tft/evaluation_by_horizon.json",
    kind: "json",
    group: "Deep ML Experts",
  },
  {
    key: "deltaForecast",
    label: "Delta Latest Forecast",
    path: "artifacts/deep_ml/models/delta_tft/forecast_latest.json",
    kind: "json",
    group: "Deep ML Experts",
  },
  {
    key: "deltaRoll",
    label: "Delta Rollforward CSV",
    path: "artifacts/deep_ml/models/delta_tft/evaluation_rollforward.csv",
    kind: "csv",
    group: "Deep ML Experts",
  },

  {
    key: "epsilonReport",
    label: "Epsilon Expert Ensemble Report",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/phase9_epsilon_expert_report.json",
    kind: "json",
    group: "Deep ML Experts",
  },
  {
    key: "epsilonEval",
    label: "Epsilon Evaluation by Horizon",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/evaluation_by_horizon.json",
    kind: "json",
    group: "Deep ML Experts",
  },
  {
    key: "epsilonForecast",
    label: "Epsilon Latest Forecast",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/forecast_latest.json",
    kind: "json",
    group: "Deep ML Experts",
  },
  {
    key: "epsilonRoll",
    label: "Epsilon Rollforward CSV",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/evaluation_rollforward.csv",
    kind: "csv",
    group: "Deep ML Experts",
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
    label: "Gamma Date Context CSV",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_date_context.csv",
    kind: "csv",
    group: "Gamma Context",
  },

  {
    key: "omegaReport",
    label: "Omega Fusion Report",
    path: "artifacts/deep_ml/models/omega_fusion/phase14_omega_fusion_report.json",
    kind: "json",
    group: "Omega Fusion",
  },
  {
    key: "omegaEval",
    label: "Omega Evaluation by Horizon",
    path: "artifacts/deep_ml/models/omega_fusion/omega_evaluation_by_horizon.json",
    kind: "json",
    group: "Omega Fusion",
  },
  {
    key: "omegaForecast",
    label: "Omega Forecast Latest",
    path: "artifacts/deep_ml/models/omega_fusion/omega_forecast_latest.json",
    kind: "json",
    group: "Omega Fusion",
  },
  {
    key: "omegaRanking",
    label: "Omega Model Ranking",
    path: "artifacts/deep_ml/models/omega_fusion/omega_model_ranking.json",
    kind: "json",
    group: "Omega Fusion",
  },
  {
    key: "omegaWeights",
    label: "Omega Weights by Horizon",
    path: "artifacts/deep_ml/models/omega_fusion/omega_weights_by_horizon.json",
    kind: "json",
    group: "Omega Fusion",
  },
  {
    key: "omegaQuality",
    label: "Omega Quality Review",
    path: "artifacts/deep_ml/models/omega_fusion/quality_review.json",
    kind: "json",
    group: "Omega Fusion",
  },
  {
    key: "omegaRoll",
    label: "Omega Rollforward CSV",
    path: "artifacts/deep_ml/models/omega_fusion/omega_rollforward.csv",
    kind: "csv",
    group: "Omega Fusion",
    required: true,
  },
  {
    key: "omegaForecastPoints",
    label: "Omega Forecast Points CSV",
    path: "artifacts/deep_ml/models/omega_fusion/omega_forecast_points.csv",
    kind: "csv",
    group: "Omega Fusion",
  },
];

const EXPERTS = [
  { key: "alpha", label: "Alpha Structural", evalKey: "alphaEval", reportKey: "alphaReport", forecastKey: "alphaForecast", route: "/deep-ml/models/alpha-structural" },
  { key: "beta", label: "Beta Temporal", evalKey: "betaEval", reportKey: "betaReport", forecastKey: "betaForecast", route: "/deep-ml/models/beta-temporal" },
  { key: "delta", label: "Delta TFT", evalKey: "deltaEval", reportKey: "deltaReport", forecastKey: "deltaForecast", route: "/deep-ml/models/delta-tft" },
  { key: "epsilon", label: "Epsilon Ensemble", evalKey: "epsilonEval", reportKey: "epsilonReport", forecastKey: "epsilonForecast", route: "/deep-ml/models/epsilon-ensemble" },
  { key: "omega", label: "Omega Fusion", evalKey: "omegaEval", reportKey: "omegaReport", forecastKey: "omegaForecast", route: "/deep-ml/models/omega-fusion" },
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

function parseCsv(text: string, maxRows = 30000) {
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

function rowsFromJson(value: any): any[] {
  if (Array.isArray(value)) return value.filter((item) => isRecord(item));

  if (!isRecord(value)) return [];

  const keys = [
    "rows",
    "data",
    "records",
    "metrics",
    "ranking",
    "models",
    "experts",
    "horizons",
    "by_horizon",
    "evaluation",
    "weights",
    "forecast_points",
    "sensitivity",
  ];

  for (const key of keys) {
    const child = value[key];

    if (Array.isArray(child)) return child.filter((item) => isRecord(item));

    if (isRecord(child)) {
      const asEntries = Object.entries(child).map(([k, v]) => {
        if (isRecord(v)) return { horizon: k, ...v };
        return { horizon: k, value: v };
      });

      if (asEntries.length) return asEntries;
    }
  }

  for (const child of Object.values(value)) {
    if (Array.isArray(child) && child.some((item) => isRecord(item))) return child.filter((item) => isRecord(item));

    if (isRecord(child)) {
      const nested = rowsFromJson(child);
      if (nested.length) return nested;
    }
  }

  return [];
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

  if (text.includes("fail") || text.includes("block") || text.includes("missing")) {
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

function averageMetric(rows: any[], keys: string[]) {
  const values = rows
    .map((row) => keys.map((key) => toNumber(row?.[key])).find((value) => value !== null))
    .filter((value): value is number => value !== null);

  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getMetricRows(value: any) {
  const rows = rowsFromJson(value);

  return rows.filter((row) =>
    Object.keys(row || {}).some((key) =>
      ["mae", "rmse", "mape", "directional", "accuracy", "coverage", "error"].some((needle) =>
        key.toLowerCase().includes(needle)
      )
    )
  );
}

function normalizeAcademicRanking(rows: any[]) {
  return rows
    .map((row, index) => ({
      rank: firstNumber(row.rank) ?? index + 1,
      model: firstText(row.model_name, row.model, row.model_key, row.name),
      family: firstText(row.category, "Academic baseline"),
      rmse: firstNumber(row.primary_rmse, row.test_rmse, row.validation_rmse, row.RMSE),
      mae: firstNumber(row.primary_mae, row.test_mae, row.validation_mae, row.MAE),
      mape: firstNumber(row.primary_mape, row.test_mape, row.validation_mape, row.MAPE),
      source: firstText(row.source_artifact, "artifacts/validation/model_ranking.csv"),
      kind: "Academic",
    }))
    .filter((row) => row.model !== "Not in artifact");
}

function extractExpertScore(label: string, evalData: any, reportData: any, forecastData: any) {
  const metricRows = getMetricRows(evalData);
  const reportRows = getMetricRows(reportData);
  const rows = metricRows.length ? metricRows : reportRows;

  const rmse =
    averageMetric(rows, ["rmse", "RMSE", "test_rmse", "validation_rmse"]) ??
    toNumber(findValueDeep(evalData, ["rmse", "RMSE", "test_rmse", "primary_rmse"]));

  const mae =
    averageMetric(rows, ["mae", "MAE", "test_mae", "validation_mae"]) ??
    toNumber(findValueDeep(evalData, ["mae", "MAE", "test_mae", "primary_mae"]));

  const mape =
    averageMetric(rows, ["mape", "MAPE", "mape_pct", "test_mape", "primary_mape"]) ??
    toNumber(findValueDeep(evalData, ["mape", "MAPE", "mape_pct", "test_mape", "primary_mape"]));

  const directional =
    averageMetric(rows, ["directional_accuracy", "directional_accuracy_pct", "test_directional_accuracy"]) ??
    toNumber(findValueDeep(evalData, ["directional_accuracy", "directional_accuracy_pct", "test_directional_accuracy"]));

  const status = firstText(
    findValueDeep(reportData, ["status", "run_status", "phase_status", "result"]),
    findValueDeep(forecastData, ["status", "run_status"]),
    "Loaded"
  );

  return {
    label,
    rmse,
    mae,
    mape,
    directional,
    status,
    horizons: rows.length,
  };
}

function normalizeForecastRows(rows: any[], kind: "academic" | "omega") {
  return rows
    .map((row) => {
      const actual =
        firstNumber(row.actual_gold_price, row.actual_target, row.actual, row.gold_price, row.observed) ??
        null;

      const forecast =
        kind === "academic"
          ? firstNumber(row.official_forecast, row.forecast, row.prediction, row.yhat)
          : firstNumber(row.prediction, row.omega_prediction, row.forecast, row.p50, row.omega_p50_weighted);

      const date = firstText(row.date, row.forecast_date, row.ds, row.timestamp);

      return {
        date,
        actual,
        academic: kind === "academic" ? forecast : null,
        omega: kind === "omega" ? forecast : null,
        split: firstText(row.split, row.period, "path"),
      };
    })
    .filter((row) => row.date !== "Not in artifact" && (row.academic !== null || row.omega !== null));
}

function mergeForecastRows(academicRows: any[], omegaRows: any[]) {
  const map = new Map<string, any>();

  for (const row of academicRows) {
    map.set(row.date, { ...(map.get(row.date) || { date: row.date }), actual: row.actual, academic: row.academic, split: row.split });
  }

  for (const row of omegaRows) {
    const existing = map.get(row.date) || { date: row.date };
    map.set(row.date, {
      ...existing,
      actual: existing.actual ?? row.actual,
      omega: row.omega,
      omegaSplit: row.split,
    });
  }

  return Array.from(map.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function downsampleRows(rows: any[], max = 850) {
  if (rows.length <= max) return rows;
  const step = Math.ceil(rows.length / max);
  return rows.filter((_, index) => index % step === 0);
}

function columnsFromRows(rows: any[]) {
  const cols = new Set<string>();
  rows.slice(0, 30).forEach((row) => Object.keys(row || {}).forEach((key) => cols.add(key)));
  return Array.from(cols);
}

function ArtifactLink({ path, label }: { path: string; label: string }) {
  return (
    <a
      href={cleanHref(path)}
      target="_blank"
      className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-700 hover:bg-blue-100"
    >
      {label}
    </a>
  );
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

export default function FinalDeepMLEvaluationPage() {
  const [loaded, setLoaded] = useState<Record<string, LoadedArtifact>>({});
  const [catalog, setCatalog] = useState<ArtifactBlob[]>([]);
  const [liveGold, setLiveGold] = useState<LiveGoldQuote | null>(null);
  const [loading, setLoading] = useState(true);

  const [aiQuestion, setAiQuestion] = useState("Give me the final Deep ML evaluation conclusion in professor-safe language.");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      mode: "artifact_blob_ai",
      content:
        "I can explain this final evaluation page using the approved Academic, Deep ML, Gamma, Omega, Step 10, Step 10A, Step 11, and blob artifacts. I will not claim Deep ML wins unless a final evaluation artifact proves it.",
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

      try {
        const catalogResponse = await fetch("/api/artifact-blob", { cache: "no-store" });
        const catalogData = await catalogResponse.json();
        setCatalog(Array.isArray(catalogData.catalog) ? catalogData.catalog : []);
      } catch {
        setCatalog([]);
      }

      try {
        const liveResponse = await fetch("/api/live-gold", { cache: "no-store" });
        const liveData = await liveResponse.json();
        setLiveGold(liveData);
      } catch {
        setLiveGold(null);
      }

      setLoading(false);
    }

    loadAll();
  }, []);

  const data = (key: string) => loaded[key]?.data;

  const loadedCount = useMemo(() => Object.values(loaded).filter((item) => item.ok).length, [loaded]);
  const requiredMissing = useMemo(() => ARTIFACTS.filter((item) => item.required && !loaded[item.key]?.ok), [loaded]);

  const finalArtifactExists = Boolean(loaded.finalEval?.ok || loaded.finalSummary?.ok);

  const academicRanking = useMemo(() => normalizeAcademicRanking(Array.isArray(data("academicRanking")) ? data("academicRanking") : rowsFromJson(data("academicRankingJson"))), [loaded]);

  const academicBest = academicRanking[0];

  const expertScores = useMemo(() => {
    return EXPERTS.map((expert) => {
      return {
        ...extractExpertScore(expert.label, data(expert.evalKey), data(expert.reportKey), data(expert.forecastKey)),
        route: expert.route,
        key: expert.key,
      };
    });
  }, [loaded]);

  const omegaRankRows = useMemo(() => rowsFromJson(data("omegaRanking")), [loaded]);
  const omegaWeightRows = useMemo(() => rowsFromJson(data("omegaWeights")), [loaded]);
  const gammaRows = useMemo(() => rowsFromJson(data("gammaSensitivity")), [loaded]);
  const matrixRows = useMemo(() => Array.isArray(data("matrix")) ? data("matrix") : [], [loaded]);

  const scoreboardRows = useMemo(() => {
    const academic = academicRanking.slice(0, 8).map((row) => ({
      model: row.model,
      family: row.family,
      source: "Academic baseline",
      rmse: row.rmse,
      mae: row.mae,
      mape: row.mape,
      status: "Artifact ranked",
    }));

    const deep = expertScores.map((row) => ({
      model: row.label,
      family: "Deep ML candidate",
      source: row.key === "omega" ? "Omega fusion" : "Deep ML expert",
      rmse: row.rmse,
      mae: row.mae,
      mape: row.mape,
      status: row.status,
    }));

    return [...academic, ...deep].sort((a, b) => {
      const ar = Number.isFinite(Number(a.rmse)) ? Number(a.rmse) : Number.POSITIVE_INFINITY;
      const br = Number.isFinite(Number(b.rmse)) ? Number(b.rmse) : Number.POSITIVE_INFINITY;
      return ar - br;
    });
  }, [academicRanking, expertScores]);

  const forecastRows = useMemo(() => {
    const academicRows = normalizeForecastRows(Array.isArray(data("officialForecastPath")) ? data("officialForecastPath") : rowsFromJson(data("officialForecast")), "academic");
    const omegaRows = normalizeForecastRows(Array.isArray(data("omegaRoll")) ? data("omegaRoll") : Array.isArray(data("omegaForecastPoints")) ? data("omegaForecastPoints") : rowsFromJson(data("omegaForecast")), "omega");

    return downsampleRows(mergeForecastRows(academicRows, omegaRows), 900);
  }, [loaded]);

  const latestMatrixRow = matrixRows.length ? matrixRows[matrixRows.length - 1] : {};
  const latestMatrixGold = firstNumber(latestMatrixRow.gold_price, latestMatrixRow.actual_gold_price);
  const displayGold = liveGold?.price || latestMatrixGold;
  const displayGoldDate = liveGold?.asOf || latestMatrixRow.date;

  const decisionStatus = finalArtifactExists
    ? firstText(findValueDeep(data("finalEval"), ["status", "decision_status", "result"]), "Final artifact loaded")
    : "Final decision pending";

  const professorSafeConclusion = finalArtifactExists
    ? firstText(
        findValueDeep(data("finalEval"), ["professor_safe_conclusion", "final_conclusion", "conclusion", "summary"]),
        findValueDeep(data("finalSummary"), ["professor_safe_conclusion", "final_conclusion", "conclusion", "summary"]),
        "Final evaluation artifact is loaded, but no written conclusion field was found."
      )
    : "Final Deep ML synthesis is currently a candidate evaluation dashboard. It compares Academic baseline artifacts, Deep ML expert artifacts, Gamma context, and Omega fusion, but it does not declare Deep ML superior unless a final evaluation artifact explicitly supports that conclusion.";

  const finalRelatedBlobs = useMemo(() => {
    const needles = ["final", "evaluation", "ranking", "forecast", "omega", "alpha", "beta", "delta", "epsilon", "gamma", "source_update", "feature_refresh", "matrix", "validation"];

    return catalog
      .filter((blob) => needles.some((needle) => `${blob.path} ${blob.label} ${blob.tags.join(" ")}`.toLowerCase().includes(needle)))
      .slice(0, 48);
  }, [catalog]);

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
          <style>{`
            .final-orbit {
              position: absolute;
              right: 12%;
              top: 50%;
              width: 360px;
              height: 360px;
              margin-top: -180px;
              border-radius: 999px;
              border: 1px solid rgba(147,197,253,.22);
              animation: final-spin 18s linear infinite;
            }

            .final-orbit.two {
              width: 250px;
              height: 250px;
              margin-top: -125px;
              right: calc(12% + 55px);
              border-color: rgba(250,204,21,.28);
              animation-duration: 11s;
              animation-direction: reverse;
            }

            .final-core {
              position: absolute;
              right: calc(12% + 105px);
              top: 50%;
              width: 150px;
              height: 150px;
              margin-top: -75px;
              border-radius: 999px;
              display: grid;
              place-items: center;
              background:
                radial-gradient(circle at 30% 25%, rgba(250,204,21,.65), transparent 30%),
                radial-gradient(circle at 70% 75%, rgba(37,99,235,.65), transparent 35%),
                rgba(15,23,42,.9);
              border: 1px solid rgba(255,255,255,.24);
              box-shadow: 0 0 90px rgba(59,130,246,.35), 0 0 120px rgba(250,204,21,.18), inset 0 0 42px rgba(255,255,255,.08);
              animation: final-float 5s ease-in-out infinite;
            }

            .final-node {
              position: absolute;
              width: 10px;
              height: 10px;
              border-radius: 999px;
              background: rgba(250,204,21,.96);
              box-shadow: 0 0 20px rgba(250,204,21,.8), 0 0 35px rgba(59,130,246,.45);
              animation: final-pulse 2.2s ease-in-out infinite;
            }

            .final-node.n1 { right: 9%; top: 23%; animation-delay: .1s; }
            .final-node.n2 { right: 28%; top: 18%; animation-delay: .3s; }
            .final-node.n3 { right: 7%; bottom: 25%; animation-delay: .5s; }
            .final-node.n4 { right: 30%; bottom: 18%; animation-delay: .7s; }

            @keyframes final-spin {
              from { transform: rotateZ(0deg) rotateX(64deg); }
              to { transform: rotateZ(360deg) rotateX(64deg); }
            }

            @keyframes final-float {
              0%, 100% { transform: translateY(0) scale(1); }
              50% { transform: translateY(-12px) scale(1.04); }
            }

            @keyframes final-pulse {
              0%, 100% { opacity: .42; transform: scale(.85); }
              50% { opacity: 1; transform: scale(1.45); }
            }
          `}</style>

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(250,204,21,0.18),transparent_32%),radial-gradient(circle_at_80%_30%,rgba(59,130,246,0.24),transparent_36%),linear-gradient(135deg,#020617,#081426_58%,#000)]" />
          <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(148,163,184,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.12)_1px,transparent_1px)] [background-size:38px_38px]" />
          <span className="final-orbit" />
          <span className="final-orbit two" />
          <span className="final-core">
            <span className="text-center">
              <span className="block text-3xl font-black text-white">FINAL</span>
              <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.22em] text-yellow-200">Fusion</span>
            </span>
          </span>
          <span className="final-node n1" />
          <span className="final-node n2" />
          <span className="final-node n3" />
          <span className="final-node n4" />

          <div className="relative z-10 max-w-5xl">
            <div className="inline-flex rounded-full border border-yellow-300/30 bg-yellow-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-yellow-200">
              Final Deep ML Evaluation · AI + Blob Fusion
            </div>

            <h1 className="mt-7 text-5xl font-black tracking-tight text-white md:text-7xl">
              Final Deep ML Evaluation
            </h1>

            <p className="mt-5 max-w-4xl text-sm font-semibold leading-7 text-blue-50/80">
              This is the final synthesis page for Academic baseline, Alpha, Beta, Delta, Epsilon,
              Gamma context, Omega fusion, Step 10 source update, Step 10A live gold patch, Step 11
              refreshed matrix, and the Gold AI artifact blob.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <StatusPill value={decisionStatus} />
              <span className="rounded-full border border-blue-300/30 bg-blue-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-100">
                {loadedCount} / {ARTIFACTS.length} artifacts loaded
              </span>
              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-200">
                Live gold: {formatMoney(displayGold)}
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/75">
                As of {formatDate(displayGoldDate)}
              </span>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-[9px] font-black uppercase tracking-widest text-white/50">Academic Best</div>
                <div className="mt-2 text-sm font-black text-white">{academicBest?.model || "Not in artifact"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-[9px] font-black uppercase tracking-widest text-white/50">Deep Experts</div>
                <div className="mt-2 text-2xl font-black text-white">{expertScores.filter((row) => row.rmse || row.mae || row.mape).length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-[9px] font-black uppercase tracking-widest text-white/50">Gamma Role</div>
                <div className="mt-2 text-sm font-black text-white">Context only</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-[9px] font-black uppercase tracking-widest text-white/50">Omega Role</div>
                <div className="mt-2 text-sm font-black text-white">{finalArtifactExists ? "Final artifact linked" : "Candidate fusion"}</div>
              </div>
            </div>
          </div>
        </section>

        {requiredMissing.length ? (
          <section className="mt-6 rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-900">
            Required artifact warning: {requiredMissing.map((item) => item.label).join(", ")} did not load. The page will still show available evidence, but final evaluation should not be treated as complete until required files are available.
          </section>
        ) : null}

        <section className="mt-8 grid gap-5 md:grid-cols-4">
          <StatCard label="Final Status" value={decisionStatus} note="Loaded from final evaluation artifacts when available; otherwise marked pending." />
          <StatCard label="Loaded Evidence" value={`${loadedCount} / ${ARTIFACTS.length}`} note="Academic, Deep ML, Gamma, Omega, refresh, governance, and forecast artifacts." />
          <StatCard label="Blob Catalog" value={`${catalog.length}`} note={`${finalRelatedBlobs.length} final-related artifacts shown below.`} />
          <StatCard label="Matrix Rows" value={`${matrixRows.length.toLocaleString()}`} note="Refreshed Deep ML matrix rows loaded from Step 11 CSV." />
        </section>

        <section className="mt-8 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            eyebrow="Professor-safe decision"
            title="Final evaluation conclusion"
            description="This section is intentionally conservative. It will not claim Deep ML is better than the Academic baseline unless a final accepted evaluation artifact explicitly supports that conclusion."
          />

          <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
            <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Conclusion text</div>
              <p className="mt-4 text-lg font-black leading-8 text-slate-950">
                {professorSafeConclusion}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <ArtifactLink path="artifacts/validation/model_ranking.csv" label="Academic ranking" />
                <ArtifactLink path="artifacts/deep_ml/models/omega_fusion/omega_model_ranking.json" label="Omega ranking" />
                <ArtifactLink path="artifacts/deep_ml/models/omega_fusion/omega_evaluation_by_horizon.json" label="Omega evaluation" />
                <ArtifactLink path="artifacts/deep_ml/features/deep_ml_refreshed_matrix.csv" label="Deep ML matrix" />
              </div>
            </div>

            <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-700">Guardrails</div>
              <div className="mt-4 grid gap-3">
                {[
                  "Forecasts are model outputs, not guarantees.",
                  "Gamma is context/sensitivity, not causality.",
                  "Omega is candidate fusion until accepted by final evaluation.",
                  "Academic vs Deep ML superiority requires same-rule final comparison.",
                  "If an artifact does not contain a claim, the page does not claim it.",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-amber-200 bg-white/70 p-4 text-sm font-bold leading-6 text-amber-950">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Unified scoreboard"
              title="Academic + Deep ML metric evidence"
              description="Rows are assembled from academic ranking artifacts and Deep ML evaluation artifacts. Missing values remain marked as not available."
            />

            <div className="max-h-[560px] overflow-auto rounded-[2rem] border border-slate-200 bg-white">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="border-b border-slate-200 px-3 py-3">Model</th>
                    <th className="border-b border-slate-200 px-3 py-3">Family</th>
                    <th className="border-b border-slate-200 px-3 py-3">RMSE</th>
                    <th className="border-b border-slate-200 px-3 py-3">MAE</th>
                    <th className="border-b border-slate-200 px-3 py-3">MAPE</th>
                    <th className="border-b border-slate-200 px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreboardRows.map((row, index) => (
                    <tr key={`${row.model}-${index}`} className="border-b border-slate-100 hover:bg-blue-50/40">
                      <td className="px-3 py-3 font-black text-slate-900">{row.model}</td>
                      <td className="px-3 py-3 font-semibold text-slate-600">{row.family}</td>
                      <td className="px-3 py-3 font-semibold text-slate-700">{formatNumber(row.rmse, 3)}</td>
                      <td className="px-3 py-3 font-semibold text-slate-700">{formatNumber(row.mae, 3)}</td>
                      <td className="px-3 py-3 font-semibold text-slate-700">{formatNumber(row.mape, 3)}</td>
                      <td className="px-3 py-3"><StatusPill value={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Expert cards"
              title="Deep ML expert status"
              description="Each expert card reads from that model's evaluation, report, and forecast artifacts."
            />

            <div className="grid gap-3">
              {expertScores.map((expert) => (
                <Link
                  key={expert.key}
                  href={expert.route}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-black text-slate-950">{expert.label}</div>
                    <StatusPill value={expert.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">RMSE</div>
                      <div className="mt-1 text-sm font-black text-slate-800">{formatNumber(expert.rmse, 2)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">MAE</div>
                      <div className="mt-1 text-sm font-black text-slate-800">{formatNumber(expert.mae, 2)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">MAPE</div>
                      <div className="mt-1 text-sm font-black text-slate-800">{formatPct(expert.mape)}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            eyebrow="Forecast comparison"
            title="Academic official forecast vs Omega candidate path"
            description="This chart merges the official academic forecast path and Omega candidate rollforward/forecast artifacts by date. It is an evidence view, not a guarantee."
          />

          <div className="h-[560px] rounded-[2rem] border border-slate-100 bg-slate-50 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastRows} margin={{ top: 20, right: 35, left: 25, bottom: 55 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={36} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatNumber(value, 0)} width={85} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="actual" name="Actual Gold" stroke="#2563eb" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="academic" name="Academic Official Forecast" stroke="#ca8a04" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="omega" name="Omega Candidate Forecast" stroke="#16a34a" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Omega fusion"
              title="Weights and ranking evidence"
              description="Omega is shown as a fusion candidate unless a final evaluation artifact accepts it."
            />

            <div className="h-[360px] rounded-[2rem] border border-slate-100 bg-slate-50 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={omegaWeightRows.slice(0, 80)} margin={{ top: 20, right: 35, left: 25, bottom: 55 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey={columnsFromRows(omegaWeightRows).includes("horizon") ? "horizon" : columnsFromRows(omegaWeightRows)[0]} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  {columnsFromRows(omegaWeightRows)
                    .filter((column) => column !== "horizon" && omegaWeightRows.some((row) => Number.isFinite(Number(row?.[column]))))
                    .slice(0, 5)
                    .map((column, index) => (
                      <Bar key={column} dataKey={column} name={column} fill={["#2563eb", "#ca8a04", "#16a34a", "#7c3aed", "#dc2626"][index % 5]} radius={[8, 8, 0, 0]} />
                    ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-5 max-h-[310px] overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <tr>
                    {columnsFromRows(omegaRankRows).slice(0, 7).map((column) => (
                      <th key={column} className="border-b border-slate-200 px-3 py-3">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {omegaRankRows.slice(0, 40).map((row, index) => (
                    <tr key={index} className="border-b border-slate-100">
                      {columnsFromRows(omegaRankRows).slice(0, 7).map((column) => (
                        <td key={column} className="max-w-[220px] truncate px-3 py-2 font-semibold text-slate-700">{String(row?.[column] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {omegaRankRows.length === 0 ? <div className="p-5 text-sm font-semibold text-slate-500">Omega ranking rows were not found in the artifact.</div> : null}
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Gamma context"
              title="News sensitivity stays interpretive"
              description="Gamma is displayed as market/news context and sensitivity evidence. It is not treated as causal unless a future final artifact says so."
            />

            <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-950">
              Gamma provides context around news intensity and sensitivity. The final page uses it to explain possible market background, not to prove causality or override model metrics.
            </div>

            <div className="mt-5 max-h-[480px] overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <tr>
                    {columnsFromRows(gammaRows).slice(0, 7).map((column) => (
                      <th key={column} className="border-b border-slate-200 px-3 py-3">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gammaRows.slice(0, 80).map((row, index) => (
                    <tr key={index} className="border-b border-slate-100">
                      {columnsFromRows(gammaRows).slice(0, 7).map((column) => (
                        <td key={column} className="max-w-[240px] truncate px-3 py-2 font-semibold text-slate-700">{String(row?.[column] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {gammaRows.length === 0 ? <div className="p-5 text-sm font-semibold text-slate-500">Gamma sensitivity rows were not found in the artifact.</div> : null}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Gold AI"
              title="Ask the final evaluation brain"
              description="This calls the Gold AI route with pagePath=/deep-ml/models/final-deep-ml-evaluation so the blob service prioritizes final, evaluation, Omega, Gamma, academic, and model artifacts."
            />

            <div className="mb-4 flex flex-wrap gap-2">
              {[
                "What is the final evaluation conclusion?",
                "Compare Academic model and Omega in professor-safe language.",
                "Why is Gamma context-only?",
                "Which artifacts support this page?",
                "Can we say Deep ML is better than Academic?",
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

            <div className="h-[430px] overflow-y-auto rounded-[2rem] border border-slate-100 bg-slate-50 p-4">
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
                        {Array.from(new Set(message.sources)).slice(0, 7).map((source) => (
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
                    Searching final-evaluation artifacts...
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
                placeholder="Ask about the final evaluation, Academic vs Deep ML, Omega, Gamma, forecast metrics, or artifacts..."
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

            <Link
              href="/gold-ai"
              className="mt-4 inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-blue-700"
            >
              Open Full Gold AI Studio
            </Link>
          </div>

          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Evidence map"
              title="Loaded final-page artifacts"
              description="These are the explicit files the final page attempts to read. Missing final decision files stay visible as missing instead of being silently invented."
            />

            <div className="grid max-h-[640px] gap-3 overflow-y-auto md:grid-cols-2">
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
          </div>
        </section>

        <section className="mt-8 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            eyebrow="Blob catalog"
            title="Final-related artifact blob index"
            description="This list comes from /api/artifact-blob, so future final-evaluation files will appear when they match final, evaluation, ranking, forecast, model, or update terms."
          />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {finalRelatedBlobs.map((blob) => (
              <a
                key={blob.id}
                href={cleanHref(blob.publicPath)}
                target="_blank"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-slate-950">{blob.label}</div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-700">
                    {blob.ext.replace(".", "")}
                  </span>
                </div>
                <div className="mt-2 break-all text-xs font-semibold leading-5 text-slate-500">
                  artifacts/{blob.path}
                </div>
                <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {blob.group}
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
''', encoding="utf-8")

print("Created src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx")