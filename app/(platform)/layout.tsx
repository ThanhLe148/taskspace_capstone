import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";

async function AuthenticatedPlatform({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b bg-white px-6 py-4">
        <Logo />
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm text-neutral-600">{user.email}</span>
          <form action="/api/auth/sign-out" method="post">
            <Button type="submit" variant="outline">Log out</Button>
          </form>
        </div>
      </header>
      <main className="px-6 py-16">{children}</main>
    </div>
  );
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p className="p-8 text-center">Loading your workspace…</p>}><AuthenticatedPlatform>{children}</AuthenticatedPlatform></Suspense>;
}
