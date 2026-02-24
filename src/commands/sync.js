import { SplitwiseClient } from '../services/splitwise.js';
import { ExpenseModel, MetadataModel } from '../db/database.js';

async function sync() {
  console.log('🔄 Syncing expenses from Splitwise...\n');

  try {
    const client = new SplitwiseClient();
    const lastSync = MetadataModel.get('last_sync_date');
    const options = {};
    
    if (lastSync) {
      options.dated_after = lastSync;
      console.log(`Fetching expenses since: ${lastSync}`);
    } else {
      options.dated_after = '2026-01-01';
      console.log('Fetching all expenses (first sync)');
    }

    const expenses = await client.fetchAndNormalizeExpenses(options);
    
    console.log(`Fetched ${expenses.length} expenses from Splitwise\n`);

    let inserted = 0;
    let updated = 0;

    for (const expense of expenses) {
      try {
        ExpenseModel.insert(expense);
        inserted++;
      } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
          updated++;
        } else {
          console.error(`Error inserting expense ${expense.id}:`, error.message);
        }
      }
    }

    const today = new Date().toISOString().split('T')[0];
    MetadataModel.set('last_sync_date', today);

    console.log('Summary:');
    console.log(`   - New expenses: ${inserted}`);
    console.log(`   - Updated: ${updated}`);
    console.log(`   - Total in database: ${ExpenseModel.getAll().length}`);
    console.log(`\n Sync complete! Last sync: ${today}`);

    const uncategorized = ExpenseModel.getUncategorized().length;
    if (uncategorized > 0) {
      console.log(`\n Tip: You have ${uncategorized} uncategorized expenses.`);
      console.log('   Run: npm run categorize');
    }

  } catch (error) {
    console.error('Sync failed:', error.message);
    process.exit(1);
  }
}

sync();