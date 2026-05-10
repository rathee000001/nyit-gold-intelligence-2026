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
  "Vector provider layer is wired and can query Upstash Vector when environment variables and index records are configured.",
];

const NOT_ACTIVE_RAG_ARCHITECTURE = [
  "Production vector retrieval is conditional: active only when the vector provider is configured and returns matches.",
  "Generated artifact vector records are available through the project manifest and can be loaded into Upstash Vector.",
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
    .replaceAll("RAGâSQLâvector", "RAG-SQL-vector")
    .replaceAll("RAGâSQL", "RAG-SQL")
    .replaceAll("/api/ragâai", "/api/rag-ai")
    .replaceAll("/api/goldâai", "/api/gold-ai")
    .replaceAll("Pageâaware", "Page-aware")
    .replaceAll("pageâaware", "page-aware")
    .replaceAll("readâonly", "read-only")
    .replaceAll("vectorâonly", "vector-only")
    .replaceAll("cutâoff", "cut-off")
    .replaceAll("timeâsplit", "time-split")
    .replaceAll("timeâseries", "time-series")
    .replaceAll("artifactâbased", "artifact-based")
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

function buildCombinedSqlVectorEvidenceText({
  sqlContext,
  sqlContextText,
  context,
  vectorResult,
}: {
  sqlContext: RagSqlContext | null;
  sqlContextText: string;
  context: Awaited<ReturnType<typeof buildArtifactContextForQuestion>>;
  vectorResult: Awaited<ReturnType<typeof searchVectorArtifacts>>;
}) {
  const sqlUsed = Boolean(sqlContextText);
  const artifactLines = context.selected.slice(0, 10).map((item) => {
    return `- ${item.label} | artifacts/${item.path} | ${item.group} | ${item.domain}`;
  });

  const vectorLines = vectorResult.matches.slice(0, 8).map((match) => {
    const metadata = match.metadata || {};
    const label = String(metadata.label || metadata.title || match.id || "Vector match");
    const path = String(metadata.path || metadata.publicPath || "");
    const score = Number(match.score);
    const scoreText = Number.isFinite(score) ? score.toFixed(4) : "n/a";
    return `- ${label} | ${path} | score=${scoreText}`;
  });

  const sqlTitle = sqlContext?.title || "SQL result context";
  const sqlTable = sqlContext?.tableName || "";
  const sqlRows = Number.isFinite(Number(sqlContext?.rowCount))
    ? Number(sqlContext?.rowCount)
    : Array.isArray(sqlContext?.rows)
    ? sqlContext.rows.length
    : 0;

  return [
    "COMBINED SQL + VECTOR EXPLAIN MODE:",
    `- SQL context supplied: ${sqlUsed ? "yes" : "no"}`,
    `- SQL title: ${sqlTitle}`,
    `- SQL table: ${sqlTable || "not supplied"}`,
    `- SQL preview row count: ${sqlRows}`,
    `- Approved artifact source count: ${context.selected.length}`,
    `- Vector match count: ${vectorResult.matches.length}`,
    "",
    "Required answer structure when SQL context is supplied:",
    "1. Start with what the SQL preview rows show.",
    "2. Mention the approved artifact sources used as grounding context.",
    "3. Mention vector-matched retrieval candidates only as candidate context.",
    "4. Include the caution: This interpretation is based on SQL metadata or preview rows only; deeper claims require opening the artifact or governance file.",
    "5. Do not claim model accuracy, production approval, causality, validation, or forecast guarantees from SQL rows or vector matches.",
    "",
    "Approved artifact sources:",
    artifactLines.length ? artifactLines.join("\n") : "- none selected",
    "",
    "Vector-matched retrieval candidates:",
    vectorLines.length ? vectorLines.join("\n") : "- no vector matches returned",
  ].join("\n");
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

function vectorSourcesFromMatches(matches: any[]) {
  return matches.slice(0, 8).map((match) => {
    const metadata = match.metadata || {};
    return {
      id: match.id,
      label: String(metadata.label || metadata.title || match.id),
      path: String(metadata.path || metadata.publicPath || ""),
      publicPath: String(metadata.publicPath || ""),
      group: String(metadata.group || ""),
      domain: String(metadata.domain || ""),
      modelKey: String(metadata.modelKey || ""),
      score: match.score,
      safeBoundaries: Array.isArray(metadata.safeBoundaries) ? metadata.safeBoundaries : [],
    };
  });
}

function vectorSourceLabels(matches: any[]) {
  return vectorSourcesFromMatches(matches)
    .map((item) => item.label)
    .filter(Boolean);
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
      "Vector retrieval is optional context. When Upstash Vector is configured and returns matches, the response metadata exposes those matches as retrieval candidates. Vector matches do not replace approved artifact content."
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
  retrievalEvidenceText,
  pagePath,
}: {
  question: string;
  history: RagChatMessage[];
  context: Awaited<ReturnType<typeof buildArtifactContextForQuestion>>;
  projectMode: boolean;
  sqlContextText: string;
  vectorContextText: string;
  vectorStatusText: string;
  retrievalEvidenceText: string;
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
- When explaining SQL results, include a short caution line: "This interpretation is based on SQL metadata or preview rows only; deeper claims require opening the artifact or governance file."
- If SQL context and vector context are both present, use combined SQL + Vector explain mode.
- In combined SQL + Vector explain mode, separate: what the SQL rows show, approved artifact sources, vector-matched retrieval candidates, and safe limitations.
- Vector matches are retrieval candidates only. They do not replace approved artifact content and do not prove model quality.
- Do not claim model accuracy, production approval, causality, validation, or forecast guarantees from SQL rows or vector matches.
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

COMBINED SQL + VECTOR RETRIEVAL EVIDENCE:
${retrievalEvidenceText}

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
  const vectorSources = vectorSourcesFromMatches(vectorResult.matches);
  const vectorLabels = vectorSourceLabels(vectorResult.matches);
  const retrievalEvidenceText = buildCombinedSqlVectorEvidenceText({
    sqlContext,
    sqlContextText,
    context,
    vectorResult,
  });

  const result = await callOpenRouter({
    question,
    history,
    context,
    projectMode,
    sqlContextText,
    vectorContextText,
    vectorStatusText,
    retrievalEvidenceText,
    pagePath,
  });

  return {
    ...result,
    projectMode,
    page: context.page,
    model: OPENROUTER_MODEL,
    sqlContextUsed: Boolean(sqlContextText),
    orchestration: {
      level: vectorResult.status.active && vectorResult.matches.length > 0 ? "RAG + SQL + Vector" : "RAG + SQL",
      activeLayers: [
        "page-aware routing",
        "artifact blob retrieval",
        "artifact context loading",
        ...(sqlContextText ? ["SQL result context"] : []),
        vectorResult.status.active && vectorResult.matches.length > 0
          ? "Upstash vector retrieval"
          : vectorResult.status.configured
          ? "vector provider configured"
          : "vector provider abstraction",
        result.provider === "openrouter" ? "OpenRouter LLM generation" : "local fallback",
      ],
      futureLayers: [
        "LangChain or LlamaIndex orchestration framework",
        "automatic SQL tool execution",
        "scheduled artifact refresh or model rerun orchestration",
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
      sourceLabels: vectorLabels,
      matches: vectorResult.matches.slice(0, 8).map((match) => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata || {},
      })),
    },
    vectorSources,
    retrievalSummary: {
      artifactCatalogHits: context.selected.length,
      vectorHits: vectorResult.matches.length,
      sqlContextUsed: Boolean(sqlContextText),
      vectorContextUsed: vectorResult.status.active && vectorResult.matches.length > 0,
    },
    combinedExplainMode: {
      active: Boolean(sqlContextText) && vectorResult.status.active && vectorResult.matches.length > 0,
      sqlContextUsed: Boolean(sqlContextText),
      artifactCatalogHits: context.selected.length,
      vectorHits: vectorResult.matches.length,
      note: "SQL context is read-only preview context. Vector matches are retrieval candidates only.",
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
    sources: Array.from(new Set([
      ...context.selected.map((item) => item.label),
      ...vectorLabels.map((label) => `Vector: ${label}`),
    ])),
    suggestions: [
      "Explain the current page using artifacts.",
      "Explain this SQL result in business language.",
      "Which artifacts support this answer?",
      "What is active in the RAG orchestrator now?",
      "What is the current vector retrieval status?",
    ],
  };
}
