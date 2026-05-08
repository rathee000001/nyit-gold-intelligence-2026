import {
  buildArtifactContextForQuestion,
  isProjectQuestion,
} from "@/lib/goldArtifactBlobService";
import {
  formatVectorMatchesForPrompt,
  searchVectorArtifacts,
} from "@/lib/vector/vectorProvider";

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
  "Current migrated UI calls use /api/rag-ai.",
  "Legacy /api/gold-ai route is retained as a fallback route for now.",
  "Vector provider abstraction is present and optional.",
];

const NOT_ACTIVE_RAG_ARCHITECTURE = [
  "Production vector retrieval is active only when vector provider environment variables and an index are configured.",
  "Generated embedding/index records still need to be created and loaded into the vector provider.",
  "LangChain and LlamaIndex are not integrated yet.",
  "The orchestrator does not train, rerun, or validate forecasting models.",
  "The orchestrator does not update artifacts or run scheduled data refreshes.",
  "The orchestrator does not automatically execute SQL tools by itself yet.",

];

function buildArchitectureStatusText(vectorStatusText = "") {
  return [
    "Active now:",
    ...ACTIVE_RAG_ARCHITECTURE.map((item) => `- ${item}`),
    ...(vectorStatusText ? [`- Vector status: ${vectorStatusText}`] : []),
    "",
    "Not active yet / conditional:",
    ...NOT_ACTIVE_RAG_ARCHITECTURE.map((item) => `- ${item}`),
    "",
    "Safe description:",
    "- RAG-style artifact retrieval using a structured artifact catalog, optional SQL result context, optional vector retrieval when configured, and an LLM generation layer.",
    "- Do not call this a production vector database-backed RAG system unless a vector provider is configured and returning matches.",
  ].join("\n");
}

function sanitizeGeneratedAnswer(value: string) {
  return String(value || "")
    .replaceAll("rag_sql_orchestrator_ai", "RAG + SQL Orchestrator")
    .replaceAll("rag_sql_orchestrator_fallback", "RAG + SQL Fallback")
    .replaceAll("rag sql orchestrator ai", "RAG + SQL Orchestrator")
    .replaceAll("rag sql orchestrator fallback", "RAG + SQL Fallback")
    .replaceAll("RAG SQL Orchestrator", "RAG + SQL Orchestrator")
    .replaceAll("RAG SQL Fallback", "RAG + SQL Fallback")
    .replaceAll("-", "-")
    .replaceAll("-", "-")
    .replaceAll("‒", "-")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("−", "-")
    .replaceAll("â€™", "'")
    .replaceAll("âsafe", "-safe")
    .replaceAll("âordered", "-ordered")
    .replaceAll("âaware", "-aware")
    .replaceAll("âai", "-ai")
    .replaceAll("âbased", "-based")
    .replaceAll("âseries", "-series")
    .replaceAll("â03", "-03")
    .replaceAll("â", "-")
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
    .replaceAll("-", "-")
    .replaceAll("‐", "-")
    .replaceAll("−", "-")
    .replaceAll("•", "-")
    .replaceAll("\u00a0", " ")
    .replaceAll("/api/rag-airoute", "/api/rag-ai route")
    .replaceAll("/api/gold-airoute", "/api/gold-ai route")
    .replaceAll("RAG-style", "RAG-style")
    .replaceAll("artifact-blob", "artifact blob")
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


function isFinalDeepMlPagePath(pagePath?: string) {
  const p = String(pagePath || "").toLowerCase();
  return p.includes("final-deep-ml-evaluation");
}

function buildFinalDeepMlStrictRulesText() {
  return [
    "FINAL DEEP ML EVALUATION STRICT RULES:",
    "- This page may explain final Deep ML artifacts, Omega Fusion, component experts, forecast paths, intervals, and evaluation outputs.",
    "- Do not say the model is performing well, highly accurate, reliable, below industry benchmarks, production-ready, or decision-ready unless the provided artifact context explicitly states that exact claim.",
    "- Do not invent accuracy, confidence score, directional accuracy, industry benchmark, cost saving, operational efficiency, or business impact claims.",
    "- Do not call uncertainty bands a confidence score. If lower/upper bands exist, describe them as artifact-provided intervals or uncertainty bands.",
    "- Do not describe forecasts as guarantees.",
    "- Do not claim Gamma/news context is causal.",
    "- Do not say Omega is selected because it is best unless the final evaluation/ranking artifact explicitly supports that selection.",
    "- If exact metrics are not visible in the provided context, say the page contains evaluation artifacts but the exact metric value is not available in the selected context.",
    "- Date windows must be described exactly. Do not call a May-to-July period a six-month window.",
    "- Safe wording: 'The page presents artifact-backed Deep ML forecast and evaluation outputs.'",
    "- Safe wording: 'The forecast path is a model output for review, not a guaranteed future price path.'",
  ].join("\n");
}

function finalDeepMlRiskTerms(answer: string) {
  const lower = String(answer || "").toLowerCase();

  const risky = [
    "performing well",
    "strong performance",
    "high accuracy",
    "highly accurate",
    "reliable forecast",
    "reliable forecasts",
    "below industry benchmark",
    "industry benchmark",
    "directional accuracy",
    "confidence score",
    "above 95",
    "95%",
    "production-ready",
    "decision-ready",
    "cost savings",
    "optimize operations",
    "improved efficiency",
    "strong model",
    "quite confident",
    "guarantee",
    "guaranteed",
    "6-month window",
    "six-month window",
  ];

  return risky.filter((term) => lower.includes(term));
}

function buildFinalDeepMlSafetyFallback(
  context: Awaited<ReturnType<typeof buildArtifactContextForQuestion>>,
  riskyTerms: string[],
  sqlContextText = ""
) {
  const sourceNames = context.selected.map((item) => item.label).slice(0, 8);
  const hasFinalEvalSqlContext =
    sqlContextText.toLowerCase().includes("final_deep_ml_sql_explorer") ||
    sqlContextText.toLowerCase().includes("final deep ml evaluation sql result") ||
    sqlContextText.toLowerCase().includes("table: final_artifacts") ||
    sqlContextText.toLowerCase().includes("final_artifacts");

  if (hasFinalEvalSqlContext) {
    return sanitizeGeneratedAnswer([
      "This SQL result should be interpreted as Final Deep ML artifact metadata only.",
      "",
      "Safe SQL explanation:",
      "- The rows describe files registered on the Final Deep ML Evaluation page.",
      "- The result can identify artifact groups, labels, paths, file kinds, model families, and metadata tags.",
      "- A grouped result, such as files by group, shows project organization and artifact coverage by section.",
      "- Omega rows can be described as forecast, rollforward, evaluation, ranking, weights, report, or quality-review artifacts only when the label/path supports that description.",
      "- Metadata helps with traceability and navigation, but it is not the same as opening the artifact content.",
      "",
      "What this SQL result does not prove by itself:",
      "- Model accuracy or strong performance.",
      "- Production readiness or approval status.",
      "- Forecast validation or benchmark superiority.",
      "- Causality from Gamma/news context.",
      "- Guaranteed future gold prices.",
      "",
      "Artifact-safe response note: Some performance or reliability wording was not repeated because it requires direct support from the approved CSV/JSON artifacts.",
      "",
      sourceNames.length
        ? `Sources used: ${sourceNames.join(", ")}`
        : "Sources used: supplied Final Deep ML SQL result context.",
    ].join("\n"));
  }

  return sanitizeGeneratedAnswer([
    "This final Deep ML evaluation page should be explained from approved artifacts only.",
    "",
    "Safe business explanation:",
    "- The page presents Deep ML forecast and evaluation artifacts for Omega Fusion and the component expert models.",
    "- Omega Fusion can be described as the final Deep ML forecast layer only where supported by the final evaluation artifacts.",
    "- Forecast values, intervals, ranking, and quality statements must come from the loaded CSV/JSON artifacts.",
    "- Forecast paths are model outputs for review, not guaranteed future prices.",
    "- Gamma/news context should be treated as interpretive context, not causality.",
    "",
    "What I will not claim without artifact evidence:",
    "- High accuracy or strong performance.",
    "- Industry benchmark comparison.",
    "- A confidence score above 95%.",
    "- Directional accuracy strength.",
    "- Cost savings or operational efficiency impact.",
    "- Production readiness or approval status.",
    "",
    "Artifact-safe response note: Some performance or reliability wording was not repeated because it requires direct support from the approved artifacts.",
    "",
    sourceNames.length
      ? `Sources used: ${sourceNames.join(", ")}`
      : "Sources used: selected final Deep ML artifacts.",
  ].join("\n"));
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
    "\n\nProvider fallback response. A fuller natural-language answer requires the configured AI provider to be available.";

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
  vectorContextText,
  vectorStatusText,
  pagePath,
}: {
  question: string;
  history: RagChatMessage[];
  context: Awaited<ReturnType<typeof buildArtifactContextForQuestion>>;
  projectMode: boolean;
  sqlContextText: string;
  vectorContextText: string;
  vectorStatusText: string;
  pagePath?: string;
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const architectureStatusText = buildArchitectureStatusText(vectorStatusText);
  const finalDeepMlRulesText = isFinalDeepMlPagePath(pagePath)
    ? buildFinalDeepMlStrictRulesText()
    : "";

  if (!apiKey) {
    return localFallbackAnswer({ question, context, projectMode, sqlContextText });
  }

  const systemPrompt = `
You are Gold AI Orchestrator for the Gold Nexus Alpha forecasting platform.

ARCHITECTURE STATUS:
${architectureStatusText}

STRICT GROUNDING RULES:
${finalDeepMlRulesText ? `${finalDeepMlRulesText}\n` : ""}
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

VECTOR RETRIEVAL CONTEXT:
${vectorContextText || "No vector retrieval context supplied."}

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
        "Gold AI Orchestrator could not reach the AI provider. The artifact retrieval and optional SQL context layer loaded correctly, but the provider returned an error.\n\n" +
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

  const sanitizedAnswer = sanitizeGeneratedAnswer(rawAnswer);
  const riskyFinalDeepMlTerms = isFinalDeepMlPagePath(pagePath)
    ? finalDeepMlRiskTerms(sanitizedAnswer)
    : [];

  return {
    answer: riskyFinalDeepMlTerms.length
      ? buildFinalDeepMlSafetyFallback(context, riskyFinalDeepMlTerms, sqlContextText)
      : sanitizedAnswer,
    mode: projectMode ? "rag_sql_orchestrator_ai" : "general_ai",
    provider: "openrouter",
  };
}


function isArchitectureQuestion(question: string) {
  const q = String(question || "").toLowerCase();

  return (
    q.includes("rag") ||
    q.includes("orchestrator") ||
    q.includes("vector") ||
    q.includes("embedding") ||
    q.includes("langchain") ||
    q.includes("llamaindex") ||
    q.includes("sql tool") ||
    q.includes("sql context") ||
    q.includes("active yet") ||
    q.includes("not active")
  );
}

export async function orchestrateRagAi(input: RagOrchestratorInput) {
  const question = String(input.question || "").trim();
  const pagePath = String(input.pagePath || "");
  const history = Array.isArray(input.history) ? input.history : [];
  const sqlContext = input.sqlContext || null;
  const sqlContextText = buildSqlContextText(sqlContext);

  const projectMode =
    isArchitectureQuestion(question) ||
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

  const vectorResult = await searchVectorArtifacts({
    query: question,
    pagePath,
    topK: projectMode ? 8 : 4,
  });
  const vectorContextText = formatVectorMatchesForPrompt(vectorResult);
  const vectorStatusText = vectorResult.status.description;

  const result = await callOpenRouter({
    question,
    history,
    context,
    projectMode,
    sqlContextText,
    vectorContextText,
    vectorStatusText,
    pagePath,
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
        vectorResult.status.active ? "vector retrieval provider" : "vector provider abstraction",
        result.provider === "openrouter" ? "OpenRouter LLM generation" : "local fallback",
      ],
      futureLayers: [
        "generated artifact summary/index records",
        "LangChain or LlamaIndex routing",
        "automatic SQL tool execution",
      ],
      professorSafeDescription:
        "RAG-style artifact retrieval using a structured artifact catalog, optional SQL result context, optional vector retrieval when configured, and an LLM generation layer.",
    },
    vectorRetrieval: {
      provider: vectorResult.status.provider,
      active: vectorResult.status.active,
      configured: vectorResult.status.configured,
      description: vectorResult.status.description,
      matchCount: vectorResult.matches.length,
      matches: vectorResult.matches.slice(0, 8).map((match) => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata || {},
      })),
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
      "What is the current vector retrieval status?",
    ],
  };
}
