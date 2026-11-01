"use client";

import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence, Variants } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { cn } from "@/lib/utils";
import { getSafeRedirectUrl } from "@/lib/auth/redirect";

const loginSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean(),
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginFormInner() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const redirectUrl = getSafeRedirectUrl(searchParams.get('redirect'), "/dashboard");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
      remember: false,
    },
  });

  const rememberValue = watch("remember");

  const onSubmit = async (data: LoginValues) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: data.identifier,
          password: data.password,
          remember: data.remember,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setServerError(result.error || result.message || "Incorrect username or password.");
        setIsLoading(false);
        return;
      }

      if (result.mfaRequired && result.challengeToken) {
        window.location.replace(
          `/login/mfa?challenge=${encodeURIComponent(result.challengeToken)}&returnTo=${encodeURIComponent(redirectUrl)}`
        );
        return;
      }

      window.location.replace(redirectUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error. Please try again later.";
      setServerError(msg);
      setIsLoading(false);
    }
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      <div className="space-y-2 text-center">
        <motion.h1 variants={itemVariants} className="text-3xl font-semibold tracking-tight">
          Welcome back
        </motion.h1>
        <motion.p variants={itemVariants} className="text-sm text-muted-foreground">
          Sign in to continue.
        </motion.p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <motion.div variants={itemVariants} className="space-y-2">
          <Label htmlFor="identifier">Email or username</Label>
          <Input
            id="identifier"
            placeholder="name@example.com"
            disabled={isLoading}
            {...register("identifier")}
            className="h-10 text-sm transition-all duration-200 focus-visible:ring-primary/40"
          />
          <AnimatePresence mode="wait">
            {errors.identifier && (
              <motion.p 
                role="alert"
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: "auto" }} 
                exit={{ opacity: 0, height: 0 }} 
                className="text-xs text-red-500 font-medium mt-1"
              >
                {errors.identifier.message}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link 
              href="/forgot-password" 
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            placeholder="••••••••"
            disabled={isLoading}
            {...register("password")}
          />
          <AnimatePresence mode="wait">
            {errors.password && (
              <motion.p 
                role="alert"
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: "auto" }} 
                exit={{ opacity: 0, height: 0 }} 
                className="text-xs text-red-500 font-medium mt-1"
              >
                {errors.password.message}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div variants={itemVariants} className="flex items-center space-x-2 py-2">
          <Checkbox 
            id="remember" 
            checked={rememberValue}
            onCheckedChange={(checked: boolean | "indeterminate") => setValue("remember", checked === true)}
            disabled={isLoading}
          />
          <Label 
            htmlFor="remember" 
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
          >
            Remember me
          </Label>
        </motion.div>

        <AnimatePresence mode="wait">
          {serverError && (
            <motion.div
              role="alert"
              aria-live="assertive"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-3 text-xs sm:text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-md flex items-center gap-2"
            >
              <span>{serverError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={itemVariants} className="pt-2">
          <Button type="submit" className="w-full h-10 font-semibold relative overflow-hidden group shadow-xs" disabled={isLoading}>
            <span className={cn("transition-all duration-200 flex items-center justify-center", isLoading ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0")}>
              Sign In
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
                `/api/auth/google/connect?mode=login&returnTo=${encodeURIComponent(redirectUrl)}`,
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
        <span className="text-muted-foreground">Don&apos;t have an account? </span>
        <Link href="/signup" className="text-primary font-medium hover:underline transition-all">
          Create account
        </Link>
      </motion.div>
    </motion.div>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <LoginFormInner />
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
