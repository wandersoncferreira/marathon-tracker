import { useState, useEffect } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { generateDailyNutritionPlan, getWeeklyNutritionOverview } from '../services/nutritionService';
import {
  loadNutritionGoals,
  getWeeklyTracking,
  calculateWeeklyStats,
  getCurrentWeekStart,
  saveDailyTracking,
  getDailyTracking,
  formatDateDisplay,
  getAdherenceColor,
  calculateCycleStats,
  analyzeMealPatterns
} from '../utils/nutritionTracking';
import {
  getCarbGuidelines,
  saveCarbGuidelines,
  getCarbTrackingForRange,
  calculateWeeklyCarbStats,
  calculateCycleCarbStats,
  calculateExpectedCarbs,
  calculateCompliance,
  saveCarbIntake,
  getCarbIntake
} from '../utils/carbTracking';
import { TRAINING_CYCLE } from '../utils/trainingCycle';
import { intervalsApi } from '../services/intervalsApi';
import { metersPerSecondToPace, formatDuration } from '../utils/trainingCalculations';
import { formatDate } from '../utils/dateHelpers';

function Nutrition() {
  const { t, language } = useTranslation();

  // Meal type labels for consistent translation
  const mealLabels = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snacks: 'Snacks'
  };

  const [selectedDay, setSelectedDay] = useState('training');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [nutritionGoals, setNutritionGoals] = useState({
    primary: 'performance',
    description: 'Optimize performance for sub-2:50 marathon',
    weeklyTarget: 'Maintain 73.5kg while improving power-to-weight ratio',
    calorieStrategy: 'Periodize nutrition based on training load',
    proteinTarget: '1.6-1.8g/kg bodyweight',
    carbTarget: 'High on training days, moderate on rest days',
    expectedOutcome: 'Sustained energy, improved recovery, stable weight'
  });
  const [weeklyData, setWeeklyData] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState({
    averageRating: 0,
    daysTracked: 0,
    totalDays: 7,
    adherencePercentage: 0,
    onTrack: false,
    message: 'Start tracking your nutrition to see progress!'
  });
  const [cycleStats, setCycleStats] = useState({
    totalDays: 0,
    daysTracked: 0,
    averageRating: 0,
    adherencePercentage: 0,
    excellentDays: 0,
    goodDays: 0,
    poorDays: 0,
    failedDays: 0,
    message: 'Start tracking to see your cycle progress',
    onTrack: false
  });
  const [currentWeekStart, setCurrentWeekStart] = useState(getCurrentWeekStart());
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [trackingForm, setTrackingForm] = useState({
    rating: 5,
    notes: '',
    adherence: 'good',
    actualCalories: 0,
    meals: {
      breakfast: { rating: 0, notes: '' },
      lunch: { rating: 0, notes: '' },
      dinner: { rating: 0, notes: '' },
      snacks: { rating: 0, notes: '' }
    }
  });
  const [mealAnalysis, setMealAnalysis] = useState(null);
  const [activeView, setActiveView] = useState('analysis'); // 'analysis', 'plan', or 'supplementation'

  // Carb tracking state
  const [carbGuidelines, setCarbGuidelines] = useState({
    carbsPer30Min: 22.5,
    minDurationMinutes: 75,
    enabled: true
  });
  const [carbTrackingData, setCarbTrackingData] = useState([]);
  const [weeklyCarbStats, setWeeklyCarbStats] = useState({});
  const [cycleCarbStats, setCycleCarbStats] = useState(null);
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [selectedCarbActivity, setSelectedCarbActivity] = useState(null);

  // Load nutrition goals and weekly data
  useEffect(() => {
    const initializeTracking = async () => {
      try {
        // Load carb guidelines from database
        const guidelines = await getCarbGuidelines();
        setCarbGuidelines(guidelines);

        const goals = await loadNutritionGoals();
        setNutritionGoals(goals);

        const weekStart = getCurrentWeekStart();
        setCurrentWeekStart(weekStart);

        await loadWeeklyData(weekStart);

        // Load cycle-wide stats
        if (TRAINING_CYCLE && TRAINING_CYCLE.startDate && TRAINING_CYCLE.raceDate) {
          const cycleData = await calculateCycleStats(
            TRAINING_CYCLE.startDate,
            TRAINING_CYCLE.raceDate
          );
          if (cycleData) {
            setCycleStats(cycleData);
          }

          // Load meal pattern analysis
          const mealData = await analyzeMealPatterns(
            TRAINING_CYCLE.startDate,
            TRAINING_CYCLE.raceDate
          );
          setMealAnalysis(mealData);
        } else {
          console.warn('⚠️ Training cycle data not available');
        }
      } catch (error) {
        console.error('❌ Error initializing nutrition tracking:', error);
      }
    };

    initializeTracking();
  }, []);

  const loadWeeklyData = async (weekStart) => {
    try {
      const data = await getWeeklyTracking(weekStart);
      setWeeklyData(data);

      const stats = calculateWeeklyStats(data);
      setWeeklyStats(stats);
    } catch (error) {
      console.error('❌ Error loading weekly data:', error);
      // Set empty data on error
      setWeeklyData([]);
      setWeeklyStats({
        averageRating: 0,
        daysTracked: 0,
        totalDays: 7,
        adherencePercentage: 0,
        onTrack: false,
        message: 'Error loading data. Please try refreshing.'
      });
    }
  };

  // Load carb tracking data when supplementation tab is viewed
  useEffect(() => {
    const loadCarbTrackingData = async () => {
      if (activeView !== 'supplementation') return;
      if (!TRAINING_CYCLE || !TRAINING_CYCLE.startDate || !TRAINING_CYCLE.raceDate) return;

      try {
        // Get all activities for the training cycle
        const activities = await intervalsApi.getActivities(
          TRAINING_CYCLE.startDate,
          TRAINING_CYCLE.raceDate
        );

        // Filter for running activities only
        const runningActivities = activities.filter(a =>
          a.type === 'Run' || a.workout_type === 'Run'
        );

        // Get carb tracking data for the date range
        const trackingData = await getCarbTrackingForRange(
          TRAINING_CYCLE.startDate,
          TRAINING_CYCLE.raceDate,
          runningActivities,
          carbGuidelines
        );
        setCarbTrackingData(trackingData);

        // Calculate weekly stats
        const weeklyStats = calculateWeeklyCarbStats(trackingData);
        setWeeklyCarbStats(weeklyStats);

        // Calculate cycle-wide stats
        const cycleStats = calculateCycleCarbStats(trackingData);
        setCycleCarbStats(cycleStats);
      } catch (error) {
        console.error('❌ Error loading carb tracking data:', error);
      }
    };

    loadCarbTrackingData();
  }, [activeView]);

  // Group carb tracking data by week
  const groupCarbDataByWeek = (trackingData) => {
    const byWeek = {};

    trackingData.forEach(entry => {
      // Get week start (Monday)
      const date = new Date(entry.date.split('T')[0] + 'T12:00:00');
      const dayOfWeek = date.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - daysToMonday);

      const weekKey = weekStart.toISOString().split('T')[0];

      if (!byWeek[weekKey]) {
        byWeek[weekKey] = [];
      }

      byWeek[weekKey].push(entry);
    });

    return byWeek;
  };

  const toggleWeek = (weekKey) => {
    setExpandedWeeks(prev => ({
      ...prev,
      [weekKey]: !prev[weekKey]
    }));
  };

  const handleActivityClick = async (activityId) => {
    try {
      const activities = await intervalsApi.getActivities(
        TRAINING_CYCLE.startDate,
        TRAINING_CYCLE.raceDate
      );
      const activity = activities.find(a => a.id === activityId);
      if (activity) {
        setSelectedCarbActivity(activity);
      }
    } catch (error) {
      console.error('Error loading activity:', error);
    }
  };

  const openTrackingModal = async (date) => {
    setSelectedDate(date);
    const existing = await getDailyTracking(date);

    if (existing) {
      setTrackingForm({
        rating: existing.rating,
        notes: existing.notes || '',
        adherence: existing.adherence || 'good',
        actualCalories: existing.actualCalories || 0,
        meals: existing.meals || {
          breakfast: { rating: 0, notes: '' },
          lunch: { rating: 0, notes: '' },
          dinner: { rating: 0, notes: '' },
          snacks: { rating: 0, notes: '' }
        }
      });
    } else {
      setTrackingForm({
        rating: 5,
        notes: '',
        adherence: 'good',
        actualCalories: 0,
        meals: {
          breakfast: { rating: 0, notes: '' },
          lunch: { rating: 0, notes: '' },
          dinner: { rating: 0, notes: '' },
          snacks: { rating: 0, notes: '' }
        }
      });
    }

    setShowTrackingModal(true);
  };

  const saveTracking = async () => {
    if (!selectedDate) return;

    await saveDailyTracking(selectedDate, {
      ...trackingForm,
      plannedCalories: nutritionPlan.targets.total,
      dayType: selectedDay
    });

    await loadWeeklyData(currentWeekStart);

    // Reload cycle stats and meal analysis
    const cycleData = await calculateCycleStats(
      TRAINING_CYCLE.startDate,
      TRAINING_CYCLE.raceDate
    );
    setCycleStats(cycleData);

    const mealData = await analyzeMealPatterns(
      TRAINING_CYCLE.startDate,
      TRAINING_CYCLE.raceDate
    );
    setMealAnalysis(mealData);

    setShowTrackingModal(false);
  };

  // Generate nutrition plan for selected day type
  const nutritionPlan = generateDailyNutritionPlan(selectedDay);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('nutrition.title', '🥗 Nutrition')}
        </h1>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveView('analysis')}
              className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
                activeView === 'analysis'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Analysis
            </button>
            <button
              onClick={() => setActiveView('plan')}
              className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
                activeView === 'plan'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🍽️ Diet Plan
            </button>
            <button
              onClick={() => setActiveView('supplementation')}
              className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
                activeView === 'supplementation'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              💊 Intra-run Supplementation
            </button>
          </nav>
        </div>
      </div>

      {activeView === 'analysis' ? (
        <>
          {/* ANALYSIS VIEW */}
          {/* Nutrition Goal Section - Compact */}
          <div className="card mb-6 bg-gradient-to-r from-primary-50 to-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-primary-900 mb-1">
                  🎯 Goal: {nutritionGoals.description}
                </h2>
                <p className="text-xs text-primary-700">
                  {nutritionGoals.weeklyTarget} • {nutritionGoals.calorieStrategy}
                </p>
              </div>
            </div>
          </div>

          {/* Marathon Cycle Overview - Compact */}
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">
                🏃 Marathon Cycle - {TRAINING_CYCLE.marathonName}
              </h2>
            </div>

            {cycleStats.totalDays === 0 ? (
              <p className="text-sm text-gray-500">
                Start tracking to see your cycle progress
              </p>
            ) : (
              <>
                <div className="grid grid-cols-5 gap-2">
                  {/* Average Rating */}
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-blue-700 mb-1">Avg Rating</div>
                    <div className="text-xl font-bold text-blue-900">
                      {cycleStats.averageRating}
                    </div>
                  </div>

                  {/* Days Tracked */}
                  <div className="bg-purple-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-purple-700 mb-1">Tracked</div>
                    <div className="text-xl font-bold text-purple-900">
                      {cycleStats.daysTracked}
                    </div>
                    <div className="text-xs text-purple-600">
                      {cycleStats.adherencePercentage}%
                    </div>
                  </div>

                  {/* Excellent Days */}
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-green-700 mb-1">Excellent</div>
                    <div className="text-xl font-bold text-green-900">
                      {cycleStats.excellentDays}
                    </div>
                    <div className="text-xs text-green-600">
                      {cycleStats.daysTracked > 0 ? Math.round((cycleStats.excellentDays / cycleStats.daysTracked) * 100) : 0}%
                    </div>
                  </div>

                  {/* Good Days */}
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-blue-700 mb-1">Good</div>
                    <div className="text-xl font-bold text-blue-900">
                      {cycleStats.goodDays}
                    </div>
                    <div className="text-xs text-blue-600">
                      {cycleStats.daysTracked > 0 ? Math.round((cycleStats.goodDays / cycleStats.daysTracked) * 100) : 0}%
                    </div>
                  </div>

                  {/* Poor/Failed Days */}
                  <div className="bg-yellow-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-yellow-700 mb-1">Needs Work</div>
                    <div className="text-xl font-bold text-yellow-900">
                      {cycleStats.poorDays + cycleStats.failedDays}
                    </div>
                    <div className="text-xs text-yellow-600">
                      {cycleStats.daysTracked > 0 ? Math.round(((cycleStats.poorDays + cycleStats.failedDays) / cycleStats.daysTracked) * 100) : 0}%
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Weekly Tracking Section */}
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">
                📅 This Week's Progress
              </h2>
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                weeklyStats.onTrack
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {weeklyStats.onTrack ? '✅ On Track' : '⚠️ Need Focus'}
              </div>
            </div>

            {/* Weekly Stats Summary */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <div className="text-xs text-blue-700 mb-1">Avg Rating</div>
                <div className="text-xl font-bold text-blue-900">
                  {weeklyStats.averageRating}
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-2 text-center">
                <div className="text-xs text-green-700 mb-1">Days Tracked</div>
                <div className="text-xl font-bold text-green-900">
                  {weeklyStats.daysTracked}/7
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-2 text-center">
                <div className="text-xs text-purple-700 mb-1">Adherence</div>
                <div className="text-xl font-bold text-purple-900">
                  {weeklyStats.adherencePercentage}%
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-2xl mb-1">
                  {weeklyStats.onTrack ? '🎉' : '💪'}
                </div>
                <div className="text-xs text-gray-600">
                  {weeklyStats.onTrack ? 'Excellent!' : 'Keep going!'}
                </div>
              </div>
            </div>

            {/* Daily Tracking Grid */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Daily Tracking
              </h3>
              <div className="grid grid-cols-7 gap-2">
                {weeklyData.map((day, index) => {
                  const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString(
                    language === 'pt_BR' ? 'pt-BR' : 'en-US',
                    { weekday: 'short' }
                  );
                  const rating = day.data?.rating || 0;
                  const color = getAdherenceColor(rating);

                  return (
                    <button
                      key={day.date}
                      onClick={() => openTrackingModal(day.date)}
                      className={`p-2 rounded border-2 transition-all hover:shadow-sm ${
                        rating === 0
                          ? 'border-gray-200 bg-gray-50'
                          : color === 'green'
                          ? 'border-green-500 bg-green-50'
                          : color === 'blue'
                          ? 'border-blue-500 bg-blue-50'
                          : color === 'yellow'
                          ? 'border-yellow-500 bg-yellow-50'
                          : 'border-red-500 bg-red-50'
                      }`}
                    >
                      <div className="text-xs font-medium text-gray-700 mb-1">
                        {dayName}
                      </div>
                      <div className="text-xs text-gray-600">
                        {new Date(day.date + 'T00:00:00').getDate()}
                      </div>
                      {rating > 0 && (
                        <div className={`text-lg font-bold mt-1 ${
                          color === 'green' ? 'text-green-700' :
                          color === 'blue' ? 'text-blue-700' :
                          color === 'yellow' ? 'text-yellow-700' :
                          'text-red-700'
                        }`}>
                          {rating}
                        </div>
                      )}
                      {rating === 0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          -
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Meal Pattern Analysis */}
          {mealAnalysis && mealAnalysis.sortedMeals.length > 0 && (
            <div className="card mb-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                🍽️ Meal Pattern Analysis
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Most Problematic Meal */}
                {mealAnalysis.mostProblematic && mealAnalysis.mostProblematic.avgRating < 7 && (
                  <div className="bg-white rounded-lg p-3 border-2 border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">⚠️</span>
                      <h3 className="text-sm font-semibold text-red-900">
                        Needs Attention
                      </h3>
                    </div>
                    <div className="mb-2">
                      <div className="text-lg font-bold text-gray-900">
                        {mealLabels[mealAnalysis.mostProblematic.meal]}
                      </div>
                      <div className="text-sm text-gray-600">
                        Avg Rating: <span className="font-semibold text-red-700">{mealAnalysis.mostProblematic.avgRating}/10</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {mealAnalysis.mostProblematic.count} days tracked
                      </div>
                    </div>
                    {mealAnalysis.mostProblematic.issues.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs font-semibold text-gray-700 mb-1">
                          Recent Issues:
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          {mealAnalysis.mostProblematic.issues.slice(0, 2).map((issue, idx) => (
                            <div key={idx} className="bg-red-50 rounded p-1">
                              <div className="font-medium">{issue.date}: {issue.rating}/10</div>
                              {issue.notes && <div className="italic">&quot;{issue.notes.substring(0, 50)}...&quot;</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Best Performing Meal */}
                {mealAnalysis.bestPerforming && (
                  <div className="bg-white rounded-lg p-3 border-2 border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">✅</span>
                      <h3 className="text-sm font-semibold text-green-900">
                        Performing Well
                      </h3>
                    </div>
                    <div className="mb-2">
                      <div className="text-lg font-bold text-gray-900">
                        {mealLabels[mealAnalysis.bestPerforming.meal]}
                      </div>
                      <div className="text-sm text-gray-600">
                        Avg Rating: <span className="font-semibold text-green-700">{mealAnalysis.bestPerforming.avgRating}/10</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {mealAnalysis.bestPerforming.count} days tracked
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-xs text-green-700">
                        Great consistency! Keep up the good work with this meal.
                      </div>
                    </div>
                  </div>
                )}
          </div>

              {/* All Meals Summary */}
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-gray-700 mb-2">
                  All Meals Overview
                </h4>
                <div className="grid grid-cols-4 gap-2">
                  {mealAnalysis.sortedMeals.map(meal => (
                    <div key={meal.meal} className="text-center p-2 bg-gray-50 rounded">
                      <div className="text-xs font-medium text-gray-700 mb-1">
                        {mealLabels[meal.meal]}
                      </div>
                      <div className={`text-lg font-bold ${
                        parseFloat(meal.avgRating) >= 8 ? 'text-green-700' :
                        parseFloat(meal.avgRating) >= 6 ? 'text-blue-700' :
                        parseFloat(meal.avgRating) >= 4 ? 'text-yellow-700' :
                        'text-red-700'
                      }`}>
                        {meal.avgRating}
                      </div>
                      <div className="text-xs text-gray-500">
                        {meal.count} days
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      ) : activeView === 'plan' ? (
        <>
          {/* DIET PLAN VIEW */}

          {/* Day Type Selector */}
          <div className="card mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Select Day Type
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setSelectedDay('training')}
                className={`p-3 rounded border-2 transition-all ${
                  selectedDay === 'training'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300'
                }`}
              >
                <div className="text-xl mb-1">🏃</div>
                <div className="text-sm font-medium text-gray-900">
                  Training Day
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Regular workout
                </div>
              </button>

              <button
                onClick={() => setSelectedDay('carb-load')}
                className={`p-3 rounded border-2 transition-all ${
                  selectedDay === 'carb-load'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300'
                }`}
              >
                <div className="text-xl mb-1">📈</div>
                <div className="text-sm font-medium text-gray-900">
                  Friday
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Pre-long run
                </div>
              </button>

              <button
                onClick={() => setSelectedDay('rest')}
                className={`p-3 rounded border-2 transition-all ${
                  selectedDay === 'rest'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300'
                }`}
              >
                <div className="text-xl mb-1">😴</div>
                <div className="text-sm font-medium text-gray-900">
                  Sunday
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Rest day
                </div>
              </button>
            </div>
          </div>

          {/* Energy & Macro Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Daily Targets */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  Daily Targets
                </h3>
                <button
                  onClick={() => setShowInfoModal(true)}
                  className="text-primary-600 hover:text-primary-700 text-sm"
                >
                  ℹ️
                </button>
              </div>

              <div className="space-y-3">
                {/* Total Calories */}
                <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded p-3">
                  <div className="text-xs text-primary-700 mb-1">
                    Total Calories
                  </div>
                  <div className="text-2xl font-bold text-primary-900">
                    {nutritionPlan.targets.total} <span className="text-sm font-normal">kcal</span>
                  </div>
                  <div className="text-xs text-primary-600 mt-1">
                    {nutritionPlan.energyNeeds.description}
                  </div>
                </div>

                {/* Macros Breakdown */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Carbs */}
                  <div className="bg-blue-50 rounded p-2 text-center">
                    <div className="text-xs text-blue-700 mb-1">
                      Carbs
                    </div>
                    <div className="text-lg font-bold text-blue-900">
                      {nutritionPlan.targets.carbs.grams}g
                    </div>
                    <div className="text-xs text-blue-600">
                      {nutritionPlan.targets.carbs.percent}%
                    </div>
                  </div>

                  {/* Protein */}
                  <div className="bg-red-50 rounded p-2 text-center">
                    <div className="text-xs text-red-700 mb-1">
                      Protein
                    </div>
                    <div className="text-lg font-bold text-red-900">
                      {nutritionPlan.targets.protein.grams}g
                    </div>
                    <div className="text-xs text-red-600">
                      {nutritionPlan.targets.protein.percent}%
                    </div>
                  </div>

                  {/* Fats */}
                  <div className="bg-yellow-50 rounded p-2 text-center">
                    <div className="text-xs text-yellow-700 mb-1">
                      Fats
                    </div>
                    <div className="text-lg font-bold text-yellow-900">
                      {nutritionPlan.targets.fats.grams}g
                    </div>
                    <div className="text-xs text-yellow-600">
                      {nutritionPlan.targets.fats.percent}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Hydration & Supplements */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Hydration & Supplements
              </h3>

              {/* Hydration */}
              <div className="mb-3 bg-blue-50 rounded p-2">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-sm">💧</span>
                  <h4 className="text-xs font-medium text-blue-900">
                    Hydration
                  </h4>
                </div>
                <div className="text-xs text-blue-800 space-y-1">
                  <div>Daily: <strong>{nutritionPlan.hydration.baseWater}</strong></div>
                  <div>Training: <strong>{nutritionPlan.hydration.duringTraining}</strong></div>
                </div>
              </div>

              {/* Supplements */}
              <div>
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-sm">💊</span>
                  <h4 className="text-xs font-medium text-gray-900">
                    Supplements
                  </h4>
                </div>
                <div className="space-y-1">
                  {nutritionPlan.supplements.map((supp, idx) => (
                    <div key={idx} className="text-xs bg-gray-50 rounded p-2">
                      <div className="font-medium text-gray-900">{supp.name}</div>
                      <div className="text-gray-600">{supp.dose} • {supp.timing}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

      {/* Meal Plan */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {t('nutrition.mealPlan', 'Meal Plan')}
        </h2>

        {/* Pre-Training (only if not rest day) */}
        {nutritionPlan.meals.preTraining.total.cal > 0 && (
          <MealCard meal={nutritionPlan.meals.preTraining} icon="⚡" />
        )}

        {/* Breakfast */}
        <MealCard meal={nutritionPlan.meals.breakfast} icon="🌅" />

        {/* Lunch */}
        <MealCard meal={nutritionPlan.meals.lunch} icon="🍽️" />

        {/* Afternoon Snack */}
        <MealCard meal={nutritionPlan.meals.afternoonSnack} icon="🥤" />

        {/* Dinner */}
        <MealCard meal={nutritionPlan.meals.dinner} icon="🌙" />

        {/* Pre-Bed */}
        <MealCard meal={nutritionPlan.meals.preBed} icon="😴" />
      </div>

          {/* Daily Summary */}
          <div className="card mt-6 bg-gradient-to-r from-gray-50 to-blue-50">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Daily Summary
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <div className="text-xs text-gray-600 mb-1">Calories</div>
                <div className="text-lg font-bold text-primary-900">
                  {nutritionPlan.dailyTotals.calories}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-600 mb-1">Carbs</div>
                <div className="text-lg font-bold text-blue-700">
                  {nutritionPlan.dailyTotals.carbs}g
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-600 mb-1">Protein</div>
                <div className="text-lg font-bold text-red-700">
                  {nutritionPlan.dailyTotals.protein}g
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-600 mb-1">Fats</div>
                <div className="text-lg font-bold text-yellow-700">
                  {nutritionPlan.dailyTotals.fats}g
                </div>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="card mt-6 bg-primary-50 border-2 border-primary-200">
            <h3 className="text-sm font-semibold text-primary-900 mb-2">
              💡 Nutrition Tips
            </h3>
            <ul className="space-y-1">
              {nutritionPlan.tips.map((tip, idx) => (
                <li key={idx} className="text-xs text-primary-800 flex items-start">
                  <span className="mr-2">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <>
          {/* SUPPLEMENTATION VIEW */}

          {/* Carb Guidelines Configuration */}
          <div className="card mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              ⚙️ Carb Guidelines Configuration
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Carbs per 30 minutes (grams)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={carbGuidelines.carbsPer30Min}
                  onChange={async (e) => {
                    const newGuidelines = {
                      ...carbGuidelines,
                      carbsPer30Min: parseFloat(e.target.value) || 0
                    };
                    setCarbGuidelines(newGuidelines);
                    await saveCarbGuidelines(newGuidelines);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Recommended: 20-25g per 30min
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Minimum Duration (minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="300"
                  step="15"
                  value={carbGuidelines.minDurationMinutes}
                  onChange={async (e) => {
                    const newGuidelines = {
                      ...carbGuidelines,
                      minDurationMinutes: parseInt(e.target.value) || 0
                    };
                    setCarbGuidelines(newGuidelines);
                    await saveCarbGuidelines(newGuidelines);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Track carbs for runs longer than this
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Tracking Enabled
                </label>
                <button
                  onClick={async () => {
                    const newGuidelines = {
                      ...carbGuidelines,
                      enabled: !carbGuidelines.enabled
                    };
                    setCarbGuidelines(newGuidelines);
                    await saveCarbGuidelines(newGuidelines);
                  }}
                  className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors ${
                    carbGuidelines.enabled
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  }`}
                >
                  {carbGuidelines.enabled ? '✅ Enabled' : '❌ Disabled'}
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  {carbGuidelines.enabled ? 'Carb tracking is active' : 'Carb tracking is disabled'}
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>💡 How it works:</strong> For runs longer than {carbGuidelines.minDurationMinutes} minutes,
                you should consume approximately {carbGuidelines.carbsPer30Min}g of carbs every 30 minutes throughout the run.
              </p>
            </div>
          </div>

          {/* Marathon Cycle Carb Adherence */}
          {cycleCarbStats && (
            <div className="card mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                🏃 Marathon Cycle - Carb Adherence
              </h2>

              {cycleCarbStats.totalActivities === 0 ? (
                <p className="text-sm text-gray-500">
                  No runs longer than {carbGuidelines.minDurationMinutes} minutes found in this training cycle yet.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                    <div className="bg-purple-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-purple-700 mb-1">Runs &gt;{carbGuidelines.minDurationMinutes}min</div>
                      <div className="text-2xl font-bold text-purple-900">
                        {cycleCarbStats.totalActivities}
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-blue-700 mb-1">Tracked</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {cycleCarbStats.trackedActivities}
                      </div>
                      <div className="text-xs text-blue-600">
                        {cycleCarbStats.trackingPercentage}%
                      </div>
                    </div>

                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-green-700 mb-1">Compliant</div>
                      <div className="text-2xl font-bold text-green-900">
                        {cycleCarbStats.compliantActivities}
                      </div>
                      <div className="text-xs text-green-600">
                        {cycleCarbStats.compliancePercentage}%
                      </div>
                    </div>

                    <div className="bg-yellow-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-yellow-700 mb-1">Expected</div>
                      <div className="text-2xl font-bold text-yellow-900">
                        {cycleCarbStats.totalExpected}g
                      </div>
                    </div>

                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-orange-700 mb-1">Actual</div>
                      <div className="text-2xl font-bold text-orange-900">
                        {cycleCarbStats.totalActual}g
                      </div>
                      <div className="text-xs text-orange-600">
                        {cycleCarbStats.overallCompliance}%
                      </div>
                    </div>
                  </div>

                  {cycleCarbStats.message && (
                    <div className={`p-3 rounded-lg ${
                      cycleCarbStats.compliancePercentage >= 80
                        ? 'bg-green-50 border border-green-200'
                        : cycleCarbStats.compliancePercentage >= 60
                        ? 'bg-blue-50 border border-blue-200'
                        : 'bg-yellow-50 border border-yellow-200'
                    }`}>
                      <p className={`text-sm font-medium ${
                        cycleCarbStats.compliancePercentage >= 80
                          ? 'text-green-800'
                          : cycleCarbStats.compliancePercentage >= 60
                          ? 'text-blue-800'
                          : 'text-yellow-800'
                      }`}>
                        {cycleCarbStats.message}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Activities Requiring Tracking - Grouped by Week */}
          {carbTrackingData && carbTrackingData.length > 0 && (() => {
            const groupedByWeek = groupCarbDataByWeek(carbTrackingData);
            const weekKeys = Object.keys(groupedByWeek).sort((a, b) => b.localeCompare(a));

            return (
              <div className="card mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  🏃 Runs Requiring Carb Tracking
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  Runs longer than {carbGuidelines.minDurationMinutes} minutes grouped by week. Click on runs to view details and track carb intake.
                </p>

                <div className="space-y-3">
                  {weekKeys.map((weekKey) => {
                    const weekActivities = groupedByWeek[weekKey];
                    const weekDate = new Date(weekKey + 'T12:00:00');
                    const weekLabel = weekDate.toLocaleDateString(
                      language === 'pt_BR' ? 'pt-BR' : 'en-US',
                      { month: 'short', day: 'numeric' }
                    );

                    const trackedCount = weekActivities.filter(a => a.tracked).length;
                    const compliantCount = weekActivities.filter(a => a.compliance && a.compliance.percentage >= 70).length;
                    const isExpanded = expandedWeeks[weekKey];

                    return (
                      <div key={weekKey} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleWeek(weekKey)}
                          className="w-full bg-gray-50 hover:bg-gray-100 transition-colors p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">
                                {isExpanded ? '▼' : '▶'}
                              </span>
                              <div className="text-left">
                                <div className="text-sm font-semibold text-gray-900">
                                  Week of {weekLabel}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {weekActivities.length} run{weekActivities.length !== 1 ? 's' : ''} • {trackedCount} tracked • {compliantCount} compliant
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {trackedCount === weekActivities.length ? (
                                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                                  ✅ All Tracked
                                </span>
                              ) : trackedCount > 0 ? (
                                <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                                  ⚠️ Partial
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                                  ❌ None
                                </span>
                              )}
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="p-3 space-y-2 bg-white">
                            {weekActivities
                              .sort((a, b) => new Date(b.date) - new Date(a.date))
                              .map((activity) => {
                                const date = new Date(activity.date);
                                const dateLabel = date.toLocaleDateString(
                                  language === 'pt_BR' ? 'pt-BR' : 'en-US',
                                  { weekday: 'short', month: 'short', day: 'numeric' }
                                );

                                return (
                                  <div
                                    key={activity.activityId}
                                    onClick={() => handleActivityClick(activity.activityId)}
                                    className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${
                                      activity.tracked
                                        ? activity.compliance.level === 'excellent'
                                          ? 'bg-green-50 border-green-200 hover:border-green-300'
                                          : activity.compliance.level === 'good'
                                          ? 'bg-blue-50 border-blue-200 hover:border-blue-300'
                                          : activity.compliance.level === 'fair'
                                          ? 'bg-yellow-50 border-yellow-200 hover:border-yellow-300'
                                          : 'bg-red-50 border-red-200 hover:border-red-300'
                                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1">
                                        <div className="text-sm font-semibold text-gray-900">
                                          {activity.name}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                          {dateLabel}
                                        </div>
                                      </div>

                                      {activity.tracked && (
                                        <div className={`px-2 py-1 text-xs font-medium rounded ${
                                          activity.compliance.level === 'excellent' ? 'bg-green-100 text-green-800' :
                                          activity.compliance.level === 'good' ? 'bg-blue-100 text-blue-800' :
                                          activity.compliance.level === 'fair' ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-red-100 text-red-800'
                                        }`}>
                                          {activity.compliance.percentage}%
                                        </div>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                      <div>
                                        <p className="text-xs text-gray-600">Duration</p>
                                        <p className="text-sm font-bold text-gray-900">
                                          {activity.duration} min
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-600">Expected</p>
                                        <p className="text-sm font-bold text-gray-900">
                                          {activity.expected}g
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-600">Actual</p>
                                        <p className={`text-sm font-bold ${
                                          activity.tracked
                                            ? activity.compliance.level === 'excellent' ? 'text-green-700' :
                                              activity.compliance.level === 'good' ? 'text-blue-700' :
                                              activity.compliance.level === 'fair' ? 'text-yellow-700' :
                                              'text-red-700'
                                            : 'text-gray-400'
                                        }`}>
                                          {activity.tracked ? `${activity.actual}g` : '-'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-gray-500 mt-4 text-center">
                  Total: {carbTrackingData.length} run{carbTrackingData.length !== 1 ? 's' : ''} longer than {carbGuidelines.minDurationMinutes} minutes
                </p>
              </div>
            );
          })()}

          {/* Weekly Carb Adherence */}
          {Object.keys(weeklyCarbStats).length > 0 && (
            <div className="card mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                📅 Weekly Carb Adherence
              </h2>

              <div className="space-y-3">
                {Object.keys(weeklyCarbStats)
                  .sort((a, b) => b.localeCompare(a))
                  .slice(0, 8)
                  .map((weekKey) => {
                    const week = weeklyCarbStats[weekKey];
                    const weekDate = new Date(weekKey + 'T12:00:00');
                    const weekLabel = weekDate.toLocaleDateString(
                      language === 'pt_BR' ? 'pt-BR' : 'en-US',
                      { month: 'short', day: 'numeric' }
                    );

                    return (
                      <div key={weekKey} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-semibold text-gray-900">
                            Week of {weekLabel}
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            week.compliancePercentage >= 80
                              ? 'bg-green-100 text-green-800'
                              : week.compliancePercentage >= 60
                              ? 'bg-blue-100 text-blue-800'
                              : week.compliancePercentage >= 40
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {week.compliancePercentage}% Compliant
                          </div>
                        </div>

                        <div className="grid grid-cols-5 gap-2">
                          <div className="text-center">
                            <div className="text-xs text-gray-600">Runs &gt;{carbGuidelines.minDurationMinutes}min</div>
                            <div className="text-lg font-bold text-gray-900">
                              {week.totalActivities}
                            </div>
                          </div>

                          <div className="text-center">
                            <div className="text-xs text-gray-600">Tracked</div>
                            <div className="text-lg font-bold text-blue-700">
                              {week.trackedActivities}
                            </div>
                          </div>

                          <div className="text-center">
                            <div className="text-xs text-gray-600">Compliant</div>
                            <div className="text-lg font-bold text-green-700">
                              {week.compliantActivities}
                            </div>
                          </div>

                          <div className="text-center">
                            <div className="text-xs text-gray-600">Expected</div>
                            <div className="text-sm font-bold text-gray-900">
                              {week.totalExpected}g
                            </div>
                          </div>

                          <div className="text-center">
                            <div className="text-xs text-gray-600">Actual</div>
                            <div className="text-sm font-bold text-gray-900">
                              {week.totalActual}g
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="card bg-blue-50 border-2 border-blue-200">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              ℹ️ About Carb Supplementation
            </h3>
            <div className="text-sm text-blue-800 space-y-2">
              <p>
                Carbohydrate supplementation during long runs helps maintain blood glucose levels and
                delay fatigue. The app tracks runs longer than {carbGuidelines.minDurationMinutes} minutes
                and calculates expected carb intake based on your guidelines ({carbGuidelines.carbsPer30Min}g every 30min).
              </p>
              <p>
                <strong>How it works:</strong> For a 93-minute run, you'd take gels at 30, 60, and 90 minutes
                (3 gels × {carbGuidelines.carbsPer30Min}g = {Math.round(3 * carbGuidelines.carbsPer30Min)}g expected).
              </p>
              <p>
                <strong>Compliance Levels:</strong>
              </p>
              <ul className="text-xs space-y-1 ml-4">
                <li>• <strong>Excellent (≥90%):</strong> Within 10% of target</li>
                <li>• <strong>Good (≥70%):</strong> Within 30% of target</li>
                <li>• <strong>Fair (≥50%):</strong> Within 50% of target</li>
                <li>• <strong>Poor (&lt;50%):</strong> Needs improvement</li>
              </ul>
              <p className="text-xs mt-2 font-semibold">
                💡 To track carb intake: Go to Training Log → Click on a run &gt;{carbGuidelines.minDurationMinutes}min → Fill in the carb tracking form
              </p>
              <p className="text-xs text-blue-700 italic mt-2">
                Note: Not all runs &gt;{carbGuidelines.minDurationMinutes}min require carb supplementation (e.g., easy runs).
                Only track when you actually take gels/carbs during the run.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <InfoModal
          nutritionPlan={nutritionPlan}
          onClose={() => setShowInfoModal(false)}
        />
      )}

      {/* Tracking Modal */}
      {showTrackingModal && selectedDate && (
        <TrackingModal
          date={selectedDate}
          trackingForm={trackingForm}
          setTrackingForm={setTrackingForm}
          onSave={saveTracking}
          onClose={() => setShowTrackingModal(false)}
          language={language}
        />
      )}

      {/* Activity Detail Modal for Carb Tracking */}
      {selectedCarbActivity && (
        <CarbActivityDetailModal
          activity={selectedCarbActivity}
          onClose={() => setSelectedCarbActivity(null)}
          language={language}
          guidelines={carbGuidelines}
          onSaved={async () => {
            // Reload carb tracking data after saving
            if (TRAINING_CYCLE && TRAINING_CYCLE.startDate && TRAINING_CYCLE.raceDate) {
              const activities = await intervalsApi.getActivities(
                TRAINING_CYCLE.startDate,
                TRAINING_CYCLE.raceDate
              );
              const runningActivities = activities.filter(a =>
                a.type === 'Run' || a.workout_type === 'Run'
              );
              const trackingData = await getCarbTrackingForRange(
                TRAINING_CYCLE.startDate,
                TRAINING_CYCLE.raceDate,
                runningActivities,
                carbGuidelines
              );
              setCarbTrackingData(trackingData);

              const weeklyStats = calculateWeeklyCarbStats(trackingData);
              setWeeklyCarbStats(weeklyStats);

              const cycleStats = calculateCycleCarbStats(trackingData);
              setCycleCarbStats(cycleStats);
            }
          }}
        />
      )}
    </div>
  );
}

/**
 * Meal Card Component
 */
function MealCard({ meal, icon }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{icon}</span>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">
                {meal.name}
              </h3>
              <p className="text-sm text-gray-500">{meal.timing}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-600">
                {t('nutrition.target', 'Target')}
              </div>
              <div className="text-xl font-bold text-primary-600">
                {meal.targetCalories} kcal
              </div>
            </div>
            <span className="text-2xl text-gray-400">
              {expanded ? '▼' : '▶'}
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          {/* Foods List */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">
                    {t('nutrition.food', 'Food')}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">
                    {t('nutrition.amount', 'Amount')}
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">
                    {t('nutrition.calories', 'Cal')}
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">
                    {t('nutrition.carbs', 'C')}
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">
                    {t('nutrition.protein', 'P')}
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">
                    {t('nutrition.fats', 'F')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {meal.foods.map((food, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900">{food.item}</td>
                    <td className="px-3 py-2 text-gray-600">{food.amount}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      {food.cal}
                    </td>
                    <td className="px-3 py-2 text-right text-blue-700">
                      {food.carbs}g
                    </td>
                    <td className="px-3 py-2 text-right text-red-700">
                      {food.protein}g
                    </td>
                    <td className="px-3 py-2 text-right text-yellow-700">
                      {food.fats}g
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 font-semibold">
                <tr>
                  <td className="px-3 py-2" colSpan="2">
                    {t('nutrition.total', 'Total')}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900">
                    {meal.total.cal}
                  </td>
                  <td className="px-3 py-2 text-right text-blue-800">
                    {meal.total.carbs}g
                  </td>
                  <td className="px-3 py-2 text-right text-red-800">
                    {meal.total.protein}g
                  </td>
                  <td className="px-3 py-2 text-right text-yellow-800">
                    {meal.total.fats}g
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {meal.notes && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>💡 {t('nutrition.note', 'Note')}:</strong> {meal.notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Info Modal Component
 */
function InfoModal({ nutritionPlan, onClose }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {t('nutrition.howCalculated', 'How Nutrition Plan is Calculated')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Energy Calculation */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">
              {t('nutrition.energyCalculation', 'Energy Calculation')}
            </h3>
            <div className="text-sm text-blue-800 space-y-2">
              <p>
                <strong>{t('nutrition.bmr', 'BMR (Basal Metabolic Rate)')}:</strong>{' '}
                {nutritionPlan.energyNeeds.bmr} kcal
              </p>
              <p className="text-xs text-blue-700">
                {t('nutrition.bmrDesc', 'Energy needed for basic body functions at rest (Mifflin-St Jeor equation)')}
              </p>
              <p className="mt-2">
                <strong>{t('nutrition.tdee', 'TDEE (Total Daily Energy Expenditure)')}:</strong>{' '}
                {nutritionPlan.energyNeeds.tdee} kcal
              </p>
              <p className="text-xs text-blue-700">
                {t('nutrition.tdeeDesc', 'BMR × Activity Factor based on training load')}
              </p>
            </div>
          </div>

          {/* Macros Rationale */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">
              {t('nutrition.macrosRationale', 'Macronutrient Rationale')}
            </h3>
            <div className="text-sm text-green-800 space-y-2">
              <p>
                <strong>{t('nutrition.protein', 'Protein')}:</strong>{' '}
                {nutritionPlan.targets.protein.grams}g ({(nutritionPlan.targets.protein.grams / nutritionPlan.athlete.weight).toFixed(1)}g/kg)
              </p>
              <p className="text-xs text-green-700 ml-4">
                {t('nutrition.proteinDesc', '• Essential for muscle repair and recovery\n• 1.6-1.8g/kg for endurance athletes (Phillips & Van Loon, 2011)')}
              </p>
              <p className="mt-2">
                <strong>{t('nutrition.carbs', 'Carbs')}:</strong>{' '}
                {nutritionPlan.targets.carbs.grams}g ({nutritionPlan.targets.carbs.percent}%)
              </p>
              <p className="text-xs text-green-700 ml-4">
                {t('nutrition.carbsDesc', '• Primary fuel for high-intensity training\n• Varies by training load: 45-60% of calories')}
              </p>
              <p className="mt-2">
                <strong>{t('nutrition.fats', 'Fats')}:</strong>{' '}
                {nutritionPlan.targets.fats.grams}g ({nutritionPlan.targets.fats.percent}%)
              </p>
              <p className="text-xs text-green-700 ml-4">
                {t('nutrition.fatsDesc', '• Hormone production and long-term energy\n• 20-30% of calories for optimal health')}
              </p>
            </div>
          </div>

          {/* Research References */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              {t('nutrition.researchReferences', 'Research References')}
            </h3>
            <ul className="text-xs text-gray-700 space-y-1">
              <li>• Burke, L.M. et al. (2011). Carbohydrates for training and competition. Journal of Sports Sciences.</li>
              <li>• Phillips, S.M. & Van Loon, L.J. (2011). Dietary protein for athletes. Sports Medicine.</li>
              <li>• Thomas, D.T. et al. (2016). Position of the Academy of Nutrition and Dietetics. Medicine & Science in Sports & Exercise.</li>
              <li>• Jeukendrup, A.E. (2014). A Step Towards Personalized Sports Nutrition. Sports Medicine.</li>
            </ul>
          </div>

          {/* Disclaimer */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ {t('nutrition.disclaimer', 'Disclaimer')}:</strong>{' '}
              {t('nutrition.disclaimerText', 'This is a general nutrition plan based on scientific literature and typical athlete profiles. Individual needs vary. Consult a sports nutritionist or registered dietitian for personalized recommendations.')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Tracking Modal Component
 */
function TrackingModal({ date, trackingForm, setTrackingForm, onSave, onClose, language }) {
  const { t } = useTranslation();

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(language === 'pt_BR' ? 'pt-BR' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {t('nutrition.trackDay', 'Track Your Day')}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {formatDate(date)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Meal-Level Ratings */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              🍽️ Rate Each Meal
            </h3>
            <p className="text-xs text-blue-700 mb-4">
              Rate each meal individually. Your day rating will be calculated automatically.
            </p>

            <div className="space-y-4">
              {[
                { key: 'breakfast', label: 'Breakfast' },
                { key: 'lunch', label: 'Lunch' },
                { key: 'dinner', label: 'Dinner' },
                { key: 'snacks', label: 'Snacks' }
              ].map(({ key, label }) => {
                const meal = trackingForm.meals[key];
                return (
                  <div key={key} className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-semibold text-gray-900">
                        {label}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="10"
                          value={meal.rating}
                          onChange={(e) => {
                            const newMeals = {
                              ...trackingForm.meals,
                              [key]: { ...meal, rating: parseInt(e.target.value) }
                            };
                            setTrackingForm({ ...trackingForm, meals: newMeals });
                          }}
                          className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                        />
                        <div className={`text-lg font-bold min-w-[2rem] text-center ${
                          meal.rating >= 8 ? 'text-green-700' :
                          meal.rating >= 6 ? 'text-blue-700' :
                          meal.rating >= 4 ? 'text-yellow-700' :
                          meal.rating > 0 ? 'text-red-700' :
                          'text-gray-400'
                        }`}>
                          {meal.rating > 0 ? meal.rating : '-'}
                        </div>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={meal.notes}
                      onChange={(e) => {
                        const newMeals = {
                          ...trackingForm.meals,
                          [key]: { ...meal, notes: e.target.value }
                        };
                        setTrackingForm({ ...trackingForm, meals: newMeals });
                      }}
                      placeholder="Notes (e.g., timing, portions, how you felt)..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overall Day Rating (Auto-calculated or Manual) */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Overall Day Rating
            </label>
            {(() => {
              const mealRatings = Object.values(trackingForm.meals)
                .map(m => m.rating)
                .filter(r => r > 0);

              if (mealRatings.length > 0) {
                const avgRating = Math.round(mealRatings.reduce((sum, r) => sum + r, 0) / mealRatings.length);
                return (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-green-700 mb-1">
                          Auto-calculated from meals
                        </div>
                        <div className="text-xs text-green-600">
                          Based on {mealRatings.length} meal{mealRatings.length > 1 ? 's' : ''} rated
                        </div>
                      </div>
                      <div className="text-4xl font-bold text-green-700">
                        {avgRating}
                      </div>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={trackingForm.rating}
                        onChange={(e) => setTrackingForm({ ...trackingForm, rating: parseInt(e.target.value) })}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                      />
                      <div className="text-3xl font-bold text-primary-600 min-w-[3rem] text-center">
                        {trackingForm.rating}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>0 - Terrible</span>
                      <span>5 - Okay</span>
                      <span>10 - Perfect</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 italic">
                      Rate individual meals above for more detailed insights
                    </div>
                  </div>
                );
              }
            })()}
          </div>

          {/* Adherence Level */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              {t('nutrition.adherenceLevel', 'Adherence Level')}
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 'excellent', label: t('nutrition.excellent', 'Excellent'), emoji: '🎉', color: 'green' },
                { value: 'good', label: t('nutrition.good', 'Good'), emoji: '👍', color: 'blue' },
                { value: 'poor', label: t('nutrition.poor', 'Poor'), emoji: '😐', color: 'yellow' },
                { value: 'failed', label: t('nutrition.failed', 'Failed'), emoji: '❌', color: 'red' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTrackingForm({ ...trackingForm, adherence: option.value })}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    trackingForm.adherence === option.value
                      ? `border-${option.color}-500 bg-${option.color}-50`
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{option.emoji}</div>
                  <div className="text-sm font-medium text-gray-900">
                    {option.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Actual Calories (Optional) */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              {t('nutrition.actualCalories', 'Actual Calories Consumed')} ({t('nutrition.optional', 'optional')})
            </label>
            <input
              type="number"
              min="0"
              max="10000"
              value={trackingForm.actualCalories || ''}
              onChange={(e) => setTrackingForm({ ...trackingForm, actualCalories: parseInt(e.target.value) || 0 })}
              placeholder={t('nutrition.caloriesPlaceholder', 'e.g., 2800')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              {t('nutrition.notes', 'Notes')}
            </label>
            <textarea
              value={trackingForm.notes}
              onChange={(e) => setTrackingForm({ ...trackingForm, notes: e.target.value })}
              rows="4"
              placeholder={t('nutrition.notesPlaceholder', 'What went well? What could be improved? Any challenges?')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onSave}
              className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              {t('nutrition.saveTracking', 'Save Tracking')}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('nutrition.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Activity Detail Modal for Carb Tracking
 */
function CarbActivityDetailModal({ activity, onClose, language, guidelines, onSaved }) {
  const { t } = useTranslation();
  const [carbData, setCarbData] = useState(null);
  const [carbForm, setCarbForm] = useState({ carbGrams: 0, notes: '' });
  const [showCarbForm, setShowCarbForm] = useState(false);
  const [savingCarbs, setSavingCarbs] = useState(false);

  const durationMinutes = activity.moving_time ? Math.round(activity.moving_time / 60) : 0;
  const expectedCarbs = calculateExpectedCarbs(durationMinutes, guidelines);

  useEffect(() => {
    async function fetchCarbData() {
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

    if (activity?.id) {
      fetchCarbData();
    }
  }, [activity?.id]);

  const handleSaveCarbs = async () => {
    setSavingCarbs(true);
    try {
      const saved = await saveCarbIntake(
        activity.id,
        parseInt(carbForm.carbGrams) || 0,
        carbForm.notes
      );
      setCarbData(saved);
      setShowCarbForm(false);
      if (onSaved) {
        await onSaved();
      }
      alert('✅ Carb intake saved successfully!');
    } catch (error) {
      console.error('Error saving carb intake:', error);
      alert('❌ Error saving carb intake: ' + error.message);
    } finally {
      setSavingCarbs(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {activity.name || 'Run'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {formatDate(activity.start_date_local, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Activity Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600">{t('common.distance')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {((activity.distance || 0) / 1000).toFixed(2)} km
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600">{t('common.duration')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatDuration(activity.moving_time || activity.elapsed_time)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {activity.average_speed && (
              <div>
                <p className="text-xs text-gray-600">{t('common.avgPace')}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {metersPerSecondToPace(activity.average_speed)}
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
            {(activity.icu_training_load || activity.training_load || activity.load) && (
              <div>
                <p className="text-xs text-gray-600">{t('common.load')}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {activity.icu_training_load || activity.training_load || activity.load}
                </p>
              </div>
            )}
          </div>

          {/* Carb Supplementation Tracking */}
          <div className="pt-4 border-t border-gray-200">
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

          {/* Close Button */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Nutrition;
