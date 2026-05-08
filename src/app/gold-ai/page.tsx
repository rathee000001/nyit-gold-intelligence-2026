
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

type VisualIntent =
  | "current_gold"
  | "omega_rollforward"
  | "academic_forecast"
  | "model_ranking"
  | "deep_ml_matrix";

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

const BLOB_SQL_EXAMPLE_QUERIES = [
  {
    label: "Omega artifacts",
    query: "SELECT label, path, ext, sizeBytes, domain, modelKey FROM artifacts WHERE modelKey = 'omega_fusion' ORDER BY sizeBytes DESC LIMIT 50",
  },
  {
    label: "Deep ML model files by family",
    query: "SELECT modelKey, COUNT(*) AS files, SUM(sizeBytes) AS totalBytes FROM artifacts WHERE domain = 'deep_ml_model' GROUP BY modelKey ORDER BY files DESC LIMIT 25",
  },
  {
    label: "CSV forecast artifacts",
    query: "SELECT label, path, modelKey, sizeBytes FROM artifacts WHERE ext = '.csv' AND tags LIKE '%forecast%' ORDER BY sizeBytes DESC LIMIT 50",
  },
  {
    label: "Largest project artifacts",
    query: "SELECT label, path, ext, sizeBytes, group FROM artifacts ORDER BY sizeBytes DESC LIMIT 25",
  },
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
  const normalizedText = text.replace(/^\s*CSV preview lines:[^\r\n]*\r?\n/i, "");
  const lines = normalizedText.trim().split(/\r?\n/).filter(Boolean);
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


function cleanAiModeLabel(mode?: string) {
  if (!mode) return "Gold AI";
  if (mode === "rag_sql_orchestrator_ai") return "RAG + SQL + Vector Orchestrator";
  if (mode === "rag_sql_orchestrator_fallback") return "RAG + SQL Fallback";
  if (mode === "artifact_blob_ai") return "RAG + SQL AI";
  if (mode === "artifact_fallback") return "Artifact Fallback";
  if (mode === "general_ai") return "General AI";
  if (mode === "needs_openrouter_key") return "Needs API Key";
  if (mode === "openrouter_api_error") return "AI Provider Error";
  if (mode === "deep_ml_forecast_ai") return "Deep ML Forecast AI";
  if (mode === "error") return "AI Error";
  return String(mode)
    .replaceAll("_", " ")
    .replace(/\bRAG + SQL Orchestrator\b/i, "RAG + SQL Orchestrator")
    .replace(/\brag sql orchestrator fallback\b/i, "RAG + SQL Fallback")
    .replace(/\bartifact blob ai\b/i, "RAG + SQL AI")
    .replace(/\bai\b/i, "AI")
    .trim();
}


function modeLabel(mode?: string) {
  return cleanAiModeLabel(mode);
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


function blobMatchesIntent(blob: ArtifactBlob, intent: VisualIntent) {
  const p = `${blob.path} ${blob.label} ${blob.group} ${blob.domain}`.toLowerCase();

  if (intent === "omega_rollforward") {
    return p.includes("omega_fusion") && p.includes("omega_rollforward") && blob.ext === ".csv";
  }

  if (intent === "academic_forecast") {
    return p.includes("official_forecast_path") && blob.ext === ".csv";
  }

  if (intent === "model_ranking") {
    return p.includes("model_ranking") && blob.ext === ".csv";
  }

  if (intent === "deep_ml_matrix") {
    return (
      blob.ext === ".csv" &&
      (p.includes("deep_ml_refreshed_matrix") ||
        p.includes("deep_ml_numeric_feature_store") ||
        p.includes("feature_store"))
    );
  }

  if (intent === "current_gold") {
    return (
      blob.ext === ".csv" &&
      (p.includes("deep_ml_refreshed_matrix") ||
        p.includes("deep_ml_numeric_feature_store") ||
        p.includes("model_ready") ||
        p.includes("gold_matrix") ||
        p.includes("feature_store"))
    );
  }

  return false;
}

function intentQuery(intent: VisualIntent) {
  if (intent === "current_gold") return "current gold price date gold_price matrix";
  if (intent === "omega_rollforward") return "omega rollforward actual target prediction";
  if (intent === "academic_forecast") return "official forecast path";
  if (intent === "model_ranking") return "model ranking validation";
  if (intent === "deep_ml_matrix") return "deep ml matrix feature store gold price";
  return "gold forecast";
}

function intentLabel(intent: VisualIntent) {
  if (intent === "current_gold") return "Current Gold Price Chart";
  if (intent === "omega_rollforward") return "Omega Actual vs Forecast";
  if (intent === "academic_forecast") return "Academic Forecast Path";
  if (intent === "model_ranking") return "Model Ranking Table";
  if (intent === "deep_ml_matrix") return "Deep ML Matrix Preview";
  return "Visual";
}

function chooseXColumnForIntent(intent: VisualIntent, rows: any[]) {
  const cols = inferColumns(rows);

  const preferred =
    intent === "model_ranking"
      ? ["model", "model_name", "method", "rank", "horizon"]
      : ["date", "forecast_date", "origin_date", "horizon", "horizonLabel"];

  return preferred.find((col) => cols.includes(col)) || likelyXAxisColumns(rows)[0] || "";
}

function chooseYColumnsForIntent(intent: VisualIntent, rows: any[]) {
  const cols = inferColumns(rows);
  const numeric = numericColumns(rows);

  const preferredByIntent: Record<VisualIntent, string[]> = {
    current_gold: [
      "gold_price",
      "target_gold",
      "actual_gold",
      "close",
      "price",
      "gold",
      "actual_target",
    ],
    omega_rollforward: [
      "actual_target",
      "prediction",
      "omega_p50_weighted",
      "naive_prediction",
    ],
    academic_forecast: [
      "actual",
      "forecast",
      "forecast_price",
      "mean_forecast",
      "lower",
      "upper",
      "p50",
    ],
    model_ranking: [
      "validation_mape",
      "test_mape",
      "MAE",
      "RMSE",
      "MAPE",
      "score",
    ],
    deep_ml_matrix: [
      "gold_price",
      "target_gold",
      "actual_target",
      "policy_unc",
      "gpr_index",
    ],
  };

  const selected = preferredByIntent[intent].filter((col) => cols.includes(col));
  return selected.length ? selected.slice(0, 4) : numeric.slice(0, 4);
}


function normalizeColumnName(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function chooseYColumnsFromPrompt(prompt: string, rows: any[]) {
  const columns = inferColumns(rows);
  const numeric = numericColumns(rows);
  const normalizedPrompt = normalizeColumnName(prompt);

  const synonymMap: Record<string, string[]> = {
    gold_price: ["goldprice", "targetgold", "actualgold", "spotgold", "gold"],
    policy_unc: ["policyunc", "policyuncertainty", "economicpolicyuncertainty", "epu"],
    gpr_index: ["gpr", "gprindex", "geopoliticalrisk"],
    actual_target: ["actualtarget", "actual", "target"],
    prediction: ["prediction", "forecast", "predicted"],
    naive_prediction: ["naiveprediction", "naive"],
    omega_p50_weighted: ["omegap50", "p50", "weightedforecast"],
    inflation: ["inflation", "cpi"],
    fed_funds: ["fedfunds", "fedrate", "interest"],
    dxy: ["dxy", "dollarindex", "usd"],
    real_yield: ["realyield", "yield"],
  };

  const selected: string[] = [];

  for (const column of numeric) {
    const normalizedColumn = normalizeColumnName(column);

    if (normalizedPrompt.includes(normalizedColumn)) {
      selected.push(column);
      continue;
    }

    for (const [canonical, synonyms] of Object.entries(synonymMap)) {
      const canonicalMatch =
        normalizeColumnName(canonical) === normalizedColumn ||
        normalizedColumn.includes(normalizeColumnName(canonical)) ||
        normalizeColumnName(canonical).includes(normalizedColumn);

      const synonymMatch = synonyms.some((word) => normalizedPrompt.includes(word));

      if (canonicalMatch && synonymMatch) {
        selected.push(column);
      }
    }
  }

  const unique = Array.from(new Set(selected));
  return unique.length ? unique.slice(0, 5) : numeric.slice(0, 4);
}

function chooseXColumnFromPrompt(prompt: string, rows: any[]) {
  const columns = inferColumns(rows);
  const normalizedPrompt = normalizeColumnName(prompt);

  if (normalizedPrompt.includes("horizon")) {
    const horizon = columns.find((column) => normalizeColumnName(column).includes("horizon"));
    if (horizon) return horizon;
  }

  const date = columns.find((column) => normalizeColumnName(column) === "date");
  if (date) return date;

  const forecastDate = columns.find((column) => normalizeColumnName(column).includes("forecastdate"));
  if (forecastDate) return forecastDate;

  return likelyXAxisColumns(rows)[0] || "";
}

function inferVisualIntentFromPrompt(prompt: string): VisualIntent {
  const q = prompt.toLowerCase();

  if (q.includes("omega")) return "omega_rollforward";
  if (q.includes("ranking") || q.includes("rank") || q.includes("best model")) return "model_ranking";
  if (q.includes("official") || q.includes("academic forecast") || q.includes("forecast path")) return "academic_forecast";
  if (q.includes("matrix") || q.includes("feature") || q.includes("factor") || q.includes("policy") || q.includes("gpr")) return "deep_ml_matrix";
  return "current_gold";
}


function formatBlobSqlCell(value: any) {
  if (value === undefined || value === null || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? formatNumber(value, 4) : "—";
  return String(value);
}

function splitBlobSqlSelectList(value: string) {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;

    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function stripBlobSqlQuotes(value: string) {
  return String(value || "").trim().replace(/^['"]|['"]$/g, "");
}

function compareBlobSqlValues(left: any, operator: string, rightRaw: string) {
  const right = stripBlobSqlQuotes(rightRaw);
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const bothNumeric = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);

  const a = bothNumeric ? leftNumber : String(left ?? "");
  const b = bothNumeric ? rightNumber : String(right ?? "");

  if (operator === "=") return a === b;
  if (operator === "!=" || operator === "<>") return a !== b;
  if (operator === ">") return a > b;
  if (operator === ">=") return a >= b;
  if (operator === "<") return a < b;
  if (operator === "<=") return a <= b;

  if (operator.toLowerCase() === "like") {
    const pattern = String(b).replaceAll("%", "").toLowerCase();
    return String(left ?? "").toLowerCase().includes(pattern);
  }

  return false;
}

function applyBlobSqlWhere(rows: any[], whereClause: string) {
  if (!whereClause.trim()) return rows;

  const conditions = whereClause
    .split(/\s+and\s+/i)
    .map((item) => item.trim())
    .filter(Boolean);

  return rows.filter((row) =>
    conditions.every((condition) => {
      const match = condition.match(/^([a-zA-Z0-9_]+)\s*(=|!=|<>|>=|<=|>|<|like)\s*(.+)$/i);
      if (!match) return false;

      const [, column, operator, value] = match;
      return compareBlobSqlValues(row?.[column], operator, value);
    })
  );
}

function parseBlobSqlAlias(expression: string) {
  const parts = expression.split(/\s+as\s+/i);
  return {
    body: parts[0].trim(),
    alias: (parts[1] || "").trim(),
  };
}

function aggregateBlobSqlRows(rows: any[], selectClause: string, groupByClause: string) {
  const groupColumn = groupByClause.trim().split(/\s+/)[0];
  const expressions = splitBlobSqlSelectList(selectClause);
  const groups = new Map<string, any[]>();

  for (const row of rows) {
    const key = String(row?.[groupColumn] ?? "");
    groups.set(key, [...(groups.get(key) || []), row]);
  }

  return Array.from(groups.entries()).map(([groupValue, groupRows]) => {
    const out: Record<string, any> = {};

    for (const expression of expressions) {
      const { body, alias } = parseBlobSqlAlias(expression);

      if (body === groupColumn) {
        out[alias || groupColumn] = groupValue;
        continue;
      }

      if (/^count\(\*\)$/i.test(body)) {
        out[alias || "count"] = groupRows.length;
        continue;
      }

      const sumMatch = body.match(/^sum\(([a-zA-Z0-9_]+)\)$/i);
      if (sumMatch) {
        const column = sumMatch[1];
        const values = groupRows.map((row) => Number(row?.[column])).filter(Number.isFinite);
        out[alias || `sum_${column}`] = values.reduce((sum, value) => sum + value, 0);
        continue;
      }

      const avgMatch = body.match(/^avg\(([a-zA-Z0-9_]+)\)$/i);
      if (avgMatch) {
        const column = avgMatch[1];
        const values = groupRows.map((row) => Number(row?.[column])).filter(Number.isFinite);
        out[alias || `avg_${column}`] = values.length
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : null;
        continue;
      }

      const minMatch = body.match(/^min\(([a-zA-Z0-9_]+)\)$/i);
      if (minMatch) {
        const column = minMatch[1];
        const values = groupRows
          .map((row) => row?.[column])
          .filter((value) => value !== undefined && value !== null && value !== "")
          .sort();
        out[alias || `min_${column}`] = values.length ? values[0] : null;
        continue;
      }

      const maxMatch = body.match(/^max\(([a-zA-Z0-9_]+)\)$/i);
      if (maxMatch) {
        const column = maxMatch[1];
        const values = groupRows
          .map((row) => row?.[column])
          .filter((value) => value !== undefined && value !== null && value !== "")
          .sort();
        out[alias || `max_${column}`] = values.length ? values[values.length - 1] : null;
        continue;
      }

      out[alias || body] = groupRows[0]?.[body] ?? null;
    }

    return out;
  });
}

function projectBlobSqlRows(rows: any[], selectClause: string) {
  const select = selectClause.trim();

  if (select === "*") return rows.map((row) => ({ ...row }));

  const expressions = splitBlobSqlSelectList(select);

  return rows.map((row) => {
    const out: Record<string, any> = {};

    for (const expression of expressions) {
      const { body, alias } = parseBlobSqlAlias(expression);
      out[alias || body] = row?.[body] ?? null;
    }

    return out;
  });
}

function sortBlobSqlRows(rows: any[], key: string, direction: "asc" | "desc") {
  const sign = direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const av = a?.[key];
    const bv = b?.[key];

    const an = Number(av);
    const bn = Number(bv);

    if (Number.isFinite(an) && Number.isFinite(bn)) {
      return (an - bn) * sign;
    }

    return String(av ?? "").localeCompare(String(bv ?? "")) * sign;
  });
}

function runBlobSqlLite(query: string, sourceRows: any[]) {
  const cleaned = query.trim().replace(/;+\s*$/, "").replace(/\s+/g, " ");
  const lower = cleaned.toLowerCase();

  const selectStart = lower.indexOf("select ");
  const fromIndex = lower.indexOf(" from artifacts");

  if (selectStart !== 0 || fromIndex === -1) {
    throw new Error("Use syntax: SELECT ... FROM artifacts ...");
  }

  const selectClause = cleaned.slice("select ".length, fromIndex).trim();
  const rest = cleaned.slice(fromIndex + " from artifacts".length).trim();
  const restLower = rest.toLowerCase();

  function clause(name: string, nextNames: string[]) {
    const token = `${name} `;
    const startIndex = restLower.indexOf(token);
    if (startIndex === -1) return "";

    const valueStart = startIndex + token.length;
    const nextPositions = nextNames
      .map((next) => restLower.indexOf(`${next} `, valueStart))
      .filter((index) => index >= 0);

    const valueEnd = nextPositions.length ? Math.min(...nextPositions) : rest.length;
    return rest.slice(valueStart, valueEnd).trim();
  }

  const whereClause = clause("where", ["group by", "order by", "limit"]);
  const groupByClause = clause("group by", ["order by", "limit"]);
  const orderByClause = clause("order by", ["limit"]);
  const limitClause = clause("limit", []);

  let resultRows = applyBlobSqlWhere(sourceRows.map((row) => ({ ...row })), whereClause);

  if (groupByClause) {
    resultRows = aggregateBlobSqlRows(resultRows, selectClause, groupByClause);
  } else {
    resultRows = projectBlobSqlRows(resultRows, selectClause);
  }

  if (orderByClause) {
    const [column, directionRaw] = orderByClause.split(/\s+/);
    const direction = String(directionRaw || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    resultRows = sortBlobSqlRows(resultRows, column, direction);
  }

  const requestedLimit = Number(limitClause || 1000);
  const safeLimit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(1000, requestedLimit))
    : 1000;

  return resultRows.slice(0, safeLimit);
}

function blobCatalogToSqlRows(catalog: ArtifactBlob[]) {
  return catalog.map((blob) => ({
    id: blob.id,
    label: blob.label,
    path: blob.path,
    publicPath: blob.publicPath,
    ext: blob.ext,
    sizeBytes: blob.sizeBytes,
    group: blob.group,
    domain: blob.domain,
    modelKey: blob.modelKey || "",
    tags: Array.isArray(blob.tags) ? blob.tags.join(", ") : "",
    updatedAt: blob.updatedAt || "",
  }));
}

function normalizeArtifactSqlCandidate(value: any) {
  return String(value ?? "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/^public\//, "")
    .replace(/^artifacts\//, "");
}

function findCatalogBlobForSqlRow(row: any, catalog: ArtifactBlob[]) {
  if (!row || !catalog.length) return null;

  const candidates = [
    row.path,
    row.publicPath,
    row.id,
    row.label,
  ]
    .map(normalizeArtifactSqlCandidate)
    .filter(Boolean);

  for (const candidate of candidates) {
    const found = catalog.find((blob) => {
      const blobPath = normalizeArtifactSqlCandidate(blob.path);
      const blobPublicPath = normalizeArtifactSqlCandidate(blob.publicPath);
      const blobId = normalizeArtifactSqlCandidate(blob.id);
      const blobLabel = normalizeArtifactSqlCandidate(blob.label);

      return (
        blobPath === candidate ||
        blobPublicPath === candidate ||
        blobId === candidate ||
        blobLabel === candidate ||
        blobPublicPath.endsWith(candidate) ||
        candidate.endsWith(blobPath)
      );
    });

    if (found) return found;
  }

  return null;
}




function AIArchitecturePanel() {
  const active = [
    "RAG + SQL + Vector",
    "page-aware routing",
    "artifact catalog",
    "artifact context",
    "SQL context optional",
    "Upstash Vector wired",
    "vector sources exposed",
    "OpenRouter",
    "fallback",
    "legacy route retained",
  ];

  const notActive = [
    "LangChain",
    "LlamaIndex",
    "auto SQL tools",
    "model reruns",
    "scheduled refresh",
    "vector-only mode",
  ];

  return (
    <section className="mt-6 rounded-[1.4rem] border border-slate-200 bg-white/95 p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">
              AI Architecture
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
              JSON-first
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">
              Upstash Vector wired
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">
              Active when env configured
            </span>
          </div>

          <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950">
            RAG + SQL Orchestrator Snapshot
          </h2>

          <p className="mt-2 text-xs font-semibold leading-6 text-slate-600">
            Current AI uses RAG-style retrieval from the approved artifact catalog, optional read-only
            SQL result context, and an LLM generation layer. Forecasts remain artifact outputs, not guarantees.
          </p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-[11px] font-bold leading-5 text-blue-800 lg:max-w-sm">
          Safe description: structured artifact catalog + SQL context + LLM generation.
          Upstash Vector retrieval is wired and active when environment variables and indexed records are configured. Vector matches are retrieval candidates only; they do not replace approved artifact sources or prove model quality. Legacy /api/gold-ai remains as fallback.
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">
            Active
          </div>
          <div className="flex flex-wrap gap-2">
            {active.map((item) => (
              <span
                key={item}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-rose-700">
            Not active yet
          </div>
          <div className="flex flex-wrap gap-2">
            {notActive.map((item) => (
              <span
                key={item}
                className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-rose-700"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
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
        "Welcome to Gold AI Studio. I can search approved project artifacts, explain model logic, use supplied Blob SQL result context, and help generate charts/tables from approved JSON and CSV outputs.",
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
  const [visualPrompt, setVisualPrompt] = useState("Plot gold_price from Deep ML matrix");

  const [blobSqlQuery, setBlobSqlQuery] = useState(BLOB_SQL_EXAMPLE_QUERIES[0].query);
  const [blobSqlRows, setBlobSqlRows] = useState<any[]>([]);
  const [blobSqlError, setBlobSqlError] = useState("");
  const [blobSqlBusy, setBlobSqlBusy] = useState(false);

  const chatBottom = useRef<HTMLDivElement | null>(null);

  const allColumns = useMemo(() => inferColumns(rows), [rows]);
  const numericCols = useMemo(() => numericColumns(rows), [rows]);
  const xColumns = useMemo(() => likelyXAxisColumns(rows), [rows]);
  const blobSqlColumns = useMemo(() => inferColumns(blobSqlRows), [blobSqlRows]);

  function buildBlobSqlContextForAi() {
    if (!blobSqlRows.length) return null;

    return {
      source: "gold_ai_studio_blob_sql_explorer",
      title: "Gold AI Studio Blob SQL result",
      tableName: "artifacts",
      query: blobSqlQuery,
      rowCount: blobSqlRows.length,
      columns: blobSqlColumns,
      rows: blobSqlRows.slice(0, 40),
      notes: [
        "This is a read-only SQL result from the artifact catalog.",
        "Rows are artifact metadata unless a CSV/JSON artifact is opened separately.",
        "Do not infer validation, approval, cutoff alignment, or model quality from metadata alone.",
      ],
    };
  }
  const firstOpenableBlobFromSqlRows = useMemo(() => {
    for (const row of blobSqlRows) {
      const blob = findCatalogBlobForSqlRow(row, catalog);
      if (blob && (blob.ext === ".csv" || blob.ext === ".json")) return blob;
    }
    return null;
  }, [blobSqlRows, catalog]);

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

  function scrollToVisualLab() {
    window.setTimeout(() => {
      document
        .getElementById("artifact-visual-lab")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  function useBlobSqlRowsInVisualLab() {
    if (!blobSqlRows.length) {
      setBlobSqlError("Run a Blob SQL query first.");
      return;
    }

    const nextX = likelyXAxisColumns(blobSqlRows)[0] || "";
    const nextY = numericColumns(blobSqlRows).slice(0, 4);

    setRows(blobSqlRows);
    setXKey(nextX);
    setYKeys(nextY);
    setChartType(nextY.length ? "bar" : "table");
    setVisualPrompt("Visualize the current Blob SQL result rows.");
    setSelectedArtifact(null);
    setLoadedArtifact(null);
    setBlobSqlError("");

    scrollToVisualLab();
  }

  async function openFirstBlobSqlArtifactInVisualLab() {
    if (!firstOpenableBlobFromSqlRows) {
      setBlobSqlError("No openable CSV/JSON artifact was detected in the current SQL result. Include path, publicPath, id, or label in the SELECT query.");
      return;
    }

    await openArtifact(firstOpenableBlobFromSqlRows);
    setBlobSqlError("");
    scrollToVisualLab();
  }

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
    const p = `${blob.path} ${blob.label}`.toLowerCase();

    if (p.includes("omega_rollforward")) return openArtifactWithIntent(blob, "omega_rollforward");
    if (p.includes("official_forecast_path")) return openArtifactWithIntent(blob, "academic_forecast");
    if (p.includes("model_ranking")) return openArtifactWithIntent(blob, "model_ranking");
    if (p.includes("deep_ml_refreshed_matrix") || p.includes("feature_store") || p.includes("matrix")) {
      return openArtifactWithIntent(blob, "current_gold");
    }

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
      const response = await fetch("/api/rag-ai", {
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



  function isSafeBlobSqlQuery(query: string) {
    const normalized = query.trim().replace(/\s+/g, " ").toLowerCase();

    if (!normalized.startsWith("select ")) {
      return "Only SELECT queries are allowed in this Blob SQL Explorer.";
    }

    if (!normalized.includes(" from artifacts")) {
      return "Use FROM artifacts. The blob catalog is exposed as the SQL table named artifacts.";
    }

    const forbidden = [
      "insert ",
      "update ",
      "delete ",
      "drop ",
      "alter ",
      "create ",
      "attach ",
      "detach ",
      "truncate ",
      "replace ",
      "into ",
      "load ",
      "require",
      "import ",
      "export ",
      "localstorage",
      "sessionstorage",
      "document.",
      "window.",
      "fetch(",
    ];

    const blocked = forbidden.find((word) => normalized.includes(word));

    if (blocked) {
      return `Blocked SQL token: ${blocked.trim()}. This explorer is read-only.`;
    }

    return "";
  }

  function runBlobSqlQuery(queryOverride?: string) {
    const query = String(queryOverride || blobSqlQuery || "").trim();

    if (!query) {
      setBlobSqlError("Enter a SQL SELECT query first.");
      return;
    }

    if (!catalog.length) {
      setBlobSqlError("Artifact catalog is not loaded yet.");
      return;
    }

    const safetyError = isSafeBlobSqlQuery(query);

    if (safetyError) {
      setBlobSqlError(safetyError);
      setBlobSqlRows([]);
      return;
    }

    setBlobSqlBusy(true);
    setBlobSqlError("");

    try {
      const sourceRows = blobCatalogToSqlRows(catalog);
      const resultRows = runBlobSqlLite(query, sourceRows);

      setBlobSqlRows(resultRows);
      setBlobSqlQuery(query);
    } catch (error) {
      setBlobSqlRows([]);
      setBlobSqlError(error instanceof Error ? error.message : "Blob SQL query failed.");
    } finally {
      setBlobSqlBusy(false);
    }
  }

  function downloadBlobSqlResults() {
    if (!blobSqlRows.length) return;

    const columns = blobSqlColumns.length ? blobSqlColumns : inferColumns(blobSqlRows);

    const escapeCell = (value: any) => {
      if (value === null || value === undefined) return "";
      const text = String(value);
      if (text.includes(",") || text.includes('"') || text.includes("\n")) {
        return `"${text.replaceAll('"', '""')}"`;
      }
      return text;
    };

    const csv = [
      columns.map(escapeCell).join(","),
      ...blobSqlRows.map((row) => columns.map((column) => escapeCell(row?.[column])).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "gold_artifact_blob_sql_result.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function askAIAboutBlobSqlResults() {
    const preview = blobSqlRows.slice(0, 10);
    const columns = blobSqlColumns.slice(0, 16);

    askAI(
      [
        "Explain this SQL result from the artifact blob catalog in business language.",
        "",
        "SQL query:",
        blobSqlQuery,
        "",
        `Rows returned: ${blobSqlRows.length}`,
        `Columns: ${columns.join(", ")}`,
        "",
        "Preview rows:",
        JSON.stringify(preview, null, 2),
      ].join("\n")
    );
  }


  async function generateVisual(intent: VisualIntent) {
    const query = intentQuery(intent);
    setArtifactQuery(query);

    let results: ArtifactBlob[] = [];

    try {
      const response = await fetch("/api/artifact-blob", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "search",
          query,
          pagePath: "/gold-ai",
          limit: 40,
        }),
      });

      const data = await response.json();
      results = Array.isArray(data.results) ? data.results : [];
      setArtifactResults(results);
    } catch {
      results = [];
    }

    const fromResults = results.find((blob) => blobMatchesIntent(blob, intent));
    const fromCatalog = catalog.find((blob) => blobMatchesIntent(blob, intent));
    const selected = fromResults || fromCatalog;

    if (!selected) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          mode: "artifact_fallback",
          sources: [],
          content:
            `I could not auto-find a chartable artifact for ${intentLabel(intent)}. ` +
            "Search the artifact explorer manually for a CSV with date/value rows, then open it.",
        },
      ]);
      return;
    }

    await openArtifactWithIntent(selected, intent);
  }

  async function openArtifactWithIntent(blob: ArtifactBlob, intent: VisualIntent) {
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
        extractedRows = parseCsv(rawText, 8000);
      } else if (blob.ext === ".json") {
        extractedRows = findRowsInJson(JSON.parse(rawText));
      }

      setRows(extractedRows);

      const inferredX = chooseXColumnForIntent(intent, extractedRows);
      const inferredY = chooseYColumnsForIntent(intent, extractedRows);

      setXKey(inferredX);
      setYKeys(inferredY);

      if (intent === "model_ranking") {
        setChartType("table");
      } else {
        setChartType("line");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          mode: "artifact_blob_ai",
          sources: [blob.label],
          content:
            `Loaded ${intentLabel(intent)} from approved artifact:\n\n` +
            `artifacts/${blob.path}\n\n` +
            `Rows detected: ${extractedRows.length.toLocaleString()}\n` +
            `X axis: ${inferredX || "not detected"}\n` +
            `Y series: ${inferredY.length ? inferredY.join(", ") : "not detected"}\n\n` +
            "The chart/table lab below is now configured from this artifact.",
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          mode: "artifact_fallback",
          sources: [blob.label],
          content:
            error instanceof Error
              ? `Artifact opened, but row extraction failed: ${error.message}`
              : "Artifact opened, but row extraction failed.",
        },
      ]);
      setRows([]);
    }
  }


  async function generateVisualFromPrompt(promptOverride?: string) {
    const prompt = (promptOverride || visualPrompt).trim();

    if (!prompt) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          mode: "artifact_fallback",
          sources: [],
          content: "Type what you want to plot, for example: Plot gold_price and policy_unc from Deep ML matrix.",
        },
      ]);
      return;
    }

    const intent = inferVisualIntentFromPrompt(prompt);
    setArtifactQuery(prompt);

    let results: ArtifactBlob[] = [];

    try {
      const response = await fetch("/api/artifact-blob", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "search",
          query: prompt,
          pagePath: "/gold-ai",
          limit: 60,
        }),
      });

      const data = await response.json();
      results = Array.isArray(data.results) ? data.results : [];
      setArtifactResults(results);
    } catch {
      results = [];
    }

    const chartableResults = results.filter((blob) => blob.ext === ".csv" || blob.ext === ".json");

    const intentMatch = chartableResults.find((blob) => blobMatchesIntent(blob, intent));
    const csvMatch = chartableResults.find((blob) => blob.ext === ".csv");
    const catalogMatch =
      catalog.find((blob) => blobMatchesIntent(blob, intent)) ||
      catalog.find((blob) => blob.ext === ".csv" && blob.path.toLowerCase().includes("matrix")) ||
      catalog.find((blob) => blob.ext === ".csv" && blob.path.toLowerCase().includes("feature_store"));

    const selected = intentMatch || csvMatch || catalogMatch;

    if (!selected) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          mode: "artifact_fallback",
          sources: [],
          content:
            `I could not find a chartable artifact for this visual request: "${prompt}". ` +
            "Try mentioning the artifact area, such as Omega, Deep ML matrix, official forecast, or model ranking.",
        },
      ]);
      return;
    }

    await openArtifactWithPrompt(selected, prompt, intent);
  }

  async function openArtifactWithPrompt(blob: ArtifactBlob, prompt: string, intent: VisualIntent) {
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
        extractedRows = parseCsv(rawText, 10000);
      } else if (blob.ext === ".json") {
        extractedRows = findRowsInJson(JSON.parse(rawText));
      }

      setRows(extractedRows);

      const inferredX = chooseXColumnFromPrompt(prompt, extractedRows);
      const inferredY = chooseYColumnsFromPrompt(prompt, extractedRows);

      setXKey(inferredX);
      setYKeys(inferredY);

      if (intent === "model_ranking" || prompt.toLowerCase().includes("table")) {
        setChartType("table");
      } else if (prompt.toLowerCase().includes("bar")) {
        setChartType("bar");
      } else {
        setChartType("line");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          mode: "artifact_blob_ai",
          sources: [blob.label],
          content:
            `I created a visual setup from your request:\n\n` +
            `"${prompt}"\n\n` +
            `Artifact used: artifacts/${blob.path}\n` +
            `Rows detected: ${extractedRows.length.toLocaleString()}\n` +
            `X axis: ${inferredX || "not detected"}\n` +
            `Y series: ${inferredY.length ? inferredY.join(", ") : "not detected"}\n\n` +
            "Scroll to the Chart + Table Lab below to adjust the chart.",
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          mode: "artifact_fallback",
          sources: [blob.label],
          content:
            error instanceof Error
              ? `Artifact opened, but visual extraction failed: ${error.message}`
              : "Artifact opened, but visual extraction failed.",
        },
      ]);
      setRows([]);
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

            
            <div className="relative min-h-[430px] overflow-hidden rounded-[2.4rem] border border-white/10 bg-slate-950/40 p-6 backdrop-blur-xl">
              <style>{`
                .gold-ai-orbit {
                  position: absolute;
                  inset: 32px;
                  border-radius: 999px;
                  border: 1px solid rgba(147,197,253,.22);
                  animation: gold-ai-spin 16s linear infinite;
                }

                .gold-ai-orbit.two {
                  inset: 70px 42px;
                  border-color: rgba(250,204,21,.25);
                  animation-duration: 11s;
                  animation-direction: reverse;
                  transform: rotateX(62deg);
                }

                .gold-ai-orbit.three {
                  inset: 110px 70px;
                  border-color: rgba(34,211,238,.22);
                  animation-duration: 8s;
                }

                .gold-ai-brain {
                  position: absolute;
                  right: 50%;
                  top: 48%;
                  width: 160px;
                  height: 160px;
                  margin-right: -80px;
                  margin-top: -80px;
                  border-radius: 999px;
                  display: grid;
                  place-items: center;
                  background:
                    radial-gradient(circle at 30% 25%, rgba(250,204,21,.5), transparent 30%),
                    radial-gradient(circle at 70% 80%, rgba(59,130,246,.55), transparent 36%),
                    radial-gradient(circle, rgba(15,23,42,.92), rgba(15,23,42,.35));
                  border: 1px solid rgba(255,255,255,.22);
                  box-shadow:
                    0 0 80px rgba(59,130,246,.28),
                    0 0 120px rgba(250,204,21,.18),
                    inset 0 0 45px rgba(255,255,255,.08);
                  animation: gold-ai-float 5.2s ease-in-out infinite;
                }

                .gold-ai-node {
                  position: absolute;
                  width: 9px;
                  height: 9px;
                  border-radius: 999px;
                  background: rgba(250,204,21,.96);
                  box-shadow: 0 0 20px rgba(250,204,21,.8), 0 0 35px rgba(59,130,246,.4);
                  animation: gold-ai-pulse 2.2s ease-in-out infinite;
                }

                .gold-ai-node.n1 { left: 12%; top: 22%; animation-delay: .1s; }
                .gold-ai-node.n2 { right: 18%; top: 18%; animation-delay: .3s; }
                .gold-ai-node.n3 { left: 22%; bottom: 24%; animation-delay: .5s; }
                .gold-ai-node.n4 { right: 14%; bottom: 28%; animation-delay: .7s; }
                .gold-ai-node.n5 { left: 48%; top: 9%; animation-delay: .9s; }
                .gold-ai-node.n6 { left: 50%; bottom: 10%; animation-delay: 1.1s; }

                .gold-ai-beam {
                  position: absolute;
                  left: 8%;
                  right: 8%;
                  height: 2px;
                  border-radius: 999px;
                  background: linear-gradient(90deg, transparent, rgba(59,130,246,.55), rgba(250,204,21,.45), transparent);
                  animation: gold-ai-beam 3s ease-in-out infinite;
                }

                .gold-ai-beam.b1 { top: 33%; transform: rotate(8deg); }
                .gold-ai-beam.b2 { top: 54%; transform: rotate(-7deg); animation-delay: .4s; }
                .gold-ai-beam.b3 { top: 74%; transform: rotate(4deg); animation-delay: .8s; }

                @keyframes gold-ai-spin {
                  from { transform: rotateZ(0deg) rotateX(64deg); }
                  to { transform: rotateZ(360deg) rotateX(64deg); }
                }

                @keyframes gold-ai-float {
                  0%, 100% { transform: translateY(0) scale(1); }
                  50% { transform: translateY(-12px) scale(1.04); }
                }

                @keyframes gold-ai-pulse {
                  0%, 100% { opacity: .42; transform: scale(.8); }
                  50% { opacity: 1; transform: scale(1.45); }
                }

                @keyframes gold-ai-beam {
                  0%, 100% { opacity: .18; }
                  50% { opacity: .9; }
                }
              `}</style>

              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(59,130,246,0.18),transparent_36%),radial-gradient(circle_at_30%_25%,rgba(250,204,21,0.12),transparent_30%)]" />
              <span className="gold-ai-orbit" />
              <span className="gold-ai-orbit two" />
              <span className="gold-ai-orbit three" />
              <span className="gold-ai-beam b1" />
              <span className="gold-ai-beam b2" />
              <span className="gold-ai-beam b3" />
              <span className="gold-ai-node n1" />
              <span className="gold-ai-node n2" />
              <span className="gold-ai-node n3" />
              <span className="gold-ai-node n4" />
              <span className="gold-ai-node n5" />
              <span className="gold-ai-node n6" />

              <div className="gold-ai-brain">
                <div className="text-center">
                  <div className="text-4xl font-black text-white">AI</div>
                  <div className="mt-1 text-[9px] font-black uppercase tracking-[0.22em] text-yellow-200">
                    Blob
                  </div>
                </div>
              </div>

              <div className="relative z-10 flex min-h-[380px] flex-col justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-yellow-200">
                    Artifact Visual Command
                  </div>
                  <h3 className="mt-3 max-w-md text-3xl font-black tracking-tight text-white">
                    Tell the studio what to plot
                  </h3>
                  <p className="mt-3 max-w-md text-xs font-semibold leading-6 text-blue-50/70">
                    Example: plot gold_price and policy_unc from Deep ML matrix, or plot Omega actual_target vs prediction.
                  </p>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-3 backdrop-blur">
                  <textarea
                    value={visualPrompt}
                    onChange={(event) => setVisualPrompt(event.target.value)}
                    rows={3}
                    className="min-h-[78px] w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-semibold leading-6 text-white outline-none placeholder:text-slate-400"
                    placeholder="Type what you want to plot from the artifact blob..."
                  />
                  <button
                    type="button"
                    onClick={() => generateVisualFromPrompt()}
                    className="mt-3 w-full rounded-2xl bg-yellow-300 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-950 shadow-lg shadow-yellow-300/20 hover:bg-yellow-200"
                  >
                    Generate Visual From Blob
                  </button>
                </div>
              </div>
            </div>

          </div>
        </section>

        <AIArchitecturePanel />

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


            <div className="mb-4 rounded-[1.5rem] border border-blue-100 bg-blue-50 p-4">
              <div className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-blue-700">
                Quick visual actions
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => generateVisual("current_gold")}
                  className="rounded-full bg-blue-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-blue-700"
                >
                  Generate Current Gold Price Chart
                </button>
                <button
                  type="button"
                  onClick={() => generateVisual("omega_rollforward")}
                  className="rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-blue-700 hover:bg-blue-100"
                >
                  Plot Omega Actual vs Forecast
                </button>
                <button
                  type="button"
                  onClick={() => generateVisual("academic_forecast")}
                  className="rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-blue-700 hover:bg-blue-100"
                >
                  Plot Academic Forecast
                </button>
                <button
                  type="button"
                  onClick={() => generateVisual("model_ranking")}
                  className="rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-blue-700 hover:bg-blue-100"
                >
                  Open Model Ranking Table
                </button>
              </div>
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


        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            eyebrow="SQL BLOB EXPLORER"
            title="Query the artifact blob catalog"
            description="This read-only SQL lab exposes the project artifact catalog as a table named artifacts. Use it to inspect model outputs, file groups, domains, tags, model keys, sizes, and artifact lineage before asking Gold AI to explain the results."
          />

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">
                    SQL Input
                  </div>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                    Table name: <span className="font-black text-slate-800">artifacts</span>. Read-only SELECT queries only.
                  </p>
                </div>

                <StatusPill tone="green">
                  {catalogLoading ? "Loading catalog" : `${catalog.length.toLocaleString()} artifacts`}
                </StatusPill>
              </div>

              <textarea
                value={blobSqlQuery}
                onChange={(event) => setBlobSqlQuery(event.target.value)}
                rows={7}
                spellCheck={false}
                className="w-full resize-y rounded-2xl border border-slate-200 bg-white p-4 font-mono text-sm leading-6 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                placeholder="SELECT label, path, modelKey FROM artifacts WHERE modelKey = 'omega_fusion' LIMIT 50"
              />

              {blobSqlError ? (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold leading-6 text-rose-700">
                  {blobSqlError}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => runBlobSqlQuery()}
                  disabled={blobSqlBusy || !catalog.length}
                  className="rounded-full bg-blue-600 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {blobSqlBusy ? "Running SQL..." : "Run Blob SQL"}
                </button>

                <button
                  type="button"
                  onClick={downloadBlobSqlResults}
                  disabled={!blobSqlRows.length}
                  className="rounded-full border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Download Result
                </button>

                <button
                  type="button"
                  onClick={askAIAboutBlobSqlResults}
                  disabled={!blobSqlRows.length || asking}
                  className="rounded-full border border-amber-200 bg-amber-50 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Ask AI About Blob SQL
                </button>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {BLOB_SQL_EXAMPLE_QUERIES.map((example) => (
                  <button
                    key={example.label}
                    type="button"
                    onClick={() => {
                      setBlobSqlQuery(example.query);
                      runBlobSqlQuery(example.query);
                    }}
                    className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
                  >
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                      {example.label}
                    </div>
                    <div className="mt-2 line-clamp-2 font-mono text-[11px] leading-5 text-slate-500">
                      {example.query}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Blob SQL Results
                  </div>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                    Showing up to 1,000 metadata rows from the artifact catalog.
                  </p>
                </div>

                <StatusPill>{`${blobSqlRows.length.toLocaleString()} rows`}</StatusPill>
              </div>

              {blobSqlRows.length ? (
                <div className="max-h-[440px] overflow-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-100 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                      <tr>
                        {blobSqlColumns.slice(0, 18).map((column) => (
                          <th key={column} className="whitespace-nowrap px-3 py-3 font-black">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {blobSqlRows.slice(0, 150).map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-blue-50/40">
                          {blobSqlColumns.slice(0, 18).map((column) => (
                            <td key={`${rowIndex}-${column}`} className="max-w-[280px] truncate px-3 py-2 font-semibold text-slate-700">
                              {column === "publicPath" || column === "path" ? (
                                <span title={String(row?.[column] || "")}>{formatBlobSqlCell(row?.[column])}</span>
                              ) : (
                                formatBlobSqlCell(row?.[column])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-semibold leading-7 text-slate-500">
                  No Blob SQL result yet. Run an example query or write your own SELECT query using the artifacts table.
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-xs font-bold leading-6 text-yellow-900">
                Professor-safe note: Blob SQL queries artifact metadata only. It does not alter model files, forecasts, or approved JSON/CSV outputs.
              </div>
            </div>
          </div>
        </section>


        <section className="mt-8 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div id="artifact-visual-lab" />


          <SectionTitle
            eyebrow="Chart + Table Lab"
            title="Generate visuals from artifact rows"
            description="Open a CSV or JSON artifact above. The studio extracts rows, detects columns, and lets you create a chart or table without hardcoding claims."
          />

          
          {blobSqlRows.length > 0 ? (
            <div className="mb-6 rounded-[1.5rem] border border-blue-100 bg-blue-50/60 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.28em] text-blue-700">
                    SQL → Visual Bridge
                  </div>
                  <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-600">
                    Blob SQL results are metadata rows. Use the first button to chart the SQL result itself,
                    or open a detected CSV/JSON artifact path from the SQL result into the artifact visual lab.
                  </p>
                  {firstOpenableBlobFromSqlRows ? (
                    <p className="mt-2 text-xs font-black text-emerald-700">
                      Detected openable artifact: {firstOpenableBlobFromSqlRows.label}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs font-bold text-amber-700">
                      No CSV/JSON artifact detected yet. Include path, publicPath, id, or label in your SQL SELECT.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={useBlobSqlRowsInVisualLab}
                    className="rounded-full bg-slate-950 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white shadow-sm"
                  >
                    Use SQL Rows
                  </button>

                  <button
                    type="button"
                    onClick={openFirstBlobSqlArtifactInVisualLab}
                    disabled={!firstOpenableBlobFromSqlRows}
                    className={`rounded-full border px-5 py-3 text-xs font-black uppercase tracking-[0.18em] ${
                      firstOpenableBlobFromSqlRows
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                    }`}
                  >
                    Open CSV/JSON Artifact
                  </button>
                </div>
              </div>
            </div>
          ) : null}
{rows.length === 0 ? (
            <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-7 text-amber-900">
              No chartable rows are loaded yet. Use the Quick Visual Actions above, or search and open a chartable CSV such as omega_rollforward.csv, official_forecast_path.csv, model_ranking.csv, or a matrix/feature-store CSV.
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
