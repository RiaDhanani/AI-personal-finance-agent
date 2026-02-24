import { ExpenseModel } from '../db/database.js';

export class AggregationService {
  /**
   * Get all unique months with data
   */
  getAvailableMonths() {
    const stats = ExpenseModel.getMonthlyStats();
    return [...new Set(stats.map(s => s.month))].sort().reverse();
  }

  /**
   * @param {string} yearMonth - Format: YYYY-MM
   */
  getMonthlySummary(yearMonth) {
    const expenses = ExpenseModel.getByMonth(yearMonth);

    if (expenses.length === 0) {
      return null;
    }

    // Calculate totals by category
    const byCategory = {};
    const transactions = [];
    let totalSpent = 0;

    for (const expense of expenses) {
      const category = expense.ai_category || 'Uncategorized';
      const amount = expense.amount;

      if (!byCategory[category]) {
        byCategory[category] = {
          total: 0,
          count: 0,
          transactions: []
        };
      }

      byCategory[category].total += amount;
      byCategory[category].count += 1;
      byCategory[category].transactions.push({
        date: expense.date,
        description: expense.description,
        amount: expense.amount
      });

      totalSpent += amount;
      transactions.push({
        id: expense.id,
        date: expense.date,
        description: expense.description,
        amount: expense.amount,
        category: expense.ai_category,
        confidence: expense.ai_confidence,
        group: expense.group_name
      });
    }

    const top5Expenses = [...transactions]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Sort categories by total spent
    const categorySummary = Object.entries(byCategory)
      .map(([name, data]) => ({
        name,
        total: data.total,
        count: data.count,
        percentage: (data.total / totalSpent) * 100,
        avgPerTransaction: data.total / data.count
      }))
      .sort((a, b) => b.total - a.total);

    return {
      month: yearMonth,
      totalSpent,
      transactionCount: expenses.length,
      currency: expenses[0]?.currency || 'USD',
      byCategory: categorySummary,
      top5Expenses,
      allTransactions: transactions,
      categorizedCount: expenses.filter(e => e.ai_category).length,
      uncategorizedCount: expenses.filter(e => !e.ai_category).length
    };
  }

  getAllMonthlySummaries() {
    const months = this.getAvailableMonths();
    return months.map(month => this.getMonthlySummary(month)).filter(Boolean);
  }

  getYearToDateSummary(year = new Date().getFullYear()) {
    const summaries = this.getAllMonthlySummaries();
    const yearSummaries = summaries.filter(s => s.month.startsWith(year.toString()));

    if (yearSummaries.length === 0) {
      return null;
    }

    const totalSpent = yearSummaries.reduce((sum, s) => sum + s.totalSpent, 0);
    const totalTransactions = yearSummaries.reduce((sum, s) => sum + s.transactionCount, 0);

    // Aggregate categories across all months
    const categoryTotals = {};
    for (const summary of yearSummaries) {
      for (const cat of summary.byCategory) {
        if (!categoryTotals[cat.name]) {
          categoryTotals[cat.name] = 0;
        }
        categoryTotals[cat.name] += cat.total;
      }
    }

    const byCategory = Object.entries(categoryTotals)
      .map(([name, total]) => ({
        name,
        total,
        percentage: (total / totalSpent) * 100
      }))
      .sort((a, b) => b.total - a.total);

    return {
      year,
      totalSpent,
      transactionCount: totalTransactions,
      monthCount: yearSummaries.length,
      avgMonthlySpend: totalSpent / yearSummaries.length,
      byCategory,
      monthlySummaries: yearSummaries
    };
  }

  compareMonths(month1, month2) {
    const summary1 = this.getMonthlySummary(month1);
    const summary2 = this.getMonthlySummary(month2);

    if (!summary1 || !summary2) {
      return null;
    }

    const totalChange = summary2.totalSpent - summary1.totalSpent;
    const totalChangePercent = (totalChange / summary1.totalSpent) * 100;

    const categoryComparisons = [];
    const allCategories = new Set([
      ...summary1.byCategory.map(c => c.name),
      ...summary2.byCategory.map(c => c.name)
    ]);

    for (const category of allCategories) {
      const cat1 = summary1.byCategory.find(c => c.name === category);
      const cat2 = summary2.byCategory.find(c => c.name === category);

      const amount1 = cat1?.total || 0;
      const amount2 = cat2?.total || 0;
      const change = amount2 - amount1;
      const changePercent = amount1 > 0 ? (change / amount1) * 100 : 100;

      categoryComparisons.push({
        category,
        month1Amount: amount1,
        month2Amount: amount2,
        change,
        changePercent
      });
    }

    return {
      month1,
      month2,
      totalChange,
      totalChangePercent,
      categoryComparisons: categoryComparisons.sort((a, b) => 
        Math.abs(b.change) - Math.abs(a.change)
      )
    };
  }
}

export default AggregationService;