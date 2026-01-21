"use client";
import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 w-full h-16 bg-slate-50 border-t border-slate-200 px-6 flex items-center justify-between z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.03)] font-sans">
      
      {/* LEFT: TEXT BRANDING (Replaces Image) */}
      <div className="flex items-center shrink-0">
        <div className="bg-white px-3 py-1.5 rounded-md border border-slate-100 shadow-sm flex items-center gap-2">
            <span className="text-xl">🏛️</span>
            <div className="flex flex-col leading-none">
               <span className="text-[9px] font-black text-slate-400 uppercase">New York Institute of Technology</span>
               <span className="text-[11px] font-bold text-slate-900">Forecasting Laboratory</span>
            </div>
        </div>
      </div>

      {/* CENTER: COPYRIGHT */}
      <div className="hidden md:flex items-center text-[11px] font-medium text-slate-600 uppercase tracking-wider mx-auto">
        <span>© 2025 Gold Forecasting Model</span>
        <span className="mx-2 text-slate-300">•</span>
        <span>NYIT</span>
      </div>

      {/* RIGHT: CONTACT */}
      <div className="flex items-center gap-6 shrink-0">
        <div className="flex flex-col items-end text-[10px] font-medium text-slate-500 leading-tight">
            <div className="flex items-center gap-1">
                <span>Contact:</span>
                <a href="mailto:rathee00001@gmail.com" className="hover:text-blue-600 transition-colors">rathee00001@gmail.com</a>
            </div>
            <div>
                <a href="tel:+17814280653" className="hover:text-blue-600 transition-colors">+1 781-428-0653</a>
            </div>
        </div>
      </div>
    </footer>
  );
}