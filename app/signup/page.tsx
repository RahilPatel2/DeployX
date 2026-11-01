import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Join DeployX to build and deploy your projects.",
};

export default async function SignupPage() {
  const session = await getSession();
  if (session?.userId) {
    redirect("/dashboard");
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <AuthBackground />
      <AuthCard className="max-w-xl">
        <SignupForm />
      </AuthCard>
    </div>
  );
}
