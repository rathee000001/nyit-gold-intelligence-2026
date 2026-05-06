"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ForecastChartRow = {
  date: string;
  split?: string;
  actual: number | null;
  naiveForecast?: number | null;
  movingAverageForecast?: number | null;
  forecast?: number | null;
  lower?: number | null;
  upper?: number | null;
  [key: string]: any;
};

export type MovingAverageMetricRow = {
  window: number | string;
  split: string;
  n?: number;
  MAE?: number;
  MSE?: number;
  RMSE?: number;
  MAPE?: number;
  mean_error_bias?: number;
  directional_accuracy_pct?: number;
  [key: string]: any;
};

export type MetricChartRow = {
  [key: string]: any;
};

type ForecastKey = keyof ForecastChartRow | string;

const MARKET_SHOCK_PERIODS = [
  {
    label: "Global Financial Crisis",
    start: "2008-09-15",
    end: "2009-06-30",
    fill: "#f97316",
  },
  {
    label: "COVID Shock",
    start: "2020-02-20",
    end: "2020-06-30",
    fill: "#ef4444",
  },
  {
    label: "Russia / Inflation Shock",
    start: "2022-02-24",
    end: "2022-12-30",
    fill: "#a855f7",
  },
  {
    label: "Banking Stress",
    start: "2023-03-08",
    end: "2023-05-31",
    fill: "#0ea5e9",
  },
];

function isBlankText(value: any) {
  if (value === null || value === undefined) return true;

  if (typeof value === "number") {
    return Number.isNaN(value);
  }

  const text = String(value).trim();
  if (!text) return true;

  const lowered = text.toLowerCase();
  return (
    lowered === "nan" ||
    lowered === "null" ||
    lowered === "undefined" ||
    lowered === "none" ||
    lowered === "untitled"
  );
}

function firstText(...values: any[]) {
  for (const value of values) {
    if (!isBlankText(value)) {
      return String(value).trim();
    }
  }

  return "";
}

function safeJsonArray(value: any) {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatNumber(value: any, digits = 2) {
  if (value === null || value === undefined || value === "") return "—";

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) return String(value);

  return numericValue.toLocaleString("en-US", {
    maximumFractionDigits: digits,
  });
}

function splitColor(split?: string) {
  const value = String(split || "").toLowerCase();

  if (value.includes("train")) return "#64748b";
  if (value.includes("validation")) return "#ca8a04";
  if (value.includes("test")) return "#2563eb";
  if (value.includes("forecast")) return "#16a34a";
  if (value.includes("rolling")) return "#7c3aed";
  if (value.includes("news")) return "#0f766e";

  return "#94a3b8";
}

function getSplitDates(rows: ForecastChartRow[]) {
  const found: Record<string, string> = {};

  for (const row of rows) {
    const split = String(row.split || "").toLowerCase();

    if (split.includes("validation") && !found.validation) {
      found.validation = row.date;
    }

    if (split.includes("test") && !found.test) {
      found.test = row.date;
    }

    if (split.includes("forecast") && !found.forecast) {
      found.forecast = row.date;
    }
  }

  return found;
}

function getVisibleMarketShockPeriods(rows: ForecastChartRow[]) {
  if (!rows.length) return [];

  const dates = rows.map((row) => String(row.date || "").slice(0, 10)).filter(Boolean);
  if (!dates.length) return [];

  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  return MARKET_SHOCK_PERIODS.filter((period) => {
    return period.end >= minDate && period.start <= maxDate;
  });
}

function rowsWithResidual(rows: ForecastChartRow[], forecastKey: ForecastKey) {
  return rows
    .filter((row) => row.actual !== null && row[forecastKey] !== null)
    .map((row) => ({
      ...row,
      residual:
        row.actual !== null && row[forecastKey] !== null
          ? Number(row.actual) - Number(row[forecastKey])
          : null,
    }));
}

function getNewsContext(row: any) {
  const headline = firstText(
    row?.gamma_tooltip_primary_headline,
    row?.top_headline_1,
    row?.newsHeadline
  );

  const source = firstText(
    row?.gamma_tooltip_primary_source,
    row?.top_headline_1_source,
    row?.newsSource,
    row?.source
  );

  const note = firstText(
    row?.gamma_tooltip_note,
    row?.newsTooltipNote,
    row?.source_coverage_note
  );

  const recentHeadlines = safeJsonArray(row?.gamma_recent_headlines_json)
    .slice(0, 5)
    .filter((item: any) => firstText(item?.title, item?.headline));

  const rawIntensity = row?.gamma_context_intensity;
  const intensity =
    !isBlankText(rawIntensity) && Number.isFinite(Number(rawIntensity))
      ? Number(rawIntensity)
      : undefined;

  const articleCount =
    !isBlankText(row?.article_count) && Number.isFinite(Number(row?.article_count))
      ? Number(row.article_count)
      : 0;

  const goldNewsCount =
    !isBlankText(row?.gold_news_count) && Number.isFinite(Number(row?.gold_news_count))
      ? Number(row.gold_news_count)
      : 0;

  const bucket = firstText(row?.gamma_context_bucket);
  const bucketLower = bucket.toLowerCase();

  const isContinuityOnlyRow =
    bucketLower === "no_loaded_news_score" &&
    articleCount === 0 &&
    goldNewsCount === 0 &&
    (!Number.isFinite(Number(intensity)) || Number(intensity) === 0) &&
    !headline &&
    !source &&
    recentHeadlines.length === 0;

  const hasRealContext =
    !!headline ||
    !!source ||
    recentHeadlines.length > 0 ||
    articleCount > 0 ||
    goldNewsCount > 0 ||
    (intensity !== undefined && intensity > 0 && bucketLower !== "no_loaded_news_score");

  if (isContinuityOnlyRow || !hasRealContext) {
    return null;
  }

  return {
    headline,
    source,
    note,
    recentHeadlines,
    intensity,
    bucket,
  };
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload?.[0]?.payload;
  const news = getNewsContext(row);

  return (
    <div className="max-w-[430px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      {row?.split ? (
        <p
          className="mt-1 text-xs font-black uppercase tracking-[0.14em]"
          style={{ color: splitColor(row.split) }}
        >
          {row.split}
        </p>
      ) : null}

      <div className="mt-3 space-y-1 text-sm">
        {payload.map((item: any) => (
          <div
            key={item.dataKey}
            className="flex items-center justify-between gap-6"
          >
            <span style={{ color: item.color }} className="font-bold">
              {item.name}
            </span>
            <span className="font-black text-slate-950">
              {formatNumber(item.value, 4)}
            </span>
          </div>
        ))}
      </div>

      {news ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
            News context
          </div>

          {news.headline ? (
            <div className="mt-2 text-xs font-black leading-5 text-slate-900">
              {news.headline}
            </div>
          ) : null}

          {news.source ? (
            <div className="mt-1 text-[11px] font-bold text-slate-500">
              Source: {news.source}
            </div>
          ) : null}

          {news.bucket || news.intensity !== undefined ? (
            <div className="mt-2 text-[11px] font-bold text-slate-600">
              {news.bucket ? `Context bucket: ${news.bucket}` : ""}
              {news.bucket && news.intensity !== undefined ? " · " : ""}
              {news.intensity !== undefined
                ? `Intensity: ${formatNumber(news.intensity, 3)}`
                : ""}
            </div>
          ) : null}

          {news.recentHeadlines.length > 0 ? (
            <div className="mt-2 space-y-1">
              {news.recentHeadlines.map((item: any, index: number) => {
                const itemTitle = firstText(item?.title, item?.headline);
                const itemSource = firstText(item?.source);

                return (
                  <div
                    key={`${itemTitle || "headline"}-${index}`}
                    className="text-[11px] font-semibold leading-4 text-slate-700"
                  >
                    {itemTitle}
                    {itemSource ? ` — ${itemSource}` : ""}
                  </div>
                );
              })}
            </div>
          ) : null}

          {news.note ? (
            <div className="mt-2 text-[11px] font-semibold leading-4 text-slate-600">
              {news.note}
            </div>
          ) : null}

          <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-amber-700">
            Context only · not causality
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChartFrame({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600">
            {eyebrow}
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
            {title}
          </h3>
          <p className="mt-2 max-w-5xl text-sm leading-7 text-slate-600">
            {subtitle}
          </p>
        </div>

        <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          Zoom with bottom brush
        </div>
      </div>

      <div className="h-[460px] rounded-3xl border border-slate-100 bg-white p-4">
        {children}
      </div>
    </div>
  );
}

function ShockAreas({ periods }: { periods: typeof MARKET_SHOCK_PERIODS }) {
  return (
    <>
      {periods.map((period) => (
        <ReferenceArea
          key={period.label}
          x1={period.start}
          x2={period.end}
          fill={period.fill}
          fillOpacity={0.08}
          strokeOpacity={0}
          label={{
            value: period.label,
            position: "insideTopLeft",
            fill: period.fill,
            fontSize: 10,
            fontWeight: 800,
            dy: 22,
            dx: 4,
          }}
        />
      ))}
    </>
  );
}

export function ActualVsForecastChart({
  rows,
  forecastKey = "forecast",
  forecastLabel = "Forecast",
  actualKey = "actual",
  actualLabel = "Actual",
  title,
  subtitle = "Forecast path with readable axes, tooltips, split markers, and zoom control.",
  yAxisLabel = "Gold Price (USD/oz)",
  showSplitMarkers = true,
  showMarketShockPeriods = true,
}: {
  rows: ForecastChartRow[];
  forecastKey?: ForecastKey;
  forecastLabel?: string;
  actualKey?: ForecastKey;
  actualLabel?: string;
  title: string;
  subtitle?: string;
  yAxisLabel?: string;
  showSplitMarkers?: boolean;
  showMarketShockPeriods?: boolean;
}) {
  const data = rows.filter(
    (row) => row[actualKey] !== null && row[forecastKey] !== null
  );

  const splitDates = getSplitDates(data);
  const shockPeriods = showMarketShockPeriods ? getVisibleMarketShockPeriods(data) : [];

  if (data.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        The artifact loaded, but the chart could not detect enough actual and
        forecast rows for {forecastLabel}.
      </div>
    );
  }

  return (
    <ChartFrame eyebrow="Actual vs Forecast" title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 58, right: 35, bottom: 70, left: 35 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

          <XAxis
            dataKey="date"
            minTickGap={42}
            tick={{ fontSize: 12, fill: "#475569" }}
            label={{
              value: "Time",
              position: "insideBottom",
              offset: -35,
              fill: "#334155",
              fontSize: 13,
              fontWeight: 800,
            }}
          />

          <YAxis
            tick={{ fontSize: 12, fill: "#475569" }}
            tickFormatter={(value) => formatNumber(value, 0)}
            width={80}
            label={{
              value: yAxisLabel,
              angle: -90,
              position: "insideLeft",
              fill: "#334155",
              fontSize: 13,
              fontWeight: 800,
            }}
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="top" height={34} />

          <ShockAreas periods={shockPeriods} />

          {showSplitMarkers && splitDates.validation ? (
            <ReferenceLine
              x={splitDates.validation}
              stroke="#ca8a04"
              strokeDasharray="5 5"
              label={{
                value: "Validation Start",
                fill: "#92400e",
                fontSize: 11,
                fontWeight: 800,
                position: "top",
                dy: -6,
              }}
            />
          ) : null}

          {showSplitMarkers && splitDates.test ? (
            <ReferenceLine
              x={splitDates.test}
              stroke="#2563eb"
              strokeDasharray="5 5"
              label={{
                value: "Test Start",
                fill: "#1d4ed8",
                fontSize: 11,
                fontWeight: 800,
                position: "top",
                dy: -6,
              }}
            />
          ) : null}

          {showSplitMarkers && splitDates.forecast ? (
            <ReferenceLine
              x={splitDates.forecast}
              stroke="#16a34a"
              strokeDasharray="5 5"
              label={{
                value: "Forecast Start",
                fill: "#15803d",
                fontSize: 11,
                fontWeight: 800,
                position: "top",
                dy: -6,
              }}
            />
          ) : null}

          <Line
            type="monotone"
            dataKey={actualKey}
            name={actualLabel}
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />

          <Line
            type="monotone"
            dataKey={forecastKey}
            name={forecastLabel}
            stroke="#ca8a04"
            strokeWidth={2}
            strokeDasharray="7 5"
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />

          <Brush
            dataKey="date"
            height={38}
            stroke="#2563eb"
            travellerWidth={10}
            tickFormatter={(value) => String(value).slice(0, 4)}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function ResidualChart({
  rows,
  forecastKey = "forecast",
  forecastLabel = "Forecast",
  actualKey = "actual",
  title,
  subtitle = "Residual = actual minus forecast. Large spikes show where the model struggled.",
  yAxisLabel = "Actual - Forecast",
  showSplitMarkers = true,
  showMarketShockPeriods = true,
}: {
  rows: ForecastChartRow[];
  forecastKey?: ForecastKey;
  forecastLabel?: string;
  actualKey?: ForecastKey;
  title: string;
  subtitle?: string;
  yAxisLabel?: string;
  showSplitMarkers?: boolean;
  showMarketShockPeriods?: boolean;
}) {
  const normalizedRows = rows.map((row) => ({
    ...row,
    actual: row[actualKey],
  }));

  const data = rowsWithResidual(normalizedRows, forecastKey);
  const splitDates = getSplitDates(data);
  const shockPeriods = showMarketShockPeriods ? getVisibleMarketShockPeriods(data) : [];

  if (data.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        Residual chart is unavailable because the artifact does not expose
        enough actual and forecast rows for {forecastLabel}.
      </div>
    );
  }

  return (
    <ChartFrame eyebrow="Residual Diagnostic" title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 58, right: 35, bottom: 70, left: 35 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

          <XAxis
            dataKey="date"
            minTickGap={42}
            tick={{ fontSize: 12, fill: "#475569" }}
            label={{
              value: "Time",
              position: "insideBottom",
              offset: -35,
              fill: "#334155",
              fontSize: 13,
              fontWeight: 800,
            }}
          />

          <YAxis
            tick={{ fontSize: 12, fill: "#475569" }}
            tickFormatter={(value) => formatNumber(value, 0)}
            width={80}
            label={{
              value: yAxisLabel,
              angle: -90,
              position: "insideLeft",
              fill: "#334155",
              fontSize: 13,
              fontWeight: 800,
            }}
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="top" height={34} />

          <ShockAreas periods={shockPeriods} />

          <ReferenceLine
            y={0}
            stroke="#0f172a"
            strokeDasharray="4 4"
            label={{
              value: "Zero Error",
              fill: "#334155",
              fontSize: 11,
              position: "right",
            }}
          />

          {showSplitMarkers && splitDates.validation ? (
            <ReferenceLine
              x={splitDates.validation}
              stroke="#ca8a04"
              strokeDasharray="5 5"
              label={{
                value: "Validation Start",
                fill: "#92400e",
                fontSize: 11,
                fontWeight: 800,
                position: "top",
                dy: -6,
              }}
            />
          ) : null}

          {showSplitMarkers && splitDates.test ? (
            <ReferenceLine
              x={splitDates.test}
              stroke="#2563eb"
              strokeDasharray="5 5"
              label={{
                value: "Test Start",
                fill: "#1d4ed8",
                fontSize: 11,
                fontWeight: 800,
                position: "top",
                dy: -6,
              }}
            />
          ) : null}

          <Line
            type="monotone"
            dataKey="residual"
            name={`${forecastLabel} Residual`}
            stroke="#2563eb"
            strokeWidth={1.8}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />

          <Brush
            dataKey="date"
            height={38}
            stroke="#2563eb"
            travellerWidth={10}
            tickFormatter={(value) => String(value).slice(0, 4)}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function MetricComparisonChart({
  rows,
  title = "Validation Error Comparison",
  subtitle = "Compares model performance across candidates. Lower error is usually better.",
  split = "validation",
  xKey = "window",
  xLabel = "Model / Window",
  yLabel = "Error",
  bars = [
    { key: "MAE", label: "MAE", color: "#2563eb" },
    { key: "RMSE", label: "RMSE", color: "#ca8a04" },
  ],
}: {
  rows: MetricChartRow[];
  title?: string;
  subtitle?: string;
  split?: string;
  xKey?: string;
  xLabel?: string;
  yLabel?: string;
  bars?: { key: string; label: string; color: string }[];
}) {
  const chartRows = rows
    .filter((row) => String(row.split || "").toLowerCase() === split.toLowerCase())
    .map((row) => ({
      ...row,
      chartLabel:
        row[`${xKey}Label`] ||
        row.label ||
        row.model ||
        row.model_name ||
        row[xKey] ||
        "Model",
    }));

  if (chartRows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-700">
        Metric comparison chart is unavailable because matching {split} rows
        were not detected in the artifact.
      </div>
    );
  }

  return (
    <ChartFrame
      eyebrow={`${split} Comparison`}
      title={title}
      subtitle={subtitle}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartRows}
          margin={{ top: 20, right: 35, bottom: 70, left: 35 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

          <XAxis
            dataKey="chartLabel"
            tick={{ fontSize: 12, fill: "#475569" }}
            label={{
              value: xLabel,
              position: "insideBottom",
              offset: -35,
              fill: "#334155",
              fontSize: 13,
              fontWeight: 800,
            }}
          />

          <YAxis
            tick={{ fontSize: 12, fill: "#475569" }}
            tickFormatter={(value) => formatNumber(value, 0)}
            width={80}
            label={{
              value: yLabel,
              angle: -90,
              position: "insideLeft",
              fill: "#334155",
              fontSize: 13,
              fontWeight: 800,
            }}
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="top" height={34} />

          {bars.map((bar) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              name={bar.label}
              fill={bar.color}
              radius={[8, 8, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
