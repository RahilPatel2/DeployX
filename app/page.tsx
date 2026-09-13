"use client";

import Link from "next/link";
import { motion, Variants } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight, GitFork, Terminal, Zap, Globe, Shield, Box, Code } from "lucide-react";
import { AuthBackground } from "@/components/auth/AuthBackground";

export default function Home() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  const pipelineSteps = [
    { name: "Push", icon: GitFork, color: "text-blue-500" },
    { name: "Build", icon: Box, color: "text-purple-500" },
    { name: "Test", icon: Shield, color: "text-emerald-500" },
    { name: "Deploy", icon: Globe, color: "text-primary" }
  ];

  return (
    <div className="relative min-h-screen bg-background selection:bg-primary/30 flex flex-col font-sans">
      <AuthBackground />
      
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/50 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between mx-auto px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-foreground rounded-md flex items-center justify-center">
              <span className="text-background font-bold text-sm">DX</span>
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:inline-block">DeployX</span>
          </div>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-muted-foreground">
            <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="#infrastructure" className="hover:text-foreground transition-colors">Infrastructure</Link>
            <Link href="#pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/docs" className="hover:text-foreground transition-colors">Documentation</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium hover:text-foreground transition-colors text-muted-foreground">Log in</Link>
            <Link href="/signup" className={buttonVariants({ size: "sm", className: "rounded-full px-5" })}>
              Sign Up
            </Link>
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <main className="flex-1 z-10 w-full pt-20 pb-32 overflow-hidden">
        <div className="container mx-auto px-6 flex flex-col items-center text-center">
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="max-w-4xl space-y-8 flex flex-col items-center">
            
            <motion.div variants={itemVariants} className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
              DeployX v2.0 is now live
            </motion.div>
            
            <motion.h1 variants={itemVariants} className="text-5xl sm:text-7xl md:text-8xl font-extrabold tracking-tighter leading-[1.1] bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/60">
              Ship code.<br />Not infrastructure.
            </motion.h1>
            
            <motion.p variants={itemVariants} className="text-xl sm:text-2xl text-muted-foreground font-light max-w-2xl mx-auto tracking-tight">
              From GitHub repository to production in moments. The premium platform for ambitious engineering teams.
            </motion.p>
            
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 w-full sm:w-auto">
              <Link href="/dashboard/projects/new" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto h-14 px-8 text-base font-semibold rounded-full shadow-lg hover:shadow-primary/25 transition-all" })}>
                Start Deploying <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link href="#demo" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto h-14 px-8 text-base font-semibold rounded-full bg-background/50 backdrop-blur-md border-border/50 hover:bg-muted/50 transition-all" })}>
                Explore Demo
              </Link>
            </motion.div>

            {/* Pipeline Visualization */}
            <motion.div variants={itemVariants} className="w-full max-w-3xl mt-24 relative">
              <div className="absolute top-1/2 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-border to-transparent -z-10 -translate-y-1/2" />
              <div className="flex justify-between items-center relative">
                {pipelineSteps.map((step, i) => (
                  <motion.div 
                    key={step.name} 
                    className="flex flex-col items-center gap-4 relative bg-background px-4"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + (i * 0.2), duration: 0.5 }}
                  >
                    <div className="h-16 w-16 rounded-2xl bg-card border border-border/50 shadow-xl flex items-center justify-center ring-4 ring-background relative overflow-hidden group hover:border-primary/50 transition-colors cursor-default">
                      <div className={`absolute inset-0 opacity-20 bg-gradient-to-br from-current to-transparent ${step.color}`} />
                      <step.icon className={`h-8 w-8 ${step.color} relative z-10`} />
                    </div>
                    <span className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">{step.name}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

          </motion.div>
        </div>
      </main>
      
      {/* Features Grid */}
      <section className="py-24 border-t border-border/50 bg-[#0a0a0a] z-10 w-full">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <Zap className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold tracking-tight">Instant Edge Deployments</h3>
              <p className="text-muted-foreground leading-relaxed">Your code is distributed to our global edge network in seconds, ensuring sub-millisecond latency for your users everywhere.</p>
            </div>
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Code className="h-6 w-6 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold tracking-tight">Framework Agnostic</h3>
              <p className="text-muted-foreground leading-relaxed">Built-in support for Next.js, React, Vue, Svelte, Nuxt, and 30+ other modern web frameworks with zero configuration required.</p>
            </div>
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                <Terminal className="h-6 w-6 text-purple-500" />
              </div>
              <h3 className="text-xl font-bold tracking-tight">Advanced Analytics</h3>
              <p className="text-muted-foreground leading-relaxed">Real-time traffic insights, performance monitoring, and build analytics built directly into your dashboard.</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="border-t border-border/50 bg-black py-12 z-10 w-full">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-foreground rounded flex items-center justify-center">
              <span className="text-background font-bold text-[10px]">DX</span>
            </div>
            <span className="font-bold text-sm tracking-tight">DeployX Inc.</span>
          </div>
          <div className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} DeployX. Building the future of infrastructure.
          </div>
        </div>
      </footer>
    </div>
  );
}
