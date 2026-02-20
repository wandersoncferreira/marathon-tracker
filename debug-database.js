// Debug script to check database contents
// Copy and paste this into the browser console

(async () => {
  const { db } = await import('./src/services/database.js');

  console.log('=== DATABASE DEBUG ===');

  // Check nutrition tracking
  const nutritionData = await db.nutritionTracking.toArray();
  console.log(`\n📊 Nutrition Tracking: ${nutritionData.length} entries`);
  if (nutritionData.length > 0) {
    console.log('Most recent:', nutritionData[nutritionData.length - 1]);
  }

  // Check carb tracking
  const carbData = await db.carbTracking.toArray();
  console.log(`\n🥤 Carb Tracking: ${carbData.length} entries`);
  if (carbData.length > 0) {
    console.log('Most recent:', carbData[carbData.length - 1]);
  }

  // Check config
  const configData = await db.config.toArray();
  console.log(`\n⚙️ Config: ${configData.length} entries`);
  configData.forEach(c => console.log(`  - ${c.key}:`, c.value));

  // Check activities count
  const activitiesCount = await db.activities.count();
  console.log(`\n🏃 Activities: ${activitiesCount} total`);

  // Get most recent activity
  const recentActivity = await db.activities
    .orderBy('start_date_local')
    .reverse()
    .first();
  if (recentActivity) {
    console.log('Most recent activity:', recentActivity.name, recentActivity.start_date_local);
  }

  console.log('\n=== END DEBUG ===');
})();
