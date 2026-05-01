/**
 * ============================================================================================================================================================
 * MODULE: GOLD NEXUS ALPHA NAVIGATION
 * ============================================================================================================================================================
 * Purpose:
 * - Professor-safe navigation for the clean Gold Nexus Alpha forecasting platform.
 * - Removes visible old Brain / Model 3 / Omniscient wording.
 * - Keeps internal project structure flexible while visible UI follows the Backbone.
 * - Frontend pages remain JSON-first; this navbar only hardcodes route labels.
 * ============================================================================================================================================================
 */

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const globalLinks = [
  { name: "HOME", href: "/" },
  { name: "HISTORY", href: "/history" },
  { name: "INTELLIGENCE", href: "/model3" },
  { name: "DATA PIPELINE", href: "/data-pipeline" },
];

const modelLinks = [
  { name: "NAIVE + MOVING AVG", href: "/models/naive-moving-average" },
  { name: "EXP. SMOOTHING", href: "/models/exponential-smoothing" },
  { name: "REGRESSION", href: "/models/regression" },
  { name: "ARIMA", href: "/models/arima" },
  { name: "SARIMAX", href: "/models/sarimax" },
  { name: "XGBOOST", href: "/models/xgboost" },
  { name: "PROPHET", href: "/models/prophet" },
];

const analysisLinks = [
  { name: "MODEL COMPARISON", href: "/model-comparison" },
  { name: "FINAL FORECAST", href: "/forecast" },
];

function isRouteActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function DropdownCell({
  name,
  href,
  isActive,
}: {
  name: string;
  href: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative group flex min-h-[52px] w-full items-center justify-center rounded-2xl border px-4 py-2 text-center shadow-inner backdrop-blur-md transition-all duration-300
      ${
        isActive
          ? "scale-[1.02] border-yellow-300/50 bg-yellow-300/25 shadow-lg"
          : "border-white/10 bg-white/10 hover:bg-white/20"
      }`}
    >
      <span
        className={`text-[11px] font-black uppercase leading-tight tracking-widest ${
          isActive ? "text-white" : "text-white/70 group-hover:text-white"
        }`}
      >
        {name}
      </span>
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [activeHover, setActiveHover] = useState<string | null>(null);

  return (
    <nav className="sticky top-0 z-[1000] h-16 w-full select-none border-b border-slate-200 bg-white px-8 shadow-sm">
      <div className="mx-auto flex h-full max-w-[2600px] items-center">
        {/* BRANDING */}
        <div className="mr-6 flex shrink-0 items-center gap-6 border-r border-slate-200 pr-8">
          <Link href="/">
            <div className="flex flex-col leading-none">
              <h1 className="text-[26px] font-black tracking-tighter text-[#D4AF37]">
                GOLD<span className="text-slate-300">.AI</span>
              </h1>
              <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.4em] text-blue-600">
                NYIT Forecasting Lab
              </span>
            </div>
          </Link>
        </div>

        {/* MAIN NAV */}
        <div className="flex flex-grow items-center gap-8">
          <div className="flex gap-6 border-r border-slate-100 pr-8">
            {globalLinks.map((link) => {
              const active = isRouteActive(pathname, link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-[12px] font-black uppercase tracking-widest transition-colors ${
                    active
                      ? "text-blue-600"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>

          {/* FORECASTING MODELS DROPDOWN */}
          <div className="flex items-center gap-6">
            <div
              className="relative flex h-16 cursor-pointer items-center px-3"
              onMouseEnter={() => setActiveHover("models")}
              onMouseLeave={() => setActiveHover(null)}
            >
              <div className="text-center leading-none">
                <span
                  className={`text-[11px] font-black uppercase tracking-widest transition-colors ${
                    activeHover === "models" || pathname.startsWith("/models")
                      ? "text-blue-600"
                      : "text-blue-600/70"
                  }`}
                >
                  MODELS
                </span>
                <p className="mt-0.5 text-[7px] font-bold uppercase tracking-widest text-slate-400">
                  FORECAST METHODS
                </p>
              </div>

              <AnimatePresence>
                {activeHover === "models" && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute left-1/2 top-full -translate-x-1/2 pt-2"
                  >
                    <div className="absolute left-0 top-0 h-3 w-full" />
                    <div className="grid w-[520px] grid-cols-2 gap-3 rounded-[2rem] border border-blue-500/40 bg-[#0f172a] p-5 shadow-2xl shadow-blue-600/30">
                      {modelLinks.map((link) => (
                        <DropdownCell
                          key={link.href}
                          {...link}
                          isActive={isRouteActive(pathname, link.href)}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* VALIDATION / FORECAST DROPDOWN */}
            <div
              className="relative flex h-16 cursor-pointer items-center px-3"
              onMouseEnter={() => setActiveHover("analysis")}
              onMouseLeave={() => setActiveHover(null)}
            >
              <div className="text-center leading-none">
                <span
                  className={`text-[11px] font-black uppercase tracking-widest transition-colors ${
                    activeHover === "analysis" ||
                    pathname.startsWith("/model-comparison") ||
                    pathname.startsWith("/forecast")
                      ? "text-blue-600"
                      : "text-blue-600/70"
                  }`}
                >
                  VALIDATION
                </span>
                <p className="mt-0.5 text-[7px] font-bold uppercase tracking-widest text-slate-400">
                  RANKING + FORECAST
                </p>
              </div>

              <AnimatePresence>
                {activeHover === "analysis" && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute left-1/2 top-full -translate-x-1/2 pt-2"
                  >
                    <div className="absolute left-0 top-0 h-3 w-full" />
                    <div className="grid w-[360px] grid-cols-1 gap-3 rounded-[2rem] border border-yellow-500/40 bg-[#0f172a] p-5 shadow-2xl shadow-yellow-600/20">
                      {analysisLinks.map((link) => (
                        <DropdownCell
                          key={link.href}
                          {...link}
                          isActive={isRouteActive(pathname, link.href)}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* RIGHT UTILITY */}
        <div className="ml-auto flex shrink-0 items-center gap-5">
          <Link
            href="/documentation"
            className="group flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-8 shadow-sm transition-all hover:border-blue-300"
          >
            <span
              className={`text-[12px] font-black uppercase tracking-widest ${
                isRouteActive(pathname, "/documentation")
                  ? "text-blue-600"
                  : "text-slate-400 group-hover:text-slate-600"
              }`}
            >
              DOCS
            </span>
          </Link>

          <div className="flex h-11 items-center gap-4 rounded-2xl border border-slate-100 bg-white px-5 shadow-sm">
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
        </div>
      </div>
    </nav>
  );
}