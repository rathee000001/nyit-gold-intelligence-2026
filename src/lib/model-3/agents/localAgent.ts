'use server';

/**
 * ============================================================================================================================================================
 * MODULE: LOCAL AGENT (MODEL 3 - DAILY MACRO & POSITIONING)
 * ============================================================================================================================================================
 * ID:              0xLOCAL_MASTER_V42_DAILY_SYNC
 * PURPOSE:         Processes GLD (Daily), EPU (Monthly->Daily), and GPR (Monthly->Daily).
 * ARCHITECTURE:    Step-function expansion for monthly indices and recursive fill for ETF data.
 * BASELINE:        1968-01-01 Daily Resolution for Neural Training.
 * FIX:             Implemented strict precision rounding for GLD Tonnage.
 * ============================================================================================================================================================
 */

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export interface LocalRecord {
  date: string;
  value: number;
}

/**
 * UTILITY: getDailyTimeline
 * Establishes the master temporal backbone from 1968 to Today.
 */
function getDailyTimeline(): string[] {
  const dates: string[] = [];
  const curr = new Date("1968-01-01");
  const today = new Date();
  while (curr <= today) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

/**
 * AGENT 1: Economic Policy Uncertainty (EPU)
 * Implementation: Monthly-to-Daily Step-Function.
 */
export async function getEpuData(): Promise<LocalRecord[]> {
  const filePath = path.join(process.cwd(), 'data', 'Economic Policy Uncertainty (EPU).csv');
  try {
    if (!fs.existsSync(filePath)) throw new Error("EPU CSV Missing");
    
    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
    
    const monthlyMap = new Map<string, number>();
    parsed.data.forEach((r: any) => {
      const year = r.Year;
      const month = r.Month?.toString().padStart(2, '0');
      const val = parseFloat(r['News_Based_Policy_Uncert_Index'] || r['Value']);
      if (!isNaN(val) && year && month) monthlyMap.set(`${year}-${month}`, val);
    });

    return getDailyTimeline().map(date => {
      const monthKey = date.substring(0, 7); 
      return { date, value: monthlyMap.get(monthKey) || 0 };
    }).filter(r => r.value > 0);

  } catch (error) {
    console.error("[LOCAL AGENT] EPU Sync Failure:", error);
    return [];
  }
}

/**
 * AGENT 2: Geopolitical Risk (GPR)
 * Implementation: Monthly-to-Daily Step-Function expansion.
 */
export async function getGprData(): Promise<LocalRecord[]> {
  const filePath = path.join(process.cwd(), 'data', 'Geopolitical Risk (GPR).csv');
  try {
    if (!fs.existsSync(filePath)) throw new Error("GPR CSV Missing");

    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
    
    const monthlyMap = new Map<string, number>();
    parsed.data.forEach((r: any) => {
      const d = new Date(r.month || r.Date);
      if (!isNaN(d.getTime())) {
        const monthKey = d.toISOString().substring(0, 7);
        const val = parseFloat(r.GPR || r.value);
        if (!isNaN(val)) monthlyMap.set(monthKey, val);
      }
    });

    return getDailyTimeline().map(date => {
      const monthKey = date.substring(0, 7);
      return { date, value: monthlyMap.get(monthKey) || 0 };
    }).filter(r => r.value > 0);

  } catch (error) {
    console.error("[LOCAL AGENT] GPR Sync Failure:", error);
    return [];
  }
}

/**
 * AGENT 3: Gold ETF Positioning (GLD)
 * Target: Column A (Date) and Column J (Tonnage).
 */
export async function getGldData(): Promise<LocalRecord[]> {
  const filePath = path.join(process.cwd(), 'data', 'Gold ETF Holdings (GLD).csv');
  try {
    if (!fs.existsSync(filePath)) throw new Error("GLD CSV Missing");

    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = Papa.parse(csvContent, { header: false, skipEmptyLines: true });
    
    const rawMap = new Map<string, number>();
    parsed.data.forEach((row: any) => {
      const dateObj = new Date(row[0]);
      if (!isNaN(dateObj.getTime())) {
        const dateKey = dateObj.toISOString().split('T')[0];
        const tonnage = parseFloat(row[9]); 
        if (!isNaN(tonnage)) rawMap.set(dateKey, tonnage);
      }
    });

    const timeline = getDailyTimeline();
    const finalResults: LocalRecord[] = [];
    let lastKnownTonnage = 0;

    timeline.forEach(date => {
      const currentTonnage = rawMap.get(date);
      if (currentTonnage !== undefined && currentTonnage !== null) {
        lastKnownTonnage = currentTonnage;
      }
      
      if (lastKnownTonnage > 0) {
        finalResults.push({ 
          date, 
          value: parseFloat(lastKnownTonnage.toFixed(3)) 
        });
      }
    });

    return finalResults;
  } catch (error) {
    console.error("[LOCAL AGENT] GLD ETF Sync Failure:", error);
    return [];
  }
}