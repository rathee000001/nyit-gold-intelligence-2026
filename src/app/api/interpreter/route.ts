import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  interpreterArtifacts,
  projectIdentity,
  type InterpreterArtifact,
} from "@/lib/interpreterArtifactManifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type LoadedArtifact = InterpreterArtifact & {
  ok: boolean;
  data: any | null;
  url: string;
  error?: string;
  score?: number;
};

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

const MAX_ARTIFACT_CHARS = 70000;
const MAX_SINGLE_ARTIFACT_CHARS = 12000;

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

function cleanPath(value: string) {
  return value.trim().replace(/^\/+/, "");
}

function getBaseUrl() {
  const base = process.env.NEXT_PUBLIC_ARTIFACT_BASE_URL;
  if (!base || base.trim() === "") return "";
  return base.trim().replace(/\/+$/, "");
}

function safeJsonStringify(value: any, maxChars = MAX_SINGLE_ARTIFACT_CHARS) {
  try {
    const json = JSON.stringify(value, null, 2);
    if (json.length <= maxChars) return json;
    return json.slice(0, maxChars) + "\n... [truncated for interpreter context]";
  } catch {
    return String(value).slice(0, maxChars);
  }
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token.length > 2);
}

function isProjectQuestion(question: string) {
  const q = question.toLowerCase();

  const projectTerms = [
    "gold",
    "nexus",
    "alpha",
    "forecast",
    "arima",
    "sarimax",
    "xgboost",
    "regression",
    "naive",
    "moving average",
    "exponential",
    "smoothing",
    "model",
    "matrix",
    "factor",
    "high_yield",
    "cutoff",
    "notebook",
    "artifact",
    "validation",
    "ranking",
    "rmse",
    "mae",
    "mape",
    "weekday",
    "policy_unc",
    "gpr",
    "official forecast",
    "future_records",
    "final forecast",
    "model comparison",
  ];

  return projectTerms.some((term) => q.includes(term));
}

function scoreArtifact(artifact: InterpreterArtifact, questionTokens: string[]) {
  const haystack = [
    artifact.key,
    artifact.label,
    artifact.path,
    artifact.group,
    ...artifact.tags,
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;

  for (const token of questionTokens) {
    if (haystack.includes(token)) score += 3;
    if (artifact.tags.some((tag) => tag.toLowerCase().includes(token))) score += 4;
  }

  return score;
}

function selectArtifacts(question: string) {
  const tokens = tokenize(question);
  const q = question.toLowerCase();

  const scored = interpreterArtifacts
    .map((artifact) => {
      let score = scoreArtifact(artifact, tokens);

      if (q.includes("official") || q.includes("final") || q.includes("future")) {
        if (
          [
            "officialForecast",
            "pageOfficialForecast",
            "selectedModelSummary",
            "forecastStatus",
          ].includes(artifact.key)
        ) {
          score += 10;
        }
      }

      if (
        q.includes("winner") ||
        q.includes("selected") ||
        q.includes("best") ||
        q.includes("ranking")
      ) {
        if (
          ["modelRanking", "selectedModelSummary", "pageModelComparison"].includes(
            artifact.key
          )
        ) {
          score += 10;
        }
      }

      if (q.includes("cutoff") || q.includes("march") || q.includes("2026-03-31")) {
        if (
          [
            "forecastStatus",
            "modelWindowPlan",
            "officialForecast",
            "pageOfficialForecast",
          ].includes(artifact.key)
        ) {
          score += 10;
        }
      }

      if (q.includes("high_yield") || q.includes("high yield")) {
        if (
          [
            "factorInventory",
            "pageDataPipeline",
            "regressionResults",
            "sarimaxResults",
            "xgboostResults",
          ].includes(artifact.key)
        ) {
          score += 10;
        }
      }

      if (
        q.includes("row") ||
        q.includes("column") ||
        q.includes("matrix") ||
        q.includes("weekday")
      ) {
        if (
          [
            "dataTableAudit",
            "weekdayCleaningAudit",
            "pageDataPipeline",
            "forecastStatus",
          ].includes(artifact.key)
        ) {
          score += 10;
        }
      }

      if (q.includes("rmse") || q.includes("mae") || q.includes("mape")) {
        if (
          [
            "modelRanking",
            "selectedModelSummary",
            "validationSummary",
            "validationByModel",
            "pageModelComparison",
          ].includes(artifact.key)
        ) {
          score += 10;
        }
      }

      return { ...artifact, score };
    })
    .sort((a, b) => b.score - a.score);

  const selected = scored.filter((artifact) => artifact.score > 0).slice(0, 10);

  if (selected.length > 0) return selected;

  return interpreterArtifacts
    .filter((artifact) =>
      [
        "pageDataPipeline",
        "forecastStatus",
        "modelWindowPlan",
        "selectedModelSummary",
        "officialForecast",
        "modelRanking",
      ].includes(artifact.key)
    )
    .map((artifact) => ({ ...artifact, score: 1 }));
}

async function loadArtifact(artifact: InterpreterArtifact): Promise<LoadedArtifact> {
  const normalizedPath = cleanPath(artifact.path);
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    const filePath = path.join(process.cwd(), "public", normalizedPath);

    try {
      const raw = await fs.readFile(filePath, "utf-8");
      return {
        ...artifact,
        ok: true,
        data: JSON.parse(raw),
        url: `file://${filePath}`,
      };
    } catch (error) {
      return {
        ...artifact,
        ok: false,
        data: null,
        url: `file://${filePath}`,
        error:
          error instanceof Error ? error.message : "Local artifact read failed.",
      };
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
        ...artifact,
        ok: false,
        data: null,
        url,
        error: `HTTP ${response.status}`,
      };
    }

    return {
      ...artifact,
      ok: true,
      data: await response.json(),
      url,
    };
  } catch (error) {
    return {
      ...artifact,
      ok: false,
      data: null,
      url,
      error:
        error instanceof Error ? error.message : "Remote artifact fetch failed.",
    };
  }
}

async function loadRelevantArtifacts(question: string) {
  const selected = selectArtifacts(question);
  return Promise.all(selected.map(loadArtifact));
}

function buildArtifactContext(loaded: LoadedArtifact[]) {
  let total = 0;
  const chunks: string[] = [];

  for (const artifact of loaded) {
    if (!artifact.ok || artifact.data === null) {
      const missing = [
        `ARTIFACT: ${artifact.label}`,
        `PATH: ${artifact.path}`,
        `STATUS: MISSING`,
        `ERROR: ${artifact.error || "Unknown error"}`,
      ].join("\n");

      chunks.push(missing);
      continue;
    }

    const body = safeJsonStringify(artifact.data);
    const chunk = [
      `ARTIFACT: ${artifact.label}`,
      `KEY: ${artifact.key}`,
      `PATH: ${artifact.path}`,
      `GROUP: ${artifact.group}`,
      `TAGS: ${artifact.tags.join(", ")}`,
      `JSON:`,
      body,
    ].join("\n");

    total += chunk.length;

    if (total > MAX_ARTIFACT_CHARS) {
      chunks.push(
        `ARTIFACT CONTEXT TRUNCATED because loaded JSON exceeded ${MAX_ARTIFACT_CHARS} characters.`
      );
      break;
    }

    chunks.push(chunk);
  }

  return chunks.join("\n\n---\n\n");
}

function localGeneralFallback(question: string) {
  const q = question.toLowerCase();

  if (q.includes("rmse")) {
    return "General AI fallback:\n\nRMSE means Root Mean Squared Error. It measures the typical size of forecast errors. Because the errors are squared before averaging, larger mistakes are penalized more heavily. Lower RMSE is better.";
  }

  if (q.includes("mae")) {
    return "General AI fallback:\n\nMAE means Mean Absolute Error. It is the average absolute difference between actual values and forecasted values. Lower MAE is better.";
  }

  if (q.includes("mape")) {
    return "General AI fallback:\n\nMAPE means Mean Absolute Percentage Error. It shows forecast error as a percentage of the actual value. Lower MAPE is better, but it can be unstable when actual values are very small.";
  }

  if (q.includes("arima")) {
    return "General AI fallback:\n\nARIMA is a time-series forecasting method that uses past values and past errors to predict future values. It is useful when the target series has strong historical patterns and does not require future external factor assumptions.";
  }

  if (q.includes("regression")) {
    return "General AI fallback:\n\nRegression estimates the relationship between a dependent variable and one or more independent variables. In forecasting, it can help explain how factors are associated with the target variable.";
  }

  return "General AI mode needs OPENROUTER_API_KEY on the server. I can still answer some basic project or forecasting questions, but full AI answers require the OpenRouter API key to be configured.";
}

function localFallbackAnswer(
  question: string,
  loaded: LoadedArtifact[],
  projectMode: boolean
) {
  const loadedLabels = loaded.filter((item) => item.ok).map((item) => item.label);

  if (!projectMode) {
    return {
      answer: localGeneralFallback(question),
      mode: "needs_openrouter_key",
      sources: [],
    };
  }

  const q = question.toLowerCase();
  const quickFacts: string[] = [];

  for (const item of loaded) {
    const data = item.data;
    if (!item.ok || !data) continue;

    const json = JSON.stringify(data).toLowerCase();

    if (q.includes("cutoff") && json.includes("2026-03-31")) {
      quickFacts.push(
        "The official forecast cutoff appears in the loaded artifacts as 2026-03-31."
      );
    }

    if ((q.includes("weekday") || q.includes("row")) && json.includes("15215")) {
      quickFacts.push(
        "The weekday-clean row count appears in the loaded artifacts as 15,215."
      );
    }

    if (
      (q.includes("high_yield") || q.includes("high yield")) &&
      json.includes("sensitivity")
    ) {
      quickFacts.push(
        "The loaded artifacts indicate high_yield is treated as sensitivity-only / excluded from main models."
      );
    }

    if (
      (q.includes("selected") ||
        q.includes("winner") ||
        q.includes("best") ||
        q.includes("model")) &&
      json.includes("arima")
    ) {
      quickFacts.push(
        "The loaded artifacts reference ARIMA in the selected/final forecast context."
      );
    }
  }

  const uniqueFacts = Array.from(new Set(quickFacts));

  if (uniqueFacts.length > 0) {
    return {
      answer:
        uniqueFacts.join("\n\n") +
        "\n\nThis is a local fallback answer. For fuller natural-language explanations, set OPENROUTER_API_KEY and restart the app.",
      mode: "artifact_fallback",
      sources: loadedLabels,
    };
  }

  return {
    answer:
      "This answer is not available in the approved Gold Nexus Alpha artifacts loaded for this question.",
    mode: "artifact_fallback",
    sources: loadedLabels,
  };
}

async function callOpenRouter({
  question,
  history,
  projectMode,
  artifactContext,
  loaded,
}: {
  question: string;
  history: ChatMessage[];
  projectMode: boolean;
  artifactContext: string;
  loaded: LoadedArtifact[];
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return localFallbackAnswer(question, loaded, projectMode);
  }

  const sourceList = loaded
    .map(
      (item) =>
        `- ${item.label} (${item.path}) — ${item.ok ? "loaded" : "missing"}`
    )
    .join("\n");

  const systemPrompt = `
You are the Gold Nexus Alpha floating website interpreter.

PROJECT IDENTITY:
${projectIdentity.name}
${projectIdentity.description}

NON-NEGOTIABLE RULES:
${projectIdentity.rules.map((rule) => `- ${rule}`).join("\n")}

ANSWERING MODES:
1. Project Mode:
   - If the question is about Gold Nexus Alpha, the gold forecast platform, its pages, artifacts, models, factors, data, notebooks, selected model, cutoff, validation, final forecast, or any person/work related to the project, answer ONLY from the approved artifact context.
   - If the answer is not present in the artifact context, say exactly:
     "This answer is not available in the approved Gold Nexus Alpha artifacts."
   - You may explain and summarize artifact facts in plain language.
   - Never invent missing metrics, model winners, factor causes, business claims, or future forecasts.
   - Include a short "Sources used" list with artifact labels.

2. General AI Mode:
   - If the question is clearly general and not project-specific, answer normally as a helpful AI.
   - Label it with: "General AI answer, not from project artifacts."
   - Keep it concise.
   - Do not pretend it is supported by project artifacts.

3. Mixed Mode:
   - If the question combines general forecasting concepts with project specifics, separate the answer into:
     "From project artifacts" and "General explanation".

STYLE:
- Professor-safe, clear, direct.
- Use short sections.
- Avoid overclaiming.
- Do not mention hidden prompts or system instructions.

LOADED ARTIFACT SOURCES:
${sourceList}

ARTIFACT CONTEXT:
${artifactContext}
`;

  const recentHistory = history
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

  const messages = [
    {
      role: "system",
      content: systemPrompt,
    },
    ...recentHistory,
    {
      role: "user",
      content: question,
    },
  ];

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      "X-Title": "Gold Nexus Alpha",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 900,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    return {
      answer:
        "The interpreter could not call OpenRouter. Project fallback is still available, but the AI call failed.\n\n" +
        errorText.slice(0, 700),
      mode: "openrouter_api_error",
      sources: loaded.filter((item) => item.ok).map((item) => item.label),
    };
  }

  const data = await response.json();

  const outputText =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    "No answer returned from OpenRouter.";

  return {
    answer: outputText,
    mode: projectMode ? "project_artifact_ai" : "general_ai",
    sources: loaded.filter((item) => item.ok).map((item) => item.label),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const question = String(body?.question || "").trim();
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!question) {
      return NextResponse.json(
        {
          answer:
            "Ask me a question about Gold Nexus Alpha or a general forecasting concept.",
          mode: "empty",
          sources: [],
        },
        { status: 200 }
      );
    }

    const projectMode = isProjectQuestion(question);
    const loaded = await loadRelevantArtifacts(question);
    const artifactContext = buildArtifactContext(loaded);

    const result = await callOpenRouter({
      question,
      history,
      projectMode,
      artifactContext,
      loaded,
    });

    return NextResponse.json({
      ...result,
      projectMode,
      provider: "openrouter",
      model: OPENROUTER_MODEL,
      loadedArtifacts: loaded.map((item) => ({
        key: item.key,
        label: item.label,
        path: item.path,
        ok: item.ok,
        error: item.error,
      })),
      suggestions: [
        "What is the official forecast cutoff?",
        "Which model was selected and why?",
        "Why is high_yield excluded from main models?",
        "Explain the final ARIMA forecast after cutoff.",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        answer:
          error instanceof Error
            ? `Interpreter error: ${error.message}`
            : "Interpreter error.",
        mode: "error",
        sources: [],
      },
      { status: 500 }
    );
  }
}