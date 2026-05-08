import type { VectorProviderStatus, VectorSearchMatch, VectorSearchResult } from "./vectorTypes";

type SearchInput = {
  query: string;
  pagePath?: string;
  topK?: number;
};

function getUpstashConfig() {
  const restUrl = process.env.UPSTASH_VECTOR_REST_URL || "";
  const restToken = process.env.UPSTASH_VECTOR_REST_TOKEN || "";

  return {
    restUrl: restUrl.replace(/\/+$/, ""),
    restToken,
    configured: Boolean(restUrl && restToken),
  };
}

export function getVectorProviderStatus(): VectorProviderStatus {
  const config = getUpstashConfig();

  if (!config.configured) {
    return {
      provider: "disabled",
      active: false,
      configured: false,
      description:
        "Vector provider layer is present but disabled because UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN are not configured.",
    };
  }

  return {
    provider: "upstash",
    active: true,
    configured: true,
    description:
      "Upstash Vector provider is configured. Vector retrieval is optional context and does not replace approved artifact retrieval.",
  };
}

function normalizeUpstashMatch(item: any, index: number): VectorSearchMatch {
  const metadata = item?.metadata && typeof item.metadata === "object" ? item.metadata : {};
  const id = String(item?.id || metadata?.id || metadata?.path || `vector_match_${index + 1}`);

  const text =
    typeof item?.data === "string"
      ? item.data
      : typeof metadata?.text === "string"
      ? metadata.text
      : typeof metadata?.summary === "string"
      ? metadata.summary
      : "";

  return {
    id,
    score: Number.isFinite(Number(item?.score)) ? Number(item.score) : undefined,
    metadata,
    text,
  };
}

export async function searchVectorArtifacts(input: SearchInput): Promise<VectorSearchResult> {
  const query = String(input.query || "").trim();
  const topK = Math.max(1, Math.min(Number(input.topK || 8), 20));
  const status = getVectorProviderStatus();

  if (!query || !status.active) {
    return {
      query,
      status,
      matches: [],
    };
  }

  const config = getUpstashConfig();

  try {
    const response = await fetch(`${config.restUrl}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.restToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: query,
        topK,
        includeMetadata: true,
        includeVectors: false,
        filter: input.pagePath ? "" : undefined,
      }),
    });

    if (!response.ok) {
      const providerText = await response.text();

      return {
        query,
        status: {
          provider: "upstash",
          active: false,
          configured: true,
          description:
            "Upstash Vector is configured, but the query failed. Artifact catalog retrieval remains active.",
          error: providerText.slice(0, 500),
        },
        matches: [],
      };
    }

    const payload = await response.json();
    const rawMatches = Array.isArray(payload?.result)
      ? payload.result
      : Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.matches)
      ? payload.matches
      : [];

    return {
      query,
      status,
      matches: rawMatches.map(normalizeUpstashMatch),
    };
  } catch (error) {
    return {
      query,
      status: {
        provider: "upstash",
        active: false,
        configured: true,
        description:
          "Upstash Vector is configured, but the provider call failed. Artifact catalog retrieval remains active.",
        error: error instanceof Error ? error.message : "Unknown vector provider error.",
      },
      matches: [],
    };
  }
}

export function formatVectorMatchesForPrompt(result: VectorSearchResult) {
  if (!result.status.configured) {
    return result.status.description;
  }

  if (!result.status.active) {
    return `${result.status.description}${result.status.error ? `\nProvider error: ${result.status.error}` : ""}`;
  }

  if (!result.matches.length) {
    return "Vector provider is configured, but no vector matches were returned for this question.";
  }

  return result.matches
    .slice(0, 8)
    .map((match, index) => {
      const metadata = match.metadata || {};
      const label = String(metadata.label || metadata.title || match.id);
      const path = String(metadata.path || metadata.publicPath || "");
      const domain = String(metadata.domain || metadata.group || "");
      const score =
        typeof match.score === "number" ? `score=${match.score.toFixed(4)}` : "score=not_returned";
      const text = match.text ? `\n  text: ${String(match.text).slice(0, 700)}` : "";

      return `${index + 1}. ${label} | ${path} | ${domain} | ${score}${text}`;
    })
    .join("\n");
}
