-- Schéma SQLite de la boutique (idempotent).

CREATE TABLE IF NOT EXISTS customers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seule l'empreinte SHA-256 du jeton de session est stockée.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);

-- product_id = documentId de l'article Strapi.
CREATE TABLE IF NOT EXISTS cart_items (
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL,
  quantity    INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  added_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (customer_id, product_id)
);

-- checkout_key rend la confirmation idempotente (double clic, rejeu).
CREATE TABLE IF NOT EXISTS orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  reference    TEXT NOT NULL UNIQUE,
  checkout_key TEXT NOT NULL UNIQUE,
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  total_cents  INTEGER NOT NULL,
  items_json   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'simulated',
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
