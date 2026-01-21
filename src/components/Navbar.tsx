/**
 * ============================================================================================================================================================
 * MODULE: MASTER SCALED NAVIGATION (v20.0 - MODEL 3 INTELLIGENCE HUB)
 * ============================================================================================================================================================
 * ID:              0xNAV_MASTER_V20_MODEL3_SYNC
 * LAYOUT:          Optimized for single-model high-fidelity intelligence (Model 3).
 * FIX LOG:         
 * 1. DE-BLOAT:     Removed Model 1 and Model 2 legacy clusters as per directory purge.
 * 2. PRIMARY SYNC: Set 'OMNISCIENT ARCHITECT' as the central navigation node for Model 3.
 * 3. LAB LINK:     Updated 'RECURSIVE LAB' to point directly to the /model3 entry point.
 * ============================================================================================================================================================
 */

"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const globalLinks = [
  { name: 'HOME', href: '/' },
  { name: 'HISTORY', href: '/history' },
];

const m3Links = [
  { name: 'INTELLIGENCE HUB', href: '/model3' },
  { name: 'REGRESSION', href: '/regression' },
  { name: 'SIMULATION', href: '/simulation' },
  { name: 'OUT-SAMPLE', href: '/out-of-sample' }
];

export default function Navbar() {
  const pathname = usePathname();
  const [activeHover, setActiveHover] = useState<string | null>(null);

  // Helper for Scaled Translucent Cells
  const GridCell = ({ name, href, isActive }: { name: string, href: string, isActive: boolean }) => (
    <Link 
      href={href} 
      className={`relative group flex items-center justify-center w-full min-h-[52px] px-4 py-2 rounded-2xl transition-all duration-300
      ${isActive ? 'bg-white/35 border-white/50 shadow-lg scale-[1.02]' : 'bg-white/10 border-white/10 hover:bg-white/25'}
      border backdrop-blur-md shadow-inner text-center`}
    >
      <span className={`text-[11px] font-black tracking-widest leading-tight uppercase ${isActive ? 'text-white' : 'text-white/65 group-hover:text-white'}`}>
        {name}
      </span>
    </Link>
  );

  return (
    <nav className="w-full bg-white border-b border-slate-200 sticky top-0 z-[1000] px-8 select-none shadow-sm h-16">
      <div className="max-w-[2600px] mx-auto flex items-center h-full">
        
        {/* 1. BRANDING SECTION */}
        <div className="flex items-center gap-6 shrink-0 border-r border-slate-200 pr-8 mr-6">
          <Link href="/">
            <div className="flex flex-col leading-none">
              <h1 className="text-[26px] font-black tracking-tighter text-[#D4AF37]">GOLD<span className="text-slate-300">.AI</span></h1>
              <span className="text-[8px] font-bold text-blue-600 tracking-[0.4em] uppercase mt-1">NYIT Laboratory</span>
            </div>
          </Link>
        </div>

        {/* 2. COMPACT GLOBAL & MODEL ZONE */}
        <div className="flex items-center gap-10 flex-grow">
          
          {/* GLOBAL LINKS: HOME, HISTORY */}
          <div className="flex gap-8 border-r border-slate-100 pr-10">
            {globalLinks.map(link => (
              <Link key={link.href} href={link.href} className={`text-[13px] font-black tracking-widest uppercase transition-colors ${pathname === link.href ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                {link.name}
              </Link>
            ))}
          </div>

          {/* MODEL 3 PRIMARY TRIGGER */}
          <div className="flex items-center gap-8">
            <div 
              className="relative h-16 flex items-center px-4 cursor-pointer"
              onMouseEnter={() => setActiveHover('m3')}
              onMouseLeave={() => setActiveHover(null)}
            >
              <div className="text-center leading-none">
                <span className={`text-[11px] font-black uppercase tracking-tighter transition-colors ${activeHover === 'm3' ? 'text-blue-600' : 'text-blue-600/70'}`}>MODEL 3</span>
                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">OMNISCIENT ARCHITECT</p>
              </div>

              <AnimatePresence>
                {activeHover === 'm3' && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute top-full left-1/2 -translate-x-1/2 pt-2">
                    <div className="absolute top-0 left-0 w-full h-3" /> {/* HOVER BRIDGE */}
                    <div className="bg-[#1d4ed8] p-5 rounded-[2.5rem] grid grid-cols-2 gap-3 shadow-2xl shadow-blue-600/40 border border-blue-500/40 w-[320px]">
                      {m3Links.map(link => <GridCell key={link.href} {...link} isActive={pathname === link.href} />)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* 3. RIGHT: UTILITY ZONE */}
        <div className="flex items-center gap-6 shrink-0 ml-auto">
          <Link href="/documentation" className="bg-slate-50 border border-slate-200 px-10 h-11 flex items-center justify-center rounded-2xl group hover:border-blue-300 transition-all shadow-sm">
            <span className={`text-[12px] font-black tracking-widest uppercase ${pathname === '/documentation' ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}>DOCS</span>
          </Link>
          
          <div className="bg-white border border-slate-100 px-5 h-11 rounded-2xl shadow-sm flex items-center gap-4">
             <div className="flex flex-col items-end leading-tight">
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">SYNC STATUS</span>
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter">100% ONLINE</span>
             </div>
             <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          </div>
        </div>

      </div>
    </nav>
  );
}