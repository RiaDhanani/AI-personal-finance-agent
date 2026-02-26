# Setup Guide

Complete step-by-step guide to get your Personal Finance AI Agent running.

## Prerequisites Checklist

- [ ] Node.js 18+ installed ([download](https://nodejs.org/))
- [ ] Splitwise account ([sign up](https://secure.splitwise.com/))
- [ ] OpenAI API access ([console](https://platform.openai.com/api-keys/))

## Step 1: Get Splitwise API Key

1. **Login to Splitwise**
   - Go to https://secure.splitwise.com/
   - Sign in with your account

2. **Register Your Application**
   - Navigate to https://secure.splitwise.com/apps
   - Click "Register your application"

3. **Fill Application Details**
   ```
   Application name: Personal Finance Agent
   Description: AI-powered expense categorization tool
   Homepage URL: http://localhost:3000
   ```

4. **Get Your API Key**
   - After registration, you'll see your application details
   - Look for "Consumer Key" - this is your API key
   - **Important:** Use the "Consumer Key", not "Consumer Secret"
   - Copy the Consumer Key value
   - Save this somewhere secure

   ### Alternative: Use the included helper script

   There is a helper script that automates exchanging an authorization code for an access token and verifies the token: `src/scripts/get-splitwise-token.js`.

   Usage:

   1. Register your app in Splitwise and note the **Consumer Key** and **Consumer Secret** (see steps above).
   2. Open `src/scripts/get-splitwise-token.js` and follow the inline instructions:
      - Visit the authorization URL printed in the file comments to obtain a short-lived authorization code.
      - Paste that code into the `code` variable in the script.
      - Replace the `consumerKey` and `consumerSecret` placeholders with your values.
   3. Run the script from the project root:

   ```bash
   # macOS / Linux
   node src/scripts/get-splitwise-token.js

   # Windows (PowerShell)
   node src\scripts\get-splitwise-token.js
   ```

   On success the script prints your access token and a suggested `.env` line, for example:

   ```
   SPLITWISE_API_KEY=ya29.a0AfH6SM... (example)
   ```

   Copy that value into your `.env` as `SPLITWISE_API_KEY`.

   Security note: the script prints the token to stdout for convenience — treat it like a secret and do not commit it to version control.

## Step 2: Get OpenAI API Key

1. **Sign Up for Anthropic**
   - Go to https://platform.openai.com/api-keys
   - Sign up or log in

2. **Create API Key**
   - Navigate to "API Keys" in the console
   - Click "Create Key"
   - Name it: "Finance Agent"
   - Copy the key immediately (you won't see it again)

3. **Add Credits**
   - Add credits to your account if needed
   - Typical usage: ~$0.50-2.00 per month for personal use

## Step 3: Install the Application

### Option A: From Source

```bash
# Navigate to your projects directory
cd ~/Projects

# Create and enter directory
mkdir finance-agent
cd finance-agent

# Copy all the files from this repository
# (or use the files we've created)
```

### Option B: Clone Repository

```bash
cd ~/Projects
git clone https://github.com/yourusername/finance-agent.git
cd finance-agent
```

### Install Dependencies

```bash
npm install
```

This will install:
- `@open-ai/sdk` - Claude AI client
- `@modelcontextprotocol/sdk` - MCP server framework
- `better-sqlite3` - SQLite database
- `dotenv` - Environment variable management
- `exceljs` - Excel file generation
- `express` - Web server
- `splitwise` - Splitwise API client

**Note:** Installation may take 1-2 minutes as `better-sqlite3` compiles native bindings.

## Step 4: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Open .env in your editor
nano .env
# or
code .env
# or
vim .env
```

Edit `.env` with your credentials:

```env
# Splitwise API Configuration
# Use your Consumer Key from https://secure.splitwise.com/apps
SPLITWISE_API_KEY=your_consumer_key_here

# OpenAI API Configuration
OPENAI_API_KEY=sk-proj-your-actual-key-here

# Database Configuration (default is fine)
DATABASE_PATH=./data/finance.db

# Server Configuration (default is fine)
PORT=3000
```

**Security Note:** Never commit `.env` to version control. It's already in `.gitignore`.

## Step 5: Verify Installation

Test that everything is set up correctly:

```bash
# Test Node.js
node --version
# Should show v18.x.x or higher

# Test npm installation
npm list --depth=0
# Should show all dependencies installed

# Test database creation
node -e "import('./src/db/database.js')"
# Should create ./data/finance.db with no errors
```

## Step 6: Initial Sync

Fetch your expenses from Splitwise:

```bash
npm run sync
```

**What happens:**
1. Connects to Splitwise API
2. Fetches all your expenses
3. Normalizes data format
4. Stores in local SQLite database
5. Sets last sync date

**Expected output:**
```
🔄 Syncing expenses from Splitwise...

📅 Fetching all expenses (first sync)
✅ Fetched 247 expenses from Splitwise

📊 Summary:
   - New expenses: 247
   - Updated: 0
   - Total in database: 247

✅ Sync complete! Last sync: 2026-02-13

💡 Tip: You have 247 uncategorized expenses.
   Run: npm run categorize
```

**Troubleshooting:**
- **"SPLITWISE_API_KEY not found"**: Check your `.env` file
- **"Unauthorized"**: Verify your API key is correct
- **"No expenses found"**: Check that your Splitwise account has expenses

## Step 7: Categorize Expenses

Run AI categorization on all expenses:

```bash
npm run categorize
```

**What happens:**
1. Loads all uncategorized expenses
2. Checks cache for similar expenses
3. Calls Claude AI for new categorizations
4. Updates database with categories and confidence scores

**Expected output:**
```
🤖 Categorizing expenses using AI...

Found 247 uncategorized expenses

⏳ Progress: 247/247 (100%) - Cache: 0, API: 247

📊 Categorization Summary:
   - Total processed: 247
   - Cache hits: 0 (0.0%)
   - API calls: 247
   - Remaining uncategorized: 0

✅ Categorization complete!

💡 Next steps:
   - View monthly report: npm run report
```

**Notes:**
- First run: 0% cache hits (all new)
- Subsequent runs: ~60-70% cache hits
- Takes ~1-2 minutes for 200 expenses
- Cost: ~$0.20-0.50 for 200 expenses

## Step 8: Generate Your First Report

```bash
npm run report
```

**Interactive menu:**
```
📊 Finance Report Generator

Available months:
  1. 2026-02
  2. 2026-01
  3. 2025-12

Select report type:
  1. Monthly report
  2. Year-to-date report
  3. All monthly reports
Choice (1-3): 1

Select month (1-3): 1

📄 Generating report for 2026-02...

✅ Report created: expense_report_2026-02.xlsx
   Path: /path/to/finance-agent/exports/expense_report_2026-02.xlsx

📊 Summary:
   Total Spent: $2,450.75
   Transactions: 42
   Top Category: Food & Dining ($820.50)
```

**Open the Excel file** to see:
- Sheet 1: All transactions with categories
- Sheet 2: Monthly summary and top expenses

## Step 9: Set Up MCP Server

For use with Claude Desktop or other MCP clients:

### Find Your Config File

**macOS:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```bash
~/.config/Claude/claude_desktop_config.json
```

### Edit Config

```json
{
  "mcpServers": {
    "finance-agent": {
      "command": "node",
      "args": ["/absolute/path/to/finance-agent/src/mcp/server.js"]
    }
  }
}
```

**Replace `/absolute/path/to/`** with your actual path:

```bash
# Get absolute path
pwd
# Copy the output and append /src/mcp/server.js
```

### Restart Claude Desktop

The MCP server will now be available when you use Claude.

### Test MCP

In Claude Desktop, try:
> "What categories are available for expenses?"

Claude should respond with the list of categories.

## Step 10: Launch Web Dashboard

```bash
npm run dashboard
```

**Access at:** http://localhost:3000

**Features:**
- Overall statistics
- Monthly summaries
- Category breakdowns
- Top expenses

**To stop:** Press `Ctrl+C`

## Daily Usage Workflow

Once set up, your typical workflow:

```bash
# Sync new expenses
npm run sync

# Categorize any new ones
npm run categorize
```

### Monthly Routine
```bash
# Generate end-of-month report
npm run report
# Select option 1 (Monthly report)
# Choose the previous month
```

### Ad-hoc Analysis
```bash
# Launch dashboard for quick insights
npm run dashboard
# Open http://localhost:3000
```

## Automation (Optional)

### macOS/Linux: Cron Job

Add to crontab to sync daily:

```bash
# Edit crontab
crontab -e

# Add this line (runs at 9 AM daily)
0 9 * * * cd /path/to/finance-agent && npm run sync >> /tmp/finance-sync.log 2>&1
```

### Windows: Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: Daily at 9:00 AM
4. Action: Start a program
   - Program: `node`
   - Arguments: `src/commands/sync.js`
   - Start in: `C:\path\to\finance-agent`

## Backup Your Data

Your data is stored locally. Regular backups recommended:

```bash
# Manual backup
cp ./data/finance.db ./data/finance.db.backup

# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
cp ./data/finance.db ./data/backups/finance_$DATE.db
```

## Verification Checklist

After setup, verify everything works:

- [ ] Sync completes without errors
- [ ] Database created at `./data/finance.db`
- [ ] Categorization runs successfully
- [ ] Excel report generates
- [ ] Can open and view report in Excel
- [ ] (Optional) MCP server responds in Claude Desktop
- [ ] (Optional) Dashboard loads at localhost:3000

## Next Steps

Now that you're set up:

1. **Explore your data**: Generate reports for different months
2. **Review categorizations**: Check Excel export for accuracy
3. **Set up automation**: Daily sync via cron or Task Scheduler
4. **Customize categories**: Edit EXPENSE_CATEGORIES if needed
5. **Use MCP**: Integrate with Claude Desktop for conversational queries

## Getting Help

**Documentation:**
- README.md - Overview and features
- ARCHITECTURE.md - System design
- CATEGORIZATION.md - How AI categorization works

**Logs:**
- CLI output shows detailed progress
- Database at `./data/finance.db` (use DB Browser for SQLite)
- Exports in `./exports/` directory

**Common Commands:**
```bash
# See all available commands
npm run

# View database
sqlite3 ./data/finance.db
# Then: .tables, SELECT * FROM expenses LIMIT 5;

# Check expense count
sqlite3 ./data/finance.db "SELECT COUNT(*) FROM expenses"

# View categorization stats
sqlite3 ./data/finance.db "SELECT ai_category, COUNT(*) FROM expenses GROUP BY ai_category"
```

Congratulations! Your Personal Finance AI Agent is now fully set up and running.