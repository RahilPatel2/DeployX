import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your DeployX account.",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session?.userId) {
    redirect("/dashboard");
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <AuthBackground />
      <AuthCard>
        <LoginForm />
      </AuthCard>
    </div>
  );
}
