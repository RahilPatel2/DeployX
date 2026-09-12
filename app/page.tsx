"use client";

import Link from "next/link";
import { motion, Variants } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { AuthBackground } from "@/components/auth/AuthBackground";

export default function Home() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 24 }
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden selection:bg-primary/30">
      <AuthBackground />
      
      <main className="flex-1 flex flex-col items-center justify-center w-full px-6 text-center z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="max-w-3xl space-y-8"
        >
          <motion.div variants={itemVariants} className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
            DeployX Authentication
          </motion.div>
          
          <motion.h1 
            variants={itemVariants}
            className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70"
          >
            Build something<br />people remember.
          </motion.h1>
          
          <motion.p 
            variants={itemVariants}
            className="text-xl sm:text-2xl text-muted-foreground font-light max-w-2xl mx-auto"
          >
            A modern digital experience starts here. Seamless, secure, and incredibly fast authentication for your next big idea.
          </motion.p>
          
          <motion.div 
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <Link href="/signup" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto h-12 px-8 text-base transition-transform hover:scale-105" })}>
              Get Started
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto h-12 px-8 text-base bg-background/50 backdrop-blur-md transition-transform hover:scale-105" })}>
              Sign In
            </Link>
          </motion.div>
        </motion.div>
      </main>
      
      <motion.footer 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="w-full p-6 text-center text-sm text-muted-foreground z-10"
      >
        &copy; {new Date().getFullYear()} DeployX Inc. All rights reserved.
      </motion.footer>
    </div>
  );
}
