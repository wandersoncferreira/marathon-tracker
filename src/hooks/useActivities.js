/**
 * Custom hook for fetching activities from Intervals.icu
 */

import { useState, useEffect } from 'react';
import { intervalsApi } from '../services/intervalsApi';
import { db } from '../services/database';
import { getLastNDays, formatDateISO } from '../utils/dateHelpers';
import { TRAINING_CYCLE } from '../utils/trainingCycle';

export function useActivities(days = 30, autoFetch = true, useFullCycle = false, includeCrossTraining = false) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Default to full training cycle or last N days
  const getDefaultDateRange = () => {
    if (useFullCycle) {
      // Add 1 day to endDate to ensure we get today's activities
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return {
        startDate: TRAINING_CYCLE.startDate,
        endDate: formatDateISO(tomorrow),
      };
    }
    return getLastNDays(days);
  };

  const [dateRange, setDateRange] = useState(getDefaultDateRange());

  const fetchActivities = async (customRange = null) => {
    setLoading(true);
    setError(null);

    try {
      const range = customRange || dateRange;

      if (includeCrossTraining) {
        // Fetch both running activities and cross training activities
        const [runningData, crossTrainingData] = await Promise.all([
          intervalsApi.getActivities(range.startDate, range.endDate),
          db.getCrossTraining(range.startDate, range.endDate)
        ]);

        // Filter running activities
        const runningActivities = runningData.filter(a => a.type === 'Run');

        // Combine and remove duplicates (in case activities appear in both tables)
        const activityMap = new Map();

        // Add all activities to map (will automatically deduplicate by id)
        [...runningActivities, ...crossTrainingData].forEach(activity => {
          activityMap.set(activity.id, activity);
        });

        // Convert back to array and sort by date (newest first)
        const allActivities = Array.from(activityMap.values())
          .sort((a, b) => new Date(b.start_date_local) - new Date(a.start_date_local));

        setActivities(allActivities);
      } else {
        // Only read from database, never call API
        const data = await intervalsApi.getActivities(
          range.startDate,
          range.endDate
        );

        // Filter for running activities only
        const filteredActivities = data
          .filter(a => a.type === 'Run')
          .sort((a, b) => new Date(b.start_date_local) - new Date(a.start_date_local));

        setActivities(filteredActivities);
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching activities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch) {
      fetchActivities();
    }
  }, [dateRange.startDate, dateRange.endDate]);

  const refetch = async () => {
    await intervalsApi.clearCache();
    fetchActivities();
  };

  const sync = async (forceFullSync = false, customStartDate = null) => {
    setLoading(true);
    setError(null);

    try {
      // Force sync from API (requires configuration)
      const configured = await intervalsApi.isConfigured();
      if (!configured) {
        throw new Error('Intervals.icu API not configured - cannot sync from API');
      }

      const syncType = forceFullSync ? 'Force sync' : 'Sync new';
      const startDate = customStartDate || dateRange.startDate;
      const endDate = dateRange.endDate;

      console.log(`🔄 ${syncType} started from ${startDate} to ${endDate}...`);

      // Sync activities (incremental by default, full if forced)
      await intervalsApi.syncActivities(
        startDate,
        endDate,
        forceFullSync
      );

      // After sync, reload activities from database for the date range
      let filteredActivities;
      if (includeCrossTraining) {
        // Fetch both running activities and cross training activities
        const [runningData, crossTrainingData] = await Promise.all([
          intervalsApi.getActivities(dateRange.startDate, dateRange.endDate),
          db.getCrossTraining(dateRange.startDate, dateRange.endDate)
        ]);

        // Filter running activities
        const runningActivities = runningData.filter(a => a.type === 'Run');

        // Combine and remove duplicates
        const activityMap = new Map();
        [...runningActivities, ...crossTrainingData].forEach(activity => {
          activityMap.set(activity.id, activity);
        });

        // Convert back to array and sort by date (newest first)
        filteredActivities = Array.from(activityMap.values())
          .sort((a, b) => new Date(b.start_date_local) - new Date(a.start_date_local));
      } else {
        const allActivities = await intervalsApi.getActivities(
          dateRange.startDate,
          dateRange.endDate
        );

        filteredActivities = allActivities
          .filter(a => a.type === 'Run')
          .sort((a, b) => new Date(b.start_date_local) - new Date(a.start_date_local));
      }

      setActivities(filteredActivities);

      console.log(`✅ ${syncType} completed: ${filteredActivities.length} activities in date range`);

      // Return statistics for the caller
      return {
        activities: filteredActivities.length,
        startDate,
        endDate
      };
    } catch (err) {
      setError(err.message);
      console.error('Error syncing activities:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateDateRange = (newRange) => {
    setDateRange(newRange);
  };

  return {
    activities,
    loading,
    error,
    dateRange,
    refetch,
    sync,
    updateDateRange,
  };
}

export default useActivities;
