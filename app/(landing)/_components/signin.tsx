"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/logo";

export function SignIn({ mode = "sign-in" }: { mode?: "sign-in" | "sign-up" }) {
  const isSignUp = mode === "sign-up";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

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
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
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
