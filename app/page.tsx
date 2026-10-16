"use client";

import * as React from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { buttonVariants, Button } from "@/components/ui/button";
import {
  ArrowRight,
  GitBranch,
  Terminal,
  Zap,
  Globe,
  ShieldCheck,
  Cpu,
  Layers,
  Menu,
  X,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { AuthBackground } from "@/components/auth/AuthBackground";

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 260, damping: 20 },
    },
  };

  const pipelineSteps = [
    {
      step: "01",
      name: "Git Push",
      desc: "Instant webhook triggers on branch commit",
      icon: GitBranch,
      badge: "GitHub OAuth",
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      step: "02",
      name: "Detect & Build",
      desc: "Automatic framework build in isolated sandbox",
      icon: Cpu,
      badge: "Zero-Config",
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      step: "03",
      name: "Live Logs",
      desc: "Real-time build logs with credential redaction",
      icon: Terminal,
      badge: "Encrypted",
      color: "text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/20",
    },
    {
      step: "04",
      name: "Edge Deploy",
      desc: "Global distribution to Cloudflare Pages",
      icon: Globe,
      badge: "Global Edge",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
  ];

  return (
    <div className="relative min-h-screen bg-background selection:bg-primary/25 flex flex-col font-sans text-foreground">
      <AuthBackground />

      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between mx-auto px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 bg-foreground rounded-md flex items-center justify-center transition-transform group-hover:scale-105">
              <span className="text-background font-bold text-sm">DX</span>
            </div>
            <span className="font-bold text-lg tracking-tight">DeployX</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-medium text-muted-foreground">
            <Link href="#pipeline" className="hover:text-foreground transition-colors">
              Pipeline
            </Link>
            <Link href="#features" className="hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#architecture" className="hover:text-foreground transition-colors">
              Architecture
            </Link>
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
          </nav>

          {/* Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className={buttonVariants({ size: "sm", className: "rounded-md px-4 text-xs font-semibold" })}
            >
              Get Started
            </Link>
          </div>

          {/* Mobile menu trigger */}
          <div className="flex md:hidden items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-border/40 bg-background/95 backdrop-blur px-6 py-4 space-y-3">
            <Link
              href="#pipeline"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Pipeline
            </Link>
            <Link
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Features
            </Link>
            <Link
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Architecture
            </Link>
            <div className="pt-3 border-t border-border/40 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className={buttonVariants({ variant: "outline", size: "sm", className: "w-full justify-center" })}
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className={buttonVariants({ size: "sm", className: "w-full justify-center" })}
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <main className="flex-1 z-10 w-full pt-16 sm:pt-24 pb-20">
        <div className="container mx-auto px-4 sm:px-6 flex flex-col items-center text-center">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="max-w-4xl space-y-6 flex flex-col items-center"
          >
            {/* Live Tag */}
            <motion.div
              variants={itemVariants}
              className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1 text-xs font-medium text-foreground backdrop-blur-md"
            >
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
              Automated Cloudflare Edge Deployments
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.08] text-foreground"
            >
              Deploy web apps from GitHub <br className="hidden sm:inline" />
              <span className="text-muted-foreground">directly to the edge.</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={itemVariants}
              className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto tracking-normal leading-relaxed font-normal"
            >
              Connect your repository, select your branch, and ship automatically. DeployX handles framework
              detection, sandboxed builds, log streaming, and Cloudflare Pages distribution.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 w-full sm:w-auto"
            >
              <Link
                href="/dashboard/projects/new"
                className={buttonVariants({
                  size: "lg",
                  className: "w-full sm:w-auto h-11 px-6 text-sm font-semibold rounded-md shadow-xs",
                })}
              >
                Deploy a Project <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/dashboard"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "w-full sm:w-auto h-11 px-6 text-sm font-medium rounded-md border-border/60",
                })}
              >
                Go to Dashboard
              </Link>
            </motion.div>

            {/* Terminal Preview Card */}
            <motion.div
              variants={itemVariants}
              className="w-full max-w-3xl mt-12 rounded-xl border border-border/50 bg-card/60 backdrop-blur-md shadow-2xl overflow-hidden text-left font-mono text-xs"
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/40">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-[11px] text-muted-foreground font-sans">DeployX Pipeline Console</span>
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Ready
                </span>
              </div>
              <div className="p-4 sm:p-5 space-y-2 text-muted-foreground leading-relaxed overflow-x-auto">
                <p className="text-foreground">
                  <span className="text-emerald-400">$</span> git push origin main
                </p>
                <p className="text-blue-400/90">&gt; Webhook received for repo: owner/next-dashboard</p>
                <p>&gt; Detecting framework: Next.js (App Router)</p>
                <p>&gt; Executing build: npm run build</p>
                <p className="text-emerald-400/90">&gt; Build output generated in .next (static export verified)</p>
                <p>&gt; Deploying to Cloudflare Pages edge network...</p>
                <p className="text-foreground font-semibold pt-1 flex items-center gap-1 text-xs">
                  <span className="text-emerald-400">✓ Production URL:</span>
                  <span className="text-blue-400 underline underline-offset-2">https://next-dashboard.pages.dev</span>
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Pipeline Section */}
        <section id="pipeline" className="container mx-auto px-4 sm:px-6 mt-28">
          <div className="text-center max-w-xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              A Transparent, 4-Stage Deployment Engine
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Every deployment follows a deterministic, observable lifecycle from code commit to global availability.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {pipelineSteps.map((step) => (
              <div
                key={step.name}
                className="relative rounded-xl border border-border/50 bg-card/40 p-5 flex flex-col justify-between hover:border-border transition-colors group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center border ${step.bg}`}>
                      <step.icon className={`h-5 w-5 ${step.color}`} />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground/60">{step.step}</span>
                  </div>
                  <h3 className="font-semibold text-sm text-foreground tracking-tight">{step.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{step.desc}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-border/30">
                  <span className="text-[11px] font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">
                    {step.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Architecture & Features Grid */}
        <section id="features" className="container mx-auto px-4 sm:px-6 mt-28">
          <div className="text-center max-w-xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Production Architecture Built for Developers
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Clean separation of authentication, isolated databases, sandboxed builds, and edge delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <div className="rounded-xl border border-border/50 bg-card/40 p-6 space-y-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Real-Time Webhook Triggering</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                HMAC-SHA256 signature verification guarantees every push event is genuine, triggering automated builds
                in seconds.
              </p>
            </div>

            <div className="rounded-xl border border-border/50 bg-card/40 p-6 space-y-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Strict Tenant Isolation</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                MongoDB query scoping ensures users only access their own repositories, deployment logs, environment
                keys, and domains.
              </p>
            </div>

            <div className="rounded-xl border border-border/50 bg-card/40 p-6 space-y-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Instant Redeploy & Rollback</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Historical deployments pin exact Git commit SHAs, enabling instant, reliable rollbacks with complete
                build audits.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="container mx-auto px-4 sm:px-6 mt-28">
          <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-card/60 to-card/20 p-8 sm:p-12 text-center max-w-4xl mx-auto space-y-5">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Ready to ship your next project?
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Connect your GitHub account in seconds and deploy your web application with zero server configuration.
            </p>
            <div className="pt-2 flex justify-center">
              <Link
                href="/signup"
                className={buttonVariants({ size: "lg", className: "h-11 px-8 text-sm font-semibold rounded-md" })}
              >
                Create Free Account <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background/60 py-10 z-10 w-full text-xs text-muted-foreground">
        <div className="container mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 bg-foreground rounded flex items-center justify-center">
              <span className="text-background font-bold text-[9px]">DX</span>
            </div>
            <span className="font-semibold text-foreground">DeployX</span>
            <span className="text-muted-foreground/60">— Cloudflare Edge Platform</span>
          </div>
          <div>&copy; {new Date().getFullYear()} DeployX. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
