import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DATABASE_PATH || join(__dirname, '../../data/finance.db');

const dataDir = dirname(DB_PATH);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      group_name TEXT,
      notes TEXT,
      raw_category TEXT,
      ai_category TEXT,
      ai_confidence REAL,
      ai_reason TEXT,
      splitwise_data TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_ai_category ON expenses(ai_category);
    CREATE INDEX IF NOT EXISTS idx_expenses_month ON expenses(substr(date, 1, 7));

    CREATE TABLE IF NOT EXISTS category_cache (
      description_key TEXT PRIMARY KEY,
      ai_category TEXT NOT NULL,
      ai_confidence REAL NOT NULL,
      ai_reason TEXT,
      hit_count INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export const ExpenseModel = {
  insert(expense) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO expenses (
        id, date, description, amount, currency, group_name, 
        notes, raw_category, ai_category, ai_confidence, ai_reason, 
        splitwise_data, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    return stmt.run(
      expense.id,
      expense.date,
      expense.description,
      expense.amount,
      expense.currency,
      expense.group_name || null,
      expense.notes || null,
      expense.raw_category || null,
      expense.ai_category || null,
      expense.ai_confidence || null,
      expense.ai_reason || null,
      expense.splitwise_data ? JSON.stringify(expense.splitwise_data) : null
    );
  },

  updateCategory(id, category, confidence, reason) {
    const stmt = db.prepare(`
      UPDATE expenses 
      SET ai_category = ?, ai_confidence = ?, ai_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(category, confidence, reason, id);
  },

  getAll() {
    return db.prepare('SELECT * FROM expenses ORDER BY date DESC').all();
  },

  getUncategorized() {
    return db.prepare('SELECT * FROM expenses WHERE ai_category IS NULL').all();
  },

  getByMonth(yearMonth) {
    return db.prepare(
      "SELECT * FROM expenses WHERE substr(date, 1, 7) = ? ORDER BY date"
    ).all(yearMonth);
  },

  getMonthlyStats() {
    return db.prepare(`
      SELECT 
        substr(date, 1, 7) as month,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount,
        currency
      FROM expenses
      GROUP BY month, currency
      ORDER BY month DESC
    `).all();
  }
};

export const CategoryCacheModel = {
  get(descriptionKey) {
    return db.prepare(
      'SELECT * FROM category_cache WHERE description_key = ?'
    ).get(descriptionKey);
  },

  insert(descriptionKey, category, confidence, reason) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO category_cache 
      (description_key, ai_category, ai_confidence, ai_reason, hit_count, updated_at)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `);
    return stmt.run(descriptionKey, category, confidence, reason);
  },

  incrementHitCount(descriptionKey) {
    const stmt = db.prepare(`
      UPDATE category_cache 
      SET hit_count = hit_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE description_key = ?
    `);
    return stmt.run(descriptionKey);
  }
};

export const MetadataModel = {
  get(key) {
    const row = db.prepare('SELECT value FROM sync_metadata WHERE key = ?').get(key);
    return row ? row.value : null;
  },

  set(key, value) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);
    return stmt.run(key, value);
  }
};

initializeDatabase();

export default db;
