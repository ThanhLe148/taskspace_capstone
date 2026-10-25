import { NextRequest, NextResponse } from "next/server";
import { deleteSession, SESSION_COOKIE } from "@/lib/auth";
import { authErrorResponse, verifyOrigin } from "@/lib/auth-response";

export async function POST(request: NextRequest) {
  try {
    verifyOrigin(request);
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token) deleteSession(token);
    const response = new NextResponse(null, { status: 303, headers: { Location: "/sign-in" } });
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
