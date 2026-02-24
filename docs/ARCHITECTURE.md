# Architecture Documentation

## System Architecture

The Personal Finance AI Agent follows a layered architecture pattern with clear separation of concerns.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ CLI Commands │  │     MCP      │  │     Web      │  │
│  │   (stdio)    │  │   Server     │  │  Dashboard   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────┬──────────────┬─────────────────┬──────────┘
             │              │                 │
             ▼              ▼                 ▼
┌─────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Service Layer                       │   │
│  │  ┌────────────────┐  ┌──────────────────────┐   │   │
│  │  │ Categorization │  │   Aggregation        │   │   │
│  │  │    Service     │  │    Service           │   │   │
│  │  │  - AI calls    │  │  - Monthly summaries │   │   │
│  │  │  - Caching     │  │  - YTD analysis      │   │   │
│  │  └────────────────┘  └──────────────────────┘   │   │
│  │  ┌────────────────┐  ┌──────────────────────┐   │   │
│  │  │   Splitwise    │  │      Excel           │   │   │
│  │  │    Client      │  │    Generator         │   │   │
│  │  │  - API calls   │  │  - Report creation   │   │   │
│  │  │  - Normalization│  │  - Formatting       │   │   │
│  │  └────────────────┘  └──────────────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│                     DATA LAYER                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Database Models                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────┐ │   │
│  │  │   Expense    │  │   Category   │  │  Meta  │ │   │
│  │  │    Model     │  │    Cache     │  │  data  │ │   │
│  │  └──────────────┘  └──────────────┘  └────────┘ │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │              SQLite Database                     │   │
│  │               (./data/finance.db)                │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

External Services:
┌────────────────┐        ┌──────────────────┐
│  Splitwise API │◄───────┤  OpenAI API   │
│  (Data source) │        │  (ChatGPT)     │
└────────────────┘        └──────────────────┘
```

## Component Breakdown

### 1. Presentation Layer

#### CLI Commands (`src/commands/`)
- **sync.js**: Fetches expenses from Splitwise
- **categorize.js**: Runs AI categorization on uncategorized expenses
- **report.js**: Interactive report generation

**Responsibilities:**
- User interaction
- Input validation
- Progress feedback
- Error display

#### MCP Server (`src/mcp/server.js`)
- Exposes tools via Model Context Protocol
- Enables LLM integration
- Provides structured access to finance data

**Tools:**
- categorize_expense
- get_monthly_summary
- fetch_expenses
- categorize_all_uncategorized
- export_to_excel
- get_ytd_summary
- list_available_months
- get_expense_categories

#### Web Dashboard (`src/dashboard/`)
- REST API endpoints
- Real-time statistics
- Interactive visualizations
- Month selection and filtering

### 2. Application Layer

#### Categorization Service (`src/services/categorization.js`)

**Purpose:** Intelligent expense categorization using AI

**Key Features:**
- Claude AI integration
- Smart caching mechanism
- Batch processing
- Confidence scoring

**Cache Strategy:**
```javascript
cacheKey = normalize(description) + floor(amount/10) + group
```

**Benefits:**
- Reduces API costs
- Faster categorization
- Consistent results

#### Aggregation Service (`src/services/aggregation.js`)

**Purpose:** Analytics and reporting logic

**Capabilities:**
- Monthly summaries
- Year-to-date analysis
- Category breakdowns
- Top expenses
- Month-over-month comparisons

**Data Flow:**
```
Raw Expenses → Group by Month → Aggregate by Category → Calculate Stats
```

#### Splitwise Client (`src/services/splitwise.js`)

**Purpose:** Interface with Splitwise API

**Functions:**
- Fetch expenses with pagination
- Get current user info
- Normalize expense data
- Filter payments and deleted items

**Normalization:**
```javascript
Splitwise Expense → {
  id: "sw_123",
  date: "2026-01-15",
  description: "Dinner",
  amount: 45.67,
  currency: "USD",
  group_name: "Roommates",
  notes: "Pizza night",
  raw_category: "Food and drink",
  ai_category: null,  // Filled later
  splitwise_data: { ... }
}
```

#### Excel Generator (`src/services/excel.js`)

**Purpose:** Professional report generation

**Features:**
- Multi-sheet workbooks
- Professional formatting
- Formulas and calculations
- Color coding
- Auto-sizing columns

**Report Types:**
1. Monthly reports
2. Year-to-date summaries
3. Batch exports

### 3. Data Layer

#### Database Models (`src/db/database.js`)

**Tables:**

**expenses**
```sql
CREATE TABLE expenses (
  id TEXT PRIMARY KEY,           -- sw_12345
  date TEXT NOT NULL,            -- 2026-01-15
  description TEXT NOT NULL,     -- "Whole Foods"
  amount REAL NOT NULL,          -- 87.43
  currency TEXT NOT NULL,        -- "USD"
  group_name TEXT,              -- "Roommates"
  notes TEXT,                   -- "Weekly groceries"
  raw_category TEXT,            -- "Food and drink"
  ai_category TEXT,             -- "Groceries"
  ai_confidence REAL,           -- 0.98
  ai_reason TEXT,               -- "Supermarket chain"
  splitwise_data TEXT,          -- JSON blob
  created_at TEXT,
  updated_at TEXT
);
```

**category_cache**
```sql
CREATE TABLE category_cache (
  description_key TEXT PRIMARY KEY,  -- "whole foods_80_none"
  ai_category TEXT NOT NULL,         -- "Groceries"
  ai_confidence REAL NOT NULL,       -- 0.98
  ai_reason TEXT,                    -- "Supermarket chain"
  hit_count INTEGER DEFAULT 1,       -- Cache efficiency metric
  created_at TEXT,
  updated_at TEXT
);
```

**sync_metadata**
```sql
CREATE TABLE sync_metadata (
  key TEXT PRIMARY KEY,              -- "last_sync_date"
  value TEXT NOT NULL,               -- "2026-02-13"
  updated_at TEXT
);
```

## Data Flow

### Expense Sync Flow

```
1. User runs: npm run sync
2. CLI → SplitwiseClient.fetchExpenses()
3. SplitwiseClient → Splitwise API
4. API returns raw expenses
5. SplitwiseClient.normalizeExpense()
6. ExpenseModel.insert() for each expense
7. SQLite stores in expenses table
8. Update sync_metadata.last_sync_date
```

### Categorization Flow

```
1. User runs: npm run categorize
2. CLI → CategorizationService.categorizeExpenses()
3. For each uncategorized expense:
   a. Check category_cache by description_key
   b. If cache hit:
      - Return cached result
      - Increment hit_count
   c. If cache miss:
      - Build prompt with context
      - Call Anthropic API
      - Parse JSON response
      - Validate category
      - Store in category_cache
   d. Update expense.ai_category in database
4. Return stats (cache hits, API calls)
```

### Report Generation Flow

```
1. User runs: npm run report
2. Select month via CLI
3. AggregationService.getMonthlySummary()
4. Query expenses for that month
5. Group by ai_category
6. Calculate totals, percentages
7. Find top 5 expenses
8. ExcelService.createMonthlyReport()
9. Generate multi-sheet workbook
10. Apply formatting and formulas
11. Save to ./exports/
```

### MCP Tool Call Flow

```
1. Claude Desktop or API calls MCP server
2. MCP Server receives tool request
3. Route to appropriate service method
4. Service interacts with database/API
5. Process and transform data
6. Return structured JSON response
7. Claude receives and presents to user
```

## Design Patterns

### 1. Repository Pattern
- `ExpenseModel`, `CategoryCacheModel`, `MetadataModel`
- Abstracts database operations
- Single source of truth for queries

### 2. Service Layer Pattern
- Business logic separated from data access
- Reusable across CLI, MCP, and Web interfaces
- Testable independently

### 3. Singleton Pattern
- Database connection (better-sqlite3)
- One connection, multiple queries
- WAL mode for concurrency

### 4. Caching Pattern
- Category cache with TTL (never expires)
- Hit count tracking
- Cache key normalization

## Technology Choices

### Why Node.js?
- Native async/await for API calls
- Excellent library ecosystem
- Easy MCP SDK integration
- Fast JSON processing

### Why SQLite?
- Zero configuration
- File-based (portable)
- ACID transactions
- Fast for personal data volumes
- No separate server process

### Why better-sqlite3?
- Synchronous API (simpler code)
- Faster than node-sqlite3
- Better error handling
- Native bindings for performance

### Why ExcelJS?
- Full Excel feature support
- Formulas and formatting
- Multiple sheets
- No external dependencies
- Cross-platform

### Why Claude Sonnet 4?
- Excellent structured output
- Fast response times
- Good at classification
- Reliable JSON formatting
- Cost-effective for this use case

## Security Considerations

### 1. API Key Management
- Environment variables only
- Never hardcoded
- .gitignore prevents commits
- Separate keys for dev/prod

### 2. Data Privacy
- Local database only
- No cloud storage
- Minimal external API calls
- Splitwise data never exposed beyond categorization

### 3. Input Validation
- Expense amounts are numbers
- Dates validated before storage
- Category names restricted to predefined list
- SQL injection prevented by prepared statements

## Performance Optimizations

### 1. Categorization Caching
- Reduces API calls by ~60-70%
- Sub-second response for cached items
- Persistent across restarts

### 2. Database Indexing
```sql
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_ai_category ON expenses(ai_category);
CREATE INDEX idx_expenses_month ON expenses(substr(date, 1, 7));
```

### 3. Batch Processing
- Categorize multiple expenses with rate limiting
- Excel export processes in-memory
- Splitwise API pagination handled automatically

### 4. WAL Mode
```javascript
db.pragma('journal_mode = WAL');
```
- Concurrent reads during writes
- Better performance for this use case

## Scalability Considerations

### Current Limits
- Designed for personal use (~1000-5000 expenses/year)
- SQLite handles millions of rows
- Excel files practical up to ~100k rows

### Potential Bottlenecks
1. **AI API rate limits**: 100ms delay between calls
2. **Excel file size**: Large exports may be slow
3. **Memory**: All-in-memory aggregation

### Future Scaling Options
- PostgreSQL for multi-user
- Background job queue for categorization
- Streaming Excel generation
- API response caching

## Error Handling

### Levels of Error Handling

1. **API Level**
   - Splitwise API errors → retry logic
   - Anthropic API errors → fallback to "Other" category
   - Network timeouts → user notification

2. **Database Level**
   - Constraint violations → graceful handling
   - Transaction rollback on errors
   - Corruption detection

3. **Application Level**
   - Validation errors → helpful messages
   - Missing data → sensible defaults
   - Invalid input → clear feedback

## Testing Strategy

### Unit Tests (Recommended)
- Service methods
- Database models
- Normalization functions
- Cache key generation

### Integration Tests
- Splitwise API mocking
- Database transactions
- MCP tool calls

### End-to-End Tests
- Full sync → categorize → report workflow
- CLI command execution
- Excel file validation

## Deployment

### Local Development
```bash
npm install
cp .env.example .env
# Add API keys
npm run sync
```

### Production Considerations
- Backup database regularly
- Rotate API keys periodically
- Monitor API usage/costs
- Set up log rotation

## Monitoring

### Metrics to Track
- Sync success rate
- Categorization cache hit rate
- Average confidence scores
- API costs (Anthropic)
- Report generation time

### Logs
- Sync timestamps
- Categorization progress
- API errors
- Database queries (optional)

## Future Architecture Improvements

1. **Event-Driven Architecture**
   - Expense sync triggers categorization
   - Categorization triggers report cache invalidation

2. **Microservices (if multi-user)**
   - Separate sync service
   - Separate categorization service
   - API gateway

3. **Caching Layer**
   - Redis for aggregation results
   - Faster dashboard loads

4. **Background Jobs**
   - Queue-based categorization
   - Scheduled syncs
   - Automated reports

5. **Real-time Updates**
   - WebSocket for dashboard
   - Live categorization progress
   - Instant notifications