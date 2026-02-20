import { useState, useEffect } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { intervalsApi } from '../services/intervalsApi';
import { db } from '../services/database';
import { TRAINING_CYCLE } from '../utils/trainingCycle';
import { downloadDatabaseExport, uploadDatabaseImport, getDatabaseExportStats } from '../services/databaseSync';

function Settings() {
  const { t } = useTranslation();
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
      alert(`${t('settings.errorSavingConfig')} ${error.message}`);
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
        alert(t('settings.enterBothDates'));
        return;
      }

      const start = new Date(cycleStartDate);
      const end = new Date(raceDate);
      if (start >= end) {
        alert(t('settings.raceDateAfterStart'));
        return;
      }

      // Validate phases
      const lastPhase = trainingPhases[trainingPhases.length - 1];
      if (lastPhase.endWeek > totalWeeks) {
        alert(`${t('settings.phaseExceedsCycle')} ${lastPhase.endWeek}, ${t('settings.cycleOnlyWeeks')} ${totalWeeks} ${t('settings.weeksLong')}`);
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
      alert(t('settings.cycleConfigSaved'));
    } catch (error) {
      alert(`${t('settings.errorSavingCycle')} ${error.message}`);
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
      alert(t('settings.removePhaseError'));
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
    if (!confirm(t('settings.exportConfirm'))) {
      return;
    }

    setExporting(true);
    try {
      await downloadDatabaseExport();
      alert(t('settings.exportSuccess'));
    } catch (error) {
      alert(`${t('settings.errorExporting')} ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImportDatabase = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm(t('settings.importConfirm'))) {
      event.target.value = '';
      return;
    }

    setImporting(true);
    try {
      const imported = await uploadDatabaseImport(file, true); // clearExisting = true
      await loadSettings(); // Refresh stats
      alert(`${t('settings.importSuccess')}\n\n${t('settings.imported')}\n- ${imported.activities} ${t('settings.activities').toLowerCase()}\n- ${imported.activityDetails} ${t('settings.activityDetails').toLowerCase()}\n- ${imported.wellness} ${t('settings.wellnessRecords').toLowerCase()}\n- ${imported.analyses} ${t('settings.coachAnalyses').toLowerCase()}`);
      event.target.value = ''; // Reset file input
    } catch (error) {
      alert(`${t('settings.errorImporting')} ${error.message}`);
      event.target.value = '';
    } finally {
      setImporting(false);
    }
  };


  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('settings.title')}</h2>
      </div>

      {/* Intervals.icu Configuration */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('settings.intervalsAPI')}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.apiKey')}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={t('settings.apiKeyPlaceholder')}
            />
            <p className="mt-1 text-xs text-gray-500">
              {t('settings.apiKeyHelp')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.athleteId')}
            </label>
            <input
              type="text"
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={t('settings.athleteIdPlaceholder')}
            />
            <p className="mt-1 text-xs text-gray-500">
              {t('settings.athleteIdHelp')}
            </p>
          </div>

          <button
            onClick={handleSave}
            className="btn-primary w-full"
          >
            {saved ? `✓ ${t('settings.saved')}` : t('settings.saveConfig')}
          </button>
        </div>
      </div>

      {/* Training Cycle Configuration */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('settings.trainingCycle')}</h3>
        <div className="space-y-4">
          {/* Marathon Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.marathonName')}
            </label>
            <input
              type="text"
              value={marathonName}
              onChange={(e) => setMarathonName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={t('settings.marathonNamePlaceholder')}
            />
          </div>

          {/* Cycle Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.cycleStartDate')}
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
              {t('settings.raceDate')}
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
              <span className="font-medium">{t('settings.totalTrainingWeeks')}:</span> {totalWeeks} {t('settings.weeksLabel')}
            </p>
          </div>

          {/* Goal Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.goalTime')}
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
              <span className="font-medium">{t('settings.goalPace')}:</span>{' '}
              <span className="text-primary-600 font-bold text-lg">{goalPace.formatted}</span>
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {t('settings.goalPaceBasedOn')} {goalTime} {t('settings.forMarathon')}
            </p>
          </div>

          {/* Training Phases */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                {t('settings.trainingPhases')}
              </label>
              <button
                onClick={handleAddPhase}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                {t('settings.addPhase')}
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
                    placeholder={t('settings.phaseName')}
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-600">{t('settings.week')}</span>
                    <input
                      type="number"
                      min="1"
                      max={totalWeeks}
                      value={phase.startWeek}
                      onChange={(e) => handlePhaseChange(index, 'startWeek', e.target.value)}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                    />
                    <span className="text-xs text-gray-600">{t('settings.to')}</span>
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
                    title={t('common.delete')}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {t('settings.phaseHelp')}
            </p>
          </div>

          <button
            onClick={handleSaveCycle}
            className="btn-primary w-full"
          >
            {cycleSaved ? `✓ ${t('settings.cycleSaved')}` : t('settings.saveCycle')}
          </button>
        </div>
      </div>

      {/* Database Statistics */}
      {dbStats && (
        <div className="card bg-blue-50 border-blue-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('settings.databaseStats')}</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-600">{t('settings.activities')}</p>
              <p className="text-xl font-bold text-gray-900">{dbStats.activities}</p>
            </div>
            <div>
              <p className="text-gray-600">{t('settings.activityDetails')}</p>
              <p className="text-xl font-bold text-gray-900">{dbStats.activityDetails}</p>
            </div>
            <div>
              <p className="text-gray-600">{t('settings.wellnessRecords')}</p>
              <p className="text-xl font-bold text-gray-900">{dbStats.wellness}</p>
            </div>
            <div>
              <p className="text-gray-600">{t('settings.coachAnalyses')}</p>
              <p className="text-xl font-bold text-gray-900">{dbStats.analyses}</p>
            </div>
            <div>
              <p className="text-gray-600">{t('settings.cacheEntries')}</p>
              <p className="text-xl font-bold text-gray-900">{dbStats.cache}</p>
            </div>
          </div>
          <button
            onClick={loadSettings}
            className="mt-3 text-sm text-blue-600 hover:text-blue-700"
          >
            🔄 {t('settings.refreshStats')}
          </button>
        </div>
      )}

      {/* Database Sync for Multi-Computer */}
      <div className="card bg-purple-50 border-purple-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">🔄 {t('settings.databaseSync')}</h3>
        <p className="text-sm text-gray-700 mb-4">
          {t('settings.databaseSyncDesc')}
        </p>

        {exportStats && (
          <div className="bg-white rounded-lg p-3 mb-4 text-sm">
            <p className="font-medium text-gray-900 mb-2">{t('settings.exportSizePreview')}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-600">{t('settings.activities')}:</span>
                <span className="ml-2 font-semibold">{exportStats.formatted.activities}</span>
              </div>
              <div>
                <span className="text-gray-600">{t('settings.intervals')}:</span>
                <span className="ml-2 font-semibold">{exportStats.formatted.activityDetails}</span>
              </div>
              <div>
                <span className="text-gray-600">{t('settings.wellnessRecords')}:</span>
                <span className="ml-2 font-semibold">{exportStats.formatted.wellness}</span>
              </div>
              <div>
                <span className="text-gray-600">{t('settings.coachAnalyses')}:</span>
                <span className="ml-2 font-semibold">{exportStats.formatted.analyses}</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200">
              <span className="text-gray-900 font-semibold">{t('settings.totalExportSize')}:</span>
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
            {exporting ? `⏳ ${t('settings.exporting')}` : `📤 ${t('settings.exportDatabase')}`}
          </button>
          <p className="text-xs text-gray-600">
            {t('settings.exportHelp')} <code className="bg-gray-200 px-1 rounded">public/database/marathon-tracker-db.json</code> {t('settings.andCommit')}
          </p>

          <div className="border-t border-purple-200 pt-3">
            <label htmlFor="dbImportFile" className="btn-secondary w-full block text-center cursor-pointer">
              📥 {t('settings.importDatabase')}
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
              {importing ? `⏳ ${t('settings.importing')}` : t('settings.importHelp')}
            </p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-800">
          <p className="font-medium mb-1">💡 {t('settings.workflowTitle')}</p>
          <ol className="space-y-1 ml-4 list-decimal">
            <li>{t('settings.workflowStep1')}</li>
            <li>{t('settings.workflowStep2')}</li>
            <li>{t('settings.workflowStep3')}</li>
            <li>{t('settings.workflowStep4')}</li>
            <li>{t('settings.workflowStep5')}</li>
          </ol>
        </div>
      </div>

      {/* About */}
      <div className="card bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('settings.about')}</h3>
        <p className="text-sm text-gray-600 mb-2">
          {t('settings.aboutApp')}
        </p>
        <p className="text-xs text-gray-500 mb-3">
          {t('settings.aboutDesc')}
        </p>
        <div className="text-xs text-gray-400">
          <p>💾 {t('settings.localDatabase')}</p>
          <p>📁 {t('settings.coachAnalysesFile')}</p>
          <p>🔌 {t('settings.apiSource')}</p>
        </div>
      </div>
    </div>
  );
}

export default Settings;
