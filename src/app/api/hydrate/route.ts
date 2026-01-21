import { NextResponse } from 'next/server';
import { fetchMaxHistorySeries, updateBrainStore } from '@/lib/data/model-3/maxHistoryEngine';

/**
 * ============================================================================================================================================================
 * MODULE: MODEL 3 HYDRATION & NEURAL BRIDGE API
 * ============================================================================================================================================================
 * ID:              0xAPI_HYDRATE_V11_SYNC
 * PURPOSE:         GET: Streams the 21,144 node daily matrix to UI/Python.
 * POST: Receives model weights/forecasts from Python Brain.
 * FIX:             Standardized response key to 'matrix' to match Engine & UI expectations.
 * ============================================================================================================================================================
 */

/**
 * GET: DATA PULL
 * Provides the full synchronized daily matrix (1968-2026).
 */
export async function GET() {
  try {
    const data = await fetchMaxHistorySeries();
    
    return NextResponse.json({
      status: 'SUCCESS',
      resolution: 'DAILY',
      nodes: data.matrix.length,
      matrix: data.matrix, // FIX: Key synchronized with UI destructuring
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[API HYDRATE GET ERROR]:", error);
    return NextResponse.json({ 
      status: 'FAILED', 
      error: 'Daily synchronization pipeline failed' 
    }, { status: 500 });
  }
}

/**
 * POST: NEURAL PUSH
 * Receives computed brain files from Python and saves to /data/brain/ via Engine.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { filename, data } = body;

    if (!filename || !data) {
      return NextResponse.json({ error: "Invalid payload: filename and data required" }, { status: 400 });
    }

    const result = await updateBrainStore(filename, data);

    return NextResponse.json({ 
      status: result.success ? 'SUCCESS' : 'FAILED',
      message: result.success ? 'Neural Brain updated' : result.error
    });
  } catch (error) {
    console.error("[API HYDRATE POST ERROR]:", error);
    return NextResponse.json({ error: 'Failed to process neural update' }, { status: 500 });
  }
}