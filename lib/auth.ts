import "server-only";

import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDatabase } from "./db";

const scryptAsync = promisify(scrypt);
export const SESSION_COOKIE = "taskspace_session";
export const SESSION_SECONDS = 60 * 60 * 24 * 7;

export type User = { id: string; name: string; email: string };
type StoredUser = User & { password_hash: string };

export class AuthError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function credentials(input: unknown) {
  if (!input || typeof input !== "object") {
    throw new AuthError("Please enter your email and password.");
  }
  const { email, password } = input as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") {
    throw new AuthError("Please enter your email and password.");
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new AuthError("Please enter a valid email address.");
  }
  if (password.length < 8 || password.length > 128) {
    throw new AuthError("Password must be between 8 and 128 characters.");
  }
  return { email: normalizedEmail, password };
}

async function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

export async function registerUser(input: unknown): Promise<User> {
  const { email, password } = credentials(input);
  const name = (input as Record<string, unknown>).name;
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) {
    throw new AuthError("Name must be between 2 and 80 characters.");
  }
  const passwordHash = await hashPassword(password);
  const database = getDatabase();
  const user = { id: randomUUID(), name: name.trim(), email };
  // The UNIQUE constraint also protects against simultaneous registrations.
  const result = database.prepare(`
    INSERT INTO users (id, name, email, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING
  `).run(user.id, user.name, email, passwordHash, Date.now());
  if (!result.changes) {
    throw new AuthError("This email is already registered. Please sign in.", 409);
  }
  return user;
}

export async function authenticateUser(input: unknown): Promise<User> {
  const { email, password } = credentials(input);
  const user = getDatabase().prepare(
    "SELECT id, name, email, password_hash FROM users WHERE email = ?",
  ).get(email) as StoredUser | undefined;
  // Perform the same password work even when the email does not exist.
  const salt = user?.password_hash.split(":")[0] ?? "0".repeat(32);
  const candidate = (await hashPassword(password, salt)).split(":")[1];
  const expected = user?.password_hash.split(":")[1] ?? "0".repeat(128);
  if (!timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(expected, "hex")) || !user) {
    throw new AuthError("Email or password is incorrect.", 401);
  }
  return { id: user.id, name: user.name, email: user.email };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(userId: string, previousToken?: string) {
  const database = getDatabase();
  database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
  if (previousToken) deleteSession(previousToken);
  const token = randomBytes(32).toString("hex");
  database.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(hashToken(token), userId, Date.now() + SESSION_SECONDS * 1000);
  return token;
}

export function deleteSession(token: string) {
  getDatabase().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export async function getCurrentUser(): Promise<User | null> {
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return (getDatabase().prepare(`
    SELECT users.id, users.name, users.email FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(hashToken(token), Date.now()) as User | undefined) ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}
