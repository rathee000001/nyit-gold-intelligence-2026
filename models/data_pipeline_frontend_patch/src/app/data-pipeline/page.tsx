import React from "react";
import { artifactPaths } from "@/lib/artifactPaths";
import { loadArtifacts, type ArtifactResult } from "@/lib/artifactClient";
import { asArray, formatNumber, formatPercent, pickFirst, toTitleLabel } from "@/lib/formatters";

type JsonObject = Record<string, unknown>;

const requiredArtifacts = {
  page: artifactPaths.pages.dataPipeline,
  factorInventory: artifactPaths.data.factorInventory,
  dataTableAudit: artifactPaths.data.dataTableAudit,
  weekdayCleaningAudit: artifactPaths.data.weekdayCleaningAudit,
  missingValuesReport: artifactPaths.data.missingValuesReport,
  forecastStatus: artifactPaths.governance.forecastStatus,
  modelWindowPlan: artifactPaths.governance.modelWindowPlan,
};

function getData(result: ArtifactResult): JsonObject {
  return result.ok && result.data && typeof result.data === "object" && !Array.isArray(result.data)
    ? (result.data as JsonObject)
    : {};
}

function getRows(result: ArtifactResult): JsonObject[] {
  if (!result.ok || !result.data) return [];
  if (Array.isArray(result.data)) return result.data.filter((row) => row && typeof row === "object") as JsonObject[];

  const data = result.data as JsonObject;
  const candidates = [data.factors, data.factor_inventory, data.rows, data.data, data.records, data.missing_values];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter((row) => row && typeof row === "object") as JsonObject[];
  }
  return [];
}

function metricFrom(...objects: JsonObject[]) {
  return (keys: string[], fallback: unknown = "—") => {
    for (const obj of objects) {
      const value = pickFirst(obj, keys, undefined);
      if (value !== undefined) return value;
    }
    return fallback;
  };
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-amber-700">
      {children}
    </span>
  );
}

function SectionCard({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-xl shadow-slate-200/60 backdrop-blur-xl">
      {eyebrow ? <p className="mb-2 text-[11px] font-black uppercase tracking-[0.25em] text-blue-600">{eyebrow}</p> : null}
      <h2 className="mb-5 text-2xl font-black tracking-tight text-slate-950">{title}</h2>
      {children}
    </section>
  );
}

function KpiCard({ label, value, subtext }: { label: string; value: React.ReactNode; subtext?: React.ReactNode }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</div>
      {subtext ? <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">{subtext}</p> : null}
    </div>
  );
}

function ArtifactStatus({ name, result }: { name: string; result: ArtifactResult }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-black uppercase tracking-widest text-slate-700">{name}</p>
        <p className="truncate text-[11px] font-medium text-slate-400">{result.path}</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${result.ok ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
        {result.ok ? "Loaded" : "Missing"}
      </span>
    </div>
  );
}

function FactorRegistryTable({ rows }: { rows: JsonObject[] }) {
  const visibleRows = rows.slice(0, 40);

  if (!visibleRows.length) {
    return <p className="rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">No factor registry rows were found in the current artifact.</p>;
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
      <div className="max-h-[620px] overflow-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-950 text-white">
            <tr>
              {["factor", "start_date", "frequency", "source", "main_model_use", "notes"].map((key) => (
                <th key={key} className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.18em]">
                  {toTitleLabel(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((row, index) => (
              <tr key={`${row.factor ?? row.name ?? index}`} className="hover:bg-amber-50/40">
                <td className="px-4 py-4 font-black text-slate-900">{String(row.factor ?? row.name ?? "—")}</td>
                <td className="px-4 py-4 font-semibold text-slate-600">{String(row.start_date ?? row.source_start_date ?? row.locked_start_date ?? "—")}</td>
                <td className="px-4 py-4 font-semibold text-slate-600">{String(row.frequency ?? "—")}</td>
                <td className="px-4 py-4 font-semibold text-slate-600">{String(row.source ?? row.source_type ?? "—")}</td>
                <td className="px-4 py-4 font-semibold text-slate-600">{String(row.main_model_use ?? row.main_use ?? "—")}</td>
                <td className="px-4 py-4 text-slate-500">{String(row.notes ?? row.audit_note ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MissingValuesTable({ rows }: { rows: JsonObject[] }) {
  const visibleRows = rows.slice(0, 40);

  if (!visibleRows.length) {
    return <p className="rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">No missing-value rows were found in the current artifact.</p>;
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
            <tr>
              {["factor", "missing_count", "missing_pct", "first_valid_date", "last_valid_date"].map((key) => (
                <th key={key} className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.18em]">
                  {toTitleLabel(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((row, index) => (
              <tr key={`${row.factor ?? row.column ?? index}`}>
                <td className="px-4 py-4 font-black text-slate-900">{String(row.factor ?? row.column ?? "—")}</td>
                <td className="px-4 py-4 font-semibold text-slate-600">{formatNumber(row.missing_count ?? row.missing_values)}</td>
                <td className="px-4 py-4 font-semibold text-slate-600">{formatPercent(row.missing_pct ?? row.missing_percent)}</td>
                <td className="px-4 py-4 font-semibold text-slate-600">{String(row.first_valid_date ?? row.observed_first_valid_date ?? "—")}</td>
                <td className="px-4 py-4 font-semibold text-slate-600">{String(row.last_valid_date ?? row.observed_last_valid_date ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WindowPlanTable({ data }: { data: JsonObject }) {
  const rows = asArray<JsonObject>(data.windows ?? data.model_windows ?? data.datasets ?? data.rows);

  if (!rows.length) {
    return <p className="rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">No model-window rows were found in the current artifact.</p>;
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-950 text-white">
          <tr>
            {["dataset", "use", "start", "end", "train", "validation", "test"].map((key) => (
              <th key={key} className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.18em]">
                {toTitleLabel(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={`${row.dataset ?? row.name ?? index}`}>
              <td className="px-4 py-4 font-black text-slate-900">{String(row.dataset ?? row.name ?? row.window_name ?? "—")}</td>
              <td className="px-4 py-4 text-slate-500">{String(row.use ?? row.used_for ?? row.purpose ?? "—")}</td>
              <td className="px-4 py-4 font-semibold text-slate-600">{String(row.start ?? row.start_date ?? "—")}</td>
              <td className="px-4 py-4 font-semibold text-slate-600">{String(row.end ?? row.end_date ?? "—")}</td>
              <td className="px-4 py-4 font-semibold text-slate-600">{String(row.train ?? row.train_window ?? row.train_range ?? "—")}</td>
              <td className="px-4 py-4 font-semibold text-slate-600">{String(row.validation ?? row.validation_window ?? row.validation_range ?? "—")}</td>
              <td className="px-4 py-4 font-semibold text-slate-600">{String(row.test ?? row.test_window ?? row.test_range ?? "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function DataPipelinePage() {
  const artifacts = await loadArtifacts(requiredArtifacts);

  const page = getData(artifacts.page);
  const dataAudit = getData(artifacts.dataTableAudit);
  const cleaningAudit = getData(artifacts.weekdayCleaningAudit);
  const forecastStatus = getData(artifacts.forecastStatus);
  const modelWindowPlan = getData(artifacts.modelWindowPlan);
  const factorRows = getRows(artifacts.factorInventory);
  const missingRows = getRows(artifacts.missingValuesReport);
  const getMetric = metricFrom(page, dataAudit, cleaningAudit, forecastStatus);

  const title = String(page.page_title ?? page.title ?? "Data Pipeline");
  const subtitle = String(
    page.page_subtitle ??
      page.subtitle ??
      "Artifact-grounded data cleaning, factor coverage, cutoff governance, and model-window status."
  );

  return (
    <main className="min-h-screen bg-[#F4F7FE] px-6 py-10 text-slate-900 lg:px-10">
      <div className="mx-auto max-w-[1600px] space-y-8">
        <section className="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-slate-950 p-8 text-white shadow-2xl shadow-slate-300/70 lg:p-12">
          <div className="absolute right-[-10%] top-[-40%] h-[360px] w-[360px] rounded-full bg-amber-400/20 blur-[90px]" />
          <div className="absolute bottom-[-30%] left-[-10%] h-[320px] w-[320px] rounded-full bg-blue-500/20 blur-[100px]" />
          <div className="relative z-10 max-w-4xl">
            <StatusPill>Gold Nexus Alpha</StatusPill>
            <h1 className="mt-6 text-4xl font-black tracking-tight md:text-6xl">{title}</h1>
            <p className="mt-5 max-w-3xl text-base font-medium leading-8 text-slate-300 md:text-lg">{subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-white/80">JSON-first page</span>
              <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-white/80">Weekday-clean matrix</span>
              <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-white/80">Professor-style governance</span>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Raw Rows" value={formatNumber(getMetric(["raw_rows", "total_rows", "rows"]))} subtext="Loaded from the current matrix audit artifact." />
          <KpiCard label="Weekday-Clean Rows" value={formatNumber(getMetric(["weekday_rows", "weekday_clean_rows", "rows_after_weekend_removal"]))} subtext="Saturday and Sunday observations removed." />
          <KpiCard label="Rows Removed" value={formatNumber(getMetric(["weekend_rows_removed", "saturday_sunday_rows_removed", "removed_weekend_rows"]))} subtext="Weekend rows excluded before modeling." />
          <KpiCard label="Official Cutoff" value={String(getMetric(["official_forecast_cutoff_date", "cutoff_date", "official_cutoff"], "—"))} subtext="Forecast governance value loaded from artifacts." />
        </section>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <SectionCard eyebrow="Registry" title="Factor Inventory">
            <FactorRegistryTable rows={factorRows} />
          </SectionCard>

          <SectionCard eyebrow="Artifacts" title="Source JSON Status">
            <div className="space-y-3">
              {Object.entries(artifacts).map(([name, result]) => (
                <ArtifactStatus key={name} name={toTitleLabel(name)} result={result} />
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          <SectionCard eyebrow="Cleaning" title="Weekday Cleaning Audit">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <KpiCard label="Start Date" value={String(getMetric(["start_date", "raw_start_date", "date_min"], "—"))} />
              <KpiCard label="End Date" value={String(getMetric(["end_date", "raw_end_date", "date_max"], "—"))} />
              <KpiCard label="Duplicate Dates" value={formatNumber(getMetric(["duplicate_dates", "duplicate_date_count"], "—"))} />
              <KpiCard label="Columns" value={formatNumber(getMetric(["columns", "column_count", "total_columns"], "—"))} />
            </div>
          </SectionCard>

          <SectionCard eyebrow="Governance" title="Model Window Plan">
            <WindowPlanTable data={modelWindowPlan} />
          </SectionCard>
        </div>

        <SectionCard eyebrow="Quality" title="Missing Values Report">
          <MissingValuesTable rows={missingRows} />
        </SectionCard>
      </div>
    </main>
  );
}
