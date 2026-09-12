"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence, Variants } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean(),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

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
        setServerError(result.error || "Incorrect username or password.");
        setIsLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setServerError("Network error. Please try again later.");
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
            className="transition-all duration-200 focus-visible:ring-primary/50"
          />
          <AnimatePresence mode="wait">
            {errors.identifier && (
              <motion.p 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: "auto" }} 
                exit={{ opacity: 0, height: 0 }} 
                className="text-xs text-red-500 mt-1"
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
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            placeholder="••••••••"
            disabled={isLoading}
            {...register("password")}
            className="transition-all duration-200 focus-visible:ring-primary/50"
          />
          <AnimatePresence mode="wait">
            {errors.password && (
              <motion.p 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: "auto" }} 
                exit={{ opacity: 0, height: 0 }} 
                className="text-xs text-red-500 mt-1"
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
