'use server';

/**
 * ============================================================================================================================================================
 * MODULE: GOLD AGENT (MODEL 3 - DAILY TARGET ENGINE)
 * ============================================================================================================================================================
 * ID:              0xGOLD_MASTER_V35_FINAL_PRECISION_SYNC
 * PURPOSE:         Authoritative Daily Target Variable (Y) Extraction from 1968-2026.
 * ARCHITECTURE:    Dual-stream CSV merger with MM/DD/YYYY parsing and Index-3 (Column D) mapping.
 * FIX:             Corrected column indexing to capture the full "High" price ($4,767.40) instead of truncated values.
 * ============================================================================================================================================================
 */

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export interface GoldRecord {
  date: string;
  price: number;
}

/**
 * CORE AGENT: getGoldData
 * Processes local CSV files to establish the authoritative gapless target timeline.
 */
export async function getGoldData(): Promise<GoldRecord[]> {
  const pathOld = path.join(process.cwd(), 'data', 'LBMA-GOLD-1968-2017.csv');
  const pathNew = path.join(process.cwd(), 'data', 'LBMA-GOLD-2018-2026.csv');
  
  const rawDataMap = new Map<string, number>();

  try {
    // --- PHASE 1: LEGACY DATA INGESTION (1968-2017) ---
    if (fs.existsSync(pathOld)) {
      const contentOld = fs.readFileSync(pathOld, 'utf-8');
      const parsedOld = Papa.parse(contentOld, { header: false, skipEmptyLines: true });
      const rowsOld = parsedOld.data as string[][];

      rowsOld.forEach(row => {
        const dateObj = new Date(row[0]);
        if (!isNaN(dateObj.getTime())) {
          const dateKey = dateObj.toISOString().split('T')[0];
          const price = parseFloat(row[2]); // USD (PM) Column
          if (!isNaN(price) && price > 0) rawDataMap.set(dateKey, price);
        }
      });
      console.log(`[GOLD SYNC]: Legacy Stream Ingested (${rawDataMap.size} nodes)`);
    }

    // --- PHASE 2: MODERN DATA INGESTION (2018-2026) ---
    // Target structure as per image_e496e6.png: Col A (Date), Col D (High)
    if (fs.existsSync(pathNew)) {
      const contentNew = fs.readFileSync(pathNew, 'utf-8');
      
      // Using header: true to safely find column "D" (High) regardless of minor CSV shifts
      const parsedNew = Papa.parse(contentNew, { 
        header: true, 
        skipEmptyLines: true,
        dynamicTyping: true // Automatically converts strings to numbers to avoid truncation
      });
      
      const rowsNew = parsedNew.data as any[];

      rowsNew.forEach(row => {
        // Safe mapping to Column A (Date) and Column D (High)
        const rawDate = row['Date'] || Object.values(row)[0] as string;
        const rawHigh = row['High'] || Object.values(row)[3] as number;

        if (!rawDate) return;

        // Robust MM/DD/YYYY parsing
        const parts = rawDate.toString().split('/');
        let dateObj: Date;
        if (parts.length === 3) {
            dateObj = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
        } else {
            dateObj = new Date(rawDate);
        }
        
        if (!isNaN(dateObj.getTime())) {
          const dateKey = dateObj.toISOString().split('T')[0];
          // Ensure we capture the full floating point (e.g., 4769.10)
          const price = typeof rawHigh === 'string' ? parseFloat(rawHigh.replace(/,/g, '')) : rawHigh;
          
          if (!isNaN(price as number) && (price as number) > 0) {
            rawDataMap.set(dateKey, price as number);
          }
        }
      });
      console.log(`[GOLD SYNC]: Modern Stream Integrated with precision fix.`);
    }

    // --- PHASE 3: MASTER TIMELINE RECONSTRUCTION (1968 - TODAY) ---
    const finalResults: GoldRecord[] = [];
    const startDate = new Date("1968-01-02");
    const endDate = new Date(); // Dynamic end to include Jan 20, 2026
    
    let lastKnownPrice: number | null = null;
    let curr = new Date(startDate);

    while (curr <= endDate) {
      const dateKey = curr.toISOString().split('T')[0];
      const dailyPrice = rawDataMap.get(dateKey);

      if (dailyPrice !== undefined && dailyPrice !== null) {
        lastKnownPrice = dailyPrice;
      }

      if (lastKnownPrice !== null) {
        finalResults.push({
          date: dateKey,
          price: parseFloat(lastKnownPrice.toFixed(2)) // Two-decimal institutional standard
        });
      }

      curr.setDate(curr.getDate() + 1);
    }

    // Sort to ensure Newest → Oldest display compliance
    finalResults.reverse();

    console.log(`[GOLD SUCCESS]: Gapless Timeline Established up to ${finalResults[0]?.date} ($${finalResults[0]?.price})`);
    return finalResults;

  } catch (err) {
    console.error("[GOLD AGENT CRITICAL FAILURE]:", err);
    return [];
  }
}