import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import { OAuth2Client } from "google-auth-library";
import { NextRequest } from "next/server.js";

// Run the real handlers, SQLite persistence and Google JWT verification offline.
// Only Google's HTTPS token/certificate endpoints are replaced with local fixtures.
const root = resolve(import.meta.dirname, "..");
const directory = mkdtempSync(resolve(tmpdir(), "taskspace-google-test-"));
const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const originalCerts = OAuth2Client.prototype.getFederatedSignonCertsAsync;
const cache = new Map();
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const hash = (value) => createHash("sha256").update(value).digest("hex");

// Match Next's server-only boundary without bundling or modifying application code.
function load(file) {
  const filename = resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = { exports: {} };
  cache.set(filename, loaded);
  const nativeRequire = createRequire(filename);
  const require = (id) => {
    if (id === "server-only") return {};
    if (id.startsWith("@/")) return load(`${id.slice(2)}.ts`);
    if (id.startsWith(".")) return load(`${resolve(dirname(filename), id)}.ts`);
    return nativeRequire(id);
  };
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  new Function("require", "module", "exports", outputText)(require, loaded, loaded.exports);
  return loaded.exports;
}

try {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_PATH = resolve(directory, "test.sqlite");
  process.env.APP_URL = "http://localhost:3000";
  process.env.GOOGLE_CLIENT_ID = "offline-test.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "offline-secret";
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const otherKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  OAuth2Client.prototype.getFederatedSignonCertsAsync = async () => ({
    certs: { fixture: keys.publicKey.export({ type: "spki", format: "pem" }) }, format: "PEM",
  });
  const google = load("lib/google-auth.ts");
  const auth = load("lib/auth.ts");
  const { getDatabase } = load("lib/db.ts");
  const startRoute = load("app/api/auth/google/route.ts");
  const callbackRoute = load("app/api/auth/google/callback/route.ts");
  const db = getDatabase();
  let tokenProfile = {};
  let failToken = false;
  let signingKey = keys.privateKey;
  let exchanges = 0;
  const requestFor = (url, cookie) => new NextRequest(url, { headers: cookie ? { Cookie: cookie } : {} });

  globalThis.fetch = async (url, options) => {
    check(url === "https://oauth2.googleapis.com/token", "Only the fixed Google token endpoint is used");
    const body = options.body;
    const transaction = db.prepare("SELECT * FROM google_oauth_requests WHERE code_verifier = ?").get(body.get("code_verifier"));
    check(!transaction, "OAuth transaction was consumed before token exchange");
    check(body.get("client_secret") === "offline-secret" && body.get("grant_type") === "authorization_code", "Server exchanges code using private credentials");
    check(body.get("redirect_uri") === "http://localhost:3000/api/auth/google/callback", "Callback comes from configured origin");
    check(options.redirect === "error" && options.cache === "no-store", "Token request cannot redirect or cache secrets");
    exchanges++;
    if (failToken) return Response.json({ error: "invalid_grant" }, { status: 400 });
    const now = Math.floor(Date.now() / 1000);
    const claims = { iss: "https://accounts.google.com", aud: process.env.GOOGLE_CLIENT_ID,
      sub: "google-subject-1", email: "google-user@example.com", email_verified: true,
      name: "Google User", iat: now, exp: now + 3600, ...tokenProfile };
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "fixture" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const unsigned = `${header}.${payload}`;
    const signature = sign("RSA-SHA256", Buffer.from(unsigned), signingKey).toString("base64url");
    return Response.json({ id_token: `${unsigned}.${signature}` });
  };

  function begin() {
    const result = google.beginGoogleSignIn();
    tokenProfile = { nonce: result.url.searchParams.get("nonce") };
    const params = new URLSearchParams({ code: "offline-code", state: result.url.searchParams.get("state") });
    return { ...result, params };
  }
  async function reject(callback, code) {
    await assert.rejects(callback, (error) => error instanceof google.GoogleAuthError && error.code === code);
    checks++;
  }

  const first = begin();
  check(first.url.origin === "https://accounts.google.com" && first.url.searchParams.get("scope") === "openid email profile", "Sign-in requests identity scopes only");
  const stored = db.prepare("SELECT * FROM google_oauth_requests WHERE state_hash = ?").get(hash(first.params.get("state")));
  check(stored.browser_hash === hash(first.browserToken), "State is bound to the original browser with hashed tokens");
  check(first.url.searchParams.get("code_challenge") === createHash("sha256").update(stored.code_verifier).digest("base64url"), "PKCE challenge matches verifier");
  await reject(() => google.finishGoogleSignIn(first.params), "google_invalid_state");
  await reject(() => google.finishGoogleSignIn(first.params, "a".repeat(43)), "google_invalid_state");
  check(exchanges === 0, "Missing or mismatched browser never contacts Google");
  const user = await google.finishGoogleSignIn(first.params, first.browserToken);
  check(user.email === "google-user@example.com" && user.name === "Google User", "Verified Google identity creates a local account");
  check(db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id).password_hash === "", "Google-only accounts have no local password");
  await assert.rejects(() => auth.authenticateUser({ email: user.email, password: "any-password" }), (error) => error.status === 401);
  checks++;
  await reject(() => google.finishGoogleSignIn(first.params, first.browserToken), "google_invalid_state");

  const repeated = begin();
  tokenProfile.email = "renamed@example.com";
  check((await google.finishGoogleSignIn(repeated.params, repeated.browserToken)).id === user.id, "Stable Google subject finds the same account after email changes");
  for (const claims of [
    { nonce: "wrong-nonce" }, { email_verified: false }, { aud: "another-client" },
    { iss: "https://attacker.example" }, { exp: Math.floor(Date.now() / 1000) - 3600 },
    { sub: "" }, { email: "invalid" },
  ]) {
    const flow = begin();
    tokenProfile = { ...tokenProfile, ...claims };
    await reject(() => google.finishGoogleSignIn(flow.params, flow.browserToken), "google_failed");
  }
  const badSignature = begin();
  signingKey = otherKeys.privateKey;
  await reject(() => google.finishGoogleSignIn(badSignature.params, badSignature.browserToken), "google_failed");
  signingKey = keys.privateKey;
  const badExchange = begin();
  failToken = true;
  await reject(() => google.finishGoogleSignIn(badExchange.params, badExchange.browserToken), "google_failed");
  failToken = false;
  const expired = begin();
  db.prepare("UPDATE google_oauth_requests SET expires_at = 0 WHERE state_hash = ?").run(hash(expired.params.get("state")));
  await reject(() => google.finishGoogleSignIn(expired.params, expired.browserToken), "google_invalid_state");
  const cancelled = begin();
  cancelled.params.set("error", "access_denied");
  await reject(() => google.finishGoogleSignIn(cancelled.params, cancelled.browserToken), "google_cancelled");
  const local = await auth.registerUser({ email: "local@example.com", name: "Local User", password: "local-password" });
  const conflict = begin();
  tokenProfile = { ...tokenProfile, sub: "different-subject", email: local.email };
  await reject(() => google.finishGoogleSignIn(conflict.params, conflict.browserToken), "google_account_exists");
  check(!db.prepare("SELECT * FROM google_accounts WHERE user_id = ?").get(local.id), "Email collisions do not link or change existing accounts");

  const start = startRoute.GET(requestFor("http://localhost:3000/api/auth/google"));
  const googleUrl = new URL(start.headers.get("location"));
  const oauthCookie = start.headers.get("set-cookie").split(";")[0];
  check(googleUrl.hostname === "accounts.google.com" && start.headers.get("cache-control") === "no-store", "Start handler redirects to Google without caching");
  check(start.headers.get("set-cookie").includes("HttpOnly") && start.headers.get("set-cookie").includes("SameSite=lax"), "OAuth cookie has browser security flags");
  tokenProfile = { nonce: googleUrl.searchParams.get("nonce") };
  const callbackUrl = `http://localhost:3000/api/auth/google/callback?${new URLSearchParams({ state: googleUrl.searchParams.get("state"), code: "offline-code" })}`;
  const previousSession = auth.createSession(user.id);
  const callback = await callbackRoute.GET(requestFor(callbackUrl, `${oauthCookie}; taskspace_session=${previousSession}`));
  check(callback.status === 303 && callback.headers.get("location") === "/dashboard", "Successful callback redirects to dashboard");
  const cookieHeaders = callback.headers.getSetCookie();
  check(cookieHeaders.some((cookie) => cookie.startsWith("taskspace_google_oauth=;") && cookie.includes("Max-Age=0")), "Callback clears temporary OAuth cookie");
  const session = cookieHeaders.find((cookie) => cookie.startsWith("taskspace_session="));
  check(session?.includes("HttpOnly") && session.includes("SameSite=lax"), "Callback sets the regular protected session cookie");
  check(!db.prepare("SELECT * FROM sessions WHERE token_hash = ?").get(hash(previousSession)), "Google login invalidates the previous session");
  const rawSession = session.split(";")[0].split("=")[1];
  check(db.prepare("SELECT user_id FROM sessions WHERE token_hash = ?").get(hash(rawSession)).user_id === user.id, "Only a hashed session token persists");
  const replay = await callbackRoute.GET(requestFor(callbackUrl, oauthCookie));
  check(replay.headers.get("location") === "/sign-in?error=google_invalid_state", "Callback handler rejects replay with a safe error");
  check(!replay.headers.getSetCookie().some((cookie) => cookie.startsWith("taskspace_session=")), "Failed callback cannot establish a session");

  for (const invalidOrigin of ["http://external.example", "https://example.com/path", "https://example.com?x=1", "invalid"]) {
    process.env.APP_URL = invalidOrigin;
    assert.throws(() => google.googleConfig(), (error) => error.code === "google_not_configured"); checks++;
  }
  process.env.APP_URL = "http://localhost:3000";
  process.env.NODE_ENV = "production";
  assert.throws(() => google.googleConfig(), (error) => error.code === "google_not_configured"); checks++;
  process.env.APP_URL = "https://taskspace.example";
  const secureStart = startRoute.GET(requestFor("https://taskspace.example/api/auth/google"));
  check(secureStart.headers.get("set-cookie").includes("Secure"), "Production OAuth cookie requires HTTPS");
  delete process.env.GOOGLE_CLIENT_SECRET;
  const missing = startRoute.GET(requestFor("https://taskspace.example/api/auth/google"));
  check(missing.headers.get("location") === "/sign-in?error=google_not_configured", "Missing credentials return an actionable error");
  console.log(`Passed ${checks} Google authentication checks (offline, signed JWT fixtures).`);
} finally {
  globalThis.fetch = originalFetch;
  OAuth2Client.prototype.getFederatedSignonCertsAsync = originalCerts;
  globalThis.taskspaceDatabase?.close();
  delete globalThis.taskspaceDatabase;
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
  assert.ok(directory.startsWith(resolve(tmpdir(), "taskspace-google-test-")), "Cleanup stays inside the generated test directory");
  rmSync(directory, { recursive: true, force: true });
}
