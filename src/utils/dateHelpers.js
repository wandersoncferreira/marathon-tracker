/**
 * Date Helper Utilities
 */

import { format, parseISO, subDays, startOfWeek, endOfWeek, addWeeks, differenceInWeeks } from 'date-fns';

/**
 * Format date for display
 */
export function formatDate(date, formatStr = 'MMM d, yyyy') {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
}

/**
 * Format date for API (YYYY-MM-DD)
 */
export function formatDateISO(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy-MM-dd');
}

/**
 * Get date range for last N days
 */
export function getLastNDays(days = 30) {
  const end = new Date();
  end.setDate(end.getDate() + 1); // Add 1 day to include today
  const start = subDays(end, days);
  return {
    startDate: formatDateISO(start),
    endDate: formatDateISO(end),
  };
}

/**
 * Get current week range (Monday-Sunday)
 */
export function getCurrentWeek() {
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
  return {
    startDate: formatDateISO(start),
    endDate: formatDateISO(end),
  };
}

/**
 * Get week range for a specific date
 */
export function getWeekRange(date) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const start = startOfWeek(d, { weekStartsOn: 1 });
  const end = endOfWeek(d, { weekStartsOn: 1 });
  return {
    startDate: formatDateISO(start),
    endDate: formatDateISO(end),
  };
}

/**
 * Get week number in training plan
 */
export function getTrainingWeek(raceDate, currentDate = new Date()) {
  const race = typeof raceDate === 'string' ? parseISO(raceDate) : raceDate;
  const current = typeof currentDate === 'string' ? parseISO(currentDate) : currentDate;
  const weeksToRace = differenceInWeeks(race, current);
  return {
    weeksToRace,
    totalWeeks: 15, // Porto Alegre marathon plan
  };
}

/**
 * Generate week labels for charts
 */
export function generateWeekLabels(startDate, weeks) {
  const labels = [];
  let current = typeof startDate === 'string' ? parseISO(startDate) : startDate;

  for (let i = 0; i < weeks; i++) {
    labels.push(formatDate(current, 'MMM d'));
    current = addWeeks(current, 1);
  }

  return labels;
}

/**
 * Get relative time string
 */
export function getRelativeTime(date) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d, 'MMM d');
}
