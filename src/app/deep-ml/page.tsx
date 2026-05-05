import type { ReactNode } from "react";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ArtifactRequest = {
  key: string;
  label: string;
  path: string;
};

type ArtifactResult = ArtifactRequest & {
  url: string;
  ok: boolean;
  data: any | null;
  error?: string;
};

type ModuleConfig = {
  key: string;
  label: string;
  shortLabel: string;
  path: string;
  route: string;
};

const PAGE_ARTIFACTS: ArtifactRequest[] = [
  {
    key: "modeStatus",
    label: "Deep ML Mode Status",
    path: "artifacts/deep_ml/governance/deep_ml_mode_status.json",
  },
  {
    key: "studyContext",
    label: "Study Context",
    path: "artifacts/deep_ml/governance/study_context.json",
  },
  {
    key: "matrixManifest",
    label: "Numeric Feature Store Manifest",
    path: "artifacts/deep_ml/features/deep_ml_numeric_feature_store_manifest.json",
  },
  {
    key: "factorState",
    label: "Factor State Table",
    path: "artifacts/deep_ml/data/factor_state_table.json",
  },
  {
    key: "alphaReport",
    label: "Alpha Structural Report",
    path: "artifacts/deep_ml/models/alpha_structural/phase6_alpha_structural_report.json",
  },
  {
    key: "betaReport",
    label: "Beta Temporal Report",
    path: "artifacts/deep_ml/models/beta_temporal/phase7_beta_temporal_report.json",
  },
  {
    key: "deltaReport",
    label: "Delta TFT Report",
    path: "artifacts/deep_ml/models/delta_tft/phase8_delta_tft_report.json",
  },
  {
    key: "epsilonReport",
    label: "Epsilon Expert Ensemble Report",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/phase9_epsilon_expert_report.json",
  },
  {
    key: "phase10Report",
    label: "Phase 10 Source Update Report",
    path: "artifacts/deep_ml/source_update/phase10_source_update_refresh_report.json",
  },
  {
    key: "phase11Report",
    label: "Phase 11 Feature Refresh Report",
    path: "artifacts/deep_ml/feature_refresh/phase11_governed_feature_store_refresh_report.json",
  },
  {
    key: "phase12Report",
    label: "Phase 12 News Source Update Report",
    path: "artifacts/deep_ml/news/phase12_source_news_update_report.json",
  },
];

const EXPERT_MODULES: ModuleConfig[] = [
  {
    key: "alphaReport",
    label: "Alpha Structural",
    shortLabel: "Structural",
    path: "artifacts/deep_ml/models/alpha_structural/phase6_alpha_structural_report.json",
    route: "/deep-ml/models/alpha-structural",
  },
  {
    key: "betaReport",
    label: "Beta Temporal",
    shortLabel: "Temporal",
    path: "artifacts/deep_ml/models/beta_temporal/phase7_beta_temporal_report.json",
    route: "/deep-ml/models/beta-temporal",
  },
  {
    key: "deltaReport",
    label: "Delta TFT",
    shortLabel: "Quantile",
    path: "artifacts/deep_ml/models/delta_tft/phase8_delta_tft_report.json",
    route: "/deep-ml/models/delta-tft",
  },
  {
    key: "epsilonReport",
    label: "Epsilon Ensemble",
    shortLabel: "Benchmark",
    path: "artifacts/deep_ml/models/epsilon_expert_ensemble/phase9_epsilon_expert_report.json",
    route: "/deep-ml/models/epsilon-ensemble",
  },
];

const FUTURE_MODULES = [
  {
    label: "Gamma News Sensitivity",
    note: "Locked until Gamma artifacts are created and reviewed.",
  },
  {
    label: "Omega Fusion",
    note: "Locked until fusion artifacts are created and reviewed.",
  },
  {
    label: "Final Deep ML Evaluation",
    note: "Locked until final Deep ML evaluation artifacts exist.",
  },
];

function cleanPath(value: string) {
  return value.trim().replace(/^\/+/, "").replace(/\\/g, "/");
}

function getBaseUrl() {
  const base = process.env.NEXT_PUBLIC_ARTIFACT_BASE_URL;
  if (!base || base.trim() === "") return "";
  return base.trim().replace(/\/+$/, "");
}

function publicHref(value?: string | null) {
  if (!value) return "";
  const cleaned = cleanPath(value).replace(/^public\//, "");
  return `/${cleaned}`;
}

async function readJsonFromFile(filePath: string) {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function loadArtifact(request: ArtifactRequest): Promise<ArtifactResult> {
  const baseUrl = getBaseUrl();
  const normalizedPath = cleanPath(request.path);

  if (!baseUrl) {
    const publicFilePath = path.join(process.cwd(), "public", normalizedPath);
    const repoFilePath = path.join(process.cwd(), normalizedPath);

    try {
      const data = await readJsonFromFile(publicFilePath);
      return {
        ...request,
        url: `file://${publicFilePath}`,
        ok: true,
        data,
      };
    } catch {
      try {
        const data = await readJsonFromFile(repoFilePath);
        return {
          ...request,
          url: `file://${repoFilePath}`,
          ok: true,
          data,
        };
      } catch (error) {
        return {
          ...request,
          url: `file://${publicFilePath}`,
          ok: false,
          data: null,
          error:
            error instanceof Error
              ? `Local artifact read failed: ${error.message}`
              : "Local artifact read failed.",
        };
      }
    }
  }

  const url = `${baseUrl}/${normalizedPath}`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return {
        ...request,
        url,
        ok: false,
        data: null,
        error: `HTTP ${response.status} while loading ${url}`,
      };
    }

    const data = await response.json();

    return {
      ...request,
      url,
      ok: true,
      data,
    };
  } catch (error) {
    return {
      ...request,
      url,
      ok: false,
      data: null,
      error:
        error instanceof Error
          ? `Remote artifact fetch failed: ${error.message}`
          : "Remote artifact fetch failed.",
    };
  }
}

async function loadArtifacts() {
  return Promise.all(PAGE_ARTIFACTS.map(loadArtifact));
}

function getArtifact(results: ArtifactResult[], key: string) {
  return results.find((item) => item.key === key)?.data || null;
}

function getArtifactResult(results: ArtifactResult[], key: string) {
  return results.find((item) => item.key === key);
}

function isRecord(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getNested(value: any, pathParts: string[]) {
  let current = value;
  for (const part of pathParts) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

function firstValue(...values: any[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function formatNumber(value: any, digits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(numeric);
}

function formatPercent(value: any, digits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";
  return `${numeric.toFixed(digits)}%`;
}

function formatDate(value: any) {
  if (!value) return "Not in artifact";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
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

function collectTestMetrics(report: any) {
  const direct = report?.test_metrics_by_horizon;
  const evaluationSnapshot = report?.evaluation_snapshot?.test_by_horizon;
  const runSummaryEvaluation = report?.run_summary?.evaluation_snapshot?.test_by_horizon;
  const chosen = direct || evaluationSnapshot || runSummaryEvaluation || null;

  if (!isRecord(chosen)) return [];

  return Object.entries(chosen)
    .map(([horizon, row]) => {
      const record = isRecord(row) ? row : {};
      return {
        horizon,
        mape: firstValue(record.mape_pct, record.mape, record.MAPE),
        directionalAccuracy: firstValue(
          record.directional_accuracy_pct,
          record.directional_accuracy,
          record.directional_accuracy_percent
        ),
        mae: firstValue(record.mae, record.MAE),
        rmse: firstValue(record.rmse, record.RMSE),
      };
    })
    .filter((row) => row.mape !== null || row.directionalAccuracy !== null);
}

function averageMetric(report: any, key: "mape" | "directionalAccuracy") {
  const metrics = collectTestMetrics(report);
  return average(metrics.map((row) => row[key]));
}

function modelName(report: any) {
  return firstValue(
    report?.model_name,
    report?.run_summary?.model_name,
    report?.model_key,
    report?.run_summary?.model_key
  );
}

function modelVersion(report: any) {
  return firstValue(
    report?.model_version,
    report?.run_summary?.run?.code_version,
    report?.run_summary?.model?.model_version,
    report?.delta_version,
    report?.algorithm
  );
}

function modelStatus(report: any) {
  return firstValue(report?.status, report?.run_summary?.status, report?.quality_review?.status);
}

function modelDevice(report: any) {
  const deviceInfo = report?.device_info;
  const runDevice = report?.run_summary?.run;
  const gpuName = firstValue(
    deviceInfo?.cuda_device_name,
    runDevice?.cuda_device_name,
    report?.gpu_test?.reason
  );

  return firstValue(
    report?.compute_device,
    deviceInfo?.device,
    runDevice?.device,
    gpuName,
    "Not in artifact"
  );
}

function modelFeatureCount(report: any) {
  return firstValue(
    report?.selected_feature_count,
    report?.run_summary?.features?.used_count,
    report?.features?.used_count
  );
}

function modelRuntime(report: any) {
  return firstValue(
    report?.runtime_elapsed_hms,
    report?.run_summary?.runtime_elapsed_hms,
    report?.runtime_elapsed_seconds
      ? `${formatNumber(report.runtime_elapsed_seconds, 1)} sec`
      : null
  );
}

function modelHorizons(report: any) {
  const horizons = firstValue(
    report?.horizons_trained,
    report?.run_summary?.model?.horizons,
    report?.model?.horizons
  );

  if (Array.isArray(horizons)) return horizons.join(", ");
  return horizons || "Not in artifact";
}

function modelGeneratedAt(report: any) {
  return firstValue(
    report?.generated_at_utc,
    report?.run?.completed_at_utc,
    report?.run_summary?.run?.completed_at_utc,
    report?.run_summary?.run?.generated_at_utc,
    report?.run?.generated_at_utc
  );
}

function modelSummary(report: any) {
  return firstValue(
    report?.professor_safe_summary,
    report?.run_summary?.professor_safe_summary,
    report?.quality_review?.professor_safe_summary
  );
}

function statusClass(status: any) {
  const text = String(status || "").toLowerCase();

  if (text.includes("ready") || text.includes("pass") || text.includes("completed")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (text.includes("warning") || text.includes("review") || text.includes("pending")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (text.includes("fail") || text.includes("block")) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function statusDotClass(status: any) {
  const text = String(status || "").toLowerCase();

  if (text.includes("ready") || text.includes("pass") || text.includes("completed")) {
    return "bg-emerald-500";
  }

  if (text.includes("warning") || text.includes("review") || text.includes("pending")) {
    return "bg-amber-500";
  }

  if (text.includes("fail") || text.includes("block")) {
    return "bg-rose-500";
  }

  return "bg-slate-400";
}

function countByStatus(factorState: any) {
  const factors = Array.isArray(factorState?.factors) ? factorState.factors : [];
  const counts: Record<string, number> = {};

  for (const factor of factors) {
    const status = String(factor?.status || "unknown");
    counts[status] = (counts[status] || 0) + 1;
  }

  return counts;
}

function sampleFactorsByStatus(factorState: any, statusNeedle: string, limit = 8) {
  const factors = Array.isArray(factorState?.factors) ? factorState.factors : [];
  return factors
    .filter((factor) => String(factor?.status || "").includes(statusNeedle))
    .slice(0, limit);
}

function latestRunTimestamp(results: ArtifactResult[]) {
  const dates: string[] = [];

  for (const result of results) {
    const data = result.data;
    const possible = [
      data?.generated_at_utc,
      data?.run?.completed_at_utc,
      data?.run?.generated_at_utc,
      data?.run_summary?.run?.completed_at_utc,
      data?.run_summary?.run?.generated_at_utc,
      data?.quality_review?.generated_at_utc,
    ];

    for (const value of possible) {
      if (value) dates.push(value);
    }
  }

  return dates
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .filter((item) => Number.isFinite(item.time))
    .sort((a, b) => b.time - a.time)[0]?.value;
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
        <p className="mt-3 max-w-4xl text-sm font-medium leading-7 text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: any }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(
        status
      )}`}
    >
      <span className={`h-2 w-2 rounded-full ${statusDotClass(status)}`} />
      {status || "Not in artifact"}
    </span>
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

function DownloadButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  if (!href) {
    return (
      <span className="inline-flex cursor-not-allowed items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
        Missing path
      </span>
    );
  }

  return (
    <a
      href={href}
      download
      className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
    >
      {children}
    </a>
  );
}

function DeepMlAnimation() {
  const nodes = Array.from({ length: 22 }, (_, index) => {
    const left = 10 + ((index * 37) % 78);
    const top = 12 + ((index * 29) % 72);

    return (
      <span
        key={index}
        className="deepml-node"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          animationDelay: `${index * 0.18}s`,
        }}
      />
    );
  });

  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-[3rem] border border-slate-200 bg-slate-950 p-8 shadow-2xl shadow-blue-950/20">
      <style>{`
        .deepml-grid {
          background-image:
            linear-gradient(rgba(59, 130, 246, 0.16) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.16) 1px, transparent 1px);
          background-size: 36px 36px;
          animation: deepml-grid-move 18s linear infinite;
        }

        .deepml-node {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: rgba(250, 204, 21, 0.95);
          box-shadow: 0 0 24px rgba(250, 204, 21, 0.85), 0 0 48px rgba(59, 130, 246, 0.35);
          animation: deepml-pulse 2.7s ease-in-out infinite;
        }

        .deepml-cube {
          position: absolute;
          inset: 0;
          margin: auto;
          width: 168px;
          height: 168px;
          transform-style: preserve-3d;
          animation: deepml-cube-spin 13s linear infinite;
        }

        .deepml-cube-face {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(147, 197, 253, 0.45);
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(250, 204, 21, 0.10));
          box-shadow: inset 0 0 40px rgba(59, 130, 246, 0.16);
          backdrop-filter: blur(8px);
        }

        .deepml-face-front { transform: translateZ(84px); }
        .deepml-face-back { transform: rotateY(180deg) translateZ(84px); }
        .deepml-face-right { transform: rotateY(90deg) translateZ(84px); }
        .deepml-face-left { transform: rotateY(-90deg) translateZ(84px); }
        .deepml-face-top { transform: rotateX(90deg) translateZ(84px); }
        .deepml-face-bottom { transform: rotateX(-90deg) translateZ(84px); }

        .deepml-orbit {
          position: absolute;
          inset: 50%;
          width: 320px;
          height: 320px;
          margin-left: -160px;
          margin-top: -160px;
          border-radius: 999px;
          border: 1px solid rgba(250, 204, 21, 0.20);
          transform-style: preserve-3d;
          animation: deepml-orbit-spin 9s linear infinite;
        }

        .deepml-orbit.two {
          width: 420px;
          height: 420px;
          margin-left: -210px;
          margin-top: -210px;
          border-color: rgba(59, 130, 246, 0.25);
          animation-duration: 14s;
          animation-direction: reverse;
        }

        .deepml-orbit.three {
          width: 250px;
          height: 250px;
          margin-left: -125px;
          margin-top: -125px;
          border-color: rgba(16, 185, 129, 0.25);
          animation-duration: 11s;
        }

        @keyframes deepml-grid-move {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(36px, 36px, 0); }
        }

        @keyframes deepml-pulse {
          0%, 100% { transform: scale(0.75); opacity: 0.55; }
          50% { transform: scale(1.45); opacity: 1; }
        }

        @keyframes deepml-cube-spin {
          from { transform: rotateX(-18deg) rotateY(0deg) rotateZ(8deg); }
          to { transform: rotateX(-18deg) rotateY(360deg) rotateZ(8deg); }
        }

        @keyframes deepml-orbit-spin {
          from { transform: rotateX(68deg) rotateZ(0deg); }
          to { transform: rotateX(68deg) rotateZ(360deg); }
        }
      `}</style>

      <div className="deepml-grid absolute inset-0 opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(59,130,246,0.30),transparent_42%),radial-gradient(circle_at_25%_15%,rgba(250,204,21,0.18),transparent_28%),radial-gradient(circle_at_85%_85%,rgba(16,185,129,0.16),transparent_32%)]" />

      <div className="absolute inset-0" style={{ perspective: "900px" }}>
        <div className="deepml-orbit" />
        <div className="deepml-orbit two" />
        <div className="deepml-orbit three" />

        <div className="deepml-cube">
          <div className="deepml-cube-face deepml-face-front" />
          <div className="deepml-cube-face deepml-face-back" />
          <div className="deepml-cube-face deepml-face-right" />
          <div className="deepml-cube-face deepml-face-left" />
          <div className="deepml-cube-face deepml-face-top" />
          <div className="deepml-cube-face deepml-face-bottom" />
        </div>
      </div>

      {nodes}

      <div className="relative z-10 flex h-full min-h-[360px] flex-col justify-between">
        <div>
          <div className="inline-flex rounded-full border border-yellow-300/30 bg-yellow-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-yellow-200">
            CUDA Research Extension
          </div>
          <h1 className="mt-8 max-w-3xl text-5xl font-black tracking-tight text-white md:text-7xl">
            Deep ML Models
          </h1>
          <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-blue-100/80">
            Artifact-driven Phase 2 extension for the Gold Nexus Alpha forecasting
            platform. This page reads exported JSON reports and displays only
            what the artifacts provide.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Display Rule
            </div>
            <div className="mt-2 text-sm font-black text-white">JSON-first</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Interpretation
            </div>
            <div className="mt-2 text-sm font-black text-white">Behavior, not causality</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Future Modules
            </div>
            <div className="mt-2 text-sm font-black text-white">Locked until artifacts exist</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArtifactHealthPanel({ results }: { results: ArtifactResult[] }) {
  const loaded = results.filter((result) => result.ok).length;
  const missing = results.length - loaded;

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
            Artifact Loading
          </div>
          <div className="mt-2 text-2xl font-black text-slate-950">
            {loaded}/{results.length} loaded
          </div>
        </div>
        <StatusPill status={missing === 0 ? "ready" : "review_required"} />
      </div>

      {missing > 0 && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-6 text-amber-800">
          Some artifacts were not found by the page loader. Missing files are shown
          in the artifact download section so they can be copied into the public
          artifact folder or regenerated.
        </div>
      )}
    </div>
  );
}

function ModuleCard({
  config,
  result,
}: {
  config: ModuleConfig;
  result?: ArtifactResult;
}) {
  const report = result?.data;
  const metrics = collectTestMetrics(report);
  const avgMape = averageMetric(report, "mape");
  const avgDirectional = averageMetric(report, "directionalAccuracy");
  const summary = modelSummary(report);

  return (
    <div className="group flex h-full flex-col rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">
            {config.shortLabel}
          </div>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {config.label}
          </h3>
        </div>
        <StatusPill status={result?.ok ? modelStatus(report) : "missing"} />
      </div>

      <div className="mt-6 grid gap-3 text-xs">
        <InfoLine label="Artifact model" value={modelName(report)} />
        <InfoLine label="Version" value={modelVersion(report)} />
        <InfoLine label="Device/backend" value={modelDevice(report)} />
        <InfoLine label="Feature count" value={modelFeatureCount(report)} />
        <InfoLine label="Horizons" value={modelHorizons(report)} />
        <InfoLine label="Generated" value={formatDateTime(modelGeneratedAt(report))} />
        <InfoLine label="Runtime" value={modelRuntime(report)} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            Avg Test MAPE
          </div>
          <div className="mt-2 text-xl font-black text-slate-950">
            {avgMape === null ? "Not in artifact" : formatPercent(avgMape)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            Avg Direction
          </div>
          <div className="mt-2 text-xl font-black text-slate-950">
            {avgDirectional === null ? "Not in artifact" : formatPercent(avgDirectional)}
          </div>
        </div>
      </div>

      {summary && (
        <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs font-semibold leading-6 text-blue-900">
          {summary}
        </div>
      )}

      {!summary && (
        <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-semibold leading-6 text-slate-500">
          No professor-safe summary field was found in this artifact. The page is
          intentionally not adding one.
        </div>
      )}

      {metrics.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
          <div className="grid grid-cols-4 bg-slate-50 px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
            <span>H</span>
            <span>MAPE</span>
            <span>MAE</span>
            <span>Dir.</span>
          </div>
          {metrics.slice(0, 5).map((row) => (
            <div
              key={`${config.key}-${row.horizon}`}
              className="grid grid-cols-4 border-t border-slate-100 px-4 py-3 text-xs font-bold text-slate-700"
            >
              <span>{row.horizon}</span>
              <span>{formatPercent(row.mape)}</span>
              <span>{formatNumber(row.mae, 1)}</span>
              <span>{formatPercent(row.directionalAccuracy)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-3 pt-6">
        <a
          href={config.route}
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
        >
          Open page
        </a>
        <DownloadButton href={publicHref(config.path)}>Download JSON</DownloadButton>
      </div>
    </div>
  );
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-slate-100 pb-2 last:border-b-0">
      <span className="font-black uppercase tracking-widest text-slate-400">{label}</span>
      <span className="break-words font-bold text-slate-700">
        {value || "Not in artifact"}
      </span>
    </div>
  );
}

function LockedModuleCard({
  label,
  note,
}: {
  label: string;
  note: string;
}) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 p-6">
      <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
        Coming Soon
      </div>
      <h3 className="mt-4 text-xl font-black text-slate-900">{label}</h3>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{note}</p>
    </div>
  );
}

function TimelineRow({
  label,
  date,
  status,
}: {
  label: string;
  date: any;
  status: any;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4">
      <span className={`h-3 w-3 shrink-0 rounded-full ${statusDotClass(status)}`} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-black text-slate-900">{label}</div>
        <div className="text-xs font-semibold text-slate-500">{formatDateTime(date)}</div>
      </div>
      <StatusPill status={status} />
    </div>
  );
}

function ArtifactDownloads({ results }: { results: ArtifactResult[] }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
            Source Files
          </div>
          <h3 className="mt-2 text-2xl font-black text-slate-950">Artifact downloads</h3>
        </div>
      </div>

      <div className="grid gap-3">
        {results.map((result) => (
          <div
            key={result.key}
            className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black text-slate-900">{result.label}</span>
                <StatusPill status={result.ok ? "loaded" : "missing"} />
              </div>
              <div className="mt-2 break-all text-xs font-semibold text-slate-500">
                {result.path}
              </div>
              {!result.ok && result.error && (
                <div className="mt-2 text-xs font-semibold text-rose-600">{result.error}</div>
              )}
            </div>
            <DownloadButton href={publicHref(result.path)}>Download</DownloadButton>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function DeepMlOverviewPage() {
  const results = await loadArtifacts();

  const modeStatus = getArtifact(results, "modeStatus");
  const studyContext = getArtifact(results, "studyContext");
  const matrixManifest = getArtifact(results, "matrixManifest");
  const factorState = getArtifact(results, "factorState");
  const phase10Report = getArtifact(results, "phase10Report");
  const phase11Report = getArtifact(results, "phase11Report");
  const phase12Report = getArtifact(results, "phase12Report");

  const factorStatusCounts = countByStatus(factorState);
  const fredFactors = sampleFactorsByStatus(factorState, "fred_api_updated", 10);
  const manualFactors = sampleFactorsByStatus(factorState, "manual_stale_or_carried_forward", 8);

  const matrixRows = firstValue(
    matrixManifest?.row_count,
    phase11Report?.refresh_summary?.row_count,
    studyContext?.refresh_summary?.row_count
  );
  const matrixColumns = firstValue(
    matrixManifest?.column_count,
    phase11Report?.refresh_summary?.column_count,
    studyContext?.refresh_summary?.column_count
  );
  const dateStart = firstValue(
    matrixManifest?.date_range?.start,
    phase11Report?.refresh_summary?.first_date,
    studyContext?.refresh_summary?.first_date
  );
  const dateEnd = firstValue(
    matrixManifest?.date_range?.end,
    phase11Report?.refresh_summary?.last_date,
    studyContext?.refresh_summary?.last_date,
    modeStatus?.effective_data_through_date
  );
  const officialCutoff = firstValue(
    modeStatus?.official_model_cutoff,
    modeStatus?.official_cutoff,
    matrixManifest?.official_cutoff,
    phase11Report?.refresh_summary?.official_cutoff
  );
  const forecastStart = firstValue(modeStatus?.forecast_start_date, phase11Report?.diagnostics_snapshot?.forecast_start_date);
  const postCutoffRows = firstValue(
    matrixManifest?.post_cutoff_row_count,
    phase11Report?.refresh_summary?.post_cutoff_row_count,
    studyContext?.refresh_summary?.post_cutoff_row_count
  );

  const matrixCsvPath = firstValue(
    matrixManifest?.outputs?.refreshed_matrix_csv,
    phase11Report?.outputs?.refreshed_matrix_csv
  );
  const matrixParquetPath = firstValue(
    matrixManifest?.outputs?.refreshed_matrix_parquet,
    phase11Report?.outputs?.refreshed_matrix_parquet
  );

  const latestTimestamp = latestRunTimestamp(results);

  const timelineRows = [
    {
      label: "Phase 10 Source Update",
      date: phase10Report?.run?.completed_at_utc,
      status: phase10Report?.status,
    },
    {
      label: "Phase 11 Governed Feature Refresh",
      date: phase11Report?.run?.completed_at_utc,
      status: phase11Report?.status,
    },
    ...EXPERT_MODULES.map((module) => {
      const report = getArtifact(results, module.key);
      return {
        label: module.label,
        date: modelGeneratedAt(report),
        status: modelStatus(report),
      };
    }),
    {
      label: "Phase 12 News Source Update",
      date: phase12Report?.run?.completed_at_utc,
      status: phase12Report?.status,
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-[1800px]">
        <DeepMlAnimation />

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Study ID"
            value={
              <span className="break-words text-xl">
                {firstValue(modeStatus?.study_id, studyContext?.study_id)}
              </span>
            }
            note="Read from governance artifacts."
          />
          <MetricCard
            label="Effective Data Through"
            value={formatDate(dateEnd)}
            note={`Forecast start: ${formatDate(forecastStart)}`}
          />
          <MetricCard
            label="Official Cutoff"
            value={formatDate(officialCutoff)}
            note="Official history is preserved before the model cutoff."
          />
          <MetricCard
            label="Latest Artifact Run"
            value={formatDateTime(latestTimestamp)}
            note="Derived from loaded report timestamps."
          />
        </section>

        <section className="mt-10 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader
              eyebrow="Deep ML Overview"
              title="Phase 2 artifact control center"
              description="This page summarizes the accepted Deep ML model sequence and source-refresh layer. It does not rank final winners, make causal statements, or add model claims beyond exported JSON artifacts."
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Matrix Rows" value={formatNumber(matrixRows)} />
              <MetricCard label="Matrix Columns" value={formatNumber(matrixColumns)} />
              <MetricCard label="Date Range" value={<span className="text-xl">{dateStart} → {dateEnd}</span>} />
              <MetricCard label="Post-cutoff Rows" value={formatNumber(postCutoffRows)} />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="rounded-[2rem] border border-blue-100 bg-blue-50 p-5">
                <div className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                  Gold Extension
                </div>
                <div className="mt-2 text-lg font-black text-blue-950">
                  {firstValue(
                    matrixManifest?.gold_live_source?.source_type,
                    phase11Report?.gold_live_source?.source_type
                  )}
                </div>
                <div className="mt-2 text-xs font-semibold leading-5 text-blue-700">
                  {firstValue(
                    matrixManifest?.gold_live_source?.first_date,
                    phase11Report?.gold_live_source?.first_date
                  )}{" "}
                  →{" "}
                  {firstValue(
                    matrixManifest?.gold_live_source?.last_date,
                    phase11Report?.gold_live_source?.last_date
                  )}
                </div>
              </div>

              <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5">
                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                  FRED Merge
                </div>
                <div className="mt-2 text-lg font-black text-emerald-950">
                  {formatNumber(
                    firstValue(
                      matrixManifest?.fred_merge_summary?.fred_series_used_in_merge,
                      phase11Report?.fred_merge_summary?.fred_series_used_in_merge
                    )
                  )}{" "}
                  series used
                </div>
                <div className="mt-2 text-xs font-semibold leading-5 text-emerald-700">
                  {firstValue(
                    matrixManifest?.fred_merge_summary?.fred_series_failed,
                    phase11Report?.fred_merge_summary?.fred_series_failed
                  )}{" "}
                  failed series reported.
                </div>
              </div>

              <div className="rounded-[2rem] border border-amber-100 bg-amber-50 p-5">
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                  Manual / Local Factors
                </div>
                <div className="mt-2 text-lg font-black text-amber-950">
                  {firstValue(modeStatus?.manual_factor_policy, "Not in artifact")}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <DownloadButton href={publicHref(matrixCsvPath)}>Download refreshed matrix CSV</DownloadButton>
              <DownloadButton href={publicHref(matrixParquetPath)}>Download refreshed matrix parquet</DownloadButton>
              <DownloadButton href={publicHref("artifacts/deep_ml/data/factor_state_table.json")}>
                Download factor state
              </DownloadButton>
            </div>
          </div>

          <div className="grid gap-6">
            <ArtifactHealthPanel results={results} />

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                Run Timeline
              </div>
              <div className="mt-4 grid gap-3">
                {timelineRows.map((row) => (
                  <TimelineRow
                    key={row.label}
                    label={row.label}
                    date={row.date}
                    status={row.status}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Accepted Model Artifacts"
            title="Deep ML expert modules"
            description="Each card reads its model name, version, status, device, metrics, horizons, and summary from the exported report JSON. Missing fields are intentionally shown as missing rather than filled manually."
          />

          <div className="grid gap-6 xl:grid-cols-2">
            {EXPERT_MODULES.map((module) => (
              <ModuleCard
                key={module.key}
                config={module}
                result={getArtifactResult(results, module.key)}
              />
            ))}
          </div>
        </section>

        <section className="mt-14 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader
              eyebrow="Factor State"
              title="Refresh status by factor"
              description="Factor-state status describes refresh handling and availability only. It does not describe causality."
            />

            <div className="grid gap-3">
              {Object.entries(factorStatusCounts).map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4"
                >
                  <span className="text-sm font-black text-slate-800">{status}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
            <SectionHeader
              eyebrow="Cleaned Matrix"
              title="Updated and carried factors"
              description="This table previews factor-state categories from the artifact. Full factor details are available through the factor-state JSON download."
            />

            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-emerald-600">
                  FRED-updated factors
                </h3>
                <div className="mt-4 grid gap-2">
                  {fredFactors.map((factor: any) => (
                    <div
                      key={factor.factor_key}
                      className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"
                    >
                      <div className="font-black text-emerald-950">{factor.factor_key}</div>
                      <div className="mt-1 text-xs font-semibold text-emerald-700">
                        Unique post-cutoff values: {formatNumber(factor.post_cutoff_unique_values)}
                      </div>
                    </div>
                  ))}
                  {!fredFactors.length && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                      No FRED-updated factor rows found in artifact.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-amber-600">
                  Manual/local carried factors
                </h3>
                <div className="mt-4 grid gap-2">
                  {manualFactors.map((factor: any) => (
                    <div
                      key={factor.factor_key}
                      className="rounded-2xl border border-amber-100 bg-amber-50 p-4"
                    >
                      <div className="font-black text-amber-950">{factor.factor_key}</div>
                      <div className="mt-1 text-xs font-semibold text-amber-700">
                        {factor.source_type || "Source type not in artifact"}
                      </div>
                    </div>
                  ))}
                  {!manualFactors.length && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                      No manual/local carried factor rows found in artifact.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm">
          <SectionHeader
            eyebrow="News Source Layer"
            title="Phase 12 source context for future Gamma"
            description="The news layer is displayed as source coverage and context only. It is not a forecast and does not claim that headlines caused gold price movement."
          />

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Historical Daily Rows"
              value={formatNumber(phase12Report?.source_summary?.historical_daily_rows)}
              note="Fixed daily continuity index."
            />
            <MetricCard
              label="Recent Rows"
              value={formatNumber(phase12Report?.source_summary?.unified_recent_rows_after_dedupe)}
              note="Deduped recent inventory."
            />
            <MetricCard
              label="Combined Context Rows"
              value={formatNumber(phase12Report?.source_summary?.combined_daily_context_rows)}
              note="Historical plus recent context rows."
            />
            <MetricCard
              label="RSS Policy"
              value={<span className="text-lg">Recent fallback only</span>}
              note={phase12Report?.historical_manifest_snapshot?.google_news_rss_policy}
            />
          </div>

          <div className="mt-8 grid gap-5 xl:grid-cols-2">
            <div className="rounded-[2rem] border border-blue-100 bg-blue-50 p-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-blue-700">
                Allowed artifact-grounded claims
              </h3>
              <ul className="mt-4 space-y-3 text-sm font-semibold leading-6 text-blue-950">
                {(phase12Report?.ai_grounding?.allowed_claims || []).map((claim: string) => (
                  <li key={claim}>• {claim}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-[2rem] border border-rose-100 bg-rose-50 p-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-rose-700">
                Forbidden claims
              </h3>
              <ul className="mt-4 space-y-3 text-sm font-semibold leading-6 text-rose-950">
                {(phase12Report?.ai_grounding?.forbidden_claims || []).map((claim: string) => (
                  <li key={claim}>• {claim}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <DownloadButton href={publicHref(phase12Report?.outputs?.historical_index_csv)}>
              Download historical news index
            </DownloadButton>
            <DownloadButton href={publicHref(phase12Report?.outputs?.combined_daily_context_csv)}>
              Download combined news context
            </DownloadButton>
            <DownloadButton href={publicHref(phase12Report?.outputs?.unified_recent_csv)}>
              Download recent news inventory
            </DownloadButton>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Locked Future Work"
            title="Gamma, Omega, and final evaluation remain gated"
            description="These modules stay locked until their backend artifacts are created, reviewed, and accepted. Later we patch only the module registry and artifact list."
          />

          <div className="grid gap-5 md:grid-cols-3">
            {FUTURE_MODULES.map((module) => (
              <LockedModuleCard key={module.label} {...module} />
            ))}
          </div>
        </section>

        <section className="mt-14">
          <ArtifactDownloads results={results} />
        </section>
      </div>
    </main>
  );
}