PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
CREATE TABLE IF NOT EXISTS members (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','staff')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
 csrf TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, starts_at TEXT NOT NULL,
 capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 1000), price INTEGER NOT NULL CHECK(price >= 0),
 location TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', published INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), total INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('awaiting_confirmation','confirmed','cancelled','expired')),
 idempotency_key TEXT NOT NULL, fingerprint TEXT NOT NULL,
 created_at TEXT NOT NULL, UNIQUE(member_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS bookings (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), member_id TEXT NOT NULL REFERENCES members(id),
 event_id TEXT NOT NULL REFERENCES events(id), price INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','confirmed','cancelled','expired')), hold_until TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS bookings_capacity ON bookings(event_id,status);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_member ON bookings(member_id,event_id) WHERE status IN ('pending','confirmed');
CREATE TABLE IF NOT EXISTS news (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, summary TEXT NOT NULL,
 body TEXT NOT NULL, category TEXT NOT NULL, image TEXT NOT NULL DEFAULT '/assets/range-side.webp',
 published_at TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0, pinned INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS achievements (
 id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '', progress INTEGER NOT NULL CHECK(progress BETWEEN 0 AND 100),
 verified_by TEXT REFERENCES members(id), updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
 id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), sender_id TEXT NOT NULL REFERENCES members(id),
 body TEXT NOT NULL, created_at TEXT NOT NULL, read_at TEXT
);
