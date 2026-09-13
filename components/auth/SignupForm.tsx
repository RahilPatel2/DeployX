"use client";

import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence, Variants } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { cn } from "@/lib/utils";

const signupSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters").regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and dashes"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
  confirmPassword: z.string(),
  agree: z.boolean().refine((val) => val === true, {
    message: "You must agree to the Terms & Privacy Policy",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupValues = z.infer<typeof signupSchema>;

const strengthLabels = ["Very Weak", "Weak", "Fair", "Good", "Strong"];
const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-emerald-400", "bg-emerald-600"];

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const redirectUrl = searchParams.get('redirect') || "/dashboard";

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
        setServerError(result.error || "An error occurred during signup.");
        setIsLoading(false);
        return;
      }

      router.push(redirectUrl);
      router.refresh();
    } catch {
      setServerError("Network error. Please try again later.");
      setIsLoading(false);
    }
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.1 }
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
          Create your account
        </motion.h1>
        <motion.p variants={itemVariants} className="text-sm text-muted-foreground">
          Join the next generation of digital products.
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
            className="transition-all duration-200 focus-visible:ring-primary/50"
          />
          <AnimatePresence mode="wait">
            {errors.fullName && (
              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-xs text-red-500 mt-1">
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
            className="transition-all duration-200 focus-visible:ring-primary/50"
          />
          <AnimatePresence mode="wait">
            {errors.username && (
              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-xs text-red-500 mt-1">
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
            className="transition-all duration-200 focus-visible:ring-primary/50"
          />
          <AnimatePresence mode="wait">
            {errors.email && (
              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-xs text-red-500 mt-1">
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
            className="transition-all duration-200 focus-visible:ring-primary/50"
          />
          <AnimatePresence mode="wait">
            {errors.password && (
              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-xs text-red-500 mt-1">
                {errors.password.message}
              </motion.p>
            )}
          </AnimatePresence>
          
          {/* Password Strength Indicator */}
          {passwordValue && passwordValue.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-2">
              <div className="flex gap-1 h-1 w-full rounded-full overflow-hidden">
                {[0, 1, 2, 3].map((level) => (
                  <div 
                    key={level} 
                    className={cn("h-full flex-1 transition-colors duration-300", strength >= level + 1 ? strengthColors[strength] : "bg-muted")}
                  />
                ))}
              </div>
              <p className={cn("text-xs mt-1 transition-colors duration-300 text-right", `text-${strengthColors[strength].replace('bg-', '')}`)}>
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
            className="transition-all duration-200 focus-visible:ring-primary/50"
          />
          <AnimatePresence mode="wait">
            {errors.confirmPassword && (
              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-xs text-red-500 mt-1">
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
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-xs text-red-500 mt-1">
                  {errors.agree.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {serverError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md"
            >
              {serverError}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={itemVariants} className="pt-2">
          <Button type="submit" className="w-full relative overflow-hidden group" disabled={isLoading}>
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
