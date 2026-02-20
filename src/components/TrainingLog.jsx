import { useState, useEffect } from 'react';
import useActivities from '../hooks/useActivities';
import { metersPerSecondToPace, formatDuration } from '../utils/trainingCalculations';
import { formatDate, formatDateISO } from '../utils/dateHelpers';
import { intervalsApi } from '../services/intervalsApi';
import { db } from '../services/database';
import { downloadDatabaseExport } from '../services/databaseSync';
import { useTranslation } from '../i18n/LanguageContext';
import {
  getCarbGuidelines,
  calculateExpectedCarbs,
  calculateCompliance,
  saveCarbIntake,
  getCarbIntake
} from '../utils/carbTracking';

function TrainingLog() {
  const { t } = useTranslation();
  const { activities, loading, error, refetch, sync } = useActivities(90, true, false, true);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [activityMessageCounts, setActivityMessageCounts] = useState({});
  const [showForceSyncDialog, setShowForceSyncDialog] = useState(false);
  const [forceSyncStartDate, setForceSyncStartDate] = useState('2025-01-01');
  const [syncProgress, setSyncProgress] = useState(null);

  // Load message counts for all activities
  useEffect(() => {
    async function loadMessageCounts() {
      const counts = {};
      for (const activity of activities) {
        const messages = await intervalsApi.getActivityMessages(activity.id, true);
        if (messages && messages.length > 0) {
          counts[activity.id] = messages.length;
        }
      }
      setActivityMessageCounts(counts);
    }

    if (activities.length > 0) {
      loadMessageCounts();
    }
  }, [activities]);

  const handleSyncNew = async () => {
    setSyncing(true);
    setSyncProgress(t('trainingLog.syncProgress.checkingLastSync') || 'Checking last sync date...');

    try {
      // Get the last sync date from database
      const latestDate = await db.getLatestActivityDate();
      const startDate = latestDate || '2025-01-01';
      const today = formatDateISO(new Date());

      console.log(`🔄 Sync New: Starting from ${startDate} to ${today}`);

      await performComprehensiveSync(startDate, today, false);
    } catch (error) {
      console.error('Error in Sync New:', error);
      alert('Error syncing: ' + error.message);
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  const handleForceSync = () => {
    setShowForceSyncDialog(true);
  };

  const confirmForceSync = async () => {
    setShowForceSyncDialog(false);
    setSyncing(true);
    setSyncProgress(t('trainingLog.syncProgress.startingForceSync') || 'Starting force sync...');

    try {
      const today = formatDateISO(new Date());
      console.log(`🔄 Force Sync: Starting from ${forceSyncStartDate} to ${today}`);

      await performComprehensiveSync(forceSyncStartDate, today, true);
    } catch (error) {
      console.error('Error in Force Sync:', error);
      alert('Error syncing: ' + error.message);
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  const performComprehensiveSync = async (startDate, endDate, isForceSync) => {
    let newDataSynced = false;

    try {
      // Step 1: Sync activities
      setSyncProgress(t('trainingLog.syncProgress.step1'));
      console.log('🔄 Step 1/5: Syncing activities from API...');

      const activitiesBeforeSync = await intervalsApi.getActivities(startDate, endDate);
      const countBefore = activitiesBeforeSync.length;

      await intervalsApi.syncActivities(startDate, endDate, isForceSync);

      const activitiesAfterSync = await intervalsApi.getActivities(startDate, endDate);
      const countAfter = activitiesAfterSync.length;

      if (countAfter > countBefore) {
        newDataSynced = true;
        console.log(`✅ Synced ${countAfter - countBefore} new activities`);
      }

      const runningActivities = activitiesAfterSync
        .filter(a => a.type === 'Run')
        .sort((a, b) => new Date(b.start_date_local) - new Date(a.start_date_local));

      console.log(`📊 Total running activities in range: ${runningActivities.length}`);

      // Step 2: Sync activity details and intervals
      setSyncProgress(`${t('trainingLog.syncProgress.step2')} ${t('common.for')} ${runningActivities.length} ${t('common.activities')}...` || `Step 2/5: Syncing intervals for ${runningActivities.length} activities...`);
      console.log(`🔄 Step 2/5: Syncing activity intervals...`);

      const activitiesNeedingIntervals = [];
      for (const activity of runningActivities) {
        const details = await db.getActivityDetails(activity.id);
        if (!details || !details.intervals || !details.intervals.icu_intervals || details.intervals.icu_intervals.length === 0) {
          activitiesNeedingIntervals.push(activity);
        }
      }

      console.log(`  ... ${activitiesNeedingIntervals.length} activities need intervals`);

      if (activitiesNeedingIntervals.length > 0) {
        newDataSynced = true;
        const batchSize = 5;
        for (let i = 0; i < activitiesNeedingIntervals.length; i += batchSize) {
          const batch = activitiesNeedingIntervals.slice(i, i + batchSize);
          setSyncProgress(`${t('trainingLog.syncProgress.step2')} ${i + 1}-${Math.min(i + batchSize, activitiesNeedingIntervals.length)} ${t('common.of')} ${activitiesNeedingIntervals.length}...` || `Step 2/5: Syncing intervals ${i + 1}-${Math.min(i + batchSize, activitiesNeedingIntervals.length)} of ${activitiesNeedingIntervals.length}...`);

          await Promise.all(
            batch.map(async (activity) => {
              try {
                await intervalsApi.getActivityIntervals(activity.id, false);
              } catch (error) {
                console.error(`Failed to fetch intervals for activity ${activity.id}:`, error);
              }
            })
          );

          if (i + batchSize < activitiesNeedingIntervals.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        console.log(`✅ Synced intervals for ${activitiesNeedingIntervals.length} activities`);
      }

      // Step 3: Sync messages
      setSyncProgress(t('trainingLog.syncProgress.step3'));
      console.log('🔄 Step 3/5: Syncing activity messages...');

      const messagesCountBefore = await db.activityMessages.count();
      await intervalsApi.syncActivityMessages(runningActivities, false);
      const messagesCountAfter = await db.activityMessages.count();

      if (messagesCountAfter > messagesCountBefore) {
        newDataSynced = true;
        console.log(`✅ Synced ${messagesCountAfter - messagesCountBefore} new messages`);
      }

      // Step 4: Sync wellness
      setSyncProgress(t('trainingLog.syncProgress.step4'));
      console.log('🔄 Step 4/5: Syncing wellness data...');

      const wellnessCountBefore = await db.wellness.count();
      await intervalsApi.getWellnessData(startDate, endDate, false, true); // forceRefresh=true
      const wellnessCountAfter = await db.wellness.count();

      if (wellnessCountAfter > wellnessCountBefore) {
        newDataSynced = true;
        console.log(`✅ Synced ${wellnessCountAfter - wellnessCountBefore} new wellness records`);
      }

      // Step 5: Sync cross training (cycling + strength)
      setSyncProgress('Step 5/5: Syncing cross training activities...');
      console.log('🔄 Step 5/5: Syncing cross training activities...');

      const crossTrainingCountBefore = await db.crossTraining.count();

      // Import the cross training service dynamically
      const { getCrossTrainingActivities } = await import('../services/crossTrainingService');

      // Fetch cross training incrementally from Intervals.icu (includes Strava-synced activities)
      await getCrossTrainingActivities(startDate, endDate, true);

      const crossTrainingCountAfter = await db.crossTraining.count();

      if (crossTrainingCountAfter > crossTrainingCountBefore) {
        newDataSynced = true;
        console.log(`✅ Synced ${crossTrainingCountAfter - crossTrainingCountBefore} new cross training activities (total: ${crossTrainingCountAfter})`);
      } else if (crossTrainingCountAfter > 0) {
        console.log(`✅ Cross training up to date (${crossTrainingCountAfter} activities)`);
      }

      // Step 6: Save database if new data was synced
      if (newDataSynced) {
        setSyncProgress(t('trainingLog.syncProgress.complete'));
        console.log('💾 New data synced - triggering database export...');

        // Small delay to let user see the message
        await new Promise(resolve => setTimeout(resolve, 500));

        await downloadDatabaseExport();

        alert(`✅ Sync completed successfully!\n\n` +
              `Activities: ${runningActivities.length}\n` +
              `Date range: ${startDate} to ${endDate}\n\n` +
              `Database file has been downloaded. Save it to:\n` +
              `public/database/marathon-tracker-db.json`);
      } else {
        alert(`✅ ${t('trainingLog.syncProgress.noNewData')}\n\n` +
              `${t('trainingLog.syncProgress.allUpToDate')} ${startDate} to ${endDate}`);
      }

      // Reload activities in the UI
      refetch();

      console.log('✅ Comprehensive sync completed!');
    } catch (error) {
      console.error('❌ Error during comprehensive sync:', error);
      throw error;
    }
  };

  if (loading && activities.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-red-50 border-red-200">
        <p className="text-red-700 font-medium mb-2">{t('common.error')}</p>
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <button onClick={refetch} className="btn-primary">
          {t('common.retry') || 'Retry'}
        </button>
      </div>
    );
  }

  if (selectedActivity) {
    return <ActivityDetail activity={selectedActivity} onBack={() => setSelectedActivity(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{t('trainingLog.title')}</h2>
        <div className="flex gap-2">
          <button
            onClick={handleSyncNew}
            disabled={syncing}
            className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('trainingLog.syncNewTooltip')}
          >
            {syncing && !showForceSyncDialog ? `⏳ ${t('common.syncing')}` : `🔄 ${t('common.syncNew')}`}
          </button>
          <button
            onClick={handleForceSync}
            disabled={syncing}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('trainingLog.forceSyncTooltip')}
          >
            {syncing && showForceSyncDialog ? `⏳ ${t('common.syncing')}` : `🔄 ${t('common.forceSync')}`}
          </button>
        </div>
      </div>

      {/* Sync Progress Indicator */}
      {syncProgress && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <p className="text-sm text-blue-800 font-medium">{syncProgress}</p>
          </div>
        </div>
      )}

      {/* Force Sync Dialog */}
      {showForceSyncDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{t('trainingLog.forceSyncDialog.title')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('trainingLog.forceSyncDialog.description')}
            </p>

            <div className="mb-6">
              <label htmlFor="forceSyncStartDate" className="block text-sm font-medium text-gray-700 mb-2">
                {t('common.startDate')}
              </label>
              <input
                type="date"
                id="forceSyncStartDate"
                value={forceSyncStartDate}
                onChange={(e) => setForceSyncStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('trainingLog.forceSyncDialog.recommended')}
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowForceSyncDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmForceSync}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                {t('trainingLog.forceSyncDialog.startSync')}
              </button>
            </div>
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">{t('trainingLog.noActivities')}</p>
          <p className="text-sm text-gray-400">
            {t('trainingLog.checkSettings')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              onClick={() => setSelectedActivity(activity)}
              className="card hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {activity.name || 'Run'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {formatDate(activity.start_date_local, 'EEE, MMM d, yyyy')}
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  activity.type === 'Run'
                    ? 'bg-primary-100 text-primary-700'
                    : (activity.type === 'Ride' || activity.type === 'VirtualRide')
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {activity.type}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-3">
                {/* Show different metrics based on activity type */}
                {activity.type === 'Run' ? (
                  <>
                    <div>
                      <p className="text-xs text-gray-600">{t('common.distance')}</p>
                      <p className="text-sm font-bold text-gray-900">
                        {((activity.distance || 0) / 1000).toFixed(1)} km
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">{t('common.pace')}</p>
                      <p className="text-sm font-bold text-gray-900">
                        {activity.average_speed ?
                          metersPerSecondToPace(activity.average_speed) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">{t('common.load')}</p>
                      <p className="text-sm font-bold text-gray-900">
                        {activity.icu_training_load || activity.training_load || activity.load || activity.tss || activity.suffer_score || 0}
                      </p>
                    </div>
                  </>
                ) : (activity.type === 'Ride' || activity.type === 'VirtualRide') ? (
                  <>
                    <div>
                      <p className="text-xs text-gray-600">{t('common.distance')}</p>
                      <p className="text-sm font-bold text-gray-900">
                        {((activity.distance || 0) / 1000).toFixed(1)} km
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Avg Power</p>
                      <p className="text-sm font-bold text-gray-900">
                        {(activity.icu_average_watts || activity.average_watts || activity.avg_power) || '-'} W
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">{t('common.load')}</p>
                      <p className="text-sm font-bold text-gray-900">
                        {activity.icu_training_load || activity.training_load || activity.load || activity.tss || activity.suffer_score || 0}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-xs text-gray-600">Duration</p>
                      <p className="text-sm font-bold text-gray-900">
                        {Math.floor((activity.moving_time || activity.elapsed_time || 0) / 60)} min
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">{t('common.load')}</p>
                      <p className="text-sm font-bold text-gray-900">
                        {activity.icu_training_load || activity.training_load || activity.load || activity.tss || activity.suffer_score || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Type</p>
                      <p className="text-sm font-bold text-gray-900">
                        {activity.type === 'WeightTraining' ? '💪' : '🏋️'}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs">
                  {(activity.icu_average_watts || activity.average_watts || activity.avg_power) && (
                    <span className="text-gray-600">
                      ⚡ {activity.icu_average_watts || activity.average_watts || activity.avg_power}W
                    </span>
                  )}
                  {activity.average_heartrate && (
                    <span className="text-gray-600">
                      ❤️ {activity.average_heartrate} bpm
                    </span>
                  )}
                  <span className="text-gray-600">
                    🕐 {formatDuration(activity.moving_time || activity.elapsed_time)}
                  </span>
                  {activityMessageCounts[activity.id] > 0 && (
                    <span className="text-blue-600 font-medium flex items-center gap-1">
                      💬 {activityMessageCounts[activity.id]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityDetail({ activity, onBack }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [carbData, setCarbData] = useState(null);
  const [carbForm, setCarbForm] = useState({ carbGrams: 0, notes: '' });
  const [showCarbForm, setShowCarbForm] = useState(false);
  const [savingCarbs, setSavingCarbs] = useState(false);
  const [guidelines, setGuidelines] = useState({
    carbsPer30Min: 22.5,
    minDurationMinutes: 75,
    enabled: true
  });

  // Calculate if this activity needs carb tracking
  const durationMinutes = activity.moving_time ? Math.round(activity.moving_time / 60) : 0;
  const needsCarbTracking =
    guidelines.enabled &&
    (activity.type === 'Run' || activity.workout_type === 'Run') &&
    durationMinutes > guidelines.minDurationMinutes;
  const expectedCarbs = needsCarbTracking ? calculateExpectedCarbs(durationMinutes, guidelines) : 0;

  useEffect(() => {
    async function fetchData() {
      // Load guidelines from database
      try {
        const loadedGuidelines = await getCarbGuidelines();
        setGuidelines(loadedGuidelines);
      } catch (error) {
        console.error('Error loading carb guidelines:', error);
      }

      // Load messages
      setLoadingMessages(true);
      try {
        const msgs = await intervalsApi.getActivityMessages(activity.id);
        setMessages(msgs || []);
      } catch (error) {
        console.error('Error fetching messages:', error);
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }

      // Load carb data (will use updated guidelines)
      const duration = activity.moving_time ? Math.round(activity.moving_time / 60) : 0;
      if (duration > guidelines.minDurationMinutes && guidelines.enabled) {
        try {
          const data = await getCarbIntake(activity.id);
          if (data) {
            setCarbData(data);
            setCarbForm({ carbGrams: data.carbGrams, notes: data.notes || '' });
          }
        } catch (error) {
          console.error('Error fetching carb data:', error);
        }
      }
    }

    if (activity?.id) {
      fetchData();
    }
  }, [activity?.id]);

  const handleSaveCarbs = async () => {
    if (!needsCarbTracking) return;

    setSavingCarbs(true);
    try {
      const saved = await saveCarbIntake(
        activity.id,
        parseInt(carbForm.carbGrams) || 0,
        carbForm.notes
      );
      setCarbData(saved);
      setShowCarbForm(false);
      alert('✅ Carb intake saved successfully!');
    } catch (error) {
      console.error('Error saving carb intake:', error);
      alert('❌ Error saving carb intake: ' + error.message);
    } finally {
      setSavingCarbs(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-primary-600 hover:text-primary-700 font-medium flex items-center"
      >
        ← {t('trainingLog.backToLog')}
      </button>

      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          {activity.name || 'Run'}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {formatDate(activity.start_date_local, 'EEEE, MMMM d, yyyy')}
        </p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="metric-card">
            <p className="text-xs text-gray-600">{t('common.distance')}</p>
            <p className="text-2xl font-bold text-gray-900">
              {((activity.distance || 0) / 1000).toFixed(2)} km
            </p>
          </div>
          <div className="metric-card">
            <p className="text-xs text-gray-600">{t('common.duration')}</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatDuration(activity.moving_time || activity.elapsed_time)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">{t('trainingLog.metrics')}</h3>

          <div className="grid grid-cols-2 gap-3">
            {activity.average_speed && (
              <div>
                <p className="text-xs text-gray-600">{t('common.avgPace')}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {metersPerSecondToPace(activity.average_speed)}
                </p>
              </div>
            )}
            {(activity.icu_average_watts || activity.average_watts || activity.avg_power) && (
              <div>
                <p className="text-xs text-gray-600">{t('common.avgPower')}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {activity.icu_average_watts || activity.average_watts || activity.avg_power}W
                </p>
              </div>
            )}
            {activity.average_heartrate && (
              <div>
                <p className="text-xs text-gray-600">{t('common.avgHR')}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {activity.average_heartrate} bpm
                </p>
              </div>
            )}
            {activity.average_cadence && (
              <div>
                <p className="text-xs text-gray-600">{t('common.avgCadence') || 'Avg Cadence'}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {activity.average_cadence} spm
                </p>
              </div>
            )}
            {(activity.icu_training_load || activity.training_load || activity.load || activity.tss || activity.suffer_score) && (
              <div>
                <p className="text-xs text-gray-600">{t('common.load') || 'TSS/Load'}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {activity.icu_training_load || activity.training_load || activity.load || activity.tss || activity.suffer_score}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Carb Supplementation Tracking */}
        {needsCarbTracking && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <span>🥤</span>
                <span>Carb Supplementation</span>
              </h3>
              {!showCarbForm && (
                <button
                  onClick={() => setShowCarbForm(true)}
                  className="px-3 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  {carbData ? '✏️ Edit' : '+ Add'}
                </button>
              )}
            </div>

            {showCarbForm ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Carbs Consumed (grams)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    value={carbForm.carbGrams}
                    onChange={(e) => setCarbForm({ ...carbForm, carbGrams: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 45"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Expected: {expectedCarbs}g ({Math.floor(durationMinutes / 30)} gels × {guidelines.carbsPer30Min}g)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Notes (optional)
                  </label>
                  <textarea
                    value={carbForm.notes}
                    onChange={(e) => setCarbForm({ ...carbForm, notes: e.target.value })}
                    rows="2"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="e.g., Took 2 gels instead of 3, felt good"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveCarbs}
                    disabled={savingCarbs}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                  >
                    {savingCarbs ? '💾 Saving...' : '💾 Save'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCarbForm(false);
                      if (carbData) {
                        setCarbForm({ carbGrams: carbData.carbGrams, notes: carbData.notes || '' });
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : carbData ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-gray-600">Expected</p>
                    <p className="text-lg font-bold text-gray-900">{expectedCarbs}g</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Actual</p>
                    <p className="text-lg font-bold text-gray-900">{carbData.carbGrams}g</p>
                  </div>
                </div>

                {(() => {
                  const compliance = calculateCompliance(carbData.carbGrams, expectedCarbs);
                  if (compliance) {
                    return (
                      <div className={`px-3 py-2 rounded-md ${
                        compliance.level === 'excellent' ? 'bg-green-100 border border-green-300' :
                        compliance.level === 'good' ? 'bg-blue-100 border border-blue-300' :
                        compliance.level === 'fair' ? 'bg-yellow-100 border border-yellow-300' :
                        'bg-red-100 border border-red-300'
                      }`}>
                        <p className={`text-sm font-semibold ${
                          compliance.level === 'excellent' ? 'text-green-800' :
                          compliance.level === 'good' ? 'text-blue-800' :
                          compliance.level === 'fair' ? 'text-yellow-800' :
                          'text-red-800'
                        }`}>
                          {compliance.level === 'excellent' ? '🌟 Excellent!' :
                           compliance.level === 'good' ? '👍 Good!' :
                           compliance.level === 'fair' ? '😐 Fair' :
                           '⚠️ Needs Improvement'}
                          {' '}({compliance.percentage}%)
                        </p>
                        <p className="text-xs text-gray-700 mt-1">
                          {compliance.difference >= 0
                            ? `+${compliance.difference}g over target`
                            : `${Math.abs(compliance.difference)}g under target`}
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}

                {carbData.notes && (
                  <div className="mt-3 pt-3 border-t border-green-200">
                    <p className="text-xs text-gray-600 mb-1">Notes:</p>
                    <p className="text-sm text-gray-800">{carbData.notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ No carb data tracked yet. Duration: {durationMinutes}min - Expected: {expectedCarbs}g
                </p>
              </div>
            )}
          </div>
        )}

        {(activity.description || activity.notes) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <span>💬</span>
              <span>{t('trainingLog.comments')}</span>
            </h3>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {activity.description || activity.notes}
              </p>
            </div>
          </div>
        )}

        {/* Activity Messages/Notes */}
        {loadingMessages ? (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">{t('common.loading')}</p>
          </div>
        ) : messages.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>💬</span>
              <span>{t('trainingLog.notes')} ({messages.length})</span>
            </h3>
            <div className="space-y-3">
              {messages.map((message, idx) => {
                // Extract message text - try multiple field names
                const messageText = message.text || message.message || message.content || message.note || message.body || '';

                // Extract author name - try multiple field structures
                let authorName = 'Unknown';

                // Try different possible structures for author name
                if (message.athlete) {
                  // Nested athlete object
                  authorName = message.athlete.name ||
                               `${message.athlete.firstName || ''} ${message.athlete.lastName || ''}`.trim() ||
                               message.athlete.username ||
                               message.athlete.displayName ||
                               authorName;
                } else if (message.author) {
                  // Direct author field (could be string or object)
                  if (typeof message.author === 'string') {
                    authorName = message.author;
                  } else if (typeof message.author === 'object') {
                    authorName = message.author.name ||
                                 `${message.author.firstName || ''} ${message.author.lastName || ''}`.trim() ||
                                 message.author.username ||
                                 authorName;
                  }
                } else {
                  // Flat structure - try common field names
                  authorName = message.athleteName ||
                               message.authorName ||
                               message.userName ||
                               message.name ||
                               `${message.firstName || ''} ${message.lastName || ''}`.trim() ||
                               authorName;
                }

                // Extract timestamp
                const timestamp = message.created || message.createdAt || message.timestamp || message.date || message.updatedAt;

                return (
                  <div key={message.id || idx} className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-xs font-medium text-blue-900">
                        {authorName}
                      </p>
                      {timestamp && (
                        <p className="text-xs text-blue-600">
                          {formatDate(timestamp, 'MMM d, yyyy HH:mm')}
                        </p>
                      )}
                    </div>
                    {messageText ? (
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {messageText}
                      </p>
                    ) : (
                      <div className="text-xs text-gray-500">
                        <p className="mb-1">No text field found. Message object:</p>
                        <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                          {JSON.stringify(message, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TrainingLog;
