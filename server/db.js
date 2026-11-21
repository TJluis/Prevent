import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CITY_START_COINS } from "../public/js/cityDefs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "data", "club.db");

import fs from "node:fs";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS spaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    color TEXT NOT NULL,
    appearance TEXT,
    last_x REAL,
    last_z REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    space_id INTEGER NOT NULL REFERENCES spaces(id),
    user_id INTEGER,
    username TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_stats (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    score_total INTEGER NOT NULL DEFAULT 0,
    kills INTEGER NOT NULL DEFAULT 0,
    deaths INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    duel_wins INTEGER NOT NULL DEFAULT 0,
    duel_rounds INTEGER NOT NULL DEFAULT 0,
    hide_wins INTEGER NOT NULL DEFAULT 0,
    seek_wins INTEGER NOT NULL DEFAULT 0,
    tnt_wins INTEGER NOT NULL DEFAULT 0,
    tnt_blocks INTEGER NOT NULL DEFAULT 0,
    race_points INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_karts (
    user_id INTEGER NOT NULL REFERENCES users(id),
    kart_id TEXT NOT NULL,
    equipped INTEGER NOT NULL DEFAULT 0,
    unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, kart_id)
  );

  -- Ciudad social (C1-C2): cartera, mochila y estado global de coleccionables.
  CREATE TABLE IF NOT EXISTS city_wallets (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    coins INTEGER NOT NULL DEFAULT 0,
    collected INTEGER NOT NULL DEFAULT 0,
    earned INTEGER NOT NULL DEFAULT 0,
    sold INTEGER NOT NULL DEFAULT 0,
    bought INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS city_inventory (
    user_id INTEGER NOT NULL REFERENCES users(id),
    item_id TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, item_id)
  );

  CREATE TABLE IF NOT EXISTS city_collectibles (
    id TEXT PRIMARY KEY,
    available_at INTEGER NOT NULL DEFAULT 0,
    collector_id TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const DEFAULT_SPACE_ID = 1;

const userColumns = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!userColumns.includes("appearance")) {
  db.exec("ALTER TABLE users ADD COLUMN appearance TEXT");
}

// Migración para bases de datos creadas antes del Coliseo (Ola 2).
const statColumns = db.prepare("PRAGMA table_info(user_stats)").all().map((c) => c.name);
if (!statColumns.includes("duel_wins")) {
  db.exec("ALTER TABLE user_stats ADD COLUMN duel_wins INTEGER NOT NULL DEFAULT 0");
}
if (!statColumns.includes("duel_rounds")) {
  db.exec("ALTER TABLE user_stats ADD COLUMN duel_rounds INTEGER NOT NULL DEFAULT 0");
}
// Migración para bases de datos creadas antes del Escondite.
if (!statColumns.includes("hide_wins")) {
  db.exec("ALTER TABLE user_stats ADD COLUMN hide_wins INTEGER NOT NULL DEFAULT 0");
}
if (!statColumns.includes("seek_wins")) {
  db.exec("ALTER TABLE user_stats ADD COLUMN seek_wins INTEGER NOT NULL DEFAULT 0");
}
// Migración para bases de datos creadas antes del TNT Run.
if (!statColumns.includes("tnt_wins")) {
  db.exec("ALTER TABLE user_stats ADD COLUMN tnt_wins INTEGER NOT NULL DEFAULT 0");
}
if (!statColumns.includes("tnt_blocks")) {
  db.exec("ALTER TABLE user_stats ADD COLUMN tnt_blocks INTEGER NOT NULL DEFAULT 0");
}
// Migración para bases creadas antes de Karts: puntos de carrera y garaje.
if (!statColumns.includes("race_points")) {
  db.exec("ALTER TABLE user_stats ADD COLUMN race_points INTEGER NOT NULL DEFAULT 0");
}

export function ensureDefaultSpace() {
  db.prepare("INSERT OR IGNORE INTO spaces (id, name) VALUES (?, ?)").run(DEFAULT_SPACE_ID, "Club Pingüi");
  return DEFAULT_SPACE_ID;
}

export const SPACE_ID = DEFAULT_SPACE_ID;

export function createUser(username, passwordHash, color, appearance) {
  const result = db
    .prepare("INSERT INTO users (username, password_hash, color, appearance) VALUES (?, ?, ?, ?)")
    .run(username, passwordHash, color, appearance ? JSON.stringify(appearance) : null);
  return result.lastInsertRowid;
}

export function getUserByUsername(username) {
  return db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username);
}

export function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export function saveUserPosition(id, x, z) {
  db.prepare("UPDATE users SET last_x = ?, last_z = ? WHERE id = ?").run(x, z, id);
}

export function saveUserAppearance(id, appearance) {
  db.prepare("UPDATE users SET appearance = ? WHERE id = ?").run(JSON.stringify(appearance), id);
}

export function insertMessage(userId, username, text, spaceId = SPACE_ID) {
  const result = db
    .prepare("INSERT INTO messages (space_id, user_id, username, text) VALUES (?, ?, ?, ?)")
    .run(spaceId, userId, username, text);
  return result.lastInsertRowid;
}

export function getRecentMessages(limit = 50, spaceId = SPACE_ID) {
  return db
    .prepare(
      "SELECT id, username, text, created_at FROM messages WHERE space_id = ? ORDER BY id DESC LIMIT ?"
    )
    .all(spaceId, limit)
    .reverse();
}

export function createSession(token, userId, expiresAt) {
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expiresAt);
}

export function deleteSession(token) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function getSession(token) {
  return db.prepare("SELECT * FROM sessions WHERE token = ? AND expires_at > ?").get(token, Date.now());
}

export function getUserStats(userId) {
  return db.prepare("SELECT * FROM user_stats WHERE user_id = ?").get(userId) || null;
}

// Garaje de Karts: el kart inicial siempre está disponible, el resto se
// desbloquea con puntos de carrera. `equipped` permite recordar la selección
// entre sesiones sin volver a comprar.
export function getUserKarts(userId) {
  if (!userId) return [];
  return db
    .prepare("SELECT kart_id, equipped FROM user_karts WHERE user_id = ? ORDER BY kart_id")
    .all(userId)
    .map((row) => ({ id: row.kart_id, equipped: !!row.equipped }));
}

export function unlockKart(userId, kartId, equipped = false) {
  if (!userId || !kartId) return false;
  db.prepare(
    `INSERT INTO user_karts (user_id, kart_id, equipped) VALUES (?, ?, ?)
     ON CONFLICT(user_id, kart_id) DO UPDATE SET equipped = MAX(equipped, excluded.equipped)`
  ).run(userId, String(kartId).slice(0, 40), equipped ? 1 : 0);
  return true;
}

export function setEquippedKart(userId, kartId) {
  if (!userId || !kartId) return false;
  db.prepare("UPDATE user_karts SET equipped = 0 WHERE user_id = ?").run(userId);
  db.prepare(
    `INSERT INTO user_karts (user_id, kart_id, equipped) VALUES (?, ?, 1)
     ON CONFLICT(user_id, kart_id) DO UPDATE SET equipped = 1`
  ).run(userId, String(kartId).slice(0, 40));
  return true;
}

export function getEquippedKart(userId) {
  if (!userId) return null;
  const row = db
    .prepare("SELECT kart_id FROM user_karts WHERE user_id = ? AND equipped = 1 LIMIT 1")
    .get(userId);
  return row ? row.kart_id : null;
}

// ---- Ciudad social ---------------------------------------------------------
// El distrito guarda tres cosas: la cartera del avatar, su mochila y el estado
// de respawn de cada fuente. Las cuentas sobreviven al reinicio; los invitados
// conservan su espejo en memoria mientras vive el controlador.

const CITY_EMPTY_WALLET = () => ({
  coins: CITY_START_COINS,
  collected: 0,
  earned: 0,
  sold: 0,
  bought: 0,
});

export function getCityWallet(userId) {
  if (!userId) return CITY_EMPTY_WALLET();
  const row = db.prepare("SELECT coins, collected, earned, sold, bought FROM city_wallets WHERE user_id = ?").get(userId);
  if (!row) return CITY_EMPTY_WALLET();
  return {
    coins: row.coins,
    collected: row.collected,
    earned: row.earned,
    sold: row.sold,
    bought: row.bought,
  };
}

export function ensureCityWallet(userId) {
  if (!userId) return getCityWallet(userId);
  const wallet = CITY_EMPTY_WALLET();
  db.prepare(
    `INSERT OR IGNORE INTO city_wallets (user_id, coins, collected, earned, sold, bought)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, wallet.coins, wallet.collected, wallet.earned, wallet.sold, wallet.bought);
  return getCityWallet(userId);
}

export function setCityWallet(userId, wallet) {
  if (!userId || !wallet) return null;
  ensureCityWallet(userId);
  db.prepare(
    `UPDATE city_wallets
        SET coins = ?, collected = ?, earned = ?, sold = ?, bought = ?,
            updated_at = datetime('now')
      WHERE user_id = ?`
  ).run(
    Math.max(0, Math.round(Number(wallet.coins) || 0)),
    Math.max(0, Math.round(Number(wallet.collected) || 0)),
    Math.max(0, Math.round(Number(wallet.earned) || 0)),
    Math.max(0, Math.round(Number(wallet.sold) || 0)),
    Math.max(0, Math.round(Number(wallet.bought) || 0)),
    userId
  );
  return getCityWallet(userId);
}

export function getCityInventory(userId) {
  if (!userId) return [];
  return db
    .prepare("SELECT item_id, qty FROM city_inventory WHERE user_id = ? ORDER BY item_id")
    .all(userId)
    .map((row) => ({ id: row.item_id, qty: row.qty }));
}

export function setCityInventory(userId, items) {
  if (!userId || !Array.isArray(items)) return [];
  const clean = items
    .filter((item) => item && item.id && Number(item.qty) > 0)
    .map((item) => ({ id: String(item.id).slice(0, 40), qty: Math.min(999, Math.round(item.qty)) }));
  db.prepare("DELETE FROM city_inventory WHERE user_id = ?").run(userId);
  const insert = db.prepare(
    `INSERT INTO city_inventory (user_id, item_id, qty) VALUES (?, ?, ?)
     ON CONFLICT(user_id, item_id) DO UPDATE SET qty = excluded.qty, updated_at = datetime('now')`
  );
  for (const item of clean) insert.run(userId, item.id, item.qty);
  return getCityInventory(userId);
}

export function getCityCollectibles() {
  return db
    .prepare("SELECT id, available_at, collector_id FROM city_collectibles")
    .all()
    .map((row) => ({
      id: row.id,
      availableAt: row.available_at,
      collectorId: row.collector_id || null,
    }));
}

export function setCityCollectible(id, availableAt, collectorId = null) {
  if (!id) return false;
  db.prepare(
    `INSERT INTO city_collectibles (id, available_at, collector_id) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       available_at = excluded.available_at,
       collector_id = excluded.collector_id,
       updated_at = datetime('now')`
  ).run(String(id).slice(0, 40), Math.max(0, Math.round(availableAt) || 0), collectorId ? String(collectorId).slice(0, 80) : null);
  return true;
}

// Suma el resultado de una partida al historial de la cuenta. `bestStreak` es la
// racha máxima alcanzada en esta sesión, no un incremento. `duelWins` y
// `duelRounds` acumulan el Coliseo melee; `hideWins` y `seekWins`, el Escondite;
// `tntWins` y `tntBlocks`, el TNT Run; `racePoints`, las carreras de Karts.
export function recordUserStats(
  userId,
  {
    score = 0,
    kills = 0,
    deaths = 0,
    bestStreak = 0,
    duelWins = 0,
    duelRounds = 0,
    hideWins = 0,
    seekWins = 0,
    tntWins = 0,
    tntBlocks = 0,
    racePoints = 0,
  } = {}
) {
  if (!userId) return null;
  db.prepare(
    `INSERT INTO user_stats
       (user_id, score_total, kills, deaths, best_streak, duel_wins, duel_rounds,
        hide_wins, seek_wins, tnt_wins, tnt_blocks, race_points, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       score_total = score_total + excluded.score_total,
       kills = kills + excluded.kills,
       deaths = deaths + excluded.deaths,
       best_streak = MAX(best_streak, excluded.best_streak),
       duel_wins = duel_wins + excluded.duel_wins,
       duel_rounds = duel_rounds + excluded.duel_rounds,
       hide_wins = hide_wins + excluded.hide_wins,
       seek_wins = seek_wins + excluded.seek_wins,
       tnt_wins = tnt_wins + excluded.tnt_wins,
       tnt_blocks = tnt_blocks + excluded.tnt_blocks,
       race_points = race_points + excluded.race_points,
       updated_at = datetime('now')`
  ).run(
    userId,
    score,
    kills,
    deaths,
    bestStreak,
    duelWins,
    duelRounds,
    hideWins,
    seekWins,
    tntWins,
    tntBlocks,
    racePoints
  );
  return getUserStats(userId);
}

export function getTopStats(limit = 5) {
  return db
    .prepare(
      `SELECT u.username, s.score_total AS score, s.kills, s.deaths, s.best_streak
       FROM user_stats s
       JOIN users u ON u.id = s.user_id
       ORDER BY s.score_total DESC, s.kills DESC, s.best_streak DESC
       LIMIT ?`
    )
    .all(limit);
}

export function pruneExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
}

export function countSessions() {
  return db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n;
}

export function checkDb() {
  try {
    db.prepare("SELECT 1").get();
    return true;
  } catch {
    return false;
  }
}

let closed = false;

export function closeDb() {
  if (closed) return;
  closed = true;
  db.close();
}