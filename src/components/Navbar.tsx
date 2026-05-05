/**
 * ============================================================================================================================================================
 * MODULE: GOLD NEXUS ALPHA NAVIGATION
 * ============================================================================================================================================================
 * Purpose:
 * - Professor-safe navigation for the clean Gold Nexus Alpha forecasting platform.
 * - Keeps Models as a dropdown after Data Pipeline.
 * - Shows Model Comparison and Final Forecast as direct top-level links.
 * - Adds a separate Deep ML Models dropdown after Final Forecast.
 * - Keeps frontend JSON-first: this navbar only hardcodes route labels.
 * ============================================================================================================================================================
 */

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const globalLinksBeforeModels = [
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
];

const globalLinksAfterModels = [
  { name: "MODEL COMPARISON", href: "/model-comparison" },
  { name: "FINAL FORECAST", href: "/forecast" },
];

const deepMlLinks = [
  { name: "DEEP ML OVERVIEW", href: "/deep-ml" },
  { name: "ALPHA STRUCTURAL", href: "/deep-ml/models/alpha-structural" },
  { name: "BETA TEMPORAL", href: "/deep-ml/models/beta-temporal" },
  { name: "DELTA TFT", href: "/deep-ml/models/delta-tft" },
  { name: "EPSILON ENSEMBLE", href: "/deep-ml/models/epsilon-ensemble" },
  { name: "NEWS SOURCE", href: "/deep-ml/news-source" },
  { name: "GAMMA NEWS SENSITIVITY", href: "", locked: true },
  { name: "OMEGA FUSION", href: "", locked: true },
  { name: "FINAL DEEP ML EVALUATION", href: "", locked: true },
];

function isRouteActive(pathname: string, href: string) {
  if (!href) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function TopNavLink({
  name,
  href,
  pathname,
}: {
  name: string;
  href: string;
  pathname: string;
}) {
  const active = isRouteActive(pathname, href);

  return (
    <Link
      href={href}
      className={`whitespace-nowrap text-[12px] font-black uppercase tracking-widest transition-colors ${
        active ? "text-blue-600" : "text-slate-400 hover:text-slate-700"
      }`}
    >
      {name}
    </Link>
  );
}

function DropdownCell({
  name,
  href,
  isActive,
  locked = false,
}: {
  name: string;
  href: string;
  isActive: boolean;
  locked?: boolean;
}) {
  const cellClassName = `group relative flex min-h-[52px] w-full items-center justify-center rounded-2xl border px-4 py-2 text-center shadow-inner backdrop-blur-md transition-all duration-300 ${
    locked
      ? "cursor-not-allowed border-white/10 bg-white/5 opacity-60"
      : isActive
        ? "scale-[1.02] border-yellow-300/50 bg-yellow-300/25 shadow-lg"
        : "border-white/10 bg-white/10 hover:bg-white/20"
  }`;

  const content = (
    <div className="flex flex-col items-center justify-center gap-1">
      <span
        className={`text-[11px] font-black uppercase leading-tight tracking-widest ${
          isActive ? "text-white" : "text-white/70 group-hover:text-white"
        }`}
      >
        {name}
      </span>

      {locked && (
        <span className="rounded-full border border-yellow-300/30 bg-yellow-300/10 px-2 py-0.5 text-[7px] font-black uppercase tracking-widest text-yellow-200">
          Coming Soon
        </span>
      )}
    </div>
  );

  if (locked || !href) {
    return (
      <div className={cellClassName} aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <Link href={href} className={cellClassName}>
      {content}
    </Link>
  );
}

function NavDropdown({
  label,
  subtitle,
  active,
  hoverKey,
  activeHover,
  setActiveHover,
  links,
  widthClassName,
}: {
  label: string;
  subtitle: string;
  active: boolean;
  hoverKey: string;
  activeHover: string | null;
  setActiveHover: React.Dispatch<React.SetStateAction<string | null>>;
  links: Array<{ name: string; href: string; locked?: boolean }>;
  widthClassName: string;
}) {
  return (
    <div
      className="relative flex h-16 shrink-0 cursor-pointer items-center px-2"
      onMouseEnter={() => setActiveHover(hoverKey)}
      onMouseLeave={() => setActiveHover(null)}
    >
      <div className="text-center leading-none">
        <span
          className={`text-[11px] font-black uppercase tracking-widest transition-colors ${
            activeHover === hoverKey || active ? "text-blue-600" : "text-blue-600/70"
          }`}
        >
          {label}
        </span>
        <p className="mt-0.5 text-[7px] font-bold uppercase tracking-widest text-slate-400">
          {subtitle}
        </p>
      </div>

      <AnimatePresence>
        {activeHover === hoverKey && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute left-1/2 top-full -translate-x-1/2 pt-2"
          >
            <div className="absolute left-0 top-0 h-3 w-full" />
            <div
              className={`grid gap-3 rounded-[2rem] border border-blue-500/40 bg-[#0f172a] p-5 shadow-2xl shadow-blue-600/30 ${widthClassName}`}
            >
              {links.map((link) => (
                <DropdownCell
                  key={`${hoverKey}-${link.name}`}
                  {...link}
                  isActive={isRouteActive(usePathname(), link.href)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [activeHover, setActiveHover] = useState<string | null>(null);

  const modelsActive = pathname.startsWith("/models");
  const deepMlActive = pathname.startsWith("/deep-ml");

  return (
    <nav className="sticky top-0 z-[1000] h-16 w-full select-none border-b border-slate-200 bg-white px-6 shadow-sm">
      <div className="mx-auto flex h-full max-w-[2600px] items-center">
        {/* BRANDING */}
        <div className="mr-6 flex shrink-0 items-center gap-6 border-r border-slate-200 pr-7">
          <Link href="/">
            <div className="flex flex-col leading-none">
              <h1 className="text-[25px] font-black tracking-tighter text-[#D4AF37]">
                GOLD<span className="text-slate-300">.AI</span>
              </h1>
              <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.35em] text-blue-600">
                NYIT Forecasting Lab
              </span>
            </div>
          </Link>
        </div>

        {/* MAIN NAV */}
        <div className="flex min-w-0 flex-grow items-center gap-5">
          {/* LEFT LINKS */}
          <div className="flex items-center gap-5 border-r border-slate-100 pr-5">
            {globalLinksBeforeModels.map((link) => (
              <TopNavLink key={link.href} {...link} pathname={pathname} />
            ))}
          </div>

          {/* BASELINE MODELS DROPDOWN */}
          <NavDropdown
            label="MODELS"
            subtitle="FORECAST METHODS"
            active={modelsActive}
            hoverKey="models"
            activeHover={activeHover}
            setActiveHover={setActiveHover}
            links={modelLinks}
            widthClassName="w-[520px] grid-cols-2"
          />

          {/* RIGHT LINKS AFTER MODELS */}
          <div className="flex items-center gap-5 border-l border-slate-100 pl-5">
            {globalLinksAfterModels.map((link) => (
              <TopNavLink key={link.href} {...link} pathname={pathname} />
            ))}

            {/* DEEP ML MODELS DROPDOWN */}
            <NavDropdown
              label="DEEP ML MODELS"
              subtitle="PHASE 2 RESEARCH"
              active={deepMlActive}
              hoverKey="deepml"
              activeHover={activeHover}
              setActiveHover={setActiveHover}
              links={deepMlLinks}
              widthClassName="w-[760px] grid-cols-3"
            />
          </div>
        </div>

        {/* RIGHT UTILITY */}
        <div className="ml-auto flex shrink-0 items-center gap-4">
          <Link
            href="/documentation"
            className="group flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-6 shadow-sm transition-all hover:border-blue-300"
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

          <div className="hidden h-11 items-center gap-4 rounded-2xl border border-slate-100 bg-white px-5 shadow-sm xl:flex">
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