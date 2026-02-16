/**
 * Utility to fetch all missing activity details from Intervals.icu
 * Run this to populate activityDetails for all activities
 */

import { db } from '../services/database';
import { intervalsApi } from '../services/intervalsApi';

export async function syncAllActivityDetails(onProgress = null) {
  try {
    console.log('🔄 Starting activity details sync...');

    // Get all activities (excluding STRAVA stubs)
    const allActivities = await db.activities.toArray();
    const nonStravaActivities = allActivities.filter(a => a.source !== 'STRAVA');
    console.log(`📊 Found ${allActivities.length} activities (${nonStravaActivities.length} non-STRAVA)`);

    // Get existing details
    const existingDetails = await db.activityDetails.toArray();
    const existingIds = new Set(existingDetails.map(d => d.id));
    console.log(`📊 Found ${existingDetails.length} existing details`);

    // Find activities missing details (excluding STRAVA)
    const missingDetails = nonStravaActivities.filter(a => !existingIds.has(a.id));
    console.log(`📊 Need to fetch ${missingDetails.length} activity details`);

    if (missingDetails.length === 0) {
      console.log('✅ All activities already have details');
      return { success: true, fetched: 0, failed: 0 };
    }

    let fetched = 0;
    let failed = 0;

    // Fetch details with rate limiting (2 per second to avoid 429)
    for (let i = 0; i < missingDetails.length; i++) {
      const activity = missingDetails[i];

      try {
        console.log(`📥 Fetching details for ${activity.id} (${i + 1}/${missingDetails.length})...`);
        await intervalsApi.getActivityIntervals(activity.id, false); // force fetch
        fetched++;

        if (onProgress) {
          onProgress({
            current: i + 1,
            total: missingDetails.length,
            activity: activity.id,
            success: true
          });
        }

        // Rate limiting: wait 500ms between requests (2 per second)
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Failed to fetch details for ${activity.id}:`, error);
        failed++;

        if (onProgress) {
          onProgress({
            current: i + 1,
            total: missingDetails.length,
            activity: activity.id,
            success: false,
            error: error.message
          });
        }

        // Still wait on error to avoid hammering API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`✅ Sync complete: ${fetched} fetched, ${failed} failed`);
    return { success: true, fetched, failed };
  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  }
}
