"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/logo";
import { GOOGLE_ERRORS, type GoogleErrorCode } from "@/lib/google-auth-errors";

export function SignIn({ mode = "sign-in" }: { mode?: "sign-in" | "sign-up" }) {
  const isSignUp = mode === "sign-up";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const errorCode = useSearchParams().get("error");
  const googleError = errorCode && Object.hasOwn(GOOGLE_ERRORS, errorCode)
    ? GOOGLE_ERRORS[errorCode as GoogleErrorCode] : "";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to sign in. Please try again.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const inputClass = "h-13 rounded-xl border-[#E7E5E4] px-5 text-base shadow-sm placeholder:text-[#A3A3A3] focus-visible:ring-2 focus-visible:ring-blue-500";

  return (
    <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-black shadow-sm sm:p-8">
      <div className="mb-8 flex justify-center"><Logo /></div>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{isSignUp ? "Create your TaskSpace account" : "Log in to TaskSpace"}</h1>
        <p className="mt-2 text-sm text-neutral-500">{isSignUp ? "A little more organized, starting today." : "Welcome back. Your workspace is waiting."}</p>
      </div>
      <a href="/api/auth/google" className="mb-5 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 text-sm font-semibold transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
          <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z" />
          <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.97-3.38.97-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z" />
          <path fill="#FBBC05" d="M6.4 13.93A6 6 0 0 1 6.09 12c0-.67.12-1.32.31-1.93V7.48H3.06A10 10 0 0 0 2 12c0 1.61.38 3.14 1.06 4.52l3.34-2.59Z" />
          <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.48l3.34 2.59C7.19 7.71 9.4 5.95 12 5.95Z" />
        </svg>
        Continue with Google
      </a>
      <div className="mb-5 flex items-center gap-3 text-xs text-neutral-400">
        <span className="h-px flex-1 bg-slate-200" /><span>or continue with email</span><span className="h-px flex-1 bg-slate-200" />
      </div>
      <form onSubmit={handleSubmit} className="space-y-5" aria-busy={pending}>
        <fieldset disabled={pending} className="space-y-5">
          {isSignUp && (
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-[#55534E]">Name</label>
              <Input id="name" name="name" autoComplete="name" placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} className={inputClass} />
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-[#55534E]">Email</label>
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-[#55534E]">Password</label>
            <Input id="password" name="password" type="password" autoComplete={isSignUp ? "new-password" : "current-password"} placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} aria-describedby={isSignUp ? "password-hint" : undefined} className={inputClass} />
            {isSignUp && <p id="password-hint" className="text-xs text-neutral-500">Use between 8 and 128 characters.</p>}
          </div>
        </fieldset>
        {(error || googleError) && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error || googleError}</p>}
        <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl bg-[#2383E2] text-base font-semibold text-white hover:bg-[#1B72C9]">
          {pending ? "Please wait…" : isSignUp ? "Create account" : "Log in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-neutral-500">
        {isSignUp ? "Already have an account? " : "New to TaskSpace? "}
        <Link href={isSignUp ? "/sign-in" : "/sign-up"} className="font-medium text-[#2383E2] hover:underline">{isSignUp ? "Log in" : "Create an account"}</Link>
      </p>
    </section>
  );
}
