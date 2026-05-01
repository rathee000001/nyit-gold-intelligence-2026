export function formatNumber(value: any) {
  if (value === null || value === undefined || value === "") return "—";

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) return String(value);

  return numberValue.toLocaleString("en-US");
}

export function formatDecimal(value: any, digits = 2) {
  if (value === null || value === undefined || value === "") return "—";

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) return String(value);

  return numberValue.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPercent(value: any, digits = 2) {
  if (value === null || value === undefined || value === "") return "—";

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) return String(value);

  return `${numberValue.toFixed(digits)}%`;
}

export function formatCurrency(value: any, digits = 2) {
  if (value === null || value === undefined || value === "") return "—";

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) return String(value);

  return numberValue.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatText(value: any) {
  if (value === null || value === undefined || value === "") return "—";

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export function safeArray(value: any): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [];
}

export function pickValue(obj: any, keys: string[]) {
  if (!obj) return null;

  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key];
    }
  }

  return null;
}

export function firstArrayFromObject(obj: any, keys: string[]) {
  if (!obj) return [];

  if (Array.isArray(obj)) return obj;

  for (const key of keys) {
    if (Array.isArray(obj[key])) {
      return obj[key];
    }
  }

  return [];
}