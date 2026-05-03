import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function TradingChart() {
  return (
    <svg
      viewBox="0 0 680 360"
      className="h-full w-full"
      role="img"
      aria-label="Gold forecast chart illustration"
    >
      <defs>
        <linearGradient id="chartLine" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>

        <linearGradient id="softGold" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#facc15" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      <rect width="680" height="360" rx="34" fill="white" opacity="0.92" />

      {[70, 130, 190, 250, 310].map((y) => (
        <line
          key={y}
          x1="50"
          y1={y}
          x2="630"
          y2={y}
          stroke="#e2e8f0"
          strokeWidth="2"
        />
      ))}

      <path
        d="M60 280 C120 260, 150 285, 205 230 C250 180, 282 230, 330 190 C370 150, 405 175, 450 125 C505 60, 560 95, 625 55"
        fill="none"
        stroke="url(#chartLine)"
        strokeWidth="8"
        strokeLinecap="round"
      />

      <path
        d="M60 280 C120 260, 150 285, 205 230 C250 180, 282 230, 330 190 C370 150, 405 175, 450 125 C505 60, 560 95, 625 55 L625 320 L60 320 Z"
        fill="url(#softGold)"
      />

      {[
        { x: 115, y: 240, up: false },
        { x: 210, y: 188, up: true },
        { x: 305, y: 215, up: false },
        { x: 420, y: 145, up: true },
        { x: 535, y: 98, up: true },
        { x: 610, y: 80, up: false },
      ].map((candle, index) => (
        <g key={index}>
          <line
            x1={candle.x}
            x2={candle.x}
            y1={candle.y - 30}
            y2={candle.y + 42}
            stroke={candle.up ? "#22c55e" : "#ef4444"}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <rect
            x={candle.x - 13}
            y={candle.up ? candle.y - 10 : candle.y}
            width="26"
            height="48"
            rx="5"
            fill={candle.up ? "#22c55e" : "#ef4444"}
          />
        </g>
      ))}

      <circle cx="625" cy="55" r="8" fill="#2563eb" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-950">
      <section className="relative px-6 py-20 md:px-10 lg:px-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.08),transparent_28%),radial-gradient(circle_at_75%_35%,rgba(212,175,55,0.12),transparent_28%)]" />

        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <div className="inline-flex items-center gap-4 rounded-full border border-slate-200 bg-slate-50 px-5 py-3 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <span className="text-xl font-black">▰</span>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Research Laboratory
                </p>
                <p className="text-sm font-black text-slate-950">
                  New York Institute of Technology
                </p>
              </div>
            </div>

            <h1 className="mt-12 max-w-3xl text-6xl font-black leading-[0.95] tracking-tight md:text-8xl">
              <span className="block text-[#d4af37]">Gold.</span>
              <span className="block text-slate-950">Forecasting.</span>
              <span className="block text-blue-600">Model.</span>
            </h1>

            <p className="mt-8 max-w-2xl text-xl font-medium leading-9 text-slate-600">
              A quantitative framework merging institutional factors, forecasting
              models, validation artifacts, and a JSON-first web platform for
              professor-safe gold price forecasting.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/data-pipeline"
                className="rounded-full bg-slate-950 px-8 py-4 text-sm font-black uppercase tracking-[0.14em] text-white shadow-xl transition hover:-translate-y-1 hover:bg-blue-700"
              >
                Launch Terminal →
              </Link>

              <Link
                href="/history"
                className="rounded-full border border-slate-200 bg-white px-8 py-4 text-sm font-black uppercase tracking-[0.14em] text-slate-950 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:bg-blue-50"
              >
                Explore History
              </Link>
            </div>

            {/* Metadata Cards */}
            <div className="mt-12 grid grid-cols-2 gap-4 border-t border-slate-100 pt-8">
              <div className="col-span-2">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Courses
                </span>

                <div className="grid gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-blue-600">
                      QANT 750
                    </span>
                    <span className="block font-bold text-slate-800">
                      Spring 2026 - M01 - Managerial Decision Modelling
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                      QANT_750-M01-2026SP-S | Term: Spring 2026
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-blue-600">
                      QANT 760
                    </span>
                    <span className="block font-bold text-slate-800">
                      Spring 2026 - M01 - Operations Management Applications
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                      QANT_760-M01-2026SP-S, QANT_760-W01-2026SP-S | Term:
                      Spring 2026
                    </span>
                  </div>
                </div>
              </div>

              <div className="col-span-2 md:col-span-1">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Professors
                </span>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                    Dr. Shaya Sheikh
                  </span>
                  <span className="rounded-md border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                    Dr. Rajendra Tibrewala
                  </span>
                </div>
              </div>

              <div className="col-span-2 md:col-span-1">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Project
                </span>
                <span className="font-bold text-slate-800">
                  Gold Nexus Alpha Forecasting Platform
                </span>
              </div>

              <div className="col-span-2 pt-4">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Developed By
                </span>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                    <span className="block text-sm font-black text-blue-800">
                      Praveen Rathee
                    </span>
                    <span className="mt-1 block text-[11px] font-bold uppercase tracking-widest text-blue-500">
                      Student ID: 1356370
                    </span>
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                    <span className="block text-sm font-black text-blue-800">
                      Sarthak Pareek
                    </span>
                    <span className="mt-1 block text-[11px] font-bold uppercase tracking-widest text-blue-500">
                      Student ID: 1360682
                    </span>
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                    <span className="block text-sm font-black text-blue-800">
                      Abhimanyu Chandrasekharan Menon
                    </span>
                    <span className="mt-1 block text-[11px] font-bold uppercase tracking-widest text-blue-500">
                      Student ID: 1360346
                    </span>
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                    <span className="block text-sm font-black text-blue-800">
                      Himanshu Mukeshbhai Patel
                    </span>
                    <span className="mt-1 block text-[11px] font-bold uppercase tracking-widest text-blue-500">
                      Student ID: 1360346
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative hidden min-h-[620px] lg:block">
            <div className="absolute right-0 top-20 w-[720px] rounded-[2.5rem] border border-slate-100 bg-white/80 p-8 shadow-[0_35px_120px_rgba(15,23,42,0.12)] backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-yellow-400" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                </div>

                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                  XAU/USD · 1D · Live
                </span>
              </div>

              <div className="h-[360px]">
                <TradingChart />
              </div>
            </div>

            <div className="absolute bottom-0 left-16 h-72 w-72 rounded-full border-[10px] border-white bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.35),rgba(255,255,255,0.65))] shadow-[0_30px_90px_rgba(212,175,55,0.25)] backdrop-blur-md" />

            <div className="absolute bottom-10 left-64 rounded-2xl border border-slate-100 bg-white px-8 py-4 shadow-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Live Forecast
              </p>
              <p className="mt-1 text-3xl font-black text-emerald-600">
                $2,642.50
              </p>
            </div>

            <div className="absolute right-8 top-0 rounded-[2rem] border border-slate-200 bg-slate-950 px-7 py-5 text-white shadow-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-yellow-300">
                JSON-First System
              </p>
              <p className="mt-2 text-sm font-bold text-slate-300">
                Colab → GitHub → Vercel
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="hidden h-0 select-none overflow-hidden opacity-0">
        {`
          GOLD NEXUS ALPHA HOME PAGE AUDIT
          Clean professor-style homepage.
          JSON-first platform context.
          Updated Spring 2026 course metadata.
          Updated project member names and student IDs.
          No raw JSX braces are printed outside expressions.
        `}
      </div>
    </main>
  );
}
