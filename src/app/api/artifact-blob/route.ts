
import { NextRequest, NextResponse } from "next/server";
import {
  buildArtifactContextForQuestion,
  getArtifactCatalog,
  loadArtifactBlobContent,
  searchArtifactBlobs,
} from "@/lib/goldArtifactBlobService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const catalog = await getArtifactCatalog();

  return NextResponse.json({
    artifact_type: "gold_artifact_blob_catalog",
    status: "ready",
    count: catalog.length,
    catalog,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body?.action || "search");
    const query = String(body?.query || "");
    const pagePath = String(body?.pagePath || "");
    const limit = Number(body?.limit || 12);

    if (action === "catalog") {
      const catalog = await getArtifactCatalog();
      return NextResponse.json({ status: "ready", count: catalog.length, catalog });
    }

    if (action === "search") {
      const results = await searchArtifactBlobs(query, pagePath, limit);
      return NextResponse.json({ status: "ready", count: results.length, results });
    }

    if (action === "read") {
      const catalog = await getArtifactCatalog();
      const id = String(body?.id || "");
      const blob = catalog.find((item) => item.id === id || item.path === id || item.publicPath === id);

      if (!blob) {
        return NextResponse.json({ status: "not_found", error: "Artifact blob not found." }, { status: 404 });
      }

      const loaded = await loadArtifactBlobContent(blob, Number(body?.maxChars || 30000));
      return NextResponse.json({ status: loaded.ok ? "ready" : "error", loaded });
    }

    if (action === "context") {
      const context = await buildArtifactContextForQuestion({
        question: query,
        pagePath,
        maxArtifacts: limit,
      });

      return NextResponse.json({
        status: "ready",
        page: context.page,
        selected: context.selected,
        loaded: context.loaded.map((item) => ({
          blob: item.blob,
          ok: item.ok,
          error: item.error,
          contentPreview: item.content.slice(0, 1200),
        })),
      });
    }

    return NextResponse.json({ status: "error", error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { status: "error", error: error instanceof Error ? error.message : "Artifact blob API error." },
      { status: 500 }
    );
  }
}
