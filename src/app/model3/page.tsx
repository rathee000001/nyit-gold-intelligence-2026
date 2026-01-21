"use client";

/**
 * ============================================================================================================================================================
 * MODULE: INTELLIGENCE LAB MASTER (MODEL 3 - DE-CONFLICTED ENTRY)
 * ============================================================================================================================================================
 * ID:              0xPAGE_LAB_MODEL3_V5_MASTER_CLEAN
 * PURPOSE:         Cinematic Master Entry Point for the 21,144 Node Daily Matrix.
 * THEME:           Preserved V93.0 "Dark Gold" Immersion via RecursiveClientView.
 * ARCHITECTURE:    Strict wrapper to prevent circular rendering collisions.
 * FIX:             Implemented DEFAULT IMPORT for RecursiveClientView to resolve browser 500.
 * ============================================================================================================================================================
 */

import React from 'react';

/**
 * ARCHITECTURAL SYNC:
 * We use a DEFAULT IMPORT (no curly braces) to match the 'export default' 
 * defined in RecursiveClientView.tsx. This resolves the element type error.
 */
import RecursiveClientView from '../../components/model3/RecursiveClientView';

/**
 * COMPONENT: Model3Page
 * This is the root page for the Model 3 Daily Engine.
 * All UI logic (HUDs, Matrix Table, Registry) is now fully delegated to 
 * RecursiveClientView to satisfy Turbopack's rendering constraints.
 */
export default function Model3Page() {
  return (
    <main className="min-h-screen bg-slate-950 antialiased selection:bg-blue-500/30">
      {/* ORCHESTRATION LAYER:
          RecursiveClientView initiates the hydration of the 1968-2026 daily 
          ledger and renders the synchronized 21-factor interface.
      */}
      <RecursiveClientView />
    </main>
  );
}