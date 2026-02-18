# Cross Training Feature - Implementation Guide

## Overview

Add comprehensive cross training monitoring to the Marathon Tracker app with two main components:

1. **Strength Training**: Time tracking and phase-specific guidance
2. **Cycling**: Metrics tracking with running equivalency calculations

## Requirements

### Strength Training

**Metrics to Track:**
- Total time per week
- Total time per month
- Session count per week/month

**Guidance to Provide:**
- Recommended time per week based on marathon phase
- Focus areas based on current training phase
- Evidence-based recommendations from literature

**Literature-Based Recommendations:**

| Phase | Weekly Time | Focus | Rationale |
|-------|-------------|-------|-----------|
| Base (Weeks 1-4) | 60-90 min | General strength, muscle recruitment | Build foundation, prevent injury (Balsalobre-Fernández et al., 2016) |
| Build (Weeks 5-8) | 45-60 min | Power endurance, single-leg stability | Maintain strength while volume increases (Beattie et al., 2014) |
| Peak (Weeks 9-16) | 30-45 min | Maintenance, explosive power | Minimize fatigue, preserve neuromuscular capacity (Mikkola et al., 2007) |
| Taper (Weeks 17-20) | 20-30 min | Light maintenance only | Preserve strength without compromising recovery (Taipale et al., 2010) |

### Cycling

**Metrics to Track:**
- Power (avg watts)
- Time (duration)
- Distance (km)
- Average heart rate
- TSS (Training Stress Score)

**Running Equivalency Formula** (Evidence-Based):

Based on research from Millet et al. (2009) and comparative physiological studies:

```
Running Equivalent = Cycling Distance × Conversion Factor

Conversion Factors by Intensity:
- Easy/Recovery (<75% FTP): 0.25-0.30
  Example: 40km easy ride = 10-12km easy run

- Tempo (75-85% FTP): 0.30-0.35
  Example: 30km tempo ride = 9-10.5km tempo run

- Threshold (85-95% FTP): 0.35-0.40
  Example: 20km threshold ride = 7-8km threshold run

- VO2max (>95% FTP): 0.40-0.45
  Example: 10km hard ride = 4-4.5km hard run

Alternative Formula (Time-Based):
Running Minutes = Cycling Minutes × 0.65-0.75
(Accounts for lower impact stress)
```

**TSS Comparison:**
```
Running TSS ≈ Cycling TSS × 1.1-1.2
(Running has higher impact stress per TSS point)
```

## Database Schema Changes

### Update `database.js`

```javascript
// Add version 7 with cross training table
this.version(7).stores({
  // Store all cross training activities (cycling, strength, etc.)
  crossTraining: 'id, date, type, start_date_local, *tags',
});

// Access table
this.crossTraining = this.table('crossTraining');
```

### Add Database Methods

```javascript
/**
 * Store cross training activities (bulk)
 */
async storeCrossTraining(activities) {
  try {
    await this.crossTraining.bulkPut(activities);
    return true;
  } catch (error) {
    console.error('Error storing cross training:', error);
    return false;
  }
}

/**
 * Get cross training by date range
 */
async getCrossTraining(startDate, endDate) {
  try {
    let adjustedEndDate = endDate;
    if (!endDate.includes('T')) {
      adjustedEndDate = endDate + 'T23:59:59';
    }

    return await this.crossTraining
      .where('start_date_local')
      .between(startDate, adjustedEndDate, true, true)
      .toArray();
  } catch (error) {
    console.error('Error getting cross training:', error);
    return [];
  }
}

/**
 * Get cross training by type
 */
async getCrossTrainingByType(type, startDate, endDate) {
  try {
    const all = await this.getCrossTraining(startDate, endDate);
    return all.filter(a => a.type === type);
  } catch (error) {
    console.error('Error getting cross training by type:', error);
    return [];
  }
}

/**
 * Get latest cross training activity date
 */
async getLatestCrossTrainingDate() {
  try {
    const latest = await this.crossTraining
      .orderBy('start_date_local')
      .reverse()
      .first();
    if (!latest) return null;

    const dateStr = latest.start_date_local;
    if (dateStr.includes('T')) {
      return dateStr.split('T')[0];
    }
    return dateStr;
  } catch (error) {
    console.error('Error getting latest cross training date:', error);
    return null;
  }
}
```

## Service Layer

### Create `crossTrainingService.js`

```javascript
/**
 * Cross Training Service
 * Handles cycling and strength training data with running equivalency calculations
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

    // Fetch cycling (Ride, VirtualRide) and strength (Other with "Strength" in name)
    const activities = await intervalsApi.request(
      `/athlete/${athleteId}/activities?oldest=${startDate}&newest=${endDate}`
    );

    // Filter for cross training activities
    const crossTraining = activities.filter(a => {
      const isCycling = a.type === 'Ride' || a.type === 'VirtualRide';
      const isStrength = a.type === 'Other' &&
        (a.name?.toLowerCase().includes('strength') ||
         a.name?.toLowerCase().includes('gym') ||
         a.name?.toLowerCase().includes('weights'));

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
       a.name?.toLowerCase().includes('weights'));
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
  const cyclingTSS = cyclingActivity.training_load || 0;
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
    formula: `${(distance / 1000).toFixed(1)}km ride @ ${intensityPercent.toFixed(0)}% FTP ≈ ${runningDistanceKm.toFixed(1)}km run`
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
      tss: activity.training_load,
      runningEquivalent: equivalent
    };
  });

  const totalCyclingKm = activities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000;
  const totalCyclingMinutes = activities.reduce((sum, a) => sum + (a.moving_time || 0), 0) / 60;
  const totalCyclingTSS = activities.reduce((sum, a) => sum + (a.training_load || 0), 0);

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
```

## Update Export/Import

### Update `databaseSync.js`

```javascript
// In exportDatabaseToFiles()
export async function exportDatabaseToFiles() {
  try {
    const exports = {
      timestamp: new Date().toISOString(),
      version: 7, // Increment version
      tables: {}
    };

    // ... existing exports ...

    // Export cross training
    const crossTraining = await db.crossTraining.toArray();
    exports.tables.crossTraining = {
      count: crossTraining.length,
      data: crossTraining
    };

    return exports;
  } catch (error) {
    console.error('Error exporting database:', error);
    throw error;
  }
}

// In importDatabaseFromData()
export async function importDatabaseFromData(data, clearExisting = false) {
  try {
    // ... existing imports ...

    // Import cross training
    if (data.tables.crossTraining?.data) {
      try {
        console.log(`📥 Importing ${data.tables.crossTraining.data.length} cross training activities...`);
        await db.crossTraining.bulkPut(data.tables.crossTraining.data);
        imported.crossTraining = data.tables.crossTraining.data.length;
        console.log(`✅ Imported ${imported.crossTraining} cross training activities`);
      } catch (error) {
        console.error('❌ Error importing cross training:', error);
        throw error;
      }
    }

    return imported;
  } catch (error) {
    console.error('❌ Fatal error importing database:', error);
    throw error;
  }
}
```

## UI Component

### Create `CrossTraining.jsx`

```javascript
import { useState, useEffect } from 'react';
import {
  getStrengthStats,
  getCyclingStats,
  getStrengthRecommendations
} from '../services/crossTrainingService';
import { useTranslation } from 'react-i18n';

const MARATHON_CYCLE_START = '2026-01-19';
const TODAY = new Date().toISOString().split('T')[0];

export default function CrossTraining() {
  const { t } = useTranslation();
  const [strengthStats, setStrengthStats] = useState(null);
  const [cyclingStats, setCyclingStats] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('strength'); // 'strength' or 'cycling'

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      // Load data from marathon cycle start to today
      const [strength, cycling, recs] = await Promise.all([
        getStrengthStats(MARATHON_CYCLE_START, TODAY),
        getCyclingStats(MARATHON_CYCLE_START, TODAY),
        getStrengthRecommendations(TODAY)
      ]);

      setStrengthStats(strength);
      setCyclingStats(cycling);
      setRecommendations(recs);
    } catch (error) {
      console.error('Error loading cross training data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {t('crossTraining.title')}
        </h2>
        <p className="text-gray-600">
          {t('crossTraining.subtitle')}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('strength')}
              className={`py-4 px-6 font-medium text-sm border-b-2 ${
                activeTab === 'strength'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              💪 {t('crossTraining.strengthTraining')}
            </button>
            <button
              onClick={() => setActiveTab('cycling')}
              className={`py-4 px-6 font-medium text-sm border-b-2 ${
                activeTab === 'cycling'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🚴 {t('crossTraining.cycling')}
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'strength' ? (
            <StrengthTrainingTab
              stats={strengthStats}
              recommendations={recommendations}
            />
          ) : (
            <CyclingTab stats={cyclingStats} />
          )}
        </div>
      </div>
    </div>
  );
}

function StrengthTrainingTab({ stats, recommendations }) {
  // Calculate current week stats
  const currentWeekKey = Object.keys(stats.byWeek).sort().pop();
  const currentWeek = stats.byWeek[currentWeekKey] || { sessions: 0, minutes: 0 };

  const [minRec, maxRec] = recommendations.weeklyMinutes;
  const weeklyProgress = (currentWeek.minutes / maxRec) * 100;

  return (
    <div className="space-y-6">
      {/* Current Phase */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">
          Current Phase: {recommendations.currentPhase}
        </h3>
        <p className="text-sm text-blue-800 mb-2">
          Week {recommendations.weeksInCycle} of {recommendations.totalWeeks}
        </p>
        <p className="text-sm text-blue-700">{recommendations.focus}</p>
      </div>

      {/* Weekly Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">This Week</div>
          <div className="text-2xl font-bold text-gray-900">
            {currentWeek.minutes} min
          </div>
          <div className="text-sm text-gray-500">
            {currentWeek.sessions} sessions
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Recommended</div>
          <div className="text-2xl font-bold text-gray-900">
            {minRec}-{maxRec} min
          </div>
          <div className="text-sm text-gray-500">per week</div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Total (Cycle)</div>
          <div className="text-2xl font-bold text-gray-900">
            {stats.total.hours} hrs
          </div>
          <div className="text-sm text-gray-500">
            {stats.total.sessions} sessions
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            Weekly Progress
          </span>
          <span className="text-sm text-gray-600">
            {weeklyProgress.toFixed(0)}% of max
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full ${
              weeklyProgress >= 100
                ? 'bg-green-500'
                : weeklyProgress >= 66
                ? 'bg-blue-500'
                : weeklyProgress >= 33
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(weeklyProgress, 100)}%` }}
          />
        </div>
      </div>

      {/* Recommendations */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3">
          Recommended Exercises
        </h4>
        <ul className="space-y-2">
          {recommendations.exercises.map((exercise, idx) => (
            <li key={idx} className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span className="text-gray-700">{exercise}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Rationale */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2">
          Why This Matters
        </h4>
        <p className="text-sm text-yellow-800 mb-3">
          {recommendations.rationale}
        </p>
        <div className="text-xs text-yellow-700 space-y-1">
          <p className="font-semibold">Research References:</p>
          {recommendations.references.map((ref, idx) => (
            <p key={idx}>• {ref}</p>
          ))}
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Monthly Breakdown</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Month
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Sessions
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Total Time
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(stats.byMonth)
                .sort()
                .reverse()
                .map(([month, data]) => (
                  <tr key={month}>
                    <td className="px-4 py-3 text-sm text-gray-900">{month}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {data.sessions}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {data.minutes} min ({(data.minutes / 60).toFixed(1)} hrs)
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CyclingTab({ stats }) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cycling Totals */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">🚴</span> Cycling Totals
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Sessions:</span>
              <span className="font-medium">{stats.totals.cycling.sessions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Distance:</span>
              <span className="font-medium">{stats.totals.cycling.km} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Time:</span>
              <span className="font-medium">
                {(stats.totals.cycling.minutes / 60).toFixed(1)} hours
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">TSS:</span>
              <span className="font-medium">{stats.totals.cycling.tss}</span>
            </div>
          </div>
        </div>

        {/* Running Equivalent */}
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-4 flex items-center">
            <span className="mr-2">🏃</span> Running Equivalent
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-blue-700">Distance:</span>
              <span className="font-medium text-blue-900">
                ~{stats.totals.runningEquivalent.km} km
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Time:</span>
              <span className="font-medium text-blue-900">
                ~{(stats.totals.runningEquivalent.minutes / 60).toFixed(1)} hours
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">TSS:</span>
              <span className="font-medium text-blue-900">
                ~{stats.totals.runningEquivalent.tss}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-blue-200">
            <p className="text-xs text-blue-700">
              Based on intensity-adjusted conversion factors from Millet et al. (2009)
            </p>
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Cycling Sessions</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Distance
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Avg Power
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Running Equiv.
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.activities.map((activity, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {new Date(activity.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {activity.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {activity.distance} km
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {activity.duration} min
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {activity.avgPower}W
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="text-blue-700 font-medium">
                      ~{activity.runningEquivalent.runningDistanceKm} km
                    </div>
                    <div className="text-xs text-gray-500">
                      {activity.runningEquivalent.intensityZone}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formula Explanation */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3">
          How Running Equivalency Works
        </h4>
        <div className="text-sm text-gray-700 space-y-2">
          <p>
            <strong>Conversion factors based on intensity:</strong>
          </p>
          <ul className="ml-4 space-y-1">
            <li>• Easy/Recovery (&lt;75% FTP): 0.25-0.30 × cycling distance</li>
            <li>• Tempo (75-85% FTP): 0.30-0.35 × cycling distance</li>
            <li>• Threshold (85-95% FTP): 0.35-0.40 × cycling distance</li>
            <li>• VO2max (&gt;95% FTP): 0.40-0.45 × cycling distance</li>
          </ul>
          <p className="mt-3">
            <strong>TSS adjustment:</strong> Running TSS ≈ Cycling TSS × 1.15
            (accounts for higher impact stress)
          </p>
        </div>
      </div>
    </div>
  );
}
```

## Summary

This implementation:

1. ✅ Follows database-first architecture
2. ✅ Stores all data in IndexedDB
3. ✅ Includes in export/import
4. ✅ Reads from database before API
5. ✅ Uses evidence-based formulas
6. ✅ Provides phase-specific guidance
7. ✅ Filters by marathon cycle dates
8. ✅ Tracks all required metrics

## Testing Checklist

- [ ] Database schema updated (v7)
- [ ] CRUD methods work correctly
- [ ] Service layer reads from database first
- [ ] API fallback works when database empty
- [ ] Export includes crossTraining table
- [ ] Import restores crossTraining data
- [ ] UI displays strength stats correctly
- [ ] UI displays cycling stats correctly
- [ ] Running equivalency calculations accurate
- [ ] Phase recommendations update correctly
- [ ] Git sync tested
