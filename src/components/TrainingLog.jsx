import { useState } from 'react';
import useActivities from '../hooks/useActivities';
import { metersPerSecondToPace, formatDuration } from '../utils/trainingCalculations';
import { formatDate } from '../utils/dateHelpers';

function TrainingLog() {
  const { activities, loading, error, refetch, sync } = useActivities(90);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    await sync();
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

              {activity.average_watts && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                  <span className="text-gray-600">
                    ⚡ {activity.average_watts}W
                  </span>
                  <span className="text-gray-600">
                    ❤️ {activity.average_heartrate || 'N/A'} bpm
                  </span>
                  <span className="text-gray-600">
                    🕐 {formatDuration(activity.moving_time || activity.elapsed_time)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityDetail({ activity, onBack }) {
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

        {activity.description && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
            <p className="text-sm text-gray-700">{activity.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TrainingLog;
