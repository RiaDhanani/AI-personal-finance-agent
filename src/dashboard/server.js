import express from 'express';
import { AggregationService } from '../services/aggregation.js';
import { ExpenseModel } from '../db/database.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const aggregationService = new AggregationService();

app.use(express.static(join(__dirname, 'public')));
app.use(express.json());

function formatDate(dateString) {
  if (dateString.includes('T')) {
    return dateString.split('T')[0];
  }
  return dateString;
}

app.get('/api/months', (req, res) => {
  const months = aggregationService.getAvailableMonths();
  res.json({ months });
});

app.get('/api/summary/:month', (req, res) => {
  const summary = aggregationService.getMonthlySummary(req.params.month);
  if (!summary) {
    return res.status(404).json({ error: 'No data for this month' });
  }
  
  summary.allTransactions = summary.allTransactions.map(tx => ({
    ...tx,
    date: formatDate(tx.date)
  }));
  
  summary.top5Expenses = summary.top5Expenses.map(exp => ({
    ...exp,
    date: formatDate(exp.date)
  }));
  
  res.json(summary);
});

app.get('/api/ytd/:year', (req, res) => {
  const year = parseInt(req.params.year);
  const summary = aggregationService.getYearToDateSummary(year);
  if (!summary) {
    return res.status(404).json({ error: 'No data for this year' });
  }
  res.json(summary);
});

app.get('/api/stats', (req, res) => {
  const all = ExpenseModel.getAll();
  const uncategorized = ExpenseModel.getUncategorized();
  const months = aggregationService.getAvailableMonths();
  
  res.json({
    totalExpenses: all.length,
    categorized: all.length - uncategorized.length,
    uncategorized: uncategorized.length,
    monthsTracked: months.length,
    latestMonth: months[0]
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Finance Dashboard running at http://localhost:${PORT}`);
  console.log(`   Press Ctrl+C to stop\n`);
});