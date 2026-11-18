const TOKEN_KEY = "penguin_token";
const USERNAME_KEY = "penguin_username";

export function getSession() {
  return {
    token: localStorage.getItem(TOKEN_KEY),
    username: localStorage.getItem(USERNAME_KEY),
  };
}

export function setSession(token, username) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

export async function apiRegister(username, password) {
  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return { status: res.status, body: await res.json() };
}

export async function apiLogin(username, password) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return { status: res.status, body: await res.json() };
}

export async function apiMe(token) {
  const res = await fetch("/api/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, body: await res.json() };
}

export async function apiSaveAppearance(token, appearance) {
  const res = await fetch("/api/me/appearance", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ appearance }),
  });
  return { status: res.status, body: await res.json() };
}

export async function apiLogout(token) {
  await fetch("/api/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}