/**
 * Training Cycle Configuration
 * Porto Alegre Marathon 2026
 */

// Training cycle dates
export const TRAINING_CYCLE = {
  startDate: '2026-01-19',      // Cycle start
  raceDate: '2026-05-31',       // Porto Alegre Marathon
  totalWeeks: 20,               // Full training cycle

  // Phase definitions (weeks from start)
  phases: {
    base: { start: 1, end: 4, name: 'Base Build' },
    build: { start: 5, end: 8, name: 'Build' },
    peak: { start: 9, end: 16, name: 'Peak' },
    taper: { start: 17, end: 20, name: 'Taper' },
  },

  // Marathon goal
  goal: {
    time: '2:50:00',
    pace: '4:02/km',
    paceSeconds: 242,
  },
};

/**
 * Get current training week (1-based)
 */
export function getCurrentTrainingWeek(currentDate = new Date()) {
  const start = new Date(TRAINING_CYCLE.startDate);
  const current = typeof currentDate === 'string' ? new Date(currentDate) : currentDate;

  const diffMs = current - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1; // Week 1 is first week

  return Math.max(1, Math.min(week, TRAINING_CYCLE.totalWeeks));
}

/**
 * Get training phase for a given date or week
 */
export function getTrainingPhase(weekNumber = null, currentDate = null) {
  const week = weekNumber || getCurrentTrainingWeek(currentDate);

  for (const [key, phase] of Object.entries(TRAINING_CYCLE.phases)) {
    if (week >= phase.start && week <= phase.end) {
      return {
        key,
        name: phase.name,
        week,
        weekInPhase: week - phase.start + 1,
        totalWeeksInPhase: phase.end - phase.start + 1,
      };
    }
  }

  return {
    key: 'unknown',
    name: 'Off Season',
    week,
    weekInPhase: 0,
    totalWeeksInPhase: 0,
  };
}

/**
 * Get weeks to race date
 */
export function getWeeksToRace(currentDate = new Date()) {
  const race = new Date(TRAINING_CYCLE.raceDate);
  const current = typeof currentDate === 'string' ? new Date(currentDate) : currentDate;

  const diffMs = race - current;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weeks = Math.ceil(diffDays / 7);

  return Math.max(0, weeks);
}

/**
 * Get days to race date
 */
export function getDaysToRace(currentDate = new Date()) {
  const race = new Date(TRAINING_CYCLE.raceDate);
  const current = typeof currentDate === 'string' ? new Date(currentDate) : currentDate;

  const diffMs = race - current;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, days);
}

/**
 * Format training week display
 */
export function formatTrainingWeek(weekNumber = null, currentDate = null) {
  const week = weekNumber || getCurrentTrainingWeek(currentDate);
  const phase = getTrainingPhase(week);

  return `Week ${week}/${TRAINING_CYCLE.totalWeeks} - ${phase.name}`;
}

/**
 * Get phase description for coach analysis
 */
export function getPhaseDescription(weekNumber = null, currentDate = null) {
  const week = weekNumber || getCurrentTrainingWeek(currentDate);
  const phase = getTrainingPhase(week);

  return `${phase.name} (Week ${week} of ${TRAINING_CYCLE.totalWeeks})`;
}

/**
 * Check if date is within training cycle
 */
export function isWithinCycle(date) {
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  const start = new Date(TRAINING_CYCLE.startDate);
  const race = new Date(TRAINING_CYCLE.raceDate);

  return checkDate >= start && checkDate <= race;
}

/**
 * Get cycle date range for data fetching
 */
export function getCycleDateRange() {
  return {
    startDate: TRAINING_CYCLE.startDate,
    endDate: TRAINING_CYCLE.raceDate,
  };
}

/**
 * Get cycle statistics
 */
export function getCycleStats(currentDate = new Date()) {
  const week = getCurrentTrainingWeek(currentDate);
  const phase = getTrainingPhase(week);
  const weeksToRace = getWeeksToRace(currentDate);
  const daysToRace = getDaysToRace(currentDate);

  const start = new Date(TRAINING_CYCLE.startDate);
  const race = new Date(TRAINING_CYCLE.raceDate);
  const current = typeof currentDate === 'string' ? new Date(currentDate) : currentDate;

  const totalDays = Math.floor((race - start) / (1000 * 60 * 60 * 24));
  const daysCompleted = Math.floor((current - start) / (1000 * 60 * 60 * 24));
  const percentComplete = Math.round((daysCompleted / totalDays) * 100);

  return {
    currentWeek: week,
    totalWeeks: TRAINING_CYCLE.totalWeeks,
    phase: phase.name,
    phaseKey: phase.key,
    weekInPhase: phase.weekInPhase,
    weeksToRace,
    daysToRace,
    percentComplete,
    startDate: TRAINING_CYCLE.startDate,
    raceDate: TRAINING_CYCLE.raceDate,
  };
}

/**
 * Get threshold pace for current phase
 */
export function getThresholdPaceForPhase(weekNumber = null) {
  const week = weekNumber || getCurrentTrainingWeek();

  // From training plan in docs/running-coach-directives.md
  if (week >= 1 && week <= 4) {
    return { min: '3:50/km', max: '3:55/km', phase: 'building' };
  } else if (week >= 5 && week <= 8) {
    return { min: '3:45/km', max: '3:50/km', phase: 'established' };
  } else if (week >= 9 && week <= 11) {
    return { min: '3:40/km', max: '3:45/km', phase: 'peak' };
  } else if (week >= 12 && week <= 14) {
    return { min: '3:45/km', max: '3:50/km', phase: 'taper maintenance' };
  } else {
    return { min: '3:45/km', max: '3:55/km', phase: 'general' };
  }
}

/**
 * Get weekly MP target by phase
 */
export function getWeeklyMPTarget(weekNumber = null) {
  const week = weekNumber || getCurrentTrainingWeek();
  const phase = getTrainingPhase(week);

  // Progressive MP volume targets
  if (phase.key === 'base') {
    return { min: 4, max: 8, target: 6 }; // Base: 4-8km/week
  } else if (phase.key === 'build') {
    return { min: 8, max: 15, target: 12 }; // Build: 8-15km/week
  } else if (phase.key === 'peak') {
    return { min: 15, max: 25, target: 20 }; // Peak: 15-25km/week
  } else if (phase.key === 'taper') {
    return { min: 3, max: 8, target: 5 }; // Taper: 3-8km/week
  }

  return { min: 10, max: 20, target: 15 }; // Default
}

export default TRAINING_CYCLE;
