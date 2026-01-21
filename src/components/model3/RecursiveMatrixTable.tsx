"use client";

/**
 * ============================================================================================================================================================
 * MODULE: RECURSIVE INTELLIGENCE MATRIX TABLE (MODEL 3 - ULTIMATE COMPRESSION V87)
 * ============================================================================================================================================================
 * ID:              0xREC_TABLE_MASTER_V87_FIXED_EXPORT
 * PURPOSE:         High-fidelity daily rendering with Zero-Empty-Space cell architecture.
 * FIX:             Restored and hardened handleExportCSV engine for full data extraction.
 * FIX:             Attached onClick handler to the Export button.
 * ============================================================================================================================================================
 */

import React, { useState, useMemo, useEffect } from 'react';
import { FACTOR_METADATA } from '../../lib/model-3/agents/FactorMetadataNewModel';

const DROPPED_FACTORS = ['move_index', 'cb_reserves', 'china_holdings', 'copper', 'silver_spot', 'brics_gdp'];

/**
 * COMPONENT: HeaderCell
 * Documents the 1968-2026 daily recursive logic for each factor via interactive portal.
 * ZERO-BUFFER: Width locked to character length.
 */
const HeaderCell = ({ id, label, colorClass }: { id: string, label: string, colorClass: string }) => {
  const meta = FACTOR_METADATA[id];
  const [showPortal, setShowPortal] = useState(false);
  
  if (!meta || DROPPED_FACTORS.includes(id)) return null;

  return (
    <th 
      className="px-1 py-3 text-[8px] font-black uppercase tracking-tight border-b border-slate-100 relative group text-center min-w-fit w-px whitespace-nowrap cursor-help z-[60] bg-white transition-colors hover:bg-slate-50"
      onMouseEnter={() => setShowPortal(true)} 
      onMouseLeave={() => setShowPortal(false)}
    >
      <a 
        href={meta.sourceUrl} 
        target="_blank" 
        rel="noreferrer" 
        className={`${colorClass} hover:scale-105 transition-all duration-300 inline-block underline decoration-dotted decoration-current/20 underline-offset-[4px] select-none text-center hover:text-blue-500`}
      >
        {label}
      </a>

      {showPortal && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[200px] p-4 bg-slate-900/98 text-white backdrop-blur-3xl border border-slate-700 rounded-xl shadow-2xl z-[999999] text-left pointer-events-none animate-in fade-in slide-in-from-top-2 normal-case tracking-normal">
          <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
            <span className="text-white font-black text-[10px] uppercase tracking-tighter leading-none">{meta.label}</span>
            <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${colorClass.split(' ')[0].replace('text', 'bg')}`}></div>
          </div>
          <p className="text-[9px] text-slate-300 italic leading-tight">"{meta.description}"</p>
        </div>
      )}
    </th>
  );
};

export default function RecursiveMatrixTable({ data }: { data: any[] }) {
  const [mounted, setMounted] = useState(false);
  const [sortAsc, setSortAsc] = useState(false);
  const [pageSize, setPageSize] = useState(100);

  useEffect(() => { setMounted(true); }, []);

  const groupConfig = [
    { cat: 'Macro', color: 'text-blue-600', bg: 'bg-blue-50/40' },
    { cat: 'Currency', color: 'text-emerald-600', bg: 'bg-emerald-50/40' },
    { cat: 'Risk', color: 'text-rose-600', bg: 'bg-rose-50/40' },
    { cat: 'Commodity', color: 'text-orange-600', bg: 'bg-orange-50/40' },
    { cat: 'Econ', color: 'text-cyan-600', bg: 'bg-cyan-50/40' }
  ];

  const factorGroups = useMemo(() => {
    const groups: Record<string, string[]> = { 'Macro': [], 'Currency': [], 'Risk': [], 'Commodity': [], 'Econ': [] };
    Object.keys(FACTOR_METADATA).forEach(key => {
      if (DROPPED_FACTORS.includes(key)) return;
      const cat = FACTOR_METADATA[key].category;
      if (cat !== 'Target' && groups[cat]) groups[cat].push(key);
    });
    return groups;
  }, []);

  const sortedFullData = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => sortAsc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
  }, [data, sortAsc]);

  const visibleData = useMemo(() => {
    return sortedFullData.slice(0, pageSize);
  }, [sortedFullData, pageSize]);

  /**
   * EXPORT LOGIC: Fixed & Synchronized
   * Extracts the full dataset for Python Neural Training.
   */
  const handleExportCSV = () => {
    if (!data || data.length === 0) return;
    
    const allFactorKeys = Object.values(factorGroups).flat();
    const headers = ['date', 'gold_price', ...allFactorKeys];

    const csvRows = sortedFullData.map(row => {
      const values = headers.map(header => {
        if (header === 'date') return row.date;
        if (header === 'gold_price') return row.gold;
        // Access nested factor values
        const val = row.factors?.[header];
        return val !== null && val !== undefined ? val : '';
      });
      return values.join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Gold_Matrix_M3_Daily_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!mounted) return null;

  return (
    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col h-full max-h-[85vh]">
      
      {/* COMPACT ACTION HUB */}
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white/95 backdrop-blur-xl sticky top-0 z-[110]">
        <div className="flex flex-col">
          <h2 className="text-[14px] font-black uppercase tracking-[0.2em] text-slate-800 italic leading-none">Intelligence Ledger</h2>
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
              Synchronized Nodes: {data.length}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
           <button onClick={() => setSortAsc(!sortAsc)} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-[8px] font-black uppercase tracking-widest hover:bg-white transition-all">
             {sortAsc ? "Oldest ↑" : "Newest ↓"}
           </button>
           <button 
             onClick={handleExportCSV}
             className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all active:scale-95"
           >
             Export CSV
           </button>
        </div>
      </div>

      {/* MATRIX SURFACE - ZERO EMPTY SPACE */}
      <div className="overflow-auto institutional-scroll relative z-10 flex-grow bg-white">
        <table className="w-full border-collapse table-auto">
          <thead className="sticky top-0 z-[100] bg-white shadow-sm">
            <tr className="border-b border-slate-100 text-[7px] font-black uppercase tracking-tight">
              <th className="px-1 py-1.5 sticky left-0 z-[101] bg-slate-50 border-r border-slate-100 text-center w-px whitespace-nowrap">Daily Index</th>
              <th className="px-1 py-1.5 bg-amber-50/40 text-amber-600 border-r border-slate-100 text-center w-px whitespace-nowrap">Target Variable</th>
              {groupConfig.map(group => (
                factorGroups[group.cat].length > 0 && (
                <th key={group.cat} colSpan={factorGroups[group.cat].length} className={`px-0.5 py-1.5 border-l border-slate-100 ${group.bg} ${group.color} text-center`}>
                  {group.cat}
                </th>
                )
              ))}
            </tr>
            <tr className="bg-white/95">
              <th className="px-2 py-2 text-[9px] font-black uppercase sticky left-0 z-[101] bg-white border-r border-slate-200 text-slate-500 text-center w-px whitespace-nowrap tracking-tighter">Date (Daily)</th>
              <HeaderCell id="gold_spot" label="Price" colorClass="text-slate-900" />
              {groupConfig.map(group => (
                factorGroups[group.cat].map(key => (
                  <HeaderCell key={key} id={key} label={FACTOR_METADATA[key].label} colorClass={group.color} />
                ))
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-50">
            {visibleData.map((row) => (
              <tr key={row.date} className="hover:bg-blue-50/20 transition-colors group">
                <td className="px-2 py-1.5 text-[10px] font-bold text-slate-400 sticky left-0 z-30 bg-white border-r border-slate-100 font-mono text-center w-px whitespace-nowrap group-hover:bg-blue-50/50">{row.date}</td>
                <td className="px-1 py-1.5 text-[11px] font-black text-slate-950 tabular-nums text-center border-r border-slate-100 bg-amber-50/5 w-px whitespace-nowrap">$ {row.gold.toLocaleString(undefined, { minimumFractionDigits: 1 })}</td>
                
                {groupConfig.map(group => (
                  factorGroups[group.cat].map(key => {
                    const val = row.factors?.[key];
                    return (
                      <td key={key} className={`px-0.5 py-1.5 text-[11px] font-bold tabular-nums border-l border-slate-50/50 font-mono text-center ${group.color} bg-opacity-5 w-px whitespace-nowrap`}>
                        {val !== null && val !== undefined ? val.toFixed(2) : "---"}
                      </td>
                    );
                  })
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        
        {pageSize < sortedFullData.length && (
          <div className="p-4 flex justify-center bg-slate-50/30">
            <button 
              onClick={() => setPageSize(prev => prev + 500)}
              className="px-8 py-3 rounded-full bg-white border border-slate-200 text-[9px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95"
            >
              Sync Next 500 Daily Nodes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}