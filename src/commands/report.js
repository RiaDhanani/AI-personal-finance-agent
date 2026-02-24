import { AggregationService } from '../services/aggregation.js';
import { ExcelExportService } from '../services/excel.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function generateReport() {
  console.log('Finance Report Generator\n');

  try {
    const aggregationService = new AggregationService();
    const excelService = new ExcelExportService();

    const availableMonths = aggregationService.getAvailableMonths();
    
    if (availableMonths.length === 0) {
      console.log('No expense data found. Run sync first: npm run sync');
      rl.close();
      return;
    }

    console.log('Available months:');
    availableMonths.forEach((month, i) => {
      console.log(`  ${i + 1}. ${month}`);
    });
    console.log('');

    const choice = await ask('Select report type:\n  1. Monthly report\n  2. Year-to-date report\n  3. All monthly reports\nChoice (1-3): ');

    if (choice === '1') {
      const monthNum = await ask(`\nSelect month (1-${availableMonths.length}): `);
      const selectedMonth = availableMonths[parseInt(monthNum) - 1];
      
      if (!selectedMonth) {
        console.log('Invalid selection');
        rl.close();
        return;
      }

      console.log(`\n Generating report for ${selectedMonth}...`);
      const summary = aggregationService.getMonthlySummary(selectedMonth);
      const result = await excelService.createMonthlyReport(summary);
      
      console.log(`\n Report created: ${result.filename}`);
      console.log(`   Path: ${result.filepath}`);
      console.log(`\n Summary:`);
      console.log(`   Total Spent: $${summary.totalSpent.toFixed(2)}`);
      console.log(`   Transactions: ${summary.transactionCount}`);
      console.log(`   Top Category: ${summary.byCategory[0].name} ($${summary.byCategory[0].total.toFixed(2)})`);

    } else if (choice === '2') {
      const year = await ask('\nEnter year (e.g., 2026): ');
      
      console.log(`\n📄 Generating YTD report for ${year}...`);
      const ytdSummary = aggregationService.getYearToDateSummary(parseInt(year));
      
      if (!ytdSummary) {
        console.log(`No data found for year ${year}`);
        rl.close();
        return;
      }

      const result = await excelService.createYTDReport(ytdSummary);
      
      console.log(`\n Report created: ${result.filename}`);
      console.log(`   Path: ${result.filepath}`);
      console.log(`\n Summary:`);
      console.log(`   Total Spent (YTD): $${ytdSummary.totalSpent.toFixed(2)}`);
      console.log(`   Months: ${ytdSummary.monthCount}`);
      console.log(`   Avg Monthly: $${ytdSummary.avgMonthlySpend.toFixed(2)}`);

    } else if (choice === '3') {
      console.log(`\n Generating reports for all ${availableMonths.length} months...`);
      
      for (const month of availableMonths) {
        const summary = aggregationService.getMonthlySummary(month);
        const result = await excelService.createMonthlyReport(summary);
        console.log(`   ✓ ${result.filename}`);
      }
      
      console.log(`\n All reports created in ./exports/`);
    } else {
      console.log('Invalid choice');
    }

  } catch (error) {
    console.error('\n Report generation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    rl.close();
  }
}

generateReport();