'use server';

/**
 * ============================================================================================================================================================
 * MODULE: FRED AGENT (MODEL 3 - DAILY INTELLIGENCE)
 * ============================================================================================================================================================
 * ID:              0xFRED_MASTER_V72_DAILY_SYNC
 * PURPOSE:         High-fidelity daily macro-streamer with recursive forward-filling.
 * ARCHITECTURE:    Server-Side Data Ingestion Engine with POST support for external triggers.
 * BASELINE:        Jan 1, 1968 Temporal Alignment.
 * FIX:             Hard-locked series mapping to FACTOR_METADATA keys for Zipper integrity.
 * ============================================================================================================================================================
 */

import { FACTOR_METADATA } from './FactorMetadataNewModel';

// AUTHENTICATION & ENDPOINTS
const API_KEY = "4ba905b10d77f720ef5ff15229f223c0";
const BASE_URL = "https://api.stlouisfed.org/fred/series/observations";

/**
 * INSTITUTIONAL SERIES MAPPING
 * Maps internal project keys to official FRED Series IDs.
 * Strictly aligned with FactorMetadataNewModel keys.
 */
const FRED_SERIES_MAP: Record<string, string> = {
  real_yield: 'DFII10',      
  nominal_yield: 'DGS10',    
  tips_curve: 'T10Y2Y',      
  fed_bs: 'WALCL',           
  m2_supply: 'M2SL',         
  inflation: 'T10YIE',       
  usd_index: 'DTWEXBGS',     
  eur_usd: 'DEXUSEU',        
  jpy_usd: 'DEXJPUS',        
  vix_index: 'VIXCLS',       
  high_yield: 'BAMLH0A0HYM2',
  fin_stress: 'STLFSI4',     
  oil_wti: 'DCOILWTICO',     
  ppi_index: 'PPIACO',       
  unrate: 'UNRATE',          
  ind_prod: 'INDPRO',        
  cap_util: 'TCU'            
};

/**
 * UTILITY: formatDate
 * Standardizes ISO strings to YYYY-MM-DD keys.
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * LOGIC: fillDailyGaps
 * Recursive Forward-Fill mechanism ensuring 100% daily node density.
 * Bridges weekends, bank holidays, and sparse monthly data into a daily continuum.
 */
function fillDailyGaps(rawMap: Map<string, number>, startYear: number): Map<string, number> {
  const filledMap = new Map<string, number>();
  const currentDate = new Date(`${startYear}-01-01`);
  const today = new Date();
  let lastKnownVal: number | null = null;

  while (currentDate <= today) {
    const dateKey = formatDate(currentDate);
    const rawVal = rawMap.get(dateKey);

    if (rawVal !== undefined && rawVal !== null && !isNaN(rawVal)) {
      lastKnownVal = rawVal;
      filledMap.set(dateKey, rawVal);
    } else if (lastKnownVal !== null) {
      // BRIDGE: Carry previous known value forward to maintain node integrity
      filledMap.set(dateKey, lastKnownVal);
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }
  return filledMap;
}

/**
 * EXPORT: getFredSeriesNew
 * High-performance ingestion function utilized by the Master Orchestrator.
 */
export async function getFredSeriesNew(factorId: string): Promise<Map<string, number>> {
  const metadata = FACTOR_METADATA[factorId];
  if (!metadata) {
    console.error(`[FRED AGENT]: Unknown Factor Key [${factorId}] requested.`);
    return new Map();
  }

  const officialId = FRED_SERIES_MAP[factorId] || metadata.id;
  const startYear = metadata.inceptionYear || 1968;
  const observationStart = `${startYear}-01-01`;

  const url = `${BASE_URL}?series_id=${officialId}&api_key=${API_KEY}&file_type=json&observation_start=${observationStart}`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`FRED API Error: ${res.status} for ${officialId}`);

    const data = await res.json();
    if (!data.observations) return new Map();

    const rawMap = new Map<string, number>();
    data.observations.forEach((obs: any) => {
      const val = parseFloat(obs.value);
      if (!isNaN(val)) rawMap.set(obs.date, val);
    });

    // TRANSFORM: Dense matrix reconstruction
    const denseMap = fillDailyGaps(rawMap, startYear);
    console.log(`[FRED SYNC]: ${factorId} -> Nodes: ${denseMap.size}`);
    return denseMap;

  } catch (e) {
    console.error(`[FRED AGENT FAILURE]: Factor [${factorId}] stream broken ->`, e);
    return new Map();
  }
}

/**
 * EXPORT: processExternalRequest (POST Handler Proxy)
 */
export async function processExternalRequest(payload: any) {
  console.log("[FRED AGENT]: Neural Trigger Received.");
  return { status: "success", timestamp: new Date().toISOString() };
}