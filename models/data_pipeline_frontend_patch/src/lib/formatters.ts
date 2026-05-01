export function formatNumber(value: unknown, fallback = "—") {
  if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString("en-US");
  if (typeof value === "string" && value.trim() !== "") return value;
  return fallback;
}

export function formatPercent(value: unknown, fallback = "—") {
  if (typeof value === "number" && Number.isFinite(value)) return `${value.toFixed(2)}%`;
  if (typeof value === "string" && value.trim() !== "") return value;
  return fallback;
}

export function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function pickFirst<T = unknown>(obj: Record<string, unknown> | null | undefined, keys: string[], fallback: T): T {
  if (!obj) return fallback;
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== "") return value as T;
  }
  return fallback;
}

export function toTitleLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
