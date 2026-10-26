import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth-response";
import { finishGoogleSignIn, GoogleAuthError, GOOGLE_COOKIE, GOOGLE_COOKIE_PATH } from "@/lib/google-auth";

export async function GET(request: NextRequest) {
  let response: NextResponse;
  try {
    const user = await finishGoogleSignIn(request.nextUrl.searchParams, request.cookies.get(GOOGLE_COOKIE)?.value);
    response = new NextResponse(null, { status: 303, headers: { Location: "/dashboard" } });
    setSessionCookie(request, response, user);
  } catch (error) {
    const code = error instanceof GoogleAuthError ? error.code : "google_failed";
    response = new NextResponse(null, { status: 303, headers: { Location: `/sign-in?error=${code}` } });
  }
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set(GOOGLE_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: GOOGLE_COOKIE_PATH, maxAge: 0 });
  return response;
}
