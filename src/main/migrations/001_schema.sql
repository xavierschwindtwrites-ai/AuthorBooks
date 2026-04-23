CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT,
  defaultTaxDeductible BOOLEAN DEFAULT 0,
  defaultBusinessType TEXT DEFAULT 'business',
  isCustom BOOLEAN DEFAULT 1,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT,
  startDate TEXT,
  targetPublishDate TEXT,
  status TEXT DEFAULT 'active',
  budget INTEGER,
  notes TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  vendor TEXT,
  categoryId TEXT,
  projectId TEXT,
  notes TEXT,
  tags TEXT,
  businessType TEXT DEFAULT 'business',
  taxDeductible BOOLEAN DEFAULT 0,
  receiptPath TEXT,
  status TEXT DEFAULT 'pending',
  aiSuggested BOOLEAN DEFAULT 0,
  aiConfidence REAL,
  recurringId TEXT,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS income (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  source TEXT,
  projectId TEXT,
  jobId TEXT,
  publisher TEXT,
  platform TEXT,
  description TEXT,
  notes TEXT,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  clientName TEXT,
  hourlyRate INTEGER,
  status TEXT DEFAULT 'active',
  description TEXT,
  notes TEXT,
  createdAt TEXT NOT NULL,
  completedAt TEXT
);

CREATE TABLE IF NOT EXISTS workLogs (
  id TEXT PRIMARY KEY,
  jobId TEXT NOT NULL,
  date TEXT NOT NULL,
  hoursWorked REAL NOT NULL,
  paid BOOLEAN DEFAULT 1,
  incomeAssociated INTEGER,
  description TEXT,
  notes TEXT,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  vendor TEXT,
  costPerPeriod INTEGER NOT NULL,
  period TEXT NOT NULL,
  nextRenewalDate TEXT,
  businessType TEXT DEFAULT 'business',
  categoryId TEXT,
  status TEXT DEFAULT 'active',
  pausedFrom TEXT,
  pausedUntil TEXT,
  notes TEXT,
  createdAt TEXT NOT NULL,
  lastRenewalDate TEXT,
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS savingsGoals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  targetAmount INTEGER NOT NULL,
  currentAmount INTEGER DEFAULT 0,
  deadline TEXT,
  priority INTEGER DEFAULT 3,
  description TEXT,
  linkedCategories TEXT,
  linkedIncomeStreams TEXT,
  notes TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS budgetLimits (
  id TEXT PRIMARY KEY,
  categoryId TEXT,
  period TEXT NOT NULL,
  amount INTEGER NOT NULL,
  alertThreshold INTEGER DEFAULT 80,
  businessType TEXT DEFAULT 'both',
  createdAt TEXT NOT NULL,
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_categoryId ON transactions(categoryId);
CREATE INDEX IF NOT EXISTS idx_transactions_businessType ON transactions(businessType);
CREATE INDEX IF NOT EXISTS idx_subscriptions_nextRenewalDate ON subscriptions(nextRenewalDate);
CREATE INDEX IF NOT EXISTS idx_workLogs_jobId ON workLogs(jobId);
