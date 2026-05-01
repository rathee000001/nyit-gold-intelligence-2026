"use client";

import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type FutureForecastBandRow = {
  date: string;
  official_forecast: number | null;
  forecast_lower: number | null;
  forecast_upper: number | null;
  actual_gold_price?: number | null;
  residual?: number | null;
  absolute_error?: number | null;
  absolute_percentage_error?: number | null;
  inside_95_interval?: boolean | null;
  split?: string;
  selected_model_name?: string;
  source_model_label?: string;
  forecast_generation_mode?: string;
};

function toFiniteNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sanitizeActualGoldPrice(value: any): number | null {
  const n = toFiniteNumber(value);
  if (n === null) return null;

  // Gold cannot be zero. Treat 0 as missing so the chart does not draw a fake
  // actual-price line along the x-axis before post-cutoff actuals are joined.
  if (n <= 0) return null;

  return n;
}

function formatNumber(value: any, digits = 2) {
  const numericValue = toFiniteNumber(value);
  if (numericValue === null) return "—";

  return numericValue.toLocaleString("en-US", {
    maximumFractionDigits: digits,
  });
}

function formatIntervalHit(value: any) {
  if (value === true) return "YES";
  if (value === false) return "NO";
  return "—";
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload?.[0]?.payload || {};

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
        Forecast Date
      </p>

      <p className="mt-1 text-lg font-black text-slate-950">{label}</p>

      <div className="mt-4 grid gap-2 text-sm">
        <div className="flex justify-between gap-6">
          <span className="font-bold text-slate-500">Actual Gold Price</span>
          <span className="font-black text-slate-950">
            {formatNumber(row.actual_gold_price, 4)}
          </span>
        </div>

        <div className="flex justify-between gap-6">
          <span className="font-bold text-slate-500">Official Forecast</span>
          <span className="font-black text-blue-700">
            {formatNumber(row.official_forecast, 4)}
          </span>
        </div>

        <div className="flex justify-between gap-6">
          <span className="font-bold text-slate-500">Lower 95%</span>
          <span className="font-black text-slate-950">
            {formatNumber(row.forecast_lower, 4)}
          </span>
        </div>

        <div className="flex justify-between gap-6">
          <span className="font-bold text-slate-500">Upper 95%</span>
          <span className="font-black text-slate-950">
            {formatNumber(row.forecast_upper, 4)}
          </span>
        </div>

        <div className="flex justify-between gap-6">
          <span className="font-bold text-slate-500">Residual</span>
          <span className="font-black text-slate-950">
            {formatNumber(row.residual, 4)}
          </span>
        </div>

        <div className="flex justify-between gap-6">
          <span className="font-bold text-slate-500">Abs. Error</span>
          <span className="font-black text-slate-950">
            {formatNumber(row.absolute_error, 4)}
          </span>
        </div>

        <div className="flex justify-between gap-6">
          <span className="font-bold text-slate-500">APE %</span>
          <span className="font-black text-slate-950">
            {formatNumber(row.absolute_percentage_error, 4)}
          </span>
        </div>

        <div className="flex justify-between gap-6">
          <span className="font-bold text-slate-500">Inside 95%?</span>
          <span className="font-black text-slate-950">
            {formatIntervalHit(row.inside_95_interval)}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        <p>
          <b>Model:</b>{" "}
          {row.selected_model_name || row.source_model_label || "—"}
        </p>
        <p>
          <b>Mode:</b> {row.forecast_generation_mode || "—"}
        </p>
        <p>
          <b>Split:</b> {row.split || "—"}
        </p>
      </div>
    </div>
  );
}

export default function FutureForecastBandChart({
  rows,
  title = "Future ARIMA Forecast After Official Cutoff",
  subtitle = "Official forecast with lower and upper 95% confidence bounds.",
}: {
  rows: FutureForecastBandRow[];
  title?: string;
  subtitle?: string;
}) {
  const cleanRows = rows
    .filter((row) => row.date && row.official_forecast !== null)
    .map((row) => {
      const official = toFiniteNumber(row.official_forecast);
      const lower = toFiniteNumber(row.forecast_lower);
      const upper = toFiniteNumber(row.forecast_upper);
      const actual = sanitizeActualGoldPrice(row.actual_gold_price);

      const residual =
        toFiniteNumber(row.residual) ??
        (actual !== null && official !== null ? actual - official : null);

      const absoluteError =
        toFiniteNumber(row.absolute_error) ??
        (residual !== null ? Math.abs(residual) : null);

      const ape =
        toFiniteNumber(row.absolute_percentage_error) ??
        (actual !== null && actual !== 0 && absoluteError !== null
          ? (absoluteError / actual) * 100
          : null);

      const inside95 =
        typeof row.inside_95_interval === "boolean"
          ? row.inside_95_interval
          : actual !== null && lower !== null && upper !== null
          ? actual >= lower && actual <= upper
          : null;

      return {
        ...row,
        official_forecast: official,
        forecast_lower: lower,
        forecast_upper: upper,
        actual_gold_price: actual,
        residual,
        absolute_error: absoluteError,
        absolute_percentage_error: ape,
        inside_95_interval: inside95,
        lower_band_base: lower,
        forecast_interval:
          lower !== null && upper !== null ? upper - lower : null,
      };
    })
    .filter((row) => row.official_forecast !== null);

  if (cleanRows.length === 0) {
    return (
      <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-sm leading-7 text-slate-700">
        No future forecast rows are available for charting. Re-run Notebook 12
        and confirm that <b>future_records_after_cutoff</b> is exported.
      </div>
    );
  }

  const actualCount = cleanRows.filter(
    (row) => row.actual_gold_price !== null
  ).length;

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
      <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600">
            Future Forecast Chart
          </p>

          <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
            {title}
          </h3>

          <p className="mt-2 text-sm leading-7 text-slate-600">{subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
            Actual Rows: {actualCount}
          </span>

          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-blue-700">
            Official Forecast
          </span>

          <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-yellow-700">
            95% Band
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[1.5rem] bg-white p-4">
        <ComposedChart
          width={1180}
          height={500}
          data={cleanRows}
          margin={{ top: 20, right: 35, left: 30, bottom: 45 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            minTickGap={24}
            label={{
              value: "Future Business Date",
              position: "insideBottom",
              offset: -25,
              fontSize: 12,
              fontWeight: 700,
            }}
          />

          <YAxis
            tick={{ fontSize: 12 }}
            domain={["auto", "auto"]}
            tickFormatter={(value) => formatNumber(value, 0)}
            label={{
              value: "Gold Price Forecast (USD/oz)",
              angle: -90,
              position: "insideLeft",
              offset: -10,
              fontSize: 12,
              fontWeight: 700,
            }}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend verticalAlign="top" height={36} />

          <Area
            type="monotone"
            dataKey="lower_band_base"
            stackId="forecastBand"
            stroke="none"
            fill="transparent"
            name="Lower 95% Base"
            legendType="none"
            tooltipType="none"
          />

          <Area
            type="monotone"
            dataKey="forecast_interval"
            stackId="forecastBand"
            stroke="none"
            fill="#fde68a"
            fillOpacity={0.55}
            name="95% Forecast Interval"
          />

          <Line
            type="monotone"
            dataKey="forecast_lower"
            stroke="#ca8a04"
            strokeWidth={1.5}
            dot={false}
            name="Lower 95%"
          />

          <Line
            type="monotone"
            dataKey="official_forecast"
            stroke="#2563eb"
            strokeWidth={3}
            dot={{ r: 2 }}
            activeDot={{ r: 6 }}
            name="Official Forecast"
          />

          <Line
            type="monotone"
            dataKey="forecast_upper"
            stroke="#ca8a04"
            strokeWidth={1.5}
            dot={false}
            name="Upper 95%"
          />

          <Line
            type="monotone"
            dataKey="actual_gold_price"
            stroke="#16a34a"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
            name="Actual Gold Price"
            connectNulls={false}
          />

          <Brush
            dataKey="date"
            height={28}
            stroke="#2563eb"
            travellerWidth={10}
          />
        </ComposedChart>
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-600">
        Actual gold prices after the cutoff are used only for evaluation. The
        ARIMA model is still fit only through the official cutoff date.
      </p>
    </div>
  );
}
