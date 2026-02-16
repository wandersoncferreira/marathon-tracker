/**
 * Custom hook for loading coach analyses
 */

import { useState, useEffect } from 'react';
import { analysisLoader } from '../services/analysisLoader';

export function useAnalyses(autoLoad = true) {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadAnalyses = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await analysisLoader.getAllAnalyses();
      setAnalyses(data);
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
