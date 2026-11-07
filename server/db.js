import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = process.env.DATA_DIR || path.join(root, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'orders.db');

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_token TEXT NOT NULL UNIQUE,
  number INTEGER NOT NULL UNIQUE,
  total INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  final_total INTEGER NOT NULL,
  percent REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_id TEXT NOT NULL,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_pending ON order_items(done, created_at);

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL DEFAULT '{}',
  pin_hash TEXT,
  pin_salt TEXT,
  updated_at TEXT NOT NULL
);
`);

const insertItem = db.prepare(`
  INSERT INTO order_items (order_id, menu_id, name, qty, unit_price, done, created_at)
  VALUES (?, ?, ?, ?, ?, 0, ?)
`);

function insertItems(orderId, items, createdAt) {
  for (const item of items) {
    insertItem.run(orderId, item.id, item.name, item.qty, item.price, createdAt);
  }
}

export function createOrder(order) {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM orders WHERE client_token = ?').get(order.token);

  if (existing) {
    const done = db
      .prepare('SELECT COUNT(*) AS n FROM order_items WHERE order_id = ? AND done = 1')
      .get(existing.id).n;

    // Once the kitchen has started an order, later tablet edits must not
    // recreate items that were already served.
    if (done > 0) return { number: existing.number, updated: false };

    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(existing.id);
      insertItems(existing.id, order.items, now);
      db.prepare(
        'UPDATE orders SET total = ?, discount = ?, final_total = ?, percent = ?, updated_at = ? WHERE id = ?',
      ).run(order.total, order.discount, order.final, order.percent, now, existing.id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return { number: existing.number, updated: true };
  }

  const number = db.prepare('SELECT COALESCE(MAX(number), 0) + 1 AS n FROM orders').get().n;

  db.exec('BEGIN');
  try {
    const result = db
      .prepare(
        `INSERT INTO orders (client_token, number, total, discount, final_total, percent, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(order.token, number, order.total, order.discount, order.final, order.percent, now, now);
    insertItems(Number(result.lastInsertRowid), order.items, now);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { number, updated: false };
}

export function pendingItems() {
  return db
    .prepare(
      `SELECT id, name, qty
       FROM order_items
       WHERE done = 0
       ORDER BY created_at ASC, id ASC`,
    )
    .all();
}

export function doneToday() {
  return db
    .prepare(
      `SELECT COALESCE(SUM(qty), 0) AS n
       FROM order_items
       WHERE done = 1 AND date(done_at, 'localtime') = date('now', 'localtime')`,
    )
    .get().n;
}

export function markItemDone(id) {
  const result = db
    .prepare('UPDATE order_items SET done = 1, done_at = ? WHERE id = ? AND done = 0')
    .run(new Date().toISOString(), id);
  return result.changes > 0;
}

function localDay(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getSettings() {
  const row = db.prepare('SELECT data FROM app_settings WHERE id = 1').get();
  if (!row) return {};
  try {
    return JSON.parse(row.data);
  } catch {
    return {};
  }
}

export function getPinRecord() {
  const row = db.prepare('SELECT pin_hash, pin_salt FROM app_settings WHERE id = 1').get();
  if (!row?.pin_hash || !row?.pin_salt) return null;
  return { hash: row.pin_hash, salt: row.pin_salt };
}

export function saveSettings(settings, pin) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO app_settings (id, data, pin_hash, pin_salt, updated_at)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       data = excluded.data,
       pin_hash = COALESCE(excluded.pin_hash, app_settings.pin_hash),
       pin_salt = COALESCE(excluded.pin_salt, app_settings.pin_salt),
       updated_at = excluded.updated_at`,
  ).run(JSON.stringify(settings), pin?.hash ?? null, pin?.salt ?? null, now);
}

export function analytics() {
  const today = db
    .prepare(
      `SELECT COUNT(*) AS orders,
              COALESCE(SUM(total), 0) AS gross,
              COALESCE(SUM(discount), 0) AS discounts,
              COALESCE(SUM(final_total), 0) AS revenue
       FROM orders
       WHERE date(created_at, 'localtime') = date('now', 'localtime')`,
    )
    .get();

  const drinks = db
    .prepare(
      `SELECT COALESCE(SUM(oi.qty), 0) AS n
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE date(o.created_at, 'localtime') = date('now', 'localtime')`,
    )
    .get().n;

  const pending = db
    .prepare('SELECT COUNT(*) AS rows, COALESCE(SUM(qty), 0) AS qty FROM order_items WHERE done = 0')
    .get();

  const top = db
    .prepare(
      `SELECT oi.name, SUM(oi.qty) AS qty
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE date(o.created_at, 'localtime') = date('now', 'localtime')
       GROUP BY oi.name
       ORDER BY qty DESC, oi.name ASC
       LIMIT 8`,
    )
    .all();

  const daily = db
    .prepare(
      `SELECT date(created_at, 'localtime') AS day,
              COUNT(*) AS orders,
              COALESCE(SUM(final_total), 0) AS revenue
       FROM orders
       WHERE date(created_at, 'localtime') >= date('now', 'localtime', '-6 days')
       GROUP BY day`,
    )
    .all();
  const byDay = new Map(daily.map((row) => [row.day, row]));

  const week = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = localDay(date);
    const row = byDay.get(key);
    week.push({ day: key, orders: row?.orders ?? 0, revenue: row?.revenue ?? 0 });
  }

  const allTime = db
    .prepare('SELECT COUNT(*) AS orders, COALESCE(SUM(final_total), 0) AS revenue FROM orders')
    .get();

  return {
    today: {
      orders: today.orders,
      gross: today.gross,
      discounts: today.discounts,
      revenue: today.revenue,
      drinks,
      pendingRows: pending.rows,
      pendingDrinks: pending.qty,
    },
    top,
    week,
    allTime,
  };
}
