import { Metadata } from "next";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Create Account | DeployX",
  description: "Join the next generation of digital products.",
};

export default function SignupPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <AuthBackground />
      <AuthCard className="max-w-xl">
        <SignupForm />
      </AuthCard>
    </div>
  );
}
