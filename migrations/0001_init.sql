-- Ledger AI on Cloudflare D1. Every ledger row is keyed by the session user.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX users_email_idx ON users (email);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE shop_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  shop_name TEXT NOT NULL,
  opening_balance_paise INTEGER NOT NULL,
  setup_date TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  extra TEXT
);

CREATE TABLE transactions (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  title TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  occurred_on TEXT NOT NULL,
  payment TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  extra TEXT,
  PRIMARY KEY (user_id, id)
);

-- Incremental sync reads this range instead of the whole table.
CREATE INDEX transactions_user_updated_idx ON transactions (user_id, updated_at);
