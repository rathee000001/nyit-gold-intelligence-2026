import {
  buildArtifactContextForQuestion,
  isProjectQuestion,
} from "@/lib/goldArtifactBlobService";

export type RagChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type RagSqlContext = {
  source?: string;
  title?: string;
  tableName?: string;
  query?: string;
  rowCount?: number;
  columns?: string[];
  rows?: Record<string, unknown>[];
  notes?: string[];
};

export type RagOrchestratorInput = {
  question: string;
  pagePath?: string;
  history?: RagChatMessage[];
  sqlContext?: RagSqlContext | null;
  maxArtifacts?: number;
};

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";

const ACTIVE_RAG_ARCHITECTURE = [
  "/api/rag-ai route is active as an additive test route.",
  "src/lib/ragAiOrchestrator.ts is active as the shared orchestration layer.",
  "Page-aware routing is active through the existing page profile logic.",
  "Structured artifact blob retrieval is active through the approved artifact catalog.",
  "Artifact context loading is active for selected CSV/JSON/TXT/MD artifacts.",
  "Optional SQL result context is accepted when a page passes sqlContext.",
  "OpenRouter LLM generation is active when OPENROUTER_API_KEY is configured.",
  "Local fallback is active when the provider key is missing or provider calls fail.",
];

const NOT_ACTIVE_RAG_ARCHITECTURE = [
  "No production vector database is active yet.",
  "No generated embedding index is active yet.",
  "LangChain and LlamaIndex are not integrated yet.",
  "The orchestrator does not train, rerun, or validate forecasting models.",
  "The orchestrator does not update artifacts or run scheduled data refreshes.",
  "The orchestrator does not automatically execute SQL tools by itself yet.",
  "Existing UI components have not all been migrated from /api/gold-ai to /api/rag-ai yet.",
];

function buildArchitectureStatusText() {
  return [
    "Active now:",
    ...ACTIVE_RAG_ARCHITECTURE.map((item) => `- ${item}`),
    "",
    "Not active yet:",
    ...NOT_ACTIVE_RAG_ARCHITECTURE.map((item) => `- ${item}`),
    "",
    "Safe description:",
    "- RAG-style artifact retrieval using a structured blob catalog, optional SQL result context, and an LLM generation layer.",
    "- Do not call this a production vector database-backed RAG system until vector retrieval is actually implemented.",
  ].join("\n");
}

function sanitizeGeneratedAnswer(value: string) {
  return String(value || "")
    .replaceAll("â€™", "'")
    .replaceAll("â€œ", '"')
    .replaceAll("â€", '"')
    .replaceAll("â€\"", "-")
    .replaceAll("â€", "-")
    .replaceAll("â€“", "-")
    .replaceAll("â€”", "-")
    .replaceAll("â¯", " ")
    .replaceAll("Â", "")
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("•", "-")
    .replaceAll("\u00a0", " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function trimText(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n... [truncated by RAG AI orchestrator]`;
}

function buildSqlContextText(sqlContext?: RagSqlContext | null) {
  if (!sqlContext) return "";

  const safeRows = Array.isArray(sqlContext.rows)
    ? sqlContext.rows.slice(0, 40)
    : [];

  const payload = {
    source: sqlContext.source || "unknown",
    title: sqlContext.title || "SQL result context",
    tableName: sqlContext.tableName || "",
    query: sqlContext.query || "",
    rowCount: Number.isFinite(Number(sqlContext.rowCount))
      ? Number(sqlContext.rowCount)
      : safeRows.length,
    columns: Array.isArray(sqlContext.columns) ? sqlContext.columns : [],
    notes: Array.isArray(sqlContext.notes) ? sqlContext.notes : [],
    previewRows: safeRows,
  };

  return trimText(JSON.stringify(payload, null, 2), 18000);
}

function sourceListFromContext(
  context: Awaited<ReturnType<typeof buildArtifactContextForQuestion>>
) {
  return context.selected
    .map(
      (item) =>
        `- ${item.label} | artifacts/${item.path} | ${item.group} | ${item.domain} | ${item.sizeBytes} bytes`
    )
    .join("\n");
}

function localFallbackAnswer({
  question,
  context,
  projectMode,
  sqlContextText,
}: {
  question: string;
  context: Awaited<ReturnType<typeof buildArtifactContextForQuestion>>;
  projectMode: boolean;
  sqlContextText: string;
}) {
  const q = question.toLowerCase();
  const facts: string[] = [];

  if (sqlContextText) {
    facts.push(
      "SQL context was received by the orchestrator. The answer can reference the provided SQL result preview, but it should not invent rows or metrics beyond that preview."
    );
  }

  if (q.includes("this page") || q.includes("current page")) {
    facts.push(`${context.page.page}: ${context.page.summary}`);
  }

  if (q.includes("rag") || q.includes("orchestrator") || q.includes("vector")) {
    facts.push(buildArchitectureStatusText());
  }

  if (q.includes("vector")) {
    facts.push(
      "Vector retrieval is not active in this skeleton. It is reserved for a future generated index, LangChain/LlamaIndex layer, or vector database integration."
    );
  }

  if (q.includes("forecast")) {
    facts.push(
      "Forecasts should be described as model outputs, not guarantees. Final claims must come from approved CSV/JSON artifacts."
    );
  }

  const fallbackAnswer =
    (facts.length
      ? facts.join("\n\n")
      : projectMode
      ? "The orchestrator loaded project context, but the exact answer is not clearly available in the selected approved artifacts."
      : "General AI answer, not from project artifacts. A full response requires a valid OPENROUTER_API_KEY.") +
    "\n\nLocal orchestrator fallback only. Configure OPENROUTER_API_KEY for full natural-language generation.";

  return {
    answer: sanitizeGeneratedAnswer(fallbackAnswer),
    mode: projectMode ? "rag_sql_orchestrator_fallback" : "general_fallback",
    provider: "local_fallback",
  };
}

async function callOpenRouter({
  question,
  history,
  context,
  projectMode,
  sqlContextText,
}: {
  question: string;
  history: RagChatMessage[];
  context: Awaited<ReturnType<typeof buildArtifactContextForQuestion>>;
  projectMode: boolean;
  sqlContextText: string;
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const architectureStatusText = buildArchitectureStatusText();

  if (!apiKey) {
    return localFallbackAnswer({ question, context, projectMode, sqlContextText });
  }

  const systemPrompt = `
You are Gold AI Orchestrator for the Gold Nexus Alpha forecasting platform.

ARCHITECTURE STATUS:
${architectureStatusText}

STRICT GROUNDING RULES:
- For architecture, RAG, orchestrator, vector, LangChain, LlamaIndex, SQL-tool, or implementation-status questions, answer from ARCHITECTURE STATUS first.
- Do not infer implementation status from artifact names.
- Selected artifacts are sources for project context, not proof that a system feature is implemented.
- Do not mention Yahoo Finance, Bloomberg, Alpha Vantage, live streaming, regulatory compliance systems, or automatic refresh schedules unless the provided artifact context explicitly states them.
- Do not claim ARIMA, XGBoost, or any model is deployed, undeployed, operational, or untested unless an artifact explicitly says that.
- SQL context is read-only preview context. Summarize only the rows and columns supplied.
- If SQL context only includes label, path, modelKey, and sizeBytes, the safe interpretation is only: "this SQL result identifies artifact metadata rows."
- Do not describe a SQL row as approved, final, production-ready, validated, curated, stakeholder-ready, cutoff-aligned, or decision-making-ready unless those exact claims are present in the supplied SQL rows or loaded artifact context.
- File names such as official_forecast_path.csv can be described as "named Official Forecast Path" or "appears to be the official forecast path artifact by filename"; do not convert the filename into a verified governance claim.
- For file-size comments, say "larger file size may indicate more rows or wider output, but file size alone does not prove content detail or model quality."
- When explaining SQL results, include a short caution line: "This interpretation is based on SQL metadata only; deeper claims require opening the artifact or governance file."
- Use plain ASCII punctuation only. Avoid smart quotes, em dashes, bullets, nonbreaking spaces, and mojibake characters.

CURRENT PAGE:
${context.page.page}
${context.page.summary}

PROJECT RULES:
${context.projectRules.map((rule) => `- ${rule}`).join("\n")}

ANSWERING RULES:
1. If the question is about the project, answer only from approved artifact context and supplied SQL context.
2. If the artifacts or SQL context do not contain the answer, say it is not available in the approved Gold Nexus Alpha artifacts.
3. Do not claim causality.
4. Do not say forecasts are guaranteed.
5. Gamma/news context is interpretive only unless an approved artifact says otherwise.
6. Omega is a candidate fusion layer unless final evaluation artifacts approve a final conclusion.
7. SQL context is read-only result context. It does not alter model files, forecasts, or artifacts.
8. Always include a short "Sources used" section for project answers.

SELECTED ARTIFACT SOURCES:
${sourceListFromContext(context)}

SQL RESULT CONTEXT:
${sqlContextText || "No SQL result context supplied."}

ARTIFACT CONTEXT:
${context.contextText}
`;

  const recentHistory = history
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-8)
    .map((message) => ({ role: message.role, content: message.content }));

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      "X-Title": "Gold Nexus Alpha",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...recentHistory,
        { role: "user", content: question },
      ],
      temperature: 0.12,
      max_tokens: 1400,
    }),
  });

  if (!response.ok) {
    const text = await response.text();

    return {
      answer:
        "Gold AI Orchestrator could not call OpenRouter. The artifact retrieval and optional SQL context layer loaded, but the AI provider returned an error.\n\n" +
        text.slice(0, 700),
      mode: "openrouter_api_error",
      provider: "openrouter_error",
    };
  }

  const data = await response.json();
  const rawAnswer =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    "No answer returned from OpenRouter.";

  return {
    answer: sanitizeGeneratedAnswer(rawAnswer),
    mode: projectMode ? "rag_sql_orchestrator_ai" : "general_ai",
    provider: "openrouter",
  };
}

export async function orchestrateRagAi(input: RagOrchestratorInput) {
  const question = String(input.question || "").trim();
  const pagePath = String(input.pagePath || "");
  const history = Array.isArray(input.history) ? input.history : [];
  const sqlContext = input.sqlContext || null;
  const sqlContextText = buildSqlContextText(sqlContext);

  const projectMode =
    isProjectQuestion(question, pagePath) ||
    Boolean(sqlContextText) ||
    pagePath.includes("gold-ai") ||
    pagePath.includes("data-matrix") ||
    pagePath.includes("deep-ml");

  const context = await buildArtifactContextForQuestion({
    question,
    pagePath,
    maxArtifacts: input.maxArtifacts || (projectMode ? 12 : 5),
  });

  const result = await callOpenRouter({
    question,
    history,
    context,
    projectMode,
    sqlContextText,
  });

  return {
    ...result,
    projectMode,
    page: context.page,
    model: OPENROUTER_MODEL,
    sqlContextUsed: Boolean(sqlContextText),
    orchestration: {
      level: "RAG-1",
      activeLayers: [
        "page-aware routing",
        "artifact blob retrieval",
        "artifact context loading",
        ...(sqlContextText ? ["SQL result context"] : []),
        result.provider === "openrouter" ? "OpenRouter LLM generation" : "local fallback",
      ],
      futureLayers: [
        "generated artifact summary index",
        "optional vector retrieval",
        "optional LangChain or LlamaIndex routing",
      ],
      professorSafeDescription:
        "RAG-style artifact retrieval using a structured blob catalog, optional SQL result context, and an LLM generation layer.",
    },
    selectedArtifacts: context.selected.map((item) => ({
      id: item.id,
      label: item.label,
      path: `artifacts/${item.path}`,
      group: item.group,
      domain: item.domain,
      modelKey: item.modelKey,
      sizeBytes: item.sizeBytes,
    })),
    sources: context.selected.map((item) => item.label),
    suggestions: [
      "Explain the current page using artifacts.",
      "Explain this SQL result in business language.",
      "Which artifacts support this answer?",
      "What is active in the RAG orchestrator now?",
      "What is not implemented yet in vector retrieval?",
    ],
  };
}
