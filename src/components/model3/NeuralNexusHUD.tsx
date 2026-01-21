"use client";

import React from 'react';
import { BrainAnalytics } from '../../lib/data/model-3/maxHistoryEngine';
import { Target, Zap, ShieldCheck, Sigma } from 'lucide-react';

export default function NeuralNexusHUD({ analytics }: { analytics: BrainAnalytics | null }) {
  if (!analytics) return null;

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl animate-in fade-in slide-in-from-left duration-1000">
      <div className="flex items-center justify-between border-b border-white/5 pb-6">
         <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Master Regression Equation</span>
            <div className="flex items-center gap-3 text-white font-mono text-[14px] bg-slate-900/50 px-4 py-2 rounded-xl border border-white/5 italic">
               <Sigma size={14} className="text-amber-400" />
               {analytics.formula}
            </div>
         </div>
         <div className="flex items-end flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Convergence Status</span>
            <span className="text-emerald-400 text-[24px] font-black leading-none">100%</span>
         </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
         <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-400 text-[9px] font-black uppercase tracking-widest">
               <Target size={12} className="text-rose-500" />
               <span>MAPE Index</span>
            </div>
            <span className="text-white text-[28px] font-black tabular-nums">{(analytics.metrics.mape * 100).toFixed(2)}%</span>
         </div>

         <div className="flex flex-col gap-2 border-x border-white/5 px-8">
            <div className="flex items-center gap-2 text-slate-400 text-[9px] font-black uppercase tracking-widest">
               <Zap size={12} className="text-amber-400" />
               <span>RMSE Factor</span>
            </div>
            <span className="text-white text-[28px] font-black tabular-nums">${analytics.metrics.rmse.toFixed(1)}</span>
         </div>

         <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-400 text-[9px] font-black uppercase tracking-widest">
               <ShieldCheck size={12} className="text-blue-500" />
               <span>Model Health</span>
            </div>
            <span className="text-blue-400 text-[28px] font-black">Institutional</span>
         </div>
      </div>
    </div>
  );
}