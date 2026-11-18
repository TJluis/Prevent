import express from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  createUser,
  getUserByUsername,
  getUserById,
  saveUserAppearance,
  ensureDefaultSpace,
  createSession,
  deleteSession,
  getSession,
  pruneExpiredSessions,
} from "./db.js";
import { normalizeAppearance, DEFAULT_APPEARANCE } from "./appearance.js";

ensureDefaultSpace();

const COLORS = [
  "#f87171", "#fb923c", "#facc15", "#4ade80", "#2dd4bf",
  "#60a5fa", "#a78bfa", "#f472b6", "#fbbf24", "#34d399",
];

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_ATTEMPTS = 20;
const attempts = new Map();

function isRateLimited(req) {
  const now = Date.now();
  attempts.forEach((list, key) => {
    if (list.length && now - list[list.length - 1] > RATE_WINDOW_MS) {
      attempts.delete(key);
    }
  });

  const key = `${req.ip}|${req.path}`;
  const list = (attempts.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX_ATTEMPTS) {
    attempts.set(key, list);
    return true;
  }
  list.push(now);
  attempts.set(key, list);
  return false;
}

setInterval(() => {
  const now = Date.now();
  attempts.forEach((list, key) => {
    if (!list.length || now - list[list.length - 1] > RATE_WINDOW_MS) {
      attempts.delete(key);
    }
  });
}, RATE_WINDOW_MS).unref();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function newSession(userId) {
  const token = randomBytes(24).toString("hex");
  createSession(token, userId, Date.now() + SESSION_TTL_MS);
  return token;
}

export function destroySession(token) {
  deleteSession(token);
}

export function getSessionUser(token) {
  const session = getSession(token);
  if (!session) return null;
  return getUserById(session.user_id);
}

function parseAppearance(user) {
  if (!user) return DEFAULT_APPEARANCE;
  let raw = null;
  if (typeof user.appearance === "string" && user.appearance) {
    try {
      raw = JSON.parse(user.appearance);
    } catch {
      raw = null;
    }
  } else if (user.appearance && typeof user.appearance === "object") {
    raw = user.appearance;
  }
  return normalizeAppearance(raw);
}

function publicUser(user) {
  return { id: user.id, username: user.username, color: user.color, appearance: parseAppearance(user) };
}

export function authRouter() {
  const router = express.Router();
  router.use(express.json());

  router.post("/register", (req, res) => {
    if (isRateLimited(req)) {
      return res.status(429).json({ error: "Demasiados intentos. Espera unos minutos." });
    }
    const username = String(req.body?.username || "").trim().slice(0, 20);
    const password = String(req.body?.password || "");

    if (!username || username.length < 2) {
      return res.status(400).json({ error: "El nombre debe tener al menos 2 caracteres." });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 4 caracteres." });
    }
    if (getUserByUsername(username)) {
      return res.status(409).json({ error: "Ese nombre ya está en uso." });
    }

    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const id = createUser(username, hashPassword(password), color, DEFAULT_APPEARANCE);
    const token = newSession(id);
    res.status(201).json({ token, user: publicUser(getUserById(id)) });
  });

  router.post("/login", (req, res) => {
    if (isRateLimited(req)) {
      return res.status(429).json({ error: "Demasiados intentos. Espera unos minutos." });
    }
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    const user = getUserByUsername(username);

    if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Nombre o contraseña incorrectos." });
    }

    const token = newSession(user.id);
    res.json({ token, user: publicUser(user) });
  });

  router.post("/logout", (req, res) => {
    const token = req.body?.token;
    if (token) destroySession(token);
    res.json({ ok: true });
  });

  router.get("/me", (req, res) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    const user = token ? getSessionUser(token) : null;
    if (!user) return res.status(401).json({ error: "Sesión inválida." });
    res.json({ user: publicUser(user) });
  });

  router.put("/me/appearance", (req, res) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    const user = token ? getSessionUser(token) : null;
    if (!user) return res.status(401).json({ error: "Sesión inválida." });

    const appearance = normalizeAppearance(req.body?.appearance);
    saveUserAppearance(user.id, appearance);
    res.json({ user: { ...publicUser(user), appearance } });
  });

  return router;
}

export function createSocketAuthMiddleware() {
  return (socket, next) => {
    const token = socket.handshake.auth?.token;
    const user = token ? getSessionUser(token) : null;

    if (!user) {
      socket.data.guest = true;
      return next();
    }

    socket.data.userId = user.id;
    socket.data.username = user.username;
    socket.data.color = user.color;
    socket.data.appearance = parseAppearance(user);
    socket.data.token = token;
    next();
  };
}