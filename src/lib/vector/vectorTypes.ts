export type VectorProviderName = "disabled" | "upstash";

export type VectorProviderStatus = {
  provider: VectorProviderName;
  active: boolean;
  configured: boolean;
  description: string;
  error?: string;
};

export type VectorSearchMatch = {
  id: string;
  score?: number;
  metadata?: Record<string, unknown>;
  text?: string;
};

export type VectorSearchResult = {
  query: string;
  status: VectorProviderStatus;
  matches: VectorSearchMatch[];
};
