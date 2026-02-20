import { useState, useEffect } from 'react';
import useActivities from '../hooks/useActivities';
import { metersPerSecondToPace, formatDuration } from '../utils/trainingCalculations';
import { formatDate, formatDateISO } from '../utils/dateHelpers';
import { intervalsApi } from '../services/intervalsApi';
import { db } from '../services/database';
import { downloadDatabaseExport } from '../services/databaseSync';
import { useTranslation } from '../i18n/LanguageContext';

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
                        {activity.icu_training_load || activity.training_load || 0}
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
                        {activity.average_watts || '-'} W
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">{t('common.load')}</p>
                      <p className="text-sm font-bold text-gray-900">
                        {activity.icu_training_load || activity.training_load || 0}
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
                        {activity.icu_training_load || activity.training_load || '-'}
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
                  {activity.average_watts && (
                    <span className="text-gray-600">
                      ⚡ {activity.average_watts}W
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

  useEffect(() => {
    async function fetchMessages() {
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
    }

    if (activity?.id) {
      fetchMessages();
    }
  }, [activity?.id]);

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
            {activity.average_watts && (
              <div>
                <p className="text-xs text-gray-600">{t('common.avgPower')}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {activity.average_watts}W
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
            {activity.training_load && (
              <div>
                <p className="text-xs text-gray-600">{t('dashboard.trainingLoad')}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {activity.training_load}
                </p>
              </div>
            )}
            {activity.icu_training_load && (
              <div>
                <p className="text-xs text-gray-600">{t('common.icuLoad') || 'ICU Load'}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {activity.icu_training_load}
                </p>
              </div>
            )}
          </div>
        </div>

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
