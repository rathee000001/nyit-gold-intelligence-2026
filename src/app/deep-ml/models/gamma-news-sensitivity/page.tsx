import type { ReactNode } from "react";
import { promises as fs } from "fs";
import path from "path";
import {
  ActualVsForecastChart,
  MetricComparisonChart,
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
    label: "Gamma News Sensitivity Report",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/phase13_gamma_news_sensitivity_report.json",
    kind: "json",
  },
  {
    key: "runSummary",
    label: "Run Summary",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/run_summary.json",
    kind: "json",
  },
  {
    key: "qualityReview",
    label: "Quality Review",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/quality_review.json",
    kind: "json",
  },
  {
    key: "diagnostics",
    label: "Diagnostics Latest",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/diagnostics_latest.json",
    kind: "json",
  },
  {
    key: "pageBundle",
    label: "Gamma Page Bundle",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/page_bundle.json",
    kind: "json",
  },
  {
    key: "latestContext",
    label: "Gamma Latest Context",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_latest_context.json",
    kind: "json",
  },
  {
    key: "tooltipContext",
    label: "Gamma Tooltip Context",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_tooltip_context.json",
    kind: "json",
  },
  {
    key: "sensitivity",
    label: "Gamma Sensitivity by Horizon",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_sensitivity_by_horizon.json",
    kind: "json",
  },
  {
    key: "dateContext",
    label: "Gamma Date Context",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_date_context.csv",
    kind: "csv",
  },
];

const DOWNLOADS = [
  {
    label: "Phase 13 Report",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/phase13_gamma_news_sensitivity_report.json",
  },
  {
    label: "Gamma Date Context CSV",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_date_context.csv",
  },
  {
    label: "Gamma Model Joined Context CSV",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_model_joined_context.csv",
  },
  {
    label: "Gamma Tooltip Context JSON",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_tooltip_context.json",
  },
  {
    label: "Gamma Sensitivity by Horizon JSON",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_sensitivity_by_horizon.json",
  },
  {
    label: "Gamma Latest Context JSON",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_latest_context.json",
  },
  {
    label: "Gamma Page Bundle",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/page_bundle.json",
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

  return lines
    .slice(1)
    .filter(Boolean)
    .map((line) => {
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
  try {
    const base = getBaseUrl();
    let text = "";

    if (base) {
      const response = await fetch(`${base}/${cleanPath(artifact.path)}`, {
        cache: "no-store",
      });

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

function asArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function firstValue(...values: any[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return null;
}

function toNumber(value: any) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function fmtNum(value: any, digits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";

  return numeric.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function fmtPct(value: any, digits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";

  return `${numeric.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}%`;
}

function fmtDate(value: any) {
  if (!value) return "Not in artifact";

  const text = String(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function modelLabel(value: string) {
  const labels: Record<string, string> = {
    alpha_structural: "Alpha Structural",
    beta_temporal: "Beta Temporal",
    delta_tft: "Delta TFT",
    epsilon_expert_ensemble: "Epsilon Ensemble",
  };

  return labels[value] || value;
}

function bucketLabel(value: string) {
  const labels: Record<string, string> = {
    high: "High",
    medium: "Medium",
    low: "Low",
    no_loaded_news_score: "No Loaded Score",
  };

  return labels[value] || value;
}

function statusClass(status: any) {
  const text = String(status || "").toLowerCase();

  if (text.includes("ready") || text.includes("pass")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (text.includes("warning") || text.includes("review")) {
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
      className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(
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
      {description ? (
        <p className="mt-3 max-w-6xl text-sm font-medium leading-7 text-slate-500">
          {description}
        </p>
      ) : null}
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
      {note ? (
        <div className="mt-3 text-xs font-semibold leading-5 text-slate-500">
          {note}
        </div>
      ) : null}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: ReactNode }) {
  const empty = value === null || value === undefined || value === "";

  return (
    <div className="grid grid-cols-[210px_1fr] gap-3 border-b border-slate-100 pb-3 last:border-b-0">
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

function GammaHero() {
  const nodes = Array.from({ length: 42 }, (_, index) => {
    const left = 4 + ((index * 29) % 92);
    const top = 8 + ((index * 47) % 78);

    return (
      <span
        key={index}
        className="gamma-node"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          animationDelay: `${index * 0.08}s`,
        }}
      />
    );
  });

  return (
    <div className="relative min-h-[430px] overflow-hidden rounded-[3rem] border border-slate-200 bg-slate-950 p-8 shadow-2xl shadow-blue-950/20">
      <style>{`
        .gamma-grid {
          background-image:
            radial-gradient(circle at center, rgba(96,165,250,.24) 0, rgba(96,165,250,.12) 1px, transparent 2px),
            linear-gradient(rgba(96,165,250,.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(96,165,250,.08) 1px, transparent 1px);
          background-size: 38px 38px, 38px 38px, 38px 38px;
          animation: gamma-grid-move 18s linear infinite;
        }

        .gamma-orb {
          position: absolute;
          right: 9%;
          top: 12%;
          width: 255px;
          height: 255px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          color: rgba(191,219,254,.98);
          font-size: 118px;
          font-weight: 1000;
          background:
            radial-gradient(circle at 32% 30%, rgba(96,165,250,.5), transparent 34%),
            radial-gradient(circle at 75% 70%, rgba(250,204,21,.22), transparent 34%),
            rgba(15,23,42,.7);
          border: 1px solid rgba(147,197,253,.35);
          box-shadow:
            0 0 90px rgba(96,165,250,.24),
            inset 0 0 80px rgba(147,197,253,.14);
          animation: gamma-float 5.8s ease-in-out infinite;
        }

        .gamma-line {
          position: absolute;
          height: 3px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(96,165,250,.05), rgba(96,165,250,.92), rgba(250,204,21,.28));
          box-shadow: 0 0 26px rgba(96,165,250,.32);
          animation: gamma-line 3.1s ease-in-out infinite;
        }

        .gamma-line.l1 { right: 9%; bottom: 35%; width: 540px; transform: rotate(-10deg); }
        .gamma-line.l2 { right: 7%; bottom: 25%; width: 470px; transform: rotate(2deg); animation-delay: .25s; }
        .gamma-line.l3 { right: 10%; bottom: 16%; width: 520px; transform: rotate(10deg); animation-delay: .5s; }

        .gamma-node {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: rgba(147,197,253,.96);
          box-shadow: 0 0 18px rgba(147,197,253,.82), 0 0 36px rgba(250,204,21,.25);
          animation: gamma-pulse 2.35s ease-in-out infinite;
        }

        @keyframes gamma-grid-move {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(38px, 38px, 0); }
        }

        @keyframes gamma-float {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-4deg); }
          50% { transform: translate3d(0, -17px, 0) rotate(4deg); }
        }

        @keyframes gamma-pulse {
          0%, 100% { opacity: .34; transform: scale(.65); }
          50% { opacity: 1; transform: scale(1.35); }
        }

        @keyframes gamma-line {
          0%, 100% { opacity: .35; }
          50% { opacity: 1; }
        }
      `}</style>

      <div className="gamma-grid absolute inset-0 opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(96,165,250,0.18),transparent_31%),radial-gradient(circle_at_66%_46%,rgba(250,204,21,0.18),transparent_36%),radial-gradient(circle_at_92%_90%,rgba(34,211,238,0.12),transparent_34%)]" />
      <div className="gamma-orb">Γ</div>
      <span className="gamma-line l1" />
      <span className="gamma-line l2" />
      <span className="gamma-line l3" />
      {nodes}

      <div className="relative z-10 flex min-h-[360px] max-w-4xl flex-col justify-between">
        <div>
          <div className="inline-flex rounded-full border border-blue-300/30 bg-blue-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-blue-100">
            Phase 13 · News Sensitivity
          </div>
          <h1 className="mt-8 text-5xl font-black tracking-tight text-white md:text-7xl">
            Gamma News Sensitivity
          </h1>
          <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-blue-50/80">
            Artifact-driven context layer that joins Phase 12 news rows to
            accepted Deep ML prediction dates, then prepares model-safe
            sensitivity summaries and chart tooltip context.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Role
            </div>
            <div className="mt-2 text-sm font-black text-white">
              Context layer
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Tooltip contract
            </div>
            <div className="mt-2 text-sm font-black text-white">
              Date-level news fields
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Guardrail
            </div>
            <div className="mt-2 text-sm font-black text-white">
              Context only · no causality
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildDateContextChartRows(rows: any[]): ForecastChartRow[] {
  return rows
    .slice(-260)
    .map((row) => ({
      date: String(row.date || ""),
      split: String(row.source_type || "news_context"),
      actual: toNumber(row.article_count),
      forecast: toNumber(row.gamma_context_intensity),
      gamma_tooltip_primary_headline: firstValue(
        row.gamma_tooltip_primary_headline,
        row.top_headline_1
      ),
      gamma_tooltip_primary_source: firstValue(
        row.gamma_tooltip_primary_source,
        row.top_headline_1_source
      ),
      gamma_tooltip_note: firstValue(
        row.gamma_tooltip_note,
        row.source_coverage_note
      ),
      gamma_context_intensity: toNumber(row.gamma_context_intensity),
      gamma_context_bucket: row.gamma_context_bucket,
      source_coverage_note: row.source_coverage_note,
      top_headline_1: row.top_headline_1,
      top_headline_1_source: row.top_headline_1_source,
      gamma_recent_headlines_json: row.gamma_recent_headlines_json,
    }))
    .filter((row) => row.date && row.actual !== null && row.forecast !== null);
}

function buildModelMetricRows(sensitivity: any): MetricChartRow[] {
  const byModel = sensitivity?.by_model || {};
  const rows: MetricChartRow[] = [];

  Object.entries(byModel).forEach(([modelKey, modelPayload]: [string, any]) => {
    const byHorizon = modelPayload?.by_horizon || {};

    Object.entries(byHorizon).forEach(([horizon, horizonPayload]: [string, any]) => {
      const test = horizonPayload?.split_summary?.test;

      if (!test) return;

      rows.push({
        split: "test",
        label: `${modelLabel(modelKey)} H${horizon}`,
        model: modelLabel(modelKey),
        horizon,
        MAE: toNumber(test.mean_abs_model_error),
        BeatPct: toNumber(test.model_beats_naive_pct),
        ContextIntensity: toNumber(test.mean_gamma_context_intensity),
      });
    });
  });

  return rows;
}

function buildGlobalBucketRows(sensitivity: any): MetricChartRow[] {
  const byHorizonGlobal = sensitivity?.by_horizon_global || {};
  const rows: MetricChartRow[] = [];

  Object.entries(byHorizonGlobal).forEach(([horizon, payload]: [string, any]) => {
    const buckets = payload?.context_bucket_summary || {};

    rows.push({
      split: "global",
      horizonLabel: `H${horizon}`,
      high: toNumber(buckets.high?.mean_abs_model_error),
      medium: toNumber(buckets.medium?.mean_abs_model_error),
      low: toNumber(buckets.low?.mean_abs_model_error),
      noLoaded: toNumber(buckets.no_loaded_news_score?.mean_abs_model_error),
    });
  });

  return rows;
}

function buildModelCards(report: any) {
  const meta = report?.run_summary?.model_load_meta || {};

  return Object.entries(meta).map(([key, value]: [string, any]) => ({
    key,
    label: modelLabel(key),
    status: value?.status,
    rows: value?.output_rows,
    splitCounts: value?.split_counts || {},
    horizonCounts: value?.horizon_counts || {},
    goldColumn: value?.gold_price_source_column,
    path: value?.path,
  }));
}

function SensitivityTable({ sensitivity }: { sensitivity: any }) {
  const byModel = sensitivity?.by_model || {};
  const rows: any[] = [];

  Object.entries(byModel).forEach(([modelKey, modelPayload]: [string, any]) => {
    const byHorizon = modelPayload?.by_horizon || {};

    Object.entries(byHorizon).forEach(([horizon, horizonPayload]: [string, any]) => {
      const test = horizonPayload?.split_summary?.test;
      const corr = horizonPayload?.error_context_correlation || {};

      rows.push({
        model: modelLabel(modelKey),
        horizon,
        testRows: test?.row_count,
        testMae: test?.mean_abs_model_error,
        beatsNaive: test?.model_beats_naive_pct,
        contextIntensity: test?.mean_gamma_context_intensity,
        articleCount: test?.mean_article_count,
        netCorr: corr?.net_gold_news_sensitivity_score,
      });
    });
  });

  if (!rows.length) return null;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-[190px_90px_120px_140px_130px_145px_120px] bg-slate-50 px-5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">
        <span>Model</span>
        <span>Horizon</span>
        <span>Test rows</span>
        <span>Test MAE</span>
        <span>Beats naive</span>
        <span>Mean context</span>
        <span>Net corr.</span>
      </div>

      {rows.map((row) => (
        <div
          key={`${row.model}-${row.horizon}`}
          className="grid grid-cols-[190px_90px_120px_140px_130px_145px_120px] border-t border-slate-100 px-5 py-4 text-xs font-bold text-slate-700"
        >
          <span>{row.model}</span>
          <span>H{row.horizon}</span>
          <span>{fmtNum(row.testRows)}</span>
          <span>{fmtNum(row.testMae, 2)}</span>
          <span>{fmtPct(row.beatsNaive, 1)}</span>
          <span>{fmtNum(row.contextIntensity, 4)}</span>
          <span>{fmtNum(row.netCorr, 4)}</span>
        </div>
      ))}
    </div>
  );
}

function RecentHeadlineList({ latestContext }: { latestContext: any }) {
  const items = asArray(latestContext?.recent_headline_items).slice(0, 18);

  if (!items.length) return null;

  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div
          key={`${item.title}-${index}`}
          className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-blue-600">
              {item.source || "Source not in artifact"}
            </div>
            <div className="text-[10px] font-bold text-slate-400">
              {fmtDate(item.published_at || item.date)}
            </div>
          </div>
          <div className="mt-2 text-sm font-black leading-6 text-slate-900">
            {item.title || "Headline not in artifact"}
          </div>
          <div className="mt-2 text-xs font-semibold text-slate-500">
            {item.query_key || "query not in artifact"} ·{" "}
            {item.raw_source || "raw source not in artifact"}
          </div>
        </div>
      ))}
    </div>
  );
}

function DateContextPreview({ rows }: { rows: any[] }) {
  const preview = rows
    .slice()
    .filter((row) => Number(row.article_count || 0) > 0 || Number(row.gamma_context_intensity || 0) > 0)
    .slice(-18)
    .reverse();

  if (!preview.length) return null;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-[130px_110px_120px_120px_1fr] bg-slate-50 px-5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">
        <span>Date</span>
        <span>Articles</span>
        <span>Gold news</span>
        <span>Bucket</span>
        <span>Tooltip note / headline</span>
      </div>

      {preview.map((row, index) => (
        <div
          key={`${row.date}-${index}`}
          className="grid grid-cols-[130px_110px_120px_120px_1fr] border-t border-slate-100 px-5 py-4 text-xs font-bold text-slate-700"
        >
          <span>{fmtDate(row.date)}</span>
          <span>{fmtNum(row.article_count)}</span>
          <span>{fmtNum(row.gold_news_count)}</span>
          <span>{bucketLabel(String(row.gamma_context_bucket || ""))}</span>
          <span className="leading-5">
            {firstValue(
              row.gamma_tooltip_primary_headline,
              row.top_headline_1,
              row.gamma_tooltip_note,
              row.source_coverage_note
            ) || "Not in artifact"}
          </span>
        </div>
      ))}
    </div>
  );
}

function ModelInputCards({ report }: { report: any }) {
  const cards = buildModelCards(report);

  if (!cards.length) return null;

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.key} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-black tracking-tight text-slate-950">
              {card.label}
            </div>
            <StatusPill status={card.status} />
          </div>

          <div className="mt-5 grid gap-3">
            <InfoLine label="Rows loaded" value={fmtNum(card.rows)} />
            <InfoLine label="Gold column" value={card.goldColumn} />
            <InfoLine label="Train rows" value={fmtNum(card.splitCounts.train)} />
            <InfoLine label="Validation rows" value={fmtNum(card.splitCounts.validation)} />
            <InfoLine label="Test rows" value={fmtNum(card.splitCounts.test)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DownloadList({ results }: { results: ArtifactResult[] }) {
  return (
    <div className="grid gap-3">
      {DOWNLOADS.map((item) => {
        const matched = results.find((result) => result.path === item.path);

        return (
          <div
            key={item.path}
            className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black text-slate-900">
                  {item.label}
                </span>
                {matched ? (
                  <StatusPill status={matched.ok ? "loaded" : "missing"} />
                ) : (
                  <StatusPill status="download" />
                )}
              </div>
              <div className="mt-2 break-all text-xs font-semibold text-slate-500">
                {item.path}
              </div>
            </div>

            <DownloadButton href={publicHref(item.path)}>Download</DownloadButton>
          </div>
        );
      })}
    </div>
  );
}

export default async function GammaNewsSensitivityPage() {
  const results = await loadArtifacts();

  const report = getArtifact(results, "report");
  const runSummary = getArtifact(results, "runSummary") || report?.run_summary;
  const quality = getArtifact(results, "qualityReview") || report?.quality_review;
  const diagnostics = getArtifact(results, "diagnostics") || report?.diagnostics_snapshot;
  const pageBundle = getArtifact(results, "pageBundle");
  const latestContext = getArtifact(results, "latestContext") || report?.latest_context_snapshot;
  const tooltipContext = getArtifact(results, "tooltipContext");
  const sensitivity = getArtifact(results, "sensitivity") || report?.sensitivity_snapshot;
  const dateRows = asArray(getArtifact(results, "dateContext"));

  const loadedCount = results.filter((item) => item.ok).length;
  const latestDaily = latestContext?.latest_daily_context || {};
  const dateChartRows = buildDateContextChartRows(dateRows);
  const modelMetricRows = buildModelMetricRows(sensitivity);
  const globalBucketRows = buildGlobalBucketRows(sensitivity);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-[1800px]">
        <GammaHero />

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Gamma status"
            value={<StatusPill status={report?.status || quality?.status} />}
            note={`${loadedCount}/${ARTIFACTS.length} page artifacts loaded.`}
          />
          <MetricCard
            label="Joined model rows"
            value={fmtNum(diagnostics?.joined_rows)}
            note="Rows after joining accepted model predictions to Phase 12 news context."
          />
          <MetricCard
            label="Date context rows"
            value={fmtNum(diagnostics?.date_context_rows || tooltipContext?.date_context_row_count)}
            note="Date-level rows available for tooltip/context joins."
          />
          <MetricCard
            label="Tooltip preview rows"
            value={fmtNum(diagnostics?.model_context_preview_rows || tooltipContext?.model_context_preview_row_count)}
            note="Model-context preview rows exported for frontend inspection."
          />
        </section>

        <section className="mt-10 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader
              eyebrow="Run Summary"
              title="Gamma source-context layer"
              description={runSummary?.professor_safe_summary || report?.quality_review?.professor_safe_summary}
            />

            <div className="grid gap-3">
              <InfoLine label="Run ID" value={runSummary?.run?.run_id} />
              <InfoLine label="Generated local" value={fmtDate(runSummary?.run?.generated_at_local)} />
              <InfoLine label="Completed UTC" value={fmtDate(runSummary?.run?.completed_at_utc)} />
              <InfoLine label="Code version" value={runSummary?.run?.code_version} />
              <InfoLine label="Git commit" value={runSummary?.run?.git_commit_sha} />
              <InfoLine label="Route" value={pageBundle?.route || "/deep-ml/models/gamma-news-sensitivity"} />
            </div>
          </div>

          <div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader eyebrow="Quality Gate" title="Acceptance checks" />

            <div className="grid gap-3">
              <InfoLine label="Quality status" value={<StatusPill status={quality?.status} />} />
              <InfoLine label="Blocking flags" value={Array.isArray(quality?.blocking_flags) ? quality.blocking_flags.length : "Not in artifact"} />
              <InfoLine label="Warnings" value={Array.isArray(quality?.warnings) ? quality.warnings.length : "Not in artifact"} />
              <InfoLine label="Tooltip exists" value={String(quality?.acceptance_gate?.gamma_tooltip_context_exists)} />
              <InfoLine label="All models loaded" value={String(quality?.acceptance_gate?.all_four_model_rollforwards_loaded)} />
              <InfoLine label="No causality claims" value={String(quality?.acceptance_gate?.no_causality_claims)} />
              <InfoLine label="RSS guardrail" value={String(quality?.acceptance_gate?.rss_not_treated_as_historical_archive)} />
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Input Models"
            title="Accepted experts joined into Gamma"
            description="Gamma uses the accepted Alpha, Beta, Delta, and Epsilon prediction artifacts as inputs and joins them with Phase 12 date-level news context."
          />

          <ModelInputCards report={report} />
        </section>

        <section className="mt-14 rounded-[3rem] border border-amber-200 bg-amber-50 p-8 shadow-sm">
          <SectionHeader
            eyebrow="Professor-Safe Interpretation"
            title="Context only, not causality"
            description="These rules come directly from the Gamma grounding contract and must carry into the model tooltips, Omega, final evaluation, and the future AI interpreter."
          />

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-[2rem] border border-emerald-200 bg-white p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">
                Allowed claims
              </div>
              <div className="mt-4 grid gap-3">
                {asArray(report?.ai_grounding?.allowed_claims).map((claim: string) => (
                  <div
                    key={claim}
                    className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-900"
                  >
                    {claim}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-rose-200 bg-white p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-600">
                Forbidden claims
              </div>
              <div className="mt-4 grid gap-3">
                {asArray(report?.ai_grounding?.forbidden_claims).map((claim: string) => (
                  <div
                    key={claim}
                    className="rounded-2xl bg-rose-50 p-4 text-sm font-bold leading-6 text-rose-900"
                  >
                    {claim}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Tooltip Verification Chart"
            title="Daily news context intensity"
            description="Hover over the chart. If the UniversalModelCharts patch is active locally, the tooltip should show a News context block with headline/source/note when the row contains Gamma fields."
          />

          <ActualVsForecastChart
            rows={dateChartRows}
            actualKey="actual"
            actualLabel="Article Count"
            forecastKey="forecast"
            forecastLabel="Gamma Context Intensity"
            title="Recent Daily Loaded News Context"
            subtitle="This is a source-context chart, not a price forecast. It is included here to verify that Gamma news fields appear inside the shared chart tooltip."
            yAxisLabel="Loaded News Context Units"
            showSplitMarkers={false}
          />
        </section>

        {modelMetricRows.length > 0 ? (
          <section className="mt-14">
            <SectionHeader
              eyebrow="Model Sensitivity"
              title="Test split error and news-context summary"
              description="These values summarize model behavior under loaded Gamma context. They do not imply that news caused the errors or price changes."
            />

            <MetricComparisonChart
              rows={modelMetricRows}
              split="test"
              xKey="label"
              xLabel="Model / Horizon"
              yLabel="MAE and Beats-Naive %"
              title="Gamma Joined Model Behavior by Horizon"
              subtitle="Uses Gamma sensitivity_by_horizon.json. MAE and beats-naive percentages are displayed together for compact review."
              bars={[
                { key: "MAE", label: "Mean Absolute Error", color: "#2563eb" },
                { key: "BeatPct", label: "Beats Naive %", color: "#ca8a04" },
              ]}
            />
          </section>
        ) : null}

        {globalBucketRows.length > 0 ? (
          <section className="mt-14">
            <SectionHeader
              eyebrow="Context Buckets"
              title="Global error by loaded news-context bucket"
              description="Bucket summaries compare model error across Gamma context groups. This is descriptive sensitivity analysis only."
            />

            <MetricComparisonChart
              rows={globalBucketRows}
              split="global"
              xKey="horizonLabel"
              xLabel="Forecast Horizon"
              yLabel="Mean Absolute Error"
              title="Mean Absolute Error by Gamma Context Bucket"
              subtitle="Uses by_horizon_global.context_bucket_summary from gamma_sensitivity_by_horizon.json."
              bars={[
                { key: "high", label: "High Context", color: "#2563eb" },
                { key: "medium", label: "Medium Context", color: "#ca8a04" },
                { key: "low", label: "Low Context", color: "#16a34a" },
                { key: "noLoaded", label: "No Loaded Score", color: "#64748b" },
              ]}
            />
          </section>
        ) : null}

        <section className="mt-14">
          <SectionHeader
            eyebrow="Sensitivity Table"
            title="Model-horizon sensitivity diagnostics"
            description="This table is artifact-driven from gamma_sensitivity_by_horizon.json. Correlation values describe co-movement only, not causal relationships."
          />

          <SensitivityTable sensitivity={sensitivity} />
        </section>

        <section className="mt-14 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader
              eyebrow="Latest Context"
              title="Most recent Gamma date row"
              description="Latest date-level news context exported by Gamma."
            />

            <div className="grid gap-3">
              <InfoLine label="Date" value={fmtDate(latestDaily.date)} />
              <InfoLine label="Article count" value={fmtNum(latestDaily.article_count)} />
              <InfoLine label="Gold news count" value={fmtNum(latestDaily.gold_news_count)} />
              <InfoLine label="Context bucket" value={latestDaily.gamma_context_bucket} />
              <InfoLine label="Context intensity" value={fmtNum(latestDaily.gamma_context_intensity, 3)} />
              <InfoLine label="Top source" value={latestDaily.top_headline_1_source} />
              <InfoLine label="Source type" value={latestDaily.source_type} />
              <InfoLine label="Coverage note" value={latestDaily.source_coverage_note} />
            </div>
          </div>

          <div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader
              eyebrow="Recent Headlines"
              title="Latest headline inventory"
              description="Recent headlines are context/tooltips only and should not be presented as causal drivers."
            />

            <RecentHeadlineList latestContext={latestContext} />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Date Context Preview"
            title="Recent rows with loaded news context"
            description="These are the latest Gamma date rows with article counts or non-zero context intensity."
          />

          <DateContextPreview rows={dateRows} />
        </section>

        <section className="mt-14 rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
          <SectionHeader
            eyebrow="Frontend Contract"
            title="Gamma tooltip join contract"
            description="This contract tells the future model-page patch which fields to add to chart rows so Alpha, Beta, Delta, Epsilon, Omega, and Final Deep ML pages can show news context in tooltips."
          />

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                Join rule
              </div>
              <div className="mt-4 grid gap-3">
                <InfoLine label="Preferred join key" value={pageBundle?.frontend_patch_contract?.preferred_join_key || tooltipContext?.primary_frontend_join?.preferred_join_key} />
                <InfoLine label="Date context source" value={tooltipContext?.primary_frontend_join?.date_context_source} />
                <InfoLine label="Full joined source" value={tooltipContext?.primary_frontend_join?.full_joined_context_source} />
                <InfoLine label="Date context rows" value={fmtNum(tooltipContext?.date_context_row_count)} />
                <InfoLine label="Preview rows" value={fmtNum(tooltipContext?.model_context_preview_row_count)} />
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                Chart row fields to add
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {asArray(pageBundle?.frontend_patch_contract?.chart_row_fields_to_add).map((field: string) => (
                  <span
                    key={field}
                    className="rounded-full border border-blue-100 bg-white px-3 py-2 text-[10px] font-black text-blue-700"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
          <SectionHeader
            eyebrow="Artifact Downloads"
            title="Gamma files used by this page"
            description="The page reads only Gamma JSON/CSV artifacts. The large joined CSV is available as a download but is not parsed for the main page charts."
          />

          <DownloadList results={results} />
        </section>
      </div>
    </main>
  );
}