import { Suspense } from "react";
import { AuthPage } from "@/components/auth-page";

export default function SignUpPage() {
  return <Suspense fallback={<p className="text-center">Loading…</p>}><AuthPage mode="sign-up" /></Suspense>;
}
