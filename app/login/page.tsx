import { Metadata } from "next";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign In | DeployX",
  description: "Sign in to your DeployX account.",
};

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <AuthBackground />
      <AuthCard>
        <LoginForm />
      </AuthCard>
    </div>
  );
}
