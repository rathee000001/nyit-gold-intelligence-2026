
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function lastNumber(values: any[]) {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const value = Number(values[i]);
    if (Number.isFinite(value)) return value;
  }

  return null;
}

export async function GET() {
  const symbol = "GC=F";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 Gold Nexus Alpha Research Platform",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          status: "error",
          source: "Yahoo Finance",
          symbol,
          error: `Yahoo HTTP ${response.status}`,
        },
        { status: 502 }
      );
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta || {};
    const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
    const quote = result?.indicators?.quote?.[0] || {};
    const closes = Array.isArray(quote?.close) ? quote.close : [];

    const regularPrice = Number(meta?.regularMarketPrice);
    const fallbackClose = lastNumber(closes);
    const price = Number.isFinite(regularPrice) ? regularPrice : fallbackClose;

    const regularTime = Number(meta?.regularMarketTime);
    const fallbackTime = timestamps.length ? Number(timestamps[timestamps.length - 1]) : null;
    const asOfUnix = Number.isFinite(regularTime) ? regularTime : fallbackTime;

    return NextResponse.json({
      status: "ready",
      source: "Yahoo Finance",
      symbol,
      price,
      currency: meta?.currency || "USD",
      exchangeName: meta?.exchangeName || meta?.fullExchangeName || "COMEX",
      instrumentType: meta?.instrumentType || "FUTURE",
      marketState: meta?.marketState || "unknown",
      asOf: asOfUnix ? new Date(asOfUnix * 1000).toISOString() : null,
      note:
        "Latest available Yahoo Finance GC=F quote. If the market is closed, this may show the most recent trading session.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        source: "Yahoo Finance",
        symbol,
        error: error instanceof Error ? error.message : "Yahoo live gold request failed.",
      },
      { status: 500 }
    );
  }
}
