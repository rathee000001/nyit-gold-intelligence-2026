from pathlib import Path

ROOT = Path.cwd()

PAGE_DIR = ROOT / "src/app/gold-ai"
PAGE_FILE = PAGE_DIR / "page.tsx"

PAGE_CODE = r'''
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  mode?: string;
  sources?: string[];
};

type LoadedArtifact = {
  blob: ArtifactBlob;
  ok: boolean;
  content: string;
  error?: string;
};

const STARTERS = [
  "Explain the whole project in business language.",
  "What is the difference between Academic Model and Deep ML?",
  "Explain Omega Fusion and why Gamma is context-only.",
  "Which artifacts support the final academic forecast?",
  "Show me artifacts related to Deep ML matrix.",
];

const CHART_QUERIES = [
  "omega rollforward",
  "model ranking",
  "deep ml matrix",
  "gamma date context",
  "official forecast path",
  "alpha evaluation",
  "beta evaluation",
  "delta evaluation",
  "epsilon evaluation",
];

function formatBytes(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`;
  if (value > 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function formatNumber(value: any, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value ?? "—");
  return numeric.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function cleanPublicHref(pathValue: string) {
  return `/${String(pathValue || "").replace(/^\/+/, "").replace(/^public\//, "")}`;
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

function parseCsv(text: string, maxRows = 3000) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
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

function findRowsInJson(value: any): any[] {
  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === "object").slice(0, 3000);
  }

  if (!value || typeof value !== "object") return [];

  const directKeys = [
    "rows",
    "data",
    "path",
    "forecast_points",
    "ranking",
    "files",
    "date_context_rows",
    "metrics",
  ];

  for (const key of directKeys) {
    if (Array.isArray(value[key])) {
      return value[key].filter((item: any) => item && typeof item === "object").slice(0, 3000);
    }
  }

  for (const entry of Object.values(value)) {
    if (Array.isArray(entry) && entry.some((item) => item && typeof item === "object")) {
      return entry.filter((item) => item && typeof item === "object").slice(0, 3000);
    }
  }

  const flattened: Record<string, any>[] = [];
  function walk(obj: any, prefix = "") {
    if (!obj || typeof obj !== "object") return;

    for (const [key, val] of Object.entries(obj)) {
      const nextKey = prefix ? `${prefix}.${key}` : key;

      if (Array.isArray(val) && val.some((item) => item && typeof item === "object")) {
        for (const item of val.slice(0, 1000)) {
          flattened.push({ group: nextKey, ...item });
        }
      } else if (val && typeof val === "object") {
        walk(val, nextKey);
      }
    }
  }

  walk(value);
  return flattened.slice(0, 3000);
}

function inferColumns(rows: any[]) {
  const columns = new Set<string>();

  rows.slice(0, 30).forEach((row) => {
    Object.keys(row || {}).forEach((key) => columns.add(key));
  });

  return Array.from(columns);
}

function numericColumns(rows: any[]) {
  const columns = inferColumns(rows);

  return columns.filter((column) => {
    const sample = rows
      .slice(0, 100)
      .map((row) => row?.[column])
      .filter((value) => value !== undefined && value !== null && String(value).trim() !== "");

    if (!sample.length) return false;

    const numericCount = sample.filter((value) => Number.isFinite(Number(value))).length;
    return numericCount / sample.length >= 0.75;
  });
}

function likelyXAxisColumns(rows: any[]) {
  const columns = inferColumns(rows);
  const priority = ["date", "forecast_date", "origin_date", "horizon", "horizonLabel", "model", "model_key", "name", "factor", "series_id"];

  const ordered = [
    ...priority.filter((item) => columns.includes(item)),
    ...columns.filter((item) => !priority.includes(item)),
  ];

  return ordered;
}

function textPreview(value: string, chars = 5000) {
  if (value.length <= chars) return value;
  return `${value.slice(0, chars)}\n... [preview truncated]`;
}

function modeLabel(mode?: string) {
  if (!mode) return "Gold AI";
  if (mode === "artifact_blob_ai") return "Artifact Blob AI";
  if (mode === "artifact_fallback") return "Artifact Fallback";
  if (mode === "general_ai") return "General AI";
  if (mode === "needs_openrouter_key") return "Needs API Key";
  return mode.replaceAll("_", " ");
}

function StatusPill({ children, tone = "blue" }: { children: string; tone?: "blue" | "green" | "amber" | "slate" }) {
  const cls =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : tone === "slate"
      ? "border-slate-200 bg-slate-50 text-slate-600"
      : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${cls}`}>
      {children}
    </span>
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

export default function GoldAIStudioPage() {
  const [catalog, setCatalog] = useState<ArtifactBlob[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [artifactQuery, setArtifactQuery] = useState("omega fusion validation weights");
  const [artifactResults, setArtifactResults] = useState<ArtifactBlob[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactBlob | null>(null);
  const [loadedArtifact, setLoadedArtifact] = useState<LoadedArtifact | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Welcome to Gold AI Studio. I can search the project artifact blob, explain model logic, and help generate charts/tables from approved JSON and CSV outputs.",
      mode: "artifact_blob_ai",
      sources: [],
    },
  ]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  const [rows, setRows] = useState<any[]>([]);
  const [xKey, setXKey] = useState("");
  const [yKeys, setYKeys] = useState<string[]>([]);
  const [chartType, setChartType] = useState<"line" | "bar" | "table">("line");

  const chatBottom = useRef<HTMLDivElement | null>(null);

  const allColumns = useMemo(() => inferColumns(rows), [rows]);
  const numericCols = useMemo(() => numericColumns(rows), [rows]);
  const xColumns = useMemo(() => likelyXAxisColumns(rows), [rows]);

  useEffect(() => {
    async function loadCatalog() {
      try {
        const response = await fetch("/api/artifact-blob", { cache: "no-store" });
        const data = await response.json();
        setCatalog(Array.isArray(data.catalog) ? data.catalog : []);
      } finally {
        setCatalogLoading(false);
      }
    }

    loadCatalog();
  }, []);

  useEffect(() => {
    chatBottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function searchArtifacts(queryOverride?: string) {
    const query = queryOverride || artifactQuery;

    const response = await fetch("/api/artifact-blob", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "search",
        query,
        pagePath: "/gold-ai",
        limit: 20,
      }),
    });

    const data = await response.json();
    setArtifactResults(Array.isArray(data.results) ? data.results : []);
  }

  async function openArtifact(blob: ArtifactBlob) {
    setSelectedArtifact(blob);
    setLoadedArtifact(null);
    setRows([]);
    setXKey("");
    setYKeys([]);

    const response = await fetch("/api/artifact-blob", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "read",
        id: blob.id,
        maxChars: 40000,
      }),
    });

    const data = await response.json();
    const loaded = data.loaded as LoadedArtifact;
    setLoadedArtifact(loaded);

    try {
      const rawResponse = await fetch(cleanPublicHref(blob.publicPath), {
        cache: "no-store",
      });
      const rawText = await rawResponse.text();

      let extractedRows: any[] = [];

      if (blob.ext === ".csv") {
        extractedRows = parseCsv(rawText);
      } else if (blob.ext === ".json") {
        extractedRows = findRowsInJson(JSON.parse(rawText));
      }

      setRows(extractedRows);

      const inferredX = likelyXAxisColumns(extractedRows)[0] || "";
      const inferredY = numericColumns(extractedRows).slice(0, 3);

      setXKey(inferredX);
      setYKeys(inferredY);
    } catch {
      setRows([]);
    }
  }

  async function askAI(questionOverride?: string) {
    const prompt = (questionOverride || question).trim();
    if (!prompt || asking) return;

    const nextMessages = [...messages, { role: "user" as const, content: prompt }];
    setMessages(nextMessages);
    setQuestion("");
    setAsking(true);

    try {
      const response = await fetch("/api/gold-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: prompt,
          pagePath: "/gold-ai",
          history: nextMessages.slice(-10),
        }),
      });

      const data = await response.json();

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer || "No answer returned.",
          mode: data.mode,
          sources: data.sources,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Gold AI connection error.",
          mode: "error",
          sources: [],
        },
      ]);
    } finally {
      setAsking(false);
    }
  }

  function toggleYKey(column: string) {
    setYKeys((current) =>
      current.includes(column)
        ? current.filter((item) => item !== column)
        : [...current, column].slice(0, 5)
    );
  }

  const chartRows = rows.slice(0, 500);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-[1900px]">
        <section className="relative overflow-hidden rounded-[3rem] border border-slate-200 bg-slate-950 p-8 shadow-2xl shadow-blue-950/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(250,204,21,0.18),transparent_32%),radial-gradient(circle_at_80%_28%,rgba(96,165,250,0.20),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(34,211,238,0.12),transparent_35%)]" />
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(148,163,184,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.12)_1px,transparent_1px)] [background-size:38px_38px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="inline-flex rounded-full border border-yellow-300/30 bg-yellow-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-yellow-200">
                Phase AI-2 · Artifact Intelligence Studio
              </div>
              <h1 className="mt-7 text-5xl font-black tracking-tight text-white md:text-7xl">
                Gold AI Studio
              </h1>
              <p className="mt-5 max-w-4xl text-sm font-semibold leading-7 text-blue-50/80">
                A full research console for Gold Nexus Alpha. Ask questions,
                search the artifact blob, inspect JSON/CSV outputs, and create
                project-grounded charts and tables.
              </p>

              <div className="mt-8 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
                    Catalog
                  </div>
                  <div className="mt-2 text-2xl font-black text-white">
                    {catalogLoading ? "..." : catalog.length}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
                    Scope
                  </div>
                  <div className="mt-2 text-sm font-black text-white">
                    Academic + Deep ML
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
                    Claims
                  </div>
                  <div className="mt-2 text-sm font-black text-white">
                    Artifact-grounded
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
                    Output
                  </div>
                  <div className="mt-2 text-sm font-black text-white">
                    Answers · charts · tables
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2.4rem] border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-100/70">
                Studio modes
              </div>
              <div className="mt-5 grid gap-3">
                {[
                  "Business explanation mode",
                  "Deep technical artifact mode",
                  "JSON/CSV artifact explorer",
                  "Chart and table generation lab",
                  "Professor-safe source-backed answers",
                ].map((item, index) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-4">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-yellow-300/20 text-xs font-black text-yellow-100">
                      {index + 1}
                    </div>
                    <div className="text-sm font-black text-white">{item}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Gold AI Chat"
              title="Ask the artifact brain"
              description="Project answers are grounded in selected JSON/CSV artifacts. General answers are labeled separately."
            />

            <div className="mb-4 flex flex-wrap gap-2">
              {STARTERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => askAI(item)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="h-[560px] overflow-y-auto rounded-[2rem] border border-slate-100 bg-slate-50 p-4">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={
                      message.role === "user"
                        ? "ml-auto max-w-[88%] rounded-[1.5rem] bg-blue-600 p-4 text-white"
                        : "mr-auto max-w-[94%] rounded-[1.5rem] border border-slate-200 bg-white p-4 text-slate-900 shadow-sm"
                    }
                  >
                    {message.role === "assistant" ? (
                      <div className="mb-2">
                        <StatusPill tone="blue">{modeLabel(message.mode)}</StatusPill>
                      </div>
                    ) : null}

                    <div className="whitespace-pre-wrap text-sm leading-7">
                      {message.content}
                    </div>

                    {message.sources?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Array.from(new Set(message.sources)).slice(0, 7).map((source) => (
                          <span
                            key={source}
                            className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700"
                          >
                            {source}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}

                {asking ? (
                  <div className="mr-auto max-w-[94%] rounded-[1.5rem] border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-blue-600" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:120ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:240ms]" />
                      <span className="ml-2 text-xs font-black uppercase tracking-widest text-slate-500">
                        Searching artifact blob
                      </span>
                    </div>
                  </div>
                ) : null}

                <div ref={chatBottom} />
              </div>
            </div>

            <div className="mt-4 flex gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-2">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    askAI();
                  }
                }}
                rows={2}
                placeholder="Ask about Omega, Gamma, model rankings, matrix, forecasts, metrics, or this project..."
                className="max-h-32 min-h-[48px] flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-6 outline-none"
              />
              <button
                type="button"
                onClick={() => askAI()}
                disabled={asking || !question.trim()}
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:bg-slate-300"
              >
                Ask
              </button>
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              eyebrow="Artifact Explorer"
              title="Search the blob"
              description="Search all public academic and Deep ML artifacts. Open a file to preview it and feed the chart/table lab."
            />

            <div className="flex flex-col gap-3 md:flex-row">
              <input
                value={artifactQuery}
                onChange={(event) => setArtifactQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") searchArtifacts();
                }}
                className="min-h-[48px] flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none focus:border-blue-300"
                placeholder="Search artifacts..."
              />
              <button
                type="button"
                onClick={() => searchArtifacts()}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800"
              >
                Search
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {CHART_QUERIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setArtifactQuery(item);
                    searchArtifacts(item);
                  }}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:border-blue-200 hover:bg-blue-50"
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-5 grid max-h-[360px] gap-3 overflow-y-auto pr-1">
              {artifactResults.length === 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                  Search results will appear here.
                </div>
              ) : (
                artifactResults.map((blob) => (
                  <button
                    key={blob.id}
                    type="button"
                    onClick={() => openArtifact(blob)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-black text-slate-950">{blob.label}</div>
                      <StatusPill tone={blob.ext === ".json" ? "green" : "blue"}>
                        {blob.ext.replace(".", "")}
                      </StatusPill>
                    </div>
                    <div className="mt-2 break-all text-xs font-semibold text-slate-500">
                      artifacts/{blob.path}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <span>{blob.group}</span>
                      <span>·</span>
                      <span>{formatBytes(blob.sizeBytes)}</span>
                      {blob.score ? (
                        <>
                          <span>·</span>
                          <span>score {formatNumber(blob.score, 0)}</span>
                        </>
                      ) : null}
                    </div>
                  </button>
                ))
              )}
            </div>

            {selectedArtifact ? (
              <div className="mt-5 rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-950">
                      {selectedArtifact.label}
                    </div>
                    <div className="mt-1 break-all text-xs font-semibold text-slate-500">
                      artifacts/{selectedArtifact.path}
                    </div>
                  </div>
                  <a
                    href={cleanPublicHref(selectedArtifact.publicPath)}
                    download
                    className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-700"
                  >
                    Download
                  </a>
                </div>

                <pre className="mt-4 max-h-[260px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                  {loadedArtifact?.content
                    ? textPreview(loadedArtifact.content)
                    : "Loading artifact preview..."}
                </pre>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-8 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            eyebrow="Chart + Table Lab"
            title="Generate visuals from artifact rows"
            description="Open a CSV or JSON artifact above. The studio extracts rows, detects columns, and lets you create a chart or table without hardcoding claims."
          />

          {rows.length === 0 ? (
            <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-7 text-amber-900">
              No chartable rows are loaded yet. Search and open an artifact like
              omega_rollforward.csv, official_forecast_path.csv, model_ranking.csv,
              or a JSON file that contains row arrays.
            </div>
          ) : (
            <>
              <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-5">
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="grid gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Visual type
                      </span>
                      <select
                        value={chartType}
                        onChange={(event) => setChartType(event.target.value as any)}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold"
                      >
                        <option value="line">Line chart</option>
                        <option value="bar">Bar chart</option>
                        <option value="table">Table</option>
                      </select>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        X axis
                      </span>
                      <select
                        value={xKey}
                        onChange={(event) => setXKey(event.target.value)}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold"
                      >
                        {xColumns.map((column) => (
                          <option key={column} value={column}>
                            {column}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Loaded rows
                      </div>
                      <div className="mt-2 text-2xl font-black text-slate-950">
                        {rows.length.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Y columns / series
                    </div>
                    <div className="flex max-h-[180px] flex-wrap gap-2 overflow-y-auto">
                      {numericCols.map((column) => (
                        <button
                          key={column}
                          type="button"
                          onClick={() => toggleYKey(column)}
                          className={`rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-widest ${
                            yKeys.includes(column)
                              ? "border-blue-300 bg-blue-600 text-white"
                              : "border-slate-200 bg-white text-slate-600"
                          }`}
                        >
                          {column}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-5">
                  <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Columns detected
                  </div>
                  <div className="flex max-h-[220px] flex-wrap gap-2 overflow-y-auto">
                    {allColumns.map((column) => (
                      <span
                        key={column}
                        className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${
                          numericCols.includes(column)
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white text-slate-500"
                        }`}
                      >
                        {column}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-[2rem] border border-slate-100 bg-slate-50 p-4">
                {chartType === "table" ? (
                  <div className="max-h-[620px] overflow-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <tr>
                          {allColumns.slice(0, 18).map((column) => (
                            <th key={column} className="border-b border-slate-200 px-3 py-3">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 300).map((row, index) => (
                          <tr key={index} className="border-b border-slate-100">
                            {allColumns.slice(0, 18).map((column) => (
                              <td key={column} className="max-w-[260px] truncate px-3 py-2 font-semibold text-slate-700">
                                {formatNumber(row?.[column], 4)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : yKeys.length === 0 || !xKey ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
                    Select an X axis and at least one numeric Y series.
                  </div>
                ) : (
                  <div className="h-[540px] rounded-2xl border border-slate-200 bg-white p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === "line" ? (
                        <LineChart data={chartRows} margin={{ top: 20, right: 35, left: 25, bottom: 55 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} minTickGap={36} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatNumber(value, 0)} width={80} />
                          <Tooltip />
                          <Legend />
                          {yKeys.map((column, index) => (
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
                      ) : (
                        <BarChart data={chartRows.slice(0, 120)} margin={{ top: 20, right: 35, left: 25, bottom: 55 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} minTickGap={24} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatNumber(value, 0)} width={80} />
                          <Tooltip />
                          <Legend />
                          {yKeys.map((column, index) => (
                            <Bar
                              key={column}
                              dataKey={column}
                              name={column}
                              fill={["#2563eb", "#ca8a04", "#16a34a", "#7c3aed", "#dc2626"][index % 5]}
                              radius={[8, 8, 0, 0]}
                            />
                          ))}
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
'''

def main():
    PAGE_DIR.mkdir(parents=True, exist_ok=True)
    PAGE_FILE.write_text(PAGE_CODE, encoding="utf-8")
    print(f"created {PAGE_FILE}")
    print("Open route: /gold-ai")

if __name__ == "__main__":
    main()