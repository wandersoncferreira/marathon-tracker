import { useEffect, useState } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import useWeeklyPlan from '../hooks/useWeeklyPlan';
import { intervalsApi } from '../services/intervalsApi';

function WeeklyPlan() {
  const { t } = useTranslation();
  const { events, loading, error, refresh, weekRange } = useWeeklyPlan(true);
  const [completedActivities, setCompletedActivities] = useState([]);

  // Fetch completed activities for the week to show which workouts are done
  useEffect(() => {
    const fetchCompleted = async () => {
      if (weekRange) {
        const activities = await intervalsApi.getActivities(weekRange.start, weekRange.end);
        setCompletedActivities(activities);
      }
    };
    fetchCompleted();
  }, [weekRange, events]);

  const getDayName = (dateStr) => {
    const date = new Date(dateStr);
    const days = [
      t('coachAnalysis.sunday'),
      t('coachAnalysis.monday'),
      t('coachAnalysis.tuesday'),
      t('coachAnalysis.wednesday'),
      t('coachAnalysis.thursday'),
      t('coachAnalysis.friday'),
      t('coachAnalysis.saturday')
    ];
    return days[date.getDay()];
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isToday = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCompleted = (dateStr) => {
    const eventDate = dateStr.split('T')[0];
    return completedActivities.some(activity => {
      const activityDate = activity.start_date_local.split('T')[0];
      return activityDate === eventDate && activity.type === 'Run';
    });
  };

  // Group events by day
  const groupEventsByDay = () => {
    const grouped = {};
    events.forEach(event => {
      const dayKey = event.start_date_local.split('T')[0];
      if (!grouped[dayKey]) {
        grouped[dayKey] = [];
      }
      grouped[dayKey].push(event);
    });
    return grouped;
  };

  const groupedEvents = groupEventsByDay();

  const formatWorkoutName = (event) => {
    // Extract workout name, removing redundant info
    if (event.name) return event.name;
    if (event.description) {
      // Take first line or first 50 chars
      const firstLine = event.description.split('\n')[0];
      return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
    }
    return t('coachAnalysis.planned');
  };

  const getDistance = (event) => {
    // Try to extract distance from the event
    if (event.distance) {
      return `${(event.distance / 1000).toFixed(1)}km`;
    }
    // Try to find distance in name or description
    const text = `${event.name || ''} ${event.description || ''}`;
    const match = text.match(/(\d+(?:\.\d+)?)\s*km/i);
    if (match) {
      return `${parseFloat(match[1]).toFixed(1)}km`;
    }
    return null;
  };

  const [expandedEvent, setExpandedEvent] = useState(null);

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">{t('coachAnalysis.weeklyPlan')}</h3>
        </div>
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">{t('coachAnalysis.weeklyPlan')}</h3>
        </div>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{t('coachAnalysis.weeklyPlan')}</h3>
          <p className="text-xs text-gray-500">
            {t('coachAnalysis.weeklyPlanFrom')} {formatDate(weekRange.start)} - {formatDate(weekRange.end)}
          </p>
        </div>
        <button
          onClick={refresh}
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          title={t('coachAnalysis.refreshPlan')}
        >
          ↻
        </button>
      </div>

      {Object.keys(groupedEvents).length === 0 ? (
        <p className="text-sm text-gray-500">{t('coachAnalysis.noPlannedWorkouts')}</p>
      ) : (
        <div className="space-y-1">
          {Object.entries(groupedEvents).map(([dayKey, dayEvents], dayIndex) => {
            const firstEvent = dayEvents[0];
            const completed = isCompleted(firstEvent.start_date_local);
            const today = isToday(firstEvent.start_date_local);
            const isExpanded = expandedEvent === dayIndex;
            const hasMultiple = dayEvents.length > 1;

            return (
              <div key={dayIndex}>
                <div
                  onClick={() => setExpandedEvent(isExpanded ? null : dayIndex)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded border transition-colors cursor-pointer hover:shadow-sm ${
                    completed
                      ? 'bg-green-50 border-green-200 hover:bg-green-100'
                      : today
                      ? 'bg-primary-50 border-primary-200 hover:bg-primary-100'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex-shrink-0 w-10">
                    <div className={`text-xs font-medium ${
                      today ? 'text-primary-700' : 'text-gray-600'
                    }`}>
                      {getDayName(firstEvent.start_date_local).substring(0, 3)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    {hasMultiple && !isExpanded ? (
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${
                          completed ? 'text-green-900' : today ? 'text-primary-900' : 'text-gray-900'
                        }`}>
                          {dayEvents.length} {t('coachAnalysis.planned')} sessions
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium truncate ${
                          completed ? 'text-green-900' : today ? 'text-primary-900' : 'text-gray-900'
                        }`}>
                          {formatWorkoutName(firstEvent)}
                        </p>
                        {(() => {
                          const distance = getDistance(firstEvent);
                          return distance && (
                            <span className={`text-xs font-medium flex-shrink-0 ${
                              completed ? 'text-green-700' : today ? 'text-primary-700' : 'text-gray-600'
                            }`}>
                              {distance}
                            </span>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-1">
                    {completed && (
                      <span className="text-green-600 text-sm">✓</span>
                    )}
                    {hasMultiple && (
                      <span className={`text-xs font-medium mr-1 ${
                        completed ? 'text-green-700' : today ? 'text-primary-700' : 'text-gray-600'
                      }`}>
                        {dayEvents.length}×
                      </span>
                    )}
                    <span className={`text-xs ${
                      completed ? 'text-green-600' : today ? 'text-primary-600' : 'text-gray-400'
                    }`}>
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className={`px-2 py-2 text-xs border-x border-b rounded-b mb-1 space-y-2 ${
                    completed
                      ? 'bg-green-50 border-green-200'
                      : today
                      ? 'bg-primary-50 border-primary-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    {dayEvents.map((event, eventIdx) => (
                      <div key={eventIdx} className={`${eventIdx > 0 ? 'pt-2 border-t border-current/10' : ''}`}>
                        <div className="flex items-start justify-between mb-1">
                          <p className={`font-medium ${
                            completed ? 'text-green-900' : today ? 'text-primary-900' : 'text-gray-900'
                          }`}>
                            {formatWorkoutName(event)}
                            {(() => {
                              const distance = getDistance(event);
                              return distance && ` - ${distance}`;
                            })()}
                          </p>
                          {event.start_date_local && (
                            <span className={`text-xs ${
                              completed ? 'text-green-700' : today ? 'text-primary-700' : 'text-gray-600'
                            }`}>
                              {new Date(event.start_date_local).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: false
                              })}
                            </span>
                          )}
                        </div>
                        {event.description && (
                          <p className={`${
                            completed ? 'text-green-800' : today ? 'text-primary-800' : 'text-gray-700'
                          }`}>
                            {event.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default WeeklyPlan;
