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
        console.log(`✅ Loaded ${cached.length} cross training activities from database (Cycling: ${cached.filter(a => a.type === 'Ride' || a.type === 'VirtualRide').length}, Strength: ${cached.filter(a => a.type === 'WeightTraining').length})`);
        return cached;
      }
    }

    // 2. Fetch from Intervals.icu API (includes Strava-synced activities)
    console.log(forceRefresh ? '🔄 Force refreshing cross training from Intervals.icu API...' : '📡 Fetching cross training from Intervals.icu API...');

    await intervalsApi.loadConfig();
    const { athleteId } = intervalsApi.config;

    // Fetch all activities
    const activities = await intervalsApi.request(
      `/athlete/${athleteId}/activities?oldest=${startDate}&newest=${endDate}`
    );

    console.log(`📊 Fetched ${activities.length} total activities from Intervals.icu API`);

    // Log sample of activity types
    const activityTypes = {};
    activities.forEach(a => {
      activityTypes[a.type] = (activityTypes[a.type] || 0) + 1;
    });
    console.log('📊 Activity types:', activityTypes);

    // Filter for cross training activities (basic filter)
    const potentialCrossTraining = activities.filter(a => {
      const isCycling = a.type === 'Ride' || a.type === 'VirtualRide';
      const isStrength = a.type === 'WeightTraining' || a.type === 'Other';
      const isUndefined = a.type === undefined; // Might be cycling/strength with missing type

      return isCycling || isStrength || isUndefined;
    });

    console.log(`📡 Fetching details for ${potentialCrossTraining.length} potential cross training activities...`);

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
          console.warn(`⚠️ No details found for activity ${activity.id}`);
          detailsSkipped++;
          continue;
        }

        detailsFetched++;

        // Debug first few activities
        if (detailsFetched <= 3) {
          console.log(`📋 Activity ${activity.id} details:`, {
            id: details.id,
            type: details.type,
            name: details.name,
            distance: details.distance
          });
        }

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
        } else if (detailsFetched <= 3) {
          console.log(`⏭️ Skipping activity ${activity.id} - not cycling or strength (type: ${details.type})`);
        }

        // Progress indicator every 5 activities
        if ((i + 1) % 5 === 0) {
          console.log(`⏳ Progress: ${i + 1}/${potentialCrossTraining.length} activities checked...`);
        }
      } catch (error) {
        console.error(`❌ Failed to fetch details for activity ${activity.id}:`, error);
        detailsSkipped++;
      }
    }

    console.log(`📊 Details fetch summary: ${detailsFetched} fetched, ${detailsSkipped} skipped`);
    console.log(`✅ Filtered to ${crossTraining.length} cross training activities (Cycling: ${crossTraining.filter(a => a.type === 'Ride' || a.type === 'VirtualRide').length}, Strength: ${crossTraining.filter(a => a.type === 'WeightTraining').length})`);

    // 3. Store in database incrementally (merge with existing data)
    if (crossTraining.length > 0) {
      // Get existing activities to merge
      const existing = await db.getCrossTraining(startDate, endDate);
      const existingIds = new Set(existing.map(a => a.id));

      // Only add new activities that don't already exist
      const newActivities = crossTraining.filter(a => !existingIds.has(a.id));

      if (newActivities.length > 0) {
        console.log(`➕ Adding ${newActivities.length} new cross training activities to database`);
        await db.storeCrossTraining([...existing, ...newActivities]);
      } else {
        console.log(`✅ No new activities to add (all ${crossTraining.length} already in database)`);
      }

      // Return merged data
      return [...existing, ...newActivities];
    }

    return crossTraining;
  } catch (error) {
    // Try to return cached data as fallback
    const cached = await db.getCrossTraining(startDate, endDate);

    if (cached && cached.length > 0) {
      // We have cached data - log info instead of error
      if (error.code === 'NO_API_KEY') {
        console.log(`ℹ️ Using ${cached.length} cached cross training activities (API not configured)`);
      } else {
        console.log(`ℹ️ API error, using ${cached.length} cached cross training activities`);
      }
      return cached;
    }

    // No cached data available - this is a real error
    if (error.code === 'NO_API_KEY') {
      console.warn('⚠️ API key not configured and no cached cross training data available');
    } else {
      console.error('❌ Error fetching cross training and no cached data available:', error.message);
    }
    return [];
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
export function calculateRunningEquivalent(cyclingActivity) {
  const distance = cyclingActivity.distance || 0; // meters
  const avgPower = cyclingActivity.average_watts || 0;
  const ftp = cyclingActivity.icu_ftp || 250; // Fallback FTP
  const duration = cyclingActivity.moving_time || 0; // seconds

  // Calculate intensity as % of FTP
  const intensityPercent = avgPower / ftp;

  // Determine conversion factor based on intensity
  let conversionFactor;
  let intensityZone;

  if (intensityPercent < 0.75) {
    conversionFactor = 0.275; // Easy/Recovery
    intensityZone = 'Easy/Recovery';
  } else if (intensityPercent < 0.85) {
    conversionFactor = 0.325; // Tempo
    intensityZone = 'Tempo';
  } else if (intensityPercent < 0.95) {
    conversionFactor = 0.375; // Threshold
    intensityZone = 'Threshold';
  } else {
    conversionFactor = 0.425; // VO2max
    intensityZone = 'VO2max';
  }

  // Calculate running equivalent distance
  const runningDistanceMeters = distance * conversionFactor;
  const runningDistanceKm = runningDistanceMeters / 1000;

  // Calculate time-based equivalent
  const timeConversionFactor = 0.70; // Running minutes = 70% of cycling minutes
  const runningMinutes = (duration / 60) * timeConversionFactor;

  // TSS comparison (running TSS is ~1.15x cycling TSS for same perceived effort)
  const cyclingTSS = cyclingActivity.icu_training_load || 0;
  const equivalentRunningTSS = cyclingTSS * 1.15;

  return {
    cyclingDistance: (distance / 1000).toFixed(2), // km
    cyclingDuration: (duration / 60).toFixed(0), // minutes
    intensityPercent: (intensityPercent * 100).toFixed(0),
    intensityZone,
    conversionFactor,
    runningDistanceKm: runningDistanceKm.toFixed(2),
    runningMinutes: runningMinutes.toFixed(0),
    cyclingTSS,
    equivalentRunningTSS: equivalentRunningTSS.toFixed(0),
    formula: `${(distance / 1000).toFixed(1)}km ride @ ${(intensityPercent * 100).toFixed(0)}% FTP ≈ ${runningDistanceKm.toFixed(1)}km run`
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
      avgPower: activity.average_watts,
      avgHR: activity.average_hr,
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
    }
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
