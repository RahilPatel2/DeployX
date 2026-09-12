"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AuthCardProps {
  children: ReactNode;
  className?: string;
}

export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.5, 
        ease: [0.23, 1, 0.32, 1] // Custom easing for premium feel
      }}
      className={cn(
        "relative w-full max-w-md mx-auto z-10",
        className
      )}
    >
      {/* Outer subtle glow/border effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-br from-primary/30 to-muted/30 rounded-2xl blur opacity-30"></div>
      
      {/* Main Card Content */}
      <div className="relative bg-background/80 backdrop-blur-xl border border-white/10 dark:border-white/5 rounded-2xl shadow-2xl p-8 sm:p-10">
        {children}
      </div>
    </motion.div>
  );
}
