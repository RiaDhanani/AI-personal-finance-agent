import { ExpenseModel } from '../db/database.js';
import { CategorizationService } from '../services/categorization.js';

async function categorize() {
  console.log('Categorizing expenses using AI...\n');

  try {
    const uncategorized = ExpenseModel.getUncategorized();
    
    if (uncategorized.length === 0) {
      console.log('All expenses are already categorized!');
      return;
    }

    console.log(`Found ${uncategorized.length} uncategorized expenses\n`);

    const service = new CategorizationService();
    let processed = 0;
    let cacheHits = 0;
    let apiCalls = 0;

    const { results, stats } = await service.categorizeExpenses(
      uncategorized,
      (progress) => {
        const percent = ((progress.current / progress.total) * 100).toFixed(0);
        process.stdout.write(`\r Progress: ${progress.current}/${progress.total} (${percent}%) - Cache: ${progress.cacheHits}, API: ${progress.apiCalls}`);
      }
    );

    console.log('\n');

    for (const result of results) {
      ExpenseModel.updateCategory(
        result.expenseId,
        result.category,
        result.confidence,
        result.reason
      );
      processed++;
    }

    console.log('Categorization Summary:');
    console.log(`   - Total processed: ${processed}`);
    console.log(`   - Cache hits: ${stats.cacheHits} (${(stats.cacheHitRate * 100).toFixed(1)}%)`);
    console.log(`   - API calls: ${stats.apiCalls}`);
    console.log(`   - Remaining uncategorized: ${ExpenseModel.getUncategorized().length}`);

    console.log('\n Categorization complete!');
    console.log('\n Next steps:');
    console.log('   - View monthly report: npm run report');

  } catch (error) {
    console.error('\n Categorization failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

categorize();
