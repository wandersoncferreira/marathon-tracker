import { useState, useEffect } from 'react';
import useActivities from '../hooks/useActivities';
import { metersPerSecondToPace, formatDuration } from '../utils/trainingCalculations';
import { formatDate } from '../utils/dateHelpers';
import { intervalsApi } from '../services/intervalsApi';

function TrainingLog() {
  const { activities, loading, error, refetch, sync } = useActivities(90);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [activityMessageCounts, setActivityMessageCounts] = useState({});

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

  const handleSync = async () => {
    setSyncing(true);
    await sync(); // sync() now also syncs messages
    setSyncing(false);
  };

  if (loading && activities.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading activities...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-red-50 border-red-200">
        <p className="text-red-700 font-medium mb-2">Error loading activities</p>
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <button onClick={refetch} className="btn-primary">
          Retry
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
        <h2 className="text-2xl font-bold text-gray-900">Training Log</h2>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-green-600 hover:text-green-700 text-sm font-medium disabled:opacity-50"
          >
            {syncing ? '⏳ Syncing...' : '🔄 Sync from API'}
          </button>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No activities found</p>
          <p className="text-sm text-gray-400">
            Make sure your Intervals.icu API is configured in Settings
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
                <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded">
                  {activity.type}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <p className="text-xs text-gray-600">Distance</p>
                  <p className="text-sm font-bold text-gray-900">
                    {((activity.distance || 0) / 1000).toFixed(1)} km
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Pace</p>
                  <p className="text-sm font-bold text-gray-900">
                    {activity.average_speed ?
                      metersPerSecondToPace(activity.average_speed) : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Load</p>
                  <p className="text-sm font-bold text-gray-900">
                    {activity.icu_training_load || activity.training_load || 0}
                  </p>
                </div>
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
        ← Back to Log
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
            <p className="text-xs text-gray-600">Distance</p>
            <p className="text-2xl font-bold text-gray-900">
              {((activity.distance || 0) / 1000).toFixed(2)} km
            </p>
          </div>
          <div className="metric-card">
            <p className="text-xs text-gray-600">Duration</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatDuration(activity.moving_time || activity.elapsed_time)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Metrics</h3>

          <div className="grid grid-cols-2 gap-3">
            {activity.average_speed && (
              <div>
                <p className="text-xs text-gray-600">Avg Pace</p>
                <p className="text-lg font-semibold text-gray-900">
                  {metersPerSecondToPace(activity.average_speed)}
                </p>
              </div>
            )}
            {activity.average_watts && (
              <div>
                <p className="text-xs text-gray-600">Avg Power</p>
                <p className="text-lg font-semibold text-gray-900">
                  {activity.average_watts}W
                </p>
              </div>
            )}
            {activity.average_heartrate && (
              <div>
                <p className="text-xs text-gray-600">Avg HR</p>
                <p className="text-lg font-semibold text-gray-900">
                  {activity.average_heartrate} bpm
                </p>
              </div>
            )}
            {activity.average_cadence && (
              <div>
                <p className="text-xs text-gray-600">Avg Cadence</p>
                <p className="text-lg font-semibold text-gray-900">
                  {activity.average_cadence} spm
                </p>
              </div>
            )}
            {activity.training_load && (
              <div>
                <p className="text-xs text-gray-600">Training Load</p>
                <p className="text-lg font-semibold text-gray-900">
                  {activity.training_load}
                </p>
              </div>
            )}
            {activity.icu_training_load && (
              <div>
                <p className="text-xs text-gray-600">ICU Load</p>
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
              <span>Comments</span>
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
            <p className="text-xs text-gray-500">Loading messages...</p>
          </div>
        ) : messages.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>💬</span>
              <span>Notes ({messages.length})</span>
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
