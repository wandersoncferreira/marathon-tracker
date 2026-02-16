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
   * Get activities for a date range
   * @param {string} startDate - ISO date string (YYYY-MM-DD)
   * @param {string} endDate - ISO date string (YYYY-MM-DD)
   * @param {boolean} useCache - Whether to use cached/database data
   * @returns {Promise<Array>}
   */
  async getActivities(startDate, endDate, useCache = true) {
    // First, try to get from database (no API needed)
    if (useCache) {
      const dbActivities = await db.getActivities(startDate, endDate);
      if (dbActivities.length > 0) {
        console.log(`📊 Loaded ${dbActivities.length} activities from database`);
        return dbActivities;
      }
    }

    // Database is empty, need to fetch from API
    const configured = await this.isConfigured();
    if (!configured) {
      console.log('⚠️ No activities in database and Intervals.icu not configured');
      return []; // Return empty array instead of throwing
    }

    // Fetch from API
    await this.loadConfig();
    const endpoint = `/athlete/${this.config.athleteId}/activities`;
    const params = new URLSearchParams({
      oldest: startDate,
      newest: endDate,
    });

    const data = await this.request(`${endpoint}?${params}`);

    // Filter out STRAVA activities (they are stubs without full data)
    const nonStravaActivities = data.filter(activity => activity.source !== 'STRAVA');

    console.log(`📊 Fetched ${data.length} activities, filtered out ${data.length - nonStravaActivities.length} STRAVA stubs`);

    // Store in database (only non-STRAVA)
    if (nonStravaActivities && nonStravaActivities.length > 0) {
      await db.storeActivities(nonStravaActivities);
    }

    return nonStravaActivities;
  }

  /**
   * Get detailed activity information
   * @param {string} activityId - Activity ID
   * @param {boolean} useCache - Whether to use cached data
   * @returns {Promise<Object>}
   */
  async getActivityDetails(activityId, useCache = true) {
    // Try database first (no API needed)
    if (useCache) {
      const dbDetails = await db.getActivityDetails(activityId);
      if (dbDetails) {
        return dbDetails;
      }
    }

    // Database is empty, need to fetch from API
    const configured = await this.isConfigured();
    if (!configured) {
      console.log('⚠️ No activity details in database and Intervals.icu not configured');
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
   * @param {boolean} useCache - Whether to use database cached data
   * @returns {Promise<Object>}
   */
  async getActivityIntervals(activityId, useCache = true) {
    // Try database first (no API needed)
    if (useCache) {
      const details = await db.getActivityDetails(activityId);
      if (details && details.intervals) {
        return details.intervals;
      }
    }

    // Database is empty, need to fetch from API
    const configured = await this.isConfigured();
    if (!configured) {
      console.log('⚠️ No activity intervals in database and Intervals.icu not configured');
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
   * Get wellness data for a date range
   * @param {string} startDate - ISO date string (YYYY-MM-DD)
   * @param {string} endDate - ISO date string (YYYY-MM-DD)
   * @param {boolean} useCache - Whether to use cached data
   * @returns {Promise<Array>}
   */
  async getWellnessData(startDate, endDate, useCache = true) {
    // First, try to get from database (no API needed)
    if (useCache) {
      const dbWellness = await db.getWellness(startDate, endDate);
      if (dbWellness.length > 0) {
        console.log(`📊 Loaded ${dbWellness.length} wellness records from database`);
        return dbWellness;
      }
    }

    // Database is empty, need to fetch from API
    const configured = await this.isConfigured();
    if (!configured) {
      console.log('⚠️ No wellness data in database and Intervals.icu not configured');
      return []; // Return empty array instead of throwing
    }

    // Fetch from API - use query parameters instead of path
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
   * Sync activities - force refresh from API and update database
   */
  async syncActivities(startDate, endDate) {
    const configured = await this.isConfigured();
    if (!configured) {
      throw new Error('Intervals.icu not configured');
    }

    await this.loadConfig();
    const endpoint = `/athlete/${this.config.athleteId}/activities`;
    const params = new URLSearchParams({
      oldest: startDate,
      newest: endDate,
    });

    const data = await this.request(`${endpoint}?${params}`);

    if (data && data.length > 0) {
      await db.storeActivities(data);
    }

    return data;
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
