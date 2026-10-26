import { NextRequest, NextResponse } from "next/server";
import { beginGoogleSignIn, GoogleAuthError, GOOGLE_COOKIE, GOOGLE_COOKIE_PATH, GOOGLE_OAUTH_SECONDS } from "@/lib/google-auth";

export function GET(request: NextRequest) {
  try {
    const { url, browserToken } = beginGoogleSignIn(request.cookies.get(GOOGLE_COOKIE)?.value);
    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.cookies.set(GOOGLE_COOKIE, browserToken, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
      path: GOOGLE_COOKIE_PATH, maxAge: GOOGLE_OAUTH_SECONDS,
    });
    return response;
  } catch (error) {
    const code = error instanceof GoogleAuthError ? error.code : "google_failed";
    return new NextResponse(null, { status: 303, headers: { Location: `/sign-in?error=${code}`, "Cache-Control": "no-store" } });
  }
}
