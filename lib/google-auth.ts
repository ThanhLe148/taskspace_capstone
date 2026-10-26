import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { AuthError, type User } from "./auth";
import { getDatabase } from "./db";
import { GOOGLE_ERRORS, type GoogleErrorCode } from "./google-auth-errors";

export const GOOGLE_COOKIE = "taskspace_google_oauth";
export const GOOGLE_COOKIE_PATH = "/api/auth/google";
export const GOOGLE_OAUTH_SECONDS = 60 * 10;
const verifier = new OAuth2Client();

export class GoogleAuthError extends AuthError {
  constructor(public code: GoogleErrorCode) {
    super(GOOGLE_ERRORS[code]);
  }
}

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const appUrl = process.env.APP_URL?.trim() || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  if (!clientId || !clientSecret || !appUrl) throw new GoogleAuthError("google_not_configured");
  let origin: URL;
  try {
    origin = new URL(appUrl);
  } catch {
    throw new GoogleAuthError("google_not_configured");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
    (origin.protocol !== "https:" && !(origin.protocol === "http:" && local && process.env.NODE_ENV !== "production"))) {
    throw new GoogleAuthError("google_not_configured");
  }
  return { clientId, clientSecret, origin: origin.origin, redirectUri: `${origin.origin}/api/auth/google/callback` };
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function beginGoogleSignIn(previousBrowserToken?: string) {
  const config = googleConfig();
  const database = getDatabase();
  database.prepare("DELETE FROM google_oauth_requests WHERE expires_at <= ?").run(Date.now());
  if (previousBrowserToken) {
    database.prepare("DELETE FROM google_oauth_requests WHERE browser_hash = ?").run(hash(previousBrowserToken));
  }
  const state = randomBytes(32).toString("base64url");
  const browserToken = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  database.prepare(`INSERT INTO google_oauth_requests
    (state_hash, browser_hash, code_verifier, nonce, expires_at) VALUES (?, ?, ?, ?, ?)`)
    .run(hash(state), hash(browserToken), codeVerifier, nonce, Date.now() + GOOGLE_OAUTH_SECONDS * 1000);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.redirectUri,
    response_type: "code", scope: "openid email profile", state, nonce,
    code_challenge: createHash("sha256").update(codeVerifier).digest("base64url"),
    code_challenge_method: "S256", prompt: "select_account",
  }).toString();
  return { url, browserToken };
}

export async function finishGoogleSignIn(params: URLSearchParams, browserToken?: string): Promise<User> {
  const state = params.get("state");
  if (!state || !browserToken || !/^[\w-]{43}$/.test(state) || !/^[\w-]{43}$/.test(browserToken)) {
    throw new GoogleAuthError("google_invalid_state");
  }
  // Delete and return atomically: a callback can be consumed only once, by its original browser.
  const transaction = getDatabase().prepare(`DELETE FROM google_oauth_requests
    WHERE state_hash = ? AND browser_hash = ? AND expires_at > ? RETURNING code_verifier, nonce`)
    .get(hash(state), hash(browserToken), Date.now()) as { code_verifier: string; nonce: string } | undefined;
  if (!transaction) throw new GoogleAuthError("google_invalid_state");
  if (params.has("error")) throw new GoogleAuthError(params.get("error") === "access_denied" ? "google_cancelled" : "google_failed");
  const code = params.get("code");
  if (!code || code.length > 4096) throw new GoogleAuthError("google_failed");
  const config = googleConfig();
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret,
        redirect_uri: config.redirectUri, grant_type: "authorization_code", code_verifier: transaction.code_verifier }),
    });
    if (!response.ok) throw new GoogleAuthError("google_failed");
    const tokens = await response.json();
    if (typeof tokens.id_token !== "string") throw new GoogleAuthError("google_failed");
    // Google's library verifies signature, issuer, audience and expiry before exposing claims.
    const ticket = await verifier.verifyIdToken({ idToken: tokens.id_token, audience: config.clientId });
    const profile = ticket.getPayload();
    if (!profile || profile.nonce !== transaction.nonce || profile.email_verified !== true ||
      typeof profile.sub !== "string" || !profile.sub || profile.sub.length > 255 ||
      typeof profile.email !== "string" || profile.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      throw new GoogleAuthError("google_failed");
    }
    return findOrCreateGoogleUser(profile.sub, profile.email.trim().toLowerCase(), profile.name);
  } catch (error) {
    // Never log provider errors: they may contain client secrets, codes or tokens.
    if (error instanceof GoogleAuthError) throw error;
    throw new GoogleAuthError("google_failed");
  }
}

function findOrCreateGoogleUser(subject: string, email: string, name?: string): User {
  const database = getDatabase();
  database.exec("BEGIN IMMEDIATE");
  try {
    const existing = database.prepare(`SELECT users.id, users.name, users.email FROM google_accounts
      JOIN users ON users.id = google_accounts.user_id WHERE subject = ?`).get(subject) as User | undefined;
    if (existing) {
      database.exec("COMMIT");
      return existing;
    }
    // Local emails are unverified. Never silently link a Google identity by email alone.
    if (database.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
      throw new GoogleAuthError("google_account_exists");
    }
    const user = { id: randomUUID(), name: name?.trim().slice(0, 80) || email.split("@")[0], email };
    database.prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(user.id, user.name, user.email, "", Date.now());
    database.prepare("INSERT INTO google_accounts (subject, user_id) VALUES (?, ?)").run(subject, user.id);
    database.exec("COMMIT");
    return user;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
