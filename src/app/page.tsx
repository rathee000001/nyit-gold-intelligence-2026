
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function TradingChart() {
  const candles = [
    { x: 132, y: 245, up: false, delay: "0.1s" },
    { x: 222, y: 207, up: true, delay: "0.28s" },
    { x: 315, y: 215, up: false, delay: "0.46s" },
    { x: 425, y: 146, up: true, delay: "0.64s" },
    { x: 540, y: 102, up: true, delay: "0.82s" },
    { x: 648, y: 82, up: true, delay: "1s" },
  ];

  return (
    <svg
      viewBox="0 0 760 390"
      className="home-chart-svg h-full w-full"
      role="img"
      aria-label="Animated gold forecast chart illustration"
    >
      <defs>
        <linearGradient id="chartLine" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="52%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#d4af37" />
        </linearGradient>

        <linearGradient id="forecastBand" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#d4af37" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0.05" />
        </linearGradient>

        <linearGradient id="movingSheen" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.75)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>

        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0.1  0 1 0 0 0.35  0 0 1 0 0.9  0 0 0 0.35 0"
          />
          <feBlend in="SourceGraphic" />
        </filter>
      </defs>

      <rect width="760" height="390" rx="34" fill="white" opacity="0.96" />

      {[70, 130, 190, 250, 310].map((y) => (
        <line
          key={y}
          className="home-grid-line"
          x1="55"
          y1={y}
          x2="705"
          y2={y}
          stroke="#e2e8f0"
          strokeWidth="2"
        />
      ))}

      {[90, 190, 290, 390, 490, 590, 690].map((x) => (
        <line
          key={x}
          className="home-grid-line home-grid-line-vertical"
          x1={x}
          y1="46"
          x2={x}
          y2="330"
          stroke="#eef2f7"
          strokeWidth="2"
        />
      ))}

      <path
        className="home-chart-shadow-line"
        d="M60 292 C120 270, 155 286, 215 238 C258 202, 300 214, 348 176 C395 138, 430 155, 475 122 C540 72, 590 90, 690 54"
        fill="none"
        stroke="#cbd5e1"
        strokeWidth="18"
        strokeLinecap="round"
        opacity="0.55"
      />

      <path
        className="home-chart-band"
        d="M60 292 C120 270, 155 286, 215 238 C258 202, 300 214, 348 176 C395 138, 430 155, 475 122 C540 72, 590 90, 690 54 L690 330 L60 330 Z"
        fill="url(#forecastBand)"
      />

      <path
        className="home-chart-line"
        d="M60 292 C120 270, 155 286, 215 238 C258 202, 300 214, 348 176 C395 138, 430 155, 475 122 C540 72, 590 90, 690 54"
        fill="none"
        stroke="url(#chartLine)"
        strokeWidth="7"
        strokeLinecap="round"
        filter="url(#softGlow)"
      />

      <rect
        className="home-chart-sheen"
        x="-210"
        y="35"
        width="170"
        height="300"
        rx="40"
        fill="url(#movingSheen)"
        opacity="0.55"
      />

      {candles.map((candle, index) => (
        <g
          key={index}
          className="home-candle"
          style={{ animationDelay: candle.delay }}
        >
          <line
            x1={candle.x}
            x2={candle.x}
            y1={candle.y - 34}
            y2={candle.y + 44}
            stroke={candle.up ? "#22c55e" : "#ef4444"}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <rect
            x={candle.x - 14}
            y={candle.up ? candle.y - 12 : candle.y}
            width="28"
            height="50"
            rx="6"
            fill={candle.up ? "#22c55e" : "#ef4444"}
          />
        </g>
      ))}

      <circle className="home-endpoint-pulse" cx="690" cy="54" r="13" fill="#2563eb" opacity="0.18" />
      <circle cx="690" cy="54" r="11" fill="#2563eb" stroke="white" strokeWidth="5" />
    </svg>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto h-[420px] w-full max-w-[720px] lg:h-[500px] lg:max-w-none">
      <style>{`
        .home-hero-visual {
          animation: homeHeroFloat 6s ease-in-out infinite;
        }

        .home-json-badge {
          animation: homeBadgeFloat 4.8s ease-in-out infinite;
        }

        .home-metric-card {
          animation: homeMetricRise 5.6s ease-in-out infinite;
        }

        .home-metric-card:nth-child(2) {
          animation-delay: .35s;
        }

        .home-metric-card:nth-child(3) {
          animation-delay: .7s;
        }

        .home-grid-line {
          animation: homeGridPulse 4.5s ease-in-out infinite;
        }

        .home-grid-line-vertical {
          animation-delay: .7s;
        }

        .home-chart-line {
          stroke-dasharray: 920;
          stroke-dashoffset: 920;
          animation: homeDrawLine 3s ease-out forwards, homeLineGlow 4.2s ease-in-out 3s infinite;
        }

        .home-chart-shadow-line {
          stroke-dasharray: 920;
          stroke-dashoffset: 920;
          animation: homeDrawLine 3s ease-out forwards;
        }

        .home-chart-band {
          transform-origin: center;
          animation: homeBandPulse 4.6s ease-in-out infinite;
        }

        .home-chart-sheen {
          animation: homeSheenMove 5.4s ease-in-out infinite;
        }

        .home-candle {
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center bottom;
          animation: homeCandleIn .9s cubic-bezier(.2,.9,.2,1) forwards, homeCandleFloat 4.8s ease-in-out 1.2s infinite;
        }

        .home-endpoint-pulse {
          transform-box: fill-box;
          transform-origin: center;
          animation: homePulsePoint 1.9s ease-in-out infinite;
        }

        @keyframes homeHeroFloat {
          0%, 100% { transform: translateY(0) rotate(-0.6deg); }
          50% { transform: translateY(-12px) rotate(0.4deg); }
        }

        @keyframes homeBadgeFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        @keyframes homeMetricRise {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }

        @keyframes homeGridPulse {
          0%, 100% { opacity: .55; }
          50% { opacity: 1; }
        }

        @keyframes homeDrawLine {
          to { stroke-dashoffset: 0; }
        }

        @keyframes homeLineGlow {
          0%, 100% { opacity: .92; }
          50% { opacity: 1; }
        }

        @keyframes homeBandPulse {
          0%, 100% { opacity: .55; }
          50% { opacity: .92; }
        }

        @keyframes homeSheenMove {
          0% { transform: translateX(0) rotate(8deg); opacity: 0; }
          25% { opacity: .65; }
          55% { opacity: .5; }
          100% { transform: translateX(980px) rotate(8deg); opacity: 0; }
        }

        @keyframes homeCandleIn {
          from { opacity: 0; transform: translateY(22px) scaleY(.62); }
          to { opacity: 1; transform: translateY(0) scaleY(1); }
        }

        @keyframes homeCandleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        @keyframes homePulsePoint {
          0%, 100% { transform: scale(.78); opacity: .16; }
          50% { transform: scale(1.65); opacity: .38; }
        }
      `}</style>

      <div className="home-json-badge absolute right-0 top-0 z-20 rounded-[1.8rem] border border-slate-200 bg-slate-950 px-6 py-4 text-white shadow-2xl">
        <p className="text-[10px] font-black uppercase tracking-[0.26em] text-yellow-300">
          JSON-First System
        </p>
        <p className="mt-2 text-sm font-bold text-slate-300">
          Colab → GitHub → Vercel
        </p>
      </div>

      <div className="home-hero-visual absolute right-0 top-20 w-full overflow-hidden rounded-[2.4rem] border border-slate-100 bg-white/90 p-5 shadow-[0_30px_100px_rgba(15,23,42,0.14)] backdrop-blur-xl lg:p-7">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex gap-2">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-yellow-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>

          <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
            XAU/USD · Research View
          </span>
        </div>

        <div className="h-[260px] sm:h-[300px] lg:h-[330px]">
          <TradingChart />
        </div>
      </div>

      <div className="absolute bottom-0 right-8 z-20 grid w-[min(520px,calc(100%-32px))] grid-cols-3 gap-3">
        <div className="home-metric-card rounded-2xl border border-blue-100 bg-white/95 p-4 shadow-xl backdrop-blur">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
            Matrix
          </p>
          <p className="mt-2 text-sm font-black text-slate-950">
            Daily factors
          </p>
        </div>

        <div className="home-metric-card rounded-2xl border border-yellow-100 bg-white/95 p-4 shadow-xl backdrop-blur">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
            Models
          </p>
          <p className="mt-2 text-sm font-black text-slate-950">
            Academic + Deep ML
          </p>
        </div>

        <div className="home-metric-card rounded-2xl border border-emerald-100 bg-white/95 p-4 shadow-xl backdrop-blur">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
            AI
          </p>
          <p className="mt-2 text-sm font-black text-slate-950">
            Artifact-grounded
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">
        {eyebrow}
      </p>
      <h3 className="mt-3 text-xl font-black tracking-tight text-slate-950">
        {title}
      </h3>
      <p className="mt-3 text-sm font-semibold leading-7 text-slate-500">
        {body}
      </p>
    </div>
  );
}

function PersonCard({
  name,
  id,
}: {
  name: string;
  id: string;
}) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
      <p className="text-sm font-black text-blue-800">{name}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-blue-500">
        Student ID: {id}
      </p>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-950">
      <section className="relative px-5 pb-14 pt-10 md:px-8 lg:px-12 xl:px-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_18%,rgba(37,99,235,0.10),transparent_30%),radial-gradient(circle_at_86%_22%,rgba(212,175,55,0.18),transparent_32%)]" />
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.42] [background-image:linear-gradient(rgba(148,163,184,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.18)_1px,transparent_1px)] [background-size:44px_44px]" />

        <div className="mx-auto grid max-w-[1720px] items-start gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(520px,0.88fr)] xl:gap-16">
          <div className="relative z-10 max-w-[820px] pt-10 lg:pt-16">
            <div className="inline-flex items-center gap-4 rounded-full border border-slate-200 bg-white/80 px-5 py-3 shadow-sm backdrop-blur">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
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

            <h1 className="mt-10 text-[clamp(4rem,8vw,8.4rem)] font-black leading-[0.92] tracking-tight">
              <span className="block text-[#d4af37] drop-shadow-sm">Gold.</span>
              <span className="block text-slate-950">Forecasting.</span>
              <span className="block text-blue-600">Model.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg font-medium leading-8 text-slate-600 md:text-xl md:leading-9">
              Gold Nexus Alpha is a JSON-first forecasting platform for gold price research.
              It connects cleaned market and macroeconomic data, academic forecasting methods,
              Deep ML expert models, validation outputs, and an artifact-grounded AI layer into
              one professor-safe web system.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/data-matrix"
                className="rounded-full bg-slate-950 px-8 py-4 text-sm font-black uppercase tracking-[0.14em] text-white shadow-xl transition hover:-translate-y-1 hover:bg-blue-700"
              >
                Open Data Matrix →
              </Link>

              <Link
                href="/deep-ml/models/final-deep-ml-evaluation"
                className="rounded-full border border-slate-200 bg-white px-8 py-4 text-sm font-black uppercase tracking-[0.14em] text-slate-950 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:bg-blue-50"
              >
                Final Deep ML
              </Link>

              <Link
                href="/gold-ai"
                className="rounded-full border border-blue-200 bg-blue-50 px-8 py-4 text-sm font-black uppercase tracking-[0.14em] text-blue-700 shadow-sm transition hover:-translate-y-1 hover:bg-blue-100"
              >
                Gold AI Studio
              </Link>
            </div>

            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Pipeline
                </p>
                <p className="mt-2 text-sm font-black text-slate-950">
                  Colab artifacts to Vercel
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Forecasting
                </p>
                <p className="mt-2 text-sm font-black text-slate-950">
                  Academic + Deep ML
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                  AI Layer
                </p>
                <p className="mt-2 text-sm font-black text-slate-950">
                  Artifact-grounded answers
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-0 hidden pt-2 lg:block">
            <HeroVisual />
          </div>
        </div>
      </section>

      <section className="relative px-5 pb-24 md:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto max-w-[1720px]">
          <div className="rounded-[2.5rem] border border-slate-200 bg-slate-50/70 p-6 shadow-sm md:p-8">
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.34em] text-blue-600">
                  Project Overview
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                  A forecasting platform built from approved artifacts.
                </h2>
                <p className="mt-4 text-sm font-semibold leading-7 text-slate-600">
                  The site is designed so important claims come from exported CSV/JSON artifacts rather than
                  manual text. The academic model pages show professor-style forecasting methods, while the
                  Deep ML section adds expert models, Omega fusion, Gamma context, a refreshed matrix, and
                  an AI Studio for artifact search and chart/table generation.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard
                  eyebrow="Academic model"
                  title="Professor-style forecast pages"
                  body="Baseline and classical forecasting models are presented with training windows, validation logic, forecast charts, and artifact evidence."
                />
                <InfoCard
                  eyebrow="Deep ML extension"
                  title="Expert model system"
                  body="Alpha, Beta, Delta, Epsilon, Gamma, and Omega extend the project into a separate Deep ML research layer."
                />
                <InfoCard
                  eyebrow="Data governance"
                  title="Matrix and source refresh"
                  body="The refreshed matrix connects source updates, live gold patching, feature-store governance, and model-ready rows."
                />
                <InfoCard
                  eyebrow="Gold AI"
                  title="Artifact-grounded assistant"
                  body="The AI layer is designed to answer from approved project files and route deeper chart/table work through Gold AI Studio."
                />
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                Course Context
              </p>

              <div className="mt-5 grid gap-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                    QANT 750
                  </p>
                  <p className="mt-2 font-black text-slate-900">
                    Spring 2026 · Managerial Decision Modelling
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Professor: Dr. Shaya Sheikh
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                    QANT 760
                  </p>
                  <p className="mt-2 font-black text-slate-900">
                    Spring 2026 · Operations Management Applications
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Professor: Dr. Rajendra Tibrewala
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                Developed By
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <PersonCard name="Praveen Rathee" id="1356370" />
                <PersonCard name="Sarthak Pareek" id="1360682" />
                <PersonCard name="Abhimanyu Chandrasekharan Menon" id="1360346" />
                <PersonCard name="Himanshu Mukeshbhai Patel" id="1360346" />
              </div>

              <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                  Faculty Guidance
                </p>
                <p className="mt-2 text-sm font-bold text-amber-900">
                  Dr. Shaya Sheikh · Dr. Rajendra Tibrewala
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="hidden h-0 select-none overflow-hidden opacity-0">
        {`
          GOLD NEXUS ALPHA HOME PAGE AUDIT
          Clean professor-style homepage.
          JSON-first platform context.
          Top-right animated hero visualization.
          Large gold coin removed; chart, candles, badge, and metric cards animated.
          Project description improved.
          Home page optimized for laptop and desktop display.
        `}
      </div>
    </main>
  );
}
