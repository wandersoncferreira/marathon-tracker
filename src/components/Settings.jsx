import { useState, useEffect } from 'react';
import { intervalsApi } from '../services/intervalsApi';
import { analysisLoader } from '../services/analysisLoader';
import { db } from '../services/database';
import { getCycleStats, TRAINING_CYCLE } from '../utils/trainingCycle';
import { formatDateISO } from '../utils/dateHelpers';
import { downloadDatabaseExport, uploadDatabaseImport, getDatabaseExportStats } from '../services/databaseSync';

function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [athleteId, setAthleteId] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dbStats, setDbStats] = useState(null);
  const [fileInputRef, setFileInputRef] = useState(null);
  const [syncingWellness, setSyncingWellness] = useState(false);
  const [exportStats, setExportStats] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dbImportInputRef, setDbImportInputRef] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const config = await intervalsApi.loadConfig();
      setApiKey(config.apiKey || '');
      setAthleteId(config.athleteId || '');

      // Load database stats
      const stats = await intervalsApi.getStats();
      setDbStats(stats);

      // Load export stats
      const expStats = await getDatabaseExportStats();
      setExportStats(expStats);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await intervalsApi.saveConfig(apiKey, athleteId);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      alert(`Error saving configuration: ${error.message}`);
    }
  };

  const handleClearCache = async () => {
    try {
      await intervalsApi.clearCache();
      await loadSettings(); // Reload stats
      alert('Cache cleared successfully!');
    } catch (error) {
      alert(`Error clearing cache: ${error.message}`);
    }
  };

  const handleClearAllData = async () => {
    if (confirm('Are you sure you want to clear ALL training data? This will remove all activities and cache from the database. API configuration will be preserved.')) {
      try {
        await db.clearAll();
        await loadSettings(); // Reload stats
        alert('All training data cleared!');
      } catch (error) {
        alert(`Error clearing data: ${error.message}`);
      }
    }
  };

  const handleImportAnalysis = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      await analysisLoader.importFromFile(file);
      alert('Analysis imported successfully!');
      event.target.value = ''; // Reset file input
    } catch (error) {
      alert(`Error importing analysis: ${error.message}`);
    }
  };

  const handleClearAnalyses = () => {
    if (confirm('Are you sure you want to clear all coach analyses? This cannot be undone.')) {
      analysisLoader.clearAnalyses();
      alert('All analyses cleared!');
    }
  };

  const handleSyncWellness = async () => {
    setSyncingWellness(true);
    try {
      const today = formatDateISO(new Date());
      // Fetch today's wellness data from API (force refresh)
      await intervalsApi.getWellnessData(today, today, false);
      await loadSettings(); // Refresh stats
      alert('Today\'s wellness data synced successfully!');
    } catch (error) {
      alert(`Error syncing wellness data: ${error.message}`);
    } finally {
      setSyncingWellness(false);
    }
  };

  const handleExportDatabase = async () => {
    if (!confirm('Export entire database to JSON file? This will download a large file (~400MB) that you can commit to git and sync across computers.')) {
      return;
    }

    setExporting(true);
    try {
      await downloadDatabaseExport();
      alert('Database exported successfully! Save this file to data/database/ in your repository and commit it to git.');
    } catch (error) {
      alert(`Error exporting database: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImportDatabase = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm('Import database from file? This will REPLACE all existing data (activities, wellness, intervals). Make sure you have a backup!')) {
      event.target.value = '';
      return;
    }

    setImporting(true);
    try {
      const imported = await uploadDatabaseImport(file, true); // clearExisting = true
      await loadSettings(); // Refresh stats
      alert(`Database imported successfully!\n\nImported:\n- ${imported.activities} activities\n- ${imported.activityDetails} activity details\n- ${imported.wellness} wellness records\n- ${imported.analyses} analyses`);
      event.target.value = ''; // Reset file input
    } catch (error) {
      alert(`Error importing database: ${error.message}`);
      event.target.value = '';
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>
      </div>

      {/* Intervals.icu Configuration */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Intervals.icu API</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter your Intervals.icu API key"
            />
            <p className="mt-1 text-xs text-gray-500">
              Find your API key at intervals.icu → Settings → Developer
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Athlete ID
            </label>
            <input
              type="text"
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="e.g., i12345678"
            />
            <p className="mt-1 text-xs text-gray-500">
              Your athlete ID from your Intervals.icu profile URL
            </p>
          </div>

          <button
            onClick={handleSave}
            className="btn-primary w-full"
          >
            {saved ? '✓ Saved!' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Training Cycle */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Training Cycle - Porto Alegre 2026</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-700">Cycle Start</span>
            <span className="font-semibold text-gray-900">{TRAINING_CYCLE.startDate}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-700">Race Date</span>
            <span className="font-semibold text-gray-900">{TRAINING_CYCLE.raceDate}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-700">Total Weeks</span>
            <span className="font-semibold text-gray-900">{TRAINING_CYCLE.totalWeeks} weeks</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-700">Goal Time</span>
            <span className="font-semibold text-primary-600">2:50:00</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-700">Goal Pace</span>
            <span className="font-semibold text-primary-600">4:02/km</span>
          </div>
        </div>
        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
          <p className="font-medium mb-2">Training Phases:</p>
          <ul className="space-y-1">
            <li>• Weeks 1-4: Base Build</li>
            <li>• Weeks 5-8: Build</li>
            <li>• Weeks 9-16: Peak</li>
            <li>• Weeks 17-20: Taper</li>
          </ul>
        </div>
      </div>

      {/* Coach Analysis Management */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Coach Analysis</h3>
        <div className="space-y-3">
          <div>
            <label htmlFor="analysisFile" className="btn-secondary w-full block text-center cursor-pointer">
              📁 Import Analysis JSON
            </label>
            <input
              id="analysisFile"
              type="file"
              accept=".json"
              onChange={handleImportAnalysis}
              className="hidden"
              ref={(ref) => setFileInputRef(ref)}
            />
            <p className="mt-2 text-xs text-gray-500">
              Import coach analysis JSON files to track your progress
            </p>
          </div>

          <button
            onClick={handleClearAnalyses}
            className="w-full px-4 py-2 bg-red-50 text-red-700 font-medium rounded-lg hover:bg-red-100 transition-colors"
          >
            Clear All Analyses
          </button>
        </div>
      </div>

      {/* Database Statistics */}
      {dbStats && (
        <div className="card bg-blue-50 border-blue-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Database Statistics</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-600">Activities</p>
              <p className="text-xl font-bold text-gray-900">{dbStats.activities}</p>
            </div>
            <div>
              <p className="text-gray-600">Activity Details</p>
              <p className="text-xl font-bold text-gray-900">{dbStats.activityDetails}</p>
            </div>
            <div>
              <p className="text-gray-600">Wellness Records</p>
              <p className="text-xl font-bold text-gray-900">{dbStats.wellness}</p>
            </div>
            <div>
              <p className="text-gray-600">Coach Analyses</p>
              <p className="text-xl font-bold text-gray-900">{dbStats.analyses}</p>
            </div>
            <div>
              <p className="text-gray-600">Cache Entries</p>
              <p className="text-xl font-bold text-gray-900">{dbStats.cache}</p>
            </div>
          </div>
          <button
            onClick={loadSettings}
            className="mt-3 text-sm text-blue-600 hover:text-blue-700"
          >
            🔄 Refresh Stats
          </button>
        </div>
      )}

      {/* Database Sync for Multi-Computer */}
      <div className="card bg-purple-50 border-purple-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">🔄 Database Sync (Multi-Computer)</h3>
        <p className="text-sm text-gray-700 mb-4">
          Export your database to a JSON file, commit it to git, and import on other computers. This prevents re-fetching all interval data from Intervals.icu.
        </p>

        {exportStats && (
          <div className="bg-white rounded-lg p-3 mb-4 text-sm">
            <p className="font-medium text-gray-900 mb-2">Export Size Preview:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-600">Activities:</span>
                <span className="ml-2 font-semibold">{exportStats.formatted.activities}</span>
              </div>
              <div>
                <span className="text-gray-600">Intervals:</span>
                <span className="ml-2 font-semibold">{exportStats.formatted.activityDetails}</span>
              </div>
              <div>
                <span className="text-gray-600">Wellness:</span>
                <span className="ml-2 font-semibold">{exportStats.formatted.wellness}</span>
              </div>
              <div>
                <span className="text-gray-600">Analyses:</span>
                <span className="ml-2 font-semibold">{exportStats.formatted.analyses}</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200">
              <span className="text-gray-900 font-semibold">Total Export Size:</span>
              <span className="ml-2 text-purple-600 font-bold">{exportStats.formatted.total}</span>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleExportDatabase}
            disabled={exporting}
            className="btn-primary w-full disabled:opacity-50 bg-purple-600 hover:bg-purple-700"
          >
            {exporting ? '⏳ Exporting...' : '📤 Export Database to JSON'}
          </button>
          <p className="text-xs text-gray-600">
            Downloads a JSON file with all your data. Save to <code className="bg-gray-200 px-1 rounded">data/database/</code> and commit to git.
          </p>

          <div className="border-t border-purple-200 pt-3">
            <label htmlFor="dbImportFile" className="btn-secondary w-full block text-center cursor-pointer">
              📥 Import Database from JSON
            </label>
            <input
              id="dbImportFile"
              type="file"
              accept=".json"
              onChange={handleImportDatabase}
              disabled={importing}
              className="hidden"
              ref={(ref) => setDbImportInputRef(ref)}
            />
            <p className="mt-2 text-xs text-gray-600">
              {importing ? '⏳ Importing database...' : 'Replaces all local data with imported database. Use this when switching computers.'}
            </p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-800">
          <p className="font-medium mb-1">💡 Workflow for multi-computer sync:</p>
          <ol className="space-y-1 ml-4 list-decimal">
            <li>On Computer A: Export database → save to data/database/</li>
            <li>Commit and push to git</li>
            <li>On Computer B: Pull from git → Import database</li>
            <li>Continue training on Computer B</li>
            <li>Repeat as needed across computers</li>
          </ol>
        </div>
      </div>

      {/* Data Management */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Management</h3>
        <div className="space-y-3">
          <button
            onClick={handleSyncWellness}
            disabled={syncingWellness}
            className="btn-primary w-full disabled:opacity-50"
          >
            {syncingWellness ? '⏳ Syncing...' : '💪 Sync Today\'s Wellness'}
          </button>
          <p className="text-xs text-gray-500 mb-3">
            Force refresh today's wellness data (sleep, HRV, resting HR) from Intervals.icu
          </p>

          <button
            onClick={handleClearCache}
            className="btn-secondary w-full"
          >
            Clear API Cache
          </button>
          <p className="text-xs text-gray-500 mb-3">
            Clear temporary cache to force refresh from API
          </p>

          <button
            onClick={handleClearAllData}
            className="w-full px-4 py-2 bg-red-50 text-red-700 font-medium rounded-lg hover:bg-red-100 transition-colors"
          >
            Clear All Training Data
          </button>
          <p className="text-xs text-gray-500">
            Remove all activities and cache from database (keeps API config)
          </p>
        </div>
      </div>

      {/* About */}
      <div className="card bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">About</h3>
        <p className="text-sm text-gray-600 mb-2">
          Marathon Training Tracker for Porto Alegre 2026
        </p>
        <p className="text-xs text-gray-500 mb-3">
          Track your journey to a sub-2h50 marathon with AI-powered coaching analysis
        </p>
        <div className="text-xs text-gray-400">
          <p>💾 Local database: IndexedDB via Dexie.js</p>
          <p>📁 Coach analyses: JSON files</p>
          <p>🔌 API: Intervals.icu</p>
        </div>
      </div>
    </div>
  );
}

export default Settings;
