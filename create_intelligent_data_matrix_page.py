from pathlib import Path

PAGE = Path("src/app/data-matrix/page.tsx")
PAGE.parent.mkdir(parents=True, exist_ok=True)

PAGE.write_text(r'''
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

type DataArtifact = {
  key: string;
  label: string;
  path: string;
  type: "json" | "csv";
  phase?: string;
  note?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  mode?: string;
};

const DATA_ARTIFACTS: DataArtifact[] = [
  {
    key: "matrixCsv",
    label: "Deep ML Refreshed Matrix",
    path: "artifacts/deep_ml/features/deep_ml_refreshed_matrix.csv",
    type: "csv",
    phase: "Step 11",
    note: "Primary refreshed model matrix used by the Deep ML system.",
  },
  {
    key: "featureStoreManifest",
    label: "Numeric Feature Store Manifest",
    path: "artifacts/deep_ml/features/deep_ml_numeric_feature_store_manifest.json",
    type: "json",
    phase: "Step 11",
  },
  {
    key: "featureManifest",
    label: "Feature Manifest",
    path: "artifacts/deep_ml/features/feature_manifest.json",
    type: "json",
    phase: "Step 11",
  },
  {
    key: "featureStoreStatus",
    label: "Feature Store Status",
    path: "artifacts/deep_ml/features/feature_store_status.json",
    type: "json",
    phase: "Step 11",
  },
  {
    key: "modelFeaturePlan",
    label: "Model Feature Plan",
    path: "artifacts/deep_ml/features/model_feature_plan.json",
    type: "json",
    phase: "Step 11",
  },
  {
    key: "targetPlan",
    label: "Target Plan",
    path: "artifacts/deep_ml/features/target_plan.json",
    type: "json",
    phase: "Step 11",
  },
  {
    key: "phase11Report",
    label: "Phase 11 Governed Feature Store Refresh",
    path: "artifacts/deep_ml/feature_refresh/phase11_governed_feature_store_refresh_report.json",
    type: "json",
    phase: "Step 11",
  },
  {
    key: "phase11Quality",
    label: "Phase 11 Quality Review",
    path: "artifacts/deep_ml/feature_refresh/quality_review.json",
    type: "json",
    phase: "Step 11",
  },
  {
    key: "factorState",
    label: "Factor State Table",
    path: "artifacts/deep_ml/data/factor_state_table.json",
    type: "json",
    phase: "Step 3 / 11",
  },
  {
    key: "factorStaleness",
    label: "Factor Staleness Report",
    path: "artifacts/deep_ml/data/factor_staleness_report.json",
    type: "json",
    phase: "Step 3 / 11",
  },
  {
    key: "dataQuality",
    label: "Data Quality Flags",
    path: "artifacts/deep_ml/data/data_quality_flags.json",
    type: "json",
    phase: "Step 3 / 11",
  },
  {
    key: "effectiveWindow",
    label: "Effective Data Window",
    path: "artifacts/deep_ml/governance/effective_data_window.json",
    type: "json",
    phase: "Governance",
  },
  {
    key: "cutoffGovernance",
    label: "Deep ML Cutoff Governance",
    path: "artifacts/deep_ml/governance/deep_ml_cutoff_governance.json",
    type: "json",
    phase: "Governance",
  },
  {
    key: "forecastStart",
    label: "Forecast Start Decision",
    path: "artifacts/deep_ml/governance/forecast_start_decision.json",
    type: "json",
    phase: "Governance",
  },
  {
    key: "studyContext",
    label: "Study Context",
    path: "artifacts/deep_ml/governance/study_context.json",
    type: "json",
    phase: "Governance",
  },
  {
    key: "phase10Report",
    label: "Phase 10 Source Update Refresh",
    path: "artifacts/deep_ml/source_update/phase10_source_update_refresh_report.json",
    type: "json",
    phase: "Step 10",
  },
  {
    key: "goldLiveSummary",
    label: "Gold Live Update Summary",
    path: "artifacts/deep_ml/source_update/gold_live_update_summary.json",
    type: "json",
    phase: "Step 10A",
  },
  {
    key: "goldLiveInventory",
    label: "Gold Live Price Inventory",
    path: "artifacts/deep_ml/source_update/gold_live_price_inventory.json",
    type: "json",
    phase: "Step 10A",
  },
  {
    key: "sourceManifest",
    label: "Source Update Manifest",
    path: "artifacts/deep_ml/source_update/source_update_manifest.json",
    type: "json",
    phase: "Step 10",
  },
  {
    key: "sourceQuality",
    label: "Source Update Quality Review",
    path: "artifacts/deep_ml/source_update/source_update_quality_review.json",
    type: "json",
    phase: "Step 10",
  },
  {
    key: "academicDataAudit",
    label: "Academic Data Table Audit",
    path: "artifacts/data/data_table_audit.json",
    type: "json",
    phase: "Academic baseline",
  },
  {
    key: "weekdayAudit",
    label: "Weekday Cleaning Audit",
    path: "artifacts/data/weekday_cleaning_audit.json",
    type: "json",
    phase: "Academic baseline",
  },
];

function cleanHref(pathValue: string) {
  return `/${String(pathValue || "").replace(/^\/+/, "").replace(/^public\//, "")}`;
}

function normalizePath(pathValue: string) {
  return String(pathValue || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function formatBytes(value: number) {
  if (!Number.isFinite(value)) return "Not in artifact";
  if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`;
  if (value > 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function formatNumber(value: any, digits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not in artifact";
  return numeric.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function formatMaybe(value: any) {
  if (value === undefined || value === null || value === "") return "Not in artifact";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
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

function parseCsv(text: string, maxRows = 25000) {
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

function isRecord(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function findValueDeep(obj: any, keys: string[], depth = 0): any {
  if (!obj || depth > 8) return null;

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

function rowsFromJson(value: any): any[] {
  if (Array.isArray(value)) {
    return value.filter((row) => isRecord(row));
  }

  if (!isRecord(value)) return [];

  const keys = [
    "rows",
    "data",
    "items",
    "records",
    "factors",
    "factor_state_table",
    "factor_states",
    "quality_flags",
    "staleness",
    "features",
    "artifacts",
  ];

  for (const key of keys) {
    const item = value[key];
    if (Array.isArray(item)) return item.filter((row) => isRecord(row));
    if (isRecord(item)) {
      const nested = rowsFromJson(item);
      if (nested.length) return nested;
    }
  }

  for (const item of Object.values(value)) {
    if (Array.isArray(item) && item.some((row) => isRecord(row))) {
      return item.filter((row) => isRecord(row));
    }

    if (isRecord(item)) {
      const nested = rowsFromJson(item);
      if (nested.length) return nested;
    }
  }

  return [];
}

function columnsFromRows(rows: any[]) {
  const cols = new Set<string>();
  rows.slice(0, 40).forEach((row) => Object.keys(row || {}).forEach((key) => cols.add(key)));
  return Array.from(cols);
}

function numericColumns(rows: any[]) {
  const cols = columnsFromRows(rows);

  return cols.filter((col) => {
    const sample = rows
      .slice(0, 180)
      .map((row) => row?.[col])
      .filter((value) => value !== undefined && value !== null && String(value).trim() !== "");

    if (!sample.length) return false;

    const numeric = sample.filter((value) => Number.isFinite(Number(value))).length;
    return numeric / sample.length >= 0.75;
  });
}

function downsampleRows(rows: any[], max = 650) {
  if (rows.length <= max) return rows;
  const step = Math.ceil(rows.length / max);
  return rows.filter((_, index) => index % step === 0);
}

function getGoldValue(row: any) {
  return (
    row?.gold_price ??
    row?.target_gold ??
    row?.actual_gold ??
    row?.actual_target ??
    row?.close ??
    row?.price ??
    null
  );
}

function rowText(row: any) {
  return Object.values(row || {}).join(" ").toLowerCase();
}

function artifactLoaded(jsonMap: Record<string, any>, key: string, matrixLoaded: boolean) {
  if (key === "matrixCsv") return matrixLoaded;
  return jsonMap[key] !== undefined && jsonMap[key] !== null;
}

function toneForStatus(loaded: boolean) {
  return loaded
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
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
      <div className="text-[11px] font-black uppercase tracking-[0.32em] text-blue-600">
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

export default function DataMatrixPage() {
  const [catalog, setCatalog] = useState<ArtifactBlob[]>([]);
  const [jsonMap, setJsonMap] = useState<Record<string, any>>({});
  const [matrixRows, setMatrixRows] = useState<any[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [aiQuestion, setAiQuestion] = useState("Explain this Data Matrix page in business language.");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      mode: "artifact_blob_ai",
      content:
        "I can explain the refreshed Deep ML matrix, Step 10 source update, Step 10A gold live patch, and Step 11 governed feature store using approved artifacts.",
      sources: [],
    },
  ]);

  useEffect(() => {
    async function loadPageData() {
      setLoading(true);

      try {
        const catalogResponse = await fetch("/api/artifact-blob", { cache: "no-store" });
        const catalogData = await catalogResponse.json();
        setCatalog(Array.isArray(catalogData.catalog) ? catalogData.catalog : []);
      } catch {
        setCatalog([]);
      }

      try {
        const matrixResponse = await fetch(cleanHref("artifacts/deep_ml/features/deep_ml_refreshed_matrix.csv"), {
          cache: "no-store",
        });
        if (!matrixResponse.ok) throw new Error(`Matrix CSV HTTP ${matrixResponse.status}`);
        const matrixText = await matrixResponse.text();
        setMatrixRows(parseCsv(matrixText, 30000));
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Matrix CSV could not be loaded.");
      }

      const loadedJson: Record<string, any> = {};

      await Promise.all(
        DATA_ARTIFACTS.filter((artifact) => artifact.type === "json").map(async (artifact) => {
          try {
            const response = await fetch(cleanHref(artifact.path), { cache: "no-store" });
            if (!response.ok) return;
            loadedJson[artifact.key] = await response.json();
          } catch {
            loadedJson[artifact.key] = null;
          }
        })
      );

      setJsonMap(loadedJson);
      setLoading(false);
    }

    loadPageData();
  }, []);

  const matrixColumns = useMemo(() => columnsFromRows(matrixRows), [matrixRows]);
  const numericCols = useMemo(() => numericColumns(matrixRows), [matrixRows]);

  useEffect(() => {
    if (matrixColumns.length && visibleColumns.length === 0) {
      const preferred = [
        "date",
        "gold_price",
        "policy_unc",
        "gpr_index",
        "vix",
        "dxy",
        "real_yield",
        "fed_funds",
        "oil_price",
        "gld_etf",
        "target_gold",
        "actual_target",
      ];

      const selected = [
        ...preferred.filter((col) => matrixColumns.includes(col)),
        ...matrixColumns.filter((col) => !preferred.includes(col)),
      ].slice(0, 14);

      setVisibleColumns(selected);
    }

    if (numericCols.length && selectedSeries.length === 0) {
      const preferredSeries = ["gold_price", "policy_unc", "gpr_index", "vix", "dxy"];
      const selected = [
        ...preferredSeries.filter((col) => numericCols.includes(col)),
        ...numericCols.filter((col) => !preferredSeries.includes(col)),
      ].slice(0, 3);

      setSelectedSeries(selected);
    }
  }, [matrixColumns, numericCols, visibleColumns.length, selectedSeries.length]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return matrixRows;
    const q = search.trim().toLowerCase();
    return matrixRows.filter((row) => rowText(row).includes(q));
  }, [matrixRows, search]);

  const tableRows = filteredRows.slice(0, 120);
  const chartRows = downsampleRows(filteredRows, 700);

  const latestRow = matrixRows[matrixRows.length - 1] || {};
  const firstRow = matrixRows[0] || {};
  const latestGold = getGoldValue(latestRow);

  const weekendRows = useMemo(() => {
    return matrixRows.reduce((count, row) => {
      const date = new Date(row?.date);
      if (Number.isNaN(date.getTime())) return count;
      const day = date.getDay();
      return day === 0 || day === 6 ? count + 1 : count;
    }, 0);
  }, [matrixRows]);

  const factorRows = rowsFromJson(jsonMap.factorState);
  const qualityRows = rowsFromJson(jsonMap.dataQuality);
  const stalenessRows = rowsFromJson(jsonMap.factorStaleness);

  const matrixBlobs = useMemo(() => {
    const needles = [
      "matrix",
      "feature",
      "factor",
      "source_update",
      "gold_live",
      "staleness",
      "quality",
      "phase10",
      "phase11",
      "data",
    ];

    return catalog
      .filter((blob) => needles.some((needle) => normalizePath(blob.path).toLowerCase().includes(needle)))
      .slice(0, 36);
  }, [catalog]);

  const sourceCards = [
    {
      label: "Step 10 Source Update",
      artifactKey: "phase10Report",
      value: formatMaybe(findValueDeep(jsonMap.phase10Report, ["status", "run_status", "result", "phase_status"])),
      note: "Refresh layer for FRED/manual/source update artifacts.",
    },
    {
      label: "Step 10A Gold Live Patch",
      artifactKey: "goldLiveSummary",
      value: formatMaybe(findValueDeep(jsonMap.goldLiveSummary, ["status", "run_status", "result", "phase_status"])),
      note: "Gold live/Yahoo-style update bridge after historical matrix cutoff.",
    },
    {
      label: "Step 11 Feature Store",
      artifactKey: "phase11Report",
      value: formatMaybe(findValueDeep(jsonMap.phase11Report, ["status", "run_status", "result", "phase_status"])),
      note: "Governed feature refresh and final model-ready numeric matrix.",
    },
    {
      label: "Factor State Table",
      artifactKey: "factorState",
      value: `${factorRows.length || "Not in artifact"} rows`,
      note: "Tracks factor availability, staleness, and model readiness.",
    },
  ];

  function toggleVisibleColumn(column: string) {
    setVisibleColumns((current) =>
      current.includes(column)
        ? current.filter((item) => item !== column)
        : [...current, column].slice(0, 20)
    );
  }

  function toggleSeries(column: string) {
    setSelectedSeries((current) =>
      current.includes(column)
        ? current.filter((item) => item !== column)
        : [...current, column].slice(0, 5)
    );
  }

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
          pagePath: "/data-matrix",
          history: nextMessages.slice(-8),
        }),
      });

      const data = await response.json();

      setAiMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer || "No answer returned from Gold AI.",
          mode: data.mode,
          sources: data.sources,
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

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="inline-flex rounded-full border border-yellow-300/30 bg-yellow-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-yellow-200">
                Deep ML Data Matrix · Blob Connected
              </div>
              <h1 className="mt-7 text-5xl font-black tracking-tight text-white md:text-7xl">
                Intelligent Data Matrix
              </h1>
              <p className="mt-5 max-w-5xl text-sm font-semibold leading-7 text-blue-50/80">
                This page reads the refreshed Deep ML matrix and the supporting source-update,
                gold-live, factor-state, staleness, quality, governance, and feature-store
                artifacts. It is JSON/CSV-first: claims are displayed only when artifacts exist.
              </p>

              <div className="mt-8 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/50">Rows</div>
                  <div className="mt-2 text-2xl font-black text-white">{formatNumber(matrixRows.length)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/50">Columns</div>
                  <div className="mt-2 text-2xl font-black text-white">{formatNumber(matrixColumns.length)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/50">Date Range</div>
                  <div className="mt-2 text-sm font-black text-white">
                    {formatDate(firstRow.date)} - {formatDate(latestRow.date)}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/50">Latest Gold</div>
                  <div className="mt-2 text-2xl font-black text-white">{formatNumber(latestGold, 2)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[2.4rem] border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-yellow-200">
                Step 10 · 10A · 11 Status
              </div>

              <div className="mt-5 grid gap-3">
                {sourceCards.map((card, index) => {
                  const loaded = artifactLoaded(jsonMap, card.artifactKey, matrixRows.length > 0);

                  return (
                    <div key={card.label} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-yellow-300/20 text-xs font-black text-yellow-100">
                            {index + 1}
                          </div>
                          <div>
                            <div className="text-sm font-black text-white">{card.label}</div>
                            <div className="mt-1 text-xs font-semibold leading-5 text-blue-50/60">
                              {card.note}
                            </div>
                          </div>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest ${loaded ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-amber-300/30 bg-amber-300/10 text-amber-200"}`}>
                          {loaded ? "Loaded" : "Missing"}
                        </span>
                      </div>
                      <div className="mt-3 text-xs font-black uppercase tracking-widest text-white/65">
                        {card.value}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {loadError ? (
          <section className="mt-6 rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-900">
            Matrix warning: {loadError}
          </section>
        ) : null}

        <section className="mt-8 grid gap-5 md:grid-cols-4">
          <StatCard
            label="Weekday Cleaning"
            value={`${formatNumber(weekendRows)} weekend rows`}
            note="This is computed from the loaded refreshed matrix dates."
          />
          <StatCard
            label="Blob Catalog"
            value={`${formatNumber(catalog.length)} files`}
            note={`${formatNumber(matrixBlobs.length)} matrix/data-related artifact blobs detected by this page.`}
          />
          <StatCard
            label="Factor State Rows"
            value={`${formatNumber(factorRows.length)}`}
            note="Read from factor_state_table.json when available."
          />
          <StatCard
            label="Quality/Staleness Rows"
            value={`${formatNumber(qualityRows.length + stalenessRows.length)}`}
            note="Read from quality and staleness artifacts."
          />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Matrix Visual"
              title="Plot variables from the refreshed matrix"
              description="Select numeric columns from the matrix. This chart is generated from the refreshed Deep ML CSV, not hardcoded."
            />

            <div className="mb-4 flex flex-wrap gap-2">
              {numericCols.slice(0, 40).map((column) => (
                <button
                  key={column}
                  type="button"
                  onClick={() => toggleSeries(column)}
                  className={`rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-widest ${
                    selectedSeries.includes(column)
                      ? "border-blue-300 bg-blue-600 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:bg-blue-50"
                  }`}
                >
                  {column}
                </button>
              ))}
            </div>

            <div className="h-[470px] rounded-[2rem] border border-slate-100 bg-slate-50 p-4">
              {selectedSeries.length === 0 ? (
                <div className="grid h-full place-items-center text-sm font-bold text-slate-500">
                  Select at least one numeric series.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartRows} margin={{ top: 20, right: 35, left: 25, bottom: 45 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={36} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatNumber(value, 0)} width={85} />
                    <Tooltip />
                    <Legend />
                    {selectedSeries.map((column, index) => (
                      <Line
                        key={column}
                        type="monotone"
                        dataKey={column}
                        name={column}
                        stroke={["#2563eb", "#ca8a04", "#16a34a", "#7c3aed", "#dc2626"][index % 5]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Gold AI"
              title="Ask about this matrix"
              description="This calls the same artifact/blob AI route with pagePath=/data-matrix, so answers are grounded in the matrix artifacts."
            />

            <div className="mb-4 flex flex-wrap gap-2">
              {[
                "What does this Data Matrix page explain?",
                "Explain Step 10, 10A, and 11 in simple terms.",
                "Which artifacts support the refreshed matrix?",
                "Are weekends removed from this matrix?",
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

            <div className="h-[390px] overflow-y-auto rounded-[2rem] border border-slate-100 bg-slate-50 p-4">
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
                    Searching matrix artifacts...
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
                placeholder="Ask about the matrix, factor state, feature refresh, source update, or gold live patch..."
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
        </section>

        <section className="mt-8 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            eyebrow="Matrix Table"
            title="Refreshed matrix preview"
            description="Search and inspect the matrix rows. Columns can be toggled below; the table displays a capped preview for browser performance."
          />

          <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-[50px] rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none focus:border-blue-300"
              placeholder="Search loaded matrix rows..."
            />
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">
              Showing {formatNumber(tableRows.length)} of {formatNumber(filteredRows.length)} matched rows
            </div>
          </div>

          <div className="mb-5 flex max-h-[150px] flex-wrap gap-2 overflow-y-auto rounded-[1.5rem] border border-slate-100 bg-slate-50 p-3">
            {matrixColumns.map((column) => (
              <button
                key={column}
                type="button"
                onClick={() => toggleVisibleColumn(column)}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${
                  visibleColumns.includes(column)
                    ? "border-blue-300 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-500 hover:border-blue-200"
                }`}
              >
                {column}
              </button>
            ))}
          </div>

          <div className="max-h-[680px] overflow-auto rounded-[2rem] border border-slate-200 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <tr>
                  {visibleColumns.map((column) => (
                    <th key={column} className="border-b border-slate-200 px-3 py-3">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, index) => (
                  <tr key={index} className="border-b border-slate-100 hover:bg-blue-50/40">
                    {visibleColumns.map((column) => (
                      <td key={column} className="max-w-[260px] truncate px-3 py-2 font-semibold text-slate-700">
                        {Number.isFinite(Number(row?.[column]))
                          ? formatNumber(row?.[column], 4)
                          : formatMaybe(row?.[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Factor State"
              title="Factor readiness table"
              description="Pulled from factor_state_table.json when the artifact exposes row-like records."
            />

            <div className="max-h-[560px] overflow-auto rounded-[2rem] border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <tr>
                    {columnsFromRows(factorRows).slice(0, 8).map((column) => (
                      <th key={column} className="border-b border-slate-200 px-3 py-3">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {factorRows.slice(0, 80).map((row, index) => (
                    <tr key={index} className="border-b border-slate-100">
                      {columnsFromRows(factorRows).slice(0, 8).map((column) => (
                        <td key={column} className="max-w-[260px] truncate px-3 py-2 font-semibold text-slate-700">
                          {formatMaybe(row?.[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {factorRows.length === 0 ? (
                <div className="p-5 text-sm font-semibold text-slate-500">
                  Factor-state row structure was not found in the artifact.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Artifact Control"
              title="Loaded matrix/data artifacts"
              description="Every card below links to an approved artifact used by this page or available in the blob catalog."
            />

            <div className="grid max-h-[560px] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
              {DATA_ARTIFACTS.map((artifact) => {
                const loaded = artifactLoaded(jsonMap, artifact.key, matrixRows.length > 0);

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
                        <div className="mt-1 break-all text-xs font-semibold text-slate-500">{artifact.path}</div>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${toneForStatus(loaded)}`}>
                        {loaded ? "Loaded" : "Check"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                        {artifact.phase || "Artifact"}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                        {artifact.type}
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
            eyebrow="Blob Index"
            title="Matrix-related blob catalog"
            description="This is pulled from /api/artifact-blob, so future artifacts automatically appear when they match matrix, feature, factor, source, quality, or staleness terms."
          />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {matrixBlobs.map((blob) => (
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
                  {blob.group} · {formatBytes(blob.sizeBytes)}
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

print("Created src/app/data-matrix/page.tsx")