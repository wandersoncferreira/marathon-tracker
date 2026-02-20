/**
 * Cross Training Service
 * Handles cycling and strength training data with running equivalency calculations
 * FOLLOWS DATABASE-FIRST ARCHITECTURE PATTERN
 */

import { db } from './database';
import { intervalsApi } from './intervalsApi';

// Marathon cycle start date (from COACH_ANALYSIS_PROMPT.md)
const MARATHON_CYCLE_START = '2026-01-19';
const RACE_DATE = '2026-05-31';

/**
 * Get all cross training activities (cycling + strength)
 * DATABASE FIRST - only fetch from API if needed
 * @param {boolean} forceRefresh - If true, always fetch from API regardless of cache
 */
export async function getCrossTrainingActivities(startDate, endDate, forceRefresh = false) {
  try {
    // 1. Try database first (unless force refresh)
    if (!forceRefresh) {
      const cached = await db.getCrossTraining(startDate, endDate);

      if (cached && cached.length > 0) {
        return cached;
      }
    }

    // 2. Fetch from Intervals.icu API (includes Strava-synced activities)
    await intervalsApi.loadConfig();
    const { athleteId } = intervalsApi.config;

    // Fetch all activities
    const activities = await intervalsApi.request(
      `/athlete/${athleteId}/activities?oldest=${startDate}&newest=${endDate}`
    );

    // Filter for cross training activities (basic filter)
    const potentialCrossTraining = activities.filter(a => {
      const isCycling = a.type === 'Ride' || a.type === 'VirtualRide';
      const isStrength = a.type === 'WeightTraining' || a.type === 'Other';
      const isUndefined = a.type === undefined; // Might be cycling/strength with missing type

      return isCycling || isStrength || isUndefined;
    });

    // Helper to delay between requests (rate limiting)
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Fetch full details for each activity directly from API with rate limiting
    const crossTraining = [];
    let detailsFetched = 0;
    let detailsSkipped = 0;

    for (let i = 0; i < potentialCrossTraining.length; i++) {
      const activity = potentialCrossTraining[i];

      try {
        // Add 250ms delay between requests to avoid rate limiting
        if (i > 0) {
          await delay(250);
        }

        // Fetch full activity details from Intervals.icu
        const details = await intervalsApi.request(`/activity/${activity.id}`);

        if (!details) {
          detailsSkipped++;
          continue;
        }

        detailsFetched++;

        // Check if it's cycling or strength training
        const isCycling = details.type === 'Ride' || details.type === 'VirtualRide';
        const isStrength = details.type === 'WeightTraining' ||
          (details.type === 'Other' && (
            details.name?.toLowerCase().includes('strength') ||
            details.name?.toLowerCase().includes('gym') ||
            details.name?.toLowerCase().includes('weights') ||
            details.name?.toLowerCase().includes('musculação')
          ));

        if (isCycling || isStrength) {
          crossTraining.push(details);
        }
      } catch (error) {
        detailsSkipped++;
      }
    }

    // 3. Store in database
    if (crossTraining.length > 0) {
      if (forceRefresh) {
        // FORCE REFRESH MODE: Replace/update existing entries with fresh data from API
        // bulkPut will update existing entries by ID and add new ones
        await db.storeCrossTraining(crossTraining);
        return crossTraining;
      } else {
        // NORMAL MODE: Merge with existing data (only add new activities)
        const existing = await db.getCrossTraining(startDate, endDate);
        const existingIds = new Set(existing.map(a => a.id));

        // Only add new activities that don't already exist
        const newActivities = crossTraining.filter(a => !existingIds.has(a.id));

        if (newActivities.length > 0) {
          await db.storeCrossTraining([...existing, ...newActivities]);
        }

        // Return merged data
        return [...existing, ...newActivities];
      }
    }

    return crossTraining;
  } catch (error) {
    // Try to return cached data as fallback
    const cached = await db.getCrossTraining(startDate, endDate);

    if (cached && cached.length > 0) {
      return cached;
    }

    return [];
  }
}

/**
 * Debug function to inspect API response for a recent cycling activity
 */
export async function debugRecentCyclingActivity() {
  try {
    // Get recent cycling activities from database
    const today = new Date().toISOString().split('T')[0];
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStr = lastMonth.toISOString().split('T')[0];

    const cached = await db.getCrossTraining(lastMonthStr, today);
    const cyclingActivities = cached
      .filter(a => a.type === 'Ride' || a.type === 'VirtualRide')
      .sort((a, b) => new Date(b.start_date_local) - new Date(a.start_date_local));

    if (cyclingActivities.length === 0) {
      console.log('No cycling activities found in database');
      return;
    }

    const mostRecent = cyclingActivities[0];
    console.log('Most recent cycling activity in database:', {
      id: mostRecent.id,
      name: mostRecent.name,
      date: mostRecent.start_date_local
    });

    // Fetch fresh data from API
    console.log('Fetching fresh data from Intervals.icu API...');
    const apiData = await intervalsApi.request(`/activity/${mostRecent.id}`);

    console.log('=== FULL API RESPONSE ===');
    console.log(JSON.stringify(apiData, null, 2));

    console.log('=== ALL FIELD NAMES ===');
    console.log(Object.keys(apiData).sort().join(', '));

    console.log('=== POWER-RELATED FIELDS ===');
    const powerFields = {};
    Object.keys(apiData).forEach(key => {
      if (key.toLowerCase().includes('power') || key.toLowerCase().includes('watt')) {
        powerFields[key] = apiData[key];
      }
    });
    console.log(powerFields);

    console.log('=== OTHER INTERESTING FIELDS ===');
    const interestingFields = ['average_watts', 'avg_watts', 'avg_power', 'watts', 'power',
                                'normalized_power', 'np', 'weighted_average_watts', 'average_hr'];
    interestingFields.forEach(field => {
      if (apiData[field] !== undefined) {
        console.log(`${field}: ${apiData[field]}`);
      }
    });

    return apiData;
  } catch (error) {
    console.error('Error in debugRecentCyclingActivity:', error);
    throw error;
  }
}

/**
 * Sync only activities that are missing power data
 * Much more efficient than full refresh
 */
export async function syncMissingPowerData(startDate, endDate) {
  try {
    // Get all cycling activities from database
    const cached = await db.getCrossTraining(startDate, endDate);
    const cyclingActivities = cached.filter(a => a.type === 'Ride' || a.type === 'VirtualRide');

    console.log(`Total cycling activities: ${cyclingActivities.length}`);

    // Debug: Check what power data exists (first 5 and most recent)
    cyclingActivities.slice(0, 5).forEach(a => {
      console.log(`Activity ${a.id}: icu_average_watts=${a.icu_average_watts}, name="${a.name}", date=${a.start_date_local}`);
    });

    // Check today's activities specifically
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const todayActivities = cyclingActivities.filter(a => a.start_date_local?.startsWith(today));
    console.log(`Today's (${today}) cycling activities: ${todayActivities.length}`);
    todayActivities.forEach(a => {
      console.log(`  TODAY - ${a.id}: icu_average_watts=${a.icu_average_watts}, name="${a.name}"`);
    });

    // Find activities missing power data (check for truthy values, not just existence)
    const missingPower = cyclingActivities.filter(a => {
      const hasPower = a.icu_average_watts && a.icu_average_watts > 0;
      return !hasPower;
    });

    console.log(`Activities missing power data: ${missingPower.length}`);
    missingPower.slice(0, 5).forEach(a => {
      console.log(`  - ${a.id}: "${a.name}" (${a.start_date_local})`);
    });

    if (missingPower.length === 0) {
      return { updated: 0, message: 'All activities already have power data' };
    }

    // Fetch full details only for activities missing power
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const updatedActivities = [];
    const notFoundIds = [];
    let errorCount = 0;

    for (let i = 0; i < missingPower.length; i++) {
      const activity = missingPower[i];

      try {
        // Add 250ms delay between requests to avoid rate limiting
        if (i > 0) {
          await delay(250);
        }

        // Fetch full activity details from Intervals.icu
        const details = await intervalsApi.request(`/activity/${activity.id}`);

        console.log(`Fetched activity ${activity.id}:`, {
          name: details?.name,
          icu_average_watts: details?.icu_average_watts,
          icu_normalized_watts: details?.icu_normalized_watts
        });

        if (details && details.icu_average_watts && details.icu_average_watts > 0) {
          updatedActivities.push(details);
        } else if (details) {
          console.warn(`Activity ${activity.id} still has no power data after fetch`);
        }
      } catch (error) {
        // Handle 404 - activity doesn't exist in Intervals.icu
        if (error.message.includes('404')) {
          notFoundIds.push(activity.id);
        } else {
          errorCount++;
        }
      }
    }

    // Update only the activities that got new data
    if (updatedActivities.length > 0) {
      console.log(`Storing ${updatedActivities.length} updated activities in database`);
      await db.storeCrossTraining(updatedActivities);
      console.log('✅ Activities stored successfully');
    }

    // Clean up activities that no longer exist (404s)
    if (notFoundIds.length > 0) {
      console.log(`Removing ${notFoundIds.length} activities that don't exist: ${notFoundIds.join(', ')}`);
      await db.crossTraining.bulkDelete(notFoundIds);
    }

    // Build result message
    let message = `Checked ${missingPower.length} activities\n`;
    message += `Updated: ${updatedActivities.length} with power data`;
    if (notFoundIds.length > 0) {
      message += `\nRemoved: ${notFoundIds.length} (no longer exist in Intervals.icu)`;
    }
    if (errorCount > 0) {
      message += `\nErrors: ${errorCount}`;
    }

    console.log('Sync complete:', { updated: updatedActivities.length, notFound: notFoundIds.length, errors: errorCount });

    return {
      updated: updatedActivities.length,
      checked: missingPower.length,
      notFound: notFoundIds.length,
      errors: errorCount,
      message
    };
  } catch (error) {
    return {
      updated: 0,
      error: error.message
    };
  }
}

/**
 * Get cycling activities only
 */
export async function getCyclingActivities(startDate, endDate, forceRefresh = false) {
  const all = await getCrossTrainingActivities(startDate, endDate, forceRefresh);
  return all.filter(a => a.type === 'Ride' || a.type === 'VirtualRide');
}

/**
 * Get strength training activities only
 */
export async function getStrengthActivities(startDate, endDate, forceRefresh = false) {
  const all = await getCrossTrainingActivities(startDate, endDate, forceRefresh);
  return all.filter(a => {
    return a.type === 'WeightTraining' ||
      (a.type === 'Other' && (
        a.name?.toLowerCase().includes('strength') ||
        a.name?.toLowerCase().includes('gym') ||
        a.name?.toLowerCase().includes('weights') ||
        a.name?.toLowerCase().includes('musculação')
      ));
  });
}

/**
 * Calculate running equivalency for cycling activity
 * Based on Millet et al. (2009) and comparative physiology research
 */
/**
 * Determine cyclist ability level and adjustment factor
 * Based on cycling FTP relative to running FTP
 * @param {number} cyclingFTP - Cyclist's FTP in watts
 * @param {number} runningFTP - Runner's FTP in watts (default 360W for sub-2h50 marathoner)
 * @returns {object} - Ability level and adjustment factor
 */
function getCyclistAbilityLevel(cyclingFTP, runningFTP = 360) {
  const ratio = cyclingFTP / runningFTP;

  // Elite runner (360W FTP) cycling ability categories:
  // Advanced cyclist: FTP ratio > 0.85 (>305W) - cycling is strong
  // Intermediate cyclist: FTP ratio 0.70-0.85 (250-305W) - balanced
  // Beginner cyclist: FTP ratio < 0.70 (<250W) - cycling is weak

  let level, adjustmentFactor, description;

  if (ratio >= 0.85) {
    level = 'advanced';
    adjustmentFactor = 1.0; // No adjustment needed - use standard conversion
    description = 'Strong cyclist - standard conversion applies';
  } else if (ratio >= 0.70) {
    level = 'intermediate';
    adjustmentFactor = 0.75; // Reduce conversion by 25%
    description = 'Intermediate cyclist - cycling provides 75% of standard running benefit';
  } else {
    level = 'beginner';
    adjustmentFactor = 0.60; // Reduce conversion by 40%
    description = 'Developing cyclist - cycling provides 60% of standard running benefit';
  }

  return {
    level,
    adjustmentFactor,
    ratio: ratio.toFixed(2),
    cyclingFTP,
    runningFTP,
    description
  };
}

export function calculateRunningEquivalent(cyclingActivity) {
  const distance = cyclingActivity.distance || 0; // meters
  const avgPower = cyclingActivity.icu_average_watts || 0;
  const cyclingFTP = cyclingActivity.icu_ftp || 250; // Cycling FTP
  const runningFTP = cyclingActivity.run_ftp || 360; // Running FTP (default for sub-2h50)
  const duration = cyclingActivity.moving_time || 0; // seconds

  // Get personalized ability level and adjustment
  const abilityLevel = getCyclistAbilityLevel(cyclingFTP, runningFTP);

  // Calculate intensity as % of FTP
  const intensityPercent = avgPower / cyclingFTP;

  // Determine BASE conversion factor based on intensity
  // These are standard factors from research (Millet et al. 2009)
  let baseConversionFactor;
  let intensityZone;

  if (intensityPercent < 0.75) {
    baseConversionFactor = 0.275; // Easy/Recovery base
    intensityZone = 'Easy/Recovery';
  } else if (intensityPercent < 0.85) {
    baseConversionFactor = 0.325; // Tempo base
    intensityZone = 'Tempo';
  } else if (intensityPercent < 0.95) {
    baseConversionFactor = 0.375; // Threshold base
    intensityZone = 'Threshold';
  } else {
    baseConversionFactor = 0.425; // VO2max base
    intensityZone = 'VO2max';
  }

  // Apply personalized adjustment based on cyclist ability
  const conversionFactor = baseConversionFactor * abilityLevel.adjustmentFactor;

  // Calculate running equivalent distance
  const runningDistanceMeters = distance * conversionFactor;
  const runningDistanceKm = runningDistanceMeters / 1000;

  // Calculate time-based equivalent (also apply ability adjustment)
  const baseTimeConversionFactor = 0.70; // Base: Running minutes = 70% of cycling minutes
  const timeConversionFactor = baseTimeConversionFactor * abilityLevel.adjustmentFactor;
  const runningMinutes = (duration / 60) * timeConversionFactor;

  // TSS comparison (running TSS is ~1.15x cycling TSS, also apply ability adjustment)
  const cyclingTSS = cyclingActivity.icu_training_load || 0;
  const baseTSSMultiplier = 1.15;
  const tssMultiplier = baseTSSMultiplier * abilityLevel.adjustmentFactor;
  const equivalentRunningTSS = cyclingTSS * tssMultiplier;

  return {
    cyclingDistance: (distance / 1000).toFixed(2), // km
    cyclingDuration: (duration / 60).toFixed(0), // minutes
    intensityPercent: (intensityPercent * 100).toFixed(0),
    intensityZone,
    conversionFactor: conversionFactor.toFixed(3),
    baseConversionFactor: baseConversionFactor.toFixed(3),
    runningDistanceKm: runningDistanceKm.toFixed(2),
    runningMinutes: runningMinutes.toFixed(0),
    cyclingTSS,
    equivalentRunningTSS: equivalentRunningTSS.toFixed(0),
    // Personalization info
    cyclingAbility: abilityLevel.level,
    abilityAdjustment: (abilityLevel.adjustmentFactor * 100).toFixed(0) + '%',
    abilityDescription: abilityLevel.description,
    cyclingFTP: cyclingFTP,
    runningFTP: runningFTP,
    ftpRatio: abilityLevel.ratio,
    formula: `${(distance / 1000).toFixed(1)}km ride @ ${(intensityPercent * 100).toFixed(0)}% FTP ≈ ${runningDistanceKm.toFixed(1)}km run (${abilityLevel.level} cyclist)`
  };
}

/**
 * Get strength training recommendations based on marathon phase
 */
export function getStrengthRecommendations(currentDate) {
  const cycleStart = new Date(MARATHON_CYCLE_START);
  const raceDay = new Date(RACE_DATE);
  const now = new Date(currentDate);

  const daysInCycle = Math.floor((now - cycleStart) / (1000 * 60 * 60 * 24));
  const weeksInCycle = Math.floor(daysInCycle / 7) + 1;
  const totalWeeks = Math.ceil((raceDay - cycleStart) / (1000 * 60 * 60 * 24 * 7));

  let phase, weeklyMinutes, focus, exercises, rationale;

  if (weeksInCycle <= 4) {
    phase = 'Base Building';
    weeklyMinutes = [60, 90];
    focus = 'General strength, muscle recruitment, injury prevention';
    exercises = [
      { name: 'Squats (3x8-12)', video: 'https://www.youtube.com/watch?v=ultWZbUMPL8' },
      { name: 'Deadlifts (3x6-10)', video: 'https://www.youtube.com/watch?v=op9kVnSso6Q' },
      { name: 'Single-leg RDLs (3x8 each)', video: 'https://www.youtube.com/watch?v=yQi3BYepvh0' },
      { name: 'Lunges (3x10 each)', video: 'https://www.youtube.com/watch?v=QOVaHwm-Q6U' },
      { name: 'Calf raises (3x15)', video: 'https://www.youtube.com/watch?v=gwLzBJYoWlI' },
      { name: 'Core work (planks, side planks)', video: 'https://www.youtube.com/watch?v=pSHjTRCQxIw' }
    ];
    rationale = 'Build muscular foundation and prevent injuries. Focus on high volume, moderate intensity (Balsalobre-Fernández et al., 2016).';
  } else if (weeksInCycle <= 8) {
    phase = 'Build';
    weeklyMinutes = [45, 60];
    focus = 'Power endurance, single-leg stability, plyometrics';
    exercises = [
      { name: 'Single-leg squats (3x6-8 each)', video: 'https://www.youtube.com/watch?v=t7Oj8-8Htyw' },
      { name: 'Box jumps (3x8)', video: 'https://www.youtube.com/watch?v=NBY9-kTuHEk' },
      { name: 'Bulgarian split squats (3x8 each)', video: 'https://www.youtube.com/watch?v=2C-uNgKwPLE' },
      { name: 'Banded lateral walks (3x12)', video: 'https://www.youtube.com/watch?v=Tv6SQYcj5r0' },
      { name: 'Calf hops (3x10)', video: 'https://www.youtube.com/watch?v=gwLzBJYoWlI' },
      { name: 'Core rotations', video: 'https://www.youtube.com/watch?v=8qcb-w6aokA' }
    ];
    rationale = 'Maintain strength while running volume increases. Add explosive movements (Beattie et al., 2014).';
  } else if (weeksInCycle <= 16) {
    phase = 'Peak Training';
    weeklyMinutes = [30, 45];
    focus = 'Maintenance, explosive power, minimal fatigue';
    exercises = [
      { name: 'Light squats (2x6)', video: 'https://www.youtube.com/watch?v=ultWZbUMPL8' },
      { name: 'Quick box jumps (3x5)', video: 'https://www.youtube.com/watch?v=NBY9-kTuHEk' },
      { name: 'Single-leg balance work', video: 'https://www.youtube.com/watch?v=LnKfMKNMDFI' },
      { name: 'Banded clamshells (2x12)', video: 'https://www.youtube.com/watch?v=AcnEmdmr6lQ' },
      { name: 'Explosive calf raises (3x8)', video: 'https://www.youtube.com/watch?v=gwLzBJYoWlI' },
      { name: 'Short core circuits', video: 'https://www.youtube.com/watch?v=pSHjTRCQxIw' }
    ];
    rationale = 'Preserve neuromuscular capacity without adding fatigue. Lower volume, maintain intensity (Mikkola et al., 2007).';
  } else {
    phase = 'Taper';
    weeklyMinutes = [20, 30];
    focus = 'Light maintenance only, preserve without fatigue';
    exercises = [
      { name: 'Bodyweight squats (2x8)', video: 'https://www.youtube.com/watch?v=aclHkVaku9U' },
      { name: 'Gentle lunges (2x6 each)', video: 'https://www.youtube.com/watch?v=QOVaHwm-Q6U' },
      { name: 'Balance work', video: 'https://www.youtube.com/watch?v=LnKfMKNMDFI' },
      { name: 'Light core (planks only)', video: 'https://www.youtube.com/watch?v=pSHjTRCQxIw' },
      { name: 'Mobility work', video: 'https://www.youtube.com/watch?v=L_xrDAtykMI' }
    ];
    rationale = 'Maintain strength adaptations without compromising recovery. Very light loads (Taipale et al., 2010).';
  }

  return {
    currentPhase: phase,
    weeksInCycle,
    totalWeeks,
    weeklyMinutes,
    weeklyMinutesRange: `${weeklyMinutes[0]}-${weeklyMinutes[1]} min`,
    focus,
    exercises,
    rationale,
    references: [
      'Balsalobre-Fernández et al. (2016). Effects of strength training on running economy',
      'Beattie et al. (2014). The effect of strength training on performance in endurance athletes',
      'Mikkola et al. (2007). Neuromuscular and cardiovascular adaptations during concurrent strength and endurance training',
      'Taipale et al. (2010). Strength training in endurance runners'
    ]
  };
}

/**
 * Calculate weekly/monthly strength training stats
 */
export async function getStrengthStats(startDate, endDate, forceRefresh = false) {
  const activities = await getStrengthActivities(startDate, endDate, forceRefresh);

  const totalTime = activities.reduce((sum, a) => sum + (a.moving_time || 0), 0);
  const totalMinutes = Math.floor(totalTime / 60);
  const sessionCount = activities.length;

  // Group by week (weeks start on Monday)
  const byWeek = {};

  // Always include current week (even if no activities)
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();
  const currentDate = new Date(currentYear, currentMonth, currentDay, 12, 0, 0);
  const currentDayOfWeek = currentDate.getDay();
  const currentDaysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
  const currentWeekStart = new Date(currentYear, currentMonth, currentDay - currentDaysToMonday, 12, 0, 0);
  const currentWeekKey = `${currentWeekStart.getFullYear()}-${String(currentWeekStart.getMonth() + 1).padStart(2, '0')}-${String(currentWeekStart.getDate()).padStart(2, '0')}`;

  byWeek[currentWeekKey] = { sessions: 0, minutes: 0 };

  activities.forEach(activity => {
    // Extract date only (YYYY-MM-DD) to avoid timezone issues
    const dateStr = activity.start_date_local.split('T')[0];
    const [year, month, day] = dateStr.split('-').map(Number);

    // Create date at noon to avoid timezone edge cases
    const date = new Date(year, month - 1, day, 12, 0, 0);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday-based week

    // Calculate Monday of this week
    const weekStart = new Date(year, month - 1, day - daysToMonday, 12, 0, 0);
    const weekYear = weekStart.getFullYear();
    const weekMonth = String(weekStart.getMonth() + 1).padStart(2, '0');
    const weekDay = String(weekStart.getDate()).padStart(2, '0');
    const weekKey = `${weekYear}-${weekMonth}-${weekDay}`;

    if (!byWeek[weekKey]) {
      byWeek[weekKey] = { sessions: 0, minutes: 0 };
    }
    byWeek[weekKey].sessions++;
    byWeek[weekKey].minutes += Math.floor((activity.moving_time || 0) / 60);
  });

  // Group by month
  const byMonth = {};
  activities.forEach(activity => {
    const date = new Date(activity.start_date_local);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!byMonth[monthKey]) {
      byMonth[monthKey] = { sessions: 0, minutes: 0 };
    }
    byMonth[monthKey].sessions++;
    byMonth[monthKey].minutes += Math.floor((activity.moving_time || 0) / 60);
  });

  return {
    total: {
      sessions: sessionCount,
      minutes: totalMinutes,
      hours: (totalMinutes / 60).toFixed(1)
    },
    byWeek,
    byMonth,
    activities
  };
}

/**
 * Calculate cycling stats with running equivalency
 */
export async function getCyclingStats(startDate, endDate, forceRefresh = false) {
  const activities = await getCyclingActivities(startDate, endDate, forceRefresh);

  const stats = activities.map(activity => {
    const equivalent = calculateRunningEquivalent(activity);
    return {
      date: activity.start_date_local,
      name: activity.name,
      distance: (activity.distance / 1000).toFixed(2),
      duration: Math.floor(activity.moving_time / 60),
      avgPower: activity.icu_average_watts,
      avgHR: activity.icu_average_hr || activity.average_hr,
      tss: activity.icu_training_load,
      runningEquivalent: equivalent
    };
  });

  const totalCyclingKm = activities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000;
  const totalCyclingMinutes = activities.reduce((sum, a) => sum + (a.moving_time || 0), 0) / 60;
  const totalCyclingTSS = activities.reduce((sum, a) => sum + (a.icu_training_load || 0), 0);

  const totalRunningEquivalentKm = stats.reduce((sum, s) =>
    sum + parseFloat(s.runningEquivalent.runningDistanceKm), 0
  );
  const totalRunningEquivalentMinutes = stats.reduce((sum, s) =>
    sum + parseFloat(s.runningEquivalent.runningMinutes), 0
  );
  const totalRunningEquivalentTSS = stats.reduce((sum, s) =>
    sum + parseFloat(s.runningEquivalent.equivalentRunningTSS), 0
  );

  // Get personalized info from the first activity (all should have same level)
  let personalizedInfo = null;
  if (activities.length > 0 && stats.length > 0) {
    const firstEquiv = stats[0].runningEquivalent;
    personalizedInfo = {
      level: firstEquiv.cyclingAbility,
      adjustment: firstEquiv.abilityAdjustment,
      description: firstEquiv.abilityDescription,
      cyclingFTP: firstEquiv.cyclingFTP,
      runningFTP: firstEquiv.runningFTP,
      ftpRatio: firstEquiv.ftpRatio
    };
  }

  // Group by week (weeks start on Monday)
  const byWeek = {};

  // Always include current week (even if no activities)
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();
  const currentDate = new Date(currentYear, currentMonth, currentDay, 12, 0, 0);
  const currentDayOfWeek = currentDate.getDay();
  const currentDaysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
  const currentWeekStart = new Date(currentYear, currentMonth, currentDay - currentDaysToMonday, 12, 0, 0);
  const currentWeekKey = `${currentWeekStart.getFullYear()}-${String(currentWeekStart.getMonth() + 1).padStart(2, '0')}-${String(currentWeekStart.getDate()).padStart(2, '0')}`;

  byWeek[currentWeekKey] = { sessions: 0, km: 0, runningEquivKm: 0, tss: 0 };

  activities.forEach(activity => {
    // Extract date only (YYYY-MM-DD) to avoid timezone issues
    const dateStr = activity.start_date_local.split('T')[0];
    const [year, month, day] = dateStr.split('-').map(Number);

    // Create date at noon to avoid timezone edge cases
    const date = new Date(year, month - 1, day, 12, 0, 0);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday-based week

    // Calculate Monday of this week
    const weekStart = new Date(year, month - 1, day - daysToMonday, 12, 0, 0);
    const weekYear = weekStart.getFullYear();
    const weekMonth = String(weekStart.getMonth() + 1).padStart(2, '0');
    const weekDay = String(weekStart.getDate()).padStart(2, '0');
    const weekKey = `${weekYear}-${weekMonth}-${weekDay}`;

    if (!byWeek[weekKey]) {
      byWeek[weekKey] = { sessions: 0, km: 0, runningEquivKm: 0, tss: 0 };
    }

    const equivalent = calculateRunningEquivalent(activity);
    byWeek[weekKey].sessions++;
    byWeek[weekKey].km += (activity.distance || 0) / 1000;
    byWeek[weekKey].runningEquivKm += parseFloat(equivalent.runningDistanceKm);
    byWeek[weekKey].tss += activity.icu_training_load || 0;
  });

  return {
    activities: stats,
    byWeek,
    totals: {
      cycling: {
        sessions: activities.length,
        km: totalCyclingKm.toFixed(2),
        minutes: totalCyclingMinutes.toFixed(0),
        tss: totalCyclingTSS.toFixed(0)
      },
      runningEquivalent: {
        km: totalRunningEquivalentKm.toFixed(2),
        minutes: totalRunningEquivalentMinutes.toFixed(0),
        tss: totalRunningEquivalentTSS.toFixed(0)
      }
    },
    personalizedInfo: personalizedInfo
  };
}

/**
 * Check if marathon phase has changed since last update
 * Returns phase info and whether an update is needed
 */
export function checkPhaseChange(currentDate) {
  const currentRecs = getStrengthRecommendations(currentDate);

  // Get last updated phase from localStorage
  const lastUpdate = localStorage.getItem('strength_recs_last_update');
  const lastPhase = localStorage.getItem('strength_recs_last_phase');

  if (!lastUpdate || !lastPhase) {
    // First time - always needs update
    return {
      needsUpdate: true,
      currentPhase: currentRecs.currentPhase,
      lastPhase: null,
      lastUpdate: null,
      weeksInCycle: currentRecs.weeksInCycle,
      totalWeeks: currentRecs.totalWeeks
    };
  }

  const phaseChanged = lastPhase !== currentRecs.currentPhase;

  return {
    needsUpdate: phaseChanged,
    currentPhase: currentRecs.currentPhase,
    lastPhase: lastPhase,
    lastUpdate: lastUpdate,
    weeksInCycle: currentRecs.weeksInCycle,
    totalWeeks: currentRecs.totalWeeks
  };
}

/**
 * Mark recommendations as updated for current phase
 */
export function markRecommendationsUpdated(phase) {
  const now = new Date().toISOString();
  localStorage.setItem('strength_recs_last_update', now);
  localStorage.setItem('strength_recs_last_phase', phase);
}

/**
 * Generate the prompt for AI to create strength recommendations
 */
export function generateStrengthRecommendationsPrompt(currentDate) {
  const cycleStart = new Date(MARATHON_CYCLE_START);
  const raceDay = new Date(RACE_DATE);
  const now = new Date(currentDate);

  const daysInCycle = Math.floor((now - cycleStart) / (1000 * 60 * 60 * 24));
  const weeksInCycle = Math.floor(daysInCycle / 7) + 1;
  const totalWeeks = Math.ceil((raceDay - cycleStart) / (1000 * 60 * 60 * 24 * 7));
  const daysToRace = Math.floor((raceDay - now) / (1000 * 60 * 60 * 24));
  const weeksToRace = Math.ceil(daysToRace / 7);

  // Determine phase
  let phase;
  if (weeksInCycle <= 4) {
    phase = 'Base Building';
  } else if (weeksInCycle <= 8) {
    phase = 'Build';
  } else if (weeksInCycle <= 16) {
    phase = 'Peak Training';
  } else {
    phase = 'Taper';
  }

  return {
    prompt: `Generate strength training recommendations for a marathon runner based on the following parameters:

**Marathon Training Context:**
- Current Phase: ${phase}
- Week in Cycle: ${weeksInCycle} of ${totalWeeks}
- Weeks to Race: ${weeksToRace}
- Marathon Start Date: ${MARATHON_CYCLE_START}
- Race Date: ${RACE_DATE}
- Current Date: ${currentDate}

**Requirements:**
Please generate comprehensive strength training recommendations following the format and guidelines in the STRENGTH_RECOMMENDATIONS_PROMPT.md file.

Focus on:
1. 5-6 exercises with YouTube video links for proper form
2. Scientific rationale with research citations
3. Weekly schedule with optimal training days
4. Progression guidelines specific to this phase
5. Recovery considerations for marathon training
6. Red flags to watch for
7. Runner-specific considerations (injury prevention, running economy)

Return the recommendations in the exact JSON format specified in the prompt file.`,
    parameters: {
      phase,
      weekInCycle: weeksInCycle,
      totalWeeks,
      weeksToRace,
      startDate: MARATHON_CYCLE_START,
      raceDate: RACE_DATE,
      currentDate
    }
  };
}

export default {
  getCrossTrainingActivities,
  getCyclingActivities,
  getStrengthActivities,
  calculateRunningEquivalent,
  getStrengthRecommendations,
  getStrengthStats,
  getCyclingStats,
  checkPhaseChange,
  markRecommendationsUpdated,
  generateStrengthRecommendationsPrompt
};
