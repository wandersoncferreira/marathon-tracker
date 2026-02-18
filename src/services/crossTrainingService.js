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
 */
export async function getCrossTrainingActivities(startDate, endDate) {
  try {
    // 1. Try database first
    const cached = await db.getCrossTraining(startDate, endDate);

    if (cached && cached.length > 0) {
      console.log(`✅ Loaded ${cached.length} cross training activities from database`);
      return cached;
    }

    // 2. Fetch from API if database is empty
    console.log('📡 Fetching cross training from Intervals.icu API...');

    await intervalsApi.loadConfig();
    const { athleteId } = intervalsApi.config;

    // Fetch all activities
    const activities = await intervalsApi.request(
      `/athlete/${athleteId}/activities?oldest=${startDate}&newest=${endDate}`
    );

    // Filter for cross training activities
    const crossTraining = activities.filter(a => {
      const isCycling = a.type === 'Ride' || a.type === 'VirtualRide';
      const isStrength = a.type === 'Other' &&
        (a.name?.toLowerCase().includes('strength') ||
         a.name?.toLowerCase().includes('gym') ||
         a.name?.toLowerCase().includes('weights') ||
         a.name?.toLowerCase().includes('musculação'));

      return isCycling || isStrength;
    });

    // 3. Store in database
    if (crossTraining.length > 0) {
      await db.storeCrossTraining(crossTraining);
      console.log(`✅ Stored ${crossTraining.length} cross training activities`);
    }

    return crossTraining;
  } catch (error) {
    console.error('Error fetching cross training:', error);

    // 4. On error, return cached data
    return await db.getCrossTraining(startDate, endDate);
  }
}

/**
 * Get cycling activities only
 */
export async function getCyclingActivities(startDate, endDate) {
  const all = await getCrossTrainingActivities(startDate, endDate);
  return all.filter(a => a.type === 'Ride' || a.type === 'VirtualRide');
}

/**
 * Get strength training activities only
 */
export async function getStrengthActivities(startDate, endDate) {
  const all = await getCrossTrainingActivities(startDate, endDate);
  return all.filter(a => {
    return a.type === 'Other' &&
      (a.name?.toLowerCase().includes('strength') ||
       a.name?.toLowerCase().includes('gym') ||
       a.name?.toLowerCase().includes('weights') ||
       a.name?.toLowerCase().includes('musculação'));
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
      'Squats (3x8-12)',
      'Deadlifts (3x6-10)',
      'Single-leg RDLs (3x8 each)',
      'Lunges (3x10 each)',
      'Calf raises (3x15)',
      'Core work (planks, side planks)'
    ];
    rationale = 'Build muscular foundation and prevent injuries. Focus on high volume, moderate intensity (Balsalobre-Fernández et al., 2016).';
  } else if (weeksInCycle <= 8) {
    phase = 'Build';
    weeklyMinutes = [45, 60];
    focus = 'Power endurance, single-leg stability, plyometrics';
    exercises = [
      'Single-leg squats (3x6-8 each)',
      'Box jumps (3x8)',
      'Bulgarian split squats (3x8 each)',
      'Banded lateral walks (3x12)',
      'Calf hops (3x10)',
      'Core rotations'
    ];
    rationale = 'Maintain strength while running volume increases. Add explosive movements (Beattie et al., 2014).';
  } else if (weeksInCycle <= 16) {
    phase = 'Peak Training';
    weeklyMinutes = [30, 45];
    focus = 'Maintenance, explosive power, minimal fatigue';
    exercises = [
      'Light squats (2x6)',
      'Quick box jumps (3x5)',
      'Single-leg balance work',
      'Banded clamshells (2x12)',
      'Explosive calf raises (3x8)',
      'Short core circuits'
    ];
    rationale = 'Preserve neuromuscular capacity without adding fatigue. Lower volume, maintain intensity (Mikkola et al., 2007).';
  } else {
    phase = 'Taper';
    weeklyMinutes = [20, 30];
    focus = 'Light maintenance only, preserve without fatigue';
    exercises = [
      'Bodyweight squats (2x8)',
      'Gentle lunges (2x6 each)',
      'Balance work',
      'Light core (planks only)',
      'Mobility work'
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
export async function getStrengthStats(startDate, endDate) {
  const activities = await getStrengthActivities(startDate, endDate);

  const totalTime = activities.reduce((sum, a) => sum + (a.moving_time || 0), 0);
  const totalMinutes = Math.floor(totalTime / 60);
  const sessionCount = activities.length;

  // Group by week
  const byWeek = {};
  activities.forEach(activity => {
    const date = new Date(activity.start_date_local);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
    const weekKey = weekStart.toISOString().split('T')[0];

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
export async function getCyclingStats(startDate, endDate) {
  const activities = await getCyclingActivities(startDate, endDate);

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

  return {
    activities: stats,
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

export default {
  getCrossTrainingActivities,
  getCyclingActivities,
  getStrengthActivities,
  calculateRunningEquivalent,
  getStrengthRecommendations,
  getStrengthStats,
  getCyclingStats
};
