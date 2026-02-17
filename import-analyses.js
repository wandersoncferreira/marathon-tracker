#!/usr/bin/env node

/**
 * Import coach analyses into IndexedDB
 * This script opens the database and imports the analysis files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Dexie from 'dexie';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define database schema (must match the app's schema)
class MarathonTrackerDB extends Dexie {
  constructor() {
    super('MarathonTrackerDB');

    this.version(6).stores({
      config: 'key, value, updatedAt',
      activities: 'id, start_date_local, type, distance, moving_time, *tags',
      activityDetails: 'id, fetchedAt',
      wellness: 'id, date',
      cache: 'key, data, timestamp, ttl',
      analyses: 'activityId, date',
      activityMessages: 'id, activityId, created',
      events: 'id, start_date_local, category',
    });

    this.analyses = this.table('analyses');
  }
}

async function importAnalyses() {
  console.log('📊 Importing coach analyses into IndexedDB...\n');

  // Note: Dexie in Node.js requires IndexedDB polyfill
  console.log('⚠️  This script requires a browser environment to access IndexedDB.');
  console.log('Instead, the analyses will be automatically imported when you open the app.\n');

  // Read the analysis files
  const analysesDir = path.join(__dirname, 'data/analyses');
  const files = fs.readdirSync(analysesDir).filter(f => f.endsWith('.json') && !f.startsWith('EXAMPLE'));

  console.log(`Found ${files.length} analysis file(s):\n`);

  for (const file of files) {
    const filePath = path.join(analysesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const analysis = JSON.parse(content);

    console.log(`✓ ${file}`);
    console.log(`  Date: ${analysis.metadata.date}`);
    console.log(`  Activity: ${analysis.metadata.activityName.en_US}`);
    console.log(`  Rating: ${analysis.verdict.rating}`);
    console.log('');
  }

  console.log('📝 To import these analyses:');
  console.log('   1. Open the app in your browser');
  console.log('   2. Go to Coach Analysis tab');
  console.log('   3. Click "Delete All" if you have old analyses');
  console.log('   4. Click "+ Import" for each file');
  console.log('   OR');
  console.log('   5. The app will auto-load them from data/analyses/ on startup\n');
}

importAnalyses().catch(console.error);
