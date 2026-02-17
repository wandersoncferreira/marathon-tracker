/**
 * Custom hook for loading coach analyses
 */

import { useState, useEffect } from 'react';
import { analysisLoader } from '../services/analysisLoader';

/**
 * Sanitize an analysis to ensure it has the correct bilingual format
 * This catches any old-format data that might have slipped through
 */
function sanitizeAnalysis(analysis) {
  if (!analysis) return analysis;

  // Helper to convert string to bilingual object
  const toBilingual = (value) => {
    if (!value) return { en_US: '', pt_BR: '' };
    if (typeof value === 'string') {
      // Old format - use same text for both languages
      return { en_US: value, pt_BR: value };
    }
    if (typeof value === 'object' && (value.en_US || value.pt_BR)) {
      // Already bilingual
      return value;
    }
    return { en_US: '', pt_BR: '' };
  };

  // Helper for array fields - handles both flat arrays and nested bilingual arrays
  const toBilingualArray = (arr) => {
    if (!arr) return [];

    // If it's already an array of strings, return as is
    if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'string') {
      return arr;
    }

    // If it's a nested structure {en_US: [...], pt_BR: [...]}
    if (typeof arr === 'object' && !Array.isArray(arr)) {
      // Return the nested structure as-is - it's valid bilingual format
      if ((arr.en_US && Array.isArray(arr.en_US)) || (arr.pt_BR && Array.isArray(arr.pt_BR))) {
        return arr;
      }
    }

    return [];
  };

  try {
    return {
      ...analysis,
      metadata: {
        ...analysis.metadata,
        activityName: toBilingual(analysis.metadata?.activityName),
      },
      marathonContext: {
        ...analysis.marathonContext,
        currentPhase: toBilingual(analysis.marathonContext?.currentPhase),
      },
      analysis: {
        strengths: toBilingualArray(analysis.analysis?.strengths),
        concerns: toBilingualArray(analysis.analysis?.concerns),
        keyFindings: toBilingualArray(analysis.analysis?.keyFindings),
      },
      recommendations: {
        ...analysis.recommendations,
        nextSession: analysis.recommendations?.nextSession ? (
          Array.isArray(analysis.recommendations.nextSession)
            ? analysis.recommendations.nextSession.map(session => ({
                ...session,
                workout: toBilingual(session.workout),
                rationale: toBilingual(session.rationale),
              }))
            : {
                ...analysis.recommendations.nextSession,
                workout: toBilingual(analysis.recommendations.nextSession.workout),
                rationale: toBilingual(analysis.recommendations.nextSession.rationale),
              }
        ) : null,
        weeklyAdjustments: toBilingualArray(
          analysis.recommendations?.weeklyAdjustments || analysis.recommendations?.weeklyFocus
        ),
        progressionNotes: toBilingual(analysis.recommendations?.progressionNotes),
      },
      verdict: {
        ...analysis.verdict,
        summary: toBilingual(analysis.verdict?.summary),
      },
    };
  } catch (err) {
    console.error('Error sanitizing analysis:', err);
    return analysis;
  }
}

export function useAnalyses(autoLoad = true) {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadAnalyses = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await analysisLoader.getAllAnalyses();
      // Sanitize all analyses before setting state
      const sanitized = data.map(sanitizeAnalysis);
      setAnalyses(sanitized);
    } catch (err) {
      setError(err.message);
      console.error('Error loading analyses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoLoad) {
      loadAnalyses();
    }
  }, []);

  const getLatest = () => {
    return analyses.length > 0 ? analyses[0] : null;
  };

  const getByActivityId = (activityId) => {
    return analyses.find(a => a.metadata.activityId === activityId);
  };

  const addAnalysis = async (data) => {
    try {
      await analysisLoader.addAnalysis(data);
      await loadAnalyses(); // Reload all
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const importFromFile = async (file) => {
    try {
      await analysisLoader.importFromFile(file);
      await loadAnalyses(); // Reload all
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return {
    analyses,
    loading,
    error,
    reload: loadAnalyses,
    getLatest,
    getByActivityId,
    addAnalysis,
    importFromFile,
  };
}

export default useAnalyses;
