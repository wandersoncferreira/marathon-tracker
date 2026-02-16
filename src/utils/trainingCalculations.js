/**
 * Training Calculations Utility
 * Functions for analyzing training data and calculating metrics
 */

/**
 * Convert pace string (MM:SS/km) to seconds per km
 */
export function paceToSeconds(pace) {
  if (!pace) return 0;
  const match = pace.match(/(\d+):(\d+)/);
  if (!match) return 0;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

/**
 * Convert seconds per km to pace string (MM:SS/km)
 */
export function secondsToPace(seconds) {
  if (!seconds) return '0:00/km';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}/km`;
}

/**
 * Convert meters per second to pace string (MM:SS/km)
 */
export function metersPerSecondToPace(mps) {
  if (!mps || mps === 0) return '0:00/km';
  const secondsPerKm = 1000 / mps;
  return secondsToPace(secondsPerKm);
}

/**
 * Calculate if pace is within marathon pace range
 */
export function isMarathonPace(pace, targetPace, toleranceSeconds = 5) {
  const paceSeconds = typeof pace === 'string' ? paceToSeconds(pace) : pace;
  const targetSeconds = typeof targetPace === 'string' ? paceToSeconds(targetPace) : targetPace;

  return Math.abs(paceSeconds - targetSeconds) <= toleranceSeconds;
}

/**
 * Classify training zone based on pace
 */
export function classifyTrainingZone(paceSecondsPerKm, options = {}) {
  const {
    marathonPace = 242, // 4:02/km in seconds
    thresholdMin = 220, // 3:40/km
    thresholdMax = 235, // 3:55/km
    easyMin = 285, // 4:45/km
  } = options;

  if (paceSecondsPerKm < thresholdMin) {
    return 'speed'; // Faster than threshold = VO2max/speed
  } else if (paceSecondsPerKm >= thresholdMin && paceSecondsPerKm <= thresholdMax) {
    return 'threshold';
  } else if (Math.abs(paceSecondsPerKm - marathonPace) <= 5) {
    return 'marathon_pace';
  } else if (paceSecondsPerKm >= easyMin) {
    return 'easy';
  } else {
    return 'tempo'; // Between threshold and easy
  }
}

/**
 * Calculate KM at marathon pace from activities
 * @param {Array} activities - Activities with intervals
 * @param {string} targetPace - Target pace (e.g., '4:02/km')
 * @param {number} tolerance - Tolerance in seconds (e.g., 6)
 * @param {number} minDistance - Minimum segment distance in meters (default 200m)
 */
export function calculateKmAtMarathonPace(activities, targetPace = '4:02/km', tolerance = 6, minDistance = 200) {
  const targetSeconds = paceToSeconds(targetPace);
  let totalKm = 0;

  activities.forEach(activity => {
    if (activity.type !== 'Run') return;

    // Only analyze activities with intervals
    if (activity.intervals && activity.intervals.length > 0) {
      activity.intervals.forEach(interval => {
        const distance = interval.distance || 0;

        // Only count segments >= minimum distance (default 200m)
        if (distance >= minDistance && interval.average_speed) {
          const intervalPace = 1000 / interval.average_speed; // seconds per km
          if (isMarathonPace(intervalPace, targetSeconds, tolerance)) {
            totalKm += distance / 1000;
          }
        }
      });
    }
  });

  return Math.round(totalKm * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate KM at threshold pace from activities
 * Threshold is defined as 3:40-3:55/km (220-235 seconds/km)
 * @param {Array} activities - Activities with intervals
 * @param {number} minDistance - Minimum segment distance in meters (default 200m)
 */
export function calculateKmAtThreshold(activities, minDistance = 200) {
  const thresholdMin = 220; // 3:40/km in seconds
  const thresholdMax = 235; // 3:55/km in seconds
  let totalKm = 0;

  activities.forEach(activity => {
    if (activity.type !== 'Run') return;

    // Only analyze activities with intervals
    if (activity.intervals && activity.intervals.length > 0) {
      activity.intervals.forEach(interval => {
        const distance = interval.distance || 0;

        // Only count segments >= minimum distance (default 200m)
        if (distance >= minDistance && interval.average_speed) {
          const intervalPace = 1000 / interval.average_speed; // seconds per km

          // Check if within threshold range
          if (intervalPace >= thresholdMin && intervalPace <= thresholdMax) {
            totalKm += distance / 1000;
          }
        }
      });
    }
  });

  return Math.round(totalKm * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate KM at easy pace from activities
 * Easy is defined as slower than 4:45/km (>285 seconds/km)
 * @param {Array} activities - Activities with intervals
 * @param {number} minDistance - Minimum segment distance in meters (default 200m)
 */
export function calculateKmAtEasy(activities, minDistance = 200) {
  const easyMin = 285; // 4:45/km in seconds
  let totalKm = 0;

  activities.forEach(activity => {
    if (activity.type !== 'Run') return;

    // Only analyze activities with intervals
    if (activity.intervals && activity.intervals.length > 0) {
      activity.intervals.forEach(interval => {
        const distance = interval.distance || 0;

        // Only count segments >= minimum distance (default 200m)
        if (distance >= minDistance && interval.average_speed) {
          const intervalPace = 1000 / interval.average_speed; // seconds per km

          // Check if easy pace
          if (intervalPace >= easyMin) {
            totalKm += distance / 1000;
          }
        }
      });
    }
  });

  return Math.round(totalKm * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate weekly volume from activities
 */
export function calculateWeeklyVolume(activities) {
  const weeklyData = {};

  activities.forEach(activity => {
    if (activity.type !== 'Run') return;

    const date = new Date(activity.start_date_local);
    const weekStart = getWeekStart(date);
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = {
        week: weekKey,
        totalKm: 0,
        totalLoad: 0,
        sessions: 0,
        kmAtMP: 0,
        kmAtThreshold: 0,
        kmAtEasy: 0,
      };
    }

    weeklyData[weekKey].totalKm += (activity.distance || 0) / 1000;
    weeklyData[weekKey].totalLoad += activity.icu_training_load || activity.training_load || 0;
    weeklyData[weekKey].sessions += 1;

    // Note: kmAtMP should be calculated separately with intervals (min 200m segments)
    // Classify based on average pace only for threshold and easy
    if (activity.average_speed) {
      const pace = 1000 / activity.average_speed;
      const zone = classifyTrainingZone(pace);
      const km = (activity.distance || 0) / 1000;

      if (zone === 'threshold') weeklyData[weekKey].kmAtThreshold += km;
      if (zone === 'easy') weeklyData[weekKey].kmAtEasy += km;
    }
  });

  return Object.values(weeklyData).sort((a, b) =>
    new Date(a.week) - new Date(b.week)
  );
}

/**
 * Get week start date (Monday)
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  return new Date(d.setDate(diff));
}

/**
 * Calculate progress to goal
 */
export function calculateProgressToGoal(actual, target) {
  if (!target || target === 0) return 0;
  return Math.min(100, Math.round((actual / target) * 100));
}

/**
 * Parse interval data from Intervals.icu format
 */
export function parseIntervalData(intervals) {
  if (!intervals || !Array.isArray(intervals)) return [];

  return intervals.map(interval => ({
    id: interval.id,
    type: interval.type,
    distance: (interval.distance || 0) / 1000,
    duration: interval.moving_time || interval.elapsed_time || 0,
    avgPace: interval.average_speed ?
      metersPerSecondToPace(interval.average_speed) : null,
    avgPower: interval.average_watts || null,
    avgHR: interval.average_heartrate || null,
    avgCadence: interval.average_cadence || null,
    zone: interval.average_speed ?
      classifyTrainingZone(1000 / interval.average_speed) : null,
  }));
}

/**
 * Calculate training intensity distribution from intervals (no minimum distance filter)
 * This gives an accurate picture of ALL running, including warmup/cooldown
 */
export function calculateIntensityDistribution(activities) {
  const distribution = {
    easy: 0,
    tempo: 0,
    marathonPace: 0,
    threshold: 0,
    speed: 0,
  };

  activities.forEach(activity => {
    if (activity.type !== 'Run') return;

    // If activity has intervals, analyze each one
    if (activity.intervals && activity.intervals.length > 0) {
      activity.intervals.forEach(interval => {
        if (interval.average_speed && interval.distance) {
          const pace = 1000 / interval.average_speed; // seconds per km
          const km = interval.distance / 1000;
          const zone = classifyTrainingZone(pace);

          if (zone === 'easy') distribution.easy += km;
          else if (zone === 'tempo') distribution.tempo += km;
          else if (zone === 'marathon_pace') distribution.marathonPace += km;
          else if (zone === 'threshold') distribution.threshold += km;
          else if (zone === 'speed') distribution.speed += km;
        }
      });
    }
  });

  const total = distribution.easy + distribution.tempo + distribution.marathonPace +
                distribution.threshold + distribution.speed;

  return {
    easy: Math.round(distribution.easy * 10) / 10,
    tempo: Math.round(distribution.tempo * 10) / 10,
    marathonPace: Math.round(distribution.marathonPace * 10) / 10,
    threshold: Math.round(distribution.threshold * 10) / 10,
    speed: Math.round(distribution.speed * 10) / 10,
    total: Math.round(total * 10) / 10,
  };
}

/**
 * Format duration in seconds to readable string
 */
export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
