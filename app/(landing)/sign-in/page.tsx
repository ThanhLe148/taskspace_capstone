import { Suspense } from "react";
import { AuthPage } from "@/components/auth-page";

export default function SignInPage() {
  return <Suspense fallback={<p className="text-center">Loading…</p>}><AuthPage mode="sign-in" /></Suspense>;
}
