/**
 * Nutrition Tracking Utilities
 * Manages daily nutrition adherence tracking and weekly progress
 */

import { db } from '../services/database';

/**
 * Save daily nutrition tracking entry
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @param {object} data - Tracking data
 */
export async function saveDailyTracking(date, data) {

  const entry = {
    date,
    rating: data.rating || 0, // 0-10 scale
    notes: data.notes || '',
    adherence: data.adherence || 'not-set', // 'excellent', 'good', 'poor', 'failed', 'not-set'
    plannedCalories: data.plannedCalories || 0,
    actualCalories: data.actualCalories || 0,
    dayType: data.dayType || 'training',
    timestamp: new Date().toISOString()
  };

  await db.nutritionTracking.put(entry);
  return entry;
}

/**
 * Get daily tracking entry
 * @param {string} date - ISO date string (YYYY-MM-DD)
 */
export async function getDailyTracking(date) {
  return await db.nutritionTracking.get(date);
}

/**
 * Get weekly tracking data
 * @param {string} startDate - ISO date string for week start (Monday)
 */
export async function getWeeklyTracking(startDate) {

  const start = new Date(startDate);
  const dates = [];

  // Get 7 days starting from startDate
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }

  // Fetch all entries for the week
  const entries = await Promise.all(
    dates.map(date => getDailyTracking(date))
  );

  return dates.map((date, index) => ({
    date,
    data: entries[index] || null
  }));
}

/**
 * Calculate weekly adherence statistics
 * @param {Array} weekData - Array of daily tracking entries
 */
export function calculateWeeklyStats(weekData) {
  const validEntries = weekData.filter(day => day.data && day.data.rating > 0);

  if (validEntries.length === 0) {
    return {
      averageRating: 0,
      daysTracked: 0,
      totalDays: 7,
      adherencePercentage: 0,
      onTrack: false,
      message: 'No data tracked yet this week'
    };
  }

  const totalRating = validEntries.reduce((sum, day) => sum + day.data.rating, 0);
  const averageRating = totalRating / validEntries.length;
  const adherencePercentage = (validEntries.length / 7) * 100;

  // Determine if on track (average rating >= 7 and at least 5 days tracked)
  const onTrack = averageRating >= 7 && validEntries.length >= 5;

  let message = '';
  if (averageRating >= 8 && validEntries.length >= 6) {
    message = 'Excellent adherence! You\'re crushing your nutrition goals! 💪';
  } else if (averageRating >= 7 && validEntries.length >= 5) {
    message = 'Great work! You\'re on track with your nutrition plan. Keep it up! 👍';
  } else if (averageRating >= 5) {
    message = 'Making progress, but there\'s room for improvement. Stay focused! 📈';
  } else {
    message = 'Need to improve adherence. Let\'s get back on track this week! 💡';
  }

  return {
    averageRating: averageRating.toFixed(1),
    daysTracked: validEntries.length,
    totalDays: 7,
    adherencePercentage: Math.round(adherencePercentage),
    onTrack,
    message
  };
}

/**
 * Get nutrition goals
 */
export function getNutritionGoals() {
  return {
    primary: 'performance', // 'performance', 'weight-loss', 'muscle-gain', 'maintenance'
    description: 'Optimize performance for sub-2:50 marathon',
    weeklyTarget: 'Maintain 73.5kg while improving power-to-weight ratio',
    calorieStrategy: 'Periodize nutrition based on training load',
    proteinTarget: '1.6-1.8g/kg bodyweight',
    carbTarget: 'High on training days, moderate on rest days',
    expectedOutcome: 'Sustained energy, improved recovery, stable weight'
  };
}

/**
 * Save nutrition goals
 * @param {object} goals - Goal configuration
 */
export function saveNutritionGoals(goals) {
  localStorage.setItem('nutritionGoals', JSON.stringify(goals));
}

/**
 * Load nutrition goals from storage
 */
export function loadNutritionGoals() {
  const stored = localStorage.getItem('nutritionGoals');
  return stored ? JSON.parse(stored) : getNutritionGoals();
}

/**
 * Get current week's Monday date
 */
export function getCurrentWeekStart() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust when day is Sunday
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

/**
 * Get all nutrition tracking data for a date range
 * @param {string} startDate - ISO date string (YYYY-MM-DD)
 * @param {string} endDate - ISO date string (YYYY-MM-DD)
 */
export async function getTrackingByDateRange(startDate, endDate) {
  const entries = await db.nutritionTracking
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();

  return entries;
}

/**
 * Calculate cycle-wide nutrition statistics
 * @param {string} cycleStartDate - Training cycle start date
 * @param {string} cycleEndDate - Training cycle end date (race date)
 */
export async function calculateCycleStats(cycleStartDate, cycleEndDate) {
  try {
    // Calculate total days in cycle
    const start = new Date(cycleStartDate);
    const end = new Date(cycleEndDate);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    const entries = await getTrackingByDateRange(cycleStartDate, cycleEndDate);

    if (entries.length === 0) {
      return {
        totalDays: totalDays,
        daysTracked: 0,
        averageRating: 0,
        adherencePercentage: 0,
        excellentDays: 0,
        goodDays: 0,
        poorDays: 0,
        failedDays: 0,
        message: 'Start tracking to see your cycle progress',
        onTrack: false
      };
    }

    // Calculate statistics
    const daysTracked = entries.length;
    const totalRating = entries.reduce((sum, entry) => sum + (entry.rating || 0), 0);
    const averageRating = totalRating / daysTracked;
    const adherencePercentage = (daysTracked / totalDays) * 100;

    // Count by adherence level
    const excellentDays = entries.filter(e => e.rating >= 8).length;
    const goodDays = entries.filter(e => e.rating >= 6 && e.rating < 8).length;
    const poorDays = entries.filter(e => e.rating >= 4 && e.rating < 6).length;
    const failedDays = entries.filter(e => e.rating > 0 && e.rating < 4).length;

    // Determine overall status
    const onTrack = averageRating >= 7 && adherencePercentage >= 70;

    let message = '';
    if (averageRating >= 8 && adherencePercentage >= 80) {
      message = 'Outstanding nutrition consistency throughout the cycle! 🌟';
    } else if (averageRating >= 7 && adherencePercentage >= 70) {
      message = 'Solid nutrition adherence. Keep up the great work! 💪';
    } else if (averageRating >= 6) {
      message = 'Good progress, but room for improvement in consistency. 📈';
    } else if (adherencePercentage < 50) {
      message = 'Start tracking more consistently to build better habits. 📝';
    } else {
      message = 'Focus on improving nutrition quality and consistency. 🎯';
    }

    return {
      totalDays,
      daysTracked,
      averageRating: averageRating.toFixed(1),
      adherencePercentage: Math.round(adherencePercentage),
      excellentDays,
      goodDays,
      poorDays,
      failedDays,
      message,
      onTrack,
      cycleStartDate,
      cycleEndDate
    };
  } catch (error) {
    console.error('Error calculating cycle stats:', error);
    return null;
  }
}

/**
 * Format date for display
 * @param {string} dateStr - ISO date string
 * @param {string} locale - Locale code (en_US or pt_BR)
 */
export function formatDateDisplay(dateStr, locale = 'en_US') {
  const date = new Date(dateStr + 'T00:00:00');
  const options = { weekday: 'short', month: 'short', day: 'numeric' };

  if (locale === 'pt_BR') {
    return date.toLocaleDateString('pt-BR', options);
  }
  return date.toLocaleDateString('en-US', options);
}

/**
 * Get adherence color for rating
 */
export function getAdherenceColor(rating) {
  if (rating >= 8) return 'green';
  if (rating >= 6) return 'blue';
  if (rating >= 4) return 'yellow';
  if (rating > 0) return 'red';
  return 'gray';
}

export default {
  saveDailyTracking,
  getDailyTracking,
  getWeeklyTracking,
  calculateWeeklyStats,
  getNutritionGoals,
  saveNutritionGoals,
  loadNutritionGoals,
  getCurrentWeekStart,
  formatDateDisplay,
  getAdherenceColor
};
