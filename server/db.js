import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

// Suma el resultado de una partida al historial de la cuenta. `bestStreak` es la
// racha máxima alcanzada en esta sesión, no un incremento. `duelWins` y
// `duelRounds` acumulan el Coliseo melee; `hideWins` y `seekWins`, el Escondite;
// `tntWins` y `tntBlocks`, el TNT Run.
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
  } = {}
) {
  if (!userId) return null;
  db.prepare(
    `INSERT INTO user_stats
       (user_id, score_total, kills, deaths, best_streak, duel_wins, duel_rounds,
        hide_wins, seek_wins, tnt_wins, tnt_blocks, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
    tntBlocks
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