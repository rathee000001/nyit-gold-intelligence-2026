import type { ReactNode } from "react";
import { promises as fs } from "fs";
import path from "path";
import {
  ActualVsForecastChart,
  ResidualChart,
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
    label: "Omega Phase 14 Report",
    path: "artifacts/deep_ml/models/omega_fusion/phase14_omega_fusion_report.json",
    kind: "json",
  },
  {
    key: "runSummary",
    label: "Run Summary",
    path: "artifacts/deep_ml/models/omega_fusion/run_summary.json",
    kind: "json",
  },
  {
    key: "qualityReview",
    label: "Quality Review",
    path: "artifacts/deep_ml/models/omega_fusion/quality_review.json",
    kind: "json",
  },
  {
    key: "diagnostics",
    label: "Diagnostics Latest",
    path: "artifacts/deep_ml/models/omega_fusion/diagnostics_latest.json",
    kind: "json",
  },
  {
    key: "ranking",
    label: "Omega Model Ranking",
    path: "artifacts/deep_ml/models/omega_fusion/omega_model_ranking.json",
    kind: "json",
  },
  {
    key: "weights",
    label: "Omega Weights by Horizon",
    path: "artifacts/deep_ml/models/omega_fusion/omega_weights_by_horizon.json",
    kind: "json",
  },
  {
    key: "evaluation",
    label: "Omega Evaluation by Horizon",
    path: "artifacts/deep_ml/models/omega_fusion/omega_evaluation_by_horizon.json",
    kind: "json",
  },
  {
    key: "forecastLatest",
    label: "Omega Forecast Latest",
    path: "artifacts/deep_ml/models/omega_fusion/omega_forecast_latest.json",
    kind: "json",
  },
  {
    key: "pageBundle",
    label: "Omega Page Bundle",
    path: "artifacts/deep_ml/models/omega_fusion/page_bundle.json",
    kind: "json",
  },
  {
    key: "rollforward",
    label: "Omega Rollforward",
    path: "artifacts/deep_ml/models/omega_fusion/omega_rollforward.csv",
    kind: "csv",
  },
  {
    key: "forecastPoints",
    label: "Omega Forecast Points",
    path: "artifacts/deep_ml/models/omega_fusion/omega_forecast_points.csv",
    kind: "csv",
  },
  {
    key: "gammaDateContext",
    label: "Gamma Date Context",
    path: "artifacts/deep_ml/models/gamma_news_sensitivity/gamma_date_context.csv",
    kind: "csv",
  },
];

const DOWNLOADS = [
  {
    label: "Phase 14 Omega Report",
    path: "artifacts/deep_ml/models/omega_fusion/phase14_omega_fusion_report.json",
  },
  {
    label: "Omega Rollforward CSV",
    path: "artifacts/deep_ml/models/omega_fusion/omega_rollforward.csv",
  },
  {
    label: "Omega Latest Forecast JSON",
    path: "artifacts/deep_ml/models/omega_fusion/omega_forecast_latest.json",
  },
  {
    label: "Omega Forecast Points CSV",
    path: "artifacts/deep_ml/models/omega_fusion/omega_forecast_points.csv",
  },
  {
    label: "Omega Evaluation by Horizon JSON",
    path: "artifacts/deep_ml/models/omega_fusion/omega_evaluation_by_horizon.json",
  },
  {
    label: "Omega Weights by Horizon JSON",
    path: "artifacts/deep_ml/models/omega_fusion/omega_weights_by_horizon.json",
  },
  {
    label: "Omega Model Ranking JSON",
    path: "artifacts/deep_ml/models/omega_fusion/omega_model_ranking.json",
  },
  {
    label: "Omega Page Bundle",
    path: "artifacts/deep_ml/models/omega_fusion/page_bundle.json",
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
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
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

function toNumber(value: any) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function firstValue(...values: any[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return null;
}

function fmtNum(value: any, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";

  return numeric.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function fmtInt(value: any) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";
  return numeric.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtPct(value: any, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";

  return `${numeric.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}%`;
}

function fmtMoney(value: any, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";

  return `$${numeric.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}`;
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
    omega_fusion: "Omega Fusion",
  };

  return labels[value] || value;
}

function statusClass(status: any) {
  const text = String(status || "").toLowerCase();

  if (text.includes("ready") || text.includes("pass") || text.includes("loaded")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (text.includes("warning") || text.includes("review")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (text.includes("fail") || text.includes("block") || text.includes("missing")) {
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
    <div className="grid grid-cols-1 gap-1 border-b border-slate-100 pb-3 last:border-b-0 xl:grid-cols-[150px_minmax(0,1fr)] xl:gap-3">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <span className="min-w-0 break-words text-sm font-bold leading-6 text-slate-700">
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
      gamma_tooltip_primary_headline:
        row.gamma_tooltip_primary_headline || row.top_headline_1 || "",
      gamma_tooltip_primary_source:
        row.gamma_tooltip_primary_source || row.top_headline_1_source || "",
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

function getGammaContextForDate(gammaLookup: GammaDateContextLookup, dateValue: any) {
  const date = normalizeChartDate(dateValue);
  if (!date) return {};
  return gammaLookup[date] || {};
}

function OmegaHero() {
  const particles = Array.from({ length: 52 }, (_, index) => {
    const left = 4 + ((index * 37) % 92);
    const top = 8 + ((index * 53) % 78);

    return (
      <span
        key={index}
        className="omega-particle"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          animationDelay: `${index * 0.09}s`,
        }}
      />
    );
  });

  const rings = Array.from({ length: 4 }, (_, index) => (
    <span key={index} className={`omega-ring omega-ring-${index + 1}`} />
  ));

  return (
    <div className="relative min-h-[460px] overflow-hidden rounded-[3rem] border border-slate-200 bg-slate-950 p-8 shadow-2xl shadow-blue-950/20">
      <style>{`
        .omega-grid {
          background-image:
            radial-gradient(circle at center, rgba(147,197,253,.25) 0, rgba(147,197,253,.14) 1px, transparent 2px),
            linear-gradient(rgba(96,165,250,.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(96,165,250,.08) 1px, transparent 1px);
          background-size: 42px 42px, 42px 42px, 42px 42px;
          animation: omega-grid-move 22s linear infinite;
        }

        .omega-core {
          position: absolute;
          right: 7%;
          top: 8%;
          width: 310px;
          height: 310px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          font-size: 132px;
          font-weight: 1000;
          color: rgba(255,255,255,.96);
          background:
            radial-gradient(circle at 32% 28%, rgba(250,204,21,.42), transparent 31%),
            radial-gradient(circle at 76% 68%, rgba(59,130,246,.50), transparent 34%),
            radial-gradient(circle at 50% 50%, rgba(15,23,42,.95), rgba(15,23,42,.56));
          border: 1px solid rgba(147,197,253,.36);
          box-shadow:
            0 0 100px rgba(59,130,246,.34),
            0 0 140px rgba(250,204,21,.16),
            inset 0 0 90px rgba(147,197,253,.16);
          animation: omega-core-float 6.2s ease-in-out infinite;
        }

        .omega-ring {
          position: absolute;
          right: calc(7% + 155px);
          top: calc(8% + 155px);
          border-radius: 999px;
          border: 1px solid rgba(147,197,253,.26);
          transform-style: preserve-3d;
          box-shadow: 0 0 42px rgba(59,130,246,.14);
        }

        .omega-ring-1 {
          width: 440px;
          height: 160px;
          margin-right: -220px;
          margin-top: -80px;
          animation: omega-ring-spin-a 10s linear infinite;
        }

        .omega-ring-2 {
          width: 460px;
          height: 180px;
          margin-right: -230px;
          margin-top: -90px;
          border-color: rgba(250,204,21,.25);
          animation: omega-ring-spin-b 13s linear infinite reverse;
        }

        .omega-ring-3 {
          width: 360px;
          height: 130px;
          margin-right: -180px;
          margin-top: -65px;
          border-color: rgba(34,211,238,.25);
          animation: omega-ring-spin-c 8.5s linear infinite;
        }

        .omega-ring-4 {
          width: 520px;
          height: 210px;
          margin-right: -260px;
          margin-top: -105px;
          border-color: rgba(168,85,247,.22);
          animation: omega-ring-spin-d 16s linear infinite reverse;
        }

        .omega-beam {
          position: absolute;
          height: 3px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(59,130,246,.02), rgba(59,130,246,.92), rgba(250,204,21,.45), rgba(34,211,238,.2));
          box-shadow: 0 0 32px rgba(59,130,246,.32);
          transform-origin: right center;
          animation: omega-beam-pulse 3.2s ease-in-out infinite;
        }

        .omega-beam.b1 { right: 22%; bottom: 37%; width: 680px; transform: rotate(-10deg); }
        .omega-beam.b2 { right: 19%; bottom: 28%; width: 610px; transform: rotate(1deg); animation-delay: .22s; }
        .omega-beam.b3 { right: 23%; bottom: 19%; width: 640px; transform: rotate(11deg); animation-delay: .44s; }
        .omega-beam.b4 { right: 31%; top: 23%; width: 420px; transform: rotate(24deg); animation-delay: .66s; }

        .omega-particle {
          position: absolute;
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: rgba(250,204,21,.98);
          box-shadow: 0 0 18px rgba(250,204,21,.82), 0 0 34px rgba(96,165,250,.35);
          animation: omega-particle-pulse 2.4s ease-in-out infinite;
        }

        @keyframes omega-grid-move {
          from { transform: translate3d(0,0,0); }
          to { transform: translate3d(42px,42px,0); }
        }

        @keyframes omega-core-float {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-4deg) scale(1); }
          50% { transform: translate3d(0, -18px, 0) rotate(4deg) scale(1.025); }
        }

        @keyframes omega-ring-spin-a {
          from { transform: rotateX(62deg) rotateZ(0deg); }
          to { transform: rotateX(62deg) rotateZ(360deg); }
        }

        @keyframes omega-ring-spin-b {
          from { transform: rotateX(72deg) rotateY(18deg) rotateZ(0deg); }
          to { transform: rotateX(72deg) rotateY(18deg) rotateZ(360deg); }
        }

        @keyframes omega-ring-spin-c {
          from { transform: rotateX(52deg) rotateY(-25deg) rotateZ(0deg); }
          to { transform: rotateX(52deg) rotateY(-25deg) rotateZ(360deg); }
        }

        @keyframes omega-ring-spin-d {
          from { transform: rotateX(77deg) rotateY(38deg) rotateZ(0deg); }
          to { transform: rotateX(77deg) rotateY(38deg) rotateZ(360deg); }
        }

        @keyframes omega-beam-pulse {
          0%, 100% { opacity: .28; transform-origin: right center; }
          50% { opacity: 1; }
        }

        @keyframes omega-particle-pulse {
          0%, 100% { opacity: .32; transform: scale(.65); }
          50% { opacity: 1; transform: scale(1.45); }
        }
      `}</style>

      <div className="omega-grid absolute inset-0 opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(96,165,250,0.22),transparent_31%),radial-gradient(circle_at_76%_38%,rgba(250,204,21,0.19),transparent_34%),radial-gradient(circle_at_92%_90%,rgba(34,211,238,0.12),transparent_34%)]" />

      <span className="omega-beam b1" />
      <span className="omega-beam b2" />
      <span className="omega-beam b3" />
      <span className="omega-beam b4" />
      {rings}
      <div className="omega-core">Ω</div>
      {particles}

      <div className="relative z-10 flex min-h-[390px] max-w-4xl flex-col justify-between">
        <div>
          <div className="inline-flex rounded-full border border-yellow-300/30 bg-yellow-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-yellow-200">
            Phase 14 · Deep ML Fusion
          </div>

          <h1 className="mt-8 text-5xl font-black tracking-tight text-white md:text-7xl">
            Omega Fusion
          </h1>

          <p className="mt-5 max-w-3xl text-sm font-semibold leading-7 text-blue-50/80">
            Artifact-level fusion candidate that combines Alpha, Beta, Delta,
            and Epsilon using transparent validation-performance weights by
            forecast horizon.
          </p>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Components
            </div>
            <div className="mt-2 text-sm font-black text-white">
              Alpha · Beta · Delta · Epsilon
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Weight basis
            </div>
            <div className="mt-2 text-sm font-black text-white">
              Validation MAPE by horizon
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Gamma
            </div>
            <div className="mt-2 text-sm font-black text-white">
              Context only · no training input
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildSplitRows(
  rows: any[],
  horizon = 10,
  gammaLookup: GammaDateContextLookup = {}
): ForecastChartRow[] {
  return rows
    .filter((row) => Number(row.horizon) === horizon)
    .map((row) => ({
      date: String(row.date),
      ...getGammaContextForDate(gammaLookup, row.date),
      split: String(row.split || "test"),
      actual: toNumber(row.actual_target),
      forecast: toNumber(row.prediction),
      naiveForecast: toNumber(row.naive_prediction),
      lower: firstValue(row.omega_p10_weighted, row.omega_p10_component_min),
      upper: firstValue(row.omega_p90_weighted, row.omega_p90_component_max),
    }))
    .filter((row) => row.date && row.actual !== null && row.forecast !== null);
}

function buildForecastPathRows(forecastLatest: any): ForecastChartRow[] {
  return asArray(forecastLatest?.path)
    .map((row) => ({
      date: String(row.forecast_date || `H${row.horizon}`),
      split: "omega_forecast",
      actual: toNumber(row.origin_gold_price),
      forecast: toNumber(row.omega_p50_weighted),
      lower: toNumber(row.omega_p10_weighted),
      upper: toNumber(row.omega_p90_weighted),
      horizon: row.horizon,
    }))
    .filter((row) => row.date && row.actual !== null && row.forecast !== null);
}

function buildWeightRows(weights: any): MetricChartRow[] {
  const byHorizon = weights?.weights_by_horizon || {};
  const rows: MetricChartRow[] = [];

  Object.entries(byHorizon).forEach(([horizon, payload]: [string, any]) => {
    rows.push({
      split: "weights",
      horizonLabel: `H${horizon}`,
      Alpha: toNumber(payload.alpha_structural) ? Number(payload.alpha_structural) * 100 : null,
      Beta: toNumber(payload.beta_temporal) ? Number(payload.beta_temporal) * 100 : null,
      Delta: toNumber(payload.delta_tft) ? Number(payload.delta_tft) * 100 : null,
      Epsilon: toNumber(payload.epsilon_expert_ensemble)
        ? Number(payload.epsilon_expert_ensemble) * 100
        : null,
    });
  });

  return rows;
}

function buildOmegaMetricRows(evaluation: any, split: "validation" | "test") {
  const metrics = evaluation?.metrics_by_horizon || {};
  const naive = evaluation?.naive_baseline_by_horizon || {};
  const improvement = evaluation?.improvement_vs_naive_by_horizon || {};

  return Object.entries(metrics).map(([horizon, payload]: [string, any]) => {
    const modelRow = payload?.[split] || {};
    const naiveRow = naive?.[horizon]?.[split] || {};
    const improvementRow = improvement?.[horizon]?.[split] || {};

    return {
      split,
      horizonLabel: `H${horizon}`,
      MAE: toNumber(modelRow.mae),
      NaiveMAE: toNumber(naiveRow.mae),
      MAPE: toNumber(modelRow.mape_pct),
      NaiveMAPE: toNumber(naiveRow.mape_pct),
      ImprovementMAE: toNumber(improvementRow.mae_improvement_pct_vs_naive),
      DirectionalAccuracy: toNumber(modelRow.directional_accuracy_pct),
    };
  });
}

function buildRankingTableRows(ranking: any) {
  return asArray(ranking?.ranking).map((row: any) => ({
    rank: row.rank,
    horizon: row.horizon,
    model: row.display_name || modelLabel(row.model_key),
    scoreBasis: row.score_basis,
    score: row.weight_basis_score,
    weight: row.omega_weight,
    validationMape: row.validation_mape_pct,
    testMape: row.test_mape_pct,
    validationMae: row.validation_mae,
    testMae: row.test_mae,
  }));
}

function ForecastCards({ forecastLatest }: { forecastLatest: any }) {
  const rows = asArray(forecastLatest?.path);

  if (!rows.length) return null;

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
      {rows.map((row: any) => {
        const expected = toNumber(row.expected_change);
        const positive = expected !== null && expected >= 0;

        return (
          <div
            key={row.horizon}
            className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                  Horizon
                </div>
                <div className="mt-2 text-3xl font-black text-slate-950">
                  H{row.horizon}
                </div>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                  positive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {positive ? "Up" : "Down"}
              </span>
            </div>

            <div className="mt-5 grid gap-3">
              <InfoLine label="Forecast date" value={fmtDate(row.forecast_date)} />
              <InfoLine label="P50" value={fmtMoney(row.omega_p50_weighted)} />
              <InfoLine label="P10" value={fmtMoney(row.omega_p10_weighted)} />
              <InfoLine label="P90" value={fmtMoney(row.omega_p90_weighted)} />
              <InfoLine label="Expected change" value={fmtMoney(row.expected_change)} />
              <InfoLine label="Expected %" value={fmtPct(row.expected_change_pct)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RankingTable({ rows }: { rows: any[] }) {
  if (!rows.length) return null;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-[70px_90px_190px_170px_130px_120px_130px_130px] bg-slate-50 px-5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">
        <span>Rank</span>
        <span>Horizon</span>
        <span>Model</span>
        <span>Basis</span>
        <span>Val MAPE</span>
        <span>Weight</span>
        <span>Test MAPE</span>
        <span>Test MAE</span>
      </div>

      {rows.map((row, index) => (
        <div
          key={`${row.horizon}-${row.model}-${index}`}
          className="grid grid-cols-[70px_90px_190px_170px_130px_120px_130px_130px] border-t border-slate-100 px-5 py-4 text-xs font-bold text-slate-700"
        >
          <span>{row.rank}</span>
          <span>H{row.horizon}</span>
          <span>{row.model}</span>
          <span>{row.scoreBasis}</span>
          <span>{fmtPct(row.validationMape)}</span>
          <span>{fmtPct(Number(row.weight || 0) * 100)}</span>
          <span>{fmtPct(row.testMape)}</span>
          <span>{fmtMoney(row.testMae)}</span>
        </div>
      ))}
    </div>
  );
}

function GuardrailPanel({ report }: { report: any }) {
  const allowed = asArray(report?.ai_grounding?.allowed_claims);
  const forbidden = asArray(report?.ai_grounding?.forbidden_claims);

  return (
    <section className="mt-14 rounded-[3rem] border border-amber-200 bg-amber-50 p-8 shadow-sm">
      <SectionHeader
        eyebrow="Professor-Safe Guardrails"
        title="How Omega should be explained"
        description="Omega is a candidate fusion layer. These claims come from the exported report grounding contract."
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-emerald-200 bg-white p-6">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">
            Allowed claims
          </div>
          <div className="mt-4 grid gap-3">
            {allowed.map((claim: string) => (
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
            {forbidden.map((claim: string) => (
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
  );
}

function ComponentSnapshots({ report }: { report: any }) {
  const snapshots = report?.component_model_report_snapshots || {};
  const rows = Object.entries(snapshots);

  if (!rows.length) return null;

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {rows.map(([modelKey, payload]: [string, any]) => (
        <div key={modelKey} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="text-lg font-black tracking-tight text-slate-950">
              {payload.display_name || modelLabel(modelKey)}
            </div>
            <StatusPill status={payload.status} />
          </div>

          <div className="mt-5 grid gap-3">
            <InfoLine label="Family" value={payload.family} />
            <InfoLine label="Algorithm" value={payload.algorithm} />
            <InfoLine label="Target" value={payload.target_strategy} />
            <InfoLine label="Features" value={fmtInt(payload.used_feature_count)} />
            <InfoLine label="Data through" value={fmtDate(payload.effective_data_through_date)} />
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

export default async function OmegaFusionPage() {
  const results = await loadArtifacts();

  const report = getArtifact(results, "report");
  const runSummary = getArtifact(results, "runSummary") || report?.run_summary;
  const quality = getArtifact(results, "qualityReview") || report?.quality_review;
  const diagnostics = getArtifact(results, "diagnostics") || report?.diagnostics_snapshot;
  const ranking = getArtifact(results, "ranking") || report?.model_ranking_snapshot;
  const weights = getArtifact(results, "weights") || ranking;
  const evaluation = getArtifact(results, "evaluation") || report?.omega_evaluation_snapshot;
  const forecastLatest = getArtifact(results, "forecastLatest") || report?.omega_forecast_latest_snapshot;
  const pageBundle = getArtifact(results, "pageBundle");
  const rollforward = asArray(getArtifact(results, "rollforward"));
  const gammaRows = asArray(getArtifact(results, "gammaDateContext"));

  const gammaLookup = buildGammaDateContextLookup(gammaRows);
  const selectedHorizon = 10;

  const loadedCount = results.filter((item) => item.ok).length;
  const splitRows = buildSplitRows(rollforward, selectedHorizon, gammaLookup);
  const forecastPathRows = buildForecastPathRows(forecastLatest);
  const weightRows = buildWeightRows(weights);
  const validationRows = buildOmegaMetricRows(evaluation, "validation");
  const testRows = buildOmegaMetricRows(evaluation, "test");
  const rankingRows = buildRankingTableRows(ranking);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-[1800px]">
        <OmegaHero />

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Omega status"
            value={<StatusPill status={report?.status || quality?.status} />}
            note={`${loadedCount}/${ARTIFACTS.length} page artifacts loaded.`}
          />
          <MetricCard
            label="Rollforward rows"
            value={fmtInt(diagnostics?.omega_rollforward_rows)}
            note="Fused train, validation, and test rows exported by Omega."
          />
          <MetricCard
            label="Forecast points"
            value={fmtInt(diagnostics?.omega_forecast_points)}
            note="Latest forecast path horizons exported by Omega."
          />
          <MetricCard
            label="Gamma training input"
            value={String(quality?.acceptance_gate?.news_used_as_training_input)}
            note="This should remain false. Gamma is context only."
          />
        </section>

        <section className="mt-10 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader
              eyebrow="Run Summary"
              title="Validation-weighted artifact fusion"
              description={runSummary?.professor_safe_summary}
            />

            <div className="grid gap-3">
              <InfoLine label="Run ID" value={runSummary?.run?.run_id} />
              <InfoLine label="Generated local" value={fmtDate(runSummary?.run?.generated_at_local)} />
              <InfoLine label="Completed UTC" value={fmtDate(runSummary?.run?.completed_at_utc)} />
              <InfoLine label="Code version" value={runSummary?.run?.code_version} />
              <InfoLine label="Git commit" value={runSummary?.run?.git_commit_sha} />
              <InfoLine label="Route" value={pageBundle?.route || "/deep-ml/models/omega-fusion"} />
            </div>
          </div>

          <div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader eyebrow="Quality Gate" title="Acceptance checks" />

            <div className="grid gap-3">
              <InfoLine label="Quality status" value={<StatusPill status={quality?.status} />} />
              <InfoLine label="Blocking flags" value={Array.isArray(quality?.blocking_flags) ? quality.blocking_flags.length : "Not in artifact"} />
              <InfoLine label="Warnings" value={Array.isArray(quality?.warnings) ? quality.warnings.length : "Not in artifact"} />
              <InfoLine label="Weights use validation" value={String(quality?.acceptance_gate?.weights_use_validation_metrics)} />
              <InfoLine label="Gamma context only" value={String(quality?.acceptance_gate?.gamma_used_as_context_only)} />
              <InfoLine label="No news training input" value={String(quality?.acceptance_gate?.news_used_as_training_input === false)} />
              <InfoLine label="Test not primary weight" value={String(quality?.acceptance_gate?.test_metrics_reported_not_used_as_primary_weight_basis)} />
            </div>
          </div>
        </section>


        <section className="mt-14 rounded-[3rem] border border-blue-200 bg-blue-50 p-8 shadow-sm">
          <SectionHeader
            eyebrow="Gamma Governance"
            title="Why Gamma is not used as Omega training input"
            description="Gamma is valuable for interpretation, tooltip context, and later sensitivity review, but Omega keeps it outside the forecast-weighting logic to avoid leakage, overfitting, and incomplete historical news-coverage bias."
          />

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[2rem] border border-blue-100 bg-white p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">
                Artifact rule
              </div>

              <div className="mt-5 grid gap-3">
                <InfoLine
                  label="Gamma usage"
                  value={
                    report?.gamma_snapshot?.usage_in_omega ||
                    "interpretive_context_only_not_weight_or_training_feature"
                  }
                />
                <InfoLine
                  label="Gamma context only"
                  value={String(quality?.acceptance_gate?.gamma_used_as_context_only)}
                />
                <InfoLine
                  label="News training input"
                  value={String(quality?.acceptance_gate?.news_used_as_training_input)}
                />
                <InfoLine
                  label="Weight basis"
                  value={runSummary?.fusion_policy?.primary_weight_metric}
                />
              </div>
            </div>

            <div className="rounded-[2rem] border border-blue-100 bg-white p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">
                Website interpretation
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-900">
                  Use Gamma to explain what news/context was present around a forecast date.
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
                  Do not say Gamma caused the forecast or gold-price movement.
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-700">
                  Final Deep ML evaluation can later compare Omega behavior across Gamma context buckets without changing the model training rule.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Component Experts"
            title="Inputs fused by Omega"
            description="Omega reads the already-created expert artifacts. It does not retrain the component models."
          />

          <ComponentSnapshots report={report} />
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Latest Forecast"
            title="Omega forecast path"
            description="Omega combines component forecast points using horizon-specific validation weights."
          />

          <ForecastCards forecastLatest={forecastLatest} />
        </section>

        {forecastPathRows.length > 0 ? (
          <section className="mt-14">
            <SectionHeader
              eyebrow="Forecast Path Chart"
              title="Origin price vs Omega forecast path"
              description="The origin value is repeated only as a visual anchor. Forecast values come from omega_forecast_latest.json."
            />

            <ActualVsForecastChart
              rows={forecastPathRows}
              actualKey="actual"
              actualLabel="Origin Gold Price"
              forecastKey="forecast"
              forecastLabel="Omega P50 Forecast"
              title="Omega Latest Forecast Path"
              subtitle="Horizon path from the latest Omega forecast artifact."
              yAxisLabel="Gold Price (USD/oz)"
              showSplitMarkers={false}
              showMarketShockPeriods={false}
            />
          </section>
        ) : null}

        <section className="mt-14">
          <SectionHeader
            eyebrow="Omega Rollforward"
            title={`Actual vs Omega forecast · H${selectedHorizon}`}
            description="This chart uses the same train / validation / test split structure as the component pages. Gamma context may appear in tooltips only as post-model interpretation."
          />

          <ActualVsForecastChart
            rows={splitRows}
            actualKey="actual"
            actualLabel="Actual Target"
            forecastKey="forecast"
            forecastLabel="Omega Fused Forecast"
            title={`Omega Actual vs Forecast · Horizon ${selectedHorizon}`}
            subtitle="Uses omega_rollforward.csv. The forecast is the validation-weighted fusion of component predictions."
            yAxisLabel="Gold Price (USD/oz)"
          />
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Residual Diagnostics"
            title={`Omega residuals · H${selectedHorizon}`}
            description="Residuals are actual minus Omega forecast. This is a diagnostic view, not a claim of future guarantee."
          />

          <ResidualChart
            rows={splitRows}
            forecastKey="forecast"
            forecastLabel="Omega Fused Forecast"
            actualKey="actual"
            title={`Omega Residuals · Horizon ${selectedHorizon}`}
            subtitle="Residual = actual target minus Omega fused forecast."
            yAxisLabel="Actual - Omega Forecast"
          />
        </section>

        {weightRows.length > 0 ? (
          <section className="mt-14">
            <SectionHeader
              eyebrow="Fusion Weights"
              title="Component weights by horizon"
              description="Weights are created from validation metrics by horizon. They are not feature importance and not causal importance."
            />

            <MetricComparisonChart
              rows={weightRows}
              split="weights"
              xKey="horizonLabel"
              xLabel="Forecast Horizon"
              yLabel="Weight (%)"
              title="Omega Component Weights"
              subtitle="Horizon-specific validation-performance weights."
              bars={[
                { key: "Alpha", label: "Alpha Structural", color: "#2563eb" },
                { key: "Beta", label: "Beta Temporal", color: "#7c3aed" },
                { key: "Delta", label: "Delta TFT", color: "#ca8a04" },
                { key: "Epsilon", label: "Epsilon Ensemble", color: "#16a34a" },
              ]}
            />
          </section>
        ) : null}

        {validationRows.length > 0 ? (
          <section className="mt-14">
            <SectionHeader
              eyebrow="Validation Metrics"
              title="Omega vs naive baseline · validation"
              description="Validation metrics are the primary basis for Omega weights when available."
            />

            <MetricComparisonChart
              rows={validationRows}
              split="validation"
              xKey="horizonLabel"
              xLabel="Forecast Horizon"
              yLabel="MAE"
              title="Validation MAE: Omega vs Naive"
              subtitle="Lower MAE is better. This chart uses omega_evaluation_by_horizon.json."
              bars={[
                { key: "MAE", label: "Omega MAE", color: "#2563eb" },
                { key: "NaiveMAE", label: "Naive MAE", color: "#ca8a04" },
              ]}
            />
          </section>
        ) : null}

        {testRows.length > 0 ? (
          <section className="mt-14">
            <SectionHeader
              eyebrow="Test Metrics"
              title="Omega vs naive baseline · test"
              description="Test metrics are reported for review. The report states they are not the primary weighting basis when validation metrics exist."
            />

            <MetricComparisonChart
              rows={testRows}
              split="test"
              xKey="horizonLabel"
              xLabel="Forecast Horizon"
              yLabel="MAE"
              title="Test MAE: Omega vs Naive"
              subtitle="Lower MAE is better. Test metrics are review diagnostics, not the primary weight basis."
              bars={[
                { key: "MAE", label: "Omega MAE", color: "#2563eb" },
                { key: "NaiveMAE", label: "Naive MAE", color: "#ca8a04" },
              ]}
            />
          </section>
        ) : null}

        <section className="mt-14">
          <SectionHeader
            eyebrow="Ranking Table"
            title="Model ranking and weights by horizon"
            description="This table is directly artifact-driven from omega_model_ranking.json."
          />

          <RankingTable rows={rankingRows} />
        </section>

        <GuardrailPanel report={report} />

        <section className="mt-14 rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
          <SectionHeader
            eyebrow="Frontend Contract"
            title="Files used by this page"
            description="This page is JSON/CSV-first. It reads Omega artifacts and Gamma tooltip context, but does not hardcode model claims."
          />

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                Chart artifacts
              </div>

              <div className="mt-4 grid gap-3">
                {Object.entries(pageBundle?.chart_artifacts || {}).map(([key, value]) => (
                  <InfoLine key={key} label={key} value={String(value)} />
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                Frontend policy
              </div>

              <div className="mt-4 grid gap-3">
                <InfoLine label="JSON first" value={String(pageBundle?.frontend_policy?.use_json_first)} />
                <InfoLine label="Hardcode layout only" value={String(pageBundle?.frontend_policy?.hardcode_layout_only)} />
                <InfoLine label="Do not claim winner yet" value={String(pageBundle?.frontend_policy?.do_not_claim_winner_until_final_deep_ml_evaluation)} />
                <InfoLine label="Gamma context" value={pageBundle?.frontend_policy?.gamma_news_context} />
                <InfoLine label="News training input" value={String(pageBundle?.frontend_policy?.news_used_as_training_input)} />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
          <SectionHeader
            eyebrow="Artifact Downloads"
            title="Omega files"
            description="These are the exported files used by this page and later by the final Deep ML evaluation."
          />

          <DownloadList results={results} />
        </section>
      </div>
    </main>
  );
}