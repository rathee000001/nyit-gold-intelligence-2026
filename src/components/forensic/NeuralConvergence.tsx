"use client";

import React from 'react';
import { motion } from 'framer-motion';

/**
 * ======================================================================================
 * COMPONENT: NEURAL LOGIC SYNTHESIS (v3.2 - SYMBOLIC ANIMATION)
 * ======================================================================================
 * Concept: Immersive orbital reconstruction of the triple-lobe architecture.
 * Colors mapped to visual assets: Alpha (Blue), Beta (Green), Gamma (Yellow).
 * ======================================================================================
 */

export default function NeuralConvergence() {
  return (
    <section className="mt-40 grid lg:grid-cols-2 gap-20 items-center px-6 lg:px-24">
      
      {/* 1. THE SYMBOLIC VOID ANIMATION */}
      <div className="relative h-[550px] flex items-center justify-center bg-slate-950 rounded-[4rem] overflow-hidden border border-slate-800 shadow-2xl group">
        
        {/* Deep Perspective Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent opacity-60" />
        
        {/* Orbital Rings */}
        <div className="absolute w-[400px] h-[400px] border border-slate-800/50 rounded-full" />
        <div className="absolute w-[300px] h-[300px] border border-slate-800 rounded-full" />

        {/* Lobe Nodes (Alpha, Beta, Gamma Particles) */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute w-[400px] h-[400px]"
        >
          {/* Alpha Node (Indigo) */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-blue-500 rounded-full shadow-[0_0_20px_#3b82f6]" />
          
          {/* Beta Node (Emerald) */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-emerald-500 rounded-full shadow-[0_0_20px_#10b981]" />
        </motion.div>

        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute w-[300px] h-[300px]"
        >
          {/* Gamma Node (Amber) */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-amber-500 rounded-full shadow-[0_0_20px_#f59e0b]" />
        </motion.div>

        {/* THE CENTRAL FORMULA */}
        <div className="relative z-10 text-center scale-125 md:scale-150">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 font-black italic tracking-tighter"
          >
            <span className="text-slate-200 opacity-20 text-4xl mr-1">(</span>
            <span className="text-blue-500 text-5xl">α</span>
            <span className="text-slate-200 opacity-20 text-3xl mx-1">+</span>
            <span className="text-emerald-500 text-5xl">β</span>
            <span className="text-slate-200 opacity-20 text-4xl ml-1">)</span>
            <span className="text-slate-200 opacity-20 text-3xl mx-2">×</span>
            <span className="text-amber-500 text-6xl drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">γ</span>
          </motion.div>
          
          <div className="mt-8 flex flex-col items-center">
             <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] block mb-2">Neural Link Status</span>
             <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest border-t border-slate-800 pt-2 px-4">
                Convergence Optimized
             </p>
          </div>
        </div>

        {/* Scanning Beam Overlay */}
        <motion.div 
           animate={{ top: ['0%', '100%', '0%'] }}
           transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
           className="absolute left-0 right-0 h-[1px] bg-indigo-500/20 shadow-[0_0_15px_#6366f1] z-20"
        />
      </div>

      {/* 2. THE DESCRIPTIVE STORY */}
      <div className="max-w-xl">
        <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-6 block border-l-4 border-indigo-600 pl-4">
          The Forensic Engine
        </span>
        <h3 className="text-7xl font-black text-slate-900 italic tracking-tighter uppercase mb-8 leading-[0.9]">
          Neural Logic <br/>Synthesis
        </h3>
        <p className="text-slate-600 text-lg leading-relaxed font-medium">
          Our architecture processes history through three distinct filters. 
          The <strong className="text-blue-600">Structural Lobe ($\alpha$)</strong> identifies monthly macro-baselines, while 
          the <strong className="text-emerald-600">Temporal Lobe ($\beta$)</strong> calculates path-dependency. 
          Finally, the <strong className="text-amber-600">Narrative Lobe ($\gamma$)</strong> injects historical shocks from your 
          ledger to adjust the final prediction shadow.
        </p>
        
        <div className="mt-12 grid grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl text-center">
                <span className="text-blue-600 font-black text-lg block">$\alpha$</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Structural</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl text-center">
                <span className="text-emerald-600 font-black text-lg block">$\beta$</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Temporal</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl text-center">
                <span className="text-amber-600 font-black text-lg block">$\gamma$</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Narrative</span>
            </div>
        </div>
      </div>
    </section>
  );
}