
import { NextRequest, NextResponse } from "next/server";
import {
  buildArtifactContextForQuestion,
  isProjectQuestion,
} from "@/lib/goldArtifactBlobService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";

function localFallback(question: string, context: Awaited<ReturnType<typeof buildArtifactContextForQuestion>>, projectMode: boolean) {
  const q = question.toLowerCase();
  const sources = context.selected.map((item) => item.label);
  const facts: string[] = [];

  if (!projectMode) {
    return {
      answer:
        "General AI answer, not from project artifacts.\n\nThe artifact/blob layer is working, but a full general answer requires a valid OPENROUTER_API_KEY on the server.",
      mode: "needs_openrouter_key",
      sources,
    };
  }

  if (q.includes("this page") || q.includes("current page")) {
    facts.push(`${context.page.page}: ${context.page.summary}`);
  }

  if (q.includes("omega")) {
    facts.push("Omega is treated as a candidate fusion layer. It combines component model artifacts and should not be described as the final winner until final Deep ML evaluation artifacts exist.");
  }

  if (q.includes("gamma")) {
    facts.push("Gamma is used as context and interpretation. It should not be described as causal or as Omega training input unless a future approved artifact says so.");
  }

  if (q.includes("better") || q.includes("best") || q.includes("winner")) {
    facts.push("Predictive superiority should only be claimed after the final Deep ML evaluation compares models under the same rules.");
  }

  return {
    answer:
      (facts.length
        ? facts.join("\n\n")
        : "I found related artifacts, but the exact answer is not clearly available in the selected approved artifact context.") +
      "\n\nLocal artifact fallback only. Configure OPENROUTER_API_KEY for fuller natural-language explanation.",
    mode: "artifact_fallback",
    sources,
  };
}

async function callOpenRouter({
  question,
  history,
  context,
  projectMode,
}: {
  question: string;
  history: ChatMessage[];
  context: Awaited<ReturnType<typeof buildArtifactContextForQuestion>>;
  projectMode: boolean;
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return localFallback(question, context, projectMode);
  }

  const sourceList = context.selected
    .map((item) => `- ${item.label} | artifacts/${item.path} | ${item.group} | ${item.sizeBytes} bytes`)
    .join("\n");

  const systemPrompt = `
You are Gold AI, the artifact-grounded interpreter for the Gold Nexus Alpha website.

CURRENT PAGE:
${context.page.page}
${context.page.summary}

PROJECT RULES:
${context.projectRules.map((rule) => `- ${rule}`).join("\n")}

ANSWERING RULES:
1. If the question is about this project, answer only from the provided artifact context.
2. If the artifact context does not contain the answer, say: "This answer is not available in the approved Gold Nexus Alpha artifacts."
3. Use simple business-friendly language first, then technical detail when useful.
4. Do not claim causality. Do not claim forecasts are guaranteed.
5. Gamma/news context is interpretive only unless an artifact explicitly says otherwise.
6. Omega is a candidate fusion layer unless final Deep ML evaluation artifacts approve a final conclusion.
7. For general non-project questions, label the response: "General AI answer, not from project artifacts."
8. Always include a short "Sources used" section for project answers.

SELECTED ARTIFACT SOURCES:
${sourceList}

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
      temperature: 0.15,
      max_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const text = await response.text();

    return {
      answer:
        "Gold AI could not call OpenRouter. The artifact/blob layer loaded correctly, but the AI provider returned an error.\n\n" +
        text.slice(0, 700),
      mode: "openrouter_api_error",
      sources: context.selected.map((item) => item.label),
    };
  }

  const data = await response.json();
  const answer =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    "No answer returned from OpenRouter.";

  return {
    answer,
    mode: projectMode ? "artifact_blob_ai" : "general_ai",
    sources: context.selected.map((item) => item.label),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const question = String(body?.question || "").trim();
    const pagePath = String(body?.pagePath || "");
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!question) {
      return NextResponse.json({
        answer: "Ask me about this page, the forecast models, the matrix, artifacts, or a general forecasting concept.",
        mode: "empty",
        sources: [],
      });
    }

    const projectMode = isProjectQuestion(question, pagePath);

    const context = await buildArtifactContextForQuestion({
      question,
      pagePath,
      maxArtifacts: projectMode ? 12 : 5,
    });

    const result = await callOpenRouter({
      question,
      history,
      context,
      projectMode,
    });

    return NextResponse.json({
      ...result,
      projectMode,
      page: context.page,
      provider: process.env.OPENROUTER_API_KEY ? "openrouter" : "local_fallback",
      model: OPENROUTER_MODEL,
      selectedArtifacts: context.selected.map((item) => ({
        id: item.id,
        label: item.label,
        path: `artifacts/${item.path}`,
        group: item.group,
        domain: item.domain,
        modelKey: item.modelKey,
        sizeBytes: item.sizeBytes,
      })),
      suggestions: [
        "What does this page explain?",
        "Why is Gamma context-only?",
        "Explain Omega in business language.",
        "Which artifacts support this answer?",
        "What is the train validation test split?",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        answer: error instanceof Error ? `Gold AI error: ${error.message}` : "Gold AI error.",
        mode: "error",
        sources: [],
      },
      { status: 500 }
    );
  }
}
