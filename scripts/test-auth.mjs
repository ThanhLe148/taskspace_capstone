import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

// Run against a locally running TaskSpace server, never a deployed service.
const base = process.env.AUTH_TEST_URL ?? "http://127.0.0.1:3100";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
const email = `auth-test-${randomUUID()}@example.com`;
const password = "Demo-password-123!";
const name = "Auth Test";
let database;
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };

async function post(action, body, cookie, headers = {}) {
  return fetch(`${base}/api/auth/${action}`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/json", Origin: new URL(base).origin, ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: JSON.stringify(body),
  });
}

function sessionCookie(response) {
  const header = response.headers.get("set-cookie");
  check(header?.includes("HttpOnly") && header?.includes("SameSite=lax"), "Session cookie has security flags");
  return header.split(";")[0];
}

async function dashboard(cookie) {
  const response = await fetch(`${base}/dashboard`, { redirect: "manual", headers: cookie ? { Cookie: cookie } : {} });
  const html = await response.text();
  return { response, html };
}

async function denied(cookie) {
  const { response, html } = await dashboard(cookie);
  check(response.headers.get("location") === "/sign-in" || (html.includes("NEXT_REDIRECT") && html.includes("/sign-in")), "Guest is redirected to sign-in");
  check(!html.includes(email), "Protected account data is not rendered for guest");
}

try {
  await denied();
  check((await post("sign-up", { name, email, password: "short" })).status === 400, "Reject short password");
  check((await post("sign-up", { name, email: "invalid", password })).status === 400, "Reject invalid email");
  check((await post("sign-up", { name: "", email, password })).status === 400, "Reject missing name");
  check((await post("sign-up", { name, email, password }, undefined, { Origin: "https://example.org" })).status === 403, "Reject cross-origin request");
  const signup = await post("sign-up", { name, email: ` ${email.toUpperCase()} `, password });
  check(signup.status === 201, "Register account");
  const user = (await signup.json()).user;
  check(user.email === email && !user.password_hash, "Normalize email and keep password hash private");
  const cookie = sessionCookie(signup);
  check((await dashboard(cookie)).html.includes(email), "Authenticated dashboard renders");
  check((await dashboard(cookie)).html.includes(email), "Session survives a second page request");

  database = new DatabaseSync(resolve(process.env.DATABASE_PATH ?? "data/taskspace.sqlite"));
  database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  const stored = database.prepare("SELECT * FROM users WHERE email = ?").get(email);
  check(stored && stored.password_hash !== password && /^[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored.password_hash), "Account persists on disk with salted password hash");
  const token = cookie.split("=")[1];
  const tokenHash = createHash("sha256").update(token).digest("hex");
  check(database.prepare("SELECT * FROM sessions WHERE token_hash = ?").get(tokenHash), "Only hashed session token is stored");
  check((await post("sign-up", { name, email, password })).status === 409, "Reject duplicate email");
  check((await post("sign-in", { email, password: "incorrect-password" })).status === 401, "Reject wrong password");
  check((await post("sign-in", { email: `missing-${email}`, password })).status === 401, "Reject unknown email");
  await denied("taskspace_session=" + "a".repeat(64));
  check((await post("sign-out", {}, cookie, { Origin: "https://example.org" })).status === 403, "Reject cross-origin logout");
  const logout = await post("sign-out", {}, cookie);
  check(logout.status === 303 && new URL(logout.headers.get("location"), base).pathname === "/sign-in", "Logout redirects to sign-in");
  check(logout.headers.get("set-cookie")?.includes("Max-Age=0"), "Logout clears cookie");
  await denied(cookie);
  const login = await post("sign-in", { email: email.toUpperCase(), password });
  check(login.status === 200, "Log in to saved account");
  const newCookie = sessionCookie(login);
  check(newCookie !== cookie, "Login issues a new session token");
  check((await dashboard(newCookie)).html.includes(email), "Login restores dashboard access");
  const rotated = await post("sign-in", { email, password }, newCookie);
  check(rotated.status === 200, "Reauthentication succeeds");
  await denied(newCookie);
  const rotatedCookie = sessionCookie(rotated);
  database.prepare("UPDATE sessions SET expires_at = ? WHERE user_id = ?").run(Date.now() - 1, user.id);
  await denied(rotatedCookie);
  console.log(`Passed ${checks} authentication checks.`);
} finally {
  if (database) {
    // Remove only the uniquely named account created by this test run.
    database.prepare("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = ?)").run(email);
    database.prepare("DELETE FROM users WHERE email = ?").run(email);
    database.close();
  }
}
