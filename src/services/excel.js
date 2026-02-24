import ExcelJS from 'exceljs';
import { join, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ExcelExportService {
  constructor() {
    this.exportsDir = join(__dirname, '../../exports');
    if (!existsSync(this.exportsDir)) {
      mkdirSync(this.exportsDir, { recursive: true });
    }
  }

  formatDate(dateString) {
  // Handle both YYYY-MM-DD and ISO datetime formats
  const dateOnly = dateString.split('T')[0]; // Remove time if present
  const [year, month, day] = dateOnly.split('-');
  return `${month}/${day}/${year}`;
}

  formatMonth(monthString) {
    const [year, month] = monthString.split('-');
    return `${month}/${year}`;
  }

  async createMonthlyReport(summary) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Finance AI Agent';
    workbook.created = new Date();

    // Sheet 1: All Transactions
    const transactionsSheet = workbook.addWorksheet('All Transactions', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    // Header row
    transactionsSheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'AI Category', key: 'category', width: 18 },
    ];

    // Style header
    transactionsSheet.getRow(1).font = { bold: true, name: 'Arial', size: 11 };
    transactionsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    transactionsSheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Add transactions
    for (const tx of summary.allTransactions) {
      transactionsSheet.addRow({
        date: this.formatDate(tx.date),
        description: tx.description,
        amount: tx.amount,
        currency: summary.currency,
        category: tx.category || 'Uncategorized',
      });
    }

    // Format amounts
    const amountColumn = transactionsSheet.getColumn('amount');
    amountColumn.numFmt = '$#,##0.00;($#,##0.00);-';
    amountColumn.alignment = { horizontal: 'right' };

    // Add borders
    transactionsSheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Sheet 2: Monthly Summary
    const summarySheet = workbook.addWorksheet('Monthly Summary');

    // Title
    summarySheet.mergeCells('A1:D1');
    summarySheet.getCell('A1').value = `Expense Summary - ${this.formatMonth(summary.month)}`;
    summarySheet.getCell('A1').font = { bold: true, size: 16, name: 'Arial' };
    summarySheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 30;

    // Summary stats
    summarySheet.addRow([]);
    summarySheet.addRow(['Total Spent:', summary.totalSpent]);
    summarySheet.addRow(['Total Transactions:', summary.transactionCount]);
    summarySheet.addRow(['Categorized:', summary.categorizedCount]);
    summarySheet.addRow(['Uncategorized:', summary.uncategorizedCount]);

    // Format summary stats
    summarySheet.getCell('A3').font = { bold: true, name: 'Arial' };
    summarySheet.getCell('B3').numFmt = '$#,##0.00;($#,##0.00);-';
    summarySheet.getCell('B3').font = { bold: true, color: { argb: 'FF0000FF' }, name: 'Arial' };
    
    for (let row = 4; row <= 6; row++) {
      summarySheet.getCell(`A${row}`).font = { bold: true, name: 'Arial' };
    }

    // Category breakdown
    summarySheet.addRow([]);
    summarySheet.addRow(['Category', 'Total Spent', 'Count', '% of Total']);
    const headerRow = summarySheet.getRow(summarySheet.lastRow.number);
    headerRow.font = { bold: true, name: 'Arial' };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add category data
    for (const cat of summary.byCategory) {
      summarySheet.addRow([
        cat.name,
        cat.total,
        cat.count,
        cat.percentage / 100
      ]);
    }

    // Format category table
    summarySheet.getColumn('A').width = 20;
    summarySheet.getColumn('B').width = 15;
    summarySheet.getColumn('C').width = 10;
    summarySheet.getColumn('D').width = 12;

    summarySheet.getColumn('B').numFmt = '$#,##0.00;($#,##0.00);-';
    summarySheet.getColumn('B').alignment = { horizontal: 'right' };
    summarySheet.getColumn('D').numFmt = '0.0%';
    summarySheet.getColumn('D').alignment = { horizontal: 'right' };

    // Top 5 expenses
    summarySheet.addRow([]);
    summarySheet.addRow(['Top 5 Largest Expenses']);
    const top5HeaderRow = summarySheet.getRow(summarySheet.lastRow.number);
    top5HeaderRow.font = { bold: true, size: 12, name: 'Arial' };

    summarySheet.addRow(['Date', 'Description', 'Amount', 'Category']);
    const top5ColRow = summarySheet.getRow(summarySheet.lastRow.number);
    top5ColRow.font = { bold: true, name: 'Arial' };
    top5ColRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    for (const exp of summary.top5Expenses) {
      summarySheet.addRow([
        this.formatDate(exp.date),
        exp.description,
        exp.amount,
        exp.category || 'Uncategorized'
      ]);
    }

    // Save file
    const filename = `expense_report_${summary.month}.xlsx`;
    const filepath = join(this.exportsDir, filename);
    await workbook.xlsx.writeFile(filepath);

    return {
      filename,
      filepath,
      month: summary.month
    };
  }

  /**
   * Create year-to-date report
   */
  async createYTDReport(ytdSummary) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Finance AI Agent';
    workbook.created = new Date();

    // Overview sheet
    const overviewSheet = workbook.addWorksheet('YTD Overview');

    overviewSheet.mergeCells('A1:D1');
    overviewSheet.getCell('A1').value = `Year-to-Date Summary - ${ytdSummary.year}`;
    overviewSheet.getCell('A1').font = { bold: true, size: 16, name: 'Arial' };
    overviewSheet.getCell('A1').alignment = { horizontal: 'center' };
    overviewSheet.getRow(1).height = 30;

    overviewSheet.addRow([]);
    overviewSheet.addRow(['Total Spent (YTD):', ytdSummary.totalSpent]);
    overviewSheet.addRow(['Total Transactions:', ytdSummary.transactionCount]);
    overviewSheet.addRow(['Months Tracked:', ytdSummary.monthCount]);
    overviewSheet.addRow(['Avg Monthly Spend:', ytdSummary.avgMonthlySpend]);

    overviewSheet.getColumn('A').width = 25;
    overviewSheet.getColumn('B').width = 18;
    overviewSheet.getCell('B3').numFmt = '$#,##0.00;($#,##0.00);-';
    overviewSheet.getCell('B5').numFmt = '$#,##0.00;($#,##0.00);-';

    for (let row = 3; row <= 6; row++) {
      overviewSheet.getCell(`A${row}`).font = { bold: true, name: 'Arial' };
      if (row === 3) {
        overviewSheet.getCell(`B${row}`).font = { bold: true, color: { argb: 'FF0000FF' }, name: 'Arial' };
      }
    }

    // Category summary
    overviewSheet.addRow([]);
    overviewSheet.addRow(['Category Breakdown']);
    overviewSheet.getRow(overviewSheet.lastRow.number).font = { bold: true, size: 12, name: 'Arial' };

    overviewSheet.addRow(['Category', 'Total Spent', '% of Total']);
    const catHeaderRow = overviewSheet.getRow(overviewSheet.lastRow.number);
    catHeaderRow.font = { bold: true, name: 'Arial' };
    catHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    for (const cat of ytdSummary.byCategory) {
      overviewSheet.addRow([cat.name, cat.total, cat.percentage / 100]);
    }

    overviewSheet.getColumn('B').numFmt = '$#,##0.00;($#,##0.00);-';
    overviewSheet.getColumn('C').numFmt = '0.0%';
    overviewSheet.getColumn('C').width = 12;

    // Monthly trends sheet
    const trendsSheet = workbook.addWorksheet('Monthly Trends');
    trendsSheet.columns = [
      { header: 'Month', key: 'month', width: 12 },
      { header: 'Total Spent', key: 'total', width: 15 },
      { header: 'Transactions', key: 'count', width: 15 }
    ];

    trendsSheet.getRow(1).font = { bold: true, name: 'Arial' };
    trendsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    for (const monthSummary of ytdSummary.monthlySummaries) {
      trendsSheet.addRow({
        month: this.formatMonth(monthSummary.month),
        total: monthSummary.totalSpent,
        count: monthSummary.transactionCount
      });
    }

    trendsSheet.getColumn('total').numFmt = '$#,##0.00;($#,##0.00);-';
    trendsSheet.getColumn('total').alignment = { horizontal: 'right' };

    const filename = `ytd_report_${ytdSummary.year}.xlsx`;
    const filepath = join(this.exportsDir, filename);
    await workbook.xlsx.writeFile(filepath);

    return {
      filename,
      filepath,
      year: ytdSummary.year
    };
  }
}

export default ExcelExportService;