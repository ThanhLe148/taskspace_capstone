import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { AuthError, createSession, SESSION_COOKIE, SESSION_SECONDS, type User } from "./auth";

export function verifyOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  // Next.js may use localhost internally even when the browser uses 127.0.0.1.
  const expectedOrigin = new URL(request.url);
  expectedOrigin.host = request.headers.get("host") ?? expectedOrigin.host;
  if ((origin && origin !== expectedOrigin.origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new AuthError("Please submit this form from TaskSpace.", 403);
  }
}

export async function readCredentials(request: NextRequest) {
  verifyOrigin(request);
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new AuthError("Expected a JSON request.", 415);
  }
  try {
    return await request.json();
  } catch {
    throw new AuthError("Invalid request.");
  }
}

export function signedInResponse(request: NextRequest, user: User, status = 200) {
  const response = NextResponse.json({ user }, { status, headers: { "Cache-Control": "no-store" } });
  return setSessionCookie(request, response, user);
}

export function setSessionCookie(request: NextRequest, response: NextResponse, user: User) {
  const token = createSession(user.id, request.cookies.get(SESSION_COOKIE)?.value);
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return response;
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Authentication failed:", error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
