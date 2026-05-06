/**
 * ============================================================================================================================================================
 * MODULE: GOLD NEXUS ALPHA NAVIGATION
 * ============================================================================================================================================================
 * Purpose:
 * - Smooth professor-safe navbar for Gold Nexus Alpha.
 * - Main row emphasizes Deep ML Phase 2 pages directly, not hidden in a Deep ML dropdown.
 * - Academic Model is a separate dropdown/second-layer menu for the original baseline pages.
 * - DOCS removed.
 * - JSON-FIRST artifact indicator kept.
 * - No Deep ML pages marked "Coming Soon" in the navbar.
 * ============================================================================================================================================================
 */

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

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
  { name: "FINAL DEEP ML EVAL", href: "/deep-ml/models/final-deep-ml-evaluation" },
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
      className={`group relative flex h-12 shrink-0 items-center justify-center rounded-2xl px-3 text-center transition-all duration-200 ${
        active
          ? "bg-blue-50 text-blue-600 shadow-sm"
          : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"
      }`}
    >
      <span className="whitespace-nowrap text-[10px] font-black uppercase leading-tight tracking-[0.16em]">
        {item.name}
      </span>

      {active ? (
        <span className="absolute bottom-1.5 left-1/2 h-[2px] w-7 -translate-x-1/2 rounded-full bg-blue-600" />
      ) : null}
    </Link>
  );
}

function AcademicButton({
  active,
}: {
  active: boolean;
}) {
  return (
    <div
      className={`flex h-12 min-w-[116px] shrink-0 flex-col items-center justify-center rounded-2xl border px-4 leading-none transition-all duration-200 ${
        active
          ? "border-blue-200 bg-blue-50 text-blue-600 shadow-sm"
          : "border-slate-100 bg-white text-slate-400 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700"
      }`}
    >
      <span className="text-[8px] font-black uppercase tracking-[0.24em]">
        Academic
      </span>
      <span className="mt-1 text-[10px] font-black uppercase tracking-[0.18em]">
        Model
      </span>
    </div>
  );
}

function AcademicPanel({
  pathname,
}: {
  pathname: string;
}) {
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
    <div className="hidden h-11 shrink-0 items-center gap-4 rounded-2xl border border-slate-100 bg-white px-5 shadow-sm 2xl:flex">
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

  const academicActive =
    pathname.startsWith("/model3") ||
    pathname.startsWith("/data-pipeline") ||
    pathname.startsWith("/models") ||
    pathname.startsWith("/model-comparison") ||
    pathname.startsWith("/forecast");

  return (
    <nav className="sticky top-0 z-[1000] h-16 w-full select-none border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-[2800px] items-center gap-4">
        {/* BRAND */}
        <div className="flex h-full shrink-0 items-center border-r border-slate-200 pr-5">
          <Link href="/" className="group">
            <div className="flex flex-col leading-none">
              <h1 className="text-[24px] font-black tracking-tighter text-[#D4AF37]">
                GOLD<span className="text-slate-300">.AI</span>
              </h1>
              <span className="mt-1 text-[7px] font-bold uppercase tracking-[0.34em] text-blue-600">
                NYIT Forecasting Lab
              </span>
            </div>
          </Link>
        </div>

        {/* MAIN DIRECT LINKS */}
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pr-2">
          {mainLinks.map((item) => (
            <MainNavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>

        {/* ACADEMIC MODEL DROPDOWN */}
        <div
          className="relative shrink-0"
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

        {/* JSON-FIRST UTILITY */}
        <ArtifactModePill />
      </div>
    </nav>
  );
}