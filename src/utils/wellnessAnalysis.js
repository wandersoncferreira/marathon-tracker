/**
 * Wellness Data Analysis
 * Analyzes wellness metrics to determine training readiness
 */

/**
 * Analyze today's wellness data and provide readiness assessment
 * @param {Object} wellness - Today's wellness data from Intervals.icu
 * @param {Object} baseline - Optional baseline for comparison
 * @returns {Object} - Readiness analysis with score, status, and insights
 */
export function analyzeWellnessReadiness(wellness, baseline = null) {
  if (!wellness) {
    return {
      score: null,
      status: 'unknown',
      message: 'No wellness data available',
      insights: [],
      metrics: {},
    };
  }

  const insights = [];
  const metrics = {};
  let readinessScore = 100;

  // CTL/ATL/TSB Analysis (Fitness/Fatigue/Form)
  const ctl = wellness.ctl || 0; // Chronic Training Load (Fitness)
  const atl = wellness.atl || 0; // Acute Training Load (Fatigue)
  const tsb = ctl - atl; // Training Stress Balance (Form)

  metrics.fitness = ctl;
  metrics.fatigue = atl;
  metrics.form = tsb;

  // Form analysis (-30 to +30 typical range)
  if (tsb < -20) {
    insights.push('⚠️ Very fatigued - consider easy day');
    readinessScore -= 30;
  } else if (tsb < -10) {
    insights.push('😓 Moderately fatigued - monitor recovery');
    readinessScore -= 15;
  } else if (tsb > 5) {
    insights.push('💪 Well rested - good for quality work');
    readinessScore += 10;
  }

  // Resting Heart Rate
  if (wellness.restingHR) {
    metrics.restingHR = wellness.restingHR;

    // Compare to baseline if available
    if (baseline?.restingHR) {
      const hrDiff = wellness.restingHR - baseline.restingHR;
      if (hrDiff > 5) {
        insights.push(`❤️ Elevated RHR (+${hrDiff} bpm) - possible fatigue/illness`);
        readinessScore -= 20;
      } else if (hrDiff < -3) {
        insights.push('❤️ Lower RHR - good recovery');
        readinessScore += 5;
      }
    } else {
      // Generic resting HR assessment
      if (wellness.restingHR > 55) {
        insights.push('❤️ Elevated RHR - monitor for overtraining');
        readinessScore -= 10;
      }
    }
  }

  // HRV (Heart Rate Variability)
  if (wellness.hrv) {
    metrics.hrv = wellness.hrv;

    // Compare to baseline if available
    if (baseline?.hrv) {
      const hrvDiff = wellness.hrv - baseline.hrv;
      const hrvChange = (hrvDiff / baseline.hrv) * 100;

      if (hrvChange < -15) {
        insights.push('📊 HRV significantly down - stress/fatigue detected');
        readinessScore -= 20;
      } else if (hrvChange < -5) {
        insights.push('📊 HRV slightly down - recovery incomplete');
        readinessScore -= 10;
      } else if (hrvChange > 5) {
        insights.push('📊 HRV elevated - excellent recovery');
        readinessScore += 10;
      }
    } else {
      // Generic HRV assessment (higher is generally better)
      if (wellness.hrv < 30) {
        insights.push('📊 Low HRV - consider easy day');
        readinessScore -= 10;
      } else if (wellness.hrv > 60) {
        insights.push('📊 High HRV - well recovered');
        readinessScore += 5;
      }
    }
  }

  // Sleep Quality (if available)
  if (wellness.sleepQuality !== undefined && wellness.sleepQuality !== null) {
    metrics.sleepQuality = wellness.sleepQuality;

    if (wellness.sleepQuality <= 2) {
      insights.push('😴 Poor sleep - recovery compromised');
      readinessScore -= 15;
    } else if (wellness.sleepQuality >= 4) {
      insights.push('😴 Good sleep - ready for training');
      readinessScore += 5;
    }
  }

  // Sleep Hours (if available)
  if (wellness.sleepSecs) {
    const sleepHours = wellness.sleepSecs / 3600;
    metrics.sleepHours = sleepHours;

    if (sleepHours < 6) {
      insights.push(`😴 Low sleep (${sleepHours.toFixed(1)}h) - prioritize rest`);
      readinessScore -= 15;
    } else if (sleepHours >= 8) {
      insights.push(`😴 Good sleep (${sleepHours.toFixed(1)}h)`);
      readinessScore += 5;
    }
  }

  // Weight change (if available and baseline exists)
  if (wellness.weight && baseline?.weight) {
    const weightDiff = wellness.weight - baseline.weight;
    metrics.weight = wellness.weight;
    metrics.weightChange = weightDiff;

    if (Math.abs(weightDiff) > 1.5) {
      insights.push(`⚖️ Weight change (${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(1)}kg) - monitor hydration`);
    }
  } else if (wellness.weight) {
    metrics.weight = wellness.weight;
  }

  // Soreness/Fatigue ratings (if available)
  if (wellness.soreness !== undefined && wellness.soreness !== null) {
    metrics.soreness = wellness.soreness;

    if (wellness.soreness >= 4) {
      insights.push('💪 High soreness - consider recovery day');
      readinessScore -= 10;
    }
  }

  // Mood (if available)
  if (wellness.mood !== undefined && wellness.mood !== null) {
    metrics.mood = wellness.mood;

    if (wellness.mood <= 2) {
      insights.push('😐 Low mood - mental recovery needed');
      readinessScore -= 10;
    }
  }

  // Cap readiness score between 0-100
  readinessScore = Math.max(0, Math.min(100, readinessScore));

  // Determine status based on score
  let status = 'unknown';
  let message = '';

  if (readinessScore >= 85) {
    status = 'excellent';
    message = 'Excellent readiness for quality training';
  } else if (readinessScore >= 70) {
    status = 'good';
    message = 'Good readiness for moderate training';
  } else if (readinessScore >= 50) {
    status = 'moderate';
    message = 'Moderate readiness - monitor intensity';
  } else {
    status = 'poor';
    message = 'Low readiness - prioritize recovery';
  }

  // If no insights, add a neutral message
  if (insights.length === 0) {
    insights.push('📊 Limited wellness data available');
  }

  return {
    score: readinessScore,
    status,
    message,
    insights,
    metrics,
  };
}

/**
 * Calculate baseline wellness metrics from recent history
 * @param {Array} recentWellness - Array of recent wellness data (7-14 days)
 * @returns {Object} - Baseline metrics
 */
export function calculateWellnessBaseline(recentWellness) {
  if (!recentWellness || recentWellness.length === 0) {
    return null;
  }

  const baseline = {};

  // Calculate average resting HR
  const rhrs = recentWellness.filter(w => w.restingHR).map(w => w.restingHR);
  if (rhrs.length > 0) {
    baseline.restingHR = rhrs.reduce((a, b) => a + b, 0) / rhrs.length;
  }

  // Calculate average HRV
  const hrvs = recentWellness.filter(w => w.hrv).map(w => w.hrv);
  if (hrvs.length > 0) {
    baseline.hrv = hrvs.reduce((a, b) => a + b, 0) / hrvs.length;
  }

  // Calculate average weight
  const weights = recentWellness.filter(w => w.weight).map(w => w.weight);
  if (weights.length > 0) {
    baseline.weight = weights.reduce((a, b) => a + b, 0) / weights.length;
  }

  return baseline;
}
