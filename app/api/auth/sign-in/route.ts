import { NextRequest } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { authErrorResponse, readCredentials, signedInResponse } from "@/lib/auth-response";

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(await readCredentials(request));
    return signedInResponse(request, user);
  } catch (error) {
    return authErrorResponse(error);
  }
}
