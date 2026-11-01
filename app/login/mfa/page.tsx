import { Metadata } from "next";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { AuthCard } from "@/components/auth/AuthCard";
import { MfaChallengeForm } from "@/components/auth/MfaChallengeForm";

export const metadata: Metadata = {
  title: "Two-Factor Verification",
  description: "Verify your identity with your two-factor authenticator app.",
};

export default function MfaPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <AuthBackground />
      <AuthCard className="max-w-md">
        <MfaChallengeForm />
      </AuthCard>
    </div>
  );
}
