"use client";

/**
 * MODULE: GOLD PRICE TICKER HUD (V86.0 - INLINE RESET)
 * FIX: Removed 'fixed' positioning to allow container integration.
 */

interface GoldHUDProps {
  livePrice: number;
}

export default function GoldPriceHUD({ livePrice }: GoldHUDProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="relative w-full max-w-[580px] animate-in fade-in zoom-in duration-1000">
      <div className="bg-white/80 backdrop-blur-3xl border border-white rounded-[3.5rem] p-10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] flex flex-col items-center gap-3 border-b-amber-500/20">
        
        <div className="flex items-center gap-5">
           <div className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.7)]"></div>
           <span className="text-[11px] font-black uppercase tracking-[0.8em] text-slate-400">Live Benchmark</span>
        </div>

        <div className="flex items-baseline gap-5">
           <span className="text-[68px] font-black text-slate-900 tracking-tighter leading-none">
             {formatCurrency(livePrice)}
           </span>
           <span className="text-[16px] font-black text-slate-400 tracking-widest uppercase">USD / OZ</span>
        </div>

        <div className="pt-6 border-t border-slate-50 w-full mt-4 flex justify-center items-center gap-16">
           <div className="flex items-center gap-3">
             <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">Change (24H)</span>
             <span className="text-[14px] font-black text-emerald-600 tracking-tight leading-none">+2.41%</span>
           </div>
           <div className="flex items-center gap-3">
             <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">Volatility</span>
             <span className="text-[14px] font-black text-rose-600 tracking-tight leading-none">Low Beta</span>
           </div>
        </div>
      </div>
    </div>
  );
}