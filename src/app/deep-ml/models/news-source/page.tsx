import type { ReactNode } from "react";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ArtifactKind = "json" | "csv";
type ArtifactRequest = { key: string; label: string; path: string; kind: ArtifactKind };
type ArtifactResult = ArtifactRequest & { ok: boolean; data: any; error?: string };

const ARTIFACTS: ArtifactRequest[] = [
  { key: "report", label: "Phase 12 Report", path: "artifacts/deep_ml/news/phase12_source_news_update_report.json", kind: "json" },
  { key: "inventory", label: "News Source Inventory", path: "artifacts/deep_ml/news/news_source_inventory.json", kind: "json" },
  { key: "coverage", label: "News Source Coverage Preview", path: "artifacts/deep_ml/news/news_source_coverage_preview.json", kind: "json" },
  { key: "quality", label: "Quality Review", path: "artifacts/deep_ml/news/quality_review.json", kind: "json" },
  { key: "diagnostics", label: "Diagnostics Latest", path: "artifacts/deep_ml/news/diagnostics_latest.json", kind: "json" },
  { key: "manifest", label: "Historical Manifest", path: "artifacts/deep_ml/news/historical/historical_news_backfill_manifest.json", kind: "json" },
  { key: "historical", label: "Historical Daily Index", path: "artifacts/deep_ml/news/historical/historical_news_daily_index.csv", kind: "csv" },
  { key: "recent", label: "Unified Recent News", path: "artifacts/deep_ml/news/news_items_unified_raw.csv", kind: "csv" },
  { key: "combined", label: "Combined Daily Context", path: "artifacts/deep_ml/news/structured/news_context_daily_combined.csv", kind: "csv" },
  { key: "rawLog", label: "Raw Pull Log", path: "artifacts/deep_ml/news/raw_news_pull_log.json", kind: "json" },
];

function cleanPath(value: string) { return value.trim().replace(/^\/+/, "").replace(/\\/g, "/"); }
function publicHref(value: string) { return `/${cleanPath(value).replace(/^public\//, "")}`; }
function getBaseUrl() { return (process.env.NEXT_PUBLIC_ARTIFACT_BASE_URL || "").trim().replace(/\/+$/, ""); }
async function readLocalText(relativePath: string) {
  const normalized = cleanPath(relativePath);
  try { return await fs.readFile(path.join(process.cwd(), "public", normalized), "utf-8"); }
  catch { return await fs.readFile(path.join(process.cwd(), normalized), "utf-8"); }
}
function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inside = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') { inside = !inside; continue; }
    if (char === "," && !inside) { cells.push(current); current = ""; continue; }
    current += char;
  }
  cells.push(current);
  return cells;
}
function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).filter(Boolean).map((line) => {
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
    const text = base
      ? await (await fetch(`${base}/${cleanPath(artifact.path)}`, { cache: "no-store" })).text()
      : await readLocalText(artifact.path);
    return { ...artifact, ok: true, data: artifact.kind === "json" ? JSON.parse(text) : parseCsv(text) };
  } catch (error) {
    return { ...artifact, ok: false, data: artifact.kind === "csv" ? [] : null, error: error instanceof Error ? error.message : "Artifact load failed" };
  }
}
async function loadArtifacts() { return Promise.all(ARTIFACTS.map(loadArtifact)); }
function getArtifact(results: ArtifactResult[], key: string) { return results.find((x) => x.key === key)?.data; }
function fmtNum(value: any, digits = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "Not in artifact";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
function fmtDate(value: any) {
  if (!value) return "Not in artifact";
  const text = String(value);
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text;
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "2-digit", hour: "numeric", minute: "2-digit" }).format(d);
}
function statusClass(status: any) {
  const s = String(status || "").toLowerCase();
  if (s.includes("ready") || s.includes("loaded")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s.includes("warning") || s.includes("review")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (s.includes("fail") || s.includes("block") || s.includes("missing")) return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}
function StatusPill({ status }: { status: any }) { return <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(status)}`}>{status || "Not in artifact"}</span>; }
function MetricCard({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{label}</div><div className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</div>{note ? <div className="mt-3 text-xs font-semibold leading-5 text-slate-500">{note}</div> : null}</div>;
}
function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div className="mb-8"><div className="mb-3 text-[11px] font-black uppercase tracking-[0.35em] text-blue-600">{eyebrow}</div><h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">{title}</h2>{description ? <p className="mt-3 max-w-5xl text-sm font-medium leading-7 text-slate-500">{description}</p> : null}</div>;
}
function InfoLine({ label, value }: { label: string; value: ReactNode }) {
  const empty = value === null || value === undefined || value === "";
  return <div className="grid grid-cols-[205px_1fr] gap-3 border-b border-slate-100 pb-3 last:border-b-0"><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span><span className="break-words text-sm font-bold text-slate-700">{empty ? "Not in artifact" : value}</span></div>;
}
function NewsHero() {
  const dots = Array.from({ length: 34 }, (_, i) => <span key={i} className="news-dot" style={{ left: `${5 + ((i * 29) % 90)}%`, top: `${9 + ((i * 41) % 78)}%`, animationDelay: `${i * 0.1}s` }} />);
  return <div className="relative min-h-[420px] overflow-hidden rounded-[3rem] border border-slate-200 bg-slate-950 p-8 shadow-2xl shadow-amber-950/20"><style>{`
    .news-grid{background-image:linear-gradient(rgba(250,204,21,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(250,204,21,.12) 1px,transparent 1px);background-size:34px 34px;animation:news-grid 20s linear infinite}.news-orb{position:absolute;right:10%;top:13%;width:250px;height:250px;border-radius:999px;display:grid;place-items:center;color:rgba(253,224,71,.98);font-size:116px;font-weight:1000;background:radial-gradient(circle at 35% 30%,rgba(250,204,21,.45),transparent 35%),radial-gradient(circle at 75% 75%,rgba(59,130,246,.22),transparent 38%),rgba(15,23,42,.7);border:1px solid rgba(253,224,71,.35);box-shadow:0 0 90px rgba(250,204,21,.24),inset 0 0 80px rgba(253,224,71,.14);animation:news-float 5.8s ease-in-out infinite}.news-dot{position:absolute;width:8px;height:8px;border-radius:999px;background:rgba(250,204,21,.96);box-shadow:0 0 18px rgba(250,204,21,.82),0 0 36px rgba(59,130,246,.35);animation:news-pulse 2.35s ease-in-out infinite}@keyframes news-grid{from{transform:translate3d(0,0,0)}to{transform:translate3d(34px,34px,0)}}@keyframes news-float{0%,100%{transform:translate3d(0,0,0) rotate(-4deg)}50%{transform:translate3d(0,-17px,0) rotate(4deg)}}@keyframes news-pulse{0%,100%{opacity:.38;transform:scale(.65)}50%{opacity:1;transform:scale(1.35)}}`}</style><div className="news-grid absolute inset-0 opacity-70" /><div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(250,204,21,0.16),transparent_29%),radial-gradient(circle_at_66%_46%,rgba(59,130,246,0.26),transparent_38%)]" /><div className="news-orb">N</div>{dots}<div className="relative z-10 flex min-h-[350px] max-w-4xl flex-col justify-between"><div><div className="inline-flex rounded-full border border-yellow-300/30 bg-yellow-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-yellow-100">Phase 12 Source Layer</div><h1 className="mt-8 text-5xl font-black tracking-tight text-white md:text-7xl">News Source</h1><p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-yellow-50/80">Artifact-driven source coverage page for the historical daily news index, recent news inventory, and Gamma tooltip preparation.</p></div><div className="grid gap-3 md:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><div className="text-[9px] font-black uppercase tracking-widest text-white/50">Historical rows</div><div className="mt-2 text-sm font-black text-white">Continuity/index rows</div></div><div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><div className="text-[9px] font-black uppercase tracking-widest text-white/50">Recent headlines</div><div className="mt-2 text-sm font-black text-white">Context/tooltips only</div></div><div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><div className="text-[9px] font-black uppercase tracking-widest text-white/50">Guardrail</div><div className="mt-2 text-sm font-black text-white">No causality claim</div></div></div></div></div>;
}
function SourceCards({ sources }: { sources: any[] }) {
  if (!Array.isArray(sources) || !sources.length) return null;
  return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{sources.map((s) => <div key={s.source_key} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div className="text-lg font-black tracking-tight text-slate-950">{s.source_key}</div><StatusPill status={s.status} /></div><div className="mt-4 grid gap-3"><InfoLine label="Source type" value={s.source_type} /><InfoLine label="Enabled" value={String(s.enabled)} /><InfoLine label="Rows loaded" value={fmtNum(s.rows_loaded)} /></div></div>)}</div>;
}
function RecentNewsTable({ rows }: { rows: any[] }) {
  const clean = rows.slice().sort((a, b) => String(b.published_at || b.date).localeCompare(String(a.published_at || a.date))).slice(0, 24);
  if (!clean.length) return null;
  return <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm"><div className="grid grid-cols-[130px_160px_1fr_130px] bg-slate-50 px-5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400"><span>Date</span><span>Source</span><span>Headline</span><span>Type</span></div>{clean.map((r, i) => <div key={`${r.unified_news_item_id || r.source_item_id || i}`} className="grid grid-cols-[130px_160px_1fr_130px] border-t border-slate-100 px-5 py-4 text-xs font-bold text-slate-700"><span>{fmtDate(r.date || r.published_at)}</span><span className="truncate">{r.source || "Not in artifact"}</span><span className="leading-5">{r.title || "Not in artifact"}</span><span className="truncate">{r.raw_source || r.query_key || "context"}</span></div>)}</div>;
}
function DailyContextTable({ rows }: { rows: any[] }) {
  const clean = rows.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 18);
  if (!clean.length) return null;
  return <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm"><div className="grid grid-cols-[130px_110px_150px_1fr] bg-slate-50 px-5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400"><span>Date</span><span>Articles</span><span>Source type</span><span>Top headline / coverage note</span></div>{clean.map((r, i) => <div key={`${r.date}-${i}`} className="grid grid-cols-[130px_110px_150px_1fr] border-t border-slate-100 px-5 py-4 text-xs font-bold text-slate-700"><span>{fmtDate(r.date)}</span><span>{fmtNum(r.article_count)}</span><span className="truncate">{r.source_type || "Not in artifact"}</span><span className="leading-5">{r.top_headline_1 || r.source_coverage_note || "Not in artifact"}</span></div>)}</div>;
}
function DownloadList({ results }: { results: ArtifactResult[] }) {
  return <div className="grid gap-3">{ARTIFACTS.map((a) => { const r = results.find((x) => x.key === a.key); return <div key={a.key} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-black text-slate-900">{a.label}</span><StatusPill status={r?.ok ? "loaded" : "missing"} /></div><div className="mt-2 break-all text-xs font-semibold text-slate-500">{a.path}</div>{!r?.ok && r?.error ? <div className="mt-2 text-xs font-semibold text-rose-600">{r.error}</div> : null}</div><a href={publicHref(a.path)} download className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-700 transition hover:border-blue-300 hover:bg-blue-100">Download</a></div>; })}</div>;
}

export default async function NewsSourcePage() {
  const results = await loadArtifacts();
  const report = getArtifact(results, "report");
  const inventory = getArtifact(results, "inventory") || report?.source_inventory_snapshot;
  const coverage = getArtifact(results, "coverage") || report?.coverage_preview_snapshot;
  const quality = getArtifact(results, "quality") || report?.quality_review;
  const diagnostics = getArtifact(results, "diagnostics") || report?.diagnostics_snapshot;
  const manifest = getArtifact(results, "manifest") || report?.historical_manifest_snapshot;
  const recentRows = getArtifact(results, "recent") || [];
  const combinedRows = getArtifact(results, "combined") || [];
  const historicalRows = getArtifact(results, "historical") || [];
  const summary = report?.source_summary || {};
  const loadedCount = results.filter((x) => x.ok).length;
  const sources = inventory?.sources || [];
  return <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900"><div className="mx-auto max-w-[1800px]"><NewsHero />
    <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4"><MetricCard label="Phase 12 Status" value={<StatusPill status={report?.status || quality?.status} />} note={`${loadedCount}/${ARTIFACTS.length} page artifacts loaded.`} /><MetricCard label="Historical Daily Rows" value={fmtNum(summary.historical_daily_rows || historicalRows.length)} note="Fixed daily continuity/index rows." /><MetricCard label="Loaded Public-Source Rows" value={fmtNum(summary.historical_rows_with_loaded_public_source)} note="Rows where public source coverage was loaded." /><MetricCard label="Unified Recent Rows" value={fmtNum(summary.unified_recent_rows_after_dedupe || recentRows.length)} note="Recent news rows after source dedupe." /></section>
    <section className="mt-10 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"><div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm"><SectionHeader eyebrow="Source Update Summary" title="Phase 12 News Source artifact summary" description="This page describes source coverage for Gamma preparation. It does not forecast gold and does not claim that news caused price movement." /><div className="grid gap-3"><InfoLine label="Run ID" value={report?.run?.run_id} /><InfoLine label="Study ID" value={report?.run?.study_id} /><InfoLine label="Generated local" value={fmtDate(report?.run?.generated_at_local)} /><InfoLine label="Completed UTC" value={fmtDate(report?.run?.completed_at_utc)} /><InfoLine label="Code version" value={report?.run?.code_version} /><InfoLine label="Git commit" value={report?.run?.git_commit_sha} /><InfoLine label="Canonical directory" value={inventory?.canonical_directory || "artifacts/deep_ml/news"} /><InfoLine label="Script path" value={inventory?.script_path || "deep_ml/scripts/12_source_news_update.py"} /></div></div><div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm"><SectionHeader eyebrow="Quality Review" title="Acceptance gate" /><div className="grid gap-3"><InfoLine label="Quality status" value={<StatusPill status={quality?.status} />} /><InfoLine label="Blocking flags" value={Array.isArray(quality?.blocking_flags) ? quality.blocking_flags.length : "Not in artifact"} /><InfoLine label="Warnings" value={Array.isArray(quality?.warnings) ? quality.warnings.length : "Not in artifact"} /><InfoLine label="Historical exists" value={String(quality?.acceptance_gate?.historical_daily_index_exists)} /><InfoLine label="Combined context exists" value={String(quality?.acceptance_gate?.combined_daily_context_exists)} /><InfoLine label="Recent/manual loaded" value={String(quality?.acceptance_gate?.recent_or_manual_news_loaded)} /></div></div></section>
    <section className="mt-14"><SectionHeader eyebrow="Source Inventory" title="News source inventory" description="Rows loaded by each source. Google News RSS is treated as a recent fallback only, not a historical archive." /><SourceCards sources={sources} /></section>
    <section className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4"><MetricCard label="GDELT recent rows" value={fmtNum(summary.gdelt_recent_rows)} note="Public no-key API rows." /><MetricCard label="RSS recent rows" value={fmtNum(summary.rss_recent_rows)} note="Recent Google News RSS fallback rows." /><MetricCard label="NewsAPI rows" value={fmtNum(summary.newsapi_recent_rows)} note="Optional key source; may be skipped." /><MetricCard label="Combined context rows" value={fmtNum(summary.combined_daily_context_rows || combinedRows.length)} note="Historical + recent daily context rows." /></section>
    <section className="mt-14 rounded-[3rem] border border-amber-200 bg-amber-50 p-8 shadow-sm"><SectionHeader eyebrow="Professor-Safe Interpretation" title="Coverage notes and forbidden claims" description="These rules come from the Phase 12 report and must carry into Gamma, Omega, tooltips, and the future AI interpreter." /><div className="grid gap-5 xl:grid-cols-2"><div className="rounded-[2rem] border border-emerald-200 bg-white p-6"><div className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">Allowed wording</div><div className="mt-4 grid gap-3">{(report?.ai_grounding?.allowed_claims || []).map((c: string) => <div key={c} className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-900">{c}</div>)}</div></div><div className="rounded-[2rem] border border-rose-200 bg-white p-6"><div className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-600">Forbidden wording</div><div className="mt-4 grid gap-3">{(report?.ai_grounding?.forbidden_claims || []).map((c: string) => <div key={c} className="rounded-2xl bg-rose-50 p-4 text-sm font-bold leading-6 text-rose-900">{c}</div>)}</div></div></div></section>
    <section className="mt-14"><SectionHeader eyebrow="Coverage Preview" title="Recent source coverage preview" description="This section summarizes recent source coverage only. It does not evaluate causal price impact." /><div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]"><div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm"><div className="grid gap-3"><InfoLine label="Coverage status" value={<StatusPill status={coverage?.status} />} /><InfoLine label="Recent row count" value={fmtNum(coverage?.recent_row_count)} /><InfoLine label="Historical daily rows" value={fmtNum(coverage?.historical_daily_row_count)} /><InfoLine label="Rows with source" value={fmtNum(coverage?.historical_rows_with_loaded_public_source)} /><InfoLine label="Generated" value={fmtDate(coverage?.generated_at_utc)} /></div></div><div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm"><div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Top recent sources</div><div className="mt-5 grid gap-3">{Object.entries(coverage?.top_sources || {}).slice(0, 12).map(([source, count]) => <div key={source} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black"><span className="truncate text-slate-700">{source}</span><span className="text-slate-950">{fmtNum(count)}</span></div>)}</div></div></div></section>
    <section className="mt-14"><SectionHeader eyebrow="Recent Headlines" title="Unified recent news inventory" description="Recent headlines may later support Gamma tooltips and page context. They are not presented as causal drivers." /><RecentNewsTable rows={recentRows} /></section>
    <section className="mt-14"><SectionHeader eyebrow="Daily Context" title="Latest combined daily news-context rows" description="Combined context merges fixed historical daily rows with recent source rows for Gamma preparation." /><DailyContextTable rows={combinedRows} /></section>
    <section className="mt-14 grid gap-6 xl:grid-cols-2"><div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm"><SectionHeader eyebrow="Historical Index" title="Historical backfill manifest" description="After the incremental patch, future runs should reuse the historical index and only append missing dates unless --force-historical is used." /><div className="grid gap-3"><InfoLine label="Historical start" value={fmtDate(manifest?.historical_start_date)} /><InfoLine label="Historical end" value={fmtDate(manifest?.historical_end_date)} /><InfoLine label="Rows" value={fmtNum(manifest?.row_count)} /><InfoLine label="Rows with source" value={fmtNum(manifest?.rows_with_loaded_public_source)} /><InfoLine label="Cache used" value={String(manifest?.cache_used)} /><InfoLine label="Incremental used" value={String(manifest?.incremental_update_used)} /><InfoLine label="Full rebuild used" value={String(manifest?.full_rebuild_used)} /><InfoLine label="RSS policy" value={manifest?.google_news_rss_policy} /></div></div><div className="rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm"><SectionHeader eyebrow="Diagnostics" title="Run diagnostics" description="Diagnostics describe execution and output hashes only." /><div className="grid gap-3"><InfoLine label="Mode" value={diagnostics?.mode} /><InfoLine label="Effective through" value={fmtDate(diagnostics?.effective_data_through_date)} /><InfoLine label="Forecast start" value={fmtDate(diagnostics?.forecast_start_date)} /><InfoLine label="Recent window days" value={fmtNum(diagnostics?.recent_window_days)} /><InfoLine label="Historical cache used" value={String(diagnostics?.historical_cache_used)} /><InfoLine label="Incremental update" value={String(diagnostics?.historical_incremental_update_used)} /><InfoLine label="Python version" value={diagnostics?.python_version} /></div></div></section>
    <section className="mt-14 rounded-[3rem] border border-slate-200 bg-white p-8 shadow-sm"><SectionHeader eyebrow="Artifact Downloads" title="Source files used on this page" description="The News Source page reads only canonical Phase 12 artifacts under artifacts/deep_ml/news." /><DownloadList results={results} /></section>
  </div></main>;
}
