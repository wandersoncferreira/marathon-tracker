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

    // Version 6 - Add events/planned workouts table
    this.version(6).stores({
      events: 'id, start_date_local, category', // Primary key: event id, indexed by start date and category
    });

    // Version 7 - Add cross training table (cycling, strength)
    this.version(7).stores({
      crossTraining: 'id, date, type, start_date_local, *tags', // Primary key: activity id, indexed by date, type, start_date_local
    });

    // Version 8 - Add nutrition tracking table
    this.version(8).stores({
      nutritionTracking: 'date, rating, adherence, dayType', // Primary key: date (YYYY-MM-DD), indexed by rating, adherence, dayType
    });

    // Access tables
    this.config = this.table('config');
    this.activities = this.table('activities');
    this.activityDetails = this.table('activityDetails');
    this.wellness = this.table('wellness');
    this.cache = this.table('cache');
    this.analyses = this.table('analyses');
    this.activityMessages = this.table('activityMessages');
    this.events = this.table('events');
    this.crossTraining = this.table('crossTraining');
    this.nutritionTracking = this.table('nutritionTracking');
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
      // Ensure endDate includes the entire day by adding time component if needed
      // This handles cases where activities have timestamps (e.g., "2026-02-17T05:43:06")
      let adjustedEndDate = endDate;
      if (!endDate.includes('T')) {
        // If endDate is just a date (YYYY-MM-DD), make it inclusive by adding end-of-day time
        adjustedEndDate = endDate + 'T23:59:59';
      }

      return await this.activities
        .where('start_date_local')
        .between(startDate, adjustedEndDate, true, true)
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
   * Get the most recent activity date in the database
   * Returns date in YYYY-MM-DD format
   */
  async getLatestActivityDate() {
    try {
      const latest = await this.activities
        .orderBy('start_date_local')
        .reverse()
        .first();
      if (!latest) return null;

      // Extract date portion only (YYYY-MM-DD) from ISO timestamp
      const dateStr = latest.start_date_local;
      if (dateStr.includes('T')) {
        return dateStr.split('T')[0];
      }
      return dateStr;
    } catch (error) {
      console.error('Error getting latest activity date:', error);
      return null;
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
   * Store events/planned workouts
   */
  async storeEvents(events) {
    try {
      if (events && events.length > 0) {
        await this.events.bulkPut(events);
      }
      return true;
    } catch (error) {
      console.error('Error storing events:', error);
      return false;
    }
  }

  /**
   * Get events for a date range
   */
  async getEvents(startDate, endDate) {
    try {
      return await this.events
        .where('start_date_local')
        .between(startDate, endDate + 'T23:59:59', true, true)
        .toArray();
    } catch (error) {
      console.error('Error getting events:', error);
      return [];
    }
  }

  /**
   * Delete events in a date range (useful for refreshing)
   */
  async deleteEvents(startDate, endDate) {
    try {
      const events = await this.getEvents(startDate, endDate);
      const eventIds = events.map(e => e.id);
      await this.events.bulkDelete(eventIds);
      return true;
    } catch (error) {
      console.error('Error deleting events:', error);
      return false;
    }
  }

  /**
   * Store cross training activities (bulk)
   */
  async storeCrossTraining(activities) {
    try {
      await this.crossTraining.bulkPut(activities);
      return true;
    } catch (error) {
      console.error('Error storing cross training:', error);
      return false;
    }
  }

  /**
   * Get cross training by date range
   */
  async getCrossTraining(startDate, endDate) {
    try {
      let adjustedEndDate = endDate;
      if (!endDate.includes('T')) {
        adjustedEndDate = endDate + 'T23:59:59';
      }

      const results = await this.crossTraining
        .where('start_date_local')
        .between(startDate, adjustedEndDate, true, true)
        .toArray();

      return results;
    } catch (error) {
      console.error('Error getting cross training:', error);
      return [];
    }
  }

  /**
   * Get cross training by type
   */
  async getCrossTrainingByType(type, startDate, endDate) {
    try {
      const all = await this.getCrossTraining(startDate, endDate);
      return all.filter(a => a.type === type);
    } catch (error) {
      console.error('Error getting cross training by type:', error);
      return [];
    }
  }

  /**
   * Remove duplicate cross training activities and merge their data
   * Combines TSS, power, and other fields from duplicate entries
   */
  async deduplicateCrossTraining() {
    try {
      const all = await this.crossTraining.toArray();
      const uniqueMap = new Map();

      // Helper to check if two activities are duplicates (fuzzy matching)
      const areDuplicates = (a1, a2) => {
        // Must have same name (case insensitive)
        const name1 = (a1.name || '').toLowerCase().trim();
        const name2 = (a2.name || '').toLowerCase().trim();
        if (name1 !== name2) return false;

        // Parse timestamps
        const getTimestamp = (dateStr) => {
          if (!dateStr) return null;
          const cleanDate = dateStr.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
          return new Date(cleanDate).getTime();
        };

        const time1 = getTimestamp(a1.start_date_local);
        const time2 = getTimestamp(a2.start_date_local);

        // Allow up to 4 hours difference to handle timezone offsets
        const timeDiff = Math.abs(time1 - time2);
        const maxTimeDiff = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
        if (timeDiff > maxTimeDiff) return false;

        // Check distance similarity (within 1% or 50 meters, whichever is larger)
        const dist1 = a1.distance || 0;
        const dist2 = a2.distance || 0;
        if (dist1 > 0 && dist2 > 0) {
          const distDiff = Math.abs(dist1 - dist2);
          const distThreshold = Math.max(50, Math.max(dist1, dist2) * 0.01);
          if (distDiff > distThreshold) return false;
        }

        // Check duration similarity (within 2% or 30 seconds, whichever is larger)
        const dur1 = a1.moving_time || a1.elapsed_time || 0;
        const dur2 = a2.moving_time || a2.elapsed_time || 0;
        if (dur1 > 0 && dur2 > 0) {
          const durDiff = Math.abs(dur1 - dur2);
          const durThreshold = Math.max(30, Math.max(dur1, dur2) * 0.02);
          if (durDiff > durThreshold) return false;
        }

        // If all checks pass, these are duplicates
        return true;
      };

      // Group activities by fuzzy matching to find cross-source duplicates
      const contentGroups = [];
      all.forEach(activity => {
        // Try to find an existing group this activity belongs to
        let foundGroup = false;
        for (const group of contentGroups) {
          if (areDuplicates(activity, group[0])) {
            group.push(activity);
            foundGroup = true;
            break;
          }
        }

        // If no matching group found, create a new one
        if (!foundGroup) {
          contentGroups.push([activity]);
        }
      });

      // Merge activities by content (not just ID)
      contentGroups.forEach(group => {
        if (group.length === 0) return;

        // Start with the first activity as base
        let merged = { ...group[0] };

        // Merge data from all copies
        group.slice(1).forEach(activity => {
          // Merge critical fields - prefer non-null, non-zero values
          if (!merged.icu_training_load && activity.icu_training_load) {
            merged.icu_training_load = activity.icu_training_load;
          }
          if (!merged.average_watts && activity.average_watts) {
            merged.average_watts = activity.average_watts;
          }
          if (!merged.icu_ftp && activity.icu_ftp) {
            merged.icu_ftp = activity.icu_ftp;
          }
          if (!merged.run_ftp && activity.run_ftp) {
            merged.run_ftp = activity.run_ftp;
          }
          if (!merged.average_hr && activity.average_hr) {
            merged.average_hr = activity.average_hr;
          }
          if (!merged.moving_time && activity.moving_time) {
            merged.moving_time = activity.moving_time;
          }
          if (!merged.distance && activity.distance) {
            merged.distance = activity.distance;
          }
          if (!merged.weighted_average_watts && activity.weighted_average_watts) {
            merged.weighted_average_watts = activity.weighted_average_watts;
          }

          // For any other fields, prefer the more complete object
          Object.keys(activity).forEach(key => {
            if (merged[key] === null || merged[key] === undefined || merged[key] === 0) {
              if (activity[key] !== null && activity[key] !== undefined && activity[key] !== 0) {
                merged[key] = activity[key];
              }
            }
          });
        });

        // Add merged activity to uniqueMap (use first ID as key)
        uniqueMap.set(merged.id, merged);
      });

      const deduplicated = Array.from(uniqueMap.values());
      const duplicatesRemoved = all.length - deduplicated.length;

      // Always rebuild if we have data (even if no "duplicates" found, ensures clean state)
      if (all.length > 0) {
        // Clear the entire table
        await this.crossTraining.clear();

        // Add back unique activities one by one to ensure proper storage
        for (const activity of deduplicated) {
          await this.crossTraining.put(activity);
        }

        return { removed: duplicatesRemoved, remaining: deduplicated.length };
      }

      return { removed: 0, remaining: 0 };
    } catch (error) {
      return { removed: 0, remaining: 0, error: error.message };
    }
  }

  /**
   * Get latest cross training activity date
   */
  async getLatestCrossTrainingDate() {
    try {
      const latest = await this.crossTraining
        .orderBy('start_date_local')
        .reverse()
        .first();
      if (!latest) return null;

      const dateStr = latest.start_date_local;
      if (dateStr.includes('T')) {
        return dateStr.split('T')[0];
      }
      return dateStr;
    } catch (error) {
      console.error('Error getting latest cross training date:', error);
      return null;
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      const [activitiesCount, detailsCount, wellnessCount, analysesCount, messagesCount, eventsCount, crossTrainingCount, nutritionTrackingCount, cacheCount] = await Promise.all([
        this.activities.count(),
        this.activityDetails.count(),
        this.wellness.count(),
        this.analyses.count(),
        this.activityMessages.count(),
        this.events.count(),
        this.crossTraining.count(),
        this.nutritionTracking.count(),
        this.cache.count(),
      ]);

      return {
        activities: activitiesCount,
        activityDetails: detailsCount,
        wellness: wellnessCount,
        analyses: analysesCount,
        activityMessages: messagesCount,
        events: eventsCount,
        crossTraining: crossTrainingCount,
        nutritionTracking: nutritionTrackingCount,
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
        events: 0,
        crossTraining: 0,
        nutritionTracking: 0,
        cache: 0,
      };
    }
  }
}

// Export singleton instance
export const db = new MarathonTrackerDB();
export default db;
