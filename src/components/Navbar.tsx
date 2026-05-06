
/**
 * MOBILE-FIRST GLOBAL NAVIGATION
 * - Desktop keeps full Deep ML navigation.
 * - Mobile collapses into a clean recruiter-friendly menu.
 * - No artifact/model logic changed.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

type NavItem = {
  name: string;
  href: string;
  subtitle?: string;
};

const mainLinks: NavItem[] = [
  { name: "HOME", href: "/" },
  { name: "HISTORY", href: "/history" },
  { name: "DATA MATRIX", href: "/data-matrix" },
  { name: "DEEP ML OVERVIEW", href: "/deep-ml" },
  { name: "ALPHA STRUCTURAL", href: "/deep-ml/models/alpha-structural" },
  { name: "BETA TEMPORAL", href: "/deep-ml/models/beta-temporal" },
  { name: "DELTA TFT", href: "/deep-ml/models/delta-tft" },
  { name: "EPSILON ENSEMBLE", href: "/deep-ml/models/epsilon-ensemble" },
  { name: "NEWS SOURCE", href: "/deep-ml/models/news-source" },
  { name: "GAMMA", href: "/deep-ml/models/gamma-news-sensitivity" },
  { name: "OMEGA", href: "/deep-ml/models/omega-fusion" },
  { name: "FINAL EVAL", href: "/deep-ml/models/final-deep-ml-evaluation" },
  { name: "GOLD AI", href: "/gold-ai" },
];

const academicLinks: NavItem[] = [
  { name: "INTELLIGENCE", href: "/model3", subtitle: "Research matrix" },
  { name: "DATA PIPELINE", href: "/data-pipeline", subtitle: "Source + cleaning" },
  { name: "MODEL COMPARISON", href: "/model-comparison", subtitle: "Baseline ranking" },
  { name: "FINAL FORECAST", href: "/forecast", subtitle: "Professor-safe output" },
];

const modelLinks: NavItem[] = [
  { name: "NAIVE + MOVING AVG", href: "/models/naive-moving-average" },
  { name: "EXP. SMOOTHING", href: "/models/exponential-smoothing" },
  { name: "REGRESSION", href: "/models/regression" },
  { name: "ARIMA", href: "/models/arima" },
  { name: "SARIMAX", href: "/models/sarimax" },
  { name: "XGBOOST", href: "/models/xgboost" },
];

function isRouteActive(pathname: string, href: string) {
  if (!href) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <Link href="/" className="group shrink-0">
      <div className="flex flex-col leading-none">
        <h1 className="text-[22px] font-black tracking-tighter text-[#D4AF37] sm:text-[24px]">
          GOLD<span className="text-slate-300">.AI</span>
        </h1>
        <span className="mt-1 text-[6.6px] font-bold uppercase tracking-[0.26em] text-blue-600 sm:text-[7px]">
          NYIT Forecasting Lab
        </span>
      </div>
    </Link>
  );
}

function MainNavLink({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const active = isRouteActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      className={`group relative flex h-10 shrink-0 items-center justify-center rounded-xl px-2.5 text-center transition-all duration-200 ${
        active
          ? "bg-blue-50 text-blue-600 shadow-sm"
          : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"
      }`}
    >
      <span className="whitespace-nowrap text-[9.6px] font-black uppercase leading-tight tracking-[0.13em]">
        {item.name}
      </span>

      {active ? (
        <span className="absolute bottom-1 left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full bg-blue-600" />
      ) : null}
    </Link>
  );
}

function MobileNavLink({
  item,
  pathname,
  onClick,
}: {
  item: NavItem;
  pathname: string;
  onClick: () => void;
}) {
  const active = isRouteActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex min-h-[48px] items-center justify-between rounded-2xl border px-4 py-3 transition ${
        active
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
      }`}
    >
      <span className="text-[12px] font-black uppercase tracking-[0.14em]">
        {item.name}
      </span>
      {item.subtitle ? (
        <span className="max-w-[120px] text-right text-[10px] font-bold text-slate-400">
          {item.subtitle}
        </span>
      ) : (
        <span className="text-slate-300">→</span>
      )}
    </Link>
  );
}

function AcademicButton({ active }: { active: boolean }) {
  return (
    <div
      className={`flex h-10 min-w-[104px] shrink-0 flex-col items-center justify-center rounded-xl border px-3 leading-none transition-all duration-200 ${
        active
          ? "border-blue-200 bg-blue-50 text-blue-600 shadow-sm"
          : "border-slate-100 bg-white text-slate-400 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700"
      }`}
    >
      <span className="text-[7.4px] font-black uppercase tracking-[0.22em]">
        Academic
      </span>
      <span className="mt-0.5 text-[8.8px] font-black uppercase tracking-[0.16em]">
        Model
      </span>
    </div>
  );
}

function AcademicPanel({ pathname }: { pathname: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.16 }}
      className="absolute right-0 top-full pt-3"
    >
      <div className="w-[780px] overflow-hidden rounded-[2rem] border border-slate-200 bg-white/95 p-4 shadow-2xl shadow-slate-300/40 backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.26em] text-blue-600">
              Academic Model
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500">
              Original professor-safe forecasting pages and baseline model methods.
            </div>
          </div>
          <div className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-600">
            JSON-FIRST
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {academicLinks.map((item) => {
            const active = isRouteActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-2xl border p-4 transition-all duration-200 ${
                  active
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200 hover:bg-white"
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.18em]">
                  {item.name}
                </div>
                <div className="mt-2 text-[11px] font-semibold leading-4 text-slate-500">
                  {item.subtitle}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
          <div className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
            Models / Forecast Methods
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            {modelLinks.map((item) => {
              const active = isRouteActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl border px-3 py-3 text-center text-[10px] font-black uppercase tracking-[0.14em] transition-all duration-200 ${
                    active
                      ? "border-blue-200 bg-blue-50 text-blue-600"
                      : "border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:text-slate-800"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ArtifactModePill() {
  return (
    <div className="hidden h-10 shrink-0 items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 shadow-sm min-[1750px]:flex">
      <div className="flex flex-col items-end leading-tight">
        <span className="text-[7px] font-bold uppercase tracking-widest text-slate-400">
          ARTIFACT MODE
        </span>
        <span className="text-[10px] font-black uppercase tracking-tighter text-emerald-500">
          JSON-FIRST
        </span>
      </div>
      <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [academicOpen, setAcademicOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const academicActive =
    pathname.startsWith("/model3") ||
    pathname.startsWith("/data-pipeline") ||
    pathname.startsWith("/models") ||
    pathname.startsWith("/model-comparison") ||
    pathname.startsWith("/forecast");

  const coreMobileLinks = mainLinks.slice(0, 4);
  const deepMlMobileLinks = mainLinks.slice(4);
  const closeMobile = () => setMobileOpen(false);

  return (
    <nav className="sticky top-0 z-[1000] w-full select-none border-b border-slate-200 bg-white/95 px-3 shadow-sm backdrop-blur-xl sm:px-4">
      <div className="mx-auto flex min-h-[64px] max-w-[2800px] items-center justify-between gap-3 py-2 lg:min-h-[72px]">
        <div className="flex h-12 shrink-0 items-center lg:border-r lg:border-slate-200 lg:pr-4">
          <Brand />
        </div>

        <div className="hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-1.5 overflow-visible pr-0 lg:flex">
          {mainLinks.map((item) => (
            <MainNavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>

        <div
          className="relative hidden shrink-0 lg:block"
          onMouseEnter={() => setAcademicOpen(true)}
          onMouseLeave={() => setAcademicOpen(false)}
        >
          <button type="button" aria-label="Academic Model navigation">
            <AcademicButton active={academicActive || academicOpen} />
          </button>

          <AnimatePresence>
            {academicOpen ? <AcademicPanel pathname={pathname} /> : null}
          </AnimatePresence>
        </div>

        <ArtifactModePill />

        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-[11px] font-black uppercase tracking-[0.16em] text-slate-700 shadow-sm lg:hidden"
          onClick={() => setMobileOpen((value) => !value)}
          aria-label="Toggle mobile navigation"
          aria-expanded={mobileOpen}
        >
          <span>{mobileOpen ? "Close" : "Menu"}</span>
          <span className="text-blue-600">{mobileOpen ? "×" : "☰"}</span>
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-slate-100 pb-4 lg:hidden"
          >
            <div className="max-h-[calc(100vh-82px)] overflow-y-auto px-1 pt-4">
              <div className="mb-4 rounded-[1.5rem] border border-blue-100 bg-blue-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">
                  Gold Nexus Alpha
                </div>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
                  JSON-first gold forecasting platform · Academic models · Deep ML · Artifact AI.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                    Main pages
                  </div>
                  <div className="grid gap-2">
                    {coreMobileLinks.map((item) => (
                      <MobileNavLink
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        onClick={closeMobile}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                    Deep ML system
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {deepMlMobileLinks.map((item) => (
                      <MobileNavLink
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        onClick={closeMobile}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                    Academic model
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[...academicLinks, ...modelLinks].map((item) => (
                      <MobileNavLink
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        onClick={closeMobile}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </nav>
  );
}
