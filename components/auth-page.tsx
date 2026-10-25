import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SignIn } from "@/app/(landing)/_components/signin";

export async function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  if (await getCurrentUser()) redirect("/dashboard");
  return <SignIn key={mode} mode={mode} />;
}
