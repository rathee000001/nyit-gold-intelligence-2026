'use server';

/**
 * ============================================================================================================================================================
 * MODULE: MASTER INTELLIGENCE ORCHESTRATOR (MODEL 3 - DAILY MATRIX ENGINE)
 * ============================================================================================================================================================
 * ID:              0xENGINE_MASTER_V86_MULTI_LOBE_SYNC
 * PURPOSE:         Centralized Daily Synchronization & Neural Brain Bridge.
 * UPGRADE:         Multi-Lobe JSON Integration (Structural, Temporal, Narrative).
 * ARCHITECTURE:    Server Action orchestrating parallel agent streams + Lobe-specific hydration.
 * ============================================================================================================================================================
 */

import { FACTOR_METADATA } from '../../model-3/agents/FactorMetadataNewModel'; 
import { getFredSeriesNew } from '../../model-3/agents/fredAgent';
import { getGoldData, GoldRecord } from '../../model-3/agents/goldAgent';
import { getEpuData, getGprData, getGldData, LocalRecord } from '../../model-3/agents/localAgent';
import fs from 'fs';
import path from 'path';

export interface MatrixData {
  date: string;
  gold: number;
  factors: Record<string, number | null>;
}

export interface BrainAnalytics {
  metrics: {
    mape: number;
    rmse: number;
    mad: number;
    accuracy_score: number;
  };
  coefficients: Record<string, number>;
  formula: string;
  temporal: {
    momentum_score: number;
    trend_direction: string;
    denoised_path: number[];
  };
  narrative: {
    sentiment_score: number;
    primary_driver: string;
    managerial_insight: string;
    chatbot_context: string;
  };
  last_trained: string;
}

/**
 * CORE ACTION: fetchMaxHistorySeries
 * Orchestrates parallel hydration of all Model 3 daily streams into a unified matrix.
 */
export async function fetchMaxHistorySeries(): Promise<{ 
  matrix: MatrixData[], 
  analytics: BrainAnalytics | null 
}> {
  const allFactorKeys = Object.keys(FACTOR_METADATA);
  const dataStore: Record<string, Map<string, number>> = {};
  
  const droppedFactors = ['move_index', 'cb_reserves', 'china_holdings', 'copper', 'silver_spot', 'brics_gdp'];

  console.log(`[ENGINE M3]: Initiating Daily Zipper for 1968-2026 timeline...`);

  // PHASE 1: PARALLEL AGENT HYDRATION
  await Promise.all(allFactorKeys.map(async (key) => {
    if (droppedFactors.includes(key)) return;

    try {
      if (key === 'gold_spot') {
        const goldResults: GoldRecord[] = await getGoldData();
        dataStore[key] = new Map(goldResults.map((r: GoldRecord) => [r.date, r.price]));
      } else if (key === 'policy_unc') {
        const epuResults: LocalRecord[] = await getEpuData();
        dataStore[key] = new Map(epuResults.map((r: LocalRecord) => [r.date, r.value]));
      } else if (key === 'gpr_index') {
        const gprResults: LocalRecord[] = await getGprData();
        dataStore[key] = new Map(gprResults.map((r: LocalRecord) => [r.date, r.value]));
      } else if (key === 'gld_tonnes') {
        const gldResults: LocalRecord[] = await getGldData();
        dataStore[key] = new Map(gldResults.map((r: LocalRecord) => [r.date, r.value]));
      } else {
        dataStore[key] = await getFredSeriesNew(key);
      }
    } catch (err) {
      console.error(`[ENGINE M3 ERROR]: Factor pipeline failure for [${key}]:`, err);
      dataStore[key] = new Map();
    }
  }));

  // PHASE 2: TEMPORAL ZIPPER LOGIC
  const goldMap = dataStore['gold_spot'] || new Map();
  const sortedDates = Array.from(goldMap.keys()).sort((a, b) => b.localeCompare(a));

  const matrix: MatrixData[] = sortedDates.map(date => {
    const factors: Record<string, number | null> = {};
    
    allFactorKeys.forEach(k => {
      if (k !== 'gold_spot' && !droppedFactors.includes(k)) {
        factors[k] = dataStore[k]?.get(date) ?? null;
      }
    });
    
    return { 
      date, 
      gold: goldMap.get(date)!, 
      factors 
    };
  });

  // PHASE 3: MULTI-LOBE ANALYTICS HYDRATION
  const analytics = await getBrainAnalytics();

  console.log(`[ENGINE M3]: Daily Sync Finalized. Matrix Depth: ${matrix.length}`);
  return { matrix, analytics };
}

/**
 * UTILITY: getBrainAnalytics
 * Merges outputs from the three distinct Python lobes (Structural, Temporal, Narrative).
 */
export async function getBrainAnalytics(): Promise<BrainAnalytics | null> {
  try {
    const brainDir = path.join(process.cwd(), 'data', 'brain');
    const structuralPath = path.join(brainDir, 'structural_lobe.json');
    const temporalPath = path.join(brainDir, 'temporal_lobe.json');
    const narrativePath = path.join(brainDir, 'narrative_lobe.json');

    if (!fs.existsSync(structuralPath)) return null;

    // Load Lobes
    const structural = JSON.parse(fs.readFileSync(structuralPath, 'utf-8'));
    const temporal = fs.existsSync(temporalPath) ? JSON.parse(fs.readFileSync(temporalPath, 'utf-8')) : {};
    const narrative = fs.existsSync(narrativePath) ? JSON.parse(fs.readFileSync(narrativePath, 'utf-8')) : {};

    // Dynamic Formula Construction
    const topCoeffs = Object.entries(structural.coefficients || {})
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3);
    const formulaStr = `Gold Price ≈ ${topCoeffs.map(([k, v]) => `(${v} * ${k})`).join(' + ')} + ε`;

    return {
      metrics: structural.metrics || { mape: 0, rmse: 0, mad: 0, accuracy_score: 0 },
      coefficients: structural.coefficients || {},
      formula: formulaStr,
      temporal: {
        momentum_score: temporal.momentum_score || 0,
        trend_direction: temporal.trend_direction || "Stable",
        denoised_path: temporal.wavelet_denoised_path || []
      },
      narrative: {
        sentiment_score: narrative.sentiment_score || 0,
        primary_driver: narrative.primary_driver || "Fundamental Alignment",
        managerial_insight: narrative.managerial_insight || "Awaiting Lobe Integration",
        chatbot_context: narrative.chatbot_context || "No context available"
      },
      last_trained: structural.last_updated || new Date().toISOString()
    };
  } catch (error) {
    console.error("[ENGINE M3 ANALYTICS FAILURE]:", error);
    return null;
  }
}

/**
 * NEURAL BRIDGE: updateBrainStore (Kaggle Sync Support)
 * Now handles lobe-specific file writes.
 */
export async function updateBrainStore(filename: string, data: any) {
  console.log(`[ENGINE M3]: Receiving Lobe update for ${filename}...`);
  
  try {
    const brainPath = path.join(process.cwd(), 'data', 'brain');
    if (!fs.existsSync(brainPath)) {
      fs.mkdirSync(brainPath, { recursive: true });
    }

    const targetFile = path.join(brainPath, `${filename}.json`);
    fs.writeFileSync(targetFile, JSON.stringify(data, null, 2), 'utf-8');

    return { success: true, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error(`[ENGINE M3 BRAIN FAILURE]:`, error);
    return { success: false, error: "Filesystem write failed" };
  }
}