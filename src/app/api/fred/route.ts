import { NextResponse } from 'next/server';
import { getFredSeriesNew } from '@/lib/model-3/agents/fredAgent';

/**
 * ============================================================================================================================================================
 * MODULE: FRED INDIVIDUAL FACTOR API
 * ============================================================================================================================================================
 * ID:              0xAPI_FRED_V12_SYNC
 * PURPOSE:         Provides high-fidelity single-factor daily streams for granular debugging.
 * ARCHITECTURE:    Direct bridge to the locked Fred Agent with JSON-Object transformation.
 * ============================================================================================================================================================
 */

/**
 * GET: /api/fred?factor=[FACTOR_ID]
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const factor = searchParams.get('factor');

  if (!factor) {
    return NextResponse.json({ 
      error: 'Factor ID required. Use keys like real_yield, vix_index, etc.' 
    }, { status: 400 });
  }

  try {
    console.log(`[API FRED]: Individual request for factor [${factor}]`);
    
    const seriesMap = await getFredSeriesNew(factor);
    
    // Transform Map entries into a neural-friendly flat object array
    const result = Array.from(seriesMap.entries()).map(([date, value]) => ({ 
      date, 
      value 
    }));

    return NextResponse.json({
      status: 'SUCCESS',
      factor,
      nodes: result.length,
      series: result, // Consistent key for single-stream consumers
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error(`[API FRED ERROR]: Stream failed for ${factor} ->`, error);
    return NextResponse.json({ 
      status: 'FAILED',
      error: `Failed to fetch daily series for ${factor}. Verify ID against Metadata Registry.` 
    }, { status: 500 });
  }
}