import { useState, useEffect } from 'react';
import { intervalsApi } from '../services/intervalsApi';

/**
 * Hook to fetch and manage the weekly training plan from Intervals.icu
 * @param {boolean} autoLoad - Whether to automatically load on mount
 * @returns {Object}
 */
function useWeeklyPlan(autoLoad = true) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Get start of week (Monday) and end of week (Sunday)
   */
  const getWeekRange = () => {
    const today = new Date();
    const currentDay = today.getDay();

    // Calculate Monday (start of week)
    const monday = new Date(today);
    const daysToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    monday.setDate(today.getDate() + daysToMonday);
    monday.setHours(0, 0, 0, 0);

    // Calculate Sunday (end of week)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0]
    };
  };

  /**
   * Fetch the weekly plan from Intervals.icu
   * @param {boolean} forceRefresh - If true, fetch from API instead of cache
   */
  const fetchWeeklyPlan = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const { start, end } = getWeekRange();

      if (forceRefresh) {
        console.log('🔄 Force refreshing weekly plan from API');

        // Check if API is configured for force refresh
        const configured = await intervalsApi.isConfigured();
        if (!configured) {
          setError('Intervals.icu not configured - cannot sync from API');
          setLoading(false);
          return;
        }

        // Fetch from API and update database
        const data = await intervalsApi.getEvents(start, end, false, true);
        console.log(`📊 Synced ${data.length} events from API for week ${start} to ${end}`);

        const workouts = data.filter(event =>
          event.category === 'WORKOUT' || !event.category
        );
        workouts.sort((a, b) => {
          const dateA = new Date(a.start_date_local || a.date);
          const dateB = new Date(b.start_date_local || b.date);
          return dateA - dateB;
        });

        setEvents(workouts);
      } else {
        console.log('📅 Loading weekly plan from database');

        // Load from database only (works even without API configuration)
        const data = await intervalsApi.getEvents(start, end, true, false);

        console.log(`📊 Loaded ${data.length} events from database for week ${start} to ${end}`);

        // Filter for workouts only (not races, notes, etc.)
        const workouts = data.filter(event =>
          event.category === 'WORKOUT' || !event.category
        );

        // Sort by date
        workouts.sort((a, b) => {
          const dateA = new Date(a.start_date_local || a.date);
          const dateB = new Date(b.start_date_local || b.date);
          return dateA - dateB;
        });

        setEvents(workouts);

        // If no events found in database, show helpful message
        if (workouts.length === 0) {
          console.log('ℹ️ No events found in database for current week');
          // Don't set error if no events - just show empty state
        }
      }
    } catch (err) {
      console.error('Error fetching weekly plan:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Refresh the weekly plan (force fetch from API)
   */
  const refresh = () => {
    fetchWeeklyPlan(true);
  };

  useEffect(() => {
    if (autoLoad) {
      fetchWeeklyPlan();
    }
  }, [autoLoad]);

  return {
    events,
    loading,
    error,
    refresh,
    weekRange: getWeekRange()
  };
}

export default useWeeklyPlan;
