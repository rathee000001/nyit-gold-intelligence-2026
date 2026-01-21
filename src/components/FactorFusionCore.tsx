/**
 * ======================================================================================
 * COMPONENT: FACTOR FUSION CORE (CLIENT SIDE VISUALIZATION)
 * ======================================================================================
 * Purpose: Renders the spinning "Data Refinery" visualization.
 * Fix: Moved here to allow 'use client' for animations, preventing Server Component crashes.
 * ======================================================================================
 */

"use client";

import React from 'react';

export default function FactorFusionCore() {
  return (
    <div className="relative w-full max-w-4xl mx-auto h-[350px] md:h-[450px] animate-fade-zoom flex items-center justify-center overflow-visible">
      
      {/* 1. CENTRAL ENGINE CORE */}
      <div className="relative z-20 w-48 h-48 md:w-64 md:h-64 flex items-center justify-center">
         <div className="absolute inset-0 rounded-full border-[1px] border-slate-300/30 border-t-blue-500/60 border-b-amber-500/60 animate-[spin_10s_linear_infinite]" />
         <div className="absolute inset-2 rounded-full border-[1px] border-slate-300/20 border-l-blue-400/50 border-r-amber-400/50 animate-[spin_15s_linear_infinite_reverse]" />
         <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-full animate-pulse-slow"></div>

         <svg viewBox="0 0 100 100" className="w-32 h-32 md:w-40 md:h-40 drop-shadow-[0_0_30px_rgba(212,175,55,0.4)] animate-pulse-slow z-30">
            <defs>
               <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FCD34D" />
                  <stop offset="100%" stopColor="#B45309" />
               </linearGradient>
            </defs>
            <path d="M50 5 L93.3 27.5 V72.5 L50 95 L6.7 72.5 V27.5 Z" fill="none" stroke="url(#goldGradient)" strokeWidth="1.5" className="animate-[pulse_3s_infinite]" />
            <path d="M50 5 L50 95 M93.3 27.5 L6.7 72.5 M93.3 72.5 L6.7 27.5" stroke="url(#goldGradient)" strokeWidth="0.5" className="opacity-60" />
            <circle cx="50" cy="50" r="8" fill="url(#goldGradient)" className="animate-pulse" />
         </svg>
      </div>

      {/* 2. LEFT SIDE: RAW DATA INPUTS */}
      <div className="absolute left-0 top-0 bottom-0 w-1/2 z-10 overflow-hidden pointer-events-none">
         <div className="absolute left-0 md:left-10 top-[40%] bg-white/80 backdrop-blur border border-blue-200 px-3 py-1.5 rounded-lg shadow-sm z-30 border-l-4 border-l-blue-500">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Raw Input</div>
            <div className="text-xs font-bold text-blue-700">19 Macro Factors</div>
         </div>
         
         {[...Array(6)].map((_, i) => (
            <div key={`stream-in-${i}`} className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-blue-400 to-blue-600/0"
                 style={{ 
                   top: `${30 + (i * 8)}%`, 
                   opacity: 0.3 + (i * 0.1),
                   animation: `dataStreamIn ${2 + (i * 0.5)}s infinite linear` 
                 }} 
            />
         ))}
         {[...Array(3)].map((_, i) => (
            <div key={`particle-in-${i}`} className="absolute w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"
                 style={{ 
                   top: `${35 + (i * 10)}%`, 
                   left: '-10px',
                   animation: `particleFlowIn ${3 + i}s infinite cubic-bezier(0.4, 0, 0.2, 1)` 
                 }} 
            />
         ))}
      </div>

      {/* 3. RIGHT SIDE: OUTPUTS */}
      <div className="absolute right-0 top-0 bottom-0 w-1/2 z-10 overflow-hidden pointer-events-none">
         <div className="absolute right-0 md:right-10 top-[40%] bg-white/80 backdrop-blur border border-amber-200 px-3 py-1.5 rounded-lg shadow-sm z-30 text-right border-r-4 border-r-amber-500">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Synthesized Output</div>
            <div className="text-xs font-bold text-amber-700">Fair Value Price</div>
         </div>

         {[...Array(4)].map((_, i) => (
            <div key={`stream-out-${i}`} className="absolute w-full h-[1px] bg-gradient-to-r from-amber-500/0 via-amber-400 to-transparent"
                 style={{ 
                   top: `${38 + (i * 6)}%`, 
                   left: '0',
                   opacity: 0.4 + (i * 0.1),
                   animation: `dataStreamOut ${2.5 + (i * 0.2)}s infinite linear` 
                 }} 
            />
         ))}
         
         <div className="absolute left-0 top-1/2 -translate-y-1/2 w-32 h-32 border border-amber-500/20 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
      </div>

      {/* 4. ANIMATION STYLES (Use global tag since this is client component) */}
      <style jsx>{`
        @keyframes dataStreamIn {
          0% { transform: translateX(-100%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(50%); opacity: 0; }
        }
        @keyframes particleFlowIn {
          0% { transform: translateX(0); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(50vw); opacity: 0; }
        }
        @keyframes dataStreamOut {
          0% { transform: translateX(-10%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
      `}</style>
    </div>
  );
}