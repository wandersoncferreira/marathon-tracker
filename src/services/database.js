/**
 * Local Database using Dexie.js (IndexedDB wrapper)
 * Stores Intervals.icu data, app configuration, and cache
 */

import Dexie from 'dexie';

class MarathonTrackerDB extends Dexie {
  constructor() {
    super('MarathonTrackerDB');

    // Define database schema - version 1 (original)
    this.version(1).stores({
      // App configuration
      config: 'key, value, updatedAt',

      // Activities from Intervals.icu
      activities: 'id, start_date_local, type, distance, moving_time, *tags',

      // Activity details (full data including intervals)
      activityDetails: 'id, fetchedAt',

      // Wellness data
      wellness: '[id+date], date, athlete_id, weight, restingHR, hrv',

      // Cache metadata for API requests
      cache: 'key, data, timestamp, ttl',
    });

    // Version 2 - Drop wellness table (to fix schema issue)
    this.version(2).stores({
      wellness: null, // Drop table
    });

    // Version 3 - Recreate wellness with correct schema
    this.version(3).stores({
      wellness: 'id, date', // Use id as primary key (format: "athleteId/date")
    });

    // Version 4 - Add coach analyses table
    this.version(4).stores({
      analyses: 'activityId, date', // Primary key: activityId, indexed by date
    });

    // Version 5 - Add activity messages table
    this.version(5).stores({
      activityMessages: 'id, activityId, created', // Primary key: message id, indexed by activityId and created date
    });

    // Access tables
    this.config = this.table('config');
    this.activities = this.table('activities');
    this.activityDetails = this.table('activityDetails');
    this.wellness = this.table('wellness');
    this.cache = this.table('cache');
    this.analyses = this.table('analyses');
    this.activityMessages = this.table('activityMessages');
  }

  /**
   * Get configuration value
   */
  async getConfig(key, defaultValue = null) {
    try {
      const record = await this.config.get(key);
      return record ? record.value : defaultValue;
    } catch (error) {
      console.error('Error getting config:', error);
      return defaultValue;
    }
  }

  /**
   * Set configuration value
   */
  async setConfig(key, value) {
    try {
      await this.config.put({
        key,
        value,
        updatedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Error setting config:', error);
      return false;
    }
  }

  /**
   * Delete configuration value
   */
  async deleteConfig(key) {
    try {
      await this.config.delete(key);
      return true;
    } catch (error) {
      console.error('Error deleting config:', error);
      return false;
    }
  }

  /**
   * Store activities (bulk insert/update)
   */
  async storeActivities(activities) {
    try {
      await this.activities.bulkPut(activities);
      return true;
    } catch (error) {
      console.error('Error storing activities:', error);
      return false;
    }
  }

  /**
   * Get activities by date range
   */
  async getActivities(startDate, endDate) {
    try {
      return await this.activities
        .where('start_date_local')
        .between(startDate, endDate, true, true)
        .toArray();
    } catch (error) {
      console.error('Error getting activities:', error);
      return [];
    }
  }

  /**
   * Get all activities (with optional filter)
   */
  async getAllActivities(filter = {}) {
    try {
      let query = this.activities.toCollection();

      if (filter.type) {
        query = this.activities.where('type').equals(filter.type);
      }

      return await query.reverse().sortBy('start_date_local');
    } catch (error) {
      console.error('Error getting all activities:', error);
      return [];
    }
  }

  /**
   * Store activity details
   */
  async storeActivityDetails(activityId, details) {
    try {
      await this.activityDetails.put({
        id: activityId,
        ...details,
        fetchedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Error storing activity details:', error);
      return false;
    }
  }

  /**
   * Get activity details
   */
  async getActivityDetails(activityId) {
    try {
      return await this.activityDetails.get(activityId);
    } catch (error) {
      console.error('Error getting activity details:', error);
      return null;
    }
  }

  /**
   * Store wellness data
   */
  async storeWellness(wellnessData) {
    try {
      await this.wellness.bulkPut(wellnessData);
      return true;
    } catch (error) {
      console.error('Error storing wellness:', error);
      return false;
    }
  }

  /**
   * Get wellness data by date range
   */
  async getWellness(startDate, endDate) {
    try {
      // Note: wellness records use 'id' field for date (format: "YYYY-MM-DD")
      // The schema indexes both 'id' (primary key) and 'date', but data only has 'id'
      return await this.wellness
        .where('id')
        .between(startDate, endDate, true, true)
        .toArray();
    } catch (error) {
      console.error('Error getting wellness:', error);
      return [];
    }
  }

  /**
   * Store coach analysis
   */
  async storeAnalysis(analysis) {
    try {
      await this.analyses.put({
        activityId: analysis.metadata.activityId,
        date: analysis.metadata.date,
        ...analysis,
      });
      return true;
    } catch (error) {
      console.error('Error storing analysis:', error);
      return false;
    }
  }

  /**
   * Get all coach analyses
   */
  async getAllAnalyses() {
    try {
      const analyses = await this.analyses.toArray();
      // Sort by date (newest first)
      return analyses.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (error) {
      console.error('Error getting analyses:', error);
      return [];
    }
  }

  /**
   * Get analysis by activity ID
   */
  async getAnalysisByActivityId(activityId) {
    try {
      return await this.analyses.get(activityId);
    } catch (error) {
      console.error('Error getting analysis:', error);
      return null;
    }
  }

  /**
   * Get analyses by date range
   */
  async getAnalysesByDateRange(startDate, endDate) {
    try {
      return await this.analyses
        .where('date')
        .between(startDate, endDate, true, true)
        .toArray();
    } catch (error) {
      console.error('Error getting analyses by date range:', error);
      return [];
    }
  }

  /**
   * Delete analysis
   */
  async deleteAnalysis(activityId) {
    try {
      await this.analyses.delete(activityId);
      return true;
    } catch (error) {
      console.error('Error deleting analysis:', error);
      return false;
    }
  }

  /**
   * Clear all analyses
   */
  async clearAnalyses() {
    try {
      await this.analyses.clear();
      return true;
    } catch (error) {
      console.error('Error clearing analyses:', error);
      return false;
    }
  }

  /**
   * Get cached data
   */
  async getCached(key) {
    try {
      const record = await this.cache.get(key);
      if (!record) return null;

      // Check if expired
      const now = Date.now();
      if (now - record.timestamp > record.ttl) {
        await this.cache.delete(key);
        return null;
      }

      return record.data;
    } catch (error) {
      console.error('Error getting cache:', error);
      return null;
    }
  }

  /**
   * Set cached data
   */
  async setCached(key, data, ttl = 5 * 60 * 1000) {
    try {
      await this.cache.put({
        key,
        data,
        timestamp: Date.now(),
        ttl,
      });
      return true;
    } catch (error) {
      console.error('Error setting cache:', error);
      return false;
    }
  }

  /**
   * Clear all cached data
   */
  async clearCache() {
    try {
      await this.cache.clear();
      return true;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  }

  /**
   * Clear all data (reset database)
   */
  async clearAll() {
    try {
      await this.activities.clear();
      await this.activityDetails.clear();
      await this.wellness.clear();
      await this.cache.clear();
      // Don't clear config - keep API credentials
      return true;
    } catch (error) {
      console.error('Error clearing database:', error);
      return false;
    }
  }

  /**
   * Store activity messages
   */
  async storeActivityMessages(activityId, messages) {
    try {
      // Delete existing messages for this activity first
      await this.activityMessages.where('activityId').equals(activityId).delete();

      // Store new messages
      if (messages && messages.length > 0) {
        await this.activityMessages.bulkPut(messages);
      }
      return true;
    } catch (error) {
      console.error('Error storing activity messages:', error);
      return false;
    }
  }

  /**
   * Get activity messages by activity ID
   */
  async getActivityMessages(activityId) {
    try {
      return await this.activityMessages
        .where('activityId')
        .equals(activityId)
        .sortBy('created'); // Sort by creation date
    } catch (error) {
      console.error('Error getting activity messages:', error);
      return [];
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      const [activitiesCount, detailsCount, wellnessCount, analysesCount, messagesCount, cacheCount] = await Promise.all([
        this.activities.count(),
        this.activityDetails.count(),
        this.wellness.count(),
        this.analyses.count(),
        this.activityMessages.count(),
        this.cache.count(),
      ]);

      return {
        activities: activitiesCount,
        activityDetails: detailsCount,
        wellness: wellnessCount,
        analyses: analysesCount,
        activityMessages: messagesCount,
        cache: cacheCount,
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return {
        activities: 0,
        activityDetails: 0,
        wellness: 0,
        analyses: 0,
        activityMessages: 0,
        cache: 0,
      };
    }
  }
}

// Export singleton instance
export const db = new MarathonTrackerDB();
export default db;
