/**
 * Intervals.icu API Client
 * Provides methods to fetch training data from Intervals.icu
 * Now uses IndexedDB via Dexie.js for persistent storage
 */

import { db } from './database';

const API_BASE_URL = 'https://intervals.icu/api/v1';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

class IntervalsAPI {
  constructor() {
    this.config = { apiKey: '', athleteId: '' };
    this.configLoaded = false;
  }

  async loadConfig() {
    if (this.configLoaded) return this.config;

    try {
      const apiKey = await db.getConfig('intervals_api_key', '');
      const athleteId = await db.getConfig('intervals_athlete_id', '');
      this.config = { apiKey, athleteId };
      this.configLoaded = true;
      return this.config;
    } catch (error) {
      console.error('Error loading config:', error);
      return { apiKey: '', athleteId: '' };
    }
  }

  async saveConfig(apiKey, athleteId) {
    try {
      await db.setConfig('intervals_api_key', apiKey);
      await db.setConfig('intervals_athlete_id', athleteId);
      this.config = { apiKey, athleteId };
      this.configLoaded = true;
      return true;
    } catch (error) {
      console.error('Error saving config:', error);
      return false;
    }
  }

  async isConfigured() {
    await this.loadConfig();
    return this.config.apiKey && this.config.athleteId;
  }

  async getAuthHeaders() {
    await this.loadConfig();
    if (!this.config.apiKey) {
      throw new Error('API key not configured');
    }
    return {
      'Authorization': `Basic ${btoa(`API_KEY:${this.config.apiKey}`)}`,
      'Content-Type': 'application/json',
    };
  }

  getCacheKey(endpoint) {
    return `intervals_${endpoint}`;
  }

  async request(endpoint, options = {}, retries = 3) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      // Handle 429 rate limit with exponential backoff
      if (response.status === 429 && retries > 0) {
        const delay = (4 - retries) * 1000; // 1s, 2s, 3s
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request(endpoint, options, retries - 1);
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  /**
   * Get activities for a date range from database only (no API fallback)
   * @param {string} startDate - ISO date string (YYYY-MM-DD)
   * @param {string} endDate - ISO date string (YYYY-MM-DD)
   * @returns {Promise<Array>}
   */
  async getActivities(startDate, endDate) {
    const dbActivities = await db.getActivities(startDate, endDate);
    return dbActivities;
  }

  /**
   * Get detailed activity information
   * @param {string} activityId - Activity ID
   * @param {boolean} dbOnly - If true, only read from database (no API fallback)
   * @returns {Promise<Object>}
   */
  async getActivityDetails(activityId, dbOnly = true) {
    // Get from database
    const dbDetails = await db.getActivityDetails(activityId);

    // If dbOnly mode (default), return what we have in database
    if (dbOnly) {
      return dbDetails || null;
    }

    // If database has data, return it
    if (dbDetails) {
      return dbDetails;
    }

    // Database is empty and dbOnly=false, fetch from API
    const configured = await this.isConfigured();
    if (!configured) {
      return null;
    }

    // Fetch from API
    const endpoint = `/activity/${activityId}`;
    const data = await this.request(endpoint);

    // Store in database
    if (data) {
      await db.storeActivityDetails(activityId, data);
    }

    return data;
  }

  /**
   * Get interval data for an activity
   * @param {string} activityId - Activity ID
   * @param {boolean} dbOnly - If true, only read from database (no API fallback)
   * @returns {Promise<Object>}
   */
  async getActivityIntervals(activityId, dbOnly = true) {
    // Get from database
    const details = await db.getActivityDetails(activityId);

    // If dbOnly mode (default), return what we have in database
    if (dbOnly) {
      return details?.intervals || null;
    }

    // If database has data, return it
    if (details && details.intervals) {
      return details.intervals;
    }

    // Database is empty and dbOnly=false, fetch from API
    const configured = await this.isConfigured();
    if (!configured) {
      return null;
    }

    // Fetch from API
    const endpoint = `/activity/${activityId}/intervals`;
    const data = await this.request(endpoint);

    // Store in database permanently (as part of activity details)
    if (data) {
      await db.storeActivityDetails(activityId, { intervals: data });
    }

    return data;
  }

  /**
   * Get messages/notes for an activity
   * @param {string} activityId - Activity ID
   * @param {boolean} dbOnly - If true, only read from database (no API fallback)
   * @returns {Promise<Array>}
   */
  async getActivityMessages(activityId, dbOnly = true) {
    // Get from database
    const dbMessages = await db.getActivityMessages(activityId);

    // If dbOnly mode (default), return what we have in database
    if (dbOnly) {
      return dbMessages;
    }

    // If database has data, return it
    if (dbMessages && dbMessages.length > 0) {
      return dbMessages;
    }

    // Database is empty and dbOnly=false, fetch from API
    const configured = await this.isConfigured();
    if (!configured) {
      return [];
    }

    // Fetch from API
    try {
      const endpoint = `/activity/${activityId}/messages`;
      const data = await this.request(endpoint);

      // Store in database
      if (data && Array.isArray(data)) {
        // Add activityId to each message for database indexing
        const messagesWithActivityId = data.map(msg => ({
          ...msg,
          activityId: activityId
        }));
        await db.storeActivityMessages(activityId, messagesWithActivityId);
        return data;
      }

      return [];
    } catch (error) {
      console.error('Error fetching activity messages:', error);
      return [];
    }
  }

  /**
   * Sync messages for multiple activities (only fetch if not in database)
   * @param {Array} activities - Array of activity objects
   * @param {boolean} forceRefresh - If true, fetch all messages even if cached
   * @returns {Promise<number>} Number of activities with messages synced
   */
  async syncActivityMessages(activities, forceRefresh = false) {
    if (!activities || activities.length === 0) {
      return 0;
    }

    const configured = await this.isConfigured();
    if (!configured) {
      return 0;
    }

    let syncedCount = 0;
    let skippedCount = 0;

    // Fetch messages for each activity (with rate limiting)
    for (const activity of activities) {
      try {
        // Check if messages already exist in database
        if (!forceRefresh) {
          const cachedMessages = await db.getActivityMessages(activity.id);
          if (cachedMessages && cachedMessages.length > 0) {
            skippedCount++;
            continue; // Skip, already have messages
          }
        }

        // Only fetch if not cached or forcing refresh
        await this.getActivityMessages(activity.id, false); // Force fetch from API
        syncedCount++;

        // Rate limiting: wait 100ms between requests to avoid hitting API limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error syncing messages for activity ${activity.id}:`, error);
      }
    }

    if (skippedCount > 0) {
      console.log(`Skipped ${skippedCount} activities with cached messages`);
    }
    if (syncedCount > 0) {
      console.log(`Fetched messages for ${syncedCount} activities`);
    }

    return syncedCount;
  }

  /**
   * Get wellness data for a date range
   * @param {string} startDate - ISO date string (YYYY-MM-DD)
   * @param {string} endDate - ISO date string (YYYY-MM-DD)
   * @param {boolean} dbOnly - If true, only read from database (no API fallback)
   * @returns {Promise<Array>}
   */
  async getWellnessData(startDate, endDate, dbOnly = true) {
    // Get from database
    const dbWellness = await db.getWellness(startDate, endDate);

    // If dbOnly mode (default), return what we have in database
    if (dbOnly) {
      return dbWellness;
    }

    // If database has data, return it
    if (dbWellness.length > 0) {
      return dbWellness;
    }

    // Database is empty and dbOnly=false, fetch from API
    const configured = await this.isConfigured();
    if (!configured) {
      return [];
    }

    // Fetch from API
    await this.loadConfig();
    const endpoint = `/athlete/${this.config.athleteId}/wellness`;
    const params = new URLSearchParams({
      oldest: startDate,
      newest: endDate,
    });
    const data = await this.request(`${endpoint}?${params}`);

    // Store in database
    if (data && data.length > 0) {
      await db.storeWellness(data);
    }

    return data;
  }

  /**
   * Get events (planned workouts) for a date range
   * @param {string} startDate - ISO date string (YYYY-MM-DD)
   * @param {string} endDate - ISO date string (YYYY-MM-DD)
   * @returns {Promise<Array>}
   */
  async getEvents(startDate, endDate) {
    const configured = await this.isConfigured();
    if (!configured) {
      throw new Error('Intervals.icu not configured');
    }

    await this.loadConfig();
    const endpoint = `/athlete/${this.config.athleteId}/events`;
    const params = new URLSearchParams({
      oldest: startDate,
      newest: endDate,
    });

    const data = await this.request(`${endpoint}?${params}`);
    return data || [];
  }

  /**
   * Get the next planned workout (event)
   * @returns {Promise<Object|null>}
   */
  async getNextPlannedWorkout() {
    try {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      const todayStr = today.toISOString().split('T')[0];
      const nextWeekStr = nextWeek.toISOString().split('T')[0];

      const events = await this.getEvents(todayStr, nextWeekStr);

      if (!events || events.length === 0) {
        return null;
      }

      // Find first upcoming workout (not race/other event types)
      const upcomingWorkouts = events.filter(e =>
        e.category === 'WORKOUT' || e.type === 'WORKOUT' || !e.category
      ).sort((a, b) => {
        const dateA = new Date(a.start_date_local || a.date);
        const dateB = new Date(b.start_date_local || b.date);
        return dateA - dateB;
      });

      return upcomingWorkouts[0] || null;
    } catch (error) {
      console.error('Error fetching next workout:', error);
      return null;
    }
  }

  /**
   * Attach interval data from database to activities
   * @param {Array} activities - Activities to attach intervals to
   * @returns {Promise<Array>} Activities with intervals attached
   */
  async attachIntervalsFromDB(activities) {
    const activitiesWithIntervals = await Promise.all(
      activities.map(async (activity) => {
        const details = await db.getActivityDetails(activity.id);
        return {
          ...activity,
          intervals: details?.intervals?.icu_intervals || []
        };
      })
    );
    return activitiesWithIntervals;
  }

  /**
   * Sync activities - force refresh from API and update database
   * @param {string} startDate - ISO date string (YYYY-MM-DD)
   * @param {string} endDate - ISO date string (YYYY-MM-DD)
   * @param {boolean} forceFullSync - If true, sync entire date range. If false, only sync from latest activity date.
   * @returns {Promise<Array>}
   */
  async syncActivities(startDate, endDate, forceFullSync = false) {
    const configured = await this.isConfigured();
    if (!configured) {
      throw new Error('Intervals.icu not configured');
    }

    let syncStartDate = startDate;

    // If not forcing full sync, check for incremental sync
    if (!forceFullSync) {
      const latestDate = await db.getLatestActivityDate();
      if (latestDate) {
        // Start syncing from the day of the latest activity (to catch any updates)
        syncStartDate = latestDate;
        console.log(`Incremental sync: starting from ${syncStartDate} (latest activity in DB)`);
      } else {
        console.log('No activities in database, performing full sync');
      }
    } else {
      console.log('Force full sync requested');
    }

    await this.loadConfig();
    const endpoint = `/athlete/${this.config.athleteId}/activities`;
    const params = new URLSearchParams({
      oldest: syncStartDate,
      newest: endDate,
    });

    const data = await this.request(`${endpoint}?${params}`);

    // Filter out STRAVA activities (they are stubs without full data)
    const nonStravaActivities = data.filter(activity => activity.source !== 'STRAVA');

    if (nonStravaActivities && nonStravaActivities.length > 0) {
      await db.storeActivities(nonStravaActivities);
    }

    return nonStravaActivities;
  }

  /**
   * Clear all cached data
   */
  async clearCache() {
    await db.clearCache();
  }

  /**
   * Get database statistics
   */
  async getStats() {
    return await db.getStats();
  }

  /**
   * Attach interval data from database to activities
   * @param {Array} activities - Array of activities
   * @returns {Promise<Array>}
   */
  async attachIntervalsFromDB(activities) {
    const activitiesWithIntervals = await Promise.all(
      activities.map(async (activity) => {
        const details = await db.getActivityDetails(activity.id);
        if (details && details.intervals) {
          return { ...activity, intervals: details.intervals.icu_intervals || [] };
        }
        return activity;
      })
    );
    return activitiesWithIntervals;
  }
}

// Export singleton instance
export const intervalsApi = new IntervalsAPI();
export default intervalsApi;
