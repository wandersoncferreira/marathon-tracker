/**
 * Coach Analysis Loader
 * Loads and manages coach analysis JSON files
 */

import { db } from './database';

/**
 * Analysis data schema validation
 */
function validateAnalysis(data) {
  const required = ['version', 'metadata', 'session', 'marathonContext', 'analysis', 'metrics', 'recommendations', 'verdict'];
  for (const field of required) {
    if (!(field in data)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate bilingual format (version 2.0+)
  // Check that activityName is an object with en_US and pt_BR keys
  if (data.metadata && data.metadata.activityName) {
    const activityName = data.metadata.activityName;
    if (typeof activityName === 'string') {
      throw new Error('Analysis uses old schema. Please reimport with bilingual format.');
    }
    if (typeof activityName === 'object' && !activityName.en_US && !activityName.pt_BR) {
      throw new Error('Analysis must include bilingual content (en_US and pt_BR).');
    }
  }

  return true;
}

class AnalysisLoader {
  constructor() {
    this.loaded = false;
    this.migrated = false;
  }

  /**
   * Check if an analysis has the old schema (non-bilingual)
   */
  hasOldSchema(analysis) {
    if (!analysis || !analysis.metadata) return false;
    const activityName = analysis.metadata.activityName;
    return typeof activityName === 'string';
  }

  /**
   * Migrate old schema analyses (clear them to force reload)
   */
  async migrateOldSchema() {
    if (this.migrated) return; // Only migrate once per session

    try {
      const allAnalyses = await db.getAllAnalyses();
      const hasOld = allAnalyses.some(a => this.hasOldSchema(a));

      if (hasOld) {
        console.log('🔄 Detected old non-bilingual analyses - clearing database');
        await db.clearAnalyses();
        console.log('✅ Old analyses cleared - new bilingual analyses will be loaded');
        this.loaded = false; // Force reload
      }

      this.migrated = true;
    } catch (error) {
      console.error('Error during schema migration:', error);
      this.migrated = true; // Don't retry
    }
  }

  /**
   * Migrate from localStorage to database (one-time migration)
   */
  async migrateFromLocalStorage() {
    try {
      const stored = localStorage.getItem('coach_analyses');
      if (stored) {
        const analyses = JSON.parse(stored);
        for (const analysis of analyses) {
          await db.storeAnalysis(analysis);
        }
        localStorage.removeItem('coach_analyses');
        console.log('✅ Migrated analyses from localStorage to database');
      }
    } catch (error) {
      console.error('Error migrating analyses:', error);
    }
  }

  /**
   * Load all analysis files
   */
  async loadAnalyses() {
    try {
      // FIRST: Check for old schema and migrate if needed
      await this.migrateOldSchema();

      // THEN: Migrate from localStorage if needed (one-time)
      await this.migrateFromLocalStorage();

      // FINALLY: Load from database
      this.loaded = true;
      return await db.getAllAnalyses();
    } catch (error) {
      console.error('Error loading analyses:', error);
      return [];
    }
  }

  /**
   * Add a new analysis
   */
  async addAnalysis(analysisData) {
    try {
      validateAnalysis(analysisData);
      await db.storeAnalysis(analysisData);
      return true;
    } catch (error) {
      console.error('Error adding analysis:', error);
      throw error;
    }
  }

  /**
   * Get all analyses
   */
  async getAllAnalyses() {
    // Always check for migration on first load
    if (!this.migrated) {
      await this.migrateOldSchema();
    }

    if (!this.loaded) {
      await this.loadAnalyses();
    }
    return await db.getAllAnalyses();
  }

  /**
   * Get analyses for a date range
   */
  async getAnalysesByDateRange(startDate, endDate) {
    return await db.getAnalysesByDateRange(startDate, endDate);
  }

  /**
   * Get analysis by activity ID
   */
  async getAnalysisByActivityId(activityId) {
    return await db.getAnalysisByActivityId(activityId);
  }

  /**
   * Get analyses by session type
   */
  async getAnalysesByType(sessionType) {
    const all = await this.getAllAnalyses();
    return all.filter(analysis => analysis.session.type === sessionType);
  }

  /**
   * Get latest analysis
   */
  async getLatestAnalysis() {
    const all = await this.getAllAnalyses();
    return all.length > 0 ? all[0] : null;
  }

  /**
   * Get latest recommendations
   */
  async getLatestRecommendations() {
    const latest = await this.getLatestAnalysis();
    return latest ? latest.recommendations : null;
  }

  /**
   * Delete analysis
   */
  async deleteAnalysis(activityId) {
    return await db.deleteAnalysis(activityId);
  }

  /**
   * Get progress metrics summary
   */
  async getProgressSummary(startDate, endDate) {
    const analyses = await this.getAnalysesByDateRange(startDate, endDate);

    const summary = {
      totalKm: 0,
      kmAtMarathonPace: 0,
      kmAtThresholdPace: 0,
      kmAtEasyPace: 0,
      totalSessions: analyses.length,
      avgTrainingLoad: 0,
      sessionsByType: {},
    };

    analyses.forEach(analysis => {
      const { metrics, session } = analysis;
      summary.totalKm += metrics.totalKm || 0;
      summary.kmAtMarathonPace += metrics.kmAtMarathonPace || 0;
      summary.kmAtThresholdPace += metrics.kmAtThresholdPace || 0;
      summary.kmAtEasyPace += metrics.kmAtEasyPace || 0;
      summary.avgTrainingLoad += session.trainingLoad || 0;

      const type = session.type;
      summary.sessionsByType[type] = (summary.sessionsByType[type] || 0) + 1;
    });

    if (analyses.length > 0) {
      summary.avgTrainingLoad = summary.avgTrainingLoad / analyses.length;
    }

    return summary;
  }

  /**
   * Clear all stored analyses
   */
  async clearAnalyses() {
    return await db.clearAnalyses();
  }

  /**
   * Import analysis from JSON file
   */
  async importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          await this.addAnalysis(data);
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsText(file);
    });
  }
}

// Export singleton instance
export const analysisLoader = new AnalysisLoader();
export default analysisLoader;
