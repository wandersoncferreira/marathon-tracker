/**
 * Custom hook for fetching activities from Intervals.icu
 */

import { useState, useEffect } from 'react';
import { intervalsApi } from '../services/intervalsApi';
import { getLastNDays, formatDateISO } from '../utils/dateHelpers';
import { TRAINING_CYCLE } from '../utils/trainingCycle';

export function useActivities(days = 30, autoFetch = true, useFullCycle = false) {
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
      // Only read from database, never call API
      const data = await intervalsApi.getActivities(
        range.startDate,
        range.endDate
      );

      // Filter for running activities only and sort by date (newest first)
      const runningActivities = data
        .filter(a => a.type === 'Run')
        .sort((a, b) => new Date(b.start_date_local) - new Date(a.start_date_local));
      setActivities(runningActivities);
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

  const sync = async (forceFullSync = false) => {
    setLoading(true);
    setError(null);

    try {
      // Force sync from API (requires configuration)
      const configured = await intervalsApi.isConfigured();
      if (!configured) {
        throw new Error('Intervals.icu API not configured - cannot sync from API');
      }

      const syncType = forceFullSync ? 'Full sync' : 'Incremental sync';
      console.log(`🔄 ${syncType} started...`);

      // Sync activities (incremental by default, full if forced)
      await intervalsApi.syncActivities(
        dateRange.startDate,
        dateRange.endDate,
        forceFullSync
      );

      // After sync, reload ALL activities from database for the date range
      const allActivities = await intervalsApi.getActivities(
        dateRange.startDate,
        dateRange.endDate
      );

      const runningActivities = allActivities
        .filter(a => a.type === 'Run')
        .sort((a, b) => new Date(b.start_date_local) - new Date(a.start_date_local));
      setActivities(runningActivities);

      console.log(`✅ ${syncType} completed: ${runningActivities.length} running activities in date range`);

      // Only sync messages during Force Full Sync (not incremental)
      if (forceFullSync) {
        console.log('🔄 Syncing messages (force full sync mode)...');
        intervalsApi.syncActivityMessages(runningActivities, false).catch(err => {
          console.error('Error syncing messages:', err);
        });
      }
    } catch (err) {
      setError(err.message);
      console.error('Error syncing activities:', err);
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
