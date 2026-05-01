import "server-only";
import { promises as fs } from "fs";
import path from "path";

export type ArtifactRequest = {
  key: string;
  label: string;
  path: string;
};

export type ArtifactLoadResult<T = any> = ArtifactRequest & {
  url: string;
  ok: boolean;
  data: T | null;
  error?: string;
};

function cleanBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "");
}

function cleanPath(artifactPath: string) {
  return artifactPath.trim().replace(/^\/+/, "");
}

export function getArtifactBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_ARTIFACT_BASE_URL;

  if (!baseUrl || baseUrl.trim() === "") {
    return "";
  }

  return cleanBaseUrl(baseUrl);
}

export function buildArtifactUrl(artifactPath: string) {
  const normalizedPath = cleanPath(artifactPath);
  const baseUrl = getArtifactBaseUrl();

  if (!baseUrl) {
    return `/${normalizedPath}`;
  }

  return `${baseUrl}/${normalizedPath}`;
}

async function loadLocalArtifact<T = any>(
  request: ArtifactRequest
): Promise<ArtifactLoadResult<T>> {
  const normalizedPath = cleanPath(request.path);
  const displayUrl = `/${normalizedPath}`;
  const localFilePath = path.join(process.cwd(), "public", normalizedPath);

  try {
    const raw = await fs.readFile(localFilePath, "utf-8");
    const data = JSON.parse(raw) as T;

    return {
      ...request,
      url: displayUrl,
      ok: true,
      data,
    };
  } catch (error) {
    return {
      ...request,
      url: displayUrl,
      ok: false,
      data: null,
      error:
        error instanceof Error
          ? `Local artifact read failed at ${localFilePath}: ${error.message}`
          : `Local artifact read failed at ${localFilePath}`,
    };
  }
}

async function loadRemoteArtifact<T = any>(
  request: ArtifactRequest
): Promise<ArtifactLoadResult<T>> {
  const url = buildArtifactUrl(request.path);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return {
        ...request,
        url,
        ok: false,
        data: null,
        error: `HTTP ${response.status} while loading ${url}`,
      };
    }

    const data = (await response.json()) as T;

    return {
      ...request,
      url,
      ok: true,
      data,
    };
  } catch (error) {
    return {
      ...request,
      url,
      ok: false,
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Unknown remote artifact loading error",
    };
  }
}

export async function loadArtifact<T = any>(
  request: ArtifactRequest
): Promise<ArtifactLoadResult<T>> {
  const baseUrl = getArtifactBaseUrl();

  if (!baseUrl) {
    return loadLocalArtifact<T>(request);
  }

  return loadRemoteArtifact<T>(request);
}

export async function loadArtifacts(requests: ArtifactRequest[]) {
  return Promise.all(requests.map((request) => loadArtifact(request)));
}

export function getLoadedArtifact<T = any>(
  results: ArtifactLoadResult[],
  key: string
): T | null {
  return (results.find((item) => item.key === key)?.data as T) || null;
}