/**
 * Load initial coach analyses into database
 * This is a utility to pre-populate analyses for development/testing
 */

import { db } from '../services/database';
import analysis_2026_02_16 from '../../data/analyses/2026-02-16-forte-fraco.json';
import analysis_2026_02_17 from '../../data/analyses/2026-02-17-easy.json';

const CURRENT_SCHEMA_VERSION = '2.0'; // Bilingual support

/**
 * Check if an analysis has the old schema (non-bilingual)
 */
function hasOldSchema(analysis) {
  if (!analysis || !analysis.metadata) return false;

  // Check if activityName is a plain string (old) vs object (new)
  const activityName = analysis.metadata.activityName;
  return typeof activityName === 'string';
}

/**
 * Check if we need to migrate the database
 */
async function needsMigration() {
  const allAnalyses = await db.getAllAnalyses();
  if (allAnalyses.length === 0) return false;

  // If any analysis has old schema, we need to migrate
  return allAnalyses.some(hasOldSchema);
}

export async function loadInitialAnalyses() {
  try {
    // Check if migration is needed
    const shouldMigrate = await needsMigration();

    if (shouldMigrate) {
      console.log('🔄 Detected old schema - migrating analyses...');
      // Clear old analyses
      await db.clearAnalyses();
      console.log('✅ Old analyses cleared');
    }

    const analyses = [
      analysis_2026_02_16,
      analysis_2026_02_17
    ];

    let updatedCount = 0;
    let addedCount = 0;

    for (const analysis of analyses) {
      const existing = await db.getAnalysisByActivityId(analysis.metadata.activityId);

      if (existing) {
        // Check if existing has old schema
        if (hasOldSchema(existing)) {
          console.log(`🔄 Migrating ${analysis.metadata.date} to new bilingual schema`);
          await db.storeAnalysis(analysis);
          updatedCount++;
        } else {
          // Just update with latest version
          await db.storeAnalysis(analysis);
          updatedCount++;
          console.log(`🔄 Updated existing coach analysis for ${analysis.metadata.date}`);
        }
      } else {
        // Add the new analysis
        await db.storeAnalysis(analysis);
        addedCount++;
        console.log(`✅ Successfully loaded coach analysis for ${analysis.metadata.date}`);
      }
    }

    console.log(`📊 Loaded ${addedCount} new analyses, updated ${updatedCount} existing analyses`);
    return true;
  } catch (error) {
    console.error('❌ Error loading initial analyses:', error);
    return false;
  }
}
