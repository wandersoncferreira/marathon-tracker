/**
 * Carbohydrate Tracking Utilities
 * Manages carb intake tracking for long runs (>90min)
 */

import { db } from '../services/database';

/**
 * Save carb intake for an activity
 * @param {string} activityId - Activity ID
 * @param {number} carbGrams - Total carbs consumed in grams
 * @param {string} notes - Optional notes
 */
export async function saveCarbIntake(activityId, carbGrams, notes = '') {
  const entry = {
    activityId,
    carbGrams,
    notes,
    timestamp: new Date().toISOString()
  };

  await db.carbTracking.put(entry);
  return entry;
}

/**
 * Get carb intake for an activity
 * @param {string} activityId - Activity ID
 */
export async function getCarbIntake(activityId) {
  return await db.carbTracking.get(activityId);
}

/**
 * Get carb guidelines from database
 */
export async function getCarbGuidelines() {
  try {
    const stored = await db.getConfig('carbGuidelines');
    if (stored) {
      return stored;
    }
  } catch (error) {
    console.error('Error loading carb guidelines from database:', error);
  }

  // Check localStorage for migration (legacy)
  const localStored = localStorage.getItem('carbGuidelines');
  if (localStored) {
    try {
      const guidelines = JSON.parse(localStored);
      // Migrate to database
      await db.setConfig('carbGuidelines', guidelines);
      localStorage.removeItem('carbGuidelines'); // Clean up
      return guidelines;
    } catch (error) {
      console.error('Error migrating carb guidelines:', error);
    }
  }

  // Default guidelines
  const defaults = {
    carbsPer30Min: 22.5, // grams (20-25g range, using midpoint)
    minDurationMinutes: 75, // Only track for runs > 75min
    enabled: true
  };

  // Save defaults to database
  await db.setConfig('carbGuidelines', defaults);
  return defaults;
}

/**
 * Save carb guidelines to database
 * @param {object} guidelines - Guideline configuration
 */
export async function saveCarbGuidelines(guidelines) {
  await db.setConfig('carbGuidelines', guidelines);
}

/**
 * Calculate expected carb intake for an activity
 * @param {number} durationMinutes - Activity duration in minutes
 * @param {object} guidelines - Carb guidelines (required)
 */
export function calculateExpectedCarbs(durationMinutes, guidelines) {
  if (!guidelines || durationMinutes <= guidelines.minDurationMinutes) {
    return 0; // No carbs needed for shorter activities
  }

  // Calculate how many 30-minute periods throughout the run
  // For a 93min run with gels every 30min: at 30, 60, 90 = 3 gels
  const periods = Math.floor(durationMinutes / 30);

  return Math.round(periods * guidelines.carbsPer30Min);
}

/**
 * Calculate compliance for an activity
 * @param {number} actualCarbs - Actual carbs consumed
 * @param {number} expectedCarbs - Expected carbs based on duration
 */
export function calculateCompliance(actualCarbs, expectedCarbs) {
  if (expectedCarbs === 0) {
    return null; // Not applicable for short activities
  }

  const percentage = (actualCarbs / expectedCarbs) * 100;

  // Determine compliance level
  let level = 'poor';
  if (percentage >= 90) {
    level = 'excellent'; // Within 10% of target
  } else if (percentage >= 70) {
    level = 'good'; // Within 30% of target
  } else if (percentage >= 50) {
    level = 'fair'; // Within 50% of target
  }

  return {
    percentage: Math.round(percentage),
    level,
    actual: actualCarbs,
    expected: expectedCarbs,
    difference: actualCarbs - expectedCarbs
  };
}

/**
 * Get carb tracking data for date range
 * @param {string} startDate - ISO date string (YYYY-MM-DD)
 * @param {string} endDate - ISO date string (YYYY-MM-DD)
 * @param {Array} activities - Array of activities
 * @param {object} guidelines - Carb guidelines (required)
 */
export async function getCarbTrackingForRange(startDate, endDate, activities, guidelines) {
  if (!guidelines) {
    console.error('getCarbTrackingForRange: guidelines parameter is required');
    return [];
  }

  // Filter activities > minDurationMinutes
  const longActivities = activities.filter(a => {
    const duration = a.moving_time ? a.moving_time / 60 : 0;
    return duration > guidelines.minDurationMinutes;
  });

  // Get carb tracking data for these activities
  const trackingData = await Promise.all(
    longActivities.map(async (activity) => {
      const carbData = await getCarbIntake(activity.id);
      const duration = activity.moving_time ? activity.moving_time / 60 : 0;
      const expected = calculateExpectedCarbs(duration, guidelines);

      return {
        activityId: activity.id,
        date: activity.start_date_local,
        name: activity.name,
        duration: Math.round(duration),
        expected: expected,
        actual: carbData ? carbData.carbGrams : null,
        tracked: !!carbData,
        compliance: carbData ? calculateCompliance(carbData.carbGrams, expected) : null
      };
    })
  );

  return trackingData;
}

/**
 * Calculate weekly carb adherence statistics
 * @param {Array} trackingData - Tracking data from getCarbTrackingForRange
 */
export function calculateWeeklyCarbStats(trackingData) {
  const byWeek = {};

  trackingData.forEach(entry => {
    // Get week start (Monday)
    const date = new Date(entry.date.split('T')[0] + 'T12:00:00');
    const dayOfWeek = date.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - daysToMonday);

    const weekKey = weekStart.toISOString().split('T')[0];

    if (!byWeek[weekKey]) {
      byWeek[weekKey] = {
        totalActivities: 0,
        trackedActivities: 0,
        compliantActivities: 0, // >= 70%
        totalExpected: 0,
        totalActual: 0
      };
    }

    byWeek[weekKey].totalActivities++;

    if (entry.tracked) {
      byWeek[weekKey].trackedActivities++;
      byWeek[weekKey].totalExpected += entry.expected;
      byWeek[weekKey].totalActual += entry.actual;

      if (entry.compliance && entry.compliance.percentage >= 70) {
        byWeek[weekKey].compliantActivities++;
      }
    }
  });

  // Calculate percentages
  Object.keys(byWeek).forEach(week => {
    const data = byWeek[week];
    data.trackingPercentage = data.totalActivities > 0
      ? Math.round((data.trackedActivities / data.totalActivities) * 100)
      : 0;
    data.compliancePercentage = data.trackedActivities > 0
      ? Math.round((data.compliantActivities / data.trackedActivities) * 100)
      : 0;
    data.overallCompliance = data.totalExpected > 0
      ? Math.round((data.totalActual / data.totalExpected) * 100)
      : 0;
  });

  return byWeek;
}

/**
 * Calculate cycle-wide carb adherence statistics
 * @param {Array} trackingData - Tracking data from getCarbTrackingForRange
 */
export function calculateCycleCarbStats(trackingData) {
  const stats = {
    totalActivities: trackingData.length,
    trackedActivities: trackingData.filter(e => e.tracked).length,
    compliantActivities: trackingData.filter(e => e.compliance && e.compliance.percentage >= 70).length,
    totalExpected: trackingData.reduce((sum, e) => sum + e.expected, 0),
    totalActual: trackingData.filter(e => e.tracked).reduce((sum, e) => sum + e.actual, 0)
  };

  stats.trackingPercentage = stats.totalActivities > 0
    ? Math.round((stats.trackedActivities / stats.totalActivities) * 100)
    : 0;

  stats.compliancePercentage = stats.trackedActivities > 0
    ? Math.round((stats.compliantActivities / stats.trackedActivities) * 100)
    : 0;

  stats.overallCompliance = stats.totalExpected > 0
    ? Math.round((stats.totalActual / stats.totalExpected) * 100)
    : 0;

  // Determine message
  let message = '';
  if (stats.trackingPercentage < 50) {
    message = 'Start tracking more consistently to see meaningful progress.';
  } else if (stats.compliancePercentage >= 80) {
    message = 'Excellent carb supplementation adherence! 🌟';
  } else if (stats.compliancePercentage >= 60) {
    message = 'Good adherence to carb guidelines. Keep it up! 💪';
  } else {
    message = 'Focus on hitting your carb targets on long runs. 🎯';
  }

  stats.message = message;

  return stats;
}

export default {
  saveCarbIntake,
  getCarbIntake,
  getCarbGuidelines,
  saveCarbGuidelines,
  calculateExpectedCarbs,
  calculateCompliance,
  getCarbTrackingForRange,
  calculateWeeklyCarbStats,
  calculateCycleCarbStats
};
