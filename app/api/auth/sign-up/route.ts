import { NextRequest } from "next/server";
import { registerUser } from "@/lib/auth";
import { authErrorResponse, readCredentials, signedInResponse } from "@/lib/auth-response";

export async function POST(request: NextRequest) {
  try {
    const user = await registerUser(await readCredentials(request));
    return signedInResponse(request, user, 201);
  } catch (error) {
    return authErrorResponse(error);
  }
}
