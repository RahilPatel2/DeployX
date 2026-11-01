"use client";

import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence, Variants } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  ShieldCheck,
  Copy,
  Check,
  ArrowRight,
  Download,
  AlertTriangle,
} from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { cn } from "@/lib/utils";
import { getSafeRedirectUrl } from "@/lib/auth/redirect";
import { toast } from "sonner";

const signupSchema = z
  .object({
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Username can only contain letters, numbers, underscores, and dashes"
      ),
    email: z.string().email("Please enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
        "Password must contain uppercase, lowercase, number, and special symbol"
      ),
    confirmPassword: z.string(),
    agree: z.boolean().refine((val) => val === true, {
      message: "You must agree to the Terms & Privacy Policy",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SignupValues = z.infer<typeof signupSchema>;

const strengthLabels = ["Very Weak", "Weak", "Fair", "Good", "Strong"];
const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-emerald-400", "bg-emerald-600"];
const strengthTextColors = ["text-red-500", "text-orange-500", "text-yellow-500", "text-emerald-400", "text-emerald-500"];

function checkPasswordStrength(password: string): number {
  let score = 0;
  if (!password) return 0;
  if (password.length >= 8) score += 1;
  if (password.match(/[A-Z]/)) score += 1;
  if (password.match(/[a-z]/)) score += 1;
  if (password.match(/[0-9]/)) score += 1;
  if (password.match(/[^a-zA-Z0-9]/)) score += 1;
  return Math.min(4, Math.floor(score / 1.25));
}

function SignupFormInner() {
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<"form" | "mfa_prompt" | "mfa_setup" | "mfa_recovery">("form");
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // MFA Setup State
  const [mfaData, setMfaData] = useState<{
    manualKey: string;
    qrCodeDataUrl: string;
    recoveryCodes: string[];
  } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [savedCodesConfirmed, setSavedCodesConfirmed] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  const redirectUrl = getSafeRedirectUrl(searchParams.get("redirect"), "/dashboard");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      agree: false,
    },
  });

  const passwordValue = watch("password");
  const agreeValue = watch("agree");
  const strength = checkPasswordStrength(passwordValue);

  const onSubmit = async (data: SignupValues) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: data.fullName,
          username: data.username,
          email: data.email,
          password: data.password,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setServerError(result.error || result.message || "An error occurred during signup.");
        setIsLoading(false);
        return;
      }

      // Transition to optional MFA Prompt
      setIsLoading(false);
      setStage("mfa_prompt");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error. Please try again later.";
      setServerError(msg);
      setIsLoading(false);
    }
  };

  const handleStartMfaSetup = async () => {
    setIsLoading(true);
    setServerError(null);

    try {
      const res = await fetch("/api/auth/mfa/enroll", {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error || "Failed to initialize MFA setup.");
        setIsLoading(false);
        return;
      }

      setMfaData({
        manualKey: data.manualKey,
        qrCodeDataUrl: data.qrCodeDataUrl,
        recoveryCodes: data.recoveryCodes,
      });
      setIsLoading(false);
      setStage("mfa_setup");
    } catch {
      setServerError("Network error initializing MFA setup.");
      setIsLoading(false);
    }
  };

  const handleConfirmMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length !== 6) return;

    setIsLoading(true);
    setServerError(null);

    try {
      const res = await fetch("/api/auth/mfa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verificationCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error || "Invalid verification code.");
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      setStage("mfa_recovery");
    } catch {
      setServerError("Network error confirming verification code.");
      setIsLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (mfaData?.manualKey) {
      navigator.clipboard.writeText(mfaData.manualKey.replace(/\s+/g, ""));
      setCopiedKey(true);
      toast.success("Manual key copied to clipboard");
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCopyCodes = () => {
    if (mfaData?.recoveryCodes) {
      navigator.clipboard.writeText(mfaData.recoveryCodes.join("\n"));
      setCopiedCodes(true);
      toast.success("Recovery codes copied to clipboard");
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  const handleDownloadCodes = () => {
    if (mfaData?.recoveryCodes) {
      const text = `DEPLOYX EMERGENCY RECOVERY CODES\nGenerated: ${new Date().toISOString()}\n\n${mfaData.recoveryCodes.join("\n")}\n\nKeep these codes in a safe, offline place. Each code can be used once.`;
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "deployx-recovery-codes.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Recovery codes downloaded");
    }
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
  };

  // --------------------------------------------------------------------------
  // STAGE 2: MFA PROMPT (Choose setup or skip)
  // --------------------------------------------------------------------------
  if (stage === "mfa_prompt") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 mx-auto">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Secure your account with two-factor authentication</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Add an essential layer of security to your DeployX deployments and API keys using Google Authenticator or compatible TOTP app.
          </p>
        </div>

        <div className="pt-4 space-y-3">
          <Button
            type="button"
            className="w-full h-11 font-semibold flex items-center justify-center gap-2"
            disabled={isLoading}
            onClick={handleStartMfaSetup}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Set up Google Authenticator
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full h-10 text-muted-foreground hover:text-foreground"
            onClick={() => window.location.replace(redirectUrl)}
          >
            Skip for now
          </Button>
        </div>

        <p className="text-xs text-muted-foreground/80">
          You can always set up two-factor authentication later in Account Settings → Security.
        </p>
      </motion.div>
    );
  }

  // --------------------------------------------------------------------------
  // STAGE 3: MFA SETUP (Scan QR & Verify initial code)
  // --------------------------------------------------------------------------
  if (stage === "mfa_setup" && mfaData) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold tracking-tight">Set up Google Authenticator</h2>
          <p className="text-xs text-muted-foreground">
            Scan the QR code below using Google Authenticator, Authy, or any TOTP app.
          </p>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-xs border border-border/40 w-fit mx-auto">
          <Image
            src={mfaData.qrCodeDataUrl}
            alt="MFA QR Code"
            width={180}
            height={180}
            unoptimized
            className="rounded-lg"
          />
        </div>

        {/* Manual Setup Key Alternative */}
        <div className="bg-muted/40 p-3 rounded-lg border border-border/40 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Can&apos;t scan? Enter key manually:</span>
            <button
              type="button"
              onClick={handleCopyKey}
              className="text-primary hover:underline flex items-center gap-1 font-medium"
            >
              {copiedKey ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedKey ? "Copied" : "Copy key"}
            </button>
          </div>
          <div className="font-mono text-xs text-foreground tracking-wider select-all break-all text-center py-1">
            {mfaData.manualKey}
          </div>
        </div>

        {/* Verification Form */}
        <form onSubmit={handleConfirmMfa} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="signupMfaCode" className="text-xs">
              Enter 6-digit code from your app:
            </Label>
            <Input
              id="signupMfaCode"
              placeholder="000000"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
              disabled={isLoading}
              className="h-10 text-center font-mono text-lg font-bold tracking-widest"
              autoFocus
            />
          </div>

          <AnimatePresence mode="wait">
            {serverError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-2.5 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-md text-center"
              >
                {serverError}
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            type="submit"
            className="w-full h-10 font-semibold"
            disabled={isLoading || verificationCode.length !== 6}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Verify & Activate MFA
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full h-9 text-xs text-muted-foreground"
            onClick={() => window.location.replace(redirectUrl)}
          >
            Cancel and finish registration
          </Button>
        </form>
      </motion.div>
    );
  }

  // --------------------------------------------------------------------------
  // STAGE 4: MFA RECOVERY CODES DISPLAY
  // --------------------------------------------------------------------------
  if (stage === "mfa_recovery" && mfaData) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
        <div className="space-y-1 text-center">
          <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mx-auto mb-1">
            <Check className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Two-Factor Authentication Active</h2>
          <p className="text-xs text-muted-foreground">
            Save these emergency recovery codes. Each code can be used once if you lose your phone.
          </p>
        </div>

        {/* Warning banner */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2.5 text-xs text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
          <span>These codes will not be shown again. Store them in a secure password manager or offline file.</span>
        </div>

        {/* Recovery codes grid */}
        <div className="grid grid-cols-2 gap-2 bg-muted/40 p-3 rounded-lg border border-border/40 font-mono text-xs text-center font-bold tracking-wider select-all">
          {mfaData.recoveryCodes.map((code, idx) => (
            <div key={idx} className="bg-card/60 py-1.5 px-2 rounded border border-border/30">
              {code}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={handleCopyCodes}
          >
            {copiedCodes ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
            {copiedCodes ? "Copied" : "Copy Codes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={handleDownloadCodes}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Download .txt
          </Button>
        </div>

        <div className="flex items-start space-x-2 pt-1">
          <Checkbox
            id="confirmSaved"
            checked={savedCodesConfirmed}
            onCheckedChange={(checked: boolean | "indeterminate") => setSavedCodesConfirmed(checked === true)}
            className="mt-0.5"
          />
          <Label htmlFor="confirmSaved" className="text-xs leading-normal cursor-pointer select-none text-muted-foreground">
            I have saved my backup recovery codes in a safe place.
          </Label>
        </div>

        <Button
          type="button"
          className="w-full h-10 font-semibold"
          disabled={!savedCodesConfirmed}
          onClick={() => window.location.replace(redirectUrl)}
        >
          <ArrowRight className="h-4 w-4 mr-2" />
          Complete Registration & Enter Dashboard
        </Button>
      </motion.div>
    );
  }

  // --------------------------------------------------------------------------
  // STAGE 1: STANDARD REGISTRATION FORM
  // --------------------------------------------------------------------------
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      <div className="space-y-2 text-center">
        <motion.h1 variants={itemVariants} className="text-3xl font-semibold tracking-tight">
          Create your account
        </motion.h1>
        <motion.p variants={itemVariants} className="text-sm text-muted-foreground">
          Deploy your web applications with zero configuration.
        </motion.p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <motion.div variants={itemVariants} className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            placeholder="John Doe"
            disabled={isLoading}
            {...register("fullName")}
            className="h-10 text-sm transition-all duration-200 focus-visible:ring-primary/40"
          />
          <AnimatePresence mode="wait">
            {errors.fullName && (
              <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-xs text-red-500 font-medium mt-1">
                {errors.fullName.message}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            placeholder="johndoe"
            disabled={isLoading}
            {...register("username")}
            className="h-10 text-sm transition-all duration-200 focus-visible:ring-primary/40"
          />
          <AnimatePresence mode="wait">
            {errors.username && (
              <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-xs text-red-500 font-medium mt-1">
                {errors.username.message}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            disabled={isLoading}
            {...register("email")}
            className="h-10 text-sm transition-all duration-200 focus-visible:ring-primary/40"
          />
          <AnimatePresence mode="wait">
            {errors.email && (
              <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-xs text-red-500 font-medium mt-1">
                {errors.email.message}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            placeholder="••••••••"
            disabled={isLoading}
            {...register("password")}
          />
          <AnimatePresence mode="wait">
            {errors.password && (
              <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-xs text-red-500 font-medium mt-1">
                {errors.password.message}
              </motion.p>
            )}
          </AnimatePresence>

          {passwordValue && passwordValue.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-2">
              <div className="flex gap-1 h-1.5 w-full rounded-full overflow-hidden">
                {[0, 1, 2, 3].map((level) => (
                  <div
                    key={level}
                    className={cn("h-full flex-1 transition-colors duration-300", strength >= level + 1 ? strengthColors[strength] : "bg-muted")}
                  />
                ))}
              </div>
              <p className={cn("text-xs mt-1 font-medium transition-colors duration-300 text-right", strengthTextColors[strength])}>
                {strengthLabels[strength]}
              </p>
            </motion.div>
          )}
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <PasswordInput
            id="confirmPassword"
            placeholder="••••••••"
            disabled={isLoading}
            {...register("confirmPassword")}
          />
          <AnimatePresence mode="wait">
            {errors.confirmPassword && (
              <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-xs text-red-500 font-medium mt-1">
                {errors.confirmPassword.message}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div variants={itemVariants} className="flex items-start space-x-2 py-2">
          <Checkbox
            id="agree"
            checked={agreeValue}
            onCheckedChange={(checked: boolean | "indeterminate") => setValue("agree", checked === true)}
            disabled={isLoading}
            className="mt-1"
          />
          <div className="grid leading-none">
            <Label
              htmlFor="agree"
              className="text-sm font-medium leading-normal peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
            >
              I agree to the Terms & Privacy Policy
            </Label>
            <AnimatePresence mode="wait">
              {errors.agree && (
                <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-xs text-red-500 font-medium mt-1">
                  {errors.agree.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {serverError && (
            <motion.div
              role="alert"
              aria-live="assertive"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-3 text-xs sm:text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-md"
            >
              {serverError}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={itemVariants} className="pt-2">
          <Button type="submit" className="w-full h-10 font-semibold relative overflow-hidden group shadow-xs" disabled={isLoading}>
            <span className={cn("transition-all duration-200 flex items-center justify-center", isLoading ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0")}>
              Create Account
            </span>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
          </Button>
        </motion.div>

        <div className="relative my-3">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <motion.div variants={itemVariants}>
          <Button
            type="button"
            variant="outline"
            className="w-full h-10 font-medium flex items-center justify-center gap-2 border-border/80 hover:bg-muted/50"
            disabled={isLoading}
            onClick={() => {
              window.location.href = new URL(
                `/api/auth/google/connect?mode=signup&returnTo=${encodeURIComponent(redirectUrl)}`,
                window.location.origin
              ).toString();
            }}
          >
            <GoogleIcon className="h-4 w-4" />
            Continue with Google
          </Button>
        </motion.div>
      </form>

      <motion.div variants={itemVariants} className="text-center text-sm">
        <span className="text-muted-foreground">Already have an account? </span>
        <Link href="/login" className="text-primary font-medium hover:underline transition-all">
          Sign in
        </Link>
      </motion.div>
    </motion.div>
  );
}

export function SignupForm() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <SignupFormInner />
    </Suspense>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}
