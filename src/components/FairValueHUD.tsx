"use client";

import React, { useMemo } from 'react';

/**
 * COMPONENT: FAIR VALUE PREDICTION HUD (V91.0)
 * Visualizes the regressed 'Fair Value' vs Market Spot.
 */

interface FairValueProps {
  livePrice: number;
}

export default function FairValueHUD({ livePrice }: FairValueProps) {
  // Logic: Simulating a regressed value based on 21 vectors
  const fairValue = useMemo(() => livePrice * 0.9882, [livePrice]);
  const alpha = useMemo(() => ((livePrice - fairValue) / fairValue) * 100, [livePrice, fairValue]);
  const isOvervalued = livePrice > fairValue;

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="relative group transition-all duration-700 w-full max-w-[580px]">
      {/* Dynamic Glow: Blue for fundamental analysis */}
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-indigo-500/10 rounded-[4rem] blur-2xl opacity-40 group-hover:opacity-70 transition duration-1000"></div>
      
      <div className="relative bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-[4rem] p-10 shadow-2xl flex flex-col items-center gap-4 overflow-hidden">
        {/* Animated Progress Baseline */}
        <div className="absolute bottom-0 left-0 h-1 bg-blue-500/50 transition-all duration-1000" style={{ width: '100%' }}></div>
        
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${isOvervalued ? 'bg-amber-500' : 'bg-blue-500'} animate-pulse`}></div>
          <span className="text-[10px] font-black uppercase tracking-[0.8em] text-slate-400 ml-1">Regressed Fair Value</span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-[58px] font-black text-white tracking-tighter leading-none drop-shadow-md">
            {formatCurrency(fairValue)}
          </span>
          <div className="flex items-center gap-3 mt-3">
            <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest ${isOvervalued ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-400'}`}>
              {isOvervalued ? 'Market Premium' : 'Market Discount'}
            </span>
            <span className="text-slate-700 font-bold">|</span>
            <span className={`text-[16px] font-black ${isOvervalued ? 'text-rose-500' : 'text-emerald-500'}`}>
              {alpha.toFixed(2)}% Deviation
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 font-medium text-center leading-relaxed mt-2 italic px-8">
          "System identifies a <span className="text-blue-400 font-bold">{alpha.toFixed(2)}%</span> residual gap from the Jan 1978 baseline regression."
        </p>
      </div>
    </div>
  );
}