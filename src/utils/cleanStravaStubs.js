/**
 * Utility to remove STRAVA stub activities from database
 * STRAVA activities cannot be accessed via Intervals.icu API
 */

import { db } from '../services/database';

export async function cleanStravaStubs() {
  try {
    console.log('🧹 Starting STRAVA stubs cleanup...');

    // Get all activities
    const allActivities = await db.activities.toArray();
    console.log(`📊 Found ${allActivities.length} total activities`);

    // Find STRAVA stubs
    const stravaStubs = allActivities.filter(a => a.source === 'STRAVA');
    console.log(`📊 Found ${stravaStubs.length} STRAVA stubs to remove`);

    if (stravaStubs.length === 0) {
      console.log('✅ No STRAVA stubs found');
      return { success: true, removed: 0 };
    }

    // Delete STRAVA activities
    const stravaIds = stravaStubs.map(a => a.id);
    await db.activities.bulkDelete(stravaIds);
    console.log(`✅ Deleted ${stravaIds.length} STRAVA stub activities`);

    // Also delete any associated activity details (if any exist)
    let detailsDeleted = 0;
    for (const id of stravaIds) {
      const details = await db.activityDetails.get(id);
      if (details) {
        await db.activityDetails.delete(id);
        detailsDeleted++;
      }
    }

    if (detailsDeleted > 0) {
      console.log(`✅ Deleted ${detailsDeleted} STRAVA activity details`);
    }

    console.log(`✅ Cleanup complete: removed ${stravaIds.length} STRAVA stubs`);
    return { success: true, removed: stravaIds.length, detailsRemoved: detailsDeleted };
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}
