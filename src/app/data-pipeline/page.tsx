import type { ReactNode } from "react";
import { promises as fs } from "fs";
import path from "path";
import { artifactPaths } from "@/lib/artifactPaths";

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

const DATA_PIPELINE_ARTIFACTS: ArtifactRequest[] = [
  {
    key: "pageDataPipeline",
    label: "Page Data Pipeline",
    path: artifactPaths.pages.dataPipeline,
  },
  {
    key: "factorInventory",
    label: "Factor Inventory",
    path: artifactPaths.data.factorInventory,
  },
  {
    key: "dataTableAudit",
    label: "Data Table Audit",
    path: artifactPaths.data.dataTableAudit,
  },
  {
    key: "weekdayCleaningAudit",
    label: "Weekday Cleaning Audit",
    path: artifactPaths.data.weekdayCleaningAudit,
  },
  {
    key: "missingValuesReport",
    label: "Missing Values Report",
    path: artifactPaths.data.missingValuesReport,
  },
  {
    key: "featureDictionary",
    label: "Feature Dictionary",
    path: artifactPaths.data.featureDictionary,
  },
  {
    key: "featureEngineeringAudit",
    label: "Feature Engineering Audit",
    path: artifactPaths.data.featureEngineeringAudit,
  },
  {
    key: "forecastStatus",
    label: "Forecast Status",
    path: artifactPaths.governance.forecastStatus,
  },
  {
    key: "forecastGovernance",
    label: "Forecast Governance",
    path: artifactPaths.governance.forecastGovernance,
  },
  {
    key: "modelWindowPlan",
    label: "Model Window Plan",
    path: artifactPaths.governance.modelWindowPlan,
  },
  {
    key: "cutoffDecisionLog",
    label: "Cutoff Decision Log",
    path: artifactPaths.governance.cutoffDecisionLog,
  },
];

function cleanPath(value: string) {
  return value.trim().replace(/^\/+/, "");
}

function getBaseUrl() {
  const base = process.env.NEXT_PUBLIC_ARTIFACT_BASE_URL;
  if (!base || base.trim() === "") return "";
  return base.trim().replace(/\/+$/, "");
}

async function loadArtifact(request: ArtifactRequest): Promise<ArtifactResult> {
  const baseUrl = getBaseUrl();
  const normalizedPath = cleanPath(request.path);

  if (!baseUrl) {
    const filePath = path.join(process.cwd(), "public", normalizedPath);

    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(raw);

      return {
        ...request,
        url: `file://${filePath}`,
        ok: true,
        data,
      };
    } catch (error) {
      return {
        ...request,
        url: `file://${filePath}`,
        ok: false,
        data: null,
        error:
          error instanceof Error
            ? `Local read failed: ${error.message}`
            : "Local read failed.",
      };
    }
  }

  const url = `${baseUrl}/${normalizedPath}`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
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
          ? `Remote fetch failed: ${error.message}`
          : "Remote fetch failed.",
    };
  }
}

async function loadArtifacts() {
  return Promise.all(DATA_PIPELINE_ARTIFACTS.map(loadArtifact));
}

function getArtifact(results: ArtifactResult[], key: string) {
  return results.find((item) => item.key === key)?.data || null;
}

function isRecord(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function findValueDeep(obj: any, keys: string[], depth = 0): any {
  if (!obj || depth > 7) return null;

  if (isRecord(obj)) {
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
        return obj[key];
      }
    }

    for (const value of Object.values(obj)) {
      const found = findValueDeep(value, keys, depth + 1);
      if (found !== null && found !== undefined && found !== "") return found;
    }
  }

  if (Array.isArray(obj)) {
    for (const value of obj) {
      const found = findValueDeep(value, keys, depth + 1);
      if (found !== null && found !== undefined && found !== "") return found;
    }
  }

  return null;
}

function findArrayDeep(obj: any, keys: string[], depth = 0): any[] {
  if (!obj || depth > 7) return [];

  if (Array.isArray(obj)) return obj;

  if (isRecord(obj)) {
    for (const key of keys) {
      const value = obj[key];

      if (Array.isArray(value)) return value;

      if (isRecord(value)) {
        const nested = findArrayDeep(value, keys, depth + 1);
        if (nested.length > 0) return nested;
      }
    }

    for (const value of Object.values(obj)) {
      const nested = findArrayDeep(value, keys, depth + 1);
      if (nested.length > 0) return nested;
    }
  }

  return [];
}

function formatNumber(value: any) {
  if (value === null || value === undefined || value === "") return "—";

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) return String(value);

  return numericValue.toLocaleString("en-US");
}

function formatText(value: any) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function classifyFactor(row: any) {
  const name = String(row.factor || row.column || row.name || "").toLowerCase();

  if (name.includes("gold_price")) return "Target";
  if (name.includes("high_yield")) return "Sensitivity";
  if (name.includes("yield") || name.includes("tips")) return "Rates";
  if (name.includes("usd") || name.includes("eur") || name.includes("jpy")) return "Currency";
  if (
    name.includes("vix") ||
    name.includes("stress") ||
    name.includes("gpr") ||
    name.includes("policy")
  ) {
    return "Risk";
  }
  if (name.includes("oil") || name.includes("ppi") || name.includes("gld")) return "Commodity";
  if (
    name.includes("unrate") ||
    name.includes("ind_prod") ||
    name.includes("cap_util") ||
    name.includes("m2") ||
    name.includes("fed") ||
    name.includes("inflation")
  ) {
    return "Macro";
  }

  return "Factor";
}

function isSensitivityOnly(row: any) {
  const name = String(row.factor || row.column || row.name || "").toLowerCase();
  const use = String(row.main_model_use || row.use_in_main_model || row.in_main_model || "").toLowerCase();
  const notes = String(row.notes || row.audit_note || "").toLowerCase();

  return name.includes("high_yield") || use.includes("no") || notes.includes("sensitivity");
}

function CardShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_18px_60px_rgba(15,23,42,0.08)] ${className}`}
    >
      {children}
    </section>
  );
}

function Eyebrow({
  children,
  dark = false,
}: {
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <p
      className={
        dark
          ? "text-xs font-black uppercase tracking-[0.32em] text-yellow-300"
          : "text-xs font-black uppercase tracking-[0.32em] text-blue-600"
      }
    >
      {children}
    </p>
  );
}

function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-7">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-600 md:text-base">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function DarkKpiCard({
  label,
  value,
  note,
}: {
  label: string;
  value: any;
  note?: string;
}) {
  return (
    <div className="rounded-3xl border border-yellow-500/25 bg-white/[0.07] p-5 shadow-2xl backdrop-blur">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-200/80">
        {label}
      </p>
      <p className="mt-3 break-words text-3xl font-black text-white">
        {formatNumber(value)}
      </p>
      {note ? <p className="mt-2 text-sm leading-6 text-slate-300">{note}</p> : null}
    </div>
  );
}

function LightMetricCard({
  label,
  value,
  note,
  tone = "blue",
}: {
  label: string;
  value: any;
  note?: string;
  tone?: "blue" | "gold" | "green" | "red" | "slate";
}) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    gold: "border-yellow-200 bg-yellow-50 text-yellow-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return (
    <div className={`rounded-3xl border p-5 ${tones[tone]}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.22em] opacity-75">
        {label}
      </p>
      <p className="mt-3 break-words text-3xl font-black text-slate-950">
        {formatNumber(value)}
      </p>
      {note ? <p className="mt-2 text-sm leading-6 text-slate-600">{note}</p> : null}
    </div>
  );
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={
        ok
          ? "rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700"
          : "rounded-full border border-red-300 bg-red-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-red-700"
      }
    >
      {ok ? "Loaded" : "Missing"}
    </span>
  );
}

function PipelineAnimation() {
  return (
    <div className="relative min-h-[260px] overflow-hidden rounded-[2rem] border border-yellow-400/20 bg-[#050b16] p-6">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute left-6 top-10 h-2 w-2 animate-ping rounded-full bg-yellow-300" />
        <div className="absolute right-12 top-20 h-2 w-2 animate-pulse rounded-full bg-blue-300" />
        <div className="absolute bottom-12 left-1/3 h-2 w-2 animate-ping rounded-full bg-emerald-300" />
      </div>

      <div className="relative z-10 grid h-full gap-4">
        {[
          ["01", "Colab Notebooks", "clean + model"],
          ["02", "GitHub Artifacts", "CSV + JSON"],
          ["03", "Vercel Frontend", "JSON-first pages"],
        ].map((step, index) => (
          <div
            key={step[0]}
            className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition duration-300 hover:translate-x-2 hover:border-yellow-300/40"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-yellow-300/40 bg-yellow-300/10 text-sm font-black text-yellow-200">
              {step[0]}
            </div>

            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-white">
                {step[1]}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                {step[2]}
              </p>
            </div>

            {index < 2 ? (
              <div className="ml-auto h-px w-16 overflow-hidden bg-white/10">
                <div className="h-px w-10 animate-pulse bg-yellow-300" />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="absolute bottom-0 left-0 h-1 w-full overflow-hidden bg-white/10">
        <div className="h-full w-1/3 animate-pulse bg-gradient-to-r from-yellow-300 via-blue-400 to-emerald-300" />
      </div>
    </div>
  );
}

function FactorCard({ row }: { row: any }) {
  const factor = row.factor || row.column || row.name;
  const startDate = row.source_start_date || row.start_date || row.locked_start_date;
  const frequency = row.frequency;
  const source = row.source || row.source_type;
  const fillMethod = row.fill_method || row.alignment_method || row.frequency_alignment;
  const use = row.main_model_use || row.use_in_main_model || row.in_main_model;
  const notes = row.notes || row.audit_note;
  const category = classifyFactor(row);
  const sensitivity = isSensitivityOnly(row);

  return (
    <div
      className={`rounded-[1.6rem] border p-5 transition duration-300 hover:-translate-y-1 hover:shadow-xl ${
        sensitivity ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
              sensitivity
                ? "border-amber-300 bg-amber-100 text-amber-800"
                : "border-blue-200 bg-blue-50 text-blue-700"
            }`}
          >
            {sensitivity ? "Sensitivity Only" : category}
          </span>

          <h3 className="mt-4 text-xl font-black text-slate-950">
            {formatText(factor)}
          </h3>
        </div>

        <div className="rounded-2xl bg-slate-950 px-3 py-2 text-right">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
            Main Use
          </p>
          <p className="text-sm font-black text-white">{formatText(use)}</p>
        </div>
      </div>

      <p className="mt-4 min-h-[48px] text-sm leading-6 text-slate-600">
        {formatText(notes)}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 text-xs">
        <div>
          <p className="font-black uppercase tracking-[0.16em] text-slate-400">
            Start Date
          </p>
          <p className="mt-1 font-bold text-slate-900">{formatText(startDate)}</p>
        </div>

        <div>
          <p className="font-black uppercase tracking-[0.16em] text-slate-400">
            Frequency
          </p>
          <p className="mt-1 font-bold text-slate-900">{formatText(frequency)}</p>
        </div>

        <div>
          <p className="font-black uppercase tracking-[0.16em] text-slate-400">
            Source
          </p>
          <p className="mt-1 font-bold text-slate-900">{formatText(source)}</p>
        </div>

        <div>
          <p className="font-black uppercase tracking-[0.16em] text-slate-400">
            Alignment
          </p>
          <p className="mt-1 line-clamp-3 font-bold text-slate-900">
            {formatText(fillMethod)}
          </p>
        </div>
      </div>
    </div>
  );
}

function DecisionTimeline({ decisions }: { decisions: any[] }) {
  if (!decisions.length) return null;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {decisions.slice(0, 6).map((decision, index) => (
        <div
          key={decision.decision_id || index}
          className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">
            Decision {index + 1}
          </p>
          <h3 className="mt-3 text-lg font-black text-slate-950">
            {formatText(decision.decision || decision.title || decision.decision_id)}
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {formatText(decision.reason || decision.impact || decision.notes)}
          </p>
        </div>
      ))}
    </div>
  );
}

function WindowCard({ row }: { row: any }) {
  return (
    <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-700">
        {formatText(row.dataset || row.dataset_name || row.model_group || row.name)}
      </p>

      <div className="mt-4 grid gap-3 text-sm">
        <div className="rounded-2xl bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            Dataset Window
          </p>
          <p className="mt-1 font-bold text-slate-950">
            {formatText(row.start || row.start_date)} →{" "}
            {formatText(row.end || row.end_date)}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Train
            </p>
            <p className="mt-1 text-xs font-bold text-slate-950">
              {formatText(row.train || `${row.train_start || "—"} to ${row.train_end || "—"}`)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Validation
            </p>
            <p className="mt-1 text-xs font-bold text-slate-950">
              {formatText(
                row.validation ||
                  `${row.validation_start || "—"} to ${row.validation_end || "—"}`
              )}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Test
            </p>
            <p className="mt-1 text-xs font-bold text-slate-950">
              {formatText(row.test || `${row.test_start || "—"} to ${row.test_end || "—"}`)}
            </p>
          </div>
        </div>

        {row.purpose || row.notes ? (
          <p className="text-sm leading-6 text-slate-600">
            {formatText(row.purpose || row.notes)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ArtifactStatusTable({ results }: { results: ArtifactResult[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Artifact</th>
            <th className="px-4 py-3">Path</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>

        <tbody>
          {results.map((result) => (
            <tr key={result.key} className="border-t border-slate-200">
              <td className="px-4 py-4 font-bold text-slate-950">
                {result.label}
              </td>
              <td className="px-4 py-4 font-mono text-xs text-slate-500">
                {result.path}
              </td>
              <td className="px-4 py-4">
                <StatusBadge ok={result.ok} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourcePreview({ title, data }: { title: string; data: any }) {
  return (
    <details className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <summary className="cursor-pointer text-sm font-black uppercase tracking-[0.18em] text-slate-700">
        View source preview: {title}
      </summary>
      <pre className="mt-4 max-h-[320px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

function FrequencyMixSection({
  frequencyCounts,
}: {
  frequencyCounts: Record<string, number>;
}) {
  return (
    <CardShell>
      <SectionTitle
        eyebrow="Frequency Alignment"
        title="Frequency Mix"
        subtitle="This explains how different source frequencies are aligned into the weekday-clean matrix before modeling."
      />

      <div className="space-y-4">
        {Object.entries(frequencyCounts).map(([frequency, count]) => {
          const explanationMap: Record<string, string> = {
            Daily:
              "Daily factors already match the main modeling rhythm most closely. They are aligned to the weekday-clean date index after weekend rows are removed.",
            Weekly:
              "Weekly factors update less often than the gold price series. Their latest available weekly value is carried forward across weekday rows until the next official update.",
            Monthly:
              "Monthly macro and uncertainty factors update much less frequently. They are expanded across weekday rows using the most recently available value, so the model never uses future monthly information before it exists.",
            Unknown:
              "The artifact did not specify a frequency for this group. Review the factor registry if this appears in the final version.",
          };

          const methodMap: Record<string, string> = {
            Daily: "Direct weekday alignment",
            Weekly: "Forward-fill after official weekly release",
            Monthly: "Forward-fill after official monthly release",
            Unknown: "Needs registry review",
          };

          const professorNoteMap: Record<string, string> = {
            Daily:
              "Safe point: daily factors require less frequency conversion, but still must follow the same cutoff and weekday-clean rule.",
            Weekly:
              "Safe point: weekly data is not randomly interpolated; it is held constant until a new valid weekly observation is available.",
            Monthly:
              "Safe point: monthly data is not backfilled from the future; it is only carried forward after the value is available in the dataset.",
            Unknown:
              "Safe point: every factor should have documented frequency before final submission.",
          };

          const frequencyKey = frequency in explanationMap ? frequency : "Unknown";

          return (
            <details
              key={frequency}
              className="group rounded-3xl border border-slate-200 bg-slate-50 p-5 transition duration-300 open:bg-white open:shadow-lg"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-black text-slate-950">
                    {frequency}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {methodMap[frequencyKey]}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-black text-yellow-700">
                    {count}
                  </span>
                  <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-slate-500 transition group-open:rotate-180">
                    ↓
                  </span>
                </div>
              </summary>

              <div className="mt-5 grid gap-4 border-t border-slate-200 pt-5">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
                    Alignment Explanation
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {explanationMap[frequencyKey]}
                  </p>
                </div>

                <div className="rounded-2xl bg-blue-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                    Modeling Meaning
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    This frequency group contributes {count} factor
                    {Number(count) === 1 ? "" : "s"} to the pipeline. Before
                    modeling, these values must be aligned to the same
                    weekday-clean calendar as the gold price target.
                  </p>
                </div>

                <div className="rounded-2xl bg-yellow-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-700">
                    Note
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {professorNoteMap[frequencyKey]}
                  </p>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </CardShell>
  );
}

export default async function DataPipelinePage() {
  const results = await loadArtifacts();

  const pageDataPipeline = getArtifact(results, "pageDataPipeline");
  const factorInventory = getArtifact(results, "factorInventory");
  const dataTableAudit = getArtifact(results, "dataTableAudit");
  const weekdayCleaningAudit = getArtifact(results, "weekdayCleaningAudit");
  const missingValuesReport = getArtifact(results, "missingValuesReport");
  const featureDictionary = getArtifact(results, "featureDictionary");
  const featureEngineeringAudit = getArtifact(results, "featureEngineeringAudit");
  const forecastStatus = getArtifact(results, "forecastStatus");
  const forecastGovernance = getArtifact(results, "forecastGovernance");
  const modelWindowPlan = getArtifact(results, "modelWindowPlan");
  const cutoffDecisionLog = getArtifact(results, "cutoffDecisionLog");

  const factorRows = findArrayDeep(factorInventory, [
    "factors",
    "factor_inventory",
    "factorInventory",
    "records",
    "rows",
    "data",
  ]);

  const missingRows = findArrayDeep(missingValuesReport, [
    "missing_values_report",
    "missingValuesReport",
    "factors",
    "records",
    "rows",
    "data",
  ]);

  const windowRows = findArrayDeep(modelWindowPlan, [
    "model_windows",
    "modelWindows",
    "datasets",
    "windows",
    "records",
    "rows",
    "data",
  ]);

  const featureRows = findArrayDeep(featureDictionary, [
    "features",
    "feature_dictionary",
    "featureDictionary",
    "records",
    "rows",
    "data",
  ]);

  const pipelineNotes = findArrayDeep(pageDataPipeline, [
    "pipeline_notes",
    "pipelineNotes",
    "professor_safe_summary",
    "model_explanation",
    "modelExplanation",
    "explanation",
    "notes",
  ]);

  const decisions = findArrayDeep(cutoffDecisionLog, [
    "decisions",
    "decision_log",
    "decisionLog",
    "records",
    "rows",
    "data",
  ]);

  const rawRows =
    findValueDeep(dataTableAudit, [
      "raw_rows",
      "rawRows",
      "total_rows",
      "totalRows",
      "rows",
      "matrix_rows",
      "matrixRows",
    ]) ??
    findValueDeep(weekdayCleaningAudit, [
      "raw_rows_after_date_parse_and_dedup",
      "raw_rows",
      "rawRows",
      "before_rows",
      "beforeRows",
    ]);

  const rawColumns = findValueDeep(dataTableAudit, [
    "raw_columns",
    "rawColumns",
    "total_columns",
    "totalColumns",
    "columns",
    "matrix_columns",
    "matrixColumns",
  ]);

  const weekdayRows =
    findValueDeep(weekdayCleaningAudit, [
      "weekday_clean_rows",
      "weekdayCleanRows",
      "after_rows",
      "afterRows",
      "rows_after_weekend_removal",
      "rowsAfterWeekendRemoval",
    ]) ?? findValueDeep(forecastStatus, ["weekday_clean_rows", "weekdayCleanRows"]);

  const weekendRemoved = findValueDeep(weekdayCleaningAudit, [
    "saturday_sunday_rows_removed",
    "weekend_rows_removed",
    "weekendRowsRemoved",
    "removed_rows",
    "removedRows",
  ]);

  const duplicateDates = findValueDeep(dataTableAudit, [
    "duplicate_dates",
    "duplicateDates",
    "duplicate_date_count",
    "duplicateDateCount",
  ]);

  const dateEnd =
    findValueDeep(dataTableAudit, [
      "date_end",
      "dateEnd",
      "end_date",
      "endDate",
      "max_date",
      "maxDate",
    ]) ?? findValueDeep(forecastStatus, ["end"]);

  const officialCutoff =
    findValueDeep(forecastStatus, [
      "official_forecast_cutoff_date",
      "officialForecastCutoffDate",
      "cutoff_date",
      "cutoffDate",
      "official_cutoff",
      "officialCutoff",
    ]) ??
    findValueDeep(forecastGovernance, [
      "official_forecast_cutoff_date",
      "officialForecastCutoffDate",
      "cutoff_date",
      "cutoffDate",
      "official_cutoff",
      "officialCutoff",
    ]) ??
    findValueDeep(pageDataPipeline, [
      "official_forecast_cutoff_date",
      "officialForecastCutoffDate",
      "cutoff_date",
      "cutoffDate",
      "official_cutoff",
      "officialCutoff",
    ]);

  const cutoffReason = findValueDeep(forecastStatus, [
    "cutoff_reason",
    "cutoffReason",
    "reason",
  ]);

  const matrixStatus = findValueDeep(forecastStatus, [
    "matrix_status",
    "matrixStatus",
  ]);

  const forecastStatusValue = findValueDeep(forecastStatus, ["status"]);

  const rowsAfterCutoff = findValueDeep(forecastStatus, [
    "display_only_rows_after_cutoff",
    "rows_after_cutoff",
    "rowsAfterCutoff",
  ]);

  const engineeredFeatureCount = findValueDeep(featureEngineeringAudit, [
    "engineered_gold_feature_count",
    "engineeredFeatureCount",
    "feature_count",
    "featureCount",
  ]);

  const loadedCount = results.filter((item) => item.ok).length;

  const sourceCounts = factorRows.reduce((acc: Record<string, number>, row: any) => {
    const source = formatText(row.source || row.source_type || "Unknown");
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {});

  const frequencyCounts = factorRows.reduce((acc: Record<string, number>, row: any) => {
    const frequency = formatText(row.frequency || "Unknown");
    acc[frequency] = (acc[frequency] || 0) + 1;
    return acc;
  }, {});

  const missingTopRows = missingRows.slice(0, 8);

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.2),_transparent_32%),linear-gradient(135deg,_#05070d_0%,_#0b1728_55%,_#000_100%)] px-6 py-14 text-white md:px-10 lg:px-16">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2.2rem] border border-yellow-500/20 bg-white/[0.06] p-8 shadow-2xl backdrop-blur md:p-10">
            <Eyebrow dark>Gold Nexus Alpha</Eyebrow>

            <h1 className="mt-5 text-5xl font-black tracking-tight text-white md:text-7xl">
              Data Pipeline
            </h1>

            <p className="mt-5 max-w-4xl text-base leading-8 text-slate-300 md:text-lg">
              This page turns exported JSON artifacts into a pipeline dashboard: matrix cleaning, factor coverage, cutoff
              governance, model windows, and artifact status.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-yellow-100">
                Artifact Status: {loadedCount}/{results.length} Loaded
              </span>

              <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-blue-100">
                JSON-First Page
              </span>

              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-100">
                Weekday-Clean Matrix
              </span>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-4">
              <DarkKpiCard label="Raw Rows" value={rawRows} />
              <DarkKpiCard label="Raw Columns" value={rawColumns} />
              <DarkKpiCard label="Weekday-Clean Rows" value={weekdayRows} />
              <DarkKpiCard label="Official Cutoff" value={officialCutoff} />
            </div>
          </div>

          <PipelineAnimation />
        </div>
      </section>

      <section className="px-6 py-12 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl space-y-10">
          <CardShell>
            <SectionTitle
              eyebrow="Executive Pipeline Summary"
              title="What the Artifacts Say"
              subtitle="These summary cards are rendered from the exported data and governance JSON files."
            />

            <div className="grid gap-4 md:grid-cols-4">
              <LightMetricCard
                label="Weekend Rows Removed"
                value={weekendRemoved}
                tone="gold"
              />
              <LightMetricCard
                label="Duplicate Dates"
                value={duplicateDates}
                tone="green"
              />
              <LightMetricCard
                label="Matrix Status"
                value={matrixStatus}
                tone="blue"
              />
              <LightMetricCard
                label="Rows After Cutoff"
                value={rowsAfterCutoff}
                tone="slate"
              />
            </div>

            {pipelineNotes.length > 0 ? (
              <div className="mt-7 grid gap-3 md:grid-cols-2">
                {pipelineNotes.map((note, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700"
                  >
                    {formatText(note)}
                  </div>
                ))}
              </div>
            ) : null}
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Factor Registry"
              title="Factor Inventory Cards"
              subtitle="This replaces the raw table with readable factor cards. Empty First Valid / Last Valid columns were removed because the current artifact does not populate them."
            />

            {factorRows.length > 0 ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {factorRows.map((row: any, index: number) => (
                  <FactorCard
                    key={`${row.factor || row.column || row.name || index}`}
                    row={row}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
                factor_inventory.json is missing or did not contain a readable
                factor list.
              </div>
            )}
          </CardShell>

          <div className="grid gap-10 lg:grid-cols-2">
            <CardShell>
              <SectionTitle
                eyebrow="Source Coverage"
                title="Data Source Mix"
                subtitle="This summarizes how many factors come from each source type."
              />

              <div className="space-y-3">
                {Object.entries(sourceCounts).map(([source, count]) => (
                  <div
                    key={source}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <span className="font-black text-slate-950">{source}</span>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-black text-blue-700">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </CardShell>

            <FrequencyMixSection frequencyCounts={frequencyCounts} />
          </div>

          <CardShell>
            <SectionTitle
              eyebrow="Cleaning Logic"
              title="Weekday Cleaning Audit"
              subtitle="The cleaning audit is converted into readable cards instead of showing a raw JSON block."
            />

            <div className="grid gap-4 md:grid-cols-4">
              <LightMetricCard label="Input Rows" value={rawRows} tone="slate" />
              <LightMetricCard label="Clean Rows" value={weekdayRows} tone="green" />
              <LightMetricCard label="Removed Rows" value={weekendRemoved} tone="gold" />
              <LightMetricCard
                label="Wording"
                value={findValueDeep(weekdayCleaningAudit, [
                  "professor_safe_wording",
                  "professorSafeWording",
                ])}
                tone="blue"
              />
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                Cleaning Rule
              </p>
              <p className="mt-3 text-base font-bold leading-7 text-slate-800">
                {formatText(
                  findValueDeep(weekdayCleaningAudit, [
                    "cleaning_rule",
                    "cleaningRule",
                    "rule",
                  ])
                )}
              </p>
            </div>
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Forecast Governance"
              title="Cutoff Control"
              subtitle="This section explains the official forecast cutoff from the governance artifacts."
            />

            <div className="grid gap-4 md:grid-cols-4">
              <LightMetricCard label="Status" value={forecastStatusValue} tone="green" />
              <LightMetricCard label="Official Cutoff" value={officialCutoff} tone="gold" />
              <LightMetricCard label="Rows After Cutoff" value={rowsAfterCutoff} tone="slate" />
              <LightMetricCard label="Matrix End" value={dateEnd} tone="blue" />
            </div>

            <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
                Cutoff Reason
              </p>
              <p className="mt-3 text-base font-bold leading-7 text-slate-800">
                {formatText(cutoffReason)}
              </p>
            </div>
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Decision Log"
              title="Governance Decisions"
              subtitle="Key data-governance decisions are displayed as a decision timeline."
            />

            {decisions.length > 0 ? (
              <DecisionTimeline decisions={decisions} />
            ) : (
              <SourcePreview title="cutoff_decision_log.json" data={cutoffDecisionLog} />
            )}
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Model Windows"
              title="Train / Validation / Test Windows"
              subtitle="Model windows are shown as visual cards, not raw JSON."
            />

            {windowRows.length > 0 ? (
              <div className="grid gap-5 lg:grid-cols-2">
                {windowRows.map((row: any, index: number) => (
                  <WindowCard
                    key={`${row.dataset || row.model_group || row.name || index}`}
                    row={row}
                  />
                ))}
              </div>
            ) : (
              <SourcePreview title="model_window_plan.json" data={modelWindowPlan} />
            )}
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Feature Engineering"
              title="Model-Ready Feature Build"
              subtitle="The feature-engineering audit is summarized into readable cards."
            />

            <div className="grid gap-4 md:grid-cols-4">
              <LightMetricCard
                label="Engineered Feature Count"
                value={engineeredFeatureCount}
                tone="blue"
              />
              <LightMetricCard
                label="Feature Rows Listed"
                value={featureRows.length}
                tone="slate"
              />
              <LightMetricCard
                label="Input Rows"
                value={findValueDeep(featureEngineeringAudit, [
                  "input_rows",
                  "inputRows",
                ])}
                tone="green"
              />
              <LightMetricCard
                label="Cutoff"
                value={findValueDeep(featureEngineeringAudit, [
                  "official_forecast_cutoff_date",
                  "officialForecastCutoffDate",
                  "cutoff_date",
                  "cutoffDate",
                ])}
                tone="gold"
              />
            </div>

            {featureRows.length > 0 ? (
              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {featureRows.slice(0, 12).map((row: any, index: number) => (
                  <div
                    key={`${row.feature || row.column || row.name || index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="font-black text-slate-950">
                      {formatText(row.feature || row.column || row.name)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {formatText(
                        row.description || row.notes || row.type || row.feature_type
                      )}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Missing Values"
              title="Missing-Value Snapshot"
              subtitle="This preview shows the first missing-value records from the artifact."
            />

            {missingTopRows.length > 0 ? (
              <div className="overflow-hidden rounded-3xl border border-slate-200">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Factor</th>
                      <th className="px-4 py-3">Missing Count</th>
                      <th className="px-4 py-3">Missing %</th>
                      <th className="px-4 py-3">First Valid</th>
                      <th className="px-4 py-3">Last Valid</th>
                    </tr>
                  </thead>

                  <tbody>
                    {missingTopRows.map((row: any, index: number) => (
                      <tr key={index} className="border-t border-slate-200">
                        <td className="px-4 py-4 font-bold text-slate-950">
                          {formatText(row.factor || row.column || row.name)}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {formatNumber(row.missing_count)}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {formatText(row.missing_pct || row.missing_percent)}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {formatText(row.first_valid_date)}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {formatText(row.last_valid_date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <SourcePreview title="missing_values_report.json" data={missingValuesReport} />
            )}
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Artifact Status"
              title="JSON Sources Used by This Page"
              subtitle="This stays visible because every page must show artifact loading status."
            />

            <ArtifactStatusTable results={results} />
          </CardShell>

          <CardShell className="mb-10">
            <SectionTitle
              eyebrow="Source Preview"
              title="Optional Raw Artifact Preview"
              subtitle="Raw JSON is hidden by default. This keeps the page friendly while still proving the source artifacts exist."
            />

            <div className="grid gap-4">
              <SourcePreview title="page_data_pipeline.json" data={pageDataPipeline} />
              <SourcePreview title="forecast_status.json" data={forecastStatus} />
              <SourcePreview
                title="feature_engineering_audit.json"
                data={featureEngineeringAudit}
              />
            </div>
          </CardShell>
        </div>
      </section>
    </main>
  );
}
