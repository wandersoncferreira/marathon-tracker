/**
 * Load initial coach analyses into database
 * This is a utility to pre-populate analyses for development/testing
 */

import { db } from '../services/database';
import analysis_2026_02_16 from '../../data/analyses/2026-02-16-threshold.json';

export async function loadInitialAnalyses() {
  try {
    // Check if this analysis already exists in database
    const existing = await db.getAnalysisByActivityId(analysis_2026_02_16.metadata.activityId);

    if (existing) {
      // Replace existing analysis with updated version
      await db.storeAnalysis(analysis_2026_02_16);
      console.log('🔄 Updated existing coach analysis for 2026-02-16');
    } else {
      // Add the new analysis
      await db.storeAnalysis(analysis_2026_02_16);
      console.log('✅ Successfully loaded coach analysis for 2026-02-16');
    }

    return true;
  } catch (error) {
    console.error('❌ Error loading initial analyses:', error);
    return false;
  }
}
