export type ArtifactResult<T = unknown> = {
  ok: boolean;
  path: string;
  url: string;
  data: T | null;
  error?: string;
};

function cleanBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, "");
}

export function artifactUrl(path: string) {
  const normalizedPath = path.replace(/^\//, "");
  const baseUrl = process.env.NEXT_PUBLIC_ARTIFACT_BASE_URL;

  // Option A: Vercel/public artifact serving, e.g. /artifacts/data/file.json
  if (!baseUrl) return `/${normalizedPath}`;

  // Option B: GitHub raw serving, e.g. https://raw.githubusercontent.com/user/repo/main/artifacts/...
  return `${cleanBaseUrl(baseUrl)}/${normalizedPath}`;
}

export async function loadArtifact<T = unknown>(path: string): Promise<ArtifactResult<T>> {
  const url = artifactUrl(path);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return {
        ok: false,
        path,
        url,
        data: null,
        error: `Artifact request failed with HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as T;
    return { ok: true, path, url, data };
  } catch (error) {
    return {
      ok: false,
      path,
      url,
      data: null,
      error: error instanceof Error ? error.message : "Unknown artifact loading error",
    };
  }
}

export async function loadArtifacts<T extends Record<string, string>>(paths: T) {
  const entries = await Promise.all(
    Object.entries(paths).map(async ([key, path]) => [key, await loadArtifact(path)] as const)
  );

  return Object.fromEntries(entries) as {
    [K in keyof T]: ArtifactResult;
  };
}
