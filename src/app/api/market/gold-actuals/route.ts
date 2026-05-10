import { NextResponse } from "next/server";

function toUnixSeconds(dateText: string, endOfDay = false) {
  const date = new Date(`${dateText}T${endOfDay ? "23:59:59" : "00:00:00"}Z`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

function ymdFromUnixSeconds(value: number) {
  return new Date(value * 1000).toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const symbol = searchParams.get("symbol") || "GC=F";
  const start = searchParams.get("start") || "2026-05-05";
  const end =
    searchParams.get("end") ||
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const period1 = toUnixSeconds(start, false);
  const period2 = toUnixSeconds(end, true);

  if (!period1 || !period2 || period2 <= period1) {
    return NextResponse.json(
      { ok: false, source: "Yahoo Finance chart API", symbol, rows: [], error: "Invalid date range." },
      { status: 200 }
    );
  }

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 Gold Nexus Alpha research dashboard",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          source: "Yahoo Finance chart API",
          symbol,
          rows: [],
          error: `Yahoo returned HTTP ${response.status}.`,
        },
        { status: 200 }
      );
    }

    const payload = await response.json();
    const result = payload?.chart?.result?.[0];
    const timestamps: number[] = Array.isArray(result?.timestamp) ? result.timestamp : [];
    const quote = result?.indicators?.quote?.[0] || {};
    const adjclose = result?.indicators?.adjclose?.[0]?.adjclose || [];

    const rows = timestamps
      .map((timestamp, index) => {
        const close = Number(quote.close?.[index] ?? adjclose?.[index]);
        return {
          date: ymdFromUnixSeconds(timestamp),
          actual: Number.isFinite(close) ? close : null,
        };
      })
      .filter((row) => row.actual !== null);

    return NextResponse.json({
      ok: true,
      source: "Yahoo Finance chart API",
      symbol,
      start,
      end,
      rows,
      rowCount: rows.length,
      note:
        "Actual prices are observational overlay data for visual comparison only. They do not alter forecast artifacts or prove model quality.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        source: "Yahoo Finance chart API",
        symbol,
        rows: [],
        error: error instanceof Error ? error.message : "Yahoo actual fetch failed.",
      },
      { status: 200 }
    );
  }
}
