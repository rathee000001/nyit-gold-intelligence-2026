import { NextRequest, NextResponse } from "next/server";
import { orchestrateRagAi } from "@/lib/ragAiOrchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    status: "ready",
    route: "/api/rag-ai",
    level: "RAG-1",
    description:
      "Additive RAG + SQL AI Orchestrator skeleton. It does not replace /api/gold-ai yet.",
    activeLayers: [
      "page-aware routing",
      "artifact blob retrieval",
      "optional SQL result context",
      "OpenRouter generation when configured",
      "local fallback when no API key is configured",
    ],
    professorSafeWording:
      "RAG-style artifact retrieval using a structured blob catalog, optional SQL result context, and an LLM generation layer.",
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const question = String(body?.question || "").trim();

    if (!question) {
      return NextResponse.json({
        answer:
          "Ask me about a Gold Nexus Alpha page, artifact, SQL result, model, forecast output, or project architecture.",
        mode: "empty",
        provider: "local_fallback",
        sources: [],
      });
    }

    const result = await orchestrateRagAi({
      question,
      pagePath: String(body?.pagePath || ""),
      history: Array.isArray(body?.history) ? body.history : [],
      sqlContext: body?.sqlContext || null,
      maxArtifacts: Number(body?.maxArtifacts || 0) || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        answer:
          error instanceof Error
            ? `Gold AI Orchestrator error: ${error.message}`
            : "Gold AI Orchestrator error.",
        mode: "error",
        provider: "error",
        sources: [],
      },
      { status: 500 }
    );
  }
}
