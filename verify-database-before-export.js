// Run this in browser console BEFORE exporting
// This will show you what's actually in the database

import { db } from './src/services/database.js';

async function verifyDatabase() {
  console.log('🔍 VERIFYING DATABASE BEFORE EXPORT...\n');

  // Check nutrition tracking
  const nutritionData = await db.nutritionTracking.toArray();
  console.log(`📊 Nutrition Tracking: ${nutritionData.length} total entries`);
  if (nutritionData.length > 0) {
    const sorted = nutritionData.sort((a, b) => b.date.localeCompare(a.date));
    console.log('  📅 Dates range:', sorted[sorted.length - 1].date, 'to', sorted[0].date);
    console.log('  🆕 Most recent 3 entries:');
    sorted.slice(0, 3).forEach(entry => {
      console.log(`    - ${entry.date}: rating=${entry.rating}, meals rated=${Object.values(entry.meals).filter(m => m.rating > 0).length}`);
    });
  }

  // Check carb tracking
  const carbData = await db.carbTracking.toArray();
  console.log(`\n🥤 Carb Tracking: ${carbData.length} total entries`);
  if (carbData.length > 0) {
    const sorted = carbData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    console.log('  🆕 Most recent 3 entries:');
    sorted.slice(0, 3).forEach(entry => {
      console.log(`    - Activity ${entry.activityId}: ${entry.carbGrams}g (${entry.timestamp})`);
    });
  }

  // Check config
  const configData = await db.config.toArray();
  console.log(`\n⚙️ Config: ${configData.length} total entries`);
  const relevantConfig = configData.filter(c =>
    c.key === 'nutritionGoals' || c.key === 'carbGuidelines'
  );
  console.log(`  📋 Relevant config entries: ${relevantConfig.length}`);
  relevantConfig.forEach(c => {
    console.log(`    - ${c.key}: ${c.value ? 'EXISTS' : 'EMPTY'}`);
  });

  // Check activities (to verify database is working)
  const activitiesCount = await db.activities.count();
  const recentActivity = await db.activities
    .orderBy('start_date_local')
    .reverse()
    .first();
  console.log(`\n🏃 Activities: ${activitiesCount} total`);
  if (recentActivity) {
    console.log(`  🆕 Most recent: ${recentActivity.name} (${recentActivity.start_date_local})`);
  }

  console.log('\n✅ Verification complete. If your data shows above, it should export.');
  console.log('❌ If your data is missing above, it was never saved to IndexedDB.');
}

verifyDatabase();
