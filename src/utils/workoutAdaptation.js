/**
 * Workout Adaptation Recommendations
 * Provides smart adjustments to planned workouts based on wellness readiness and recent performance
 */

/**
 * Analyze today's workout performance
 * @param {Object} todayActivity - Today's completed activity
 * @returns {Object} - Performance analysis
 */
export function analyzeTodayPerformance(todayActivity) {
  if (!todayActivity) {
    return {
      completed: false,
      quality: 'unknown',
      concerns: [],
    };
  }

  const concerns = [];
  let quality = 'good';

  // Check if activity has detailed metrics
  const avgHR = todayActivity.average_hr || todayActivity.avg_hr;
  const avgPower = todayActivity.average_watts || todayActivity.avg_power;
  const distance = todayActivity.distance || 0;
  const movingTime = todayActivity.moving_time;

  // Calculate average pace (min/km)
  let avgPace = null;
  if (distance > 0 && movingTime > 0) {
    const paceSecondsPerKm = (movingTime / (distance / 1000));
    avgPace = paceSecondsPerKm;
  }

  // Check for concerning metrics
  if (avgHR && avgHR > 165) {
    concerns.push('High average HR - may indicate elevated effort/stress');
    quality = 'concerning';
  }

  // Check training load
  const load = todayActivity.icu_training_load || todayActivity.training_load || 0;
  if (load > 80) {
    concerns.push('High training load - ensure adequate recovery');
    quality = 'high_load';
  }

  // Check if workout was completed as planned (if intervals exist)
  const intervals = todayActivity.intervals || [];
  if (intervals.length > 0) {
    // Analyze interval consistency
    const workIntervals = intervals.filter(i =>
      i.type === 'WORK' || i.type === 'ACTIVE' || !i.type
    );

    if (workIntervals.length > 0) {
      // Check pace/power variability
      const paces = workIntervals.map(i => i.average_speed).filter(Boolean);
      if (paces.length > 2) {
        const avgPaceInterval = paces.reduce((a, b) => a + b, 0) / paces.length;
        const maxDeviation = Math.max(...paces.map(p => Math.abs(p - avgPaceInterval)));
        const variability = (maxDeviation / avgPaceInterval) * 100;

        if (variability > 10) {
          concerns.push('High pace variability in intervals - pacing inconsistent');
          quality = 'inconsistent';
        }
      }
    }
  }

  return {
    completed: true,
    quality,
    concerns,
    avgHR,
    avgPower,
    avgPace,
    load,
    distance,
  };
}

/**
 * Generate workout adaptation recommendations based on readiness and today's performance
 * @param {Object} plannedWorkout - The planned workout from Intervals.icu
 * @param {Object} readiness - Today's readiness analysis
 * @param {Object} todayPerformance - Analysis of today's completed workout
 * @returns {Object} - Adaptation recommendations
 */
export function generateWorkoutAdaptations(plannedWorkout, readiness, todayPerformance = null) {
  if (!plannedWorkout || !readiness) {
    return null;
  }

  const adaptations = [];
  const warnings = [];
  let recommendation = 'proceed';

  const { score, status, metrics } = readiness;

  // Determine workout intensity from name/description
  const workoutText = `${plannedWorkout.name || ''} ${plannedWorkout.description || ''}`.toLowerCase();
  const isQuality = workoutText.includes('threshold') ||
                    workoutText.includes('tempo') ||
                    workoutText.includes('interval') ||
                    workoutText.includes('speed') ||
                    workoutText.includes('mp') ||
                    workoutText.includes('marathon pace');
  const isLongRun = workoutText.includes('long') ||
                    (plannedWorkout.load && plannedWorkout.load > 80);
  const isEasy = workoutText.includes('easy') ||
                 workoutText.includes('recovery') ||
                 workoutText.includes('jog');

  // Critical readiness flags
  const veryFatigued = metrics.form !== undefined && metrics.form < -20;
  const moderatelyFatigued = metrics.form !== undefined && metrics.form < -10;
  const wellRested = metrics.form !== undefined && metrics.form > 5;

  const elevatedHR = metrics.restingHR !== undefined && metrics.restingHR > 55;
  const poorSleep = metrics.sleepHours !== undefined && metrics.sleepHours < 6;
  const lowHRV = metrics.hrv !== undefined && metrics.hrv < 30;

  // Factor in today's performance
  let performanceImpact = 0;
  if (todayPerformance && todayPerformance.completed) {
    if (todayPerformance.load > 80) {
      performanceImpact -= 10;
      adaptations.push(`📊 Today's load (${todayPerformance.load} TSS) - consider impact on tomorrow`);
    }

    if (todayPerformance.quality === 'concerning' || todayPerformance.quality === 'inconsistent') {
      performanceImpact -= 15;
      adaptations.push('⚠️ Today\'s performance showed stress signals');

      if (todayPerformance.concerns.length > 0) {
        todayPerformance.concerns.forEach(concern => {
          adaptations.push(`  • ${concern}`);
        });
      }
    }

    if (todayPerformance.quality === 'high_load') {
      performanceImpact -= 5;
    }

    // Adjust readiness score based on performance
    if (performanceImpact < 0) {
      adaptations.push(`💡 Recovery consideration: Today's session may affect tomorrow's readiness`);
    }
  }

  // Decision matrix based on readiness and workout type

  // EXCELLENT READINESS (85+)
  if (score >= 85) {
    if (isQuality) {
      adaptations.push('✅ Excellent readiness - execute as planned');
      adaptations.push('💪 Consider pushing the top end of pace ranges');
    } else if (isLongRun) {
      adaptations.push('✅ Good readiness for long run');
      adaptations.push('📈 Can target higher end of volume if feeling strong');
    } else if (isEasy) {
      adaptations.push('✅ Easy day - maintain recovery pace despite feeling good');
      adaptations.push('⚠️ Resist temptation to run harder');
    }
    recommendation = 'proceed';
  }

  // GOOD READINESS (70-84)
  else if (score >= 70) {
    if (isQuality) {
      adaptations.push('✅ Good readiness for quality work');
      adaptations.push('📊 Execute as planned, monitor how body responds');
    } else if (isLongRun) {
      adaptations.push('✅ Proceed with long run as planned');
      if (moderatelyFatigued) {
        adaptations.push('💡 Consider running at lower end of pace range');
      }
    } else if (isEasy) {
      adaptations.push('✅ Easy day - stick to easy pace');
    }
    recommendation = 'proceed';
  }

  // MODERATE READINESS (50-69)
  else if (score >= 50) {
    if (isQuality) {
      adaptations.push('⚠️ Moderate readiness - adjust quality session');

      if (moderatelyFatigued) {
        adaptations.push('📉 Reduce volume by 15-20% OR reduce intensity by 5-10s/km');
        adaptations.push('💡 Shorten intervals and extend recoveries');
      }

      if (poorSleep) {
        adaptations.push('😴 Poor sleep detected - consider reducing intensity');
      }

      if (lowHRV || elevatedHR) {
        adaptations.push('📊 Recovery markers poor - listen to your body during warmup');
        adaptations.push('💡 If HR elevated in first 10min, abort quality work');
      }

      warnings.push('Monitor HR and perceived effort closely');
      recommendation = 'modify';
    } else if (isLongRun) {
      adaptations.push('⚠️ Moderate readiness for long run');
      adaptations.push('📉 Reduce distance by 10-15% OR run slower');
      adaptations.push('💡 Focus on time on feet, not hitting specific paces');
      recommendation = 'modify';
    } else if (isEasy) {
      adaptations.push('✅ Easy day appropriate for current state');
      adaptations.push('💡 Keep HR <75% max, fully conversational');
    }
  }

  // POOR READINESS (<50)
  else {
    if (isQuality) {
      adaptations.push('🛑 Poor readiness - DO NOT do quality work');
      adaptations.push('🔄 Convert to easy run or take rest day');
      adaptations.push('📉 If running, keep HR below 70% max');

      if (veryFatigued) {
        warnings.push('Very high fatigue - strong consideration for complete rest');
      }
      if (elevatedHR) {
        warnings.push('Elevated RHR may indicate illness/overtraining');
      }

      recommendation = 'abort';
    } else if (isLongRun) {
      adaptations.push('🛑 Poor readiness - reschedule long run');
      adaptations.push('💡 Replace with easy 60min or rest completely');
      warnings.push('Pushing through will increase injury/illness risk');
      recommendation = 'abort';
    } else if (isEasy) {
      adaptations.push('⚠️ Even easy run may be too much');
      adaptations.push('💡 Consider 30min easy jog or complete rest');
      adaptations.push('🚶 Walking or very light activity may be better option');
      recommendation = 'modify';
    } else {
      adaptations.push('🛑 Poor readiness - consider rest day');
      recommendation = 'abort';
    }
  }

  // Specific metric-based adjustments
  if (poorSleep && !adaptations.some(a => a.includes('sleep'))) {
    adaptations.push(`😴 Only ${metrics.sleepHours.toFixed(1)}h sleep - prioritize recovery over training`);
  }

  if (metrics.weightChange && Math.abs(metrics.weightChange) > 1.5) {
    adaptations.push(`⚖️ Weight change (${metrics.weightChange > 0 ? '+' : ''}${metrics.weightChange.toFixed(1)}kg) - check hydration`);
  }

  return {
    recommendation, // 'proceed', 'modify', 'abort'
    adaptations,
    warnings,
    readinessScore: score,
    readinessStatus: status,
  };
}

/**
 * Parse workout description to extract key details
 * @param {Object} workout - Workout from Intervals.icu
 * @returns {Object} - Parsed workout details
 */
export function parseWorkoutDetails(workout) {
  if (!workout) return null;

  const name = workout.name || 'Workout';
  const description = workout.description || '';
  const load = workout.load || 0;

  // Extract workout type from name/description
  const text = `${name} ${description}`.toLowerCase();

  let type = 'other';
  if (text.includes('easy') || text.includes('recovery')) type = 'easy';
  else if (text.includes('long')) type = 'long_run';
  else if (text.includes('threshold') || text.includes('tempo')) type = 'threshold';
  else if (text.includes('interval') || text.includes('speed')) type = 'speed';
  else if (text.includes('marathon pace') || text.includes('mp')) type = 'marathon_pace';

  return {
    name,
    description,
    type,
    load,
    date: workout.start_date_local || workout.date,
  };
}
