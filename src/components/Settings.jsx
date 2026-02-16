import { useState, useEffect } from 'react';
import { intervalsApi } from '../services/intervalsApi';
import { db } from '../services/database';
import { TRAINING_CYCLE } from '../utils/trainingCycle';
import { downloadDatabaseExport, uploadDatabaseImport, getDatabaseExportStats } from '../services/databaseSync';

function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [athleteId, setAthleteId] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dbStats, setDbStats] = useState(null);
  const [exportStats, setExportStats] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dbImportInputRef, setDbImportInputRef] = useState(null);

  // Training cycle configuration
  const [marathonName, setMarathonName] = useState('');
  const [cycleStartDate, setCycleStartDate] = useState('');
  const [raceDate, setRaceDate] = useState('');
  const [goalTimeHours, setGoalTimeHours] = useState('2');
  const [goalTimeMinutes, setGoalTimeMinutes] = useState('50');
  const [goalTimeSeconds, setGoalTimeSeconds] = useState('00');
  const [trainingPhases, setTrainingPhases] = useState([
    { name: 'Base Build', startWeek: 1, endWeek: 4 },
    { name: 'Build', startWeek: 5, endWeek: 8 },
    { name: 'Peak', startWeek: 9, endWeek: 16 },
    { name: 'Taper', startWeek: 17, endWeek: 20 }
  ]);
  const [cycleSaved, setCycleSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const config = await intervalsApi.loadConfig();
      setApiKey(config.apiKey || '');
      setAthleteId(config.athleteId || '');

      // Load training cycle config
      const marathonNameConfig = await db.getConfig('marathon_name', 'Porto Alegre 2026');
      const cycleStartConfig = await db.getConfig('cycle_start_date', '2026-01-19');
      const raceDateConfig = await db.getConfig('race_date', '2026-05-31');
      const goalTimeConfig = await db.getConfig('goal_time', '2:50:00');
      const phasesConfig = await db.getConfig('training_phases', null);

      setMarathonName(marathonNameConfig);
      setCycleStartDate(cycleStartConfig);
      setRaceDate(raceDateConfig);

      // Parse goal time
      const [hours, minutes, seconds] = goalTimeConfig.split(':');
      setGoalTimeHours(hours || '2');
      setGoalTimeMinutes(minutes || '50');
      setGoalTimeSeconds(seconds || '00');

      // Load phases
      if (phasesConfig) {
        setTrainingPhases(phasesConfig);
      }

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

  // Calculate total weeks between two dates
  const calculateTotalWeeks = (start, end) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate - startDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.ceil(diffDays / 7);
  };

  // Calculate goal pace from goal time
  const calculateGoalPace = (hours, minutes, seconds) => {
    const totalSeconds = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
    const marathonDistanceKm = 42.195;
    const paceSecondsPerKm = totalSeconds / marathonDistanceKm;
    const paceMinutes = Math.floor(paceSecondsPerKm / 60);
    const paceSeconds = Math.round(paceSecondsPerKm % 60);
    return {
      formatted: `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}/km`,
      seconds: Math.round(paceSecondsPerKm)
    };
  };

  // Get current total weeks
  const totalWeeks = calculateTotalWeeks(cycleStartDate, raceDate);
  const goalPace = calculateGoalPace(goalTimeHours, goalTimeMinutes, goalTimeSeconds);
  const goalTime = `${goalTimeHours}:${goalTimeMinutes}:${goalTimeSeconds}`;

  const handleSaveCycle = async () => {
    try {
      // Validate dates
      if (!cycleStartDate || !raceDate) {
        alert('Please enter both cycle start date and race date');
        return;
      }

      const start = new Date(cycleStartDate);
      const end = new Date(raceDate);
      if (start >= end) {
        alert('Race date must be after cycle start date');
        return;
      }

      // Validate phases
      const lastPhase = trainingPhases[trainingPhases.length - 1];
      if (lastPhase.endWeek > totalWeeks) {
        alert(`Last training phase ends at week ${lastPhase.endWeek}, but cycle is only ${totalWeeks} weeks long`);
        return;
      }

      // Save to database
      await db.setConfig('marathon_name', marathonName);
      await db.setConfig('cycle_start_date', cycleStartDate);
      await db.setConfig('race_date', raceDate);
      await db.setConfig('goal_time', goalTime);
      await db.setConfig('goal_pace', goalPace.formatted);
      await db.setConfig('goal_pace_seconds', goalPace.seconds);
      await db.setConfig('total_weeks', totalWeeks);
      await db.setConfig('training_phases', trainingPhases);

      setCycleSaved(true);
      setTimeout(() => setCycleSaved(false), 3000);
      alert('Training cycle configuration saved! Please reload the page to see changes across the app.');
    } catch (error) {
      alert(`Error saving cycle configuration: ${error.message}`);
    }
  };

  const handleAddPhase = () => {
    const lastPhase = trainingPhases[trainingPhases.length - 1];
    const newStartWeek = lastPhase ? lastPhase.endWeek + 1 : 1;
    setTrainingPhases([
      ...trainingPhases,
      { name: 'New Phase', startWeek: newStartWeek, endWeek: Math.min(newStartWeek + 3, totalWeeks) }
    ]);
  };

  const handleRemovePhase = (index) => {
    if (trainingPhases.length <= 1) {
      alert('Cannot remove the last phase');
      return;
    }
    setTrainingPhases(trainingPhases.filter((_, i) => i !== index));
  };

  const handlePhaseChange = (index, field, value) => {
    const updated = [...trainingPhases];
    if (field === 'name') {
      updated[index].name = value;
    } else {
      updated[index][field] = parseInt(value) || 1;
    }
    setTrainingPhases(updated);
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

      {/* Training Cycle Configuration */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Marathon Training Cycle</h3>
        <div className="space-y-4">
          {/* Marathon Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Marathon Name
            </label>
            <input
              type="text"
              value={marathonName}
              onChange={(e) => setMarathonName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="e.g., Porto Alegre 2026"
            />
          </div>

          {/* Cycle Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cycle Start Date
            </label>
            <input
              type="date"
              value={cycleStartDate}
              onChange={(e) => setCycleStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Race Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Race Date
            </label>
            <input
              type="date"
              value={raceDate}
              onChange={(e) => setRaceDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Total Weeks (computed) */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Total Training Weeks:</span> {totalWeeks} weeks
            </p>
          </div>

          {/* Goal Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Goal Time (HH:MM:SS)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                max="23"
                value={goalTimeHours}
                onChange={(e) => setGoalTimeHours(e.target.value)}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="HH"
              />
              <span className="text-2xl text-gray-400">:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={goalTimeMinutes}
                onChange={(e) => setGoalTimeMinutes(e.target.value)}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="MM"
              />
              <span className="text-2xl text-gray-400">:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={goalTimeSeconds}
                onChange={(e) => setGoalTimeSeconds(e.target.value)}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="SS"
              />
            </div>
          </div>

          {/* Goal Pace (computed) */}
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Goal Pace:</span>{' '}
              <span className="text-primary-600 font-bold text-lg">{goalPace.formatted}</span>
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Based on {goalTime} for 42.195km marathon
            </p>
          </div>

          {/* Training Phases */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Training Phases
              </label>
              <button
                onClick={handleAddPhase}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                + Add Phase
              </button>
            </div>
            <div className="space-y-3">
              {trainingPhases.map((phase, index) => (
                <div key={index} className="flex gap-2 items-center p-3 bg-gray-50 rounded-lg">
                  <input
                    type="text"
                    value={phase.name}
                    onChange={(e) => handlePhaseChange(index, 'name', e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                    placeholder="Phase name"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-600">Week</span>
                    <input
                      type="number"
                      min="1"
                      max={totalWeeks}
                      value={phase.startWeek}
                      onChange={(e) => handlePhaseChange(index, 'startWeek', e.target.value)}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                    />
                    <span className="text-xs text-gray-600">to</span>
                    <input
                      type="number"
                      min="1"
                      max={totalWeeks}
                      value={phase.endWeek}
                      onChange={(e) => handlePhaseChange(index, 'endWeek', e.target.value)}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <button
                    onClick={() => handleRemovePhase(index)}
                    className="text-red-600 hover:text-red-700 text-sm"
                    title="Remove phase"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Define your training phases by week number. Each phase should have a name and week range.
            </p>
          </div>

          <button
            onClick={handleSaveCycle}
            className="btn-primary w-full"
          >
            {cycleSaved ? '✓ Cycle Saved!' : 'Save Training Cycle'}
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
            Downloads a JSON file with all your data. Save to <code className="bg-gray-200 px-1 rounded">public/database/marathon-tracker-db.json</code> and commit to git.
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
