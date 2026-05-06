
import { promises as fs } from "fs";
import path from "path";

export type ArtifactBlob = {
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
};

export type LoadedArtifactContext = {
  blob: ArtifactBlob;
  ok: boolean;
  content: string;
  error?: string;
};

const PUBLIC_ARTIFACT_ROOT = path.join(process.cwd(), "public", "artifacts");

const PROJECT_RULES = [
  "JSON-first: project claims must come from approved JSON/CSV artifacts.",
  "Hardcode layout only; do not invent model results.",
  "Forecasts are model outputs, not guarantees.",
  "Interpretability explains model behavior, not causality.",
  "Gamma/news context is interpretive context only unless a final artifact explicitly says otherwise.",
  "Omega is a candidate fusion layer until final Deep ML evaluation artifacts approve a final conclusion.",
  "If an answer is not available in artifacts, say that it is not available in the approved artifacts.",
];

const MAX_SINGLE_CONTEXT_CHARS = 14000;
const MAX_TOTAL_CONTEXT_CHARS = 85000;

function cleanPath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

function titleCase(value: string) {
  return value
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s/]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token.length > 2);
}

function inferDomain(relativePath: string) {
  const p = relativePath.toLowerCase();

  if (p.includes("/deep_ml/models/")) return "deep_ml_model";
  if (p.includes("/deep_ml/features/")) return "deep_ml_features";
  if (p.includes("/deep_ml/data/")) return "deep_ml_data";
  if (p.includes("/deep_ml/governance/")) return "deep_ml_governance";
  if (p.includes("/deep_ml/news")) return "deep_ml_news";
  if (p.includes("/deep_ml/source_update/")) return "deep_ml_source_update";
  if (p.includes("/models/")) return "academic_model";
  if (p.includes("/forecast/")) return "academic_forecast";
  if (p.includes("/validation/")) return "academic_validation";
  if (p.includes("/data/")) return "academic_data";
  if (p.includes("/governance/")) return "academic_governance";
  if (p.includes("/pages/")) return "page_bundle";
  if (p.includes("/interpretability/")) return "interpretability";

  return "project";
}

function inferGroup(relativePath: string) {
  const parts = cleanPath(relativePath).split("/");

  if (parts[0] === "deep_ml") {
    if (parts[1] === "models" && parts[2]) return `deep_ml/models/${parts[2]}`;
    if (parts[1]) return `deep_ml/${parts[1]}`;
  }

  return parts[0] || "artifacts";
}

function inferModelKey(relativePath: string) {
  const p = relativePath.toLowerCase();

  const known = [
    "alpha_structural",
    "beta_temporal",
    "delta_tft",
    "epsilon_expert_ensemble",
    "gamma_news_sensitivity",
    "omega_fusion",
    "naive",
    "moving_average",
    "exponential_smoothing",
    "regression",
    "arima",
    "sarimax",
    "xgboost",
    "prophet",
  ];

  return known.find((key) => p.includes(key));
}

function inferTags(relativePath: string, filename: string) {
  const p = relativePath.toLowerCase();
  const tags = new Set<string>();

  for (const token of tokenize(`${relativePath} ${filename}`)) tags.add(token);

  const tagRules: [string, string][] = [
    ["deep_ml", "deep_ml"],
    ["forecast", "forecast"],
    ["evaluation", "evaluation"],
    ["rollforward", "rollforward"],
    ["quality", "quality"],
    ["diagnostics", "diagnostics"],
    ["feature", "features"],
    ["matrix", "matrix"],
    ["factor", "factors"],
    ["governance", "governance"],
    ["news", "news"],
    ["source_update", "source_update"],
    ["gamma", "gamma"],
    ["omega", "omega"],
    ["alpha", "alpha"],
    ["beta", "beta"],
    ["delta", "delta"],
    ["epsilon", "epsilon"],
    ["arima", "arima"],
    ["sarimax", "sarimax"],
    ["xgboost", "xgboost"],
    ["regression", "regression"],
    ["naive", "naive"],
    ["moving", "moving_average"],
  ];

  for (const [needle, tag] of tagRules) {
    if (p.includes(needle)) tags.add(tag);
  }

  if (filename.endsWith(".json")) tags.add("json");
  if (filename.endsWith(".csv")) tags.add("csv");

  return Array.from(tags).slice(0, 60);
}

async function walkFiles(dir: string): Promise<string[]> {
  let out: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        out = out.concat(await walkFiles(fullPath));
      } else {
        out.push(fullPath);
      }
    }
  } catch {
    return out;
  }

  return out;
}

export async function getArtifactCatalog(): Promise<ArtifactBlob[]> {
  const files = await walkFiles(PUBLIC_ARTIFACT_ROOT);
  const supported = new Set([".json", ".csv", ".txt", ".md"]);

  const blobs: ArtifactBlob[] = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!supported.has(ext)) continue;

    const stat = await fs.stat(file);
    const relativeToArtifacts = cleanPath(path.relative(PUBLIC_ARTIFACT_ROOT, file));
    const publicPath = `artifacts/${relativeToArtifacts}`;
    const filename = path.basename(file);
    const id = relativeToArtifacts.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");

    blobs.push({
      id,
      label: titleCase(filename.replace(ext, "")),
      path: relativeToArtifacts,
      publicPath,
      ext,
      sizeBytes: stat.size,
      group: inferGroup(relativeToArtifacts),
      domain: inferDomain(relativeToArtifacts),
      modelKey: inferModelKey(relativeToArtifacts),
      tags: inferTags(relativeToArtifacts, filename),
      updatedAt: stat.mtime.toISOString(),
    });
  }

  return blobs.sort((a, b) => a.path.localeCompare(b.path));
}

export function routeProfile(pagePath?: string) {
  const p = String(pagePath || "").toLowerCase();

  if (p.includes("omega-fusion")) {
    return {
      page: "Omega Fusion",
      tags: ["omega", "fusion", "weights", "evaluation", "forecast", "gamma"],
      summary: "Current page explains Omega Fusion artifacts, validation-weighted fusion, and Gamma context-only governance.",
    };
  }

  if (p.includes("gamma-news-sensitivity")) {
    return {
      page: "Gamma News Sensitivity",
      tags: ["gamma", "news", "sensitivity", "tooltip", "context"],
      summary: "Current page explains Gamma as a news-context sensitivity layer, not causality.",
    };
  }

  if (p.includes("alpha-structural")) return { page: "Alpha Structural", tags: ["alpha", "xgboost", "shap", "structural"], summary: "Current page explains Alpha Structural XGBoost artifacts." };
  if (p.includes("beta-temporal")) return { page: "Beta Temporal", tags: ["beta", "temporal", "sequence", "attention"], summary: "Current page explains Beta Temporal sequence-model artifacts." };
  if (p.includes("delta-tft")) return { page: "Delta TFT", tags: ["delta", "tft", "quantile", "interval"], summary: "Current page explains Delta TFT quantile artifacts." };
  if (p.includes("epsilon-ensemble")) return { page: "Epsilon Ensemble", tags: ["epsilon", "ensemble", "benchmark"], summary: "Current page explains Epsilon benchmark ensemble artifacts." };
  if (p.includes("news-source")) return { page: "News Source", tags: ["news", "source", "phase12", "rss", "gdelt"], summary: "Current page explains news source update artifacts." };
  if (p.includes("data-matrix")) return { page: "Deep ML Data Matrix", tags: ["matrix", "factor", "features", "deep_ml", "data"], summary: "Current page should explain the cleaned Deep ML matrix, factor state, feature store, and data lineage." };
  if (p === "/deep-ml" || p.endsWith("/deep-ml")) return { page: "Deep ML Overview", tags: ["deep_ml", "overview", "mode", "governance", "features"], summary: "Current page summarizes Deep ML module status and artifacts." };
  if (p.includes("data-pipeline")) return { page: "Academic Data Pipeline", tags: ["data", "pipeline", "matrix", "weekday", "factor"], summary: "Current page explains academic data pipeline artifacts." };
  if (p.includes("model-comparison")) return { page: "Academic Model Comparison", tags: ["model", "comparison", "validation", "ranking"], summary: "Current page explains academic model comparison artifacts." };
  if (p.includes("forecast")) return { page: "Academic Final Forecast", tags: ["forecast", "official", "final", "arima"], summary: "Current page explains the academic final forecast artifacts." };

  return {
    page: "Gold Nexus Alpha",
    tags: ["gold", "forecast", "project"],
    summary: "Current page is part of the Gold Nexus Alpha forecasting platform.",
  };
}

function scoreBlob(blob: ArtifactBlob, query: string, pagePath?: string) {
  const q = query.toLowerCase();
  const tokens = tokenize(query);
  const page = routeProfile(pagePath);
  const haystack = [
    blob.path,
    blob.label,
    blob.group,
    blob.domain,
    blob.modelKey || "",
    ...blob.tags,
  ].join(" ").toLowerCase();

  let score = 0;

  for (const token of tokens) {
    if (haystack.includes(token)) score += 3;
    if (blob.tags.includes(token)) score += 4;
  }

  for (const tag of page.tags) {
    if (haystack.includes(tag)) score += 8;
  }

  if (q.includes("this page") || q.includes("current page") || q.includes("what page")) {
    score += page.tags.some((tag) => haystack.includes(tag)) ? 20 : 0;
  }

  const boosters: [string, string, number][] = [
    ["omega", "omega", 25],
    ["gamma", "gamma", 25],
    ["alpha", "alpha", 18],
    ["beta", "beta", 18],
    ["delta", "delta", 18],
    ["epsilon", "epsilon", 18],
    ["matrix", "matrix", 22],
    ["factor", "factor", 20],
    ["cutoff", "governance", 18],
    ["forecast", "forecast", 14],
    ["ranking", "ranking", 18],
    ["selected", "selected", 18],
    ["news", "news", 16],
  ];

  for (const [questionNeedle, artifactNeedle, boost] of boosters) {
    if (q.includes(questionNeedle) && haystack.includes(artifactNeedle)) score += boost;
  }

  if ((q.includes("mae") || q.includes("rmse") || q.includes("mape")) && haystack.includes("evaluation")) score += 18;
  if ((q.includes("weight") || q.includes("fusion")) && haystack.includes("omega")) score += 18;
  if ((q.includes("tooltip") || q.includes("context")) && haystack.includes("gamma")) score += 18;

  if (blob.ext === ".json") score += 3;
  if (blob.sizeBytes > 15_000_000) score -= 12;
  if (blob.sizeBytes > 50_000_000) score -= 30;

  return score;
}

export async function searchArtifactBlobs(query: string, pagePath?: string, limit = 12) {
  const catalog = await getArtifactCatalog();

  return catalog
    .map((blob) => ({ ...blob, score: scoreBlob(blob, query, pagePath) }))
    .filter((blob) => blob.score > 0)
    .sort((a, b) => b.score - a.score || a.sizeBytes - b.sizeBytes)
    .slice(0, limit);
}

function trimText(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars) + "\n... [truncated by artifact blob service]";
}

function csvPreview(raw: string, maxLines = 80) {
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const preview = lines.slice(0, maxLines).join("\n");
  return [`CSV preview lines: ${Math.min(lines.length, maxLines)} of ${lines.length}`, preview].join("\n");
}

export async function loadArtifactBlobContent(blob: ArtifactBlob, maxChars = MAX_SINGLE_CONTEXT_CHARS): Promise<LoadedArtifactContext> {
  const filePath = path.join(PUBLIC_ARTIFACT_ROOT, blob.path);

  try {
    const raw = await fs.readFile(filePath, "utf-8");

    let content = "";

    if (blob.ext === ".json") {
      try {
        content = JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        content = raw;
      }
    } else if (blob.ext === ".csv") {
      content = csvPreview(raw);
    } else {
      content = raw;
    }

    return { blob, ok: true, content: trimText(content, maxChars) };
  } catch (error) {
    return {
      blob,
      ok: false,
      content: "",
      error: error instanceof Error ? error.message : "Artifact read failed.",
    };
  }
}

export async function buildArtifactContextForQuestion({
  question,
  pagePath,
  maxArtifacts = 12,
}: {
  question: string;
  pagePath?: string;
  maxArtifacts?: number;
}) {
  const selected = await searchArtifactBlobs(question, pagePath, maxArtifacts);
  const loaded = await Promise.all(selected.map((blob) => loadArtifactBlobContent(blob)));

  let total = 0;
  const chunks: string[] = [];

  for (const item of loaded) {
    const header = [
      `ARTIFACT: ${item.blob.label}`,
      `PATH: artifacts/${item.blob.path}`,
      `GROUP: ${item.blob.group}`,
      `DOMAIN: ${item.blob.domain}`,
      `MODEL: ${item.blob.modelKey || "none"}`,
      `SIZE_BYTES: ${item.blob.sizeBytes}`,
      `STATUS: ${item.ok ? "loaded" : "missing"}`,
    ].join("\n");

    const body = item.ok ? item.content : `ERROR: ${item.error || "unknown"}`;
    const chunk = `${header}\nCONTENT:\n${body}`;

    total += chunk.length;
    if (total > MAX_TOTAL_CONTEXT_CHARS) {
      chunks.push(`ARTIFACT CONTEXT TRUNCATED at ${MAX_TOTAL_CONTEXT_CHARS} characters.`);
      break;
    }

    chunks.push(chunk);
  }

  return {
    page: routeProfile(pagePath),
    projectRules: PROJECT_RULES,
    selected,
    loaded,
    contextText: chunks.join("\n\n---\n\n"),
  };
}

export function isProjectQuestion(question: string, pagePath?: string) {
  const q = `${question} ${pagePath || ""}`.toLowerCase();

  const projectTerms = [
    "gold", "nexus", "forecast", "artifact", "matrix", "factor", "deep ml", "deep_ml",
    "alpha", "beta", "delta", "epsilon", "gamma", "omega", "model", "arima",
    "sarimax", "xgboost", "regression", "naive", "moving average", "cutoff",
    "validation", "test", "train", "rmse", "mae", "mape", "news", "tooltip",
    "current page", "this page", "website", "project", "data pipeline", "feature store"
  ];

  return projectTerms.some((term) => q.includes(term));
}
